// Checks that every app fits phones, tablets, PCs and Macs: no sideways scrolling of the page, documents
// inside the screen, and enough room left for the work under the ribbon. Saves a screenshot of each in
// screens/ (uploaded by CI, so the looks can be checked too). Run after `npm run build`:
//   node scripts/check-screens.mjs
// Exits with an error when something does not fit.

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4183;
const SIZES = [
  { name: 'phone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'phone-landscape', viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'tablet-landscape', viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'pc', viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  { name: 'mac', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
];
// Apps that run inside OI1 itself (ProDFos is its own site, checked in its own repository).
const APPS = ['home', 'Letter', 'Class', 'Stage', 'Code+'];

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}

mkdirSync('screens', { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [];
try {
  for (const size of SIZES) {
    for (const app of APPS) {
      const ctx = await browser.newContext({ ...size, name: undefined, locale: 'fr-FR' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(url);
      await page.waitForTimeout(400);
      if (app !== 'home') {
        const slab = page.locator(`.slab:has-text("Office ${app}")`);
        if (!(await slab.count()) || await slab.first().evaluate(el => el.classList.contains('soon') || el.hasAttribute('disabled'))) { await ctx.close(); continue; }
        await slab.first().click();
        await page.waitForTimeout(1200);
        if (app === 'Code+') { const tpl = page.locator('.code .tpl').first(); if (await tpl.count()) { await tpl.click(); await page.waitForTimeout(1000); } }
      }
      const r = await page.evaluate(() => {
        const vw = window.innerWidth, vh = window.innerHeight;
        const out = { overflow: document.scrollingElement.scrollWidth - vw, issues: [] };
        const pageEl = document.querySelector('.page-frame') ?? document.querySelector('.sheet.web-layout');
        if (pageEl) {
          const b = pageEl.getBoundingClientRect();
          if (b.left < -1 || b.right > vw + 1) out.issues.push(`the page is wider than the screen (${Math.round(b.left)}…${Math.round(b.right)} of ${vw})`);
        }
        const slide = document.querySelector('.st-canvas');
        if (slide) {
          const b = slide.getBoundingClientRect();
          if (b.left < -1 || b.right > vw + 1) out.issues.push(`the slide is wider than the screen (${Math.round(b.width)} of ${vw})`);
          if (b.width < vw * 0.4) out.issues.push(`the slide is too small to work on (${Math.round(b.width)}px of ${vw})`);
        }
        const ribbon = document.querySelector('.ribbon');
        if (ribbon) {
          const bottom = ribbon.getBoundingClientRect().bottom;
          if (vh - bottom < vh * 0.5) out.issues.push(`only ${Math.round(vh - bottom)}px of ${vh} left under the ribbon`);
        }
        return out;
      });
      if (r.overflow > 1) problems.push(`${size.name} ${app}: the page scrolls sideways by ${r.overflow}px`);
      for (const i of r.issues) problems.push(`${size.name} ${app}: ${i}`);
      for (const e of errors) problems.push(`${size.name} ${app}: script error: ${e}`);
      await page.screenshot({ path: `screens/${size.name}-${app.replace('+', 'plus')}.png` });
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}

if (problems.length) {
  console.error(`Screens that do not fit:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`All apps fit on ${SIZES.map(s => s.name).join(', ')}.`);
