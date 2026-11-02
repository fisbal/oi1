// Reads a Word .docx file into In 1 Letter's document (see ../model.ts).
//
// A .docx is a zip of XML files (the Office Open XML standard, ECMA-376). We read document.xml for the
// text, styles.xml for the look, numbering.xml for lists, the theme for fonts and colors, and the
// header, footer and section settings for the page. Word styles are resolved the way Word does it:
// document defaults, then the style and the styles it is based on, then direct formatting.
// Our own styles (Normal, Title, Headings, Quote...) take their look from the file's styles, and
// anything else is kept as direct formatting, so the letter looks the same as in Word.

import JSZip from 'jszip';
import type { JSONContent } from '@tiptap/react';
import { BULLET_CHARS, BULLET_STYLES, NUMBER_FORMATS, NUMBER_STYLES, type Borders, type BorderSide } from '../extensions';
import { defaultStyles, type DocStyles, type LetterDoc, type StyleDef, type StyleId } from '../model';
import { nearestSize, type PageBorder, type PageSettings, type Watermark } from '../page';
import type { LetterComment } from '../review';

// ---------- small XML helpers (by local name, so any namespace prefix works) ----------

function kids(el: Element | null | undefined, name?: string): Element[] {
  if (!el) return [];
  const out: Element[] = [];
  for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (!name || c.localName === name) out.push(c);
  return out;
}
const kid = (el: Element | null | undefined, name: string): Element | null => kids(el, name)[0] ?? null;

function find(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null;
  const all = el.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) if (all[i].localName === name) return all[i];
  return null;
}

function attr(el: Element | null | undefined, name: string): string | null {
  if (!el) return null;
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    if (a.localName === name) return a.value;
  }
  return null;
}

const num = (v: string | null): number | undefined => (v === null || v === '' || isNaN(Number(v)) ? undefined : Number(v));

function onOff(el: Element | null): boolean | undefined {
  if (!el) return undefined;
  const v = attr(el, 'val');
  return !(v === '0' || v === 'false' || v === 'off' || v === 'none');
}

function hex(v: string | null): string | null | undefined {
  if (v === null) return undefined;
  if (v === 'auto') return null;
  return /^[0-9a-f]{6}$/i.test(v) ? `#${v.toUpperCase()}` : undefined;
}

const round = (n: number) => Math.round(n * 100) / 100;
const twipsToPt = (v: string | null) => { const n = num(v); return n === undefined ? undefined : round(n / 20); };

// ---------- formatting as plain objects ----------

interface RunProps {
  bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; caps?: boolean;
  color?: string | null; highlight?: string; size?: number; font?: string; spacing?: number;
  vertAlign?: 'superscript' | 'subscript' | 'baseline'; style?: string; lang?: string;
}

interface ParaProps {
  style?: string; align?: 'left' | 'center' | 'right' | 'justify';
  before?: number; after?: number; line?: number | string;
  indLeft?: number; indRight?: number; indFirst?: number;
  shade?: string; borders?: Borders; numId?: string; ilvl?: number; pageBreakBefore?: boolean; outline?: number;
  /** Tab stops as "l144,c288,r468" (kind and position in points). */
  tabs?: string;
}

/** Word's <w:tabs>: left, center, right and decimal stops (a cleared stop is left out). */
function readTabs(pPr: Element | null): string | undefined {
  const tabs = kid(pPr, 'tabs');
  if (!tabs) return undefined;
  const out = kids(tabs, 'tab').map(t => {
    const v = attr(t, 'val') ?? 'left';
    const pos = twipsToPt(attr(t, 'pos'));
    if (pos === undefined || v === 'clear' || v === 'bar' || v === 'num') return '';
    const k = v === 'center' ? 'c' : v === 'right' || v === 'end' ? 'r' : v === 'decimal' ? 'd' : 'l';
    return `${k}${pos}`;
  }).filter(Boolean);
  return out.length ? out.join(',') : undefined;
}

