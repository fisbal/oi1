// Opening and saving files on the user's device.
// Chrome and Edge have the File System Access API, so OI1 can save back to the file it opened, like a
// desktop app. Other browsers (Firefox, Safari, phones) pick files with an <input> and save by downloading.

import type { FileRef, OpenedFile, SaveOptions } from './contract';

interface PickerType { description?: string; accept: Record<string, string[]> }
interface FsWindow {
  showOpenFilePicker?(o: { types?: PickerType[]; excludeAcceptAllOption?: boolean; multiple?: boolean }): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(o: { suggestedName?: string; types?: PickerType[] }): Promise<FileSystemFileHandle>;
}
interface PermissionHandle {
  queryPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

const fsWindow = () => window as unknown as FsWindow;

const MIME: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.pdf': 'application/pdf', '.html': 'text/html', '.htm': 'text/html', '.txt': 'text/plain', '.csv': 'text/csv',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
};

export function wrapFile(file: File | Blob, handle?: FileSystemFileHandle, name?: string): OpenedFile {
  return {
    name: name ?? (file as File).name,
    type: file.type,
    handle,
    text: () => file.text(),
    arrayBuffer: () => file.arrayBuffer(),
  };
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

function pickerTypes(extensions: string[]): PickerType[] {
  const accept: Record<string, string[]> = {};
  for (const ext of extensions) (accept[MIME[ext] ?? 'application/octet-stream'] ??= []).push(ext);
  return [{ accept }];
}

export async function pickFile(extensions: string[]): Promise<OpenedFile | null> {
  const w = fsWindow();
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({ types: pickerTypes(extensions) });
      return wrapFile(await handle.getFile(), handle);
    } catch (e) {
      if (isAbort(e)) return null;
      // Some pages (inside iframes, for example) cannot use the picker: fall back to <input>.
    }
  }
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = extensions.join(',');
    input.onchange = () => resolve(input.files?.[0] ? wrapFile(input.files[0]) : null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Asks for permission to use a file again (the browser may show a prompt). */
export async function allowed(handle: FileSystemFileHandle, mode: 'read' | 'readwrite'): Promise<boolean> {
  const h = handle as unknown as PermissionHandle;
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode })) === 'granted') return true;
  return (await h.requestPermission?.({ mode })) === 'granted';
}

async function write(handle: FileSystemFileHandle, blob: Blob) {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/** True inside the Office In 1 app for Windows or Android (Tauri), not in a browser. */
export const inApp = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** The app's own save dialog, for Android where the web view can neither pick a place nor download. */
async function saveInApp(name: string, blob: Blob): Promise<FileRef | null> {
  const [{ save }, { writeFile }] = await Promise.all([import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs')]);
  const ext = name.slice(name.lastIndexOf('.') + 1);
  const path = await save({ defaultPath: name, filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : undefined });
  if (!path) return null;
  await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  return { name: decodeURIComponent(path.split(/[\\/]/).pop() || name) };
}

export function downloadFile(name: string, content: Blob | string, mimeType: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves a file, returning where it went (with the blob, for the recent files list), or null if cancelled. */
export async function saveFile(name: string, content: Blob | string | (() => Promise<Blob | string>), mimeType: string,
  options: SaveOptions = {}): Promise<{ ref: FileRef; blob: Blob } | null> {
  const toBlob = async () => {
    const c = typeof content === 'function' ? await content() : content;
    return typeof c === 'string' ? new Blob([c], { type: mimeType }) : c;
  };
  const target = options.target?.handle;
  if (target && !options.saveAs && target.name.toLowerCase().endsWith(name.slice(name.lastIndexOf('.')).toLowerCase())) {
    try {
      if (await allowed(target, 'readwrite')) {
        const blob = await toBlob();
        await write(target, blob);
        return { ref: { name: target.name, handle: target }, blob };
      }
    } catch { /* the file moved or is locked: ask where to save instead */ }
  }
  const w = fsWindow();
  if (w.showSaveFilePicker) {
    let handle: FileSystemFileHandle;
    try {
      const ext = name.slice(name.lastIndexOf('.'));
      handle = await w.showSaveFilePicker({ suggestedName: name, types: [{ accept: { [mimeType]: [ext] } }] });
    } catch (e) {
      if (isAbort(e)) return null;
      const blob = await toBlob();
      downloadFile(name, blob, mimeType);
      return { ref: { name }, blob };
    }
    const blob = await toBlob();
    await write(handle, blob);
    return { ref: { name: handle.name, handle }, blob };
  }
  const blob = await toBlob();
  if (inApp()) {
    const ref = await saveInApp(name, blob);
    return ref ? { ref, blob } : null;
  }
  downloadFile(name, blob, mimeType);
  return { ref: { name }, blob };
}
