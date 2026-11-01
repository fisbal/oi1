// "Convert a file…": any file read into the same shape the apps give (HTML, tables, deck or workbook), so it can be
// turned into every target without opening it first. Word, Markdown, text, web pages, Excel, CSV, PowerPoint, JSON
// and code files.

import type { OpenedFile, TableData } from '../../shell/contract';
import { translateDeck, type ConvertSource } from '../../shell/convert';
import type { TranslateTexts } from '../../shell/translate';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tableHtml = (t: TableData) => `<table>${t.rows.map((r, i) => `<tr>${r.map(c => (i === 0 && t.header ? `<th>${esc(c.text)}</th>` : `<td>${esc(c.text)}</td>`)).join('')}</tr>`).join('')}</table>`;

export const CONVERT_FILE_TYPES = ['.docx', '.md', '.markdown', '.txt', '.html', '.htm', '.xlsx', '.csv', '.tsv', '.pptx', '.json', '.xml',
  '.js', '.ts', '.py', '.css', '.java', '.c', '.cpp', '.go', '.rs', '.php', '.sql', '.yaml', '.yml'];

export async function fileSource(file: OpenedFile, lang: string, currency = 'EUR'): Promise<ConvertSource> {
  const name = file.name.replace(/\.[^.]+$/, '');
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const base = { appId: 'file' as const, title: () => name };

  if (ext === 'docx') {
    const [{ readDocx }, { generateHTML }, { letterExtensions }] = await Promise.all([
      import('../../modules/letter/docx/read'), import('@tiptap/core'), import('../../modules/letter/setup'),
    ]);
    const doc = await readDocx(await file.arrayBuffer());
    const html = generateHTML(doc.body, letterExtensions('body'));
    const { tablesInHtml } = await import('../../formats/textFormats');
    const tables = tablesInHtml(html).map((table, i) => ({ name: `${name} ${i + 1}`, table }));
    return { ...base, html: () => html, tables: () => tables, native: { docx: async tr => (tr ? undefined : new Blob([await file.arrayBuffer()], { type: file.type })) } };
  }
  if (ext === 'xlsx') {
    const [{ readXlsx }, { computeBook, usedRange }, { sheetToTable }] = await Promise.all([
      import('../../formats/xlsx'), import('../../formats/sheet'), import('../../formats/table'),
    ]);
    const book = await readXlsx(await file.arrayBuffer());
    const values = computeBook(book);
    const tables = book.sheets.map((s, i) => {
      const u = usedRange(s);
      return { name: s.name, table: sheetToTable(s, { c1: 0, r1: 0, c2: Math.max(0, u.cols), r2: Math.max(0, u.rows) }, values[i], lang, book.currency ?? currency) };
    });
    return { ...base, html: () => tables.map(t => `<h2>${esc(t.name)}</h2>${tableHtml(t.table)}`).join(''), tables: () => tables, book: async () => book };
  }
  if (ext === 'pptx') {
    const [{ readPptx }, { outlineHtml }] = await Promise.all([import('../../formats/pptx'), import('../../formats/deckText')]);
    const deck = await readPptx(await file.arrayBuffer());
    const tables = deck.slides.flatMap(s => s.items).filter(i => i.kind === 'table')
      .map((it, i) => ({ name: `${name} ${i + 1}`, table: { rows: (it as { rows: string[][] }).rows.map(r => r.map(text => ({ text }))), header: true } }));
    return { ...base, html: () => outlineHtml(deck, name), tables: () => tables, deck: async (tr: TranslateTexts | null) => (tr ? translateDeck(deck, tr) : deck) };
  }
  const text = await file.text();
  if (ext === 'csv' || ext === 'tsv') {
    const { parseCsv } = await import('../../formats/csv');
    const rows = parseCsv(text, ext === 'tsv' ? '\t' : undefined);
    const table: TableData = { rows: rows.map(r => r.map(t => ({ text: t }))), header: true };
    return { ...base, html: () => tableHtml(table), tables: () => [{ name, table }] };
  }
  if (ext === 'json') {
    try {
      const data = JSON.parse(text) as unknown;
      if (Array.isArray(data) && data.length && data.every(r => r && typeof r === 'object' && !Array.isArray(r))) {
        const keys = [...new Set(data.flatMap(r => Object.keys(r as object)))];
        const table: TableData = { header: true, rows: [keys.map(k => ({ text: k, bold: true })), ...data.map(r => keys.map(k => ({ text: String((r as Record<string, unknown>)[k] ?? '') })))] };
        return { ...base, html: () => tableHtml(table), tables: () => [{ name, table }] };
      }
    } catch { /* not JSON: shown as code */ }
  }
  if (ext === 'md' || ext === 'markdown') {
    const { markdownToHtml } = await import('../markdown');
    const html = markdownToHtml(text);
    return { ...base, html: () => html, tables: () => [] };
  }
  if (ext === 'html' || ext === 'htm') {
    const body = new DOMParser().parseFromString(text, 'text/html').body;
    body.querySelectorAll('script, style, noscript').forEach(e => e.remove());
    const html = body.innerHTML;
    const { tablesInHtml } = await import('../../formats/textFormats');
    return { ...base, html: () => html, tables: () => tablesInHtml(html).map((table, i) => ({ name: `${name} ${i + 1}`, table })) };
  }
  if (ext === 'txt') {
    const html = text.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    return { ...base, html: () => html, tables: () => [] };
  }
  // Code: shown as code, kept as it is.
  return { ...base, html: () => `<h1>${esc(file.name)}</h1><pre><code>${esc(text)}</code></pre>`, tables: () => [], text: () => text };
}
