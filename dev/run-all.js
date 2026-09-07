#!/usr/bin/env node
'use strict';
/* Runs every suite and prints one summary.
   Usage:
     node dev/run-all.js              all suites, one line per check
     node dev/run-all.js --quiet      summary table only
     node dev/run-all.js 03 05        only the suites whose file name starts with 03 or 05
   Exit code is 1 if anything failed, 2 if the harness itself could not run. */

const fs = require('fs');
const path = require('path');
const H = require('./lib/harness');

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const picks = args.filter(a => !a.startsWith('--'));

const dir = path.join(__dirname, 'suites');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()
  .filter(f => !picks.length || picks.some(p => f.startsWith(p)));

if (!files.length){
  console.error('No suites matched ' + picks.join(', '));
  process.exit(2);
}

(async () => {
  const started = Date.now();
  const summary = [];
  let totalFail = 0;

  console.log('Time Ledger test run');
  console.log('Application under test: ' + H.APP_URL);
  console.log('Opened as a file, with no server. ' + files.length + ' suite' + (files.length === 1 ? '' : 's') + ' to run.\n');

  for (const file of files){
    const suite = require(path.join(dir, file));
    if (!quiet) console.log('\n=== ' + suite.name + ' ===\n' + suite.description + '\n');
    const rec = await H.runSuite(suite);
    if (!quiet) H.printRecorder(rec, { verbose: true });
    else {
      for (const r of rec.results) if (r.verdict === 'FAIL') console.log('[FAIL] ' + suite.name + ' — ' + r.name + '\n        ' + r.observation);
    }
    const c = rec.counts;
    totalFail += c.FAIL;
    summary.push({ file, name: suite.name, ...c });
  }

  const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - String(s).length));
  console.log('\n\n================ SUMMARY ================');
  console.log(pad("Suite", 50) + pad('PASS', 6) + pad('FAIL', 6) + pad('UNVERIFIED', 12));
  let tp = 0, tf = 0, tu = 0, tn = 0;
  for (const s of summary){
    tp += s.PASS; tf += s.FAIL; tu += s.UNVERIFIED; tn += s['NOT IMPLEMENTED'];
    console.log(pad(s.name, 50) + pad(s.PASS, 6) + pad(s.FAIL, 6) + pad(s.UNVERIFIED || 0, 12));
  }
  console.log('-'.repeat(74));
  console.log(pad("TOTAL", 50) + pad(tp, 6) + pad(tf, 6) + pad(tu, 12));
  if (tn) console.log(tn + ' checks could not be attempted (NOT IMPLEMENTED).');
  console.log('\nFinished in ' + Math.round((Date.now() - started) / 1000) + ' seconds.');
  if (tu) console.log('UNVERIFIED means exactly that: the behaviour was not proven here and must not be reported as passing.');
  process.exit(totalFail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR: ' + e.message); process.exit(2); });
