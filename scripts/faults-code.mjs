// The fault detector, part 1: reads the source code of Office In 1 and finds what is malformed or likely to break
// (Martin, 2026-11-03: "un détecteur qui vérifie le code source et détecte toute malformation ou potentiel problème").
// Each rule comes from a real mistake met before (see the lessons in the project memory) or a classic web risk.
// No browser, a few seconds. Writes screens/faults-code.json and prints the findings, most serious first.
//   node scripts/faults-code.mjs            (exit 1 when an error is found; warnings and notes never fail)
// Severity: error = broken or unsafe now; warn = likely to break or confuse a person; note = to tidy.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const findings = [];
const add = (severity, rule, where, what) => findings.push({ severity, rule, where, what });

const walk = (dir, out = []) => {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f.startsWith('.')) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const src = walk(join(ROOT, 'src'));
const code = src.filter(f => /\.(tsx?|jsx?)$/.test(f) && !/__tests__|\.test\./.test(f));
const read = f => readFileSync(f, 'utf8');
const rel = f => relative(ROOT, f);
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
// A line (or the line above it) can say why a finding is fine: // faults-ok: <reason>. A whole file of example code
// (Code+ templates, lessons) says so once: // faults-ok-file: <reason>.
const allowed = (text, index) => {
  if (/faults-ok-file:/.test(text)) return true;
  const lines = text.split('\n'), n = lineOf(text, index) - 1;
  return /faults-ok:/.test(lines[n] ?? '') || /faults-ok:/.test(lines[n - 1] ?? '');
};

// 1. TypeScript: the whole app must type-check (a type error is a bug waiting for a person to click).
try { execSync('npx tsc --noEmit -p .', { stdio: 'pipe' }); }
catch (e) {
  const out = String(e.stdout || '') + String(e.stderr || '');
  for (const l of out.split('\n').filter(x => /error TS\d+/.test(x)).slice(0, 50)) add('error', 'types', l.split('(')[0], l.replace(/^[^:]+:\s*/, ''));
}

