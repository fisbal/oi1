import type { OI1Module } from '../../shell/contract';
import { onLanguageChange, t } from '../../shell/i18n';

// Office ProDFos: the PDF module. ProDFos is its own Flutter app (github.com/fisbal/prodfos);
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
    const frame = Object.assign(document.createElement('iframe'), { className: 'embed', src: PRODFOS_URL, title: 'Office ProDFos' });
    frame.allow = 'clipboard-read; clipboard-write; fullscreen';
    el.append(bar, frame);
    const label = () => { note.textContent = t('prodfos.note'); link.textContent = t('prodfos.openWindow'); };
    label();
    return { unmount: onLanguageChange(label) };
  },
};

export default prodfos;
