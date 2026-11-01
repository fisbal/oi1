import { WebAnswer } from '../ui/WebAnswer';
import { WantBar } from '../ui/want/WantBar';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Handoff, MountedModule, OpenedFile, RecentFile, ShellApi } from './contract';
import { idb } from './db';
import { blobOf, pickFile, saveFile, wrapFile } from './files';
import { cloudOn, cloudSave, forgetCloudTab } from './cloud';
import { CloudPanel, useCloud } from './CloudPanel';
import { LANGUAGES, getLanguage, setLanguage, t, type LanguageCode } from './i18n';
import { findUpdate, type AppUpdate } from './update';
import { isStaleBuild, reloadToNewVersion, takeReopenAfterUpdate } from './staleBuild';
import { moduleForFile, modules } from './modules';
import { addRecent, listRecent, onRecentChange, openRecent, removeRecent } from './recent';
import { Backdrop, BrandMark, SceneArt, Wordmark, useTilt } from './Scene';
import { store } from './storage';
import { aiFor } from './ai';
import { aiTranslator, bestTranslator, originalOf, registerTranslator, rememberChoice, rememberedChoice, restoreOriginal, translateFromOriginal, translatorFor, type LangChoice } from './translate';
import { LangChoiceDialog } from './LangChoice';
import { guardFile } from './shield/guard';
import { ShieldButton, ShieldHost } from './shield/Shield';
import { installScrollArrows, schedule as scheduleScrollArrows } from '../ui/scrollArrows';
import { autoSaveOn, forgetTab, onSaveStatus, registerSaver, saveStatus, setAutoSave, trackedSave } from './saveStatus';
import { setTheme, useTheme } from './theme';
import { useLanguage } from './useLanguage';

interface Tab {
  tabId: string;
  moduleId: string;
  title: string;
  /** A name the person gave the tab, for an app that cannot rename its document. */
  custom?: string;
  file?: OpenedFile; // only for the first mount; not saved
  handoff?: Handoff; // the same, for something another app handed over
}

