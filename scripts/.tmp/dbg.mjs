import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('npx', ['vite', 'preview', '--port', '4293', '--strictPort'], { cwd: '/tmp/oi1', detached: true, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));
const b = await chromium.launch(); const p = await b.newPage();
p.on('console', m => console.log('console', m.type(), m.text().slice(0, 200)));
p.on('pageerror', e => console.log('err', e.message));
await p.addInitScript(() => { localStorage.setItem('oi1:ai:key', 'sk-ant-test'); localStorage.setItem('oi1:language', 'fr'); });
await p.route('https://api.anthropic.com/**', r => { console.log('AI called'); r.fulfill({ status: 200, contentType: 'text/event-stream', body: '' }); });
await p.goto('http://localhost:4293/');
await p.locator('.slab:has-text("In 1 Letter")').first().click(); await p.waitForTimeout(1500);
await p.locator('.module-host:not([hidden]) .sheet .ProseMirror:not(.header-text):not(.footer-text)').first().click();
await p.keyboard.type('Bonjour le monde'); await p.waitForTimeout(300);
await p.locator('select.lang').selectOption({ label: 'English' });
await p.locator('dialog.lang-choice[open] .lang-choice-option').nth(2).click();
for (let i = 0; i < 6; i++) { await p.waitForTimeout(500); console.log('toast', await p.locator('.toast').allInnerTexts().catch(() => [])); }
await b.close(); process.kill(-srv.pid);
