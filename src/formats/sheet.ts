// A workbook as OI1 keeps it: sheets of cells holding what the user typed, plus a little formatting.
// Office Class edits it; formats/xlsx.ts and formats/csv.ts read and write it; Letter reads tables from it.

import { cellName, dateSerial, evaluate, isError, serialToDate, type Scalar } from './formula';

export type NumberFormat = 'general' | 'number' | 'integer' | 'currency' | 'accounting' | 'percent' | 'date' | 'longDate' | 'time' | 'dateTime' | 'scientific' | 'fraction' | 'text';

/** One side of a cell's border. */
export interface BorderLine { style: 'thin' | 'medium' | 'thick' | 'double' | 'dashed'; color?: string }

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** '#rrggbb' */
  color?: string;
  fill?: string;
  /** Font family and size in points; the sheet's default (Calibri-like, 11 pt) when not set. */
  font?: string;
  size?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  wrap?: boolean;
  /** Indent steps, about 3 characters each. */
  indent?: number;
  format?: NumberFormat;
  /** Digits after the decimal point for number, currency, percent and scientific formats. */
  decimals?: number;
  /** Show 1,234 thousands separators with the number format. */
  thousands?: boolean;
  borders?: { top?: BorderLine; right?: BorderLine; bottom?: BorderLine; left?: BorderLine };
}

/** A block of cells shown as one, like Excel's Merge & Center. */
export interface Merge { c1: number; r1: number; c2: number; r2: number }

/** A rule that colors cells by their value (Excel's conditional formatting). */
export interface CondRule {
  id: string;
  range: Merge;
  kind: 'greater' | 'less' | 'between' | 'equal' | 'contains' | 'duplicate' | 'top' | 'bottom' | 'aboveAverage' | 'belowAverage' | 'scale' | 'bars';
  /** The value(s) to compare with, or how many for top/bottom. */
  a?: string;
  b?: string;
  /** Fill and text color for highlight rules; the end colors for a color scale; the bar color. */
  fill?: string;
  color?: string;
  colors?: [string, string, string?];
}

