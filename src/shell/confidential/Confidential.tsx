// Confidential mode's screens: the lock screen (which keeps every app closed while locked), the panel (turn on,
// recovery code, status, journal, settings), the 🔒 badge in each app bar and the note when a send is blocked.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ct } from './strings';
import { confidentialLocked, confidentialOn, onConfidential } from './mode';
import { PIN_MIN, changePin, lockMinutes, pinOk, setLockMinutes, vaultMade, waitLeft } from './vault';
import { lockNow, openVault, sealedCounts, turnOff, turnOn } from './session';
import { journal, onJournal, readJournal, type JournalEntry } from './journal';
import { onBlocked } from './netGuard';
import { downloadFile } from '../files';
import './confidential.css';

function useConfidential() {
  const [, redraw] = useState(0);
  useEffect(() => onConfidential(() => redraw(n => n + 1)), []);
}

let panelOpen = false;
const panelListeners = new Set<() => void>();
export function openConfidentialPanel() { panelOpen = true; panelListeners.forEach(f => f()); }
function closePanel() { panelOpen = false; panelListeners.forEach(f => f()); }

/** A PIN that is too easy: all the same digit, or digits in a row (123456, 987654). */
export function weakPin(pin: string): boolean {
  if (!/^\d+$/.test(pin)) return false;
  if (/^(\d)\1+$/.test(pin)) return true;
  const d = [...pin].map(Number);
  const up = d.every((x, i) => i === 0 || x === (d[i - 1] + 1) % 10);
  const down = d.every((x, i) => i === 0 || x === (d[i - 1] + 9) % 10);
  return up || down;
}

/** Wraps the whole app: while confidential mode is locked, only the lock screen is there (no app is open). */
export function ConfidentialGate({ children }: { children: ReactNode }) {
  useConfidential();
  return <>
    {confidentialLocked() ? <LockScreen /> : children}
    <ConfidentialHost />
  </>;
}

function PinField({ id, value, onChange, label, autoFocus, code }: { id: string; value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean; code?: boolean }) {
  return (
    <label className="cf-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type={code ? 'text' : 'password'} inputMode={code ? 'text' : 'numeric'} autoComplete="off" autoCapitalize={code ? 'characters' : 'off'}
        spellCheck={false} autoFocus={autoFocus} value={value} onChange={e => onChange(e.target.value)} data-testid={id} />
    </label>
  );
}

function LockScreen() {
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'pin' | 'code' | 'newPin'>('pin');
  const [code, setCode] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(() => waitLeft());
  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setInterval(() => setWait(waitLeft()), 1000);
    return () => window.clearInterval(id);
  }, [wait]);

  async function tryPin() {
    if (busy || !pin) return;
    setBusy(true); setMsg('');
    const ok = await openVault(pin);
    setBusy(false);
    if (!ok) { setPin(''); setWait(waitLeft()); setMsg(waitLeft() > 0 ? '' : ct('wrong')); }
  }
  async function tryCode() {
    if (busy || !code) return;
    const err = !pinOk(p1) ? ct('pinShort') : weakPin(p1) ? ct('pinWeak') : p1 !== p2 ? ct('pinDiffer') : '';
    if (err) { setMsg(err); return; }
    setBusy(true); setMsg('');
    const changed = await changePin(code, p1, true);
    const ok = changed && await openVault(code, true);
    setBusy(false);
    if (!ok) { setWait(waitLeft()); setMsg(ct('codeWrong')); return; }
    journal('pin');
  }
  const waitText = wait > 0 ? ct('wait', { s: Math.ceil(wait / 1000) }) : '';
  return (
    <div className="cf-lock" role="dialog" aria-modal="true" aria-labelledby="cf-lock-title" translate="no">
      <form className="cf-lock-card" onSubmit={e => { e.preventDefault(); void (mode === 'pin' ? tryPin() : mode === 'newPin' ? tryCode() : setMode('newPin')); }}>
        <div className="cf-lock-icon" aria-hidden="true">🔒</div>
        <h1 id="cf-lock-title">{ct('locked')}</h1>
        {mode === 'pin' && <>
          <PinField id="cf-pin" label={ct('pin')} value={pin} onChange={setPin} autoFocus />
          <button type="submit" className="cf-primary" disabled={busy || wait > 0 || !pin} data-testid="cf-unlock">{busy ? '…' : ct('unlock')}</button>
          <button type="button" className="cf-link" onClick={() => { setMode('code'); setMsg(''); }}>{ct('forgot')}</button>
        </>}
        {mode === 'code' && <>
          <PinField id="cf-code" label={ct('code')} value={code} onChange={setCode} autoFocus code />
          <button type="submit" className="cf-primary" disabled={!code.replace(/[^A-Za-z0-9]/g, '')}>{ct('newPinNow')}</button>
          <button type="button" className="cf-link" onClick={() => { setMode('pin'); setMsg(''); }}>{ct('back')}</button>
        </>}
        {mode === 'newPin' && <>
          <PinField id="cf-new1" label={ct('pinNew')} value={p1} onChange={setP1} autoFocus />
          <PinField id="cf-new2" label={ct('pinAgain')} value={p2} onChange={setP2} />
          <button type="submit" className="cf-primary" disabled={busy || wait > 0 || !p1}>{busy ? '…' : ct('unlock')}</button>
          <button type="button" className="cf-link" onClick={() => { setMode('code'); setMsg(''); }}>{ct('back')}</button>
        </>}
        <p className="cf-msg" role="alert">{waitText || msg}</p>
      </form>
    </div>
  );
}

