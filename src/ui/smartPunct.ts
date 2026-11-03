/**
 * Smart dictation writer (Martin, 2026-11-03: "efficace, rapide et smart, qu'il puisse faire les retours à la ligne et
 * ponctuations"). Turns the phrases heard between pauses into well punctuated text, like a person typing it:
 *
 *  - The pause before each phrase decides the punctuation of the one before: a short breath joins the two (no full stop
 *    in the middle of a sentence, even when Whisper put one), a real pause ends the sentence, a long pause starts a new
 *    paragraph. The mark is held back until the next phrase (or a short silence), so it is always the right one.
 *  - Questions get "?" from their first words when the engine gives no punctuation (Chrome's Web Speech), 5 languages.
 *  - Letters take shape by themselves: "Bonjour Madame" gets its comma and a new paragraph, "Cordialement" starts the
 *    closing on its own paragraph, "premièrement / deuxièmement…" each start a new line.
 *  - Hesitations ("euh", "um", "äh"…) are dropped; every other word is kept as said (faithful, rule 13).
 *  - Spoken marks ("virgule", "à la ligne"…) always win over the automatic ones.
 *  - "Efface ça" takes back the last phrase, "arrête la dictée" stops.
 */
import { applyVoiceCommands } from './dictation';

export type SmartCommand = 'undo' | 'stop';
export interface SmartOut { text: string; command?: SmartCommand }
export interface Phrase {
  text: string;
  /** Seconds of silence before this phrase (Infinity for the first one). */
  pause: number;
}

/** Below this the speaker only took a breath: same sentence. */
export const SHORT_PAUSE = 0.9;
/** From this the speaker starts a new paragraph. */
export const PARA_PAUSE = 3.6;
/** Silence after which the held-back mark is written (so the sentence does not stay open on screen). */
export const FLUSH_AFTER_MS = 1500;

const short = (lang: string) => lang.slice(0, 2).toLowerCase();

const FILLERS: Record<string, string> = {
  fr: 'euh+|heu+|hum+|hmm+|bah|ben euh',
  en: 'u+h+|u+m+|erm+|hmm+|uh-huh',
  es: 'eh+|em+|ehm+|mmm+',
  pt: 'é+h+|hum+|ahn+|hmm+',
  de: 'ä+h+|ä+hm+|öh+m*|hmm+',
};

