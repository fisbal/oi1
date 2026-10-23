# Office In 1 (OI1)

One office suite, one app:

| Module | Like | Status |
| --- | --- | --- |
| **Office Letter** | Word | Prototype works |
| **Office Class** | Excel | Planned (Phase 2) |
| **Office ProDFos** | PDF tools | Exists separately, joins in Phase 3 |
| **Office Stage** | PowerPoint | Planned (Phase 4) |
| **Office Assistant** | Copilot | Planned (Phase 6): AI help inside every module |
| **Office Notes** | OneNote | Planned (Phase 6) |
| **Office Plan** | Outlook calendar, To Do | Planned (Phase 6) |
| **Office Mail** | Outlook mail | Planned (Phase 7) |
| **Office Draw** | Visio, whiteboard | Planned (Phase 7) |
| **Office Form** | Microsoft Forms | Planned (Phase 7) |

## Try it

It is a plain web page with no build step.

- **Online:** turn on GitHub Pages (Settings → Pages → Deploy from branch `main`, folder `/`), then open the link GitHub gives you.
- **On your computer:** in this folder run `python3 -m http.server 8000` and open http://localhost:8000.
  (Opening `index.html` by double-click does not work, because browsers block modules from `file://`.)

## What works today

- **Tabs:** open several letters at once, switch and close them; tabs come back after a reload.
- **Office Letter:** write and format text (bold, italic, underline, headings, lists, alignment, undo/redo),
  open `.html` and `.txt` files, save as `.html`, and autosave so nothing is lost.
- **Letter to PDF:** the PDF button opens the print dialog; choose "Save as PDF". The text stays sharp and selectable.
- **Phones:** OI1 is an installable web app. On a phone, open the link and choose "Add to Home Screen".
  After the first visit it also opens without internet.

## How it is built

```
index.html          the page
manifest.webmanifest, sw.js   make OI1 installable and usable offline
shell/              the launcher: home screen, tabs, shared services
  modules.js        list of modules (add one line per new module)
modules/letter/     Office Letter
docs/               module contract and notes
```

Every module plugs in through one small contract: see [docs/module-contract.md](docs/module-contract.md).
The full plan (architecture, stack choice, roadmap, sources) is in the blueprint document.

## Roadmap

0. Prototype: launcher + Letter (this)
1. Letter v1: ProseMirror editor, .docx open/save
2. Class v1: Univer grid and formulas, .xlsx
3. ProDFos joins the suite
4. Stage v1: slides, .pptx
5. Desktop app with Tauri, then cloud save and co-editing
6. Office Assistant, Notes and Plan
7. Office Mail, Draw and Form
