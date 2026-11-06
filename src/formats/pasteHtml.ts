// Cells pasted from Excel, Google Sheets, LibreOffice, Word or a web page, with their look kept exactly: fill and text
// colours, bold, italic, underline, font and size, alignment, wrap, borders, number formats (money, %, dates), merged
// cells, column widths and row heights (Martin, 2026-11-06: "coller des cellules venant de Excel… les mêmes couleurs que
// l'original"). Excel puts its look in a <style> block (classes like .xl65) plus mso- properties; the browser's own
// clipboard copy inlines the styles instead. Both are read here.

import { styleFromCode } from './numfmt';
import { readEntry, type BorderLine, type Cell, type CellStyle, type Merge } from './sheet';

export interface PastedBlock {
  /** Cells by "column,row" from the block's top left corner. */
  cells: Record<string, Cell>;
  cols: number;
  rows: number;
  merges: Merge[];
  /** Column widths and row heights in Excel's pixels (96 per inch), only where the source set them. */
  widths: Record<number, number>;
  heights: Record<number, number>;
}

type Decls = Record<string, string>;

/** CSS escapes as Excel writes them: \0022 is ", \# is #, \\ is \. */
function unescapeCss(v: string): string {
  return v.replace(/\\([0-9a-fA-F]{1,6}) ?|\\(.)/g, (_, hex: string | undefined, ch: string | undefined) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : ch ?? ''));
}

/** "a:b; c:'d;e'" as properties; ; inside quotes stays. */
export function parseDecls(text: string): Decls {
  const out: Decls = {};
  let cur = '', q = '';
  const flush = () => {
    const i = cur.indexOf(':');
    if (i > 0) out[cur.slice(0, i).trim().toLowerCase()] = cur.slice(i + 1).trim();
    cur = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) { cur += ch + text[++i]; continue; }
    if (q) { if (ch === q) q = ''; cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === ';') { flush(); continue; }
    cur += ch;
  }
  flush();
  return out;
}

/** The rules of a <style> block for td, th and classes. */
function parseSheet(css: string): { tag: Record<string, Decls>; cls: Record<string, Decls> } {
  const tag: Record<string, Decls> = {}, cls: Record<string, Decls> = {};
  // Excel wraps its rules in an HTML comment: the angle brackets and dashes around them are dropped. This text is
  // only read for colours and formats, never put on the page.
  const clean = css.replace(/[<>]/g, ' ').replace(/!?--/g, ' ').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const decls = parseDecls(m[2]);
    for (const sel of m[1].split(',').map(x => x.trim().toLowerCase())) {
      const c = sel.match(/^(?:td|th)?\.([\w-]+)$/);
      if (c) cls[c[1]] = { ...cls[c[1]], ...decls };
      else if (sel === 'td' || sel === 'th' || sel === 'table') tag[sel] = { ...tag[sel], ...decls };
    }
  }
  return { tag, cls };
}

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', lime: '#00ff00', blue: '#0000ff', yellow: '#ffff00',
  cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff', gray: '#808080', grey: '#808080', silver: '#c0c0c0',
  maroon: '#800000', olive: '#808000', navy: '#000080', purple: '#800080', teal: '#008080', orange: '#ffa500',
  windowtext: '#000000', window: '#ffffff', buttontext: '#000000',
};

