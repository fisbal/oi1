// References > Citation style > More styles (CSL): every Citation Style Language style, searched by name. The list
// and each chosen style come from the CSL project's repository once, then stay on the device.

import { useEffect, useMemo, useState } from 'react';
import { t } from '../../shell/i18n';
import { Dialog } from '../../ui/kit';
import { CSL_CREDIT, POPULAR, searchStyles, styleList, styleName, type CslStyle } from './csl';

export function CslDialog({ current, onClose, onPick }: { current: string | null; onClose: () => void; onPick: (s: CslStyle) => Promise<boolean> }) {
  const [list, setList] = useState<CslStyle[] | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { let live = true; void styleList().then(l => { if (live) setList(l); }); return () => { live = false; }; }, []);
  const shown = useMemo(() => {
    if (query.trim()) return searchStyles(list ?? [], query, 60);
    const known = new Set((list ?? []).map(s => s.id));
    return POPULAR.filter(id => !list?.length || known.has(id)).map(id => ({ id, name: styleName(id) }));
  }, [list, query]);
  return (
    <Dialog title={t('letter.csl.title')} onClose={onClose}>
      <p className="muted">{list === null ? t('letter.csl.loading') : list.length ? t('letter.csl.count', { n: list.length.toLocaleString() }) : t('letter.csl.offline')}</p>
      <input autoFocus className="csl-search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('letter.csl.search')} aria-label={t('letter.csl.search')} />
      <div className="csl-list" role="listbox" aria-label={t('letter.csl.title')} data-csl-list>
        {shown.map(s => (
          <button key={s.id} type="button" role="option" aria-selected={current === s.id} className={`menu-item${current === s.id ? ' active' : ''}`} disabled={!!busy} data-csl={s.id}
            onClick={async () => { setBusy(s.id); const ok = await onPick(s); setBusy(null); if (ok) onClose(); }}>
            <span>{s.name}</span>{s.id.startsWith('dependent/') && <em className="muted">{t('letter.csl.journal')}</em>}{busy === s.id && <em>{t('letter.csl.loadingOne')}</em>}
          </button>
        ))}
        {!shown.length && <p className="muted">{t('letter.csl.none')}</p>}
      </div>
      <p className="muted csl-credit">{CSL_CREDIT}</p>
    </Dialog>
  );
}
