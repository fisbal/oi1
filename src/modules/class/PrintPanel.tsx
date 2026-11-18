// The Print window of In 1 Class: what to print on the left, the real pages on the right ("Page 2 of 5"), then
// Print or Save as PDF. Every choice except "Print what" is the sheet's page setup, saved with the workbook (and in
// the .xlsx, so Excel prints the same way).
import { safeHtml } from '../../shell/safeHtml';

import { useEffect, useMemo, useRef, useState } from 'react';
import { t, type MessageKey } from '../../shell/i18n';
import { colName } from '../../formats/formula';
import { Icon } from '../../ui/kit';
import { offscreen, pagesToPdf, settle } from '../../ui/convert/render';
import { printHtml } from './print';
import {
  FITS, HEADER_PRESET_COUNT, MARGINS, PAPERS, PRINT_SCOPES, boxName, fillHf, pageBox, pagesHtml, planPages, setupOf,
  type PageCut, type PrintBookInput, type PrintScope, type PrintSetup, type PrintWhat,
} from './printSetup';
import { OrderPicture } from './PageSetup';
import './print.css';

export const paperLabel = (id: string) => {
  const p = PAPERS[id];
  if (!p) return id;
  return p.label.replace('Envelope', t('class.print.paper.envelope')).replace('Photo', t('class.print.paper.photo')).replace('Index card', t('class.print.paper.card'));
};
export const marginLabel = (m: string) => {
  if (m === 'custom') return t('class.print.margin.custom');
  const v = /^([\d.]+)(cm|in)$/.exec(m);
  return v ? t('class.print.margin.all', { v: `${v[1]} ${v[2]}` }) : t(`class.print.margin.${m}` as MessageKey);
};
export const fitLabel = (f: string) =>
  f === 'none' || f === 'page' || f === 'width' || f === 'height' ? t(`class.print.fit.${f}` as MessageKey)
    : /^\d+x\d+$/.test(f) ? t('class.print.fit.pages', { a: f.split('x')[0] === '0' ? t('class.print.auto') : f.split('x')[0], b: f.split('x')[1] === '0' ? t('class.print.auto') : f.split('x')[1] }) : `${f} %`;
export const hfTemplates = () => Array.from({ length: HEADER_PRESET_COUNT }, (_, i) => t(`class.print.hf.${i + 1}` as MessageKey));
/** A template shown with sample values, like Excel's header list. */
export const hfSample = (tpl: string, sheet: string, file: string, lang: string) =>
  tpl ? fillHf(tpl, { page: 1, pages: 3, sheet, file, date: new Date().toLocaleDateString(lang), time: new Date().toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) }) : t('class.print.hf.none');

