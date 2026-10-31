// Office Stage: presentations, like PowerPoint. Slides with placeholders, text boxes, shapes, pictures and
// tables on a theme; thumbnails to reorder, speaker notes, transitions and a slide show with presenter view;
// .pptx open and save, printing and PDF, Claude as copilot, and links with Office Letter and Office Class.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import type { FileRef, Handoff, OpenedFile, RecentFile, ShellApi, TableData } from '../../shell/contract';
import { LANGUAGES, getLanguage, t, type MessageKey } from '../../shell/i18n';
import { useLanguage } from '../../shell/useLanguage';
import {
  GEOMS, LAYOUTS, SIZE_16_9, SIZE_4_3, THEMES, TRANSITIONS, changeLayout, cssBackground, defaultSize, htmlText, isEmptyHtml, itemText, linesToHtml,
  newDeck, newId, newSlide, resizeDeck, retheme, slideTitle,
  type AnimEffect, type AnimKind, type Background, type Deck, type DeckTheme, type Geom, type ThemeGroup, type Item, type LayoutId, type ShapeItem, type Slide, type Stroke, type TableItem, type Transition,
} from '../../formats/slides';
import { FileMenu } from '../../ui/FileMenu';
import { Btn, ColorGrid, Combo, Dialog, Drop, Group, Icon, MenuItem, NumberBox, RibbonToggle, type ComboGroup } from '../../ui/kit';
import { TutoTab } from '../../ui/tuto/Tuto';
import { qrDataUrl } from '../../ui/qr';
import { Copilot, CopilotButton, useCopilotShortcut } from '../../ui/Copilot';
import { usePinchZoom } from '../../ui/pinch';
import { translateHtml } from '../../shell/translate';
import { FastScroll } from '../../ui/FastScroll';
import { FONT_GROUPS, FONT_SIZES, cssFont } from '../letter/model';
import { readAsDataUrl } from '../letter/setup';
import { geomPath, isLine } from './geom';
import { SlideThumb, SlideView, shade, type ItemExtras } from './SlideView';
import { NO_TEXT, editorState, formatHtml, htmlState, slideExtensions, type TextState } from './text';
import { Show } from './Show';
import { stageCopilot, type StageBridge } from './copilot';
import { DIAGRAMS, WORDART, diagramItems, footerItem, slideNumberItem, wordArtItem, type DiagramKind } from './build';
import { myThemes, onMyThemes, removeMyTheme } from './mythemes';
import { AnimTab } from './AnimTab';
import { addAnim, playState, stepLength, stepsOf } from './anim';
import { AUDIENCES, adaptDeck, audienceName, customAudience, type Audience } from './audience';
import { AiError } from '../../shell/ai';
import { closeRibbonPeek } from '../../ui/ribbonMin';
import { recheck } from '../../ui/proof/extension';
import { ProofBubble } from '../../ui/proof/Bubble';
import { ProofButtons } from '../../ui/proof/ProofButtons';
import { PROOF_TAGS, baseLang } from '../../ui/proof/proof';

export const EXTENSIONS = ['.pptx'];
const PPTX_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2];
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

interface Saved { deck: Deck; active: number; name: string }
type Tab = 'home' | 'insert' | 'design' | 'transitions' | 'animations' | 'show' | 'review' | 'view' | 'oi1' | 'format' | 'table';
type Drag =
  | { kind: 'move'; x0: number; y0: number; start: Map<string, { x: number; y: number }>; moved: boolean; clickEdit: string | null }
  | { kind: 'resize'; id: string; hx: number; hy: number; x0: number; y0: number; orig: Item }
  | { kind: 'rotate'; id: string; cx: number; cy: number }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; add: string[] };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const isText = (it: Item | undefined): it is ShapeItem => !!it && it.kind === 'shape' && !isLine(it.geom);

/** Text for a whole deck, for searching, the copilot and the outline sent to Letter. */
export function deckOutline(deck: Deck): { title: string; lines: string[]; notes: string }[] {
  return deck.slides.map(s => {
    const title = slideTitle(s);
    const lines = s.items.filter(i => !(i.kind === 'shape' && i.role === 'title')).flatMap(i => itemText(i).split('\n')).map(l => l.trim()).filter(Boolean);
    return { title, lines, notes: s.notes };
  });
}

function outlineHtml(deck: Deck, name: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return deckOutline(deck).map((s, i) => {
    const head = `<h2>${esc(s.title || t('stage.slideN', { n: i + 1 }))}</h2>`;
    const list = s.lines.length ? `<ul>${s.lines.map(l => `<li><p>${esc(l)}</p></li>`).join('')}</ul>` : '';
    const notes = s.notes.trim() ? s.notes.split('\n').filter(Boolean).map(l => `<p><em>${esc(l)}</em></p>`).join('') : '';
    return head + list + notes;
  }).join('') || `<p>${esc(name)}</p>`;
}

/** Slides from a letter's HTML: each heading starts a slide, the text under it becomes its bullets. */
export function slidesFromHtml(html: string, deck: Pick<Deck, 'w' | 'h'>): Slide[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out: { title: string; lines: string[]; level: number }[] = [];
  for (const el of Array.from(doc.body.children)) {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent ?? '').trim();
    if (/^h[1-3]$/.test(tag)) { out.push({ title: text, lines: [], level: Number(tag[1]) }); continue; }
    if (!out.length) out.push({ title: '', lines: [], level: 9 });
    const cur = out[out.length - 1];
    if (tag === 'ul' || tag === 'ol') el.querySelectorAll('li').forEach(li => { const x = (li.querySelector('p') ?? li).textContent?.trim(); if (x) cur.lines.push(x); });
    else if (text) cur.lines.push(text);
  }
  return out.filter(s => s.title || s.lines.length).map((s, i) => {
    const layout: LayoutId = i === 0 && s.level === 1 && !s.lines.length ? 'title' : s.level === 1 && !s.lines.length ? 'section' : 'content';
    const slide = newSlide(layout, deck);
    slide.items = slide.items.map(it => {
      if (it.kind !== 'shape') return it;
      if (it.role === 'title') return { ...it, html: linesToHtml([s.title], false) };
      if (it.role === 'body' && s.lines.length) return { ...it, html: linesToHtml(s.lines.slice(0, 12), true) };
      return it;
    });
    if (s.lines.length > 12) slide.notes = s.lines.slice(12).join('\n');
    return slide;
  });
}

function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export default function Stage({ shell, file, handoff }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff }) {
  const [initial, setInitial] = useState<Saved | null>(null);
  useEffect(() => {
    void (async () => {
      let saved: Saved | null = null;
      // Something sent from another app starts a new deck; otherwise the last one comes back.
      if (!handoff || handoff.kind === 'file') try {
        const raw = await shell.storage.load('deck');
        if (raw) saved = JSON.parse(raw) as Saved;
      } catch { /* unreadable autosave */ }
      setInitial(saved ?? { deck: newDeck(), active: 0, name: '' });
    })();
  }, [shell, handoff]);
  if (!initial) return <div className="stage" />;
  return <StageEditor shell={shell} file={file} handoff={handoff} initial={initial} />;
}

// ---------- the text editor inside a box ----------

/** Spelling on or off and the proofing language, the same for every deck on this device. */
const PROOF_KEY = 'oi1.stage.proof';
const stageProof: { spell: boolean; lang: string } = (() => {
  try { return { spell: true, lang: '', ...JSON.parse(localStorage.getItem(PROOF_KEY) ?? '{}') }; } catch { return { spell: true, lang: '' }; }
})();
const proofOptions = { enabled: () => stageProof.spell, lang: () => stageProof.lang };

