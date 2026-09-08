'use strict';
const H = require('../lib/harness');
const A = require('../lib/app');

module.exports = H.defineSuite(
  'Evidence, identity and the decision record',
  'Namesakes, unverified links, requester assertions, coverage gaps, hidden history, overdue work, and what is kept behind a decision.',
  async ({ context, rec }) => {
    const page = await A.openApp(context);

    /* ---- namesakes ---- */
    await A.selectRequest(page, 'R002');
    let ev = await page.textContent('#evidenceBody');
    rec.check('Personal history stays hidden until an identity is established',
      /Records hidden — identity unconfirmed/.test(ev) && /Prior decisions hidden — identity unconfirmed\./.test(ev),
      'both records and prior decisions withheld');
    const groups = await page.$$eval('#identitySel optgroup', gs => gs.map(g => ({ label:g.label, n:g.children.length })));
    const startValue = await page.$eval('#identitySel', e => e.value);
    rec.check('Candidates are offered as suggestions only, with nothing preselected',
      groups[0].n >= 2 && startValue === '',
      groups.map(g => g.label + ' = ' + g.n).join('; ') + '; selection starts empty');
    rec.check('Each suggestion states the basis of its match',
      /matched on exact full-name match/.test(ev) && /matched on same email domain/.test(ev),
      'name and domain matches are labelled as such');

    await page.selectOption('#identitySel', 'C001');
    await page.fill('#identityBasisIn', '   ');
    await page.click('#btnConfirmIdentity');
    await page.waitForTimeout(240);
    rec.check('Identity cannot be confirmed without a recorded basis',
      /Record the basis for this/.test(await page.textContent('#evidenceBody')), 'refused');

    await A.confirmIdentityInUi(page, 'R002', 'C001',
      'Phoned the Meridian switchboard; the rollout owner confirmed he is travelling and using a personal address this week.');
    ev = await page.textContent('#evidenceBody');
    const ownRecords = /Sam Rivera of Meridian Freight, Operations Director, walked through/.test(ev);
    const otherRecords = /Brightpath Logistics sent a partnership pitch deck/.test(ev);
    const ownPrior = /Operations escalation on the Meridian rollout/.test(ev);
    const otherPrior = /Early-stage partnership pitch/.test(ev);
    rec.check('A confirmed namesake never acquires the other person’s records',
      ownRecords && !otherRecords, 'the Meridian notes are shown; the Brightpath notes are absent');
    rec.check('A confirmed namesake never acquires the other person’s prior decisions',
      ownPrior && !otherPrior, 'D001 is shown; D002 is absent');
    rec.check('The basis and who recorded it are kept',
      /Basis recorded by Executive assistant: Phoned the Meridian switchboard/.test(ev), 'shown on the identity card');
    rec.check('Confirming who someone is does not verify what they claim',
      /does not verify anything they claim/.test(ev), 'stated on screen');

    /* ---- domain-only link ---- */
    await A.switchRun(page, 'RUN-4');
    await A.selectRequest(page, 'R006');
    ev = await page.textContent('#evidenceBody');
    const noSuggestions = (await page.$$eval('#identitySel optgroup', gs => gs.filter(g => /Suggested/.test(g.label)).length)) === 0;
    rec.check('A domain-only link stays unverified and offers no contact',
      /email domain resembles the account name "Orenda Systems"/.test(ev) &&
      /That is a text resemblance only/.test(ev) && noSuggestions,
      'shown as a text resemblance, with no suggested contact at all');
    await A.confirmIdentityInUi(page, 'R006', '__unresolved__',
      'No contact record exists for this domain and nobody could vouch for the sender.');
    ev = await page.textContent('#evidenceBody');
    rec.check('An identity can be recorded as unresolvable, and history stays hidden',
      /Recorded as unresolvable on/.test(ev) && /Prior decisions hidden — identity unconfirmed\./.test(ev),
      'recorded explicitly, still withheld');

    /* ---- requester assertions and gaps ---- */
    await A.selectRequest(page, 'R009');
    ev = await page.textContent('#evidenceBody');
    const claim = 'The leader agreed last quarter to a monthly 20-minute support check-in';
    rec.check('An unsupported assertion stays under "Requester says" and never moves into the records',
      ev.indexOf(claim) > ev.indexOf('Requester says') && ev.indexOf(claim) < ev.indexOf('Documented in records'),
      'the claim sits in the requester’s own words, before the records section');
    rec.check('The source that would have supported it is shown as absent',
      /S025 — a meeting_note source was expected but does not exist/.test(ev), 'shown as a gap');
    rec.check('A tagged conflict is surfaced without being resolved',
      /conflict CG2/.test(ev) && /The later record is not automatically the correct one/.test(ev), 'both notes tagged');
    rec.check('Sources retrieved are separated from facts understood',
      /sources were looked for/.test(ev) && /not the same as what you have read and understood/.test(ev),
      (ev.match(/\d+ sources were looked for[^.]*\./) || ['none'])[0]);
    rec.check('The inventory is described as possibly incomplete itself',
      /inventory lists the sources someone thought to look for/i.test(ev), 'warned');

    /* ---- a reviewer records their own unknown ---- */
    await page.check('#flag_unknown');
    await page.fill('#flagTextIn', 'The records do not say whether this escalation is above the threshold that needs the leader.');
    await page.click('#btnAddFlag');
    await page.waitForTimeout(260);
    ev = await page.textContent('#evidenceBody');
    rec.check('A reviewer can record an unknown the source data does not tag',
      /unknown recorded by reviewer/.test(ev) && /above the threshold that needs the leader/.test(ev), 'recorded alongside the records');

    /* ---- the decision form ---- */
    await page.check('#act_deferred');
    await page.waitForTimeout(200);
    let form = await page.textContent('#decisionBody');
    rec.check('The three reason prompts are always shown',
      /Why the leader, rather than someone else\?/.test(form) && /Why now, rather than later\?/.test(form) &&
      /What does this displace\?/.test(form), 'all three');
    const chips = await page.$$eval('#reasonChips button', n => n.map(b => b.textContent));
    rec.check('Optional openers are generic and carry no evidence',
      chips.length === 7 && chips.every(c => /…$/.test(c)), chips.length + ' openers, for example: ' + chips.slice(0, 2).join(' / '));
    await page.click('#reasonChips button:has-text("This displaces…")');
    const afterChip = await page.inputValue('#reasonIn');
    const stillDeferred = await page.$$eval('#decisionBody input[name=act]:checked', n => n.map(x => x.value));
    rec.check('Clicking an opener inserts editable text and chooses no action',
      afterChip === 'This displaces ' && stillDeferred[0] === 'deferred',
      'reason box now reads "' + afterChip + '", action still ' + stillDeferred[0]);
    const fields = await page.evaluate(() => ({
      owner: !!document.getElementById('ownerIn'),
      amendment: !!document.getElementById('amendApproverIn'),
      acknowledgement: !!document.getElementById('ackByIn')
    }));
    rec.check('Only the conditional fields this action needs are shown',
      fields.owner && !fields.amendment && !fields.acknowledgement,
      'owner ' + fields.owner + ', amendment ' + fields.amendment + ', acknowledgement ' + fields.acknowledgement);

    await page.check('#needsClarificationIn');
    await page.waitForTimeout(160);
    await page.fill('#reasonIn', 'Deferring until the escalation threshold is confirmed; it displaces nothing because it reserves no time.');
    await page.fill('#ownerIn', 'R. Chandran');
    await page.fill('#reviewDateIn', '2026-09-01');
    await A.fillAlternative(page);
    await page.click('#saveDecision');
    await page.waitForTimeout(220);
    rec.check('A clarification that has been asked for must actually be written',
      /Write the clarification question you need answered/.test(await page.textContent('#decisionBody')), 'required once ticked');

    /* A question needs somebody to answer it and a date to answer it by. */
    const askedOf = await page.inputValue('#clarificationOwnerIn');
    rec.check('A clarification is offered to the relationship owner the records name',
      askedOf === 'The leader',
      'the records give this contact\'s relationship owner as "' + askedOf + '", offered by default and still editable');
    await page.fill('#clarificationIn', 'Does this escalation cross the threshold that requires the leader?');
    await page.fill('#clarificationOwnerIn', '   ');
    await A.fillAlternative(page);
    await page.click('#saveDecision');
    await page.waitForTimeout(240);
    rec.check('A question with nobody attached to it is refused',
      /Record who is being asked/.test(await page.textContent('#decisionBody')), 'refused');
    await page.fill('#clarificationOwnerIn', 'The leader');
    await page.click('#saveDecision');
    await page.waitForTimeout(240);
    rec.check('A question with no date to answer it by is refused',
      /Record the date you need the answer by/.test(await page.textContent('#decisionBody')), 'refused');
    await page.fill('#clarificationDueIn', '2026-09-01');
    await A.fillAlternative(page);
    await page.click('#saveDecision');
    await page.waitForTimeout(320);

    /* ---- overdue work ---- */
    const unresolved = await page.textContent('#unresolvedBody');
    const summary = await page.textContent('#secUnresolved > summary');
    rec.check('An overdue deferral stays visible and is marked overdue',
      /OVERDUE by \d+ day/.test(unresolved) && /overdue/.test(summary),
      summary.trim() + ' — ' + (unresolved.match(/OVERDUE by \d+ days?/) || ['none'])[0]);
    rec.check('The request card also carries the overdue flag',
      /OVERDUE since 2026-09-01/.test(await page.textContent('#requestList')), 'badge on the card');
    rec.check('Overdue work is not closed automatically',
      /do not resolve themselves and they are not closed automatically/.test(unresolved), 'stated');
    rec.check('A question that has been asked and not answered is unresolved work in its own right',
      /Awaiting an answer|Does this escalation cross the threshold/.test(unresolved) &&
      /The leader/.test(unresolved),
      'the open question appears on the unresolved list with who was asked and by when');

    /* ---- reserving time means naming what it displaces ---- */
    await A.switchRun(page, 'RUN-1');
    await A.selectRequest(page, 'R001');
    await page.check('#act_provisional_approval');
    await page.waitForTimeout(160);
    await page.fill('#minutesIn', '45');
    await page.fill('#reasonIn', 'A reason with no comparison against another use of the time.');
    await page.fill('#alternativeIn', '   ');
    await page.click('#saveDecision');
    await page.waitForTimeout(240);
    rec.check('Reserving time is refused until what it displaces is named',
      /Record what this displaces/.test(await page.textContent('#decisionBody')) && await A.remaining(page) === 120,
      'refused, and nothing was reserved');
    await page.fill('#alternativeIn', 'The partner conversation, which has no deadline attached to it.');
    await page.click('#saveDecision');
    await page.waitForTimeout(300);
    const displaced = await page.evaluate(() => App.state.runs['RUN-1'].decisions['R001'].alternative);
    rec.check('What the time displaced is kept beside the reason, not inside it',
      displaced === 'The partner conversation, which has no deadline attached to it.' && await A.remaining(page) === 75,
      'recorded as its own field: "' + displaced + '"');
    await A.switchRun(page, 'RUN-4');

    /* ---- what is kept behind a decision ---- */
    await A.openPanel(page, 'secHistory');
    let hist = await page.textContent('#historyBody');
    rec.check('A decision keeps its priority version, actor, timestamp and input snapshot',
      /priority v3/.test(hist) && /inputs SNAP-EMBEDDED-1/.test(hist) && /by Executive assistant/.test(hist),
      'all four are recorded and shown');
    rec.check('The exact request wording and source excerpts behind a decision can be re-read',
      /The exact inputs behind this decision/.test(hist) && /Request as it read at the time/.test(hist), 'available per decision');

    await page.click('#btnOutcome_R009');
    await page.waitForTimeout(220);
    await page.fill('#outcomeText_R009', 'The escalation was resolved by the operations lead without the leader.');
    await page.click('#btnOutcomeSave_R009');
    await page.waitForTimeout(220);
    rec.check('An outcome must say whether it was knowable at the time',
      /whether this was knowable at the time or is newly learned/.test(await page.textContent('#historyBody')), 'required');
    await page.check('#orig_R009_false');
    await page.click('#btnOutcomeSave_R009');
    await page.waitForTimeout(280);
    hist = await page.textContent('#historyBody');
    rec.check('A later outcome is recorded and marked as newly learned',
      /newly learned/.test(hist) && /resolved by the operations lead without the leader/.test(hist), 'recorded');
    const unchanged = await page.evaluate(() => {
      const run = App.state.runs[App.state.activeRunId];
      return { state: run.decisions['R009'].state, snap: run.decisions['R009'].snapshotId, outcomes: run.outcomes.length };
    });
    rec.check('Recording an outcome changes neither the decision nor its inputs',
      unchanged.state === 'deferred' && unchanged.snap === 'SNAP-EMBEDDED-1' && unchanged.outcomes === 1,
      'still ' + unchanged.state + ', inputs ' + unchanged.snap + ', ' + unchanged.outcomes + ' outcome recorded');

    /* ---- no ranking anywhere the operator can see ---- */
    await A.openAllPanels(page);
    const rankScan = await page.evaluate(() => {
      const t = document.body.innerText;
      const re = /\b(rank(s|ed|ing)?|scor(e|es|ed|ing)|rating|most valuable|least valuable)\b/gi;
      let m; const out = [];
      while ((m = re.exec(t)) !== null) out.push(t.slice(Math.max(0, m.index - 70), m.index + m[0].length + 30).replace(/\s+/g, ' '));
      return out;
    });
    const allProhibitions = rankScan.every(x =>
      /never ranks|never ordered|not (a )?(rank|score)|no score|do not rank|do not score|reads like a recommendation/i.test(x));
    rec.check('There is no scoring or ranking feature; the words appear only in prohibitions',
      allProhibitions, rankScan.length + ' visible occurrences, all disclaimers');
    rec.check('The request list is ordered by arrival, and says so',
      /in arrival order\. The list is never ordered by importance\./.test(await page.textContent('#reqIntro')), 'stated');

    /* ---- survives a reload, isolated per run ---- */
    await page.reload();
    await page.waitForTimeout(420);
    const after = await page.evaluate(() => ({
      run1Identity: Object.keys(App.state.runs['RUN-1'].identityResolutions).length,
      run4Identity: Object.keys(App.state.runs['RUN-4'].identityResolutions).length,
      run4Flags: Object.keys(App.state.runs['RUN-4'].reviewerFlags).length,
      run4Outcomes: App.state.runs['RUN-4'].outcomes.length,
      run1Outcomes: App.state.runs['RUN-1'].outcomes.length,
      unresolved: getUnresolvedWork(App.state, 'RUN-4').length
    }));
    rec.check('Identity decisions, recorded unknowns and outcomes survive a reload, each in their own run',
      after.run1Identity === 1 && after.run4Identity === 1 && after.run4Flags === 1 &&
      after.run4Outcomes === 1 && after.run1Outcomes === 0 && after.unresolved === 1,
      'RUN-1 holds 1 identity record and 0 outcomes; RUN-4 holds 1 identity record, 1 flagged request, 1 outcome and 1 unresolved item');
    rec.check('No uncaught errors', page.errors.length === 0, page.errors.join(' | ') || 'none');
  }
);

if (require.main === module) H.cli(module.exports);
