// In 1 Notes, "Listen and take notes": the consent card before it starts, the red recording light while it
// listens, and the card that follows (summary for Letter, to-dos for Plan, notes by Mail).
import { useEffect, useState } from 'react';
import { t } from '../../shell/i18n';
import { Dialog, Icon } from '../../ui/kit';
import { elapsed } from './meeting';

export type ListenKind = 'meeting' | 'class' | 'call' | 'talk';
export const LISTEN_KINDS: ListenKind[] = ['meeting', 'class', 'call', 'talk'];

/** Before listening: say who is listened to, and tick that everyone there agrees. */
export function ListenDialog({ onStart, onClose }: { onStart: (kind: ListenKind) => void; onClose: () => void }) {
  const [ok, setOk] = useState(false);
  const [kind, setKind] = useState<ListenKind>('meeting');
  const [warn, setWarn] = useState(false);
  return (
    <Dialog title={t('notes.listen.title')} onClose={onClose} onOk={() => { if (!ok) { setWarn(true); return false; } onStart(kind); }}>
      <div className="nt-listen">
        <p className="nt-listen-lead">{t('notes.listen.lead')}</p>
        <div className="nt-listen-kinds" role="radiogroup" aria-label={t('notes.listen.kind')}>
          {LISTEN_KINDS.map(k => (
            <label key={k} className={kind === k ? 'on' : ''}>
              <input type="radio" name="nt-listen-kind" checked={kind === k} onChange={() => setKind(k)} />
              <span>{t(`notes.listen.kind.${k}`)}</span>
            </label>
          ))}
        </div>
        <div className="nt-listen-consent" role="note">
          <strong><Icon name="comment" size={14} /> {t('notes.listen.ask')}</strong>
          <p>{t('notes.listen.why')}</p>
        </div>
        <label className={`nt-listen-check${warn && !ok ? ' warn' : ''}`}>
          <input type="checkbox" checked={ok} onChange={e => { setOk(e.target.checked); setWarn(false); }} />
          <span>{t('notes.listen.agree')}</span>
        </label>
        {warn && !ok && <p className="nt-listen-warn" role="alert">{t('notes.listen.needAgree')}</p>}
        <p className="nt-listen-small">{t('notes.listen.private')}</p>
      </div>
    </Dialog>
  );
}

/** The red light, always on screen while it listens. */
export function RecBar({ since, paused, onPause, onStop }: { since: number; paused: boolean; onPause: () => void; onStop: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  return (
    <div className={`nt-rec${paused ? ' paused' : ''}`} role="status" aria-live="polite">
      <span className="nt-rec-dot" aria-hidden="true" />
      <span className="nt-rec-text">{paused ? t('notes.listen.paused') : t('notes.listen.on')}</span>
      <span className="nt-rec-time">{elapsed(now - since)}</span>
      <button type="button" onClick={onPause}>{paused ? t('notes.listen.resume') : t('notes.listen.pause')}</button>
      <button type="button" className="stop" onClick={onStop}>{t('notes.listen.stop')}</button>
    </div>
  );
}

/** After listening: where the notes go next. */
export function ListenDone({ todos, onAi, onLetter, onPlan, onMail, onClose }: {
  todos: number; onAi: () => void; onLetter: () => void; onPlan: () => void; onMail: () => void; onClose: () => void;
}) {
  return (
    <div className="nt-listen-done" role="dialog" aria-label={t('notes.listen.doneTitle')}>
      <strong>{t('notes.listen.doneTitle')}</strong>
      <span>{t('notes.listen.doneText')}</span>
      <div className="nt-listen-actions">
        <button type="button" onClick={onAi}><Icon name="sparkle" size={14} /> {t('notes.listen.aiSummary')}</button>
        <button type="button" onClick={onLetter}><Icon name="file" size={14} /> {t('notes.listen.toLetter')}</button>
        <button type="button" onClick={onPlan} disabled={!todos}><Icon name="check" size={14} /> {t('notes.listen.toPlan', { n: todos })}</button>
        <button type="button" onClick={onMail}><Icon name="envelope" size={14} /> {t('notes.listen.toMail')}</button>
        <button type="button" className="x" aria-label={t('letter.close')} title={t('letter.close')} onClick={onClose}><Icon name="close" size={13} /></button>
      </div>
    </div>
  );
}
