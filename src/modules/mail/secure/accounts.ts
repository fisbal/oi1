// In 1 Mail accounts: real mail from Outlook.com / Hotmail / Live (Microsoft Graph) and Gmail (Gmail API), with no
// server of ours and no password ever seen or stored by Office In 1.
//
// Sign-in is OAuth 2.0 in a popup at Microsoft or Google (RFC 6749, IETF "OAuth 2.0 for Browser-Based Apps" BCP):
// - Microsoft: authorization code + PKCE (RFC 7636), the flow Microsoft requires for single-page apps. The refresh
//   token lasts 24 h (rolling), then the person signs in again with one click. Tenant "consumers" = personal accounts
//   only: work and school mailboxes (Microsoft 365 of employers, schools, hospitals) are deliberately not offered.
// - Google: the browser token flow (no client secret can live in a web page), SENDING ONLY (scope gmail.send, a
//   "sensitive" scope: no yearly paid CASA audit, unlike reading, which is "restricted"). Martin's choice 2026-11-13.
// - Gmail reading, Yahoo, iCloud, GMX, Zoho, Fastmail and any IMAP mailbox: IMAP + SMTP with an app password, in the
//   installed app only (src-tauri/src/mail.rs: a web page cannot open mail-server connections).
// Tokens are kept encrypted with the device key (vault.ts) and only ever sent to the provider that made them.

import { getSecret, putSecret } from './vault';

export type ProviderId = 'outlook' | 'gmail';
export type AccountKind = ProviderId | 'imap';
export interface Servers { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number; preset: string }
export interface Account {
  id: string; provider: AccountKind; email: string; name: string; added: string; lastSync?: string;
  /** Gmail through Google sign-in: sending only (reading Gmail = IMAP in the installed app). */
  sendOnly?: boolean;
  /** IMAP / SMTP servers (provider 'imap'). */
  servers?: Servers;
}
interface Tok { access: string; exp: number; refresh?: string }
export interface Remote { remoteId: string; raw: string; unread: boolean }

/** Public app IDs from the Microsoft Entra and Google Cloud consoles (not secrets: every sign-in page shows them). */
const CLIENT_IDS: Record<ProviderId, string> = {
  outlook: (import.meta.env.VITE_MS_CLIENT_ID as string | undefined) ?? '',
  gmail: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '',
};
export function clientId(p: ProviderId): string {
  try { const own = localStorage.getItem(`oi1.mail.clientId.${p}`); if (own && /^[\w.-]{8,200}$/.test(own)) return own; } catch { /* private window */ }
  return CLIENT_IDS[p];
}
export const ready = (p: ProviderId) => !!clientId(p);

const MS = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const MS_SCOPES = 'openid profile email offline_access User.Read Mail.ReadWrite Mail.Send';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const G_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const G_SCOPES = 'openid email https://www.googleapis.com/auth/gmail.send';
const G_USER = 'https://openidconnect.googleapis.com/v1/userinfo';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

export type MailErrorKind = 'notReady' | 'cancelled' | 'auth' | 'net' | 'blocked' | 'popup';
export class MailError extends Error { constructor(public kind: MailErrorKind, msg: string = kind) { super(msg); } }

/** https://fisbal.github.io/oi1/oauth.html on the site (the address registered at Microsoft and Google). */
export const redirectUri = () => new URL('oauth.html', new URL((import.meta.env.BASE_URL as string | undefined) || './', location.href)).href;

const b64url = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
async function challenge(verifier: string) { return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))); }

