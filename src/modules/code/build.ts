// Turning a Code+ project into something a browser can run, with no server and no install:
// TypeScript and JSX are compiled in the page (Sucrase), imports between project files are rewritten,
// and npm packages come from the esm.sh CDN. Two outputs share the same steps:
//  - preview: one HTML document for a sandboxed iframe, every file inlined as a data: URL behind an import map;
//  - site: plain static files (TS compiled to .js) to publish on GitHub Pages.

import { init, parse } from 'es-module-lexer';
import { transform } from 'sucrase';

/** A project's files: path without a leading slash (like 'src/App.tsx') to text, or a data: URL for pictures and fonts. */
export type Files = Record<string, string>;

export interface BuildError { path: string; line?: number; message: string }

export const CDN = 'https://esm.sh/';
const CODE = /\.(m?js|jsx|ts|tsx|mts)$/i;
const TS = /\.(ts|tsx|mts)$/i;
const JSX = /\.(jsx|tsx)$/i;
const TRY_EXT = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
const KEY = '@oi1/';

export const isCode = (path: string) => CODE.test(path);
export const isBinary = (content: string) => content.startsWith('data:');
export const extOf = (path: string) => (/\.([a-z0-9]+)$/i.exec(path)?.[1] ?? '').toLowerCase();

export function dirname(path: string) {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

/** Joins and cleans a path: no leading slash, no '.' or '..' parts. */
export function normalize(path: string) {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** The project file an import or link points at, or null when there is none (or it leaves the project). */
export function resolvePath(from: string, spec: string, files: Files): string | null {
  const clean = spec.split(/[?#]/)[0];
  if (!clean) return null;
  const joined = normalize(clean.startsWith('/') ? clean : `${dirname(from)}/${clean}`);
  for (const ext of TRY_EXT) if (files[joined + ext] !== undefined) return joined + ext;
  return null;
}

/** The relative path from one file's folder to another file, like '../lib/util.js'. */
export function relative(from: string, to: string) {
  const a = dirname(from).split('/').filter(Boolean);
  const b = to.split('/');
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  const up = a.length - i;
  return (up ? '../'.repeat(up) : './') + b.slice(i).join('/');
}

const isBare = (spec: string) => !/^(\.{0,2}\/|[a-z][a-z0-9+.-]*:)/i.test(spec);

/** The esm.sh address for an npm import, using the version in package.json when there is one. */
export function cdnUrl(spec: string, deps: Record<string, string>) {
  const parts = spec.split('/');
  const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const sub = spec.slice(name.length);
  const version = (deps[name] ?? '').replace(/^[\^~=v\s]+/, '');
  return `${CDN}${name}${/^[\w.-]+$/.test(version) ? `@${version}` : ''}${sub}`;
}

function dependencies(files: Files): Record<string, string> {
  try {
    const pkg = JSON.parse(files['package.json'] ?? '{}') as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return { ...pkg.devDependencies, ...pkg.dependencies };
  } catch { return {}; }
}

const MIME: Record<string, string> = {
  html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json',
  svg: 'image/svg+xml', txt: 'text/plain', md: 'text/markdown', xml: 'application/xml', csv: 'text/csv',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf', wasm: 'application/wasm',
};
export const mimeOf = (path: string) => MIME[extOf(path)] ?? 'application/octet-stream';

/** A file as a data: URL. The '#' tail names the file, so errors in the preview can say where they happened. */
export function dataUrl(path: string, content: string, mime = mimeOf(path)) {
  if (isBinary(content)) return content;
  return `data:${mime};charset=utf-8,${encodeURIComponent(content)}#${encodeURI(path)}`;
}

/** Compiles TypeScript and JSX to plain JavaScript, keeping line numbers. */
export function compile(path: string, code: string): string {
  if (!TS.test(path) && !JSX.test(path)) return code;
  const transforms: ('typescript' | 'jsx')[] = [];
  if (TS.test(path)) transforms.push('typescript');
  if (JSX.test(path)) transforms.push('jsx');
  return transform(code, { transforms, jsxRuntime: 'automatic', production: true, filePath: path, disableESTransforms: true }).code;
}

function errorOf(path: string, e: unknown): BuildError {
  const message = e instanceof Error ? e.message : String(e);
  const line = /\((\d+):\d+\)/.exec(message)?.[1] ?? /line (\d+)/i.exec(message)?.[1];
  return { path, line: line ? Number(line) : undefined, message: message.replace(/^Error transforming [^:]+:\s*/, '') };
}

/** Rewrites every import in a module with `map`; specifiers it returns null for stay as they are. */
export async function rewriteImports(code: string, map: (spec: string) => string | null): Promise<string> {
  await init;
  const [imports] = parse(code);
  let out = '';
  let last = 0;
  for (const im of imports) {
    // import.meta has no specifier, and neither has a dynamic import of a variable.
    if ((im.type !== 'static' && im.type !== 'dynamic') || typeof im.specifier !== 'string' || (im.type === 'static' && im.typeOnly)) continue;
    const next = map(im.specifier);
    if (next === null) continue;
    // A static import's range is inside the quotes; a dynamic import's range includes them.
    out += code.slice(last, im.start) + (im.type === 'dynamic' ? JSON.stringify(next) : next);
    last = im.end;
  }
  return out + code.slice(last);
}

// ---------------- the preview ----------------

/** Runs first in every preview: sends console output, errors, link clicks and storage back to the editor. */
function bridge(seed: Record<string, string>) {
  return `(function(){
var post=function(m){m.__oi1=1;try{parent.postMessage(m,'*')}catch(e){}};
var where=function(f){if(!f)return'';var i=f.lastIndexOf('#');return i>0?decodeURI(f.slice(i+1)):(f.indexOf('data:')===0?'':f)};
var fmt=function(a){if(a instanceof Error)return a.message;if(a&&typeof a==='object'){try{return JSON.stringify(a,null,1)}catch(e){return String(a)}}return String(a)};
['log','info','warn','error','debug'].forEach(function(l){var o=console[l];console[l]=function(){post({type:'console',level:l,text:[].map.call(arguments,fmt).join(' ')});return o.apply(console,arguments)}});
addEventListener('error',function(e){var w=where(e.filename);post({type:'console',level:'error',text:e.message,file:w,line:e.lineno})});
addEventListener('unhandledrejection',function(e){post({type:'console',level:'error',text:fmt(e.reason)})});
var mk=function(seed,name){var m=seed||{};var save=function(){if(name)post({type:'storage',data:m})};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null},setItem:function(k,v){m[k]=String(v);save()},removeItem:function(k){delete m[k];save()},clear:function(){m={};save()},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}}};
try{localStorage.getItem('x')}catch(e){try{Object.defineProperty(window,'localStorage',{value:mk(${JSON.stringify(seed)},'local')});Object.defineProperty(window,'sessionStorage',{value:mk({})})}catch(e2){}}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href');if(!h||/^(https?:|mailto:|tel:|#|javascript:|data:|blob:)/i.test(h)||a.target==='_blank')return;e.preventDefault();post({type:'navigate',href:h})},true);
})();`;
}

export interface PreviewResult { html: string; errors: BuildError[] }

/**
 * One HTML document that runs the project's page `page` (like 'index.html') in a sandboxed iframe.
 * `storage` is what the page saved in localStorage last time.
 */
export async function buildPreview(files: Files, page: string, storage: Record<string, string> = {}): Promise<PreviewResult> {
  const errors: BuildError[] = [];
  const deps = dependencies(files);
  const imports: Record<string, string> = {};
  const done = new Set<string>();

  const cssText = (path: string, css: string, seen = new Set<string>()): string => {
    seen.add(path);
    return css
      .replace(/@import\s+(?:url\()?\s*["']([^"')]+)["']\s*\)?\s*;/g, (all, spec: string) => {
        const target = resolvePath(path, spec, files);
        return target && !seen.has(target) ? cssText(target, files[target], seen) : all;
      })
      .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (all, _q, spec: string) => {
        if (/^(data:|https?:|#)/i.test(spec)) return all;
        const target = resolvePath(path, spec, files);
        return target ? `url("${dataUrl(target, files[target])}")` : all;
      });
  };

  /** Registers a project file as a module in the import map and returns its key. */
  const addModule = async (path: string): Promise<string> => {
    const key = KEY + path;
    if (done.has(path)) return key;
    done.add(path);
    const content = files[path];
    let code: string;
    if (isCode(path)) {
      try {
        code = await rewriteImports(compile(path, content), spec => mapSpec(path, spec));
        await settle();
      } catch (e) {
        const err = errorOf(path, e);
        errors.push(err);
        code = `throw new SyntaxError(${JSON.stringify(`${path}${err.line ? `:${err.line}` : ''}: ${err.message}`)});`;
      }
    } else if (extOf(path) === 'css') {
      code = `const s=document.createElement('style');s.dataset.file=${JSON.stringify(path)};s.textContent=${JSON.stringify(cssText(path, content))};document.head.append(s);export default s.textContent;`;
    } else if (extOf(path) === 'json') {
      try { code = `export default ${JSON.stringify(JSON.parse(content))};`; } catch (e) { errors.push(errorOf(path, e)); code = 'export default null;'; }
    } else {
      code = `export default ${JSON.stringify(dataUrl(path, content))};`;
    }
    imports[key] = dataUrl(path, code, 'text/javascript');
    return key;
  };

  // Imports found while compiling are queued and added after, so that cycles do not loop forever.
  let queue: string[] = [];
  const mapSpec = (from: string, spec: string): string | null => {
    if (isBare(spec)) {
      if (spec.startsWith(KEY)) return null;
      imports[spec] ??= cdnUrl(spec, deps);
      return null; // the import map sends it to esm.sh
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(spec)) return null;
    const target = resolvePath(from, spec, files);
    if (!target) {
      errors.push({ path: from, message: `Cannot find "${spec}"` });
      return null;
    }
    queue.push(target);
    return KEY + target;
  };
  const settle = async () => {
    const waiting = queue;
    queue = [];
    for (const p of waiting) await addModule(p);
  };

  const source = files[page];
  if (source === undefined) return { html: '', errors: [{ path: page, message: 'Missing page' }] };
  const doc = new DOMParser().parseFromString(source, 'text/html');

  for (const el of [...doc.querySelectorAll('link[rel~="stylesheet"][href]')]) {
    const target = resolvePath(page, el.getAttribute('href')!, files);
    if (!target) continue;
    const style = doc.createElement('style');
    style.dataset.file = target;
    style.textContent = cssText(target, files[target]);
    el.replaceWith(style);
  }
  for (const el of [...doc.querySelectorAll('style')]) {
    if (!el.dataset.file) el.textContent = cssText(page, el.textContent ?? '');
  }
  for (const el of [...doc.querySelectorAll('script')]) {
    const src = el.getAttribute('src');
    const module = el.getAttribute('type') === 'module';
    if (src) {
      const target = resolvePath(page, src, files);
      if (!target) continue;
      el.removeAttribute('src');
      if (module || TS.test(target) || JSX.test(target)) {
        el.setAttribute('type', 'module');
        el.textContent = `import ${JSON.stringify(await addModule(target))};`;
      } else {
        el.textContent = `${files[target]}\n//# sourceURL=${target}`;
      }
    } else if (module) {
      try {
        el.textContent = await rewriteImports(el.textContent ?? '', spec => mapSpec(page, spec));
        await settle();
      } catch (e) { errors.push(errorOf(page, e)); }
    }
  }
  for (const [selector, attr] of [['img', 'src'], ['source', 'src'], ['video', 'src'], ['audio', 'src'], ['video', 'poster'], ['link[rel~="icon"]', 'href'], ['link[rel="manifest"]', 'href'], ['object', 'data'], ['embed', 'src']] as const) {
    for (const el of doc.querySelectorAll(selector)) {
      const v = el.getAttribute(attr);
      const target = v && !/^(data:|https?:|blob:)/i.test(v) ? resolvePath(page, v, files) : null;
      if (target) el.setAttribute(attr, dataUrl(target, files[target]).split('#')[0]);
    }
  }
  for (const el of doc.querySelectorAll('[srcset]')) {
    el.setAttribute('srcset', el.getAttribute('srcset')!.split(',').map(part => {
      const [url, size] = part.trim().split(/\s+/);
      const target = resolvePath(page, url, files);
      return [target ? dataUrl(target, files[target]).split('#')[0] : url, size].filter(Boolean).join(' ');
    }).join(', '));
  }
  for (const el of doc.querySelectorAll('[style*="url("]')) el.setAttribute('style', cssText(page, el.getAttribute('style')!));

  // React must be one copy for the page and every package that uses it.
  if (imports.react) {
    for (const spec of Object.keys(imports)) {
      if (imports[spec].startsWith(CDN) && !/^react(-dom)?(\/|$)/.test(spec)) imports[spec] += `${imports[spec].includes('?') ? '&' : '?'}deps=react@${(deps.react ?? '18.3.1').replace(/^[\^~=v\s]+/, '')}`;
    }
  }
  const head = doc.head;
  const first = head.firstChild;
  const meta = doc.createElement('script');
  meta.textContent = bridge(storage);
  head.insertBefore(meta, first);
  const map = doc.createElement('script');
  map.setAttribute('type', 'importmap');
  map.textContent = JSON.stringify({ imports });
  head.insertBefore(map, meta.nextSibling);
  if (!doc.querySelector('meta[name="viewport"]')) {
    const vp = doc.createElement('meta');
    vp.setAttribute('name', 'viewport');
    vp.setAttribute('content', 'width=device-width, initial-scale=1');
    head.insertBefore(vp, first);
  }
  return { html: `<!doctype html>\n${doc.documentElement.outerHTML}`, errors };
}

// ---------------- the static site ----------------

/** The file a source compiles to on the site: TypeScript and JSX become .js. */
export const outputPath = (path: string) => (TS.test(path) || JSX.test(path) ? path.replace(/\.(tsx?|mts|jsx)$/i, '.js') : path);

/**
 * The project as plain files any web host can serve (GitHub Pages): compiled JavaScript with relative imports,
 * npm packages from esm.sh, and CSS, JSON and pictures imported from code turned into small modules.
 */
export async function buildSite(files: Files): Promise<{ files: Files; errors: BuildError[] }> {
  const errors: BuildError[] = [];
  const deps = dependencies(files);
  const out: Files = {};
  const helpers = new Set<string>();
  const reactDeps = deps.react ? `deps=react@${deps.react.replace(/^[\^~=v\s]+/, '')}` : '';

  const mapFrom = (from: string) => (spec: string): string | null => {
    if (isBare(spec)) {
      const url = cdnUrl(spec, deps);
      return reactDeps && !/^react(-dom)?(\/|$)/.test(spec) ? `${url}?${reactDeps}` : url;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(spec)) return null;
    const target = resolvePath(from, spec, files);
    if (!target) { errors.push({ path: from, message: `Cannot find "${spec}"` }); return null; }
    if (isCode(target)) return relative(outputPath(from), outputPath(target));
    helpers.add(target);
    return relative(outputPath(from), `${target}.js`);
  };

  for (const [path, content] of Object.entries(files)) {
    if (!isCode(path)) { out[path] = content; continue; }
    try {
      out[outputPath(path)] = await rewriteImports(compile(path, content), mapFrom(path));
      if (outputPath(path) !== path) out[path] = content;
    } catch (e) {
      errors.push(errorOf(path, e));
    }
  }
  for (const path of helpers) {
    const name = JSON.stringify(`./${path.split('/').pop()}`);
    out[`${path}.js`] = extOf(path) === 'css'
      ? `const l=document.createElement('link');l.rel='stylesheet';l.href=new URL(${name},import.meta.url).href;document.head.append(l);export default l.href;\n`
      : extOf(path) === 'json'
        ? `export default ${files[path]};\n`
        : `export default new URL(${name},import.meta.url).href;\n`;
  }
  for (const path of Object.keys(files).filter(p => /\.html?$/i.test(p))) {
    const doc = new DOMParser().parseFromString(files[path], 'text/html');
    let changed = false;
    for (const el of doc.querySelectorAll('script')) {
      const src = el.getAttribute('src');
      const target = src && resolvePath(path, src, files);
      if (target && outputPath(target) !== target) {
        el.setAttribute('src', relative(path, outputPath(target)));
        el.setAttribute('type', 'module');
        changed = true;
      } else if (!src && el.getAttribute('type') === 'module') {
        try {
          const next = await rewriteImports(el.textContent ?? '', mapFrom(path));
          if (next !== el.textContent) { el.textContent = next; changed = true; }
        } catch (e) { errors.push(errorOf(path, e)); }
      }
    }
    if (changed) out[path] = `<!doctype html>\n${doc.documentElement.outerHTML}\n`;
  }
  out['.nojekyll'] = '';
  return { files: out, errors };
}
