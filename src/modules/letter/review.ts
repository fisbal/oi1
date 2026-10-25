// Word's Review and References tools for the letter: comments, tracked changes and footnotes.
//
// Comments are a mark with the comment's id on the text it is about; what the comment says (author,
// date, replies, resolved) lives beside the document in LetterDoc.comments, like Word's comments.xml.
// Tracked changes use @handlewithcare/prosemirror-suggest-changes (MIT): while tracking is on, every edit
// becomes an insertion or deletion mark instead of changing the text, and Accept or Reject applies it.
// Footnotes are a small inline node that keeps the note's text; pagination puts the notes at the
// bottom of their page (see pagination.ts).

import { Extension, Mark, Node, mergeAttributes, type Editor } from '@tiptap/core';
import type { Mark as PmMark, Node as PmNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import {
  applySuggestion, applySuggestions, isSuggestChangesEnabled, revertSuggestion, revertSuggestions,
  suggestChanges, suggestChangesKey, transformToSuggestionTransaction,
} from '@handlewithcare/prosemirror-suggest-changes';

// ---------- who is writing ----------

const USER_KEY = 'oi1.userName';

/** The name shown on comments and changes. Asked once, then kept on this device. */
export function userName(ask = false): string {
  let name = '';
  try { name = localStorage.getItem(USER_KEY) ?? ''; } catch { /* private window */ }
  if (!name && ask) {
    name = (prompt(askNameText(), '') ?? '').trim();
    if (name) try { localStorage.setItem(USER_KEY, name); } catch { /* private window */ }
  }
  return name || defaultName;
}
let askNameText = () => 'Your name';
let defaultName = 'Me';
/** Lets the letter give the translated question and fallback name. */
export function setUserNameTexts(question: () => string, fallback: string) { askNameText = question; defaultName = fallback; }

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';

const AUTHOR_COLORS = ['#2B6CB0', '#C05621', '#2F855A', '#B83280', '#6B46C1', '#C53030', '#2C7A7B', '#975A16'];
/** Each author keeps one color, like in Word. */
export function authorColor(name: string | null | undefined): string {
  let h = 0;
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AUTHOR_COLORS[h % AUTHOR_COLORS.length];
}

// ---------- comments ----------

export interface CommentReply { id: string; author: string; date: string; text: string }
export interface LetterComment extends CommentReply { resolved?: boolean; replies?: CommentReply[] }

export const newCommentId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const Comment = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '', // comments can overlap
  addAttributes() {
    return { id: { default: null, parseHTML: el => el.getAttribute('data-comment'), renderHTML: a => ({ 'data-comment': a.id }) } };
  },
  parseHTML() { return [{ tag: 'span[data-comment]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { class: 'cmt' }), 0]; },
});

/** Where each comment sits in the document, in reading order. */
export function commentRanges(doc: PmNode): Map<string, { from: number; to: number }> {
  const out = new Map<string, { from: number; to: number }>();
  doc.descendants((node, pos) => {
    if (!node.isInline) return true;
    for (const m of node.marks) {
      if (m.type.name !== 'comment' || !m.attrs.id) continue;
      const r = out.get(m.attrs.id as string);
      if (r) r.to = pos + node.nodeSize;
      else out.set(m.attrs.id as string, { from: pos, to: pos + node.nodeSize });
    }
    return false;
  });
  return out;
}

/** The comments the cursor is in. */
export function commentsAt(state: EditorState): string[] {
  const $from = state.selection.$from;
  const marks = [...$from.marks(), ...($from.nodeAfter?.marks ?? [])];
  return [...new Set(marks.filter(m => m.type.name === 'comment').map(m => m.attrs.id as string))];
}

/** Puts a new comment on the selection, or on the word at the cursor when nothing is selected. */
export function addCommentMark(editor: Editor, id: string): boolean {
  const { state } = editor;
  let { from, to } = state.selection;
  if (from === to) {
    const $pos = state.selection.$from;
    const text = $pos.parent.textContent;
    const at = $pos.parentOffset;
    let a = at; let b = at;
    while (a > 0 && /[\p{L}\p{N}'’-]/u.test(text[a - 1])) a--;
    while (b < text.length && /[\p{L}\p{N}'’-]/u.test(text[b])) b++;
    if (a === b) { // no word here: the whole paragraph
      a = 0; b = text.length;
    }
    if (a === b) return false;
    from = $pos.start() + a;
    to = $pos.start() + b;
  }
  const tr = state.tr.addMark(from, to, state.schema.marks.comment.create({ id }));
  editor.view.dispatch(tr.setMeta(RAW, true)); // a comment is not a change to the text
  editor.commands.focus();
  return true;
}

export function removeCommentMark(editor: Editor, id: string) {
  const { state } = editor;
  const tr = state.tr;
  state.doc.descendants((node, pos) => {
    if (!node.isInline) return true;
    const m = node.marks.find(x => x.type.name === 'comment' && x.attrs.id === id);
    if (m) tr.removeMark(pos, pos + node.nodeSize, m);
    return false;
  });
  if (tr.docChanged) editor.view.dispatch(tr.setMeta(RAW, true));
}

// ---------- tracked changes ----------

/** A transaction with this meta is never turned into a tracked change (loading a file, accepting a change). */
export const RAW = 'oi1-raw';

const idAttr = {
  default: null,
  parseHTML: (el: HTMLElement) => { try { return JSON.parse(el.dataset.id ?? 'null'); } catch { return null; } },
  renderHTML: (a: Record<string, unknown>) => ({ 'data-id': JSON.stringify(a.id) }),
};
const whoAttrs = {
  author: { default: null, parseHTML: (el: HTMLElement) => el.dataset.author ?? null, renderHTML: (a: Record<string, unknown>) => (a.author ? { 'data-author': a.author, style: `--rev: ${authorColor(a.author as string)}` } : {}) },
  date: { default: null, parseHTML: (el: HTMLElement) => el.dataset.date ?? null, renderHTML: (a: Record<string, unknown>) => (a.date ? { 'data-date': a.date } : {}) },
};

export const Insertion = Mark.create({
  name: 'insertion',
  inclusive: false,
  excludes: 'deletion modification insertion',
  addAttributes() { return { id: idAttr, ...whoAttrs }; },
  parseHTML() { return [{ tag: 'ins[data-id]' }]; },
  renderHTML({ HTMLAttributes }) { return ['ins', HTMLAttributes, 0]; },
});

export const Deletion = Mark.create({
  name: 'deletion',
  inclusive: false,
  excludes: 'insertion modification deletion',
  addAttributes() { return { id: idAttr, ...whoAttrs }; },
  parseHTML() { return [{ tag: 'del[data-id]' }]; },
  renderHTML({ HTMLAttributes }) { return ['del', HTMLAttributes, 0]; },
});

/** A tracked format change (bold, a heading level...). */
export const Modification = Mark.create({
  name: 'modification',
  inclusive: false,
  excludes: 'deletion insertion',
  addAttributes() {
    return {
      id: idAttr,
      type: { default: null, parseHTML: el => el.dataset.modType ?? null, renderHTML: a => ({ 'data-mod-type': a.type }) },
      attrName: { default: null, rendered: false },
      previousValue: { default: null, rendered: false },
      newValue: { default: null, rendered: false },
      ...whoAttrs,
    };
  },
  parseHTML() { return [{ tag: 'span[data-type="modification"]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'modification' }), 0]; },
});

const SUGGESTION_MARKS = 'insertion modification deletion';
// Whole paragraphs, list items and table rows can be inserted or deleted as tracked changes.
const BLOCK_CONTAINERS = new Set(['doc', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'table', 'tableRow', 'tableCell', 'tableHeader']);
const SUGGESTION_TYPES = new Set(['insertion', 'deletion', 'modification']);

export interface TrackStorage { author: () => string }

declare module '@tiptap/core' {
  interface Storage { trackChanges: TrackStorage }
}

/** Gives new changes their author and time, which Word shows and keeps. Typing on in a change keeps its stamp. */
function stampAuthors(tr: Transaction, author: string) {
  const known = new Map<string, { author: string; date: string }>();
  const key = (m: PmMark) => `${m.type.name}:${JSON.stringify(m.attrs.id)}`;
  tr.doc.descendants(node => {
    for (const m of node.marks) if (SUGGESTION_TYPES.has(m.type.name) && m.attrs.author) known.set(key(m), { author: m.attrs.author, date: m.attrs.date });
    return true;
  });
  const fresh = { author, date: new Date().toISOString() };
  const stamp = (m: PmMark) => m.type.create({ ...m.attrs, ...(known.get(key(m)) ?? fresh) });
  tr.doc.descendants((node, pos) => {
    for (const m of node.marks) {
      if (!SUGGESTION_TYPES.has(m.type.name) || m.attrs.author) continue;
      if (node.isInline) tr.removeMark(pos, pos + node.nodeSize, m).addMark(pos, pos + node.nodeSize, stamp(m));
      else tr.removeNodeMark(pos, m).addNodeMark(pos, stamp(m));
    }
    return true;
  });
}

export const TrackChanges = Extension.create<object, TrackStorage>({
  name: 'trackChanges',
  addStorage() { return { author: () => userName() }; },
  extendNodeSchema(extension) {
    return BLOCK_CONTAINERS.has(extension.name) ? { marks: SUGGESTION_MARKS } : {};
  },
  addProseMirrorPlugins() { return [suggestChanges()]; },
  dispatchTransaction({ transaction, next }) {
    const state = this.editor.state;
    if (!transaction.docChanged || !isSuggestChangesEnabled(state) || transaction.getMeta(RAW)
      || transaction.getMeta('history$') || transaction.getMeta('preventUpdate') || transaction.getMeta(suggestChangesKey)) {
      next(transaction);
      return;
    }
    const tracked = transformToSuggestionTransaction(transaction, state);
    stampAuthors(tracked, this.storage.author());
    next(tracked);
  },
});

export const isTracking = (editor: Editor) => isSuggestChangesEnabled(editor.state);

export function setTracking(editor: Editor, on: boolean) {
  editor.view.dispatch(editor.state.tr.setMeta(suggestChangesKey, { enabled: on }).setMeta('addToHistory', false));
}

export interface Change { id: number | string; kind: 'insertion' | 'deletion' | 'modification'; from: number; to: number; author: string | null; date: string | null; text: string }

/** Every tracked change, in reading order. An insertion and a deletion with the same id are one replacement. */
export function listChanges(doc: PmNode): Change[] {
  const byKey = new Map<string, Change>();
  doc.descendants((node, pos) => {
    for (const m of node.marks) {
      if (!SUGGESTION_TYPES.has(m.type.name)) continue;
      const key = `${m.type.name}:${JSON.stringify(m.attrs.id)}`;
      const end = pos + node.nodeSize;
      const text = (node.isText ? node.text ?? '' : node.textContent).replace(/​/g, '');
      const c = byKey.get(key);
      if (c) { c.to = end; c.text += text; }
      else byKey.set(key, { id: m.attrs.id as number | string, kind: m.type.name as Change['kind'], from: pos, to: end, author: m.attrs.author as string | null, date: m.attrs.date as string | null, text });
    }
    return true;
  });
  return [...byKey.values()].sort((a, b) => a.from - b.from);
}

/** The change at the cursor, or the first one inside the selection. */
export function changeAt(editor: Editor): Change | null {
  const { from, to } = editor.state.selection;
  return listChanges(editor.state.doc).find(c => (from === to ? c.from <= from && c.to >= from : c.from < to && c.to > from)) ?? null;
}

const rawDispatch = (editor: Editor) => (tr: Transaction) => editor.view.dispatch(tr.setMeta(RAW, true));

/** Accepts (keeps) or rejects (undoes) one change, or all of them. */
export function resolveChange(editor: Editor, accept: boolean, id?: number | string): boolean {
  const cmd = id === undefined ? (accept ? applySuggestions : revertSuggestions) : (accept ? applySuggestion(id) : revertSuggestion(id));
  const ok = cmd(editor.state, rawDispatch(editor));
  editor.commands.focus();
  return ok;
}

/** Selects the next (or previous) change after the cursor. */
export function goToChange(editor: Editor, dir: 1 | -1): boolean {
  const changes = listChanges(editor.state.doc);
  if (!changes.length) return false;
  const { from, to } = editor.state.selection;
  const next = dir > 0 ? changes.find(c => c.from >= to) ?? changes[0] : [...changes].reverse().find(c => c.to <= from) ?? changes[changes.length - 1];
  editor.chain().focus().setTextSelection({ from: next.from, to: next.to }).scrollIntoView().run();
  return true;
}

// ---------- footnotes ----------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      insertFootnote: (text: string) => ReturnType;
    };
  }
}

/** A footnote reference. Its number comes from its place in the letter; its text shows at the bottom of the page. */
export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { text: { default: '', parseHTML: el => el.getAttribute('data-footnote') ?? '', renderHTML: a => ({ 'data-footnote': a.text }) } };
  },
  parseHTML() { return [{ tag: 'sup[data-footnote]' }]; },
  renderHTML({ HTMLAttributes }) { return ['sup', mergeAttributes(HTMLAttributes, { class: 'fn-ref' })]; },
  renderText() { return ''; },
  addCommands() {
    return {
      insertFootnote: (text: string) => ({ chain }) => chain().insertContent({ type: this.name, attrs: { text } }).run(),
    };
  },
});

export interface FootnoteInfo { n: number; text: string; pos: number }

export function listFootnotes(doc: PmNode): FootnoteInfo[] {
  const out: FootnoteInfo[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'footnote') out.push({ n: out.length + 1, text: node.attrs.text as string, pos });
    return true;
  });
  return out;
}

/** The footnote that is selected or right before the cursor. */
export function footnoteAt(state: EditorState): { pos: number; text: string } | null {
  const sel = state.selection as EditorState['selection'] & { node?: PmNode };
  if (sel.node?.type.name === 'footnote') return { pos: sel.from, text: sel.node.attrs.text as string };
  const before = sel.$from.nodeBefore;
  if (sel.empty && before?.type.name === 'footnote') return { pos: sel.from - before.nodeSize, text: before.attrs.text as string };
  return null;
}
