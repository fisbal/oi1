// The function library, like Excel's Formulas tab (Martin, 2026-10-31: "rivaliser Excel en outils et options"):
// 440+ functions by category, and an "Insert function" window that searches them and says what each does and
// what goes in it. The texts come from Formula.js' documentation (loaded only when the window opens).

import { useEffect, useMemo, useState } from 'react';
import { FUNCTION_NAMES } from '../../formats/formula';
import CATS from '../../formats/functionCats.json';
import { t, type MessageKey } from '../../shell/i18n';
import { Dialog } from '../../ui/kit';

export const FN_CATEGORIES = ['financial', 'logical', 'text', 'date', 'lookup', 'math', 'statistical', 'engineering', 'information', 'database'] as const;
export type FnCategory = typeof FN_CATEGORIES[number];

const FROM_DOC: Record<string, FnCategory> = {
  Financial: 'financial', Logical: 'logical', Text: 'text', 'Date and time': 'date', 'Lookup and reference': 'lookup',
  'Math and trigonometry': 'math', Statistical: 'statistical', Engineering: 'engineering', Information: 'information', Database: 'database',
};
// Ours, that Formula.js does not document.
const OWN: Record<string, FnCategory> = {
  DEVISE: 'financial', CURRENCY: 'financial', MONEDA: 'financial', WAEHRUNG: 'financial', XLOOKUP: 'lookup', ROW: 'lookup',
  COLUMN: 'lookup', ROWS: 'lookup', COLUMNS: 'lookup', MODE: 'statistical', RANK: 'statistical', STDEV: 'statistical', VAR: 'statistical',
  'ERROR.TYPE': 'information',
};

export function categoryOf(name: string): FnCategory {
  return OWN[name] ?? FROM_DOC[(CATS as Record<string, string>)[name]] ?? 'math';
}

/** The functions of one category, or all of them. */
export function functionsIn(cat: FnCategory | 'all'): string[] {
  return cat === 'all' ? FUNCTION_NAMES : FUNCTION_NAMES.filter(n => categoryOf(n) === cat);
}

export interface FnInfo { cat: string; summary: string; args: { name: string; optional: boolean; text: string }[] }
let infoCache: Record<string, FnInfo> | null = null;
const OWN_INFO: Record<string, FnInfo> = {
  DEVISE: {
    cat: 'Financial', summary: 'Converts an amount from one currency to another with the rate of the day (300+ currencies, crypto included), or of a past day.',
    args: [
      { name: 'amount', optional: false, text: 'The amount to convert.' },
      { name: 'from', optional: false, text: 'Its currency code, like "EUR", "USD", "XAF" or "BTC".' },
      { name: 'to', optional: false, text: 'The currency to convert to.' },
      { name: 'date', optional: true, text: 'A past day for the rate (a date or "2024-03-06"); today when left out.' },
    ],
  },
};
export async function loadFunctionInfo(): Promise<Record<string, FnInfo>> {
  if (!infoCache) {
    const mod = await import('../../formats/functionInfo.json');
    infoCache = { ...(mod.default as Record<string, FnInfo>), ...OWN_INFO, CURRENCY: OWN_INFO.DEVISE, MONEDA: OWN_INFO.DEVISE, WAEHRUNG: OWN_INFO.DEVISE };
  }
  return infoCache;
}

/** How a function is written, with its arguments: IRR(values, [guess]). */
export const signature = (name: string, info?: FnInfo) =>
  `${name}(${(info?.args ?? []).map(a => (a.optional ? `[${a.name}]` : a.name)).join(', ')})`;

export function InsertFunction({ start, onPick, onClose }: { start?: FnCategory | 'all'; onPick: (name: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<FnCategory | 'all'>(start ?? 'all');
  const [info, setInfo] = useState<Record<string, FnInfo> | null>(infoCache);
  const [picked, setPicked] = useState<string>('');
  useEffect(() => { if (!info) void loadFunctionInfo().then(setInfo); }, [info]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const names = functionsIn(q ? 'all' : cat);
    if (!q) return names;
    // By name first, then by what it does ("loan", "interest", "average"…).
    const byName = names.filter(n => n.toLowerCase().includes(q));
    const about = (n: string) => { const i = info?.[n]; return i ? `${i.summary} ${i.args.map(a => a.text).join(' ')}`.toLowerCase() : ''; };
    const bySummary = names.filter(n => !byName.includes(n) && info?.[n]?.summary.toLowerCase().includes(q));
    const byArgs = names.filter(n => !byName.includes(n) && !bySummary.includes(n) && about(n).includes(q));
    return [...byName, ...bySummary, ...byArgs];
  }, [query, cat, info]);
  const current = picked && list.includes(picked) ? picked : list[0] ?? '';
  const fi = info?.[current];
  return (
    <Dialog title={t('class.fn.insert')} onClose={onClose} onOk={() => { if (!current) return false; onPick(current); }}>
      <div className="fn-dialog">
        <input className="fn-search" autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={t('class.fn.search')} aria-label={t('class.fn.search')} />
        <label className="fn-cat">{t('class.fn.category')}
          <select value={cat} onChange={e => { setCat(e.target.value as FnCategory | 'all'); setQuery(''); }}>
            <option value="all">{t('class.fn.cat.all')} ({FUNCTION_NAMES.length})</option>
            {FN_CATEGORIES.map(c => <option key={c} value={c}>{t(`class.fn.cat.${c}` as MessageKey)} ({functionsIn(c).length})</option>)}
          </select>
        </label>
        <div className="fn-names" role="listbox" aria-label={t('class.fn.list')}>
          {list.map(n => (
            <button key={n} type="button" role="option" aria-selected={n === current} className={n === current ? 'on' : ''}
              onClick={() => setPicked(n)} onDoubleClick={() => { onPick(n); onClose(); }}>{n}</button>
          ))}
          {!list.length && <p className="fn-none">{t('class.fn.none')}</p>}
        </div>
        <div className="fn-about" aria-live="polite">
          {current && <>
            <code>{signature(current, fi)}</code>
            <p>{fi?.summary ?? ''}</p>
            {fi?.args.length ? <dl>{fi.args.map(a => <div key={a.name}><dt>{a.name}{a.optional ? ` (${t('class.fn.optional')})` : ''}</dt><dd>{a.text}</dd></div>)}</dl> : null}
          </>}
        </div>
      </div>
    </Dialog>
  );
}
