// The access journal of confidential mode: who did what and when, on this device (unlocks, wrong PINs, files
// opened, saved, printed or exported, blocked sends). Kept encrypted with the autosaves; the newest 3000 stay.
import { idb } from '../db';
import { confidentialOn, confidentialUnlocked } from './mode';

export type JournalAction =
  | 'on' | 'off' | 'unlock' | 'recovery' | 'badPin' | 'lock' | 'autoLock' | 'pin'
  | 'open' | 'save' | 'export' | 'print' | 'blocked';
export interface JournalEntry { t: number; a: JournalAction; d?: string }

const KEY = '__oi1:journal';
const MAX = 3000;
let cache: JournalEntry[] | null = null;
/** Entries made while locked (wrong PINs, blocked sends), written at the next unlock. */
const waiting: JournalEntry[] = [];
let chain: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
export function onJournal(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

async function load(): Promise<JournalEntry[]> {
  if (cache) return cache;
  const v = await idb.get<JournalEntry[]>('kv', KEY).catch(() => undefined);
  cache = Array.isArray(v) ? v : [];
  return cache;
}

/** Adds one line. While locked it waits in memory for the next unlock. */
export function journal(a: JournalAction, d?: string) {
  if (!confidentialOn() && a !== 'off') return;
  const e: JournalEntry = { t: Date.now(), a, ...(d ? { d: d.slice(0, 200) } : {}) };
  if (!confidentialUnlocked() && a !== 'lock' && a !== 'autoLock') { waiting.push(e); return; }
  write(e);
}

function write(e?: JournalEntry) {
  chain = chain.then(async () => {
    const all = await load();
    all.push(...waiting.splice(0), ...(e ? [e] : []));
    all.sort((x, y) => x.t - y.t);
    if (all.length > MAX) all.splice(0, all.length - MAX);
    await idb.set('kv', all, KEY).catch(() => {});
    for (const fn of listeners) fn();
  });
}

/** Writes what waited while locked (called right after unlocking). */
export function flushJournal() { if (waiting.length) write(); }

export async function readJournal(): Promise<JournalEntry[]> { await chain; return [...await load()].reverse(); }
/** Forget the cached copy (after locking, so nothing stays in memory). */
export function dropJournalCache() { cache = null; }
