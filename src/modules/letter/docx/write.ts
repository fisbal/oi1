// Writes Office Letter's document as a real Word .docx file with the docx library.
// Styles become Word styles (Normal, Title, Heading 1...), everything else is direct formatting,
// and the page setup, page color, page border, header and footer go into the section.

import type { JSONContent } from '@tiptap/react';
import {
  AlignmentType, BorderStyle, CommentRangeEnd, CommentRangeStart, CommentReference, DeletedTextRun, Document, ExternalHyperlink,
  Footer, FootnoteReferenceRun, Header, HeadingLevel, ImageRun, InsertedTextRun, LevelFormat,
  LineRuleType, Packer, PageBorderDisplay, PageBorderOffsetFrom, PageBreak, PageNumber, PageOrientation, Paragraph,
  ShadingType, Tab, Table, TableCell, TableRow, TextRun, WidthType,
  type ICommentOptions, type IParagraphOptions, type IRunOptions, type ParagraphChild,
} from 'docx';
import JSZip from 'jszip';
import { BULLET_CHARS, BULLET_STYLES, NUMBER_FORMATS, type BorderSide, type Borders } from '../extensions';
import { WORD_STYLE_IDS, type LetterDoc, type StyleDef } from '../model';
import { PAGE_SIZES, PX_PER_IN, TWIPS_PER_IN, isDark, pageInches, type Watermark } from '../page';
import { initials, type LetterComment } from '../review';

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
  const kinds = { double: BorderStyle.DOUBLE, dashed: BorderStyle.DASHED, dotted: BorderStyle.DOTTED };
  const side = (s?: BorderSide) =>
    s ? { style: s.style ? kinds[s.style] : BorderStyle.SINGLE, size: Math.max(2, Math.round(s.w * 8)), color: toHex(s.color) ?? '000000', space: Math.round(s.space) } : undefined;
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

const COUNTER_FORMATS = {
  decimal: LevelFormat.DECIMAL, 'decimal-leading-zero': LevelFormat.DECIMAL_ZERO, 'lower-alpha': LevelFormat.LOWER_LETTER,
  'upper-alpha': LevelFormat.UPPER_LETTER, 'lower-roman': LevelFormat.LOWER_ROMAN, 'upper-roman': LevelFormat.UPPER_ROMAN,
} as const;
const NUMBER_DEFS: Record<string, { format: (typeof LevelFormat)[keyof typeof LevelFormat]; text: (n: number) => string }> = Object.fromEntries(
  Object.entries(NUMBER_FORMATS).map(([id, f]) => [id, { format: COUNTER_FORMATS[f.counter], text: (n: number) => `${f.before}%${n}${f.after}` }]),
);

const listReference = (kind: 'bullet' | 'number', style: string | null) =>
  kind === 'bullet' ? `oi1-bullet-${style}` : style && NUMBER_DEFS[style] ? `oi1-num-${style}` : 'oi1-numbers';

/** Word numbering definitions: the default numbers, plus one per bullet shape and number format. */
function numberingConfig() {
  const indent = (level: number) => ({ paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } });
  const deeper = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN];
  const levels = [0, 1, 2, 3, 4, 5];
  return [
    { reference: 'oi1-numbers', levels: levels.map(level => ({ level, format: deeper[level % 3], text: `%${level + 1}.`, alignment: AlignmentType.START, style: indent(level) })) },
    ...Object.entries(NUMBER_DEFS).map(([id, f]) => ({
      reference: `oi1-num-${id}`,
      levels: levels.map(level => ({
        level, format: level === 0 ? f.format : deeper[level % 3], text: level === 0 ? f.text(1) : `%${level + 1}.`, alignment: AlignmentType.START, style: indent(level),
      })),
    })),
    ...BULLET_STYLES.map(id => ({
      reference: `oi1-bullet-${id}`,
      levels: levels.map(level => ({ level, format: LevelFormat.BULLET, text: BULLET_CHARS[id], alignment: AlignmentType.START, style: indent(level) })),
    })),
  ];
}

type ListCtx = { kind: 'bullet' | 'number'; level: number; instance: number; style: string | null };

