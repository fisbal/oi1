// Choose your copilot (Martin, 2026-10-31): each person picks the AI behind the copilot (Claude, ChatGPT,
// Gemini, Microsoft, Mistral, DeepSeek, a local model …), gives their own key, and the copilot answers with it.
// Used like a person would in Office Letter, on PC and phone. The AI's answer is played back, so the check
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

async function run(name, viewport, mobile) {
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
  await page.addInitScript(() => { window.__opened = []; window.open = u => { window.__opened.push(String(u)); return null; }; });
  await page.goto(url);
  await page.locator('.slab:has-text("Office Letter")').first().click();
  await page.waitForTimeout(1200);
  await page.locator('.body-text').click();
  await page.keyboard.press('ControlOrMeta+Shift+Space');
  await page.waitForTimeout(600); // the panel slides in

  // No key at all: the copilot works at once with Claude, free, through the person's Puter account.
  check(!(await page.locator('.copilot-setup').count()), `${name}: the copilot opens ready, no key asked`);
  check(await page.locator('.copilot-name:has-text("Claude")').isVisible().catch(() => false), `${name}: it uses Claude (free) by default`);
  const input = page.locator('.copilot textarea').first();
  await input.fill('Écris une phrase de bienvenue');
  await input.press('Enter');
  check(await page.locator('.copilot-msg:has-text("Bienvenue de Claude gratuit")').first().waitFor({ timeout: 8000 }).then(() => true, () => false), `${name}: the free answer is written right in the copilot, no key, no copy-paste`);
  check(puterAsked.length === 1 && puterAsked[0].includes('Écris une phrase de bienvenue'), `${name}: the request (with the letter it is about) goes through Puter`);

  // The public site: the AI's own page with the person's account, then "Paste the answer".
  await page.locator('.copilot-head button[aria-label="Settings"]').click();
  await page.locator('.copilot-modes button').nth(1).click();
  const webOptions = await page.locator('.copilot-provider option').allInnerTexts();
  check(webOptions.length >= 20, `${name}: ${webOptions.length} public AI sites to choose from (20+)`);
  for (const want of ['Claude.ai', 'ChatGPT', 'Gemini', 'Microsoft Copilot', 'Le Chat', 'DeepSeek']) check(webOptions.some(o => o.includes(want)), `${name}: ${want} is in the list`);
  await page.locator('.copilot-setup button[type=submit]').click();
  await input.fill('Écris une phrase de bienvenue');
  await input.press('Enter');
  const card = page.locator('.web-answer');
  check(await card.waitFor({ timeout: 4000 }).then(() => true, () => false), `${name}: a card says the request is open in Claude.ai and how to bring the answer back`);
  const opened = await page.evaluate(() => window.__opened);
  check(opened.length === 1 && opened[0].startsWith('https://claude.ai/new?q=') && decodeURIComponent(opened[0]).includes('Écris une phrase de bienvenue'), `${name}: Claude.ai opens with the request already written`);
  const cardBox = await card.boundingBox();
  check(!!cardBox && cardBox.x >= 0 && cardBox.x + cardBox.width <= viewport.width + 1 && cardBox.y + cardBox.height <= viewport.height + 1, `${name}: the card fits on the screen`);
  await card.locator('textarea').fill('Bienvenue à tous !');
  await card.locator('textarea').press('ControlOrMeta+Enter');
  check(await page.locator('.copilot-msg:has-text("Bienvenue à tous !")').first().waitFor({ timeout: 4000 }).then(() => true, () => false), `${name}: the pasted answer shows in the copilot, ready to put in the letter`);
  check(!(await card.count()), `${name}: the card goes away once the answer is back`);

  await page.locator('.copilot-head button[aria-label="Settings"]').click();
  const setup = page.locator('.copilot-setup');
  check(await setup.isVisible().catch(() => false), `${name}: the settings show how to use the copilot`);
  check(await page.locator('.copilot-modes button').count() === 4, `${name}: four ways: free, public site, built into the browser, API key`);
  await page.locator('.copilot-modes button').nth(0).click();
  const freeOptions = await page.locator('.copilot-provider option').allInnerTexts();
  check(freeOptions.length >= 20, `${name}: ${freeOptions.length} free AIs answering in the app (20+)`);
  check(await page.locator('.copilot-account').isVisible(), `${name}: free mode shows the Puter account (sign in / signed in)`);
  await page.locator('.copilot-modes button').nth(2).click();
  check(await page.locator('.copilot-setup .copilot-fine').first().isVisible(), `${name}: the built-in browser AI says whether this browser has one`);
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
  await run('Phone', { width: 390, height: 844 }, true);
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already gone */ }
}
for (const p of passed) console.log(`  ✓ ${p}`);
for (const p of problems) console.log(`  ✗ ${p}`);
if (problems.length) { console.log(`\n${problems.length} problem(s) with choosing the copilot.`); process.exit(1); }
console.log(`\nChoosing the copilot works: ${passed.length} checks passed on PC and phone.`);
