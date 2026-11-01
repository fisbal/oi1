// In 1 Form with an AI: a sentence becomes a whole form (questions of the right kind, options, required ones, right
// answers for a quiz). The answer is checked question by question before anything is added.

import type { AiApi } from '../../shell/contract';
import { jsonOf } from '../assistant/plan';
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

export function formFromAnswer(answer: string): AiForm {
  let raw: unknown;
  try { raw = jsonOf(answer); } catch { try { raw = jsonOf(answer.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1')); } catch { raw = null; } }
  const o = (raw && typeof raw === 'object' ? raw : {}) as { title?: unknown; description?: unknown; questions?: unknown };
  let list = Array.isArray(o.questions) ? o.questions : Array.isArray(raw) ? raw as unknown[] : null;
  // A website may answer with plain lines: one question per line, options after a colon or in brackets.
  if (!list) {
    list = answer.split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(l => l && l.length < 300 && !/^```/.test(l) && !l.startsWith('#'))
      .map(l => {
        const m = l.match(/^(.*?\?)\s*[:(]?\s*(.+?)\)?$/);
        const opts = m ? m[2].split(/\s*[/,;|]\s*/).filter(Boolean) : [];
        return opts.length >= 2 && opts.length <= 8 ? { type: 'choice', title: m![1], options: opts } : { type: 'short', title: l };
      });
  }
  const questions = list.slice(0, 60).map(x => {
    const q = cleanQuestion(x);
    if (!q || !q.title.trim()) return null;
    const c = (x as { correct?: unknown }).correct;
    const correct = Array.isArray(c) ? c.filter(s => typeof s === 'string') as string[] : [];
    return { ...q, correct: WITH_OPTIONS.includes(q.type) ? correct.filter(s => q.options.includes(s)) : q.type === 'yesno' ? correct.map(s => (/^(yes|oui|sí|si|sim|ja|true)$/i.test(s) ? 'yes' : 'no')) : correct };
  }).filter((q): q is Question => !!q);
  return { title: typeof o.title === 'string' ? o.title.slice(0, 200) : '', description: typeof o.description === 'string' ? o.description.slice(0, 1000) : '', questions };
}

export async function formWithAi(ai: AiApi, request: string, lang: string, quiz: boolean, signal?: AbortSignal): Promise<AiForm> {
  const words = LANG[lang] ?? 'English';
  const answer = await ai.ask({
    system: SYSTEM, schema: SCHEMA, effort: 'medium', signal,
    messages: [{ role: 'user', content: `Form: ${request}\n${quiz ? 'It is a quiz: give the right answers.\n' : ''}Write it in ${words}.` }],
    chatPrompt: `Hello! Please write a form for: "${request}" (in ${words})${quiz ? ', as a quiz with the right answers' : ''}. Answer with only one JSON code block like {"title":"…","description":"…","questions":[{"type":"choice","title":"…","required":true,"options":["A","B"],"rows":[],"correct":[]}]} where type is one of ${QTYPES.join(', ')}.`,
  });
  return formFromAnswer(answer);
}