export function PrintPanel({ input, what: whatIn, onSetup, onSave, onClose, onMore }: {
  input: PrintBookInput;
  what: PrintWhat;
  onSetup: (setup: PrintSetup) => void;
  /** Opens the Page Setup window (Excel's "Page Setup" link under the print settings). */
  onMore?: () => void;
  onSave: (name: string, blob: Blob) => Promise<void> | void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal?.(); }, []);
  const sheet = input.sheets[input.active];
  const setup = setupOf(sheet);
  const [scope, setScope] = useState<PrintScope>(whatIn.scope);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const what = { ...whatIn, scope };
  const pages = useMemo(() => planPages(input, what, setup), [input, scope, JSON.stringify(setup), whatIn.sel, whatIn.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = pages.length;
  const shown = Math.min(page, Math.max(0, n - 1));
  const box = pageBox(setup);
  const preview = useMemo(() => (n ? pagesHtml(input, pages, setup, scope, shown) : ''), [pages, shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<PrintSetup>) => { onSetup({ ...sheet.print, ...p }); setPage(0); };

  // The preview page fits its box, whatever the paper.
  const holder = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const fit = () => setScale(Math.min((el.clientWidth - 24) / box.w, (el.clientHeight - 24) / box.h, 1));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [box.w, box.h]);

  const all = () => pagesHtml(input, pages, setup, scope);
  const print = () => { printHtml(all()); };
  const pdf = async () => {
    setBusy(true);
    const html = all();
    const host = offscreen(box.w);
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // faults-ok: the sheet's own print style (made by Class) and its body through safeHtml
      host.innerHTML = `<style>${doc.querySelector('style')?.textContent ?? ''}</style>${safeHtml(doc.body.innerHTML)}`;
      await settle(host);
      const nodes = Array.from(host.querySelectorAll<HTMLElement>('.page'));
      const blob = await pagesToPdf({ nodes, width: box.w, height: box.h, done: () => host.remove() }, input.file);
      await onSave(`${input.file.replace(/\.[^.]+$/, '') || 'Sheet'}.pdf`, blob);
    } finally {
      host.remove();
      setBusy(false);
    }
  };

  const hint = (s: PrintScope) =>
    s === 'selection' || s === 'columns' || s === 'rows' ? (s === 'columns' ? `${colName(whatIn.sel.c1)}:${colName(whatIn.sel.c2)}` : s === 'rows' ? `${whatIn.sel.r1 + 1}:${whatIn.sel.r2 + 1}` : boxName(whatIn.sel))
      : s === 'cell' || s === 'page' ? boxName({ c1: whatIn.at.c, r1: whatIn.at.r, c2: whatIn.at.c, r2: whatIn.at.r })
        : s === 'area' ? (setup.area ? boxName(setup.area) : '—') : s === 'book' ? String(input.sheets.length) : '';
  const tpl = hfTemplates();
  const hfOptions = (value: string | undefined) => {
    const list = ['', ...tpl];
    if (value && !list.includes(value)) list.push(value);
    return list.map(v => <option key={v} value={v}>{hfSample(v, sheet.name, input.file, input.lang)}</option>);
  };

  return (
    <dialog ref={ref} className="oi-dialog print-panel" onClose={onClose} onCancel={onClose} aria-label={t('class.print.title')}>
      <div className="pp-wrap">
        <div className="pp-side">
          <h2>{t('class.print.title')}</h2>
          <fieldset className="pp-scopes">
            <legend>{t('class.print.what')}</legend>
            {PRINT_SCOPES.map(s => (
              <label key={s} className={`pp-scope${scope === s ? ' on' : ''}`} data-scope={s}>
                <input type="radio" name="pp-scope" checked={scope === s} onChange={() => { setScope(s); setPage(0); }} />
                <span>{t(`class.print.scope.${s}` as MessageKey)}</span>
                {hint(s) && <small>{hint(s)}</small>}
              </label>
            ))}
          </fieldset>
          <div className="pp-grid">
            <label>{t('class.print.paper')}
              <select value={setup.paper} onChange={e => set({ paper: e.target.value })} data-pp="paper">
                {Object.keys(PAPERS).map(k => <option key={k} value={k}>{paperLabel(k)}</option>)}
              </select>
            </label>
            <div className="pp-field">{t('class.print.orientation')}
              <div className="pp-seg">
                {(['portrait', 'landscape'] as const).map(o => (
                  <button key={o} type="button" className={setup.orientation === o ? 'on' : ''} aria-pressed={setup.orientation === o} data-pp={o} onClick={() => set({ orientation: o })}>
                    <Icon name={o === 'portrait' ? 'orientation' : 'rotate'} /> {t(`class.print.${o}` as MessageKey)}
                  </button>
                ))}
              </div>
            </div>
            <label>{t('class.print.margins')}
              <select value={setup.margins} onChange={e => set({ margins: e.target.value })} data-pp="margins">
                {Object.keys(MARGINS).map(k => <option key={k} value={k}>{marginLabel(k)}</option>)}
                {setup.margins === 'custom' && <option value="custom">{marginLabel('custom')}</option>}
              </select>
            </label>
            <label>{t('class.print.fit')}
              <select value={setup.fit} onChange={e => set({ fit: e.target.value })} data-pp="fit">
                {(FITS.includes(setup.fit) ? FITS : [...FITS, setup.fit]).map(f => <option key={f} value={f}>{fitLabel(f)}</option>)}
              </select>
            </label>
            <label>{t('class.print.titleRows')}
              <select value={setup.titleRows} onChange={e => set({ titleRows: Number(e.target.value) })} data-pp="titleRows">
                {Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i ? t('class.print.firstRows', { n: i }) : t('class.print.none')}</option>)}
              </select>
            </label>
            <label>{t('class.print.titleCols')}
              <select value={setup.titleCols} onChange={e => set({ titleCols: Number(e.target.value) })} data-pp="titleCols">
                {Array.from({ length: 6 }, (_, i) => <option key={i} value={i}>{i ? t('class.print.firstCols', { n: i, col: colName(i - 1) }) : t('class.print.none')}</option>)}
              </select>
            </label>
            <label>{t('class.print.header')}
              <select value={setup.header ?? ''} onChange={e => set({ header: e.target.value })} data-pp="header">{hfOptions(setup.header)}</select>
            </label>
            <label>{t('class.print.footer')}
              <select value={setup.footer ?? ''} onChange={e => set({ footer: e.target.value })} data-pp="footer">{hfOptions(setup.footer)}</select>
            </label>
            <label>{t('class.print.order')}
              <select value={setup.order} onChange={e => set({ order: e.target.value as 'down' | 'over' })} data-pp="order">
                <option value="down">{t('class.print.order.down')}</option>
                <option value="over">{t('class.print.order.over')}</option>
              </select>
            </label>
          </div>
          <div className="pp-checks">
            <label><input type="checkbox" checked={!!setup.grid} onChange={e => set({ grid: e.target.checked })} data-pp="grid" /> {t('class.print.grid')}</label>
            <label><input type="checkbox" checked={!!setup.headings} onChange={e => set({ headings: e.target.checked })} data-pp="headings" /> {t('class.print.headings')}</label>
            <label><input type="checkbox" checked={!!setup.center} onChange={e => set({ center: e.target.checked })} data-pp="center" /> {t('class.print.center')}</label>
          </div>
          <PageMap pages={pages} shown={shown} order={setup.order} onPick={setPage} />
          {onMore && <button type="button" className="pp-more" data-pp="more" onClick={onMore}><Icon name="pagesetup" /> {t('class.setup.open')}</button>}
        </div>
        <div className="pp-main">
          <div className="pp-preview" ref={holder} aria-label={t('class.print.preview')}>
            {n ? (
              <div className="pp-paper" style={{ width: box.w * scale, height: box.h * scale }}>
                <iframe title={t('class.print.preview')} srcDoc={preview} tabIndex={-1}
                  style={{ width: box.w, height: box.h, transform: `scale(${scale})` }} />
              </div>
            ) : <p className="pp-empty">{t('class.print.empty')}</p>}
          </div>
          <div className="pp-bar">
            <button type="button" className="pp-nav" aria-label={t('class.print.prev')} title={t('class.print.prev')} disabled={shown <= 0} onClick={() => setPage(shown - 1)}><Icon name="prev" /></button>
            <span className="pp-count" aria-live="polite">{t('class.print.pageOf', { n: n ? shown + 1 : 0, total: n })}</span>
            <button type="button" className="pp-nav" aria-label={t('class.print.next')} title={t('class.print.next')} disabled={shown >= n - 1} onClick={() => setPage(shown + 1)}><Icon name="next" /></button>
            <span className="pp-gap" />
            <button type="button" onClick={onClose}>{t('letter.close')}</button>
            <button type="button" className="pp-pdf" disabled={!n || busy} onClick={() => void pdf()}>{busy ? t('class.print.making') : t('class.print.pdf')}</button>
            <button type="button" className="primary pp-go" disabled={!n} onClick={print}><Icon name="print" /> {t('class.print.go')}</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