/** Opens the provider's sign-in page and waits for oauth.html to hand back the answer (same origin only). */
let cancelWait: (() => void) | null = null;
export const cancelSignIn = () => cancelWait?.();
function popup(url: string, state: string): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const w = window.open(url, 'oi1-oauth', 'popup=yes,width=520,height=700');
    if (!w) { reject(new MailError('popup')); return; }
    let bc: BroadcastChannel | null = null;
    const done = (fn: () => void) => { window.removeEventListener('message', onMsg); window.removeEventListener('storage', onStore); bc?.close(); clearTimeout(timer); cancelWait = null; fn(); };
    const take = (data: unknown) => {
      const d = data as { oi1oauth?: Record<string, string> } | null;
      const p = d?.oi1oauth;
      if (!p || p.state !== state) return; // someone else's answer, or a forged one: ignored
      done(() => (p.error ? reject(new MailError(p.error === 'access_denied' ? 'cancelled' : 'auth', p.error_description || p.error)) : resolve(p)));
    };
    const onMsg = (e: MessageEvent) => { if (e.origin === location.origin) take(e.data); };
    const onStore = (e: StorageEvent) => { if (e.key === 'oi1.oauth.answer' && e.newValue) { try { take(JSON.parse(e.newValue)); localStorage.removeItem('oi1.oauth.answer'); } catch { /* not ours */ } } };
    window.addEventListener('message', onMsg);
    window.addEventListener('storage', onStore);
    try { bc = new BroadcastChannel('oi1-oauth'); bc.onmessage = e => take(e.data); } catch { /* old browser */ }
    const timer = window.setTimeout(() => done(() => reject(new MailError('cancelled'))), 5 * 60_000);
    cancelWait = () => done(() => { try { w.close(); } catch { /* gone */ } reject(new MailError('cancelled')); });
  });
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  let r: Response;
  try { r = await fetch(url, { ...init, credentials: 'omit', referrerPolicy: 'no-referrer' }); }
  catch (e) { throw new MailError(/confidential/i.test(String(e)) ? 'blocked' : 'net', String(e)); }
  if (r.status === 401 || r.status === 403) throw new MailError('auth', `${r.status}`);
  if (!r.ok) throw new MailError('net', `${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return r;
}
const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };

// ---------- signing in ----------
async function msCode(hint?: string): Promise<Tok> {
  const id = clientId('outlook');
  if (!id) throw new MailError('notReady');
  const state = random(16), verifier = random(48);
  const q = new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: redirectUri(), response_mode: 'query', scope: MS_SCOPES, state,
    code_challenge: await challenge(verifier), code_challenge_method: 'S256', prompt: hint ? 'login' : 'select_account', ...(hint ? { login_hint: hint } : {}) });
  const got = await popup(`${MS}/authorize?${q}`, state);
  if (!got.code) throw new MailError('auth', 'no code');
  const r = await call(`${MS}/token`, { method: 'POST', headers: FORM, body: form({ client_id: id, grant_type: 'authorization_code', code: got.code, redirect_uri: redirectUri(), code_verifier: verifier, scope: MS_SCOPES }) });
  return tokOf(await r.json());
}
function tokOf(j: { access_token?: string; expires_in?: number | string; refresh_token?: string }): Tok {
  if (!j.access_token) throw new MailError('auth', 'no token');
  return { access: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 - 60_000, ...(j.refresh_token ? { refresh: j.refresh_token } : {}) };
}
async function gToken(hint?: string, silent = false): Promise<Tok> {
  const id = clientId('gmail');
  if (!id) throw new MailError('notReady');
  const state = random(16);
  const q = new URLSearchParams({ client_id: id, response_type: 'token', redirect_uri: redirectUri(), scope: G_SCOPES, state, include_granted_scopes: 'true',
    ...(hint ? { login_hint: hint } : {}), ...(silent ? { prompt: 'none' } : { prompt: 'select_account' }) });
  const got = await popup(`${G_AUTH}?${q}`, state);
  return tokOf(got);
}

/** Signs in with Microsoft or Google and returns the new account (its tokens are stored encrypted). */
export async function connect(provider: ProviderId): Promise<Account> {
  const tok = provider === 'outlook' ? await msCode() : await gToken();
  let email = '', name = '';
  if (provider === 'outlook') {
    const me = await (await call(`${GRAPH}/me?$select=displayName,mail,userPrincipalName`, { headers: { Authorization: `Bearer ${tok.access}` } })).json() as { displayName?: string; mail?: string; userPrincipalName?: string };
    email = me.mail || me.userPrincipalName || ''; name = me.displayName ?? '';
  } else {
    const me = await (await call(G_USER, { headers: { Authorization: `Bearer ${tok.access}` } })).json() as { email?: string; name?: string };
    email = me.email ?? ''; name = me.name ?? '';
  }
  const acc: Account = { id: `${provider}:${email.toLowerCase()}`, provider, email, name, added: new Date().toISOString(), ...(provider === 'gmail' ? { sendOnly: true } : {}) };
  await putSecret(acc.id, tok);
  return acc;
}

/** A working access token: refreshed (Microsoft) or asked again (Google) when it ran out. */
async function access(acc: Account, interactive: boolean): Promise<string> {
  const tok = await getSecret<Tok>(acc.id);
  if (tok && tok.exp > Date.now()) return tok.access;
  let next: Tok | null = null;
  if (acc.provider === 'outlook' && tok?.refresh) {
    try {
      const r = await call(`${MS}/token`, { method: 'POST', headers: FORM, body: form({ client_id: clientId('outlook'), grant_type: 'refresh_token', refresh_token: tok.refresh, scope: MS_SCOPES }) });
      next = tokOf(await r.json());
    } catch (e) { if (!(e instanceof MailError)) throw e; } // refresh token expired or refused: sign in again below
  }
  if (!next) {
    if (!interactive) throw new MailError('auth', 'signed out');
    if (acc.provider === 'outlook') next = await msCode(acc.email);
    else {
      try { next = await gToken(acc.email, !!tok); } // still signed in at Google: the popup closes by itself
      catch (e) { if (!(e instanceof MailError) || e.kind !== 'auth') throw e; next = await gToken(acc.email); }
    }
  }
  await putSecret(acc.id, next);
  return next.access;
}
async function authed(acc: Account, interactive: boolean, url: string, init: RequestInit = {}): Promise<Response> {
  const go = async (a: string) => call(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${a}` } });
  try { return await go(await access(acc, interactive)); }
  catch (e) {
    if (!(e instanceof MailError && e.kind === 'auth')) throw e;
    const tok = await getSecret<Tok>(acc.id);
    if (tok) await putSecret(acc.id, { ...tok, exp: 0 }); // the token was refused: get a new one once
    return go(await access(acc, interactive));
  }
}

