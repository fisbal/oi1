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
  a3: { name: 'A3', width: 11.69, height: 16.54 },
  a6: { name: 'A6', width: 4.13, height: 5.83 },
  b4: { name: 'B4', width: 9.84, height: 13.9 },
  b5: { name: 'B5', width: 6.93, height: 9.84 },
  tabloid: { name: 'Tabloid', width: 11, height: 17 },
  statement: { name: 'Statement', width: 5.5, height: 8.5 },
  folio: { name: 'Folio', width: 8.5, height: 13 },
  quarto: { name: 'Quarto', width: 8.47, height: 10.83 },
  env10: { name: 'Envelope #10', width: 4.13, height: 9.5 },
  dl: { name: 'Envelope DL', width: 4.33, height: 8.66 },
  c5: { name: 'Envelope C5', width: 6.38, height: 9.02 },
  c4: { name: 'Envelope C4', width: 9.02, height: 12.76 },
  postcard: { name: 'Postcard 4 × 6', width: 4, height: 6 },
  card5x7: { name: 'Card 5 × 7', width: 5, height: 7 },
  index: { name: 'Index card 3 × 5', width: 3, height: 5 },
  square: { name: 'Square 8 × 8', width: 8, height: 8 },
} as const;

export type PageSizeId = keyof typeof PAGE_SIZES;

export const MARGIN_PRESETS = {
  normal: { top: 1, right: 1, bottom: 1, left: 1 },
  narrow: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
  moderate: { top: 1, right: 0.75, bottom: 1, left: 0.75 },
  wide: { top: 1, right: 2, bottom: 1, left: 2 },
  office2003: { top: 1, right: 1.25, bottom: 1, left: 1.25 },
  veryNarrow: { top: 0.25, right: 0.25, bottom: 0.25, left: 0.25 },
  binding: { top: 1, right: 1, bottom: 1, left: 1.5 },
  thesis: { top: 1.25, right: 1, bottom: 1, left: 1.5 },
  letterhead: { top: 2, right: 1, bottom: 1, left: 1 },
  envelopeWindow: { top: 1.75, right: 1, bottom: 1, left: 0.8 },
  memo: { top: 0.75, right: 1, bottom: 0.75, left: 1 },
  report: { top: 1.25, right: 1.25, bottom: 1.25, left: 1.25 },
  book: { top: 0.9, right: 0.6, bottom: 0.9, left: 0.8 },
  legalBrief: { top: 1.5, right: 1, bottom: 1, left: 1.5 },
  poster: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 },
  printSafe: { top: 0.4, right: 0.4, bottom: 0.4, left: 0.4 },
  large: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
  extraWide: { top: 2, right: 2, bottom: 2, left: 2 },
  footerRoom: { top: 1, right: 1, bottom: 1.5, left: 1 },
  headerRoom: { top: 1.5, right: 1, bottom: 1, left: 1 },
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
