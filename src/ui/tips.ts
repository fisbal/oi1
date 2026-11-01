// Capsule bubbles instead of the grey system tooltips (Martin, 2026-11-01: "Bulle de dialogue devrait aussi suivre le
// thème ovale capsules"). Any element with a title shows its text in an oval bubble in the theme colours, in every app,
// without touching each button: while the pointer is on it, its title is moved aside (so the browser draws no grey box)
// and put back when the pointer leaves. Phones have no hover, so nothing changes there.

import './tips.css';

const DELAY = 450;
let bubble: HTMLDivElement | null = null;
let current: HTMLElement | null = null;
let timer = 0;

function place(el: HTMLElement) {
  if (!bubble) return;
  const r = el.getBoundingClientRect();
  const b = bubble.getBoundingClientRect();
  const m = 8;
  let x = r.left + r.width / 2 - b.width / 2;
  x = Math.max(m, Math.min(x, window.innerWidth - b.width - m));
  let y = r.bottom + 8;
  if (y + b.height > window.innerHeight - m) y = Math.max(m, r.top - b.height - 8);
  bubble.style.left = `${Math.round(x)}px`;
  bubble.style.top = `${Math.round(y)}px`;
}

function release() {
  window.clearTimeout(timer);
  if (current) {
    const text = current.dataset.oi1Tip;
    if (text !== undefined && !current.hasAttribute('title')) current.setAttribute('title', text);
    delete current.dataset.oi1Tip;
    if (current.dataset.oi1TipLabel) { current.removeAttribute('aria-label'); delete current.dataset.oi1TipLabel; }
  }
  current = null;
  bubble?.classList.remove('on');
}

function take(el: HTMLElement) {
  if (el === current) return;
  release();
  const text = el.getAttribute('title')?.trim();
  if (!text) return;
  current = el;
  el.dataset.oi1Tip = text;
  el.removeAttribute('title');
  // A button known only by its title keeps that name for screen readers while the title is aside.
  if (!el.hasAttribute('aria-label') && !el.textContent?.trim()) { el.setAttribute('aria-label', text); el.dataset.oi1TipLabel = '1'; }
  timer = window.setTimeout(() => {
    if (current !== el || !el.isConnected) return;
    bubble ??= Object.assign(document.createElement('div'), { className: 'oi1-tip', role: 'tooltip' });
    if (!bubble.isConnected) document.body.appendChild(bubble);
    bubble.textContent = text;
    const app = getComputedStyle(el).getPropertyValue('--app').trim();
    if (app) bubble.style.setProperty('--app', app); else bubble.style.removeProperty('--app');
    bubble.classList.add('on');
    place(el);
  }, DELAY);
}

export function startCapsuleTips() {
  document.addEventListener('pointerover', e => {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    const el = (e.target as Element | null)?.closest?.('[title]') as HTMLElement | null;
    if (el && !(el instanceof SVGElement)) take(el);
    else if (current && !current.contains(e.target as Node)) release();
  }, true);
  document.addEventListener('pointerout', e => { if (current && !current.contains(e.relatedTarget as Node | null)) release(); }, true);
  for (const type of ['pointerdown', 'keydown', 'wheel', 'blur']) window.addEventListener(type, release, true);
  window.addEventListener('scroll', release, true);
}
