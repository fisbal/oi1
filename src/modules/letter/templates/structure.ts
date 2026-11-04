// Finds the structure of a text the way a careful person would (Martin, 2026-11-03: "comme si c'était toi"):
// "Étape 3 : Analyse…", "Solution 2 :" followed by its title on the next line, "3.3 Leadership…" typed as plain text,
// "Introduction :" or "Conclusion de l'analyse :" inside a part, bold lines, and real Word headings. Each title gets
// the level its place in the work gives it (3.1 under Étape 3 is level 2, Solution 2 inside Étape 4 is level 2…).
// Lines of an enumeration ("…entre autres," then "de réduire…;", "de limiter…;") become a bulleted list.
// Not a word is changed: only the punctuation around a title's number (" : ") and a colon left at its end.
import type { JSONContent } from '@tiptap/core';

export const nodeText = (n: JSONContent): string => (n.text ?? '') + (n.content ?? []).map(nodeText).join('');
/** A line of the table of contents In 1 made (its page number after a tab with dots): never a title, never "typed by hand". */
export const isTocLine = (n: JSONContent | null | undefined): boolean =>
  !!n && n.type === 'paragraph' && /\*$/.test(String(n.attrs?.tabStops ?? '')) && nodeText(n).includes('\t');
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const allBold = (n: JSONContent) => !!n.content?.length && n.content.some(c => c.type === 'text' && c.text?.trim())
  && n.content.every(c => c.type !== 'text' || !c.text?.trim() || c.marks?.some(m => m.type === 'bold'));

/** Words that open a numbered part of a school work, in the 5 languages. */
const KW = String.raw`(?:[ée]tape|step|partie|part|chapitre|chapter|section|phase|axe|question|solution|hypoth[eè]se|recommandation|recommendation|annexe|appendix|module|th[eè]me|objectif|objective|volet|t[aâ]che|task|mandat|activit[eé]|activity|exercice|exercise|probl[eè]me|problem|cas|case|le[cç]on|lesson|unit[eé]|unit|paso|parte|cap[ií]tulo|etapa|secci[oó]n|anexo|schritt|teil|kapitel|abschnitt|aufgabe|anhang)`;
const KW_RE = new RegExp(String.raw`^(${KW})\s+(\d{1,2}|[IVXLC]{1,5}|[A-H])(?![\p{L}\d])\s*(?:([:.–—)-])\s*|(?=\p{Lu})|$)(.*)$`, 'iu');
const NUM_RE = /^(\d{1,2}(?:\.\d{1,2}){0,3})(?:[.)]|\s*[–—:-])?\s+(\p{Lu}.*)$/u;
/** Part names that often stand on their own line, with or without a colon, inside a part too. */
const SUB_RE = /^(?:introduction|conclusion|synth[eè]se|r[eé]sum[eé]|bilan|recommandations?|discussion|limites|m[eé]thod(?:e|ologie)|r[eé]sultats|contexte|mise en contexte|objectifs?|probl[eé]matique|analyse|annexes?|summary|abstract|background|method(?:s|ology)?|results|findings|limitations|recommendations?|overview|context|introducci[oó]n|conclusi[oó]n|einleitung|fazit|zusammenfassung)\b/i;
const APPX_RE = /^(?:annexe|appendix|anexo|anhang)/i;
const END_SENTENCE = /[.!?…]$/;

export type TitleWhy = 'style' | 'keyword' | 'number' | 'part' | 'bold';
export interface Title {
  index: number;
  level: number;
  /** The heading's text, its punctuation tidied (never its words). */
  text: string;
  why: TitleWhy;
  /** The title was on the next line ("Solution 2 :" then "Mise en place…"): that line joins it. */
  joinsNext: boolean;
  /** A title with only its number ("Étape 2 :"): the analysis asks for its name. */
  noName: boolean;
  family?: string;
  number?: string;
}

interface Guess { why: TitleWhy; family?: string; number?: string; rest: string; sep: boolean; sepChar?: string; colonEnd: boolean; depth?: number; qualified?: boolean }

