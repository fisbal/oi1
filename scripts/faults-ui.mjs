// The fault detector, part 2: uses every app of Office In 1 like a first-time user (Martin, 2026-11-03: "fais des tests
// de chaque onglet et bouton dans Office In 1, détecte ce qui fonctionne et ce qui ne le fait pas"). On a PC and on a
// phone it opens each app, puts a little text in it, then presses every button of every ribbon tab and opens every
// list (and picks its first and last choice). For each press it notes: a script error, an error in the console, a
// button that cannot be pressed (hidden, under something), and a button that changes nothing on the screen.
// Writes screens/faults-ui.json and screens/faults-ui.md. Run after `npm run build`:
//   node scripts/faults-ui.mjs            APPS="Letter,Class" SCREENS=pc  to look at a part only
// Exit 1 when a script error is found (the rest is a report to read and fix).

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4228;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const ALL = ['Letter', 'Class', 'Stage', 'Code+', 'Draw', 'Notes', 'Plan', 'Form', 'Mail', 'Image', 'Assistant'];
const APPS = process.env.APPS ? process.env.APPS.split(',') : ALL;
const SCREENS = [['PC', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]
  .filter(s => !process.env.SCREENS || process.env.SCREENS.split(',').includes(s[0].toLowerCase()));
const H = '.module-host:not([hidden])';
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const found = []; // { screen, app, tab, button, kind, detail }
const stats = { apps: 0, tabs: 0, pressed: 0, lists: 0 };
const note = (f) => found.push(f);

// Calls the app makes that would leave the page: counted instead (a press that prints or opens a window did something).
const STUBS = `(() => {
  window.__did = 0;
  const did = () => { window.__did++; };
  window.print = did;
  window.open = () => { did(); return null; };
  try { navigator.clipboard.writeText = async () => did(); navigator.clipboard.write = async () => did(); } catch {}
  window.showOpenFilePicker = async () => { did(); throw new DOMException('cancel', 'AbortError'); };
  window.showSaveFilePicker = async () => { did(); throw new DOMException('cancel', 'AbortError'); };
  window.showDirectoryPicker = async () => { did(); throw new DOMException('cancel', 'AbortError'); };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { did(); if (!this.download && !/^blob:|^data:/.test(this.href)) return; };
  HTMLInputElement.prototype.showPicker = function () { did(); };
  const iclick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () { if (this.type === 'file') { did(); return; } return iclick.call(this); };
  window.speechSynthesis && (window.speechSynthesis.speak = did);
  try { localStorage.setItem('oi1:language', 'fr'); localStorage.setItem('oi1.tips.on', '0'); } catch {}
  // Every change of the page (a word, a class, a menu, a message) is counted: no change at all = the press did nothing.
  window.__mut = 0;
  const start = () => new MutationObserver(list => { for (const m of list) if (!(m.type === 'attributes' && m.attributeName === 'style' && m.target.closest?.('.slab, .scene, canvas'))) window.__mut++; })
    .observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  if (document.documentElement) start(); else addEventListener('DOMContentLoaded', start);
})();`;

/** What happened on the page so far: changes counted, actions done outside (print, window, file, clipboard), dialogs. */
let dialogs = 0;
const look = page => page.evaluate(() => `${window.__mut}#${window.__did}`).then(x => `${x}#${dialogs}`);

async function tidy(page, vp) {
  for (let i = 0; i < 2; i++) await page.keyboard.press('Escape').catch(() => {});
  // A dialog left open: its Cancel / Close button.
  for (const sel of ['dialog[open] .dialog-buttons button:not(.primary)', 'dialog[open] button[aria-label*="ermer"]', 'dialog[open] button:has-text("Annuler")', '.modal button:has-text("Annuler")']) {
    const b = page.locator(sel).first();
    if (await b.count() && await b.isVisible().catch(() => false)) { await b.click({ timeout: 1000 }).catch(() => {}); break; }
  }
  if (await page.locator('.drop-panel').count()) await page.mouse.click(4, vp.height - 4).catch(() => {});
}

async function openApp(page, app, mobile) {
  await page.goto(url);
  await page.locator('.slab').first().waitFor({ timeout: 15000 });
  const slab = page.locator(`.slab:has-text("In 1 ${app}")`).first();
  if (!(await slab.count())) return false;
  await slab.click();
  await page.waitForTimeout(1500);
  const host = page.locator(H);
  // A little real work to act on: text, a sample picture, a template.
  if (app === 'Image') { const s = host.locator('.im-sample').first(); if (await s.count()) { await s.click(); await page.waitForTimeout(1200); } }
  if (app === 'Code+') { const tp = host.locator('.code .tpl, .tpl').first(); if (await tp.count()) { await tp.click(); await page.waitForTimeout(900); } }
  const pm = host.locator('.ProseMirror').first();
  if (await pm.count() && await pm.isVisible().catch(() => false)) {
    await pm.click().catch(() => {});
    await page.keyboard.type('Bonjour le monde. Ceci est un essai pour Office In 1.');
    await page.keyboard.press('ControlOrMeta+a');
  }
  if (app === 'Class') {
    await page.keyboard.type('12'); await page.keyboard.press('Enter'); await page.keyboard.type('30'); await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Shift+ArrowUp');
  }
  // Phones start with the ribbon folded: open it to reach every button.
  if (mobile && await page.evaluate(() => document.documentElement.classList.contains('ribbon-min'))) {
    await host.locator('.ribbon-toggle').first().click().catch(() => {});
    await page.waitForTimeout(300);
  }
  return true;
}

const label = el => el.evaluate(e => (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60));

for (const [screen, vp, mobile] of SCREENS) {
  for (const app of APPS) {
    // One fresh page per ribbon tab, so a press in one tab never spoils the next one.
    let tabNames = null;
    let resume = 0;
    for (let ti = 0; tabNames === null || ti < tabNames.length; ti++) {
      let lost = false;
      const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, locale: 'fr-CA', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await ctx.newPage();
      let errors = [];
      page.on('pageerror', e => errors.push(`script error: ${e.message.split('\n')[0]}`));
      page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon|languagetool|Content Security Policy|the server responded/i.test(m.text())) errors.push(`console: ${m.text().split('\n')[0].slice(0, 160)}`); });
      page.on('dialog', d => { dialogs++; d.dismiss().catch(() => {}); });
      page.on('filechooser', () => page.evaluate(() => { window.__did++; }).catch(() => {}));
      page.on('download', () => page.evaluate(() => { window.__did++; }).catch(() => {}));
      page.on('popup', p => p.close().catch(() => {}));
      await page.addInitScript(STUBS);
      try {
        if (!(await openApp(page, app, mobile))) { if (ti === 0) note({ screen, app, kind: 'missing', detail: 'the app is not on the home screen' }); await ctx.close(); break; }
        const host = page.locator(H);
        const tabs = host.locator('.ribbon-tabs [role=tab]');
        if (tabNames === null) {
          tabNames = await tabs.allInnerTexts();
          stats.apps++;
          if (errors.length) for (const e of [...new Set(errors)]) note({ screen, app, tab: '(opening)', kind: 'error', detail: e });
          if (!tabNames.length) { note({ screen, app, kind: 'no-ribbon', detail: 'no ribbon tab' }); await ctx.close(); break; }
        }
        errors = [];
        const tab = tabs.nth(ti);
        const tabName = (tabNames[ti] || '').trim();
        await tab.scrollIntoViewIfNeeded().catch(() => {});
        await tab.click({ timeout: 3000 });
        await page.waitForTimeout(300);
        stats.tabs++;
        const panel = host.locator('.ribbon-panel').first();
        const buttons = panel.locator('button:not(.drop-panel button)');
        const n = await buttons.count();
        if (!n) note({ screen, app, tab: tabName, kind: 'empty-tab', detail: 'no button in this tab' });
        for (let bi = resume; bi < n; bi++) {
          // The ribbon is drawn again after a press: find the button by its place each time.
          if (!(await panel.isVisible().catch(() => false))) { await tab.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(200); }
          const b = panel.locator('button:not(.drop-panel button)').nth(bi);
          if (!(await b.count())) break;
          if (await b.evaluate(e => e.closest('.drop-panel') !== null || e.disabled || e.getAttribute('aria-disabled') === 'true' || e.getBoundingClientRect().width === 0).catch(() => true)) continue;
          const name = await label(b);
          const isDrop = await b.evaluate(e => !!e.parentElement?.classList.contains('drop'));
          await b.scrollIntoViewIfNeeded().catch(() => {});
          // Hovering shows its help bubble: that is not the press doing something.
          await b.hover({ timeout: 1500 }).catch(() => {});
          await page.waitForTimeout(250);
          const before = await look(page);
          errors = [];
          try { await b.click({ timeout: 2500 }).catch(async e => { if (!/intercepts pointer/.test(String(e))) throw e; await page.waitForTimeout(500); await b.click({ timeout: 2500 }); }); }
          catch (e) {
            const why = /intercepts pointer|another element/.test(String(e)) ? 'hidden under something' : /outside of the viewport|not visible/.test(String(e)) ? 'out of the screen' : String(e.message ?? e).split('\n')[0].slice(0, 80);
            note({ screen, app, tab: tabName, button: name, kind: 'cannot-press', detail: why });
            await tidy(page, vp);
            continue;
          }
          stats.pressed++;
          await page.waitForTimeout(isDrop ? 250 : 450);
          if (isDrop) {
            stats.lists++;
            const items = page.locator('.drop-panel').last().locator('.menu-item, [role=menuitem], [role=option], button');
            const count = await items.count();
            if (!count && (await page.locator('.drop-panel').last().innerText().catch(() => '')).trim().length < 12) note({ screen, app, tab: tabName, button: name, kind: 'empty-list', detail: 'the list opens empty, without a word to say why' });
            // Its first and last choice, like a person trying it.
            for (const which of count ? [0, count - 1].filter((x, i, a) => a.indexOf(x) === i) : []) {
              if (which > 0) { await tidy(page, vp); await b.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(250); }
              const it = page.locator('.drop-panel').last().locator('.menu-item, [role=menuitem], [role=option], button').nth(which);
              if (!(await it.count())) continue;
              const iname = await label(it);
              const pre = await look(page);
              try { await it.scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(250); await it.click({ timeout: 2000 }).catch(async e => { if (!/intercepts pointer/.test(String(e))) throw e; await page.waitForTimeout(500); await it.click({ timeout: 2000 }); }); }
              catch (e) { note({ screen, app, tab: tabName, button: `${name} › ${iname}`, kind: 'cannot-press', detail: /intercepts pointer/.test(String(e)) ? 'hidden under something' : 'out of the screen' }); continue; }
              await page.waitForTimeout(450);
              if ((await look(page)) === pre && !(await it.evaluate(e => e.disabled).catch(() => false))) note({ screen, app, tab: tabName, button: `${name} › ${iname}`, kind: 'no-effect', detail: 'nothing changes on the screen' });
            }
          } else if ((await look(page)) === before && !(await page.waitForTimeout(1000).then(() => look(page)).then(x => x !== before))
            && !(await b.evaluate(e => e.classList.contains('on') || e.getAttribute('aria-pressed') === 'true' || e.getAttribute('aria-selected') === 'true' || e.getAttribute('aria-checked') === 'true').catch(() => false))) {
            note({ screen, app, tab: tabName, button: name, kind: 'no-effect', detail: 'nothing changes on the screen' });
          }
          for (const e of [...new Set(errors)]) note({ screen, app, tab: tabName, button: name, kind: 'error', detail: e });
          await tidy(page, vp);
          // A press that opened another app or left the page: the next buttons on a fresh page.
          if (!(await host.locator('.ribbon-tabs').first().isVisible().catch(() => false))) { lost = true; resume = bi + 1; break; }
        }
        // Text cut inside this tab's buttons.
        const cut = await panel.evaluate(p => [...p.querySelectorAll('button span, button b, button small, .rb-label')].filter(e => e.getBoundingClientRect().width > 0 && e.scrollWidth > e.clientWidth + 2).map(e => e.textContent.trim()).slice(0, 8)).catch(() => []);
        for (const c of cut) note({ screen, app, tab: tabName, button: c, kind: 'cut-text', detail: 'its name is cut' });
      } catch (e) {
        note({ screen, app, tab: tabNames?.[ti], kind: 'stopped', detail: String(e.message ?? e).split('\n')[0].slice(0, 120) });
      } finally { await ctx.close(); }
      if (tabNames === null) break;
      if (lost) { ti--; continue; }
      resume = 0;
    }
    console.log(`${screen} ${app}: done (${found.filter(f => f.screen === screen && f.app === app).length} findings)`);
  }
}

