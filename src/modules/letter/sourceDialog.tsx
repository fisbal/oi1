// References > Insert citation: a source typed in, or found by Claude from a title, DOI, ISBN, link or pasted reference.

import { useState } from 'react';
import { t, type MessageKey } from '../../shell/i18n';
import type { ShellApi as Shell } from '../../shell/contract';
import { Dialog } from '../../ui/kit';
import { SOURCE_KINDS, SOURCE_PROMPT, parseSource, type Source, type SourceKind } from './references';

const FIELDS = ['authors', 'title', 'year', 'container', 'volume', 'issue', 'pages', 'publisher', 'place', 'url', 'doi'] as const;
type Field = (typeof FIELDS)[number];

export function SourceDialog({ shell, onClose, onDone, aiFirst }: {
  shell: Shell; onClose: () => void; onDone: (src: Source) => void; aiFirst?: boolean;
}) {
  const [src, setSrc] = useState<Source>(() => ({ id: `s${Date.now().toString(36)}`, kind: 'book', authors: '', title: '', year: '' }));
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
        {FIELDS.map(k => (
          <label key={k} className={k === 'title' || k === 'authors' ? 'wide' : ''}>
            <span>{t(`letter.source.${k}` as MessageKey)}</span>
            <input autoFocus={!aiFirst && k === 'authors'} value={src[k] ?? ''} onChange={e => set(k, e.target.value)} />
          </label>
        ))}
      </div>
    </Dialog>
  );
}
