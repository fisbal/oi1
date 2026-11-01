// Changing the language (Martin, 2026-10-31: "quand on change de langue, pouvoir avoir le choix de tout changer, barre
// et travaux, ou juste la barre, ou juste les travaux"): the interface, the document, or both. Each app gives the shell
// a translator for its document; the shell asks the person, then the app swaps the words in one step that one Undo
// takes back. Only words change: layout, styles, numbers, formulas and code stay as they are.

import type { AiApi, DocTranslator } from './contract';
import { LANGUAGES, type LanguageCode } from './i18n';

/** Translates a list of texts; the result has the same length and order. */
export type TranslateTexts = (texts: string[]) => Promise<string[]>;
const translators = new Map<string, DocTranslator>();
export function registerTranslator(tabId: string, t: DocTranslator | null) {
  if (t) translators.set(tabId, t); else translators.delete(tabId);
}
export const translatorFor = (tabId: string | null) => (tabId ? translators.get(tabId) ?? null : null);

// ---------- the original is always kept (rule 13) ----------
// Martin, 2026-10-31: going from one language to another changed the text a little each time, until the original
// was lost. Now the first translation keeps the document as it was; every later translation starts again from that
// original, never from a translation, and going back to the original's language puts the exact original back.
// If the person edits a translation, the edited text becomes the base for the next one, but the first original
// stays kept for reference and can always be put back.

export interface Original {
  /** The original's language. */
  lang: string;
  /** The original document, as the app's snapshot. */
  data: unknown;
  /** The document right after our last translation, to see whether the person changed it since. */
  last?: string;
  lastLang?: string;
  /** The person edited a translation: their edited text and its language become the base of the next translation. */
  edited?: { lang: string; data: unknown };
}
const originals = new Map<string, Original>();
const KEY_ORIG = (tabId: string) => `oi1.lang.original.${tabId}`;
export function originalOf(tabId: string): Original | null {
  if (originals.has(tabId)) return originals.get(tabId)!;
  try { const v = localStorage.getItem(KEY_ORIG(tabId)); if (v) { const o = JSON.parse(v) as Original; originals.set(tabId, o); return o; } } catch { /* none */ }
  return null;
}
function keepOriginal(tabId: string, o: Original) {
  originals.set(tabId, o);
  try { localStorage.setItem(KEY_ORIG(tabId), JSON.stringify(o)); } catch { /* too big or blocked: kept while the tab is open */ }
}
export function forgetOriginal(tabId: string) {
  originals.delete(tabId);
  try { localStorage.removeItem(KEY_ORIG(tabId)); } catch { /* blocked */ }
}

/** Translates the tab's document into `to`, always from the original. `make` gives the translator for a source
 *  language; `fromGuess` is the menus' language before the change, used when the browser cannot tell the document's.
 *  Resolves to how many texts changed, and whether the exact original was put back. */
export async function translateFromOriginal(tabId: string, doc: DocTranslator, to: string, fromGuess: string,
  make: (from: string) => Promise<TranslateTexts>): Promise<{ n: number; restored: boolean }> {
  const now = JSON.stringify(doc.snapshot());
  let o = originalOf(tabId);
  if (o && now === JSON.stringify(o.data)) {
    // The document is the original again (Undo, or put back): translate from it.
    o = { ...o, edited: undefined };
  } else if (o && o.last !== undefined && o.last !== now) {
    // Changed since our translation: the person's text is the new base; the first original stays kept.
    o = { ...o, edited: { lang: o.lastLang ?? fromGuess, data: JSON.parse(now) } };
  }
  if (!o) {
    // The first time: the original's language, told by the browser from its words, else the menus' language.
    const data = JSON.parse(now);
    o = { lang: (await detectLanguage(doc.words(data))) ?? fromGuess, data };
  }
  const base = o.edited ?? { lang: o.lang, data: o.data };
  if (to === base.lang) {
    // Back to the base's own language: its exact words, no translation at all.
    const n = await doc.apply(base.data, null);
    keepOriginal(tabId, { ...o, last: JSON.stringify(doc.snapshot()), lastLang: to });
    return { n, restored: true };
  }
  const n = await doc.apply(base.data, await make(base.lang));
  keepOriginal(tabId, { ...o, last: JSON.stringify(doc.snapshot()), lastLang: to });
  return { n, restored: false };
}

/** Puts the first original back (the "original text" choice), whatever happened since. */
export async function restoreOriginal(tabId: string, doc: DocTranslator): Promise<boolean> {
  const o = originalOf(tabId);
  if (!o) return false;
  await doc.apply(o.data, null);
  // Still kept: the document is the original again, in its own language.
  keepOriginal(tabId, { lang: o.lang, data: o.data, last: JSON.stringify(doc.snapshot()), lastLang: o.lang });
  return true;
}