await browser.close();
try { process.kill(-server.pid); } catch { /* gone */ }

mkdirSync('screens', { recursive: true });
writeFileSync(`${process.env.OUT || 'screens/faults-ui'}.json`, JSON.stringify({ stats, found }, null, 1));
const KINDS = { error: 'Script errors', stopped: 'Check stopped', 'cannot-press': 'Buttons that cannot be pressed', 'empty-list': 'Lists that open empty', 'empty-tab': 'Empty tabs', 'no-effect': 'Buttons that change nothing on the screen', 'cut-text': 'Cut names', missing: 'Missing apps', 'no-ribbon': 'No ribbon' };
let md = `# Office In 1, every button pressed\n\n${stats.apps} apps, ${stats.tabs} tabs, ${stats.pressed} buttons pressed, ${stats.lists} lists opened.\n`;
for (const [k, title] of Object.entries(KINDS)) {
  const list = found.filter(f => f.kind === k);
  if (!list.length) continue;
  md += `\n## ${title} (${list.length})\n\n`;
  for (const f of list) md += `- ${f.screen} · ${f.app}${f.tab ? ` › ${f.tab}` : ''}${f.button ? ` › ${f.button}` : ''}: ${f.detail}\n`;
}
writeFileSync(`${process.env.OUT || 'screens/faults-ui'}.md`, md);
console.log(md);
process.exit(found.some(f => f.kind === 'error') ? 1 : 0);
