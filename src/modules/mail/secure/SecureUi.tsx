// The screens of In 1 Mail's accounts, phishing guard and end-to-end encryption.
import { useEffect, useState } from 'react';
import { Dialog, Icon } from '../../../ui/kit';
import { getLanguage } from '../../../shell/i18n';
import { cancelSignIn, connect, disconnect, MailError, ready, type Account, type ProviderId } from './accounts';
import { worst, type Warn } from './phish';
import { ensureKey, forgetKey, groupFpr, keyInfo, myKey, type MyKey } from './pgp';
import { ms, type SKey } from './strings';

const PROVIDER_NAME: Record<ProviderId, string> = { outlook: 'Microsoft', gmail: 'Google' };

/** A plain sentence for a failed account action. */
export function errText(e: unknown, acc?: Account | ProviderId): string {
  const p = typeof acc === 'string' ? PROVIDER_NAME[acc] : acc ? PROVIDER_NAME[acc.provider] : 'Microsoft / Google';
  const email = typeof acc === 'object' ? acc.email : '';
  if (e instanceof MailError) {
    if (e.kind === 'auth') return ms('err.auth', { email: email || p });
    if (e.kind === 'net') return ms('err.net', { p });
    return ms(`err.${e.kind}` as SKey);
  }
  if (/confidential/i.test(String(e))) return ms('err.blocked');
  return ms('err.net', { p });
}

export function AccountsDialog({ accounts, sendWith, onAdd, onRemove, onSendWith, onClose, onNote }: {
  accounts: Account[]; sendWith?: string; onAdd: (a: Account) => void; onRemove: (a: Account) => void; onSendWith: (id: string) => void; onClose: () => void; onNote: (s: string) => void;
}) {
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [error, setError] = useState('');
  const add = async (p: ProviderId) => {
    setBusy(p); setError('');
    try { const a = await connect(p); onAdd(a); onNote(ms('connected', { email: a.email })); }
    catch (e) { setError(errText(e, p)); }
    finally { setBusy(null); }
  };
  useEffect(() => () => cancelSignIn(), []);
  const lang = getLanguage();
  return (
    <Dialog title={ms('title')} onClose={onClose}>
      <div className="ml-acc">
        <p className="ml-acc-lead">{ms('lead')}</p>
        {accounts.length ? (
          <ul className="ml-acc-list" aria-label={ms('title')}>
            {accounts.map(a => (
              <li key={a.id}>
                <label className="ml-acc-who">
                  <input type="radio" name="ml-send-with" checked={(sendWith ?? accounts[0].id) === a.id} onChange={() => onSendWith(a.id)} aria-label={`${ms('sendWith')} ${a.email}`} />
                  <span><b>{a.email}</b><small>{a.provider === 'outlook' ? ms('outlook') : ms('gmail')}{a.lastSync ? ` · ${ms('lastSync', { when: new Date(a.lastSync).toLocaleString(lang) })}` : ''}</small></span>
                </label>
                <button type="button" onClick={() => { void disconnect(a); onRemove(a); onNote(ms('removed', { email: a.email })); }}>{ms('remove')}</button>
              </li>
            ))}
          </ul>
        ) : <p className="ml-acc-none">{ms('none')}</p>}
        <div className="ml-acc-add">
          {(['outlook', 'gmail'] as ProviderId[]).map(p => (
            <div key={p} className="ml-acc-prov">
              <button type="button" className="primary" data-provider={p} disabled={!!busy || !ready(p)} onClick={() => void add(p)}>
                <Icon name="envelope" size={14} />{ms('connect')} · {p === 'outlook' ? ms('outlook') : ms('gmail')}
              </button>
              {!ready(p) && <small>{ms('notReady', { p: PROVIDER_NAME[p] })}</small>}
              {ready(p) && p === 'gmail' && <small>{ms('gmailTest')}</small>}
            </div>
          ))}
          <small className="ml-acc-imap">{ms('imap')}</small>
        </div>
        {busy && <p role="status" className="ml-acc-busy">{ms('signingIn', { p: PROVIDER_NAME[busy] })} <button type="button" onClick={() => cancelSignIn()}>{ms('cancel')}</button></p>}
        {error && <p role="alert" className="ml-acc-error">{error}</p>}
        <p className="ml-acc-note">{ms('personal')}</p>
      </div>
    </Dialog>
  );
}

