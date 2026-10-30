// Ready-made pieces of code, inserted at the cursor with fields to fill (Tab moves to the next one).
// Also offered while typing, by name, in the completion list.

import { snippetCompletion, type Completion, type CompletionSource } from '@codemirror/autocomplete';
import { extOf } from './build';

export interface Snip { label: string; detail: string; body: string }
export type SnipLang = 'html' | 'css' | 'js' | 'py' | 'sql' | 'md';

const s = (label: string, detail: string, body: string): Snip => ({ label, detail, body });

export const SNIPPETS: Record<SnipLang, Snip[]> = {
  html: [
    s('html5', 'Page HTML5', '<!doctype html>\n<html lang="${en}">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${Title}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  ${}\n  <script type="module" src="main.js"></script>\n</body>\n</html>\n'),
    s('header', 'Header + nav', '<header>\n  <a href="/" class="logo">${Name}</a>\n  <nav>\n    <a href="#">${Home}</a>\n    <a href="#">${About}</a>\n    <a href="#">${Contact}</a>\n  </nav>\n</header>'),
    s('footer', 'Footer', '<footer>\n  <p>© ${2026} ${Name}</p>\n</footer>'),
    s('section', 'Section', '<section id="${id}">\n  <h2>${Title}</h2>\n  <p>${}</p>\n</section>'),
    s('article', 'Article', '<article>\n  <h2>${Title}</h2>\n  <time datetime="${2026-01-01}">${date}</time>\n  <p>${}</p>\n</article>'),
    s('form', 'Form', '<form action="${#}" method="post">\n  <label>${Name} <input name="${name}" required></label>\n  <label>Email <input type="email" name="email" required></label>\n  <button type="submit">${Send}</button>\n</form>'),
    s('input', 'Labelled input', '<label for="${id}">${Label}</label>\n<input id="${id}" name="${id}" type="${text}">'),
    s('select', 'Select', '<label>${Choose}\n  <select name="${name}">\n    <option>${One}</option>\n    <option>${Two}</option>\n  </select>\n</label>'),
    s('button', 'Button', '<button type="button" onclick="${}">${Click}</button>'),
    s('table', 'Table', '<table>\n  <thead><tr><th>${A}</th><th>${B}</th></tr></thead>\n  <tbody>\n    <tr><td>${}</td><td></td></tr>\n  </tbody>\n</table>'),
    s('ul', 'List', '<ul>\n  <li>${}</li>\n  <li></li>\n</ul>'),
    s('img', 'Image', '<img src="${image.png}" alt="${description}" width="${400}" height="${300}" loading="lazy">'),
    s('picture', 'Responsive picture', '<picture>\n  <source srcset="${image.webp}" type="image/webp">\n  <img src="${image.jpg}" alt="${description}">\n</picture>'),
    s('video', 'Video', '<video src="${video.mp4}" controls playsinline width="${640}"></video>'),
    s('audio', 'Audio', '<audio src="${sound.mp3}" controls></audio>'),
    s('a', 'Link', '<a href="${https://}">${text}</a>'),
    s('ablank', 'Link, new tab', '<a href="${https://}" target="_blank" rel="noopener">${text}</a>'),
    s('meta-og', 'Share preview tags', '<meta property="og:title" content="${Title}">\n<meta property="og:description" content="${Description}">\n<meta property="og:image" content="${https://…/cover.png}">'),
    s('dialog', 'Dialog', '<dialog id="${dlg}">\n  <p>${Message}</p>\n  <form method="dialog"><button>OK</button></form>\n</dialog>'),
    s('details', 'Show / hide', '<details>\n  <summary>${Question}</summary>\n  <p>${Answer}</p>\n</details>'),
    s('iframe', 'Embedded page', '<iframe src="${https://}" title="${title}" loading="lazy"></iframe>'),
    s('script', 'Module script', '<script type="module">\n  ${}\n</script>'),
    s('card', 'Card', '<div class="card">\n  <img src="${image.png}" alt="${}">\n  <h3>${Title}</h3>\n  <p>${Text}</p>\n</div>'),
  ],
  css: [
    s('reset', 'Modern reset', '*, *::before, *::after { box-sizing: border-box; }\nbody { margin: 0; font-family: system-ui, sans-serif; line-height: 1.5; }\nimg, video { max-width: 100%; height: auto; display: block; }\n'),
    s('flex', 'Flex row', 'display: flex;\nalign-items: ${center};\njustify-content: ${space-between};\ngap: ${1rem};'),
    s('flexcol', 'Flex column', 'display: flex;\nflex-direction: column;\ngap: ${1rem};'),
    s('center', 'Center anything', 'display: grid;\nplace-items: center;'),
    s('grid', 'Grid', 'display: grid;\ngrid-template-columns: repeat(${3}, 1fr);\ngap: ${1rem};'),
    s('gridauto', 'Auto grid', 'display: grid;\ngrid-template-columns: repeat(auto-fill, minmax(${220px}, 1fr));\ngap: ${1rem};'),
    s('media', 'Phone media query', '@media (max-width: ${600px}) {\n  ${}\n}'),
    s('dark', 'Dark mode', '@media (prefers-color-scheme: dark) {\n  :root { ${--bg: #111; --fg: #eee;} }\n}'),
    s('vars', 'Color variables', ':root {\n  --bg: ${#ffffff};\n  --fg: ${#111111};\n  --accent: ${#d4a843};\n}'),
    s('transition', 'Transition', 'transition: ${all} ${.2s} ease;'),
    s('keyframes', 'Animation', '@keyframes ${fade} {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}\nanimation: ${fade} .4s ease both;'),
    s('shadow', 'Soft shadow', 'box-shadow: 0 ${8px} ${24px} rgba(0, 0, 0, ${.12});'),
    s('ellipsis', 'Cut long text …', 'white-space: nowrap;\noverflow: hidden;\ntext-overflow: ellipsis;'),
    s('clamp', 'Fluid font size', 'font-size: clamp(${1rem}, ${2.5vw}, ${2rem});'),
    s('sticky', 'Sticky header', 'position: sticky;\ntop: 0;\nz-index: 10;'),
    s('cover', 'Cover image', 'object-fit: cover;\nwidth: 100%;\nheight: ${100%};'),
    s('focus', 'Visible focus', ':focus-visible {\n  outline: 3px solid ${#d4a843};\n  outline-offset: 2px;\n}'),
    s('sronly', 'Screen reader only', '.sr-only {\n  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;\n  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;\n}'),
    s('reduced', 'Less motion', '@media (prefers-reduced-motion: reduce) {\n  * { animation: none !important; transition: none !important; }\n}'),
    s('button', 'Button style', '.button {\n  padding: .6em 1.2em;\n  border: 0;\n  border-radius: ${999px};\n  background: ${#d4a843};\n  color: ${#1a1a1a};\n  cursor: pointer;\n}'),
    s('font', 'Web font', '@font-face {\n  font-family: "${Name}";\n  src: url("${font.woff2}") format("woff2");\n  font-display: swap;\n}'),
    s('scrollbar', 'Thin scrollbar', 'scrollbar-width: thin;\nscrollbar-color: ${#888} transparent;'),
  ],
  js: [
    s('fn', 'Function', 'function ${name}(${params}) {\n  ${}\n}'),
    s('arrow', 'Arrow function', 'const ${name} = (${params}) => {\n  ${}\n};'),
    s('afn', 'Async function', 'async function ${name}(${params}) {\n  ${}\n}'),
    s('fetchjson', 'Fetch JSON', 'const res = await fetch(${url});\nif (!res.ok) throw new Error(`HTTP $\\{res.status\\}`);\nconst ${data} = await res.json();'),
    s('trycatch', 'try / catch', 'try {\n  ${}\n} catch (error) {\n  console.error(error);\n}'),
    s('for', 'for loop', 'for (let i = 0; i < ${array}.length; i++) {\n  ${}\n}'),
    s('forof', 'for…of', 'for (const ${item} of ${items}) {\n  ${}\n}'),
    s('map', 'Array map', 'const ${result} = ${items}.map(${item} => ${});'),
    s('filter', 'Array filter', 'const ${result} = ${items}.filter(${item} => ${});'),
    s('reduce', 'Array reduce', 'const ${total} = ${items}.reduce((sum, ${item}) => sum + ${item}, 0);'),
    s('class', 'Class', 'class ${Name} {\n  constructor(${params}) {\n    ${}\n  }\n}'),
    s('import', 'Import', "import { ${name} } from '${module}';"),
    s('export', 'Export function', 'export function ${name}(${params}) {\n  ${}\n}'),
    s('qs', 'Find an element', "const ${el} = document.querySelector('${selector}');"),
    s('click', 'On click', "${el}.addEventListener('click', (event) => {\n  ${}\n});"),
    s('ready', 'When page is ready', "document.addEventListener('DOMContentLoaded', () => {\n  ${}\n});"),
    s('timeout', 'Wait then run', 'setTimeout(() => {\n  ${}\n}, ${1000});'),
    s('interval', 'Repeat', 'const timer = setInterval(() => {\n  ${}\n}, ${1000});'),
    s('debounce', 'Debounce', 'function debounce(fn, ms = ${300}) {\n  let t;\n  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };\n}'),
    s('storage', 'Save on device', "localStorage.setItem('${key}', JSON.stringify(${value}));\nconst ${saved} = JSON.parse(localStorage.getItem('${key}') ?? 'null');"),
    s('promise', 'Promise', 'new Promise((resolve, reject) => {\n  ${}\n});'),
    s('test', 'Test (describe / it)', "describe('${thing}', () => {\n  it('${does something}', () => {\n    expect(${actual}).toBe(${expected});\n  });\n});"),
    s('component', 'React component', 'export function ${Name}({ ${props} }) {\n  return (\n    <div>${}</div>\n  );\n}'),
    s('usestate', 'React state', 'const [${value}, set${Value}] = useState(${initial});'),
    s('useeffect', 'React effect', 'useEffect(() => {\n  ${}\n  return () => {};\n}, [${deps}]);'),
  ],
  py: [
    s('def', 'Function', 'def ${name}(${params}):\n    """${What it does}."""\n    ${pass}'),
    s('main', 'Main guard', 'def main():\n    ${pass}\n\n\nif __name__ == "__main__":\n    main()'),
    s('class', 'Class', 'class ${Name}:\n    def __init__(self, ${value}):\n        self.${value} = ${value}'),
    s('dataclass', 'Dataclass', 'from dataclasses import dataclass\n\n\n@dataclass\nclass ${Name}:\n    ${field}: ${str}'),
    s('for', 'for loop', 'for ${item} in ${items}:\n    ${pass}'),
    s('enum', 'for with index', 'for i, ${item} in enumerate(${items}):\n    ${pass}'),
    s('while', 'while loop', 'while ${condition}:\n    ${pass}'),
    s('if', 'if / elif / else', 'if ${condition}:\n    ${pass}\nelif ${other}:\n    pass\nelse:\n    pass'),
    s('try', 'try / except', 'try:\n    ${pass}\nexcept ${ValueError} as error:\n    print(error)'),
    s('with', 'Open a file', 'with open("${file.txt}", encoding="utf-8") as f:\n    ${text} = f.read()'),
    s('listcomp', 'List comprehension', '${result} = [${x} for ${x} in ${items} if ${condition}]'),
    s('dictcomp', 'Dict comprehension', '${result} = {${k}: ${v} for ${k}, ${v} in ${pairs}}'),
    s('lambda', 'Lambda', '${name} = lambda ${x}: ${x}'),
    s('fstring', 'f-string', 'print(f"${text} {${value}}")'),
    s('input', 'Ask the user', '${name} = input("${Your name? }")'),
    s('json', 'Read JSON', 'import json\n\nwith open("${data.json}", encoding="utf-8") as f:\n    ${data} = json.load(f)'),
    s('csv', 'Read CSV', 'import csv\n\nwith open("${data.csv}", newline="", encoding="utf-8") as f:\n    for row in csv.DictReader(f):\n        ${print(row)}'),
    s('requests', 'HTTP GET', 'import requests\n\nres = requests.get("${https://}", timeout=10)\nres.raise_for_status()\n${data} = res.json()'),
    s('test', 'pytest test', 'def test_${name}():\n    assert ${actual} == ${expected}'),
    s('typing', 'Typed function', 'def ${name}(${x}: ${int}) -> ${int}:\n    return ${x}'),
    s('argparse', 'Command line options', 'import argparse\n\nparser = argparse.ArgumentParser()\nparser.add_argument("${name}")\nargs = parser.parse_args()'),
    s('sort', 'Sort by key', '${items}.sort(key=lambda ${x}: ${x}[${"name"}])'),
  ],
  sql: [
    s('select', 'SELECT', 'SELECT ${*}\nFROM ${table}\nWHERE ${condition};'),
    s('selectorder', 'SELECT sorted', 'SELECT ${columns}\nFROM ${table}\nORDER BY ${column} DESC\nLIMIT ${10};'),
    s('insert', 'INSERT', 'INSERT INTO ${table} (${a}, ${b})\nVALUES (${1}, ${2});'),
    s('update', 'UPDATE', 'UPDATE ${table}\nSET ${column} = ${value}\nWHERE ${id} = ${1};'),
    s('delete', 'DELETE', 'DELETE FROM ${table}\nWHERE ${id} = ${1};'),
    s('create', 'CREATE TABLE', 'CREATE TABLE ${table} (\n  id INTEGER PRIMARY KEY,\n  ${name} TEXT NOT NULL,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);'),
    s('alter', 'Add column', 'ALTER TABLE ${table} ADD COLUMN ${column} ${TEXT};'),
    s('index', 'Index', 'CREATE INDEX ${idx_name} ON ${table} (${column});'),
    s('join', 'INNER JOIN', 'SELECT ${a}.*, ${b}.${column}\nFROM ${a}\nJOIN ${b} ON ${b}.${a_id} = ${a}.id;'),
    s('leftjoin', 'LEFT JOIN', 'SELECT ${a}.*, ${b}.${column}\nFROM ${a}\nLEFT JOIN ${b} ON ${b}.${a_id} = ${a}.id;'),
    s('group', 'GROUP BY', 'SELECT ${column}, COUNT(*) AS n\nFROM ${table}\nGROUP BY ${column}\nHAVING COUNT(*) > ${1};'),
    s('count', 'Count rows', 'SELECT COUNT(*) FROM ${table};'),
    s('distinct', 'Distinct values', 'SELECT DISTINCT ${column} FROM ${table};'),
    s('like', 'Text search', "SELECT * FROM ${table} WHERE ${column} LIKE '%${word}%';"),
    s('between', 'Between', 'SELECT * FROM ${table} WHERE ${column} BETWEEN ${a} AND ${b};'),
    s('in', 'IN list', "SELECT * FROM ${table} WHERE ${column} IN (${'a', 'b'});"),
    s('case', 'CASE', "CASE\n  WHEN ${condition} THEN '${a}'\n  ELSE '${b}'\nEND"),
    s('cte', 'WITH (CTE)', 'WITH ${name} AS (\n  SELECT ${*} FROM ${table}\n)\nSELECT * FROM ${name};'),
    s('window', 'Ranking', 'SELECT ${column}, RANK() OVER (ORDER BY ${score} DESC) AS rank\nFROM ${table};'),
    s('transaction', 'Transaction', 'BEGIN;\n${}\nCOMMIT;'),
    s('view', 'View', 'CREATE VIEW ${name} AS\nSELECT ${*} FROM ${table};'),
  ],
  md: [
    s('h1', 'Title', '# ${Title}\n'), s('h2', 'Section', '## ${Section}\n'), s('h3', 'Sub-section', '### ${Sub-section}\n'),
    s('bold', 'Bold', '**${text}**'), s('italic', 'Italic', '*${text}*'), s('link', 'Link', '[${text}](${https://})'),
    s('image', 'Image', '![${description}](${image.png})'), s('ul', 'List', '- ${one}\n- ${two}\n- ${three}'),
    s('ol', 'Numbered list', '1. ${one}\n2. ${two}\n3. ${three}'), s('task', 'Task list', '- [ ] ${task}\n- [x] ${done}'),
    s('code', 'Code block', '```${js}\n${}\n```'), s('inline', 'Inline code', '`${code}`'),
    s('quote', 'Quote', '> ${quote}'), s('table', 'Table', '| ${A} | ${B} |\n| --- | --- |\n| ${} |  |'),
    s('hr', 'Line', '\n---\n'), s('details', 'Show / hide', '<details>\n<summary>${Title}</summary>\n\n${text}\n\n</details>'),
    s('badge', 'Badge', '![${label}](https://img.shields.io/badge/${label}-${value}-${gold})'),
    s('readme', 'README outline', '# ${Project}\n\n${One line about it.}\n\n## Install\n\n```\nnpm install\n```\n\n## Use\n\n${}\n\n## License\n\nMIT\n'),
    s('footnote', 'Footnote', '${text}[^1]\n\n[^1]: ${note}'), s('note', 'Note box', '> [!NOTE]\n> ${text}'),
    s('warning', 'Warning box', '> [!WARNING]\n> ${text}'),
  ],
};

const SNIP_OF: Record<string, SnipLang> = {
  html: 'html', htm: 'html', vue: 'html', svelte: 'html', xml: 'html', svg: 'html',
  css: 'css', scss: 'css', less: 'css',
  js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js', mts: 'js', tsx: 'js',
  py: 'py', sql: 'sql', md: 'md', markdown: 'md',
};
export const snipLangOf = (path: string | null): SnipLang => (path ? SNIP_OF[extOf(path)] : undefined) ?? 'html';

/** The snippets offered while typing, by their short name. */
export function snippetSource(path: string): CompletionSource {
  const list: Completion[] = SNIPPETS[snipLangOf(path)].map(x => snippetCompletion(x.body, { label: x.label, detail: x.detail, type: 'text', boost: -1 }));
  return ctx => {
    const word = ctx.matchBefore(/[\w-]+$/);
    if (!word || (word.from === word.to && !ctx.explicit)) return null;
    return { from: word.from, options: list, validFor: /^[\w-]*$/ };
  };
}
