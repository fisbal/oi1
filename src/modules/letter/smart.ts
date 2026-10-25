// Office Letter's smart tools, the ones Word hides or does not have: linked tables with Office Class,
// one-click clean up, sorting, text to table, a table of contents, callouts, letter blocks and QR codes.

import type { Editor, JSONContent } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { TableData } from '../../shell/contract';
import { t } from '../../shell/i18n';

// ---------- tables shared with Office Class ----------

/** The table around the cursor and where it starts, or null. */
export function tableAt(editor: Editor): { node: PMNode; pos: number } | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'table') return { node, pos: $from.before(d) };
  }
  return null;
}

export function findLinkedTable(doc: PMNode, id: string): { node: PMNode; pos: number } | null {
  let found: { node: PMNode; pos: number } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === 'table' && node.attrs.link === id) { found = { node, pos }; return false; }
    return true;
  });
  return found;
}

export function tableData(table: PMNode): TableData {
  const rows: TableData['rows'] = [];
  let header = false;
  table.forEach((row, _, r) => {
    const out: TableData['rows'][number] = [];
    row.forEach(cell => {
      const text: string[] = [];
      cell.forEach(block => text.push(block.textContent));
      let bold = cell.type.name === 'tableHeader';
      if (!bold) {
        let all = cell.textContent.length > 0;
        cell.descendants(n => { if (n.isText && !n.marks.some(m => m.type.name === 'bold')) all = false; });
        bold = all;
      }
      if (cell.type.name === 'tableHeader' && r === 0) header = true;
      out.push({ text: text.join('\n'), ...(cell.attrs.formula ? { formula: cell.attrs.formula as string } : {}), ...(bold ? { bold: true } : {}) });
      for (let span = (cell.attrs.colspan as number) ?? 1; span > 1; span--) out.push({ text: '' });
    });
    rows.push(out);
  });
  return { rows, header };
}

/** A letter table made from shared table data. Numbers line up on the right, like in the sheet. */
export function tableJson(data: TableData, attrs: Record<string, unknown> = {}): JSONContent {
  const width = Math.max(1, ...data.rows.map(r => r.length));
  return {
    type: 'table',
    attrs,
    content: data.rows.map((row, r) => ({
      type: 'tableRow',
      content: Array.from({ length: width }, (_, c) => {
        const cell = row[c] ?? { text: '' };
        const isNumber = /^[-+(]?[$€£¥]?\s?[\d.,\s  ]+\s?[%$€£¥]?\)?$/.test(cell.text.trim()) && /\d/.test(cell.text);
        const head = data.header && r === 0;
        const lines = cell.text.split('\n');
        return {
          type: head ? 'tableHeader' : 'tableCell',
          attrs: cell.formula ? { formula: cell.formula } : {},
          content: lines.map(line => ({
            type: 'paragraph',
            attrs: isNumber && !head ? { textAlign: 'right' } : {},
            content: line ? [{ type: 'text', text: line, ...(cell.bold && !head ? { marks: [{ type: 'bold' }] } : {}) }] : [],
          })),
        };
      }),
    })),
  };
}

/** Swaps a table for new data, keeping its link. */
export function replaceTable(editor: Editor, at: { node: PMNode; pos: number }, data: TableData) {
  const json = tableJson(data, { ...at.node.attrs });
  const node = editor.schema.nodeFromJSON(json);
  editor.view.dispatch(editor.state.tr.replaceWith(at.pos, at.pos + at.node.nodeSize, node));
}

// ---------- text tools ----------

export type CleanUp = 'quotes' | 'spaces' | 'empty' | 'all';

