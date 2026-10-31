// Office Class "Business / Métiers" tab (Martin, 2026-10-31: "un onglet catégories: Finance, économie, comptabilité…
// qui offre pour chaque des outils spécifiques" and "conversion de différentes monnaies du monde"). Checks on PC and
// phone that a category can be picked, a ready sheet is added with working formulas, the gallery offers 40+ tools and
// finds one by a word, and the converter turns money with the day's rates (played by the test, so it runs offline).
// Run after `npm run build`:
//   node scripts/check-metiers.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4193;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const RATES = { date: '2026-10-31', eur: { eur: 1, usd: 1.1, xaf: 655.957, xof: 655.957, gbp: 0.84, jpy: 163, cny: 7.7, cad: 1.5, chf: 0.94, ngn: 1700, mad: 10.8, zar: 20, cdf: 3000, inr: 90, brl: 6, btc: 0.0000139 } };
const H = '.module-host:not([hidden])';
const cellTexts = page => page.evaluate(h => [...document.querySelectorAll(`${h} .cells .cell`)].map(c => c.textContent.trim()).filter(Boolean), H);

async function showTab(page) {
  await page.locator(`${H} .ribbon-tabs [role=tab]:has-text("Business")`).first().click();
  await page.waitForTimeout(250);
}
const fits = (b, vp) => !!b && b.x >= -1 && b.x + b.width <= vp.width + 1;

for (const [name, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
  const reply = route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RATES), headers: { 'Access-Control-Allow-Origin': '*' } });
  await ctx.route('**/currency-api**', reply);
  await ctx.route('https://*.currency-api.pages.dev/**', reply);
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  page.on('dialog', d => d.dismiss());
  await page.goto(url);
  await page.locator('.slab:has-text("Office Class")').first().click();
  await page.waitForTimeout(1200);

  // 1. The tab and its categories.
  await showTab(page);
  for (const c of ['Finance', 'Accounting', 'All together']) check(await page.locator(`${H} button[aria-label="${c}"]:visible`).count() === 1, `${name}: a "${c}" category button`);
  await page.locator(`${H} button[aria-label="Accounting"]:visible`).click();
  await page.waitForTimeout(200);
  if (!(await page.locator(`${H} button[aria-label="Invoice"]:visible, ${H} button[aria-label^="Invoice"]:visible`).count())) await showTab(page);
  check(await page.locator(`${H} button[aria-label^="Invoice"]:visible`).count() >= 1, `${name}: Accounting shows its own tools (Invoice)`);
  if (!(await page.locator(`${H} button[aria-label="Finance"]:visible`).count())) await showTab(page);
  await page.locator(`${H} button[aria-label="Finance"]:visible`).click();
  await page.waitForTimeout(200);

  // 2. A ready sheet with real formulas.
  if (!(await page.locator(`${H} button[aria-label="Loan and repayment table"]:visible`).count())) await showTab(page);
  await page.locator(`${H} button[aria-label="Loan and repayment table"]:visible`).click();
  await page.waitForTimeout(700);
  const tabs = await page.locator(`${H} .sheet-tab`).allInnerTexts();
  check(tabs.some(x => /Loan and repayment/.test(x)), `${name}: the loan sheet is added as a new sheet (${tabs.join(', ')})`);
  let texts = await cellTexts(page);
  check(texts.some(x => /1[\s,.]?211[.,]96/.test(x)), `${name}: the loan sheet works out the monthly payment (200 000 at 4% over 20 years: 1 211.96) ${texts.slice(0, 14).join(' | ')}`);
  check(!texts.some(x => /^#[A-Z/0!?]+/.test(x)), `${name}: no formula error on the loan sheet`);

  // 3. The gallery: every tool, search by a word, fits the screen.
  if (!(await page.locator(`${H} button[aria-label="All tools"]:visible`).count())) await showTab(page);
  await page.locator(`${H} button[aria-label="All tools"]:visible`).click();
  const dlg = page.locator('dialog.oi-dialog[open]');
  await dlg.waitFor({ timeout: 3000 });
  await dlg.locator('.pro-cats button', { hasText: 'All together' }).click();
  const cards = await dlg.locator('.pro-card').count();
  check(cards >= 40, `${name}: the gallery offers ${cards} ready sheets`);
  check(fits(await dlg.boundingBox(), viewport), `${name}: the gallery fits the screen`);
  await dlg.locator('.fn-search').fill('vat');
  await page.waitForTimeout(200);
  const found = await dlg.locator('.pro-card b').allInnerTexts();
  check(found.some(x => /VAT/.test(x)), `${name}: searching "vat" finds the VAT tool (${found.join(', ')})`);
  await dlg.locator('button.primary').click();
  await page.waitForTimeout(600);
  texts = await cellTexts(page);
  check(texts.some(x => /1[\s,.]?200/.test(x)) && !texts.some(x => /^#[A-Z/0!?]+/.test(x)), `${name}: the VAT sheet works out 1 000 + 20% = 1 200, no error`);

  // 4. The converter, then its answer as a live =DEVISE() formula.
  if (!(await page.locator(`${H} button[aria-label="Currency converter"]:visible`).count())) await showTab(page);
  await page.locator(`${H} button[aria-label="Currency converter"]:visible`).click();
  await dlg.waitFor({ timeout: 3000 });
  await page.waitForFunction(() => document.querySelector('dialog[open] .cur-result'), null, { timeout: 5000 }).catch(() => {});
  await dlg.locator('.cur-amount input').fill('100');
  await page.waitForTimeout(200);
  const result = await dlg.locator('.cur-result').innerText().catch(() => '');
  check(/90[.,]9/.test(result) && /EUR/.test(result), `${name}: 100 USD gives 90.91 EUR with the day's rate (${result.replace(/\n/g, ' ')})`);
  const fromBox = dlg.locator('.cur-pick').first().locator('input');
  await fromBox.fill('cfa');
  await page.waitForTimeout(200);
  const opts = await dlg.locator('.cur-pick').first().locator('option').allInnerTexts();
  check(opts.some(o => /XAF/.test(o)), `${name}: finding a currency by its name works (${opts.slice(0, 3).join(', ')})`);
  check(fits(await dlg.boundingBox(), viewport), `${name}: the converter fits the screen`);
  await dlg.locator('button.primary').click();
  await page.waitForTimeout(500);
  texts = await cellTexts(page);
  check(texts.some(x => /90[.,]91/.test(x)), `${name}: "Put =DEVISE() in the cell" writes a converted value`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already stopped */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`BAD ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
