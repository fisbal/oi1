// A Code+ project: its files, saved with the tab, as a .zip on the device, or packed into a link.

import { isBinary, mimeOf, normalize, type Files } from './build';
import type { RepoRef } from './github';

export interface Project {
  name: string;
  files: Files;
  /** Empty folders, which have no file to show them. */
  folders: string[];
  open: string[];
  active: string | null;
  /** The GitHub repository it syncs with. */
  github?: RepoRef & { pages?: string };
  /** What the preview saved in localStorage. */
  storage?: Record<string, string>;
}

export const emptyProject = (): Project => ({ name: '', files: {}, folders: [], open: [], active: null });

const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp3|wav|ogg|mp4|webm|pdf|zip|wasm)$/i;

/** Reads a file from the device into a project entry: text, or a data: URL for pictures, fonts and sounds. */
export async function readEntry(name: string, data: ArrayBuffer): Promise<string> {
  if (BINARY.test(name)) {
    const blob = new Blob([data], { type: mimeOf(name) });
    return await new Promise<string>((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(r.result as string);
      r.onerror = () => fail(r.error);
      r.readAsDataURL(blob);
    });
  }
  return new TextDecoder().decode(data);
}

/** The folder that every path starts with, so a zip of "site/…" opens as the site itself. */
function commonRoot(paths: string[]) {
  if (!paths.length) return '';
  const first = paths[0].split('/');
  if (first.length < 2) return '';
  const root = first[0];
  return paths.every(p => p.startsWith(`${root}/`)) ? `${root}/` : '';
}

const SKIP = /(^|\/)(node_modules|\.git|dist|build|\.next|\.DS_Store|__MACOSX)(\/|$)/;

export async function readZip(data: ArrayBuffer): Promise<Files> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(data);
  const entries = Object.values(zip.files).filter(f => !f.dir && !SKIP.test(f.name));
  const root = commonRoot(entries.map(e => e.name));
  const files: Files = {};
  for (const e of entries) files[normalize(e.name.slice(root.length))] = await readEntry(e.name, await e.async('arraybuffer'));
  return files;
}

/** Files picked with a folder picker (they carry webkitRelativePath). */
export async function readPicked(list: FileList | File[]): Promise<Files> {
  const all = [...list].map(f => ({ f, path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name })).filter(x => !SKIP.test(x.path));
  const root = commonRoot(all.map(x => x.path));
  const files: Files = {};
  for (const { f, path } of all) files[normalize(path.slice(root.length))] = await readEntry(path, await f.arrayBuffer());
  return files;
}

export async function writeZip(files: Files): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    if (isBinary(content)) zip.file(path, content.slice(content.indexOf(',') + 1), { base64: true });
    else zip.file(path, content);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// ---------------- links that carry a whole small project ----------------

const b64url = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));

async function squeeze(bytes: Uint8Array, mode: 'compress' | 'decompress'): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(mode === 'compress' ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Packs a project's files and the page to show into a short text for a link (#run=…). */
export async function packRun(files: Files, page: string): Promise<string> {
  const json = JSON.stringify({ p: page, f: files });
  return b64url(await squeeze(new TextEncoder().encode(json), 'compress'));
}

export async function unpackRun(text: string): Promise<{ page: string; files: Files }> {
  const json = new TextDecoder().decode(await squeeze(fromB64url(text), 'decompress'));
  const { p, f } = JSON.parse(json) as { p: string; f: Files };
  return { page: p, files: f };
}

/** The longest link a phone camera still reads well from a QR code on a screen. */
export const QR_LIMIT = 2300;

export function runLink(packed: string) {
  return `${location.origin}${location.pathname}#run=${packed}`;
}
