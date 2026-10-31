// Strips that scroll sideways (Martin, 2026-10-31: "le dernier onglet est impossible à ouvrir car caché, il faudrait une
// petite flèche… le faire pour tout Office"), and the language bubble ("mieux fait, reflètera la beauté d'Office In 1").
// Checks like a person, on PC and phone: with 7 documents open the last tab is reached with the › arrow and opens, the ‹
// arrow then appears, the "all open documents" list opens any of them, the ribbon shows its arrows, no arrow shows
// through an open list or window, and the language bubble fits the screen with its three choices.
// Run after `npm run build`:
//   node scripts/check-arrows.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4199;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const APPS = ['Office Letter', 'Office Class', 'Office Stage', 'Office Letter', 'Office Class', 'Office Stage', 'Office Letter'];

for (const [name, viewport, mobile] of [['PC', { width: 1280, height: 800 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.goto(url);
  for (const app of APPS) {
    await page.locator('.tab-new').click().catch(() => {});
    await page.waitForTimeout(200);
    await page.locator(`.slab:has-text("${app}")`).first().click();
    await page.waitForTimeout(600);
  }
  const tabs = page.locator('.tabs .tab');
  check(await tabs.count() === 7, `${name}: 7 documents are open (${await tabs.count()})`);
  await tabs.first().click();
  await page.waitForTimeout(500);

  if (!mobile) {
    // The › arrow on the open documents brings the last one into view, and it opens.
    const right = page.locator('.scroll-arrow-r:not([hidden])');
    const tabsBox = await page.locator('.tabs').boundingBox();
    // Where the arrow on the open documents is (worked out afresh each time: the arrows move as the strip slides).
    const arrowOnTabs = side => page.evaluate(sd => {
      const t = document.querySelector('.tabs').getBoundingClientRect();
      const a = [...document.querySelectorAll(`.scroll-arrow-${sd}:not([hidden])`)].map(b => b.getBoundingClientRect())
        .find(r => r.width && r.top >= t.top - 1 && r.bottom <= t.bottom + 1 && r.left >= t.left - 1 && r.right <= t.right + 1);
      return a ? { x: a.left + a.width / 2, y: a.top + a.height / 2 } : null;
    }, side);
    const r = await arrowOnTabs('r');
    check(!!r, `${name}: the open documents show a › arrow when the last ones are hidden (${await right.count()} arrows)`);
    for (let i = 0, at = r; i < 8 && at; i++) { await page.mouse.click(at.x, at.y); await page.waitForTimeout(500); at = await arrowOnTabs('r'); }
    const last = tabs.last();
    const lb = await last.boundingBox();
    const sb = await page.locator('.tabs').boundingBox();
    check(!!lb && !!sb && lb.x + lb.width <= sb.x + sb.width + 1, `${name}: after the arrow the last document is fully visible`);
    await last.click();
    await page.waitForTimeout(400);
    check((await last.getAttribute('class')).includes('active'), `${name}: the last document opens`);
    check(!!await arrowOnTabs('l'), `${name}: the ‹ arrow appears to go back to the first ones`);
    // The ribbon of Letter is wider than the window: it gets its arrows too.
    const rib = await page.evaluate(() => [...document.querySelectorAll('.scroll-arrow:not([hidden])')].length);
    check(rib >= 2, `${name}: the ribbon has arrows where it is cut (${rib} arrows on screen)`);
  }

  // The "all open documents" list opens any document.
  await page.locator('.tabs-all').click();
  await page.waitForTimeout(300);
  const items = page.locator('.tabs-menu [role=menuitem], .tabs-menu button');
  check(await items.count() === 7, `${name}: the list of all open documents has the 7 documents (${await items.count()})`);
  const mb = await page.locator('.tabs-menu').boundingBox();
  check(!!mb && mb.x >= 0 && mb.x + mb.width <= viewport.width + 1 && mb.y + mb.height <= viewport.height + 1, `${name}: the list fits the screen`);
  // No arrow shows through the open list.
  const through = await page.evaluate(() => {
    const m = document.querySelector('.tabs-menu')?.getBoundingClientRect();
    if (!m) return 0;
    return [...document.querySelectorAll('.scroll-arrow:not([hidden])')].filter(a => {
      const r = a.getBoundingClientRect();
      return r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top;
    }).length;
  });
  check(through === 0, `${name}: no arrow shows through the open list (${through})`);
  await items.nth(3).click();
  await page.waitForTimeout(400);
  check((await tabs.nth(3).getAttribute('class')).includes('active'), `${name}: a document picked in the list opens`);
  const ab = await tabs.nth(3).boundingBox();
  const tb = await page.locator('.tabs').boundingBox();
  check(!!ab && !!tb && Math.abs(ab.x - tb.x) <= 40 || (ab.x >= tb.x - 1 && ab.x + ab.width <= tb.x + tb.width + 1), `${name}: the opened document's tab slides into view (${ab?.x}..${ab && ab.x + ab.width} in ${tb?.x}..${tb && tb.x + tb.width})`);

  // The language bubble: three choices, fits the screen, no arrow through it.
  await page.locator('select.lang').selectOption({ label: 'Français' });
  await page.waitForTimeout(500);
  const card = page.locator('.lc-card');
  check(await card.isVisible(), `${name}: changing the language opens the new bubble`);
  check(await page.locator('.lang-choice-option').count() === 3, `${name}: the bubble offers three choices`);
  const cb = await card.boundingBox();
  check(!!cb && cb.x >= 0 && cb.x + cb.width <= viewport.width + 1 && cb.y >= 0 && cb.y + cb.height <= viewport.height + 1, `${name}: the bubble fits the screen`);
  const pad = await card.evaluate(el => parseFloat(getComputedStyle(el).paddingLeft));
  check(pad >= 14, `${name}: the bubble's content is not stuck to its edges (padding ${pad}px)`);
  const arrowsOver = await page.evaluate(() => {
    const m = document.querySelector('.lc-card')?.getBoundingClientRect();
    return [...document.querySelectorAll('.scroll-arrow:not([hidden])')].filter(a => {
      const r = a.getBoundingClientRect();
      return m && r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top && !a.closest('dialog');
    }).length;
  });
  check(arrowsOver === 0, `${name}: no arrow shows over the bubble (${arrowsOver})`);
  await page.locator('.lc-cancel').click();
  await page.waitForTimeout(300);
  check(!await card.isVisible(), `${name}: Cancel closes the bubble`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
