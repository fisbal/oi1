// Office Draw's drawings: shapes on a page, kept as plain data and drawn as SVG. A drawing saves as an .svg file
// any app can show, with its own data inside (<metadata>) so Office Draw opens it again with every shape editable.

import type { Geom } from '../../formats/slides';
import { geomPath } from '../stage/geom';

export type Dash = 'solid' | 'dash' | 'dot';
export interface Style {
  /** Inside colour; null: none. */
  fill: string | null;
  /** Outline or line colour; null: none. */
  stroke: string | null;
  /** Outline thickness, in px of the page. */
  width: number;
  dash: Dash;
  /** 0 to 1. */
  opacity: number;
}

interface Base extends Style { id: string; name?: string; locked?: boolean; hidden?: boolean }
/** A shape in a box: rectangle, ellipse, star, arrow… (the same 20 shapes as Office Stage). */
export interface GeomShape extends Base { kind: 'geom'; geom: Geom; x: number; y: number; w: number; h: number; rot: number; text?: string; textColor?: string }
/** A free hand line: points x0,y0,x1,y1… on the page. */
export interface PathShape extends Base { kind: 'path'; points: number[]; marker?: boolean }
/** A straight line from (x1,y1) to (x2,y2), with an arrow head at the end or both. */
export interface LineShape extends Base { kind: 'line'; x1: number; y1: number; x2: number; y2: number; head: 'none' | 'end' | 'both' }
export interface TextShape extends Base { kind: 'text'; x: number; y: number; w: number; h: number; rot: number; text: string; font: string; size: number; bold: boolean; italic: boolean; align: 'left' | 'center' | 'right' }
export interface ImageShape extends Base { kind: 'image'; x: number; y: number; w: number; h: number; rot: number; src: string }
export type Shape = GeomShape | PathShape | LineShape | TextShape | ImageShape;
export type BoxShape = GeomShape | TextShape | ImageShape;

export interface Drawing { w: number; h: number; background: string; paper: PaperId; shapes: Shape[] }

export interface Box { x: number; y: number; w: number; h: number }

let counter = 0;
export const newId = () => `d${Date.now().toString(36)}${(counter++).toString(36)}`;
export const isBox = (s: Shape): s is BoxShape => s.kind === 'geom' || s.kind === 'text' || s.kind === 'image';

export const DEFAULT_STYLE: Style = { fill: '#F6D365', stroke: '#2B2D42', width: 3, dash: 'solid', opacity: 1 };

// ---------- choices (every list has at least 20, like Martin asks for every app) ----------

/** Page sizes, in px at 96 per inch. */
export const SIZES: { id: string; w: number; h: number }[] = [
  { id: 'wide', w: 1600, h: 900 }, { id: 'square', w: 1200, h: 1200 }, { id: 'a4p', w: 794, h: 1123 }, { id: 'a4l', w: 1123, h: 794 },
  { id: 'a3l', w: 1587, h: 1123 }, { id: 'letterP', w: 816, h: 1056 }, { id: 'letterL', w: 1056, h: 816 }, { id: 'legal', w: 816, h: 1344 },
  { id: 'a5', w: 559, h: 794 }, { id: 'postcard', w: 576, h: 384 }, { id: 'card', w: 336, h: 192 }, { id: 'poster', w: 1728, h: 2592 },
  { id: 'instaPost', w: 1080, h: 1080 }, { id: 'instaStory', w: 1080, h: 1920 }, { id: 'fbCover', w: 1640, h: 624 }, { id: 'ytThumb', w: 1280, h: 720 },
  { id: 'linkedin', w: 1584, h: 396 }, { id: 'xPost', w: 1600, h: 900 }, { id: 'phone', w: 1170, h: 2532 }, { id: 'desktop', w: 1920, h: 1080 },
  { id: 'icon', w: 512, h: 512 }, { id: 'banner', w: 1456, h: 180 }, { id: 'whiteboard', w: 3000, h: 2000 },
];

