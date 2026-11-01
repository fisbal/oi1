// Printing in Office Class, like Excel and further (Martin, 2026-11-01: "plusieurs types d'impression (cellule, page,
// sélection, colonne…)"). What to print (the sheet, the selection, the active cell, whole columns or rows, the page of
// the active cell, the print area, the visible cells or the whole workbook), on which paper, which way, how big, with
// grid lines, A/1 headings, rows repeated on every page and a header and footer. The pages are cut here, not by the
// browser, so the preview shows exactly the pages that print, numbered "Page 2 of 5".

import type { Scalar } from '../../formats/formula';
import { cellName, colName } from '../../formats/formula';
import { display, key, usedRange, type PrintSetup, type SheetData } from '../../formats/sheet';
import type { CondLook } from './cond';
import { esc, tdHtml } from './print';

export type { PrintSetup };

export type PrintScope = 'sheet' | 'selection' | 'cell' | 'columns' | 'rows' | 'page' | 'area' | 'visible' | 'formulas' | 'charts' | 'book';
export const PRINT_SCOPES: PrintScope[] = ['sheet', 'selection', 'cell', 'columns', 'rows', 'page', 'area', 'visible', 'formulas', 'charts', 'book'];

/** Paper sizes in CSS pixels (96 per inch), upright. Excel's list and the usual photo and envelope sizes. */
export const PAPERS: Record<string, { w: number; h: number; label: string; xl?: number }> = {
  a4: { w: 794, h: 1123, label: 'A4 · 21 × 29.7 cm', xl: 9 },
  letter: { w: 816, h: 1056, label: 'Letter · 8.5 × 11 in', xl: 1 },
  legal: { w: 816, h: 1344, label: 'Legal · 8.5 × 14 in', xl: 5 },
  a3: { w: 1123, h: 1587, label: 'A3 · 29.7 × 42 cm', xl: 8 },
  a5: { w: 559, h: 794, label: 'A5 · 14.8 × 21 cm', xl: 11 },
  a6: { w: 397, h: 559, label: 'A6 · 10.5 × 14.8 cm', xl: 70 },
  a2: { w: 1587, h: 2245, label: 'A2 · 42 × 59.4 cm', xl: 66 },
  b4: { w: 945, h: 1334, label: 'B4 · 25 × 35.3 cm', xl: 12 },
  b5: { w: 665, h: 945, label: 'B5 · 17.6 × 25 cm', xl: 13 },
  tabloid: { w: 1056, h: 1632, label: 'Tabloid · 11 × 17 in', xl: 3 },
  ledger: { w: 1632, h: 1056, label: 'Ledger · 17 × 11 in', xl: 4 },
  executive: { w: 696, h: 1008, label: 'Executive · 7.25 × 10.5 in', xl: 7 },
  statement: { w: 528, h: 816, label: 'Statement · 5.5 × 8.5 in', xl: 6 },
  folio: { w: 816, h: 1248, label: 'Folio · 8.5 × 13 in', xl: 14 },
  quarto: { w: 813, h: 1040, label: 'Quarto · 21.5 × 27.5 cm', xl: 15 },
  jisb5: { w: 688, h: 971, label: 'JIS B5 · 18.2 × 25.7 cm' },
  jisb4: { w: 971, h: 1376, label: 'JIS B4 · 25.7 × 36.4 cm' },
  envdl: { w: 416, h: 831, label: 'Envelope DL · 11 × 22 cm', xl: 27 },
  envc5: { w: 613, h: 866, label: 'Envelope C5 · 16.2 × 22.9 cm', xl: 28 },
  envc4: { w: 866, h: 1225, label: 'Envelope C4 · 22.9 × 32.4 cm', xl: 30 },
  env10: { w: 396, h: 912, label: 'Envelope #10 · 4.125 × 9.5 in', xl: 20 },
  photo4x6: { w: 384, h: 576, label: 'Photo · 10 × 15 cm (4 × 6 in)' },
  photo5x7: { w: 480, h: 672, label: 'Photo · 13 × 18 cm (5 × 7 in)' },
  card: { w: 288, h: 480, label: 'Index card · 3 × 5 in' },
};

