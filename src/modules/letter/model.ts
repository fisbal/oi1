// The whole letter as In 1 Letter keeps it: body, header, footer, page setup and styles.
// Word files are read into this shape and written back from it (see docx/read.ts and docx/write.ts).

import type { JSONContent } from '@tiptap/react';
import type { CSSProperties } from 'react';
import { BUNDLED_FONTS, bundledFamily, type FontKind } from '../../ui/fonts';
import { defaultPage, isDark, type PageSettings } from './page';
import type { LetterComment } from './review';

/** One paragraph style, like Word's Normal or Heading 1. Sizes and spacing are in points. */
export interface StyleDef {
  font?: string;
  size?: number;
  color?: string | null;
  bold?: boolean;
  italic?: boolean;
  caps?: boolean;
  letterSpacing?: number;
  before?: number;
  after?: number;
  /** A multiple like 1.15, or exact points like '14pt'. */
  lineHeight?: number | string;
  align?: 'left' | 'center' | 'right' | 'justify';
  /** First-line indent of each paragraph, in points (academic layouts: 5 spaces, about 36 pt). */
  indent?: number;
}

export const STYLE_IDS = ['normal', 'title', 'subtitle', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'quote'] as const;
export type StyleId = (typeof STYLE_IDS)[number];
export type DocStyles = Record<StyleId, StyleDef>;

/** Word's names for our styles, used in .docx files. */
export const WORD_STYLE_IDS: Record<StyleId, string> = {
  normal: 'Normal', title: 'Title', subtitle: 'Subtitle', quote: 'Quote',
  h1: 'Heading1', h2: 'Heading2', h3: 'Heading3', h4: 'Heading4', h5: 'Heading5', h6: 'Heading6',
};

export interface LetterDoc {
  body: JSONContent;
  header: JSONContent | null;
  footer: JSONContent | null;
  page: PageSettings;
  styles: DocStyles;
  /** Proofing language of the text, like 'en-US'. */
  lang?: string;
  /** What the comments say; the text they are about carries a comment mark with the same id. */
  comments?: LetterComment[];
  /** Track changes is on (Review > Track changes), saved with the file like in Word. */
  track?: boolean;
}

/** The look of a new letter, close to Word's own defaults. */
export function defaultStyles(): DocStyles {
  const heading = { font: 'Calibri Light', color: '#2F5496', before: 12, after: 4, lineHeight: 1.08 };
  return {
    normal: { font: 'Calibri', size: 11, color: null, before: 0, after: 8, lineHeight: 1.15 },
    title: { font: 'Calibri Light', size: 28, letterSpacing: -0.5, after: 4, lineHeight: 1 },
    subtitle: { size: 13, color: '#5A5A5A', letterSpacing: 0.75, after: 8 },
    h1: { ...heading, size: 16 },
    h2: { ...heading, size: 13, before: 10 },
    h3: { ...heading, size: 12, color: '#1F3763', before: 8 },
    h4: { ...heading, size: 11, italic: true, before: 8 },
    h5: { ...heading, size: 11, before: 6 },
    h6: { ...heading, size: 11, color: '#1F3763', before: 6 },
    quote: { italic: true, color: '#404040', align: 'center', before: 10, after: 8 },
  };
}

/** A new letter, as in Word: an empty page with the cursor at the top (no title written into the text). */
export function blankDoc(): LetterDoc {
  return { ...emptyDoc(''), body: { type: 'doc', content: [{ type: 'paragraph' }] } };
}

/**
 * The name Word suggests when a new document is saved for the first time: its first line (a few words), or the
 * default name when the page is still empty. The tab keeps the default name until then.
 */
export function suggestedName(text: string, fallback: string): string {
  const first = text.split('\n').map(l => l.trim()).find(Boolean) ?? '';
  const words = first.replace(/[\\/:*?"<>|]+/g, ' ').split(/\s+/).filter(Boolean);
  let out = '';
  for (const w of words) { if ((out + ' ' + w).trim().length > 40) break; out = (out + ' ' + w).trim(); }
  return (out || first.slice(0, 40)).replace(/[.,;:!?…]+$/u, '').trim() || fallback;
}

export function emptyDoc(title: string): LetterDoc {
  return {
    body: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] }, { type: 'paragraph' }] },
    header: null,
    footer: null,
    page: defaultPage(),
    styles: defaultStyles(),
  };
}

/** Fonts offered in the font box. Fonts used by an open document are added to it. */
/** Microsoft Office's usual fonts: Word files use them, and OI1 shows a free look-alike where they are missing. */
export const OFFICE_FONTS = [
  'Arial', 'Arial Black', 'Calibri', 'Calibri Light', 'Cambria', 'Candara', 'Century Gothic', 'Comic Sans MS',
  'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Franklin Gothic Medium', 'Garamond', 'Georgia', 'Helvetica',
  'Impact', 'Lucida Sans', 'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
];

/** Every font in the font menu, by group. The bundled ones look the same on every device. */
export const FONT_GROUPS: { kind: 'office' | Exclude<FontKind, 'alike'>; fonts: string[] }[] = [
  { kind: 'office', fonts: OFFICE_FONTS },
  ...(['sans', 'serif', 'display', 'hand', 'mono'] as const).map(kind => ({
    kind, fonts: BUNDLED_FONTS.filter(f => f.kind === kind).map(f => f.name).sort((a, b) => a.localeCompare(b)),
  })),
];
export const FONTS = FONT_GROUPS.flatMap(g => g.fonts);

export const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

