// Office Letter: the word processor module.
// Phase 0 uses the browser's built-in rich text editing; Phase 1 swaps in ProseMirror.

const TOOLBAR = [
  { cmd: 'bold', label: 'B', title: 'Bold (Ctrl+B)', style: 'font-weight:700' },
  { cmd: 'italic', label: 'I', title: 'Italic (Ctrl+I)', style: 'font-style:italic' },
  { cmd: 'underline', label: 'U', title: 'Underline (Ctrl+U)', style: 'text-decoration:underline' },
  { sep: true },
  { cmd: 'formatBlock', arg: 'H1', label: 'H1', title: 'Heading 1' },
  { cmd: 'formatBlock', arg: 'H2', label: 'H2', title: 'Heading 2' },
  { cmd: 'formatBlock', arg: 'P', label: '¶', title: 'Normal text' },
  { sep: true },
  { cmd: 'insertUnorderedList', label: '•', title: 'Bullet list' },
  { cmd: 'insertOrderedList', label: '1.', title: 'Numbered list' },
  { sep: true },
  { cmd: 'justifyLeft', label: '⇤', title: 'Align left' },
  { cmd: 'justifyCenter', label: '↔', title: 'Center' },
  { cmd: 'justifyRight', label: '⇥', title: 'Align right' },
  { sep: true },
  { cmd: 'undo', label: '↶', title: 'Undo (Ctrl+Z)' },
  { cmd: 'redo', label: '↷', title: 'Redo (Ctrl+Y)' },
];

const EXTENSIONS = ['.html', '.htm', '.txt'];

const BLANK = '<h1>Untitled letter</h1><p>Start writing here…</p>';

export default {
  id: 'letter',
  name: 'Office Letter',
  extensions: EXTENSIONS,

  mount(el, shell) {
    let fileName = shell.storage.get('name') || 'letter.html';

    el.innerHTML = `
      <div class="letter">
        <div class="ribbon">
          <div class="group file">
            <button data-act="new">New</button>
            <button data-act="open">Open</button>
            <button data-act="save">Save</button>
            <button data-act="pdf">PDF</button>
          </div>
          <div class="group format">
            ${TOOLBAR.map((t, i) => t.sep ? '<span class="sep"></span>'
              : `<button data-i="${i}" title="${t.title}" style="${t.style || ''}">${t.label}</button>`).join('')}
          </div>
        </div>
        <div class="canvas"><article class="page" contenteditable="true" spellcheck="true"></article></div>
        <footer class="status"><span class="fname"></span><span class="count"></span></footer>
      </div>`;

    const page = el.querySelector('.page');
    const fname = el.querySelector('.fname');
    const count = el.querySelector('.count');

    page.innerHTML = shell.storage.get('doc') || BLANK;

    const refresh = () => {
      const words = (page.innerText.trim().match(/\S+/g) || []).length;
      count.textContent = `${words} word${words === 1 ? '' : 's'}`;
      fname.textContent = fileName;
    };
    const autosave = () => { shell.storage.set('doc', page.innerHTML); shell.storage.set('name', fileName); refresh(); };

    page.addEventListener('input', autosave);
    refresh();

    el.querySelector('.format').addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const t = TOOLBAR[btn.dataset.i];
      page.focus();
      document.execCommand(t.cmd, false, t.arg || null);
      autosave();
    });

    const actions = {
      new() {
        if (!confirm('Start a new letter? Unsaved changes will be lost.')) return;
        page.innerHTML = BLANK; fileName = 'letter.html'; autosave();
      },
      async open() {
        const file = await shell.openFile(EXTENSIONS);
        if (!file) return;
        page.innerHTML = file.name.endsWith('.txt') ? textToHtml(file.text) : extractBody(file.text);
        fileName = file.name.replace(/\.txt$/, '.html'); autosave();
      },
      save() {
        shell.saveFile(fileName, wrapHtml(fileName, page.innerHTML), 'text/html');
      },
      pdf() { window.print(); },
    };
    el.querySelector('.file').addEventListener('click', e => {
      const act = e.target.closest('button')?.dataset.act;
      if (act) actions[act]();
    });

    return { unmount() { autosave(); } };
  },
};

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function textToHtml(text) {
  return text.split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}

// Keep only the body of an opened HTML file, and drop scripts.
function extractBody(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed').forEach(n => n.remove());
  doc.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => {
    if (a.name.startsWith('on') || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
  }));
  return doc.body.innerHTML;
}

function wrapHtml(title, body) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Georgia,serif;max-width:46rem;margin:3rem auto;line-height:1.6;padding:0 1rem}</style>
</head><body>
${body}
</body></html>`;
}
