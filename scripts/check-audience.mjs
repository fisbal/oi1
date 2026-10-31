// Who is watching? (Martin, 2026-10-31): in Office Stage, pick an audience (children, seniors, investors …) and
// Claude adapts the whole deck; the person compares before and after, then keeps it or goes back. Used like a
// person would, on PC and phone. Claude's answer is played back, so the check never needs the network or a key.
// Run after `npm run build`:
//   node scripts/check-audience.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4184;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

const KIDS_TITLE = '🪐 Nos planètes';

/** Claude's streamed answer: every text item rewritten for children, a new theme and a summary. */
function claudeAnswer(body) {
  const req = JSON.parse(body);
  const prompt = req.messages[0].content;
  const themes = req.output_config.format.schema.properties.theme.enum;
  const current = prompt.match(/Current theme: (\S+)\./)[1];
  const slides = [];
  let slide = null;
  for (const line of prompt.split('\n')) {
    const s = line.match(/^Slide (\d+):/);
    if (s) { slide = { slide: Number(s[1]), texts: [], notes: 'Qui connaît une planète ?' }; slides.push(slide); continue; }
    const it = line.match(/^ {2}item (\d+) \((\w+)/);
    if (it && slide) slide.texts.push({ item: Number(it[1]), lines: it[2] === 'title' ? [KIDS_TITLE] : ['- Huit planètes tournent autour du Soleil'] });
  }
  const json = JSON.stringify({ theme: themes.find(t => t !== current), slides, summary: 'Mots simples et exemples de tous les jours.' });
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: req.model, content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } })
    + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: json } })
    + ev('content_block_stop', { index: 0 })
    + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } })
    + ev('message_stop', {});
}

async function run(name, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  page.on('dialog', d => d.dismiss());
  await page.addInitScript(() => { localStorage.setItem('oi1:ai:key', 'sk-ant-test'); localStorage.setItem('oi1:language', 'fr'); });
  let calls = 0;
  await page.route('https://api.anthropic.com/**', async route => {
    calls++;
    await new Promise(r => setTimeout(r, 400)); // long enough to see the "adapting" bar
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: claudeAnswer(route.request().postData()) });
  });
  await page.goto(url);
  await page.locator('.slab:has-text("Office Stage")').first().click();
  await page.waitForTimeout(1200);
  const host = page.locator('.module-host:not([hidden])');
  const title = page.locator('.st-canvas .st-item').first();
  await title.click();
  await page.waitForTimeout(200);
  await page.keyboard.type('Le système solaire');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const titleText = () => page.locator('.st-canvas .st-item').first().innerText();

  await host.locator('.ribbon-tabs [role=tab]:has-text("Création")').click();
  const drop = host.locator('.drop > button[title="Adapter au public"], .drop > button[aria-label="Adapter au public"]').first();
  check(await drop.count() === 1, `${name}: the Design tab has an Audience button`);
  await drop.click();
  const choices = page.locator('.st-aud-grid button');
  const n = await choices.count();
  check(n >= 20, `${name}: ${n} audiences to choose from (20+), plus one described freely`);
  const panel = await page.locator('.st-aud-menu').boundingBox();
  check(!!panel && panel.x >= 0 && panel.x + panel.width <= viewport.width + 1 && panel.y + Math.min(panel.height, 200) <= viewport.height, `${name}: the audience list opens on the screen`);
  await page.locator('.st-aud-grid button:has-text("Enfants")').click();
  check(await page.locator('.st-aud-bar.busy').isVisible().catch(() => false), `${name}: a bar says Claude is adapting the deck`);
  await page.locator('.st-aud-bar:not(.busy)').waitFor({ timeout: 10000 }).catch(() => {});
  check(calls === 1, `${name}: Claude was asked once (${calls})`);
  check((await titleText()).includes('Nos planètes'), `${name}: the slide is rewritten for children`);
  check(await page.locator('.st-canvas span[style*="font-size: 68pt"]').count() > 0, `${name}: the text is bigger for children`);
  check(await page.locator('.st-aud-bar:has-text("Enfants")').isVisible(), `${name}: the bar says who it was adapted for`);

  await page.locator('.st-aud-seg button:has-text("Avant")').click();
  check((await titleText()).includes('Le système solaire'), `${name}: "Before" shows the original slide`);
  await page.locator('.st-aud-seg button:has-text("Après")').click();
  check((await titleText()).includes('Nos planètes'), `${name}: "After" shows the adapted slide again`);
  await page.locator('.st-aud-bar button:has-text("Revenir")').click();
  check((await titleText()).includes('Le système solaire') && !(await page.locator('.st-aud-bar').count()), `${name}: "Go back" restores the original deck`);

  // On a phone the folded ribbon closed to show the bar: open the Design tab again, like a person would.
  if (!(await drop.isVisible())) await host.locator('.ribbon-tabs [role=tab]:has-text("Création")').click();
  await drop.click();
  await page.locator('.st-aud-custom input').fill('agriculteurs du Québec');
  await page.locator('.st-aud-custom button[type=submit]').click();
  await page.locator('.st-aud-bar:not(.busy)').waitFor({ timeout: 10000 }).catch(() => {});
  check(await page.locator('.st-aud-bar:has-text("agriculteurs du Québec")').isVisible().catch(() => false), `${name}: an audience described freely works too`);
  await page.locator('.st-aud-bar button:has-text("Garder")').click();
  check((await titleText()).includes('Nos planètes') && !(await page.locator('.st-aud-bar').count()), `${name}: "Keep" keeps the adapted deck`);
  await page.locator('.st-stage').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
  await page.waitForTimeout(200);
  check((await titleText()).includes('Le système solaire'), `${name}: Undo brings the deck from before back`);
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
if (problems.length) { console.log(`\n${problems.length} problem(s) with adapting to the audience.`); process.exit(1); }
console.log(`\nAdapting to the audience works: ${passed.length} checks passed on PC and phone.`);
