// A small IndexedDB store for things too big for localStorage: autosaved documents and recent files.
// In confidential mode every value is encrypted here before it is written, and decrypted when read
// (see confidential/vault.ts); the apps above do not change. Recent files also get their names hidden.

import { confidentialOn } from './confidential/mode';
import { hideName, isSealed, open, readKeys, seal, writeKeys, type Keys } from './confidential/vault';

const DB_NAME = 'oi1';
export type StoreName = 'kv' | 'recent';

let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('kv');
      req.result.createObjectStore('recent', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { opening = null; reject(req.error); };
  });
  return opening;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return db().then(d => new Promise<T>((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

/** Thrown when something is saved while confidential mode is locked: nothing is written in clear. */
export class LockedError extends Error { constructor() { super('Confidential mode is locked'); } }

async function sealFor(store: StoreName, value: unknown, key: string | undefined, k: Keys): Promise<[unknown, string | undefined]> {
  if (store === 'recent') {
    const { id, time, handle: _drop, ...rest } = value as { id: string; time: number; handle?: unknown };
    return [{ id: await hideName(id, k), time, ...(await seal({ id, time, ...rest }, k)) }, undefined];
  }
  return [await seal(value, k), key];
}
async function openOne<T>(raw: unknown, k: Keys | null): Promise<T | undefined> {
  if (!isSealed(raw)) return raw as T | undefined; // saved before the mode was on (or the mode is off)
  if (!k) return undefined;
  try { return await open(raw, k) as T; } catch { return undefined; }
}
const realKey = async (store: StoreName, key: string) => {
  const k = confidentialOn() ? writeKeys() : null;
  return store === 'recent' && k ? hideName(key, k) : key;
};

export const idb = {
  get: async <T>(store: StoreName, key: string): Promise<T | undefined> => {
    if (!confidentialOn()) return run<T | undefined>(store, 'readonly', s => s.get(key) as IDBRequest<T | undefined>);
    const k = readKeys();
    let raw = await run<unknown>(store, 'readonly', s => s.get(key) as IDBRequest<unknown>);
    if (raw === undefined && store === 'recent' && k) { const hidden = await hideName(key, k); raw = await run<unknown>(store, 'readonly', s => s.get(hidden) as IDBRequest<unknown>); }
    return openOne<T>(raw, k);
  },
  set: async (store: StoreName, value: unknown, key?: string): Promise<void> => {
    if (!confidentialOn()) return run<IDBValidKey>(store, 'readwrite', s => s.put(value, key)).then(() => {});
    const k = writeKeys(); // taken now: a save started just before locking is still encrypted
    if (!k) throw new LockedError();
    const [v, kk] = await sealFor(store, value, key, k);
    await run<IDBValidKey>(store, 'readwrite', s => s.put(v, kk));
  },
  delete: async (store: StoreName, key: string): Promise<void> => {
    const real = await realKey(store, key);
    await run<undefined>(store, 'readwrite', s => { s.delete(real); if (real !== key) s.delete(key); });
  },
  all: async <T>(store: StoreName): Promise<T[]> => {
    const raw = await run<unknown[]>(store, 'readonly', s => s.getAll() as IDBRequest<unknown[]>);
    if (!confidentialOn()) return raw as T[];
    const k = readKeys();
    const out: T[] = [];
    for (const r of raw) { const v = await openOne<T>(r, k); if (v !== undefined) out.push(v); }
    return out;
  },
  /** Deletes every key that starts with `prefix`. */
  deletePrefix: (store: StoreName, prefix: string) =>
    run<undefined>(store, 'readwrite', s => { s.delete(IDBKeyRange.bound(prefix, `${prefix}\uffff`)); }).then(() => {}),
};

/** Every stored record as it is on disk (for turning confidential mode on or off). */
export function rawEntries(store: StoreName): Promise<[IDBValidKey, unknown][]> {
  return db().then(d => new Promise((resolve, reject) => {
    const out: [IDBValidKey, unknown][] = [];
    const req = d.transaction(store, 'readonly').objectStore(store).openCursor();
    req.onsuccess = () => { const c = req.result; if (!c) { resolve(out); return; } out.push([c.primaryKey, c.value]); c.continue(); };
    req.onerror = () => reject(req.error);
  }));
}
/** Rewrites every record of a store with `fn` (null deletes it), in one transaction once all are ready. */
export async function rewriteAll(store: StoreName, fn: (key: IDBValidKey, value: unknown) => Promise<[IDBValidKey | undefined, unknown] | null>) {
  const all = await rawEntries(store);
  const next: ([IDBValidKey | undefined, unknown] | null)[] = [];
  for (const [k, v] of all) next.push(await fn(k, v));
  await run<undefined>(store, 'readwrite', s => {
    all.forEach(([k], i) => {
      const n = next[i];
      s.delete(k);
      if (n) { if (store === 'recent') s.put(n[1]); else s.put(n[1], n[0]); }
    });
  });
}
export const sealRecord = sealFor;
export const openRecord = openOne;
