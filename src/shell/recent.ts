// Recently opened and saved files, shown on the home screen and in each module's File menu.
// Where the browser allows it we keep a handle to the real file; otherwise a copy of the file,
// so the list works in every browser, also offline.

import type { OpenedFile, RecentFile } from './contract';
import { idb } from './db';
import { allowed, wrapFile } from './files';

interface Entry extends RecentFile {
  handle?: FileSystemFileHandle;
  data?: Blob;
}

const MAX_ENTRIES = 15;
const MAX_COPY_BYTES = 25 * 1024 * 1024;
const listeners = new Set<() => void>();

export function onRecentChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function addRecent(moduleId: string, name: string, handle?: FileSystemFileHandle, data?: Blob) {
  try {
    const entry: Entry = {
      id: `${moduleId}:${name}`, name, moduleId, time: Date.now(), handle,
      data: data && data.size <= MAX_COPY_BYTES ? data : undefined,
    };
    await idb.set('recent', entry);
    const all = await idb.all<Entry>('recent');
    for (const old of all.sort((a, b) => b.time - a.time).slice(MAX_ENTRIES)) await idb.delete('recent', old.id);
    listeners.forEach(fn => fn());
  } catch { /* storage blocked (private window): the list just stays empty */ }
}

export async function listRecent(moduleId?: string): Promise<RecentFile[]> {
  try {
    const all = await idb.all<Entry>('recent');
    return all.filter(e => !moduleId || e.moduleId === moduleId)
      .sort((a, b) => b.time - a.time)
      .map(({ id, name, moduleId: m, time }) => ({ id, name, moduleId: m, time }));
  } catch {
    return [];
  }
}

export async function openRecent(id: string): Promise<OpenedFile | null> {
  const entry = await idb.get<Entry>('recent', id).catch(() => undefined);
  if (!entry) return null;
  if (entry.handle) {
    try {
      if (await allowed(entry.handle, 'read')) return wrapFile(await entry.handle.getFile(), entry.handle);
    } catch { /* moved or deleted: use the copy */ }
  }
  return entry.data ? wrapFile(entry.data, undefined, entry.name) : null;
}

export async function removeRecent(id: string) {
  await idb.delete('recent', id).catch(() => {});
  listeners.forEach(fn => fn());
}
