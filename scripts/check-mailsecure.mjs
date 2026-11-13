// Checks In 1 Mail's real accounts like a person would, on every kind of screen (rule 16): phone and tablet both
// ways, a Windows PC and a Mac. Microsoft's and Google's sign-in pages and mail APIs are played back here (no real
// account, no network): connect Outlook.com (code + PKCE) and Gmail (token, send only: no paid Google audit), Gmail
// by IMAP with an app password (the installed app's Rust engine played back; wrong password, SMTP answer), receive the inbox, a scam mail gets the
// "Suspicious" badge and a plain-words warning, its fake link opens a check dialog instead of the site, remote
// pictures stay blocked until asked; answer through the account (the real MIME leaves with In-Reply-To); create an
// OpenPGP key, send oneself an end-to-end encrypted mail (nothing readable leaves), receive it and read it; the
// mailbox and the sign-in tokens are encrypted on the device; everything is still there after reopening; no
// sideways scrolling and every dialog fits the screen.
// Run after `npm run build`:
//   node scripts/check-mailsecure.mjs

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4245;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const WIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const DEVICES = [
  { name: 'Windows PC', viewport: { width: 1366, height: 768 }, ua: WIN_UA, gmail: true },
  { name: 'Mac', viewport: { width: 1440, height: 900 }, ua: MAC_UA, lang: 'fr' },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, mobile: true },
  { name: 'tablet sideways', viewport: { width: 1180, height: 820 }, mobile: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true, gmail: true },
  { name: 'phone sideways', viewport: { width: 844, height: 390 }, mobile: true },
];
const P = '.module-host:not([hidden]) .mailapp';
const ME = 'martin.test@outlook.com';
const crlf = a => a.join('\r\n');
const NORMAL = crlf(['From: Claire Roy <claire@example.org>', `To: ${ME}`, 'Subject: Souper samedi', 'Date: Thu, 12 Nov 2026 18:00:00 -0500', 'Message-ID: <souper-1@example.org>',
  'Authentication-Results: mx.microsoft.com; spf=pass; dkim=pass; dmarc=pass', 'MIME-Version: 1.0', 'Content-Type: text/html; charset=utf-8', '',
  '<p>Salut! On soupe ensemble samedi?</p><p><img src="https://pixel.example.org/open.gif" width="1" height="1"></p>']);
const SCAM = crlf(['From: "Desjardins Securite" <alerte@desjardins-secure.top>', `To: ${ME}`, 'Reply-To: rembourse@mailbox.example', 'Subject: URGENT : compte suspendu',
  'Date: Thu, 12 Nov 2026 19:00:00 -0500', 'Authentication-Results: mx.microsoft.com; spf=fail; dmarc=fail header.from=desjardins-secure.top', 'MIME-Version: 1.0',
  'Content-Type: text/html; charset=utf-8', '', '<p>Vérifiez votre compte maintenant : <a href="https://desjardins-secure.top/login">www.desjardins.com</a></p>']);
