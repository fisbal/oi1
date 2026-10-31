import { describe, expect, it } from 'vitest';
import { FUNCTION_NAMES, dateSerial, evaluate, isError, type Scalar } from '../formula';
import { setRatesForTest } from '../../shell/rates';

// A small sheet: A1:A5 cash flows, B1:B5 their dates, C1:C6 numbers for statistics.
const cells: Record<string, Scalar> = {
  A1: -10000, A2: 2750, A3: 4250, A4: 3250, A5: 2750,
  B1: dateSerial(new Date(2008, 0, 1)), B2: dateSerial(new Date(2008, 2, 1)), B3: dateSerial(new Date(2008, 9, 30)),
  B4: dateSerial(new Date(2009, 1, 15)), B5: dateSerial(new Date(2009, 3, 1)),
  C1: 3, C2: 2, C3: 4, C4: 5, C5: 6, C6: '',
  D1: 9, D2: 7, D3: 12, D4: 15, D5: 17,
};
const get = (c: number, r: number): Scalar => cells[`${String.fromCharCode(65 + c)}${r + 1}`] ?? '';
const ev = (f: string) => evaluate(f, get);

describe('Excel functions from Formula.js', () => {
  it('knows over 400 functions', () => {
    expect(FUNCTION_NAMES.length).toBeGreaterThan(400);
    expect(new Set(FUNCTION_NAMES).size).toBe(FUNCTION_NAMES.length); // each name once
    for (const n of ['IRR', 'XIRR', 'XNPV', 'RATE', 'NPER', 'IPMT', 'PPMT', 'SLN', 'DB', 'DDB', 'SYD', 'CORREL', 'FORECAST', 'NORM.DIST', 'PERCENTILE.INC', 'STDEV.S', 'DEVISE'])
      expect(FUNCTION_NAMES).toContain(n);
  });

  // Expected values are those Microsoft's Excel documentation gives for the same examples.
  it('works out finance like Excel', () => {
    expect(ev('XIRR(A1:A5,B1:B5)') as number).toBeCloseTo(0.373362535, 6);
    expect(ev('XNPV(0.09,A1:A5,B1:B5)') as number).toBeCloseTo(2086.6476, 2);
    expect(ev('IRR({-70000,12000,15000,18000,21000,26000})') as number).toBeCloseTo(0.0866, 4);
    expect(ev('RATE(48,-200,8000)') as number).toBeCloseTo(0.007701472, 7);
    expect(ev('NPER(0.12/12,-100,-1000,10000,1)') as number).toBeCloseTo(59.6738657, 5);
    expect(ev('IPMT(0.1/12,1,36,8000)') as number).toBeCloseTo(-66.67, 2);
    expect(ev('PPMT(0.1/12,1,24,2000)') as number).toBeCloseTo(-75.62, 2);
    expect(ev('SLN(30000,7500,10)')).toBe(2250);
    expect(ev('DDB(2400,300,10,1)') as number).toBeCloseTo(480, 6);
    expect(ev('SYD(30000,7500,10,1)') as number).toBeCloseTo(4090.91, 2);
    expect(ev('DB(1000000,100000,6,1,7)') as number).toBeCloseTo(186083.33, 2);
  });

  it('works out statistics like Excel', () => {
    expect(ev('CORREL(C1:C5,D1:D5)') as number).toBeCloseTo(0.997054486, 6);
    expect(ev('FORECAST(30,{6,7,9,15,21},{20,28,31,38,40})') as number).toBeCloseTo(10.607253, 5);
    expect(ev('NORM.DIST(42,40,1.5,TRUE)') as number).toBeCloseTo(0.9087888, 6);
    expect(ev('PERCENTILE.INC(C1:C5,0.3)') as number).toBeCloseTo(3.2, 6);
    expect(ev('STDEV.S(C1:C6)') as number).toBeCloseTo(1.58113883, 6); // the empty cell is left out
  });

  it('keeps our own functions and gives Excel errors', () => {
    expect(ev('SUM(C1:C6)')).toBe(20);
    expect(isError(ev('SLN(1,2)'))).toBe(true);
    expect(isError(ev('XIRR(A1:A2,B1)'))).toBe(true);
    expect(ev('NOSUCHFUNCTION(1)')).toEqual({ error: '#NAME?' });
  });

  it('gives dates back as dates (serial numbers)', () => {
    expect(ev('EDATE(DATE(2024,1,31),1)')).toBe(dateSerial(new Date(2024, 1, 29)));
    expect(ev('DAYS360(DATE(2011,1,30),DATE(2011,12,31))')).toBe(330);
  });
});

describe('DEVISE: money of the world', () => {
  it('converts with the rates of the day, through the euro', () => {
    setRatesForTest({ date: '2026-10-29', eur: { eur: 1, usd: 1.1, xaf: 655.957, gbp: 0.84 } });
    expect(ev('DEVISE(100,"EUR","XAF")') as number).toBeCloseTo(65595.7, 3);
    expect(ev('CURRENCY(110,"usd","EUR")') as number).toBeCloseTo(100, 9);
    expect(ev('DEVISE(84,"GBP","USD")') as number).toBeCloseTo(110, 9);
    expect(ev('DEVISE(1,"EUR","ZZZ")')).toEqual({ error: '#VALUE!' });
    expect(ev('DEVISE("a","EUR","USD")')).toEqual({ error: '#VALUE!' });
  });

  it('uses the rates of a past day when a date is given', () => {
    setRatesForTest({ date: '2024-03-06', eur: { eur: 1, usd: 1.09 } }, '2024-03-06');
    expect(ev('DEVISE(100,"EUR","USD","2024-03-06")') as number).toBeCloseTo(109, 9);
    expect(ev('DEVISE(100,"EUR","USD",DATE(2024,3,6))') as number).toBeCloseTo(109, 9);
  });
});
