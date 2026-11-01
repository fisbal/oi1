// In 1 Mail with an AI: a sentence ("ask my landlord to fix the heating") becomes a mail with a subject and a body.
// Works with an API AI (JSON answer) and with a website AI (the person pastes back plain text: first line = subject).

import type { AiApi } from '../../shell/contract';
import { jsonOf } from '../assistant/plan';

const LANG: Record<string, string> = { en: 'English', fr: 'French', es: 'Spanish', pt: 'Portuguese', de: 'German' };

const SCHEMA: Record<string, unknown> = {
  type: 'object', additionalProperties: false, required: ['subject', 'body'],
  properties: { subject: { type: 'string' }, body: { type: 'string' } },
};

const SYSTEM = `You write e-mails for In 1 Mail. Write one clear, polite, ready-to-send e-mail for the request: a short subject
(under 80 characters) and a body with a greeting, short paragraphs and a closing line. Plain text only, no Markdown.
Do not invent facts: use {{Field}} placeholders (like {{Date}}) for anything the request does not say. Do not add a signature name.`;

export interface AiMail { subject: string; body: string }

const clean = (s: string) => s.replace(/\r/g, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#+\s*/gm, '').trim();

/** Reads an AI answer: JSON first, then "Subject: …" lines, then first line = subject when it is short. */
export function mailFromAnswer(answer: string): AiMail {
  try {
    const o = jsonOf(answer) as { subject?: unknown; body?: unknown };
    if (o && typeof o === 'object' && (typeof o.body === 'string' || typeof o.subject === 'string')) {
      return { subject: clean(String(o.subject ?? '')).slice(0, 200), body: clean(String(o.body ?? '')).slice(0, 20000) };
    }
  } catch { /* plain text */ }
  let text = clean(answer.replace(/^```\w*\n?|```$/gm, ''));
  let subject = '';
  const m = text.match(/^\s*(?:subject|objet|asunto|assunto|betreff|sujet)\s*:\s*(.+)$/im);
  if (m) { subject = m[1].trim(); text = text.replace(m[0], '').trim(); }
  else {
    const lines = text.split('\n');
    if (lines.length > 2 && lines[0].length < 90 && !/[,:]$/.test(lines[0].trim()) && !/^(hello|hi|dear|bonjour|cher|chère|hola|olá|ola|hallo|liebe)/i.test(lines[0])) {
      subject = lines[0].trim(); text = lines.slice(1).join('\n').trim();
    }
  }
  text = text.replace(/^\s*(?:body|message|corps|cuerpo|corpo|text)\s*:\s*/i, '');
  return { subject: subject.slice(0, 200), body: text.slice(0, 20000) };
}

export async function mailWithAi(ai: AiApi, request: string, lang: string, myName: string, signal?: AbortSignal): Promise<AiMail> {
  const words = LANG[lang] ?? 'English';
  const who = myName.trim() ? ` The sender is ${myName.trim()}.` : '';
  const answer = await ai.ask({
    system: SYSTEM, schema: SCHEMA, effort: 'low', signal,
    messages: [{ role: 'user', content: `Mail: ${request}\nWrite it in ${words}.${who}` }],
    chatPrompt: `Hello! Please write a ready-to-send e-mail in ${words} for: "${request}".${who} Put the subject on the first line as "Subject: …", then the mail. Plain text, no Markdown.`,
  });
  return mailFromAnswer(answer);
}