/** Forgets the account on this device (and asks Google to revoke its token). */
export async function disconnect(acc: Account): Promise<void> {
  if (acc.provider === 'imap') { await putSecret(acc.id, null); return; }
  const tok = await getSecret<Tok>(acc.id);
  await putSecret(acc.id, null);
  if (acc.provider === 'gmail' && tok) { try { await fetch(`https://oauth2.googleapis.com/revoke?${form({ token: tok.access })}`, { method: 'POST', headers: FORM, credentials: 'omit' }); } catch { /* offline: the token dies within the hour */ } }
}

// ---------- mail ----------
const binary = (buf: ArrayBuffer) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return s; };
const fromB64url = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));
const toB64url = (bin: string) => btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const utf8bin = (s: string) => binary(new TextEncoder().encode(s).buffer as ArrayBuffer);

/** The newest mails of the inbox that are not on the device yet, as raw MIME (RFC 5322). */
export async function fetchInbox(acc: Account, known: Set<string>, max = 40, interactive = true): Promise<Remote[]> {
  if (acc.provider === 'imap') {
    const got = await imapCall<{ remoteId: string; raw: string; unread: boolean }[]>('mail_imap_fetch', { login: await loginOf(acc, 'imap'), known: [...known], max });
    return got.map(r => ({ remoteId: r.remoteId, raw: atob(r.raw), unread: r.unread }));
  }
  if (acc.sendOnly) return [];
  const out: Remote[] = [];
  if (acc.provider === 'outlook') {
    const list = await (await authed(acc, interactive, `${GRAPH}/me/mailFolders/inbox/messages?$top=${max}&$select=id,isRead&$orderby=receivedDateTime%20desc`)).json() as { value?: { id: string; isRead?: boolean }[] };
    for (const m of list.value ?? []) {
      if (known.has(m.id)) continue;
      const raw = binary(await (await authed(acc, interactive, `${GRAPH}/me/messages/${encodeURIComponent(m.id)}/$value`)).arrayBuffer());
      out.push({ remoteId: m.id, raw, unread: m.isRead === false });
    }
  } else {
    const list = await (await authed(acc, interactive, `${GMAIL}/messages?labelIds=INBOX&maxResults=${max}`)).json() as { messages?: { id: string }[] };
    for (const m of list.messages ?? []) {
      if (known.has(m.id)) continue;
      const one = await (await authed(acc, interactive, `${GMAIL}/messages/${encodeURIComponent(m.id)}?format=raw`)).json() as { raw?: string; labelIds?: string[] };
      if (one.raw) out.push({ remoteId: m.id, raw: fromB64url(one.raw), unread: !!one.labelIds?.includes('UNREAD') });
    }
  }
  return out;
}

