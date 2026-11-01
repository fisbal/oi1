// Checks dictation (the 🎤 button) like a person would, on a phone and a PC (rule 16), in In 1 Letter, Notes and
// Assistant:
//  1. A browser whose speech service works: the words land in the document, with spoken punctuation.
//  2. The Windows app (Tauri / WebView2), where Web Speech starts but never returns a word (the bug a user hit):
//     dictation goes straight to the device engine. The microphone is Chrome's fake microphone playing a recording
//     (tone, silence, tone…) and the transcriber is a stand-in, so CI never downloads the Whisper model.
//  3. A browser whose speech service hears speech but sends no words: after a few seconds it switches to the device.
//  4. Microphone blocked: a clear message says how to allow it, the button turns off.
//  5. French: "virgule" and "point" become marks, French spacing.
// Run after `npm run build`:
//   node scripts/check-dictation.mjs

import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4216;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}

// A recording for the fake microphone: 1.2 s of a voice-like tone, 1.2 s of silence, looped by Chrome.
const wav = (() => {
  const rate = 16000, secs = 2.4, n = Math.round(rate * secs);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const v = t < 1.2 ? 0.35 * Math.sin(2 * Math.PI * 220 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t)) : 0;
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  const p = join(mkdtempSync(join(tmpdir(), 'oi1-mic-')), 'voice.wav');
  writeFileSync(p, b);
  return p;
})();

const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required'],
});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

