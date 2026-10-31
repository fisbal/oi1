// The Tuto (Martin, 2026-10-31): a "Tuto" tab in every app's ribbon. It opens a panel on the right (at the bottom on a
// phone) that lists the app's ribbon tabs as categories and, for the tab picked, every button by group. Picking one
// explains what it does and how to use it, "Show me" makes the real button glow, "Try it" presses it. While the Tuto
// is open, a click on a real ribbon button explains it instead of running it, so people can explore without fear.
// It reads the ribbon as it is on screen, so every app gets it with one line, and new buttons appear by themselves.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getLanguage, onLanguageChange, t } from '../../shell/i18n';
import { browserTranslator } from '../../shell/translate';
import { setRibbonMin } from '../ribbonMin';
import { helpOf } from './help';

interface Item { name: string; key?: string; text?: string; el: HTMLElement }
interface GroupInfo { label: string; items: Item[] }

const CONTROLS = 'button[aria-label], input[aria-label]';

/** Reads the open ribbon tab's controls, by group, once each. */
function readPanel(ribbon: HTMLElement): GroupInfo[] {
  const panel = ribbon.querySelector<HTMLElement>('.ribbon-panel');
  if (!panel) return [];
  const groups: GroupInfo[] = [];
  const seen = new Set<string>();
  for (const el of panel.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (!el.offsetParent || el.closest('.drop-panel, .combo-list')) continue;
    const label = el.closest('.rgroup')?.getAttribute('aria-label') ?? '';
    const name = el.getAttribute('aria-label') ?? '';
    if (!name || seen.has(`${label}|${name}`)) continue;
    seen.add(`${label}|${name}`);
    let g = groups.find(x => x.label === label);
    if (!g) groups.push(g = { label, items: [] });
    g.items.push({ name, key: el.dataset.help, text: el.dataset.helpText, el });
  }
  return groups;
}

const tabsOf = (ribbon: HTMLElement) => [...ribbon.querySelectorAll<HTMLElement>('.ribbon-tabs [role=tab]')].filter(x => !x.classList.contains('ribbon-tuto'));

// Spanish, Portuguese and German explanations: the browser translates the English once, on this device.
const translated = new Map<string, string>();
async function inLanguage(en: string, lang: string): Promise<string> {
  if (lang === 'en' || lang === 'fr') return en;
  const k = `${lang}|${en}`;
  if (translated.has(k)) return translated.get(k)!;
  const tr = await browserTranslator(lang as 'es').catch(() => null);
  const out = tr ? (await tr([en]))[0] : en;
  translated.set(k, out);
  return out;
}

/** The "Tuto" tab button: put it in a ribbon's tab row. */
export function TutoTab() {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={btn} type="button" aria-pressed={open} aria-label={t('tuto.tab')} className={`ribbon-tuto${open ? ' on' : ''}`}
        onClick={() => { setOpen(o => !o); setRibbonMin(false); }}>
        <span aria-hidden="true">?</span> {t('tuto.tab')}
      </button>
      {open && btn.current && <TutoPanel ribbon={btn.current.closest('.ribbon') as HTMLElement} onClose={() => setOpen(false)} />}
    </>
  );
}

