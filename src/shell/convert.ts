// The Convert tab, the same in every app (Martin, 2026-11-01: "La conversion devrait être possible avec tous les
// Offices", and "je parle aussi de la conversion en différente langue"). Each app gives a ConvertSource: its document
// as HTML, its tables, and the better outputs it can make itself (Letter's Word file with its page layout, Stage's
// PowerPoint with its design, Class's Excel file with formulas). This engine turns it into 25 targets: the other
// Offices, documents, data, slides, images and sharing, and, when a language is picked, translates the words first
// (only the words: layout, numbers, formulas and code stay). The person's own document is never changed by a
// conversion; "Translate here" uses the shell's translation, which always keeps the original (rule 13).

import type { OpenedFile, ShellApi, TableData } from './contract';
import { translateHtml, type TranslateTexts } from './translate';
import type { Deck, Slide, TableItem } from '../formats/slides';
import type { WorkbookData } from '../formats/sheet';

export type TargetId =
  | 'letter' | 'class' | 'stage' | 'code'
  | 'docx' | 'pdf' | 'pdfimg' | 'html' | 'md' | 'txt' | 'rtf' | 'epub'
  | 'xlsx' | 'csv' | 'tsv' | 'json' | 'xml'
  | 'pptx'
  | 'png' | 'jpeg' | 'webp' | 'svg'
  | 'email' | 'copy' | 'print';

export type TargetGroup = 'apps' | 'docs' | 'data' | 'slides' | 'images' | 'share';
export interface Target { id: TargetId; group: TargetGroup; icon: string; ext?: string }

export const TARGETS: Target[] = [
  { id: 'letter', group: 'apps', icon: 'letter' },
  { id: 'class', group: 'apps', icon: 'sheet' },
  { id: 'stage', group: 'apps', icon: 'stage' },
  { id: 'code', group: 'apps', icon: 'code' },
  { id: 'docx', group: 'docs', icon: 'letter', ext: 'docx' },
  { id: 'pdf', group: 'docs', icon: 'pdf', ext: 'pdf' },
  { id: 'pdfimg', group: 'docs', icon: 'pdf', ext: 'pdf' },
  { id: 'html', group: 'docs', icon: 'web', ext: 'html' },
  { id: 'md', group: 'docs', icon: 'file', ext: 'md' },
  { id: 'txt', group: 'docs', icon: 'lines', ext: 'txt' },
  { id: 'rtf', group: 'docs', icon: 'file', ext: 'rtf' },
  { id: 'epub', group: 'docs', icon: 'book', ext: 'epub' },
  { id: 'xlsx', group: 'data', icon: 'sheet', ext: 'xlsx' },
  { id: 'csv', group: 'data', icon: 'texttable', ext: 'csv' },
  { id: 'tsv', group: 'data', icon: 'texttable', ext: 'tsv' },
  { id: 'json', group: 'data', icon: 'code', ext: 'json' },
  { id: 'xml', group: 'data', icon: 'code', ext: 'xml' },
  { id: 'pptx', group: 'slides', icon: 'stage', ext: 'pptx' },
  { id: 'png', group: 'images', icon: 'image', ext: 'png' },
  { id: 'jpeg', group: 'images', icon: 'image', ext: 'jpg' },
  { id: 'webp', group: 'images', icon: 'image', ext: 'webp' },
  { id: 'svg', group: 'images', icon: 'diagram', ext: 'svg' },
  { id: 'email', group: 'share', icon: 'envelope' },
  { id: 'copy', group: 'share', icon: 'copy' },
  { id: 'print', group: 'share', icon: 'print' },
];

export const MIME: Partial<Record<TargetId, string>> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf', pdfimg: 'application/pdf',
  html: 'text/html', md: 'text/markdown', txt: 'text/plain', rtf: 'application/rtf', epub: 'application/epub+zip',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv', tsv: 'text/tab-separated-values',
  json: 'application/json', xml: 'application/xml', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml',
};

