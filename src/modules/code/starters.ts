// The files every repository should have: .gitignore, LICENSE and README.md.
// The full texts come from GitHub's public API (no sign-in needed); offline, a short built-in version is used.

import type { Files } from './build';

const API = 'https://api.github.com';

/** GitHub's own .gitignore templates (github/gitignore), most used first. */
export const GITIGNORES = [
  'Node', 'Python', 'Java', 'Go', 'Rust', 'C', 'C++', 'Dart', 'Swift', 'Kotlin', 'Android', 'Unity', 'Godot',
  'Ruby', 'Rails', 'Laravel', 'Symfony', 'VisualStudio', 'Gradle', 'Maven', 'Haskell', 'Elixir', 'Scala', 'R', 'Julia',
  'Terraform', 'Jekyll', 'Qt', 'Lua', 'Zig',
];

/** Licenses: GitHub's API key when it has the text, else the SPDX id and its official page. */
export const LICENSES: { id: string; name: string; gh?: string }[] = [
  { id: 'MIT', name: 'MIT', gh: 'mit' },
  { id: 'Apache-2.0', name: 'Apache 2.0', gh: 'apache-2.0' },
  { id: 'GPL-3.0', name: 'GNU GPL v3', gh: 'gpl-3.0' },
  { id: 'GPL-2.0', name: 'GNU GPL v2', gh: 'gpl-2.0' },
  { id: 'AGPL-3.0', name: 'GNU AGPL v3', gh: 'agpl-3.0' },
  { id: 'LGPL-2.1', name: 'GNU LGPL v2.1', gh: 'lgpl-2.1' },
  { id: 'LGPL-3.0', name: 'GNU LGPL v3' },
  { id: 'MPL-2.0', name: 'Mozilla Public 2.0', gh: 'mpl-2.0' },
  { id: 'BSD-2-Clause', name: 'BSD 2-Clause', gh: 'bsd-2-clause' },
  { id: 'BSD-3-Clause', name: 'BSD 3-Clause', gh: 'bsd-3-clause' },
  { id: '0BSD', name: 'BSD Zero Clause' },
  { id: 'ISC', name: 'ISC' },
  { id: 'MIT-0', name: 'MIT No Attribution' },
  { id: 'BSL-1.0', name: 'Boost 1.0', gh: 'bsl-1.0' },
  { id: 'EPL-2.0', name: 'Eclipse 2.0', gh: 'epl-2.0' },
  { id: 'EUPL-1.2', name: 'European Union 1.2' },
  { id: 'Unlicense', name: 'The Unlicense', gh: 'unlicense' },
  { id: 'CC0-1.0', name: 'CC0 (public domain)', gh: 'cc0-1.0' },
  { id: 'CC-BY-4.0', name: 'Creative Commons BY 4.0' },
  { id: 'CC-BY-SA-4.0', name: 'Creative Commons BY-SA 4.0' },
  { id: 'OFL-1.1', name: 'SIL Open Font 1.1' },
  { id: 'Zlib', name: 'zlib' },
  { id: 'Artistic-2.0', name: 'Artistic 2.0' },
  { id: 'proprietary', name: 'All rights reserved' },
];

const OFFLINE_IGNORE: Record<string, string> = {
  Node: 'node_modules/\ndist/\nbuild/\n.env\n.env.*\nnpm-debug.log*\n.DS_Store\n',
  Python: '__pycache__/\n*.py[cod]\n.venv/\nvenv/\n.env\ndist/\n*.egg-info/\n.pytest_cache/\n',
};
const COMMON_IGNORE = '.DS_Store\nThumbs.db\n.env\n.vscode/\n.idea/\n';

export async function gitignore(name: string): Promise<string> {
  try {
    const res = await fetch(`${API}/gitignore/templates/${encodeURIComponent(name)}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (res.ok) return `${((await res.json()) as { source: string }).source.trimEnd()}\n\n# Editors and systems\n${COMMON_IGNORE}`;
  } catch { /* offline */ }
  return `# ${name}\n${OFFLINE_IGNORE[name] ?? ''}${COMMON_IGNORE}`;
}

const MIT = (year: number, who: string) => `MIT License

Copyright (c) ${year} ${who}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

export async function license(id: string, who: string, year = new Date().getFullYear()): Promise<string> {
  const l = LICENSES.find(x => x.id === id);
  if (id === 'proprietary') return `Copyright (c) ${year} ${who}. All rights reserved.\n\nNo part of this software may be copied, changed or shared without written permission.\n`;
  if (id === 'MIT') return MIT(year, who);
  if (l?.gh) {
    try {
      const res = await fetch(`${API}/licenses/${l.gh}`, { headers: { Accept: 'application/vnd.github+json' } });
      if (res.ok) {
        const body = ((await res.json()) as { body: string }).body;
        return body.replace(/\[year\]|\[yyyy\]|<year>/gi, String(year)).replace(/\[fullname\]|\[name of copyright owner\]|<name of author>/gi, who);
      }
    } catch { /* offline */ }
  }
  return `SPDX-License-Identifier: ${id}\n\nCopyright (c) ${year} ${who}\n\nThis project is licensed under the ${l?.name ?? id} license.\nThe full text is at https://spdx.org/licenses/${id}.html\n`;
}

/** A README made from what the project contains: how to run it, its files, its site. */
export function readme(name: string, files: Files, site?: string): string {
  const paths = Object.keys(files).sort();
  let scripts: Record<string, string> = {};
  let description = '';
  try { const pkg = JSON.parse(files['package.json'] ?? '{}'); scripts = pkg.scripts ?? {}; description = pkg.description ?? ''; } catch { /* not JSON */ }
  const py = paths.some(p => p.endsWith('.py'));
  const run = files['package.json'] !== undefined
    ? ['```', 'npm install', ...(['dev', 'start', 'build', 'test'].filter(s => scripts[s]).map(s => `npm run ${s}`)), '```'].join('\n')
    : py ? '```\npython main.py\n```' : 'Open `index.html` in a browser, or press Run in In 1 Code+.';
  const tree = paths.slice(0, 40).map(p => `- \`${p}\``).join('\n') + (paths.length > 40 ? `\n- … ${paths.length - 40} more` : '');
  return `# ${name}

${description || 'What this project does, in one sentence.'}
${site ? `\n**Live site:** ${site}\n` : ''}
## Run it

${run}

## Files

${tree}

## Contributing

Open an issue or a pull request. Run the tests before you push.

## License

See [LICENSE](LICENSE).
`;
}
