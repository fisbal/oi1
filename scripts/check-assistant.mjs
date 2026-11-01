// Checks Office Assistant like a person would: a task in plain words becomes a plan, then real documents in the
// Offices, linked together (a Class table inside a letter follows a change made in the sheet). Without AI from the
// built-in recipes; with an AI (Claude's answer played back) from the AI's plan, edited before making it. Also on a
// phone, upright and sideways, and from the "Je veux…" capsule. Run after `npm run build`:
//   node scripts/check-assistant.mjs

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4209;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

const PLAN = {
  title: 'Garden club',
  summary: 'Accounts, a letter with the linked table, slides and a page.',
  steps: [
    { app: 'class', name: 'Club accounts', purpose: 'Money in and out', html: '', rows: [['Line', 'Amount'], ['Fees', '300'], ['Seeds', '120'], ['Total', '=SUM(B2:B3)']], files: [], table: -1, from: -1 },
    { app: 'letter', name: 'Letter to members', purpose: 'Shares the accounts', html: '<p>Dear members,</p><p>[[TABLE]]</p><p>See you soon.</p>', rows: [], files: [], table: 0, from: -1 },
    { app: 'stage', name: 'Club slides', purpose: 'For the meeting', html: '<h2>Our year</h2><ul><li>Seeds</li></ul>', rows: [], files: [], table: 0, from: -1 },
    { app: 'code', name: 'Club page', purpose: 'A small site', html: '', rows: [], files: [{ path: 'index.html', content: '<!doctype html><title>Club</title><h1>Garden club</h1>' }], table: -1, from: -1 },
  ],
};
const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
const sse = text => ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'x', content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } })
  + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
  + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } })
  + ev('content_block_stop', { index: 0 }) + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } }) + ev('message_stop', {});

