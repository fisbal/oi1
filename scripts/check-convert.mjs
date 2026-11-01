// The Convert tab (Martin, 2026-11-01: "La conversion devrait être possible avec tous les Offices", and in other
// languages too). Checks like a person, on PC and phone, in Letter, Class, Stage and Code+: the tab is there with 20+
// targets that fit the screen; real files come out (Markdown, Word, PDF, PNG, EPUB, CSV, JSON, PowerPoint…) with the
// document's words inside; "to Office X" opens the other app with the content; a picked language translates the
// result, "Translate here" translates the document and "Original text" gives the exact original back; "Convert a
// file…" turns a CSV into JSON. The AI translator is played by the test.
// Run after `npm run build`:
//   node scripts/check-convert.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import JSZip from 'jszip';

const PORT = Number(process.env.PORT) || 4202;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const H = '.app-frame:not([hidden])';

function answer(body) {
  const req = JSON.parse(body);
  const lang = /into ([^\s.,]+)/.exec(req.system)?.[1] ?? '?';
  const items = JSON.parse(req.messages[0].content).items.map(s => `[${lang}] ${s}`);
  const json = JSON.stringify({ items });
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: req.model, content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } })
    + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: json } })
    + ev('content_block_stop', { index: 0 })
    + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } })
    + ev('message_stop', {});
}

async function openTab(page) {
  await page.locator(`${H} .ribbon-tabs [role=tab]`).filter({ hasText: /^Convert$/ }).first().click();
  await page.waitForTimeout(250);
}
const target = (page, label) => page.locator(`${H} .ribbon-panel button[aria-label="${label}"]`).first();
async function download(page, label, name) {
  const wait = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
  await target(page, label).click();
  const d = await wait;
  if (!d) { check(false, `${name}: "${label}" gives a file`); return null; }
  const path = await d.path();
  const { readFile } = await import('node:fs/promises');
  const buf = await readFile(path);
  return { name: d.suggestedFilename(), buf, text: buf.toString('utf8') };
}
async function tabsNow(page) { return page.locator('.tabs .tab').allInnerTexts(); }

