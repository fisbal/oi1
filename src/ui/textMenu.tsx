// The right-click menu for text, shared by every app that writes with the text editor (In 1 Letter, Notes, Mail, Stage
// text boxes…). Each app adds its own parts (insert, review, send to…) around these. Opens on a right click and with
// Shift+F10 or the menu key; on touch screens the phone's own text handles and copy/paste bar stay (they move the
// selection, which a menu cannot do), so the menu opens there from a long press only outside the text.
import { useCallback, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { t, type MessageKey } from '../shell/i18n';
import { cm, type MenuItem, type MenuSection } from './ContextMenu';

/** Copy, cut, paste: the menu's clicks are real user actions, so the system clipboard works (text and formatting). */
export const textClipboard = {
  async copy(ed: Editor, cut = false) {
    ed.view.focus();
    // execCommand keeps the formatting (HTML) like Ctrl+C; the async clipboard is the fallback.
    let ok = false;
    try { ok = document.execCommand(cut ? 'cut' : 'copy'); } catch { ok = false; }
    if (ok) return;
    const { from, to } = ed.state.selection;
    const text = ed.state.doc.textBetween(from, to, '\n');
    try { await navigator.clipboard.writeText(text); } catch { /* blocked */ }
    if (cut) ed.chain().focus().deleteSelection().run();
  },
  async paste(ed: Editor, plain: boolean, blocked: () => void) {
    ed.view.focus();
    try {
      if (!plain && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          if (it.types.includes('text/html')) { ed.view.pasteHTML(await (await it.getType('text/html')).text()); return; }
        }
        for (const it of items) {
          if (it.types.includes('text/plain')) { ed.view.pasteText(await (await it.getType('text/plain')).text()); return; }
        }
        return;
      }
      ed.view.pasteText(await navigator.clipboard.readText());
    } catch {
      try { ed.view.pasteText(await navigator.clipboard.readText()); } catch { blocked(); }
    }
  },
};

/** Where the menu is, and which editor it is for. */
export function useTextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; ed: Editor } | null>(null);
  const close = useCallback(() => { setMenu(m => { m?.ed.view.focus(); return null; }); }, []);
  return { menu, setMenu, close };
}

/** Puts the caret where the right click was, unless it was inside the selection (then the menu acts on the selection). */
export function caretAt(ed: Editor, x: number, y: number) {
  const at = ed.view.posAtCoords({ left: x, top: y });
  if (!at) return;
  const { from, to, empty } = ed.state.selection;
  if (empty || at.pos < from || at.pos > to) ed.chain().setTextSelection(at.pos).run();
}

/** The menu's position for Shift+F10 / the menu key: at the caret. */
export function caretPoint(ed: Editor) {
  const c = ed.view.coordsAtPos(ed.state.selection.head);
  return { x: c.left, y: c.bottom + 4 };
}

export interface TextMenuOptions {
  notify: (m: string) => void;
  /** Starts a copilot action (by default: correct, rewrite, summary, translate, continue). */
  ai?: (id: string) => void;
  /** The app's own copilot actions, in place of the default ones. */
  aiActions?: { id: string; label: string; icon?: string }[];
  /** The app's link dialog (else a simple question). */
  link?: () => void;
  /** Parts the app adds, placed after the text and paragraph ones. */
  extra?: MenuSection[];
  /** Headings and lists (off for one-line boxes). */
  blocks?: boolean;
}

const has = (ed: Editor, cmd: string) => cmd in (ed.commands as Record<string, unknown>);

