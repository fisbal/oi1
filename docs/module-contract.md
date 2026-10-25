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
  mount(el, shell, file, handoff) {       // draw inside `el`; `file` or `handoff` is set when opened with one
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
| `shell.openModule(id, file?, handoff?)` | Opens a module in a new tab, optionally with a file or a handoff. Returns the new tab's id. |
| `shell.goHome()` | Returns to the home screen. |

Each open tab is its own `mount()` call, so a module can be open in several tabs at once.
The shell remembers open tabs and brings them back after a reload. The home screen's
"Open a file" button, its Recent list and drag-and-drop send a file to whichever module lists its extension.

## The linking rule: every module links to the others

Office In 1 is one office, not a row of separate apps. **Every module must offer a way to reach
the others from where the user is working**, and pass its work along without a save and reopen:

- an **"Office In 1" ribbon tab** (gold dot) with the actions that cross apps, and a key for every app;
- **send** what is selected to another app, and **ask** another app for something to insert;
- when a table or other piece goes from one app to another, keep a **link** so it can be updated later
  (for example a Class sheet in a letter: "Update letter" in Class, "Edit in Class" in Letter).

| Service | What it does |
| --- | --- |
| `shell.tabId` | This tab's id, so others can send things back. |
| `shell.apps()` / `shell.tabs(moduleId?)` | Every app (name, color, ready or not) and every open tab, for "send to" menus. |
| `shell.showTab(tabId)` | Brings another tab to the front. |
| `shell.send(tabId, handoff)` | Hands something to another tab. Resolves to `true` when that tab took it. |
| `shell.onReceive((handoff, from) => boolean)` | Takes what other tabs send. Return `true` when handled. |
| `shell.ask(tabId, 'table')` / `shell.onAsk(...)` | Asks another tab for something (Letter asks Class for the selected cells). |
| `shell.notify(message)` | A short message at the bottom of the window. |

A `Handoff` is one of `{ kind: 'table', table, title?, link? }`, `{ kind: 'html', html }` or
`{ kind: 'file', file }`. A `TableData` keeps each cell's shown text, its formula and bold, so a
table can go Class → Letter → Class without losing formulas. A `link` (`{ tabId, id, moduleId, title }`)
names the other side; the receiver replaces the piece with the same link id instead of adding a new one.

## Shared look

Modules use the ribbon, buttons, menus, dialogs and file menu in [`src/ui/`](../src/ui/) (`kit.tsx`, `FileMenu.tsx`),
so every app has the same "scene" look as ProDFos: void black, cream text, gold accents, Playfair Display
for titles and DM Sans for text, glass panels and 3D keys. Each app has its own accent color in `modules.ts`.

## Languages

All interface text goes through `t('key')` from [`src/shell/i18n.ts`](../src/shell/i18n.ts).
Add new keys to every language there; TypeScript reports any language that is missing one.
React components call `useLanguage()` so they re-render when the language changes.

## Adding a module

1. Create `src/modules/<id>/index.ts(x)` that exports an `OI1Module`.
2. In `src/shell/modules.ts`, set its `load` to `() => import('../modules/<id>')` and list its extensions.

When the Tauri desktop app arrives, only the shell's services change (native file
dialogs instead of browser downloads); modules stay the same.
