// Checks In 1 Plan like a person would, on every kind of screen (rule 16): a phone upright and sideways, a tablet
// both ways, a Windows PC and a Mac. A new task typed in its details, a ready plan, the timeline (dragging a bar moves
// the tasks that wait for it), dragging a card to another column with its handle, typing in the grid, the calendar,
// the critical path, the plan still there after reopening, zoom and no sideways scrolling. Then "Plan with AI" with
// an AI key (Claude's answer played back) and with the default AI website (the answer pasted back), on PC and phone.
// Run after `npm run build`:
//   node scripts/check-plan.mjs

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4212;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const WIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const DEVICES = [
  { name: 'Windows PC', viewport: { width: 1366, height: 768 }, ua: WIN_UA },
  { name: 'Mac', viewport: { width: 1440, height: 900 }, ua: MAC_UA },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, mobile: true },
  { name: 'tablet sideways', viewport: { width: 1180, height: 820 }, mobile: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'phone sideways', viewport: { width: 844, height: 390 }, mobile: true },
];
const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
const sse = text => ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'x', content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } })
  + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
  + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } })
  + ev('content_block_stop', { index: 0 }) + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } }) + ev('message_stop', {});

const P = '.module-host:not([hidden]) .plan';
const overflow = page => page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
const TAB_OF = { 'plan.templates': 'Insert', 'plan.aiPlan': 'AI', 'plan.critical': 'View', 'letter.zoomIn': 'View', 'ui.fitAll': 'View', 'plan.view.board': 'View' };
const help = (page, key, tabLabel) => ({
  async click() {
    const b = page.locator(`${P} [data-help="${key}"]:visible`).first();
    if (!(await b.count())) await page.locator(`${P} .ribbon-tabs button:text-is("${tabLabel ?? TAB_OF[key] ?? 'Home'}")`).first().click();
    await page.locator(`${P} [data-help="${key}"]:visible`).first().click();
  },
});
async function openPlan(page) {
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.locator('.slab:has-text("In 1 Plan")').first().click();
  await page.locator(`${P} .pl-scroll`).waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
}
async function newPage(d, setup) {
  const ctx = await browser.newContext({ viewport: d.viewport, isMobile: !!d.mobile, hasTouch: !!d.mobile, userAgent: d.ua, locale: d.locale ?? 'en-US' });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${d.name}: script error: ${e.message}`));
  page.on('dialog', x => x.dismiss());
  await page.addInitScript(`try { window.open = u => { (window.__opened ||= []).push(String(u)); return null; }; if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', ${JSON.stringify(d.lang ?? 'en')}); ${setup ?? ''}; sessionStorage.setItem('set', '1'); } } catch {}`);
  return { ctx, page };
}
// Folded ribbon on phones: a tap on the work closes the buttons opened over it (as a person would do).
const closePeek = async page => {
  if (!(await page.locator('.module-host:not([hidden]) .ribbon.open').count())) return;
  const b = await page.locator(`${P} .pl-scroll`).boundingBox();
  await page.mouse.click(b.x + 6, b.y + b.height - 12);
  await page.waitForTimeout(150);
};
const view = async (page, name) => { await closePeek(page); await page.locator(`${P} .pl-views button:text-is("${name}")`).click(); await page.waitForTimeout(150); };
const AI_PLAN = { tasks: [
  { title: 'Find a place', day: 0, days: 5, priority: 'urgent', after: -1, checklist: ['Visit 3 shops'] },
  { title: 'Buy the machine', day: 5, days: 3, priority: 'important', after: 0, checklist: [] },
  { title: 'Open the doors', day: 30, days: 1, priority: 'medium', after: 1, checklist: [] },
] };

try {
  for (const d of DEVICES.filter(x => !process.env.ONLY || x.name.includes(process.env.ONLY))) {
    const n = d.name;
    const { ctx, page } = await newPage(d);
    try {
      await openPlan(page);
      check(await page.locator(`${P} .pl-empty`).isVisible(), `${n}: an empty plan says how to start`);
      check(await overflow(page) <= 1, `${n}: no sideways scrolling`);

      // A new task, named in its details
      await help(page, 'plan.newTask').click();
      const panel = page.locator(`${P} .pl-panel`);
      await panel.waitFor({ timeout: 3000 });
      const pb = await panel.boundingBox();
      check(pb.x >= -1 && pb.x + pb.width <= d.viewport.width + 1, `${n}: the task details are on screen`);
      await panel.locator('.pl-panel-title').fill('Write the menu');
      await panel.locator('.pl-item input[placeholder]').fill('Starters');
      await panel.locator('.pl-item input[placeholder]').press('Enter');
      await panel.locator('header button').click();
      check(await page.locator(`${P} .pl-card:has-text("Write the menu")`).count() === 1, `${n}: the new task shows as a card`);
      check((await page.locator(`${P} .pl-card:has-text("Write the menu")`).textContent()).includes('0/1'), `${n}: its step shows on the card`);

      // A ready plan: 20+ of them, on screen, opens the timeline with dated bars
      await help(page, 'plan.templates').click();
      const gal = page.locator('.pl-templates').first();
      await gal.waitFor({ timeout: 3000 });
      const gb = await gal.boundingBox();
      check(gb.x >= -1 && gb.x + gb.width <= d.viewport.width + 1, `${n}: the ready plans list is on screen`);
      check(await gal.locator('.pl-tpl').count() >= 20, `${n}: at least 20 ready plans`);
      await gal.locator('.pl-tpl').first().click();
      await page.waitForTimeout(400);
      const bars = page.locator(`${P} .pl-tl-bar`);
      check(await bars.count() === 7, `${n}: the project plan adds its 6 tasks to the timeline (${await bars.count()} bars)`);

      // Drag the first project bar 3 days later: the task that waits for it follows
      const b1 = page.locator(`${P} .pl-tl-bar[aria-label^="Define the goal"]`);
      const b2 = page.locator(`${P} .pl-tl-bar[aria-label^="List the tasks"]`);
      const l2 = (await b2.getAttribute('aria-label'));
      const box = await b1.boundingBox();
      const dw = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.module-host:not([hidden]) .pl-timeline')).getPropertyValue('--dw')));
      const zk = Number((await page.locator(`${P} .status-zoom .pct`).textContent()).replace(/\D/g, '')) / 100;
      await page.mouse.move(box.x + 8, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 8 + dw * zk * 3, box.y + box.height / 2, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      check((await b2.getAttribute('aria-label')) !== l2, `${n}: moving a bar moves the task that waits for it`);
      await help(page, 'letter.undo').click();
      check((await b2.getAttribute('aria-label')) === l2, `${n}: undo puts the dates back`);

      // Critical path circles a chain
      await help(page, 'plan.critical').click();
      check(await page.locator(`${P} .pl-tl-bar.critical`).count() >= 2, `${n}: the critical path is shown`);

      // Board: drag a card by its handle to the second column
      await view(page, 'Board');
      const card = page.locator(`${P} .pl-card:has-text("Write the menu")`);
      await card.scrollIntoViewIfNeeded();
      const grip = await card.locator('.pl-grip').boundingBox();
      const col2 = page.locator(`${P} .pl-col`).nth(1);
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.mouse.down();
      // On a narrow screen the next column is off screen: hold the card at the edge until the board scrolls to it.
      let c2 = await col2.locator('header').boundingBox();
      if (c2.x + c2.width / 2 > d.viewport.width - 10) {
        await page.mouse.move(d.viewport.width - 20, grip.y + 40, { steps: 8 });
        for (let i = 0; i < 40 && c2.x + c2.width / 2 > d.viewport.width - 60; i++) { await page.waitForTimeout(60); await page.mouse.move(d.viewport.width - 20 - (i % 2), grip.y + 40); c2 = await col2.locator('header').boundingBox(); }
      }
      await page.mouse.move(c2.x + c2.width / 2, c2.y + 60, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      check(await col2.locator('.pl-card:has-text("Write the menu")').count() === 1, `${n}: a card dragged by its handle lands in the other column`);

      // Grid: type a new name
      await view(page, 'Grid');
      const cell = page.locator(`${P} .pl-grid input[value="Write the menu"]`);
      await cell.fill('Write the new menu');
      check(await page.locator(`${P} .pl-grid input[value="Write the new menu"]`).count() === 1, `${n}: typing in the grid renames the task`);

      // Calendar shows the tasks
      await view(page, 'Calendar');
      check(await page.locator(`${P} .pl-cal-task`).count() >= 3, `${n}: the calendar shows the tasks on their days`);
      check(await overflow(page) <= 1, `${n}: no sideways scrolling in the calendar`);

      // Zoom on the timeline
      await view(page, 'Timeline');
      await help(page, 'letter.zoomIn').click();
      const z1 = await page.locator(`${P} .status-zoom .pct`).textContent();
      await help(page, 'ui.fitAll').click();
      const z2 = await page.locator(`${P} .status-zoom .pct`).textContent();
      check(parseInt(z1) > parseInt(z2), `${n}: zoom in and "see it all" (${z1} → ${z2})`);
      const tl = await page.locator(`${P} .pl-timeline`).boundingBox();
      const sc = await page.locator(`${P} .pl-scroll`).boundingBox();
      check(tl.x + tl.width <= sc.x + sc.width + 2, `${n}: after "see it all" the whole timeline is in view`);

      // Still there after reopening
      await page.waitForTimeout(800);
      await page.reload();
      await page.waitForTimeout(800);
      if (!(await page.locator(`${P} .pl-scroll`).count())) await openPlan(page);
      await page.locator(`${P} .pl-scroll`).waitFor({ timeout: 10000 });
      await view(page, 'Grid');
      check(await page.locator(`${P} .pl-grid input[value="Write the new menu"]`).count() === 1, `${n}: the plan is still there after reopening`);
      check(await overflow(page) <= 1, `${n}: still no sideways scrolling`);
      if (process.env.SHOTS) { await view(page, 'Timeline'); await page.screenshot({ path: `${process.env.SHOTS}/plan-${n.replace(/ /g, '-')}.png` }); }
    } catch (e) {
      problems.push(`${n}: stopped: ${String(e.message).split('\n')[0]}`);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/plan-fail-${n.replace(/ /g, '-')}.png` });
    }
    await ctx.close();
  }

  // "Plan with AI" with an AI key
  {
    const d = DEVICES[0];
    const { ctx, page } = await newPage(d, `localStorage.setItem('oi1:ai:key', 'sk-ant-test')`);
    const asked = [];
    await page.route('https://api.anthropic.com/**', route => { asked.push(route.request().postData()); return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(JSON.stringify(AI_PLAN)) }); });
    await openPlan(page);
    await help(page, 'plan.aiPlan').click();
    await page.locator('.dr-ai textarea').fill('open a coffee shop');
    await page.locator('.dr-ai textarea').press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.module-host:not([hidden]) .plan .pl-tl-bar').length >= 3, null, { timeout: 8000 }).catch(() => {});
    check(await page.locator(`${P} .pl-tl-bar`).count() === 3, `AI key: the plan has the 3 tasks (${await page.locator(`${P} .pl-tl-bar`).count()})`);
    check(asked.length === 1 && asked[0].includes('open a coffee shop'), 'AI key: the request carries the goal');
    check(await page.locator(`${P} .pl-tl-dep`).count() === 2, 'AI key: the tasks wait for each other as the AI said');
    await ctx.close();
  }

  // Default AI website, phone and PC
  for (const d of [DEVICES[4], DEVICES[0]]) {
    const n = `${d.name} web AI`;
    const { ctx, page } = await newPage({ ...d, lang: 'fr' }, `localStorage.setItem('oi1.ai.providers', JSON.stringify({ main: 'web-claude', byApp: {}, models: {}, azure: { endpoint: '', deployment: '' }, v: 2 }))`);
    await openPlan(page);
    await help(page, 'plan.aiPlan', 'IA').click();
    await page.locator('.dr-ai-ideas button').first().click();
    await page.locator('.dr-ai textarea').press('Enter');
    const cardEl = page.locator('.web-answer');
    check(await cardEl.waitFor({ timeout: 6000 }).then(() => true, () => false), `${n}: a card explains how to bring Claude's answer back`);
    const sent = await page.evaluate(() => window.__opened?.[0] ?? '');
    check(sent.includes('claude.ai') && sent.length < 7000, `${n}: Claude's site gets one short message (${sent.length})`);
    const bx = await cardEl.boundingBox();
    check(!!bx && bx.x >= 0 && bx.x + bx.width <= d.viewport.width + 1, `${n}: the Paste card is on screen`);
    await cardEl.locator('textarea').fill('Voici :\n```json\n' + JSON.stringify(AI_PLAN) + '\n```');
    await cardEl.locator('textarea').press('ControlOrMeta+Enter');
    await page.waitForFunction(() => document.querySelectorAll('.module-host:not([hidden]) .plan .pl-tl-bar').length >= 3, null, { timeout: 8000 }).catch(() => {});
    check(await page.locator(`${P} .pl-tl-bar`).count() === 3, `${n}: the pasted answer becomes 3 tasks (${await page.locator(`${P} .pl-tl-bar`).count()})`);
    check(await overflow(page) <= 1, `${n}: no sideways scrolling`);
    await ctx.close();
  }
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already stopped */ }
}

for (const p of passed) console.log(`✓ ${p}`);
for (const p of problems) console.log(`✗ ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
