// Office In 1 runs only its own scripts (Martin 2026-11-17: "Office In 1 doit rester secure").
// Checks, like a person, on PC, tablet and phone (both ways on phone and tablet):
//  1. the built page has a strict script-src (no 'unsafe-inline', no 'unsafe-eval'), with the theme script's hash;
//  2. every app and every ribbon tab opens with NO script blocked by that rule (nothing of ours is broken by it);
//  3. a script slipped into the page (img onerror, inline <script>, javascript: link) does not run;
//  4. In 1 Code+ still runs people's code: preview, console, the "new window" preview, the phone link (#run=),
//     on its own sandbox page (public/preview.html) that cannot read Office In 1's storage;
//  5. preview.html opened on its own (not in a sandbox) runs nothing.
// Run after `npm run build`:  node scripts/check-csp.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4246;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

// 1. The policy itself.
const html = readFileSync('dist/index.html', 'utf8');
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1] ?? '';
const scriptSrc = csp.match(/script-src ([^;]*)/)?.[1] ?? '';
check(/'self'/.test(scriptSrc) && !/unsafe-inline|'unsafe-eval'|\*(?!\.)/.test(scriptSrc), `policy: strict script-src (${scriptSrc.slice(0, 80)}…)`);
check(/'sha256-[A-Za-z0-9+/=]+'/.test(scriptSrc), 'policy: the inline theme script is allowed by its hash only');
check(/object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp), 'policy: no plug-ins, no <base>');

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const APPS = ['Letter', 'Class', 'Stage', 'Code+', 'Draw', 'Notes', 'Plan', 'Form', 'Mail', 'Image', 'Assistant'];
const SIZES = [
  ['PC', { width: 1440, height: 900 }, false],
  ['Tablet', { width: 820, height: 1180 }, true],
  ['Tablet sideways', { width: 1180, height: 820 }, true],
  ['Phone', { width: 390, height: 844 }, true],
  ['Phone sideways', { width: 844, height: 390 }, true],
];

/** Home screen, then the app's slab (a reload brings back the open app, so the logo goes home). */
async function openApp(page, app) {
  const slab = page.locator(`.slab:has-text("In 1 ${app}")`).first();
  if (!(await slab.isVisible().catch(() => false))) await page.locator('button.brand').first().click().catch(() => {});
  await page.waitForTimeout(300);
  if (!(await slab.isVisible().catch(() => false))) return false;
  await slab.click();
  await page.waitForTimeout(900);
  return true;
}

