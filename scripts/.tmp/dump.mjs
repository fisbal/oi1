import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const app = process.argv[2] || 'Office Class';
const srv = spawn('npx', ['vite', 'preview', '--port', '4290', '--strictPort'], { cwd: '/tmp/oi1', detached: true, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
await p.addInitScript(() => localStorage.setItem('oi1:language', 'en'));
await p.goto('http://localhost:4290/');
await p.locator(`.slab:has-text("${app}")`).first().click(); await p.waitForTimeout(1500);
const tabs = await p.locator('.module-host:visible .ribbon-tabs [role=tab]').allInnerTexts();
for (let i = 0; i < tabs.length; i++) {
  await p.locator('.module-host:visible .ribbon-tabs [role=tab]').nth(i).click(); await p.waitForTimeout(300);
  const items = await p.evaluate(() => [...document.querySelectorAll('.module-host .ribbon-panel button, .module-host .ribbon-panel input, .module-host .ribbon-panel select')].filter(e => e.offsetParent).map(e => `${e.closest('.rgroup')?.getAttribute('aria-label') ?? '-'} | ${e.getAttribute('aria-label') ?? e.textContent.trim().slice(0, 30)} | ${e.dataset.help ?? (e.dataset.helpText ? 'TEXT' : 'NONE')}`));
  console.log(`## ${tabs[i]} (${items.length})`); console.log(items.join('\n'));
}
await b.close(); process.kill(-srv.pid);
