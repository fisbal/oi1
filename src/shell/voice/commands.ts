/**
 * "In 1", the voice of Office In 1 (Martin, 2026-11-03): say "In 1, ouvre Class", "In 1, dicte", "In 1, annule"…
 * This file understands what was said, offline, in the 5 languages, with the many ways people say it.
 * Anything it does not know goes to In 1 Assistant as a free request.
 */

export type VoiceAction =
  | { kind: 'open'; app: string }
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

// App names as people say them (normalized, no accents). Brand names stay the same in every language (rule 15).
const APPS: [string, RegExp][] = [
  ['letter', /\b(letter|lettre|word|texte?|document|carta|brief|documento|traitement de texte)\b/],
  ['class', /\b(class|classe|excel|tableur|tableau|feuille|spreadsheet|sheet|hoja|planilha|tabelle|calcul)\b/],
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

const OPEN = /^(?:(?:tu peux |peux-tu |pourrais-tu |je veux |je voudrais |can you |could you |please |por favor |bitte )?(?:ouvre|ouvrir|lance|lancer|demarre|demarrer|affiche|va (?:dans|sur|a)|open|launch|start|show|go to|abre|abrir|inicia|abra|iniciar|oeffne|offne|starte|zeige|gehe zu)|(?:nouveau|nouvelle|nouvel|cree|creer|new|create|nuevo|nueva|crea|novo|nova|criar|crie|neue[rs]?|erstelle))\b/;
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

/** What the person asked (after "In 1", or after the 🎙️ button). */
export function parseVoice(said: string, lang = 'fr'): VoiceAction {
  void short(lang);
  const { rest } = stripWake(said);
  const s = rest.replace(/^(?:s il te plait |stp |please |por favor |bitte )/, '').trim();
  if (!s) return { kind: 'none' };
  if (STOP.test(s)) return { kind: 'stop' };
  if (LISTEN.test(s)) return { kind: 'listen' };
  if (DICTATE.test(s)) return { kind: 'dictate' };
  for (const [action, re] of KEYS) if (re.test(s)) return action;
  if (OPEN.test(s)) {
    const words = s.replace(OPEN, '').trim();
    for (const [app, re] of APPS) if (re.test(words)) return { kind: 'open', app };
  }
  // "Class" alone, "In 1 Letter" → open it.
  if (s.split(' ').length <= 3) for (const [app, re] of APPS) if (re.test(s)) return { kind: 'open', app };
  // The request as said (accents and capitals kept), without "In 1".
  const raw = said.trim().replace(/^(?:hey |ok |dis |hallo )?(?:in ?1|in ?one|in ?une?|in ?won|in ?wan|hein un|inn ?1|en un|in uno|in eins)\b[\s,.:!]*/i, '');
  return { kind: 'ask', text: raw };
}
