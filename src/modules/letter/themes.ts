// Document themes for the Design tab: one click gives a letter its fonts, heading colors and page color.
// They only set Word styles and the page color, so a themed letter saves to .docx like any other.

import type { MessageKey } from '../../shell/i18n';
import { defaultStyles, type DocStyles, type StyleDef, type StyleId } from './model';

export interface Theme {
  id: string;
  name: MessageKey;
  page: string | null;
  styles: DocStyles;
  /** Colors for the callout boxes on this theme's pages. */
  dark?: boolean;
}

function theme(id: string, name: MessageKey, page: string | null, body: StyleDef, heading: StyleDef, extra: Partial<Record<StyleId, StyleDef>> = {}, dark = false): Theme {
  const base = defaultStyles();
  const styles = { ...base } as DocStyles;
  styles.normal = { ...base.normal, ...body };
  for (const [i, id2] of (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).entries()) {
    styles[id2] = { ...base[id2], ...heading, size: [18, 14, 12, 11, 11, 11][i] ?? 11, ...(extra[id2] ?? {}) };
  }
  styles.title = { ...base.title, ...heading, size: 30, ...(extra.title ?? {}) };
  styles.subtitle = { ...base.subtitle, ...(extra.subtitle ?? {}) };
  styles.quote = { ...base.quote, ...(extra.quote ?? {}) };
  return { id, name, page, styles, dark };
}

