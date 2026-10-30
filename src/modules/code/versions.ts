// Versions of a project, taken before every correction and on demand, so that any change can be taken back:
// the whole project, one file, or only a few lines. The "best version" is the one where the most tests pass
// with the fewest problems; it is always one click away.

import { type Files } from './build';

export interface Score { passed: number; failed: number; errors: number; warnings: number }
export interface Version { id: string; at: number; label: string; files: Files; score?: Score }

const MAX = 30;
const MAX_BYTES = 3_000_000;
const key = (project: string) => `oi1.code.versions.${project || 'untitled'}`;

export function loadVersions(project: string): Version[] {
  try { return JSON.parse(localStorage.getItem(key(project)) ?? '[]') as Version[]; } catch { return []; }
}

/** Keeps the newest versions that fit on the device; the best one is never dropped. */
export function saveVersions(project: string, list: Version[]): Version[] {
  const top = bestVersion(list);
  let kept = list.slice(-MAX);
  if (top && !kept.includes(top)) kept = [top, ...kept.slice(1)];
  while (kept.length > 1 && JSON.stringify(kept).length > MAX_BYTES) {
    const oldest = kept.findIndex(v => v !== top);
    kept = kept.filter((_, i) => i !== oldest);
  }
  try { localStorage.setItem(key(project), JSON.stringify(kept)); } catch { /* full or private: kept in memory only */ }
  return kept;
}

export function newVersion(label: string, files: Files, score?: Score): Version {
  return { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), label, files: { ...files }, score };
}

/** Higher is better: passing tests count most, then errors, then warnings. */
export const points = (s?: Score) => (s ? s.passed * 1000 - s.failed * 1000 - s.errors * 20 - s.warnings : -Infinity);

export function bestVersion(list: Version[]): Version | null {
  let best: Version | null = null;
  for (const v of list) if (v.score && (!best || points(v.score) >= points(best.score))) best = v;
  return best;
}

export const sameFiles = (a: Files, b: Files) => {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => a[k] === b[k]);
};

/** The files that differ between two versions. */
export function changedFiles(a: Files, b: Files): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(p => a[p] !== b[p]).sort();
}

// ---------- line diff ----------

export interface Hunk { aStart: number; aLines: string[]; bStart: number; bLines: string[] }

/** Line differences between `a` and `b` (LCS, with the common start and end trimmed first so big files stay fast). */
export function diffLines(a: string, b: string): Hunk[] {
  const A = a.split('\n'), B = b.split('\n');
  let s = 0; while (s < A.length && s < B.length && A[s] === B[s]) s++;
  let e = 0; while (e < A.length - s && e < B.length - s && A[A.length - 1 - e] === B[B.length - 1 - e]) e++;
  const a2 = A.slice(s, A.length - e), b2 = B.slice(s, B.length - e);
  if (!a2.length && !b2.length) return [];
  if (a2.length * b2.length > 4_000_000) return [{ aStart: s, aLines: a2, bStart: s, bLines: b2 }];
  const n = a2.length, m = b2.length;
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a2[i] === b2[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hunks: Hunk[] = [];
  let i = 0, j = 0, cur: Hunk | null = null;
  const flush = () => { if (cur) { hunks.push(cur); cur = null; } };
  while (i < n || j < m) {
    if (i < n && j < m && a2[i] === b2[j]) { flush(); i++; j++; continue; }
    cur ??= { aStart: s + i, aLines: [], bStart: s + j, bLines: [] };
    if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { cur.bLines.push(b2[j]); j++; } else { cur.aLines.push(a2[i]); i++; }
  }
  flush();
  return hunks;
}

/** Puts one part of `old` back into `now`: the lines of hunk `h` (computed as diffLines(old, now)). */
export function restoreHunk(now: string, h: Hunk): string {
  const B = now.split('\n');
  B.splice(h.bStart, h.bLines.length, ...h.aLines);
  return B.join('\n');
}