export type PaperId = 'plain' | 'grid' | 'dots' | 'lines' | 'iso' | 'graph' | 'music' | 'blueprint' | 'chalk' | 'kraft' | 'cornell' | 'hex' | 'cross' | 'diag' | 'smallGrid' | 'wide' | 'storyboard' | 'calligraphy' | 'polar' | 'engineering' | 'dotsBig';
export const PAPERS: PaperId[] = ['plain', 'grid', 'smallGrid', 'dots', 'dotsBig', 'lines', 'wide', 'cornell', 'graph', 'engineering', 'iso', 'hex', 'cross', 'diag', 'polar', 'music', 'calligraphy', 'storyboard', 'blueprint', 'chalk', 'kraft'];

/** Page colours. */
export const BACKGROUNDS = ['#FFFFFF', '#FBF8F1', '#FFF8E1', '#FDEFEF', '#FCE4EC', '#F3E5F5', '#EDE7F6', '#E8EAF6', '#E3F2FD', '#E0F7FA',
  '#E0F2F1', '#E8F5E9', '#F1F8E9', '#F9FBE7', '#FFFDE7', '#FFF3E0', '#EFEBE9', '#ECEFF1', '#F5F5F5', '#263238', '#1B2A41', '#0B3D2E', '#2D1B3D', '#111111'];

/** Colour sets for the whole drawing, applied in one click. */
export const PALETTES: { id: string; colors: string[] }[] = [
  { id: 'sun', colors: ['#F6D365', '#FDA085', '#F76B8A', '#2B2D42'] }, { id: 'ocean', colors: ['#0077B6', '#00B4D8', '#90E0EF', '#03045E'] },
  { id: 'forest', colors: ['#2D6A4F', '#52B788', '#B7E4C7', '#1B4332'] }, { id: 'candy', colors: ['#FFAFCC', '#BDE0FE', '#CDB4DB', '#5E548E'] },
  { id: 'earth', colors: ['#BC6C25', '#DDA15E', '#FEFAE0', '#283618'] }, { id: 'night', colors: ['#3A0CA3', '#7209B7', '#F72585', '#4CC9F0'] },
  { id: 'mono', colors: ['#E5E5E5', '#A3A3A3', '#525252', '#171717'] }, { id: 'retro', colors: ['#E63946', '#F1FAEE', '#A8DADC', '#1D3557'] },
  { id: 'citrus', colors: ['#FFBE0B', '#FB5607', '#FF006E', '#3A86FF'] }, { id: 'pastel', colors: ['#FFD6A5', '#CAFFBF', '#9BF6FF', '#A0C4FF'] },
  { id: 'gold', colors: ['#D4A843', '#F0D48A', '#FFF8E7', '#3B2F1A'] }, { id: 'royal', colors: ['#4361EE', '#3F37C9', '#F1C40F', '#14213D'] },
  { id: 'coffee', colors: ['#6F4E37', '#A67B5B', '#ECE0D1', '#38220F'] }, { id: 'mint', colors: ['#06D6A0', '#118AB2', '#EF476F', '#073B4C'] },
  { id: 'autumn', colors: ['#9B2226', '#CA6702', '#EE9B00', '#001219'] }, { id: 'spring', colors: ['#FFB3C6', '#FFE5EC', '#C1FBA4', '#7BF1A8'] },
  { id: 'neon', colors: ['#39FF14', '#FF073A', '#00F0FF', '#0D0221'] }, { id: 'school', colors: ['#2EC4B6', '#FF9F1C', '#E71D36', '#011627'] },
  { id: 'office', colors: ['#4472C4', '#ED7D31', '#A5A5A5', '#264478'] }, { id: 'kids', colors: ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4'] },
  { id: 'lavender', colors: ['#B8B8FF', '#9381FF', '#F8F7FF', '#2E2A5A'] }, { id: 'desert', colors: ['#E9C46A', '#F4A261', '#E76F51', '#264653'] },
];

export const WIDTHS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64];

export const FONTS = ['Inter', 'Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS', 'Courier New', 'Comic Sans MS', 'Impact', 'Segoe UI',
  'Calibri', 'Cambria', 'Garamond', 'Palatino', 'Tahoma', 'Lucida Console', 'Brush Script MT', 'Playfair Display', 'Caveat', 'Permanent Marker', 'Pacifico', 'Lobster'];