/** Mounted once: the panel and the note shown when a send is blocked. */
function ConfidentialHost() {
  const [, redraw] = useState(0);
  const [note, setNote] = useState('');
  useEffect(() => { const f = () => redraw(n => n + 1); panelListeners.add(f); return () => { panelListeners.delete(f); }; }, []);
  useEffect(() => onBlocked(b => setNote(ct('blockedNote', { host: b.host }))), []);
  useEffect(() => { if (!note) return; const id = window.setTimeout(() => setNote(''), 5000); return () => window.clearTimeout(id); }, [note]);
  return <>
    {note && <div className="cf-note" role="status" data-testid="cf-blocked">{note}</div>}
    {panelOpen && !confidentialLocked() && <Panel onClose={closePanel} />}
  </>;
}

const DELAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 45, 60, 90, 120];

function Panel({ onClose }: { onClose: () => void }) {
  useConfidential();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal?.(); }, []);
  const [code, setCode] = useState('');
  const on = confidentialOn();
  return (
    <dialog ref={ref} className="oi-dialog sh-panel cf-panel" onClose={onClose} onCancel={onClose} aria-labelledby="cf-title" translate="no">
      <div className="sh-card">
        <header><span className="sh-badge on" aria-hidden="true">🔒</span><h2 id="cf-title">{ct('title')}</h2>
          <button type="button" className="sh-x" aria-label="×" onClick={() => ref.current?.close()}>×</button></header>
        {code ? <CodeView code={code} onDone={() => setCode('')} />
          : on ? <OnView onOff={() => ref.current?.close()} /> : <SetUp onMade={setCode} />}
      </div>
    </dialog>
  );
}

function Explain() {
  return <>
    <p>{ct('intro')}</p>
    <ul className="cf-points">
      <li><span aria-hidden="true">📵</span>{ct('p1')}</li>
      <li><span aria-hidden="true">🔐</span>{ct('p2')}</li>
      <li><span aria-hidden="true">🕒</span>{ct('p3')}</li>
    </ul>
    <p className="sh-fine">{ct('limit')}</p>
  </>;
}

