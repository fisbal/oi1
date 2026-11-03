// "In 1" answers to its name (voice part 3, Martin 2026-11-03: "après avoir activé l'écoute une fois, lumière allumée").
// Used like a person would on PC, Mac, tablet and phone, both ways (rule 16):
//  - the 👂 button sits next to the 🎙️ In 1 button, both fully on screen;
//  - turned on, a green light shows on the 🎙️ button; talk without the name does nothing;
//  - "In 1, ouvre Class" opens In 1 Class; "In 1" alone, then "nouvelle lettre", opens a letter;
//  - a tap on 🎙️ pauses the name listening (one microphone user), it comes back after;
//  - the choice is kept after a restart, and turning it off puts the light out.
// The microphone is Chrome's fake one (tone, silence, looped) and the transcriber a stand-in, so CI never downloads
// the Whisper model. Run after `npm run build`:
//   node scripts/check-wake.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4229;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

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
  const p = join(mkdtempSync(join(tmpdir(), 'oi1-wake-')), 'voice.wav');
  writeFileSync(p, b);
  return p;
})();

const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required'],
});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
// Each phrase the fake microphone plays is "heard" as the next words of window.__said ('' when none are left).
const FAKE = `try { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', 'fr'); localStorage.setItem('oi1.tips', 'off'); sessionStorage.setItem('set', '1'); } } catch {}
window.__said = []; window.__heard = 0;
window.__oi1FakeAsr = () => { window.__heard++; return window.__said.shift() || ''; };`;
const H = '.app-frame:not([hidden])';
const until = async (page, fn, arg, ms = 10000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };
const shown = sel => !!document.querySelector(sel)?.offsetParent;
const tabs = () => document.querySelectorAll('div.tab[data-app]').length;
const light = () => !!document.querySelector('.in1-voice-light');
const noLight = () => !document.querySelector('.in1-voice-light');

const SCREENS = [
  ['PC', { width: 1366, height: 768 }, false],
  ['Mac', { width: 1440, height: 900 }, false],
  ['Tablet', { width: 820, height: 1180 }, true],
  ['Tablet sideways', { width: 1180, height: 820 }, true],
  ['Phone', { width: 390, height: 844 }, true],
  ['Phone sideways', { width: 844, height: 390 }, true],
];
for (const [name, viewport, mobile] of SCREENS) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR', isMobile: mobile, hasTouch: mobile, permissions: ['microphone'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.addInitScript(FAKE);
  await page.goto(url);
  const ear = page.locator('.in1-name-btn');
  const mic = page.locator('.in1-voice-btn');
  await ear.waitFor({ timeout: 10000 });
  const [a, b] = [await mic.boundingBox(), await ear.boundingBox()];
  check(a && b && b.x >= a.x + a.width - 1 && b.x + b.width <= viewport.width && b.y >= 0 && b.width >= 24,
    `${name}: the 👂 button sits next to the 🎙️ In 1 button, fully on screen (${Math.round(b?.x ?? -1)}, ${Math.round(b?.width ?? 0)} px)`);
  check(await ear.getAttribute('aria-pressed') === 'false' && await page.evaluate(noLight), `${name}: nothing listens before the person turns it on`);

  await ear.click();
  check(await ear.getAttribute('aria-pressed') === 'true', `${name}: 👂 turns on`);
  check(await until(page, light), `${name}: the green light shows on the 🎙️ button while In 1 listens for its name`);
  const note = await page.locator('.in1-voice-note').innerText().catch(() => '');
  check(/appareil/.test(note), `${name}: it says the listening stays on the device ("${note.slice(0, 70)}")`);

  // Talk without the name: nothing happens.
  const before = await page.evaluate(tabs);
  await page.evaluate(() => { window.__said.push('Bonjour à tous, on commence la réunion'); });
  await until(page, () => window.__said.length === 0);
  await page.waitForTimeout(800);
  check(await page.evaluate(tabs) === before, `${name}: talk without the name does nothing`);

  await page.evaluate(() => { window.__said.push('In 1, ouvre Class'); });
  check(await until(page, s => !!document.querySelector(s)?.offsetParent, `${H} .cells-area`), `${name}: "In 1, ouvre Class" opens In 1 Class with no tap`);

  await page.evaluate(() => { window.__said.push('In 1'); window.__said.push('nouvelle lettre'); });
  check(await until(page, s => !!document.querySelector(s)?.offsetParent, `${H} .body-area .ProseMirror`, 14000), `${name}: "In 1" alone, then "nouvelle lettre", opens a letter`);

  // A tap on 🎙️ pauses the name listening; it comes back after.
  await page.evaluate(() => { window.__said.length = 0; });
  await mic.click();
  check(await until(page, noLight, undefined, 4000), `${name}: a tap on 🎙️ pauses the name listening (one microphone user)`);
  await mic.click();
  check(await until(page, light, undefined, 8000), `${name}: the name listening comes back after the tap`);

  // Kept after a restart.
  await page.reload();
  await ear.waitFor({ timeout: 10000 });
  check(await ear.getAttribute('aria-pressed') === 'true' && await until(page, light), `${name}: the choice is kept after a restart, light on`);
  await ear.click();
  check(await ear.getAttribute('aria-pressed') === 'false' && await until(page, noLight, undefined, 3000), `${name}: turned off, the light goes out`);
  const heard = await page.evaluate(() => window.__heard);
  await page.waitForTimeout(3000);
  check(await page.evaluate(() => window.__heard) === heard, `${name}: turned off, nothing is heard any more`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