function merge<T extends object>(...layers: (T | undefined)[]): T {
  const out = {} as T;
  for (const layer of layers) {
    if (!layer) continue;
    for (const [k, v] of Object.entries(layer)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

const HIGHLIGHTS: Record<string, string> = {
  yellow: '#FFFF00', green: '#00FF00', cyan: '#00FFFF', magenta: '#FF00FF', blue: '#0000FF', red: '#FF0000',
  darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000',
  darkYellow: '#808000', darkGray: '#808080', lightGray: '#C0C0C0', black: '#000000', white: '#FFFFFF',
};

const THEME_COLOR_NAMES: Record<string, string> = {
  text1: 'dk1', background1: 'lt1', text2: 'dk2', background2: 'lt2', dark1: 'dk1', light1: 'lt1', dark2: 'dk2', light2: 'lt2',
};

interface Theme { major?: string; minor?: string; colors: Record<string, string> }

class Context {
  styles = new Map<string, { type: string; name: string; basedOn?: string; p: ParaProps; r: RunProps; isDefault: boolean; tblBorders?: Element | null }>();
  defaultsP: ParaProps = {};
  defaultsR: RunProps = {};
  lists = new Map<string, Map<number, ListLevel>>();
  theme: Theme = { colors: {} };

  color(el: Element | null): string | null | undefined {
    if (!el) return undefined;
    const direct = hex(attr(el, 'val'));
    if (direct !== undefined) return direct;
    const theme = attr(el, 'themeColor');
    if (theme) {
      const c = this.theme.colors[THEME_COLOR_NAMES[theme] ?? theme];
      if (c) return c;
    }
    return undefined;
  }

  font(rFonts: Element | null): string | undefined {
    if (!rFonts) return undefined;
    const name = attr(rFonts, 'ascii') ?? attr(rFonts, 'hAnsi');
    if (name) return name;
    const theme = attr(rFonts, 'asciiTheme') ?? attr(rFonts, 'hAnsiTheme');
    if (theme) return theme.startsWith('major') ? this.theme.major : this.theme.minor;
    return undefined;
  }

  runProps(rPr: Element | null): RunProps {
    if (!rPr) return {};
    const u = kid(rPr, 'u');
    const shd = kid(rPr, 'shd');
    const shdFill = shd ? hex(attr(shd, 'fill')) : undefined;
    const hl = attr(kid(rPr, 'highlight'), 'val');
    const sz = num(attr(kid(rPr, 'sz'), 'val'));
    const va = attr(kid(rPr, 'vertAlign'), 'val');
    const strike = onOff(kid(rPr, 'strike')) ?? onOff(kid(rPr, 'dstrike'));
    return {
      bold: onOff(kid(rPr, 'b')),
      italic: onOff(kid(rPr, 'i')),
      underline: u ? attr(u, 'val') !== 'none' : undefined,
      strike,
      caps: onOff(kid(rPr, 'caps')),
      color: this.color(kid(rPr, 'color')),
      highlight: hl && hl !== 'none' ? HIGHLIGHTS[hl] : shdFill ?? undefined,
      size: sz !== undefined ? sz / 2 : undefined,
      font: this.font(kid(rPr, 'rFonts')),
      spacing: twipsToPt(attr(kid(rPr, 'spacing'), 'val')),
      vertAlign: va === 'superscript' || va === 'subscript' || va === 'baseline' ? va : undefined,
      style: attr(kid(rPr, 'rStyle'), 'val') ?? undefined,
      lang: attr(kid(rPr, 'lang'), 'val') ?? undefined,
    };
  }

  border(el: Element | null): BorderSide | undefined {
    if (!el) return undefined;
    const val = attr(el, 'val');
    if (!val || val === 'none' || val === 'nil') return undefined;
    return {
      w: round((num(attr(el, 'sz')) ?? 4) / 8),
      color: this.color(el) ?? hex(attr(el, 'color')) ?? '#000000',
      space: num(attr(el, 'space')) ?? 0,
      ...(val === 'double' || val === 'dashed' || val === 'dotted' ? { style: val } : {}),
    };
  }

  paraProps(pPr: Element | null): ParaProps {
    if (!pPr) return {};
    const jc = attr(kid(pPr, 'jc'), 'val');
    const spacing = kid(pPr, 'spacing');
    const ind = kid(pPr, 'ind');
    const shd = kid(pPr, 'shd');
    const numPr = kid(pPr, 'numPr');
    const pBdr = kid(pPr, 'pBdr');
    let line: number | string | undefined;
    const lineVal = num(attr(spacing, 'line'));
    if (lineVal !== undefined) {
      const rule = attr(spacing, 'lineRule') ?? 'auto';
      line = rule === 'auto' ? round(lineVal / 240) : `${round(lineVal / 20)}pt`;
    }
    const first = twipsToPt(attr(ind, 'firstLine'));
    const hanging = twipsToPt(attr(ind, 'hanging'));
    let borders: Borders | undefined;
    if (pBdr) {
      const b: Borders = {};
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        const v = this.border(kid(pBdr, side) ?? (side === 'left' ? kid(pBdr, 'start') : side === 'right' ? kid(pBdr, 'end') : null));
        if (v) b[side] = v;
      }
      borders = Object.keys(b).length ? b : undefined;
    }
    let shade: string | undefined;
    if (shd) {
      const fill = hex(attr(shd, 'fill'));
      shade = attr(shd, 'val') === 'solid' ? hex(attr(shd, 'color')) ?? undefined : fill ?? undefined;
    }
    const numId = attr(kid(numPr, 'numId'), 'val');
    return {
      style: attr(kid(pPr, 'pStyle'), 'val') ?? undefined,
      align: jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : jc === 'both' || jc === 'distribute' ? 'justify'
        : jc === 'left' || jc === 'start' ? 'left' : undefined,
      before: twipsToPt(attr(spacing, 'before')),
      after: twipsToPt(attr(spacing, 'after')),
      line,
      indLeft: twipsToPt(attr(ind, 'left') ?? attr(ind, 'start')),
      indRight: twipsToPt(attr(ind, 'right') ?? attr(ind, 'end')),
      indFirst: hanging !== undefined ? -hanging : first,
      shade,
      borders,
      numId: numId ?? undefined,
      ilvl: numPr ? num(attr(kid(numPr, 'ilvl'), 'val')) ?? 0 : undefined,
      pageBreakBefore: onOff(kid(pPr, 'pageBreakBefore')),
      outline: num(attr(kid(pPr, 'outlineLvl'), 'val')),
      tabs: readTabs(pPr),
    };
  }

  chain(id: string | undefined, seen = new Set<string>()): { p: ParaProps; r: RunProps } {
    const s = id ? this.styles.get(id) : undefined;
    if (!s || seen.has(id!)) return { p: {}, r: {} };
    seen.add(id!);
    const base = this.chain(s.basedOn, seen);
    return { p: merge(base.p, s.p), r: merge(base.r, s.r) };
  }

  /** The lines of a table style, following the styles it is based on. */
  tableBorders(id: string | undefined): Element | null {
    const seen = new Set<string>();
    for (let cur = id; cur && !seen.has(cur); cur = this.styles.get(cur)?.basedOn) {
      seen.add(cur);
      const b = this.styles.get(cur)?.tblBorders;
      if (b) return b;
    }
    return null;
  }

  defaultParagraphStyle(): string | undefined {
    for (const [id, s] of this.styles) if (s.type === 'paragraph' && s.isDefault) return id;
    return this.styles.has('Normal') ? 'Normal' : undefined;
  }

  /** Our style for a Word paragraph style id. */
  /** Word's Caption style (or one based on it), kept as Letter's caption paragraphs. */
  isCaption(id: string | undefined): boolean {
    const seen = new Set<string>();
    for (let cur = id; cur && !seen.has(cur); cur = this.styles.get(cur)?.basedOn) {
      seen.add(cur);
      if ((this.styles.get(cur)?.name ?? cur).toLowerCase() === 'caption') return true;
    }
    return false;
  }

  ourStyle(id: string | undefined): StyleId {
    const seen = new Set<string>();
    for (let cur = id; cur && !seen.has(cur); cur = this.styles.get(cur)?.basedOn) {
      seen.add(cur);
      const s = this.styles.get(cur);
      const name = (s?.name ?? cur).toLowerCase().replace(/\s+/g, ' ');
      const h = name.match(/^heading ?([1-6])$/);
      if (h) return `h${h[1]}` as StyleId;
      if (name === 'title') return 'title';
      if (name === 'subtitle') return 'subtitle';
      if (name === 'quote' || name === 'intense quote') return 'quote';
      if (s?.p.outline !== undefined && s.p.outline < 6) return `h${s.p.outline + 1}` as StyleId;
    }
    return 'normal';
  }
}

function styleDef(p: ParaProps, r: RunProps): StyleDef {
  return {
    font: r.font, size: r.size, color: r.color ?? null, bold: r.bold, italic: r.italic, caps: r.caps,
    letterSpacing: r.spacing, before: p.before ?? 0, after: p.after ?? 0, lineHeight: p.line, align: p.align,
    ...(p.indFirst && p.indFirst > 0 ? { indent: p.indFirst } : {}),
  };
}

// ---------- the file ----------

interface Part { doc: Document; rels: Map<string, { target: string; external: boolean }>; path: string }

async function readPart(zip: JSZip, path: string): Promise<Part | null> {
  const file = zip.file(path);
  if (!file) return null;
  const doc = new DOMParser().parseFromString(await file.async('string'), 'application/xml');
  const dir = path.slice(0, path.lastIndexOf('/') + 1);
  const relsPath = `${dir}_rels/${path.slice(dir.length)}.rels`;
  const rels = new Map<string, { target: string; external: boolean }>();
  const relFile = zip.file(relsPath);
  if (relFile) {
    const rdoc = new DOMParser().parseFromString(await relFile.async('string'), 'application/xml');
    for (const r of kids(rdoc.documentElement, 'Relationship')) {
      const external = attr(r, 'TargetMode') === 'External';
      const target = attr(r, 'Target') ?? '';
      rels.set(attr(r, 'Id') ?? '', { target: external ? target : resolvePath(dir, target), external });
    }
  }
  return { doc, rels, path };
}

function resolvePath(dir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = (dir + target).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return out.join('/');
}

const IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp' };

type Inline = JSONContent;
interface Mark { type: string; attrs?: Record<string, unknown> }

class Reader {
  private zip: JSZip;
  private ctx: Context;
  private styles: DocStyles;
  private normal: Required<Pick<StyleDef, 'font' | 'size'>> & StyleDef;
  private images = new Map<string, string | null>();
  /** True while reading the body: only the body keeps comments, tracked changes and footnotes. */
  inBody = false;
  /** Word ids of the comments that start a thread (replies share their range). */
  threadStarts = new Set<string>();
  /** Comments whose range we are inside. */
  private openComments = new Set<string>();
  footnotes = new Map<string, string>();

  constructor(zip: JSZip, ctx: Context, styles: DocStyles) {
    this.zip = zip;
    this.ctx = ctx;
    this.styles = styles;
    this.normal = { ...styles.normal, font: styles.normal.font ?? 'Calibri', size: styles.normal.size ?? 11 };
  }

  async blocks(container: Element, part: Part, table?: { p: ParaProps; r: RunProps }): Promise<JSONContent[]> {
    const out: JSONContent[] = [];
    const lists = new ListBuilder(out);
    for (const el of kids(container)) {
      switch (el.localName) {
        case 'p': {
          const { blocks, list } = await this.paragraph(el, part, table);
          for (const b of blocks) {
            if (list && b.type === 'paragraph') lists.add(b, list.kind, list.level, list.numId, list.style);
            else { lists.end(); out.push(b); }
          }
          break;
        }
        case 'tbl':
          lists.end();
          out.push(await this.table(el, part));
          break;
        case 'sdt':
          lists.end();
          out.push(...(await this.blocks(kid(el, 'sdtContent') ?? el, part, table)));
          break;
        case 'customXml':
        case 'ins':
        case 'del':
          out.push(...(await this.blocks(el, part, table)));
          break;
        case 'commentRangeStart': case 'commentRangeEnd':
          this.commentRange(el);
          break;
        default:
          break;
      }
    }
    return out;
  }

  private commentRange(el: Element) {
    const id = attr(el, 'id');
    if (!this.inBody || id === null || !this.threadStarts.has(id)) return;
    if (el.localName === 'commentRangeStart') this.openComments.add(id); else this.openComments.delete(id);
  }

  /** The tracked change an <ins> or <del> stands for, as a mark. */
  private revision(el: Element, kind: 'insertion' | 'deletion'): Mark[] {
    if (!this.inBody) return [];
    const id = num(attr(el, 'id'));
    return [{ type: kind, attrs: { id: id ?? Math.floor(Math.random() * 1e6), author: attr(el, 'author'), date: attr(el, 'date') } }];
  }

  private baseline(style: StyleId): StyleDef {
    return merge<StyleDef>(this.normal, style === 'normal' ? undefined : this.styles[style]);
  }

  private async paragraph(el: Element, part: Part, table?: { p: ParaProps; r: RunProps }) {
    const ctx = this.ctx;
    const direct = ctx.paraProps(kid(el, 'pPr'));
    const styleId = direct.style ?? ctx.defaultParagraphStyle();
    const chain = ctx.chain(styleId);
    const p = merge<ParaProps>(ctx.defaultsP, table?.p, chain.p, direct);
    const ours = ctx.ourStyle(styleId);
    const base = this.baseline(ours);
    const runBase = merge<RunProps>(ctx.defaultsR, table?.r, chain.r);

    const segments: Inline[][] = [[]];
    const extra: JSONContent[] = [];
    await this.inlines(el, part, runBase, base, [], segments, extra, []);

    let list: { kind: 'bullet' | 'number'; level: number; numId: string; style: string | null } | undefined;
    if (p.numId && p.numId !== '0') {
      const level = p.ilvl ?? 0;
      const def = ctx.lists.get(p.numId)?.get(level);
      list = { kind: def?.kind ?? 'bullet', level, numId: p.numId, style: def?.style ?? null };
    }

    const attrs: Record<string, unknown> = {};
    if (p.align && p.align !== (base.align ?? 'left')) attrs.textAlign = p.align;
    if (p.line !== undefined && String(p.line) !== String(base.lineHeight ?? 1)) attrs.lineHeight = String(p.line);
    if (p.before !== undefined && p.before !== (base.before ?? 0)) attrs.spaceBefore = p.before;
    if (p.after !== undefined && p.after !== (base.after ?? 0)) attrs.spaceAfter = p.after;
    if (!list) {
      if (p.indLeft) attrs.indentLeft = p.indLeft;
      if (p.indFirst) attrs.indentFirst = p.indFirst;
    }
    if (p.indRight) attrs.indentRight = p.indRight;
    if (p.tabs) attrs.tabStops = p.tabs;
    if (p.shade) attrs.background = p.shade;
    if (p.borders) attrs.borders = p.borders;

    const make = (content: Inline[]): JSONContent => {
      const level = ours.startsWith('h') ? Number(ours.slice(1)) : 0;
      const node: JSONContent = level
        ? { type: 'heading', attrs: { level, ...attrs } }
        : { type: 'paragraph', attrs: ours === 'normal' ? (ctx.isCaption(styleId) ? { ...attrs, styleId: 'caption' } : { ...attrs }) : { ...attrs, styleId: ours } };
      if (content.length) node.content = content;
      return node;
    };

    const blocks: JSONContent[] = [];
    if (p.pageBreakBefore) blocks.push({ type: 'pageBreak' });
    segments.forEach((seg, i) => {
      if (i > 0) blocks.push({ type: 'pageBreak' });
      // Keep empty paragraphs, but not the empty halves around a page break.
      if (seg.length || segments.length === 1) blocks.push(make(seg));
    });
    blocks.push(...extra);
    // A section break that starts a new page.
    const sect = kid(kid(el, 'pPr'), 'sectPr');
    if (sect && attr(kid(sect, 'type'), 'val') !== 'continuous') blocks.push({ type: 'pageBreak' });
    return { blocks, list };
  }

  /** Walks the runs of a paragraph (and hyperlinks, fields, tracked insertions inside it). */
  private async inlines(el: Element, part: Part, runBase: RunProps, base: StyleDef, marks: Mark[],
    segments: Inline[][], extra: JSONContent[], fields: Field[]) {
    for (const c of kids(el)) {
      switch (c.localName) {
        case 'r':
          await this.run(c, part, runBase, base, marks, segments, extra, fields);
          break;
        case 'hyperlink': {
          const id = attr(c, 'id');
          const href = id ? part.rels.get(id)?.target : undefined;
          const linkMarks = href ? [...marks, { type: 'link', attrs: { href } }] : marks;
          await this.inlines(c, part, runBase, base, linkMarks, segments, extra, fields);
          break;
        }
        case 'fldSimple': {
          const instr = (attr(c, 'instr') ?? '').trim();
          const kind = fieldKind(instr);
          if (kind === 'page' || kind === 'pages') segments[segments.length - 1].push({ type: 'pageNumber', attrs: { kind }, marks: this.marks(runBase, base, marks) });
          else {
            const href = kind === 'link' ? linkTarget(instr) : undefined;
            await this.inlines(c, part, runBase, base, href ? [...marks, { type: 'link', attrs: { href } }] : marks, segments, extra, fields);
          }
          break;
        }
        case 'ins': case 'moveTo':
          await this.inlines(c, part, runBase, base, [...marks, ...this.revision(c, 'insertion')], segments, extra, fields);
          break;
        case 'del': case 'moveFrom':
          await this.inlines(c, part, runBase, base, [...marks, ...this.revision(c, 'deletion')], segments, extra, fields);
          break;
        case 'smartTag': case 'customXml':
          await this.inlines(c, part, runBase, base, marks, segments, extra, fields);
          break;
        case 'commentRangeStart': case 'commentRangeEnd':
          this.commentRange(c);
          break;
        case 'sdt':
          await this.inlines(kid(c, 'sdtContent') ?? c, part, runBase, base, marks, segments, extra, fields);
          break;
        case 'oMath': case 'oMathPara': {
          const text = [...c.getElementsByTagName('*')].filter(n => n.localName === 't').map(n => n.textContent ?? '').join('');
          if (text) segments[segments.length - 1].push({ type: 'text', text, marks: this.marks(runBase, base, marks) });
          break;
        }
        default:
          break;
      }
    }
  }

  private marks(runBase: RunProps, base: StyleDef, outer: Mark[], direct?: RunProps): Mark[] {
    const ctx = this.ctx;
    const charStyle = direct?.style ? ctx.chain(direct.style).r : undefined;
    const r = merge<RunProps>(runBase, charStyle, direct);
    const out: Mark[] = [...outer];
    if (r.bold && !base.bold) out.push({ type: 'bold' });
    if (r.italic && !base.italic) out.push({ type: 'italic' });
    const isLink = outer.some(m => m.type === 'link');
    if (r.underline && !isLink) out.push({ type: 'underline' });
    if (r.strike) out.push({ type: 'strike' });
    if (r.vertAlign === 'superscript') out.push({ type: 'superscript' });
    if (r.vertAlign === 'subscript') out.push({ type: 'subscript' });
    if (r.highlight) out.push({ type: 'highlight', attrs: { color: r.highlight } });
    const ts: Record<string, unknown> = {};
    const same = (a?: string | null, b?: string | null) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
    if (r.font && !same(r.font, base.font)) ts.fontFamily = r.font;
    if (r.size && r.size !== base.size) ts.fontSize = `${r.size}pt`;
    const baseColor = base.color ?? null;
    if (r.color !== undefined && !same(r.color, baseColor) && !(isLink && r.color && /^#0563C1$/i.test(r.color))) {
      if (r.color) ts.color = r.color;
    }
    if (r.spacing && r.spacing !== (base.letterSpacing ?? 0)) ts.letterSpacing = r.spacing;
    if (r.caps && !base.caps) ts.caps = true;
    if (Object.keys(ts).length) out.push({ type: 'textStyle', attrs: ts });
    return out;
  }

  private async run(el: Element, part: Part, runBase: RunProps, base: StyleDef, outer: Mark[],
    segments: Inline[][], extra: JSONContent[], fields: Field[]) {
    const direct = this.ctx.runProps(kid(el, 'rPr'));
    let marks: Mark[] | null = null;
    const getMarks = () => {
      if (marks) return marks;
      const link = [...fields].reverse().find(f => f.phase === 'result' && f.kind === 'link' && f.href);
      marks = this.marks(runBase, base, link ? [...outer, { type: 'link', attrs: { href: link.href } }] : outer, direct);
      for (const id of this.openComments) marks.push({ type: 'comment', attrs: { id: `w${id}` } });
      return marks;
    };
    const hidden = () => fields.some(f => f.phase === 'instr' || (f.phase === 'result' && (f.kind === 'page' || f.kind === 'pages')));
    const push = (node: Inline) => segments[segments.length - 1].push(node);
    const pushText = (text: string) => {
      if (!text || hidden()) return;
      const seg = segments[segments.length - 1];
      const ms = getMarks();
      const last = seg[seg.length - 1];
      if (last?.type === 'text' && JSON.stringify(last.marks ?? []) === JSON.stringify(ms)) last.text += text;
      else seg.push(ms.length ? { type: 'text', text, marks: ms } : { type: 'text', text });
    };

    for (const c of kids(el)) {
      switch (c.localName) {
        case 't': case 'delText': pushText(c.textContent ?? ''); break;
        case 'footnoteReference': {
          const id = attr(c, 'id');
          if (this.inBody && id !== null && this.footnotes.has(id) && !hidden()) {
            const ms = getMarks().filter(m => m.type === 'comment' || m.type === 'insertion' || m.type === 'deletion');
            push({ type: 'footnote', attrs: { text: this.footnotes.get(id) }, ...(ms.length ? { marks: ms } : {}) });
          }
          break;
        }
        case 'tab': case 'ptab': pushText('\t'); break;
        case 'noBreakHyphen': pushText('‑'); break;
        case 'softHyphen': pushText('­'); break;
        case 'sym': {
          const code = parseInt(attr(c, 'char') ?? '', 16);
          if (code && code < 0xf000) pushText(String.fromCharCode(code));
          break;
        }
        case 'br': case 'cr': {
          if (hidden()) break;
          const type = attr(c, 'type');
          if (type === 'page') segments.push([]);
          else if (type !== 'column') push({ type: 'hardBreak' });
          break;
        }
        case 'fldChar': {
          const type = attr(c, 'fldCharType');
          if (type === 'begin') fields.push({ instr: '', phase: 'instr', kind: 'other' });
          else if (type === 'separate') {
            const f = fields[fields.length - 1];
            if (f) {
              f.kind = fieldKind(f.instr.trim());
              if (f.kind === 'link') f.href = linkTarget(f.instr);
              if ((f.kind === 'page' || f.kind === 'pages') && !fields.slice(0, -1).some(x => x.phase === 'instr')) {
                push({ type: 'pageNumber', attrs: { kind: f.kind }, marks: getMarks() });
                f.done = true;
              }
              f.phase = 'result';
            }
          } else if (type === 'end') {
            const f = fields.pop();
            if (f && f.phase === 'instr' && !f.done) {
              const kind = fieldKind(f.instr.trim());
              if ((kind === 'page' || kind === 'pages') && !hidden()) push({ type: 'pageNumber', attrs: { kind }, marks: getMarks() });
            }
          }
          break;
        }
        case 'instrText': {
          const f = fields[fields.length - 1];
          if (f && f.phase === 'instr') f.instr += c.textContent ?? '';
          break;
        }
        case 'drawing': case 'pict': case 'object':
          if (!hidden()) await this.drawing(c, part, segments, extra);
          break;
        case 'AlternateContent': {
          const choice = kid(c, 'Choice') ?? kid(c, 'Fallback');
          if (choice && !hidden()) await this.drawing(choice, part, segments, extra);
          break;
        }
        default:
          break;
      }
    }
  }

  /** Images become inline images; text boxes become paragraphs after this one. */
  private async drawing(el: Element, part: Part, segments: Inline[][], extra: JSONContent[]) {
    const box = find(el, 'txbxContent');
    if (box) {
      extra.push(...(await this.blocks(box, part)));
      return;
    }
    const blip = find(el, 'blip');
    const id = blip ? attr(blip, 'embed') : attr(find(el, 'imagedata'), 'id');
    if (!id) return;
    const src = await this.image(part, id);
    if (!src) return;
    const extent = find(el, 'extent');
    const cx = num(attr(extent, 'cx'));
    const docPr = find(el, 'docPr');
    const attrs: Record<string, unknown> = { src, alt: attr(docPr, 'descr') ?? attr(docPr, 'name') ?? null };
    if (cx) attrs.width = Math.round(cx / 9525);
    segments[segments.length - 1].push({ type: 'image', attrs });
  }

  private async image(part: Part, id: string): Promise<string | null> {
    const rel = part.rels.get(id);
    if (!rel || rel.external) return null;
    if (this.images.has(rel.target)) return this.images.get(rel.target)!;
    const ext = rel.target.split('.').pop()?.toLowerCase() ?? '';
    const mime = IMAGE_TYPES[ext];
    const file = this.zip.file(rel.target);
    const src = mime && file ? `data:${mime};base64,${await file.async('base64')}` : null; // EMF and WMF cannot be shown in a browser
    this.images.set(rel.target, src);
    return src;
  }

  private async table(el: Element, part: Part): Promise<JSONContent> {
    const tblPr = kid(el, 'tblPr');
    const styleId = attr(kid(tblPr, 'tblStyle'), 'val') ?? undefined;
    const tableStyle = this.ctx.chain(styleId);
    const rows: JSONContent[] = [];
    // Cells merged downwards: the first cell of each column grows its rowspan.
    const openMerges = new Map<number, JSONContent>();
    for (const tr of kids(el, 'tr')) {
      const header = onOff(kid(kid(tr, 'trPr'), 'tblHeader')) === true;
      const cells: JSONContent[] = [];
      let col = 0;
      const tcs = kids(tr).flatMap(c => (c.localName === 'tc' ? [c] : c.localName === 'sdt' ? kids(kid(c, 'sdtContent'), 'tc') : []));
      for (const tc of tcs) {
        const tcPr = kid(tc, 'tcPr');
        const span = num(attr(kid(tcPr, 'gridSpan'), 'val')) ?? 1;
        const vMerge = kid(tcPr, 'vMerge');
        const vVal = vMerge ? attr(vMerge, 'val') ?? 'continue' : null;
        if (vVal === 'continue') {
          const owner = openMerges.get(col);
          if (owner) owner.attrs!.rowspan = (Number(owner.attrs!.rowspan) || 1) + 1;
          col += span;
          continue;
        }
        const content = await this.blocks(tc, part, tableStyle);
        const attrs: Record<string, unknown> = { colspan: span, rowspan: 1 };
        const w = num(attr(kid(tcPr, 'tcW'), 'w'));
        if (w && attr(kid(tcPr, 'tcW'), 'type') === 'dxa') attrs.colwidth = Array(span).fill(Math.round(w / 15 / span));
        const shd = kid(tcPr, 'shd');
        const fill = shd ? hex(attr(shd, 'fill')) : undefined;
        if (fill) attrs.background = fill;
        const cell: JSONContent = {
          type: header ? 'tableHeader' : 'tableCell',
          attrs,
          content: content.length ? content : [{ type: 'paragraph' }],
        };
        if (vVal === 'restart') openMerges.set(col, cell); else openMerges.delete(col);
        cells.push(cell);
        col += span;
      }
      if (cells.length) rows.push({ type: 'tableRow', content: cells });
    }
    // Tables without lines (often used for layout) stay without lines.
    const borders = kid(tblPr, 'tblBorders') ?? this.ctx.tableBorders(styleId);
    const noLines = !borders || kids(borders).every(b => ['none', 'nil'].includes(attr(b, 'val') ?? 'none'));
    return { type: 'table', attrs: noLines ? { borders: 'none' } : {}, content: rows.length ? rows : [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }] }] };
  }
}

