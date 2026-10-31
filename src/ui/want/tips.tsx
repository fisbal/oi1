// Small suggestions while you work (Martin, 2026-10-31): when a button would help with what you are doing, one soft
// bubble says so, with "Show me" (the "Je veux…" guide numbers the buttons). Only one bubble at a time, each kind at
// most once per session, closed with ×, "Don't show this kind again" per kind, and a switch to turn them all off.

import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { t, type MessageKey } from '../../shell/i18n';

const ON = 'oi1.tips.on';
const OFF = 'oi1.tips.off';

export function tipsOn(): boolean {
  try { return localStorage.getItem(ON) !== '0'; } catch { return true; }
}
export function setTipsOn(on: boolean) {
  try { localStorage.setItem(ON, on ? '1' : '0'); } catch { /* private window */ }
  window.dispatchEvent(new Event('oi1-tips'));
}
function offKinds(): string[] {
  try { return JSON.parse(localStorage.getItem(OFF) ?? '[]') as string[]; } catch { return []; }
}
function turnOff(id: string) {
  try { localStorage.setItem(OFF, JSON.stringify([...new Set([...offKinds(), id])])); } catch { /* private window */ }
}

export interface TipRule {
  id: string;
  app: string;
  text: MessageKey;
  /** What "Show me" searches, in English words the search knows in every language. */
  query: string;
  /** True when the tip would help now; `frame` is the app's frame on screen. */
  when: (frame: HTMLElement) => boolean;
}

const selectionIn = (frame: HTMLElement, sel: string) => {
  const n = document.getSelection()?.anchorNode;
  const el = n && (n.nodeType === 1 ? (n as Element) : n.parentElement);
  return !!el && frame.contains(el) && !!el.closest(sel);
};

export const TIP_RULES: TipRule[] = [
  {
    id: 'letter.headings', app: 'letter', text: 'tip.letterHeadings', query: 'heading styles',
    when: f => { const pm = f.querySelector('.ProseMirror'); return !!pm && (pm.textContent?.length ?? 0) > 2500 && !pm.querySelector('h1, h2, h3'); },
  },
  { id: 'letter.table', app: 'letter', text: 'tip.letterTable', query: 'table style', when: f => selectionIn(f, '.ProseMirror table') },
  {
    id: 'class.range', app: 'class', text: 'tip.classRange', query: 'sum',
    when: f => { const v = (f.querySelector('.name-box') as HTMLInputElement | null)?.value ?? ''; return /^[A-Z]+\d+:[A-Z]+\d+$/.test(v) && v.split(':')[0] !== v.split(':')[1]; },
  },
  {
    id: 'stage.text', app: 'stage', text: 'tip.stageText', query: 'audience',
    when: f => [...f.querySelectorAll('.st-edit')].reduce((n, e) => n + (e.textContent?.length ?? 0), 0) > 450,
  },
  { id: 'code.problems', app: 'code', text: 'tip.codeProblems', query: 'problems', when: f => !!f.querySelector('.cm-lintRange-error, .cm-lintRange-warning') },
];

const shown = new Set<string>();   // this session
let current: string | null = null; // one bubble in the whole window

export function Tips({ moduleId, anchor, run }: { moduleId: string; anchor: RefObject<HTMLElement | null>; run: (query: string) => void }) {
  const [tip, setTip] = useState<TipRule | null>(null);
  const [, bump] = useState(0);
  useEffect(() => {
    const on = () => bump(n => n + 1);
    window.addEventListener('oi1-tips', on);
    return () => window.removeEventListener('oi1-tips', on);
  }, []);

  useEffect(() => {
    if (!tipsOn()) { if (tip) { current = null; setTip(null); } return; }
    const rules = TIP_RULES.filter(r => r.app === moduleId);
    if (!rules.length) return;
    const since = new Map<string, number>();
    const look = () => {
      const frame = anchor.current?.closest<HTMLElement>('.app-frame');
      if (!frame || frame.hidden || !frame.offsetParent || current || document.querySelector('dialog[open], .want-panel, .want-guide')) return;
      const off = offKinds();
      for (const r of rules) {
        if (shown.has(r.id) || off.includes(r.id)) continue;
        let ok = false;
        try { ok = r.when(frame); } catch { ok = false; }
        if (!ok) { since.delete(r.id); continue; }
        // It must stay true a little while: no bubble for a passing moment.
        const at = since.get(r.id) ?? Date.now();
        since.set(r.id, at);
        if (Date.now() - at < 2500) continue;
        shown.add(r.id);
        current = r.id;
        setTip(r);
        return;
      }
    };
    const timer = window.setInterval(look, 1000);
    return () => window.clearInterval(timer);
  });

  if (!tip) return null;
  const close = () => { current = null; setTip(null); };
  return createPortal(
    <div className="tip-bubble" role="status" style={{ '--tip-color': `var(--app, var(--gold))` } as React.CSSProperties}>
      <span className="tip-spark" aria-hidden="true">✦</span>
      <p>{t(tip.text)}</p>
      <div className="tip-actions">
        <button type="button" className="tip-show" onClick={() => { const q = tip.query; close(); run(q); }}>{t('tip.show')}</button>
        <button type="button" className="tip-never" onClick={() => { turnOff(tip.id); close(); }}>{t('tip.never')}</button>
      </div>
      <button type="button" className="tip-close" aria-label={t('want.close')} onClick={close}>×</button>
    </div>,
    anchor.current?.closest('.app-frame') ?? document.body,
  );
}
