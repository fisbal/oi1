// Office Letter's find bar, outline pane, command search and dialogs.

import { useEditorState, type Editor } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getLanguage, t } from '../../shell/i18n';
import { Dialog, Icon, NumberBox } from '../../ui/kit';
import type { PageSettings } from './page';
import { unitFor } from './Ribbon';
import { clearSearch, findNext, findPrevious, replaceAll, replaceOne, searchState, setSearch } from './search';
import { readingStats } from './smart';

export function FindBar({ editor, replace, onClose }: { editor: Editor; replace: boolean; onClose: () => void }) {
  const [query, setQuery] = useState(() => {
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, ' ');
    return selected.length < 80 ? selected : '';
  });
  const [withText, setWithText] = useState('');
  const [caseSensitive, setCase] = useState(false);
  const [showReplace, setShowReplace] = useState(replace);
  const [, force] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setShowReplace(r => r || replace); input.current?.focus(); input.current?.select(); }, [replace]);
  useEffect(() => { setSearch(editor, query, caseSensitive); force(n => n + 1); }, [editor, query, caseSensitive]);
  useEffect(() => {
    const update = () => force(n => n + 1);
    editor.on('transaction', update);
    return () => { editor.off('transaction', update); clearSearch(editor); };
  }, [editor]);
  const s = searchState(editor.state);
  const count = s.matches.length ? t('letter.findCount', { n: s.current + 1, total: s.matches.length }) : query ? t('letter.findNone') : '';
  return (
    <div className="findbar" role="search" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="find-row">
        <input ref={input} value={query} placeholder={t('letter.find')} aria-label={t('letter.find')}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) findPrevious(editor); else findNext(editor); } }} />
        <span className="find-count" aria-live="polite">{count}</span>
        <button type="button" title={t('letter.findPrevious')} aria-label={t('letter.findPrevious')} onClick={() => findPrevious(editor)}>↑</button>
        <button type="button" title={t('letter.findNext')} aria-label={t('letter.findNext')} onClick={() => findNext(editor)}>↓</button>
        <button type="button" title={t('letter.replace')} aria-label={t('letter.replace')} aria-pressed={showReplace} onClick={() => setShowReplace(r => !r)}>⇄</button>
        <button type="button" title={t('letter.close')} aria-label={t('letter.close')} onClick={onClose}>×</button>
      </div>
      {showReplace && (
        <div className="find-row">
          <input value={withText} placeholder={t('letter.replaceWith')} aria-label={t('letter.replaceWith')} onChange={e => setWithText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(editor, withText); } }} />
          <button type="button" onClick={() => replaceOne(editor, withText)}>{t('letter.replace')}</button>
          <button type="button" onClick={() => replaceAll(editor, withText)}>{t('letter.replaceAll')}</button>
        </div>
      )}
      <label className="find-case"><input type="checkbox" checked={caseSensitive} onChange={e => setCase(e.target.checked)} /> {t('letter.matchCase')}</label>
    </div>
  );
}

export function WordCountDialog({ editor, pages, onClose }: { editor: Editor; pages: number; onClose: () => void }) {
  const text = editor.getText({ blockSeparator: '\n' });
  let paragraphs = 0;
  editor.state.doc.descendants(n => { if (n.isTextblock && n.textContent.trim()) paragraphs++; return !n.isTextblock; });
  const stats = readingStats(text);
  const rows: [string, number | string][] = [
    [t('letter.count.pages'), pages],
    [t('letter.count.words'), editor.storage.characterCount.words()],
    [t('letter.count.charsNoSpaces'), text.replace(/\s/g, '').length],
    [t('letter.count.chars'), text.replace(/\n/g, '').length],
    [t('letter.count.paragraphs'), paragraphs],
    [t('letter.count.sentences'), stats.sentences],
    [t('letter.count.perSentence'), stats.perSentence],
    [t('letter.count.reading'), t('letter.minutes', { n: stats.readMinutes })],
    [t('letter.count.speaking'), t('letter.minutes', { n: stats.speakMinutes })],
  ];
  return (
    <Dialog title={t('letter.wordCount')} onClose={onClose}>
      <table className="count-table"><tbody>
        {rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v.toLocaleString(getLanguage())}</td></tr>)}
      </tbody></table>
    </Dialog>
  );
}

