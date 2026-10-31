// Sentence style, on demand: Claude reads the paragraphs and points at the phrases that read heavy, vague
// or repetitive, each with a better wording. They show as green underlines, fixed from the same bubble.

import type { Editor } from '@tiptap/core';
import type { AiApi } from '../../shell/contract';
import { langOf, paragraphs, recheck, styleFound } from './extension';
import type { Issue } from './proof';

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          paragraph: { type: 'integer', description: 'Index of the paragraph, from 0' },
          quote: { type: 'string', description: 'The exact words to change, copied from the paragraph' },
          better: { type: 'string', description: 'The words to put instead, same language' },
          why: { type: 'string', description: 'Why, in a few words, in the language of the interface' },
        },
        required: ['paragraph', 'quote', 'better', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const;

/** Asks Claude about the style of the editor's paragraphs (at most 60) and underlines what it found. Gives how many. */
export async function checkStyle(editor: Editor, ai: AiApi, uiLanguage: string, tag: string, signal?: AbortSignal): Promise<number> {
  const paras = paragraphs(editor).slice(0, 60);
  if (!paras.length) return 0;
  const answer = await ai.ask({
    system: 'You are a careful editor. Point out phrases whose style can be better: too long, vague, repeated words, passive where active is clearer, wordy, '
      + 'wrong register. Do not report spelling or grammar mistakes, and leave names, numbers and quotes alone. At most 3 items per paragraph, only real gains. '
      + `Write "why" in ${uiLanguage}. Keep each "better" in the paragraph's own language (${paras.map(p => langOf(p, tag)).join(', ')}).`,
    messages: [{ role: 'user', content: paras.map((p, i) => `[${i}] ${p}`).join('\n\n') }],
    schema: SCHEMA as unknown as Record<string, unknown>,
    effort: 'low',
    signal,
  });
  const { items } = JSON.parse(answer) as { items: { paragraph: number; quote: string; better: string; why: string }[] };
  for (const p of paras) styleFound.delete(p);
  let n = 0;
  for (const it of items) {
    const p = paras[it.paragraph];
    const at = p?.indexOf(it.quote) ?? -1;
    if (!p || at < 0 || !it.quote || it.quote === it.better) continue;
    const issue: Issue = { kind: 'style', from: at, to: at + it.quote.length, word: it.quote, message: it.why, replacements: [it.better], rule: 'claude-style' };
    styleFound.set(p, [...(styleFound.get(p) ?? []), issue]);
    n++;
  }
  recheck(editor);
  return n;
}