for (const [name, viewport, mobile] of SIZES) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const blocked = [];
  page.on('console', m => { if (/Content Security Policy/i.test(m.text())) blocked.push(m.text().slice(0, 200)); });
  page.on('dialog', d => d.dismiss());
  await page.goto(url);
  await page.waitForTimeout(600);
  check(await page.evaluate(() => !!document.documentElement.dataset.theme), `${name}: the theme script ran (its hash matches)`);

  // 2. Every app, every tab (fewer on the small sizes: the PC pass already opens them all).
  const full = name === 'PC';
  const want = full ? APPS : ['Letter', 'Code+'];
  let opened = 0;
  for (const app of want) {
    if (!(await openApp(page, app))) continue;
    opened++;
    if (app === 'Code+') { const tpl = page.locator('.code .tpl').first(); if (await tpl.count()) { await tpl.click(); await page.waitForTimeout(600); } }
    const tabs = page.locator('.module-host:not([hidden]) .ribbon-tabs [role=tab]');
    const n = await tabs.count();
    for (let i = 0; i < n; i++) { await tabs.nth(i).click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(120); }
    console.error(`  … ${name} ${app}: ${n} tabs`);
  }
  check(opened === want.length, `${name}: ${opened}/${want.length} apps opened`);
  check(blocked.length === 0, `${name}: every app and tab opens with no script of ours blocked${blocked.length ? `: ${blocked[0]}` : ''}`);

  // 3. A script slipped into the page does not run.
  await page.goto(url);
  await page.waitForTimeout(400);
  const ran = await page.evaluate(async () => {
    const w = /** @type {any} */ (window);
    const d = document.createElement('div');
    d.innerHTML = '<img src="x:none" onerror="window.__pwned1=1"><a id="jsl" href="javascript:window.__pwned3=1">x</a>';
    document.body.append(d);
    const s = document.createElement('script');
    s.textContent = 'window.__pwned2 = 1';
    document.body.append(s);
    /** @type {HTMLAnchorElement} */ (document.getElementById('jsl')).click();
    await new Promise(r => setTimeout(r, 400));
    d.remove(); s.remove();
    return [w.__pwned1, w.__pwned2, w.__pwned3].filter(Boolean).length;
  });
  check(ran === 0, `${name}: injected scripts (onerror, <script>, javascript:) do not run`);
  blocked.length = 0;

  // 4. Code+ runs people's code on its own sandbox page.
  check(await openApp(page, 'Code+'), `${name}: Code+ opens`);
  await page.locator('.code .tpl').first().click().catch(() => {});
  await page.waitForTimeout(600);
  const code = page.locator('.module-host:not([hidden]) .code');
  await code.locator('.run-pill').first().click().catch(() => {});
  await page.waitForTimeout(400);
  // The project's page, written in the editor: a script that writes, logs, and tries to read Office In 1's storage.
  await page.evaluate(() => localStorage.setItem('oi1.csp.secret', 'keep-me'));
  const ok = await page.waitForFunction(() => document.querySelector('.module-host:not([hidden]) .code-preview iframe')?.getAttribute('src')?.endsWith('preview.html'), null, { timeout: 8000 }).then(() => true).catch(() => false);
  check(ok, `${name}: Code+ preview is the sandbox page, not srcdoc`);
  const frameEl = await page.$('.module-host:not([hidden]) .code-preview iframe');
  /** The frame where people's code runs: inside preview.html, sandboxed. */
  const innerOf = async (el) => { const host = el && await el.contentFrame(); for (let i = 0; i < 40 && host && !host.childFrames().length; i++) await page.waitForTimeout(100); return host?.childFrames()[0] ?? null; };
  const frame = await innerOf(frameEl);
  const inside = frame && await frame.waitForFunction(() => document.body && document.body.innerText.trim().length > 0, null, { timeout: 8000 })
    .then(() => frame.evaluate(() => {
      let storage = 'blocked';
      try { storage = String(localStorage.getItem('oi1.csp.secret')); } catch { /* opaque origin */ }
      return { text: document.body.innerText.trim().slice(0, 40), origin: self.origin, storage, scripts: document.scripts.length };
    })).catch(() => null);
  check(!!inside?.text, `${name}: Code+ preview shows the project's page${inside ? ` ("${inside.text}")` : ''}`);
  check(inside?.origin === 'null' && inside?.storage !== 'keep-me', `${name}: the preview cannot read Office In 1's storage (origin ${inside?.origin}, storage ${inside?.storage})`);
  // The project's own script runs in the preview (the template's or one we add).
  const runs = frame && await frame.evaluate(() => { const s = document.createElement('script'); s.textContent = 'document.body.dataset.ran = "1"'; document.body.append(s); return document.body.dataset.ran === '1'; }).catch(() => false);
  check(runs, `${name}: scripts run inside the Code+ preview`);

  if (name === 'PC') {
    // Offline: the sandbox page comes from the service worker (vite preview is http, so register it here).
    await page.evaluate(() => navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready));
    await page.reload();
    await page.waitForTimeout(1200);
    await openApp(page, 'Code+');
    await page.locator('.code .tpl').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await ctx.setOffline(true);
    await page.locator('.module-host:not([hidden]) .preview-bar button[aria-label]').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const off = await innerOf(await page.$('.module-host:not([hidden]) .code-preview iframe'));
    check(!!off && (await off.evaluate(() => document.body.innerText.trim().length > 0).catch(() => false)), 'PC: Code+ preview works offline');
    await ctx.setOffline(false);
    // The "new window" preview.
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 6000 }).catch(() => null), page.locator('.module-host:not([hidden]) .preview-bar button[aria-label]').last().click({ timeout: 5000 }).catch(() => {})]);
    let popOk = false;
    if (pop) {
      await pop.waitForTimeout(1500);
      const host = await (await pop.$('iframe'))?.contentFrame();
      const f = host?.childFrames()[0];
      popOk = !!f && (await f.evaluate(() => document.body.innerText.trim().length > 0).catch(() => false));
      await pop.close();
    }
    check(popOk, 'PC: the "new window" preview runs the project');
    // preview.html opened directly runs nothing.
    const direct = await ctx.newPage();
    await direct.goto(`${url}preview.html`);
    check((await direct.evaluate(() => document.body.innerText.trim())) === 'In 1 Code+', 'PC: preview.html opened on its own runs nothing');
    await direct.close();
  }
  check(blocked.length === 0, `${name}: Code+ has no script of ours blocked${blocked.length ? `: ${blocked[0]}` : ''}`);
  await ctx.close();
}

// 4b. The phone link (#run=…) runs the project full screen.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  // The same packing as src/modules/code/project.ts packRun: deflate-raw, base64url.
  const json = JSON.stringify({ p: 'index.html', f: { 'index.html': '<h1>Lien</h1><script>document.querySelector("h1").textContent = "Lien OK"</script>' } });
  const link = `${url}#run=${deflateRawSync(Buffer.from(json)).toString('base64url')}`;
  {
    await page.goto(link);
    await page.waitForTimeout(1500);
    const f = (await (await page.$('iframe'))?.contentFrame())?.childFrames()[0];
    check(((await f?.evaluate(() => document.body.innerText).catch(() => '')) ?? '').includes('Lien OK'), 'Phone: a #run= link runs the project');
  }
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already stopped */ }
for (const p of passed) console.log(`  ✓ ${p}`);
for (const p of problems) console.log(`  ✗ ${p}`);
if (problems.length) { console.error(`\n${problems.length} security policy problem(s).`); process.exit(1); }
console.log(`\nOnly Office In 1's own scripts run, and Code+ still runs people's code: ${passed.length} checks passed.`);