function TextEdit({ html, onChange, onReady, placeholder, selectAll, takeTyped }: {
  html: string; onChange: (html: string) => void; onReady: (ed: Editor | null) => void; placeholder: string; selectAll: boolean;
  /** Keys typed while the editor was still opening, so fast typing loses nothing. */
  takeTyped: () => string;
}) {
  const editor = useEditor({
    extensions: slideExtensions(() => placeholder, proofOptions),
    editorProps: { attributes: { spellcheck: String(stageProof.spell && !baseLang(stageProof.lang || getLanguage())), lang: stageProof.lang } },
    content: html,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });
  // Focus right away (not later, like autofocus does), then add what was typed meanwhile.
  useEffect(() => {
    if (!editor) return;
    editor.commands.focus(selectAll ? 'all' : 'end');
    const typed = takeTyped();
    if (typed) editor.commands.insertContent(typed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
  useEffect(() => { onReady(editor); return () => onReady(null); }, [editor, onReady]);
  return <EditorContent editor={editor} className="st-edit" onPointerDown={e => e.stopPropagation()} />;
}

/** A table whose cells can be typed in, with Tab to go to the next cell. */
function TableEdit({ it, theme, onChange, onCell }: { it: TableItem; theme: DeckTheme; onChange: (rows: string[][]) => void; onCell: (r: number, c: number) => void }) {
  const color = it.color ?? theme.accents[0];
  const light = shade(color, 0.82), lighter = shade(color, 0.9);
  const ref = useRef<HTMLTableElement>(null);
  const read = () => Array.from(ref.current?.rows ?? []).map(tr => Array.from(tr.cells).map(td => (td.innerText ?? '').replace(/\n$/, '')));
  const cols = it.cols ?? it.rows[0]?.map(() => 1 / (it.rows[0]?.length || 1)) ?? [];
  return (
    <table ref={ref} className="st-table" style={{ fontFamily: 'var(--st-body)' }} onPointerDown={e => e.stopPropagation()}>
      <colgroup>{cols.map((c, i) => <col key={i} style={{ width: `${c * 100}%` }} />)}</colgroup>
      <tbody>
        {it.rows.map((row, r) => {
          const head = it.header && r === 0;
          const band = it.banded ? ((r - (it.header ? 1 : 0)) % 2 === 0 ? light : lighter) : lighter;
          return (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} contentEditable suppressContentEditableWarning tabIndex={0}
                  style={{ background: head ? color : band, color: head ? '#FFFFFF' : '#1F1F1F', fontWeight: head ? 700 : 400, cursor: 'text' }}
                  onFocus={() => onCell(r, c)}
                  onBlur={() => { const next = read(); if (JSON.stringify(next) !== JSON.stringify(it.rows)) onChange(next); }}
                  onKeyDown={e => {
                    if (e.key !== 'Tab') return;
                    e.preventDefault();
                    const cells = Array.from(ref.current?.querySelectorAll('td') ?? []);
                    const i = cells.indexOf(e.currentTarget) + (e.shiftKey ? -1 : 1);
                    cells[Math.max(0, Math.min(cells.length - 1, i))]?.focus();
                  }}>{cell}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ShapeIcon({ g }: { g: Geom }) {
  return (
    <svg viewBox="-2 -2 24 20" width="22" height="18" aria-hidden="true">
      <path d={geomPath(g, 20, 16)} fill={isLine(g) ? 'none' : 'currentColor'} fillOpacity={0.18} stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke"
        markerEnd={g === 'arrow' ? undefined : undefined} />
      {g === 'arrow' && <path d="M15 10.5L20 16L13 15.5z" fill="currentColor" />}
    </svg>
  );
}

function StageEditor({ shell, file, handoff, initial }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff; initial: Saved }) {
  const lang = useLanguage();
  const [deck, setDeckState] = useState<Deck>(initial.deck);
  const deckRef = useRef(deck);
  const [active, setActive] = useState(Math.min(initial.active, initial.deck.slides.length - 1));
  const [sel, setSel] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; all: boolean } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('home');
  const [panel, setPanel] = useState<null | 'file'>(null);
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [notesOpen, setNotesOpen] = useState(() => window.innerWidth > 720 && shell.storage.get('notes') !== '0');
  const [notesH, setNotesH] = useState(110);
  const [show, setShow] = useState<null | { start: number; presenter: boolean }>(null);
  const [fileName, setFileName] = useState(initial.name);
  const [fileRef, setFileRef] = useState<FileRef | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [railDrop, setRailDrop] = useState<{ i: number; after: boolean } | null>(null);
  const [cell, setCell] = useState<{ r: number; c: number } | null>(null);
  const [askText, setAskText] = useState<null | { title: string; value: string; ok: (v: string) => void }>(null);
  const [mine, setMine] = useState<DeckTheme[]>(myThemes);
  useEffect(() => onMyThemes(() => setMine(myThemes())), []);
  const [themeGroup, setThemeGroup] = useState<ThemeGroup | null>(null);
  const [printing, setPrinting] = useState(false);
  const [animKind, setAnimKind] = useState<AnimKind>('in');
  const [preview, setPreview] = useState<{ step: number; run: number } | null>(null);
  const undo = useRef<Deck[]>([]);
  const redo = useRef<Deck[]>([]);
  const editingSnap = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const clip = useRef<Item[] | null>(null);
  const stageSize = useSize(stageRef);

  const slide = deck.slides[Math.min(active, deck.slides.length - 1)] ?? deck.slides[0];
  const selected = slide.items.filter(i => sel.includes(i.id));
  const one = selected.length === 1 ? selected[0] : null;

  // ---------- saving state ----------
  const saveTimer = useRef(0);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void shell.storage.save('deck', JSON.stringify({ deck, active, name: fileName } satisfies Saved));
    }, 500);
  }, [deck, active, fileName, shell]);
  const title = fileName ? fileName.replace(/\.pptx$/i, '') : (slideTitle(deck.slides[0]) || t('stage.untitled'));
  useEffect(() => { shell.setTitle(title.slice(0, 40)); }, [shell, title]);

  const setDeck = (next: Deck) => { deckRef.current = next; setDeckState(next); };
  /** Every change goes through here, so Undo can bring the deck back. */
  const commit = (next: Deck) => {
    undo.current.push(deckRef.current);
    if (undo.current.length > 200) undo.current.shift();
    redo.current = [];
    setDeck(next);
  };
  const changeSlide = (fn: (s: Slide) => Slide, index = active) => {
    const d = deckRef.current;
    commit({ ...d, slides: d.slides.map((s, i) => (i === index ? fn(s) : s)) });
  };
  const changeItems = (ids: string[], fn: (it: Item) => Item) => changeSlide(s => ({ ...s, items: s.items.map(it => (ids.includes(it.id) ? fn(it) : it)) }));
  const undoOnce = () => {
    const prev = undo.current.pop();
    if (!prev) return;
    redo.current.push(deckRef.current);
    setDeck(prev);
    setEditing(null);
    setActive(a => Math.min(a, prev.slides.length - 1));
  };
  const redoOnce = () => {
    const next = redo.current.pop();
    if (!next) return;
    undo.current.push(deckRef.current);
    setDeck(next);
    setEditing(null);
  };

  // ---------- text editing ----------
  const typed = useRef('');
  const takeTyped = useCallback(() => { const s = typed.current; typed.current = ''; return s; }, []);
  const startEdit = (id: string, all = false) => { editingSnap.current = false; setSel([id]); setEditing({ id, all }); };
  const stopEdit = () => { setEditing(null); rootRef.current?.focus(); };
  const onText = useCallback((id: string, html: string) => {
    const d = deckRef.current;
    const next = { ...d, slides: d.slides.map(s => ({ ...s, items: s.items.map(it => (it.id === id && it.kind === 'shape' ? { ...it, html } : it)) })) };
    // One undo step per editing session, like typing a paragraph in PowerPoint.
    if (!editingSnap.current) { undo.current.push(d); redo.current = []; editingSnap.current = true; }
    setDeck(next);
  }, []);
  const [proof, setProofState] = useState(() => ({ ...stageProof }));
  const setProof = (p: Partial<typeof stageProof>) => {
    Object.assign(stageProof, p);
    try { localStorage.setItem(PROOF_KEY, JSON.stringify(stageProof)); } catch { /* private window */ }
    setProofState({ ...stageProof });
    recheck(editor);
  };
  const onReady = useCallback((ed: Editor | null) => {
    setEditor(ed);
    if (!ed) return;
    const bump = () => setTick(n => n + 1);
    ed.on('transaction', bump);
  }, []);
  useEffect(() => { if (editing && !slide.items.some(i => i.id === editing.id)) setEditing(null); }, [slide, editing]);
  useEffect(() => { setSel([]); setEditing(null); setCell(null); }, [active]);

  const textState: TextState = editor && editing ? editorState(editor) : one && isText(one) ? htmlState(one.html) : NO_TEXT;
  const textTargets = selected.filter(isText);
  /** Formats the text being edited, or all the text of the selected boxes. */
  const format = (run: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => {
    if (editor && editing) { run(editor.chain().focus()).run(); return; }
    if (!textTargets.length) return;
    const ids = textTargets.map(i => i.id);
    changeItems(ids, it => (it.kind === 'shape' ? { ...it, html: formatHtml(it.html, c => run(c as ReturnType<Editor['chain']>) as never) } : it));
  };

  // ---------- slides ----------
  const addSlide = (layout?: LayoutId, at = active + 1) => {
    const d = deckRef.current;
    const prev = d.slides[active];
    const l = layout ?? (prev?.layout === 'title' ? 'content' : prev?.layout ?? 'content');
    const s = newSlide(l, d);
    if (prev?.transition) { s.transition = prev.transition; s.speed = prev.speed; }
    const slides = [...d.slides];
    slides.splice(at, 0, s);
    commit({ ...d, slides });
    setActive(at);
  };
  const duplicateSlide = (i = active) => {
    const d = deckRef.current;
    const copy = clone(d.slides[i]);
    copy.id = newId('s');
    const ids = new Map(copy.items.map(it => [it.id, newId()]));
    copy.items = copy.items.map(it => ({ ...it, id: ids.get(it.id)! }));
    if (copy.anims) copy.anims = copy.anims.filter(a => ids.has(a.item)).map(a => ({ ...a, id: newId('a'), item: ids.get(a.item)! }));
    const slides = [...d.slides];
    slides.splice(i + 1, 0, copy);
    commit({ ...d, slides });
    setActive(i + 1);
  };
  const deleteSlide = (i = active) => {
    const d = deckRef.current;
    if (d.slides.length <= 1) { commit({ ...d, slides: [newSlide('title', d)] }); return; }
    commit({ ...d, slides: d.slides.filter((_, k) => k !== i) });
    setActive(Math.max(0, Math.min(i, d.slides.length - 2)));
  };
  const moveSlide = (from: number, to: number) => {
    const d = deckRef.current;
    if (from === to || to < 0 || to >= d.slides.length) return;
    const slides = [...d.slides];
    const [s] = slides.splice(from, 1);
    slides.splice(to, 0, s);
    commit({ ...d, slides });
    setActive(to);
  };
  const setLayout = (l: LayoutId) => changeSlide(s => changeLayout(s, l, deckRef.current));
  const resetSlide = () => changeSlide(s => {
    const fresh = changeLayout({ ...s, items: s.items.map(it => (it.kind === 'shape' && it.role ? { ...it, x: -1 } : it)) }, s.layout, deckRef.current);
    return { ...fresh, items: fresh.items.map(it => (it.kind === 'shape' && it.role ? { ...it, fill: null, line: null, spacing: undefined, autofit: true } : it)) };
  });

  // ---------- items ----------
  const center = (w: number, h: number) => ({ x: Math.round((deck.w - w) / 2), y: Math.round((deck.h - h) / 2), w, h });
  const addItem = (it: Item, edit = false) => {
    changeSlide(s => ({ ...s, items: [...s.items, it] }));
    setSel([it.id]);
    if (edit) setTimeout(() => startEdit(it.id, true), 0);
  };
  /** A new item with its animations, like a sticker that pops in and keeps bouncing. */
  const addAnimated = (it: Item, effects: AnimEffect[]) => {
    changeSlide(s => effects.reduce((acc, e, i) => addAnim(acc, it.id, e, i ? {} : { start: 'after' }), { ...s, items: [...s.items, it] }));
    setSel([it.id]);
  };
  const addShape = (geom: Geom) => {
    const line = isLine(geom);
    const b = line ? { ...center(240, 0), h: 0 } : center(geom === 'rect' || geom === 'roundRect' ? 280 : 200, geom === 'rightArrow' || geom === 'leftArrow' ? 120 : 160);
    addItem({ id: newId(), kind: 'shape', geom, ...b, html: line ? '' : '<p></p>' });
    setTab('format');
  };
  /** A diagram from the slide's bullets (they become the diagram), or from sample points on an empty slide. */
  const addDiagram = (kind: DiagramKind) => {
    const s = slide;
    const body = s.items.find(it => it.kind === 'shape' && (it.role === 'body' || it.role === 'body2') && htmlText(it.html).trim()) as ShapeItem | undefined;
    const picked = one?.kind === 'shape' && htmlText(one.html).trim() ? one : body;
    const lines = picked ? htmlText(picked.html).split('\n').map(l => l.trim()).filter(Boolean) : [];
    const points = lines.length >= 2 ? lines : [1, 2, 3, 4].map(n => t('stage.diagram.point', { n }));
    const items = diagramItems(kind, points, deckRef.current);
    if (picked) {
      // The text the diagram came from makes way for it; a placeholder slide keeps only its title.
      const title = s.items.find(it => it.kind === 'shape' && it.role === 'title');
      const rest = s.items.filter(it => it.id !== picked.id && !(it.kind === 'shape' && (it.role === 'body' || it.role === 'body2') && isEmptyHtml(it.html)));
      const layout: LayoutId = title && picked.role ? 'titleOnly' : s.layout;
      const moved = layout !== s.layout ? changeLayout({ ...s, items: rest }, layout, deckRef.current) : { ...s, items: rest };
      changeSlide(() => ({ ...moved, items: [...moved.items, ...items] }));
    } else changeSlide(x => ({ ...x, items: [...x.items, ...items] }));
    setSel(items.filter(it => it.kind === 'shape' && !isLine(it.geom)).map(it => it.id));
  };
  const addWordArt = (style: (typeof WORDART)[number]['id']) => addItem(wordArtItem(style, t('stage.wordart.sample'), deckRef.current), true);
  const addQr = () => setAskText({
    title: t('stage.qr.ask'), value: 'https://', ok: v => {
      const url = v.trim();
      if (!url || url === 'https://') return;
      void qrDataUrl(url, deckRef.current.theme.dark ? '#000000' : deckRef.current.theme.text).then(src => addItem({ id: newId(), kind: 'image', src, alt: url, ...center(220, 220) }));
    },
  });
  const numberSlides = () => {
    const d = deckRef.current;
    commit({ ...d, slides: d.slides.map((x, i) => ({ ...x, items: [...x.items.filter(it => it.name !== 'Slide number'), slideNumberItem(i + 1, d)] })) });
    shell.notify(t('stage.numbered', { n: d.slides.length }));
  };
  const addFooter = () => setAskText({
    title: t('stage.footer.ask'), value: deckRef.current.slides.flatMap(x => x.items).find(it => it.name === 'Footer' && it.kind === 'shape') ? htmlText((deckRef.current.slides.flatMap(x => x.items).find(it => it.name === 'Footer') as ShapeItem).html) : '', ok: v => {
      const d = deckRef.current;
      commit({ ...d, slides: d.slides.map(x => ({ ...x, items: [...x.items.filter(it => it.name !== 'Footer'), ...(v.trim() ? [footerItem(v.trim(), d)] : [])] })) });
    },
  });
  const addTextBox = () => addItem({ id: newId(), kind: 'shape', geom: 'rect', ...center(480, 72), y: Math.round(deck.h * 0.42), fill: null, line: null, html: '<p></p>', valign: 'top' }, true);
  const tableItem = (rows: number, cols: number, data?: string[][], link?: TableItem['link']): TableItem => {
    const w = Math.min(deck.w * 0.86, cols * 220);
    const h = Math.min(deck.h * 0.62, rows * 46);
    return {
      id: newId(), kind: 'table', ...center(Math.round(w), Math.round(h)), y: Math.round(deck.h * 0.28),
      rows: data ?? Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')), header: true, banded: true, ...(link ? { link } : {}),
    };
  };
  const addTable = (rows: number, cols: number, data?: string[][], link?: TableItem['link']) => {
    addItem(tableItem(rows, cols, data, link));
    setTab('table');
  };
  const addImages = async (files: File[]) => {
    for (const f of files.filter(x => IMAGE_TYPES.includes(x.type))) {
      const src = await readAsDataUrl(f);
      const img = new Image();
      await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); img.src = src; });
      const k = Math.min(1, (deck.w * 0.6) / (img.naturalWidth || 1), (deck.h * 0.6) / (img.naturalHeight || 1));
      const w = Math.max(40, Math.round((img.naturalWidth || 400) * k)), h = Math.max(40, Math.round((img.naturalHeight || 300) * k));
      addItem({ id: newId(), kind: 'image', ...center(w, h), src, alt: f.name.replace(/\.[^.]+$/, '') });
    }
  };
  const deleteSelected = () => {
    if (!sel.length) return;
    // Emptying a placeholder keeps it, like PowerPoint; anything else goes.
    changeSlide(s => {
      const items = s.items.flatMap(it => (!sel.includes(it.id) ? [it] : it.kind === 'shape' && it.role && !isEmptyHtml(it.html) ? [{ ...it, html: linesToHtml([], it.role === 'body' || it.role === 'body2') }] : it.kind === 'shape' && it.role ? [it] : []));
      const anims = s.anims?.filter(a => items.some(it => it.id === a.item));
      return { ...s, items, anims: anims?.length ? anims : undefined };
    });
    setSel([]);
  };
  const duplicateSelected = () => {
    if (!selected.length) return;
    const copies = selected.map(it => ({ ...clone(it), id: newId(), x: it.x + 24, y: it.y + 24, ...(it.kind === 'shape' ? { role: undefined } : {}) } as Item));
    changeSlide(s => ({ ...s, items: [...s.items, ...copies] }));
    setSel(copies.map(c => c.id));
  };
  const copySelected = (cut = false) => {
    if (!selected.length) return;
    clip.current = clone(selected);
    const text = selected.map(itemText).filter(Boolean).join('\n');
    void navigator.clipboard?.writeText(text).catch(() => {});
    if (cut) deleteSelected();
  };
  const pasteItems = () => {
    if (!clip.current?.length) return false;
    const copies = clip.current.map(it => ({ ...clone(it), id: newId(), x: it.x + 16, y: it.y + 16, ...(it.kind === 'shape' ? { role: undefined } : {}) } as Item));
    clip.current = copies;
    changeSlide(s => ({ ...s, items: [...s.items, ...copies] }));
    setSel(copies.map(c => c.id));
    return true;
  };
  const arrange = (how: 'front' | 'back' | 'forward' | 'backward') => changeSlide(s => {
    const items = [...s.items];
    const picked = items.filter(i => sel.includes(i.id));
    let rest = items.filter(i => !sel.includes(i.id));
    if (how === 'front') return { ...s, items: [...rest, ...picked] };
    if (how === 'back') return { ...s, items: [...picked, ...rest] };
    const idx = items.findIndex(i => sel.includes(i.id));
    rest = items.filter(i => !sel.includes(i.id));
    const at = Math.max(0, Math.min(rest.length, how === 'forward' ? idx + 1 : idx - 1));
    rest.splice(at, 0, ...picked);
    return { ...s, items: rest };
  });
  const align = (how: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selected.length) return;
    const group = selected.length > 1;
    const L = group ? Math.min(...selected.map(i => i.x)) : 0, T = group ? Math.min(...selected.map(i => i.y)) : 0;
    const R = group ? Math.max(...selected.map(i => i.x + i.w)) : deck.w, B = group ? Math.max(...selected.map(i => i.y + i.h)) : deck.h;
    changeItems(sel, it => ({
      ...it,
      ...(how === 'left' ? { x: L } : how === 'center' ? { x: Math.round((L + R - it.w) / 2) } : how === 'right' ? { x: R - it.w } : {}),
      ...(how === 'top' ? { y: T } : how === 'middle' ? { y: Math.round((T + B - it.h) / 2) } : how === 'bottom' ? { y: B - it.h } : {}),
    }));
  };

  // ---------- pointer: select, move, resize, rotate ----------
  const k = useMemo(() => {
    if (zoom !== 'fit') return zoom;
    const pad = stageSize.w < 600 ? 16 : 48;
    return Math.max(0.05, Math.min((stageSize.w - pad) / deck.w, (stageSize.h - pad) / deck.h));
  }, [zoom, stageSize, deck.w, deck.h]);
  const kRef = useRef(k);
  kRef.current = k;
  usePinchZoom(stageRef, () => kRef.current, z => setZoom(z), { min: 0.1, max: 4 });
  const toSlide = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  const snap = (moving: { x: number; y: number; w: number; h: number }, ignore: string[]) => {
    const tol = 6 / k;
    const xs = [0, deck.w / 2, deck.w], ys = [0, deck.h / 2, deck.h];
    for (const it of slide.items) if (!ignore.includes(it.id)) { xs.push(it.x, it.x + it.w / 2, it.x + it.w); ys.push(it.y, it.y + it.h / 2, it.y + it.h); }
    let dx = 0, dy = 0, gx: number[] = [], gy: number[] = [];
    let best = tol;
    for (const edge of [moving.x, moving.x + moving.w / 2, moving.x + moving.w]) for (const x of xs) {
      const d = x - edge;
      if (Math.abs(d) < best) { best = Math.abs(d); dx = d; gx = [x]; } else if (Math.abs(d) === best && d === dx) gx.push(x);
    }
    best = tol;
    for (const edge of [moving.y, moving.y + moving.h / 2, moving.y + moving.h]) for (const y of ys) {
      const d = y - edge;
      if (Math.abs(d) < best) { best = Math.abs(d); dy = d; gy = [y]; } else if (Math.abs(d) === best && d === dy) gy.push(y);
    }
    return { dx, dy, v: gx, h: gy };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement;
    const handle = target.closest<HTMLElement>('[data-handle]');
    const p = toSlide(e);
    if (handle && one) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const h = handle.dataset.handle!;
      if (h === 'rot') setDrag({ kind: 'rotate', id: one.id, cx: one.x + one.w / 2, cy: one.y + one.h / 2 });
      else {
        const [hx, hy] = h.split(',').map(Number);
        setDrag({ kind: 'resize', id: one.id, hx, hy, x0: p.x, y0: p.y, orig: clone(one) });
        undo.current.push(deckRef.current); redo.current = [];
      }
      return;
    }
    const itemEl = target.closest<HTMLElement>('.st-canvas .st-item[data-id]');
    const id = itemEl?.dataset.id;
    if (id && editing?.id === id) return; // clicks inside the text being edited place the cursor
    if (editing) setEditing(null);
    if (!id) {
      setSel(e.shiftKey ? sel : []);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({ kind: 'marquee', x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: e.shiftKey ? sel : [] });
      rootRef.current?.focus();
      return;
    }
    e.preventDefault();
    const it = slide.items.find(i => i.id === id);
    let next = sel;
    if (e.shiftKey || e.ctrlKey || e.metaKey) next = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
    else if (!sel.includes(id)) next = [id];
    setSel(next);
    rootRef.current?.focus();
    if (it?.kind === 'table') setTab('table');
    else if (it && !(it.kind === 'shape' && it.role) && tab === 'table') setTab('format');
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const start = new Map(slide.items.filter(i => next.includes(i.id)).map(i => [i.id, { x: i.x, y: i.y }]));
    // A click on a placeholder's text, or on a box already selected, starts typing there.
    const clickEdit = it && isText(it) && (it.role || sel.includes(id)) && next.length === 1 ? id : null;
    setDrag({ kind: 'move', x0: p.x, y0: p.y, start, moved: false, clickEdit });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toSlide(e);
    if (drag.kind === 'move') {
      let dx = p.x - drag.x0, dy = p.y - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) * k < 4) return;
      if (!drag.moved) { undo.current.push(deckRef.current); redo.current = []; }
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const ids = [...drag.start.keys()];
      const items = slide.items.filter(i => ids.includes(i.id));
      const bx = Math.min(...items.map(i => drag.start.get(i.id)!.x)) + dx, by = Math.min(...items.map(i => drag.start.get(i.id)!.y)) + dy;
      const bw = Math.max(...items.map(i => drag.start.get(i.id)!.x + i.w)) + dx - bx, bh = Math.max(...items.map(i => drag.start.get(i.id)!.y + i.h)) + dy - by;
      const s = e.altKey ? { dx: 0, dy: 0, v: [], h: [] } : snap({ x: bx, y: by, w: bw, h: bh }, ids);
      setGuides({ v: s.v, h: s.h });
      const d = deckRef.current;
      setDeck({ ...d, slides: d.slides.map((sl, i) => (i !== active ? sl : { ...sl, items: sl.items.map(it => {
        const st = drag.start.get(it.id);
        return st ? { ...it, x: Math.round(st.x + dx + s.dx), y: Math.round(st.y + dy + s.dy) } : it;
      }) })) });
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    if (drag.kind === 'resize') {
      const o = drag.orig;
      const rad = ((o.rot ?? 0) * Math.PI) / 180;
      const gx = p.x - drag.x0, gy = p.y - drag.y0;
      // The pointer's movement in the box's own (rotated) directions.
      const lx = gx * Math.cos(rad) + gy * Math.sin(rad), ly = -gx * Math.sin(rad) + gy * Math.cos(rad);
      const line = o.kind === 'shape' && isLine(o.geom);
      let w = o.w + drag.hx * lx, h = o.h + drag.hy * ly;
      if (!line) { w = Math.max(12, w); h = Math.max(12, h); }
      const keep = (o.kind === 'image' || e.shiftKey) && drag.hx && drag.hy;
      if (keep && o.w && o.h) { const kk = Math.max(w / o.w, h / o.h); w = o.w * kk; h = o.h * kk; }
      const dw = (w - o.w) / 2 * drag.hx, dh = (h - o.h) / 2 * drag.hy;
      const cx = o.x + o.w / 2 + dw * Math.cos(rad) - dh * Math.sin(rad), cy = o.y + o.h / 2 + dw * Math.sin(rad) + dh * Math.cos(rad);
      let next: Item = { ...o, w: Math.round(Math.abs(w)), h: Math.round(Math.abs(h)), x: Math.round(cx - Math.abs(w) / 2), y: Math.round(cy - Math.abs(h) / 2) };
      if (line) next = { ...next, flipH: (w < 0) !== !!o.flipH || undefined, flipV: (h < 0) !== !!o.flipV || undefined };
      const d = deckRef.current;
      setDeck({ ...d, slides: d.slides.map((sl, i) => (i !== active ? sl : { ...sl, items: sl.items.map(it => (it.id === drag.id ? next : it)) })) });
      return;
    }
    if (drag.kind === 'rotate') {
      let a = (Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180) / Math.PI + 90;
      a = ((a % 360) + 360) % 360;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      else for (const s of [0, 90, 180, 270, 360]) if (Math.abs(a - s) < 4) a = s;
      a %= 360;
      const d = deckRef.current;
      if (!editingSnap.current) { undo.current.push(d); redo.current = []; editingSnap.current = true; }
      setDeck({ ...d, slides: d.slides.map((sl, i) => (i !== active ? sl : { ...sl, items: sl.items.map(it => (it.id === drag.id ? { ...it, rot: Math.round(a) || undefined } : it)) })) });
      return;
    }
    setDrag({ ...drag, x1: p.x, y1: p.y });
    const x = Math.min(drag.x0, p.x), y = Math.min(drag.y0, p.y), x2 = Math.max(drag.x0, p.x), y2 = Math.max(drag.y0, p.y);
    const hit = slide.items.filter(i => i.x < x2 && i.x + i.w > x && i.y < y2 && i.y + Math.max(i.h, 1) > y).map(i => i.id);
    setSel([...new Set([...drag.add, ...hit])]);
  };

  const onPointerUp = () => {
    if (drag?.kind === 'move' && !drag.moved && drag.clickEdit) startEdit(drag.clickEdit);
    editingSnap.current = editing ? editingSnap.current : false;
    setDrag(null);
    setGuides({ v: [], h: [] });
  };

  // ---------- keyboard ----------
  const onKey = (e: React.KeyboardEvent) => {
    const el = e.target as HTMLElement;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'F5') { e.preventDefault(); setShow({ start: e.shiftKey ? active : 0, presenter: e.altKey }); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); return; }
    if (mod && e.key.toLowerCase() === 'm') { e.preventDefault(); addSlide(); return; }
    if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); print(); return; }
    if (editing && e.key === 'Escape') { e.preventDefault(); const id = editing.id; stopEdit(); setSel([id]); return; }
    if (typing) return;
    // The box's editor is still opening: keep the keys for it.
    if (editing && e.key.length === 1 && !mod) { e.preventDefault(); typed.current += e.key; return; }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redoOnce(); else undoOnce(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redoOnce(); return; }
    if (el.closest('.st-rail')) return;
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel(slide.items.map(i => i.id)); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
    if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelected(); return; }
    if (mod && e.key.toLowerCase() === 'x') { e.preventDefault(); copySelected(true); return; }
    if (mod && e.key.toLowerCase() === 'g') return;
    if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.length) { e.preventDefault(); deleteSelected(); } return; }
    if (e.key === 'Escape') { setSel([]); return; }
    if (e.key.startsWith('Arrow') && sel.length) {
      e.preventDefault();
      const n = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
      changeItems(sel, it => ({ ...it, x: it.x + dx, y: it.y + dy }));
      return;
    }
    if ((e.key === 'PageDown' || (e.key === 'ArrowDown' && !sel.length)) && active < deck.slides.length - 1) { e.preventDefault(); setActive(active + 1); return; }
    if ((e.key === 'PageUp' || (e.key === 'ArrowUp' && !sel.length)) && active > 0) { e.preventDefault(); setActive(active - 1); return; }
    if ((e.key === 'Enter' || e.key === 'F2') && one && isText(one)) { e.preventDefault(); startEdit(one.id, true); return; }
    if (e.key.length === 1 && !mod && one && isText(one)) {
      // Typing on a selected box replaces its text, like PowerPoint.
      e.preventDefault();
      typed.current = e.key;
      startEdit(one.id, true);
    }
  };

  // Paste: our own boxes, pictures, or text as a new box.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter(f => IMAGE_TYPES.includes(f.type));
      if (files.length) { e.preventDefault(); void addImages(files); return; }
      const text = e.clipboardData?.getData('text/plain') ?? '';
      // Our own boxes when the clipboard holds their text, or nothing yet (pictures and shapes copy no text).
      if (clip.current && (!text.trim() || clip.current.map(itemText).filter(Boolean).join('\n') === text)) { e.preventDefault(); pasteItems(); return; }
      if (text.trim()) {
        e.preventDefault();
        const lines = text.trim().split(/\r?\n/).filter(Boolean);
        addItem({ id: newId(), kind: 'shape', geom: 'rect', ...center(Math.min(deck.w * 0.7, 640), Math.min(deck.h * 0.6, 40 + lines.length * 34)), fill: null, line: null, html: linesToHtml(lines, false), valign: 'top' });
      }
    };
    root.addEventListener('paste', onPaste);
    return () => root.removeEventListener('paste', onPaste);
  });

  // ---------- files ----------
  const loadFile = async (f: OpenedFile) => {
    try {
      const { readPptx } = await import('../../formats/pptx');
      const d = await readPptx(await f.arrayBuffer());
      undo.current = []; redo.current = [];
      setDeck(d);
      setActive(0);
      setSel([]);
      setFileName(f.name);
      setFileRef(f.handle ? { name: f.name, handle: f.handle } : null);
    } catch (err) {
      alert(`${t('letter.openFailed')} ${f.name}\n${String(err)}`);
    }
  };
  const pristine = () => !fileName && deckRef.current.slides.length === 1 && deckRef.current.slides[0].items.every(i => i.kind === 'shape' && isEmptyHtml(i.html));
  const openFile = async () => {
    const f = await shell.openFile(EXTENSIONS);
    if (!f) return;
    if (pristine()) void loadFile(f); else shell.openModule('stage', f);
  };
  const openRecent = async (r: RecentFile) => {
    const f = await shell.recent.open(r.id);
    if (!f) { alert(t('home.recentMissing')); return; }
    if (pristine()) void loadFile(f); else shell.openModule('stage', f);
  };
  const baseName = () => title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'presentation';
  const pptxBlob = async () => { const { writePptx } = await import('../../formats/pptx'); return writePptx(deckRef.current, getLanguage(), title); };
  const save = async (saveAs = false) => {
    const name = fileName.toLowerCase().endsWith('.pptx') ? fileName : `${baseName()}.pptx`;
    const ref = await shell.saveFile(name, pptxBlob, PPTX_TYPE, { target: fileRef, saveAs });
    if (!ref) return;
    setFileRef(ref);
    setFileName(ref.name);
  };
  // AutoSave: once the deck has a .pptx file, the shell writes it there after each pause in the work.
  const quietSave = useRef<() => Promise<FileRef | null>>(async () => null);
  quietSave.current = async () => {
    const own = !!fileRef?.handle && fileName.toLowerCase().endsWith('.pptx');
    if (!own && !shell.cloudOn?.()) return null;
    return shell.saveFile(own ? fileName : `${baseName()}.pptx`, pptxBlob, PPTX_TYPE, { target: own ? fileRef : undefined, quiet: true });
  };
  useEffect(() => { shell.autoSave(() => quietSave.current()); return () => shell.autoSave(null); }, [shell]);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  // Changing the language can translate the deck too: the words of every text box, table and note; looks stay.
  useEffect(() => {
    shell.translator?.(async tr => {
      const d = deckRef.current;
      const spots: { s: number; i: number }[] = [];
      d.slides.forEach((sl, si) => sl.items.forEach((it, ii) => { if ('html' in it && typeof it.html === 'string' && /\p{L}{2,}/u.test(it.html.replace(/<[^>]*>/g, ' '))) spots.push({ s: si, i: ii }); }));
      const htmls = spots.map(x => (d.slides[x.s].items[x.i] as { html: string }).html);
      const [newHtml, newNotes] = await Promise.all([translateHtml(htmls, tr), tr(d.slides.map(sl => sl.notes))]);
      let n = 0;
      const slides = d.slides.map((sl, si) => ({ ...sl, items: [...sl.items], notes: newNotes[si] ?? sl.notes }));
      d.slides.forEach((sl, si) => { if (slides[si].notes !== sl.notes) n++; });
      spots.forEach((x, k) => { const it = slides[x.s].items[x.i] as { html: string }; if (newHtml[k] !== it.html) { slides[x.s].items[x.i] = { ...slides[x.s].items[x.i], html: newHtml[k] } as typeof slides[number]['items'][number]; n++; } });
      if (n) commitRef.current({ ...deckRef.current, slides });
      return n;
    });
    return () => shell.translator?.(null);
  }, [shell]); // eslint-disable-line react-hooks/exhaustive-deps
  const share = async () => {
    const f = new File([await pptxBlob()], `${baseName()}.pptx`, { type: PPTX_TYPE });
    if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title }).catch(() => {});
    else void save(true);
  };
  const print = () => setPrinting(true);
  useEffect(() => {
    if (!printing) return;
    const style = document.createElement('style');
    style.textContent = `@page { size: ${deck.w / 96}in ${deck.h / 96}in; margin: 0; }`;
    document.head.appendChild(style);
    document.body.classList.add('st-printing');
    const done = () => { document.body.classList.remove('st-printing'); style.remove(); setPrinting(false); };
    window.addEventListener('afterprint', done, { once: true });
    // Pictures and fonts need a moment to be laid out before the print window takes its copy.
    const timer = window.setTimeout(() => window.print(), 300);
    return () => { window.clearTimeout(timer); window.removeEventListener('afterprint', done); };
  }, [printing, deck.w, deck.h]);
  useEffect(() => { if (file) void loadFile(file); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ---------- links with the other apps ----------
  const receive = (h: Handoff, from: string | null): boolean => {
    if (h.kind === 'file') { void loadFile(h.file); return true; }
    if (h.kind === 'table') {
      const rows = h.table.rows.map(r => r.map(c => c.text));
      const d = deckRef.current;
      // A linked table coming back with changes: update it wherever it is.
      if (h.link) {
        let found = false;
        const slides = d.slides.map(s => ({ ...s, items: s.items.map(it => {
          if (it.kind === 'table' && it.link?.id === h.link!.id) { found = true; return { ...it, rows, link: { ...it.link, tabId: from ?? it.link.tabId } }; }
          return it;
        }) }));
        if (found) { commit({ ...d, slides }); return true; }
      }
      const link = h.link && from ? { ...h.link, tabId: from } : h.link;
      // A new deck gets a "title only" slide: the table's name above it.
      if (pristine()) {
        const s = newSlide('titleOnly', d);
        s.items = [...s.items.map(it => (it.kind === 'shape' && it.role === 'title' && h.title ? { ...it, html: linesToHtml([h.title], false) } : it)), tableItem(rows.length, rows[0]?.length ?? 1, rows, link)];
        commit({ ...d, slides: [s] });
        setActive(0);
        setTab('table');
        return true;
      }
      addTable(rows.length, rows[0]?.length ?? 1, rows, link);
      if (h.title && slide.items.some(i => i.kind === 'shape' && i.role === 'title' && isEmptyHtml(i.html))) {
        const tt = slide.items.find(i => i.kind === 'shape' && i.role === 'title')!;
        changeItems([tt.id], it => ({ ...it, html: linesToHtml([h.title!], false) } as Item));
      }
      return true;
    }
    if (h.kind === 'html') {
      const imgs = Array.from(new DOMParser().parseFromString(h.html, 'text/html').querySelectorAll('img'));
      if (imgs.length && !htmlText(h.html.replace(/<img[^>]*>/g, '')).trim()) {
        for (const img of imgs) {
          const w0 = Number(img.getAttribute('width')) || 480, h0 = Number(img.getAttribute('height')) || 300;
          const kk = Math.min(1.4, (deck.w * 0.8) / w0, (deck.h * 0.7) / h0);
          addItem({ id: newId(), kind: 'image', ...center(Math.round(w0 * kk), Math.round(h0 * kk)), src: img.getAttribute('src') ?? '', alt: img.getAttribute('alt') ?? '' });
        }
        return true;
      }
      const made = slidesFromHtml(h.html, deckRef.current);
      if (!made.length) return false;
      const d = deckRef.current;
      const fresh = pristine();
      commit({ ...d, slides: fresh ? made : [...d.slides.slice(0, active + 1), ...made, ...d.slides.slice(active + 1)] });
      setActive(fresh ? 0 : active + 1);
      shell.notify(made.length === 1 ? t('stage.oneSlideMade') : t('stage.slidesMade', { n: made.length }));
      return true;
    }
    return false;
  };
  const receiveRef = useRef(receive);
  receiveRef.current = receive;
  useEffect(() => shell.onReceive((h, from) => receiveRef.current(h, from)), [shell]);
  useEffect(() => { if (handoff) setTimeout(() => receiveRef.current(handoff, handoff.kind === 'table' ? handoff.link?.tabId ?? null : null), 0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  // Another app asks for a table: give the selected table.
  useEffect(() => shell.onAsk(() => {
    const it = deckRef.current.slides.flatMap(s => s.items).find(i => sel.includes(i.id) && i.kind === 'table') as TableItem | undefined;
    if (!it) return null;
    return { kind: 'table', title, table: { rows: it.rows.map(r => r.map(text => ({ text }))), header: it.header } };
  }), [shell, sel, title]);

  const sheets = shell.tabs('class');
  const letters = shell.tabs('letter');
  const tableFromClass = async (tabId: string) => {
    const h = await shell.ask(tabId, 'table');
    if (h?.kind === 'table') receive(h, tabId);
    else shell.notify(t('letter.sheetGone'));
  };
  const outlineToLetter = async (tabId: string | null) => {
    const h: Handoff = { kind: 'html', title, html: outlineHtml(deckRef.current, title) };
    if (tabId && await shell.send(tabId, h)) { shell.notify(t('stage.outlineSent', { title: letters.find(x => x.tabId === tabId)?.title ?? 'Office Letter' })); shell.showTab(tabId); }
    else shell.openModule('letter', undefined, h);
  };
  const tableToClass = () => {
    if (!one || one.kind !== 'table') return;
    const table: TableData = { rows: one.rows.map(r => r.map(text => ({ text }))), header: one.header };
    const id = one.link?.id ?? newId('l');
    const mine = { tabId: shell.tabId, id, moduleId: 'stage', title };
    if (one.link && shell.tabs('class').some(x => x.tabId === one.link!.tabId)) { void shell.send(one.link.tabId, { kind: 'table', title, table, link: mine }); shell.showTab(one.link.tabId); return; }
    const tabId = shell.openModule('class', undefined, { kind: 'table', title, table, link: mine });
    if (tabId) changeItems([one.id], it => ({ ...it, link: { tabId, id, moduleId: 'class', title: 'Office Class' } } as Item));
  };

  // ---------- copilot (Claude) ----------
  const [copilot, setCopilot] = useState(false);
  useCopilotShortcut(() => setCopilot(o => !o), rootRef);
  const bridge: StageBridge = {
    deck: () => deckRef.current,
    active: () => active,
    selection: () => slide.items.filter(i => sel.includes(i.id)),
    addSlides: (made, replaceAll) => {
      const d = deckRef.current;
      // A new, empty deck is replaced rather than kept as a blank first slide.
      const replace = replaceAll || pristine();
      const slides = replace ? made : [...d.slides.slice(0, active + 1), ...made, ...d.slides.slice(active + 1)];
      commit({ ...d, slides });
      setActive(replace ? 0 : active + 1);
    },
    replaceSlide: s => changeSlide(() => s),
    setNotes: notes => changeSlide(s => ({ ...s, notes })),
    setItemHtml: (id, html) => changeItems([id], it => (it.kind === 'shape' ? { ...it, html } : it)),
    themes: () => [...THEMES, ...myThemes()],
    setTheme: th => setTheme(th),
    setAllNotes: notes => { const d = deckRef.current; commit({ ...d, slides: d.slides.map((x, i) => (notes[i] ? { ...x, notes: notes[i] } : x)) }); },
    setAnims: (index, anims) => changeSlide(x => ({ ...x, anims: anims.length ? anims : undefined }), index),
    addAnimated,
  };

  // ---------- audience: Claude adapts the whole deck to who is watching ----------
  const [audBusy, setAudBusy] = useState<{ aud: Audience; stop: AbortController } | null>(null);
  const [adapted, setAdapted] = useState<{ aud: Audience; before: Deck; after: Deck; summary: string; showing: 'after' | 'before' } | null>(null);
  const [audText, setAudText] = useState('');
  const adaptTo = async (aud: Audience) => {
    if (audBusy) return;
    if (!shell.ai.ready()) { shell.notify(t('stage.audience.needsAi')); setCopilot(true); return; }
    const stop = new AbortController();
    setAudBusy({ aud, stop });
    setEditing(null);
    closeRibbonPeek();
    // Adapting again starts from the original deck, not from the last audience's version.
    const before = adapted ? adapted.before : deckRef.current;
    try {
      const ui = LANGUAGES.find(l => l.code === getLanguage())?.name ?? 'English';
      const got = await adaptDeck(shell.ai, before, aud, [...THEMES, ...myThemes()], ui, retheme, stop.signal);
      if (adapted) setDeck(adapted.before);
      commit(got.deck);
      setAdapted({ aud, before, after: got.deck, summary: got.summary, showing: 'after' });
    } catch (err) {
      if (stop.signal.aborted) return;
      const kind = err instanceof AiError ? err.kind : 'other';
      shell.notify(kind === 'other' ? t('ai.err.other', { msg: String((err as Error)?.message ?? err) }) : t(`ai.err.${kind}` as MessageKey));
      if (kind === 'key') setCopilot(true);
    } finally {
      setAudBusy(null);
    }
  };
  /** Compare: show the deck before or after, without losing either. */
  const audShow = (which: 'after' | 'before') => {
    if (!adapted || adapted.showing === which) return;
    // Changes made while looking at one version stay in it.
    const next = { ...adapted, [adapted.showing]: deckRef.current, showing: which };
    setEditing(null);
    setDeck(next[which]);
    setAdapted(next);
    setActive(a => Math.min(a, next[which].slides.length - 1));
  };
  const audKeep = () => { if (adapted?.showing === 'before') audShow('after'); setAdapted(null); shell.notify(t('stage.audience.kept')); };
  const audBack = () => {
    if (!adapted) return;
    commit(adapted.before);
    setAdapted(null);
    shell.notify(t('stage.audience.reverted'));
  };
  const audienceMenu = (close: () => void) => (
    <div className="st-aud-menu">
      <span className="kicker">{t('stage.audience.pick')}</span>
      <div className="st-aud-grid">
        {AUDIENCES.map(a => (
          <button key={a.id} type="button" className={adapted?.aud.id === a.id ? 'on' : ''} onClick={() => { close(); void adaptTo(a); }}>
            <span className="st-aud-emoji" aria-hidden="true">{a.emoji}</span>{audienceName(a, lang)}
          </button>
        ))}
      </div>
      <hr />
      <form className="st-aud-custom" onSubmit={e => { e.preventDefault(); if (audText.trim()) { close(); void adaptTo(customAudience(audText)); } }}>
        <input value={audText} onChange={e => setAudText(e.target.value)} placeholder={t('stage.audience.customHint')} aria-label={t('stage.audience.custom')} />
        <button type="submit" className="primary" disabled={!audText.trim()}>{t('stage.audience.adapt')}</button>
      </form>
    </div>
  );

  // ---------- animation preview on the slide ----------
  const previewSteps = useMemo(() => stepsOf(slide), [slide]);
  useEffect(() => {
    if (!preview) return;
    // Each step plays, then the next one starts a moment later, like clicking through the show.
    const len = stepLength(previewSteps[preview.step] ?? []);
    const id = window.setTimeout(() => {
      setPreview(p => (p && p.step < previewSteps.length - 1 ? { ...p, step: p.step + 1 } : null));
    }, (len + (preview.step < previewSteps.length - 1 ? 0.5 : 1.5)) * 1000);
    return () => window.clearTimeout(id);
  }, [preview, previewSteps]);
  useEffect(() => { setPreview(null); }, [active]);
  const startPreview = () => {
    setEditing(null);
    setPreview(p => (p ? null : { step: 0, run: Date.now() }));
  };
  /** Numbers on the slide showing on which click each item moves, like PowerPoint's animation tags. */
  const animBadges = () => {
    let n = 0;
    const tags = new Map<string, string[]>();
    for (const a of slide.anims ?? []) {
      const loop = ['bob', 'beat', 'sway', 'twinkle', 'rotate', 'jelly'].includes(a.effect);
      if (!loop && a.start === 'click') n++;
      tags.set(a.item, [...(tags.get(a.item) ?? []), loop ? '∞' : String(n)]);
    }
    return slide.items.filter(it => tags.has(it.id)).map(it => (
      <span key={`ab${it.id}`} className="st-anim-tag" style={{ left: it.x * k - 4, top: it.y * k - 4 }}>{[...new Set(tags.get(it.id))].join(' ')}</span>
    ));
  };
  const previewPlay = useMemo(() => (preview ? playState(slide, preview.step, true) : undefined), [preview, slide]);

  // ---------- drawing ----------
  const extras = (it: Item): ItemExtras | undefined => {
    if (editing?.id === it.id && it.kind === 'shape') {
      const promptKey: MessageKey = it.role === 'title' ? 'stage.clickTitle' : it.role ? 'stage.clickText' : 'stage.typeHere';
      return {
        editor: <TextEdit key={it.id} html={it.html} placeholder={t(promptKey)} selectAll={editing.all} takeTyped={takeTyped}
          onChange={html => onText(it.id, html)} onReady={onReady} />,
      };
    }
    if (it.kind === 'table' && sel.length === 1 && sel[0] === it.id) {
      return { tableEditor: <TableEdit it={it} theme={deck.theme} onCell={(r, c) => setCell({ r, c })} onChange={rows => changeItems([it.id], x => ({ ...x, rows } as Item))} /> };
    }
    if (it.kind === 'shape' && it.role) return { prompt: t(it.role === 'title' ? 'stage.clickTitle' : it.role === 'subtitle' ? 'stage.clickSubtitle' : 'stage.clickText') };
    return undefined;
  };

  // The handles stay while typing, so a placeholder clicked straight into its text can still be resized or turned.
  const handles = (it: Item) => {
    const line = it.kind === 'shape' && isLine(it.geom);
    const pts: [number, number][] = line ? [[-1, -1], [1, 1]] : [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
    return <>
      {pts.map(([hx, hy]) => (
        <span key={`${hx},${hy}`} className="st-handle" data-handle={`${hx},${hy}`}
          style={{ left: `${(hx + 1) * 50}%`, top: `${(hy + 1) * 50}%`, cursor: hx === hy ? 'nwse-resize' : hx === -hy ? 'nesw-resize' : hx ? 'ew-resize' : 'ns-resize' }} />
      ))}
      {!line && <span className="st-handle rot" data-handle="rot" style={{ left: '50%', top: -24 }} />}
    </>;
  };

  // ---------- ribbon ----------
  const fontShown = textState.font ?? (one && one.kind === 'shape' && one.role === 'title' ? deck.theme.head : deck.theme.body);
  const sizeShown = textState.size ?? (one && one.kind === 'shape' ? defaultSize(one.role, slide.layout) : 18);
  const fontGroups: ComboGroup[] = [
    { label: t('stage.themeFonts'), items: [...new Set([deck.theme.head, deck.theme.body])] },
    ...FONT_GROUPS.map(g => ({ label: t(`letter.fonts.${g.kind}` as MessageKey), items: g.fonts })),
  ];
  const setSize = (pt: number) => { if (pt > 0 && pt < 400) format(c => c.setFontSize(`${pt}pt`)); };
  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? FONT_SIZES.find(n => n > sizeShown) ?? sizeShown + 12 : [...FONT_SIZES].reverse().find(n => n < sizeShown) ?? Math.max(1, sizeShown - 1);
    setSize(next);
  };
  const textOn = !!(editing || textTargets.length);
  const shapeSel = selected.filter(i => i.kind === 'shape' || i.kind === 'image');
  const hasFormat = shapeSel.length > 0;
  const tableSel = one?.kind === 'table' ? one : null;
  const shownTab: Tab = (tab === 'format' && !hasFormat) || (tab === 'table' && !tableSel) ? 'home' : tab;
  const tabs: { id: Tab; label: MessageKey }[] = [
    { id: 'home', label: 'letter.tab.home' }, { id: 'insert', label: 'letter.tab.insert' }, { id: 'design', label: 'letter.tab.design' },
    { id: 'transitions', label: 'stage.tab.transitions' }, { id: 'animations', label: 'stage.tab.animations' }, { id: 'show', label: 'stage.tab.show' }, { id: 'review', label: 'letter.tab.review' }, { id: 'view', label: 'letter.tab.view' },
  ];
  const themeColors = [deck.theme.bg.color, deck.theme.text, ...deck.theme.accents];
  const setFill = (c: string | null) => changeItems(shapeSel.map(i => i.id), it => (it.kind === 'shape' ? { ...it, fill: c } : it));
  const setLine = (patch: Partial<Stroke> | null) => changeItems(shapeSel.map(i => i.id), it => {
    if (patch === null) return it.kind === 'image' ? { ...it, line: null } : { ...it, line: null } as Item;
    const cur = (it.kind === 'shape' || it.kind === 'image') ? it.line : null;
    const base: Stroke = cur ?? { color: deck.theme.accents[0], width: 1.5 };
    return { ...it, line: { ...base, ...patch } } as Item;
  });
  const setBg = (bg: Background | null) => changeSlide(s => ({ ...s, bg }));
  const setTransition = (tr: Transition) => changeSlide(s => ({ ...s, transition: tr === 'none' ? undefined : tr }));
  const transitionAll = () => { const d = deckRef.current; commit({ ...d, slides: d.slides.map(s => ({ ...s, transition: slide.transition, speed: slide.speed })) }); shell.notify(t('stage.appliedAll')); };
  const setTheme = (th: DeckTheme) => commit(retheme(deckRef.current, th));
  const currentGroup: ThemeGroup = deck.theme.id === 'file' ? 'mine' : deck.theme.group ?? 'classic';
  const shownGroup: ThemeGroup = themeGroup ?? currentGroup;
  const galleryThemes = shownGroup === 'mine'
    ? [...mine, ...(deck.theme.id === 'file' || (deck.theme.group === 'mine' && !mine.some(m => m.id === deck.theme.id)) ? [deck.theme] : [])]
    : THEMES.filter(th => (th.group ?? 'classic') === shownGroup);
  const tableCmd = (fn: (t: TableItem) => TableItem) => { if (tableSel) changeItems([tableSel.id], it => fn(it as TableItem)); };
  const at = cell ?? { r: (tableSel?.rows.length ?? 1) - 1, c: (tableSel?.rows[0]?.length ?? 1) - 1 };
  const slideMenu = (onPick: (l: LayoutId) => void, current?: LayoutId) => (close: () => void) => (
    <div className="st-layouts">
      {LAYOUTS.map(l => {
        const s = newSlide(l, deck);
        s.items = s.items.map(it => (it.kind === 'shape' ? { ...it, html: it.role === 'title' ? `<p>${t('stage.layoutTitle')}</p>` : it.role === 'subtitle' ? `<p>${t('stage.layoutSubtitle')}</p>` : '<ul><li><p>—</p></li><li><p>—</p></li></ul>' } : it));
        return (
          <button key={l} type="button" className={current === l ? 'on' : ''} onClick={() => { close(); onPick(l); }}>
            <SlideThumb deck={deck} slide={s} width={112} />
            {t(`stage.layout.${l}` as MessageKey)}
          </button>
        );
      })}
    </div>
  );
  const shapesMenu = (close: () => void) => (
    <div className="st-shapes">
      {GEOMS.map(g => <button key={g} type="button" title={t(`stage.shape.${g}` as MessageKey)} aria-label={t(`stage.shape.${g}` as MessageKey)} onClick={() => { close(); addShape(g); }}><ShapeIcon g={g} /></button>)}
    </div>
  );
  const swatches = (onPick: (c: string | null) => void, none: MessageKey) => (close: () => void) => <>
    <span className="kicker">{t('stage.themeColors')}</span>
    <div className="st-swatches">{themeColors.map((c, i) => <button key={i} type="button" style={{ background: c }} title={c} onClick={() => { close(); onPick(c); }} />)}</div>
    <hr />
    <ColorGrid none={none} onPick={c => { close(); onPick(c); }} />
  </>;

  const ribbon = (
    <div className="ribbon">
      <div className="ribbon-tabs" role="tablist">
        <button type="button" className="ribbon-file" onClick={() => setPanel('file')}>{t('letter.tab.file')}</button>
        {tabs.map(x => <button key={x.id} type="button" role="tab" aria-selected={shownTab === x.id} className={shownTab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>{t(x.label)}</button>)}
        <button type="button" role="tab" aria-selected={shownTab === 'oi1'} className={`ribbon-special${shownTab === 'oi1' ? ' on' : ''}`} onClick={() => setTab('oi1')}><span className="dot" />Office In 1</button>
        <TutoTab />
        <RibbonToggle />
        {hasFormat && <button type="button" role="tab" aria-selected={shownTab === 'format'} className={shownTab === 'format' ? 'on' : ''} onClick={() => setTab('format')}>{t('stage.tab.format')}</button>}
        {tableSel && <button type="button" role="tab" aria-selected={shownTab === 'table'} className={shownTab === 'table' ? 'on' : ''} onClick={() => setTab('table')}>{t('letter.tab.table')}</button>}
        <span className="ribbon-quick">
          <CopilotButton open={copilot} onClick={() => setCopilot(o => !o)} />
          <Btn icon="play" title="stage.fromCurrent" onClick={() => setShow({ start: active, presenter: false })} />
          <Btn icon="undo" title="letter.undo" onClick={undoOnce} disabled={!undo.current.length} />
          <Btn icon="redo" title="letter.redo" onClick={redoOnce} disabled={!redo.current.length} />
        </span>
      </div>
      <div className="ribbon-panel" role="tabpanel" onMouseDown={e => { if (!['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) e.preventDefault(); }}>
        {shownTab === 'home' && <>
          <Group label="letter.group.clipboard">
            <Btn big icon="paste" title="letter.paste" onClick={async () => {
              if (pasteItems()) return;
              try {
                const items = await navigator.clipboard.read?.();
                const img = items?.find(i => i.types.some(x => x.startsWith('image/')));
                if (img) { const type = img.types.find(x => x.startsWith('image/'))!; void addImages([new File([await img.getType(type)], 'image', { type })]); return; }
                const text = await navigator.clipboard.readText();
                if (text.trim()) addItem({ id: newId(), kind: 'shape', geom: 'rect', ...center(640, 120), fill: null, line: null, html: linesToHtml(text.trim().split(/\r?\n/), false), valign: 'top' });
              } catch { alert(t('letter.pasteBlocked')); }
            }} />
            <div className="stack">
              <Btn icon="cut" title="letter.cut" onClick={() => copySelected(true)} disabled={!sel.length} />
              <Btn icon="copy" title="letter.copy" onClick={() => copySelected()} disabled={!sel.length} />
              <Btn icon="clean" title="stage.duplicate" onClick={duplicateSelected} disabled={!sel.length} />
            </div>
          </Group>
          <Group label="stage.group.slides">
            <span className="split">
              <Btn big icon="new" title="stage.newSlide" onClick={() => addSlide()} />
              <Drop title="stage.layoutGallery" wide>{slideMenu(l => addSlide(l))}</Drop>
            </span>
            <div className="stack">
              <Drop icon="window" title="stage.layout" text wide>{slideMenu(setLayout, slide.layout)}</Drop>
              <Btn icon="redo" title="stage.reset" text onClick={resetSlide} />
              <Btn icon="trash" title="stage.deleteSlide" text onClick={() => deleteSlide()} />
            </div>
          </Group>
          <Group label="letter.group.font">
            <div className="rows">
              <div className="row">
                <Combo className="font-box" help="letter.font" label={t('letter.font')} value={fontShown} groups={fontGroups}
                  itemStyle={f => ({ fontFamily: cssFont(f) })} onPick={f => format(c => c.setFontFamily(f))} />
                <Combo className="size-box" help="letter.fontSize" label={t('letter.fontSize')} value={String(sizeShown)} numeric inputMode="decimal"
                  groups={[{ items: [...FONT_SIZES, 32, 40, 44, 54, 60, 66, 80, 96].sort((a, b) => a - b).filter((v, i, a) => a.indexOf(v) === i).map(String) }]} onPick={v => setSize(parseFloat(v.replace(',', '.')))} />
                <Btn icon="grow" title="letter.grow" onClick={() => step(1)} disabled={!textOn} />
                <Btn icon="shrink" title="letter.shrink" onClick={() => step(-1)} disabled={!textOn} />
                <Btn icon="clear" title="letter.clearFormatting" onClick={() => format(c => c.unsetAllMarks())} disabled={!textOn} />
              </div>
              <div className="row">
                <Btn label="B" title="letter.bold" onClick={() => format(c => c.toggleBold())} active={textState.bold} style={{ fontWeight: 700 }} disabled={!textOn} />
                <Btn label="I" title="letter.italic" onClick={() => format(c => c.toggleItalic())} active={textState.italic} style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }} disabled={!textOn} />
                <Btn label="U" title="letter.underline" onClick={() => format(c => c.toggleUnderline())} active={textState.underline} style={{ textDecoration: 'underline' }} disabled={!textOn} />
                <Btn label="ab" title="letter.strike" onClick={() => format(c => c.toggleStrike())} active={textState.strike} style={{ textDecoration: 'line-through' }} disabled={!textOn} />
                <Btn label={<>x<sub>2</sub></>} title="letter.subscript" onClick={() => format(c => c.toggleSubscript())} active={textState.sub} disabled={!textOn} />
                <Btn label={<>x<sup>2</sup></>} title="letter.superscript" onClick={() => format(c => c.toggleSuperscript())} active={textState.sup} disabled={!textOn} />
                <Drop label={<span className="color-a">A<i style={{ background: textState.color ?? deck.theme.accents[0] }} /></span>} title="letter.color" disabled={!textOn}>
                  {swatches(c => format(x => (c ? x.setColor(c) : x.unsetColor())), 'letter.automatic')}
                </Drop>
                <Drop label={<span className="color-a hl">ab<i style={{ background: textState.highlight ?? '#FFFF00' }} /></span>} title="letter.highlight" disabled={!textOn}>
                  {close => <ColorGrid none="letter.noColor" value={textState.highlight} onPick={c => { close(); format(x => (c ? x.setHighlight({ color: c }) : x.unsetHighlight())); }} />}
                </Drop>
              </div>
            </div>
          </Group>
          <Group label="letter.group.paragraph">
            <div className="rows">
              <div className="row">
                <Btn icon="bullets" title="letter.bullets" onClick={() => format(c => c.toggleBulletList())} active={textState.bullets} disabled={!textOn} />
                <Btn icon="numbers" title="letter.numbers" onClick={() => format(c => c.toggleOrderedList())} active={textState.numbers} disabled={!textOn} />
                <Btn icon="outdent" title="letter.outdent" onClick={() => format(c => c.liftListItem('listItem'))} disabled={!textOn} />
                <Btn icon="indent" title="letter.indent" onClick={() => format(c => c.sinkListItem('listItem'))} disabled={!textOn} />
                <Drop icon="spacing" title="letter.lineSpacing" disabled={!textTargets.length && !editing}>
                  {close => [0.9, 1, 1.15, 1.5, 2].map(v => (
                    <MenuItem key={v} label={String(v).replace('.', lang.startsWith('en') ? '.' : ',')} active={(one?.kind === 'shape' ? one.spacing : undefined) === v}
                      onClick={() => { close(); changeItems(textTargets.map(i => i.id).concat(editing ? [editing.id] : []), it => ({ ...it, spacing: v } as Item)); }} />
                  ))}
                </Drop>
              </div>
              <div className="row">
                <Btn icon="left" title="letter.alignLeft" onClick={() => format(c => c.setTextAlign('left'))} active={textState.align === 'left'} disabled={!textOn} />
                <Btn icon="center" title="letter.alignCenter" onClick={() => format(c => c.setTextAlign('center'))} active={textState.align === 'center'} disabled={!textOn} />
                <Btn icon="right" title="letter.alignRight" onClick={() => format(c => c.setTextAlign('right'))} active={textState.align === 'right'} disabled={!textOn} />
                <Btn icon="justify" title="letter.justify" onClick={() => format(c => c.setTextAlign('justify'))} active={textState.align === 'justify'} disabled={!textOn} />
                <Btn icon="vtop" title="stage.vTop" onClick={() => changeItems(textTargets.map(i => i.id), it => ({ ...it, valign: 'top' } as Item))} active={one?.kind === 'shape' && one.valign === 'top'} disabled={!textTargets.length} />
                <Btn icon="vmid" title="stage.vMiddle" onClick={() => changeItems(textTargets.map(i => i.id), it => ({ ...it, valign: 'middle' } as Item))} active={one?.kind === 'shape' && one.valign === 'middle'} disabled={!textTargets.length} />
                <Btn icon="vbot" title="stage.vBottom" onClick={() => changeItems(textTargets.map(i => i.id), it => ({ ...it, valign: 'bottom' } as Item))} active={one?.kind === 'shape' && one.valign === 'bottom'} disabled={!textTargets.length} />
              </div>
            </div>
          </Group>
          <Group label="stage.group.drawing">
            <Drop big icon="theme" title="stage.shapes" wide>{shapesMenu}</Drop>
            <div className="stack">
              <Drop icon="fill" title="stage.fill" text disabled={!shapeSel.length}>{swatches(setFill, 'letter.noColor')}</Drop>
              <Drop icon="pen" title="stage.outline" text disabled={!shapeSel.length}>{swatches(c => setLine(c ? { color: c } : null), 'letter.border.none')}</Drop>
              <Drop icon="sort" title="stage.arrange" text disabled={!sel.length}>
                {close => <>
                  <MenuItem label={t('stage.front')} onClick={() => { close(); arrange('front'); }} />
                  <MenuItem label={t('stage.forward')} onClick={() => { close(); arrange('forward'); }} />
                  <MenuItem label={t('stage.backward')} onClick={() => { close(); arrange('backward'); }} />
                  <MenuItem label={t('stage.back')} onClick={() => { close(); arrange('back'); }} />
                </>}
              </Drop>
            </div>
          </Group>
        </>}

        {shownTab === 'insert' && <>
          <Group label="stage.group.slides">
            <span className="split">
              <Btn big icon="new" title="stage.newSlide" onClick={() => addSlide()} />
              <Drop title="stage.layoutGallery" wide>{slideMenu(l => addSlide(l))}</Drop>
            </span>
          </Group>
          <Group label="letter.group.tables">
            <Drop big icon="table" title="letter.table">{close => <TablePicker onPick={(r, c) => { close(); addTable(r, c); }} />}</Drop>
            <Drop big icon="sheet" title="stage.fromClass">
              {close => <>
                {sheets.length > 0 && <span className="kicker">{t('letter.openSheets')}</span>}
                {sheets.map(x => <MenuItem key={x.tabId} label={x.title} onClick={() => { close(); void tableFromClass(x.tabId); }} />)}
                {!sheets.length && <MenuItem label={t('stage.noSheets')} onClick={() => { close(); shell.openModule('class'); }} />}
              </>}
            </Drop>
          </Group>
          <Group label="letter.group.illustrations">
            <Btn big icon="image" title="letter.image" onClick={() => imageInput.current?.click()} />
            <Drop big icon="theme" title="stage.shapes" wide>{shapesMenu}</Drop>
          </Group>
          <Group label="letter.group.text">
            <Btn big icon="texttable" title="stage.textBox" onClick={addTextBox} />
            <Btn big icon="date" title="letter.date" onClick={() => addItem({ id: newId(), kind: 'shape', geom: 'rect', ...center(320, 48), y: deck.h - 64, fill: null, line: null, html: `<p>${new Date().toLocaleDateString(lang)}</p>`, valign: 'middle' })} />
            <Drop big icon="wordart" title="stage.wordart">
              {close => <div className="st-wordart">
                {WORDART.map(w => (
                  <button key={w.id} type="button" title={t(`stage.wordart.${w.id}` as MessageKey)} onClick={() => { close(); addWordArt(w.id); }}
                    style={{ fontFamily: cssFont(w.font), color: deck.theme.accents[w.accent % deck.theme.accents.length], background: cssBackground(deck.theme.bg) }}>
                    {w.upper ? 'ABC' : 'Abc'}<span>{t(`stage.wordart.${w.id}` as MessageKey)}</span>
                  </button>
                ))}
              </div>}
            </Drop>
          </Group>
          <Group label="stage.group.diagrams">
            <Drop big icon="diagram" title="stage.diagrams" wide>
              {close => <div className="st-diagrams">
                {DIAGRAMS.map(k => {
                  const d = { ...deck, slides: [] };
                  const s = newSlide('blank', d);
                  s.items = diagramItems(k, ['', '', '', ''], d);
                  return (
                    <button key={k} type="button" onClick={() => { close(); addDiagram(k); }}>
                      <SlideThumb deck={deck} slide={s} width={120} />
                      {t(`stage.diagram.${k}` as MessageKey)}
                    </button>
                  );
                })}
                <p className="st-hint">{t('stage.diagram.hint')}</p>
              </div>}
            </Drop>
          </Group>
          <Group label="stage.group.extras">
            <Btn big icon="qr" title="stage.qr" onClick={addQr} />
            <Btn big icon="pagenum" title="stage.slideNumbers" onClick={numberSlides} />
            <Btn big icon="footer" title="stage.footer" onClick={addFooter} />
          </Group>
        </>}

        {shownTab === 'design' && <>
          <Group label="stage.group.themes">
            <div className="st-gallery-wrap">
              <div className="st-gallery-groups" role="tablist" aria-label={t('stage.group.themes')}>
                {(['classic', 'life', 'military', 'mine'] as ThemeGroup[]).map(g => (
                  <button key={g} type="button" role="tab" aria-selected={shownGroup === g} className={shownGroup === g ? 'on' : ''} onClick={() => setThemeGroup(g)}>
                    {t(`stage.themes.${g}` as MessageKey)}
                  </button>
                ))}
              </div>
              <div className="st-gallery">
                {galleryThemes.map(th => (
                  <span key={th.id + th.name} className="st-gallery-cell">
                    <button type="button" className={`st-gallery-item${deck.theme.id === th.id && deck.theme.name === th.name ? ' on' : ''}`} title={themeName(th)} aria-label={themeName(th)} onClick={() => setTheme(th)}>
                      <ThemeChip th={th} />
                    </button>
                    {th.group === 'mine' && th.id !== 'file' && <button type="button" className="st-gallery-x" title={t('stage.themes.remove')} aria-label={`${t('stage.themes.remove')} ${th.name}`} onClick={() => removeMyTheme(th.id)}>×</button>}
                  </span>
                ))}
                {shownGroup === 'mine' && !galleryThemes.length && <span className="st-gallery-empty">{t('stage.themes.mineEmpty')}</span>}
              </div>
            </div>
          </Group>
          <Group label="stage.group.audience">
            <Drop big icon="user" title="stage.audience" label={t('stage.audience.short')} disabled={!!audBusy} wide>
              {audienceMenu}
            </Drop>
          </Group>
          <Group label="stage.group.customize">
            <Drop big icon="size" title="stage.slideSize">
              {close => <>
                <MenuItem label={t('stage.size169')} active={deck.w / deck.h > 1.5} onClick={() => { close(); commit(resizeDeck(deckRef.current, SIZE_16_9)); }} />
                <MenuItem label={t('stage.size43')} active={deck.w / deck.h < 1.5} onClick={() => { close(); commit(resizeDeck(deckRef.current, SIZE_4_3)); }} />
              </>}
            </Drop>
            <Drop big icon="pagecolor" title="stage.background">
              {close => <>
                <span className="kicker">{t('stage.themeColors')}</span>
                <div className="st-swatches">
                  {themeColors.map((c, i) => <button key={i} type="button" style={{ background: c }} onClick={() => { close(); setBg({ color: c }); }} />)}
                  {deck.theme.accents.slice(0, 6).map((c, i) => <button key={`g${i}`} type="button" style={{ background: `linear-gradient(135deg, ${c}, ${shade(c, -0.55)})` }} onClick={() => { close(); setBg({ color: c, to: shade(c, -0.55), angle: 135 }); }} />)}
                </div>
                <hr />
                <ColorGrid onPick={c => { close(); if (c) setBg({ color: c }); }} />
                <hr />
                <MenuItem label={t('stage.bgReset')} onClick={() => { close(); setBg(null); }} />
                <MenuItem label={t('stage.bgAll')} onClick={() => { close(); const d = deckRef.current; commit({ ...d, slides: d.slides.map(s => ({ ...s, bg: slide.bg })) }); }} />
              </>}
            </Drop>
          </Group>
        </>}

        {shownTab === 'transitions' && <>
          <Group label="stage.group.transition">
            <div className="st-trans">
              {TRANSITIONS.map(tr => (
                <button key={tr} type="button" className={(slide.transition ?? 'none') === tr ? 'on' : ''} onClick={() => setTransition(tr)}>
                  <span className={`tr-ico tr-${tr}`}><i /></span>{t(`stage.tr.${tr}` as MessageKey)}
                </button>
              ))}
            </div>
          </Group>
          <Group label="stage.group.timing">
            <div className="stack">
              <Drop icon="spacing" title="stage.speed" text>
                {close => (['fast', 'med', 'slow'] as const).map(s => <MenuItem key={s} label={t(`stage.speed.${s}` as MessageKey)} active={(slide.speed ?? 'med') === s} onClick={() => { close(); changeSlide(x => ({ ...x, speed: s })); }} />)}
              </Drop>
              <Btn icon="check" title="stage.applyAll" text onClick={transitionAll} />
              <Btn icon="play" title="stage.preview" text onClick={() => setShow({ start: active, presenter: false })} />
            </div>
          </Group>
        </>}

        {shownTab === 'animations' && (
          <AnimTab deck={deck} slide={slide} sel={sel} setSel={setSel} kind={animKind} setKind={setAnimKind}
            changeSlide={fn => changeSlide(fn)} changeDeck={fn => commit(fn(deckRef.current))} addAnimated={addAnimated}
            preview={startPreview} previewing={!!preview} show={() => setShow({ start: active, presenter: false })}
            copilot={() => setCopilot(true)} notify={m => shell.notify(m)} />
        )}

        {shownTab === 'show' && <>
          <Group label="stage.group.start">
            <Btn big icon="play" title="stage.fromStart" onClick={() => setShow({ start: 0, presenter: false })} />
            <Btn big icon="next" title="stage.fromCurrent" onClick={() => setShow({ start: active, presenter: false })} />
            <Btn big icon="desktop" title="stage.presenter" onClick={() => setShow({ start: active, presenter: true })} />
          </Group>
          <Group label="stage.group.setup">
            <Btn big icon="alt" title="stage.hideSlide" active={!!slide.hidden} onClick={() => changeSlide(s => ({ ...s, hidden: !s.hidden || undefined }))} />
          </Group>
        </>}

        {shownTab === 'review' && <>
          <Group label="letter.group.proofing">
            <Btn big icon="spell" title="letter.spelling" active={proof.spell} onClick={() => setProof({ spell: !proof.spell })} />
            <ProofButtons editor={editor} ai={shell.ai} lang={proof.lang} notify={m => shell.notify(m)} />
          </Group>
          <Group label="letter.group.language">
            <Drop big icon="language" title="letter.language">
              {close => PROOF_TAGS.map(l => (
                <MenuItem key={l} active={proof.lang === l} label={new Intl.DisplayNames([document.documentElement.lang || 'en'], { type: 'language' }).of(l) ?? l}
                  onClick={() => { setProof({ lang: proof.lang === l ? '' : l }); close(); }} />
              ))}
            </Drop>
          </Group>
        </>}

        {shownTab === 'view' && <>
          <Group label="letter.group.show">
            <Btn big icon="comment" title="stage.notes" active={notesOpen} onClick={() => { setNotesOpen(o => { shell.storage.set('notes', o ? '0' : '1'); return !o; }); }} />
          </Group>
          <Group label="letter.group.zoom">
            <Btn big icon="onepage" title="stage.fit" active={zoom === 'fit'} onClick={() => setZoom('fit')} />
            <Btn big icon="zoomin" title="letter.zoom100" active={zoom === 1} onClick={() => setZoom(1)} />
          </Group>
        </>}

        {shownTab === 'oi1' && <>
          <Group label="stage.group.withLetter">
            <Drop big icon="letter" title="stage.toLetter">
              {close => <>
                {letters.map(x => <MenuItem key={x.tabId} label={x.title} onClick={() => { close(); void outlineToLetter(x.tabId); }} />)}
                {letters.length > 0 && <hr />}
                <MenuItem label={t('class.newLetter')} onClick={() => { close(); void outlineToLetter(null); }} />
              </>}
            </Drop>
          </Group>
          <Group label="stage.group.withClass">
            <Drop big icon="sheet" title="stage.fromClass">
              {close => <>
                {sheets.map(x => <MenuItem key={x.tabId} label={x.title} onClick={() => { close(); void tableFromClass(x.tabId); }} />)}
                {!sheets.length && <MenuItem label={t('stage.noSheets')} onClick={() => { close(); shell.openModule('class'); }} />}
              </>}
            </Drop>
            <Btn big icon="sync" title="stage.tableToClass" onClick={tableToClass} disabled={!tableSel} />
          </Group>
          <Group label="letter.group.withProdfos">
            <Btn big icon="pdf" title="letter.savePdf" onClick={print} />
          </Group>
          <Group label="letter.group.apps">
            <div className="app-keys">
              {shell.apps().filter(a => a.id !== 'stage').map(a => (
                <button key={a.id} type="button" className="app-key" disabled={!a.ready} onClick={() => shell.openModule(a.id)}
                  style={{ '--accent': a.color } as CSSProperties} title={a.ready ? a.name : `${a.name} (${t('home.soon')})`}>
                  <i />{a.name.replace('Office ', '')}
                </button>
              ))}
            </div>
          </Group>
          <Group label="letter.group.share">
            <Btn big icon="share" title="letter.share" onClick={() => void share()} />
            <Btn big icon="print" title="letter.print" onClick={print} />
          </Group>
        </>}

        {shownTab === 'format' && <>
          <Group label="stage.group.shapeStyles">
            <Drop big icon="fill" title="stage.fill" disabled={!selected.some(i => i.kind === 'shape')}>{swatches(setFill, 'letter.noColor')}</Drop>
            <Drop big icon="pen" title="stage.outline">
              {close => <>
                {swatches(c => setLine(c ? { color: c } : null), 'letter.border.none')(close)}
                <hr />
                <span className="kicker">{t('stage.weight')}</span>
                {[0.75, 1.5, 2.25, 3, 4.5, 6].map(w => <MenuItem key={w} label={`${w} pt`} onClick={() => { close(); setLine({ width: w }); }} />)}
                <hr />
                <span className="kicker">{t('stage.dashes')}</span>
                {(['solid', 'dash', 'dot'] as const).map(d => <MenuItem key={d} label={t(`stage.dash.${d}` as MessageKey)} onClick={() => { close(); setLine({ dash: d }); }} />)}
              </>}
            </Drop>
          </Group>
          <Group label="stage.arrange">
            <div className="stack">
              <Btn icon="up" title="stage.front" text onClick={() => arrange('front')} />
              <Btn icon="down" title="stage.back" text onClick={() => arrange('back')} />
            </div>
            <Drop big icon="left" title="stage.align">
              {close => (['left', 'center', 'right', 'top', 'middle', 'bottom'] as const).map(a => <MenuItem key={a} label={t(`stage.align.${a}` as MessageKey)} onClick={() => { close(); align(a); }} />)}
            </Drop>
            <Drop big icon="rotate" title="stage.rotate">
              {close => <>
                <MenuItem label={t('stage.rotRight')} onClick={() => { close(); changeItems(sel, it => ({ ...it, rot: (((it.rot ?? 0) + 90) % 360) || undefined })); }} />
                <MenuItem label={t('stage.rotLeft')} onClick={() => { close(); changeItems(sel, it => ({ ...it, rot: (((it.rot ?? 0) + 270) % 360) || undefined })); }} />
                <MenuItem label={t('stage.flipH')} onClick={() => { close(); changeItems(sel, it => ({ ...it, flipH: !it.flipH || undefined })); }} />
                <MenuItem label={t('stage.flipV')} onClick={() => { close(); changeItems(sel, it => ({ ...it, flipV: !it.flipV || undefined })); }} />
              </>}
            </Drop>
          </Group>
          {one && (
            <Group label="letter.size">
              <div className="rows">
                <NumberBox label={t('stage.height')} value={Math.round(one.h * 2.54 / 96 * 100) / 100} step={0.1} min={0} unit="cm"
                  onChange={v => changeItems([one.id], it => ({ ...it, h: Math.round(v / 2.54 * 96), ...(it.kind === 'image' && it.h ? { w: Math.round(it.w * (v / 2.54 * 96) / it.h) } : {}) }))} />
                <NumberBox label={t('stage.width')} value={Math.round(one.w * 2.54 / 96 * 100) / 100} step={0.1} min={0} unit="cm"
                  onChange={v => changeItems([one.id], it => ({ ...it, w: Math.round(v / 2.54 * 96), ...(it.kind === 'image' && it.w ? { h: Math.round(it.h * (v / 2.54 * 96) / it.w) } : {}) }))} />
              </div>
            </Group>
          )}
        </>}

        {shownTab === 'table' && tableSel && <>
          <Group label="stage.group.tableStyle">
            <div className="stack">
              <Btn icon="headerrow" title="letter.headerRow" text active={tableSel.header} onClick={() => tableCmd(x => ({ ...x, header: !x.header }))} />
              <Btn icon="gridlines" title="stage.banded" text active={tableSel.banded} onClick={() => tableCmd(x => ({ ...x, banded: !x.banded }))} />
            </div>
            <Drop big icon="palette" title="stage.tableColor">{swatches(c => tableCmd(x => ({ ...x, color: c ?? undefined })), 'letter.automatic')}</Drop>
          </Group>
          <Group label="letter.group.rowsColumns">
            <div className="rows">
              <div className="row">
                <Btn icon="rowabove" title="letter.rowAbove" onClick={() => tableCmd(x => { const rows = [...x.rows]; rows.splice(at.r, 0, x.rows[0].map(() => '')); return { ...x, rows }; })} />
                <Btn icon="rowbelow" title="letter.rowBelow" onClick={() => tableCmd(x => { const rows = [...x.rows]; rows.splice(at.r + 1, 0, x.rows[0].map(() => '')); return { ...x, rows, h: x.h + Math.round(x.h / x.rows.length) }; })} />
                <Btn icon="delrow" title="letter.deleteRow" disabled={tableSel.rows.length < 2} onClick={() => tableCmd(x => ({ ...x, rows: x.rows.filter((_, i) => i !== at.r) }))} />
              </div>
              <div className="row">
                <Btn icon="colleft" title="letter.columnLeft" onClick={() => tableCmd(x => ({ ...x, cols: undefined, rows: x.rows.map(r => { const n = [...r]; n.splice(at.c, 0, ''); return n; }) }))} />
                <Btn icon="colright" title="letter.columnRight" onClick={() => tableCmd(x => ({ ...x, cols: undefined, rows: x.rows.map(r => { const n = [...r]; n.splice(at.c + 1, 0, ''); return n; }) }))} />
                <Btn icon="delcol" title="letter.deleteColumn" disabled={(tableSel.rows[0]?.length ?? 0) < 2} onClick={() => tableCmd(x => ({ ...x, cols: undefined, rows: x.rows.map(r => r.filter((_, i) => i !== at.c)) }))} />
              </div>
            </div>
          </Group>
          <Group label="stage.group.withClass">
            <Btn big icon="sheet" title={tableSel.link ? 'stage.openLinkedSheet' : 'stage.tableToClass'} onClick={tableToClass} />
            <Btn big icon="trash" title="letter.deleteTable" onClick={deleteSelected} />
          </Group>
        </>}
      </div>
    </div>
  );

  // ---------- layout ----------
  const notesBar = useRef<{ y: number; h: number } | null>(null);
  const selBox = (it: Item, soft = false) => (
    <div key={it.id} className={`st-sel${editing?.id === it.id ? ' editing' : ''}${soft ? ' soft' : ''}`}
      style={{ left: it.x * k, top: it.y * k, width: Math.max(1, it.w * k), height: Math.max(1, it.h * k), transform: it.rot ? `rotate(${it.rot}deg)` : undefined }}>
      {!soft && handles(it)}
    </div>
  );
  const linkedTable = tableSel?.link;
  const marquee = drag?.kind === 'marquee' ? drag : null;
  const sizeTip = (drag?.kind === 'resize' || drag?.kind === 'rotate') && one ? one : null;

  return (
    <div className="stage" ref={rootRef} tabIndex={-1} onKeyDown={onKey}>
      {ribbon}
      {linkedTable && (
        <div className="link-banner">
          <Icon name="link" />
          <span className="grow">{t('stage.linkedTo', { title: linkedTable.title })}</span>
          {shell.tabs().some(x => x.tabId === linkedTable.tabId) && <button type="button" onClick={() => shell.showTab(linkedTable.tabId)}>{t('stage.showSheet')}</button>}
          <button type="button" onClick={() => tableCmd(x => ({ ...x, link: undefined }))}>{t('class.unlink')}</button>
        </div>
      )}
      <div className="stage-body">
        <div className="st-rail" tabIndex={0} aria-label={t('stage.slides')}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); setActive(a => Math.min(deck.slides.length - 1, a + 1)); }
            else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
            else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSlide(); }
            else if (e.key === 'Enter') { e.preventDefault(); addSlide(); }
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSlide(); }
          }}>
          {deck.slides.map((s, i) => (
            <div key={s.id} className={`st-rail-item${i === active ? ' on' : ''}${s.hidden ? ' hidden' : ''}${railDrop?.i === i ? (railDrop.after ? ' drop-after' : ' drop-before') : ''}`}
              draggable onDragStart={e => { e.dataTransfer.setData('text/x-oi1-slide', String(i)); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={e => { if (!e.dataTransfer.types.includes('text/x-oi1-slide')) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const vertical = window.innerWidth > 720; setRailDrop({ i, after: vertical ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2 }); }}
              onDragLeave={() => setRailDrop(null)}
              onDrop={e => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData('text/x-oi1-slide'));
                const to = railDrop ? railDrop.i + (railDrop.after ? 1 : 0) : i;
                setRailDrop(null);
                if (!Number.isNaN(from)) moveSlide(from, to > from ? to - 1 : to);
              }}
              onContextMenu={e => { e.preventDefault(); setActive(i); }}>
              <span className="st-rail-num">{i + 1}</span>
              {s.transition && <span className="st-rail-trans" title={t(`stage.tr.${s.transition}` as MessageKey)}><Icon name="play" size={10} /></span>}
              <button type="button" className="st-rail-card" onClick={() => setActive(i)} aria-label={`${t('stage.slideN', { n: i + 1 })} ${slideTitle(s)}`}>
                <SlideThumb deck={deck} slide={s} width={window.innerWidth <= 720 ? 112 : 158} />
              </button>
            </div>
          ))}
          <button type="button" className="st-rail-add" onClick={() => addSlide(undefined, deck.slides.length)}>+ {t('stage.newSlide')}</button>
        </div>
        <div className="stage-main">
          {audBusy && (
            <div className="st-aud-bar busy" role="status">
              <span className="st-aud-emoji" aria-hidden="true">{audBusy.aud.emoji}</span>
              <span className="st-aud-text">{t('stage.audience.working', { who: audienceName(audBusy.aud, lang) })}</span>
              <button type="button" onClick={() => audBusy.stop.abort()}>{t('letter.cancel')}</button>
            </div>
          )}
          {adapted && !audBusy && (
            <div className="st-aud-bar" role="status">
              <span className="st-aud-emoji" aria-hidden="true">{adapted.aud.emoji}</span>
              <span className="st-aud-text"><b>{t('stage.audience.for', { who: audienceName(adapted.aud, lang) })}</b>{adapted.summary ? ` ${adapted.summary}` : ''}</span>
              <span className="st-aud-seg" role="group" aria-label={t('stage.audience.compare')}>
                <button type="button" className={adapted.showing === 'before' ? 'on' : ''} onClick={() => audShow('before')}>{t('stage.audience.before')}</button>
                <button type="button" className={adapted.showing === 'after' ? 'on' : ''} onClick={() => audShow('after')}>{t('stage.audience.after')}</button>
              </span>
              <button type="button" className="primary" onClick={audKeep}>{t('stage.audience.keep')}</button>
              <button type="button" onClick={audBack}>{t('stage.audience.back')}</button>
            </div>
          )}
          <div className="st-stage-wrap">
          <div className="st-stage" ref={stageRef}
            onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
            onDrop={e => { const files = Array.from(e.dataTransfer.files); if (files.length) { e.preventDefault(); if (files[0].name.toLowerCase().endsWith('.pptx')) void loadFile(wrapDropped(files[0])); else void addImages(files); } }}>
            <div className="st-stage-inner" style={{ width: deck.w * k, height: deck.h * k, marginTop: Math.max(0, (stageSize.h - deck.h * k) / 2), marginLeft: Math.max(0, (stageSize.w - deck.w * k) / 2) }}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
              onDoubleClick={e => {
                const id = (e.target as HTMLElement).closest<HTMLElement>('.st-canvas .st-item[data-id]')?.dataset.id;
                const it = slide.items.find(i => i.id === id);
                if (it && isText(it) && editing?.id !== it.id) startEdit(it.id);
              }}>
              <div className="st-canvas" ref={canvasRef} style={{ width: deck.w, height: deck.h, transform: `scale(${k})` }}>
                <SlideView key={preview ? `p${preview.run}-${preview.step}` : 'edit'} deck={deck} slide={slide} extras={extras} play={previewPlay} />
              </div>
              <div className="st-overlay">
                {selected.map(it => selBox(it, selected.length > 1))}
                {selected.length > 1 && (() => {
                  const x = Math.min(...selected.map(i => i.x)), y = Math.min(...selected.map(i => i.y));
                  const w = Math.max(...selected.map(i => i.x + i.w)) - x, h = Math.max(...selected.map(i => i.y + i.h)) - y;
                  return <div className="st-sel" style={{ left: x * k, top: y * k, width: w * k, height: h * k }} />;
                })()}
                {shownTab === 'animations' && !preview && animBadges()}
                {guides.v.map((x, i) => <i key={`v${i}`} className="st-guide v" style={{ left: x * k, top: 0, height: deck.h * k }} />)}
                {guides.h.map((y, i) => <i key={`h${i}`} className="st-guide h" style={{ top: y * k, left: 0, width: deck.w * k }} />)}
                {marquee && <div className="st-marquee" style={{ left: Math.min(marquee.x0, marquee.x1) * k, top: Math.min(marquee.y0, marquee.y1) * k, width: Math.abs(marquee.x1 - marquee.x0) * k, height: Math.abs(marquee.y1 - marquee.y0) * k }} />}
                {sizeTip && <span className="st-size-tip" style={{ left: (sizeTip.x + sizeTip.w / 2) * k, top: (sizeTip.y + sizeTip.h) * k + 10 }}>
                  {drag?.kind === 'rotate' ? `${sizeTip.rot ?? 0}°` : `${(sizeTip.w * 2.54 / 96).toFixed(1)} × ${(sizeTip.h * 2.54 / 96).toFixed(1)} cm`}
                </span>}
              </div>
            </div>
          </div>
          <FastScroll target={stageRef} />
          </div>
          {notesOpen && (
            <div className="st-notes" style={{ height: notesH }}>
              <div className="st-notes-bar"
                onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); notesBar.current = { y: e.clientY, h: notesH }; }}
                onPointerMove={e => { if (notesBar.current) setNotesH(Math.max(60, Math.min(window.innerHeight * 0.5, notesBar.current.h - (e.clientY - notesBar.current.y)))); }}
                onPointerUp={() => { notesBar.current = null; }}>{t('stage.notes')}</div>
              <textarea key={slide.id} defaultValue={slide.notes} placeholder={t('stage.notesPlaceholder')} aria-label={t('stage.notes')}
                onBlur={e => { if (e.target.value !== slide.notes) changeSlide(s => ({ ...s, notes: e.target.value })); }} />
            </div>
          )}
        </div>
        <ProofBubble editor={editing ? editor : null} />
        {copilot && <Copilot host={stageCopilot(bridge)} ai={shell.ai} onClose={() => { setCopilot(false); rootRef.current?.focus(); }} />}
      </div>
      <footer className="status">
        <span>{t('stage.slideOf', { n: active + 1, total: deck.slides.length })}</span>
        <span className="status-file">{fileName || `${title}.pptx`}</span>
        <button type="button" className="status-btn" onClick={() => setNotesOpen(o => !o)}>{t('stage.notes')}</button>
        <button type="button" className="status-btn" onClick={() => setShow({ start: active, presenter: false })} title={t('stage.fromCurrent')}><Icon name="play" size={13} /></button>
        <span className="status-zoom">
          <button type="button" aria-label={t('letter.zoomOut')} title={t('letter.zoomOut')} onClick={() => setZoom([...ZOOMS].reverse().find(z => z < k - 0.001) ?? ZOOMS[0])}>−</button>
          <input type="range" min={10} max={200} step={5} value={Math.round(k * 100)} aria-label={t('letter.zoom')} onChange={e => setZoom(Number(e.target.value) / 100)} onDoubleClick={() => setZoom('fit')} />
          <button type="button" aria-label={t('letter.zoomIn')} title={t('letter.zoomIn')} onClick={() => setZoom(ZOOMS.find(z => z > k + 0.001) ?? ZOOMS[ZOOMS.length - 1])}>+</button>
          <span className="pct">{Math.round(k * 100)}%</span>
          <button type="button" className="fit" title={t('ui.fitAll')} aria-label={t('ui.fitAll')} onClick={() => setZoom('fit')}><Icon name="onepage" size={13} /></button>
        </span>
      </footer>

      {askText && (
        <Dialog title={askText.title} onClose={() => setAskText(null)} onOk={() => askText.ok(askText.value)}>
          <input className="st-ask" autoFocus value={askText.value} aria-label={askText.title} onChange={e => setAskText({ ...askText, value: e.target.value })} />
        </Dialog>
      )}
      <input ref={imageInput} type="file" accept={IMAGE_TYPES.join(',')} multiple hidden onChange={e => { void addImages(Array.from(e.target.files ?? [])); e.target.value = ''; }} />

      {show && <Show deck={deck} start={show.start} presenter={show.presenter} onEnd={i => { setShow(null); setActive(i); rootRef.current?.focus(); }} />}

      {printing && createPortal(
        <div className="st-print">
          {deck.slides.filter(s => !s.hidden).map(s => (
            <div key={s.id} className="st-print-page" style={{ width: `${deck.w / 96}in`, height: `${deck.h / 96}in` }}>
              <SlideView deck={deck} slide={s} />
            </div>
          ))}
        </div>, document.body)}

      {panel === 'file' && (
        <FileMenu fileName={fileName || `${title}.pptx`} onClose={() => setPanel(null)}
          onNew={() => shell.openModule('stage')} onOpen={() => void openFile()} onSave={() => void save()}
          onPrint={() => { setPanel(null); print(); }}
          saveChoices={[
            { id: 'pptx', icon: 'save', label: t('stage.format.pptx'), hint: '.pptx' },
            { id: 'pdf', icon: 'pdf', label: t('stage.format.pdf'), hint: '.pdf' },
            { id: 'letter', icon: 'letter', label: t('stage.format.outline'), hint: 'Office Letter' },
          ]}
          onSaveAs={f => (f === 'pptx' ? void save(true) : f === 'pdf' ? print() : void outlineToLetter(null))}
          listRecent={shell.recent.list} onOpenRecent={r => void openRecent(r)} />
      )}
    </div>
  );
}