/** Sends a complete MIME message (built by toEml, maybe OpenPGP-encrypted). The provider keeps a copy in Sent. */
/** The message without its Bcc header (only the header part is looked at; folded lines go with it). */
export function stripBcc(mime: string): string {
  const cut = mime.search(/\r?\n\r?\n/);
  const head = cut < 0 ? mime : mime.slice(0, cut), rest = cut < 0 ? '' : mime.slice(cut);
  return head.replace(/^Bcc:[^\r\n]*(?:\r?\n[ \t][^\r\n]*)*(?:\r?\n|$)/gim, '') + rest;
}
export async function sendMime(acc: Account, mime: string, rcpt: string[] = []): Promise<void> {
  const bin = utf8bin(mime);
  if (acc.provider === 'imap') {
    // SMTP sends the message as it is: the Bcc line must go (the server gets those addresses in the envelope only).
    const noBcc = stripBcc(bin);
    await imapCall('mail_smtp_send', { login: await loginOf(acc, 'smtp'), from: acc.email, to: rcpt, raw: btoa(noBcc) });
    return;
  }
  if (acc.provider === 'outlook') await authed(acc, true, `${GRAPH}/me/sendMail`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: btoa(bin) });
  else await authed(acc, true, `${GMAIL}/messages/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: toB64url(bin) }) });
}
export async function markRead(acc: Account, remoteId: string): Promise<void> {
  if (acc.provider === 'imap') { await imapCall('mail_imap_seen', { login: await loginOf(acc, 'imap'), remoteId }); return; }
  if (acc.sendOnly) return;
  if (acc.provider === 'outlook') await authed(acc, false, `${GRAPH}/me/messages/${encodeURIComponent(remoteId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isRead: true }) });
  else await authed(acc, false, `${GMAIL}/messages/${encodeURIComponent(remoteId)}/modify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ removeLabelIds: ['UNREAD'] }) });
}
export async function trashRemote(acc: Account, remoteId: string): Promise<void> {
  if (acc.provider === 'imap') { await imapCall('mail_imap_trash', { login: await loginOf(acc, 'imap'), remoteId }); return; }
  if (acc.sendOnly) return;
  if (acc.provider === 'outlook') await authed(acc, true, `${GRAPH}/me/messages/${encodeURIComponent(remoteId)}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destinationId: 'deleteditems' }) });
  else await authed(acc, true, `${GMAIL}/messages/${encodeURIComponent(remoteId)}/trash`, { method: 'POST' });
}

// ---------- IMAP / SMTP (installed app) ----------
/** Mail servers of the usual providers, and where each one makes app passwords. Outlook.com is not here: Microsoft
 *  turned off passwords for IMAP in 2024, it signs in with Microsoft above. */
