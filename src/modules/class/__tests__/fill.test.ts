import { describe, expect, it } from 'vitest';
import { autofill } from '../fill';
import { key, type Cell } from '../../../formats/sheet';

const col = (...inputs: string[]) => Object.fromEntries(inputs.map((input, r) => [key(0, r), { input } as Cell]));
const down = (cells: Record<string, Cell>, n: number, to: number) => {
  const out = autofill(cells, { c1: 0, r1: 0, c2: 0, r2: n - 1 }, { c1: 0, r1: 0, c2: 0, r2: to });
  return Array.from({ length: to - n + 1 }, (_, i) => out[key(0, n + i)]?.input);
};

describe('fill handle', () => {
  it('continues numbers', () => {
    expect(down(col('1', '2'), 2, 4)).toEqual(['3', '4', '5']);
    expect(down(col('10', '8'), 2, 3)).toEqual(['6', '4']);
    expect(down(col('5'), 1, 2)).toEqual(['6', '7']);
  });
  it('continues text with numbers, days and months', () => {
    expect(down(col('Item 1'), 1, 2)).toEqual(['Item 2', 'Item 3']);
    expect(down(col('Q1', 'Q2'), 2, 3)).toEqual(['Q3', 'Q4']);
    expect(down(col('Monday'), 1, 2)).toEqual(['Tuesday', 'Wednesday']);
    expect(down(col('DIMANCHE'), 1, 1)).toEqual(['LUNDI']);
    expect(down(col('dec'), 1, 1)).toEqual(['jan']);
    expect(down(col('Hello'), 1, 2)).toEqual(['Hello', 'Hello']);
  });
  it('moves formula references', () => {
    expect(down(col('=A1*2'), 1, 2)).toEqual(['=A2*2', '=A3*2']);
    expect(down(col('=$A$1+B1'), 1, 1)).toEqual(['=$A$1+B2']);
  });
  it('fills up and to the left', () => {
    const cells = { [key(2, 5)]: { input: '5' }, [key(2, 6)]: { input: '6' } };
    const up = autofill(cells, { c1: 2, r1: 5, c2: 2, r2: 6 }, { c1: 2, r1: 3, c2: 2, r2: 6 });
    expect([up[key(2, 4)]?.input, up[key(2, 3)]?.input]).toEqual(['4', '3']);
    const f = autofill({ [key(3, 0)]: { input: '=D2' } }, { c1: 3, r1: 0, c2: 3, r2: 0 }, { c1: 1, r1: 0, c2: 3, r2: 0 });
    expect([f[key(2, 0)]?.input, f[key(1, 0)]?.input]).toEqual(['=C2', '=B2']);
  });
});
