// Manual zoom inside a document (Martin, 2026-10-31: "il manque le zoom manuel pour avoir la feuille de travail
// complète"): two fingers pinch the sheet, page or slide itself (not the whole app), and Ctrl + wheel or a trackpad
// pinch does the same on a PC or Mac. The point under the fingers stays under the fingers.

import { useEffect, useRef } from 'react';

export interface PinchOptions { min: number; max: number }

/** Zooms what `ref` shows. `get` reads the current zoom; `set` applies a new one (already clamped). */
export function usePinchZoom(ref: React.RefObject<HTMLElement | null>, get: () => number, set: (z: number) => void, { min, max }: PinchOptions) {
  const live = useRef({ get, set });
  live.current = { get, set };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const clamp = (z: number) => Math.min(max, Math.max(min, z)); // not rounded: many small trackpad steps must add up
    // Keeps the point (x, y), relative to the box, still while the zoom changes from `from` to `to`.
    const zoomAt = (to: number, x: number, y: number) => {
      const from = live.current.get();
      const next = clamp(to);
      if (Math.abs(next - from) < 1e-4) return;
      const sx = el.scrollLeft, sy = el.scrollTop;
      live.current.set(next);
      requestAnimationFrame(() => {
        const k = next / from;
        el.scrollLeft = (sx + x) * k - x;
        el.scrollTop = (sy + y) * k - y;
      });
    };
    let start: { d: number; z: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    // The moves are followed on the window: the element under the fingers may be redrawn (a selected item, a page
    // switching layout), and touch events of a removed element no longer reach `el`.
    const follow = (on: boolean) => {
      const f = on ? window.addEventListener : window.removeEventListener;
      f.call(window, 'touchmove', onMove as EventListener, { passive: false } as AddEventListenerOptions);
      f.call(window, 'touchend', onEnd as EventListener);
      f.call(window, 'touchcancel', onEnd as EventListener);
    };
    const onStart = (e: TouchEvent) => { if (e.touches.length === 2 && !start) { start = { d: dist(e.touches), z: live.current.get() }; follow(true); } };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) return;
      e.preventDefault(); // the app zooms the document, not the browser the page
      const box = el.getBoundingClientRect();
      const x = (e.touches[0].clientX + e.touches[1].clientX) / 2 - box.left, y = (e.touches[0].clientY + e.touches[1].clientY) / 2 - box.top;
      zoomAt(start.z * dist(e.touches) / start.d, x, y);
    };
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2 && start) { start = null; follow(false); } };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // a trackpad pinch arrives as Ctrl + wheel
      e.preventDefault();
      const box = el.getBoundingClientRect();
      // Chrome and Safari send a trackpad pinch as small Ctrl + wheel steps worth exp(-deltaY / 100); a mouse notch
      // (about 100) is held to one comfortable 25 % step.
      const k = Math.min(1.25, Math.max(0.8, Math.exp(-e.deltaY / 100)));
      zoomAt(live.current.get() * k, e.clientX - box.left, e.clientY - box.top);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('wheel', onWheel);
      if (start) follow(false);
    };
  }, [ref, min, max]);
}
