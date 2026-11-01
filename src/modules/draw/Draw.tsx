// In 1 Draw: drawing for everyone, on a computer, a tablet or a phone. Free hand with a pen, a marker or a
// highlighter, clean shapes, lines and arrows, text, pictures and stickers; 26 ready drawings (flowchart, mind map,
// org chart, floor plan, cards…), pages and papers, colour sets. Beyond a usual drawing app: "Tidy" turns a sketched
// circle, box, triangle or line into a clean shape offline, and "Draw with AI" turns words into editable shapes.
// Saves as .svg (with its shapes inside, to edit again), and as PNG, JPEG or PDF.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { FileRef, Handoff, OpenedFile, RecentFile, ShellApi } from '../../shell/contract';
import { getLanguage, t, type MessageKey } from '../../shell/i18n';
import { useLanguage } from '../../shell/useLanguage';
import { Btn, ColorGrid, Dialog, Drop, Group, Icon, MenuItem, RibbonToggle } from '../../ui/kit';
import { AppKeys, appColor } from '../../ui/AppKeys';
import { FileMenu } from '../../ui/FileMenu';
import { TutoTab } from '../../ui/tuto/Tuto';
import { Copilot, CopilotButton, useCopilotShortcut, type CopilotHost } from '../../ui/Copilot';
import { usePinchZoom } from '../../ui/pinch';
import { closeRibbonPeek } from '../../ui/ribbonMin';
import { FastScroll } from '../../ui/FastScroll';
import { ConvertPanel } from '../../ui/convert/ConvertPanel';
import type { ConvertSource } from '../../shell/convert';
import { aiTranslator, bestTranslator } from '../../shell/translate';
import { geomPath } from '../stage/geom';
import {
  BACKGROUNDS, DEFAULT_STYLE, FONTS, PALETTES, PAPERS, SHAPE_GEOMS, SIZES, STICKERS, TEXT_SIZES, WIDTHS,
  bounds, cleanShape, fitShape, fromSvg, isBox, moveShape, newDrawing, newId, paperSvg, recognize, sanitize, shapeSvg, simplify, toSvg, unionBox,
  type Box, type Dash, type Drawing, type GeomShape, type LineShape, type PaperId, type PathShape, type Shape, type Style, type TextShape,
} from './model';
import { TEMPLATES } from './templates';
import { drawWithAi } from './ai';
import type { Geom } from '../../formats/slides';

export const EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
type Tool = 'select' | 'hand' | 'pen' | 'marker' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'shape' | 'text';
type Tab = 'home' | 'insert' | 'arrange' | 'design' | 'ai' | 'view' | 'oi1' | 'convert';
interface Saved { doc: Drawing; name: string }
type Drag =
  | { kind: 'move'; x0: number; y0: number; start: Drawing; moved: boolean }
  | { kind: 'scale'; hx: number; hy: number; box: Box; start: Drawing }
  | { kind: 'rotate'; id: string; cx: number; cy: number; start: Drawing }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; add: string[] }
  | { kind: 'draw'; id: string; start: Drawing; x0: number; y0: number }
  | { kind: 'erase'; start: Drawing; gone: Set<string> }
  | { kind: 'pan'; x0: number; y0: number; sl: number; st: number };

const TOOLS: { id: Tool; icon: string; key: string }[] = [
  { id: 'select', icon: 'select', key: 'v' }, { id: 'hand', icon: 'hand', key: 'h' }, { id: 'pen', icon: 'pen', key: 'p' }, { id: 'marker', icon: 'marker', key: 'm' },
  { id: 'highlighter', icon: 'highlighter', key: 'i' }, { id: 'eraser', icon: 'eraser', key: 'e' }, { id: 'line', icon: 'line', key: 'l' }, { id: 'arrow', icon: 'arrowTool', key: 'a' },
  { id: 'shape', icon: 'rectTool', key: 'r' }, { id: 'text', icon: 'textTool', key: 't' },
];
const OPACITIES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
const ZOOMS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export default function Draw({ shell, file, handoff }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff }) {
  const [initial, setInitial] = useState<Saved | null>(null);
  useEffect(() => {
    void (async () => {
      let saved: Saved | null = null;
      if (!file && !handoff) try {
        const raw = await shell.storage.load('drawing');
        if (raw) { const o = JSON.parse(raw) as Saved; saved = { doc: sanitize(o.doc), name: typeof o.name === 'string' ? o.name : '' }; }
      } catch { /* unreadable autosave */ }
      setInitial(saved ?? { doc: newDrawing(), name: '' });
    })();
  }, [shell, file, handoff]);
  if (!initial) return <div className="draw" />;
  return <DrawEditor shell={shell} file={file} handoff={handoff} initial={initial} />;
}

function readDataUrl(f: Blob): Promise<string> {
  return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(r.error); r.readAsDataURL(f); });
}
function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise(ok => { const i = new Image(); i.onload = () => ok({ w: i.naturalWidth || 400, h: i.naturalHeight || 300 }); i.onerror = () => ok({ w: 400, h: 300 }); i.src = src; });
}

/** The drawing as a PNG or JPEG picture (scale 2: sharp on screens and in print). */
export async function rasterize(d: Drawing, type: 'image/png' | 'image/jpeg' = 'image/png', scale = 2): Promise<Blob> {
  const svg = toSvg(d, false);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, no) => { img.onload = () => ok(); img.onerror = () => no(new Error('svg')); img.src = url; });
    const c = document.createElement('canvas');
    const k = Math.min(scale, 8000 / Math.max(d.w, d.h));
    c.width = Math.round(d.w * k); c.height = Math.round(d.h * k);
    const g = c.getContext('2d')!;
    g.fillStyle = d.background; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, no) => c.toBlob(b => (b ? ok(b) : no(new Error('png'))), type, 0.92));
  } finally { URL.revokeObjectURL(url); }
}

async function pdfOf(d: Drawing): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const png = await pdf.embedPng(await (await rasterize(d)).arrayBuffer());
  const w = d.w * 0.75, h = d.h * 0.75; // px to pt
  pdf.addPage([w, h]).drawImage(png, { x: 0, y: 0, width: w, height: h });
  return new Blob([await pdf.save() as BlobPart], { type: 'application/pdf' });
}