/** Is this line a title the person typed, and of which kind? */
function guess(n: JSONContent, lang: string, known?: (t: string) => boolean): Guess | null {
  if (n.type !== 'paragraph' && n.type !== 'heading') return null;
  const raw = nodeText(n).replace(/\s+/g, ' ').trim();
  if (raw.length < 2 || raw.length > 160) return null;
  const colonEnd = /\s*:$/.test(raw);
  const t = raw.replace(/\s*:$/, '');
  // Several sentences are a paragraph, never a title.
  const body = t.replace(/^\d{1,2}(?:\.\d{1,2}){0,3}[.)]?\s+/, '');
  const sentences = body.replace(/\b(?:p|pp|ex|etc|cf|al|vol|no|éd|ed)\.\s/gi, '').split(/[.!?]\s+(?=\p{Lu})/u).length;
  const k = KW_RE.exec(t);
  if (k && sentences === 1 && t.length <= 140) {
    const rest = k[4].trim();
    // "Question 1 : Expliquez…?" is a title; "Partie 2 de ce travail montre que…" is not (checked by the regex).
    return { why: 'keyword', family: fold(k[1]), number: k[2].toUpperCase(), rest, sep: !!k[3] || !rest, sepChar: k[3], colonEnd };
  }
  const m = NUM_RE.exec(t);
  if (m && sentences === 1 && t.length <= 110 && !/[;,]$/.test(t)) {
    return { why: 'number', number: m[1], rest: m[2].trim(), sep: true, colonEnd, depth: m[1].split('.').length };
  }
  if (known?.(t) && t.length <= 70 && !END_SENTENCE.test(t)) return { why: 'part', rest: t, sep: false, colonEnd, qualified: colonEnd };
  if (t.length <= 70 && SUB_RE.test(t) && !END_SENTENCE.test(t) && !/[;,]$/.test(t) && sentences === 1) {
    const word = SUB_RE.exec(t)![0];
    return { why: 'part', rest: t, sep: false, colonEnd, qualified: colonEnd || t.length > word.length + 1 };
  }
  if (n.type === 'heading') return { why: 'style', rest: t, sep: false, colonEnd };
  if (allBold(n) && t.length <= 70 && !END_SENTENCE.test(t) && !/[;,]$/.test(t)) return { why: 'bold', rest: t, sep: false, colonEnd };
  void lang;
  return null;
}

/** Is this line a numbered part ("Étape 1 …", "3.3 …") or a part name ("Introduction :")? */
export function isTitleLine(n: JSONContent, lang = 'fr'): boolean {
  const g = guess(n, lang);
  return !!g && (g.why === 'keyword' || g.why === 'number' || g.why === 'part');
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/\s*:\s*$/, '').replace(/(?<![.]{2})\.$/, '').trim();

