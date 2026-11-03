// One report from the fault detector's two parts: screens/faults-code.json (the code) and every
// screens/faults-ui*.json (every button pressed on PC and phone). Markdown on the standard output.
//   node scripts/faults-report.mjs > screens/faults-report.md
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const dir = 'screens';
const code = existsSync(`${dir}/faults-code.json`) ? JSON.parse(readFileSync(`${dir}/faults-code.json`, 'utf8')) : [];
const ui = { stats: { apps: 0, tabs: 0, pressed: 0, lists: 0 }, found: [] };
for (const f of existsSync(dir) ? readdirSync(dir).filter(x => /^faults-ui.*\.json$/.test(x)) : []) {
  const r = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  for (const k of Object.keys(ui.stats)) ui.stats[k] += r.stats?.[k] ?? 0;
  ui.found.push(...(r.found ?? []));
}
const n = (s) => code.filter(f => f.severity === s).length;
const serious = ui.found.filter(f => ['error', 'stopped', 'cannot-press', 'empty-list', 'empty-tab', 'missing'].includes(f.kind)).length;
let md = `# Fault detector report\n\n`;
md += `Code: ${n('error')} errors, ${n('warn')} warnings, ${n('note')} notes. Apps: ${ui.stats.pressed} buttons pressed and ${ui.stats.lists} lists opened in ${ui.stats.tabs} tabs, ${serious} problems, ${ui.found.length - serious} to look at.\n`;
const KINDS = {
  error: 'Script errors when a button is pressed', stopped: 'Where the check had to stop', 'cannot-press': 'Buttons that cannot be pressed',
  'empty-list': 'Lists that open empty', 'empty-tab': 'Empty tabs', missing: 'Missing apps', 'no-ribbon': 'Apps without a ribbon',
  'no-effect': 'Buttons that change nothing on the screen', 'cut-text': 'Cut names',
};
md += `\n## In the apps\n`;
for (const [k, title] of Object.entries(KINDS)) {
  const list = ui.found.filter(f => f.kind === k);
  if (!list.length) continue;
  md += `\n### ${title} (${list.length})\n\n`;
  for (const f of list) md += `- ${f.screen} · ${f.app}${f.tab ? ` › ${f.tab}` : ''}${f.button ? ` › ${f.button}` : ''}: ${f.detail}\n`;
}
if (!ui.found.length) md += `\nNothing found.\n`;
md += `\n## In the code\n\n`;
for (const f of code.filter(x => x.severity !== 'note')) md += `- ${f.severity} [${f.rule}] ${f.where}: ${f.what}\n`;
if (!code.some(x => x.severity !== 'note')) md += `Nothing found.\n`;
const notes = code.filter(x => x.severity === 'note');
if (notes.length) md += `\n<details><summary>${notes.length} notes</summary>\n\n${notes.map(f => `- [${f.rule}] ${f.where}: ${f.what}`).join('\n')}\n</details>\n`;
process.stdout.write(md);
