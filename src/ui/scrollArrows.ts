// Little ‹ › arrows on every strip that scrolls sideways in Office In 1 (Martin, 2026-10-31: "le dernier onglet est
// impossible à ouvrir car caché, il faudrait une petite flèche… le faire pour tout Office"): the open documents, ribbon
// tabs, ribbon panels, sheet tabs, Code+ file tabs, galleries. An arrow shows only on the side where something is
// hidden; a click slides the strip, and the mouse wheel slides it too. The arrows float above the page (never inside
// React's elements), in the dialog when the strip is in one.

const STRIPS = [
  '.tabs', '.ribbon-tabs', '.ribbon-panel', '.sheet-tabs', '.file-tabs', '.code-dock > header', '.gallery', '.theme-gallery',
  '.st-gallery', '.st-fx-grid', '.refm-tabs', '.tuto-cats',
].join(', ');

interface Pair { left: HTMLButtonElement; right: HTMLButtonElement; host: HTMLElement }
const pairs = new Map<HTMLElement, Pair>();
let frame = 0;

const chevron = (dir: 'l' | 'r') =>
  `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir === 'l' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'}"/></svg>`;

function make(strip: HTMLElement, dir: 'l' | 'r'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `scroll-arrow scroll-arrow-${dir}`;
  b.setAttribute('aria-label', dir === 'l' ? '‹' : '›');
  b.tabIndex = -1;
  b.innerHTML = chevron(dir);
  b.addEventListener('pointerdown', e => e.preventDefault()); // keep the focus and selection where they are
  b.addEventListener('click', e => {
    e.stopPropagation();
    const step = Math.max(120, strip.clientWidth * 0.7);
    strip.scrollBy({ left: dir === 'l' ? -step : step, behavior: 'smooth' });
  });
  return b;
}

function hostOf(strip: HTMLElement): HTMLElement {
  return (strip.closest('dialog[open]') as HTMLElement | null) ?? document.body;
}

function attach(strip: HTMLElement) {
  if (pairs.has(strip)) return;
  const host = hostOf(strip);
  const pair = { left: make(strip, 'l'), right: make(strip, 'r'), host };
  host.append(pair.left, pair.right);
  pairs.set(strip, pair);
  strip.addEventListener('scroll', schedule, { passive: true });
  // A mouse wheel over a sideways strip slides it (when it does not scroll up and down itself).
  strip.addEventListener('wheel', e => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || strip.scrollWidth <= strip.clientWidth + 1) return;
    if (strip.scrollHeight > strip.clientHeight + 1) return;
    strip.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });
  resize?.observe(strip);
}

function detach(strip: HTMLElement) {
  const p = pairs.get(strip);
  if (!p) return;
  p.left.remove(); p.right.remove();
  pairs.delete(strip);
  resize?.unobserve(strip);
}

// Things that float above the strips: an arrow never shows through them.
const OVERLAYS = 'dialog[open], .backstage, .drop-panel, .tabs-menu, .tuto-panel, [role=menu], [role=listbox]';

function covered(strip: HTMLElement, x: number, top: number, size: number): boolean {
  for (const o of document.querySelectorAll<HTMLElement>(OVERLAYS)) {
    if (o.contains(strip) || o.offsetParent === null && getComputedStyle(o).position !== 'fixed') continue;
    const r = o.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (x < r.right && x + size > r.left && top < r.bottom && top + size > r.top) return true;
  }
  return false;
}

function place() {
  frame = 0;
  for (const strip of document.querySelectorAll<HTMLElement>(STRIPS)) attach(strip);
  for (const [strip, p] of pairs) {
    if (!strip.isConnected || hostOf(strip) !== p.host) { detach(strip); if (strip.isConnected) attach(strip); continue; }
    const r = strip.getBoundingClientRect();
    // A strip too short for arrows (the phone's tab bar has its own list button) gets none.
    const visible = r.width >= 200 && r.height > 8 && strip.offsetParent !== null && getComputedStyle(strip).visibility !== 'hidden';
    const more = strip.scrollWidth - strip.clientWidth;
    const showL = visible && more > 1 && strip.scrollLeft > 1;
    const showR = visible && more > 1 && strip.scrollLeft < more - 1;
    const size = Math.max(22, Math.min(30, r.height - 6));
    const top = r.top + (r.height - size) / 2;
    const set = (b: HTMLButtonElement, show: boolean, x: number) => {
      // Only where the strip itself is on top: never over an open menu, the File page, a panel or a dialog.
      if (show) show = !covered(strip, x, top, size);
      b.hidden = !show;
      if (!show) return;
      b.style.cssText = `top:${top}px;left:${x}px;width:${size}px;height:${size}px`;
    };
    // Off the screen's edge, where phones take the back swipe.
    const edge = 8;
    set(p.left, showL, Math.max(r.left, 0) + edge);
    set(p.right, showR, Math.min(r.right, document.documentElement.clientWidth) - size - edge);
  }
}

export function schedule() {
  if (!frame) frame = requestAnimationFrame(place);
}

const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
let installed = false;

/** Starts watching the page for sideways strips (once, from the shell). */
export function installScrollArrows() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  // Our own arrows changing do not count, or it would never rest.
  new MutationObserver(records => {
    if (records.some(r => !(r.target instanceof HTMLElement && r.target.classList.contains('scroll-arrow')))) schedule();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'open'] });
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);
  schedule();
}
