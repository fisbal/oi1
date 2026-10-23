import { modules } from './modules.js';

const stage = document.getElementById('stage');
const tabs = document.getElementById('tabs');
let current = null; // { meta, instance }

function showHome() {
  closeCurrent();
  tabs.innerHTML = '';
  stage.innerHTML = `
    <section class="home">
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
      </div>
    </section>`;
  stage.querySelectorAll('.card').forEach(btn =>
    btn.addEventListener('click', () => openModule(btn.dataset.id)));
}

async function openModule(id) {
  const meta = modules.find(m => m.id === id);
  if (!meta || !meta.load) return;
  closeCurrent();
  const { default: mod } = await meta.load();
  stage.innerHTML = '';
  const host = document.createElement('div');
  host.className = 'module-host';
  stage.appendChild(host);
  const instance = mod.mount(host, shellApi(meta));
  current = { meta, instance };
  tabs.innerHTML = `<span class="tab" style="--accent:${meta.color}">${meta.name}</span>`;
}

function closeCurrent() {
  if (current && current.instance && current.instance.unmount) current.instance.unmount();
  current = null;
}

// The services the shell offers to every module.
function shellApi(meta) {
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
    // Download a file to the user's computer.
    saveFile(name, content, type) {
      const url = URL.createObjectURL(new Blob([content], { type }));
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    // Small per-module storage for autosave and settings.
    storage: {
      get(key) { try { return localStorage.getItem(`oi1:${meta.id}:${key}`); } catch { return null; } },
      set(key, value) { try { localStorage.setItem(`oi1:${meta.id}:${key}`, value); } catch { /* storage blocked */ } },
    },
    goHome: showHome,
  };
}

document.getElementById('home-btn').addEventListener('click', showHome);
showHome();