/** A CSS colour as #rrggbb, or undefined for none/auto/transparent. */
export function cssColor(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase().replace(/\s*!important$/, '');
  if (!s || s === 'none' || s === 'auto' || s === 'transparent' || s === 'inherit' || s === 'initial' || s === 'currentcolor') return undefined;
  let m = s.match(/^#([0-9a-f]{6})$/);
  if (m) return `#${m[1]}`;
  m = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    if (m[4] !== undefined && (m[4].endsWith('%') ? parseFloat(m[4]) : Number(m[4]) * 100) < 50) return undefined;
    return `#${[m[1], m[2], m[3]].map(x => Math.min(255, Number(x)).toString(16).padStart(2, '0')).join('')}`;
  }
  if (NAMED[s]) return NAMED[s];
  // Any other named colour, through the browser.
  try {
    const c = document.createElement('canvas').getContext('2d');
    if (c) { c.fillStyle = '#010203'; c.fillStyle = s; const out = String(c.fillStyle); if (out !== '#010203' && /^#[0-9a-f]{6}$/.test(out)) return out; }
  } catch { /* no canvas */ }
  return undefined;
}

/** A length in points: "11.0pt", "15px", ".5pt". */
function points(v: string | undefined): number | undefined {
  const m = v?.trim().match(/^([\d.]+)\s*(pt|px|in|cm|mm)?$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  switch ((m[2] ?? 'px').toLowerCase()) {
    case 'pt': return n;
    case 'px': return n * 0.75;
    case 'in': return n * 72;
    case 'cm': return n * 72 / 2.54;
    case 'mm': return n * 72 / 25.4;
  }
  return undefined;
}

/** One side of a border, from "0.5pt solid windowtext" or "1px dashed #c00". */
function borderOf(v: string | undefined): BorderLine | undefined {
  if (!v) return undefined;
  const parts = v.trim().replace(/,\s*/g, ',').split(/\s+(?![^(]*\))/);
  if (parts.some(p => /^(none|hidden)$/i.test(p)) || /^0(\.0+)?(pt|px)?$/.test(parts[0] ?? '')) return undefined;
  const width = parts.map(p => points(p)).find(n => n !== undefined) ?? (parts.includes('thick') ? 2.25 : parts.includes('medium') ? 1.5 : 0.75);
  const kind = parts.find(p => /^(solid|double|dashed|dotted|groove|ridge|inset|outset)$/i.test(p))?.toLowerCase();
  if (!kind) return undefined;
  const color = parts.map(p => (/^(solid|double|dashed|dotted|thin|medium|thick|groove|ridge|inset|outset)$/i.test(p) || points(p) !== undefined ? undefined : cssColor(p))).find(Boolean);
  const style: BorderLine['style'] = kind === 'double' ? 'double' : kind === 'dashed' || kind === 'dotted' ? 'dashed' : width >= 2 ? 'thick' : width >= 1.1 ? 'medium' : 'thin';
  return color && color !== '#000000' ? { style, color } : { style };
}

const DEFAULT_FONTS = /^(calibri|aptos|aptos narrow|arial|helvetica|sans-serif|inherit)$/i;

/** The look of one cell from its CSS properties and tags. */
function styleOf(d: Decls, el: HTMLElement): CellStyle {
  const st: CellStyle = {};
  const inner = (sel: string) => !!el.querySelector(sel);
  const weight = d['font-weight'];
  if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600 || el.tagName === 'TH' || inner('b, strong')) st.bold = true;
  if (weight && (weight === 'normal' || Number(weight) < 600) && el.tagName === 'TH') delete st.bold;
  if (/italic|oblique/i.test(d['font-style'] ?? '') || inner('i, em')) st.italic = true;
  const deco = `${d['text-decoration'] ?? ''} ${d['text-decoration-line'] ?? ''} ${d['text-underline-style'] ?? ''}`;
  if (/underline|single|double/i.test(deco) || inner('u')) st.underline = true;
  if (/line-through/i.test(deco) || inner('s, strike, del')) st.strike = true;
  const font = el.querySelector('font');
  const color = cssColor(d.color) ?? cssColor(font?.getAttribute('color') ?? undefined) ?? cssColor(spanColor(el));
  if (color && color !== '#000000') st.color = color;
  const fill = cssColor(d['background-color']) ?? cssColor(d.background?.match(/#[0-9a-f]{3,6}\b|rgba?\([^)]*\)|\b[a-z]+\b/i)?.[0]) ?? cssColor(el.getAttribute('bgcolor') ?? undefined);
  if (fill) st.fill = fill;
  const family = (d['font-family'] ?? font?.getAttribute('face') ?? '').split(',')[0].replace(/["']/g, '').trim();
  if (family && !DEFAULT_FONTS.test(family)) st.font = family;
  const size = points(d['font-size']);
  if (size && Math.abs(size - 11) > 0.01 && size >= 4 && size <= 200) st.size = Math.round(size * 2) / 2;
  const align = (d['text-align'] ?? el.getAttribute('align') ?? '').toLowerCase();
  if (align === 'left' || align === 'center' || align === 'right') st.align = align;
  else if (align === 'centre' || align === 'center-across') st.align = 'center';
  const valign = (d['vertical-align'] ?? el.getAttribute('valign') ?? '').toLowerCase();
  if (valign === 'top') st.valign = 'top';
  else if (valign === 'middle' || valign === 'center') st.valign = 'middle';
  if (/^(normal|pre-wrap|break-spaces)$/i.test(d['white-space'] ?? '')) st.wrap = true;
  const indent = Number(d['mso-char-indent-count']);
  if (indent > 0) st.indent = Math.min(15, Math.round(indent));
  const borders: NonNullable<CellStyle['borders']> = {};
  const all = borderOf(d.border);
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const own = d[`border-${side}`];
    const b = own !== undefined ? borderOf(own) : all;
    if (b) borders[side] = b;
  }
  if (Object.keys(borders).length) st.borders = borders;
  const code = d['mso-number-format'];
  if (code) {
    const raw = unescapeCss(code.replace(/^["']|["']$/g, ''));
    if (!/^general$/i.test(raw)) Object.assign(st, styleFromCode(-1, raw));
  }
  return st;
}

/** The colour of a single span wrapping the whole cell text (Word, web pages). */
function spanColor(el: HTMLElement): string | undefined {
  const kids = Array.from(el.children);
  if (kids.length !== 1 || (kids[0].textContent ?? '').trim() !== (el.textContent ?? '').trim()) return undefined;
  const s = (kids[0] as HTMLElement).getAttribute('style');
  return s ? parseDecls(s).color : undefined;
}

/** A cell's text as it shows: spaces from the HTML source folded, <br> and paragraphs as new lines. */
export function cellText(el: Element): string {
  let out = '';
  const walk = (n: Node) => {
    if (n.nodeType === 3) { out += (n.textContent ?? '').replace(/[ \t\r\n]+/g, ' '); return; }
    if (n.nodeType !== 1) return;
    const tag = (n as Element).tagName;
    if (tag === 'STYLE' || tag === 'SCRIPT') return;
    if (tag === 'BR') { out = out.replace(/ $/, '') + '\n'; return; }
    const block = /^(P|DIV|LI|H[1-6])$/.test(tag);
    if (block && out && !out.endsWith('\n')) out = out.replace(/ $/, '') + '\n';
    n.childNodes.forEach(walk);
    if (block && !out.endsWith('\n')) out += '\n';
  };
  el.childNodes.forEach(walk);
  return out.split('\n').map(l => l.trim()).join('\n').replace(/^\n+|\n+$/g, '');
}

/** The format a typed or pasted entry suggests, with its money and where the sign goes. */
export const moneyOf = (e: ReturnType<typeof readEntry>): CellStyle => ({
  ...(e.format ? { format: e.format } : {}), ...(e.currency ? { currency: e.currency } : {}), ...(e.signFirst !== undefined ? { signFirst: e.signFirst } : {}),
});

const plainDecimal = (n: string) => /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(n);

/**
 * The first table in some HTML as cells with their look, or null. `decimalComma` reads "1,5" as one and a half.
 * Values: Excel's exact number (x:num) when given, else the text read like a typed entry ("1 234,50 €" is money).
 */
export function cellsFromHtml(html: string, decimalComma: boolean): PastedBlock | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;
  const sheet = parseSheet(Array.from(doc.querySelectorAll('style')).map(s => s.textContent ?? '').join('\n'));
  const cells: Record<string, Cell> = {};
  const merges: Merge[] = [];
  const widths: Record<number, number> = {}, heights: Record<number, number> = {};
  const taken = new Set<string>();
  // Column widths from <col>.
  let ci = 0;
  for (const col of Array.from(table.querySelectorAll('col'))) {
    const span = Math.max(1, Number(col.getAttribute('span')) || 1);
    const w = Number(col.getAttribute('width')) || (points(parseDecls(col.getAttribute('style') ?? '').width) ?? 0) / 0.75;
    for (let i = 0; i < span; i++, ci++) if (w > 0) widths[ci] = Math.round(w);
  }
  let rows = 0, cols = 0;
  const trs = Array.from(table.querySelectorAll('tr')).filter(tr => tr.closest('table') === table);
  trs.forEach((tr, r) => {
    const rowDecls = parseDecls(tr.getAttribute('style') ?? '');
    const h = Number(tr.getAttribute('height')) || (points(rowDecls.height) ?? 0) / 0.75;
    if (h > 0) heights[r] = Math.round(h);
    let c = 0;
    for (const td of Array.from(tr.children) as HTMLElement[]) {
      if (td.tagName !== 'TD' && td.tagName !== 'TH') continue;
      while (taken.has(`${c},${r}`)) c++;
      const cs = Math.max(1, Number(td.getAttribute('colspan')) || 1), rs = Math.max(1, Number(td.getAttribute('rowspan')) || 1);
      for (let dc = 0; dc < cs; dc++) for (let dr = 0; dr < rs; dr++) taken.add(`${c + dc},${r + dr}`);
      if (cs > 1 || rs > 1) merges.push({ c1: c, r1: r, c2: c + cs - 1, r2: r + rs - 1 });
      // The cascade: td/th rule, then each class, then the cell's own style.
      const decls: Decls = { ...sheet.tag.td, ...(td.tagName === 'TH' ? sheet.tag.th : {}) };
      for (const k of (td.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)) Object.assign(decls, sheet.cls[k.toLowerCase()]);
      Object.assign(decls, parseDecls(td.getAttribute('style') ?? ''));
      const style = styleOf(decls, td);
      const text = cellText(td);
      const num = td.getAttribute('x:num') ?? td.getAttribute('data-sheets-value')?.match(/"3":\s*(-?[\d.eE+-]+)/)?.[1] ?? td.getAttribute('sdval') ?? undefined;
      const formula = td.getAttribute('data-formula') ?? td.getAttribute('x:fmla') ?? td.getAttribute('data-sheets-formula') ?? undefined;
      let input = text;
      if (formula && formula.startsWith('=')) input = formula;
      else if (style.format === 'text') input = text;
      else if (num !== undefined && num !== '' && plainDecimal(num)) input = num;
      else if (text) {
        const e = readEntry(text, decimalComma);
        input = e.input;
        if (e.format && !style.format) Object.assign(style, moneyOf(e));
      }
      // Excel's x:num cell with no format code kept (the browser's copy): the shown text tells the format.
      if (num !== undefined && !style.format && text) {
        const e = readEntry(text, decimalComma);
        if (e.format) Object.assign(style, moneyOf(e));
      }
      if (input || Object.keys(style).length) cells[`${c},${r}`] = { input, ...(Object.keys(style).length ? { style } : {}) };
      c += cs;
      cols = Math.max(cols, c);
    }
    rows = r + 1;
  });
  for (const k of taken) { const [c, r] = k.split(',').map(Number); cols = Math.max(cols, c + 1); rows = Math.max(rows, r + 1); }
  return rows ? { cells, cols, rows, merges, widths, heights } : null;
}

/** Plain text from another app (tabs between cells, one line per row), each piece read like a typed entry. */
export function cellsFromText(text: string, decimalComma: boolean, parse: (t: string) => string[][]): PastedBlock {
  const grid = parse(text.replace(/\r\n?/g, '\n').replace(/\n$/, ''));
  const cells: Record<string, Cell> = {};
  let cols = 0;
  grid.forEach((row, r) => {
    cols = Math.max(cols, row.length);
    row.forEach((t, c) => {
      if (!t) return;
      const e = readEntry(t, decimalComma);
      cells[`${c},${r}`] = { input: e.input, ...(e.format ? { style: moneyOf(e) } : {}) };
    });
  });
  return { cells, cols, rows: grid.length, merges: [], widths: {}, heights: {} };
}