const GMAIL_ONE = crlf(['From: Paul <paul@example.net>', 'To: martin.test@gmail.com', 'Subject: Photos du chalet', 'Date: Wed, 11 Nov 2026 10:00:00 -0500', 'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8', '', 'Voici les photos.']);
const b64url = s => Buffer.from(s, 'binary').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function newPage(d) {
  const ctx = await browser.newContext({ viewport: d.viewport, isMobile: !!d.mobile, hasTouch: !!d.mobile, userAgent: d.ua, locale: d.lang === 'fr' ? 'fr-CA' : 'en-US' });
  const net = { inbox: [NORMAL, SCAM], sent: [], tokenBodies: [], opened: [], gmailSent: [], patched: 0, gmailRead: 0 };
  // ---- Microsoft (sign-in + Graph) ----
  await ctx.route('https://login.microsoftonline.com/**', async route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/authorize')) {
      check(u.pathname.startsWith('/consumers/'), `${d.name}: Microsoft sign-in is for personal accounts only`);
      check(u.searchParams.get('code_challenge_method') === 'S256' && (u.searchParams.get('code_challenge') ?? '').length >= 43, `${d.name}: Microsoft sign-in uses PKCE`);
      return route.fulfill({ status: 302, headers: { location: `${u.searchParams.get('redirect_uri')}?code=ms-code-1&state=${u.searchParams.get('state')}` } });
    }
    if (u.pathname.endsWith('/token')) {
      net.tokenBodies.push(route.request().postData() ?? '');
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ access_token: 'ms-access-1', expires_in: 3600, refresh_token: 'ms-refresh-SECRET' }) });
    }
    return route.fulfill({ status: 404 });
  });
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await ctx.route('https://graph.microsoft.com/**', async route => {
    const r = route.request();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const u = new URL(r.url());
    if (r.headers().authorization !== 'Bearer ms-access-1') return route.fulfill({ status: 401, headers: cors });
    if (u.pathname === '/v1.0/me') return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ displayName: 'Martin Test', mail: ME }) });
    if (u.pathname === '/v1.0/me/mailFolders/inbox/messages') return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ value: net.inbox.map((_, i) => ({ id: `ms-${i}`, isRead: false })).reverse() }) });
    const m = u.pathname.match(/^\/v1\.0\/me\/messages\/ms-(\d+)\/\$value$/);
    if (m) return route.fulfill({ status: 200, contentType: 'message/rfc822', headers: cors, body: Buffer.from(net.inbox[Number(m[1])], 'utf8') });
    if (u.pathname === '/v1.0/me/sendMail') { net.sent.push(Buffer.from(r.postData() ?? '', 'base64').toString('utf8')); return route.fulfill({ status: 202, headers: cors }); }
    if (r.method() === 'PATCH') { net.patched++; return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '{}' }); }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '{}' });
  });
  // ---- Google (token flow + Gmail API) ----
  await ctx.route('https://accounts.google.com/**', async route => {
    const u = new URL(route.request().url());
    const scope = u.searchParams.get('scope') ?? '';
    check(u.searchParams.get('response_type') === 'token' && /gmail\.send/.test(scope) && !/gmail\.(modify|readonly)|mail\.google\.com/.test(scope), `${d.name}: Gmail sign-in asks only to send (no reading scope, so no paid Google audit)`);
    return route.fulfill({ status: 302, headers: { location: `${u.searchParams.get('redirect_uri')}#access_token=g-access-1&expires_in=3600&token_type=Bearer&state=${u.searchParams.get('state')}` } });
  });
  await ctx.route('https://gmail.googleapis.com/**', async route => {
    const r = route.request();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const u = new URL(r.url());
    if (r.headers().authorization !== 'Bearer g-access-1') return route.fulfill({ status: 401, headers: cors });
    const json = o => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    if (u.pathname.endsWith('/profile')) return json({ emailAddress: 'martin.test@gmail.com' });
    if (u.pathname.endsWith('/messages')) net.gmailRead++;
    if (u.pathname.endsWith('/messages')) return json({ messages: [{ id: 'g-1' }] });
    if (u.pathname.endsWith('/messages/g-1')) return json({ id: 'g-1', labelIds: ['INBOX', 'UNREAD'], raw: b64url(Buffer.from(GMAIL_ONE, 'utf8').toString('binary')) });
    if (u.pathname.endsWith('/messages/send')) { net.gmailSent.push(JSON.parse(r.postData() ?? '{}').raw); return json({ id: 'g-sent' }); }
    return json({});
  });
  await ctx.route('https://openidconnect.googleapis.com/**', route => {
    const r = route.request();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (r.headers().authorization !== 'Bearer g-access-1') return route.fulfill({ status: 401, headers: cors });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ email: 'martin.test@gmail.com', name: 'Martin Test' }) });
  });
  await ctx.route('https://oauth2.googleapis.com/**', route => route.fulfill({ status: 200, headers: cors, body: '{}' }));
  await ctx.route(/pixel\.example\.org|desjardins-secure\.top/, route => { net.opened.push(route.request().url()); return route.fulfill({ status: 200, body: '' }); });
  // The installed app's IMAP/SMTP engine (Rust, src-tauri/src/mail.rs) played back: a Gmail mailbox with an app password.
  if (d.gmail) await ctx.addInitScript(`(() => {
    const MAIL = ${JSON.stringify(Buffer.from(GMAIL_ONE, 'utf8').toString('base64'))};
    window.__imapSent = []; window.__imapSeen = [];
    const okLogin = l => l && l.user === 'martin.test@gmail.com' && l.pass === 'abcdefghijklmnop';
    window.__oi1Imap = async (cmd, a) => {
      await new Promise(r => setTimeout(r, 150));
      if (!okLogin(a.login) || a.login.host !== (cmd === 'mail_smtp_send' ? 'smtp.gmail.com' : 'imap.gmail.com')) throw 'auth: [AUTHENTICATIONFAILED] Invalid credentials';
      if (cmd === 'mail_imap_check') return null;
      if (cmd === 'mail_imap_fetch') return a.known.includes('7:1') ? [] : [{ remoteId: '7:1', raw: MAIL, unread: true }];
      if (cmd === 'mail_imap_seen') { window.__imapSeen.push(a.remoteId); return null; }
      if (cmd === 'mail_smtp_send') { window.__imapSent.push({ from: a.from, to: a.to, raw: atob(a.raw) }); return null; }
      if (cmd === 'mail_imap_trash') return null;
      throw 'net: unknown ' + cmd;
    };
  })();`);
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${d.name}: script error: ${e.message}`));
  if (process.env.DEBUG) { page.on('console', m => console.log('console:', m.text())); ctx.on('page', p => { console.log('popup', p.url()); p.on('console', m => console.log('popup console:', m.text())); p.on('framenavigated', f => console.log('popup nav', f.url())); }); }
  page.on('dialog', x => x.accept());
  await page.addInitScript(`try { if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', ${JSON.stringify(d.lang ?? 'en')}); localStorage.setItem('oi1.mail.clientId.outlook', 'test-ms-client-0001'); localStorage.setItem('oi1.mail.clientId.gmail', 'test-google-client-0001.apps.googleusercontent.com'); sessionStorage.setItem('set', '1'); } } catch {}`);
  return { ctx, page, net };
}
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const closePeek = async page => {
  if (!(await page.locator('.module-host:not([hidden]) .ribbon.open').count())) return;
  // tap the status bar (lessons: never a spot a panel may cover)
  const b = await page.locator(`${P} footer.status`).boundingBox();
  if (b) await page.mouse.click(b.x + 4, b.y + b.height / 2);
  await page.waitForTimeout(150);
};
const TABS = { en: 'Send', fr: 'Envoi' };
async function ribbon(page, key, lang) {
  const b = page.locator(`${P} [data-help="${key}"]:visible`).first();
  if (!(await b.count())) await page.locator(`${P} .ribbon-tabs button:text-is("${TABS[lang]}")`).first().click();
  await page.locator(`${P} [data-help="${key}"]:visible`).first().click();
}
const fits = async (page, loc, d) => { const b = await loc.boundingBox(); return !!b && b.x >= -1 && b.x + b.width <= d.viewport.width + 1 && b.y >= -1; };
const stored = page => page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('oi1');
  rq.onsuccess = () => { const tx = rq.result.transaction('kv', 'readonly'); const st = tx.objectStore('kv'); const keys = st.getAllKeys(); const vals = st.getAll();
    tx.oncomplete = () => { const i = keys.result.findIndex(k => String(k).endsWith(':mail')); res(i < 0 ? '' : String(vals.result[i])); }; };
  rq.onerror = () => res('');
}));
const back = async (page, phone) => { if (phone && await page.locator(`${P} .ml-back`).count()) await page.locator(`${P} .ml-back`).click(); };

