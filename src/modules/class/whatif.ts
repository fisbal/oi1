// What-if analysis for Office Class, like Excel's Data › What-If Analysis and Solver, and Data Validation:
// - Goal Seek: the value of one cell that makes a formula reach a target.
// - Scenarios: named sets of values for some cells, shown in turn, compared in a summary sheet.
// - Solver: the best values of several cells (maximum, minimum or a target) under constraints, with whole-number
//   and yes/no (0/1) cells. Linear models are solved exactly (simplex, branch and bound for whole numbers); others
//   by a careful search (Nelder–Mead with penalties, several starts).
// - Validation: rules on what a cell accepts (whole number, decimal, list, date, length, formula), with its message.
// Everything here is pure: it takes a workbook and gives numbers, so it is tested on its own.

import { cellName, isError, moveRefs, parseCell, type Scalar } from '../../formats/formula';
import { computeBook, key, literal, readEntry, unkey, type Merge, type Scenario, type SheetData, type SolverSaved, type Validation, type VOp, type WorkbookData } from '../../formats/sheet';
export type { Scenario, Validation, VKind, VOp } from '../../formats/sheet';

// ---------- references typed in a dialog ----------

/** "B5", "$B$5", "B2:D6" → a box on the sheet; null when it is not a reference. */
export function parseRange(text: string): Merge | null {
  const s = text.trim().replace(/^=/, '').replace(/^.*!/, '');
  const [a, b] = s.split(':');
  const p = parseCell(a ?? ''), q = b ? parseCell(b) : p;
  if (!p || !q) return null;
  return { c1: Math.min(p.c, q.c), r1: Math.min(p.r, q.r), c2: Math.max(p.c, q.c), r2: Math.max(p.r, q.r) };
}
export const rangeName = (m: Merge) => (m.c1 === m.c2 && m.r1 === m.r2 ? cellName(m.c1, m.r1) : `${cellName(m.c1, m.r1)}:${cellName(m.c2, m.r2)}`);
/** Every cell key of a box, row by row. */
export function keysOf(m: Merge): string[] {
  const out: string[] = [];
  for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) out.push(key(c, r));
  return out;
}
/** Several references separated by commas or semicolons: "B2:B4, D2". */
export function parseRefs(text: string): string[] | null {
  const parts = text.split(/[;,]/).map(x => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  const out: string[] = [];
  for (const p of parts) { const m = parseRange(p); if (!m) return null; out.push(...keysOf(m)); }
  return [...new Set(out)];
}

/** A number as a cell's input, without float noise (0.1 + 0.2 shows 0.3). */
export const numText = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12))));
const num = (v: Scalar | undefined) => (typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : NaN);

// ---------- the model: the workbook as a function of some cells ----------

export interface Model {
  /** Values of the sheet with these cells set (by key) to these numbers. */
  run(x: number[]): Map<string, Scalar>;
  vars: string[];
  start: number[];
}

export function model(book: WorkbookData, sheet: number, vars: string[]): Model {
  const base = computeBook(book)[sheet];
  return {
    vars,
    start: vars.map(k => { const v = num(base.get(k)); return isNaN(v) ? 0 : v; }),
    run(x) {
      const s = book.sheets[sheet];
      const cells = { ...s.cells };
      vars.forEach((k, i) => { cells[k] = { ...cells[k], input: numText(x[i]) }; });
      const next = { ...book, sheets: book.sheets.map((o, i) => (i === sheet ? { ...s, cells } : o)) };
      return computeBook(next)[sheet];
    },
  };
}

/** Writes numbers into cells, keeping their style: what Goal Seek, Solver and a scenario do when kept. */
export function withValues(s: SheetData, entries: [string, string][]): SheetData {
  const cells = { ...s.cells };
  for (const [k, v] of entries) cells[k] = { ...cells[k], input: v };
  return { ...s, cells };
}

// ---------- Goal Seek ----------

