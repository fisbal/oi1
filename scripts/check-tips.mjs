// Checks the capsule bubbles (Martin, 2026-11-01): pointing at a button with a title shows the oval bubble in the
// theme colours instead of the grey system box, in every app, light and dark, on a Windows PC and a Mac; the title
// comes back when the pointer leaves; phones show no bubble on a tap.
// Run after `npm run build`:
//   node scripts/check-tips.mjs

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4215;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const APPS = ['In 1 Letter', 'In 1 Class', 'In 1 Stage', 'In 1 Draw', 'In 1 Notes', 'In 1 Plan', 'In 1 Form'];

try {
  for (const [name, viewport, theme] of [['Windows PC dark', { width: 1366, height: 768 }, 'dark'], ['Mac light', { width: 1440, height: 900 }, 'light']]) {
    const ctx = await browser.newContext({ viewport, locale: 'en-US' });
    const page = await ctx.newPage();
    page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
    await page.addInitScript(t => { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'en'); localStorage.setItem('oi1:theme', t); sessionStorage.setItem('set', '1'); } }, theme);
    await page.goto(url);
    await page.waitForTimeout(500);
    for (const app of APPS) {
      await page.locator('.brand').click();
      await page.waitForTimeout(250);
      const slab = page.locator(`.slab:not([disabled]):has-text("${app}")`).first();
      if (!(await slab.count())) continue;
      await slab.click();
      await page.waitForTimeout(1200);
      const btn = page.locator('.module-host:not([hidden]) .ribbon-quick [title]:not([disabled]):visible, .module-host:not([hidden]) .ribbon-panel [title]:not([disabled]):visible').first();
      if (!(await btn.count())) { problems.push(`${name} ${app}: no button with a title to point at`); continue; }
      const text = await btn.getAttribute('title');
      await btn.hover();
      await page.waitForTimeout(700);
      const tip = page.locator('.oi1-tip.on');
      check(await tip.isVisible(), `${name} ${app}: pointing at a button shows the capsule bubble`);
      if (await tip.count()) {
        check((await tip.textContent()) === text, `${name} ${app}: the bubble says the button's name (${text})`);
        const s = await tip.evaluate(e => { const c = getComputedStyle(e), r = e.getBoundingClientRect(); return { rad: parseFloat(c.borderTopLeftRadius), h: r.height, x: r.left, w: r.width }; });
        check(s.rad >= s.h / 2 - 1, `${name} ${app}: the bubble is an oval capsule`);
        check(s.x >= 0 && s.x + s.w <= viewport.width, `${name} ${app}: the bubble is on screen`);
      }
      check((await page.locator('.module-host:not([hidden]) [data-oi1-tip]').count()) === 1, `${name} ${app}: the grey system box is held back while pointing`);
      await page.mouse.move(5, viewport.height - 5);
      await page.waitForTimeout(200);
      check(!(await page.locator('.oi1-tip.on').count()), `${name} ${app}: the bubble goes when the pointer leaves`);
      check(!(await page.locator('[data-oi1-tip]').count()) && (await btn.getAttribute('title')) === text, `${name} ${app}: the title is back after leaving`);
    }
    // The "All open documents" counter in the top bar (Martin's screenshot)
    await page.locator('.tabs-all').hover();
    await page.waitForTimeout(700);
    check((await page.locator('.oi1-tip.on').textContent().catch(() => '')).startsWith('All open documents'), `${name}: the open documents counter shows its capsule bubble`);
    await page.mouse.move(5, viewport.height - 5);
    await ctx.close();
  }
  // Phone: a tap shows no bubble
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' });
    const page = await ctx.newPage();
    await page.goto(url);
    await page.waitForTimeout(500);
    await page.locator('.slab:has-text("In 1 Letter")').first().tap();
    await page.waitForTimeout(1200);
    await page.locator('button[title]:not([disabled]):visible').first().tap();
    await page.waitForTimeout(700);
    check(!(await page.locator('.oi1-tip.on').count()), 'phone: a tap shows no bubble');
    await ctx.close();
  }
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already stopped */ }
}
for (const p of passed) console.log(`✓ ${p}`);
for (const p of problems) console.log(`✗ ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