interface Field { instr: string; phase: 'instr' | 'result'; kind: 'page' | 'pages' | 'link' | 'other'; href?: string; done?: boolean }

function fieldKind(instr: string): Field['kind'] {
  const word = instr.split(/\s+/)[0]?.toUpperCase();
  if (word === 'PAGE') return 'page';
  if (word === 'NUMPAGES' || word === 'SECTIONPAGES') return 'pages';
  if (word === 'HYPERLINK') return 'link';
  return 'other';
}

function linkTarget(instr: string): string | undefined {
  const m = instr.match(/HYPERLINK\s+"([^"]+)"/i);
  return m && !/\\l/.test(instr.slice(0, instr.indexOf(m[0]))) ? m[1] : undefined;
}

/** Turns Word's numbered paragraphs into nested bullet and numbered lists. */
class ListBuilder {
  private stack: { node: JSONContent; kind: 'bullet' | 'number'; numId: string }[] = [];
  private out: JSONContent[];
  constructor(out: JSONContent[]) { this.out = out; }

  add(paragraph: JSONContent, kind: 'bullet' | 'number', level: number, numId: string, style: string | null = null) {
    const depth = Math.min(level, 8) + 1;
    while (this.stack.length > depth) this.stack.pop();
    const top = this.stack[this.stack.length - 1];
    if (this.stack.length === depth && (top.kind !== kind || (depth === 1 && top.numId !== numId && kind === 'number'))) this.stack.pop();
    while (this.stack.length < depth) {
      const list: JSONContent = { type: kind === 'bullet' ? 'bulletList' : 'orderedList', content: [] };
      if (style && this.stack.length === depth - 1) list.attrs = { listStyle: style };
      const parent = this.stack[this.stack.length - 1];
      if (!parent) this.out.push(list);
      else {
        let item = parent.node.content![parent.node.content!.length - 1];
        if (!item) { item = { type: 'listItem', content: [{ type: 'paragraph' }] }; parent.node.content!.push(item); }
        item.content!.push(list);
      }
      this.stack.push({ node: list, kind, numId });
    }
    this.stack[this.stack.length - 1].node.content!.push({ type: 'listItem', content: [paragraph] });
  }

