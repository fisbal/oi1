// Confidential mode (Martin, 2026-11-05: a health worker asked if patient notes are safe in Office In 1).
// This file only says whether the mode is on and whether it is unlocked. It has no imports, so any part of the app
// (storage, grammar, AI, cloud, dictation) can ask it without import cycles. The keys live in vault.ts.

export const VAULT_KEY = 'oi1.confidential.vault';

let unlocked = false;
const listeners = new Set<() => void>();

/** The mode is on as soon as a vault (PIN) exists on this device. */
export function confidentialOn(): boolean {
  try { return !!localStorage.getItem(VAULT_KEY); } catch { return false; }
}
/** On and unlocked: the person typed the PIN and the keys are in memory. */
export const confidentialUnlocked = () => confidentialOn() && unlocked;
/** On and locked: nothing may be read or written until the PIN is typed. */
export const confidentialLocked = () => confidentialOn() && !unlocked;

export function setUnlocked(on: boolean) {
  if (unlocked === on) return;
  unlocked = on;
  changed();
}
export function changed() { for (const fn of listeners) { try { fn(); } catch { /* a listener failed */ } } }
export function onConfidential(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
