// Spreadsheet formulas, written for OI1 (no GPL engine): =SUM(A1:B3)*2, =IF(A1>10,"big","small"), …
// Shared by Office Class and anything else that reads sheets. Cells are addressed by column and row from 0.

export type Scalar = number | string | boolean | FormulaError;
export interface FormulaError { error: '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#N/A' | '#NUM!' | '#CYCLE!' }
type Value = Scalar | Scalar[][];

export const isError = (v: unknown): v is FormulaError => typeof v === 'object' && v !== null && 'error' in v;
const err = (e: FormulaError['error']): FormulaError => ({ error: e });

// ---------- cell names ----------

export function colName(c: number): string {
  let s = '';
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}
export const cellName = (c: number, r: number) => `${colName(c)}${r + 1}`;
export function parseCell(name: string): { c: number; r: number } | null {
  const m = name.trim().toUpperCase().match(/^\$?([A-Z]{1,3})\$?(\d+)$/);
  return m ? { c: colIndex(m[1]), r: Number(m[2]) - 1 } : null;
}

// ---------- tokens ----------

type Tok =
  | { t: 'num'; v: number; s: number; e: number }
  | { t: 'str'; v: string; s: number; e: number }
  | { t: 'ref'; c: number; r: number; absC: boolean; absR: boolean; s: number; e: number }
  | { t: 'name'; v: string; s: number; e: number }
  | { t: 'op'; v: string; s: number; e: number };

const REF = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/;

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/))) {
      out.push({ t: 'num', v: parseFloat(m[0]), s: i, e: i + m[0].length });
    } else if (ch === '"') {
      let j = i + 1, v = '';
      while (j < src.length) {
        if (src[j] === '"') { if (src[j + 1] === '"') { v += '"'; j += 2; continue; } break; }
        v += src[j++];
      }
      out.push({ t: 'str', v, s: i, e: j + 1 });
      m = [src.slice(i, j + 1)];
    } else if ((m = rest.match(REF))) {
      out.push({ t: 'ref', c: colIndex(m[2]), r: Number(m[4]) - 1, absC: !!m[1], absR: !!m[3], s: i, e: i + m[0].length });
    } else if ((m = rest.match(/^[A-Za-z_][A-Za-z0-9_.]*/))) {
      out.push({ t: 'name', v: m[0].toUpperCase(), s: i, e: i + m[0].length });
    } else if ((m = rest.match(/^(<=|>=|<>|[-+*/^&=<>(),:;%])/))) {
      out.push({ t: 'op', v: m[0] === ';' ? ',' : m[0], s: i, e: i + m[0].length });
    } else throw new Error('#NAME?');
    i += m[0].length;
  }
  return out;
}

// ---------- parser ----------

type Node =
  | { k: 'lit'; v: Scalar }
  | { k: 'ref'; c: number; r: number }
  | { k: 'range'; c1: number; r1: number; c2: number; r2: number }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; name: string; args: Node[] };

function parse(src: string): Node {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;
  const take = (v: string) => { if (!isOp(v)) throw new Error('#VALUE!'); i++; };

  const levels: string[][] = [['=', '<>', '<', '>', '<=', '>='], ['&'], ['+', '-'], ['*', '/'], ['^']];
  const binary = (level: number): Node => {
    if (level === levels.length) return unary();
    let a = binary(level + 1);
    while (peek()?.t === 'op' && levels[level].includes((peek() as { v: string }).v)) {
      const op = (toks[i++] as { v: string }).v;
      a = { k: 'bin', op, a, b: binary(level + 1) };
    }
    return a;
  };
  const unary = (): Node => {
    if (isOp('-') || isOp('+')) { const op = (toks[i++] as { v: string }).v; return { k: 'un', op, a: unary() }; }
    let n = primary();
    while (isOp('%')) { i++; n = { k: 'bin', op: '/', a: n, b: { k: 'lit', v: 100 } }; }
    return n;
  };
  const primary = (): Node => {
    const tk = toks[i++];
    if (!tk) throw new Error('#VALUE!');
    if (tk.t === 'num') return { k: 'lit', v: tk.v };
    if (tk.t === 'str') return { k: 'lit', v: tk.v };
    if (tk.t === 'ref') {
      if (isOp(':') && toks[i + 1]?.t === 'ref') {
        i++;
        const b = toks[i++] as Extract<Tok, { t: 'ref' }>;
        return { k: 'range', c1: Math.min(tk.c, b.c), r1: Math.min(tk.r, b.r), c2: Math.max(tk.c, b.c), r2: Math.max(tk.r, b.r) };
      }
      return { k: 'ref', c: tk.c, r: tk.r };
    }
    if (tk.t === 'name') {
      if (isOp('(')) {
        i++;
        const args: Node[] = [];
        if (!isOp(')')) {
          for (;;) {
            args.push(isOp(',') || isOp(')') ? { k: 'lit', v: '' } : binary(0));
            if (isOp(',')) { i++; continue; }
            break;
          }
        }
        take(')');
        return { k: 'call', name: tk.v, args };
      }
      if (tk.v === 'TRUE' || tk.v === 'FALSE') return { k: 'lit', v: tk.v === 'TRUE' };
      throw new Error('#NAME?');
    }
    if (tk.v === '(') { const n = binary(0); take(')'); return n; }
    throw new Error('#VALUE!');
  };
  const node = binary(0);
  if (i < toks.length) throw new Error('#VALUE!');
  return node;
}