export interface SeekResult { ok: boolean; x: number; value: number; steps: number }

/** The value of `changing` that brings `target` (a formula cell) to `goal`. */
export function goalSeek(book: WorkbookData, sheet: number, target: string, goal: number, changing: string, maxSteps = 100, tol = 0.001): SeekResult {
  const m = model(book, sheet, [changing]);
  const f = (x: number) => num(m.run([x]).get(target)) - goal;
  let steps = 0;
  let x0 = m.start[0];
  let f0 = f(x0);
  if (isNaN(f0)) return { ok: false, x: x0, value: NaN, steps };
  if (Math.abs(f0) <= tol) return { ok: true, x: x0, value: f0 + goal, steps };
  // Secant steps from the current value, like Excel.
  let x1 = x0 === 0 ? 1 : x0 * 1.01;
  let f1 = f(x1);
  const done = (x: number, fx: number) => ({ ok: Math.abs(fx) <= tol, x, value: fx + goal, steps });
  while (steps++ < maxSteps && !isNaN(f1)) {
    if (Math.abs(f1) <= tol) return done(x1, f1);
    if (Math.sign(f0) !== Math.sign(f1)) return bisect(x0, f0, x1, f1);
    const d = f1 - f0;
    let x2 = d === 0 ? x1 + (x1 - x0 || 1) * 2 : x1 - f1 * (x1 - x0) / d;
    if (!isFinite(x2)) x2 = x1 * 2 || 1;
    // Never jump absurdly far in one step.
    const span = Math.max(1, Math.abs(x1) * 1e3);
    x2 = Math.max(x1 - span, Math.min(x1 + span, x2));
    x0 = x1; f0 = f1; x1 = x2; f1 = f(x1);
  }
  // No sign change found by secant: widen around the start until there is one.
  const s0 = m.start[0];
  const fs = f(s0);
  for (let w = 1; w < 1e12 && steps < maxSteps * 4; w *= 4, steps++) {
    for (const x of [s0 + w, s0 - w]) {
      const fx = f(x);
      if (!isNaN(fx) && Math.sign(fx) !== Math.sign(fs)) return bisect(s0, fs, x, fx);
    }
  }
  return done(x1, isNaN(f1) ? f0 : f1);

  function bisect(a: number, fa: number, b: number, fb: number): SeekResult {
    for (let i = 0; i < 200; i++, steps++) {
      // Regula falsi with a bisection guard: fast, and it never leaves the bracket.
      let mid = (a * fb - b * fa) / (fb - fa);
      if (!isFinite(mid) || mid <= Math.min(a, b) || mid >= Math.max(a, b) || i % 3 === 2) mid = (a + b) / 2;
      const fm = f(mid);
      if (isNaN(fm)) return { ok: false, x: mid, value: NaN, steps };
      if (Math.abs(fm) <= tol || Math.abs(b - a) < 1e-12) return { ok: Math.abs(fm) <= tol, x: mid, value: fm + goal, steps };
      if (Math.sign(fm) === Math.sign(fa)) { a = mid; fa = fm; } else { b = mid; fb = fm; }
    }
    return { ok: false, x: (a + b) / 2, value: f((a + b) / 2) + goal, steps };
  }
}

// ---------- Scenarios ----------


