// Real pages on screen, like Word's Print Layout.
//
// The letter is one editor. After each change we measure where every paragraph, table and image lands,
// and when one would cross the bottom of a page we put a spacer in front of it. A spacer holds the rest
// of that page, its footer, the gap between pages and the next page's header, so text never runs
// into a margin. Blocks are never split, so a table taller than a page runs past its page's bottom.
//
// Footnotes sit at the bottom of the page where they are referred to: their height is kept free on that
// page, and the spacer that ends the page draws them above its bottom margin (the last page's notes are
// drawn by the letter, under the text).
//
// The same layout prints: in print the gaps become 0 and each spacer starts a new sheet of paper,
// so the PDF has the same pages, headers, footers and page numbers as the screen.

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { safeHtml } from '../../shell/safeHtml';

export interface PageLayout {
  enabled: boolean;
  /** Page height and margins in CSS pixels. */
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  gap: number;
  headerHtml: string;
  footerHtml: string;
  /** Changes whenever the header or footer changes, so spacers redraw their copies. */
  version: number;
}

/** A footnote as shown at the bottom of its page. */
export interface PageNote { n: number; text: string }

export interface Spacer {
  pos: number;
  /** Footnotes of the page that this spacer ends. */
  notes: PageNote[];
  /** Height of the part that finishes the page above, footer included. */
  foot: number;
  /** Number (from 1) of the page that this spacer ends. */
  page: number;
}

/** `notes` are the last page's footnotes. */
export interface LayoutResult { pages: number; tail: number; notes: PageNote[] }

/** Room for the short line above a page's footnotes. */
export const NOTE_RULE = 14;

interface PaginationState { spacers: Spacer[] }
export const paginationKey = new PluginKey<PaginationState>('oi1-pagination');

export interface PaginationStorage {
  layout: PageLayout;
  onLayout: (r: LayoutResult) => void;
  relayout: () => void;
}

declare module '@tiptap/core' {
  interface Storage {
    pagination: PaginationStorage;
  }
}

function cloneHf(html: string, kind: 'header' | 'footer', page: number, pages: number): HTMLElement {
  const el = document.createElement('div');
  el.className = `hf-clone ${kind}`;
  el.style.setProperty('--pn', `"${page}"`);
  el.style.setProperty('--pt', `"${pages}"`);
  el.innerHTML = safeHtml(html); // the editor's HTML, cleaned again in case it came from a file someone sent
  el.setAttribute('aria-hidden', 'true');
  return el;
}

function spacerDom(s: Spacer, layout: PageLayout, pages: number): HTMLElement {
  const root = document.createElement('div');
  root.className = 'pg-spacer';
  root.contentEditable = 'false';
  const foot = document.createElement('div');
  foot.className = 'pg-foot';
  foot.style.height = `calc(${s.foot}px - var(--pg-slack, 0px))`;
  if (layout.footerHtml) foot.append(cloneHf(layout.footerHtml, 'footer', s.page, pages));
  const gap = document.createElement('div');
  gap.className = 'pg-gap';
  const head = document.createElement('div');
  head.className = 'pg-head';
  head.style.height = `${layout.marginTop}px`;
  if (layout.headerHtml) head.append(cloneHf(layout.headerHtml, 'header', s.page + 1, pages));
  if (s.notes.length) foot.append(notesDom(s.notes));
  root.append(foot, gap, head);
  return root;
}

/** The footnotes at the bottom of a page. */
export function notesDom(notes: PageNote[]): HTMLElement {
  const area = document.createElement('div');
  area.className = 'pg-notes';
  for (const note of notes) area.append(noteDom(note));
  return area;
}

function noteDom(note: PageNote): HTMLElement {
  const el = document.createElement('div');
  el.className = 'fn-note';
  const sup = document.createElement('sup');
  sup.textContent = String(note.n);
  el.append(sup, ` ${note.text}`);
  return el;
}

/** Works out where the spacers go from the blocks' measured positions. */
export interface Block {
  pos: number; top: number; height: number; marginTop: number; marginBottom: number; isBreak: boolean;
  /** Footnotes referred to in this block, with the height each takes at the page bottom. */
  notes?: (PageNote & { h: number })[];
}