// ---------- evaluation ----------

export type Getter = (c: number, r: number) => Scalar;

const toNum = (v: Scalar): number | FormulaError => {
  if (isError(v)) return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v.trim() === '') return 0;
  const n = Number(v.replace(',', '.'));
  return isNaN(n) ? err('#VALUE!') : n;
};
const toStr = (v: Scalar): string => (isError(v) ? v.error : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v));
const toBool = (v: Scalar): boolean | FormulaError => {
  if (isError(v)) return v;
  if (typeof v === 'string') { const u = v.toUpperCase(); if (u === 'TRUE') return true; if (u === 'FALSE' || u === '') return false; return err('#VALUE!'); }
  return Boolean(v);
};
const flat = (vals: Value[]): Scalar[] => vals.flatMap(v => (Array.isArray(v) ? v.flat() : [v]));
const scalar = (v: Value): Scalar => (Array.isArray(v) ? v[0]?.[0] ?? '' : v);

/** Numbers among the arguments, like Excel: in ranges only real numbers count; typed arguments are converted. */
function numbers(args: Value[]): number[] | FormulaError {
  const out: number[] = [];
  for (const a of args) {
    if (Array.isArray(a)) {
      for (const v of a.flat()) { if (isError(v)) return v; if (typeof v === 'number') out.push(v); }
    } else {
      if (a === '') continue;
      const n = toNum(a);
      if (isError(n)) return n;
      out.push(n);
    }
  }
  return out;
}

