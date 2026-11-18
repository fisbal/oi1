import { describe, expect, it } from 'vitest';
import type { SheetData } from '../../../formats/sheet';
import { readXlsx, xlsxBytes } from '../../../formats/xlsx';
import { cutPages, insertBreak, pagesHtml, parseArea, parseTitles, planPages, printedCells, removeBreak, type PrintBookInput } from '../printSetup';

const big = (cols: number, rows: number): SheetData => {
  const cells: SheetData['cells'] = {};
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) cells[`${c},${r}`] = { input: r === 0 ? `H${c}` : String(r * 10 + c) };
  return { name: 'Data', cells, widths: {} };
};
const input = (s: SheetData): PrintBookInput => ({
  sheets: [s], values: [new Map(Object.entries(s.cells).map(([k, v]) => [k, isNaN(Number(v.input)) ? v.input : Number(v.input)]))],
  looks: () => new Map(), hidden: () => new Set(), active: 0, lang: 'en', currency: 'USD', file: 'Book.xlsx', charts: () => [],
});
const sel = { c1: 1, r1: 2, c2: 2, r2: 4 };
const at = { c: 3, r: 5 };

describe('print scopes', () => {
  const s = big(6, 10);
  it('prints the sheet, the selection, the cell, columns and rows', () => {
    expect(printedCells(s, { scope: 'sheet', sel, at }, new Set())).toEqual({ cols: [0, 1, 2, 3, 4, 5], rows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
    expect(printedCells(s, { scope: 'selection', sel, at }, new Set())).toEqual({ cols: [1, 2], rows: [2, 3, 4] });
    expect(printedCells(s, { scope: 'cell', sel, at }, new Set())).toEqual({ cols: [3], rows: [5] });
    expect(printedCells(s, { scope: 'columns', sel, at }, new Set()).cols).toEqual([1, 2]);
    expect(printedCells(s, { scope: 'columns', sel, at }, new Set()).rows).toHaveLength(10);
    expect(printedCells(s, { scope: 'rows', sel, at }, new Set())).toEqual({ cols: [0, 1, 2, 3, 4, 5], rows: [2, 3, 4] });
  });
  it('leaves filtered rows out and uses the print area', () => {
    expect(printedCells(s, { scope: 'sheet', sel, at }, new Set([3, 4])).rows).not.toContain(3);
    const withArea = { ...s, print: { area: { c1: 0, r1: 0, c2: 1, r2: 1 } } };
    expect(printedCells(withArea, { scope: 'area', sel, at }, new Set())).toEqual({ cols: [0, 1], rows: [0, 1] });
  });
});

describe('pages', () => {
  it('cuts a big sheet down then over, and fits on one page when asked', () => {
    const s = big(20, 120);
    const { cols, rows } = printedCells(s, { scope: 'sheet', sel, at }, new Set());
    const pages = cutPages(s, 0, cols, rows, {});
    expect(pages.length).toBeGreaterThan(4);
    expect(pages[0].cols).toEqual(pages[1].cols); // down first
    expect(cutPages(s, 0, cols, rows, { order: 'over' })[1].rows).toEqual(pages[0].rows);
    const one = cutPages(s, 0, cols, rows, { fit: 'page' });
    expect(one).toHaveLength(1);
    expect(one[0].zoom).toBeLessThan(1);
    expect(cutPages(s, 0, cols, rows, { fit: 'width' }).every(p => p.cols.length === 20)).toBe(true);
    expect(cutPages(s, 0, cols, rows, { orientation: 'landscape' }).length).toBeLessThan(pages.length + 1);
  });
  it('repeats title rows on every page and numbers the pages', () => {
    const s = big(3, 200);
    const pages = planPages(input(s), { scope: 'sheet', sel, at }, { titleRows: 1, footer: 'Page {page} of {pages}' });
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every(p => p.titleRows[0] === 0 && !p.rows.includes(0))).toBe(true);
    const html = pagesHtml(input(s), pages, { titleRows: 1, footer: 'Page {page} of {pages}' }, 'sheet');
    expect(html).toContain(`Page 2 of ${pages.length}`);
    expect(html.match(/>H0</g)?.length).toBe(pages.length);
  });
  it('prints only the page of the active cell, and formulas when asked', () => {
    const s = big(3, 200);
    s.cells['0,150'] = { input: '=1+1' };
    const pages = planPages(input(s), { scope: 'page', sel, at: { c: 0, r: 150 } }, {});
    expect(pages).toHaveLength(1);
    expect(pages[0].rows).toContain(150);
    expect(pagesHtml(input(s), pages, {}, 'formulas')).toContain('=1+1');
  });
});

describe('xlsx page setup', () => {
  it('keeps paper, orientation, fit, grid, titles, area, header and footer', async () => {
    const s = big(4, 5);
    s.print = { paper: 'letter', orientation: 'landscape', fit: 'width', grid: true, headings: true, center: true, titleRows: 1, titleCols: 1,
      area: { c1: 0, r1: 0, c2: 2, r2: 3 }, header: '{sheet}', footer: 'Page {page} of {pages} & more', order: 'over', margins: 'narrow' };
    const back = await readXlsx(await xlsxBytes({ sheets: [s] }));
    expect(back.sheets[0].print).toEqual(s.print);
  });
});

describe('page order and breaks, like Excel (Martin, 2026-11-18)', () => {
  // 20 columns × 120 rows: 2 pages wide and several tall on A4 portrait.
  const s = big(20, 120);
  const { cols, rows } = printedCells(s, { scope: 'sheet', sel, at }, new Set());
  it('numbers the pages down then over by default, over then down when asked', () => {
    const down = cutPages(s, 0, cols, rows, {});
    const tall = Math.max(...down.map(p => p.at!.y)) + 1, wide = Math.max(...down.map(p => p.at!.x)) + 1;
    expect(wide).toBeGreaterThan(1);
    expect(tall).toBeGreaterThan(1);
    expect(down.map(p => p.at)).toEqual(Array.from({ length: wide * tall }, (_, i) => ({ x: Math.floor(i / tall), y: i % tall })));
    const over = cutPages(s, 0, cols, rows, { order: 'over' });
    expect(over.map(p => p.at)).toEqual(Array.from({ length: wide * tall }, (_, i) => ({ x: i % wide, y: Math.floor(i / wide) })));
    // Page 2 is below page 1 (down) or right of it (over).
    expect(down[1].cols).toEqual(down[0].cols);
    expect(over[1].rows).toEqual(over[0].rows);
  });
  it('starts a new page at a manual break, and ignores breaks when fitted to pages', () => {
    const pages = cutPages(s, 0, cols, rows, { breaks: { rows: [10], cols: [2] } });
    expect(pages[0].rows[pages[0].rows.length - 1]).toBe(9);
    expect(pages[1].rows[0]).toBe(10);
    expect(pages[0].cols).toEqual([0, 1]);
    expect(cutPages(s, 0, cols, rows, { breaks: { rows: [10] }, fit: 'page' })).toHaveLength(1);
  });
  it('inserts and removes breaks at the active cell like Excel', () => {
    expect(insertBreak({}, { c: 0, r: 5 })).toEqual({ rows: [5], cols: [] });
    expect(insertBreak({}, { c: 3, r: 0 })).toEqual({ rows: [], cols: [3] });
    expect(insertBreak({ breaks: { rows: [5] } }, { c: 3, r: 8 })).toEqual({ rows: [5, 8], cols: [3] });
    expect(removeBreak({ breaks: { rows: [5, 8], cols: [3] } }, { c: 3, r: 8 })).toEqual({ rows: [5], cols: [] });
  });
  it('fits to any W × H pages, 0 meaning automatic', () => {
    expect(cutPages(s, 0, cols, rows, { fit: '1x0' }).every(p => p.cols.length === 20)).toBe(true);
    expect(cutPages(s, 0, cols, rows, { fit: '2x2' }).length).toBeLessThanOrEqual(4);
  });
  it('repeats rows from anywhere ($3:$3) and keeps rows above them on page 1', () => {
    const t = big(3, 200);
    const setup = { titleRows: 1, titleRowStart: 2 };
    const pages = planPages(input(t), { scope: 'sheet', sel, at }, setup);
    const html = pagesHtml(input(t), pages, setup, 'sheet');
    expect(pages.length).toBeGreaterThan(1);
    // Row 3 (20, 21, 22) prints on every page; page 1 keeps rows 1 and 2 above it.
    expect(html.match(/>20</g)?.length).toBe(pages.length);
    const first = pagesHtml(input(t), pages, setup, 'sheet', 0);
    expect(first.indexOf('>H0<')).toBeLessThan(first.indexOf('>20<'));
  });
  it('reads titles and areas typed like Excel', () => {
    expect(parseTitles('$3:$4', 'rows')).toEqual({ start: 2, n: 2 });
    expect(parseTitles('$B:$C', 'cols')).toEqual({ start: 1, n: 2 });
    expect(parseTitles('', 'rows')).toEqual({ start: 0, n: 0 });
    expect(parseTitles('x', 'rows')).toBeUndefined();
    expect(parseArea('$A$1:$D$20')).toEqual({ c1: 0, r1: 0, c2: 3, r2: 19 });
    expect(parseArea('')).toBeNull();
    expect(parseArea('A0')).toBeUndefined();
  });
  it('prints cell errors as blank, -- or #N/A, numbers from the first page number, and in black and white', () => {
    const t = big(2, 3);
    const inp = input(t);
    inp.values[0].set('1,1', { error: '#DIV/0!' });
    const p = planPages(inp, { scope: 'sheet', sel, at }, {});
    expect(pagesHtml(inp, p, {}, 'sheet')).toContain('#DIV/0!');
    expect(pagesHtml(inp, p, { errors: 'dash' }, 'sheet')).toContain('>--<');
    expect(pagesHtml(inp, p, { errors: 'na' }, 'sheet')).toContain('>#N/A<');
    expect(pagesHtml(inp, p, { errors: 'blank' }, 'sheet')).not.toContain('#DIV/0!');
    expect(pagesHtml(inp, p, { firstPage: 7, footer: 'Page {page}' }, 'sheet')).toContain('Page 7');
    expect(pagesHtml(inp, p, { bw: true }, 'sheet')).toContain('background: none !important');
  });
});

describe('xlsx page setup, the rest of Excel\'s options', () => {
  it('keeps breaks, custom margins, vertical centering, black and white, errors, first page, titles from row 3', async () => {
    const s = big(6, 30);
    s.print = { paper: 'a4', breaks: { rows: [10, 20], cols: [3] }, margins: 'custom', custom: [1.2, 0.4, 0.9, 0.6], vcenter: true, bw: true,
      errors: 'na', firstPage: 5, titleRows: 2, titleRowStart: 2, titleCols: 1, titleColStart: 1, fit: '3x0', order: 'over' };
    const back = await readXlsx(await xlsxBytes({ sheets: [s] }));
    expect(back.sheets[0].print).toEqual(s.print);
  });
});