export const THEMES: Theme[] = [
  { id: 'office', name: 'letter.theme.office', page: null, styles: defaultStyles() },
  theme('scene', 'letter.theme.scene', '#0E0E13',
    { font: 'DM Sans', color: '#F0EDE6', size: 11, lineHeight: 1.4, after: 9 },
    { font: 'Playfair Display', color: '#D4A843', bold: true, before: 18, after: 6 },
    {
      title: { color: '#F2D78B', letterSpacing: -0.5, size: 32 },
      subtitle: { font: 'DM Sans', color: '#C9A961', caps: true, letterSpacing: 2.4, size: 10, after: 14 },
      h2: { color: '#F2D78B' },
      h3: { font: 'DM Sans', color: '#D4A843', caps: true, letterSpacing: 1.2, size: 10.5 },
      quote: { font: 'Playfair Display', italic: true, color: '#C9C3B6', size: 13 },
    }, true),
  theme('classic', 'letter.theme.classic', null,
    { font: 'Georgia', size: 11, lineHeight: 1.3 },
    { font: 'Georgia', color: '#1F3864', bold: true },
    { title: { color: '#1F3864', align: 'center' }, subtitle: { align: 'center', italic: true, color: '#595959' } }),
  theme('modern', 'letter.theme.modern', null,
    { font: 'Segoe UI', size: 10.5, lineHeight: 1.35, color: '#262626' },
    { font: 'Segoe UI', color: '#0F7C80', bold: true },
    { title: { caps: true, letterSpacing: 3, size: 26, color: '#0F7C80' }, subtitle: { caps: true, letterSpacing: 1.5, color: '#7F7F7F', size: 10 } }),
  theme('elegant', 'letter.theme.elegant', '#FBF8F1',
    { font: 'Garamond', size: 12, lineHeight: 1.3, color: '#2B2B2B' },
    { font: 'Garamond', color: '#7A1F3D', bold: false },
    { title: { italic: true, size: 34 }, h1: { italic: true }, subtitle: { italic: true, color: '#8C6D58' } }),
  theme('ocean', 'letter.theme.ocean', '#0B1E33',
    { font: 'Calibri', color: '#E6EEF5', size: 11, lineHeight: 1.3 },
    { font: 'Calibri Light', color: '#5FB8E8' },
    { title: { color: '#9FD8F5' }, subtitle: { color: '#7FA7C8' }, quote: { color: '#B9CBDB' } }, true),
  theme('forest', 'letter.theme.forest', '#F4F1E8',
    { font: 'Cambria', size: 11, color: '#28302A', lineHeight: 1.3 },
    { font: 'Cambria', color: '#2E5E3A', bold: true },
    { subtitle: { color: '#6B7F5E' } }),
  theme('mono', 'letter.theme.mono', null,
    { font: 'Consolas', size: 10, lineHeight: 1.45, color: '#1A1A1A' },
    { font: 'Consolas', color: '#000000', bold: true },
    { title: { caps: true, letterSpacing: 2, size: 22 }, subtitle: { color: '#666666' } }),
  theme('corporate', 'letter.theme.corporate', null,
    { font: 'Calibri', size: 11, lineHeight: 1.15, color: '#262626' },
    { font: 'Calibri', color: '#1F4E79', bold: true },
    { title: { color: '#1F4E79', size: 28 }, subtitle: { color: '#5B9BD5' } }),
  theme('academic', 'letter.theme.academic', null,
    { font: 'Times New Roman', size: 12, lineHeight: 2, color: '#000000' },
    { font: 'Times New Roman', color: '#000000', bold: true },
    { title: { align: 'center', size: 16 }, subtitle: { align: 'center', italic: true, color: '#000000' } }),
  theme('official', 'letter.theme.official', null,
    { font: 'Arial', size: 11, lineHeight: 1.2, color: '#333333' },
    { font: 'Arial', color: '#26374A', bold: true },
    { title: { color: '#26374A', size: 24 }, subtitle: { color: '#AF3C43', caps: true, letterSpacing: 1, size: 10 } }),
  theme('military', 'letter.theme.military', '#F7F6F0',
    { font: 'Arial', size: 11, lineHeight: 1.15, color: '#1F2216' },
    { font: 'Arial', color: '#4B5320', bold: true },
    { title: { caps: true, letterSpacing: 2, size: 22, color: '#3A4019' }, h1: { caps: true }, subtitle: { color: '#6B7A3A', caps: true, size: 10 } }),
  theme('sunset', 'letter.theme.sunset', '#FFF8F0',
    { font: 'Georgia', size: 11, lineHeight: 1.35, color: '#3B2A22' },
    { font: 'Georgia', color: '#C0504D', bold: true },
    { title: { color: '#D9733F' }, subtitle: { color: '#B07A5A', italic: true } }),
  theme('lavender', 'letter.theme.lavender', '#F8F5FC',
    { font: 'EB Garamond', size: 12, lineHeight: 1.35, color: '#2E2638' },
    { font: 'EB Garamond', color: '#6A4C93', bold: false },
    { title: { italic: true, size: 32 }, subtitle: { color: '#9A86B8', italic: true } }),
  theme('slate', 'letter.theme.slate', null,
    { font: 'Inter', size: 10.5, lineHeight: 1.4, color: '#263238' },
    { font: 'Inter', color: '#37474F', bold: true },
    { title: { size: 28, letterSpacing: -0.5 }, subtitle: { color: '#78909C' } }),
  theme('newspaper', 'letter.theme.newspaper', '#FBFAF6',
    { font: 'Merriweather', size: 10.5, lineHeight: 1.45, color: '#1A1A1A' },
    { font: 'Playfair Display', color: '#000000', bold: true },
    { title: { caps: true, align: 'center', letterSpacing: 1, size: 34 }, subtitle: { align: 'center', caps: true, letterSpacing: 3, size: 9, color: '#555555' } }),
  theme('handwritten', 'letter.theme.handwritten', '#FFFDF7',
    { font: 'Caveat', size: 15, lineHeight: 1.3, color: '#2B2B4A' },
    { font: 'Dancing Script', color: '#3B3B7A', bold: true },
    { title: { size: 36 }, subtitle: { font: 'Caveat', color: '#6A6A9A' } }),
  theme('midnight', 'letter.theme.midnight', '#121826',
    { font: 'Inter', color: '#E3E8F2', size: 11, lineHeight: 1.4 },
    { font: 'Inter', color: '#8AB4F8', bold: true },
    { title: { color: '#AECBFA' }, subtitle: { color: '#8C9BB5' }, quote: { color: '#B8C4D9' } }, true),
  theme('emerald', 'letter.theme.emerald', null,
    { font: 'Montserrat', size: 10.5, lineHeight: 1.35, color: '#1E2B26' },
    { font: 'Montserrat', color: '#0B6E4F', bold: true },
    { title: { caps: true, letterSpacing: 2, size: 26 }, subtitle: { color: '#3E9A7A', caps: true, size: 10 } }),
  theme('royal', 'letter.theme.royal', '#FDFBF5',
    { font: 'Lora', size: 11.5, lineHeight: 1.35, color: '#1C2340' },
    { font: 'Playfair Display', color: '#1B2A6B', bold: true },
    { title: { size: 34, align: 'center' }, subtitle: { color: '#B08D2E', align: 'center', caps: true, letterSpacing: 2, size: 10 } }),
];

/** Space between paragraphs and lines, like Word's Design > Paragraph Spacing. */
export const SPACING = {
  none: { after: 0, lineHeight: 1 },
  tight: { after: 2, lineHeight: 1 },
  compact: { after: 4, lineHeight: 1 },
  snug: { after: 6, lineHeight: 1.08 },
  word2003: { after: 0, lineHeight: 1.15 },
  word2007: { after: 10, lineHeight: 1.15 },
  normal: { after: 8, lineHeight: 1.15 },
  report: { after: 6, lineHeight: 1.2 },
  book: { after: 0, lineHeight: 1.3 },
  open: { after: 10, lineHeight: 1.25 },
  comfortable: { after: 12, lineHeight: 1.3 },
  screen: { after: 12, lineHeight: 1.4 },
  presentation: { after: 14, lineHeight: 1.35 },
  relaxed: { after: 12, lineHeight: 1.5 },
  oneHalf: { after: 8, lineHeight: 1.5 },
  airy: { after: 16, lineHeight: 1.5 },
  loose: { after: 18, lineHeight: 1.6 },
  double: { after: 8, lineHeight: 2 },
  academic: { after: 0, lineHeight: 2 },
  triple: { after: 8, lineHeight: 3 },
} as const;
export type SpacingId = keyof typeof SPACING;
