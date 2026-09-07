'use strict';
/* Page helpers. These drive the interface the way an operator would:
   clicking real controls, not calling internal functions. Where a check
   genuinely needs an internal function (for example to prove a rule holds
   without a matching control), the suite calls it explicitly and says so. */

const fs = require('fs');
const path = require('path');
const { APP_URL, FIXTURES } = require('./harness');

/* Opens the application at its real file:// address and starts collecting
   any uncaught errors, so a suite can assert there were none. */
async function openApp(context, { url = APP_URL } = {}){
  const page = await context.newPage();
  page.errors = [];
  page.dialogs = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('dialog', async d => { page.dialogs.push(d.message()); await d.dismiss(); });
  await page.goto(url);
  await page.waitForTimeout(300);
  return page;
}

const openPanel = async (page, id) => {
  await page.evaluate(i => { const d = document.getElementById(i); if (d) d.open = true; }, id);
  await page.waitForTimeout(120);
};
const openAllPanels = async page => {
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await page.waitForTimeout(120);
};

const requestIds = page =>
  page.$$eval('#requestList .rid', ns => ns.map(n => n.textContent.split(' ')[0]));

async function selectRequest(page, requestId){
  const ids = await requestIds(page);
  const idx = ids.indexOf(requestId);
  if (idx < 0) throw new Error('Request ' + requestId + ' is not listed. Listed: ' + ids.join(', '));
  await page.click('#requestList li:nth-child(' + (idx + 1) + ') .reqbtn');
  await page.waitForTimeout(160);
}

async function switchRun(page, runId){
  await page.selectOption('#runSel', runId);
  await page.waitForTimeout(320);
}

/* Remaining minutes as a number, read off the capacity box. */
async function remaining(page){
  const t = (await page.textContent('#capBox')).replace(/\s+/g, ' ');
  const m = t.match(/remaining (-?\d+) of/);
  if (!m) throw new Error('Could not read remaining minutes from "' + t + '"');
  return Number(m[1]);
}
const capacityText = async page => (await page.textContent('#capBox')).replace(/\s+/g, ' ').trim();

/* Fills in the decision form and clicks Save. Only fills the conditional
   fields the chosen action actually reveals. */
async function decide(page, requestId, opts){
  await selectRequest(page, requestId);
  await page.check('#act_' + opts.state);
  await page.waitForTimeout(150);
  if (opts.minutes !== undefined && await page.$('#minutesIn')) await page.fill('#minutesIn', String(opts.minutes));
  if (opts.owner && await page.$('#ownerIn')) await page.fill('#ownerIn', opts.owner);
  if (opts.reviewDate && await page.$('#reviewDateIn')) await page.fill('#reviewDateIn', opts.reviewDate);
  if (opts.ackBy && await page.$('#ackByIn')){ await page.fill('#ackByIn', opts.ackBy); await page.check('#ackConfirmIn'); }
  if (opts.amendApprover && await page.$('#amendApproverIn')){
    await page.fill('#amendApproverIn', opts.amendApprover);
    if (opts.amendRole) await page.fill('#amendRoleIn', opts.amendRole);
    await page.fill('#amendReasonIn', opts.amendReason || 'amendment reason for the test');
  }
  if (opts.exception && await page.$('#exceptionIn')){
    await page.check('#exceptionIn'); await page.waitForTimeout(120);
    await page.fill('#exceptionReasonIn', opts.exceptionReason || 'exception explanation for the test');
  }
  if (opts.clarification && await page.$('#needsClarificationIn')){
    await page.check('#needsClarificationIn'); await page.waitForTimeout(120);
    await page.fill('#clarificationIn', opts.clarification);
  }
  await page.fill('#reasonIn', opts.reason === undefined ? 'test reason linking the evidence to a trade-off' : opts.reason);
  await page.click('#saveDecision');
  await page.waitForTimeout(240);
  return {
    alert: (await page.textContent('#alertRegion')).replace(/\s+/g, ' ').trim(),
    formErrors: (await page.textContent('#decisionBody')).replace(/\s+/g, ' ').trim()
  };
}

async function confirmIdentityInUi(page, requestId, contactIdOrUnresolved, basis){
  await selectRequest(page, requestId);
  await page.selectOption('#identitySel', contactIdOrUnresolved);
  await page.fill('#identityBasisIn', basis);
  await page.click('#btnConfirmIdentity');
  await page.waitForTimeout(280);
}

/* Reads a brief fixture and substitutes the placeholders with real ids
   taken from the packet the application actually produced. */
function loadBriefFixture(name, subs){
  let text = fs.readFileSync(path.join(FIXTURES, 'briefs', name), 'utf8');
  for (const [key, value] of Object.entries(subs)) text = text.split('{{' + key + '}}').join(value);
  return text;
}

/* Pulls the ids out of a copied packet so brief fixtures can cite real ones. */
function packetIds(packetText){
  /* Read identifiers from the evidence only. The instruction block shows an
     example citation line, and those identifiers are not supplied data. */
  const marker = packetText.indexOf('=== EVIDENCE');
  const body = marker >= 0 ? packetText.slice(marker) : packetText;
  const grab = re => [...body.matchAll(re)].map(m => m[1]);
  const notes = grab(/\[NOTE:(N\d+)\]/g);
  const sources = grab(/\[SOURCE:(S\d+)\]/g);
  return {
    PACKET_ID: (packetText.match(/Packet ID: (PKT-[A-Z0-9-]+)/) || [])[1],
    REQUEST_ID: (body.match(/\[REQUEST:(R\d+)\]/) || [])[1],
    CONTACT_ID: (body.match(/\[CONTACT:(C\d+)\]/) || [])[1] || 'C005',
    NOTE_1: notes[0] || 'N001',
    NOTE_2: notes[1] || notes[0] || 'N002',
    GAP_ID: sources[sources.length - 1] || 'S023'
  };
}

const csvSet = dir => ['requests.csv','contacts.csv','accounts.csv','notes.csv','source_inventory.csv',
                       'prior_decisions.csv','priority_versions.csv','commitments.csv']
                      .map(f => path.join(dir, f));

const noOverflow = page => page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth
}));

module.exports = { openApp, openPanel, openAllPanels, requestIds, selectRequest, switchRun,
                   remaining, capacityText, decide, confirmIdentityInUi, loadBriefFixture,
                   packetIds, csvSet, noOverflow };
