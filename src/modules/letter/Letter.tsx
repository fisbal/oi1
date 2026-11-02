import { isStaleBuild, reloadToNewVersion } from '../../shell/staleBuild';
import { useDictation } from '../../ui/useDictation';
import { insertDictation } from '../../ui/dictation';
import { closeHistory } from '@tiptap/pm/history';
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { FileRef, Handoff, HandoffLink, OpenedFile, RecentFile, ShellApi, TableData } from '../../shell/contract';
import { getLanguage, t } from '../../shell/i18n';
import { useLanguage } from '../../shell/useLanguage';
import { isLiveId, liveStore, newLiveId } from '../../shell/live';
import { relabel } from '../../shell/defaultNames';
import { useLiveTables } from './liveTables';
import { recheck } from '../../ui/proof/extension';
import { ProofBubble } from '../../ui/proof/Bubble';
import { ProofButtons } from '../../ui/proof/ProofButtons';
import { baseLang } from '../../ui/proof/proof';
import { FileMenu } from '../../ui/FileMenu';
import { Icon } from '../../ui/kit';
import { Copilot, useCopilotShortcut } from '../../ui/Copilot';
import { usePinchZoom } from '../../ui/pinch';
import { FastScroll } from '../../ui/FastScroll';
import { letterCopilot } from './copilot';
import { htmlBody, textToHtml, wrapHtml } from './html';
import { PASTE_PROMPTS, pasteHtml, type PasteKind } from './textTools';
import { markdownToHtml } from '../../ui/markdown';
import { blankDoc, defaultStyles, emptyDoc, stylesCss, suggestedName, type DocStyles, type LetterDoc } from './model';
import { listStylesCss } from './extensions';
import { PX_PER_IN, defaultPage, isDark, pageInches, type PageSettings } from './page';
import { CommandPalette, FindBar, MarginsDialog, OutlinePane, WordCountDialog, type Command } from './panels';
import { Ribbon, type RibbonActions, type ViewState, type Zoom } from './Ribbon';
import { letterExtensions, migrate, readAsDataUrl } from './setup';
import {
  calloutJson, cleanUp, findLinkedTable, letterBlockJson, qrDataUrl, readingStats, replaceTable, sortSelection,
  tableAt, tableData, tableJson, tableToText, textToTable, tocJson,
} from './smart';
import { SPACING, THEMES } from './themes';
import { CV_TEMPLATES } from './templates/cv';
import { FillDialog, ProfileDialog } from './templates/dialogs';
import {
  CITATION_STYLES, bibliographyJson, captionJson, citedSources, indexEntries, indexJson, refTargets, refText, restyleCitations, tableOfFiguresJson, updateSource,
  type CaptionLabel, type CitationStyle, type RefForm, type RefTarget, type Source,
} from './references';
import { SourceDialog } from './sourceDialog';
import { RefCheckDialog, RefModelsDialog } from './refModels';
import { LETTERS } from './templates/letters';
import { fieldList, fieldsIn, fillFields, isEmptyDoc, longDate, markupToDoc, selectNextField } from './templates/markup';
import { TOC_MARK, WORK_LAYOUTS, workDoc, workMargins, workStyles } from './templates/works';
import { profileValues } from './templates/profile';
import { letterPartMarkup, type LetterPart } from './templates/parts';
import { CommentsPane, showComment } from './comments';
import { ConvertPanel } from '../../ui/convert/ConvertPanel';
import { translateJson, type ConvertSource } from '../../shell/convert';
import { tablesInHtml } from '../../formats/textFormats';
import { notesDom, type LayoutResult } from './pagination';
import {
  addCommentMark, changeAt, commentRanges, commentsAt, footnoteAt, goToChange, isTracking, listChanges, listFootnotes,
  newCommentId, removeCommentMark, resolveChange, setTracking, setUserNameTexts, userName, type LetterComment,
} from './review';

type SaveFormat = 'docx' | 'html' | 'txt' | 'pdf';
const SHEET_EXTENSIONS = ['.xlsx', '.csv', '.tsv'];
/** A full language tag for speech, like 'fr-FR', from the letter's proofing language or the interface. */
const speechLang = (lang: string) => lang || ({ en: 'en-US', fr: 'fr-FR', es: 'es-ES', pt: 'pt-PT', de: 'de-DE' } as Record<string, string>)[getLanguage()] || navigator.language;

export const EXTENSIONS = ['.docx', '.html', '.htm', '.txt'];
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const PAGE_GAP = 24;

/** The comments and the Track changes switch, as saved with the letter. `prune` leaves out comments whose text is gone. */
function savedReview(body: Editor | null, comments: LetterComment[], prune = false): Pick<LetterDoc, 'comments' | 'track'> {
  const live = prune && body ? commentRanges(body.state.doc) : null;
  const kept = live ? comments.filter(c => live.has(c.id)) : comments;
  return { comments: kept.length ? kept : undefined, track: body && isTracking(body) ? true : undefined };
}

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

export default function Letter({ shell, file, handoff }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff }) {
  const [initial, setInitial] = useState<LetterDoc | null>(null);
  useEffect(() => {
    void savedLetter(shell).then(d => setInitial(d ?? blankDoc()));
  }, [shell]);
  if (!initial) return <div className="letter" />;
  return <LetterEditor shell={shell} file={file} handoff={handoff} initial={initial} />;
}

