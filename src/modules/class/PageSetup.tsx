// Excel's Page Setup window in In 1 Class (Martin, 2026-11-18: "l'ordre de page tableau n'est pas respecté comme dans
// Excel. On n'a pas d'options"): the four tabs of Excel, Page, Margins, Header/Footer and Sheet, with the page order
// drawn like Excel's picture, rows and columns to repeat anywhere ($3:$4), the print area, black and white, cell errors,
// the first page number, any "fit to W × H pages" and margins to the millimetre. Changes apply on OK, and are kept in
// the .xlsx so Excel prints the same pages in the same order.
import { useEffect, useRef, useState } from 'react';
import { t, type MessageKey } from '../../shell/i18n';
import { Icon } from '../../ui/kit';
import { HEADER_PRESET_COUNT, MARGINS, PAPERS, boxName, breakCount, fitPages, marginInches, parseArea, parseTitles, setupOf,
  titleColsText, titleRowsText, type Box, type PrintSetup } from './printSetup';
import { hfSample, marginLabel, paperLabel } from './PrintPanel';
import type { SheetData } from '../../formats/sheet';
import './print.css';

export type SetupTab = 'page' | 'margins' | 'hf' | 'sheet';
const TABS: SetupTab[] = ['page', 'margins', 'hf', 'sheet'];