export const TEXT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 120, 144, 180, 240];

/** Stickers: emoji drawn as text, so they scale and print sharp. */
export const STICKERS = ['😀', '😍', '😎', '🤔', '👍', '👏', '🙏', '💪', '❤️', '⭐', '🔥', '✨', '🎉', '🎂', '🎁', '🌈', '☀️', '🌙', '⚡', '🌸', '🌳', '🐶', '🐱', '🦋',
  '🚀', '💡', '📌', '✅', '❌', '⚠️', '❓', '💬', '📞', '📧', '🏠', '🚗', '✈️', '⏰', '📅', '💰'];

/** Every shape of the Shapes gallery (closed shapes first, then the lines). */
export const SHAPE_GEOMS: Geom[] = ['rect', 'roundRect', 'ellipse', 'triangle', 'rtTriangle', 'diamond', 'pentagon', 'hexagon', 'octagon',
  'star5', 'heart', 'plus', 'rightArrow', 'leftArrow', 'upArrow', 'downArrow', 'chevron', 'wedgeRoundRectCallout'];

// ---------- geometry ----------

export function bounds(s: Shape): Box {
  if (isBox(s)) return { x: s.x, y: s.y, w: s.w, h: s.h };
  if (s.kind === 'line') return { x: Math.min(s.x1, s.x2), y: Math.min(s.y1, s.y2), w: Math.abs(s.x2 - s.x1), h: Math.abs(s.y2 - s.y1) };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < s.points.length; i += 2) { x0 = Math.min(x0, s.points[i]); x1 = Math.max(x1, s.points[i]); y0 = Math.min(y0, s.points[i + 1]); y1 = Math.max(y1, s.points[i + 1]); }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 };
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map(b => b.x)), y0 = Math.min(...boxes.map(b => b.y));
  const x1 = Math.max(...boxes.map(b => b.x + b.w)), y1 = Math.max(...boxes.map(b => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function moveShape<S extends Shape>(s: S, dx: number, dy: number): S {
  if (isBox(s)) return { ...s, x: s.x + dx, y: s.y + dy };
  if (s.kind === 'line') return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
  return { ...s, points: (s as PathShape).points.map((v, i) => v + (i % 2 ? dy : dx)) };
}

/** The shape stretched from its box `from` into the box `to` (lines and free hand lines too). */
export function fitShape<S extends Shape>(s: S, from: Box, to: Box): S {
  const sx = from.w ? to.w / from.w : 1, sy = from.h ? to.h / from.h : 1;
  const X = (x: number) => to.x + (x - from.x) * sx, Y = (y: number) => to.y + (y - from.y) * sy;
  if (isBox(s)) {
    const n = { ...s, x: X(s.x), y: Y(s.y), w: Math.max(4, s.w * sx), h: Math.max(4, s.h * sy) };
    if (s.kind === 'text') (n as TextShape).size = Math.max(6, Math.round(s.size * Math.min(Math.abs(sx), Math.abs(sy)) * 10) / 10);
    return n;
  }
  if (s.kind === 'line') return { ...s, x1: X(s.x1), y1: Y(s.y1), x2: X(s.x2), y2: Y(s.y2) };
  return { ...s, points: (s as PathShape).points.map((v, i) => (i % 2 ? Y(v) : X(v))) };
}

/** A smooth SVG path through free hand points (quadratic curves between midpoints). */
export function smoothPath(p: number[]): string {
  if (p.length < 4) return p.length === 2 ? `M${p[0]} ${p[1]}h0.01` : '';
  const r = (n: number) => Math.round(n * 10) / 10;
  let d = `M${r(p[0])} ${r(p[1])}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
    d += `Q${r(p[i])} ${r(p[i + 1])} ${r(mx)} ${r(my)}`;
  }
  return `${d}L${r(p[p.length - 2])} ${r(p[p.length - 1])}`;
}

/** Fewer points for a free hand line, keeping its shape (Ramer–Douglas–Peucker). */
export function simplify(p: number[], tol = 1.2): number[] {
  if (p.length <= 4) return p;
  const pts: [number, number][] = [];
  for (let i = 0; i < p.length; i += 2) pts.push([p[i], p[i + 1]]);
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay);
    let far = -1, dist = 0;
    for (let i = a + 1; i < b; i++) {
      // A closed stroke (a circle ending where it began) has no line between its ends: the distance to the point.
      const d = len < 1e-6 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / len;
      if (d > dist) { dist = d; far = i; }
    }
    if (far > 0 && dist > tol) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.flatMap((q, i) => (keep[i] ? q : []));
}

/**
 * "Tidy": a free hand stroke recognized as the clean shape it looks like (a line, an arrow, a rectangle, an ellipse
 * or a triangle), offline. Returns null when it looks like none of them (a signature, a doodle).
 */
export function recognize(s: PathShape): Shape | null {
  const p = s.points;
  if (p.length < 4) return null;
  const b = bounds(s);
  const size = Math.max(b.w, b.h);
  if (size < 12) return null;
  const style: Style = { fill: s.fill, stroke: s.stroke, width: s.width, dash: s.dash, opacity: s.opacity };
  const n = p.length / 2;
  const sx = p[0], sy = p[1], ex = p[p.length - 2], ey = p[p.length - 1];
  const closed = Math.hypot(ex - sx, ey - sy) < size * 0.25;
  // Straight: every point close to the line from the first to the last.
  const len = Math.hypot(ex - sx, ey - sy);
  if (!closed && len > size * 0.8) {
    let worst = 0;
    for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs((ey - sy) * p[2 * i] - (ex - sx) * p[2 * i + 1] + ex * sy - ey * sx) / (len || 1));
    if (worst < size * 0.08) return { id: s.id, kind: 'line', ...style, fill: null, x1: sx, y1: sy, x2: ex, y2: ey, head: 'none' };
  }
  if (!closed) return null;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  // How far the points are from an ellipse and from the rectangle of the same box, on average.
  let eErr = 0, rErr = 0;
  for (let i = 0; i < n; i++) {
    const x = p[2 * i], y = p[2 * i + 1];
    const nx = (x - cx) / (b.w / 2 || 1), ny = (y - cy) / (b.h / 2 || 1);
    eErr += Math.abs(Math.hypot(nx, ny) - 1);
    rErr += Math.min(Math.abs(Math.abs(nx) - 1), Math.abs(Math.abs(ny) - 1));
  }
  eErr /= n; rErr /= n;
  const simple = simplify(p, size * 0.08);
  const corners = simple.length / 2 - 1; // closed: the last point repeats the first
  const box = { x: b.x, y: b.y, w: Math.max(8, b.w), h: Math.max(8, b.h) };
  const geom = (g: Geom): GeomShape => ({ id: s.id, kind: 'geom', geom: g, ...box, rot: 0, ...style });
  if (corners === 3) return geom('triangle');
  if (rErr < 0.12 && rErr < eErr) return geom('rect');
  if (eErr < 0.2) return geom('ellipse');
  if (corners === 4) return geom('rect');
  return null;
}

// ---------- SVG ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DASHES: Record<Dash, (w: number) => string | undefined> = { solid: () => undefined, dash: w => `${w * 3} ${w * 2}`, dot: w => `0.1 ${w * 2}` };
const styleAttrs = (s: Style, fill: string | null = s.fill) =>
  `fill="${fill ? esc(fill) : 'none'}" stroke="${s.stroke ? esc(s.stroke) : 'none'}" stroke-width="${s.width}"${DASHES[s.dash](s.width) ? ` stroke-dasharray="${DASHES[s.dash](s.width)}"` : ''} stroke-linecap="round" stroke-linejoin="round"${s.opacity < 1 ? ` opacity="${s.opacity}"` : ''}`;

/** The SVG markup of one shape (used by the editor and for saving, so both look the same). */
export function shapeSvg(s: Shape): string {
  if (s.hidden) return '';
  if (s.kind === 'path') return `<path d="${smoothPath(s.points)}" ${styleAttrs(s, null)}${s.marker ? ' style="mix-blend-mode:multiply"' : ''}/>`;
  if (s.kind === 'line') {
    const heads = arrowHeads(s);
    return `<g ${s.opacity < 1 ? `opacity="${s.opacity}"` : ''}><line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" ${styleAttrs({ ...s, opacity: 1 }, null)}/>${heads.map(d => `<path d="${d}" fill="${s.stroke ? esc(s.stroke) : 'none'}" stroke="none"/>`).join('')}</g>`;
  }
  const rot = s.rot ? ` transform="rotate(${s.rot} ${s.x + s.w / 2} ${s.y + s.h / 2})"` : '';
  if (s.kind === 'image') return `<image href="${esc(s.src)}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" preserveAspectRatio="none"${rot}${s.opacity < 1 ? ` opacity="${s.opacity}"` : ''}/>`;
  if (s.kind === 'text') return `<g${rot}${s.opacity < 1 ? ` opacity="${s.opacity}"` : ''}>${textSvg(s.text, s.x, s.y, s.w, s.size, s.font, s.fill ?? '#000', s.bold, s.italic, s.align)}</g>`;
  const d = geomPath(s.geom, s.w, s.h);
  const label = s.text ? textSvg(s.text, s.x, s.y + s.h / 2 - (s.text.split('\n').length * 22 * 1.2) / 2, s.w, 22, 'Inter', s.textColor ?? '#111', true, false, 'center') : '';
  return `<g${rot}><path d="${d}" transform="translate(${s.x} ${s.y})" ${styleAttrs(s)}/>${label}</g>`;
}

function textSvg(text: string, x: number, y: number, w: number, size: number, font: string, color: string, bold: boolean, italic: boolean, align: 'left' | 'center' | 'right') {
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  const lines = text.split('\n');
  return `<text x="${ax}" y="${y}" font-family="${esc(font)}, sans-serif" font-size="${size}" fill="${esc(color)}" text-anchor="${anchor}"${bold ? ' font-weight="700"' : ''}${italic ? ' font-style="italic"' : ''}>${lines.map((l, i) => `<tspan x="${ax}" dy="${i ? size * 1.2 : size}">${esc(l) || ' '}</tspan>`).join('')}</text>`;
}

export function arrowHeads(s: LineShape): string[] {
  if (s.head === 'none') return [];
  const size = Math.max(10, s.width * 3.5);
  const head = (tx: number, ty: number, fx: number, fy: number) => {
    const a = Math.atan2(ty - fy, tx - fx);
    const p = (da: number) => `${tx - size * Math.cos(a + da)} ${ty - size * Math.sin(a + da)}`;
    return `M${tx} ${ty}L${p(0.45)}L${p(-0.45)}Z`;
  };
  return s.head === 'both' ? [head(s.x2, s.y2, s.x1, s.y1), head(s.x1, s.y1, s.x2, s.y2)] : [head(s.x2, s.y2, s.x1, s.y1)];
}

/** The paper's pattern as SVG (defs + a rect), drawn under the shapes. */
export function paperSvg(d: Drawing, ink = 'rgba(80,90,110,.22)'): string {
  const { w, h, paper } = d;
  const pat = (id: string, size: number, body: string, sw = size, sh = size) =>
    `<defs><pattern id="pp-${id}" width="${sw}" height="${sh}" patternUnits="userSpaceOnUse">${body}</pattern></defs><rect width="${w}" height="${h}" fill="url(#pp-${id})"/>`;
  const L = (path: string, width = 1, color = ink) => `<path d="${path}" stroke="${color}" stroke-width="${width}" fill="none"/>`;
  switch (paper) {
    case 'grid': return pat('grid', 40, L('M40 0H0V40'));
    case 'smallGrid': return pat('sg', 20, L('M20 0H0V20', 0.7));
    case 'dots': return pat('dots', 30, `<circle cx="15" cy="15" r="1.6" fill="${ink}"/>`);
    case 'dotsBig': return pat('db', 60, `<circle cx="30" cy="30" r="3" fill="${ink}"/>`);
    case 'lines': return pat('lines', 32, L('M0 31.5H32'), 32, 32);
    case 'wide': return pat('wide', 48, L('M0 47.5H48'), 48, 48);
    case 'cornell': return `${pat('cn', 32, L('M0 31.5H32'))}${L(`M${w * 0.28} 0V${h}`, 2, 'rgba(220,60,60,.45)')}`;
    case 'graph': return pat('gr', 100, `${L('M10 0V100M20 0V100M30 0V100M40 0V100M60 0V100M70 0V100M80 0V100M90 0V100M0 10H100M0 20H100M0 30H100M0 40H100M0 60H100M0 70H100M0 80H100M0 90H100', 0.4)}${L('M50 0V100M0 50H100', 0.8)}${L('M100 0H0V100', 1.3)}`);
    case 'engineering': return pat('en', 50, `${L('M10 0V50M20 0V50M30 0V50M40 0V50M0 10H50M0 20H50M0 30H50M0 40H50', 0.4, 'rgba(40,140,90,.3)')}${L('M50 0H0V50', 1, 'rgba(40,140,90,.45)')}`);
    case 'iso': return pat('iso', 40, L('M0 0L40 23M40 0L0 23M20 0V46', 0.7), 40, 23);
    case 'hex': return pat('hex', 42, L('M0 12L10.5 0H31.5L42 12L31.5 24H10.5Z M10.5 24L0 36M31.5 24L42 36', 0.7), 42, 24);
    case 'cross': return pat('cr', 40, L('M16 20H24M20 16V24', 1));
    case 'diag': return pat('dg', 24, L('M0 24L24 0', 0.7));
    case 'polar': return `<g stroke="${ink}" fill="none">${Array.from({ length: 10 }, (_, i) => `<circle cx="${w / 2}" cy="${h / 2}" r="${(i + 1) * Math.max(w, h) / 20}"/>`).join('')}${Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6, r = Math.max(w, h); return `<line x1="${w / 2}" y1="${h / 2}" x2="${w / 2 + Math.cos(a) * r}" y2="${h / 2 + Math.sin(a) * r}"/>`; }).join('')}</g>`;
    case 'music': return pat('mu', 120, L('M0 20H10M0 30H10M0 40H10M0 50H10M0 60H10', 0.9), 10, 120);
    case 'calligraphy': return pat('ca', 60, `${L('M0 59.5H60', 1)}${L('M0 20H60', 0.5)}${L('M0 0L60 60', 0.4)}`);
    case 'storyboard': {
      const cols = 3, rows = 2, gw = w / cols, gh = h / rows;
      return `<g stroke="${ink}" fill="none" stroke-width="2">${Array.from({ length: cols * rows }, (_, i) => `<rect x="${(i % cols) * gw + 20}" y="${Math.floor(i / cols) * gh + 20}" width="${gw - 40}" height="${gh * 0.72 - 20}" rx="8"/>`).join('')}</g>`;
    }
    case 'blueprint': return `<rect width="${w}" height="${h}" fill="#1E4E8C"/>${pat('bp', 40, L('M40 0H0V40', 0.8, 'rgba(255,255,255,.25)'))}`;
    case 'chalk': return `<rect width="${w}" height="${h}" fill="#2F3B35"/>`;
    case 'kraft': return `<rect width="${w}" height="${h}" fill="#C8A57A"/>${pat('kr', 6, '<circle cx="3" cy="3" r=".6" fill="rgba(90,60,30,.18)"/>')}`;
    default: return '';
  }
}

/** The whole drawing as a standalone SVG file, with its data inside for Office Draw. */
export function toSvg(d: Drawing, withData = true): string {
  const data = withData ? `<metadata id="oi1-draw">${esc(JSON.stringify({ v: 1, ...d }))}</metadata>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${d.w}" height="${d.h}" viewBox="0 0 ${d.w} ${d.h}">${data}<rect width="${d.w}" height="${d.h}" fill="${esc(d.background)}"/>${paperSvg(d)}${d.shapes.map(shapeSvg).join('')}</svg>`;
}

/** A drawing from an .svg Office Draw saved; any other SVG comes in as one picture. */
export function fromSvg(text: string): Drawing | null {
  const m = text.match(/<metadata id="oi1-draw">([\s\S]*?)<\/metadata>/);
  if (!m) return null;
  try {
    const raw = m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return sanitize(JSON.parse(raw));
  } catch { return null; }
}

/** A drawing made safe: known kinds only, numbers checked (files and the AI can be wrong). */
export function sanitize(raw: unknown): Drawing {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const w = Math.min(8000, Math.max(50, num(o.w, 1600))), h = Math.min(8000, Math.max(50, num(o.h, 900)));
  const shapes = (Array.isArray(o.shapes) ? o.shapes : []).slice(0, 5000).map(cleanShape).filter((s): s is Shape => !!s);
  return {
    w, h, background: typeof o.background === 'string' && /^#[0-9a-f]{3,8}$/i.test(o.background) ? o.background : '#FFFFFF',
    paper: PAPERS.includes(o.paper as PaperId) ? (o.paper as PaperId) : 'plain', shapes,
  };
}

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i;
/** One shape with every field checked and typed: a file or an AI answer never puts markup into the SVG. */
export function cleanShape(raw: unknown): Shape | null {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-20000, Math.min(20000, v)) : d);
  const c = (v: unknown, d: string | null) => (v === null ? null : typeof v === 'string' && COLOR.test(v.trim()) ? v.trim() : d);
  const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
  const style: Style = {
    fill: c(s.fill, null), stroke: c(s.stroke, '#2B2D42'), width: Math.max(0, Math.min(200, n(s.width, 3))),
    dash: s.dash === 'dash' || s.dash === 'dot' ? s.dash : 'solid', opacity: Math.max(0.05, Math.min(1, n(s.opacity, 1))),
  };
  const base = { id: typeof s.id === 'string' && /^[\w-]{1,40}$/.test(s.id) ? s.id : newId(), ...style, ...(s.locked ? { locked: true } : {}), ...(s.hidden ? { hidden: true } : {}), ...(typeof s.name === 'string' ? { name: s.name.slice(0, 80) } : {}) };
  const box = { x: n(s.x), y: n(s.y), w: Math.max(1, n(s.w, 100)), h: Math.max(1, n(s.h, 100)), rot: n(s.rot) % 360 };
  switch (s.kind) {
    case 'geom': {
      const g = [...SHAPE_GEOMS].includes(s.geom as Geom) ? (s.geom as Geom) : 'rect';
      return { ...base, kind: 'geom', geom: g, ...box, ...(s.text ? { text: str(s.text, 400) } : {}), ...(c(s.textColor, null) ? { textColor: c(s.textColor, null)! } : {}) };
    }
    case 'path': return { ...base, kind: 'path', fill: null, points: (Array.isArray(s.points) ? s.points : []).slice(0, 20000).map(v => n(v)), ...(s.marker ? { marker: true } : {}) };
    case 'line': return { ...base, kind: 'line', fill: null, x1: n(s.x1), y1: n(s.y1), x2: n(s.x2), y2: n(s.y2), head: s.head === 'end' || s.head === 'both' ? s.head : 'none' };
    case 'text': return {
      ...base, kind: 'text', ...box, text: str(s.text), font: FONTS.includes(s.font as string) ? (s.font as string) : 'Inter',
      size: Math.max(4, Math.min(600, n(s.size, 32))), bold: !!s.bold, italic: !!s.italic, align: s.align === 'center' || s.align === 'right' ? s.align : 'left',
    };
    case 'image': return typeof s.src === 'string' && /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(s.src) ? { ...base, kind: 'image', ...box, src: s.src } : null;
    default: return null;
  }
}

export function newDrawing(size = SIZES[0], paper: PaperId = 'plain'): Drawing {
  return { w: size.w, h: size.h, background: '#FFFFFF', paper, shapes: [] };
}
