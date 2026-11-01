// In 1 Letter's copilot: what Claude sees (the selection or the whole letter), the quick actions,
// and the ways an answer goes back into the letter. Corrections come back as tracked changes, word by word,
// so every fix can be accepted or rejected like a colleague's edit in Word.

import type { Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { AiApi } from '../../shell/contract';
import { LANGUAGES, t } from '../../shell/i18n';
import type { CopilotContext, CopilotHost } from '../../ui/Copilot';
import { wordCount } from '../../ui/Copilot';
import { markdownToHtml } from '../../ui/markdown';
import { isTracking, setTracking } from './review';
import { fieldList, fieldsIn, fillFields, isEmptyDoc, longDate, markupToDoc, selectNextField } from './templates/markup';

const LEAF = '￼';

interface Where { from: number; to: number; whole: boolean }

/** The text blocks (paragraphs, headings, list items) between two positions, with where each starts. */
function blocksIn(doc: PmNode, from: number, to: number): { pos: number; node: PmNode }[] {
  const out: { pos: number; node: PmNode }[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) { if (node.textContent.trim()) out.push({ pos, node }); return false; }
    return true;
  });
  return out;
}

// Words, spaces and signs, so a diff changes whole words and keeps the spaces between them.
const tokens = (s: string) => s.match(/\s+|[\p{L}\p{N}_]+(?:['’][\p{L}\p{N}_]+)*|[^\s\p{L}\p{N}_]/gu) ?? [];

/** The smallest set of word replacements that turns `a` into `b`, as character ranges of `a`. */
export function wordDiff(a: string, b: string): { from: number; to: number; text: string }[] {
  const x = tokens(a), y = tokens(b);
  const n = x.length, m = y.length;
  // Longest common subsequence of tokens; paragraphs are short, so the full table is fine.
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const edits: { from: number; to: number; text: string }[] = [];
  let i = 0, j = 0, at = 0;
  let cur: { from: number; to: number; text: string } | null = null;
  const close = () => { if (cur && (cur.to > cur.from || cur.text)) edits.push(cur); cur = null; };
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) { close(); at += x[i].length; i++; j++; }
    else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) { cur ??= { from: at, to: at, text: '' }; cur.text += y[j]; j++; }
    else { cur ??= { from: at, to: at, text: '' }; at += x[i].length; cur.to = at; i++; }
  }
  close();
  return edits;
}

const CORRECT_SCHEMA = {
  type: 'object',
  properties: { paragraphs: { type: 'array', items: { type: 'string' } } },
  required: ['paragraphs'],
  additionalProperties: false,
};

/** Asks Claude to correct the paragraphs in `where` and puts the fixes in as tracked changes. Returns what to say. */
async function correct(body: Editor, ai: AiApi, where: Where, signal: AbortSignal): Promise<string> {
  const blocks = blocksIn(body.state.doc, where.from, where.to);
  if (!blocks.length) return t('ai.letter.nothing');
  const texts = blocks.map(b => b.node.textBetween(0, b.node.content.size, undefined, LEAF));
  const answer = await ai.ask({
    system: 'You are a meticulous proofreader inside In 1 Letter, a word processor. You fix spelling, grammar, agreement, punctuation and typography mistakes in the language each paragraph is written in. You never change the meaning, the tone, the wording that is already correct, names, numbers or the language. Keep every ￼ character exactly where it is: it stands for a picture or a field. Return the same number of paragraphs, in the same order.',
    messages: [{ role: 'user', content: `Correct these ${texts.length} paragraphs. Return them all, corrected, as JSON.\n\n${JSON.stringify({ paragraphs: texts })}` }],
    schema: CORRECT_SCHEMA,
    effort: 'low',
    signal,
  });
  let fixed: string[];
  try { fixed = (JSON.parse(answer) as { paragraphs: string[] }).paragraphs; } catch { return t('ai.err.other', { msg: 'JSON' }); }
  if (fixed.length !== texts.length) return t('ai.err.other', { msg: `${fixed.length} / ${texts.length}` });
  // The letter may have changed while Claude worked: only touch paragraphs that are still the same.
  const now = body.state.doc;
  const ops: { from: number; to: number; text: string }[] = [];
  for (let k = blocks.length - 1; k >= 0; k--) {
    const { pos } = blocks[k];
    const node = now.nodeAt(pos);
    if (!node?.isTextblock || node.textBetween(0, node.content.size, undefined, LEAF) !== texts[k]) continue;
    const edits = wordDiff(texts[k], fixed[k]);
    for (let e = edits.length - 1; e >= 0; e--) {
      const ed = edits[e];
      if (texts[k].slice(ed.from, ed.to).includes(LEAF) || ed.text.includes(LEAF)) continue;
      ops.push({ from: pos + 1 + ed.from, to: pos + 1 + ed.to, text: ed.text });
    }
  }
  const changes = ops.length;
  if (!changes) return t('ai.letter.noMistakes');
  const was = isTracking(body);
  if (!was) setTracking(body, true);
  // From the end of the letter to the start, so earlier positions stay right.
  const tr = body.state.tr;
  for (const op of ops) {
    if (op.text) tr.insertText(op.text, op.from, op.to);
    else tr.delete(op.from, op.to);
  }
  body.view.dispatch(tr);
  if (!was) setTracking(body, false);
  return changes === 1 ? t('ai.letter.oneFix') : t('ai.letter.fixes', { n: changes });
}

