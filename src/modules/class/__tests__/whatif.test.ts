import { describe, expect, it } from 'vitest';
import { emptySheet, key, type WorkbookData } from '../../../formats/sheet';
import { cellName } from '../../../formats/formula';
import { customValue, goalSeek, invalidCells, isValid, listChoices, parseRefs, scenarioSummary, simplex, solve, type Validation } from '../whatif';

const book = (cells: Record<string, string>): WorkbookData => {
  const s = emptySheet('Sheet1');
  for (const [name, input] of Object.entries(cells)) {
    const m = name.match(/^([A-Z]+)(\d+)$/)!;
    const c = m[1].charCodeAt(0) - 65, r = Number(m[2]) - 1;
    s.cells[key(c, r)] = { input };
  }
  return { sheets: [s] };
};
const k = (name: string) => { const c = name.charCodeAt(0) - 65, r = Number(name.slice(1)) - 1; return key(c, r); };

describe('Goal Seek', () => {
  it('finds the loan amount for a monthly payment', () => {
    // B1 rate, B2 months, B3 amount, B4 payment.
    const b = book({ B1: '0.05', B2: '60', B3: '10000', B4: '=PMT(B1/12,B2,-B3)' });
    const r = goalSeek(b, 0, k('B4'), 300, k('B3'));
    expect(r.ok).toBe(true);
    expect(r.x).toBeCloseTo(15897.21, 1);
  });
  it('solves a non-linear equation from far away', () => {
    const r = goalSeek(book({ A1: '1', A2: '=A1^3-2*A1-5' }), 0, k('A2'), 0, k('A1'));
    expect(r.ok).toBe(true);
    expect(r.x).toBeCloseTo(2.0946, 3);
  });
  it('says so when it cannot', () => {
    expect(goalSeek(book({ A1: '1', A2: '=A1^2+1' }), 0, k('A2'), 0, k('A1')).ok).toBe(false);
  });
});

describe('Solver', () => {
  it('solves the classic product mix (linear, exact)', () => {
    // Max 3x + 5y with x <= 4, 2y <= 12, 3x + 2y <= 18 → x=2, y=6, 36.
    const b = book({ A1: '0', A2: '0', B1: '=3*A1+5*A2', C1: '=A1', C2: '=2*A2', C3: '=3*A1+2*A2' });
    const r = solve(b, 0, { objective: 'B1', goal: 'max', vars: 'A1:A2', nonNegative: true, constraints: [
      { left: 'C1', op: '<=', right: '4' }, { left: 'C2', op: '<=', right: '12' }, { left: 'C3', op: '<=', right: '18' },
    ] });
    expect(r.method).toBe('simplex');
    expect(r.status).toBe('optimal');
    expect(r.x).toEqual([2, 6]);
    expect(r.objective).toBe(36);
  });
  it('uses whole numbers (knapsack with yes/no)', () => {
    // Values 60,100,120; weights 10,20,30; capacity 50 → take 2 and 3 = 220.
    const b = book({ A1: '0', A2: '0', A3: '0', B1: '=60*A1+100*A2+120*A3', C1: '=10*A1+20*A2+30*A3' });
    const r = solve(b, 0, { objective: 'B1', goal: 'max', vars: 'A1:A3', nonNegative: true, constraints: [
      { left: 'C1', op: '<=', right: '50' }, { left: 'A1:A3', op: 'bin', right: '' },
    ] });
    expect(r.x).toEqual([0, 1, 1]);
    expect(r.objective).toBe(220);
  });
  it('minimises a cost with ≥ constraints and a cell on the right', () => {
    const b = book({ A1: '0', A2: '0', B1: '=2*A1+3*A2', C1: '=A1+A2', D1: '10', C2: '=A1' });
    const r = solve(b, 0, { objective: 'B1', goal: 'min', vars: 'A1, A2', nonNegative: true, constraints: [
      { left: 'C1', op: '>=', right: 'D1' }, { left: 'C2', op: '<=', right: '6' },
    ] });
    expect(r.x).toEqual([6, 4]);
    expect(r.objective).toBe(24);
  });
  it('finds infeasible models', () => {
    const b = book({ A1: '0', C1: '=A1' });
    expect(solve(b, 0, { objective: 'C1', goal: 'max', vars: 'A1', nonNegative: true, constraints: [
      { left: 'C1', op: '>=', right: '5' }, { left: 'C1', op: '<=', right: '2' },
    ] }).status).toBe('infeasible');
  });
  it('solves a non-linear model by search', () => {
    // Min (x-3)^2 + (y+1)^2 + 2 → x=3, y=-1.
    const b = book({ A1: '0', A2: '0', B1: '=(A1-3)^2+(A2+1)^2+2' });
    const r = solve(b, 0, { objective: 'B1', goal: 'min', vars: 'A1:A2', nonNegative: false, constraints: [] });
    expect(r.method).toBe('search');
    expect(r.x[0]).toBeCloseTo(3, 3);
    expect(r.x[1]).toBeCloseTo(-1, 3);
  });
  it('reaches a target value', () => {
    const b = book({ A1: '1', B1: '=A1*A1' });
    const r = solve(b, 0, { objective: 'B1', goal: 'value', target: 49, vars: 'A1', nonNegative: true, constraints: [] });
    expect(r.x[0]).toBeCloseTo(7, 2);
  });
  it('simplex handles free variables and equalities', () => {
    // Max -x - y with x + y = 3, x - y = 5, both free → x=4, y=-1.
    const r = simplex([-1, -1], [{ a: [1, 1], b: 3, op: '=' }, { a: [1, -1], b: 5, op: '=' }], 2, [false, false]);
    expect(r.status).toBe('optimal');
    expect(r.x[0]).toBeCloseTo(4); expect(r.x[1]).toBeCloseTo(-1);
  });
});

