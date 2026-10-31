import { describe, expect, it } from 'vitest';
import { computeBook, key, type WorkbookData } from '../../../../formats/sheet';
import { isError } from '../../../../formats/formula';
import { setRatesForTest } from '../../../../shell/rates';
import { ALL_TOOLS, PRO_CATEGORIES, buildTool, sheetNameFor } from '../tools';

setRatesForTest({ date: '2026-10-31', eur: { eur: 1, usd: 1.08, gbp: 0.85, xaf: 655.957, xof: 655.957, chf: 0.94, jpy: 163, cad: 1.5, cny: 7.7, mad: 10.8, ngn: 1700, cdf: 3000, brl: 6, inr: 90, zar: 20, aud: 1.65, tnd: 3.4, dzd: 145, btc: 0.000012 } });

const valueOf = (book: WorkbookData, c: number, r: number) => computeBook(book)[0].get(key(c, r));

describe('Métiers: ready professional sheets', () => {
  it('has 20+ tools in each category, each with a name and help in 5 languages', () => {
    for (const cat of PRO_CATEGORIES) {
      expect(cat.tools.length).toBeGreaterThanOrEqual(20);
      for (const t of cat.tools) { expect(t.name).toHaveLength(5); expect(t.desc).toHaveLength(5); }
    }
    expect(new Set(ALL_TOOLS.map(t => t.id)).size).toBe(ALL_TOOLS.length);
  });

  for (const lang of ['en', 'fr', 'de'] as const) {
    it(`builds every sheet in ${lang} with no formula error`, () => {
      for (const tool of ALL_TOOLS) {
        const sheet = buildTool(tool, lang);
        const book: WorkbookData = { sheets: [sheet] };
        const values = computeBook(book)[0];
        const bad = Object.entries(sheet.cells).filter(([k, c]) => c.input.startsWith('=') && isError(values.get(k)));
        expect(bad.map(([k, c]) => `${tool.id} ${k} ${c.input} → ${JSON.stringify(values.get(k))}`)).toEqual([]);
        expect(sheet.name.length).toBeLessThanOrEqual(31);
      }
    });
  }

  it('works out a loan like Excel', () => {
    const sheet = buildTool(ALL_TOOLS.find(t => t.id === 'loan')!, 'en');
    // find the cell with PMT
    const pmt = Object.entries(sheet.cells).find(([, c]) => /PMT\(/.test(c.input))!;
    const [c, r] = pmt[0].split(',').map(Number);
    const v = valueOf({ sheets: [sheet] }, c, r) as number;
    expect(v).toBeGreaterThan(0);
  });

  it('balances the double entry examples', () => {
    for (const id of ['journal', 'trial', 'balance']) {
      const sheet = buildTool(ALL_TOOLS.find(t => t.id === id)!, 'en');
      const values = computeBook({ sheets: [sheet] })[0];
      const texts = [...values.values()].filter(v => typeof v === 'string' && /Balanced|Difference/.test(v));
      expect(texts.length, id).toBeGreaterThan(0);
      expect(texts.every(t => (t as string).includes('Balanced')), id).toBe(true);
    }
  });

  it('gives unique sheet names', () => {
    const t = ALL_TOOLS[0];
    const a = sheetNameFor(t, 'fr', []);
    const b = sheetNameFor(t, 'fr', [a]);
    expect(b).not.toBe(a);
    expect(b.length).toBeLessThanOrEqual(31);
  });
});
