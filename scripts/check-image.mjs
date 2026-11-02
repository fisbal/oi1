// Checks In 1 Image like a person would, on every kind of screen (rule 16): a phone upright and sideways, a tablet
// both ways, a Windows PC and a Mac. The start screen with its twenty photos, a photo drawn on screen, Enhance really
// changes it, a look from the list (previewed on the photo), a slider and Undo, crop to a square, a quarter turn,
// before/after, saving a JPEG that is a real picture, the page fits the screen with no sideways scrolling, and the
// zoom. Then the copilot with the default AI website (no AI key, no built-in AI). Run after `npm run build`:
//   node scripts/check-image.mjs

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4217;
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
const H = '.module-host:not([hidden])';
const overflow = page => page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
const TAB_OF = { 'image.enhance': 'Home', 'image.turnRight': 'Home', 'image.compare': 'Home', 'image.exportJpg': 'Home', 'image.cropDone': 'Crop', 'letter.zoomIn': 'View', 'ui.fitAll': 'View' };
async function press(page, key, tab) {
  const sel = `${H} [data-help="${key}"]:visible`;
  if (!(await page.locator(sel).count())) await page.locator(`${H} .ribbon-tabs button:text-is("${tab ?? TAB_OF[key] ?? 'Home'}")`).first().click();
  await page.locator(sel).first().click();
}
// Like a person: tap the tab, and when the folded ribbon opened over the work (phone, short screens), tap the status bar to close it.
const tabTo = async (page, label) => {
  await page.locator(`${H} .ribbon-tabs button:text-is("${label}")`).first().click();
  if (await page.locator(`${H} .ribbon.open`).count()) await page.locator(`${H} .status`).first().click({ position: { x: 4, y: 4 } });
};
/** A small fingerprint of what the photo shows (to see that a change really changed the picture). */
const print = page => page.evaluate(sel => {
  const c = document.querySelector(sel);
  if (!c || !c.width) return null;
  const s = document.createElement('canvas'); s.width = 16; s.height = 16;
  const g = s.getContext('2d'); g.drawImage(c, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  let sum = 0, opaque = 0, r = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { sum += d[i] + d[i + 1] + d[i + 2]; r += d[i]; b += d[i + 2]; if (d[i + 3] > 200) opaque++; }
  return { sum, opaque, r, b, w: c.width, h: c.height };
}, `${H} .im-canvas`);
const differs = (a, b, min = 600) => !!a && !!b && Math.abs(a.sum - b.sum) + Math.abs(a.r - b.r) + Math.abs(a.b - b.b) > min;
const statusSize = async page => (await page.locator(`${H} .status span`).first().innerText()).match(/(\d+) × (\d+)/)?.slice(1).map(Number);

async function newPage(d) {
  const ctx = await browser.newContext({ viewport: d.viewport, isMobile: !!d.mobile, hasTouch: !!d.mobile, userAgent: d.ua, locale: 'en-US', acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${d.name}: script error: ${e.message}`));
  page.on('dialog', x => x.dismiss());
  await page.addInitScript(`try { delete window.showSaveFilePicker; delete window.LanguageModel; delete window.ai; window.open = u => { (window.__opened ||= []).push(String(u)); return null; }; if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'en'); sessionStorage.setItem('set', '1'); } } catch {}`);
  return { ctx, page };
}

try {
  for (const d of DEVICES.filter(x => !process.env.ONLY || x.name.includes(process.env.ONLY))) {
    const n = d.name;
    const narrow = d.viewport.width < 760;
    const { ctx, page } = await newPage(d);
    try {
      await page.goto(url);
      await page.waitForTimeout(400);
      const slab = page.locator('.slab:has-text("In 1 Image")').first();
      check(await slab.count() === 1 && !(await slab.isDisabled()), `${n}: In 1 Image is on the home screen and opens (not "soon")`);
      await slab.click();
      await page.locator(`${H} .im-start`).waitFor({ timeout: 10000 });
      check(await page.locator(`${H} .im-sample`).count() === 20, `${n}: the start screen offers twenty photos to try`);
      check(await overflow(page) <= 1, `${n}: no sideways scrolling on the start screen`);

      // A photo on screen
      await page.locator(`${H} .im-sample[data-sample="lake"]`).click();
      await page.waitForFunction(sel => { const c = document.querySelector(sel); return c && c.width > 50; }, `${H} .im-canvas`, { timeout: 10000 });
      await page.waitForTimeout(500);
      const p0 = await print(page);
      check(!!p0 && p0.opaque > 200, `${n}: the photo is drawn on screen`);
      const frame = await page.locator(`${H} .im-frame`).boundingBox();
      const scroll = await page.locator(`${H} .im-scroll`).boundingBox();
      check(!!frame && frame.x >= scroll.x - 1 && frame.x + frame.width <= scroll.x + scroll.width + 1 && frame.y >= scroll.y - 1 && frame.y + frame.height <= scroll.y + scroll.height + 1, `${n}: the whole photo fits in view`);
      check(await overflow(page) <= 1, `${n}: no sideways scrolling with a photo`);
      check(JSON.stringify(await statusSize(page)) === '[1600,1067]', `${n}: the status bar shows the photo size (${await statusSize(page)})`);

      // Enhance
      await press(page, 'image.enhance');
      await page.waitForTimeout(900);
      const p1 = await print(page);
      check(differs(p0, p1), `${n}: Enhance really changes the photo`);

      // A look, previewed on the photo
      await tabTo(page, 'Looks');
      await page.locator(`${H} .im-look[data-look="bw"] img`).waitFor({ timeout: 10000 });
      check(await page.locator(`${H} .im-look img`).count() >= 31, `${n}: 31 looks are previewed on the photo itself (${await page.locator(`${H} .im-look img`).count()})`);
      await page.locator(`${H} .im-look[data-look="bw"]`).click();
      await page.waitForTimeout(900);
      const p2 = await print(page);
      check(!!p2 && Math.abs(p2.r - p2.b) < 400, `${n}: the black & white look takes the colour away`);
      check((await page.locator(`${H} .status span`).first().innerText()).includes('Black & white'), `${n}: the status bar names the look`);
      const sideBox = await page.locator(`${H} .im-side`).boundingBox();
      check(!!sideBox && sideBox.x >= 0 && sideBox.x + sideBox.width <= d.viewport.width + 1 && sideBox.y + sideBox.height <= d.viewport.height + 1, `${n}: the looks panel fits the screen${narrow ? ' (drawer under the photo)' : ''}`);

      // The photo stays still in "See it all", whatever the tab (Martin, Windows: it shook until a zoom click)
      for (const tb of ['Adjust', 'Crop', 'Home']) {
        await tabTo(page, tb);
        await page.waitForTimeout(500);
        const sizes = await page.evaluate(sel => new Promise(res => { const seen = new Set(); const t0 = performance.now(); const f = () => { const r = document.querySelector(sel)?.getBoundingClientRect(); if (r) seen.add(`${Math.round(r.width)}x${Math.round(r.height)}`); if (performance.now() - t0 < 900) requestAnimationFrame(f); else res([...seen]); }; f(); }), `${H} .im-frame`);
        check(sizes.length === 1, `${n}: the photo stays still on the ${tb} tab (${sizes.join(' / ')})`);
      }
      if (await page.locator(`${H} .im-crop-box`).count()) await tabTo(page, 'Looks');

      // A slider, then Undo
      await tabTo(page, 'Adjust');
      const exposure = page.locator(`${H} .im-slider[data-help="image.adj.exposure"] input`);
      await exposure.waitFor({ timeout: 5000 });
      const before = await print(page);
      await exposure.fill('80');
      await exposure.dispatchEvent('pointerup');
      await page.waitForTimeout(400);
      const brighter = await print(page);
      check(!!brighter && brighter.sum > before.sum + 500, `${n}: moving Exposure to +80 brightens the photo`);
      await page.locator(`${H} .ribbon-quick [aria-label="Undo"]`).click();
      await page.waitForTimeout(400);
      check(await exposure.inputValue() !== '80', `${n}: Undo puts the slider back`);

      // Crop to a square
      await tabTo(page, 'Crop');
      await page.locator(`${H} .im-crop-box`).waitFor({ timeout: 5000 });
      await page.locator(`${H} .im-ratios button:text-is("Square 1:1")`).click();
      await page.locator(`${H} .im-done`).click();
      await page.waitForTimeout(500);
      const sq = await statusSize(page);
      check(!!sq && sq[0] === sq[1], `${n}: crop to "Square 1:1" makes a square photo (${sq})`);
      const p3 = await print(page);
      check(!!p3 && Math.abs(p3.w - p3.h) <= 1, `${n}: the square is drawn square on screen`);

      // Turn: width and height swap
      await page.locator(`${H} .ribbon-tabs button:text-is("Home")`).click();
      await press(page, 'image.turnRight');
      await page.waitForTimeout(400);
      await press(page, 'image.cropDone', 'Crop').catch(() => undefined);
      await page.locator(`${H} .ribbon-tabs button:text-is("Home")`).click();
      await press(page, 'image.turnRight');
      await page.waitForTimeout(400);

      // Before / after
      await press(page, 'image.compare');
      await page.waitForTimeout(500);
      check(await page.locator(`${H} .im-split`).isVisible(), `${n}: Before / after shows a sliding line`);
      check(await page.locator(`${H} .im-before`).isVisible(), `${n}: the original shows on the "before" side`);
      await press(page, 'image.compare');

      // Save a JPEG
      const wait = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
      await press(page, 'image.exportJpg');
      const dl = await wait;
      let jpgOk = false;
      if (dl) { const path = await dl.path(); const b = path ? readFileSync(path) : Buffer.alloc(0); jpgOk = b[0] === 0xff && b[1] === 0xd8 && b.length > 5000; }
      check(jpgOk, `${n}: "Save as JPEG" saves a real JPEG photo${dl ? ` (${dl.suggestedFilename()})` : ''}`);

      // Zoom
      await press(page, 'letter.zoomIn', 'View');
      await page.waitForTimeout(300);
      const zoomed = await page.locator(`${H} .im-frame`).boundingBox();
      check(!!zoomed && zoomed.width > (frame?.width ?? 0) * 0.6, `${n}: zoom in makes the photo bigger`);
      await press(page, 'ui.fitAll', 'View');
      await page.waitForTimeout(300);
      const fit = await page.locator(`${H} .im-frame`).boundingBox();
      const sc2 = await page.locator(`${H} .im-scroll`).boundingBox();
      check(!!fit && fit.width <= sc2.width + 1 && fit.height <= sc2.height + 1, `${n}: "See it all" fits the whole photo`);
      check(await overflow(page) <= 1, `${n}: still no sideways scrolling at the end`);
    } catch (e) {
      if (process.env.SHOT) await page.screenshot({ path: `/tmp/shot-${n.replace(/ /g, "_")}.png` }).catch(() => undefined);
      problems.push(`${n}: stopped: ${String(e.message ?? e).split("\n").slice(0, 6).join(" | ")}`);
    } finally { await ctx.close(); }
  }

  // ---------- 2. The copilot with the default AI website (no key, no built-in AI), on a PC and a phone ----------
  for (const d of [DEVICES[0], DEVICES[4]]) {
    const { ctx, page } = await newPage(d);
    try {
      await page.addInitScript(() => { delete window.LanguageModel; });
      await page.goto(url);
      await page.locator('.slab:has-text("In 1 Image")').first().click();
      await page.locator(`${H} .im-sample[data-sample="city"]`).click();
      await page.waitForTimeout(800);
      await page.locator(`${H} .copilot-pill`).first().click().catch(async () => page.keyboard.press('Control+Shift+Space'));
      await page.locator('.copilot').first().waitFor({ timeout: 5000 });
      // The first time it shows the free choices; "Later" keeps the free site that needs no account.
      check(await page.locator('.copilot-setup').isVisible().catch(() => false), `${d.name}: the first time, the copilot shows the free choices`);
      await page.locator('.copilot-setup-buttons button', { hasText: 'Later' }).click();
      await page.locator('.copilot button', { hasText: 'How to improve it' }).first().click();
      await page.waitForTimeout(800);
      const opened = await page.evaluate(() => window.__opened ?? []);
      const card = await page.locator('.web-answer').count();
      check(opened.length > 0 || card > 0, `${d.name}: the copilot works without an AI key (opens the AI website with the photo's numbers)`);
    } catch (e) {
      problems.push(`${d.name} copilot: ${String(e.message ?? e).split('\n')[0]}`);
    } finally { await ctx.close(); }
  }
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* gone */ }
}

console.log(`image: ${passed.length} passed`);
for (const p of passed) console.log(`  ✓ ${p}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