/** The summary Excel makes: changing cells and result cells, current values and each scenario's. */
export function scenarioSummary(book: WorkbookData, sheet: number, scenarios: Scenario[], results: string[], labels: { title: string; changing: string; result: string; current: string }): SheetData {
  const s = book.sheets[sheet];
  const allCells = [...new Set(scenarios.flatMap(x => x.cells))];
  const now = computeBook(book)[sheet];
  const outs = scenarios.map(sc => {
    const next = withValues(s, sc.cells.map((k, i) => [k, sc.values[i]] as [string, string]));
    return computeBook({ ...book, sheets: book.sheets.map((o, i) => (i === sheet ? next : o)) })[sheet];
  });
  const rows: string[][] = [[labels.title], [], ['', labels.current, ...scenarios.map(x => x.name)], [labels.changing]];
  const show = (v: Scalar | undefined) => (v === undefined ? '' : isError(v) ? v.error : typeof v === 'number' ? numText(v) : String(v));
  for (const k of allCells) {
    const { c, r } = unkey(k);
    rows.push([cellName(c, r), show(now.get(k)), ...scenarios.map(sc => { const i = sc.cells.indexOf(k); return i >= 0 ? sc.values[i] : show(now.get(k)); })]);
  }
  rows.push([labels.result]);
  for (const k of results) {
    const { c, r } = unkey(k);
    rows.push([cellName(c, r), show(now.get(k)), ...outs.map(o => show(o.get(k)))]);
  }
  const cells: SheetData['cells'] = {};
  rows.forEach((row, r) => row.forEach((v, c) => { if (v !== '') cells[key(c, r)] = { input: v, ...(r === 0 || r === 2 || row.length === 1 ? { style: { bold: true } } : {}) }; }));
  return { name: '', cells, widths: { 0: 150, 1: 120, ...Object.fromEntries(scenarios.map((_, i) => [i + 2, 120])) } };
}

// ---------- Solver ----------

export type Op = '<=' | '>=' | '=' | 'int' | 'bin';
export interface Constraint { left: string; op: Op; right: string }
export type SolverModel = SolverSaved;
export interface SolverResult {
  status: 'optimal' | 'feasible' | 'infeasible' | 'unbounded' | 'error';
  method: 'simplex' | 'search';
  x: number[];
  vars: string[];
  objective: number;
  message?: string;
}

interface Row { cells: string[]; op: '<=' | '>=' | '='; rhs: (vals: Map<string, Scalar>, i: number) => number }

/** The constraints as rows "cell op value", each right side a number, one cell, or a box the same size. */
function rowsOf(cons: Constraint[]): { rows: Row[]; ints: Set<string>; bins: Set<string> } | string {
  const rows: Row[] = [];
  const ints = new Set<string>(), bins = new Set<string>();
  for (const k of cons) {
    const left = parseRefs(k.left);
    if (!left) return k.left;
    if (k.op === 'int') { left.forEach(x => ints.add(x)); continue; }
    if (k.op === 'bin') { left.forEach(x => bins.add(x)); continue; }
    const n = Number(k.right.trim().replace(',', '.'));
    if (k.right.trim() !== '' && !isNaN(n)) { rows.push({ cells: left, op: k.op, rhs: () => n }); continue; }
    const right = parseRefs(k.right);
    if (!right || (right.length !== 1 && right.length !== left.length)) return k.right;
    rows.push({ cells: left, op: k.op, rhs: (vals, i) => num(vals.get(right[right.length === 1 ? 0 : i])) });
  }
  return { rows, ints, bins };
}