describe('Scenarios and validation', () => {
  it('builds a summary with each scenario\'s results', () => {
    const b = book({ A1: '10', A2: '=A1*2' });
    const s = scenarioSummary(b, 0, [{ id: '1', name: 'Best', cells: [k('A1')], values: ['50'] }, { id: '2', name: 'Worst', cells: [k('A1')], values: ['1'] }], [k('A2')],
      { title: 'Scenario summary', changing: 'Changing cells', result: 'Result cells', current: 'Current' });
    const text = Object.entries(s.cells).map(([kk, c]) => `${kk}=${c.input}`).join(' ');
    expect(text).toContain('Best');
    expect(s.cells[key(2, 6)]?.input).toBe('100');
    expect(s.cells[key(3, 6)]?.input).toBe('2');
    expect(s.cells[key(1, 6)]?.input).toBe('20');
  });
  const rule = (p: Partial<Validation>): Validation => ({ id: 'v', range: { c1: 0, r1: 0, c2: 0, r2: 9 }, kind: 'whole', op: 'between', a: '1', b: '10', ignoreBlank: true, ...p });
  it('checks whole numbers, lists, length and dates', () => {
    const vals = new Map();
    expect(isValid(rule({}), 5, '5', vals)).toBe(true);
    expect(isValid(rule({}), 5.5, '5.5', vals)).toBe(false);
    expect(isValid(rule({}), 11, '11', vals)).toBe(false);
    expect(isValid(rule({}), '', '', vals)).toBe(true);
    expect(isValid(rule({ kind: 'list', list: 'Oui, Non' }), 'non', 'non', vals)).toBe(true);
    expect(isValid(rule({ kind: 'list', list: 'Oui, Non' }), 'Peut-être', 'Peut-être', vals)).toBe(false);
    expect(isValid(rule({ kind: 'length', op: 'le', a: '5' }), 'abcdef', 'abcdef', vals)).toBe(false);
    expect(isValid(rule({ kind: 'date', op: 'ge', a: '2026-01-01' }), 46300, '46300', vals)).toBe(true);
  });
  it('reads list choices from a range and checks custom formulas per cell', () => {
    const b = book({ D1: 'Rouge', D2: 'Vert', A1: '4', A2: '7', B1: '5' });
    const values = new Map([[k('D1'), 'Rouge'], [k('D2'), 'Vert']]);
    expect(listChoices(rule({ kind: 'list', list: '=D1:D2' }), values)).toEqual(['Rouge', 'Vert']);
    const even = rule({ kind: 'custom', a: '=MOD(A1,2)=0', range: { c1: 0, r1: 0, c2: 0, r2: 1 } });
    expect(customValue(b, 0, even, 0, 0)).toBe(true);
    expect(customValue(b, 0, even, 0, 1)).toBe(false);
    b.sheets[0].validations = [even];
    expect(invalidCells(b, 0, new Map([[k('A1'), 4], [k('A2'), 7]]))).toEqual([k('A2')]);
  });
  it('parses several references', () => {
    expect(parseRefs('A1:A2, $C$3')).toEqual([k('A1'), k('A2'), k('C3')]);
    expect(parseRefs('nope')).toBeNull();
    expect(cellName(2, 2)).toBe('C3');
  });
});
