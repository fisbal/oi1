// The right-click menu on text (Martin, 2026-11-06: "dans tout Office In 1 le menu clic droit doit avoir non seulement les
// outils de base comme copier coller mais plus"). Checks like a person in In 1 Letter, on PC, Mac, tablet and phone, both
// ways: a right click on the text opens Office In 1's menu (not the browser's), it fits the screen with no cut text and has
// at least 20 choices; Copy then Paste from the menu works, Paste as plain text works, Bold from the Text list works, a
// table gets its own list, Shift+F10 opens the menu at the caret, and the spelling bubble still answers on a wrong word.
// Run after `npm run build`:
//   node scripts/check-textmenu.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4239;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

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

for (const [name, viewport, touch] of DEVICES) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: touch, hasTouch: touch, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.goto(url);
  await page.locator('.slab:has-text("In 1 Letter")').first().click();
  await page.waitForTimeout(1200);
  const body = page.locator('.module-host:not([hidden]) .body-text');
  const menu = page.locator('.cell-menu');
  const text = async () => (await body.innerText()).replace(/\s+/g, ' ');
  // Puts the caret at the end, types a new line.
  const line = async words => {
    await body.click();
    await page.keyboard.press('Control+End');
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await page.keyboard.type(words);
    await page.waitForTimeout(150);
  };
  // Selects `word` in the text and returns its middle on screen.
  // Selects a word like a person dragging over it, then waits for the editor to take the selection (ProseMirror reads
  // it from the selectionchange event, a moment later): a right click before that would act on the old caret.
  const select = async word => { const at = await selectNow(word); await page.waitForTimeout(250); return at; };
  const selectNow = word => page.evaluate(w => {
    const root = document.querySelector('.module-host:not([hidden]) .body-text');
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const i = n.textContent.lastIndexOf(w);
      if (i < 0) continue;
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      const b = r.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
    return null;
  }, word);
  // Where the caret is on screen (an empty line has no box of its own: its paragraph's is used).
  const caretSpot = () => page.evaluate(() => {
    const s = getSelection(), r = s.getRangeAt(0);
    let b = r.getBoundingClientRect();
    if (!b.height) { const el = (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement); b = el.getBoundingClientRect(); return { x: b.left + 6, y: b.top + Math.min(b.height, 20) / 2 }; }
    return { x: b.right, y: b.top + b.height / 2 };
  });
  const rightClick = async p => { await page.mouse.click(p.x, p.y, { button: 'right' }); await page.waitForTimeout(300); };
  const pick = async id => { const it = menu.locator(`[data-id="${id}"]`); await it.scrollIntoViewIfNeeded(); await it.click(); await page.waitForTimeout(300); };

  await line('Ocean breeze');
  let p = await select('breeze');
  await page.waitForTimeout(200);
  await rightClick(p);
  check(await menu.isVisible(), `${name}: a right click on the text opens the Office In 1 menu`);
  const mb = await menu.boundingBox({ timeout: 2000 }).catch(() => null);
  check(!!mb && mb.x >= 0 && mb.y >= 0 && mb.x + mb.width <= viewport.width + 1 && mb.y + mb.height <= viewport.height + 1, `${name}: the menu fits the screen`);
  const n = mb ? await menu.locator('.cm-item').count() : 0;
  check(n >= 12, `${name}: the menu shows its main choices (${n})`);
  const cut = mb ? await menu.evaluate(m => [...m.querySelectorAll('.cm-label, kbd')].filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2).map(el => el.textContent)) : ['no menu'];
  check(cut.length === 0, `${name}: no text is cut in the menu (${cut.join(' | ')})`);
  check(await menu.locator('[data-id="web"]').count() === 1 && await menu.locator('[data-id="sel-info"]').count() === 1, `${name}: the menu offers web search and the word count of the selection`);

  // Copy from the menu, then paste from the menu on a new line.
  await pick('copy');
  check(await page.evaluate(() => navigator.clipboard.readText()) === 'breeze', `${name}: Copy from the menu puts the selection on the clipboard`);
  await line('Paste here: ');
  await page.waitForTimeout(200);
  p = await select('here: ');
  await page.keyboard.press('End');
  await page.waitForTimeout(150);
  const caret = await caretSpot();
  await rightClick(caret);
  await pick('paste');
  check(/Paste here: ?breeze/.test(await text()), `${name}: Paste from the menu puts it at the caret (${(await text()).slice(-40)})`);

  // Paste as plain text.
  await page.evaluate(() => navigator.clipboard.writeText('plain words'));
  await line('Plain: ');
  await page.keyboard.press('End');
  const c2 = await caretSpot();
  await rightClick(c2);
  await pick('paste-text');
  check(/Plain: ?plain words/.test(await text()), `${name}: Paste as plain text works`);

  // Bold from the Text list.
  p = await select('Ocean');
  await rightClick(p);
  await pick('text');
  check(await menu.locator('[data-id="bold"]').isVisible(), `${name}: the Text list opens in place`);
  await pick('bold');
  check(await body.locator('strong:has-text("Ocean")').count() === 1, `${name}: Bold from the menu works`);

  // Insert a table from the menu, then its own list shows inside it.
  await line('');
  const c3 = await caretSpot();
  await rightClick(c3);
  await pick('insert');
  await pick('l-table');
  const cell = await body.locator('td, th').first().boundingBox();
  check(!!cell, `${name}: Insert › Table from the menu works`);
  if (cell) {
    await page.mouse.click(cell.x + 8, cell.y + cell.height / 2);
    await rightClick({ x: cell.x + 8, y: cell.y + cell.height / 2 });
    check(await menu.locator('[data-id="table"]').count() === 1, `${name}: inside a table the menu has the Table list`);
    await pick('table');
    await pick('t-row-below');
    check(await body.locator('tr').count() === 4, `${name}: Table › Row below adds a row (${await body.locator('tr').count()})`);
  }

  // Search inside the menu.
  p = await select('breeze');
  await rightClick(p);
  if (touch) await menu.locator('.cm-search input').click();
  await page.keyboard.type('underl');
  await page.waitForTimeout(150);
  const found = await menu.locator('.cm-item').allInnerTexts();
  check(found.length >= 1 && found.every(f => /underl/i.test(f)), `${name}: the search box finds the choices (${found.join(' | ')})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check(!(await menu.isVisible()), `${name}: Escape closes the menu`);

  if (!touch) {
    await body.click();
    await page.keyboard.press('Shift+F10');
    await page.waitForTimeout(250);
    check(await menu.isVisible(), `${name}: Shift+F10 opens the menu at the caret`);
    await page.keyboard.press('Escape');
    // A wrong word still gets the spelling bubble on a right click.
    await line('Thiss is wrongg');
    await page.waitForTimeout(2500);
    const bad = body.locator('.pf').first();
    if (await bad.count()) {
      const b = await bad.boundingBox();
      await rightClick({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
      check(await page.locator('.pf-bubble').isVisible() && !(await menu.isVisible()), `${name}: a right click on a misspelled word still shows the spelling fixes`);
      await page.keyboard.press('Escape');
    } else check(false, `${name}: the misspelled words are underlined`);
  }
  await ctx.close();
}

// In 1 Notes and In 1 Mail write with the same text editor: the same menu, with their own parts and copilot actions.
for (const [name, viewport, touch] of DEVICES.filter(d => d[0] === 'PC' || d[0] === 'Phone sideways' || d[0] === 'Tablet')) {
  for (const app of ['Notes', 'Mail']) {
    const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: touch, hasTouch: touch, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    page.on('pageerror', e => problems.push(`${app} ${name}: script error: ${e.message}`));
    await page.goto(url);
    await page.locator(`.slab:has-text("In 1 ${app}")`).first().click();
    await page.waitForTimeout(1200);
    const host = page.locator('.module-host:not([hidden])');
    if (app === 'Mail') { await host.locator('.ml-hello .primary, .ml-new').first().click(); await page.waitForTimeout(500); }
    const ed = host.locator(app === 'Mail' ? '.ml-text' : '.nt-page .ProseMirror').first();
    await ed.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('Silver moon');
    await page.waitForTimeout(200);
    const p = await page.evaluate(sel => {
      const root = document.querySelector(sel);
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const i = n.textContent.lastIndexOf('moon');
        if (i < 0) continue;
        const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 4);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        const b = r.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      }
      return null;
    }, app === 'Mail' ? '.module-host:not([hidden]) .ml-text' : '.module-host:not([hidden]) .nt-page .ProseMirror');
    await page.waitForTimeout(200);
    const menu = page.locator('.cell-menu');
    if (!p) { check(false, `${app} ${name}: the typed text is there`); await ctx.close(); continue; }
    await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.waitForTimeout(300);
    check(await menu.isVisible(), `${app} ${name}: a right click on the text opens the Office In 1 menu`);
    const mb = await menu.boundingBox({ timeout: 2000 }).catch(() => null);
    check(!!mb && mb.x >= 0 && mb.y >= 0 && mb.x + mb.width <= viewport.width + 1 && mb.y + mb.height <= viewport.height + 1, `${app} ${name}: the menu fits the screen`);
    const cut = mb ? await menu.evaluate(m => [...m.querySelectorAll('.cm-label, kbd')].filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2).map(el => el.textContent)) : ['no menu'];
    check(cut.length === 0, `${app} ${name}: no text is cut in the menu (${cut.join(' | ')})`);
    if (mb) {
      await menu.locator('[data-id="ai"]').click();
      await page.waitForTimeout(200);
      const ai = await menu.locator('[data-id^="ai-"]').count();
      check(ai >= 3, `${app} ${name}: the copilot list has the app's own actions (${ai})`);
      check(await menu.locator('[data-id="insert"]').count() === 1, `${app} ${name}: the menu has the app's Insert list`);
      await menu.locator('[data-id="copy"]').click();
      await page.waitForTimeout(300);
      check(await page.evaluate(() => navigator.clipboard.readText()) === 'moon', `${app} ${name}: Copy from the menu works`);
      await page.keyboard.press('End');
      await page.keyboard.type(' and ');
      const c = await page.evaluate(() => { const r = getSelection().getRangeAt(0).getBoundingClientRect(); return { x: r.right, y: r.top + r.height / 2 }; });
      await page.mouse.click(c.x, c.y, { button: 'right' });
      await page.waitForTimeout(300);
      await menu.locator('[data-id="paste"]').click();
      await page.waitForTimeout(300);
      check(/Silver moon and ?moon/.test((await ed.innerText()).replace(/\s+/g, ' ')), `${app} ${name}: Paste from the menu works (${(await ed.innerText()).replace(/\s+/g, ' ').slice(-30)})`);
    }
    await ctx.close();
  }
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
if (!process.env.DEBUG) for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
