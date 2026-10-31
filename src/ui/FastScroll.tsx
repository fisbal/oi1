// A side scroll bar that is always there (Martin, 2026-10-31: "une barre latérale"). Phones hide scroll bars, so long
// sheets and documents were hard to travel; this one stays visible, shows where you are, and its handle can be dragged
// with a finger or the mouse to jump anywhere. A tap on the track jumps there too.

import { useEffect, useRef, useState } from 'react';
import { t } from '../shell/i18n';

export function FastScroll({ target, label }: { target: React.RefObject<HTMLElement | null>; label?: string }) {
  const [box, setBox] = useState({ top: 0, size: 1, show: false });
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const measure = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const show = scrollHeight > clientHeight + 4;
      const size = show ? Math.max(0.06, clientHeight / scrollHeight) : 1;
      const top = show ? (scrollTop / (scrollHeight - clientHeight)) * (1 - size) : 0;
      setBox(b => (b.show === show && Math.abs(b.top - top) < 0.002 && Math.abs(b.size - size) < 0.002 ? b : { top, size, show }));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: false });
    return () => { el.removeEventListener('scroll', measure); ro.disconnect(); mo.disconnect(); };
  }, [target]);

  const goTo = (clientY: number, grab: number) => {
    const el = target.current, tr = track.current;
    if (!el || !tr) return;
    const r = tr.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientY - r.top - grab) / (r.height * (1 - box.size))));
    el.scrollTop = frac * (el.scrollHeight - el.clientHeight);
  };
  const onDown = (e: React.PointerEvent) => {
    const tr = track.current;
    if (!tr) return;
    e.preventDefault();
    const r = tr.getBoundingClientRect();
    const thumbTop = r.top + box.top * r.height, thumbH = box.size * r.height;
    // Grabbing the handle keeps the finger where it took it; a tap elsewhere centres the handle there.
    const grab = e.clientY >= thumbTop && e.clientY <= thumbTop + thumbH ? e.clientY - thumbTop : thumbH / 2;
    goTo(e.clientY, grab);
    tr.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => goTo(ev.clientY, grab);
    const up = () => { tr.removeEventListener('pointermove', move); tr.removeEventListener('pointerup', up); tr.removeEventListener('pointercancel', up); };
    tr.addEventListener('pointermove', move);
    tr.addEventListener('pointerup', up);
    tr.addEventListener('pointercancel', up);
  };
  if (!box.show) return null;
  return (
    <div ref={track} className="fast-scroll" role="scrollbar" aria-orientation="vertical" aria-label={label ?? t('ui.fastScroll')}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((box.top / Math.max(0.0001, 1 - box.size)) * 100)} onPointerDown={onDown}>
      <div className="fast-scroll-thumb" style={{ top: `${box.top * 100}%`, height: `${box.size * 100}%` }} />
    </div>
  );
}
