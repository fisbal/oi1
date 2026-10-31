// "Je veux…" (Martin, 2026-10-31): type what you want to do, in your words, and the app shows where it is: it opens
// the right ribbon tab and numbers the 1 to 5 buttons to use, in order. Works offline from the ribbon itself (every
// button's name, group, tab and Tuto explanation) plus a small dictionary of everyday words in the 5 languages.

import { helpOf } from '../tuto/help';

export interface Control {
  tab: string;        // the ribbon tab's name
  tabIndex: number;   // its place among the ribbon tabs
  group: string;      // the group's name ("Font")
  name: string;       // the button's name ("Bold")
  key?: string;       // its message key, for its explanation
  text?: string;      // its own explanation, when it has one
  active?: boolean;   // already on (the picked choice of a gallery)
}

/** `words`: the request's telling words this button matches (to tell next steps from alternatives). */
export interface Hit { c: Control; score: number; words: number[] }

/** Lowercase, no accents, no punctuation. */
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim();

// Words people use for the same thing, across English, French, Spanish, Portuguese and German. When a query word is
// in a group, every word of the group counts.
const SYNONYMS: string[][] = [
  ['bold', 'gras', 'negrita', 'negrito', 'fett', 'epais'],
  ['italic', 'italique', 'cursiva', 'italico', 'kursiv', 'penche'],
  ['underline', 'souligner', 'souligne', 'subrayar', 'sublinhar', 'unterstreichen'],
  ['color', 'colour', 'couleur', 'colorer', 'colorier', 'farbe', 'cor', 'colores'],
  ['font', 'police', 'typo', 'typographie', 'fuente', 'fonte', 'schrift', 'schriftart', 'ecriture'],
  ['size', 'taille', 'grand', 'grandir', 'plus gros', 'tamano', 'tamanho', 'grosse', 'groesse'],
  ['print', 'imprimer', 'impression', 'imprimir', 'drucken'],
  ['pdf', 'acrobat', 'prodfos'],
  ['save', 'enregistrer', 'sauvegarder', 'sauver', 'guardar', 'salvar', 'speichern'],
  ['open', 'ouvrir', 'abrir', 'offnen', 'oeffnen'],
  ['table', 'tableau', 'tabla', 'tabela', 'tabelle', 'grille'],
  ['picture', 'image', 'photo', 'imagen', 'imagem', 'foto', 'bild', 'illustration'],
  ['chart', 'graph', 'graphique', 'diagramme', 'courbe', 'grafico', 'diagramm', 'camembert', 'histogramme'],
  ['shape', 'forme', 'formes', 'figura', 'forma', 'form', 'rectangle', 'cercle', 'fleche', 'arrow'],
  ['link', 'lien', 'hyperlien', 'enlace', 'vinculo', 'link', 'verknupfung', 'url'],
  ['list', 'liste', 'puce', 'puces', 'bullet', 'bullets', 'lista', 'aufzahlung', 'numerotation', 'numbering'],
  ['align', 'aligner', 'alignement', 'centrer', 'center', 'centre', 'alinear', 'alinhar', 'ausrichten', 'justifier', 'justify'],
  ['undo', 'annuler', 'deshacer', 'desfazer', 'ruckgangig', 'retour'],
  ['redo', 'retablir', 'rehacer', 'refazer', 'wiederholen'],
  ['copy', 'copier', 'copiar', 'kopieren', 'dupliquer', 'duplicate'],
  ['paste', 'coller', 'pegar', 'colar', 'einfugen'],
  ['cut', 'couper', 'cortar', 'ausschneiden'],
  ['find', 'search', 'chercher', 'rechercher', 'trouver', 'buscar', 'procurar', 'suchen'],
  ['replace', 'remplacer', 'reemplazar', 'substituir', 'ersetzen'],
  ['spelling', 'orthographe', 'grammaire', 'grammar', 'faute', 'fautes', 'ortografia', 'rechtschreibung', 'correction', 'corriger', 'proof'],
  ['translate', 'traduire', 'traduction', 'traducir', 'traduzir', 'ubersetzen', 'langue', 'language'],
  ['header', 'footer', 'entete', 'en tete', 'pied de page', 'encabezado', 'cabecalho', 'kopfzeile', 'fusszeile'],
  ['page', 'pages', 'marge', 'margin', 'margins', 'marges', 'orientation', 'paysage', 'landscape', 'portrait', 'pagina', 'seite'],
  ['comment', 'commentaire', 'comentario', 'kommentar', 'note', 'notes'],
  ['sum', 'somme', 'total', 'additionner', 'addition', 'suma', 'soma', 'summe'],
  ['average', 'moyenne', 'promedio', 'media', 'mittelwert'],
  ['sort', 'trier', 'tri', 'ordenar', 'sortieren', 'classer', 'croissant', 'decroissant', 'ascending', 'descending', 'aufsteigend', 'absteigend', 'ascendente', 'descendente'],
  ['filter', 'filtre', 'filtrer', 'filtrar', 'filtern'],
  ['formula', 'formule', 'fonction', 'function', 'calcul', 'calculer', 'formula', 'formel', 'funcion', 'funcao', 'funktion'],
  ['currency', 'devise', 'monnaie', 'euro', 'dollar', 'moneda', 'moeda', 'wahrung', 'convertir', 'conversion'],
  ['slide', 'diapo', 'diapositive', 'diapositiva', 'slide', 'folie'],
  ['animation', 'animer', 'animate', 'anim', 'effet', 'effect', 'animacion', 'animacao'],
  ['transition', 'transitions', 'transicion', 'transicao', 'ubergang'],
  ['theme', 'themes', 'design', 'style', 'styles', 'tema', 'estilo', 'thema', 'stil', 'look', 'apparence'],
  ['show', 'diaporama', 'presenter', 'presentation', 'projeter', 'presentacion', 'apresentacao', 'prasentation'],
  ['run', 'executer', 'lancer', 'ejecutar', 'executar', 'ausfuhren', 'tester'],
  ['share', 'partager', 'envoyer', 'send', 'compartir', 'compartilhar', 'teilen', 'mail', 'courriel', 'email'],
  ['zoom', 'agrandir', 'loupe', 'voir', 'ampliar', 'vergrossern'],
  ['citation', 'reference', 'references', 'bibliographie', 'bibliography', 'source', 'sources', 'apa', 'mla', 'cita', 'literatur'],
  ['symbol', 'symbole', 'caractere special', 'emoji', 'simbolo', 'symbol'],
  ['freeze', 'figer', 'volets', 'bloquer', 'fijar', 'congelar', 'fixieren'],
  ['border', 'bordure', 'bordures', 'cadre', 'contour', 'borde', 'borda', 'rahmen'],
  ['highlight', 'surligner', 'surligneur', 'resaltar', 'realcar', 'hervorheben', 'marquer'],
  ['letter', 'lettre', 'courrier', 'cv', 'resume', 'carta', 'brief'],
  ['qr', 'qrcode', 'code qr'],
  ['add', 'ajouter', 'insert', 'inserer', 'insertar', 'inserir', 'einfugen', 'hinzufugen', 'anadir', 'adicionar'],
];
const SYN = new Map<string, Set<string>>();
for (const g of SYNONYMS) {
  const words = g.map(norm);
  for (const w of words) {
    const s = SYN.get(w) ?? new Set<string>();
    words.forEach(x => s.add(x));
    SYN.set(w, s);
  }
}

