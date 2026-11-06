// The vault of confidential mode: the PIN, the recovery code and the keys that encrypt what Office In 1 keeps on
// this device (autosaves, Notes, recent files, tab names). Only the browser's own Web Crypto is used.
//
// How it works:
// - One random 256-bit data key is made when the mode is turned on. It never leaves this device in clear.
// - The PIN, stretched with PBKDF2-SHA-256 (600 000 rounds, OWASP 2023), makes a key that wraps the data key
//   (AES-256-GCM). The recovery code (24 letters, about 120 bits) wraps it a second time, for a lost PIN.
// - When unlocked, HKDF turns the data key into an AES-256-GCM key (contents) and an HMAC key (names of recent
//   files, so the list can be searched without showing them). Both are non-extractable and kept in memory only.
// - Locking forgets them. Nothing can be read again without the PIN or the recovery code: not even by us.

import { VAULT_KEY, confidentialOn, setUnlocked, changed } from './mode';

const PIN_ROUNDS = 600_000;
const CODE_ROUNDS = 200_000; // the code is long and random: fewer rounds are enough
// Only a count of wrong tries and the time of the last one (no PIN, no key): the wait after too many tries.
const TRIES_KEY = 'oi1.lockWait';
export const PIN_MIN = 6;

interface Wrapped { salt: string; iv: string; data: string; rounds: number }
interface VaultFile { v: 1; pin: Wrapped; code: Wrapped; check: string; made: number; lockMinutes?: number }

export interface Keys { aes: CryptoKey; mac: CryptoKey }
let keys: Keys | null = null;
/** Keys kept for a moment after locking, so the last saves of closing apps are still encrypted (see lock). */
let leaving: Keys | null = null;

type Bytes = Uint8Array<ArrayBuffer>;
const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) => { const u = b instanceof Uint8Array ? b : new Uint8Array(b); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string): Bytes => Uint8Array.from(atob(s), c => c.charCodeAt(0)) as Bytes;
const random = (n: number): Bytes => globalThis.crypto.getRandomValues(new Uint8Array(n));

function readVault(): VaultFile | null {
  try { const v = JSON.parse(localStorage.getItem(VAULT_KEY) ?? 'null') as VaultFile | null; return v?.v === 1 ? v : null; } catch { return null; }
}
function writeVault(v: VaultFile | null) {
  try { if (v) localStorage.setItem(VAULT_KEY, JSON.stringify(v)); else localStorage.removeItem(VAULT_KEY); } catch { /* blocked */ }
  changed();
}

async function stretch(secret: string, salt: Bytes, rounds: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', enc.encode(secret.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function wrap(raw: Bytes, secret: string, rounds: number): Promise<Wrapped> {
  const salt = random(16), iv = random(12);
  const k = await stretch(secret, salt, rounds);
  return { salt: b64(salt), iv: b64(iv), rounds, data: b64(await subtle().encrypt({ name: 'AES-GCM', iv }, k, raw)) };
}
async function unwrap(w: Wrapped, secret: string): Promise<Bytes | null> {
  try {
    const k = await stretch(secret, unb64(w.salt), w.rounds);
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: unb64(w.iv) }, k, unb64(w.data)));
  } catch { return null; } // wrong PIN or code: GCM refuses
}
async function keysOf(raw: Bytes): Promise<Keys> {
  const base = await subtle().importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  const info = (s: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32) as Bytes, info: enc.encode(s) as Bytes });
  const aes = await subtle().deriveKey(info('oi1 contents'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const mac = await subtle().deriveKey(info('oi1 names'), base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
  return { aes, mac };
}
async function checkOf(k: Keys) { return b64(await subtle().sign('HMAC', k.mac, enc.encode('oi1 check'))); }

/** A recovery code people can write down: 24 letters and digits in 6 groups, no look-alikes (0/O, 1/I/L). */
export function newRecoveryCode(): string {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = random(24);
  const s = Array.from(r, x => A[x % A.length]).join('');
  return s.match(/.{4}/g)!.join('-');
}
const cleanCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');

export const pinOk = (pin: string) => /^\d+$/.test(pin) ? pin.length >= PIN_MIN : pin.length >= PIN_MIN + 2;

/** Turns the mode on: makes the data key, wraps it with the PIN and with a new recovery code (returned once). */
export async function createVault(pin: string, lockMinutes = 5): Promise<string> {
  if (!pinOk(pin)) throw new Error('pin');
  const raw = random(32);
  const code = newRecoveryCode();
  const k = await keysOf(raw);
  const file: VaultFile = { v: 1, pin: await wrap(raw, pin, PIN_ROUNDS), code: await wrap(raw, cleanCode(code), CODE_ROUNDS), check: await checkOf(k), made: Date.now(), lockMinutes };
  raw.fill(0);
  keys = k;
  writeVault(file);
  setUnlocked(true);
  return code;
}

/** Waiting time after wrong PINs: 5 free tries, then 30 s, 1 min, 2 min… up to 15 min. */
export function waitLeft(now = Date.now()): number {
  try {
    const t = JSON.parse(localStorage.getItem(TRIES_KEY) ?? 'null') as { n: number; at: number } | null;
    if (!t || t.n < 5) return 0;
    const wait = Math.min(15 * 60_000, 30_000 * 2 ** (t.n - 5));
    return Math.max(0, t.at + wait - now);
  } catch { return 0; }
}
function failed() {
  try {
    const t = JSON.parse(localStorage.getItem(TRIES_KEY) ?? 'null') as { n: number } | null;
    localStorage.setItem(TRIES_KEY, JSON.stringify({ n: (t?.n ?? 0) + 1, at: Date.now() }));
  } catch { /* blocked */ }
}
const triesReset = () => { try { localStorage.removeItem(TRIES_KEY); } catch { /* blocked */ } };

/** Opens the keys with the PIN (or, with `recovery`, the recovery code). False when it is wrong or when it must wait.
 *  The apps stay closed until setUnlocked(true) (see session.ts openVault). */
export async function unlock(secret: string, recovery = false): Promise<boolean> {
  const v = readVault();
  if (!v || waitLeft() > 0) return false;
  const raw = await unwrap(recovery ? v.code : v.pin, recovery ? cleanCode(secret) : secret);
  if (!raw) { failed(); return false; }
  const k = await keysOf(raw);
  raw.fill(0);
  if (await checkOf(k) !== v.check) { failed(); return false; }
  triesReset();
  keys = k;
  leaving = null;
  // The caller (session.ts) says "unlocked" once the tab names are read back, so the apps open with them.
  return true;
}

/** Changes the PIN (needs the vault unlocked with the old PIN or the recovery code just before). */
export async function changePin(oldSecret: string, newPin: string, recovery = false): Promise<boolean> {
  const v = readVault();
  if (!v || !pinOk(newPin)) return false;
  const raw = await unwrap(recovery ? v.code : v.pin, recovery ? cleanCode(oldSecret) : oldSecret);
  if (!raw) { failed(); return false; }
  v.pin = await wrap(raw, newPin, PIN_ROUNDS);
  raw.fill(0);
  writeVault(v);
  return true;
}

/** Forgets the keys. The apps close first (their last saves still get the keys for two seconds). */
export function lock() {
  if (!keys) { setUnlocked(false); return; }
  leaving = keys;
  keys = null;
  setUnlocked(false);
  setTimeout(() => { if (!keys) leaving = null; }, 2000);
}

/** The keys to encrypt with now (also during the two seconds after locking), or null. */
export const writeKeys = (): Keys | null => keys ?? leaving;
/** The keys to read with: only while unlocked. */
export const readKeys = (): Keys | null => keys;

export const lockMinutes = () => readVault()?.lockMinutes ?? 5;
export function setLockMinutes(m: number) { const v = readVault(); if (v) { v.lockMinutes = m; writeVault(v); } }
export const vaultMade = () => readVault()?.made ?? 0;

/** Turns the mode off on this device (the caller has decrypted everything first). */
export function removeVault() { keys = null; leaving = null; writeVault(null); triesReset(); setUnlocked(false); }

// ---------- sealing values ----------

export interface Sealed { __oi1enc: 1; iv: Bytes; ct: ArrayBuffer }
export const isSealed = (v: unknown): v is Sealed => !!v && typeof v === 'object' && (v as Sealed).__oi1enc === 1;

const BLOB = '\u0000oi1blob';
/** A Blob's bytes (FileReader where Blob.arrayBuffer is missing: old Safari, test pages). */
const bytesOf = (b: Blob): Promise<ArrayBuffer> => (typeof b.arrayBuffer === 'function' ? b.arrayBuffer()
  : new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as ArrayBuffer); r.onerror = () => reject(r.error); r.readAsArrayBuffer(b); }));
