# Office In 1 (OI1)

One office suite, one app:

| Module | Like | Status |
| --- | --- | --- |
| **Office Letter** | Word | Works for everyday letters and documents |
| **Office Class** | Excel | Works for everyday sheets, charts and Excel files |
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
- **Dark or light:** the sun/moon button in the top bar switches the whole suite; the first visit follows the device.
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
  - **Fonts:** a real font menu (search, recent fonts, each font shown in its own face) with 40 free fonts that look
    the same on every device (Inter, Roboto, Lato, Montserrat, Poppins, Lora, Merriweather, EB Garamond, Playfair Display,
    Caveat, Dancing Script, JetBrains Mono and more), plus free look-alikes for Calibri, Cambria, Arial, Times New Roman and other Office fonts.
  - **Home** also has paste as plain text and bullet and numbering libraries (✓ ➤ ★ ▪, 1) a. A. i. I.).
  - **Table:** table styles (gold, blue, green, rose, gray, clean). **Picture:** align, size, alt text, change, delete.
  - **Layout:** hyphenation.
  - **Insert** also has callouts, letter parts (address and closing blocks), table of contents, QR codes, and tables from Class.
  - **Design:** 8 one-click document themes (Office, Scene, Classic, Modern, Elegant, Ocean, Forest, Mono), paragraph spacing, page background.
  - **Smart:** command search (Alt+Q, about 60 commands), navigation pane, clean up (quotes, spaces, empty lines),
    sort lines, text to table and back, dictation, read aloud, focus mode.
  - **Review:** comments in a side pane (reply, resolve, delete, previous/next; Ctrl+Alt+M), Track changes
    (Ctrl+Shift+E; every edit becomes a suggestion in its author's color, Accept or Reject one or all, show or hide markup),
    spelling on/off, proofing language, word count with reading and speaking time.
  - **References:** footnotes (Ctrl+Alt+F) shown at the bottom of their page like in Word, table of contents.
  - **Design** also has watermarks (CONFIDENTIAL, DRAFT, custom text and color). **View:** print layout with real pages, web layout, zoom, outline, focus.
  - **Real pages:** the letter is shown page by page with its header, footer and page numbers on every page,
    and prints (or saves as PDF) with exactly the same pages.
  - **Word files:** opens and saves `.docx` keeping page size, margins, page color and border, fonts, sizes, colors,
    letter spacing, styles, headers, footers, page numbers, lists, tables with shading, images, page breaks,
    comments with replies and resolved state, tracked changes with author and date, footnotes and watermarks.
    Also opens `.html` and `.txt`, and saves as web page or plain text.
  - **Files like a desktop app:** in Chrome and Edge, Save writes back to the file you opened; File › Save as
    asks where. Recent files are on the home screen and in the File menu. Everything autosaves in the browser.
- **Office Class v1**: a fast sheet with its own formula engine.
  - **Formulas:** 130 functions (lookups like VLOOKUP, XLOOKUP, INDEX/MATCH; SUMIFS and COUNTIFS; text, date,
    statistics and money functions), formulas across sheets (`Prices!B2`, `'My sheet'!A1:B3`), point-and-click formulas.
  - **Formatting like Excel:** fonts and sizes, bold, italic, underline, strikethrough, borders, fill and text colors,
    alignment (also vertical), wrap text (Alt+Enter for a new line), indent, Merge & Center, Format Painter, and number
    formats (number, currency, accounting, percent, fraction, scientific, dates and times, decimals, thousands).
  - **Working with data:** the fill handle (and Ctrl+D, Ctrl+R) continues numbers, dates, days, months and formulas;
    AutoFilter with sort and value lists; Remove Duplicates; Find and Replace (Ctrl+F, Ctrl+H); conditional formatting
    (highlight rules, top and bottom, data bars, color scales).
  - **Charts:** column, stacked, bar, line, area, pie, doughnut and scatter, with title, legend, data labels and color sets;
    send a chart to Letter as a picture or save it as PNG.
  - **View:** freeze panes, row heights and column widths (double-click to fit), gridlines, headings, zoom, text that runs
    over empty cells, print and PDF.
  - **Files:** `.xlsx` keeps all of the above, charts included (checked with openpyxl and LibreOffice);
    `.csv` open and save.
- **Office Code+** (phase 1): write websites and apps in the browser, nothing to install.
  - **Editor:** CodeMirror 6 with colors and completion for about 40 languages (HTML, CSS, JavaScript, TypeScript, JSX, JSON,
    Markdown, Python, SQL, Dart, Java, Kotlin, Swift, C/C++, C#, Rust, Go, PHP, Ruby, shell and more), a file tree
    (new file or folder, rename, delete, add files or a whole folder), file tabs with their own undo, find and replace,
    go to line, comment out, Tidy code (Prettier), word wrap and text size.
  - **Live preview** as you type: TypeScript and React (JSX/TSX) compiled in the page by Sucrase, npm packages from esm.sh,
    links between pages, `localStorage` kept between runs, a console with errors that jump to the right line,
    full width, tablet or phone frames (also sideways), and a new window.
  - **On your phone:** a QR code that carries the whole project in its link (small projects), or the published site's address.
  - **Templates:** web page, portfolio, little shop, blog, React + TypeScript app, empty.
  - **GitHub:** connect with a token (kept on the device only), link or create a repository, save to GitHub in one commit,
    get files from GitHub, and **Publish website** to GitHub Pages (TypeScript compiled to plain JavaScript on a `gh-pages` branch).
  - **Files:** save and open projects as `.zip`, save a ready-to-host site, open a folder.
  - **Linked:** send code to Letter; turn the cells selected in Class into a JSON data file; Class can ask Code+ for a JSON or CSV table.
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
src/modules/code/        Office Code+ (build.ts = runs projects in the browser, github.ts = GitHub REST API)
src/modules/prodfos/     Office ProDFos (its Flutter web app in a tab)
docs/                    module contract and notes
```

Built with TypeScript, React and Vite. Main libraries: [TipTap](https://tiptap.dev) (MIT, on ProseMirror),
[JSZip](https://stuk.github.io/jszip/) (MIT, our own .docx and .xlsx readers), [docx](https://github.com/dolanmiu/docx) (MIT, writes .docx),
[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT),
[CodeMirror 6](https://codemirror.net) (MIT), [Sucrase](https://github.com/alangpierce/sucrase) (MIT), [es-module-lexer](https://github.com/guybedford/es-module-lexer) (MIT),
[Prettier](https://prettier.io) (MIT), [esm.sh](https://esm.sh) (npm packages for previews), and the DM Sans and Playfair Display fonts (SIL Open Font License) through Fontsource.

Every module plugs in through one small contract: see [docs/module-contract.md](docs/module-contract.md).
The full plan (architecture, stack choice, roadmap, sources) is in the blueprint document.

## Roadmap

0. Prototype: launcher + Letter (done)
1. Letter v1: ProseMirror editor, .docx open/save, languages (done)
2. Scene look, linked apps, Class v1 with charts, fill handle, freeze panes and filters (done); Code+ phase 1 (done)
3. ProDFos joins the suite
4. Stage v1: slides, .pptx
5. Desktop app with Tauri, then cloud save and co-editing
6. Office Assistant, Notes and Plan
7. Office Mail, Draw and Form
