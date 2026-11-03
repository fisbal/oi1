// In 1 Notes, "Listen and take notes": what is said in a meeting, a class or a call becomes a transcript,
// then summary, key points and to-dos. Everything here runs offline and keeps the speaker's exact words:
// a sentence is picked, never rewritten (the copilot can write a freer summary on request).

export interface MeetingNotes { summary: string[]; points: string[]; todos: string[] }

/** "[14:05]" in the person's language and clock. */
export function stamp(d: Date, lang: string): string {
  return `[${d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}]`;
}

/** "12:34" for the recording light (minutes:seconds, hours when needed). */
export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const STAMP = /^\s*\[\d{1,2}[:h.]\d{2}(?:\s?[AaPp][Mm])?\]\s*/;

/** The transcript's sentences, without the time stamps. */
export function sentences(transcript: string): string[] {
  return transcript
    .split(/\n+/)
    .map(l => l.replace(STAMP, '').trim())
    .filter(Boolean)
    .flatMap(l => l.match(/[^.!?…]+[.!?…]+["»”)]*|[^.!?…]+$/g) ?? [])
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).length >= 3);
}

// Whole words only, accented letters included (\b does not know "à" or "ü").
const w = (alts: string) => new RegExp(`(?<![\\p{L}])(?:${alts})(?![\\p{L}])`, 'iu');

// Things to do, in the five languages of Office In 1.
const TODO = [
  // fr
  w(String.raw`il faut|faut que|on doit|nous devons|vous devez|tu dois|je dois|il faudra|à faire|a faire|n'oubliez pas|n'oublie pas|pensez à|pense à|je vais|on va|nous allons|merci de|prière de|devoir pour|pour (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain)|avant (lundi|mardi|mercredi|jeudi|vendredi|le \d+|demain|la fin)`),
  // en
  w(String.raw`we need to|you need to|i need to|need to|we have to|have to|has to|must|should|we will|i will|i'll|we'll|to do|todo|action item|don't forget|do not forget|remember to|make sure|follow up|due (on|by)|by (monday|tuesday|wednesday|thursday|friday|tomorrow|next week)|homework`),
  // es
  w(String.raw`hay que|tenemos que|tienes que|tengo que|debemos|debes|vamos a|voy a|no olvides|no olviden|para el (lunes|martes|miércoles|jueves|viernes)|tarea|pendiente`),
  // pt
  w(String.raw`temos que|tem que|tenho que|é preciso|precisamos|devemos|vou|vamos|não esqueça|não esqueçam|para (segunda|terça|quarta|quinta|sexta)|tarefa|pendente`),
  // de
  w(String.raw`wir müssen|du musst|ich muss|müssen|sollten|sollen|wir werden|ich werde|nicht vergessen|denk daran|denkt daran|bis (montag|dienstag|mittwoch|donnerstag|freitag|morgen)|hausaufgabe|aufgabe`),
];

// Things worth keeping: decisions, important facts, numbers, dates, definitions.
const POINT = [
  w(String.raw`important|essentiel|retenir|retenez|à noter|décidé|décision|on a convenu|conclusion|définition|c'est-à-dire|en résumé|le point clé|objectif|budget|résultat`),
  w(String.raw`important|key|remember|note that|decided|decision|agreed|conclusion|definition|that is|in short|goal|budget|result|the main`),
  w(String.raw`importante|clave|recuerden|decidimos|decisión|acordamos|conclusión|definición|objetivo|presupuesto|resultado`),
  w(String.raw`importante|chave|lembrem|decidimos|decisão|combinamos|conclusão|definição|objetivo|orçamento|resultado`),
  w(String.raw`wichtig|merken|beschlossen|entscheidung|vereinbart|fazit|definition|das heißt|ziel|budget|ergebnis`),
];
const MONTH = w(String.raw`janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|janeiro|fevereiro|março|maio|junho|julho|setembro|outubro|novembro|dezembro|januar|februar|märz|juni|juli|oktober|dezember`);
const HAS_FACT = { test: (x: string) => /\d/.test(x) || MONTH.test(x) };

export const isTodo = (s: string) => TODO.some(r => r.test(s));
export const isPoint = (s: string) => POINT.some(r => r.test(s)) || HAS_FACT.test(s);

/** Summary (a few sentences spread over the talk), key points and to-dos, each a sentence said word for word. */
export function meetingNotes(transcript: string): MeetingNotes {
  const all = sentences(transcript);
  const seen = new Set<string>();
  const uniq = (xs: string[]) => xs.filter(x => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const todos = uniq(all.filter(isTodo)).slice(0, 20);
  const points = uniq(all.filter(s => !isTodo(s) && isPoint(s))).slice(0, 12);
  // The summary: the opening sentence, then the most informative sentence of each part of the talk.
  const rest = all.filter(s => !seen.has(s.toLowerCase()));
  const parts = Math.min(4, Math.max(1, Math.ceil(rest.length / 6)));
  const summary: string[] = [];
  if (rest[0]) summary.push(rest[0]);
  for (let p = 0; p < parts; p++) {
    const slice = rest.slice(Math.floor((p * rest.length) / parts), Math.floor(((p + 1) * rest.length) / parts));
    const best = [...slice].sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length)[0];
    if (best && !summary.includes(best)) summary.push(best);
  }
  return { summary: summary.slice(0, 5), points, todos };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The notes as page HTML: Summary, Key points, To do (a check list). */
export function meetingHtml(n: MeetingNotes, labels: { summary: string; points: string; todos: string; none: string }): string {
  const list = (xs: string[]) => (xs.length ? `<ul>${xs.map(x => `<li><p>${esc(x)}</p></li>`).join('')}</ul>` : `<p><em>${esc(labels.none)}</em></p>`);
  const tasks = n.todos.length
    ? `<ul data-type="taskList">${n.todos.map(x => `<li data-type="taskItem" data-checked="false"><p>${esc(x)}</p></li>`).join('')}</ul>`
    : `<p><em>${esc(labels.none)}</em></p>`;
  return `<h2>${esc(labels.summary)}</h2>${list(n.summary)}<h2>${esc(labels.points)}</h2>${list(n.points)}<h2>${esc(labels.todos)}</h2>${tasks}`;
}