export function textMenuSections(ed: Editor, o: TextMenuOptions): MenuSection[] {
  const { from, to, empty } = ed.state.selection;
  const picked = empty ? '' : ed.state.doc.textBetween(from, to, ' ').trim();
  const run = () => ed.chain().focus();
  const blocked = () => o.notify(cm('pasteBlocked'));
  const inTable = ed.isActive('table');
  const href = ed.isActive('link') ? String(ed.getAttributes('link').href ?? '') : '';
  const L = (k: string) => t(k as MessageKey);
  const out: MenuSection[] = [
    { items: [
      { id: 'cut', icon: 'cut', label: cm('cut'), keys: 'Ctrl+X', disabled: empty, run: () => void textClipboard.copy(ed, true) },
      { id: 'copy', icon: 'copy', label: cm('copy'), keys: 'Ctrl+C', disabled: empty, run: () => void textClipboard.copy(ed) },
      { id: 'paste', icon: 'paste', label: cm('paste'), keys: 'Ctrl+V', run: () => void textClipboard.paste(ed, false, blocked) },
      { id: 'paste-text', icon: 'textTool', label: cm('pText'), keys: 'Ctrl+Shift+V', run: () => void textClipboard.paste(ed, true, blocked) },
      { id: 'select-all', icon: 'select', label: L('letter.selectAll'), keys: 'Ctrl+A', run: () => run().selectAll().run() },
    ] },
  ];
  if (href) out.push({ items: [
    { id: 'link-open', icon: 'link', label: cm('linkOpen'), run: () => { window.open(href, '_blank', 'noopener'); } },
    ...(o.link ? [{ id: 'link-edit', icon: 'pen', label: cm('linkEdit'), run: o.link }] : []),
    { id: 'link-remove', icon: 'unlink', label: cm('linkRemove'), run: () => run().extendMarkRange('link').unsetLink().run() },
  ] });
  const fmt: MenuItem[] = [
    { id: 'bold', icon: 'bold', label: L('letter.bold'), keys: 'Ctrl+B', run: () => run().toggleBold().run() },
    { id: 'italic', label: L('letter.italic'), keys: 'Ctrl+I', run: () => run().toggleItalic().run() },
    ...(has(ed, 'toggleUnderline') ? [{ id: 'underline', label: L('letter.underline'), keys: 'Ctrl+U', run: () => run().toggleUnderline().run() }] : []),
    { id: 'strike', label: L('letter.strike'), run: () => run().toggleStrike().run() },
    ...(has(ed, 'toggleHighlight') ? [{ id: 'highlight', icon: 'highlighter', label: L('letter.highlight'), run: () => run().toggleHighlight().run() }] : []),
    { id: 'clear-format', icon: 'clear', label: L('letter.clearFormatting'), run: () => run().unsetAllMarks().run() },
  ];
  const para: MenuItem[] = [
    ...(has(ed, 'setTextAlign') ? (['left', 'center', 'right', 'justify'] as const).map(a => ({
      id: `align-${a}`, icon: a, label: L(a === 'justify' ? 'letter.justify' : `letter.align${a[0].toUpperCase()}${a.slice(1)}`), run: () => run().setTextAlign(a).run(),
    })) : []),
    ...(o.blocks !== false ? [
      { id: 'bullets', icon: 'bullets', label: L('letter.bullets'), run: () => run().toggleBulletList().run() },
      { id: 'numbers', icon: 'numbers', label: L('letter.numbers'), run: () => run().toggleOrderedList().run() },
      ...([1, 2, 3] as const).map(level => ({ id: `h${level}`, label: L(`letter.heading${level}`), run: () => run().toggleHeading({ level }).run() })),
    ] : []),
  ];
  out.push({ items: [
    { id: 'text', icon: 'case', label: cm('textFmt'), sub: fmt },
    ...(para.length ? [{ id: 'para', icon: 'left', label: cm('para'), sub: para }] : []),
    ...(!href && o.link && !empty ? [{ id: 'link', icon: 'link', label: L('letter.link'), keys: 'Ctrl+K', run: o.link }] : []),
  ] });
  if (inTable && has(ed, 'addRowBefore')) out.push({ items: [{ id: 'table', icon: 'table', label: cm('tbl'), sub: [
    { id: 't-row-above', icon: 'rowabove', label: L('letter.rowAbove'), run: () => run().addRowBefore().run() },
    { id: 't-row-below', icon: 'rowbelow', label: L('letter.rowBelow'), run: () => run().addRowAfter().run() },
    { id: 't-col-left', icon: 'colleft', label: L('letter.columnLeft'), run: () => run().addColumnBefore().run() },
    { id: 't-col-right', icon: 'colright', label: L('letter.columnRight'), run: () => run().addColumnAfter().run() },
    { id: 't-merge', icon: 'merge', label: L('letter.mergeCells'), run: () => run().mergeCells().run() },
    { id: 't-split', icon: 'split', label: L('letter.splitCell'), run: () => run().splitCell().run() },
    { id: 't-del-row', icon: 'delrow', label: L('letter.deleteRow'), danger: true, run: () => run().deleteRow().run() },
    { id: 't-del-col', icon: 'delcol', label: L('letter.deleteColumn'), danger: true, run: () => run().deleteColumn().run() },
    { id: 't-del', icon: 'deltable', label: L('letter.deleteTable'), danger: true, run: () => run().deleteTable().run() },
  ] }] });
  out.push(...(o.extra ?? []));
  if (o.ai) {
    const ai = o.ai;
    const list = o.aiActions ?? [
      { id: 'correct', icon: 'spell', label: cm('aiCorrect') }, { id: 'rewrite', icon: 'pen', label: cm('aiRewrite') },
      { id: 'summary', icon: 'outline', label: cm('aiSummary') }, { id: 'translate', icon: 'language', label: cm('aiTranslate') },
      { id: 'continue', icon: 'next', label: cm('aiContinue') },
    ];
    out.push({ items: [{ id: 'ai', icon: 'sparkle', label: cm('ai'), sub: list.map(a => ({ id: `ai-${a.id}`, icon: a.icon, label: a.label, run: () => ai(a.id) })) }] });
  }
  if (picked) {
    const words = picked.split(/\s+/).filter(Boolean).length;
    const short = picked.length > 28 ? `${picked.slice(0, 26)}…` : picked;
    out.push({ items: [
      { id: 'web', icon: 'web', label: cm('web', { v: short }), run: () => { window.open(`https://www.google.com/search?q=${encodeURIComponent(picked.slice(0, 300))}`, '_blank', 'noopener'); } },
      { id: 'sel-info', icon: 'count', label: cm('words', { w: words, c: picked.length }), run: () => o.notify(cm('words', { w: words, c: picked.length })) },
    ] });
  }
  return out;
}
