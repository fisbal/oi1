// "My themes": the themes Copilot made on request, kept on this device so they stay in the gallery.
// A deck that uses one also carries it inside its .pptx, so nothing is lost if this list is cleared.

import { GEOMS, newId, type Deco, type DeckTheme, type Geom } from '../../formats/slides';
import { BUNDLED_FONTS } from '../../ui/fonts';

const KEY = 'oi1:stage:my-themes';
const listeners = new Set<() => void>();

export function myThemes(): DeckTheme[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as DeckTheme[];
    return Array.isArray(list) ? list.filter(t => t && t.id && t.bg && Array.isArray(t.accents)) : [];
  } catch { return []; }
}

export function saveMyTheme(theme: DeckTheme) {
  const list = [theme, ...myThemes().filter(t => t.id !== theme.id)].slice(0, 24);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked: the theme still lives in the deck */ }
  listeners.forEach(fn => fn());
}

export function removeMyTheme(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify(myThemes().filter(t => t.id !== id))); } catch { /* storage blocked */ }
  listeners.forEach(fn => fn());
}

export function onMyThemes(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** The fonts a theme may use: the ones bundled with the app, so they show the same everywhere. */
export const THEME_FONTS = BUNDLED_FONTS.filter(f => f.kind !== 'alike' && f.kind !== 'mono').map(f => f.name);
export const DECO_SHAPES: Geom[] = ['rect', 'ellipse', 'triangle', 'diamond', 'star5', 'heart', 'chevron', 'plus', 'hexagon'];

/** What Claude answers when asked for a theme (see the schema in copilot.ts). */
export interface ThemeSpec {
  name: string; dark: boolean; background: string; background2: string; title: string; text: string; accents: string[];
  headingFont: string; bodyFont: string;
  decorations: { shape: string; x: number; y: number; w: number; h: number; color: string; opacity: number; rotate: number }[];
}

const hex = (c: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(c?.trim() ?? '') ? c.trim().toUpperCase() : fallback);
const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);
const font = (f: string, fallback: string) => THEME_FONTS.find(x => x.toLowerCase() === f?.trim().toLowerCase()) ?? fallback;

/** A safe theme from Claude's answer: colors and fonts checked, decorations kept inside sensible limits. */
export function themeFromSpec(sp: ThemeSpec): DeckTheme {
  const dark = !!sp.dark;
  const bg = hex(sp.background, dark ? '#1C1F26' : '#FFFFFF');
  const to = sp.background2 ? hex(sp.background2, '') : '';
  const accents = (sp.accents ?? []).map((c, i) => hex(c, ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'][i % 6])).slice(0, 6);
  while (accents.length < 6) accents.push(['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'][accents.length]);
  const deco: Deco[] = (sp.decorations ?? []).slice(0, 12).map(d => {
    const g = (GEOMS as string[]).includes(d.shape) && DECO_SHAPES.includes(d.shape as Geom) ? d.shape as Geom : 'rect';
    return {
      x: clamp(d.x, -0.3, 1.2), y: clamp(d.y, -0.3, 1.2), w: clamp(d.w, 0.002, 1.4), h: clamp(d.h, 0.002, 1.4),
      color: hex(d.color, accents[0]), opacity: clamp(d.opacity ?? 1, 0.03, 1),
      ...(g === 'ellipse' ? { round: true } : g === 'rect' ? {} : { geom: g }),
      ...(d.rotate ? { rot: Math.round(clamp(d.rotate, -180, 180)) } : {}),
    };
  });
  return {
    id: newId('ai'), name: (sp.name || 'Copilot').slice(0, 40), group: 'mine', dark,
    bg: to ? { color: bg, to, angle: 135 } : { color: bg },
    title: hex(sp.title, dark ? '#FFFFFF' : '#1F1F1F'), text: hex(sp.text, dark ? '#E6E6E6' : '#262626'), accents,
    head: font(sp.headingFont, 'Montserrat'), body: font(sp.bodyFont, 'Open Sans'), deco,
  };
}
