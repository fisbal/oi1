// Printing in In 1 Class (Martin, 2026-11-01: "plusieurs types d'impression (cellule, page, sélection, colonne…)").
// Checks like a person, on PC, phone and phone sideways: the Page Layout tab and its lists (24 paper sizes, 26 scales,
// 21 headers and footers), the Print window fits the screen, every "Print what" choice gives the right pages in the
// preview (selection, active cell, columns, rows, the page of the active cell, the print area, formulas, the whole
// workbook), "Fit sheet on one page", repeated title rows, A/1 headings, landscape, and Save as PDF downloads a PDF.
// The page setup is kept with the sheet. Page order, page breaks and the Page Setup window like Excel's (Martin,
// 2026-11-18: "l'ordre de page tableau n'est pas respecté comme dans Excel. On n'a pas d'options").
// Run after `npm run build`:
//   node scripts/check-print.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4204;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const H = '.module-host:not([hidden])';

// 8 columns × 150 rows: a header row, then numbers like 21 (row 2, column B).
const COLS = 8, ROWS = 150;
const tsv = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (r === 0 ? `Head${'ABCDEFGH'[c]}` : `${r + 1}${'ABCDEFGH'[c]}`)).join('\t')).join('\n');

async function goTo(page, ref) {
  const box = page.locator(`${H} .name-box`);
  await box.fill(ref);
  await box.press('Enter');
  await page.waitForTimeout(100);
}
async function layoutTab(page) {
  await page.locator(`${H} .ribbon-tabs [role=tab]`).filter({ hasText: /^Page Layout$/ }).first().click();
  await page.waitForTimeout(200);
}
async function menuCount(page, label) {
  await layoutTab(page);
  await page.locator(`${H} .ribbon-panel button[aria-label="${label}"]`).first().click();
  await page.waitForTimeout(200);
  const n = await page.locator(`${H} .drop-panel .menu-item`).count();
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5).catch(() => {});
  await page.waitForTimeout(100);
  return n;
}
const D = 'dialog.print-panel[open]';
async function openPrint(page) {
  await layoutTab(page);
  await page.locator(`${H} .ribbon-panel button[aria-label="Print…"]`).first().click();
  await page.locator(D).waitFor({ timeout: 4000 });
  await page.waitForTimeout(300);
}
async function scope(page, s) {
  await page.locator(`${D} .pp-scope[data-scope="${s}"]`).click();
  await page.waitForTimeout(250);
}
const count = async page => {
  const t = await page.locator(`${D} .pp-count`).textContent();
  const m = /Page (\d+) of (\d+)/.exec(t ?? '');
  return m ? { at: Number(m[1]), total: Number(m[2]) } : { at: 0, total: 0 };
};
const previewText = page => page.frameLocator(`${D} .pp-paper iframe`).locator('body').textContent({ timeout: 3000 }).catch(() => '');
async function pick(page, what, value) {
  await page.locator(`${D} select[data-pp="${what}"]`).selectOption(value);
  await page.waitForTimeout(250);
}