export function solve(book: WorkbookData, sheet: number, sm: SolverModel): SolverResult {
  const vars = parseRefs(sm.vars) ?? [];
  const objCell = parseRange(sm.objective);
  const fail = (message: string): SolverResult => ({ status: 'error', method: 'search', x: [], vars, objective: NaN, message });
  if (!vars.length) return fail('vars');
  if (!objCell) return fail('objective');
  const obj = key(objCell.c1, objCell.r1);
  const parsed = rowsOf(sm.constraints);
  if (typeof parsed === 'string') return fail(parsed);
  const { rows, ints, bins } = parsed;
  const m = model(book, sheet, vars);
  const n = vars.length;
  const isInt = vars.map(v => ints.has(v) || bins.has(v));

  // Every constraint as g(x) ≤ 0 / = 0, read from the sheet.
  type Lin = { a: number[]; b: number; op: '<=' | '>=' | '=' };
  const measure = (vals: Map<string, Scalar>) => {
    const out: { v: number; op: '<=' | '>=' | '=' }[] = [];
    for (const r of rows) r.cells.forEach((c, i) => out.push({ v: num(vals.get(c)) - r.rhs(vals, i), op: r.op }));
    return out;
  };
  const objOf = (vals: Map<string, Scalar>) => num(vals.get(obj));

  // Is it linear? Compare the sheet with a linear model built from one step per cell, at two other points.
  const x0 = m.start.map(v => (isFinite(v) ? v : 0));
  const v0 = m.run(x0);
  const f0 = objOf(v0), g0 = measure(v0);
  if (isNaN(f0)) return fail('objective');
  const df: number[] = [], dg: number[][] = g0.map(() => []);
  for (let j = 0; j < n; j++) {
    const x = [...x0]; x[j] += 1;
    const vj = m.run(x);
    df.push(objOf(vj) - f0);
    measure(vj).forEach((g, i) => dg[i].push(g.v - g0[i].v));
  }
  const predictF = (x: number[]) => f0 + x.reduce((s, xi, j) => s + (xi - x0[j]) * df[j], 0);
  const predictG = (x: number[], i: number) => g0[i].v + x.reduce((s, xi, j) => s + (xi - x0[j]) * dg[i][j], 0);
  let linear = df.every(isFinite) && dg.every(r => r.every(isFinite));
  for (const probe of [x0.map((v, j) => v + 2.5 + j * 0.7), x0.map((v, j) => v - 1.3 - j * 0.4)]) {
    if (!linear) break;
    const vp = m.run(probe);
    const fp = objOf(vp);
    const close = (a: number, b: number) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));
    if (!close(fp, predictF(probe))) linear = false;
    measure(vp).forEach((g, i) => { if (!close(g.v, predictG(probe, i))) linear = false; });
  }

  if (linear) {
    // c·x to maximise; constraint rows a·x op b.
    const sign = sm.goal === 'min' ? -1 : 1;
    const lins: Lin[] = g0.map((g, i) => {
      const a = dg[i];
      const b = -(g.v - a.reduce((s, aj, j) => s + aj * x0[j], 0));
      return { a, b, op: g.op };
    });
    if (sm.goal === 'value') {
      const a = df, b = (sm.target ?? 0) - (f0 - df.reduce((s, d, j) => s + d * x0[j], 0));
      lins.push({ a, b, op: '=' });
    }
    bins.forEach(bv => { const j = vars.indexOf(bv); if (j >= 0) lins.push({ a: unit(n, j), b: 1, op: '<=' }); });
    const c = sm.goal === 'value' ? new Array(n).fill(0) : df.map(d => d * sign);
    const r = branchAndBound(c, lins, n, isInt, sm.nonNegative || bins.size > 0 ? vars.map(v => sm.nonNegative || bins.has(v)) : vars.map(() => false));
    if (r.status !== 'optimal') return { status: r.status, method: 'simplex', x: x0, vars, objective: f0 };
    const x = r.x.map((v, j) => (isInt[j] ? Math.round(v) : clean(v)));
    return { status: 'optimal', method: 'simplex', x, vars, objective: objOf(m.run(x)) };
  }

  // Non-linear: penalties and Nelder–Mead from several starts, then whole numbers by rounding and a local search.
  const score = (x: number[], weight: number) => {
    const xs = x.map((v, j) => (bins.has(vars[j]) ? Math.min(1, Math.max(0, v)) : v));
    const vals = m.run(xs);
    const f = objOf(vals);
    if (!isFinite(f)) return 1e30;
    let pen = 0;
    for (const g of measure(vals)) {
      if (!isFinite(g.v)) { pen += 1e6; continue; }
      const over = g.op === '<=' ? Math.max(0, g.v) : g.op === '>=' ? Math.max(0, -g.v) : Math.abs(g.v);
      pen += over * over;
    }
    if (sm.nonNegative) xs.forEach(v => { if (v < 0) pen += v * v; });
    const base = sm.goal === 'max' ? -f : sm.goal === 'min' ? f : (f - (sm.target ?? 0)) ** 2;
    return base + weight * pen;
  };
  const feasible = (x: number[]) => {
    const vals = m.run(x);
    if (sm.nonNegative && x.some(v => v < -1e-6)) return false;
    return measure(vals).every(g => (g.op === '<=' ? g.v <= 1e-6 * Math.max(1, Math.abs(g.v)) : g.op === '>=' ? g.v >= -1e-6 : Math.abs(g.v) <= 1e-5)) && (sm.goal !== 'value' || Math.abs(objOf(vals) - (sm.target ?? 0)) <= 1e-4);
  };
  let best = x0, bestScore = Infinity;
  const starts = [x0, x0.map(v => v + 1), x0.map(v => (v || 1) * 2), x0.map(() => 0)];
  for (const s of starts) {
    let x = s;
    for (const w of [1e2, 1e4, 1e7]) x = nelderMead(p => score(p, w), x, 1500);
    const sc = score(x, 1e7);
    if (sc < bestScore) { best = x; bestScore = sc; }
  }
  if (isInt.some(Boolean)) best = intSearch(best, isInt, p => score(p, 1e7));
  best = best.map((v, j) => (bins.has(vars[j]) ? Math.round(Math.min(1, Math.max(0, v))) : isInt[j] ? Math.round(v) : clean(v)));
  const ok = feasible(best);
  return { status: ok ? 'feasible' : 'infeasible', method: 'search', x: best, vars, objective: objOf(m.run(best)) };
}

