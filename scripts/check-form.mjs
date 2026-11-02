// Checks In 1 Form like a person would, on every kind of screen (rule 16): a phone upright and sideways, a tablet
// both ways, a Windows PC and a Mac. A question typed with its options (Enter adds the next one), required, a ready
// form from 22, undo, a theme from 22, the preview that refuses a missing answer then records one, the results bars,
// then the real round trip with no server: "Send the form" makes a file, that file is filled in another browser tab,
// its answer code is pasted into "Import answers" and shows in the results. The form still there after reopening, zoom,
// no sideways scrolling. Then "Create with AI" with an AI key (Claude's answer played back) and with the default AI
// website (the answer pasted back), on PC and phone.
// Run after `npm run build`:
//   node scripts/check-form.mjs

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4213;
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

const P = '.module-host:not([hidden]) .formapp';
const TAB_OF = { 'form.templates': 'Insert', 'form.aiCreate': 'AI', 'form.theme': 'Design', 'form.share': 'Answers', 'form.import': 'Answers', 'letter.zoomIn': 'View', 'ui.fitAll': 'View' };
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const closePeek = async page => {
  if (!(await page.locator('.module-host:not([hidden]) .ribbon.open').count())) return;
  const b = await page.locator(`${P} .fm-scroll`).boundingBox();
  await page.mouse.click(b.x + 4, b.y + b.height - 8);
  await page.waitForTimeout(150);
};
const help = (page, key, tabLabel) => ({
  async click() {
    const b = page.locator(`${P} [data-help="${key}"]:visible`).first();
    if (!(await b.count())) await page.locator(`${P} .ribbon-tabs button:text-is("${tabLabel ?? TAB_OF[key] ?? 'Home'}")`).first().click();
    await page.locator(`${P} [data-help="${key}"]:visible`).first().click();
  },
});
const view = async (page, name) => { await closePeek(page); await page.locator(`${P} .fm-views button:text-matches("^${name}")`).click(); await page.waitForTimeout(150); };
async function openForm(page) {
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.locator('.slab:has-text("In 1 Form")').first().click();
  await page.locator(`${P} .fm-scroll`).waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
}
async function newPage(d, setup) {
  const ctx = await browser.newContext({ viewport: d.viewport, isMobile: !!d.mobile, hasTouch: !!d.mobile, userAgent: d.ua, locale: d.locale ?? 'en-US', acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${d.name}: script error: ${e.message}`));
  page.on('dialog', x => x.dismiss());
  await page.addInitScript(`try { window.showSaveFilePicker = undefined; window.open = u => { (window.__opened ||= []).push(String(u)); return null; }; if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', ${JSON.stringify(d.lang ?? 'en')}); ${setup ?? ''}; sessionStorage.setItem('set', '1'); } } catch {}`);
  return { ctx, page };
}
const AI_FORM = { title: 'Football tournament', description: 'Sign up your team', questions: [
  { type: 'short', title: 'Team name', required: true, options: [], rows: [], correct: [] },
  { type: 'choice', title: 'Age group', required: true, options: ['Under 12', 'Under 16', 'Adults'], rows: [], correct: [] },
  { type: 'email', title: 'Coach e-mail', required: true, options: [], rows: [], correct: [] },
  { type: 'consent', title: 'I accept the rules', required: true, options: [], rows: [], correct: [] },
] };

try {
  for (const d of DEVICES.filter(x => !process.env.ONLY || x.name.includes(process.env.ONLY))) {
    const n = d.name;
    const { ctx, page } = await newPage(d);
    try {
      await openForm(page);
      check(await page.locator(`${P} .fm-empty`).isVisible(), `${n}: an empty form says how to start`);
      check(await overflow(page) <= 1, `${n}: no sideways scrolling`);

      // A question with its options, typed like a person
      await help(page, 'form.newQuestion').click();
      const card = page.locator(`${P} .fm-card.on`);
      await card.waitFor({ timeout: 3000 });
      await card.locator('.fm-q-title').fill('Favourite colour?');
      const opts = card.locator('.fm-opt input');
      await opts.nth(0).fill('Red');
      await opts.nth(1).fill('Blue');
      await opts.nth(2).fill('Green');
      await opts.nth(2).press('Enter');
      await page.keyboard.type('Yellow');
      check(await card.locator('.fm-opt input').count() === 4 && (await card.locator('.fm-opt input').nth(3).inputValue()) === 'Yellow', `${n}: Enter in an option adds the next one and typing goes there`);
      await card.locator('.fm-card-tools input[type=checkbox]').check();
      const cb = await card.boundingBox();
      check(cb.x >= -1 && cb.x + cb.width <= d.viewport.width + 1, `${n}: the question card fits the screen`);

      // A ready form: 20+ on screen, adds its questions; undo takes them away
      const before = await page.locator(`${P} .fm-card`).count();
      await help(page, 'form.templates').click();
      const gal = page.locator('.fm-templates').first();
      await gal.waitFor({ timeout: 3000 });
      const gb = await gal.boundingBox();
      check(gb.x >= -1 && gb.x + gb.width <= d.viewport.width + 1, `${n}: the ready forms list is on screen`);
      check(await gal.locator('.fm-tpl').count() >= 20, `${n}: at least 20 ready forms`);
      await gal.locator('.fm-tpl').first().click();
      await page.waitForTimeout(400);
      const after = await page.locator(`${P} .fm-card`).count();
      check(after === before + 5, `${n}: the contact form adds its 5 questions (${before} → ${after})`);
      await closePeek(page);
      await help(page, 'letter.undo').click();
      check(await page.locator(`${P} .fm-card`).count() === before, `${n}: undo takes the ready form away`);

      // A theme from 20+
      await help(page, 'form.theme').click();
      const themes = page.locator('.fm-themes').first();
      await themes.waitFor({ timeout: 3000 });
      check(await themes.locator('.fm-theme-pick').count() >= 20, `${n}: at least 20 themes`);
      const bg0 = await page.locator(`${P} .fm-head`).evaluate(e => e.style.background);
      await themes.locator('.fm-theme-pick').nth(5).click();
      await page.waitForTimeout(150);
      check((await page.locator(`${P} .fm-head`).evaluate(e => e.style.background)) !== bg0, `${n}: a theme changes the look`);

      // Preview: a missing required answer is refused, then the answer is recorded
      await view(page, 'Preview');
      await page.locator(`${P} .fm-submit`).click();
      check(await page.locator(`${P} .fm-fq.bad`).count() === 1, `${n}: sending without the required answer shows what is missing`);
      await page.locator(`${P} .fm-choice:has-text("Blue")`).click();
      check(await page.locator(`${P} .fm-fq.bad`).count() === 0, `${n}: answering clears the warning`);
      await page.locator(`${P} .fm-submit`).click();
      check(await page.locator(`${P} .fm-done`).isVisible(), `${n}: sending shows the thank-you message`);

      // Results
      await view(page, 'Results');
      check(await page.locator(`${P} .fm-barrow:has-text("Blue") b`).textContent() === '1', `${n}: the results count the answer`);

      // The real round trip: share the file, fill it in another tab, import its answer code
      const dl = page.waitForEvent('download', { timeout: 8000 });
      await help(page, 'form.share').click();
      const file = await (await dl).path();
      const html = await readFile(file, 'utf8');
      check(html.includes('Favourite colour?') && !html.includes('<script src'), `${n}: "Send the form" makes one file with the form inside`);
      const other = await ctx.newPage();
      await other.setContent(html);
      await other.locator('label.o:has-text("Green")').click();
      await other.locator('button.send').click();
      const code = await other.locator('.done textarea').inputValue();
      check(code.startsWith('OI1F:'), `${n}: the sent file gives an answer code`);
      const ob = await other.locator('.done').boundingBox();
      check(ob.x >= 0 && ob.x + ob.width <= d.viewport.width + 1, `${n}: the sent file fits the screen`);
      await other.close();
      await closePeek(page);
      await help(page, 'form.import').click();
      await page.locator('.fm-import textarea').fill(`Here are the answers:\n${code}\nThanks`);
      await page.locator('dialog[open] .dialog-buttons button.primary').click();
      await page.waitForTimeout(300);
      check(await page.locator(`${P} .fm-barrow:has-text("Green") b`).textContent() === '1', `${n}: the imported code shows in the results`);
      check((await page.locator(`${P} .fm-views button:text-matches("^Results")`).textContent()).includes('2'), `${n}: two answers in all`);

      // Zoom
      await view(page, 'Questions');
      await help(page, 'letter.zoomIn').click();
      const z1 = await page.locator(`${P} .status-zoom .pct`).textContent();
      await help(page, 'ui.fitAll').click();
      const z2 = await page.locator(`${P} .status-zoom .pct`).textContent();
      check(parseInt(z1) > parseInt(z2), `${n}: zoom in and "see it all" (${z1} → ${z2})`);
      const ct = await page.locator(`${P} .fm-content`).boundingBox();
      const sc = await page.locator(`${P} .fm-scroll`).boundingBox();
      check(ct.x >= sc.x - 2 && ct.x + ct.width <= sc.x + sc.width + 2, `${n}: after "see it all" the whole form is in view`);

      // Still there after reopening
      await page.waitForTimeout(800);
      await page.reload();
      await page.waitForTimeout(800);
      if (!(await page.locator(`${P} .fm-scroll`).count())) await openForm(page);
      await page.locator(`${P} .fm-scroll`).waitFor({ timeout: 10000 });
      check(await page.locator(`${P} .fm-q-title[value="Favourite colour?"]`).count() === 1 || (await page.locator(`${P} .fm-q-title`).first().inputValue()) === 'Favourite colour?', `${n}: the form is still there after reopening`);
      check((await page.locator(`${P} .fm-views button:text-matches("^Results")`).textContent()).includes('2'), `${n}: the answers are still there after reopening`);
      check(await overflow(page) <= 1, `${n}: still no sideways scrolling`);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/form-${n.replace(/ /g, '-')}.png` });
    } catch (e) {
      problems.push(`${n}: stopped: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/form-fail-${n.replace(/ /g, '-')}.png` });
    }
    await ctx.close();
  }

  // "Create with AI" with an AI key
  {
    const d = DEVICES[0];
    const { ctx, page } = await newPage(d, `localStorage.setItem('oi1:ai:key', 'sk-ant-test')`);
    const asked = [];
    await page.route('https://api.anthropic.com/**', route => { asked.push(route.request().postData()); return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(JSON.stringify(AI_FORM)) }); });
    await openForm(page);
    await help(page, 'form.aiCreate').click();
    await page.locator('.dr-ai textarea').fill('sign-up for a football tournament');
    await page.locator('.dr-ai textarea').press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.module-host:not([hidden]) .formapp .fm-card').length >= 4, null, { timeout: 8000 }).catch(() => {});
    check(await page.locator(`${P} .fm-card`).count() === 4, `AI key: the form has the 4 questions (${await page.locator(`${P} .fm-card`).count()})`);
    check(asked.length === 1 && asked[0].includes('football tournament'), 'AI key: the request carries the ask');
    check((await page.locator(`${P} .fm-title`).inputValue()) === 'Football tournament', 'AI key: the form takes the AI title');
    await ctx.close();
  }

  // Default AI website, phone and PC
  for (const d of [DEVICES[4], DEVICES[0]]) {
    const n = `${d.name} web AI`;
    const { ctx, page } = await newPage({ ...d, lang: 'fr' }, `localStorage.setItem('oi1.ai.providers', JSON.stringify({ main: 'web-chatgpt', byApp: {}, models: {}, azure: { endpoint: '', deployment: '' }, v: 3 }))`);
    await openForm(page);
    await help(page, 'form.aiCreate', 'IA').click();
    await page.locator('.dr-ai-ideas button').first().click();
    await page.locator('.dr-ai textarea').press('Enter');
    const cardEl = page.locator('.web-answer');
    check(await cardEl.waitFor({ timeout: 6000 }).then(() => true, () => false), `${n}: a card explains how to bring the AI's answer back`);
    const sent = await page.evaluate(() => window.__opened?.[0] ?? '');
    check(sent.includes('chatgpt.com') && sent.length < 7000, `${n}: ChatGPT's site gets one short message (${sent.length})`);
    const said = (() => { try { return decodeURIComponent(sent); } catch { return sent; } })();
    check(said.includes('Bonjour') && said.includes('formulaire') && !/JSON|[{}]/.test(said), `${n}: the message to the AI is plain French, with no code`);
    const bx = await cardEl.boundingBox();
    check(!!bx && bx.x >= 0 && bx.x + bx.width <= d.viewport.width + 1, `${n}: the Paste card is on screen`);
    await cardEl.locator('textarea').fill(d === DEVICES[4] ? 'Voici votre formulaire :\nTitre : Retour client\n1. Êtes-vous satisfait ? (Oui / Non)\n2. Quelle note donnez-vous ? (1 / 2 / 3 / 4 / 5)\n3. Votre e-mail ?\n4. Un commentaire ?\nMerci !' : 'Voici :\n```json\n' + JSON.stringify(AI_FORM) + '\n```');
    await cardEl.locator('textarea').press('ControlOrMeta+Enter');
    await page.waitForFunction(() => document.querySelectorAll('.module-host:not([hidden]) .formapp .fm-card').length >= 4, null, { timeout: 8000 }).catch(() => {});
    check(await page.locator(`${P} .fm-card`).count() === 4, `${n}: the pasted answer becomes 4 questions (${await page.locator(`${P} .fm-card`).count()})`);
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
