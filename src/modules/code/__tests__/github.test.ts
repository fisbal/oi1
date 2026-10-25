import { afterEach, describe, expect, it, vi } from 'vitest';
import { pagesGuess, pull, push } from '../github';

type Call = { method: string; path: string; body?: Record<string, unknown> };

/** A fake GitHub API: answers by method and path, and records every call. */
function fakeGitHub(answers: Record<string, unknown>) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const path = url.replace('https://api.github.com', '');
    const method = init.method ?? 'GET';
    calls.push({ method, path, body: init.body ? JSON.parse(init.body as string) : undefined });
    const key = Object.keys(answers).find(k => `${method} ${path}`.startsWith(k));
    if (!key) return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    return new Response(JSON.stringify(answers[key]), { status: 200 });
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('Code+ GitHub', () => {
  it('pushes every file in one commit and moves the branch', async () => {
    let n = 0;
    const calls = fakeGitHub({
      'GET /repos/me/site/git/ref/heads/main': { object: { sha: 'c1' } },
      'GET /repos/me/site/git/commits/c1': { tree: { sha: 't0' } },
      'POST /repos/me/site/git/blobs': { get sha() { return `b${++n}`; } },
      'POST /repos/me/site/git/trees': { sha: 't1' },
      'POST /repos/me/site/git/commits': { sha: 'c2' },
      'PATCH /repos/me/site/git/refs/heads/main': {},
    });
    const sha = await push('tok', { owner: 'me', repo: 'site', branch: 'main' }, { 'index.html': '<h1>é</h1>', 'logo.png': 'data:image/png;base64,AAAA' }, 'Hello');
    expect(sha).toBe('c2');
    const blobs = calls.filter(c => c.path.endsWith('/git/blobs'));
    expect(blobs.map(b => b.body!.content)).toEqual(['PGgxPsOpPC9oMT4=', 'AAAA']);
    const tree = calls.find(c => c.path.endsWith('/git/trees'))!.body!.tree as { path: string }[];
    expect(tree.map(x => x.path)).toEqual(['index.html', 'logo.png']);
    expect(calls.find(c => c.method === 'POST' && c.path.endsWith('/git/commits'))!.body).toMatchObject({ message: 'Hello', tree: 't1', parents: ['c1'] });
    expect(calls.at(-1)).toMatchObject({ method: 'PATCH', body: { sha: 'c2' } });
  });

  it('makes a new branch for the website when there is none', async () => {
    const calls = fakeGitHub({
      'POST /repos/me/site/git/blobs': { sha: 'b1' },
      'POST /repos/me/site/git/trees': { sha: 't1' },
      'POST /repos/me/site/git/commits': { sha: 'c9' },
      'POST /repos/me/site/git/refs': {},
    });
    await push('tok', { owner: 'me', repo: 'site', branch: 'gh-pages' }, { 'index.html': 'x' }, 'Publish');
    expect(calls.at(-1)).toMatchObject({ method: 'POST', path: '/repos/me/site/git/refs', body: { ref: 'refs/heads/gh-pages', sha: 'c9' } });
  });

  it('pulls text and pictures', async () => {
    fakeGitHub({
      'GET /repos/me/site/git/trees/main': { truncated: false, tree: [
        { path: 'index.html', type: 'blob', sha: 's1', size: 10 }, { path: 'img/a.png', type: 'blob', sha: 's2', size: 3 }, { path: 'img', type: 'tree', sha: 's3' },
      ] },
      'GET /repos/me/site/git/blobs/s1': { content: 'PGgxPsOpPC9oMT4=\n' },
      'GET /repos/me/site/git/blobs/s2': { content: 'AAAA' },
    });
    const { files } = await pull('tok', { owner: 'me', repo: 'site', branch: 'main' });
    expect(files).toEqual({ 'index.html': '<h1>é</h1>', 'img/a.png': 'data:image/png;base64,AAAA' });
    expect(pagesGuess({ owner: 'Fisbal', repo: 'oi1' })).toBe('https://fisbal.github.io/oi1/');
  });
});
