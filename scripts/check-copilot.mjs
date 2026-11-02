// Choose your copilot (Martin, 2026-10-31): each person picks the AI behind the copilot (ChatGPT, Microsoft Copilot,
// Gemini, Claude, Mistral, DeepSeek, a local model …). Free with no account by default (Martin, 2026-11-02: "not
// everyone uses Claude and Claude is not free"): a site that needs no account, or In 1 AI on the device itself.
// Used like a person would in In 1 Letter, on PC and phone. The AI's answer is played back, so the check
// never depends on the network or a real key. Run after `npm run build`:
//   node scripts/check-copilot.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4185;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

const sse = events => events.map(e => `data: ${e}\n\n`).join('');

async function run(name, viewport, mobile, portrait) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  page.on('dialog', d => d.dismiss());
  const asked = [];
  await page.route('https://api.openai.com/**', async route => {
    asked.push({ url: route.request().url(), auth: route.request().headers().authorization });
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse([JSON.stringify({ choices: [{ delta: { content: 'Bonjour de ChatGPT' } }] }), '[DONE]']) });
  });
  // Puter is played back: a small stand-in for its script, answering like the real one streams.
  const puterAsked = [];
  await page.exposeFunction('__puterAsked', p => { puterAsked.push(String(p)); });
  await page.route('https://js.puter.com/**', route => route.fulfill({ contentType: 'text/javascript', body: `window.puter = {
    auth: { isSignedIn: () => true, signIn: async () => {}, signOut: () => {}, getUser: async () => ({ username: 'martin' }) },
    ai: { chat: async (prompt) => { window.__puterAsked(prompt); return (async function* () { yield { text: 'Bienvenue de ' }; yield { text: 'Claude gratuit' }; })(); } },
  };` }));
  // The public sites are not opened for real: their address is kept to check the request is in it.
  // In 1 AI's model is played back too (REAL_LLM=1 runs the real one, once, on PC).
  const real = !!process.env.REAL_LLM && name === 'PC';
  await page.addInitScript(r => {
    delete window.LanguageModel; window.__opened = []; window.open = u => { window.__opened.push(String(u)); return null; };
    if (!r) window.__oi1FakeLlm = m => { (window.__llmAsked ||= []).push(m); return 'Bonjour, je suis In 1 AI.'; };
  }, real);
  await page.goto(url);
  await page.locator('.slab:has-text("In 1 Letter")').first().click();
  await page.waitForTimeout(1200);
  if (portrait === false) await page.locator('.status').first().click().catch(() => {});
  await page.locator('.body-text').click();
  await page.keyboard.press('ControlOrMeta+Shift+Space');
  await page.waitForTimeout(600); // the panel slides in

  // The first time, the copilot shows the free choices before anything else: on this device, a free site, Puter, a key.
  const setup = page.locator('.copilot-setup');
  check(await setup.isVisible().catch(() => false), `${name}: the first time, the copilot shows the choices`);
  check(await page.locator('.copilot-modes button').count() === 4, `${name}: four ways: on this device, free site, Puter account, API key`);
  const first = await setup.boundingBox();
  check(!!first && first.x >= 0 && first.x + first.width <= viewport.width + 1, `${name}: the choices fit on the screen`);
  check(await setup.locator('.copilot-provider option:checked').innerText().then(t => t.startsWith('ChatGPT') && /no account/.test(t)).catch(() => false), `${name}: ChatGPT is picked, marked "no account"`);
  check(!(await page.locator('.copilot-setup a.copilot-link').count()), `${name}: no sign-in link for a site that needs no account`);
  const webOptions = await page.locator('.copilot-provider option').allInnerTexts();
  check(webOptions.length >= 20, `${name}: ${webOptions.length} free AI sites to choose from (20+)`);
  check(webOptions.filter(o => /no account/.test(o)).length >= 5, `${name}: ${webOptions.filter(o => /no account/.test(o)).length} of them need no account (5+)`);
  for (const want of ['ChatGPT', 'Microsoft Copilot', 'Duck.ai', 'Gemini', 'Claude.ai', 'Le Chat', 'DeepSeek']) check(webOptions.some(o => o.includes(want)), `${name}: ${want} is in the list`);
  // "Later" keeps the free default (ChatGPT, no account) and does not ask again.
  await page.locator('.copilot-setup-buttons button:has-text("Later")').click();
  check(await page.locator('.copilot-name:has-text("ChatGPT")').isVisible().catch(() => false), `${name}: "Later" uses ChatGPT, which needs no account`);
  const input = page.locator('.copilot textarea').first();
  await input.fill('Écris une phrase de bienvenue');
  await input.press('Enter');
  const card = page.locator('.web-answer');
  check(await card.waitFor({ timeout: 4000 }).then(() => true, () => false), `${name}: a card says the request is open in ChatGPT and how to bring the answer back`);
  const opened = await page.evaluate(() => window.__opened);
  check(opened.length === 1 && opened[0].startsWith('https://chatgpt.com/?q=') && decodeURIComponent(opened[0]).includes('Écris une phrase de bienvenue'), `${name}: ChatGPT opens with the request already written`);
  check(!puterAsked.length, `${name}: Puter is not asked (no account needed)`);
  const cardBox = await card.boundingBox();
  check(!!cardBox && cardBox.x >= 0 && cardBox.x + cardBox.width <= viewport.width + 1 && cardBox.y + cardBox.height <= viewport.height + 1, `${name}: the card fits on the screen`);
  await card.locator('textarea').fill('Bienvenue à tous !');
  await card.locator('textarea').press('ControlOrMeta+Enter');
  check(await page.locator('.copilot-msg:has-text("Bienvenue à tous !")').first().waitFor({ timeout: 4000 }).then(() => true, () => false), `${name}: the pasted answer shows in the copilot, ready to put in the letter`);
  check(!(await card.count()), `${name}: the card goes away once the answer is back`);
  await page.reload();
  await page.locator('.slab:has-text("In 1 Letter")').first().click().catch(() => {});
  await page.waitForTimeout(1200);
  if (portrait === false) await page.locator('.status').first().click().catch(() => {});
  await page.locator('.body-text').first().click();
  await page.keyboard.press('ControlOrMeta+Shift+Space');
  await page.waitForTimeout(600);
  check(!(await setup.count()), `${name}: after the first choice the copilot opens ready (no question again)`);

  // In 1 AI, on this device: free, no account, answers right in the copilot, no site to open.
  await page.locator('.copilot-head button[aria-label="Settings"]').click();
  await page.locator('.copilot-modes button').nth(0).click();
  check(await page.locator('.copilot-device').innerText().then(t => /In 1 AI/.test(t) && /500 MB/.test(t)).catch(() => false), `${name}: In 1 AI says it is free, private and downloads once (about 500 MB)`);
  const get = page.locator('.copilot-setup button[type=submit]');
  check(await get.innerText().then(t => /Download/.test(t)).catch(() => false), `${name}: the button says it downloads first`);
  await get.click();
  check(await page.locator('.copilot-name:has-text("In 1 AI")').isVisible().catch(() => false), `${name}: the copilot now uses In 1 AI`);
  if (real) check(await page.locator('.copilot-device-bar').waitFor({ timeout: 20000 }).then(() => true, () => false), `${name}: the download shows how far it is`);
  await input.fill('Réponds seulement : bonjour');
  await input.press('Enter');
  const reply = real ? page.locator('.copilot-msg.claude:not(.error)').last() : page.locator('.copilot-msg:has-text("Bonjour, je suis In 1 AI.")').first();
  const got = real ? await page.waitForFunction(() => { const m = [...document.querySelectorAll('.copilot-msg.claude')].pop(); return m && !m.hasAttribute('aria-live') && /\p{L}{2}/u.test(m.textContent || ''); }, null, { timeout: 600000 }).then(() => true, () => false) : await reply.waitFor({ timeout: 6000 }).then(() => true, () => false);
  check(got, `${name}: In 1 AI answers right in the copilot${real ? ' (real model: ' + JSON.stringify((await reply.innerText().catch(() => '')).slice(0, 60)) + ')' : ''}`);
  check(!(await page.locator('.copilot-msg.error').count()), `${name}: no error from In 1 AI`);
  check((await page.evaluate(() => window.__opened.length)) === 0, `${name}: no website opens with In 1 AI`);
  check(await page.evaluate(() => localStorage.getItem('oi1.ai.device.ready') === '1'), `${name}: In 1 AI is remembered as downloaded`);

  // Puter stays for those who have an account: the answer is written right in the copilot.
  await page.locator('.copilot-head button[aria-label="Settings"]').click();
  await page.locator('.copilot-modes button').nth(2).click();
  const freeOptions = await page.locator('.copilot-provider option').allInnerTexts();
  check(freeOptions.length >= 20, `${name}: ${freeOptions.length} AIs through a Puter account (20+)`);
  check(await page.locator('.copilot-account').isVisible(), `${name}: Puter mode shows the Puter account (sign in / signed in)`);
  await page.locator('.copilot-setup button[type=submit]').click();
  await input.fill('Écris une phrase de bienvenue');
  await input.press('Enter');
  check(await page.locator('.copilot-msg:has-text("Bienvenue de Claude gratuit")').first().waitFor({ timeout: 8000 }).then(() => true, () => false), `${name}: with Puter the answer is written right in the copilot`);
  check(puterAsked.length === 1 && puterAsked[0].includes('Écris une phrase de bienvenue'), `${name}: the request (with the letter it is about) goes through Puter`);

  await page.locator('.copilot-head button[aria-label="Settings"]').click();
  await page.locator('.copilot-modes button').nth(3).click();

  const select = page.locator('.copilot-provider');
  const options = await select.locator('option').allInnerTexts();
  check(options.length >= 20, `${name}: ${options.length} AIs with an API key (20+)`);
  for (const want of ['Claude', 'ChatGPT', 'Gemini', 'Microsoft', 'Mistral', 'DeepSeek', 'Ollama']) {
    check(options.some(o => o.includes(want)), `${name}: ${want} is in the list`);
  }
  const box = await setup.boundingBox();
  check(!!box && box.x >= 0 && box.x + box.width <= viewport.width + 1, `${name}: the setup fits on the screen`);

  await select.selectOption({ label: options.find(o => o.includes('Microsoft Azure')) });
  check(await page.locator('.copilot-setup input[placeholder^="https://"]').isVisible(), `${name}: Microsoft Azure asks for its resource address`);
  await select.selectOption({ label: options.find(o => o.includes('Ollama')) });
  check(await page.locator('.copilot-setup input[type=password]').count() === 0, `${name}: a local AI needs no key`);

  await select.selectOption({ label: options.find(o => o.includes('ChatGPT')) });
  const connect = page.locator('.copilot-setup button[type=submit]');
  check(await connect.isDisabled(), `${name}: Connect waits for a key`);
  await page.locator('.copilot-setup input[type=password]').fill('sk-test-key');
  await connect.click();
  check(await page.locator('.copilot-name:has-text("ChatGPT")').isVisible().catch(() => false), `${name}: the copilot shows it now uses ChatGPT`);

  await input.fill('Dis bonjour');
  await input.press('Enter');
  const answered = await page.locator('.copilot-msg:has-text("Bonjour de ChatGPT")').first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  check(answered, `${name}: ChatGPT's answer shows in the copilot`);
  check(asked.length > 0 && asked[0].auth === 'Bearer sk-test-key', `${name}: the person's own key is sent to ChatGPT, and only there`);
  const stored = await page.evaluate(() => localStorage.getItem('oi1.ai.providers'));
  check(!!stored && stored.includes('"main":"openai"'), `${name}: the choice is remembered on this device`);
  await ctx.close();
}

try {
  await run('PC', { width: 1366, height: 800 }, false);
  await run('Mac', { width: 1440, height: 900 }, false);
  await run('Phone', { width: 390, height: 844 }, true);
  await run('Phone sideways', { width: 844, height: 390 }, true, false);
  await run('Tablet', { width: 820, height: 1180 }, true);
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already gone */ }
}
for (const p of passed) console.log(`  ✓ ${p}`);
for (const p of problems) console.log(`  ✗ ${p}`);
if (problems.length) { console.log(`\n${problems.length} problem(s) with choosing the copilot.`); process.exit(1); }
console.log(`\nChoosing the copilot works: ${passed.length} checks passed on PC, Mac, phone (both ways) and tablet.`);
