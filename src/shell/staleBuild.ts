// When a new version of Office In 1 is published while a page is open, that page still runs the old version.
// The parts it loads only when needed (the Word reader, the Excel reader, the copilot…) have new file names
// in the new version, so the old page can no longer fetch them: "Failed to fetch dynamically imported module".
// The publish step keeps the previous version's files for one more release (see build.yml), and if a page
// is older than that, it reloads itself onto the new version once — reopening the file that was being opened.

import type { OpenedFile } from './contract';
import { idb } from './db';
import { wrapFile } from './files';

const REOPEN_KEY = 'oi1:reopenAfterUpdate';
const GUARD_KEY = 'oi1:staleReloadAt';
/** One automatic reload per minute at most, so a real network problem never turns into a reload loop. */
const GUARD_MS = 60_000;
/** Longer than AutoSave's pause (400 ms) plus its write, so the working copy of every open tab is on the device. */
const SETTLE_MS = 900;

/** True for the error a browser gives when a part of an older version is no longer on the server. */
export function isStaleBuild(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(msg);
}

function mayReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(GUARD_KEY) ?? 0);
    if (Date.now() - last < GUARD_MS) return false;
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch { /* storage blocked: still reload once */ }
  return true;
}

/**
 * Reloads the page onto the newest version. When `file` is given it is kept on this device and opened again
 * after the reload. Returns false (and does nothing) when a reload already happened in the last minute.
 */
export async function reloadToNewVersion(file?: OpenedFile): Promise<boolean> {
  if (!mayReload()) return false;
  if (file) {
    try {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'application/octet-stream' });
      await idb.set('kv', { name: file.name, blob }, REOPEN_KEY);
    } catch { /* the reload still brings the new version; the person opens the file again */ }
  }
  await new Promise(r => window.setTimeout(r, SETTLE_MS));
  location.reload();
  return true;
}

/** The file that was being opened when the page reloaded onto a new version, once. */
export async function takeReopenAfterUpdate(): Promise<OpenedFile | null> {
  try {
    const saved = await idb.get<{ name: string; blob: Blob }>('kv', REOPEN_KEY);
    if (!saved) return null;
    await idb.delete('kv', REOPEN_KEY);
    return wrapFile(saved.blob, undefined, saved.name);
  } catch {
    return null;
  }
}

/**
 * For every part loaded later anywhere in the app: a missing old part reloads onto the new version.
 * It waits one turn, so code that opens a file (the Letter's Word reader) can first call
 * reloadToNewVersion(file) itself and have that file reopened; this one then sees the guard and stays quiet.
 */
export function watchStaleBuild(): void {
  window.addEventListener('vite:preloadError', e => {
    const err = (e as Event & { payload?: unknown }).payload;
    if (isStaleBuild(err)) window.setTimeout(() => void reloadToNewVersion(), 0);
  });
}