const unit = (n: number, j: number) => Array.from({ length: n }, (_, i) => (i === j ? 1 : 0));
const clean = (v: number) => { const r = Math.round(v); return Math.abs(v - r) < 1e-9 ? r : Number(v.toPrecision(12)); };

// ---------- linear programming ----------

interface LpResult { status: 'optimal' | 'infeasible' | 'unbounded'; x: number[]; z: number }

/**
 * Maximises c·x under rows a·x (≤, ≥, =) b. `nonneg[j]` keeps x_j ≥ 0; other variables are free (split in two).
 * Two-phase simplex on a dense tableau with Bland's rule, so it never cycles.
 */
export function simplex(c: number[], rows: { a: number[]; b: number; op: '<=' | '>=' | '=' }[], n: number, nonneg: boolean[]): LpResult {
  // Free variables: x = p - q with p, q ≥ 0.
  const cols: { j: number; s: 1 | -1 }[] = [];
  for (let j = 0; j < n; j++) { cols.push({ j, s: 1 }); if (!nonneg[j]) cols.push({ j, s: -1 }); }
  const nv = cols.length;
  const m = rows.length;
  const rs = rows.map(r => {
    let a = cols.map(cl => r.a[cl.j] * cl.s), b = r.b, op = r.op;
    if (b < 0) { a = a.map(v => -v); b = -b; op = op === '<=' ? '>=' : op === '>=' ? '<=' : '='; }
    return { a, b, op };
  });
  const nSlack = rs.filter(r => r.op !== '=').length;
  const nArt = rs.filter(r => r.op !== '<=').length;
  const width = nv + nSlack + nArt + 1;
  const T: number[][] = [];
  const basis: number[] = [];
  let si = nv, ai = nv + nSlack;
  const artCols = new Set<number>();
  for (const r of rs) {
    const row = new Array(width).fill(0);
    r.a.forEach((v, j) => { row[j] = v; });
    row[width - 1] = r.b;
    if (r.op === '<=') { row[si] = 1; basis.push(si++); }
    else if (r.op === '>=') { row[si++] = -1; row[ai] = 1; artCols.add(ai); basis.push(ai++); }
    else { row[ai] = 1; artCols.add(ai); basis.push(ai++); }
    T.push(row);
  }
  const EPS = 1e-9;
  const pivot = (obj: number[], pr: number, pc: number) => {
    const p = T[pr][pc];
    for (let k = 0; k < width; k++) T[pr][k] /= p;
    for (let i = 0; i < m; i++) if (i !== pr && Math.abs(T[i][pc]) > EPS) { const f = T[i][pc]; for (let k = 0; k < width; k++) T[i][k] -= f * T[pr][k]; }
    if (Math.abs(obj[pc]) > EPS) { const f = obj[pc]; for (let k = 0; k < width; k++) obj[k] -= f * T[pr][k]; }
    basis[pr] = pc;
  };
  const run = (obj: number[], allowed: (k: number) => boolean): 'ok' | 'unbounded' => {
    for (let it = 0; it < 5000; it++) {
      let pc = -1;
      for (let k = 0; k < width - 1; k++) if (allowed(k) && obj[k] < -EPS) { pc = k; break; }
      if (pc < 0) return 'ok';
      let pr = -1, best = Infinity;
      for (let i = 0; i < m; i++) if (T[i][pc] > EPS) {
        const ratio = T[i][width - 1] / T[i][pc];
        if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[i] < basis[pr])) { best = ratio; pr = i; }
      }
      if (pr < 0) return 'unbounded';
      pivot(obj, pr, pc);
    }
    return 'ok';
  };
  // Phase 1: no artificial left.
  if (nArt) {
    const obj = new Array(width).fill(0);
    artCols.forEach(k => { obj[k] = 1; });
    T.forEach((row, i) => { if (artCols.has(basis[i])) for (let k = 0; k < width; k++) obj[k] -= row[k]; });
    run(obj, () => true);
    if (obj[width - 1] < -1e-7) return { status: 'infeasible', x: [], z: NaN };
    // Artificials still in the basis at zero: swap them out where possible.
    for (let i = 0; i < m; i++) if (artCols.has(basis[i])) {
      const k = T[i].findIndex((v, kk) => kk < width - 1 && !artCols.has(kk) && Math.abs(v) > EPS);
      if (k >= 0) pivot(new Array(width).fill(0), i, k);
    }
  }
  // Phase 2.
  const obj = new Array(width).fill(0);
  cols.forEach((cl, k) => { obj[k] = -c[cl.j] * cl.s; });
  T.forEach((row, i) => { const f = obj[basis[i]]; if (Math.abs(f) > EPS) for (let k = 0; k < width; k++) obj[k] -= f * row[k]; });
  if (run(obj, k => !artCols.has(k)) === 'unbounded') return { status: 'unbounded', x: [], z: NaN };
  const x = new Array(n).fill(0);
  T.forEach((row, i) => { if (basis[i] < nv) { const cl = cols[basis[i]]; x[cl.j] += cl.s * row[width - 1]; } });
  return { status: 'optimal', x, z: obj[width - 1] };
}

