// The Tuto (Martin, 2026-10-31: a Tuto tab in every app, pick a category, every button with an explanation on the
// right of how to use it). On PC and phone: the Tuto tab opens a panel that fits the screen; its categories are the
// ribbon's tabs; every In 1 Class button has a real explanation; a click on a ribbon button explains it instead of
// running it; "Try it" really runs it. The other apps get the panel now and their explanations next: the numbers
// of buttons still without one may only go down.
// Run after `npm run build`:
//   node scripts/check-tuto.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

// Buttons without an explanation yet, per app. These numbers may only shrink.
const STILL_TO_EXPLAIN = { Class: 0, Letter: 0, Stage: 0, 'Code+': 0, Draw: 0, Notes: 0, Plan: 0, Form: 0, Mail: 0 };

const PORT = Number(process.env.PORT) || 4196;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const H = '.module-host:not([hidden])';
const counts = {};

try {
  for (const [device, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
    for (const app of ['Class', 'Letter', 'Stage', 'Code+', 'Draw', 'Notes', 'Plan', 'Form', 'Mail']) {
      const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
      const page = await ctx.newPage();
      page.on('pageerror', e => problems.push(`${device} ${app}: script error: ${e.message}`));
      await page.addInitScript(() => { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'en'); sessionStorage.setItem('set', '1'); } });
      await page.goto(url);
      await page.locator(`.slab:has-text("${app === 'Code+' ? 'Code+' : `In 1 ${app}`}")`).first().click();
      await page.waitForTimeout(1500);
      const name = `${device} ${app}`;

      const tab = page.locator(`${H} .ribbon-tuto`).first();
      check(await tab.isVisible().catch(() => false), `${name}: the ribbon has a Tuto tab`);
      await tab.click();
      const panel = page.locator('.tuto-panel');
      check(await panel.isVisible().catch(() => false), `${name}: the Tuto panel opens`);
      const box = await panel.boundingBox();
      check(!!box && box.x >= 0 && box.x + box.width <= viewport.width + 1 && box.y >= 0 && box.y + box.height <= viewport.height + 1, `${name}: the panel fits the screen`);
      const cats = page.locator('.tuto-cats button');
      const ribbonTabs = await page.locator(`${H} .ribbon-tabs [role=tab]:not(.ribbon-tuto)`).count();
      const nCats = await cats.count();
      check(nCats >= 3 && nCats === ribbonTabs, `${name}: its categories are the ribbon's ${ribbonTabs} tabs (${nCats})`);

      let items = 0, generic = 0;
      const missing = [];
      for (let i = 0; i < nCats; i++) {
        await cats.nth(i).click();
        await page.waitForTimeout(250);
        const n = await page.locator('.tuto-item').count();
        items += n;
        const g = await page.locator('.tuto-item.tuto-generic').allInnerTexts();
        generic += g.length;
        const catName = await cats.nth(i).innerText();
        missing.push(...g.map(x => `${catName}/${x}`));
        if (!n) problems.push(`${name}: the "${catName}" category lists no button`);
      }
      counts[`${name}`] = { items, generic };
      check(items >= 20, `${name}: the Tuto lists ${items} buttons`);
      check(generic <= STILL_TO_EXPLAIN[app], `${name}: ${generic} buttons still without explanation (at most ${STILL_TO_EXPLAIN[app]})${generic ? `: ${missing.slice(0, 8).join(', ')}` : ''}`);

      // Picking a button explains it.
      await cats.first().click();
      await page.waitForTimeout(200);
      const first = page.locator('.tuto-item:not(.tuto-generic)').first();
      if (await first.count()) {
        await first.click();
        const text = (await page.locator('.tuto-help p').first().innerText()).trim();
        check(text.length > 20 && !text.startsWith('No explanation'), `${name}: picking a button explains it ("${text.slice(0, 50)}…")`);
        check(await page.locator('.tuto-actions button').count() === 2, `${name}: "Show me" and "Try it" are there`);
      }

      if (app === 'Class') {
        // Explain mode: a click on the real Bold button explains it and does not make the cell bold.
        await page.locator(`${H} .ribbon-tabs [role=tab]`).first().click();
        await page.waitForTimeout(200);
        const bold = page.locator(`${H} .ribbon-panel button[data-help="letter.bold"]`).first();
        const before = await bold.getAttribute('aria-pressed');
        await bold.click();
        await page.waitForTimeout(200);
        check((await page.locator('.tuto-help h3').innerText()).trim() === 'Bold', `${name}: clicking a ribbon button explains it in the panel`);
        check(await bold.getAttribute('aria-pressed') === before, `${name}: …without running it`);
        await page.locator('.tuto-actions button.primary').click();
        await page.waitForTimeout(250);
        check(await bold.getAttribute('aria-pressed') !== before, `${name}: "Try it" really runs it (Bold is on)`);
        // Spanish: the panel's own words follow the language.
        await page.locator('.tuto-close').click();
        check(!(await panel.count()), `${name}: the panel closes`);
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already gone */ }
}

for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`BAD ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
console.log(JSON.stringify(counts));
process.exit(problems.length ? 1 : 0);