/** What the letter's body carries beyond text: comment ranges, tracked changes and footnotes, in Word's numbering. */
class Annotations {
  /** Word ids of each comment and of its replies, which share the comment's range. */
  readonly commentIds = new Map<string, number[]>();
  /** Inline pieces still to come for each comment, so its range ends after the last one. */
  private readonly remaining = new Map<string, number>();
  private readonly started = new Set<string>();
  readonly comments: ICommentOptions[] = [];
  readonly footnotes: Record<string, { children: Paragraph[] }> = {};
  private footnoteCount = 0;
  private revision = 0;
  readonly author: string;

  constructor(body: JSONContent, comments: LetterComment[], author: string) {
    this.author = author;
    const visit = (n: JSONContent) => {
      for (const m of n.marks ?? []) {
        if (m.type === 'comment' && m.attrs?.id) this.remaining.set(m.attrs.id, (this.remaining.get(m.attrs.id) ?? 0) + 1);
      }
      n.content?.forEach(visit);
    };
    visit(body);
    let next = 0;
    for (const c of comments) {
      if (!this.remaining.has(c.id)) continue; // its text is gone
      const ids: number[] = [];
      const parentId = next;
      for (const [i, part] of [c, ...(c.replies ?? [])].entries()) {
        const id = next++;
        ids.push(id);
        this.comments.push({
          id, author: part.author, initials: initials(part.author), date: new Date(part.date),
          children: (part.text || ' ').split('\n').map(line => new Paragraph({ children: [new TextRun(line)] })),
          ...(i ? { parentId } : {}), ...(c.resolved ? { resolved: true } : {}),
        });
      }
      this.commentIds.set(c.id, ids);
    }
  }

  /** Range starts for comments that begin at this inline piece. */
  before(marks: JSONContent['marks']): ParagraphChild[] {
    const out: ParagraphChild[] = [];
    for (const id of commentIdsOf(marks)) {
      if (this.started.has(id) || !this.commentIds.has(id)) continue;
      this.started.add(id);
      for (const n of this.commentIds.get(id)!) out.push(new CommentRangeStart(n));
    }
    return out;
  }

  /** Range ends and the comment marks, after the last piece of a comment. */
  after(marks: JSONContent['marks']): ParagraphChild[] {
    const out: ParagraphChild[] = [];
    for (const id of commentIdsOf(marks)) {
      const left = (this.remaining.get(id) ?? 1) - 1;
      this.remaining.set(id, left);
      if (left > 0 || !this.commentIds.has(id)) continue;
      for (const n of this.commentIds.get(id)!) out.push(new CommentRangeEnd(n), new TextRun({ children: [new CommentReference(n)] }));
    }
    return out;
  }

  footnote(text: string): number {
    const id = ++this.footnoteCount;
    this.footnotes[id] = { children: text.split('\n').map(line => new Paragraph({ children: [new TextRun(line)] })) };
    return id;
  }

  revisionId(): number { return ++this.revision; }
}

function commentIdsOf(marks: JSONContent['marks']): string[] {
  return (marks ?? []).filter(m => m.type === 'comment' && m.attrs?.id).map(m => m.attrs!.id as string);
}

/** The tracked change on a piece of text, from its own marks or its paragraph's. */
function revisionOf(marks: JSONContent['marks'], block: JSONContent['marks']): { kind: 'insertion' | 'deletion'; author?: string; date?: string } | null {
  const m = (marks ?? []).find(x => x.type === 'insertion' || x.type === 'deletion') ?? (block ?? []).find(x => x.type === 'insertion' || x.type === 'deletion');
  return m ? { kind: m.type as 'insertion' | 'deletion', author: m.attrs?.author ?? undefined, date: m.attrs?.date ?? undefined } : null;
}

class DocxWriter {
  private listCount = 0;
  private quoteDepth = 0;
  private contentWidthPx: number;
  private notes: Annotations | null;
  /** Insertion or deletion marks on the paragraph being written. */
  private blockMarks: JSONContent['marks'] = [];

