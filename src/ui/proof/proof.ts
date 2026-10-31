// Proofing for every OI1 app that takes typing: spelling (Hunspell dictionaries, on the device, instant),
// grammar and agreement (LanguageTool, online, can be turned off), and sentence style (Claude, on demand).
// The language is found for each paragraph, so a letter in French with a quote in English is checked right.

import enAff from '../../../node_modules/dictionary-en/index.aff?url';
import enDic from '../../../node_modules/dictionary-en/index.dic?url';
import frAff from '../../../node_modules/dictionary-fr/index.aff?url';
import frDic from '../../../node_modules/dictionary-fr/index.dic?url';
import esAff from '../../../node_modules/dictionary-es/index.aff?url';
import esDic from '../../../node_modules/dictionary-es/index.dic?url';
import ptAff from '../../../node_modules/dictionary-pt/index.aff?url';
import ptDic from '../../../node_modules/dictionary-pt/index.dic?url';
import deAff from '../../../node_modules/dictionary-de/index.aff?url';
import deDic from '../../../node_modules/dictionary-de/index.dic?url';

export type ProofLang = 'en' | 'fr' | 'es' | 'pt' | 'de';
export const PROOF_LANGS: ProofLang[] = ['en', 'fr', 'es', 'pt', 'de'];
/** The proofing languages a document can be set to; the first five families have dictionaries here, the others use the browser's checker. */
export const PROOF_TAGS = [
  'en-US', 'en-GB', 'en-CA', 'en-AU', 'fr-FR', 'fr-CA', 'fr-BE', 'fr-CH', 'es-ES', 'es-MX', 'pt-PT', 'pt-BR', 'de-DE', 'de-AT', 'de-CH',
  'it-IT', 'nl-NL', 'pl-PL', 'sv-SE', 'da-DK', 'nb-NO', 'fi-FI', 'ru-RU', 'uk-UA', 'el-GR', 'tr-TR', 'ar', 'he', 'zh-CN', 'ja-JP', 'ko-KR', 'hi-IN',
];

export type IssueKind = 'spell' | 'grammar' | 'style';
/** One thing to fix, at `from`..`to` in the text it was found in. */
export interface Issue { from: number; to: number; kind: IssueKind; word: string; message?: string; replacements?: string[]; rule?: string }

type ProofCall = { lang: ProofLang } & ({ type: 'check'; words: string[] } | { type: 'suggest'; word: string } | { type: 'add'; words: string[] });
export type ProofRequest = ProofCall & { id: number; aff: string; dic: string };
export interface ProofReply { id: number; bad?: string[]; words?: string[]; error?: string }

const DICTS: Record<ProofLang, { aff: string; dic: string }> = {
  en: { aff: enAff, dic: enDic }, fr: { aff: frAff, dic: frDic }, es: { aff: esAff, dic: esDic },
  pt: { aff: ptAff, dic: ptDic }, de: { aff: deAff, dic: deDic },
};

/** "fr-CA" → "fr"; languages without a dictionary give null. */
export function baseLang(tag: string | null | undefined): ProofLang | null {
  const b = (tag ?? '').toLowerCase().slice(0, 2);
  return (PROOF_LANGS as string[]).includes(b) ? (b as ProofLang) : null;
}

// ---------- which language a paragraph is in ----------

const COMMON: Record<ProofLang, string[]> = {
  en: 'the and of to is that it you in for with this are was be have not on what my your we they will can'.split(' '),
  fr: 'le la les et des un une est que qui pas pour dans sur avec je vous nous il elle ce du au mais ou très bonjour merci'.split(' '),
  es: 'el los las y que en una es por con para no se lo del al como pero muy su hola gracias está'.split(' '),
  pt: 'o os as e que em um uma é não para com do da dos das no na mas muito você olá obrigado está'.split(' '),
  de: 'der die das und ist nicht ein eine zu den mit von sich auf für ich sie es auch wir hallo danke'.split(' '),
};
const ACCENTS: Record<ProofLang, RegExp> = { en: /$^/, fr: /[èêëàâçœîïûù]/g, es: /[ñ¿¡]/g, pt: /[ãõç]/g, de: /[äöüß]/g };

/** The language of `text` among the five with dictionaries, or `fallback` when it is too short to tell. */
export function detectLang(text: string, fallback: ProofLang): ProofLang {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 3) return fallback;
  let best = fallback, top = 0, second = 0;
  for (const l of PROOF_LANGS) {
    const set = new Set(COMMON[l]);
    let n = words.filter(w => set.has(w)).length + (text.toLowerCase().match(ACCENTS[l])?.length ?? 0) * 0.5;
    if (l === fallback) n += 0.5;
    if (n > top) { second = top; top = n; best = l; } else if (n > second) second = n;
  }
  return top >= 2 && top > second ? best : fallback;
}

// ---------- words ----------