/** Languages a conversion can translate into (more than 20), by their codes. Names come from the browser. */
export const CONVERT_LANGS = [
  'fr', 'en', 'es', 'pt', 'de', 'it', 'nl', 'pl', 'ro', 'ru', 'uk', 'tr', 'el', 'sv', 'da', 'no', 'fi', 'cs', 'hu',
  'ar', 'he', 'fa', 'hi', 'bn', 'ur', 'zh', 'ja', 'ko', 'vi', 'th', 'id', 'ms', 'sw', 'ln', 'yo', 'ha', 'am', 'wo',
] as const;
export function langLabel(code: string, ui: string): string {
  try {
    const name = new Intl.DisplayNames([ui], { type: 'language' }).of(code);
    const own = new Intl.DisplayNames([code], { type: 'language' }).of(code);
    const cap = (s: string) => s.charAt(0).toLocaleUpperCase(ui) + s.slice(1);
    return name && own && own.toLowerCase() !== name.toLowerCase() ? `${cap(name)} · ${own}` : cap(name ?? code);
  } catch { return code; }
}

// ---------- what an app gives ----------

/** Pages drawn on screen (out of sight) for images and image PDFs; `done` removes them. */
export interface Pages { nodes: HTMLElement[]; width: number; height: number; done(): void }

export interface ConvertSource {
  appId: 'letter' | 'class' | 'stage' | 'code' | 'draw' | 'notes' | 'plan' | 'form' | 'mail' | 'file';
  title(): string;
  /** The document as HTML (body content). */
  html(): string;
  /** Styles for that HTML when drawn as pages or a web page; selectors start with `.cv-doc`. */
  css?(): string;
  /** Its tables, by name (a sheet's used range, the tables of a letter or a deck). */
  tables(): { name: string; table: TableData }[];
  /** Plain text when the app has a better one than the HTML's words (Code+: the code itself). */
  text?(): string;
  /** Outputs the app makes better itself; `tr` is set when the result must be translated. A Blob is saved, true
   *  means the app did it all (like printing), undefined lets the engine make it. */
  native?: Partial<Record<TargetId, (tr: TranslateTexts | null) => Promise<Blob | true | undefined>>>;
  /** The deck, for PowerPoint and Stage (In 1 Stage itself). */
  deck?(tr: TranslateTexts | null): Promise<Deck>;
  /** The workbook, for Excel and Class (In 1 Class itself). */
  book?(tr: TranslateTexts | null): Promise<WorkbookData>;
  /** The app's own pages for images (slides, sheets); otherwise the HTML is laid out on A4 pages. */
  pages?(tr: TranslateTexts | null): Promise<Pages>;
}

// ---------- translating the parts ----------

const hasWords = (s: string) => /\p{L}{2,}/u.test(s);

/** Tables with their words translated; formulas and numbers stay. */
export async function translateTables(tables: { name: string; table: TableData }[], tr: TranslateTexts) {
  const spots: [number, number, number][] = [];
  const texts: string[] = [];
  tables.forEach((t, i) => t.table.rows.forEach((row, r) => row.forEach((c, k) => {
    if (!c.formula && hasWords(c.text) && !/^[\d\s.,:/%€$£-]+$/.test(c.text)) { spots.push([i, r, k]); texts.push(c.text); }
  })));
  const names = await tr(tables.map(t => t.name));
  const got = texts.length ? await tr(texts) : [];
  const out = tables.map((t, i) => ({ name: names[i] || t.name, table: { ...t.table, rows: t.table.rows.map(r => r.map(c => ({ ...c }))) } }));
  spots.forEach(([i, r, k], n) => { out[i].table.rows[r][k].text = got[n]; });
  return out;
}

/** A deck with the words of every box, table and note translated (design, places and animations stay). */
export async function translateDeck(deck: Deck, tr: TranslateTexts): Promise<Deck> {
  const htmls: string[] = [], cells: string[] = [], notes: string[] = [];
  for (const s of deck.slides) {
    for (const it of s.items) {
      if (it.kind === 'shape') htmls.push(it.html);
      if (it.kind === 'table') it.rows.forEach(r => r.forEach(c => cells.push(c)));
    }
    notes.push(s.notes ?? '');
  }
  const [h2, c2, n2] = await Promise.all([translateHtml(htmls, tr), cells.length ? tr(cells) : [], tr(notes)]);
  let hi = 0, ci = 0;
  const slides: Slide[] = deck.slides.map((s, si) => ({
    ...s,
    notes: n2[si] ?? s.notes,
    items: s.items.map(it => {
      if (it.kind === 'shape') return { ...it, html: h2[hi++] };
      if (it.kind === 'table') return { ...it, rows: it.rows.map(r => r.map(() => c2[ci++])) } as TableItem;
      return it;
    }),
  }));
  return { ...deck, slides };
}