export type LangChoice = 'all' | 'ui' | 'doc';
const KEY = 'oi1.lang.choice';
export function rememberedChoice(): LangChoice | null {
  try { const v = localStorage.getItem(KEY); return v === 'all' || v === 'ui' || v === 'doc' ? v : null; } catch { return null; }
}
export function rememberChoice(c: LangChoice | null) {
  try { if (c) localStorage.setItem(KEY, c); else localStorage.removeItem(KEY); } catch { /* blocked storage */ }
}

const hasWords = (s: string) => /\p{L}{2,}/u.test(s);
const langName = (code: string) => {
  const known = LANGUAGES.find(l => l.code === code)?.name;
  if (known) return known;
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code; } catch { return code; }
};

/** Asks the AI to translate `texts` into `to`, in batches, keeping spaces at both ends and leaving texts without
 *  words (numbers, codes, symbols) alone. A batch whose answer does not fit is left as it was. */
export function aiTranslator(ai: AiApi, to: LanguageCode | string, signal?: AbortSignal): TranslateTexts {
  return async texts => {
    const out = [...texts];
    const unique = [...new Set(texts.map(s => s.trim()).filter(hasWords))];
    const done = new Map<string, string>();
    const batches: string[][] = [];
    let cur: string[] = [], size = 0;
    for (const s of unique) {
      if (cur.length && (cur.length >= 40 || size + s.length > 3500)) { batches.push(cur); cur = []; size = 0; }
      cur.push(s); size += s.length;
    }
    if (cur.length) batches.push(cur);
    for (const batch of batches) {
      if (signal?.aborted) break;
      const answer = await ai.ask({
        system: `You translate the texts of a document into ${langName(to)}, faithfully. Translate each item on its own: same meaning, same tone and register, same sentence structure where the language allows. Never reword, paraphrase, summarize, add or leave out anything, and never \"improve\" the text. Use the standard, accepted translation of set phrases, prayers, quotations, titles and technical terms. Keep names, numbers, dates, e-mail addresses, web links, formulas, code and placeholders in brackets (like [Name]) exactly as they are. Keep line breaks. If an item is already in ${langName(to)}, give it back unchanged. Answer only with JSON {"items": [...]} holding exactly ${batch.length} strings, in the same order.`,
        messages: [{ role: 'user', content: JSON.stringify({ items: batch }) }],
        schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'string' } } }, required: ['items'] },
        effort: 'low',
        signal,
      });
      try {
        const json = JSON.parse(answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1)) as { items?: unknown };
        const items = Array.isArray(json.items) ? json.items : [];
        if (items.length === batch.length) batch.forEach((s, i) => { if (typeof items[i] === 'string' && items[i]) done.set(s, items[i] as string); });
      } catch { /* this batch stays as it was */ }
    }
    texts.forEach((s, i) => {
      const t = done.get(s.trim());
      if (t) { const lead = /^\s*/.exec(s)![0], tail = /\s*$/.exec(s)![0]; out[i] = lead + t + tail; }
    });
    return out;
  };
}

/** Translates the words of HTML snippets (text nodes only), so bold, links, lists and styles stay. */
export async function translateHtml(htmls: string[], tr: TranslateTexts): Promise<string[]> {
  const docs = htmls.map(h => new DOMParser().parseFromString(`<body>${h}</body>`, 'text/html'));
  const nodes: Text[] = [];
  for (const d of docs) {
    const walk = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
    // Code, scripts and styles are not words to translate.
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (hasWords(n.nodeValue ?? '') && !n.parentElement?.closest('script, style, code, pre')) nodes.push(n as Text);
  }
  if (!nodes.length) return htmls;
  const got = await tr(nodes.map(n => n.nodeValue ?? ''));
  nodes.forEach((n, i) => { n.nodeValue = got[i]; });
  return docs.map((d, i) => (nodes.some(n => n.ownerDocument === d) ? d.body.innerHTML : htmls[i]));
}

// ---------- Chrome's own translator: free, no account, works offline once a language is downloaded ----------
// (Martin, 2026-10-31: the free AI asked for a Puter account and its phone check failed.) Chrome 138+ has the
// Translator and LanguageDetector APIs; elsewhere this returns null and the copilot's AI translates instead.

interface BrowserTranslator { translate(text: string): Promise<string> }
interface TranslatorApi {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<BrowserTranslator>;
}
interface DetectorApi { create(): Promise<{ detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]> }> }
const g = globalThis as { Translator?: TranslatorApi; LanguageDetector?: DetectorApi };

/** Whether this browser can translate by itself. */
export const browserTranslatorHere = () => !!g.Translator && !!g.LanguageDetector;

/** The language of a whole document, told by the browser from all its words together (one word alone misleads:
 *  "Saint-Père" was once taken for German), or null when the browser cannot tell. */
/** `p`, or null after `ms`: the browser's AI can wait for a model download that never comes (offline, blocked). */
const within = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), ms))]);

