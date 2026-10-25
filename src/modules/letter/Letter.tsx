import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { FileRef, OpenedFile, RecentFile, ShellApi } from '../../shell/contract';
import { t } from '../../shell/i18n';
import { useLanguage } from '../../shell/useLanguage';
import { htmlBody, textToHtml, wrapHtml } from './html';
import { defaultStyles, emptyDoc, stylesCss, type DocStyles, type LetterDoc } from './model';
import { PX_PER_IN, defaultPage, pageInches, type PageSettings } from './page';
import { FileMenu, FindBar, MarginsDialog, WordCountDialog, type SaveFormat } from './panels';
import { Ribbon, type RibbonActions, type ViewState, type Zoom } from './Ribbon';
import { letterExtensions, migrate, readAsDataUrl } from './setup';

export const EXTENSIONS = ['.docx', '.html', '.htm', '.txt'];
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const PAGE_GAP = 24;

/** The letter this tab autosaved, or an older autosave from before headers and page setup existed. */
async function savedLetter(shell: ShellApi): Promise<LetterDoc | null> {
  try {
    const raw = await shell.storage.load('letter');
    if (raw) {
      const saved = JSON.parse(raw) as LetterDoc;
      return {
        ...saved,
        body: migrate(saved.body) ?? emptyDoc('').body,
        page: { ...defaultPage(), ...saved.page },
        styles: { ...defaultStyles(), ...saved.styles },
      };
    }
    const old = shell.storage.get('doc');
    if (old) return { ...emptyDoc(''), body: migrate(JSON.parse(old) as JSONContent)! };
  } catch { /* unreadable autosave: start fresh */ }
  return null;
}

export default function Letter({ shell, file }: { shell: ShellApi; file?: OpenedFile }) {
  const [initial, setInitial] = useState<LetterDoc | null>(null);
  useEffect(() => {
    void savedLetter(shell).then(d => setInitial(d ?? emptyDoc(t('letter.untitled'))));
  }, [shell]);
  if (!initial) return <div className="letter" />;
  return <LetterEditor shell={shell} file={file} initial={initial} />;
}

