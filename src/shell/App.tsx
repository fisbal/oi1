import { useCallback, useEffect, useRef, useState } from 'react';
import type { MountedModule, OpenedFile, ShellApi } from './contract';
import { downloadFile, pickFile, wrapFile } from './files';
import { LANGUAGES, setLanguage, t, type LanguageCode } from './i18n';
import { moduleForFile, modules } from './modules';
import { store } from './storage';
import { useLanguage } from './useLanguage';

interface Tab {
  tabId: string;
  moduleId: string;
  title: string;
  file?: OpenedFile; // only for the first mount; not saved
}

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
  const [tabs, setTabs] = useState<Tab[]>(restoreTabs);
  const [activeId, setActiveId] = useState<string | null>(() => {
    const last = store.get('active');
    return tabs.some(t => t.tabId === last) ? last : null;
  });

  useEffect(() => {
    store.set('tabs', JSON.stringify(tabs.map(({ tabId, moduleId, title }) => ({ tabId, moduleId, title }))));
    store.set('active', activeId ?? '');
  }, [tabs, activeId]);

  const openModule = useCallback((moduleId: string, file?: OpenedFile) => {
    const entry = modules.find(m => m.id === moduleId);
    if (!entry?.load) return;
    const tab: Tab = { tabId: newTabId(), moduleId, title: entry.name, file };
    setTabs(ts => [...ts, tab]);
    setActiveId(tab.tabId);
  }, []);

  const openAnyFile = useCallback((file: OpenedFile | null) => {
    if (!file) return;
    const entry = moduleForFile(file.name);
    if (entry) openModule(entry.id, file);
    else alert(`${t('shell.cannotOpen')} ${file.name}`);
  }, [openModule]);

  const closeTab = useCallback((tabId: string) => {
    if (!confirm(t('tab.confirmClose'))) return;
    store.removePrefix(`${tabId}:`);
    setTabs(ts => {
      const i = ts.findIndex(t => t.tabId === tabId);
      const rest = ts.filter(t => t.tabId !== tabId);
      setActiveId(cur => (cur === tabId ? (rest[i] ?? rest[i - 1])?.tabId ?? null : cur));
      return rest;
    });
  }, []);

  const makeApi = useCallback((tabId: string): ShellApi => ({
    openFile: pickFile,
    saveFile: downloadFile,
    storage: {
      get: key => store.get(`${tabId}:${key}`),
      set: (key, value) => store.set(`${tabId}:${key}`, value),
    },
    setTitle: title => setTabs(ts => ts.map(t => (t.tabId === tabId && t.title !== title ? { ...t, title } : t))),
    openModule,
    goHome: () => setActiveId(null),
  }), [openModule]);

  // Drop a file anywhere on the window to open it.
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files[0];
      if (f) openAnyFile(wrapFile(f));
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); };
  }, [openAnyFile]);

  const readyExtensions = modules.filter(m => m.load).flatMap(m => m.extensions);

  return (
    <>
      <header className="topbar">
        <button className="brand" title={t('shell.home')} onClick={() => setActiveId(null)}>Office In 1</button>
        <nav className="tabs">
          {tabs.map(tab => {
            const entry = modules.find(m => m.id === tab.moduleId)!;
            return (
              <div key={tab.tabId} className={`tab ${tab.tabId === activeId ? 'active' : ''}`}
                style={{ '--accent': entry.color } as React.CSSProperties} title={entry.name}
                onClick={() => setActiveId(tab.tabId)}>
                <span className="tab-label">{tab.title}</span>
                <button className="tab-close" title={t('tab.close')} aria-label={t('tab.close')}
                  onClick={e => { e.stopPropagation(); closeTab(tab.tabId); }}>×</button>
              </div>
            );
          })}
          <button className="tab-new" title={t('tab.new')} aria-label={t('tab.new')} onClick={() => setActiveId(null)}>+</button>
        </nav>
        <select className="lang" aria-label={t('shell.language')} title={t('shell.language')} value={lang}
          onChange={e => setLanguage(e.target.value as LanguageCode)}>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
      </header>
      <main id="stage">
        <section className="home" hidden={activeId !== null}>
          <div className="home-head">
            <div>
              <h1>{t('home.welcome')}</h1>
              <p className="sub">{t('home.subtitle')}</p>
            </div>
            <button className="open-file" onClick={() => pickFile(readyExtensions).then(openAnyFile)}>{t('home.openFile')}</button>
          </div>
          <div className="cards">
            {modules.map(m => (
              <button key={m.id} className={`card ${m.load ? '' : 'soon'}`} style={{ '--accent': m.color } as React.CSSProperties}
                onClick={() => openModule(m.id)} disabled={!m.load}>
                <span className="badge">{m.name.split(' ')[1][0]}</span>
                <span className="name">{m.name}</span>
                <span className="kind">{t(m.kind)}</span>
                {!m.load && <span className="tag">{t('home.soon')}</span>}
              </button>
            ))}
          </div>
        </section>
        {tabs.map(tab => (
          <TabHost key={tab.tabId} tab={tab} hidden={tab.tabId !== activeId} makeApi={makeApi} />
        ))}
      </main>
    </>
  );
}

/** Mounts one module into its own element and keeps it alive while the tab is open. */
function TabHost({ tab, hidden, makeApi }: { tab: Tab; hidden: boolean; makeApi: (tabId: string) => ShellApi }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef({ makeApi, file: tab.file });

  useEffect(() => {
    const el = ref.current!;
    const entry = modules.find(m => m.id === tab.moduleId);
    let mounted: MountedModule | undefined;
    let cancelled = false;
    entry?.load?.().then(({ default: mod }) => {
      if (!cancelled) mounted = mod.mount(el, first.current.makeApi(tab.tabId), first.current.file);
    });
    return () => {
      cancelled = true;
      mounted?.unmount?.();
      el.innerHTML = '';
    };
  }, [tab.tabId, tab.moduleId]);

  return <div ref={ref} className="module-host" hidden={hidden} />;
}