/** Turns a value (text, object, Blob, or objects holding Blobs) into bytes. File handles are dropped. */
async function pack(value: unknown): Promise<Bytes> {
  const blobs: { type: string; data: string }[] = [];
  const walk = async (x: unknown): Promise<unknown> => {
    if (typeof Blob !== 'undefined' && x instanceof Blob) { blobs.push({ type: x.type, data: b64(await bytesOf(x)) }); return { [BLOB]: blobs.length - 1, name: (x as File).name }; }
    if (Array.isArray(x)) { const out = []; for (const y of x) out.push(await walk(y)); return out; }
    if (x && typeof x === 'object') {
      if (typeof FileSystemHandle !== 'undefined' && x instanceof FileSystemHandle) return undefined;
      const out: Record<string, unknown> = {};
      for (const [k, y] of Object.entries(x)) out[k] = await walk(y);
      return out;
    }
    return x;
  };
  const body = await walk(value);
  return enc.encode(JSON.stringify({ body, blobs })) as Bytes;
}
function unpack(bytes: ArrayBuffer): unknown {
  const { body, blobs } = JSON.parse(new TextDecoder().decode(bytes)) as { body: unknown; blobs: { type: string; data: string }[] };
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (typeof o[BLOB] === 'number') {
        const b = blobs[o[BLOB] as number];
        const bytes = unb64(b.data);
        return typeof o.name === 'string' && typeof File !== 'undefined' ? new File([bytes], o.name, { type: b.type }) : new Blob([bytes], { type: b.type });
      }
      const out: Record<string, unknown> = {};
      for (const [k, y] of Object.entries(o)) out[k] = walk(y);
      return out;
    }
    return x;
  };
  return walk(body);
}

export async function seal(value: unknown, k: Keys): Promise<Sealed> {
  const iv = random(12);
  return { __oi1enc: 1, iv, ct: await subtle().encrypt({ name: 'AES-GCM', iv }, k.aes, await pack(value)) };
}
export async function open(s: Sealed, k: Keys): Promise<unknown> {
  return unpack(await subtle().decrypt({ name: 'AES-GCM', iv: s.iv }, k.aes, s.ct));
}
/** A name turned into a fixed code with the HMAC key: the same name gives the same code, but the name cannot be read. */
export async function hideName(name: string, k: Keys): Promise<string> {
  const sig = new Uint8Array(await subtle().sign('HMAC', k.mac, enc.encode(name)));
  return `h:${Array.from(sig.subarray(0, 16), x => x.toString(16).padStart(2, '0')).join('')}`;
}

export { confidentialOn };
