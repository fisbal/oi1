// In 1 Image: photo editing for everyone, on a phone, a tablet or a computer. Open or paste a photo (or try one
// of twenty painted photos), make it better in one tap ("Enhance"), adjust light, colour, detail and effects with
// live sliders, pick one of 31 looks previewed on the photo itself, crop to 24 formats, straighten, turn and flip,
// compare before and after with a sliding line. Nothing is lost: the original is kept and every setting can be
// changed later (.oi1img). Exports PNG, JPEG, WebP, AVIF or PDF, at any size.
// Beyond a usual editor: a smart bubble says what the photo most needs ("too dark", "flat"…) and fixes it in one
// tap; settings glide into place; "Surprise me" proposes a new look; the histogram follows every change.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FileRef, Handoff, OpenedFile, RecentFile, ShellApi } from '../../shell/contract';
import { getLanguage, t, type MessageKey } from '../../shell/i18n';
import { useLanguage } from '../../shell/useLanguage';
import { Btn, Drop, Group, Icon, MenuItem, RibbonToggle } from '../../ui/kit';
import { AppKeys, appColor } from '../../ui/AppKeys';
import { FileMenu } from '../../ui/FileMenu';
import { TutoTab } from '../../ui/tuto/Tuto';
import { Copilot, CopilotButton, useCopilotShortcut, type CopilotHost } from '../../ui/Copilot';
import { usePinchZoom } from '../../ui/pinch';
import { FastScroll } from '../../ui/FastScroll';
import { closeRibbonPeek } from '../../ui/ribbonMin';
import { ConvertPanel } from '../../ui/convert/ConvertPanel';
import type { ConvertSource } from '../../shell/convert';
import { printWindow } from '../../shell/printWindow';
import {
  ADJUST_GROUPS, ADJUST_KEYS, LOOKS, NEUTRAL, POSITIVE_ONLY, RATIOS, SIZES, SUGGESTION_FIX,
  analyze, clampCrop, cropForRatio, enhance, newDoc, outputSize, rotateGeom, sanitize, suggest, surprise,
  type Adjust, type AdjustKey, type Crop, type ExportFormat, type ImageDoc, type Stats, type Suggestion,
} from './model';
import { createRenderer, exportBlob, loadImage, pdfBlob, sampleOf, type Renderer } from './render';
import { SAMPLES, paintSample, type SampleId } from './samples';

export const EXTENSIONS = ['.oi1img', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp'];
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp'];
type Tab = 'home' | 'adjust' | 'looks' | 'crop' | 'view' | 'oi1' | 'convert';
type Side = 'light' | 'color' | 'detail' | 'effects' | 'looks' | 'crop' | null;
interface Saved { doc: ImageDoc | null; name: string }
const ZOOMS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
const STRENGTHS = Array.from({ length: 21 }, (_, i) => i * 5);
const QUALITIES = [100, 95, 92, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10];

function readDataUrl(f: Blob): Promise<string> {
  return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(r.error); r.readAsDataURL(f); });
}
const sameDoc = (a: ImageDoc | null, b: ImageDoc | null) => JSON.stringify(a && { ...a, src: a.src.length }) === JSON.stringify(b && { ...b, src: b.src.length }) && a?.src === b?.src;

export default function ImageApp({ shell, file, handoff }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff }) {
  const [initial, setInitial] = useState<Saved | null>(null);
  useEffect(() => {
    void (async () => {
      let saved: Saved | null = null;
      if (!file && !handoff) try {
        const raw = await shell.storage.load('image');
        if (raw) { const o = JSON.parse(raw) as Saved; saved = { doc: o.doc ? sanitize(o.doc) : null, name: typeof o.name === 'string' ? o.name : '' }; }
      } catch { /* unreadable autosave */ }
      setInitial(saved ?? { doc: null, name: '' });
    })();
  }, [shell, file, handoff]);
  if (!initial) return <div className="imgapp" />;
  return <ImageEditor shell={shell} file={file} handoff={handoff} initial={initial} />;
}

