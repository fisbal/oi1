// Signatures (Martin, 2026-11-03), used like a person would on PC, Mac, tablet and phone, both ways (rule 16):
//  - In 1 Letter: make a signature by drawing it with the finger or mouse, place a full signature line (signature,
//    name, title, date), then a typed one (21 styles, none cut) and the initials; undo takes it back.
//  - In 1 Class: place the signature on the sheet, move it, make it bigger by its corner, undo, delete it.
//  - In 1 Mail: make Pro and Perso e-mail signatures with the handwritten one and a look; a new mail gets the Pro
//    one by itself, a reply gets none unless asked.
//  - Saved on this device: still there after a restart.
// Run after `npm run build`:
//   node scripts/check-signature.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4230;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const H = '.app-frame:not([hidden])';
const SCREENS = [
  ['PC', { width: 1366, height: 768 }, false],
  ['Mac', { width: 1440, height: 900 }, false],
  ['Tablet', { width: 820, height: 1180 }, true],
  ['Tablet sideways', { width: 1180, height: 820 }, true],
  ['Phone', { width: 390, height: 844 }, true],
  ['Phone sideways', { width: 844, height: 390 }, true],
];
const openApp = async (page, app) => {
  await page.locator('.tab-new').click().catch(() => {});
  await page.locator(`.slab:has-text("${app}")`).first().click();
};
const ribbonTab = async (page, label) => {
  await page.locator(`${H} [role=tab]`, { hasText: label }).first().click();
  await page.waitForTimeout(250);
};
const sigDrop = async (page, tab = 'Insertion') => { if (tab) await ribbonTab(page, tab); await page.locator(`${H} [data-help="sig.button"]:visible`).first().click(); await page.waitForTimeout(200); };
/** A signature-like stroke across the pad, with a mouse or a finger (touch events through the pointer). */
const drawOnPad = async page => {
  const pad = page.locator('.sig-pad');
  await pad.scrollIntoViewIfNeeded();
  const b = await pad.boundingBox();
  await page.mouse.move(b.x + b.width * 0.08, b.y + b.height * 0.6);
  await page.mouse.down();
  for (let i = 0; i <= 40; i++) await page.mouse.move(b.x + b.width * (0.08 + i * 0.02), b.y + b.height * (0.55 - 0.22 * Math.sin(i / 2.5)));
  await page.mouse.up();
};
const fitsDialog = page => page.evaluate(() => {
  const d = document.querySelector('dialog.oi-dialog[open]');
  if (!d) return 'no dialog';
  const r = d.getBoundingClientRect();
  if (r.left < -1 || r.right > innerWidth + 1) return `dialog ${Math.round(r.left)}..${Math.round(r.right)} of ${innerWidth}`;
  for (const el of d.querySelectorAll('button, label, small, input')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || !el.getClientRects().length) continue;
    if (el.scrollWidth > el.clientWidth + 2 && s.overflow !== 'visible' && !el.closest('.sig-styles, .ml-sig-looks') && el.tagName !== 'INPUT') return `cut: "${(el.textContent || '').trim().slice(0, 30)}"`;
  }
  // The signature looks: each card shows all its lines.
  for (const c of d.querySelectorAll('.ml-sig-looks > button')) if (c.scrollHeight > c.clientHeight + 2) return `look ${[...c.parentElement.children].indexOf(c) + 1} cut (${c.clientHeight} px)`;
  // The style samples: the name fits its tile.
  for (const sp of d.querySelectorAll('.sig-styles span')) if (sp.scrollWidth > sp.parentElement.clientWidth + 2) return `style sample cut: ${sp.style.fontFamily}`;
  return '';
});

