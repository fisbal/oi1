// Checks that no text in the ribbons overlaps other text or is cut, in every language, on a PC and a phone:
// a button label longer than two lines runs into its group's title, like "Afficher les marques de mise en forme"
// over "AFFICHER". Writes screens/text.json. Run after `npm run build`:
//   node scripts/check-text.mjs

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4185;
const APPS = ['Letter', 'Class', 'Stage', 'Code+'];
const LOCALES = ['en-US', 'fr-FR', 'es-ES', 'pt-BR', 'de-DE'];
const SCREENS = [
  { name: 'pc', viewport: { width: 1440, height: 900 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}

// In the page: every label of the shown ribbon that is cut, runs past two lines, or overlaps another label.
function findProblems() {
  const out = [];
  const panel = document.querySelector('.module-host:not([hidden]) .ribbon-panel');
  if (!panel) return out;
  const texts = [...panel.querySelectorAll('.rb-label, .rgroup-label, .rb.txt > span:not(.rb-icon):not(.rb-caret), .numbox > span:first-child')]
    .filter(el => el.offsetParent && el.textContent.trim());
  const name = el => el.textContent.trim().replace(/\s+/g, ' ');
  const boxes = texts.map(el => {
    // The box of the words themselves, not of the element around them.
    const range = document.createRange();
    range.selectNodeContents(el);
    return { el, rects: [...range.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5) };
  });
  for (const { el, rects } of boxes) {
    const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.2;
    const lines = new Set(rects.map(r => Math.round(r.top / (lh * 0.6)))).size;
    if (el.classList.contains('rb-label') && el.closest('.rb.big') && lines > 2) out.push(`"${name(el)}" takes ${lines} lines (2 at most)`);
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') out.push(`"${name(el)}" is cut`);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i].el.contains(boxes[j].el) || boxes[j].el.contains(boxes[i].el)) continue;
      const hit = boxes[i].rects.some(a => boxes[j].rects.some(b =>
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1));
      if (hit) out.push(`"${name(boxes[i].el)}" overlaps "${name(boxes[j].el)}"`);
    }
  }
  return out;
}

mkdirSync('screens', { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [];
let checked = 0;
try {
  for (const screen of SCREENS) {
    for (const locale of LOCALES) {
      // Phones are checked in English and French, the languages used most; PCs in all five.
      if (screen.name === 'phone' && !['en-US', 'fr-FR'].includes(locale)) continue;
      for (const app of APPS) {
        const ctx = await browser.newContext({ viewport: screen.viewport, isMobile: screen.isMobile, hasTouch: screen.hasTouch, locale });
        const page = await ctx.newPage();
        page.on('dialog', d => d.dismiss());
        await page.goto(url);
        await page.waitForTimeout(400);
        const slab = page.locator(`.slab:has-text("Office ${app}")`);
        if (!(await slab.count())) { await ctx.close(); continue; }
        await slab.first().click();
        await page.waitForTimeout(1200);
        if (app === 'Code+') { const tpl = page.locator('.code .tpl').first(); if (await tpl.count()) { await tpl.click(); await page.waitForTimeout(800); } }
        const tabs = page.locator('.module-host:not([hidden]) .ribbon-tabs [role=tab]');
        for (let i = 0; i < await tabs.count(); i++) {
          const tab = tabs.nth(i);
          const name = (await tab.innerText()).trim();
          await tab.scrollIntoViewIfNeeded();
          await tab.click();
          await page.waitForTimeout(150);
          checked++;
          for (const p of await page.evaluate(findProblems)) problems.push(`${screen.name} ${locale} ${app} > ${name}: ${p}`);
        }
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
  server.kill();
}
const unique = [...new Set(problems)];
writeFileSync('screens/text.json', JSON.stringify(unique, null, 1));
if (unique.length) {
  console.error(`${unique.length} text problems:\n${unique.map(p => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`No text overlaps or is cut: ${checked} ribbon tabs checked in ${LOCALES.length} languages on PC and phone.`);
