'use strict';
const H = require('../lib/harness');
const A = require('../lib/app');

module.exports = H.defineSuite(
  'In-page self-checks',
  'Runs the application’s own "Run self-checks" button and reports every row it produces, then confirms the operator’s work was untouched.',
  async ({ context, rec }) => {
    const page = await A.openApp(context);

    /* Give the operator some real work first, so "left your work alone"
       is a claim with something at stake. */
    await A.decide(page, 'R001', { state:'provisional_approval', minutes:45,
      reason:'operator work that the self-checks must not disturb' });
    const capBefore = await A.capacityText(page);
    const storedBefore = await page.evaluate(() => localStorage.getItem('timeLedger.v1.state'));

    await A.openPanel(page, 'secChecks');
    await page.click('#btnRunChecks');
    await page.waitForTimeout(2000);

    const rows = await page.$$eval('#checksBody table.grid tr', trs => trs.map(tr => {
      const tds = [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
      return tds.length === 3 ? tds : null;
    }).filter(Boolean));

    if (!rows.length){
      rec.check('The in-page self-checks produced results', false, 'no result rows were rendered');
      return;
    }
    /* Report every row the application itself produced, verbatim. */
    for (const [verdict, name, observation] of rows){
      if (verdict === 'PASS') rec.check(name, true, observation);
      else if (verdict === 'FAIL') rec.check(name, false, observation);
      else rec.note(name, verdict, observation);
    }

    const capAfter = await A.capacityText(page);
    const storedAfter = await page.evaluate(() => localStorage.getItem('timeLedger.v1.state'));
    rec.check('Seen from outside, the self-checks left the operator’s work alone',
      capBefore === capAfter && storedBefore === storedAfter,
      'capacity before "' + capBefore + '", after "' + capAfter + '"; the saved record was ' +
      (storedBefore === storedAfter ? 'unchanged' : 'CHANGED'));

    const banner = (await page.textContent('#checksBody .banner')).replace(/\s+/g, ' ');
    rec.check('A pass is not overstated as an absence of faults',
      /not a claim that the application is free of faults/.test(banner), banner.trim().slice(0, 120));
    rec.check('No uncaught errors while the checks ran',
      page.errors.length === 0, page.errors.join(' | ') || 'none');
  }
);

if (require.main === module) H.cli(module.exports);
