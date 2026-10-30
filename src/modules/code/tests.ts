// The test runner: finds the project's *.test.js / *.spec.ts files (or files in tests/), runs them in a hidden
// sandboxed page with describe / it / expect (the Jest and Vitest words), and returns one result per test.

import { buildPreview, extOf, type Files } from './build';

export interface TestResult { suite: string; name: string; ok: boolean; error?: string; ms: number; file?: string }
export interface TestRun { results: TestResult[]; errors: string[]; ms: number }

const TEST_FILE = /(\.(test|spec)\.(m?[jt]sx?)$)|((^|\/)(tests?|__tests__)\/.+\.(m?[jt]sx?)$)/i;
export const isTestFile = (path: string) => TEST_FILE.test(path);
export const testFiles = (files: Files) => Object.keys(files).filter(isTestFile).sort();

export const PAGE = '__oi1_tests__.html';

/** describe / it / expect, inside the test page. Kept small: the words people know from Jest, Vitest and Mocha. */
export const HARNESS = String.raw`(() => {
  const tests = []; const stack = []; const before = []; const after = [];
  let current = null;
  const fmt = v => { try { return typeof v === 'string' ? JSON.stringify(v) : v === undefined ? 'undefined' : typeof v === 'function' ? 'function' : JSON.stringify(v); } catch { return String(v); } };
  const eq = (a, b) => {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => eq(a[k], b[k]));
  };
  const matchers = (actual, not) => {
    const check = (pass, msg) => { if (pass === not) throw new Error((not ? 'Expected not: ' : '') + msg); };
    const m = {
      toBe: e => check(Object.is(actual, e), 'expected ' + fmt(actual) + ' to be ' + fmt(e)),
      toEqual: e => check(eq(actual, e), 'expected ' + fmt(actual) + ' to equal ' + fmt(e)),
      toStrictEqual: e => check(eq(actual, e), 'expected ' + fmt(actual) + ' to equal ' + fmt(e)),
      toBeTruthy: () => check(!!actual, 'expected ' + fmt(actual) + ' to be truthy'),
      toBeFalsy: () => check(!actual, 'expected ' + fmt(actual) + ' to be falsy'),
      toBeNull: () => check(actual === null, 'expected ' + fmt(actual) + ' to be null'),
      toBeUndefined: () => check(actual === undefined, 'expected ' + fmt(actual) + ' to be undefined'),
      toBeDefined: () => check(actual !== undefined, 'expected a value'),
      toBeNaN: () => check(Number.isNaN(actual), 'expected NaN, got ' + fmt(actual)),
      toContain: e => check(actual != null && actual.includes(e), 'expected ' + fmt(actual) + ' to contain ' + fmt(e)),
      toHaveLength: n => check(actual != null && actual.length === n, 'expected length ' + n + ', got ' + (actual && actual.length)),
      toHaveProperty: k => check(actual != null && k in Object(actual), 'expected property ' + fmt(k)),
      toMatch: re => check(typeof re === 'string' ? String(actual).includes(re) : re.test(String(actual)), 'expected ' + fmt(actual) + ' to match ' + re),
      toBeGreaterThan: n => check(actual > n, 'expected ' + fmt(actual) + ' > ' + n),
      toBeGreaterThanOrEqual: n => check(actual >= n, 'expected ' + fmt(actual) + ' >= ' + n),
      toBeLessThan: n => check(actual < n, 'expected ' + fmt(actual) + ' < ' + n),
      toBeLessThanOrEqual: n => check(actual <= n, 'expected ' + fmt(actual) + ' <= ' + n),
      toBeCloseTo: (n, d = 2) => check(Math.abs(actual - n) < Math.pow(10, -d) / 2, 'expected ' + fmt(actual) + ' to be close to ' + n),
      toBeInstanceOf: C => check(actual instanceof C, 'expected an instance of ' + (C && C.name)),
      toThrow: e => { let threw = false, err; try { actual(); } catch (x) { threw = true; err = x; }
        check(threw && (e === undefined || (typeof e === 'string' ? String(err && err.message).includes(e) : e instanceof RegExp ? e.test(String(err && err.message)) : err instanceof e)), 'expected the function to throw' + (e ? ' ' + e : '')); },
    };
    return m;
  };
  window.expect = actual => {
    const m = matchers(actual, false); m.not = matchers(actual, true);
    m.resolves = new Proxy({}, { get: (_, k) => async (...a) => matchers(await actual, false)[k](...a) });
    m.rejects = new Proxy({}, { get: (_, k) => async (...a) => { try { await actual; } catch (e) { return matchers(() => { throw e; }, false)[k](...a); } throw new Error('expected a rejection'); } });
    return m;
  };
  window.describe = (name, fn) => { stack.push(name); try { fn(); } finally { stack.pop(); } };
  window.it = window.test = (name, fn) => tests.push({ suite: stack.join(' › '), name, fn, file: current });
  window.it.skip = window.test.skip = () => {}; window.describe.skip = () => {};
  window.beforeEach = fn => before.push(fn); window.afterEach = fn => after.push(fn);
  window.__oi1file = f => { current = f; };
  window.__oi1fail = (f, e) => errors.push(f + ': ' + String(e && e.message || e));
  const errors = [];
  addEventListener('error', e => errors.push(String(e.message)));
  addEventListener('unhandledrejection', e => errors.push(String(e.reason && e.reason.message || e.reason)));
  window.__oi1run = async () => {
    const results = []; const t0 = performance.now();
    for (const t of tests) {
      const s = performance.now();
      try {
        for (const b of before) await b();
        await Promise.race([t.fn(), new Promise((_, no) => setTimeout(() => no(new Error('Timed out after 5 s')), 5000))]);
        for (const a of after) await a();
        results.push({ suite: t.suite, name: t.name, ok: true, ms: Math.round(performance.now() - s), file: t.file });
      } catch (e) {
        results.push({ suite: t.suite, name: t.name, ok: false, error: String(e && e.message || e), ms: Math.round(performance.now() - s), file: t.file });
      }
    }
    parent.postMessage({ oi1tests: { results, errors, ms: Math.round(performance.now() - t0) } }, '*');
  };
})();`;

