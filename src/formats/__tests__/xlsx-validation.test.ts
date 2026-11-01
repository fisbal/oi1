import { describe, expect, it } from 'vitest';
import { readXlsx, xlsxBytes } from '../xlsx';
import { emptySheet, type WorkbookData } from '../sheet';

describe('xlsx data validation', () => {
  it('saves and opens list, number, date and custom rules with their messages', async () => {
    const s = emptySheet('Sheet1');
    s.validations = [
      { id: 'a', range: { c1: 0, r1: 1, c2: 0, r2: 9 }, kind: 'list', op: 'between', a: '', list: 'Oui, Non, Peut-être', ignoreBlank: true, dropdown: true, prompt: { title: 'Réponse', text: 'Choisissez' } },
      { id: 'b', range: { c1: 1, r1: 1, c2: 1, r2: 9 }, kind: 'whole', op: 'between', a: '1', b: '10', ignoreBlank: false, error: { style: 'warning', title: 'Hors limites', text: 'Entre 1 et 10' } },
      { id: 'c', range: { c1: 2, r1: 1, c2: 2, r2: 1 }, kind: 'date', op: 'ge', a: '2026-01-01', ignoreBlank: true },
      { id: 'd', range: { c1: 3, r1: 1, c2: 3, r2: 4 }, kind: 'custom', op: 'between', a: '=MOD(D2,2)=0', ignoreBlank: true },
      { id: 'e', range: { c1: 4, r1: 1, c2: 4, r2: 4 }, kind: 'list', op: 'between', a: '', list: '=$H$1:$H$3', ignoreBlank: true },
    ];
    const book: WorkbookData = { sheets: [s] };
    const back = (await readXlsx(await xlsxBytes(book))).sheets[0].validations!;
    expect(back).toHaveLength(5);
    expect(back[0]).toMatchObject({ kind: 'list', list: 'Oui, Non, Peut-être', dropdown: true, prompt: { title: 'Réponse', text: 'Choisissez' }, range: { c1: 0, r1: 1, c2: 0, r2: 9 } });
    expect(back[1]).toMatchObject({ kind: 'whole', op: 'between', a: '1', b: '10', ignoreBlank: false, error: { style: 'warning', title: 'Hors limites' } });
    expect(back[2]).toMatchObject({ kind: 'date', op: 'ge', a: '2026-01-01' });
    expect(back[3]).toMatchObject({ kind: 'custom', a: '=MOD(D2,2)=0' });
    expect(back[4]).toMatchObject({ kind: 'list', list: '=$H$1:$H$3' });
  });
});
