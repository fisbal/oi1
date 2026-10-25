// The languages Code+ colors and completes. Each one loads only when a file of that kind opens.

import { StreamLanguage, type LanguageSupport, type StreamParser } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { extOf } from './build';

const legacy = (p: Promise<StreamParser<unknown>>) => p.then(parser => StreamLanguage.define(parser));

const LOADERS: Record<string, () => Promise<LanguageSupport | Extension>> = {
  html: () => import('@codemirror/lang-html').then(m => m.html()),
  vue: () => import('@codemirror/lang-html').then(m => m.html()),
  svelte: () => import('@codemirror/lang-html').then(m => m.html()),
  css: () => import('@codemirror/lang-css').then(m => m.css()),
  scss: () => import('@codemirror/lang-css').then(m => m.css()),
  less: () => import('@codemirror/lang-css').then(m => m.css()),
  js: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  mjs: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  cjs: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  jsx: () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true })),
  ts: () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true })),
  mts: () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true })),
  tsx: () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true, typescript: true })),
  json: () => import('@codemirror/lang-json').then(m => m.json()),
  md: () => import('@codemirror/lang-markdown').then(m => m.markdown()),
  markdown: () => import('@codemirror/lang-markdown').then(m => m.markdown()),
  py: () => import('@codemirror/lang-python').then(m => m.python()),
  sql: () => import('@codemirror/lang-sql').then(m => m.sql()),
  xml: () => import('@codemirror/lang-xml').then(m => m.xml()),
  svg: () => import('@codemirror/lang-xml').then(m => m.xml()),
  yaml: () => import('@codemirror/lang-yaml').then(m => m.yaml()),
  yml: () => import('@codemirror/lang-yaml').then(m => m.yaml()),
  java: () => import('@codemirror/lang-java').then(m => m.java()),
  c: () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  h: () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  cpp: () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  hpp: () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  rs: () => import('@codemirror/lang-rust').then(m => m.rust()),
  go: () => import('@codemirror/lang-go').then(m => m.go()),
  php: () => import('@codemirror/lang-php').then(m => m.php()),
  dart: () => legacy(import('@codemirror/legacy-modes/mode/clike').then(m => m.dart)),
  kt: () => legacy(import('@codemirror/legacy-modes/mode/clike').then(m => m.kotlin)),
  cs: () => legacy(import('@codemirror/legacy-modes/mode/clike').then(m => m.csharp)),
  swift: () => legacy(import('@codemirror/legacy-modes/mode/swift').then(m => m.swift)),
  rb: () => legacy(import('@codemirror/legacy-modes/mode/ruby').then(m => m.ruby)),
  sh: () => legacy(import('@codemirror/legacy-modes/mode/shell').then(m => m.shell)),
  bash: () => legacy(import('@codemirror/legacy-modes/mode/shell').then(m => m.shell)),
  ps1: () => legacy(import('@codemirror/legacy-modes/mode/powershell').then(m => m.powerShell)),
  lua: () => legacy(import('@codemirror/legacy-modes/mode/lua').then(m => m.lua)),
  r: () => legacy(import('@codemirror/legacy-modes/mode/r').then(m => m.r)),
  toml: () => legacy(import('@codemirror/legacy-modes/mode/toml').then(m => m.toml)),
  dockerfile: () => legacy(import('@codemirror/legacy-modes/mode/dockerfile').then(m => m.dockerFile)),
};

/** The name shown in the status bar. */
const NAMES: Record<string, string> = {
  html: 'HTML', css: 'CSS', scss: 'SCSS', less: 'Less', js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript JSX',
  ts: 'TypeScript', mts: 'TypeScript', tsx: 'TypeScript JSX', json: 'JSON', md: 'Markdown', markdown: 'Markdown', py: 'Python', sql: 'SQL',
  xml: 'XML', svg: 'SVG', yaml: 'YAML', yml: 'YAML', java: 'Java', c: 'C', h: 'C', cpp: 'C++', hpp: 'C++', rs: 'Rust', go: 'Go', php: 'PHP',
  dart: 'Dart', kt: 'Kotlin', cs: 'C#', swift: 'Swift', rb: 'Ruby', sh: 'Shell', bash: 'Shell', ps1: 'PowerShell', lua: 'Lua', r: 'R',
  toml: 'TOML', dockerfile: 'Dockerfile', vue: 'Vue', svelte: 'Svelte', txt: 'Text',
};

const key = (path: string) => (/(^|\/)dockerfile$/i.test(path) ? 'dockerfile' : extOf(path));

export const languageName = (path: string) => NAMES[key(path)] ?? 'Text';

export function loadLanguage(path: string): Promise<LanguageSupport | Extension> | null {
  return LOADERS[key(path)]?.() ?? null;
}

/** File kinds Prettier can tidy, and the parser for each. */
const PARSERS: Record<string, string> = {
  html: 'html', vue: 'vue', css: 'css', scss: 'scss', less: 'less', js: 'babel', mjs: 'babel', cjs: 'babel', jsx: 'babel',
  ts: 'typescript', mts: 'typescript', tsx: 'typescript', json: 'json', md: 'markdown', markdown: 'markdown', yaml: 'yaml', yml: 'yaml',
};

export const canFormat = (path: string) => !!PARSERS[key(path)];

/** Tidies a file with Prettier, loaded the first time it is needed. */
export async function formatCode(path: string, code: string): Promise<string> {
  const parser = PARSERS[key(path)];
  if (!parser) return code;
  const [prettier, ...plugins] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/html'), import('prettier/plugins/postcss'), import('prettier/plugins/babel'),
    import('prettier/plugins/estree'), import('prettier/plugins/typescript'), import('prettier/plugins/markdown'), import('prettier/plugins/yaml'),
  ]);
  return prettier.format(code, { parser, plugins: plugins.map(p => (p as { default?: unknown }).default ?? p) as never[], singleQuote: true, printWidth: 100 });
}