function SetUp({ onMade }: { onMade: (code: string) => void }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [minutes, setMinutes] = useState(5);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    const err = !pinOk(p1) ? ct('pinShort') : weakPin(p1) ? ct('pinWeak') : p1 !== p2 ? ct('pinDiffer') : '';
    if (err) { setMsg(err); return; }
    setBusy(true); setMsg(ct('working'));
    try { onMade(await turnOn(p1, minutes)); } catch (e) { setMsg(String((e as Error)?.message ?? e)); } finally { setBusy(false); }
  }
  return (
    <form className="sh-body" onSubmit={e => { e.preventDefault(); void go(); }}>
      <Explain />
      <PinField id="cf-set1" label={ct('pinNew')} value={p1} onChange={setP1} />
      <PinField id="cf-set2" label={ct('pinAgain')} value={p2} onChange={setP2} />
      <Delay value={minutes} onChange={setMinutes} />
      <div className="sh-row"><button type="submit" className="primary" disabled={busy || p1.length < PIN_MIN} data-testid="cf-turn-on">🔒 {ct('turnOn')}</button></div>
      <p className="cf-msg" role="alert">{msg}</p>
    </form>
  );
}

function Delay({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  return (
    <label className="cf-field">
      <span>{ct('lockAfter')}</span>
      <select value={value} onChange={e => onChange(Number(e.target.value))} data-testid="cf-delay">
        {DELAYS.map(m => <option key={m} value={m}>{ct('minutes', { n: m })}</option>)}
      </select>
    </label>
  );
}

function CodeView({ code, onDone }: { code: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="sh-body">
      <p className="sh-ok">✓ {ct('on')}</p>
      <h3 className="cf-h">{ct('codeTitle')}</h3>
      <p className="cf-code" data-testid="cf-code">{code}</p>
      <p>{ct('codeInfo')}</p>
      <div className="sh-row">
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(code).then(() => setCopied(true), () => {}); }}>{copied ? '✓' : ct('copy')}</button>
        <button type="button" className="primary" onClick={onDone} data-testid="cf-code-done">{ct('codeDone')}</button>
      </div>
    </div>
  );
}

type Tab = 'status' | 'journal' | 'set';

function OnView({ onOff }: { onOff: () => void }) {
  const [tab, setTab] = useState<Tab>('status');
  return <>
    <div className="sh-tabs" role="tablist">
      {(['status', 'journal', 'set'] as Tab[]).map(k => (
        <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-testid={`cf-tab-${k}`}>
          {ct(k === 'status' ? 'statusTab' : k === 'journal' ? 'journalTab' : 'setTab')}
        </button>
      ))}
    </div>
    {tab === 'status' && <Status />}
    {tab === 'journal' && <Journal />}
    {tab === 'set' && <Settings onOff={onOff} />}
  </>;
}

function Status() {
  const [counts, setCounts] = useState<{ sealed: number; plain: number } | null>(null);
  useEffect(() => { void sealedCounts().then(setCounts); }, []);
  const made = vaultMade();
  return (
    <div className="sh-body">
      <p className="sh-ok">✓ {ct('on')}</p>
      {made > 0 && <p className="sh-fine">{ct('since', { date: new Date(made).toLocaleString() })}</p>}
      {counts && <p data-testid="cf-counts">{ct('sealedInfo', { n: counts.sealed })}{counts.plain ? ` ${ct('plainInfo', { n: counts.plain })}` : ''}</p>}
      <Explain />
      <div className="sh-row"><button type="button" className="primary" onClick={() => lockNow()} data-testid="cf-lock-now">🔒 {ct('lockNow')}</button></div>
    </div>
  );
}

const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;

