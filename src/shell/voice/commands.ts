/**
 * "In 1", the voice of Office In 1 (Martin, 2026-11-03): say "In 1, ouvre Class", "In 1, dicte", "In 1, annule"…
 * This file understands what was said, offline, in the 5 languages, with the many ways people say it.
 * Anything it does not know goes to In 1 Assistant as a free request.
 */

export type VoiceAction =
  /** Goes to the app (its open tab if there is one); [fresh] = a new document ("nouvelle lettre"). */
  | { kind: 'open'; app: string; fresh?: true }
  /** Closes the app's tab (the one on screen, or its last one), all its tabs, or the tab on screen. */
  | { kind: 'close'; app?: string; all?: true }
  /** Writes these words where the cursor is (a Class cell gets "quatre" as 4). */
  | { kind: 'type'; text: string }
  /** Acts on the selection in the app on screen. */
  | { kind: 'do'; what: 'delete' | 'removeLine' | 'color' | 'bold' | 'italic' | 'underline' | 'selectAll'; value?: string }
  /** Presses the button of the app on screen that has this name ("In 1, gras", "In 1, Insertion"). */
  | { kind: 'button'; words: string }
  | { kind: 'dictate' }
  | { kind: 'listen' }
  | { kind: 'key'; key: 'undo' | 'redo' | 'save' | 'print' | 'zoomIn' | 'zoomOut' }
  | { kind: 'stop' }
  | { kind: 'ask'; text: string }
  | { kind: 'none' };

