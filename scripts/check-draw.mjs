// Checks In 1 Draw like a person would, on every kind of screen (rule 16): a phone upright and sideways, a tablet
// both ways, a Windows PC and a Mac. Drawing with the pen, a shape, moving and resizing it with the handles, undo,
// typing a text, a ready drawing, "Tidy" (a sketched circle becomes a clean ellipse), the layers, the page fits the
// screen with no sideways scrolling, and "Draw with AI": with an AI key (Claude's answer played back) and with the
// default AI website (the answer pasted back), on PC and on a phone. Run after `npm run build`:
//   node scripts/check-draw.mjs

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4210;
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
  { name: 'big screen', viewport: { width: 1920, height: 1080 } },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, mobile: true },
  { name: 'tablet sideways', viewport: { width: 1180, height: 820 }, mobile: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'phone sideways', viewport: { width: 844, height: 390 }, mobile: true },
];
const SHAPES = { shapes: [
  { type: 'rect', x: 300, y: 350, w: 500, h: 350, fill: '#F6D365', color: '#2B2D42', text: 'House' },
  { type: 'triangle', x: 260, y: 150, w: 580, h: 200, fill: '#F76B8A', color: '#2B2D42', text: '' },
  { type: 'ellipse', x: 1200, y: 80, w: 160, h: 160, fill: '#FFD60A', color: '#E09F3E', text: '' },
  { type: 'text', x: 300, y: 760, w: 500, h: 60, fill: 'none', color: '#2B2D42', text: 'Home sweet home' },
  { type: 'arrow', x: 900, y: 500, w: -80, h: 0, fill: 'none', color: '#2B2D42', text: '' },
  { type: 'script', x: 0, y: 0, w: 10, h: 10, fill: '#000', color: '#000', text: '<script>alert(1)</script>' },
] };
const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
const sse = text => ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'x', content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } })
  + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
  + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } })
  + ev('content_block_stop', { index: 0 }) + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } }) + ev('message_stop', {});

const D = '.module-host:not([hidden]) .draw';
const count = (page, sel = '') => page.locator(`${D} .dr-page .dr-shape${sel}`).count();
const overflow = page => page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
const TAB_OF = { 'draw.tool.text': 'Insert', 'draw.templates': 'Insert', 'draw.tidy': 'AI', 'draw.aiDraw': 'AI', 'draw.layers': 'View', 'letter.zoomIn': 'View', 'ui.fitAll': 'View' };
/** A ribbon button; on a phone the ribbon is folded, so its tab is tapped first (as a person would). */
const help = (page, key, tabLabel) => ({
  async click() {
    const b = page.locator(`${D} [data-help="${key}"]:visible`).first();
    if (!(await b.count())) await page.locator(`${D} .ribbon-tabs button:text-is("${tabLabel ?? TAB_OF[key] ?? 'Home'}")`).first().click();
    await page.locator(`${D} [data-help="${key}"]:visible`).first().click();
  },
});
async function tab(page, label) { await page.locator(`${D} .ribbon-tabs button:text-is("${label}")`).first().click(); }

