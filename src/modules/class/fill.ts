// The fill handle: drag the small square at the corner of a selection to continue it, like Excel's AutoFill.
// 1, 2 → 3, 4, 5 · Monday → Tuesday · Jan → Feb · Q1 → Q2 · Item 1 → Item 2 · dates by day · formulas follow.

import { moveRefs } from '../../formats/formula';
import { key, literal, type Cell } from '../../formats/sheet';

const LISTS: string[][] = [
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
  ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
  ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'],
  ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'],
  ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'],
];

/** Writes `word` with the same capitals as `like`: MONDAY, Monday or monday. */
function caseLike(word: string, like: string) {
  if (like === like.toUpperCase()) return word.toUpperCase();
  if (like[0] === like[0].toUpperCase()) return word[0].toUpperCase() + word.slice(1);
  return word;
}

/** The next values after a run of cells, as the fill handle makes them. `step` counts from the end of the run. */
export function continueRun(run: Cell[], step: number, origin: number, at: number, axis: 'r' | 'c'): Cell {
  const n = run.length;
  const src = run[((step - 1) % n + n) % n] ?? { input: '' };
  // Formulas: the references move with the cell, like a copy.
  if (src.input.startsWith('=')) {
    const from = origin + (((step - 1) % n) + n) % n;
    const d = at - from;
    return { ...src, input: moveRefs(src.input, (c, r, absC, absR) => (axis === 'r' ? { c, r: absR ? r : r + d } : { c: absC ? c : c + d, r })) };
  }
  const values = run.map(c => literal(c.input));
  // Numbers: a series with the run's step (one number alone counts up by 1, like Excel's Ctrl-drag; dates go day by day).
  if (values.every(v => typeof v === 'number') && n >= 1) {
    const nums = values as number[];
    let delta: number;
    if (n === 1) delta = 1;
    else {
      // A straight line through the run (Excel's linear trend).
      const mx = (n - 1) / 2, my = nums.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      nums.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2; });
      delta = den ? num / den : 0;
    }
    const next = nums[n - 1] + delta * step;
    return { ...run[n - 1], input: String(Number(next.toPrecision(15))) };
  }
  // Text ending in a number: Item 1, Item 2… (also Q1, Q2).
  const m = /^(.*?)(\d+)$/.exec(src.input);
  const last = /^(.*?)(\d+)$/.exec(run[n - 1].input);
  if (m && last && run.every(c => /^(.*?)(\d+)$/.exec(c.input)?.[1] === m[1])) {
    const first = Number(/^(.*?)(\d+)$/.exec(run[0].input)![2]);
    const delta = n > 1 ? (Number(last[2]) - first) / (n - 1) : 1;
    const num = Math.round(Number(last[2]) + delta * step);
    return { ...run[n - 1], input: `${last[1]}${num < 0 ? num : String(num).padStart(last[2].length, '0')}` };
  }
  // Day and month names, in any of OI1's languages.
  const lower = run[n - 1].input.trim().toLowerCase();
  for (const list of LISTS) {
    const i = list.indexOf(lower);
    if (i < 0 || !run.every(c => list.includes(c.input.trim().toLowerCase()))) continue;
    const first = list.indexOf(run[0].input.trim().toLowerCase());
    const delta = n > 1 ? ((i - first) / (n - 1)) || 1 : 1;
    const j = (((i + Math.round(delta * step)) % list.length) + list.length) % list.length;
    return { ...run[n - 1], input: caseLike(list[j], run[n - 1].input.trim()) };
  }
  // Anything else repeats.
  return { ...src };
}

export interface Box { c1: number; r1: number; c2: number; r2: number }

/**
 * Fills `to` (which contains `from`) from the cells in `from`, like dragging the fill handle.
 * Returns the cells to write, by key; empty source cells clear their targets.
 */
export function autofill(cells: Record<string, Cell>, from: Box, to: Box): Record<string, Cell | null> {
  const out: Record<string, Cell | null> = {};
  const down = to.r2 > from.r2, up = to.r1 < from.r1, right = to.c2 > from.c2, left = to.c1 < from.c1;
  if (down || up) {
    for (let c = from.c1; c <= from.c2; c++) {
      const run = Array.from({ length: from.r2 - from.r1 + 1 }, (_, i) => cells[key(c, from.r1 + i)] ?? { input: '' });
      if (down) for (let r = from.r2 + 1, s = 1; r <= to.r2; r++, s++) out[key(c, r)] = fillCell(run, s, from.r1, r, 'r');
      if (up) {
        const back = [...run].reverse();
        for (let r = from.r1 - 1, s = 1; r >= to.r1; r--, s++) out[key(c, r)] = fillCell(back, s, from.r2, r, 'r', true);
      }
    }
  } else if (right || left) {
    for (let r = from.r1; r <= from.r2; r++) {
      const run = Array.from({ length: from.c2 - from.c1 + 1 }, (_, i) => cells[key(from.c1 + i, r)] ?? { input: '' });
      if (right) for (let c = from.c2 + 1, s = 1; c <= to.c2; c++, s++) out[key(c, r)] = fillCell(run, s, from.c1, c, 'c');
      if (left) {
        const back = [...run].reverse();
        for (let c = from.c1 - 1, s = 1; c >= to.c1; c--, s++) out[key(c, r)] = fillCell(back, s, from.c2, c, 'c', true);
      }
    }
  }
  return out;
}

function fillCell(run: Cell[], step: number, origin: number, at: number, axis: 'r' | 'c', backwards = false): Cell | null {
  const n = run.length;
  const src = run[(step - 1) % n];
  if (!src.input && !src.style) return null;
  // Going up or left, a formula's source sits below or right of its target.
  if (backwards && src.input.startsWith('=')) {
    const from = origin - ((step - 1) % n);
    const d = at - from;
    return { ...src, input: moveRefs(src.input, (c, r, absC, absR) => (axis === 'r' ? { c, r: absR ? r : r + d } : { c: absC ? c : c + d, r })) };
  }
  return continueRun(run, step, origin, at, axis);
}
