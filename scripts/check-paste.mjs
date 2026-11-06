// In 1 Class: cells pasted from Excel (and Google Sheets, web pages, any app's text) keep exactly their look, and the
// money can be any currency whatever the language (Martin, 2026-11-06: "je n'arrive toujours pas à coller des cellules
// venant de Excel… les mêmes couleurs que l'original" and "changer la monnaie quelle que soit la langue… utiliser $").
// Checks like a person, in French, on PC, Mac, tablet and phone, standing and lying:
//   - Ctrl+V of Excel's own clipboard (its <style> block, classes, mso number formats): fill, text colour, bold, italic,
//     borders, money with the sign where Excel put it, merged cells, wider columns;
//   - Paste from the right-click menu (the browser's copy, styles inlined);
//   - plain text from another app: numbers and money understood;
//   - typing "$9.99" in French stays dollars;
//   - the currency list (20+ choices) fits the screen and changes the cell's money;
//   - when the browser keeps the clipboard closed, a box to paste into appears and works.
// Run after `npm run build`:
//   node scripts/check-paste.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4242;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const EXCEL = readFileSync(new URL('../src/formats/__tests__/fixtures/excel-clip.html', import.meta.url), 'utf8');
const EXCEL_TEXT = 'Nom du produit\tPrix\tUS\r\nPomme\t1 234,50 €\t$9,99\r\nTotal\t\t25%\r\n';

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => { (ok ? passed : problems).push(what); if (process.env.DEBUG) console.log(ok ? 'ok ' : 'NO ', what); };

const ALL = [
  ['PC', { width: 1366, height: 768 }, false],
  ['Mac', { width: 1440, height: 900 }, false],
  ['Tablet', { width: 820, height: 1180 }, true],
  ['Tablet sideways', { width: 1180, height: 820 }, true],
  ['Phone', { width: 390, height: 844 }, true],
  ['Phone sideways', { width: 844, height: 390 }, true],
];
const DEVICES = process.env.ONLY ? ALL.filter(d => d[0] === process.env.ONLY) : ALL;
const H = '.module-host:not([hidden])';