const MARKUP_RULES = `Write it in this line markup, one paragraph per line:
"# " heading 1 (titles like MEMORANDUM), "## " heading 2, "! " a bold line (subject line, To/From), "> " a right-aligned line (date),
"- " a bullet, a line with only "---" puts a signature line above the next line, an empty line is an empty paragraph.
Write {date} for today's date. Put every detail you do not know in [square brackets], like [First and last name] or [file number],
so the user can fill it in. No Markdown other than this, no ** or code fences, no comments before or after.`;

/** Asks Claude for a whole letter or document in the template markup, so its unknown details become fields to fill. */
async function writeDoc(body: Editor, ai: AiApi, request: string, docLang: 'fr' | 'en', signal: AbortSignal): Promise<string> {
  const answer = await ai.ask({
    system: `You write administrative, government, military and personal letters, memos, reports and CVs inside In 1 Letter. You follow the conventions of the genre (block letter, military memorandum with file number and numbered paragraphs, SITREP, five-paragraph order, CV sections) and the official style of the country the user names, or Canada by default. Write in the language of the request (${docLang === 'fr' ? 'French' : 'English'} if unclear). ${MARKUP_RULES}`,
    messages: [{ role: 'user', content: request }],
    signal,
  });
  const content = markupToDoc(answer.replace(/^```\w*\n?|```\s*$/g, '').trim(), longDate(docLang === 'fr' ? 'fr-CA' : 'en-CA'));
  if (isEmptyDoc(body)) body.commands.setContent({ type: 'doc', content });
  else body.chain().focus().insertContent(content).run();
  const n = fieldsIn(body.state.doc).length;
  if (n) selectNextField(body);
  return n ? t('ai.letter.docWritten', { n }) : t('ai.letter.docWrittenDone');
}

const FILL_SCHEMA = {
  type: 'object',
  properties: { values: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, value: { type: 'string' } }, required: ['field', 'value'], additionalProperties: false } } },
  required: ['values'],
  additionalProperties: false,
};

/** Fills the letter's [fields] from what the user tells Claude, leaving the ones it cannot answer. */
async function fillWithAi(body: Editor, ai: AiApi, details: string, signal: AbortSignal): Promise<string> {
  const fields = fieldList(body.state.doc).map(f => f.label);
  if (!fields.length) return t('ai.letter.noFields');
  const answer = await ai.ask({
    system: 'You fill in the [bracketed] fields of a letter or CV in In 1 Letter from the details the user gives. For each field you can answer from the details (or write well from them, for fields that ask for a sentence or a paragraph), return its exact label and the text that replaces it, in the language of the letter. Leave out fields you cannot answer: never invent names, numbers, dates or addresses.',
    messages: [{ role: 'user', content: `The letter:\n<letter>\n${body.getText({ blockSeparator: '\n' })}\n</letter>\n\nFields: ${JSON.stringify(fields)}\n\nDetails from the user: ${details}` }],
    schema: FILL_SCHEMA,
    signal,
  });
  let values: { field: string; value: string }[];
  try { values = (JSON.parse(answer) as { values: { field: string; value: string }[] }).values; } catch { return t('ai.err.other', { msg: 'JSON' }); }
  const n = fillFields(body, Object.fromEntries(values.filter(v => fields.includes(v.field)).map(v => [v.field, v.value])));
  const left = fieldsIn(body.state.doc).length;
  return t('ai.letter.filledN', { n, left });
}