/** Excel's little picture of the page order: four pages and the path the numbers take. */
export function OrderPicture({ order, size = 64 }: { order: 'down' | 'over'; size?: number }) {
  const n = order === 'down' ? ['1', '3', '2', '4'] : ['1', '2', '3', '4'];
  const at = [[4, 4], [36, 4], [4, 34], [36, 34]];
  return (
    <svg viewBox="0 0 64 60" width={size} height={size * 60 / 64} aria-hidden="true" className="ps-order-pic">
      {at.map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="24" height="22" rx="2" fill="#fff" stroke="currentColor" strokeWidth="1.4" />
          <text x={x + 12} y={y + 15} textAnchor="middle" fontSize="11" fontWeight="700" fill="#333">{n[i]}</text>
        </g>
      ))}
      <path d={order === 'down' ? 'M16 26v8M28 46 L36 14' : 'M28 15h8M40 26 L28 34'} stroke="var(--accent, #c9a227)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function PageSetupDialog({ sheet, file, lang, start, selection, onOk, onPreview, onClose }: {
  sheet: SheetData;
  file: string;
  lang: string;
  start?: SetupTab;
  /** The selected cells, for the "Use selection" buttons. */
  selection: Box;
  onOk: (setup: PrintSetup) => void;
  /** OK, then open the Print window. */
  onPreview: (setup: PrintSetup) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal?.(); }, []);
  const [tab, setTab] = useState<SetupTab>(start ?? 'page');
  const [p, setP] = useState<PrintSetup>(() => ({ ...sheet.print }));
  const set = (x: Partial<PrintSetup>) => setP(v => ({ ...v, ...x }));
  const s = setupOf({ ...sheet, print: p });

  // Page: scale in percent, or fit to pages.
  const pages = fitPages(s.fit);
  const fitMode = pages ? 'pages' : 'scale';
  const pct = /^\d+$/.test(s.fit) ? Number(s.fit) : 100;
  // Margins in cm or inches (cm unless the app is in English).
  const [unit, setUnit] = useState<'cm' | 'in'>(lang === 'en' ? 'in' : 'cm');
  const k = unit === 'cm' ? 2.54 : 1;
  const inches = marginInches(s);
  const setMargin = (i: number, v: number) => {
    if (!Number.isFinite(v) || v < 0) return;
    const m = [...inches] as [number, number, number, number];
    m[i] = Math.round((v / k) * 1000) / 1000;
    set({ margins: 'custom', custom: m });
  };
  // Sheet: texts typed by the person, read when they leave the box.
  const [areaText, setAreaText] = useState(s.area ? boxName(s.area) : '');
  const [rowsText, setRowsText] = useState(titleRowsText(s));
  const [colsText, setColsText] = useState(titleColsText(s));
  const areaBad = parseArea(areaText) === undefined, rowsBad = !parseTitles(rowsText, 'rows'), colsBad = !parseTitles(colsText, 'cols');
  const final = (): PrintSetup => {
    const out = { ...p };
    const a = parseArea(areaText);
    if (a) out.area = a; else if (a === null) delete out.area;
    const r = parseTitles(rowsText, 'rows'), c = parseTitles(colsText, 'cols');
    if (r) { out.titleRows = r.n; if (r.start && r.n) out.titleRowStart = r.start; else delete out.titleRowStart; }
    if (c) { out.titleCols = c.n; if (c.start && c.n) out.titleColStart = c.start; else delete out.titleColStart; }
    return out;
  };
  const tpl = Array.from({ length: HEADER_PRESET_COUNT }, (_, i) => t(`class.print.hf.${i + 1}` as MessageKey));
  const hf = (which: 'header' | 'footer') => {
    const value = p[which] ?? (which === 'footer' ? s.footer : '') ?? '';
    const list = ['', ...tpl];
    return (
      <div className="ps-hf">
        <label>{t(`class.print.${which}` as MessageKey)}
          <select value={list.includes(value) ? value : '__own'} data-ps={which} onChange={e => e.target.value !== '__own' && set({ [which]: e.target.value })}>
            {list.map(v => <option key={v} value={v}>{hfSample(v, sheet.name, file, lang)}</option>)}
            {!list.includes(value) && <option value="__own">{t('class.setup.own')}</option>}
          </select>
        </label>
        <label>{t('class.setup.ownText')}
          <input type="text" value={value} data-ps={`${which}Text`} placeholder="{page} / {pages}" onChange={e => set({ [which]: e.target.value })} />
        </label>
        <p className="ps-sample" aria-live="polite">{hfSample(value, sheet.name, file, lang)}</p>
      </div>
    );
  };
  const num = (value: number, on: (v: number) => void, attrs: { min?: number; max?: number; step?: number; ps: string; label: string; blankZero?: boolean }) => (
    <input type="number" inputMode="decimal" aria-label={attrs.label} data-ps={attrs.ps} min={attrs.min} max={attrs.max} step={attrs.step ?? 1}
      value={attrs.blankZero && !value ? '' : value} placeholder={attrs.blankZero ? t('class.print.auto') : undefined}
      onChange={e => on(e.target.value === '' ? 0 : Number(e.target.value))} />
  );

  return (
    <dialog ref={ref} className="oi-dialog page-setup" onClose={onClose} onCancel={onClose} aria-label={t('class.setup.title')}>
      <form method="dialog" onSubmit={e => { e.preventDefault(); onOk(final()); }}>
        <h2>{t('class.setup.title')}</h2>
        <div className="ps-tabs" role="tablist">
          {TABS.map(x => (
            <button key={x} type="button" role="tab" aria-selected={tab === x} className={tab === x ? 'on' : ''} data-ps-tab={x} onClick={() => setTab(x)}>
              {t(`class.setup.tab.${x}` as MessageKey)}
            </button>
          ))}
        </div>
        <div className="ps-body" role="tabpanel">
          {tab === 'page' && <>
            <div className="ps-field">{t('class.print.orientation')}
              <div className="pp-seg">
                {(['portrait', 'landscape'] as const).map(o => (
                  <button key={o} type="button" className={s.orientation === o ? 'on' : ''} aria-pressed={s.orientation === o} data-ps={o} onClick={() => set({ orientation: o })}>
                    <Icon name={o === 'portrait' ? 'orientation' : 'rotate'} /> {t(`class.print.${o}` as MessageKey)}
                  </button>
                ))}
              </div>
            </div>
            <fieldset className="ps-box">
              <legend>{t('class.print.fit')}</legend>
              <label className="ps-line">
                <input type="radio" name="ps-fit" checked={fitMode === 'scale'} data-ps="fitScale" onChange={() => set({ fit: pct === 100 ? 'none' : String(pct) })} />
                <span>{t('class.setup.adjust')}</span>
                {num(pct, v => set({ fit: v === 100 ? 'none' : String(Math.max(10, Math.min(400, Math.round(v || 100)))) }), { min: 10, max: 400, ps: 'scale', label: t('class.setup.adjust') })}
                <span>{t('class.setup.normalSize')}</span>
              </label>
              <label className="ps-line">
                <input type="radio" name="ps-fit" checked={fitMode === 'pages'} data-ps="fitPages" onChange={() => set({ fit: 'page' })} />
                <span>{t('class.setup.fitTo')}</span>
                {num(pages?.[0] ?? 1, v => set({ fit: `${Math.max(0, Math.round(v))}x${pages?.[1] ?? 1}` }), { min: 0, max: 99, ps: 'wide', label: t('class.setup.wide'), blankZero: true })}
                <span>{t('class.setup.wide')}</span>
                {num(pages?.[1] ?? 1, v => set({ fit: `${pages?.[0] ?? 1}x${Math.max(0, Math.round(v))}` }), { min: 0, max: 99, ps: 'tall', label: t('class.setup.tall'), blankZero: true })}
                <span>{t('class.setup.tall')}</span>
              </label>
            </fieldset>
            <label className="ps-field">{t('class.print.paper')}
              <select value={s.paper} data-ps="paper" onChange={e => set({ paper: e.target.value })}>
                {Object.keys(PAPERS).map(x => <option key={x} value={x}>{paperLabel(x)}</option>)}
              </select>
            </label>
            <label className="ps-field">{t('class.setup.firstPage')}
              {num(p.firstPage ?? 0, v => set({ firstPage: v > 1 ? Math.round(v) : undefined }), { min: 0, max: 9999, ps: 'firstPage', label: t('class.setup.firstPage'), blankZero: true })}
            </label>
          </>}

          {tab === 'margins' && <>
            <label className="ps-field">{t('class.setup.preset')}
              <select value={s.margins} data-ps="margins" onChange={e => set({ margins: e.target.value })}>
                {Object.keys(MARGINS).map(x => <option key={x} value={x}>{marginLabel(x)}</option>)}
                <option value="custom">{t('class.print.margin.custom')}</option>
              </select>
            </label>
            <div className="ps-field">{t('class.setup.unit')}
              <div className="pp-seg">
                {(['cm', 'in'] as const).map(u => <button key={u} type="button" className={unit === u ? 'on' : ''} aria-pressed={unit === u} onClick={() => setUnit(u)}>{u}</button>)}
              </div>
            </div>
            <div className="ps-margins">
              {(['top', 'right', 'bottom', 'left'] as const).map((side, i) => (
                <label key={side} className={`ps-field ps-m-${side}`}>{t(`class.setup.m.${side}` as MessageKey)}
                  {num(Math.round(inches[i] * k * 100) / 100, v => setMargin(i, v), { min: 0, max: 20, step: 0.1, ps: `m-${side}`, label: t(`class.setup.m.${side}` as MessageKey) })}
                </label>
              ))}
              <div className="ps-m-page" aria-hidden="true">
                <i style={{ inset: `${Math.min(40, inches[0] * 14)}% ${Math.min(40, inches[1] * 18)}% ${Math.min(40, inches[2] * 14)}% ${Math.min(40, inches[3] * 18)}%` }} />
              </div>
            </div>
            <fieldset className="ps-box">
              <legend>{t('class.setup.centerOn')}</legend>
              <label className="ps-check"><input type="checkbox" checked={!!s.center} data-ps="center" onChange={e => set({ center: e.target.checked })} /> {t('class.setup.horizontally')}</label>
              <label className="ps-check"><input type="checkbox" checked={!!s.vcenter} data-ps="vcenter" onChange={e => set({ vcenter: e.target.checked })} /> {t('class.setup.vertically')}</label>
            </fieldset>
          </>}

          {tab === 'hf' && <>{hf('header')}{hf('footer')}<p className="ps-note">{t('class.setup.codes')}</p></>}

          {tab === 'sheet' && <>
            <label className="ps-field">{t('class.print.scope.area')}
              <span className="ps-pick">
                <input type="text" value={areaText} data-ps="area" aria-invalid={areaBad} placeholder="A1:H40" onChange={e => setAreaText(e.target.value)} />
                <button type="button" onClick={() => setAreaText(boxName(selection))}>{t('class.setup.useSel')}</button>
              </span>
            </label>
            <fieldset className="ps-box">
              <legend>{t('class.print.titles')}</legend>
              <label className="ps-field">{t('class.print.titleRows')}
                <span className="ps-pick">
                  <input type="text" value={rowsText} data-ps="titleRows" aria-invalid={rowsBad} placeholder="$1:$1" onChange={e => setRowsText(e.target.value)} />
                  <button type="button" onClick={() => setRowsText(`$${selection.r1 + 1}:$${selection.r2 + 1}`)}>{t('class.setup.useSel')}</button>
                </span>
              </label>
              <label className="ps-field">{t('class.print.titleCols')}
                <span className="ps-pick">
                  <input type="text" value={colsText} data-ps="titleCols" aria-invalid={colsBad} placeholder="$A:$A" onChange={e => setColsText(e.target.value)} />
                  <button type="button" onClick={() => setColsText(titleColsText({ titleCols: selection.c2 - selection.c1 + 1, titleColStart: selection.c1 }))}>{t('class.setup.useSel')}</button>
                </span>
              </label>
            </fieldset>
            <fieldset className="ps-box">
              <legend>{t('class.setup.print')}</legend>
              <label className="ps-check"><input type="checkbox" checked={!!s.grid} data-ps="grid" onChange={e => set({ grid: e.target.checked })} /> {t('class.print.grid')}</label>
              <label className="ps-check"><input type="checkbox" checked={!!s.bw} data-ps="bw" onChange={e => set({ bw: e.target.checked })} /> {t('class.setup.bw')}</label>
              <label className="ps-check"><input type="checkbox" checked={!!s.headings} data-ps="headings" onChange={e => set({ headings: e.target.checked })} /> {t('class.print.headings')}</label>
              <label className="ps-field">{t('class.setup.errors')}
                <select value={s.errors ?? 'shown'} data-ps="errors" onChange={e => set({ errors: e.target.value === 'shown' ? undefined : e.target.value as PrintSetup['errors'] })}>
                  {(['shown', 'blank', 'dash', 'na'] as const).map(x => <option key={x} value={x}>{t(`class.setup.err.${x}` as MessageKey)}</option>)}
                </select>
              </label>
            </fieldset>
            <fieldset className="ps-box">
              <legend>{t('class.print.order')}</legend>
              <div className="ps-order">
                {(['down', 'over'] as const).map(o => (
                  <label key={o} className={`ps-order-choice${s.order === o ? ' on' : ''}`}>
                    <input type="radio" name="ps-order" checked={s.order === o} data-ps={`order-${o}`} onChange={() => set({ order: o })} />
                    <OrderPicture order={o} />
                    <span>{t(`class.print.order.${o}` as MessageKey)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="ps-breaks">
              <span>{t('class.setup.breaks', { n: breakCount(p) })}</span>
              <button type="button" disabled={!breakCount(p)} data-ps="resetBreaks" onClick={() => set({ breaks: undefined })}>{t('class.breaks.reset')}</button>
            </div>
          </>}
        </div>
        <div className="dialog-buttons ps-buttons">
          <button type="button" className="ps-preview" onClick={() => onPreview(final())}><Icon name="print" /> {t('class.setup.preview')}</button>
          <span className="pp-gap" />
          <button type="button" onClick={onClose}>{t('class.setup.cancel')}</button>
          <button type="submit" className="primary" data-ps="ok" disabled={areaBad || rowsBad || colsBad}>OK</button>
        </div>
      </form>
    </dialog>
  );
}