function LetterEditor({ shell, file, initial }: { shell: ShellApi; file?: OpenedFile; initial: LetterDoc }) {
  useLanguage();
  const [page, setPage] = useState<PageSettings>(initial.page);
  const [styles, setStyles] = useState<DocStyles>(initial.styles);
  const [lang, setLang] = useState(initial.lang ?? '');
  const [fileName, setFileName] = useState(() => shell.storage.get('name') || '');
  const [fileRef, setFileRef] = useState<FileRef | null>(null);
  const [dirty, setDirty] = useState(false);
  const [view, setViewState] = useState<ViewState>(() => ({
    layout: window.innerWidth < 600 ? 'web' : 'print',
    zoom: window.innerWidth < 880 ? 'width' : 1,
    marks: false,
    spell: true,
  }));
  const setView = useCallback((v: Partial<ViewState>) => setViewState(cur => ({ ...cur, ...v })), []);
  const [layout, setLayout] = useState({ pages: 1, tail: 96 });
  const [panel, setPanel] = useState<null | 'file' | 'find' | 'replace' | 'count' | 'margins'>(null);
  const [hfVersion, setHfVersion] = useState(0);
  const touched = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scope = useMemo(() => `letter-${Math.random().toString(36).slice(2, 8)}`, []);

  // ---------- editors ----------
  const saveTimer = useRef(0);
  const latest = useRef({ page, styles, lang, fileName });
  latest.current = { page, styles, lang, fileName };
  const editors = useRef<{ body: Editor | null; header: Editor | null; footer: Editor | null }>({ body: null, header: null, footer: null });

  const autosave = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const { body, header, footer } = editors.current;
      if (!body) return;
      const doc: LetterDoc = {
        body: body.getJSON(),
        header: header && !header.isEmpty ? header.getJSON() : null,
        footer: footer && !footer.isEmpty ? footer.getJSON() : null,
        page: latest.current.page,
        styles: latest.current.styles,
        lang: latest.current.lang || undefined,
      };
      void shell.storage.save('letter', JSON.stringify(doc));
      shell.storage.set('name', latest.current.fileName);
    }, 400);
  }, [shell]);

  const [active, setActive] = useState<'body' | 'header' | 'footer'>('body');
  const changed = () => { touched.current = true; setDirty(true); autosave(); };
  const attrs = (part: string) => ({ class: `doc-text ${part}-text`, spellcheck: String(view.spell), lang: lang || '' });

  const body = useEditor({
    extensions: letterExtensions('body'),
    content: initial.body,
    editorProps: { attributes: attrs('body') },
    onUpdate: changed,
    onFocus: () => setActive('body'),
  });
  const header = useEditor({
    extensions: letterExtensions('header'),
    content: initial.header ?? '',
    editorProps: { attributes: attrs('header') },
    onUpdate: () => { changed(); setHfVersion(v => v + 1); },
    onFocus: () => setActive('header'),
  });
  const footer = useEditor({
    extensions: letterExtensions('footer'),
    content: initial.footer ?? '',
    editorProps: { attributes: attrs('footer') },
    onUpdate: () => { changed(); setHfVersion(v => v + 1); },
    onFocus: () => setActive('footer'),
  });
  editors.current = { body, header, footer };
  const activeEditor = (active === 'header' ? header : active === 'footer' ? footer : body) ?? body;

  // Spelling and proofing language.
  useEffect(() => {
    for (const [part, ed] of [['body', body], ['header', header], ['footer', footer]] as const) {
      ed?.setOptions({ editorProps: { attributes: attrs(part) } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.spell, lang, body, header, footer]);

  useEffect(() => { autosave(); }, [page, styles, lang, autosave]);

  // ---------- title ----------
  const title = useEditorState({
    editor: body,
    selector: ({ editor }) => {
      if (fileName) return fileName.replace(/\.(docx|html?|txt)$/i, '');
      let heading = '';
      editor?.state.doc.descendants(node => {
        if (heading) return false;
        if (node.type.name === 'heading' || node.attrs.styleId === 'title') heading = node.textContent.trim();
        return !heading;
      });
      return (heading || t('letter.untitled')).slice(0, 60);
    },
  }) ?? t('letter.untitled');
  const words = useEditorState({ editor: body, selector: ({ editor }) => editor?.storage.characterCount.words() ?? 0 }) ?? 0;
  useEffect(() => { shell.setTitle(title); }, [title, shell]);

  // ---------- page geometry and pagination ----------
  const inches = pageInches(page);
  const pw = inches.width * PX_PER_IN;
  const ph = inches.height * PX_PER_IN;
  const m = page.margins;
  const isPrint = view.layout === 'print';
  const [canvas, setCanvas] = useState({ w: 1000, h: 800 });
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCanvas({ w: el.clientWidth, h: el.clientHeight });
      body?.storage.pagination.relayout(); // also runs when the tab is shown again
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [body]);
  const scale = !isPrint ? 1 : typeof view.zoom === 'number' ? view.zoom
    : view.zoom === 'width' ? Math.max(0.2, (canvas.w - 32) / pw)
      : Math.max(0.1, Math.min((canvas.w - 32) / pw, (canvas.h - 32) / ph));

  const headerHtml = header && !header.isEmpty ? header.getHTML() : '';
  const footerHtml = footer && !footer.isEmpty ? footer.getHTML() : '';
  useEffect(() => {
    if (!body) return;
    const store = body.storage.pagination;
    Object.assign(store.layout, {
      enabled: isPrint, pageHeight: ph, marginTop: m.top * PX_PER_IN, marginBottom: m.bottom * PX_PER_IN, gap: PAGE_GAP,
      headerHtml, footerHtml, version: store.layout.version + 1,
    });
    store.onLayout = r => setLayout(cur => (cur.pages === r.pages && Math.abs(cur.tail - r.tail) < 0.5 ? cur : r));
    store.relayout();
  }, [body, isPrint, ph, m.top, m.bottom, headerHtml, footerHtml, styles, page.size, page.orientation, m.left, m.right, hfVersion]);

  const [sheetHeight, setSheetHeight] = useState(ph);
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSheetHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Which page the cursor is on, for the status bar.
  const [cursorPage, setCursorPage] = useState(1);
  useEffect(() => {
    if (!body) return;
    const update = () => {
      const sheet = sheetRef.current;
      if (!sheet || !isPrint || !body.view.dom.isConnected) return;
      try {
        const y = (body.view.coordsAtPos(body.state.selection.from).top - sheet.getBoundingClientRect().top) / scale;
        setCursorPage(Math.min(layout.pages, Math.max(1, Math.floor(y / (ph + PAGE_GAP)) + 1)));
      } catch { /* not laid out yet */ }
    };
    body.on('selectionUpdate', update);
    body.on('update', update);
    return () => { body.off('selectionUpdate', update); body.off('update', update); };
  }, [body, isPrint, scale, ph, layout.pages]);

  // ---------- printing ----------
  const isShown = () => !!rootRef.current?.offsetParent;
  useEffect(() => {
    let style: HTMLStyleElement | null = null;
    const before = () => {
      if (!isShown()) return;
      style = document.createElement('style');
      const pageCss = isPrint
        ? `@page { size: ${inches.width}in ${inches.height}in; margin: 0 }`
        : `@page { size: ${inches.width}in ${inches.height}in; margin: ${m.top}in ${m.right}in ${m.bottom}in ${m.left}in }`;
      style.textContent = `${pageCss}
html, body { background: ${page.color ?? '#FFFFFF'} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`;
      document.head.append(style);
      document.documentElement.classList.add('printing-letter');
    };
    const after = () => {
      style?.remove();
      style = null;
      document.documentElement.classList.remove('printing-letter');
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); after(); };
  }, [isPrint, inches.width, inches.height, m.top, m.right, m.bottom, m.left, page.color]);

  const baseName = () => (title || 'letter').replace(/[\\/:*?"<>|]+/g, '').trim() || 'letter';

  const print = useCallback(() => {
    const go = () => {
      const before = document.title;
      document.title = baseName(); // names the PDF
      window.print();
      document.title = before;
    };
    if (isPrint) go();
    else { setView({ layout: 'print' }); window.setTimeout(go, 400); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrint, title]);

  // ---------- files ----------
  const letterNow = (): LetterDoc => ({
    body: body!.getJSON(),
    header: header && !header.isEmpty ? header.getJSON() : null,
    footer: footer && !footer.isEmpty ? footer.getJSON() : null,
    page, styles, lang: lang || undefined,
  });

  const showLetter = (doc: LetterDoc) => {
    body?.commands.setContent(migrate(doc.body) ?? '', { emitUpdate: false });
    header?.commands.setContent(doc.header ?? '', { emitUpdate: false });
    footer?.commands.setContent(doc.footer ?? '', { emitUpdate: false });
    setPage(doc.page);
    setStyles(doc.styles);
    setLang(doc.lang ?? '');
    setHfVersion(v => v + 1);
    body?.commands.focus('start');
  };

  async function load(f: OpenedFile) {
    if (!body) return;
    try {
      const lower = f.name.toLowerCase();
      if (lower.endsWith('.docx')) {
        const { readDocx } = await import('./docx/read'); // loaded only when needed
        showLetter(await readDocx(await f.arrayBuffer()));
        setFileRef(f.handle ? { name: f.name, handle: f.handle } : null);
      } else {
        const html = lower.endsWith('.txt') ? textToHtml(await f.text()) : htmlBody(await f.text());
        showLetter({ ...emptyDoc(''), body: { type: 'doc', content: [] } });
        body.commands.setContent(html, { emitUpdate: false });
        setFileRef(null);
      }
      const name = f.name.replace(/\.(txt|html?)$/i, '.docx');
      setFileName(name);
      latest.current.fileName = name;
      touched.current = false;
      setDirty(false);
      autosave();
    } catch (err) {
      alert(`${t('letter.openFailed')} ${f.name}\n${String(err)}`);
    }
  }

  // A tab opened with a file loads it once.
  useEffect(() => {
    if (body && header && footer && file) void load(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, header, footer]);

  /** Opens a file here when this letter is still blank, otherwise in a new tab, like Word's new window. */
  const openHere = (f: OpenedFile) => {
    if (!touched.current && !fileName) void load(f);
    else shell.openModule('letter', f);
  };

  const makeDocx = async () => {
    const { letterToDocx } = await import('./docx/write');
    return new Blob([await letterToDocx(letterNow(), title)], { type: DOCX_TYPE });
  };

  const save = async (saveAs = false) => {
    if (!body) return;
    const name = fileName.toLowerCase().endsWith('.docx') ? fileName : `${baseName()}.docx`;
    const ref = await shell.saveFile(name, makeDocx, DOCX_TYPE, { target: fileRef, saveAs });
    if (!ref) return;
    setFileRef(ref);
    setFileName(ref.name);
    latest.current.fileName = ref.name;
    setDirty(false);
    autosave();
  };

  const saveAs = (format: SaveFormat) => {
    if (!body) return;
    if (format === 'docx') void save(true);
    else if (format === 'pdf') print();
    else if (format === 'html') {
      void shell.saveFile(`${baseName()}.html`, wrapHtml(title, body.getHTML(), stylesCss(styles, page, ''), page.color), 'text/html', { saveAs: true });
    } else void shell.saveFile(`${baseName()}.txt`, body.getText({ blockSeparator: '\n\n' }), 'text/plain', { saveAs: true });
  };

  const openRecent = async (r: RecentFile) => {
    const f = await shell.recent.open(r.id);
    if (f) openHere(f);
    else alert(t('home.recentMissing'));
  };

  // ---------- ribbon actions ----------
  const painter = useRef<{ marks: { type: string; attrs: Record<string, unknown> }[] } | null>(null);
  const [painting, setPainting] = useState(false);
  useEffect(() => {
    const up = () => {
      const ed = activeEditor;
      if (!painter.current || !ed || ed.state.selection.empty) return;
      const chain = ed.chain().unsetAllMarks();
      for (const mk of painter.current.marks) chain.setMark(mk.type, mk.attrs);
      chain.run();
      painter.current = null;
      setPainting(false);
    };
    document.addEventListener('mouseup', up);
    return () => document.removeEventListener('mouseup', up);
  }, [activeEditor]);

  const hfTarget = (where: 'header' | 'footer') => (where === 'header' ? header : footer);
  const focusHf = (where: 'header' | 'footer') => {
    const ed = hfTarget(where);
    if (!ed) return;
    if (ed.isEmpty) ed.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] });
    ed.commands.focus('end');
    setActive(where);
  };

  const actions: RibbonActions = {
    fileMenu: () => setPanel('file'),
    paste: async () => {
      const ed = activeEditor;
      if (!ed) return;
      try {
        const items = await navigator.clipboard.read?.();
        const html = items?.find(i => i.types.includes('text/html'));
        if (html) { ed.view.pasteHTML(await (await html.getType('text/html')).text()); return; }
        ed.view.pasteText(await navigator.clipboard.readText());
      } catch {
        alert(t('letter.pasteBlocked'));
      }
      ed.commands.focus();
    },
    painter: () => {
      const ed = activeEditor;
      if (!ed) return;
      painter.current = { marks: ed.state.selection.$from.marks().map(mk => ({ type: mk.type.name, attrs: mk.attrs })) };
      setPainting(true);
    },
    image: async () => {
      const f = await shell.openFile(IMAGE_EXTENSIONS);
      if (!f || !activeEditor) return;
      const src = await readAsDataUrl(new Blob([await f.arrayBuffer()], { type: f.type || 'image/png' }));
      activeEditor.chain().focus().setImage({ src, alt: f.name }).run();
    },
    link: () => {
      const ed = activeEditor;
      if (!ed) return;
      const url = prompt(t('letter.linkPrompt'), ed.getAttributes('link').href ?? 'https://');
      if (url === null) return;
      if (url.trim() === '') ed.chain().focus().extendMarkRange('link').unsetLink().run();
      else ed.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
    },
    find: replace => setPanel(replace ? 'replace' : 'find'),
    header: () => focusHf('header'),
    footer: () => focusHf('footer'),
    pageNumber: (where, withTotal) => {
      if (where === 'here') { activeEditor?.chain().focus().insertPageNumber().run(); return; }
      const ed = hfTarget(where === 'top' ? 'header' : 'footer');
      if (!ed) return;
      const parts = withTotal
        ? t('letter.pageXofY').split(/(\{page\}|\{pages\})/).filter(Boolean).map(p =>
          p === '{page}' ? { type: 'pageNumber', attrs: { kind: 'page' } } : p === '{pages}' ? { type: 'pageNumber', attrs: { kind: 'pages' } } : { type: 'text', text: p })
        : [{ type: 'pageNumber', attrs: { kind: 'page' } }];
      const para = { type: 'paragraph', attrs: { textAlign: 'center' }, content: parts };
      if (ed.isEmpty) ed.commands.setContent({ type: 'doc', content: [para] });
      else ed.chain().focus('end').insertContent(parts).run();
      setActive(where === 'top' ? 'header' : 'footer');
      changed();
      setHfVersion(v => v + 1);
    },
    wordCount: () => setPanel('count'),
    customMargins: () => setPanel('margins'),
  };

  // ---------- keyboard shortcuts, like Word ----------
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || !isShown()) return;
      const k = e.key.toLowerCase();
      const run = (fn: () => unknown) => { e.preventDefault(); fn(); };
      if (k === 's') run(() => save(e.shiftKey));
      else if (k === 'o') run(async () => { const f = await shell.openFile(EXTENSIONS); if (f) openHere(f); });
      else if (k === 'p') run(print);
      else if (k === 'f') run(() => setPanel('find'));
      else if (k === 'h') run(() => setPanel('replace'));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  if (!body || !header || !footer) return null;

  const px = (n: number) => `${n}px`;
  const sheetVars = {
    '--pw': px(pw), '--ph': px(ph), '--pg-gap': px(PAGE_GAP),
    '--mt': px(m.top * PX_PER_IN), '--mb': px(m.bottom * PX_PER_IN), '--ml': px(m.left * PX_PER_IN), '--mr': px(m.right * PX_PER_IN),
    '--hd': px(page.headerDistance * PX_PER_IN), '--fd': px(page.footerDistance * PX_PER_IN),
    '--pn': '"#"', '--pt': `"${layout.pages}"`, '--pb-label': JSON.stringify(t('letter.pageBreak')),
    background: !isPrint ? page.color ?? undefined : undefined,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
  } as CSSProperties;
  const zoomPct = Math.round(scale * 100);
  const setZoom = (z: Zoom) => setView({ zoom: typeof z === 'number' ? Math.min(5, Math.max(0.1, z)) : z });

  return (
    <div className={`letter ${scope}${painting ? ' painting' : ''}`} ref={rootRef}>
      <style>{stylesCss(styles, page, `.${scope}`)}</style>
      <Ribbon editor={activeEditor} body={body} styles={styles} page={page} setPage={setPage} lang={lang} setLang={setLang}
        view={view} setView={setView} actions={actions} />
      <div className="canvas" ref={canvasRef}>
        {(panel === 'find' || panel === 'replace') && <FindBar editor={body} replace={panel === 'replace'} onClose={() => { setPanel(null); body.commands.focus(); }} />}
        <div className="sizer" style={{ width: isPrint ? pw * scale : undefined, height: isPrint ? sheetHeight * scale : undefined }}>
          <div ref={sheetRef} className={`sheet ${isPrint ? 'print-layout' : 'web-layout'}${view.marks ? ' show-marks' : ''}`} style={sheetVars}>
            {isPrint && Array.from({ length: layout.pages }, (_, i) => (
              <div key={i} className="page-frame" style={{ top: `calc(${i} * (var(--ph) + var(--pg-gap)))`, background: page.color ?? undefined }}>
                {page.border && <div className="page-border" style={{ inset: `${page.border.space}pt`, border: `${page.border.w}pt solid ${page.border.color}` }} />}
              </div>
            ))}
            <div className="hf header-area" style={{ '--pn': '"1"' } as CSSProperties} data-label={t('letter.header')}>
              <EditorContent editor={header} />
            </div>
            <div className="body-area">
              <EditorContent editor={body} />
              <div className="tail" style={isPrint ? { height: `calc(${layout.tail}px - var(--pg-slack, 0px))` } : undefined}>
                <div className="hf footer-area" style={{ '--pn': `"${layout.pages}"` } as CSSProperties} data-label={t('letter.footer')}>
                  <EditorContent editor={footer} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer className="status">
        <span>{isPrint ? t('letter.pageOf', { n: cursorPage, total: layout.pages }) : t('letter.webLayout')}</span>
        <button type="button" className="status-btn" onClick={() => setPanel('count')}>{words === 1 ? t('letter.word') : t('letter.words', { n: words })}</button>
        <span className="status-file" title={fileName || `${title}.docx`}>{fileName || `${title}.docx`}{dirty && fileRef ? ' •' : ''}</span>
        <span className="status-zoom">
          <button type="button" aria-label={t('letter.zoomOut')} title={t('letter.zoomOut')} onClick={() => setZoom(Math.round((scale - 0.1) * 10) / 10)} disabled={!isPrint}>−</button>
          <input type="range" min={10} max={300} step={5} value={zoomPct} aria-label={t('letter.zoom')} disabled={!isPrint}
            onChange={e => setZoom(Number(e.target.value) / 100)} />
          <button type="button" aria-label={t('letter.zoomIn')} title={t('letter.zoomIn')} onClick={() => setZoom(Math.round((scale + 0.1) * 10) / 10)} disabled={!isPrint}>+</button>
          <span className="pct">{zoomPct}%</span>
        </span>
      </footer>
      {panel === 'file' && (
        <FileMenu fileName={fileName || `${title}.docx`} onClose={() => setPanel(null)}
          onNew={() => shell.openModule('letter')}
          onOpen={async () => { const f = await shell.openFile(EXTENSIONS); if (f) openHere(f); }}
          onSave={() => void save()} onSaveAs={saveAs} onPrint={print}
          listRecent={shell.recent.list} onOpenRecent={r => void openRecent(r)} />
      )}
      {panel === 'count' && <WordCountDialog editor={body} pages={layout.pages} onClose={() => setPanel(null)} />}
      {panel === 'margins' && <MarginsDialog page={page} onApply={setPage} onClose={() => setPanel(null)} />}
    </div>
  );
}