/** Margins in pixels: [top, right, bottom, left]. Excel's Normal, Wide and Narrow, and more: the same on all sides in
 * cm or inches, wide on top for letterhead paper, wide at the bottom for notes. */
const CM = 96 / 2.54, IN = 96;
const even = (v: number): [number, number, number, number] => [v, v, v, v];
export const MARGINS: Record<string, [number, number, number, number]> = {
  normal: [72, 67, 72, 67],
  wide: [96, 96, 96, 96],
  narrow: [72, 24, 72, 24],
  none: [16, 16, 16, 16],
  binding: [72, 67, 72, 115],
  top: [192, 67, 72, 67],
  bottom: [72, 67, 192, 67],
  '1cm': even(CM), '1.5cm': even(1.5 * CM), '2cm': even(2 * CM), '2.5cm': even(2.5 * CM), '3cm': even(3 * CM), '4cm': even(4 * CM),
  '0.25in': even(0.25 * IN), '0.5in': even(0.5 * IN), '0.75in': even(0.75 * IN), '1in': even(IN), '1.25in': even(1.25 * IN), '1.5in': even(1.5 * IN), '2in': even(2 * IN),
};

/** Header and footer presets, like Excel's lists: i18n keys class.print.hf.1 … class.print.hf.21, each a template with
 * {page} {pages} {sheet} {file} {date} {time}. The chosen template is stored in the person's language. */
export const HEADER_PRESET_COUNT = 21;

/** Scaling choices: none, fit to pages, or a fixed size. */
export const FITS: string[] = ['none', 'page', 'width', 'height', '2x1', '1x2', '2x2',
  '25', '30', '40', '50', '60', '70', '75', '80', '85', '90', '95', '100', '110', '125', '150', '175', '200', '250', '300'];

export const DEFAULT_SETUP: Required<Omit<PrintSetup, 'area' | 'header' | 'footer'>> & Pick<PrintSetup, 'area' | 'header' | 'footer'> = {
  paper: 'a4', orientation: 'portrait', margins: 'normal', fit: 'none', grid: true, headings: false,
  titleRows: 0, titleCols: 0, center: false, order: 'down', header: '', footer: '{page} / {pages}',
};
export const setupOf = (sheet: SheetData) => ({ ...DEFAULT_SETUP, ...sheet.print });

export interface Box { c1: number; r1: number; c2: number; r2: number }
export interface PrintWhat {
  scope: PrintScope;
  /** The selection and the active cell, for the scopes that use them. */
  sel: Box;
  at: { c: number; r: number };
}

const DEFAULT_W = 104;
const DEFAULT_H = 26;
const HEAD_W = 40;
const HEAD_H = 22;
const FOOT_H = 26;
const colW = (s: SheetData, c: number) => s.widths[c] ?? DEFAULT_W;
const rowH = (s: SheetData, r: number) => s.heights?.[r] ?? DEFAULT_H;

/** Rows hidden by the sheet's filter. */
export function filteredRows(sheet: SheetData, values: Map<string, Scalar>, lang: string, currency: string): Set<number> {
  const out = new Set<number>();
  const f = sheet.filter;
  if (!f) return out;
  const cols = Object.entries(f.hidden).filter(([, v]) => v.length).map(([c, v]) => [Number(c), new Set(v)] as const);
  for (let r = f.range.r1 + 1; r <= f.range.r2 && cols.length; r++) {
    for (const [c, off] of cols) {
      if (off.has(display(values.get(key(c, r)) ?? '', sheet.cells[key(c, r)]?.style, lang, currency))) { out.add(r); break; }
    }
  }
  return out;
}