const short = (lang: string) => lang.slice(0, 2).toLowerCase();
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[.,;:!?¿¡«»“”"…’']/g, ' ').replace(/\s+/g, ' ').trim();

/** "In 1" as speech engines write it: in 1, in one, in un, inone, in won, hein un… (Martin: « on accepte aussi in un »). */
const WAKE = /^(?:hey |ok |dis |he |oye |ola |hallo )?(?:in ?1|in ?one|in ?un|in ?une|in ?won|in ?wan|hein un|inn ?1|en un|in uno|in eins)\b\s*/;
/** Removes "In 1" at the start; tells if it was there. */
export function stripWake(text: string): { rest: string; called: boolean } {
  const n = norm(text);
  const m = n.match(WAKE);
  return m ? { rest: n.slice(m[0].length).trim(), called: true } : { rest: n, called: false };
}

/**
 * The name "In 1" heard while listening for it (after the person turned that on): it must open the phrase, after
 * at most a small word ("euh", "alors", "ok"…), so "in one hour" or « en un mot » in the middle of talk never calls it.
 * Gives what follows the name ('' = the name alone: the request comes next), or null when the name was not said.
 */
const CALL = /^(?:(?:euh|heu|hum|hmm|um|uh|alors|bon|ok|okay|hey|he|dis|eh|oye|ola|hallo|ja|so|well|bueno|entao)\s)*(?:in ?1|in ?one|in ?un|in ?une|in ?won|in ?wan|inn ?1|in uno|in eins|hein un)\b\s*/;
export function heardName(text: string): string | null {
  const n = norm(text);
  const m = n.match(CALL);
  return m ? n.slice(m[0].length).trim() : null;
}

// App names as people say them (normalized, no accents). Brand names stay the same in every language (rule 15).
const APPS: [string, RegExp][] = [
  ['letter', /\b(letters?|lettres?|word|textes?|documents?|cartas?|briefe?|documentos?|traitement de texte)\b/],
  ['class', /\b(class|classes?|excel|tableurs?|tableaux?|feuilles?|spreadsheets?|sheets?|hojas?|planilhas?|tabellen?|calcul)\b/],
  ['stage', /\b(stage|powerpoint|presentation|diaporama|slides?|diapos?|presentacion|apresentacao|prasentation)\b/],
  ['code', /\b(code|code plus|coder|programmation|programming)\b/],
  ['prodfos', /\b(prodfos|pdf)\b/],
  ['assistant', /\b(assistant|assistente|asistente|assistent)\b/],
  ['notes', /\b(notes?|bloc-notes|nota|notas|notiz|notizen)\b/],
  ['plan', /\b(plan|planning|planification|agenda|projet|project|proyecto|projeto|projekt)\b/],
  ['mail', /\b(mail|courriel|e-?mail|correo|email|post)\b/],
  ['draw', /\b(draw|dessin|dessiner|drawing|dibujo|desenho|zeichnen|zeichnung)\b/],
  ['form', /\b(form|formulaire|questionnaire|sondage|formulario|formular|survey)\b/],
  ['image', /\b(image|photo|picture|imagen|imagem|bild|foto)\b/],
];

const POLITE = /^(?:tu peux |peux-tu |peux tu |pourrais-tu |pourrais tu |je veux |je voudrais |can you |could you |please |por favor |bitte )/;
const OPEN = /^(?:ouvre|ouvrir|lance|lancer|demarre|demarrer|affiche|va (?:dans|sur|a|au|vers)|aller (?:dans|sur|a)|passe (?:a|au|dans|sur)|retourne (?:a|au|dans|sur)|reviens (?:a|au|dans|sur)|montre(?:-moi)?|open|launch|start|show|go to|go back to|switch to|back to|abre|abrir|inicia|abra|iniciar|ve a|ir a|vai para|ir para|volta para|oeffne|offne|starte|zeige|gehe zu|geh zu|wechsle zu)\b/;
const NEW = /^(?:nouveau|nouvelle|nouvel|cree|creer|new|create|nuevo|nueva|crea|novo|nova|criar|crie|neue[rs]?|erstelle)\b/;
const CLOSE = /^(?:ferme|fermer|quitte|quitter|close|exit|quit|cierra|cerrar|fecha|fechar|feche|schliesse|schliessen|schliess|beende)\b/;
const ALL = /\b(?:tout|tous|toutes|all|everything|todo|todos|todas|tudo|alles|alle)\b/;
// Acting on what is selected.
const DELETE = /^(?:supprime|supprimer|efface|effacer|enleve|enlever|retire|retirer|delete|erase|remove|clear|borra|borrar|elimina|eliminar|apaga|apagar|exclui|excluir|losche|loesche|loschen|entferne|entfernen)\b/;
const LINE = /\b(?:la ligne|cette ligne|le paragraphe|ce paragraphe|la rangee|the line|this line|the row|this row|the paragraph|la linea|la fila|el parrafo|a linha|o paragrafo|die zeile|diese zeile|den absatz|die reihe)\b/;
const SELECTION = /\b(?:la selection|selection|ca|cela|ceci|le texte|the selection|selection|it|this|that|la seleccion|eso|esto|a selecao|isso|die auswahl|das)\b/;
const SELECT_ALL = /^(?:selectionne tout|tout selectionner|select all|selecciona todo|seleciona tudo|selecionar tudo|alles auswahlen|alles markieren)\b/;
const PAINT = /^(?:mets|met|mettre|colore|colorie|passe|make|turn|color|colour|paint|pon|ponlo|ponla|pinta|colorea|deixa|pinte|coloque|faerbe|farbe|mach|mache)\b/;
const COLORS: [string, RegExp][] = [
  ['#E03131', /\b(?:rouge|red|rojo|roja|vermelho|vermelha|rot|rote)\b/],
  ['#1C7ED6', /\b(?:bleu|bleue|blue|azul|blau|blaue)\b/],
  ['#2F9E44', /\b(?:vert|verte|green|verde|grun|gruen|grune)\b/],
  ['#F2C200', /\b(?:jaune|yellow|amarillo|amarilla|amarelo|amarela|gelb|gelbe)\b/],
  ['#F76707', /\b(?:orange|naranja|laranja)\b/],
  ['#7048E8', /\b(?:violet|violette|mauve|purple|violeta|morado|roxo|roxa|lila|violett)\b/],
  ['#E64980', /\b(?:rose|pink|rosa|rosado)\b/],
  ['#000000', /\b(?:noir|noire|black|negro|negra|preto|preta|schwarz|schwarze)\b/],
  ['#FFFFFF', /\b(?:blanc|blanche|white|blanco|blanca|branco|branca|weiss|weisse)\b/],
  ['#868E96', /\b(?:gris|grise|gray|grey|cinza|grau|graue)\b/],
  ['#8B5A2B', /\b(?:marron|brun|brune|brown|cafe|marrom|braun)\b/],
  ['#D4A843', /\b(?:dore|doree|or|gold|golden|dorado|dourado|goldene?)\b/],
  ['', /\b(?:normal|normale|automatique|par defaut|default|automatic|por defecto|automatico|padrao|standard|automatisch)\b/],
];
const FORMATS: ['bold' | 'italic' | 'underline', RegExp][] = [
  ['bold', /\b(?:gras|bold|negrita|negrito|fett)\b/],
  ['italic', /\b(?:italique|italic|italics|cursiva|italico|kursiv)\b/],
  ['underline', /\b(?:souligne|soulignee|souligner|underline|underlined|subrayado|subraya|sublinhado|sublinha|unterstrichen|unterstreiche)\b/],
];
const TYPE = /^(?:ecris|ecrire|tape|taper|saisis|saisir|inscris|entre|write|type|enter|escribe|escribir|escreve|escrever|digite|digitar|schreib|schreibe|tippe)\b/;
// "Clique sur Gras", "appuie sur Insertion", "click Bold": the button's name follows.
const PRESS = /^(?:clique sur|cliquer sur|clic sur|appuie sur|appuyer sur|touche|active|choisis|click on|click|press|tap|choose|haz clic en|pulsa|toca|clica em|clique em|toque em|klicke auf|klick auf|drucke auf)\s+/;
// In 1 Notes listens to a meeting or a class (it always asks for everyone's consent first).
const LISTEN = /^(?:ecoute et prends? des notes|ecoute (?:la |le |l )?(?:reunion|cours|appel|conference)|prends des notes|prendre des notes|listen and take notes|listen to (?:the )?(?:meeting|class|call|talk)|take notes|escucha y toma notas|toma notas|tomar notas|escuta e toma notas|ouve e toma notas|zuhoren und mitschreiben|zuhoeren und mitschreiben|hor zu und schreib mit|mitschreiben|schreib mit)\b/;
const DICTATE = /^(?:dicte|dicter|dictee|je dicte|ecris|ecrire|prends en note|dictate|dictation|type|write|dicta|dictar|escribe|escreve|ditar|dita|diktat|diktieren|schreib|schreibe)\b/;
const KEYS: [VoiceAction & { kind: 'key' }, RegExp][] = [
  [{ kind: 'key', key: 'undo' }, /^(?:annule|annuler|defais|retour arriere|efface ca|undo|deshaz|deshacer|desfaz|desfazer|ruckgangig|rueckgaengig)\b/],
  [{ kind: 'key', key: 'redo' }, /^(?:retablis|retablir|refais|refaire|redo|rehaz|rehacer|refaz|refazer|wiederholen|wiederherstellen)\b/],
  [{ kind: 'key', key: 'save' }, /^(?:enregistre|enregistrer|sauvegarde|sauvegarder|save|guarda|guardar|salva|salvar|speichern|speichere)\b/],
  [{ kind: 'key', key: 'print' }, /^(?:imprime|imprimer|print|imprimir|imprima|drucken|drucke)\b/],
  [{ kind: 'key', key: 'zoomIn' }, /^(?:zoom avant|agrandis|agrandir|plus grand|zoom in|bigger|acercar|ampliar|aumentar|vergrossern|vergroessern|zoom rein)\b/],
  [{ kind: 'key', key: 'zoomOut' }, /^(?:zoom arriere|reduis|reduire|plus petit|zoom out|smaller|alejar|reducir|diminuir|verkleinern|zoom raus)\b/],
];
const STOP = /^(?:stop|arrete|arreter|tais-toi|silence|merci c est tout|c est tout|that s all|para|basta|parar|halt|genug|aufhoren)\b/;

const appIn = (words: string) => APPS.find(([, re]) => re.test(words))?.[0];
/** The request as said (accents and capitals kept), without "In 1". */
const rawOf = (said: string) => said.trim().replace(/^(?:hey |ok |dis |hallo )?(?:in ?1|in ?one|in ?une?|in ?won|in ?wan|hein un|inn ?1|en un|in uno|in eins)\b[\s,.:!]*/i, '');

/** What the person asked (after "In 1", or after the 🎙️ button): the first thing to do. */
export function parseVoice(said: string, lang = 'fr'): VoiceAction {
  return parseOne(said, lang);
}

function parseOne(said: string, lang: string): VoiceAction {
  void short(lang);
  const { rest } = stripWake(said);
  const s = rest.replace(/^(?:s il te plait |stp |please |por favor |bitte )/, '').replace(POLITE, '').trim();
  const raw = rawOf(said);
  if (!s) return { kind: 'none' };
  if (STOP.test(s)) return { kind: 'stop' };
  if (LISTEN.test(s)) return { kind: 'listen' };
  // "Ferme Letter" closes it (it used to open it again: Martin, 2026-11-03).
  if (CLOSE.test(s)) {
    const words = s.replace(CLOSE, '').trim();
    const app = appIn(words);
    return { kind: 'close', ...(app ? { app } : {}), ...(ALL.test(words) ? { all: true as const } : {}) };
  }
  if (SELECT_ALL.test(s)) return { kind: 'do', what: 'selectAll' };
  // "Supprime la ligne", "efface la sélection" (but "efface ça" stays Undo, as in dictation).
  if (DELETE.test(s) && !/^efface ca$/.test(s)) {
    const words = s.replace(DELETE, '').trim();
    if (LINE.test(words)) return { kind: 'do', what: 'removeLine' };
    if (!words || SELECTION.test(words)) return { kind: 'do', what: 'delete' };
  }
  // "Mets-le en rouge", "make it red", "en gras".
  if (PAINT.test(s) || /^en /.test(s) || s.split(' ').length <= 3) {
    const words = s.replace(PAINT, '');
    const f = FORMATS.find(([, re]) => re.test(words));
    if (f && (PAINT.test(s) || /^en /.test(s))) return { kind: 'do', what: f[0] };
    const c = COLORS.find(([, re]) => re.test(words));
    if (c && (PAINT.test(s) || /^en /.test(s))) return { kind: 'do', what: 'color', value: c[0] };
  }
  // "Écris quatre" types it; "écris" alone dictates.
  if (TYPE.test(s) && s.replace(TYPE, '').trim()) {
    const n = (s.match(TYPE)![0].split(' ').length);
    const text = raw.split(/\s+/).slice(n).join(' ').replace(/^[«"“]|[»"”]$/g, '').trim();
    if (text) return { kind: 'type', text };
  }
  if (DICTATE.test(s)) return { kind: 'dictate' };
  for (const [action, re] of KEYS) if (re.test(s)) return action;
  if (NEW.test(s)) { const app = appIn(s.replace(NEW, '')); if (app) return { kind: 'open', app, fresh: true }; }
  if (OPEN.test(s)) { const app = appIn(s.replace(OPEN, '')); if (app) return { kind: 'open', app }; }
  // "Class" alone, "In 1 Letter" → go to it.
  if (s.split(' ').length <= 2) { const app = appIn(s); if (app) return { kind: 'open', app }; }
  if (PRESS.test(s)) return { kind: 'button', words: s.replace(PRESS, '').trim() };
  return { kind: 'ask', text: raw };
}

const THEN = /\s*(?:,\s*)?\b(?:et puis|et ensuite|puis|ensuite|et|and then|then|and|y luego|luego|y|e depois|depois|e|und dann|dann|und)\b\s+/gi;
/**
 * Several things in one sentence: "va dans Class et écris quatre", "ouvre Letter puis dicte". The sentence is cut at
 * "et / puis / and / then…" only where every part is a command In 1 knows, so "écris noir et blanc" stays one text.
 */
export function parseSteps(said: string, lang = 'fr'): VoiceAction[] {
  const raw = rawOf(said);
  const cuts = [...raw.matchAll(THEN)];
  for (let n = cuts.length; n > 0; n--) {
    // Try the cuts from the first ones: the earliest known command at the start, the rest after.
    const parts: string[] = [];
    let at = 0;
    for (const c of cuts.slice(0, n)) { parts.push(raw.slice(at, c.index)); at = c.index + c[0].length; }
    parts.push(raw.slice(at));
    const acts = parts.map(p => parseOne(p, lang));
    if (acts.every(a => a.kind !== 'ask' && a.kind !== 'none')) return acts;
  }
  return [parseOne(said, lang)];
}

// Numbers said in words, for a cell: "quatre" → 4, "vingt-deux" → 22, "forty two" → 42.
const UNITS: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, um: 1, uma: 1, dois: 2, duas: 2, quatro: 4, sete: 7, oito: 8, nove: 9, dez: 10,
  null: 0, eins: 1, ein: 1, zwei: 2, drei: 3, vier: 4, funf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwolf: 12, zwoelf: 12,
};
const TENS: Record<string, number> = {
  vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, zwanzig: 20, dreissig: 30, vierzig: 40, funfzig: 50,
};
const HUNDRED = /^(?:cent|cents|hundred|cien|ciento|cem|cento|hundert)$/;
const THOUSAND = /^(?:mille|thousand|mil|tausend)$/;
/** The number the words say, or null when they are not a number. */
export function wordsToNumber(text: string): number | null {
  const t = norm(text).replace(/-/g, ' ').replace(/\b(?:et|and|y|e|und)\b/g, ' ').trim();
  if (/^-?\d+(?:[.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  if (!t) return null;
  let total = 0, cur = 0, prev = '';
  for (const w of t.split(/\s+/)) {
    // French "quatre-vingt(s)" is 80.
    if ((w === 'vingt' || w === 'vingts') && prev === 'quatre') cur += 76;
    else if (w in UNITS) cur += UNITS[w];
    else if (w in TENS) cur += TENS[w];
    else if (HUNDRED.test(w)) cur = (cur || 1) * 100;
    else if (THOUSAND.test(w)) { total += (cur || 1) * 1000; cur = 0; }
    else return null;
    prev = w;
  }
  return total + cur;
}
