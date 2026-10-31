import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Handoff, MountedModule, OpenedFile, RecentFile, ShellApi } from './contract';
import { idb } from './db';
import { pickFile, saveFile, wrapFile } from './files';
import { LANGUAGES, getLanguage, setLanguage, t, type LanguageCode } from './i18n';
import { findUpdate, type AppUpdate } from './update';
import { moduleForFile, modules } from './modules';
import { addRecent, listRecent, onRecentChange, openRecent, removeRecent } from './recent';
import { Backdrop, BrandMark, SceneArt, Wordmark, useTilt } from './Scene';
import { store } from './storage';
import { autoSaveOn, forgetTab, onSaveStatus, registerSaver, saveStatus, setAutoSave, trackedSave } from './saveStatus';
import { ai } from './ai';
import { setTheme, useTheme } from './theme';
import { useLanguage } from './useLanguage';

interface Tab {
  tabId: string;
  moduleId: string;
  title: string;
  file?: OpenedFile; // only for the first mount; not saved
  handoff?: Handoff; // the same, for something another app handed over
}

type Receiver = (handoff: Handoff, from: string) => boolean | Promise<boolean>;
/** What each open tab accepts from other apps (see ShellApi.onReceive). */
const receivers = new Map<string, Set<Receiver>>();
type Answerer = (want: 'table', from: string) => Handoff | null | Promise<Handoff | null>;
/** What each open tab gives when another tab asks (see ShellApi.ask). */
const answerers = new Map<string, Answerer>();

const newTabId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function restoreTabs(): Tab[] {
  try {
    const saved = JSON.parse(store.get('tabs') || '[]') as Tab[];
    return saved.filter(t => modules.some(m => m.id === t.moduleId && m.load));
  } catch {
    return [];
  }
}

