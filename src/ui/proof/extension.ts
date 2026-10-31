// Proofing inside a text editor (Office Letter, Office Stage, and any Tiptap editor): wavy underlines while
// typing, red for spelling, blue for grammar, green for style, and a bubble with the fix when one is clicked.
// Each paragraph is checked in its own language, and only paragraphs that changed are checked again.

import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { getLanguage } from '../../shell/i18n';
import { baseLang, detectLang, grammar, proofing, words, type Issue, type ProofLang } from './proof';

export interface ProofOptions {
  /** Whether to underline anything (the app's "Spelling" button). */
  enabled: () => boolean;
  /** The document's proofing language, like "fr-CA", or "" to go by the interface language. */
  lang: () => string;
}
/** An issue the user clicked, where it is now in the editor. */
export interface Picked { issue: Issue; lang: ProofLang; from: number; to: number; rect: DOMRect }
interface ProofStorage { listeners: Set<(p: Picked | null) => void>; recheck: () => void }

export const proofKey = new PluginKey<DecorationSet>('proofing');

/** One paragraph's text, with each character's place in the document. */
interface Block { text: string; pos: number[]; code: boolean }
function blocks(doc: PMNode): Block[] {
  const out: Block[] = [];
  doc.descendants((node, at) => {
    if (!node.isTextblock) return true;
    let text = '';
    const pos: number[] = [];
    node.forEach((child, off) => {
      const start = at + 1 + off;
      if (child.isText) { for (let i = 0; i < child.text!.length; i++) pos.push(start + i); text += child.text; }
      else { pos.push(start); text += ' '; }
    });
    pos.push(at + 1 + node.content.size);
    out.push({ text, pos, code: !!node.type.spec.code });
    return false;
  });
  return out;
}

// What each paragraph text gave, kept while the page is open, so typing in one paragraph never rechecks the others.
const spellFound = new Map<string, Issue[]>();
const grammarFound = new Map<string, Issue[]>();
/** Style issues Claude found, by paragraph text (see checkStyle). */
export const styleFound = new Map<string, Issue[]>();

export function langOf(text: string, tag: string): ProofLang {
  const chosen = baseLang(tag);
  return detectLang(text, chosen ?? baseLang(getLanguage()) ?? 'en');
}

