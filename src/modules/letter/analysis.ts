// "Analyse et correction" (Martin, 2026-11-03: "avec ta logique premium"): reads the whole work like a careful
// corrector and lists what to fix, each with its fix. Structure (titles not set as titles, a part without a name,
// a missing number in a series, leftover instructions like "(1 page)", fields still to fill), the norm's sources
// (a theory named without its year, a known concept without its author, no References section), and the language
// (French spacing before : ; ! ?, double spaces, common misspellings, a word typed twice, simple agreements).
// Text fixes go in as tracked changes: the person keeps or refuses each one in Révision. An AI pass can add the
// grammar mistakes rules cannot see, always as tracked changes on exact words, never a rewrite.
import type { Editor, JSONContent } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { applyTitles, findTitles, isTocLine, makeLists, nodeText } from './templates/structure';
import { isTracking, setTracking } from './review';

export type Group = 'layout' | 'method' | 'structure' | 'sources' | 'language';
export interface Edit { from: number; to: number; insert: string }
export interface Finding {
  id: string;
  group: Group;
  /** i18n key of the message, with its values. */
  key: string;
  vars?: Record<string, string | number>;
  /** The words concerned, shown under the message. */
  excerpt?: string;
  /** Where to go in the text. */
  at?: number;
  /** Text fixes, put in as tracked changes. */
  edits?: Edit[];
  /** A fix that changes blocks: titles and lists, or references added at the end. */
  action?: 'structure' | 'refs' | 'fill' | 'empties' | 'toc' | 'pages' | 'breaks' | 'norm' | 'pagenum' | 'reorganize';
  refs?: string[];
}

interface Block { pos: number; end: number; text: string; map: number[]; node: PmNode; top: number }

/** Every paragraph and title with its text and where each letter is in the document. */
function blocksOf(doc: PmNode): Block[] {
  const out: Block[] = [];
  let top = -1;
  doc.forEach((child, offset, index) => {
    top = index;
    const visit = (node: PmNode, pos: number) => {
      if (node.isTextblock) {
        let text = '';
        const map: number[] = [];
        node.forEach((c, off) => {
          const p = pos + 1 + off;
          // Words struck out by a tracked change are already gone for the reader: the analysis skips them.
          if (c.isText && c.marks.some(m => m.type.name === 'deletion')) return;
          if (c.isText) for (let i = 0; i < c.text!.length; i++) { text += c.text![i]; map.push(p + i); }
          else { text += '￼'; map.push(p); }
        });
        map.push(pos + 1 + node.content.size);
        out.push({ pos, end: pos + node.nodeSize, text, map, node, top });
        return;
      }
      node.forEach((c, off) => visit(c, pos + 1 + off));
    };
    visit(child, offset);
  });
  return out;
}

const range = (b: Block, a: number, z: number, insert: string): Edit => ({ from: b.map[a], to: b.map[z], insert });

/** The document's language from its most common little words. */
export function docLanguage(text: string): 'fr' | 'en' | 'other' {
  const w = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  let fr = 0, en = 0;
  const FR = new Set(['le', 'la', 'les', 'des', 'est', 'une', 'et', 'du', 'dans', 'que', 'pour', 'qui', 'sur', 'avec', 'pas', 'cette', 'aux']);
  const EN = new Set(['the', 'and', 'is', 'of', 'to', 'in', 'that', 'for', 'with', 'this', 'are', 'was', 'on', 'be', 'it']);
  for (const x of w) { if (FR.has(x)) fr++; if (EN.has(x)) en++; }
  if (fr > en * 1.3 && fr > 3) return 'fr';
  if (en > fr * 1.3 && en > 3) return 'en';
  return 'other';
}

// ---------- sources: the classics of the social sciences, business and education ----------

