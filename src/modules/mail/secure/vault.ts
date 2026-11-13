// In 1 Mail keeps sign-in keys and the mailbox encrypted on the device (AES-256-GCM, NIST SP 800-38D).
// The key is made by the browser and stored as a non-extractable CryptoKey (W3C Web Crypto): a copy of the
// site's files, a backup or a disk image holds only ciphertext, and no script can read the key's bytes out.
// Confidential mode adds its own PIN-based layer on top (src/shell/confidential).

const DB = 'oi1-mail-keys';
const PREFIX = 'oi1enc1:';
let keyP: Promise<CryptoKey> | null = null;

function idb(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('k');
    rq.onsuccess = () => ok(rq.result);
    rq.onerror = () => fail(rq.error);
  });
}
function tx<T>(d: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((ok, fail) => { const t = d.transaction('k', mode); const r = fn(t.objectStore('k')); t.oncomplete = () => ok(r.result as T); t.onerror = () => fail(t.error); });
}

/** The device key (made once, never leaves the browser). */
export function deviceKey(): Promise<CryptoKey> {
  keyP ??= (async () => {
    const d = await idb();
    const got = await tx<CryptoKey | undefined>(d, 'readonly', s => s.get('main'));
    if (got) return got;
    const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await tx(d, 'readwrite', s => s.put(k, 'main'));
    return k;
  })().catch(e => { keyP = null; throw e; });
  return keyP;
}

const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export const isSealedText = (s: string | null | undefined) => !!s && s.startsWith(PREFIX);

/** Text encrypted with the device key: "oi1enc1:" + base64(iv ‖ ciphertext ‖ tag). */
export async function sealText(text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deviceKey(), new TextEncoder().encode(text)));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return PREFIX + b64(out);
}
/** The text back; plain text saved before encryption existed is returned as it is. */
export async function openText(s: string): Promise<string> {
  if (!isSealedText(s)) return s;
  const all = unb64(s.slice(PREFIX.length));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, await deviceKey(), all.slice(12));
  return new TextDecoder().decode(pt);
}

/** Small secrets (sign-in tokens), encrypted, in localStorage. */
export async function putSecret(name: string, value: unknown): Promise<void> {
  const k = `oi1.mail.secret.${name}`;
  if (value == null) { try { localStorage.removeItem(k); } catch { /* private window */ } return; }
  const sealed = await sealText(JSON.stringify(value));
  try { localStorage.setItem(k, sealed); } catch { /* private window */ }
}
export async function getSecret<T>(name: string): Promise<T | null> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(`oi1.mail.secret.${name}`); } catch { return null; }
  if (!raw) return null;
  try { return JSON.parse(await openText(raw)) as T; } catch { return null; }
}
