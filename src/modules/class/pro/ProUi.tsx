// The "Métiers" tab's two windows: the gallery of ready professional sheets, and the world currency converter.

import { useEffect, useMemo, useState } from 'react';
import { t } from '../../../shell/i18n';
import { convert, currencyCodes, currencyFlag, currencyName, loadRates, onRatesChange, ratesNow, type Rates } from '../../../shell/rates';
import { Dialog, Icon } from '../../../ui/kit';
import { tx, type Lang, type Tx } from './build';
import { ALL_TOOLS, PRO_CATEGORIES, type ProCategory, type ProTool } from './tools';

export type ProCat = ProCategory['id'] | 'all';

/** The few tools each category shows as big ribbon buttons, with a short label that fits under the icon. */
export const FEATURED: Record<ProCat, { id: string; short: Tx }[]> = {
  finance: [
    { id: 'loan', short: ['Loan', 'Prêt', 'Préstamo', 'Empréstimo', 'Kredit'] },
    { id: 'budget', short: ['Budget', 'Budget', 'Presupuesto', 'Orçamento', 'Budget'] },
    { id: 'npv', short: ['Invest', 'Investir', 'Inversión', 'Investir', 'Investition'] },
    { id: 'breakeven', short: ['Break-even', 'Rentabilité', 'Punto muerto', 'Equilíbrio', 'Break-even'] },
    { id: 'cashflow', short: ['Cash flow', 'Trésorerie', 'Tesorería', 'Tesouraria', 'Liquidität'] },
  ],
  compta: [
    { id: 'journal', short: ['Journal', 'Journal', 'Diario', 'Diário', 'Journal'] },
    { id: 'invoice', short: ['Invoice', 'Facture', 'Factura', 'Fatura', 'Rechnung'] },
    { id: 'vat', short: ['VAT', 'TVA', 'IVA', 'IVA', 'MwSt.'] },
    { id: 'balance', short: ['Balance sheet', 'Bilan', 'Balance', 'Balanço', 'Bilanz'] },
    { id: 'income', short: ['Income', 'Résultat', 'Resultados', 'Resultados', 'GuV'] },
  ],
  economie: [
    { id: 'inflation', short: ['Inflation', 'Inflation', 'Inflación', 'Inflação', 'Inflation'] },
    { id: 'gdp', short: ['GDP', 'PIB', 'PIB', 'PIB', 'BIP'] },
    { id: 'elasticity', short: ['Elasticity', 'Élasticité', 'Elasticidad', 'Elasticidade', 'Elastizität'] },
    { id: 'equilibrium', short: ['Equilibrium', 'Équilibre', 'Equilibrio', 'Equilíbrio', 'Gleichgewicht'] },
    { id: 'regression', short: ['Regression', 'Régression', 'Regresión', 'Regressão', 'Regression'] },
  ],
  all: [
    { id: 'loan', short: ['Loan', 'Prêt', 'Préstamo', 'Empréstimo', 'Kredit'] },
    { id: 'budget', short: ['Budget', 'Budget', 'Presupuesto', 'Orçamento', 'Budget'] },
    { id: 'invoice', short: ['Invoice', 'Facture', 'Factura', 'Fatura', 'Rechnung'] },
    { id: 'vat', short: ['VAT', 'TVA', 'IVA', 'IVA', 'MwSt.'] },
    { id: 'npv', short: ['Invest', 'Investir', 'Inversión', 'Investir', 'Investition'] },
  ],
};

export const toolsOf = (cat: ProCat): ProTool[] => (cat === 'all' ? ALL_TOOLS : PRO_CATEGORIES.find(c => c.id === cat)?.tools ?? []);
export const toolById = (id: string) => ALL_TOOLS.find(x => x.id === id);

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Every ready sheet, by category, with a search over names and descriptions in all 5 languages. */
export function ProGallery({ lang, start, onPick, onClose }: { lang: Lang; start: ProCat; onPick: (tool: ProTool) => void; onClose: () => void }) {
  const [cat, setCat] = useState<ProCat>(start);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState('');
  const list = useMemo(() => {
    const q = norm(query.trim());
    const tools = toolsOf(q ? 'all' : cat);
    return q ? tools.filter(x => norm([...x.name, ...x.desc].join(' ')).includes(q)) : tools;
  }, [cat, query]);
  const current = list.find(x => x.id === picked) ?? list[0];
  return (
    <Dialog title={t('class.pro.galleryTitle')} onClose={onClose} onOk={() => { if (!current) return false; onPick(current); }}>
      <div className="pro-gallery">
        <input className="fn-search" autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={t('class.pro.search')} aria-label={t('class.pro.search')} />
        <div className="pro-cats" role="tablist">
          {[...PRO_CATEGORIES.map(c => ({ id: c.id as ProCat, label: tx(c.name, lang), n: c.tools.length })), { id: 'all' as ProCat, label: t('class.pro.cat.all'), n: ALL_TOOLS.length }].map(c => (
            <button key={c.id} type="button" role="tab" aria-selected={cat === c.id && !query} className={cat === c.id && !query ? 'on' : ''}
              onClick={() => { setCat(c.id); setQuery(''); }}>{c.label} <small>{c.n}</small></button>
          ))}
        </div>
        <div className="pro-cards" role="listbox" aria-label={t('class.pro.gallery')}>
          {list.map(x => (
            <button key={x.id} type="button" role="option" aria-selected={x === current} className={`pro-card${x === current ? ' on' : ''}`}
              onClick={() => setPicked(x.id)} onDoubleClick={() => { onPick(x); onClose(); }}>
              <Icon name={x.icon} size={20} />
              <span><b>{tx(x.name, lang)}</b><small>{tx(x.desc, lang)}</small></span>
            </button>
          ))}
          {!list.length && <p className="fn-none">{t('class.pro.none')}</p>}
        </div>
        <p className="pro-hint">{t('class.pro.hint')}</p>
      </div>
    </Dialog>
  );
}

