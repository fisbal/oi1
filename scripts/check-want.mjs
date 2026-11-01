// "Je veux…" (Martin, 2026-10-31): in every app, type what you want in your words and the app opens the right tab and
// numbers the buttons to use. Checks like a person, on PC and phone, in every app: the capsule is in the app bar, the
// bubble fits the screen, words in French or English find the right button, "Show me" opens its tab with the numbered
// glow, the person's own tab comes back after the ribbon is read, Escape ends the guide, and nonsense offers the
// copilot. Then the tips: one bubble for a selection in Class, "Show me" guides, and the switch turns them off.
// Run after `npm run build`:
//   node scripts/check-want.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4200;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

// What a person types, and a word the button found must contain.
const APPS = [
  ['Office Letter', [['mettre en gras', /bold/i], ['je veux un tableau', /insert table/i], ['imprimer', /print/i], ['table des matières', /contents/i]]],
  ['Office Class', [['faire la somme', /sum/i], ['add a chart', /chart|column|bar|line|pie/i], ['trier du plus petit au plus grand', /sort a to z/i]]],
  ['Office Stage', [['ajouter une transition', /transition|fade|push|wipe|morph/i], ['new slide', /slide/i]]],
  ['Office Code+', [['exécuter le code', /run/i]]],
];
const H = '.app-frame:not([hidden])';

