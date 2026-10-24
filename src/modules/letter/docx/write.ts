// Writes Office Letter's document as a real Word .docx file with the docx library.
// Styles become Word styles (Normal, Title, Heading 1...), everything else is direct formatting,
// and the page setup, page color, page border, header and footer go into the section.

import type { JSONContent } from '@tiptap/react';
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel, ImageRun, LevelFormat,
  LineRuleType, Packer, PageBorderDisplay, PageBorderOffsetFrom, PageBreak, PageNumber, PageOrientation, Paragraph,
  ShadingType, Tab, Table, TableCell, TableRow, TextRun, WidthType,
  type IParagraphOptions, type IRunOptions, type ParagraphChild,
} from 'docx';
import type { Borders } from '../extensions';
import { WORD_STYLE_IDS, type LetterDoc, type StyleDef } from '../model';
import { PAGE_SIZES, PX_PER_IN, TWIPS_PER_IN, isDark, pageInches } from '../page';

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED,
};

const pt20 = (pt: number) => Math.round(pt * 20);

/** Turns '#f00', '#ff0000' or 'rgb(255, 0, 0)' into 'FF0000', which Word expects. */
export function toHex(color: string | undefined | null): string | undefined {
  if (!color) return undefined;
  const c = color.trim();
  let m = c.match(/^#([0-9a-f]{3})$/i);
  if (m) return m[1].split('').map(ch => ch + ch).join('').toUpperCase();
  m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) return m[1].toUpperCase();
  m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) return [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
}

/** '12pt', '16px' or '1.5em' as points. */
function sizePt(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined;
  const m = v.match(/^([\d.]+)(pt|px)?$/);
  if (!m) return undefined;
  return m[2] === 'px' ? parseFloat(m[1]) * 0.75 : parseFloat(m[1]);
}

/** The first family of a CSS font list, without quotes: '"Arial", sans-serif' gives 'Arial'. */
function fontName(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  return v.split(',')[0].trim().replace(/^["']|["']$/g, '');
}

function lineSpacing(v: unknown): { line: number; lineRule: (typeof LineRuleType)[keyof typeof LineRuleType] } | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const s = String(v);
  if (s.endsWith('pt')) return { line: pt20(parseFloat(s)), lineRule: LineRuleType.EXACT };
  const n = parseFloat(s);
  return isNaN(n) ? undefined : { line: Math.round(n * 240), lineRule: LineRuleType.AUTO };
}

function borderOptions(b: Borders | null | undefined): IParagraphOptions['border'] {
  if (!b) return undefined;
  const side = (s?: { w: number; color: string; space: number }) =>
    s ? { style: BorderStyle.SINGLE, size: Math.max(2, Math.round(s.w * 8)), color: toHex(s.color) ?? '000000', space: Math.round(s.space) } : undefined;
  return { top: side(b.top), bottom: side(b.bottom), left: side(b.left), right: side(b.right) };
}

function dataUrlToImage(src: string): { data: Uint8Array; type: 'png' | 'jpg' | 'gif' | 'bmp' } | null {
  const m = src.match(/^data:image\/(png|jpe?g|gif|bmp);base64,(.*)$/i);
  if (!m) return null;
  const bin = atob(m[2]);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  const type = m[1].toLowerCase().startsWith('jp') ? 'jpg' : (m[1].toLowerCase() as 'png' | 'gif' | 'bmp');
  return { data, type };
}

/** Pixel size read from the image file itself (PNG, GIF, JPEG, BMP), or null. */
export function headerSize(d: Uint8Array): { width: number; height: number } | null {
  const u32 = (i: number) => (d[i] << 24 | d[i + 1] << 16 | d[i + 2] << 8 | d[i + 3]) >>> 0;
  if (d[0] === 0x89 && d[1] === 0x50) return { width: u32(16), height: u32(20) };
  if (d[0] === 0x47 && d[1] === 0x49) return { width: d[6] | d[7] << 8, height: d[8] | d[9] << 8 };
  if (d[0] === 0x42 && d[1] === 0x4d) return { width: d[18] | d[19] << 8, height: Math.abs((d[22] | d[23] << 8 | d[24] << 16 | d[25] << 24)) };
  if (d[0] === 0xff && d[1] === 0xd8) {
    for (let i = 2; i < d.length - 9;) {
      if (d[i] !== 0xff) { i++; continue; }
      const marker = d[i + 1];
      const len = d[i + 2] << 8 | d[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: d[i + 7] << 8 | d[i + 8], height: d[i + 5] << 8 | d[i + 6] };
      }
      i += 2 + len;
    }
  }
  return null;
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const fallback = { width: 400, height: 300 };
    if (typeof Image === 'undefined') return resolve(fallback);
    const img = new Image();
    const timer = setTimeout(() => resolve(fallback), 2000);
    img.onload = () => { clearTimeout(timer); resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 }); };
    img.onerror = () => { clearTimeout(timer); resolve(fallback); };
    img.src = src;
  });
}

