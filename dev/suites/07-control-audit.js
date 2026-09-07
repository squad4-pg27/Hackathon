'use strict';
const H = require('../lib/harness');
const A = require('../lib/app');

module.exports = H.defineSuite(
  'Controls, labels and layout',
  'Every control has a name, keyboard focus is visible, the page fits 1280 by 720, and clicking everything raises no errors.',
  async ({ context, rec }) => {
    const page = await A.openApp(context, {});
    await page.setViewportSize({ width: 1280, height: 720 });

    /* Bring every conditional control into existence before auditing. */
    await A.openAllPanels(page);
    await A.selectRequest(page, 'R001');
    await page.check('#act_deferred');
    await page.waitForTimeout(200);
    await A.openAllPanels(page);

    const audit = await page.evaluate(() => {
      const named = el => {
        if (el.getAttribute('aria-label')) return true;
        if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return true;
        if (el.closest('label')) return true;
        return false;
      };
      const buttons = [...document.querySelectorAll('button')];
      const fields = [...document.querySelectorAll('input,select,textarea')];
      return {
        buttons: buttons.length,
        unnamedButtons: buttons.filter(b => !b.textContent.trim()).map(b => b.id || b.className),
        fields: fields.length,
        unlabelledFields: fields.filter(f => !named(f)).map(f => f.type + '#' + (f.id || '(no id)')),
        tabbable: [...document.querySelectorAll('button,input,select,textarea,summary,[tabindex]')].filter(e => !e.disabled).length
      };
    });
    rec.check('Every button carries a visible label',
      audit.unnamedButtons.length === 0,
      audit.buttons + ' buttons' + (audit.unnamedButtons.length ? ', unnamed: ' + audit.unnamedButtons.join(', ') : ', all labelled'));
    rec.check('Every field is labelled',
      audit.unlabelledFields.length === 0,
      audit.fields + ' fields' + (audit.unlabelledFields.length ? ', unlabelled: ' + audit.unlabelledFields.join(', ') : ', all labelled'));

    /* A date input is a composite: the browser tabs between its day, month
       and year segments and draws the ring on the segment, so the host
       element reports no outline on some presses. Judge each distinct
       control, not each key press. */
    const seen = new Map();
    for (let i = 0; i < 16; i++){
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const a = document.activeElement, s = getComputedStyle(a);
        return { key: a.tagName + (a.id ? '#' + a.id : '') + (a.type ? ':' + a.type : ''),
                 outline: s.outlineWidth + ' ' + s.outlineStyle };
      });
      const already = seen.get(f.key);
      if (!already || parseFloat(f.outline) > parseFloat(already)) seen.set(f.key, f.outline);
    }
    const controls = [...seen.entries()];
    const withOutline = controls.filter(([, o]) => parseFloat(o) > 0);
    const without = controls.filter(([, o]) => !(parseFloat(o) > 0)).map(([k]) => k);
    rec.check('Keyboard focus is visible on every control it reaches',
      without.length === 0,
      withOutline.length + ' of ' + controls.length + ' distinct controls reached show a focus outline' +
      (without.length ? ', none on: ' + without.join(', ') : '') +
      '; for example ' + controls[0][0] + ' with ' + controls[0][1] + '. ' + audit.tabbable + ' controls are reachable in all');

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      overflowing: [...document.querySelectorAll('*')].filter(e => {
        const s = getComputedStyle(e);
        return e.scrollWidth > e.clientWidth + 2 && s.overflowX !== 'auto' && s.overflowX !== 'scroll';
      }).map(e => e.tagName + '.' + e.className).slice(0, 6)
    }));
    rec.check('No horizontal overflow at 1280 by 720',
      layout.scrollWidth <= layout.clientWidth && layout.overflowing.length === 0,
      'scrollWidth ' + layout.scrollWidth + ', clientWidth ' + layout.clientWidth +
      (layout.overflowing.length ? ', overflowing: ' + layout.overflowing.join(', ') : ', nothing overflowing'));

    /* Click every button except the ones that cannot be undone. Those are
       exercised deliberately in the other suites. */
    const oneWay = [/Release late request/, /Yes, release it now/, /Freeze this run/, /Unfreeze this run/,
                    /Reset everything/, /Yes, reset everything now/, /Close the key and discard it/];
    const labels = await page.$$eval('button', bs => bs.map(b => b.textContent.trim()));
    let clicked = 0; const skipped = [];
    for (const label of labels){
      if (oneWay.some(re => re.test(label))){ skipped.push(label); continue; }
      await A.openAllPanels(page);
      const el = await page.$('button:text-is(' + JSON.stringify(label) + ')');
      if (!el) continue;
      if (!(await el.isVisible().catch(() => false))) continue;
      if (await el.isDisabled().catch(() => true)) continue;
      await el.click({ timeout: 2000 }).catch(() => {});
      clicked++;
      await page.waitForTimeout(60);
    }
    rec.check('Clicking every control raises no errors',
      page.errors.length === 0,
      clicked + ' of ' + labels.length + ' buttons clicked; one-way controls deliberately skipped: ' + skipped.join(' / ') +
      '; errors: ' + (page.errors.join(' | ') || 'none'));
    rec.check('The page is still usable after the sweep',
      (await page.$$eval('#requestList li', n => n.length)) > 0,
      (await page.$$eval('#requestList li', n => n.length)) + ' requests still listed');
  }
);

if (require.main === module) H.cli(module.exports);
