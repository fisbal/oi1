import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloudList, cloudOn, cloudOpen, cloudSave, connectGitHub, disconnectCloud, forgetCloudTab } from '../cloud';

/** A tiny GitHub: one user, repositories, files with shas. */
function fakeGitHub() {
  const repos = new Set<string>();
  const files = new Map<string, { content: string; sha: string }>();
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  let n = 0;
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const path = decodeURIComponent(url.pathname);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ method, path, body });
    const auth = new Headers(init?.headers).get('Authorization');
    if (auth !== 'Bearer tok') return json(401, { message: 'Bad credentials' });
    if (path === '/user') return json(200, { login: 'martin', name: 'Martin' });
    if (method === 'POST' && path === '/user/repos') { repos.add(String(body!.name)); return json(201, { default_branch: 'main' }); }
    const m = path.match(/^\/repos\/martin\/([^/]+)(?:\/contents\/(.*))?$/);
    if (!m || !repos.has(m[1])) return json(404, { message: 'Not Found' });
    if (m[2] === undefined) return json(200, { default_branch: 'main' });
    const file = m[2];
    if (method === 'GET' && file === '') return json(200, [{ type: 'file', name: 'README.md', path: 'README.md', size: 10, sha: 'r' }, ...[...files].map(([p, f]) => ({ type: 'file', name: p, path: p, size: f.content.length, sha: f.sha }))]);
    if (method === 'GET') {
      const f = files.get(file);
      if (!f) return json(404, { message: 'Not Found' });
      if (new Headers(init?.headers).get('Accept')?.includes('raw')) return new Response(atob(f.content));
      return json(200, { sha: f.sha });
    }
    if (method === 'PUT') {
      const now = files.get(file);
      if (now && body!.sha !== now.sha) return json(409, { message: 'sha does not match' });
      if (!now && body!.sha) return json(422, { message: 'sha wasn\'t supplied' });
      const sha = `s${++n}`;
      files.set(file, { content: String(body!.content), sha });
      return json(now ? 200 : 201, { content: { sha } });
    }
    return json(405, { message: 'no' });
  });
  return { repos, files, calls, fetchFn };
}

describe('Cloud (GitHub)', () => {
  let gh: ReturnType<typeof fakeGitHub>;
  beforeEach(() => { localStorage.clear(); gh = fakeGitHub(); vi.stubGlobal('fetch', gh.fetchFn); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('connects: checks the token, makes a private repository, turns the cloud on', async () => {
    expect(cloudOn()).toBe(false);
    const a = await connectGitHub(' tok ', 'my docs');
    expect(a.login).toBe('martin');
    expect(gh.repos.has('my-docs')).toBe(true);
    expect(gh.calls.find(c => c.method === 'POST')?.body).toMatchObject({ private: true });
    expect(cloudOn()).toBe(true);
    disconnectCloud();
    expect(cloudOn()).toBe(false);
  });

  it('refuses a wrong token and stays off', async () => {
    await expect(connectGitHub('nope')).rejects.toThrow(/Bad credentials/);
    expect(cloudOn()).toBe(false);
  });

  it('saves each document to its own file, then updates that same file', async () => {
    await connectGitHub('tok');
    const p1 = await cloudSave('tab1', 'Letter.docx', new Blob(['one']));
    const p2 = await cloudSave('tab2', 'Letter.docx', new Blob(['two']));
    expect(p1).toBe('Letter.docx');
    expect(p2).toBe('Letter (2).docx');
    await cloudSave('tab1', 'Letter.docx', new Blob(['one, again']));
    expect(atob(gh.files.get('Letter.docx')!.content)).toBe('one, again');
    expect(gh.files.size).toBe(2);
    expect(gh.calls.filter(c => c.method === 'PUT').every(c => String(c.body!.message).startsWith('AutoSave'))).toBe(true);
  });

  it('writes on top when the file changed on another device', async () => {
    await connectGitHub('tok');
    await cloudSave('tab1', 'Plan.xlsx', new Blob(['a']));
    gh.files.set('Plan.xlsx', { content: btoa('other device'), sha: 'elsewhere' });
    await cloudSave('tab1', 'Plan.xlsx', new Blob(['mine']));
    expect(atob(gh.files.get('Plan.xlsx')!.content)).toBe('mine');
  });

  it('lists documents (not the README) and opens one; that tab keeps writing to it', async () => {
    await connectGitHub('tok');
    await cloudSave('old', 'Deck.pptx', new Blob(['slides']));
    forgetCloudTab('old');
    const list = await cloudList();
    expect(list.map(f => f.name)).toEqual(['Deck.pptx']);
    const file = await cloudOpen('Deck.pptx');
    expect(await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsText(file); })).toBe('slides');
    expect(await cloudSave('new', file.name, new Blob(['slides v2']))).toBe('Deck.pptx');
    expect(gh.files.size).toBe(1);
  });

  it('does nothing when not connected', async () => {
    await expect(cloudSave('t', 'a.docx', new Blob(['x']))).rejects.toThrow();
    expect(gh.calls.length).toBe(0);
  });
});
