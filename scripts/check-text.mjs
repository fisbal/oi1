// Checks that no text in the ribbons overlaps other text or is cut, in every language, on a PC and a phone:
// a button label longer than two lines runs into its group's title, like "Afficher les marques de mise en forme"
// over "AFFICHER". Then the same for what people write in their documents (Martin, 2026-10-30, a two-line
// Stage title "Hello / how are you doing" with its letters cut): a slide title, its thumbnail, Letter lines and
// Class cells, on several lines, with tall and hanging letters (É, j, g, y), in every bundled font. Each letter's
// ink is measured, so a letter cut by its box or touching the line above fails. Writes screens/text.json.
// Run after `npm run build`:
//   node scripts/check-text.mjs

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4185;
const APPS = ['Letter', 'Class', 'Stage', 'Code+', 'Draw'];
const LOCALES = ['en-US', 'fr-FR', 'es-ES', 'pt-BR', 'de-DE'];
const SCREENS = [
  { name: 'pc', viewport: { width: 1440, height: 900 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

// Its own process group, so stopping it stops vite too (killing npx alone leaves vite serving the port).
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
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

// In the page: letters under `selector` whose ink is cut by a box that hides overflow, or touches a letter of the
// line above. The ink comes from the font itself (canvas measureText), not from the line's box.
function inkProblems(selector) {
  const out = [];
  const canvas = document.createElement('canvas').getContext('2d');
  for (const root of document.querySelectorAll(selector)) {
    if (!root.offsetParent) continue;
    const glyphs = [];
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
      const el = node.parentElement, cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
      canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      // Zoomed boxes (fitted slide text, thumbnails) draw the font bigger or smaller than its CSS size.
      const range = document.createRange();
      for (let i = 0; i < node.length; i++) {
        const ch = node.data[i];
        if (!ch.trim()) continue;
        range.setStart(node, i); range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect();
        if (r.width < 0.3 || r.height < 0.3) continue;
        const m = canvas.measureText(ch);
        const k = r.height / (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent);
        const base = r.bottom - m.fontBoundingBoxDescent * k;
        glyphs.push({ ch, el, left: r.left, right: r.right, top: base - m.actualBoundingBoxAscent * k, bottom: base + m.actualBoundingBoxDescent * k, line: Math.round(base), size: r.height });
      }
    }
    // Cut: ink outside a box that hides what overflows (up to the document's page or slide).
    const clips = new Map();
    const clipOf = el => {
      if (!clips.has(el)) {
        const boxes = [];
        for (let a = el; a && a !== document.body; a = a.parentElement) {
          const cs = getComputedStyle(a);
          if (/hidden|clip/.test(cs.overflowY)) boxes.push(Object.assign(a.getBoundingClientRect().toJSON(), { who: String(a.className).split(' ')[0] || a.tagName }));
        }
        clips.set(el, boxes);
      }
      return clips.get(el);
    };
    const said = new Set();
    for (const g of glyphs) {
      for (const c of clipOf(g.el)) {
        // Only letters that are meant to show: some of the line inside the box, but its ink sticking out.
        if (g.bottom < c.top || g.top > c.bottom || g.right < c.left || g.left > c.right) continue;
        const cut = Math.max(c.top - g.top, g.bottom - c.bottom);
        if (cut > Math.max(0.6, g.size * 0.03)) {
          const key = `cut ${g.ch} ${g.el.style.fontFamily || getComputedStyle(g.el).fontFamily}`;
          if (!said.has(key)) { said.add(key); out.push(`“${g.ch}” is cut by ${cut.toFixed(1)}px at .${c.who} (${getComputedStyle(g.el).fontFamily.split(',')[0]})`); }
        }
      }
    }
    // Touching: a letter's ink running into a letter of the line above it, in the same block.
    const lines = [...new Set(glyphs.map(g => g.line))].sort((a, b) => a - b);
    for (let i = 1; i < lines.length; i++) {
      const above = glyphs.filter(g => g.line === lines[i - 1]), below = glyphs.filter(g => g.line === lines[i]);
      for (const a of above) for (const b of below) {
        if (a.el.closest('p,li,h1,h2,h3,h4,h5,h6,td,div') !== b.el.closest('p,li,h1,h2,h3,h4,h5,h6,td,div') && a.el.closest('.st-html,.ProseMirror') !== b.el.closest('.st-html,.ProseMirror')) continue;
        const wide = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5;
        if (wide && a.bottom > b.top + 0.5) {
          const key = `touch ${a.ch}${b.ch}`;
          if (!said.has(key)) { said.add(key); out.push(`“${a.ch}” touches “${b.ch}” on the next line (${getComputedStyle(a.el).fontFamily.split(',')[0]})`); }
        }
      }
    }
  }
  return out;
}

const FONT_LIST = [...readFileSync('src/ui/fonts.ts', 'utf8').matchAll(/css: '([^']+)', kind: '[a-z]+'(?:, lh: ([\d.]+))?/g)];
const FONTS = FONT_LIST.map(m => m[1]);
const LH = Object.fromEntries(FONT_LIST.map(m => [m[1], Number(m[2] ?? 0)]));
const SAMPLE = ['Hello Éloïse', 'how are you doing jgpqy', 'ÂÊÎ Ç gÿ'];

async function documentText(screen) {
  let ctx, page;
  // Each app in a fresh browser, as a person opening it from the home screen.
  const open = async app => {
    await ctx?.close();
    ctx = await browser.newContext({ viewport: screen.viewport, isMobile: screen.isMobile, hasTouch: screen.hasTouch, locale: 'en-US' });
    page = await ctx.newPage();
    page.on('dialog', d => d.dismiss());
    await page.goto(url);
    await page.waitForTimeout(400);
    await page.locator(`.slab:has-text("In 1 ${app}")`).first().click();
    await page.waitForTimeout(1200);
  };
  const typeLines = async () => { for (let i = 0; i < SAMPLE.length; i++) { if (i) await page.keyboard.press('Enter'); await page.keyboard.type(SAMPLE[i]); } };
  // Every bundled font, set where the app takes it from; the text stays the same.
  const eachFont = async (app, where, selector, setFont) => {
    for (const font of FONTS) {
      await page.evaluate(([f, lh, set]) => { new Function('font', 'lh', set)(f, lh); return document.fonts.load(`40px "${f}"`, 'HgjÉ'); }, [font, LH[font], setFont]);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(30);
      for (const p of await page.evaluate(inkProblems, selector)) problems.push(`${screen.name} ${app} document, ${font}: ${p}`);
    }
  };
  try {
    // Stage: a two-line title (Martin's case) and three lines of text, on the slide and in the thumbnails.
    await open('Stage');
    const items = page.locator('.module-host:not([hidden]) .st-canvas .st-item');
    await items.first().click(); await page.waitForTimeout(200);
    await page.keyboard.press('Control+a'); await typeLines();
    if (await items.count() > 1) { await items.nth(1).click(); await page.waitForTimeout(200); await page.keyboard.press('Control+a'); await typeLines(); }
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    const canvas = await page.locator('.module-host:not([hidden]) .st-canvas').boundingBox();
    await page.mouse.click(canvas.x + 4, canvas.y + canvas.height - 4); await page.waitForTimeout(300);
    await eachFont('Stage', '', '.module-host:not([hidden]) .st-canvas .st-html, .module-host:not([hidden]) .st-thumb .st-html',
      "for (const s of document.querySelectorAll('.module-host:not([hidden]) .st-slide')) { s.style.setProperty('--st-head', `\"${font}\"`); s.style.setProperty('--st-body', `\"${font}\"`); s.style.setProperty('--st-head-lh', lh); s.style.setProperty('--st-body-lh', lh); }");
    // Letter: three lines in the body.
    await open('Letter');
    const body = page.locator('.module-host:not([hidden]) .body-text');
    await body.click(); await page.keyboard.press('Control+End'); await page.waitForTimeout(150);
    await page.keyboard.press('Enter'); await typeLines();
    await eachFont('Letter', '', '.module-host:not([hidden]) .body-text',
      "document.querySelector('.module-host:not([hidden]) .body-text').style.fontFamily = `\"${font}\"`");
    // Class: the same words in cells.
    await open('Class');
    const area = await page.locator('.module-host:not([hidden]) .cells-area').boundingBox();
    await page.mouse.click(area.x + 140, area.y + 50);
    for (const line of SAMPLE) { await page.keyboard.type(line); await page.keyboard.press('Enter'); }
    await page.waitForTimeout(200);
    await eachFont('Class', '', '.module-host:not([hidden]) .cells-area',
      "document.querySelector('.module-host:not([hidden]) .cells-area').style.fontFamily = `\"${font}\"`");
    await page.screenshot({ path: `screens/text-${screen.name}-class.png` });
  } finally { await ctx?.close(); }
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
        const slab = page.locator(`.slab:has-text("In 1 ${app}")`);
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
  for (const screen of SCREENS) await documentText(screen);
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { server.kill(); }
}
const unique = [...new Set(problems)];
writeFileSync('screens/text.json', JSON.stringify(unique, null, 1));
if (unique.length) {
  console.error(`${unique.length} text problems:\n${unique.map(p => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`No text overlaps or is cut: ${checked} ribbon tabs checked in ${LOCALES.length} languages on PC and phone, and Stage, Letter and Class documents in ${FONTS.length} fonts.`);
