// AutoSave to the cloud (Martin, 2026-10-31: "enregistrement auto sur l'appareil ou cloud"). First GitHub:
// the person's documents go to a private repository of their own, each save one commit, so every earlier
// version stays in its history. Google Drive and OneDrive come next, behind the same three calls.
// The token is the one Office Code+ already uses (one sign-in for both), kept on this device only.

import { GitHubError, TOKEN_URL, ensureRepo, savedAccount, saveAccount, signIn, type Account } from '../modules/code/github';
import { store } from './storage';

const API = 'https://api.github.com';
const SETTINGS = 'cloud';
const PATHS = 'cloud.paths';
export const DEFAULT_REPO = 'office-in-1-docs';
export const CLOUD_TOKEN_URL = TOKEN_URL.replace('scopes=repo,workflow', 'scopes=repo').replace('Code%2B', 'documents');

export interface CloudSettings { provider: 'none' | 'github'; repo: string }
export interface CloudFile { name: string; path: string; size: number }

export function cloudSettings(): CloudSettings {
  try {
    const s = JSON.parse(store.get(SETTINGS) ?? 'null') as Partial<CloudSettings> | null;
    return { provider: s?.provider === 'github' ? 'github' : 'none', repo: s?.repo || DEFAULT_REPO };
  } catch { return { provider: 'none', repo: DEFAULT_REPO }; }
}
const listeners = new Set<() => void>();
export function onCloudChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function setSettings(s: CloudSettings) { store.set(SETTINGS, JSON.stringify(s)); for (const fn of listeners) fn(); }

/** Who is signed in, when the cloud is on. */
export function cloudAccount(): Account | null {
  return cloudSettings().provider === 'github' ? savedAccount() : null;
}
export const cloudOn = () => !!cloudAccount();
export const cloudName = () => (cloudOn() ? 'GitHub' : '');
export const cloudRepoUrl = () => { const a = cloudAccount(); return a ? `https://github.com/${a.login}/${cloudSettings().repo}` : ''; };

/** Checks the token, makes the private repository if needed, and turns the cloud on. */
export async function connectGitHub(token: string, repo = DEFAULT_REPO): Promise<Account> {
  const account = await signIn(token.trim());
  const name = repo.trim().replace(/[^\w.-]+/g, '-') || DEFAULT_REPO;
  await ensureRepo(account.token, account.login, name, true, account.login);
  saveAccount(account);
  setSettings({ provider: 'github', repo: name });
  return account;
}

/** Back to the device only. The documents already in the cloud stay there; the token stays for Code+. */
export function disconnectCloud() { setSettings({ ...cloudSettings(), provider: 'none' }); }

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const a = cloudAccount();
  if (!a) throw new GitHubError(401, 'Not connected');
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${a.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = res.statusText;
    try { message = ((await res.json()) as { message?: string }).message ?? message; } catch { /* not JSON */ }
    throw new GitHubError(res.status, message);
  }
  return (await res.json()) as T;
}
const repoPath = () => `/repos/${cloudAccount()!.login}/${cloudSettings().repo}`;
const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/');

async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Which cloud file each open document writes to, so two "Untitled letter.docx" never overwrite each other.
const shas = new Map<string, string>();
function paths(): Record<string, string> { try { return JSON.parse(store.get(PATHS) ?? '{}') as Record<string, string>; } catch { return {}; } }
function setPath(key: string, path: string | null) { const p = paths(); if (path) p[key] = path; else delete p[key]; store.set(PATHS, JSON.stringify(p)); }
/** Files just opened from the cloud, by name: the tab that opens one keeps writing to it. */
const opened = new Map<string, string>();

async function shaOf(path: string): Promise<string | null> {
  try { return (await call<{ sha: string }>('GET', `${repoPath()}/contents/${enc(path)}`)).sha; } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

/** A free name in the repository: "Report.docx", then "Report (2).docx" … */
async function freePath(name: string): Promise<string> {
  const taken = new Set((await cloudList().catch(() => [])).map(f => f.path.toLowerCase()));
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 1; ; n++) {
    const p = n === 1 ? name : `${base} (${n})${ext}`;
    if (!taken.has(p.toLowerCase())) return p;
  }
}

/**
 * Writes the document to the cloud as one commit. `key` names the open document (its tab), so its first save
 * picks a free name and later saves update that same file. Gives the file's path in the repository.
 */
export async function cloudSave(key: string, name: string, blob: Blob): Promise<string> {
  const clean = name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Document';
  let path = paths()[key];
  if (!path) {
    path = opened.get(clean) ?? await freePath(clean);
    opened.delete(clean);
    setPath(key, path);
  }
  const content = await base64(blob);
  const put = async (sha: string | null) => call<{ content: { sha: string } }>('PUT', `${repoPath()}/contents/${enc(path!)}`, {
    message: `AutoSave: ${path}`, content, ...(sha ? { sha } : {}),
  });
  let sha = shas.get(path) ?? await shaOf(path);
  let done: { content: { sha: string } };
  try {
    done = await put(sha);
  } catch (e) {
    // Changed elsewhere since (another device): take its version as the base and write ours on top.
    if (!(e instanceof GitHubError) || (e.status !== 409 && e.status !== 422)) throw e;
    sha = await shaOf(path);
    done = await put(sha);
  }
  shas.set(path, done.content.sha);
  return path;
}

/** The documents in the cloud. */
export async function cloudList(): Promise<CloudFile[]> {
  try {
    const items = await call<{ type: string; name: string; path: string; size: number; sha: string }[]>('GET', `${repoPath()}/contents/`);
    return items.filter(i => i.type === 'file' && !/^(readme\.md|\.gitignore|license)$/i.test(i.name))
      .map(i => { shas.set(i.path, i.sha); return { name: i.name, path: i.path, size: i.size }; });
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 404 || e.status === 409)) return []; // empty repository
    throw e;
  }
}

/** Downloads a cloud document; the tab that opens it keeps saving to the same file. */
export async function cloudOpen(path: string): Promise<File> {
  const a = cloudAccount();
  if (!a) throw new GitHubError(401, 'Not connected');
  const res = await fetch(`${API}${repoPath()}/contents/${enc(path)}`, {
    headers: { Authorization: `Bearer ${a.token}`, Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new GitHubError(res.status, res.statusText);
  const name = path.split('/').pop()!;
  opened.set(name, path);
  return new File([await res.blob()], name);
}

/** When a tab closes, its link to a cloud file goes too. */
export function forgetCloudTab(key: string) { setPath(key, null); }
