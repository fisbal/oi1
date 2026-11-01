import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('npx', ['vite', 'preview', '--port', '4291', '--strictPort'], { cwd: '/tmp/oi1', detached: true, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));
const b = await chromium.launch();
for (const [n, vp, m, lang] of [['pc', { width: 1440, height: 900 }, false, 'fr'], ['phone', { width: 390, height: 844 }, true, 'fr']]) {
  const p = await b.newPage({ viewport: vp, isMobile: m, hasTouch: m });
  await p.addInitScript(l => localStorage.setItem('oi1:language', l), lang);
  await p.goto('http://localhost:4291/');
  await p.locator('.slab:has-text("In 1 Class")').first().click(); await p.waitForTimeout(1500);
  await p.locator('.module-host:not([hidden]) .ribbon-tuto').click(); await p.waitForTimeout(300);
  await p.locator('.tuto-item').nth(5).click(); await p.waitForTimeout(300);
  await p.screenshot({ path: `/tmp/claude-0/-home-claude/233e9053-4864-5525-913d-192c4c790e83/scratchpad/tuto-${n}.png` });
}
await b.close(); process.kill(-srv.pid);