/** Fixes typing in the whole letter: smart quotes, double spaces, spaces before punctuation, empty lines. */
export function cleanUp(editor: Editor, what: CleanUp, lang: string): number {
  const { state } = editor;
  const tr = state.tr;
  let changes = 0;
  const fr = lang.startsWith('fr');
  const [open2, close2] = fr ? ['«\u202f', '\u202f»'] : lang.startsWith('de') ? ['„', '“'] : lang.startsWith('es') || lang.startsWith('pt') ? ['«', '»'] : ['“', '”'];
  const fixText = (s: string) => {
    let out = s;
    if (what === 'spaces' || what === 'all') out = out.replace(/ {2,}/g, ' ').replace(/ +([,.;:!?)])/g, (_m, p) => (fr && /[;:!?]/.test(p) ? ` ${p}` : p));
    if (what === 'quotes' || what === 'all') {
      out = out.replace(/(^|[\s([{])"/g, `$1${open2}`).replace(/"/g, close2)
        .replace(/(\p{L})'(\p{L})/gu, '$1’$2').replace(/(^|[\s([{])'/g, '$1‘').replace(/'/g, '’')
        .replace(/--/g, '–').replace(/\.\.\./g, '…');
    }
    return out;
  };
  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const next = fixText(node.text);
    if (next !== node.text) {
      const from = tr.mapping.map(pos), to = tr.mapping.map(pos + node.text.length);
      tr.replaceWith(from, to, state.schema.text(next, node.marks));
      changes++;
    }
  });
  if (what === 'empty' || what === 'all') {
    // Two empty paragraphs in a row become one.
    const empties: number[] = [];
    let lastEmpty = false;
    state.doc.forEach((node, offset) => {
      const empty = node.type.name === 'paragraph' && node.childCount === 0;
      if (empty && lastEmpty) empties.push(offset);
      lastEmpty = empty;
    });
    for (const pos of empties.reverse()) {
      const from = tr.mapping.map(pos);
      tr.delete(from, from + 2);
      changes++;
    }
  }
  if (changes) editor.view.dispatch(tr);
  return changes;
}

/** Sorts the selected paragraphs or list items A to Z (or Z to A), like Word's Sort. */
export function sortSelection(editor: Editor, dir: 1 | -1, lang: string): boolean {
  const { state } = editor;
  const { from, to, $from } = state.selection;
  // Inside a list: sort the list's items.
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
      const items: PMNode[] = [];
      node.forEach(n => items.push(n));
      items.sort((a, b) => a.textContent.localeCompare(b.textContent, lang, { numeric: true }) * dir);
      const pos = $from.before(d);
      editor.view.dispatch(state.tr.replaceWith(pos, pos + node.nodeSize, node.type.create(node.attrs, items)));
      return true;
    }
  }
  const blocks: { node: PMNode; pos: number }[] = [];
  state.doc.forEach((node, pos) => {
    if (pos + node.nodeSize > from && pos < to && node.isTextblock) blocks.push({ node, pos });
  });
  if (blocks.length < 2) return false;
  const start = blocks[0].pos, end = blocks[blocks.length - 1].pos + blocks[blocks.length - 1].node.nodeSize;
  const sorted = [...blocks].sort((a, b) => a.node.textContent.localeCompare(b.node.textContent, lang, { numeric: true }) * dir).map(b => b.node);
  editor.view.dispatch(state.tr.replaceWith(start, end, sorted));
  return true;
}

/** Turns the selected lines into a table, splitting on tabs, semicolons or commas. */
export function textToTable(editor: Editor): boolean {
  const { state } = editor;
  const { from, to } = state.selection;
  const blocks: { node: PMNode; pos: number }[] = [];
  state.doc.forEach((node, pos) => {
    if (pos + node.nodeSize > from && pos < to && node.type.name === 'paragraph') blocks.push({ node, pos });
  });
  if (!blocks.length) return false;
  const lines = blocks.map(b => b.node.textContent);
  const sep = lines.some(l => l.includes('\t')) ? '\t' : lines.some(l => l.includes(';')) ? ';' : ',';
  const rows = lines.map(l => l.split(sep).map(s => ({ text: s.trim() })));
  const start = blocks[0].pos, end = blocks[blocks.length - 1].pos + blocks[blocks.length - 1].node.nodeSize;
  editor.chain().insertContentAt({ from: start, to: end }, tableJson({ rows })).run();
  return true;
}

/** Turns the table at the cursor back into lines of text separated by tabs. */
export function tableToText(editor: Editor): boolean {
  const at = tableAt(editor);
  if (!at) return false;
  const data = tableData(at.node);
  const paras = data.rows.map(r => ({ type: 'paragraph', content: r.some(c => c.text) ? [{ type: 'text', text: r.map(c => c.text.replace(/\n/g, ' ')).join('\t') }] : [] }));
  editor.chain().insertContentAt({ from: at.pos, to: at.pos + at.node.nodeSize }, paras).run();
  return true;
}

// ---------- table of contents ----------

/** A table of contents from the headings, with the page each one is on, as a table without lines. */
export function tocJson(editor: Editor, pageOf: (pos: number) => number | null, contentWidth: number): JSONContent[] | null {
  const rows: { level: number; text: string; page: number | null }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading' && node.attrs.level <= 3 && node.textContent.trim()) {
      rows.push({ level: node.attrs.level as number, text: node.textContent.trim(), page: pageOf(pos + 1) });
    }
    return node.type.name !== 'table';
  });
  if (!rows.length) return null;
  const pageCol = 56;
  return [
    { type: 'paragraph', attrs: { styleId: 'title' }, content: [{ type: 'text', text: t('letter.toc.title') }] },
    {
      type: 'table',
      attrs: { borders: 'none' },
      content: rows.map(r => ({
        type: 'tableRow',
        content: [
          { type: 'tableCell', attrs: { colwidth: [Math.round(contentWidth - pageCol)] }, content: [{ type: 'paragraph', attrs: { indentLeft: (r.level - 1) * 14 || null, spaceAfter: 2 }, content: [{ type: 'text', text: r.text, ...(r.level === 1 ? { marks: [{ type: 'bold' }] } : {}) }] }] },
          { type: 'tableCell', attrs: { colwidth: [pageCol] }, content: [{ type: 'paragraph', attrs: { textAlign: 'right', spaceAfter: 2 }, content: r.page ? [{ type: 'text', text: String(r.page) }] : [] }] },
        ],
      })),
    },
    { type: 'paragraph' },
  ];
}

// ---------- quick blocks ----------

