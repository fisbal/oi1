// The References tab beyond Word: citations in 22 styles (APA, MLA, Chicago, IEEE, Vancouver, ISO 690…) kept inside
// the letter itself, a bibliography that follows the chosen style, numbered captions with a table of figures,
// an index built from marked words, and cross-references to headings and captions.

import { Mark, mergeAttributes, type Editor, type JSONContent } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { t, type MessageKey } from '../../shell/i18n';

// ---------- sources ----------

export const SOURCE_KINDS = ['book', 'article', 'web', 'report', 'chapter', 'thesis', 'news', 'law', 'video', 'other'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface Source {
  id: string;
  kind: SourceKind;
  /** People as "Last, First", separated by semicolons. */
  authors: string;
  title: string;
  year: string;
  /** The journal, newspaper, website or book a part comes from. */
  container?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  place?: string;
  url?: string;
  doi?: string;
  accessed?: string;
}

/** One piece of a bibliography entry, in italics or bold where the style asks for it. */
export interface Seg { text: string; italic?: boolean; bold?: boolean }

interface Person { last: string; first: string }
export function people(authors: string): Person[] {
  return authors.split(/\s*;\s*/).map(a => a.trim()).filter(Boolean).map(a => {
    if (a.includes(',')) { const [last, ...rest] = a.split(','); return { last: last.trim(), first: rest.join(',').trim() }; }
    const parts = a.split(/\s+/);
    return parts.length > 1 ? { last: parts.pop()!, first: parts.join(' ') } : { last: a, first: '' };
  });
}
const initials = (first: string, dot = true, space = true) =>
  first.split(/[\s-]+/).filter(Boolean).map(p => p[0].toUpperCase() + (dot ? '.' : '')).join(space && dot ? ' ' : '');

type NameForm = 'lastF' | 'lastFirst' | 'fLast' | 'firstLast' | 'LASTFirst' | 'lastFnodot';
const name = (p: Person, f: NameForm): string => {
  if (!p.first) return f === 'LASTFirst' ? p.last.toUpperCase() : p.last;
  switch (f) {
    case 'lastF': return `${p.last}, ${initials(p.first)}`;
    case 'lastFirst': return `${p.last}, ${p.first}`;
    case 'fLast': return `${initials(p.first)} ${p.last}`;
    case 'firstLast': return `${p.first} ${p.last}`;
    case 'LASTFirst': return `${p.last.toUpperCase()}, ${p.first}`;
    case 'lastFnodot': return `${p.last} ${initials(p.first, false)}`;
  }
};

// ---------- styles ----------

interface StyleDef {
  label: string;
  /** How the text cites: (Author, Year), [1], (1), a superscript number, or a footnote. */
  cite: 'authorYear' | 'authorYearNoComma' | 'author' | 'bracket' | 'paren' | 'super' | 'note';
  /** Names in the list: the first one, then the others. */
  names: [NameForm, NameForm];
  and: string;
  sep: string;
  /** Where the year goes in the list. */
  year: 'afterAuthor' | 'parenAfterAuthor' | 'end' | 'boldEnd' | 'parenEnd';
  /** Article and chapter titles in quotation marks. */
  quote: boolean;
  etAl?: number;
}
const S = (label: string, cite: StyleDef['cite'], names: StyleDef['names'], year: StyleDef['year'], quote: boolean, and = '&', sep = ', ', etAl?: number): StyleDef =>
  ({ label, cite, names, and, sep, year, quote, etAl });

export const CITATION_STYLES = {
  apa: S('APA 7', 'authorYear', ['lastF', 'lastF'], 'parenAfterAuthor', false, '&', ', ', 20),
  mla: S('MLA 9', 'author', ['lastFirst', 'firstLast'], 'end', true, 'and', ', ', 3),
  chicagoAD: S('Chicago (author-date)', 'authorYearNoComma', ['lastFirst', 'firstLast'], 'afterAuthor', true, 'and'),
  chicagoNotes: S('Chicago (notes)', 'note', ['lastFirst', 'firstLast'], 'end', true, 'and'),
  harvard: S('Harvard', 'authorYear', ['lastF', 'lastF'], 'parenAfterAuthor', false, 'and'),
  turabian: S('Turabian', 'authorYearNoComma', ['lastFirst', 'firstLast'], 'afterAuthor', true, 'and'),
  ieee: S('IEEE', 'bracket', ['fLast', 'fLast'], 'end', true, 'and', ', ', 6),
  vancouver: S('Vancouver', 'paren', ['lastFnodot', 'lastFnodot'], 'end', false, ',', ', ', 6),
  ama: S('AMA', 'super', ['lastFnodot', 'lastFnodot'], 'end', false, ',', ', ', 6),
  acs: S('ACS', 'paren', ['lastF', 'lastF'], 'boldEnd', false, ';', '; '),
  nature: S('Nature', 'super', ['lastF', 'lastF'], 'parenEnd', false, '&', ', ', 5),
  science: S('Science', 'paren', ['fLast', 'fLast'], 'parenEnd', false, ',', ', ', 5),
  nlm: S('NLM', 'bracket', ['lastFnodot', 'lastFnodot'], 'end', false, ',', ', '),
  cse: S('CSE', 'paren', ['lastFnodot', 'lastFnodot'], 'end', false, ',', ', ', 10),
  asa: S('ASA', 'authorYearNoComma', ['lastFirst', 'firstLast'], 'afterAuthor', true, 'and'),
  apsa: S('APSA', 'authorYearNoComma', ['lastFirst', 'firstLast'], 'afterAuthor', true, 'and'),
  iso690: S('ISO 690 (author-date)', 'authorYear', ['LASTFirst', 'LASTFirst'], 'afterAuthor', false, 'and'),
  iso690num: S('ISO 690 (numeric)', 'bracket', ['LASTFirst', 'LASTFirst'], 'end', false, 'and'),
  nfz44: S('NF Z44-005 (French)', 'authorYear', ['LASTFirst', 'LASTFirst'], 'end', false, 'et'),
  oscola: S('OSCOLA (law)', 'note', ['firstLast', 'firstLast'], 'parenEnd', true, 'and'),
  bluebook: S('Bluebook (law)', 'note', ['firstLast', 'firstLast'], 'parenEnd', false, '&'),
  mhra: S('MHRA', 'note', ['lastFirst', 'firstLast'], 'parenEnd', true, 'and'),
} as const;
export type CitationStyle = keyof typeof CITATION_STYLES;
export const CITATION_STYLE_IDS = Object.keys(CITATION_STYLES) as CitationStyle[];

const NUMERIC = (st: CitationStyle) => ['bracket', 'paren', 'super'].includes(CITATION_STYLES[st].cite);
const SUP: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', ',': '˒' };

function authorList(src: Source, st: CitationStyle): string {
  const d = CITATION_STYLES[st];
  const ps = people(src.authors);
  if (!ps.length) return src.container || src.publisher || '';
  const names = ps.map((p, i) => name(p, d.names[i ? 1 : 0]));
  if (d.etAl && names.length > d.etAl) return `${names.slice(0, d.cite === 'author' ? 1 : Math.min(3, d.etAl)).join(d.sep)}, et al.`;
  if (names.length === 1) return names[0];
  if (d.and === ',' || d.and === ';') return names.join(d.sep);
  // APA puts a comma before the ampersand even between two names.
  return `${names.slice(0, -1).join(d.sep)}${(names.length > 2 || st === 'apa') && d.sep === ', ' ? ',' : ''} ${d.and} ${names[names.length - 1]}`;
}

/** The short form in the text: "(Dupont, 2020)", "[3]", "(3)" or "³". */
export function inTextCitation(src: Source, st: CitationStyle, n: number): string {
  const d = CITATION_STYLES[st];
  const ps = people(src.authors);
  const who = !ps.length ? (src.title.split(/\s+/).slice(0, 3).join(' ')) : ps.length === 1 ? ps[0].last
    : ps.length === 2 ? `${ps[0].last} ${d.and === '&' ? '&' : d.and === 'et' ? 'et' : 'and'} ${ps[1].last}` : `${ps[0].last} et al.`;
  switch (d.cite) {
    case 'authorYear': return `(${who}, ${src.year || 's. d.'})`;
    case 'authorYearNoComma': return `(${who} ${src.year || 'n.d.'})`;
    case 'author': return `(${who}${src.pages ? ` ${src.pages}` : ''})`;
    case 'bracket': return `[${n}]`;
    case 'paren': return `(${n})`;
    case 'super': return [...String(n)].map(ch => SUP[ch]).join('');
    case 'note': return '';
  }
}

/** A full entry for the bibliography or a footnote. */
export function entry(src: Source, st: CitationStyle): Seg[] {
  const d = CITATION_STYLES[st];
  const out: Seg[] = [];
  const add = (text: string, f: Partial<Seg> = {}) => { if (text) out.push({ text, ...f }); };
  // ", " between parts, or just a space after a part that already ends a sentence.
  const sep = () => (/[.:]\s*$/.test(out.map(x => x.text).join('')) ? ' ' : ', ');
  const part = ['article', 'chapter', 'news', 'web'].includes(src.kind) && !!src.container;
  const who = authorList(src, st);
  add(who);
  if (d.year === 'parenAfterAuthor') add(` (${src.year || 'n.d.'}).`);
  else if (d.year === 'afterAuthor') add(`${who ? '. ' : ''}${src.year || 'n.d.'}.`);
  else if (who) add(who.endsWith('.') ? '' : '.');
  add(' ');
  if (part) add(d.quote ? `“${src.title}.” ` : `${src.title}. `);
  else add(src.title, { italic: true }), add('. ');
  if (part) {
    if (src.kind === 'chapter') add(st === 'apa' || st === 'harvard' ? 'In ' : 'In: ');
    add(src.container!, { italic: true });
    if (src.volume) add(st === 'nature' ? ' ' : ', '), add(src.volume, { italic: st === 'apa', bold: st === 'nature' });
    if (src.issue) add(st === 'mla' ? `, no. ${src.issue}` : `(${src.issue})`);
  }
  if (!part && (src.publisher || src.place)) add(`${src.place ? `${src.place}${src.publisher ? ': ' : ''}` : ''}${src.publisher ?? ''}`);
  if (src.pages) add(`${sep()}${/[-–]/.test(src.pages) ? 'pp. ' : 'p. '}${src.pages}`);
  if (d.year === 'end') add(`${sep()}${src.year || 'n.d.'}`);
  if (d.year === 'boldEnd') add(sep()), add(src.year || 'n.d.', { bold: true });
  if (d.year === 'parenEnd') add(` (${src.year || 'n.d.'})`);
  add('.');
  if (src.doi) add(` https://doi.org/${src.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}`);
  else if (src.url) add(` ${st === 'harvard' ? 'Available at: ' : ''}${src.url}${src.accessed ? ` (${st === 'mla' ? 'accessed' : 'consulté le'} ${src.accessed})` : ''}`);
  // Tidy the punctuation the parts leave between them.
  const joined = out.map(s => s.text).join('');
  if (!joined.trim()) return [];
  return out.map(s => ({ ...s, text: s.text.replace(/\.\./g, '.').replace(/,\s*\./g, '.') })).filter(s => s.text);
}

// ---------- citations in the letter ----------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: { insertCitation: (src: Source, style: CitationStyle) => ReturnType };
  }
}

