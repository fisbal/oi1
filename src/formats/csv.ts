// CSV and tab-separated text, the plain way sheets travel between apps (and the clipboard).

/** Splits CSV text into rows of fields. The separator (comma, semicolon or tab) is guessed when not given. */
export function parseCsv(text: string, sep?: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const d = sep ?? guessSeparator(src);
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === d) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function guessSeparator(text: string): string {
  const head = text.split(/\r?\n/, 5).join('\n');
  const counts = ['\t', ';', ','].map(c => [c, head.split(c).length - 1] as const).sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

/** Rows of fields as CSV text; quotes fields that need it. */
export function toCsv(rows: string[][], sep = ','): string {
  const q = (f: string) => (/["\r\n]/.test(f) || f.includes(sep) || /^\s|\s$/.test(f) ? `"${f.replace(/"/g, '""')}"` : f);
  return rows.map(r => r.map(q).join(sep)).join('\r\n');
}
