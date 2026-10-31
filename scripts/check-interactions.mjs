// Uses each app like a person would, before every pull request (Martin's rules 10 and 11): typing, the handles that
// make a box bigger or smaller, moving, copy and paste, undo, and how fast the ribbon answers a click or a key.
// Run after `npm run build`:
//   node scripts/check-interactions.mjs

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4186;
// Slowest answer allowed, in milliseconds, from a click or key to the screen showing the result. CI machines are
// slower than a phone, so this is generous: anything above it feels laggy to a person.
const MAX_MS = 400;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [];
const passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

async function open(app, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept('Caption'));
  page.on('pageerror', e => problems.push(`${app}: script error: ${e.message}`));
  await page.goto(url);
  await page.locator(`.slab:has-text("Office ${app}")`).first().click();
  await page.waitForTimeout(1200);
  return { ctx, page, host: page.locator('.module-host:not([hidden])') };
}

/** Milliseconds from an action to the next painted frame where `done` is true. */
async function timed(page, act, done, arg = null) {
  const t0 = Date.now();
  await act();
  await page.waitForFunction(done, arg, { timeout: 3000 }).catch(() => {});
  return Date.now() - t0;
}

async function ribbonSpeed(app, page, host) {
  const tabs = host.locator('.ribbon-tabs [role=tab]');
  let worst = 0;
  for (let i = 0; i < await tabs.count(); i++) {
    const name = (await tabs.nth(i).innerText()).trim();
    const ms = await timed(page, () => tabs.nth(i).click(), n => document.querySelector('.module-host:not([hidden]) .ribbon-tabs [role=tab][aria-selected=true]')?.textContent?.trim() === n, name);
    worst = Math.max(worst, ms);
  }
  check(worst <= MAX_MS, `${app}: every ribbon tab opens fast (slowest ${worst} ms, limit ${MAX_MS})`);
  const drop = host.locator('.ribbon-panel .drop > button:not(:disabled)').first();
  if (await drop.count()) {
    const ms = await timed(page, () => drop.click(), () => !!document.querySelector('.drop-panel'));
    check(ms <= MAX_MS, `${app}: a ribbon list opens fast (${ms} ms)`);
    await page.keyboard.press('Escape');
  }
}

