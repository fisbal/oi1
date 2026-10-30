// Step-by-step simulation (like Python Tutor, Guo 2013, for JavaScript): the code is instrumented so that,
// before each statement, the line and the value of every variable in reach are recorded. The run happens in
// a sandboxed iframe; then the programmer moves through the steps and watches the variables change.

import { parse } from 'acorn';
import { compile } from './build';

export interface Step { line: number; vars: Record<string, string>; out: string[] }
export interface Trace { steps: Step[]; error?: string; truncated?: boolean }

export const MAX_STEPS = 3000;

interface Node { type: string; start: number; end: number; loc?: { start: { line: number } }; [k: string]: unknown }

const isNode = (v: unknown): v is Node => !!v && typeof v === 'object' && typeof (v as Node).type === 'string';

function walk(node: Node, visit: (n: Node, parent: Node | null) => void, parent: Node | null = null) {
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'loc') continue;
    const v = node[key];
    if (Array.isArray(v)) { for (const c of v) if (isNode(c)) walk(c, visit, node); }
    else if (isNode(v)) walk(v, visit, node);
  }
}

function names(pattern: Node | null | undefined, out: Set<string>) {
  if (!pattern) return;
  if (pattern.type === 'Identifier') out.add(pattern.name as string);
  else if (pattern.type === 'ObjectPattern') for (const p of pattern.properties as Node[]) names((p.type === 'RestElement' ? p.argument : p.value) as Node, out);
  else if (pattern.type === 'ArrayPattern') for (const e of pattern.elements as (Node | null)[]) names(e, out);
  else if (pattern.type === 'RestElement') names(pattern.argument as Node, out);
  else if (pattern.type === 'AssignmentPattern') names(pattern.left as Node, out);
}

/** The code with a recorder call before each statement, `export` removed, and `example` run at the end. */
export function instrument(path: string, source: string, example = ''): string {
  const code = compile(path, source) + (example ? `\n${example}` : '');
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowAwaitOutsideFunction: true }) as unknown as Node;
  const declared = new Set<string>();
  const inserts: { at: number; text: string }[] = [];
  const cuts: { from: number; to: number }[] = [];
  walk(ast, (n) => {
    if (n.type === 'VariableDeclarator') names(n.id as Node, declared);
    if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) declared.add((n.id as Node).name as string);
    if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') for (const p of n.params as Node[]) names(p, declared);
    if (n.type === 'CatchClause') names(n.param as Node, declared);
    if (n.type === 'ExportNamedDeclaration' && n.declaration) cuts.push({ from: n.start, to: (n.declaration as Node).start });
    if (n.type === 'ExportDefaultDeclaration') cuts.push({ from: n.start, to: (n.declaration as Node).start });
    if (n.type === 'ImportDeclaration') cuts.push({ from: n.start, to: n.end });
    const body = n.type === 'Program' || n.type === 'BlockStatement' || n.type === 'StaticBlock' ? n.body as Node[] : n.type === 'SwitchCase' ? n.consequent as Node[] : null;
    if (body) for (const s of body) {
      if (s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration' || s.type === 'ImportDeclaration' || s.type === 'EmptyStatement') continue;
      if (s.type === 'ExportNamedDeclaration' && (s.declaration as Node | undefined)?.type === 'FunctionDeclaration') continue;
      inserts.push({ at: s.start, text: `__s(${s.loc!.start.line},()=>{const o={};@VARS@return o});` });
    }
    // A loop or if without braces (`for (…) t += i;`) still gets a step each time its statement runs.
    for (const key of ['body', 'consequent', 'alternate']) {
      const s = n[key] as Node | undefined;
      if (n.type === 'SwitchCase' || !isNode(s) || /^(BlockStatement|ClassBody|IfStatement)$/.test(s.type) || !/Statement$|Declaration$/.test(s.type)) continue;
      if (/^(Function|Class|Arrow)/.test(n.type)) continue;
      inserts.push({ at: s.start, text: `{__s(${s.loc!.start.line},()=>{const o={};@VARS@return o});` }, { at: s.end, text: '}' });
    }
  });
  const vars = [...declared].filter(v => !v.startsWith('__')).map(v => `try{o[${JSON.stringify(v)}]=${v}}catch(e){}`).join('');
  // Applied from the end so earlier offsets stay right; at one offset, a closing '}' goes before what opens there.
  const edits = [...inserts.map((i, k) => ({ from: i.at, to: i.at, text: i.text.replace('@VARS@', vars), k })), ...cuts.map((c, k) => ({ ...c, text: '', k: -1 - k }))]
    .sort((a, b) => b.from - a.from || b.to - a.to || (a.text === '}' ? 1 : 0) - (b.text === '}' ? 1 : 0) || b.k - a.k);
  let out = code;
  for (const e of edits) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  return out;
}

