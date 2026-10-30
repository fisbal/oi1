// Find and replace in every file of the project at once, with regex, case and whole-word options.

import { type Files, isBinary } from './build';

export interface SearchOptions { regex: boolean; caseSensitive: boolean; wholeWord: boolean }
export interface Match { path: string; line: number; col: number; from: number; to: number; text: string }

export const MAX_MATCHES = 2000;

/** The pattern for a query, or null when the regex is not valid yet (while typing). */
export function patternOf(query: string, o: SearchOptions): RegExp | null {
  if (!query) return null;
  let src = o.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (o.wholeWord) src = `\\b(?:${src})\\b`;
  try { return new RegExp(src, o.caseSensitive ? 'g' : 'gi'); } catch { return null; }
}

export function searchFiles(files: Files, query: string, o: SearchOptions): Match[] {
  const re = patternOf(query, o);
  if (!re) return [];
  const out: Match[] = [];
  for (const path of Object.keys(files).sort()) {
    const text = files[path];
    if (isBinary(text)) continue;
    let lineStart = 0, line = 1, scanned = 0;
    for (const m of text.matchAll(re)) {
      if (!m[0].length) continue;
      for (; scanned < m.index; scanned++) if (text[scanned] === '\n') { line++; lineStart = scanned + 1; }
      const end = text.indexOf('\n', m.index);
      out.push({ path, line, col: m.index - lineStart + 1, from: m.index, to: m.index + m[0].length, text: text.slice(lineStart, end < 0 ? text.length : end) });
      if (out.length >= MAX_MATCHES) return out;
    }
  }
  return out;
}

/** Replaces every match in every file (or only in `only`); $1, $2… work with regex. Returns the new files and the count. */
export function replaceInFiles(files: Files, query: string, replacement: string, o: SearchOptions, only?: Set<string>): { files: Files; count: number } {
  const re = patternOf(query, o);
  if (!re) return { files, count: 0 };
  let count = 0;
  const next: Files = { ...files };
  for (const path of Object.keys(files)) {
    if ((only && !only.has(path)) || isBinary(files[path])) continue;
    const text = files[path];
    const out = text.replace(re, (...args) => {
      const m = args[0] as string;
      if (!m.length) return m;
      count++;
      return o.regex ? m.replace(new RegExp(re.source, re.flags.replace('g', '')), replacement) : replacement;
    });
    if (out !== text) next[path] = out;
  }
  return { files: next, count };
}