export function computeSpacers(blocks: Block[], layout: PageLayout): { spacers: Spacer[]; result: LayoutResult } {
  const pageStep = layout.pageHeight + layout.gap;
  const contentHeight = Math.max(layout.pageHeight - layout.marginTop - layout.marginBottom, 48);
  const contentTop = (p: number) => p * pageStep;
  const contentBottom = (p: number) => contentTop(p) + contentHeight;
  const spacers: Spacer[] = [];
  let shift = 0;
  let page = 0;
  let forced = false;
  let end = 0;
  let notes: PageNote[] = [];
  let notesHeight = 0;
  for (const b of blocks) {
    const start = b.top - b.marginTop + shift; // where this block's space begins
    const bottom = b.top + shift + b.height;
    const firstOnPage = start <= contentTop(page) + 1;
    const own = (b.notes ?? []).reduce((h, n) => h + n.h, 0);
    // The block's own notes must fit on its page too, with the line above them.
    const reserve = notesHeight + own > 0 ? notesHeight + own + NOTE_RULE : 0;
    if (forced || (bottom + reserve > contentBottom(page) + 0.5 && !firstOnPage)) {
      const height = contentTop(page + 1) - start;
      spacers.push({ pos: b.pos, foot: contentBottom(page) + layout.marginBottom - start, page: page + 1, notes });
      notes = [];
      notesHeight = 0;
      shift += height;
      page += 1;
    }
    const newBottom = b.top + shift + b.height;
    while (newBottom > contentBottom(page) + 0.5) page += 1; // a block taller than a page runs on, and its notes go to its last page
    for (const n of b.notes ?? []) notes.push({ n: n.n, text: n.text });
    notesHeight += own;
    forced = b.isBreak;
    end = newBottom + b.marginBottom;
  }
  const tail = Math.max(contentBottom(page) - end, 0) + layout.marginBottom;
  return { spacers, result: { pages: page + 1, tail, notes } };
}

/** How tall each footnote is at the bottom of a page, measured in a hidden copy of the notes area. */
function noteHeights(view: EditorView, notes: PageNote[]): number[] {
  if (!notes.length) return [];
  const host = view.dom.parentElement ?? view.dom;
  let probe = host.querySelector<HTMLElement>(':scope > .pg-notes.probe');
  if (!probe) {
    probe = document.createElement('div');
    probe.className = 'pg-notes probe doc-text';
    probe.setAttribute('aria-hidden', 'true');
    host.append(probe);
  }
  probe.style.width = `${view.dom.clientWidth}px`;
  probe.replaceChildren(...notes.map(noteDom));
  const heights = [...probe.children].map(el => {
    const cs = getComputedStyle(el);
    return (el as HTMLElement).offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
  });
  probe.replaceChildren();
  return heights;
}

function measure(view: EditorView): Block[] {
  const blocks: Block[] = [];
  const allNotes: PageNote[] = [];
  const notesOf = new Map<number, PageNote[]>();
  const spacerHeights = [...view.dom.querySelectorAll<HTMLElement>(':scope > .pg-spacer')].map(el => el.offsetHeight);
  // Natural position = measured position minus the spacers above it.
  let removed = 0;
  let spacerIndex = 0;
  const spacers = paginationKey.getState(view.state)?.spacers ?? [];
  view.state.doc.forEach((node, offset) => {
    while (spacerIndex < spacers.length && spacers[spacerIndex].pos <= offset) {
      removed += spacerHeights[spacerIndex] ?? 0;
      spacerIndex++;
    }
    const dom = view.nodeDOM(offset) as HTMLElement | null;
    if (!dom || !(dom instanceof HTMLElement)) return;
    const cs = getComputedStyle(dom);
    const mine: PageNote[] = [];
    node.descendants(child => {
      if (child.type.name === 'footnote') mine.push({ n: allNotes.length + mine.length + 1, text: String(child.attrs.text ?? '') });
      return !child.isInline;
    });
    allNotes.push(...mine);
    if (mine.length) notesOf.set(blocks.length, mine);
    blocks.push({
      pos: offset,
      top: dom.offsetTop - removed,
      height: dom.offsetHeight,
      marginTop: parseFloat(cs.marginTop) || 0,
      marginBottom: parseFloat(cs.marginBottom) || 0,
      isBreak: node.type.name === 'pageBreak',
    });
  });
  const heights = noteHeights(view, allNotes);
  for (const [i, notes] of notesOf) blocks[i].notes = notes.map(n => ({ ...n, h: heights[n.n - 1] ?? 0 }));
  return blocks;
}

