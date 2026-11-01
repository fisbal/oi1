// Office Code+: write websites and apps in the browser, see them run as you type (also at phone size),
// keep them on GitHub and publish them on GitHub Pages, all without installing anything.

import { snippet } from '@codemirror/autocomplete';
import { redo, toggleComment, undo } from '@codemirror/commands';
import { setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { openSearchPanel, gotoLine } from '@codemirror/search';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { FileRef, Handoff, OpenedFile, RecentFile, ShellApi, TableData } from '../../shell/contract';
import { t } from '../../shell/i18n';
import { useLanguage } from '../../shell/useLanguage';
import { parseCsv } from '../../formats/csv';
import { FileMenu } from '../../ui/FileMenu';
import { Btn, Drop, Group, Icon, MenuItem, RibbonToggle } from '../../ui/kit';
import { AppKeys, appColor } from '../../ui/AppKeys';
import { TutoTab } from '../../ui/tuto/Tuto';
import { qrDataUrl } from '../../ui/qr';
import { buildPreview, buildSite, dirname, extOf, isBinary, normalize, resolvePath, type BuildError, type Files } from './build';
import { CodeEditor, type EditorApi } from './Editor';
import * as github from './github';
import { canFormat, formatCode, languageName } from './languages';
import { QR_LIMIT, emptyProject, packRun, readEntry, readPicked, readZip, runLink, writeZip, type Project } from './project';
import { TEMPLATES, type Template } from './templates';
import { Copilot, CopilotButton, useCopilotShortcut } from '../../ui/Copilot';
import { codeCopilot } from './copilot';
import { RULES, applyFixes, lintProject, ruleById, ruleName, ruleWhy, rulesOff, setRuleOff, type Problem } from './lint';
import { HELPERS, askClaude, askHelper, helperKeys, localFindings, mergeFindings, pickFiles, reviewPrompt, toFindings, applyFinding } from './corrector';
import { KeysDialog, Proposals, Versions, type Decision, type Proposal } from './correctorUi';
import { replaceInFiles, searchFiles, type SearchOptions } from './search';
import { SNIPPETS, snipLangOf } from './snippets';
import { GITIGNORES, LICENSES, gitignore, license, readme } from './starters';
import { runTests, testFiles, testTemplate, type TestRun } from './tests';
import { TrainingPanel, TrainingRibbon, useTraining } from './trainingUi';
import { bestVersion, loadVersions, newVersion, sameFiles, saveVersions, type Score, type Version } from './versions';
import { LANGUAGES, getLanguage } from '../../shell/i18n';
import { ConvertPanel } from '../../ui/convert/ConvertPanel';
import { asFile, type ConvertSource } from '../../shell/convert';
import { translateHtml } from '../../shell/translate';
import { markdownToHtml } from '../../ui/markdown';

export const EXTENSIONS = [
  '.zip', '.js', '.mjs', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md', '.py', '.sql', '.xml', '.yaml', '.yml',
  '.java', '.kt', '.dart', '.swift', '.c', '.cpp', '.h', '.cs', '.rs', '.go', '.php', '.rb', '.sh', '.lua', '.toml', '.vue', '.svelte',
];
const ZIP_TYPE = 'application/zip';

interface Log { level: string; text: string; file?: string; line?: number }
type Device = 'fit' | 'tablet' | 'phone';
const DEVICES: Record<Exclude<Device, 'fit'>, [number, number]> = { tablet: [820, 1180], phone: [390, 844] };

const prefs = {
  get<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem(`oi1.code.${key}`); return v === null ? fallback : (JSON.parse(v) as T); } catch { return fallback; }
  },
  set(key: string, value: unknown) { try { localStorage.setItem(`oi1.code.${key}`, JSON.stringify(value)); } catch { /* private window */ } },
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'my-site';
const htmlPages = (files: Files) => Object.keys(files).filter(p => /\.html?$/i.test(p)).sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));

/** What a new file starts with. */
function starter(path: string): string {
  const name = path.split('/').pop()!.replace(/\.[^.]+$/, '');
  switch (extOf(path)) {
    case 'html': return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${name}</title>\n</head>\n<body>\n  \n</body>\n</html>\n`;
    case 'tsx': case 'jsx': return `export default function ${name.replace(/[^A-Za-z0-9]/g, '').replace(/^./, c => c.toUpperCase()) || 'Component'}() {\n  return <div></div>;\n}\n`;
    case 'json': return '{\n  \n}\n';
    default: return '';
  }
}

/** A unique path: 'data.json', then 'data-2.json' and so on. */
function freePath(files: Files, wanted: string) {
  if (files[wanted] === undefined) return wanted;
  const dot = wanted.lastIndexOf('.');
  const [base, ext] = dot > 0 ? [wanted.slice(0, dot), wanted.slice(dot)] : [wanted, ''];
  for (let n = 2; ; n++) if (files[`${base}-${n}${ext}`] === undefined) return `${base}-${n}${ext}`;
}

/** A table from Class as a list of objects, with numbers as numbers. */
function tableToJson(table: TableData): string {
  const rows = table.rows.map(r => r.map(c => c.text));
  if (!rows.length) return '[]\n';
  const head = rows[0].map((h, i) => h.trim() || `column${i + 1}`);
  const value = (s: string) => {
    const n = Number(s.replace(/\s/g, '').replace(',', '.'));
    return s.trim() !== '' && !isNaN(n) ? n : s;
  };
  return `${JSON.stringify(rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, value(r[i] ?? '')]))), null, 2)}\n`;
}

/** A JSON list of objects or a CSV file as a table, for Class. */
function fileToTable(path: string, content: string): TableData | null {
  if (extOf(path) === 'csv') return { rows: parseCsv(content).map(r => r.map(text => ({ text }))), header: true };
  if (extOf(path) !== 'json') return null;
  try {
    const list = JSON.parse(content) as unknown;
    if (!Array.isArray(list) || !list.length || typeof list[0] !== 'object') return null;
    const keys = [...new Set(list.flatMap(o => Object.keys(o as object)))];
    return { header: true, rows: [keys.map(k => ({ text: k, bold: true })), ...list.map(o => keys.map(k => ({ text: String((o as Record<string, unknown>)[k] ?? '') })))] };
  } catch { return null; }
}

async function projectFrom(file: OpenedFile): Promise<Project> {
  const name = file.name.replace(/\.[^.]+$/, '');
  if (file.name.toLowerCase().endsWith('.zip')) {
    const files = await readZip(await file.arrayBuffer());
    const first = files['index.html'] !== undefined ? 'index.html' : htmlPages(files)[0] ?? Object.keys(files)[0] ?? null;
    return { ...emptyProject(), name, files, open: first ? [first] : [], active: first };
  }
  const content = await readEntry(file.name, await file.arrayBuffer());
  return { ...emptyProject(), name, files: { [file.name]: content }, open: [file.name], active: file.name };
}

async function projectFromHandoff(h: Handoff): Promise<Project> {
  if (h.kind === 'file') return projectFrom(h.file);
  const name = h.title ?? '';
  if (h.kind === 'html') {
    const html = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${escapeHtml(name || 'Page')}</title>\n  <style>body { font-family: system-ui, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }</style>\n</head>\n<body>\n${h.html}\n</body>\n</html>\n`;
    return { ...emptyProject(), name, files: { 'index.html': html }, open: ['index.html'], active: 'index.html' };
  }
  const files: Files = {
    'data.json': tableToJson(h.table),
    'index.html': `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>${escapeHtml(name || 'Table')}</title>\n  <style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px 10px}th{background:#f4f0e6}</style>\n</head>\n<body>\n  <table id="table"></table>\n  <script type="module">\n    import rows from './data.json';\n    const keys = Object.keys(rows[0] ?? {});\n    document.getElementById('table').innerHTML =\n      '<tr>' + keys.map(k => '<th>' + k + '</th>').join('') + '</tr>' +\n      rows.map(r => '<tr>' + keys.map(k => '<td>' + r[k] + '</td>').join('') + '</tr>').join('');\n  </script>\n</body>\n</html>\n`,
  };
  return { ...emptyProject(), name, files, open: ['data.json', 'index.html'], active: 'index.html' };
}

/** A template as a file handed to a new tab, so "New project" opens it in its own tab. */
function templateFile(tpl: Template): OpenedFile {
  let zip: Promise<Blob> | null = null;
  const blob = () => (zip ??= writeZip(tpl.files));
  return { name: `${t(tpl.name)}.zip`, type: ZIP_TYPE, text: async () => (await blob()).text(), arrayBuffer: async () => (await blob()).arrayBuffer() };
}

export default function Code({ shell, file, handoff }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff }) {
  const [initial, setInitial] = useState<{ project: Project; ref: FileRef | null } | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const raw = await shell.storage.load('project');
        if (raw) { setInitial({ project: { ...emptyProject(), ...(JSON.parse(raw) as Project) }, ref: null }); return; }
      } catch { /* unreadable autosave */ }
      try {
        if (file) { setInitial({ project: await projectFrom(file), ref: file.name.toLowerCase().endsWith('.zip') ? file : null }); return; }
        if (handoff) { setInitial({ project: await projectFromHandoff(handoff), ref: null }); return; }
      } catch (e) { alert(t('code.openFailed', { error: e instanceof Error ? e.message : String(e) })); }
      setInitial({ project: emptyProject(), ref: null });
    })();
  }, [shell, file, handoff]);
  if (!initial) return <div className="code" />;
  return <CodeApp shell={shell} initial={initial.project} initialRef={initial.ref} />;
}

