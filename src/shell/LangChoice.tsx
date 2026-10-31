// The window that opens when the language changes while a document is open: the interface, the document, or both.
// Drawn in the Office In 1 scene look (Martin, 2026-10-31: "mieux fait, reflétera la beauté d'Office In 1").

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LANGUAGES, getLanguage, t, type LanguageCode } from './i18n';
import type { LangChoice } from './translate';

const S = (d: ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const ICONS: Record<LangChoice, ReactNode> = {
  all: S(<><rect x="3" y="3" width="18" height="5" rx="1.5" /><path d="M6 11h9M6 14.5h12M6 18h7" /></>),
  ui: S(<><rect x="3" y="3" width="18" height="5" rx="1.5" /><path d="M6 11h12M6 14.5h12M6 18h12" opacity=".35" /></>),
  doc: S(<><rect x="3" y="3" width="18" height="5" rx="1.5" opacity=".35" /><path d="M6 11h9M6 14.5h12M6 18h7" /></>),
};

export function LangChoiceDialog({ to, onPick, onClose }: { to: LanguageCode; onPick: (c: LangChoice, remember: boolean) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [remember, setRemember] = useState(false);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal?.(); }, []);
  const name = LANGUAGES.find(l => l.code === to)?.name ?? to;
  const from = LANGUAGES.find(l => l.code === getLanguage())?.name ?? getLanguage();
  const options: { c: LangChoice; title: string; hint: string }[] = [
    { c: 'all', title: t('lang.choice.all'), hint: t('lang.choice.allHint', { lang: name }) },
    { c: 'ui', title: t('lang.choice.ui'), hint: t('lang.choice.uiHint', { lang: name }) },
    { c: 'doc', title: t('lang.choice.doc'), hint: t('lang.choice.docHint', { lang: name }) },
  ];
  return (
    <dialog ref={ref} className="oi-dialog lang-choice" onClose={onClose} onCancel={onClose} aria-labelledby="lang-choice-title">
      <div className="lc-card">
        <header className="lc-head">
          <span className="lc-globe" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></svg>
          </span>
          <div className="lc-titles">
            <h2 id="lang-choice-title">{t('lang.choice.title', { lang: name })}</h2>
            <p className="lc-route"><span>{from}</span><b aria-hidden="true">→</b><span className="lc-to">{name}</span></p>
          </div>
          <button type="button" className="lc-x" aria-label={t('letter.cancel')} title={t('letter.cancel')} onClick={onClose}>×</button>
        </header>
        <div className="dialog-body">
          <div className="lang-choice-options">
            {options.map(o => (
              <button key={o.c} type="button" className={`lang-choice-option${o.c === 'ui' ? ' default' : ''}`} onClick={() => onPick(o.c, remember)} autoFocus={o.c === 'ui'}>
                <span className="lc-ico">{ICONS[o.c]}</span>
                <span className="lc-text"><b>{o.title}{o.c === 'ui' && <em className="lc-badge">{t('lang.choice.recommended')}</em>}</b><small>{o.hint}</small></span>
                <span className="lc-go" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
          <p className="lang-choice-note"><span aria-hidden="true">✦</span> {t('lang.choice.note')}</p>
        </div>
        <footer className="lc-foot">
          <label className="lang-choice-remember">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            <span className="lc-switch" aria-hidden="true" /> {t('lang.choice.remember')}
          </label>
          <button type="button" className="lc-cancel" onClick={onClose}>{t('letter.cancel')}</button>
        </footer>
      </div>
    </dialog>
  );
}