/** A citation in the text: it keeps its whole source, so the bibliography and a change of style can be built later. */
export const Citation = Mark.create({
  name: 'citation',
  inclusive: false,
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: el => { try { return JSON.parse(el.getAttribute('data-source') ?? 'null'); } catch { return null; } },
        renderHTML: a => (a.src ? { 'data-source': JSON.stringify(a.src) } : {}),
      },
    };
  },
  parseHTML() { return [{ tag: 'span[data-source]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { class: 'cite' }), 0]; },
  addCommands() {
    return {
      insertCitation: (src, style) => ({ editor, chain }) => {
        if (CITATION_STYLES[style].cite === 'note') {
          return chain().insertFootnote(entry(src, style).map(s => s.text).join('')).run();
        }
        const known = citedSources(editor.state.doc);
        const n = (known.findIndex(s => s.id === src.id) + 1) || known.length + 1;
        const text = inTextCitation(src, style, n);
        return chain().insertContent([{ type: 'text', text, marks: [{ type: 'citation', attrs: { src } }] }, { type: 'text', text: ' ' }]).run();
      },
    };
  },
});

/** Every source cited, once each, in the order of first citation. */
export function citedSources(doc: PmNode): Source[] {
  const seen = new Map<string, Source>();
  doc.descendants(node => {
    for (const m of node.marks) if (m.type.name === 'citation' && m.attrs.src && !seen.has(m.attrs.src.id)) seen.set(m.attrs.src.id, m.attrs.src as Source);
    return true;
  });
  return [...seen.values()];
}

/** Rewrites every citation in a new style (and renumbers numeric ones). Returns how many changed. */
export function restyleCitations(editor: Editor, style: CitationStyle): number {
  const order = citedSources(editor.state.doc).map(s => s.id);
  const ops: { from: number; to: number; text: string; marks: PmNode['marks'] }[] = [];
  editor.state.doc.descendants((node, pos) => {
    const m = node.marks.find(x => x.type.name === 'citation');
    if (!node.isText || !m?.attrs.src) return true;
    const text = inTextCitation(m.attrs.src as Source, style, order.indexOf(m.attrs.src.id) + 1) || `[${order.indexOf(m.attrs.src.id) + 1}]`;
    if (text !== node.text) ops.push({ from: pos, to: pos + node.nodeSize, text, marks: node.marks });
    return true;
  });
  if (!ops.length) return 0;
  const tr = editor.state.tr;
  for (const op of ops.reverse()) tr.replaceWith(op.from, op.to, editor.state.schema.text(op.text, op.marks));
  editor.view.dispatch(tr);
  return ops.length;
}

const segJson = (segs: Seg[]): JSONContent[] => segs.map(s => ({
  type: 'text', text: s.text,
  ...(s.italic || s.bold ? { marks: [...(s.italic ? [{ type: 'italic' }] : []), ...(s.bold ? [{ type: 'bold' }] : [])] } : {}),
}));

export const BIBLIOGRAPHY_TITLES = ['bibliography', 'references', 'worksCited', 'sources', 'further'] as const;

/** The bibliography: sorted by author for author-date styles, numbered in citation order for numeric ones. */
export function bibliographyJson(sources: Source[], style: CitationStyle, title: string): JSONContent[] {
  const numeric = NUMERIC(style);
  const list = numeric ? sources : [...sources].sort((a, b) => (people(a.authors)[0]?.last ?? a.title).localeCompare(people(b.authors)[0]?.last ?? b.title));
  return [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
    ...list.map((s, i) => ({
      type: 'paragraph',
      attrs: numeric ? { indentLeft: 22, indentFirst: -22, spaceAfter: 6 } : { indentLeft: 36, indentFirst: -36, spaceAfter: 6 },
      content: [...(numeric ? [{ type: 'text', text: CITATION_STYLES[style].cite === 'bracket' ? `[${i + 1}]\t` : `${i + 1}. ` }] : []), ...segJson(entry(s, style))],
    })),
    { type: 'paragraph' },
  ];
}

/** Asks Claude to turn a title, DOI, link or pasted reference into a source. */
export const SOURCE_PROMPT = `Turn what the user gives (a title, DOI, ISBN, link, or a reference copied from somewhere) into one bibliographic source.
Reply with only a JSON object with these keys, empty strings when unknown, never invented:
kind (one of ${SOURCE_KINDS.join(', ')}), authors ("Last, First" separated by "; "), title, year, container (journal, newspaper, website or book the part is in), volume, issue, pages, publisher, place, url, doi.`;

export function parseSource(json: string, id: string): Source | null {
  const m = json.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as Record<string, string>;
    const kind = (SOURCE_KINDS as readonly string[]).includes(o.kind) ? o.kind as SourceKind : 'other';
    const clean = (k: string) => (typeof o[k] === 'string' && o[k].trim() ? o[k].trim() : undefined);
    if (!clean('title')) return null;
    return {
      id, kind, authors: clean('authors') ?? '', title: clean('title')!, year: clean('year') ?? '',
      container: clean('container'), volume: clean('volume'), issue: clean('issue'), pages: clean('pages'),
      publisher: clean('publisher'), place: clean('place'), url: clean('url'), doi: clean('doi'),
    };
  } catch { return null; }
}

