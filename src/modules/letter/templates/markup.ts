// The small markup the letter and CV templates are written in, turned into Letter's document JSON,
// and the fields ([words in brackets]) that the Doc adm/Mil tab fills in.
//   # heading 1   ## heading 2   ~ subtitle   ! bold line   > right-aligned line   - bullet
//   --- the next line is a signature line   blank line = empty paragraph   {date} = today

import { Extension, type Editor, type JSONContent } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { LANGUAGES } from '../../../shell/i18n';

/** The yellow of a field still to fill, like a form in Word. */
export const FIELD_COLOR = '#FFF2A8';
const FIELD = /\[([^[\]\n]{1,120})\]/g;
const LEAF = '￼';

/** Today's date, written out in the template's language. */
export function longDate(lang: string, d = new Date()) {
  return d.toLocaleDateString(lang, { dateStyle: 'long' });
}

/** A line's text with its fields highlighted and {date} filled in. */
function inline(text: string, date: string, bold = false): JSONContent[] {
  const out: JSONContent[] = [];
  const marks = bold ? [{ type: 'bold' }] : [];
  let at = 0;
  const s = text.replace(/\{date\}/g, date);
  for (const m of s.matchAll(FIELD)) {
    if (m.index > at) out.push({ type: 'text', text: s.slice(at, m.index), ...(bold ? { marks } : {}) });
    out.push({ type: 'text', text: m[0], marks: [...marks, { type: 'highlight', attrs: { color: FIELD_COLOR } }] });
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ type: 'text', text: s.slice(at), ...(bold ? { marks } : {}) });
  return out;
}

/** The document content for a template, ready for `setContent` or `insertContent`. */
export function markupToDoc(src: string, date: string): JSONContent[] {
  const out: JSONContent[] = [];
  let bullets: JSONContent | null = null;
  let signature = false;
  const para = (text: string, attrs: Record<string, unknown> = {}, bold = false): JSONContent => {
    const content = inline(text, date, bold);
    return { type: 'paragraph', attrs: { spaceAfter: 0, ...attrs }, ...(content.length ? { content } : {}) };
  };
  for (const raw of src.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('- ')) {
      bullets ??= (out.push({ type: 'bulletList', content: [] }), out[out.length - 1]);
      bullets.content!.push({ type: 'listItem', content: [para(line.slice(2))] });
      continue;
    }
    bullets = null;
    if (line === '---') { signature = true; continue; }
    if (signature) {
      signature = false;
      out.push(para(line, { borders: { top: { w: 0.75, color: '#7F7F7F', space: 1 } }, indentRight: 260 }));
    } else if (line.startsWith('## ')) out.push({ type: 'heading', attrs: { level: 2 }, content: inline(line.slice(3), date) });
    else if (line.startsWith('# ')) out.push({ type: 'heading', attrs: { level: 1 }, content: inline(line.slice(2), date) });
    else if (line.startsWith('~ ')) out.push(para(line.slice(2), { styleId: 'subtitle', textAlign: 'left' }));
    else if (line.startsWith('! ')) out.push(para(line.slice(2), {}, true));
    else if (line.startsWith('> ')) out.push(para(line.slice(2), { textAlign: 'right' }));
    else out.push(para(line));
  }
  return out;
}

export interface FieldAt { label: string; from: number; to: number }

/** Every [field] left in the document, in reading order, with where it is. */
export function fieldsIn(doc: PmNode): FieldAt[] {
  const out: FieldAt[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = node.textBetween(0, node.content.size, undefined, LEAF);
    for (const m of text.matchAll(FIELD)) out.push({ label: m[1], from: pos + 1 + m.index, to: pos + 1 + m.index + m[0].length });
    return false;
  });
  return out;
}

/** The fields to fill, once each, with how many times each appears. */
export function fieldList(doc: PmNode): { label: string; count: number }[] {
  const seen = new Map<string, number>();
  for (const f of fieldsIn(doc)) seen.set(f.label, (seen.get(f.label) ?? 0) + 1);
  return [...seen].map(([label, count]) => ({ label, count }));
}

/** Puts each value in place of every [field] with that label, without the yellow. Returns how many were filled. */
export function fillFields(editor: Editor, values: Record<string, string>): number {
  const targets = fieldsIn(editor.state.doc).filter(f => values[f.label]?.trim());
  if (!targets.length) return 0;
  const tr = editor.state.tr;
  const highlight = editor.schema.marks.highlight;
  // From the end, so earlier positions stay right.
  for (const f of [...targets].reverse()) {
    const text = values[f.label].trim();
    tr.insertText(text, f.from, f.to);
    if (highlight) tr.removeMark(f.from, f.from + text.length, highlight);
  }
  editor.view.dispatch(tr);
  return targets.length;
}

/** Selects the next field after the cursor (or the first one), so typing replaces it. False when none is left. */
export function selectNextField(editor: Editor): boolean {
  const fields = fieldsIn(editor.state.doc);
  if (!fields.length) return false;
  const { to } = editor.state.selection;
  const next = fields.find(f => f.from >= to) ?? fields[0];
  editor.chain().focus().setTextSelection({ from: next.from, to: next.to }).scrollIntoView().run();
  return true;
}

/** Typing over a selected [field] writes plain text, not more yellow. */
export const FieldTyping = Extension.create({
  name: 'fieldTyping',
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        handleTextInput(view, from, to, text) {
          const highlight = view.state.schema.marks.highlight;
          if (!highlight || from === to || !/^\[[^[\]\n]+\]$/.test(view.state.doc.textBetween(from, to))) return false;
          view.dispatch(view.state.tr.insertText(text, from, to).removeMark(from, from + text.length, highlight));
          return true;
        },
      },
    })];
  },
});

/** True when the document has nothing in it yet (or only a new letter's "Untitled letter"), so a template can take its place. */
export function isEmptyDoc(editor: Editor) {
  const text = editor.state.doc.textContent.trim();
  return editor.isEmpty || LANGUAGES.some(l => l.messages['letter.untitled'] === text);
}
