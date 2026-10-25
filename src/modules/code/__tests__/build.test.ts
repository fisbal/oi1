import { describe, expect, it } from 'vitest';
import { buildPreview, buildSite, cdnUrl, relative, resolvePath } from '../build';
import { TEMPLATES } from '../templates';

const files = (id: string) => TEMPLATES.find(t => t.id === id)!.files;

/** The modules in a preview's import map, decoded. */
function modulesOf(html: string): Record<string, string> {
  const map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)![1]) as { imports: Record<string, string> };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map.imports)) out[k] = v.startsWith('data:') ? decodeURIComponent(v.slice(v.indexOf(',') + 1).split('#')[0]) : v;
  return out;
}

describe('Code+ build', () => {
  it('resolves paths like a bundler', () => {
    const f = { 'src/App.tsx': '', 'src/lib/index.ts': '', 'logo.svg': '' };
    expect(resolvePath('src/main.tsx', './App', f)).toBe('src/App.tsx');
    expect(resolvePath('src/main.tsx', './lib', f)).toBe('src/lib/index.ts');
    expect(resolvePath('src/main.tsx', '../logo.svg', f)).toBe('logo.svg');
    expect(resolvePath('src/main.tsx', '/logo.svg', f)).toBe('logo.svg');
    expect(resolvePath('src/main.tsx', './nope', f)).toBeNull();
    expect(relative('src/a/b.js', 'src/c.js')).toBe('../c.js');
    expect(relative('index.html', 'src/main.js')).toBe('./src/main.js');
    expect(cdnUrl('react-dom/client', { 'react-dom': '^18.3.1' })).toBe('https://esm.sh/react-dom@18.3.1/client');
    expect(cdnUrl('@scope/pkg/x', {})).toBe('https://esm.sh/@scope/pkg/x');
  });

  it('previews a React and TypeScript app', async () => {
    const { html, errors } = await buildPreview(files('react'), 'index.html');
    expect(errors).toEqual([]);
    const mods = modulesOf(html);
    expect(mods.react).toBe('https://esm.sh/react@18.3.1');
    expect(mods['react/jsx-runtime']).toBe('https://esm.sh/react@18.3.1/jsx-runtime');
    expect(mods['react-dom/client']).toBe('https://esm.sh/react-dom@18.3.1/client');
    expect(mods['@oi1/src/main.tsx']).toContain('from "@oi1/src/App.tsx"'.replace(/"/g, "'"));
    expect(mods['@oi1/src/App.tsx']).not.toContain('interface Task');
    expect(mods['@oi1/src/styles.css']).toContain("createElement('style')");
    expect(html).toContain('import "@oi1/src/main.tsx"');
  });

  it('inlines styles, scripts and JSON for a plain site', async () => {
    const { html, errors } = await buildPreview(files('shop'), 'index.html');
    expect(errors).toEqual([]);
    expect(html).toContain('data-file="style.css"');
    expect(modulesOf(html)['@oi1/products.json']).toContain('Coffee mug');
    const page = await buildPreview(files('page'), 'index.html');
    expect(page.html).toContain("getElementById('hello')");
  });

  it('reports compile errors with the file and line', async () => {
    const { errors } = await buildPreview({ 'index.html': '<script type="module" src="a.ts"></script>', 'a.ts': 'const x: = 1;' }, 'index.html');
    expect(errors[0].path).toBe('a.ts');
    expect(errors[0].line).toBe(1);
  });

  it('builds a static site for GitHub Pages', async () => {
    const { files: out, errors } = await buildSite(files('react'));
    expect(errors).toEqual([]);
    expect(out['src/main.js']).toContain("from './App.js'");
    expect(out['src/main.js']).toContain("'./styles.css.js'");
    expect(out['src/main.js']).toContain('https://esm.sh/react-dom@18.3.1/client');
    expect(out['src/App.js']).toContain('https://esm.sh/react@18.3.1/jsx-runtime');
    expect(out['src/styles.css.js']).toContain("new URL(\"./styles.css\"");
    expect(out['index.html']).toContain('src="./src/main.js"');
    expect(out['.nojekyll']).toBe('');
  });
});
