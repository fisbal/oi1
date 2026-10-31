// Every word stays readable (Martin, 2026-10-31: a memo opened on a black page, its yellow fields in white text).
// Opens every Doc adm/Mil letter and CV, then the memo in every Design theme, and measures the contrast of each
// piece of text against what is really behind it (page, highlight, table cell), like WCAG: at least 4.5:1, or 3:1
// for large text. Run after `npm run build`:
//   node scripts/check-contrast.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4187;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [];
let docs = 0, pieces = 0;

/** The pieces of text in the letter whose contrast is too low, with what they read against. */
const lowContrast = page => page.evaluate(() => {
  const rgb = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const out = [];
  let n = 0;
  const walker = document.createTreeWalker(document.querySelector('.module-host:not([hidden]) .body-text'), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (!text) continue;
    const el = node.parentElement;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = [...range.getClientRects()].find(r => r.width > 2 && r.height > 2);
    if (!rect || rect.bottom < 0 || rect.top > innerHeight) continue;
    const style = getComputedStyle(el);
    const ink = rgb(style.color);
    if (!ink || ink.a === 0 || style.visibility === 'hidden') continue;
    // What is really behind the words: the first painted layer under their middle.
    // The pages are painted under the text and let clicks through, so they are found by where they are.
    const x = rect.left + Math.min(rect.width / 2, 6), y = rect.top + rect.height / 2;
    let back = null;
    const stack = document.elementsFromPoint(x, y);
    // Hidden under the ribbon or a panel while scrolled: not on screen, nothing to read.
    if (!stack[0] || !(el.contains(stack[0]) || stack[0].contains(el))) continue;
    for (const under of stack) {
      const bg = rgb(getComputedStyle(under).backgroundColor);
      if (under.classList.contains('sheet') || !under.closest('.sheet')) {
        if (bg && bg.a > 0.5 && under.classList.contains('sheet')) back = bg;
        break;
      }
      if (bg && bg.a > 0.5) { back = bg; break; }
    }
    if (!back) {
      const frame = [...document.querySelectorAll('.module-host:not([hidden]) .page-frame')].find(f => { const r = f.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
      back = (frame && rgb(getComputedStyle(frame).backgroundColor)) || { r: 255, g: 255, b: 255 };
    }
    n++;
    const size = parseFloat(style.fontSize), bold = Number(style.fontWeight) >= 600;
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    const r = ratio(ink, back);
    if (r < need) out.push(`"${text.slice(0, 30)}" ${style.color} on rgb(${back.r}, ${back.g}, ${back.b}) = ${r.toFixed(2)}:1 (needs ${need})`);
  }
  return { n, out };
});

async function measure(page, what) {
  await page.waitForTimeout(350);
  // Check the top of the letter and further down too.
  for (const y of [0, 700]) {
    await page.evaluate(top => document.querySelector('.module-host:not([hidden]) .letter-body')?.scrollTo?.(0, top), y);
    await page.waitForTimeout(80);
    const { n, out } = await lowContrast(page);
    pieces += n;
    for (const o of out.slice(0, 3)) problems.push(`${what}: ${o}`);
  }
  docs++;
}

async function run(scheme) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', colorScheme: scheme });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`script error: ${e.message}`));
  page.on('dialog', d => d.accept());
  await page.goto(url);
  await page.locator('.slab:has-text("Office Letter")').first().click();
  await page.waitForTimeout(1200);
  const host = page.locator('.module-host:not([hidden])');
  const tab = name => host.locator('.ribbon-tabs [role=tab]', { hasText: name }).first().click();
  const drop = name => host.locator(`.ribbon-panel button[aria-label="${name}"]`).first();
  const items = () => page.locator('.drop-panel .menu-item');

  await tab('Admin/Mil docs');
  for (const name of ['Administrative', 'Government', 'Military', 'Personal', 'CV templates']) {
    await drop(name).click();
    const count = await items().count();
    await page.keyboard.press('Escape');
    for (let i = 0; i < count; i++) {
      await tab('Admin/Mil docs');
      await drop(name).click();
      const label = await items().nth(i).innerText();
      await items().nth(i).click();
      await measure(page, `${scheme} app, ${name} > ${label}`);
    }
  }
  // A memo after the Creative CV (a dark theme) must open on a light page.
  await tab('Admin/Mil docs');
  await drop('CV templates').click();
  await page.locator('.drop-panel .menu-item', { hasText: 'Creative CV' }).click();
  await page.waitForTimeout(300);
  await drop('Military').click();
  await page.locator('.drop-panel .menu-item', { hasText: 'Memorandum' }).first().click();
  await page.waitForTimeout(400);
  const pageDark = await page.evaluate(() => {
    const m = getComputedStyle(document.querySelector('.module-host:not([hidden]) .page-frame')).backgroundColor.match(/\d+/g).map(Number);
    return 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2] < 128;
  });
  if (pageDark) problems.push(`${scheme} app: a memo opened after the Creative CV is still on a dark page`);
  // The memo, with its yellow fields, in every theme.
  await tab('Design');
  const themes = host.locator('[data-gallery="Themes"] button');
  const nThemes = await themes.count();
  for (let i = 0; i < nThemes; i++) {
    const name = (await themes.nth(i).getAttribute('aria-label')) ?? (await themes.nth(i).innerText()).split('\n')[0];
    await themes.nth(i).click();
    await measure(page, `${scheme} app, memo in theme ${name}`);
  }
  await ctx.close();
}

try {
  await run('light');
  await run('dark');
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already stopped */ }
}
if (problems.length) {
  console.log(`${problems.length} problems:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`All text readable: ${docs} documents and themes, ${pieces} pieces of text, in light and dark app modes.`);
