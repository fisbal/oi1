// A presentation as Office Stage keeps it: slides of positioned items (text, shapes, pictures, tables),
// a theme, and speaker notes. Sizes are pixels at 96 per inch, so a 16:9 slide is 1280 x 720 like PowerPoint's
// 13.333 x 7.5 inches. Text is HTML from the editor (paragraphs, lists, bold, colors, sizes in pt).
// .pptx files are read into this shape and written back from it (see pptx.ts).

import type { HandoffLink } from '../shell/contract';
import { LIFE_THEMES, MILITARY_THEMES } from './themes-more';

export type Geom =
  | 'rect' | 'roundRect' | 'ellipse' | 'triangle' | 'rtTriangle' | 'diamond' | 'pentagon' | 'hexagon' | 'octagon'
  | 'star5' | 'rightArrow' | 'leftArrow' | 'upArrow' | 'downArrow' | 'chevron' | 'plus' | 'heart'
  | 'wedgeRoundRectCallout' | 'line' | 'arrow';

export const GEOMS: Geom[] = ['rect', 'roundRect', 'ellipse', 'triangle', 'rtTriangle', 'diamond', 'pentagon', 'hexagon', 'octagon',
  'star5', 'heart', 'plus', 'rightArrow', 'leftArrow', 'upArrow', 'downArrow', 'chevron', 'wedgeRoundRectCallout', 'line', 'arrow'];

/** A placeholder's part on the slide, like PowerPoint's title and content boxes. */
export type Role = 'title' | 'subtitle' | 'body' | 'body2';

export interface Stroke { color: string; width: number /* pt */; dash?: 'solid' | 'dash' | 'dot' }

interface Base { id: string; x: number; y: number; w: number; h: number; rot?: number; flipH?: boolean; flipV?: boolean; name?: string }

export interface ShapeItem extends Base {
  kind: 'shape';
  geom: Geom;
  role?: Role;
  /** undefined: the shape's usual look (theme accent for shapes, nothing for text boxes); null: none. */
  fill?: string | null;
  line?: Stroke | null;
  html: string;
  valign?: 'top' | 'middle' | 'bottom';
  /** Line height of the text, like 1.0 or 1.5. */
  spacing?: number;
  /** Shrink text that does not fit, like PowerPoint's AutoFit (on for placeholders). */
  autofit?: boolean;
}

export interface ImageItem extends Base { kind: 'image'; src: string; alt?: string; line?: Stroke | null }

export interface TableItem extends Base {
  kind: 'table';
  rows: string[][];
  header: boolean;
  banded: boolean;
  /** The table's color; the theme's first accent when not set. */
  color?: string;
  /** Column widths as parts of the table's width. */
  cols?: number[];
  /** A table linked to an Office Class sheet, updated from it. */
  link?: HandoffLink;
}

export type Item = ShapeItem | ImageItem | TableItem;

export type Transition = 'none' | 'fade' | 'push' | 'wipe' | 'cover' | 'zoom';
export const TRANSITIONS: Transition[] = ['none', 'fade', 'push', 'wipe', 'cover', 'zoom'];

/** in: comes in; em: gets attention; out: leaves; loop: keeps moving while on screen (Office Stage's own). */
export type AnimKind = 'in' | 'em' | 'out' | 'loop';
export type AnimEffect =
  | 'appear' | 'fade' | 'fly' | 'zoom' | 'pop' | 'bounce' | 'drop' | 'wipe' | 'blur' | 'spin' | 'float' | 'typewriter'
  | 'pulse' | 'shake' | 'wiggle' | 'glow' | 'grow' | 'flash'
  | 'fadeOut' | 'flyOut' | 'zoomOut' | 'shrink'
  | 'bob' | 'beat' | 'sway' | 'twinkle' | 'rotate' | 'jelly';