export type CalloutKind = 'note' | 'tip' | 'warning' | 'success' | 'gold';
const CALLOUTS: Record<CalloutKind, { light: string; dark: string; line: string; icon: string }> = {
  note: { light: '#EAF2FC', dark: '#16263A', line: '#4472C4', icon: 'ℹ' },
  tip: { light: '#EAF7F1', dark: '#14302A', line: '#2E9E6A', icon: '✦' },
  warning: { light: '#FFF4E5', dark: '#3A2A12', line: '#E08A1E', icon: '⚠' },
  success: { light: '#EDF7E7', dark: '#1F3318', line: '#5A9E2E', icon: '✓' },
  gold: { light: '#FBF3DD', dark: '#2A2312', line: '#D4A843', icon: '★' },
};

/** A colored box with a strong left line, made of Word paragraph shading and borders. */
export function calloutJson(kind: CalloutKind, dark: boolean): JSONContent {
  const c = CALLOUTS[kind];
  const attrs = {
    background: dark ? c.dark : c.light,
    borders: { left: { w: 4.5, color: c.line, space: 10 }, top: { w: 0.5, color: dark ? c.dark : c.light, space: 6 }, bottom: { w: 0.5, color: dark ? c.dark : c.light, space: 6 }, right: { w: 0.5, color: dark ? c.dark : c.light, space: 10 } },
    spaceBefore: 6, spaceAfter: 10,
  };
  return { type: 'paragraph', attrs, content: [{ type: 'text', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: c.line } }], text: `${c.icon} ${t(`letter.callout.${kind}`)}: ` }] };
}

/** The parts of a formal letter, with placeholders to type over. */
export function letterBlockJson(kind: 'full' | 'closing', lang: string): JSONContent[] {
  const lines = (s: string, align?: string) => s.split('\n').map(text => ({ type: 'paragraph', attrs: { spaceAfter: 0, ...(align ? { textAlign: align } : {}) }, content: text ? [{ type: 'text', text }] : [] }));
  const date = new Date().toLocaleDateString(lang || undefined, { dateStyle: 'long' });
  const closing = [
    { type: 'paragraph' },
    ...lines(t('letter.tpl.closing')),
    { type: 'paragraph' }, { type: 'paragraph' },
    { type: 'paragraph', attrs: { borders: { top: { w: 0.75, color: '#7F7F7F', space: 1 } }, indentRight: 260, spaceAfter: 0 }, content: [{ type: 'text', text: t('letter.tpl.signature') }] },
  ];
  if (kind === 'closing') return closing;
  return [
    ...lines(t('letter.tpl.sender')),
    { type: 'paragraph' },
    ...lines(date, 'right'),
    { type: 'paragraph' },
    ...lines(t('letter.tpl.recipient')),
    { type: 'paragraph' },
    { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: t('letter.tpl.subject') }] },
    { type: 'paragraph' },
    { type: 'paragraph', content: [{ type: 'text', text: t('letter.tpl.greeting') }] },
    { type: 'paragraph', content: [{ type: 'text', text: t('letter.tpl.body') }] },
    ...closing,
  ];
}

export { qrDataUrl } from '../../ui/qr';

// ---------- reading ----------

/** Reading and speaking time, and sentence length, for the word count and status bar. */
export function readingStats(text: string) {
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
  const sentences = Math.max(words ? 1 : 0, text.split(/[.!?…]+(\s|$)/).filter(s => /\p{L}/u.test(s)).length);
  return {
    words,
    sentences,
    perSentence: sentences ? Math.round((words / sentences) * 10) / 10 : 0,
    readMinutes: Math.max(words ? 1 : 0, Math.round(words / 238)),
    speakMinutes: Math.max(words ? 1 : 0, Math.round(words / 150)),
  };
}

/** Table looks for Table > Table Styles: a header row color and banded rows, made of cell shading so they save to .docx. */
export const TABLE_STYLES = {
  grid: { head: null, band: null, borders: null },
  gold: { head: '#E9CF8A', band: '#FBF3DD', borders: null },
  blue: { head: '#BDD7EE', band: '#EAF2FA', borders: null },
  green: { head: '#C6E0B4', band: '#EDF6E8', borders: null },
  rose: { head: '#F4C7C3', band: '#FCEDEB', borders: null },
  gray: { head: '#D9D9D9', band: '#F2F2F2', borders: null },
  clean: { head: '#F2F2F2', band: null, borders: 'none' },
} as const;
export type TableStyleId = keyof typeof TABLE_STYLES;

export function applyTableStyle(editor: Editor, id: TableStyleId): boolean {
  const at = tableAt(editor);
  if (!at) return false;
  const look = TABLE_STYLES[id];
  const tr = editor.state.tr;
  tr.setNodeMarkup(at.pos, undefined, { ...at.node.attrs, borders: look.borders });
  at.node.forEach((row, rowOffset, r) => {
    row.forEach((cell, cellOffset) => {
      const pos = at.pos + 1 + rowOffset + 1 + cellOffset;
      const background = r === 0 ? look.head : r % 2 === 0 ? look.band : null;
      tr.setNodeMarkup(pos, undefined, { ...cell.attrs, background });
    });
  });
  editor.view.dispatch(tr);
  return true;
}