/** The columns and rows a scope prints, in order. */
export function printedCells(sheet: SheetData, what: PrintWhat, hidden: Set<number>): { cols: number[]; rows: number[] } {
  const u = usedRange(sheet);
  const span = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  const s = what.sel;
  const area = sheet.print?.area;
  let box: Box;
  switch (what.scope) {
    case 'selection': box = s; break;
    case 'cell': box = { c1: what.at.c, r1: what.at.r, c2: what.at.c, r2: what.at.r }; break;
    case 'columns': box = { c1: s.c1, r1: 0, c2: s.c2, r2: Math.max(0, u.rows) }; break;
    case 'rows': box = { c1: 0, r1: s.r1, c2: Math.max(0, u.cols), r2: s.r2 }; break;
    case 'area': box = area ?? { c1: 0, r1: 0, c2: Math.max(0, u.cols), r2: Math.max(0, u.rows) }; break;
    case 'charts': return { cols: [], rows: [] };
    default: box = { c1: 0, r1: 0, c2: Math.max(0, u.cols), r2: Math.max(0, u.rows) };
  }
  // Filtered rows never print, like Excel; "visible cells" leaves out empty rows and columns too.
  let rows = span(box.r1, box.r2).filter(r => !hidden.has(r));
  let cols = span(box.c1, box.c2);
  if (what.scope === 'visible') {
    const filled = (c: number, r: number) => { const x = sheet.cells[key(c, r)]; return !!(x?.input || x?.style?.fill); };
    rows = rows.filter(r => cols.some(c => filled(c, r)));
    cols = cols.filter(c => rows.some(r => filled(c, r)));
  }
  return { cols, rows };
}

export interface PageCut {
  sheet: number;
  cols: number[];
  rows: number[];
  /** Repeated title rows and columns shown on this page. */
  titleRows: number[];
  titleCols: number[];
  zoom: number;
  charts?: boolean;
}

/** The space for cells on a page, in pixels, before zoom. */
export function pageBox(setup: PrintSetup) {
  const p = PAPERS[setup.paper ?? 'a4'] ?? PAPERS.a4;
  const [w, h] = setup.orientation === 'landscape' ? [Math.max(p.w, p.h), Math.min(p.w, p.h)] : [p.w, p.h];
  const m = MARGINS[setup.margins ?? 'normal'] ?? MARGINS.normal;
  const foot = (setup.header ? FOOT_H : 0) + (setup.footer ? FOOT_H : 0);
  return { w, h, m, innerW: w - m[1] - m[3], innerH: h - m[0] - m[2] - foot };
}

/** Cuts the printed cells into pages, Excel's way: down then over (or over then down), with titles repeated. */
export function cutPages(sheet: SheetData, sheetIndex: number, cols: number[], rows: number[], setupIn: PrintSetup): PageCut[] {
  const setup = { ...DEFAULT_SETUP, ...setupIn };
  const box = pageBox(setup);
  const tRows = Array.from({ length: setup.titleRows ?? 0 }, (_, i) => i);
  const tCols = Array.from({ length: setup.titleCols ?? 0 }, (_, i) => i);
  const bodyRows = rows.filter(r => !tRows.includes(r));
  const bodyCols = cols.filter(c => !tCols.includes(c));
  const head = setup.headings ? 1 : 0;
  const sumW = (cs: number[]) => cs.reduce((a, c) => a + colW(sheet, c), 0) + head * HEAD_W;
  const sumH = (rs: number[]) => rs.reduce((a, r) => a + rowH(sheet, r), 0) + head * HEAD_H;
  const titleW = tCols.reduce((a, c) => a + colW(sheet, c), 0);
  const titleH = tRows.reduce((a, r) => a + rowH(sheet, r), 0);
  const allW = sumW(bodyCols) + titleW, allH = sumH(bodyRows) + titleH;
  const fit = setup.fit ?? 'none';
  let zoom = 1;
  const across = (n: number) => (box.innerW * n) / allW, down = (n: number) => (box.innerH * n) / allH;
  if (fit === 'page') zoom = Math.min(1, across(1), down(1));
  else if (fit === 'width') zoom = Math.min(1, across(1));
  else if (fit === 'height') zoom = Math.min(1, down(1));
  else if (/^\dx\d$/.test(fit)) zoom = Math.min(1, across(Number(fit[0])), down(Number(fit[2])));
  else if (/^\d+$/.test(fit)) zoom = Number(fit) / 100;
  zoom = Math.max(0.1, Math.min(4, zoom));

  // Greedy cuts: as many columns (rows) as fit in the page's width (height), at least one per page.
  const cut = (items: number[], size: (i: number) => number, room: number) => {
    const out: number[][] = [];
    let cur: number[] = [], used = 0;
    for (const i of items) {
      const s = size(i) * zoom;
      if (cur.length && used + s > room + 0.5) { out.push(cur); cur = []; used = 0; }
      cur.push(i); used += s;
    }
    if (cur.length || !out.length) out.push(cur);
    return out;
  };
  const colChunks = cut(bodyCols, c => colW(sheet, c), box.innerW - (titleW + head * HEAD_W) * zoom);
  const rowChunks = cut(bodyRows, r => rowH(sheet, r), box.innerH - (titleH + head * HEAD_H) * zoom);
  const pages: PageCut[] = [];
  const add = (cs: number[], rs: number[]) => pages.push({ sheet: sheetIndex, cols: cs, rows: rs, titleRows: tRows, titleCols: tCols, zoom });
  if (setup.order === 'over') for (const rs of rowChunks) for (const cs of colChunks) add(cs, rs);
  else for (const cs of colChunks) for (const rs of rowChunks) add(cs, rs);
  return pages;
}