// 2. Translations: a French, Spanish, Portuguese or German text left in English (the person sees English).
{
  const i18n = read(join(ROOT, 'src/shell/i18n.ts'));
  const block = name => {
    const a = i18n.indexOf(`const ${name}`);
    const b = i18n.indexOf('\n};', a);
    const map = new Map();
    for (const m of i18n.slice(a, b).matchAll(/^\s*'([^']+)':\s*(['"`])((?:\\.|(?!\2).)*)\2,?\s*$/gm)) map.set(m[1], m[3]);
    return map;
  };
  const en = block('en');
  // Same in every language by nature: brand names, units, codes, formulas, single words like "Excel".
  const SAME_OK = /^(?:.*\(\.[a-z0-9]{2,5}\).*|[\d\s.,:;%+\-–×x/()#@&*|<>=…]*|[A-Z0-9_.+-]{1,6}|.*\b(?:In 1|Office|PDF|URL|HTML|CSS|JSON|ZIP|XLSX|DOCX|PPTX|CSV|API|IA|AI|Wi-Fi|OK|QR|SVG|PNG|JPEG|Ctrl|Alt|Shift|Esc|ID|MLA|APA|IEEE|ISO|Harvard|Chicago|Vancouver|McGill|OSCOLA|Bluebook|AMA|ACS|CSE|ASA|Word|Excel|PowerPoint|Markdown|snake_case|kebab-case|camelCase|PascalCase|Legal|Tabloid|Ledger|Whisper|Claude|ChatGPT|Gemini|GitHub|Google|OneDrive|Puter|Ollama|Mistral|DeepSeek|Copilot|LanguageTool|Hunspell)\b.*)$/;
  for (const lang of ['fr', 'es', 'pt', 'de']) {
    const m = block(lang);
    let same = [];
    for (const [k, v] of en) {
      const w = m.get(k);
      if (w === undefined) continue; // a missing key is a type error (rule 1)
      const words = v.replace(/\{[^}]+\}/g, '').match(/\p{L}{2,}/gu) ?? [];
      if (w === v && words.length >= 2 && /[a-z]{3}/.test(v) && !SAME_OK.test(v)) same.push(k);
    }
    for (const k of same.slice(0, 40)) add('warn', 'untranslated', `src/shell/i18n.ts (${lang})`, `"${k}" is still in English: ${JSON.stringify(en.get(k)).slice(0, 80)}`);
    if (same.length > 40) add('warn', 'untranslated', `src/shell/i18n.ts (${lang})`, `${same.length - 40} more texts still in English`);
  }
  // Keys used in the code that do not exist (written as t('…') with a typo; TypeScript misses dynamic ones).
  const used = new Set();
  for (const f of code) for (const mm of read(f).matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) used.add(mm[1]);
  for (const k of used) if (!en.has(k)) add('error', 'missing-text', 'src', `t('${k}') has no text in src/shell/i18n.ts`);
}

// 3. Buttons that do nothing: a <button> with no onClick, no type="submit" and no {...props} passing one.
for (const f of code.filter(x => x.endsWith('.tsx'))) {
  const t = read(f);
  for (const m of t.matchAll(/<button\b/g)) {
    let i = m.index + 7, depth = 0;
    for (; i < t.length; i++) {
      const c = t[i];
      if (c === '{') depth++; else if (c === '}') depth--; else if (c === '>' && depth === 0) break;
    }
    const tag = t.slice(m.index, i + 1);
    if (allowed(t, m.index)) continue;
    if (/\bonClick\b|\bonPointerDown\b|\bonMouseDown\b|\bonPointerUp\b|type=["']submit["']|\{\s*\.\.\.|\bform=|\bdisabled\b|\bonKeyDown\b|\bonTouchStart\b/.test(tag)) continue;
    add('warn', 'button-no-action', `${rel(f)}:${lineOf(t, m.index)}`, `a button that does nothing when pressed: ${tag.replace(/\s+/g, ' ').slice(0, 90)}`);
  }
}

// 4. Unsafe code: HTML written straight into the page (CodeQL high, lesson #56 / printWindow).
const UNSAFE = [
  [/\bdocument\.write\s*\(/g, 'error', 'document.write: use src/shell/printWindow.ts'],
  [/\beval\s*\(|new Function\s*\(/g, 'error', 'eval / new Function runs text as code'],
  [/dangerouslySetInnerHTML=\{\{\s*__html:(?!\s*(?:safeHtml\(|sanitize|DOMPurify|clean\b|safe\b|paperSvg\(|shapeSvg\(|`<rect[^`]*\$\{paperSvg\())/g, 'warn', 'HTML put in the page without safeHtml()'],
  [/\.innerHTML\s*=(?!=)(?!\s*(?:''|""|``|safeHtml\(|DOMPurify|sanitize|clean\b|safe\b))/g, 'warn', 'innerHTML set without safeHtml()'],
];
for (const f of code) {
  const t = read(f);
  for (const [re, sev, what] of UNSAFE) for (const m of t.matchAll(re)) if (!allowed(t, m.index)) add(sev, 'unsafe', `${rel(f)}:${lineOf(t, m.index)}`, what);
  for (const m of t.matchAll(/^\s*console\.log\(/gm)) add('note', 'console-log', `${rel(f)}:${lineOf(t, m.index)}`, 'a console.log left in the app');
  for (const m of t.matchAll(/\b(?:TODO|FIXME|XXX|HACK)\b[^\n]*/g)) add('note', 'todo', `${rel(f)}:${lineOf(t, m.index)}`, m[0].slice(0, 90));
}

// 5. File names that differ only by capitals: they collide on Mac and Windows (WhatIf.tsx vs whatif.ts).
{
  const seen = new Map();
  for (const f of src) {
    const k = f.toLowerCase().replace(/\.(tsx?|jsx?)$/, '');
    if (seen.has(k) && seen.get(k) !== f) add('error', 'case-clash', rel(f), `same name as ${rel(seen.get(k))} on Mac and Windows`);
    seen.set(k, f);
  }
}

// 6. One app's CSS class used in another app: apps load one by one, so the look is missing there (lesson: .dr-note).
{
  const modules = readdirSync(join(ROOT, 'src/modules')).filter(d => statSync(join(ROOT, 'src/modules', d)).isDirectory());
  const owner = new Map(); // class -> module that styles it
  const shared = new Set();
  const classesIn = css => [...css.matchAll(/\.([a-zA-Z][\w-]{2,})/g)].map(m => m[1]);
  for (const f of src.filter(x => x.endsWith('.css'))) {
    const mod = /src[\\/]modules[\\/]([^\\/]+)/.exec(f)?.[1];
    for (const c of classesIn(read(f))) {
      if (!mod) shared.add(c);
      else if (!owner.has(c)) owner.set(c, mod); else if (owner.get(c) !== mod) owner.set(c, '*');
    }
  }
  for (const f of code.filter(x => x.endsWith('.tsx'))) {
    const mod = /src[\\/]modules[\\/]([^\\/]+)/.exec(f)?.[1];
    if (!mod) continue;
    const t = read(f);
    const reported = new Set();
    for (const m of t.matchAll(/className=(?:"([^"]+)"|\{`([^`]+)`\}|\{'([^']+)'\})/g)) {
      for (const c of (m[1] ?? m[2] ?? m[3]).split(/\s+/)) {
        const o = owner.get(c);
        if (o && o !== '*' && o !== mod && !shared.has(c) && modules.includes(o) && !reported.has(c) && !allowed(t, m.index)) {
          reported.add(c);
          add('warn', 'css-other-app', `${rel(f)}:${lineOf(t, m.index)}`, `class "${c}" is styled only in the ${o} app's CSS: it looks broken when ${o} was not opened first (move it to src/ui/kit.css)`);
        }
      }
    }
  }
}

// 7. The checks themselves: each npm check exists, has its own port, and runs in CI with FULL_CHECKS (lesson #71).
{
  const pkg = JSON.parse(read(join(ROOT, 'package.json')));
  const yml = existsSync(join(ROOT, '.github/workflows/build.yml')) ? read(join(ROOT, '.github/workflows/build.yml')) : '';
  const ports = new Map();
  for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
    const file = /node (scripts\/\S+\.mjs)/.exec(cmd)?.[1];
    if (!file) continue;
    if (!existsSync(join(ROOT, file))) { add('error', 'checks', 'package.json', `"${name}" runs ${file}, which does not exist`); continue; }
    const t = read(join(ROOT, file));
    const port = /PORT\)?\s*(?:\|\||=)\s*(\d{4})/.exec(t)?.[1];
    if (port) { if (ports.has(port)) add('error', 'checks', file, `port ${port} is also used by ${ports.get(port)}: the two checks collide`); else ports.set(port, file); }
    if (name.startsWith('check:') && yml && !yml.includes(`npm run ${name}`)) add('warn', 'checks', '.github/workflows/build.yml', `"${name}" never runs in CI`);
  }
  // A browser check without FULL_CHECKS breaks every deploy of main (lesson #71).
  const steps = yml.split(/\n\s*- name:/);
  for (const s of steps) {
    if (/npm run check:/.test(s) && !/FULL_CHECKS/.test(s) && !/check:(?:faults-code)/.test(s)) add('error', 'checks', '.github/workflows/build.yml', `step "${s.split('\n')[0].trim().slice(0, 70)}" runs a browser check without if: env.FULL_CHECKS == 'true'`);
  }
  for (const f of readdirSync(join(ROOT, 'scripts')).filter(x => /^check-.*\.mjs$/.test(x))) {
    if (!Object.values(pkg.scripts ?? {}).some(c => c.includes(`scripts/${f}`))) add('warn', 'checks', `scripts/${f}`, 'not in package.json, so it never runs');
  }
}

// 8. Timers that use an editor or a page that may be gone (lesson: Notes "Cannot read properties of null").
for (const f of code.filter(x => x.endsWith('.tsx'))) {
  const t = read(f);
  for (const m of t.matchAll(/setTimeout\(\s*\(\)\s*=>\s*\{?\s*(editor|ed|body)\.(?:commands|chain|view)\b/g)) {
    add('note', 'stale-editor', `${rel(f)}:${lineOf(t, m.index)}`, `a timer uses "${m[1]}" later: check it still exists (isDestroyed) or use a ref to the current one`);
  }
}

// ---------- report ----------
const order = { error: 0, warn: 1, note: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.rule.localeCompare(b.rule));
mkdirSync('screens', { recursive: true });
writeFileSync('screens/faults-code.json', JSON.stringify(findings, null, 1));
const count = s => findings.filter(f => f.severity === s).length;
for (const f of findings.filter(x => x.severity !== 'note')) console.log(`${f.severity === 'error' ? '✗' : '!'} [${f.rule}] ${f.where}: ${f.what}`);
const byRule = {};
for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
console.log(`\nCode faults: ${count('error')} errors, ${count('warn')} warnings, ${count('note')} notes  ${JSON.stringify(byRule)}`);
process.exit(count('error') ? 1 : 0);
