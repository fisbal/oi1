import { describe, expect, it } from 'vitest';
import { HELPERS, applyFinding, localFindings, mergeFindings, pickFiles, toFindings, type Finding } from '../corrector';
import { bestVersion, changedFiles, diffLines, newVersion, restoreHunk } from '../versions';

describe('Master corrector', () => {
  it('turns fixable problems into findings with a before and an after', () => {
    const files = { 'a.js': 'var x = 1;\nif (x == 1) go();\n' };
    const f = localFindings(files, ['a.js'], new Set());
    expect(f.map(x => x.after)).toEqual(['let x = 1;\nif (x == 1) go();\n', 'var x = 1;\nif (x === 1) go();\n']);
  });
  it('applies a finding after another one changed the same file', () => {
    const files = { 'a.js': 'var x = 1;\nfoo();\nbar();\nif (x == 1) go();\n' };
    const [a, b] = localFindings(files, ['a.js'], new Set());
    const afterA = applyFinding(files['a.js'], a)!;
    expect(applyFinding(afterA, b)).toBe('let x = 1;\nfoo();\nbar();\nif (x === 1) go();\n');
  });
  it('applies two checker fixes on the same line one after the other', () => {
    const files = { 'p.html': '<a href="http://example.com" target="_blank">x</a>\n' };
    const list = localFindings(files, ['p.html'], new Set());
    let text = files['p.html'];
    for (const f of list) text = applyFinding(text, f) ?? text;
    expect(text).toBe('<a rel="noopener" href="https://example.com" target="_blank">x</a>\n');
  });
  it('says a finding is out of date when its lines are gone', () => {
    const [a] = localFindings({ 'a.js': 'var x = 1;\n' }, ['a.js'], new Set());
    expect(applyFinding('const y = 2;\n', a)).toBeNull();
  });
  it('keeps only AI fixes whose text is really in the file, once', () => {
    const files = { 'a.js': 'const a = 1;\nconst a2 = 1;\nreturn a / 0;\n' };
    const answer = JSON.stringify({ fixes: [
      { file: 'a.js', title: 'Division by zero', why: 'x', severity: 'error', find: 'a / 0', replace: 'a / 1' },
      { file: 'a.js', title: 'ambiguous', why: 'x', severity: 'warning', find: '= 1;', replace: '= 2;' },
      { file: 'nope.js', title: 'invented', why: 'x', severity: 'error', find: 'x', replace: 'y' },
    ] });
    const f = toFindings(`Here you go: ${answer}`, files, 'Claude');
    expect(f).toHaveLength(1); expect(f[0].line).toBe(3); expect(f[0].after).toContain('a / 1');
  });
  it('marks agreement when two AIs propose a fix at the same place', () => {
    const base: Finding = { id: '1', source: 'Claude', path: 'a.js', line: 10, title: 't', why: 'w', severity: 'warning', before: '', after: '' };
    const merged = mergeFindings([[base], [{ ...base, id: '2', source: 'Gemini', line: 11 }], [{ ...base, id: '3', source: 'local', line: 40, severity: 'error' }]]);
    expect(merged[0].agree).toEqual(['Gemini']); expect(merged).toHaveLength(2);
  });
  it('sends code files within the budget, smallest first', () => {
    const picked = pickFiles({ 'a.js': 'x', 'b.png': 'data:image/png;base64,AA', 'node_modules/x.js': 'y', 'big.js': 'z'.repeat(200_000) }, ['a.js', 'b.png', 'node_modules/x.js', 'big.js']);
    expect(Object.keys(picked)).toEqual(['a.js']);
  });
  it('offers 20+ AIs for a second opinion, local ones included', () => {
    expect(HELPERS.length).toBeGreaterThanOrEqual(20);
    expect(HELPERS.some(h => h.local)).toBe(true);
  });
});

describe('Versions', () => {
  it('finds the best version: most tests passing, then fewest problems', () => {
    const a = newVersion('a', {}, { passed: 3, failed: 1, errors: 0, warnings: 9 });
    const b = newVersion('b', {}, { passed: 4, failed: 0, errors: 2, warnings: 0 });
    const c = newVersion('c', {}, { passed: 4, failed: 0, errors: 0, warnings: 1 });
    expect(bestVersion([a, b, c])?.label).toBe('c');
  });
  it('diffs lines and puts one part back', () => {
    const old = 'a\nb\nc\nd\ne', now = 'a\nB\nc\nd\nE\nf';
    const hunks = diffLines(old, now);
    expect(hunks).toHaveLength(2);
    expect(restoreHunk(now, hunks[0])).toBe('a\nb\nc\nd\nE\nf');
    expect(changedFiles({ x: '1', y: '2' }, { x: '1', z: '3' })).toEqual(['y', 'z']);
  });
});