function Journal() {
  const [rows, setRows] = useState<JournalEntry[] | null>(null);
  useEffect(() => { const load = () => void readJournal().then(setRows); load(); return onJournal(load); }, []);
  const exportCsv = () => {
    const lines = [['date', 'action', 'detail'].join(','), ...(rows ?? []).map(r => [csvCell(new Date(r.t).toISOString()), csvCell(ct(`a.${r.a}`)), csvCell(r.d ?? '')].join(','))];
    downloadFile(`Office In 1 journal ${new Date().toISOString().slice(0, 10)}.csv`, `﻿${lines.join('\r\n')}`, 'text/csv');
  };
  return (
    <div className="sh-body">
      {!rows ? <p>…</p> : rows.length === 0 ? <p className="sh-fine">{ct('journalNone')}</p> : (
        <ul className="cf-journal" data-testid="cf-journal">
          {rows.slice(0, 500).map((r, i) => (
            <li key={i} className={r.a === 'badPin' || r.a === 'blocked' ? 'cf-bad' : ''}>
              <time dateTime={new Date(r.t).toISOString()}>{new Date(r.t).toLocaleString()}</time>
              <span>{ct(`a.${r.a}`)}{r.d ? ` : ${r.d}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="sh-row"><button type="button" disabled={!rows?.length} onClick={exportCsv}>{ct('journalExport')}</button></div>
    </div>
  );
}

function Settings({ onOff }: { onOff: () => void }) {
  const [minutes, setMinutes] = useState(lockMinutes());
  const [old, setOld] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [msg, setMsg] = useState('');
  const [offPin, setOffPin] = useState('');
  const [offMsg, setOffMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function change() {
    const err = !pinOk(p1) ? ct('pinShort') : weakPin(p1) ? ct('pinWeak') : p1 !== p2 ? ct('pinDiffer') : '';
    if (err) { setMsg(err); return; }
    setBusy(true);
    const ok = await changePin(old, p1);
    setBusy(false);
    if (!ok) { journal('badPin'); setMsg(ct('wrong')); return; }
    journal('pin');
    setOld(''); setP1(''); setP2(''); setMsg(ct('pinChanged'));
  }
  async function off() {
    setBusy(true); setOffMsg(ct('working'));
    const ok = await turnOff(offPin);
    setBusy(false);
    if (!ok) { setOffMsg(ct('wrong')); setOffPin(''); return; }
    onOff();
  }
  return (
    <div className="sh-body">
      <Delay value={minutes} onChange={m => { setMinutes(m); setLockMinutes(m); }} />
      <form className="cf-group" onSubmit={e => { e.preventDefault(); void change(); }}>
        <h3 className="cf-h">{ct('changePin')}</h3>
        <PinField id="cf-old" label={ct('pinOld')} value={old} onChange={setOld} />
        <PinField id="cf-p1" label={ct('pinNew')} value={p1} onChange={setP1} />
        <PinField id="cf-p2" label={ct('pinAgain')} value={p2} onChange={setP2} />
        <div className="sh-row"><button type="submit" disabled={busy || !old || !p1}>{ct('changePin')}</button></div>
        <p className="cf-msg" role="alert">{msg}</p>
      </form>
      <form className="cf-group" onSubmit={e => { e.preventDefault(); void off(); }}>
        <h3 className="cf-h">{ct('turnOff')}</h3>
        <p className="sh-fine">{ct('offConfirm')}</p>
        <PinField id="cf-off" label={ct('pin')} value={offPin} onChange={setOffPin} />
        <div className="sh-row"><button type="submit" className="sh-weak" disabled={busy || !offPin} data-testid="cf-turn-off">{ct('turnOff')}</button></div>
        <p className="cf-msg" role="alert">{offMsg}</p>
      </form>
    </div>
  );
}

/** The home button: opens the panel (turn on, or status when on). */
export function ConfidentialButton() {
  useConfidential();
  const on = confidentialOn();
  return (
    <button type="button" className={`glass-pill cf-home${on ? ' on' : ''}`} onClick={openConfidentialPanel} data-testid="cf-home" translate="no">
      🔒 <span>{ct('title')}</span>{on && <small>✓</small>}
    </button>
  );
}

/** In each app bar while the mode is on: a 🔒 that locks at once. */
export function ConfidentialBadge() {
  useConfidential();
  if (!confidentialOn()) return null;
  return (
    <button type="button" className="cf-badge" title={`${ct('on')} · ${ct('lockNow')}`} aria-label={`${ct('on')} · ${ct('lockNow')}`} onClick={() => lockNow()} data-testid="cf-badge">🔒</button>
  );
}