// ---------- captions ----------

export const CAPTION_LABELS = [
  'figure', 'table', 'equation', 'photo', 'chart', 'diagram', 'map', 'illustration', 'graph', 'exhibit',
  'plate', 'listing', 'annex', 'appendix', 'box', 'example', 'scheme', 'image', 'document', 'form',
] as const;
export type CaptionLabel = (typeof CAPTION_LABELS)[number];

const captionWord = (label: CaptionLabel) => t(`letter.caption.${label}` as MessageKey);

/** Every caption in the letter, in order, with its label and number. */
export function captionsIn(doc: PmNode): { pos: number; label: string; n: number; text: string }[] {
  const out: { pos: number; label: string; n: number; text: string }[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph' && node.attrs.styleId === 'caption') {
      const m = node.textContent.match(/^(.+?)\s+(\d+)\s*[:.–-]?\s*(.*)$/);
      if (m) out.push({ pos, label: m[1], n: +m[2], text: node.textContent });
    }
    return node.type.name !== 'paragraph';
  });
  return out;
}

/** A caption paragraph "Figure 3 : …", numbered after the captions of the same label already in the letter. */
export function captionJson(doc: PmNode, label: CaptionLabel, text: string, frenchColon: boolean): JSONContent {
  const word = captionWord(label);
  const n = captionsIn(doc).filter(c => c.label === word).length + 1;
  return {
    type: 'paragraph', attrs: { styleId: 'caption' },
    content: [{ type: 'text', text: `${word} ${n}${frenchColon ? ' : ' : ': '}`, marks: [{ type: 'bold' }] }, ...(text ? [{ type: 'text', text }] : [])],
  };
}

