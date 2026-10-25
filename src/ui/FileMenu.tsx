// The File menu (backstage) shared by every OI1 app.

import { useEffect, useState } from 'react';
import type { RecentFile } from '../shell/contract';
import { getLanguage, t } from '../shell/i18n';
import { Icon } from './kit';

/** One way to save, like "Word document (.docx)". */
export interface SaveChoice<Id extends string> { id: Id; icon: string; label: string; hint: string }

/** The File menu every OI1 app shows: New, Open, Save, Save as, Print and the recent files. */
export function FileMenu<Id extends string>({ onClose, onNew, onOpen, onSave, saveChoices, onSaveAs, onPrint, listRecent, onOpenRecent, fileName }: {
  onClose: () => void; onNew: () => void; onOpen: () => void; onSave: () => void; saveChoices: SaveChoice<Id>[]; onSaveAs: (f: Id) => void;
  onPrint?: () => void; listRecent: () => Promise<RecentFile[]>; onOpenRecent: (r: RecentFile) => void; fileName: string;
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
        {onPrint && <button type="button" onClick={act(onPrint)}><Icon name="print" />{t('letter.print')}</button>}
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
            {saveChoices.map(c => (
              <button key={c.id} type="button" onClick={act(() => onSaveAs(c.id))}><Icon name={c.icon} /><b>{c.label}</b><span>{c.hint}</span></button>
            ))}
          </div>
        </>}
      </section>
    </div>
  );
}