export interface PrintBookInput {
  sheets: SheetData[];
  values: Map<string, Scalar>[];
  looks: (i: number) => Map<string, CondLook>;
  hidden: (i: number) => Set<number>;
  active: number;
  lang: string;
  currency: string;
  file: string;
  /** Chart pictures of a sheet, drawn when printing. */
  charts: (i: number) => string[];
}

/** Every page of a print job. */
export function planPages(input: PrintBookInput, what: PrintWhat, setup: PrintSetup): PageCut[] {
  const one = (i: number, w: PrintWhat): PageCut[] => {
    const sh = input.sheets[i];
    const { cols, rows } = printedCells(sh, w, input.hidden(i));
    const pages = w.scope === 'charts' ? [] : cutPages(sh, i, cols, rows, setup);
    const charts = (sh.charts?.length ?? 0) > 0 && ['sheet', 'area', 'book', 'charts'].includes(w.scope);
    if (charts) pages.push({ sheet: i, cols: [], rows: [], titleRows: [], titleCols: [], zoom: 1, charts: true });
    return pages;
  };
  if (what.scope === 'book') return input.sheets.flatMap((s, i) => (usedRange(s).rows >= 0 || s.charts?.length ? one(i, { ...what, scope: 'sheet' }) : []));
  if (what.scope === 'page') {
    // The page that holds the active cell.
    const all = one(input.active, { ...what, scope: 'sheet' });
    const hit = all.find(p => p.cols.includes(what.at.c) && p.rows.includes(what.at.r));
    return hit ? [hit] : all.slice(0, 1);
  }
  return one(input.active, what);
}

export const fillHf = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** The HTML of one page (for the preview) or of all pages (to print or save as PDF). */
export function pagesHtml(input: PrintBookInput, pages: PageCut[], setupIn: PrintSetup, scope: PrintScope, only?: number): string {
  const setup = { ...DEFAULT_SETUP, ...setupIn };
  const box = pageBox(setup);
  const now = new Date();
  const date = now.toLocaleDateString(input.lang), time = now.toLocaleTimeString(input.lang, { hour: '2-digit', minute: '2-digit' });
  const formulas = scope === 'formulas';
  const chartCache = new Map<number, string[]>();
  const html = pages.map((p, i) => {
    if (only !== undefined && i !== only) return '';
    const sh = input.sheets[p.sheet];
    const vars = { page: i + 1, pages: pages.length, sheet: sh.name, file: input.file, date, time };
    const head = setup.header ? `<div class="hf top">${esc(fillHf(setup.header, vars))}</div>` : '';
    const foot = setup.footer ? `<div class="hf bottom">${esc(fillHf(setup.footer, vars))}</div>` : '';
    let body: string;
    if (p.charts) {
      if (!chartCache.has(p.sheet)) chartCache.set(p.sheet, input.charts(p.sheet));
      body = chartCache.get(p.sheet)!.map(src => `<img src="${src}">`).join('');
    } else {
      body = tableHtml(input, p, setup, formulas);
    }
    return `<section class="page" style="width:${box.w}px;height:${box.h}px;padding:${box.m.map(v => `${v}px`).join(' ')}">${head}<div class="cells${setup.center ? ' center' : ''}"><div class="zoom" style="zoom:${p.zoom}">${body}</div></div>${foot}</section>`;
  }).join('');
  const grid = setup.grid;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(input.file)}</title><style>
