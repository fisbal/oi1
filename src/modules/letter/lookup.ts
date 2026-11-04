// A source from its DOI or ISBN, without AI, like Zotero's "Add item by identifier": the DOI is looked up in Crossref
// (the registry of DOIs, free and open), an ISBN in Open Library, then Google Books when Open Library does not know it.
// Only the identifier leaves the device. No code from Zotero is used: the same public services, our own mapping.

import type { Source, SourceKind } from './references';

/** A DOI anywhere in what was typed or pasted (also inside a doi.org link). */
export function findDoi(text: string): string | null {
  const m = /\b(10\.\d{4,9}\/[^\s"'<>]+)/i.exec(text);
  return m ? m[1].replace(/[.,;)\]]+$/, '') : null;
}

/** An ISBN-10 or ISBN-13 with a valid check digit, hyphens and spaces left out. */
export function findIsbn(text: string): string | null {
  const t = text.replace(/isbn(?:-1[03])?:?/ig, ' ');
  for (const m of t.matchAll(/(?:97[89][\s-]?)?(?:\d[\s-]?){9}[\dXx]/g)) {
    const d = m[0].replace(/[\s-]/g, '').toUpperCase();
    if (d.length === 13 && /^\d{13}$/.test(d)) {
      const sum = [...d].reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0);
      if (sum % 10 === 0) return d;
    }
    if (d.length === 10) {
      const sum = [...d].reduce((s, c, i) => s + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
      if (sum % 11 === 0) return d;
    }
  }
  return null;
}

type Json = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : typeof v === 'number' ? String(v) : '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const year = (v: unknown): string => {
  const parts = (v as { 'date-parts'?: unknown[][] } | undefined)?.['date-parts']?.[0];
  if (parts?.[0]) return String(parts[0]);
  return /\b(1[5-9]\d\d|20\d\d)\b/.exec(str(v))?.[1] ?? '';
};
/** Crossref and Open Library people as our "Last, First; Last, First". */
const persons = (list: unknown): string => (Array.isArray(list) ? list : []).map(p => {
  const o = p as Json;
  if (o.family) return o.given ? `${str(o.family)}, ${str(o.given)}` : str(o.family);
  const name = str(o.name ?? p);
  if (!name) return '';
  if (name.includes(',')) return name;
  const parts = name.split(' ');
  return parts.length > 1 ? `${parts.pop()}, ${parts.join(' ')}` : `{${name}}`;
}).filter(Boolean).join('; ');

const CROSSREF_KIND: Record<string, SourceKind> = {
  'journal-article': 'article', 'book': 'book', 'monograph': 'book', 'edited-book': 'book', 'reference-book': 'book',
  'book-chapter': 'chapter', 'book-section': 'chapter', 'book-part': 'chapter', 'reference-entry': 'chapter',
  'proceedings-article': 'chapter', 'report': 'report', 'report-component': 'report', 'dissertation': 'thesis',
  'posted-content': 'other', 'dataset': 'other', 'standard': 'report',
};

/** Crossref's answer for one DOI, as a source. */
export function fromCrossref(msg: Json, id: string): Source | null {
  const title = [str(msg.title), str(msg.subtitle)].filter(Boolean).join(' : ');
  if (!title) return null;
  const kind = CROSSREF_KIND[str(msg.type)] ?? 'article';
  const src: Source = {
    id, kind,
    authors: persons(msg.author),
    title,
    year: year(msg.issued) || year(msg['published-print']) || year(msg['published-online']) || year(msg.published),
    container: str(msg['container-title']) || undefined,
    volume: str(msg.volume) || undefined,
    issue: str(msg.issue) || undefined,
    pages: str(msg.page) || undefined,
    publisher: kind !== 'article' ? str(msg.publisher) || undefined : undefined,
    place: str(msg['publisher-location']) || undefined,
    editors: persons(msg.editor) || undefined,
    doi: str(msg.DOI) || undefined,
  };
  if (kind === 'thesis') src.institution = str((msg.institution as Json[] | undefined)?.[0]?.name) || src.publisher;
  for (const k of Object.keys(src) as (keyof Source)[]) if (src[k] === undefined || src[k] === '') delete src[k];
  return { ...src, authors: src.authors ?? '', year: src.year ?? '' };
}

/** Open Library's "jscmd=data" answer for one ISBN, as a source. */
export function fromOpenLibrary(book: Json, id: string): Source | null {
  const title = [str(book.title), str(book.subtitle)].filter(Boolean).join(' : ');
  if (!title) return null;
  const src: Source = {
    id, kind: 'book', title,
    authors: persons(book.authors),
    year: year(book.publish_date),
    publisher: str((book.publishers as Json[] | undefined)?.[0]?.name) || undefined,
    place: str((book.publish_places as Json[] | undefined)?.[0]?.name) || undefined,
  };
  for (const k of Object.keys(src) as (keyof Source)[]) if (src[k] === undefined) delete src[k];
  return src;
}

/** Google Books' first volume for one ISBN, as a source. */
export function fromGoogleBooks(info: Json, id: string): Source | null {
  const title = [str(info.title), str(info.subtitle)].filter(Boolean).join(' : ');
  if (!title) return null;
  const src: Source = { id, kind: 'book', title, authors: persons(info.authors), year: year(info.publishedDate), publisher: str(info.publisher) || undefined };
  if (!src.publisher) delete src.publisher;
  return src;
}

export type LookupResult = { source: Source; from: 'crossref' | 'openlibrary' | 'googlebooks' } | { error: 'none' | 'notFound' | 'offline' };

/** Looks a DOI or an ISBN up. `none` when the text holds neither (then AI can try). */
export async function lookupSource(text: string, id: string, get: typeof fetch = fetch): Promise<LookupResult> {
  const doi = findDoi(text);
  const isbn = doi ? null : findIsbn(text);
  if (!doi && !isbn) return { error: 'none' };
  const json = async (url: string): Promise<Json | null> => {
    const r = await get(url, { headers: { Accept: 'application/json' } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as Json;
  };
  try {
    if (doi) {
      const data = await json(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      const source = data?.message ? fromCrossref(data.message as Json, id) : null;
      return source ? { source, from: 'crossref' } : { error: 'notFound' };
    }
    const ol = await json(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`).catch(() => null);
    const book = ol?.[`ISBN:${isbn}`] as Json | undefined;
    const fromOl = book ? fromOpenLibrary(book, id) : null;
    if (fromOl) return { source: fromOl, from: 'openlibrary' };
    const gb = await json(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const info = ((gb?.items as Json[] | undefined)?.[0]?.volumeInfo) as Json | undefined;
    const fromGb = info ? fromGoogleBooks(info, id) : null;
    return fromGb ? { source: fromGb, from: 'googlebooks' } : { error: 'notFound' };
  } catch {
    return { error: 'offline' };
  }
}
