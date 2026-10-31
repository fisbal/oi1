// Word tab stops in Letter: a paragraph with stops ("l144,c288,r468", in points) lines its tabs up at them, left,
// centered, right or on the decimal point, like Word. Each tab character gets a width measured after layout; tabs
// past the last stop, and paragraphs without stops, keep the default 0.5" grid.

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';

const PX_PER_PT = 96 / 72;
const GRID = 36; // pt
export interface Stop { kind: 'l' | 'c' | 'r' | 'd'; pos: number }

export function parseStops(v: string | null | undefined): Stop[] {
  if (!v) return [];
  return v.split(',').map(s => /^([lcrd])(\d+(?:\.\d+)?)$/.exec(s.trim())).filter((m): m is RegExpExecArray => !!m)
    .map(m => ({ kind: m[1] as Stop['kind'], pos: Number(m[2]) })).sort((a, b) => a.pos - b.pos);
}

/** The width (pt) a tab at x needs to reach its stop; seg is the width of the text after it, up to the next tab. */
export function tabWidth(x: number, stops: Stop[], seg: number, segToDot = seg): number {
  const stop = stops.find(s => s.pos > x + 0.5);
  if (!stop) return Math.max(GRID - (x % GRID), 1);
  const w = stop.kind === 'c' ? stop.pos - seg / 2 - x : stop.kind === 'r' ? stop.pos - seg - x : stop.kind === 'd' ? stop.pos - segToDot - x : stop.pos - x;
  return Math.max(w, 1);
}

interface TabState { decos: DecorationSet; widths: Map<number, number> }
const key = new PluginKey<TabState>('tabStops');

function decorate(doc: PmNode, widths: Map<number, number>): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (!node.attrs.tabStops) return false;
    node.descendants((child, off) => {
      if (!child.isText || !child.text?.includes('\t')) return;
      for (let i = 0; i < child.text.length; i++) {
        if (child.text[i] !== '\t') continue;
        const at = pos + 1 + off + i;
        const w = widths.get(at);
        decos.push(Decoration.inline(at, at + 1, { class: 'tab-x', 'data-at': String(at), ...(w !== undefined ? { style: `width: ${w.toFixed(2)}px` } : {}) }));
      }
    });
    return false;
  });
  return DecorationSet.create(doc, decos);
}

/** Works out each tab's width (px, unscaled), paragraph by paragraph, from the current layout. */
export function measureTabs(root: HTMLElement): Map<number, number> {
  const out = new Map<number, number>();
  for (const para of root.querySelectorAll<HTMLElement>('[data-tabs]')) {
    // On a narrow screen (phone reading view) a stop past the end of the line falls back to the grid.
    const room = (para.offsetWidth + (parseFloat(getComputedStyle(para).marginLeft) || 0)) / PX_PER_PT;
    const stops = parseStops(para.getAttribute('data-tabs')).filter(st => st.pos <= room + 1);
    const tabs = [...para.querySelectorAll<HTMLElement>('.tab-x')];
    if (!tabs.length) continue;
    const box = para.getBoundingClientRect();
    const scale = para.offsetWidth ? box.width / para.offsetWidth : 1;
    // Word measures stops from the page margin, so the paragraph's own left indent counts.
    const left = box.left - (parseFloat(getComputedStyle(para).marginLeft) || 0) * scale;
    let shift = 0; // how much the tabs before this one grow or shrink (same line)
    let lineTop = NaN;
    tabs.forEach((t, i) => {
      const rect = t.getBoundingClientRect();
      if (Math.abs(rect.top - lineTop) > 2) { shift = 0; lineTop = rect.top; }
      const x = ((rect.left - left) / scale + shift) / PX_PER_PT;
      const r = document.createRange();
      r.setStartAfter(t);
      if (tabs[i + 1]) r.setEndBefore(tabs[i + 1]); else r.setEnd(para, para.childNodes.length);
      const seg = r.getBoundingClientRect().width / scale / PX_PER_PT;
      let toDot = seg;
      const dot = r.toString().search(/[.,]\d/);
      const tn = dot >= 0 ? firstText(r) : null;
      if (tn) {
        const d = document.createRange();
        d.setStart(tn, 0);
        d.setEnd(tn, Math.min(dot, tn.length));
        toDot = d.getBoundingClientRect().width / scale / PX_PER_PT;
      }
      const w = tabWidth(x, stops, seg, toDot) * PX_PER_PT;
      shift += w - rect.width / scale;
      out.set(Number(t.dataset.at), w);
    });
  }
  return out;
}

function firstText(r: Range): Text | null {
  const walker = document.createTreeWalker(r.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (r.intersectsNode(n) && n.textContent && n.textContent !== '\t') return n as Text;
  return null;
}

const same = (a: Map<number, number>, b: Map<number, number>) =>
  a.size === b.size && [...a].every(([k, v]) => Math.abs((b.get(k) ?? -99) - v) < 0.5);

export const TabStops = Extension.create({
  name: 'tabStops',
  addProseMirrorPlugins() {
    let frame = 0;
    // New widths can move text to another line, so it measures again until nothing moves (at most 4 rounds).
    const schedule = (view: EditorView, round = 0) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (view.isDestroyed) return;
        const widths = measureTabs(view.dom as HTMLElement);
        const now = key.getState(view.state)?.widths;
        if (now && !same(widths, now)) {
          view.dispatch(view.state.tr.setMeta(key, widths).setMeta('addToHistory', false));
          if (round < 3) schedule(view, round + 1);
        }
      });
    };
    return [new Plugin<TabState>({
      key,
      state: {
        init: (_, { doc }) => ({ decos: decorate(doc, new Map()), widths: new Map() }),
        apply: (tr, old) => {
          const measured = tr.getMeta(key) as Map<number, number> | undefined;
          if (measured) return { decos: decorate(tr.doc, measured), widths: measured };
          if (!tr.docChanged) return old;
          // Keep the old widths at their new places until the next measure.
          const widths = new Map<number, number>();
          for (const [at, w] of old.widths) { const m = tr.mapping.mapResult(at); if (!m.deleted) widths.set(m.pos, w); }
          return { decos: decorate(tr.doc, widths), widths };
        },
      },
      props: { decorations: state => key.getState(state)?.decos },
      view: view => {
        schedule(view);
        // Fonts arriving later change widths.
        document.fonts?.ready.then(() => schedule(view)).catch(() => {});
        // A new width (phone turned, window resized, page size changed) moves the stops that fit.
        let lastW = 0;
        const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
          const w = (view.dom as HTMLElement).offsetWidth;
          if (Math.abs(w - lastW) > 1) { lastW = w; schedule(view); }
        });
        ro?.observe(view.dom as HTMLElement);
        return {
          update: (v, prev) => { if (v.state.doc !== prev.doc || !key.getState(prev)) schedule(v); },
          destroy: () => { cancelAnimationFrame(frame); ro?.disconnect(); },
        };
      },
    })];
  },
});
