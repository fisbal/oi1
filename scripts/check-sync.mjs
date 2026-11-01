// Synchro (Martin, 2026-10-31): a table shared between In 1 Class and In 1 Letter is one live part. A change
// on either side shows on the other by itself, fast, survives a reload, and each copy says it is up to date.
// Used like a person would, on PC and phone. Run after `npm run build`:
//   node scripts/check-sync.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4188;
// The slowest a change may take to show in the other app, in milliseconds (rule 11: no lag).
const MAX_MS = 1000;
// Its own process group, so stopping it stops vite too.
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

// The text of every cell of the linked table in the letter, read even while the letter's tab is hidden.
const letterCells = page => page.evaluate(() => [...document.querySelectorAll('.module-host table[data-link^="lp_"] td, .module-host table[data-link^="lp_"] th')].map(c => c.textContent.trim()));
const classCells = page => page.evaluate(() => [...document.querySelectorAll('.module-host:not([hidden]) .cells .cell')].map(c => c.textContent.trim()).filter(Boolean));
async function until(page, fn, arg, ms = 3000) {
  const t0 = Date.now();
  await page.waitForFunction(fn, arg, { timeout: ms }).catch(() => {});
  return Date.now() - t0;
}
// Sheet cells let clicks through to the grid under them, as in the app: click where the cell is.
async function clickCell(page, text) {
  const box = await page.locator(`.module-host:not([hidden]) .cells .cell:has(span:text-is("${text}"))`).first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const showTab = (page, app) => page.locator(`nav.tabs .tab[title^="In 1 ${app}"]`).first().click();

async function run(name, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  page.on('dialog', d => d.dismiss());
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.locator('.slab:has-text("In 1 Class")').first().click();
  await page.waitForTimeout(1200);
  const host = page.locator('.module-host:not([hidden])');
  // A small table, typed like a person: A1 then across and down.
  const area = await host.locator('.cells-area').boundingBox();
  await page.mouse.click(area.x + 60, area.y + 12);
  for (const row of [['Item', 'Price'], ['Pen', '2'], ['Book', '9']]) {
    for (let i = 0; i < row.length; i++) { await page.keyboard.type(row[i]); await page.keyboard.press(i < row.length - 1 ? 'Tab' : 'Enter'); }
  }
  await page.waitForTimeout(200);
  check((await classCells(page)).join(' ').includes('Book 9'), `${name}: the table is typed in Class`);
  // Send to a new letter, from the ribbon tab that has it.
  const send = host.locator('button[aria-label="Send to Letter"]').first();
  const tabs = host.locator('.ribbon-tabs [role=tab]');
  for (let i = 0; i < await tabs.count() && !(await send.isVisible()); i++) { await tabs.nth(i).click(); await page.waitForTimeout(120); }
  await send.click();
  await page.locator('.drop-panel .menu-item:has-text("New letter")').click();
  await page.waitForTimeout(1500);
  const firstCells = await letterCells(page);
  check(firstCells.join(' ') === 'Item Price Pen 2 Book 9', `${name}: the letter gets the table (${firstCells.join(' ')})`);
  await until(page, () => document.querySelector('.module-host table[data-live="synced"]'), null);
  check(await page.locator('.module-host:not([hidden]) table[data-live="synced"]').count() === 1, `${name}: the letter's table says it is up to date`);

  // Class → Letter: change a price in Class.
  await showTab(page, 'Class');
  await page.waitForTimeout(300);
  await clickCell(page, '2');
  await page.keyboard.type('5');
  const t1 = Date.now();
  await page.keyboard.press('Enter');
  await until(page, () => [...document.querySelectorAll('.module-host table[data-link^="lp_"] td')].some(c => c.textContent.trim() === '5'), null, 5000);
  const ms1 = Date.now() - t1;
  check((await letterCells(page)).join(' ') === 'Item Price Pen 5 Book 9', `${name}: a change in Class shows in the letter by itself`);
  check(ms1 <= MAX_MS, `${name}: Class → Letter in ${ms1} ms (limit ${MAX_MS})`);
  check(await host.locator('.live-badge.live-synced').count() === 1, `${name}: Class says the table is up to date`);

  // Letter → Class: change a price in the letter.
  await showTab(page, 'Letter');
  await page.waitForTimeout(300);
  const cell = page.locator('.module-host:not([hidden]) table[data-link^="lp_"] td:has(p:text-is("9"))').first();
  await cell.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.type('12');
  await until(page, () => document.querySelector('.module-host:not([hidden]) table[data-live="synced"]'), null);
  check(await page.locator('.module-host:not([hidden]) table[data-live="synced"]').count() === 1, `${name}: the letter is up to date again after its own change`);
  // A sheet draws only the cells on screen, so look at Class as a person would.
  const t0 = Date.now();
  await showTab(page, 'Class');
  await page.waitForFunction(() => [...document.querySelectorAll('.module-host:not([hidden]) .cells .cell')].some(c => c.textContent.trim() === '12'), null, { timeout: 5000 }).catch(() => {});
  const ms2 = Date.now() - t0;
  check((await classCells(page)).includes('12'), `${name}: a change in the letter shows in Class by itself`);
  check(ms2 <= MAX_MS, `${name}: Letter → Class shown in ${ms2} ms (limit ${MAX_MS})`);
  check(await page.locator('.module-host:not([hidden]) .live-badge.live-synced').count() === 1, `${name}: Class says it is up to date after the letter's change`);

  // Reload: both copies come back linked and equal.
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForTimeout(2000);
  const after = await letterCells(page);
  check(after.join(' ') === 'Item Price Pen 5 Book 12', `${name}: after a reload the letter still has the table (${after.join(' ')})`);
  await showTab(page, 'Class');
  await page.waitForTimeout(300);
  check((await classCells(page)).includes('12'), `${name}: after a reload Class still has the change`);
  // Still live after the reload.
  await clickCell(page, 'Pen');
  await page.keyboard.type('Pencil');
  await page.keyboard.press('Enter');
  await until(page, () => [...document.querySelectorAll('.module-host table[data-link^="lp_"] td')].some(c => c.textContent.trim() === 'Pencil'), null);
  check((await letterCells(page)).includes('Pencil'), `${name}: still live after a reload`);
  await page.screenshot({ path: `screens/sync-${name}.png` }).catch(() => {});
  await ctx.close();
}

try {
  await run('pc', { width: 1440, height: 900 }, false);
  await run('phone', { width: 390, height: 844 }, true);
} catch (e) {
  problems.push(`crashed: ${String(e.message).split('\n').slice(0, 3).join(' ')}`);
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { server.kill(); }
}
for (const p of passed) console.log(`  ✓ ${p}`);
for (const p of problems) console.log(`  ✗ ${p}`);
if (problems.length) { console.error(`\n${problems.length} synchro problem(s).`); process.exit(1); }
console.log('\nSynchro: every change reached the other app, fast, and stayed after a reload.');
