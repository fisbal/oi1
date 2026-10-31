// Changing the language (Martin, 2026-10-31: "le choix de tout changer, barre et travaux, ou juste la barre, ou juste
// les travaux"): with a document open, the language list asks what to translate. Checks on PC and phone, with the AI
// played by the test: "Document only" translates the words and keeps the menus, one Undo brings them back, "Everything"
// changes both, a remembered choice stops asking, and formulas and numbers in Class never change.
// Run after `npm run build`:
//   node scripts/check-translate.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4195;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const H = '.module-host:not([hidden])';

/** The AI's streamed answer: each item comes back marked with the language asked for. */
function answer(body) {
  const req = JSON.parse(body);
  const lang = /into ([^\s.]+)/.exec(req.system)?.[1] ?? '?';
  const items = JSON.parse(req.messages[0].content).items.map(s => `[${lang}] ${s}`);
  const json = JSON.stringify({ items });
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: req.model, content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } })
    + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: json } })
    + ev('content_block_stop', { index: 0 })
    + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } })
    + ev('message_stop', {});
}
const pickLang = (page, label) => page.locator('select.lang').selectOption({ label });
const dialog = page => page.locator('dialog.lang-choice[open]');

for (const [name, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.addInitScript(() => { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:ai:key', 'sk-ant-test'); localStorage.setItem('oi1:language', 'fr'); sessionStorage.setItem('set', '1'); } });
  await page.route('https://api.anthropic.com/**', route => route.fulfill({ status: 200, contentType: 'text/event-stream', body: answer(route.request().postData()) }));
  await page.goto(url);

  // Letter.
  await page.locator('.slab:has-text("Office Letter")').first().click();
  await page.waitForTimeout(1500);
  await page.locator(`${H} .sheet .ProseMirror:not(.header-text):not(.footer-text)`).first().click();
  await page.keyboard.type('Bonjour le monde');
  await page.waitForTimeout(300);
  await pickLang(page, 'English');
  check(await dialog(page).isVisible(), `${name}: changing the language with a letter open asks what to translate`);
  const opts = await dialog(page).locator('.lang-choice-option b').allInnerTexts();
  check(opts.length === 3, `${name}: three choices (${opts.join(' / ')})`);
  const box = await dialog(page).boundingBox();
  check(!!box && box.x >= 0 && box.x + box.width <= viewport.width + 1, `${name}: the window fits the screen`);
  await dialog(page).locator('.lang-choice-option', { hasText: 'Seulement le document' }).click();
  await page.waitForFunction(h => document.querySelector(`${h} .sheet .ProseMirror:not(.header-text):not(.footer-text)`)?.textContent.includes('[English]'), H, { timeout: 5000 }).catch(() => {});
  let text = await page.locator(`${H} .sheet .ProseMirror:not(.header-text):not(.footer-text)`).first().innerText();
  check(text.includes('[English]') && text.includes('Bonjour le monde'), `${name}: "Document only" translates the letter (${text.trim().slice(0, 40)})`);
  check(await page.locator('select.lang').inputValue() === 'fr', `${name}: "Document only" keeps the menus in French`);
  await page.locator(`${H} .sheet .ProseMirror:not(.header-text):not(.footer-text)`).first().evaluate(el => el.focus());
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  text = await page.locator(`${H} .sheet .ProseMirror:not(.header-text):not(.footer-text)`).first().innerText();
  check(!text.includes('[English]') && text.includes('Bonjour le monde'), `${name}: one Undo brings the letter back (${text.trim().slice(0, 50)})`);

  await pickLang(page, 'Español');
  await dialog(page).locator('.lang-choice-remember input').check();
  await dialog(page).locator('.lang-choice-option').first().click(); // Everything
  await page.waitForFunction(h => document.querySelector(`${h} .sheet .ProseMirror:not(.header-text):not(.footer-text)`)?.textContent.includes('[Español]'), H, { timeout: 5000 }).catch(() => {});
  text = await page.locator(`${H} .sheet .ProseMirror:not(.header-text):not(.footer-text)`).first().innerText();
  check(text.includes('[Español]') && await page.locator('select.lang').inputValue() === 'es', `${name}: "Everything" translates the letter and the menus`);
  await pickLang(page, 'Deutsch');
  await page.waitForTimeout(800);
  check(!(await dialog(page).isVisible().catch(() => false)) && await page.locator('select.lang').inputValue() === 'de', `${name}: a remembered choice no longer asks`);
  await page.locator('select.lang').selectOption({ value: '__ask' });
  await page.waitForTimeout(200);

  // Class: words change, formulas and numbers do not.
  await page.locator('.tab-new').click();
  await page.locator('.slab:has-text("Office Class")').first().click();
  await page.waitForTimeout(1500);
  const area = await page.locator(`${H} .cells-area`).boundingBox();
  for (const [i, v] of ['Ventes', '=1+1', '12'].entries()) { await page.mouse.click(area.x + 60, area.y + 12 + i * 24); await page.keyboard.type(v); await page.keyboard.press('Enter'); }
  await pickLang(page, 'English');
  check(await dialog(page).isVisible(), `${name}: after "Ask each time", the choice is asked again`);
  await dialog(page).locator('.lang-choice-option').nth(2).click(); // Document only
  await page.waitForTimeout(1200);
  const cells = await page.evaluate(h => [...document.querySelectorAll(`${h} .cells .cell`)].map(c => c.textContent.trim()).filter(Boolean), H);
  check(cells.includes('[English] Ventes') && cells.includes('2') && cells.includes('12'), `${name}: Class translates words and keeps formulas and numbers (${cells.join(', ')})`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already stopped */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`BAD ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
