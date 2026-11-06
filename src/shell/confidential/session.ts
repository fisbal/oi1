// Turning confidential mode on and off, unlocking, locking (by hand, after a quiet time, or when the app was
// left), and keeping the encrypted copy of the tab names and settings (see storage.ts) up to date.
import { idb, openRecord, rawEntries, rewriteAll, sealRecord } from '../db';
import { sealedKey, sealedMemory } from '../storage';
import { confidentialOn, confidentialUnlocked, onConfidential, setUnlocked } from './mode';
import { createVault, isSealed, lock, lockMinutes, readKeys, removeVault, unlock, writeKeys } from './vault';
import { dropJournalCache, flushJournal, journal } from './journal';
import { onBlocked } from './netGuard';

const STORE_KEY = '__oi1:store';
/** Things kept outside the store that hold document text: put away when the mode is turned on. */
const LOOSE_PREFIXES = ['oi1.lang.original.', 'oi1.assistant.history'];

let memLoaded = false;
let flushTimer = 0;

async function flushStore() {
  window.clearTimeout(flushTimer);
  flushTimer = 0;
  if (!memLoaded || !confidentialOn() || !writeKeys()) return;
  await idb.set('kv', sealedMemory.entries(), STORE_KEY).catch(() => {});
}
sealedMemory.onChange(() => {
  if (!memLoaded || !confidentialOn()) return;
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => { void flushStore(); }, 300);
});

async function loadStore() {
  const v = await idb.get<Record<string, string>>('kv', STORE_KEY).catch(() => undefined);
  sealedMemory.load(v && typeof v === 'object' ? v : {});
  memLoaded = true;
}

function localKeys(): string[] { try { return Object.keys(localStorage); } catch { return []; } }

/** Turns the mode on with this PIN and encrypts everything already saved. Returns the recovery code. */
export async function turnOn(pin: string, minutes = 5): Promise<string> {
  // Tab names and settings: copied into memory first, so the open apps keep reading them once the mode is on.
  const moved: Record<string, string> = {};
  for (const full of localKeys()) {
    if (!full.startsWith('oi1:') || !sealedKey(full.slice(4))) continue;
    try { moved[full.slice(4)] = localStorage.getItem(full) ?? ''; } catch { /* blocked */ }
  }
  sealedMemory.load(moved);
  const code = await createVault(pin, minutes);
  const k = readKeys()!;
  memLoaded = true;
  for (const full of Object.keys(moved)) { try { localStorage.removeItem(`oi1:${full}`); } catch { /* blocked */ } }
  for (const full of localKeys()) if (LOOSE_PREFIXES.some(p => full.startsWith(p))) { try { localStorage.removeItem(full); } catch { /* blocked */ } }
  // Autosaves, Notes, recent files: encrypted in place.
  await rewriteAll('kv', async (key, value) => (isSealed(value) ? [key, value] : (sealRecord('kv', value, String(key), k) as Promise<[IDBValidKey | undefined, unknown]>)));
  await rewriteAll('recent', async (key, value) => (isSealed(value) ? [key, value] : (sealRecord('recent', value, undefined, k) as Promise<[IDBValidKey | undefined, unknown]>)));
  await flushStore();
  journal('on');
  startWatch();
  return code;
}

/** Turns the mode off (needs the PIN): decrypts everything back and forgets the keys. */
export async function turnOff(pin: string): Promise<boolean> {
  if (!await unlock(pin)) { journal('badPin'); return false; }
  const k = readKeys()!;
  const back = sealedMemory.entries();
  await rewriteAll('kv', async (key, value) => {
    if (String(key) === STORE_KEY || String(key) === '__oi1:journal') return null;
    if (!isSealed(value)) return [key, value];
    const v = await openRecord(value, k);
    return v === undefined ? null : [key, v];
  });
  await rewriteAll('recent', async (key, value) => {
    if (!isSealed(value)) return [key, value];
    const v = await openRecord<{ id: string }>(value, k);
    return v ? [v.id, v] : null;
  });
  window.clearTimeout(flushTimer);
  memLoaded = false;
  // The open notes must not go to LanguageTool the moment the mode is off: online grammar stays off until turned on again.
  try { localStorage.setItem('oi1.proof.grammar', '0'); } catch { /* blocked */ }
  removeVault();
  for (const [key, v] of Object.entries(back)) { try { localStorage.setItem(`oi1:${key}`, v); } catch { /* full */ } }
  sealedMemory.clear();
  dropJournalCache();
  stopWatch();
  return true;
}

/** Unlocks with the PIN, or the recovery code. */
export async function openVault(secret: string, recovery = false): Promise<boolean> {
  if (!await unlock(secret, recovery)) { journal('badPin'); return false; }
  await loadStore();
  setUnlocked(true);
  flushJournal();
  journal(recovery ? 'recovery' : 'unlock');
  startWatch();
  return true;
}

/** Locks now. The apps close; their last saves are still encrypted (vault.ts keeps the keys two seconds). */
export function lockNow(auto = false) {
  if (!confidentialUnlocked()) return;
  journal(auto ? 'autoLock' : 'lock');
  void flushStore();
  lock();
  window.setTimeout(() => { if (!confidentialUnlocked()) { void flushStore().finally(() => { if (!confidentialUnlocked()) { memLoaded = false; sealedMemory.clear(); dropJournalCache(); } }); } }, 1500);
}

// ---------- auto-lock ----------

let last = Date.now();
let hiddenAt = 0;
let tick = 0;
const touch = () => { last = Date.now(); };
const quietTooLong = (since: number) => Date.now() - since >= lockMinutes() * 60_000;
function onVisibility() {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); void flushStore(); return; }
  if (hiddenAt && quietTooLong(hiddenAt)) lockNow(true);
  hiddenAt = 0;
  touch();
}
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
function startWatch() {
  if (tick) return;
  touch();
  for (const e of EVENTS) window.addEventListener(e, touch, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  tick = window.setInterval(() => { if (confidentialUnlocked() && quietTooLong(last)) lockNow(true); }, 10_000);
}
function stopWatch() {
  for (const e of EVENTS) window.removeEventListener(e, touch, { capture: true });
  document.removeEventListener('visibilitychange', onVisibility);
  window.clearInterval(tick);
  tick = 0;
}

let started = false;
/** Called once at start-up: blocked sends go into the journal. */
export function startConfidential() {
  if (started) return;
  started = true;
  onBlocked(b => journal('blocked', `${b.host} (${b.how})`));
  onConfidential(() => { if (!confidentialOn()) stopWatch(); });
}

/** For the panel: how much is encrypted right now. */
export async function sealedCounts(): Promise<{ sealed: number; plain: number }> {
  let sealed = 0, plain = 0;
  for (const s of ['kv', 'recent'] as const) for (const [, v] of await rawEntries(s).catch(() => [] as [IDBValidKey, unknown][])) { if (isSealed(v)) sealed++; else plain++; }
  return { sealed, plain };
}
