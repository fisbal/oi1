// A workbook as OI1 keeps it: sheets of cells holding what the user typed, plus a little formatting.
// Office Class edits it; formats/xlsx.ts and formats/csv.ts read and write it; Letter reads tables from it.

import { cellName, dateSerial, evaluate, isError, serialToDate, type Scalar } from './formula';

export type NumberFormat = 'general' | 'number' | 'integer' | 'currency' | 'percent' | 'date' | 'text';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** '#rrggbb' */
  color?: string;
  fill?: string;
  align?: 'left' | 'center' | 'right';
  format?: NumberFormat;
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
  // Thousands separators: "1 200,50", "1,200.50" (English) or "1.200,50" (German, Spanish…).
  if (/^[-+]?\d{1,3}([\s\u00a0\u202f]\d{3})+([.,]\d+)?$/.test(s)) return { input: plain.replace(',', '.') };
  if (!decimalComma && /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return { input: s.replace(/,/g, '') };
  if (decimalComma && /^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return { input: s.replace(/\./g, '').replace(',', '.') };
  return { input: text };
}

/** Works out every cell of a sheet. Formulas that depend on themselves show #CYCLE!. */
export function computeSheet(sheet: SheetData): Map<string, Scalar> {
  const values = new Map<string, Scalar>();
  const busy = new Set<string>();
  const get = (c: number, r: number): Scalar => {
    const k = key(c, r);
    const done = values.get(k);
    if (done !== undefined) return done;
    const cell = sheet.cells[k];
    if (!cell) return '';
    if (!cell.input.startsWith('=') || cell.style?.format === 'text') {
      const v = cell.style?.format === 'text' ? cell.input : literal(cell.input);
      values.set(k, v);
      return v;
    }
    if (busy.has(k)) return { error: '#CYCLE!' };
    busy.add(k);
    const v = evaluate(cell.input.slice(1), get);
    busy.delete(k);
    values.set(k, v);
    return v;
  };
  for (const k of Object.keys(sheet.cells)) { const { c, r } = unkey(k); get(c, r); }
  return values;
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

/** A value as the cell shows it. */
export function display(v: Scalar, style: CellStyle | undefined, lang: string, currency: string): string {
  if (isError(v)) return v.error;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string') return v;
  const f = style?.format ?? 'general';
  try {
    if (f === 'number') return new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    if (f === 'integer') return new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(v);
    if (f === 'currency') return new Intl.NumberFormat(lang, { style: 'currency', currency }).format(v);
    if (f === 'percent') return new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 2 }).format(v);
    if (f === 'date') return serialToDate(v).toLocaleDateString(lang);
  } catch { /* unknown currency or language: fall back to plain */ }
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  const s = Math.abs(v) >= 1e11 || (Math.abs(v) < 1e-6 && v !== 0) ? v.toExponential(5) : String(Number(v.toPrecision(11)));
  return lang.startsWith('en') ? s : s.replace('.', new Intl.NumberFormat(lang).format(1.5)[1]);
}

/** Where a value sits in its cell when the user did not choose: numbers to the right, like spreadsheets. */
export const naturalAlign = (v: Scalar) => (typeof v === 'number' ? 'right' : typeof v === 'boolean' || isError(v) ? 'center' : 'left');

export { cellName };
