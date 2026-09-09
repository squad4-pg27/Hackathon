'use strict';
const H = require('../lib/harness');
const A = require('../lib/app');

/* Deliberate abuse. Everything here was written after probing for ways to
   break the application; four of these checks exist because they found real
   faults, which are named in dev/README.md. */

module.exports = H.defineSuite(
  'Stress and abuse',
  'Malformed files, misleading numbers, two windows at once, an exhausted storage quota, a random walk through every transition, hand-edited backups, and hostile or enormous text.',
  async ({ context, rec }) => {
    const page = await A.openApp(context);

    /* ---- 1. CSV shapes ---- */
    const shapes = await page.evaluate(() => {
      const HEAD = 'note_id,contact_id,date,source_type,excerpt,conflict_group';
      const cases = {
        'a byte order mark':            '﻿' + HEAD + '\nN1,C1,2026-01-01,email,hello,',
        'line feeds only':              HEAD + '\nN1,C1,2026-01-01,email,hello,',
        'no trailing newline':          HEAD + '\r\nN1,C1,2026-01-01,email,hello,',
        'a header and nothing else':    HEAD + '\r\n',
        'an empty file':                '',
        'a quoted value holding commas and newlines': HEAD + '\r\nN1,C1,2026-01-01,email,"a,b\nc,d",',
        'a value of nothing but quotes': HEAD + '\r\nN1,C1,2026-01-01,email,"""""",',
        'a quote that is never closed': HEAD + '\r\nN1,C1,2026-01-01,email,"never closed,',
        'a row with too few values':    HEAD + '\r\nN1,C1,2026-01-01\r\n',
        'CRLF inside a quoted value':   HEAD + '\r\nN1,C1,2026-01-01,email,"one\r\ntwo",\r\n'
      };
      const out = {};
      for (const [k, v] of Object.entries(cases)){
        try { const r = csvToObjects(v);
          out[k] = { ok:true, rows:r.rows.length, excerpt:r.rows[0] ? r.rows[0].excerpt : null };
        } catch (e){ out[k] = { ok:false, message:e.message }; }
      }
      return out;
    });
    rec.check('An empty file and an unclosed quote are refused with a plain explanation',
      !shapes['an empty file'].ok && !shapes['a quote that is never closed'].ok,
      '"' + shapes['an empty file'].message + '" and "' + shapes['a quote that is never closed'].message + '"');
    rec.check('A byte order mark, line feeds only, and a missing final newline all parse',
      shapes['a byte order mark'].rows === 1 && shapes['line feeds only'].rows === 1 &&
      shapes['no trailing newline'].rows === 1, 'each parsed to exactly one row');
    rec.check('A header with no rows parses to nothing rather than to a phantom row',
      shapes['a header and nothing else'].ok && shapes['a header and nothing else'].rows === 0, '0 rows');
    rec.check('Commas, newlines and doubled quotes inside a value survive',
      shapes['a quoted value holding commas and newlines'].excerpt === 'a,b\nc,d' &&
      shapes['a value of nothing but quotes'].excerpt === '""',
      'the embedded comma, newline and doubled quotes are all preserved');
    rec.check('A line break inside a quoted value leaves no stray carriage return',
      shapes['CRLF inside a quoted value'].excerpt === 'one\ntwo',
      'reads as ' + JSON.stringify(shapes['CRLF inside a quoted value'].excerpt) +
      '. A spreadsheet saving CRLF used to leave a carriage return sitting inside the evidence text');

    /* ---- 2. durations JavaScript would quietly reinterpret ---- */
    const minutes = await page.evaluate(() =>
      ['45', ' 45 ', '045', '0x10', '1e2', '45.0', '+45', '', '45abc', 'Infinity', '-45', '0', '999']
        .map(v => {
          const errs = validateDecision(App.state, 'RUN-1',
            { requestId:'R001', state:'provisional_approval', minutes:v, reason:'stress',
              alternative:'nothing else was competing for this slot in the test' });
          return { v, accepted: errs.length === 0,
                   planned: plannedReservation(App.state, 'RUN-1', { requestId:'R001', state:'provisional_approval', minutes:v }) };
        }));
    const accepted = minutes.filter(m => m.accepted).map(m => m.v);
    const hex = minutes.find(m => m.v === '0x10'), exp = minutes.find(m => m.v === '1e2');
    rec.check('A duration is read as plain digits only',
      !hex.accepted && !exp.accepted && accepted.join(',') === '45, 45 ,045',
      'accepted: ' + JSON.stringify(accepted) + '. "0x10" and "1e2" are refused, where they would otherwise have quietly reserved 16 and 100 minutes');
    rec.check('Nothing that is refused can still reserve minutes',
      minutes.filter(m => !m.accepted).every(m => m.planned === 0),
      'every refused form plans a reservation of 0');

    /* ---- 3. markup vectors beyond a script tag ---- */
    const vectors = await page.evaluate(() => {
      const list = ['<img src=x onerror=alert(1)>', '<svg onload=alert(1)>', 'javascript:alert(1)',
                    '"><b>bold</b>', '<iframe src=javascript:alert(1)>', '&lt;script&gt;alert(1)&lt;/script&gt;',
                    '<style>body{display:none}</style>', '<a href="javascript:alert(1)">x</a>'];
      const host = document.createElement('div');
      list.forEach(v => host.appendChild(el('div', 'rtext', v)));
      document.body.appendChild(host);
      const created = host.querySelectorAll('img,svg,iframe,b,script,style,a').length;
      const shown = list.every(v => host.textContent.includes(v));
      const stillVisible = getComputedStyle(document.body).display !== 'none';
      host.remove();
      return { created, shown, stillVisible, n:list.length };
    });
    rec.check('Every markup vector renders as text and creates no elements',
      vectors.created === 0 && vectors.shown && vectors.stillVisible,
      vectors.n + ' vectors rendered verbatim, ' + vectors.created + ' elements created, the page still displays');
    rec.check('No dialog was raised by any of it', page.dialogs.length === 0, page.dialogs.join(' | ') || 'none');

    /* ---- 4. two windows on the same file ---- */
    const w1 = await A.openApp(context);
    const w2 = await A.openApp(context);
    await w1.evaluate(() => { applyDecision(App.state, 'RUN-1',
      { requestId:'R001', submissionId:'W1', state:'provisional_approval', minutes:50, reason:'from window one', actorRole:'w1', alternative:'nothing else was competing for this slot in the test' });
      return persist(); });
    await w1.waitForTimeout(150);
    const second = await w2.evaluate(() => { applyDecision(App.state, 'RUN-1',
      { requestId:'R002', submissionId:'W2', state:'provisional_approval', minutes:30, reason:'from window two', actorRole:'w2', alternative:'nothing else was competing for this slot in the test' });
      return { saved: persist(), state: App.saveState, message: App.saveMessage }; });
    await w2.waitForTimeout(200);
    const stored = await w2.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('timeLedger.v1.state')).runs['RUN-1'].decisions));
    rec.check('A second window will not quietly save over the first window’s work',
      second.saved === false && second.state === 'conflict' && stored.includes('R001'),
      'the second window was told: "' + second.message.slice(0, 100) + '". Storage still holds ' + stored.join(', '));
    const choices = await w2.$$eval('#alertRegion button', n => n.map(b => b.textContent));
    rec.check('The window that could not save is offered a way out, not just a warning',
      choices.some(c => /replace the other/.test(c)) && choices.some(c => /load the saved work/.test(c)) &&
      choices.some(c => /Download backup/.test(c)),
      choices.join(' | '));
    await w2.click('#btnResolveKeepMine');
    await w2.waitForTimeout(250);
    const storedAfter = await w2.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('timeLedger.v1.state')).runs['RUN-1'].decisions));
    rec.check('Replacing the other window’s work is possible, but only by choosing it',
      storedAfter.includes('R002') && !storedAfter.includes('R001'),
      'after the deliberate choice, storage holds ' + storedAfter.join(', '));

    /* ---- 5. storage quota exhausted ---- */
    const quota = await page.evaluate(() => {
      applyDecision(App.state, 'RUN-1', { requestId:'R001', submissionId:'Q1', state:'provisional_approval', minutes:45, reason:'work that must survive', actorRole:'q', alternative:'nothing else was competing for this slot in the test' });
      persist(true);
      const good = localStorage.getItem('timeLedger.v1.state');
      let filled = 0;
      try { const chunk = 'x'.repeat(100000); for (let i = 0; i < 200; i++){ localStorage.setItem('stressfill' + i, chunk); filled++; } } catch (e){}
      for (let i = 0; i < 400; i++) App.state.runs['RUN-1'].outcomes.push(
        { outcomeId:'O' + i, submissionId:'o' + i, decisionId:'d', requestId:'R001', text:'y'.repeat(2000), availableOriginally:true, at:new Date().toISOString(), actorRole:'q' });
      const ok = persist(true);
      const after = localStorage.getItem('timeLedger.v1.state');
      const res = { filled, ok, state: App.saveState, message: App.saveMessage,
                    previousIntact: after === good,
                    banner: document.querySelector('#alertRegion .banner.stop') !== null,
                    inMemory: App.state.runs['RUN-1'].outcomes.length };
      for (let i = 0; i < filled; i++) localStorage.removeItem('stressfill' + i);
      return res;
    });
    rec.check('A save that cannot fit is reported as a failure, not as a success',
      quota.ok === false && quota.state === 'unsaved',
      'after filling storage with ' + quota.filled + ' unrelated keys: "' + quota.message.slice(0, 90) + '"');
    rec.check('The last good saved record survives a failed save',
      quota.previousIntact, 'the previously saved record is byte for byte unchanged');
    rec.check('Unsaved work is kept on the page and the warning is shown',
      quota.banner && quota.inMemory === 400, quota.inMemory + ' unsaved entries still held, warning banner visible');

    /* ---- 6. a random walk through every transition ---- */
    const walk = await page.evaluate(() => {
      const st = createInitialState(), runId = 'RUN-1';
      const reqs = getVisibleRequests(st, runId, 'A').map(r => r.request_id);
      const states = ['needs_review','provisional_approval','binding','declined','deferred','delegation_pending','delegation_confirmed'];
      let seed = 20260907;
      const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
      const problems = []; let applied = 0, refused = 0;
      for (let i = 0; i < 500; i++){
        const res = applyDecision(st, runId, {
          requestId: reqs[rnd(reqs.length)], submissionId:'SW' + i, state: states[rnd(states.length)],
          minutes: String(1 + rnd(130)), reason:'walk ' + i, owner:'O', reviewDate:'2026-10-01',
          ackBy:'A', ackConfirmed:true, amendApprover:'L', amendApproverRole:'Leader',
          amendReason:'walk amendment', actorRole:'walk' });
        res.ok ? applied++ : refused++;
        if (i % 40 === 0){
          reportPromise(st, runId, { submissionId:'SP' + i, promiseId:'p' + i, description:'d',
            minutes: String(5 + rnd(60)), reportedByRole:'walk',
            linkedRequestId: rnd(2) ? reqs[rnd(reqs.length)] : null, batch:'A' });
        }
        /* Recompute what should be reserved straight from the decisions.
           This is a deliberate second opinion, not the rule under test. */
        let expected = 0;
        for (const k in st.runs[runId].decisions){
          const d = st.runs[runId].decisions[k];
          if (d.state === 'provisional_approval' || d.state === 'binding') expected += d.minutes;
          if (!STATES[d.state].reserves && d.minutes !== 0) problems.push('step ' + i + ': ' + k + ' is ' + d.state + ' yet holds ' + d.minutes);
          if (d.minutes < 0) problems.push('step ' + i + ': ' + k + ' holds negative minutes');
          if (!getRequestById(st, d.requestId)) problems.push('step ' + i + ': decision for a request that does not exist');
        }
        for (const pr of st.runs[runId].offRecordPromises)
          if (pr.active && !pr.linkedRequestId && pr.batch === 'A') expected += pr.minutes;
        const actual = computeCapacity(st, runId, 'A').reserved;
        if (expected !== actual) problems.push('step ' + i + ': capacity says ' + actual + ' but the decisions add up to ' + expected);
        if (actual < 0) problems.push('step ' + i + ': reserved minutes went negative');
      }
      return { applied, refused, problems: problems.slice(0, 5), total: problems.length,
               history: st.runs[runId].history.length, promises: st.runs[runId].offRecordPromises.length };
    });
    rec.check('500 random transitions leave no impossible state behind',
      walk.total === 0,
      walk.applied + ' transitions applied and ' + walk.refused + ' refused by the gates, with ' +
      walk.promises + ' promises reported; reserved minutes matched the decisions at every one of the 500 steps' +
      (walk.total ? '. Violations: ' + walk.problems.join('; ') : ''));
    rec.check('Every applied transition and every reported promise left a history entry',
      walk.history === walk.applied + walk.promises,
      walk.history + ' history entries for ' + walk.applied + ' applied transitions plus ' +
      walk.promises + ' reported promises (' + (walk.applied + walk.promises) + ' expected)');

    /* ---- 7. the overdue boundary ---- */
    const overdue = await page.evaluate(() => {
      const st = createInitialState();
      const today = todayIso();
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      applyDecision(st, 'RUN-1', { requestId:'R001', submissionId:'V1', state:'deferred', reason:'x', owner:'O', reviewDate:today, actorRole:'t' });
      applyDecision(st, 'RUN-1', { requestId:'R002', submissionId:'V2', state:'deferred', reason:'x', owner:'O', reviewDate:yesterday, actorRole:'t' });
      applyDecision(st, 'RUN-1', { requestId:'R003', submissionId:'V3', state:'deferred', reason:'x', owner:'O', reviewDate:tomorrow, actorRole:'t' });
      const w = {}; getUnresolvedWork(st, 'RUN-1').forEach(x => { w[x.requestId] = x; });
      return { today: w.R001.overdue, yesterday: w.R002.overdue, tomorrow: w.R003.overdue, days: w.R002.daysOverdue };
    });
    rec.check('Something due today is not yet overdue; yesterday is, by one day',
      overdue.today === false && overdue.yesterday === true && overdue.tomorrow === false && overdue.days === 1,
      'due today: not overdue. Due yesterday: overdue by ' + overdue.days + ' day. Due tomorrow: not overdue');

    /* ---- 8. hand-edited backups ---- */
    const tampered = await page.evaluate(() => {
      const st = createInitialState();
      applyDecision(st, 'RUN-1', { requestId:'R001', submissionId:'T1', state:'provisional_approval', minutes:45, reason:'x', actorRole:'t', alternative:'nothing else was competing for this slot in the test' });
      const good = makeBackup(st);
      const edit = change => { const c = JSON.parse(JSON.stringify(good)); change(c); return validateBackup(c); };
      return {
        negative: edit(c => { c.state.runs['RUN-1'].decisions['R001'].minutes = -999; }),
        absurd:   edit(c => { c.state.runs['RUN-1'].decisions['R001'].minutes = 99999; }),
        mismatch: edit(c => { c.state.runs['RUN-1'].decisions['R001'].state = 'declined'; }),
        unknown:  edit(c => { c.state.runs['RUN-1'].decisions['R001'].state = 'invented_state'; }),
        promise:  edit(c => { c.state.runs['RUN-1'].offRecordPromises = [{ promiseId:'p', minutes:-5, active:true, batch:'A' }]; }),
        untouched: validateBackup(good)
      };
    });
    rec.check('A structurally valid backup carrying an impossible reservation is still refused',
      tampered.negative.length && tampered.absurd.length && tampered.mismatch.length &&
      tampered.unknown.length && tampered.promise.length && tampered.untouched.length === 0,
      'refused: "' + tampered.negative[0] + '" and "' + tampered.mismatch[0] + '". An untouched backup is still accepted');

    const pollution = await page.evaluate(() => {
      const raw = '{"format":"time-ledger-backup","schemaVersion":1,"state":{"__proto__":{"polluted":true},' +
        '"app":"time-ledger","schemaVersion":1,"activeSnapshotId":"S","sourceSnapshots":[{"snapshotId":"S","data":' +
        '{"requests":[],"contacts":[],"accounts":[],"notes":[],"source_inventory":[],"prior_decisions":[],' +
        '"priority_versions":[],"commitments":[]}}],"activeRunId":"RUN-1","runs":{"RUN-1":{"runId":"RUN-1",' +
        '"decisions":{},"history":[],"identityResolutions":{},"briefs":{}}},"history":[]}}';
      validateBackup(JSON.parse(raw));
      return ({}).polluted === true;
    });
    rec.check('A backup cannot reach into the objects the page itself relies on',
      pollution === false, 'a "__proto__" key in the file left Object.prototype untouched');

    /* ---- 9. a promise linked to a request in every state ---- */
    const linked = await page.evaluate(() => {
      const out = {};
      for (const from of ['needs_review','provisional_approval','binding','declined','deferred','delegation_pending']){
        const st = createInitialState();
        if (from !== 'needs_review'){
          applyDecision(st, 'RUN-1', { requestId:'R001', submissionId:'S1',
            state: from === 'binding' ? 'provisional_approval' : from, minutes:40, reason:'setup',
            alternative:'nothing else was competing for this slot in the test', owner:'O', reviewDate:'2026-10-01', actorRole:'t' });
          if (from === 'binding') applyDecision(st, 'RUN-1', { requestId:'R001', submissionId:'S2', state:'binding', reason:'convert', actorRole:'t', alternative:'nothing else was competing for this slot in the test' });
        }
        const before = computeCapacity(st, 'RUN-1', 'A').reserved;
        const res = reportPromise(st, 'RUN-1', { submissionId:'P', promiseId:'p1', description:'d',
          minutes:40, reportedByRole:'t', linkedRequestId:'R001', batch:'A' });
        out[from] = { ok:res.ok, before, after: computeCapacity(st, 'RUN-1', 'A').reserved };
      }
      return out;
    });
    rec.check('A promise linked to an existing reservation never adds a second one',
      linked.provisional_approval.ok && linked.provisional_approval.before === 40 && linked.provisional_approval.after === 40,
      'reserved ' + linked.provisional_approval.before + ' before and ' + linked.provisional_approval.after +
      ' after linking a 40 minute promise to a provisional approval');
    rec.check('A promise linked to a request holding nothing takes on the reservation itself',
      ['needs_review','declined','deferred','delegation_pending'].every(k => linked[k].ok && linked[k].before === 0 && linked[k].after === 40),
      ['needs_review','declined','deferred','delegation_pending']
        .map(function(k){ return k + ' ' + linked[k].before + ' to ' + linked[k].after; }).join(', '));
    rec.check('A promise against an already binding request is refused from every angle',
      linked.binding.ok === false && linked.binding.after === 40,
      'accepted: ' + linked.binding.ok + '; reserved after the attempt: ' + linked.binding.after + ' minutes');

    /* ---- 10. a long session ---- */
    const perf = await page.evaluate(() => {
      const run = App.state.runs['RUN-1'];
      for (let i = 0; i < 60; i++) applyDecision(App.state, 'RUN-1',
        { requestId:'R00' + (1 + (i % 4)), submissionId:'L' + i, state: i % 2 ? 'declined' : 'provisional_approval',
          minutes:'5', reason:'long session step ' + i, actorRole:'t' });
      for (let i = 0; i < 200; i++) run.outcomes.push({ outcomeId:'P' + i, submissionId:'p' + i,
        decisionId: Object.values(run.decisions)[0].decisionId, requestId:'R001', text:'outcome ' + i,
        availableOriginally: i % 2 === 0, at:new Date().toISOString(), actorRole:'t' });
      const t0 = performance.now(); render(); const t1 = performance.now();
      return { renderMs: Math.round(t1 - t0), history: run.history.length,
               outcomes: run.outcomes.length, stateKB: Math.round(JSON.stringify(App.state).length / 1024) };
    });
    rec.check('A long session still redraws quickly',
      perf.renderMs < 750,
      perf.history + ' history entries and ' + perf.outcomes + ' outcomes, a ' + perf.stateKB +
      ' KB record, redrawn in ' + perf.renderMs + ' ms');

    /* ---- 11. brief checking under abuse ---- */
    const briefs = await page.evaluate(() => {
      const pk = buildPacket(App.state, 'RUN-3', 'R001');
      const run = t => { const t0 = performance.now(); const v = validateBrief(pk, t); return { status:v.status, ms: Math.round(performance.now() - t0) }; };
      return {
        huge: run(pk.packetId + '\n' + 'word '.repeat(200000)),
        manyCitations: run(pk.packetId + '\nWHAT THE RECORDS SHOW\n' + '- x [NOTE:N001]\n'.repeat(10000)),
        manyUncited: run(pk.packetId + '\nWHAT THE RECORDS SHOW\n' + '- a claim\n'.repeat(10000)),
        malformed: run(pk.packetId + '\nWHAT THE RECORDS SHOW\n- x [FOO:BAR] [NOTE:] [:N001] [[NOTE:N001]]'),
        empty: run(''), whitespace: run('   ')
      };
    });
    const slowest = Math.max(...Object.values(briefs).map(b => b.ms));
    rec.check('Checking a brief cannot be made slow or made to hang',
      slowest < 2000 && briefs.empty.status === 'rejected' && briefs.whitespace.status === 'rejected' &&
      briefs.malformed.status === 'rejected',
      'a megabyte of text in ' + briefs.huge.ms + ' ms, ten thousand citations in ' + briefs.manyCitations.ms +
      ' ms, ten thousand uncited bullets in ' + briefs.manyUncited.ms + ' ms; empty, whitespace and malformed citations all refused');

    /* ---- 12. extreme text in operator fields ---- */
    const text = await page.evaluate(() => {
      const st = createInitialState();
      const long = 'x'.repeat(100000);
      const awkward = '🧑‍⚖️ مرحبا ‮reversed‬ tab\there';
      const a = applyDecision(st, 'RUN-1', { requestId:'R001', submissionId:'X1', state:'provisional_approval', minutes:'10', reason:long, actorRole:'t', alternative:'nothing else was competing for this slot in the test' });
      const c = applyDecision(st, 'RUN-1', { requestId:'R002', submissionId:'X2', state:'provisional_approval', minutes:'10', reason:awkward, actorRole:'t', alternative:'nothing else was competing for this slot in the test' });
      const host = document.createElement('div');
      const cell = el('div', 'rtext', awkward);
      host.appendChild(cell);
      document.body.appendChild(host);
      /* The cell must hold the text and nothing else: no element children. */
      const rendered = cell.textContent === awkward, kids = cell.querySelectorAll('*').length;
      host.remove();
      return { longOk:a.ok, longLen: st.runs['RUN-1'].decisions['R001'].reason.length,
               awkwardOk:c.ok, roundTrip: st.runs['RUN-1'].decisions['R002'].reason === awkward, rendered, kids };
    });
    rec.check('A very long reason is accepted and kept whole',
      text.longOk && text.longLen === 100000,
      'accepted: ' + text.longOk + ', stored length ' + text.longLen.toLocaleString() + ' of 100,000 characters');
    rec.check('Emoji, right-to-left overrides and tabs round-trip and render as text',
      text.awkwardOk && text.roundTrip && text.rendered && text.kids === 0,
      'accepted: ' + text.awkwardOk + ', stored unchanged: ' + text.roundTrip +
      ', redisplayed unchanged: ' + text.rendered + ', element children created: ' + text.kids);

    /* ---- 13. hammering the interface ---- */
    const hammer = await A.openApp(context);
    await A.selectRequest(hammer, 'R001');
    await hammer.check('#act_provisional_approval');
    await hammer.fill('#minutesIn', '30');
    await hammer.fill('#reasonIn', 'hammering the save button');
    await A.fillAlternative(hammer);
    await Promise.all(Array.from({ length: 8 }, () => hammer.click('#saveDecision').catch(() => {})));
    await hammer.waitForTimeout(500);
    rec.check('Hammering Save reserves the minutes once',
      await A.remaining(hammer) === 90, await A.capacityText(hammer));
    for (let i = 0; i < 6; i++){
      await hammer.selectOption('#runSel', ['RUN-1','RUN-2','RUN-3','RUN-4'][i % 4]).catch(() => {});
      await hammer.waitForTimeout(80);
    }
    await hammer.waitForTimeout(300);
    const afterSwitching = await hammer.evaluate(() => ({
      run: App.state.activeRunId, batch: App.state.ui.batch,
      listed: document.querySelectorAll('#requestList li').length,
      matches: getRun(App.state, App.state.activeRunId).batch === App.state.ui.batch
    }));
    rec.check('Switching runs rapidly leaves the page consistent',
      afterSwitching.matches && afterSwitching.listed > 0,
      'settled on ' + afterSwitching.run + ' showing batch ' + afterSwitching.batch + ' with ' + afterSwitching.listed + ' requests');

    /* ---- 14. the fields added after the first stress round ---- */
    const carried = await page.evaluate(() => {
      const st = createInitialState();
      applyDecision(st, 'RUN-1', { requestId:'R001', submissionId:'K1', state:'provisional_approval',
        minutes:50, reason:'hold', alternative:'the partner conversation', actorRole:'t' });
      const convert = applyDecision(st, 'RUN-1', { requestId:'R001', submissionId:'K2', state:'binding', reason:'confirm', actorRole:'t' });
      const afterConvert = st.runs['RUN-1'].decisions['R001'].alternative;
      const stepBack = applyDecision(st, 'RUN-1', { requestId:'R001', submissionId:'K3', state:'provisional_approval',
        reason:'step back', amendApprover:'L', amendApproverRole:'Leader', amendReason:'leader asked', actorRole:'t' });
      const brandNew = applyDecision(st, 'RUN-1', { requestId:'R002', submissionId:'K4', state:'provisional_approval',
        minutes:30, reason:'a new reservation', actorRole:'t' });
      return { convert: convert.ok, afterConvert, stepBack: stepBack.ok, brandNew: brandNew.ok,
               message: brandNew.errors.length ? brandNew.errors[0].message : '' };
    });
    rec.check('A carried reservation carries what it displaces, rather than asking again',
      carried.convert && carried.stepBack && carried.afterConvert === 'the partner conversation' && !carried.brandNew,
      'converting and stepping back both accepted, still displacing ' + JSON.stringify(carried.afterConvert) +
      '; a genuinely new reservation is still refused without one');

    const older = await page.evaluate(() => {
      const st = createInitialState();
      applyDecision(st, 'RUN-1', { requestId:'R001', submissionId:'O1', state:'deferred', reason:'park',
        owner:'J. Steele', reviewDate:'2026-10-01', needsClarification:true, clarification:'Is this above the threshold?',
        clarificationOwner:'P. Raman', clarificationDue:'2026-10-02', actorRole:'t' });
      /* Degrade it to the shape a record saved before these fields would have. */
      st.runs['RUN-1'].decisions['R001'].clarification = { question:'Is this above the threshold?', answered:false };
      delete st.runs['RUN-1'].decisions['R001'].alternative;
      const repaired = normaliseState(JSON.parse(JSON.stringify(st)));
      const w = getUnresolvedWork(repaired, 'RUN-1')[0];
      const host = document.createElement('div');
      host.appendChild(el('div', 'rtext', w.kind + ' — question for ' + (w.askedOf || 'nobody recorded') +
        (w.questionDue ? ' by ' + w.questionDue : ' with no date recorded') + ': ' + w.question));
      const text = host.textContent;
      return { text, undef: /undefined/.test(text) };
    });
    rec.check('A record saved before these fields existed never renders the word undefined',
      !older.undef, 'it reads: ' + older.text);

    /* ---- 15. records changing underneath decisions already made ---- */
    const stranded = await page.evaluate(() => {
      const st = createInitialState();
      applyDecision(st, 'RUN-1', { requestId:'R001', submissionId:'N1', state:'provisional_approval',
        minutes:45, reason:'decided against the records of the day', alternative:'the partner conversation', actorRole:'t' });
      const before = computeCapacity(st, 'RUN-1', 'A').reserved;
      const snap = JSON.parse(JSON.stringify(getSources(st)));
      snap.requests = snap.requests.filter(r => r.request_id !== 'R001');
      st.sourceSnapshots.push({ snapshotId:'SNAP-WITHOUT-R001', importedAt:new Date().toISOString(),
        label:'an import that does not contain R001', data:snap });
      st.activeSnapshotId = 'SNAP-WITHOUT-R001';
      const after = computeCapacity(st, 'RUN-1', 'A').reserved;
      const orphans = getOrphanedDecisions(st, 'RUN-1');
      return { before, after, orphans: orphans.length, minutes: orphans.length ? orphans[0].minutes : 0 };
    });
    rec.check('Importing records that drop a decided request does not quietly release its minutes',
      stranded.before === 45 && stranded.after === 45 && stranded.orphans === 1 && stranded.minutes === 45,
      'reserved ' + stranded.before + ' before the import and ' + stranded.after + ' after; ' +
      stranded.orphans + ' decision surfaced as no longer matching the records, still holding ' + stranded.minutes + ' minutes');

    /* ---- 16. effort figures that are not plain numbers ---- */
    const effort = await page.evaluate(() => {
      const e = { preparation:'5', assessment:'twelve', verification:'-4', correction:'', clarification:'3.5', logging:'1e2' };
      return { total: effortTotal(e), refused: effortUnreadable(e).map(x => x.raw) };
    });
    rec.check('An effort figure that is not plain digits is refused rather than silently dropped',
      effort.total === 5 && effort.refused.length === 4,
      'total counted ' + effort.total + ' minutes; refused ' + JSON.stringify(effort.refused) +
      ' — silently ignoring any of these would make a run look cheaper than it was');

    /* ---- 17. a backdated policy change ---- */
    const backdated = await page.evaluate(() => {
      const st = createInitialState();
      const before = getCurrentPriorityVersion(st).version;
      const res = recordPolicyVersion(st, { version:'v0-old', effectiveDate:'2020-01-01', summary:'backdated', actorRole:'t' });
      return { ok: res.ok, before, after: getCurrentPriorityVersion(st).version };
    });
    rec.check('A policy change dated before the one in force does not become the version in force',
      backdated.ok && backdated.before === 'v3' && backdated.after === 'v3',
      'recorded as a historical version; ' + backdated.after + ' is still what new decisions will use, and the interface now says so rather than claiming otherwise');

    /* ---- 18. a question carries no flag nothing can set ---- */
    const question = await page.evaluate(() => {
      const st = createInitialState();
      applyDecision(st, 'RUN-1', { requestId:'R001', submissionId:'Q1', state:'deferred', reason:'ask first',
        owner:'O', reviewDate:'2026-10-01', needsClarification:true, clarification:'Q?',
        clarificationOwner:'P', clarificationDue:'2026-10-02', actorRole:'t' });
      const shape = st.runs['RUN-1'].decisions['R001'].clarification;
      const openBefore = getUnresolvedWork(st, 'RUN-1').length;
      applyDecision(st, 'RUN-1', { requestId:'R001', submissionId:'Q2', state:'declined', reason:'the answer came back', actorRole:'t' });
      return { shape, openBefore, openAfter: getUnresolvedWork(st, 'RUN-1').length };
    });
    rec.check('A question carries no flag the application could never set, and closes when the next decision is recorded',
      !('answered' in question.shape) && question.openBefore === 1 && question.openAfter === 0,
      'the record is ' + JSON.stringify(question.shape) + '; open before the next decision ' +
      question.openBefore + ', after ' + question.openAfter);

    rec.check('No uncaught errors under any of this',
      page.errors.length === 0 && hammer.errors.length === 0 && w1.errors.length === 0 && w2.errors.length === 0,
      [...page.errors, ...hammer.errors, ...w1.errors, ...w2.errors].join(' | ') || 'none');
  }
);

if (require.main === module) H.cli(module.exports);
