# Office In 1 (OI1)

One office suite, one app:

| Module | Like | Status |
| --- | --- | --- |
| **Office Letter** | Word | Works for everyday letters and documents |
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

- **Scene look** (the ProDFos design): a breathing gold nebula, glass panels, 3D app slabs with small
  animated scenes, gold 3D ribbon keys, Playfair Display and DM Sans.
- **Tabs and launcher:** open several documents at once; the 9-dot button opens any app from anywhere.
- **Apps link together:** every app has an "Office In 1" tab. Send a Class table to a letter and keep it linked
  ("Update letter"), insert the cells selected in Class from Letter, edit a letter's table in Class, open ProDFos.
- **Office Letter** (TipTap / ProseMirror editor) with a Word-style ribbon:
  - **Home:** paste, cut, copy, format painter; font and size, grow/shrink, change case, clear formatting;
    bold, italic, underline, strikethrough, subscript, superscript, text and highlight colors; lists, indents,
    alignment, line and paragraph spacing, shading, borders, formatting marks; a styles gallery
    (Normal, Title, Subtitle, Headings, Quote); find and replace.
  - **Insert:** page break, table, picture, link, header, footer, page numbers ("Page X of Y"), date, line, symbols.
  - **Layout:** margins, orientation, paper size, page color, page border, indents and spacing.
  - **Insert** also has callouts, letter parts (address and closing blocks), table of contents, QR codes, and tables from Class.
  - **Design:** 8 one-click document themes (Office, Scene, Classic, Modern, Elegant, Ocean, Forest, Mono), paragraph spacing, page background.
  - **Smart:** command search (Alt+Q, about 60 commands), navigation pane, clean up (quotes, spaces, empty lines),
    sort lines, text to table and back, dictation, read aloud, focus mode.
  - **Review:** spelling on/off, proofing language, word count with reading and speaking time. **View:** print layout with real pages, web layout, zoom, outline, focus.
  - **Real pages:** the letter is shown page by page with its header, footer and page numbers on every page,
    and prints (or saves as PDF) with exactly the same pages.
  - **Word files:** opens and saves `.docx` keeping page size, margins, page color and border, fonts, sizes, colors,
    letter spacing, styles, headers, footers, page numbers, lists, tables with shading, images and page breaks.
    Also opens `.html` and `.txt`, and saves as web page or plain text.
  - **Files like a desktop app:** in Chrome and Edge, Save writes back to the file you opened; File › Save as
    asks where. Recent files are on the home screen and in the File menu. Everything autosaves in the browser.
- **Office Class v0.1** (first version): a fast sheet with its own formula engine (about 40 functions: SUM, AVERAGE,
  IF, COUNTIF, SUMIF, ROUND, text and date functions), point-and-click formulas, copy and paste with Excel and Word,
  number formats, insert and delete rows and columns, AutoSum, sort, several sheets, and `.xlsx` / `.csv` open and save.
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
src/ui/                  shared ribbon, buttons, dialogs and file menu (the scene look)
src/formats/             formula engine, sheet model, .xlsx and .csv, tables passed between apps
src/modules/letter/      Office Letter (React + TipTap; docx/ = Word open/save, pagination.ts = pages)
src/modules/class/       Office Class (the sheet)
src/modules/prodfos/     Office ProDFos (its Flutter web app in a tab)
docs/                    module contract and notes
```

Built with TypeScript, React and Vite. Main libraries: [TipTap](https://tiptap.dev) (MIT, on ProseMirror),
[JSZip](https://stuk.github.io/jszip/) (MIT, our own .docx and .xlsx readers), [docx](https://github.com/dolanmiu/docx) (MIT, writes .docx),
[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT), and the DM Sans and Playfair Display fonts (SIL Open Font License) through Fontsource.

Every module plugs in through one small contract: see [docs/module-contract.md](docs/module-contract.md).
The full plan (architecture, stack choice, roadmap, sources) is in the blueprint document.

## Roadmap

0. Prototype: launcher + Letter (done)
1. Letter v1: ProseMirror editor, .docx open/save, languages (done)
2. Scene look, linked apps, Class v0.1 (this); Class v1: charts, fill handle, freeze panes, more functions
3. ProDFos joins the suite
4. Stage v1: slides, .pptx
5. Desktop app with Tauri, then cloud save and co-editing
6. Office Assistant, Notes and Plan
7. Office Mail, Draw and Form