async function openClass(viewport, touch, clipboard = true) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR', isMobile: touch, hasTouch: touch, permissions: clipboard ? ['clipboard-read', 'clipboard-write'] : [] });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`script error: ${e.message}`));
  await page.goto(url);
  await page.locator('.slab:has-text("In 1 Class")').first().click();
  await page.waitForTimeout(1200);
  const host = page.locator(H);
  const box = host.locator('.name-box'), bar = host.locator('.bar-input');
  const go = async ref => { await box.click(); await box.fill(ref); await box.press('Enter'); await page.waitForTimeout(120); };
  const valueAt = async ref => { await go(ref); return (await bar.inputValue()).trim(); };
  const cdp = touch ? await ctx.newCDPSession(page) : null;
  const openMenu = async ref => {
    await go(ref);
    const b = await host.locator('.active-box').first().boundingBox();
    const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    if (touch) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
      await page.waitForTimeout(750);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.waitForTimeout(250);
  };
  const pick = async id => { const it = page.locator(`.cell-menu [data-id="${id}"]`); await it.scrollIntoViewIfNeeded(); await it.click(); await page.waitForTimeout(400); };
  /** The cells showing a text, with their look. */
  const looks = text => host.locator('.cell').evaluateAll((els, t) => els.filter(e => e.textContent.replace(/[\s\u00a0\u202f]+/g, ' ').trim() === t).map(e => {
    const c = getComputedStyle(e);
    return { bg: c.backgroundColor, fg: c.color, bold: Number(c.fontWeight) >= 600, italic: c.fontStyle === 'italic', bottom: c.borderBottomStyle, w: e.offsetWidth };
  }), text);
  /** What a cell shows, and its look, found on screen where the cell is. */
  const textAt = async ref => {
    await go(ref);
    const b = await host.locator('.active-box').first().boundingBox();
    return page.evaluate(([x, y]) => {
      const el = [...document.querySelectorAll('.module-host:not([hidden]) .cell')].find(e => { const r = e.getBoundingClientRect(); return r.width && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
      if (!el) return { text: '' };
      const c = getComputedStyle(el);
      return { text: el.textContent.replace(/[\s\u00a0\u202f]+/g, ' ').trim(), bg: c.backgroundColor, fg: c.color };
    }, [b.x + b.width / 2, b.y + b.height / 2]);
  };
  /** Ctrl+V of what Excel puts on the clipboard (the paste event carries Excel's raw HTML). */
  const ctrlV = (html, text) => page.evaluate(([h, t]) => {
    const dt = new DataTransfer();
    if (h) dt.setData('text/html', h);
    dt.setData('text/plain', t);
    document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, [html, text]);
  const putOnClipboard = (html, text) => page.evaluate(async ([h, t]) => {
    const parts = { 'text/plain': new Blob([t], { type: 'text/plain' }) };
    if (h) parts['text/html'] = new Blob([h], { type: 'text/html' });
    await navigator.clipboard.write([new ClipboardItem(parts)]);
  }, [html, text]);
  return { ctx, page, host, go, valueAt, openMenu, pick, looks, textAt, ctrlV, putOnClipboard };
}

const BLUE = 'rgb(68, 114, 196)', WHITE = 'rgb(255, 255, 255)', YELLOW = 'rgb(255, 255, 0)', DARK_RED = 'rgb(192, 0, 0)';

for (const [name, viewport, touch] of DEVICES) {
  {
    const { ctx, page, host, go, valueAt, openMenu, pick, looks, textAt, ctrlV, putOnClipboard } = await openClass(viewport, touch);

    // 1. Ctrl+V of Excel's clipboard.
    await go('A1');
    await host.locator('.grid').focus();
    await ctrlV(EXCEL, EXCEL_TEXT);
    await page.waitForTimeout(400);
    const head = await looks('Nom du produit');
    check(head.length === 1 && head[0].bg === BLUE && head[0].fg === WHITE && head[0].bold, `${name}: Excel's header keeps its blue fill, white bold text (${JSON.stringify(head[0])})`);
    check(head[0]?.w > 110, `${name}: Excel's wider column comes too (${head[0]?.w}px)`);
    const usd = await looks('$9,99');
    check(usd.length === 1 && usd[0].bg === YELLOW && usd[0].fg === DARK_RED && usd[0].italic, `${name}: the dollar cell keeps $ first, yellow fill, dark red italic text (${JSON.stringify(usd[0])})`);
    const eur = await looks('1 234,50 €');
    check(eur.length === 1 && eur[0].bottom === 'solid', `${name}: the euro cell keeps its money and its borders (${JSON.stringify(eur[0])})`);
    check(await valueAt('B2') === '1234.5', `${name}: the euro cell holds the number 1234.5, so sums work (${await valueAt('B2')})`);
    const total = await looks('Total');
    check(total.length === 1 && total[0].w > 180, `${name}: Excel's merged cells stay merged (${total[0]?.w}px)`);
    check((await looks('25 %')).length === 1, `${name}: Excel's percentage stays a percentage`);

    // 2. Paste from the right-click menu (the browser's own copy of the HTML).
    await putOnClipboard(EXCEL, EXCEL_TEXT);
    await openMenu('E1');
    await pick('paste');
    const head2 = await looks('Nom du produit');
    check(head2.length === 2 && head2.every(h => h.bg === BLUE && h.fg === WHITE), `${name}: Paste from the menu keeps Excel's colours too (${head2.length})`);
    const usd2 = await textAt('G2');
    check(usd2.text === '$9,99' && usd2.bg === YELLOW, `${name}: Paste from the menu keeps the dollar cell's look (${JSON.stringify(usd2)})`);

    // 3. Plain text from another app.
    await putOnClipboard('', 'Article\tPrix\nPomme\t12,50 $\nPoire\t3,5\n');
    await openMenu('A8');
    await pick('paste');
    check(await valueAt('B9') === '12.50' && (await looks('12,50 $')).length === 1, `${name}: text from another app: "12,50 $" becomes money (${await valueAt('B9')})`);
    check(await valueAt('B10') === '3,5', `${name}: text from another app: "3,5" is a number`);
    await go('C9');
    await page.keyboard.type('=SOMME(B9;B10)');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    check((await looks('16')).length === 1, `${name}: pasted numbers add up, with a formula typed in French (=SOMME(B9;B10) → 16)`);

    // 4. Typing dollars in French.
    await go('A13');
    await page.keyboard.type('$9.99');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const typed = await textAt('A13');
    check(typed.text === '$9,99', `${name}: typing "$9.99" in French shows $9,99, dollars not euros (${typed.text})`);

    // 5. The currency list.
    await go('B2');
    await host.locator('.ribbon-tabs [role=tab]').filter({ hasText: /^Accueil$/ }).first().click();
    await page.waitForTimeout(300);
    const drop = host.locator('.ribbon-panel button[data-help="class.currencyPick"]').first();
    await drop.scrollIntoViewIfNeeded();
    await drop.click();
    await page.waitForTimeout(300);
    const panel = host.locator('.drop-panel').filter({ has: page.locator('.cur-book') }).first();
    const items = await panel.locator('.menu-item').count();
    check(items >= 20, `${name}: the currency list has at least 20 currencies (${items})`);
    const pb = await panel.boundingBox().catch(() => null);
    check(!!pb && pb.x >= 0 && pb.y >= 0 && pb.x + pb.width <= viewport.width + 1 && pb.y + pb.height <= viewport.height + 1, `${name}: the currency list fits the screen (${pb ? [pb.x, pb.y, pb.width, pb.height].map(Math.round).join(',') : 'none'})`);
    if (process.env.DEBUG) console.log(await panel.evaluate(p => { const c = getComputedStyle(p); return [p.style.maxHeight, c.maxHeight, c.overflowY, c.position, p.parentElement.className, p.closest('.ribbon-panel')?.className]; }));
    const cut = await panel.evaluate(p => [...p.querySelectorAll('.menu-item span')].filter(s => s.scrollWidth > s.clientWidth + 1).map(s => s.textContent));
    check(cut.length === 0, `${name}: no currency name is cut (${cut.slice(0, 3).join(' | ')})`);
    const yen = panel.locator('.menu-item').filter({ has: page.locator('.hint', { hasText: /^JPY$/ }) }).first();
    await yen.scrollIntoViewIfNeeded();
    await yen.click();
    await page.waitForTimeout(300);
    check((await looks('1 235 ¥')).length + (await looks('1 234,50 ¥')).length + (await looks('¥1 234,50')).length >= 1, `${name}: picking the yen turns the cell into yen in French`);
    await ctx.close();
  }

  // 6. The browser keeps the clipboard closed: the paste box.
  {
    const { ctx, page, host, openMenu, pick, looks } = await openClass(viewport, touch, false);
    await openMenu('A1');
    await pick('paste');
    const pbox = page.locator('.cl-paste-box');
    check(await pbox.isVisible(), `${name}: when the clipboard is closed, a box to paste into appears`);
    if (await pbox.isVisible()) {
      await pbox.evaluate((el, [h, t]) => {
        const dt = new DataTransfer();
        dt.setData('text/html', h);
        dt.setData('text/plain', t);
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      }, [EXCEL, EXCEL_TEXT]);
      await page.waitForTimeout(400);
      const head = await looks('Nom du produit');
      check(head.length === 1 && head[0].bg === BLUE, `${name}: pasting into the box puts Excel's cells with their colours`);
      check(!(await pbox.isVisible()), `${name}: the box closes after the paste`);
    }
    void host;
    await ctx.close();
  }
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
if (!process.env.DEBUG) for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