  end() { this.stack = []; }
}

async function xml(zip: JSZip, path: string): Promise<Document | null> {
  const f = zip.file(path);
  return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null;
}

function readTheme(doc: Document | null): Theme {
  const theme: Theme = { colors: {} };
  if (!doc) return theme;
  theme.major = attr(kid(find(doc.documentElement, 'majorFont'), 'latin'), 'typeface') ?? undefined;
  theme.minor = attr(kid(find(doc.documentElement, 'minorFont'), 'latin'), 'typeface') ?? undefined;
  const scheme = find(doc.documentElement, 'clrScheme');
  for (const c of kids(scheme)) {
    const v = kid(c, 'srgbClr') ? attr(kid(c, 'srgbClr'), 'val') : attr(kid(c, 'sysClr'), 'lastClr');
    const h = hex(v);
    if (h) theme.colors[c.localName] = h;
  }
  return theme;
}

type ListLevel = { kind: 'bullet' | 'number'; style: string | null };

/** OI1's name for a Word list level's look: a bullet shape or a number format. */
function levelStyle(fmt: string | null, text: string | null): string | null {
  const t = (text ?? '').trim();
  if (fmt === 'bullet') {
    if (/^[o◦○]$/.test(t)) return 'circle';
    if (/^[▪■\uF0A7\uF06E]$/.test(t)) return 'square';
    if (/^[–—-]$/.test(t)) return 'dash';
    if (/^[➤►▶➢\uF0D8\uF0E8]$/.test(t)) return 'arrow';
    if (/^[✓✔\uF0FC]$/.test(t)) return 'check';
    if (/^[★☆]$/.test(t)) return 'star';
    const shape = BULLET_STYLES.find(st => BULLET_CHARS[st] === t);
    return shape && shape !== 'disc' ? shape : null;
  }
  const counter = ({ decimal: 'decimal', decimalZero: 'decimal-leading-zero', lowerLetter: 'lower-alpha', upperLetter: 'upper-alpha', lowerRoman: 'lower-roman', upperRoman: 'upper-roman' } as Record<string, string>)[fmt ?? ''];
  const found = NUMBER_STYLES.find(st => NUMBER_FORMATS[st].counter === counter && `${NUMBER_FORMATS[st].before}%1${NUMBER_FORMATS[st].after}`.replace(/\s/g, '') === t.replace(/\s/g, ''));
  // Plain "1." is Word's default look, kept as no style.
  if (found) return found === 'decimal' ? null : found;
  // Another text around a known counter keeps at least the counter ("a." for any lowercase letters).
  return counter && counter !== 'decimal' ? NUMBER_STYLES.find(st => NUMBER_FORMATS[st].counter === counter) ?? null : null;
}

