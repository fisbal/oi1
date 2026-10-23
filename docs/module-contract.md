# The OI1 module contract

Every app inside Office In 1 (Letter, Class, Stage, ProDFos, and future ones) is a
**module**: a folder in `modules/<id>/` whose `index.js` exports one object.
The shell only ever talks to a module through this object, so modules never
depend on each other.

```js
export default {
  id: 'letter',                 // short, unique, lowercase
  name: 'Office Letter',        // shown in the shell
  extensions: ['.html', '.txt'],// file types this module opens

  // Draw the module inside `el`. `shell` gives you the shared services below.
  // Return an object with an optional unmount() for cleanup.
  mount(el, shell) {
    return { unmount() {} };
  },
};
```

## Services the shell gives every module

| Service | What it does |
| --- | --- |
| `shell.openFile(extensions)` | Asks the user to pick a file. Resolves to `{ name, text }` or `null`. |
| `shell.saveFile(name, content, mimeType)` | Saves a file to the user's computer. |
| `shell.storage.get(key)` / `set(key, value)` | Small storage for autosave and settings, kept separate per module. |
| `shell.goHome()` | Returns to the home screen. |

## Adding a module

1. Create `modules/<id>/index.js` that follows the contract.
2. Add one line to `shell/modules.js` with `load: () => import('../modules/<id>/index.js')`.

That's all. When Phase 5 brings the Tauri desktop app, only the shell's
services change (native file dialogs instead of browser downloads); modules
stay the same.
