// Page setup for a letter: size, orientation, margins and page color.
// Lengths are stored in inches, like Word's dialogs; helpers convert to screen pixels and Word twips.

export interface PageSettings {
  size: PageSizeId;
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  /** Distance from the page edge to the header and footer. */
  headerDistance: number;
  footerDistance: number;
  /** Page background, '#rrggbb', or null for white paper. */
  color: string | null;
  /** A box around every page: line width and distance from the page edge in points. */
  border: PageBorder | null;
  /** Break long words at line ends with a hyphen (Layout > Hyphenation). */
  hyphenate?: boolean;
  /** Faint diagonal text behind every page, like DRAFT (Design > Watermark). */
  watermark?: Watermark | null;
}

export interface Watermark { text: string; color: string }

/** Word's ready-made watermarks. */
export const WATERMARKS = ['CONFIDENTIAL', 'DRAFT', 'DO NOT COPY', 'SAMPLE', 'URGENT', 'ASAP'] as const;

export interface PageBorder { w: number; color: string; space: number }

export const PAGE_SIZES = {
  letter: { name: 'Letter', width: 8.5, height: 11 },
  a4: { name: 'A4', width: 8.27, height: 11.69 },
  legal: { name: 'Legal', width: 8.5, height: 14 },
  a5: { name: 'A5', width: 5.83, height: 8.27 },
  executive: { name: 'Executive', width: 7.25, height: 10.5 },
} as const;

export type PageSizeId = keyof typeof PAGE_SIZES;

export const MARGIN_PRESETS = {
  normal: { top: 1, right: 1, bottom: 1, left: 1 },
  narrow: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
  moderate: { top: 1, right: 0.75, bottom: 1, left: 0.75 },
  wide: { top: 1, right: 2, bottom: 1, left: 2 },
} as const;

export type MarginPresetId = keyof typeof MARGIN_PRESETS;

export const PX_PER_IN = 96;
export const TWIPS_PER_IN = 1440;

/** Default page for a new letter: the paper size most used where the browser's language is spoken. */
export function defaultPage(): PageSettings {
  const usesLetter = /^(en-US|en-CA|es-MX|fr-CA|en-PH)/i.test(navigator.language || 'en-US');
  return {
    size: usesLetter ? 'letter' : 'a4',
    orientation: 'portrait',
    margins: { ...MARGIN_PRESETS.normal },
    headerDistance: 0.5,
    footerDistance: 0.5,
    color: null,
    border: null,
  };
}

/** Width and height in inches, after orientation. */
export function pageInches(p: PageSettings): { width: number; height: number } {
  const s = PAGE_SIZES[p.size] ?? PAGE_SIZES.letter;
  return p.orientation === 'landscape' ? { width: s.height, height: s.width } : { width: s.width, height: s.height };
}

/** The named size closest to these inches, used when reading a Word file. */
export function nearestSize(widthIn: number, heightIn: number): { size: PageSizeId; orientation: 'portrait' | 'landscape' } {
  const orientation = widthIn > heightIn ? 'landscape' : 'portrait';
  const [w, h] = orientation === 'landscape' ? [heightIn, widthIn] : [widthIn, heightIn];
  let best: PageSizeId = 'letter';
  let bestDiff = Infinity;
  for (const [id, s] of Object.entries(PAGE_SIZES) as [PageSizeId, (typeof PAGE_SIZES)[PageSizeId]][]) {
    const diff = Math.abs(s.width - w) + Math.abs(s.height - h);
    if (diff < bestDiff) { best = id; bestDiff = diff; }
  }
  return { size: best, orientation };
}

/** True when text on this page color should be light. */
export function isDark(color: string | null): boolean {
  if (!color) return false;
  const m = color.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}