function readNumbering(doc: Document | null): Map<string, Map<number, ListLevel>> {
  const lists = new Map<string, Map<number, ListLevel>>();
  if (!doc) return lists;
  const abstract = new Map<string, Map<number, ListLevel>>();
  for (const a of kids(doc.documentElement, 'abstractNum')) {
    const levels = new Map<number, ListLevel>();
    for (const lvl of kids(a, 'lvl')) {
      const fmt = attr(kid(lvl, 'numFmt'), 'val');
      const level = num(attr(lvl, 'ilvl')) ?? 0;
      const kind = fmt === 'bullet' || fmt === 'none' ? 'bullet' : 'number';
      // Deeper levels of a default list change shape by themselves, so only the first level's look is kept.
      levels.set(level, { kind, style: level === 0 ? levelStyle(fmt, attr(kid(lvl, 'lvlText'), 'val')) : null });
    }
    abstract.set(attr(a, 'abstractNumId') ?? '', levels);
  }
  for (const n of kids(doc.documentElement, 'num')) {
    const levels = abstract.get(attr(kid(n, 'abstractNumId'), 'val') ?? '');
    if (levels) lists.set(attr(n, 'numId') ?? '', levels);
  }
  return lists;
}

function readPage(sect: Element | null, ctx: Context, background: string | null): PageSettings {
  const pgSz = kid(sect, 'pgSz');
  const pgMar = kid(sect, 'pgMar');
  const inch = (v: string | null, fallback: number) => { const n = num(v); return n === undefined ? fallback : Math.abs(n) / 1440; };
  const w = inch(attr(pgSz, 'w'), 8.5);
  const h = inch(attr(pgSz, 'h'), 11);
  const { size, orientation } = nearestSize(w, h);
  const margins = {
    top: inch(attr(pgMar, 'top'), 1), right: inch(attr(pgMar, 'right'), 1),
    bottom: inch(attr(pgMar, 'bottom'), 1), left: inch(attr(pgMar, 'left'), 1),
  };
  let border: PageBorder | null = null;
  const pgBorders = kid(sect, 'pgBorders');
  const side = ctx.border(kid(pgBorders, 'top')) ?? ctx.border(kid(pgBorders, 'left'));
  if (side) {
    const fromPage = attr(pgBorders, 'offsetFrom') === 'page';
    const space = fromPage ? side.space : Math.max(margins.top * 72 - side.space - side.w, 4);
    border = { w: side.w, color: side.color, space: round(space) };
  }
  return {
    size, orientation, margins,
    headerDistance: inch(attr(pgMar, 'header'), 0.5),
    footerDistance: inch(attr(pgMar, 'footer'), 0.5),
    color: background,
    border,
  };
}