export function MarginsDialog({ page, onApply, onClose }: { page: PageSettings; onApply: (p: PageSettings) => void; onClose: () => void }) {
  const unit = unitFor(page);
  const f = unit === 'in' ? 1 : 2.54;
  const [m, setM] = useState({ ...page.margins, header: page.headerDistance, footer: page.footerDistance });
  const box = (key: keyof typeof m, label: string) => (
    <NumberBox label={label} unit={unit} step={unit === 'in' ? 0.1 : 0.25} min={0} max={unit === 'in' ? 10 : 25}
      value={Math.round(m[key] * f * 100) / 100} onChange={v => setM(x => ({ ...x, [key]: v / f }))} />
  );
  return (
    <Dialog title={t('letter.margins.custom')} onClose={onClose}
      onOk={() => onApply({ ...page, margins: { top: m.top, right: m.right, bottom: m.bottom, left: m.left }, headerDistance: m.header, footerDistance: m.footer })}>
      <div className="margins-grid">
        {box('top', t('letter.margin.top'))}
        {box('bottom', t('letter.margin.bottom'))}
        {box('left', t('letter.margin.left'))}
        {box('right', t('letter.margin.right'))}
        {box('header', t('letter.margin.header'))}
        {box('footer', t('letter.margin.footer'))}
      </div>
    </Dialog>
  );
}

/** Word's Navigation pane: the headings of the letter, click one to go there. */
export function OutlinePane({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const headings = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const out: { level: number; text: string; pos: number }[] = [];
      e.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading' || node.attrs.styleId === 'title') {
          const text = node.textContent.trim();
          if (text) out.push({ level: node.type.name === 'heading' ? node.attrs.level as number : 0, text, pos });
        }
        return node.type.name !== 'table';
      });
      return out;
    },
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  }) ?? [];
  const current = useEditorState({ editor, selector: ({ editor: e }) => e.state.selection.from }) ?? 0;
  const here = [...headings].reverse().find(h => h.pos < current)?.pos;
  return (
    <aside className="outline-pane" aria-label={t('letter.outline')}>
      <header><span className="kicker">{t('letter.outline')}</span><button type="button" onClick={onClose} aria-label={t('letter.close')}>×</button></header>
      {headings.length === 0 ? <p className="muted">{t('letter.outlineEmpty')}</p> : (
        <ol>
          {headings.map(h => (
            <li key={h.pos}>
              <button type="button" className={`lvl${h.level}${h.pos === here ? ' on' : ''}`}
                onClick={() => {
                  editor.chain().focus().setTextSelection(h.pos + 1).run();
                  const dom = editor.view.nodeDOM(h.pos) as HTMLElement | null;
                  dom?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
                }}>{h.text}</button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

export interface Command { id: string; label: string; group: string; icon?: string; keys?: string; run: () => void; disabled?: boolean }

/** Search every command by name and run it with Enter, like a command palette. Opens with Alt+Q. */
export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const found = useMemo(() => {
    const q = fold(query.trim());
    const list = commands.filter(c => !c.disabled);
    if (!q) return list.slice(0, 60);
    const words = q.split(/\s+/);
    return list
      .map(c => ({ c, label: fold(c.label), group: fold(c.group) }))
      .filter(x => words.every(w => x.label.includes(w) || x.group.includes(w)))
      .sort((a, b) => Number(!a.label.startsWith(words[0])) - Number(!b.label.startsWith(words[0])))
      .map(x => x.c);
  }, [query, commands]);
  useEffect(() => setIndex(0), [query]);
  const run = (c: Command | undefined) => { if (!c) return; onClose(); window.setTimeout(c.run, 0); };
  return (
    <div className="palette-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-label={t('letter.commandSearch')}>
        <div className="palette-input">
          <Icon name="search" />
          <input ref={input} value={query} placeholder={t('letter.commandSearchHint')} aria-label={t('letter.commandSearch')}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(found.length - 1, i + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(0, i - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); run(found[index]); }
            }} />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-list" role="listbox">
          {found.length === 0 && <li className="muted palette-empty">{t('letter.findNone')}</li>}
          {found.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === index}>
              <button type="button" className={i === index ? 'on' : ''} onMouseEnter={() => setIndex(i)} onClick={() => run(c)}>
                <span className="palette-icon">{c.icon && <Icon name={c.icon} />}</span>
                <span className="palette-label">{c.label}</span>
                <span className="palette-group">{c.group}</span>
                {c.keys && <kbd>{c.keys}</kbd>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