for (const [name, viewport, mobile] of SCREENS) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  page.on('dialog', d => d.accept());
  await page.addInitScript(`try { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'fr'); localStorage.setItem('oi1.tips', 'off'); sessionStorage.setItem('set', '1'); } } catch {}`);
  await page.goto(url);

  // ---------------- In 1 Letter
  await openApp(page, 'In 1 Letter');
  const pm = page.locator(`${H} .body-area .ProseMirror`).first();
  await pm.waitFor({ timeout: 10000 });
  await pm.click();
  await page.keyboard.type('Fait à Paris. ');
  await sigDrop(page);
  check(await page.locator('.sig-empty').first().isVisible(), `${name}: Letter: with no signature yet, the menu says how to make one`);
  await page.getByText('Nouvelle signature…').click();
  await page.locator('.sig-pad').waitFor({ timeout: 5000 });
  const fit1 = await fitsDialog(page);
  check(!fit1, `${name}: the signature maker fits the screen, nothing cut${fit1 ? ` (${fit1})` : ''}`);
  await page.locator('.sig-fields input').nth(0).fill('Martin Ballas');
  await page.locator('.sig-fields input').nth(1).fill('Directeur');
  // OK with an empty pad: a clear message, the window stays.
  await page.locator('dialog[open] button.primary').click();
  check(await page.locator('.sig-error').isVisible().catch(() => false), `${name}: OK with an empty pad says to draw first`);
  await drawOnPad(page);
  await page.locator('dialog[open] button.primary').click();
  await page.waitForTimeout(700);
  const placed = await pm.evaluate(el => ({ imgs: el.querySelectorAll('img[src^="data:image/png"]').length, text: el.innerText }));
  check(placed.imgs === 1 && /Martin Ballas/.test(placed.text) && /Directeur/.test(placed.text) && /2026/.test(placed.text),
    `${name}: Letter: the drawn signature is placed as a signature line with name, title and date (${placed.imgs} picture)`);
  // Undo takes it all back in one step.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  check(await pm.evaluate(el => !el.querySelector('img') && !/Directeur/.test(el.innerText)), `${name}: Letter: one undo takes the signature line back`);
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(300);

  // A typed signature in another style, then the initials.
  await sigDrop(page);
  await page.getByText('Nouvelle signature…').click();
  await page.locator('.sig-modes button').nth(1).click();
  const styles = await page.locator('.sig-styles button').count();
  check(styles >= 20, `${name}: ${styles} handwriting styles to choose from`);
  const fit2 = await fitsDialog(page);
  check(!fit2, `${name}: the styles fit, no name cut${fit2 ? ` (${fit2})` : ''}`);
  await page.locator('.sig-styles button').nth(4).click();
  await page.locator('dialog[open] button.primary').click();
  await page.waitForTimeout(800);
  await sigDrop(page);
  check(await page.locator('.sig-item').count() === 2, `${name}: Letter: both signatures are in "My signatures"`);
  await page.getByText('Placer mes initiales').click();
  await page.waitForTimeout(300);
  check(await pm.evaluate(el => el.querySelectorAll('img').length) >= 3, `${name}: Letter: the typed signature and the initials are placed too`);

  // ---------------- In 1 Class
  await openApp(page, 'In 1 Class');
  await page.locator(`${H} .cells-area`).waitFor({ timeout: 10000 });
  await page.locator(`${H} .cells-area`).click({ position: { x: 60, y: 60 } });
  await ribbonTab(page, 'Insertion');
  await sigDrop(page);
  await page.getByText('Placer ma signature').click();
  const pic = page.locator(`${H} .pic-obj`);
  check(await pic.count() === 1, `${name}: Class: the signature is placed on the sheet`);
  if (await pic.count()) {
    const b0 = await pic.boundingBox();
    await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2); await page.mouse.down();
    await page.mouse.move(b0.x + b0.width / 2 + 30, b0.y + b0.height / 2 + 40, { steps: 8 }); await page.mouse.up();
    const b1 = await pic.boundingBox();
    check(Math.abs(b1.x - b0.x - 30) < 6 && Math.abs(b1.y - b0.y - 40) < 6, `${name}: Class: the signature moves with the finger or mouse (${Math.round(b1.x - b0.x)}, ${Math.round(b1.y - b0.y)})`);
    const h = await page.locator(`${H} .pic-size`).boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 + 60, h.y + h.height / 2 + 10, { steps: 8 }); await page.mouse.up();
    const b2 = await pic.boundingBox();
    check(b2.width > b1.width + 40 && Math.abs(b2.width / b2.height - b1.width / b1.height) < 0.15, `${name}: Class: the corner makes it bigger and keeps its shape (${Math.round(b1.width)} → ${Math.round(b2.width)} px)`);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    const b3 = await pic.boundingBox();
    check(b3 && Math.abs(b3.width - b1.width) < 3, `${name}: Class: undo takes the size back`);
    await pic.click();
    await page.locator(`${H} .pic-del`).click();
    check(await pic.count() === 0, `${name}: Class: × deletes the signature`);
  }

  // ---------------- In 1 Mail
  await openApp(page, 'In 1 Mail');
  await page.locator(`${H} .mailapp`).waitFor({ timeout: 10000 });
  await ribbonTab(page, 'Insertion');
  await page.locator(`${H} [data-help="mail.signature"]:visible`).first().click();
  await page.getByText('Mes signatures…').click();
  await page.locator('.ml-sigs').waitFor({ timeout: 5000 });
  const fit3 = await fitsDialog(page);
  check(!fit3, `${name}: Mail: "My e-mail signatures" fits the screen${fit3 ? ` (${fit3})` : ''}`);
  const form = page.locator('.ml-sig-form input');
  await form.nth(1).fill('Martin Ballas'); await form.nth(2).fill('Directeur'); await form.nth(3).fill('Office In 1'); await form.nth(4).fill('+33 6 12 34 56 78');
  await page.locator('.ml-sig-hands button:has(img)').first().click();
  const looks = await page.locator('.ml-sig-looks > button').count();
  check(looks >= 20, `${name}: Mail: ${looks} signature looks`);
  await page.locator('.ml-sig-looks > button').nth(6).click();
  await page.locator('.ml-sig-tabs button', { hasText: 'Ajouter' }).click();
  await form.nth(2).fill('');
  await page.locator('dialog[open] button.primary').click();
  await page.waitForTimeout(300);
  await ribbonTab(page, 'Accueil');
  await page.locator(`${H} [data-help="mail.new"]:visible`).first().click();
  await page.waitForTimeout(500);
  const body = await page.locator(`${H} .ml-editor .ProseMirror`).first().evaluate(el => ({ text: el.innerText, img: el.querySelectorAll('img').length, tel: !!el.querySelector('a[href^="tel:"]') }));
  check(/Martin Ballas/.test(body.text) && /Directeur/.test(body.text) && body.img >= 1 && body.tel, `${name}: Mail: a new mail gets the Pro signature by itself, with the handwritten one and a phone link`);

  // ---------------- kept after a restart
  await page.reload();
  await page.waitForTimeout(800);
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('oi1.signatures') || '[]').length) === 2, `${name}: the signatures are kept on this device after a restart`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
