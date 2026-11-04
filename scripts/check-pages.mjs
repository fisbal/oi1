// Pages in In 1 Letter cut long paragraphs like Word (Martin, 2026-11-04: on his 13-page work a line sat between two
// pages, and the text ran into the margins). A paragraph longer than a page, and a paragraph that reaches the bottom
// of a page, are cut between two lines: two lines at least stay on each page, no line ever sits in the gap between
// pages or in a margin, the cut stays put (no jumping), it follows typing, and the printed PDF has the same pages.
// Checked on PC, Mac, tablet both ways and phone sideways.
// Run after `npm run build`:
//   node scripts/check-pages.mjs

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4232;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

const DEVICES = [
  { name: 'Windows PC', viewport: { width: 1366, height: 768 }, pdf: true },
  { name: 'Mac', viewport: { width: 1440, height: 900 } },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, mobile: true },
  { name: 'tablet sideways', viewport: { width: 1180, height: 820 }, mobile: true },
  { name: 'phone sideways', viewport: { width: 844, height: 390 }, mobile: true },
];
const P = '.module-host:not([hidden])';
const BODY = `${P} .sheet .ProseMirror:not(.header-text):not(.footer-text)`;
const S = 'Cette phrase explique une partie du cas avec assez de mots pour remplir une ligne entière de la page du travail.';
const para = n => Array.from({ length: n }, () => S).join(' ');
// A short opening, a paragraph longer than a page, short ones, then paragraphs that reach the bottom of pages.
const HTML = [
  '<p>Introduction</p>', `<p>${para(4)}</p>`, `<p>${para(60)}</p>`, '<p>Étape 2 :</p>',
  ...Array.from({ length: 10 }, (_, i) => `<p>Partie ${i + 1}</p><p>${para(9 + (i % 4) * 3)}</p>`),
  '<p>FIN-DU-TRAVAIL</p>',
].join('');

// Every line of text, on its page or not; and every cut paragraph with the lines on each side of its cut.
const scan = page => page.evaluate(b => {
  const body = document.querySelector(b);
  const frames = [...document.querySelectorAll('.module-host:not([hidden]) .page-frame')].map(f => f.getBoundingClientRect());
  const sheet = body.closest('.sheet');
  const scale = sheet ? sheet.getBoundingClientRect().width / sheet.offsetWidth : 1;
  const st = getComputedStyle(sheet);
  const mt = parseFloat(st.getPropertyValue('--mt')) * scale || 0, mb = parseFloat(st.getPropertyValue('--mb')) * scale || 0;
  const out = [];
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement?.closest('.pg-spacer') ? 2 : 1) });
  const range = document.createRange();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.data.trim()) continue;
    range.selectNodeContents(t);
    for (const r of range.getClientRects()) {
      if (r.height < 3 || r.width < 2) continue;
      const ok = frames.some(f => r.top >= f.top + mt - 3 && r.bottom <= f.bottom - mb + 3);
      if (!ok) out.push(t.data.slice(0, 30));
    }
  }
  const cuts = [...body.querySelectorAll('.pg-inline')].map(sp => {
    const p = sp.closest('p');
    const sr = sp.getBoundingClientRect();
    const tops = new Set();
    const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement?.closest('.pg-spacer') ? 2 : 1) });
    for (let t = w.nextNode(); t; t = w.nextNode()) { range.selectNodeContents(t); for (const r of range.getClientRects()) if (r.height > 3) tops.add(Math.round((r.top + r.bottom) / 2)); }
    const all = [...tops].sort((a, z) => a - z);
    return { before: all.filter(x => x < sr.top).length, after: all.filter(x => x > sr.bottom).length };
  });
  const spacers = [...body.querySelectorAll('.pg-spacer')].map(s => Math.round(s.getBoundingClientRect().top - body.getBoundingClientRect().top));
  return { off: [...new Set(out)], cuts, spacers, frames: frames.length, print: !!sheet?.classList.contains('print-layout') };
}, BODY);

for (const d of DEVICES) {
  const n = d.name;
  const ctx = await browser.newContext({ viewport: d.viewport, isMobile: !!d.mobile, hasTouch: !!d.mobile, locale: 'fr-CA' });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${n}: script error: ${e.message}`));
  await page.addInitScript(() => { try { localStorage.setItem('oi1:language', 'fr'); } catch { /* */ } });
  try {
    await page.goto(url);
    await page.locator('.slab:has-text("In 1 Letter")').first().click();
    const body = page.locator(BODY).first();
    await body.waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);
    await body.click();
    await body.evaluate((el, html) => { const dt = new DataTransfer(); dt.setData('text/html', html); dt.setData('text/plain', 'x'); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, HTML);
    await page.waitForTimeout(1500);
    let r = await scan(page);
    if (!r.print) { check(true, `${n}: web layout (no pages on this screen)`); continue; }
    // The text's language is known (French here), so words are cut at line ends with French rules; lines are weighed
    // for the whole paragraph (no word alone on the last line).
    const look = await page.evaluate(b => { const el = document.querySelector(b); const p = el.querySelector('p'); return { lang: el.closest('[lang]')?.getAttribute('lang'), wrap: getComputedStyle(p).textWrapStyle || getComputedStyle(p).textWrap }; }, BODY);
    check(look.lang === 'fr' && /pretty/.test(String(look.wrap)), `${n}: the text is known as French and its lines are weighed like LaTeX (${JSON.stringify(look)})`);
    check(r.cuts.length >= 3, `${n}: long paragraphs are cut between two pages (${r.cuts.length} cuts)`);
    check(r.off.length === 0, `${n}: no line sits between two pages or in a margin (${r.off.slice(0, 3).join(' | ')})`);
    check(r.cuts.every(c => c.before >= 2 && c.after >= 2), `${n}: at least two lines stay on each side of every cut (${JSON.stringify(r.cuts)})`);
    // The cuts stay where they are (measured again after a while, nothing moves).
    await page.waitForTimeout(800);
    const again = await scan(page);
    check(JSON.stringify(again.spacers) === JSON.stringify(r.spacers), `${n}: the pages stay still (no jumping)`);
    // Typing at the top moves the text down: the cuts follow, still no line out of its page.
    await body.evaluate(el => { const p = el.querySelector('p'); const s = window.getSelection(); s.collapse(p, 0); });
    await page.keyboard.type('Une ligne de plus. ');
    await page.keyboard.press('Enter');
    await page.keyboard.type(para(2).slice(0, 180));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    r = await scan(page);
    check(r.off.length === 0, `${n}: after typing at the top, still no line out of its page (${r.off.slice(0, 3).join(' | ')})`);
    check(r.cuts.every(c => c.before >= 2 && c.after >= 2), `${n}: after typing, two lines or more on each side of every cut`);
    if (d.pdf) {
      const pages = Number((await page.locator(`${P} .status`).first().innerText()).match(/sur (\d+)/)?.[1]);
      await page.emulateMedia({ media: 'print' });
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
      const printed = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      await page.emulateMedia({ media: 'screen' });
      check(printed === pages, `${n}: the printed PDF has the same pages as the screen (${printed} printed, ${pages} on screen)`);
    }
  } catch (e) {
    problems.push(`${n}: stopped: ${String(e.message ?? e).split('\n')[0]}`);
  } finally { await ctx.close(); }
}

await browser.close();
try { process.kill(-server.pid); } catch { /* gone */ }
for (const p of passed) console.log(`✓ ${p}`);
for (const p of problems) console.log(`✗ ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
if (problems.length) process.exit(1);
