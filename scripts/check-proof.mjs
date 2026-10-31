// Spelling, grammar and style (Martin, 2026-10-31): while typing, mistakes get a wavy underline in the language
// of each paragraph, and a bubble offers the fix. Used like a person would, in Office Letter and Office Stage,
// on PC and phone. Grammar normally asks LanguageTool online; here its answer is played back, so the check
// never depends on the network. Run after `npm run build`:
//   node scripts/check-proof.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4189;
// From the last key to the underline (rule 11: no lag). The check waits for a pause in typing first, like Word.
const MAX_MS = 2000;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
let grammarCalls = 0;

/** LanguageTool's answer for "les enfant": one agreement mistake, like the real service gives. */
async function fakeGrammar(route) {
  grammarCalls++;
  const text = new URLSearchParams(route.request().postData() ?? '').get('text') ?? '';
  const at = text.indexOf('les enfant ');
  const matches = at < 0 ? [] : [{
    offset: at + 4, length: 6, message: 'Accord en nombre : « enfants ».', replacements: [{ value: 'enfants' }],
    rule: { id: 'AGREEMENT_PLURAL', issueType: 'grammar', category: { id: 'GRAMMAR' } },
  }];
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ matches }) });
}

async function open(name, viewport, mobile, app) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  page.on('dialog', d => d.dismiss());
  await page.route('https://api.languagetool.org/**', fakeGrammar);
  await page.goto(url);
  await page.locator(`.slab:has-text("Office ${app}")`).first().click();
  await page.waitForTimeout(1200);
  return { ctx, page };
}

/** Milliseconds until `selector` shows, or -1. */
async function until(page, selector, ms = 6000) {
  const t0 = Date.now();
  try { await page.locator(selector).first().waitFor({ state: 'visible', timeout: ms }); return Date.now() - t0; } catch { return -1; }
}
async function bubbleOnScreen(page) {
  const b = await page.locator('.pf-bubble').boundingBox();
  const v = page.viewportSize();
  return !!b && b.x >= 0 && b.y >= 0 && b.x + b.width <= v.width + 1 && b.y + b.height <= v.height + 1;
}
const tapMark = async (page, sel, menu = false) => {
  const box = await page.locator(sel).first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, menu ? { button: 'right' } : {});
};

