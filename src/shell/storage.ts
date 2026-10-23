// localStorage can be blocked (private windows, strict settings), so every call is guarded.
export const store = {
  get(key: string): string | null {
    try { return localStorage.getItem(`oi1:${key}`); } catch { return null; }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(`oi1:${key}`, value); } catch { /* blocked or full */ }
  },
  removePrefix(prefix: string) {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(`oi1:${prefix}`)).forEach(k => localStorage.removeItem(k));
    } catch { /* blocked */ }
  },
};