/** A word's group of synonyms, also for a word typed with one letter wrong ("itallique"). */
const synCache = new Map<string, Set<string>>();
function synonymsOf(q: string): Set<string> {
  const known = SYN.get(q) ?? synCache.get(q);
  if (known) return known;
  let found = new Set<string>();
  if (q.length >= 5) for (const [w, g] of SYN) if (Math.abs(w.length - q.length) <= 1 && distance(w, q) <= 1) { found = g; break; }
  synCache.set(q, found);
  return found;
}

// Little words that say nothing about the button.
const STOP = new Set(norm('i want to a an the my this that please how do je veux voudrais vouloir faire mettre un une des le la les mon ma mes ce cette du de d l en pour comment quiero hacer el los las un una mi como quero fazer o os as meu minha ich will mochte ein eine der die das mein wie zu im in et and y e und ou or').split(' '));

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** How well one query word matches a text's words: exact 3, start 2, close spelling 1. */
function wordScore(q: string, words: string[]): number {
  let best = 0;
  for (const w of words) {
    if (w === q) return 3;
    // The start of a word ("souli" for "souligner"), the end of a joined word ("sum" in "autosum"), never a far
    // longer word that only starts the same ("sum" is not "summary").
    if (q.length >= 3 && ((w.startsWith(q) && (q.length >= 4 || w.length - q.length <= 2)) || (w.endsWith(q) && w.length - q.length >= 3)
      || (q.length >= 5 && q.startsWith(w) && w.length >= 4))) best = Math.max(best, 2);
    else if (q.length >= 4 && w.length >= 4 && distance(q, w) <= 1) best = Math.max(best, 1);
  }
  return best;
}

// Words that only say "do something" ("add", "new"): they help, but the thing named matters more.
const WEAK = new Set(['add', 'ajouter', 'insert', 'inserer', 'insertar', 'inserir', 'einfugen', 'hinzufugen', 'anadir', 'adicionar', 'new', 'nouveau', 'nouvelle', 'nuevo', 'nueva', 'novo', 'nova', 'neu', 'neue', 'make', 'put', 'use', 'get']);

