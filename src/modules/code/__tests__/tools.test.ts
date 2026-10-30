import { describe, expect, it } from 'vitest';
import { RULES, applyFixes, lintFile, maskCode } from '../lint';
import { replaceInFiles, searchFiles } from '../search';
import { SNIPPETS } from '../snippets';
import { GITIGNORES, LICENSES, readme } from '../starters';
import { isTestFile, testPage, testTemplate } from '../tests';

const rules = (path: string, text: string) => lintFile(path, text).map(p => p.rule);

describe('Problems checker', () => {
  it('has at least 20 rules, each with a name and a reason', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(20);
    for (const r of RULES) { expect(r.name.fr).toBeTruthy(); expect(r.why.en).toBeTruthy(); }
  });
  it('finds a JavaScript syntax error with its line', () => {
    const [p] = lintFile('a.js', 'const a = 1;\nconst b = ;\n');
    expect(p.rule).toBe('syntax'); expect(p.line).toBe(2);
  });
  it('flags == but not ===, !==, => or text in strings', () => {
    expect(rules('a.js', 'if (a == b) x();\n').filter(r => r === 'eqeqeq')).toHaveLength(1);
    expect(rules('a.js', 'if (a === b && c !== d) f(() => 1);\nconst s = "a == b";\n')).not.toContain('eqeqeq');
  });
  it('fixes == to === and var to let', () => {
    const text = 'var a = 1;\nif (a == 1) a++;\n';
    const fixes = lintFile('a.js', text).filter(p => p.fix).map(p => p.fix!);
    expect(applyFixes(text, fixes)).toBe('let a = 1;\nif (a === 1) a++;\n');
  });
  it('finds secrets, innerHTML and eval', () => {
    const r = rules('a.js', 'const key = "sk-ant-abcdefghijklmnop";\nel.innerHTML = x;\neval(code);\n');
    expect(r).toEqual(expect.arrayContaining(['no-secrets', 'no-inner-html', 'no-eval']));
  });
  it('checks HTML for lang, alt, viewport and title, and fixes them', () => {
    const html = '<!doctype html>\n<html>\n<head>\n</head>\n<body><img src="a.png"></body>\n</html>\n';
    expect(rules('index.html', html)).toEqual(expect.arrayContaining(['html-lang', 'img-alt', 'html-viewport', 'html-title']));
    let fixed = html;
    for (let i = 0; i < 4; i++) fixed = applyFixes(fixed, lintFile('index.html', fixed).filter(p => p.fix).map(p => p.fix!));
    expect(rules('index.html', fixed)).toEqual([]);
  });
  it('checks Python and CSS', () => {
    expect(rules('a.py', 'try:\n    x()\nexcept:\n    pass\nif a == None:\n    pass\n')).toEqual(expect.arrayContaining(['py-bare-except', 'py-none']));
    expect(rules('a.css', 'a { color: red !important; font-size: 14px; }\n')).toEqual(expect.arrayContaining(['css-important', 'css-px-font']));
  });
  it('masks comments and strings but keeps offsets', () => {
    const src = 'a // b == c\n"x == y" + z';
    const m = maskCode(src, 'js');
    expect(m.length).toBe(src.length); expect(m).not.toContain('==');
  });
  it('accepts clean code', () => {
    expect(lintFile('a.js', 'export const add = (a, b) => a + b;\n')).toEqual([]);
  });
});

describe('Search in all files', () => {
  const files = { 'a.js': 'const total = 1;\nlet subtotal = 2;\n', 'b.css': 'a{}', 'img.png': 'data:image/png;base64,total' };
  it('finds matches with line and column, skipping images', () => {
    const m = searchFiles(files, 'total', { regex: false, caseSensitive: false, wholeWord: false });
    expect(m.map(x => [x.path, x.line, x.col])).toEqual([['a.js', 1, 7], ['a.js', 2, 8]]);
  });
  it('whole word and regex', () => {
    expect(searchFiles(files, 'total', { regex: false, caseSensitive: false, wholeWord: true })).toHaveLength(1);
    expect(searchFiles(files, '(sub)?total', { regex: true, caseSensitive: false, wholeWord: false })).toHaveLength(2);
    expect(searchFiles(files, '(', { regex: true, caseSensitive: false, wholeWord: false })).toEqual([]);
  });
  it('replaces everywhere, or in one file, with $1 for regex', () => {
    const r = replaceInFiles(files, '(sub)?total', '$1sum', { regex: true, caseSensitive: false, wholeWord: false });
    expect(r.count).toBe(2); expect(r.files['a.js']).toBe('const sum = 1;\nlet subsum = 2;\n');
    expect(r.files['img.png']).toBe(files['img.png']);
  });
});

describe('Snippets, tests and starter files', () => {
  it('has 20+ snippets for every language', () => {
    for (const [lang, list] of Object.entries(SNIPPETS)) expect(list.length, lang).toBeGreaterThanOrEqual(20);
  });
  it('has 20+ .gitignore templates and licenses', () => {
    expect(GITIGNORES.length).toBeGreaterThanOrEqual(20);
    expect(LICENSES.length).toBeGreaterThanOrEqual(20);
  });
  it('knows test files', () => {
    expect(isTestFile('src/a.test.js')).toBe(true);
    expect(isTestFile('tests/math.ts')).toBe(true);
    expect(isTestFile('src/a.js')).toBe(false);
  });
  it('makes a test file next to the code', () => {
    expect(testTemplate('src/math.ts').path).toBe('src/math.test.ts');
    expect(testTemplate('index.html').path).toBe('app.test.js');
    expect(testPage(['a.test.js'])).toContain('await import("./a.test.js")');
  });
  it('writes a README from the project', () => {
    const text = readme('Shop', { 'package.json': '{"description":"A shop","scripts":{"dev":"vite"}}', 'index.html': '' });
    expect(text).toContain('# Shop'); expect(text).toContain('npm run dev'); expect(text).toContain('A shop');
  });
});