async function openDraw(page) {
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.locator('.slab:has-text("In 1 Draw")').first().click();
  await page.locator(`${D} .dr-page`).waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
}
/** A point on the page, as a part (0..1) of the visible drawing page. */
async function at(page, fx, fy) {
  const scroller = await page.locator(`${D} .dr-scroll`).boundingBox();
  const pg = await page.locator(`${D} .dr-page`).boundingBox();
  const x0 = Math.max(pg.x, scroller.x), y0 = Math.max(pg.y, scroller.y);
  const x1 = Math.min(pg.x + pg.width, scroller.x + scroller.width), y1 = Math.min(pg.y + pg.height, scroller.y + scroller.height);
  return { x: x0 + (x1 - x0) * fx, y: y0 + (y1 - y0) * fy };
}
async function drag(page, pts) {
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 3 });
  await page.mouse.up();
}
async function newPage(d, setup) {
  const ctx = await browser.newContext({ viewport: d.viewport, isMobile: !!d.mobile, hasTouch: !!d.mobile, userAgent: d.ua, locale: d.locale ?? 'en-US' });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${d.name}: script error: ${e.message}`));
  page.on('dialog', x => x.dismiss());
  await page.addInitScript(`try { window.open = u => { (window.__opened ||= []).push(String(u)); return null; }; if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', ${JSON.stringify(d.lang ?? 'en')}); ${setup ?? ''}; sessionStorage.setItem('set', '1'); } } catch {}`);
  return { ctx, page };
}

try {
  // ---------- 1. Every screen: draw, shape, handles, undo, text, ready drawing, tidy, layers ----------
  for (const d of DEVICES.filter(x => !process.env.ONLY || x.name.includes(process.env.ONLY))) {
    const n = d.name;
    const { ctx, page } = await newPage(d);
    try {
    await openDraw(page);
    check(await overflow(page) <= 1, `${n}: no sideways scrolling`);
    const pg = await page.locator(`${D} .dr-page`).boundingBox();
    const sc = await page.locator(`${D} .dr-scroll`).boundingBox();
    check(pg.x >= sc.x - 1 && pg.x + pg.width <= sc.x + sc.width + 1 && pg.y + pg.height <= sc.y + sc.height + 1, `${n}: the whole page fits the screen when Draw opens`);
    const rib = await page.locator(`${D} .ribbon`).boundingBox();
    check(!!rib && rib.width <= d.viewport.width + 1, `${n}: the ribbon fits the width`);

    // Pen
    await help(page, 'draw.tool.pen').click();
    await drag(page, [await at(page, 0.1, 0.2), await at(page, 0.2, 0.3), await at(page, 0.3, 0.2), await at(page, 0.35, 0.35)]);
    check(await count(page, '.k-path') === 1, `${n}: the pen draws a line`);

    // A shape, then select, resize with a corner handle, move it
    await help(page, 'draw.tool.shape').click();
    await drag(page, [await at(page, 0.5, 0.5), await at(page, 0.7, 0.75)]);
    check(await count(page, '.k-geom') === 1, `${n}: a shape is drawn by dragging`);
    await help(page, 'draw.tool.select').click();
    const shape = page.locator(`${D} .dr-page .dr-shape.k-geom`).first();
    const b0 = await shape.boundingBox();
    await page.mouse.click(b0.x + b0.width / 2, b0.y + b0.height / 2);
    check(await page.locator(`${D} .dr-handle`).count() >= 8, `${n}: a selected shape shows its resize handles`);
    const corner = await page.locator(`${D} .dr-handle[data-handle="2,2"]`).boundingBox();
    await drag(page, [{ x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 }, { x: corner.x + 30, y: corner.y + 25 }]);
    const b1 = await shape.boundingBox();
    check(b1.width > b0.width + 10 && b1.height > b0.height + 10, `${n}: the corner handle makes the shape bigger (${Math.round(b0.width)} → ${Math.round(b1.width)})`);
    await drag(page, [{ x: b1.x + b1.width / 2, y: b1.y + b1.height / 2 }, { x: b1.x + b1.width / 2 - 30, y: b1.y + b1.height / 2 - 20 }]);
    const b2 = await shape.boundingBox();
    check(b2.x < b1.x - 10, `${n}: the shape moves by dragging it`);

    // Undo the move and the resize
    await help(page, 'letter.undo').click();
    await help(page, 'letter.undo').click();
    const b3 = await shape.boundingBox();
    check(Math.abs(b3.width - b0.width) < 3 && Math.abs(b3.x - b0.x) < 3, `${n}: undo puts the shape back as it was`);

    // Text from the Insert tab: type, then click away
    await tab(page, 'Insert');
    await page.locator(`${D} .ribbon-panel [data-help="draw.tool.text"].big:visible`).first().click();
    const edit = page.locator(`${D} .dr-edit`);
    await edit.waitFor({ timeout: 3000 });
    await edit.fill('Bonjour Martin');
    await page.mouse.click((await at(page, 0.95, 0.95)).x, (await at(page, 0.95, 0.95)).y);
    await page.waitForTimeout(150);
    check(await page.locator(`${D} .dr-page .dr-shape.k-text`).filter({ hasText: 'Bonjour Martin' }).count() === 1, `${n}: typing a text puts it on the page`);

    // A ready drawing (Insert > Ready drawings): its gallery is fully on screen and adds many shapes
    const before = await count(page);
    await help(page, 'draw.templates').click();
    const gal = page.locator('.dr-templates').first();
    await gal.waitFor({ timeout: 3000 });
    const gb = await gal.boundingBox();
    check(gb.x >= -1 && gb.x + gb.width <= d.viewport.width + 1, `${n}: the ready drawings list is on screen`);
    check(await gal.locator('.dr-tpl').count() >= 20, `${n}: at least 20 ready drawings`);
    await gal.locator('.dr-tpl').first().click();
    await page.waitForTimeout(200);
    check(await count(page) >= before + 5, `${n}: a ready drawing adds its shapes (${(await count(page)) - before})`);

    // Tidy: a rough circle drawn with the pen becomes a clean ellipse
    await help(page, 'letter.undo').click();
    await help(page, 'draw.tool.pen').click();
    const c = await at(page, 0.3, 0.6);
    const r = Math.min(d.viewport.width, d.viewport.height) * 0.08;
    const circle = Array.from({ length: 25 }, (_, i) => ({ x: c.x + r * Math.cos((i / 24) * Math.PI * 2) * (1 + (i % 3) * 0.03), y: c.y + r * Math.sin((i / 24) * Math.PI * 2) }));
    const geoms = await count(page, '.k-geom');
    await drag(page, circle);
    await help(page, 'draw.tidy').click();
    await page.waitForTimeout(150);
    check(await count(page, '.k-geom') === geoms + 1, `${n}: Tidy turns a sketched circle into a clean shape`);

    // Layers panel lists the shapes and stays on screen
    await help(page, 'draw.layers').click();
    const lay = await page.locator(`${D} .dr-layers`).boundingBox();
    check(!!lay && lay.x >= -1 && lay.x + lay.width <= d.viewport.width + 1 && await page.locator(`${D} .dr-layers li`).count() === await count(page), `${n}: the layers panel lists every shape, on screen`);

    // Phones: a pinch with the pen tool zooms and leaves no dots; a tap leaves no dot; the eraser takes a tiny dot
    if (d.mobile) {
      await help(page, 'draw.tool.pen').click();
      const before = await count(page);
      const mid = await at(page, 0.5, 0.5);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Input.synthesizePinchGesture', { x: mid.x, y: mid.y, scaleFactor: 1.6, gestureSourceType: 'touch', relativeSpeed: 600 });
      await page.waitForTimeout(300);
      await page.touchscreen.tap(mid.x + 20, mid.y + 20);
      await page.waitForTimeout(200);
      check(await count(page) === before, `${n}: a pinch or a tap with the pen leaves no dots (${(await count(page)) - before} extra)`);
      await help(page, 'ui.fitAll').click();
    } else {
      // A mouse click with the pen makes a dot; the eraser must be able to take it away again.
      await help(page, 'draw.tool.pen').click();
      const before = await count(page);
      const spot = await at(page, 0.85, 0.15);
      await page.mouse.click(spot.x, spot.y);
      check(await count(page) === before + 1, `${n}: a click with the pen makes a dot`);
      await help(page, 'draw.tool.eraser').click();
      await page.mouse.click(spot.x, spot.y);
      check(await count(page) === before, `${n}: the eraser removes a tiny dot`);
    }

    // Zoom: fit and +
    await help(page, 'letter.zoomIn').click();
    const z1 = await page.locator(`${D} .status-zoom .pct`).textContent();
    await help(page, 'ui.fitAll').click();
    const z2 = await page.locator(`${D} .status-zoom .pct`).textContent();
    check(parseInt(z1) > parseInt(z2), `${n}: zoom in and "see it all" work (${z1} → ${z2})`);
    check(await overflow(page) <= 1, `${n}: still no sideways scrolling after drawing`);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/draw-${n.replace(/ /g, '-')}.png` });
    } catch (e) {
      problems.push(`${n}: stopped: ${String(e.message).split('\n')[0]}`);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/draw-fail-${n.replace(/ /g, '-')}.png` });
    }
    await ctx.close();
  }

  // ---------- 2. Draw with AI, with an AI key: real, editable shapes; nothing unsafe gets in ----------
  {
    const d = DEVICES[0];
    const { ctx, page } = await newPage(d, `localStorage.setItem('oi1:ai:key', 'sk-ant-test')`);
    const asked = [];
    await page.route('https://api.anthropic.com/**', route => { asked.push(JSON.parse(route.request().postData())); return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(JSON.stringify(SHAPES)) }); });
    await openDraw(page);
    await help(page, 'draw.aiDraw').click();
    await page.locator('.dr-ai textarea').fill('a house with a sun');
    await page.locator('.dr-ai textarea').press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.module-host:not([hidden]) .draw .dr-page .dr-shape').length >= 5, null, { timeout: 8000 }).catch(() => {});
    check(await count(page) === 5, `AI key: 5 shapes drawn, the unknown one left out (${await count(page)})`);
    check(asked.length === 1 && JSON.stringify(asked[0]).includes('a house with a sun'), 'AI key: the request carries the words');
    check(!(await page.locator(`${D} .dr-page script`).count()), 'AI key: no script gets into the drawing');
    check(await page.locator(`${D} .dr-page .dr-shape`).filter({ hasText: 'Home sweet home' }).count() === 1, 'AI key: the AI text is on the page');
    check(!(await page.locator('.dr-ai').count()), 'AI key: the window closes when the drawing is made');
    await ctx.close();
  }

  // ---------- 3. Draw with AI, default AI website (no key, no built-in AI), on a phone and a PC ----------
  for (const d of [DEVICES[5], DEVICES[0]]) {
    const n = `${d.name} web AI`;
    const { ctx, page } = await newPage({ ...d, lang: 'fr' }, `localStorage.setItem('oi1.ai.providers', JSON.stringify({ main: 'web-claude', byApp: {}, models: {}, azure: { endpoint: '', deployment: '' }, v: 2 }))`);
    await openDraw(page);
    await help(page, 'draw.aiDraw', 'IA').click();
    await page.locator('.dr-ai-ideas button').first().click();
    await page.locator('.dr-ai textarea').press('Enter');
    await page.locator('.web-answer').waitFor({ timeout: 5000 });
    const sent = await page.evaluate(() => window.__opened?.[0] ?? '');
    check(sent.includes('claude.ai') && sent.length < 7000 && decodeURIComponent(sent).includes('In 1 Draw'), `${n}: Claude's site gets one short message (${sent.length} characters)`);
    const card = await page.locator('.web-answer').boundingBox();
    check(!!card && card.x >= 0 && card.x + card.width <= d.viewport.width + 1, `${n}: the Paste card is on screen`);
    await page.locator('.web-answer textarea').fill('Voici :\n```json\n' + JSON.stringify(SHAPES) + '\n```');
    await page.locator('.web-answer textarea').press('Control+Enter');
    if (process.env.SHOTS) { await page.waitForTimeout(500); await page.screenshot({ path: `${process.env.SHOTS}/draw-web-${d.name.replace(/ /g, '-')}.png` }); }
    await page.waitForFunction(() => document.querySelectorAll('.module-host:not([hidden]) .draw .dr-page .dr-shape').length >= 5, null, { timeout: 8000 }).catch(() => {});
    check(await count(page) === 5, `${n}: the pasted answer becomes 5 shapes (${await count(page)}${await page.locator('.dr-ai-error').count() ? ': ' + await page.locator('.dr-ai-error').textContent() : ''}${await page.locator('.web-answer').count() ? ', paste card still open' : ''})`);
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
