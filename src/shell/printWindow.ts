// Opens a print window for a document without writing raw HTML into it: the title and the style are set as text and
// the body goes through safeHtml, so a pasted page or an AI answer can never run code in the print window.
import { safeHtml } from './safeHtml';

export function printWindow(title: string, bodyHtml: string, css: string, lang = 'en'): void {
  const w = window.open('', '_blank');
  if (!w) return;
  const d = w.document;
  d.documentElement.lang = lang;
  d.title = title;
  const meta = d.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  d.head.appendChild(meta);
  const style = d.createElement('style');
  style.textContent = css;
  d.head.appendChild(style);
  d.body.innerHTML = safeHtml(bodyHtml);
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* window closed */ } }, 300);
}
