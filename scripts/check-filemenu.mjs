// The File menu (backstage) of every OI1 app, like a person on a phone, tablet, PC and Mac, both ways round
// (Martin, 2026-11-07: on the phone the left bar showed tiny icons with no names, "pas visibles et pas connus", and the
// recent document's name was cut). Checks that each choice shows its name, is big enough for a finger (44 px), fits the
// screen with no cut text, that a long recent name shows whole, that "Save as" opens and the close button works.
// Run after `npm run build`:
//   node scripts/check-filemenu.mjs        (ONLY=Phone, APPS=Letter,Class to narrow it)
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4243;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => { (ok ? passed : problems).push(what); if (process.env.DEBUG) console.log(ok ? 'ok ' : 'NO ', what); };

const ALL = [
  ['PC', { width: 1366, height: 768 }, false, 'fr-FR'],
  ['Mac', { width: 1440, height: 900 }, false, 'de-DE'],
  ['Tablet', { width: 820, height: 1180 }, true, 'fr-FR'],
  ['Tablet sideways', { width: 1180, height: 820 }, true, 'de-DE'],
  ['Phone', { width: 390, height: 844 }, true, 'fr-FR'],
  ['Phone (German)', { width: 390, height: 844 }, true, 'de-DE'],
  ['Small phone', { width: 360, height: 740 }, true, 'pt-BR'],
  ['Phone sideways', { width: 844, height: 390 }, true, 'fr-FR'],
];
const DEVICES = process.env.ONLY ? ALL.filter(d => d[0] === process.env.ONLY) : ALL;
const APPS = (process.env.APPS?.split(',') ?? ['Letter', 'Class', 'Stage', 'Draw', 'Image', 'Notes', 'Plan', 'Form', 'Mail', 'Code+'])
  .map(a => [a, a === 'Code+' ? 'code' : a.toLowerCase()]);
const LONG = 'Version complète du travail final de session automne 2026 - Martin.docx';
const B = '.module-host:not([hidden]) .backstage';

for (const [name, viewport, touch, locale] of DEVICES) {
  for (const [app, id] of APPS) {
    const n = `${app} ${name}`;
    const ctx = await browser.newContext({ viewport, locale, isMobile: touch, hasTouch: touch });
    const page = await ctx.newPage();
    page.on('pageerror', e => problems.push(`${n}: script error: ${e.message}`));
    await page.goto(url);
    await page.waitForTimeout(500);
    // A recent file with a long name, as Martin's.
    await page.evaluate(([mod, file]) => new Promise(done => {
      const req = indexedDB.open('oi1', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('kv'); req.result.createObjectStore('recent', { keyPath: 'id' }); };
      req.onsuccess = () => {
        const tx = req.result.transaction('recent', 'readwrite');
        tx.objectStore('recent').put({ id: `${mod}:${file}`, name: file, moduleId: mod, time: Date.now() });
        tx.oncomplete = () => { req.result.close(); done(); };
      };
      req.onerror = () => done();
    }), [id, LONG]);
    await page.locator(`.slab:has-text("In 1 ${app}")`).first().click();
    await page.waitForTimeout(1300);

    const file = page.locator('.module-host:not([hidden]) .ribbon-file').first();
    if (!(await file.isVisible().catch(() => false))) { check(false, `${n}: the File button shows`); await ctx.close(); continue; }
    if (touch) await file.tap(); else await file.click();
    await page.waitForTimeout(600);
    check(await page.locator(B).isVisible().catch(() => false), `${n}: the File menu opens`);

    const items = page.locator(`${B} .backstage-nav button`);
    const count = await items.count();
    check(count >= 6, `${n}: the File menu has its choices (${count})`);
    for (let i = 0; i < count; i++) {
      const it = items.nth(i);
      await it.scrollIntoViewIfNeeded().catch(() => {});
      const info = await it.evaluate(el => {
        const r = el.getBoundingClientRect(), svg = el.querySelector('svg')?.getBoundingClientRect();
        const label = el.innerText.replace('←', '').trim();
        const fs = parseFloat(getComputedStyle(el.querySelector('.back-label') ?? el).fontSize);
        // The label is cut when text overflows the button, or it is hidden.
        const cut = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
        return { x: r.x, y: r.y, w: r.width, h: r.height, label, fs, cut, icon: svg ? Math.min(svg.width, svg.height) : 99 };
      });
      const what = `${n}: choice "${info.label || '?'}"`;
      check(info.label.length > 1 && info.fs >= 11, `${what} shows its name (font ${info.fs}px)`);
      check(info.w >= 43.5 && info.h >= 43.5, `${what} is big enough for a finger (${Math.round(info.w)}x${Math.round(info.h)})`);
      check(info.icon >= 15, `${what} has a visible icon (${Math.round(info.icon)}px)`);
      check(!info.cut, `${what} has no cut text`);
      check(info.x >= 0 && info.y >= 0 && info.x + info.w <= viewport.width + 1 && info.y + info.h <= viewport.height + 1, `${what} is on the screen`);
    }

    // The recent file's whole name shows.
    const recent = page.locator(`${B} .recent-list .name`).first();
    if (await recent.isVisible().catch(() => false)) {
      const r = await recent.evaluate(el => ({ text: el.textContent, cut: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1, right: el.getBoundingClientRect().right }));
      check(r.text === LONG && !r.cut && r.right <= viewport.width + 1, `${n}: the recent file's whole name shows`);
    } else check(false, `${n}: the recent file shows`);

    // Save as: a real tap opens its choices, none cut.
    const saveAs = items.nth(4);
    await saveAs.scrollIntoViewIfNeeded().catch(() => {});
    if (touch) await saveAs.tap(); else await saveAs.click();
    await page.waitForTimeout(300);
    const choices = page.locator(`${B} .saveas-list button`);
    const nc = await choices.count();
    check(nc >= 1, `${n}: "Save as" shows the formats (${nc})`);
    const cutChoices = await page.locator(`${B} .saveas-list`).evaluate(l => [...l.querySelectorAll('b, span')]
      .filter(el => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > innerWidth + 1).map(el => el.textContent)).catch(() => ['none']);
    check(cutChoices.length === 0, `${n}: no format name is cut (${cutChoices.join(' | ')})`);

    // Close.
    const back = page.locator(`${B} .backstage-nav .back`);
    if (touch) await back.tap(); else await back.click();
    await page.waitForTimeout(300);
    check(!(await page.locator(B).isVisible().catch(() => false)), `${n}: the close button closes the File menu`);
    await ctx.close();
  }
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
console.log(`File menu: ${passed.length} checks passed, ${problems.length} problems`);
for (const p of problems) console.log('  -', p);
process.exit(problems.length ? 1 : 0);
