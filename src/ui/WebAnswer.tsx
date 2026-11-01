// The card that brings an answer back from the AI's public site (see shell/webAi.ts): the request is open there,
// the person copies the answer, then "Paste the answer" puts it where the app asked for it.

import { useEffect, useRef, useState } from 'react';
import { onWebWait, webWait } from '../shell/webAi';
import { t } from '../shell/i18n';
import { Icon } from './kit';
import './web-answer.css';

export function WebAnswer() {
  const [, redraw] = useState(0);
  useEffect(() => onWebWait(() => redraw(n => n + 1)), []);
  const [manual, setManual] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const w = webWait();
  useEffect(() => { setManual(false); }, [w?.id]);
  // Back from the AI's site or app (a phone switches apps): when the browser lets the app read the clipboard
  // without asking, an answer copied there comes in by itself; otherwise the big Paste button does it in one tap.
  useEffect(() => {
    if (!w) return;
    const back = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const perm = await navigator.permissions?.query({ name: 'clipboard-read' as PermissionName });
        if (perm?.state !== 'granted') return;
        const text = (await navigator.clipboard.readText()).trim();
        if (text && text !== w.sent.trim()) w.answer(text);
      } catch { /* not allowed: the button is there */ }
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    return () => { document.removeEventListener('visibilitychange', back); window.removeEventListener('focus', back); };
  }, [w]);
  if (!w) return null;
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      // Still the request (the answer not copied yet): show the box rather than send the question back.
      if (text.trim() && text.trim() !== w.sent.trim()) { w.answer(text); return; }
    } catch { /* not allowed here: paste by hand */ }
    setManual(true);
    window.setTimeout(() => box.current?.focus(), 0);
  };
  return (
    <div className="web-answer" role="dialog" aria-label={t('ai.web.paste')}>
      <div className="web-answer-head">
        <span className="copilot-mark"><Icon name="sparkle" size={14} /></span>
        <b>{t('ai.web.open', { site: w.site })}</b>
        <button type="button" className="web-answer-x" title={t('letter.cancel')} aria-label={t('letter.cancel')} onClick={() => w.cancel()}><Icon name="close" size={12} /></button>
      </div>
      <p>{!w.inUrl ? `${t('ai.web.copied')} ` : ''}{t('ai.web.then')}</p>
      <div className="web-answer-buttons">
        <button type="button" className="primary" onClick={() => void paste()}><Icon name="paste" size={14} />{t('ai.web.paste')}</button>
        <button type="button" onClick={() => w.reopen()}>{t('ai.web.reopen', { site: w.site })}</button>
      </div>
      <textarea ref={box} rows={manual ? 4 : 2} placeholder={manual ? t('ai.web.noClipboard') : t('ai.web.pasteHere')} aria-label={t('ai.web.pasteHere')}
        onPaste={e => { const text = e.clipboardData.getData('text'); if (text.trim()) { e.preventDefault(); w.answer(text); } }}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.currentTarget.value.trim()) w.answer(e.currentTarget.value); }} />
    </div>
  );
}
