// Turns a professional model (a few lines of labels, inputs and formulas) into a ready sheet: a title, yellow
// input cells to change (Excel's own "Input" look), headers, real formulas and totals. Everything stays editable.

import type { Cell, CellStyle, NumberFormat, SheetData } from '../../../formats/sheet';
import { key, readEntry } from '../../../formats/sheet';
import { cellName } from '../../../formats/formula';

export type Lang = 'en' | 'fr' | 'es' | 'pt' | 'de';
/** A text in the 5 languages, in this order: en, fr, es, pt, de. */
export type Tx = readonly [string, string, string, string, string];
const LANGS: Lang[] = ['en', 'fr', 'es', 'pt', 'de'];
export const tx = (t: Tx | string, lang: Lang) => (typeof t === 'string' ? t : t[LANGS.indexOf(lang)] ?? t[0]);

type Fmt = 'money' | 'pct' | 'date' | 'int' | 'num' | 'text';
/** One cell of a model. */
export type Item =
  | null
  | number
  | Tx
  | string // '=…' a formula, otherwise plain text
  | { in: number | string | Tx; f?: Fmt; id?: string } // a value the person changes (yellow)
  | { v: number | string | Tx; f?: Fmt; head?: true; total?: true; bold?: true; note?: true; id?: string };
export type Row = Item[];

export interface Model {
  rows: Row[];
  /** Column widths in pixels, from column A. */
  widths?: number[];
  /** Keep this many top rows in view while scrolling. */
  freeze?: number;
}

const FORMAT: Record<Fmt, { format: NumberFormat; decimals?: number; thousands?: boolean }> = {
  money: { format: 'currency', decimals: 2, thousands: true },
  pct: { format: 'percent', decimals: 2 },
  date: { format: 'date' },
  int: { format: 'number', decimals: 0, thousands: true },
  num: { format: 'number', decimals: 2, thousands: true },
  text: { format: 'text' },
};
export const INPUT: CellStyle = { fill: '#FFF2CC', color: '#3F3F76', borders: { bottom: { style: 'thin', color: '#B7A57A' } } };
export const HEAD: CellStyle = { bold: true, fill: '#1F4E78', color: '#FFFFFF' };
const TITLE: CellStyle = { bold: true, size: 15 };
const TOTAL: CellStyle = { bold: true, borders: { top: { style: 'thin' }, bottom: { style: 'double' } } };
const NOTE: CellStyle = { italic: true, color: '#7F7F7F' };

const isTx = (x: unknown): x is Tx => Array.isArray(x) && x.length === 5 && x.every(s => typeof s === 'string');

/** The sheet for a model, titled `title`, in the interface language. */
export function buildSheet(name: string, title: string, model: Model, lang: Lang): SheetData {
  const cells: Record<string, Cell> = {};
  // Named cells: a formula writes $loan for the cell whose id is "loan" ($B$4), {r} for its own row, {r-1}…
  const ids: Record<string, string> = {};
  model.rows.forEach((row, ri) => row.forEach((item, c) => {
    if (item && typeof item === 'object' && !isTx(item) && item.id) ids[item.id] = cellName(c, ri + 2).replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2');
  }));
  const resolve = (f: string, r: number) => f
    .replace(/\$([a-z][A-Za-z0-9]*)/g, (m, id: string) => ids[id] ?? m)
    .replace(/\{r([+-]\d+)?\}/g, (_, d?: string) => String(r + 1 + (d ? Number(d) : 0)));
  cells[key(0, 0)] = { input: title, style: TITLE };
  model.rows.forEach((row, ri) => {
    const r = ri + 2; // a blank line under the title
    row.forEach((item, c) => {
      if (item === null || item === '') return;
      let input: string, style: CellStyle | undefined;
      if (typeof item === 'number') input = String(item);
      else if (typeof item === 'string') input = item;
      else if (isTx(item)) input = tx(item, lang);
      else if ('in' in item) {
        input = isTx(item.in) ? tx(item.in, lang) : String(item.in);
        style = { ...INPUT, ...(item.f ? FORMAT[item.f] : {}) };
      } else {
        input = isTx(item.v) ? tx(item.v, lang) : String(item.v);
        style = { ...(item.head ? HEAD : {}), ...(item.total ? TOTAL : {}), ...(item.bold ? { bold: true } : {}), ...(item.note ? NOTE : {}), ...(item.f ? FORMAT[item.f] : {}) };
      }
      if (typeof item === 'string' && item.startsWith('=')) style = undefined;
      if (input.startsWith('=')) input = resolve(input, r);
      else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) input = readEntry(input).input; // dates are numbers, as in Excel
      cells[key(c, r)] = style ? { input, style } : { input };
    });
  });
  const widths: Record<number, number> = {};
  (model.widths ?? [240, 130, 130, 130, 130, 130]).forEach((w, i) => { widths[i] = w; });
  return { name, cells, widths, ...(model.freeze ? { freeze: { c: 0, r: model.freeze + 2 } } : {}) };
}

/** A formula cell with a number format. */
export const out = (formula: string | Tx, f: Fmt = 'money', total = false, id?: string): Item => ({ v: formula, f, ...(total ? { total: true as const } : {}), ...(id ? { id } : {}) });
export const head = (...t: (Tx | string)[]): Row => t.map(v => ({ v, head: true as const }));
export const inp = (v: number | string | Tx, f?: Fmt, id?: string): Item => ({ in: v, ...(f ? { f } : {}), ...(id ? { id } : {}) });
export const note = (t: Tx): Row => [{ v: t, note: true }];