async function letter(name, viewport, mobile) {
  const { ctx, page } = await open(name, viewport, mobile, 'Letter');
  const body = page.locator('.body-text');
  await body.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.type('Bonjour, je mange une pome rouge avec les enfant de la classe. ', { delay: 15 });
  const ms = await until(page, '.body-text .pf-spell:text-is("pome")');
  check(ms >= 0, `${name}: a misspelled French word is underlined in red`);
  check(ms >= 0 && ms <= MAX_MS, `${name}: the underline shows ${ms} ms after typing stops (limit ${MAX_MS})`);
  check(await page.locator('.body-text .pf-spell').count() === 1, `${name}: only the wrong word is underlined (${await page.locator('.body-text .pf-spell').allInnerTexts()})`);
  check(await body.getAttribute('spellcheck') === 'false', `${name}: the browser's own checker does not underline a second time`);

  // The bubble: fixes to pick from, on screen, and Accept puts the word in place.
  await tapMark(page, '.body-text .pf-spell');
  await until(page, '.pf-bubble .pf-fix', 3000);
  check(await bubbleOnScreen(page), `${name}: the bubble opens fully on screen`);
  const fixes = await page.locator('.pf-bubble .pf-fix').allInnerTexts();
  check(fixes[0] === 'pomme', `${name}: the first fix is "pomme" (${fixes.slice(0, 4).join(', ')})`);
  await page.locator('.pf-bubble .pf-fix', { hasText: /^pomme$/ }).click();
  await page.waitForTimeout(500);
  check((await body.innerText()).includes('une pomme rouge'), `${name}: accepting puts "pomme" in the text`);
  check(await page.locator('.pf-bubble').count() === 0, `${name}: the bubble closes after a fix`);

  // Grammar, in blue, from the (played back) grammar service.
  const g = await until(page, '.body-text .pf-grammar:text-is("enfant")', 5000);
  check(g >= 0, `${name}: an agreement mistake is underlined in blue`);
  if (g >= 0) {
    await tapMark(page, '.body-text .pf-grammar');
    await until(page, '.pf-bubble .pf-fix', 3000);
    check((await page.locator('.pf-bubble .pf-msg').innerText()).includes('enfants'), `${name}: the bubble says what is wrong`);
    await page.locator('.pf-bubble .pf-fix', { hasText: 'enfants' }).click();
    await page.waitForTimeout(400);
    check((await body.innerText()).includes('avec les enfants de la classe'), `${name}: accepting the grammar fix changes the text`);
  }

  // A paragraph in English is checked in English, and Add to dictionary sticks.
  await page.evaluate(() => document.querySelector('.body-text').editor.commands.focus('end'));
  await page.keyboard.press('Enter');
  await page.keyboard.type('This is a sentense about the Zorblax project. ', { delay: 15 });
  check(await until(page, '.body-text .pf-spell:text-is("sentense")') >= 0, `${name}: an English paragraph is checked in English`);
  check(await page.locator('.body-text .pf-spell:text-is("about")').count() === 0, `${name}: English words are not flagged by the French dictionary`);
  await tapMark(page, '.body-text .pf-spell:text-is("Zorblax")', !mobile);
  await until(page, '.pf-bubble', 3000);
  await page.locator('.pf-bubble button', { hasText: 'Add to dictionary' }).click();
  await page.waitForTimeout(500);
  check(await page.locator('.body-text .pf-spell:text-is("Zorblax")').count() === 0, `${name}: a word added to the dictionary is no longer underlined`);
  check((await page.evaluate(() => localStorage.getItem('oi1.proof.words')) ?? '').includes('Zorblax'), `${name}: the dictionary is kept on the device`);
  await tapMark(page, '.body-text .pf-spell:text-is("sentense")');
  await until(page, '.pf-bubble .pf-fix', 3000);
  await page.locator('.pf-bubble button', { hasText: 'Ignore' }).click();
  await page.waitForTimeout(400);
  check(await page.locator('.body-text .pf-spell').count() === 0, `${name}: Ignore takes the underline away (${await page.locator('.body-text .pf-spell').allInnerTexts()})`);

  // Typing more is checked again, then the Spelling button turns the underlines off.
  await page.evaluate(() => document.querySelector('.body-text').editor.commands.focus('end'));
  await page.keyboard.type(' Encore une fautte.', { delay: 15 });
  check(await until(page, '.body-text .pf-spell:text-is("fautte")') >= 0, `${name}: typing more is checked again`);
  const tabs = page.locator('.module-host:not([hidden]) .ribbon-tabs [role=tab]');
  await tabs.filter({ hasText: 'Review' }).first().click();
  await page.waitForTimeout(200);
  await page.locator('.module-host:not([hidden]) button[aria-label="Spelling"]').first().click();
  await page.waitForTimeout(700);
  check(await page.locator('.body-text .pf').count() === 0, `${name}: the Spelling button turns the underlines off`);
  await ctx.close();
}

async function stage(name, viewport, mobile) {
  const { ctx, page } = await open(name, viewport, mobile, 'Stage');
  // The title box of the first slide, typed in like a person.
  await page.locator('.st-canvas .st-item').first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type('Nous présentons le budjet de cette année. ', { delay: 15 });
  check(await until(page, '.st-edit .pf-spell:text-is("budjet")') >= 0, `${name}: Stage underlines a misspelled word in a text box`);
  if (await page.locator('.st-edit .pf-spell').count()) {
    await tapMark(page, '.st-edit .pf-spell');
    await until(page, '.pf-bubble .pf-fix', 3000);
    check(await bubbleOnScreen(page), `${name}: Stage's bubble opens fully on screen`);
    await page.locator('.pf-bubble .pf-fix', { hasText: /^budget$/ }).click();
    await page.waitForTimeout(300);
    check((await page.locator('.st-edit').innerText()).includes('le budget de'), `${name}: Stage takes the fix`);
  }
  await ctx.close();
}

try {
  await letter('PC Letter', { width: 1440, height: 900 }, false);
  await letter('Phone Letter', { width: 390, height: 844 }, true);
  await stage('PC Stage', { width: 1440, height: 900 }, false);
  await stage('Phone Stage', { width: 390, height: 844 }, true);
  check(grammarCalls > 0, `grammar asked the (played back) service ${grammarCalls} times`);
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already stopped */ }
}
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`BAD ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