export async function detectLanguage(texts: string[]): Promise<string | null> {
  if (!g.LanguageDetector) return null;
  try {
    const sample = texts.filter(hasWords).join('\n').slice(0, 6000);
    if (!sample) return null;
    const d = await within(g.LanguageDetector.create(), 8000);
    if (!d) return null;
    const top = (await within(d.detect(sample), 5000))?.[0];
    const lang = top?.detectedLanguage?.split('-')[0];
    return lang && lang !== 'und' && top.confidence >= 0.5 ? lang : null;
  } catch { return null; }
}

/** Chrome's translator from `from` into `to`, or null when the browser cannot do that pair. One source language for
 *  the whole document. Texts it fails on are listed so the AI can do them. */
export async function browserTranslator(to: string, from: string): Promise<((texts: string[]) => Promise<{ out: string[]; failed: number[] }>) | null> {
  if (!g.Translator || from === to) return null;
  let t: BrowserTranslator;
  try {
    const can = await within(g.Translator.availability({ sourceLanguage: from, targetLanguage: to }), 5000);
    if (!can || can === 'unavailable') return null;
    // A language not yet on this device is downloaded once (a few seconds); past 30 s the AI translates instead.
    const made = await within(g.Translator.create({ sourceLanguage: from, targetLanguage: to }), 30000);
    if (!made) return null;
    t = made;
  } catch { return null; }
  return async texts => {
    const out = [...texts], failed: number[] = [];
    for (let i = 0; i < texts.length; i++) {
      const s = texts[i], core = s.trim();
      if (!hasWords(core)) continue;
      try {
        const r = await within(t.translate(core), 15000);
        if (r) out[i] = /^\s*/.exec(s)![0] + r + /\s*$/.exec(s)![0]; else failed.push(i);
      } catch { failed.push(i); }
    }
    return { out, failed };
  };
}

/** Free online translation, no account and no key (MyMemory, translated.net): for phones and browsers without a
 *  built-in translator. Each text goes as is, in pieces of at most 450 characters cut at sentence ends; texts it
 *  cannot do (daily limit reached, no network) are listed so the copilot's AI can do them. */
export const ONLINE_URL = 'https://api.mymemory.translated.net/get';
const MAX_PIECE = 450;

function pieces(s: string): string[] {
  if (s.length <= MAX_PIECE) return [s];
  const parts = s.match(/[^.!?。！？\n]+[.!?。！？]*\s*|\n+/g) ?? [s];
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + p).length > MAX_PIECE && cur) { out.push(cur); cur = ''; }
    if (p.length > MAX_PIECE) { for (let i = 0; i < p.length; i += MAX_PIECE) out.push(p.slice(i, i + MAX_PIECE)); continue; }
    cur += p;
  }
  if (cur) out.push(cur);
  return out;
}

async function onlineOne(text: string, from: string, to: string): Promise<string | null> {
  const url = `${ONLINE_URL}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${from}|${to}`)}`;
  const res = await within(fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null), 12000) as
    { responseStatus?: number | string; responseData?: { translatedText?: string } } | null;
  const got = res?.responseData?.translatedText;
  if (!res || Number(res.responseStatus) !== 200 || !got || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE/i.test(got)) return null;
  return got;
}

export function onlineTranslator(to: string, from: string): (texts: string[]) => Promise<{ out: string[]; failed: number[] }> {
  const memo = new Map<string, string>();
  return async texts => {
    const out = [...texts], failed: number[] = [];
    let stop = false;
    for (let i = 0; i < texts.length; i++) {
      const s = texts[i], core = s.trim();
      if (!hasWords(core)) continue;
      if (stop) { failed.push(i); continue; }
      let done = memo.get(core);
      if (done === undefined) {
        const bits: string[] = [];
        for (const piece of pieces(core)) {
          const lead = /^\s*/.exec(piece)![0], tail = /\s*$/.exec(piece)![0];
          const r = piece.trim() ? await onlineOne(piece.trim(), from, to) : '';
          if (r === null) { stop = true; break; }
          bits.push(lead + r + tail);
        }
        if (stop) { failed.push(i); continue; }
        done = bits.join('');
        memo.set(core, done);
      }
      out[i] = /^\s*/.exec(s)![0] + done + /\s*$/.exec(s)![0];
    }
    return { out, failed };
  };
}

/** Chrome's translator first (free, no account, on the device); then the free online translator (phones); the
 *  copilot's AI only for what both could not do. */
export async function bestTranslator(to: LanguageCode | string, from: string, ai: () => TranslateTexts): Promise<TranslateTexts> {
  const browser = await browserTranslator(to, from);
  const first = browser ?? (from && from !== to ? onlineTranslator(to, from) : null);
  if (!first) return ai();
  return async texts => {
    const { out, failed } = await first(texts);
    if (failed.length) {
      const got = await ai()(failed.map(i => texts[i]));
      failed.forEach((i, k) => { out[i] = got[k]; });
    }
    return out;
  };
}
