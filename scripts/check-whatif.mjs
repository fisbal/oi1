// In 1 Class rivals Excel's Data tab (Martin, 2026-10-31): Goal Seek, Scenarios, Solver and Data validation.
// Checks like a person, on PC and phone: a loan's amount found from the monthly payment (and Undo brings it back),
// the classic product mix solved by Solver (2, 6 → 36), a best-case scenario shown and summed up in a new sheet, a
// list rule with its arrow and choices, a wrong entry refused (Retry), and "Circle invalid data". Every window fits
// the screen.
// Run after `npm run build`:
//   node scripts/check-whatif.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4201;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const H = '.module-host:not([hidden])';

async function goTo(page, ref) {
  const box = page.locator(`${H} .name-box`);
  await box.fill(ref);
  await box.press('Enter');
  await page.waitForTimeout(80);
}
async function put(page, ref, text) {
  await goTo(page, ref);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
}
const shown = (page, ref) => page.locator(`${H} .cell[data-cell="${ref}"]`).first().textContent({ timeout: 2000 }).catch(() => '');
const num = s => Number(String(s).replace(/[^\d.,-]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
async function dataTab(page) {
  await page.locator(`${H} .ribbon-tabs [role=tab]`).filter({ hasText: /^Data$/ }).first().click();
  await page.waitForTimeout(200);
}
async function press(page, label) {
  await dataTab(page);
  await page.locator(`${H} .ribbon-panel button[aria-label="${label}"]`).first().click();
  await page.waitForTimeout(250);
}
async function fits(page, name, what, viewport) {
  const b = await page.locator('dialog[open]').boundingBox();
  check(!!b && b.x >= 0 && b.x + b.width <= viewport.width + 1 && b.y >= 0 && b.y + b.height <= viewport.height + 1, `${name}: the ${what} window fits the screen`);
}
const field = (page, label) => page.locator(`dialog[open] [aria-label="${label}"]`).first();
const ok = page => page.locator('dialog[open] .dialog-buttons .primary').click();

for (const [name, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.goto(url);
  await page.locator('.slab:has-text("In 1 Class")').first().click();
  await page.waitForTimeout(1200);

  // 1. Goal Seek: what loan gives a payment of 300 a month over 5 years at 5 %?
  await put(page, 'A1', '0.05'); await put(page, 'A2', '60'); await put(page, 'A3', '10000'); await put(page, 'A4', '=ROUND(PMT(A1/12,A2,-A3),2)');
  check(Math.abs(num(await shown(page, 'A4')) - 188.71) < 0.01, `${name}: the payment formula works out (${await shown(page, 'A4')})`);
  await goTo(page, 'A4');
  await press(page, 'Goal Seek');
  await fits(page, name, 'Goal Seek', viewport);
  check(await field(page, 'Set cell (a formula)').inputValue() === 'A4', `${name}: Goal Seek starts from the selected formula`);
  await field(page, 'To value').fill('300');
  await field(page, 'By changing cell').fill('A3');
  await ok(page);
  await page.waitForTimeout(300);
  const status = await page.locator('dialog[open] .wi-status').textContent().catch(() => '');
  check(/found a solution/i.test(status ?? ''), `${name}: Goal Seek finds a solution (${status})`);
  await ok(page);
  await page.waitForTimeout(200);
  const loan = num(await shown(page, 'A3'));
  check(Math.abs(loan - 15897.2) < 2, `${name}: the loan amount is written (${loan})`);
  check(Math.abs(num(await shown(page, 'A4')) - 300) < 0.01, `${name}: the payment is now 300 (${await shown(page, 'A4')})`);
  await page.locator(`${H} button[aria-label="Undo"]`).first().click();
  await page.waitForTimeout(150);
  check(num(await shown(page, 'A3')) === 10000, `${name}: one Undo brings the old amount back (${await shown(page, 'A3')})`);

  // 2. Solver: the product mix, max 3x + 5y with x ≤ 4, 2y ≤ 12, 3x + 2y ≤ 18.
  await put(page, 'B1', '0'); await put(page, 'B2', '0');
  await put(page, 'C1', '=3*B1+5*B2'); await put(page, 'C2', '=2*B2'); await put(page, 'C3', '=3*B1+2*B2');
  await goTo(page, 'C1');
  await press(page, 'Solver');
  await fits(page, name, 'Solver', viewport);
  await field(page, 'By changing cells').fill('B1:B2');
  for (const [left, right] of [['B1', '4'], ['C2', '12'], ['C3', '18']]) {
    await field(page, 'Cell').fill(left);
    await field(page, 'Limit').fill(right);
    await page.locator('dialog[open] .wi-con-add button').click();
  }
  check(await page.locator('dialog[open] .wi-con').count() === 3, `${name}: three limits are listed`);
  await fits(page, name, 'Solver (with limits)', viewport);
  await ok(page);
  await page.locator('dialog[open] .wi-status').waitFor({ timeout: 8000 }).catch(() => {});
  const sst = await page.locator('dialog[open] .wi-status').textContent().catch(() => '');
  check(/best solution/i.test(sst ?? ''), `${name}: Solver finds the best solution (${sst})`);
  check(/linear/i.test(await page.locator('dialog[open] .wi-hint').first().textContent().catch(() => '') ?? ''), `${name}: Solver says the model is linear and solved exactly`);
  await ok(page);
  await page.waitForTimeout(200);
  check(num(await shown(page, 'B1')) === 2 && num(await shown(page, 'B2')) === 6 && num(await shown(page, 'C1')) === 36, `${name}: Solver keeps x = 2, y = 6, profit 36 (${await shown(page, 'B1')}, ${await shown(page, 'B2')}, ${await shown(page, 'C1')})`);
  // The model is remembered with the sheet.
  await press(page, 'Solver');
  check(await field(page, 'By changing cells').inputValue() === 'B1:B2' && await page.locator('dialog[open] .wi-con').count() === 3, `${name}: Solver remembers its model`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  // 3. Scenarios: a best case for the loan, shown, then summed up.
  await goTo(page, 'A3');
  await press(page, 'Scenarios');
  await fits(page, name, 'Scenarios', viewport);
  await page.locator('dialog[open] .wi-actions button').filter({ hasText: /^Add$/ }).click();
  await field(page, 'Scenario name').fill('Best');
  await field(page, 'A3').fill('20000');
  await ok(page);
  await page.waitForTimeout(150);
  check(await page.locator('dialog[open] .wi-list [role=option]').count() === 1, `${name}: the scenario is listed`);
  await page.locator('dialog[open] .wi-actions button').filter({ hasText: /^Show$/ }).click();
  await page.waitForTimeout(150);
  check(num(await shown(page, 'A3')) === 20000, `${name}: Show puts the scenario's value in the sheet (${await shown(page, 'A3')})`);
  await page.locator('dialog[open] .wi-actions button').filter({ hasText: /Scenario summary/ }).click();
  await field(page, 'Result cells').fill('A4');
  await ok(page);
  await page.waitForTimeout(400);
  const tabs = await page.locator(`${H} .sheet-tabs button, ${H} .sheet-tab`).allTextContents();
  check(tabs.some(x => /Scenario summary/.test(x)), `${name}: the summary opens in a new sheet (${tabs.join(', ')})`);
  check(/Best/.test(await shown(page, 'C3')) && Math.abs(num(await shown(page, 'C5')) - 20000) < 1, `${name}: the summary lists the scenario's value (${await shown(page, 'C3')}, ${await shown(page, 'C5')})`);
  check(Math.abs(num(await shown(page, 'C7')) - 377.42) < 0.01, `${name}: the summary shows the scenario's result (${await shown(page, 'C7')})`);
  await page.locator(`${H} .sheet-tabs button, ${H} .sheet-tab`).first().click();
  await page.waitForTimeout(300);

  // 4. Data validation: a list with its arrow; a wrong entry is refused; circles show older wrong values.
  await put(page, 'D3', 'Maybe');
  await goTo(page, 'D1:D5');
  await press(page, 'Data validation');
  await fits(page, name, 'Data validation', viewport);
  await field(page, 'Allow').selectOption('list');
  await field(page, 'Source').fill('Yes, No');
  await page.locator('dialog[open] [role=tab]').filter({ hasText: 'Input message' }).click();
  await field(page, 'Title').fill('Answer');
  await field(page, 'Message').fill('Pick Yes or No');
  await ok(page);
  await page.waitForTimeout(200);
  await goTo(page, 'D1');
  const arrow = page.locator(`${H} .val-drop`);
  check(await arrow.count() >= 1, `${name}: a list cell shows its arrow`);
  check(/Pick Yes or No/.test(await page.locator(`${H} .val-prompt`).first().textContent().catch(() => '') ?? ''), `${name}: the input message shows under the cell`);
  await arrow.first().dispatchEvent('mousedown');
  await page.waitForTimeout(150);
  const choices = await page.locator('.val-list [role=option]').allTextContents();
  check(choices.join() === 'Yes,No', `${name}: the arrow lists the choices (${choices.join(', ')})`);
  const lb = await page.locator('.val-list').boundingBox();
  check(!!lb && lb.x >= 0 && lb.x + lb.width <= viewport.width + 1, `${name}: the list fits the screen`);
  await page.locator('.val-list [role=option]').filter({ hasText: 'No' }).click();
  await page.waitForTimeout(150);
  check(await shown(page, 'D1') === 'No', `${name}: picking a choice fills the cell (${await shown(page, 'D1')})`);
  await put(page, 'D2', 'Perhaps');
  check(await page.locator('dialog[open] .wi-status').count() === 1, `${name}: a value outside the list is stopped`);
  await page.locator('dialog[open] .wi-actions .primary').click();
  await page.waitForTimeout(150);
  check(await page.locator(`${H} .cell-editor`).count() === 1, `${name}: Retry opens the cell again with the text`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check(await shown(page, 'D2') === '', `${name}: the wrong value was not kept`);
  await dataTab(page);
  await page.locator(`${H} .ribbon-panel button[aria-label="Circle invalid data"]`).click();
  await page.waitForTimeout(200);
  check(await page.locator(`${H} .invalid-circle`).count() === 1, `${name}: "Circle invalid data" circles the old wrong value (${await page.locator(`${H} .invalid-circle`).count()})`);
  await page.locator(`${H} .ribbon-panel button[aria-label="Clear circles"]`).click();
  await page.waitForTimeout(150);
  check(await page.locator(`${H} .invalid-circle`).count() === 0, `${name}: "Clear circles" removes them`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
