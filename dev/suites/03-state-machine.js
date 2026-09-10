'use strict';
const H = require('../lib/harness');
const A = require('../lib/app');

module.exports = H.defineSuite(
  'State machine and capacity',
  'The exact capacity scenario, then the gates that stop a reservation being made twice or a binding being changed quietly.',
  async ({ context, rec }) => {
    const page = await A.openApp(context);

    /* ---- the exact scenario ---- */
    rec.check('1. Start at 120 minutes', await A.remaining(page) === 120, 'remaining ' + await A.remaining(page));

    await A.decide(page, 'R001', { state:'provisional_approval', minutes:50,
      reason:'Renewal date disputed in the records; 50 minutes now, displacing the partner conversation, which has no deadline.' });
    rec.check('2. Provisionally approve 50, leaving 70', await A.remaining(page) === 70, await A.capacityText(page));

    await A.decide(page, 'R002', { state:'provisional_approval', minutes:40,
      reason:'Identity unresolved but the deadline is close; holding 40 minutes while identity is confirmed.' });
    rec.check('3. Provisionally approve another 40, leaving 30', await A.remaining(page) === 30, await A.capacityText(page));

    await A.selectRequest(page, 'R001');
    await page.check('#act_binding');
    await page.waitForTimeout(160);
    const minutesField = await page.$('#minutesIn');
    const carried = await page.textContent('#decisionBody');
    rec.check('4a. Converting locks the duration and says the reservation is carried across',
      minutesField === null && /carried across unchanged: 50 minutes/.test(carried),
      'no duration field is offered during a conversion');
    await page.fill('#reasonIn', 'Leader confirmed the renewal session; converting the hold into a firm commitment.');
    await A.fillAlternative(page);
    await page.click('#saveDecision');
    await page.waitForTimeout(260);
    rec.check('4b. Converting to binding still leaves 30, with no second reservation',
      await A.remaining(page) === 30, await A.capacityText(page));

    const blocked = await A.decide(page, 'R004', { state:'provisional_approval', minutes:45, reason:'should not fit' });
    rec.check('5. A new 45-minute approval is blocked, and the shortfall is stated',
      /reserves 45 more minutes, but batch A has only 30 left — 15 minutes short/.test(blocked.formErrors) &&
      await A.remaining(page) === 30,
      (blocked.formErrors.match(/This reserves[^.]*\./) || ['none'])[0]);

    await page.click('#openPromise');
    await page.waitForTimeout(280);
    await page.selectOption('#promiseLinkSel', '');
    await page.waitForTimeout(140);
    await page.fill('#promiseIdIn', 'verbal-2026-09-05');
    await page.fill('#promiseDescIn', 'The leader already promised 45 minutes at the customer dinner.');
    await page.fill('#promiseMinutesIn', '45');
    await page.selectOption('#promiseBatchSel', 'A');
    await page.click('#btnReportPromise');
    await page.waitForTimeout(320);
    rec.check('6. Reporting an existing off-record 45-minute promise takes the batch to minus 15',
      await A.remaining(page) === -15, await A.capacityText(page));
    const deficit = await page.textContent('#deficitRegion');
    rec.check('6b. The deficit is shown, with what it blocks and what still works',
      /Batch A is 15 minutes over capacity/.test(deficit) && /no new approval and no increase/.test(deficit) &&
      /Still available/.test(deficit),
      (deficit.match(/Batch A is [^.]*\./) || ['none'])[0]);

    /* Re-submitting the same submission. There is no control that offers this,
       so the engine function is called directly with the stored submission id. */
    const again = await page.evaluate(() => {
      const run = App.state.runs[App.state.activeRunId];
      const submissionId = run.offRecordPromises[0].submissionId;
      const res = reportPromise(App.state, App.state.activeRunId, {
        submissionId, promiseId:'verbal-2026-09-05', description:'the very same submission again',
        minutes:45, reportedByRole:'test', linkedRequestId:null, batch:'A' });
      return { idempotent: res.idempotent,
               remaining: computeCapacity(App.state, App.state.activeRunId, 'A').remaining,
               promises: run.offRecordPromises.length };
    });
    rec.check('7. Re-submitting the same submission changes nothing',
      again.idempotent && again.remaining === -15 && again.promises === 1,
      'reported as already recorded; remaining ' + again.remaining + ', ' + again.promises + ' promise stored');

    const stillBlocked = await A.decide(page, 'R003', { state:'provisional_approval', minutes:15, reason:'still blocked?' });
    rec.check('8. Further approvals stay blocked while in deficit',
      /While it is in deficit/.test(stillBlocked.formErrors) && await A.remaining(page) === -15,
      (stillBlocked.formErrors.match(/While it is in deficit[^.]*\./) || ['none'])[0]);

    /* ---- gates ---- */
    await page.check('#act_declined');
    await page.waitForTimeout(140);
    await page.fill('#reasonIn', 'No capacity this cycle and no deadline; written options instead.');
    await A.fillAlternative(page);
    await page.click('#saveDecision');
    await page.waitForTimeout(240);
    rec.check('Actions that reserve nothing still work in deficit',
      /Decision saved/.test(await page.textContent('#alertRegion')), 'a decline was recorded at minus 15');

    await A.selectRequest(page, 'R001');
    await page.check('#act_binding');
    await page.waitForTimeout(160);
    const amendShown = (await page.$('#amendApproverIn')) !== null;
    await page.fill('#minutesIn', '20');
    await page.fill('#reasonIn', 'trying to cut a binding without an amendment');
    await A.fillAlternative(page);
    await page.click('#saveDecision');
    await page.waitForTimeout(220);
    const stillFifty = await page.evaluate(() => App.state.runs[App.state.activeRunId].decisions['R001'].minutes);
    rec.check('An ordinary edit cannot change a binding duration',
      amendShown && /leader-approved amendment/.test(await page.textContent('#decisionBody')) && stillFifty === 50,
      'amendment fields are demanded; still ' + stillFifty + ' minutes reserved');

    await page.fill('#amendApproverIn', 'A. Leader');
    await page.fill('#amendReasonIn', 'Leader agreed to shorten the session to clear the overrun.');
    await A.fillAlternative(page);
    await page.click('#saveDecision');
    await page.waitForTimeout(280);
    rec.check('With a leader-approved amendment the reduction goes through and reconciles the deficit',
      await A.remaining(page) === 15, await A.capacityText(page) + ' (was minus 15, 30 minutes released)');

    /* Linked promise and the amendment bypass, through the engine. */
    const linked = await page.evaluate(() => {
      const before = computeCapacity(App.state, App.state.activeRunId, 'A').reserved;
      const held = currentReservationFor(App.state, App.state.activeRunId, 'R002');
      const res = reportPromise(App.state, App.state.activeRunId, { submissionId:'T-LINK',
        promiseId:'verbal-linked', description:'the same 40 minutes, already promised',
        minutes:40, reportedByRole:'test', linkedRequestId:'R002', batch:'A' });
      return { ok:res.ok, before, held, after: computeCapacity(App.state, App.state.activeRunId, 'A').reserved,
               state: App.state.runs[App.state.activeRunId].decisions['R002'].state,
               origin: App.state.runs[App.state.activeRunId].decisions['R002'].origin };
    });
    rec.check('A promise linked to an existing reservation converts it, never reserving twice',
      linked.ok && linked.after === linked.before && linked.state === 'binding',
      'held ' + linked.held + '; reserved ' + linked.before + ' before and ' + linked.after + ' after; R002 is now ' + linked.state + ' via ' + linked.origin);

    const bypass = await page.evaluate(() => {
      const res = reportPromise(App.state, App.state.activeRunId, { submissionId:'T-BYPASS',
        promiseId:'verbal-bypass', description:'try to change a binding through a report',
        minutes:90, reportedByRole:'test', linkedRequestId:'R002', batch:'A' });
      return { ok:res.ok, msg:res.errors.map(e => e.message).join(' '),
               reserved: computeCapacity(App.state, App.state.activeRunId, 'A').reserved };
    });
    rec.check('Reporting a promise cannot be used to get around the amendment gate',
      !bypass.ok && /leader-approved amendment/.test(bypass.msg), bypass.msg.slice(0, 120));

    const relLinked = await page.evaluate(() =>
      releasePromise(App.state, App.state.activeRunId, 'verbal-linked', 'no longer needed', 'T-REL'));
    rec.check('Releasing a linked promise points at the amendment instead of doing it quietly',
      !relLinked.ok && /binding commitment/.test(relLinked.errors[0].message), relLinked.errors[0].message.slice(0, 120));

    /* Delegation and its acknowledgement. */
    const direct = await page.evaluate(() =>
      validateDecision(App.state, App.state.activeRunId, { requestId:'R004', state:'delegation_confirmed', reason:'skip ahead' }));
    rec.check('A delegation cannot be confirmed without first being pending',
      direct.length > 0 && /only be confirmed from "Delegation pending"/.test(direct[0].message), direct[0].message.slice(0, 120));

    await A.decide(page, 'R004', { state:'delegation_pending', reason:'Routing this to the events lead; no leader time needed.',
      owner:'J. Steele', reviewDate:'2026-09-30' });
    const capBefore = await A.remaining(page);
    await page.check('#act_delegation_confirmed');
    await page.waitForTimeout(160);
    await page.fill('#reasonIn', 'Events lead has taken it on.');
    await A.fillAlternative(page);
    await page.click('#saveDecision');
    await page.waitForTimeout(220);
    rec.check('Confirming a delegation needs an explicit acknowledgement',
      /has actually acknowledged/.test(await page.textContent('#decisionBody')), 'refused until the box is ticked');
    await page.fill('#ackByIn', 'J. Steele');
    await page.check('#ackConfirmIn');
    await A.fillAlternative(page);
    await page.click('#saveDecision');
    await page.waitForTimeout(260);
    rec.check('Delegation states reserve no minutes',
      await A.remaining(page) === capBefore, 'remaining unchanged at ' + await A.remaining(page));

    /* Priority versions. */
    const before = await page.evaluate(() => ({ v: getCurrentPriorityVersion(App.state).version, n: getAllPriorityVersions(App.state).length }));
    await A.openPanel(page, 'secPolicy');
    await page.click('#openPolicy');
    await page.waitForTimeout(160);
    await page.fill('#policyVersionIn', 'v4');
    await page.fill('#policyDateIn', '2026-09-07');
    await page.fill('#policySummaryIn', 'Investor reporting drops below hiring for the rest of the quarter.');
    await page.click('#btnPolicySave');
    await page.waitForTimeout(280);
    const after = await page.evaluate(() => ({
      v: getCurrentPriorityVersion(App.state).version, n: getAllPriorityVersions(App.state).length,
      old: App.state.runs[App.state.activeRunId].decisions['R001'].priorityVersion,
      snap: getSources(App.state).priority_versions.length }));
    rec.check('Only an explicit policy change creates a priority version',
      before.n === 3 && after.n === 4 && after.v === 'v4',
      before.n + ' versions before (current ' + before.v + '), ' + after.n + ' after (current ' + after.v + '); the amendment and the exception created none');
    rec.check('A policy change does not rewrite the inputs behind past decisions',
      after.old === 'v3' && after.snap === 3,
      'the earlier decision still records ' + after.old + ' and the source snapshot still holds ' + after.snap + ' versions');

    await page.reload();
    await page.waitForTimeout(420);
    const survived = await page.evaluate(() => {
      const run = App.state.runs[App.state.activeRunId];
      return { promises: run.offRecordPromises.length, decisions: Object.keys(run.decisions).length,
               version: getCurrentPriorityVersion(App.state).version,
               remaining: computeCapacity(App.state, App.state.activeRunId, 'A').remaining };
    });
    rec.check('All of it survives an actual reload',
      survived.promises === 2 && survived.decisions === 4 && survived.version === 'v4',
      survived.decisions + ' decisions, ' + survived.promises + ' promises, priority ' + survived.version + ', remaining ' + survived.remaining);
    /* ---- the ledger audit ----
       Every round of bug-hunting has found faults of one shape: minutes
       quietly stopped being accounted for and nothing said so. The audit
       asserts the structural properties that make that impossible. A check
       that it stays quiet proves nothing on its own, so each property is also
       broken on purpose here and the audit has to catch it. The state is a
       fully exercised ledger by this point: four decisions and two promises. */
    const audit = await page.evaluate(() => {
      const snapshot = JSON.stringify(App.state);
      const run = App.state.runs[App.state.activeRunId];
      const out = { clean: auditLedger().slice() };

      const reservingId = Object.keys(run.decisions).find(id => stateReserves(run.decisions[id].state));
      out.reservingId = reservingId || null;

      if (reservingId){
        const d = run.decisions[reservingId];
        const keptBatch = d.batch;
        delete d.batch;
        out.noBatch = auditLedger().slice();
        d.batch = keptBatch;

        const keptMinutes = d.minutes;
        d.minutes = 16.5;
        out.badMinutes = auditLedger().slice();
        d.minutes = keptMinutes;

        const keptState = d.state;
        d.state = 'approved_probably';
        out.unknownState = auditLedger().slice();
        d.state = keptState;
      }

      const linked = run.offRecordPromises.filter(p => p.active && p.linkedRequestId)[0];
      out.hadLinkedPromise = !!linked;
      if (linked && run.decisions[linked.linkedRequestId]){
        const target = run.decisions[linked.linkedRequestId];
        const keptState = target.state;
        target.state = 'deferred';
        out.brokenLink = auditLedger().slice();
        target.state = keptState;
      }

      App.state = JSON.parse(snapshot);
      out.restored = auditLedger().slice();
      render();
      return out;
    });

    rec.check('The ledger audit stays silent on a ledger that is behaving',
      audit.clean.length === 0 && audit.restored.length === 0,
      'nothing reported across four decisions and two promises, before or after the deliberate breakages' +
      (audit.clean.length ? ' — but it said: ' + audit.clean.join(' | ') : ''));

    rec.check('The ledger audit catches a reservation an import could release silently',
      !!audit.noBatch && audit.noBatch.some(f => /records no batch of its own/.test(f)),
      (audit.noBatch || []).join(' | ') || 'nothing reported');

    rec.check('The ledger audit catches a duration that is not whole minutes',
      !!audit.badMinutes && audit.badMinutes.some(f => /not a whole number of minutes/.test(f)),
      (audit.badMinutes || []).join(' | ') || 'nothing reported');

    rec.check('The ledger audit catches a state that is not one of the agreed states',
      !!audit.unknownState && audit.unknownState.some(f => /is not one of the agreed states/.test(f)),
      (audit.unknownState || []).join(' | ') || 'nothing reported');

    if (audit.hadLinkedPromise){
      rec.check('The ledger audit catches a linked promise whose minutes are reserved nowhere',
        !!audit.brokenLink && audit.brokenLink.some(f => /reserved nowhere/.test(f)),
        (audit.brokenLink || []).join(' | ') || 'nothing reported');
    } else {
      rec.note('The ledger audit catches a linked promise whose minutes are reserved nowhere',
        'NOT IMPLEMENTED', 'this scenario ends with no active linked promise to break');
    }

    rec.check('No uncaught errors', page.errors.length === 0, page.errors.join(' | ') || 'none');
  }
);

if (require.main === module) H.cli(module.exports);
