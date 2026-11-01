import { describe, expect, it } from 'vitest';
import type { SheetData } from '../../../formats/sheet';
import { readXlsx, xlsxBytes } from '../../../formats/xlsx';
import { cutPages, pagesHtml, planPages, printedCells, type PrintBookInput } from '../printSetup';

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
