// Editor pieces Office Letter adds to TipTap: Word paragraph formatting, letter spacing and capitals,
// cell shading, page breaks and page number fields.

import { Extension, Node, mergeAttributes } from '@tiptap/core';

/** A paragraph border side: width and gap in points, color as '#rrggbb'. */
export interface BorderSide { w: number; color: string; space: number }
export type Borders = Partial<Record<'top' | 'right' | 'bottom' | 'left', BorderSide>>;

export interface ParagraphAttrs {
  lineHeight: string | null;
  spaceBefore: number | null;
  spaceAfter: number | null;
  indentLeft: number | null;
  indentRight: number | null;
  indentFirst: number | null;
  background: string | null;
  borders: Borders | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphFormat: {
      /** Set Word paragraph formatting (spacing, indents, shading, borders) on the selected paragraphs. */
      setParagraphFormat: (attrs: Partial<ParagraphAttrs>) => ReturnType;
      /** Set the paragraph style: 'title', 'subtitle', 'quote' or null for Normal. */
      setParagraphStyle: (styleId: string | null) => ReturnType;
    };
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
    pageNumber: {
      insertPageNumber: (kind?: 'page' | 'pages') => ReturnType;
    };
  }
}

/** Reads a CSS length as points. */
export function toPt(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = value.trim().match(/^(-?[\d.]+)(pt|px|in|cm|mm)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2] ?? 'px';
  const pt = unit === 'pt' ? n : unit === 'px' ? n * 0.75 : unit === 'in' ? n * 72 : unit === 'cm' ? n * 72 / 2.54 : n * 72 / 25.4;
  return Math.round(pt * 100) / 100;
}

function cssToHex(value: string): string | null {
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  const m = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/i);
  if (!m || m[4] === '0') return null;
  return `#${[m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function parseBorders(el: HTMLElement): Borders | null {
  const out: Borders = {};
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const s = el.style;
    const style = s.getPropertyValue(`border-${side}-style`);
    if (!style || style === 'none') continue;
    const w = toPt(s.getPropertyValue(`border-${side}-width`)) ?? 0.75;
    const color = cssToHex(s.getPropertyValue(`border-${side}-color`) || '#000000') ?? '#000000';
    const space = toPt(s.getPropertyValue(`padding-${side}`)) ?? 0;
    out[side] = { w, color, space };
  }
  return Object.keys(out).length ? out : null;
}

function bordersCss(b: Borders): string {
  return Object.entries(b)
    .map(([side, v]) => `border-${side}: ${v.w}pt solid ${v.color}; padding-${side}: ${v.space}pt`)
    .join('; ');
}

const ptAttr = (css: string, prop: string) => ({
  default: null,
  parseHTML: (el: HTMLElement) => toPt(el.style.getPropertyValue(prop)),
  renderHTML: (attrs: Record<string, unknown>) => {
    const v = attrs[css] as number | null;
    return v === null || v === undefined ? {} : { style: `${prop}: ${v}pt` };
  },
});

export const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',

  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: el => el.style.lineHeight || null,
          renderHTML: attrs => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {}),
        },
        spaceBefore: ptAttr('spaceBefore', 'margin-top'),
        spaceAfter: ptAttr('spaceAfter', 'margin-bottom'),
        indentLeft: ptAttr('indentLeft', 'margin-left'),
        indentRight: ptAttr('indentRight', 'margin-right'),
        indentFirst: ptAttr('indentFirst', 'text-indent'),
        background: {
          default: null,
          parseHTML: el => (el.style.backgroundColor ? cssToHex(el.style.backgroundColor) : null),
          renderHTML: attrs => (attrs.background ? { style: `background-color: ${attrs.background}` } : {}),
        },
        borders: {
          default: null,
          parseHTML: el => parseBorders(el),
          renderHTML: attrs => (attrs.borders ? { style: bordersCss(attrs.borders as Borders) } : {}),
        },
      },
    }, {
      types: ['paragraph'],
      attributes: {
        styleId: {
          default: null,
          parseHTML: el => el.getAttribute('data-style'),
          renderHTML: attrs => (attrs.styleId ? { 'data-style': attrs.styleId } : {}),
        },
      },
    }];
  },

  addCommands() {
    return {
      setParagraphFormat: attrs => ({ chain }) =>
        chain().updateAttributes('paragraph', attrs).updateAttributes('heading', attrs).run(),
      setParagraphStyle: styleId => ({ chain }) =>
        chain().setParagraph().updateAttributes('paragraph', { styleId }).run(),
    };
  },
});

/** Letter spacing (points) and all capitals on text, kept in the textStyle mark like color and font. */
export const TextStyleExtras = Extension.create({
  name: 'textStyleExtras',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        letterSpacing: {
          default: null,
          parseHTML: el => toPt(el.style.letterSpacing),
          renderHTML: attrs => (attrs.letterSpacing ? { style: `letter-spacing: ${attrs.letterSpacing}pt` } : {}),
        },
        caps: {
          default: null,
          parseHTML: el => (el.style.textTransform === 'uppercase' ? true : null),
          renderHTML: attrs => (attrs.caps ? { style: 'text-transform: uppercase' } : {}),
        },
      },
    }];
  },
});

/** Background color of table cells, like Word's cell shading, and tables drawn without lines. */
export const CellBackground = Extension.create({
  name: 'cellBackground',
  addGlobalAttributes() {
    return [{
      types: ['table'],
      attributes: {
        borders: {
          default: null,
          parseHTML: el => (el.getAttribute('data-borders') === 'none' ? 'none' : null),
          renderHTML: attrs => (attrs.borders === 'none' ? { 'data-borders': 'none' } : {}),
        },
      },
    }, {
      types: ['tableCell', 'tableHeader'],
      attributes: {
        background: {
          default: null,
          parseHTML: el => (el.style.backgroundColor ? cssToHex(el.style.backgroundColor) : el.getAttribute('data-background')),
          renderHTML: attrs => (attrs.background ? { style: `background-color: ${attrs.background}`, 'data-background': attrs.background } : {}),
        },
      },
    }];
  },
});

/** A hard page break. On screen it pushes the next paragraph to the next page; in print it starts a new page. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': '', class: 'page-break' })],
  addCommands() {
    return {
      setPageBreak: () => ({ chain }) => chain().insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }]).run(),
    };
  },
  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.editor.commands.setPageBreak() };
  },
});

/**
 * A page number field ('page') or the number of pages ('pages'). The number itself is drawn by CSS
 * from the --pn and --pt variables of the page it is on, so every page shows its own number.
 */
export const PageNumber = Node.create({
  name: 'pageNumber',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      kind: {
        default: 'page',
        parseHTML: el => (el.getAttribute('data-page-number') === 'pages' ? 'pages' : 'page'),
      },
    };
  },
  parseHTML: () => [{ tag: 'span[data-page-number]' }],
  renderHTML: ({ node }) => ['span', { 'data-page-number': node.attrs.kind, class: 'pnum' }],
  renderText: () => '#',
  addCommands() {
    return {
      insertPageNumber: (kind = 'page') => ({ commands }) => commands.insertContent({ type: 'pageNumber', attrs: { kind } }),
    };
  },
});