/** Everything the copilot needs to work in a letter. */
export function letterCopilot(body: Editor, title: string, docLang: 'fr' | 'en' = 'en'): CopilotHost {
  const context = (): CopilotContext | null => {
    const { from, to, empty } = body.state.selection;
    if (!empty) {
      const text = body.state.doc.textBetween(from, to, '\n\n', ' ');
      if (text.trim()) return { label: t('ai.letter.selection', { n: wordCount(text) }), text, at: { from, to, whole: false } satisfies Where };
    }
    const text = body.getText({ blockSeparator: '\n\n' });
    if (!text.trim()) return null;
    return { label: t('ai.letter.whole', { n: wordCount(text) }), text, at: { from: 0, to: body.state.doc.content.size, whole: true } satisfies Where };
  };
  const put = (answer: string, at: unknown, tracked: boolean) => {
    const w = at as Where | undefined;
    const html = markdownToHtml(answer);
    const was = isTracking(body);
    if (tracked && !was) setTracking(body, true);
    const chain = body.chain().focus();
    if (w && !w.whole) chain.insertContentAt({ from: Math.min(w.from, body.state.doc.content.size), to: Math.min(w.to, body.state.doc.content.size) }, html).run();
    else if (w?.whole) chain.selectAll().insertContent(html).run();
    else chain.insertContent(html).run();
    if (tracked && !was) setTracking(body, false);
  };
  const langs = LANGUAGES.map(l => ({ label: l.name, prompt: `Translate the context into ${l.name}. Keep the paragraphs, lists and headings. Reply with only the translation.` }));
  return {
    app: 'In 1 Letter',
    role: `In 1 Letter is a word processor like Word. The open letter is "${title}". Answers you write as content can be put into the letter with formatting (paragraphs, headings with #, lists, **bold**).`,
    context,
    actions: [
      { id: 'correct', icon: 'spell', label: t('ai.letter.correct'), needsContext: true, run: (ai, c, signal) => correct(body, ai, c!.at as Where, signal) },
      {
        id: 'rewrite', icon: 'pen', label: t('ai.letter.rewrite'), needsContext: true, choices: [
          { label: t('ai.letter.clearer'), prompt: 'Rewrite the context so it is clearer and easier to read. Keep the meaning and the language.' },
          { label: t('ai.letter.formal'), prompt: 'Rewrite the context in a more formal, professional tone. Keep the meaning and the language.' },
          { label: t('ai.letter.friendly'), prompt: 'Rewrite the context in a warmer, friendlier tone. Keep the meaning and the language.' },
          { label: t('ai.letter.shorter'), prompt: 'Rewrite the context about half as long, keeping every important point. Keep the language.' },
          { label: t('ai.letter.longer'), prompt: 'Develop the context a little more, with useful detail but no filler. Keep the language.' },
        ],
      },
      { id: 'summary', icon: 'outline', label: t('ai.letter.summarize'), needsContext: true, prompt: 'Summarize the context in a few bullet points, in the language of the context.' },
      { id: 'translate', icon: 'language', label: t('ai.letter.translate'), needsContext: true, choices: langs },
      { id: 'continue', icon: 'next', label: t('ai.letter.continue'), needsContext: true, prompt: 'Continue writing after the context with one or two paragraphs in the same voice and language. Reply with only the new paragraphs.' },
      { id: 'write', icon: 'sparkle', label: t('ai.letter.write'), fill: t('ai.letter.writeFill') },
      { id: 'docWrite', icon: 'envelope', label: t('ai.letter.docWrite'), fill: t('ai.letter.docWriteFill'), ask: (ai, q, _c, signal) => writeDoc(body, ai, q, docLang, signal) },
      { id: 'fillAi', icon: 'fill', label: t('ai.letter.fillAi'), fill: t('ai.letter.fillAiFill'), ask: (ai, q, _c, signal) => fillWithAi(body, ai, q, signal) },
    ],
    applies: [
      { id: 'replace', icon: 'replace', label: t('ai.apply.replace'), run: (_p, answer, at) => put(answer, at, false) },
      { id: 'track', icon: 'track', label: t('ai.apply.track'), run: (_p, answer, at) => put(answer, at, true) },
      { id: 'insert', icon: 'paste', label: t('ai.apply.insert'), run: (_p, answer) => { body.chain().focus().insertContent(markdownToHtml(answer)).run(); } },
    ],
  };
}
