import { afterEach, describe, expect, it, vi } from 'vitest';
import { readXlsx, styleFromCode, formatCode, xlsxBytes } from '../xlsx';
import { currencyFor, display, key, type WorkbookData } from '../sheet';

// Canadian dollars: a Québec budget must read "1 227 $", not "1 227 €" or "1 227 $US" (from PR #128).
describe('Canadian dollars', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the plain $ sign in French and English', () => {
    expect(display(1227, { format: 'currency', decimals: 0 }, 'fr', 'CAD').replace(/\s/g, ' ')).toBe('1 227 $');
    expect(display(-818, { format: 'currency', decimals: 0 }, 'fr', 'CAD').replace(/\s/g, ' ')).toBe('-818 $');
    expect(display(1227, { format: 'currency', decimals: 0 }, 'en', 'CAD')).toBe('$1,227');
    expect(display(1227, { format: 'currency', decimals: 0 }, 'fr', 'EUR').replace(/\s/g, ' ')).toBe('1 227 €');
  });

  it('keeps CAD through an .xlsx save and reads Excel French (Canada) dollar codes', async () => {
    const book: WorkbookData = { currency: 'CAD', sheets: [{ name: 'Budget', widths: {}, cells: { [key(0, 0)]: { input: '1800', style: { format: 'currency' } } } }] };
    const back = await readXlsx(await xlsxBytes(book));
    expect(back.currency).toBe('CAD');
    expect(back.sheets[0].cells[key(0, 0)].style).toMatchObject({ format: 'currency' });
    for (const st of [{ format: 'currency' as const }, { format: 'currency' as const, decimals: 0 }, { format: 'accounting' as const }]) {
      expect(styleFromCode(200, formatCode(st, 'CAD'))).toMatchObject({ ...st, currency: 'CAD' });
    }
    expect(styleFromCode(200, '#,##0.00\\ [$$-C0C]')).toMatchObject({ format: 'currency', currency: 'CAD' });
  });

  it('counts in dollars on a Canadian device when the file names no currency', () => {
    vi.stubGlobal('navigator', { language: 'fr-CA', languages: ['fr-CA', 'fr'] });
    expect(currencyFor('fr')).toBe('CAD');
    expect(currencyFor('fr', { currency: 'EUR', sheets: [] })).toBe('EUR');
    vi.stubGlobal('navigator', { language: 'fr-FR', languages: ['fr-FR'] });
    expect(currencyFor('fr')).toBe('EUR');
  });
});
