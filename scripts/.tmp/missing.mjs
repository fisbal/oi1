import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('npx', ['vite', 'preview', '--port', '4292', '--strictPort'], { cwd: '/tmp/oi1', detached: true, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));
const b = await chromium.launch();
for (const app of process.argv.slice(2)) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => localStorage.setItem('oi1:language', 'en'));
  await p.goto('http://localhost:4292/');
  await p.locator(`.slab:has-text("${app}")`).first().click(); await p.waitForTimeout(1500);
  await p.locator('.module-host:not([hidden]) .ribbon-tuto').click(); await p.waitForTimeout(300);
  const cats = p.locator('.tuto-cats button'); const n = await cats.count();
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    await cats.nth(i).click(); await p.waitForTimeout(300);
    const rows = await p.evaluate(() => [...document.querySelectorAll('.module-host:not([hidden]) .ribbon-panel button[aria-label], .module-host:not([hidden]) .ribbon-panel input[aria-label]')].filter(e => e.offsetParent && !e.closest('.drop-panel')).map(e => [e.dataset.help ?? '', e.dataset.helpText ? 'T' : '', e.getAttribute('aria-label'), e.closest('.rgroup')?.getAttribute('aria-label') ?? '']));
    const generic = new Set(await p.locator('.tuto-item.tuto-generic').allInnerTexts());
    for (const [k, t, name, g] of rows) if (generic.has(name) && !seen.has(k + name)) { seen.add(k + name); console.log(`${app}\t${k || '-'}\t${name}\t${g}`); }
  }
  await p.close();
}
await b.close(); process.kill(-srv.pid);