function LetterEditor({ shell, file, handoff, initial }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff; initial: LetterDoc }) {
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
  const [layout, setLayout] = useState<LayoutResult>({ pages: 1, tail: 96, notes: [] });
  const [panel, setPanel] = useState<null | 'file' | 'find' | 'replace' | 'count' | 'margins' | 'commands' | 'fill' | 'profile' | 'source' | 'sourceAi' | 'refModels' | 'refCheck'>(null);
  // What the source dialog starts from: a type of document (Models) or a source to complete (Check sources).
  const [sourceStart, setSourceStart] = useState<{ initial?: Partial<Source>; highlight?: (keyof Source)[]; update?: boolean } | null>(null);
  const [citeStyle, setCiteStyleState] = useState<CitationStyle>(() => {
    const saved = shell.storage.get('citeStyle') as CitationStyle | null;
    return saved && saved in CITATION_STYLES ? saved : getLanguage() === 'fr' ? 'apaFr' : 'apa';
  });
  const [copilot, setCopilot] = useState(false);
  const [copilotStart, setCopilotStart] = useState<{ id: string; n: number }>();
  const [docLang, setDocLang] = useState<'fr' | 'en'>(() => (shell.storage.get('docLang') as 'fr' | 'en' | null) || (getLanguage() === 'fr' ? 'fr' : 'en'));
  const [outline, setOutline] = useState(() => window.innerWidth >= 1200 && shell.storage.get('outline') === '1');
  const [focusMode, setFocusMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [hfVersion, setHfVersion] = useState(0);
  const [comments, setCommentsState] = useState<LetterComment[]>(initial.comments ?? []);
  const [commentsOpen, setCommentsOpen] = useState(() => (initial.comments ?? []).some(c => !c.resolved) && window.innerWidth >= 900);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [markup, setMarkup] = useState(true);
  const touched = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useCopilotShortcut(() => setCopilot(o => !o), rootRef);
  const canvasRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scope = useMemo(() => `letter-${Math.random().toString(36).slice(2, 8)}`, []);

  // ---------- editors ----------
  const saveTimer = useRef(0);
  const latest = useRef({ page, styles, lang, fileName, comments });
  latest.current = { page, styles, lang, fileName, comments };
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
        ...savedReview(body, latest.current.comments),
      };
      void shell.storage.save('letter', JSON.stringify(doc));
      shell.storage.set('name', latest.current.fileName);
    }, 400);
  }, [shell]);

  const [active, setActive] = useState<'body' | 'header' | 'footer'>('body');
  const changed = () => { touched.current = true; setDirty(true); autosave(); };
  // Our own checker covers its five languages; for the others, the browser's checker underlines instead.
  const ownProofing = !!baseLang(lang || getLanguage());
  const attrs = (part: string) => ({ class: `doc-text ${part}-text`, spellcheck: String(view.spell && !ownProofing), lang: lang || '' });
  const proofRef = useRef({ spell: view.spell, lang });
  proofRef.current = { spell: view.spell, lang };
  const proof = useMemo(() => ({ enabled: () => proofRef.current.spell, lang: () => proofRef.current.lang }), []);

  const body = useEditor({
    extensions: letterExtensions('body', proof),
    content: initial.body,
    editorProps: { attributes: attrs('body') },
    onUpdate: changed,
    onFocus: () => setActive('body'),
  });
  const header = useEditor({
    extensions: letterExtensions('header', proof),
    content: initial.header ?? '',
    editorProps: { attributes: attrs('header') },
    onUpdate: () => { changed(); setHfVersion(v => v + 1); },
    onFocus: () => setActive('header'),
  });
  const footer = useEditor({
    extensions: letterExtensions('footer', proof),
    content: initial.footer ?? '',
    editorProps: { attributes: attrs('footer') },
    onUpdate: () => { changed(); setHfVersion(v => v + 1); },
    onFocus: () => setActive('footer'),
  });
  editors.current = { body, header, footer };
  const activeEditor = (active === 'header' ? header : active === 'footer' ? footer : body) ?? body;
  const activeRef = useRef(active);
  activeRef.current = active;

  // Spelling and proofing language.
  useEffect(() => {
    for (const [part, ed] of [['body', body], ['header', header], ['footer', footer]] as const) {
      ed?.setOptions({ editorProps: { attributes: attrs(part) } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    for (const ed of [body, header, footer]) recheck(ed);
  }, [view.spell, lang, body, header, footer]);

  useEffect(() => { autosave(); }, [page, styles, lang, comments, autosave]);
  useEffect(() => {
    setUserNameTexts(() => t('letter.yourName'), t('letter.authorDefault'));
    if (body && initial.track && !isTracking(body)) setTracking(body, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);
  const tracking = useEditorState({ editor: body, selector: ({ editor }) => !!editor && isTracking(editor) }) ?? false;
  const reviewHere = useEditorState({
    editor: body,
    selector: ({ editor }) => (editor ? {
      comments: commentsAt(editor.state),
      change: !!changeAt(editor),
      changes: listChanges(editor.state.doc).length,
      footnote: !!footnoteAt(editor.state),
      footnotes: listFootnotes(editor.state.doc),
    } : null),
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });

  // ---------- title ----------
  // As in Word: the name stays "Untitled letter" (Document1) until the letter is saved or renamed; the words typed
  // or dictated never rename it by themselves (Martin, 2026-11-01). A first save suggests the first line (baseName).
  const title = fileName ? fileName.replace(/\.(docx|html?|txt)$/i, '') : t('letter.untitled');
  const words = useEditorState({ editor: body, selector: ({ editor }) => editor?.storage.characterCount.words() ?? 0 }) ?? 0;
  const fields = useEditorState({ editor: body, selector: ({ editor }) => (editor ? fieldsIn(editor.state.doc).length : 0) }) ?? 0;
  const inTable = useEditorState({ editor: body, selector: ({ editor }) => !!editor && editor.isActive('table') }) ?? false;
  const linkedTable = useEditorState({ editor: body, selector: ({ editor }) => (editor ? !!tableAt(editor)?.node.attrs.link : false) }) ?? false;
  useEffect(() => { shell.setTitle(title); }, [title, shell]);
  // A new letter's "Untitled letter" heading follows the interface language (a heading the person wrote stays).
  const uiLang = getLanguage();
  useEffect(() => {
    if (!body) return;
    let at: { pos: number; size: number; text: string } | null = null;
    body.state.doc.descendants((node, pos) => {
      if (at) return false;
      if (node.type.name === 'heading' || node.attrs.styleId === 'title') { at = { pos: pos + 1, size: node.content.size, text: node.textContent }; return false; }
      return true;
    });
    const found = at as { pos: number; size: number; text: string } | null;
    const now = found && relabel('letter.untitled', found.text);
    if (!found || !now) return;
    const tr = body.state.tr.insertText(now, found.pos, found.pos + found.size).setMeta('addToHistory', false);
    body.view.dispatch(tr);
  }, [body, uiLang]);

  // Renaming the tab renames the letter: it saves and exports under that name.
  useEffect(() => {
    shell.onRename?.(name => {
      const file = `${name}.docx`;
      setFileName(file);
      latest.current.fileName = file;
      shell.storage.set('name', file);
    });
    return () => shell.onRename?.(null);
  }, [shell]);

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
    store.onLayout = r => setLayout(cur => (cur.pages === r.pages && Math.abs(cur.tail - r.tail) < 0.5
      && JSON.stringify(cur.notes) === JSON.stringify(r.notes) ? cur : r));
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

  // A first save suggests the first line, as Word does; afterwards the file's own name is used.
  const baseName = () => (fileName ? title : suggestedName(body?.getText({ blockSeparator: '\n' }) ?? '', title)).replace(/[\\/:*?"<>|]+/g, '').trim() || 'letter';

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
    ...savedReview(body, comments, true),
  });

  const showLetter = (doc: LetterDoc) => {
    body?.commands.setContent(migrate(doc.body) ?? '', { emitUpdate: false });
    header?.commands.setContent(doc.header ?? '', { emitUpdate: false });
    footer?.commands.setContent(doc.footer ?? '', { emitUpdate: false });
    setPage(doc.page);
    setStyles(doc.styles);
    setLang(doc.lang ?? '');
    setCommentsState(doc.comments ?? []);
    setCommentsOpen(o => o || (doc.comments ?? []).some(c => !c.resolved));
    setEditingComment(null);
    if (body && isTracking(body) !== !!doc.track) setTracking(body, !!doc.track);
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
      // A new version was published while this page was open: reload onto it and open this file again.
      if (isStaleBuild(err) && await reloadToNewVersion(f)) return;
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
    return new Blob([await letterToDocx(letterNow(), title, userName())], { type: DOCX_TYPE });
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
  // AutoSave: once the letter has a file, the shell writes it there after each pause in the work.
  const quietSave = useRef<() => Promise<FileRef | null>>(async () => null);
  quietSave.current = async () => {
    if (!body) return null;
    // Its own .docx file when it has one; with the cloud on, a document without a file is saved there too.
    const own = !!fileRef?.handle && fileName.toLowerCase().endsWith('.docx');
    if (!own && !shell.cloudOn?.()) return null;
    const ref = await shell.saveFile(own ? fileName : `${baseName()}.docx`, makeDocx, DOCX_TYPE, { target: own ? fileRef : undefined, quiet: true });
    if (ref) setDirty(false);
    return ref;
  };
  useEffect(() => { shell.autoSave(() => quietSave.current()); return () => shell.autoSave(null); }, [shell]);
  // Changing the language can translate the letter too: every run of text, keeping its bold, links and styles.
  // Each part (body, header, footer) changes in one step, so Undo brings it back.
  useEffect(() => {
    const parts = { body, header, footer };
    const textsOf = (doc: import('@tiptap/pm/model').Node) => {
      const runs: { from: number; to: number; text: string; marks: readonly import('@tiptap/pm/model').Mark[] }[] = [];
      doc.descendants((node, pos) => { if (node.isText && /\p{L}{2,}/u.test(node.text ?? '')) runs.push({ from: pos, to: pos + node.nodeSize, text: node.text!, marks: node.marks }); });
      return runs;
    };
    type Snap = Partial<Record<keyof typeof parts, unknown>>;
    shell.translator?.({
      snapshot: () => Object.fromEntries(Object.entries(parts).filter(([, ed]) => ed && !ed.isDestroyed).map(([k, ed]) => [k, ed!.getJSON()])),
      words: base => Object.entries(base as Snap).flatMap(([k, json]) => {
        const ed = parts[k as keyof typeof parts];
        return ed && json ? textsOf(ed.schema.nodeFromJSON(json)).map(r => r.text) : [];
      }),
      apply: async (base, tr) => {
        let n = 0;
        for (const [k, json] of Object.entries(base as Snap)) {
          const ed = parts[k as keyof typeof parts];
          if (!ed || ed.isDestroyed || !json) continue;
          const doc = ed.schema.nodeFromJSON(json);
          const runs = textsOf(doc);
          const got = tr ? await tr(runs.map(r => r.text)) : runs.map(r => r.text);
          // The original first, then its words translated: the result never builds on an earlier translation.
          const t = ed.state.tr.replaceWith(0, ed.state.doc.content.size, doc.content);
          for (let i = runs.length - 1; i >= 0; i--) if (got[i] && got[i] !== runs[i].text) { t.replaceWith(runs[i].from, runs[i].to, ed.schema.text(got[i], runs[i].marks)); n++; }
          // Its own Undo step, never merged with the last words typed.
          if (!t.doc.eq(ed.state.doc)) { ed.view.dispatch(closeHistory(t)); if (!tr) n++; }
        }
        return n;
      },
    });
    return () => shell.translator?.(null);
  }, [shell, body, header, footer]);

  const saveAs = (format: SaveFormat) => {
    if (!body) return;
    if (format === 'docx') void save(true);
    else if (format === 'pdf') print();
    else if (format === 'html') {
      void shell.saveFile(`${baseName()}.html`, wrapHtml(title, body.getHTML(), stylesCss(styles, page, '') + listStylesCss('body'), page.color), 'text/html', { saveAs: true });
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


  // ---------- beyond Word: smart tools ----------
  // Dictation: one engine for all In 1 apps (Web Speech when it works, Whisper on the device otherwise).
  const dict = useDictation(speechLang(lang), text => insertDictation(editors.current[activeRef.current] ?? body, text));
  const dictating = dict.active;
  const dictate = dict.toggle;
  useEffect(() => { if (dict.error) shell.notify(dict.message); }, [dict.error, dict.message, shell]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const readAloud = () => {
    const synth = window.speechSynthesis;
    if (!synth) { alert(t('letter.readAloudUnsupported')); return; }
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const ed = activeEditor;
    if (!ed) return;
    const { from, to, empty } = ed.state.selection;
    const text = empty ? ed.state.doc.textBetween(from, ed.state.doc.content.size, '\n') || ed.getText() : ed.state.doc.textBetween(from, to, '\n');
    if (!text.trim()) return;
    synth.cancel();
    // Long letters are read paragraph by paragraph, so browsers do not stop half way.
    const parts = text.split(/\n+/).filter(p => p.trim());
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = speechLang(lang);
      if (i === parts.length - 1) u.onend = () => setSpeaking(false);
      synth.speak(u);
    });
    setSpeaking(true);
  };

  const enterFocus = () => {
    setFocusMode(true);
    void rootRef.current?.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const change = () => { if (!document.fullscreenElement) setFocusMode(false); };
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  const exitFocus = () => {
    setFocusMode(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };

  /** The page a spot in the letter is on, for the table of contents. */
  const pageOf = (pos: number): number | null => {
    const sheet = sheetRef.current;
    if (!sheet || !isPrint || !body) return null;
    try {
      const y = (body.view.coordsAtPos(pos).top - sheet.getBoundingClientRect().top) / scale;
      return Math.max(1, Math.floor(y / (ph + PAGE_GAP)) + 1);
    } catch { return null; }
  };

  // ---------- links with In 1 Class and the other apps ----------
  // Linked tables are live parts: they follow every change made in Class (or any app) and send theirs back.
  useLiveTables(body, title);
  const linkFor = (id: string): HandoffLink => ({ tabId: shell.tabId, id, moduleId: 'letter', title });

  /** Puts a table from a sheet into the letter: updates the linked copy when there is one, otherwise inserts it. */
  const placeTable = (table: TableData, link: HandoffLink | undefined, from: string | null): boolean => {
    if (!body) return false;
    if (link) {
      const at = findLinkedTable(body.state.doc, link.id);
      if (at) {
        replaceTable(body, at, table);
        if (from && at.node.attrs.linkTab !== from) {
          const again = findLinkedTable(body.state.doc, link.id);
          if (again) body.view.dispatch(body.state.tr.setNodeMarkup(again.pos, undefined, { ...again.node.attrs, linkTab: from }));
        }
        shell.notify(t('letter.tableUpdated'));
        return true;
      }
    }
    const attrs = link ? { link: link.id, linkTab: from } : {};
    body.chain().focus().insertContent([tableJson(table, attrs), { type: 'paragraph' }]).run();
    return true;
  };

  useEffect(() => {
    if (!body) return;
    const stopReceive = shell.onReceive((h, from) => {
      if (h.kind === 'file') { openHere(h.file); return true; }
      if (h.kind === 'html') { body.chain().focus().insertContent(h.html).run(); return true; }
      return placeTable(h.table, h.link, from);
    });
    return stopReceive;
  });

  // A letter opened by another app with a table (a heading and the table, linked back to the sheet) or with
  // ready-made content, like a chart picture from Class.
  useEffect(() => {
    if (!body) return;
    if (handoff?.kind === 'html') {
      body.commands.setContent({ type: 'doc', content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: handoff.title || t('letter.untitled') }] },
        { type: 'paragraph' },
      ] }, { emitUpdate: false });
      body.chain().focus('end').insertContent(handoff.html).run();
      return;
    }
    if (handoff?.kind !== 'table') return;
    body.commands.setContent({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: handoff.title || t('letter.untitled') }] },
      { type: 'paragraph' },
    ] }, { emitUpdate: false });
    body.commands.focus('end');
    placeTable(handoff.table, handoff.link, handoff.link?.tabId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  // The letter as slides in In 1 Stage: each heading starts a slide, its paragraphs become the points.
  const makeSlides = () => {
    if (!body) return;
    shell.openModule('stage', undefined, { kind: 'html', title, html: body.getHTML() });
  };

  const editInClass = () => {
    const ed = activeEditor ?? body;
    const at = ed && tableAt(ed);
    if (!ed || !at) { shell.notify(t('letter.clickInTable')); return; }
    const data = tableData(at.node);
    const old = at.node.attrs.link as string | null;
    // A live part, so the table stays in step with the sheet both ways (an older one-time link becomes one).
    const id = isLiveId(old) ? old : newLiveId();
    void liveStore().ensure(id, { kind: 'table', title, table: data }, 'letter', 'letter');
    if (id !== old) ed.view.dispatch(ed.state.tr.setNodeMarkup(at.pos, undefined, { ...at.node.attrs, link: id }));
    const linkTab = at.node.attrs.linkTab as string | null;
    if (linkTab && shell.tabs('class').some(x => x.tabId === linkTab)) {
      void shell.send(linkTab, { kind: 'table', title, table: data, link: linkFor(id) });
      shell.showTab(linkTab);
      return;
    }
    const tabId = shell.openModule('class', undefined, { kind: 'table', title, table: data, link: linkFor(id) });
    const now = findLinkedTable(ed.state.doc, id);
    if (tabId && now) ed.view.dispatch(ed.state.tr.setNodeMarkup(now.pos, undefined, { ...now.node.attrs, link: id, linkTab: tabId }));
  };

  const insertFromSheet = async (tabId: string | null) => {
    if (tabId) {
      const h = await shell.ask(tabId, 'table');
      if (h?.kind === 'table') { placeTable(h.table, h.link, tabId); shell.notify(t('letter.tableInserted')); }
      else shell.notify(t('letter.sheetGone'));
      return;
    }
    const f = await shell.openFile(SHEET_EXTENSIONS);
    if (!f) return;
    try {
      const [{ computeSheet, currencyFor, usedRange }, { sheetToTable }] = await Promise.all([import('../../formats/sheet'), import('../../formats/table')]);
      let book;
      if (f.name.toLowerCase().endsWith('.xlsx')) book = await (await import('../../formats/xlsx')).readXlsx(await f.arrayBuffer());
      else {
        const { parseCsv } = await import('../../formats/csv');
        const { tableToCells } = await import('../../formats/table');
        book = { sheets: [{ name: f.name, widths: {}, cells: tableToCells({ rows: parseCsv(await f.text()).map(r => r.map(text => ({ text }))) }) }] };
      }
      const sheet = book.sheets[0];
      const u = usedRange(sheet);
      if (u.rows < 0) return;
      placeTable(sheetToTable(sheet, { c1: 0, r1: 0, c2: u.cols, r2: u.rows }, computeSheet(sheet), getLanguage(), currencyFor(getLanguage(), book)), undefined, null);
    } catch (err) {
      // A new version was published while this page was open: reload onto it (the letter is kept on the device).
      if (isStaleBuild(err) && await reloadToNewVersion()) return;
      alert(`${t('letter.openFailed')} ${f.name}\n${String(err)}`);
    }
  };

  const share = async () => {
    const blob = await makeDocx();
    const f = new File([blob], `${baseName()}.docx`, { type: DOCX_TYPE });
    if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title }).catch(() => {});
    else void save(true);
  };

  const smart = {
    commandSearch: () => setPanel('commands'),
    dictate,
    readAloud,
    outline: () => setOutline(o => { shell.storage.set('outline', o ? '0' : '1'); return !o; }),
    focus: enterFocus,
    theme: (th: (typeof THEMES)[number]) => { setStyles(th.styles); setPage(p => ({ ...p, color: th.page })); },
    spacing: (id: keyof typeof SPACING) => setStyles(st => ({ ...st, normal: { ...st.normal, ...SPACING[id] } })),
    toc: () => {
      if (!body) return;
      const content = tocJson(body, pageOf, pw - (m.left + m.right) * PX_PER_IN);
      if (!content) { shell.notify(t('letter.tocEmpty')); return; }
      body.chain().focus().insertContent(content).run();
    },
    callout: (kind: Parameters<typeof calloutJson>[0]) => activeEditor?.chain().focus().insertContent([calloutJson(kind, isDark(page.color))]).run(),
    letterBlock: (kind: 'full' | 'closing') => activeEditor?.chain().focus().insertContent(letterBlockJson(kind, lang)).run(),
    qr: async () => {
      const ed = activeEditor;
      if (!ed) return;
      const text = prompt(t('letter.qrPrompt'), (ed.getAttributes('link').href as string | undefined) ?? 'https://');
      if (!text?.trim()) return;
      const src = await qrDataUrl(text.trim());
      ed.chain().focus().insertContent({ type: 'image', attrs: { src, alt: text.trim(), width: 132 } }).run();
    },
    cleanUp: (what: Parameters<typeof cleanUp>[1]) => {
      if (!body) return;
      const n = cleanUp(body, what, lang || getLanguage());
      shell.notify(n ? t('letter.cleanedUp', { n }) : t('letter.cleanNothing'));
    },
    sort: (dir: 1 | -1) => { if (activeEditor && !sortSelection(activeEditor, dir, lang || getLanguage())) shell.notify(t('letter.sortHint')); },
    textToTable: () => { if (activeEditor && !textToTable(activeEditor)) shell.notify(t('letter.sortHint')); },
    tableToText: () => { if (activeEditor && !tableToText(activeEditor)) shell.notify(t('letter.clickInTable')); },
    editInClass,
    makeSlides,
    insertFromSheet: (tabId: string | null) => void insertFromSheet(tabId),
    newSheet: () => shell.openModule('class'),
    openApp: (id: string) => shell.openModule(id),
    share: () => void share(),
    pdf: () => print(),
  };

  // ---------- review: comments, tracked changes, footnotes ----------
  const setComments = (next: LetterComment[]) => { setCommentsState(next); changed(); };
  const goToComment = (dir: 1 | -1) => {
    if (!body) return;
    const ranges = [...commentRanges(body.state.doc)];
    if (!ranges.length) { shell.notify(t('letter.commentsEmpty')); return; }
    const { from, to } = body.state.selection;
    const next = dir > 0 ? ranges.find(([, r]) => r.from >= to) ?? ranges[0] : [...ranges].reverse().find(([, r]) => r.to <= from) ?? ranges[ranges.length - 1];
    setCommentsOpen(true);
    showComment(body, next[0]);
    body.commands.focus();
  };
  const review = {
    newComment: () => {
      if (!body) return;
      if (activeRef.current !== 'body') { shell.notify(t('letter.commentBodyOnly')); return; }
      const id = newCommentId();
      if (!addCommentMark(body, id)) { shell.notify(t('letter.commentSelect')); return; }
      setComments([...comments, { id, author: userName(true), date: new Date().toISOString(), text: '' }]);
      setCommentsOpen(true);
      setEditingComment(id);
    },
    deleteComment: () => {
      if (!body) return;
      const ids = commentsAt(body.state);
      if (!ids.length) { shell.notify(t('letter.commentNone')); return; }
      for (const id of ids) removeCommentMark(body, id);
      setComments(comments.filter(c => !ids.includes(c.id)));
    },
    comment: goToComment,
    toggleComments: () => setCommentsOpen(o => !o),
    track: () => {
      if (!body) return;
      if (!isTracking(body)) userName(true);
      setTracking(body, !isTracking(body));
      changed();
      shell.notify(t(isTracking(body) ? 'letter.trackOn' : 'letter.trackOff'));
    },
    markup: () => setMarkup(m => !m),
    accept: (all: boolean) => {
      if (!body) return;
      const c = all ? null : changeAt(body);
      if (!all && !c) { if (!goToChange(body, 1)) shell.notify(t('letter.changesNone')); return; }
      if (!resolveChange(body, true, c?.id) && all) shell.notify(t('letter.changesNone'));
      if (!all) goToChange(body, 1);
    },
    reject: (all: boolean) => {
      if (!body) return;
      const c = all ? null : changeAt(body);
      if (!all && !c) { if (!goToChange(body, 1)) shell.notify(t('letter.changesNone')); return; }
      if (!resolveChange(body, false, c?.id) && all) shell.notify(t('letter.changesNone'));
      if (!all) goToChange(body, 1);
    },
    change: (dir: 1 | -1) => { if (body && !goToChange(body, dir)) shell.notify(t('letter.changesNone')); },
    footnote: () => {
      if (!body) return;
      if (activeRef.current !== 'body') { shell.notify(t('letter.footnoteBodyOnly')); return; }
      const text = prompt(t('letter.footnotePrompt'), '');
      if (text?.trim()) body.chain().focus().insertFootnote(text.trim()).run();
    },
    editFootnote: () => {
      if (!body) return;
      const at = footnoteAt(body.state);
      if (!at) { shell.notify(t('letter.footnoteNone')); return; }
      const text = prompt(t('letter.footnotePrompt'), at.text);
      if (text === null) return;
      if (!text.trim()) body.chain().focus().setNodeSelection(at.pos).deleteSelection().run();
      else body.chain().focus().command(({ tr }) => { tr.setNodeAttribute(at.pos, 'text', text.trim()); return true; }).run();
    },
    citeStyle,
    setCiteStyle: (st: CitationStyle) => {
      setCiteStyleState(st);
      shell.storage.set('citeStyle', st);
      if (body) { const n = restyleCitations(body, st); if (n) shell.notify(t('letter.citeRestyled', { n })); }
    },
    newCitation: (ai: boolean) => {
      if (activeRef.current !== 'body') { shell.notify(t('letter.footnoteBodyOnly')); return; }
      setSourceStart(null);
      setPanel(ai ? 'sourceAi' : 'source');
    },
    refModels: () => setPanel('refModels'),
    refCheck: () => {
      if (!body || !citedSources(body.state.doc).length) { shell.notify(t('letter.citeNone')); return; }
      setPanel('refCheck');
    },
    cite: (src: Source) => body?.chain().focus().insertCitation(src, citeStyle).run(),
    citedSources: () => (body ? citedSources(body.state.doc) : []),
    bibliography: (title: string) => {
      if (!body) return;
      const sources = citedSources(body.state.doc);
      if (!sources.length) { shell.notify(t('letter.citeNone')); return; }
      body.chain().focus().insertContent(bibliographyJson(sources, citeStyle, title)).run();
    },
    caption: (label: CaptionLabel) => {
      if (!body) return;
      const text = prompt(t('letter.captionPrompt'), '');
      if (text === null) return;
      body.chain().focus().insertContent(captionJson(body.state.doc, label, text.trim(), (lang || getLanguage()).startsWith('fr'))).run();
    },
    tableOfFigures: () => {
      if (!body) return;
      const content = tableOfFiguresJson(body.state.doc, pageOf, t('letter.tof'));
      if (!content) { shell.notify(t('letter.tofEmpty')); return; }
      body.chain().focus().insertContent(content).run();
    },
    refTargets: () => (body ? refTargets(body.state.doc) : []),
    crossRef: (target: RefTarget, form: RefForm) => {
      if (!body) return;
      body.chain().focus().insertContent(refText(target, form, pageOf(target.pos + 1), body.state.selection.from)).run();
    },
    markIndex: () => {
      if (!body) return;
      const { from, to } = body.state.selection;
      const term = body.state.doc.textBetween(from, to).trim();
      if (!term || !body.chain().focus().markIndexTerm(term).run()) { shell.notify(t('letter.indexSelect')); return; }
      shell.notify(t('letter.indexMarked', { term }));
    },
    insertIndex: () => {
      if (!body) return;
      const entries = indexEntries(body.state.doc, pageOf, lang || getLanguage());
      if (!entries.length) { shell.notify(t('letter.indexEmpty')); return; }
      body.chain().focus().insertContent(indexJson(entries, t('letter.group.index'))).run();
    },
    nextFootnote: () => {
      if (!body) return;
      const notes = listFootnotes(body.state.doc);
      if (!notes.length) { shell.notify(t('letter.footnoteNone')); return; }
      const from = body.state.selection.from;
      const next = notes.find(n => n.pos >= from + 1) ?? notes[0];
      body.chain().focus().setNodeSelection(next.pos).scrollIntoView().run();
    },
  };

  // ---------- Doc adm/Mil: ready-to-fill letters and CVs ----------
  const docs = {
    docTemplate: (id: string) => {
      const tpl = LETTERS.find(l => l.id === id) ?? CV_TEMPLATES.find(c => c.id === id);
      if (!tpl || !body) return;
      const content = markupToDoc(tpl[docLang], longDate(docLang === 'fr' ? 'fr-CA' : 'en-CA'));
      const replace = isEmptyDoc(body) || confirm(t('letter.docs.replaceAsk'));
      if (replace) body.commands.setContent({ type: 'doc', content });
      else body.chain().focus().insertContent(content).run();
      // A template with its own look brings it; the others go back to the plain white page if the page was dark
      // (from a dark theme or the Creative CV), so a memo never opens black.
      if (replace && ('theme' in tpl || isDark(page.color))) {
        const th = THEMES.find(x => x.id === ('theme' in tpl ? tpl.theme : 'office'));
        if (th) smart.theme(th);
      }
      // What "My info" knows fills itself in; the cursor goes to the first field left.
      const n = fillFields(body, profileValues(fieldList(body.state.doc).map(f => f.label)));
      if (!selectNextField(body)) body.commands.focus('start');
      shell.notify(n ? t('letter.docs.autoFilled', { n }) : t('letter.docs.inserted'));
    },
    docLang: (l: 'fr' | 'en') => { setDocLang(l); shell.storage.set('docLang', l); },
    // "Mise en page des travaux": the page, the text and the headings follow the norm; an empty document (or one the
    // person agrees to replace) also gets the parts in order, with yellow [fields] to fill.
    workLayout: (id: string) => {
      const w = WORK_LAYOUTS.find(x => x.id === id);
      if (!w || !body) return;
      const replace = isEmptyDoc(body) || confirm(t('letter.works.replaceAsk'));
      setPage(p => ({ ...p, size: w.size, orientation: 'portrait', margins: workMargins(w), color: null }));
      setStyles(st => workStyles(st, w));
      if (replace) body.commands.setContent({ type: 'doc', content: workDoc(w, docLang, longDate(docLang === 'fr' ? 'fr-CA' : 'en-CA')) });
      // The page number where the norm puts it (MLA: the name, then the number).
      if (w.num && (replace || (header?.isEmpty && footer?.isEmpty))) {
        const top = w.num === 'tr' || w.num === 'mla';
        const ed = top ? header : footer;
        const other = top ? footer : header;
        const parts = [...(w.num === 'mla' ? [{ type: 'text', text: docLang === 'fr' ? '[Nom] ' : '[Last name] ' }] : []), { type: 'pageNumber', attrs: { kind: 'page' } }];
        ed?.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: w.num === 'bc' ? 'center' : 'right', indentFirst: 0 }, content: parts }] });
        if (replace) other?.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] });
        setHfVersion(v => v + 1);
      }
      // The table of contents lists the parts once the pages are laid out.
      if (replace) setTimeout(() => {
        let at = -1;
        body.state.doc.descendants((n, pos) => { if (at < 0 && n.isTextblock && n.textContent === TOC_MARK) at = pos; return at < 0; });
        if (at < 0) return;
        const node = body.state.doc.nodeAt(at)!;
        const toc = tocJson(body, pageOf, pw - (workMargins(w).left + workMargins(w).right) * PX_PER_IN);
        body.chain().insertContentAt({ from: at, to: at + node.nodeSize }, toc ?? [{ type: 'paragraph' }]).run();
      }, 600);
      changed();
      const n = replace ? fillFields(body, profileValues(fieldList(body.state.doc).map(f => f.label))) : 0;
      if (!replace || !selectNextField(body)) body.commands.focus('start');
      shell.notify(t(replace ? 'letter.works.done' : 'letter.works.formatted', { name: getLanguage() === 'fr' ? w.name.fr : w.name.en, n }));
    },
    letterPart: (part: LetterPart) => {
      const ed = activeEditor;
      if (!ed) return;
      ed.chain().focus().insertContent(markupToDoc(letterPartMarkup(part, docLang), longDate(docLang === 'fr' ? 'fr-CA' : 'en-CA'))).run();
    },
    fillFields: () => setPanel('fill'),
    nextField: () => { if (!selectNextField(body)) shell.notify(t('letter.docs.noFields')); },
    profile: () => setPanel('profile'),
    docAi: (what: 'docWrite' | 'fillAi') => { setCopilot(true); setCopilotStart(x => ({ id: what, n: (x?.n ?? 0) + 1 })); },
  };

  // The Convert tab: this letter as HTML with its styles, its tables, and Word/PDF made by Letter itself.
  const convertSource: ConvertSource = {
    appId: 'letter',
    title: () => title || baseName(),
    html: () => body?.getHTML() ?? '',
    css: () => stylesCss(styles, page, '').split(' .doc-text').join('.cv-doc') + '\n' + listStylesCss('.cv-doc'),
    tables: () => tablesInHtml(body?.getHTML() ?? '').map((table, i) => ({ name: `${title || baseName()} ${i + 1}`, table })),
    native: {
      docx: async tr => {
        const { letterToDocx } = await import('./docx/write');
        const doc = letterNow();
        if (tr) { doc.body = await translateJson(doc.body, tr); doc.header = doc.header && await translateJson(doc.header, tr); doc.footer = doc.footer && await translateJson(doc.footer, tr); }
        return new Blob([await letterToDocx(doc, title, userName())], { type: DOCX_TYPE });
      },
      // Letter's own PDF and print keep its pages, headers and footers.
      pdf: async tr => { if (tr) return undefined; print(); return true; },
      print: async tr => { if (tr) return undefined; print(); return true; },
    },
  };
  const actions: RibbonActions = {
    fileMenu: () => setPanel('file'),
    pasteAs: async (kind: PasteKind) => {
      const ed = activeEditor;
      if (!ed) return;
      if (kind === 'keep') { void actions.paste(); return; }
      let text = '';
      try { text = await navigator.clipboard.readText(); } catch { alert(t('letter.pasteBlocked')); return; }
      if (!text.trim()) { shell.notify(t('letter.pasteEmpty')); return; }
      const html = pasteHtml(kind, text);
      if (html !== null) { ed.chain().focus().insertContent(html).run(); return; }
      if (!shell.ai.ready()) { shell.notify(t('letter.pasteNeedsAi')); setCopilot(true); return; }
      shell.notify(t('letter.pasteWorking'));
      try {
        const answer = await shell.ai.ask({
          system: 'You transform text pasted into In 1 Letter, a word processor. Reply with only the resulting text, in Markdown when it has lists, headings or a table.',
          messages: [{ role: 'user', content: `${PASTE_PROMPTS[kind]}\n\n<text>\n${text}\n</text>` }],
        });
        ed.chain().focus().insertContent(markdownToHtml(answer)).run();
      } catch (err) {
        shell.notify(`${t('letter.pasteFailed')} ${String(err)}`);
      }
    },
    pasteText: async () => {
      const ed = activeEditor;
      if (!ed) return;
      try { ed.view.pasteText(await navigator.clipboard.readText()); } catch { alert(t('letter.pasteBlocked')); }
      ed.commands.focus();
    },
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
    replaceImage: async () => {
      const f = await shell.openFile(IMAGE_EXTENSIONS);
      if (!f || !activeEditor) return;
      const src = await readAsDataUrl(new Blob([await f.arrayBuffer()], { type: f.type || 'image/png' }));
      activeEditor.chain().focus().updateAttributes('image', { src, alt: f.name }).run();
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
    pageNumber: (where, format, align) => {
      const parts = format.split(/(\{page\}|\{pages\})/).filter(Boolean).map(p =>
        p === '{page}' ? { type: 'pageNumber', attrs: { kind: 'page' } } : p === '{pages}' ? { type: 'pageNumber', attrs: { kind: 'pages' } } : { type: 'text', text: p });
      if (where === 'here') { activeEditor?.chain().focus().insertContent(parts).run(); return; }
      const ed = hfTarget(where === 'top' ? 'header' : 'footer');
      if (!ed) return;
      const para = { type: 'paragraph', attrs: { textAlign: align }, content: parts };
      if (ed.isEmpty) ed.commands.setContent({ type: 'doc', content: [para] });
      else ed.chain().focus('end').insertContent(parts).run();
      setActive(where === 'top' ? 'header' : 'footer');
      changed();
      setHfVersion(v => v + 1);
    },
    wordCount: () => setPanel('count'),
    customMargins: () => setPanel('margins'),
    ...smart,
    ...review,
    ...docs,
    copilot: () => setCopilot(o => !o),
  };

  // Double-clicking a footnote number edits its text.
  useEffect(() => {
    if (!body) return;
    const dbl = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest?.('.fn-ref');
      if (!el) return;
      e.preventDefault();
      const pos = body.view.posAtDOM(el, 0);
      body.commands.setNodeSelection(pos);
      review.editFootnote();
    };
    body.view.dom.addEventListener('dblclick', dbl);
    return () => body.view.dom.removeEventListener('dblclick', dbl);
  });

  // ---------- keyboard shortcuts, like Word ----------
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!isShown()) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'q') { e.preventDefault(); setPanel('commands'); return; }
      if (e.key === 'Escape' && focusMode && !document.fullscreenElement) { exitFocus(); return; }
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.code === 'KeyM' || k === 'm')) { e.preventDefault(); review.newComment(); return; }
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.code === 'KeyF' || k === 'f')) { e.preventDefault(); review.footnote(); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.code === 'KeyE' || k === 'e')) { e.preventDefault(); review.track(); return; }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
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
    '--pn': '"#"', '--pt': `"${layout.pages}"`, '--pb-label': JSON.stringify(t('letter.pageBreak')), '--link-label': JSON.stringify(t('letter.linkedToClass')),
    '--live-synced': JSON.stringify(t('live.synced')), '--live-pending': JSON.stringify(t('live.pending')), '--live-different': JSON.stringify(t('live.different')),
    background: !isPrint ? page.color ?? undefined : undefined,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
  } as CSSProperties;
  const zoomPct = Math.round(scale * 100);
  const themeId = THEMES.find(th => th.page === page.color && JSON.stringify(th.styles) === JSON.stringify(styles))?.id ?? null;
  const readMinutes = readingStats(body.getText()).readMinutes;
  const suite = {
    apps: shell.apps(), sheets: shell.tabs('class'), dictating, speaking, outline, linkedTable, themeId,
    tracking, markup, commentsOpen, commentHere: !!reviewHere?.comments.length, changeHere: !!reviewHere?.change,
    changes: reviewHere?.changes ?? 0, footnoteHere: !!reviewHere?.footnote, footnotes: reviewHere?.footnotes.length ?? 0, copilot,
    docLang, fields,
  };
  const liveComments = new Set(reviewHere ? [...commentRanges(body.state.doc).keys()] : []);
  const openComments = comments.filter(c => liveComments.has(c.id) && !c.resolved).length;
  const commentCss = [
    ...comments.filter(c => c.resolved).map(c => `.${scope} .cmt[data-comment="${CSS.escape(c.id)}"] { background: none; border-bottom-color: transparent; }`),
    ...(reviewHere?.comments ?? []).map(id => `.${scope} .cmt[data-comment="${CSS.escape(id)}"] { background: rgba(232, 176, 40, .42); border-bottom-color: #C8901A; }`),
  ].join('\n');
  const watermark = page.watermark;
  const commands = buildCommands(actions, body, activeEditor, setView, view, inTable);
  // Zooming shows the pages: from the web layout it switches to the print layout, where the zoom applies.
  const setZoom = (z: Zoom) => setView({ zoom: typeof z === 'number' ? Math.min(5, Math.max(0.1, z)) : z, ...(isPrint ? {} : { layout: 'print' as const }) });
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  usePinchZoom(canvasRef, () => scaleRef.current, z => setZoom(z), { min: 0.1, max: 5 });

  return (
    <div className={`letter ${scope}${painting ? ' painting' : ''}${focusMode ? ' focus-mode' : ''}`} ref={rootRef}>
      <style>{stylesCss(styles, page, `.${scope}`)}{listStylesCss()}{commentCss}</style>
      <Ribbon editor={activeEditor} body={body} styles={styles} page={page} setPage={setPage} lang={lang} setLang={setLang}
        view={view} setView={setView} actions={actions} suite={suite}
        convertPanel={<ConvertPanel shell={shell} source={convertSource} />}
        proofTools={<ProofButtons editor={activeEditor} ai={shell.ai} lang={lang} notify={m => shell.notify(m)} />} />
      {focusMode && <button type="button" className="focus-exit" onClick={exitFocus}>{t('letter.focusExit')}</button>}
      <div className="letter-body">
      <FastScroll target={canvasRef} />
      {outline && !focusMode && <OutlinePane editor={body} onClose={() => smart.outline()} />}
      <div className="canvas" ref={canvasRef}>
        {(panel === 'find' || panel === 'replace') && <FindBar editor={body} replace={panel === 'replace'} onClose={() => { setPanel(null); body.commands.focus(); }} />}
        <div className="sizer" style={{ width: isPrint ? pw * scale : undefined, height: isPrint ? sheetHeight * scale : undefined }}>
          <div ref={sheetRef} className={`sheet ${isPrint ? 'print-layout' : 'web-layout'}${view.marks ? ' show-marks' : ''}${page.hyphenate ? ' hyphenate' : ''}${page.lineNumbers ? ` ln ln-${page.lineNumbers}` : ''}${markup ? '' : ' no-markup'}`} style={sheetVars} dir={page.rtl ? 'rtl' : undefined}>
            {isPrint && Array.from({ length: layout.pages }, (_, i) => (
              <div key={i} className="page-frame" style={{ top: `calc(${i} * (var(--ph) + var(--pg-gap)))`, background: page.color ?? undefined }}>
                {page.border && <div className="page-border" style={{ inset: `${page.border.space}pt`, border: `${page.border.w}pt solid ${page.border.color}` }} />}
                {watermark && <Watermark text={watermark.text} color={watermark.color} />}
              </div>
            ))}
            {!isPrint && watermark && <Watermark text={watermark.text} color={watermark.color} />}
            <div className="hf header-area" style={{ '--pn': '"1"' } as CSSProperties} data-label={t('letter.header')}>
              <EditorContent editor={header} />
            </div>
            <div className="body-area">
              <EditorContent editor={body} />
              {!isPrint && !!reviewHere?.footnotes.length && <EndNotes notes={reviewHere.footnotes} />}
              <div className="tail" style={isPrint ? { height: `calc(${layout.tail}px - var(--pg-slack, 0px))` } : undefined}>
                {isPrint && layout.notes.length > 0 && <PageNotes notes={layout.notes} />}
                <div className="hf footer-area" style={{ '--pn': `"${layout.pages}"` } as CSSProperties} data-label={t('letter.footer')}>
                  <EditorContent editor={footer} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {commentsOpen && !focusMode && (
        <CommentsPane editor={body} comments={comments} onChange={setComments} author={() => userName()} editing={editingComment}
          setEditing={setEditingComment} showResolved={false} onClose={() => setCommentsOpen(false)} />
      )}
      <ProofBubble editor={activeEditor} />
      {copilot && !focusMode && <Copilot host={letterCopilot(body, title, docLang)} ai={shell.ai} start={copilotStart} onClose={() => { setCopilot(false); body.commands.focus(); }} />}
      </div>
      <footer className="status">
        <span>{isPrint ? t('letter.pageOf', { n: cursorPage, total: layout.pages }) : t('letter.webLayout')}</span>
        <button type="button" className="status-btn" onClick={() => setPanel('count')}>{words === 1 ? t('letter.word') : t('letter.words', { n: words })}</button>
        {words > 0 && <span className="status-read">{t('letter.minutesRead', { n: readMinutes })}</span>}
        {(dictating || dict.error) && dict.message && <span className={`status-live${dict.error ? ' error' : ''}`} data-dictation={dict.status?.kind} role="status">{!dict.error && <i />}{dict.message}</span>}
        {tracking && <button type="button" className="status-btn status-track" onClick={review.track}>{t('letter.trackStatus')}</button>}
        {openComments > 0 && !commentsOpen && (
          <button type="button" className="status-btn" onClick={() => setCommentsOpen(true)}><Icon name="comment" /> {openComments}</button>
        )}
        <span className="status-file" title={fileName || `${title}.docx`}>{fileName || `${title}.docx`}{dirty && fileRef ? ' •' : ''}</span>
        <span className="status-zoom">
          <button type="button" aria-label={t('letter.zoomOut')} title={t('letter.zoomOut')} onClick={() => setZoom(Math.round((scale - 0.1) * 10) / 10)}>−</button>
          <input type="range" min={10} max={300} step={5} value={zoomPct} aria-label={t('letter.zoom')}
            onChange={e => setZoom(Number(e.target.value) / 100)} />
          <button type="button" aria-label={t('letter.zoomIn')} title={t('letter.zoomIn')} onClick={() => setZoom(Math.round((scale + 0.1) * 10) / 10)}>+</button>
          <span className="pct">{zoomPct}%</span>
          <button type="button" className="fit" aria-label={t('ui.fitAll')} title={t('ui.fitAll')} onClick={() => setZoom('page')}><Icon name="onepage" size={13} /></button>
        </span>
      </footer>
      {panel === 'file' && (
        <FileMenu fileName={fileName || `${title}.docx`} onClose={() => setPanel(null)}
          onNew={() => shell.openModule('letter')}
          onOpen={async () => { const f = await shell.openFile(EXTENSIONS); if (f) openHere(f); }}
          onSave={() => void save()} onPrint={print}
          saveChoices={[
            { id: 'docx', icon: 'save', label: t('letter.format.docx'), hint: '.docx' },
            { id: 'pdf', icon: 'pdf', label: 'PDF', hint: t('letter.format.pdfHint') },
            { id: 'html', icon: 'web', label: t('letter.format.html'), hint: '.html' },
            { id: 'txt', icon: 'left', label: t('letter.format.txt'), hint: '.txt' },
          ] as { id: SaveFormat; icon: string; label: string; hint: string }[]} onSaveAs={saveAs}
          listRecent={shell.recent.list} onOpenRecent={r => void openRecent(r)} />
      )}
      {panel === 'count' && <WordCountDialog editor={body} pages={layout.pages} onClose={() => setPanel(null)} />}
      {panel === 'margins' && <MarginsDialog page={page} onApply={setPage} onClose={() => setPanel(null)} />}
      {panel === 'fill' && <FillDialog editor={body} onClose={() => { setPanel(null); body.commands.focus(); }}
        onDone={n => shell.notify(n ? t('letter.docs.filled', { n }) : t('letter.docs.noFields'))} />}
      {panel === 'profile' && <ProfileDialog onClose={() => setPanel(null)} />}
      {(panel === 'source' || panel === 'sourceAi') && <SourceDialog shell={shell} aiFirst={panel === 'sourceAi'}
        initial={sourceStart?.initial} highlight={sourceStart?.highlight}
        onClose={() => { setPanel(null); setSourceStart(null); body.commands.focus(); }}
        onDone={src => {
          if (sourceStart?.update) { const n = updateSource(body, src, citeStyle); shell.notify(t('letter.refCheck.fixed', { n })); return; }
          setTimeout(() => actions.cite(src));
        }} />}
      {panel === 'refModels' && <RefModelsDialog style={citeStyle} onClose={() => setPanel(null)}
        onStyle={st => { actions.setCiteStyle(st); setPanel(null); }}
        onUse={(kind, st) => {
          if (st !== citeStyle) actions.setCiteStyle(st);
          setSourceStart({ initial: { kind } });
          setPanel('source');
        }} />}
      {panel === 'refCheck' && <RefCheckDialog sources={citedSources(body.state.doc)} style={citeStyle} onClose={() => setPanel(null)}
        onFix={(src, missing) => { setSourceStart({ initial: src, highlight: missing, update: true }); setPanel('source'); }} />}
      {panel === 'commands' && <CommandPalette commands={commands} onClose={() => { setPanel(null); activeEditor?.commands.focus(); }} />}
    </div>
  );
}

