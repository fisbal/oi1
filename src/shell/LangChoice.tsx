// The window that opens when the language changes while a document is open: the interface, the document, or both.

import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, t, type LanguageCode } from './i18n';
import type { LangChoice } from './translate';

export function LangChoiceDialog({ to, onPick, onClose }: { to: LanguageCode; onPick: (c: LangChoice, remember: boolean) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [remember, setRemember] = useState(false);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal?.(); }, []);
  const name = LANGUAGES.find(l => l.code === to)?.name ?? to;
  const options: { c: LangChoice; title: string; hint: string }[] = [
    { c: 'all', title: t('lang.choice.all'), hint: t('lang.choice.allHint', { lang: name }) },
    { c: 'ui', title: t('lang.choice.ui'), hint: t('lang.choice.uiHint', { lang: name }) },
    { c: 'doc', title: t('lang.choice.doc'), hint: t('lang.choice.docHint', { lang: name }) },
  ];
  return (
    <dialog ref={ref} className="oi-dialog lang-choice" onClose={onClose} onCancel={onClose} aria-labelledby="lang-choice-title">
      <h2 id="lang-choice-title">{t('lang.choice.title', { lang: name })}</h2>
      <div className="dialog-body">
        <div className="lang-choice-options">
          {options.map(o => (
            <button key={o.c} type="button" className={`lang-choice-option${o.c === 'ui' ? ' default' : ''}`} onClick={() => onPick(o.c, remember)} autoFocus={o.c === 'ui'}>
              <b>{o.title}</b><small>{o.hint}</small>
            </button>
          ))}
        </div>
        <label className="lang-choice-remember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> {t('lang.choice.remember')}</label>
        <p className="lang-choice-note">{t('lang.choice.note')}</p>
      </div>
      <div className="dialog-buttons"><button type="button" onClick={onClose}>{t('letter.cancel')}</button></div>
    </dialog>
  );
}