/** A chart drawn over the sheet from a range of cells. */
export interface Chart {
  id: string;
  type: 'column' | 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'stacked';
  /** The data, like A1:C8; the first row and column hold labels when they are text. */
  range: Merge;
  title?: string;
  /** Series run down columns (true) or across rows. */
  byColumn?: boolean;
  legend?: boolean;
  labels?: boolean;
  palette?: number;
  /** Place and size in pixels from the sheet's top left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An AutoFilter: the table it covers and the values hidden in each of its columns. */
export interface Filter { range: Merge; hidden: Record<number, string[]>; sort?: { c: number; dir: 1 | -1 } }

/** A named set of values for some cells (Data › What-If › Scenarios). */
export interface Scenario { id: string; name: string; cells: string[]; values: string[]; comment?: string }

/** A Solver model kept with its sheet, like Excel keeps it. */
export interface SolverSaved {
  objective: string;
  goal: 'max' | 'min' | 'value';
  target?: number;
  vars: string;
  constraints: { left: string; op: '<=' | '>=' | '=' | 'int' | 'bin'; right: string }[];
  nonNegative: boolean;
}

/** What a cell accepts (Data › Data Validation). */
export type VKind = 'any' | 'whole' | 'decimal' | 'list' | 'date' | 'time' | 'length' | 'custom';
export type VOp = 'between' | 'notBetween' | 'eq' | 'ne' | 'gt' | 'lt' | 'ge' | 'le';
export interface Validation {
  id: string;
  range: Merge;
  kind: VKind;
  op: VOp;
  a: string;
  b?: string;
  /** For a list: "Yes, No, Maybe" or a range "=A1:A5". */
  list?: string;
  ignoreBlank: boolean;
  /** Show the arrow with the choices (lists). */
  dropdown?: boolean;
  prompt?: { title: string; text: string };
  error?: { style: 'stop' | 'warning' | 'info'; title: string; text: string };
}

export interface Cell {
  /** What the user typed: text, a number, or a formula starting with '='. */
  input: string;
  style?: CellStyle;
}

export interface SheetData {
  name: string;
  /** Cells by "column,row", both counted from 0. */
  cells: Record<string, Cell>;
  /** Column widths in pixels, where they differ from the default. */
  widths: Record<number, number>;
  /** Row heights in pixels, where they differ from the default. */
  heights?: Record<number, number>;
  merges?: Merge[];
  /** Rows above `r` and columns left of `c` stay in place while scrolling. */
  freeze?: { c: number; r: number };
  rules?: CondRule[];
  charts?: Chart[];
  filter?: Filter;
  /** Hide the grid lines, like Excel's View › Gridlines. */
  noGrid?: boolean;
  /** Text color of the sheet's tab. */
  tabColor?: string;
  /** Data validation rules. */
  validations?: Validation[];
  /** What-if scenarios. */
  scenarios?: Scenario[];
  /** The last Solver model. */
  solver?: SolverSaved;
}

export interface WorkbookData {
  sheets: SheetData[];
  /** Currency code for the currency format, like 'EUR'. */
  currency?: string;
}

export const key = (c: number, r: number) => `${c},${r}`;
export const unkey = (k: string) => { const [c, r] = k.split(',').map(Number); return { c, r }; };

export function emptySheet(name: string): SheetData {
  return { name, cells: {}, widths: {} };
}

/** The value of a typed entry that is not a formula: a number, TRUE/FALSE, or text. */
export function literal(input: string): Scalar {
  const s = input.trim();
  if (s === '') return '';
  if (/^[-+]?(\d+([.,]\d+)?|[.,]\d+)([eE][-+]?\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  const up = s.toUpperCase();
  if (up === 'TRUE' || up === 'FALSE') return up === 'TRUE';
  return input;
}

/**
 * Reads what the user typed the way a spreadsheet does: "12,5" or "1 200" is a number, "15%" a percentage,
 * "€9.99" or "$9.99" money, "2026-10-25" a date. `decimalComma` is true where 1,5 means one and a half. Returns the text to store and the format it suggests.
 */
export function readEntry(text: string, decimalComma = false): { input: string; format?: NumberFormat } {
  const s = text.trim();
  if (s.startsWith('=') || s === '') return { input: text };
  const plain = s.replace(/[\s  ]/g, '');
  let m = plain.match(/^([-+]?\d+(?:[.,]\d+)?)%$/);
  if (m) return { input: String(Number(m[1].replace(',', '.')) / 100), format: 'percent' };
  m = plain.match(/^(?:[$€£¥]([-+]?\d+(?:[.,]\d+)?)|([-+]?\d+(?:[.,]\d+)?)[$€£¥])$/);
  if (m) return { input: (m[1] ?? m[2]).replace(',', '.'), format: 'currency' };
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { input: String(dateSerial(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])))), format: 'date' };
  // 25/10/2026 (day first where 1,5 is written with a comma) or 10/25/2026 (English).
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const [day, month] = decimalComma || a > 12 ? [a, b] : [b, a];
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { input: String(dateSerial(new Date(year, month - 1, day))), format: 'date' };
  }
  m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) {
    let h = Number(m[1]) % (m[4] ? 12 : 24);
    if (m[4]?.toLowerCase() === 'pm') h += 12;
    return { input: String(Number(((h * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0)) / 86400).toFixed(10))), format: 'time' };
  }
  // Thousands separators: "1 200,50", "1,200.50" (English) or "1.200,50" (German, Spanish…).
  if (/^[-+]?\d{1,3}([\s\u00a0\u202f]\d{3})+([.,]\d+)?$/.test(s)) return { input: plain.replace(',', '.') };
  if (!decimalComma && /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return { input: s.replace(/,/g, '') };
  if (decimalComma && /^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return { input: s.replace(/\./g, '').replace(',', '.') };
  return { input: text };
}

/** Works out every cell of every sheet; formulas can read other sheets (Sheet2!A1). Formulas that depend on themselves show #CYCLE!. */
export function computeBook(book: WorkbookData): Map<string, Scalar>[] {
  const all = book.sheets.map(() => new Map<string, Scalar>());
  const busy = new Set<string>();
  const byName = new Map(book.sheets.map((s, i) => [s.name.toLowerCase(), i]));
  const get = (i: number, c: number, r: number): Scalar => {
    const values = all[i];
    const k = key(c, r);
    const done = values.get(k);
    if (done !== undefined) return done;
    const cell = book.sheets[i].cells[k];
    if (!cell) return '';
    if (!cell.input.startsWith('=') || cell.style?.format === 'text') {
      const v = cell.style?.format === 'text' ? cell.input : literal(cell.input);
      values.set(k, v);
      return v;
    }
    const id = `${i}:${k}`;
    if (busy.has(id)) return { error: '#CYCLE!' };
    busy.add(id);
    const v = evaluate(cell.input.slice(1), (cc, rr, sheet) => {
      if (sheet === undefined) return get(i, cc, rr);
      const j = byName.get(sheet.toLowerCase());
      return j === undefined ? { error: '#REF!' } : get(j, cc, rr);
    }, { c, r });
    busy.delete(id);
    values.set(k, v);
    return v;
  };
  book.sheets.forEach((s, i) => { for (const k of Object.keys(s.cells)) { const { c, r } = unkey(k); get(i, c, r); } });
  return all;
}

/** Works out every cell of one sheet; `book` lets its formulas read the other sheets. */
export function computeSheet(sheet: SheetData, book?: WorkbookData): Map<string, Scalar> {
  if (!book) return computeBook({ sheets: [sheet] })[0];
  const i = book.sheets.indexOf(sheet);
  return i < 0 ? computeBook({ sheets: [sheet, ...book.sheets] })[0] : computeBook(book)[i];
}

/** The used area of a sheet: the last column and row that hold something, or -1 when empty. */
export function usedRange(sheet: SheetData): { cols: number; rows: number } {
  let cols = -1, rows = -1;
  for (const [k, cell] of Object.entries(sheet.cells)) {
    if (!cell.input && !cell.style) continue;
    const { c, r } = unkey(k);
    if (c > cols) cols = c;
    if (r > rows) rows = r;
  }
  return { cols, rows };
}

const DEFAULT_CURRENCY: Record<string, string> = { en: 'USD', fr: 'EUR', es: 'EUR', pt: 'EUR', de: 'EUR' };
export const currencyFor = (lang: string, book?: WorkbookData) => book?.currency ?? DEFAULT_CURRENCY[lang.slice(0, 2)] ?? 'USD';

/** The digits a format shows after the decimal point when the user did not choose. */
export const defaultDecimals = (f: NumberFormat) => (f === 'number' || f === 'currency' || f === 'accounting' || f === 'scientific' ? 2 : 0);

function fraction(v: number): string {
  const whole = Math.trunc(v), rest = Math.abs(v - whole);
  if (rest < 1e-9) return String(whole);
  let best = { n: 0, d: 1, e: 1 };
  for (let d = 2; d <= 99; d++) { const n = Math.round(rest * d); const e = Math.abs(rest - n / d); if (e < best.e - 1e-12) best = { n, d, e }; }
  if (best.n === 0) return String(whole);
  if (best.n === best.d) return String(whole + Math.sign(v));
  return `${whole ? `${whole} ` : v < 0 ? '-' : ''}${best.n}/${best.d}`;
}

/** A value as the cell shows it. */
export function display(v: Scalar, style: CellStyle | undefined, lang: string, currency: string): string {
  if (isError(v)) return v.error;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string') return v;
  const f = style?.format ?? 'general';
  const d = style?.decimals ?? defaultDecimals(f);
  const grouping = style?.thousands ?? (f !== 'number' || undefined);
  try {
    if (f === 'number') return new Intl.NumberFormat(lang, { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: style?.thousands ?? true }).format(v);
    if (f === 'integer') return new Intl.NumberFormat(lang, { maximumFractionDigits: 0, useGrouping: grouping }).format(v);
    if (f === 'currency') return new Intl.NumberFormat(lang, { style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
    if (f === 'accounting') return new Intl.NumberFormat(lang, { style: 'currency', currency, currencySign: 'accounting', minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
    if (f === 'percent') return new Intl.NumberFormat(lang, { style: 'percent', minimumFractionDigits: style?.decimals ?? 0, maximumFractionDigits: style?.decimals ?? 2 }).format(v);
    if (f === 'scientific') return v.toExponential(d).replace('e', 'E');
    if (f === 'fraction') return fraction(v);
    if (f === 'date') return serialToDate(v).toLocaleDateString(lang);
    if (f === 'longDate') return serialToDate(v).toLocaleDateString(lang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (f === 'time') return serialToDate(v).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    if (f === 'dateTime') return serialToDate(v).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' });
  } catch { /* unknown currency or language: fall back to plain */ }
  if (style?.decimals !== undefined) return new Intl.NumberFormat(lang, { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: style.thousands ?? false }).format(v);
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  const s = Math.abs(v) >= 1e11 || (Math.abs(v) < 1e-6 && v !== 0) ? v.toExponential(5) : String(Number(v.toPrecision(11)));
  return lang.startsWith('en') ? s : s.replace('.', new Intl.NumberFormat(lang).format(1.5)[1]);
}

/** Where a value sits in its cell when the user did not choose: numbers to the right, like spreadsheets. */
export const naturalAlign = (v: Scalar) => (typeof v === 'number' ? 'right' : typeof v === 'boolean' || isError(v) ? 'center' : 'left');

export { cellName };