for (const [name, viewport, mobile] of [['PC', { width: 1280, height: 800 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.goto(url);
  for (const [app, queries] of APPS) {
    await page.locator('.tab-new').click().catch(() => {});
    await page.waitForTimeout(200);
    await page.locator(`.slab:has-text("${app}")`).first().click();
    await page.waitForTimeout(900);
    const pill = page.locator(`${H} .want-pill`);
    const pb = await pill.boundingBox();
    check(!!pb && pb.x >= 0 && pb.x + pb.width <= viewport.width, `${name}: ${app}: the "I want…" capsule is in the app bar`);
    const round = await pill.evaluate(el => parseFloat(getComputedStyle(el).borderTopLeftRadius) >= el.offsetHeight / 2 - 1).catch(() => false);
    check(round, `${name}: ${app}: it is a capsule`);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(sw <= viewport.width, `${name}: ${app}: the capsule leaves no sideways scroll (${sw}px)`);
    const tabBefore = await page.locator(`${H} .ribbon-tabs [role=tab][aria-selected=true]`).first().textContent();

    for (const [words, want] of queries) {
      await pill.click();
      const panel = page.locator('.want-panel');
      await panel.waitFor({ timeout: 3000 }).catch(() => {});
      const t0 = Date.now();
      await page.locator('.want-input').fill(words);
      await page.locator('.want-go, .want-results .want-note').first().waitFor({ timeout: 4000 }).catch(() => {});
      const ms = Date.now() - t0;
      const bb = await panel.boundingBox();
      check(!!bb && bb.x >= 0 && bb.x + bb.width <= viewport.width + 1 && bb.y + bb.height <= viewport.height + 1, `${name}: ${app}: the bubble fits the screen`);
      check(ms < 3000, `${name}: ${app}: "${words}" answers fast (${ms} ms)`);
      const back = await page.locator(`${H} .ribbon-tabs [role=tab][aria-selected=true]`).first().textContent();
      check(back === tabBefore, `${name}: ${app}: reading the buttons gives the person's tab back (${tabBefore} -> ${back})`);
      const go = page.locator('.want-go');
      if (!await go.count()) { check(false, `${name}: ${app}: "${words}" finds buttons`); await page.keyboard.press('Escape'); continue; }
      await go.click();
      await page.waitForTimeout(500);
      const glowing = await page.locator('.want-glow').evaluateAll(els => els.map(e => e.getAttribute('aria-label') || e.textContent?.trim()));
      check(glowing.some(g => want.test(g ?? '')), `${name}: ${app}: "${words}" shows the right button (${glowing.join(', ')})`);
      const steps = await page.locator('.want-step').count();
      check(steps >= 1 && steps <= 5, `${name}: ${app}: the buttons are numbered (${steps})`);
      const gb = await page.locator('.want-guide').boundingBox();
      check(!!gb && gb.x >= 0 && gb.x + gb.width <= viewport.width + 1, `${name}: ${app}: the steps in words fit the screen`);
      const first = page.locator('.want-glow').first();
      // The ribbon scrolls the button into view smoothly: give it time on slow machines (CI) before measuring.
      const inView = async () => { const b = await first.boundingBox(); return !!b && b.x >= -1 && b.x + b.width <= viewport.width + 1 && b.y >= 0; };
      for (let i = 0; i < 20 && !(await inView()); i++) await page.waitForTimeout(100);
      const fb = await first.boundingBox();
      check(!!fb && fb.x >= -1 && fb.x + fb.width <= viewport.width + 1 && fb.y >= 0, `${name}: ${app}: the first button is in view`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      check(await page.locator('.want-glow, .want-guide').count() === 0, `${name}: ${app}: Escape ends the guide`);
      await page.locator(`${H} .ribbon-tabs [role=tab]`).filter({ hasText: tabBefore ?? '' }).first().click().catch(() => {});
      await page.waitForTimeout(150);
    }

    if (app === 'Office Letter') {
      // Two things in one request: two numbered steps, in order.
      await pill.click();
      await page.locator('.want-input').fill('gras et italique');
      await page.locator('.want-go').waitFor({ timeout: 4000 }).catch(() => {});
      await page.locator('.want-go').click().catch(() => {});
      await page.waitForTimeout(500);
      const two = await page.locator('.want-glow').evaluateAll(els => els.map(e => e.getAttribute('aria-label') || e.textContent?.trim()));
      check(two.length === 2 && /bold/i.test(two.join()) && /italic/i.test(two.join()), `${name}: "gras et italique" numbers Bold then Italic (${two.join(', ')})`);
      await page.locator(`${H} .want-glow`).first().click().catch(() => {});
      await page.waitForTimeout(300);
      check(await page.locator('.want-step.done').count() === 1, `${name}: pressing step 1 marks it done`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // Words that mean nothing: no wrong button, the copilot is offered.
    await pill.click();
    await page.locator('.want-input').fill('zqxjvw');
    await page.waitForTimeout(400);
    check(await page.locator('.want-go').count() === 0 && await page.locator('.want-ai').count() === 1, `${name}: ${app}: nonsense finds nothing and offers the copilot`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(await page.locator('.want-panel').count() === 0, `${name}: ${app}: Escape closes the bubble`);
  }

  // Tips: a selection of several cells in Class brings one bubble; "Show me" guides to AutoSum.
  const tabs = page.locator('.tabs .tab');
  await tabs.nth(1).click();
  await page.waitForTimeout(500);
  const nameBox = page.locator(`${H} .name-box`);
  await nameBox.fill('A1:B4');
  await nameBox.press('Enter');
  const tip = page.locator(`${H} .tip-bubble`);
  await tip.waitFor({ timeout: 8000 }).catch(() => {});
  check(await tip.count() === 1, `${name}: a selection of cells brings one suggestion bubble`);
  const tb = await tip.boundingBox();
  check(!!tb && tb.x >= 0 && tb.x + tb.width <= viewport.width + 1 && tb.y + tb.height <= viewport.height + 1, `${name}: the bubble fits the screen`);
  check(await page.locator('.tip-bubble').count() === 1, `${name}: only one bubble at a time`);
  await tip.locator('.tip-show').click().catch(() => {});
  await page.waitForTimeout(800);
  const glow = await page.locator('.want-glow').evaluateAll(els => els.map(e => e.getAttribute('aria-label') || e.textContent?.trim()));
  check(glow.some(g => /sum/i.test(g ?? '')), `${name}: "Show me" numbers the sum button (${glow.join(', ')})`);
  await page.keyboard.press('Escape');
  // The switch turns the suggestions off, and it is remembered.
  await page.locator(`${H} .want-pill`).click();
  await page.locator('.want-tips-switch').click();
  const off = await page.evaluate(() => localStorage.getItem('oi1.tips.on'));
  check(off === '0', `${name}: the switch turns the suggestions off (${off})`);
  await page.keyboard.press('Escape');
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
