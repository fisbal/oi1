// The shield's windows: the warning before a dangerous file or link, the quiet scam note, and the
// Protection panel (status, check a message or the open document, vaccines, settings).
import { useEffect, useRef, useState } from 'react';
import { aiFor } from '../ai';
import { st } from './strings';
import { worst, type Finding, type Level } from './scan';
import { checkText } from './scam';
import { linksIn } from './links';
import { antibodies, feedMeta, onAntibodies, refreshFeed, removeAntibody, type Antibody } from './feed';
import { closeNote, currentAsk, currentNote, inspectLink, onShield, pastedText, setScamText, setShieldSettings, setVaccineText, shieldSettings, shieldStats, startShield } from './guard';

const ICON: Record<Level, string> = { danger: '⛔', warn: '⚠', info: 'ℹ', ok: '✓' };
const levelName = (l: Level) => st(l === 'danger' ? 'levelDanger' : l === 'warn' ? 'levelWarn' : 'levelInfo');
const ISSUE_URL = 'https://github.com/fisbal/oi1/issues/new';

function useShield() {
  const [, redraw] = useState(0);
  useEffect(() => onShield(() => redraw(n => n + 1)), []);
  useEffect(() => onAntibodies(() => redraw(n => n + 1)), []);
}

let panelOpen = false;
let panelPrefill = '';
const panelListeners = new Set<() => void>();
export function openShieldPanel(prefill = '') { panelOpen = true; panelPrefill = prefill; panelListeners.forEach(f => f()); }
function closePanel() { panelOpen = false; panelListeners.forEach(f => f()); }

function FindingList({ findings }: { findings: Finding[] }) {
  return (
    <ul className="sh-findings">
      {findings.map((f, i) => (
        <li key={i} className={`sh-${f.level}`}><span aria-hidden="true">{ICON[f.level]}</span><span>{st(`f.${f.code}`, { d: f.detail ?? '' })}</span></li>
      ))}
    </ul>
  );
}

/** Mounted once by the shell: starts the shield and shows its windows. */
export function ShieldHost() {
  useShield();
  const [, redraw] = useState(0);
  useEffect(() => { panelListeners.add(() => redraw(n => n + 1)); }, []);
  useEffect(() => { setVaccineText(() => st('vaccMade')); setScamText(() => st('scamToast')); startShield(); }, []);
  const ask = currentAsk();
  const note = currentNote();
  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(closeNote, note.detail === 'paste' ? 9000 : 4000);
    return () => window.clearTimeout(id);
  }, [note]);
  return <>
    {ask && <AskDialog key={ask.kind + (ask.kind === 'file' ? ask.name : ask.url)} />}
    {note && (
      <div className="sh-note" role="status">
        {note.detail === 'paste'
          ? <button type="button" onClick={() => { closeNote(); openShieldPanel(pastedText()); }}>{note.text}</button>
          : <span>🛡 {note.text}</span>}
        <button type="button" className="sh-x" aria-label="×" onClick={closeNote}>×</button>
      </div>
    )}
    {panelOpen && <ShieldPanel prefill={panelPrefill} onClose={closePanel} />}
  </>;
}

function AskDialog() {
  const a = currentAsk()!;
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal?.(); }, []);
  const cancel = () => (a.kind === 'file' ? a.resolve('cancel') : a.resolve(false));
  const title = a.kind === 'file' ? st(a.level === 'danger' ? 'fileDanger' : 'fileWarn') : st(a.level === 'danger' ? 'linkDanger' : 'linkWarn');
  return (
    <dialog ref={ref} className="oi-dialog sh-dialog" onCancel={e => { e.preventDefault(); cancel(); }} aria-labelledby="sh-title">
      <div className={`sh-card sh-${a.level}`}>
        <header><span className="sh-badge" aria-hidden="true">🛡</span><h2 id="sh-title">{title}</h2></header>
        <p className="sh-what">{a.kind === 'file' ? a.name : a.url}</p>
        <FindingList findings={a.findings} />
        {a.kind === 'file' && <p className="sh-fine">{st('fileSafe')}</p>}
        <div className="sh-buttons">
          {a.kind === 'file' ? <>
            <button type="button" className="primary" autoFocus onClick={() => a.resolve('cancel')}>{st('dontOpen')}</button>
            {a.canClean && <button type="button" onClick={() => a.resolve('clean')}>{st('openClean')}</button>}
            <button type="button" className="sh-weak" onClick={() => a.resolve('open')}>{st('openAnyway')}</button>
          </> : <>
            <button type="button" className="primary" autoFocus onClick={() => a.resolve(false)}>{st('goBack')}</button>
            <button type="button" className="sh-weak" onClick={() => a.resolve(true)}>{st('goAnyway')}</button>
          </>}
        </div>
      </div>
    </dialog>
  );
}