function wrapDropped(f: File): OpenedFile {
  return { name: f.name, type: f.type, text: () => f.text(), arrayBuffer: () => f.arrayBuffer() };
}

function TablePicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ r: 2, c: 3 });
  return (
    <div className="table-grid" onMouseLeave={() => setHover({ r: 0, c: 0 })}>
      <span className="kicker">{hover.c} × {hover.r}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 18px)', gap: 3, padding: 8 }}>
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8) + 1, c = (i % 8) + 1;
          const on = r <= hover.r && c <= hover.c;
          return <button key={i} type="button" aria-label={`${c} × ${r}`} onMouseEnter={() => setHover({ r, c })} onClick={() => onPick(r, c)}
            style={{ width: 18, height: 18, padding: 0, borderRadius: 4, border: `1px solid ${on ? 'var(--gold)' : 'var(--line)'}`, background: on ? 'rgba(212,168,67,.25)' : 'transparent' }} />;
        })}
      </div>
    </div>
  );
}

export type { ReactNode };

/** A theme's name in the user's language; themes from files or Copilot keep their own. */
export function themeName(th: DeckTheme): string {
  const key = `stage.theme.${th.id}` as MessageKey;
  return (th.group !== 'mine' && th.id !== 'file' && t(key)) || th.name;
}

