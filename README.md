# Office In 1 (OI1)

One office suite, one app:

| Module | Like | Status |
| --- | --- | --- |
| **Office Letter** | Word | Prototype works |
| **Office Class** | Excel | Planned (Phase 2) |
| **Office ProDFos** | PDF reader and tools | Opens inside OI1 from its web version ([fisbal/prodfos](https://github.com/fisbal/prodfos), Flutter) |
| **Office Stage** | PowerPoint | Planned (Phase 4) |
| **Office Assistant** | Copilot | Planned (Phase 6): AI help inside every module |
| **Office Notes** | OneNote | Planned (Phase 6) |
| **Office Plan** | Outlook calendar, To Do | Planned (Phase 6) |
| **Office Mail** | Outlook mail | Planned (Phase 7) |
| **Office Draw** | Visio, whiteboard | Planned (Phase 7) |
| **Office Form** | Microsoft Forms | Planned (Phase 7) |

## Try it

- **Online:** https://fisbal.github.io/oi1/ (built and published automatically on every push to `main`).
- **On your computer:** install Node.js 22, then in this folder run `npm install` and `npm run dev`,
  and open the address it prints. `npm test` runs the tests, `npm run build` makes the site in `dist/`.

## What works today

- **Tabs:** open several letters at once, switch and close them; tabs come back after a reload.
- **Office Letter** (TipTap / ProseMirror editor): headings, bold, italic, underline, strikethrough, text color,
  highlight, lists, quotes, alignment, links, images and tables. Opens `.docx`, `.html` and `.txt`;
  saves real Word `.docx` files and `.html`; autosaves so nothing is lost.
- **Languages:** English, Français, Español, Português and Deutsch, picked automatically from the browser
  and changeable in the top bar.
- **Open any file:** the "Open a file" button on the home screen, or drag a file onto the window.
- **Letter to PDF:** the PDF button opens the print dialog; choose "Save as PDF". The text stays sharp and selectable.
- **Phones:** OI1 is an installable web app. On a phone, open the link and choose "Add to Home Screen".
  After the first visit it also opens without internet.

## How it is built

```
index.html               the page
public/                  icons, manifest and service worker (installable, works offline)
src/shell/               the launcher: home screen, tabs, languages, shared services
  contract.ts            the module contract (types)
  modules.ts             list of modules
  i18n.ts                interface text in every language
src/modules/letter/      Office Letter (React + TipTap; docx.ts = Word open/save)
src/modules/prodfos/     Office ProDFos (its Flutter web app in a tab)
docs/                    module contract and notes
```

Built with TypeScript, React and Vite. Main libraries: [TipTap](https://tiptap.dev) (MIT, on ProseMirror),
[mammoth](https://github.com/mwilliamson/mammoth.js) (BSD-2, reads .docx), [docx](https://github.com/dolanmiu/docx) (MIT, writes .docx).

Every module plugs in through one small contract: see [docs/module-contract.md](docs/module-contract.md).
The full plan (architecture, stack choice, roadmap, sources) is in the blueprint document.

## Roadmap

0. Prototype: launcher + Letter (done)
1. Letter v1: ProseMirror editor, .docx open/save, languages (this)
2. Class v1: Univer grid and formulas, .xlsx
3. ProDFos joins the suite
4. Stage v1: slides, .pptx
5. Desktop app with Tauri, then cloud save and co-editing
6. Office Assistant, Notes and Plan
7. Office Mail, Draw and Form
