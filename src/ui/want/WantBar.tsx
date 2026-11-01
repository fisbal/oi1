// "Je veux…" (Martin, 2026-10-31): a capsule in every app's bar. Type what you want, in your words, in any of the 5
// languages; the app opens the right ribbon tab and numbers the 1 to 5 buttons to use, in order, glowing softly.
// It reads the app's own ribbon (every tab, every button, its Tuto explanation), so it works offline and new buttons
// are found by themselves. When the words are vague, the copilot picks the buttons from the same list.
// Context tips live here too: one soft bubble at a time when a button would help with what you are doing.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getLanguage, onLanguageChange, t } from '../../shell/i18n';
import { aiFor } from '../../shell/ai';
import { modules } from '../../shell/modules';
import { closeRibbonPeek, ribbonMin } from '../ribbonMin';
import { confident, pickSteps, searchControls, type Control, type Hit } from './search';
import { Tips, tipsOn, setTipsOn } from './tips';
import './want.css';

const CONTROLS = 'button, input[aria-label]';
/** A control's name: its label, or the words written on it (gallery buttons). */
const nameOf = (el: HTMLElement) => (el.getAttribute('aria-label') ?? el.getAttribute('title') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
const tabsOf = (ribbon: HTMLElement) =>
  [...ribbon.querySelectorAll<HTMLElement>('.ribbon-tabs [role=tab]')].filter(x => !x.classList.contains('ribbon-tuto'));
const appName = (id: string) => modules.find(m => m.id === id)?.name ?? '';
const tick = (ms = 0) => new Promise<void>(r => window.setTimeout(r, ms));

function readOpenTab(ribbon: HTMLElement, tab: string, tabIndex: number): Control[] {
  const panel = ribbon.querySelector<HTMLElement>('.ribbon-panel');
  if (!panel) return [];
  const out: Control[] = [];
  const seen = new Set<string>();
  for (const el of panel.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (!el.offsetParent || el.closest('.drop-panel, .combo-list')) continue;
    const group = el.closest('.rgroup')?.getAttribute('aria-label') ?? '';
    const name = nameOf(el);
    if (!name || seen.has(`${group}|${name}`)) continue;
    seen.add(`${group}|${name}`);
    out.push({ tab, tabIndex, group, name, key: el.dataset.help, text: el.dataset.helpText, active: el.classList.contains('on') || el.getAttribute('aria-pressed') === 'true' });
  }
  return out;
}

// Each ribbon is read once (per language): every tab is opened out of sight, then the person's tab comes back.
const cache = new WeakMap<HTMLElement, { lang: string; tabs: number; controls: Control[] }>();
let crawling: Promise<Control[]> | null = null;

export async function crawlRibbon(ribbon: HTMLElement): Promise<Control[]> {
  const lang = getLanguage();
  const tabs = tabsOf(ribbon);
  const known = cache.get(ribbon);
  if (known && known.lang === lang && known.tabs === tabs.length) return known.controls;
  if (crawling) return crawling;
  crawling = (async () => {
    const start = tabs.findIndex(x => x.getAttribute('aria-selected') === 'true');
    const wasOpen = ribbon.classList.contains('open');
    ribbon.classList.add('want-crawl');
    const all: Control[] = [];
    try {
      for (let i = 0; i < tabs.length; i++) {
        const name = tabs[i].textContent?.trim() ?? '';
        tabs[i].click();
        await tick();
        let got = readOpenTab(ribbon, name, i);
        for (let k = 0; k < 3 && !got.length; k++) { await tick(80); got = readOpenTab(ribbon, name, i); }
        all.push(...got);
      }
    } finally {
      if (start >= 0) tabs[start].click();
      await tick();
      ribbon.classList.remove('want-crawl');
      if (!wasOpen && ribbonMin()) ribbon.classList.remove('open');
    }
    cache.set(ribbon, { lang, tabs: tabs.length, controls: all });
    return all;
  })();
  try { return await crawling; } finally { crawling = null; }
}

/** Finds a control on screen again, in its tab (opened first). */
function findControl(ribbon: HTMLElement, c: Control): HTMLElement | null {
  const panel = ribbon.querySelector<HTMLElement>('.ribbon-panel');
  if (!panel) return null;
  for (const el of panel.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (nameOf(el) !== c.name || el.closest('.drop-panel, .combo-list') || !el.offsetParent) continue;
    if ((el.closest('.rgroup')?.getAttribute('aria-label') ?? '') === c.group) return el;
  }
  return null;
}

// ---------- the numbered guide over the real buttons ----------

let stopGuide: (() => void) | null = null;

export async function showSteps(ribbon: HTMLElement, steps: Control[]) {
  stopGuide?.();
  if (!steps.length) return;
  const tab = tabsOf(ribbon)[steps[0].tabIndex];
  if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click();
  if (ribbonMin()) ribbon.classList.add('open');
  await tick();
  const els = steps.map(s => findControl(ribbon, s));
  els.find(Boolean)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

  const layer = document.createElement('div');
  layer.className = 'want-layer';
  layer.setAttribute('aria-hidden', 'true');
  const badges = els.map((el, i) => {
    if (!el) return null;
    el.classList.add('want-glow');
    const b = document.createElement('span');
    b.className = 'want-step';
    b.textContent = String(i + 1);
    layer.append(b);
    return b;
  });
  document.body.append(layer);

  // A small capsule says the steps in words, in order.
  const guide = document.createElement('div');
  guide.className = 'want-guide';
  guide.setAttribute('role', 'status');
  const list = document.createElement('ol');
  steps.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<b>${i + 1}</b>`;
    li.append(document.createTextNode(s.name));
    if (!els[i]) li.classList.add('want-missing');
    list.append(li);
  });
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'want-guide-close';
  close.setAttribute('aria-label', t('want.close'));
  close.textContent = '×';
  guide.append(list, close);
  document.body.append(guide);

  let raf = 0;
  const place = () => {
    const rb = ribbon.getBoundingClientRect();
    guide.style.top = `${Math.round(rb.bottom + 8)}px`;
    els.forEach((el, i) => {
      const b = badges[i];
      if (!el || !b) return;
      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && el.isConnected && !!el.offsetParent;
      b.style.display = visible ? '' : 'none';
      b.style.left = `${Math.round(r.left + r.width / 2 + 8)}px`;
      b.style.top = `${Math.round(r.top - 6)}px`;
    });
    raf = requestAnimationFrame(place);
  };
  place();

  const done = new Set<number>();
  const onClick = (e: MouseEvent) => {
    const target = e.target as Node;
    if (guide.contains(target) && target !== close) return;
    const i = els.findIndex(el => el && el.contains(target));
    if (i >= 0) {
      done.add(i);
      els[i]!.classList.remove('want-glow');
      badges[i]?.classList.add('done');
      list.children[i]?.classList.add('done');
      if (done.size >= els.filter(Boolean).length) window.setTimeout(stop, 600);
      return;
    }
    // A click in the ribbon (another tab, a list) keeps the guide; anywhere else ends it.
    if (ribbon.contains(target) || (target as HTMLElement).closest?.('.drop-panel, .combo-list, dialog')) return;
    stop();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') stop(); };
  const timer = window.setTimeout(() => stop(), 45000);
  function stop() {
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey);
    els.forEach(el => el?.classList.remove('want-glow'));
    layer.remove();
    guide.remove();
    if (stopGuide === stop) stopGuide = null;
  }
  close.addEventListener('click', () => stop());
  // Wait for the click that opened the guide to end before listening.
  window.setTimeout(() => {
    if (stopGuide !== stop) return;
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
  }, 0);
  stopGuide = stop;
}

/** Asks the copilot which of the ribbon's buttons do what the person wants, in order. */
async function askAi(moduleId: string, controls: Control[], query: string): Promise<Control[]> {
  const list = controls.map((c, i) => `${i + 1}. ${c.tab} > ${c.group} > ${c.name}`).join('\n');
  const answer = await aiFor(moduleId).ask({
    system: 'You help people find buttons in an office app. Given the list of the app\'s ribbon buttons and what the person wants, answer with the numbers of the 1 to 5 buttons to press, in order. Use only numbers from the list.',
    messages: [{ role: 'user', content: `Buttons:\n${list}\n\nThe person wants: ${query}` }],
    schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'number' } } }, required: ['items'] },
    effort: 'low',
  });
  let nums: unknown[] = [];
  try {
    const json = answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
    nums = (JSON.parse(json) as { items?: unknown[] }).items ?? [];
  } catch { nums = answer.match(/\d+/g) ?? []; }
  return nums.map(n => controls[Number(n) - 1]).filter((c): c is Control => !!c).slice(0, 5);
}

// ---------- the capsule and its search box ----------

export function WantBar({ moduleId }: { moduleId: string }) {
  const [open, setOpen] = useState(false);
  const [, setLang] = useState(getLanguage());
  useEffect(() => onLanguageChange(() => setLang(getLanguage())), []);
  const btn = useRef<HTMLButtonElement>(null);
  const ribbon = useCallback(() => btn.current?.closest('.app-frame')?.querySelector<HTMLElement>('.module-host .ribbon') ?? null, []);

  // Alt+J ("Je veux") opens it in the app on screen.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.key.toLowerCase() !== 'j') return;
      if (!btn.current?.offsetParent) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  return (
    <>
      <button ref={btn} type="button" className={`want-pill${open ? ' on' : ''}`} aria-label={t('want.button')} aria-expanded={open}
        data-help-text={t('want.help')} title={`${t('want.button')} (Alt+J)`} onClick={() => setOpen(o => !o)}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.6" /><path d="m10.5 10.5 3.5 3.5" /></svg>
        <span className="want-pill-label">{t('want.button')}</span>
      </button>
      {open && btn.current && <WantPanel anchor={btn.current} moduleId={moduleId} ribbon={ribbon} onClose={() => setOpen(false)} />}
      <Tips moduleId={moduleId} anchor={btn} run={q => { const r = ribbon(); if (r) void runQuery(r, moduleId, q); }} />
    </>
  );
}

/** Searches and shows the steps at once (for a tip's "Show me"). */
async function runQuery(ribbon: HTMLElement, moduleId: string, query: string) {
  const controls = await crawlRibbon(ribbon);
  const hits = searchControls(controls, query, getLanguage(), appName(moduleId));
  if (hits.length) await showSteps(ribbon, pickSteps(hits));
}

function WantPanel({ anchor, moduleId, ribbon, onClose }: { anchor: HTMLElement; moduleId: string; ribbon: () => HTMLElement | null; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [controls, setControls] = useState<Control[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [tips, setTips] = useState(tipsOn());
  const [pos, setPos] = useState({ top: 0, left: 0, width: 360 });
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const lang = getLanguage();

  useEffect(() => {
    const r = ribbon();
    if (r) void crawlRibbon(r).then(setControls);
    input.current?.focus();
  }, [ribbon]);

  useEffect(() => {
    const place = () => {
      const a = anchor.getBoundingClientRect();
      const width = Math.min(460, window.innerWidth - 24);
      const left = Math.max(12, Math.min(a.left, window.innerWidth - width - 12));
      setPos({ top: Math.round(a.bottom + 6), left: Math.round(left), width });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const tg = e.target as Node;
      if (!box.current?.contains(tg) && !anchor.contains(tg)) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key); };
  }, [anchor, onClose]);

  const hits: Hit[] = useMemo(() => (controls && q.trim() ? searchControls(controls, q, lang, appName(moduleId)) : []), [controls, q, lang, moduleId]);
  const steps = useMemo(() => pickSteps(hits), [hits]);
  const sure = confident(hits);

  const go = (list: Control[]) => {
    const r = ribbon();
    if (!r || !list.length) return;
    onClose();
    closeRibbonPeek();
    void showSteps(r, list);
  };
  const ask = async () => {
    if (!controls || !q.trim()) return;
    setBusy(true); setAiError('');
    try {
      const list = await askAi(moduleId, controls, q);
      if (list.length) go(list); else setAiError(t('want.none'));
    } catch (e) {
      setAiError((e as Error).message || t('want.none'));
    } finally { setBusy(false); }
  };

  return createPortal(
    <div ref={box} className="want-panel" role="dialog" aria-label={t('want.button')} style={{ top: pos.top, left: pos.left, width: pos.width }}>
      <form className="want-form" onSubmit={e => { e.preventDefault(); if (steps.length && sure) go(steps); else if (q.trim()) void ask(); }}>
        <input ref={input} className="want-input" value={q} onChange={e => { setQ(e.target.value); setAiError(''); }} placeholder={t('want.placeholder')}
          aria-label={t('want.placeholder')} enterKeyHint="search" />
      </form>
      {!controls && <p className="want-note">{t('want.reading')}</p>}
      {controls && q.trim() !== '' && (
        <div className="want-results" role="listbox" aria-label={t('want.results')}>
          {steps.length > 0 && (
            <button type="button" role="option" aria-selected={sure} className="want-row want-go" onClick={() => go(steps)}>
              <span className="want-num">▶</span>
              <span className="want-main">{steps.length === 1 ? t('want.step1') : t('want.steps', { n: steps.length })}<small>{steps.map((s, i) => `${i + 1}. ${s.name}`).join('  ·  ')}</small></span>
            </button>
          )}
          {hits.slice(0, 7).map((h, i) => (
            <button key={`${h.c.tabIndex}|${h.c.group}|${h.c.name}|${i}`} type="button" role="option" aria-selected={false} className="want-row" onClick={() => go([h.c])}>
              <span className="want-num">{i + 1}</span>
              <span className="want-main">{h.c.name}<small>{[h.c.tab, h.c.group].filter(Boolean).join(' › ')}</small></span>
            </button>
          ))}
          {!hits.length && <p className="want-note">{t('want.none')}</p>}
          <button type="button" className="want-row want-ai" disabled={busy} onClick={() => void ask()}>
            <span className="want-num">✦</span>
            <span className="want-main">{busy ? t('want.asking') : t('want.ask')}</span>
          </button>
          <button type="button" className="want-row want-assistant" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('oi1-assistant', { detail: q.trim() })); }}>
            <span className="want-num">A</span>
            <span className="want-main">{t('want.assistant')}</span>
          </button>
          {aiError && <p className="want-note want-error">{aiError}</p>}
        </div>
      )}
      {controls && !q.trim() && <p className="want-note">{t('want.examples')}</p>}
      <label className="want-tips-switch">
        <input type="checkbox" checked={tips} onChange={e => { setTips(e.target.checked); setTipsOn(e.target.checked); }} />
        <span className="want-track" aria-hidden="true" />
        {t('want.tips')}
      </label>
    </div>,
    document.body,
  );
}
