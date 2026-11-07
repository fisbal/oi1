// "Analyse et correction" leaves a work in proper shape (Martin, 2026-11-07: "n'est pas toujours en forme", "ça met du
// gras sur le texte sans prévenir"). A work shaped like his (his file stays private): a whole paragraph set as a
// "Titre 2", an empty title, fields written over that kept their yellow, "3.2 … 3.5" typed as lines (3.5 ends with a
// period), bold citations in the text, an old table of contents with "3.1 [Sous-partie]", a double space before "De
// plus". Like a person on PC, tablet and phone: nothing changes while the pane only lists; "Appliquer la norme" first
// says what it changes; each remark's Corriger fixes it; at the end no bold in the text, no stale yellow, 3.1 to 3.5 all
// level-2 titles, the contents up to date, every word kept and no letter struck out.
// Run after `npm run build`:
//   node scripts/check-shape.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4244;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => { (ok ? passed : problems).push(what); if (process.env.DEBUG) console.log(ok ? 'ok ' : 'NO ', what); };

const ALL = [
  ['PC', { width: 1366, height: 768 }, false],
  ['Tablet', { width: 820, height: 1180 }, true],
  ['Phone', { width: 390, height: 844 }, true],
  ['Phone sideways', { width: 844, height: 390 }, true],
];
const DEVICES = process.env.ONLY ? ALL.filter(d => d[0] === process.env.ONLY) : ALL;
const P = '.module-host:not([hidden])';

const yellow = { type: 'highlight', attrs: { color: '#FFF2A8' } }, bold = { type: 'bold' };
const t = (text, marks) => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const p = (...c) => ({ type: 'paragraph', ...(c.length ? { content: c } : {}) });
const h = (level, ...c) => ({ type: 'heading', attrs: { level }, ...(c.length ? { content: c } : {}) });
const toc = s => ({ type: 'paragraph', attrs: { tabStops: 'r468*' }, content: [t(s)] });
const BODY = 'Le problème principal de cette entreprise est un conflit entre deux employées qui dure depuis des semaines. Il nuit au service et à toute l’équipe, qui a dû intervenir. Ce conflit demande donc une action rapide de la gestionnaire.';
const TEXT = 'Une gestionnaire voit une employée comme une future cadre sans lui demander ses objectifs.  De plus, ses jugements viennent de ses propres aspirations.';
const WORK = [
  p(t('Prénom Nom', [yellow])), p(t('Travail noté 2', [bold, yellow])), p(t('Université')),
  { type: 'pageBreak' },
  h(1, t('Table des matières')), toc('Étape 1 : Résumé des faits\t3-4'), toc('3.1 [Sous-partie]\t4'), p(t('3.2 ')), p(t('3.3')),
  { type: 'pageBreak' },
  h(1, t('Étape 1 : Résumé des faits')), p(t(BODY)),
  h(1, t('Étape 2 : Identification du problème')), h(2, t(BODY, [bold])),
  h(1, t('Étape 3 : Analyse des causes du problème')), p(t(BODY)),
  h(2, t('3.1 Première cause : les biais perceptuels')),
  p(t(TEXT), t(' (Auteur et al., 2010, p. 75)', [bold]), t(' Cela nuit à ses décisions.')),
  h(2),
  p(t('3.2 Mauvaise communication entre les deux employées', [yellow])),
  p(t('3.3 Les difficultés d’intégration dans le groupe', [yellow])),
  p(t('3.4 Le manque d’encadrement', [yellow])),
  p(t('3.5 ', [yellow]), t('L’absence de normes claires concernant les comportements attendus des employés.')),
  h(1, t('Étape 4 : L’inventaire des solutions')), p(t('[Votre texte]', [yellow])),
  h(1, t('Références')), p(t('AUTEUR, A. (2010). Comportement organisationnel. Montréal : Éditeur.')),
];
// The words a reader sees (tracked deletions left out), and the look of the document.
const read = () => {
  const ed = document.querySelector('.module-host:not([hidden]) .body-area .ProseMirror').editor;
  const words = [], boldBody = [], yellowFilled = [], heads = [];
  ed.state.doc.forEach(node => {
    const txt = [];
    node.descendants(c => { if (c.isText && !c.marks.some(m => m.type.name === 'deletion')) txt.push(c.text); });
    const s = txt.join('');
    words.push(s);
    if (node.type.name === 'heading') heads.push(`${node.attrs.level}:${s.trim()}`);
    if (node.type.name === 'paragraph' && !node.attrs.tabStops) node.descendants(c => { if (c.isText && c.marks.some(m => m.type.name === 'bold') && words.length > 4) boldBody.push(c.text); });
    if (!/\[[^\]]+\]/.test(s)) node.descendants(c => { if (c.isText && c.marks.some(m => m.type.name === 'highlight' && String(m.attrs.color).toUpperCase() === '#FFF2A8')) yellowFilled.push(c.text); });
  });
  return { json: JSON.stringify(ed.getJSON()), words: words.join(' ').replace(/\s+/g, ' '), boldBody, yellowFilled, heads };
};

