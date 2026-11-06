// The right-click menu in In 1 Stage, Draw and Image (Martin, 2026-11-06: "dans tout Office In 1 le menu clic droit doit
// avoir non seulement les outils de base comme copier coller mais plus"). Checks like a person, on PC, tablet and phone:
// the menu opens on an object, on the page and on a slide thumbnail, fits the screen with no cut text, and its choices
// work (duplicate an object, duplicate a slide, copy and paste, the text tools while typing in a box, pick a tool, turn
// a photo, a look on a photo).
// Run after `npm run build`:
//   node scripts/check-objmenu.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4240;
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
const H = '.module-host:not([hidden])';

async function fits(page, name, viewport) {
  const menu = page.locator('.cell-menu');
  const mb = await menu.boundingBox({ timeout: 2000 }).catch(() => null);
  check(!!mb && mb.x >= 0 && mb.y >= 0 && mb.x + mb.width <= viewport.width + 1 && mb.y + mb.height <= viewport.height + 1, `${name}: the menu fits the screen`);
  const cut = mb ? await menu.evaluate(m => [...m.querySelectorAll('.cm-label, kbd')].filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2).map(el => el.textContent)) : ['no menu'];
  check(cut.length === 0, `${name}: no text is cut in the menu (${cut.join(' | ')})`);
  return !!mb;
}
const pick = async (page, id) => { const it = page.locator(`.cell-menu [data-id="${id}"]`); await it.scrollIntoViewIfNeeded(); await it.click(); await page.waitForTimeout(300); };
const right = async (page, x, y) => { await page.mouse.click(x, y, { button: 'right' }); await page.waitForTimeout(300); };
const mid = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

