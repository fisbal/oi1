// Find and replace for In 1 Letter: highlights every match and moves through them.

import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

interface Match { from: number; to: number }
interface SearchState { query: string; caseSensitive: boolean; matches: Match[]; current: number }

export const searchKey = new PluginKey<SearchState>('oi1-search');

/** Every place `query` appears in the document. Text inside one paragraph matches even across formatting. */
export function findMatches(doc: PMNode, query: string, caseSensitive: boolean): Match[] {
  if (!query) return [];
  const needle = caseSensitive ? query : query.toLowerCase();
  const out: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // Inline nodes that are not text (breaks, images, fields) count as one character, like their size.
    const raw = doc.textBetween(pos + 1, pos + node.nodeSize - 1, undefined, '￼');
    const text = caseSensitive ? raw : raw.toLowerCase();
    for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) {
      out.push({ from: pos + 1 + i, to: pos + 1 + i + needle.length });
    }
    return false;
  });
  return out;
}

function nearest(matches: Match[], pos: number): number {
  const i = matches.findIndex(m => m.from >= pos);
  return i === -1 ? 0 : i;
}

export const Search = Extension.create({
  name: 'search',
  addProseMirrorPlugins() {
    return [new Plugin<SearchState>({
      key: searchKey,
      state: {
        init: () => ({ query: '', caseSensitive: false, matches: [], current: 0 }),
        apply(tr, prev, _old, state) {
          const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
          if (!meta && !tr.docChanged) return prev;
          const next = { ...prev, ...meta };
          if (meta?.query !== undefined || meta?.caseSensitive !== undefined || tr.docChanged) {
            next.matches = findMatches(state.doc, next.query, next.caseSensitive);
            if (meta?.current === undefined) next.current = Math.min(prev.current, Math.max(next.matches.length - 1, 0));
          }
          return next;
        },
      },
      props: {
        decorations(state) {
          const s = searchKey.getState(state);
          if (!s?.matches.length) return null;
          return DecorationSet.create(state.doc, s.matches.map((m, i) =>
            Decoration.inline(m.from, m.to, { class: i === s.current ? 'find-hit current' : 'find-hit' })));
        },
      },
    })];
  },
});

export function searchState(state: EditorState): SearchState {
  return searchKey.getState(state) ?? { query: '', caseSensitive: false, matches: [], current: 0 };
}

export function setSearch(editor: Editor, query: string, caseSensitive: boolean) {
  const matches = findMatches(editor.state.doc, query, caseSensitive);
  const current = nearest(matches, editor.state.selection.from);
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, { query, caseSensitive, current }));
}

function select(editor: Editor, index: number) {
  const { matches } = searchState(editor.state);
  if (!matches.length) return;
  const i = (index + matches.length) % matches.length;
  const m = matches[i];
  const tr = editor.state.tr.setMeta(searchKey, { current: i }).setSelection(TextSelection.create(editor.state.doc, m.from, m.to));
  editor.view.dispatch(tr.scrollIntoView());
}

export const findNext = (editor: Editor) => {
  const s = searchState(editor.state);
  const sel = editor.state.selection;
  const onCurrent = s.matches[s.current] && s.matches[s.current].from === sel.from && s.matches[s.current].to === sel.to;
  select(editor, onCurrent ? s.current + 1 : nearest(s.matches, sel.from));
};

export const findPrevious = (editor: Editor) => select(editor, searchState(editor.state).current - 1);

/** Replaces the selected match, then moves to the next one. */
export function replaceOne(editor: Editor, text: string) {
  const s = searchState(editor.state);
  const m = s.matches[s.current];
  if (!m) return;
  const sel = editor.state.selection;
  if (sel.from !== m.from || sel.to !== m.to) { select(editor, s.current); return; }
  editor.view.dispatch(editor.state.tr.insertText(text, m.from, m.to));
  select(editor, searchState(editor.state).current);
}

/** Replaces every match in one step (one undo). Returns how many were replaced. */
export function replaceAll(editor: Editor, text: string): number {
  const { matches } = searchState(editor.state);
  if (!matches.length) return 0;
  const tr = editor.state.tr;
  for (let i = matches.length - 1; i >= 0; i--) tr.insertText(text, matches[i].from, matches[i].to);
  editor.view.dispatch(tr);
  return matches.length;
}

export function clearSearch(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, { query: '', matches: [], current: 0 }));
}
