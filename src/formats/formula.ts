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
  | { t: 'ref'; c: number; r: number; absC: boolean; absR: boolean; s: number; e: number; sheet?: string; pre: string }
  | { t: 'name'; v: string; s: number; e: number }
  | { t: 'op'; v: string; s: number; e: number };

const REF = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/;
// A sheet name before a reference: Sheet2!A1 or 'My sheet'!A1.
const SHEET = /^(?:'((?:[^']|'')+)'|([A-Za-z_\u00C0-\uFFFF][\w.\u00C0-\uFFFF]*))!/;

/** How a sheet name is written in a formula: quoted when it has spaces or other signs. */
export const sheetRef = (name: string) => (/^[A-Za-z_\u00C0-\uFFFF][\w.\u00C0-\uFFFF]*$/.test(name) && !/^[A-Za-z]{1,3}\d+$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`);

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
    } else if ((m = rest.match(SHEET)) && REF.test(rest.slice(m[0].length))) {
      const sheet = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2];
      const pre = m[0];
      const r = rest.slice(pre.length).match(REF)!;
      out.push({ t: 'ref', c: colIndex(r[2]), r: Number(r[4]) - 1, absC: !!r[1], absR: !!r[3], s: i, e: i + pre.length + r[0].length, sheet, pre });
      m = [pre + r[0]];
    } else if ((m = rest.match(REF))) {
      out.push({ t: 'ref', c: colIndex(m[2]), r: Number(m[4]) - 1, absC: !!m[1], absR: !!m[3], s: i, e: i + m[0].length, pre: '' });
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
  | { k: 'ref'; c: number; r: number; sheet?: string }
  | { k: 'range'; c1: number; r1: number; c2: number; r2: number; sheet?: string }
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
        return { k: 'range', c1: Math.min(tk.c, b.c), r1: Math.min(tk.r, b.r), c2: Math.max(tk.c, b.c), r2: Math.max(tk.r, b.r), sheet: tk.sheet };
      }
      return { k: 'ref', c: tk.c, r: tk.r, sheet: tk.sheet };
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

/** Gives a cell's value; `sheet` is set for a reference to another sheet, like Sheet2!A1. */
export type Getter = (c: number, r: number, sheet?: string) => Scalar;

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
  ...MORE(),
};

// ---------- the rest of the everyday functions ----------

const grid = (v: Value | undefined): Scalar[][] => (Array.isArray(v) ? v : [[v ?? '']]);
const arg = (a: Value[], i: number, d: Scalar = ''): Scalar => scalar(a[i] ?? d);
const numArg = (a: Value[], i: number, d?: number): number | FormulaError => (a[i] === undefined || scalar(a[i]) === '' ? (d ?? 0) : toNum(arg(a, i)));
const same = (a: Scalar, b: Scalar) => compare(a, b) === 0;

/** Where `want` is in a list: exact (0), the largest value not above it (1), or the smallest not below it (-1). */
function findIn(list: Scalar[], want: Scalar, mode: number): number {
  if (mode === 0) {
    if (typeof want === 'string' && /[*?]/.test(want)) { const ok = criteria(want); return list.findIndex(v => ok(v)); }
    return list.findIndex(v => same(v, want));
  }
  let best = -1;
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (v === '' || typeof v !== typeof want) continue;
    const c = compare(v, want);
    if (c === 0) return i;
    if (mode > 0 ? c < 0 && (best < 0 || compare(v, list[best]) > 0) : c > 0 && (best < 0 || compare(v, list[best]) < 0)) best = i;
  }
  return best;
}

/** The rows that pass every (range, criteria) pair, for SUMIFS and friends. */
function passing(a: Value[], from: number): boolean[] {
  const size = flat([a[from]]).length;
  const ok = new Array<boolean>(size).fill(true);
  for (let i = from; i + 1 < a.length; i += 2) {
    const test = criteria(scalar(a[i + 1]));
    flat([a[i]]).forEach((v, j) => { if (!test(v)) ok[j] = false; });
  }
  return ok;
}

const parts = (n: number) => { const d = serialToDate(n); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), date: d }; };
const dateFromParts = (y: number, m: number, d: number) => dateSerial(new Date(y, m - 1, d));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Excel's TEXT(value, "format") for the common codes: 0.00, #,##0, 0%, dd/mm/yyyy, mmmm, hh:mm and friends. */
export function textFormat(v: number, code: string): string {
  const c = code.replace(/\\(.)/g, '$1').replace(/"([^"]*)"/g, '$1');
  if (/[dmyhs]/i.test(c) && !/[0#]/.test(c)) {
    const date = serialToDate(v);
    const frac = v - Math.floor(v);
    const secs = Math.round(frac * 86400);
    const hasAmPm = /am\/pm/i.test(c);
    const h24 = Math.floor(secs / 3600) % 24;
    return c.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|am\/pm/gi, (tok, off: number, str: string) => {
      const t = tok.toLowerCase();
      // "m" after an hour or before seconds means minutes.
      const minutes = (t === 'mm' || t === 'm') && (/h[^dmy]*$/i.test(str.slice(0, off)) || /^[^dmy]*s/i.test(str.slice(off + tok.length)));
      if (minutes) return String(Math.floor(secs / 60) % 60).padStart(t.length, '0');
      switch (t) {
        case 'yyyy': return String(date.getFullYear());
        case 'yy': return String(date.getFullYear()).slice(-2);
        case 'mmmm': return MONTHS[date.getMonth()];
        case 'mmm': return MONTHS[date.getMonth()].slice(0, 3);
        case 'mm': return String(date.getMonth() + 1).padStart(2, '0');
        case 'm': return String(date.getMonth() + 1);
        case 'dddd': return DAYS[date.getDay()];
        case 'ddd': return DAYS[date.getDay()].slice(0, 3);
        case 'dd': return String(date.getDate()).padStart(2, '0');
        case 'd': return String(date.getDate());
        case 'hh': return String(hasAmPm ? (h24 % 12 || 12) : h24).padStart(2, '0');
        case 'h': return String(hasAmPm ? (h24 % 12 || 12) : h24);
        case 'ss': return String(secs % 60).padStart(2, '0');
        case 's': return String(secs % 60);
        default: return h24 < 12 ? 'AM' : 'PM';
      }
    });
  }
  const pct = c.includes('%');
  const x = pct ? v * 100 : v;
  const m = c.match(/([#0,]*)(?:\.([0#]+))?/);
  const intPart = m?.[1] ?? '0';
  const decimals = m?.[2]?.length ?? 0;
  const grouped = intPart.includes(',');
  let out = Math.abs(x).toFixed(decimals);
  if (grouped) { const [i, f] = out.split('.'); out = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? `.${f}` : ''); }
  const minInt = (intPart.replace(/[#,]/g, '').length);
  if (minInt > 1) { const [i, f] = out.split('.'); out = i.padStart(minInt, '0') + (f ? `.${f}` : ''); }
  const number = (x < 0 ? '-' : '') + out;
  return c.replace(/[#0,]+(?:\.[0#]+)?%?/, number + (pct ? '%' : ''));
}

function stats(a: Value[]) {
  const n = numbers(a);
  if (isError(n)) return n;
  const mean = n.reduce((x, y) => x + y, 0) / (n.length || 1);
  const ss = n.reduce((x, y) => x + (y - mean) ** 2, 0);
  return { n, mean, ss };
}

function MORE(): Record<string, Fn> {
  return {
    // Lookup
    VLOOKUP: a => {
      const table = grid(a[1]), want = arg(a, 0), col = numArg(a, 2);
      if (isError(want)) return want;
      if (isError(col)) return col;
      if (col < 1 || col > (table[0]?.length ?? 0)) return err('#REF!');
      const exact = a[3] !== undefined && toBool(arg(a, 3)) === false;
      const i = findIn(table.map(r => r[0]), want, exact ? 0 : 1);
      return i < 0 ? err('#N/A') : table[i][col - 1];
    },
    HLOOKUP: a => {
      const table = grid(a[1]), want = arg(a, 0), row = numArg(a, 2);
      if (isError(want)) return want;
      if (isError(row)) return row;
      if (row < 1 || row > table.length) return err('#REF!');
      const exact = a[3] !== undefined && toBool(arg(a, 3)) === false;
      const i = findIn(table[0] ?? [], want, exact ? 0 : 1);
      return i < 0 ? err('#N/A') : table[row - 1][i];
    },
    XLOOKUP: a => {
      const want = arg(a, 0);
      if (isError(want)) return want;
      const look = flat([a[1]]);
      const back = grid(a[2]);
      const mode = numArg(a, 4, 0);
      if (isError(mode)) return mode;
      const i = findIn(look, want, mode === 0 ? 0 : mode > 0 ? -1 : 1);
      if (i < 0) return a[3] !== undefined && arg(a, 3) !== '' ? a[3] : err('#N/A');
      // The answer is the matching row (or column) of the return range.
      return back.length === 1 ? back[0][i] ?? err('#N/A') : back[i]?.length === 1 ? back[i][0] : [back[i] ?? []];
    },
    MATCH: a => {
      const want = arg(a, 0);
      if (isError(want)) return want;
      const mode = numArg(a, 2, 1);
      if (isError(mode)) return mode;
      const i = findIn(flat([a[1]]), want, mode);
      return i < 0 ? err('#N/A') : i + 1;
    },
    INDEX: a => {
      const table = grid(a[0]);
      const r = numArg(a, 1, 0), c = numArg(a, 2, 0);
      if (isError(r)) return r;
      if (isError(c)) return c;
      if (table.length === 1 && a[2] === undefined) return table[0][r - 1] ?? err('#REF!');
      if (r === 0) return table.map(row => [row[c - 1] ?? '']);
      if (c === 0) return table[r - 1] ? [table[r - 1]] : err('#REF!');
      return table[r - 1]?.[c - 1] ?? err('#REF!');
    },
    CHOOSE: a => { const i = numArg(a, 0); return isError(i) ? i : a[Math.floor(i)] ?? err('#VALUE!'); },
    // Conditions over several ranges
    COUNTIFS: a => passing(a, 0).filter(Boolean).length,
    SUMIFS: a => { const ok = passing(a, 1), v = flat([a[0]]); return v.reduce<number>((s1, x, i) => (ok[i] && typeof x === 'number' ? s1 + x : s1), 0); },
    AVERAGEIFS: a => {
      const ok = passing(a, 1), v = flat([a[0]]).filter((x, i) => ok[i] && typeof x === 'number') as number[];
      return v.length ? v.reduce((x, y) => x + y, 0) / v.length : err('#DIV/0!');
    },
    MAXIFS: a => { const ok = passing(a, 1), v = flat([a[0]]).filter((x, i) => ok[i] && typeof x === 'number') as number[]; return v.length ? Math.max(...v) : 0; },
    MINIFS: a => { const ok = passing(a, 1), v = flat([a[0]]).filter((x, i) => ok[i] && typeof x === 'number') as number[]; return v.length ? Math.min(...v) : 0; },
    IFNA: a => a[0] ?? '',
    IFS: () => err('#N/A'),
    SWITCH: () => err('#N/A'),
    XOR: a => { const v = flat(a).map(toBool); const e = v.find(isError); return e ?? v.filter(Boolean).length % 2 === 1; },
    TRUE: () => true,
    FALSE: () => false,
    NA: () => err('#N/A'),
    // Information
    ISBLANK: a => arg(a, 0) === '',
    ISNUMBER: a => typeof arg(a, 0) === 'number',
    ISTEXT: a => typeof arg(a, 0) === 'string' && arg(a, 0) !== '',
    ISLOGICAL: a => typeof arg(a, 0) === 'boolean',
    ISERROR: a => isError(arg(a, 0)),
    ISNA: a => { const v = arg(a, 0); return isError(v) && v.error === '#N/A'; },
    ISEVEN: a => { const n = numArg(a, 0); return isError(n) ? n : Math.trunc(n) % 2 === 0; },
    ISODD: a => { const n = numArg(a, 0); return isError(n) ? n : Math.abs(Math.trunc(n) % 2) === 1; },
    // Math
    TRUNC: a => { const n = numArg(a, 0), d = numArg(a, 1, 0); return isError(n) ? n : isError(d) ? d : roundTo(n, d, 'down'); },
    CEILING: a => { const n = numArg(a, 0), f = numArg(a, 1, 1); return isError(n) ? n : isError(f) ? f : f === 0 ? 0 : Math.ceil(n / f - 1e-12) * f; },
    FLOOR: a => { const n = numArg(a, 0), f = numArg(a, 1, 1); return isError(n) ? n : isError(f) ? f : f === 0 ? err('#DIV/0!') : Math.floor(n / f + 1e-12) * f; },
    MROUND: a => { const n = numArg(a, 0), f = numArg(a, 1, 1); return isError(n) ? n : isError(f) ? f : f === 0 ? 0 : Math.round(n / f) * f; },
    SIGN: num1(Math.sign),
    EXP: num1(Math.exp),
    LN: a => { const n = numArg(a, 0); return isError(n) ? n : n <= 0 ? err('#NUM!') : Math.log(n); },
    LOG10: a => { const n = numArg(a, 0); return isError(n) ? n : n <= 0 ? err('#NUM!') : Math.log10(n); },
    LOG: a => { const n = numArg(a, 0), b = numArg(a, 1, 10); return isError(n) ? n : isError(b) ? b : n <= 0 || b <= 0 || b === 1 ? err('#NUM!') : Math.log(n) / Math.log(b); },
    RAND: () => Math.random(),
    RANDBETWEEN: a => { const lo = numArg(a, 0), hi = numArg(a, 1); return isError(lo) ? lo : isError(hi) ? hi : Math.floor(Math.random() * (Math.floor(hi) - Math.ceil(lo) + 1)) + Math.ceil(lo); },
    SUMPRODUCT: a => {
      const lists = a.map(v => flat([v]));
      const len = lists[0]?.length ?? 0;
      if (lists.some(l => l.length !== len)) return err('#VALUE!');
      let total = 0;
      for (let i = 0; i < len; i++) total += lists.reduce((p, l) => p * (typeof l[i] === 'number' ? (l[i] as number) : 0), 1);
      return total;
    },
    SUMSQ: a => { const n = numbers(a); return isError(n) ? n : n.reduce((x, y) => x + y * y, 0); },
    QUOTIENT: a => { const n = numArg(a, 0), d = numArg(a, 1); return isError(n) ? n : isError(d) ? d : d === 0 ? err('#DIV/0!') : Math.trunc(n / d); },
    GCD: a => { const n = numbers(a); if (isError(n)) return n; const g = (x: number, y: number): number => (y ? g(y, x % y) : x); return n.map(Math.trunc).reduce(g, 0); },
    LCM: a => { const n = numbers(a); if (isError(n)) return n; const g = (x: number, y: number): number => (y ? g(y, x % y) : x); return n.map(Math.trunc).reduce((x, y) => (x && y ? (x * y) / g(x, y) : 0), 1); },
    FACT: a => { const n = numArg(a, 0); if (isError(n)) return n; if (n < 0) return err('#NUM!'); let f = 1; for (let i = 2; i <= Math.floor(n); i++) f *= i; return f; },
    // Statistics
    'STDEV.S': a => { const s1 = stats(a); return isError(s1) ? s1 : s1.n.length < 2 ? err('#DIV/0!') : Math.sqrt(s1.ss / (s1.n.length - 1)); },
    STDEV: a => { const s1 = stats(a); return isError(s1) ? s1 : s1.n.length < 2 ? err('#DIV/0!') : Math.sqrt(s1.ss / (s1.n.length - 1)); },
    'STDEV.P': a => { const s1 = stats(a); return isError(s1) ? s1 : s1.n.length < 1 ? err('#DIV/0!') : Math.sqrt(s1.ss / s1.n.length); },
    'VAR.S': a => { const s1 = stats(a); return isError(s1) ? s1 : s1.n.length < 2 ? err('#DIV/0!') : s1.ss / (s1.n.length - 1); },
    VAR: a => { const s1 = stats(a); return isError(s1) ? s1 : s1.n.length < 2 ? err('#DIV/0!') : s1.ss / (s1.n.length - 1); },
    'VAR.P': a => { const s1 = stats(a); return isError(s1) ? s1 : s1.n.length < 1 ? err('#DIV/0!') : s1.ss / s1.n.length; },
    LARGE: a => { const n = numbers([a[0]]), k = numArg(a, 1); if (isError(n)) return n; if (isError(k)) return k; const s1 = [...n].sort((x, y) => y - x); return s1[k - 1] ?? err('#NUM!'); },
    SMALL: a => { const n = numbers([a[0]]), k = numArg(a, 1); if (isError(n)) return n; if (isError(k)) return k; const s1 = [...n].sort((x, y) => x - y); return s1[k - 1] ?? err('#NUM!'); },
    RANK: a => {
      const v = numArg(a, 0), n = numbers([a[1]]), asc = numArg(a, 2, 0);
      if (isError(v)) return v;
      if (isError(n)) return n;
      if (isError(asc)) return asc;
      if (!n.includes(v)) return err('#N/A');
      return n.filter(x => (asc ? x < v : x > v)).length + 1;
    },
    'RANK.EQ': a => FUNCTIONS.RANK(a),
    MODE: a => {
      const n = numbers(a);
      if (isError(n)) return n;
      const counts = new Map<number, number>();
      let best: number | null = null, top = 1;
      for (const x of n) { const k = (counts.get(x) ?? 0) + 1; counts.set(x, k); if (k > top) { top = k; best = x; } }
      return best ?? err('#N/A');
    },
    // Text
    FIND: a => {
      const want = toStr(arg(a, 0)), within = toStr(arg(a, 1)), from = numArg(a, 2, 1);
      if (isError(from)) return from;
      const i = within.indexOf(want, from - 1);
      return i < 0 ? err('#VALUE!') : i + 1;
    },
    SEARCH: a => {
      const want = toStr(arg(a, 0)).toLowerCase(), within = toStr(arg(a, 1)).toLowerCase(), from = numArg(a, 2, 1);
      if (isError(from)) return from;
      const re = new RegExp(want.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'));
      const m = re.exec(within.slice(from - 1));
      return m ? m.index + from : err('#VALUE!');
    },
    SUBSTITUTE: a => {
      const text = toStr(arg(a, 0)), from = toStr(arg(a, 1)), to = toStr(arg(a, 2));
      if (!from) return text;
      if (a[3] === undefined) return text.split(from).join(to);
      const nth = numArg(a, 3);
      if (isError(nth)) return nth;
      let i = -1;
      for (let k = 0; k < nth; k++) { i = text.indexOf(from, i + 1); if (i < 0) return text; }
      return text.slice(0, i) + to + text.slice(i + from.length);
    },
    REPLACE: a => {
      const text = toStr(arg(a, 0)), st = numArg(a, 1), n = numArg(a, 2);
      if (isError(st)) return st;
      if (isError(n)) return n;
      return text.slice(0, st - 1) + toStr(arg(a, 3)) + text.slice(st - 1 + n);
    },
    REPT: a => { const n = numArg(a, 1); return isError(n) ? n : toStr(arg(a, 0)).repeat(Math.max(0, Math.floor(n))); },
    TEXTJOIN: a => {
      const sep = toStr(arg(a, 0)), skip = toBool(arg(a, 1, true));
      if (isError(skip)) return skip;
      const v = flat(a.slice(2));
      const e = v.find(isError);
      return e ?? v.filter(x => !skip || x !== '').map(toStr).join(sep);
    },
    EXACT: a => toStr(arg(a, 0)) === toStr(arg(a, 1)),
    CHAR: a => { const n = numArg(a, 0); return isError(n) ? n : String.fromCharCode(n); },
    CODE: a => { const s1 = toStr(arg(a, 0)); return s1 ? s1.charCodeAt(0) : err('#VALUE!'); },
    CLEAN: str1(s1 => s1.replace(/[\u0000-\u001f]/g, '')), // eslint-disable-line no-control-regex
    T: a => { const v = arg(a, 0); return typeof v === 'string' ? v : ''; },
    N: a => { const v = arg(a, 0); return typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : 0; },
    VALUE: a => {
      const v = arg(a, 0);
      if (typeof v === 'number') return v;
      const s1 = toStr(v).trim().replace(/[\s$€£¥]/g, '');
      const pc = s1.endsWith('%');
      const n = Number((pc ? s1.slice(0, -1) : s1).replace(',', '.'));
      if (!isNaN(n) && s1 !== '') return pc ? n / 100 : n;
      const d = Date.parse(toStr(v));
      return isNaN(d) ? err('#VALUE!') : dateSerial(new Date(d));
    },
    TEXT: a => {
      const v = arg(a, 0), code = toStr(arg(a, 1));
      if (isError(v)) return v;
      const n = typeof v === 'number' ? v : toNum(v);
      return isError(n) ? toStr(v) : textFormat(n, code);
    },
    FIXED: a => {
      const n = numArg(a, 0), d = numArg(a, 1, 2);
      if (isError(n)) return n;
      if (isError(d)) return d;
      const out = roundTo(n, d, 'round').toFixed(Math.max(0, d));
      return toBool(arg(a, 2, false)) === true ? out : out.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },
    DOLLAR: a => { const n = numArg(a, 0), d = numArg(a, 1, 2); return isError(n) ? n : isError(d) ? d : `${n < 0 ? '-' : ''}$${textFormat(Math.abs(n), `#,##0${d > 0 ? '.' + '0'.repeat(d) : ''}`)}`; },
    // Dates and times
    DATE: a => { const y = numArg(a, 0), m = numArg(a, 1), d = numArg(a, 2); return isError(y) ? y : isError(m) ? m : isError(d) ? d : dateFromParts(y < 1900 ? y + 1900 : y, m, d); },
    TIME: a => { const h = numArg(a, 0), m = numArg(a, 1), s1 = numArg(a, 2); return isError(h) ? h : isError(m) ? m : isError(s1) ? s1 : ((h * 3600 + m * 60 + s1) / 86400) % 1; },
    YEAR: a => { const n = numArg(a, 0); return isError(n) ? n : parts(n).y; },
    MONTH: a => { const n = numArg(a, 0); return isError(n) ? n : parts(n).m; },
    DAY: a => { const n = numArg(a, 0); return isError(n) ? n : parts(n).d; },
    HOUR: a => { const n = numArg(a, 0); return isError(n) ? n : Math.floor(Math.round((n % 1) * 86400) / 3600) % 24; },
    MINUTE: a => { const n = numArg(a, 0); return isError(n) ? n : Math.floor(Math.round((n % 1) * 86400) / 60) % 60; },
    SECOND: a => { const n = numArg(a, 0); return isError(n) ? n : Math.round((n % 1) * 86400) % 60; },
    WEEKDAY: a => {
      const n = numArg(a, 0), type = numArg(a, 1, 1);
      if (isError(n)) return n;
      if (isError(type)) return type;
      const d = parts(n).date.getDay();
      return type === 2 ? ((d + 6) % 7) + 1 : type === 3 ? (d + 6) % 7 : d + 1;
    },
    WEEKNUM: a => {
      const n = numArg(a, 0);
      if (isError(n)) return n;
      const { y } = parts(n);
      const jan1 = dateFromParts(y, 1, 1);
      return Math.floor((Math.floor(n) - jan1 + parts(jan1).date.getDay()) / 7) + 1;
    },
    EDATE: a => {
      const n = numArg(a, 0), m = numArg(a, 1);
      if (isError(n)) return n;
      if (isError(m)) return m;
      const p = parts(n);
      const last = new Date(p.y, p.m - 1 + m + 1, 0).getDate();
      return dateFromParts(p.y, p.m + m, Math.min(p.d, last));
    },
    EOMONTH: a => { const n = numArg(a, 0), m = numArg(a, 1); if (isError(n)) return n; if (isError(m)) return m; const p = parts(n); return dateFromParts(p.y, p.m + m + 1, 0); },
    DAYS: a => { const e = numArg(a, 0), s1 = numArg(a, 1); return isError(e) ? e : isError(s1) ? s1 : Math.floor(e) - Math.floor(s1); },
    DATEDIF: a => {
      const s1 = numArg(a, 0), e = numArg(a, 1), unit = toStr(arg(a, 2)).toUpperCase();
      if (isError(s1)) return s1;
      if (isError(e)) return e;
      if (e < s1) return err('#NUM!');
      const p = parts(s1), q = parts(e);
      let months = (q.y - p.y) * 12 + q.m - p.m;
      if (q.d < p.d) months--;
      if (unit === 'D') return Math.floor(e) - Math.floor(s1);
      if (unit === 'M') return months;
      if (unit === 'Y') return Math.floor(months / 12);
      if (unit === 'YM') return months % 12;
      if (unit === 'MD') return q.d >= p.d ? q.d - p.d : Math.floor(e) - dateFromParts(q.y, q.m - 1, p.d);
      return err('#NUM!');
    },
    NETWORKDAYS: a => {
      const s1 = numArg(a, 0), e = numArg(a, 1);
      if (isError(s1)) return s1;
      if (isError(e)) return e;
      const holidays = new Set(flat([a[2] ?? '']).filter((x): x is number => typeof x === 'number').map(Math.floor));
      const [lo, hi, sign] = s1 <= e ? [s1, e, 1] : [e, s1, -1];
      let n = 0;
      for (let d = Math.floor(lo); d <= Math.floor(hi); d++) { const w = parts(d).date.getDay(); if (w !== 0 && w !== 6 && !holidays.has(d)) n++; }
      return n * sign;
    },
    WORKDAY: a => {
      const s1 = numArg(a, 0), days = numArg(a, 1);
      if (isError(s1)) return s1;
      if (isError(days)) return days;
      const holidays = new Set(flat([a[2] ?? '']).filter((x): x is number => typeof x === 'number').map(Math.floor));
      let d = Math.floor(s1), left = Math.abs(days);
      const step = days < 0 ? -1 : 1;
      while (left > 0) { d += step; const w = parts(d).date.getDay(); if (w !== 0 && w !== 6 && !holidays.has(d)) left--; }
      return d;
    },
    // Money
    PMT: a => {
      const rate = numArg(a, 0), n = numArg(a, 1), pv = numArg(a, 2), fv = numArg(a, 3, 0), type = numArg(a, 4, 0);
      for (const x of [rate, n, pv, fv, type]) if (isError(x)) return x;
      const [r, k, p, f, t] = [rate, n, pv, fv, type] as number[];
      if (r === 0) return -(p + f) / k;
      const g = (1 + r) ** k;
      return -(r * (p * g + f)) / ((1 + r * t) * (g - 1));
    },
    FV: a => {
      const rate = numArg(a, 0), n = numArg(a, 1), pmt = numArg(a, 2), pv = numArg(a, 3, 0), type = numArg(a, 4, 0);
      for (const x of [rate, n, pmt, pv, type]) if (isError(x)) return x;
      const [r, k, m, p, t] = [rate, n, pmt, pv, type] as number[];
      if (r === 0) return -(p + m * k);
      const g = (1 + r) ** k;
      return -(p * g + m * (1 + r * t) * (g - 1) / r);
    },
    PV: a => {
      const rate = numArg(a, 0), n = numArg(a, 1), pmt = numArg(a, 2), fv = numArg(a, 3, 0), type = numArg(a, 4, 0);
      for (const x of [rate, n, pmt, fv, type]) if (isError(x)) return x;
      const [r, k, m, f, t] = [rate, n, pmt, fv, type] as number[];
      if (r === 0) return -(f + m * k);
      const g = (1 + r) ** k;
      return -(f + m * (1 + r * t) * (g - 1) / r) / g;
    },
    NPV: a => {
      const rate = numArg(a, 0);
      if (isError(rate)) return rate;
      const n = numbers(a.slice(1));
      return isError(n) ? n : n.reduce((s1, v, i) => s1 + v / (1 + rate) ** (i + 1), 0);
    },
  };
}

export const FUNCTION_NAMES = [...Object.keys(FUNCTIONS).filter(n => !['TRUE', 'FALSE'].includes(n)), 'ROW', 'COLUMN', 'ROWS', 'COLUMNS'].sort();

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

interface Here { c: number; r: number }

function evalNode(n: Node, get: Getter, here?: Here): Value {
  const ev = (x: Node) => evalNode(x, get, here);
  switch (n.k) {
    case 'lit': return n.v;
    case 'ref': return get(n.c, n.r, n.sheet);
    case 'range': {
      if ((n.r2 - n.r1 + 1) * (n.c2 - n.c1 + 1) > 1_000_000) return err('#REF!');
      const rows: Scalar[][] = [];
      for (let r = n.r1; r <= n.r2; r++) {
        const row: Scalar[] = [];
        for (let c = n.c1; c <= n.c2; c++) row.push(get(c, r, n.sheet));
        rows.push(row);
      }
      return rows;
    }
    case 'un': {
      const v = toNum(scalar(ev(n.a)));
      return isError(v) ? v : n.op === '-' ? -v : v;
    }
    case 'bin': {
      const a = scalar(ev(n.a)), b = scalar(ev(n.b));
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
      // Functions that look at where a reference is, not at its value.
      if (['ROW', 'COLUMN', 'ROWS', 'COLUMNS'].includes(n.name)) {
        const a = n.args[0];
        const box = !a ? (here ? { c1: here.c, r1: here.r, c2: here.c, r2: here.r } : null)
          : a.k === 'ref' ? { c1: a.c, r1: a.r, c2: a.c, r2: a.r } : a.k === 'range' ? a : null;
        if (!box) return err('#VALUE!');
        return n.name === 'ROW' ? box.r1 + 1 : n.name === 'COLUMN' ? box.c1 + 1 : n.name === 'ROWS' ? box.r2 - box.r1 + 1 : box.c2 - box.c1 + 1;
      }
      const fn = FUNCTIONS[n.name];
      if (!fn) return err('#NAME?');
      // IF, IFERROR, IFNA, IFS and SWITCH only work out the branch they need, so a cycle or error elsewhere does not matter.
      if (n.name === 'IF') {
        const c = toBool(scalar(ev(n.args[0] ?? { k: 'lit', v: false })));
        if (isError(c)) return c;
        const branch = c ? n.args[1] : n.args[2];
        return branch ? ev(branch) : c;
      }
      if (n.name === 'IFERROR' || n.name === 'IFNA') {
        const v = ev(n.args[0] ?? { k: 'lit', v: '' });
        const s1 = scalar(v);
        const bad = n.name === 'IFERROR' ? isError(s1) : isError(s1) && s1.error === '#N/A';
        return bad ? (n.args[1] ? ev(n.args[1]) : '') : v;
      }
      if (n.name === 'IFS') {
        for (let i = 0; i + 1 < n.args.length; i += 2) {
          const c = toBool(scalar(ev(n.args[i])));
          if (isError(c)) return c;
          if (c) return ev(n.args[i + 1]);
        }
        return err('#N/A');
      }
      if (n.name === 'SWITCH') {
        const v = scalar(ev(n.args[0] ?? { k: 'lit', v: '' }));
        if (isError(v)) return v;
        let i = 1;
        for (; i + 1 < n.args.length; i += 2) if (compare(v, scalar(ev(n.args[i]))) === 0) return ev(n.args[i + 1]);
        return i < n.args.length ? ev(n.args[i]) : err('#N/A');
      }
      return fn(n.args.map(ev));
    }
  }
}

const parsed = new Map<string, Node | FormulaError>();

/** Works out a formula (without its leading '='). `here` is the formula's own cell, for ROW() and COLUMN(). */
export function evaluate(formula: string, get: Getter, here?: Here): Scalar {
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
  const v = scalar(evalNode(node, get, here));
  return typeof v === 'number' && !isFinite(v) ? err('#NUM!') : v;
}

/** The cells a formula reads, for drawing them in color while it is typed. */
export function formulaRefs(formula: string): { c1: number; r1: number; c2: number; r2: number; s: number; e: number; sheet?: string }[] {
  let toks: Tok[];
  try { toks = tokenize(formula); } catch { return []; }
  const out: { c1: number; r1: number; c2: number; r2: number; s: number; e: number; sheet?: string }[] = [];
  for (let i = 0; i < toks.length; i++) {
    const a = toks[i];
    if (a.t !== 'ref') continue;
    const colon = toks[i + 1], b = toks[i + 2];
    if (colon?.t === 'op' && colon.v === ':' && b?.t === 'ref') {
      out.push({ c1: Math.min(a.c, b.c), r1: Math.min(a.r, b.r), c2: Math.max(a.c, b.c), r2: Math.max(a.r, b.r), s: a.s, e: b.e, sheet: a.sheet });
      i += 2;
    } else out.push({ c1: a.c, r1: a.r, c2: a.c, r2: a.r, s: a.s, e: a.e, sheet: a.sheet });
  }
  return out;
}

/**
 * Rewrites the cell references in a formula, like Excel does when a formula is copied or rows are inserted.
 * `move` gets each reference (and its sheet name when it names one) and returns its new place, or null when the cell is gone.
 */
export function moveRefs(formula: string, move: (c: number, r: number, absC: boolean, absR: boolean, sheet?: string) => { c: number; r: number } | null): string {
  let toks: Tok[];
  try { toks = tokenize(formula); } catch { return formula; }
  let out = '', last = 0;
  let rangeSheet: string | undefined;
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    if (tk.t !== 'ref') continue;
    // The second half of Sheet2!A1:B3 belongs to Sheet2 too.
    const prev = toks[i - 1], before = toks[i - 2];
    const sheet = tk.sheet ?? (prev?.t === 'op' && prev.v === ':' && before?.t === 'ref' ? rangeSheet : undefined);
    rangeSheet = tk.sheet ?? sheet;
    const to = move(tk.c, tk.r, tk.absC, tk.absR, sheet);
    out += formula.slice(last, tk.s);
    out += to && to.c >= 0 && to.r >= 0 ? `${tk.pre}${tk.absC ? '$' : ''}${colName(to.c)}${tk.absR ? '$' : ''}${to.r + 1}` : '#REF!';
    last = tk.e;
  }
  return out + formula.slice(last);
}

/** Puts a sheet's new name in every formula that names it. */
export function renameSheetRefs(formula: string, from: string, to: string): string {
  let toks: Tok[];
  try { toks = tokenize(formula); } catch { return formula; }
  let out = '', last = 0;
  for (const tk of toks) {
    if (tk.t !== 'ref' || tk.sheet?.toLowerCase() !== from.toLowerCase()) continue;
    out += formula.slice(last, tk.s) + `${sheetRef(to)}!`;
    last = tk.s + tk.pre.length;
  }
  return out + formula.slice(last);
}