// Whole phrases that mean one thing.
const PHRASES: [RegExp, string][] = [
  [/\b(du plus petit au plus grand|smallest to largest|lowest to highest|de menor a mayor|do menor para o maior|vom kleinsten zum grossten)\b/g, 'sort'],
  [/\b(du plus grand au plus petit|largest to smallest|highest to lowest|de mayor a menor|do maior para o menor|vom grossten zum kleinsten)\b/g, 'sort'],
  [/\b(table des matieres|table of contents|tabla de contenido|indice|inhaltsverzeichnis)\b/g, 'contents'],
  [/\b(mise en page|page setup|diseno de pagina|layout da pagina)\b/g, 'layout'],
  [/\b(pied de page)\b/g, 'footer'],
  [/\b(en tete)\b/g, 'header'],
];

/** The buttons for a request, best first. `lang` picks the explanation used for matching. */
export function searchControls(controls: Control[], query: string, lang: string, app = ''): Hit[] {
  const appWords = new Set(norm(app).replace(/[+#]/g, ' ').split(' ').filter(w => w.length > 2));
  let text = norm(query);
  for (const [re, to] of PHRASES) text = text.replace(re, to);
  const raw = text.split(' ').filter(w => w && !STOP.has(w));
  if (!raw.length) return [];
  // First how well each word matches each button.
  const own: boolean[][] = [];
  const table = controls.map(c => {
    const name = norm(c.name).split(' ');
    const where = norm(`${c.group} ${c.tab}`).split(' ');
    const help = norm(c.text ?? helpOf(c.key, c.name, lang === 'fr' ? 'fr' : 'en') ?? '').split(' ');
    return raw.map(q => {
      const alts = [q, ...synonymsOf(q)];
      let s = 0, own = false;
      for (const a of alts) {
        const k = a === q ? 1 : 0.95;
        const n = wordScore(a, name), h = wordScore(a, help);
        if (n || h) own = true;
        s = Math.max(s, n * 3 * k, wordScore(a, where) * 1.5 * k, h * k);
      }
      return { s, own };
    });
  }).map(row => { own.push(row.map(x => x.own)); return row.map(x => x.s); });
  // A word found on most buttons ("code" in Code+) says little: it counts less.
  const weight = raw.map((_, i) => {
    // (counted on the buttons' own names and explanations: a tab's name is on all its buttons)
    const share = own.filter(row => row[i]).length / Math.max(1, controls.length);
    // So does the app's own name ("code" in Code+, "slide" is fine but "stage" is not).
    return (share > 0.15 || appWords.has(raw[i]) ? 0.3 : 1) * (WEAK.has(raw[i]) ? 0.35 : 1);
  });
  const hits: Hit[] = [];
  controls.forEach((c, ci) => {
    const row = table[ci];
    const matched = row.filter(s => s > 0).length;
    if (!matched) return;
    // Every word of the request found counts much more than one word found many times.
    // (a word that says little counts little here too).
    const total = weight.reduce((n, w) => n + w, 0);
    const found = row.reduce((n, s, i) => n + (s > 0 ? weight[i] : 0), 0);
    const score = row.reduce((n, s, i) => n + s * weight[i], 0) * (found / total);
    // A short name that matches is a better match than a long one ("Insert table" before "Table of contents").
    const bonus = 0.3 / Math.max(1, norm(c.name).split(' ').length);
    hits.push({ c, score: score + bonus, words: row.flatMap((v, i) => (v > 0 && weight[i] >= 0.9 ? [i] : [])) });
  });
  return hits.sort((a, b) => b.score - a.score || Number(!!a.c.active) - Number(!!b.c.active));
}

/** The 1 to 5 buttons to show: the best one's tab first, the others close behind it in score. */
export function pickSteps(hits: Hit[], max = 5): Control[] {
  if (!hits.length) return [];
  const top = hits[0].score;
  // Choices already on come after the others of the same score: "add a transition" shows Fade, not None.
  const near = hits.filter(h => h.score >= top * 0.6).sort((a, b) => b.score - a.score || Number(!!a.c.active) - Number(!!b.c.active));
  const first = near[0];
  const covered = new Set(first.words);
  const out: Control[] = [first.c];
  // A next step does another part of the request ("bold and italic"); buttons for the same words are alternatives
  // (a gallery's choices, the same button in another group), not steps.
  for (const h of near.slice(1)) {
    if (out.length >= max) break;
    if (h.c.tabIndex !== first.c.tabIndex || !h.words.some(w => !covered.has(w))) continue;
    h.words.forEach(w => covered.add(w));
    out.push(h.c);
  }
  return out;
}

/** True when the request found something clear enough to show without asking the AI. */
export const confident = (hits: Hit[]) => hits.length > 0 && hits[0].score >= 4;
