// GitHub from the browser, with the GitHub REST API (it allows calls from web pages, unlike git itself).
// The user gives a personal access token once; it stays on this device only. A push is one commit
// with every file, made with the Git Data API (blobs, a tree, a commit, then the branch moves).

import { isBinary, mimeOf, type Files } from './build';

const API = 'https://api.github.com';
const SAVED = 'oi1.github';

export interface Account { token: string; login: string; name?: string; avatar?: string }
export interface RepoRef { owner: string; repo: string; branch: string }

export class GitHubError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** A page where the user makes a token with the right access, filled in already. */
export const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo,workflow&description=Office%20In%201%20Code%2B';

export function savedAccount(): Account | null {
  try { return JSON.parse(localStorage.getItem(SAVED) ?? 'null') as Account | null; } catch { return null; }
}
export function saveAccount(account: Account | null) {
  try {
    if (account) localStorage.setItem(SAVED, JSON.stringify(account));
    else localStorage.removeItem(SAVED);
  } catch { /* private window */ }
}

async function gh<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = res.statusText;
    try { message = ((await res.json()) as { message?: string }).message ?? message; } catch { /* not JSON */ }
    throw new GitHubError(res.status, message);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

/** Checks a token and returns who it belongs to. */
export async function signIn(token: string): Promise<Account> {
  const me = await gh<{ login: string; name?: string; avatar_url?: string }>(token, 'GET', '/user');
  return { token, login: me.login, name: me.name ?? undefined, avatar: me.avatar_url };
}

/** Makes the repository if it does not exist yet. Returns the default branch. */
export async function ensureRepo(token: string, owner: string, repo: string, isPrivate: boolean, login: string): Promise<string> {
  try {
    return (await gh<{ default_branch: string }>(token, 'GET', `/repos/${owner}/${repo}`)).default_branch;
  } catch (e) {
    if (!(e instanceof GitHubError) || e.status !== 404) throw e;
  }
  const where = owner.toLowerCase() === login.toLowerCase() ? '/user/repos' : `/orgs/${owner}/repos`;
  const made = await gh<{ default_branch: string }>(token, 'POST', where, {
    name: repo, private: isPrivate, auto_init: true, description: 'Made with Office Code+ (Office In 1)',
  });
  return made.default_branch || 'main';
}

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Runs `fn` over `items`, a few at a time. */
async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

async function headOf(token: string, { owner, repo, branch }: RepoRef): Promise<{ commit: string; tree: string } | null> {
  try {
    const ref = await gh<{ object: { sha: string } }>(token, 'GET', `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    const commit = await gh<{ tree: { sha: string } }>(token, 'GET', `/repos/${owner}/${repo}/git/commits/${ref.object.sha}`);
    return { commit: ref.object.sha, tree: commit.tree.sha };
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 404 || e.status === 409)) return null;
    throw e;
  }
}

/**
 * Makes the branch hold exactly these files, in one commit. Files not listed are removed.
 * Resolves to the new commit, or null when nothing changed.
 */
export async function push(token: string, ref: RepoRef, files: Files, message: string, onProgress?: (done: number, total: number) => void): Promise<string | null> {
  const { owner, repo, branch } = ref;
  let head = await headOf(token, ref);
  if (!head && branch !== 'gh-pages') {
    // An empty repository has no branch at all: the contents API can make the first commit.
    try {
      await gh(token, 'PUT', `/repos/${owner}/${repo}/contents/.gitkeep`, { message: 'Start', content: '', branch });
      head = await headOf(token, ref);
    } catch { /* the branch is made below */ }
  }
  const paths = Object.keys(files).sort();
  let done = 0;
  const blobs = await pool(paths, 4, async path => {
    const content = files[path];
    const body = isBinary(content)
      ? { content: content.slice(content.indexOf(',') + 1), encoding: 'base64' }
      : { content: toBase64(content), encoding: 'base64' };
    const blob = await gh<{ sha: string }>(token, 'POST', `/repos/${owner}/${repo}/git/blobs`, body);
    onProgress?.(++done, paths.length);
    return { path, mode: '100644', type: 'blob', sha: blob.sha };
  });
  const tree = await gh<{ sha: string }>(token, 'POST', `/repos/${owner}/${repo}/git/trees`, { tree: blobs });
  if (head && tree.sha === head.tree) return null;
  const commit = await gh<{ sha: string }>(token, 'POST', `/repos/${owner}/${repo}/git/commits`, {
    message, tree: tree.sha, parents: head ? [head.commit] : [],
  });
  if (head) await gh(token, 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: commit.sha, force: false });
  else await gh(token, 'POST', `/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
  return commit.sha;
}

const TEXT = /\.(html?|css|scss|less|m?[jt]sx?|cjs|json|md|markdown|txt|svg|xml|ya?ml|toml|py|sql|java|kt|dart|c|h|cpp|hpp|cs|rs|go|php|rb|sh|bash|ps1|lua|r|swift|vue|svelte|csv|env|gitignore|lock|cfg|ini|conf)$|(^|\/)(dockerfile|makefile|license|readme)$|^\.[a-z]+$/i;
const MAX = 2_000_000;

/** Reads every file on a branch. Files bigger than 2 MB are left out and listed in `skipped`. */
export async function pull(token: string, { owner, repo, branch }: RepoRef, onProgress?: (done: number, total: number) => void): Promise<{ files: Files; skipped: string[] }> {
  const tree = await gh<{ tree: { path: string; type: string; sha: string; size?: number }[]; truncated: boolean }>(
    token, 'GET', `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const blobs = tree.tree.filter(x => x.type === 'blob');
  const skipped = blobs.filter(x => (x.size ?? 0) > MAX).map(x => x.path);
  const wanted = blobs.filter(x => (x.size ?? 0) <= MAX);
  const files: Files = {};
  let done = 0;
  await pool(wanted, 4, async item => {
    const blob = await gh<{ content: string }>(token, 'GET', `/repos/${owner}/${repo}/git/blobs/${item.sha}`);
    const b64 = blob.content.replace(/\n/g, '');
    const name = item.path.split('/').pop() ?? '';
    if (TEXT.test(name)) {
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
      files[item.path] = new TextDecoder().decode(bytes);
    } else {
      files[item.path] = `data:${mimeOf(item.path)};base64,${b64}`;
    }
    onProgress?.(++done, wanted.length);
  });
  if (tree.truncated) skipped.push('…');
  return { files, skipped };
}

/** Turns on GitHub Pages for a branch and returns the site's address. */
export async function enablePages(token: string, owner: string, repo: string, branch: string): Promise<string> {
  const source = { branch, path: '/' };
  try {
    const site = await gh<{ html_url: string; source?: { branch: string } }>(token, 'GET', `/repos/${owner}/${repo}/pages`);
    if (site.source?.branch !== branch) await gh(token, 'PUT', `/repos/${owner}/${repo}/pages`, { source });
    return site.html_url;
  } catch (e) {
    if (!(e instanceof GitHubError) || e.status !== 404) throw e;
  }
  const site = await gh<{ html_url: string }>(token, 'POST', `/repos/${owner}/${repo}/pages`, { source });
  return site.html_url;
}

export const repoUrl = (r: { owner: string; repo: string }) => `https://github.com/${r.owner}/${r.repo}`;
export const pagesGuess = (r: { owner: string; repo: string }) =>
  r.repo.toLowerCase() === `${r.owner.toLowerCase()}.github.io` ? `https://${r.owner.toLowerCase()}.github.io/` : `https://${r.owner.toLowerCase()}.github.io/${r.repo}/`;
