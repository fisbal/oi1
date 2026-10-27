// The slide show: full screen, one slide after another with their transitions, driven by keys, clicks or swipes.
// Presenter view puts the slide, the next one, the speaker notes and a timer on the same screen.

import { useEffect, useRef, useState } from 'react';
import type { Deck } from '../../formats/slides';
import { t } from '../../shell/i18n';
import { Icon } from '../../ui/kit';
import { SlideView } from './SlideView';
import { playState, stepsOf } from './anim';

const SPEED = { fast: 350, med: 650, slow: 1000 };

function useWindowSize() {
  const [s, setS] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setS({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

/** One slide scaled into a box, with the transition it arrives with. */
function Frame({ deck, index, prev, back, w, h, step, animate = true }: {
  deck: Deck; index: number; prev: number | null; back: boolean; w: number; h: number;
  /** The animation step on this slide; left out, everything shows as built. */
  step?: number; animate?: boolean;
}) {
  const k = Math.min(w / deck.w, h / deck.h);
  const slide = deck.slides[index];
  const tr = prev === null ? 'none' : slide.transition ?? 'none';
  const ms = SPEED[slide.speed ?? 'med'];
  const anim = (name: string) => `${name} ${ms}ms cubic-bezier(.22,1,.36,1) both`;
  const inAnim = tr === 'fade' ? anim('st-fade-in') : tr === 'push' ? anim(back ? 'st-push-in-back' : 'st-push-in') : tr === 'wipe' ? anim(back ? 'st-wipe-in-back' : 'st-wipe-in')
    : tr === 'cover' ? anim(back ? 'st-cover-in-back' : 'st-cover-in') : tr === 'zoom' ? anim('st-zoom-in') : undefined;
  const outAnim = tr === 'push' ? anim(back ? 'st-push-out-back' : 'st-push-out') : tr === 'zoom' ? anim('st-zoom-out') : undefined;
  const built = (i: number) => playState(deck.slides[i], stepsOf(deck.slides[i]).length - 1, false);
  const play = step === undefined ? undefined : playState(slide, step, animate, inAnim ? ms / 1000 : 0);
  const layer = (i: number, a: string | undefined, key: string) => (
    <div key={key} className="st-layer" style={{ animation: a }}>
      <SlideView deck={deck} slide={deck.slides[i]} style={{ transform: `scale(${k})` }} play={i === index ? play : built(i)} />
    </div>
  );
  return (
    <div className="st-show-frame" style={{ width: deck.w * k, height: deck.h * k }}>
      {prev !== null && tr !== 'none' && layer(prev, outAnim, `p${prev}-${index}`)}
      {layer(index, inAnim, `c${index}-${prev ?? 'x'}`)}
    </div>
  );
}

export function Show({ deck, start, presenter: startPresenter, onEnd }: { deck: Deck; start: number; presenter: boolean; onEnd: (index: number) => void }) {
  const order = deck.slides.map((s, i) => (s.hidden && i !== start ? -1 : i)).filter(i => i >= 0);
  const [pos, setPos] = useState(Math.max(0, order.indexOf(start)));
  const [prev, setPrev] = useState<{ index: number; back: boolean } | null>(null);
  const [step, setStep] = useState({ n: 0, animate: true });
  const [blank, setBlank] = useState<null | '#000' | '#fff'>(null);
  const [ended, setEnded] = useState(false);
  const [pointer, setPointer] = useState(false);
  const [presenter, setPresenter] = useState(startPresenter);
  const [now, setNow] = useState(Date.now());
  const [typed, setTyped] = useState('');
  const began = useRef(Date.now());
  const hideTimer = useRef(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const size = useWindowSize();
  const index = order[pos] ?? 0;

  const go = (to: number) => {
    if (to >= order.length) { setEnded(true); return; }
    if (to < 0) return;
    setEnded(false);
    setPrev({ index: order[pos], back: to < pos });
    setPos(to);
    setBlank(null);
    // Going back shows the slide as built; going forward plays its animations from the start.
    setStep(to < pos ? { n: stepsOf(deck.slides[order[to]]).length - 1, animate: false } : { n: 0, animate: true });
  };
  const steps = stepsOf(deck.slides[index]).length;
  const next = () => {
    if (ended) { end(); return; }
    if (step.n < steps - 1) { setStep({ n: step.n + 1, animate: true }); setBlank(null); return; }
    go(pos + 1);
  };
  const back = () => {
    if (ended) { setEnded(false); return; }
    if (step.n > 0) { setStep({ n: step.n - 1, animate: false }); return; }
    go(pos - 1);
  };
  const end = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    onEnd(index);
  };

  useEffect(() => {
    if (!startPresenter) void document.documentElement.requestFullscreen?.().catch(() => {});
    const t0 = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t0);
  }, [startPresenter]);
  // Leaving full screen (Esc in the browser) ends the show, like PowerPoint.
  useEffect(() => {
    const on = () => { if (!document.fullscreenElement && !presenter) onEnd(index); };
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  });

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const k = e.key;
      if (/^\d$/.test(k)) { setTyped(s => s + k); return; }
      if (k === 'Enter' && typed) { const n = Number(typed) - 1; setTyped(''); const p = order.indexOf(n); if (p >= 0) go(p); e.preventDefault(); return; }
      setTyped('');
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(k)) { e.preventDefault(); next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(k)) { e.preventDefault(); back(); }
      else if (k === 'Home') go(0);
      else if (k === 'End') go(order.length - 1);
      else if (k === 'Escape' || k === '-') { e.preventDefault(); end(); }
      else if (k === 'b' || k === 'B' || k === '.') setBlank(b => (b === '#000' ? null : '#000'));
      else if (k === 'w' || k === 'W' || k === ',') setBlank(b => (b === '#fff' ? null : '#fff'));
      else if (k === 'F5') e.preventDefault();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });

  const movePointer = () => {
    setPointer(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setPointer(false), 2500);
  };
  const elapsed = Math.max(0, Math.floor((now - began.current) / 1000));
  const clock = `${String(Math.floor(elapsed / 3600)).padStart(1, '0')}:${String(Math.floor(elapsed / 60) % 60).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const count = t('stage.slideOf', { n: pos + 1, total: order.length });

  if (presenter) {
    const nextIndex = order[pos + 1];
    const slotW = size.w * 0.58, slotH = size.h * 0.62;
    return (
      <div className="st-presenter" role="dialog" aria-label={t('stage.presenter')}>
        <header>
          <span className="timer">{clock}</span>
          <button type="button" onClick={() => { began.current = Date.now(); setNow(Date.now()); }}>{t('stage.resetTimer')}</button>
          <span className="clock">{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="grow" />
          <button type="button" onClick={() => { setPresenter(false); void document.documentElement.requestFullscreen?.().catch(() => {}); }}>{t('stage.audienceView')}</button>
          <button type="button" onClick={end}>{t('stage.endShow')}</button>
        </header>
        <div className="now">
          <span className="label">{t('stage.current')}</span>
          <div className="slot" style={{ display: 'grid', placeItems: 'center' }}>
            {ended ? <div style={{ color: '#aaa' }}>{t('stage.endOfShow')}</div> : <Frame deck={deck} index={index} prev={prev?.index ?? null} back={!!prev?.back} w={slotW} h={slotH} step={step.n} animate={step.animate} />}
          </div>
        </div>
        <div className="side">
          <span className="label">{t('stage.next')}</span>
          <div className="slot" style={{ flex: '0 0 auto', height: size.h * 0.26, display: 'grid', placeItems: 'center' }}>
            {nextIndex !== undefined ? <Frame deck={deck} index={nextIndex} prev={null} back={false} w={size.w * 0.34} h={size.h * 0.26} /> : <span style={{ color: '#888' }}>{t('stage.endOfShow')}</span>}
          </div>
          <span className="label">{t('stage.notes')}</span>
          <div className="notes">{deck.slides[index]?.notes || <span style={{ opacity: 0.4 }}>{t('stage.noNotes')}</span>}</div>
        </div>
        <footer>
          <button type="button" aria-label={t('stage.previous')} onClick={back}><Icon name="prev" /></button>
          <span>{count}</span>
          <button type="button" aria-label={t('stage.next')} onClick={next}><Icon name="next" /></button>
        </footer>
      </div>
    );
  }

  return (
    <div className={`st-show${pointer ? ' pointer' : ''}`} role="dialog" aria-label={t('stage.tab.show')}
      onPointerMove={movePointer}
      onPointerDown={e => { swipe.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={e => {
        const s = swipe.current;
        swipe.current = null;
        if ((e.target as HTMLElement).closest('.st-show-bar')) return;
        if (s && Math.abs(e.clientX - s.x) > 50 && Math.abs(e.clientX - s.x) > Math.abs(e.clientY - s.y)) { if (e.clientX < s.x) next(); else back(); return; }
        if (e.button === 2) back(); else next();
      }}
      onContextMenu={e => e.preventDefault()}>
      {ended
        ? <div style={{ color: '#bbb', font: '500 18px var(--sans)' }}>{t('stage.endOfShow')}</div>
        : <Frame deck={deck} index={index} prev={prev?.index ?? null} back={!!prev?.back} w={size.w} h={size.h} step={step.n} animate={step.animate} />}
      {blank && <div className="st-show-blank" style={{ background: blank }} />}
      <div className="st-show-bar">
        <button type="button" aria-label={t('stage.previous')} title={t('stage.previous')} onClick={back}><Icon name="prev" /></button>
        <span>{count}</span>
        <button type="button" aria-label={t('stage.next')} title={t('stage.next')} onClick={next}><Icon name="next" /></button>
        <button type="button" aria-label={t('stage.presenter')} title={t('stage.presenter')} onClick={() => { setPresenter(true); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); }}><Icon name="desktop" /></button>
        <button type="button" aria-label={t('stage.endShow')} title={t('stage.endShow')} onClick={end}><Icon name="close" /></button>
      </div>
    </div>
  );
}