try {
  // ---------- Stage ----------
  {
    const { ctx, page, host } = await open('Stage');
    const items = page.locator('.st-canvas .st-item');
    const title = items.first();
    await title.click();
    await page.waitForTimeout(200);
    const typeMs = await timed(page, () => page.keyboard.type('H'), () => document.querySelector('.st-canvas .ProseMirror')?.textContent?.includes('H'));
    check(typeMs <= MAX_MS, `Stage: a key shows at once (${typeMs} ms)`);
    await page.keyboard.type('ello');
    await page.keyboard.press('Enter');
    await page.keyboard.type('how are you');
    const text = await page.locator('.st-canvas .ProseMirror').innerText();
    check(/Hello[\s\S]*how are you/.test(text), 'Stage: typing in the title keeps every line');
    check(await page.evaluate(() => getComputedStyle(document.querySelector('.st-canvas .st-fit')).overflow === 'visible'), 'Stage: tall letters are never cut at the top of a text box');
    check(await page.locator('.st-handle').count() >= 8, 'Stage: the resize handles show while typing in a box');
    const before = await title.boundingBox();
    const h = await page.locator('.st-handle[data-handle="1,1"]').boundingBox();
    await page.mouse.move(h.x + 5, h.y + 5);
    await page.mouse.down();
    await page.mouse.move(h.x + 60, h.y + 40, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const after = await title.boundingBox();
    check(after.width > before.width + 20 && after.height > before.height + 15, 'Stage: dragging a corner handle makes a text box bigger');
    const h2 = await page.locator('.st-handle[data-handle="1,1"]').boundingBox();
    await page.mouse.move(h2.x + 5, h2.y + 5);
    await page.mouse.down();
    await page.mouse.move(h2.x - 80, h2.y - 30, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    check((await title.boundingBox()).width < after.width - 40, 'Stage: dragging a corner handle makes a text box smaller');
    // Click empty slide to leave the text, then select and move with the mouse and the arrows.
    const canvas = await page.locator('.st-canvas').boundingBox();
    await page.mouse.click(canvas.x + 8, canvas.y + canvas.height - 8);
    await page.waitForTimeout(150);
    await title.click({ position: { x: 4, y: 4 } });
    await page.keyboard.press('Escape');
    const p0 = await title.boundingBox();
    await page.mouse.move(p0.x + 6, p0.y + 6);
    await page.mouse.down();
    await page.mouse.move(p0.x + 66, p0.y + 46, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const p1 = await title.boundingBox();
    check(Math.abs(p1.x - p0.x - 60) < 12 && Math.abs(p1.y - p0.y - 40) < 12, 'Stage: dragging a box moves it');
    const n0 = await items.count();
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);
    check(await items.count() === n0 + 1, 'Stage: copy and paste duplicates a box');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    check(await items.count() === n0, 'Stage: undo removes the pasted box');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    const p2 = await title.boundingBox();
    check(Math.abs(p2.x - p0.x) < 12, 'Stage: undo puts a moved box back');
    await ribbonSpeed('Stage', page, host);
    await ctx.close();
  }

  // ---------- Letter ----------
  {
    const { ctx, page, host } = await open('Letter');
    const body = page.locator('.body-text');
    const box = await body.boundingBox();
    await page.mouse.click(box.x + box.width - 10, box.y + box.height - 6);
    await page.keyboard.press('End');
    // The editor reads the moved caret on the next selectionchange; a person is never faster than that, the robot is.
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    const ms = await timed(page, () => page.keyboard.type('Z'), () => document.querySelector('.body-text')?.textContent?.includes('Z'));
    check(ms <= MAX_MS, `Letter: a key shows at once (${ms} ms)`);
    await page.keyboard.type('ebra crossing');
    check((await body.innerText()).includes('Zebra crossing'), 'Letter: typing works');
    await page.keyboard.press('Shift+Home');
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);
    check(await page.evaluate(() => navigator.clipboard.readText()) === 'Zebra crossing', 'Letter: copy puts the selected text on the clipboard');
    await page.keyboard.press('End');
    // The editor reads the moved caret on the next selectionchange; a person is never faster than that, the robot is.
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    // A pause, so the paste is its own step in the undo history, as when a person pastes.
    await page.waitForTimeout(700);
    // Headless browsers do not paste from the keyboard; send the paste event a real Ctrl+V would.
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'Zebra crossing');
      document.querySelector('.body-text').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(200);
    check(((await body.innerText()).match(/Zebra crossing/g) ?? []).length === 2, 'Letter: paste works');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    check(((await body.innerText()).match(/Zebra crossing/g) ?? []).length === 1, 'Letter: undo takes back the paste');
    await ribbonSpeed('Letter', page, host);
    await ctx.close();
  }

  // ---------- Class ----------
  {
    const { ctx, page, host } = await open('Class');
    const area = await page.locator('.cells-area').boundingBox();
    await page.mouse.click(area.x + 140, area.y + 50);
    await page.keyboard.type('42');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const cellText = await page.locator('.cells-area').innerText();
    check(cellText.includes('42'), 'Class: typing a number in a cell works');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    check(!(await page.locator('.cells-area').innerText()).includes('42'), 'Class: undo takes the number back');
    await ribbonSpeed('Class', page, host);
    await ctx.close();
  }

  // ---------- Code+ ----------
  {
    const { ctx, page, host } = await open('Code+');
    const tpl = page.locator('.code .tpl').first();
    if (await tpl.count()) { await tpl.click(); await page.waitForTimeout(800); }
    const cm = page.locator('.cm-content').first();
    if (await cm.count()) {
      await cm.click();
      await page.keyboard.press('Control+End');
      await page.keyboard.type('\n// hello');
      check((await cm.innerText()).includes('// hello'), 'Code+: typing in the editor works');
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(200);
      check(!(await cm.innerText()).includes('// hello'), 'Code+: undo works');
    }
    await ribbonSpeed('Code+', page, host);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (problems.length) {
  console.error(`${problems.length} problems (${passed.length} checks passed):\n${problems.map(p => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`Every basic interaction works and answers fast: ${passed.length} checks.\n${passed.map(p => `  ✓ ${p}`).join('\n')}`);
