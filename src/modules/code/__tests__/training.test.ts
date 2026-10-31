import { describe, expect, it } from 'vitest';
import { compile } from '../build';
import { COURSES, dueReviews, exercisePath, record, shuffledLines, testFileFor, type Exercise } from '../training';
import { explainError, instrument } from '../stepper';

// Runs an exercise's code (with its exports as `m`) and its tests here, with Vitest's own expect.
async function check(e: Exercise, code: string): Promise<string[]> {
  const ext = e.file.split('.').pop()!;
  const fails: string[] = [];
  const tests: { name: string; fn: () => unknown }[] = [];
  const stack: string[] = [];
  const describe2 = (name: string, body: () => void) => { stack.push(name); try { body(); } finally { stack.pop(); } };
  const it2 = (name: string, fn: () => unknown) => tests.push({ name: [...stack, name].join(' › '), fn });
  let m: Record<string, unknown> = {};
  let html = '';
  let style: HTMLStyleElement | null = null;
  if (ext === 'html') html = code;
  else if (ext === 'css') { style = document.createElement('style'); style.textContent = code; document.head.append(style); }
  else {
    const js = compile(e.file, code);
    const names = [...js.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+(\w+)/g)].map(x => x[1]);
    const body = js.replace(/export\s+default\s+/g, 'const __default = ').replace(/export\s+(?=(async\s+)?(function|const|let|var|class))/g, '');
    m = await new Function(`return (async () => {\n${body}\nreturn { ${names.join(', ')} };\n})()`)();
  }
  new Function('m', 'html', 'describe', 'it', 'test', 'expect', e.tests)(m, html, describe2, it2, it2, expect);
  for (const t of tests) { try { await t.fn(); } catch (err) { fails.push(`${t.name}: ${(err as Error).message}`); } }
  style?.remove();
  if (!tests.length) fails.push('no test');
  return fails;
}

function printed(code: string): string {
  const out: string[] = [];
  const log = (...a: unknown[]) => out.push(a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));
  new Function('console', compile('p.js', code))({ log });
  return out.join('\n');
}

const all = COURSES.flatMap(c => c.exercises.map(e => ({ c, e })));

describe('Training', () => {
  it('has 20 or more courses of 3 or more exercises, every one with two hint levels', () => {
    expect(COURSES.length).toBeGreaterThanOrEqual(20);
    for (const c of COURSES) expect(c.exercises.length, c.id).toBeGreaterThanOrEqual(3);
    for (const { e } of all) expect(e.hints.length, e.id).toBeGreaterThanOrEqual(2);
    expect(new Set(all.map(x => x.e.id)).size).toBe(all.length);
    expect(new Set(all.map(x => exercisePath(x.c, x.e))).size).toBe(all.length);
  });

  for (const { c, e } of all) {
    // CSS needs a real layout engine: those are checked in the browser by scripts/check-training.mjs.
    if (e.file.endsWith('.css')) continue;
    if (e.kind === 'predict') {
      it(`${c.id}: “${e.title.en}” prints what the answer says`, () => expect(printed(e.starter)).toBe(e.solution));
      continue;
    }
    it(`${c.id}: “${e.title.en}” solution passes, starter does not`, async () => {
      expect(await check(e, e.solution)).toEqual([]);
      if (e.kind !== 'parsons') expect((await check(e, e.starter).catch(() => ['broken'])).length).toBeGreaterThan(0);
    });
  }

  it('shuffles Parsons lines into another order that holds the same lines', () => {
    for (const { e } of all.filter(x => x.e.kind === 'parsons')) {
      const lines = e.solution.split('\n').filter(l => l.trim());
      const mixed = shuffledLines(e);
      expect(mixed).not.toEqual(lines);
      expect([...mixed].sort()).toEqual([...lines].sort());
    }
  });

  it('writes the hidden test next to the exercise', () => {
    const { c, e } = all[0];
    const t = testFileFor(exercisePath(c, e), e);
    expect(t.path).toMatch(/^training\/js-basics\/.+\.check\.test\.js$/);
    expect(t.content).toContain("import * as m from './");
  });

  it('brings a missed exercise back tomorrow and a known one later and later', () => {
    const now = 1_000_000_000_000;
    let p = { done: {}, box: {}, due: {}, attempts: {} };
    p = record(p, 'e1', false, now);
    expect(dueReviews(p, now)).toEqual([]);
    expect(dueReviews(p, now + 86_400_000)).toEqual(['e1']);
    p = record(p, 'e1', true, now);
    expect(p.box).toEqual({ e1: 2 });
    expect(dueReviews(p, now + 2 * 86_400_000)).toEqual([]);
    expect(dueReviews(p, now + 3 * 86_400_000)).toEqual(['e1']);
  });
});

describe('Step-by-step simulation', () => {
  it('records each statement with the variables in reach', () => {
    const code = instrument('a.js', 'export function sum(n) {\n  let t = 0;\n  for (let i = 1; i <= n; i++) t += i;\n  return t;\n}\n', 'console.log(sum(2));');
    const steps: { line: number; vars: Record<string, unknown> }[] = [];
    const __s = (line: number, read: () => Record<string, unknown>) => steps.push({ line, vars: read() });
    const out: unknown[] = [];
    new Function('__s', 'console', code)(__s, { log: (x: unknown) => out.push(x) });
    expect(out).toEqual([3]);
    expect(steps.map(s => s.line)).toEqual([7, 2, 3, 3, 3, 4]);
    expect(steps[steps.length - 1].vars.t).toBe(3);
    expect(code).not.toMatch(/\bexport\b/);
  });
  it('explains common errors in plain words', () => {
    expect(explainError('total is not defined', 'fr')).toContain('« total »');
    expect(explainError("Cannot read properties of undefined (reading 'name')", 'en')).toContain('.name');
    expect(explainError('weird', 'en')).toBeNull();
  });
});