type Tab = 'status' | 'check' | 'vacc' | 'set';

function ShieldPanel({ prefill, onClose }: { prefill: string; onClose: () => void }) {
  useShield();
  const [tab, setTab] = useState<Tab>(prefill ? 'check' : 'status');
  const [text, setText] = useState(prefill);
  const [result, setResult] = useState<{ level: Level; findings: Finding[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiText, setAiText] = useState('');
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal?.(); }, []);
  useEffect(() => { if (prefill) void analyse(prefill); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const meta = feedMeta();
  const s = shieldSettings();
  const stats = shieldStats();
  const abs = antibodies();

  async function analyse(input: string) {
    setBusy(true); setAiText('');
    const scam = checkText(input);
    const found: Finding[] = [...scam.findings];
    const urls = linksIn(input);
    if (!urls.length && /^\s*\S+\.\S+\s*$/.test(input)) urls.push(input.trim());
    for (const u of urls.slice(0, 20)) {
      const v = await inspectLink(u);
      for (const f of v.findings) found.push({ ...f, detail: f.detail ?? v.host });
    }
    setResult({ level: worst(found), findings: found });
    setBusy(false);
  }
  function docText(): string | null {
    const host = document.querySelector('.app-frame:not([hidden]) .module-host') as HTMLElement | null;
    if (!host) return null;
    const links = [...host.querySelectorAll('a[href]')].map(a => `${(a as HTMLAnchorElement).href}`).join('\n');
    return `${host.innerText.slice(0, 100_000)}\n${links}`;
  }
  async function askAi() {
    setBusy(true);
    try {
      const answer = await aiFor().ask({
        system: 'You are an anti-scam and anti-phishing expert. The user pasted a message or link they received. In the user\'s language, in 3 to 6 short lines: say if it is a scam, phishing or safe, the signs that show it, and what to do (never pay, never give codes, contact the organisation by its official number). Be factual; say when you are unsure.',
        messages: [{ role: 'user', content: text.slice(0, 8000) }],
        effort: 'low',
      });
      setAiText(answer.trim());
    } catch (e) { setAiText(String((e as Error)?.message ?? e)); } finally { setBusy(false); }
  }
  const shareUrl = (a: Antibody) => `${ISSUE_URL}?${new URLSearchParams({
    title: `Antidote: ${a.kind === 'host' ? a.key : `file ${a.key.slice(0, 12)}`}`,
    labels: 'antidote',
    body: `kind: ${a.kind}\nkey: ${a.key}\nsigns: ${a.codes.join(', ')}\n\n(Sent from the Office In 1 shield. Only the fingerprint or the site name is shared, never the document.)`,
  })}`;
  const date = meta?.updated ? new Date(meta.updated).toLocaleDateString() : '';

  return (
    <dialog ref={ref} className="oi-dialog sh-panel shield-zone" onClose={onClose} onCancel={onClose} aria-labelledby="sh-panel-title">
      <div className="sh-card">
        <header><span className="sh-badge on" aria-hidden="true">🛡</span><h2 id="sh-panel-title">{st('title')}</h2>
          <button type="button" className="sh-x" aria-label="×" onClick={() => ref.current?.close()}>×</button></header>
        <div className="sh-tabs" role="tablist">
          {(['status', 'check', 'vacc', 'set'] as Tab[]).map(k => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {st(k === 'status' ? 'statusTab' : k === 'check' ? 'checkTab' : k === 'vacc' ? 'vaccTab' : 'setTab')}
            </button>
          ))}
        </div>
        {tab === 'status' && <div className="sh-body">
          <p className="sh-ok">✓ {st('on')}</p>
          <p>{st('intro')}</p>
          <ul className="sh-stats">
            <li><b>{stats.files}</b> {st('statFiles')}</li>
            <li><b>{stats.links}</b> {st('statLinks')}</li>
            <li><b>{stats.blocked}</b> {st('statBlocked')}</li>
            <li><b>{abs.length}</b> {st('vaccTab').toLowerCase()}</li>
          </ul>
          <p><b>{st('list')}</b><br />{meta ? st('listInfo', { n: meta.count.toLocaleString(), date }) : st('listNone')}</p>
          <button type="button" disabled={busy} onClick={() => { setBusy(true); void refreshFeed(true).finally(() => setBusy(false)); }}>{st('update')}</button>
          <p className="sh-fine">{st('limits')}</p>
        </div>}
        {tab === 'check' && <div className="sh-body">
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder={st('pasteHere')} rows={5} />
          <div className="sh-row">
            <button type="button" className="primary" disabled={busy || !text.trim()} onClick={() => void analyse(text)}>{st('analyse')}</button>
            <button type="button" disabled={busy} onClick={() => { const d = docText(); if (d === null) { setResult(null); setAiText(st('noDoc')); return; } setText(d.slice(0, 4000)); void analyse(d); }}>{st('analyseDoc')}</button>
            <button type="button" disabled={busy || !text.trim()} onClick={() => void askAi()}>✦ {st('askAi')}</button>
          </div>
          {result && (result.findings.length
            ? <><p className={`sh-verdict sh-${result.level}`}>{ICON[result.level]} {levelName(result.level)}</p><FindingList findings={result.findings} /></>
            : <p className="sh-verdict sh-ok">✓ {st('clean')}</p>)}
          {aiText && <p className="sh-ai">{aiText}</p>}
        </div>}
        {tab === 'vacc' && <div className="sh-body">
          <p>{st('vaccIntro')}</p>
          {abs.length === 0 ? <p className="sh-fine">{st('vaccNone')}</p> : (
            <ul className="sh-vacc">
              {abs.slice(0, 200).map(a => (
                <li key={a.kind + a.key}>
                  <span className="sh-vname" title={a.key}>{a.kind === 'host' ? '🌐' : '📄'} {a.label}</span>
                  <small>{new Date(a.at).toLocaleDateString()}{a.shared ? ` · ${st('shared')}` : ''}</small>
                  {!a.shared && <a href={shareUrl(a)} target="_blank" rel="noopener noreferrer" title={st('shareHint')}>{st('share')}</a>}
                  <button type="button" onClick={() => removeAntibody(a.kind, a.key)}>{st('forget')}</button>
                </li>
              ))}
            </ul>
          )}
          <p className="sh-fine">{st('shareHint')}</p>
        </div>}
        {tab === 'set' && <div className="sh-body">
          {(['files', 'links', 'paste'] as const).map(k => (
            <label key={k} className="sh-switch">
              <input type="checkbox" role="switch" checked={s[k]} onChange={e => setShieldSettings({ [k]: e.target.checked })} />
              <span>{st(k)}</span>
            </label>
          ))}
          <p className="sh-fine">{st('limits')}</p>
        </div>}
      </div>
    </dialog>
  );
}

/** The 🛡 button (app bar and home). */
export function ShieldButton({ label }: { label?: boolean }) {
  useShield();
  return (
    <button type="button" className={`shield-btn${label ? ' glass-pill' : ''}`} title={st('title')} aria-label={st('title')} onClick={() => openShieldPanel()}>
      🛡{label && <span>{st('title')}</span>}
    </button>
  );
}