/** One animation in a slide's order, like a line of PowerPoint's animation pane. */
export interface Anim {
  id: string;
  /** The item it moves. */
  item: string;
  effect: AnimEffect;
  /** On a click, with the one before, or after the one before. */
  start: 'click' | 'with' | 'after';
  /** Text all at once, word by word or letter by letter. */
  by?: 'all' | 'word' | 'letter';
  dir?: 'left' | 'right' | 'up' | 'down';
  /** Seconds. */
  dur?: number;
  delay?: number;
}

export interface Background { color: string; to?: string; angle?: number }

export type LayoutId = 'title' | 'content' | 'section' | 'two' | 'titleOnly' | 'blank';
export const LAYOUTS: LayoutId[] = ['title', 'content', 'section', 'two', 'titleOnly', 'blank'];

export interface Slide {
  id: string;
  layout: LayoutId;
  items: Item[];
  bg?: Background | null;
  notes: string;
  transition?: Transition;
  speed?: 'fast' | 'med' | 'slow';
  hidden?: boolean;
  anims?: Anim[];
}

/** A rectangle drawn behind every slide by the theme, in parts of the slide (0 to 1). */
export interface Deco {
  x: number; y: number; w: number; h: number; color: string; to?: string; opacity?: number; round?: boolean;
  /** A shape other than a rectangle or an oval, like a star or a chevron. */
  geom?: Geom;
  /** Turned this many degrees clockwise. */
  rot?: number;
}

/** Where a theme sits in the gallery; 'mine' holds the themes Copilot made. */
export type ThemeGroup = 'classic' | 'life' | 'military' | 'mine';

export interface DeckTheme {
  id: string;
  /** Shown in the gallery; themes read from a file keep the file's name. */
  name: string;
  bg: Background;
  title: string;
  text: string;
  accents: string[];
  head: string;
  body: string;
  dark: boolean;
  deco?: Deco[];
  /** Theme pictures and shapes read from a .pptx master, drawn behind the slides. */
  decoItems?: Item[];
  group?: ThemeGroup;
}

export interface Deck {
  w: number;
  h: number;
  theme: DeckTheme;
  slides: Slide[];
}

export const SIZE_16_9 = { w: 1280, h: 720 };
export const SIZE_4_3 = { w: 960, h: 720 };

export const newId = (p = 'i') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ---------- themes ----------

