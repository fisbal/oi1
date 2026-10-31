// Changing the language (Martin, 2026-10-31: "quand on change de langue, pouvoir avoir le choix de tout changer, barre
// et travaux, ou juste la barre, ou juste les travaux"): the interface, the document, or both. Each app gives the shell
// a translator for its document; the shell asks the person, then the app swaps the words in one step that one Undo
// takes back. Only words change: layout, styles, numbers, formulas and code stay as they are.

import type { AiApi } from './contract';
import { LANGUAGES, type LanguageCode } from './i18n';

/** Translates a list of texts; the result has the same length and order. */
export type TranslateTexts = (texts: string[]) => Promise<string[]>;
/** An app's translator: collects its document's texts, translates them with `tr`, applies them in one undo step.
 *  Resolves to how many texts changed. */
export type Translator = (tr: TranslateTexts) => Promise<number>;

const translators = new Map<string, Translator>();
export function registerTranslator(tabId: string, fn: Translator | null) {
  if (fn) translators.set(tabId, fn); else translators.delete(tabId);
}
export const translatorFor = (tabId: string | null) => (tabId ? translators.get(tabId) ?? null : null);

export type LangChoice = 'all' | 'ui' | 'doc';
const KEY = 'oi1.lang.choice';
export function rememberedChoice(): LangChoice | null {
  try { const v = localStorage.getItem(KEY); return v === 'all' || v === 'ui' || v === 'doc' ? v : null; } catch { return null; }
}
export function rememberChoice(c: LangChoice | null) {
  try { if (c) localStorage.setItem(KEY, c); else localStorage.removeItem(KEY); } catch { /* blocked storage */ }
}

const hasWords = (s: string) => /\p{L}{2,}/u.test(s);
const langName = (code: LanguageCode) => LANGUAGES.find(l => l.code === code)?.name ?? code;

/** Asks the AI to translate `texts` into `to`, in batches, keeping spaces at both ends and leaving texts without
 *  words (numbers, codes, symbols) alone. A batch whose answer does not fit is left as it was. */
export function aiTranslator(ai: AiApi, to: LanguageCode, signal?: AbortSignal): TranslateTexts {
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
        system: `You translate the texts of a document into ${langName(to)}. Translate each item on its own, keeping its meaning, tone and register. Keep names, numbers, dates, e-mail addresses, web links, formulas, code and placeholders in brackets (like [Name]) exactly as they are. Keep line breaks. If an item is already in ${langName(to)}, give it back unchanged. Answer only with JSON {"items": [...]} holding exactly ${batch.length} strings, in the same order.`,
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
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (hasWords(n.nodeValue ?? '')) nodes.push(n as Text);
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

/** Chrome's translator for `texts` into `to`, or null when the browser has none. Each text's language is detected,
 *  so a letter mixing French and English is translated piece by piece. A text it cannot do is left as it was. */
export async function browserTranslator(to: LanguageCode): Promise<TranslateTexts | null> {
  if (!browserTranslatorHere()) return null;
  let detector: Awaited<ReturnType<DetectorApi['create']>>;
  try { detector = await g.LanguageDetector!.create(); } catch { return null; }
  const made = new Map<string, Promise<BrowserTranslator | null>>();
  const forSource = (from: string) => {
    if (!made.has(from)) made.set(from, (async () => {
      try {
        if ((await g.Translator!.availability({ sourceLanguage: from, targetLanguage: to })) === 'unavailable') return null;
        return await g.Translator!.create({ sourceLanguage: from, targetLanguage: to });
      } catch { return null; }
    })());
    return made.get(from)!;
  };
  return async texts => {
    const out = [...texts];
    for (let i = 0; i < texts.length; i++) {
      const s = texts[i], core = s.trim();
      if (!hasWords(core)) continue;
      try {
        const from = (await detector.detect(core))[0]?.detectedLanguage?.split('-')[0];
        if (!from || from === 'und' || from === to) continue;
        const tr = await forSource(from);
        if (!tr) continue;
        const t = await tr.translate(core);
        if (t) out[i] = /^\s*/.exec(s)![0] + t + /\s*$/.exec(s)![0];
      } catch { /* left as it was */ }
    }
    return out;
  };
}

/** Chrome's translator first; whatever it could not do (no translator, a language it lacks) goes to the AI. */
export async function bestTranslator(to: LanguageCode, ai: () => TranslateTexts): Promise<TranslateTexts> {
  const browser = await browserTranslator(to);
  if (!browser) return ai();
  return async texts => {
    const out = await browser(texts);
    const left = texts.map((s, i) => (out[i] === s && hasWords(s) ? i : -1)).filter(i => i >= 0);
    if (left.length) {
      const got = await ai()(left.map(i => texts[i]));
      left.forEach((i, k) => { out[i] = got[k]; });
    }
    return out;
  };
}