for (const [name, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Tablet', { width: 820, height: 1180 }, true], ['Phone', { width: 390, height: 844 }, true], ['Phone sideways', { width: 844, height: 390 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.addInitScript(() => {
    delete window.showOpenFilePicker; delete window.showSaveFilePicker;
    if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'en'); sessionStorage.setItem('set', '1'); }
  });
  await page.goto(url);
  await page.locator('.slab:has-text("In 1 Class")').first().click();
  await page.waitForTimeout(1200);
  await goTo(page, 'A1');
  await page.evaluate(text => {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    document.querySelector('.module-host:not([hidden]) .grid').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, tsv);
  await page.waitForTimeout(400);
  const b2 = await page.locator(`${H} .cell[data-cell="B2"]`).first().textContent().catch(() => '');
  check(b2 === '2B', `${name}: the test data is in the sheet (B2 = ${b2})`);

  // The Page Layout tab and its lists.
  if (name === 'PC') {
    check(await menuCount(page, 'Size') >= 20, `${name}: Size offers 20+ paper sizes`);
    check(await menuCount(page, 'Scale') >= 20, `${name}: Scale offers 20+ choices`);
    check(await menuCount(page, 'Header') >= 20, `${name}: Header offers 20+ choices`);
    check(await menuCount(page, 'Footer') >= 20, `${name}: Footer offers 20+ choices`);
    check(await menuCount(page, 'Print Titles') >= 20, `${name}: Print Titles offers 20+ choices`);
  }

  // Page order from the Page Layout tab: "Over, then down" makes page 2 the columns on the right (G, H).
  await layoutTab(page);
  await page.locator(`${H} .ribbon-panel button[aria-label="Page order"]`).first().click();
  await page.waitForTimeout(200);
  check(await page.locator(`${H} .drop-panel .menu-item`).count() === 2, `${name}: Page order offers Excel's two orders`);
  // The last choice of a list is really on screen, not cut by the ribbon (phones start with the ribbon folded).
  const lastSeen = await page.locator(`${H} .drop-panel .menu-item`).last().evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  check(lastSeen, `${name}: every choice of the Page order list can be seen and tapped`);
  await page.locator(`${H} .drop-panel .menu-item`, { hasText: 'Over, then down' }).click();
  await goTo(page, 'A1');
  await openPrint(page);
  let total0 = (await count(page)).total;
  check(await page.locator(`${D} [data-pp="map"] button`).count() === total0, `${name}: the page map shows every page (${total0})`);
  check(await page.locator(`${D} select[data-pp="order"]`).inputValue() === 'over', `${name}: the Print window shows the order chosen in the ribbon`);
  await page.locator(`${D} [data-pp="map"] button`).nth(1).click();
  await page.waitForTimeout(250);
  let p2 = await previewText(page);
  check((await count(page)).at === 2 && /HeadG/.test(p2) && !/HeadA/.test(p2), `${name}: over then down, page 2 is the columns on the right (G, H)`);
  await pick(page, 'order', 'down');
  await page.locator(`${D} [data-pp="map"] button`).nth(1).click();
  await page.waitForTimeout(250);
  p2 = await previewText(page);
  check(!/Head/.test(p2) && /\dA/.test(p2) && !/\dG/.test(p2), `${name}: down then over (Excel's default), page 2 is the rows below in columns A to F`);
  await page.locator(`${D} button:has-text("Close")`).click();
  await page.waitForTimeout(200);

  // A manual page break before row 21: page 1 ends at row 20, the grid shows a solid line.
  await goTo(page, 'A21');
  await layoutTab(page);
  await page.locator(`${H} .ribbon-panel button[aria-label="Breaks"]`).first().click();
  await page.locator(`${H} .drop-panel .menu-item`, { hasText: 'Insert Page Break' }).click();
  await page.waitForTimeout(250);
  check(await page.locator(`${H} .pb-h.man`).count() >= 1, `${name}: the manual page break shows on the grid`);
  await goTo(page, 'A1');
  await openPrint(page);
  let p1 = await previewText(page);
  check(/20A/.test(p1) && !/21A/.test(p1), `${name}: the manual break ends page 1 at row 20`);
  await page.locator(`${D} button:has-text("Close")`).click();
  await page.waitForTimeout(200);

  // The Page Setup window: Excel's four tabs, the page order pictures, rows to repeat typed as $1:$1, reset breaks.
  await layoutTab(page);
  await page.locator(`${H} .ribbon-panel button[aria-label="Page Setup…"]`).first().click();
  const PS = 'dialog.page-setup[open]';
  await page.locator(PS).waitFor({ timeout: 4000 });
  const psBox = await page.locator(PS).boundingBox();
  check(!!psBox && psBox.x >= 0 && psBox.y >= 0 && psBox.x + psBox.width <= viewport.width + 1 && psBox.y + psBox.height <= viewport.height + 1, `${name}: the Page Setup window fits the screen`);
  for (const tab of ['page', 'margins', 'hf', 'sheet']) {
    await page.locator(`${PS} [data-ps-tab="${tab}"]`).click();
    await page.waitForTimeout(120);
    const n = await page.locator(`${PS} .ps-body`).locator('input, select, button').count();
    check(n >= 3, `${name}: Page Setup tab "${tab}" has real settings (${n})`);
  }
  await page.locator(`${PS} [data-ps-tab="margins"]`).click();
  await page.locator(`${PS} [data-ps="m-top"]`).fill('3');
  check(await page.locator(`${PS} select[data-ps="margins"]`).inputValue() === 'custom', `${name}: typing a margin makes them custom`);
  await page.locator(`${PS} [data-ps-tab="sheet"]`).click();
  check(await page.locator(`${PS} .ps-order-choice svg`).count() === 2, `${name}: the page order is drawn like Excel's picture`);
  await page.locator(`${PS} .ps-order-choice`).filter({ hasText: 'Down, then over' }).click();
  await page.locator(`${PS} [data-ps="titleRows"]`).fill('$1:$1');
  await page.locator(`${PS} [data-ps="resetBreaks"]`).click();
  await page.locator(`${PS} [data-ps="ok"]`).click();
  await page.waitForTimeout(250);
  check(await page.locator(`${H} .pb-h.man`).count() === 0, `${name}: Reset All Page Breaks removes the break`);
  await openPrint(page);
  check(await page.locator(`${D} select[data-pp="margins"]`).inputValue() === 'custom', `${name}: the custom margins reach the Print window`);
  await page.locator(`${D} [data-pp="map"] button`).nth(1).click();
  await page.waitForTimeout(250);
  check(/HeadA/.test(await previewText(page)), `${name}: rows to repeat $1:$1 print on page 2`);
  // Back to the plain setup for the checks below.
  await pick(page, 'titleRows', '0');
  await pick(page, 'margins', 'normal');
  await page.locator(`${D} button:has-text("Close")`).click();
  await page.waitForTimeout(200);

  // A selection: the window opens on it, one page, only those cells.
  await goTo(page, 'B3:C6');
  await openPrint(page);
  const box = await page.locator(D).boundingBox();
  check(!!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${name}: the Print window fits the screen`);
  const paper = await page.locator(`${D} .pp-paper`).boundingBox();
  check(!!paper && paper.width > 60 && paper.x >= 0 && paper.x + paper.width <= viewport.width + 1, `${name}: the page preview is on screen (${paper && Math.round(paper.width)} px wide)`);
  check(await page.locator(`${D} .pp-scope.on`).getAttribute('data-scope') === 'selection', `${name}: with cells selected, Print starts on "Selection"`);
  let txt = await previewText(page);
  check((await count(page)).total === 1 && /3B/.test(txt) && /6C/.test(txt) && !/HeadA/.test(txt) && !/7B/.test(txt), `${name}: Selection prints B3:C6 only on one page`);

  // The active cell only.
  await scope(page, 'cell');
  txt = await previewText(page);
  check((await count(page)).total === 1 && txt.trim().startsWith('3B') && !/2B|3C|4B/.test(txt), `${name}: Active cell prints just B3 (${txt.trim()})`);

  // Whole columns and whole rows.
  await scope(page, 'columns');
  txt = await previewText(page);
  check(/HeadB/.test(txt) && /HeadC/.test(txt) && !/HeadA|HeadD/.test(txt), `${name}: Selected columns prints columns B and C from the top`);
  check((await count(page)).total > 1, `${name}: 150 rows of two columns take several pages`);
  await scope(page, 'rows');
  txt = await previewText(page);
  let rowsText = txt;
  for (let i = 1; i < (await count(page)).total; i++) { await page.locator(`${D} .pp-nav`).last().click(); await page.waitForTimeout(150); rowsText += await previewText(page); }
  check(/3A/.test(rowsText) && /6H/.test(rowsText) && !/HeadA|7A/.test(rowsText), `${name}: Selected rows prints rows 3 to 6, every column (over ${(await count(page)).total} page(s))`);

  // The whole sheet: several pages; Next goes to page 2; fit on one page makes one.
  await scope(page, 'sheet');
  const sheetPages = (await count(page)).total;
  check(sheetPages >= 3, `${name}: the whole sheet takes several pages (${sheetPages})`);
  await page.locator(`${D} .pp-nav`).last().click();
  await page.waitForTimeout(250);
  check((await count(page)).at === 2, `${name}: Next page shows page 2`);
  check(!/HeadA/.test(await previewText(page)), `${name}: without print titles, page 2 has no header row`);
  await pick(page, 'titleRows', '1');
  await page.locator(`${D} .pp-nav`).last().click();
  await page.waitForTimeout(250);
  check(/HeadA/.test(await previewText(page)), `${name}: with "rows to repeat", page 2 starts with the header row`);
  await page.locator(`${D} [data-pp="headings"]`).check();
  await page.waitForTimeout(250);
  check(await page.frameLocator(`${D} .pp-paper iframe`).locator('th', { hasText: /^B$/ }).count() >= 1, `${name}: Print headings shows the column letters`);
  await page.locator(`${D} [data-pp="landscape"]`).click();
  await page.waitForTimeout(250);
  const land = (await count(page)).total;
  check(land >= 1, `${name}: landscape works out its pages (${land})`);
  await pick(page, 'fit', 'page');
  check((await count(page)).total === 1, `${name}: Fit sheet on one page gives one page`);
  await pick(page, 'footer', 'Page {page} of {pages}');
  check(/Page 1 of 1/.test(await previewText(page)), `${name}: the footer numbers the pages`);

  // The page of the active cell (back to 100 % so there are several pages).
  await pick(page, 'fit', 'none');
  await page.locator(`${D} button:has-text("Close")`).click();
  await page.waitForTimeout(200);
  await goTo(page, 'A120');
  await openPrint(page);
  check(await page.locator(`${D} .pp-scope.on`).getAttribute('data-scope') === 'sheet', `${name}: with one cell selected, Print starts on the whole sheet`);
  await scope(page, 'page');
  txt = await previewText(page);
  check((await count(page)).total === 1 && /120A/.test(txt), `${name}: "Page of the active cell" prints the one page with A120`);

  // Formulas instead of results.
  await page.locator(`${D} button:has-text("Close")`).click();
  await goTo(page, 'J1');
  await page.keyboard.type('=1+2');
  await page.keyboard.press('Enter');
  await goTo(page, 'J1');
  await openPrint(page);
  await scope(page, 'formulas');
  let all = '';
  const total = (await count(page)).total;
  for (let i = 0; i < total; i++) { all += await previewText(page); if (i < total - 1) { await page.locator(`${D} .pp-nav`).last().click(); await page.waitForTimeout(120); } }
  check(all.includes('=1+2'), `${name}: "Formulas instead of results" prints the formula`);

  // Save as PDF downloads a real PDF of every page.
  await scope(page, 'selection');
  const dl = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
  await page.locator(`${D} .pp-pdf`).click();
  const d = await dl;
  let head = '';
  if (d) { const stream = await d.createReadStream(); for await (const chunk of stream) { head += chunk.toString('latin1'); if (head.length > 8) break; } }
  check(!!d && /\.pdf$/.test(d.suggestedFilename()) && head.startsWith('%PDF'), `${name}: Save as PDF downloads a PDF (${d?.suggestedFilename()})`);
  await page.locator(`${D} button:has-text("Close")`).click();
  await page.waitForTimeout(200);

  // The print area: set from the ribbon, then Print starts on it.
  await goTo(page, 'C10:D12');
  await layoutTab(page);
  await page.locator(`${H} .ribbon-panel button[aria-label="Print area"]`).first().click();
  await page.locator(`${H} .drop-panel .menu-item`, { hasText: 'Set print area' }).click();
  await goTo(page, 'A1');
  await openPrint(page);
  check(await page.locator(`${D} .pp-scope.on`).getAttribute('data-scope') === 'area', `${name}: with a print area, Print starts on it`);
  txt = await previewText(page);
  check(/10C/.test(txt) && /12D/.test(txt) && !/9C|13C|10B/.test(txt), `${name}: the print area prints C10:D12 only`);
  check(await page.locator(`${D} select[data-pp="titleRows"]`).inputValue() === '1', `${name}: the page setup is kept with the sheet`);

  // The whole workbook: a second sheet adds its pages.
  await scope(page, 'book');
  const book = (await count(page)).total;
  check(book >= 1, `${name}: Whole workbook works out its pages (${book})`);
  await page.locator(`${D} button:has-text("Close")`).click();
  await ctx.close();
}

// In 1 ProDFos (Martin, 2026-11-03: "Ctrl+P ne fonctionne pas sur ProDFos"): Ctrl+P on the ProDFos tab asks ProDFos to print
// its open PDF, and never prints the Office In 1 window. ProDFos itself is a stand-in page here that records what it is told.
for (const [name, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  await ctx.route('https://fisbal.github.io/prodfos/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>ProDFos</title><body>PDF<script>window.addEventListener("message", e => { if (e.data && e.data.type === "oi1-print") { window.printed = (window.printed || 0) + 1; document.title = "printed " + window.printed; const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="; parent.postMessage({ type: "prodfos-print-pages", name: "test.pdf", pages: [png, png] }, "*"); } if (e.data && e.data.type === "oi1-hello") { window.hostSaves = e.data.save === true; } }); parent.postMessage({ type: "prodfos-hello" }, "*"); window.saveScan = () => parent.postMessage({ type: "prodfos-save", name: "Scan 1.pdf", mime: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.4 scan") }, "*");</script>' }));
  const page = await ctx.newPage();
  await page.addInitScript(`try { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'fr'); sessionStorage.setItem('set', '1'); } } catch {} window.print = () => { window.__oi1Printed = (window.__oi1Printed || 0) + 1; };`);
  await page.goto(url);
  await page.locator('.brand').click();
  await page.waitForTimeout(300);
  await page.locator('.slab:has-text("ProDFos")').first().click();
  const frame = page.frameLocator(`${H} iframe.embed`);
  await frame.locator('body').waitFor({ timeout: 10000 }).catch(() => {});
  await page.locator(`${H} .embed-bar`).click().catch(() => {});
  check(/[?&]host=oi1/.test(await page.locator(`${H} iframe.embed`).getAttribute('src') ?? ''), `${name} ProDFos: Office In 1 tells ProDFos it is inside (host=oi1)`);
  // ProDFos cannot print a PDF from inside the frame (Martin, 2026-11-03: "print still not working"): it sends its pages
  // as pictures and Office In 1 prints them from its own window, one page per sheet.
  const popup = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
  await page.keyboard.press('Control+P');
  await page.waitForTimeout(500);
  const win = await popup;
  if (win) await win.waitForLoadState().catch(() => {});
  const shown = win ? await win.evaluate(() => ({ imgs: document.images.length, title: document.title })).catch(() => ({ imgs: 0, title: '' })) : { imgs: 0, title: '' };
  check(shown.imgs === 2 && shown.title === 'test.pdf', `${name} ProDFos: the pages print from Office In 1's window (${shown.imgs} pages, "${shown.title}")`);
  const printed = await page.frames().find(f => f.url().startsWith('https://fisbal.github.io/prodfos/'))?.evaluate(() => window.printed || 0).catch(() => 0);
  check(printed === 1, `${name} ProDFos: Ctrl+P asks ProDFos to print the open PDF (${printed})`);
  check(!(await page.evaluate(() => window.__oi1Printed || 0)), `${name} ProDFos: Ctrl+P does not print the Office In 1 window`);
  // The scanner's PDF (Martin, 2026-11-16: "ne fonctionne pas dans Office In 1"): a download made inside the frame is lost
  // in the Android apps, so ProDFos hands the file to Office In 1, which saves it with its own Save.
  const pf = page.frames().find(f => f.url().startsWith('https://fisbal.github.io/prodfos/'));
  check(await pf?.evaluate(() => window.hostSaves === true).catch(() => false), `${name} ProDFos: Office In 1 tells ProDFos it saves its files`);
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await pf?.evaluate(() => window.saveScan()).catch(() => {});
  const got = await dl;
  check(got?.suggestedFilename() === 'Scan 1.pdf', `${name} ProDFos: a scanned PDF is saved by Office In 1 (${got?.suggestedFilename() ?? 'nothing'})`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { server.kill(); }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
