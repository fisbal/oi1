// What the app bar says about saving, for each tab: the working copy is kept on the device after every change,
// and with AutoSave on, the document's own file (or its cloud copy) is written too, like Word's AutoSave.

import type { FileRef } from './contract';
import { store } from './storage';
import { cloudOn } from './cloud';

export interface SaveStatus { state: 'idle' | 'saving' | 'saved' | 'error'; where: 'device' | 'file' | 'cloud'; name?: string; at: number }
type Saver = () => Promise<FileRef | null>;

const statuses = new Map<string, SaveStatus>();
const savers = new Map<string, Saver>();
const timers = new Map<string, number>();
const listeners = new Set<(tabId: string) => void>();
const AUTO = 'autosave';

export const autoSaveOn = () => store.get(AUTO) !== '0';
export function setAutoSave(on: boolean) { store.set(AUTO, on ? '1' : '0'); for (const fn of listeners) fn('*'); }

export const saveStatus = (tabId: string): SaveStatus => statuses.get(tabId) ?? { state: 'idle', where: 'device', at: 0 };
export function onSaveStatus(fn: (tabId: string) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function set(tabId: string, s: Partial<SaveStatus>) {
  statuses.set(tabId, { ...saveStatus(tabId), ...s });
  for (const fn of listeners) fn(tabId);
}

/** The module's way to write its document to its own file without asking; null to stop. */
export function registerSaver(tabId: string, fn: Saver | null) {
  if (fn) savers.set(tabId, fn); else savers.delete(tabId);
}

/** Wraps a working-copy save: shows "Saving…" then "Saved", and then writes the file itself when AutoSave is on. */
export async function trackedSave(tabId: string, work: () => Promise<unknown>) {
  const last = saveStatus(tabId);
  set(tabId, { state: 'saving' });
  try {
    await work();
    // Keep saying where it was last saved (the file) until the file is written again.
    set(tabId, { state: 'saved', at: Date.now(), where: last.where === 'device' ? 'device' : last.where });
  } catch {
    set(tabId, { state: 'error', at: Date.now() });
    return;
  }
  const saver = savers.get(tabId);
  if (!saver || !autoSaveOn()) { if (last.where !== 'device') set(tabId, { where: 'device' }); return; }
  window.clearTimeout(timers.get(tabId));
  // A pause in the work, then the real file: writing a .docx or .xlsx at every key would be slow.
  timers.set(tabId, window.setTimeout(async () => {
    set(tabId, { state: 'saving' });
    try {
      const ref = await saver();
      set(tabId, ref ? { state: 'saved', where: ref.cloud ? 'cloud' : 'file', name: ref.name, at: Date.now() } : { state: 'saved', where: 'device', at: Date.now() });
    } catch {
      set(tabId, { state: 'error', at: Date.now() });
    }
  }, cloudOn() ? 6000 : 2500)); // each cloud save is a commit: wait for a longer pause
}

export function forgetTab(tabId: string) { statuses.delete(tabId); savers.delete(tabId); window.clearTimeout(timers.get(tabId)); }