const RUNTIME = String.raw`
const __steps = []; let __out = [];
const __fmt = (v, d = 0) => {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'function') return 'ƒ ' + (v.name || '');
  if (v === undefined) return 'undefined';
  if (v === null || typeof v !== 'object') return String(v);
  if (d > 2) return Array.isArray(v) ? '[…]' : '{…}';
  if (Array.isArray(v)) return '[' + v.slice(0, 20).map(x => __fmt(x, d + 1)).join(', ') + (v.length > 20 ? ', …' : '') + ']';
  if (v instanceof Map) return 'Map(' + v.size + ')';
  if (v instanceof Set) return 'Set(' + v.size + ')';
  return '{' + Object.keys(v).slice(0, 12).map(k => k + ': ' + __fmt(v[k], d + 1)).join(', ') + '}';
};
class __Stop extends Error {}
const __s = (line, read) => {
  if (__steps.length >= ${MAX_STEPS}) throw new __Stop('steps');
  const raw = read(); const vars = {};
  for (const k in raw) vars[k] = __fmt(raw[k]);
  __steps.push({ line, vars, out: __out.slice() });
};
console.log = (...a) => { __out = [...__out, a.map(x => typeof x === 'string' ? x : __fmt(x)).join(' ')]; };
const __end = (error, truncated) => parent.postMessage({ oi1trace: { steps: __steps, error, truncated, out: __out } }, '*');
`;

/** Runs the instrumented code in a hidden sandbox and returns the steps (10 s at most). */
export function trace(instrumented: string): Promise<Trace> {
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${RUNTIME}
(async () => { try { await (async () => {\n${instrumented.replace(/<\/script/gi, '<\\/script')}\n})(); __end(); }
catch (e) { if (e instanceof __Stop) __end(undefined, true); else { __steps.push({ line: __steps.length ? __steps[__steps.length - 1].line : 1, vars: __steps.length ? __steps[__steps.length - 1].vars : {}, out: __out.slice() }); __end(String(e && e.message || e)); } } })();
</script></body></html>`;
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:0;border:0;opacity:0';
  frame.title = 'simulation';
  return new Promise(resolve => {
    const done = (t: Trace) => { window.removeEventListener('message', on); clearTimeout(timer); frame.remove(); resolve(t); };
    const on = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || !e.data?.oi1trace) return;
      const r = e.data.oi1trace as Trace & { out: string[] };
      const steps = r.steps.length ? r.steps : [{ line: 1, vars: {}, out: r.out }];
      if (steps.length) steps[steps.length - 1] = { ...steps[steps.length - 1], out: r.out };
      done({ steps, error: r.error, truncated: r.truncated });
    };
    const timer = window.setTimeout(() => done({ steps: [], error: 'Timed out after 10 s (an endless loop?)' }), 10000);
    window.addEventListener('message', on);
    frame.srcdoc = html;
    document.body.append(frame);
  });
}

/** Common error messages, explained for a beginner. */
const EXPLAIN: [RegExp, { en: string; fr: string }][] = [
  [/(\w+) is not defined/, { en: '“$1” is used but never created. Check the spelling, or declare it with let or const.', fr: '« $1 » est utilisé mais jamais créé. Vérifie l’orthographe, ou déclare-le avec let ou const.' }],
  [/Cannot read propert(?:y|ies) of (undefined|null)(?: \(reading '(\w+)'\))?/, { en: 'You read “.$2” on something that is $1. The value before the dot does not exist yet.', fr: 'Tu lis « .$2 » sur quelque chose qui vaut $1. La valeur avant le point n’existe pas encore.' }],
  [/(\S+) is not a function/, { en: '“$1” is called with () but it is not a function. Is the name right? Is it imported?', fr: '« $1 » est appelé avec () mais ce n’est pas une fonction. Le nom est-il juste ? Est-il importé ?' }],
  [/Assignment to constant variable/, { en: 'A const cannot change. Use let if the value must change.', fr: 'Une const ne peut pas changer. Utilise let si la valeur doit changer.' }],
  [/Unexpected token|Unexpected end of input|missing \)/i, { en: 'A bracket, quote or comma is missing or extra. Look at the line shown and the one before.', fr: 'Une parenthèse, un guillemet ou une virgule manque ou est en trop. Regarde la ligne indiquée et celle d’avant.' }],
  [/Maximum call stack/, { en: 'A function calls itself forever. Recursion needs a stop case that returns without calling again.', fr: 'Une fonction s’appelle sans fin. La récursion a besoin d’un cas d’arrêt qui renvoie sans se rappeler.' }],
  [/before initialization/, { en: 'The variable is used before the line that creates it. Move the use below its let/const.', fr: 'La variable est utilisée avant la ligne qui la crée. Place l’utilisation après son let/const.' }],
  [/expected (.+) to (?:be|equal) (.+)/, { en: 'Your code returned $1, the test expected $2.', fr: 'Ton code a renvoyé $1, le test attendait $2.' }],
  [/Timed out|steps/, { en: 'The code ran too long: a loop probably never ends. Check its condition changes each time.', fr: 'Le code a tourné trop longtemps : une boucle ne s’arrête sans doute jamais. Vérifie que sa condition change.' }],
];
export function explainError(message: string, lang: string): string | null {
  for (const [re, words] of EXPLAIN) {
    const m = re.exec(message);
    if (m) return (lang === 'fr' ? words.fr : words.en).replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? '');
  }
  return null;
}