/** Every command, by name, for the command search (Alt+Q). */
function buildCommands(a: RibbonActions, body: Editor, ed: Editor, setView: (v: Partial<ViewState>) => void, view: ViewState, inTable: boolean): Command[] {
  const run = () => ed.chain().focus();
  const g = {
    home: t('letter.tab.home'), insert: t('letter.tab.insert'), design: t('letter.tab.design'), layout: t('letter.tab.layout'),
    review: t('letter.tab.review'), view: t('letter.tab.view'), smart: t('letter.tab.smart'), docs: t('letter.tab.docs'), oi1: 'Office In 1', file: t('letter.tab.file'), table: t('letter.tab.table'),
  };
  const c = (id: string, label: string, group: string, runIt: () => unknown, icon?: string, keys?: string, disabled?: boolean): Command =>
    ({ id, label, group, run: () => { runIt(); }, icon, keys, disabled });
  return [
    c('save', t('letter.save'), g.file, () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true })), 'save', 'Ctrl+S'),
    c('file', t('letter.tab.file'), g.file, a.fileMenu, 'open'),
    c('pdf', t('letter.savePdf'), g.file, a.pdf, 'pdf', 'Ctrl+P'),
    c('share', t('letter.share'), g.oi1, a.share, 'share'),
    c('bold', t('letter.bold'), g.home, () => run().toggleBold().run(), undefined, 'Ctrl+B'),
    c('italic', t('letter.italic'), g.home, () => run().toggleItalic().run(), undefined, 'Ctrl+I'),
    c('underline', t('letter.underline'), g.home, () => run().toggleUnderline().run(), undefined, 'Ctrl+U'),
    c('strike', t('letter.strike'), g.home, () => run().toggleStrike().run()),
    c('bullets', t('letter.bullets'), g.home, () => run().toggleBulletList().run(), 'bullets'),
    c('numbers', t('letter.numbers'), g.home, () => run().toggleOrderedList().run(), 'numbers'),
    c('left', t('letter.alignLeft'), g.home, () => run().setTextAlign('left').run(), 'left'),
    c('center', t('letter.alignCenter'), g.home, () => run().setTextAlign('center').run(), 'center'),
    c('right', t('letter.alignRight'), g.home, () => run().setTextAlign('right').run(), 'right'),
    c('justify', t('letter.justify'), g.home, () => run().setTextAlign('justify').run(), 'justify'),
    c('h1', t('letter.heading1'), g.home, () => run().setHeading({ level: 1 }).run()),
    c('h2', t('letter.heading2'), g.home, () => run().setHeading({ level: 2 }).run()),
    c('h3', t('letter.heading3'), g.home, () => run().setHeading({ level: 3 }).run()),
    c('clear', t('letter.clearFormatting'), g.home, () => run().unsetAllMarks().run(), 'clear'),
    c('find', t('letter.find'), g.home, () => a.find(false), 'find', 'Ctrl+F'),
    c('replace', t('letter.replace'), g.home, () => a.find(true), 'replace', 'Ctrl+H'),
    c('dictate', t('letter.dictate'), g.home, a.dictate, 'mic'),
    c('table', t('letter.table'), g.insert, () => run().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run(), 'table'),
    c('fromClass', t('letter.fromSheetFile'), g.insert, () => a.insertFromSheet(null), 'sheet'),
    c('image', t('letter.image'), g.insert, a.image, 'image'),
    c('link', t('letter.link'), g.insert, a.link, 'link'),
    c('pagebreak', t('letter.pageBreak'), g.insert, () => body.chain().focus().setPageBreak().run(), 'pagebreak', 'Ctrl+Enter'),
    c('toc', t('letter.toc'), g.insert, a.toc, 'toc'),
    c('note', `${t('letter.callout')}: ${t('letter.callout.note')}`, g.insert, () => a.callout('note'), 'callout'),
    c('tip', `${t('letter.callout')}: ${t('letter.callout.tip')}`, g.insert, () => a.callout('tip'), 'callout'),
    c('warning', `${t('letter.callout')}: ${t('letter.callout.warning')}`, g.insert, () => a.callout('warning'), 'callout'),
    c('letterBlock', t('letter.letterBlock.full'), g.insert, () => a.letterBlock('full'), 'envelope'),
    c('closing', t('letter.letterBlock.closing'), g.insert, () => a.letterBlock('closing'), 'signature'),
    ...[...LETTERS, ...CV_TEMPLATES].map(l => c(`doc-${l.id}`, l.title[getLanguage()], g.docs, () => a.docTemplate(l.id), l.cat === 'cv' ? 'cv' : 'envelope')),
    c('docFill', t('letter.docs.fill'), g.docs, a.fillFields, 'fill'),
    c('docNext', t('letter.docs.nextField'), g.docs, a.nextField, 'next'),
    c('docProfile', t('letter.docs.profile'), g.docs, a.profile, 'user'),
    c('docAiWrite', t('letter.docs.aiWrite'), g.docs, () => a.docAi('docWrite'), 'sparkle'),
    c('qr', t('letter.qr'), g.insert, a.qr, 'qr'),
    c('header', t('letter.header'), g.insert, a.header, 'header'),
    c('footer', t('letter.footer'), g.insert, a.footer, 'footer'),
    c('pagenum', t('letter.pageNumber.bottomTotal'), g.insert, () => a.pageNumber('bottom', t('letter.pageXofY'), 'center'), 'pagenum'),
    c('date', t('letter.date'), g.insert, () => run().insertContent(new Date().toLocaleDateString(undefined, { dateStyle: 'long' })).run(), 'date'),
    ...THEMES.map(th => c(`theme-${th.id}`, `${t('letter.group.themes')}: ${t(th.name)}`, g.design, () => a.theme(th), 'theme')),
    c('margins', t('letter.margins.custom'), g.layout, a.customMargins, 'margins'),
    c('count', t('letter.wordCount'), g.review, a.wordCount, 'count'),
    c('newComment', t('letter.commentNew'), g.review, a.newComment, 'commentnew', 'Ctrl+Alt+M'),
    c('comments', t('letter.commentsShow'), g.review, a.toggleComments, 'comment'),
    c('track', t('letter.track'), g.review, a.track, 'track', 'Ctrl+Shift+E'),
    c('acceptAll', t('letter.acceptAll'), g.review, () => a.accept(true), 'accept'),
    c('rejectAll', t('letter.rejectAll'), g.review, () => a.reject(true), 'reject'),
    c('nextChange', t('letter.changeNext'), g.review, () => a.change(1), 'next'),
    c('footnote', t('letter.footnoteInsert'), t('letter.tab.references'), a.footnote, 'footnote', 'Ctrl+Alt+F'),
    c('read', t('letter.readAloud'), g.review, a.readAloud, 'speak'),
    c('outline', t('letter.outline'), g.view, a.outline, 'outline'),
    c('focus', t('letter.focus'), g.view, a.focus, 'focus'),
    c('marks', t('letter.showMarks'), g.view, () => setView({ marks: !view.marks }), 'marks'),
    c('web', t('letter.webLayout'), g.view, () => setView({ layout: 'web' }), 'web'),
    c('print', t('letter.printLayout'), g.view, () => setView({ layout: 'print' }), 'print'),
    c('cleanAll', t('letter.cleanUp.all'), g.smart, () => a.cleanUp('all'), 'clean'),
    c('quotes', t('letter.cleanUp.quotes'), g.smart, () => a.cleanUp('quotes'), 'clean'),
    c('sortAZ', t('letter.sortAZ'), g.smart, () => a.sort(1), 'sort'),
    c('sortZA', t('letter.sortZA'), g.smart, () => a.sort(-1), 'sort'),
    c('textToTable', t('letter.textToTable'), g.smart, a.textToTable, 'texttable'),
    c('tableToText', t('letter.tableToText'), g.table, a.tableToText, 'texttable', undefined, !inTable),
    c('editInClass', t('letter.editInClass'), g.oi1, a.editInClass, 'sheet', undefined, !inTable),
    c('newSheet', t('letter.newSheet'), g.oi1, a.newSheet, 'sheet'),
    c('makeSlides', t('letter.makeSlides'), g.oi1, a.makeSlides, 'stage'),
    c('prodfos', t('letter.openProdfos'), g.oi1, () => a.openApp('prodfos'), 'prodfos'),
  ];
}

/** Faint diagonal text behind a page, like Word's DRAFT watermark. */
function Watermark({ text, color }: { text: string; color: string }) {
  return <div className="watermark" aria-hidden="true"><span style={{ color, fontSize: `${Math.max(36, Math.min(120, 900 / Math.max(text.length, 1)))}pt` }}>{text}</span></div>;
}

/** The last page's footnotes, drawn the same way the page spacers draw theirs. */
function PageNotes({ notes }: { notes: LayoutResult['notes'] }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { ref.current?.replaceChildren(notesDom(notes)); }, [notes]);
  return <div ref={ref} className="doc-text tail-notes" />;
}

/** In Web layout there are no pages, so the footnotes come after the text. */
function EndNotes({ notes }: { notes: { n: number; text: string }[] }) {
  return (
    <div className="doc-text notes-end" aria-label={t('letter.footnotes')}>
      {notes.map(n => <div key={n.n} className="fn-note"><sup>{n.n}</sup> {n.text}</div>)}
    </div>
  );
}
