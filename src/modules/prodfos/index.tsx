import type { OI1Module } from '../../shell/contract';
import { getLanguage, onLanguageChange, t } from '../../shell/i18n';
import { printWindow } from '../../shell/printWindow';

// In 1 ProDFos: the PDF module. ProDFos is its own Flutter app (github.com/fisbal/prodfos);
// OI1 shows its published web version inside the tab.
const PRODFOS_URL = 'https://fisbal.github.io/prodfos/';
/** One PDF page per sheet, the whole page, no margin added (the PDF has its own). */
const PRINT_CSS = '@page{margin:0}html,body{margin:0;padding:0}img{display:block;width:100%;height:auto;page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}';

const prodfos: OI1Module = {
  id: 'prodfos',
  extensions: [],
  mount(el, shell) {
    shell.setTitle('ProDFos');
    const bar = document.createElement('div');
    bar.className = 'embed-bar';
    const note = document.createElement('span');
    const link = Object.assign(document.createElement('a'), { href: PRODFOS_URL, target: '_blank', rel: 'noopener' });
    bar.append(note, link);
    const frame = Object.assign(document.createElement('iframe'), { className: 'embed', src: `${PRODFOS_URL}?lang=${getLanguage()}&host=oi1`, title: 'In 1 ProDFos' });
    frame.allow = 'clipboard-read; clipboard-write; fullscreen';
    el.append(bar, frame);
    // ProDFos speaks the same 5 languages: it opens in OI1's language and switches when OI1's language changes.
    const label = () => {
      note.textContent = t('prodfos.note');
      link.textContent = t('prodfos.openWindow');
      frame.contentWindow?.postMessage({ type: 'oi1-lang', lang: getLanguage() }, new URL(PRODFOS_URL).origin);
    };
    label();
    // Ctrl+P (⌘P) while this tab is on screen prints the open PDF in ProDFos, not the Office In 1 window.
    // When the PDF itself has the focus, ProDFos catches Ctrl+P on its own.
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'p' || !el.offsetParent) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      frame.contentWindow?.postMessage({ type: 'oi1-print' }, new URL(PRODFOS_URL).origin);
    };
    window.addEventListener('keydown', onKey, true);
    // Print from ProDFos (its button, Ctrl+P): a browser cannot print a PDF from a frame inside Office In 1 (Martin,
    // 2026-11-03: "print still not working"), so ProDFos sends its pages as pictures and they print from here.
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== new URL(PRODFOS_URL).origin || e.source !== frame.contentWindow) return;
      const d = e.data as { type?: string; name?: unknown; pages?: unknown };
      if (d?.type !== 'prodfos-print-pages' || !Array.isArray(d.pages)) return;
      const pages = d.pages.filter((p): p is string => typeof p === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(p));
      if (!pages.length) return;
      const name = typeof d.name === 'string' ? d.name.replace(/[<>]/g, '') : 'ProDFos';
      printWindow(name, pages.map(p => `<img src="${p}" alt="">`).join(''), PRINT_CSS, getLanguage());
    };
    window.addEventListener('message', onMessage);
    const offLang = onLanguageChange(label);
    return { unmount: () => { offLang(); window.removeEventListener('keydown', onKey, true); window.removeEventListener('message', onMessage); } };
  },
};

export default prodfos;