/** The small picture of a theme in the gallery: its background, decorations, title font and colors. */
function ThemeChip({ th }: { th: DeckTheme }) {
  return (
    <span className="st-theme-chip" style={{ background: cssBackground(th.bg) }}>
      {(th.deco ?? []).map((d, i) => {
        const style: CSSProperties = { left: `${d.x * 100}%`, top: `${d.y * 100}%`, width: `${d.w * 100}%`, height: `${d.h * 100}%`, opacity: d.opacity ?? 1, transform: d.rot ? `rotate(${d.rot}deg)` : undefined };
        if (d.geom && d.geom !== 'rect' && d.geom !== 'ellipse') {
          return <svg key={i} className="st-chip-deco" style={style} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={geomPath(d.geom, 100, 100)} fill={d.color} /></svg>;
        }
        return <span key={i} className="st-chip-deco" style={{ ...style, background: d.to ? `linear-gradient(90deg, ${d.color}, ${d.to})` : d.color, borderRadius: d.round || d.geom === 'ellipse' ? '50%' : undefined }} />;
      })}
      <b style={{ color: th.title, fontFamily: cssFont(th.head) }}>Aa</b>
      {th.accents.slice(0, 4).map((c, i) => <i key={i} style={{ left: 8 + i * 15, background: c }} />)}
    </span>
  );
}