export async function readDocx(data: ArrayBuffer): Promise<LetterDoc> {
  const zip = await JSZip.loadAsync(data);
  const rootRels = await xml(zip, '_rels/.rels');
  const mainRel = kids(rootRels?.documentElement, 'Relationship').find(r => /officeDocument$/.test(attr(r, 'Type') ?? ''));
  const mainPath = resolvePath('', attr(mainRel, 'Target') ?? 'word/document.xml');
  const main = await readPart(zip, mainPath);
  if (!main || main.doc.getElementsByTagName('parsererror').length) throw new Error('This is not a Word document.');

  const relOfType = async (type: string): Promise<string | null> => {
    const dir = mainPath.slice(0, mainPath.lastIndexOf('/') + 1);
    const relsDoc = await xml(zip, `${dir}_rels/${mainPath.slice(dir.length)}.rels`);
    const r = kids(relsDoc?.documentElement, 'Relationship').find(x => (attr(x, 'Type') ?? '').endsWith(`/${type}`));
    return r ? resolvePath(dir, attr(r, 'Target') ?? '') : null;
  };

  const ctx = new Context();
  ctx.theme = readTheme(await xml(zip, (await relOfType('theme')) ?? 'word/theme/theme1.xml'));
  ctx.lists = readNumbering(await xml(zip, (await relOfType('numbering')) ?? 'word/numbering.xml'));

  const stylesDoc = await xml(zip, (await relOfType('styles')) ?? 'word/styles.xml');
  if (stylesDoc) {
    const dd = kid(stylesDoc.documentElement, 'docDefaults');
    ctx.defaultsR = ctx.runProps(kid(kid(dd, 'rPrDefault'), 'rPr'));
    ctx.defaultsP = ctx.paraProps(kid(kid(dd, 'pPrDefault'), 'pPr'));
    for (const s of kids(stylesDoc.documentElement, 'style')) {
      const id = attr(s, 'styleId');
      if (!id) continue;
      ctx.styles.set(id, {
        type: attr(s, 'type') ?? 'paragraph',
        name: attr(kid(s, 'name'), 'val') ?? id,
        basedOn: attr(kid(s, 'basedOn'), 'val') ?? undefined,
        p: ctx.paraProps(kid(s, 'pPr')),
        r: ctx.runProps(kid(s, 'rPr')),
        isDefault: attr(s, 'default') === '1' || attr(s, 'default') === 'true',
        tblBorders: kid(kid(s, 'tblPr'), 'tblBorders'),
      });
    }
  }
  // Word's built-in values when a file says nothing: Times New Roman 10 pt, single spacing.
  ctx.defaultsR = merge<RunProps>({ font: 'Times New Roman', size: 10 }, ctx.defaultsR);

  // Our styles take the look of the file's styles.
  const styles = defaultStyles();
  const normalChain = ctx.chain(ctx.defaultParagraphStyle());
  const normalP = merge<ParaProps>(ctx.defaultsP, normalChain.p);
  const normalR = merge<RunProps>(ctx.defaultsR, normalChain.r);
  styles.normal = { ...styleDef(normalP, normalR), lineHeight: normalP.line ?? 1, bold: undefined, italic: undefined };
  const seen = new Set<StyleId>();
  for (const [id, s] of ctx.styles) {
    if (s.type !== 'paragraph') continue;
    const ours = ctx.ourStyle(id);
    if (ours === 'normal') continue;
    // Prefer the style that is exactly ours (Heading 1, not a style based on it).
    const name = s.name.toLowerCase();
    const exact = /^heading [1-6]$/.test(name) || ['title', 'subtitle', 'quote'].includes(name);
    if (!exact && seen.has(ours)) continue;
    const c = ctx.chain(id);
    const p = merge<ParaProps>(ctx.defaultsP, c.p);
    const r = merge<RunProps>(ctx.defaultsR, c.r);
    const def = styleDef(p, r);
    styles[ours] = { ...def, lineHeight: p.line ?? normalP.line ?? 1, color: r.color ?? null };
    if (exact) seen.add(ours);
  }

  const body = kid(main.doc.documentElement, 'body');
  const background = hex(attr(kid(main.doc.documentElement, 'background'), 'color')) ?? null;
  const sect = kid(body, 'sectPr');
  const page = readPage(sect, ctx, background);
  const settings = await xml(zip, (await relOfType('settings')) ?? 'word/settings.xml');
  const hyph = kid(settings?.documentElement ?? null, 'autoHyphenation');
  if (hyph && attr(hyph, 'val') !== 'false' && attr(hyph, 'val') !== '0') page.hyphenate = true;
  const ln = kid(sect, 'lnNumType');
  if (ln) { const by = Number(attr(ln, 'countBy') ?? 1); page.lineNumbers = by >= 10 ? 'every10' : by >= 5 ? 'every5' : 'all'; }
  const track = onOff(kid(settings?.documentElement ?? null, 'trackRevisions')) === true;
  const reader = new Reader(zip, ctx, styles);
  const comments = readComments(await xml(zip, (await relOfType('comments')) ?? 'word/comments.xml'),
    await xml(zip, (await relOfType('commentsExtended')) ?? 'word/commentsExtended.xml'));
  for (const c of comments) reader.threadStarts.add(c.id.slice(1));
  reader.footnotes = readNotes(await xml(zip, (await relOfType('footnotes')) ?? 'word/footnotes.xml'));
  reader.inBody = true;
  const content = body ? await reader.blocks(body, main) : [];
  reader.inBody = false;
  let watermark: Watermark | null = null;

  const hf = async (kind: 'headerReference' | 'footerReference'): Promise<JSONContent | null> => {
    const refs = kids(sect, kind);
    const ref = refs.find(r => attr(r, 'type') === 'default') ?? refs.find(r => !attr(r, 'type'));
    const target = ref ? main.rels.get(attr(ref, 'id') ?? '')?.target : undefined;
    if (!target) return null;
    const part = await readPart(zip, target);
    if (!part) return null;
    watermark ??= readWatermark(part.doc);
    const blocks = (await reader.blocks(part.doc.documentElement, part)).filter(b => b.type !== 'pageBreak');
    const hasText = JSON.stringify(blocks).match(/"text":"[^"]*\S|"pageNumber"|"image"/);
    return hasText ? { type: 'doc', content: blocks } : null;
  };

  const header = await hf('headerReference');
  const footer = await hf('footerReference');
  if (watermark) page.watermark = watermark;
  return {
    body: { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] },
    header,
    footer,
    page,
    styles,
    lang: ctx.defaultsR.lang,
    ...(comments.length ? { comments } : {}),
    ...(track ? { track } : {}),
  };
}

