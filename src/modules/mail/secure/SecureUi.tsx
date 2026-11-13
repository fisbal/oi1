// The screens of In 1 Mail's accounts, phishing guard and end-to-end encryption.
import { useEffect, useState } from 'react';
import { Dialog, Icon } from '../../../ui/kit';
import { getLanguage } from '../../../shell/i18n';
import { cancelSignIn, connect, connectImap, disconnect, imapAvailable, MailError, oauthAvailable, PRESETS, ready, type Account, type AccountKind, type ProviderId } from './accounts';
import { worst, type Warn } from './phish';
import { ensureKey, forgetKey, groupFpr, keyInfo, myKey, type MyKey } from './pgp';
import { ms, type SKey } from './strings';

const PROVIDER_NAME: Record<AccountKind, string> = { outlook: 'Microsoft', gmail: 'Google', imap: 'IMAP' };

/** A plain sentence for a failed account action. */
export function errText(e: unknown, acc?: Account | AccountKind): string {
  const kind = typeof acc === 'string' ? acc : acc?.provider;
  const p = kind === 'imap' && typeof acc === 'object' ? acc.servers?.imapHost ?? 'IMAP' : kind ? PROVIDER_NAME[kind] : 'Microsoft / Google';
  const email = typeof acc === 'object' ? acc.email : '';
  if (e instanceof MailError) {
    if (e.kind === 'auth') return kind === 'imap' && !email ? ms('err.badPass') : ms('err.auth', { email: email || p });
    if (e.kind === 'net') return ms('err.net', { p });
    return ms(`err.${e.kind}` as SKey);
  }
  if (/confidential/i.test(String(e))) return ms('err.blocked');
  return ms('err.net', { p });
}

function ImapForm({ onAdd, busy, setBusy, setError }: { onAdd: (a: Account) => void; busy: boolean; setBusy: (b: boolean) => void; setError: (s: string) => void }) {
  const [preset, setPreset] = useState('gmail');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const pr = PRESETS.find(p => p.id === preset) ?? PRESETS[0];
  const [imapHost, setImapHost] = useState(''); const [imapPort, setImapPort] = useState(993);
  const [smtpHost, setSmtpHost] = useState(''); const [smtpPort, setSmtpPort] = useState(465);
  const other = preset === 'other';
  const go = async () => {
    setBusy(true); setError('');
    try {
      const servers = other ? { imapHost, imapPort, smtpHost, smtpPort, preset } : { imapHost: pr.imap[0], imapPort: pr.imap[1], smtpHost: pr.smtp[0], smtpPort: pr.smtp[1], preset };
      onAdd(await connectImap(email, pass, servers));
      setPass('');
    } catch (e) { setError(errText(e, 'imap')); }
    finally { setBusy(false); }
  };
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && pass.trim().length >= 4 && (!other || (imapHost.includes('.') && smtpHost.includes('.')));
  return (
    // Not a <form>: the dialog itself is one (its submit would close it). Enter in a box connects.
    <div className="ml-imap" role="group" aria-label={ms('imapTitle')} onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); if (ok && !busy) void go(); } }}>
      <b>{ms('imapTitle')}</b>
      <small>{ms('imapLead')}</small>
      <label><span>{ms('provider')}</span>
        <select value={preset} onChange={e => setPreset(e.target.value)} aria-label={ms('provider')}>
          {PRESETS.map(p => <option key={p.id} value={p.id}>{p.id === 'other' ? ms('other') : p.name}</option>)}
        </select>
      </label>
      <label><span>{ms('address')}</span><input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} aria-label={ms('address')} /></label>
      <label><span>{ms('appPass')}</span><input type="password" autoComplete="new-password" spellCheck={false} value={pass} onChange={e => setPass(e.target.value)} aria-label={ms('appPass')} /></label>
      {pr.help && <a className="ml-imap-help" href={pr.help} target="_blank" rel="noopener noreferrer">{ms('makeAppPass', { p: pr.name })}</a>}
      {preset === 'gmail' && <small>{ms('gmailAppPass')}</small>}
      {other && <div className="ml-imap-servers">
        <label><span>{ms('imapServer')}</span><input value={imapHost} onChange={e => setImapHost(e.target.value)} placeholder="imap.example.com" aria-label={ms('imapServer')} /></label>
        <label className="ml-port"><span>{ms('port')}</span><input type="number" min={1} max={65535} value={imapPort} onChange={e => setImapPort(Number(e.target.value) || 993)} aria-label={`${ms('imapServer')} ${ms('port')}`} /></label>
        <label><span>{ms('smtpServer')}</span><input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.example.com" aria-label={ms('smtpServer')} /></label>
        <label className="ml-port"><span>{ms('port')}</span><input type="number" min={1} max={65535} value={smtpPort} onChange={e => setSmtpPort(Number(e.target.value) || 465)} aria-label={`${ms('smtpServer')} ${ms('port')}`} /></label>
      </div>}
      <button type="button" className="primary" data-provider="imap" disabled={!ok || busy} onClick={() => void go()}><Icon name="envelope" size={14} />{ms('connect')}</button>
    </div>
  );
}