  constructor(contentWidthPx: number, notes: Annotations | null = null) {
    this.contentWidthPx = contentWidthPx;
    this.notes = notes;
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
    const outer = this.blockMarks;
    const own = (node.marks ?? []).filter(m => m.type === 'insertion' || m.type === 'deletion');
    if (own.length) this.blockMarks = own;
    try {
      return await this.blockInner(node, list);
    } finally {
      this.blockMarks = outer;
    }
  }

  private async blockInner(node: JSONContent, list?: ListCtx): Promise<(Paragraph | Table)[]> {
    const listOpts: Partial<IParagraphOptions> = list
      ? list.kind === 'bullet' && !list.style
        ? { bullet: { level: list.level } }
        : { numbering: { reference: listReference(list.kind, list.style), level: list.level, instance: list.instance } }
      : {};

    switch (node.type) {
      case 'paragraph': {
        const styleId = node.attrs?.styleId as string | null;
        const style = styleId === 'title' ? { heading: HeadingLevel.TITLE }
          : styleId === 'subtitle' ? { style: 'Subtitle' } : styleId === 'quote' ? { style: 'Quote' } : styleId === 'caption' ? { style: 'Caption' } : {};
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
        // A list keeps its own style; a list nested inside takes the parent's unless it sets one.
        const style = (node.attrs?.listStyle as string | null) ?? (list?.kind === kind ? list.style : null);
        const items: (Paragraph | Table)[] = [];
        for (const item of node.content ?? []) items.push(...(await this.blocks(item.content, { kind, level, instance, style })));
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
    const alt = (node.attrs?.alt as string | undefined) ?? '';
    return new ImageRun({
      data: img.data, type: img.type, transformation: { width: Math.round(width), height },
      ...(alt ? { altText: { name: alt.slice(0, 60), description: alt, title: alt.slice(0, 60) } } : {}),
    });
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
      // Comment ranges open before the piece they start at and close after their last piece.
      if (this.notes) out.push(...this.notes.before(node.marks));
      out.push(...(await this.piece(node)));
      if (this.notes) out.push(...this.notes.after(node.marks));
    }
    return out;
  }

  private async piece(node: JSONContent): Promise<ParagraphChild[]> {
    if (node.type === 'hardBreak') return [new TextRun({ break: 1 })];
    if (node.type === 'image') { const run = await this.image(node); return run ? [run] : []; }
    if (node.type === 'pageNumber') {
      return [new TextRun({ ...this.runOptions(node.marks), children: [node.attrs?.kind === 'pages' ? PageNumber.TOTAL_PAGES : PageNumber.CURRENT] })];
    }
    const notes = this.notes;
    if (node.type === 'footnote') return notes ? [new FootnoteReferenceRun(notes.footnote(String(node.attrs?.text ?? '')))] : [];
    // Zero-width spaces only anchor tracked paragraph changes in the editor.
    const text = node.type === 'text' ? (node.text ?? '').replace(/\u200B/g, '') : '';
    if (!text) return [];
    const rev = notes ? revisionOf(node.marks, this.blockMarks) : null;
    if (rev && notes) {
      const change = { id: notes.revisionId(), author: rev.author ?? notes.author, date: rev.date ?? new Date().toISOString() };
      return [rev.kind === 'insertion'
        ? new InsertedTextRun({ ...this.runOptions(node.marks), ...change, text })
        : new DeletedTextRun({ ...this.runOptions(node.marks), ...change, text })];
    }
    const link = node.marks?.find(m => m.type === 'link')?.attrs?.href as string | undefined;
    // Tabs are their own element in Word.
    const parts = text.split('\t');
    const children = parts.flatMap((p, i) => (i ? [new Tab(), p] : [p])).filter(c => c !== '');
    const run = new TextRun({ ...this.runOptions(node.marks), children });
    return [link ? new ExternalHyperlink({ link, children: [run] }) : run];
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

export async function letterToDocx(letter: LetterDoc, title: string, author = 'Office In 1'): Promise<ArrayBuffer> {
  const { page, styles } = letter;
  const inches = pageInches(page);
  const portrait = PAGE_SIZES[page.size] ?? PAGE_SIZES.letter;
  const contentWidthPx = (inches.width - page.margins.left - page.margins.right) * PX_PER_IN;
  const writer = () => new DocxWriter(contentWidthPx);
  const notes = new Annotations(letter.body, letter.comments ?? [], author);
  const children = await new DocxWriter(contentWidthPx, notes).blocks(letter.body.content);
  // A watermark lives in the header, so a letter with one always has a header.
  const header = letter.header?.content?.length ? new Header({ children: await writer().blocks(letter.header.content) })
    : page.watermark ? new Header({ children: [new Paragraph('')] }) : undefined;
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
    comments: notes.comments.length ? { children: notes.comments } : undefined,
    footnotes: Object.keys(notes.footnotes).length ? notes.footnotes : undefined,
    features: letter.track ? { trackRevisions: true } : undefined,
    background: page.color ? { color: toHex(page.color) } : undefined,
    hyphenation: page.hyphenate ? { autoHyphenation: true } : undefined,
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
      })).concat([{
        // Word's own Caption style, for the numbered captions of References > Insert caption.
        id: 'Caption', name: 'caption', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { italics: true, size: 18, color: '44546A' }, paragraph: { spacing: { after: 200 } },
      } as never]),
    },
    numbering: { config: numberingConfig() },
    sections: [{
      properties: {
        ...(page.lineNumbers ? { lineNumbers: { countBy: page.lineNumbers === 'every10' ? 10 : page.lineNumbers === 'every5' ? 5 : 1, restart: 'continuous' as never, distance: 360 } } : {}),
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
  const out = await Packer.toArrayBuffer(document);
  return page.watermark ? addWatermark(out, page.watermark) : out;
}

const xmlText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Word's own WordArt shape for watermarks (Design > Watermark writes the same VML).
const TEXT_SHAPE = '<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e">'
  + '<v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/>'
  + '<v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/>'
  + '<v:f eqn="mid @7 @8"/><v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas>'
  + '<v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/>'
  + '<v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles><o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype>';

/** Puts a diagonal text watermark in every header of a written .docx, the way Word does. */
export async function addWatermark(docx: ArrayBuffer, mark: Watermark): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(docx);
  const color = toHex(mark.color) ?? 'C0C0C0';
  const shape = `<w:r><w:rPr><w:noProof/></w:rPr><w:pict>${TEXT_SHAPE}<v:shape id="PowerPlusWaterMarkObject" o:spid="_x0000_s2049" type="#_x0000_t136" `
    + 'style="position:absolute;margin-left:0;margin-top:0;width:468pt;height:117pt;rotation:315;z-index:-251654144;'
    + 'mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" '
    + `o:allowincell="f" fillcolor="#${color}" stroked="f"><v:fill opacity=".5"/>`
    + `<v:textpath style="font-family:&quot;Calibri&quot;;font-size:1pt" string="${xmlText(mark.text)}"/></v:shape></w:pict></w:r>`;
  const headers = Object.keys(zip.files).filter(f => /^word\/header\d*\.xml$/.test(f));
  for (const path of headers) {
    let xml = await zip.file(path)!.async('string');
    // The VML namespaces, in case the header does not declare them.
    for (const [prefix, uri] of [['v', 'urn:schemas-microsoft-com:vml'], ['o', 'urn:schemas-microsoft-com:office:office']]) {
      if (!xml.includes(`xmlns:${prefix}=`)) xml = xml.replace(/<w:hdr\b/, `<w:hdr xmlns:${prefix}="${uri}"`);
    }
    // Inside the header's first paragraph, after its properties.
    xml = /<w:p\b[^>]*\/>/.test(xml) && !/<w:p\b[^>]*[^/]>/.test(xml)
      ? xml.replace(/<w:p\b([^>]*)\/>/, `<w:p$1>${shape}</w:p>`)
      : xml.replace(/(<w:p\b[^>]*>(?:<w:pPr>.*?<\/w:pPr>)?)/s, `$1${shape}`);
    zip.file(path, xml);
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}