type ListCtx = { kind: 'bullet' | 'number'; level: number; instance: number };

class DocxWriter {
  private listCount = 0;
  private quoteDepth = 0;
  private contentWidthPx: number;

  constructor(contentWidthPx: number) {
    this.contentWidthPx = contentWidthPx;
  }

  async blocks(nodes: JSONContent[] = [], list?: ListCtx): Promise<(Paragraph | Table)[]> {
    const out: (Paragraph | Table)[] = [];
    for (const node of nodes) out.push(...(await this.block(node, list)));
    return out;
  }

  private paragraphOptions(node: JSONContent): Partial<IParagraphOptions> {
    const a = node.attrs ?? {};
    const spacing = {
      ...(a.spaceBefore !== null && a.spaceBefore !== undefined ? { before: pt20(a.spaceBefore) } : {}),
      ...(a.spaceAfter !== null && a.spaceAfter !== undefined ? { after: pt20(a.spaceAfter) } : {}),
      ...lineSpacing(a.lineHeight),
    };
    const left = (a.indentLeft ?? 0) + 36 * this.quoteDepth;
    const indent = {
      ...(left ? { left: pt20(left) } : {}),
      ...(a.indentRight ? { right: pt20(a.indentRight) } : {}),
      ...(a.indentFirst > 0 ? { firstLine: pt20(a.indentFirst) } : a.indentFirst < 0 ? { hanging: pt20(-a.indentFirst) } : {}),
    };
    return {
      alignment: ALIGN[(a.textAlign as string) ?? ''],
      spacing: Object.keys(spacing).length ? spacing : undefined,
      indent: Object.keys(indent).length ? indent : undefined,
      shading: a.background ? { fill: toHex(a.background), type: ShadingType.CLEAR, color: 'auto' } : undefined,
      border: borderOptions(a.borders as Borders | null),
    };
  }

  private async block(node: JSONContent, list?: ListCtx): Promise<(Paragraph | Table)[]> {
    const listOpts: Partial<IParagraphOptions> = list
      ? list.kind === 'bullet'
        ? { bullet: { level: list.level } }
        : { numbering: { reference: 'oi1-numbers', level: list.level, instance: list.instance } }
      : {};

    switch (node.type) {
      case 'paragraph': {
        const styleId = node.attrs?.styleId as string | null;
        const style = styleId === 'title' ? { heading: HeadingLevel.TITLE }
          : styleId === 'subtitle' ? { style: 'Subtitle' } : styleId === 'quote' ? { style: 'Quote' } : {};
        return [new Paragraph({ children: await this.inline(node.content), ...this.paragraphOptions(node), ...style, ...listOpts })];
      }
      case 'heading': {
        const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
        return [new Paragraph({ children: await this.inline(node.content), heading: HEADINGS[level - 1], ...this.paragraphOptions(node), ...listOpts })];
      }
      case 'bulletList':
      case 'orderedList': {
        const kind = node.type === 'bulletList' ? 'bullet' : 'number';
        const level = list ? list.level + 1 : 0;
        const instance = kind === 'number' && !list ? ++this.listCount : list?.instance ?? ++this.listCount;
        const items: (Paragraph | Table)[] = [];
        for (const item of node.content ?? []) items.push(...(await this.blocks(item.content, { kind, level, instance })));
        return items;
      }
      case 'blockquote': {
        this.quoteDepth++;
        const inner = await this.blocks(node.content);
        this.quoteDepth--;
        return inner;
      }
      case 'codeBlock':
        return [new Paragraph({ children: [new TextRun({ text: textOf(node), font: 'Consolas' })] })];
      case 'horizontalRule':
        return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AAAAAA', space: 1 } }, children: [] })];
      case 'pageBreak':
        return [new Paragraph({ children: [new PageBreak()] })];
      case 'image': {
        const run = await this.image(node);
        return [new Paragraph({ children: run ? [run] : [] })];
      }
      case 'table':
        return [await this.table(node)];
      default:
        return node.content ? this.blocks(node.content, list) : [];
    }
  }

