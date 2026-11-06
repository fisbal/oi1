// Confidential mode, like a health worker would use it (a health user asked if patient notes are safe), on phone,
// tablet (both ways), PC and Mac: turn it on with a PIN, get the recovery code, write a note in In 1 Letter,
// and check that the note never leaves the page (no request carries it, online grammar is not called, a send is
// blocked and shown), that nothing is stored in clear (IndexedDB, localStorage), that 🔒 locks and closes the
// apps, a wrong PIN is refused, the right one brings the note back, a reload asks the PIN again, the journal
// shows what happened, auto-lock works after the quiet time, and turning the mode off gives everything back.
// Run after `npm run build`:  node scripts/check-confidential.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4233;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const SECRET = 'PATIENTSECRET';
const NOTE = `Note évolutive ${SECRET} Tremblay : patient stable, douleur 2 sur 10.`;
const PIN = '482917';

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => { (ok ? passed : problems).push(what); if (process.env.VERBOSE) console.log(ok ? 'ok  ' : 'FAIL', what); };
const fits = (b, v) => !!b && b.x >= -1 && b.y >= -1 && b.x + b.width <= v.width + 1 && b.y + b.height <= v.height + 1;

const DEVICES = [
  ['Phone', { width: 390, height: 844 }, true],
  ['Phone sideways', { width: 844, height: 390 }, true],
  ['Tablet', { width: 820, height: 1180 }, true],
  ['Tablet sideways', { width: 1180, height: 820 }, true],
  ['PC', { width: 1280, height: 800 }, false],
  ['Mac', { width: 1440, height: 900 }, false],
];