const H = '.module-host:not([hidden])';
const showTab = (page, app) => page.locator(`nav.tabs .tab[title^="Office ${app}"]`).first().click();
const tabCount = (page, app) => page.locator(`nav.tabs .tab[title^="Office ${app}"]`).count();
const letterTable = page => page.evaluate(() => [...document.querySelectorAll('.module-host:not([hidden]) table[data-link^="lp_"] td')].map(c => c.textContent.trim()));
const overflow = page => page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
async function clickCell(page, text) {
  const box = await page.locator(`${H} .cells .cell:has(span:text-is("${text}"))`).first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function openAssistant(page) {
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.locator('.slab:has-text("Office Assistant")').first().click();
  await page.locator('.as').first().waitFor({ timeout: 8000 });
}
async function newPage(viewport, locale, mobile, setup) {
  const ctx = await browser.newContext({ viewport, locale, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${locale} ${viewport.width}: script error: ${e.message}`));
  page.on('dialog', d => d.dismiss());
  // Not in the sandboxed previews (Code+), which have no storage.
  if (setup) await page.addInitScript(`try { (${setup.toString()})(); } catch {}`);
  return { ctx, page };
}

try {
  // ---------- 1. Without AI: "fais-moi un budget et un courrier pour la banque" ----------
  {
    const { ctx, page } = await newPage({ width: 1366, height: 800 }, 'fr-FR', false, () => { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'fr'); sessionStorage.setItem('set', '1'); } });
    await openAssistant(page);
    check(await page.locator('.as-idea').count() >= 24, 'PC: at least 24 idea cards');
    check(await overflow(page) <= 1, 'PC: no sideways scrolling');
    check(!(await page.locator('.app-frame[data-app="assistant"] .want-pill').count()), 'PC: no "Je veux…" capsule on the Assistant itself (it has no ribbon)');
    await page.locator('.as-switch').click();
    await page.locator('.as-input').fill('fais-moi un budget et un courrier pour la banque');
    await page.locator('.as-go').click();
    await page.locator('.as-plan').waitFor({ timeout: 5000 });
    const apps = await page.locator('.as-step .as-badge').allTextContents();
    check(apps.join(',') === 'C,L,PDF', `no AI: the plan is a sheet, a letter and a PDF (${apps.join(',')})`);
    check(await page.locator('.as-step .as-link').count() >= 2, 'no AI: the plan shows which documents are linked');
    // Preview of the sheet before making it.
    await page.locator('.as-step').first().locator('button:has-text("Aperçu")').click();
    check(await page.locator('.as-preview table tr').count() >= 10, 'no AI: the sheet can be previewed before it is made');
    await page.locator('.as-plan-bar .as-go').click();
    await page.locator('.as-done').waitFor({ timeout: 15000 });
    check(await tabCount(page, 'Letter') === 1 && await tabCount(page, 'Class') === 1, 'no AI: the letter and the sheet open in their Offices');
    check(await page.locator('.app-frame[data-app="assistant"]:not([hidden])').count() === 1, 'no AI: the Assistant stays on screen with the results');
    await showTab(page, 'Letter');
    await page.waitForTimeout(1500);
    let cells = await letterTable(page);
    check(cells.includes('Reste à vivre') && cells.some(c => c.replace(/\s/g, '') === '755'), `no AI: the letter holds the linked budget with its total worked out (${cells.slice(-4).join(' | ')})`);
    await showTab(page, 'Class');
    await page.waitForTimeout(1500);
    await clickCell(page, '2400');
    await page.keyboard.type('2500');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await showTab(page, 'Letter');
    await page.waitForTimeout(1200);
    cells = await letterTable(page);
    check(cells.some(c => c.replace(/\s/g, '') === '855'), `no AI: a change in the sheet shows in the letter (${cells.slice(-2).join(' | ')})`);
    await page.locator('nav.tabs .tab[title^="Office Assistant"]').first().click();
    await page.waitForTimeout(300);
    check(await page.locator('.as-step button:text-is("Ouvrir")').count() === 2, 'no AI: each document has an Open button');
    check(await page.locator('.as-step button:has-text("Enregistrer le PDF")').count() === 1, 'no AI: the PDF can be saved');
    await page.locator('.as-plan-bar .as-go').click();
    check(await page.locator('.as-history li').count() === 1, 'no AI: the task is in the recent tasks');
    await page.locator('.as-history li button:has-text("Voir le plan")').click();
    check(await page.locator('.as-step').count() === 3, 'no AI: a recent task opens its plan again');

    // From "Je veux…" in another app.
    await showTab(page, 'Letter');
    await page.waitForTimeout(400);
    await page.locator(`.app-frame:not([hidden]) .want-pill`).click();
    await page.locator('.want-input').fill('une facture pour mon client');
    await page.locator('.want-assistant').click();
    await page.waitForTimeout(600);
    check(await page.locator('.app-frame[data-app="assistant"]:not([hidden])').count() === 1 && await page.locator('.as-input').inputValue() === 'une facture pour mon client',
      '"Je veux…": the request goes to the open Assistant');
    check(await tabCount(page, 'Assistant') === 1, '"Je veux…": no second Assistant tab');
    await ctx.close();
  }

  // ---------- 2. With an AI: Claude plans four documents; the person edits the plan ----------
  {
    const { ctx, page } = await newPage({ width: 1440, height: 900 }, 'en-US', false, () => { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:ai:key', 'sk-ant-test'); localStorage.setItem('oi1:language', 'en'); sessionStorage.setItem('set', '1'); } });
    const asked = [];
    await page.route('https://api.anthropic.com/**', route => { asked.push(JSON.parse(route.request().postData())); return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(JSON.stringify(PLAN)) }); });
    await openAssistant(page);
    check((await page.locator('.as-who').textContent()).includes('AI'), 'AI: the Assistant says which AI answers');
    await page.locator('.as-input').fill('Accounts, a letter, slides and a web page for my garden club');
    await page.locator('.as-go').click();
    await page.locator('.as-plan').waitFor({ timeout: 8000 });
    const req = asked[0];
    check(!!req && req.system.includes('Office Assistant') && !!req.output_config?.format?.schema && req.messages[0].content.includes('garden club'), 'AI: the task goes to the AI with the plan schema');
    check(await page.locator('.as-step').count() === 4, 'AI: the plan has the four documents');
    await page.locator('.as-step').nth(0).locator('.as-name').fill('Garden accounts 2026');
    await page.locator('.as-step').nth(2).locator('.as-check input').uncheck();
    check((await page.locator('.as-plan-bar .as-go').textContent()).includes('3'), 'AI: leaving a step out leaves 3 to make');
    await page.locator('.as-plan-bar .as-go').click();
    await page.locator('.as-done').waitFor({ timeout: 15000 });
    check(await tabCount(page, 'Letter') === 1 && await tabCount(page, 'Class') === 1 && await tabCount(page, 'Code+') === 1 && await tabCount(page, 'Stage') === 0, 'AI: letter, sheet and code open; the step left out is not made');
    await showTab(page, 'Letter');
    await page.waitForTimeout(1500);
    const cells = await letterTable(page);
    check(cells.includes('Seeds') && cells.includes('420'), `AI: the letter holds the linked table with the total (${cells.join(' | ')})`);
    check(await page.locator(`${H} .sheet .ProseMirror:not(.header-text):not(.footer-text)`).first().evaluate(el => el.textContent.includes('Dear members') && !el.textContent.includes('[[TABLE]]')), 'AI: the letter text is there, the table mark replaced');
    await showTab(page, 'Code+');
    await page.waitForTimeout(1500);
    check(await page.locator(`${H}`).first().evaluate(el => el.textContent.includes('index.html')), 'AI: the code project holds its file');
    await ctx.close();
  }

  // ---------- 3. Phone, upright and sideways ----------
  for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['phone sideways', { width: 844, height: 390 }]]) {
    const { ctx, page } = await newPage(viewport, 'de-DE', true, () => { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'de'); localStorage.setItem('oi1.assistant.noAi', '1'); sessionStorage.setItem('set', '1'); } });
    await page.route('**/api.mymemory.translated.net/**', route => route.abort());
    await openAssistant(page);
    check(await overflow(page) <= 1, `${name}: no sideways scrolling`);
    const cut = await page.evaluate(() => [...document.querySelectorAll('.as-idea-text, .as-tool, .as-go, .as-head h1')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent.trim()));
    check(!cut.length, `${name}: no cut text (${cut.join(' | ')})`);
    await page.locator('.as-idea[data-recipe="invoice"]').click();
    await page.locator('.as-plan').waitFor({ timeout: 8000 });
    const bar = await page.locator('.as-plan-bar .as-go').boundingBox();
    check(!!bar && bar.x >= 0 && bar.x + bar.width <= viewport.width + 1, `${name}: the Make button fits the screen`);
    check(await overflow(page) <= 1, `${name}: the plan fits the width`);
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
