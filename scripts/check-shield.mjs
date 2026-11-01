// Bouclier (shield) check, like a person, on PC and phone (Martin: "antivirus et anti-arnaques… méthode du vaccin").
// Opens a Word file with a macro: the warning shows, fits the screen, "Open a clean copy" opens the letter with its
// text and the vaccine is made; opening the same file again is recognised at once. Then the Protection panel: every
// tab has content, a scam message is flagged, a normal message is not, and clicking a trap link in a letter is stopped.
// Run after `npm run build`:  node scripts/check-shield.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import JSZip from 'jszip';

const PORT = Number(process.env.PORT) || 4204;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const zip = new JSZip();
zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>');
zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>');
zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Facture piégée 2026</w:t></w:r></w:p></w:body></w:document>');
zip.file('word/vbaProject.bin', 'Attribute VB_Name = "AutoOpen"');
const docm = await zip.generateAsync({ type: 'nodebuffer' });

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const fits = (b, v) => !!b && b.x >= -1 && b.y >= -1 && b.x + b.width <= v.width + 1 && b.y + b.height <= v.height + 1;

for (const [name, viewport, mobile] of [['PC', { width: 1280, height: 800 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.addInitScript(() => { delete window.showOpenFilePicker; });
  await page.goto(url);
  await page.waitForTimeout(800);

  // 1. A Word file with a macro.
  const openIt = async () => {
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.hero-actions .glass-pill').first().click();
    await (await chooser).setFiles({ name: 'facture.docm', mimeType: 'application/vnd.ms-word.document.macroEnabled.12', buffer: docm });
  };
  await openIt();
  const dlg = page.locator('dialog.sh-dialog[open]');
  await dlg.waitFor({ timeout: 5000 }).catch(() => {});
  check(await dlg.isVisible(), `${name}: a file with a macro shows the shield's warning`);
  check(fits(await dlg.boundingBox(), viewport), `${name}: the warning fits the screen`);
  check(/macro/i.test(await dlg.innerText().catch(() => '')), `${name}: the warning says it is a macro`);
  const t0 = Date.now();
  await dlg.locator('button', { hasText: /désinfectée|clean copy/i }).click().catch(() => problems.push(`${name}: no "clean copy" button`));
  await page.waitForFunction(() => /Facture/.test(document.querySelector('.app-frame:not([hidden]) .ProseMirror.body-text')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => {});
  const text = await page.locator('.app-frame:not([hidden]) .ProseMirror.body-text').innerText().catch(() => '');
  check(text.includes('Facture piégée 2026'), `${name}: the clean copy opens in Letter with its text (${Date.now() - t0} ms)`);
  // The tab takes the file's name once the letter has read it: wait for it (slow CI machines).
  await page.waitForFunction(() => /sain/.test(document.querySelector('.app-frame:not([hidden]) .app-doc')?.getAttribute('title') ?? ''), null, { timeout: 8000 }).catch(() => {});
  const docName = await page.locator('.app-frame:not([hidden]) .app-doc').getAttribute('title').catch(() => '');
  check(/sain/.test(docName ?? ''), `${name}: the clean copy is named "(sain)" (${docName})`);
  const vacc = await page.evaluate(() => JSON.parse(localStorage.getItem('oi1.shield.antibodies') || '[]').length);
  check(vacc === 0, `${name}: a macro alone (a warning, not a danger) makes no vaccine`);

  // 2. A program disguised as a PDF: danger, vaccine made, recognised the second time.
  await page.locator('button.brand').click(); await page.waitForTimeout(400);
  const exe = Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0]);
  for (const round of [1, 2]) {
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.hero-actions .glass-pill').first().click();
    await (await chooser).setFiles({ name: 'facture.pdf', mimeType: 'application/pdf', buffer: exe });
    await dlg.waitFor({ timeout: 5000 }).catch(() => {});
    const said = await dlg.innerText().catch(() => '');
    check(/programme/i.test(said), `${name}: round ${round}: a program named .pdf is caught`);
    if (round === 2) check(/vaccin/i.test(said), `${name}: the second time a vaccine recognises it at once`);
    await dlg.locator('button.primary').click();
    await page.waitForTimeout(300);
    check(!(await page.locator('.app-frame:not([hidden])').count()), `${name}: round ${round}: "Don't open" opens nothing`);
  }

  // 3. The Protection panel.
  await page.locator('.hero-actions .shield-btn').click();
  const panel = page.locator('dialog.sh-panel[open]');
  await panel.waitFor({ timeout: 3000 }).catch(() => {});
  check(fits(await panel.boundingBox(), viewport), `${name}: the Protection panel fits the screen`);
  for (const tab of await panel.locator('[role=tab]').all()) {
    await tab.click();
    const body = (await panel.locator('.sh-body').innerText().catch(() => '')).trim();
    check(body.length > 30, `${name}: tab "${await tab.innerText()}" has real content`);
  }
  check(/facture\.pdf/.test(await (async () => { await panel.locator('[role=tab]').nth(2).click(); return panel.innerText(); })()), `${name}: the vaccine is listed`);
  await panel.locator('[role=tab]').nth(1).click();
  await panel.locator('textarea').fill('URGENT : votre compte a été suspendu. Achetez des cartes cadeaux Google Play et envoyez-moi le code. https://paypal.com.secure-login.xyz/verify');
  await panel.locator('.sh-row button.primary').click();
  await panel.locator('.sh-verdict').waitFor({ timeout: 4000 }).catch(() => {});
  check(/danger/i.test(await panel.locator('.sh-verdict').innerText().catch(() => '')), `${name}: a scam message is flagged as danger`);
  await panel.locator('textarea').fill('Bonjour, voici le compte rendu de la réunion de mardi. Bonne journée.');
  await panel.locator('.sh-row button.primary').click();
  await page.waitForTimeout(300);
  check(/rien de suspect/i.test(await panel.locator('.sh-verdict').innerText().catch(() => '')), `${name}: a normal message is not flagged`);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(sw <= viewport.width, `${name}: no sideways scroll (${sw}px)`);
  await panel.locator('.sh-x').click();

  // 4. A trap link inside a letter is stopped before the browser goes there.
  await page.locator('.hero-actions .gold-pill').click();
  await page.locator('.app-frame:not([hidden]) .ProseMirror.body-text').waitFor({ timeout: 8000 });
  if (!mobile) check(await page.locator('.app-frame:not([hidden]) .app-bar .shield-btn').isVisible(), `${name}: the shield button is in the app bar`);
  const popups = [];
  ctx.on('page', p => popups.push(p));
  await page.evaluate(() => {
    const a = Object.assign(document.createElement('a'), { href: 'https://paypa1.com/login', textContent: 'www.paypal.com' });
    document.querySelector('.app-frame:not([hidden]) .module-host').appendChild(a);
    a.click();
  });
  await dlg.waitFor({ timeout: 4000 }).catch(() => {});
  check(/piège/i.test(await dlg.innerText().catch(() => '')), `${name}: a fake PayPal link in a letter is stopped`);
  await dlg.locator('button.primary').click().catch(() => {});
  await page.waitForTimeout(300);
  check(popups.length === 0, `${name}: "Stay here" goes nowhere`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already stopped */ }
for (const p of passed) console.log(`  ✓ ${p}`);
for (const p of problems) console.log(`  ✗ ${p}`);
if (problems.length) { console.error(`\n${problems.length} shield problem(s).`); process.exit(1); }
console.log(`\nThe shield works: ${passed.length} checks passed on PC and phone.`);