export const THEMES: DeckTheme[] = [
  {
    id: 'office', name: 'Office', bg: { color: '#FFFFFF' }, title: '#1F1F1F', text: '#262626',
    accents: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'], head: 'Calibri Light', body: 'Calibri', dark: false,
  },
  {
    id: 'scene', name: 'Scène OI1', bg: { color: '#34343D', to: '#1F1F25', angle: 135 }, title: '#F2D78B', text: '#F0EDE6',
    accents: ['#D4A843', '#7FA7E8', '#5FC79A', '#E8875F', '#B48CF0', '#E25C5C'], head: 'Playfair Display', body: 'DM Sans', dark: true,
    deco: [
      { x: 0.07, y: 0.245, w: 0.12, h: 0.006, color: '#B8892E', to: '#F2D78B' },
      { x: 0.8, y: -0.25, w: 0.45, h: 0.8, color: '#D4A843', opacity: 0.07, round: true },
    ],
  },
  {
    id: 'ivory', name: 'Ivoire', bg: { color: '#FBF8F1' }, title: '#7A1F3D', text: '#2B2B2B',
    accents: ['#7A1F3D', '#C9A961', '#3E6B5A', '#8C6D58', '#5B6C8F', '#B5523B'], head: 'Cormorant Garamond', body: 'Lora', dark: false,
    deco: [{ x: 0, y: 0, w: 0.012, h: 1, color: '#7A1F3D' }],
  },
  {
    id: 'ocean', name: 'Océan', bg: { color: '#12355B', to: '#0B1E33', angle: 160 }, title: '#9FD8F5', text: '#E6EEF5',
    accents: ['#5FB8E8', '#4FC4B5', '#F2D78B', '#8C9CF0', '#E8875F', '#9FD8F5'], head: 'Montserrat', body: 'Open Sans', dark: true,
    deco: [{ x: 0, y: 0.94, w: 1, h: 0.06, color: '#5FB8E8', to: '#4FC4B5', opacity: 0.85 }],
  },
  {
    id: 'forest', name: 'Forêt', bg: { color: '#F4F1E8' }, title: '#2E5E3A', text: '#28302A',
    accents: ['#2E5E3A', '#6B8F4E', '#C9A961', '#A3B86C', '#8C6D58', '#4F7A8C'], head: 'Merriweather', body: 'Source Sans 3', dark: false,
    deco: [{ x: 0, y: 0, w: 1, h: 0.025, color: '#2E5E3A' }],
  },
  {
    id: 'sunset', name: 'Crépuscule', bg: { color: '#4A2442', to: '#1E1530', angle: 135 }, title: '#FFC58A', text: '#F7E9F0',
    accents: ['#FF8A5B', '#FFC58A', '#E26FC2', '#B48CF0', '#5FB8E8', '#5FC79A'], head: 'Poppins', body: 'Nunito', dark: true,
    deco: [{ x: 0.82, y: 0.66, w: 0.34, h: 0.6, color: '#FF8A5B', opacity: 0.12, round: true }],
  },
  {
    id: 'minimal', name: 'Minimal', bg: { color: '#FFFFFF' }, title: '#111111', text: '#3A3A3A',
    accents: ['#111111', '#D4A843', '#6B6B6B', '#4472C4', '#E25C5C', '#5FC79A'], head: 'Inter', body: 'Inter', dark: false,
    deco: [{ x: 0.07, y: 0.08, w: 0.05, h: 0.008, color: '#111111' }],
  },
  {
    id: 'midnight', name: 'Minuit', bg: { color: '#1C1F26' }, title: '#FFFFFF', text: '#C9CED8',
    accents: ['#7FA7E8', '#5FC79A', '#F2D78B', '#E8875F', '#B48CF0', '#4FC4B5'], head: 'Space Grotesk', body: 'Inter', dark: true,
    deco: [{ x: 0, y: 0, w: 0.33, h: 0.004, color: '#7FA7E8', to: '#B48CF0' }],
  },
  {
    id: 'pastel', name: 'Pastel', bg: { color: '#FDF6F0' }, title: '#5B4B8A', text: '#4A4458',
    accents: ['#B48CF0', '#F2A7C3', '#8FD3C7', '#F7D08A', '#9CC3F0', '#F4A582'], head: 'Quicksand', body: 'Nunito', dark: false,
    deco: [{ x: -0.06, y: 0.78, w: 0.22, h: 0.4, color: '#F2A7C3', opacity: 0.35, round: true }, { x: 0.9, y: -0.1, w: 0.18, h: 0.32, color: '#8FD3C7', opacity: 0.35, round: true }],
  },
];

THEMES.push(...LIFE_THEMES, ...MILITARY_THEMES);

/** A deck on another theme. Colors taken from the old theme's accents follow the new one, like PowerPoint's
 *  theme colors: shapes, lines, tables and colored text made from accent 2 stay accent 2. */
