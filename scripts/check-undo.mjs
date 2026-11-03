// Undo / redo are always in view, in every app, on every screen (Martin, 2026-11-03: "il n'y a pas de boucle de retour,
// tu es obligé de faire Ctrl+Z"). On a phone the ↶ ↷ buttons sat at the end of the sliding tab row, out of sight.
// Checks, on PC, Mac, tablet and phone in both orientations, that ↶ and ↷ are inside the screen and not covered, that
// the tab row keeps room, and that a real edit is undone and redone with the buttons (Class and Letter).
// Run after `npm run build`:
//   node scripts/check-undo.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4219;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const H = '.module-host:not([hidden])';
const APPS = ['In 1 Letter', 'In 1 Class', 'In 1 Stage', 'In 1 Code+', 'In 1 Draw', 'In 1 Notes', 'In 1 Plan', 'In 1 Form', 'In 1 Mail', 'In 1 Image'];
const SCREENS = [
  ['PC', { width: 1440, height: 900 }, false], ['Mac', { width: 1280, height: 800 }, false],
  ['Tablet', { width: 820, height: 1180 }, true], ['Tablet sideways', { width: 1180, height: 820 }, true],
  ['Phone', { width: 390, height: 844 }, true], ['Small phone', { width: 360, height: 740 }, true], ['Phone sideways', { width: 844, height: 390 }, true],
];

for (const [name, viewport, mobile] of SCREENS) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.goto(url);
  for (const app of APPS) {
    await page.locator('.tab-new').click().catch(() => {});
    await page.waitForTimeout(200);
    await page.locator(`.slab:has-text("${app}")`).first().click();
    await page.locator(`${H} .ribbon-quick`).first().waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);
    const seen = await page.evaluate(([H, w, h]) => {
      const host = document.querySelector(H);
      const out = {};
      for (const label of ['Undo', 'Redo']) {
        const b = host?.querySelector(`.ribbon-quick button[aria-label="${label}"]`);
        if (!b) { out[label] = 'missing'; continue; }
        const r = b.getBoundingClientRect();
        if (r.left < 0 || r.top < 0 || r.right > w || r.bottom > h || r.width < 20) { out[label] = `off screen (${Math.round(r.left)}, ${Math.round(r.top)})`; continue; }
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        out[label] = top && (top === b || b.contains(top)) ? 'ok' : `covered by ${top?.className || top?.tagName}`;
      }
      const tabs = host?.querySelector('.ribbon-tabs');
      out.tabs = tabs ? Math.round(tabs.getBoundingClientRect().width) : 0;
      return out;
    }, [H, viewport.width, viewport.height]);
    check(seen.Undo === 'ok' && seen.Redo === 'ok', `${name}: ${app}: ↶ undo and ↷ redo in view (undo ${seen.Undo}, redo ${seen.Redo})`);
    check(seen.tabs >= 110, `${name}: ${app}: the tab row keeps room (${seen.tabs} px)`);
  }

  // A real edit, undone and redone with the buttons.
  await page.locator('.tab-new').click().catch(() => {});
  await page.locator('.slab:has-text("In 1 Class")').first().click();
  const area = page.locator(`${H} .cells-area`).first();
  await area.waitFor({ timeout: 10000 });
  await area.click({ position: { x: 40, y: 12 } });
  await page.keyboard.type('Bonjour');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const cell = () => page.locator(`${H} .cell`, { hasText: 'Bonjour' }).count();
  await page.locator(`${H} .ribbon-quick button[aria-label="Undo"]`).click();
  await page.waitForTimeout(250);
  const afterUndo = await cell();
  await page.locator(`${H} .ribbon-quick button[aria-label="Redo"]`).click();
  await page.waitForTimeout(250);
  check(afterUndo === 0 && (await cell()) === 1, `${name}: In 1 Class: ↶ takes the typing back and ↷ puts it again`);

  await page.locator('.tab-new').click().catch(() => {});
  await page.locator('.slab:has-text("In 1 Letter")').first().click();
  const pm = page.locator(`${H} .body-area .ProseMirror`).first();
  await pm.waitFor({ timeout: 10000 });
  await pm.click();
  await page.keyboard.type('Merci beaucoup');
  await page.waitForTimeout(800); // typing groups into one undo step after a pause
  const text = () => pm.innerText();
  await page.locator(`${H} .ribbon-quick button[aria-label="Undo"]`).click();
  await page.waitForTimeout(250);
  const gone = !(await text()).includes('Merci beaucoup');
  await page.locator(`${H} .ribbon-quick button[aria-label="Redo"]`).click();
  await page.waitForTimeout(250);
  check(gone && (await text()).includes('Merci beaucoup'), `${name}: In 1 Letter: ↶ takes the typing back and ↷ puts it again`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
