// Office Class's floating panels: Find and Replace, the filter menu of a table column, and the
// conditional formatting dialog.

import { useEffect, useMemo, useRef, useState } from 'react';
import { t, type MessageKey } from '../../shell/i18n';
import type { CondRule, Merge } from '../../formats/sheet';
import { cellName } from '../../formats/formula';
import { Dialog, Icon, useOutsideClose } from '../../ui/kit';
import { COND_PRESETS } from './cond';

// ---------- find and replace ----------

export interface FindOptions { text: string; replace: string; matchCase: boolean; whole: boolean }

export function FindPanel({ initialReplace, onFind, onReplace, onReplaceAll, onClose, status }: {
  initialReplace: boolean;
  onFind: (o: FindOptions, back: boolean) => void;
  onReplace: (o: FindOptions) => void;
  onReplaceAll: (o: FindOptions) => void;
  onClose: () => void;
  status: string;
}) {
  const [o, setO] = useState<FindOptions>({ text: '', replace: '', matchCase: false, whole: false });
  const [replacing, setReplacing] = useState(initialReplace);
  useEffect(() => setReplacing(r => r || initialReplace), [initialReplace]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, [initialReplace]);
  return (
    <div className="find-panel" role="search" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
      <div className="find-row">
        <button type="button" className="find-toggle" aria-expanded={replacing} title={t('letter.replace')} onClick={() => setReplacing(r => !r)}>
          <Icon name="caret" size={10} />
        </button>
        <input ref={input} value={o.text} placeholder={t('letter.find')} aria-label={t('letter.find')}
          onChange={e => setO({ ...o, text: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onFind(o, e.shiftKey); } }} />
        <span className="find-status">{status}</span>
        <button type="button" title={t('letter.findPrevious')} aria-label={t('letter.findPrevious')} onClick={() => onFind(o, true)}><Icon name="prev" /></button>
        <button type="button" title={t('letter.findNext')} aria-label={t('letter.findNext')} onClick={() => onFind(o, false)}><Icon name="next" /></button>
        <button type="button" title={t('letter.close')} aria-label={t('letter.close')} onClick={onClose}>×</button>
      </div>
      {replacing && (
        <div className="find-row">
          <span className="find-toggle" />
          <input value={o.replace} placeholder={t('letter.replaceWith')} aria-label={t('letter.replaceWith')}
            onChange={e => setO({ ...o, replace: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onReplace(o); } }} />
          <button type="button" className="find-btn" onClick={() => onReplace(o)}>{t('letter.replace')}</button>
          <button type="button" className="find-btn" onClick={() => onReplaceAll(o)}>{t('letter.replaceAll')}</button>
        </div>
      )}
      <div className="find-row find-opts">
        <label><input type="checkbox" checked={o.matchCase} onChange={e => setO({ ...o, matchCase: e.target.checked })} /> {t('letter.matchCase')}</label>
        <label><input type="checkbox" checked={o.whole} onChange={e => setO({ ...o, whole: e.target.checked })} /> {t('class.find.whole')}</label>
      </div>
    </div>
  );
}

// ---------- the filter menu of one column ----------

export function FilterMenu({ at, values, hidden, onSort, onApply, onClose }: {
  at: { left: number; top: number };
  values: string[];
  hidden: string[];
  onSort: (dir: 1 | -1) => void;
  onApply: (hidden: string[]) => void;
  onClose: () => void;
}) {
  const [off, setOff] = useState(() => new Set(hidden));
  const [q, setQ] = useState('');
  const ref = useOutsideClose(true, onClose);
  const shown = useMemo(() => values.filter(v => v.toLowerCase().includes(q.toLowerCase())), [values, q]);
  const label = (v: string) => (v === '' ? t('class.filter.blank') : v);
  const allOn = shown.every(v => !off.has(v));
  return (
    <div className="drop-panel filter-menu" ref={ref} style={{ left: at.left, top: at.top, translate: 'none' }}
      onMouseDown={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <button type="button" className="menu-item" onClick={() => onSort(1)}><span><Icon name="sort" /> {t('class.sortAZ')}</span></button>
      <button type="button" className="menu-item" onClick={() => onSort(-1)}><span><Icon name="sort" /> {t('class.sortZA')}</span></button>
      <hr />
      <input className="filter-search" placeholder={t('class.filter.search')} value={q} onChange={e => setQ(e.target.value)} autoFocus />
      <div className="filter-list">
        <label className="menu-item"><input type="checkbox" checked={allOn}
          onChange={() => setOff(s => { const n = new Set(s); shown.forEach(v => (allOn ? n.add(v) : n.delete(v))); return n; })} /> {t('letter.selectAll')}</label>
        {shown.map(v => (
          <label key={v} className="menu-item"><input type="checkbox" checked={!off.has(v)}
            onChange={() => setOff(s => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; })} /> {label(v)}</label>
        ))}
      </div>
      <div className="filter-buttons">
        <button type="button" onClick={() => { onApply([]); onClose(); }}>{t('class.filter.clear')}</button>
        <button type="button" className="primary" onClick={() => { onApply([...off]); onClose(); }}>{t('letter.ok')}</button>
      </div>
    </div>
  );
}

// ---------- conditional formatting ----------

export type CondKind = CondRule['kind'];
export const HIGHLIGHT_KINDS: CondKind[] = ['greater', 'less', 'between', 'equal', 'contains', 'duplicate'];
export const TOP_KINDS: CondKind[] = ['top', 'bottom', 'aboveAverage', 'belowAverage'];
const needsA = (k: CondKind) => !['duplicate', 'aboveAverage', 'belowAverage', 'scale', 'bars'].includes(k);

export function CondDialog({ kind, range, onOk, onClose }: {
  kind: CondKind; range: Merge; onOk: (rule: Omit<CondRule, 'id'>) => void; onClose: () => void;
}) {
  const [a, setA] = useState(kind === 'top' || kind === 'bottom' ? '10' : '');
  const [b, setB] = useState('');
  const [look, setLook] = useState<keyof typeof COND_PRESETS>('red');
  const ref = `${cellName(range.c1, range.r1)}:${cellName(range.c2, range.r2)}`;
  return (
    <Dialog title={t(`class.cond.${kind}` as MessageKey)} onClose={onClose}
      onOk={() => { if (needsA(kind) && !a.trim()) return; onOk({ kind, range, a: needsA(kind) ? a.trim() : undefined, b: kind === 'between' ? b.trim() : undefined, ...COND_PRESETS[look] }); }}>
      <p className="cond-range">{t('class.cond.appliesTo', { range: ref })}</p>
      {needsA(kind) && (
        <div className="cond-values">
          <input autoFocus value={a} onChange={e => setA(e.target.value)} inputMode={kind === 'contains' || kind === 'equal' ? undefined : 'decimal'} aria-label={t('class.cond.value')} />
          {kind === 'between' && <><span>{t('class.cond.and')}</span><input value={b} onChange={e => setB(e.target.value)} inputMode="decimal" aria-label={t('class.cond.value')} /></>}
        </div>
      )}
      <label className="cond-look">{t('class.cond.with')}
        <select value={look} onChange={e => setLook(e.target.value as keyof typeof COND_PRESETS)}>
          {(Object.keys(COND_PRESETS) as (keyof typeof COND_PRESETS)[]).map(p => <option key={p} value={p}>{t(`class.cond.look.${p}` as MessageKey)}</option>)}
        </select>
        <span className="cond-sample" style={{ background: COND_PRESETS[look].fill, color: COND_PRESETS[look].color }}>123</span>
      </label>
    </Dialog>
  );
}
