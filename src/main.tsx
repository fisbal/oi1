import { createRoot } from 'react-dom/client';
import App from './shell/App';
import './shell/shell.css';

// A "#run=…" link (the QR code in Office Code+) shows only the project it carries.
if (location.hash.startsWith('#run=')) void import('./modules/code/runner').then(m => m.startRunner(location.hash.slice(5)));
else createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}
