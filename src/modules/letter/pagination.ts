// Real pages on screen, like Word's Print Layout.
//
// The letter is one editor. After each change we measure where every paragraph, table and image lands,
// and when one would cross the bottom of a page we put a spacer in front of it. A spacer holds the rest
// of that page, its footer, the gap between pages and the next page's header, so text never runs
// into a margin. A paragraph that does not fit is cut between two lines, like Word: the spacer then sits inside
// the paragraph, on a line of its own, and at least two lines stay on each page (no orphan, no widow). Tables and
// pictures are never cut, so a table taller than a page runs past its page's bottom.
//
// Footnotes sit at the bottom of the page where they are referred to: their height is kept free on that
// page, and the spacer that ends the page draws them above its bottom margin (the last page's notes are
// drawn by the letter, under the text).
//
// The same layout prints: in print the gaps become 0 and each spacer starts a new sheet of paper,
// so the PDF has the same pages, headers, footers and page numbers as the screen.

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
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
  /** Inside a paragraph cut between two pages (at the start of the first line of the next page). */
  inline?: boolean;
  /** For a cut paragraph: where the paragraph starts, and the part of it the spacer takes (from its top, in px),
   *  so its change bar stops at the end of the page and starts again on the next one. */
  block?: number;
  gapFrom?: number;
  gapTo?: number;
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
  // Inside a paragraph the spacer is a span on a line of its own (the line above it stays justified).
  const root = document.createElement(s.inline ? 'span' : 'div');
  root.className = s.inline ? 'pg-spacer pg-inline' : 'pg-spacer';
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
  /** A title (or a "Tableau 1" caption) stays on the page of what follows it, like LaTeX and Word's "keep with next". */
  keepNext?: boolean;
  /** Footnotes referred to in this block, with the height each takes at the page bottom. */
  notes?: (PageNote & { h: number })[];
  /** A paragraph's lines (natural top and bottom of the letters), so it can be cut between two of them. */
  lines?: { top: number; bottom: number }[];
  /** Where line `i` starts in the document. */
  linePos?: (i: number) => number | null;
}