/** Simplex with branch and bound for whole-number variables. */
export function branchAndBound(c: number[], rows: { a: number[]; b: number; op: '<=' | '>=' | '=' }[], n: number, isInt: boolean[], nonneg: boolean[]): LpResult {
  let best: LpResult | null = null;
  let nodes = 0;
  let unbounded = false;
  const visit = (extra: { a: number[]; b: number; op: '<=' | '>=' | '=' }[], depth: number) => {
    if (nodes++ > 2000 || depth > 60) return;
    const r = simplex(c, [...rows, ...extra], n, nonneg);
    if (r.status === 'unbounded') { unbounded = true; return; }
    if (r.status !== 'optimal') return;
    const value = c.reduce((s, cj, j) => s + cj * r.x[j], 0);
    if (best && value <= c.reduce((s, cj, j) => s + cj * best!.x[j], 0) + 1e-9) return;
    const j = r.x.findIndex((v, k) => isInt[k] && Math.abs(v - Math.round(v)) > 1e-7);
    if (j < 0) { best = r; return; }
    const lo = Math.floor(r.x[j]);
    // The nearer side first: good answers early prune more.
    const down = { a: unit(n, j), b: lo, op: '<=' as const }, up = { a: unit(n, j), b: lo + 1, op: '>=' as const };
    const order = r.x[j] - lo < 0.5 ? [down, up] : [up, down];
    for (const o of order) visit([...extra, o], depth + 1);
  };
  visit([], 0);
  if (best) return best;
  return { status: unbounded ? 'unbounded' : 'infeasible', x: [], z: NaN };
}

