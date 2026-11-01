// Renaming the tabs of Office In 1 (Martin, 2026-11-01: "rends possible renommer les onglets d'Office In 1"). On PC
// and phone, in every app: a double-click (or a right-click / long press) on the tab opens a name box, Enter keeps the
// new name and Escape cancels; the document takes the name (Class shows it in its status bar, so saving and exporting
// use it), the name stays after a reload, and the ✎ button of the list of open documents renames too.
// Run after `npm run build`:
//   node scripts/check-rename.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4208;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const APPS = [['Letter', 'In 1 Letter'], ['Class', 'In 1 Class'], ['Stage', 'In 1 Stage'], ['Code+', 'Code+'], ['Draw', 'In 1 Draw'], ['Notes', 'In 1 Notes'], ['Plan', 'In 1 Plan'], ['Form', 'In 1 Form'], ['Mail', 'In 1 Mail']];

for (const [name, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.addInitScript(() => { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'en'); sessionStorage.setItem('set', '1'); } });
  await page.goto(url);
  for (const [app, slab] of APPS) {
    await page.locator('.brand').click();
    await page.waitForTimeout(300);
    await page.locator(`.slab:has-text("${slab}")`).first().click();
    await page.waitForTimeout(1500);
    const tab = page.locator('.tabs .tab.active');
    const before = (await tab.locator('.tab-label').textContent())?.trim();
    // Escape keeps the old name.
    await tab.dblclick();
    const box = page.locator('.tabs .tab.active .tab-rename');
    check(await box.isVisible().catch(() => false), `${name} ${app}: a double-click on the tab opens the name box`);
    const bb = await box.boundingBox();
    check(!!bb && bb.x >= 0 && bb.x + bb.width <= viewport.width + 1 && bb.width >= 80, `${name} ${app}: the name box is on screen and wide enough`);
    await page.keyboard.type('Nope');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check((await tab.locator('.tab-label').textContent())?.trim() === before, `${name} ${app}: Escape keeps the old name (${before})`);
    // Enter keeps the new name.
    await tab.dblclick();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(`Budget ${app} 2026`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const after = (await tab.locator('.tab-label').textContent())?.trim();
    check(after === `Budget ${app} 2026`, `${name} ${app}: Enter renames the tab (${after})`);
    if (app === 'Class') {
      const status = await page.locator('.module-host:not([hidden]) .status').first().textContent().catch(() => '');
      check(/Budget Class 2026\.xlsx/.test(status ?? ''), `${name} Class: the workbook takes the name (${status?.slice(0, 40)})`);
    }
  }
  // Right-click (long press on a phone) renames too.
  const tab = page.locator('.tabs .tab.active');
  await tab.click({ button: 'right' });
  check(await page.locator('.tabs .tab.active .tab-rename').isVisible().catch(() => false), `${name}: a right-click / long press on the tab opens the name box`);
  await page.keyboard.press('Escape');
  // The ✎ of the list of open documents.
  await page.locator('.tabs-all').click();
  await page.waitForTimeout(200);
  const row = page.locator('.tabs-menu-row').first();
  await row.locator('.tabs-menu-rename').click();
  const mbox = row.locator('.tab-rename');
  check(await mbox.isVisible().catch(() => false), `${name}: ✎ in the list of open documents opens the name box`);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('From the list');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  check((await page.locator('.tabs .tab .tab-label').allTextContents()).some(x => x.trim() === 'From the list'), `${name}: the list renames the tab`);
  await page.keyboard.press('Escape');
  // After a reload the names stay.
  await page.reload();
  await page.waitForTimeout(2500);
  const labels = (await page.locator('.tabs .tab .tab-label').allTextContents()).map(x => x.trim());
  check(labels.includes('From the list') && labels.includes('Budget Class 2026') && labels.includes('Budget Stage 2026'), `${name}: the names stay after a reload (${labels.join(' | ')})`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { server.kill(); }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