export const Proofing = Extension.create<ProofOptions, ProofStorage>({
  name: 'proofing',
  addOptions: () => ({ enabled: () => true, lang: () => '' }),
  addStorage: () => ({ listeners: new Set(), recheck: () => {} }),

  addProseMirrorPlugins() {
    const ext = this;
    let view: EditorView | null = null;
    let timer = 0, grammarTimer = 0;
    let alive = true;

    const keyOf = (b: Block, lang: ProofLang) => `${lang}\n${b.text}`;
    /** Underlines from what is known now; the word being typed is not flagged until the caret leaves it. */
    const build = (state: EditorState): DecorationSet => {
      if (!ext.options.enabled()) return DecorationSet.empty;
      const decos: Decoration[] = [];
      const caret = state.selection.empty ? state.selection.from : -1;
      for (const b of blocks(state.doc)) {
        if (b.code || !b.text.trim()) continue;
        const lang = langOf(b.text, ext.options.lang());
        const k = keyOf(b, lang);
        const list = [...(spellFound.get(k) ?? []), ...(grammarFound.get(k) ?? []), ...(styleFound.get(b.text) ?? [])];
        for (const issue of list) {
          if (!proofing.shows(issue)) continue;
          const from = b.pos[issue.from], to = b.pos[issue.to - 1] + 1;
          if (from === undefined || !(to > from)) continue;
          if (issue.kind === 'spell' && caret === to) continue;
          decos.push(Decoration.inline(from, to, { class: `pf pf-${issue.kind}` }, { issue, lang }));
        }
      }
      return DecorationSet.create(state.doc, decos);
    };
    const redraw = () => { if (view && alive) view.dispatch(view.state.tr.setMeta(proofKey, build(view.state))); };

    const check = async () => {
      if (!view || !ext.options.enabled()) { redraw(); return; }
      const todo = blocks(view.state.doc).filter(b => !b.code && b.text.trim()).map(b => ({ b, lang: langOf(b.text, ext.options.lang()) }))
        .filter(({ b, lang }) => !spellFound.has(keyOf(b, lang)));
      const byLang = new Map<ProofLang, typeof todo>();
      for (const t of todo) byLang.set(t.lang, [...(byLang.get(t.lang) ?? []), t]);
      for (const [lang, list] of byLang) {
        const found = list.map(({ b }) => words(b.text));
        try {
          let bad = await proofing.misspelled(lang, found.flat().map(w => w.word));
          // A paragraph mixing two languages: a word right in the document's own language is not a mistake.
          const home = langOf('', ext.options.lang());
          if (home !== lang && bad.size) { const alsoBad = await proofing.misspelled(home, [...bad]); bad = new Set([...bad].filter(w => alsoBad.has(w))); }
          list.forEach(({ b }, i) => spellFound.set(keyOf(b, lang), found[i].filter(w => bad.has(w.word)).map(w => ({ ...w, kind: 'spell' as const }))));
        } catch { /* the dictionary could not load (offline on first use): the browser's own checker still runs */ }
      }
      if (spellFound.size > 3000) spellFound.clear();
      redraw();
      window.clearTimeout(grammarTimer);
      grammarTimer = window.setTimeout(() => void checkGrammar(), 1200);
    };
    const checkGrammar = async () => {
      if (!view) return;
      const tag = ext.options.lang();
      const todo = blocks(view.state.doc).filter(b => !b.code && b.text.trim().length >= 8).map(b => ({ b, lang: langOf(b.text, tag) }))
        .filter(({ b, lang }) => !grammarFound.has(keyOf(b, lang))).slice(0, 6);
      await Promise.all(todo.map(async ({ b, lang }) => { grammarFound.set(keyOf(b, lang), await grammar(b.text, lang, tag)); }));
      if (todo.length) redraw();
    };
    const schedule = (wait = 350) => { window.clearTimeout(timer); timer = window.setTimeout(() => void check(), wait); };

    return [new Plugin<DecorationSet>({
      key: proofKey,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, set) {
          const fresh = tr.getMeta(proofKey) as DecorationSet | undefined;
          if (fresh) return fresh;
          if (!tr.docChanged) return set;
          // Underlines move with the text; the ones touching what was typed go until the check right after.
          let next = set.map(tr.mapping, tr.doc);
          tr.mapping.maps.forEach((map, i) => map.forEach((_a, _b, from, to) => {
            const rest = tr.mapping.slice(i + 1);
            const a = rest.map(from, -1), b = rest.map(to, 1);
            next = next.remove(next.find(Math.max(0, a - 1), b + 1));
          }));
          return next;
        },
      },
      props: {
        decorations: state => proofKey.getState(state),
        handleDOMEvents: {
          click: (v, e) => pick(v, e, false),
          contextmenu: (v, e) => pick(v, e, true),
          keydown: () => { tell(null); return false; },
        },
      },
      view(v) {
        // Plugin views are made again when another extension adds a plugin later: this one is the live one now.
        view = v;
        alive = true;
        ext.storage.recheck = () => schedule(0);
        const off = proofing.onChange(() => schedule(0));
        schedule(0);
        return {
          update(v2, prev) { view = v2; if (!v2.state.doc.eq(prev.doc) || !v2.state.selection.eq(prev.selection)) schedule(); },
          destroy() { off(); if (view === v || view === null) { alive = false; window.clearTimeout(timer); window.clearTimeout(grammarTimer); view = null; } },
        };
      },
    })];

    function tell(p: Picked | null) { for (const fn of ext.storage.listeners) fn(p); }
    function pick(v: EditorView, e: MouseEvent, menu: boolean): boolean {
      const el = (e.target as HTMLElement | null)?.closest?.('.pf');
      if (!el) { tell(null); return false; }
      const at = v.posAtDOM(el, 0);
      const found = proofKey.getState(v.state)?.find(at, at + 1)[0];
      if (!found) return false;
      const { issue, lang } = found.spec as { issue: Issue; lang: ProofLang };
      tell({ issue, lang, from: found.from, to: found.to, rect: el.getBoundingClientRect() });
      if (menu) { e.preventDefault(); return true; }
      return false;
    }
  },
});

/** Listens for the issue the user clicks in `editor` (null when the bubble should close). */
export function onPick(editor: Editor, fn: (p: Picked | null) => void): () => void {
  const s = (editor.storage as unknown as { proofing?: ProofStorage }).proofing;
  if (!s) return () => {};
  s.listeners.add(fn);
  return () => { s.listeners.delete(fn); };
}

/** Checks the editor again now, like after the language or the Spelling button changed. */
export function recheck(editor: Editor | null | undefined) {
  (editor?.storage as unknown as { proofing?: ProofStorage } | undefined)?.proofing?.recheck();
}

/** Puts `text` in place of the issue at from..to, keeping the text's formatting. */
export function applyFix(editor: Editor, from: number, to: number, text: string) {
  const { state, view } = editor;
  const marks = state.doc.resolve(from).marksAcross(state.doc.resolve(to)) ?? [];
  view.dispatch(state.tr.replaceWith(from, to, text ? state.schema.text(text, marks) : []).scrollIntoView());
  view.focus();
}

/** The paragraphs of the editor as text, for the style check. */
export function paragraphs(editor: Editor): string[] {
  return blocks(editor.state.doc).filter(b => !b.code && b.text.trim().split(/\s+/).length >= 4).map(b => b.text);
}