  private async table(node: JSONContent): Promise<Table> {
    const rows: TableRow[] = [];
    for (const row of node.content ?? []) {
      const cells: TableCell[] = [];
      for (const cell of row.content ?? []) {
        const children = await this.blocks(cell.content);
        const widths = cell.attrs?.colwidth as number[] | null;
        const bg = toHex(cell.attrs?.background as string);
        cells.push(new TableCell({
          children: children.length ? children : [new Paragraph('')],
          columnSpan: Number(cell.attrs?.colspan) || 1,
          rowSpan: Number(cell.attrs?.rowspan) || 1,
          width: widths?.every(Boolean) ? { size: Math.round(widths.reduce((a, b) => a + b, 0) * 15), type: WidthType.DXA } : undefined,
          shading: bg ? { fill: bg, type: ShadingType.CLEAR, color: 'auto' } : undefined,
        }));
      }
      rows.push(new TableRow({ children: cells, tableHeader: row.content?.[0]?.type === 'tableHeader' }));
    }
    const line = node.attrs?.borders === 'none'
      ? { style: BorderStyle.NONE, size: 0, color: 'auto' }
      : { style: BorderStyle.SINGLE, size: 4, color: 'A6A6A6' };
    return new Table({
      rows, width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
    });
  }

  private async image(node: JSONContent): Promise<ImageRun | null> {
    const src = node.attrs?.src as string | undefined;
    if (!src) return null;
    const img = dataUrlToImage(src);
    if (!img) return null; // linked web images are not embedded
    const size = headerSize(img.data) ?? await imageSize(src);
    const wanted = Number(node.attrs?.width) || size.width;
    const width = Math.min(wanted, this.contentWidthPx);
    const height = Math.round(width * (size.height / size.width));
    return new ImageRun({ data: img.data, type: img.type, transformation: { width: Math.round(width), height } });
  }

