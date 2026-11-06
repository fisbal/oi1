// The right-click menu in In 1 Plan, Form and Code+ (Martin, 2026-11-06: "dans tout Office In 1 le menu clic droit doit
// avoir non seulement les outils de base comme copier coller mais plus"). Checks like a person, on PC, tablet and phone:
// the menu opens on a task, a question and in the code, fits the screen with no cut text, and its choices work (a new
// task, a task's priority, duplicate a question, select all and copy the code, comment a line).
// Run after `npm run build`:
//   node scripts/check-appmenu.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4241;
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
  check(!!mb && mb.x >= 0 && mb.y >= 0 && mb.x + mb.width <= viewport.width + 1 && mb.y + mb.height <= viewport.height + 1, `${name}: the menu opens and fits the screen`);
  const cut = mb ? await menu.evaluate(m => [...m.querySelectorAll('.cm-label, kbd')].filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2).map(el => el.textContent)) : ['no menu'];
  check(cut.length === 0, `${name}: no text is cut in the menu (${cut.join(' | ')})`);
  return !!mb;
}
const pick = async (page, id) => { const it = page.locator(`.cell-menu [data-id="${id}"]`); await it.scrollIntoViewIfNeeded(); await it.click(); await page.waitForTimeout(300); };
const right = async (page, p) => {
  if (process.env.DEBUG) console.log('  at', Math.round(p.x), Math.round(p.y), await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return `${e?.tagName}.${e?.className}`; }, [p.x, p.y]));
  await page.mouse.click(p.x, p.y, { button: 'right' }); await page.waitForTimeout(300);
};
const mid = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

for (const [name, viewport, touch] of DEVICES) {
  const open = async app => {
    const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: touch, hasTouch: touch, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    page.on('pageerror', e => problems.push(`${app} ${name}: script error: ${e.message}`));
    await page.goto(url);
    await page.locator(`.slab:has-text("In 1 ${app}")`).first().click();
    await page.waitForTimeout(1300);
    return page;
  };

  // ---------- Plan ----------
  {
    const page = await open('Plan');
    const n = `Plan ${name}`;
    const cards = () => page.locator(`${H} .pl-card`).count();
    const c0 = await cards();
    const area = await page.locator(`${H} .pl-scroll`).boundingBox();
    await right(page, { x: area.x + area.width - 48, y: area.y + area.height - 24 });
    if (await fits(page, `${n} (empty space)`, viewport)) {
      await pick(page, 'new-task');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      check(await cards() === c0 + 1, `${n}: New task from the menu adds a card (${c0} → ${await cards()})`);
    }
    const card = page.locator(`${H} .pl-card`).first();
    await card.scrollIntoViewIfNeeded().catch(() => {});
    const cb = await card.boundingBox().catch(() => null);
    if (cb) {
      // On the card's edge, not in its title being typed in.
      const edge = { x: cb.x + 5, y: cb.y + cb.height - 5 };
      await right(page, edge);
      if (await fits(page, `${n} (task)`, viewport)) {
        await pick(page, 'priority');
        await pick(page, 'p-urgent');
        await right(page, edge);
        await pick(page, 'priority');
        check((await page.locator('.cell-menu [data-id="p-urgent"]').innerText()).startsWith('✓'), `${n}: a priority picked in the menu is set`);
        await page.keyboard.press('Escape');
      }
    } else check(false, `${n}: a card is there`);
    await page.context().close();
  }

  // ---------- Form ----------
  {
    const page = await open('Form');
    const n = `Form ${name}`;
    const qs = () => page.locator(`${H} .fm-card`).count();
    let q0 = await qs();
    if (!q0) {
      const area = await page.locator(`${H} .fm-scroll`).boundingBox();
      await right(page, { x: area.x + area.width / 2, y: area.y + area.height - 20 });
      await pick(page, 'add');
      q0 = await qs();
    }
    const card = page.locator(`${H} .fm-card`).first();
    await card.evaluate(el => el.scrollIntoView({ block: 'center' })).catch(() => {});
    await page.waitForTimeout(200);
    const b = await card.boundingBox().catch(() => null);
    if (b) {
      // On the card's edge, not in a box being typed in.
      await right(page, { x: b.x + 6, y: b.y + b.height / 2 });
      if (await fits(page, n, viewport)) {
        check(await page.locator('.cell-menu [data-id="type"]').count() === 1, `${n}: the menu has the question types`);
        await pick(page, 'duplicate');
        check(await qs() === q0 + 1, `${n}: Duplicate from the menu copies the question (${q0} → ${await qs()})`);
      }
    } else check(false, `${n}: a question is there`);
    await page.context().close();
  }

  // ---------- Code+ ----------
  {
    const page = await open('Code+');
    const n = `Code+ ${name}`;
    const tpl = page.locator(`${H} .tpl`).first();
    if (await tpl.count()) { await tpl.click(); await page.waitForTimeout(900); }
    const ed = page.locator(`${H} .cm-content`).first();
    const b = await ed.boundingBox().catch(() => null);
    if (b) {
      await right(page, { x: b.x + 30, y: b.y + 10 });
      if (await fits(page, n, viewport)) {
        check(await page.locator('.cell-menu [data-id="lines"]').count() === 1 && await page.locator('.cell-menu [data-id="ai"]').count() === 1, `${n}: the menu has the line tools and the copilot`);
        await pick(page, 'select-all');
        await right(page, { x: b.x + 30, y: b.y + 10 });
        await pick(page, 'copy');
        const clip = await page.evaluate(() => navigator.clipboard.readText());
        check(clip.length > 20, `${n}: Select all then Copy from the menu copies the code (${clip.length} characters)`);
        const before = (await page.locator(`${H} .cm-line`).first().innerText());
        await page.mouse.click(b.x + 30, b.y + 10);
        await right(page, { x: b.x + 30, y: b.y + 10 });
        await pick(page, 'comment');
        const after = (await page.locator(`${H} .cm-line`).first().innerText());
        check(after !== before, `${n}: Comment from the menu changes the line (${before.slice(0, 20)} → ${after.slice(0, 20)})`);
      }
    } else check(false, `${n}: a code file is open`);
    await page.context().close();
  }
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
if (!process.env.DEBUG) for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
