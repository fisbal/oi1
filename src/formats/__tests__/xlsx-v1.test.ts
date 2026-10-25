import { describe, expect, it } from 'vitest';
import { readXlsx, styleFromCode, formatCode, xlsxBytes } from '../xlsx';
import { key, type WorkbookData } from '../sheet';

export const richBook = (): WorkbookData => ({
  currency: 'EUR',
  sheets: [{
    name: 'Sales', widths: { 0: 140 }, heights: { 0: 40 },
    cells: {
      [key(0, 0)]: { input: 'Quarterly report', style: { bold: true, font: 'Georgia', size: 18, align: 'center', valign: 'middle' } },
      [key(0, 1)]: { input: 'Month', style: { bold: true, borders: { bottom: { style: 'double' } } } },
      [key(1, 1)]: { input: 'Sales', style: { bold: true, borders: { bottom: { style: 'thick', color: '#C00000' } } } },
      [key(2, 1)]: { input: 'Note', style: { bold: true } },
      [key(0, 2)]: { input: 'Jan' }, [key(1, 2)]: { input: '1200.5', style: { format: 'number', decimals: 1 } },
      [key(2, 2)]: { input: 'A long note that wraps', style: { wrap: true, valign: 'top', indent: 2, strike: true } },
      [key(0, 3)]: { input: 'Feb' }, [key(1, 3)]: { input: '900', style: { format: 'accounting' } },
      [key(0, 4)]: { input: 'Mar' }, [key(1, 4)]: { input: '0.25', style: { format: 'percent', decimals: 1 } },
      [key(0, 5)]: { input: 'Apr' }, [key(1, 5)]: { input: '45000.5', style: { format: 'dateTime' } },
    },
    merges: [{ c1: 0, r1: 0, c2: 2, r2: 0 }],
    freeze: { c: 1, r: 2 },
    noGrid: true,
    tabColor: '#70AD47',
    filter: { range: { c1: 0, r1: 1, c2: 2, r2: 5 }, hidden: { 0: ['Feb'] } },
    rules: [
      { id: 'a', range: { c1: 1, r1: 2, c2: 1, r2: 5 }, kind: 'greater', a: '1000', fill: '#C6EFCE', color: '#006100' },
      { id: 'b', range: { c1: 1, r1: 2, c2: 1, r2: 5 }, kind: 'bars', fill: '#638EC6' },
      { id: 'c', range: { c1: 0, r1: 2, c2: 0, r2: 5 }, kind: 'contains', a: 'a', fill: '#FFC7CE', color: '#9C0006' },
      { id: 'd', range: { c1: 1, r1: 2, c2: 1, r2: 5 }, kind: 'scale', colors: ['#F8696B', '#63BE7B', '#FFEB84'] },
    ],
    charts: [{ id: 'k', type: 'column', range: { c1: 0, r1: 1, c2: 1, r2: 5 }, title: 'Sales by month', x: 420, y: 30, w: 480, h: 290, labels: true }],
  }],
});

describe('xlsx for Class v1', () => {
  it('keeps fonts, borders, alignment, merges, panes, filter, rules and charts', async () => {
    const back = await readXlsx(await xlsxBytes(richBook()));
    const s = back.sheets[0];
    expect(s.cells[key(0, 0)].style).toEqual({ bold: true, font: 'Georgia', size: 18, align: 'center', valign: 'middle' });
    expect(s.cells[key(0, 1)].style?.borders).toEqual({ bottom: { style: 'double' } });
    expect(s.cells[key(1, 1)].style?.borders).toEqual({ bottom: { style: 'thick', color: '#C00000' } });
    expect(s.cells[key(2, 2)].style).toEqual({ wrap: true, valign: 'top', indent: 2, strike: true });
    expect(s.cells[key(1, 2)].style).toEqual({ format: 'number', decimals: 1 });
    expect(s.cells[key(1, 3)].style).toEqual({ format: 'accounting' });
    expect(s.cells[key(1, 4)].style).toEqual({ format: 'percent', decimals: 1 });
    expect(s.cells[key(1, 5)].style).toEqual({ format: 'dateTime' });
    expect(s.heights).toEqual({ 0: 40 });
    expect(s.merges).toEqual([{ c1: 0, r1: 0, c2: 2, r2: 0 }]);
    expect(s.freeze).toEqual({ c: 1, r: 2 });
    expect(s.noGrid).toBe(true);
    expect(s.tabColor).toBe('#70AD47');
    expect(s.filter).toEqual({ range: { c1: 0, r1: 1, c2: 2, r2: 5 }, hidden: { 0: ['Feb'] } });
    expect(s.rules?.map(r => r.kind)).toEqual(['greater', 'bars', 'contains', 'scale']);
    expect(s.rules?.[0]).toMatchObject({ a: '1000', fill: '#C6EFCE', color: '#006100' });
    expect(s.rules?.[3].colors).toEqual(['#F8696B', '#63BE7B', '#FFEB84']);
    expect(s.charts).toHaveLength(1);
    expect(s.charts?.[0]).toMatchObject({ type: 'column', range: { c1: 0, r1: 1, c2: 1, r2: 5 }, title: 'Sales by month', x: 420, y: 30, w: 480, h: 290, labels: true });
  });

  it('turns number formats into Excel codes and back', () => {
    for (const st of [{ format: 'number' as const }, { format: 'number' as const, decimals: 3, thousands: false }, { format: 'integer' as const },
      { format: 'currency' as const }, { format: 'accounting' as const, decimals: 0 }, { format: 'scientific' as const }, { format: 'fraction' as const },
      { format: 'time' as const }, { format: 'longDate' as const }, { format: 'percent' as const, decimals: 2 }]) {
      expect(styleFromCode(200, formatCode(st, 'EUR'))).toEqual(st);
      expect(styleFromCode(200, formatCode(st, 'USD'))).toEqual(st);
    }
  });
});