@page { size: ${box.w}px ${box.h}px; margin: 0; }
html, body { margin: 0; background: #fff; }
body { font: 11pt Calibri, Carlito, Arial, sans-serif; color: #000; }
.page { box-sizing: border-box; position: relative; overflow: hidden; break-after: page; display: flex; flex-direction: column; background: #fff; }
.page:last-child { break-after: auto; }
.cells { flex: 1; min-height: 0; overflow: hidden; }
.cells.center { display: flex; justify-content: center; }
.hf { height: ${FOOT_H}px; line-height: ${FOOT_H}px; font-size: 9pt; color: #444; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
table { border-collapse: collapse; table-layout: fixed; }
td, th { position: relative; padding: 2px 5px; white-space: nowrap; overflow: hidden; vertical-align: bottom; box-sizing: border-box; ${grid ? 'border: 1px solid #c8c8c8;' : ''} }
th { background: #f0f0f0; font-weight: 400; color: #555; text-align: center; font-size: 9pt; border: 1px solid #bdbdbd; }
td span { position: relative; }
img { display: block; margin: 0 0 14px; max-width: ${box.innerW}px; max-height: ${box.innerH - 14}px; }
</style></head><body>${html}</body></html>`;
}

function tableHtml(input: PrintBookInput, p: PageCut, setup: PrintSetup, formulas: boolean): string {
  const sh = input.sheets[p.sheet];
  const values = input.values[p.sheet] ?? new Map<string, Scalar>();
  const looks = input.looks(p.sheet);
  const cols = [...p.titleCols, ...p.cols];
  const rows = [...p.titleRows, ...p.rows];
  // Merged cells: drawn from their first cell when it is on the page, clipped to the page.
  const anchor = new Map<string, { cs: number; rs: number }>();
  const covered = new Set<string>();
  for (const m of sh.merges ?? []) {
    const mc = cols.filter(c => c >= m.c1 && c <= m.c2), mr = rows.filter(r => r >= m.r1 && r <= m.r2);
    if (!mc.length || !mr.length) continue;
    anchor.set(key(mc[0], mr[0]), { cs: mc.length, rs: mr.length });
    for (const r of mr) for (const c of mc) if (c !== mc[0] || r !== mr[0]) covered.add(key(c, r));
  }
  const heads = !!setup.headings;
  const colTags = (heads ? `<col style="width:${HEAD_W}px">` : '') + cols.map(c => `<col style="width:${colW(sh, c)}px">`).join('');
  let out = '';
  if (heads) out += `<tr style="height:${HEAD_H}px"><th></th>${cols.map(c => `<th>${colName(c)}</th>`).join('')}</tr>`;
  for (const r of rows) {
    let tds = heads ? `<th>${r + 1}</th>` : '';
    for (const c of cols) {
      const k = key(c, r);
      if (covered.has(k)) continue;
      tds += tdHtml(sh, values, looks, input.lang, input.currency, c, r, anchor.get(k), formulas);
    }
    out += `<tr style="height:${rowH(sh, r)}px">${tds}</tr>`;
  }
  return `<table>${colTags}${out}</table>`;
}

/** "A1:D20", for the panel's summary. */
export const boxName = (b: Box) => (b.c1 === b.c2 && b.r1 === b.r2 ? cellName(b.c1, b.r1) : `${cellName(b.c1, b.r1)}:${cellName(b.c2, b.r2)}`);