/** Everything stored on the page, as text (IndexedDB values with their bytes, and localStorage). */
const storedText = page => page.evaluate(async () => {
  const dump = v => {
    if (v instanceof ArrayBuffer) return new TextDecoder().decode(v);
    if (ArrayBuffer.isView(v)) return new TextDecoder().decode(v);
    if (v instanceof Blob) return '[blob]';
    if (v && typeof v === 'object') return Object.entries(v).map(([k, x]) => `${k}:${dump(x)}`).join('|');
    return String(v);
  };
  const db = await new Promise((res, rej) => { const r = indexedDB.open('oi1'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  let out = '';
  for (const s of ['kv', 'recent']) {
    if (!db.objectStoreNames.contains(s)) continue;
    const all = await new Promise(res => { const r = db.transaction(s).objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => res([]); });
    const keys = await new Promise(res => { const r = db.transaction(s).objectStore(s).getAllKeys(); r.onsuccess = () => res(r.result); r.onerror = () => res([]); });
    out += keys.join(',') + all.map(dump).join('\n');
  }
  db.close();
  return out + JSON.stringify({ ...localStorage });
});

async function unlockWith(page, pin) {
  await page.locator('[data-testid=cf-pin]').fill(pin);
  await page.locator('[data-testid=cf-unlock]').click();
}

for (const [name, viewport, mobile] of DEVICES.filter(d => !process.env.ONLY || d[0] === process.env.ONLY)) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const leaks = [];
  let grammarCalls = 0;
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  page.on('request', r => {
    const u = r.url();
    if (/languagetool/.test(u)) grammarCalls++;
    if (u.includes(SECRET) || (r.postData() ?? '').includes(SECRET)) leaks.push(u);
  });
  if (name === 'PC') await page.clock.install();
  await page.goto(url);
  await page.waitForTimeout(800);

  // 1. Turn it on.
  const home = page.locator('[data-testid=cf-home]');
  check(await home.isVisible(), `${name}: the home screen has the "Mode confidentiel" button`);
  await home.click();
  const panel = page.locator('dialog.cf-panel[open]');
  await panel.waitFor({ timeout: 5000 }).catch(() => {});
  check(fits(await panel.boundingBox(), viewport), `${name}: the confidential panel fits the screen`);
  check(/Rien de ce que vous écrivez ne quitte/.test(await panel.innerText().catch(() => '')), `${name}: the panel explains the mode in French`);
  check(await page.locator('[data-testid=cf-delay] option').count() >= 20, `${name}: the lock delay list has 20 choices or more`);
  await page.locator('#cf-set1').fill('123456');
  await page.locator('#cf-set2').fill('123456');
  await page.locator('[data-testid=cf-turn-on]').click();
  check(/Trop facile/.test(await panel.innerText()), `${name}: an easy PIN (123456) is refused`);
  await page.locator('#cf-set1').fill(PIN);
  await page.locator('#cf-set2').fill(PIN);
  await page.locator('[data-testid=cf-turn-on]').click();
  const codeEl = page.locator('[data-testid=cf-code]');
  await codeEl.waitFor({ timeout: 15000 }).catch(() => {});
  const code = (await codeEl.innerText().catch(() => '')).trim();
  check(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){5}$/.test(code), `${name}: a recovery code is shown once (${code})`);
  const cut = await panel.evaluate(d => [...d.querySelectorAll('p, h2, h3, button, li, label')].filter(e => e.scrollWidth > e.clientWidth + 1).length).catch(() => -1);
  check(cut === 0, `${name}: no text is cut in the panel (${cut})`);
  await page.locator('[data-testid=cf-code-done]').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 2. A note in Letter.
  await page.locator('.hero-actions .gold-pill').first().click();
  const body = page.locator('.app-frame:not([hidden]) .ProseMirror.body-text');
  await body.waitFor({ timeout: 15000 });
  await body.click();
  await page.keyboard.type(NOTE, { delay: 5 });
  await page.waitForTimeout(2500); // autosave + grammar would run here
  check(await page.locator('.app-frame:not([hidden]) [data-testid=cf-badge]').isVisible(), `${name}: the 🔒 badge shows in the app bar`);
  const bb = await page.locator('.app-frame:not([hidden]) [data-testid=cf-badge]').boundingBox();
  check(!!bb && bb.x + bb.width <= viewport.width - 4, `${name}: the 🔒 badge is whole, not cut at the screen edge (${bb ? Math.round(bb.x + bb.width) : '?'} / ${viewport.width})`);
  check(grammarCalls === 0, `${name}: online grammar is never called (${grammarCalls})`);
  const stored = await storedText(page);
  check(!stored.includes(SECRET) && !stored.includes('Tremblay'), `${name}: nothing of the note is stored in clear (IndexedDB, localStorage)`);
  check(/__oi1enc/.test(stored), `${name}: the autosave is stored encrypted`);

  // 3. A send is stopped and shown.
  const sent = await page.evaluate(() => fetch('https://api.languagetool.org/v2/check', { method: 'POST', body: 'text=x' }).then(() => 'sent', e => String(e.message)));
  check(/Confidential/.test(sent), `${name}: a send to the internet is blocked (${sent})`);
  check(await page.locator('[data-testid=cf-blocked]').isVisible().catch(() => false), `${name}: a note says the send was blocked`);

  // 4. Lock, wrong PIN, right PIN.
  await page.locator('.app-frame:not([hidden]) [data-testid=cf-badge]').click();
  const lockScreen = page.locator('.cf-lock');
  await lockScreen.waitFor({ timeout: 5000 }).catch(() => {});
  check(await lockScreen.isVisible(), `${name}: 🔒 locks at once`);
  check(fits(await page.locator('.cf-lock-card').boundingBox(), viewport), `${name}: the lock screen fits`);
  check(await page.locator('.ProseMirror').count() === 0, `${name}: while locked no app is open (nothing to read behind)`);
  await unlockWith(page, '999999');
  await page.waitForTimeout(1500);
  check(/NIP incorrect/.test(await page.locator('.cf-lock').innerText().catch(() => '')), `${name}: a wrong PIN is refused`);
  await unlockWith(page, PIN);
  await body.waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForFunction(s => (document.querySelector('.app-frame:not([hidden]) .ProseMirror.body-text')?.textContent ?? '').includes(s), SECRET, { timeout: 10000 }).catch(() => {});
  check((await body.innerText().catch(() => '')).includes(SECRET), `${name}: the right PIN brings the note back`);

  // 5. A reload asks the PIN again; the recovery code also opens it and asks for a new PIN.
  await page.reload();
  await page.waitForTimeout(800);
  check(await page.locator('.cf-lock').isVisible(), `${name}: after a reload the PIN is asked again`);
  await page.locator('.cf-link').click();
  await page.locator('#cf-code').fill(code.toLowerCase());
  await page.locator('.cf-lock .cf-primary').click();
  await page.locator('#cf-new1').fill('7305918');
  await page.locator('#cf-new2').fill('7305918');
  await page.locator('.cf-lock .cf-primary').click();
  await page.waitForFunction(s => (document.querySelector('.app-frame:not([hidden]) .ProseMirror.body-text')?.textContent ?? '').includes(s), SECRET, { timeout: 15000 }).catch(() => {});
  check((await body.innerText().catch(() => '')).includes(SECRET), `${name}: the recovery code opens it, with a new PIN, and the note is there`);

  // 6. The journal (from the home screen: the Office In 1 name in the top bar).
  await page.locator('header .brand').first().click();
  await page.waitForTimeout(500);
  if (await home.isVisible().catch(() => false)) {
    await home.click();
    await page.locator('[data-testid=cf-tab-journal]').click();
    const j = page.locator('[data-testid=cf-journal]');
    await j.waitFor({ timeout: 5000 }).catch(() => {});
    const jt = await j.innerText().catch(() => '');
    check(/Déverrouillé avec la clé de secours/.test(jt) && /NIP ou clé incorrect/.test(jt) && /Envoi bloqué/.test(jt) && /Verrouillé/.test(jt), `${name}: the journal shows unlocks, the wrong PIN, the lock and the blocked send`);
    check(fits(await panel.boundingBox(), viewport), `${name}: the journal fits the screen`);
    await page.keyboard.press('Escape');
  } else problems.push(`${name}: could not get back to the home screen to open the journal`);

  // 7. Auto-lock after the quiet time (PC, with a fake clock).
  if (name === 'PC') {
    await page.locator('header .brand').first().click().catch(() => {});
    await page.clock.fastForward('06:00');
    await page.waitForTimeout(500);
    check(await page.locator('.cf-lock').isVisible(), `${name}: it locks by itself after 5 quiet minutes`);
    await unlockWith(page, '7305918');
    await page.waitForTimeout(800);
    await page.locator('header .brand').first().click().catch(() => {});
  }

  // 8. Turn it off (PC): everything comes back in clear, no PIN asked.
  if (name === 'PC' || name === 'Phone') {
    await page.locator('header .brand').first().click().catch(() => {});
    if (await home.isVisible().catch(() => false)) {
      await home.click();
      await page.locator('[data-testid=cf-tab-set]').click();
      await page.locator('#cf-off').fill('7305918');
      await page.locator('[data-testid=cf-turn-off]').click();
      await page.waitForTimeout(2500);
      await page.reload();
      await page.waitForTimeout(1000);
      check(!(await page.locator('.cf-lock').isVisible()), `${name}: once turned off, no PIN is asked`);
      const text = await storedText(page);
      check(text.includes(SECRET) && !/__oi1enc/.test(text), `${name}: once turned off, the note is still there, decrypted`);
      check(/Tremblay|Lettre|Document/.test(await page.locator('nav.tabs').innerText().catch(() => '')), `${name}: once turned off, the tabs come back`);
    }
  }

  check(leaks.length === 0, `${name}: no request ever carried the note (${leaks.slice(0, 3).join(', ')})`);
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* gone */ }
for (const p of passed) console.log(`ok   ${p}`);
for (const p of problems) console.log(`FAIL ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} failed`);
process.exit(problems.length ? 1 : 0);