for (const [name, viewport, touch] of DEVICES) {
  const n = name;
  const ctx = await browser.newContext({ viewport, locale: 'fr-CA', isMobile: touch, hasTouch: touch });
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
    await body.evaluate((el, content) => el.editor.commands.setContent({ type: 'doc', content }), WORK);
    await page.waitForTimeout(500);
    const start = await page.evaluate(read);

    // The pane lists, and changes nothing by itself.
    const b = () => page.locator(`${P} [data-help="ana.open"]:visible`).first();
    if (!(await b().count())) await page.locator(`${P} .ribbon-tabs button:text-is("Révision")`).first().click();
    await b().click();
    await page.locator(`${P} .status`).first().click().catch(() => {});
    const pane = page.locator('[data-analysis]').first();
    await pane.waitFor({ timeout: 4000 });
    await pane.locator('select').selectOption('apaProvost');
    await page.waitForTimeout(900);
    const keys = await pane.locator('.ana-card').evaluateAll(cs => cs.map(c => c.getAttribute('data-key')));
    for (const k of ['ana.s.longHeading', 'ana.s.fieldColor', 'ana.s.bodyBold', 'ana.s.oldToc', 'ana.titles', 'ana.double']) check(keys.includes(k), `${n}: the analysis lists ${k} (${keys.join(', ')})`);
    check((await page.evaluate(read)).json === start.json, `${n}: listing the remarks changes nothing in the text`);

    // "Appliquer la norme" says first what changes; Annuler changes nothing.
    await pane.locator('[data-apply-norm]').click();
    const ask = pane.locator('[data-norm-ask]');
    check(await ask.isVisible() && /gras/.test(await ask.innerText()), `${n}: "Appliquer la norme" first says what it changes`);
    await ask.locator('button:not(.primary)').click();
    check((await page.evaluate(read)).json === start.json && !(await ask.isVisible()), `${n}: Annuler changes nothing`);

    // Each remark's Corriger, one by one, like a person.
    const want = ['ana.s.bodyBold', 'ana.s.longHeading', 'ana.titles', 'ana.s.fieldColor', 'ana.s.oldToc', 'ana.double'];
    for (let k = 0; k < 12; k++) {
      const next = pane.locator(want.map(w => `.ana-card[data-key="${w}"] button.primary`).join(', ')).first();
      if (!(await next.count())) break;
      await next.scrollIntoViewIfNeeded();
      if (touch) await next.tap(); else await next.click();
      await page.waitForTimeout(700);
    }
    const end = await page.evaluate(read);
    const left = await pane.locator('.ana-card').evaluateAll(cs => cs.map(c => c.getAttribute('data-key')));
    check(want.every(w => !left.includes(w)), `${n}: each fixed remark is gone (${left.join(', ')})`);
    check(end.boldBody.length === 0, `${n}: no bold left in the running text (${end.boldBody.join(' | ')})`);
    check(end.yellowFilled.length === 0, `${n}: no stale yellow on filled fields (${end.yellowFilled.join(' | ')})`);
    check(end.json.includes('[Votre texte]') && /#FFF2A8/i.test(end.json), `${n}: the field still to fill keeps its yellow`);
    const subs = end.heads.filter(x => /^\d:3\.\d/.test(x));
    check(subs.length === 5 && subs.every(x => x.startsWith('2:')), `${n}: 3.1 to 3.5 are all level-2 titles (${subs.join(' | ')})`);
    check(!end.heads.some(x => x.startsWith('2:Le problème') || x === '2:'), `${n}: no paragraph or empty line left as a title`);
    check(!end.words.includes('[Sous-partie]') && end.words.includes('3.5 L’absence de normes'), `${n}: the table of contents is made again from the titles`);
    check(end.words.includes('objectifs. De plus'), `${n}: the double space is fixed and no letter is struck out`);
    const lost = BODY.split(' ').concat(TEXT.split(/\s+/)).filter(w => !end.words.includes(w));
    check(lost.length === 0, `${n}: every word is kept (${lost.join(' ')})`);

    check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${n}: no sideways scrolling`);
  } catch (e) {
    problems.push(`${n}: stopped: ${String(e.message ?? e).split('\n')[0]}`);
  } finally { await ctx.close(); }
}

await browser.close();
try { process.kill(-server.pid); } catch { /* gone */ }
console.log(`Analysis shape: ${passed.length} checks passed, ${problems.length} problems`);
for (const x of problems) console.log('  -', x);
process.exit(problems.length ? 1 : 0);