/** A ProseMirror/Tiptap JSON document with the words of its text nodes translated (marks and structure stay). */
export async function translateJson<T>(json: T, tr: TranslateTexts): Promise<T> {
  const copy = JSON.parse(JSON.stringify(json)) as T;
  const nodes: { text: string }[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const o = n as { type?: string; text?: string; content?: unknown[] };
    if (o.type === 'text' && typeof o.text === 'string' && hasWords(o.text)) nodes.push(o as { text: string });
    o.content?.forEach(walk);
  };
  walk(copy);
  if (nodes.length) { const got = await tr(nodes.map(n => n.text)); nodes.forEach((n, i) => { n.text = got[i] || n.text; }); }
  return copy;
}

/** What a conversion works from: the source's parts, translated when a language is picked. */
export interface Prepared { title: string; html: string; tables: { name: string; table: TableData }[]; text: string | null }
export async function prepare(src: ConvertSource, tr: TranslateTexts | null): Promise<Prepared> {
  const title = src.title(), html = src.html(), tables = src.tables(), text = src.text?.() || null;
  if (!tr) return { title, html, tables, text };
  const [t2, h2, tb2] = await Promise.all([tr([title]), translateHtml([html], tr), translateTables(tables, tr)]);
  // Code is not translated: only its comments would be, and they are part of the code.
  return { title: t2[0] || title, html: h2[0], tables: tb2, text };
}

// ---------- building blocks ----------

export const safeName = (s: string) => (s.trim() || 'Document').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);

export function asFile(name: string, blob: Blob): OpenedFile {
  return { name, type: blob.type, text: () => blob.text(), arrayBuffer: () => blob.arrayBuffer() };
}