function useRates(): { rates: Rates | null; failed: boolean } {
  const [rates, setRates] = useState<Rates | null>(() => ratesNow());
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void loadRates().then(r => { if (r) setRates(r); else setFailed(true); });
    return onRatesChange(() => setRates(ratesNow()));
  }, []);
  return { rates, failed };
}

function CurrencyPick({ label, value, codes, lang, onChange }: { label: string; value: string; codes: string[]; lang: Lang; onChange: (c: string) => void }) {
  const [filter, setFilter] = useState('');
  const names = useMemo(() => new Map(codes.map(c => [c, currencyName(c, lang)])), [codes, lang]);
  const shown = useMemo(() => {
    const q = norm(filter.trim());
    const list = q ? codes.filter(c => norm(`${c} ${names.get(c)}`).includes(q)) : codes;
    return list.includes(value) ? list : [value, ...list];
  }, [codes, filter, names, value]);
  return (
    <fieldset className="cur-pick">
      <legend>{label}</legend>
      <input value={filter} onChange={e => { setFilter(e.target.value); const q = e.target.value.trim().toUpperCase(); if (codes.includes(q)) onChange(q); }}
        placeholder={t('class.pro.filter')} aria-label={`${label}: ${t('class.pro.filter')}`} />
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={label} size={1}>
        {shown.map(c => <option key={c} value={c}>{currencyFlag(c)} {c} · {names.get(c) ?? c}</option>)}
      </select>
    </fieldset>
  );
}

const DEFAULT_FROM: Record<Lang, string> = { en: 'USD', fr: 'EUR', es: 'EUR', pt: 'EUR', de: 'EUR' };

/** Converts between 300+ currencies with the rates of the day, and writes real =DEVISE() formulas into the sheet. */
export function Converter({ lang, start, hasSelection, onFormula, onConvertSelection, onClose }: {
  lang: Lang; start?: number; hasSelection: boolean;
  onFormula: (formula: string) => void; onConvertSelection: (from: string, to: string) => void; onClose: () => void;
}) {
  const { rates, failed } = useRates();
  const [amount, setAmount] = useState(String(start ?? 100));
  const [from, setFrom] = useState(DEFAULT_FROM[lang]);
  const [to, setTo] = useState(DEFAULT_FROM[lang] === 'USD' ? 'EUR' : 'USD');
  const codes = useMemo(() => currencyCodes(rates), [rates]);
  const n = Number(amount.replace(/\s/g, '').replace(',', '.'));
  const result = rates && Number.isFinite(n) ? convert(n, from, to, rates) : null;
  const rate = rates ? convert(1, from, to, rates) : null;
  const fmt = (v: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: Math.abs(v) < 1 ? 6 : 2 }).format(v);
  const formulaAmount = Number.isFinite(n) ? String(n) : '1';
  return (
    <Dialog title={t('class.pro.converter')} onClose={onClose}>
      <div className="converter">
        <label className="cur-amount">{t('class.pro.amount')}
          <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        </label>
        {codes.length ? <>
          <div className="cur-row">
            <CurrencyPick label={t('class.pro.from')} value={from} codes={codes} lang={lang} onChange={setFrom} />
            <button type="button" className="cur-swap" title={t('class.pro.swap')} aria-label={t('class.pro.swap')} onClick={() => { setFrom(to); setTo(from); }}>⇄</button>
            <CurrencyPick label={t('class.pro.to')} value={to} codes={codes} lang={lang} onChange={setTo} />
          </div>
          <output className="cur-result" aria-live="polite">
            {result === null ? '—' : <>{fmt(n)} {from} = <b>{fmt(result)} {to}</b></>}
            {rate !== null && <small>1 {from} = {fmt(rate)} {to}</small>}
          </output>
          <p className="cur-source">{t('class.pro.rateOf', { date: rates?.date ?? '', n: codes.length })}</p>
          <div className="cur-actions">
            <button type="button" className="primary" onClick={() => { onFormula(`=DEVISE(${formulaAmount},"${from}","${to}")`); onClose(); }}>{t('class.pro.putFormula')}</button>
            <button type="button" disabled={!hasSelection} onClick={() => { onConvertSelection(from, to); onClose(); }}>{t('class.pro.convertSel')}</button>
            <button type="button" onClick={() => void loadRates('latest', true)}>{t('class.pro.refresh')}</button>
          </div>
        </> : <p className="cur-source">{failed ? t('class.pro.offline') : t('class.pro.loading')}</p>}
      </div>
    </Dialog>
  );
}