export default function App() {
  const lang = useLanguage();
  const theme = useTheme();
  const [tabs, setTabs] = useState<Tab[]>(restoreTabs);
  const [activeId, setActiveId] = useState<string | null>(() => {
    const last = store.get('active');
    return tabs.some(t => t.tabId === last) ? last : null;
  });

  useEffect(() => {
    store.set('tabs', JSON.stringify(tabs.map(({ tabId, moduleId, title }) => ({ tabId, moduleId, title }))));
    store.set('active', activeId ?? '');
  }, [tabs, activeId]);

  const openModule = useCallback((moduleId: string, file?: OpenedFile, handoff?: Handoff) => {
    const entry = modules.find(m => m.id === moduleId);
    if (!entry?.load) return null;
    const tab: Tab = { tabId: newTabId(), moduleId, title: entry.name, file, handoff };
    setTabs(ts => [...ts, tab]);
    setActiveId(tab.tabId);
    return tab.tabId;
  }, []);

  const openAnyFile = useCallback((file: OpenedFile | null) => {
    if (!file) return;
    const entry = moduleForFile(file.name);
    if (entry) { openModule(entry.id, file); void remember(entry.id, file); }
    else alert(`${t('shell.cannotOpen')} ${file.name}`);
  }, [openModule]);

  const closeTab = useCallback((tabId: string) => {
    forgetTab(tabId);
    if (!confirm(t('tab.confirmClose'))) return;
    store.removePrefix(`${tabId}:`);
    receivers.delete(tabId);
    answerers.delete(tabId);
    void idb.deletePrefix('kv', `${tabId}:`).catch(() => {});
    setTabs(ts => {
      const i = ts.findIndex(t => t.tabId === tabId);
      const rest = ts.filter(t => t.tabId !== tabId);
      setActiveId(cur => (cur === tabId ? (rest[i] ?? rest[i - 1])?.tabId ?? null : cur));
      return rest;
    });
  }, []);

  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const notify = useCallback((text: string) => setToast(cur => ({ text, n: (cur?.n ?? 0) + 1 })), []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const makeApi = useCallback((tabId: string, moduleId: string): ShellApi => ({
    tabId,
    openFile: async extensions => {
      const f = await pickFile(extensions);
      if (f && moduleForFile(f.name)?.id === moduleId) void remember(moduleId, f); // not pictures picked for a letter
      return f;
    },
    saveFile: async (name, content, mimeType, options) => {
      const saved = await saveFile(name, content, mimeType, options);
      if (saved) void addRecent(moduleId, saved.ref.name, saved.ref.handle, saved.ref.handle ? undefined : saved.blob);
      return saved?.ref ?? null;
    },
    storage: {
      get: key => store.get(`${tabId}:${key}`),
      set: (key, value) => store.set(`${tabId}:${key}`, value),
      load: key => idb.get<string>('kv', `${tabId}:${key}`).then(v => v ?? null, () => null),
      save: (key, value) => trackedSave(tabId, () => idb.set('kv', value, `${tabId}:${key}`)),
    },
    autoSave: fn => registerSaver(tabId, fn),
    recent: {
      list: () => listRecent(moduleId),
      open: id => openRecent(id),
    },
    setTitle: title => setTabs(ts => ts.map(t => (t.tabId === tabId && t.title !== title ? { ...t, title } : t))),
    openModule,
    goHome: () => setActiveId(null),
    apps: () => modules.map(m => ({ id: m.id, name: m.name, ready: !!m.load, color: m.color })),
    tabs: only => tabsRef.current.filter(t => !only || t.moduleId === only).map(({ tabId: id, moduleId: mod, title }) => ({ tabId: id, moduleId: mod, title })),
    showTab: id => { if (tabsRef.current.some(t => t.tabId === id)) setActiveId(id); },
    send: async (to, handoff) => {
      for (const fn of receivers.get(to) ?? []) if (await fn(handoff, tabId)) return true;
      return false;
    },
    onReceive: fn => {
      const set = receivers.get(tabId) ?? new Set();
      receivers.set(tabId, set);
      set.add(fn);
      return () => { set.delete(fn); };
    },
    ask: async (to, want) => {
      const fn = answerers.get(to);
      return fn ? (await fn(want, tabId)) ?? null : null;
    },
    onAsk: fn => {
      answerers.set(tabId, fn);
      return () => { if (answerers.get(tabId) === fn) answerers.delete(tabId); };
    },
    notify,
    ai,
  }), [openModule, notify]);

  // Drop a file anywhere on the window to open it.
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      if (e.defaultPrevented) return; // a module used it, like an image dropped into a letter
      e.preventDefault();
      const f = e.dataTransfer?.files[0];
      if (!f) return;
      // Chrome and Edge also give a handle, so Save can write back to the dropped file.
      const item = e.dataTransfer?.items[0] as (DataTransferItem & { getAsFileSystemHandle?(): Promise<FileSystemHandle | null> }) | undefined;
      const handle = item?.getAsFileSystemHandle?.();
      if (!handle) { openAnyFile(wrapFile(f)); return; }
      void handle.then(h => openAnyFile(wrapFile(f, h?.kind === 'file' ? (h as FileSystemFileHandle) : undefined)), () => openAnyFile(wrapFile(f)));
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); };
  }, [openAnyFile]);

  const readyExtensions = modules.filter(m => m.load).flatMap(m => m.extensions);

  // Recent files on the home screen.
  const [recent, setRecent] = useState<RecentFile[]>([]);
  useEffect(() => {
    const refresh = () => { void listRecent().then(setRecent); };
    refresh();
    return onRecentChange(refresh);
  }, []);
  const openRecentFile = async (r: RecentFile) => {
    const f = await openRecent(r.id);
    if (f) { openModule(r.moduleId, f); void remember(r.moduleId, f); }
    else if (confirm(t('home.recentMissing'))) void removeRecent(r.id);
  };

  const [launcher, setLauncher] = useState(false);
  useEffect(() => {
    if (!launcher) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as HTMLElement).closest('.launcher, .launcher-btn')) setLauncher(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [launcher]);

  return (
    <>
      <Backdrop />
      <UpdateBanner />
      <header className="topbar">
        <button className="launcher-btn" title={t('shell.apps')} aria-label={t('shell.apps')} aria-expanded={launcher}
          onClick={() => setLauncher(o => !o)}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
            {[0, 1, 2].flatMap(r => [0, 1, 2].map(c => <circle key={`${r}${c}`} cx={3 + c * 6} cy={3 + r * 6} r="1.7" />))}
          </svg>
        </button>
        <button className="brand" title={t('shell.home')} onClick={() => setActiveId(null)}>
          <BrandMark /><Wordmark />
        </button>
        <nav className="tabs">
          {tabs.map(tab => {
            const entry = modules.find(m => m.id === tab.moduleId)!;
            return (
              <div key={tab.tabId} className={`tab ${tab.tabId === activeId ? 'active' : ''}`} data-app={tab.moduleId}
                style={{ '--accent': entry.color, '--app': entry.code } as CSSProperties} title={`${entry.name}: ${tab.title}`}
                onClick={() => setActiveId(tab.tabId)}>
                <span className="app-badge" aria-hidden="true">{entry.badge}</span>
                <span className="tab-label">{tab.title}</span>
                <button className="tab-close" title={t('tab.close')} aria-label={t('tab.close')}
                  onClick={e => { e.stopPropagation(); closeTab(tab.tabId); }}>×</button>
              </div>
            );
          })}
          <button className="tab-new" title={t('tab.new')} aria-label={t('tab.new')} onClick={() => setActiveId(null)}>+</button>
        </nav>
        <button className="theme-btn" aria-label={theme === 'dark' ? t('shell.themeLight') : t('shell.themeDark')}
          title={theme === 'dark' ? t('shell.themeLight') : t('shell.themeDark')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark'
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg>}
        </button>
        <select className="lang" aria-label={t('shell.language')} title={t('shell.language')} value={lang}
          onChange={e => setLanguage(e.target.value as LanguageCode)}>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
      </header>
      {launcher && (
        <div className="launcher" role="dialog" aria-label={t('shell.apps')}>
          <span className="kicker">{t('shell.apps')}</span>
          <div className="launcher-grid">
            {modules.map(m => (
              <button key={m.id} className="launcher-app" disabled={!m.load} onClick={() => { setLauncher(false); void openModule(m.id); }}
                title={m.load ? m.name : `${m.name} (${t('home.soon')})`}>
                <SceneArt app={m.id} accent={m.color} />
                <span>{m.name.replace('Office ', '')}</span>
                {!m.load && <small>{t('home.soon')}</small>}
              </button>
            ))}
          </div>
        </div>
      )}
      <main id="stage">
        <section className="home" hidden={activeId !== null}>
          <div className="home-inner">
            <div className="hero">
              <div className="reveal">
                <span className="kicker">{t('home.kicker')}</span>
                <h1>{t('home.welcome').replace(/1\s*$/, '')}<span className="gold-text">1</span></h1>
                <p className="sub">{t('home.subtitle')}</p>
              </div>
              <div className="hero-actions reveal" style={{ '--i': 2 } as CSSProperties}>
                <button className="gold-pill" onClick={() => void openModule('letter')}>{t('home.newLetter')}</button>
                <button className="glass-pill" onClick={() => pickFile(readyExtensions).then(openAnyFile)}>{t('home.openFile')}</button>
              </div>
            </div>
            {recent.length > 0 && (
              <section className="recent reveal" aria-label={t('home.recent')} style={{ '--i': 3 } as CSSProperties}>
                <div className="section-title"><span className="kicker">{t('home.recent')}</span></div>
                <ul>
                  {recent.slice(0, 8).map(r => {
                    const entry = modules.find(m => m.id === r.moduleId);
                    return (
                      <li key={r.id} style={{ '--accent': entry?.color } as CSSProperties}>
                        <button className="recent-open" onClick={() => void openRecentFile(r)} title={r.name}>
                          <span className="badge">{entry?.name.split(' ')[1][0]}</span>
                          <span className="recent-name">{r.name}</span>
                          <span className="recent-time">{timeAgo(r.time)}</span>
                        </button>
                        <button className="recent-remove" title={t('home.recentRemove')} aria-label={t('home.recentRemove')}
                          onClick={() => void removeRecent(r.id)}>×</button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <div className="section-title reveal" style={{ '--i': 4 } as CSSProperties}><h2>{t('home.apps')}</h2></div>
            <div className="cards">
              {modules.map((m, i) => <AppTile key={m.id} index={i} name={m.name} kind={t(m.kind)} id={m.id} color={m.color}
                ready={!!m.load} onOpen={() => void openModule(m.id)} />)}
            </div>
          </div>
        </section>
        {tabs.map(tab => (
          <TabHost key={tab.tabId} tab={tab} hidden={tab.tabId !== activeId} makeApi={makeApi} />
        ))}
      </main>
      {toast && <div key={toast.n} className="toast" role="status">{toast.text}</div>}
    </>
  );
}

/** One app on the home screen: an obsidian slab with its living scene. */
function AppTile({ id, name, kind, color, ready, index, onOpen }: {
  id: string; name: string; kind: string; color: string; ready: boolean; index: number; onOpen: () => void;
}) {
  const tilt = useTilt<HTMLButtonElement>();
  return (
    <button {...tilt} className={`slab reveal${ready ? '' : ' soon'}`} disabled={!ready} onClick={onOpen}
      style={{ '--accent': color, '--i': index + 5 } as CSSProperties}>
      <SceneArt app={id} accent={color} />
      <span className="name">{name}</span>
      <span className="kind">{kind}</span>
      {!ready && <span className="tag">{t('home.soon')}</span>}
    </button>
  );
}

/** Keeps a file in the recent list: a handle where the browser has one, otherwise a copy. */
async function remember(moduleId: string, f: OpenedFile) {
  const copy = f.handle ? undefined : new Blob([await f.arrayBuffer()], { type: f.type });
  await addRecent(moduleId, f.name, f.handle, copy);
}

function timeAgo(time: number): string {
  const rtf = new Intl.RelativeTimeFormat(getLanguage(), { numeric: 'auto' });
  const minutes = Math.round((time - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  return new Date(time).toLocaleDateString(getLanguage());
}

/** Mounts one module into its own element and keeps it alive while the tab is open. */
function TabHost({ tab, hidden, makeApi }: { tab: Tab; hidden: boolean; makeApi: (tabId: string, moduleId: string) => ShellApi }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef({ makeApi, file: tab.file, handoff: tab.handoff });

  useEffect(() => {
    const el = ref.current!;
    const entry = modules.find(m => m.id === tab.moduleId);
    let mounted: MountedModule | undefined;
    let cancelled = false;
    entry?.load?.().then(({ default: mod }) => {
      if (!cancelled) mounted = mod.mount(el, first.current.makeApi(tab.tabId, tab.moduleId), first.current.file, first.current.handoff);
    });
    return () => {
      cancelled = true;
      mounted?.unmount?.();
      el.innerHTML = '';
    };
  }, [tab.tabId, tab.moduleId]);

  const entry = modules.find(m => m.id === tab.moduleId)!;
  // The app bar says which app this is, in its color, above its ribbon (Martin: "sur quel office je suis").
  return (
    <div className="app-frame" hidden={hidden} data-app={tab.moduleId} style={{ '--app': entry.code } as CSSProperties}>
      <div className="app-bar">
        <span className="app-badge" aria-hidden="true">{entry.badge}</span>
        <span className="app-name">{entry.name}</span>
        <span className="app-doc" title={tab.title}>{tab.title}</span>
        <SaveBadge tabId={tab.tabId} />
      </div>
      <div ref={ref} className="module-host" hidden={hidden} />
    </div>
  );
}

/** Tells the installed app (Windows, Android) that a new version is out, and installs it on a tap. */
function UpdateBanner() {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState(false);
  useEffect(() => {
    let stop = false;
    const look = () => void findUpdate().then(u => { if (!stop && u) setUpdate(u); });
    const first = window.setTimeout(look, 4000);
    const again = window.setInterval(look, 6 * 3600 * 1000);
    return () => { stop = true; window.clearTimeout(first); window.clearInterval(again); };
  }, []);
  if (!update || later) return null;
  return (
    <div className="update-banner" role="status">
      <span className="grow">{t(busy ? (update.kind === 'apk' ? 'update.apkHint' : 'update.installing') : 'update.ready', { version: update.version })}</span>
      <button type="button" className="primary" disabled={busy && update.kind === 'install'}
        onClick={() => { setBusy(true); void update.run().catch(() => setBusy(false)); }}>{t('update.now')}</button>
      <button type="button" onClick={() => setLater(true)}>{t('update.later')}</button>
    </div>
  );
}

/** "Saved" in the app bar, and the AutoSave switch (Martin: "enregistrement auto"). */
function SaveBadge({ tabId }: { tabId: string }) {
  const [, redraw] = useState(0);
  useEffect(() => onSaveStatus(id => { if (id === tabId || id === '*') redraw(n => n + 1); }), [tabId]);
  // "Saved 2 min ago" stays true while the tab is open.
  useEffect(() => { const id = window.setInterval(() => redraw(n => n + 1), 30_000); return () => window.clearInterval(id); }, []);
  const s = saveStatus(tabId);
  const auto = autoSaveOn();
  const text = s.state === 'saving' ? t('save.saving')
    : s.state === 'error' ? t('save.error')
    : s.state === 'saved' ? (s.where === 'file' ? t('save.file', { name: s.name ?? '' }) : t('save.device'))
    : '';
  const hint = s.where === 'file' ? t('save.fileHint') : t('save.deviceHint');
  return (
    <span className="save-area">
      {text && <span className={`save-badge save-${s.state}`} role="status" title={s.at ? `${hint} (${timeAgo(s.at)})` : hint}>{text}</span>}
      <label className="autosave" title={t('save.autoHint')}>
        <input type="checkbox" role="switch" checked={auto} onChange={e => setAutoSave(e.target.checked)} />
        <span className="autosave-track" aria-hidden="true" />
        <span className="autosave-label">{t('save.auto')}</span>
      </label>
    </span>
  );
}