function ImageEditor({ shell, file, handoff, initial }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff; initial: Saved }) {
  useLanguage();
  const lang = getLanguage();
  const [doc, setDocState] = useState<ImageDoc | null>(initial.doc);
  const docRef = useRef(doc);
  docRef.current = doc;
  const [tab, setTab] = useState<Tab>('home');
  const [side, setSide] = useState<Side>(null);
  const [zoom, setZoomState] = useState<number | 'fit'>('fit');
  const [compare, setCompare] = useState<number | null>(null);
  const [holding, setHolding] = useState(false);
  const [ratio, setRatio] = useState<string>('free');
  const [cropBox, setCropBox] = useState<Crop | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [hist, setHist] = useState<number[] | null>(null);
  const [showHist, setShowHist] = useState(true);
  const [tip, setTip] = useState<Suggestion | null>(null);
  const [note, setNote] = useState('');
  const [fileName, setFileName] = useState(initial.name);
  const [fileRef, setFileRef] = useState<FileRef | undefined>();
  const [panel, setPanel] = useState<'file' | null>(null);
  const [copilot, setCopilot] = useState(false);
  const [busy, setBusy] = useState('');
  const [exportSide, setExportSide] = useState(0);
  const [quality, setQuality] = useState(92);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const undo = useRef<ImageDoc[]>([]);
  const redo = useRef<ImageDoc[]>([]);
  const [, bump] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const beforeR = useRef<Renderer | null>(null);
  const anim = useRef(0);
  const holdTimer = useRef(0);
  const narrow = useNarrow(rootRef);

  // ---------- history ----------
  const commit = useCallback((next: ImageDoc | null, before: ImageDoc | null = docRef.current) => {
    if (sameDoc(next, before)) { setDocState(next); return; }
    undo.current.push(before as ImageDoc);
    if (undo.current.length > 150) undo.current.shift();
    redo.current = [];
    setDocState(next);
    bump(n => n + 1);
  }, []);
  const undoOnce = () => { cancelAnim(); const p = undo.current.pop(); if (p === undefined) return; redo.current.push(docRef.current as ImageDoc); setDocState(p); bump(n => n + 1); };
  const redoOnce = () => { cancelAnim(); const n = redo.current.pop(); if (n === undefined) return; undo.current.push(docRef.current as ImageDoc); setDocState(n); bump(x => x + 1); };
  const cancelAnim = () => { if (anim.current) { cancelAnimationFrame(anim.current); anim.current = 0; } };
  /** Settings glide to their new values (about half a second), then count as one step to undo. */
  const glideTo = (target: ImageDoc) => {
    const from = docRef.current;
    cancelAnim();
    if (!from || from.src !== target.src || matchMedia?.('(prefers-reduced-motion: reduce)').matches) { commit(target, from); return; }
    const t0 = performance.now(), dur = 480;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      const adjust = { ...target.adjust };
      for (const key of ADJUST_KEYS) adjust[key] = from.adjust[key] + (target.adjust[key] - from.adjust[key]) * e;
      const lookAmount = target.look === from.look ? from.lookAmount + (target.lookAmount - from.lookAmount) * e : target.lookAmount * e;
      if (k < 1) { setDocState({ ...target, adjust, lookAmount }); anim.current = requestAnimationFrame(step); }
      else { anim.current = 0; commit(target, from); }
    };
    anim.current = requestAnimationFrame(step);
  };

  // ---------- opening ----------
  const title = fileName ? fileName.replace(/\.[^.]+$/, '') : t('image.untitled');
  useEffect(() => { shell.setTitle(title.slice(0, 40)); }, [shell, title]);
  const openSrc = async (src: string, name: string) => {
    try {
      const img = await loadImage(src);
      const d = newDoc(src, img.naturalWidth, img.naturalHeight);
      commit(d);
      setFileName(name); setFileRef(undefined); setZoomState('fit'); setCompare(null); setCropBox(null);
      if (tab === 'crop') setTab('home');
    } catch { setNote(t('image.badFile')); }
  };
  const loadFile = async (f: OpenedFile) => {
    const name = f.name.toLowerCase();
    if (name.endsWith('.oi1img')) {
      try {
        const o = JSON.parse(await f.text()) as { doc?: unknown };
        const d = sanitize(o.doc ?? o);
        if (!d) throw new Error('bad');
        commit(d); setFileName(f.name); setFileRef(f); setZoomState('fit');
      } catch { setNote(t('image.badFile')); }
      return;
    }
    const ext = name.split('.').pop() ?? 'png';
    const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    const src = await readDataUrl(new Blob([await f.arrayBuffer()], { type }));
    await openSrc(src, f.name);
  };
  const openBlob = async (b: Blob, name = 'image.png') => { if (!IMAGE_TYPES.includes(b.type)) { setNote(t('image.badFile')); return; } await openSrc(await readDataUrl(b), name); };
  const openSample = (id: SampleId) => void openSrc(paintSample(id), `${t(`image.sample.${id}` as MessageKey)}.jpg`);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (file) void loadFile(file);
    if (handoff?.kind === 'file') void loadFile(handoff.file);
    if (handoff?.kind === 'html') {
      const src = new DOMParser().parseFromString(handoff.html, 'text/html').querySelector('img')?.getAttribute('src');
      if (src && /^data:image\/(png|jpeg|webp|gif);base64,/.test(src)) void openSrc(src, `${handoff.title ?? 'image'}.png`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- saving ----------
  const saveTimer = useRef(0);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void shell.storage.save('image', JSON.stringify({ doc, name: fileName } satisfies Saved)); }, 700);
  }, [doc, fileName, shell]);
  useEffect(() => { shell.onRename?.(name => setFileName(`${name}.oi1img`)); return () => shell.onRename?.(null); }, [shell]);
  const baseName = () => title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'image';
  const workBlob = async () => new Blob([JSON.stringify({ app: 'In 1 Image', doc: docRef.current })], { type: 'application/json' });
  const save = async (saveAs = false) => {
    if (!docRef.current) return;
    const name = fileName.toLowerCase().endsWith('.oi1img') ? fileName : `${baseName()}.oi1img`;
    const ref = await shell.saveFile(name, workBlob, 'application/json', { target: fileName.toLowerCase().endsWith('.oi1img') ? fileRef : undefined, saveAs });
    if (ref) { setFileRef(ref); setFileName(ref.name); }
  };
  const blobFor = (f: ExportFormat): Promise<Blob> => {
    const d = docRef.current!;
    if (f === 'pdf') return pdfBlob(d);
    if (f === 'oi1img') return workBlob();
    const type = f === 'jpg' ? 'image/jpeg' : `image/${f}` as 'image/png';
    return exportBlob(d, type, exportSide, quality / 100);
  };
  const exportAs = async (f: ExportFormat) => {
    if (!docRef.current) return;
    if (f === 'oi1img') { void save(true); return; }
    setBusy(t('image.exporting'));
    try {
      const blob = await blobFor(f);
      const ext = f === 'jpg' ? 'jpg' : blob.type === 'image/png' && f !== 'png' && f !== 'pdf' ? 'png' : f;
      if (ext !== f) setNote(t('image.formatFallback', { f: f.toUpperCase() }));
      await shell.saveFile(`${baseName()}.${ext}`, blob, blob.type, { saveAs: true });
    } finally { setBusy(''); }
  };
  const quietSave = useRef<() => Promise<FileRef | null>>(async () => null);
  quietSave.current = async () => {
    if (!docRef.current) return null;
    const own = !!fileRef?.handle && fileName.toLowerCase().endsWith('.oi1img');
    if (!own && !shell.cloudOn?.()) return null;
    return shell.saveFile(own ? fileName : `${baseName()}.oi1img`, workBlob, 'application/json', { target: own ? fileRef : undefined, quiet: true });
  };
  useEffect(() => { shell.autoSave(() => quietSave.current()); return () => shell.autoSave(null); }, [shell]);

  // ---------- statistics and the smart bubble ----------
  useEffect(() => {
    if (!doc) { setStats(null); setTip(null); return; }
    let live = true;
    void sampleOf(doc.src).then(px => { if (!live) return; const s = analyze(px); setStats(s); setTip(suggest(s)); }).catch(() => undefined);
    return () => { live = false; };
  }, [doc?.src]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- drawing ----------
  const [area, setArea] = useState({ w: 800, h: 600 });
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setArea({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setArea({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [doc === null]); // eslint-disable-line react-hooks/exhaustive-deps
  const cropping = tab === 'crop' && !!doc;
  const shown = useMemo(() => (doc && cropping ? { ...doc, geom: { ...doc.geom, crop: { x: 0, y: 0, w: 1, h: 1 } } } : doc), [doc, cropping]);
  const out = shown ? outputSize(shown) : { w: 1, h: 1 };
  const pad = narrow ? 12 : 32;
  const fitK = Math.max(0.02, Math.min((area.w - pad) / out.w, (area.h - pad) / out.h));
  const k = zoom === 'fit' ? fitK : zoom;
  const kRef = useRef(k);
  kRef.current = k;
  const setZoom = (z: number | 'fit') => setZoomState(z === 'fit' ? 'fit' : Math.max(0.02, Math.min(8, z)));
  usePinchZoom(scroller, () => kRef.current, z => setZoom(z), { min: 0.02, max: 8 });

  const [srcReady, setSrcReady] = useState<string | null>(null);
  useEffect(() => {
    if (!doc) return;
    let live = true;
    void loadImage(doc.src).then(img => {
      if (!live || !canvasRef.current) return;
      renderer.current?.dispose();
      beforeR.current?.dispose();
      renderer.current = createRenderer(img, canvasRef.current);
      beforeR.current = beforeRef.current ? createRenderer(img, beforeRef.current) : null;
      setSrcReady(doc.src);
    }).catch(() => setNote(t('image.badFile')));
    return () => { live = false; };
  }, [doc?.src]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { renderer.current?.dispose(); beforeR.current?.dispose(); cancelAnim(); }, []);
  const dpr = typeof devicePixelRatio === 'number' ? Math.min(devicePixelRatio, 2) : 1;
  const previewSide = Math.min(2400, Math.max(320, Math.round(Math.max(out.w, out.h) * k * dpr)));
  const frame = useRef(0);
  useEffect(() => {
    if (!shown || srcReady !== shown.src || !renderer.current) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      renderer.current?.draw(shown, previewSide);
      if (compare !== null || holding) beforeR.current?.draw(shown, previewSide, { neutral: true });
      readHistogram();
    });
  }, [shown, srcReady, previewSide, compare !== null || holding]); // eslint-disable-line react-hooks/exhaustive-deps
  const histTimer = useRef(0);
  const readHistogram = () => {
    window.clearTimeout(histTimer.current);
    histTimer.current = window.setTimeout(() => {
      const c = canvasRef.current;
      if (!c || !c.width) return;
      const s = document.createElement('canvas');
      s.width = 96; s.height = Math.max(1, Math.round(96 * c.height / c.width));
      const g = s.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(c, 0, 0, s.width, s.height);
      setHist(analyze(g.getImageData(0, 0, s.width, s.height).data).hist);
    }, 120);
  };

  // Looks previewed on the photo itself (small copies, made when the Looks list is opened).
  const thumbKey = doc ? `${doc.src.length}:${doc.src.slice(-40)}:${JSON.stringify(doc.geom)}:${JSON.stringify(doc.adjust)}` : '';
  useEffect(() => {
    if (!doc || (side !== 'looks' && tab !== 'looks')) return;
    if (thumbs.__key === thumbKey) return;
    let live = true;
    const tm = window.setTimeout(() => {
      void loadImage(doc.src).then(img => {
        if (!live) return;
        const r = createRenderer(img);
        const next: Record<string, string> = { __key: thumbKey };
        try {
          next.none = (r.draw({ ...doc, look: null }, 120), r.canvas.toDataURL('image/jpeg', 0.75));
          for (const l of LOOKS) { r.draw({ ...doc, look: l.id, lookAmount: 100 }, 120); next[l.id] = r.canvas.toDataURL('image/jpeg', 0.75); }
        } finally { r.dispose(); }
        if (live) setThumbs(next);
      });
    }, 150);
    return () => { live = false; window.clearTimeout(tm); };
  }, [thumbKey, side, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- commands ----------
  const patch = (fn: (d: ImageDoc) => ImageDoc, glide = false) => { const d = docRef.current; if (!d) return; const n = fn(d); if (glide) glideTo(n); else commit(n, d); };
  const doEnhance = () => {
    if (!stats) return;
    patch(d => ({ ...d, adjust: { ...d.adjust, ...enhance(stats) } }), true);
    setTip(null);
    setNote(t('image.enhanced'));
  };
  const applyTip = () => { if (!tip) return; const fix = SUGGESTION_FIX[tip]; patch(d => ({ ...d, adjust: { ...d.adjust, ...Object.fromEntries(Object.entries(fix).map(([key, v]) => [key, Math.max(-100, Math.min(100, d.adjust[key as AdjustKey] + (v ?? 0)))])) } }), true); setTip(null); };
  const doSurprise = () => { const s = surprise(); patch(d => ({ ...d, look: s.look, lookAmount: 100, adjust: { ...d.adjust, ...s.adjust } }), true); setNote(t('image.surprised', { look: t(`image.look.${s.look}` as MessageKey) })); };
  const resetAll = () => patch(d => ({ ...d, adjust: { ...NEUTRAL }, look: null, lookAmount: 100, geom: { rot: 0, flipH: false, flipV: false, angle: 0, crop: { x: 0, y: 0, w: 1, h: 1 } } }), true);
  const resetAdjust = (keys: readonly AdjustKey[] = ADJUST_KEYS) => patch(d => ({ ...d, adjust: { ...d.adjust, ...Object.fromEntries(keys.map(x => [x, 0])) } }), true);
  const turn = (dir: 1 | -1) => { patch(d => ({ ...d, geom: rotateGeom(d.geom, dir) })); setCropBox(null); setZoomState('fit'); };
  const flip = (axis: 'h' | 'v') => patch(d => ({ ...d, geom: { ...d.geom, ...(axis === 'h' ? { flipH: !d.geom.flipH, crop: { ...d.geom.crop, x: 1 - d.geom.crop.x - d.geom.crop.w } } : { flipV: !d.geom.flipV, crop: { ...d.geom.crop, y: 1 - d.geom.crop.y - d.geom.crop.h } }) } }));
  const setLook = (id: string | null) => patch(d => ({ ...d, look: id, lookAmount: id === d.look ? d.lookAmount : 100 }), true);
  const pickRatio = (id: string) => {
    setRatio(id);
    const r = RATIOS.find(x => x.id === id)?.r ?? null;
    const d = docRef.current;
    if (!d || r === null) return;
    setCropBox(cropForRatio(r, d));
  };
  // The crop box being edited (applied when leaving the Crop tab or pressing Done).
  const box = cropBox ?? doc?.geom.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const applyCrop = (leave = true) => {
    if (cropBox) patch(d => ({ ...d, geom: { ...d.geom, crop: cropBox } }));
    setCropBox(null);
    if (leave) { setTab('home'); setSide(null); }
    setZoomState('fit');
  };
  const goTab = (x: Tab) => {
    if (tab === 'crop' && x !== 'crop') applyCrop(false);
    setTab(x);
    if (x === 'adjust') setSide(s => (s && ['light', 'color', 'detail', 'effects'].includes(s) ? s : 'light'));
    else if (x === 'looks') setSide('looks');
    else if (x === 'crop') { setSide('crop'); setCompare(null); setZoomState('fit'); }
    else if (narrow) setSide(null);
  };
  const copyImage = async () => {
    if (!docRef.current) return;
    try {
      const png = await exportBlob(docRef.current, 'image/png');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setNote(t('image.copied'));
    } catch { setNote(t('letter.pasteBlocked')); }
  };
  const pasteImage = async () => {
    try {
      const items = await navigator.clipboard.read?.();
      const it = items?.find(i => i.types.some(x => x.startsWith('image/')));
      if (it) { const type = it.types.find(x => x.startsWith('image/'))!; await openBlob(new Blob([await it.getType(type)], { type }), 'pasted.png'); return; }
      setNote(t('image.noPicture'));
    } catch { setNote(t('letter.pasteBlocked')); }
  };
  const pngData = async () => readDataUrl(await exportBlob(docRef.current!, 'image/png', 2400));
  const sendToLetter = async () => { if (!docRef.current) return; const src = await pngData(); shell.openModule('letter', undefined, { kind: 'html', title, html: `<p><img src="${src}" alt="${title.replace(/"/g, '')}" style="width:100%"></p>` }); };
  const sendToStage = async () => { if (!docRef.current) return; const src = await pngData(); shell.openModule('stage', undefined, { kind: 'html', title, html: `<h1>${title.replace(/</g, '')}</h1><p><img src="${src}" alt=""></p>` }); };
  const sendToDraw = async () => { if (!docRef.current) return; const png = await exportBlob(docRef.current, 'image/png', 2400); const name = `${baseName()}.png`; shell.openModule('draw', undefined, { kind: 'file', file: { name, type: 'image/png', text: () => png.text(), arrayBuffer: () => png.arrayBuffer() } }); };
  const sendToNotes = async () => { if (!docRef.current) return; const src = await pngData(); shell.openModule('notes', undefined, { kind: 'html', title, html: `<p><img src="${src}" alt="${title.replace(/"/g, '')}"></p>` }); };
  const print = async () => { if (!docRef.current) return; const src = await pngData(); printWindow(title, `<img src="${src}" alt="">`, '@page{margin:10mm}body{margin:0}img{max-width:100%;max-height:100vh;display:block;margin:auto}', lang); };
  const share = async () => {
    if (!docRef.current) return;
    const png = await exportBlob(docRef.current, 'image/jpeg', 0, 0.9);
    const f = new File([png], `${baseName()}.jpg`, { type: 'image/jpeg' });
    try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title }); return; } } catch { /* cancelled */ }
    await shell.saveFile(`${baseName()}.jpg`, png, 'image/jpeg', { saveAs: true });
  };

  // ---------- sliders ----------
  const slideStart = useRef<ImageDoc | null>(null);
  const setValue = (key: AdjustKey, v: number) => { cancelAnim(); const d = docRef.current; if (!d) return; if (!slideStart.current) slideStart.current = d; setDocState({ ...d, adjust: { ...d.adjust, [key]: v } }); };
  const endSlide = () => { const s = slideStart.current; slideStart.current = null; if (s) commit(docRef.current, s); };
  const setAngle = (a: number) => { const d = docRef.current; if (!d) return; if (!slideStart.current) slideStart.current = d; setDocState({ ...d, geom: { ...d.geom, angle: a } }); };
  const setStrength = (v: number) => { const d = docRef.current; if (!d) return; if (!slideStart.current) slideStart.current = d; setDocState({ ...d, lookAmount: v }); };
  const slider = (key: AdjustKey) => {
    const v = doc?.adjust[key] ?? 0;
    const min = POSITIVE_ONLY.includes(key) ? 0 : -100;
    return (
      <label key={key} className={`im-slider${v ? ' on' : ''}`} data-help={`image.adj.${key}`}>
        <span className="im-sl-name">{t(`image.adj.${key}` as MessageKey)}</span>
        <output>{v > 0 && min < 0 ? '+' : ''}{Math.round(v)}</output>
        <input type="range" min={min} max={100} step={1} value={Math.round(v)} aria-label={t(`image.adj.${key}` as MessageKey)} disabled={!doc}
          style={{ '--v': `${((v - min) / (100 - min)) * 100}%` } as React.CSSProperties}
          onChange={e => setValue(key, Number(e.target.value))} onPointerUp={endSlide} onKeyUp={endSlide} onBlur={endSlide}
          onDoubleClick={() => { slideStart.current = null; patch(d => ({ ...d, adjust: { ...d.adjust, [key]: 0 } }), true); }} />
      </label>
    );
  };

  // ---------- crop box dragging ----------
  const cropDrag = useRef<{ mode: string; x0: number; y0: number; start: Crop } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const ratioNow = () => {
    const r = RATIOS.find(x => x.id === ratio)?.r ?? null;
    if (r === null || !doc) return null;
    const o = doc.geom.rot % 2 ? { w: doc.h, h: doc.w } : { w: doc.w, h: doc.h };
    const want = r === 0 ? doc.w / doc.h * (doc.geom.rot % 2 ? (doc.h / doc.w) ** 2 : 1) : r;
    return want / (o.w / o.h); // in normalized units: w/h
  };
  const cropDown = (e: React.PointerEvent, mode: string) => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    cropDrag.current = { mode, x0: e.clientX, y0: e.clientY, start: { ...box } };
  };
  const cropMove = (e: React.PointerEvent) => {
    const dr = cropDrag.current, el = overlayRef.current;
    if (!dr || !el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - dr.x0) / r.width, dy = (e.clientY - dr.y0) / r.height;
    const s = dr.start;
    let c: Crop;
    if (dr.mode === 'move') c = { ...s, x: s.x + dx, y: s.y + dy };
    else {
      let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
      if (dr.mode.includes('w')) x0 = Math.min(x1 - 0.04, Math.max(0, x0 + dx));
      if (dr.mode.includes('e')) x1 = Math.max(x0 + 0.04, Math.min(1, x1 + dx));
      if (dr.mode.includes('n')) y0 = Math.min(y1 - 0.04, Math.max(0, y0 + dy));
      if (dr.mode.includes('s')) y1 = Math.max(y0 + 0.04, Math.min(1, y1 + dy));
      const rr = ratioNow();
      if (rr) {
        let w = x1 - x0, h = y1 - y0;
        if (dr.mode === 'n' || dr.mode === 's') w = h * rr; else h = w / rr;
        if (w > 1) { w = 1; h = w / rr; } if (h > 1) { h = 1; w = h * rr; }
        if (dr.mode.includes('w')) x0 = x1 - w; else x1 = x0 + w;
        if (dr.mode.includes('n')) y0 = y1 - h; else y1 = y0 + h;
      }
      c = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    setCropBox(clampCrop(c));
  };
  const cropUp = () => { cropDrag.current = null; };

  // ---------- keyboard and paste ----------
  const onKey = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redoOnce(); else undoOnce(); }
    else if (mod && key === 'y') { e.preventDefault(); redoOnce(); }
    else if (mod && key === 's') { e.preventDefault(); void save(); }
    else if (mod && key === 'o') { e.preventDefault(); fileInput.current?.click(); }
    else if (mod && key === 'c') { e.preventDefault(); void copyImage(); }
    else if (key === '\\' || key === 'b') setHolding(true);
    else if (key === 'enter' && tab === 'crop') applyCrop();
    else if (key === 'escape' && tab === 'crop') { setCropBox(null); goTab('home'); }
    else if (!mod && (key === '+' || key === '=')) setZoom(ZOOMS.find(z => z > k + 0.001) ?? 8);
    else if (!mod && key === '-') setZoom([...ZOOMS].reverse().find(z => z < k - 0.001) ?? 0.02);
    else if (!mod && key === '0') setZoom('fit');
  };
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!rootRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      const f = Array.from(e.clipboardData?.files ?? []).find(x => IMAGE_TYPES.includes(x.type));
      if (f) { e.preventDefault(); void openBlob(f, f.name || 'pasted.png'); }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  // ---------- copilot ----------
  useCopilotShortcut(() => setCopilot(o => !o), rootRef);
  const describe = () => {
    const d = docRef.current;
    if (!d) return 'No photo open.';
    const o = outputSize(d);
    const set = ADJUST_KEYS.filter(x => d.adjust[x]).map(x => `${x} ${Math.round(d.adjust[x])}`).join(', ') || 'none';
    const s = stats ? `brightness ${Math.round(stats.mean * 100)}%, dark point ${Math.round(stats.p1 * 100)}%, light point ${Math.round(stats.p99 * 100)}%, colourfulness ${Math.round(stats.sat * 100)}%, warm/cool cast ${Math.round(stats.cast * 100)}` : '';
    return `Photo ${d.w}x${d.h}, result ${o.w}x${o.h}. Look: ${d.look ?? 'none'} (${Math.round(d.lookAmount)}%). Settings: ${set}. Original statistics: ${s}.`;
  };
  const copilotHost: CopilotHost = {
    app: 'In 1 Image',
    role: 'In 1 Image is a photo editor: light, colour, detail and effect sliders from -100 to 100 (exposure, contrast, highlights, shadows, whites, blacks, temp, tint, saturation, vibrance, hue, sharpen, clarity, vignette, grain, fade), 31 looks, crop formats, straighten, turn and flip. You cannot see the picture, only its numbers. Give concrete slider values when you suggest changes.',
    context: () => ({ label: t('image.copilotContext'), text: describe() }),
    actions: [
      { id: 'ideas', label: t('image.copilotIdeas'), icon: 'sparkle', prompt: 'From the statistics, say in 4 short points what would make this photo better, with slider values.', needsContext: true },
      { id: 'social', label: t('image.copilotSocial'), icon: 'share', prompt: 'Suggest the best crop format and look for posting this photo on social networks, and a short caption idea.', needsContext: true },
      { id: 'explain', label: t('image.copilotExplain'), icon: 'comment', prompt: 'Explain in simple words what each of the current settings does to the photo.', needsContext: true },
    ],
    applies: [],
  };

  // ---------- convert ----------
  const convertSource: ConvertSource = {
    appId: 'image',
    title: () => title,
    html: () => (canvasRef.current && docRef.current ? `<p style="text-align:center"><img alt="${title.replace(/"/g, '')}" style="max-width:100%" src="${canvasRef.current.toDataURL('image/jpeg', 0.9)}"></p>` : ''),
    tables: () => [],
    text: () => title,
    native: {
      png: async () => (docRef.current ? exportBlob(docRef.current, 'image/png') : undefined),
      jpeg: async () => (docRef.current ? exportBlob(docRef.current, 'image/jpeg') : undefined),
      webp: async () => (docRef.current ? exportBlob(docRef.current, 'image/webp') : undefined),
      pdf: async () => (docRef.current ? pdfBlob(docRef.current) : undefined),
    },
  };

  // ---------- ribbon ----------
  const none = !doc;
  const tabs: { id: Tab; label: MessageKey }[] = [
    { id: 'home', label: 'letter.tab.home' }, { id: 'adjust', label: 'image.tab.adjust' }, { id: 'looks', label: 'image.tab.looks' },
    { id: 'crop', label: 'image.tab.crop' }, { id: 'view', label: 'letter.tab.view' },
  ];
  const sampleMenu = (close: () => void) => SAMPLES.map(s => <MenuItem key={s} label={t(`image.sample.${s}` as MessageKey)} onClick={() => { close(); openSample(s); closeRibbonPeek(); }} />);
  const ratioMenu = (close: () => void) => RATIOS.map(r => <MenuItem key={r.id} active={ratio === r.id} label={t(`image.ratio.${r.id}` as MessageKey)} onClick={() => { close(); if (tab !== 'crop') goTab('crop'); pickRatio(r.id); }} />);
  const openSide = (s: Side) => { setSide(cur => (cur === s && narrow ? null : s)); closeRibbonPeek(); };
  const ribbon = (
    <div className="ribbon">
      <div className="ribbon-tabs" role="tablist">
        <button type="button" className="ribbon-file" onClick={() => setPanel('file')}>{t('letter.tab.file')}</button>
        {tabs.map(x => <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => goTab(x.id)}>{t(x.label)}</button>)}
        <button type="button" role="tab" aria-selected={tab === 'oi1'} className={`ribbon-special${tab === 'oi1' ? ' on' : ''}`} onClick={() => goTab('oi1')}><span className="dot" />Office In 1</button>
        <button type="button" role="tab" aria-selected={tab === 'convert'} className={`ribbon-special ribbon-convert${tab === 'convert' ? ' on' : ''}`} onClick={() => goTab('convert')}>{t('convert.tab')}</button>
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
          <Group label="image.group.photo">
            <Btn big icon="open" title="image.open" onClick={() => fileInput.current?.click()} />
            <Drop big icon="image" title="image.samples">{sampleMenu}</Drop>
            <Btn icon="paste" title="image.paste" onClick={() => void pasteImage()} />
            <Btn icon="copy" title="image.copy" onClick={() => void copyImage()} disabled={none} />
          </Group>
          <Group label="image.group.magic" accent="#7B6CF6">
            <Btn big icon="magic" title="image.enhance" onClick={doEnhance} disabled={none || !stats} />
            <Btn big icon="dice" title="image.surprise" onClick={doSurprise} disabled={none} />
            <Btn big icon="clean" title="image.resetAll" onClick={resetAll} disabled={none} />
          </Group>
          <Group label="image.group.turn">
            <Btn text icon="rotate" title="image.turnRight" onClick={() => turn(1)} disabled={none} />
            <Btn text icon="undo" title="image.turnLeft" onClick={() => turn(-1)} disabled={none} />
            <Btn text icon="swap" title="image.flipH" onClick={() => flip('h')} disabled={none} />
            <Btn text icon="sort" title="image.flipV" onClick={() => flip('v')} disabled={none} />
          </Group>
          <Group label="image.group.export">
            <Btn big icon="save" title="image.exportJpg" onClick={() => void exportAs('jpg')} disabled={none} />
            <Drop icon="size" title="image.size" text label={<span className="rb-label">{exportSide ? `${exportSide} px` : t('image.sizeFull')}</span>} disabled={none}>
              {close => SIZES.map(s => <MenuItem key={s} active={exportSide === s} label={s ? t('image.sizePx', { n: s }) : t('image.sizeOriginal', { w: out.w, h: out.h })} onClick={() => { close(); setExportSide(s); }} />)}
            </Drop>
            <Drop icon="shading" title="image.quality" text label={<span className="rb-label">{quality} %</span>} disabled={none}>
              {close => QUALITIES.map(q => <MenuItem key={q} active={quality === q} label={`${q} %`} onClick={() => { close(); setQuality(q); }} />)}
            </Drop>
          </Group>
          <Group label="image.group.edit">
            <Btn big icon="sun" title="image.tab.adjust" onClick={() => goTab('adjust')} disabled={none} />
            <Btn big icon="palette" title="image.tab.looks" onClick={() => goTab('looks')} disabled={none} />
            <Btn big icon="crop" title="image.tab.crop" onClick={() => goTab('crop')} disabled={none} />
            <Btn big icon="compare" title="image.compare" active={compare !== null} onClick={() => setCompare(c => (c === null ? 0.5 : null))} disabled={none} />
          </Group>
        </>}

        {tab === 'adjust' && <>
          <Group label="image.group.adjust">
            {ADJUST_GROUPS.map(gr => <Btn key={gr.id} big icon={({ light: 'sun', color: 'drop', detail: 'target', effects: 'sparkle' } as const)[gr.id]} title={`image.group.${gr.id}`} active={side === gr.id} onClick={() => openSide(gr.id)} disabled={none} />)}
          </Group>
          <Group label="image.group.auto" accent="#7B6CF6">
            <Btn big icon="magic" title="image.enhance" onClick={doEnhance} disabled={none || !stats} />
            <Btn text icon="clean" title="image.resetAdjust" onClick={() => resetAdjust()} disabled={none} />
            <Btn text icon="compare" title="image.compare" active={compare !== null} onClick={() => setCompare(c => (c === null ? 0.5 : null))} disabled={none} />
          </Group>
        </>}

        {tab === 'looks' && <>
          <Group label="image.group.looks">
            <Btn big icon="palette" title="image.looks" active={side === 'looks'} onClick={() => openSide('looks')} disabled={none} />
            <Drop icon="shading" title="image.strength" text label={<span className="rb-label">{Math.round(doc?.lookAmount ?? 100)} %</span>} disabled={none || !doc?.look}>
              {close => STRENGTHS.map(s => <MenuItem key={s} active={Math.round(doc?.lookAmount ?? 0) === s} label={`${s} %`} onClick={() => { close(); patch(d => ({ ...d, lookAmount: s }), true); }} />)}
            </Drop>
            <Btn text icon="close" title="image.noLook" onClick={() => setLook(null)} disabled={none || !doc?.look} />
          </Group>
          <Group label="image.group.magic" accent="#7B6CF6">
            <Btn big icon="dice" title="image.surprise" onClick={doSurprise} disabled={none} />
            <Btn big icon="magic" title="image.enhance" onClick={doEnhance} disabled={none || !stats} />
          </Group>
        </>}

        {tab === 'crop' && <>
          <Group label="image.group.format">
            <Drop big icon="crop" title="image.ratio" wide label={<span className="rb-label">{t(`image.ratio.${ratio}` as MessageKey)}</span>} disabled={none}>{ratioMenu}</Drop>
            <Btn big icon="check" title="image.cropDone" onClick={() => applyCrop()} disabled={none} />
            <Btn text icon="clean" title="image.cropReset" onClick={() => { setRatio('free'); setCropBox({ x: 0, y: 0, w: 1, h: 1 }); patch(d => ({ ...d, geom: { ...d.geom, angle: 0 } })); }} disabled={none} />
          </Group>
          <Group label="image.group.turn">
            <Btn text icon="rotate" title="image.turnRight" onClick={() => turn(1)} disabled={none} />
            <Btn text icon="undo" title="image.turnLeft" onClick={() => turn(-1)} disabled={none} />
            <Btn text icon="swap" title="image.flipH" onClick={() => flip('h')} disabled={none} />
            <Btn text icon="sort" title="image.flipV" onClick={() => flip('v')} disabled={none} />
          </Group>
        </>}

        {tab === 'view' && <>
          <Group label="letter.group.zoom">
            <Btn big icon="zoomin" title="letter.zoomIn" onClick={() => setZoom(ZOOMS.find(z => z > k + 0.001) ?? 8)} disabled={none} />
            <Btn big icon="zoomout" title="letter.zoomOut" onClick={() => setZoom([...ZOOMS].reverse().find(z => z < k - 0.001) ?? 0.02)} disabled={none} />
            <Btn big icon="onepage" title="ui.fitAll" onClick={() => setZoom('fit')} disabled={none} />
            <Btn big icon="target" title="image.actualSize" onClick={() => setZoom(1 / dpr)} disabled={none} />
          </Group>
          <Group label="image.group.see">
            <Btn big icon="compare" title="image.compare" active={compare !== null} onClick={() => setCompare(c => (c === null ? 0.5 : null))} disabled={none} />
            <Btn big icon="barchart" title="image.histogram" active={showHist} onClick={() => setShowHist(v => !v)} />
          </Group>
        </>}

        {tab === 'oi1' && <>
          <Group label="image.group.send" accent={appColor('letter')}>
            <Btn big icon="letter" title="image.toLetter" onClick={() => void sendToLetter()} disabled={none} />
            <Btn big icon="stage" title="image.toStage" onClick={() => void sendToStage()} disabled={none} />
            <Btn big icon="pen" title="image.toDraw" onClick={() => void sendToDraw()} disabled={none} />
            <Btn big icon="outline" title="image.toNotes" onClick={() => void sendToNotes()} disabled={none} />
          </Group>
          <Group label="letter.group.withProdfos" accent={appColor('prodfos')}>
            <Btn big icon="pdf" title="letter.savePdf" onClick={() => void exportAs('pdf')} disabled={none} />
          </Group>
          <Group label="letter.group.apps">
            <AppKeys apps={shell.apps()} self="image" onOpen={id => shell.openModule(id)} />
          </Group>
          <Group label="letter.group.share">
            <Btn big icon="share" title="letter.share" onClick={() => void share()} disabled={none} />
            <Btn big icon="print" title="letter.print" onClick={() => void print()} disabled={none} />
          </Group>
        </>}
        {tab === 'convert' && <ConvertPanel shell={shell} source={convertSource} />}
      </div>
    </div>
  );

  // ---------- side panel ----------
  const sidePanel = side && doc && (
    <aside className={`im-side${narrow ? ' drawer' : ''}`} aria-label={t('image.panel')}>
      <div className="im-side-head">
        {side === 'looks' || side === 'crop'
          ? <b>{t(side === 'looks' ? 'image.looks' : 'image.tab.crop')}</b>
          : <div className="im-chips" role="tablist">{ADJUST_GROUPS.map(g => <button key={g.id} type="button" role="tab" aria-selected={side === g.id} className={side === g.id ? 'on' : ''} onClick={() => setSide(g.id)}>{t(`image.group.${g.id}` as MessageKey)}</button>)}</div>}
        <button type="button" className="im-x" aria-label={t('letter.close')} title={t('letter.close')} onClick={() => { if (side === 'crop') applyCrop(); else setSide(null); }}><Icon name="close" size={12} /></button>
      </div>
      <div className="im-side-body">
        {['light', 'color', 'detail', 'effects'].includes(side) && <>
          {ADJUST_GROUPS.find(g => g.id === side)!.keys.map(slider)}
          <button type="button" className="im-reset" onClick={() => resetAdjust(ADJUST_GROUPS.find(g => g.id === side)!.keys)}>{t('image.resetGroup')}</button>
        </>}
        {side === 'looks' && <>
          <label className="im-slider on" data-help="image.strength">
            <span className="im-sl-name">{t('image.strength')}</span><output>{Math.round(doc.lookAmount)}</output>
            <input type="range" min={0} max={100} value={Math.round(doc.lookAmount)} disabled={!doc.look} aria-label={t('image.strength')} style={{ '--v': `${doc.lookAmount}%` } as React.CSSProperties}
              onChange={e => setStrength(Number(e.target.value))} onPointerUp={endSlide} onKeyUp={endSlide} onBlur={endSlide} />
          </label>
          <div className="im-looks">
            <button type="button" className={`im-look${!doc.look ? ' on' : ''}`} onClick={() => setLook(null)}>
              {thumbs.none ? <img src={thumbs.none} alt="" /> : <span className="im-look-wait" />}<span>{t('image.noLook')}</span>
            </button>
            {LOOKS.map(l => (
              <button key={l.id} type="button" className={`im-look${doc.look === l.id ? ' on' : ''}`} data-look={l.id} onClick={() => setLook(l.id)}>
                {thumbs[l.id] ? <img src={thumbs[l.id]} alt="" /> : <span className="im-look-wait" />}<span>{t(`image.look.${l.id}` as MessageKey)}</span>
              </button>
            ))}
          </div>
        </>}
        {side === 'crop' && <>
          <button type="button" className="im-done" onClick={() => applyCrop()}>{t('image.cropDone')}</button>
          <div className="im-ratios">{RATIOS.map(r => <button key={r.id} type="button" className={ratio === r.id ? 'on' : ''} onClick={() => pickRatio(r.id)}>{t(`image.ratio.${r.id}` as MessageKey)}</button>)}</div>
          <label className={`im-slider${doc.geom.angle ? ' on' : ''}`} data-help="image.straighten">
            <span className="im-sl-name">{t('image.straighten')}</span><output>{doc.geom.angle.toFixed(1)}°</output>
            <input type="range" min={-45} max={45} step={0.5} value={doc.geom.angle} aria-label={t('image.straighten')} style={{ '--v': `${((doc.geom.angle + 45) / 90) * 100}%` } as React.CSSProperties}
              onChange={e => setAngle(Number(e.target.value))} onPointerUp={endSlide} onKeyUp={endSlide} onBlur={endSlide}
              onDoubleClick={() => { slideStart.current = null; patch(d => ({ ...d, geom: { ...d.geom, angle: 0 } })); }} />
          </label>
        </>}
      </div>
    </aside>
  );

  // ---------- the page ----------
  const cw = Math.max(1, Math.round(out.w * k)), ch = Math.max(1, Math.round(out.h * k));
  const histPath = hist ? (() => { const mx = Math.max(...hist, 1e-6); return `M0 40 ${hist.map((v, i) => `L${(i / 63) * 120} ${40 - (v / mx) * 38}`).join(' ')} L120 40Z`; })() : '';
  return (
    <div className={`imgapp${narrow ? ' narrow' : ''}`} ref={rootRef} tabIndex={-1} onKeyDown={onKey} onKeyUp={e => { if (e.key === '\\' || e.key.toLowerCase() === 'b') setHolding(false); }}>
      {ribbon}
      <div className="im-body">
        <div className="im-main">
          <div className="im-scroll" ref={scroller}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = Array.from(e.dataTransfer.files)[0]; if (f) void loadFile({ name: f.name, type: f.type, text: () => f.text(), arrayBuffer: () => f.arrayBuffer() }); }}>
            {!doc && (
              <div className="im-start">
                <div className="im-start-card">
                  <h2>{t('image.startTitle')}</h2>
                  <p>{t('image.startLead')}</p>
                  <div className="im-start-btns">
                    <button type="button" className="primary" onClick={() => fileInput.current?.click()}><Icon name="open" size={16} /> {t('image.open')}</button>
                    <button type="button" onClick={() => void pasteImage()}><Icon name="paste" size={16} /> {t('image.paste')}</button>
                  </div>
                  <p className="im-start-or">{t('image.trySample')}</p>
                  <div className="im-samples">{SAMPLES.map(s => <SampleTile key={s} id={s} onPick={() => openSample(s)} />)}</div>
                </div>
              </div>
            )}
            {doc && (
              <div className="im-stage" style={{ width: Math.max(cw + pad, area.w), height: Math.max(ch + pad, area.h) }}>
                <div className="im-frame" style={{ width: cw, height: ch }}
                  onPointerDown={() => { if (!cropping) holdTimer.current = window.setTimeout(() => setHolding(true), 450); }}
                  onPointerUp={() => { window.clearTimeout(holdTimer.current); setHolding(false); }} onPointerLeave={() => { window.clearTimeout(holdTimer.current); setHolding(false); }} onPointerCancel={() => { window.clearTimeout(holdTimer.current); setHolding(false); }}
                  onPointerMove={() => window.clearTimeout(holdTimer.current)}>
                  <canvas ref={canvasRef} className="im-canvas" role="img" aria-label={title} />
                  <canvas ref={beforeRef} className="im-before" aria-hidden="true" hidden={compare === null && !holding}
                    style={{ clipPath: holding ? 'none' : `inset(0 ${(1 - (compare ?? 0.5)) * 100}% 0 0)` }} />
                  {compare !== null && !holding && !cropping && (
                    <div className="im-split" style={{ left: `${compare * 100}%` }}
                      onPointerDown={e => { e.stopPropagation(); (e.currentTarget as Element).setPointerCapture(e.pointerId); }}
                      onPointerMove={e => { if (!(e.buttons & 1) && e.pointerType === 'mouse') return; const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); setCompare(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))); }}>
                      <span className="im-split-knob" aria-hidden="true">⟷</span>
                      <span className="im-tag l">{t('image.before')}</span><span className="im-tag r">{t('image.after')}</span>
                    </div>
                  )}
                  {holding && <span className="im-tag hold">{t('image.before')}</span>}
                  {cropping && (
                    <div className="im-crop" ref={overlayRef} onPointerMove={cropMove} onPointerUp={cropUp} onPointerCancel={cropUp}>
                      <div className="im-crop-box" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
                        onPointerDown={e => cropDown(e, 'move')}>
                        <i className="g1" /><i className="g2" /><i className="g3" /><i className="g4" />
                        {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => <span key={h} className={`im-h ${h}`} data-handle={h} onPointerDown={e => cropDown(e, h)} />)}
                        <span className="im-crop-size">{Math.round(box.w * out.w)} × {Math.round(box.h * out.h)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {doc && <FastScroll target={scroller} />}
          {doc && tip && !cropping && !(narrow && side) && (
            <div className="im-tip" role="status">
              <span className="im-tip-icon" aria-hidden="true">✦</span>
              <span>{t(`image.tip.${tip}` as MessageKey)}</span>
              <button type="button" className="primary" onClick={applyTip}>{t('image.tipFix')}</button>
              <button type="button" aria-label={t('letter.close')} title={t('letter.close')} onClick={() => setTip(null)}><Icon name="close" size={11} /></button>
            </div>
          )}
          {doc && showHist && hist && !narrow && (
            <svg className="im-hist" viewBox="0 0 120 40" aria-label={t('image.histogram')} role="img"><path d={histPath} /></svg>
          )}
          {busy && <div className="im-busy" role="status">{busy}</div>}
        </div>
        {sidePanel}
        {copilot && <Copilot host={copilotHost} ai={shell.ai} onClose={() => { setCopilot(false); rootRef.current?.focus(); }} />}
      </div>
      <footer className="status">
        <span>{doc ? `${outputSize(doc).w} × ${outputSize(doc).h} px` : t('image.noPhoto')}{doc?.look ? ` · ${t(`image.look.${doc.look}` as MessageKey)}` : ''}</span>
        {note && <span className="im-note" role="status" onAnimationEnd={() => setNote('')}>{note}</span>}
        <span className="status-file">{fileName || `${title}.oi1img`}</span>
        <span className="status-zoom">
          <button type="button" aria-label={t('letter.zoomOut')} title={t('letter.zoomOut')} onClick={() => setZoom([...ZOOMS].reverse().find(z => z < k - 0.001) ?? 0.02)} disabled={none}>−</button>
          <input type="range" min={2} max={800} step={1} value={none ? 100 : Math.round(k * 100)} aria-label={t('letter.zoom')} onChange={e => setZoom(Number(e.target.value) / 100)} onDoubleClick={() => setZoom('fit')} disabled={none} />
          <button type="button" aria-label={t('letter.zoomIn')} title={t('letter.zoomIn')} onClick={() => setZoom(ZOOMS.find(z => z > k + 0.001) ?? 8)} disabled={none}>+</button>
          <span className="pct">{none ? '' : `${Math.round(k * 100)}%`}</span>
          <button type="button" className="fit" title={t('ui.fitAll')} aria-label={t('ui.fitAll')} onClick={() => setZoom('fit')} disabled={none}><Icon name="onepage" size={13} /></button>
        </span>
      </footer>
      <input ref={fileInput} type="file" accept={[...IMAGE_TYPES, '.oi1img'].join(',')} hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) void loadFile({ name: f.name, type: f.type, text: () => f.text(), arrayBuffer: () => f.arrayBuffer() }); e.target.value = ''; }} />
      {panel === 'file' && (
        <FileMenu fileName={fileName || `${title}.oi1img`} onClose={() => setPanel(null)}
          onNew={() => shell.openModule('image')} onOpen={async () => { const f = await shell.openFile(EXTENSIONS); if (f) void loadFile(f); }} onSave={() => void save()}
          onPrint={() => { setPanel(null); void print(); }}
          saveChoices={[
            { id: 'oi1img' as ExportFormat, icon: 'save', label: t('image.format.oi1img'), hint: '.oi1img' },
            { id: 'jpg' as ExportFormat, icon: 'image', label: t('image.format.jpg'), hint: '.jpg' },
            { id: 'png' as ExportFormat, icon: 'image', label: t('image.format.png'), hint: '.png' },
            { id: 'webp' as ExportFormat, icon: 'image', label: t('image.format.webp'), hint: '.webp' },
            { id: 'avif' as ExportFormat, icon: 'image', label: t('image.format.avif'), hint: '.avif' },
            { id: 'pdf' as ExportFormat, icon: 'pdf', label: t('image.format.pdf'), hint: '.pdf' },
          ]}
          onSaveAs={f => void exportAs(f)}
          listRecent={shell.recent.list} onOpenRecent={async (r: RecentFile) => { const f = await shell.recent.open(r.id); if (f) void loadFile(f); }} />
      )}
    </div>
  );
}

function SampleTile({ id, onPick }: { id: SampleId; onPick: () => void }) {
  const [src, setSrc] = useState('');
  useEffect(() => { const tm = window.setTimeout(() => setSrc(paintSample(id, 240, 160)), 30); return () => window.clearTimeout(tm); }, [id]);
  return (
    <button type="button" className="im-sample" data-sample={id} onClick={onPick}>
      {src ? <img src={src} alt="" /> : <span className="im-look-wait" />}<span>{t(`image.sample.${id}` as MessageKey)}</span>
    </button>
  );
}

function useNarrow(ref: React.RefObject<HTMLElement | null>) {
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < 760));
    ro.observe(el);
    setNarrow(el.clientWidth < 760);
    return () => ro.disconnect();
  }, [ref]);
  return narrow;
}

export type { Adjust };
