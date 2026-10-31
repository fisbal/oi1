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
  await page.goto(url);
  await page.locator('.slab:has-text("Office Letter")').first().click();
  await page.waitForTimeout(1200);
  await page.locator('.body-text').click();
  await page.keyboard.press('ControlOrMeta+Shift+Space');
  await page.waitForTimeout(600); // the panel slides in
  const setup = page.locator('.copilot-setup');
  check(await setup.isVisible().catch(() => false), `${name}: the copilot asks which AI to use`);
  const select = page.locator('.copilot-provider');
  const options = await select.locator('option').allInnerTexts();
  check(options.length >= 20, `${name}: ${options.length} AIs to choose from (20+)`);
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

  const input = page.locator('.copilot textarea').first();
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