function DrawEditor({ shell, file, handoff, initial }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff; initial: Saved }) {
  useLanguage();
  const lang = getLanguage();
  const [doc, setDoc] = useState<Drawing>(initial.doc);
  const docRef = useRef(doc);
  docRef.current = doc;
  const [sel, setSel] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [geom, setGeom] = useState<Geom>('rect');
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [font, setFont] = useState({ font: 'Inter', size: 40, bold: false, italic: false });
  const [tab, setTab] = useState<Tab>('home');
  const [zoom, setZoomState] = useState<number | 'fit'>('fit');
  const [snap, setSnap] = useState(false);
  const [layers, setLayers] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [fileName, setFileName] = useState(initial.name);
  const [fileRef, setFileRef] = useState<FileRef | undefined>();
  const [panel, setPanel] = useState<'file' | null>(null);
  const [copilot, setCopilot] = useState(false);
  const [aiAsk, setAiAsk] = useState<{ text: string; busy: boolean; error: string; written: number } | null>(null);
  const [note, setNote] = useState('');
  const undo = useRef<Drawing[]>([]);
  const redo = useRef<Drawing[]>([]);
  const [, bump] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const clip = useRef<Shape[]>([]);
  const ctl = useRef<AbortController | null>(null);

  // ---------- zoom ----------
  const [area, setArea] = useState({ w: 800, h: 600 });
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setArea({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setArea({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const fitK = Math.max(0.05, Math.min((area.w - 32) / doc.w, (area.h - 32) / doc.h));
  const k = zoom === 'fit' ? fitK : zoom;
  const kRef = useRef(k);
  kRef.current = k;
  const setZoom = (z: number | 'fit') => setZoomState(z === 'fit' ? 'fit' : Math.max(0.05, Math.min(8, z)));
  usePinchZoom(scroller, () => kRef.current, z => setZoom(z), { min: 0.05, max: 8 });

  // ---------- changes and undo ----------
  const commit = useCallback((next: Drawing, before: Drawing = docRef.current) => {
    if (next === before) return;
    undo.current.push(before);
    if (undo.current.length > 200) undo.current.shift();
    redo.current = [];
    setDoc(next);
    bump(n => n + 1);
  }, []);
  const change = (fn: (shapes: Shape[]) => Shape[]) => commit({ ...docRef.current, shapes: fn(docRef.current.shapes) });
  const changeSel = (fn: (s: Shape) => Shape) => { const ids = new Set(sel); change(list => list.map(s => (ids.has(s.id) && !s.locked ? fn(s) : s))); };
  const undoOnce = () => { const p = undo.current.pop(); if (!p) return; redo.current.push(docRef.current); setDoc(p); setSel(s => s.filter(id => p.shapes.some(x => x.id === id))); bump(n => n + 1); };
  const redoOnce = () => { const n = redo.current.pop(); if (!n) return; undo.current.push(docRef.current); setDoc(n); bump(x => x + 1); };

  // ---------- saving ----------
  const title = fileName ? fileName.replace(/\.[^.]+$/, '') : t('draw.untitled');
  useEffect(() => { shell.setTitle(title.slice(0, 40)); }, [shell, title]);
  const saveTimer = useRef(0);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void shell.storage.save('drawing', JSON.stringify({ doc, name: fileName } satisfies Saved)); }, 600);
  }, [doc, fileName, shell]);
  useEffect(() => {
    shell.onRename?.(name => setFileName(`${name}.svg`));
    return () => shell.onRename?.(null);
  }, [shell]);
  const baseName = () => title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'drawing';
  const svgBlob = async () => new Blob([toSvg(docRef.current)], { type: 'image/svg+xml' });
  const save = async (saveAs = false) => {
    const name = fileName.toLowerCase().endsWith('.svg') ? fileName : `${baseName()}.svg`;
    const ref = await shell.saveFile(name, svgBlob, 'image/svg+xml', { target: fileRef, saveAs });
    if (ref) { setFileRef(ref); setFileName(ref.name); }
  };
  const exportAs = async (f: 'svg' | 'png' | 'jpg' | 'pdf') => {
    if (f === 'svg') { void save(true); return; }
    const type = f === 'pdf' ? 'application/pdf' : f === 'png' ? 'image/png' : 'image/jpeg';
    await shell.saveFile(`${baseName()}.${f}`, () => (f === 'pdf' ? pdfOf(docRef.current) : rasterize(docRef.current, type as 'image/png')), type, { saveAs: true });
  };
  const quietSave = useRef<() => Promise<FileRef | null>>(async () => null);
  quietSave.current = async () => {
    const own = !!fileRef?.handle && fileName.toLowerCase().endsWith('.svg');
    if (!own && !shell.cloudOn?.()) return null;
    return shell.saveFile(own ? fileName : `${baseName()}.svg`, svgBlob, 'image/svg+xml', { target: own ? fileRef : undefined, quiet: true });
  };
  useEffect(() => { shell.autoSave(() => quietSave.current()); return () => shell.autoSave(null); }, [shell]);

  // ---------- adding things ----------
  const center = (w: number, h: number) => ({ x: Math.round(docRef.current.w / 2 - w / 2), y: Math.round(docRef.current.h / 2 - h / 2) });
  const add = (shapes: Shape[], select = true) => {
    if (!shapes.length) return;
    change(list => [...list, ...shapes]);
    if (select) { setSel(shapes.map(s => s.id)); setTool('select'); }
  };
  const addImages = async (files: Blob[]) => {
    const out: Shape[] = [];
    for (const f of files) {
      if (!IMAGE_TYPES.includes(f.type)) continue;
      const src = await readDataUrl(f);
      const { w, h } = await imageSize(src);
      const s = Math.min(1, (docRef.current.w * 0.6) / w, (docRef.current.h * 0.6) / h);
      out.push({ id: newId(), kind: 'image', ...center(w * s, h * s), w: w * s, h: h * s, rot: 0, src, ...DEFAULT_STYLE, fill: null, stroke: null, width: 0 });
    }
    add(out);
  };
  const loadFile = async (f: OpenedFile) => {
    const name = f.name.toLowerCase();
    if (name.endsWith('.svg')) {
      const text = await f.text();
      const d = fromSvg(text);
      if (d) { commit(d); setSel([]); setFileName(f.name); setFileRef(f); return; }
      // Any other SVG: one picture of it.
      const src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
      const { w, h } = await imageSize(src);
      const s = Math.min(1, (docRef.current.w * 0.8) / w, (docRef.current.h * 0.8) / h);
      // An SVG picture is drawn through <image>, which never runs its scripts.
      add([{ id: newId(), kind: 'image', ...center(w * s, h * s), w: w * s, h: h * s, rot: 0, src, ...DEFAULT_STYLE, fill: null, stroke: null, width: 0 }]);
      return;
    }
    const buf = await f.arrayBuffer();
    const type = name.endsWith('.png') ? 'image/png' : name.endsWith('.gif') ? 'image/gif' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    await addImages([new Blob([buf], { type })]);
  };
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (file) void loadFile(file);
    if (handoff?.kind === 'file') void loadFile(handoff.file);
    if (handoff?.kind === 'html') {
      const words = new DOMParser().parseFromString(handoff.html, 'text/html').body.textContent?.trim();
      if (words) add([{ id: newId(), kind: 'text', ...center(doc.w * 0.8, 80), w: doc.w * 0.8, h: 80, rot: 0, text: words.slice(0, 400), font: 'Inter', size: 48, bold: true, italic: false, align: 'center', ...DEFAULT_STYLE, fill: '#1B1B1F', stroke: null, width: 0 }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addTemplate = async (id: string) => {
    const tpl = TEMPLATES.find(x => x.id === id);
    if (!tpl) return;
    const en = lang === 'fr' ? 1 : 0;
    const words: string[] = [];
    let shapes = tpl.build(docRef.current, l => { words.push(l[en]); return l[en]; });
    if (lang !== 'en' && lang !== 'fr') {
      try {
        const tr = await bestTranslator(lang, 'en', () => aiTranslator(shell.ai, lang));
        if (tr) {
          const texts = shapes.map(s => (s.kind === 'text' ? s.text : s.kind === 'geom' ? s.text ?? '' : ''));
          const idx = texts.map((x, i) => (/\p{L}{2,}/u.test(x) ? i : -1)).filter(i => i >= 0);
          const got = await tr(idx.map(i => texts[i]));
          shapes = shapes.map((s, i) => { const j = idx.indexOf(i); if (j < 0 || !got[j]) return s; return s.kind === 'text' ? { ...s, text: got[j] } : { ...s, text: got[j] } as Shape; });
        }
      } catch { /* stays in English */ }
    }
    add(shapes);
  };

  // ---------- pointer on the page ----------
  const pagePoint = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    let x = (e.clientX - r.left) / kRef.current, y = (e.clientY - r.top) / kRef.current;
    if (snap) { x = Math.round(x / 20) * 20; y = Math.round(y / 20) * 20; }
    return { x, y };
  };
  const shapeAt = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.('[data-id]');
    const id = el?.getAttribute('data-id');
    return id ? docRef.current.shapes.find(s => s.id === id) ?? null : null;
  };
  const selBox = useMemo(() => unionBox(doc.shapes.filter(s => sel.includes(s.id)).map(bounds)), [doc, sel]);

  const down = (e: React.PointerEvent) => {
    // A tap outside the text being typed ends the typing and keeps the words (blur saves them).
    if (editing) { (document.activeElement as HTMLElement | null)?.blur?.(); e.preventDefault(); return; }
    if (e.button === 2) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = pagePoint(e);
    const before = docRef.current;
    const handle = (e.target as Element).getAttribute?.('data-handle');
    if (handle === 'rot' && sel.length === 1) {
      const s = before.shapes.find(x => x.id === sel[0]);
      if (s && isBox(s)) { setDrag({ kind: 'rotate', id: s.id, cx: s.x + s.w / 2, cy: s.y + s.h / 2, start: before }); return; }
    }
    if (handle && selBox) {
      const [hx, hy] = handle.split(',').map(Number);
      setDrag({ kind: 'scale', hx, hy, box: selBox, start: before });
      return;
    }
    if (tool === 'hand' || e.button === 1) {
      const sc = scroller.current!;
      setDrag({ kind: 'pan', x0: e.clientX, y0: e.clientY, sl: sc.scrollLeft, st: sc.scrollTop });
      return;
    }
    if (tool === 'select') {
      const hit = shapeAt(e.target);
      if (hit) {
        const next = e.shiftKey || e.ctrlKey || e.metaKey ? (sel.includes(hit.id) ? sel.filter(x => x !== hit.id) : [...sel, hit.id]) : sel.includes(hit.id) ? sel : [hit.id];
        setSel(next);
        setDrag({ kind: 'move', x0: p.x, y0: p.y, start: before, moved: false });
      } else {
        setSel(e.shiftKey ? sel : []);
        setDrag({ kind: 'marquee', x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: e.shiftKey ? sel : [] });
      }
      return;
    }
    if (tool === 'eraser') {
      const hit = shapeAt(e.target);
      const gone = new Set<string>(hit && !hit.locked ? [hit.id] : []);
      if (gone.size) setDoc(d => ({ ...d, shapes: d.shapes.filter(s => !gone.has(s.id)) }));
      setDrag({ kind: 'erase', start: before, gone });
      return;
    }
    const id = newId();
    let shape: Shape;
    if (tool === 'pen' || tool === 'marker' || tool === 'highlighter') {
      const hl = tool === 'highlighter';
      shape = { id, kind: 'path', points: [p.x, p.y], ...style, fill: null, stroke: hl ? (style.stroke && style.stroke !== '#2B2D42' ? style.stroke : '#FFE14D') : style.stroke,
        width: tool === 'marker' ? Math.max(8, style.width * 3) : hl ? Math.max(18, style.width * 6) : style.width, opacity: hl ? 0.45 : style.opacity, ...(hl ? { marker: true } : {}) };
    } else if (tool === 'line' || tool === 'arrow') {
      shape = { id, kind: 'line', x1: p.x, y1: p.y, x2: p.x, y2: p.y, head: tool === 'arrow' ? 'end' : 'none', ...style, fill: null };
    } else if (tool === 'text') {
      const s: TextShape = { id, kind: 'text', x: p.x, y: p.y - font.size * 0.6, w: Math.max(200, font.size * 8), h: font.size * 1.3, rot: 0, text: '', font: font.font, size: font.size, bold: font.bold, italic: font.italic, align: 'left', ...style, fill: style.stroke ?? '#1B1B1F', stroke: null, width: 0 };
      setDoc(d => ({ ...d, shapes: [...d.shapes, s] }));
      undo.current.push(before); redo.current = [];
      setSel([id]); setEditing(id);
      return;
    } else {
      shape = { id, kind: 'geom', geom, x: p.x, y: p.y, w: 1, h: 1, rot: 0, ...style };
    }
    setDoc(d => ({ ...d, shapes: [...d.shapes, shape] }));
    setDrag({ kind: 'draw', id, start: before, x0: p.x, y0: p.y });
  };

  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pagePoint(e);
    if (drag.kind === 'pan') { const sc = scroller.current!; sc.scrollLeft = drag.sl - (e.clientX - drag.x0); sc.scrollTop = drag.st - (e.clientY - drag.y0); return; }
    if (drag.kind === 'move') {
      const ids = new Set(sel);
      const dx = p.x - drag.x0, dy = p.y - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) * kRef.current < 3) return;
      setDoc({ ...drag.start, shapes: drag.start.shapes.map(s => (ids.has(s.id) && !s.locked ? moveShape(s, dx, dy) : s)) });
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    if (drag.kind === 'scale') {
      const b = drag.box;
      let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
      if (drag.hx === 0) x0 = Math.min(p.x, x1 - 4); if (drag.hx === 2) x1 = Math.max(p.x, x0 + 4);
      if (drag.hy === 0) y0 = Math.min(p.y, y1 - 4); if (drag.hy === 2) y1 = Math.max(p.y, y0 + 4);
      if (e.shiftKey && drag.hx !== 1 && drag.hy !== 1) { const r = b.w / (b.h || 1); if ((x1 - x0) / (y1 - y0 || 1) > r) { const w = (y1 - y0) * r; if (drag.hx === 0) x0 = x1 - w; else x1 = x0 + w; } else { const h = (x1 - x0) / r; if (drag.hy === 0) y0 = y1 - h; else y1 = y0 + h; } }
      const to = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      const ids = new Set(sel);
      setDoc({ ...drag.start, shapes: drag.start.shapes.map(s => (ids.has(s.id) && !s.locked ? fitShape(s, b, to) : s)) });
      return;
    }
    if (drag.kind === 'rotate') {
      let a = (Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180) / Math.PI + 90;
      if (e.shiftKey || snap) a = Math.round(a / 15) * 15;
      a = Math.round(((a % 360) + 360) % 360);
      setDoc({ ...drag.start, shapes: drag.start.shapes.map(s => (s.id === drag.id && isBox(s) ? { ...s, rot: a } : s)) });
      return;
    }
    if (drag.kind === 'marquee') { setDrag({ ...drag, x1: p.x, y1: p.y }); return; }
    if (drag.kind === 'erase') {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const hit = shapeAt(el);
      if (hit && !hit.locked && !drag.gone.has(hit.id)) { drag.gone.add(hit.id); setDoc(d => ({ ...d, shapes: d.shapes.filter(s => s.id !== hit.id) })); }
      return;
    }
    if (drag.kind === 'draw') {
      setDoc(d => ({ ...d, shapes: d.shapes.map(s => {
        if (s.id !== drag.id) return s;
        if (s.kind === 'path') return { ...s, points: [...s.points, p.x, p.y] };
        if (s.kind === 'line') {
          let x2 = p.x, y2 = p.y;
          if (e.shiftKey) { const a = Math.round(Math.atan2(y2 - s.y1, x2 - s.x1) / (Math.PI / 4)) * (Math.PI / 4), r = Math.hypot(x2 - s.x1, y2 - s.y1); x2 = s.x1 + Math.cos(a) * r; y2 = s.y1 + Math.sin(a) * r; }
          return { ...s, x2, y2 };
        }
        if (s.kind === 'geom') {
          let w = p.x - drag.x0, h = p.y - drag.y0;
          if (e.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
          return { ...s, x: Math.min(drag.x0, drag.x0 + w), y: Math.min(drag.y0, drag.y0 + h), w: Math.abs(w), h: Math.abs(h) };
        }
        return s;
      }) }));
    }
  };

  const up = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.kind === 'pan') return;
    if (d.kind === 'marquee') {
      const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
      if (x1 - x0 < 2 && y1 - y0 < 2) return;
      const inside = docRef.current.shapes.filter(s => { const b = bounds(s); return !s.hidden && b.x >= x0 && b.y >= y0 && b.x + b.w <= x1 && b.y + b.h <= y1; }).map(s => s.id);
      setSel([...new Set([...d.add, ...inside])]);
      return;
    }
    if (d.kind === 'move' && !d.moved) return;
    if (d.kind === 'erase' && !d.gone.size) return;
    let now = docRef.current;
    if (d.kind === 'draw') {
      const s = now.shapes.find(x => x.id === d.id);
      // A click without dragging: a shape of a usual size; a dot for the pen; nothing for a line.
      if (s?.kind === 'geom' && s.w < 4 && s.h < 4) now = { ...now, shapes: now.shapes.map(x => (x.id === d.id ? { ...s, x: s.x - 80, y: s.y - 60, w: 160, h: 120 } : x)) };
      else if (s?.kind === 'line' && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 3) now = { ...now, shapes: now.shapes.filter(x => x.id !== d.id) };
      else if (s?.kind === 'path') now = { ...now, shapes: now.shapes.map(x => (x.id === d.id ? { ...s, points: simplify(s.points, 0.6) } : x)) };
      setDoc(now);
      if ((tool === 'shape' || tool === 'line' || tool === 'arrow') && now.shapes.some(x => x.id === d.id)) setSel([d.id]);
    }
    undo.current.push(d.start);
    if (undo.current.length > 200) undo.current.shift();
    redo.current = [];
    bump(n => n + 1);
  };

  // ---------- commands ----------
  const selected = doc.shapes.filter(s => sel.includes(s.id));
  const one = selected.length === 1 ? selected[0] : null;
  const delSel = () => { if (!sel.length) return; const ids = new Set(sel); change(list => list.filter(s => !ids.has(s.id) || s.locked)); setSel([]); };
  const copySel = () => { clip.current = clone(selected); };
  const cutSel = () => { copySel(); delSel(); };
  const pasteClip = () => {
    if (!clip.current.length) return false;
    const copies = clip.current.map(s => ({ ...moveShape(s, 24, 24), id: newId() }));
    clip.current = copies;
    add(copies);
    return true;
  };
  const duplicate = () => { if (!selected.length) return; const copies = selected.map(s => ({ ...moveShape(clone(s), 24, 24), id: newId() })); add(copies); };
  const order = (how: 'front' | 'forward' | 'backward' | 'back') => {
    const ids = new Set(sel);
    change(list => {
      const a = [...list];
      if (how === 'front') return [...a.filter(s => !ids.has(s.id)), ...a.filter(s => ids.has(s.id))];
      if (how === 'back') return [...a.filter(s => ids.has(s.id)), ...a.filter(s => !ids.has(s.id))];
      if (how === 'forward') for (let i = a.length - 2; i >= 0; i--) { if (ids.has(a[i].id) && !ids.has(a[i + 1].id)) [a[i], a[i + 1]] = [a[i + 1], a[i]]; }
      else for (let i = 1; i < a.length; i++) { if (ids.has(a[i].id) && !ids.has(a[i - 1].id)) [a[i], a[i - 1]] = [a[i - 1], a[i]]; }
      return a;
    });
  };
  const align = (how: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const area = selected.length > 1 ? selBox! : { x: 0, y: 0, w: doc.w, h: doc.h };
    changeSel(s => {
      const b = bounds(s);
      const dx = how === 'left' ? area.x - b.x : how === 'center' ? area.x + area.w / 2 - (b.x + b.w / 2) : how === 'right' ? area.x + area.w - (b.x + b.w) : 0;
      const dy = how === 'top' ? area.y - b.y : how === 'middle' ? area.y + area.h / 2 - (b.y + b.h / 2) : how === 'bottom' ? area.y + area.h - (b.y + b.h) : 0;
      return moveShape(s, dx, dy);
    });
  };
  const distribute = (axis: 'x' | 'y') => {
    if (selected.length < 3) return;
    const sorted = [...selected].sort((a, b) => bounds(a)[axis] - bounds(b)[axis]);
    const size = axis === 'x' ? 'w' : 'h';
    const total = sorted.reduce((n, s) => n + bounds(s)[size], 0);
    const first = bounds(sorted[0]), last = bounds(sorted[sorted.length - 1]);
    const gap = (last[axis] + last[size] - first[axis] - total) / (sorted.length - 1);
    let at = first[axis];
    const pos = new Map<string, number>();
    for (const s of sorted) { pos.set(s.id, at); at += bounds(s)[size] + gap; }
    changeSel(s => { const b = bounds(s); const want = pos.get(s.id) ?? b[axis]; return moveShape(s, axis === 'x' ? want - b.x : 0, axis === 'y' ? want - b.y : 0); });
  };
  const flip = (axis: 'h' | 'v') => {
    if (!selBox) return;
    const b = selBox;
    const to = axis === 'h' ? { x: b.x + b.w, y: b.y, w: -b.w, h: b.h } : { x: b.x, y: b.y + b.h, w: b.w, h: -b.h };
    changeSel(s => {
      if (isBox(s)) { const sb = bounds(s); const nx = axis === 'h' ? b.x + b.w - (sb.x - b.x) - sb.w : sb.x, ny = axis === 'v' ? b.y + b.h - (sb.y - b.y) - sb.h : sb.y; return { ...s, x: nx, y: ny, rot: s.rot ? (360 - s.rot) % 360 : 0 }; }
      return fitShape(s, b, to);
    });
  };
  const rotate = (by: number) => changeSel(s => (isBox(s) ? { ...s, rot: (((s.rot + by) % 360) + 360) % 360 } : s));
  const setFill = (c: string | null) => { setStyle(st => ({ ...st, fill: c })); if (sel.length) changeSel(s => (s.kind === 'text' ? { ...s, fill: c ?? '#1B1B1F' } : s.kind === 'path' || s.kind === 'line' ? s : { ...s, fill: c })); };
  const setStroke = (c: string | null) => { setStyle(st => ({ ...st, stroke: c })); if (sel.length) changeSel(s => (s.kind === 'text' ? s : { ...s, stroke: c })); };
  const setWidth = (w: number) => { setStyle(st => ({ ...st, width: w })); if (sel.length) changeSel(s => (s.kind === 'text' || s.kind === 'image' ? s : { ...s, width: w })); };
  const setDash = (d: Dash) => { setStyle(st => ({ ...st, dash: d })); if (sel.length) changeSel(s => ({ ...s, dash: d })); };
  const setOpacity = (o: number) => { setStyle(st => ({ ...st, opacity: o })); if (sel.length) changeSel(s => ({ ...s, opacity: o })); };
  const setTextProp = (patch: Partial<TextShape>) => { setFont(f => ({ ...f, ...patch } as typeof f)); if (sel.length) changeSel(s => (s.kind === 'text' ? { ...s, ...patch } : s)); };
  const tidy = () => {
    const targets = (selected.length ? selected : doc.shapes).filter((s): s is PathShape => s.kind === 'path' && !s.marker);
    let n = 0;
    const map = new Map<string, Shape>();
    for (const s of targets) { const r = recognize(s); if (r) { map.set(s.id, r); n++; } }
    if (n) change(list => list.map(s => map.get(s.id) ?? s));
    setNote(n ? t('draw.tidied', { n }) : t('draw.tidyNone'));
  };
  const recolor = (colors: string[]) => {
    let i = 0;
    change(list => list.map(s => {
      if (s.kind === 'geom') return { ...s, fill: s.fill ? colors[(i++) % (colors.length - 1)] : s.fill, stroke: s.stroke ? colors[colors.length - 1] : s.stroke };
      if (s.kind === 'path' && s.marker) return s;
      if (s.kind === 'line' || s.kind === 'path') return { ...s, stroke: colors[colors.length - 1] };
      if (s.kind === 'text') return { ...s, fill: colors[colors.length - 1] };
      return s;
    }));
  };
  const setDoc2 = (patch: Partial<Drawing>) => commit({ ...docRef.current, ...patch });
  const resize = (w: number, h: number) => {
    const d = docRef.current;
    const from = { x: 0, y: 0, w: d.w, h: d.h }, s = Math.min(w / d.w, h / d.h);
    const to = { x: (w - d.w * s) / 2, y: (h - d.h * s) / 2, w: d.w * s, h: d.h * s };
    commit({ ...d, w, h, shapes: d.shapes.map(x => fitShape(x, from, to)) });
    setZoom('fit');
  };
  const runAi = async () => {
    if (!aiAsk?.text.trim()) return;
    const text = aiAsk.text.trim();
    const c = new AbortController();
    ctl.current = c;
    // With an AI website the answer is pasted in a card of its own: this window steps aside so the card can be seen.
    const viaWeb = shell.ai.provider?.().kind === 'web';
    if (viaWeb) setAiAsk(null);
    else setAiAsk({ ...aiAsk, busy: true, error: '', written: 0 });
    try {
      const shapes = await drawWithAi(shell.ai, docRef.current, text, lang, c.signal, n => setAiAsk(a => (a ? { ...a, written: n } : a)));
      if (!shapes.length) throw new Error(t('draw.aiEmpty'));
      add(shapes);
      setAiAsk(null);
      setNote(t('draw.aiDone', { n: shapes.length }));
    } catch (e) {
      if (c.signal.aborted) { setAiAsk(a => (a ? { ...a, busy: false } : a)); return; }
      setAiAsk({ text, busy: false, error: e instanceof Error ? e.message : String(e), written: 0 });
    } finally { ctl.current = null; }
  };
  const sendToLetter = async () => {
    const png = await rasterize(docRef.current);
    const src = await readDataUrl(png);
    shell.openModule('letter', undefined, { kind: 'html', title, html: `<p><img src="${src}" alt="${title.replace(/"/g, '')}" style="width:100%"></p>` });
  };
  const print = async () => {
    const png = await rasterize(docRef.current);
    const src = await readDataUrl(png);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><title>${title.replace(/</g, '')}</title><style>@page{margin:10mm}body{margin:0}img{width:100%}</style><img src="${src}">`);
    w.document.close();
    w.onload = () => w.print();
  };
  const share = async () => {
    const png = await rasterize(docRef.current);
    const f = new File([png], `${baseName()}.png`, { type: 'image/png' });
    try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title }); return; } } catch { /* cancelled */ }
    await shell.saveFile(`${baseName()}.png`, png, 'image/png', { saveAs: true });
  };

  // ---------- keyboard ----------
  const onKey = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redoOnce(); else undoOnce(); }
    else if (mod && key === 'y') { e.preventDefault(); redoOnce(); }
    else if (mod && key === 'c') { copySel(); }
    else if (mod && key === 'x') { e.preventDefault(); cutSel(); }
    else if (mod && key === 'v') { if (pasteClip()) e.preventDefault(); }
    else if (mod && key === 'd') { e.preventDefault(); duplicate(); }
    else if (mod && key === 'a') { e.preventDefault(); setSel(doc.shapes.filter(s => !s.hidden).map(s => s.id)); setTool('select'); }
    else if (mod && key === 's') { e.preventDefault(); void save(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSel(); }
    else if (e.key === 'Escape') { setSel([]); setEditing(null); }
    else if (e.key.startsWith('Arrow') && sel.length) {
      e.preventDefault();
      const n = e.shiftKey ? 10 : 1;
      changeSel(s => moveShape(s, e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0));
    } else if (!mod && !e.altKey) {
      const tl = TOOLS.find(x => x.key === key);
      if (tl) setTool(tl.id);
    }
  };
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!rootRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter(f => IMAGE_TYPES.includes(f.type));
      if (files.length) { e.preventDefault(); void addImages(files); }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  // ---------- copilot ----------
  useCopilotShortcut(() => setCopilot(o => !o), rootRef);
  const copilotHost: CopilotHost = {
    app: 'In 1 Draw',
    role: 'In 1 Draw is a drawing app: free hand lines, shapes with labels, arrows, text, pictures and stickers on a page. You can see the labels and texts of the drawing. Help the person plan, improve or explain their drawing. To have shapes drawn, they use "Draw with AI" on the AI tab.',
    context: () => {
      const words = docRef.current.shapes.map(s => (s.kind === 'text' ? s.text : s.kind === 'geom' ? s.text ?? '' : '')).filter(Boolean);
      return { label: t('draw.copilotContext', { n: docRef.current.shapes.length }), text: `${docRef.current.shapes.length} shapes. Labels: ${words.join(' | ') || '(none)'}` };
    },
    actions: [
      { id: 'ideas', label: t('draw.copilotIdeas'), icon: 'sparkle', prompt: 'Give 5 short, concrete ideas to make this drawing clearer and more beautiful (layout, colours, labels).' },
      { id: 'explain', label: t('draw.copilotExplain'), icon: 'comment', prompt: 'Explain in simple words what this drawing shows, from its labels.', needsContext: true },
      { id: 'draw', label: t('draw.aiDraw'), icon: 'pen', fill: t('draw.copilotDrawFill'),
        ask: async (ai, request, _ctx, signal) => { const shapes = await drawWithAi(ai, docRef.current, request, lang, signal); add(shapes); return shapes.length ? t('draw.aiDone', { n: shapes.length }) : t('draw.aiEmpty'); } },
    ],
    applies: [],
  };

  // ---------- convert ----------
  const convertSource: ConvertSource = {
    appId: 'draw',
    title: () => title,
    html: () => `<p style="text-align:center"><img alt="${title.replace(/"/g, '')}" style="max-width:100%" src="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(toSvg(docRef.current, false))))}"></p>`,
    tables: () => [],
    text: () => docRef.current.shapes.map(s => (s.kind === 'text' ? s.text : s.kind === 'geom' ? s.text ?? '' : '')).filter(Boolean).join('\n'),
    native: {
      png: async () => rasterize(docRef.current, 'image/png'),
      jpeg: async () => rasterize(docRef.current, 'image/jpeg'),
      pdf: async () => pdfOf(docRef.current),
    },
  };

  // ---------- ribbon ----------
  const tabs: { id: Tab; label: MessageKey }[] = [
    { id: 'home', label: 'letter.tab.home' }, { id: 'insert', label: 'letter.tab.insert' }, { id: 'arrange', label: 'draw.tab.arrange' },
    { id: 'design', label: 'letter.tab.design' }, { id: 'ai', label: 'draw.tab.ai' }, { id: 'view', label: 'letter.tab.view' },
  ];
  const isText = one?.kind === 'text';
  const swatch = (c: string | null) => c;
  const toolBtn = (x: typeof TOOLS[number]) => (
    <Btn key={x.id} big={false} text icon={x.icon} title={`draw.tool.${x.id}`} active={tool === x.id} onClick={() => { setTool(x.id); if (x.id !== 'select') setSel([]); closeRibbonPeek(); }} />
  );
  const ribbon = (
    <div className="ribbon">
      <div className="ribbon-tabs" role="tablist">
        <button type="button" className="ribbon-file" onClick={() => setPanel('file')}>{t('letter.tab.file')}</button>
        {tabs.map(x => <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>{t(x.label)}</button>)}
        <button type="button" role="tab" aria-selected={tab === 'oi1'} className={`ribbon-special${tab === 'oi1' ? ' on' : ''}`} onClick={() => setTab('oi1')}><span className="dot" />Office In 1</button>
        <button type="button" role="tab" aria-selected={tab === 'convert'} className={`ribbon-special ribbon-convert${tab === 'convert' ? ' on' : ''}`} onClick={() => setTab('convert')}>{t('convert.tab')}</button>
        <TutoTab />
        <RibbonToggle />
        <span className="ribbon-quick">
          <CopilotButton open={copilot} onClick={() => setCopilot(o => !o)} />
          <Btn icon="undo" title="letter.undo" onClick={undoOnce} disabled={!undo.current.length} />
          <Btn icon="redo" title="letter.redo" onClick={redoOnce} disabled={!redo.current.length} />
        </span>
      </div>
      <div className="ribbon-panel" role="tabpanel" onMouseDown={e => { if (!['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) e.preventDefault(); }}>
        {tab === 'home' && <>
          <Group label="letter.group.clipboard">
            <Btn big icon="paste" title="letter.paste" onClick={async () => {
              if (pasteClip()) return;
              try {
                const items = await navigator.clipboard.read?.();
                const img = items?.find(i => i.types.some(x => x.startsWith('image/')));
                if (img) { const type = img.types.find(x => x.startsWith('image/'))!; void addImages([new Blob([await img.getType(type)], { type })]); }
              } catch { setNote(t('letter.pasteBlocked')); }
            }} />
            <Btn icon="cut" title="letter.cut" onClick={cutSel} disabled={!sel.length} />
            <Btn icon="copy" title="letter.copy" onClick={copySel} disabled={!sel.length} />
            <Btn icon="new" title="draw.duplicate" onClick={duplicate} disabled={!sel.length} />
            <Btn icon="trash" title="draw.delete" onClick={delSel} disabled={!sel.length} />
          </Group>
          <Group label="draw.group.tools">
            <div className="dr-tools">{TOOLS.map(toolBtn)}</div>
          </Group>
          <Group label="draw.group.colors">
            <Drop big icon="fill" title="draw.fill" swatch={swatch(one && one.kind !== 'path' && one.kind !== 'line' ? one.fill : style.fill)}>
              {close => <ColorGrid none="draw.noFill" value={style.fill} onPick={c => { close(); setFill(c); }} />}
            </Drop>
            <Drop big icon="pen" title="draw.stroke" swatch={swatch(one && one.kind !== 'text' ? one.stroke : style.stroke)}>
              {close => <ColorGrid none="draw.noStroke" value={style.stroke} onPick={c => { close(); setStroke(c); }} />}
            </Drop>
          </Group>
          <Group label="draw.group.line">
            <Drop icon="lines" title="draw.width" text label={<span className="rb-label">{one && 'width' in one && one.kind !== 'text' ? one.width : style.width} px</span>}>
              {close => WIDTHS.map(w => <MenuItem key={w} active={style.width === w} label={<span className="dr-width"><i style={{ height: Math.min(w, 24) }} />{w} px</span>} onClick={() => { close(); setWidth(w); }} />)}
            </Drop>
            <Btn icon="hr" title="draw.dash.solid" active={style.dash === 'solid'} onClick={() => setDash('solid')} />
            <Btn icon="dashes" title="draw.dash.dash" active={style.dash === 'dash'} onClick={() => setDash('dash')} />
            <Btn icon="dots" title="draw.dash.dot" active={style.dash === 'dot'} onClick={() => setDash('dot')} />
            <Drop icon="shading" title="draw.opacity" text label={<span className="rb-label">{Math.round((one ? one.opacity : style.opacity) * 100)} %</span>}>
              {close => OPACITIES.map(o => <MenuItem key={o} active={Math.round(style.opacity * 100) === o} label={`${o} %`} onClick={() => { close(); setOpacity(o / 100); }} />)}
            </Drop>
          </Group>
          <Group label="draw.group.text">
            <Drop icon="textTool" title="letter.font" text label={<span className="rb-label" style={{ fontFamily: isText ? (one as TextShape).font : font.font }}>{isText ? (one as TextShape).font : font.font}</span>}>
              {close => FONTS.map(f => <MenuItem key={f} active={font.font === f} label={<span style={{ fontFamily: f }}>{f}</span>} onClick={() => { close(); setTextProp({ font: f }); }} />)}
            </Drop>
            <Drop title="letter.fontSize" text label={<span className="rb-label">{isText ? (one as TextShape).size : font.size}</span>}>
              {close => TEXT_SIZES.map(s => <MenuItem key={s} active={font.size === s} label={String(s)} onClick={() => { close(); setTextProp({ size: s }); }} />)}
            </Drop>
            <Btn icon="bold" label={<b>B</b>} title="letter.bold" active={isText ? (one as TextShape).bold : font.bold} onClick={() => setTextProp({ bold: !(isText ? (one as TextShape).bold : font.bold) })} />
            <Btn label={<i>I</i>} title="letter.italic" active={isText ? (one as TextShape).italic : font.italic} onClick={() => setTextProp({ italic: !(isText ? (one as TextShape).italic : font.italic) })} />
            <Btn icon="left" title="letter.alignLeft" onClick={() => setTextProp({ align: 'left' })} disabled={!isText} />
            <Btn icon="center" title="letter.alignCenter" onClick={() => setTextProp({ align: 'center' })} disabled={!isText} />
            <Btn icon="right" title="letter.alignRight" onClick={() => setTextProp({ align: 'right' })} disabled={!isText} />
          </Group>
        </>}

        {tab === 'insert' && <>
          <Group label="draw.group.shapes">
            <Drop big icon="rectTool" title="draw.shapes" wide>
              {close => <div className="dr-gallery">
                {SHAPE_GEOMS.map(g => (
                  <button key={g} type="button" className="dr-geom" title={t(`stage.geom.${g}` as MessageKey)} aria-label={t(`stage.geom.${g}` as MessageKey)}
                    onClick={() => { close(); setGeom(g); setTool('shape'); setSel([]); closeRibbonPeek(); }}>
                    <svg viewBox="-2 -2 36 28" width="36" height="28"><path d={geomPath(g, 32, 24)} fill="rgba(212,168,67,.25)" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </button>
                ))}
                <button type="button" className="dr-geom" title={t('draw.tool.line')} aria-label={t('draw.tool.line')} onClick={() => { close(); setTool('line'); closeRibbonPeek(); }}><svg viewBox="0 0 36 28" width="36" height="28"><path d="M4 24 32 4" stroke="currentColor" strokeWidth="2" /></svg></button>
                <button type="button" className="dr-geom" title={t('draw.tool.arrow')} aria-label={t('draw.tool.arrow')} onClick={() => { close(); setTool('arrow'); closeRibbonPeek(); }}><svg viewBox="0 0 36 28" width="36" height="28"><path d="M4 24 30 6M30 6l-9 1M30 6l-3 8" stroke="currentColor" strokeWidth="2" fill="none" /></svg></button>
                <button type="button" className="dr-geom" title={t('draw.doubleArrow')} aria-label={t('draw.doubleArrow')} onClick={() => { close(); add([{ id: newId(), kind: 'line', ...(() => { const c = center(300, 0); return { x1: c.x, y1: c.y, x2: c.x + 300, y2: c.y }; })(), head: 'both', ...style, fill: null }]); }}><svg viewBox="0 0 36 28" width="36" height="28"><path d="M4 14H32M4 14l7-5M4 14l7 5M32 14l-7-5M32 14l-7 5" stroke="currentColor" strokeWidth="2" fill="none" /></svg></button>
              </div>}
            </Drop>
            <Btn big icon="textTool" title="draw.tool.text" onClick={() => { const c = center(500, 60); const s: TextShape = { id: newId(), kind: 'text', ...c, w: 500, h: font.size * 1.3, rot: 0, text: t('draw.yourText'), font: font.font, size: font.size, bold: font.bold, italic: font.italic, align: 'center', ...style, fill: style.stroke ?? '#1B1B1F', stroke: null, width: 0 }; add([s]); setEditing(s.id); }} />
            <Btn big icon="image" title="draw.picture" onClick={() => imageInput.current?.click()} />
          </Group>
          <Group label="draw.group.fun">
            <Drop big icon="heart" title="draw.stickers" wide>
              {close => <div className="dr-stickers">{STICKERS.map(e => <button key={e} type="button" aria-label={e} onClick={() => { close(); const size = Math.round(Math.min(doc.w, doc.h) * 0.15); add([{ id: newId(), kind: 'text', ...center(size * 1.4, size * 1.3), w: size * 1.4, h: size * 1.3, rot: 0, text: e, font: 'Inter', size, bold: false, italic: false, align: 'center', ...DEFAULT_STYLE, fill: '#000', stroke: null, width: 0 }]); }}>{e}</button>)}</div>}
            </Drop>
            <Drop big icon="diagram" title="draw.templates" wide>
              {close => <div className="dr-templates">{TEMPLATES.map(x => <button key={x.id} type="button" className="dr-tpl" onClick={() => { close(); void addTemplate(x.id); }}><span aria-hidden="true">{x.icon}</span>{t(`draw.tpl.${x.id}` as MessageKey)}</button>)}</div>}
            </Drop>
          </Group>
        </>}

        {tab === 'arrange' && <>
          <Group label="draw.group.order">
            <Btn text icon="up" title="draw.front" onClick={() => order('front')} disabled={!sel.length} />
            <Btn text icon="next" title="draw.forward" onClick={() => order('forward')} disabled={!sel.length} />
            <Btn text icon="prev" title="draw.backward" onClick={() => order('backward')} disabled={!sel.length} />
            <Btn text icon="down" title="draw.back" onClick={() => order('back')} disabled={!sel.length} />
          </Group>
          <Group label="draw.group.align">
            <Btn icon="left" title="draw.align.left" onClick={() => align('left')} disabled={!sel.length} />
            <Btn icon="center" title="draw.align.center" onClick={() => align('center')} disabled={!sel.length} />
            <Btn icon="right" title="draw.align.right" onClick={() => align('right')} disabled={!sel.length} />
            <Btn icon="vtop" title="draw.align.top" onClick={() => align('top')} disabled={!sel.length} />
            <Btn icon="vmid" title="draw.align.middle" onClick={() => align('middle')} disabled={!sel.length} />
            <Btn icon="vbot" title="draw.align.bottom" onClick={() => align('bottom')} disabled={!sel.length} />
            <Btn icon="columns" title="draw.distributeH" onClick={() => distribute('x')} disabled={selected.length < 3} />
            <Btn icon="lines" title="draw.distributeV" onClick={() => distribute('y')} disabled={selected.length < 3} />
            <Btn text icon="gridlines" title="draw.snap" active={snap} onClick={() => setSnap(v => !v)} />
          </Group>
          <Group label="draw.group.turn">
            <Btn text icon="rotate" title="draw.rotateRight" onClick={() => rotate(90)} disabled={!sel.length} />
            <Btn text icon="undo" title="draw.rotateLeft" onClick={() => rotate(-90)} disabled={!sel.length} />
            <Btn text icon="swap" title="draw.flipH" onClick={() => flip('h')} disabled={!sel.length} />
            <Btn text icon="sort" title="draw.flipV" onClick={() => flip('v')} disabled={!sel.length} />
          </Group>
          <Group label="draw.group.layers">
            <Btn big icon="layers" title="draw.layers" active={layers} onClick={() => setLayers(o => !o)} />
            <Btn text icon="shield" title={one?.locked ? 'draw.unlock' : 'draw.lock'} active={!!one?.locked} onClick={() => { const lock = !selected.every(s => s.locked); const ids = new Set(sel); change(l => l.map(s => (ids.has(s.id) ? { ...s, locked: lock } : s))); }} disabled={!sel.length} />
            <Btn text icon="select" title="draw.selectAll" onClick={() => { setSel(doc.shapes.filter(s => !s.hidden).map(s => s.id)); setTool('select'); }} />
          </Group>
        </>}

        {tab === 'design' && <>
          <Group label="draw.group.page">
            <Drop big icon="size" title="draw.pageSize" wide>
              {close => SIZES.map(s => <MenuItem key={s.id} active={doc.w === s.w && doc.h === s.h} label={t(`draw.size.${s.id}` as MessageKey)} hint={`${s.w} × ${s.h}`} onClick={() => { close(); resize(s.w, s.h); }} />)}
            </Drop>
            <Btn big icon="orientation" title="draw.turnPage" onClick={() => resize(doc.h, doc.w)} />
          </Group>
          <Group label="draw.group.paper">
            <Drop big icon="gridlines" title="draw.paper" wide>
              {close => <div className="dr-papers">{PAPERS.map(p => (
                <button key={p} type="button" className={`dr-paper${doc.paper === p ? ' on' : ''}`} onClick={() => { close(); setDoc2({ paper: p as PaperId }); }}>
                  <svg viewBox="0 0 120 80" width="96" height="64" dangerouslySetInnerHTML={{ __html: `<rect width="120" height="80" fill="#fff"/>${paperSvg({ ...doc, w: 120, h: 80, paper: p as PaperId, shapes: [] })}` }} />
                  <span>{t(`draw.paper.${p}` as MessageKey)}</span>
                </button>))}</div>}
            </Drop>
            <Drop big icon="pagecolor" title="draw.background" swatch={doc.background}>
              {close => <div className="dr-swatches">{BACKGROUNDS.map(c => <button key={c} type="button" className={`color-cell${doc.background === c ? ' on' : ''}`} style={{ background: c }} aria-label={c} title={c} onClick={() => { close(); setDoc2({ background: c }); }} />)}</div>}
            </Drop>
          </Group>
          <Group label="draw.group.palettes">
            <Drop big icon="palette" title="draw.palettes" wide>
              {close => <div className="dr-palettes">{PALETTES.map(p => (
                <button key={p.id} type="button" className="dr-palette" onClick={() => { close(); recolor(p.colors); setStyle(s => ({ ...s, fill: p.colors[0], stroke: p.colors[p.colors.length - 1] })); }}>
                  <span className="dots">{p.colors.map(c => <i key={c} style={{ background: c }} />)}</span>{t(`draw.palette.${p.id}` as MessageKey)}
                </button>))}</div>}
            </Drop>
          </Group>
        </>}

        {tab === 'ai' && <>
          <Group label="draw.group.ai" accent="#7B6CF6">
            <Btn big icon="sparkle" title="draw.aiDraw" onClick={() => setAiAsk({ text: '', busy: false, error: '', written: 0 })} />
            <Btn big icon="clean" title="draw.tidy" onClick={tidy} />
            <Btn big icon="comment" title="draw.aiIdeas" onClick={() => setCopilot(true)} />
          </Group>
          <Group label="draw.group.quick">
            <Drop big icon="diagram" title="draw.templates" wide>
              {close => <div className="dr-templates">{TEMPLATES.map(x => <button key={x.id} type="button" className="dr-tpl" onClick={() => { close(); void addTemplate(x.id); }}><span aria-hidden="true">{x.icon}</span>{t(`draw.tpl.${x.id}` as MessageKey)}</button>)}</div>}
            </Drop>
          </Group>
        </>}

        {tab === 'view' && <>
          <Group label="letter.group.zoom">
            <Btn big icon="zoomin" title="letter.zoomIn" onClick={() => setZoom(ZOOMS.find(z => z > k + 0.001) ?? 8)} />
            <Btn big icon="zoomout" title="letter.zoomOut" onClick={() => setZoom([...ZOOMS].reverse().find(z => z < k - 0.001) ?? 0.05)} />
            <Btn big icon="onepage" title="ui.fitAll" onClick={() => setZoom('fit')} />
            <Btn big icon="target" title="draw.actualSize" onClick={() => setZoom(1)} />
          </Group>
          <Group label="draw.group.help">
            <Btn big icon="gridlines" title="draw.snap" active={snap} onClick={() => setSnap(s => !s)} />
            <Btn big icon="layers" title="draw.layers" active={layers} onClick={() => setLayers(o => !o)} />
          </Group>
        </>}

        {tab === 'oi1' && <>
          <Group label="draw.group.withLetter" accent={appColor('letter')}>
            <Btn big icon="letter" title="draw.toLetter" onClick={() => void sendToLetter()} />
          </Group>
          <Group label="letter.group.withProdfos" accent={appColor('prodfos')}>
            <Btn big icon="pdf" title="letter.savePdf" onClick={() => void exportAs('pdf')} />
          </Group>
          <Group label="letter.group.apps">
            <AppKeys apps={shell.apps()} self="draw" onOpen={id => shell.openModule(id)} />
          </Group>
          <Group label="letter.group.share">
            <Btn big icon="share" title="letter.share" onClick={() => void share()} />
            <Btn big icon="print" title="letter.print" onClick={() => void print()} />
          </Group>
        </>}
        {tab === 'convert' && <ConvertPanel shell={shell} source={convertSource} />}
      </div>
    </div>
  );

  // ---------- the page ----------
  const editShape = editing ? doc.shapes.find(s => s.id === editing) : null;
  const handles = selBox && tool === 'select' && !drag?.kind.match(/move|draw/) ? [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]] : [];
  const hs = 10 / k;
  const marquee = drag?.kind === 'marquee' ? drag : null;
  const cursor = tool === 'hand' ? (drag ? 'grabbing' : 'grab') : tool === 'select' ? 'default' : tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair';

  return (
    <div className="draw" ref={rootRef} tabIndex={-1} onKeyDown={onKey}>
      {ribbon}
      <div className="draw-body">
        <div className="dr-scroll" ref={scroller}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = Array.from(e.dataTransfer.files); const svg = f.find(x => x.name.toLowerCase().endsWith('.svg')); if (svg) void loadFile({ name: svg.name, type: svg.type, text: () => svg.text(), arrayBuffer: () => svg.arrayBuffer() }); else void addImages(f); }}>
          <div className="dr-stage" style={{ width: doc.w * k + 32, height: doc.h * k + 32 }}>
            <svg ref={svgRef} className="dr-page" width={doc.w * k} height={doc.h * k} viewBox={`0 0 ${doc.w} ${doc.h}`} style={{ cursor, touchAction: 'none' } as CSSProperties}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              onDoubleClick={e => { const s = shapeAt(e.target); if (s && (s.kind === 'text' || s.kind === 'geom')) { setSel([s.id]); setEditing(s.id); } }}
              role="img" aria-label={title}>
              <rect width={doc.w} height={doc.h} fill={doc.background} />
              <g dangerouslySetInnerHTML={{ __html: paperSvg(doc) }} style={{ pointerEvents: 'none' }} />
              {doc.shapes.map(s => (
                <g key={s.id} data-id={s.id} className={`dr-shape k-${s.kind}${s.locked ? ' locked' : ''}`} style={editing === s.id ? { opacity: 0.25 } : undefined}>
                  <g dangerouslySetInnerHTML={{ __html: shapeSvg(s) }} />
                  {(s.kind === 'path' || s.kind === 'line') && !s.hidden && <path className="dr-hit" d={s.kind === 'line' ? `M${s.x1} ${s.y1}L${s.x2} ${s.y2}` : `M${s.points.join(' ')}`.replace(/^M(\S+) (\S+)/, 'M$1 $2L')} strokeWidth={Math.max(s.width + 10, 14 / k)} />}
                </g>
              ))}
              {selBox && tool === 'select' && (
                <g className="dr-sel" pointerEvents="none">
                  <rect x={selBox.x} y={selBox.y} width={selBox.w} height={selBox.h} strokeWidth={1.5 / k} strokeDasharray={`${5 / k} ${4 / k}`} />
                </g>
              )}
              {handles.map(([hx, hy]) => (
                <rect key={`${hx},${hy}`} className="dr-handle" data-handle={`${hx},${hy}`} x={selBox!.x + (selBox!.w * hx) / 2 - hs / 2} y={selBox!.y + (selBox!.h * hy) / 2 - hs / 2} width={hs} height={hs} strokeWidth={1.5 / k}
                  style={{ cursor: hx === 1 ? 'ns-resize' : hy === 1 ? 'ew-resize' : (hx === hy ? 'nwse-resize' : 'nesw-resize') }} />
              ))}
              {one && isBox(one) && tool === 'select' && !drag && !one.locked && (
                <circle className="dr-handle rot" data-handle="rot" cx={one.x + one.w / 2} cy={one.y - 28 / k} r={hs * 0.6} strokeWidth={1.5 / k} />
              )}
              {marquee && <rect className="dr-marquee" x={Math.min(marquee.x0, marquee.x1)} y={Math.min(marquee.y0, marquee.y1)} width={Math.abs(marquee.x1 - marquee.x0)} height={Math.abs(marquee.y1 - marquee.y0)} strokeWidth={1 / k} />}
            </svg>
            {editShape && (editShape.kind === 'text' || editShape.kind === 'geom') && (
              <textarea className="dr-edit" autoFocus aria-label={t('draw.editText')}
                defaultValue={editShape.text ?? ''}
                style={{
                  left: 16 + editShape.x * k, top: 16 + editShape.y * k, width: Math.max(120, editShape.w * k), minHeight: Math.max(40, editShape.h * k),
                  fontSize: (editShape.kind === 'text' ? editShape.size : 22) * k, fontFamily: editShape.kind === 'text' ? editShape.font : 'Inter',
                  fontWeight: editShape.kind === 'text' && !editShape.bold ? 400 : 700, textAlign: editShape.kind === 'text' ? editShape.align : 'center',
                  color: editShape.kind === 'text' ? editShape.fill ?? '#000' : editShape.textColor ?? '#111',
                }}
                onKeyDown={e => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) (e.target as HTMLTextAreaElement).blur(); e.stopPropagation(); }}
                onBlur={e => {
                  const text = e.target.value;
                  const id = editShape.id;
                  setEditing(null);
                  const cur = docRef.current;
                  if (editShape.kind === 'text' && !text.trim()) { setDoc({ ...cur, shapes: cur.shapes.filter(s => s.id !== id) }); setSel([]); return; }
                  const next = { ...cur, shapes: cur.shapes.map(s => (s.id === id ? (s.kind === 'text' ? { ...s, text, h: s.size * 1.2 * text.split('\n').length + s.size * 0.2, w: Math.max(s.w, Math.max(...text.split('\n').map(l => l.length)) * s.size * 0.55) } : s.kind === 'geom' ? { ...s, text } : s) : s)) };
                  commit(next, cur);
                }} />
            )}
          </div>
        </div>
        <FastScroll target={scroller} />
        {layers && (
          <aside className="dr-layers" aria-label={t('draw.layers')}>
            <div className="dr-layers-head"><b>{t('draw.layers')}</b><button type="button" aria-label={t('letter.close')} onClick={() => setLayers(false)}><Icon name="close" size={12} /></button></div>
            {!doc.shapes.length && <p className="dr-empty">{t('draw.noLayers')}</p>}
            <ol>
              {[...doc.shapes].reverse().map(s => (
                <li key={s.id} className={sel.includes(s.id) ? 'on' : ''}>
                  <button type="button" className="dr-layer-name" onClick={() => { setSel([s.id]); setTool('select'); }}>
                    <svg viewBox={`${bounds(s).x - 4} ${bounds(s).y - 4} ${bounds(s).w + 8} ${bounds(s).h + 8}`} width="28" height="20" dangerouslySetInnerHTML={{ __html: shapeSvg({ ...s, hidden: false }) }} />
                    <span>{s.name || (s.kind === 'text' ? s.text.slice(0, 24) : s.kind === 'geom' ? (s.text || t(`stage.geom.${s.geom}` as MessageKey)) : t(`draw.kind.${s.kind}` as MessageKey))}</span>
                  </button>
                  <button type="button" title={t(s.hidden ? 'draw.show' : 'draw.hide')} aria-label={t(s.hidden ? 'draw.show' : 'draw.hide')} onClick={() => change(l => l.map(x => (x.id === s.id ? { ...x, hidden: !x.hidden } : x)))}>{s.hidden ? '🙈' : '👁'}</button>
                  <button type="button" title={t(s.locked ? 'draw.unlock' : 'draw.lock')} aria-label={t(s.locked ? 'draw.unlock' : 'draw.lock')} onClick={() => change(l => l.map(x => (x.id === s.id ? { ...x, locked: !x.locked } : x)))}>{s.locked ? '🔒' : '🔓'}</button>
                </li>
              ))}
            </ol>
          </aside>
        )}
        {copilot && <Copilot host={copilotHost} ai={shell.ai} onClose={() => { setCopilot(false); rootRef.current?.focus(); }} />}
      </div>
      <footer className="status">
        <span>{t('draw.count', { n: doc.shapes.length })}{sel.length ? ` · ${t('draw.selected', { n: sel.length })}` : ''}</span>
        {note && <span className="dr-note" role="status" onAnimationEnd={() => setNote('')}>{note}</span>}
        <span className="status-file">{fileName || `${title}.svg`}</span>
        <span className="status-zoom">
          <button type="button" aria-label={t('letter.zoomOut')} title={t('letter.zoomOut')} onClick={() => setZoom([...ZOOMS].reverse().find(z => z < k - 0.001) ?? 0.05)}>−</button>
          <input type="range" min={5} max={400} step={5} value={Math.round(k * 100)} aria-label={t('letter.zoom')} onChange={e => setZoom(Number(e.target.value) / 100)} onDoubleClick={() => setZoom('fit')} />
          <button type="button" aria-label={t('letter.zoomIn')} title={t('letter.zoomIn')} onClick={() => setZoom(ZOOMS.find(z => z > k + 0.001) ?? 8)}>+</button>
          <span className="pct">{Math.round(k * 100)}%</span>
          <button type="button" className="fit" title={t('ui.fitAll')} aria-label={t('ui.fitAll')} onClick={() => setZoom('fit')}><Icon name="onepage" size={13} /></button>
        </span>
      </footer>

      {aiAsk && (
        <Dialog title={t('draw.aiDraw')} onClose={() => { ctl.current?.abort(); setAiAsk(null); }} onOk={() => { void runAi(); return false; }}>
          <div className="dr-ai">
            <p>{t('draw.aiLead')}</p>
            <textarea autoFocus rows={3} value={aiAsk.text} placeholder={t('draw.aiPlaceholder')} aria-label={t('draw.aiDraw')} disabled={aiAsk.busy}
              onChange={e => setAiAsk({ ...aiAsk, text: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void runAi(); } }} />
            <div className="dr-ai-ideas">{(['house', 'rocket', 'flow', 'map', 'robot', 'flower'] as const).map(id => <button key={id} type="button" disabled={aiAsk.busy} onClick={() => setAiAsk({ ...aiAsk, text: t(`draw.aiIdea.${id}` as MessageKey) })}>{t(`draw.aiIdea.${id}` as MessageKey)}</button>)}</div>
            {aiAsk.busy && <p className="dr-ai-busy" role="status">✦ {aiAsk.written ? t('draw.aiWriting', { n: aiAsk.written }) : t('draw.aiThinking')}</p>}
            {aiAsk.error && <p className="dr-ai-error" role="alert">{t('draw.aiFailed')} {aiAsk.error}</p>}
            <p className="dr-ai-who">{t('assistant.withAi', { name: shell.ai.provider?.().name ?? 'Claude' })}</p>
          </div>
        </Dialog>
      )}
      <input ref={imageInput} type="file" accept={IMAGE_TYPES.join(',')} multiple hidden onChange={e => { void addImages(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      {panel === 'file' && (
        <FileMenu fileName={fileName || `${title}.svg`} onClose={() => setPanel(null)}
          onNew={() => shell.openModule('draw')} onOpen={async () => { const f = await shell.openFile(EXTENSIONS); if (f) void loadFile(f); }} onSave={() => void save()}
          onPrint={() => { setPanel(null); void print(); }}
          saveChoices={[
            { id: 'svg', icon: 'save', label: t('draw.format.svg'), hint: '.svg' },
            { id: 'png', icon: 'image', label: t('draw.format.png'), hint: '.png' },
            { id: 'jpg', icon: 'image', label: t('draw.format.jpg'), hint: '.jpg' },
            { id: 'pdf', icon: 'pdf', label: t('draw.format.pdf'), hint: '.pdf' },
          ]}
          onSaveAs={f => void exportAs(f)}
          listRecent={shell.recent.list} onOpenRecent={async (r: RecentFile) => { const f = await shell.recent.open(r.id); if (f) void loadFile(f); }} />
      )}
    </div>
  );
}

export { cleanShape, type GeomShape, type LineShape };