/** Lines that stay together at the bottom and at the top of a page (Word's widow and orphan control). */
const KEEP_LINES = 2;
/** Top of line `k`'s box: halfway between the letters of the line above and its own. */
const lineTop = (lines: { top: number; bottom: number }[], k: number) => (lines[k - 1].bottom + lines[k].top) / 2;

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
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const start = b.top - b.marginTop + shift; // where this block's space begins
    let bottom = b.top + shift + b.height;
    const firstOnPage = start <= contentTop(page) + 1;
    // A title alone at the bottom of a page goes to the next page with the paragraph it introduces
    // (when that paragraph fits on a page; a chain of titles moves together).
    if (b.keepNext && !firstOnPage && !forced) {
      let j = i;
      while (blocks[j]?.keepNext && blocks[j + 1]) j++;
      const next = blocks[j];
      const nl = next?.lines;
      if (next && next !== b && !next.isBreak && nl && nl.length > KEEP_LINES && next.linePos) bottom = Math.max(bottom, nl[KEEP_LINES - 1].bottom + shift);
      else if (next && next !== b && !next.isBreak && next.height < contentHeight / 2) bottom = Math.max(bottom, next.top + shift + Math.min(next.height, 3 * 24));
    }
    const own = (b.notes ?? []).reduce((h, n) => h + n.h, 0);
    // The block's own notes must fit on its page too, with the line above them.
    const reserve = notesHeight + own > 0 ? notesHeight + own + NOTE_RULE : 0;
    // A long paragraph is cut where the page ends, when two lines or more fit (and two or more go on).
    const lines = b.linePos ? b.lines : undefined;
    const n = lines?.length ?? 0;
    const fit = lines ? lines.filter(l => l.bottom + shift + reserve <= contentBottom(page) + 0.5).length : 0;
    const cut = !forced && !b.keepNext && n >= 2 * KEEP_LINES && fit >= KEEP_LINES && start > contentTop(page) - 1;
    if (forced || (bottom + reserve > contentBottom(page) + 0.5 && !firstOnPage && !cut)) {
      const height = contentTop(page + 1) - start;
      spacers.push({ pos: b.pos, foot: contentBottom(page) + layout.marginBottom - start, page: page + 1, notes });
      notes = [];
      notesHeight = 0;
      shift += height;
      page += 1;
    }
    // Cut the paragraph as many times as it needs (a paragraph longer than a page goes over several).
    let from = 0;
    const blockTop = b.top + shift; // the paragraph's top once drawn
    while (lines && n >= 2 && b.top + shift + b.height + (from ? 0 : reserve) > contentBottom(page) + 0.5) {
      let k = lines.findIndex((l, i) => i > from && l.bottom + shift + (from ? 0 : reserve) > contentBottom(page) + 0.5);
      if (k < 0) break;
      const atTop = lines[from].top + shift <= contentTop(page) + 48;
      if (n - k < KEEP_LINES && n >= 2 * KEEP_LINES) k = Math.max(n - KEEP_LINES, from + 1); // no widow
      if (k - from < KEEP_LINES && !atTop) break; // no orphan: the spacer above already moved it
      const pos = b.linePos!(k);
      if (pos == null || k <= from) break;
      const y = lineTop(lines, k) + shift;
      spacers.push({ pos, foot: contentBottom(page) + layout.marginBottom - y, page: page + 1, notes, inline: true,
        block: b.pos, gapFrom: y - blockTop, gapTo: contentTop(page + 1) - blockTop });
      notes = [];
      notesHeight = 0;
      shift += contentTop(page + 1) - y;
      page += 1;
      from = k;
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

/** The lines of a paragraph (from its letters, not counting the spacers drawn in it) and where each starts. */
function linesOf(view: EditorView, dom: HTMLElement, y: (r: { top: number }) => number, natural: (at: number) => number, scale: number): Pick<Block, 'lines' | 'linePos'> {
  const lines: { top: number; bottom: number; node: Text; first: boolean; ft: number }[] = [];
  const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement?.closest('.pg-spacer, [contenteditable="false"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const range = document.createRange();
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
    if (!t.data.length) continue;
    range.selectNodeContents(t);
    let first = true;
    for (const r of range.getClientRects()) {
      if (r.height < 2) continue;
      const top = natural(y(r));
      const bottom = top + r.height / scale;
      const last = lines[lines.length - 1];
      if (last && top < last.bottom - 2) { last.top = Math.min(last.top, top); last.bottom = Math.max(last.bottom, bottom); }
      else lines.push({ top, bottom, node: t, first, ft: r.top });
      first = false;
    }
  }
  if (lines.length < 2) return {};
  const linePos = (i: number): number | null => {
    const l = lines[i];
    if (!l) return null;
    let off = 0;
    if (!l.first) {
      // The first letter of this line inside its text: the first whose box is on this line.
      let lo = 0, hi = l.node.data.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        range.setStart(l.node, mid);
        range.setEnd(l.node, mid + 1);
        const r = [...range.getClientRects()].pop();
        if (r && r.top >= l.ft - 1) hi = mid; else lo = mid + 1;
      }
      off = lo;
    }
    try { return view.posAtDOM(l.node, off); } catch { return null; }
  };
  return { lines: lines.map(({ top, bottom }) => ({ top, bottom })), linePos };
}