// ---------- non-linear search ----------

export function nelderMead(f: (x: number[]) => number, start: number[], maxIter = 1000): number[] {
  const n = start.length;
  let pts = [start, ...start.map((_, j) => start.map((v, k) => (k === j ? v + (Math.abs(v) > 1 ? v * 0.1 : 0.5) : v)))];
  let vals = pts.map(f);
  for (let it = 0; it < maxIter; it++) {
    const order = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
    pts = order.map(i => pts[i]); vals = order.map(i => vals[i]);
    if (Math.abs(vals[n] - vals[0]) <= 1e-12 * (1 + Math.abs(vals[0])) && it > 20) break;
    const mid = start.map((_, k) => pts.slice(0, n).reduce((s, p) => s + p[k], 0) / n);
    const at = (t: number) => mid.map((v, k) => v + t * (pts[n][k] - v));
    const xr = at(-1), fr = f(xr);
    if (fr < vals[0]) {
      const xe = at(-2), fe = f(xe);
      if (fe < fr) { pts[n] = xe; vals[n] = fe; } else { pts[n] = xr; vals[n] = fr; }
    } else if (fr < vals[n - 1]) { pts[n] = xr; vals[n] = fr; }
    else {
      const xc = fr < vals[n] ? at(-0.5) : at(0.5), fc = f(xc);
      if (fc < Math.min(fr, vals[n])) { pts[n] = xc; vals[n] = fc; }
      else for (let i = 1; i <= n; i++) { pts[i] = pts[i].map((v, k) => pts[0][k] + 0.5 * (v - pts[0][k])); vals[i] = f(pts[i]); }
    }
  }
  return pts[vals.indexOf(Math.min(...vals))];
}

/** Whole numbers: round, then move one variable by ±1 while it helps. */
function intSearch(x: number[], isInt: boolean[], f: (x: number[]) => number): number[] {
  let cur = x.map((v, j) => (isInt[j] ? Math.round(v) : v));
  let fc = f(cur);
  for (let pass = 0; pass < 200; pass++) {
    let moved = false;
    for (let j = 0; j < cur.length; j++) {
      if (!isInt[j]) continue;
      for (const d of [1, -1]) {
        const t = [...cur]; t[j] += d;
        const ft = f(t);
        if (ft < fc - 1e-12) { cur = t; fc = ft; moved = true; }
      }
    }
    if (!moved) break;
  }
  return cur;
}

// ---------- Data validation ----------

export const validationAt = (list: Validation[] | undefined, c: number, r: number) =>
  list?.find(v => c >= v.range.c1 && c <= v.range.c2 && r >= v.range.r1 && r <= v.range.r2);

/** The choices of a list rule, read from the sheet when it names a range. */
export function listChoices(v: Validation, values: Map<string, Scalar>): string[] {
  const src = (v.list ?? '').trim();
  if (src.startsWith('=')) {
    const m = parseRange(src);
    if (!m) return [];
    return keysOf(m).map(k => values.get(k)).filter(x => x !== undefined && x !== '').map(x => (isError(x!) ? x!.error : typeof x === 'number' ? numText(x) : String(x)));
  }
  return src.split(/[;,]/).map(x => x.trim()).filter(Boolean);
}