for (const [name, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.addInitScript(() => {
    delete window.showOpenFilePicker; delete window.showSaveFilePicker; delete window.Translator; delete window.LanguageDetector;
    if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:ai:key', 'sk-ant-test'); localStorage.setItem('oi1:language', 'en'); sessionStorage.setItem('set', '1'); }
  });
  await page.route('https://api.anthropic.com/**', route => route.fulfill({ status: 200, contentType: 'text/event-stream', body: answer(route.request().postData()) }));
  await page.route('https://api.mymemory.translated.net/**', route => route.abort());
  await page.goto(url);

  // ---------- Letter ----------
  await page.locator('.slab:has-text("In 1 Letter")').first().click();
  await page.waitForTimeout(1500);
  const text = page.locator(`${H} .sheet .ProseMirror:not(.header-text):not(.footer-text)`).first();
  await text.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Garden report');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The roses grew well this summer.');
  await page.waitForTimeout(300);
  await openTab(page);
  const n = await page.locator(`${H} .ribbon-panel button`).count();
  check(n >= 25, `${name}: Letter: the Convert tab has 20+ choices (${n})`);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(sw <= viewport.width, `${name}: Letter: no sideways scroll (${sw}px)`);
  check(await target(page, 'In 1 Letter').count() === 0 && await target(page, 'In 1 Class').count() === 1, `${name}: Letter: the other Offices are offered, not Letter itself`);

  const md = await download(page, 'Markdown (.md)', `${name}: Letter`);
  check(!!md && /roses grew well/.test(md.text) && /Garden report/.test(md.text), `${name}: Letter → Markdown has the text (${md?.text.slice(0, 40).replace(/\n/g, ' ')})`);
  const docx = await download(page, 'Word (.docx)', `${name}: Letter`);
  if (docx) { const z = await JSZip.loadAsync(docx.buf); const xml = await z.file('word/document.xml')?.async('string'); check(/roses grew well/.test(xml ?? ''), `${name}: Letter → Word is a real .docx with the text`); }
  const rtf = await download(page, 'Rich text (.rtf)', `${name}: Letter`);
  check(!!rtf && rtf.text.startsWith('{\\rtf1') && /roses grew well/.test(rtf.text), `${name}: Letter → RTF`);
  const epub = await download(page, 'E-book (.epub)', `${name}: Letter`);
  if (epub) { const z = await JSZip.loadAsync(epub.buf); check(Object.keys(z.files)[0] === 'mimetype' && /roses/.test(await (Object.values(z.files).find(f => /c1\.xhtml$/.test(f.name))?.async('string') ?? '')), `${name}: Letter → EPUB is an e-book with the text`); }
  const png = await download(page, 'PNG image', `${name}: Letter`);
  check(!!png && png.buf.subarray(1, 4).toString() === 'PNG' && png.buf.length > 5000, `${name}: Letter → PNG is a picture (${png?.buf.length} bytes)`);
  const pdf = await download(page, 'PDF (exact look)', `${name}: Letter`);
  check(!!pdf && pdf.text.startsWith('%PDF'), `${name}: Letter → PDF (exact look) is a PDF`);

  // To In 1 Class: a new Class tab opens.
  const before = (await tabsNow(page)).length;
  await target(page, 'In 1 Stage').click();
  await page.waitForTimeout(2000);
  check((await tabsNow(page)).length === before + 1 && await page.locator(`${H} .st-slide`).count() > 0, `${name}: Letter → In 1 Stage opens a deck`);
  const deckText = await page.locator(`${H} .st-thumbs, ${H} .st-side, ${H}`).first().innerText().catch(() => '');
  check(/Garden report/.test(deckText), `${name}: the deck has the letter's title`);

  // ---------- Stage ----------
  await openTab(page);
  const pptx = await download(page, 'PowerPoint (.pptx)', `${name}: Stage`);
  if (pptx) { const z = await JSZip.loadAsync(pptx.buf); check(!!z.file('ppt/presentation.xml'), `${name}: Stage → PowerPoint is a .pptx`); }
  const spng = await download(page, 'PNG image', `${name}: Stage`);
  check(!!spng && (spng.name.endsWith('.zip') || spng.buf.subarray(1, 4).toString() === 'PNG'), `${name}: Stage → PNG pictures of the slides (${spng?.name})`);
  const sdocx = await download(page, 'Word (.docx)', `${name}: Stage`);
  if (sdocx) { const z = await JSZip.loadAsync(sdocx.buf); check(/Garden report/.test(await z.file('word/document.xml')?.async('string') ?? ''), `${name}: Stage → Word has the slides' text`); }

  // ---------- Class ----------
  await page.locator('.tab-new').click().catch(() => {});
  await page.waitForTimeout(200);
  await page.locator('.slab:has-text("In 1 Class")').first().click();
  await page.waitForTimeout(1200);
  for (const [ref, v] of [['A1', 'Fruit'], ['B1', 'Price'], ['A2', 'Apple'], ['B2', '2'], ['A3', 'Pear'], ['B3', '3'], ['B4', '=SUM(B2:B3)']]) {
    const box = page.locator(`${H} .name-box`);
    await box.fill(ref); await box.press('Enter'); await page.waitForTimeout(60);
    await page.keyboard.type(v); await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  }
  await openTab(page);
  const csv = await download(page, 'CSV', `${name}: Class`);
  check(!!csv && /Fruit,Price/.test(csv.text) && /Pear,3/.test(csv.text) && /\n,5/.test(csv.text), `${name}: Class → CSV has the values and the sum (${csv?.text.replace(/\n/g, ' | ').slice(0, 60)})`);
  const json = await download(page, 'JSON', `${name}: Class`);
  let rows = null; try { rows = JSON.parse(json?.text ?? ''); } catch { /* checked below */ }
  check(Array.isArray(rows) && rows[0]?.Fruit === 'Apple' && rows[1]?.Price === 3, `${name}: Class → JSON is a list of rows named by the titles`);
  const xlsx = await download(page, 'Excel (.xlsx)', `${name}: Class`);
  if (xlsx) { const z = await JSZip.loadAsync(xlsx.buf); check(/SUM\(B2:B3\)/.test(await z.file('xl/worksheets/sheet1.xml')?.async('string') ?? ''), `${name}: Class → Excel keeps the formula`); }
  const n2 = (await tabsNow(page)).length;
  await target(page, 'In 1 Letter').click();
  await page.waitForTimeout(2000);
  check((await tabsNow(page)).length === n2 + 1 && /Pear/.test(await page.locator(`${H} .sheet`).first().innerText().catch(() => '')), `${name}: Class → In 1 Letter opens a letter with the table`);

  // ---------- Translation: the result, the document, the original ----------
  await openTab(page);
  await page.locator(`${H} .ribbon-panel button[aria-label="Language of the result"]`).click();
  const list = page.locator(`${H} .drop-panel .cv-langs`);
  const items = await list.locator('.menu-item').count();
  check(items >= 21, `${name}: 20+ languages to choose from (${items})`);
  const lb = await page.locator(`${H} .drop-panel`).boundingBox();
  check(!!lb && lb.x >= 0 && lb.x + lb.width <= viewport.width + 1, `${name}: the language list fits the screen`);
  await list.locator('.menu-item').filter({ hasText: /^Spanish/ }).first().click();
  await page.waitForTimeout(200);
  const txt = await download(page, 'Plain text (.txt)', `${name}: Letter (es)`);
  check(!!txt && /\[(Spanish|Español)\] Fruit/.test(txt.text) && /\b5\b/.test(txt.text), `${name}: with Spanish picked, the text file is translated and numbers stay (${txt?.text.replace(/\n/g, ' | ').slice(0, 70)})`);
  const body = () => page.locator(`${H} .sheet .ProseMirror:not(.header-text):not(.footer-text)`).first().innerText();
  const orig = await body();
  await target(page, 'Translate here').click();
  await page.waitForTimeout(2500);
  check(/\[(Spanish|Español)\]/.test(await body()), `${name}: "Translate here" translates the document`);
  await target(page, 'Original text').click();
  await page.waitForTimeout(800);
  check((await body()) === orig, `${name}: "Original text" gives the exact original back`);
  const n3 = (await tabsNow(page)).length;
  await target(page, 'Translated copy').click();
  await page.waitForTimeout(3000);
  check((await tabsNow(page)).length === n3 + 1 && /\[(Spanish|Español)\]/.test(await body().catch(() => '')), `${name}: "Translated copy" opens a translated copy in a new tab`);
  // Back to no translation.
  await openTab(page);
  await page.locator(`${H} .ribbon-panel button[aria-label="Language of the result"]`).click();
  await page.locator(`${H} .drop-panel .menu-item`).first().click();

  // ---------- Convert a file… ----------
  const chooser = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
  await target(page, 'Convert a file…').click();
  const fc = await chooser;
  if (fc) {
    await fc.setFiles({ name: 'people.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Age\nAda,36\nAlan,41\n') });
    await page.locator('dialog[open] .cv-file-grid').waitFor({ timeout: 5000 }).catch(() => {});
    const db = await page.locator('dialog[open]').boundingBox();
    check(!!db && db.x >= 0 && db.x + db.width <= viewport.width + 1, `${name}: the file window fits the screen`);
    const wait = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await page.locator('dialog[open] button[aria-label="JSON"]').click();
    const d = await wait;
    const { readFile } = await import('node:fs/promises');
    const j = d ? JSON.parse(await readFile(await d.path(), 'utf8')) : null;
    check(Array.isArray(j) && j[1]?.Name === 'Alan' && j[1]?.Age === 41, `${name}: "Convert a file…" turns a CSV into JSON`);
    await page.keyboard.press('Escape');
  } else check(false, `${name}: "Convert a file…" opens the file picker`);

  // ---------- Code+ ----------
  await page.locator('.tab-new').click().catch(() => {});
  await page.waitForTimeout(200);
  await page.locator('.slab:has-text("In 1 Code+")').first().click();
  await page.waitForTimeout(1500);
  await openTab(page);
  const cn = await page.locator(`${H} .ribbon-panel button`).count();
  check(cn >= 25, `${name}: Code+: the Convert tab has 20+ choices (${cn})`);
  const ctxt = await download(page, 'Plain text (.txt)', `${name}: Code+`);
  check(!!ctxt && ctxt.text.length > 0, `${name}: Code+ → text file`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