const DEVICES = [
  { name: 'PC', viewport: { width: 1366, height: 768 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];

// Stand-ins for the browser's speech recogniser.
const WORKING_WEB = `(() => {
  class SR { constructor() { this.lang = ''; } start() {
      setTimeout(() => { this.onstart?.(); this.onaudiostart?.(); this.onspeechstart?.(); }, 50);
      setTimeout(() => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: window.__said || 'hello comma world full stop' }], { isFinal: true })] }), 400);
    } stop() { setTimeout(() => this.onend?.(), 20); } abort() { this.stop(); } }
  window.SpeechRecognition = SR; window.webkitSpeechRecognition = SR;
})();`;
const SHELL_WEB = `(() => {
  class SR { start() { setTimeout(() => { this.onstart?.(); this.onaudiostart?.(); this.onspeechstart?.(); }, 50); }
    stop() { setTimeout(() => this.onend?.(), 20); } abort() { this.stop(); } }
  window.SpeechRecognition = SR; window.webkitSpeechRecognition = SR;
})();`;
const FAKE_ASR = `window.__oi1FakeAsr = (audio, lang) => { (window.__asrCalls ||= []).push({ n: audio.length, lang }); return lang.startsWith('fr') ? 'bonjour virgule le monde point' : 'hello comma device world full stop'; };`;
const TAURI = `window.__TAURI_INTERNALS__ = {};`;
const DENY = `navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError'));`;

async function newPage(d, lang, scripts) {
  const ctx = await browser.newContext({ viewport: d.viewport, isMobile: !!d.mobile, hasTouch: !!d.mobile, locale: lang === 'fr' ? 'fr-FR' : 'en-US', permissions: ['microphone'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${d.name}: script error: ${e.message}`));
  page.on('dialog', x => x.dismiss());
  await page.addInitScript(`try { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', ${JSON.stringify(lang)}); sessionStorage.setItem('set', '1'); } } catch {}\n${scripts.join('\n')}`);
  return { ctx, page };
}
const H = '.module-host:not([hidden])';
async function openApp(page, app, ready) {
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.locator(`.slab:has-text("In 1 ${app}")`).first().click();
  await page.locator(`${H} ${ready}`).first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
}
/** A ribbon button; on a phone the ribbon is folded, so its tab is tapped first. */
async function ribbon(page, key, tab) {
  const sel = `${H} [data-help="${key}"]:visible`;
  if (!(await page.locator(sel).count())) await page.locator(`${H} .ribbon-tabs button:text-is("${tab}")`).first().click();
  await page.locator(sel).first().click();
}
const until = async (page, fn, arg, ms = 8000) => {
  try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; }
};
const letterText = page => page.locator(`${H} .body-text`).innerText();

async function letterRun(d, lang, scripts, label, expect, extra) {
  const { ctx, page } = await newPage(d, lang, scripts);
  try {
    await openApp(page, 'Letter', '.body-text');
    await page.locator(`${H} .body-text`).click();
    await page.keyboard.type(lang === 'fr' ? 'Note' : 'Start');
    await ribbon(page, 'letter.dictate', lang === 'fr' ? 'Accueil' : 'Home');
    const ok = await until(page, ([sel, want]) => (document.querySelector(sel)?.textContent ?? '').includes(want), [`${H} .body-text`, expect], 12000);
    const text = await letterText(page);
    check(ok, `${d.name} ${label}: the spoken words are typed in the letter ("${text.slice(0, 80).replace(/\n/g, '⏎')}")`);
    if (extra) await extra(page, text);
    // Stop: the button turns off and the "listening" status goes away.
    await ribbon(page, 'letter.dictateStop', lang === 'fr' ? 'Accueil' : 'Home');
    const off = await until(page, sel => !document.querySelector(sel), `${H} .status-live[data-dictation]`, 6000);
    check(off, `${d.name} ${label}: pressing the button again stops dictation`);
  } finally { await ctx.close(); }
}

try {
  for (const d of DEVICES.filter(x => !process.env.ONLY || x.name.includes(process.env.ONLY))) {
    // 1. Working browser speech service
    await letterRun(d, 'en', [WORKING_WEB], 'browser speech', 'Start hello, world.');

    // 2. The Windows app: device engine, fake mic + stand-in transcriber
    await letterRun(d, 'en', [SHELL_WEB, TAURI, FAKE_ASR], 'Windows app (device engine)', 'hello, device world.', async page => {
      const calls = await page.evaluate(() => window.__asrCalls ?? []);
      check(calls.length > 0 && calls.every(c => c.n >= 16000 * 0.4 && c.n <= 16000 * 13), `${d.name} Windows app: the microphone is cut into spoken pieces of 0.4–13 s at 16 kHz (${calls.map(c => (c.n / 16000).toFixed(1)).join(', ')} s)`);
      check(calls.every(c => c.lang.startsWith('en')), `${d.name} Windows app: the transcriber gets the document language`);
    });

    // 5. French punctuation, device engine
    await letterRun(d, 'fr', [TAURI, FAKE_ASR], 'French', 'bonjour, le monde.', async (page, text) => {
      check(/Note bonjour, le monde\./i.test(text), `${d.name} French: a space is added after the typed word and "virgule"/"point" become marks`);
    });

    // 4. Microphone blocked
    {
      const { ctx, page } = await newPage(d, 'en', [TAURI, DENY]);
      try {
        await openApp(page, 'Letter', '.body-text');
        await page.locator(`${H} .body-text`).click();
        await ribbon(page, 'letter.dictate', 'Home');
        const shown = await until(page, () => /microphone is blocked/i.test(document.body.innerText), undefined, 5000);
        check(shown, `${d.name} mic blocked: a clear message says the microphone is blocked and how to allow it`);
        await page.waitForTimeout(300);
        const btnOff = await page.locator(`${H} [data-help="letter.dictateStop"]`).count();
        check(btnOff === 0, `${d.name} mic blocked: the dictation button is not left on`);
        const box = await page.locator(`${H} .status-live.error`).boundingBox();
        check(!box || box.x >= 0 && box.x + box.width <= d.viewport.width + 1, `${d.name} mic blocked: the message fits the screen`);
      } finally { await ctx.close(); }
    }

    // Notes, device engine
    {
      const { ctx, page } = await newPage(d, 'en', [TAURI, FAKE_ASR]);
      try {
        await openApp(page, 'Notes', '.nt-text');
        await page.locator(`${H} .nt-text`).click();
        await ribbon(page, 'notes.dictate', 'AI');
        const ok = await until(page, sel => /hello, device world\./i.test(document.querySelector(sel)?.textContent ?? ''), `${H} .nt-text`, 12000);
        check(ok, `${d.name} Notes: the spoken words are typed in the note`);
        await ribbon(page, 'notes.stopDictation', 'AI');
      } finally { await ctx.close(); }
    }

    // Assistant, working browser speech
    {
      const { ctx, page } = await newPage(d, 'en', [WORKING_WEB, 'window.__said = "make a budget for March"']);
      try {
        await openApp(page, 'Assistant', '.as-input');
        await page.locator(`${H} .as-input`).fill('Please');
        await page.locator(`${H} .as-tool:has(span:text("🎤"))`).click();
        const ok = await until(page, sel => document.querySelector(sel)?.value === 'Please make a budget for March', `${H} .as-input`, 8000);
        check(ok, `${d.name} Assistant: the spoken request is added to the box ("${await page.locator(`${H} .as-input`).inputValue()}")`);
      } finally { await ctx.close(); }
    }
  }

  // 3. Speech service that hears but never sends words: switches to the device after a few seconds (PC only).
  await letterRun(DEVICES[0], 'en', [SHELL_WEB, FAKE_ASR], 'silent speech service', 'hello, device world.');
  // 6. The real thing (CI): a spoken French sentence (espeak-ng recording) through the real Whisper model on the
  //    device, as in the Windows app. Shows the one-time download %, then the words.
  if (process.env.SPEECH_WAV) {
    const real = await chromium.launch({
      ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${process.env.SPEECH_WAV}`],
    });
    const ctx = await real.newContext({ viewport: { width: 1366, height: 768 }, locale: 'fr-FR', permissions: ['microphone'] });
    const page = await ctx.newPage();
    page.on('pageerror', e => problems.push(`real Whisper: script error: ${e.message}`));
    await page.addInitScript(`try { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'fr'); sessionStorage.setItem('set', '1'); } } catch {}\n${TAURI}\nwindow.__seen = []; new MutationObserver(() => { const k = document.querySelector('.status-live[data-dictation]')?.getAttribute('data-dictation'); if (k && window.__seen.at(-1) !== k) window.__seen.push(k); }).observe(document, { subtree: true, childList: true, attributes: true });`);
    try {
      await openApp(page, 'Letter', '.body-text');
      await page.locator(`${H} .body-text`).click();
      await ribbon(page, 'letter.dictate', 'Accueil');
      const t0 = Date.now();
      const ok = await until(page, sel => /bonjour|monde/i.test(document.querySelector(sel)?.textContent ?? ''), `${H} .body-text`, 240000);
      const seen = await page.evaluate(() => window.__seen);
      check(ok, `real Whisper: a spoken French sentence is typed in the letter in ${Math.round((Date.now() - t0) / 1000)} s ("${(await letterText(page)).slice(0, 90).replace(/\n/g, '⏎')}")`);
      check(seen.includes('loading'), `real Whisper: the one-time model download shows its % (${seen.join(' → ')})`);
    } finally { await real.close(); }
  }
} catch (e) {
  problems.push(`crashed: ${e.stack ?? e}`);
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* gone */ }
}

console.log(`dictation: ${passed.length} passed`);
for (const p of passed) console.log(`  ✓ ${p}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
