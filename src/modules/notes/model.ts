// In 1 Notes: the notebooks, their sections and pages, kept together on the device (IndexedDB), like a paper
// binder: every Notes tab shows the same library. Pages are HTML from the editor; everything read back from storage
// or a file is checked here before use.

import { safeHtml } from '../../shell/safeHtml';

export interface Page { id: string; title: string; html: string; created: number; updated: number; paper: PaperId; color: string; pinned?: boolean }
export interface Section { id: string; name: string; color: string; pages: Page[] }
export interface Notebook { id: string; name: string; color: string; icon: string; sections: Section[] }
export interface Library { v: 1; notebooks: Notebook[]; at: { nb: string; sec: string; page: string } }

let counter = 0;
export const newId = (p = 'n') => `${p}${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Section and notebook colours (OneNote-like tabs). */
export const COLORS = ['#E8C35F', '#F28B82', '#F6AE7A', '#FDD663', '#CCFF90', '#A7FFEB', '#81C995', '#78D9EC', '#8AB4F8', '#AECBFA',
  '#C58AF9', '#D7AEFB', '#FDCFE8', '#E6C9A8', '#E8EAED', '#B0BEC5', '#FF8A80', '#80CBC4', '#9FA8DA', '#BCAAA4', '#F48FB1', '#A5D6A7'];

/** Notebook icons. */
export const ICONS = ['📓', '📔', '📒', '📕', '📗', '📘', '📙', '🎓', '💼', '🏠', '✈️', '🍳', '💡', '🧪', '🎨', '🎵', '⚽', '💪', '💰', '❤️', '🌱', '🛠️', '📷', '🧭'];

/** Paper under the writing. */
export const PAPERS = ['plain', 'lines', 'wide', 'narrow', 'grid', 'smallGrid', 'bigGrid', 'dots', 'dotsBig', 'cornell', 'seyes',
  'music', 'graph', 'iso', 'margin', 'legal', 'kraft', 'chalk', 'blueprint', 'dark', 'sepia'] as const;
export type PaperId = typeof PAPERS[number];

/** Page colours. */
export const PAGE_COLORS = ['#FFFFFF', '#FFFDF5', '#FFF8E1', '#FFF3E0', '#FBE9E7', '#FCE4EC', '#F3E5F5', '#EDE7F6', '#E8EAF6', '#E3F2FD',
  '#E1F5FE', '#E0F7FA', '#E0F2F1', '#E8F5E9', '#F1F8E9', '#F9FBE7', '#FFFDE7', '#EFEBE9', '#FAFAFA', '#ECEFF1', '#F5F5DC', '#FDF6E3'];

/** Note tags: a mark at the start of a line, like OneNote's tags. Listed by "Tag summary". */
export const TAGS: { id: string; icon: string }[] = [
  { id: 'todo', icon: '☐' }, { id: 'important', icon: '⭐' }, { id: 'question', icon: '❓' }, { id: 'idea', icon: '💡' },
  { id: 'remember', icon: '📌' }, { id: 'critical', icon: '❗' }, { id: 'definition', icon: '📖' }, { id: 'highlight', icon: '🖍️' },
  { id: 'contact', icon: '👤' }, { id: 'phone', icon: '📞' }, { id: 'address', icon: '🏠' }, { id: 'website', icon: '🌐' },
  { id: 'date', icon: '📅' }, { id: 'meeting', icon: '🤝' }, { id: 'book', icon: '📚' }, { id: 'movie', icon: '🎬' },
  { id: 'music', icon: '🎵' }, { id: 'project', icon: '🗂️' }, { id: 'buy', icon: '🛒' }, { id: 'money', icon: '💰' },
  { id: 'later', icon: '⏳' }, { id: 'done', icon: '✅' }, { id: 'warning', icon: '⚠️' }, { id: 'love', icon: '❤️' },
];

const COLOR = /^#[0-9a-f]{6}$/i;
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Date.now());

export function newPage(title = '', html = '<p></p>', paper: PaperId = 'plain'): Page {
  const now = Date.now();
  return { id: newId('p'), title, html, created: now, updated: now, paper, color: '#FFFFFF' };
}
export function newSection(name: string, color = COLORS[0]): Section {
  return { id: newId('s'), name, color, pages: [newPage()] };
}
export function newNotebook(name: string, section: string, color = COLORS[8], icon = ICONS[0]): Notebook {
  return { id: newId('b'), name, color, icon, sections: [newSection(section, COLORS[0])] };
}
export function newLibrary(name: string, section: string): Library {
  const nb = newNotebook(name, section);
  return { v: 1, notebooks: [nb], at: { nb: nb.id, sec: nb.sections[0].id, page: nb.sections[0].pages[0].id } };
}

/** A library read from storage or a file, field by field; pages' HTML goes through the sanitizer. */
export function cleanLibrary(raw: unknown, name: string, section: string): Library {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const nbs = (Array.isArray(o.notebooks) ? o.notebooks : []).slice(0, 200).map(cleanNotebook).filter((x): x is Notebook => !!x);
  if (!nbs.length) return newLibrary(name, section);
  const lib: Library = { v: 1, notebooks: nbs, at: { nb: '', sec: '', page: '' } };
  const at = (o.at && typeof o.at === 'object' ? o.at : {}) as Record<string, unknown>;
  return { ...lib, at: fixAt(lib, { nb: str(at.nb), sec: str(at.sec), page: str(at.page) }) };
}
function cleanNotebook(raw: unknown): Notebook | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const sections = (Array.isArray(o.sections) ? o.sections : []).slice(0, 500).map(cleanSection).filter((x): x is Section => !!x);
  if (!sections.length) sections.push(newSection('1'));
  return { id: str(o.id) || newId('b'), name: str(o.name) || '—', color: COLOR.test(str(o.color)) ? str(o.color) : COLORS[8], icon: ICONS.includes(str(o.icon)) ? str(o.icon) : ICONS[0], sections };
}
function cleanSection(raw: unknown): Section | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const pages = (Array.isArray(o.pages) ? o.pages : []).slice(0, 5000).map(cleanPage).filter((x): x is Page => !!x);
  if (!pages.length) pages.push(newPage());
  return { id: str(o.id) || newId('s'), name: str(o.name) || '—', color: COLOR.test(str(o.color)) ? str(o.color) : COLORS[0], pages };
}
function cleanPage(raw: unknown): Page | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const paper = (PAPERS as readonly string[]).includes(str(o.paper)) ? (str(o.paper) as PaperId) : 'plain';
  return {
    id: str(o.id) || newId('p'), title: str(o.title, 300), html: safeHtml(str(o.html, 20_000_000)) || '<p></p>',
    created: num(o.created), updated: num(o.updated), paper, color: COLOR.test(str(o.color)) ? str(o.color) : '#FFFFFF', ...(o.pinned === true ? { pinned: true } : {}),
  };
}

/** Points `at` to pages that exist (the first ones when they are gone). */
export function fixAt(lib: Library, at: Library['at']): Library['at'] {
  const nb = lib.notebooks.find(n => n.id === at.nb) ?? lib.notebooks[0];
  const sec = nb.sections.find(s => s.id === at.sec) ?? nb.sections[0];
  const page = sec.pages.find(p => p.id === at.page) ?? sec.pages[0];
  return { nb: nb.id, sec: sec.id, page: page.id };
}

export function where(lib: Library) {
  const nb = lib.notebooks.find(n => n.id === lib.at.nb)!;
  const sec = nb.sections.find(s => s.id === lib.at.sec)!;
  const page = sec.pages.find(p => p.id === lib.at.page)!;
  return { nb, sec, page };
}

/** The library with one page changed (immutably). */
export function updatePage(lib: Library, pageId: string, patch: Partial<Page>): Library {
  return {
    ...lib,
    notebooks: lib.notebooks.map(nb => ({
      ...nb,
      sections: nb.sections.map(sec => (sec.pages.some(p => p.id === pageId) ? { ...sec, pages: sec.pages.map(p => (p.id === pageId ? { ...p, ...patch, updated: Date.now() } : p)) } : sec)),
    })),
  };
}
export function updateSection(lib: Library, secId: string, fn: (s: Section) => Section): Library {
  return { ...lib, notebooks: lib.notebooks.map(nb => ({ ...nb, sections: nb.sections.map(s => (s.id === secId ? fn(s) : s)) })) };
}
export function updateNotebook(lib: Library, nbId: string, fn: (n: Notebook) => Notebook): Library {
  return { ...lib, notebooks: lib.notebooks.map(n => (n.id === nbId ? fn(n) : n)) };
}

/** Plain text of a page's HTML (search, AI, titles). */
export function textOf(html: string): string {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]+>/g, ' ');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, tr, br, div, blockquote, pre').forEach(el => el.append('\n'));
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** A title for a page without one: its first words. */
export const titleOf = (p: Page, untitled: string) => p.title.trim() || textOf(p.html).split('\n').find(l => l.trim())?.trim().slice(0, 60) || untitled;

export interface Hit { nb: Notebook; sec: Section; page: Page; snippet: string; score: number }

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Every page with all the words of `query` (accents and case ignored), best first, with a snippet. */
export function search(lib: Library, query: string, untitled = ''): Hit[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: Hit[] = [];
  for (const nb of lib.notebooks) for (const sec of nb.sections) for (const page of sec.pages) {
    const title = fold(titleOf(page, untitled));
    const body = textOf(page.html);
    const fb = fold(body);
    if (!words.every(w => title.includes(w) || fb.includes(w))) continue;
    const score = words.reduce((n, w) => n + (title.includes(w) ? 5 : 0) + (fb.split(w).length - 1), 0);
    const i = Math.max(0, fb.indexOf(words[0]) - 40);
    hits.push({ nb, sec, page, score, snippet: (i ? '…' : '') + body.slice(i, i + 140).replace(/\s+/g, ' ') });
  }
  return hits.sort((a, b) => b.score - a.score || b.page.updated - a.page.updated);
}

export interface TagLine { tag: string; text: string; nb: Notebook; sec: Section; page: Page }

/** Every tagged line in the library (lines that start with a tag's mark) and unchecked to-do boxes. */
export function tagSummary(lib: Library): TagLine[] {
  const out: TagLine[] = [];
  for (const nb of lib.notebooks) for (const sec of nb.sections) for (const page of sec.pages) {
    if (typeof DOMParser === 'undefined') continue;
    const doc = new DOMParser().parseFromString(page.html, 'text/html');
    doc.querySelectorAll('li[data-type="taskItem"][data-checked="false"]').forEach(li => {
      const text = li.textContent?.trim();
      if (text) out.push({ tag: 'todo', text, nb, sec, page });
    });
    doc.querySelectorAll('p, li:not([data-type="taskItem"]), h1, h2, h3').forEach(el => {
      const text = el.textContent?.trim() ?? '';
      const tag = TAGS.find(x => text.startsWith(x.icon));
      if (tag) out.push({ tag: tag.id, text: text.slice(tag.icon.length).trim(), nb, sec, page });
    });
  }
  return out;
}

/** Study cards from a page: "question :: answer" lines, or a question line ending with "?" and the line after it. */
export function flashcards(text: string): { q: string; a: string }[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const out: { q: string; a: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(.+?)\s*(?:::|=>|→)\s*(.+)$/);
    if (m) { out.push({ q: m[1], a: m[2] }); continue; }
    if (/\?\s*$/.test(lines[i]) && lines[i + 1] && !/\?\s*$/.test(lines[i + 1])) { out.push({ q: lines[i], a: lines[i + 1] }); i++; }
  }
  return out.slice(0, 200);
}

/** The pages of a section as one HTML document (export, print, Convert). */
export function sectionHtml(sec: Section, untitled: string): string {
  return sec.pages.map(p => `<h1>${escapeHtml(titleOf(p, untitled))}</h1>${p.html}`).join('<hr>');
}
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A whole notebook as Markdown-ish text (.md export). */
export function notebookMarkdown(nb: Notebook, untitled: string): string {
  return `# ${nb.icon} ${nb.name}\n\n` + nb.sections.map(s => `## ${s.name}\n\n` + s.pages.map(p => `### ${titleOf(p, untitled)}\n\n${textOf(p.html)}\n`).join('\n')).join('\n');
}
