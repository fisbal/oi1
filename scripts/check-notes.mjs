// Checks In 1 Notes like a person would, on every kind of screen (rule 16): a phone upright and sideways, a tablet
// both ways, a Windows PC and a Mac. Typing a title and notes, a to-do box from "[ ] ", a tag, the notes still there
// after reopening, a new page from a template, a new section, searching all notebooks, the tag summary, study cards,
// the page fits the screen with no sideways scrolling, zoom. Then the AI: "Make a to-do list" with an AI key (Claude's
// answer played back) becomes real to-do boxes, and with the default AI website the pasted answer comes back, on a
// PC and on a phone. Run after `npm run build`:
//   node scripts/check-notes.mjs

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4211;
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

const N = '.module-host:not([hidden]) .notes';
const overflow = page => page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
const TAB_OF = { 'notes.templates': 'Insert', 'notes.newSection': 'Organize', 'notes.study': 'AI', 'notes.ai.todo': 'AI', 'letter.zoomIn': 'View', 'ui.fitAll': 'View', 'notes.paper': 'View' };
/** A ribbon button; on a phone the ribbon is folded, so its tab is tapped first (as a person would). */
const help = (page, key, tabLabel) => ({
  async click() {
    const b = page.locator(`${N} [data-help="${key}"]:visible`).first();
    if (!(await b.count())) await page.locator(`${N} .ribbon-tabs button:text-is("${tabLabel ?? TAB_OF[key] ?? 'Home'}")`).first().click();
    await page.locator(`${N} [data-help="${key}"]:visible`).first().click();
  },
});
async function openNotes(page) {
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.locator('.slab:has-text("In 1 Notes")').first().click();
  await page.locator(`${N} .nt-text`).waitFor({ timeout: 10000 });
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
const sideOpen = async page => (await page.locator(`${N} .nt-side.open`).count()) > 0;
async function openSide(page) { if (!(await sideOpen(page))) await page.locator(`${N} .nt-open`).first().click(); await page.locator(`${N} .nt-side.open`).waitFor({ timeout: 3000 }); }
async function closeSideOnPhone(page, d) { if (d.viewport.width < 760 && await sideOpen(page)) await page.locator(`${N} .nt-close`).click(); }
const pageCount = page => page.locator(`${N} .nt-pages:not(.nt-hits) li`).count();

try {
  // ---------- 1. Every screen ----------
  for (const d of DEVICES.filter(x => !process.env.ONLY || x.name.includes(process.env.ONLY))) {
    const n = d.name;
    const { ctx, page } = await newPage(d);
    try {
      await openNotes(page);
      check(await overflow(page) <= 1, `${n}: no sideways scrolling`);
      const art = await page.locator(`${N} .nt-page`).boundingBox();
      const sc = await page.locator(`${N} .nt-scroll`).boundingBox();
      check(!!art && art.x >= sc.x - 1 && art.x + art.width <= sc.x + sc.width + 1, `${n}: the page fits the width of the screen`);
      check(d.viewport.width < 760 ? !(await sideOpen(page)) : await sideOpen(page), `${n}: the notebook list is ${d.viewport.width < 760 ? 'folded away on a phone' : 'shown on a big screen'}`);

      // Title and notes, a to-do box from "[ ] "
      await page.locator(`${N} .nt-title`).fill('Shopping day');
      await page.locator(`${N} .nt-title`).press('Enter');
      await page.keyboard.type('Bread and cheese');
      await page.keyboard.press('Enter');
      await page.keyboard.type('[ ] Call Ana');
      check(await page.locator(`${N} .nt-text ul[data-type="taskList"] > li`).count() === 1, `${n}: "[ ] " makes a to-do box`);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Capital of Italy :: Rome');

      // A tag at the start of the line
      await page.locator(`${N} .nt-text p:has-text("Bread and cheese")`).click();
      await help(page, 'notes.tags').click();
      await page.locator('.nt-tags').waitFor({ timeout: 3000 });
      const tg = await page.locator('.nt-tags').boundingBox();
      check(tg.x >= -1 && tg.x + tg.width <= d.viewport.width + 1, `${n}: the tags list is on screen`);
      check(await page.locator('.nt-tags .nt-tag').count() >= 20, `${n}: at least 20 tags`);
      await page.locator('.nt-tags .nt-tag').nth(1).click();
      check((await page.locator(`${N} .nt-text p`).first().textContent()).startsWith('⭐'), `${n}: the tag goes at the start of the line`);

      // Still there after reopening (saved on the device)
      await page.waitForTimeout(1200);
      await page.reload();
      await page.waitForTimeout(800);
      // The open tab comes back by itself; otherwise open Notes again from the home page.
      if (!(await page.locator(`${N} .nt-text`).count())) await openNotes(page);
      await page.locator(`${N} .nt-text`).waitFor({ timeout: 10000 });
      check(await page.locator(`${N} .nt-title`).inputValue() === 'Shopping day' && await page.locator(`${N} .nt-text ul[data-type="taskList"] > li`).count() === 1, `${n}: the notes are still there after reopening`);

      // Tag summary lists the tagged line and the open to-do
      await help(page, 'notes.tagSummary').click();
      await page.locator('.nt-summary').waitFor({ timeout: 3000 });
      const sum = await page.locator('.nt-summary').textContent();
      check(sum.includes('Call Ana') && sum.includes('Bread and cheese'), `${n}: the tag summary lists the to-do and the tagged line`);
      await page.locator('.oi-dialog .dialog-buttons button').last().click();

      // Study cards from the "::" line
      await help(page, 'notes.study').click();
      const card = page.locator('.nt-card');
      check(await card.waitFor({ timeout: 3000 }).then(() => true, () => false) && (await card.textContent()).includes('Capital of Italy'), `${n}: Study shows the question card`);
      await card.click();
      check((await card.textContent()).includes('Rome'), `${n}: tapping the card shows the answer`);
      await page.locator('.oi-dialog .dialog-buttons button').last().click();

      // A new page from a template (25 of them), its list on screen
      await help(page, 'notes.templates').click();
      const gal = page.locator('.nt-templates').first();
      await gal.waitFor({ timeout: 3000 });
      const gb = await gal.boundingBox();
      check(gb.x >= -1 && gb.x + gb.width <= d.viewport.width + 1, `${n}: the templates list is on screen`);
      check(await gal.locator('.nt-tpl').count() >= 20, `${n}: at least 20 page templates`);
      await gal.locator('.nt-tpl').first().click();
      await page.waitForTimeout(300);
      check((await page.locator(`${N} .nt-title`).inputValue()).startsWith('Meeting') && await page.locator(`${N} .nt-text h2`).count() >= 3, `${n}: the meeting template makes a new page`);
      await openSide(page);
      check(await pageCount(page) === 2, `${n}: the section now has 2 pages (${await pageCount(page)})`);

      // Search every notebook, open the hit
      await page.locator(`${N} .nt-find input`).fill('cheese');
      await page.waitForTimeout(150);
      const hits = page.locator(`${N} .nt-hits li button`);
      check(await hits.count() === 1, `${n}: search finds the page with "cheese"`);
      await hits.first().click();
      await page.waitForTimeout(200);
      check(await page.locator(`${N} .nt-title`).inputValue() === 'Shopping day', `${n}: a search result opens its page`);
      if (await sideOpen(page)) { await page.locator(`${N} .nt-find input`).fill(''); }
      await closeSideOnPhone(page, d);

      // A new section (asks its name in a window, not a browser prompt)
      await help(page, 'notes.newSection').click();
      await page.locator('.oi-dialog input').fill('Recipes');
      await page.locator('.oi-dialog button.primary').click();
      await openSide(page);
      check(await page.locator(`${N} .nt-secs button[role=tab]:has-text("Recipes")`).count() === 1, `${n}: a new section appears as a tab`);
      await closeSideOnPhone(page, d);

      // Paper (21) and zoom
      await help(page, 'notes.paper').click();
      check(await page.locator('.nt-papers .nt-paper-pick').count() >= 20, `${n}: at least 20 papers`);
      await page.locator('.nt-papers .nt-paper-pick').nth(1).click();
      check(await page.locator(`${N} .nt-page.nt-paper-lines`).count() === 1, `${n}: the lined paper is used`);
      await help(page, 'letter.zoomIn').click();
      const z1 = await page.locator(`${N} .status-zoom .pct`).textContent();
      await help(page, 'ui.fitAll').click();
      const z2 = await page.locator(`${N} .status-zoom .pct`).textContent();
      check(parseInt(z1) > parseInt(z2), `${n}: zoom in and back (${z1} → ${z2})`);
      check(await overflow(page) <= 1, `${n}: still no sideways scrolling after all that`);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/notes-${n.replace(/ /g, '-')}.png` });
    } catch (e) {
      problems.push(`${n}: stopped: ${String(e.message).split('\n')[0]}`);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/notes-fail-${n.replace(/ /g, '-')}.png` });
    }
    await ctx.close();
  }

  // ---------- 2. "Make a to-do list" with an AI key: the answer becomes real to-do boxes ----------
  {
    const d = DEVICES[0];
    const { ctx, page } = await newPage(d, `localStorage.setItem('oi1:ai:key', 'sk-ant-test')`);
    const asked = [];
    await page.route('https://api.anthropic.com/**', route => { asked.push(route.request().postData()); return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('- [ ] Book the room\n- [ ] Send the agenda') }); });
    await openNotes(page);
    await page.locator(`${N} .nt-text`).click();
    await page.keyboard.type('We need a room for Friday and the agenda must go out today.');
    await help(page, 'notes.ai.todo').click();
    const apply = page.locator('.copilot-apply button.primary').first();
    check(await apply.waitFor({ timeout: 8000 }).then(() => true, () => false), 'AI key: the answer comes back with "Add to the page"');
    check(asked.length === 1 && asked[0].includes('room for Friday'), 'AI key: the request carries the notes');
    await apply.click();
    check(await page.locator(`${N} .nt-text ul[data-type="taskList"] > li`).count() === 2, `AI key: the answer becomes 2 to-do boxes (${await page.locator(`${N} .nt-text ul[data-type="taskList"] > li`).count()})`);
    await ctx.close();
  }

  // ---------- 3. Default AI website (no key, no built-in AI), on a phone and a PC ----------
  for (const d of [DEVICES[4], DEVICES[0]]) {
    const n = `${d.name} web AI`;
    const { ctx, page } = await newPage({ ...d, lang: 'fr' }, `localStorage.setItem('oi1.ai.providers', JSON.stringify({ main: 'web-claude', byApp: {}, models: {}, azure: { endpoint: '', deployment: '' }, v: 2 }))`);
    await openNotes(page);
    await page.locator(`${N} .nt-text`).click();
    await page.keyboard.type('La photosynthèse transforme la lumière en énergie.');
    await help(page, 'notes.ai.summary', 'IA').click();
    const cardEl = page.locator('.web-answer');
    check(await cardEl.waitFor({ timeout: 6000 }).then(() => true, () => false), `${n}: a card explains how to bring Claude's answer back`);
    const sent = await page.evaluate(() => window.__opened?.[0] ?? '');
    check(sent.includes('claude.ai') && decodeURIComponent(sent).includes('photosynthèse'), `${n}: Claude's site opens with the notes`);
    const box = await cardEl.boundingBox();
    check(!!box && box.x >= 0 && box.x + box.width <= d.viewport.width + 1, `${n}: the Paste card is on screen`);
    await cardEl.locator('textarea').fill('- La lumière devient énergie chimique.');
    await cardEl.locator('textarea').press('ControlOrMeta+Enter');
    const apply = page.locator('.copilot-apply button.primary').first();
    check(await apply.waitFor({ timeout: 6000 }).then(() => true, () => false), `${n}: the pasted answer shows with "Ajouter à la page"`);
    await apply.click().catch(() => {});
    check(await page.locator(`${N} .nt-text:has-text("énergie chimique")`).count() === 1, `${n}: the summary is added to the page`);
    check(await overflow(page) <= 1, `${n}: no sideways scrolling`);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/notes-web-${d.name.replace(/ /g, '-')}.png` });
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