function same(a: Spacer[], b: Spacer[]): boolean {
  return a.length === b.length && a.every((s, i) => s.pos === b[i].pos && s.page === b[i].page && Math.abs(s.foot - b[i].foot) < 0.5
    && notesKey(s.notes) === notesKey(b[i].notes));
}

function notesKey(notes: PageNote[]): string {
  return notes.map(n => `${n.n}:${n.text}`).join('\u0001');
}

export const Pagination = Extension.create<object, PaginationStorage>({
  name: 'pagination',

  addStorage() {
    return {
      layout: { enabled: false, pageHeight: 1056, marginTop: 96, marginBottom: 96, gap: 24, headerHtml: '', footerHtml: '', version: 0 },
      onLayout: () => {},
      relayout: () => {},
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    let pages = 1;
    let drawnVersion = -1;
    return [new Plugin<PaginationState>({
      key: paginationKey,
      state: {
        init: () => ({ spacers: [] }),
        apply(tr, prev) {
          const meta = tr.getMeta(paginationKey) as PaginationState | undefined;
          if (meta) return meta;
          if (!tr.docChanged) return prev;
          // Keep spacers in place while the next measurement runs.
          return { spacers: prev.spacers.map(s => ({ ...s, pos: tr.mapping.map(s.pos, -1) })) };
        },
      },
      props: {
        decorations(state) {
          const s = paginationKey.getState(state);
          const layout = storage.layout;
          if (!layout.enabled || !s?.spacers.length) return null;
          return DecorationSet.create(state.doc, s.spacers
            .filter(sp => sp.pos <= state.doc.content.size)
            .map(sp => Decoration.widget(sp.pos, () => spacerDom(sp, layout, pages), {
              side: -1,
              ignoreSelection: true,
              stopEvent: () => true,
              key: `pg:${sp.page}:${Math.round(sp.foot * 10)}:${pages}:${layout.version}:${notesKey(sp.notes)}`,
            })));
        },
      },
      view(view) {
        let timer = 0;
        const run = () => {
          timer = 0;
          if (view.isDestroyed || !view.dom.offsetParent) return; // hidden tab: measure when shown
          const layout = storage.layout;
          if (!layout.enabled) {
            if (paginationKey.getState(view.state)?.spacers.length) view.dispatch(view.state.tr.setMeta(paginationKey, { spacers: [] }).setMeta('addToHistory', false));
            storage.onLayout({ pages: 1, tail: 0, notes: [] });
            return;
          }
          const { spacers, result } = computeSpacers(measure(view), layout);
          const old = paginationKey.getState(view.state)?.spacers ?? [];
          const redraw = result.pages !== pages || drawnVersion !== layout.version;
          pages = result.pages;
          drawnVersion = layout.version;
          if (!same(old, spacers) || redraw) {
            view.dispatch(view.state.tr.setMeta(paginationKey, { spacers }).setMeta('addToHistory', false));
          }
          storage.onLayout(result);
        };
        const schedule = () => { if (!timer) timer = window.setTimeout(run, 30); };
        storage.relayout = schedule;
        view.dom.addEventListener('load', schedule, true); // images
        document.fonts?.addEventListener?.('loadingdone', schedule);
        void document.fonts?.ready.then(schedule);
        schedule();
        return {
          update(v, prev) { if (v.state.doc !== prev.doc) schedule(); },
          destroy() {
            clearTimeout(timer);
            view.dom.removeEventListener('load', schedule, true);
            document.fonts?.removeEventListener?.('loadingdone', schedule);
          },
        };
      },
    })];
  },
});
