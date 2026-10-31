// More room to work, in every app: the ribbon can fold down to its tabs, like Word's "Collapse the Ribbon".
// Double-click a tab, press Ctrl+F1, or use the arrow after the tabs. Folded, a tab opens its buttons over the work
// and a tap on the work closes them (the same as on short screens, see kit.css). Phones start folded; the choice is
// remembered on the device.

const KEY = 'oi1.ribbonMin';
const EVENT = 'oi1-ribbon-min';

function initial(): boolean {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved === '1';
  } catch { /* private window */ }
  return Math.min(window.innerWidth, window.innerHeight) < 600;
}

export function ribbonMin(): boolean {
  return document.documentElement.classList.contains('ribbon-min');
}

/** Folded, closes a tab's buttons opened over the work, so what a button just showed there can be seen. */
export function closeRibbonPeek() {
  for (const r of document.querySelectorAll('.ribbon.open')) r.classList.remove('open');
}

export function setRibbonMin(on: boolean) {
  document.documentElement.classList.toggle('ribbon-min', on);
  closeRibbonPeek();
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private window */ }
  window.dispatchEvent(new Event(EVENT));
}

export function onRibbonMin(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** Done once when the app starts. */
export function startRibbonMin() {
  document.documentElement.classList.toggle('ribbon-min', initial());
  document.addEventListener('dblclick', e => {
    if ((e.target as Element).closest?.('.ribbon-tabs [role=tab]')) setRibbonMin(!ribbonMin());
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'F1' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setRibbonMin(!ribbonMin()); }
  });
}
