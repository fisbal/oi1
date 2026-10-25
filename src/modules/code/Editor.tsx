// The code editor: CodeMirror 6, in the scene colors, with one undo history per file.

import { indentWithTab } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';
import { loadLanguage } from './languages';

const theme = EditorView.theme({
  '&': { height: '100%', color: 'var(--ink)', backgroundColor: 'transparent', fontSize: 'var(--code-size, 14px)' },
  '.cm-scroller': { fontFamily: '"JetBrains Mono Variable", "Fira Code Variable", ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--gold-light)', padding: '10px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--gold-light)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'rgba(212,168,67,.24) !important' },
  '.cm-activeLine': { backgroundColor: 'rgba(var(--fg-rgb), .04)' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--faint)', border: 'none', borderRight: '1px solid var(--line)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(212,168,67,.1)', color: 'var(--gold-light)' },
  '.cm-foldPlaceholder': { backgroundColor: 'rgba(212,168,67,.15)', border: 'none', color: 'var(--gold-light)' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': { backgroundColor: 'rgba(212,168,67,.22)', outline: '1px solid rgba(212,168,67,.5)' },
  '.cm-searchMatch': { backgroundColor: 'rgba(242,215,139,.25)', outline: '1px solid rgba(242,215,139,.5)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(212,168,67,.45)' },
  '.cm-selectionMatch': { backgroundColor: 'rgba(212,168,67,.12)' },
  '.cm-tooltip': { backgroundColor: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 12px 32px rgba(var(--shade-rgb), calc(.5 * var(--shade-k)))' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'rgba(212,168,67,.2)', color: 'var(--ink)' },
  '.cm-completionMatchedText': { color: 'var(--gold-light)', textDecoration: 'none', fontWeight: '700' },
  '.cm-panels': { backgroundColor: 'var(--surface-2)', color: 'var(--ink)', borderColor: 'var(--line)' },
  '.cm-panels input, .cm-panels button': { font: '13px var(--sans)', color: 'var(--ink)' },
  '.cm-textfield': { backgroundColor: 'rgba(var(--shade-rgb), calc(.4 * var(--shade-k)))', border: '1px solid var(--line)', borderRadius: '7px', padding: '3px 8px' },
  '.cm-button': { backgroundImage: 'none', backgroundColor: 'rgba(var(--fg-rgb), .06)', border: '1px solid var(--line)', borderRadius: '7px' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy #ff8a80' },
});

// Token colors come from CSS variables so that both themes can set their own (see code.css).
const colors = HighlightStyle.define([
  { tag: [tags.keyword, tags.moduleKeyword, tags.controlKeyword, tags.operatorKeyword], color: 'var(--syn-keyword)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--syn-string)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--syn-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--syn-function)' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--syn-type)' },
  { tag: [tags.tagName], color: 'var(--syn-tag)' },
  { tag: [tags.attributeName, tags.propertyName], color: 'var(--syn-attr)' },
  { tag: [tags.definition(tags.variableName), tags.definition(tags.propertyName)], color: 'var(--syn-def)' },
  { tag: [tags.heading], color: 'var(--syn-keyword)', fontWeight: '700' },
  { tag: [tags.link, tags.url], color: 'var(--syn-string)', textDecoration: 'underline' },
  { tag: [tags.emphasis], fontStyle: 'italic' },
  { tag: [tags.strong], fontWeight: '700' },
  { tag: [tags.operator, tags.punctuation, tags.bracket], color: 'var(--syn-punct)' },
  { tag: [tags.invalid], color: '#ff8a80' },
]);

export interface EditorApi {
  view: EditorView | null;
}

export function CodeEditor({ path, content, onChange, onCursor, wrap, api }: {
  path: string; content: string; onChange: (path: string, text: string) => void;
  onCursor?: (line: number, col: number, selected: number) => void; wrap: boolean; api: React.MutableRefObject<EditorApi>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const states = useRef(new Map<string, EditorState>());
  const current = useRef(path);
  const language = useRef(new Compartment());
  const wrapping = useRef(new Compartment());
  const handlers = useRef({ onChange, onCursor });
  handlers.current = { onChange, onCursor };

  const makeState = (p: string, text: string) => {
    const lang = language.current;
    const state = EditorState.create({
      doc: text,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        theme,
        syntaxHighlighting(colors),
        lang.of([]),
        wrapping.current.of(wrap ? EditorView.lineWrapping : []),
        EditorState.tabSize.of(2),
        EditorView.updateListener.of(u => {
          if (u.docChanged) handlers.current.onChange(current.current, u.state.doc.toString());
          if (u.docChanged || u.selectionSet) {
            const head = u.state.selection.main.head;
            const line = u.state.doc.lineAt(head);
            const selected = u.state.selection.ranges.reduce((n, r) => n + r.to - r.from, 0);
            handlers.current.onCursor?.(line.number, head - line.from + 1, selected);
          }
        }),
      ],
    });
    // The language arrives a moment later, without blocking the first paint.
    void loadLanguage(p)?.then((support: Extension) => {
      const v = view.current;
      if (v && current.current === p) v.dispatch({ effects: lang.reconfigure(support) });
      else {
        const saved = states.current.get(p);
        if (saved) states.current.set(p, saved.update({ effects: lang.reconfigure(support) }).state);
      }
    });
    return state;
  };

  useEffect(() => {
    const v = new EditorView({ state: makeState(path, content), parent: host.current! });
    view.current = v;
    api.current.view = v;
    return () => { v.destroy(); view.current = null; api.current.view = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switching files keeps each file's own undo history and cursor.
  useEffect(() => {
    const v = view.current;
    if (!v || current.current === path) return;
    states.current.set(current.current, v.state);
    current.current = path;
    const saved = states.current.get(path);
    v.setState(saved && saved.doc.toString() === content ? saved : makeState(path, content));
    v.dispatch({ effects: wrapping.current.reconfigure(wrap ? EditorView.lineWrapping : []) });
    v.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Changes made outside the editor (Format, Pull from GitHub, a renamed file) flow back in.
  useEffect(() => {
    const v = view.current;
    if (!v || current.current !== path) return;
    const now = v.state.doc.toString();
    if (now !== content) v.dispatch({ changes: { from: 0, to: now.length, insert: content } });
  }, [content, path]);

  useEffect(() => {
    view.current?.dispatch({ effects: wrapping.current.reconfigure(wrap ? EditorView.lineWrapping : []) });
  }, [wrap]);

  return <div className="code-editor" ref={host} />;
}