/** A workbook from tables: one sheet per table. */
export async function bookFromTables(tables: { name: string; table: TableData }[], fallbackText: string): Promise<WorkbookData> {
  const { tableToCells } = await import('../formats/table');
  const used = new Set<string>();
  const sheetName = (n: string, i: number) => {
    let s = (n || `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || `Sheet${i + 1}`;
    while (used.has(s.toLowerCase())) s = `${s.slice(0, 28)} ${i + 1}`;
    used.add(s.toLowerCase());
    return s;
  };
  if (!tables.length) {
    const lines = fallbackText.split('\n').filter(l => l.trim());
    tables = [{ name: 'Sheet1', table: { rows: lines.map(l => l.split('\t').map(text => ({ text }))) } }];
  }
  return {
    sheets: tables.map((t, i) => {
      const w = Math.max(1, ...t.table.rows.map(r => r.length));
      const widths: Record<number, number> = {};
      for (let c = 0; c < w; c++) {
        const longest = Math.max(...t.table.rows.map(r => (r[c]?.text ?? '').length));
        if (longest > 12) widths[c] = Math.min(360, 8 * longest + 16);
      }
      return { name: sheetName(t.name, i), cells: tableToCells(t.table), widths };
    }),
  };
}

/** A deck from the HTML: each heading starts a slide; tables get their own slide. */
export async function deckFromPrepared(p: Prepared): Promise<Deck> {
  const [{ newDeck, newSlide, linesToHtml, newId }, { slidesFromHtml }, { tablesInHtml }] = await Promise.all([
    import('../formats/slides'), import('../formats/deckText'), import('../formats/textFormats'),
  ]);
  const deck = newDeck();
  const title = deck.slides[0];
  title.items = title.items.map(it => (it.kind === 'shape' && it.role === 'title' ? { ...it, html: linesToHtml([p.title], false) } : it));
  const textHtml = p.html.replace(/<table[\s\S]*?<\/table>/gi, '');
  const made = slidesFromHtml(textHtml, deck);
  const tables = p.tables.length ? p.tables : tablesInHtml(p.html).map((table, i) => ({ name: `${i + 1}`, table }));
  const tableSlides = tables.map(t => {
    const s = newSlide('titleOnly', deck);
    s.items = s.items.map(it => (it.kind === 'shape' && it.role === 'title' ? { ...it, html: linesToHtml([t.name], false) } : it));
    const rows = t.table.rows.slice(0, 14).map(r => r.slice(0, 8).map(c => c.text));
    const cols = Math.max(1, ...rows.map(r => r.length));
    const w = Math.round(Math.min(deck.w * 0.9, cols * 200)), h = Math.round(Math.min(deck.h * 0.62, rows.length * 40));
    s.items.push({ id: newId(), kind: 'table', x: Math.round((deck.w - w) / 2), y: Math.round(deck.h * 0.26), w, h, rows: rows.map(r => [...r, ...Array(cols - r.length).fill('')]), header: true, banded: true });
    return s;
  });
  deck.slides = [title, ...made, ...tableSlides];
  return deck;
}

/** A Word file for any HTML, through In 1 Letter's own writer (styles, lists, tables, images). */
export async function docxFromHtml(html: string, title: string): Promise<Blob> {
  const [{ generateJSON }, { letterExtensions }, { letterToDocx }, { emptyDoc }] = await Promise.all([
    import('@tiptap/core'), import('../modules/letter/setup'), import('../modules/letter/docx/write'), import('../modules/letter/model'),
  ]);
  const doc = emptyDoc(title);
  doc.body = generateJSON(html || '<p></p>', letterExtensions('body'));
  return new Blob([await letterToDocx(doc, title)], { type: MIME.docx });
}

export const BASE_CSS = `.cv-doc { font: 11pt/1.45 Calibri, Carlito, "Segoe UI", Arial, sans-serif; color: #111; }
.cv-doc h1 { font-size: 22pt; margin: 0 0 10pt; } .cv-doc h2 { font-size: 16pt; margin: 14pt 0 6pt; } .cv-doc h3 { font-size: 13pt; margin: 12pt 0 4pt; }
.cv-doc p { margin: 0 0 8pt; } .cv-doc table { border-collapse: collapse; margin: 8pt 0; } .cv-doc td, .cv-doc th { border: 1px solid #c8c8c8; padding: 3pt 6pt; vertical-align: top; }
.cv-doc th { background: #f2efe6; } .cv-doc img { max-width: 100%; } .cv-doc pre { font: 9.5pt/1.4 Consolas, "Cousine", monospace; white-space: pre-wrap; background: #f6f6f6; padding: 8pt; border-radius: 6px; }
.cv-doc blockquote { margin: 0 0 8pt 18pt; color: #444; font-style: italic; }`;

export function webPage(title: string, html: string, css: string, lang: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html>\n<html lang="${lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(title)}</title>\n<style>\nbody { margin: 0; background: #fff; }\n.cv-doc { max-width: 820px; margin: 32px auto; padding: 0 20px; }\n${css}\n@media print { .cv-doc { margin: 0; max-width: none; } }\n</style>\n</head>\n<body>\n<main class="cv-doc">\n${html}\n</main>\n</body>\n</html>\n`;
}

/** Which app opens a file, by its extension. */
export function appForFile(name: string): 'letter' | 'class' | 'stage' | 'code' | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['docx', 'doc', 'odt', 'rtf', 'md', 'markdown', 'txt', 'htm', 'html', 'epub'].includes(ext)) return 'letter';
  if (['xlsx', 'xls', 'ods', 'csv', 'tsv'].includes(ext)) return 'class';
  if (['pptx', 'ppt', 'odp'].includes(ext)) return 'stage';
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'json', 'xml', 'css', 'zip', 'java', 'c', 'cpp', 'go', 'rs', 'php', 'sql', 'yaml', 'yml'].includes(ext)) return 'code';
  return null;
}

export type { ShellApi };