/** The words of `text` worth checking, with where they are. Numbers, codes, links, e-mails and initials are skipped. */
export function words(text: string): { word: string; from: number; to: number }[] {
  const out: { word: string; from: number; to: number }[] = [];
  const skip: [number, number][] = [];
  for (const m of text.matchAll(/(?:https?:\/\/|www\.)\S+|\S+@\S+\.\S+|#\w+/g)) skip.push([m.index!, m.index! + m[0].length]);
  for (const m of text.matchAll(/[\p{L}\p{M}\d]+(?:['’\-][\p{L}\p{M}\d]+)*/gu)) {
    const w = m[0], from = m.index!;
    if (/\d/.test(w) || w.length < 2 || (w === w.toUpperCase() && w.length <= 6)) continue;
    if (skip.some(([a, b]) => from >= a && from < b)) continue;
    out.push({ word: w, from, to: from + w.length });
  }
  return out;
}

// ---------- the engine ----------

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, (r: ProofReply) => void>();
function call(req: ProofCall): Promise<ProofReply> {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<ProofReply>) => { waiting.get(e.data.id)?.(e.data); waiting.delete(e.data.id); };
  }
  const id = ++seq;
  return new Promise(res => { waiting.set(id, res); worker!.postMessage({ ...req, id, ...DICTS[req.lang] }); });
}

const known = new Map<string, boolean>(); // `${lang}:${word}` → spelled right
const DICT_KEY = 'oi1.proof.words';
const personal = new Set<string>(read(DICT_KEY));
const ignored = new Set<string>();
const changeListeners = new Set<() => void>();
function read(key: string): string[] { try { return JSON.parse(localStorage.getItem(key) ?? '[]') as string[]; } catch { return []; } }
const changed = () => { for (const fn of changeListeners) fn(); };

export const proofing = {
  /** Called when the words to flag change (a word added to the dictionary or ignored), so editors check again. */
  onChange(fn: () => void) { changeListeners.add(fn); return () => { changeListeners.delete(fn); }; },
  /** The user's own words, kept on this device, good in every language. */
  personal: () => [...personal].sort(),
  addWord(word: string) {
    personal.add(word);
    try { localStorage.setItem(DICT_KEY, JSON.stringify([...personal])); } catch { /* private window: kept until the tab closes */ }
    changed();
  },
  removeWord(word: string) {
    personal.delete(word);
    try { localStorage.setItem(DICT_KEY, JSON.stringify([...personal])); } catch { /* private window */ }
    changed();
  },
  /** Not flagged again until the page reloads, like Word's "Ignore all". */
  ignore(word: string) { ignored.add(word); changed(); },
  isAccepted: (word: string) => personal.has(word) || ignored.has(word),
  /** A grammar or style remark set aside, for this page visit. */
  ignoreIssue(issue: Issue) { ignored.add(`${issue.rule ?? issue.kind}\n${issue.word}`); changed(); },
  shows: (issue: Issue) => issue.kind === 'spell' ? !proofing.isAccepted(issue.word) : !ignored.has(`${issue.rule ?? issue.kind}\n${issue.word}`),

  /** The words among `list` that are not spelled right in `lang`. */
  async misspelled(lang: ProofLang, list: string[]): Promise<Set<string>> {
    const ask = [...new Set(list.filter(w => !proofing.isAccepted(w) && !known.has(`${lang}:${w}`)))];
    if (ask.length) {
      const r = await call({ type: 'check', lang, words: ask });
      if (r.error) throw new Error(r.error);
      const bad = new Set(r.bad);
      for (const w of ask) known.set(`${lang}:${w}`, !bad.has(w));
    }
    return new Set(list.filter(w => !proofing.isAccepted(w) && known.get(`${lang}:${w}`) === false));
  },
  async suggest(lang: ProofLang, word: string): Promise<string[]> {
    const r = await call({ type: 'suggest', lang, word });
    return r.words ?? [];
  },
};

// ---------- grammar (LanguageTool) ----------

const GRAMMAR_KEY = 'oi1.proof.grammar';
/** Grammar goes online (LanguageTool), so it can be turned off; spelling stays on the device either way. */
export const grammarSettings = {
  on: () => { try { return localStorage.getItem(GRAMMAR_KEY) !== '0'; } catch { return true; } },
  set(on: boolean) { try { localStorage.setItem(GRAMMAR_KEY, on ? '1' : '0'); } catch { /* private window */ } changed(); },
};
export const LT_URL = 'https://api.languagetool.org/v2/check';
const LT_LANG: Record<ProofLang, string> = { en: 'en-US', fr: 'fr', es: 'es', pt: 'pt-PT', de: 'de-DE' };
const grammarCache = new Map<string, Promise<Issue[]>>();
let pause = 0;

interface LtMatch { offset: number; length: number; message: string; replacements: { value: string }[]; rule: { id: string; issueType?: string; category?: { id: string } } }

/** Grammar, agreement and punctuation issues in one paragraph. Spelling issues are left to the dictionaries. */
export function grammar(text: string, lang: ProofLang, tag?: string): Promise<Issue[]> {
  if (!grammarSettings.on() || text.trim().length < 8 || Date.now() < pause) return Promise.resolve([]);
  const language = tag && baseLang(tag) === lang && tag.length > 2 ? tag : LT_LANG[lang];
  const key = `${language}\n${text}`;
  let p = grammarCache.get(key);
  if (!p) {
    p = fetch(LT_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ text, language }) })
      .then(async r => {
        if (r.status === 429) pause = Date.now() + 60_000; // the free service allows about 20 checks a minute
        if (!r.ok) throw new Error(String(r.status));
        const { matches } = await r.json() as { matches: LtMatch[] };
        return matches
          .filter(m => m.rule.issueType !== 'misspelling' && !/^(MORFOLOGIK|HUNSPELL|.*SPELLER)/.test(m.rule.id))
          .map((m): Issue => ({
            from: m.offset, to: m.offset + m.length, word: text.slice(m.offset, m.offset + m.length), message: m.message,
            replacements: m.replacements.slice(0, 6).map(x => x.value), rule: m.rule.id,
            kind: m.rule.issueType === 'style' || m.rule.category?.id === 'STYLE' || m.rule.category?.id === 'REDUNDANCY' ? 'style' : 'grammar',
          }));
      });
    p.catch(() => grammarCache.delete(key));
    grammarCache.set(key, p);
    if (grammarCache.size > 400) grammarCache.delete(grammarCache.keys().next().value!);
  }
  return p.catch(() => []);
}