/** A bound typed in the rule: a number, a date, a time, or a cell. */
function bound(text: string | undefined, values: Map<string, Scalar>): number {
  const s = (text ?? '').trim();
  if (!s) return NaN;
  const ref = s.replace(/^=/, '');
  const p = parseCell(ref);
  if (p) return num(values.get(key(p.c, p.r)));
  const tm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (tm) return (Number(tm[1]) * 3600 + Number(tm[2]) * 60 + Number(tm[3] ?? 0)) / 86400;
  return num(literal(readEntry(s).input));
}

function compare(x: number, op: VOp, a: number, b: number): boolean {
  if (isNaN(x)) return false;
  switch (op) {
    case 'between': return x >= Math.min(a, b) && x <= Math.max(a, b);
    case 'notBetween': return x < Math.min(a, b) || x > Math.max(a, b);
    case 'eq': return x === a;
    case 'ne': return x !== a;
    case 'gt': return x > a;
    case 'lt': return x < a;
    case 'ge': return x >= a;
    case 'le': return x <= a;
  }
}

/**
 * Whether a cell's value obeys its rule. `value` is the cell's computed value, `input` what was typed, `book`
 * and `sheet` are used for a custom formula (worked out as if it were in the cell).
 */
export function isValid(v: Validation, value: Scalar | undefined, input: string, values: Map<string, Scalar>, custom?: () => Scalar): boolean {
  const blank = input.trim() === '' && (value === undefined || value === '');
  if (blank) return v.ignoreBlank;
  if (value !== undefined && isError(value)) return false;
  const a = bound(v.a, values), b = bound(v.b, values);
  switch (v.kind) {
    case 'any': return true;
    case 'whole': { const x = num(value); return Number.isInteger(x) && compare(x, v.op, a, b); }
    case 'decimal': return compare(num(value), v.op, a, b);
    case 'date': case 'time': return compare(num(value), v.op, a, b);
    case 'length': return compare(String(typeof value === 'number' ? input.trim() : value ?? '').length, v.op, a, b);
    case 'list': {
      const shown = typeof value === 'number' ? numText(value) : String(value ?? input);
      return listChoices(v, values).some(x => x.toLowerCase() === shown.toLowerCase() || x === input.trim());
    }
    case 'custom': { const r = custom?.(); return r === true || (typeof r === 'number' && r !== 0); }
  }
}

/** The custom rule's formula as it reads for one cell of its range (relative references move, like Excel). */
export function formulaFor(v: Validation, c: number, r: number): string {
  const f = v.a.trim().startsWith('=') ? v.a.trim() : `=${v.a.trim()}`;
  const dc = c - v.range.c1, dr = r - v.range.r1;
  return moveRefs(f, (cc, rr, absC, absR) => ({ c: absC ? cc : cc + dc, r: absR ? rr : rr + dr }));
}

/** Works a custom rule out for one cell: the formula put in a spare cell of a copy of the workbook. */
export function customValue(book: WorkbookData, sheet: number, v: Validation, c: number, r: number, input?: string): Scalar {
  const s = book.sheets[sheet];
  const spare = key(16000, 1048000);
  const cells = { ...s.cells, [spare]: { input: formulaFor(v, c, r) } };
  if (input !== undefined) cells[key(c, r)] = { ...cells[key(c, r)], input };
  return computeBook({ ...book, sheets: book.sheets.map((o, i) => (i === sheet ? { ...s, cells } : o)) })[sheet].get(spare) ?? '';
}

/** Cells that break their rule, for "Circle invalid data". */
export function invalidCells(book: WorkbookData, sheet: number, values: Map<string, Scalar>): string[] {
  const s = book.sheets[sheet];
  const out: string[] = [];
  for (const v of s.validations ?? []) {
    if (v.kind === 'any') continue;
    for (const k of keysOf(v.range)) {
      const input = s.cells[k]?.input ?? '';
      if (!input) continue;
      const { c, r } = unkey(k);
      if (!isValid(v, values.get(k), input, values, () => customValue(book, sheet, v, c, r))) out.push(k);
    }
  }
  return out;
}