const QUESTION: Record<string, RegExp> = {
  fr: /^(est-ce|est ce|qu['’]est-ce|pourquoi|comment|combien|quand|où|ou est|quel(le)?s?|qui|quoi|lequel|laquelle|lesquel(le)?s|peux-tu|pouvez-vous|pourriez-vous|pourrais-tu|voulez-vous|veux-tu|as-tu|avez-vous|êtes-vous|es-tu|sais-tu|savez-vous|y a-t-il|n['’]est-ce pas)\b/iu,
  en: /^(who|what|when|where|why|how|which|whose|whom|is|are|am|was|were|do|does|did|can|could|will|would|shall|should|may|might|have|has|had|isn['’]t|aren['’]t|don['’]t|doesn['’]t|didn['’]t|won['’]t|can['’]t)\b/iu,
  es: /^(¿)?(qué|que tal|quién|quiénes|cuándo|dónde|por qué|cómo|cuál|cuáles|cuánto|cuántos|cuánta|cuántas|puedes|puede|podrías|podría|tienes|tiene|hay)\b/iu,
  pt: /^(o que|que|quem|quando|onde|por que|porque|porquê|como|qual|quais|quanto|quantos|quanta|quantas|você pode|pode|podes|poderia|tem|há)\b/iu,
  de: /^(wer|was|wann|wo|wohin|woher|warum|wieso|weshalb|wie|welche[rsmn]?|kannst|können|könnten|könntest|hast|haben|habt|bist|sind|seid|ist|gibt es|darf|dürfen|willst|wollen|soll|sollen)\b/iu,
};

const GREETING: Record<string, RegExp> = {
  fr: /^(bonjour|bonsoir|salut|coucou|madame|monsieur|mademoiselle|cher|chère|chers|chères|à qui de droit|madame,? monsieur)\b/iu,
  en: /^(dear|hello|hi|hey|good (morning|afternoon|evening)|to whom it may concern)\b/iu,
  es: /^(hola|buenos días|buenas tardes|buenas noches|estimad[oa]s?|querid[oa]s?|señor|señora|a quien corresponda)\b/iu,
  pt: /^(olá|ola|oi|bom dia|boa tarde|boa noite|prezad[oa]s?|caro|cara|querid[oa]s?|senhor|senhora|a quem possa interessar)\b/iu,
  de: /^(hallo|guten (morgen|tag|abend)|sehr geehrte[rs]?|liebe[rs]?|servus|moin)\b/iu,
};

const CLOSING: Record<string, RegExp> = {
  fr: /^(cordialement|bien cordialement|bien à vous|sincèrement|amicalement|bisous|bises|à bientôt|salutations|meilleures salutations|veuillez agréer|je vous prie d['’]agréer|dans l['’]attente de votre réponse|merci d['’]avance|merci par avance)\b/iu,
  en: /^(sincerely|best regards|kind regards|regards|best wishes|yours (sincerely|faithfully|truly)|cheers|thanks in advance|looking forward to)\b/iu,
  es: /^(atentamente|saludos|un saludo|cordialmente|un abrazo|gracias de antemano|quedo a la espera)\b/iu,
  pt: /^(atenciosamente|cordialmente|cumprimentos|saudações|abraços|um abraço|obrigad[oa] desde já|fico a aguardar)\b/iu,
  de: /^(mit freundlichen grüßen|freundliche grüße|viele grüße|beste grüße|liebe grüße|hochachtungsvoll|vielen dank im voraus)\b/iu,
};

const ORDINAL: Record<string, RegExp> = {
  fr: /^(premièrement|deuxièmement|troisièmement|quatrièmement|cinquièmement|sixièmement|septièmement|huitièmement|neuvièmement|dixièmement|d['’]abord|ensuite|puis|enfin|pour finir|en premier lieu|en second lieu|en deuxième lieu|en troisième lieu|en dernier lieu|primo|secundo|tertio)\b/iu,
  en: /^(first(ly)?|second(ly)?|third(ly)?|fourth(ly)?|fifth(ly)?|next|then|finally|lastly|to begin with|in conclusion)\b/iu,
  es: /^(primero|en primer lugar|segundo|en segundo lugar|tercero|en tercer lugar|luego|después|finalmente|por último)\b/iu,
  pt: /^(primeiro|em primeiro lugar|segundo|em segundo lugar|terceiro|em terceiro lugar|depois|em seguida|finalmente|por último|por fim)\b/iu,
  de: /^(erstens|zweitens|drittens|viertens|fünftens|zuerst|dann|danach|schließlich|zum schluss|zuletzt)\b/iu,
};

const COMMANDS: Record<string, [RegExp, SmartCommand][]> = {
  fr: [[/^(efface|supprime|enlève|annule) (ça|cela|ceci|la dernière phrase|le dernier)$/iu, 'undo'], [/^(arrête|stoppe|termine|fin de) (la )?(dictée|dicter)$/iu, 'stop']],
  en: [[/^(delete|erase|scratch|undo) (that|this|the last sentence)$/iu, 'undo'], [/^(stop|end) (the )?(dictation|dictating)$/iu, 'stop']],
  es: [[/^(borra|elimina|deshaz|quita) (eso|esto|la última frase)$/iu, 'undo'], [/^(para|detén|termina) (el )?dictado$/iu, 'stop']],
  pt: [[/^(apaga|apague|elimina|desfaz) (isso|isto|a última frase)$/iu, 'undo'], [/^(para|pare|termina|terminar) (o )?ditado$/iu, 'stop']],
  de: [[/^(lösch|lösche|entferne) (das|dies|den letzten satz)$/iu, 'undo'], [/^(diktat|diktieren) (beenden|stoppen)$|^(stopp|beende) (das )?diktat$/iu, 'stop']],
};

const fillerRe = new Map<string, RegExp>();
/** Drops hesitations ("euh", "um"…) and keeps every other word as said. */
export function dropFillers(text: string, lang: string): string {
  const k = short(lang);
  let re = fillerRe.get(k);
  if (!re) { re = new RegExp(`(^|[\\s,])(?:${FILLERS[k] ?? FILLERS.en})(?=[\\s,.!?…]|$)[,]?`, 'giu'); fillerRe.set(k, re); }
  return text.replace(re, '$1').replace(/\s{2,}/g, ' ').replace(/^[\s,]+/, '').trim();
}

const pick = <T>(table: Record<string, T>, lang: string): T => table[short(lang)] ?? table.en;
const bare = (s: string) => s.replace(/^[\s¿¡«“„"'(]+/u, '').replace(/[\s.,;:!?…»”"')]+$/u, '');
export const isQuestion = (s: string, lang: string) => pick(QUESTION, lang).test(bare(s));
const isGreeting = (s: string, lang: string) => pick(GREETING, lang).test(bare(s)) && bare(s).split(/\s+/).length <= 6;
const isClosing = (s: string, lang: string) => pick(CLOSING, lang).test(bare(s));
const isOrdinal = (s: string, lang: string) => pick(ORDINAL, lang).test(bare(s));
const capital = (s: string) => s.replace(/^([\s«“„"'(¿¡]*)(\p{Ll})/u, (_m, a: string, b: string) => a + b.toUpperCase());
/** A capital Whisper put only because a new piece started (not "I", not an acronym, not a name we can know). */
const lowerStart = (s: string, lang: string) => s.replace(/^(\p{Lu})(\p{Ll}*)/u, (m, a: string, rest: string) => {
  if (short(lang) === 'en' && /^I$|^I['’]/.test(m + s.slice(m.length, m.length + 2))) return m;
  if (short(lang) === 'de') return m; // German nouns keep their capital
  return a.toLowerCase() + rest;
});
const markText = (mark: string, lang: string) => (short(lang) === 'fr' && /^[?!;:]$/.test(mark) ? ` ${mark}` : mark);

export class SmartWriter {
  /** Mark held back for the phrase before ('' = none, e.g. the speaker said it). */
  private pending = '';
  /** What comes after the pending mark whatever the pause (greetings, closings). */
  private forcedBreak = '';
  private started = false;
  /** The last thing written ends a sentence (so the next starts with a capital). */
  private sentenceEnded = true;
  /** Start of the sentence being written (a question is known by its first words). */
  private opening = '';
  /** The last thing written ends with a line break. */
  private atLineStart = false;
  constructor(private lang: string, private auto = true) {}

  /**
   * A phrase heard. `before` = the text just before the cursor ('' at the start), so the first word gets its capital.
   * Returns the text to insert ("\n" = new line, "\n\n" = new paragraph).
   */
  phrase(p: Phrase, before?: string): SmartOut {
    const lang = this.lang;
    let said = dropFillers(p.text.replace(/\s+/g, ' ').trim(), lang);
    if (!said) return { text: '' };
    for (const [re, cmd] of pick(COMMANDS, lang)) if (re.test(bare(said))) { this.pending = ''; return { text: '', command: cmd }; }
    if (!this.auto) return { text: applyVoiceCommands(said, lang) };

    const first = !this.started;
    this.started = true;
    if (first && before !== undefined) this.sentenceEnded = !before.trim() || /[.!?…]\s*$|\n\s*$/.test(before);
    const spoken = applyVoiceCommands(said, lang);
    const userLead = /^[\s]*[,.;:!?…)»”\n]/.test(spoken); // the speaker began with a mark or a new line
    let body = spoken;

    // The phrase's own end: an engine full stop is held back (it may be the middle of a sentence).
    let tail = '';
    let userEnd = false;
    // A mark the speaker said ("point", "full stop") is theirs: kept as it is, no automatic one.
    const engineEnd = /[.?!…]$/.test(said);
    if (/\n$/.test(body)) { userEnd = true; }
    else if (/[.?!…;:,]\s*$/.test(body) && !engineEnd) { userEnd = true; }
    else if (/[?!…]\s*$/.test(body)) { userEnd = true; }
    else if (/[.]$/.test(body) && !/\.\.$/.test(body)) {
      // Whisper ends every piece with a full stop: keep it pending, decide with the next pause.
      body = body.replace(/\s*\.$/, '');
      tail = '.';
    }
    if (!userEnd && !tail) tail = '.';

    // Join with what came before.
    let lead = '';
    let joined = false;
    if (userLead) { lead = ''; this.pending = ''; }
    else if (this.forcedBreak) {
      lead = markText(this.pending, lang) + this.forcedBreak;
      this.sentenceEnded = this.sentenceEnded || /[.!?…]/.test(this.pending) || this.forcedBreak.startsWith('\n');
    } else if (first) lead = '';
    else if (this.pending && p.pause < SHORT_PAUSE && !isClosing(body, lang) && !isOrdinal(body, lang)) {
      joined = true; // a breath: same sentence
    } else if (this.pending || !first) {
      const brk = p.pause >= PARA_PAUSE || isClosing(body, lang) ? '\n\n' : isOrdinal(body, lang) ? '\n' : this.atLineStart && !this.pending ? '' : ' ';
      lead = markText(this.pending, lang) + brk;
      if (/[.!?…]/.test(this.pending) || brk.includes('\n')) this.sentenceEnded = true;
    }
    this.forcedBreak = '';
    if (!joined) this.opening = body;
    if (!userEnd && tail === '.' && isQuestion(this.opening, lang)) tail = '?';

    if (joined) body = lowerStart(body, lang);
    else if (this.sentenceEnded || userLead && /[.!?…]\s*$/.test(spoken.slice(0, 2))) body = capital(body);

    // Letters take shape: a greeting ends with a comma and a new paragraph, a closing with a comma and a new line.
    if (!userEnd && isGreeting(body, lang) && (first || this.sentenceEnded)) { tail = ','; this.forcedBreak = '\n\n'; }
    else if (!userEnd && isClosing(body, lang) && bare(body).split(/\s+/).length <= 5) { tail = ','; this.forcedBreak = '\n'; }

    this.pending = userEnd ? '' : tail;
    this.sentenceEnded = userEnd ? /[.!?…\n]\s*$/.test(body) : false;
    this.atLineStart = userEnd && /\n$/.test(body);
    return { text: lead + body };
  }

  /** After a silence or when dictation stops: write the held-back mark (and the line break a closing asks for). */
  flush(): string {
    if (!this.pending) return '';
    const out = markText(this.pending, this.lang);
    if (/[.!?…]/.test(this.pending)) this.sentenceEnded = true;
    this.pending = '';
    return out;
  }

  /** The speaker took the last phrase back: nothing is pending any more. */
  forget() { this.pending = ''; this.forcedBreak = ''; }
}