type Receiver = (handoff: Handoff, from: string) => boolean | Promise<boolean>;
/** What each open tab accepts from other apps (see ShellApi.onReceive). */
const receivers = new Map<string, Set<Receiver>>();
type Answerer = (want: 'table', from: string) => Handoff | null | Promise<Handoff | null>;
/** What each open tab gives when another tab asks (see ShellApi.ask). */
const answerers = new Map<string, Answerer>();
/** How each open tab renames its document when the person renames its tab (see ShellApi.onRename). */
const renamers = new Map<string, (name: string) => void>();

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
    store.set('tabs', JSON.stringify(tabs.map(({ tabId, moduleId, title, custom }) => ({ tabId, moduleId, title, ...(custom ? { custom } : {}) }))));
    store.set('active', activeId ?? '');
  }, [tabs, activeId]);

  // Little ‹ › arrows on every strip that scrolls sideways, and the open document always in sight in the tab bar.
  useEffect(() => { installScrollArrows(); }, []);
  useEffect(() => {
    const tab = document.querySelector<HTMLElement>('.tabs .tab.active');
    const strip = tab?.parentElement;
    if (tab && strip) {
      // Wider than the strip (a phone): show its start, with the name; otherwise just slide it fully into view.
      const left = tab.offsetLeft - strip.offsetLeft, right = left + tab.offsetWidth;
      if (tab.offsetWidth >= strip.clientWidth || left < strip.scrollLeft) strip.scrollLeft = left;
      else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth;
    }
    scheduleScrollArrows();
  }, [activeId, tabs.length]);

  const openModule = useCallback((moduleId: string, file?: OpenedFile, handoff?: Handoff) => {
    const entry = modules.find(m => m.id === moduleId);
    if (!entry?.load) return null;
    const tab: Tab = { tabId: newTabId(), moduleId, title: entry.name, file, handoff };
    setTabs(ts => [...ts, tab]);
    setActiveId(tab.tabId);
    return tab.tabId;
  }, []);

  const cloudAcc = useCloud();
  const [homeCloud, setHomeCloud] = useState(false);
  const openAnyFile = useCallback((picked: OpenedFile | null) => {
    if (!picked) return;
    // The shield looks inside first (macros, hidden programs, traps); it may hand back a clean copy, or stop.
    void guardFile(picked).then(file => {
      if (!file) return;
      const entry = moduleForFile(file.name);
      if (entry) { openModule(entry.id, file); void remember(entry.id, file); }
      else alert(`${t('shell.cannotOpen')} ${file.name}`);
    });
  }, [openModule]);

  // A tab that never showed anything (its app could not load): removed without asking.
  const dropTab = useCallback((tabId: string) => {
    forgetTab(tabId);
    setTabs(ts => ts.filter(x => x.tabId !== tabId));
    setActiveId(cur => (cur === tabId ? null : cur));
  }, []);

  const closeTabs = useCallback((ids: string[], ask = true) => {
    if (!ids.length || (ask && !confirm(t(ids.length > 1 ? 'tab.confirmCloseAll' : 'tab.confirmClose', { n: ids.length })))) return;
    for (const tabId of ids) {
      forgetTab(tabId);
      forgetCloudTab(tabId);
      store.removePrefix(`${tabId}:`);
      receivers.delete(tabId);
      answerers.delete(tabId);
      renamers.delete(tabId);
      void idb.deletePrefix('kv', `${tabId}:`).catch(() => {});
    }
    setTabs(ts => {
      const gone = new Set(ids);
      const rest = ts.filter(t => !gone.has(t.tabId));
      setActiveId(cur => {
        if (!cur || !gone.has(cur)) return cur;
        const i = ts.findIndex(t => t.tabId === cur);
        return (ts.slice(i + 1).find(t => !gone.has(t.tabId)) ?? ts.slice(0, i).reverse().find(t => !gone.has(t.tabId)))?.tabId ?? null;
      });
      return rest;
    });
  }, []);
  const closeTab = useCallback((tabId: string) => closeTabs([tabId]), [closeTabs]);

  // Renaming a tab renames its document (the app saves and exports under the new name); an app that cannot rename
  // its document keeps the name on the tab.
  const [renaming, setRenaming] = useState<{ id: string; where: 'tab' | 'menu'; text: string } | null>(null);
  const startRename = (tab: Tab, where: 'tab' | 'menu') => setRenaming({ id: tab.tabId, where, text: tab.custom ?? tab.title });
  const commitRename = () => {
    const r = renaming;
    setRenaming(null);
    if (!r) return;
    const name = r.text.replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    const tab = tabsRef.current.find(x => x.tabId === r.id);
    if (!name || !tab || name === (tab.custom ?? tab.title)) return;
    const fn = renamers.get(r.id);
    if (fn) {
      fn(name);
      setTabs(ts => ts.map(x => (x.tabId === r.id ? { ...x, custom: undefined, title: name } : x)));
    } else setTabs(ts => ts.map(x => (x.tabId === r.id ? { ...x, custom: name } : x)));
  };
  const renameBox = (label: string) => (
    <input className="tab-rename" autoFocus aria-label={t('tab.renameBox', { name: label })} value={renaming?.text ?? ''} maxLength={80}
      onFocus={e => e.currentTarget.select()}
      onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}
      onChange={e => { const text = e.target.value; setRenaming(r => (r ? { ...r, text } : r)); }}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
        if (e.key === 'Escape') { e.preventDefault(); setRenaming(null); }
      }}
      onBlur={commitRename} />
  );

  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const notify = useCallback((text: string) => setToast(cur => ({ text, n: (cur?.n ?? 0) + 1 })), []);

  // Changing the language with a document open: the interface, the document, or both (remembered when asked).
  const [langAsk, setLangAsk] = useState<LanguageCode | null>(null);
  const translateDoc = useCallback(async (to: LanguageCode, fromGuess: LanguageCode) => {
    const tab = tabsRef.current.find(x => x.tabId === activeIdRef.current);
    const doc = translatorFor(tab?.tabId ?? null);
    if (!tab || !doc) return;
    notify(t('lang.translating'));
    try {
      // Always from the original (rule 13). Chrome's own translator first (free, no account); otherwise the copilot's AI.
      const { n, restored } = await translateFromOriginal(tab.tabId, doc, to, fromGuess,
        from => bestTranslator(to, from, () => aiTranslator(aiFor(tab.moduleId), to)));
      notify(restored ? t('lang.restored') : n ? t('lang.translated', { n }) : t('lang.nothing'));
    } catch (e) {
      notify(t('lang.failed', { error: e instanceof Error ? e.message : String(e) }));
    }
    setDocLangTick(x => x + 1);
  }, [notify]);
  const [, setDocLangTick] = useState(0);
  const applyLanguage = useCallback((to: LanguageCode, c: LangChoice) => {
    const before = getLanguage();
    if (c !== 'doc') setLanguage(to);
    if (c !== 'ui') void translateDoc(to, before);
  }, [translateDoc]);
  const pickLanguage = async (to: LanguageCode) => {
    if ((to as string) === '__ask') { rememberChoice(null); notify(t('lang.ask')); return; }
    const tabId = activeIdRef.current;
    const doc = translatorFor(tabId);
    if ((to as string) === '__orig') {
      if (tabId && doc && await restoreOriginal(tabId, doc)) notify(t('lang.restored'));
      setDocLangTick(x => x + 1);
      return;
    }
    if (to === getLanguage()) {
      // The menus are already in this language, but the document may be in another one ("Document only" before).
      const o = tabId ? originalOf(tabId) : null;
      if (doc && o && o.lastLang && o.lastLang !== to) void translateDoc(to, to);
      return;
    }
    if (!doc) { setLanguage(to); return; }
    const kept = rememberedChoice();
    if (kept) applyLanguage(to, kept); else setLangAsk(to);
  };
  // The page reloaded itself onto a new version while a file was being opened: open it again.
  useEffect(() => {
    void takeReopenAfterUpdate().then(f => { if (f) { openAnyFile(f); notify(t('update.reopened')); } });
  }, [openAnyFile, notify]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  // "Je veux…" hands a task to Office Assistant: its open tab takes it, or a new one opens with it.
  useEffect(() => {
    const on = (e: Event) => {
      const words = String((e as CustomEvent).detail ?? '');
      const html = `<p>${words.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`;
      const have = tabsRef.current.find(x => x.moduleId === 'assistant');
      if (!have) { openModule('assistant', undefined, { kind: 'html', title: '', html }); return; }
      setActiveId(have.tabId);
      for (const fn of receivers.get(have.tabId) ?? []) void fn({ kind: 'html', title: '', html }, have.tabId);
    };
    window.addEventListener('oi1-assistant', on);
    return () => window.removeEventListener('oi1-assistant', on);
  }, [openModule]);

  const makeApi = useCallback((tabId: string, moduleId: string): ShellApi => ({
    tabId,
    openFile: async extensions => {
      const f = await guardFile(await pickFile(extensions));
      if (f && moduleForFile(f.name)?.id === moduleId) void remember(moduleId, f); // not pictures picked for a letter
      return f;
    },
    saveFile: async (name, content, mimeType, options) => {
      if (options?.quiet && cloudOn()) {
        // AutoSave with the cloud on: the document's own file when there is one, and the cloud copy.
        let blob: Blob | null = null;
        const local = await saveFile(name, async () => (blob = await blobOf(content, mimeType)), mimeType, options);
        const path = await cloudSave(tabId, local?.ref.name ?? name, blob ?? await blobOf(content, mimeType));
        return { name: path, handle: local?.ref.handle, cloud: path };
      }
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
    translator: fn => registerTranslator(tabId, fn),
    cloudOn,
    recent: {
      list: () => listRecent(moduleId),
      open: id => openRecent(id),
    },
    setTitle: title => setTabs(ts => ts.map(t => (t.tabId === tabId && t.title !== title ? { ...t, title } : t))),
    onRename: fn => { if (fn) renamers.set(tabId, fn); else renamers.delete(tabId); },
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
    ai: aiFor(moduleId),
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
  // Every open document in one list, for when the tab bar is too short to show them all (phones above all).
  const [allTabs, setAllTabs] = useState(false);
  useEffect(() => {
    if (!allTabs) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as HTMLElement).closest('.tabs-all, .tabs-menu')) setAllTabs(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [allTabs]);
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
              <div key={tab.tabId} className={`tab ${tab.tabId === activeId ? 'active' : ''}${renaming?.id === tab.tabId && renaming.where === 'tab' ? ' renaming' : ''}`} data-app={tab.moduleId}
                style={{ '--accent': entry.color, '--app': entry.code } as CSSProperties} title={`${entry.name}: ${tab.custom ?? tab.title} · ${t('tab.renameHint')}`}
                onClick={() => setActiveId(tab.tabId)}
                onDoubleClick={() => startRename(tab, 'tab')}
                onContextMenu={e => { e.preventDefault(); setActiveId(tab.tabId); startRename(tab, 'tab'); }}>
                <span className="app-badge" aria-hidden="true">{entry.badge}</span>
                {renaming?.id === tab.tabId && renaming.where === 'tab' ? renameBox(tab.custom ?? tab.title) : <span className="tab-label">{tab.custom ?? tab.title}</span>}
                <button className="tab-close" title={t('tab.close')} aria-label={t('tab.close')}
                  onClick={e => { e.stopPropagation(); closeTab(tab.tabId); }}>×</button>
              </div>
            );
          })}
          <button className="tab-new" title={t('tab.new')} aria-label={t('tab.new')} onClick={() => setActiveId(null)}>+</button>
        </nav>
        {tabs.length > 1 && (
          <div className="tabs-all-wrap">
            <button className="tabs-all" aria-haspopup="menu" aria-expanded={allTabs} title={t('tab.all', { n: tabs.length })} aria-label={t('tab.all', { n: tabs.length })}
              onClick={() => setAllTabs(o => !o)}>
              <span>{tabs.length}</span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
            </button>
            {allTabs && (
              <div className="tabs-menu" role="menu">
                <p>{t('tab.all', { n: tabs.length })}</p>
                {tabs.map(tab => {
                  const entry = modules.find(m => m.id === tab.moduleId)!;
                  return (
                    <div key={tab.tabId} className={`tabs-menu-row${tab.tabId === activeId ? ' on' : ''}`} role="none" style={{ '--app': entry.code } as CSSProperties}>
                      {renaming?.id === tab.tabId && renaming.where === 'menu'
                        ? <div className="tabs-menu-open"><span className="app-badge" aria-hidden="true">{entry.badge}</span>{renameBox(tab.custom ?? tab.title)}</div>
                        : (
                          <button role="menuitem" className="tabs-menu-open" onClick={() => { setActiveId(tab.tabId); setAllTabs(false); }}>
                            <span className="app-badge" aria-hidden="true">{entry.badge}</span>
                            <span className="tabs-menu-label">{tab.custom ?? tab.title}</span>
                            <small>{entry.name}</small>
                          </button>
                        )}
                      <button className="tabs-menu-rename" title={t('tab.rename')} aria-label={`${t('tab.rename')} : ${tab.custom ?? tab.title}`}
                        onMouseDown={e => e.preventDefault()}
                        onClick={e => { e.stopPropagation(); startRename(tab, 'menu'); }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.5 2.5l3 3L6 13l-3.5.5L3 10z" /></svg>
                      </button>
                      <button className="tabs-menu-close" title={t('tab.close')} aria-label={`${t('tab.close')} : ${tab.title}`}
                        onClick={e => { e.stopPropagation(); closeTab(tab.tabId); }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                      </button>
                    </div>
                  );
                })}
                <div className="tabs-menu-foot">
                  <button className="tabs-menu-closeall" onClick={() => { closeTabs(tabs.filter(x => x.tabId !== activeId).map(x => x.tabId)); }}
                    disabled={tabs.length < 2}>{t('tab.closeOthers')}</button>
                  <button className="tabs-menu-closeall" onClick={() => { closeTabs(tabs.map(x => x.tabId)); setAllTabs(false); }}>{t('tab.closeAll')}</button>
                </div>
              </div>
            )}
          </div>
        )}
        <button className="theme-btn" aria-label={theme === 'dark' ? t('shell.themeLight') : t('shell.themeDark')}
          title={theme === 'dark' ? t('shell.themeLight') : t('shell.themeDark')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark'
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg>}
        </button>
        <select className="lang" aria-label={t('shell.language')} title={t('shell.language')} value={lang}
          onChange={e => pickLanguage(e.target.value as LanguageCode)}>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          {rememberedChoice() && <option value="__ask">↺ {t('lang.ask')}</option>}
          {activeId && originalOf(activeId) && <option value="__orig">⟲ {t('lang.original')}</option>}
        </select>
      </header>
      <ShieldHost />
      {langAsk && <LangChoiceDialog to={langAsk} onClose={() => setLangAsk(null)}
        onPick={(c, remember) => { const to = langAsk; setLangAsk(null); if (remember) rememberChoice(c); applyLanguage(to, c); }} />}
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
                <ShieldButton label />
                <span className="home-cloud">
                  <button className="glass-pill" onClick={() => setHomeCloud(o => !o)}>☁ {cloudAcc ? t('cloud.openTitle') : t('cloud.title')}</button>
                  {homeCloud && <CloudPanel onOpen={openAnyFile} onClose={() => setHomeCloud(false)} />}
                </span>
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
          <TabHost key={tab.tabId} tab={tab} hidden={tab.tabId !== activeId} makeApi={makeApi} onOpen={openAnyFile} onDrop={dropTab} />
        ))}
      </main>
      <WebAnswer />
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
function TabHost({ tab, hidden, makeApi, onOpen, onDrop }: { tab: Tab; hidden: boolean; makeApi: (tabId: string, moduleId: string) => ShellApi; onOpen: (f: OpenedFile) => void; onDrop: (tabId: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef({ makeApi, file: tab.file, handoff: tab.handoff });

  useEffect(() => {
    const el = ref.current!;
    const entry = modules.find(m => m.id === tab.moduleId);
    let mounted: MountedModule | undefined;
    let cancelled = false;
    entry?.load?.().then(({ default: mod }) => {
      if (!cancelled) mounted = mod.mount(el, first.current.makeApi(tab.tabId, tab.moduleId), first.current.file, first.current.handoff);
    }).catch(err => {
      if (!isStaleBuild(err)) { console.error(err); return; }
      // A new version was published while this page was open and this app's part has a new name: reload onto
      // the new version. A tab made just now for a file is dropped, and the file opens again after the reload.
      const file = first.current.file;
      if (file) onDrop(tab.tabId);
      void reloadToNewVersion(file);
    });
    return () => {
      cancelled = true;
      // An app is its own React root: unmounting it while this tree is committing makes React put it off, and
      // emptying the element before that made it fail ("removeChild … not a child"). So both wait a tick.
      const m = mounted;
      setTimeout(() => { m?.unmount?.(); el.innerHTML = ''; }, 0);
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
        {tab.moduleId !== 'assistant' && <WantBar moduleId={tab.moduleId} />}
        <SaveBadge tabId={tab.tabId} onOpen={onOpen} />
        <ShieldButton />
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
function SaveBadge({ tabId, onOpen }: { tabId: string; onOpen: (f: OpenedFile) => void }) {
  const cloud = useCloud();
  const [panel, setPanel] = useState(false);
  const [, redraw] = useState(0);
  useEffect(() => onSaveStatus(id => { if (id === tabId || id === '*') redraw(n => n + 1); }), [tabId]);
  // "Saved 2 min ago" stays true while the tab is open.
  useEffect(() => { const id = window.setInterval(() => redraw(n => n + 1), 30_000); return () => window.clearInterval(id); }, []);
  const s = saveStatus(tabId);
  const auto = autoSaveOn();
  const text = s.state === 'saving' ? t('save.saving')
    : s.state === 'error' ? t('save.error')
    : s.state === 'saved' ? (s.where === 'cloud' ? t('save.cloud', { where: 'GitHub' }) : s.where === 'file' ? t('save.file', { name: s.name ?? '' }) : t('save.device'))
    : '';
  const hint = s.where === 'cloud' ? t('save.cloudHint', { name: s.name ?? '' }) : s.where === 'file' ? t('save.fileHint') : t('save.deviceHint');
  return (
    <span className="save-area">
      {text && <span className={`save-badge save-${s.state}`} role="status" title={s.at ? `${hint} (${timeAgo(s.at)})` : hint}>{text}</span>}
      <label className="autosave" title={t('save.autoHint')}>
        <input type="checkbox" role="switch" checked={auto} onChange={e => setAutoSave(e.target.checked)} />
        <span className="autosave-track" aria-hidden="true" />
        <span className="autosave-label">{t('save.auto')}</span>
      </label>
      <button type="button" className={`cloud-btn${cloud ? ' on' : ''}`} title={t('cloud.title')} aria-label={t('cloud.title')} aria-expanded={panel} onClick={() => setPanel(o => !o)}>☁<span className="cloud-btn-label">{cloud ? 'GitHub' : t('cloud.short')}</span></button>
      {panel && <CloudPanel onOpen={onOpen} onClose={() => setPanel(false)} />}
    </span>
  );
}