function CodeApp({ shell, initial, initialRef }: { shell: ShellApi; initial: Project; initialRef: FileRef | null }) {
  useLanguage();
  const [project, setProjectState] = useState(initial);
  const projectRef = useRef(project);
  const [fileRef, setFileRef] = useState<FileRef | null>(initialRef);
  const [tab, setTab] = useState<'home' | 'run' | 'tools' | 'corrector' | 'training' | 'github' | 'oi1' | 'convert'>('home');
  const [dock, setDock] = useState<null | 'problems' | 'search' | 'tests' | 'corrector' | 'versions' | 'training'>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [mcBusy, setMcBusy] = useState<string | null>(null);
  const [mcWarning, setMcWarning] = useState<{ text: string; path: string; before: string; id: string } | null>(null);
  const [helpers, setHelpers] = useState<string[]>(() => prefs.get('helpers', []));
  const [keysOpen, setKeysOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [off, setOff] = useState(rulesOff);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [testing, setTesting] = useState(false);
  const [watchTests, setWatchTests] = useState(() => prefs.get('watchTests', false));
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [searchOpts, setSearchOpts] = useState<SearchOptions>({ regex: false, caseSensitive: false, wholeWord: false });
  const [panel, setPanel] = useState<null | 'file' | 'templates' | 'connect' | 'repo' | 'push' | 'qr'>(null);
  const narrow = () => window.matchMedia('(max-width: 820px)').matches;
  const [showTree, setShowTree] = useState(() => !narrow() && prefs.get('tree', true));
  const [showPreview, setShowPreview] = useState(() => prefs.get('preview', true));
  const [wrap, setWrap] = useState(() => prefs.get('wrap', false));
  const [size, setSize] = useState(() => prefs.get('size', 14));
  const [autoRun, setAutoRun] = useState(() => prefs.get('autoRun', true));
  const [device, setDevice] = useState<Device>(() => prefs.get('device', 'fit'));
  const [landscape, setLandscape] = useState(false);
  const [split, setSplit] = useState(() => prefs.get('split', 0.45));
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'code' | 'preview'>('code');
  const [cursor, setCursor] = useState({ line: 1, col: 1, selected: 0 });
  const [account, setAccount] = useState(github.savedAccount);
  const [busy, setBusy] = useState<{ label: string; done?: number; total?: number } | null>(null);
  const [creating, setCreating] = useState<{ dir: string; kind: 'file' | 'folder' } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [qr, setQr] = useState<{ url: string; image: string; kind: 'preview' | 'site'; tooBig?: boolean } | null>(null);
  const editor = useRef<EditorApi>({ view: null });
  const [copilot, setCopilot] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useCopilotShortcut(() => setCopilot(o => !o), rootRef);
  const upload = useRef<HTMLInputElement>(null);
  const uploadDir = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef('');
  const frame = useRef<HTMLIFrameElement>(null);
  const work = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!narrow()) prefs.set('tree', showTree); }, [showTree]);
  useEffect(() => prefs.set('preview', showPreview), [showPreview]);
  useEffect(() => prefs.set('wrap', wrap), [wrap]);
  useEffect(() => prefs.set('size', size), [size]);
  useEffect(() => prefs.set('autoRun', autoRun), [autoRun]);
  useEffect(() => prefs.set('device', device), [device]);
  useEffect(() => prefs.set('split', split), [split]);
  useEffect(() => prefs.set('watchTests', watchTests), [watchTests]);
  useEffect(() => prefs.set('helpers', helpers), [helpers]);

  // ---------- the project ----------
  const saveTimer = useRef(0);
  const update = useCallback((change: (p: Project) => Project) => {
    const next = change(projectRef.current);
    projectRef.current = next;
    setProjectState(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void shell.storage.save('project', JSON.stringify(projectRef.current)), 400);
  }, [shell]);

  const empty = Object.keys(project.files).length === 0 && project.folders.length === 0;
  const title = project.name || t('code.untitled');
  useEffect(() => { shell.setTitle(title); }, [shell, title]);
  // Renaming the tab renames the project (its zip and its title).
  useEffect(() => { shell.onRename?.(name => update(p => ({ ...p, name }))); return () => shell.onRename?.(null); }, [shell, update]);
  const active = project.active && project.files[project.active] !== undefined ? project.active : null;

  const openPath = useCallback((path: string) => update(p => ({ ...p, open: p.open.includes(path) ? p.open : [...p.open, path], active: path })), [update]);
  const closePath = (path: string) => update(p => {
    const i = p.open.indexOf(path);
    const open = p.open.filter(x => x !== path);
    return { ...p, open, active: p.active === path ? open[Math.min(i, open.length - 1)] ?? null : p.active };
  });
  const writeFile = useCallback((path: string, text: string) => update(p => ({ ...p, files: { ...p.files, [path]: text } })), [update]);

  const startFrom = (tpl: Template) => {
    if (!empty) { shell.openModule('code', templateFile(tpl)); return; }
    update(p => ({ ...p, name: t(tpl.name), files: { ...tpl.files }, folders: [], open: [tpl.open], active: tpl.open, storage: {} }));
  };

  const currentDir = () => (active ? dirname(active) : '');
  const addFiles = (dir: string, files: Files) => {
    const entries = Object.entries(files).map(([path, content]) => [normalize(`${dir}/${path}`), content] as const);
    if (!entries.length) return;
    update(p => ({ ...p, files: { ...p.files, ...Object.fromEntries(entries) } }));
    openPath(entries[0][0]);
  };
  const create = (dir: string, kind: 'file' | 'folder', name: string) => {
    setCreating(null);
    const path = normalize(`${dir}/${name.trim()}`);
    if (!name.trim() || !path) return;
    if (project.files[path] !== undefined || project.folders.includes(path)) { alert(t('code.exists', { name: path })); return; }
    if (kind === 'folder') update(p => ({ ...p, folders: [...p.folders, path] }));
    else { update(p => ({ ...p, files: { ...p.files, [path]: starter(path) } })); openPath(path); }
  };
  const isFolder = (path: string) => !(path in project.files);
  const rename = (from: string, name: string) => {
    setRenaming(null);
    const to = normalize(`${dirname(from)}/${name.trim()}`);
    if (!name.trim() || to === from) return;
    if (project.files[to] !== undefined || project.folders.includes(to)) { alert(t('code.exists', { name: to })); return; }
    const move = (path: string) => (path === from ? to : path.startsWith(`${from}/`) ? to + path.slice(from.length) : path);
    update(p => ({
      ...p,
      files: Object.fromEntries(Object.entries(p.files).map(([k, v]) => [move(k), v])),
      folders: p.folders.map(move),
      open: p.open.map(move),
      active: p.active && move(p.active),
    }));
  };
  const remove = (path: string) => {
    const folder = isFolder(path);
    if (!confirm(t(folder ? 'code.deleteFolderAsk' : 'code.deleteAsk', { name: path }))) return;
    const gone = (x: string) => x === path || x.startsWith(`${path}/`);
    update(p => {
      const open = p.open.filter(x => !gone(x));
      return {
        ...p,
        files: Object.fromEntries(Object.entries(p.files).filter(([k]) => !gone(k))),
        folders: p.folders.filter(x => !gone(x)),
        open,
        active: p.active && gone(p.active) ? open[0] ?? null : p.active,
      };
    });
  };
  const pickUpload = (dir: string, folder = false) => {
    uploadTarget.current = dir;
    (folder ? uploadDir : upload).current?.click();
  };

  // ---------- running ----------
  const [page, setPage] = useState<string | null>(() => (active && /\.html?$/i.test(active) ? active : null));
  const [preview, setPreview] = useState<{ html: string; errors: BuildError[]; page: string } | null>(null);
  const [runs, setRuns] = useState(0);
  const [logs, setLogs] = useState<Log[]>([]);
  const runId = useRef(0);
  const shownPage = (p: Project, wanted: string | null) => {
    if (wanted && p.files[wanted] !== undefined && /\.html?$/i.test(wanted)) return wanted;
    return p.files['index.html'] !== undefined ? 'index.html' : htmlPages(p.files)[0] ?? null;
  };
  const run = useCallback(async (at?: string | null) => {
    const p = projectRef.current;
    const target = shownPage(p, at === undefined ? page : at);
    const id = ++runId.current;
    if (!target) { setPreview(null); setLogs([]); return; }
    const result = await buildPreview(p.files, target, p.storage ?? {});
    if (id !== runId.current) return;
    setLogs(result.errors.map(e => ({ level: 'error', text: e.message, file: e.path, line: e.line })));
    if (result.errors.length) setConsoleOpen(true);
    setPreview({ ...result, page: target });
    setRuns(n => n + 1);
  }, [page]);

  // An open web page is the one the preview shows.
  const lastActive = useRef(active);
  useEffect(() => {
    if (active === lastActive.current) return;
    lastActive.current = active;
    if (active && /\.html?$/i.test(active)) setPage(active);
  }, [active]);
  useEffect(() => {
    if (!showPreview && mobileView !== 'preview') return;
    const timer = window.setTimeout(() => void run(), runs === 0 ? 0 : autoRun ? 650 : 1e9);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.files, autoRun, page, showPreview, mobileView]);

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      const m = e.data as { __oi1?: number; type?: string; level?: string; text?: string; file?: string; line?: number; href?: string; data?: Record<string, string> };
      if (!m?.__oi1 || e.source !== frame.current?.contentWindow) return;
      if (m.type === 'console') {
        setLogs(ls => [...ls.slice(-499), { level: m.level ?? 'log', text: m.text ?? '', file: m.file || undefined, line: m.line }]);
        if (m.level === 'error') setConsoleOpen(true);
      } else if (m.type === 'storage' && m.data) {
        update(p => ({ ...p, storage: m.data }));
      } else if (m.type === 'navigate' && m.href) {
        const from = preview?.page ?? 'index.html';
        const next = resolvePath(from, m.href, projectRef.current.files);
        if (next && /\.html?$/i.test(next)) { setPage(next); void run(next); }
        else shell.notify(t('code.noPage', { name: m.href }));
      }
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, [preview?.page, run, shell, update]);

  const goTo = (file?: string, line?: number) => {
    if (!file || projectRef.current.files[file] === undefined) return;
    openPath(file);
    setMobileView('code');
    window.setTimeout(() => {
      const v = editor.current.view;
      if (!v || !line) return;
      const l = v.state.doc.line(Math.min(Math.max(1, line), v.state.doc.lines));
      v.dispatch({ selection: { anchor: l.from }, scrollIntoView: true });
      v.focus();
    }, 60);
  };

  const openWindow = () => {
    if (!preview) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.title = title;
    const f = w.document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups allow-downloads');
    f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
    f.srcdoc = preview.html;
    w.document.body.style.margin = '0';
    w.document.body.append(f);
  };

  const showQr = async (kind: 'preview' | 'site') => {
    const p = projectRef.current;
    let url = p.github?.pages ?? '';
    let tooBig = false;
    if (kind === 'preview') {
      const target = shownPage(p, page);
      if (!target) { shell.notify(t('code.noHtml')); return; }
      url = runLink(await packRun(p.files, target));
      tooBig = url.length > QR_LIMIT;
    }
    const image = tooBig ? '' : await qrDataUrl(url, '#000000', '#FFFFFF', url.length > 1200 ? 'L' : 'M');
    setQr({ url, image, kind, tooBig });
    setPanel('qr');
  };

  // ---------- editing ----------
  const view = () => editor.current.view;
  const format = async () => {
    if (!active || !canFormat(active)) { shell.notify(t('code.cannotFormat')); return; }
    try { writeFile(active, await formatCode(active, project.files[active])); }
    catch (e) { shell.notify(t('code.formatFailed', { error: (e instanceof Error ? e.message : String(e)).split('\n')[0] })); }
  };
  const command = (fn: (v: NonNullable<EditorApi['view']>) => unknown) => () => { const v = view(); if (v) { fn(v); v.focus(); } };

  // ---------- problems, snippets, search, tests ----------
  useEffect(() => {
    const id = window.setTimeout(() => setProblems(lintProject(project.files, off)), 250);
    return () => window.clearTimeout(id);
  }, [project.files, off]);
  // The open file's problems are also underlined in the editor, with their fix one click away.
  useEffect(() => {
    const v = editor.current.view;
    if (!v || !active) return;
    const len = v.state.doc.length;
    const diags: Diagnostic[] = problems.filter(p => p.path === active && p.to <= len).map(p => {
      const rule = ruleById(p.rule)!;
      const fix = p.fix;
      return {
        from: p.from, to: p.to, severity: p.severity, source: ruleName(rule), message: ruleWhy(rule),
        actions: fix ? [{ name: t('code.fix'), apply: (cm, from) => cm.dispatch({ changes: { from: from + fix.from - p.from, to: from + fix.to - p.from, insert: fix.insert } }) }] : [],
      };
    });
    v.dispatch(setDiagnostics(v.state, diags));
  }, [problems, active]);

  /** Fixes problems on the current text (checked again first, so a fix never lands in the wrong place). */
  const fixProblems = (path: string | null, rule?: string, at?: { line: number; col: number }) => {
    let fixed = 0;
    update(p => {
      const files = { ...p.files };
      for (const file of path ? [path] : Object.keys(files)) {
        for (let pass = 0; pass < 5; pass++) {
          const fixes = lintProject({ [file]: files[file] }, off)
            .filter(x => x.fix && (!rule || x.rule === rule) && (!at || (x.line === at.line && x.col === at.col)))
            .map(x => x.fix!);
          if (!fixes.length) break;
          const next = applyFixes(files[file], at ? fixes.slice(0, 1) : fixes);
          if (next === files[file]) break;
          files[file] = next; fixed += at ? 1 : fixes.length;
          if (at) break;
        }
      }
      return { ...p, files };
    });
    window.setTimeout(() => shell.notify(fixed ? t('code.fixed', { n: fixed }) : t('code.nothingToFix')), 0);
  };
  const toggleRule = (id: string) => { const on = off.has(id); setRuleOff(id, !on); setOff(rulesOff()); };

  const insertSnippet = (body: string) => {
    const v = view();
    if (!v) { shell.notify(t('code.pickFile')); return; }
    const { from, to } = v.state.selection.main;
    snippet(body)(v, null, from, to);
    v.focus();
  };

  const matches = useMemo(() => (dock === 'search' ? searchFiles(project.files, query, searchOpts) : []), [dock, project.files, query, searchOpts]);
  const replaceAll = (only?: string) => {
    const r = replaceInFiles(projectRef.current.files, query, replacement, searchOpts, only ? new Set([only]) : undefined);
    if (r.count) update(p => ({ ...p, files: r.files }));
    shell.notify(t('code.replaced', { n: r.count }));
  };

  const test = useCallback(async (quiet = false) => {
    if (!testFiles(projectRef.current.files).length) {
      if (!quiet) { setDock('tests'); setTestRun({ results: [], errors: [], ms: 0 }); }
      return;
    }
    setTesting(true);
    if (!quiet) setDock('tests');
    try { setTestRun(await runTests(projectRef.current.files)); } finally { setTesting(false); }
  }, []);
  // Watch mode: the tests run again a moment after each change.
  useEffect(() => {
    if (!watchTests || !testFiles(project.files).length) return;
    const id = window.setTimeout(() => void test(true), 900);
    return () => window.clearTimeout(id);
  }, [project.files, watchTests, test]);
  const newTest = () => {
    const tpl = testTemplate(active ?? 'app.js');
    const path = freePath(projectRef.current.files, tpl.path);
    update(p => ({ ...p, files: { ...p.files, [path]: tpl.content }, open: [...p.open, path], active: path }));
  };

  const addStarter = async (path: string, make: () => Promise<string> | string) => {
    if (projectRef.current.files[path] !== undefined && !confirm(t('code.replaceFile', { name: path }))) return;
    setBusy({ label: path });
    try {
      const content = await make();
      update(p => ({ ...p, files: { ...p.files, [path]: content }, open: p.open.includes(path) ? p.open : [...p.open, path], active: path }));
    } finally { setBusy(null); }
  };
  const owner = () => account?.name || account?.login || title;

  // ---------- training ----------
  const training = useTraining({
    shell, files: project.files, openPath, goTo: (path, line) => goTo(path, line),
    write: (path, text, open) => update(p => ({
      ...p, name: p.name || (Object.keys(p.files).length ? p.name : t('code.tr.project')), files: { ...p.files, [path]: text },
      ...(open ? { open: p.open.includes(path) ? p.open : [...p.open, path], active: path } : {}),
    })),
  });

  // ---------- the Master corrector and versions ----------
  const projectKey = slug(title);
  useEffect(() => { setVersions(loadVersions(projectKey)); }, [projectKey]);
  const scoreNow = async (files: Files): Promise<{ score: Score; run: TestRun | null }> => {
    const found = lintProject(files, off);
    const run = testFiles(files).length ? await runTests(files) : null;
    return {
      run,
      score: { passed: run?.results.filter(r => r.ok).length ?? 0, failed: (run?.results.filter(r => !r.ok).length ?? 0) + (run?.errors.length ?? 0), errors: found.filter(p => p.severity === 'error').length, warnings: found.filter(p => p.severity === 'warning').length },
    };
  };
  /** Keeps a version of the project as it is now (skipped when nothing changed since the last one). */
  const snapshot = async (label: string): Promise<{ score: Score; run: TestRun | null }> => {
    const files = projectRef.current.files;
    const result = await scoreNow(files);
    setVersions(list => {
      const last = list[list.length - 1];
      if (last && sameFiles(last.files, files)) return list;
      return saveVersions(projectKey, [...list, newVersion(label, files, result.score)]);
    });
    return result;
  };
  const baseline = useRef<Score | null>(null);

  const analyse = async (only: string | null) => {
    if (empty || mcBusy) return;
    const files = projectRef.current.files;
    const paths = only ? [only] : Object.keys(files);
    setDock('corrector'); setMcWarning(null); setDecided({}); setProposals([]);
    setMcBusy(t('code.mc.step.version'));
    const { score, run } = await snapshot(t('code.v.beforeAnalysis'));
    baseline.current = score;
    if (run) setTestRun(run);
    setMcBusy(t('code.mc.step.local'));
    const lists = [localFindings(files, paths, off)];
    setProposals(mergeFindings(lists));
    const picked = pickFiles(files, paths);
    const quick = lintProject(picked, off).map(p => `${p.path}:${p.line} ${p.message}`);
    const language = LANGUAGES.find(l => l.code === getLanguage())?.name ?? 'English';
    const prompt = reviewPrompt(picked, run, quick, language);
    const keys = helperKeys();
    const asks: Promise<void>[] = [];
    if (shell.ai.ready()) {
      asks.push(askClaude(shell.ai, prompt).then(a => { lists.push(toFindings(a, files, 'Claude')); setProposals(mergeFindings(lists)); })
        .catch(e => shell.notify(`Claude: ${e instanceof Error ? e.message : String(e)}`)));
    }
    for (const h of HELPERS.filter(x => helpers.includes(x.id) && (keys[x.id] || x.local))) {
      asks.push(askHelper(h, keys[h.id] ?? '', prompt).then(a => { lists.push(toFindings(a, files, h.name)); setProposals(mergeFindings(lists)); })
        .catch(e => shell.notify(t('code.mc.helperFailed', { name: h.name, error: e instanceof Error ? e.message : String(e) }))));
    }
    if (asks.length) { setMcBusy(t('code.mc.step.ai', { n: asks.length })); await Promise.all(asks); }
    else shell.notify(t('code.mc.noAi'));
    setMcBusy(null);
  };

  const accept = async (f: Proposal, edit = false) => {
    const now = projectRef.current.files[f.path];
    const next = now === undefined ? null : applyFinding(now, f, off);
    if (next === null) { setDecided(d => ({ ...d, [f.id]: 'outdated' })); return; }
    writeFile(f.path, next);
    setDecided(d => ({ ...d, [f.id]: 'accepted' }));
    if (edit) { goTo(f.path, f.line); return; }
    // The tests run again: if they get worse, going back is offered at once.
    if (!testFiles(projectRef.current.files).length) return;
    await new Promise(r => window.setTimeout(r, 30));
    const { score, run } = await scoreNow(projectRef.current.files);
    if (run) setTestRun(run);
    const base = baseline.current;
    if (base && (score.passed < base.passed || score.failed > base.failed)) {
      setMcWarning({ text: t('code.mc.worse', { title: f.title }), path: f.path, before: now!, id: f.id });
    } else baseline.current = score;
  };
  const undoWarning = () => {
    if (!mcWarning) return;
    writeFile(mcWarning.path, mcWarning.before);
    setDecided(d => ({ ...d, [mcWarning.id]: 'rejected' }));
    setMcWarning(null);
  };
  const acceptSafe = () => {
    let n = 0;
    for (const f of proposals) if (!decided[f.id] && f.source === 'local' && f.severity !== 'info') { void accept(f); n++; }
    shell.notify(t('code.fixed', { n }));
  };
  const rejectAll = () => setDecided(d => Object.fromEntries([...Object.entries(d), ...proposals.filter(f => !d[f.id]).map(f => [f.id, 'rejected' as Decision])]));

  const restore = async (v: Version) => {
    if (!confirm(t('code.v.restoreAsk', { label: v.label }))) return;
    await snapshot(t('code.v.beforeRestore'));
    update(p => {
      const open = p.open.filter(x => v.files[x] !== undefined);
      return { ...p, files: { ...v.files }, open, active: p.active && v.files[p.active] !== undefined ? p.active : open[0] ?? null };
    });
    shell.notify(t('code.v.restored', { label: v.label }));
  };
  const writeOrRemove = (path: string, text: string | null) => {
    if (text === null) update(p => { const files = { ...p.files }; delete files[path]; return { ...p, files, open: p.open.filter(x => x !== path), active: p.active === path ? null : p.active }; });
    else update(p => ({ ...p, files: { ...p.files, [path]: text }, open: p.open.includes(path) ? p.open : [...p.open, path] }));
  };
  const best = bestVersion(versions);

  // ---------- saving and opening ----------
  const baseName = () => slug(title);
  const saveZip = async (saveAs = false) => {
    const ref = await shell.saveFile(fileRef?.name ?? `${baseName()}.zip`, () => writeZip(projectRef.current.files), ZIP_TYPE, { target: fileRef, saveAs });
    if (ref) {
      setFileRef(ref);
      if (!project.name) update(p => ({ ...p, name: ref.name.replace(/\.zip$/i, '') }));
    }
  };
  // AutoSave: once the project has a .zip file, the shell writes it there after each pause in the work.
  const quietSave = useRef<() => Promise<FileRef | null>>(async () => null);
  quietSave.current = async () => (fileRef?.handle || shell.cloudOn?.()
    ? shell.saveFile(fileRef?.handle ? fileRef.name : `${baseName()}.zip`, () => writeZip(projectRef.current.files), ZIP_TYPE, { target: fileRef?.handle ? fileRef : undefined, quiet: true })
    : null);
  useEffect(() => { shell.autoSave(() => quietSave.current()); return () => shell.autoSave(null); }, [shell]);
  const saveSite = async () => {
    const site = await buildSite(projectRef.current.files);
    if (site.errors.length) shell.notify(t('code.buildErrors', { n: site.errors.length }));
    void shell.saveFile(`${baseName()}-site.zip`, () => writeZip(site.files), ZIP_TYPE, { saveAs: true });
  };
  const saveThis = () => {
    if (!active) return;
    const content = project.files[active];
    const blob = isBinary(content) ? fetch(content).then(r => r.blob()) : Promise.resolve(content);
    void shell.saveFile(active.split('/').pop()!, () => blob, 'text/plain', { saveAs: true });
  };
  const openAny = async () => {
    const f = await shell.openFile(EXTENSIONS);
    if (!f) return;
    if (empty) {
      const p = await projectFrom(f);
      update(() => p);
      if (f.name.toLowerCase().endsWith('.zip')) setFileRef(f);
    } else if (f.name.toLowerCase().endsWith('.zip')) shell.openModule('code', f);
    else addFiles(currentDir(), { [f.name]: await readEntry(f.name, await f.arrayBuffer()) });
  };
  const openRecent = async (r: RecentFile) => {
    const f = await shell.recent.open(r.id);
    if (!f) return;
    if (empty) { update(() => ({ ...emptyProject() })); const p = await projectFrom(f); update(() => p); setFileRef(f); }
    else shell.openModule('code', f);
  };

  // ---------- GitHub ----------
  const fail = (e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    const status = e instanceof github.GitHubError ? e.status : 0;
    shell.notify(status === 401 ? t('code.gh.badToken') : status === 403 || status === 404 ? t('code.gh.noAccess', { error: message }) : t('code.gh.failed', { error: message }));
  };
  const withBusy = async (label: string, fn: (progress: (done: number, total: number) => void) => Promise<void>) => {
    setBusy({ label });
    try { await fn((done, total) => setBusy({ label, done, total })); } catch (e) { fail(e); } finally { setBusy(null); }
  };
  const pushNow = (message: string) => withBusy(t('code.gh.pushing'), async progress => {
    const g = projectRef.current.github;
    if (!account || !g) return;
    const sha = await github.push(account.token, g, projectRef.current.files, message || t('code.gh.defaultMessage'), progress);
    shell.notify(sha ? t('code.gh.pushed', { repo: `${g.owner}/${g.repo}` }) : t('code.gh.nothing'));
  });
  const pullNow = () => {
    const g = projectRef.current.github;
    if (!account || !g) return;
    if (!empty && !confirm(t('code.gh.pullAsk', { repo: `${g.owner}/${g.repo}` }))) return;
    void withBusy(t('code.gh.pulling'), async progress => {
      const { files, skipped } = await github.pull(account.token, g, progress);
      const first = files['index.html'] !== undefined ? 'index.html' : htmlPages(files)[0] ?? Object.keys(files)[0] ?? null;
      update(p => ({ ...p, files, folders: [], open: first ? [first] : [], active: first }));
      shell.notify(skipped.length ? t('code.gh.pulledSkipped', { n: skipped.length }) : t('code.gh.pulled', { n: Object.keys(files).length }));
    });
  };
  const publish = () => withBusy(t('code.gh.publishing'), async progress => {
    const g = projectRef.current.github;
    if (!account || !g) return;
    const site = await buildSite(projectRef.current.files);
    if (site.errors.length) throw new Error(`${site.errors[0].path}: ${site.errors[0].message}`);
    await github.push(account.token, { ...g, branch: 'gh-pages' }, site.files, t('code.gh.publishMessage'), progress);
    let url = github.pagesGuess(g);
    try { url = await github.enablePages(account.token, g.owner, g.repo, 'gh-pages'); } catch (e) { if (!(e instanceof github.GitHubError) || e.status !== 409) throw e; }
    update(p => ({ ...p, github: p.github && { ...p.github, pages: url } }));
    shell.notify(t('code.gh.published'));
    const image = await qrDataUrl(url);
    setQr({ url, image, kind: 'site' });
    setPanel('qr');
  });

  // ---------- linking with the other apps ----------
  const letters = shell.tabs('letter');
  const sheets = shell.tabs('class');
  const selectionOrFile = () => {
    const v = view();
    const sel = v?.state.selection.main;
    if (v && sel && !sel.empty) return v.state.sliceDoc(sel.from, sel.to);
    return active && !isBinary(project.files[active]) ? project.files[active] : '';
  };
  const sendToLetter = async (tabId: string | null) => {
    const code = selectionOrFile();
    if (!code) return;
    const handoff: Handoff = { kind: 'html', title: active ?? title, html: `<p><strong>${escapeHtml(active ?? title)}</strong></p><pre><code>${escapeHtml(code)}</code></pre>` };
    if (tabId && await shell.send(tabId, handoff)) { shell.showTab(tabId); shell.notify(t('code.sentToLetter')); }
    else shell.openModule('letter', undefined, handoff);
  };
  const insertTable = (table: TableData, name?: string) => {
    const path = freePath(projectRef.current.files, `${slug(name || 'data')}.json`);
    addFiles('', { [path]: tableToJson(table) });
    shell.notify(t('code.tableAdded', { name: path }));
  };
  const askClass = async (tabId: string) => {
    const h = await shell.ask(tabId, 'table');
    if (h?.kind === 'table') insertTable(h.table, h.title);
    else shell.notify(t('code.noTable'));
  };
  useEffect(() => shell.onReceive(async h => {
    if (h.kind === 'table') { insertTable(h.table, h.title); return true; }
    if (h.kind === 'html') {
      const path = freePath(projectRef.current.files, `${slug(h.title || 'page')}.html`);
      addFiles('', { [path]: (await projectFromHandoff(h)).files['index.html'] });
      return true;
    }
    addFiles(currentDir(), { [h.file.name]: await readEntry(h.file.name, await h.file.arrayBuffer()) });
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [shell]);
  useEffect(() => shell.onAsk(() => {
    const p = projectRef.current;
    const path = p.active;
    const table = path && p.files[path] !== undefined ? fileToTable(path, p.files[path]) : null;
    return table ? { kind: 'table', title: path!, table } : null;
  }), [shell]);

  // ---------- keys ----------
  const onKey = (e: React.KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); e.stopPropagation(); void saveZip(e.shiftKey); }
    else if ((mod && k === 'enter') || e.key === 'F5') { e.preventDefault(); e.stopPropagation(); void run(); }
    else if (mod && e.shiftKey && k === 'f') { e.preventDefault(); e.stopPropagation(); void format(); }
    else if (mod && k === '`') { e.preventDefault(); setConsoleOpen(o => !o); }
    else if (mod && k === 'b') { e.preventDefault(); setShowTree(s => !s); }
  };

  // ---------- the split between code and preview ----------
  const drag = (e: React.PointerEvent) => {
    const box = work.current?.getBoundingClientRect();
    if (!box) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setSplit(Math.min(0.8, Math.max(0.2, 1 - (ev.clientX - box.left) / box.width)));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const errorCount = logs.filter(l => l.level === 'error').length;
  const g = project.github;
  const content = active ? project.files[active] : '';
  // ---------- Convert tab: the open file (Markdown and web pages as documents, code as code, CSV/JSON as tables) ----------
  const escT = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fileNow = () => { const p = projectRef.current; const a = p.active; return a && !isBinary(p.files[a]) ? { path: a, text: p.files[a] } : null; };
  const convertSource: ConvertSource = {
    appId: 'code',
    title: () => (fileNow()?.path.split('/').pop()?.replace(/\.[^.]+$/, '') || title),
    html: () => {
      const f = fileNow();
      if (!f) return `<h1>${escT(title)}</h1><ul>${Object.keys(projectRef.current.files).map(n => `<li>${escT(n)}</li>`).join('')}</ul>`;
      const ext = extOf(f.path);
      if (ext === 'md' || ext === 'markdown') return markdownToHtml(f.text);
      if (ext === 'html' || ext === 'htm') { const b = new DOMParser().parseFromString(f.text, 'text/html').body; b.querySelectorAll('script, style, noscript').forEach(e => e.remove()); return b.innerHTML; }
      if (ext === 'txt') return f.text.split(/\n{2,}/).map(p => `<p>${escT(p).replace(/\n/g, '<br>')}</p>`).join('');
      return `<h1>${escT(f.path)}</h1><pre><code>${escT(f.text)}</code></pre>`;
    },
    text: () => fileNow()?.text ?? '',
    tables: () => {
      const f = fileNow();
      if (!f) return [];
      const ext = extOf(f.path);
      if (ext === 'csv' || ext === 'tsv') return [{ name: f.path, table: { rows: parseCsv(f.text, ext === 'tsv' ? '\t' : undefined).map(r => r.map(text => ({ text }))), header: true } }];
      if (ext === 'json') {
        try {
          const data = JSON.parse(f.text) as unknown;
          if (Array.isArray(data) && data.length && data.every(r => r && typeof r === 'object' && !Array.isArray(r))) {
            const keys = [...new Set(data.flatMap(r => Object.keys(r as object)))];
            return [{ name: f.path, table: { header: true, rows: [keys.map(k => ({ text: k, bold: true })), ...data.map(r => keys.map(k => ({ text: String((r as Record<string, unknown>)[k] ?? '') })))] } }];
          }
        } catch { /* not a table */ }
      }
      return [];
    },
    native: {
      // A translated copy of the project: the words of Markdown, text and web pages; code stays as it is.
      code: async tr => {
        if (!tr) return undefined;
        const files: Files = { ...projectRef.current.files };
        for (const [path, text] of Object.entries(files)) {
          if (isBinary(text)) continue;
          const ext = extOf(path);
          if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
            const parts = text.split(/(\n{2,})/);
            const idx = parts.map((x, i) => (/\p{L}{2,}/u.test(x) && !x.startsWith('```') ? i : -1)).filter(i => i >= 0);
            const got = await tr(idx.map(i => parts[i]));
            idx.forEach((i, k) => { parts[i] = got[k] ?? parts[i]; });
            files[path] = parts.join('');
          } else if (ext === 'html' || ext === 'htm') {
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const [body] = await translateHtml([doc.body.innerHTML], tr);
            const titleEl = doc.querySelector('title');
            if (titleEl?.textContent) titleEl.textContent = (await tr([titleEl.textContent]))[0] || titleEl.textContent;
            doc.body.innerHTML = body;
            files[path] = `<!doctype html>\n${doc.documentElement.outerHTML}\n`;
          }
        }
        const zip = await writeZip(files);
        shell.openModule('code', asFile(`${baseName()}.zip`, zip));
        return true;
      },
    },
  };

  const copilotHost = codeCopilot({
    project: title, files: Object.keys(project.files), path: active && !isBinary(content) ? active : null,
    view: () => editor.current.view, errors: () => logs.filter(l => l.level === 'error').map(l => `${l.file ?? ''}${l.line ? `:${l.line}` : ''} ${l.text}`),
  });

  return (
    <div ref={rootRef} className={`code${mobileView === 'preview' ? ' show-preview' : ''}`} onKeyDownCapture={onKey} style={{ '--code-size': `${size}px` } as CSSProperties}>
      <div className="ribbon">
        <div className="ribbon-tabs" role="tablist">
          <button type="button" className="ribbon-file" onClick={() => setPanel('file')}>{t('letter.tab.file')}</button>
          {([['home', 'letter.tab.home'], ['run', 'code.tab.run'], ['tools', 'code.tab.tools'], ['corrector', 'code.tab.corrector'], ['training', 'code.tab.training'], ['github', 'code.tab.github']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{t(label)}</button>
          ))}
          <button type="button" role="tab" aria-selected={tab === 'oi1'} className={`ribbon-special${tab === 'oi1' ? ' on' : ''}`} onClick={() => setTab('oi1')}><span className="dot" />Office In 1</button>
          <button type="button" role="tab" aria-selected={tab === 'convert'} className={`ribbon-special ribbon-convert${tab === 'convert' ? ' on' : ''}`} onClick={() => setTab('convert')}>{t('convert.tab')}</button>
        <TutoTab />
        <RibbonToggle />
          <span className="ribbon-quick">
            <CopilotButton open={copilot} onClick={() => setCopilot(o => !o)} />
            <Btn icon="undo" title="letter.undo" onClick={command(undo)} disabled={!active} />
            <Btn icon="redo" title="letter.redo" onClick={command(redo)} disabled={!active} />
            <button type="button" className="run-pill" onClick={() => { setShowPreview(true); setMobileView('preview'); void run(); }} title={`${t('code.run')} (Ctrl+Enter)`}>
              <Icon name="play" size={14} />{t('code.run')}
            </button>
          </span>
        </div>
        <div className="ribbon-panel" role="tabpanel" onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}>
          {tab === 'home' && <>
            <Group label="code.group.project">
              <Btn big icon="sparkle" title="code.newProject" onClick={() => setPanel('templates')} />
              <Btn big icon="save" title="code.saveProject" onClick={() => void saveZip()} disabled={empty} />
            </Group>
            <Group label="code.group.files">
              <Btn big icon="file" title="code.newFile" onClick={() => { setShowTree(true); setCreating({ dir: currentDir(), kind: 'file' }); }} />
              <div className="stack">
                <Btn icon="newfolder" title="code.newFolder" text onClick={() => { setShowTree(true); setCreating({ dir: currentDir(), kind: 'folder' }); }} />
                <Btn icon="upload" title="code.upload" text onClick={() => pickUpload(currentDir())} />
                <Btn icon="folder" title="code.uploadFolder" text onClick={() => pickUpload(currentDir(), true)} />
              </div>
              <div className="stack">
                <Btn icon="rename" title="code.rename" text onClick={() => { if (active) { setShowTree(true); setRenaming(active); } }} disabled={!active} />
                <Btn icon="trash" title="code.delete" text onClick={() => active && remove(active)} disabled={!active} />
                <Btn icon="download" title="code.downloadFile" text onClick={saveThis} disabled={!active} />
              </div>
            </Group>
            <Group label="letter.group.editing">
              <div className="stack">
                <Btn icon="find" title="letter.find" text onClick={command(openSearchPanel)} disabled={!active} />
                <Btn icon="replace" title="letter.replace" text onClick={command(openSearchPanel)} disabled={!active} />
                <Btn icon="goto" title="code.goToLine" text onClick={command(gotoLine)} disabled={!active} />
              </div>
              <div className="stack">
                <Btn icon="comment" title="code.toggleComment" text onClick={command(toggleComment)} disabled={!active} />
                <Btn icon="sparkle" title="code.format" text onClick={() => void format()} disabled={!active || !canFormat(active)} />
              </div>
            </Group>
            <Group label="code.group.view">
              <div className="stack">
                <Btn icon="folder" title="code.showFiles" text active={showTree} onClick={() => setShowTree(s => !s)} />
                <Btn icon="web" title="code.showPreview" text active={showPreview} onClick={() => setShowPreview(s => !s)} />
                <Btn icon="wrap" title="code.wrap" text active={wrap} onClick={() => setWrap(w => !w)} />
              </div>
              <div className="stack">
                <Btn icon="zoomin" title="code.bigger" text onClick={() => setSize(s => Math.min(26, s + 1))} />
                <Btn icon="zoomout" title="code.smaller" text onClick={() => setSize(s => Math.max(10, s - 1))} />
              </div>
            </Group>
          </>}
          {tab === 'run' && <>
            <Group label="code.group.run">
              <Btn big icon="play" title="code.run" onClick={() => { setShowPreview(true); void run(); }} />
              <Btn big icon="sync" title="code.autoRun" active={autoRun} onClick={() => setAutoRun(a => !a)} />
            </Group>
            <Group label="code.group.device">
              <Btn big icon="desktop" title="code.device.fit" active={device === 'fit'} onClick={() => setDevice('fit')} />
              <Btn big icon="tablet" title="code.device.tablet" active={device === 'tablet'} onClick={() => setDevice('tablet')} />
              <Btn big icon="phone" title="code.device.phone" active={device === 'phone'} onClick={() => setDevice('phone')} />
              <Btn big icon="rotate" title="code.rotate" active={landscape} onClick={() => setLandscape(l => !l)} disabled={device === 'fit'} />
            </Group>
            <Group label="code.group.console">
              <Btn big icon="terminal" title="code.console" active={consoleOpen} onClick={() => setConsoleOpen(o => !o)} />
              <Btn big icon="clear" title="code.clearConsole" onClick={() => setLogs([])} />
            </Group>
            <Group label="code.group.open">
              <Btn big icon="window" title="code.newWindow" onClick={openWindow} disabled={!preview} />
              <Btn big icon="qr" title="code.onPhone" onClick={() => void showQr('preview')} disabled={!preview} />
            </Group>
          </>}
          {tab === 'tools' && <>
            <Group label="code.group.check">
              <Btn big icon="shield" title={problems.length ? t('code.problemsN', { n: problems.length }) : 'code.problems'} active={dock === 'problems'} onClick={() => setDock(d => (d === 'problems' ? null : 'problems'))} />
              <div className="stack">
                <Btn icon="sparkle" title="code.fixFile" text onClick={() => fixProblems(active)} disabled={!active} />
                <Btn icon="clean" title="code.fixAll" text onClick={() => fixProblems(null)} disabled={empty} />
                <Drop icon="gear" title="code.rules" text wide>
                  {() => <>
                    <span className="kicker">{t('code.rulesHint')}</span>
                    {RULES.map(r => <MenuItem key={r.id} label={ruleName(r)} hint={t(`code.sev.${r.severity}`)} active={!off.has(r.id)} onClick={() => toggleRule(r.id)} />)}
                  </>}
                </Drop>
              </div>
            </Group>
            <Group label="code.group.searchAll">
              <Btn big icon="search" title="code.searchAll" active={dock === 'search'} onClick={() => { setDock(d => (d === 'search' ? null : 'search')); window.setTimeout(() => document.querySelector<HTMLInputElement>('.code-dock .dock-search input')?.focus(), 50); }} />
              <Btn big icon="replace" title="code.replaceAll" onClick={() => { setDock('search'); window.setTimeout(() => document.querySelector<HTMLInputElement>('.code-dock .dock-replace')?.focus(), 50); }} />
            </Group>
            <Group label="code.group.snippets">
              <Drop big icon="code" title="code.snippet" disabled={!active} wide>
                {close => <>
                  <span className="kicker">{t('code.snippetHint')}</span>
                  {SNIPPETS[snipLangOf(active)].map(x => <MenuItem key={x.label} label={x.detail} hint={x.label} onClick={() => { close(); insertSnippet(x.body); }} />)}
                </>}
              </Drop>
            </Group>
            <Group label="code.group.tests">
              <Btn big icon="play" title="code.runTests" onClick={() => void test()} disabled={empty || testing} />
              <div className="stack">
                <Btn icon="sync" title="code.watchTests" text active={watchTests} onClick={() => setWatchTests(w => !w)} />
                <Btn icon="file" title="code.newTest" text onClick={newTest} disabled={empty} />
                <Btn icon="check" title="code.testResults" text active={dock === 'tests'} onClick={() => setDock(d => (d === 'tests' ? null : 'tests'))} />
              </div>
            </Group>
          </>}
          {tab === 'corrector' && <>
            <Group label="code.group.analyse">
              <Btn big icon="sparkle" title="code.mc.analyseProject" onClick={() => void analyse(null)} disabled={empty || !!mcBusy} />
              <Btn big icon="file" title="code.mc.analyseFile" onClick={() => void analyse(active)} disabled={!active || !!mcBusy} />
            </Group>
            <Group label="code.group.helpers">
              <Drop big icon="speak" title="code.mc.helpers" wide>
                {() => <>
                  <span className="kicker">{t('code.mc.helpersHint')}</span>
                  <MenuItem label="Claude" hint={shell.ai.ready() ? t('code.mc.ready') : t('code.mc.notSet')} active={shell.ai.ready()} onClick={() => setCopilot(true)} />
                  {HELPERS.map(h => {
                    const usable = !!helperKeys()[h.id] || !!h.local;
                    return <MenuItem key={h.id} label={h.name} hint={usable ? '' : t('code.mc.needsKey')} active={helpers.includes(h.id)}
                      onClick={() => { if (!usable) { setKeysOpen(true); return; } setHelpers(l => (l.includes(h.id) ? l.filter(x => x !== h.id) : [...l, h.id])); }} />;
                  })}
                </>}
              </Drop>
              <Btn big icon="gear" title="code.mc.keys" onClick={() => setKeysOpen(true)} />
            </Group>
            <Group label="code.group.decide">
              <Btn big icon="comment" title={proposals.length ? t('code.mc.proposalsN', { n: proposals.filter(f => !decided[f.id]).length }) : 'code.mc.proposals'} active={dock === 'corrector'} onClick={() => setDock(d => (d === 'corrector' ? null : 'corrector'))} />
              <div className="stack">
                <Btn icon="accept" title="code.mc.acceptSafe" text onClick={acceptSafe} disabled={!proposals.some(f => !decided[f.id] && f.source === 'local')} />
                <Btn icon="reject" title="code.mc.rejectAll" text onClick={rejectAll} disabled={!proposals.some(f => !decided[f.id])} />
              </div>
            </Group>
            <Group label="code.group.versions">
              <Btn big icon="save" title="code.v.save" onClick={() => { void snapshot(t('code.v.manual')).then(() => shell.notify(t('code.v.saved'))); }} disabled={empty} />
              <Btn big icon="undo" title="code.v.backToBest" onClick={() => best && void restore(best)} disabled={!best || sameFiles(best.files, project.files)} />
              <Btn big icon="sync" title="code.v.list" active={dock === 'versions'} onClick={() => setDock(d => (d === 'versions' ? null : 'versions'))} />
            </Group>
          </>}
          {tab === 'training' && <TrainingRibbon tr={training} open={() => setDock('training')} />}
          {tab === 'github' && <>
            <Group label="code.group.starters">
              <Drop big icon="file" title="code.gitignore" disabled={empty} wide>
                {close => <>
                  <span className="kicker">{t('code.gitignoreHint')}</span>
                  {GITIGNORES.map(n => <MenuItem key={n} label={n} onClick={() => { close(); void addStarter('.gitignore', () => gitignore(n)); }} />)}
                </>}
              </Drop>
              <Drop big icon="shield" title="code.license" disabled={empty} wide>
                {close => <>
                  <span className="kicker">{t('code.licenseHint')}</span>
                  {LICENSES.map(l => <MenuItem key={l.id} label={l.name} hint={l.id === 'proprietary' ? '' : l.id} onClick={() => { close(); void addStarter('LICENSE', () => license(l.id, owner())); }} />)}
                </>}
              </Drop>
              <Btn big icon="letter" title="code.readme" onClick={() => void addStarter('README.md', () => readme(title, projectRef.current.files, g?.pages))} disabled={empty} />
            </Group>
            <Group label="code.group.account">
              {account
                ? <Btn big icon="github" title={t('code.gh.signedIn', { login: account.login })} onClick={() => { if (confirm(t('code.gh.signOutAsk'))) { github.saveAccount(null); setAccount(null); } }} active />
                : <Btn big icon="github" title="code.gh.connect" onClick={() => setPanel('connect')} />}
            </Group>
            <Group label="code.group.repo">
              <Btn big icon="link" title={g ? `${g.owner}/${g.repo}` : 'code.gh.link'} onClick={() => (account ? setPanel('repo') : setPanel('connect'))} active={!!g} />
              <Btn big icon="window" title="code.gh.openRepo" onClick={() => g && window.open(github.repoUrl(g), '_blank', 'noopener')} disabled={!g} />
            </Group>
            <Group label="code.group.sync">
              <Btn big icon="push" title="code.gh.push" onClick={() => setPanel('push')} disabled={!account || !g || !!busy || empty} />
              <Btn big icon="pull" title="code.gh.pull" onClick={pullNow} disabled={!account || !g || !!busy} />
            </Group>
            <Group label="code.group.site">
              <Btn big icon="rocket" title="code.gh.publish" onClick={() => void publish()} disabled={!account || !g || !!busy || empty} />
              <Btn big icon="web" title="code.gh.openSite" onClick={() => g?.pages && window.open(g.pages, '_blank', 'noopener')} disabled={!g?.pages} />
              <Btn big icon="qr" title="code.onPhone" onClick={() => void showQr('site')} disabled={!g?.pages} />
            </Group>
          </>}
          {tab === 'convert' && <ConvertPanel shell={shell} source={convertSource} />}
          {tab === 'oi1' && <>
            <Group label="code.group.toLetter" accent={appColor('letter')}>
              <Drop big icon="send" title="code.sendToLetter" disabled={!active}>
                {close => <>
                  <span className="kicker">{t('code.sendHint')}</span>
                  {letters.map(x => <MenuItem key={x.tabId} label={x.title} onClick={() => { close(); void sendToLetter(x.tabId); }} />)}
                  {letters.length > 0 && <hr />}
                  <MenuItem label={t('class.newLetter')} onClick={() => { close(); void sendToLetter(null); }} />
                </>}
              </Drop>
            </Group>
            <Group label="code.group.fromClass" accent={appColor('class')}>
              <Drop big icon="sheet" title="code.tableFromClass">
                {close => <>
                  <span className="kicker">{t('code.tableHint')}</span>
                  {sheets.length === 0 && <p className="muted drop-note">{t('code.noSheets')}</p>}
                  {sheets.map(x => <MenuItem key={x.tabId} label={x.title} onClick={() => { close(); void askClass(x.tabId); }} />)}
                  <hr />
                  <MenuItem label={t('code.openClass')} onClick={() => { close(); shell.openModule('class'); }} />
                </>}
              </Drop>
            </Group>
            <Group label="letter.group.apps">
              <AppKeys apps={shell.apps()} self="code" onOpen={id => shell.openModule(id)} />
            </Group>
          </>}
        </div>
      </div>

      {empty && !busy ? (
        <Start onPick={startFrom} onOpen={() => void openAny()} onFolder={() => pickUpload('', true)}
          onGitHub={account ? () => setPanel('repo') : () => setPanel('connect')} />
      ) : (
        <div className="code-work" ref={work} style={{ '--split': split } as CSSProperties}>
          {showTree && (
            <FileTree project={project} active={active} collapsed={collapsed} setCollapsed={setCollapsed}
              creating={creating} setCreating={setCreating} renaming={renaming} setRenaming={setRenaming}
              onOpen={path => { openPath(path); setMobileView('code'); if (narrow()) setShowTree(false); }} onCreate={create} onRename={rename} onRemove={remove}
              onUpload={dir => pickUpload(dir)} title={title} onTitle={name => update(p => ({ ...p, name }))} />
          )}
          <section className="code-main">
            <div className="file-tabs" role="tablist">
              {project.open.filter(p => project.files[p] !== undefined).map(p => (
                <div key={p} role="tab" aria-selected={p === active} className={`file-tab${p === active ? ' on' : ''}`} title={p}
                  onClick={() => update(x => ({ ...x, active: p }))} onAuxClick={e => { if (e.button === 1) closePath(p); }}>
                  <FileBadge path={p} /><span>{p.split('/').pop()}</span>
                  <button type="button" aria-label={t('tab.close')} title={t('tab.close')} onClick={e => { e.stopPropagation(); closePath(p); }}>×</button>
                </div>
              ))}
            </div>
            {active && isBinary(content)
              ? <div className="code-media">{/^data:image\//.test(content) ? <img src={content} alt={active} /> : <p className="muted">{t('code.binary', { name: active })}</p>}</div>
              : active
                ? <CodeEditor path={active} content={content} onChange={writeFile} wrap={wrap} api={editor}
                    onCursor={(line, col, selected) => setCursor({ line, col, selected })} />
                : <div className="code-media"><p className="muted">{t('code.pickFile')}</p></div>}
            {dock && (
              <div className="code-dock">
                <header role="tablist">
                  {(['training', 'problems', 'search', 'tests', 'corrector', 'versions'] as const).filter(d => d !== 'training' || tab === 'training' || training.lesson || dock === 'training').map(d => (
                    <button key={d} type="button" role="tab" aria-selected={dock === d} className={dock === d ? 'on' : ''} onClick={() => setDock(d)}>
                      {t(`code.dock.${d}`)}
                      {d === 'problems' && problems.length > 0 && <b>{problems.length}</b>}
                      {d === 'corrector' && proposals.some(f => !decided[f.id]) && <b>{proposals.filter(f => !decided[f.id]).length}</b>}
                      {d === 'tests' && testRun && testRun.results.length > 0 && <b className={testRun.results.every(r => r.ok) ? 'ok' : 'bad'}>{testRun.results.filter(r => r.ok).length}/{testRun.results.length}</b>}
                    </button>
                  ))}
                  <span className="grow" />
                  <button type="button" aria-label={t('letter.close')} title={t('letter.close')} onClick={() => setDock(null)}>×</button>
                </header>
                {dock === 'problems' && (
                  <ol className="dock-list">
                    {problems.length === 0 && <li className="muted">{t('code.noProblems')}</li>}
                    {problems.slice(0, 500).map((p, i) => {
                      const rule = ruleById(p.rule)!;
                      return (
                        <li key={i} className={`sev-${p.severity}`}>
                          <span className="sev-dot" title={t(`code.sev.${p.severity}`)} />
                          <button type="button" className="where" onClick={() => goTo(p.path, p.line)}>{p.path}:{p.line}</button>
                          <span className="what"><b>{p.message}</b> <span className="muted">{ruleWhy(rule)}</span></span>
                          {p.fix && <button type="button" className="fix" onClick={() => fixProblems(p.path, p.rule, { line: p.line, col: p.col })}>{t('code.fix')}</button>}
                        </li>
                      );
                    })}
                  </ol>
                )}
                {dock === 'search' && <>
                  <div className="dock-search">
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('code.searchAll')} aria-label={t('code.searchAll')} />
                    <button type="button" className={searchOpts.caseSensitive ? 'on' : ''} title={t('code.matchCase')} aria-pressed={searchOpts.caseSensitive} onClick={() => setSearchOpts(o => ({ ...o, caseSensitive: !o.caseSensitive }))}>Aa</button>
                    <button type="button" className={searchOpts.wholeWord ? 'on' : ''} title={t('code.wholeWord')} aria-pressed={searchOpts.wholeWord} onClick={() => setSearchOpts(o => ({ ...o, wholeWord: !o.wholeWord }))}>ab</button>
                    <button type="button" className={searchOpts.regex ? 'on' : ''} title={t('code.regex')} aria-pressed={searchOpts.regex} onClick={() => setSearchOpts(o => ({ ...o, regex: !o.regex }))}>.*</button>
                    <input className="dock-replace" value={replacement} onChange={e => setReplacement(e.target.value)} placeholder={t('code.replaceWith')} aria-label={t('code.replaceWith')} />
                    <button type="button" className="fix" onClick={() => replaceAll()} disabled={!matches.length}>{t('code.replaceAll')}</button>
                  </div>
                  <ol className="dock-list">
                    {query && matches.length === 0 && <li className="muted">{t('code.noMatches')}</li>}
                    {matches.length > 0 && <li className="muted">{t('code.matchesN', { n: matches.length, files: new Set(matches.map(m => m.path)).size })}</li>}
                    {matches.slice(0, 500).map((m, i) => (
                      <li key={i}>
                        <button type="button" className="where" onClick={() => goTo(m.path, m.line)}>{m.path}:{m.line}</button>
                        <code className="what">{m.text.slice(Math.max(0, m.col - 41), m.col - 1)}<mark>{m.text.slice(m.col - 1, m.col - 1 + m.to - m.from)}</mark>{m.text.slice(m.col - 1 + m.to - m.from, m.col + 80)}</code>
                        {(i === 0 || matches[i - 1].path !== m.path) && <button type="button" className="fix" onClick={() => replaceAll(m.path)}>{t('code.replaceInFile')}</button>}
                      </li>
                    ))}
                  </ol>
                </>}
                {dock === 'corrector' && (
                  <Proposals list={proposals} decided={decided} busy={mcBusy} warning={mcWarning?.text ?? null}
                    onAccept={f => void accept(f)} onEdit={f => void accept(f, true)} onReject={f => setDecided(d => ({ ...d, [f.id]: 'rejected' }))}
                    onUndoWarning={undoWarning} goTo={goTo} />
                )}
                {dock === 'training' && (
                  <TrainingPanel tr={training} files={project.files} onCourses={() => setTab('training')} />
                )}
                {dock === 'versions' && (
                  <Versions list={versions} current={project.files} onRestore={v => void restore(v)} onWrite={writeOrRemove}
                    onSave={() => void snapshot(t('code.v.manual'))} />
                )}
                {dock === 'tests' && (
                  <ol className="dock-list">
                    {testing && <li className="muted">{t('code.testing')}</li>}
                    {!testing && testRun && testRun.results.length === 0 && testRun.errors.length === 0 && (
                      <li className="muted">{t('code.noTests')} <button type="button" className="fix" onClick={newTest}>{t('code.newTest')}</button></li>
                    )}
                    {testRun && testRun.results.length > 0 && (
                      <li className={testRun.results.every(r => r.ok) ? 'test-ok' : 'test-bad'}>
                        <b>{t('code.testSummary', { ok: testRun.results.filter(r => r.ok).length, n: testRun.results.length, ms: testRun.ms })}</b>
                      </li>
                    )}
                    {testRun?.errors.map((e, i) => <li key={`e${i}`} className="sev-error"><span className="sev-dot" /><span className="what">{e}</span></li>)}
                    {testRun?.results.map((r, i) => (
                      <li key={i} className={r.ok ? 'test-ok' : 'test-bad'}>
                        <span className="test-mark">{r.ok ? '✓' : '✗'}</span>
                        <span className="what"><span className="muted">{r.suite ? `${r.suite} › ` : ''}</span>{r.name}{r.error && <><br /><span className="test-error">{r.error}</span></>}</span>
                        {r.file && <button type="button" className="where" onClick={() => goTo(r.file)}>{r.file}</button>}
                        <span className="muted">{r.ms} ms</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>
          {showPreview && <div className="code-split" onPointerDown={drag} role="separator" aria-orientation="vertical" />}
          {showPreview && (
            <section className="code-preview">
              <div className="preview-bar">
                <span className="preview-dots"><i /><i /><i /></span>
                <select value={preview?.page ?? ''} aria-label={t('code.page')} onChange={e => { setPage(e.target.value); void run(e.target.value); }}>
                  {htmlPages(project.files).map(p => <option key={p} value={p}>{p}</option>)}
                  {!htmlPages(project.files).length && <option value="">{t('code.noHtml')}</option>}
                </select>
                <button type="button" title={t('code.run')} aria-label={t('code.run')} onClick={() => void run()}><Icon name="sync" size={14} /></button>
                <button type="button" title={t('code.device.phone')} aria-label={t('code.device.phone')} className={device === 'phone' ? 'on' : ''} onClick={() => setDevice(d => (d === 'phone' ? 'fit' : 'phone'))}><Icon name="phone" size={14} /></button>
                <button type="button" title={t('code.onPhone')} aria-label={t('code.onPhone')} onClick={() => void showQr('preview')} disabled={!preview}><Icon name="qr" size={14} /></button>
                <button type="button" title={t('code.newWindow')} aria-label={t('code.newWindow')} onClick={openWindow} disabled={!preview}><Icon name="window" size={14} /></button>
              </div>
              <DeviceFrame device={device} landscape={landscape}>
                {preview
                  ? <iframe key={runs} ref={frame} title={t('code.preview')} srcDoc={preview.html} sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads" />
                  : <div className="preview-empty"><Icon name="web" size={32} /><p>{t('code.noHtml')}</p>
                      <button type="button" className="gold-pill small" onClick={() => create('', 'file', 'index.html')}>{t('code.addIndex')}</button></div>}
              </DeviceFrame>
              {consoleOpen && (
                <div className="console" role="log" aria-label={t('code.console')}>
                  <header><span className="kicker">{t('code.console')}</span>
                    <button type="button" onClick={() => setLogs([])}>{t('code.clearConsole')}</button>
                    <button type="button" aria-label={t('letter.close')} onClick={() => setConsoleOpen(false)}>×</button></header>
                  <ol>
                    {logs.length === 0 && <li className="muted">{t('code.consoleEmpty')}</li>}
                    {logs.map((l, i) => (
                      <li key={i} className={`log-${l.level}`}>
                        <pre>{l.text}</pre>
                        {l.file && <button type="button" onClick={() => goTo(l.file, l.line)}>{l.file}{l.line ? `:${l.line}` : ''}</button>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          )}
          {copilot && <Copilot host={copilotHost} ai={shell.ai} onClose={() => { setCopilot(false); editor.current.view?.focus(); }} />}
        </div>
      )}

      <footer className="status">
        <span className="status-file">{active ?? title}</span>
        {busy && <span className="gold">{busy.label}{busy.total ? ` ${busy.done ?? 0}/${busy.total}` : '…'}</span>}
        {active && !isBinary(content) && <span>{t('code.lineCol', { line: cursor.line, col: cursor.col })}{cursor.selected ? ` (${t('code.selected', { n: cursor.selected })})` : ''}</span>}
        {active && <span>{languageName(active)}</span>}
        {g && <button type="button" className="status-btn" onClick={() => setTab('github')}><Icon name="github" size={13} /> {g.repo}</button>}
        <button type="button" className={`status-btn${problems.some(p => p.severity === 'error') ? ' status-errors' : ''}`} onClick={() => setDock(d => (d === 'problems' ? null : 'problems'))}>
          <Icon name="shield" size={13} /> {problems.length ? t('code.problemsN', { n: problems.length }) : t('code.noProblemsShort')}
        </button>
        <button type="button" className={`status-btn${errorCount ? ' status-errors' : ''}`} onClick={() => { setShowPreview(true); setConsoleOpen(o => !o); }}>
          <Icon name="terminal" size={13} /> {errorCount ? t('code.errors', { n: errorCount }) : t('code.console')}
        </button>
        <span className="code-switch">
          <button type="button" className={mobileView === 'code' ? 'on' : ''} onClick={() => setMobileView('code')}><Icon name="code" size={13} /> {t('code.code')}</button>
          <button type="button" className={mobileView === 'preview' ? 'on' : ''} onClick={() => { setMobileView('preview'); setShowPreview(true); }}><Icon name="play" size={13} /> {t('code.preview')}</button>
        </span>
      </footer>

      <input ref={upload} type="file" multiple hidden onChange={async e => {
        const list = e.currentTarget.files;
        if (list?.length) addFiles(uploadTarget.current, await readPicked(list));
        e.currentTarget.value = '';
      }} />
      <input ref={uploadDir} type="file" multiple hidden {...{ webkitdirectory: '' }} onChange={async e => {
        const list = e.currentTarget.files;
        if (list?.length) {
          const files = await readPicked(list);
          if (empty) {
            const first = files['index.html'] !== undefined ? 'index.html' : htmlPages(files)[0] ?? Object.keys(files)[0];
            const name = ((list[0] as File & { webkitRelativePath?: string }).webkitRelativePath ?? '').split('/')[0];
            update(p => ({ ...p, name: p.name || name, files, open: first ? [first] : [], active: first ?? null }));
          } else addFiles(uploadTarget.current, files);
        }
        e.currentTarget.value = '';
      }} />

      {panel === 'file' && (
        <FileMenu fileName={fileRef?.name ?? `${baseName()}.zip`} onClose={() => setPanel(null)}
          onNew={() => setPanel('templates')} onOpen={() => void openAny()} onSave={() => void saveZip()}
          saveChoices={[
            { id: 'zip', icon: 'save', label: t('code.save.zip'), hint: '.zip' },
            { id: 'site', icon: 'web', label: t('code.save.site'), hint: '.zip' },
            { id: 'file', icon: 'file', label: t('code.save.file'), hint: active ?? '' },
          ]}
          onSaveAs={f => (f === 'zip' ? void saveZip(true) : f === 'site' ? void saveSite() : saveThis())}
          listRecent={shell.recent.list} onOpenRecent={r => void openRecent(r)} />
      )}
      {keysOpen && <KeysDialog onClose={() => { setKeysOpen(false); setHelpers(l => [...l]); }} />}
      {panel === 'templates' && (
        <Modal title={t('code.newProject')} onClose={() => setPanel(null)} wide>
          <TemplateGrid onPick={tpl => { setPanel(null); startFrom(tpl); }} />
        </Modal>
      )}
      {panel === 'connect' && <ConnectDialog onClose={() => setPanel(null)} onDone={a => { setAccount(a); setPanel(projectRef.current.github ? null : 'repo'); }} />}
      {panel === 'repo' && account && (
        <RepoDialog account={account} current={g} suggested={slug(title)} onClose={() => setPanel(null)}
          onDone={(ref, pullAfter) => {
            update(p => ({ ...p, github: { ...ref, pages: p.github?.repo === ref.repo && p.github?.owner === ref.owner ? p.github.pages : undefined } }));
            setPanel(null);
            if (pullAfter) window.setTimeout(pullNow, 0);
          }} />
      )}
      {panel === 'push' && g && (
        <PushDialog repo={`${g.owner}/${g.repo}`} branch={g.branch} onClose={() => setPanel(null)} onPush={message => { setPanel(null); void pushNow(message); }} />
      )}
      {panel === 'qr' && qr && (
        <Modal title={t('code.onPhone')} onClose={() => setPanel(null)}>
          <div className="qr-box">
            {qr.tooBig ? <p className="muted">{t('code.qrTooBig')}</p> : <img src={qr.image} alt={t('code.onPhone')} width={300} height={300} />}
            <p className="muted">{t(qr.kind === 'site' ? 'code.qrSiteHint' : 'code.qrPreviewHint')}</p>
            <div className="qr-actions">
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(qr.url); shell.notify(t('code.linkCopied')); }}>{t('code.copyLink')}</button>
              {'share' in navigator && <button type="button" onClick={() => void navigator.share({ title, url: qr.url }).catch(() => undefined)}>{t('class.share')}</button>}
              <a href={qr.url} target="_blank" rel="noopener">{t('code.openLink')}</a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- pieces ----------------

const BADGES: Record<string, [string, string]> = {
  html: ['<>', '#E8875F'], htm: ['<>', '#E8875F'], css: ['#', '#7FA7E8'], scss: ['#', '#E26FC2'], js: ['JS', '#E8C35F'], mjs: ['JS', '#E8C35F'],
  jsx: ['JSX', '#5FB8E8'], ts: ['TS', '#5F9BE8'], tsx: ['TSX', '#5FB8E8'], json: ['{}', '#B8E05F'], md: ['M', '#a9a6a0'], py: ['Py', '#5FC79A'],
  svg: ['◇', '#E8C35F'], sql: ['DB', '#B48CF0'], dart: ['D', '#4FC4B5'],
};
function FileBadge({ path }: { path: string }) {
  const [label, color] = BADGES[extOf(path)] ?? ['·', 'var(--faint)'];
  return <i className="file-badge" style={{ color }}>{label}</i>;
}

function InlineName({ initial, onDone, onCancel }: { initial: string; onDone: (name: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.focus();
    const dot = initial.lastIndexOf('.');
    el.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);
  return (
    <input ref={ref} className="tree-input" defaultValue={initial} spellCheck={false}
      onKeyDown={e => { if (e.key === 'Enter') onDone(e.currentTarget.value); if (e.key === 'Escape') onCancel(); }}
      onBlur={e => onDone(e.currentTarget.value)} />
  );
}

function FileTree({ project, active, collapsed, setCollapsed, creating, setCreating, renaming, setRenaming, onOpen, onCreate, onRename, onRemove, onUpload, title, onTitle }: {
  project: Project; active: string | null; collapsed: Set<string>; setCollapsed: (s: Set<string>) => void;
  creating: { dir: string; kind: 'file' | 'folder' } | null; setCreating: (c: { dir: string; kind: 'file' | 'folder' } | null) => void;
  renaming: string | null; setRenaming: (p: string | null) => void;
  onOpen: (path: string) => void; onCreate: (dir: string, kind: 'file' | 'folder', name: string) => void;
  onRename: (from: string, name: string) => void; onRemove: (path: string) => void; onUpload: (dir: string) => void;
  title: string; onTitle: (name: string) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const { byDir } = useMemo(() => {
    const dirs = new Set<string>(project.folders);
    for (const p of Object.keys(project.files)) {
      let d = dirname(p);
      while (d) { dirs.add(d); d = dirname(d); }
    }
    const byDir = new Map<string, { folders: string[]; files: string[] }>();
    const entry = (d: string) => { let e = byDir.get(d); if (!e) byDir.set(d, e = { folders: [], files: [] }); return e; };
    entry('');
    for (const d of dirs) entry(dirname(d)).folders.push(d);
    for (const p of Object.keys(project.files)) entry(dirname(p)).files.push(p);
    for (const e of byDir.values()) { e.folders.sort(); e.files.sort((a, b) => a.localeCompare(b)); }
    return { byDir };
  }, [project.files, project.folders]);

  const toggle = (d: string) => { const next = new Set(collapsed); if (next.has(d)) next.delete(d); else next.add(d); setCollapsed(next); };
  const depthStyle = (depth: number) => ({ '--depth': depth } as CSSProperties);
  const row = (path: string, depth: number, folder: boolean): ReactNode => {
    const name = path.split('/').pop()!;
    const tools = (
      <span className="tree-tools" onClick={e => e.stopPropagation()}>
        {folder && <button type="button" title={t('code.newFile')} aria-label={t('code.newFile')} onClick={() => { if (collapsed.has(path)) toggle(path); setCreating({ dir: path, kind: 'file' }); }}><Icon name="new" size={13} /></button>}
        <button type="button" title={t('code.rename')} aria-label={t('code.rename')} onClick={() => setRenaming(path)}><Icon name="rename" size={13} /></button>
        <button type="button" title={t('code.delete')} aria-label={t('code.delete')} onClick={() => onRemove(path)}><Icon name="trash" size={13} /></button>
      </span>
    );
    if (renaming === path) {
      return <div key={path} className="tree-row" style={depthStyle(depth)}><InlineName initial={name} onDone={n => onRename(path, n)} onCancel={() => setRenaming(null)} /></div>;
    }
    if (folder) {
      const open = !collapsed.has(path);
      return (
        <div key={path} role="group">
          <div className="tree-row folder" style={depthStyle(depth)} onClick={() => toggle(path)} role="treeitem" aria-expanded={open}>
            <span className={`tree-caret${open ? ' open' : ''}`}>▸</span><Icon name="folder" size={14} /><span className="tree-name">{name}</span>{tools}
          </div>
          {open && children(path, depth + 1)}
        </div>
      );
    }
    return (
      <div key={path} className={`tree-row${path === active ? ' on' : ''}`} style={depthStyle(depth)} onClick={() => onOpen(path)} role="treeitem" aria-selected={path === active} title={path}>
        <FileBadge path={path} /><span className="tree-name">{name}</span>{tools}
      </div>
    );
  };
  const children = (dir: string, depth: number): ReactNode => {
    const e = byDir.get(dir) ?? { folders: [], files: [] };
    return <>
      {creating?.dir === dir && (
        <div className="tree-row" style={depthStyle(depth)}>
          <Icon name={creating.kind === 'folder' ? 'folder' : 'file'} size={14} />
          <InlineName initial={creating.kind === 'folder' ? '' : ''} onDone={n => onCreate(dir, creating.kind, n)} onCancel={() => setCreating(null)} />
        </div>
      )}
      {e.folders.map(f => row(f, depth, true))}
      {e.files.map(f => row(f, depth, false))}
    </>;
  };
  return (
    <aside className="file-tree" aria-label={t('code.files')}>
      <header>
        {editingTitle
          ? <InlineName initial={title} onDone={n => { setEditingTitle(false); if (n.trim()) onTitle(n.trim()); }} onCancel={() => setEditingTitle(false)} />
          : <button type="button" className="project-name" title={t('code.renameProject')} onClick={() => setEditingTitle(true)}>{title}</button>}
        <span className="tree-head-tools">
          <button type="button" title={t('code.newFile')} aria-label={t('code.newFile')} onClick={() => setCreating({ dir: '', kind: 'file' })}><Icon name="new" size={14} /></button>
          <button type="button" title={t('code.newFolder')} aria-label={t('code.newFolder')} onClick={() => setCreating({ dir: '', kind: 'folder' })}><Icon name="newfolder" size={14} /></button>
          <button type="button" title={t('code.upload')} aria-label={t('code.upload')} onClick={() => onUpload('')}><Icon name="upload" size={14} /></button>
        </span>
      </header>
      <div className="tree" role="tree">{children('', 0)}</div>
    </aside>
  );
}

/** Shows the preview at its real size inside a phone or tablet, scaled down to fit. */
function DeviceFrame({ device, landscape, children }: { device: Device; landscape: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (device === 'fit') return <div className="device-box" ref={box}><div className="device fit">{children}</div></div>;
  const [w0, h0] = DEVICES[device];
  const [w, h] = landscape ? [h0, w0] : [w0, h0];
  const pad = 28;
  const scale = room.w ? Math.min(1, (room.w - pad * 2) / (w + 24), (room.h - pad * 2) / (h + 24)) : 1;
  return (
    <div className="device-box" ref={box}>
      <div className={`device ${device}`} style={{ width: w, height: h, transform: `translate(-50%, -50%) scale(${Math.max(scale, 0.2)})` }}>{children}</div>
      <span className="device-size">{w} × {h}{scale < 1 ? ` · ${Math.round(scale * 100)}%` : ''}</span>
    </div>
  );
}

function TemplateGrid({ onPick }: { onPick: (tpl: Template) => void }) {
  return (
    <div className="tpl-grid">
      {TEMPLATES.map(tpl => (
        <button key={tpl.id} type="button" className={`tpl tpl-${tpl.id}`} onClick={() => onPick(tpl)}>
          <span className="tpl-art" aria-hidden="true"><i /><i /><i /></span>
          <b>{t(tpl.name)}</b>
          <span>{t(tpl.about)}</span>
        </button>
      ))}
    </div>
  );
}

function Start({ onPick, onOpen, onFolder, onGitHub }: { onPick: (tpl: Template) => void; onOpen: () => void; onFolder: () => void; onGitHub: () => void }) {
  return (
    <div className="code-start">
      <div className="code-start-inner">
        <span className="kicker">Office Code+</span>
        <h1>{t('code.startTitle')}</h1>
        <p className="muted">{t('code.startSub')}</p>
        <TemplateGrid onPick={onPick} />
        <div className="start-actions">
          <button type="button" className="glass-pill" onClick={onOpen}><Icon name="open" /> {t('code.openProject')}</button>
          <button type="button" className="glass-pill" onClick={onFolder}><Icon name="folder" /> {t('code.openFolder')}</button>
          <button type="button" className="glass-pill" onClick={onGitHub}><Icon name="github" /> {t('code.fromGitHub')}</button>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose, wide, buttons }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; buttons?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal?.(); }, []);
  return (
    <dialog ref={ref} className={`oi-dialog code-dialog${wide ? ' wide' : ''}`} onClose={onClose} onCancel={onClose}>
      <div className="code-dialog-inner">
        <h2>{title}</h2>
        <div className="dialog-body">{children}</div>
        <div className="dialog-buttons">{buttons}<button type="button" onClick={onClose}>{buttons ? t('letter.cancel') : t('letter.close')}</button></div>
      </div>
    </dialog>
  );
}

function ConnectDialog({ onClose, onDone }: { onClose: () => void; onDone: (a: github.Account) => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [wait, setWait] = useState(false);
  const go = async () => {
    setWait(true); setError('');
    try {
      const a = await github.signIn(token.trim());
      github.saveAccount(a);
      onDone(a);
    } catch (e) {
      setError(e instanceof github.GitHubError && e.status === 401 ? t('code.gh.badToken') : t('code.gh.failed', { error: e instanceof Error ? e.message : String(e) }));
    } finally { setWait(false); }
  };
  return (
    <Modal title={t('code.gh.connect')} onClose={onClose}
      buttons={<button type="button" className="primary" disabled={!token.trim() || wait} onClick={() => void go()}>{wait ? '…' : t('code.gh.connectBtn')}</button>}>
      <ol className="steps">
        <li>{t('code.gh.step1')} <a href={github.TOKEN_URL} target="_blank" rel="noopener">{t('code.gh.makeToken')}</a></li>
        <li>{t('code.gh.step2')}</li>
        <li>{t('code.gh.step3')}</li>
      </ol>
      <label className="field">
        <span>{t('code.gh.token')}</span>
        <input type="password" value={token} autoComplete="off" spellCheck={false} placeholder="ghp_…" onChange={e => setToken(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && token.trim()) void go(); }} />
      </label>
      <p className="muted small">{t('code.gh.tokenSafe')}</p>
      {error && <p className="field-error">{error}</p>}
    </Modal>
  );
}

function RepoDialog({ account, current, suggested, onClose, onDone }: {
  account: github.Account; current?: github.RepoRef; suggested: string; onClose: () => void; onDone: (ref: github.RepoRef, pullAfter: boolean) => void;
}) {
  const [owner, setOwner] = useState(current?.owner ?? account.login);
  const [repo, setRepo] = useState(current?.repo ?? suggested);
  const [priv, setPriv] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(false);
  const go = async (pullAfter: boolean) => {
    setWait(true); setError('');
    try {
      const branch = await github.ensureRepo(account.token, owner.trim(), slug(repo), priv, account.login);
      onDone({ owner: owner.trim(), repo: slug(repo), branch }, pullAfter);
    } catch (e) {
      setError(t('code.gh.failed', { error: e instanceof Error ? e.message : String(e) }));
    } finally { setWait(false); }
  };
  return (
    <Modal title={t('code.gh.link')} onClose={onClose}
      buttons={<>
        <button type="button" disabled={!repo.trim() || wait} onClick={() => void go(true)}>{t('code.gh.linkPull')}</button>
        <button type="button" className="primary" disabled={!repo.trim() || wait} onClick={() => void go(false)}>{wait ? '…' : t('code.gh.linkBtn')}</button>
      </>}>
      <p className="muted">{t('code.gh.linkHint')}</p>
      <div className="field-row">
        <label className="field"><span>{t('code.gh.owner')}</span><input value={owner} onChange={e => setOwner(e.target.value)} spellCheck={false} /></label>
        <span className="slash">/</span>
        <label className="field grow"><span>{t('code.gh.repo')}</span><input value={repo} onChange={e => setRepo(e.target.value)} spellCheck={false} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={priv} onChange={e => setPriv(e.target.checked)} /> {t('code.gh.private')}</label>
      {error && <p className="field-error">{error}</p>}
    </Modal>
  );
}

function PushDialog({ repo, branch, onClose, onPush }: { repo: string; branch: string; onClose: () => void; onPush: (message: string) => void }) {
  const [message, setMessage] = useState('');
  return (
    <Modal title={t('code.gh.push')} onClose={onClose}
      buttons={<button type="button" className="primary" onClick={() => onPush(message.trim())}>{t('code.gh.pushBtn')}</button>}>
      <p className="muted">{t('code.gh.pushHint', { repo, branch })}</p>
      <label className="field">
        <span>{t('code.gh.message')}</span>
        <textarea rows={3} value={message} placeholder={t('code.gh.defaultMessage')} onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onPush(message.trim()); }} />
      </label>
    </Modal>
  );
}

