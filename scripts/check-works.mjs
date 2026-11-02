// In 1 Letter's margins and work layouts (Martin, 2026-11-02: "la liste des marges avec du graphisme et cm" and
// "la mise en page des travaux… à sélectionner et automatiquement le travail prend forme"), used like a person would
// in French on every kind of screen (rule 16): a phone upright and sideways, a tablet both ways, a Windows PC, a Mac.
// Margins: 20+ choices, each with its small page drawing and its four sizes in cm, the menu on screen. Work layouts:
// 30+ norms; APA-Provost on an empty letter gives Times 12, double spacing, the 5-space indent, centered level 1
// headings, the parts in order on their own pages, the table of contents filled in and the page number top right;
// MLA on a letter with text keeps the text (Cancel) and only changes the look. Undo brings the text back.
// Run after `npm run build`:
//   node scripts/check-works.mjs

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4218;
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
  { name: 'Windows PC', viewport: { width: 1366, height: 768 } },
  { name: 'Mac', viewport: { width: 1440, height: 900 } },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, mobile: true },
  { name: 'tablet sideways', viewport: { width: 1180, height: 820 }, mobile: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'phone sideways', viewport: { width: 844, height: 390 }, mobile: true },
];
const P = '.module-host:not([hidden])';

async function openDrop(page, key) {
  const b = page.locator(`${P} [data-help="${key}"]:visible`).first();
  if (!(await b.count())) await page.locator(`${P} .ribbon-tabs button:text-is("Mise en page")`).first().click();
  await page.locator(`${P} [data-help="${key}"]:visible`).first().click();
  await page.locator('.drop-panel').first().waitFor({ timeout: 4000 });
}
async function fits(page, sel, vp) {
  const b = await page.locator(sel).first().boundingBox();
  return !!b && b.x >= -1 && b.x + b.width <= vp.width + 1 && b.y >= -1;
}

