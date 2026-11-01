// Ready-made pieces for In 1 Stage's Insert tab: diagrams (steps, cycle, timeline, pyramid, grid) built from a
// list of points, WordArt titles, slide numbers and footers. They are made of ordinary shapes and text boxes, so
// they can be edited, moved and saved in a .pptx like anything else.

import { newId, type Deck, type Item, type ShapeItem } from '../../formats/slides';

export type DiagramKind = 'process' | 'cycle' | 'timeline' | 'pyramid' | 'grid';
export const DIAGRAMS: DiagramKind[] = ['process', 'cycle', 'timeline', 'pyramid', 'grid'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const para = (text: string, pt?: number) => `<p>${pt ? `<span style="font-size: ${pt}pt">${esc(text)}</span>` : esc(text)}</p>`;

function box(geom: ShapeItem['geom'], x: number, y: number, w: number, h: number, fill: string | null, text = '', pt?: number, name?: string): ShapeItem {
  return {
    id: newId(), kind: 'shape', geom, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h),
    fill, line: null, html: text ? para(text, pt) : '<p></p>', valign: 'middle', autofit: true, name,
  };
}

/** A diagram of `points` (2 to 8) in the slide's content area, colored with the theme's accents. */
export function diagramItems(kind: DiagramKind, points: string[], deck: Pick<Deck, 'w' | 'h' | 'theme'>): Item[] {
  const pts = points.map(p => p.trim()).filter(Boolean).slice(0, 8);
  while (pts.length < 3) pts.push(`${pts.length + 1}`);
  const n = pts.length;
  const acc = deck.theme.accents;
  const color = (i: number) => acc[i % acc.length];
  // The area under a title, like the content layout's body.
  const X = deck.w * 0.07, Y = deck.h * 0.27, W = deck.w * 0.86, H = deck.h * 0.64;
  const pt = n > 5 ? 14 : 18;
  const name = (i: number) => `Diagram ${kind} ${i + 1}`;
  const out: Item[] = [];

  if (kind === 'process') {
    const gap = W * 0.01, w = (W - gap * (n - 1)) / n, h = Math.min(H * 0.45, 170);
    pts.forEach((p, i) => out.push(box('chevron', X + i * (w + gap), Y + (H - h) / 2, w + (i < n - 1 ? w * 0.12 : 0), h, color(i), p, pt, name(i))));
  } else if (kind === 'cycle') {
    const cx = X + W / 2, cy = Y + H / 2, r = Math.min(W, H) * 0.36;
    const w = Math.min(230, (2 * Math.PI * r) / n * 0.8), h = Math.min(110, w * 0.5);
    out.push({ id: newId(), kind: 'shape', geom: 'ellipse', x: Math.round(cx - r), y: Math.round(cy - r), w: Math.round(2 * r), h: Math.round(2 * r), fill: null, line: { color: color(0), width: 2.25, dash: 'dash' }, html: '<p></p>', name: `Diagram ${kind} ring` });
    pts.forEach((p, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      out.push(box('roundRect', cx + Math.cos(a) * r - w / 2, cy + Math.sin(a) * r - h / 2, w, h, color(i), p, pt, name(i)));
    });
  } else if (kind === 'timeline') {
    const y = Y + H / 2, step = W / n, dot = 26, tw = Math.min(step * 0.92, 240), th = H * 0.36;
    out.push({ id: newId(), kind: 'shape', geom: 'line', x: Math.round(X), y: Math.round(y), w: Math.round(W), h: 0, line: { color: color(0), width: 3 }, html: '', name: `Diagram ${kind} line` });
    pts.forEach((p, i) => {
      const cx = X + step * (i + 0.5);
      out.push(box('ellipse', cx - dot / 2, y - dot / 2, dot, dot, color(i), '', undefined, `${name(i)} dot`));
      const t = box('rect', cx - tw / 2, i % 2 ? y + dot : y - dot - th, tw, th, null, p, pt, name(i));
      t.valign = i % 2 ? 'top' : 'bottom';
      out.push(t);
    });
  } else if (kind === 'pyramid') {
    const levels = pts.slice(0, 6), m = levels.length, gap = 6, h = (H - gap * (m - 1)) / m;
    levels.forEach((p, i) => {
      const w = W * 0.3 + (W * 0.6 * (i + 1)) / m;
      out.push(box(i ? 'rect' : 'triangle', X + (W - w) / 2, Y + i * (h + gap), w, h, color(i), p, pt, name(i)));
    });
  } else {
    const cols = n <= 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols), gap = 16;
    const w = (W - gap * (cols - 1)) / cols, h = (H - gap * (rows - 1)) / rows;
    pts.forEach((p, i) => out.push(box('roundRect', X + (i % cols) * (w + gap), Y + Math.floor(i / cols) * (h + gap), w, h, color(i), p, pt, name(i))));
  }
  return out;
}

export type WordArtStyle = 'bold' | 'elegant' | 'script' | 'marker' | 'stencil' | 'retro';
export const WORDART: { id: WordArtStyle; font: string; pt: number; accent: number; upper?: boolean }[] = [
  { id: 'bold', font: 'Archivo Black', pt: 60, accent: 0 },
  { id: 'elegant', font: 'Playfair Display', pt: 60, accent: 1 },
  { id: 'script', font: 'Great Vibes', pt: 72, accent: 2 },
  { id: 'marker', font: 'Permanent Marker', pt: 60, accent: 3 },
  { id: 'stencil', font: 'Bebas Neue', pt: 80, accent: 0, upper: true },
  { id: 'retro', font: 'Abril Fatface', pt: 64, accent: 4 },
];

/** A big styled title in a text box, centered on the slide. */
export function wordArtItem(style: WordArtStyle, text: string, deck: Pick<Deck, 'w' | 'h' | 'theme'>): ShapeItem {
  const s = WORDART.find(x => x.id === style) ?? WORDART[0];
  const words = s.upper ? text.toUpperCase() : text;
  const color = deck.theme.accents[s.accent % deck.theme.accents.length];
  const w = deck.w * 0.8, h = s.pt * 2.2;
  return {
    id: newId(), kind: 'shape', geom: 'rect', x: Math.round((deck.w - w) / 2), y: Math.round((deck.h - h) / 2), w: Math.round(w), h: Math.round(h),
    fill: null, line: null, valign: 'middle', name: 'WordArt',
    html: `<p style="text-align: center"><span style="font-family: ${s.font}; font-size: ${s.pt}pt; color: ${color}"><strong>${esc(words)}</strong></span></p>`,
  };
}

/** The slide number box at the bottom right, named so it can be found and updated. */
export function slideNumberItem(n: number, deck: Pick<Deck, 'w' | 'h'>): ShapeItem {
  return {
    id: newId(), kind: 'shape', geom: 'rect', x: deck.w - 140, y: deck.h - 56, w: 100, h: 36, fill: null, line: null, valign: 'middle', name: 'Slide number',
    html: `<p style="text-align: right"><span style="font-size: 12pt">${n}</span></p>`,
  };
}

/** A footer line at the bottom left, the same on every slide. */
export function footerItem(text: string, deck: Pick<Deck, 'w' | 'h'>): ShapeItem {
  return {
    id: newId(), kind: 'shape', geom: 'rect', x: 40, y: deck.h - 56, w: deck.w * 0.6, h: 36, fill: null, line: null, valign: 'middle', name: 'Footer',
    html: `<p><span style="font-size: 12pt">${esc(text)}</span></p>`,
  };
}
