// Training in Office Code+ (Martin, 2026-10-30): every one of the 60 exercises is played like a learner would,
// in the real sandbox: check (fails), check again, open the solution, check (passes), next. The step-by-step
// simulation, the Parsons buttons and the hints are tried too, on PC and phone.
// Run: npm run check:training (after npm run build).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
mkdirSync('screens', { recursive: true });
const PORT = 4196;
const s = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
const b = await chromium.launch();
const out = [];
const ok = (n, c, more = '') => out.push(`${c ? 'OK  ' : 'FAIL'} ${n}${c || !more ? '' : ` (${more})`}`);

try {
for (const [name, vp] of [['pc', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', hasTouch: name === 'phone', isMobile: name === 'phone' });
  const p = await ctx.newPage();
  p.on('pageerror', e => out.push(`FAIL ${name} page error: ${e.message}`));
  await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(400);
  await p.locator('.slab:has-text("Office Code+")').first().click(); await p.waitForTimeout(1200);
  const host = p.locator('.module-host:not([hidden])');
  const tab = host.locator('.ribbon-tabs [role=tab]:has-text("Entraînement")');
  await tab.click(); await p.waitForTimeout(250);
  const courses = host.locator('.drop:has(button[aria-label="Parcours"])');
  await courses.locator('button').first().click(); await p.waitForTimeout(200);
  const items = courses.locator('.menu-item');
  const n = await items.count();
  ok(`${name} 20+ courses in the list`, n >= 20, String(n));
  // The list must be inside the screen (phones too).
  const box = await courses.locator('.drop-panel').boundingBox();
  ok(`${name} course list inside the screen`, !!box && box.x >= 0 && box.x + box.width <= vp.width + 1);
  await items.first().click(); await p.waitForTimeout(600);
  const panel = host.locator('.tr-panel');
  ok(`${name} exercise opens in the panel`, await panel.locator('.tr-brief').isVisible());
  ok(`${name} exercise file is open in the editor`, (await host.locator('.file-tab.on').innerText()).includes('.js'));

  // The step-by-step simulation on the first exercise (after its solution is in).
  const act = label => panel.locator(`.tr-actions button:has-text("${label}")`);
  const check = async () => { await act('Vérifier').click(); await p.waitForTimeout(150); await panel.locator('.tr-actions button:has-text("Vérifier"):not([disabled])').waitFor({ timeout: 25000 }); await p.waitForTimeout(100); };
  const total = name === 'pc' ? 1e9 : 6;
  let played = 0, passed = 0, sims = 0;
  const failed = [];
  while (played < total) {
    const title = await panel.locator('.tr-head b').innerText();
    const kind = await panel.locator('.tr-kind').innerText();
    await check(); await check();
    const solBtn = act('Solution');
    if (await solBtn.isDisabled()) { failed.push(`${title}: solution stays closed after two tries`); }
    await solBtn.click(); await p.waitForTimeout(200);
    if (kind === 'Prédire') {
      const said = await panel.locator('.tr-result .tr-code').innerText();
      await panel.locator('.tr-answer textarea').fill(said);
    }
    await check();
    const right = await panel.locator('.tr-result.test-ok').count();
    if (right) passed++; else failed.push(`${title}: ${(await panel.locator('.tr-result').innerText().catch(() => '?')).replace(/\s+/g, ' ').slice(0, 160)}`);
    if (sims < 2 && await act('Pas à pas').count() && kind !== 'Prédire') {
      await act('Pas à pas').click();
      await panel.locator('.tr-sim header input[type=range], .tr-sim .sev-error').first().waitFor({ timeout: 12000 }).catch(() => {});
      const steps = await panel.locator('.tr-sim header .muted').innerText().catch(() => '');
      ok(`${name} simulation of “${title}” has steps`, /Pas 1 sur \d+/.test(steps), steps);
      await panel.locator('.tr-sim header button[aria-label="Pas suivant"]').click(); await p.waitForTimeout(150);
      ok(`${name} simulation steps on`, /Pas 2 sur/.test(await panel.locator('.tr-sim header .muted').innerText()));
      ok(`${name} simulation shows variables`, await panel.locator('.tr-vars tr').count() > 0);
      sims++;
    }
    played++;
    const next = panel.locator('.tr-result .fix:has-text("Suivant")');
    if (!(await next.count()) || await next.isDisabled()) break;
    await next.click(); await p.waitForTimeout(400);
  }
  ok(`${name} ${played} exercises played, all pass with their solution`, passed === played && !failed.length, failed.join(' | '));

  // Hints come one by one; Parsons lines move with the arrows.
  if (!(await courses.isVisible())) { await tab.click(); await p.waitForTimeout(250); }
  await courses.locator('button').first().click(); await p.waitForTimeout(200);
  await items.nth(2).click(); await p.waitForTimeout(500);
  await act('Indice').click(); await p.waitForTimeout(100);
  ok(`${name} first hint shows`, await panel.locator('.tr-hint').count() === 1);
  await act('Indice').click(); await p.waitForTimeout(100);
  ok(`${name} second hint shows, then no more`, await panel.locator('.tr-hint').count() === 2 && await act('Indice').isDisabled());
  await panel.locator('.tr-head .fix').click(); await p.waitForTimeout(200);
  await panel.locator('.tr-course:has-text("Boucles")').click(); await p.waitForTimeout(400);
  // Loops: exercise 2 is a Parsons problem.
  await panel.locator('.tr-actions').waitFor();
  if (!(await panel.locator('.tr-lines').count())) {
    if (!(await host.locator('.ribbon-panel button[aria-label="Suivant"]').isVisible())) { await tab.click(); await p.waitForTimeout(200); }
    await host.locator('.ribbon-panel button[aria-label="Suivant"]').click(); await p.waitForTimeout(400);
  }
  const first = await panel.locator('.tr-lines li code').first().innerText().catch(() => '');
  await panel.locator('.tr-lines li').first().locator('button[aria-label="Descendre"]').click().catch(() => {});
  await p.waitForTimeout(150);
  const second = await panel.locator('.tr-lines li code').nth(1).innerText().catch(() => '');
  ok(`${name} Parsons line moves down`, !!first && first === second, `${first} / ${second}`);
  // Nothing in the panel runs off the screen.
  const wide = await panel.evaluate(el => [...el.querySelectorAll('*')].filter(x => { const r = x.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).map(x => x.className || x.tagName).slice(0, 3));
  ok(`${name} training panel fits the screen`, !wide.length, wide.join(', '));
  await p.screenshot({ path: `screens/training-${name}.png` }).catch(() => {});
  await ctx.close();
}
} catch (e) { out.push(`FAIL crashed: ${e.message.split('\n')[0]}`); }
console.log(out.join('\n'));
await b.close(); s.kill();
const bad = out.filter(l => !l.startsWith('OK'));
if (bad.length) { console.error(`\n${bad.length} training problem(s).`); process.exit(1); }
console.log('\nTraining: all good.');
