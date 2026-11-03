// In 1 Notes, "Listen and take notes" (Martin, 2026-11-03), used like a person would on PC, tablet, phone and phone
// sideways: say "In 1, prends des notes" to the 🎙️ In 1 button, In 1 Notes opens its consent card (it never listens
// before the box "everyone agrees" is ticked), the red light shows while it listens, a pretend meeting is spoken,
// Pause / Resume work, Stop writes Summary / Key points / To do above the full text, and the to-dos go to In 1 Plan.
// Run after `npm run build`:
//   node scripts/check-listen.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4221;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
// The speech service: each start() of the 🎙️ button hears one phrase of window.__queue; once that is empty, the next
// start() hears the whole meeting (window.__talk), one sentence every 1.6 s, like a real continuous session.
const FAKE_WEB = `(() => {
  class SR {
    start() {
      setTimeout(() => { this.onstart?.(); this.onaudiostart?.(); }, 30);
      this.off = false;
      const say = words => {
        setTimeout(() => !this.off && this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: words }], { isFinal: false })] }), 250);
        setTimeout(() => !this.off && this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: words }], { isFinal: true })] }), 550);
      };
      const one = (window.__queue || []).shift();
      if (one) { say(one); return; }
      // The meeting: one sentence every 1.6 s for as long as this session listens.
      const next = () => { if (this.off) return; const w = (window.__talk || []).shift(); if (!w) return; say(w); setTimeout(next, 1600); };
      next();
    }
    stop() { this.off = true; setTimeout(() => this.onend?.(), 20); } abort() { this.stop(); }
  }
  window.SpeechRecognition = SR; window.webkitSpeechRecognition = SR;
})();`;
const TALK = [
  "bonjour à tous aujourd'hui on parle du lancement du nouveau site",
  'le budget est de 12000 euros pour cette année',
  'il faut envoyer la maquette au client avant vendredi',
  'nous avons décidé de garder la couleur verte',
];
const H = '.app-frame:not([hidden])';
const until = async (page, fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };
const onScreen = async (loc, vw) => { const b = await loc.boundingBox().catch(() => null); return !!b && b.x >= -1 && b.x + b.width <= vw.width + 1 && b.y >= -1 && b.y + b.height <= vw.height + 1; };

const SCREENS = [
  ['PC', { width: 1440, height: 900 }, false],
  ['Tablet', { width: 820, height: 1180 }, true],
  ['Phone', { width: 390, height: 844 }, true],
  ['Phone sideways', { width: 844, height: 390 }, true],
];
for (const [name, viewport, mobile] of SCREENS) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR', isMobile: mobile, hasTouch: mobile, permissions: ['microphone'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}${process.env.DBG ? e.stack : ''}`));
  await page.addInitScript(`try { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'fr'); sessionStorage.setItem('set', '1'); } } catch {}
window.__queue = ['In 1, prends des notes']; window.__talk = ${JSON.stringify(TALK)};
${FAKE_WEB}`);
  await page.goto(url);
  const btn = page.locator('.in1-voice-btn');
  await btn.waitFor({ timeout: 10000 });
  await btn.click();
  const dlg = page.locator('dialog[open]');
  check(await until(page, () => /prendre des notes/i.test(document.querySelector('dialog[open]')?.textContent ?? ''), undefined, 12000), `${name}: "In 1, prends des notes" opens In 1 Notes and its consent card`);
  check(/Prévenez d’abord/.test(await dlg.textContent().catch(() => '')), `${name}: the card asks to tell the people around and get their consent`);
  check(await onScreen(dlg.locator('.dialog-buttons button.primary'), viewport), `${name}: the card's OK button is on screen`);
  // OK without the tick: nothing starts.
  await dlg.locator('.dialog-buttons button.primary').click();
  await page.waitForTimeout(400);
  check(await dlg.isVisible() && await page.locator(`${H} .nt-rec`).count() === 0, `${name}: without the tick, nothing listens and the card says why`);
  await dlg.locator('.nt-listen-kinds label').nth(1).click();
  await dlg.locator('.nt-listen-check input').check();
  await dlg.locator('.dialog-buttons button.primary').click();
  const rec = page.locator(`${H} .nt-rec`);
  check(await until(page, sel => !!document.querySelector(sel)?.offsetParent, `${H} .nt-rec`, 6000), `${name}: the red light "Enregistrement en cours" shows`);
  check(await onScreen(rec, viewport), `${name}: the red light and its buttons are on screen`);
  const ed = `${H} .notes .ProseMirror`;
  const heard = await until(page, sel => /couleur verte/i.test(document.querySelector(sel)?.innerText ?? ''), ed, 14000);
  check(heard, `${name}: what is said is written on the page ("${(await page.locator(ed).first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 90)}")`);
  check(/cours/i.test(await page.locator(`${H} .nt-title`).inputValue().catch(() => '')), `${name}: the new page is named after what is listened to (a class)`);
  // Pause, Resume
  await rec.locator('button').first().click();
  check(await until(page, sel => document.querySelector(sel)?.classList.contains('paused'), `${H} .nt-rec`, 3000), `${name}: Pause pauses (grey light)`);
  await rec.locator('button').first().click();
  check(await until(page, sel => !document.querySelector(sel)?.classList.contains('paused'), `${H} .nt-rec`, 3000), `${name}: Resume listens again`);
  await page.waitForTimeout(400);
  // Stop: summary, key points and to-dos above the full text.
  await rec.locator('button.stop').click();
  const done = await until(page, sel => { const t = document.querySelector(sel)?.innerText ?? ''; return /Résumé/.test(t) && /Points clés/.test(t) && /À faire/.test(t); }, ed, 6000);
  check(done, `${name}: Stop writes Summary, Key points and To do`);
  if (process.env.DBG) console.log(await page.locator(ed).first().innerText());
  const html = await page.locator(ed).first().innerHTML().catch(() => '');
  check(/data-type="taskList"[\s\S]*maquette/i.test(html), `${name}: the to-do "envoyer la maquette" is a check list item`);
  check(/Texte complet/.test(html) && html.indexOf('Résumé') < html.indexOf('Texte complet'), `${name}: the full text stays below the summary`);
  check(await page.locator(`${H} .nt-rec`).count() === 0, `${name}: the red light goes off`);
  const card = page.locator(`${H} .nt-listen-done`);
  check(await card.isVisible().catch(() => false) && await onScreen(card.locator('button').first(), viewport), `${name}: the "notes are ready" card shows its buttons`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: no sideways scrolling`);
  // To-dos to In 1 Plan
  await card.locator('button').nth(2).click({ timeout: 4000 }).catch(() => {});
  check(await until(page, sel => /maquette/i.test(document.querySelector(sel)?.innerText ?? ''), H, 12000), `${name}: the to-dos open in In 1 Plan`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