for (const d of DEVICES) {
  const n = d.name;
  const ctx = await browser.newContext({ viewport: d.viewport, isMobile: !!d.mobile, hasTouch: !!d.mobile, locale: 'fr-CA' });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${n}: script error: ${e.message}`));
  let answer = true;
  page.on('dialog', x => (answer ? x.accept() : x.dismiss()));
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'fr'); sessionStorage.setItem('set', '1'); } } catch { /* */ } });
  try {
    await page.goto(url);
    await page.locator('.slab:has-text("In 1 Letter")').first().click();
    await page.locator(`${P} .body-area .ProseMirror`).first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);

    // ---------- margins: pictures and cm ----------
    await openDrop(page, 'letter.margins');
    const items = page.locator('.margin-item');
    const count = await items.count();
    check(count >= 20, `${n}: ${count} margin choices (20+)`);
    check(await page.locator('.margin-item svg').count() === count, `${n}: every margin choice has its small page drawing`);
    const first = await items.first().innerText();
    check(/Normales/.test(first) && /Haut\s*:\s*2,54 cm/.test(first) && /Gauche\s*:\s*2,54 cm/.test(first) && /Droite/.test(first) && /Bas/.test(first), `${n}: "Normales" shows Haut, Bas, Gauche, Droite in cm (${JSON.stringify(first.replace(/\s+/g, ' ').slice(0, 80))})`);
    check(await fits(page, '.drop-panel', d.viewport), `${n}: the margins menu fits on the screen`);
    const cut = await page.evaluate(() => [...document.querySelectorAll('.margin-item b, .mi-grid span')].filter(e => e.scrollWidth > e.clientWidth + 1).length);
    check(cut === 0, `${n}: no margin text is cut (${cut})`);
    await page.locator('.margin-item:has-text("Étroites")').first().click();
    await openDrop(page, 'letter.margins');
    check(await page.locator('.margin-item[aria-checked="true"]:has-text("Étroites")').count() === 1, `${n}: "Étroites" is now the chosen margins`);
    await page.keyboard.press('Escape');
    await page.locator(`${P} .status`).first().click().catch(() => {});

    // ---------- work layouts ----------
    await openDrop(page, 'letter.works');
    const works = await page.locator('.work-item').count();
    check(works >= 30, `${n}: ${works} work layouts to choose from (30+)`);
    const names = await page.locator('.work-item b').allInnerTexts();
    for (const want of ['APA-Provost', 'APA 7', 'MLA', 'Chicago', 'Harvard', 'IEEE', 'Vancouver', 'McGill', 'Mémoire', 'Thèse', 'Rapport de stage']) check(names.some(x => x.includes(want)), `${n}: ${want} is in the list`);
    check(await fits(page, '.drop-panel', d.viewport), `${n}: the work layouts menu fits on the screen`);
    await page.locator('.work-item[data-work="apaProvost"]').click();
    await page.waitForTimeout(1200);
    const body = page.locator(`${P} .body-area .ProseMirror`).first();
    const look = await body.evaluate(el => {
      const p = [...el.querySelectorAll('p')].find(x => /Votre texte/.test(x.textContent || ''));
      const h1 = [...el.querySelectorAll('h1')].find(x => /Introduction/.test(x.textContent || ''));
      const cs = p ? getComputedStyle(p) : null;
      return {
        font: cs?.fontFamily, size: cs ? parseFloat(cs.fontSize) : 0, line: cs ? parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) : 0,
        indent: cs ? parseFloat(cs.textIndent) : 0, h1: h1 ? getComputedStyle(h1).textAlign : '',
        heads: [...el.querySelectorAll('h1')].map(h => h.textContent), breaks: el.querySelectorAll('[data-type="page-break"], .page-break, hr.page-break, div[data-page-break]').length,
        text: el.textContent || '',
      };
    });
    check(/Times/i.test(look.font ?? ''), `${n}: APA-Provost: the text is in Times New Roman (${look.font})`);
    check(Math.abs(look.size - 16) < 0.6, `${n}: APA-Provost: 12 pt (${look.size}px)`);
    check(Math.abs(look.line - 2) < 0.05, `${n}: APA-Provost: double spacing (${look.line.toFixed(2)})`);
    check(Math.abs(look.indent - 48) < 1, `${n}: APA-Provost: first line indented by 5 spaces (${look.indent}px)`);
    check(look.h1 === 'center', `${n}: APA-Provost: level 1 headings are centered (${look.h1})`);
    const order = ['Table des matières', 'Introduction', 'Conclusion', 'Références', 'Annexes'].map(h => look.heads.findIndex(x => (x || '').includes(h)));
    check(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), `${n}: APA-Provost: the parts are in order (${order.join(', ')})`);
    check(/\[Prénom Nom\]|\[TITRE DU TRAVAIL\]/.test(look.text), `${n}: APA-Provost: the title page has yellow fields to fill`);
    check(!look.text.includes('⟦TOC⟧') && (await body.locator('p:has-text("Introduction")').count()) >= 1, `${n}: APA-Provost: the table of contents is filled in`);
    const pages = await page.locator(`${P} .status`).first().innerText();
    check(/sur\s*[3-9]|sur\s*\d\d/.test(pages) || /of\s*[3-9]/.test(pages), `${n}: APA-Provost: each part starts on its own page (${pages.split('\n')[0]})`);
    check(await page.locator(`${P} .header-area span[data-page-number]`).count() >= 1, `${n}: APA-Provost: the page number is in the header`);
    check(await page.locator(`${P} .header-area p`).first().evaluate(p => getComputedStyle(p).textAlign).catch(() => '') === 'right', `${n}: APA-Provost: the page number is top right`);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!sideways, `${n}: no sideways scrolling`);

    // A letter with text: Cancel keeps the text and only changes the look (MLA: Times 12, double).
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Mon texte à garder.');
    await page.waitForTimeout(300);
    answer = false;
    await openDrop(page, 'letter.works');
    await page.locator('.work-item[data-work="harvard"]').click();
    await page.waitForTimeout(600);
    const kept = await body.innerText();
    check(kept.includes('Mon texte à garder.') && !kept.includes('Introduction'), `${n}: Harvard on a letter with text: Cancel keeps the text`);
    const hv = await body.locator('p').first().evaluate(p => ({ font: getComputedStyle(p).fontFamily, size: parseFloat(getComputedStyle(p).fontSize) }));
    check(/Arial/i.test(hv.font) && Math.abs(hv.size - 14.67) < 0.6, `${n}: Harvard look applied to the kept text (Arial 11: ${hv.font.split(',')[0]} ${hv.size}px)`);
    answer = true;
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
