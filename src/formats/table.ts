// Tables passed between apps (see TableData in the module contract): from a sheet range, into a sheet,
// and through the clipboard as HTML or tab-separated text, so they also paste into Word and Excel.

import type { TableData } from '../shell/contract';
import { parseCsv, toCsv } from './csv';
import type { Scalar } from './formula';
import { display, key, type Cell, type SheetData } from './sheet';

export interface Range { c1: number; r1: number; c2: number; r2: number }

/** A block of a sheet as a table: shown values, with formulas kept so the sheet can be rebuilt. */
export function sheetToTable(sheet: SheetData, range: Range, values: Map<string, Scalar>, lang: string, currency: string): TableData {
  const rows: TableData['rows'] = [];
  for (let r = range.r1; r <= range.r2; r++) {
    const row: TableData['rows'][number] = [];
    for (let c = range.c1; c <= range.c2; c++) {
      const cell = sheet.cells[key(c, r)];
      const text = cell ? display(values.get(key(c, r)) ?? '', cell.style, lang, currency) : '';
      row.push({ text, ...(cell?.input.startsWith('=') ? { formula: cell.input } : {}), ...(cell?.style?.bold ? { bold: true } : {}) });
    }
    rows.push(row);
  }
  const first = rows[0] ?? [];
  return { rows, header: first.length > 0 && first.every(c => c.bold || !c.text) && first.some(c => c.text) };
}

/** Cells for a table placed with its top left corner at (c0, r0). */
export function tableToCells(table: TableData, c0 = 0, r0 = 0): Record<string, Cell> {
  const cells: Record<string, Cell> = {};
  table.rows.forEach((row, r) => row.forEach((cell, c) => {
    const bold = cell.bold || (table.header && r === 0);
    const input = cell.formula ?? cell.text;
    if (!input && !bold) return;
    cells[key(c0 + c, r0 + r)] = { input, ...(bold ? { style: { bold: true } } : {}) };
  }));
  return cells;
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML for the clipboard; Word, Excel, Google Docs and In 1 Letter all paste it as a table. */
export function tableToHtml(table: TableData): string {
  const body = table.rows.map((row, r) => `<tr>${row.map(c => {
    const tag = table.header && r === 0 ? 'th' : 'td';
    const text = escHtml(c.text).replace(/\n/g, '<br>');
    return `<${tag}${c.formula ? ` data-formula="${escHtml(c.formula).replace(/"/g, '&quot;')}"` : ''}>${c.bold && tag === 'td' ? `<b>${text}</b>` : text}</${tag}>`;
  }).join('')}</tr>`).join('');
  return `<table>${body}</table>`;
}

export const tableToText = (table: TableData) => toCsv(table.rows.map(r => r.map(c => c.text)), '\t');

/** The first table in some HTML, or null. Formulas come back from OI1's own copies. */
export function tableFromHtml(html: string): TableData | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const el = doc.querySelector('table');
  if (!el) return null;
  const rows: TableData['rows'] = [];
  for (const tr of Array.from(el.querySelectorAll('tr'))) {
    const row: TableData['rows'][number] = [];
    for (const td of Array.from(tr.children) as HTMLElement[]) {
      if (td.tagName !== 'TD' && td.tagName !== 'TH') continue;
      const text = Array.from(td.querySelectorAll('p')).length > 1
        ? Array.from(td.querySelectorAll('p')).map(p => p.textContent ?? '').join('\n')
        : (td.innerText ?? td.textContent ?? '').trim();
      const formula = td.getAttribute('data-formula') ?? undefined;
      const bold = td.tagName === 'TH' || !!td.querySelector('b, strong') || Number(td.style.fontWeight) >= 600;
      row.push({ text: text.trim(), ...(formula ? { formula } : {}), ...(bold ? { bold: true } : {}) });
      for (let span = Number(td.getAttribute('colspan') ?? 1); span > 1; span--) row.push({ text: '' });
    }
    rows.push(row);
  }
  return rows.length ? { rows, header: !!el.querySelector('tr:first-child th') } : null;
}

export function tableFromText(text: string): TableData {
  const rows = parseCsv(text.replace(/\r?\n$/, ''), text.includes('\t') ? '\t' : undefined);
  return { rows: rows.map(r => r.map(t => ({ text: t }))) };
}
