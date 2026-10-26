// Outlines of Office Stage's shapes, as SVG paths in a w x h box. They follow PowerPoint's preset shapes
// (same names and default proportions), so a shape keeps its look in a .pptx.

import type { Geom } from '../../formats/slides';

const f = (n: number) => Math.round(n * 100) / 100;
const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;

function star(w: number, h: number, points: number, inner: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 ? inner : 1;
    pts.push([w / 2 + (Math.cos(a) * r * w) / 2, h / 2 + (Math.sin(a) * r * h) / 2 + (points === 5 ? h * 0.05 : 0)]);
  }
  return poly(pts);
}

export function geomPath(g: Geom, w: number, h: number): string {
  const m = Math.min(w, h);
  switch (g) {
    case 'roundRect': {
      const r = m * 0.1667;
      return `M${f(r)} 0H${f(w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)}V${f(h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(h)}H${f(r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(h - r)}V${f(r)}A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0Z`;
    }
    case 'ellipse': return `M0 ${f(h / 2)}A${f(w / 2)} ${f(h / 2)} 0 1 0 ${f(w)} ${f(h / 2)}A${f(w / 2)} ${f(h / 2)} 0 1 0 0 ${f(h / 2)}Z`;
    case 'triangle': return poly([[w / 2, 0], [w, h], [0, h]]);
    case 'rtTriangle': return poly([[0, 0], [w, h], [0, h]]);
    case 'diamond': return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'pentagon': return poly([[w / 2, 0], [w, h * 0.382], [w * 0.809, h], [w * 0.191, h], [0, h * 0.382]]);
    case 'hexagon': { const d = m * 0.25; return poly([[d, 0], [w - d, 0], [w, h / 2], [w - d, h], [d, h], [0, h / 2]]); }
    case 'octagon': { const d = m * 0.2929; return poly([[d, 0], [w - d, 0], [w, d], [w, h - d], [w - d, h], [d, h], [0, h - d], [0, d]]); }
    case 'star5': return star(w, h, 5, 0.382);
    case 'plus': { const d = m * 0.25; return poly([[d, 0], [w - d, 0], [w - d, d], [w, d], [w, h - d], [w - d, h - d], [w - d, h], [d, h], [d, h - d], [0, h - d], [0, d], [d, d]]); }
    case 'heart': {
      const P = (x: number, y: number) => `${f(x * w)} ${f(y * h)}`;
      return `M${P(0.5, 0.25)}C${P(0.5, 0.1)} ${P(0.35, 0)} ${P(0.22, 0)}C${P(0.09, 0)} ${P(0, 0.12)} ${P(0, 0.28)}C${P(0, 0.55)} ${P(0.3, 0.75)} ${P(0.5, 1)}C${P(0.7, 0.75)} ${P(1, 0.55)} ${P(1, 0.28)}C${P(1, 0.12)} ${P(0.91, 0)} ${P(0.78, 0)}C${P(0.65, 0)} ${P(0.5, 0.1)} ${P(0.5, 0.25)}Z`;
    }
    case 'rightArrow': { const hd = Math.min(h * 0.5, w); return poly([[0, h * 0.25], [w - hd, h * 0.25], [w - hd, 0], [w, h / 2], [w - hd, h], [w - hd, h * 0.75], [0, h * 0.75]]); }
    case 'leftArrow': { const hd = Math.min(h * 0.5, w); return poly([[w, h * 0.25], [hd, h * 0.25], [hd, 0], [0, h / 2], [hd, h], [hd, h * 0.75], [w, h * 0.75]]); }
    case 'upArrow': { const hd = Math.min(w * 0.5, h); return poly([[w * 0.25, h], [w * 0.25, hd], [0, hd], [w / 2, 0], [w, hd], [w * 0.75, hd], [w * 0.75, h]]); }
    case 'downArrow': { const hd = Math.min(w * 0.5, h); return poly([[w * 0.25, 0], [w * 0.75, 0], [w * 0.75, h - hd], [w, h - hd], [w / 2, h], [0, h - hd], [w * 0.25, h - hd]]); }
    case 'chevron': { const p = Math.min(h * 0.5, w); return poly([[0, 0], [w - p, 0], [w, h / 2], [w - p, h], [0, h], [p, h / 2]]); }
    case 'wedgeRoundRectCallout': {
      const r = m * 0.1667, bh = h * 0.8;
      return `M${f(r)} 0H${f(w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)}V${f(bh - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(bh)}H${f(w * 0.35)}L${f(w * 0.2)} ${f(h)}L${f(w * 0.25)} ${f(bh)}H${f(r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(bh - r)}V${f(r)}A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0Z`;
    }
    case 'line': case 'arrow': return `M0 0L${f(w)} ${f(h)}`;
    default: return `M0 0H${f(w)}V${f(h)}H0Z`;
  }
}

export const isLine = (g: Geom) => g === 'line' || g === 'arrow';

/** Where text sits inside a shape, as insets in parts of its box (callouts keep text out of the tail). */
export function textInset(g: Geom): { t: number; r: number; b: number; l: number } {
  switch (g) {
    case 'ellipse': return { t: 0.15, r: 0.15, b: 0.15, l: 0.15 };
    case 'triangle': return { t: 0.45, r: 0.25, b: 0.05, l: 0.25 };
    case 'diamond': return { t: 0.25, r: 0.25, b: 0.25, l: 0.25 };
    case 'star5': case 'heart': return { t: 0.3, r: 0.22, b: 0.2, l: 0.22 };
    case 'wedgeRoundRectCallout': return { t: 0.02, r: 0.03, b: 0.22, l: 0.03 };
    case 'rightArrow': return { t: 0.25, r: 0.25, b: 0.25, l: 0.02 };
    case 'leftArrow': return { t: 0.25, r: 0.02, b: 0.25, l: 0.25 };
    default: return { t: 0, r: 0, b: 0, l: 0 };
  }
}
