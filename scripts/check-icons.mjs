// Every icon sits in the middle of its capsule (Martin, 2026-11-01: "toujours centrer les petits icônes de la
// capsule… une structure à toujours vérifier et corriger sur tous les Offices"). Opens every ribbon tab of Letter,
// Class, Stage and Code+, on PC and phone, and measures each big button: the icon's center must be within 1.5 px of
// its capsule's center, with or without an arrow or a colour bar.
// Run after `npm run build`:
//   node scripts/check-icons.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4203;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const H = '.app-frame:not([hidden])';
const APPS = ['In 1 Letter', 'In 1 Class', 'In 1 Stage', 'In 1 Code+', 'In 1 Draw', 'In 1 Notes', 'In 1 Plan'];

for (const [name, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.goto(url);
  for (const app of APPS) {
    await page.locator('.tab-new').click().catch(() => {});
    await page.waitForTimeout(200);
    await page.locator(`.slab:has-text("${app}")`).first().click();
    await page.waitForTimeout(1200);
    const tabs = await page.locator(`${H} .ribbon-tabs [role=tab]`).allInnerTexts();
    let keys = 0;
    const off = [];
    for (let i = 0; i < tabs.length; i++) {
      await page.locator(`${H} .ribbon-tabs [role=tab]`).nth(i).click().catch(() => {});
      await page.waitForTimeout(150);
      const found = await page.locator(`${H} .ribbon-panel .rb.big .key`).evaluateAll(els => els.map(k => {
        const svg = k.querySelector(':scope > svg');
        if (!svg || !k.offsetParent) return null;
        const a = k.getBoundingClientRect(), b = svg.getBoundingClientRect();
        const btn = k.closest('button');
        return { name: btn?.getAttribute('aria-label') ?? '?', dx: (b.left + b.width / 2) - (a.left + a.width / 2), dy: (b.top + b.height / 2) - (a.top + a.height / 2) };
      }).filter(Boolean));
      keys += found.length;
      for (const f of found) if (Math.abs(f.dx) > 1.5 || Math.abs(f.dy) > 1.5) off.push(`${tabs[i].trim()} › ${f.name} (${f.dx.toFixed(1)}, ${f.dy.toFixed(1)})`);
    }
    check(keys > 20, `${name}: ${app}: ${keys} capsules measured`);
    check(!off.length, `${name}: ${app}: every icon is centered in its capsule${off.length ? `: ${[...new Set(off)].slice(0, 8).join('; ')}` : ''}`);
  }
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