/** A table of figures (or of tables…): one line per caption with its page. */
export function tableOfFiguresJson(doc: PmNode, pageOf: (pos: number) => number | null, title: string): JSONContent[] | null {
  const caps = captionsIn(doc);
  if (!caps.length) return null;
  return [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
    ...caps.map(c => {
      const page = pageOf(c.pos + 1);
      return { type: 'paragraph', attrs: { spaceAfter: 2 }, content: [{ type: 'text', text: `${c.text}${page ? ` ……… ${page}` : ''}` }] };
    }),
    { type: 'paragraph' },
  ];
}

// ---------- index ----------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indexTerm: { markIndexTerm: (term?: string) => ReturnType };
  }
}

/** A word marked for the index, like Word's XE fields. */
export const IndexTerm = Mark.create({
  name: 'indexTerm',
  inclusive: false,
  addAttributes() {
    return { term: { default: null, parseHTML: el => el.getAttribute('data-index'), renderHTML: a => (a.term ? { 'data-index': a.term } : {}) } };
  },
  parseHTML() { return [{ tag: 'span[data-index]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { class: 'xe' }), 0]; },
  addCommands() {
    return {
      markIndexTerm: term => ({ state, chain }) => {
        const { from, to } = state.selection;
        const text = term ?? state.doc.textBetween(from, to).trim();
        if (from === to || !text) return false;
        return chain().setMark('indexTerm', { term: text }).run();
      },
    };
  },
});

/** Each marked term with the pages it is on, in alphabetical order. */
export function indexEntries(doc: PmNode, pageOf: (pos: number) => number | null, lang = 'fr'): { term: string; pages: number[] }[] {
  const map = new Map<string, Set<number>>();
  doc.descendants((node, pos) => {
    const m = node.marks.find(x => x.type.name === 'indexTerm');
    if (m?.attrs.term) {
      const set = map.get(m.attrs.term) ?? new Set<number>();
      const p = pageOf(pos);
      if (p) set.add(p);
      map.set(m.attrs.term, set);
    }
    return true;
  });
  return [...map.entries()].map(([term, pages]) => ({ term, pages: [...pages].sort((a, b) => a - b) }))
    .sort((a, b) => a.term.localeCompare(b.term, lang, { sensitivity: 'base' }));
}

export function indexJson(entries: { term: string; pages: number[] }[], title: string): JSONContent[] {
  const out: JSONContent[] = [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] }];
  let letter = '';
  for (const e of entries) {
    const first = e.term[0].toLocaleUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (first !== letter) { letter = first; out.push({ type: 'paragraph', attrs: { spaceBefore: 8 }, content: [{ type: 'text', text: letter, marks: [{ type: 'bold' }] }] }); }
    out.push({ type: 'paragraph', attrs: { spaceAfter: 0, indentLeft: 12 }, content: [{ type: 'text', text: `${e.term}${e.pages.length ? `, ${e.pages.join(', ')}` : ''}` }] });
  }
  out.push({ type: 'paragraph' });
  return out;
}

// ---------- cross-references ----------

export interface RefTarget { kind: 'heading' | 'caption' | 'footnote'; text: string; pos: number }

/** What a cross-reference can point to: headings, captions and footnotes. */
export function refTargets(doc: PmNode): RefTarget[] {
  const out: RefTarget[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading' && node.textContent.trim()) out.push({ kind: 'heading', text: node.textContent.trim(), pos });
    else if (node.type.name === 'paragraph' && node.attrs.styleId === 'caption') out.push({ kind: 'caption', text: node.textContent.replace(/\s*[:.].*$/, '').trim(), pos });
    else if (node.type.name === 'footnote') out.push({ kind: 'footnote', text: String(node.attrs.text ?? '').slice(0, 40), pos });
    return true;
  });
  return out;
}

export const REF_FORMS = ['text', 'page', 'textPage', 'above', 'see'] as const;
export type RefForm = (typeof REF_FORMS)[number];

/** The words a cross-reference puts in the text, like "voir Figure 2, page 4". */
export function refText(target: RefTarget, form: RefForm, page: number | null, here: number): string {
  const name = target.kind === 'heading' ? `« ${target.text} »` : target.text;
  switch (form) {
    case 'page': return page ? t('letter.ref.pageN', { n: page }) : name;
    case 'textPage': return page ? `${name}, ${t('letter.ref.pageN', { n: page })}` : name;
    case 'above': return `${name} ${target.pos < here ? t('letter.ref.above') : t('letter.ref.below')}`;
    case 'see': return `${t('letter.ref.see')} ${name}${page ? `, ${t('letter.ref.pageN', { n: page })}` : ''}`;
    default: return name;
  }
}