function measure(view: EditorView): Block[] {
  const blocks: Block[] = [];
  const allNotes: PageNote[] = [];
  const notesOf = new Map<number, PageNote[]>();
  const root = view.dom;
  const rootRect = root.getBoundingClientRect();
  const scale = root.offsetHeight ? rootRect.height / root.offsetHeight || 1 : 1;
  const y = (r: { top: number }) => (r.top - rootRect.top) / scale; // from the top of the text, without zoom
  // Every spacer on screen (between blocks, or inside a cut paragraph), with where it starts and how tall it is.
  const drawn = [...root.querySelectorAll<HTMLElement>('.pg-spacer')].map(el => ({ el, top: y(el.getBoundingClientRect()), h: el.offsetHeight }));
  // Natural position = measured position minus the spacers above it.
  const natural = (at: number) => at - drawn.reduce((sum, d) => sum + (d.top < at - 0.5 ? d.h : 0), 0);
  const inside = (el: HTMLElement) => drawn.filter(d => el.contains(d.el)).reduce((sum, d) => sum + d.h, 0);
  view.state.doc.forEach((node, offset) => {
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
    const top = natural(y(dom.getBoundingClientRect()));
    const block: Block = {
      pos: offset,
      top,
      height: dom.offsetHeight - inside(dom),
      marginTop: parseFloat(cs.marginTop) || 0,
      marginBottom: parseFloat(cs.marginBottom) || 0,
      isBreak: node.type.name === 'pageBreak',
      keepNext: node.type.name === 'heading' && !!node.textContent.trim()
        || node.type.name === 'paragraph' && /^(?:tableau|table|figure|graphique|fig\.)\s+\d+/i.test(node.textContent.trim()) && node.textContent.length < 200,
    };
    // A paragraph of four lines or more can be cut between two pages: find its lines.
    if (node.type.name === 'paragraph' && block.height > 3.5 * (parseFloat(cs.lineHeight) || 20)) Object.assign(block, linesOf(view, dom, y, natural, scale));
    blocks.push(block);
  });
  const heights = noteHeights(view, allNotes);
  for (const [i, notes] of notesOf) blocks[i].notes = notes.map(n => ({ ...n, h: heights[n.n - 1] ?? 0 }));
  return blocks;
}

/** A cut paragraph's change bar (Word's line in the margin) has a hole where the page ends and the next begins. */
function cutBars(doc: PMNode, spacers: Spacer[]): Decoration[] {
  const holes = new Map<number, [number, number][]>();
  for (const sp of spacers) if (sp.block != null && sp.gapTo != null) holes.set(sp.block, [...(holes.get(sp.block) ?? []), [sp.gapFrom ?? 0, sp.gapTo]]);
  const out: Decoration[] = [];
  for (const [pos, list] of holes) {
    const node = pos < doc.content.size ? doc.nodeAt(pos) : null;
    if (!node) continue;
    const bar = 'var(--rev-bar, #8A8A8A)';
    const stops = list.map(([a, z]) => `${bar} ${a.toFixed(1)}px, transparent ${a.toFixed(1)}px ${z.toFixed(1)}px, ${bar} ${z.toFixed(1)}px`).join(', ');
    out.push(Decoration.node(pos, pos + node.nodeSize, { style: `--pg-bar: linear-gradient(${bar} 0, ${stops})` }));
  }
  return out;
}

function same(a: Spacer[], b: Spacer[]): boolean {
  return a.length === b.length && a.every((s, i) => s.pos === b[i].pos && s.page === b[i].page && Math.abs((s.gapFrom ?? 0) - (b[i].gapFrom ?? 0)) < 0.5 && !!s.inline === !!b[i].inline && Math.abs(s.foot - b[i].foot) < 0.5
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
          return DecorationSet.create(state.doc, [...cutBars(state.doc, s.spacers), ...s.spacers
            .filter(sp => sp.pos <= state.doc.content.size)
            .map(sp => Decoration.widget(sp.pos, () => spacerDom(sp, layout, pages), {
              side: -1,
              ignoreSelection: true,
              stopEvent: () => true,
              key: `pg:${sp.inline ? 'i' : 'b'}:${sp.page}:${Math.round(sp.foot * 10)}:${pages}:${layout.version}:${notesKey(sp.notes)}`,
            }))]);
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
