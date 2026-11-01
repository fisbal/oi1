// In 1 Class knows Excel's functions (Martin, 2026-10-31: "le nôtre ne rivalise pas Excel en outils"): 440+ of
// them, by category like Excel's Formulas tab, an "Insert function" window that finds them by name or by what they do,
// and =DEVISE() for the money of the world (rates played by the test, so it runs offline). On PC and phone.
// Run after `npm run build`:
//   node scripts/check-formulas.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4192;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const RATES = { date: '2026-10-29', eur: { eur: 1, usd: 1.1, xaf: 655.957, gbp: 0.84, btc: 0.0000139 } };

const cellTexts = page => page.evaluate(() => [...document.querySelectorAll('.module-host:not([hidden]) .cells .cell')].map(c => c.textContent.trim()).filter(Boolean));

async function openClass(page) {
  await page.goto(url);
  await page.locator('.slab:has-text("In 1 Class")').first().click();
  await page.waitForTimeout(1200);
}
async function typeAt(page, x, y, text) {
  const area = await page.locator('.module-host:not([hidden]) .cells-area').boundingBox();
  await page.mouse.click(area.x + x, area.y + y);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}
async function showRibbonTab(page, name) {
  await page.locator(`.module-host:not([hidden]) .ribbon-tabs [role=tab]:has-text("${name}")`).first().click();
  await page.waitForTimeout(250);
}

for (const [name, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
  let rateCalls = 0;
  await ctx.route('**/currency-api**', route => { rateCalls++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RATES), headers: { 'Access-Control-Allow-Origin': '*' } }); });
  await ctx.route('https://*.currency-api.pages.dev/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RATES), headers: { 'Access-Control-Allow-Origin': '*' } }));
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  page.on('dialog', d => d.dismiss());
  await openClass(page);

  // 1. Finance and statistics work out like Excel, typed in cells.
  await typeAt(page, 60, 12, '=ROUND(IRR({-70000,12000,15000,18000,21000,26000}),4)');
  await typeAt(page, 60, 12 + 24, '=SLN(30000,7500,10)');
  await typeAt(page, 60, 12 + 48, '=ROUND(NORM.DIST(42,40,1.5,TRUE),4)');
  await typeAt(page, 60, 12 + 72, '=DEVISE(100,"EUR","XAF")');
  await page.waitForFunction(() => [...document.querySelectorAll('.module-host:not([hidden]) .cells .cell')].some(c => /65[\s,.]?595/.test(c.textContent)), null, { timeout: 5000 }).catch(() => {});
  const texts = (await cellTexts(page)).join(' | ');
  check(/0[.,]0866/.test(texts), `${name}: IRR works out like Excel (${texts})`);
  check(/2[\s,.]?250/.test(texts), `${name}: SLN (straight-line depreciation) works out like Excel`);
  check(/0[.,]9088/.test(texts), `${name}: NORM.DIST works out like Excel`);
  check(/65[\s,.]?595/.test(texts), `${name}: =DEVISE(100,"EUR","XAF") converts with the day's rate`);
  check(rateCalls >= 1, `${name}: the rates are fetched (${rateCalls} call)`);

  // 2. The function library by category, like Excel's Formulas tab.
  await showRibbonTab(page, 'Formulas');
  const fin = page.locator('.module-host:not([hidden]) button[aria-label="Financial"]');
  check(await fin.count() === 1, `${name}: a Financial list in the Formulas tab`);
  await fin.click();
  const finItems = await page.locator('.drop-panel .menu-item').allInnerTexts();
  check(finItems.length >= 30 && finItems.includes('XIRR') && finItems.includes('DEVISE'), `${name}: Financial lists ${finItems.length} functions, XIRR and DEVISE among them`);
  const panel = await page.locator('.drop-panel').boundingBox();
  check(!!panel && panel.x >= 0 && panel.x + panel.width <= viewport.width + 1, `${name}: the Financial list fits the screen`);
  await fin.click(); // closes it again
  await page.waitForTimeout(200);
  const moreBtn = page.locator('.module-host:not([hidden]) button[aria-label="More functions"]');
  if (!(await moreBtn.isVisible())) await showRibbonTab(page, 'Formulas');
  await moreBtn.scrollIntoViewIfNeeded();
  await moreBtn.click();
  const more = await page.locator('.drop-panel h4').allInnerTexts();
  check(more.length === 4, `${name}: More functions has Statistical, Engineering, Information and Database (${more.join(', ')})`);
  await moreBtn.click();
  await page.waitForTimeout(200);
  const ins = page.locator('.module-host:not([hidden]) button[aria-label="Insert function"]:visible').first();
  if (!(await ins.count())) await showRibbonTab(page, 'Formulas');

  // 3. Insert function: find by what it does, read how to use it, insert it.
  await page.locator('.module-host:not([hidden]) button[aria-label="Insert function"]:visible').first().click();
  const dlg = page.locator('dialog.oi-dialog[open]');
  await dlg.waitFor({ timeout: 3000 });
  const total = await dlg.locator('.fn-cat option').first().innerText();
  check(/\((4[4-9]\d|[5-9]\d\d)\)/.test(total), `${name}: the window offers all functions (${total})`);
  await dlg.locator('.fn-search').fill('loan');
  await page.waitForTimeout(300);
  const found = await dlg.locator('.fn-names button').allInnerTexts();
  check(found.includes('PMT'), `${name}: searching "loan" finds PMT (${found.slice(0, 6).join(', ')})`);
  const pmt = dlg.locator('.fn-names button', { hasText: /^PMT$/ });
  if (await pmt.count()) await pmt.click(); else await dlg.locator('.fn-search').fill('PMT');
  await page.waitForTimeout(200);
  const about = await dlg.locator('.fn-about').innerText();
  check(/PMT\(rate, nper, pv/.test(about) && /payment/i.test(about), `${name}: it shows how PMT is written and what it does`);
  const box = await dlg.boundingBox();
  check(!!box && box.x >= 0 && box.x + box.width <= viewport.width + 1, `${name}: the window fits the screen (${Math.round(box?.width)} of ${viewport.width})`);
  await dlg.locator('button.primary').click();
  await page.waitForTimeout(300);
  const bar = await page.locator('.module-host:not([hidden]) .bar-input').inputValue().catch(() => '');
  check(bar.startsWith('=PMT('), `${name}: OK starts =PMT( in the cell (${bar})`);
  await page.keyboard.press('Escape');
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already stopped */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`BAD ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
