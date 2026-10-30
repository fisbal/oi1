// Text tools behind Letter's lists: the 20 ways to change case, and the 20 ways to paste (from keeping the formatting
// to fixing a PDF's broken lines, a table from Excel text, or Claude's correction, translation or summary).

import type { Editor } from '@tiptap/core';

export const CASE_MODES = [
  'sentence', 'lower', 'upper', 'title', 'toggle', 'capitalize', 'noAccents', 'frenchSpaces', 'camel', 'pascal',
  'snake', 'kebab', 'constant', 'dot', 'alternating', 'reverse', 'fullwidth', 'smallCaps', 'superscript', 'trimSpaces',
] as const;
export type CaseMode = (typeof CASE_MODES)[number];

const SMALL_CAPS: Record<string, string> = Object.fromEntries([...'abcdefghijklmnopqrstuvwxyz'].map((c, i) => [c, 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ'[i]]));
const SUPERSCRIPT: Record<string, string> = Object.fromEntries([...'0123456789+-=()abcdefghijklmnoprstuvwxyz'].map((c, i) => [c, '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ'[i]]));
const words = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const joinWords = (s: string, sep: string, f: (w: string, i: number) => string) => {
  const lead = s.match(/^\s*/)![0], trail = s.match(/\s*$/)![0];
  return lead + words(s).map(f).join(sep) + trail;
};

/** The text in another case. `first` tells whether it starts the selection (for sentence case). */
export function changeCaseText(text: string, mode: CaseMode, first = true): string {
  const low = (w: string) => w.toLowerCase();
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  switch (mode) {
    case 'lower': return text.toLowerCase();
    case 'upper': return text.toUpperCase();
    case 'toggle': return [...text].map(ch => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())).join('');
    case 'title': return text.toLowerCase().replace(/(^|[\s(“"'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
    case 'capitalize': return text.replace(/(^|[\s(“"'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
    case 'noAccents': return text.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
    case 'frenchSpaces': return text.replace(/\s*([;:!?»])/g, ' $1').replace(/«\s*/g, '« ');
    case 'camel': return joinWords(text, '', (w, i) => (i ? cap(w) : low(w)));
    case 'pascal': return joinWords(text, '', cap);
    case 'snake': return joinWords(text, '_', low);
    case 'kebab': return joinWords(text, '-', low);
    case 'constant': return joinWords(text, '_', w => w.toUpperCase());
    case 'dot': return joinWords(text, '.', low);
    case 'alternating': { let k = 0; return [...text].map(ch => (/\p{L}/u.test(ch) ? (k++ % 2 ? ch.toUpperCase() : ch.toLowerCase()) : ch)).join(''); }
    case 'reverse': return [...text].reverse().join('');
    case 'fullwidth': return [...text].map(ch => (ch >= '!' && ch <= '~' ? String.fromCharCode(ch.charCodeAt(0) + 0xfee0) : ch === ' ' ? '　' : ch)).join('');
    case 'smallCaps': return [...text.toLowerCase()].map(ch => SMALL_CAPS[ch] ?? ch).join('');
    case 'superscript': return [...text.toLowerCase()].map(ch => SUPERSCRIPT[ch] ?? ch).join('');
    case 'trimSpaces': return text.replace(/[ \t ]{2,}/g, ' ');
    case 'sentence': default: {
      const out = text.toLowerCase().replace(/(^|[.!?]\s+)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
      return first ? out.replace(/\p{L}/u, ch => ch.toUpperCase()) : out;
    }
  }
}

/** Changes the case of the selected text, keeping its formatting. */
export function changeCase(e: Editor, mode: CaseMode) {
  const { from, to } = e.state.selection;
  if (from === to) return;
  const ops: { start: number; end: number; text: string; marks: readonly import('@tiptap/pm/model').Mark[] }[] = [];
  let first = true;
  e.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return;
    const start = Math.max(from, pos), end = Math.min(to, pos + node.text.length);
    const text = node.text.slice(start - pos, end - pos);
    const out = changeCaseText(text, mode, first);
    first = false;
    if (out !== text) ops.push({ start, end, text: out, marks: node.marks });
  });
  if (!ops.length) return;
  const tr = e.state.tr;
  // From the end, so the earlier positions stay right when a change makes the text longer or shorter.
  for (const op of ops.reverse()) tr.replaceWith(op.start, op.end, e.state.schema.text(op.text, op.marks));
  e.view.dispatch(tr);
}

export const PASTE_KINDS = [
  'keep', 'text', 'joinLines', 'clean', 'bullets', 'numbers', 'table', 'quote', 'code', 'heading',
  'upper', 'lower', 'link', 'aiCorrect', 'aiTranslateFr', 'aiTranslateEn', 'aiSummary', 'aiFormal', 'aiPoints', 'aiTable',
] as const;
export type PasteKind = (typeof PASTE_KINDS)[number];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const paras = (s: string) => s.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
const lines = (s: string) => s.split(/\r?\n/).map(l => l.replace(/^\s*(?:[-*•▪◦–]|\d+[.)])\s+/, '').trim()).filter(Boolean);

/** Rows and cells of copied text: tabs (Excel), semicolons or commas (CSV), or two spaces and more. */
export function textToRows(text: string): string[][] {
  const rows = text.split(/\r?\n/).filter(l => l.trim());
  const sep = rows.some(r => r.includes('\t')) ? /\t/ : rows.every(r => r.includes(';')) ? /;/ : rows.every(r => r.includes(',')) ? /,/ : / {2,}/;
  return rows.map(r => r.split(sep).map(c => c.trim().replace(/^"(.*)"$/, '$1')));
}

/** The HTML a plain-text paste turns into. Returns null for the kinds Letter handles itself (keep, and the AI ones). */
export function pasteHtml(kind: PasteKind, text: string): string | null {
  const plain = (s: string) => paras(s).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  switch (kind) {
    case 'text': return plain(text);
    case 'joinLines': return paras(text.replace(/\r/g, '').replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')).map(p => `<p>${esc(p.replace(/\s*\n\s*/g, ' '))}</p>`).join('');
    case 'clean': return plain(text.replace(/[ \t ]{2,}/g, ' ').replace(/ +([,.)])/g, '$1').replace(/^[ \t]+|[ \t]+$/gm, ''));
    case 'bullets': return `<ul>${lines(text).map(l => `<li><p>${esc(l)}</p></li>`).join('')}</ul>`;
    case 'numbers': return `<ol>${lines(text).map(l => `<li><p>${esc(l)}</p></li>`).join('')}</ol>`;
    case 'table': return `<table><tbody>${textToRows(text).map(r => `<tr>${r.map(c => `<td><p>${esc(c)}</p></td>`).join('')}</tr>`).join('')}</tbody></table>`;
    case 'quote': return `<blockquote>${plain(text)}</blockquote>`;
    case 'code': return `<pre><code>${esc(text)}</code></pre>`;
    case 'heading': return `<h2>${esc(text.replace(/\s+/g, ' ').trim())}</h2>`;
    case 'upper': return plain(text.toUpperCase());
    case 'lower': return plain(text.toLowerCase());
    case 'link': {
      const url = text.trim();
      return /^(https?:\/\/|mailto:|www\.)\S+$/i.test(url) ? `<p><a href="${esc(url.startsWith('www.') ? `https://${url}` : url)}">${esc(url)}</a></p>` : plain(text);
    }
    default: return null;
  }
}

/** What Claude is asked to do with pasted text, for the AI kinds. */
export const PASTE_PROMPTS: Partial<Record<PasteKind, string>> = {
  aiCorrect: 'Correct the spelling, grammar and punctuation of this text without changing its meaning, tone or language.',
  aiTranslateFr: 'Translate this text into French. Keep the paragraphs and lists.',
  aiTranslateEn: 'Translate this text into English. Keep the paragraphs and lists.',
  aiSummary: 'Summarize this text in one short paragraph, in its language.',
  aiFormal: 'Rewrite this text in a formal, professional tone, in its language, keeping every point.',
  aiPoints: 'Turn this text into a short list of key points (Markdown bullets), in its language.',
  aiTable: 'Organize the information in this text as a Markdown table with clear column headers, in its language.',
};
