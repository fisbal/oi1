// Makes src/formats/functionInfo.json from Formula.js' own documentation (MIT): for every function its
// category, what it does and its arguments, for the "Insert function" window and the Tuto.
//   node scripts/gen-function-info.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../node_modules/@formulajs/formulajs/lib/esm/index.mjs', import.meta.url), 'utf8');
const out = {};
const re = /\/\*\*\n((?:(?!\*\/)[\s\S])*?)\*\/\n(?:function ([A-Z][A-Z0-9_]*)\(|([A-Z][A-Z0-9_.]*) = (?:function ?)?\()/g;
for (const m of src.matchAll(re)) {
  const name = m[2] ?? m[3];
  const doc = m[1].split('\n').map(l => l.replace(/^\s*\*? ?/, ''));
  const cat = doc.find(l => l.startsWith('Category:'))?.slice(9).trim();
  if (!cat) continue;
  const summary = doc.slice(0, doc.findIndex(l => l.startsWith('Category:'))).join(' ').replace(/\s+/g, ' ').trim();
  const args = [];
  for (const l of doc) {
    const p = l.match(/^@param \{[^}]*\} (\[?)([\w.]+)\]? ?(.*)$/);
    if (p) args.push({ name: p[2], optional: !!p[1], text: p[3].replace(/^Optional\. ?/, '').split(/(?<=\.)\s/)[0].trim() });
  }
  out[name] = { cat, summary, args };
}
// Old names that are the same function: const NORMDIST = NORM.DIST;
for (const m of src.matchAll(/^const ([A-Z][A-Z0-9_]*) = ([A-Z][A-Z0-9_.]*);$/gm)) if (!out[m[1]] && out[m[2]]) out[m[1]] = out[m[2]];
writeFileSync(new URL('../src/formats/functionInfo.json', import.meta.url), JSON.stringify(out));
// The small list (name -> category) the engine and the ribbon load at once; the texts above load when needed.
const cats = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.cat]));
writeFileSync(new URL('../src/formats/functionCats.json', import.meta.url), JSON.stringify(cats));
console.log(Object.keys(out).length, 'functions;', [...new Set(Object.values(out).map(v => v.cat))].join(', '));