/** Where each page sits in the sheet, numbered in the page order (Excel only shows this in Page Break Preview). */
function PageMap({ pages, shown, order, onPick }: { pages: PageCut[]; shown: number; order: 'down' | 'over'; onPick: (i: number) => void }) {
  const first = pages[0]?.sheet;
  const list = pages.map((p, i) => ({ p, i })).filter(({ p }) => p.at && p.sheet === first);
  if (list.length < 2) return null;
  const w = Math.max(...list.map(({ p }) => p.at!.x)) + 1, h = Math.max(...list.map(({ p }) => p.at!.y)) + 1;
  return (
    <div className="pp-map" data-pp="map">
      <div className="pp-map-title"><OrderPicture order={order} size={28} /> {t('class.print.map', { order: t(`class.print.order.${order}` as MessageKey) })}</div>
      <div className="pp-map-grid" style={{ gridTemplateColumns: `repeat(${w}, minmax(34px, 1fr))`, gridTemplateRows: `repeat(${h}, 30px)` }}>
        {list.map(({ p, i }) => (
          <button key={i} type="button" className={i === shown ? 'on' : ''} style={{ gridColumn: p.at!.x + 1, gridRow: p.at!.y + 1 }}
            aria-label={t('class.print.pageOf', { n: i + 1, total: pages.length })} aria-current={i === shown} onClick={() => onPick(i)}>{i + 1}</button>
        ))}
      </div>
    </div>
  );
}