/** Every title of the text with its level. [nodes] are the top blocks of the document. */
export function findTitles(nodes: JSONContent[], lang: string, known?: (t: string) => boolean): Title[] {
  const colon = lang === 'fr' ? ' : ' : ': ';
  const out: Title[] = [];
  const familyLevel = new Map<string, number>();
  let top: { family?: string; number?: string } | null = null; // the open level-1 part
  let last = 0; // level of the last title
  // A cover page (short lines, then a page break near the start): its lines are never parts of the work.
  const brk = nodes.findIndex(x => x.type === 'pageBreak');
  const coverEnd = brk > 0 && brk < 40 && nodes.slice(0, brk).every(x => x.type === 'paragraph' && nodeText(x).length <= 160) ? brk : 0;
  for (let i = coverEnd; i < nodes.length; i++) {
    const n = nodes[i];
    if (isTocLine(n)) continue;
    const g = guess(n, lang, known);
    if (!g) continue;
    // The bold, centered title of a cover page is not a part of the work.
    if (g.why === 'bold' && n.attrs?.textAlign === 'center' && !out.length) continue;
    // A run of numbered lines with nothing between them is a list ("1. Lire le texte."), not titles.
    if (g.why === 'number' && END_SENTENCE.test(nodeText(n).trim())) {
      const next = guess(nodes[i + 1] ?? {}, lang), prev = guess(nodes[i - 1] ?? {}, lang);
      if (next?.why === 'number' && next.depth === g.depth || prev?.why === 'number' && prev.depth === g.depth) continue;
    }
    let level = 1;
    if (g.why === 'keyword') {
      const f = g.family!;
      if (APPX_RE.test(f)) level = 1;
      else if (familyLevel.has(f)) level = familyLevel.get(f)!;
      else {
        // The first family is the work's parts; one met inside a part ("Solution 2" inside "Étape 4") is below it.
        level = top && top.family && top.family !== f ? 2 : 1;
        familyLevel.set(f, level);
      }
    } else if (g.why === 'number') {
      const lead = g.number!.split('.')[0];
      if (top?.family) level = Math.min(g.depth! + (lead === top.number && g.depth! > 1 ? 0 : 1), 3);
      else level = Math.min(g.depth!, 3);
    } else if (g.why === 'part') {
      // "Introduction :" or "Conclusion de l'analyse" inside a part is its sub-title; plain "Conclusion" is a part.
      level = top && (top.family || top.number) && g.qualified ? 2 : 1;
      if (n.type === 'heading') level = Math.max(1, Math.min(Number(n.attrs?.level ?? 1), 3));
    } else if (g.why === 'style') {
      level = Math.max(1, Math.min(Number(n.attrs?.level ?? 1), 3));
    } else {
      level = top ? Math.min(last + 1, 3) : 1;
    }
    // A Word heading the person chose keeps its level when nothing in its words says otherwise.
    if (n.type === 'heading' && g.why === 'bold') level = Math.max(1, Math.min(Number(n.attrs?.level ?? 1), 3));

    // Its name on the next line: "Solution 2 :" then "Mise en place d'une formation…".
    let text = g.why === 'keyword' || g.why === 'number' ? '' : tidy(g.rest);
    let joinsNext = false, noName = false;
    if (g.why === 'keyword' || g.why === 'number') {
      const whole = nodeText(n).replace(/\s+/g, ' ').trim();
      const label = g.why === 'keyword' ? whole.match(new RegExp(`^${KW}\\s+\\S+?(?=[\\s:.–—)-]|$)`, 'iu'))?.[0] ?? ''
        : (g.rest ? whole.slice(0, whole.indexOf(g.rest)).trim() : whole.replace(/\s*:$/, '')) || g.number!;
      let name = tidy(g.rest);
      const next = nodes[i + 1];
      if (!name && next?.type === 'paragraph') {
        const nt = nodeText(next).replace(/\s+/g, ' ').trim();
        if (nt && nt.length <= 100 && !END_SENTENCE.test(nt) && !/[;,]$/.test(nt) && (/^\p{Lu}/u.test(nt) || /:$/.test(whole)) && !guess(next, lang)) {
          name = tidy(nt);
          joinsNext = true;
        }
      }
      noName = !name;
      // The person's own mark stays ("Annexe A – Carte"); a colon goes where there was none ("Étape 5 : Choix").
      const sepc = g.sepChar && g.sepChar !== ':' ? (g.sepChar === '.' || g.sepChar === ')' ? `${g.sepChar} ` : ` ${g.sepChar} `) : colon;
      if (g.why === 'keyword') text = name ? `${label}${g.sepChar || !name.includes(':') ? sepc : ' '}${name}` : label;
      else text = name ? `${label} ${name}` : label;
    }
    out.push({ index: i, level, text, why: g.why, joinsNext, noName, family: g.family, number: g.number });
    if (level === 1) top = { family: g.why === 'keyword' ? g.family : undefined, number: g.why === 'keyword' ? g.number : g.number?.split('.')[0] };
    last = level;
    if (joinsNext) i++;
  }
  return out;
}