const paragraphsText = (el: Element) => kids(el, 'p').map(p => [...p.getElementsByTagName('*')].filter(n => n.localName === 't').map(n => n.textContent ?? '').join(''));

/** Word's comments as threads: a reply points to its parent through commentsExtended.xml (Word 2013 and later). */
function readComments(doc: Document | null, extended: Document | null): LetterComment[] {
  if (!doc) return [];
  const ext = new Map<string, { parent: string | null; done: boolean }>();
  for (const e of kids(extended?.documentElement, 'commentEx')) {
    ext.set(attr(e, 'paraId') ?? '', { parent: attr(e, 'paraIdParent'), done: attr(e, 'done') === '1' });
  }
  const byPara = new Map<string, LetterComment>();
  const out: LetterComment[] = [];
  for (const c of kids(doc.documentElement, 'comment')) {
    const id = attr(c, 'id');
    if (id === null) continue;
    const paras = kids(c, 'p');
    const paraId = attr(paras[paras.length - 1], 'paraId') ?? '';
    const info = ext.get(paraId);
    const item: LetterComment = {
      id: `w${id}`, author: attr(c, 'author') || '?', date: attr(c, 'date') ?? new Date().toISOString(),
      text: paragraphsText(c).join('\n').trim(),
    };
    const parent = info?.parent ? byPara.get(info.parent) : undefined;
    if (parent) (parent.replies ??= []).push({ id: item.id, author: item.author, date: item.date, text: item.text });
    else {
      if (info?.done) item.resolved = true;
      out.push(item);
    }
    if (paraId) byPara.set(paraId, parent ?? item);
  }
  return out;
}

/** Footnote texts by id, without Word's separator notes. */
function readNotes(doc: Document | null): Map<string, string> {
  const out = new Map<string, string>();
  for (const n of kids(doc?.documentElement, 'footnote')) {
    const type = attr(n, 'type');
    if (type && type !== 'normal') continue;
    out.set(attr(n, 'id') ?? '', paragraphsText(n).join('\n').trim());
  }
  return out;
}

/** A Word watermark: WordArt text in the header. */
function readWatermark(doc: Document): Watermark | null {
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.localName !== 'textpath' || !attr(el, 'string')) continue;
    const shape = el.parentElement;
    const fill = attr(shape, 'fillcolor') ?? '';
    const color = /^#?[0-9a-f]{6}$/i.test(fill) ? `#${fill.replace('#', '').toUpperCase()}` : '#C0C0C0';
    return { text: attr(el, 'string')!, color };
  }
  return null;
}