function TutoPanel({ ribbon, onClose }: { ribbon: HTMLElement; onClose: () => void }) {
  const [, setLang] = useState(getLanguage());
  useEffect(() => onLanguageChange(() => setLang(getLanguage())), []);
  const lang = getLanguage();
  const [groups, setGroups] = useState<GroupInfo[]>(() => readPanel(ribbon));
  const [tabs, setTabs] = useState(() => tabsOf(ribbon).map(x => ({ name: x.textContent?.trim() ?? '', on: x.getAttribute('aria-selected') === 'true' })));
  const [picked, setPicked] = useState<string | null>(null);
  const [explain, setExplain] = useState(true);
  const [text, setText] = useState('');
  const [top, setTop] = useState(0);
  const passing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Follow the ribbon: another tab, buttons that appear or go.
  const refresh = useCallback(() => {
    setGroups(readPanel(ribbon));
    setTabs(tabsOf(ribbon).map(x => ({ name: x.textContent?.trim() ?? '', on: x.getAttribute('aria-selected') === 'true' })));
    setTop(Math.round(ribbon.getBoundingClientRect().bottom));
  }, [ribbon]);
  useLayoutEffect(() => {
    refresh();
    let raf = 0;
    const mo = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(refresh); });
    mo.observe(ribbon, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-label'] });
    window.addEventListener('resize', refresh);
    return () => { mo.disconnect(); cancelAnimationFrame(raf); window.removeEventListener('resize', refresh); };
  }, [ribbon, refresh]);

  const all = groups.flatMap(g => g.items);
  const item = all.find(x => `${x.name}` === picked) ?? null;

  // The explanation of the picked button, in the person's language.
  useEffect(() => {
    if (!item) { setText(''); return; }
    const own = item.text ?? helpOf(item.key, item.name, lang === 'fr' ? 'fr' : 'en');
    if (!own) { setText(''); return; }
    setText(own);
    let live = true;
    void inLanguage(own, lang).then(x => { if (live) setText(x); });
    return () => { live = false; };
  }, [item, lang]);

  // Explain mode: a click on a real ribbon button picks it here instead of running it.
  useEffect(() => {
    if (!explain) return;
    const onClick = (e: MouseEvent) => {
      if (passing.current) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>(CONTROLS);
      if (!el || !ribbon.querySelector('.ribbon-panel')?.contains(el) || el.closest('.drop-panel, .combo-list')) return;
      e.preventDefault();
      e.stopPropagation();
      setPicked(el.getAttribute('aria-label'));
      flash(el);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [explain, ribbon]);

  useEffect(() => { panelRef.current?.querySelector('.tuto-item.on')?.scrollIntoView({ block: 'nearest' }); }, [picked]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const tryIt = (el: HTMLElement) => {
    passing.current = true;
    try { el.focus(); el.click(); } finally { passing.current = false; }
  };
  const total = all.length;

  return createPortal(
    <aside ref={panelRef} className="tuto-panel" style={{ top: top + 8 }} role="complementary" aria-label={t('tuto.tab')}>
      <header>
        <b>{t('tuto.title')}</b>
        <button type="button" className="tuto-close" aria-label={t('letter.cancel')} onClick={onClose}>×</button>
      </header>
      <p className="tuto-intro">{t('tuto.intro')}</p>
      <div className="tuto-cats" role="tablist" aria-label={t('tuto.cats')}>
        {tabs.map((x, i) => (
          <button key={x.name + i} type="button" role="tab" aria-selected={x.on} className={x.on ? 'on' : ''}
            onClick={() => { tabsOf(ribbon)[i]?.click(); setPicked(null); }}>{x.name}</button>
        ))}
      </div>
      <label className="tuto-explain"><input type="checkbox" checked={explain} onChange={e => setExplain(e.target.checked)} /> {t('tuto.explain')}</label>
      <div className="tuto-body">
        <div className="tuto-list" role="listbox" aria-label={t('tuto.count', { n: total })}>
          {groups.map(g => (
            <div key={g.label} className="tuto-group">
              {g.label && <div className="tuto-group-label">{g.label}</div>}
              {g.items.map(x => {
                const has = !!(x.text || helpOf(x.key, x.name, 'en'));
                return (
                  <button key={x.name} type="button" role="option" aria-selected={picked === x.name}
                    className={`tuto-item${picked === x.name ? ' on' : ''}${has ? '' : ' tuto-generic'}`}
                    onClick={() => { setPicked(x.name); flash(x.el); }}>{x.name}</button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="tuto-help" aria-live="polite">
          {item ? <>
            <h3>{item.name}</h3>
            <p>{text || t('tuto.noHelp')}</p>
            <div className="tuto-actions">
              <button type="button" onClick={() => flash(item.el, true)}>{t('tuto.show')}</button>
              <button type="button" className="primary" disabled={(item.el as HTMLButtonElement).disabled} onClick={() => tryIt(item.el)}>{t('tuto.try')}</button>
            </div>
          </> : <p className="tuto-hint">{t('tuto.pick')}</p>}
        </div>
      </div>
    </aside>,
    document.body,
  );
}

/** Makes a real button glow for a moment, scrolled into view. */
function flash(el: HTMLElement, scroll = false) {
  if (scroll) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  el.classList.remove('tuto-flash');
  void el.offsetWidth;
  el.classList.add('tuto-flash');
  window.setTimeout(() => el.classList.remove('tuto-flash'), 1600);
}