function criteria(test: Scalar): (v: Scalar) => boolean {
  const s = toStr(test);
  const m = s.match(/^(<=|>=|<>|<|>|=)?(.*)$/)!;
  const op = m[1] ?? '=';
  const raw = m[2];
  const n = Number(raw);
  const numeric = raw !== '' && !isNaN(n);
  return v => {
    if (numeric && typeof v === 'number') {
      return op === '=' ? v === n : op === '<>' ? v !== n : op === '<' ? v < n : op === '>' ? v > n : op === '<=' ? v <= n : v >= n;
    }
    const a = toStr(v).toLowerCase(), b = raw.toLowerCase();
    const pattern = new RegExp(`^${b.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
    return op === '<>' ? !pattern.test(a) : op === '=' ? pattern.test(a) : false;
  };
}

const roundTo = (n: number, d: number, mode: 'round' | 'up' | 'down') => {
  const f = 10 ** d;
  const x = n * f;
  const r = mode === 'round' ? Math.sign(x) * Math.round(Math.abs(x) + 1e-9) : mode === 'up' ? Math.sign(x) * Math.ceil(Math.abs(x) - 1e-9) : Math.trunc(x);
  return r / f;
};

type Fn = (args: Value[]) => Value;
const num1 = (f: (n: number) => number): Fn => args => { const n = toNum(scalar(args[0] ?? '')); return isError(n) ? n : f(n); };
const str1 = (f: (s: string) => Scalar): Fn => args => { const v = scalar(args[0] ?? ''); return isError(v) ? v : f(toStr(v)); };

const FUNCTIONS: Record<string, Fn> = {
  SUM: a => { const n = numbers(a); return isError(n) ? n : n.reduce((x, y) => x + y, 0); },
  AVERAGE: a => { const n = numbers(a); return isError(n) ? n : n.length ? n.reduce((x, y) => x + y, 0) / n.length : err('#DIV/0!'); },
  MIN: a => { const n = numbers(a); return isError(n) ? n : n.length ? Math.min(...n) : 0; },
  MAX: a => { const n = numbers(a); return isError(n) ? n : n.length ? Math.max(...n) : 0; },
  PRODUCT: a => { const n = numbers(a); return isError(n) ? n : n.reduce((x, y) => x * y, 1); },
  MEDIAN: a => {
    const n = numbers(a);
    if (isError(n)) return n;
    if (!n.length) return err('#NUM!');
    const s = [...n].sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  },
  COUNT: a => flat(a).filter(v => typeof v === 'number').length,
  COUNTA: a => flat(a).filter(v => v !== '').length,
  COUNTBLANK: a => flat(a).filter(v => v === '').length,
  COUNTIF: a => { const ok = criteria(scalar(a[1] ?? '')); return flat([a[0]]).filter(ok).length; },
  SUMIF: a => {
    const ok = criteria(scalar(a[1] ?? ''));
    const test = flat([a[0]]), sum = flat([a[2] ?? a[0]]);
    return test.reduce<number>((acc, v, i) => (ok(v) && typeof sum[i] === 'number' ? acc + (sum[i] as number) : acc), 0);
  },
  AVERAGEIF: a => {
    const ok = criteria(scalar(a[1] ?? ''));
    const test = flat([a[0]]), vals = flat([a[2] ?? a[0]]);
    const hits = test.map((v, i) => (ok(v) ? vals[i] : null)).filter((v): v is number => typeof v === 'number');
    return hits.length ? hits.reduce((x, y) => x + y, 0) / hits.length : err('#DIV/0!');
  },
  ROUND: a => { const n = toNum(scalar(a[0] ?? '')), d = toNum(scalar(a[1] ?? 0)); return isError(n) ? n : isError(d) ? d : roundTo(n, d, 'round'); },
  ROUNDUP: a => { const n = toNum(scalar(a[0] ?? '')), d = toNum(scalar(a[1] ?? 0)); return isError(n) ? n : isError(d) ? d : roundTo(n, d, 'up'); },
  ROUNDDOWN: a => { const n = toNum(scalar(a[0] ?? '')), d = toNum(scalar(a[1] ?? 0)); return isError(n) ? n : isError(d) ? d : roundTo(n, d, 'down'); },
  INT: num1(Math.floor),
  ABS: num1(Math.abs),
  SQRT: a => { const n = toNum(scalar(a[0] ?? '')); return isError(n) ? n : n < 0 ? err('#NUM!') : Math.sqrt(n); },
  POWER: a => { const n = toNum(scalar(a[0] ?? '')), p = toNum(scalar(a[1] ?? '')); return isError(n) ? n : isError(p) ? p : n ** p; },
  MOD: a => {
    const n = toNum(scalar(a[0] ?? '')), d = toNum(scalar(a[1] ?? ''));
    if (isError(n)) return n;
    if (isError(d)) return d;
    return d === 0 ? err('#DIV/0!') : n - d * Math.floor(n / d);
  },
  PI: () => Math.PI,
  IF: a => {
    const c = toBool(scalar(a[0] ?? false));
    if (isError(c)) return c;
    return c ? (a[1] ?? true) : (a[2] ?? false);
  },
  IFERROR: a => (isError(scalar(a[0] ?? '')) ? (a[1] ?? '') : a[0]),
  AND: a => { const v = flat(a).map(toBool); const e = v.find(isError); return e ?? v.every(Boolean); },
  OR: a => { const v = flat(a).map(toBool); const e = v.find(isError); return e ?? v.some(Boolean); },
  NOT: a => { const b = toBool(scalar(a[0] ?? false)); return isError(b) ? b : !b; },
  CONCAT: a => { const v = flat(a); const e = v.find(isError); return e ?? v.map(toStr).join(''); },
  CONCATENATE: a => { const v = flat(a); const e = v.find(isError); return e ?? v.map(toStr).join(''); },
  LEN: str1(s => s.length),
  UPPER: str1(s => s.toUpperCase()),
  LOWER: str1(s => s.toLowerCase()),
  PROPER: str1(s => s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())),
  TRIM: str1(s => s.trim().replace(/\s+/g, ' ')),
  LEFT: a => { const s = toStr(scalar(a[0] ?? '')), n = toNum(scalar(a[1] ?? 1)); return isError(n) ? n : s.slice(0, n); },
  RIGHT: a => { const s = toStr(scalar(a[0] ?? '')), n = toNum(scalar(a[1] ?? 1)); return isError(n) ? n : n ? s.slice(-n) : ''; },
  MID: a => {
    const s = toStr(scalar(a[0] ?? '')), st = toNum(scalar(a[1] ?? 1)), n = toNum(scalar(a[2] ?? 0));
    return isError(st) ? st : isError(n) ? n : s.substr(st - 1, n);
  },
  TODAY: () => dateSerial(new Date(new Date().toDateString())),
  NOW: () => dateSerial(new Date()),
};

export const FUNCTION_NAMES = Object.keys(FUNCTIONS).sort();

/** Days since 1899-12-30, the way spreadsheets store dates. */
export function dateSerial(d: Date): number {
  return (d.getTime() - d.getTimezoneOffset() * 60000) / 86400000 + 25569;
}
export function serialToDate(n: number): Date {
  const d = new Date((n - 25569) * 86400000);
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000);
}

function compare(a: Scalar, b: Scalar): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  const x = toStr(a).toLowerCase(), y = toStr(b).toLowerCase();
  if (typeof a === 'number' && typeof b === 'string') return -1;
  if (typeof a === 'string' && typeof b === 'number') return 1;
  return x < y ? -1 : x > y ? 1 : 0;
}

function evalNode(n: Node, get: Getter): Value {
  switch (n.k) {
    case 'lit': return n.v;
    case 'ref': return get(n.c, n.r);
    case 'range': {
      if ((n.r2 - n.r1 + 1) * (n.c2 - n.c1 + 1) > 1_000_000) return err('#REF!');
      const rows: Scalar[][] = [];
      for (let r = n.r1; r <= n.r2; r++) {
        const row: Scalar[] = [];
        for (let c = n.c1; c <= n.c2; c++) row.push(get(c, r));
        rows.push(row);
      }
      return rows;
    }
    case 'un': {
      const v = toNum(scalar(evalNode(n.a, get)));
      return isError(v) ? v : n.op === '-' ? -v : v;
    }
    case 'bin': {
      const a = scalar(evalNode(n.a, get)), b = scalar(evalNode(n.b, get));
      if (isError(a)) return a;
      if (isError(b)) return b;
      if (n.op === '&') return toStr(a) + toStr(b);
      if (['=', '<>', '<', '>', '<=', '>='].includes(n.op)) {
        const c = compare(a === '' && typeof b === 'number' ? 0 : a, b === '' && typeof a === 'number' ? 0 : b);
        return n.op === '=' ? c === 0 : n.op === '<>' ? c !== 0 : n.op === '<' ? c < 0 : n.op === '>' ? c > 0 : n.op === '<=' ? c <= 0 : c >= 0;
      }
      const x = toNum(a), y = toNum(b);
      if (isError(x)) return x;
      if (isError(y)) return y;
      if (n.op === '+') return x + y;
      if (n.op === '-') return x - y;
      if (n.op === '*') return x * y;
      if (n.op === '/') return y === 0 ? err('#DIV/0!') : x / y;
      return x ** y;
    }
    case 'call': {
      const fn = FUNCTIONS[n.name];
      if (!fn) return err('#NAME?');
      // IF and IFERROR only look at the branch they need, so a cycle or error in the other one does not matter.
      if (n.name === 'IF') {
        const c = toBool(scalar(evalNode(n.args[0] ?? { k: 'lit', v: false }, get)));
        if (isError(c)) return c;
        const branch = c ? n.args[1] : n.args[2];
        return branch ? evalNode(branch, get) : c;
      }
      if (n.name === 'IFERROR') {
        const v = evalNode(n.args[0] ?? { k: 'lit', v: '' }, get);
        return isError(scalar(v)) ? (n.args[1] ? evalNode(n.args[1], get) : '') : v;
      }
      return fn(n.args.map(a => evalNode(a, get)));
    }
  }
}

const parsed = new Map<string, Node | FormulaError>();

/** Works out a formula (without its leading '='). */
export function evaluate(formula: string, get: Getter): Scalar {
  let node = parsed.get(formula);
  if (!node) {
    try { node = parse(formula); } catch (e) {
      const code = (e as Error).message;
      node = err(code === '#NAME?' ? '#NAME?' : '#VALUE!');
    }
    if (parsed.size > 5000) parsed.clear();
    parsed.set(formula, node);
  }
  if (isError(node)) return node;
  const v = scalar(evalNode(node, get));
  return typeof v === 'number' && !isFinite(v) ? err('#NUM!') : v;
}

/**
 * Rewrites the cell references in a formula, like Excel does when a formula is copied or rows are inserted.
 * `move` gets each reference and returns its new place, or null when the cell it pointed at is gone.
 */
export function moveRefs(formula: string, move: (c: number, r: number, absC: boolean, absR: boolean) => { c: number; r: number } | null): string {
  let toks: Tok[];
  try { toks = tokenize(formula); } catch { return formula; }
  let out = '', last = 0;
  for (const tk of toks) {
    if (tk.t !== 'ref') continue;
    const to = move(tk.c, tk.r, tk.absC, tk.absR);
    out += formula.slice(last, tk.s);
    out += to && to.c >= 0 && to.r >= 0 ? `${tk.absC ? '$' : ''}${colName(to.c)}${tk.absR ? '$' : ''}${to.r + 1}` : '#REF!';
    last = tk.e;
  }
  return out + formula.slice(last);
}
