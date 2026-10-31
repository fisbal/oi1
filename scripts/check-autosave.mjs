// Saving shows and happens by itself (Martin, 2026-10-31: "enregistrement auto"). Every change is kept on the device
// and the app bar says so; once a document is saved to a file, AutoSave writes that file after each pause; the
// switch turns it off. The save dialog is played by the test (a browser cannot be driven through the real one).
// Run after `npm run build`:
//   node scripts/check-autosave.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4186;
// From the last change to "Saved" in the app bar (the working copy), and to the file being written (AutoSave).
const DEVICE_MS = 1500, FILE_MS = 6000;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

/** A save dialog that always picks "<name>", and a file that remembers each write. */
const fakeFiles = () => {
  window.__writes = [];
  window.showSaveFilePicker = async ({ suggestedName }) => ({
    kind: 'file', name: suggestedName,
    queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    createWritable: async () => ({ write: async blob => { window.__writes.push({ name: suggestedName, size: blob.size ?? String(blob).length }); }, close: async () => {} }),
  });
};

const APPS = [
  { app: 'Letter', ext: '.docx', type: async page => { await page.locator('.body-text').click(); await page.keyboard.type('Hello autosave. ', { delay: 10 }); } },
  { app: 'Class', ext: '.xlsx', type: async page => { const a = await page.locator('.cells-area').boundingBox(); await page.mouse.click(a.x + 60, a.y + 12); await page.keyboard.type(String(Date.now() % 100000)); await page.keyboard.press('Enter'); } },
  { app: 'Stage', ext: '.pptx', type: async page => { await page.locator('.st-canvas .st-item').first().click(); await page.waitForTimeout(200); await page.keyboard.type('Autosave', { delay: 10 }); await page.keyboard.press('Escape'); } },
];

async function until(page, fn, arg, ms) {
  const t0 = Date.now();
  const ok = await page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  return ok ? Date.now() - t0 : -1;
}
const badge = page => page.locator('.app-frame:not([hidden]) .save-badge');

for (const { app, ext, type } of APPS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  await ctx.addInitScript(fakeFiles);
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${app}: script error: ${e.message}`));
  page.on('dialog', d => d.dismiss());
  await page.goto(url);
  await page.locator(`.slab:has-text("Office ${app}")`).first().click();
  await page.waitForTimeout(1200);
  check((await page.locator('.app-frame:not([hidden]) .app-name').innerText()) === `Office ${app}`, `${app}: the app bar names the app`);

  // 1. Every change is kept on the device, and the app bar says so.
  await type(page);
  const ms = await until(page, () => /Saved on this device/.test(document.querySelector('.app-frame:not([hidden]) .save-badge')?.textContent ?? ''), null, DEVICE_MS + 1000);
  check(ms >= 0 && ms <= DEVICE_MS, `${app}: "Saved on this device" shows ${ms} ms after a change (limit ${DEVICE_MS})`);

  // 2. Saved once to a file, later changes go to that file by themselves.
  if (app === 'Class') { const a = await page.locator('.cells-area').boundingBox(); await page.mouse.click(a.x + 200, a.y + 100); }
  await page.keyboard.press('Control+s');
  const saved = await until(page, () => window.__writes.length > 0, null, 5000);
  check(saved >= 0, `${app}: Ctrl+S saves to a file`);
  const before = await page.evaluate(() => window.__writes.length);
  await type(page);
  const wrote = await until(page, n => window.__writes.length > n, before, FILE_MS + 1000);
  check(wrote >= 0 && wrote <= FILE_MS, `${app}: AutoSave writes the file by itself after a change (${wrote} ms)`);
  const last = await page.evaluate(() => window.__writes.at(-1));
  check(!!last && last.name.endsWith(ext) && last.size > 0, `${app}: AutoSave writes a real ${ext} (${last?.size} bytes)`);
  await page.waitForTimeout(300);
  check(/Saved to .*\./.test(await badge(page).innerText()), `${app}: the app bar says it is saved to the file (${await badge(page).innerText()})`);

  // 3. The switch turns AutoSave off: changes stay on the device only.
  await page.locator('.app-frame:not([hidden]) .autosave').click();
  const off = await page.evaluate(() => window.__writes.length);
  await type(page);
  await page.waitForTimeout(4000);
  check(await page.evaluate(() => window.__writes.length) === off, `${app}: with AutoSave off the file is not written`);
  check(/Saved on this device/.test(await badge(page).innerText()), `${app}: with AutoSave off it still keeps the work on the device`);
  await page.locator('.app-frame:not([hidden]) .autosave').click();
  await ctx.close();
}

// The working copy survives closing the page.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.locator('.slab:has-text("Office Letter")').first().click();
  await page.waitForTimeout(1200);
  await page.locator('.body-text').click();
  await page.keyboard.type('Kept after reload', { delay: 10 });
  await until(page, () => /Saved/.test(document.querySelector('.app-frame:not([hidden]) .save-badge')?.textContent ?? ''), null, 3000);
  const bar = await page.locator('.app-frame:not([hidden]) .app-bar').boundingBox();
  check(!!bar && bar.width <= 391, 'Phone: the app bar fits the screen');
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForTimeout(2500);
  const text = await page.evaluate(() => [...document.querySelectorAll('.body-text')].map(e => e.innerText).join(' | '));
  check(text.includes('Kept after reload'), `Phone: the work is still there after closing and opening again (${text.slice(0, 60)})`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already stopped */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`BAD ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
