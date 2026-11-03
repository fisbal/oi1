// "In 1", the voice of Office In 1 (Martin, 2026-11-03): the 🎙️ In 1 button in the top bar, used like a person would on
// PC, phone and phone sideways. A pretend speech service says one phrase per listening: "In 1 ouvre Class" opens
// In 1 Class, "In 1 nouvelle lettre" opens a letter, "In 1 dicte" starts dictation there, "In 1 annule" undoes, and a
// free request goes to In 1 Assistant. The button is always on screen.
// Run after `npm run build`:
//   node scripts/check-voice.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4220;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
// Each start() of the speech service hears the next phrase of window.__queue.
const QUEUE_WEB = `(() => {
  class SR { start() { setTimeout(() => { this.onstart?.(); this.onaudiostart?.(); }, 30);
      const words = (window.__queue || []).shift(); if (!words) return;
      setTimeout(() => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: words }], { isFinal: false })] }), 250);
      setTimeout(() => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: words }], { isFinal: true })] }), 550); }
    stop() { setTimeout(() => this.onend?.(), 20); } abort() { this.stop(); } }
  window.SpeechRecognition = SR; window.webkitSpeechRecognition = SR;
})();`;
const H = '.app-frame:not([hidden])';
const until = async (page, fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };

for (const [name, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Small PC', { width: 1000, height: 700 }, false], ['Phone', { width: 390, height: 844 }, true], ['Phone sideways', { width: 844, height: 390 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR', isMobile: mobile, hasTouch: mobile, permissions: ['microphone'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.addInitScript(`try { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'fr'); sessionStorage.setItem('set', '1'); } } catch {}
window.__queue = ['In 1 ouvre Class', 'in one nouvelle lettre', 'In 1, dicte', 'bonjour à tous', 'In un annule', 'In 1 fais-moi un budget pour mars'];
${QUEUE_WEB}`);
  await page.goto(url);
  const btn = page.locator('.in1-voice-btn');
  await btn.waitFor({ timeout: 10000 });
  const box = await btn.boundingBox();
  check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.width >= 30, `${name}: the 🎙️ In 1 button is on screen`);

  await btn.click();
  check(await until(page, sel => !!document.querySelector(sel)?.offsetParent, `${H} .cells-area`, 10000), `${name}: "In 1 ouvre Class" opens In 1 Class`);
  await page.waitForTimeout(600);
  await btn.click();
  check(await until(page, sel => !!document.querySelector(sel)?.offsetParent, `${H} .body-area .ProseMirror`, 10000), `${name}: "in one nouvelle lettre" opens a new letter`);
  await page.waitForTimeout(600);
  await page.locator(`${H} .body-area .ProseMirror`).first().click();
  await btn.click();
  const typed = await until(page, sel => /Bonjour à tous/.test(document.querySelector(sel)?.innerText ?? ''), `${H} .body-area .ProseMirror`, 12000);
  check(typed, `${name}: "In 1, dicte" starts dictation in the letter and the words are typed ("${(await page.locator(`${H} .body-area .ProseMirror`).first().innerText()).slice(0, 60)}")`);
  // stop the letter's dictation
  await page.locator(`${H} [data-help="letter.dictate"]:visible, ${H} [data-help="letter.dictateStop"]:visible`).first().click().catch(() => {});
  await page.waitForTimeout(2200);
  await btn.click();
  const undone = await until(page, sel => !/Bonjour à tous/.test(document.querySelector(sel)?.innerText ?? ''), `${H} .body-area .ProseMirror`, 8000);
  check(undone, `${name}: "In un annule" undoes the dictated words ("${(await page.locator(`${H} .body-area .ProseMirror`).first().innerText()).slice(0, 60)}")`);
  await page.waitForTimeout(600);
  await btn.click();
  const asked = await until(page, sel => /budget pour mars/.test(document.querySelector(sel)?.value ?? ''), `${H} .as-input`, 12000);
  check(asked, `${name}: a free request goes to In 1 Assistant`);
  // With the tab bar full (Martin's screen: 5 tabs), the button keeps its size and "In 1" stays on one line.
  for (const words of ['In 1 ouvre Notes', 'In 1 ouvre Plan', 'In 1 nouvelle lettre', 'In 1 ouvre Draw', 'In 1 ouvre Class']) {
    await page.evaluate(w => window.__queue.push(w), words);
    await page.waitForTimeout(700); await btn.click(); await page.waitForTimeout(1800);
  }
  const shape = await page.evaluate(() => {
    const b = document.querySelector('.in1-voice-btn'), n = document.querySelector('.in1-voice-name');
    const r = b.getBoundingClientRect();
    return { h: Math.round(r.height), w: Math.round(r.width), lines: n && n.offsetParent ? n.getClientRects().length : 1, nameH: n && n.offsetParent ? Math.round(n.getBoundingClientRect().height) : 0, tabs: document.querySelectorAll('div.tab[data-app]').length };
  });
  check(shape.h <= 36 && shape.lines === 1 && shape.nameH <= 20 && shape.w >= 30, `${name}: with ${shape.tabs} tabs open the 🎙️ In 1 button keeps its shape (${shape.w}x${shape.h}, name ${shape.nameH}px high)`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
