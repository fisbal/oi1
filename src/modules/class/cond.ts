// Conditional formatting: rules that color cells by their value, like Excel's Highlight Cells Rules,
// Top/Bottom Rules, Color Scales and Data Bars.

import { isError, type Scalar } from '../../formats/formula';
import { key, literal, type CondRule, type SheetData } from '../../formats/sheet';

export interface CondLook { fill?: string; color?: string; bar?: { pct: number; color: string } }

export const COND_PRESETS = {
  red: { fill: '#FFC7CE', color: '#9C0006' },
  yellow: { fill: '#FFEB9C', color: '#9C5700' },
  green: { fill: '#C6EFCE', color: '#006100' },
} as const;

const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
function mix(a: string, b: string, t: number): string {
  const x = hex(a), y = hex(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const num = (v: Scalar | undefined) => (typeof v === 'number' ? v : null);

/** How each cell looks under the sheet's rules, by cell key. Later rules win over earlier ones. */
export function condLooks(sheet: SheetData, values: Map<string, Scalar>): Map<string, CondLook> {
  const out = new Map<string, CondLook>();
  for (const rule of sheet.rules ?? []) applyRule(rule, values, out);
  return out;
}

function applyRule(rule: CondRule, values: Map<string, Scalar>, out: Map<string, CondLook>) {
  const { c1, r1, c2, r2 } = rule.range;
  if ((c2 - c1 + 1) * (r2 - r1 + 1) > 100000) return;
  const cells: { k: string; v: Scalar | undefined }[] = [];
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { const k = key(c, r); cells.push({ k, v: values.get(k) }); }
  const nums = cells.map(x => num(x.v)).filter((n): n is number => n !== null);
  const set = (k: string, look: CondLook) => out.set(k, { ...out.get(k), ...look });
  const hl = { fill: rule.fill ?? COND_PRESETS.red.fill, color: rule.color ?? COND_PRESETS.red.color };
  const a = rule.a !== undefined ? literal(rule.a) : '';
  const b = rule.b !== undefined ? literal(rule.b) : '';

  if (rule.kind === 'scale' || rule.kind === 'bars') {
    if (!nums.length) return;
    const lo = Math.min(...nums), hi = Math.max(...nums);
    const [from, to, mid] = rule.colors ?? (rule.kind === 'scale' ? ['#F8696B', '#63BE7B', '#FFEB84'] : [rule.fill ?? '#638EC6', '#638EC6']);
    for (const { k, v } of cells) {
      const n = num(v);
      if (n === null) continue;
      const t = hi === lo ? 0.5 : (n - lo) / (hi - lo);
      if (rule.kind === 'bars') { const base = Math.min(lo, 0); set(k, { bar: { pct: hi === base ? 1 : (n - base) / (hi - base), color: from } }); }
      else set(k, { fill: mid ? (t < 0.5 ? mix(from, mid, t * 2) : mix(mid, to, (t - 0.5) * 2)) : mix(from, to, t) });
    }
    return;
  }
  if (rule.kind === 'top' || rule.kind === 'bottom') {
    const n = Math.max(1, Number(rule.a) || 10);
    const sorted = [...nums].sort((x, y) => (rule.kind === 'top' ? y - x : x - y));
    const edge = sorted[Math.min(n, sorted.length) - 1];
    if (edge === undefined) return;
    for (const { k, v } of cells) { const x = num(v); if (x !== null && (rule.kind === 'top' ? x >= edge : x <= edge)) set(k, hl); }
    return;
  }
  if (rule.kind === 'aboveAverage' || rule.kind === 'belowAverage') {
    if (!nums.length) return;
    const avg = nums.reduce((s, x) => s + x, 0) / nums.length;
    for (const { k, v } of cells) { const x = num(v); if (x !== null && (rule.kind === 'aboveAverage' ? x > avg : x < avg)) set(k, hl); }
    return;
  }
  if (rule.kind === 'duplicate') {
    const seen = new Map<string, number>();
    const norm = (v: Scalar | undefined) => (v === undefined || v === '' || isError(v) ? null : String(v).toLowerCase());
    for (const { v } of cells) { const s = norm(v); if (s !== null) seen.set(s, (seen.get(s) ?? 0) + 1); }
    for (const { k, v } of cells) { const s = norm(v); if (s !== null && seen.get(s)! > 1) set(k, hl); }
    return;
  }
  for (const { k, v } of cells) {
    if (v === undefined || v === '' || isError(v)) continue;
    let hit = false;
    if (rule.kind === 'contains') hit = String(v).toLowerCase().includes(String(rule.a ?? '').toLowerCase()) && !!rule.a;
    else if (rule.kind === 'equal') hit = typeof v === 'string' && typeof a === 'string' ? v.toLowerCase() === a.toLowerCase() : v === a;
    else if (typeof v === 'number' && typeof a === 'number') {
      if (rule.kind === 'greater') hit = v > a;
      else if (rule.kind === 'less') hit = v < a;
      else if (rule.kind === 'between' && typeof b === 'number') hit = v >= Math.min(a, b) && v <= Math.max(a, b);
    }
    if (hit) set(k, hl);
  }
}
