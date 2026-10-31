// The rest of Excel's functions (Martin, 2026-10-31: "le nôtre ne rivalise pas Excel en outils"): finance (IRR,
// XIRR, RATE, NPER, IPMT, PPMT, SLN, DB, DDB…), statistics (CORREL, FORECAST, NORM.DIST, PERCENTILE…), engineering,
// dates and text, from Formula.js (MIT, https://github.com/jspreadsheet/formulajs). Our own engine keeps the
// functions it already has; Formula.js only fills the names it does not know.

import * as F from '@formulajs/formulajs';
import type { FormulaError, Scalar } from './formula';
import CATS from './functionCats.json';

type Value = Scalar | Scalar[][];
type Fn = (args: Value[]) => Value;

const CODES: FormulaError['error'][] = ['#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#N/A', '#NUM!'];
const isErr = (v: unknown): v is FormulaError => typeof v === 'object' && v !== null && 'error' in v;

/** Days since 1899-12-30, read from the date's calendar day (Formula.js makes dates at local midnight). */
const serial = (d: Date) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000
  + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;

const toError = (e: Error): FormulaError => {
  const code = CODES.find(c => c === e.message);
  return { error: code ?? (e.message === '#NULL!' ? '#VALUE!' : '#VALUE!') };
};

function fromJs(v: unknown): Value {
  if (v instanceof Error) return toError(v);
  if (v instanceof Date) return isNaN(v.getTime()) ? { error: '#VALUE!' } : serial(v);
  if (typeof v === 'number') return isFinite(v) ? v : { error: '#NUM!' };
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (v === null || v === undefined) return 0;
  if (Array.isArray(v)) {
    const rows = (Array.isArray(v[0]) ? v : [v]) as unknown[][];
    return rows.map(r => r.map(x => { const s = fromJs(x); return Array.isArray(s) ? s[0][0] : s; }));
  }
  return { error: '#VALUE!' };
}

/** Our values the way Formula.js reads them: errors as Error, empty cells in ranges as null. */
function toJs(v: Value): unknown {
  if (Array.isArray(v)) return v.map(r => r.map(x => (isErr(x) ? new Error(x.error) : x === '' ? null : x)));
  if (isErr(v)) return new Error(v.error);
  return v;
}

function wrap(f: (...a: unknown[]) => unknown): Fn {
  return args => {
    try { return fromJs(f(...args.map(toJs))); } catch { return { error: '#VALUE!' }; }
  };
}

/** Every Formula.js function by its Excel name: SLN, IRR, and the dotted ones (NORM.DIST, PERCENTILE.INC…). */
export function moreFunctions(): Record<string, Fn> {
  const out: Record<string, Fn> = {};
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(k)) continue;
      const name = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'function') out[name] = wrap(v as (...a: unknown[]) => unknown);
      if (v && (typeof v === 'object' || typeof v === 'function')) walk(v as Record<string, unknown>, name);
    }
  };
  walk(F as unknown as Record<string, unknown>, '');
  // Only Excel's real names (Formula.js documents each one); walking its objects also meets inner helpers.
  const known = new Set([...Object.keys(CATS), 'ERROR.TYPE']);
  return Object.fromEntries(Object.entries(out).filter(([k]) => known.has(k)));
}
