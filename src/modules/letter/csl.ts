// More citation styles: every style of the Citation Style Language (CSL), the open standard Zotero, Mendeley and
// Pandoc use, over 10,000 journals, universities and publishers. The styles and their translations come from the
// CSL project's public repositories (CC BY-SA 3.0, credited in the app) when a style is chosen, then stay on the
// device. They are run by citeproc-js (Frank Bennett, CPAL 1.0), unchanged, loaded only when a CSL style is used.

import type { JSONContent } from '@tiptap/core';
import type { Source, Seg } from './references';
import { people, segJson } from './references';

const STYLES = 'https://raw.githubusercontent.com/citation-style-language/styles/master';
const LOCALES = 'https://raw.githubusercontent.com/citation-style-language/locales/master';
const TREE = 'https://api.github.com/repos/citation-style-language/styles/git/trees/master?recursive=1';

export const CSL_CREDIT = 'Citation Style Language styles and locales: CC BY-SA 3.0, citationstyles.org. citeproc-js: © 2009-2019 Frank Bennett, CPAL 1.0.';

/** A style's id from its file ("apa", "dependent/journal-of-business-venturing") and a readable name. */
export interface CslStyle { id: string; name: string }

export const styleName = (id: string): string => {
  const base = id.replace(/^dependent\//, '').replace(/\.csl$/, '');
  return base.split('-').map(w => (/^(apa|mla|ieee|ama|acs|asa|apsa|aaa|mhra|iso|din|nlm|cse|bmj|jama|nejm|pnas|plos|bmc|acm|aip|aps|rsc|iop|ams|abnt|gost|sist|uni|un)$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
};

// ---------- small cache (styles, locales and the list stay on the device) ----------
const mem = new Map<string, string>();
const cacheKey = (k: string) => `oi1:csl:${k}`;
function cached(k: string): string | null {
  if (mem.has(k)) return mem.get(k)!;
  try { const v = localStorage.getItem(cacheKey(k)); if (v) mem.set(k, v); return v; } catch { return null; }
}
function keep(k: string, v: string) {
  mem.set(k, v);
  try { localStorage.setItem(cacheKey(k), v); } catch { /* full: the memory copy is enough for this visit */ }
}
async function text(url: string, get: typeof fetch): Promise<string> {
  const r = await get(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

/** Every style of the CSL repository (independent and dependent), refreshed once a week. */
export async function styleList(get: typeof fetch = fetch): Promise<CslStyle[]> {
  let raw = cached('list');
  const at = Number(cached('listAt') ?? 0);
  if (!raw || Date.now() - at > 7 * 864e5) {
    try {
      const tree = JSON.parse(await text(TREE, get)) as { tree?: { path: string }[] };
      const ids = (tree.tree ?? []).map(x => x.path).filter(p => p.endsWith('.csl')).map(p => p.replace(/\.csl$/, ''));
      if (ids.length) { raw = ids.join('\n'); keep('list', raw); keep('listAt', String(Date.now())); }
    } catch { /* offline: the last list, if any */ }
  }
  return (raw ?? '').split('\n').filter(Boolean).map(id => ({ id, name: styleName(id) }));
}

/** Styles whose name has every word typed, the main ones first. */
export function searchStyles(list: CslStyle[], query: string, max = 40): CslStyle[] {
  const words = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter(Boolean);
  const hits = list.filter(s => { const n = s.name.toLowerCase(); return words.every(w => n.includes(w)); });
  return hits.sort((a, b) => Number(a.id.startsWith('dependent/')) - Number(b.id.startsWith('dependent/')) || a.name.length - b.name.length).slice(0, max);
}

/** A style's XML; a dependent style (a journal using another style) brings its parent's. */
export async function loadStyle(id: string, get: typeof fetch = fetch): Promise<string> {
  const k = `style:${id}`;
  let xml = cached(k);
  if (!xml) { xml = await text(`${STYLES}/${id}.csl`, get); keep(k, xml); }
  const parent = /<link[^>]+href="https?:\/\/www\.zotero\.org\/styles\/([^"]+)"[^>]+rel="independent-parent"|<link[^>]+rel="independent-parent"[^>]+href="https?:\/\/www\.zotero\.org\/styles\/([^"]+)"/.exec(xml);
  return parent ? loadStyle(parent[1] ?? parent[2], get) : xml;
}

const LOCALE_OF: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', pt: 'pt-PT', de: 'de-DE' };
/** The translation of the style's words ("et al.", "dans", "s. d.") for a language. */
export async function loadLocale(lang: string, get: typeof fetch = fetch): Promise<string> {
  const code = /^[a-z]{2}-[A-Z]{2}$/.test(lang) ? lang : LOCALE_OF[lang.slice(0, 2)] ?? 'en-US';
  const k = `locale:${code}`;
  let xml = cached(k);
  if (!xml) { xml = await text(`${LOCALES}/locales-${code}.xml`, get); keep(k, xml); }
  return xml;
}

// ---------- our sources as CSL items ----------
const KIND: Record<string, string> = { book: 'book', article: 'article-journal', web: 'webpage', report: 'report', chapter: 'chapter', thesis: 'thesis', news: 'article-newspaper', law: 'legislation', video: 'motion_picture', other: 'document' };
const names = (s?: string) => (s ? people(s).map(p => (p.first ? { family: p.last, given: p.first } : { literal: p.last })) : undefined);

export function toCslItem(src: Source): Record<string, unknown> {
  const item: Record<string, unknown> = {
    id: src.id, type: KIND[src.kind] ?? 'document', title: src.title,
    author: names(src.authors), editor: names(src.editors),
    'container-title': src.container, volume: src.volume, issue: src.issue, page: src.pages,
    publisher: src.kind === 'thesis' ? src.institution ?? src.publisher : src.publisher, 'publisher-place': src.place,
    URL: src.url, DOI: src.doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//, ''), edition: src.edition,
    genre: src.kind === 'thesis' ? (src.degree === 'master' ? 'Master’s thesis' : 'Doctoral dissertation') : undefined,
  };
  const y = /\d{4}/.exec(src.year ?? '')?.[0];
  if (y) item.issued = { 'date-parts': [[Number(y)]] };
  if (src.accessed) { const d = new Date(src.accessed); if (!Number.isNaN(d.getTime())) item.accessed = { 'date-parts': [[d.getFullYear(), d.getMonth() + 1, d.getDate()]] }; }
  for (const k of Object.keys(item)) if (item[k] === undefined || item[k] === '') delete item[k];
  return item;
}

// ---------- the engine ----------
interface Engine {
  updateItems(ids: string[]): void;
  makeBibliography(): [Record<string, unknown>, string[]] | false;
  makeCitationCluster(items: { id: string }[]): string;
  setOutputFormat(f: 'text' | 'html'): void;
  opt: { xclass?: string };
}
/** citeproc-js, loaded the first time a CSL style is used. */
export async function makeEngine(styleXml: string, localeXml: string, sources: Source[]): Promise<CslRun> {
  const CSL = ((await import('citeproc')) as unknown as { default: { Engine: new (sys: unknown, style: string, lang?: string, force?: boolean) => Engine } }).default;
  const items = new Map(sources.map(s => [s.id, toCslItem(s)]));
  const sys = { retrieveLocale: () => localeXml, retrieveItem: (id: string) => items.get(id) };
  const engine = new CSL.Engine(sys, styleXml);
  engine.updateItems(sources.map(s => s.id));
  return new CslRun(engine, items, sources);
}

/** Turns citeproc's HTML (<i>, <b>, entities) into our pieces of text. */
export function htmlSegs(html: string): Seg[] {
  const out: Seg[] = [];
  const decode = (s: string) => s.replace(/&#38;|&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;|&#34;/g, '"').replace(/&#39;|&apos;/g, '\'').replace(/&nbsp;|&#160;/g, ' ').replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
  let italic = 0, bold = 0;
  for (const part of html.replace(/<\/?(div|span)[^>]*>/g, '').split(/(<\/?(?:i|em|b|strong)>)/)) {
    if (/^<(i|em)>$/.test(part)) italic++;
    else if (/^<\/(i|em)>$/.test(part)) italic--;
    else if (/^<(b|strong)>$/.test(part)) bold++;
    else if (/^<\/(b|strong)>$/.test(part)) bold--;
    else if (part) {
      const t = decode(part.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ');
      if (t) out.push({ text: t, ...(italic > 0 ? { italic: true } : {}), ...(bold > 0 ? { bold: true } : {}) });
    }
  }
  if (out.length) { out[0] = { ...out[0], text: out[0].text.replace(/^\s+/, '') }; const l = out.length - 1; out[l] = { ...out[l], text: out[l].text.replace(/\s+$/, '') }; }
  return out.filter(s => s.text);
}

export class CslRun {
  constructor(private engine: Engine, private items: Map<string, Record<string, unknown>>, private sources: Source[]) {}
  /** Notes styles cite in footnotes; the others in the text. */
  get isNote(): boolean { return this.engine.opt.xclass === 'note'; }
  /** The in-text citation of one source (numbered styles count in the order the sources were given: first cited first). */
  cite(id: string): string {
    if (!this.items.has(id)) return '';
    try {
      this.engine.setOutputFormat('text');
      return this.engine.makeCitationCluster([{ id }]).replace(/\s+/g, ' ').trim();
    } catch { return ''; }
  }
  /** The bibliography in the style's order and form. */
  bibliography(): { hanging: boolean; entries: Seg[][] } {
    this.engine.setOutputFormat('html');
    const bib = this.engine.makeBibliography();
    if (!bib) return { hanging: false, entries: [] };
    return { hanging: !!bib[0].hangingindent, entries: bib[1].map(htmlSegs) };
  }
  get count(): number { return this.sources.length; }
}

/** The bibliography of a CSL style as paragraphs: the style says if it hangs; numbered styles keep their numbers. */
export function cslBibliographyJson(run: CslRun, title: string): JSONContent[] {
  const { hanging, entries } = run.bibliography();
  return [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
    ...entries.map(e => ({ type: 'paragraph', attrs: hanging ? { indentLeft: 36, indentFirst: -36, spaceAfter: 6 } : { indentFirst: 0, spaceAfter: 6 }, content: segJson(e) })),
    { type: 'paragraph' },
  ];
}

/** Styles shown before anything is typed: the ones schools and journals ask for most (more than 20). */
export const POPULAR = [
  'apa', 'modern-language-association', 'chicago-author-date', 'chicago-note-bibliography', 'harvard-cite-them-right', 'ieee',
  'vancouver', 'american-medical-association', 'nature', 'science', 'american-chemical-society', 'american-sociological-association',
  'american-political-science-association', 'iso690-author-date-fr', 'iso690-numeric-fr', 'universite-de-montreal-apa', 'universite-laval-com',
  'elsevier-harvard', 'springer-basic-author-date', 'taylor-and-francis-chicago-author-date', 'cell', 'plos', 'bmj', 'the-lancet',
  'apa-fr-provost', 'turabian-author-date', 'association-for-computing-machinery', 'oscola', 'new-england-journal-of-medicine', 'mhra',
];
