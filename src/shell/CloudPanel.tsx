// "Save to the cloud" (Martin chose GitHub first, then Google Drive and OneDrive): connect once, then AutoSave
// writes every document to the person's own private repository, and documents saved there open from here.

import { useEffect, useState } from 'react';
import { savedAccount } from '../modules/code/github';
import { CLOUD_TOKEN_URL, DEFAULT_REPO, cloudAccount, cloudList, cloudOpen, cloudRepoUrl, cloudSettings, connectGitHub, disconnectCloud, onCloudChange, type CloudFile } from './cloud';
import { wrapFile } from './files';
import { t } from './i18n';
import type { OpenedFile } from './contract';

export function useCloud() {
  const [, redraw] = useState(0);
  useEffect(() => onCloudChange(() => redraw(n => n + 1)), []);
  return cloudAccount();
}

export function CloudPanel({ onOpen, onClose }: { onOpen: (f: OpenedFile) => void; onClose: () => void }) {
  const account = useCloud();
  const known = savedAccount();
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState(cloudSettings().repo || DEFAULT_REPO);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<CloudFile[] | null>(null);
  const login = account?.login;
  useEffect(() => {
    if (!login) return;
    let live = true;
    setFiles(null);
    cloudList().then(f => { if (live) setFiles(f); }, () => { if (live) setFiles([]); });
    return () => { live = false; };
  }, [login]);
  const connect = async (withToken: string) => {
    setBusy(true); setError('');
    try { await connectGitHub(withToken, repo); } catch (e) { setError(t('cloud.failed', { msg: String((e as Error)?.message ?? e) })); } finally { setBusy(false); }
  };
  const open = async (f: CloudFile) => {
    setBusy(true);
    try { onOpen(wrapFile(await cloudOpen(f.path))); onClose(); } catch (e) { setError(t('cloud.failed', { msg: String((e as Error)?.message ?? e) })); } finally { setBusy(false); }
  };
  return (
    <div className="cloud-panel" role="dialog" aria-label={t('cloud.title')} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="cloud-head"><b>☁ {t('cloud.title')}</b><button type="button" className="cloud-x" aria-label={t('letter.close')} onClick={onClose}>×</button></div>
      {account ? <>
        <p>{t('cloud.on', { where: 'GitHub' })} <a href={cloudRepoUrl()} target="_blank" rel="noreferrer">{account.login}/{cloudSettings().repo}</a> ({t('cloud.private')})</p>
        <span className="kicker">{t('cloud.openTitle')}</span>
        <ul className="cloud-files">
          {files === null && <li className="cloud-empty">…</li>}
          {files?.length === 0 && <li className="cloud-empty">{t('cloud.empty')}</li>}
          {files?.map(f => <li key={f.path}><button type="button" disabled={busy} onClick={() => void open(f)}>{f.name}<small>{Math.max(1, Math.round(f.size / 1024))} Ko</small></button></li>)}
        </ul>
        <button type="button" className="cloud-off" onClick={() => disconnectCloud()}>{t('cloud.disconnect')}</button>
      </> : <>
        <p>{t('cloud.why')}</p>
        <label className="cloud-field"><span>{t('cloud.repo')}</span><input value={repo} onChange={e => setRepo(e.target.value)} spellCheck={false} /></label>
        {known ? (
          <button type="button" className="primary" disabled={busy} onClick={() => void connect(known.token)}>{t('cloud.useAccount', { login: known.login })}</button>
        ) : <>
          <label className="cloud-field"><span>{t('cloud.token')}</span><input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_… / github_pat_…" autoComplete="off" spellCheck={false} /></label>
          <a href={CLOUD_TOKEN_URL} target="_blank" rel="noreferrer">{t('cloud.getToken')} ↗</a>
          <button type="button" className="primary" disabled={busy || !token.trim()} onClick={() => void connect(token)}>{t('cloud.connect')}</button>
        </>}
        <p className="cloud-fine">{t('cloud.soon')}</p>
      </>}
      {error && <p className="cloud-error" role="alert">{error}</p>}
    </div>
  );
}