/** A heading node with [text]; the person's italic, links… in it are kept when the words did not move. */
export function headingNode(n: JSONContent, level: number, text: string, extra?: Record<string, unknown>): JSONContent {
  const same = nodeText(n).replace(/\s+/g, ' ').trim() === text;
  const content = same
    ? (n.content ?? []).map(c => (c.type === 'text' ? { ...c, marks: (c.marks ?? []).filter(m => m.type !== 'bold' && m.type !== 'textStyle') } : c)).filter(c => c.type !== 'text' || c.text)
    : [{ type: 'text', text }];
  // No spaces left at either end (Word keeps them after "(1 page)  ").
  const ends = [0, content.length - 1];
  for (const k of ends) {
    const c = content[k];
    if (c?.type === 'text') content[k] = { ...c, text: k === 0 ? c.text!.replace(/^\s+/, '') : c.text!.replace(/\s+$/, '') };
  }
  for (let k = content.length - 1; k >= 0; k--) if (content[k].type === 'text' && !content[k].text) content.splice(k, 1);
  if (!content.length) content.push({ type: 'text', text });
  return { type: 'heading', attrs: { level, ...extra }, content };
}

/** The titles applied: typed titles become headings with their level, their name joined when it was on the next line. */
export function applyTitles(nodes: JSONContent[], lang: string, known?: (t: string) => boolean): { nodes: JSONContent[]; titles: Title[] } {
  const titles = findTitles(nodes, lang, known);
  const at = new Map(titles.map(t => [t.index, t]));
  const out: JSONContent[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const t = at.get(i);
    if (!t) { out.push(nodes[i]); continue; }
    const keep = nodes[i].type === 'heading' ? { textAlign: nodes[i].attrs?.textAlign } : undefined;
    out.push(headingNode(nodes[i], t.level, t.text, keep?.textAlign ? keep : undefined));
    if (t.joinsNext) i++;
  }
  return { nodes: out, titles };
}

const MARK = /^\s*[-–—•▪●◦*]\s+/;
const looksItem = (s: string) => s.length > 1 && s.length <= 240 && (/^\p{Ll}/u.test(s) || MARK.test(s)) && !/:$/.test(s);

/**
 * Lines of an enumeration typed as paragraphs become a bulleted list: after a line ending with ":" or "," come 2+
 * short lines starting in lower case (or with "-", "•"), ending with ";", "," or nothing, the last one with "." too.
 * Lines that each start with "-" or "•" are a list wherever they are. The "-" or "•" goes; the words stay.
 */
export function makeLists(nodes: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    out.push(n);
    if (n.type !== 'paragraph' && n.type !== 'heading') continue;
    const lead = nodeText(n).trim();
    const items: JSONContent[] = [];
    let j = i + 1;
    while (j < nodes.length && nodes[j].type === 'paragraph') {
      const s = nodeText(nodes[j]).trim();
      if (!looksItem(s)) break;
      items.push(nodes[j]);
      j++;
      if (/\.$/.test(s) && !MARK.test(s)) break;
    }
    const marked = items.length >= 2 && items.every(x => MARK.test(nodeText(x)));
    if (items.length >= 2 && (/[:,]$/.test(lead) || marked) && items.every(x => !/^\s*\d/.test(nodeText(x)))) {
      out.push({
        type: 'bulletList',
        content: items.map(x => ({ type: 'listItem', content: [stripMark(x)] })),
      });
      i = j - 1;
    }
  }
  return out;
}

function stripMark(n: JSONContent): JSONContent {
  const content = (n.content ?? []).slice();
  const first = content[0];
  if (first?.type === 'text' && MARK.test(first.text ?? '')) content[0] = { ...first, text: first.text!.replace(MARK, '') };
  const attrs = { ...(n.attrs ?? {}) };
  delete attrs.indentFirst; delete attrs.indentLeft;
  return { ...n, attrs, content: content.filter(c => c.type !== 'text' || c.text) };
}
