// The right-click menu of In 1 Class (Martin, 2026-11-06: "en faisant un clic droit dans Class j'ai un menu quasiment nul par
// rapport à Excel" and "je ne peux pas copier coller"). Checks like a person, on PC, tablet and phone, standing and lying:
// a right click (a long press on touch screens, Shift+F10 on a keyboard) opens Office In 1's own menu, never the browser's;
// it fits the screen with no cut text; Copy then Paste from the menu works, and so do Paste values, Paste transposed,
// Insert row above, Sort and the search box.
// Run after `npm run build`:
//   node scripts/check-cellmenu.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4238;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => { (ok ? passed : problems).push(what); if (process.env.DEBUG) console.log(ok ? 'ok ' : 'NO ', what); };

const ALL = [
  ['PC', { width: 1366, height: 768 }, false],
  ['Mac', { width: 1440, height: 900 }, false],
  ['Tablet', { width: 820, height: 1180 }, true],
  ['Tablet sideways', { width: 1180, height: 820 }, true],
  ['Phone', { width: 390, height: 844 }, true],
  ['Phone sideways', { width: 844, height: 390 }, true],
];
const DEVICES = process.env.ONLY ? ALL.filter(d => d[0] === process.env.ONLY) : ALL;

for (const [name, viewport, touch] of DEVICES) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: touch, hasTouch: touch, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.goto(url);
  await page.locator('.slab:has-text("In 1 Class")').first().click();
  await page.waitForTimeout(1200);
  const host = page.locator('.module-host:not([hidden])');
  const box = host.locator('.name-box');
  const bar = host.locator('.bar-input');
  const go = async ref => { await box.click(); await box.fill(ref); await box.press('Enter'); await page.waitForTimeout(120); };
  const valueAt = async ref => { await go(ref); return (await bar.inputValue()).trim(); };
  const menu = page.locator('.cell-menu');
  // Where a cell is on screen (from the active-cell frame after going to it).
  const spot = async ref => {
    await go(ref);
    const b = await host.locator(ref.includes(':') ? '.sel-box' : '.active-box').first().boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const cdp = touch ? await ctx.newCDPSession(page) : null;
  const openMenu = async ref => {
    const p = await spot(ref);
    if (touch) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
      await page.waitForTimeout(750);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.waitForTimeout(250);
  };
  const pick = async id => { const it = menu.locator(`[data-id="${id}"]`); await it.scrollIntoViewIfNeeded(); await it.click(); await page.waitForTimeout(300); };

  // Some numbers and a formula.
  await go('A1');
  for (const v of ['3', '5', '=A1+A2']) { await page.keyboard.type(v); await page.keyboard.press('Enter'); }
  await page.waitForTimeout(200);
  check(await valueAt('A3') === '=A1+A2', `${name}: the test data is typed in`);

  // The menu opens on the cell, is Office In 1's own and fits the screen.
  await openMenu('A1:A3');
  check(await menu.isVisible(), `${name}: ${touch ? 'a long press' : 'a right click'} on a cell opens the Office In 1 menu`);
  const mb = await menu.boundingBox({ timeout: 2000 }).catch(() => null);
  check(!!mb && mb.x >= 0 && mb.y >= 0 && mb.x + mb.width <= viewport.width + 1 && mb.y + mb.height <= viewport.height + 1,
    `${name}: the menu fits the screen (${mb ? `${Math.round(mb.x)},${Math.round(mb.y)} ${Math.round(mb.width)}×${Math.round(mb.height)}` : 'none'})`);
  const items = await menu.locator('.cm-item').count();
  check(items >= 20, `${name}: the menu has at least 20 choices (${items})`);
  const cut = !mb ? ['no menu'] : await menu.evaluate(m => [...m.querySelectorAll('.cm-label, .cm-tile small, kbd')]
    .filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2).map(el => el.textContent));
  check(cut.length === 0, `${name}: no text is cut in the menu (${cut.join(' | ')})`);
  const quick = await menu.locator('[data-id="q-qSum"]').innerText().catch(() => '');
  check(/8|16/.test(quick), `${name}: quick analysis shows the sum of the selection (${quick})`);

  // Copy from the menu, then Paste from the menu somewhere else.
  await pick('copy');
  check(!(await menu.isVisible()), `${name}: the menu closes after a choice`);
  await openMenu('C1');
  await pick('paste');
  check(await valueAt('C3') === '=C1+C2', `${name}: Copy then Paste from the menu copies the cells, formulas following (${await valueAt('C3')})`);
  await openMenu('D1');
  await pick('p-values');
  check(await valueAt('D3') === '8', `${name}: Paste values puts the result, not the formula (${await valueAt('D3')})`);
  await openMenu('F1');
  await pick('p-transpose');
  check(await valueAt('G1') === '5' && await valueAt('H1') === '8', `${name}: Paste transposed turns the column into a row`);

  // Insert a row above, from a sub-list that opens in place.
  await openMenu('A1');
  await pick('insert');
  check(await menu.locator('[data-id="ins-above"]').isVisible(), `${name}: Insert opens its choices in place`);
  await pick('ins-above');
  check(await valueAt('A2') === '3' && await valueAt('A1') === '', `${name}: Insert row above moves the data down`);

  // Sort largest first.
  await openMenu('A2:A3');
  await pick('sort');
  await pick('sort-za');
  check(await valueAt('A2') === '5', `${name}: Sort largest to smallest works (${await valueAt('A2')})`);

  // The search box finds any choice, even inside a sub-list.
  await openMenu('B1');
  await page.keyboard.type('transp');
  await page.waitForTimeout(150);
  const found = await menu.locator('.cm-item').allInnerTexts();
  check(found.length >= 1 && found.every(f => /transp/i.test(f)), `${name}: the search box finds the choices (${found.join(' | ')})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check(!(await menu.isVisible()), `${name}: Escape closes the menu`);

  if (!touch) {
    await go('B2');
    await host.locator('.grid').focus();
    await page.keyboard.press('Shift+F10');
    await page.waitForTimeout(200);
    check(await menu.isVisible(), `${name}: Shift+F10 opens the menu from the keyboard`);
    await page.keyboard.press('Escape');
  }
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
if (!process.env.DEBUG) for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
