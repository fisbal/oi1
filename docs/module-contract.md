# The OI1 module contract

Every app inside Office In 1 (Letter, Class, Stage, ProDFos, and future ones) is a
**module**: a folder in `src/modules/<id>/` whose `index.ts(x)` exports one object.
The shell only ever talks to a module through this object, so modules never
depend on each other, and a module can be built with anything: React (Letter),
plain DOM, or a whole separate app in an iframe (ProDFos, which is Flutter).

The exact types live in [`src/shell/contract.ts`](../src/shell/contract.ts).

```ts
const letter: OI1Module = {
  id: 'letter',
  extensions: ['.docx', '.html', '.txt'], // files this module opens
  mount(el, shell, file) {                // draw inside `el`; `file` is set when opened with a file
    return { unmount() {} };
  },
};
export default letter;
```

## Services the shell gives every module

| Service | What it does |
| --- | --- |
| `shell.openFile(extensions)` | Asks the user to pick a file. Resolves to `{ name, type, handle?, text(), arrayBuffer() }` or `null`. |
| `shell.saveFile(name, content, mimeType, { target, saveAs })` | Saves a file. With `target` (a file opened earlier) it writes back to the same file in Chrome and Edge; otherwise it asks where to save, or downloads in other browsers. `content` can be a function, so a slow file is made after the user picks a place. Resolves to the saved file or `null`. |
| `shell.storage.get/set` and `load/save` | Autosave storage, kept separate for each tab: `get/set` for small values (localStorage), `load/save` for big ones like a whole document (IndexedDB). |
| `shell.recent.list()` / `open(id)` | Files this module opened or saved lately. The shell keeps them by itself. |
| `shell.setTitle(title)` | Changes the label on this module's tab. |
| `shell.openModule(id, file?)` | Opens a module in a new tab, optionally with a file. |
| `shell.goHome()` | Returns to the home screen. |

Each open tab is its own `mount()` call, so a module can be open in several tabs at once.
The shell remembers open tabs and brings them back after a reload. The home screen's
"Open a file" button, its Recent list and drag-and-drop send a file to whichever module lists its extension.

## Languages

All interface text goes through `t('key')` from [`src/shell/i18n.ts`](../src/shell/i18n.ts).
Add new keys to every language there; TypeScript reports any language that is missing one.
React components call `useLanguage()` so they re-render when the language changes.

## Adding a module

1. Create `src/modules/<id>/index.ts(x)` that exports an `OI1Module`.
2. In `src/shell/modules.ts`, set its `load` to `() => import('../modules/<id>')` and list its extensions.

When the Tauri desktop app arrives, only the shell's services change (native file
dialogs instead of browser downloads); modules stay the same.
