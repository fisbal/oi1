// The ribbon folds away for more room (Martin, 2026-10-30): button, double-click on a tab, Ctrl+F1; folded, a tab opens
// its buttons over the work and a tap on the work closes them; phones start folded; the choice is remembered.
// Checked in every app, on PC and phone. Run: npm run check:ribbon (after npm run build).
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const PORT = Number(process.env.PORT) || 4194;
const s = spawn('npx',['vite','preview','--port',String(PORT),'--strictPort'],{stdio:'ignore',detached:true});
for (let i=0;i<60;i++){try{if((await fetch(`http://localhost:${PORT}/`)).ok)break}catch{} await new Promise(r=>setTimeout(r,500));}
const b = await chromium.launch();
const out=[];
const ok=(n,c)=>out.push((c?'OK  ':'FAIL')+' '+n);
for (const [name,vp] of [['pc',{width:1440,height:900}],['phone',{width:390,height:844}]]) {
  for (const app of ['In 1 Letter','In 1 Stage','In 1 Class','In 1 Code+']) {
  const ctx = await b.newContext({viewport:vp,locale:'fr-FR',hasTouch:name==='phone',isMobile:name==='phone'});
  const p = await ctx.newPage(); p.on('pageerror', e => out.push('ERR '+e.message));
  await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(400);
    await p.locator(`.slab:has-text("${app}")`).first().click(); await p.waitForTimeout(1200);
    const host = p.locator('.module-host:not([hidden])');
    const panel = host.locator('.ribbon-panel').first();
    const min = () => p.evaluate(()=>document.documentElement.classList.contains('ribbon-min'));
    const vis = () => panel.isVisible();
    if (name==='phone') ok(`${name} ${app} starts folded`, await min());
    if (await min()) { await host.locator('.ribbon-toggle').click(); await p.waitForTimeout(200); }
    ok(`${name} ${app} open shows panel`, await vis());
    await host.locator('.ribbon-toggle').click(); await p.waitForTimeout(250);
    ok(`${name} ${app} toggle hides panel`, !(await vis()));
    const tabs = host.locator('.ribbon-tabs [role=tab]');
    await tabs.nth(1).click(); await p.waitForTimeout(250);
    ok(`${name} ${app} tab click overlays panel`, await vis());
    // A tap on the work itself (the middle of the work area, under the ribbon).
    const work = await p.evaluate(() => { const r = document.querySelector('.module-host:not([hidden]) .ribbon')?.getBoundingClientRect(); return r ? (r.bottom + innerHeight) / 2 : innerHeight - 60; });
    await p.mouse.click(vp.width/2, work); await p.waitForTimeout(250);
    ok(`${name} ${app} work click closes overlay`, !(await vis()));
    await tabs.nth(1).dblclick(); await p.waitForTimeout(250);
    ok(`${name} ${app} dblclick unfolds`, !(await min()) && await vis());
    await p.keyboard.press('Control+F1'); await p.waitForTimeout(200);
    ok(`${name} ${app} Ctrl+F1 folds`, await min());
    await p.keyboard.press('Control+F1'); await p.waitForTimeout(200);
    ok(`${name} ${app} Ctrl+F1 unfolds`, !(await min()));
  await ctx.close();
  }
  const ctx = await b.newContext({viewport:vp,locale:'fr-FR'});
  const p = await ctx.newPage(); await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(400);
  // remember choice
  await p.locator(`.slab:has-text("In 1 Letter")`).first().click(); await p.waitForTimeout(1000);
  await p.locator('.module-host:not([hidden]) .ribbon-toggle').click(); await p.waitForTimeout(200);
  await p.reload(); await p.waitForTimeout(800);
  ok(`${name} choice remembered after reload`, (name==="phone") !== await p.evaluate(()=>document.documentElement.classList.contains('ribbon-min')));
  await ctx.close();
}
console.log(out.join('\n'));
await b.close(); try { process.kill(-s.pid); } catch { /* already stopped */ }
const bad = out.filter(l => !l.startsWith('OK'));
if (bad.length) { console.error(`\n${bad.length} ribbon problem(s).`); process.exit(1); }
console.log('\nRibbon fold: all good.');
