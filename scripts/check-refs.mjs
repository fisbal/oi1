// References in In 1 Letter (Martin, 2026-10-31: APA rules in French, "si tu connais d'autres modèles alors un onglet
// modèle"). Checks on PC and phone, in French, like a person: the Models window shows the layout rules and a model per
// type of document for every style, the French APA uses et / Dans / dir. / p. / s. d., "Use this model" opens the source
// window for that type, the citation and the bibliography follow APA (alphabetical, 1.27 cm hanging indent, double
// spacing), and Check sources lists what is missing and completes it in every citation.
// Run after `npm run build`:
//   node scripts/check-refs.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4197;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const H = '.module-host:not([hidden])';
const BODY = `${H} .sheet .ProseMirror:not(.header-text):not(.footer-text)`;

for (const [name, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.addInitScript(() => { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'fr'); sessionStorage.setItem('set', '1'); } });
  await page.goto(url);
  await page.locator('.slab:has-text("In 1 Letter")').first().click();
  await page.waitForTimeout(1500);
  await page.locator(BODY).first().click();
  await page.keyboard.type('Selon les auteurs ');
  const tab = async label => { await page.locator(`${H} .ribbon-tabs [role=tab]`).filter({ hasText: label }).first().click(); await page.waitForTimeout(250); };
  const btn = label => page.locator(`${H} button[aria-label="${label}"]`).first();

  // The Models window.
  await tab('Références');
  check(await btn('Vérifier les sources').isVisible(), `${name}: References has "Check sources"`);
  await btn('Modèles').click();
  const dlg = page.locator('dialog.oi-dialog[open]');
  await dlg.waitFor({ timeout: 3000 }).catch(() => {});
  const styles = await dlg.locator('.refm-tabs [role=tab]').count();
  const cards = await dlg.locator('.refm-card').count();
  check(styles >= 20 && cards >= 10, `${name}: Models shows ${styles} styles with ${cards} document types each`);
  const sel = (await dlg.locator('.refm-tabs [aria-selected=true]').innerText()).trim();
  check(sel === 'APA 7 (français)', `${name}: in French the default style is APA 7 (français) (${sel})`);
  const rules = await dlg.locator('.refm-rules').innerText();
  check(/alphabétique/.test(rules) && /1,27 cm/.test(rules) && /double/i.test(rules), `${name}: the rules say alphabetical, 1.27 cm hanging indent, double spacing`);
  check(/Dans/.test(rules) && /dir\./.test(rules) && /s\. d\./.test(rules), `${name}: the French adaptations are listed (et, Dans, dir., p., s. d.)`);
  const chapter = await dlg.locator('.refm-card').filter({ hasText: 'Chapitre' }).first().innerText();
  check(chapter.includes('Dans J.-F. Chanlat (dir.)') && chapter.includes('(p. 407-416)'), `${name}: the chapter example follows French APA`);
  const box = await dlg.boundingBox();
  check(!!box && box.x >= 0 && box.x + box.width <= viewport.width + 1, `${name}: the Models window fits the screen`);
  // Another style shows its own models.
  await dlg.locator('.refm-tabs [role=tab]', { hasText: 'MLA 9' }).click();
  const mla = await dlg.locator('.refm-card').first().innerText();
  check(/Ferris, Michael C\./.test(mla), `${name}: MLA shows its own form`);
  await dlg.locator('.refm-tabs [role=tab]', { hasText: 'APA 7 (français)' }).click();

  // Use the chapter model: the source window opens for a chapter, with the editors box.
  await dlg.locator('.refm-card').filter({ hasText: 'Chapitre' }).first().locator('button').click();
  await page.waitForTimeout(300);
  const src = page.locator('dialog.oi-dialog[open]');
  check(await src.locator('select').first().inputValue() === 'chapter', `${name}: "Use this model" opens the source window for a chapter`);
  check(await src.locator('label', { hasText: 'Directeurs' }).count() === 1, `${name}: a chapter asks for the editors of the book`);
  const fill = async (label, value) => src.locator('label:has(input)', { hasText: label }).first().locator('input').fill(value);
  await fill('Auteurs', 'Roy, Ana');
  await fill('Titre', 'Le chapitre');
  await fill('Année', '2021');
  await fill('Revue', 'Le grand livre');
  await src.locator('button[type=submit]').click();
  await page.waitForTimeout(400);
  let text = await page.locator(BODY).first().innerText();
  check(text.includes('(Roy, 2021)'), `${name}: the citation is in the text (${text.trim().slice(-40)})`);

  // Check sources: the chapter lacks editors, pages and publisher; completing it updates the citation.
  await tab('Références');
  await btn('Vérifier les sources').click();
  const chk = page.locator('dialog.oi-dialog[open]');
  const miss = await chk.innerText();
  check(/Il manque/.test(miss) && /Directeurs/.test(miss) && /Pages/.test(miss), `${name}: Check sources lists what is missing (${miss.replace(/\s+/g, ' ').slice(0, 90)})`);
  await chk.locator('button', { hasText: 'Compléter' }).first().click();
  await page.waitForTimeout(300);
  const fix = page.locator('dialog.oi-dialog[open]');
  check(await fix.locator('label.missing').count() >= 3, `${name}: the missing boxes are pointed out`);
  await fix.locator('label', { hasText: 'Directeurs' }).locator('input').fill('Chanlat, Jean-François');
  await fix.locator('label', { hasText: 'Pages' }).locator('input').fill('10-20');
  await fix.locator('label', { hasText: 'Éditeur' }).locator('input').fill('Boréal');
  await fix.locator('label', { hasText: 'Année' }).locator('input').fill('2022');
  await fix.locator('button[type=submit]').click();
  await page.waitForTimeout(400);
  text = await page.locator(BODY).first().innerText();
  check(text.includes('(Roy, 2022)'), `${name}: completing a source rewrites its citation (${text.trim().slice(-30)})`);

  // The bibliography in APA.
  await tab('Références');
  await btn('Bibliographie').click();
  await page.locator('button.menu-item').filter({ hasText: /^Références$/ }).first().click();
  await page.waitForTimeout(400);
  const entry = page.locator(`${BODY} p`).filter({ hasText: 'Roy, A. (2022)' }).first();
  const got = await entry.innerText().catch(() => '');
  check(got.includes('Dans J.-F. Chanlat (dir.), Le grand livre (p. 10-20). Boréal.'), `${name}: the bibliography entry is French APA (${got})`);
  const css = await entry.evaluate(el => ({ lh: el.style.lineHeight, ti: getComputedStyle(el).textIndent, ml: el.style.marginLeft || getComputedStyle(el).paddingLeft })).catch(() => ({}));
  check(css.lh === '2' && parseFloat(css.ti) < 0, `${name}: double spacing and a hanging indent (${JSON.stringify(css)})`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