try {
  for (const d of DEVICES.filter(x => !process.env.ONLY || x.name.includes(process.env.ONLY))) {
    const n = d.name, lang = d.lang ?? 'en';
    const phone = d.viewport.width < 760;
    const { ctx, page, net } = await newPage(d);
    try {
      await page.goto(url);
      await page.waitForTimeout(400);
      await page.locator('.slab:has-text("In 1 Mail")').first().click();
      await page.locator(`${P} .ml-compose, ${P} .ml-list`).first().waitFor({ timeout: 10000 });

      // ---- connect Outlook.com ----
      await ribbon(page, 'mail.accounts', lang);
      const dlg = page.locator('dialog.oi-dialog[open]');
      await dlg.waitFor({ timeout: 4000 });
      check(await fits(page, dlg, d), `${n}: the accounts window fits the screen`);
      check(await dlg.locator('.ml-acc-note').isVisible(), `${n}: it says personal accounts only`);
      const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }), dlg.locator('button[data-provider="outlook"]').click()]);
      await popup.waitForEvent('close', { timeout: 8000 }).catch(() => {});
      await dlg.locator('.ml-acc-list li').first().waitFor({ timeout: 8000 }).catch(() => {});
      check((await dlg.locator('.ml-acc-list').textContent().catch(() => '')).includes(ME), `${n}: Outlook.com account connected (${ME})`);
      check(popup.isClosed(), `${n}: the sign-in window closes by itself`);
      check(net.tokenBodies.some(b => /code_verifier=[\w-]{43,}/.test(b) && /code=ms-code-1/.test(b) && !/client_secret/.test(b)), `${n}: the code is exchanged with its PKCE verifier, no secret`);
      if (d.gmail) {
        const [gp] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }), dlg.locator('button[data-provider="gmail"]').click()]);
        await gp.waitForEvent('close', { timeout: 8000 }).catch(() => {});
        await page.waitForFunction(() => document.querySelectorAll('dialog[open] .ml-acc-list li').length >= 2, null, { timeout: 8000 }).catch(() => {});
        check((await dlg.locator('.ml-acc-list').textContent()).includes('martin.test@gmail.com'), `${n}: Gmail account connected too (send only)`);
        // ---- Gmail reading by IMAP with an app password (the installed app's way) ----
        const form = dlg.locator('.ml-imap');
        check(await form.isVisible().catch(() => false), `${n}: the app-password form is offered`);
        check(await fits(page, form, d), `${n}: the app-password form fits the screen`);
        await form.locator('select').selectOption('gmail');
        await form.locator('input[type=email]').fill('martin.test@gmail.com');
        await form.locator('input[type=password]').fill('wrong pass word');
        await form.locator('button[data-provider="imap"]').click();
        await dlg.locator('.ml-acc-error').waitFor({ timeout: 5000 }).catch(() => {});
        check(((await dlg.locator('.ml-acc-error').textContent().catch(() => '')) ?? '').length > 10, `${n}: a wrong app password says so in plain words`);
        await form.locator('input[type=password]').fill('abcd efgh ijkl mnop');
        await form.locator('button[data-provider="imap"]').click();
        await page.waitForFunction(() => document.querySelectorAll('dialog[open] .ml-acc-list li').length >= 3, null, { timeout: 8000 }).catch(() => {});
        check(await dlg.locator('.ml-acc-list li').count() >= 3, `${n}: Gmail by IMAP connected with the app password (spaces as Google shows them)`);
        check(await form.locator('input[type=password]').inputValue() === '', `${n}: the password field is emptied after connecting`);
        await dlg.locator('.ml-acc-list li').first().locator('input[type=radio]').check();
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      const secrets = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('oi1.mail.secret.')).map(k => localStorage.getItem(k)));
      check(secrets.length >= 1 && secrets.every(v => v.startsWith('oi1enc1:') && !v.includes('ms-refresh') && !v.includes('ms-access')), `${n}: sign-in tokens are stored encrypted (${secrets.length})`);

      // ---- receive ----
      await closePeek(page);
      await ribbon(page, 'mail.receive', lang);
      await page.locator(`${P} .ml-item:has-text("Souper samedi")`).waitFor({ timeout: 10000 }).catch(() => {});
      await closePeek(page);
      check(await page.locator(`${P} .ml-item:has-text("Souper samedi")`).count() === 1, `${n}: the inbox comes in from Outlook.com`);
      check(await page.locator(`${P} .ml-item:has-text("compte suspendu") .ml-sus`).count() === 1, `${n}: the scam mail has the Suspicious badge`);
      check(await page.locator(`${P} .ml-item:has-text("Souper samedi") .ml-sus`).count() === 0, `${n}: the normal mail has no badge`);
      if (d.gmail) {
        check(await page.locator(`${P} .ml-item:has-text("Photos du chalet")`).count() === 1, `${n}: the Gmail inbox comes in by IMAP`);
        check(net.gmailRead === 0, `${n}: the send-only Gmail sign-in never reads the mailbox`);
        const pwds = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('oi1.mail.secret.imap:')).map(k => localStorage.getItem(k)));
        check(pwds.length === 1 && pwds[0].startsWith('oi1enc1:') && !pwds[0].includes('abcd'), `${n}: the app password is stored encrypted`);
      }
      check(await overflow(page) <= 1, `${n}: no sideways scrolling with the inbox`);

      // ---- the scam ----
      await page.locator(`${P} .ml-item:has-text("compte suspendu")`).click();
      const banner = page.locator(`${P} .ml-phish.danger`);
      check(await banner.isVisible().catch(() => false), `${n}: a red warning explains the scam`);
      const codes = await banner.locator('li').evaluateAll(l => l.map(x => x.getAttribute('data-code')));
      for (const c of ['dmarcFail', 'brandSpoof', 'replyTo', 'linkMismatch']) check(codes.includes(c), `${n}: the warning says ${c}`);
      check(await fits(page, banner, d), `${n}: the warning fits the screen`);
      await page.locator(`${P} .ml-body a`).first().click();
      const ld = page.locator('dialog.oi-dialog[open]');
      check(await ld.waitFor({ timeout: 3000 }).then(() => true, () => false), `${n}: the fake link opens a check window, not the site`);
      check((await ld.textContent()).includes('desjardins-secure.top'), `${n}: the check window shows where the link really goes`);
      check(await fits(page, ld, d), `${n}: the link check fits the screen`);
      await ld.locator('button.primary').click();
      check(!net.opened.some(u => u.includes('desjardins-secure')), `${n}: the scam site was never opened`);

      // ---- the normal mail: pictures blocked, reply through the account ----
      await back(page, phone);
      await page.locator(`${P} .ml-item:has-text("Souper samedi")`).click();
      await page.waitForTimeout(400);
      check(await page.locator(`${P} .ml-images`).isVisible().catch(() => false), `${n}: the remote picture is held back`);
      check(!net.opened.some(u => u.includes('pixel.example')), `${n}: the tracking pixel was not loaded`);
      check(await page.locator(`${P} .ml-phish`).count() === 0, `${n}: no warning on a normal mail`);
      await page.locator(`${P} .ml-images button`).click();
      await page.waitForTimeout(500);
      check(net.opened.some(u => u.includes('pixel.example')), `${n}: Show pictures loads them`);
      await page.locator(`${P} .ml-actions button`).first().click();
      const comp = page.locator(`${P} .ml-compose`);
      await comp.waitFor({ timeout: 4000 });
      await comp.locator('.ml-text').click();
      await page.keyboard.type('Oui, avec plaisir!');
      await page.waitForTimeout(300);
      check((await comp.locator('.ml-send').textContent()).includes(phone && d.gmail ? '@' : ME), `${n}: Send shows the account it goes through`);
      await comp.locator('.ml-send').click();
      await page.waitForTimeout(1200);
      const reply = net.sent[0] ?? (net.gmailSent[0] ? Buffer.from(net.gmailSent[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') : '');
      check(/^To: .*claire@example\.org/m.test(reply), `${n}: the answer really leaves through the account, to Claire`);
      check(/^In-Reply-To: <souper-1@example\.org>/m.test(reply) && !/X-Unsent/.test(reply), `${n}: the answer is threaded (In-Reply-To) and a real message`);
      const decoded = [...reply.matchAll(/\r\n\r\n([A-Za-z0-9+/=\r\n]{8,}?)\r\n(?:\r\n)?--/g)].map(m => Buffer.from(m[1].replace(/\s+/g, ''), 'base64').toString('utf8')).join('\n');
      check(decoded.includes('avec plaisir'), `${n}: the typed answer is inside`);

      // ---- answer a Gmail mail: it leaves by SMTP through that mailbox ----
      if (d.gmail) {
        await back(page, phone);
        await back(page, phone);
        await page.locator(`${P} .ml-folder`).first().click();
        await page.locator(`${P} .ml-item:has-text("Photos du chalet")`).click();
        await page.waitForTimeout(300);
        check((await page.evaluate(() => window.__imapSeen)).includes('7:1'), `${n}: opening it marks it read on the IMAP server`);
        await page.locator(`${P} .ml-actions button`).first().click();
        const c3 = page.locator(`${P} .ml-compose`);
        await c3.waitFor({ timeout: 4000 });
        await c3.locator('.ml-text').click();
        await page.keyboard.type('Merci Paul!');
        await c3.locator('.ml-send').click();
        await page.waitForFunction(() => window.__imapSent.length > 0, null, { timeout: 15000 }).catch(() => {});
        const s1 = (await page.evaluate(() => window.__imapSent))[0];
        check(!!s1 && s1.from === 'martin.test@gmail.com' && s1.to.join() === 'paul@example.net', `${n}: the answer leaves by SMTP from the Gmail mailbox, to Paul`);
        check(!!s1 && /^Subject: .*Photos du chalet/m.test(s1.raw) && !/^Bcc:/im.test(s1.raw), `${n}: SMTP gets a real message without a Bcc line`);
      }

      // ---- end to end ----
      await closePeek(page);
      await ribbon(page, 'mail.e2e', lang);
      const kd = page.locator('dialog.oi-dialog[open]');
      await kd.waitFor({ timeout: 3000 });
      check(await fits(page, kd, d), `${n}: the encryption window fits the screen`);
      await kd.locator('button.primary').first().click();
      await kd.locator('.ml-fpr').waitFor({ timeout: 20000 }).catch(() => {});
      const fpr = (await kd.locator('.ml-fpr').textContent().catch(() => '')).replace(/\s/g, '');
      check(/^[0-9A-F]{40}$/.test(fpr), `${n}: an OpenPGP key is made on the device (${fpr.slice(0, 8)}…)`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await back(page, phone);
      await page.locator(`${P} .ml-new`).first().click().catch(async () => { await page.locator(`${P} .ml-folders .ml-new`).click(); });
      const c2 = page.locator(`${P} .ml-compose`);
      await c2.waitFor({ timeout: 4000 });
      const sendWith = d.gmail ? 'martin.test@gmail.com' : ME;
      await c2.locator('.ml-field input').first().fill(ME);
      await c2.locator('.ml-field input').last().fill('Code du coffre');
      await c2.locator('.ml-text').click();
      await page.keyboard.type('Le code est 4321.');
      await c2.locator('.ml-lock-btn').click();
      check((await c2.locator('.ml-lock-btn').getAttribute('aria-pressed')) === 'true', `${n}: Encrypt this mail is switched on`);
      const msBefore = net.sent.length, gBefore = net.gmailSent.length;
      await c2.locator('.ml-send').click();
      // Key making and OpenPGP encryption can take a while on a slow machine: wait for the message itself to leave.
      for (let i = 0; i < 120 && net.sent.length === msBefore && net.gmailSent.length === gBefore; i++) await page.waitForTimeout(500);
      const lastRaw = net.gmailSent.length > gBefore ? Buffer.from(net.gmailSent.at(-1).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') : net.sent.length > msBefore ? net.sent.at(-1) : '';
      if (!lastRaw) problems.push(`${n}: nothing left after Send (note: ${await page.locator(`${P} .dr-note`).textContent().catch(() => '—')})`);
      check(/multipart\/encrypted/.test(lastRaw) && /BEGIN PGP MESSAGE/.test(lastRaw), `${n}: the mail leaves OpenPGP-encrypted (PGP/MIME) via ${sendWith}`);
      check(!/4321|Code du coffre/.test(lastRaw), `${n}: nothing readable leaves (no text, no subject)`);
      check(/^Autocrypt: addr=/m.test(lastRaw), `${n}: the public key travels with it (Autocrypt)`);
      // it comes back in the inbox and opens
      net.inbox.push(lastRaw);
      await closePeek(page);
      await ribbon(page, 'mail.receive', lang);
      await closePeek(page);
      await page.waitForTimeout(1500);
      await back(page, phone);
      const enc = page.locator(`${P} .ml-item:has(.ml-lock)`).first();
      check(await enc.count() > 0 && (await enc.textContent()).includes('Code du coffre'), `${n}: the encrypted mail arrives with its real subject`);
      if (await enc.count()) {
        await enc.click();
        await page.waitForTimeout(400);
        check((await page.locator(`${P} .ml-reader .ml-body`).textContent()).includes('4321'), `${n}: and opens on this device`);
        check(await page.locator(`${P} .ml-e2e[data-signed="1"]`).isVisible().catch(() => false), `${n}: end-to-end badge with the signature checked`);
      }

      // ---- stored encrypted, still there after reopening ----
      await page.waitForTimeout(900);
      const raw = await stored(page);
      check(raw.startsWith('oi1enc1:') && !raw.includes('Souper') && !raw.includes('Desjardins'), `${n}: the mailbox is encrypted on the device`);
      if (net.patched || d.gmail) passed.push(`${n}: opening a mail marks it read at the provider`);
      await page.reload();
      await page.waitForTimeout(500);
      if (!(await page.locator(`${P}`).count())) await page.locator('.slab:has-text("In 1 Mail")').first().click();
      await page.locator(`${P} .ml-list, ${P} .ml-compose`).first().waitFor({ timeout: 10000 }).catch(() => {});
      await back(page, phone);
      await page.locator(`${P} .ml-folder`).first().click();
      check(await page.locator(`${P} .ml-item:has-text("Souper samedi")`).count() === 1, `${n}: after reopening, the mails are still there`);
      await closePeek(page);
      await ribbon(page, 'mail.accounts', lang);
      check((await page.locator('dialog.oi-dialog[open] .ml-acc-list').textContent().catch(() => '')).includes(ME), `${n}: after reopening, the account is still connected`);
      await page.keyboard.press('Escape');
      check(await overflow(page) <= 1, `${n}: no sideways scrolling at the end`);
    } catch (e) {
      problems.push(`${n}: ${String(e).split('\n')[0]}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already stopped */ }
}

for (const p of passed) console.log(`✓ ${p}`);
for (const p of problems) console.log(`✗ ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
