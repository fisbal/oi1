// In 1 Form with an AI: a sentence becomes a whole form (questions of the right kind, options, required ones, right
// answers for a quiz). The answer is checked question by question before anything is added.

import type { AiApi } from '../../shell/contract';
import { jsonOf } from '../assistant/plan';
import { formChat } from '../../shell/chatText';
import { QTYPES, WITH_OPTIONS, cleanQuestion, type Question } from './model';

const LANG: Record<string, string> = { en: 'English', fr: 'French', es: 'Spanish', pt: 'Portuguese', de: 'German' };

const SCHEMA: Record<string, unknown> = {
  type: 'object', additionalProperties: false, required: ['title', 'description', 'questions'],
  properties: {
    title: { type: 'string' }, description: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['type', 'title', 'required', 'options', 'rows', 'correct'],
        properties: {
          type: { type: 'string', enum: [...QTYPES] }, title: { type: 'string' }, required: { type: 'boolean' },
          options: { type: 'array', items: { type: 'string' } }, rows: { type: 'array', items: { type: 'string' } },
          correct: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const SYSTEM = `You write forms for In 1 Form. Turn the request into a clear form of 4 to 20 questions, neutral and easy to answer.
Question "type" is one of: ${QTYPES.join(', ')}. Use choice/checks/dropdown/ranking with 2 to 8 "options"; matrix with "options" (columns)
and "rows"; rating (1-5 stars), scale (1-10), nps (0-10), likert (agree/disagree) need no options; section is a heading.
"required": true for what is really needed. For a quiz, "correct" lists the right option texts (or the right short answer); otherwise [].`;

export interface AiForm { title: string; description: string; questions: Question[] }

const TITLE = /^\s*(?:\*\*)?(?:titre|title|título|titulo|titel)(?:\*\*)?\s*:\s*(.+)$/i;
const DESC = /^\s*(?:\*\*)?(?:description|descripción|descripcion|descrição|descricao|beschreibung)(?:\*\*)?\s*:\s*(.+)$/i;
const YES = /^(oui|yes|sí|si|sim|ja)$/i, NO = /^(non|no|não|nao|nein)$/i;

/** A form written as plain lines: "Title: …", "Description: …", "1. Question? (a / b / c) ✓ b". */
export function proseForm(answer: string): { title: string; description: string; questions: Record<string, unknown>[] } {
  let title = '', description = '';
  const questions: Record<string, unknown>[] = [];
  for (const raw of answer.replace(/```[a-z]*/gi, '').split('\n')) {
    const line = raw.replace(/\*\*/g, '').trim();
    if (!line || line.length > 400 || line.startsWith('#')) continue;
    const t = line.match(TITLE), d = line.match(DESC);
    if (t) { title = t[1].trim(); continue; }
    if (d) { description = d[1].trim(); continue; }
    let text = line.replace(/^\s*(?:[-*•]|\d+\s*[.)-])\s*/, '');
    if (text === line && !line.includes('?')) continue; // a sentence around the list ("Here is your quiz:")
    let correct: string[] = [];
    const ok = text.match(/\s*(?:✓|✔|✅|=>|→)\s*(.+)$/);
    if (ok) { correct = ok[1].split(/\s*[/,;]\s*/).map(c => c.replace(/[.)\]]+$/, '').trim()).filter(Boolean); text = text.slice(0, ok.index).trim(); }
    const br = text.match(/\(([^()]*\/[^()]*)\)\s*\.?$/) ?? text.match(/\[([^[\]]*\/[^[\]]*)\]\s*\.?$/);
    const options = br ? br[1].split('/').map(o => o.trim()).filter(Boolean) : [];
    if (br) text = text.slice(0, br.index).trim();
    if (!text) continue;
    if (options.length === 2 && options.some(o => YES.test(o)) && options.some(o => NO.test(o))) {
      questions.push({ type: 'yesno', title: text, required: true, correct: correct.map(c => (YES.test(c) ? 'yes' : 'no')) });
    } else if (options.length >= 2) {
      const right = correct.map(c => options.find(o => o.toLowerCase() === c.toLowerCase()) ?? c);
      questions.push({ type: right.length > 1 ? 'checks' : 'choice', title: text, required: true, options: options.slice(0, 12), correct: right });
    } else {
      questions.push({ type: /mail/i.test(text) ? 'email' : 'short', title: text, required: false, correct });
    }
  }
  return { title, description, questions };
}

export function formFromAnswer(answer: string): AiForm {
  let raw: unknown;
  try { raw = jsonOf(answer); } catch { try { raw = jsonOf(answer.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1')); } catch { raw = null; } }
  const o = (raw && typeof raw === 'object' ? raw : {}) as { title?: unknown; description?: unknown; questions?: unknown };
  let list = Array.isArray(o.questions) ? o.questions : Array.isArray(raw) ? raw as unknown[] : null;
  // A website answers with plain lines (what formChat asks for): "Title: …", then one question per line, choices in
  // brackets split by "/", and "✓ answer" for a quiz.
  let title = typeof o.title === 'string' ? o.title : '', description = typeof o.description === 'string' ? o.description : '';
  if (!list) {
    const prose = proseForm(answer);
    list = prose.questions; title ||= prose.title; description ||= prose.description;
  }
  const questions = list.slice(0, 60).map(x => {
    const q = cleanQuestion(x);
    if (!q || !q.title.trim()) return null;
    const c = (x as { correct?: unknown }).correct;
    const correct = Array.isArray(c) ? c.filter(s => typeof s === 'string') as string[] : [];
    return { ...q, correct: WITH_OPTIONS.includes(q.type) ? correct.filter(s => q.options.includes(s)) : q.type === 'yesno' ? correct.map(s => (/^(yes|oui|sí|si|sim|ja|true)$/i.test(s) ? 'yes' : 'no')) : correct };
  }).filter((q): q is Question => !!q);
  return { title: title.slice(0, 200), description: description.slice(0, 1000), questions };
}

export async function formWithAi(ai: AiApi, request: string, lang: string, quiz: boolean, signal?: AbortSignal): Promise<AiForm> {
  const words = LANG[lang] ?? 'English';
  const answer = await ai.ask({
    system: SYSTEM, schema: SCHEMA, effort: 'medium', signal,
    messages: [{ role: 'user', content: `Form: ${request}\n${quiz ? 'It is a quiz: give the right answers.\n' : ''}Write it in ${words}.` }],
    chatPrompt: formChat(request, lang, quiz),
  });
  return formFromAnswer(answer);
}
