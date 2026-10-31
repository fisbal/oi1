import { describe, expect, it } from 'vitest';
import { computeBook, key, type SheetData } from '../../../../formats/sheet';
import { isError } from '../../../../formats/formula';
import { runAudit, type AuditId } from '../audit';

// A data sheet: A = category, B = invoice number, C = amount.
function data(): SheetData {
  const cells: SheetData['cells'] = { [key(0, 0)]: { input: 'Region' }, [key(1, 0)]: { input: 'Invoice' }, [key(2, 0)]: { input: 'Amount' } };
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 1; i <= 200; i++) {
    cells[key(0, i)] = { input: ['North', 'South', 'East'][i % 3] };
    if (i !== 50 && i !== 51 && i !== 120) cells[key(1, i)] = { input: String(1000 + i) };
    cells[key(2, i)] = { input: String(Math.round(10 ** (1 + rnd() * 4))) }; // log-uniform: follows Benford
  }
  cells[key(2, 201)] = { input: '99999999' };
  cells[key(0, 201)] = { input: 'North' };
  return { name: 'Data', cells, widths: {} };
}
const run = (id: AuditId, box = { c1: 0, r1: 0, c2: 2, r2: 201 }) => {
  const sheet = data();
  const values = computeBook({ sheets: [sheet] })[0];
  const report = runAudit(id, { sheet, values, box, lang: 'en', name: 'Report' });
  const book = { sheets: [sheet, report] };
  const out = computeBook(book)[1];
  const texts = Object.keys(report.cells).map(k => String(out.get(k) ?? report.cells[k].input));
  const errors = Object.keys(report.cells).filter(k => isError(out.get(k)));
  return { report, out, texts, errors };
};

describe('Audit tools', () => {
  it('Benford: natural amounts conform', () => {
    const { texts, errors } = run('benford', { c1: 2, r1: 1, c2: 2, r2: 200 });
    expect(errors).toEqual([]);
    expect(texts.some(t => /conformity/i.test(t) && !/Non/.test(t))).toBe(true);
  });
  it('Benford: made-up amounts do not', () => {
    const sheet: SheetData = { name: 'S', cells: {}, widths: {} };
    for (let i = 0; i < 100; i++) sheet.cells[key(0, i)] = { input: String(500 + (i % 9) * 50) };
    const values = computeBook({ sheets: [sheet] })[0];
    const rep = runAudit('benford', { sheet, values, box: { c1: 0, r1: 0, c2: 0, r2: 99 }, lang: 'en', name: 'R' });
    expect(Object.values(rep.cells).some(c => /Nonconformity/.test(c.input))).toBe(true);
  });
  it('finds the gaps in invoice numbers', () => {
    const { texts } = run('gaps', { c1: 1, r1: 1, c2: 1, r2: 200 });
    expect(texts).toContain('1050 – 1051');
    expect(texts).toContain('1120');
  });
  it('finds the outlier', () => {
    const { texts } = run('outliers', { c1: 2, r1: 1, c2: 2, r2: 201 });
    expect(texts).toContain('C202');
  });
  it('finds duplicates and says when there are none', () => {
    const { texts } = run('duplicates', { c1: 0, r1: 1, c2: 0, r2: 201 });
    expect(texts.some(t => /North/.test(t))).toBe(true);
    const none = run('duplicates', { c1: 1, r1: 1, c2: 1, r2: 200 });
    expect(none.texts.some(t => /No duplicate/.test(t))).toBe(true);
  });
  it('builds a live summary table that adds up', () => {
    const { report, out, errors } = run('pivot');
    expect(errors).toEqual([]);
    const totalRow = Object.entries(report.cells).find(([, c]) => c.input.startsWith('=SUM(B'))!;
    const sum = data();
    let expected = 0;
    for (let i = 1; i <= 201; i++) expected += Number(sum.cells[key(2, i)].input);
    expect(out.get(totalRow[0])).toBe(expected);
  });
  it('checks formulas', () => {
    const sheet: SheetData = { name: 'F', cells: { [key(0, 0)]: { input: '5' }, [key(1, 0)]: { input: '=A1*1.2' }, [key(1, 1)]: { input: '=A1/0' }, [key(1, 2)]: { input: '=Z9+1' } }, widths: {} };
    const values = computeBook({ sheets: [sheet] })[0];
    const rep = runAudit('formulas', { sheet, values, box: { c1: 0, r1: 0, c2: 1, r2: 2 }, lang: 'en', name: 'R' });
    const all = Object.values(rep.cells).map(c => c.input).join(' | ');
    expect(all).toMatch(/Error/);
    expect(all).toMatch(/Number typed inside/);
    expect(all).toMatch(/empty cell/);
  });
});