  private runOptions(marksList: JSONContent['marks']): IRunOptions {
    const marks = Object.fromEntries((marksList ?? []).map(m => [m.type, m.attrs ?? {}]));
    const ts = marks.textStyle ?? {};
    const highlight = marks.highlight ? toHex(marks.highlight.color as string) ?? 'FFFF00' : toHex(ts.backgroundColor as string);
    const size = sizePt(ts.fontSize);
    const isLink = 'link' in marks;
    return {
      bold: 'bold' in marks || undefined,
      italics: 'italic' in marks || undefined,
      underline: 'underline' in marks || isLink ? {} : undefined,
      strike: 'strike' in marks || undefined,
      superScript: 'superscript' in marks || undefined,
      subScript: 'subscript' in marks || undefined,
      color: isLink && !ts.color ? '0563C1' : toHex(ts.color as string),
      font: 'code' in marks ? 'Consolas' : fontName(ts.fontFamily),
      size: size ? Math.round(size * 2) : undefined,
      characterSpacing: ts.letterSpacing ? pt20(Number(ts.letterSpacing)) : undefined,
      allCaps: ts.caps ? true : undefined,
      shading: highlight ? { fill: highlight, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    };
  }

  async inline(nodes: JSONContent[] = []): Promise<ParagraphChild[]> {
    const out: ParagraphChild[] = [];
    for (const node of nodes) {
      if (node.type === 'hardBreak') { out.push(new TextRun({ break: 1 })); continue; }
      if (node.type === 'image') { const run = await this.image(node); if (run) out.push(run); continue; }
      if (node.type === 'pageNumber') {
        out.push(new TextRun({ ...this.runOptions(node.marks), children: [node.attrs?.kind === 'pages' ? PageNumber.TOTAL_PAGES : PageNumber.CURRENT] }));
        continue;
      }
      if (node.type !== 'text' || !node.text) continue;
      const link = node.marks?.find(m => m.type === 'link')?.attrs?.href as string | undefined;
      // Tabs are their own element in Word.
      const parts = node.text.split('\t');
      const children = parts.flatMap((p, i) => (i ? [new Tab(), p] : [p])).filter(c => c !== '');
      const run = new TextRun({ ...this.runOptions(node.marks), children });
      out.push(link ? new ExternalHyperlink({ link, children: [run] }) : run);
    }
    return out;
  }
}

function textOf(node: JSONContent): string {
  return node.text ?? (node.content ?? []).map(textOf).join('');
}

function runStyle(def: StyleDef) {
  return {
    font: def.font,
    size: def.size ? Math.round(def.size * 2) : undefined,
    color: def.color ? toHex(def.color) : undefined,
    bold: def.bold,
    italics: def.italic,
    allCaps: def.caps,
    characterSpacing: def.letterSpacing ? pt20(def.letterSpacing) : undefined,
  };
}

function paragraphStyle(def: StyleDef) {
  return {
    spacing: { before: pt20(def.before ?? 0), after: pt20(def.after ?? 0), ...lineSpacing(def.lineHeight) },
    alignment: def.align ? ALIGN[def.align] : undefined,
  };
}

export async function letterToDocx(letter: LetterDoc, title: string): Promise<ArrayBuffer> {
  const { page, styles } = letter;
  const inches = pageInches(page);
  const portrait = PAGE_SIZES[page.size] ?? PAGE_SIZES.letter;
  const contentWidthPx = (inches.width - page.margins.left - page.margins.right) * PX_PER_IN;
  const writer = () => new DocxWriter(contentWidthPx);
  const children = await writer().blocks(letter.body.content);
  const header = letter.header?.content?.length ? new Header({ children: await writer().blocks(letter.header.content) }) : undefined;
  const footer = letter.footer?.content?.length ? new Footer({ children: await writer().blocks(letter.footer.content) }) : undefined;

  const normal = { ...styles.normal };
  // "Automatic" text is black in Word even on a dark page, so a dark page gets white text explicitly.
  if (!normal.color && isDark(page.color)) normal.color = '#FFFFFF';
  const tw = (inch: number) => Math.round(inch * TWIPS_PER_IN);
  const border = page.border;
  const borderSide = border ? { style: BorderStyle.SINGLE, size: Math.max(2, Math.round(border.w * 8)), color: toHex(border.color) ?? '000000' } : null;
  const fromPage = border ? border.space <= 31 : true;
  const borderSpace = border ? Math.round(fromPage ? border.space : Math.max(page.margins.top * 72 - border.space, 0)) : 0;

  const document = new Document({
    title,
    creator: 'Office In 1',
    background: page.color ? { color: toHex(page.color) } : undefined,
    styles: {
      default: {
        document: { run: { ...runStyle(normal), language: letter.lang ? { value: letter.lang } : undefined }, paragraph: paragraphStyle(normal) },
        title: { run: runStyle(styles.title), paragraph: paragraphStyle(styles.title) },
        heading1: { run: runStyle(styles.h1), paragraph: paragraphStyle(styles.h1) },
        heading2: { run: runStyle(styles.h2), paragraph: paragraphStyle(styles.h2) },
        heading3: { run: runStyle(styles.h3), paragraph: paragraphStyle(styles.h3) },
        heading4: { run: runStyle(styles.h4), paragraph: paragraphStyle(styles.h4) },
        heading5: { run: runStyle(styles.h5), paragraph: paragraphStyle(styles.h5) },
        heading6: { run: runStyle(styles.h6), paragraph: paragraphStyle(styles.h6) },
      },
      paragraphStyles: (['subtitle', 'quote'] as const).map(id => ({
        id: WORD_STYLE_IDS[id], name: WORD_STYLE_IDS[id], basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: runStyle(styles[id]), paragraph: paragraphStyle(styles[id]),
      })),
    },
    numbering: {
      config: [{
        reference: 'oi1-numbers',
        levels: [0, 1, 2, 3, 4, 5].map(level => ({
          level,
          format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3],
          text: `%${level + 1}.`,
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
        })),
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: tw(portrait.width), height: tw(portrait.height), orientation: page.orientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: {
            top: tw(page.margins.top), right: tw(page.margins.right), bottom: tw(page.margins.bottom), left: tw(page.margins.left),
            header: tw(page.headerDistance), footer: tw(page.footerDistance),
          },
          borders: borderSide ? {
            pageBorders: { display: PageBorderDisplay.ALL_PAGES, offsetFrom: fromPage ? PageBorderOffsetFrom.PAGE : PageBorderOffsetFrom.TEXT },
            pageBorderTop: { ...borderSide, space: borderSpace }, pageBorderRight: { ...borderSide, space: borderSpace },
            pageBorderBottom: { ...borderSide, space: borderSpace }, pageBorderLeft: { ...borderSide, space: borderSpace },
          } : undefined,
        },
      },
      headers: header ? { default: header } : undefined,
      footers: footer ? { default: footer } : undefined,
      children: children.length ? children : [new Paragraph('')],
    }],
  });
  return Packer.toArrayBuffer(document);
}