interface Classic { name: RegExp; label: string; cite: string; year: number; ref: string; concepts?: RegExp }
/** Well-known authors and their founding work, to cite in APA (the person checks the edition they read). */
export const CLASSICS: Classic[] = [
  { name: /\bmaslow\b/iu, label: 'Maslow', cite: 'Maslow', year: 1943, ref: 'Maslow, A. H. (1943). A theory of human motivation. Psychological Review, 50(4), 370–396.', concepts: /\b(?:pyramide des besoins|hi[ée]rarchie des besoins|hierarchy of needs)\b/iu },
  { name: /\bshannon\s+(?:et|and|&)\s+weaver\b/iu, label: 'Shannon et Weaver', cite: 'Shannon et Weaver', year: 1949, ref: 'Shannon, C. E., & Weaver, W. (1949). The mathematical theory of communication. University of Illinois Press.' },
  { name: /\bherzberg\b/iu, label: 'Herzberg', cite: 'Herzberg et al.', year: 1959, ref: 'Herzberg, F., Mausner, B., & Snyderman, B. B. (1959). The motivation to work. Wiley.', concepts: /\b(?:th[ée]orie (?:bifactorielle|des deux facteurs)|facteurs d['’]hygi[eè]ne|two-factor theory|hygiene factors)\b/iu },
  { name: /\bmcgregor\b/iu, label: 'McGregor', cite: 'McGregor', year: 1960, ref: 'McGregor, D. (1960). The human side of enterprise. McGraw-Hill.', concepts: /\b(?:th[ée]orie x et y|theory x and theory y)\b/iu },
  { name: /\bvroom\b/iu, label: 'Vroom', cite: 'Vroom', year: 1964, ref: 'Vroom, V. H. (1964). Work and motivation. Wiley.', concepts: /\b(?:th[ée]orie des attentes|expectancy theory)\b/iu },
  { name: /\bhofstede\b/iu, label: 'Hofstede', cite: 'Hofstede', year: 1980, ref: 'Hofstede, G. (1980). Culture’s consequences: International differences in work-related values. Sage.', concepts: /\b(?:distance hi[ée]rarchique|[ée]vitement de l['’]incertitude|power distance|uncertainty avoidance)\b/iu },
  { name: /\bthorndike\b/iu, label: 'Thorndike', cite: 'Thorndike', year: 1920, ref: 'Thorndike, E. L. (1920). A constant error in psychological ratings. Journal of Applied Psychology, 4(1), 25–29.', concepts: /\b(?:effet de halo|halo effect)\b/iu },
  { name: /\blewin\b/iu, label: 'Lewin', cite: 'Lewin', year: 1947, ref: 'Lewin, K. (1947). Frontiers in group dynamics: Concept, method and reality in social science. Human Relations, 1(1), 5–41.', concepts: /\b(?:d[ée]cristallisation|unfreez(?:e|ing))\b/iu },
  { name: /\bmintzberg\b/iu, label: 'Mintzberg', cite: 'Mintzberg', year: 1979, ref: 'Mintzberg, H. (1979). The structuring of organizations. Prentice-Hall.' },
  { name: /\btuckman\b/iu, label: 'Tuckman', cite: 'Tuckman', year: 1965, ref: 'Tuckman, B. W. (1965). Developmental sequence in small groups. Psychological Bulletin, 63(6), 384–399.' },
  { name: /\bkotter\b/iu, label: 'Kotter', cite: 'Kotter', year: 1996, ref: 'Kotter, J. P. (1996). Leading change. Harvard Business School Press.' },
  { name: /\bschein\b/iu, label: 'Schein', cite: 'Schein', year: 1985, ref: 'Schein, E. H. (1985). Organizational culture and leadership. Jossey-Bass.' },
  { name: /\bdeci\s+(?:et|and|&)\s+ryan\b/iu, label: 'Deci et Ryan', cite: 'Deci et Ryan', year: 1985, ref: 'Deci, E. L., & Ryan, R. M. (1985). Intrinsic motivation and self-determination in human behavior. Plenum.', concepts: /\b(?:th[ée]orie de l['’]autod[ée]termination|self-determination theory)\b/iu },
  { name: /\bhersey\s+(?:et|and|&)\s+blanchard\b/iu, label: 'Hersey et Blanchard', cite: 'Hersey et Blanchard', year: 1969, ref: 'Hersey, P., & Blanchard, K. H. (1969). Life cycle theory of leadership. Training and Development Journal, 23(5), 26–34.', concepts: /\b(?:leadership situationnel|situational leadership)\b/iu },
  { name: /\badams\b(?=[^.]{0,40}\b(?:[ée]quit[ée]|equity))/iu, label: 'Adams', cite: 'Adams', year: 1965, ref: 'Adams, J. S. (1965). Inequity in social exchange. Advances in Experimental Social Psychology, 2, 267–299.', concepts: /\b(?:th[ée]orie de l['’][ée]quit[ée]|equity theory)\b/iu },
  { name: /\bbandura\b/iu, label: 'Bandura', cite: 'Bandura', year: 1977, ref: 'Bandura, A. (1977). Social learning theory. Prentice-Hall.', concepts: /\b(?:sentiment d['’]efficacit[ée] personnelle|auto-efficacit[ée]|self-efficacy)\b/iu },
  { name: /\bburns\b(?=[^.]{0,40}\bleadership)/iu, label: 'Burns', cite: 'Burns', year: 1978, ref: 'Burns, J. M. (1978). Leadership. Harper & Row.', concepts: /\b(?:leadership transformationnel|transformational leadership)\b/iu },
  { name: /\bhackman\s+(?:et|and|&)\s+oldham\b/iu, label: 'Hackman et Oldham', cite: 'Hackman et Oldham', year: 1976, ref: 'Hackman, J. R., & Oldham, G. R. (1976). Motivation through the design of work: Test of a theory. Organizational Behavior and Human Performance, 16(2), 250–279.' },
  { name: /\bfiedler\b/iu, label: 'Fiedler', cite: 'Fiedler', year: 1967, ref: 'Fiedler, F. E. (1967). A theory of leadership effectiveness. McGraw-Hill.' },
  { name: /\blocke\b(?=[^.]{0,40}\b(?:objectifs?|goals?))/iu, label: 'Locke', cite: 'Locke', year: 1968, ref: 'Locke, E. A. (1968). Toward a theory of task motivation and incentives. Organizational Behavior and Human Performance, 3(2), 157–189.', concepts: /\b(?:th[ée]orie (?:de la fixation|des) objectifs|goal-setting theory)\b/iu },
  { name: /\bblake\s+(?:et|and|&)\s+mouton\b/iu, label: 'Blake et Mouton', cite: 'Blake et Mouton', year: 1964, ref: 'Blake, R. R., & Mouton, J. S. (1964). The managerial grid. Gulf.', concepts: /\b(?:grille manag[ée]riale|managerial grid)\b/iu },
  { name: /\btaylor\b(?=[^.]{0,60}\b(?:scientifique|scientific|taylorisme|organisation))/iu, label: 'Taylor', cite: 'Taylor', year: 1911, ref: 'Taylor, F. W. (1911). The principles of scientific management. Harper & Brothers.', concepts: /\b(?:organisation scientifique du travail|scientific management)\b/iu },
  { name: /\bfayol\b/iu, label: 'Fayol', cite: 'Fayol', year: 1916, ref: 'Fayol, H. (1916). Administration industrielle et générale. Dunod.' },
  { name: /\bthomas\s+(?:et|and|&)\s+kilmann\b/iu, label: 'Thomas et Kilmann', cite: 'Thomas et Kilmann', year: 1974, ref: 'Thomas, K. W., & Kilmann, R. H. (1974). Thomas-Kilmann conflict mode instrument. Xicom.' },
  { name: /\bbass\b(?=[^.]{0,40}\bleadership)/iu, label: 'Bass', cite: 'Bass', year: 1985, ref: 'Bass, B. M. (1985). Leadership and performance beyond expectations. Free Press.' },
];

/** Right after an author's name: " (1943)", ", 1943", " 1943", " et al. (1959)". */
const YEAR_NEAR = /^(?:\s+et\s+al\.)?\s*[(,]?\s*(?:19|20)\d\d/u;
export const REFS_TITLE = /^(?:r[ée]f[ée]rences(?: bibliographiques)?|ouvrages cit[ée]s|bibliographie|m[ée]diagraphie|liste de r[ée]f[ée]rences|references|works cited|bibliography|referencias|refer[êe]ncias|literaturverzeichnis)(?:\s*\([^)]*\))?$/i;

// ---------- language ----------

/** Common misspellings: [wrong, right]. Whole words, any case (the case of the first letter is kept). */
const FR_WORDS: [string, string][] = [
  ['culturele', 'culturelle'], ['culturels', 'culturels'], ['interculturele', 'interculturelle'], ['interculturel', 'interculturel'],
  ['ambiguité', 'ambiguïté'], ['ambiguite', 'ambiguïté'], ['ambigue', 'ambiguë'], ['parmis', 'parmi'], ['developpement', 'développement'],
  ['dévelopement', 'développement'], ['dévellopement', 'développement'], ['environement', 'environnement'], ['personel', 'personnel'],
  ['professionel', 'professionnel'], ['professionelle', 'professionnelle'], ['traditionel', 'traditionnel'], ['traditionelle', 'traditionnelle'],
  ['organisationel', 'organisationnel'], ['organisationelle', 'organisationnelle'], ['rationel', 'rationnel'], ['rationelle', 'rationnelle'],
  ['fonctionement', 'fonctionnement'], ['addresse', 'adresse'], ['connection', 'connexion'], ['apellé', 'appelé'], ['apeller', 'appeler'],
  ['language', 'langage'], ['exemples', 'exemples'], ['malgrès', 'malgré'], ['quelques soit', 'quel que soit'], ['quelque soit', 'quel que soit'],
  ['en terme de', 'en termes de'], ['au jour d’aujourd’hui', 'aujourd’hui'], ['sa veut dire', 'ça veut dire'], ['ou est', 'où est'],
  ['néamoins', 'néanmoins'], ['neanmoins', 'néanmoins'], ['différament', 'différemment'], ['différement', 'différemment'], ['notament', 'notamment'],
  ['évidament', 'évidemment'], ['apparament', 'apparemment'], ['fréquament', 'fréquemment'], ['succés', 'succès'], ['procés', 'procès'],
  ['accés', 'accès'], ['excés', 'excès'], ['problémes', 'problèmes'], ['systéme', 'système'], ['régle', 'règle'], ['collégue', 'collègue'],
  ['efficasse', 'efficace'], ['bienvenu à', 'bienvenue à'], ['comme même', 'quand même'], ['pallier à', 'pallier'], ['hierarchique', 'hiérarchique'],
  ['hiérarchiques', 'hiérarchiques'], ['mobilisateur', 'mobilisateur'], ['ressource humaine', 'ressources humaines'],
].filter(([a, b]) => a !== b) as [string, string][];
const EN_WORDS: [string, string][] = [
  ['alot', 'a lot'], ['teh', 'the'], ['recieve', 'receive'], ['recieved', 'received'], ['seperate', 'separate'], ['definately', 'definitely'],
  ['occured', 'occurred'], ['untill', 'until'], ['wich', 'which'], ['becuase', 'because'], ['enviroment', 'environment'], ['goverment', 'government'],
  ['managment', 'management'], ['occurence', 'occurrence'], ['accomodate', 'accommodate'], ['acheive', 'achieve'], ['arguement', 'argument'],
  ['beleive', 'believe'], ['calender', 'calendar'], ['commited', 'committed'], ['concious', 'conscious'], ['existance', 'existence'],
  ['independant', 'independent'], ['neccessary', 'necessary'], ['noticable', 'noticeable'], ['publically', 'publicly'], ['reccomend', 'recommend'],
  ['succesful', 'successful'], ['tommorow', 'tomorrow'], ['truely', 'truly'], ['wierd', 'weird'], ['thier', 'their'], ['irregardless', 'regardless'],
];
/** Names of places and peoples' countries written in lower case by mistake. */
const FR_PROPER = ['mexique', 'canada', 'québec', 'france', 'états-unis', 'chine', 'japon', 'allemagne', 'espagne', 'italie', 'europe', 'amérique', 'afrique', 'asie', 'montréal', 'ontario', 'belgique', 'suisse', 'haïti', 'maroc', 'algérie', 'tunisie', 'sénégal', 'brésil', 'inde', 'russie'];
const REPEAT_OK = new Set(['nous', 'vous', 'que', 'had', 'that', 'is', 'elle', 'il', 'bla']);
/** Notes from the assignment left in the text: "(1 page)", "(max. 500 mots)", "[à compléter]"… */
const LEFTOVER = /\s*(?:\((?:\s*(?:environ|env\.|max(?:imum)?\.?|min(?:imum)?\.?)?\s*\d+\s*(?:à\s*\d+\s*)?(?:pages?|p\.|mots|words|lignes|lines|paragraphes?|paragraphs?)\s*(?:max(?:imum)?\.?)?)\)|\[\s*(?:à compléter|a completer|à faire|todo|to do|tbd|xxx)\s*\]|\bxxx+\b|\?\?\?+|\blorem ipsum\b[^.]*\.?)/giu;

const keepCase = (src: string, out: string) => (/^\p{Lu}/u.test(src) ? out[0].toUpperCase() + out.slice(1) : out);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface AnalyzeOptions {
  lang?: string;
  known?: (t: string) => boolean;
  work?: boolean;
  /** How the chosen norm cites: years are asked only in author-date styles, the comma only in APA. */
  cite?: 'apa' | 'authorYear' | 'mla' | 'numeric' | 'notes' | 'mcgill' | 'oscola' | 'bluebook';
}

/** Everything worth fixing in the document, in reading order inside each group. */
export function analyze(doc: PmNode, opts: AnalyzeOptions = {}): Finding[] {
  const out: Finding[] = [];
  const blocks = blocksOf(doc);
  const all = blocks.map(b => b.text).join('\n');
  const lang = docLanguage(all) === 'en' ? 'en' : docLanguage(all) === 'fr' ? 'fr' : (opts.lang === 'en' ? 'en' : 'fr');
  const apos = (all.match(/’/g)?.length ?? 0) >= (all.match(/'/g)?.length ?? 0) ? '’' : '\'';
  let n = 0;
  const add = (f: Omit<Finding, 'id'>) => out.push({ id: `f${n++}`, ...f });
  const tops: JSONContent[] = (doc.toJSON().content ?? []) as JSONContent[];
  const topPos: number[] = [];
  doc.forEach((_c, off) => topPos.push(off));

  // ---- structure: titles and lists the reading finds, set as they should be
  const listed = makeLists(tops);
  const madeLists = listed.filter(x => x.type === 'bulletList').length - tops.filter(x => x.type === 'bulletList').length;
  const titles = findTitles(tops, lang, opts.known);
  const toSet = titles.filter(ti => {
    const node = tops[ti.index];
    return node.type !== 'heading' || Number(node.attrs?.level ?? 1) !== ti.level || nodeText(node).replace(/\s+/g, ' ').trim() !== ti.text || ti.joinsNext;
  });
  if (toSet.length || madeLists > 0) {
    add({
      group: 'structure', key: madeLists > 0 && toSet.length ? 'ana.titlesLists' : toSet.length ? 'ana.titles' : 'ana.lists',
      vars: { n: toSet.length, lists: Math.max(madeLists, 0) },
      excerpt: toSet.slice(0, 6).map(ti => `${'  '.repeat(ti.level - 1)}${ti.text}`).join('\n') + (toSet.length > 6 ? '\n…' : ''),
      at: toSet.length ? topPos[toSet[0].index] : undefined, action: 'structure',
    });
  }
  for (const ti of titles) if (ti.noName) add({ group: 'structure', key: 'ana.noName', vars: { title: ti.text }, excerpt: ti.text, at: topPos[ti.index] });
  // A series with a hole: "Solution 2" and "Solution 3" but no "Solution 1"; "3.1, 3.2, 3.4".
  const series = new Map<string, { label: string; nums: number[]; at: number }>();
  const roman = (s: string) => { const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 }; let r = 0; for (let i = 0; i < s.length; i++) { const a = v[s[i]], b = v[s[i + 1]] ?? 0; r += a < b ? -a : a; } return r; };
  for (const ti of titles) {
    if (!ti.number) continue;
    let key: string, label: string, num: number;
    if (ti.why === 'keyword') {
      const raw = ti.number;
      num = /^\d+$/.test(raw) ? Number(raw) : /^[IVXLC]+$/.test(raw) ? roman(raw) : raw.charCodeAt(0) - 64;
      key = `k:${ti.family}`; label = ti.text.split(/\s+/)[0];
    } else {
      const parts = ti.number.split('.');
      num = Number(parts.pop());
      key = `n:${parts.join('.')}`; label = parts.length ? `${parts.join('.')}.` : '';
    }
    const s = series.get(key) ?? { label, nums: [], at: topPos[ti.index] };
    s.nums.push(num);
    series.set(key, s);
  }
  for (const s of series.values()) {
    const max = Math.max(...s.nums);
    const missing: number[] = [];
    for (let i = 1; i <= max; i++) if (!s.nums.includes(i)) missing.push(i);
    if (missing.length && missing.length <= 3 && s.nums.length >= 2) add({ group: 'structure', key: 'ana.gap', vars: { missing: missing.map(m => `${s.label}${s.label.endsWith('.') ? '' : ' '}${m}`).join(', ') }, at: s.at });
  }
  // Notes of the assignment left in the text.
  for (const b of blocks) {
    LEFTOVER.lastIndex = 0;
    for (let m = LEFTOVER.exec(b.text); m; m = LEFTOVER.exec(b.text)) {
      add({ group: 'structure', key: 'ana.leftover', vars: { text: m[0].trim() }, excerpt: m[0].trim(), at: b.map[m.index], edits: [range(b, m.index, m.index + m[0].length, '')] });
    }
  }
  // Fields still to fill: yellow [fields] of a model.
  let fields = 0, fieldAt: number | undefined;
  doc.descendants((node, pos) => {
    if (node.isText && node.marks.some(m => m.type.name === 'highlight' && String(m.attrs.color).toUpperCase() === '#FFF2A8') && /\[.+\]/.test(node.text ?? '')) { fields++; fieldAt ??= pos; }
    return true;
  });
  if (fields) add({ group: 'structure', key: 'ana.fields', vars: { n: fields }, at: fieldAt, action: 'fill' });


  // ---- method: the way of working that makes Word-like tools do the work (Martin: "s'il n'utilise pas la bonne méthode")
  const typed = titles.filter(ti => tops[ti.index].type !== 'heading');
  if (typed.length >= 2) add({ group: 'method', key: typed.some(ti => ti.why === 'bold') ? 'ana.m.boldTitles' : 'ana.m.typedTitles', vars: { n: typed.length }, excerpt: typed.slice(0, 3).map(ti => nodeText(tops[ti.index]).trim()).join(' · '), at: topPos[typed[0].index], action: 'structure' });
  // Empty lines to go to the next page: a page break does it and never moves.
  let run = 0, runs = 0, empties = 0;
  // A cover page spaces its lines with empty lines before its page break: that is its layout, not a way to change page.
  const firstBreak = tops.findIndex(x => x.type === 'pageBreak');
  const afterCover = firstBreak >= 0 && firstBreak < 40 && tops.slice(0, firstBreak).every(x => x.type === 'paragraph' && nodeText(x).length <= 160) ? tops.slice(firstBreak + 1) : tops;
  for (let i = 1; i < afterCover.length; i++) if (isBlank(afterCover[i]) && isBlank(afterCover[i - 1])) empties++;
  for (const x of [...afterCover, { type: 'end' } as JSONContent]) {
    if (x.type === 'paragraph' && !nodeText(x).trim() && !x.content?.length) run++;
    else { if (run >= 4) runs++; run = 0; }
  }
  if (runs) add({ group: 'method', key: 'ana.m.pages', vars: { n: runs }, action: 'pages' });
  else if (empties >= 2) add({ group: 'method', key: 'ana.m.empties', vars: { n: empties }, action: 'empties' });
  // Spaces or tabs to indent a paragraph: the norm's first-line indent does it.
  const indents: Edit[] = [];
  for (const b of blocks) { const m = /^[ \t\u00a0]{2,}/.exec(b.text); if (m && b.text.trim()) indents.push(range(b, 0, m[0].length, '')); }
  if (indents.length >= 2) add({ group: 'method', key: 'ana.m.indent', vars: { n: indents.length }, at: indents[0].from, edits: indents });
  // A table of contents typed by hand ("Introduction ........ 3"): In 1 makes it and keeps it right.
  const handToc = blocks.filter(b => !isTocLine(b.node.toJSON() as JSONContent) && /(?:\.{4,}|…{2,}|_{4,}|\t)\s*\d{1,3}\s*$/.test(b.text)).length;
  if (handToc >= 2) add({ group: 'method', key: 'ana.m.toc', vars: { n: handToc }, action: 'toc' });
  // Lines cut by hand inside a sentence (Shift+Enter): the text then breaks badly when the page changes.
  let cuts = 0;
  doc.descendants(node => {
    if (!node.isTextblock) return true;
    node.forEach((c, _o, i) => { if (c.type.name === 'hardBreak' && /^\p{Ll}/u.test(node.maybeChild(i + 1)?.text ?? '')) cuts++; });
    return false;
  });
  if (cuts >= 2) add({ group: 'method', key: 'ana.m.breaks', vars: { n: cuts }, action: 'breaks' });

  // ---- sources (APA and the other author-date norms)
  const refsAt = blocks.findIndex(b => b.node.type.name === 'heading' && REFS_TITLE.test(b.text.trim()));
  const refsText = refsAt >= 0 ? blocks.slice(refsAt + 1).map(b => b.text).join('\n') : '';
  const body = refsAt >= 0 ? blocks.slice(0, refsAt) : blocks;
  const needRefs: string[] = [];
  // Notes (Chicago, McGill…) carry their sources in the footnotes.
  let notesText = '';
  doc.descendants(node => { if (node.type.name === 'footnote') notesText += ` ${node.attrs.text ?? ''}`; return true; });
  for (const c of CLASSICS) {
    const hits: { b: Block; i: number; len: number }[] = [];
    for (const b of body) {
      const re = new RegExp(c.name.source, 'giu');
      for (let m = re.exec(b.text); m; m = re.exec(b.text)) hits.push({ b, i: m.index, len: m[0].length });
    }
    const surname = c.ref.split(',')[0];
    if (hits.length) {
      const dated = hits.some(h => YEAR_NEAR.test(h.b.text.slice(h.i + h.len)) || /\(\s*$/.test(h.b.text.slice(Math.max(0, h.i - 2), h.i)));
      const authorDate = !opts.cite || opts.cite === 'apa' || opts.cite === 'authorYear';
      if (!dated && authorDate) {
        const h = hits[0];
        add({ group: 'sources', key: 'ana.noYear', vars: { who: c.label, year: c.year }, excerpt: h.b.text.slice(Math.max(0, h.i - 30), h.i + h.len + 30).trim(), at: h.b.map[h.i],
          edits: [range(h.b, h.i + h.len, h.i + h.len, ` (${c.year})`)] });
      }
      for (const h of hits) {
        const word = h.b.text.slice(h.i, h.i + h.len);
        if (/^\p{Ll}/u.test(word)) add({ group: 'language', key: 'ana.capital', vars: { word, right: c.label }, excerpt: word, at: h.b.map[h.i], edits: [range(h.b, h.i, h.i + h.len, c.label)] });
      }
      if (!new RegExp(`\\b${esc(surname)}\\b`, 'iu').test(refsText)) needRefs.push(c.ref);
    } else if (c.concepts && !new RegExp(`\\b${esc(surname)}\\b`, 'iu').test(refsText + notesText)) {
      for (const b of body) {
        const m = new RegExp(c.concepts.source, 'iu').exec(b.text);
        if (!m) continue;
        const end = m.index + m[0].length;
        const ad = !opts.cite || opts.cite === 'apa' || opts.cite === 'authorYear';
        add({ group: 'sources', key: 'ana.concept', vars: { concept: m[0], who: c.label, year: c.year }, excerpt: b.text.slice(Math.max(0, m.index - 30), end + 30).trim(), at: b.map[m.index],
          edits: ad ? [range(b, end, end, opts.cite === 'authorYear' ? ` (${c.cite} ${c.year})` : ` (${c.cite}, ${c.year})`)] : undefined, refs: new RegExp(`\\b${esc(surname)}\\b`, 'iu').test(refsText) ? [] : [c.ref] });
        break;
      }
    }
  }
  // "(Maslow 1943)": APA puts a comma before the year.
  for (const b of !opts.cite || opts.cite === 'apa' ? body : []) {
    const re = /\((\p{Lu}[\p{L}’'-]+(?:\s+(?:et|and|&)\s+\p{Lu}[\p{L}’'-]+)?(?:\s+et\s+al\.)?)\s+((?:19|20)\d\d)\)/gu;
    for (let m = re.exec(b.text); m; m = re.exec(b.text)) {
      const at = m.index + 1 + m[1].length;
      add({ group: 'sources', key: 'ana.citeComma', vars: { cite: m[0] }, excerpt: m[0], at: b.map[m.index], edits: [range(b, at, at, ',')] });
    }
  }
  if (needRefs.length && opts.work !== false) add({ group: 'sources', key: refsAt >= 0 ? 'ana.refsMissing' : 'ana.refsNone', vars: { n: needRefs.length }, excerpt: needRefs.map(r => r.split('(')[0].trim()).join(' · '), action: 'refs', refs: needRefs });

  // ---- language
  const spaceEdits: Edit[] = [], dbl: Edit[] = [], after: Edit[] = [];
  for (const b of body) {
    if (/:\/\/|www\./.test(b.text)) continue;
    const t = b.text;
    if (lang === 'fr') {
      // French: a (non-breaking) space before : ; ! ? and none of the English kind ("Étape 2:" → "Étape 2 :").
      for (let i = 1; i < t.length; i++) {
        const ch = t[i];
        if (!':;!?'.includes(ch)) continue;
        const prev = t[i - 1];
        if (/\s| | /.test(prev) || /[!?:;)]/.test(prev) && ch !== ':' || ch === ':' && /\d/.test(prev) && /\d/.test(t[i + 1] ?? '')) continue;
        if (ch === '?' && t[i + 1] === '?') continue;
        spaceEdits.push(range(b, i, i, ' '));
      }
    }
    for (let m = / {2,}/g.exec(t), re = / {2,}/g; m; m = re.exec(t)) { if (m.index > 0 && m.index + m[0].length < t.length) dbl.push(range(b, m.index, m.index + m[0].length, ' ')); }
    const reAfter = /([,;])(?=\p{L})|([.!?])(?=\p{Lu}\p{Ll}{2,})/gu;
    for (let m = reAfter.exec(t); m; m = reAfter.exec(t)) {
      if (/\d/.test(t[m.index - 1] ?? '') && /\d/.test(t[m.index + 1] ?? '')) continue;
      if (m[2] && /\b\p{Lu}$/u.test(t.slice(0, m.index))) continue; // "M.Tremblay", initials
      after.push(range(b, m.index + 1, m.index + 1, ' '));
    }
  }
  if (spaceEdits.length) add({ group: 'language', key: 'ana.frSpace', vars: { n: spaceEdits.length }, at: spaceEdits[0].from, edits: spaceEdits });
  if (dbl.length) add({ group: 'language', key: 'ana.double', vars: { n: dbl.length }, at: dbl[0].from, edits: dbl });
  if (after.length) add({ group: 'language', key: 'ana.after', vars: { n: after.length }, at: after[0].from, edits: after });

  const words = lang === 'fr' ? FR_WORDS : EN_WORDS;
  for (const b of body) {
    const t = b.text;
    for (const [wrong, right] of words) {
      const re = new RegExp(`(?<![\\p{L}-])${esc(wrong).replace(/['’]/g, '[\'’]')}(?![\\p{L}’'-])`, 'giu');
      for (let m = re.exec(t); m; m = re.exec(t)) {
        const fix = keepCase(m[0], right.replace(/’/g, apos));
        add({ group: 'language', key: 'ana.spell', vars: { wrong: m[0], right: fix }, excerpt: t.slice(Math.max(0, m.index - 25), m.index + m[0].length + 25).trim(), at: b.map[m.index], edits: [range(b, m.index, m.index + m[0].length, fix)] });
      }
    }
    if (lang === 'fr') {
      // "dune politique" → "d’une politique" (but "la dune", "une dune").
      for (let m = /(?<![\p{L}’'])(d)une(?=\s+\p{L})/giu.exec(t), re = /(?<![\p{L}’'])(d)une(?=\s+\p{L})/giu; m; m = re.exec(t)) {
        if (/\b(?:la|une|les|des|cette|grande|petite|cette|sur|haute)\s+$/iu.test(t.slice(0, m.index))) continue;
        const fix = `${m[1]}${apos}une`;
        add({ group: 'language', key: 'ana.spell', vars: { wrong: m[0], right: fix }, excerpt: t.slice(Math.max(0, m.index - 25), m.index + 30).trim(), at: b.map[m.index], edits: [range(b, m.index, m.index + 4, fix)] });
      }
      for (const p of FR_PROPER) {
        const re = new RegExp(`(?<![\\p{L}-])${esc(p)}(?![\\p{L}-])`, 'gu');
        for (let m = re.exec(t); m; m = re.exec(t)) {
          const right = p.split('-').map(x => x[0].toUpperCase() + x.slice(1)).join('-');
          add({ group: 'language', key: 'ana.capital', vars: { word: m[0], right }, excerpt: t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20).trim(), at: b.map[m.index], edits: [range(b, m.index, m.index + m[0].length, right)] });
        }
      }
      // "les changements ont été imposé" → "imposés".
      const agree = /\b(?:les|des|ces|leurs|nos|vos|ses|mes|tes|plusieurs|certains|certaines|ils|elles)\s+(?:\p{L}+[sx]\s+)?(?:ont|sont)\s+été\s+(\p{L}+é)(?![\p{L}])/giu;
      for (let m = agree.exec(t); m; m = agree.exec(t)) {
        const end = m.index + m[0].length;
        add({ group: 'language', key: 'ana.agree', vars: { wrong: m[1], right: `${m[1]}s` }, excerpt: m[0], at: b.map[end - m[1].length], edits: [range(b, end, end, 's')] });
      }
      // "serait de développée" → "serait de développer".
      for (let m = /\b(?:serait|sera|est|consisterait|consiste|consistera|permettrait|permet|afin|essayer|tenter|décider|choisir)\s+(?:de|d’|d')\s*(\p{L}{3,})ée?s?(?![\p{L}])/giu.exec(t), re = /\b(?:serait|sera|est|consisterait|consiste|consistera|permettrait|permet|afin|essayer|tenter|décider|choisir)\s+(?:de|d’|d')\s*(\p{L}{3,})ée?s?(?![\p{L}])/giu; m; m = re.exec(t)) {
        const word = m[0].slice(m[0].length - (m[0].length - m[0].lastIndexOf(m[1])));
        const start = m.index + m[0].lastIndexOf(m[1]);
        const fix = `${m[1]}er`;
        add({ group: 'language', key: 'ana.infinitive', vars: { wrong: word, right: fix }, excerpt: m[0], at: b.map[start], edits: [range(b, start, m.index + m[0].length, fix)] });
      }
    }
    // A word typed twice: "de de".
    for (let m = /(?<![\p{L}])(\p{L}+)\s+\1(?![\p{L}])/giu.exec(t), re = /(?<![\p{L}])(\p{L}+)\s+\1(?![\p{L}])/giu; m; m = re.exec(t)) {
      if (REPEAT_OK.has(m[1].toLowerCase())) continue;
      add({ group: 'language', key: 'ana.repeat', vars: { word: m[1] }, excerpt: t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20).trim(), at: b.map[m.index], edits: [range(b, m.index + m[1].length, m.index + m[0].length, '')] });
    }
  }
  // The same place fixed twice (a capital and a spelling on one word): keep the first.
  const seen = new Set<string>();
  return out.filter(f => {
    if (!f.edits || f.edits.length !== 1) return true;
    const k = `${f.edits[0].from}:${f.edits[0].to}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Puts text fixes in as tracked changes (from the end, so earlier places do not move). */
export function applyEdits(editor: Editor, edits: Edit[]) {
  if (!edits.length) return;
  const was = isTracking(editor);
  if (!was) setTracking(editor, true);
  const tr = editor.state.tr;
  for (const e of [...edits].sort((a, b) => b.from - a.from)) {
    if (e.insert) tr.insertText(e.insert, e.from, e.to);
    else tr.delete(e.from, e.to);
  }
  editor.view.dispatch(tr);
  if (!was) setTracking(editor, false);
}

/** The text sent to the AI, by pieces of about [max] letters, with each paragraph's place. */
export function aiChunks(doc: PmNode, max = 3500): { text: string; blocks: Block[] }[] {
  const blocks = blocksOf(doc).filter(b => b.text.trim().length > 20 && b.node.type.name !== 'heading');
  const out: { text: string; blocks: Block[] }[] = [];
  let cur: Block[] = [], len = 0;
  for (const b of blocks) {
    if (len + b.text.length > max && cur.length) { out.push({ text: cur.map(x => x.text).join('\n\n'), blocks: cur }); cur = []; len = 0; }
    cur.push(b); len += b.text.length + 2;
  }
  if (cur.length) out.push({ text: cur.map(x => x.text).join('\n\n'), blocks: cur });
  return out;
}

/** What the AI is asked: only real mistakes, as "exact words ⟶ corrected words" lines, never a rewrite. */
export function aiPrompt(lang: string): string {
  return lang === 'fr'
    ? 'Tu es un correcteur. Corrige uniquement les fautes d’orthographe, de grammaire, d’accord, de conjugaison et de ponctuation du texte. Ne reformule rien, ne change pas le style ni le vocabulaire. Réponds seulement avec des lignes au format :\nextrait exact du texte ⟶ extrait corrigé\nChaque extrait exact contient de 2 à 10 mots copiés tels quels du texte. Une ligne par faute. Rien d’autre. S’il n’y a aucune faute, réponds AUCUNE.'
    : 'You are a proofreader. Fix only spelling, grammar, agreement, verb and punctuation mistakes. Do not rephrase or change the style or words. Reply only with lines in this format:\nexact words from the text ⟶ corrected words\nEach exact part has 2 to 10 words copied as they are from the text. One line per mistake. Nothing else. If there is no mistake, reply NONE.';
}

const WORD = /[\p{L}\p{M}\d'’-]/u;

/** A real correction changes a few words; anything bigger is the AI rewriting the sentence (seen on Martin's work
 *  2026-11-04: "causes principales qui seront analysées" became a new sentence, applied as a garbled mix). */
export function smallFix(a: string, z: string): boolean {
  const wa = a.toLowerCase().split(/\s+/).filter(Boolean), wz = z.toLowerCase().split(/\s+/).filter(Boolean);
  if (Math.abs(wa.length - wz.length) > 2 || z.length > a.length * 1.4 + 8) return false;
  const left = new Map<string, number>();
  for (const w of wa) left.set(w, (left.get(w) ?? 0) + 1);
  let kept = 0;
  for (const w of wz) { const n = left.get(w) ?? 0; if (n) { kept++; left.set(w, n - 1); } }
  return wa.length - kept <= Math.max(2, Math.ceil(wa.length / 2));
}

/** The AI's lines as tracked-change fixes on the exact words it quoted (anything it made up is dropped). */
export function aiFindings(answer: string, chunk: { blocks: Block[] }, startId: number): Finding[] {
  const out: Finding[] = [];
  for (const line of answer.split('\n')) {
    const m = /^\s*[-•*\d.)]*\s*[«"“]?(.+?)[»"”]?\s*(?:⟶|→|->|=>)\s*[«"“]?(.+?)[»"”]?\s*$/.exec(line);
    if (!m) continue;
    const [, a, z] = m;
    if (!a.trim() || a === z || a.length > 140 || !smallFix(a, z)) continue;
    for (const b of chunk.blocks) {
      const i = b.text.indexOf(a);
      if (i < 0) continue;
      // Only the words that change become the tracked change (whole words: never half a word kept and half replaced).
      let p = 0;
      while (p < a.length && p < z.length && a[p] === z[p]) p++;
      while (p > 0 && WORD.test(a[p - 1])) p--;
      let s = 0;
      while (s < a.length - p && s < z.length - p && a[a.length - 1 - s] === z[z.length - 1 - s]) s++;
      while (s > 0 && WORD.test(a[a.length - s])) s--;
      out.push({ id: `ai${startId + out.length}`, group: 'language', key: 'ana.ai', vars: { wrong: a, right: z }, excerpt: `${a} → ${z}`, at: b.map[i], edits: [range(b, i + p, i + a.length - s, z.slice(p, z.length - s))] });
      break;
    }
  }
  return out;
}

// ---------- fixes that change blocks (one undo step each) ----------

const setDoc = (editor: Editor, content: JSONContent[]) => {
  editor.chain().setContent({ type: 'doc', content }, { emitUpdate: true }).run();
};
const isBlank = (x: JSONContent) => x.type === 'paragraph' && !nodeText(x).trim() && !x.content?.length;

/** Titles typed as text become real titles with their level; enumerations become lists. */
export function fixStructure(editor: Editor, lang: string, known?: (t: string) => boolean) {
  const tops = (editor.getJSON().content ?? []) as JSONContent[];
  const { nodes } = applyTitles(makeLists(tops), lang, known);
  setDoc(editor, nodes);
}
/** Piles of empty lines become one. */
export function fixEmpties(editor: Editor) {
  const tops = (editor.getJSON().content ?? []) as JSONContent[];
  setDoc(editor, tops.filter((x, i) => !(isBlank(x) && i > 0 && isBlank(tops[i - 1]))));
}
/** Four empty lines or more (to reach the next page) become a page break. */
export function fixPages(editor: Editor) {
  const tops = (editor.getJSON().content ?? []) as JSONContent[];
  const out: JSONContent[] = [];
  for (let i = 0; i < tops.length;) {
    let j = i;
    while (j < tops.length && isBlank(tops[j])) j++;
    if (j - i >= 4) { out.push({ type: 'pageBreak' }); i = j; continue; }
    if (j > i) { out.push(...tops.slice(i, j)); i = j; continue; }
    out.push(tops[i]); i++;
  }
  setDoc(editor, out);
}
/** A line cut by hand inside a sentence goes back to one line. */
export function fixBreaks(editor: Editor) {
  const tr = editor.state.tr;
  const cuts: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    node.forEach((c, off, i) => { if (c.type.name === 'hardBreak' && /^\p{Ll}/u.test(node.maybeChild(i + 1)?.text ?? '')) cuts.push(pos + 1 + off); });
    return false;
  });
  for (const p of cuts.reverse()) tr.replaceWith(p, p + 1, editor.schema.text(' '));
  editor.view.dispatch(tr);
}
/** The lines of a table of contents typed by hand go; returns where the real one should go. */
export function removeHandToc(editor: Editor): number {
  const tops = (editor.getJSON().content ?? []) as JSONContent[];
  const hand = (x: JSONContent) => /(?:\.{4,}|…{2,}|_{4,}|\t)\s*\d{1,3}\s*$/.test(nodeText(x));
  const first = tops.findIndex(hand);
  if (first < 0) return -1;
  setDoc(editor, tops.filter(x => !hand(x)));
  let pos = 0;
  editor.state.doc.forEach((_c, off, i) => { if (i === first) pos = off; });
  return pos;
}
/** The missing references at the end (in their own "Références" part if there is none), A to Z, hanging indent. */
export function addRefs(editor: Editor, refs: string[], lang: string) {
  const tops = (editor.getJSON().content ?? []) as JSONContent[];
  const entry = (r: string): JSONContent => ({ type: 'paragraph', attrs: { indentLeft: 36, indentFirst: -36 }, content: [{ type: 'text', text: r }] });
  const at = tops.findIndex(x => x.type === 'heading' && REFS_TITLE.test(nodeText(x).trim()));
  if (at < 0) {
    const title = lang === 'fr' ? 'Références' : lang === 'es' ? 'Referencias' : lang === 'pt' ? 'Referências' : lang === 'de' ? 'Literaturverzeichnis' : 'References';
    while (tops.length && isBlank(tops[tops.length - 1])) tops.pop();
    setDoc(editor, [...tops, { type: 'pageBreak' }, { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] }, ...[...refs].sort((a, b) => a.localeCompare(b, lang)).map(entry)]);
    return;
  }
  let end = at + 1;
  while (end < tops.length && !(tops[end].type === 'heading' && Number(tops[end].attrs?.level ?? 1) <= 1) && tops[end].type !== 'pageBreak') end++;
  const section = [...tops.slice(at + 1, end).filter(x => !isBlank(x)), ...refs.map(entry)]
    .sort((a, b) => nodeText(a).localeCompare(nodeText(b), lang, { sensitivity: 'base' }));
  setDoc(editor, [...tops.slice(0, at + 1), ...section, ...tops.slice(end)]);
}
