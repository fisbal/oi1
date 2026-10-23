import { modules } from './modules.js';

const stage = document.getElementById('stage');
const tabBar = document.getElementById('tabs');

// Open tabs: { tabId, moduleId, title, host, instance }. Saved so they come back after a reload.
let tabs = [];
let activeId = null; // null = home screen
const home = document.createElement('section');
home.className = 'home';
stage.appendChild(home);

const store = {
  get(key) { try { return localStorage.getItem(`oi1:${key}`); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(`oi1:${key}`, value); } catch { /* storage blocked */ } },
  remove(key) { try { localStorage.removeItem(`oi1:${key}`); } catch { /* storage blocked */ } },
  removePrefix(prefix) {
    try { Object.keys(localStorage).filter(k => k.startsWith(`oi1:${prefix}`)).forEach(k => localStorage.removeItem(k)); } catch { /* storage blocked */ }
  },
};

function renderHome() {
  home.innerHTML = `
    <h1>Welcome to Office In 1</h1>
    <p class="sub">One office for letters, sheets, slides, PDFs, notes, mail and more.</p>
    <div class="cards">
      ${modules.map(m => `
        <button class="card ${m.load ? '' : 'soon'}" data-id="${m.id}" style="--accent:${m.color}">
          <span class="badge">${m.name.split(' ')[1][0]}</span>
          <span class="name">${m.name}</span>
          <span class="kind">${m.kind}</span>
          ${m.load ? '' : '<span class="tag">Coming soon</span>'}
        </button>`).join('')}
    </div>`;
  home.querySelectorAll('.card').forEach(btn =>
    btn.addEventListener('click', () => openModule(btn.dataset.id)));
}

function renderTabs() {
  tabBar.innerHTML = tabs.map(t => {
    const meta = modules.find(m => m.id === t.moduleId);
    return `<div class="tab ${t.tabId === activeId ? 'active' : ''}" data-tab="${t.tabId}" style="--accent:${meta.color}" title="${meta.name}">
      <span class="tab-label">${escapeHtml(t.title)}</span>
      <button class="tab-close" data-close="${t.tabId}" title="Close tab" aria-label="Close tab">×</button>
    </div>`;
  }).join('') + '<button class="tab-new" title="New tab" aria-label="New tab">+</button>';
  store.set('tabs', JSON.stringify(tabs.map(({ tabId, moduleId, title }) => ({ tabId, moduleId, title }))));
  store.set('active', activeId || '');
}

function activate(tabId) {
  activeId = tabId;
  home.hidden = tabId !== null;
  tabs.forEach(t => { t.host.hidden = t.tabId !== tabId; });
  renderTabs();
}

async function openModule(moduleId, saved) {
  const meta = modules.find(m => m.id === moduleId);
  if (!meta || !meta.load) return;
  const { default: mod } = await meta.load();
  const tab = {
    tabId: saved?.tabId || `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    moduleId,
    title: saved?.title || meta.name,
    host: document.createElement('div'),
  };
  tab.host.className = 'module-host';
  tab.host.hidden = true;
  stage.appendChild(tab.host);
  tabs.push(tab);
  tab.instance = mod.mount(tab.host, shellApi(tab));
  if (!saved) activate(tab.tabId);
  return tab;
}

function closeTab(tabId) {
  const i = tabs.findIndex(t => t.tabId === tabId);
  if (i < 0) return;
  if (!confirm('Close this tab? Save the file first if you want to keep it.')) return;
  const [tab] = tabs.splice(i, 1);
  tab.instance?.unmount?.();
  tab.host.remove();
  store.removePrefix(`${tab.tabId}:`);
  const next = tabs[i] || tabs[i - 1];
  activate(next ? next.tabId : null);
}

// The services the shell offers to every module (see docs/module-contract.md).
function shellApi(tab) {
  return {
    // Ask the user to pick a file. Resolves to { name, text } or null.
    openFile(accept) {
      return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept.join(',');
        input.onchange = async () => {
          const file = input.files[0];
          resolve(file ? { name: file.name, text: await file.text() } : null);
        };
        input.click();
      });
    },
    // Save a file to the user's computer.
    saveFile(name, content, type) {
      const url = URL.createObjectURL(new Blob([content], { type }));
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    // Small storage for autosave, kept separate for each tab.
    storage: {
      get: key => store.get(`${tab.tabId}:${key}`),
      set: (key, value) => store.set(`${tab.tabId}:${key}`, value),
    },
    // Change the label on this module's tab.
    setTitle(title) {
      if (tab.title === title) return;
      tab.title = title;
      renderTabs();
    },
    openModule: id => openModule(id),
    goHome: () => activate(null),
  };
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

tabBar.addEventListener('click', e => {
  const close = e.target.closest('[data-close]');
  if (close) return closeTab(close.dataset.close);
  if (e.target.closest('.tab-new')) return activate(null);
  const tab = e.target.closest('[data-tab]');
  if (tab) activate(tab.dataset.tab);
});
document.getElementById('home-btn').addEventListener('click', () => activate(null));

// Start: bring back the tabs from last time.
async function start() {
  renderHome();
  const last = store.get('active');
  let saved = [];
  try { saved = JSON.parse(store.get('tabs') || '[]'); } catch { /* ignore broken data */ }
  for (const t of saved) await openModule(t.moduleId, t);
  activate(tabs.some(t => t.tabId === last) ? last : null);
}
start();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}