for (const [name, viewport, touch] of DEVICES) {
  // Each app in its own fresh browser, like a first visit (the launcher shows).
  const open = async app => {
    const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: touch, hasTouch: touch, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    page.on('pageerror', e => problems.push(`${app} ${name}: script error: ${e.message}`));
    await page.goto(url);
    await page.locator(`.slab:has-text("In 1 ${app}")`).first().click();
    await page.waitForTimeout(1300);
    return page;
  };

  // ---------- Stage ----------
  {
    const page = await open('Stage');
    const n = `Stage ${name}`;
    const items = () => page.locator(`${H} .st-canvas .st-item[data-id]`).count();
    const before = await items();
    const first = page.locator(`${H} .st-canvas .st-item[data-id]`).first();
    const b = await first.boundingBox();
    if (!b) check(false, `${n}: the first slide has boxes`);
    else {
      await right(page, ...Object.values(mid(b)));
      check(await page.locator('.cell-menu').isVisible(), `${n}: a right click on a box opens the Office In 1 menu`);
      if (await fits(page, n, viewport)) {
        check(await page.locator('.cell-menu [data-id="arrange"]').count() === 1 && await page.locator('.cell-menu [data-id="align"]').count() === 1, `${n}: the menu has Arrange and Align for the box`);
        await pick(page, 'duplicate');
        check(await items() === before + 1, `${n}: Duplicate from the menu copies the box (${before} → ${await items()})`);
      }
      // Copy, then paste on the empty part of the slide.
      const c = await page.locator(`${H} .st-canvas`).boundingBox();
      await right(page, ...Object.values(mid(b)));
      await pick(page, 'copy');
      await right(page, c.x + 6, c.y + c.height - 6);
      await pick(page, 'paste');
      check(await items() === before + 2, `${n}: Copy then Paste from the menu adds the box (${await items()})`);
      // Typing in a box: the text tools.
      await page.mouse.dblclick(...Object.values(mid(b)));
      await page.waitForTimeout(400);
      const pm = page.locator(`${H} .st-canvas .ProseMirror`).first();
      const pb = await pm.boundingBox().catch(() => null);
      if (pb) {
        await right(page, pb.x + 10, pb.y + Math.min(pb.height / 2, 20));
        check(await page.locator('.cell-menu [data-id="text"]').count() === 1 && await page.locator('.cell-menu [data-id="paste-text"]').count() === 1, `${n}: while typing in a box the menu has the text tools`);
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
      } else check(false, `${n}: a double click lets you type in the box`);
      // A slide thumbnail.
      const thumbs = page.locator(`${H} .st-rail-card`);
      const tb = await thumbs.first().boundingBox().catch(() => null);
      if (tb && tb.width > 0) {
        const nSlides = await thumbs.count();
        await right(page, ...Object.values(mid(tb)));
        await fits(page, `${n} (slide)`, viewport);
        await pick(page, 'dup-slide');
        check(await thumbs.count() === nSlides + 1, `${n}: Duplicate the slide from a thumbnail's menu works`);
      }
    }
    await page.context().close();
  }

  // ---------- Draw ----------
  {
    const page = await open('Draw');
    const n = `Draw ${name}`;
    const pg = await page.locator(`${H} .dr-page`).boundingBox();
    await right(page, pg.x + pg.width * 0.2, pg.y + pg.height * 0.2);
    check(await page.locator('.cell-menu').isVisible(), `${n}: a right click on the page opens the Office In 1 menu`);
    if (await fits(page, n, viewport)) {
      await pick(page, 'tool');
      await pick(page, 'tool-shape');
      const a = { x: pg.x + pg.width * 0.4, y: pg.y + pg.height * 0.4 }, z = { x: pg.x + pg.width * 0.6, y: pg.y + pg.height * 0.6 };
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + z.x) / 2, (a.y + z.y) / 2, { steps: 4 }); await page.mouse.move(z.x, z.y, { steps: 4 }); await page.mouse.up();
      await page.waitForTimeout(300);
      const shapes = () => page.locator(`${H} .dr-page .dr-shape`).count();
      const s0 = await shapes();
      check(s0 === 1, `${n}: the tool picked in the menu draws a shape (${s0})`);
      await right(page, (a.x + z.x) / 2, (a.y + z.y) / 2);
      check(await page.locator('.cell-menu [data-id="order"]').count() === 1, `${n}: on a shape the menu has Order, Align, Turn`);
      await pick(page, 'duplicate');
      check(await shapes() === s0 + 1, `${n}: Duplicate from the menu works (${await shapes()})`);
    }
    await page.context().close();
  }

  // ---------- Image ----------
  {
    const page = await open('Image');
    const n = `Image ${name}`;
    await page.locator(`${H} .im-sample[data-sample="lake"]`).click();
    await page.waitForTimeout(1500);
    const fr = await page.locator(`${H} .im-frame`).boundingBox();
    await right(page, ...Object.values(mid(fr)));
    check(await page.locator('.cell-menu').isVisible(), `${n}: a right click on the photo opens the Office In 1 menu`);
    if (await fits(page, n, viewport)) {
      const w0 = fr.width;
      await pick(page, 'turn');
      await pick(page, 'turn-r');
      await page.waitForTimeout(600);
      const fr2 = await page.locator(`${H} .im-frame`).boundingBox();
      check(Math.abs(fr2.width - w0) > 2 || Math.abs(fr2.height - fr.height) > 2, `${n}: Turn right from the menu turns the photo`);
      const pixels = () => page.locator(`${H} .im-canvas`).evaluate(c => c.toDataURL('image/jpeg', 0.5).length);
      const p0 = await pixels();
      await right(page, ...Object.values(mid(fr2)));
      await pick(page, 'looks');
      const look = page.locator('.cell-menu [data-id^="look-"]').nth(3);
      const id = (await look.getAttribute('data-id')).slice(5);
      await look.click();
      await page.waitForTimeout(800);
      check(await pixels() !== p0, `${n}: a look picked in the menu changes the photo (${id})`);
    }
    await page.context().close();
  }
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
if (!process.env.DEBUG) for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