export const PRESETS: { id: string; name: string; imap: [string, number]; smtp: [string, number]; help: string }[] = [
  { id: 'gmail', name: 'Gmail', imap: ['imap.gmail.com', 993], smtp: ['smtp.gmail.com', 465], help: 'https://myaccount.google.com/apppasswords' },
  { id: 'yahoo', name: 'Yahoo', imap: ['imap.mail.yahoo.com', 993], smtp: ['smtp.mail.yahoo.com', 465], help: 'https://login.yahoo.com/account/security/app-passwords' },
  { id: 'icloud', name: 'iCloud', imap: ['imap.mail.me.com', 993], smtp: ['smtp.mail.me.com', 587], help: 'https://account.apple.com/account/manage' },
  { id: 'aol', name: 'AOL', imap: ['imap.aol.com', 993], smtp: ['smtp.aol.com', 465], help: 'https://login.aol.com/account/security' },
  { id: 'gmx', name: 'GMX', imap: ['imap.gmx.com', 993], smtp: ['mail.gmx.com', 465], help: 'https://www.gmx.com/' },
  { id: 'zoho', name: 'Zoho', imap: ['imap.zoho.com', 993], smtp: ['smtp.zoho.com', 465], help: 'https://accounts.zoho.com/home#security/app_password' },
  { id: 'fastmail', name: 'Fastmail', imap: ['imap.fastmail.com', 993], smtp: ['smtp.fastmail.com', 465], help: 'https://app.fastmail.com/settings/security/apps' },
  { id: 'other', name: 'IMAP', imap: ['', 993], smtp: ['', 465], help: '' },
];
type ImapFn = (cmd: string, args: Record<string, unknown>) => Promise<unknown>;
/** The installed app's mail engine (Tauri); tests may put a stand-in on window.__oi1Imap. */
function engine(): ImapFn | null {
  const w = window as unknown as { __oi1Imap?: ImapFn; __TAURI_INTERNALS__?: unknown };
  if (w.__oi1Imap) return w.__oi1Imap;
  if (w.__TAURI_INTERNALS__) return async (cmd, args) => (await import('@tauri-apps/api/core')).invoke(cmd, args);
  return null;
}
export const imapAvailable = () => typeof window !== 'undefined' && !!engine();
/** Sign-in pages of Microsoft and Google come back to the web site only: in the installed app use IMAP instead. */
export const oauthAvailable = () => typeof window !== 'undefined' && !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
async function imapCall<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const run = engine();
  if (!run) throw new MailError('notReady');
  try { return await run(cmd, args) as T; }
  catch (e) {
    const m = String((e as { message?: string })?.message ?? e);
    throw new MailError(/^auth/i.test(m) ? 'auth' : /confidential/i.test(m) ? 'blocked' : 'net', m);
  }
}
async function loginOf(acc: Account, which: 'imap' | 'smtp') {
  const sec = await getSecret<{ pass: string }>(acc.id);
  if (!sec?.pass || !acc.servers) throw new MailError('auth', 'no password');
  const sv = acc.servers;
  return which === 'imap' ? { host: sv.imapHost, port: sv.imapPort, user: acc.email, pass: sec.pass } : { host: sv.smtpHost, port: sv.smtpPort, user: acc.email, pass: sec.pass };
}
/** Connects an IMAP mailbox: the address and app password are checked at the server before anything is kept. */
export async function connectImap(email: string, appPassword: string, servers: Servers, name = ''): Promise<Account> {
  const pass = appPassword.replace(/\s+/g, ''); // Google shows app passwords as "abcd efgh ijkl mnop"
  const host = (h: string) => h.trim().toLowerCase();
  const sv: Servers = { ...servers, imapHost: host(servers.imapHost), smtpHost: host(servers.smtpHost) };
  if (!sv.imapHost || !sv.smtpHost) throw new MailError('net', 'no server');
  await imapCall('mail_imap_check', { login: { host: sv.imapHost, port: sv.imapPort, user: email.trim(), pass } });
  const acc: Account = { id: `imap:${email.trim().toLowerCase()}`, provider: 'imap', email: email.trim(), name, added: new Date().toISOString(), servers: sv };
  await putSecret(acc.id, { pass });
  return acc;
}