// Free look-alikes that ship with Linux and LibreOffice, so a Word file looks right without Microsoft fonts.
const LOOKALIKES: Record<string, string> = {
  calibri: 'Carlito', 'calibri light': 'Carlito', cambria: 'Caladea', arial: 'Arimo Variable', helvetica: 'Arimo Variable',
  'arial black': 'Archivo Black', 'times new roman': 'Tinos', times: 'Tinos', 'courier new': 'Cousine', courier: 'Cousine', consolas: 'Cousine',
  georgia: 'Gelasio Variable', garamond: 'EB Garamond Variable', 'palatino linotype': 'PT Serif', 'book antiqua': 'PT Serif', constantia: 'PT Serif',
  'segoe ui': 'Noto Sans Variable', tahoma: 'Noto Sans Variable', verdana: 'Noto Sans Variable', 'lucida sans': 'Noto Sans Variable',
  'trebuchet ms': 'Source Sans 3 Variable', candara: 'Nunito Variable', corbel: 'Open Sans Variable', 'century gothic': 'Quicksand Variable',
  'franklin gothic medium': 'Work Sans Variable', impact: 'Oswald Variable', 'comic sans ms': 'Comfortaa Variable',
};
const SERIF = /times|georgia|garamond|cambria|palatino|constantia|serif|book|minion|baskerville|lora|merriweather|crimson|caladea|tinos|gelasio|playfair|abril/i;
const MONO = /courier|consolas|mono|code/i;

/** A CSS font-family list for a Word font name. */
export function cssFont(name: string): string {
  const quoted = `"${name.replace(/"/g, '')}"`;
  const alike = bundledFamily(name) ?? LOOKALIKES[name.toLowerCase()];
  const generic = MONO.test(name) ? 'monospace' : SERIF.test(name) ? 'serif' : 'sans-serif';
  return [quoted, alike && `"${alike}"`, generic].filter(Boolean).join(', ');
}

function cssLineHeight(v: number | string | undefined): string | undefined {
  if (v === undefined) return undefined;
  // Word's "single" spacing is the font's own line height (about 1.2 for Calibri), which CSS calls normal.
  if (v === 1 || v === '1') return 'normal';
  return typeof v === 'number' ? String(v) : v;
}

function rule(def: StyleDef, inherit: StyleDef | null): string {
  const parts: string[] = [];
  if (def.font) parts.push(`font-family: ${cssFont(def.font)}`);
  if (def.size) parts.push(`font-size: ${def.size}pt`);
  if (def.color) parts.push(`color: ${def.color}`);
  else if (inherit) parts.push('color: inherit');
  if (def.bold !== undefined || inherit) parts.push(`font-weight: ${def.bold ? 700 : 400}`);
  if (def.italic !== undefined || inherit) parts.push(`font-style: ${def.italic ? 'italic' : 'normal'}`);
  if (def.caps) parts.push('text-transform: uppercase');
  if (def.letterSpacing) parts.push(`letter-spacing: ${def.letterSpacing}pt`);
  const lh = cssLineHeight(def.lineHeight);
  if (lh) parts.push(`line-height: ${lh}`);
  const before = def.before ?? inherit?.before ?? 0;
  const after = def.after ?? inherit?.after ?? 0;
  parts.push(`margin-top: ${before}pt`, `margin-bottom: ${after}pt`);
  if (def.align) parts.push(`text-align: ${def.align}`);
  if (def.indent) parts.push(`text-indent: ${def.indent}pt`);
  return parts.join('; ');
}

/** CSS that shows a document's styles, for everything inside `scope`. */
export function stylesCss(styles: DocStyles, page: PageSettings, scope: string): string {
  const n = styles.normal;
  const autoColor = isDark(page.color) ? '#FFFFFF' : '#000000';
  const base = [
    n.font && `font-family: ${cssFont(n.font)}`,
    `font-size: ${n.size ?? 11}pt`,
    `color: ${n.color ?? autoColor}`,
    `line-height: ${cssLineHeight(n.lineHeight) ?? '1.15'}`,
  ].filter(Boolean).join('; ');
  const lines = [
    `${scope} .doc-text { ${base} }`,
    `${scope} .doc-text p { margin-top: ${n.before ?? 0}pt; margin-bottom: ${n.after ?? 0}pt${n.indent ? `; text-indent: ${n.indent}pt` : ''}${n.align ? `; text-align: ${n.align}` : ''} }`,
    // The first-line indent is for running text only, not lists or table cells.
    ...(n.indent ? [`${scope} .doc-text li p, ${scope} .doc-text td p, ${scope} .doc-text th p { text-indent: 0 }`] : []),
  ];
  for (let level = 1; level <= 6; level++) {
    lines.push(`${scope} .doc-text h${level} { ${rule(styles[`h${level}` as StyleId], n)} }`);
  }
  for (const id of ['title', 'subtitle', 'quote'] as const) {
    lines.push(`${scope} .doc-text p[data-style="${id}"] { ${rule(styles[id], n)} }`);
  }
  return lines.join('\n');
}

/** Inline CSS for a style's preview in the styles gallery. */
export function previewStyle(def: StyleDef, normal: StyleDef): CSSProperties {
  return {
    fontFamily: cssFont(def.font ?? normal.font ?? 'Calibri'),
    fontSize: `${Math.min(def.size ?? normal.size ?? 11, 16)}pt`,
    color: def.color ?? undefined,
    fontWeight: def.bold ? 700 : 400,
    fontStyle: def.italic ? 'italic' : 'normal',
    textTransform: def.caps ? 'uppercase' : undefined,
  };
}
