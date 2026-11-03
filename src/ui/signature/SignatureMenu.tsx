// "Signature" drop menu content shared by In 1 Letter, Class and Mail: my signatures (kept on this device), what to
// place (the signature, a full signature line with name, title and date, or the initials), and "New signature…".
import { useEffect, useState } from 'react';
import { t } from '../../shell/i18n';
import { MenuItem } from '../kit';
import { defaultSignature, deleteSignature, inkUrl, listSignatures, setDefaultSignature, type Signature } from './store';
import './signature.css';

export type SignaturePlace = 'sig' | 'line' | 'initials';

export function useSignatures(): Signature[] {
  const [all, setAll] = useState(listSignatures);
  useEffect(() => {
    const on = () => setAll(listSignatures());
    window.addEventListener('oi1-signatures', on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener('oi1-signatures', on); window.removeEventListener('storage', on); };
  }, []);
  return all;
}

export function SignatureMenu({ onPlace, onNew, close }: { onPlace: (s: Signature, how: SignaturePlace) => void; onNew: () => void; close: () => void }) {
  const all = useSignatures();
  const main = defaultSignature();
  const place = (how: SignaturePlace, s: Signature | null = main) => { if (s) { onPlace(s, how); close(); } };
  return (
    <div className="sig-list">
      {main ? <>
        <MenuItem label={t('sig.place.sig')} onClick={() => place('sig')} />
        <MenuItem label={t('sig.place.line')} onClick={() => place('line')} />
        {main.initials && <MenuItem label={t('sig.place.initials')} onClick={() => place('initials')} />}
        <hr />
        <p className="sig-empty">{t('sig.mine')}</p>
        {all.map(s => (
          <div className="sig-item" key={s.id}>
            <button type="button" title={t('sig.useThis')} aria-pressed={s.id === main.id} onClick={() => { setDefaultSignature(s.id); place('sig', s); }}>
              <img src={inkUrl(s.png)} alt={t('sig.preview')} />
              <small>{s.id === main.id ? '★ ' : ''}{s.name || t(`sig.mode.${s.kind}`)}</small>
            </button>
            <button type="button" className="sig-del" aria-label={t('sig.delete')} title={t('sig.delete')}
              onClick={() => { if (window.confirm(t('sig.deleteAsk'))) deleteSignature(s.id); }}>×</button>
          </div>
        ))}
        <hr />
      </> : <p className="sig-empty">{t('sig.none')}</p>}
      <MenuItem label={`＋ ${t('sig.new')}`} onClick={() => { close(); onNew(); }} />
    </div>
  );
}

/** HTML for a signature line: the signature, a line, the name in bold, the title, and today's date. */
export function signatureLineHtml(s: Signature, date: string, width = 200): string {
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const h = Math.round(width * s.h / s.w);
  return `<p><img src="${s.png}" alt="${esc(t('sig.alt', { name: s.name || '' }))}" width="${width}" height="${h}"></p>`
    + '<p>________________________________</p>'
    + (s.name ? `<p><strong>${esc(s.name)}</strong></p>` : '')
    + (s.title ? `<p>${esc(s.title)}</p>` : '')
    + `<p>${esc(date)}</p>`;
}
