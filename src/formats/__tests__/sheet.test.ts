import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '../csv';
import { evaluate, isError, moveRefs } from '../formula';
import { computeSheet, display, key, readEntry, type WorkbookData } from '../sheet';
import { readXlsx, xlsxBytes } from '../xlsx';

const grid: Record<string, number | string> = { A1: 2, A2: 3, A3: 5, B1: 'x', B2: 'y', B3: 'x' };
const get = (c: number, r: number) => grid[`${String.fromCharCode(65 + c)}${r + 1}`] ?? '';

describe('formulas', () => {
  it('works out arithmetic and functions like a spreadsheet', () => {
    expect(evaluate('1+2*3', get)).toBe(7);
    expect(evaluate('(1+2)*3^2', get)).toBe(27);
    expect(evaluate('SUM(A1:A3)', get)).toBe(10);
    expect(evaluate('AVERAGE(A1:A3)', get)).toBeCloseTo(10 / 3);
    expect(evaluate('MAX(A1:A3)-MIN(A1:A3)', get)).toBe(3);
    expect(evaluate('IF(A3>4,"big","small")', get)).toBe('big');
    expect(evaluate('SUMIF(B1:B3,"x",A1:A3)', get)).toBe(7);
    expect(evaluate('COUNTIF(A1:A3,">2")', get)).toBe(2);
    expect(evaluate('ROUND(2.345,2)', get)).toBe(2.35);
    expect(evaluate('"Total: "&SUM(A1:A2)', get)).toBe('Total: 5');
    expect(evaluate('50%*A3', get)).toBe(2.5);
    expect(evaluate('sum(a1;a2)', get)).toBe(5); // lower case and semicolons, as typed in French or German
  });

  it('reports errors instead of crashing', () => {
    expect(evaluate('1/0', get)).toEqual({ error: '#DIV/0!' });
    expect(evaluate('NOPE(1)', get)).toEqual({ error: '#NAME?' });
    expect(isError(evaluate('1+', get))).toBe(true);
    expect(evaluate('IFERROR(1/0,"none")', get)).toBe('none');
  });

  it('moves relative references and keeps absolute ones', () => {
    const down = (c: number, r: number, absC: boolean, absR: boolean) => ({ c: absC ? c : c + 1, r: absR ? r : r + 2 });
    expect(moveRefs('SUM(A1:B2)+$C$3+"A1"', down)).toBe('SUM(B3:C4)+$C$3+"A1"');
  });

  it('finds cycles', () => {
    const v = computeSheet({ name: 'S', widths: {}, cells: { [key(0, 0)]: { input: '=A2' }, [key(0, 1)]: { input: '=A1+1' } } });
    expect(v.get(key(0, 1))).toEqual({ error: '#CYCLE!' });
  });
});

describe('typing into cells', () => {
  it('understands money, percentages, dates and thousands', () => {
    expect(readEntry('15%')).toEqual({ input: '0.15', format: 'percent' });
    expect(readEntry('€9,99')).toEqual({ input: '9.99', format: 'currency' });
    expect(readEntry('1,200.50')).toEqual({ input: '1200.50' });
    expect(readEntry('1.200,50', true)).toEqual({ input: '1200.50' });
    expect(readEntry('2026-10-25').format).toBe('date');
  });

  it('shows numbers in the user language', () => {
    expect(display(1234.5, { format: 'number' }, 'en', 'USD')).toBe('1,234.50');
    expect(display(0.25, { format: 'percent' }, 'en', 'USD')).toBe('25%');
    expect(display(1.5, undefined, 'fr', 'EUR')).toBe('1,5');
  });
});

describe('csv', () => {
  it('reads quotes, semicolons and new lines in fields', () => {
    expect(parseCsv('a;"b;c";"say ""hi"""\n1;2;"x\ny"')).toEqual([['a', 'b;c', 'say "hi"'], ['1', '2', 'x\ny']]);
    expect(parseCsv(toCsv([['a,b', 'c']]))).toEqual([['a,b', 'c']]);
  });
});

describe('xlsx', () => {
  it('keeps values, formulas, formats, widths and sheets through a save', async () => {
    const book: WorkbookData = {
      currency: 'EUR',
      sheets: [
        {
          name: 'Budget 2026', widths: { 0: 180 }, cells: {
            [key(0, 0)]: { input: 'Item', style: { bold: true, fill: '#D4A843' } },
            [key(1, 0)]: { input: 'Cost', style: { bold: true, align: 'right' } },
            [key(0, 1)]: { input: 'Paper' }, [key(1, 1)]: { input: '12.5', style: { format: 'currency' } },
            [key(0, 2)]: { input: 'Ink' }, [key(1, 2)]: { input: '30', style: { format: 'currency' } },
            [key(0, 3)]: { input: 'Total', style: { italic: true } }, [key(1, 3)]: { input: '=SUM(B2:B3)', style: { format: 'currency', bold: true } },
            [key(2, 3)]: { input: '007', style: { format: 'text' } },
            [key(3, 3)]: { input: '0.2', style: { format: 'percent', color: '#C00000' } },
          },
        },
        { name: 'Notes', widths: {}, cells: { [key(0, 0)]: { input: '<b>&"quotes"</b>' } } },
      ],
    };
    const back = await readXlsx(await xlsxBytes(book));
    expect(back.currency).toBe('EUR');
    expect(back.sheets.map(s => s.name)).toEqual(['Budget 2026', 'Notes']);
    const s = back.sheets[0];
    expect(s.widths[0]).toBe(180);
    expect(s.cells[key(1, 3)]).toEqual({ input: '=SUM(B2:B3)', style: { format: 'currency', bold: true } });
    expect(s.cells[key(0, 0)].style).toEqual({ bold: true, fill: '#D4A843' });
    expect(s.cells[key(1, 0)].style).toEqual({ bold: true, align: 'right' });
    expect(s.cells[key(2, 3)]).toEqual({ input: '007', style: { format: 'text' } });
    expect(s.cells[key(3, 3)].style).toEqual({ format: 'percent', color: '#C00000' });
    expect(computeSheet(s).get(key(1, 3))).toBe(42.5);
    expect(back.sheets[1].cells[key(0, 0)].input).toBe('<b>&"quotes"</b>');
  });

  it('reads the same workbook after LibreOffice saved it', async () => {
    const { readFileSync } = await import('node:fs');
    const file = readFileSync(`${process.cwd()}/src/formats/__tests__/fixtures/libreoffice.xlsx`);
    const book = await readXlsx(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    const s = book.sheets[0];
    expect(book.sheets.map(x => x.name)).toEqual(['Budget 2026', 'Notes']);
    expect(s.cells[key(0, 1)].input).toBe('Paper');
    expect(s.cells[key(1, 3)].input).toBe('=SUM(B2:B3)');
    expect(s.cells[key(1, 3)].style).toMatchObject({ bold: true, format: 'currency' });
    expect(s.cells[key(0, 0)].style).toMatchObject({ bold: true, fill: '#D4A843' });
    expect(s.cells[key(2, 3)]).toMatchObject({ input: '007', style: { format: 'text' } });
    expect(s.cells[key(3, 3)].style).toMatchObject({ format: 'percent', color: '#C00000' });
    expect(computeSheet(s).get(key(1, 3))).toBe(42.5);
  });
});
