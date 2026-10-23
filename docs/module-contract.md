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
| `shell.openFile(extensions)` | Asks the user to pick a file. Resolves to `{ name, type, text(), arrayBuffer() }` or `null`. |
| `shell.saveFile(name, content, mimeType)` | Saves a file (Blob or string) to the user's computer. |
| `shell.storage.get(key)` / `set(key, value)` | Small storage for autosave, kept separate for each tab. |
| `shell.setTitle(title)` | Changes the label on this module's tab. |
| `shell.openModule(id, file?)` | Opens a module in a new tab, optionally with a file. |
| `shell.goHome()` | Returns to the home screen. |

Each open tab is its own `mount()` call, so a module can be open in several tabs at once.
The shell remembers open tabs and brings them back after a reload. The home screen's
"Open a file" button and drag-and-drop send a file to whichever module lists its extension.

## Languages

All interface text goes through `t('key')` from [`src/shell/i18n.ts`](../src/shell/i18n.ts).
Add new keys to every language there; TypeScript reports any language that is missing one.
React components call `useLanguage()` so they re-render when the language changes.

## Adding a module

1. Create `src/modules/<id>/index.ts(x)` that exports an `OI1Module`.
2. In `src/shell/modules.ts`, set its `load` to `() => import('../modules/<id>')` and list its extensions.

When the Tauri desktop app arrives, only the shell's services change (native file
dialogs instead of browser downloads); modules stay the same.
