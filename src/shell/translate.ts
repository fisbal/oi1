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
