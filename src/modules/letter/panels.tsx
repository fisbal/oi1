// Office Letter's File menu, find bar and dialogs.

import type { Editor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import type { RecentFile } from '../../shell/contract';
import { getLanguage, t } from '../../shell/i18n';
import type { PageSettings } from './page';
import { unitFor } from './Ribbon';
import { clearSearch, findNext, findPrevious, replaceAll, replaceOne, searchState, setSearch } from './search';
import { Dialog, Icon, NumberBox } from './ui';

export type SaveFormat = 'docx' | 'html' | 'txt' | 'pdf';

export function FileMenu({ onClose, onNew, onOpen, onSave, onSaveAs, onPrint, listRecent, onOpenRecent, fileName }: {
  onClose: () => void; onNew: () => void; onOpen: () => void; onSave: () => void; onSaveAs: (f: SaveFormat) => void;
  onPrint: () => void; listRecent: () => Promise<RecentFile[]>; onOpenRecent: (r: RecentFile) => void; fileName: string;
}) {
  const [recent, setRecent] = useState<RecentFile[] | null>(null);
  const [pane, setPane] = useState<'recent' | 'saveas'>('recent');
  useEffect(() => { void listRecent().then(setRecent); }, [listRecent]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);
  const act = (fn: () => void) => () => { onClose(); fn(); };
  return (
    <div className="backstage" role="dialog" aria-label={t('letter.tab.file')}>
      <nav className="backstage-nav">
        <button type="button" className="back" onClick={onClose} aria-label={t('letter.close')}>←</button>
        <button type="button" onClick={act(onNew)}><Icon name="new" />{t('letter.new')}</button>
        <button type="button" onClick={act(onOpen)}><Icon name="open" />{t('letter.open')}</button>
        <button type="button" onClick={act(onSave)}><Icon name="save" />{t('letter.save')}</button>
        <button type="button" className={pane === 'saveas' ? 'on' : ''} onClick={() => setPane('saveas')}><Icon name="saveas" />{t('letter.saveAs')}</button>
        <button type="button" onClick={act(onPrint)}><Icon name="print" />{t('letter.print')}</button>
        <button type="button" className={pane === 'recent' ? 'on' : ''} onClick={() => setPane('recent')}><Icon name="date" />{t('letter.recent')}</button>
      </nav>
      <section className="backstage-main">
        {pane === 'recent' ? <>
          <h2>{t('letter.recent')}</h2>
          {recent === null ? null : recent.length === 0 ? <p className="muted">{t('letter.noRecent')}</p> : (
            <ul className="recent-list">
              {recent.map(r => (
                <li key={r.id}>
                  <button type="button" onClick={act(() => onOpenRecent(r))}>
                    <Icon name="size" />
                    <span className="name">{r.name}</span>
                    <span className="time">{new Date(r.time).toLocaleString(getLanguage(), { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </> : <>
          <h2>{t('letter.saveAs')}</h2>
          <p className="muted">{fileName}</p>
          <div className="saveas-list">
            <button type="button" onClick={act(() => onSaveAs('docx'))}><Icon name="save" /><b>{t('letter.format.docx')}</b><span>.docx</span></button>
            <button type="button" onClick={act(() => onSaveAs('pdf'))}><Icon name="pdf" /><b>PDF</b><span>{t('letter.format.pdfHint')}</span></button>
            <button type="button" onClick={act(() => onSaveAs('html'))}><Icon name="web" /><b>{t('letter.format.html')}</b><span>.html</span></button>
            <button type="button" onClick={act(() => onSaveAs('txt'))}><Icon name="left" /><b>{t('letter.format.txt')}</b><span>.txt</span></button>
          </div>
        </>}
      </section>
    </div>
  );
}

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
  const rows: [string, number][] = [
    [t('letter.count.pages'), pages],
    [t('letter.count.words'), editor.storage.characterCount.words()],
    [t('letter.count.charsNoSpaces'), text.replace(/\s/g, '').length],
    [t('letter.count.chars'), text.replace(/\n/g, '').length],
    [t('letter.count.paragraphs'), paragraphs],
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
