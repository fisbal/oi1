// References > Insert citation: a source typed in, or found by Claude from a title, DOI, ISBN, link or pasted reference.

import { useState } from 'react';
import { t, type MessageKey } from '../../shell/i18n';
import type { ShellApi as Shell } from '../../shell/contract';
import { Dialog } from '../../ui/kit';
import { SOURCE_KINDS, SOURCE_PROMPT, parseSource, type Source, type SourceKind } from './references';

const FIELDS = ['authors', 'title', 'year', 'date', 'edition', 'container', 'editors', 'volume', 'issue', 'pages', 'publisher', 'place', 'institution', 'url', 'doi', 'accessed'] as const;
type Field = (typeof FIELDS)[number];
/** The fields each type of document uses (the others stay hidden but kept). */
const BY_KIND: Record<SourceKind, Field[]> = {
  book: ['authors', 'title', 'year', 'edition', 'publisher', 'place', 'url', 'doi'],
  article: ['authors', 'title', 'year', 'container', 'volume', 'issue', 'pages', 'url', 'doi'],
  chapter: ['authors', 'title', 'year', 'editors', 'container', 'edition', 'pages', 'publisher', 'place', 'doi'],
  thesis: ['authors', 'title', 'year', 'institution', 'container', 'url'],
  web: ['authors', 'title', 'year', 'date', 'container', 'url', 'accessed'],
  report: ['authors', 'title', 'year', 'edition', 'publisher', 'place', 'url', 'doi'],
  news: ['authors', 'title', 'year', 'date', 'container', 'pages', 'url'],
  law: ['title', 'year', 'publisher', 'url'],
  video: ['authors', 'title', 'year', 'date', 'container', 'url'],
  other: FIELDS.filter(f => f !== 'editors' && f !== 'institution'),
};

export function SourceDialog({ shell, onClose, onDone, aiFirst, initial, highlight }: {
  shell: Shell; onClose: () => void; onDone: (src: Source) => void; aiFirst?: boolean;
  /** A source to complete, or a type of document to start from (Reference models). */
  initial?: Partial<Source>;
  /** Fields to point out (what Check sources found missing). */
  highlight?: (keyof Source)[];
}) {
  const [src, setSrc] = useState<Source>(() => ({ id: `s${Date.now().toString(36)}`, kind: 'book', authors: '', title: '', year: '', ...initial }));
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: Field, v: string) => setSrc(s => ({ ...s, [k]: v }));
  const fill = async () => {
    if (!query.trim()) return;
    if (!shell.ai.ready()) { shell.notify(t('letter.pasteNeedsAi')); return; }
    setBusy(true);
    try {
      const answer = await shell.ai.ask({ system: SOURCE_PROMPT, messages: [{ role: 'user', content: query.trim() }] });
      const found = parseSource(answer, src.id);
      if (found) setSrc(found); else shell.notify(t('letter.source.aiFailed'));
    } catch (err) {
      shell.notify(`${t('letter.source.aiFailed')} ${String(err)}`);
    } finally { setBusy(false); }
  };
  return (
    <Dialog title={t('letter.source.dialog')} onClose={onClose}
      onOk={() => { if (!src.title.trim()) { shell.notify(t('letter.source.needTitle')); return false; } onDone(src); }}>
      <p className="muted">{t('letter.source.aiHint')}</p>
      <div className="source-ai">
        <input autoFocus={aiFirst} value={query} onChange={e => setQuery(e.target.value)} aria-label={t('letter.sourceAi')}
          placeholder="10.1038/nature14539 · ISBN · https://…" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void fill(); } }} />
        <button type="button" className="btn" disabled={busy || !query.trim()} onClick={() => void fill()}>
          {busy ? t('letter.source.aiWorking') : t('letter.source.aiFill')}
        </button>
      </div>
      <div className="fill-list">
        <label>
          <span>{t('letter.source.kind')}</span>
          <select value={src.kind} onChange={e => setSrc(s => ({ ...s, kind: e.target.value as SourceKind }))}>
            {SOURCE_KINDS.map(k => <option key={k} value={k}>{t(`letter.sourceKind.${k}` as MessageKey)}</option>)}
          </select>
        </label>
        {src.kind === 'thesis' && (
          <label>
            <span>{t('letter.source.degree')}</span>
            <select value={src.degree === 'master' ? 'master' : 'phd'} onChange={e => setSrc(s => ({ ...s, degree: e.target.value }))}>
              <option value="phd">{t('letter.source.degree.phd')}</option>
              <option value="master">{t('letter.source.degree.master')}</option>
            </select>
          </label>
        )}
        {FIELDS.filter(k => BY_KIND[src.kind].includes(k)).map(k => (
          <label key={k} className={`${k === 'title' || k === 'authors' || k === 'editors' ? 'wide' : ''}${highlight?.includes(k) ? ' missing' : ''}`}>
            <span>{t(`letter.source.${k}` as MessageKey)}</span>
            <input autoFocus={highlight?.length ? k === highlight[0] : !aiFirst && k === 'authors'} value={src[k] ?? ''} onChange={e => set(k, e.target.value)} />
            {k === 'authors' && <em>{t('letter.source.groupHint')}</em>}
          </label>
        ))}
      </div>
    </Dialog>
  );
}
