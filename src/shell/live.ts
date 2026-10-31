// Live parts: one table, chart or text that lives in several apps at once and can be changed in any of them
// (like Microsoft Loop components, without a cloud). Each part is a Yjs document (a CRDT: changes made in two
// places, even offline, always merge the same way everywhere), kept on the device in IndexedDB and passed to
// the other tabs and windows through a BroadcastChannel. Every copy carries a fingerprint of its content, so an
// app can show at any time whether its copy really matches the part.

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { TableData } from './contract';

export type LiveKind = 'table' | 'text' | 'chart';
export interface LiveContent { kind: LiveKind; title: string; table?: TableData; text?: string; chart?: Record<string, unknown> }
export interface LiveInfo { id: string; kind: LiveKind; title: string; owner: string; created: number; updated: number; hash: string; places: string[] }
export type SyncState = 'synced' | 'pending' | 'different';

const CHANNEL = 'oi1-live';
const INDEX = 'oi1.live.index';

/** A short fingerprint of a content (FNV-1a, 32 bits): equal contents give equal fingerprints. */
export function fingerprint(c: LiveContent): string {
  const s = JSON.stringify([c.kind, c.title, c.table?.rows.map(r => r.map(x => [x.text, x.formula ?? '', !!x.bold])) ?? null, c.table?.header ?? false, c.text ?? null, c.chart ?? null]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---------- one part's Yjs document ----------

/** Writes `c` into the document, changing only the cells that differ, so changes made elsewhere still merge. */
export function writeContent(doc: Y.Doc, c: LiveContent, origin: unknown = null) {
  doc.transact(() => {
    const meta = doc.getMap<unknown>('meta');
    if (meta.get('kind') !== c.kind) meta.set('kind', c.kind);
    if (meta.get('title') !== c.title) meta.set('title', c.title);
    if (c.table) {
      if (meta.get('header') !== !!c.table.header) meta.set('header', !!c.table.header);
      const rows = doc.getArray<Y.Array<Y.Map<unknown>>>('rows');
      const want = c.table.rows;
      if (rows.length > want.length) rows.delete(want.length, rows.length - want.length);
      want.forEach((row, r) => {
        let yrow = rows.get(r);
        if (!yrow) { yrow = new Y.Array<Y.Map<unknown>>(); rows.push([yrow]); }
        if (yrow.length > row.length) yrow.delete(row.length, yrow.length - row.length);
        row.forEach((cell, k) => {
          let ycell = yrow.get(k);
          if (!ycell) { ycell = new Y.Map<unknown>(); yrow.push([ycell]); }
          if (ycell.get('text') !== cell.text) ycell.set('text', cell.text);
          if ((ycell.get('formula') ?? undefined) !== cell.formula) { if (cell.formula) ycell.set('formula', cell.formula); else ycell.delete('formula'); }
          if (!!ycell.get('bold') !== !!cell.bold) ycell.set('bold', !!cell.bold);
        });
      });
    }
    if (c.text !== undefined) {
      const text = doc.getText('text');
      if (text.toString() !== c.text) { text.delete(0, text.length); text.insert(0, c.text); }
    }
    if (c.chart) meta.set('chart', c.chart);
  }, origin);
}

export function readContent(doc: Y.Doc): LiveContent {
  const meta = doc.getMap<unknown>('meta');
  const kind = meta.get('kind') as LiveKind | undefined;
  // Not made yet on this device: no table, so the app can start the part from its own copy.
  if (!kind) return { kind: 'table', title: '' };
  const c: LiveContent = { kind, title: (meta.get('title') as string) ?? '' };
  if (kind === 'table') {
    c.table = {
      header: !!meta.get('header'),
      rows: doc.getArray<Y.Array<Y.Map<unknown>>>('rows').toArray().map(r => r.toArray().map(m => {
        const cell: TableData['rows'][number][number] = { text: (m.get('text') as string) ?? '' };
        if (m.get('formula')) cell.formula = m.get('formula') as string;
        if (m.get('bold')) cell.bold = true;
        return cell;
      })),
    };
  }
  if (kind === 'text') c.text = doc.getText('text').toString();
  if (meta.get('chart')) c.chart = meta.get('chart') as Record<string, unknown>;
  return c;
}

// ---------- the store every app shares ----------

type Listener = (c: LiveContent, info: LiveInfo) => void;
interface Open { doc: Y.Doc; ready: Promise<void>; listeners: Set<Listener> }

/** A new part's id. Ids start with `lp_`, so a link can tell a live part from an older one-time link. */
export const newLiveId = () => `lp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const isLiveId = (id: string | null | undefined): id is string => !!id && id.startsWith('lp_');
const newId = newLiveId;

/** The words of a table only, for apps that keep text but not formulas (a letter shows a formula's result). */
export const tableText = (t: TableData | undefined) => JSON.stringify(t?.rows.map(r => r.map(c => c.text)) ?? []);

/** `next` (an app's copy) laid over `part`: cells whose words did not change keep the part's formula and bold,
 *  so a letter never wipes a sheet's formulas by sending back their results. */
export function keepDetails(part: TableData | undefined, next: TableData): TableData {
  if (!part) return next;
  return { ...next, rows: next.rows.map((row, r) => row.map((cell, c) => {
    const old = part.rows[r]?.[c];
    return old && old.text === cell.text ? { ...cell, formula: old.formula, bold: cell.bold ?? old.bold } : cell;
  })) };
}

export class LiveStore {
  private open = new Map<string, Open>();
  private channel: BroadcastChannel | null;
  private persist: boolean;
  private indexListeners = new Set<() => void>();
  constructor({ persist = true, channel = true }: { persist?: boolean; channel?: boolean } = {}) {
    this.persist = persist && typeof indexedDB !== 'undefined';
    this.channel = channel && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
    this.channel?.addEventListener('message', e => this.onMessage(e.data));
  }

  /** Every part on this device, newest change first. */
  list(): LiveInfo[] {
    try { return (JSON.parse(localStorage.getItem(INDEX) ?? '[]') as LiveInfo[]).sort((a, b) => b.updated - a.updated); } catch { return []; }
  }
  info(id: string): LiveInfo | null { return this.list().find(p => p.id === id) ?? null; }
  onIndex(fn: () => void) { this.indexListeners.add(fn); return () => { this.indexListeners.delete(fn); }; }
  private saveInfo(info: LiveInfo) {
    const all = this.list().filter(p => p.id !== info.id);
    try { localStorage.setItem(INDEX, JSON.stringify([info, ...all])); } catch { /* private window: the parts still work in this tab */ }
    for (const fn of this.indexListeners) fn();
  }

  private get(id: string): Open {
    let o = this.open.get(id);
    if (!o) {
      const doc = new Y.Doc();
      const ready = this.persist ? new IndexeddbPersistence(`oi1-live-${id}`, doc).whenSynced.then(() => undefined) : Promise.resolve();
      o = { doc, ready, listeners: new Set() };
      const opened = o;
      doc.on('update', (update: Uint8Array, origin: unknown) => {
        // Changes made here go to the other tabs; changes that came from them do not go back.
        if (origin !== 'remote') this.channel?.postMessage({ type: 'update', id, update });
        const c = readContent(doc);
        const old = this.info(id);
        const info: LiveInfo = { id, kind: c.kind, title: c.title, owner: old?.owner ?? '', created: old?.created ?? Date.now(), updated: Date.now(), hash: fingerprint(c), places: old?.places ?? [] };
        if (origin !== 'remote' || !old || old.hash !== info.hash) this.saveInfo(info);
        for (const fn of opened.listeners) fn(c, info);
      });
      this.open.set(id, o);
      // Ask the other tabs for what they have, in case this tab missed changes.
      this.channel?.postMessage({ type: 'hello', id, state: Y.encodeStateVector(doc) });
    }
    return o;
  }

  private onMessage(m: { type: string; id: string; update?: Uint8Array; state?: Uint8Array }) {
    const o = this.open.get(m.id);
    if (!o) return;
    if (m.type === 'update' && m.update) Y.applyUpdate(o.doc, m.update, 'remote');
    if (m.type === 'hello' && m.state) this.channel?.postMessage({ type: 'update', id: m.id, update: Y.encodeStateAsUpdate(o.doc, m.state) });
  }

  /** Makes a new part from `content`; `owner` is the app it comes from. */
  async create(content: LiveContent, owner: string, place?: string): Promise<string> {
    const id = newId();
    const o = this.get(id);
    await o.ready;
    this.saveInfo({ id, kind: content.kind, title: content.title, owner, created: Date.now(), updated: Date.now(), hash: fingerprint(content), places: place ? [place] : [] });
    writeContent(o.doc, content);
    return id;
  }
  /** Makes sure the part `id` exists (made from `content` when new) and notes `place` as one of its homes. */
  async ensure(id: string, content: LiveContent, owner: string, place: string) {
    const o = this.get(id);
    await o.ready;
    if (!o.doc.getMap('meta').get('kind')) {
      this.saveInfo({ id, kind: content.kind, title: content.title, owner, created: Date.now(), updated: Date.now(), hash: fingerprint(content), places: [place] });
      writeContent(o.doc, content);
    } else this.addPlace(id, place);
  }
  /** The part's content now (after it loaded from the device). */
  async read(id: string): Promise<LiveContent> { const o = this.get(id); await o.ready; return readContent(o.doc); }
  /** Changes the part: only what differs is written, so the copies elsewhere merge it with their own changes. */
  async write(id: string, content: LiveContent) { const o = this.get(id); await o.ready; writeContent(o.doc, content); }
  /** Calls `fn` with the new content each time the part changes, here or in another app or window. */
  watch(id: string, fn: Listener): () => void {
    const o = this.get(id);
    o.listeners.add(fn);
    return () => { o.listeners.delete(fn); };
  }
  /** Notes where a copy lives (like "letter" or "stage"), for the list of linked parts. */
  addPlace(id: string, place: string) {
    const info = this.info(id);
    if (info && !info.places.includes(place)) this.saveInfo({ ...info, places: [...info.places, place] });
  }
  /** Whether a copy with fingerprint `hash` matches the part: synced, still catching up, or different. */
  async check(id: string, hash: string): Promise<SyncState> {
    const o = this.get(id);
    await o.ready;
    const now = fingerprint(readContent(o.doc));
    return now === hash ? 'synced' : 'different';
  }
  /** Forgets a part on this device (its copies stay as plain content). */
  async remove(id: string) {
    const o = this.open.get(id);
    o?.doc.destroy();
    this.open.delete(id);
    try { localStorage.setItem(INDEX, JSON.stringify(this.list().filter(p => p.id !== id))); } catch { /* private window */ }
    if (this.persist) indexedDB.deleteDatabase(`oi1-live-${id}`);
    for (const fn of this.indexListeners) fn();
  }
}

let shared: LiveStore | null = null;
/** The one store of this window. */
export const liveStore = () => (shared ??= new LiveStore());
