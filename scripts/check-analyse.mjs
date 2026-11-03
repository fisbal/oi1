// "Analyse et correction" in In 1 Letter (Martin, 2026-11-03: "un bouton analyse et correction avec ta logique
// premium", "un travail modèle où tu n'auras rien à dire", "et par rapport à la mise en page ?"), used like a person
// would in French on every kind of screen (rule 16): a work typed like Martin's (titles as plain lines, "Solution 2 :"
// with its name on the next line, a theory without its year, spelling mistakes) is reorganized with APA-Provost; the
// pane lists the remarks by group and fits on the screen; "Tout corriger" puts the language fixes in as tracked
// changes; another norm shows the layout remarks and "Appliquer la norme" fixes them; the exemplary work opens in a
// new letter where the analysis has nothing to say. No text is cut, no sideways scrolling.
// Run after `npm run build`:
//   node scripts/check-analyse.mjs

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4231;
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
  { name: 'small phone', viewport: { width: 360, height: 640 }, mobile: true },
  { name: 'phone sideways', viewport: { width: 844, height: 390 }, mobile: true },
];
const P = '.module-host:not([hidden])';
const L = 'Ce paragraphe présente une partie du travail avec assez de mots pour ressembler à un vrai texte d’étudiant sur la communication interculturelle.';
const MESSY = [
  'Étape 1 Comprendre la situation', L,
  'Introduction :', `Selon Maslow, les besoins dune personne guident son comportement. ${L}`,
  'Étape 2', L,
  'Solution 1 : écouter', L,
  'Solution 2 :', 'négocier', `Les règles ont été imposé par la direction  sans discussion. ${L}`,
  'Conclusion', L,
].map(x => `<p>${x}</p>`).join('');

// A ribbon button: its tab first when it is not on screen (on phones the ribbon is folded and opens over the work).
async function ribbon(page, name, key) {
  const b = () => page.locator(`${P} [data-help="${key}"]:visible`).first();
  if (!(await b().count())) await page.locator(`${P} .ribbon-tabs button:text-is("${name}")`).first().click();
  await b().click();
}
async function fits(page, sel, vp) {
  const b = await page.locator(sel).first().boundingBox();
  return !!b && b.x >= -1 && b.x + b.width <= vp.width + 1 && b.y >= -1 && b.y < vp.height;
}
const cutText = page => page.evaluate(() => [...document.querySelectorAll('[data-analysis] .ana-msg, [data-analysis] h3, [data-analysis] button, [data-analysis] .ana-sum')]
  .filter(e => e.offsetParent && (e.scrollWidth > e.clientWidth + 1)).map(e => e.textContent).slice(0, 3));

