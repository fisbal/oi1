// Manual zoom in the documents themselves (Martin, 2026-10-31: "il manque le zoom manuel pour avoir la feuille de
// travail complète pour un aperçu plus clair et une barre latérale"). In Class, Letter and Stage, on PC and phone:
// "See it all" fits the whole sheet, page or slide; two fingers (phone) or Ctrl + wheel (PC) zoom the document;
// the side scroll bar is there and dragging it moves through the document.
// Run after `npm run build`:
//   node scripts/check-zoom.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4194;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const H = '.module-host:not([hidden])';
const pct = async page => Number(((await page.locator(`${H} .status-zoom .pct`).first().textContent()) ?? '').replace(/\D/g, ''));
const AREA = { Class: '.cells-scroll', Letter: '.canvas', Stage: '.st-stage' };

for (const [device, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  for (const app of ['Class', 'Letter', 'Stage']) {
    const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    page.on('pageerror', e => problems.push(`${device} ${app}: script error: ${e.message}`));
    await page.goto(url);
    await page.locator(`.slab:has-text("Office ${app}")`).first().click();
    await page.waitForTimeout(1500);
    const name = `${device} ${app}`;
    const area = page.locator(`${H} ${AREA[app]}`).first();
    const box = await area.boundingBox();

    // 1. Zoom with the fingers or Ctrl + wheel.
    const z0 = await pct(page);
    if (mobile) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Input.synthesizePinchGesture', { x: box.x + box.width / 2, y: box.y + box.height / 2, scaleFactor: 2, gestureSourceType: 'touch', relativeSpeed: 400 });
    } else {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.keyboard.down('Control');
      for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(60); }
      await page.keyboard.up('Control');
    }
    await page.waitForTimeout(400);
    const z1 = await pct(page);
    check(z1 >= z0 * 1.3, `${name}: ${mobile ? 'a two-finger pinch' : 'Ctrl + wheel'} zooms the document (${z0}% → ${z1}%)`);
    const pageScale = await page.evaluate(() => window.visualViewport?.scale ?? 1);
    check(pageScale < 1.05, `${name}: the app itself stays put while the document zooms (page scale ${pageScale.toFixed(2)})`);

    // 2. The side scroll bar is there once zoomed in, and dragging it moves through the document.
    const bar = page.locator(`${H} .fast-scroll`).first();
    const hasBar = await bar.isVisible().catch(() => false);
    const tall = await area.evaluate(el => el.scrollHeight > el.clientHeight + 4);
    check(hasBar === tall, `${name}: a side scroll bar is shown whenever there is something to scroll (${tall ? 'taller than the screen' : 'fits in height'})`);
    if (hasBar) {
      const b = await bar.boundingBox();
      const top0 = await area.evaluate(el => el.scrollTop);
      await page.mouse.move(b.x + b.width / 2, b.y + 10);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.8, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(250);
      const top1 = await area.evaluate(el => el.scrollTop);
      check(top1 > top0 + 50, `${name}: dragging the side bar scrolls (${Math.round(top0)} → ${Math.round(top1)})`);
      check(b.x + b.width <= viewport.width + 1 && b.width >= (mobile ? 16 : 10), `${name}: the side bar fits the screen and is easy to grab (${Math.round(b.width)} px)`);
    }

    // 3. "See it all" puts the whole sheet, page or slide in view.
    await page.locator(`${H} .status-zoom .fit`).first().click();
    await page.waitForTimeout(500);
    const z2 = await pct(page);
    check(z2 < z1, `${name}: "See it all" zooms back out (${z1}% → ${z2}%)`);
    const whole = await page.evaluate(([h, app]) => {
      const r = el => el?.getBoundingClientRect();
      if (app === 'Class') { const area = r(document.querySelector(`${h} .cells-area`)); const hh = [...document.querySelectorAll(`${h} .col-head, ${h} .col-heads [class*=col]`)].find(e => e.textContent.trim() === 'H'); const b = r(hh); return !!b && b.right <= area.right + 2; }
      if (app === 'Letter') { const c = r(document.querySelector(`${h} .canvas`)); const p = r(document.querySelector(`${h} .sheet`)); return !!p && p.width <= c.width + 2 && p.left >= c.left - 2; }
      const s = r(document.querySelector(`${h} .st-stage`)); const k = r(document.querySelector(`${h} .st-canvas`)); return !!k && k.right <= s.right + 2 && k.bottom <= s.bottom + 2 && k.left >= s.left - 2;
    }, [H, app]);
    check(whole, `${name}: after "See it all" the whole ${app === 'Class' ? 'sheet (A to H at least)' : app === 'Letter' ? 'page' : 'slide'} is in view`);
    await ctx.close();
  }
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already stopped */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`BAD ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
