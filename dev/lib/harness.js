'use strict';
/* Shared test harness for Time Ledger.
   Development tooling only. The application never loads any of this. */

const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const APP_FILE = path.join(REPO_ROOT, 'index.html');
const APP_URL = 'file://' + APP_FILE;
const FIXTURES = path.join(REPO_ROOT, 'dev', 'fixtures');
const DATA = path.join(REPO_ROOT, 'data');
const OUT = path.join(REPO_ROOT, 'dev', '.out');

function loadPlaywright(){
  const tried = [];
  for (const candidate of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright']){
    try { return require(candidate); } catch (e){ tried.push(candidate); }
  }
  throw new Error(
    'Playwright was not found. Tried: ' + tried.join(', ') + '\n' +
    'Install it with:  npm install --no-save playwright  &&  npx playwright install chromium\n' +
    'It is a development tool only. The application itself needs nothing installed.'
  );
}

/* A single suite's results. Verdicts follow the project rule:
   PASS, FAIL, NOT IMPLEMENTED or UNVERIFIED, each with what was observed. */
class Recorder {
  constructor(name){ this.name = name; this.results = []; }
  check(name, passed, observation){
    this.results.push({ name, verdict: passed ? 'PASS' : 'FAIL', observation: String(observation) });
    return passed;
  }
  note(name, verdict, observation){
    this.results.push({ name, verdict, observation: String(observation) });
  }
  get counts(){
    const c = { PASS:0, FAIL:0, UNVERIFIED:0, 'NOT IMPLEMENTED':0 };
    for (const r of this.results) c[r.verdict] = (c[r.verdict] || 0) + 1;
    return c;
  }
}

function defineSuite(name, description, fn){
  return { name, description, fn };
}

/* Runs one suite in its own browser context. Returns the recorder. */
async function runSuite(suite, opts = {}){
  const { chromium } = loadPlaywright();
  const rec = new Recorder(suite.name);
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e){
    rec.note(suite.name + ' could not start a browser', 'NOT IMPLEMENTED', e.message.split('\n')[0]);
    return rec;
  }
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 900 },
    acceptDownloads: true
  });
  try {
    await suite.fn({ browser, context, rec, opts });
  } catch (e){
    rec.check(suite.name + ' ran to completion', false, 'the suite threw before finishing: ' + (e && e.message || e));
  } finally {
    await browser.close().catch(() => {});
  }
  return rec;
}

function printRecorder(rec, { verbose = true } = {}){
  if (verbose){
    for (const r of rec.results) console.log('[' + r.verdict + '] ' + r.name + '\n        ' + r.observation);
  }
  const c = rec.counts;
  console.log('\n--- ' + rec.name + ': ' + c.PASS + ' PASS, ' + c.FAIL + ' FAIL' +
    (c.UNVERIFIED ? ', ' + c.UNVERIFIED + ' UNVERIFIED' : '') +
    (c['NOT IMPLEMENTED'] ? ', ' + c['NOT IMPLEMENTED'] + ' NOT IMPLEMENTED' : '') + ' ---');
}

/* Lets each suite file be run on its own:  node dev/suites/01-core-journey.js */
function cli(suite){
  if (!fs.existsSync(APP_FILE)){
    console.error('index.html was not found at ' + APP_FILE);
    process.exit(2);
  }
  runSuite(suite).then(rec => {
    printRecorder(rec);
    process.exit(rec.counts.FAIL ? 1 : 0);
  }).catch(e => { console.error('HARNESS ERROR: ' + e.message); process.exit(2); });
}

function ensureOutDir(){
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  return OUT;
}

module.exports = { REPO_ROOT, APP_FILE, APP_URL, FIXTURES, DATA, OUT,
                   loadPlaywright, defineSuite, runSuite, printRecorder, cli, Recorder, ensureOutDir };
