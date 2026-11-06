// localStorage can be blocked (private windows, strict settings), so every call is guarded.
// In confidential mode, what can tell about a document (tab names, each tab's settings and file name) is not put
// in localStorage: it stays in memory and is saved encrypted with the autosaves (see confidential/session.ts).
import { confidentialOn } from './confidential/mode';

/** Keys that describe documents: the open tabs, the active one, and everything a tab keeps (`<tabId>:…`). */
export const sealedKey = (key: string) => key === 'tabs' || key === 'active' || /^t[0-9a-z]{6,}:/.test(key);

const mem = new Map<string, string>();
const memListeners = new Set<() => void>();
const memChanged = () => { for (const fn of memListeners) fn(); };

/** The in-memory part of the store, used while confidential mode is on. */
export const sealedMemory = {
  entries: () => Object.fromEntries(mem) as Record<string, string>,
  load(values: Record<string, string>) { mem.clear(); for (const [k, v] of Object.entries(values)) if (typeof v === 'string') mem.set(k, v); },
  clear() { mem.clear(); },
  onChange(fn: () => void) { memListeners.add(fn); return () => { memListeners.delete(fn); }; },
};

const hidden = (key: string) => confidentialOn() && sealedKey(key);

export const store = {
  get(key: string): string | null {
    if (hidden(key)) return mem.get(key) ?? null;
    try { return localStorage.getItem(`oi1:${key}`); } catch { return null; }
  },
  set(key: string, value: string) {
    if (hidden(key)) { mem.set(key, value); memChanged(); return; }
    try { localStorage.setItem(`oi1:${key}`, value); } catch { /* blocked or full */ }
  },
  removePrefix(prefix: string) {
    if (confidentialOn()) { let n = 0; for (const k of [...mem.keys()]) if (k.startsWith(prefix)) { mem.delete(k); n++; } if (n) memChanged(); }
    try {
      Object.keys(localStorage).filter(k => k.startsWith(`oi1:${prefix}`)).forEach(k => localStorage.removeItem(k));
    } catch { /* blocked */ }
  },
};