export function KeysDialog({ me, keys, auto, onAuto, onKeys, onSave, onClose, onNote }: {
  me: { name: string; email: string }; keys: Record<string, string>; auto: boolean; onAuto: (on: boolean) => void; onKeys: (k: Record<string, string>) => void;
  onSave: (name: string, text: string) => void; onClose: () => void; onNote: (s: string) => void;
}) {
  const [mine, setMine] = useState<MyKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void myKey().then(setMine); }, []);
  const make = async () => {
    if (!me.email) { setError(ms('needMe')); return; }
    setBusy(true); setError('');
    try { setMine(await ensureKey(me.name, me.email)); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const pick = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.asc,.pgp,.gpg,.txt,.key';
    i.onchange = async () => {
      const f = i.files?.[0]; if (!f) return;
      const text = await f.text();
      const info = await keyInfo(text);
      if (!info || !info.emails.length) { setError(ms('badKey')); return; }
      onKeys({ ...keys, ...Object.fromEntries(info.emails.map(e => [e, text])) });
      onNote(ms('keyAdded', { email: info.emails.join(', ') }));
    };
    i.click();
  };
  return (
    <Dialog title={ms('e2eTitle')} onClose={onClose}>
      <div className="ml-acc">
        <p className="ml-acc-lead">{ms('e2eLead')}</p>
        {mine ? (
          <div className="ml-key">
            <b>{ms('myKey')} · {mine.email}</b>
            <small>{ms('fpr')}</small>
            <code className="ml-fpr" translate="no">{groupFpr(mine.fpr)}</code>
            <div className="ml-key-row">
              <button type="button" onClick={() => onSave(`${mine.email}.asc`, mine.pub)}>{ms('exportKey')}</button>
              <button type="button" onClick={() => { void forgetKey().then(() => setMine(null)); }}>{ms('forget')}</button>
            </div>
          </div>
        ) : <button type="button" className="primary" disabled={busy} onClick={() => void make()}><Icon name="shield" size={14} />{ms('makeKey')}</button>}
        <label className="ml-key-auto"><input type="checkbox" checked={auto} onChange={e => onAuto(e.target.checked)} disabled={!mine} />{ms('auto')}</label>
        <div className="ml-key-row">
          <button type="button" onClick={pick}>{ms('importKey')}</button>
          <small>{ms('known', { n: Object.keys(keys).length })}</small>
        </div>
        {error && <p role="alert" className="ml-acc-error">{error}</p>}
      </div>
    </Dialog>
  );
}

/** The warning above a suspicious mail, in plain words, with what to do. */
export function PhishBanner({ warns, onTrust }: { warns: Warn[]; onTrust: () => void }) {
  const level = worst(warns);
  if (!level) return null;
  return (
    <div className={`ml-phish ${level}`} role={level === 'danger' ? 'alert' : 'note'} data-level={level}>
      <b><Icon name="shield" size={14} />{ms(`ph.${level}` as SKey)}</b>
      <ul>{warns.map((w, i) => <li key={i} data-code={w.code}>{ms(`ph.${w.code}` as SKey, { d: w.detail ?? '' })}</li>)}</ul>
      {level !== 'info' && <p>{ms('ph.advice')}</p>}
      {level !== 'info' && <button type="button" onClick={onTrust}>{ms('ph.trust')}</button>}
    </div>
  );
}

export function LinkDialog({ href, host, why, onOpen, onClose }: { href: string; host: string; why: string; onOpen: () => void; onClose: () => void }) {
  return (
    <Dialog title={ms('linkTitle')} onClose={onClose}>
      <div className="ml-acc">
        <p>{why}</p>
        <p>{ms('linkGoes')}</p>
        <code className="ml-fpr" translate="no">{host || href.slice(0, 120)}</code>
        <small className="ml-link-full" translate="no">{href.slice(0, 300)}</small>
        <div className="ml-key-row"><button type="button" className="ml-danger" onClick={() => { onOpen(); onClose(); }}>{ms('openAnyway')}</button><button type="button" className="primary" onClick={onClose}>{ms('close')}</button></div>
      </div>
    </Dialog>
  );
}
