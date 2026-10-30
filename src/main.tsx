import { createRoot } from 'react-dom/client';
import App from './shell/App';
import './shell/shell.css';
import { startRibbonMin } from './ui/ribbonMin';

// iPhones and iPads zoom into any text box with small text when it is tapped, and stay zoomed in, so the app
// no longer fits the screen. A maximum scale stops that there (iOS still lets people pinch to zoom); other
// phones keep the plain viewport so pinch zoom works everywhere.
const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (iOS) document.querySelector('meta[name=viewport]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');

// A "#run=…" link (the QR code in Office Code+) shows only the project it carries.
if (location.hash.startsWith('#run=')) void import('./modules/code/runner').then(m => m.startRunner(location.hash.slice(5)));
else createRoot(document.getElementById('root')!).render(<App />);

startRibbonMin();

// On short screens (and when the ribbon is folded) the ribbon shows only its tabs (see kit.css): a tap on a tab opens its buttons, a tap on the work closes them.
// Done here once for every app; Safari does not focus buttons when they are tapped, so :focus-within alone is not enough.
document.addEventListener('pointerdown', e => {
  const el = e.target as Element;
  const ribbon = el.closest?.('.ribbon');
  for (const r of document.querySelectorAll('.ribbon.open')) if (r !== ribbon) r.classList.remove('open');
  if (ribbon && el.closest('.ribbon-tabs [role=tab]')) ribbon.classList.add('open');
}, true);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}
