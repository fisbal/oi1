import type { OI1Module } from '../../shell/contract';
import { getLanguage, onLanguageChange, t } from '../../shell/i18n';

// In 1 ProDFos: the PDF module. ProDFos is its own Flutter app (github.com/fisbal/prodfos);
// OI1 shows its published web version inside the tab.
const PRODFOS_URL = 'https://fisbal.github.io/prodfos/';

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
    const frame = Object.assign(document.createElement('iframe'), { className: 'embed', src: `${PRODFOS_URL}?lang=${getLanguage()}`, title: 'In 1 ProDFos' });
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
    const offLang = onLanguageChange(label);
    return { unmount: () => { offLang(); window.removeEventListener('keydown', onKey, true); } };
  },
};

export default prodfos;