export function retheme(deck: Deck, theme: DeckTheme): Deck {
  const map = new Map<string, string>();
  deck.theme.accents.forEach((c, i) => { const to = theme.accents[i]; if (to && !map.has(c.toUpperCase())) map.set(c.toUpperCase(), to); });
  const swap = (c: string | null | undefined) => (c ? map.get(c.toUpperCase()) ?? c : c);
  const swapHtml = (html: string) => html.replace(/(color:\s*)(#[0-9a-fA-F]{6})/g, (m, k: string, c: string) => (map.has(c.toUpperCase()) ? k + map.get(c.toUpperCase()) : m));
  const item = (it: Item): Item => {
    if (it.kind === 'shape') return { ...it, fill: swap(it.fill) as string | null | undefined, line: it.line ? { ...it.line, color: swap(it.line.color)! } : it.line, html: swapHtml(it.html) };
    if (it.kind === 'table') return it.color ? { ...it, color: swap(it.color)! } : it;
    return it.line ? { ...it, line: { ...it.line, color: swap(it.line.color)! } } : it;
  };
  return { ...deck, theme, slides: deck.slides.map(s => ({ ...s, items: s.items.map(item) })) };
}

export const themeById = (id: string) => THEMES.find(t => t.id === id) ?? THEMES[0];

export const cssBackground = (b: Background) =>
  b.to ? `linear-gradient(${b.angle ?? 135}deg, ${b.color}, ${b.to})` : b.color;

// ---------- text defaults ----------

/** Default font size (pt) of a placeholder's text at each list level, like PowerPoint's master. */
export function defaultSize(role: Role | undefined, layout: LayoutId, level = 0): number {
  if (role === 'title') return layout === 'title' ? 54 : layout === 'section' ? 48 : 40;
  if (role === 'subtitle') return 24;
  if (role === 'body' || role === 'body2') return layout === 'section' ? 20 : [28, 24, 20, 18, 18][Math.min(level, 4)];
  return 18;
}

export function defaultAlign(role: Role | undefined, layout: LayoutId): 'left' | 'center' {
  return (role === 'title' || role === 'subtitle') && layout === 'title' ? 'center' : 'left';
}

// ---------- layouts ----------

interface Box { x: number; y: number; w: number; h: number; valign: ShapeItem['valign'] }

/** Where each placeholder of a layout sits, in parts of the slide. */
const LAYOUT_BOXES: Record<LayoutId, Partial<Record<Role, Box>>> = {
  title: {
    title: { x: 0.125, y: 0.2, w: 0.75, h: 0.33, valign: 'bottom' },
    subtitle: { x: 0.125, y: 0.56, w: 0.75, h: 0.2, valign: 'top' },
  },
  content: {
    title: { x: 0.07, y: 0.055, w: 0.86, h: 0.18, valign: 'middle' },
    body: { x: 0.07, y: 0.27, w: 0.86, h: 0.63, valign: 'top' },
  },
  section: {
    title: { x: 0.07, y: 0.24, w: 0.86, h: 0.39, valign: 'bottom' },
    body: { x: 0.07, y: 0.66, w: 0.86, h: 0.2, valign: 'top' },
  },
  two: {
    title: { x: 0.07, y: 0.055, w: 0.86, h: 0.18, valign: 'middle' },
    body: { x: 0.07, y: 0.27, w: 0.42, h: 0.63, valign: 'top' },
    body2: { x: 0.51, y: 0.27, w: 0.42, h: 0.63, valign: 'top' },
  },
  titleOnly: { title: { x: 0.07, y: 0.055, w: 0.86, h: 0.18, valign: 'middle' } },
  blank: {},
};

export function layoutBox(layout: LayoutId, role: Role, w: number, h: number) {
  const b = LAYOUT_BOXES[layout][role] ?? LAYOUT_BOXES.content[role === 'body2' ? 'body' : role] ?? LAYOUT_BOXES.content.body!;
  return { x: Math.round(b.x * w), y: Math.round(b.y * h), w: Math.round(b.w * w), h: Math.round(b.h * h), valign: b.valign };
}

export const layoutRoles = (layout: LayoutId) => Object.keys(LAYOUT_BOXES[layout]) as Role[];

export const emptyHtml = (role: Role | undefined) => (role === 'body' || role === 'body2' ? '<ul><li><p></p></li></ul>' : '<p></p>');

export function placeholder(layout: LayoutId, role: Role, w: number, h: number, html?: string): ShapeItem {
  const b = layoutBox(layout, role, w, h);
  return {
    id: newId(), kind: 'shape', geom: 'rect', role, x: b.x, y: b.y, w: b.w, h: b.h, valign: b.valign,
    fill: null, line: null, html: html ?? emptyHtml(role), autofit: true,
  };
}

export function newSlide(layout: LayoutId, deck: Pick<Deck, 'w' | 'h'>): Slide {
  return { id: newId('s'), layout, items: layoutRoles(layout).map(r => placeholder(layout, r, deck.w, deck.h)), notes: '' };
}

/** Moves a slide to another layout: its placeholders take the new places, missing ones are added, extra text stays. */
export function changeLayout(slide: Slide, layout: LayoutId, deck: Pick<Deck, 'w' | 'h'>): Slide {
  const roles = layoutRoles(layout);
  const items: Item[] = [];
  const used = new Set<Role>();
  for (const it of slide.items) {
    if (it.kind === 'shape' && it.role) {
      const role: Role | null = roles.includes(it.role) ? it.role : it.role === 'subtitle' && roles.includes('body') ? 'body' : it.role === 'body' && roles.includes('subtitle') ? 'subtitle' : null;
      if (role && !used.has(role)) {
        used.add(role);
        const b = layoutBox(layout, role, deck.w, deck.h);
        items.push({ ...it, role, x: b.x, y: b.y, w: b.w, h: b.h, valign: b.valign });
        continue;
      }
      if (isEmptyHtml(it.html)) continue;
      items.push({ ...it, role: undefined });
      continue;
    }
    items.push(it);
  }
  for (const r of roles) if (!used.has(r)) items.push(placeholder(layout, r, deck.w, deck.h));
  return { ...slide, layout, items };
}

export const isEmptyHtml = (html: string) => !html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() && !/<img/i.test(html);

export function newDeck(theme = THEMES[1], size = SIZE_16_9): Deck {
  const d: Deck = { ...size, theme, slides: [] };
  d.slides.push(newSlide('title', d));
  return d;
}

/** Changes the slide size, moving and scaling items so they keep their place. */
export function resizeDeck(deck: Deck, size: { w: number; h: number }): Deck {
  const sx = size.w / deck.w, sy = size.h / deck.h;
  const k = Math.min(sx, sy);
  const fit = (it: Item): Item => {
    if (it.kind === 'shape' && it.role) {
      // Placeholders take the new layout places.
      return it;
    }
    const w = it.w * k, h = it.h * k;
    return { ...it, w: Math.round(w), h: Math.round(h), x: Math.round((it.x + it.w / 2) * sx - w / 2), y: Math.round((it.y + it.h / 2) * sy - h / 2) };
  };
  return {
    ...deck, ...size,
    slides: deck.slides.map(s => {
      const moved = { ...s, items: s.items.map(fit) };
      return { ...moved, items: moved.items.map(it => (it.kind === 'shape' && it.role ? { ...it, ...xywh(layoutBox(s.layout, it.role, size.w, size.h)) } : it)) };
    }),
  };
}
const xywh = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x, y: b.y, w: b.w, h: b.h });

// ---------- text helpers ----------

/** The plain text of an item, for outlines, the copilot and searching. */
export function itemText(it: Item): string {
  if (it.kind === 'table') return it.rows.map(r => r.join('\t')).join('\n');
  if (it.kind === 'image') return it.alt ?? '';
  return htmlText(it.html);
}

export function htmlText(html: string): string {
  return html
    .replace(/<\/(p|h\d|li)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{2,}/g, '\n').trim();
}

export const slideTitle = (s: Slide) => {
  const t = s.items.find(i => i.kind === 'shape' && i.role === 'title');
  return t ? itemText(t).split('\n')[0] : '';
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Lines of text as editor HTML: a list for body placeholders, paragraphs otherwise. */
export function linesToHtml(lines: string[], list: boolean): string {
  if (!lines.length) return list ? '<ul><li><p></p></li></ul>' : '<p></p>';
  return list ? `<ul>${lines.map(l => `<li><p>${esc(l)}</p></li>`).join('')}</ul>` : lines.map(l => `<p>${esc(l)}</p>`).join('');
}