export function AccountsDialog({ accounts, sendWith, onAdd, onRemove, onSendWith, onClose, onNote }: {
  accounts: Account[]; sendWith?: string; onAdd: (a: Account) => void; onRemove: (a: Account) => void; onSendWith: (id: string) => void; onClose: () => void; onNote: (s: string) => void;
}) {
  const [busy, setBusy] = useState<ProviderId | 'imap' | null>(null);
  const [error, setError] = useState('');
  const add = async (p: ProviderId) => {
    setBusy(p); setError('');
    try { const a = await connect(p); onAdd(a); onNote(ms('connected', { email: a.email })); }
    catch (e) { setError(errText(e, p)); }
    finally { setBusy(null); }
  };
  useEffect(() => () => cancelSignIn(), []);
  const lang = getLanguage();
  const web = oauthAvailable(), app = imapAvailable();
  const kindName = (a: Account) => (a.provider === 'outlook' ? ms('outlook') : a.provider === 'gmail' ? `${ms('gmail')} · ${ms('sendOnly')}` : PRESETS.find(p => p.id === a.servers?.preset)?.name ?? 'IMAP');
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
                  <span><b>{a.email}</b><small>{kindName(a)}{a.lastSync ? ` · ${ms('lastSync', { when: new Date(a.lastSync).toLocaleString(lang) })}` : ''}</small></span>
                </label>
                <button type="button" onClick={() => { void disconnect(a); onRemove(a); onNote(ms('removed', { email: a.email })); }}>{ms('remove')}</button>
              </li>
            ))}
          </ul>
        ) : <p className="ml-acc-none">{ms('none')}</p>}
        <div className="ml-acc-add">
          {web ? (['outlook', 'gmail'] as ProviderId[]).map(p => (
            <div key={p} className="ml-acc-prov">
              <button type="button" className="primary" data-provider={p} disabled={!!busy || !ready(p)} onClick={() => void add(p)}>
                <Icon name="envelope" size={14} />{ms('connect')} · {p === 'outlook' ? ms('outlook') : ms('gmailSendBtn')}
              </button>
              {!ready(p) && <small>{ms('notReady', { p: PROVIDER_NAME[p] })}</small>}
              {ready(p) && p === 'gmail' && <small>{ms('gmailSend')}</small>}
            </div>
          )) : <small className="ml-acc-imap">{ms('oauthWeb')}</small>}
          {app ? <ImapForm onAdd={a => { onAdd(a); onNote(ms('connected', { email: a.email })); }} busy={!!busy} setBusy={b => setBusy(b ? 'imap' : null)} setError={setError} />
            : <small className="ml-acc-imap">{ms('imapApp')}</small>}
        </div>
        {busy && busy !== 'imap' && <p role="status" className="ml-acc-busy">{ms('signingIn', { p: PROVIDER_NAME[busy] })} <button type="button" onClick={() => cancelSignIn()}>{ms('cancel')}</button></p>}
        {busy === 'imap' && <p role="status" className="ml-acc-busy">{ms('checking')}</p>}
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