for (const d of DEVICES) {
  const n = d.name;
  const ctx = await browser.newContext({ viewport: d.viewport, isMobile: !!d.mobile, hasTouch: !!d.mobile, locale: 'fr-CA' });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${n}: script error: ${e.message}`));
  page.on('dialog', x => x.accept());
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'fr'); sessionStorage.setItem('set', '1'); } } catch { /* */ } });
  try {
    await page.goto(url);
    await page.locator('.slab:has-text("In 1 Letter")').first().click();
    const body = page.locator(`${P} .body-area .ProseMirror`).first();
    await body.waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);
    await body.click();
    await body.evaluate((el, html) => { const dt = new DataTransfer(); dt.setData('text/html', html); dt.setData('text/plain', 'x'); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, MESSY);
    await page.waitForTimeout(500);

    // Réorganiser with APA-Provost: every typed title becomes a heading at its level.
    await ribbon(page, 'Mise en page', 'letter.works');
    await page.locator('.drop-panel').first().waitFor({ timeout: 4000 });
    check(await page.locator('.work-row .work-model[data-model]').count() >= 30, `${n}: every norm in the gallery has its "Travail modèle" button`);
    check(await fits(page, '.drop-panel', d.viewport), `${n}: the gallery with its model buttons fits on the screen`);
    await page.locator('.work-item[data-work="apaProvost"]').click();
    await page.locator('.work-choice[data-mode="reorganize"]').click();
    await page.waitForTimeout(1500);
    const heads = await body.evaluate(el => [...el.querySelectorAll(':scope > h1, :scope > h2')].map(h => `${h.tagName}:${(h.textContent || '').trim()}`));
    for (const want of ['H1:Étape 1 : Comprendre la situation', 'H2:Introduction', 'H1:Étape 2', 'H2:Solution 1 : écouter', 'H2:Solution 2 : négocier', 'H1:Conclusion']) {
      check(heads.includes(want), `${n}: reorganize finds "${want}" (${heads.join(' | ')})`);
    }

    // The pane: from Révision, on screen, with the norm already chosen.
    await ribbon(page, 'Révision', 'ana.open');
    await page.locator(`${P} .status`).first().click().catch(() => {});
    const pane = page.locator('[data-analysis]').first();
    await pane.waitFor({ timeout: 4000 });
    await page.waitForTimeout(600);
    check(await fits(page, '[data-analysis]', d.viewport), `${n}: the analysis pane is on the screen`);
    check(await pane.locator('select').inputValue() === 'apaProvost', `${n}: the pane knows the norm of the work (APA-Provost)`);
    const keys = await pane.locator('.ana-card').evaluateAll(cs => cs.map(c => c.getAttribute('data-key')));
    for (const k of ['ana.noName', 'ana.noYear', 'ana.spell', 'ana.agree']) check(keys.includes(k), `${n}: the analysis finds ${k} (${keys.join(', ')})`);
    const cut = await cutText(page);
    check(cut.length === 0, `${n}: no text of the pane is cut (${cut.join(' | ')})`);

    // Langue > Tout corriger: tracked changes, the old words struck out until accepted.
    await pane.locator('[data-group="language"] .ana-ghead button').click();
    await page.waitForTimeout(800);
    const tracked = await body.evaluate(el => ({ ins: el.querySelectorAll('ins').length, del: el.querySelectorAll('del').length, text: el.textContent || '' }));
    check(tracked.ins >= 2 && tracked.del >= 1, `${n}: language fixes are tracked changes (${tracked.ins} inserted, ${tracked.del} struck out)`);
    check(tracked.text.includes('d’une') && tracked.text.includes('imposés'), `${n}: "dune" → "d’une", "imposé" → "imposés"`);
    check(await pane.locator('[data-group="language"] [data-key="ana.spell"]').count() === 0, `${n}: fixed remarks leave the list`);

    // Sources: the year of Maslow.
    await pane.locator('[data-key="ana.noYear"] button.primary').first().click();
    await page.waitForTimeout(600);
    check((await body.innerText()).includes('Maslow (1943)'), `${n}: Maslow gets its year (1943)`);

    // Another norm (Harvard: Arial 11): the layout remarks, then "Appliquer la norme".
    await pane.locator('select').selectOption('harvard');
    await page.waitForTimeout(600);
    check(await pane.locator('[data-group="layout"] .ana-card').count() >= 2, `${n}: Harvard: the layout remarks show (font, size…)`);
    await pane.locator('[data-apply-norm]').click();
    await page.waitForTimeout(900);
    check(await pane.locator('[data-group="layout"] [data-key="ana.n.font"], [data-group="layout"] [data-key="ana.n.pt"]').count() === 0, `${n}: "Appliquer la norme" fixes the font and the size`);
    const font = await body.locator('p').nth(3).evaluate(p => getComputedStyle(p).fontFamily);
    check(/Arial/i.test(font), `${n}: the text is now in the norm's font (${font.split(',')[0]})`);
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${n}: no sideways scrolling`);

    // The exemplary work: a new letter where the analysis has nothing to say.
    await pane.locator('select').selectOption('apaProvost');
    await pane.locator('[data-model]').click();
    await page.waitForTimeout(2500);
    const model = page.locator(`${P} .body-area .ProseMirror`).first();
    const mt = await model.innerText();
    check(/Références/.test(mt) && /Maslow/.test(mt) && !mt.includes('⟦TOC⟧') && !/\[[A-ZÉ][^\]]*\]/.test(mt), `${n}: the model work opens, complete, with its table of contents (${JSON.stringify(mt.slice(0, 60))})`);
    await ribbon(page, 'Révision', 'ana.open');
    await page.locator(`${P} .status`).first().click().catch(() => {});
    const pane2 = page.locator(`${P} [data-analysis], [data-analysis]`).last();
    await pane2.waitFor({ timeout: 4000 });
    await pane2.locator('select').selectOption('apaProvost');
    await page.waitForTimeout(900);
    const sum = await pane2.locator('.ana-sum').innerText();
    const left = await pane2.locator('.ana-card').evaluateAll(cs => cs.map(c => `${c.getAttribute('data-key')}: ${c.querySelector('.ana-msg')?.textContent}`));
    check(/Rien à redire/.test(sum), `${n}: the model work: "Rien à redire" (${left.join(' | ')})`);
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