/** The page that loads every test file, one after the other (a broken file is reported, the others still run), then runs them. */
export function testPage(paths: string[]): string {
  const loads = paths.map(p => `__oi1file(${JSON.stringify(p)}); try { await import(${JSON.stringify('./' + p)}); } catch (e) { __oi1fail(${JSON.stringify(p)}, e); }`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><script>${HARNESS}</script></head><body>
<script type="module">
${loads}
__oi1run();
</script>
</body></html>`;
}

/** Runs the tests in a hidden iframe and waits for its results (20 s at most). */
export async function runTests(files: Files, only?: string[]): Promise<TestRun> {
  const paths = only ?? testFiles(files);
  if (!paths.length) return { results: [], errors: [], ms: 0 };
  const built = await buildPreview({ ...files, [PAGE]: testPage(paths) }, PAGE);
  const buildErrors = built.errors.map(e => `${e.path}${e.line ? `:${e.line}` : ''} ${e.message}`);
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:0;border:0;opacity:0';
  frame.title = 'tests';
  return new Promise(resolve => {
    const done = (run: TestRun) => { window.removeEventListener('message', onMessage); clearTimeout(timer); frame.remove(); resolve(run); };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || !e.data?.oi1tests) return;
      const r = e.data.oi1tests as TestRun;
      done({ results: r.results, errors: [...buildErrors, ...r.errors], ms: r.ms });
    };
    const timer = window.setTimeout(() => done({ results: [], errors: [...buildErrors, 'Timed out after 20 s'], ms: 20000 }), 20000);
    window.addEventListener('message', onMessage);
    frame.srcdoc = built.html;
    document.body.append(frame);
  });
}

/** A first test file for `path` (the file being edited), in the same language. */
export function testTemplate(path: string): { path: string; content: string } {
  const ext = /^(ts|tsx|mts)$/.test(extOf(path)) ? 'ts' : 'js';
  const base = /\.(m?[jt]sx?)$/.test(path) ? path.replace(/\.[^./]+$/, '') : 'app';
  const name = base.split('/').pop() || 'app';
  const content = `// Tests for ${name}. Import what you want to check, for example:
// import { add } from './${name}.${/\.(m?[jt]sx?)$/.test(path) ? extOf(path) : 'js'}';

describe('${name}', () => {
  it('adds numbers', () => {
    expect(1 + 2).toBe(3);
  });

  it('compares objects', () => {
    expect({ a: 1, b: [2] }).toEqual({ a: 1, b: [2] });
  });
});
`;
  return { path: `${base}.test.${ext}`, content };
}
