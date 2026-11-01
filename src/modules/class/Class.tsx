// Office Class: the spreadsheet. A grid of cells with formulas, number formats and several sheets,
// saved as Excel .xlsx or .csv, and linked to the other OI1 apps (tables go to and from Office Letter).
// Like Excel: fonts, borders, merged cells, wrapped text, frozen panes, the fill handle, filters,
// conditional formatting, charts, find and replace, zoom and printing.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { FileRef, Handoff, HandoffLink, OpenedFile, RecentFile, ShellApi, TableData } from '../../shell/contract';
import { t, type MessageKey } from '../../shell/i18n';
import { useLanguage } from '../../shell/useLanguage';
import { onRatesChange } from '../../shell/rates';
import { isLiveId, liveStore, newLiveId, tableText, type SyncState } from '../../shell/live';
import { useTheme } from '../../shell/theme';
import { parseCsv, toCsv } from '../../formats/csv';
import { cellName, colName, isError, moveRefs, parseCell, type Scalar } from '../../formats/formula';
import {
  computeBook, currencyFor, defaultDecimals, display, emptySheet, key, naturalAlign, readEntry, unkey, usedRange,
  type BorderLine, type Cell, type CellStyle, type Chart, type CondRule, type Merge, type NumberFormat, type SheetData, type WorkbookData,
} from '../../formats/sheet';
import { sheetToTable, tableFromHtml, tableFromText, tableToCells, tableToHtml, tableToText, type Range } from '../../formats/table';
import { FileMenu } from '../../ui/FileMenu';
import { Btn, ColorGrid, Combo, Drop, Group, Icon, MenuItem, RibbonToggle, type ComboGroup } from '../../ui/kit';
import { AppKeys, appColor } from '../../ui/AppKeys';
import { TutoTab } from '../../ui/tuto/Tuto';
import { FONT_GROUPS, FONT_SIZES, cssFont } from '../letter/model';
import { CHART_TYPES, ChartSvg, DARK, LIGHT, PALETTES, chartData, svgToPng } from './chart';
import { condLooks, type CondLook } from './cond';
import { autofill, type Box } from './fill';
import { InsertFunction, functionsIn, type FnCategory } from './functions';
import { Converter, FEATURED, ProGallery, toolById, type ProCat } from './pro/ProUi';
import { PRO_CATEGORIES, buildTool, sheetNameFor, type ProTool } from './pro/tools';
import { AUDITS, AUDIT_SHORT, runAudit, type AuditId } from './pro/audit';
import { tx, type Lang } from './pro/build';
import { CondDialog, FilterMenu, FindPanel, HIGHLIGHT_KINDS, TOP_KINDS, type CondKind, type FindOptions } from './panels';
import { borderCss, printHtml, sheetHtml } from './print';
import { PrintPanel, fitLabel, hfSample, hfTemplates, marginLabel, paperLabel } from './PrintPanel';
import { FITS, MARGINS, PAPERS, filteredRows, pagesHtml, planPages, setupOf, type PrintScope, type PrintSetup } from './printSetup';
import { ConvertPanel } from '../../ui/convert/ConvertPanel';
import type { ConvertSource } from '../../shell/convert';
import { GoalSeekDialog, ScenarioDialog, SolverDialog, ValidationAlert, ValidationDialog, setRule } from './whatIfUi';
import { customValue, invalidCells, isValid, listChoices, validationAt, withValues, type Validation } from './whatif';

const FN_ICON: Record<'financial' | 'logical' | 'text' | 'date' | 'lookup' | 'math', string> = {
  financial: 'currency', logical: 'check', text: 'case', date: 'date', lookup: 'search', math: 'sum',
};
import { classCopilot, type ClassBridge } from './copilot';
import { Copilot, CopilotButton, useCopilotShortcut } from '../../ui/Copilot';
import { usePinchZoom } from '../../ui/pinch';
import { FastScroll } from '../../ui/FastScroll';

export const EXTENSIONS = ['.xlsx', '.csv', '.tsv'];
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ROW_H = 26;
const COL_W = 104;
/** Screen pixels per point of font size: 11 pt shows at 13.5 px, the grid's usual text. */
const PX_PER_PT = 13.5 / 11;
const DEFAULT_PT = 11;
const ZOOMS = [0.25, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 3, 4];

interface Pos { c: number; r: number }
interface Sel { a: Pos; f: Pos }
interface Saved { book: WorkbookData; active: number; link: HandoffLink | null; name: string }
type Tab = 'home' | 'insert' | 'formulas' | 'metiers' | 'data' | 'layout' | 'view' | 'chart' | 'oi1' | 'convert';

const boxOf = (s: Sel): Range => ({ c1: Math.min(s.a.c, s.f.c), r1: Math.min(s.a.r, s.f.r), c2: Math.max(s.a.c, s.f.c), r2: Math.max(s.a.r, s.f.r) });
const newId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const decimalComma = (lang: string) => new Intl.NumberFormat(lang).format(1.5).includes(',');
const overlaps = (a: Merge, b: Merge) => a.c1 <= b.c2 && b.c1 <= a.c2 && a.r1 <= b.r2 && b.r1 <= a.r2;
const isLight = (hex?: string) => {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
};

function bookFromTable(table: TableData, name: string): WorkbookData {
  return { sheets: [{ name, cells: tableToCells(table), widths: {} }] };
}

// Text width, for wrapped rows and text that runs over into empty neighbors.
let measureCtx: CanvasRenderingContext2D | null = null;
const measured = new Map<string, number>();
function textWidth(text: string, font: string): number {
  const k = `${font}|${text}`;
  const hit = measured.get(k);
  if (hit !== undefined) return hit;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 7;
  measureCtx.font = font;
  const w = measureCtx.measureText(text).width;
  if (measured.size > 5000) measured.clear();
  measured.set(k, w);
  return w;
}
const canvasFont = (st: CellStyle | undefined, px: number) =>
  `${st?.italic ? 'italic ' : ''}${st?.bold ? '700 ' : ''}${px}px ${st?.font ? cssFont(st.font) : '"DM Sans Variable", system-ui, sans-serif'}`;

/** Lines a wrapped text takes in a column of `width` pixels. */
function wrapLines(text: string, width: number, font: string): number {
  let lines = 0;
  for (const para of text.split('\n')) {
    let line = 0;
    lines++;
    for (const word of para.split(/(\s+)/)) {
      const w = textWidth(word, font);
      if (line + w > width && line > 0 && word.trim()) { lines++; line = w; } else line += w;
    }
  }
  return lines;
}

export default function Class({ shell, file, handoff }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff }) {
  const [initial, setInitial] = useState<Saved | null>(null);
  useEffect(() => {
    void (async () => {
      let saved: Saved | null = null;
      try {
        const raw = await shell.storage.load('book');
        if (raw) saved = JSON.parse(raw) as Saved;
      } catch { /* unreadable autosave */ }
      if (!saved && handoff?.kind === 'table') {
        const name = handoff.link ? t('class.tableFrom', { title: handoff.link.title }) : handoff.title ?? '';
        saved = { book: bookFromTable(handoff.table, t('class.sheet', { n: 1 })), active: 0, link: handoff.link ?? null, name };
      }
      setInitial(saved ?? { book: { sheets: [emptySheet(t('class.sheet', { n: 1 }))] }, active: 0, link: null, name: '' });
    })();
  }, [shell, handoff]);
  if (!initial) return <div className="class" />;
  return <ClassEditor shell={shell} file={file} handoff={handoff} initial={initial} />;
}

function ClassEditor({ shell, file, handoff, initial }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff; initial: Saved }) {
  const lang = useLanguage();
  const theme = useTheme();
  const [book, setBookState] = useState<WorkbookData>(initial.book);
  const bookRef = useRef(book);
  const [active, setActive] = useState(Math.min(initial.active, initial.book.sheets.length - 1));
  const [link, setLink] = useState<HandoffLink | null>(initial.link);
  const linkRef = useRef(link);
  linkRef.current = link;
  const [fileName, setFileName] = useState(initial.name);
  const [fileRef, setFileRef] = useState<FileRef | null>(null);
  const [sel, setSel] = useState<Sel>({ a: { c: 0, r: 0 }, f: { c: 0, r: 0 } });
  const [edit, setEdit] = useState<{ text: string; mode: 'enter' | 'edit'; where: 'cell' | 'bar' } | null>(null);
  const [panel, setPanel] = useState<null | 'file'>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const [headings, setHeadings] = useState(true);
  const [painter, setPainter] = useState<CellStyle | null>(null);
  const [find, setFind] = useState<null | { replace: boolean }>(null);
  const [findStatus, setFindStatus] = useState('');
  const [filterMenu, setFilterMenu] = useState<null | { c: number; left: number; top: number }>(null);
  const [condDialog, setCondDialog] = useState<CondKind | null>(null);
  const [fnDialog, setFnDialog] = useState<FnCategory | 'all' | null>(null);
  const [proCat, setProCat] = useState<ProCat>(() => { try { return (localStorage.getItem('oi1.class.proCat') as ProCat) || 'all'; } catch { return 'all'; } });
  const [proDialog, setProDialog] = useState<null | 'gallery' | 'converter'>(null);
  const [chartSel, setChartSel] = useState<string | null>(null);
  const [fillTo, setFillTo] = useState<Box | null>(null);
  const [whatIf, setWhatIf] = useState<null | 'seek' | 'scen' | 'solver' | 'val'>(null);
  const [circles, setCircles] = useState<string[] | null>(null);
  const [vAlert, setVAlert] = useState<null | { rule: Validation; c: number; r: number; text: string; move?: Pos }>(null);
  const [listMenu, setListMenu] = useState<null | { c: number; r: number; left: number; top: number; choices: string[] }>(null);
  // The list of a cell's choices closes when the selection moves, on Escape, or on a click elsewhere.
  useEffect(() => { setListMenu(null); }, [sel, active]);
  useEffect(() => {
    if (!listMenu) return;
    const down = (e: PointerEvent) => { if (!(e.target as Element).closest?.('.val-list, .val-drop')) setListMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setListMenu(null); };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', onKey); };
  }, [listMenu]);
  const undo = useRef<WorkbookData[]>([]);
  const redo = useRef<WorkbookData[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const sheet = book.sheets[active] ?? book.sheets[0];
  const [ratesTick, setRatesTick] = useState(0);
  useEffect(() => onRatesChange(() => setRatesTick(n => n + 1)), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allValues = useMemo(() => computeBook(book), [book, ratesTick]);
  const values = allValues[active] ?? allValues[0];
  const currency = currencyFor(lang, book);
  const used = useMemo(() => usedRange(sheet), [sheet]);
  const looks = useMemo(() => condLooks(sheet, values), [sheet, values]);
  const merges = sheet.merges ?? [];
  const z = zoom;

  // ---------- merged cells ----------
  const mergeAt = (c: number, r: number) => merges.find(m => c >= m.c1 && c <= m.c2 && r >= m.r1 && r <= m.r2);
  /** A box grown to cover every merged block it touches, like Excel's selection. */
  const grow = (b: Range): Range => {
    let out = { ...b };
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (const m of merges) if (overlaps(out, m)) {
        const n = { c1: Math.min(out.c1, m.c1), r1: Math.min(out.r1, m.r1), c2: Math.max(out.c2, m.c2), r2: Math.max(out.r2, m.r2) };
        if (n.c1 !== out.c1 || n.r1 !== out.r1 || n.c2 !== out.c2 || n.r2 !== out.r2) { out = n; changed = true; }
      }
      if (!changed) break;
    }
    return out;
  };
  const range = grow(boxOf(sel));
  const single = range.c1 === range.c2 && range.r1 === range.r2 || (() => { const m = mergeAt(sel.a.c, sel.a.r); return !!m && m.c1 === range.c1 && m.r1 === range.r1 && m.c2 === range.c2 && m.r2 === range.r2; })();

  // ---------- saving state ----------
  const saveTimer = useRef(0);
  const autosave = useCallback((b: WorkbookData, a: number, l: HandoffLink | null, name: string) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void shell.storage.save('book', JSON.stringify({ book: b, active: a, link: l, name } satisfies Saved));
    }, 400);
  }, [shell]);
  useEffect(() => { autosave(book, active, link, fileName); }, [book, active, link, fileName, autosave]);

  const title = fileName ? fileName.replace(/\.(xlsx|csv|tsv)$/i, '') : t('class.untitled');
  useEffect(() => { shell.setTitle(title); }, [shell, title]);
  // Renaming the tab renames the workbook: it saves and exports under that name.
  useEffect(() => { shell.onRename?.(name => setFileName(`${name}.xlsx`)); return () => shell.onRename?.(null); }, [shell]);

  /** Every change goes through here, so Undo can bring the workbook back. */
  const commit = (next: WorkbookData) => {
    undo.current.push(bookRef.current);
    if (undo.current.length > 200) undo.current.shift();
    redo.current = [];
    bookRef.current = next;
    setBookState(next);
  };
  const setBook = (b: WorkbookData) => { bookRef.current = b; setBookState(b); };
  const changeSheet = (mutate: (s: SheetData) => void) => {
    const b = bookRef.current;
    const old = b.sheets[active];
    const s: SheetData = {
      ...old, cells: { ...old.cells }, widths: { ...old.widths }, heights: { ...old.heights },
      merges: [...(old.merges ?? [])], rules: [...(old.rules ?? [])], charts: [...(old.charts ?? [])],
    };
    mutate(s);
    // Leave out empty parts, so saved files stay small.
    if (!Object.keys(s.heights ?? {}).length) delete s.heights;
    for (const k of ['merges', 'rules', 'charts'] as const) if (!s[k]?.length) delete s[k];
    commit({ ...b, sheets: b.sheets.map((x, i) => (i === active ? s : x)) });
  };
  const undoOnce = () => { const prev = undo.current.pop(); if (prev) { redo.current.push(bookRef.current); setBook(prev); } };
  const redoOnce = () => { const next = redo.current.pop(); if (next) { undo.current.push(bookRef.current); setBook(next); } };

  // ---------- cells ----------
  const setEntry = (cells: Record<string, Cell>, c: number, r: number, text: string) => {
    const k = key(c, r);
    const old = cells[k];
    const { input, format } = old?.style?.format === 'text' ? { input: text, format: undefined } : readEntry(text, decimalComma(lang));
    const style = format && !old?.style?.format ? { ...old?.style, format } : old?.style;
    if (!input && !style) delete cells[k];
    else cells[k] = { input, ...(style ? { style } : {}) };
  };
  /** The rule an entry would break in this cell, or null (Data › Data validation). */
  const breaks = (c: number, r: number, text: string): Validation | null => {
    const v = validationAt(sheet.validations, c, r);
    if (!v || v.kind === 'any') return null;
    const b = bookRef.current, s = b.sheets[active];
    const cells = { ...s.cells };
    setEntry(cells, c, r, text);
    const next = { ...b, sheets: b.sheets.map((x, i) => (i === active ? { ...s, cells } : x)) };
    const vals = computeBook(next)[active];
    const k = key(c, r);
    return isValid(v, vals.get(k), cells[k]?.input ?? '', vals, () => customValue(next, active, v, c, r)) ? null : v;
  };
  const commitEdit = (move?: Pos) => {
    if (!edit) return;
    const { c, r } = sel.a;
    const changed = (sheet.cells[key(c, r)]?.input ?? '') !== edit.text;
    const broken = changed ? breaks(c, r, edit.text) : null;
    if (broken) { setVAlert({ rule: broken, c, r, text: edit.text, move }); setEdit(null); return; }
    if (changed) changeSheet(s => setEntry(s.cells, c, r, edit.text));
    setEdit(null);
    if (move) go(move.c, move.r);
    gridRef.current?.focus();
  };
  const startEdit = (text: string | null, mode: 'enter' | 'edit', where: 'cell' | 'bar' = 'cell') => {
    const cell = sheet.cells[key(sel.a.c, sel.a.r)];
    setSel(s => ({ a: s.a, f: s.a }));
    setChartSel(null);
    setEdit({ text: text ?? cell?.input ?? '', mode, where });
  };
  // Like Excel: after typing across a row with Tab, Enter goes back to the column the row started in.
  const tabStart = useRef<number | null>(null);
  const go = (c: number, r: number, extend = false) => {
    tabStart.current = null;
    const p = { c: Math.max(0, c), r: Math.max(0, r) };
    setChartSel(null);
    setSel(s => (extend ? { a: s.a, f: p } : { a: p, f: p }));
  };
  const forBox = (b: Range, fn: (c: number, r: number) => void) => {
    for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) fn(c, r);
  };
  const forRange = (fn: (c: number, r: number) => void) => forBox(range, fn);
  const tidy = (st: CellStyle): CellStyle => Object.fromEntries(Object.entries(st).filter(([, v]) => v !== undefined && v !== false)) as CellStyle;
  const putStyle = (s: SheetData, c: number, r: number, style: CellStyle) => {
    const k = key(c, r);
    const cell = s.cells[k] ?? { input: '' };
    const st = tidy(style);
    if (st.borders && !Object.values(st.borders).some(Boolean)) delete st.borders;
    if (!cell.input && !Object.keys(st).length) delete s.cells[k];
    else s.cells[k] = { input: cell.input, ...(Object.keys(st).length ? { style: st } : {}) };
  };
  const styleRange = (patch: (st: CellStyle, c: number, r: number) => CellStyle) =>
    changeSheet(s => forRange((c, r) => putStyle(s, c, r, patch({ ...s.cells[key(c, r)]?.style }, c, r))));
  const activeCell = sheet.cells[key(sel.a.c, sel.a.r)];
  const activeStyle = activeCell?.style ?? {};
  const toggle = (prop: 'bold' | 'italic' | 'underline' | 'strike' | 'wrap') => styleRange(st => ({ ...st, [prop]: !activeStyle[prop] }));
  const setFormat = (format: NumberFormat) => styleRange(st => ({ ...st, format: format === 'general' ? undefined : format, decimals: undefined }));
  const clearRange = () => changeSheet(s => forRange((c, r) => {
    const k = key(c, r);
    if (s.cells[k]?.style) s.cells[k] = { input: '', style: s.cells[k].style };
    else delete s.cells[k];
  }));
  const clearFormats = () => changeSheet(s => {
    forRange((c, r) => { const k = key(c, r); if (s.cells[k]?.input) s.cells[k] = { input: s.cells[k].input }; else delete s.cells[k]; });
    s.merges = (s.merges ?? []).filter(m => !overlaps(m, range));
  });
  const clearAll = () => changeSheet(s => {
    forRange((c, r) => { delete s.cells[key(c, r)]; });
    s.merges = (s.merges ?? []).filter(m => !overlaps(m, range));
  });

  // ---------- number formats ----------
  const shownDecimals = (st: CellStyle, v: Scalar | undefined) => {
    if (st.decimals !== undefined) return st.decimals;
    const f = st.format ?? 'general';
    if (f !== 'general' && f !== 'integer') return f === 'percent' ? 0 : defaultDecimals(f);
    if (typeof v !== 'number' || Number.isInteger(v)) return 0;
    return Math.min(10, (String(Number(v.toPrecision(10))).split('.')[1] ?? '').length);
  };
  const stepDecimals = (by: 1 | -1) => {
    const d = Math.max(0, Math.min(15, shownDecimals(activeStyle, values.get(key(sel.a.c, sel.a.r))) + by));
    styleRange(st => ({ ...st, format: !st.format || st.format === 'general' || st.format === 'integer' ? 'number' : st.format, decimals: d, thousands: st.format ? st.thousands : st.thousands ?? false }));
  };

  // ---------- fonts ----------
  const fontShown = activeStyle.font ?? 'Calibri';
  const sizeShown = activeStyle.size ?? DEFAULT_PT;
  const fontGroups: ComboGroup[] = FONT_GROUPS.map(g => ({ label: t(`letter.fonts.${g.kind}` as MessageKey), items: g.fonts }));
  const setSize = (pt: number) => { if (pt > 0 && pt < 410) styleRange(st => ({ ...st, size: pt === DEFAULT_PT ? undefined : pt })); };
  const stepSize = (dir: 1 | -1) => setSize(dir > 0 ? FONT_SIZES.find(n => n > sizeShown) ?? sizeShown + 10 : [...FONT_SIZES].reverse().find(n => n < sizeShown) ?? Math.max(1, sizeShown - 1));

  // ---------- borders ----------
  type BorderKind = 'bottom' | 'top' | 'left' | 'right' | 'none' | 'all' | 'outside' | 'thickBox' | 'thickBottom' | 'doubleBottom' | 'topBottom';
  const [borderColor, setBorderColor] = useState<string | undefined>(undefined);
  const setBorders = (kind: BorderKind) => {
    const line = (style: BorderLine['style'] = 'thin'): BorderLine => ({ style, ...(borderColor ? { color: borderColor } : {}) });
    styleRange((st, c, r) => {
      const b = { ...st.borders };
      const edge = { top: r === range.r1, bottom: r === range.r2, left: c === range.c1, right: c === range.c2 };
      if (kind === 'none') return { ...st, borders: undefined };
      if (kind === 'all') return { ...st, borders: { top: line(), right: line(), bottom: line(), left: line() } };
      if (kind === 'outside' || kind === 'thickBox') {
        const l = line(kind === 'thickBox' ? 'thick' : 'thin');
        if (edge.top) b.top = l; if (edge.bottom) b.bottom = l; if (edge.left) b.left = l; if (edge.right) b.right = l;
      }
      if (kind === 'bottom' && edge.bottom) b.bottom = line();
      if (kind === 'top' && edge.top) b.top = line();
      if (kind === 'left' && edge.left) b.left = line();
      if (kind === 'right' && edge.right) b.right = line();
      if (kind === 'thickBottom' && edge.bottom) b.bottom = line('thick');
      if (kind === 'doubleBottom' && edge.bottom) b.bottom = line('double');
      if (kind === 'topBottom') { if (edge.top) b.top = line(); if (edge.bottom) b.bottom = line(); }
      return { ...st, borders: b };
    });
  };

  // ---------- merging ----------
  const merge = (how: 'center' | 'across' | 'cells' | 'unmerge') => {
    if (how === 'unmerge') { changeSheet(s => { s.merges = (s.merges ?? []).filter(m => !overlaps(m, range)); }); return; }
    if (single) return;
    // Excel keeps only the top left value; warn like it does when others would be lost.
    let others = 0;
    forRange((c, r) => { if ((c !== range.c1 || r !== range.r1) && sheet.cells[key(c, r)]?.input) others++; });
    if (others && !confirm(t('class.mergeLoses'))) return;
    changeSheet(s => {
      const blocks: Merge[] = how === 'across'
        ? Array.from({ length: range.r2 - range.r1 + 1 }, (_, i) => ({ c1: range.c1, r1: range.r1 + i, c2: range.c2, r2: range.r1 + i }))
        : [{ ...range }];
      s.merges = [...(s.merges ?? []).filter(m => !overlaps(m, range)), ...blocks.filter(b => b.c1 !== b.c2 || b.r1 !== b.r2)];
      for (const b of blocks) forBox(b, (c, r) => { if (c !== b.c1 || r !== b.r1) { const k = key(c, r); if (s.cells[k]?.style) s.cells[k] = { input: '', style: s.cells[k].style }; else delete s.cells[k]; } });
      if (how === 'center') putStyle(s, range.c1, range.r1, { ...s.cells[key(range.c1, range.r1)]?.style, align: 'center' });
    });
  };
  const mergedHere = merges.some(m => overlaps(m, range));

  // ---------- rows and columns ----------
  /** Inserts (by > 0) or deletes (by < 0) rows or columns at `at`, moving cells and the formulas that point at them. */
  const shift = (axis: 'r' | 'c', at: number, by: number) => changeSheet(s => {
    const gone = by < 0 ? -by : 0;
    const place = (v: number) => (by > 0 ? (v >= at ? v + by : v) : v >= at + gone ? v - gone : v >= at ? null : v);
    const moved: Record<string, Cell> = {};
    for (const [k, cell] of Object.entries(s.cells)) {
      const p = unkey(k);
      const nv = place(axis === 'r' ? p.r : p.c);
      if (nv === null) continue;
      moved[axis === 'r' ? key(p.c, nv) : key(nv, p.r)] = cell;
    }
    // A formula pointing into deleted rows now points at the row that took their place, so ranges shrink.
    const ref = (v: number) => place(v) ?? at;
    for (const [k, cell] of Object.entries(moved)) {
      if (cell.input.startsWith('=')) moved[k] = { ...cell, input: moveRefs(cell.input, (c, r, _ac, _ar, sh) => (sh ? { c, r } : axis === 'r' ? { c, r: ref(r) } : { c: ref(c), r })) };
    }
    s.cells = moved;
    const sizes = (from: Record<number, number> | undefined) => {
      const out: Record<number, number> = {};
      for (const [i, px] of Object.entries(from ?? {})) { const n = place(Number(i)); if (n !== null) out[n] = px; }
      return out;
    };
    if (axis === 'c') s.widths = sizes(s.widths); else s.heights = sizes(s.heights);
    // Blocks that refer to cells move along: merges, rules, charts and the filter.
    const moveBox = (b: Merge): Merge | null => {
      const [lo, hi] = axis === 'r' ? [b.r1, b.r2] : [b.c1, b.c2];
      let nlo = place(lo), nhi = place(hi);
      if (nlo === null && nhi === null) {
        // Fully deleted unless it reaches past the deleted rows.
        if (hi < at + gone) return null;
      }
      nlo ??= at; nhi ??= Math.max(at - 1, nlo);
      if (nhi < nlo) return null;
      return axis === 'r' ? { ...b, r1: nlo, r2: nhi } : { ...b, c1: nlo, c2: nhi };
    };
    s.merges = (s.merges ?? []).map(moveBox).filter((m): m is Merge => !!m && (m.c1 !== m.c2 || m.r1 !== m.r2));
    s.rules = (s.rules ?? []).flatMap(rule => { const b = moveBox(rule.range); return b ? [{ ...rule, range: b }] : []; });
    s.charts = (s.charts ?? []).flatMap(ch => { const b = moveBox(ch.range); return b ? [{ ...ch, range: b }] : []; });
    if (s.filter) { const b = moveBox(s.filter.range); if (b) s.filter = { ...s.filter, range: b }; else delete s.filter; }
    if (s.freeze && axis === 'r' && s.freeze.r > at) s.freeze = { ...s.freeze, r: Math.max(0, s.freeze.r + (by > 0 ? by : -Math.min(gone, s.freeze.r - at))) };
    if (s.freeze && axis === 'c' && s.freeze.c > at) s.freeze = { ...s.freeze, c: Math.max(0, s.freeze.c + (by > 0 ? by : -Math.min(gone, s.freeze.c - at))) };
  });

  // ---------- regions, sorting, filters ----------
  const filled = (c: number, r: number, s = sheet) => !!s.cells[key(c, r)]?.input;
  /** The block of filled cells around a cell, like Excel's Ctrl+A in a table. */
  const currentRegion = (p: Pos): Range => {
    const b = { c1: p.c, r1: p.r, c2: p.c, r2: p.r };
    for (let i = 0; i < 500; i++) {
      let changed = false;
      const rowHas = (r: number) => { for (let c = Math.max(0, b.c1 - 1); c <= b.c2 + 1; c++) if (filled(c, r)) return true; return false; };
      const colHas = (c: number) => { for (let r = Math.max(0, b.r1 - 1); r <= b.r2 + 1; r++) if (filled(c, r)) return true; return false; };
      if (b.r1 > 0 && rowHas(b.r1 - 1)) { b.r1--; changed = true; }
      if (rowHas(b.r2 + 1)) { b.r2++; changed = true; }
      if (b.c1 > 0 && colHas(b.c1 - 1)) { b.c1--; changed = true; }
      if (colHas(b.c2 + 1)) { b.c2++; changed = true; }
      if (!changed) break;
    }
    return b;
  };
  const tableRange = () => (single ? currentRegion(sel.a) : range);
  const hasHeader = (rg: Range) => (sheet.filter && sheet.filter.range.r1 === rg.r1)
    || Array.from({ length: rg.c2 - rg.c1 + 1 }, (_, i) => sheet.cells[key(rg.c1 + i, rg.r1)]).some(cell => cell?.style?.bold);

  const sortRows = (rg: Range, byCol: number, dir: 1 | -1, header: boolean) => {
    const r1 = header && rg.r2 > rg.r1 ? rg.r1 + 1 : rg.r1;
    const rows = Array.from({ length: rg.r2 - r1 + 1 }, (_, i) => r1 + i);
    const val = (r: number) => values.get(key(byCol, r)) ?? '';
    rows.sort((x, y) => {
      const a = val(x), b = val(y);
      if (a === '' && b !== '') return 1;
      if (b === '' && a !== '') return -1;
      if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
      return String(a).localeCompare(String(b), lang, { numeric: true }) * dir;
    });
    changeSheet(s => {
      const old = { ...s.cells };
      rows.forEach((from, i) => {
        for (let c = rg.c1; c <= rg.c2; c++) {
          const cell = old[key(c, from)];
          const to = key(c, r1 + i);
          if (!cell) { delete s.cells[to]; continue; }
          // Formulas keep pointing along their own row, like Excel's sort.
          const d = r1 + i - from;
          s.cells[to] = cell.input.startsWith('=') && d ? { ...cell, input: moveRefs(cell.input, (cc, rr, _ac, absR, sh) => ({ c: cc, r: absR || sh || rr < rg.r1 || rr > rg.r2 ? rr : rr + d })) } : cell;
        }
      });
      if (s.filter) s.filter = { ...s.filter, sort: { c: byCol, dir } };
    });
  };
  const sort = (dir: 1 | -1) => {
    const rg = single ? (used.rows >= 0 ? currentRegion(sel.a) : range) : range;
    sortRows(rg, Math.min(Math.max(sel.a.c, rg.c1), rg.c2), dir, hasHeader(rg));
  };
  const toggleFilter = () => {
    if (sheet.filter) { changeSheet(s => { delete s.filter; }); return; }
    const rg = tableRange();
    if (rg.r2 <= rg.r1 && !filled(rg.c1, rg.r1)) { shell.notify(t('class.filter.needTable')); return; }
    changeSheet(s => {
      s.filter = { range: rg, hidden: {} };
      // The header row stands out, like Excel's table header.
      for (let c = rg.c1; c <= rg.c2; c++) putStyle(s, c, rg.r1, { ...s.cells[key(c, rg.r1)]?.style, bold: true });
    });
  };
  const hiddenRows = useMemo(() => {
    const out = new Set<number>();
    const f = sheet.filter;
    if (!f) return out;
    const cols = Object.entries(f.hidden).filter(([, v]) => v.length).map(([c, v]) => [Number(c), new Set(v)] as const);
    if (!cols.length) return out;
    for (let r = f.range.r1 + 1; r <= f.range.r2; r++) {
      for (const [c, off] of cols) {
        const text = display(values.get(key(c, r)) ?? '', sheet.cells[key(c, r)]?.style, lang, currency);
        if (off.has(text)) { out.add(r); break; }
      }
    }
    return out;
  }, [sheet.filter, sheet.cells, values, lang, currency]);
  const filterValues = (c: number) => {
    const f = sheet.filter!;
    const set = new Set<string>();
    for (let r = f.range.r1 + 1; r <= f.range.r2; r++) set.add(display(values.get(key(c, r)) ?? '', sheet.cells[key(c, r)]?.style, lang, currency));
    return [...set].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, lang, { numeric: true })));
  };
  // ---------- data validation and what-if ----------
  const circleInvalid = () => {
    const bad = invalidCells(bookRef.current, active, values);
    setCircles(bad);
    shell.notify(bad.length ? t('class.val.invalidN', { n: bad.length }) : t('class.val.allValid'));
  };
  /** Values written by Goal Seek, Solver or a scenario: one change, so one Undo brings the old ones back. */
  const writeValues = (entries: [string, string][], extra?: (s: SheetData) => void) => changeSheet(s => {
    const next = withValues(s, entries);
    s.cells = next.cells;
    extra?.(s);
  });
  const removeDuplicates = () => {
    const rg = tableRange();
    const header = hasHeader(rg);
    const r1 = header ? rg.r1 + 1 : rg.r1;
    const seen = new Set<string>();
    const keep: number[] = [];
    for (let r = r1; r <= rg.r2; r++) {
      const sig = JSON.stringify(Array.from({ length: rg.c2 - rg.c1 + 1 }, (_, i) => values.get(key(rg.c1 + i, r)) ?? ''));
      if (seen.has(sig)) continue;
      seen.add(sig);
      keep.push(r);
    }
    const removed = rg.r2 - r1 + 1 - keep.length;
    if (removed) changeSheet(s => {
      const old = { ...s.cells };
      for (let r = r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) delete s.cells[key(c, r)];
      keep.forEach((from, i) => { for (let c = rg.c1; c <= rg.c2; c++) { const cell = old[key(c, from)]; if (cell) s.cells[key(c, r1 + i)] = cell; } });
    });
    shell.notify(removed ? t('class.dupRemoved', { n: removed, left: keep.length }) : t('class.dupNone'));
  };

  // ---------- smart tools ----------
  const autoSum = (fn = 'SUM') => {
    const num = (c: number, r: number) => typeof values.get(key(c, r)) === 'number';
    if (!single) {
      // A block of numbers: totals go in the row below it.
      changeSheet(s => { for (let c = range.c1; c <= range.c2; c++) s.cells[key(c, range.r2 + 1)] = { input: `=${fn}(${cellName(c, range.r1)}:${cellName(c, range.r2)})`, style: { bold: true } }; });
      return;
    }
    const { c, r } = sel.a;
    let top = r - 1;
    while (top >= 0 && num(c, top)) top--;
    if (top < r - 1) { startEdit(`=${fn}(${cellName(c, top + 1)}:${cellName(c, r - 1)})`, 'edit'); return; }
    let left = c - 1;
    while (left >= 0 && num(left, r)) left--;
    startEdit(left < c - 1 ? `=${fn}(${cellName(left + 1, r)}:${cellName(c - 1, r)})` : `=${fn}()`, 'edit');
  };

  // ---------- fill handle, Ctrl+D and Ctrl+R ----------
  const applyFill = (from: Box, to: Box) => changeSheet(s => {
    for (const [k, cell] of Object.entries(autofill(s.cells, from, to))) { if (cell) s.cells[k] = cell; else delete s.cells[k]; }
  });
  const fillDown = () => { if (range.r2 > range.r1) applyFill({ ...range, r2: range.r1 }, range); };
  const fillRight = () => { if (range.c2 > range.c1) applyFill({ ...range, c2: range.c1 }, range); };

  // ---------- clipboard ----------
  const clip = useRef<{ text: string; cells: Record<string, Cell>; origin: Pos } | null>(null);
  const tableOf = (rg: Range) => sheetToTable(sheet, rg, values, lang, currency);
  const onCopy = (e: React.ClipboardEvent, cut = false) => {
    if (edit || fromPanel(e)) return;
    e.preventDefault();
    const table = tableOf(range);
    const text = tableToText(table);
    e.clipboardData.setData('text/plain', text);
    e.clipboardData.setData('text/html', tableToHtml(table));
    const cells: Record<string, Cell> = {};
    forRange((c, r) => { const cell = sheet.cells[key(c, r)]; if (cell) cells[key(c - range.c1, r - range.r1)] = cell; });
    clip.current = { text, cells, origin: { c: range.c1, r: range.r1 } };
    if (cut) clearRange();
  };
  const pasteTable = (table: TableData) => changeSheet(s => {
    for (const [k, cell] of Object.entries(tableToCells(table, range.c1, range.r1))) {
      const old = s.cells[k];
      s.cells[k] = old?.style ? { ...cell, style: { ...old.style, ...cell.style } } : cell;
    }
    // Clear cells the table covers but leaves empty.
    table.rows.forEach((row, r) => row.forEach((cell, c) => { if (!cell.text && !cell.formula) delete s.cells[key(range.c1 + c, range.r1 + r)]; }));
  });
  const onPaste = (e: React.ClipboardEvent) => {
    if (edit || fromPanel(e)) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const html = e.clipboardData.getData('text/html');
    const mine = clip.current;
    if (mine && text === mine.text) {
      // Our own copy: formulas follow the cells, like Excel's relative references.
      const dc = range.c1 - mine.origin.c, dr = range.r1 - mine.origin.r;
      changeSheet(s => {
        for (const [k, cell] of Object.entries(mine.cells)) {
          const p = unkey(k);
          s.cells[key(range.c1 + p.c, range.r1 + p.r)] = cell.input.startsWith('=')
            ? { ...cell, input: moveRefs(cell.input, (c, r, absC, absR) => ({ c: absC ? c : c + dc, r: absR ? r : r + dr })) }
            : cell;
        }
      });
      return;
    }
    const table = (html && tableFromHtml(html)) || (text ? tableFromText(text) : null);
    if (table) pasteTable(table);
  };

  // ---------- files ----------
  const loadBook = async (f: OpenedFile) => {
    try {
      const lower = f.name.toLowerCase();
      let next: WorkbookData;
      if (lower.endsWith('.xlsx')) {
        const { readXlsx } = await import('../../formats/xlsx');
        next = await readXlsx(await f.arrayBuffer());
      } else {
        const rows = parseCsv(await f.text(), lower.endsWith('.tsv') ? '\t' : undefined);
        next = { sheets: [{ name: f.name.replace(/\.\w+$/, '').slice(0, 31), cells: tableToCells({ rows: rows.map(r => r.map(text => ({ text }))) }), widths: {} }] };
        // Numbers in a CSV are text until read like typed entries.
        for (const s of next.sheets) for (const [k, cell] of Object.entries(s.cells)) { const e = readEntry(cell.input, decimalComma(lang)); s.cells[k] = { input: e.input, ...(e.format ? { style: { format: e.format } } : {}) }; }
      }
      undo.current = []; redo.current = [];
      setBook(next);
      setActive(0);
      setSel({ a: { c: 0, r: 0 }, f: { c: 0, r: 0 } });
      setChartSel(null);
      setFileName(f.name.replace(/\.(csv|tsv)$/i, '.xlsx'));
      setFileRef(lower.endsWith('.xlsx') && f.handle ? { name: f.name, handle: f.handle } : null);
      setLink(null);
    } catch (err) {
      alert(`${t('letter.openFailed')} ${f.name}\n${String(err)}`);
    }
  };
  useEffect(() => { if (file) void loadBook(file); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const baseName = () => title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'sheet';
  const save = async (saveAs = false) => {
    const { writeXlsx } = await import('../../formats/xlsx');
    const name = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${baseName()}.xlsx`;
    const ref = await shell.saveFile(name, () => writeXlsx({ ...bookRef.current, currency }, lang), XLSX_TYPE, { target: fileRef, saveAs });
    if (!ref) return;
    setFileRef(ref);
    setFileName(ref.name);
  };
  // AutoSave: once the book has an .xlsx file, the shell writes it there after each pause in the work.
  const quietSave = useRef<() => Promise<FileRef | null>>(async () => null);
  quietSave.current = async () => {
    const own = !!fileRef?.handle && fileName.toLowerCase().endsWith('.xlsx');
    if (!own && !shell.cloudOn?.()) return null;
    const { writeXlsx } = await import('../../formats/xlsx');
    return shell.saveFile(own ? fileName : `${baseName()}.xlsx`, () => writeXlsx({ ...bookRef.current, currency }, lang), XLSX_TYPE, { target: own ? fileRef : undefined, quiet: true });
  };
  useEffect(() => { shell.autoSave(() => quietSave.current()); return () => shell.autoSave(null); }, [shell]);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  // Changing the language can translate the workbook's words too: typed texts only, never formulas or numbers.
  useEffect(() => {
    // A snapshot is the typed texts by sheet and cell; formulas and numbers are never part of it.
    type Snap = Record<string, string>;
    shell.translator?.({
      snapshot: () => {
        const out: Snap = {};
        bookRef.current.sheets.forEach((sh, si) => { for (const [k, c] of Object.entries(sh.cells)) if (!c.input.startsWith('=') && /\p{L}{2,}/u.test(c.input)) out[`${si}|${k}`] = c.input; });
        return out;
      },
      words: base => Object.values(base as Snap),
      apply: async (base, tr) => {
        const spots = Object.entries(base as Snap);
        if (!spots.length) return 0;
        const got = tr ? await tr(spots.map(([, v]) => v)) : spots.map(([, v]) => v);
        let n = 0;
        const sheets = bookRef.current.sheets.map(sh => ({ ...sh, cells: { ...sh.cells } }));
        spots.forEach(([at, orig], i) => {
          const [si, k] = [Number(at.split('|')[0]), at.slice(at.indexOf('|') + 1)];
          const cell = sheets[si]?.cells[k];
          const want = got[i] || orig;
          if (cell && cell.input !== want) { sheets[si].cells[k] = { ...cell, input: want }; n++; }
        });
        if (n) commitRef.current({ ...bookRef.current, sheets });
        return n;
      },
    });
    return () => shell.translator?.(null);
  }, [shell]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveCsv = () => {
    const u = usedRange(sheet);
    const rows = u.rows < 0 ? [] : tableOf({ c1: 0, r1: 0, c2: u.cols, r2: u.rows }).rows.map(r => r.map(c => c.text));
    void shell.saveFile(`${baseName()}.csv`, toCsv(rows, decimalComma(lang) ? ';' : ','), 'text/csv', { saveAs: true });
  };
  const openRecent = async (r: RecentFile) => {
    const f = await shell.recent.open(r.id);
    if (!f) { alert(t('home.recentMissing')); return; }
    if (!fileName && !link && !Object.keys(sheet.cells).length) void loadBook(f);
    else shell.openModule('class', f);
  };
  const openFile = async () => {
    const f = await shell.openFile(EXTENSIONS);
    if (!f) return;
    if (!fileName && !link && book.sheets.every(s => !Object.keys(s.cells).length)) void loadBook(f);
    else shell.openModule('class', f);
  };

  // ---------- charts ----------
  const seriesName = (n: number) => t('class.chart.series', { n });
  /** A chart drawn on its own, light like a printed page, as a PNG. */
  const chartPng = async (ch: Chart, si = active): Promise<string> => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0';
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      flushSync(() => root.render(<ChartSvg chart={ch} data={chartData(book.sheets[si] ?? sheet, allValues[si] ?? values, ch, lang, currency, seriesName)} look={LIGHT} lang={lang} />));
      return await svgToPng(host.querySelector('svg')!);
    } finally {
      root.unmount();
      host.remove();
    }
  };
  const insertChart = (type: Chart['type']) => {
    const rg = tableRange();
    if (rg.c1 === rg.c2 && rg.r1 === rg.r2 && !filled(rg.c1, rg.r1)) { shell.notify(t('class.chart.needData')); return; }
    const ch: Chart = { id: newId('c'), type, range: rg, x: 0, y: 0, w: 480, h: 290 };
    const data = chartData(sheet, values, ch, lang, currency, seriesName);
    if (data.series.length === 1 && filled(rg.c2, rg.r1) && typeof values.get(key(rg.c2, rg.r1)) === 'string') ch.title = data.series[0].name;
    // Place it beside the data, like Excel.
    ch.x = Math.round(lefts[Math.min(rg.c2 + 1, lefts.length - 1)] / z + 16);
    ch.y = Math.round(tops[Math.min(rg.r1, tops.length - 1)] / z);
    changeSheet(s => { s.charts = [...(s.charts ?? []), ch]; });
    setChartSel(ch.id);
    setTab('chart');
  };
  const chart = (sheet.charts ?? []).find(c => c.id === chartSel) ?? null;
  const changeChart = (patch: Partial<Chart>) => { if (chart) changeSheet(s => { s.charts = (s.charts ?? []).map(c => (c.id === chart.id ? { ...c, ...patch } : c)); }); };
  const deleteChart = () => { if (!chart) return; changeSheet(s => { s.charts = (s.charts ?? []).filter(c => c.id !== chart.id); }); setChartSel(null); setTab('insert'); };
  const chartToLetter = async (letterTab: string | null) => {
    if (!chart) return;
    const png = await chartPng(chart);
    const name = chart.title || title;
    const h: Handoff = { kind: 'html', title: name, html: `<p><img src="${png}" alt="${name.replace(/"/g, '&quot;')}" width="${chart.w}" height="${chart.h}"></p>` };
    if (letterTab && await shell.send(letterTab, h)) {
      const target = shell.tabs('letter').find(x => x.tabId === letterTab);
      shell.notify(t('class.chart.sent', { title: target?.title ?? 'Office Letter' }));
      shell.showTab(letterTab);
    } else shell.openModule('letter', undefined, h);
  };
  // The table (or the selection) on a new slide in Office Stage, linked so changes can be sent there.
  const sendToStage = () => {
    const { table } = sendRange();
    const id = newLiveId();
    void liveStore().ensure(id, { kind: 'table', title, table }, 'class', 'class');
    const tabId = shell.openModule('stage', undefined, { kind: 'table', title, table, link: { tabId: shell.tabId, id, moduleId: 'class', title } });
    if (tabId) setLink({ tabId, id, moduleId: 'stage', title: 'Office Stage', sheet: sheet.name });
  };
  const chartToStage = async () => {
    if (!chart) return;
    const png = await chartPng(chart);
    const name = chart.title || title;
    shell.openModule('stage', undefined, { kind: 'html', title: name, html: `<p><img src="${png}" alt="${name.replace(/"/g, '&quot;')}" width="${chart.w}" height="${chart.h}"></p>` });
  };
  const saveChartPng = async () => {
    if (!chart) return;
    const png = await chartPng(chart);
    const blob = await (await fetch(png)).blob();
    await shell.saveFile(`${(chart.title || baseName()).replace(/[\\/:*?"<>|]+/g, '')}.png`, blob, 'image/png', { saveAs: true });
  };

  // ---------- links with the other apps ----------
  const sendRange = (): { table: TableData; rg: Range } => {
    let rg = range;
    if (single && used.rows >= 0) rg = { c1: 0, r1: 0, c2: used.cols, r2: used.rows };
    return { table: tableOf(rg), rg };
  };
  const sendToLetter = async (letterTab: string | null) => {
    const { table } = sendRange();
    const id = link?.moduleId === 'letter' && letterTab === link.tabId && isLiveId(link.id) ? link.id : newLiveId();
    void liveStore().ensure(id, { kind: 'table', title, table }, 'class', 'class');
    const mine: HandoffLink = { tabId: shell.tabId, id, moduleId: 'class', title };
    if (letterTab) {
      const ok = await shell.send(letterTab, { kind: 'table', title, table, link: mine });
      if (!ok) { shell.notify(t('class.letterGone')); return; }
      const target = shell.tabs('letter').find(x => x.tabId === letterTab);
      setLink({ tabId: letterTab, id, moduleId: 'letter', title: target?.title ?? 'Office Letter', sheet: sheet.name });
      shell.notify(t('class.sentToLetter', { title: target?.title ?? 'Office Letter' }));
      shell.showTab(letterTab);
    } else {
      const tabId = shell.openModule('letter', undefined, { kind: 'table', title, table, link: mine });
      if (tabId) setLink({ tabId, id, moduleId: 'letter', title: 'Office Letter', sheet: sheet.name });
    }
  };
  const updateLetter = async () => {
    if (!link) return;
    const u = usedRange(sheet);
    const table = tableOf({ c1: 0, r1: 0, c2: Math.max(0, u.cols), r2: Math.max(0, u.rows) });
    const ok = await shell.send(link.tabId, { kind: 'table', title, table, link });
    shell.notify(ok ? t('class.letterUpdated', { title: link.title }) : t('class.letterGone'));
  };
  const share = async () => {
    const { writeXlsx } = await import('../../formats/xlsx');
    const blob = await writeXlsx({ ...bookRef.current, currency }, lang);
    const f = new File([blob], `${baseName()}.xlsx`, { type: XLSX_TYPE });
    if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title }).catch(() => {});
    else void save(true);
  };
  /** The Print window: what to print, the page setup and the real pages before printing. */
  const [printing, setPrinting] = useState<null | { scope: PrintScope; charts: string[][] }>(null);
  const print = async (scope?: PrintScope) => {
    const charts: string[][] = [];
    for (let i = 0; i < book.sheets.length; i++) {
      const list: string[] = [];
      for (const ch of book.sheets[i].charts ?? []) list.push(await chartPng(ch, i));
      charts.push(list);
    }
    setPrinting({ scope: scope ?? (sheet.print?.area ? 'area' : single ? 'sheet' : 'selection'), charts });
  };
  /** Prints the sheet at once with its page setup, without the window. */
  const quickPrint = async () => {
    const charts: string[][] = [];
    const list: string[] = [];
    for (const ch of sheet.charts ?? []) list.push(await chartPng(ch));
    charts[active] = list;
    const input = printInput(charts);
    const scope: PrintScope = sheet.print?.area ? 'area' : 'sheet';
    const setup = setupOf(sheet);
    printHtml(pagesHtml(input, planPages(input, { scope, sel: range, at: sel.a }, setup), setup, scope), () => gridRef.current?.focus());
  };
  const changePrint = (p: Partial<PrintSetup>) => changeSheet(s => { s.print = { ...s.print, ...p }; });
  const setPrintArea = (how: 'set' | 'add' | 'clear') => changeSheet(s => {
    if (how === 'clear') { if (s.print) delete s.print.area; return; }
    const a = s.print?.area;
    const b = { c1: range.c1, r1: range.r1, c2: range.c2, r2: range.r2 };
    s.print = { ...s.print, area: how === 'add' && a ? { c1: Math.min(a.c1, b.c1), r1: Math.min(a.r1, b.r1), c2: Math.max(a.c2, b.c2), r2: Math.max(a.r2, b.r2) } : b };
  });
  const printInput = (charts: string[][]) => ({
    sheets: book.sheets, values: allValues, active, lang, currency, file: fileName || `${title}.xlsx`,
    looks: (i: number) => (i === active ? looks : condLooks(book.sheets[i], allValues[i] ?? new Map())),
    hidden: (i: number) => (i === active ? hiddenRows : filteredRows(book.sheets[i], allValues[i] ?? new Map(), lang, currency)),
    charts: (i: number) => charts[i] ?? [],
  });
  const ps = setupOf(sheet);

  // ---------- Convert tab: the sheet as a table, every sheet's table, the workbook (translated when asked) ----------
  const convertSource: ConvertSource = {
    appId: 'class',
    title: () => title,
    html: () => { const h = sheetHtml(sheet, values, looks, lang, currency, [], hiddenRows); return h.slice(h.indexOf('<body>') + 6, h.lastIndexOf('</body>')); },
    css: () => '.cv-doc table { table-layout: fixed; } .cv-doc td { padding: 2px 5px; white-space: nowrap; overflow: hidden; vertical-align: bottom; border: 1px solid #d4d4d4; } .cv-doc td span { position: relative; }',
    tables: () => {
      const all = computeBook(bookRef.current);
      const list = bookRef.current.sheets.map((s, i) => {
        const u = usedRange(s);
        return { name: s.name, table: sheetToTable(s, { c1: 0, r1: 0, c2: Math.max(0, u.cols), r2: Math.max(0, u.rows) }, all[i], lang, currency) };
      });
      // The sheet on screen first: CSV, Code+ and JSON take the first table.
      const i = bookRef.current.sheets.indexOf(sheet);
      return i > 0 ? [list[i], ...list.filter((_, k) => k !== i)] : list;
    },
    book: async tr => {
      const book = { ...bookRef.current, currency };
      if (!tr) return book;
      const spots: [number, string][] = [], texts: string[] = [];
      book.sheets.forEach((s, i) => Object.entries(s.cells).forEach(([k, c]) => {
        if (c.input && !c.input.startsWith('=') && /\p{L}{2,}/u.test(c.input)) { spots.push([i, k]); texts.push(c.input); }
      }));
      const [got, names] = await Promise.all([texts.length ? tr(texts) : Promise.resolve([] as string[]), tr(book.sheets.map(s => s.name))]);
      const sheets = book.sheets.map((s, i) => ({ ...s, name: (names[i] || s.name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), cells: { ...s.cells } }));
      spots.forEach(([i, k], n) => { sheets[i].cells[k] = { ...sheets[i].cells[k], input: got[n] || sheets[i].cells[k].input }; });
      return { ...book, sheets };
    },
    native: {
      pdf: async tr => { if (tr) return undefined; await print(); return true; },
      print: async tr => { if (tr) return undefined; await print(); return true; },
    },
  };

  // ---------- copilot (Claude) ----------
  const [copilot, setCopilot] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useCopilotShortcut(() => setCopilot(o => !o), rootRef);
  const bridge: ClassBridge = {
    sheetName: sheet.name,
    focus: () => {
      const rg = single ? currentRegion(sel.a) : range;
      const active = cellName(sel.a.c, sel.a.r);
      const activeInput = sheet.cells[key(sel.a.c, sel.a.r)]?.input ?? '';
      if (single && !activeInput && rg.c1 === rg.c2 && rg.r1 === rg.r2) return null;
      // A very long table goes to Claude cut to its first rows.
      const shown = { ...rg, r2: Math.min(rg.r2, rg.r1 + 399) };
      return { ref: `${cellName(rg.c1, rg.r1)}:${cellName(shown.c2, shown.r2)}`, table: tableOf(shown), active, activeInput, single };
    },
    setActive: text => { const { c, r } = sel.a; changeSheet(s => setEntry(s.cells, c, r, text)); gridRef.current?.focus(); },
    writeRows: (rows, at) => {
      const start = parseCell(String(at ?? '').split(':')[0]) ?? { c: range.c1, r: range.r1 };
      changeSheet(s => rows.forEach((row, r) => row.forEach((text, c) => setEntry(s.cells, start.c + c, start.r + r, text))));
      setSel({ a: start, f: { c: start.c + Math.max(...rows.map(r => r.length)) - 1, r: start.r + rows.length - 1 } });
      gridRef.current?.focus();
    },
  };

  // What other apps send here: a linked table coming back from Letter, or a file.
  useEffect(() => shell.onReceive((h, from) => {
    if (h.kind === 'file') { void loadBook(h.file); return true; }
    if (h.kind !== 'table') return false;
    if (link && h.link && h.link.id === link.id) {
      changeSheet(s => { s.cells = tableToCells(h.table); });
      setLink({ ...link, tabId: from });
      return true;
    }
    // A new table: put it on a sheet of its own.
    const b = bookRef.current;
    const name = (h.title ?? t('class.sheet', { n: b.sheets.length + 1 })).slice(0, 31);
    commit({ ...b, sheets: [...b.sheets, { name, cells: tableToCells(h.table), widths: {} }] });
    setActive(b.sheets.length);
    if (h.link) setLink({ ...h.link, sheet: name });
    return true;
  }));

  // ---------- Synchro: a linked table is a live part ----------
  // The linked sheet follows every change made in Letter, Stage or another window, and sends its own at once.
  const [liveState, setLiveState] = useState<SyncState | null>(null);
  const liveIndex = () => {
    const l = linkRef.current;
    if (!l || !isLiveId(l.id)) return -1;
    const i = bookRef.current.sheets.findIndex(s => s.name === l.sheet);
    return i >= 0 ? i : 0;
  };
  const liveTable = (i: number, vals = computeBook(bookRef.current)[i]): TableData => {
    const s = bookRef.current.sheets[i];
    const u = usedRange(s);
    return sheetToTable(s, { c1: 0, r1: 0, c2: Math.max(0, u.cols), r2: Math.max(0, u.rows) }, vals, lang, currency);
  };
  const lastPart = useRef<string | null>(null);
  useEffect(() => {
    const id = link?.id;
    if (!isLiveId(id)) { setLiveState(null); return; }
    const store = liveStore();
    const apply = (table: TableData | undefined) => {
      const i = liveIndex();
      if (i < 0 || !table) return;
      lastPart.current = tableText(table);
      if (tableText(liveTable(i)) !== lastPart.current) {
        const b = bookRef.current;
        const sheets = b.sheets.map((s, k) => (k === i ? { ...s, cells: tableToCells(table) } : s));
        commit({ ...b, sheets });
      }
      setLiveState('synced');
    };
    const stop = store.watch(id, c => apply(c.table));
    void store.read(id).then(c => {
      if (c.table) { store.addPlace(id, 'class'); apply(c.table); return; }
      const i = liveIndex();
      if (i >= 0) void store.ensure(id, { kind: 'table', title, table: liveTable(i) }, 'class', 'class').then(() => setLiveState('synced'));
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.id]);
  useEffect(() => {
    const id = link?.id;
    if (!isLiveId(id) || lastPart.current === null) return;
    const i = liveIndex();
    if (i < 0) return;
    const table = liveTable(i, allValues[i]);
    if (tableText(table) === lastPart.current) { setLiveState('synced'); return; }
    setLiveState('pending');
    const timer = window.setTimeout(() => {
      lastPart.current = tableText(table);
      void liveStore().write(id, { kind: 'table', title, table }).then(() => liveStore().read(id))
        .then(c => setLiveState(tableText(c.table) === tableText(liveTable(liveIndex())) ? 'synced' : 'different'));
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, link?.id]);
  // A letter or a deck asks for a table: give the selection (or the whole table) and link it to that tab.
  useEffect(() => shell.onAsk((_want, from) => {
    const { table } = sendRange();
    const id = newLiveId();
    void liveStore().ensure(id, { kind: 'table', title, table }, 'class', 'class');
    const target = shell.tabs().find(x => x.tabId === from);
    setLink({ tabId: from, id, moduleId: target?.moduleId ?? 'letter', title: target?.title ?? 'Office Letter', sheet: sheet.name });
    return { kind: 'table', title, table, link: { tabId: shell.tabId, id, moduleId: 'class', title } };
  }));
  useEffect(() => { if (handoff?.kind === 'file') void loadBook(handoff.file); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ---------- grid geometry ----------
  const rows = Math.max(used.rows + 60, 200, sel.f.r + 30);
  const cols = Math.max(used.cols + 8, 26, sel.f.c + 6);
  // Rows grow to fit big or wrapped text, unless the user set their height.
  const autoHeights = useMemo(() => {
    const out = new Map<number, number>();
    for (const [k, cell] of Object.entries(sheet.cells)) {
      const st = cell.style;
      if (!st || (!st.wrap && !(st.size && st.size > DEFAULT_PT))) continue;
      const { c, r } = unkey(k);
      if (sheet.heights?.[r] !== undefined || merges.some(m => m.r1 !== m.r2 && r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2)) continue;
      const px = (st.size ?? DEFAULT_PT) * PX_PER_PT;
      let need = px * 1.35 + 8;
      if (st.wrap && cell.input) {
        const text = display(values.get(k) ?? '', st, lang, currency);
        const m = merges.find(mm => mm.c1 === c && mm.r1 === r);
        let w = 0;
        for (let i = c; i <= (m?.c2 ?? c); i++) w += sheet.widths[i] ?? COL_W;
        need = wrapLines(text, w - 14 - (st.indent ?? 0) * 12, canvasFont(st, px)) * px * 1.3 + 8;
      }
      if (need > (out.get(r) ?? ROW_H)) out.set(r, Math.min(409, Math.ceil(need)));
    }
    return out;
  }, [sheet.cells, sheet.widths, sheet.heights, merges, values, lang, currency]);
  const baseHeight = (r: number) => (hiddenRows.has(r) ? 0 : sheet.heights?.[r] ?? autoHeights.get(r) ?? ROW_H);
  const tops = useMemo(() => {
    const out = [0];
    for (let r = 0; r < rows; r++) out.push(out[r] + baseHeight(r) * z);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sheet.heights, autoHeights, hiddenRows, z]);
  const lefts = useMemo(() => {
    const out = [0];
    for (let c = 0; c < cols; c++) out.push(out[c] + (sheet.widths[c] ?? COL_W) * z);
    return out;
  }, [cols, sheet.widths, z]);
  const width = (c: number) => lefts[c + 1] - lefts[c];
  const height = (r: number) => tops[r + 1] - tops[r];
  const search = (arr: number[], n: number, v: number) => { let lo = 0, hi = n - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (arr[mid] <= v) lo = mid; else hi = mid - 1; } return lo; };
  const colAt = (x: number) => search(lefts, cols, x);
  const rowAt = (y: number) => search(tops, rows, y);
  const fr = Math.min(sheet.freeze?.r ?? 0, rows - 1), fc = Math.min(sheet.freeze?.c ?? 0, cols - 1);
  const FH = tops[fr], FW = lefts[fc];

  const [view, setView] = useState({ top: 0, left: 0, w: 1200, h: 700 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const colHeadsRef = useRef<HTMLDivElement>(null);
  const rowHeadsRef = useRef<HTMLDivElement>(null);
  const topPaneRef = useRef<HTMLDivElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setView(v => ({ ...v, w: el.clientWidth, h: el.clientHeight })));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  /** Moves the headings and frozen panes with the scroll at once, so they never lag a frame behind the cells. */
  const placeScrolled = (top: number, left: number) => {
    if (colHeadsRef.current) colHeadsRef.current.style.transform = `translateX(${-left}px)`;
    if (rowHeadsRef.current) rowHeadsRef.current.style.transform = `translateY(${-top}px)`;
    if (topPaneRef.current) topPaneRef.current.style.transform = `translateX(${-left}px)`;
    if (leftPaneRef.current) leftPaneRef.current.style.transform = `translateY(${-top}px)`;
  };
  useLayoutEffect(() => placeScrolled(view.top, view.left));
  const r0 = Math.max(fr, rowAt(view.top + FH) - 1);
  const r9 = Math.min(rows - 1, rowAt(view.top + view.h) + 1);
  const c0 = Math.max(fc, colAt(view.left + FW) - 1);
  const c9 = Math.min(cols - 1, colAt(view.left + view.w) + 1);

  // Keep the active cell in view, below and right of the frozen panes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { c, r } = sel.f;
    if (r >= fr) {
      const y = tops[r];
      if (y < el.scrollTop + FH) el.scrollTop = y - FH;
      else if (y + height(r) > el.scrollTop + el.clientHeight) el.scrollTop = y + height(r) - el.clientHeight;
    }
    if (c >= fc) {
      const x = lefts[c];
      if (x < el.scrollLeft + FW) el.scrollLeft = x - FW;
      else if (x + width(c) > el.scrollLeft + el.clientWidth) el.scrollLeft = Math.min(x, x + width(c) - el.clientWidth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.f.c, sel.f.r]);

  // ---------- pointer ----------
  const pointing = useRef<{ start: number; anchor: Pos } | null>(null);
  const cellAt = (e: { clientX: number; clientY: number }): Pos => {
    const el = scrollRef.current!;
    const box = el.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    return { c: colAt(Math.max(0, x < FW ? x : x + el.scrollLeft)), r: rowAt(Math.max(0, y < FH ? y : y + el.scrollTop)) };
  };
  const canPoint = (text: string) => text.startsWith('=') && /[=+\-*/^(,;:&<>]\s*$/.test(text);
  const drag = (move: (ev: MouseEvent) => void, up?: (ev: MouseEvent) => void) => {
    const done = (ev: MouseEvent) => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', done); up?.(ev); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', done);
  };
  const onGridDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = scrollRef.current!;
    // Clicks on the scroll bars scroll, they do not select.
    const box = el.getBoundingClientRect();
    if (e.clientX - box.left > el.clientWidth || e.clientY - box.top > el.clientHeight) return;
    const p = cellAt(e);
    setFilterMenu(null);
    if (edit && (canPoint(edit.text) || pointing.current)) {
      // Building a formula: a click adds that cell, a drag adds a range.
      e.preventDefault();
      const start = pointing.current?.start ?? edit.text.length;
      pointing.current = { start, anchor: p };
      setEdit(ed => ed && { ...ed, text: ed.text.slice(0, start) + cellName(p.c, p.r) });
      drag(ev => {
        const q = cellAt(ev);
        const a = pointing.current!.anchor;
        const ref = a.c === q.c && a.r === q.r ? cellName(a.c, a.r) : `${cellName(Math.min(a.c, q.c), Math.min(a.r, q.r))}:${cellName(Math.max(a.c, q.c), Math.max(a.r, q.r))}`;
        setEdit(ed => ed && { ...ed, text: ed.text.slice(0, start) + ref });
      }, () => editorRef.current?.focus());
      return;
    }
    if (edit) commitEdit();
    pointing.current = null;
    // A click inside a merged block selects the block's top left cell.
    const m = mergeAt(p.c, p.r);
    const at = m && !e.shiftKey ? { c: m.c1, r: m.r1 } : p;
    go(at.c, at.r, e.shiftKey);
    gridRef.current?.focus();
    drag(ev => { const q = cellAt(ev); setSel(s => (s.f.c === q.c && s.f.r === q.r ? s : { a: s.a, f: q })); }, () => {
      if (painter) {
        // Format Painter: the copied look goes on the cells just selected.
        const look = painter;
        setPainter(null);
        setSel(s => {
          const b = grow(boxOf(s));
          changeSheet(sh => forBox(b, (c, r) => putStyle(sh, c, r, { ...look })));
          return s;
        });
      }
    });
  };
  const onFillDown = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const from = range;
    let to: Box = from;
    drag(ev => {
      const q = cellAt(ev);
      const dr = q.r > from.r2 ? q.r - from.r2 : q.r < from.r1 ? q.r - from.r1 : 0;
      const dc = q.c > from.c2 ? q.c - from.c2 : q.c < from.c1 ? q.c - from.c1 : 0;
      to = Math.abs(dr) >= Math.abs(dc)
        ? { ...from, r1: Math.min(from.r1, from.r1 + dr), r2: Math.max(from.r2, from.r2 + dr) }
        : { ...from, c1: Math.min(from.c1, from.c1 + dc), c2: Math.max(from.c2, from.c2 + dc) };
      setFillTo(to);
    }, () => {
      setFillTo(null);
      if (to.c1 === from.c1 && to.c2 === from.c2 && to.r1 === from.r1 && to.r2 === from.r2) return;
      applyFill(from, to);
      setSel({ a: { c: to.c1, r: to.r1 }, f: { c: to.c2, r: to.r2 } });
    });
  };
  const selectWhole = (axis: 'c' | 'r', i: number, extend: boolean) => {
    if (edit) commitEdit();
    const end = axis === 'c' ? { c: i, r: Math.max(used.rows, 0) } : { c: Math.max(used.cols, 0), r: i };
    const start = axis === 'c' ? { c: i, r: 0 } : { c: 0, r: i };
    setSel(s => (extend ? { a: s.a, f: end } : { a: start, f: end }));
    setChartSel(null);
    gridRef.current?.focus();
  };
  /** Drags a column's right edge or a row's bottom edge; a double click fits the content again. */
  const resize = (axis: 'c' | 'r', i: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const start = axis === 'c' ? e.clientX : e.clientY;
    const s0 = axis === 'c' ? width(i) / z : (height(i) || ROW_H * z) / z;
    const before = bookRef.current;
    let last = s0;
    drag(ev => {
      last = Math.max(axis === 'c' ? 24 : 12, Math.round(s0 + ((axis === 'c' ? ev.clientX : ev.clientY) - start) / z));
      const b = bookRef.current;
      setBook({ ...b, sheets: b.sheets.map((s, j) => (j !== active ? s : axis === 'c' ? { ...s, widths: { ...s.widths, [i]: last } } : { ...s, heights: { ...s.heights, [i]: last } })) });
    }, () => { if (last !== s0) { undo.current.push(before); redo.current = []; } });
  };
  const fitColumn = (c: number) => changeSheet(s => {
    let w = 0;
    for (const [k, cell] of Object.entries(s.cells)) {
      const p = unkey(k);
      if (p.c !== c || !cell.input || mergeAt(p.c, p.r)) continue;
      const st = cell.style;
      w = Math.max(w, textWidth(display(values.get(k) ?? '', st, lang, currency), canvasFont(st, (st?.size ?? DEFAULT_PT) * PX_PER_PT)) + 18 + (st?.indent ?? 0) * 12);
    }
    if (w) s.widths[c] = Math.min(600, Math.ceil(w)); else delete s.widths[c];
  });
  const moveChart = (ch: Chart, e: React.MouseEvent, mode: 'move' | 'size') => {
    e.preventDefault(); e.stopPropagation();
    if (edit) commitEdit();
    setChartSel(ch.id);
    setTab('chart');
    gridRef.current?.focus();
    const x0 = e.clientX, y0 = e.clientY;
    const before = bookRef.current;
    let moved = false;
    drag(ev => {
      const dx = (ev.clientX - x0) / z, dy = (ev.clientY - y0) / z;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true;
      const patch = mode === 'move'
        ? { x: Math.max(0, Math.round(ch.x + dx)), y: Math.max(0, Math.round(ch.y + dy)) }
        : { w: Math.max(200, Math.round(ch.w + dx)), h: Math.max(140, Math.round(ch.h + dy)) };
      const b = bookRef.current;
      setBook({ ...b, sheets: b.sheets.map((s, j) => (j === active ? { ...s, charts: (s.charts ?? []).map(c => (c.id === ch.id ? { ...c, ...patch } : c)) } : s)) });
    }, () => { if (moved) { undo.current.push(before); redo.current = []; } });
  };

  // ---------- find and replace ----------
  const matches = (o: FindOptions) => {
    if (!o.text) return [] as Pos[];
    const want = o.matchCase ? o.text : o.text.toLowerCase();
    const out: Pos[] = [];
    for (const [k, cell] of Object.entries(sheet.cells)) {
      if (!cell.input) continue;
      let text = display(values.get(k) ?? '', cell.style, lang, currency);
      if (!o.matchCase) text = text.toLowerCase();
      const raw = o.matchCase ? cell.input : cell.input.toLowerCase();
      if (o.whole ? text === want || raw === want : text.includes(want) || (!raw.startsWith('=') && raw.includes(want))) out.push(unkey(k));
    }
    return out.sort((a, b) => a.r - b.r || a.c - b.c);
  };
  const findNext = (o: FindOptions, back = false) => {
    const all = matches(o);
    if (!all.length) { setFindStatus(t('letter.findNone')); return; }
    const { c, r } = sel.a;
    const after = (p: Pos) => p.r > r || (p.r === r && p.c > c);
    const before = (p: Pos) => p.r < r || (p.r === r && p.c < c);
    const hit = back ? [...all].reverse().find(before) ?? all[all.length - 1] : all.find(after) ?? all[0];
    setSel({ a: hit, f: hit });
    setFindStatus(t('letter.findCount', { n: all.findIndex(p => p.c === hit.c && p.r === hit.r) + 1, total: all.length }));
  };
  const replaced = (input: string, o: FindOptions) => {
    if (o.whole) return o.replace;
    const flags = o.matchCase ? 'g' : 'gi';
    return input.replace(new RegExp(o.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags), () => o.replace);
  };
  const replaceOne = (o: FindOptions) => {
    const here = matches(o).some(p => p.c === sel.a.c && p.r === sel.a.r);
    if (here) {
      const cell = sheet.cells[key(sel.a.c, sel.a.r)];
      if (cell && !cell.input.startsWith('=')) changeSheet(s => setEntry(s.cells, sel.a.c, sel.a.r, replaced(cell.input, o)));
    }
    findNext(o);
  };
  const replaceAll = (o: FindOptions) => {
    const all = matches(o).filter(p => !sheet.cells[key(p.c, p.r)].input.startsWith('='));
    if (all.length) changeSheet(s => { for (const p of all) setEntry(s.cells, p.c, p.r, replaced(s.cells[key(p.c, p.r)].input, o)); });
    setFindStatus(t('class.find.replaced', { n: all.length }));
  };

  // ---------- keyboard ----------
  /** Keys and clipboard events from a box floating over the grid, like Find, belong to that box. */
  const fromPanel = (e: React.SyntheticEvent) => !!(e.target as HTMLElement).closest?.('.find-panel');
  const onGridKey = (e: React.KeyboardEvent) => {
    if (edit || fromPanel(e)) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (chart && (k === 'Delete' || k === 'Backspace')) { e.preventDefault(); deleteChart(); return; }
    if (chart && k === 'Escape') { setChartSel(null); return; }
    // From a merged block, arrows leave from its far edge.
    const m = mergeAt(sel.f.c, sel.f.r);
    const { c, r } = sel.f;
    const jump = (dc: number, dr: number): Pos => {
      if (!mod) {
        let nc = c + dc, nr = r + dr;
        if (m) { if (dc > 0) nc = m.c2 + 1; if (dr > 0) nr = m.r2 + 1; if (dc < 0) nc = m.c1 - 1; if (dr < 0) nr = m.r1 - 1; }
        // Rows hidden by the filter are skipped.
        while (dr && hiddenRows.has(nr)) nr += dr;
        return { c: nc, r: nr };
      }
      // Ctrl+arrow: to the edge of the data, like Excel.
      let nc = c, nr = r;
      const startFilled = filled(c, r) && filled(c + dc, r + dr);
      while (nc + dc >= 0 && nr + dr >= 0 && nc + dc <= Math.max(cols, used.cols) && nr + dr <= Math.max(rows, used.rows)) {
        const next = filled(nc + dc, nr + dr);
        if (startFilled ? !next : next) { if (!startFilled) { nc += dc; nr += dr; } break; }
        nc += dc; nr += dr;
        if (!startFilled && (nc > used.cols + 1 || nr > used.rows + 1) && (dc > 0 || dr > 0)) break;
      }
      return { c: nc, r: nr };
    };
    const arrows: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (arrows[k]) {
      e.preventDefault();
      const p = jump(...arrows[k]);
      const pm = !e.shiftKey && mergeAt(Math.max(0, p.c), Math.max(0, p.r));
      if (pm) go(pm.c1, pm.r1); else go(p.c, p.r, e.shiftKey);
      return;
    }
    if (k === 'Enter' || k === 'Tab') {
      e.preventDefault();
      const back = e.shiftKey ? -1 : 1;
      const a = sel.a;
      const am = mergeAt(a.c, a.r);
      const start = tabStart.current ?? a.c;
      let nr = k === 'Enter' ? (back > 0 ? (am?.r2 ?? a.r) + 1 : a.r - 1) : a.r;
      while (k === 'Enter' && hiddenRows.has(nr)) nr += back;
      go(k === 'Tab' ? (back > 0 ? (am?.c2 ?? a.c) + 1 : a.c - 1) : start, nr);
      if (k === 'Tab') tabStart.current = start;
      return;
    }
    if (k === 'Home') { e.preventDefault(); go(0, mod ? 0 : r, e.shiftKey); return; }
    if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); go(c, r + (k === 'PageDown' ? 1 : -1) * Math.max(1, Math.floor(view.h / (ROW_H * z))), e.shiftKey); return; }
    if (k === 'F2') { e.preventDefault(); startEdit(null, 'edit'); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); clearRange(); return; }
    if (k === 'Escape') { setSel(s => ({ a: s.a, f: s.a })); setPainter(null); return; }
    if (mod) {
      const lk = k.toLowerCase();
      const run = (fn: () => void) => { e.preventDefault(); fn(); };
      if (lk === 'z') run(e.shiftKey ? redoOnce : undoOnce);
      else if (lk === 'y') run(redoOnce);
      else if (lk === 'b') run(() => toggle('bold'));
      else if (lk === 'i') run(() => toggle('italic'));
      else if (lk === 'u') run(() => toggle('underline'));
      else if (lk === '5') run(() => toggle('strike'));
      else if (lk === 'a') run(() => {
        const rg = currentRegion(sel.a);
        const whole = single && (rg.c1 !== rg.c2 || rg.r1 !== rg.r2) ? rg : { c1: 0, r1: 0, c2: Math.max(used.cols, 0), r2: Math.max(used.rows, 0) };
        setSel({ a: { c: whole.c1, r: whole.r1 }, f: { c: whole.c2, r: whole.r2 } });
      });
      else if (lk === 'd') run(fillDown);
      else if (lk === 'r') run(fillRight);
      else if (lk === 'f') run(() => setFind({ replace: false }));
      else if (lk === 'h') run(() => setFind({ replace: true }));
      else if (lk === 'p') run(() => void print());
      else if (lk === 's') run(() => void save(e.shiftKey));
      else if (lk === 'o') run(() => void openFile());
      else if (k === '+' || k === '=') { if (e.altKey) return; run(() => stepZoom(1)); }
      else if (k === '-') run(() => stepZoom(-1));
      return;
    }
    if (e.altKey && k === 'Enter') return;
    if (k.length === 1 && !e.altKey) { e.preventDefault(); startEdit(k, 'enter'); }
  };
  const onEditorKey = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!edit) return;
    const { c, r } = sel.a;
    const start = tabStart.current ?? c;
    const am = mergeAt(c, r);
    if (e.key === 'Enter' && e.altKey) {
      // Alt+Enter starts a new line in the cell, and turns on text wrapping, like Excel.
      e.preventDefault();
      const el = e.currentTarget;
      const at = el.selectionStart ?? edit.text.length;
      const text = `${edit.text.slice(0, at)}\n${edit.text.slice(el.selectionEnd ?? at)}`;
      setEdit({ ...edit, text, mode: 'edit' });
      caretAt.current = at + 1;
      if (!activeStyle.wrap) changeSheet(s => putStyle(s, c, r, { ...s.cells[key(c, r)]?.style, wrap: true }));
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); let nr = e.shiftKey ? r - 1 : (am?.r2 ?? r) + 1; while (hiddenRows.has(nr)) nr += e.shiftKey ? -1 : 1; commitEdit({ c: start, r: nr }); }
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit({ c: e.shiftKey ? c - 1 : (am?.c2 ?? c) + 1, r }); tabStart.current = start; }
    else if (e.key === 'Escape') { e.preventDefault(); setEdit(null); pointing.current = null; gridRef.current?.focus(); }
    else if (edit.mode === 'enter' && e.key.startsWith('Arrow') && !(edit.text.startsWith('=') && canPoint(edit.text))) {
      e.preventDefault();
      const d: Record<string, Pos> = { ArrowUp: { c, r: r - 1 }, ArrowDown: { c, r: (am?.r2 ?? r) + 1 }, ArrowLeft: { c: c - 1, r }, ArrowRight: { c: (am?.c2 ?? c) + 1, r } };
      commitEdit(d[e.key]);
    } else if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) pointing.current = null;
  };
  // The editor turns into a text area for a second line; the caret goes back where it was.
  const caretAt = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (caretAt.current === null || !el) return;
    el.focus();
    el.setSelectionRange(caretAt.current, caretAt.current);
    caretAt.current = null;
  });
  useEffect(() => { if (edit) { const el = editorRef.current; el?.focus(); if (el && edit.mode === 'enter') el.setSelectionRange(el.value.length, el.value.length); } }, [edit?.where, edit?.mode, !!edit]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- sheets ----------
  const pickSheet = (i: number) => { if (edit) commitEdit(); setActive(i); setSel({ a: { c: 0, r: 0 }, f: { c: 0, r: 0 } }); setChartSel(null); setFilterMenu(null); };
  const addSheet = () => {
    const b = bookRef.current;
    let n = b.sheets.length + 1;
    while (b.sheets.some(s => s.name === t('class.sheet', { n }))) n++;
    commit({ ...b, sheets: [...b.sheets, emptySheet(t('class.sheet', { n }))] });
    pickSheet(b.sheets.length);
  };
  // ---------- Métiers: ready professional sheets and world money ----------
  const proLang = (['en', 'fr', 'es', 'pt', 'de'].includes(lang.slice(0, 2)) ? lang.slice(0, 2) : 'en') as Lang;
  const pickProCat = (c: ProCat) => { setProCat(c); try { localStorage.setItem('oi1.class.proCat', c); } catch { /* blocked */ } };
  const addProSheet = (tool: ProTool) => {
    if (edit) commitEdit();
    const b = bookRef.current;
    commit({ ...b, sheets: [...b.sheets, buildTool(tool, proLang, b.sheets.map(s => s.name))] });
    pickSheet(b.sheets.length);
  };
  // Audit: reads the selection (or the whole used area when one cell is selected) and writes a report sheet.
  const runAuditTool = (id: AuditId) => {
    if (edit) commitEdit();
    const b = bookRef.current;
    const one = range.c1 === range.c2 && range.r1 === range.r2;
    const used = usedRange(sheet);
    const box = one ? { c1: 0, r1: 0, c2: Math.max(0, used.cols), r2: Math.max(0, used.rows) } : { c1: range.c1, r1: range.r1, c2: range.c2, r2: range.r2 };
    const meta = AUDITS.find(x => x.id === id)!;
    const name = sheetNameFor({ id, icon: meta.icon, name: meta.name, desc: meta.desc, model: { rows: [] } }, proLang, b.sheets.map(s => s.name));
    commit({ ...b, sheets: [...b.sheets, runAudit(id, { sheet, values, box, lang: proLang, name })] });
    pickSheet(b.sheets.length);
  };
  const putFormula = (formula: string) => {
    const { c, r } = sel.a;
    changeSheet(s => { s.cells[key(c, r)] = { ...s.cells[key(c, r)], input: formula, style: { ...s.cells[key(c, r)]?.style, format: 'number', decimals: 2, thousands: true } }; });
  };
  // Each number of the selection gets its converted value in a new column on the right, as a live =DEVISE() formula.
  const convertSelection = (from: string, to: string) => {
    const { c2, r1, r2 } = range;
    const out = c2 + 1;
    changeSheet(s => {
      for (let r = r1; r <= r2; r++) {
        const v = values.get(key(c2, r));
        if (typeof v === 'number') s.cells[key(out, r)] = { input: `=DEVISE(${cellName(c2, r)},"${from}","${to}")`, style: { format: 'number', decimals: 2, thousands: true } };
        else if (r === r1 && typeof v === 'string' && v) s.cells[key(out, r)] = { input: `${v} (${to})`, style: s.cells[key(c2, r)]?.style };
      }
    });
    setSel({ a: { c: out, r: r1 }, f: { c: out, r: r2 } });
  };
  // Renaming happens right in the tab (no pop-up box: installed apps on phones do not always show one).
  const [renaming, setRenaming] = useState<{ i: number; error?: boolean } | null>(null);
  const [tabMenu, setTabMenu] = useState<{ i: number; x: number; y: number; sure?: boolean } | null>(null);
  const renameSheet = (i: number) => { setTabMenu(null); pickSheet(i); setRenaming({ i }); };
  /** Gives sheet `i` its new name; false when another sheet has it. */
  const applyName = async (i: number, typed: string): Promise<boolean> => {
    const old = bookRef.current.sheets[i]?.name;
    const name = typed.trim().replace(/[\\/?*[\]:]/g, '').slice(0, 31);
    if (!old || !name || name === old) return true;
    if (bookRef.current.sheets.some((s, j) => j !== i && s.name.toLowerCase() === name.toLowerCase())) return false;
    const { renameSheetRefs } = await import('../../formats/formula');
    const b = bookRef.current;
    // Formulas on every sheet that point at the old name follow the new one.
    commit({ ...b, sheets: b.sheets.map((s, j) => {
      const cells: Record<string, Cell> = {};
      for (const [k, cell] of Object.entries(s.cells)) cells[k] = cell.input.startsWith('=') ? { ...cell, input: renameSheetRefs(cell.input, old, name) } : cell;
      return { ...s, cells, ...(j === i ? { name } : {}) };
    }) });
    return true;
  };
  const deleteSheet = (i: number) => {
    if (bookRef.current.sheets.length < 2) return;
    const b = bookRef.current;
    commit({ ...b, sheets: b.sheets.filter((_, j) => j !== i) });
    setActive(a => Math.max(0, a >= i ? a - 1 : a));
    setChartSel(null);
  };
  const duplicateSheet = (i: number) => {
    const b = bookRef.current;
    const src = b.sheets[i];
    let n = 2;
    while (b.sheets.some(s => s.name === `${src.name} (${n})`)) n++;
    const copy = { ...structuredClone(src), name: `${src.name} (${n})`.slice(0, 31) };
    commit({ ...b, sheets: [...b.sheets.slice(0, i + 1), copy, ...b.sheets.slice(i + 1)] });
    pickSheet(i + 1);
  };
  const moveSheet = (i: number, dir: -1 | 1) => {
    const b = bookRef.current, j = i + dir;
    if (j < 0 || j >= b.sheets.length) return;
    const sheets = [...b.sheets];
    [sheets[i], sheets[j]] = [sheets[j], sheets[i]];
    commit({ ...b, sheets });
    setActive(j);
  };
  const setSheetColor = (i: number, color: string | null) => {
    const b = bookRef.current;
    commit({ ...b, sheets: b.sheets.map((sh, j) => {
      if (j !== i) return sh;
      const { tabColor: _old, ...rest } = sh;
      return color ? { ...rest, tabColor: color } : rest;
    }) });
  };
  // A long press on a phone opens the same menu as a right-click.
  const pressTimer = useRef(0);
  const openTabMenu = (i: number, x: number, y: number) => { if (edit) commitEdit(); setTabMenu({ i, x, y }); };
  const setTabColor = (color: string | null) => changeSheet(s => { if (color) s.tabColor = color; else delete s.tabColor; });

  // ---------- view ----------
  usePinchZoom(scrollRef, () => zoomRef.current, setZoom, { min: 0.25, max: 4 });
  const stepZoom = (dir: 1 | -1) => setZoom(zv => (dir > 0 ? ZOOMS.find(x => x > zv + 1e-9) ?? zv : [...ZOOMS].reverse().find(x => x < zv - 1e-9) ?? zv));
  // The whole filled part of the sheet in view at once (at least A1:H20, so an empty sheet does not zoom in a lot).
  const fitSheet = () => {
    const c2 = Math.max(used.cols, 7), r2 = Math.max(used.rows, 19);
    const w = lefts[c2 + 1] / z, h = tops[r2 + 1] / z;
    if (!w || !h) return;
    setZoom(Math.round(Math.max(0.25, Math.min(1.5, Math.min((view.w - 16) / w, (view.h - 16) / h))) * 100) / 100);
    requestAnimationFrame(() => { const el = scrollRef.current; if (el) { el.scrollLeft = 0; el.scrollTop = 0; } });
  };
  const zoomToSelection = () => {
    const w = (lefts[range.c2 + 1] - lefts[range.c1]) / z, h = (tops[range.r2 + 1] - tops[range.r1]) / z;
    if (!w || !h) return;
    const next = Math.max(0.25, Math.min(4, Math.min((view.w - 20) / w, (view.h - 20) / h)));
    setZoom(Math.round(next * 100) / 100);
    requestAnimationFrame(() => { const el = scrollRef.current; if (el) { el.scrollLeft = (lefts[range.c1] / z) * next; el.scrollTop = (tops[range.r1] / z) * next; } });
  };
  const freeze = (how: 'panes' | 'row' | 'col' | 'none') => {
    changeSheet(s => {
      if (how === 'none') delete s.freeze;
      else s.freeze = how === 'row' ? { c: 0, r: 1 } : how === 'col' ? { c: 1, r: 0 } : { c: sel.a.c, r: sel.a.r };
      if (s.freeze && !s.freeze.c && !s.freeze.r) delete s.freeze;
    });
    const el = scrollRef.current;
    if (el && how !== 'panes') { el.scrollTop = 0; el.scrollLeft = 0; }
  };

  // ---------- status: sum, average and count of the selection, like Excel ----------
  const stats = useMemo(() => {
    let sum = 0, count = 0, filledN = 0;
    if ((range.c2 - range.c1 + 1) * (range.r2 - range.r1 + 1) > 200000) return null;
    for (let r = range.r1; r <= range.r2; r++) {
      if (hiddenRows.has(r)) continue;
      for (let c = range.c1; c <= range.c2; c++) {
        const v = values.get(key(c, r));
        if (v === undefined || v === '') continue;
        filledN++;
        if (typeof v === 'number') { sum += v; count++; }
      }
    }
    return { sum, count, filled: filledN };
  }, [values, range.c1, range.r1, range.c2, range.r2, hiddenRows]);
  const fmt = (n: number) => display(n, activeStyle.format === 'currency' || activeStyle.format === 'percent' ? activeStyle : { format: 'general' }, lang, currency);

  const barText = edit ? edit.text : activeCell?.input ?? '';
  const nameBox = single ? cellName(sel.a.c, sel.a.r) : `${cellName(range.c1, range.r1)}:${cellName(range.c2, range.r2)}`;
  const letters = shell.tabs('letter');
  const linkedLetterOpen = !!link && link.moduleId === 'letter' && letters.some(x => x.tabId === link.tabId);

  // ---------- drawing ----------
  const dark = theme === 'dark';
  const fontPx = (st?: CellStyle) => (st?.size ?? DEFAULT_PT) * PX_PER_PT * z;
  const covered = useMemo(() => {
    const out = new Set<string>();
    for (const m of merges) forBox(m, (c, r) => { if (c !== m.c1 || r !== m.r1) out.add(key(c, r)); });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merges]);
  const rect = (b: Range): CSSProperties => ({ left: lefts[b.c1], top: tops[b.r1], width: lefts[b.c2 + 1] - lefts[b.c1], height: tops[b.r2 + 1] - tops[b.r1] });

  /** One cell, or one merged block, as the grid shows it. */
  const drawCell = (c: number, r: number, spillTo = 0): ReactNode => {
    const k = key(c, r);
    const cell = sheet.cells[k];
    const look: CondLook | undefined = looks.get(k);
    if (!cell && !look) return null;
    const v = values.get(k) ?? '';
    const st = cell?.style;
    const text = cell ? display(v, st, lang, currency) : '';
    const m = merges.find(mm => mm.c1 === c && mm.r1 === r);
    const box = rect(m ?? { c1: c, r1: r, c2: c, r2: r });
    const fill = look?.fill ?? st?.fill;
    if (!text && !fill && !st?.borders && !look?.bar) return null;
    const align = st?.align ?? (m ? 'left' : naturalAlign(v));
    const ink = look?.color ?? st?.color ?? (fill && isLight(fill) && dark ? '#1F1F1F' : undefined);
    const style: CSSProperties = {
      ...box,
      justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
      alignItems: st?.valign === 'top' ? 'flex-start' : st?.valign === 'bottom' ? 'flex-end' : 'center',
      fontWeight: st?.bold ? 700 : undefined, fontStyle: st?.italic ? 'italic' : undefined,
      textDecoration: [st?.underline && 'underline', st?.strike && 'line-through'].filter(Boolean).join(' ') || undefined,
      color: ink, background: fill,
      fontFamily: st?.font ? cssFont(st.font) : undefined,
      fontSize: fontPx(st), lineHeight: st?.wrap ? 1.3 : undefined,
      paddingLeft: (7 + (st?.indent ?? 0) * 12) * z, paddingRight: 7 * z,
      overflow: spillTo ? 'visible' : 'hidden',
      zIndex: spillTo ? 1 : undefined,
    };
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const b = st?.borders?.[side];
      if (b) (style as Record<string, string>)[`border${side[0].toUpperCase()}${side.slice(1)}`] = borderCss({ ...b, color: b.color ?? (dark ? 'rgba(242,237,226,.8)' : '#000') });
    }
    return (
      <div key={k} data-cell={cellName(c, r)} className={`cell${isError(v) ? ' err' : ''}${st?.wrap ? ' wrap' : ''}`} style={style} title={isError(v) ? cell?.input : undefined}>
        {look?.bar && <i className="cell-bar" style={{ width: `calc(${Math.max(0, Math.min(1, look.bar.pct)) * 100}% - 4px)`, background: look.bar.color }} />}
        <span style={spillTo ? { width: spillTo - (7 + (st?.indent ?? 0) * 12) * z, flex: 'none' } : undefined}>{text}</span>
      </div>
    );
  };
  /** How far text runs right over empty neighbors, in pixels, or 0 when it fits or cannot. */
  const spill = (c: number, r: number, last: number): number => {
    const cell = sheet.cells[key(c, r)];
    if (!cell?.input || cell.style?.wrap || covered.has(key(c, r)) || merges.some(m => m.c1 === c && m.r1 === r)) return 0;
    const v = values.get(key(c, r)) ?? '';
    if (typeof v !== 'string' || (cell.style?.align && cell.style.align !== 'left')) return 0;
    const st = cell.style;
    const need = textWidth(v, canvasFont(st, fontPx(st))) + (14 + (st?.indent ?? 0) * 12) * z;
    if (need <= width(c)) return 0;
    let end = c;
    while (end < last && lefts[end + 1] - lefts[c] < need) {
      const nk = key(end + 1, r);
      if (sheet.cells[nk]?.input || covered.has(nk) || merges.some(m => m.c1 === end + 1 && m.r1 === r)) break;
      end++;
    }
    return end > c ? lefts[end + 1] - lefts[c] : 0;
  };

  /** Everything drawn for one part of the grid: the main area, or a frozen pane. */
  const layer = (ca: number, cb: number, ra: number, rb: number, main: boolean): ReactNode[] => {
    const out: ReactNode[] = [];
    if (!sheet.noGrid) {
      const lines: ReactNode[] = [];
      for (let c = ca; c <= cb; c++) lines.push(<i key={`v${c}`} className="gl-v" style={{ left: lefts[c + 1] - 1, top: tops[ra], height: tops[rb + 1] - tops[ra] }} />);
      for (let r = ra; r <= rb; r++) if (height(r)) lines.push(<i key={`h${r}`} className="gl-h" style={{ top: tops[r + 1] - 1, left: lefts[ca], width: lefts[cb + 1] - lefts[ca] }} />);
      out.push(<div key="grid" className="gridlines">{lines}</div>);
    }
    const drawn = new Set<string>();
    for (let r = ra; r <= rb; r++) {
      if (!height(r)) continue;
      // Text from a cell left of the view can still run into it.
      let start = ca;
      for (let back = ca - 1; back >= Math.max(0, ca - 20); back--) if (sheet.cells[key(back, r)]?.input) { start = back; break; }
      for (let c = start; c <= cb; c++) {
        const k = key(c, r);
        if (covered.has(k)) continue;
        const s = spill(c, r, cb + 1);
        const el = drawCell(c, r, s);
        if (el) { out.push(el); drawn.add(k); }
      }
    }
    // Merged blocks that start outside this part but reach into it.
    for (const m of merges) {
      if (m.c2 < ca || m.c1 > cb || m.r2 < ra || m.r1 > rb || drawn.has(key(m.c1, m.r1))) continue;
      const el = drawCell(m.c1, m.r1);
      if (el) out.push(el);
    }
    // Filter buttons on the table's header row.
    const f = sheet.filter;
    if (f && f.range.r1 >= ra && f.range.r1 <= rb) {
      for (let c = Math.max(f.range.c1, ca); c <= Math.min(f.range.c2, cb); c++) {
        const on = (f.hidden[c]?.length ?? 0) > 0 || f.sort?.c === c;
        out.push(
          <button key={`f${c}`} type="button" className={`filter-btn${on ? ' on' : ''}`} title={t('class.filter.menu')} aria-label={t('class.filter.menu')}
            style={{ left: lefts[c + 1] - 22 * z, top: tops[f.range.r1] + (height(f.range.r1) - 18 * z) / 2, width: 18 * z, height: 18 * z }}
            onMouseDown={e => {
              e.preventDefault(); e.stopPropagation();
              if (filterMenu?.c === c) { setFilterMenu(null); return; }
              const b = e.currentTarget.getBoundingClientRect();
              setFilterMenu({ c, left: Math.min(b.left, window.innerWidth - 270), top: b.bottom + 4 });
            }}>
            <Icon name={f.hidden[c]?.length ? 'filter' : 'caret'} size={Math.round(10 * Math.max(1, z))} />
          </button>,
        );
      }
    }
    // Circles around entries that break their rule (Data › Circle invalid data).
    if (circles) for (const k of circles) {
      const { c, r } = unkey(k);
      if (c < ca || c > cb || r < ra || r > rb) continue;
      const b = rect({ c1: c, r1: r, c2: c, r2: r }) as { left: number; top: number; width: number; height: number };
      out.push(<div key={`ci${k}`} className="invalid-circle" style={{ left: b.left - 4, top: b.top - 3, width: b.width + 8, height: b.height + 6 }} />);
    }
    // A list rule shows its arrow beside the active cell, like Excel.
    const vr = !edit && !chartSel ? validationAt(sheet.validations, sel.a.c, sel.a.r) : undefined;
    if (vr?.kind === 'list' && vr.dropdown !== false && sel.a.c >= ca && sel.a.c <= cb && sel.a.r >= ra && sel.a.r <= rb) {
      const am = mergeAt(sel.a.c, sel.a.r) ?? { c1: sel.a.c, r1: sel.a.r, c2: sel.a.c, r2: sel.a.r };
      const b = rect(am) as { left: number; top: number; width: number; height: number };
      const w = Math.max(18, Math.min(24, b.height));
      out.push(
        <button key="vl" type="button" className="val-drop" aria-label={t('class.val.choose')} title={t('class.val.choose')}
          style={{ left: b.left + b.width + 1, top: b.top, width: w, height: b.height }}
          onMouseDown={e => {
            e.preventDefault(); e.stopPropagation();
            if (listMenu) { setListMenu(null); return; }
            const bb = e.currentTarget.getBoundingClientRect();
            setListMenu({ c: sel.a.c, r: sel.a.r, left: Math.max(8, Math.min(bb.right - 220, window.innerWidth - 228)), top: bb.bottom + 2, choices: listChoices(vr, values) });
          }}>
          <Icon name="caret" size={10} />
        </button>,
      );
    }
    // The rule's input message under the active cell.
    if (vr?.prompt?.text && main && sel.a.c >= ca && sel.a.c <= cb && sel.a.r >= ra && sel.a.r <= rb) {
      const b = rect({ c1: sel.a.c, r1: sel.a.r, c2: sel.a.c, r2: sel.a.r }) as { left: number; top: number; width: number; height: number };
      out.push(<div key="vp" className="val-prompt" role="note" style={{ left: b.left + 8, top: b.top + b.height + 6 }}>{vr.prompt.title && <b>{vr.prompt.title}</b>}{vr.prompt.text}</div>);
    }
    // Selection, the active cell, the fill handle and the fill preview.
    if (!chartSel) {
      out.push(<div key="sel" className="sel-box" style={rect(range)} />);
      out.push(<div key="act" className="active-box" style={rect(mergeAt(sel.a.c, sel.a.r) ?? { c1: sel.a.c, r1: sel.a.r, c2: sel.a.c, r2: sel.a.r })} />);
      if (!edit) out.push(<div key="fh" className="fill-handle" style={{ left: lefts[range.c2 + 1] - 4, top: tops[range.r2 + 1] - 4 }} onMouseDown={onFillDown} title={t('class.fillHandle')} />);
    }
    if (fillTo) out.push(<div key="fp" className="fill-preview" style={rect(fillTo)} />);
    if (main) for (const ch of sheet.charts ?? []) {
      const on = ch.id === chartSel;
      out.push(
        <div key={ch.id} className={`chart-obj${on ? ' on' : ''}`} style={{ left: ch.x * z, top: ch.y * z, width: ch.w * z, height: ch.h * z }}
          onMouseDown={e => moveChart(ch, e, 'move')} onDoubleClick={e => e.stopPropagation()}>
          <ChartSvg chart={ch} data={chartData(sheet, values, ch, lang, currency, seriesName)} look={dark ? DARK : LIGHT} lang={lang} />
          {on && <span className="chart-size" onMouseDown={e => moveChart(ch, e, 'size')} />}
        </div>,
      );
    }
    return out;
  };

  const editorAt = edit?.where === 'cell' ? (() => {
    const m = mergeAt(sel.a.c, sel.a.r);
    const b = rect(m ?? { c1: sel.a.c, r1: sel.a.r, c2: sel.a.c, r2: sel.a.r });
    const multi = edit.text.includes('\n') || !!activeStyle.wrap;
    const props = {
      className: `cell-editor${multi ? ' multi' : ''}`, value: edit.text, spellCheck: false,
      style: {
        left: b.left, top: b.top, minWidth: b.width, minHeight: b.height,
        width: Math.max(Number(b.width), textWidth(edit.text.split('\n').reduce((a, l) => (l.length > a.length ? l : a), ''), canvasFont(activeStyle, fontPx(activeStyle))) + 24),
        height: multi ? Math.max(Number(b.height), (edit.text.split('\n').length) * fontPx(activeStyle) * 1.3 + 10) : b.height,
        fontWeight: activeStyle.bold ? 700 : undefined, fontStyle: activeStyle.italic ? 'italic' : undefined,
        fontFamily: activeStyle.font ? cssFont(activeStyle.font) : undefined, fontSize: fontPx(activeStyle),
      } as CSSProperties,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const text = e.target.value; setEdit(ed => ed && { ...ed, text }); },
      onKeyDown: onEditorKey, onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    };
    const el = multi
      ? <textarea key="editor" ref={x => { editorRef.current = x; }} {...props} />
      : <input key="editor" ref={x => { editorRef.current = x; }} {...props} />;
    return { el, top: sel.a.r < fr, left: sel.a.c < fc };
  })() : null;

  // The four parts of a frozen sheet: the corner, the top rows, the left columns and the main area.
  const mainCells = layer(c0, c9, r0, r9, true);
  const topCells = fr ? layer(c0, c9, 0, fr - 1, false) : null;
  const leftCells = fc ? layer(0, fc - 1, r0, r9, false) : null;
  const cornerCells = fr && fc ? layer(0, fc - 1, 0, fr - 1, false) : null;
  const cellVars = { '--z': z } as CSSProperties;

  const visibleCols = Array.from({ length: c9 - c0 + 1 }, (_, i) => c0 + i);
  const visibleRows = Array.from({ length: r9 - r0 + 1 }, (_, i) => r0 + i).filter(r => height(r));
  const colHead = (c: number) => (
    <div key={c} className={`col-head${c >= range.c1 && c <= range.c2 ? ' on' : ''}`} style={{ left: lefts[c], width: width(c) }}
      onMouseDown={e => selectWhole('c', c, e.shiftKey)}>
      {colName(c)}
      <span className="col-resize" onMouseDown={e => resize('c', c, e)} onDoubleClick={() => fitColumn(c)} />
    </div>
  );
  const rowHead = (r: number) => (
    <div key={r} className={`row-head${r >= range.r1 && r <= range.r2 ? ' on' : ''}${sheet.filter && r > sheet.filter.range.r1 && r <= sheet.filter.range.r2 && hiddenRows.size ? ' filtered' : ''}`}
      style={{ top: tops[r], height: height(r) }} onMouseDown={e => selectWhole('r', r, e.shiftKey)}>
      {r + 1}
      <span className="row-resize" onMouseDown={e => resize('r', r, e)} onDoubleClick={() => changeSheet(s => { delete s.heights?.[r]; })} />
    </div>
  );

  const tabs: { id: Tab; label: MessageKey }[] = [
    { id: 'home', label: 'letter.tab.home' }, { id: 'insert', label: 'letter.tab.insert' }, { id: 'formulas', label: 'class.tab.formulas' },
    { id: 'metiers', label: 'class.tab.metiers' }, { id: 'data', label: 'class.tab.data' }, { id: 'layout', label: 'class.tab.layout' }, { id: 'view', label: 'letter.tab.view' },
  ];
  const shownTab: Tab = tab === 'chart' && !chart ? 'insert' : tab;
  const formats: NumberFormat[] = ['general', 'number', 'integer', 'currency', 'accounting', 'percent', 'fraction', 'scientific', 'date', 'longDate', 'time', 'dateTime', 'text'];
  const sample = (f: NumberFormat) => (f === 'general' || f === 'text' ? undefined
    : display(f === 'date' || f === 'longDate' || f === 'dateTime' ? 46320.6 : f === 'time' ? 0.6 : f === 'percent' ? 0.125 : f === 'fraction' ? 1.25 : 1234.5, { format: f }, lang, currency));
  const chartIcon: Record<Chart['type'], string> = { column: 'chart', stacked: 'stacked', bar: 'barchart', line: 'linechart', area: 'areachart', pie: 'piechart', doughnut: 'doughnut', scatter: 'scatter' };
  const sendLetterMenu = (onPick: (tabId: string | null) => void, hint?: ReactNode) => (close: () => void) => <>
    {hint}
    {letters.map(x => <MenuItem key={x.tabId} label={x.title} hint={link?.tabId === x.tabId ? t('class.linked') : undefined} onClick={() => { close(); onPick(x.tabId); }} />)}
    {letters.length > 0 && <hr />}
    <MenuItem label={t('class.newLetter')} onClick={() => { close(); onPick(null); }} />
  </>;
  const borderItems: { id: BorderKind; label: MessageKey }[] = [
    { id: 'bottom', label: 'letter.border.bottom' }, { id: 'top', label: 'letter.border.top' }, { id: 'left', label: 'class.border.left' },
    { id: 'right', label: 'class.border.right' }, { id: 'none', label: 'letter.border.none' }, { id: 'all', label: 'class.border.all' },
    { id: 'outside', label: 'class.border.outside' }, { id: 'thickBox', label: 'class.border.thickBox' }, { id: 'topBottom', label: 'class.border.topBottom' },
    { id: 'thickBottom', label: 'class.border.thickBottom' }, { id: 'doubleBottom', label: 'class.border.doubleBottom' },
  ];

  return (
    <div className={`class${painter ? ' painting' : ''}`} ref={rootRef} onKeyDown={e => {
      // Shortcuts like Ctrl+F still work after a click on the ribbon took the focus.
      const el = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && !gridRef.current?.contains(el) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && !el.closest('.drop-panel, dialog')) {
        gridRef.current?.focus();
        onGridKey(e);
      }
    }}>
      <div className="ribbon">
        <div className="ribbon-tabs" role="tablist">
          <button type="button" className="ribbon-file" onClick={() => setPanel('file')}>{t('letter.tab.file')}</button>
          {tabs.map(x => <button key={x.id} type="button" role="tab" aria-selected={shownTab === x.id} className={shownTab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>{t(x.label)}</button>)}
          <button type="button" role="tab" aria-selected={shownTab === 'oi1'} className={`ribbon-special${shownTab === 'oi1' ? ' on' : ''}`} onClick={() => setTab('oi1')}><span className="dot" />Office In 1</button>
          <button type="button" role="tab" aria-selected={shownTab === 'convert'} className={`ribbon-special ribbon-convert${shownTab === 'convert' ? ' on' : ''}`} onClick={() => setTab('convert')}>{t('convert.tab')}</button>
        <TutoTab />
        <RibbonToggle />
          {chart && <button type="button" role="tab" aria-selected={shownTab === 'chart'} className={shownTab === 'chart' ? 'on' : ''} onClick={() => setTab('chart')}>{t('class.tab.chart')}</button>}
          <span className="ribbon-quick">
            <CopilotButton open={copilot} onClick={() => setCopilot(o => !o)} />
            <Btn icon="undo" title="letter.undo" onClick={undoOnce} disabled={!undo.current.length} />
            <Btn icon="redo" title="letter.redo" onClick={redoOnce} disabled={!redo.current.length} />
          </span>
        </div>
        <div className="ribbon-panel" role="tabpanel" onMouseDown={e => { if (!['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) e.preventDefault(); }}>
          {shownTab === 'home' && <>
            <Group label="letter.group.clipboard">
              <Btn big icon="paste" title="letter.paste" onClick={async () => {
                try {
                  const items = await navigator.clipboard.read?.();
                  const html = items?.find(i => i.types.includes('text/html'));
                  const table = html ? tableFromHtml(await (await html.getType('text/html')).text()) : tableFromText(await navigator.clipboard.readText());
                  if (table) pasteTable(table);
                } catch { alert(t('letter.pasteBlocked')); }
              }} />
              <div className="stack">
                <Btn icon="cut" title="letter.cut" onClick={() => { gridRef.current?.focus(); document.execCommand('cut'); }} />
                <Btn icon="copy" title="letter.copy" onClick={() => { gridRef.current?.focus(); document.execCommand('copy'); }} />
                <Btn icon="painter" title="letter.painter" active={!!painter} onClick={() => setPainter(p => (p ? null : { ...activeStyle }))} />
              </div>
            </Group>
            <Group label="letter.group.font">
              <div className="rows">
                <div className="row">
                  <Combo className="font-box" help="letter.font" label={t('letter.font')} value={fontShown} groups={fontGroups}
                    itemStyle={f => ({ fontFamily: cssFont(f) })} onPick={f => styleRange(st => ({ ...st, font: f === 'Calibri' ? undefined : f }))} />
                  <Combo className="size-box" help="letter.fontSize" label={t('letter.fontSize')} value={String(sizeShown)} numeric inputMode="decimal"
                    groups={[{ items: FONT_SIZES.map(String) }]} onPick={v => setSize(parseFloat(v.replace(',', '.')))} />
                  <Btn icon="grow" title="letter.grow" onClick={() => stepSize(1)} />
                  <Btn icon="shrink" title="letter.shrink" onClick={() => stepSize(-1)} />
                </div>
                <div className="row">
                  <Btn label="B" title="letter.bold" onClick={() => toggle('bold')} active={!!activeStyle.bold} style={{ fontWeight: 700 }} />
                  <Btn label="I" title="letter.italic" onClick={() => toggle('italic')} active={!!activeStyle.italic} style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }} />
                  <Btn label="U" title="letter.underline" onClick={() => toggle('underline')} active={!!activeStyle.underline} style={{ textDecoration: 'underline' }} />
                  <Btn label="ab" title="letter.strike" onClick={() => toggle('strike')} active={!!activeStyle.strike} style={{ textDecoration: 'line-through' }} />
                  <Drop icon="borders" title="letter.borders">
                    {close => <>
                      {borderItems.map(b => <MenuItem key={b.id} label={t(b.label)} onClick={() => { close(); setBorders(b.id); }} />)}
                      <hr />
                      <span className="kicker">{t('class.border.color')}</span>
                      <ColorGrid none="letter.automatic" value={borderColor} onPick={c => setBorderColor(c ?? undefined)} />
                    </>}
                  </Drop>
                  <Drop icon="fill" title="class.fill" swatch={activeStyle.fill ?? null}>
                    {close => <ColorGrid none="letter.noColor" value={activeStyle.fill} onPick={c => { styleRange(st => ({ ...st, fill: c ?? undefined })); close(); }} />}
                  </Drop>
                  <Drop label={<span className="color-a">A<i style={{ background: activeStyle.color ?? 'currentColor' }} /></span>} title="letter.color">
                    {close => <ColorGrid none="letter.automatic" value={activeStyle.color} onPick={c => { styleRange(st => ({ ...st, color: c ?? undefined })); close(); }} />}
                  </Drop>
                </div>
              </div>
            </Group>
            <Group label="class.group.alignment">
              <div className="rows">
                <div className="row">
                  <Btn icon="vtop" title="class.alignTop" onClick={() => styleRange(st => ({ ...st, valign: 'top' }))} active={activeStyle.valign === 'top'} />
                  <Btn icon="vmid" title="class.alignMiddle" onClick={() => styleRange(st => ({ ...st, valign: undefined }))} active={!activeStyle.valign || activeStyle.valign === 'middle'} />
                  <Btn icon="vbot" title="class.alignBottom" onClick={() => styleRange(st => ({ ...st, valign: 'bottom' }))} active={activeStyle.valign === 'bottom'} />
                  <Btn icon="wrap" title="class.wrap" onClick={() => toggle('wrap')} active={!!activeStyle.wrap} />
                </div>
                <div className="row">
                  <Btn icon="left" title="letter.alignLeft" onClick={() => styleRange(st => ({ ...st, align: st.align === 'left' ? undefined : 'left' }))} active={activeStyle.align === 'left'} />
                  <Btn icon="center" title="letter.alignCenter" onClick={() => styleRange(st => ({ ...st, align: st.align === 'center' ? undefined : 'center' }))} active={activeStyle.align === 'center'} />
                  <Btn icon="right" title="letter.alignRight" onClick={() => styleRange(st => ({ ...st, align: st.align === 'right' ? undefined : 'right' }))} active={activeStyle.align === 'right'} />
                  <Btn icon="outdent" title="class.indentLess" onClick={() => styleRange(st => ({ ...st, indent: Math.max(0, (st.indent ?? 0) - 1) || undefined }))} />
                  <Btn icon="indent" title="class.indentMore" onClick={() => styleRange(st => ({ ...st, indent: Math.min(15, (st.indent ?? 0) + 1), align: st.align === 'right' || st.align === 'center' ? undefined : st.align }))} />
                </div>
              </div>
              <div className="split">
                <Btn big icon="merge" title="class.mergeCenter" active={mergedHere} onClick={() => (mergedHere ? merge('unmerge') : merge('center'))} />
                <Drop title="class.mergeOptions">
                  {close => (['center', 'across', 'cells', 'unmerge'] as const).map(m => (
                    <MenuItem key={m} label={t(`class.merge.${m}` as MessageKey)} onClick={() => { close(); merge(m); }} />
                  ))}
                </Drop>
              </div>
            </Group>
            <Group label="class.group.number">
              <div className="rows">
                <div className="row">
                  <Drop text label={<span className="fmt-label">{t(`class.format.${activeStyle.format ?? 'general'}` as MessageKey)}</span>} title="class.numberFormat">
                    {close => formats.map(f => (
                      <MenuItem key={f} active={(activeStyle.format ?? 'general') === f} label={t(`class.format.${f}` as MessageKey)}
                        hint={sample(f)} onClick={() => { setFormat(f); close(); }} />
                    ))}
                  </Drop>
                </div>
                <div className="row">
                  <Btn icon="currency" title="class.format.currency" onClick={() => setFormat('currency')} active={activeStyle.format === 'currency'} />
                  <Btn icon="percent" title="class.format.percent" onClick={() => setFormat('percent')} active={activeStyle.format === 'percent'} />
                  <Btn icon="thousands" title="class.thousands" onClick={() => styleRange(st => ({ ...st, format: 'number', thousands: true }))} active={activeStyle.format === 'number' && activeStyle.thousands !== false} />
                  <Btn icon="decmore" title="class.decimalsMore" onClick={() => stepDecimals(1)} />
                  <Btn icon="decless" title="class.decimalsLess" onClick={() => stepDecimals(-1)} />
                </div>
              </div>
            </Group>
            <Group label="class.group.styles">
              <Drop big icon="palette" title="class.cond.title">
                {close => <>
                  <span className="kicker">{t('class.cond.highlight')}</span>
                  {HIGHLIGHT_KINDS.map(k => <MenuItem key={k} label={t(`class.cond.${k}` as MessageKey)} onClick={() => { close(); if (k === 'duplicate') addRule({ kind: k }); else setCondDialog(k); }} />)}
                  <span className="kicker">{t('class.cond.topBottom')}</span>
                  {TOP_KINDS.map(k => <MenuItem key={k} label={t(`class.cond.${k}` as MessageKey)} onClick={() => { close(); if (k === 'top' || k === 'bottom') setCondDialog(k); else addRule({ kind: k }); }} />)}
                  <span className="kicker">{t('class.cond.visual')}</span>
                  <MenuItem label={t('class.cond.bars')} onClick={() => { close(); addRule({ kind: 'bars', fill: '#638EC6' }); }} />
                  <MenuItem label={t('class.cond.scale')} onClick={() => { close(); addRule({ kind: 'scale', colors: ['#F8696B', '#63BE7B', '#FFEB84'] }); }} />
                  <MenuItem label={t('class.cond.scale2')} onClick={() => { close(); addRule({ kind: 'scale', colors: ['#FFFFFF', '#63BE7B'] }); }} />
                  <hr />
                  <MenuItem label={t('class.cond.clearHere')} onClick={() => { close(); changeSheet(s => { s.rules = (s.rules ?? []).filter(rr => !overlaps(rr.range, range)); }); }} />
                  <MenuItem label={t('class.cond.clearSheet')} onClick={() => { close(); changeSheet(s => { s.rules = []; }); }} />
                </>}
              </Drop>
            </Group>
            <Group label="class.group.cells">
              <Btn big icon="insrow" title="class.insertRow" onClick={() => shift('r', range.r1, 1)} />
              <Btn big icon="inscol" title="class.insertColumn" onClick={() => shift('c', range.c1, 1)} />
              <div className="stack">
                <Btn icon="delrow" title="letter.deleteRow" text onClick={() => shift('r', range.r1, -(range.r2 - range.r1 + 1))} />
                <Btn icon="delcol" title="letter.deleteColumn" text onClick={() => shift('c', range.c1, -(range.c2 - range.c1 + 1))} />
                <Drop icon="clear" title="class.clear" text>
                  {close => <>
                    <MenuItem label={t('class.clearAll')} onClick={() => { close(); clearAll(); }} />
                    <MenuItem label={t('class.clearFormats')} onClick={() => { close(); clearFormats(); }} />
                    <MenuItem label={t('class.clearContents')} onClick={() => { close(); clearRange(); }} />
                  </>}
                </Drop>
              </div>
            </Group>
            <Group label="letter.group.editing">
              <Btn big icon="sum" title="class.autoSum" onClick={() => autoSum()} />
              <div className="stack">
                <Btn icon="sort" title="class.sortAZ" text onClick={() => sort(1)} />
                <Btn icon="filter" title="class.filter" text active={!!sheet.filter} onClick={toggleFilter} />
                <Btn icon="find" title="class.findReplace" text onClick={() => setFind({ replace: false })} />
              </div>
            </Group>
          </>}
          {shownTab === 'insert' && <>
            <Group label="class.group.charts">
              {(['column', 'line', 'pie', 'bar'] as const).map(type => <Btn key={type} big icon={chartIcon[type]} title={`class.chart.${type}`} onClick={() => insertChart(type)} />)}
              <Drop big icon="chart" title="class.chart.more">
                {close => CHART_TYPES.map(type => <MenuItem key={type} label={<><Icon name={chartIcon[type]} /> {t(`class.chart.${type}` as MessageKey)}</>} onClick={() => { close(); insertChart(type); }} />)}
              </Drop>
            </Group>
            <Group label="class.group.functions">
              <Btn big icon="fx" title="class.fn.insert" onClick={() => setFnDialog('all')} />
            </Group>
            <Group label="class.group.filters">
              <Btn big icon="filter" title="class.filter" active={!!sheet.filter} onClick={toggleFilter} />
            </Group>
          </>}
          {shownTab === 'formulas' && <>
            <Group label="class.group.functions">
              <Btn big icon="sum" title="class.autoSum" onClick={() => autoSum()} />
              {(['AVERAGE', 'MIN', 'MAX', 'COUNT'] as const).map(fn => <Btn key={fn} big icon="fx" title={fn} help={`tuto.fn.${fn}`} onClick={() => autoSum(fn)} />)}
              <Btn big icon="fx" title="class.fn.insert" onClick={() => setFnDialog('all')} />
            </Group>
            <Group label="class.group.library">
              {(['financial', 'logical', 'text', 'date', 'lookup', 'math'] as const).map(c => (
                <Drop key={c} text icon={FN_ICON[c]} title={`class.fn.cat.${c}`}>
                  {close => <div className="fn-list">{functionsIn(c).map(fn => (
                    <MenuItem key={fn} label={fn} onClick={() => { close(); startEdit(`=${fn}(`, 'edit'); }} />
                  ))}</div>}
                </Drop>
              ))}
              <Drop text icon="fx" title="class.fn.more">
                {close => <div className="fn-more">{(['statistical', 'engineering', 'information', 'database'] as const).map(c => (
                  <section key={c}><h4>{t(`class.fn.cat.${c}` as MessageKey)}</h4><div className="fn-list">{functionsIn(c).map(fn => (
                    <MenuItem key={fn} label={fn} onClick={() => { close(); startEdit(`=${fn}(`, 'edit'); }} />
                  ))}</div></section>
                ))}</div>}
              </Drop>
            </Group>
            <Group label="class.group.fill">
              <Btn big icon="pull" title="class.fillDown" onClick={fillDown} disabled={range.r2 === range.r1} />
              <Btn big icon="next" title="class.fillRight" onClick={fillRight} disabled={range.c2 === range.c1} />
            </Group>
          </>}
          {shownTab === 'data' && <>
            <Group label="class.group.sort">
              <Btn big icon="sort" title="class.sortAZ" onClick={() => sort(1)} />
              <Btn big icon="sort" title="class.sortZA" onClick={() => sort(-1)} />
              <Btn big icon="filter" title="class.filter" active={!!sheet.filter} onClick={toggleFilter} />
            </Group>
            <Group label="class.group.tools">
              <Btn big icon="dedupe" title="class.removeDuplicates" onClick={removeDuplicates} />
              <Btn big icon="find" title="class.findReplace" onClick={() => setFind({ replace: true })} />
            </Group>
            <Group label="class.group.dataTools">
              <Btn big icon="validate" title="class.validation" onClick={() => { if (edit) commitEdit(); setWhatIf('val'); }} />
              <div className="stack">
                <Btn icon="circle" title="class.circleInvalid" text onClick={circleInvalid} />
                <Btn icon="clear" title="class.clearCircles" text disabled={!circles} onClick={() => setCircles(null)} />
              </div>
            </Group>
            <Group label="class.group.whatif">
              <Btn big icon="target" title="class.goalSeek" onClick={() => { if (edit) commitEdit(); setWhatIf('seek'); }} />
              <Btn big icon="scenario" title="class.scenarios" onClick={() => { if (edit) commitEdit(); setWhatIf('scen'); }} />
              <Btn big icon="solver" title="class.solver" onClick={() => { if (edit) commitEdit(); setWhatIf('solver'); }} />
            </Group>
            <Group label="class.group.sheets">
              <Btn big icon="new" title="class.addSheet" onClick={addSheet} />
              <Btn big icon="rename" title="class.renameSheet" onClick={() => renameSheet(active)} />
              <Drop big icon="fill" title="class.tabColor" swatch={sheet.tabColor ?? null}>
                {close => <ColorGrid none="letter.noColor" value={sheet.tabColor} onPick={c => { setTabColor(c); close(); }} />}
              </Drop>
            </Group>
          </>}
          {shownTab === 'metiers' && <>
            <Group label="class.pro.group.category">
              <div className="pro-catbtns">
                {PRO_CATEGORIES.map(c => <Btn key={c.id} text icon={c.icon} title={tx(c.name, proLang)} help={`tuto.proCat.${c.id}`} active={proCat === c.id} onClick={() => pickProCat(c.id)} />)}
                <Btn text icon="columns" title="class.pro.cat.all" active={proCat === 'all'} onClick={() => pickProCat('all')} />
              </div>
            </Group>
            <Group label="class.pro.group.tools">
              {FEATURED[proCat].map(f => { const tool = toolById(f.id)!; return (
                <Btn key={f.id} big icon={tool.icon} title={tx(tool.name, proLang)} help={tx(tool.desc, proLang)} label={<span className="rb-label">{tx(f.short, proLang)}</span>} onClick={() => addProSheet(tool)} />
              ); })}
              <Btn big icon="index" title="class.pro.gallery" onClick={() => setProDialog('gallery')} />
            </Group>
            <Group label="class.pro.group.audit">
              {AUDITS.map(x => <Btn key={x.id} big icon={x.icon} title={`${tx(x.name, proLang)}: ${tx(x.desc, proLang)}`} help={tx(x.desc, proLang)} label={<span className="rb-label">{tx(AUDIT_SHORT[x.id], proLang)}</span>} onClick={() => runAuditTool(x.id)} />)}
            </Group>
            <Group label="class.pro.group.money">
              <Btn big icon="currency" title="class.pro.converter" onClick={() => setProDialog('converter')} />
              <Btn big icon="table" title="class.pro.table" onClick={() => addProSheet(toolById('currencies')!)} />
            </Group>
          </>}
          {shownTab === 'layout' && <>
            <Group label="class.group.pageSetup">
              <Drop big icon="margins" title="class.print.margins">
                {close => Object.keys(MARGINS).map(m => <MenuItem key={m} active={ps.margins === m} label={marginLabel(m)} onClick={() => { close(); changePrint({ margins: m }); }} />)}
              </Drop>
              <Drop big icon="orientation" title="class.print.orientation">
                {close => (['portrait', 'landscape'] as const).map(o => <MenuItem key={o} active={ps.orientation === o} label={t(`class.print.${o}` as MessageKey)} onClick={() => { close(); changePrint({ orientation: o }); }} />)}
              </Drop>
              <Drop big icon="size" title="class.print.paper">
                {close => Object.keys(PAPERS).map(k => <MenuItem key={k} active={ps.paper === k} label={paperLabel(k)} onClick={() => { close(); changePrint({ paper: k }); }} />)}
              </Drop>
              <Drop big icon="select" title="class.print.scope.area">
                {close => <>
                  {ps.area && <span className="kicker">{t('class.print.area.now', { range: `${cellName(ps.area.c1, ps.area.r1)}:${cellName(ps.area.c2, ps.area.r2)}` })}</span>}
                  <MenuItem label={t('class.print.area.set')} hint={nameBox} onClick={() => { close(); setPrintArea('set'); }} />
                  <MenuItem label={t('class.print.area.add')} hint={nameBox} onClick={() => { close(); setPrintArea('add'); }} />
                  {ps.area && <MenuItem label={t('class.print.area.clear')} onClick={() => { close(); setPrintArea('clear'); }} />}
                </>}
              </Drop>
              <Drop big icon="headerrow" title="class.print.titles">
                {close => <>
                  <MenuItem active={!ps.titleRows && !ps.titleCols} label={t('class.print.none')} onClick={() => { close(); changePrint({ titleRows: 0, titleCols: 0 }); }} />
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <MenuItem key={`r${n}`} active={ps.titleRows === n && !ps.titleCols} label={t('class.print.firstRows', { n })} onClick={() => { close(); changePrint({ titleRows: n, titleCols: 0 }); }} />)}
                  {Array.from({ length: 6 }, (_, i) => i + 1).map(n => <MenuItem key={`c${n}`} active={ps.titleCols === n && !ps.titleRows} label={t('class.print.firstCols', { n, col: colName(n - 1) })} onClick={() => { close(); changePrint({ titleCols: n, titleRows: 0 }); }} />)}
                  <MenuItem active={ps.titleRows === 1 && ps.titleCols === 1} label={t('class.print.bothFirst')} onClick={() => { close(); changePrint({ titleRows: 1, titleCols: 1 }); }} />
                </>}
              </Drop>
            </Group>
            <Group label="class.group.scale">
              <Drop big icon="onepage" title="class.print.fit">
                {close => FITS.map(f => <MenuItem key={f} active={ps.fit === f} label={fitLabel(f)} onClick={() => { close(); changePrint({ fit: f }); }} />)}
              </Drop>
            </Group>
            <Group label="class.group.sheetOptions">
              <Btn big icon="gridlines" title="class.print.grid" active={!!ps.grid} onClick={() => changePrint({ grid: !ps.grid })} />
              <Btn big icon="headings" title="class.print.headings" active={!!ps.headings} onClick={() => changePrint({ headings: !ps.headings })} />
              <Btn big icon="center" title="class.print.center" active={!!ps.center} onClick={() => changePrint({ center: !ps.center })} />
            </Group>
            <Group label="class.group.headerFooter">
              <Drop big icon="header" title="class.print.header">
                {close => ['', ...hfTemplates()].map((v, i) => <MenuItem key={i} active={(ps.header ?? '') === v} label={hfSample(v, sheet.name, fileName || `${title}.xlsx`, lang)} onClick={() => { close(); changePrint({ header: v }); }} />)}
              </Drop>
              <Drop big icon="footer" title="class.print.footer">
                {close => ['', ...hfTemplates()].map((v, i) => <MenuItem key={i} active={(ps.footer ?? '') === v} label={hfSample(v, sheet.name, fileName || `${title}.xlsx`, lang)} onClick={() => { close(); changePrint({ footer: v }); }} />)}
              </Drop>
            </Group>
            <Group label="class.group.print">
              <Btn big icon="print" title="class.print.open" onClick={() => void print()} />
              <Btn big icon="play" title="class.print.quick" onClick={() => void quickPrint()} />
            </Group>
          </>}
          {shownTab === 'view' && <>
            <Group label="class.group.show">
              <Btn big icon="gridlines" title="class.gridlines" active={!sheet.noGrid} onClick={() => changeSheet(s => { if (s.noGrid) delete s.noGrid; else s.noGrid = true; })} />
              <Btn big icon="headings" title="class.headings" active={headings} onClick={() => setHeadings(h => !h)} />
            </Group>
            <Group label="letter.group.zoom">
              <Btn big icon="zoomin" title="letter.zoomIn" onClick={() => stepZoom(1)} disabled={zoom >= ZOOMS[ZOOMS.length - 1]} />
              <Btn big icon="zoomout" title="letter.zoomOut" onClick={() => stepZoom(-1)} disabled={zoom <= ZOOMS[0]} />
              <Btn big icon="search" title="class.zoom100" onClick={() => setZoom(1)} active={zoom === 1} />
              <Btn big icon="focus" title="class.zoomSelection" onClick={zoomToSelection} />
              <Btn big icon="onepage" title="ui.fitAll" onClick={fitSheet} />
            </Group>
            <Group label="class.group.window">
              <Drop big icon="freeze" title="class.freeze" active={!!sheet.freeze}>
                {close => <>
                  <MenuItem label={t('class.freeze.panes')} hint={sel.a.c || sel.a.r ? cellName(sel.a.c, sel.a.r) : undefined} onClick={() => { close(); freeze('panes'); }} />
                  <MenuItem label={t('class.freeze.row')} onClick={() => { close(); freeze('row'); }} />
                  <MenuItem label={t('class.freeze.col')} onClick={() => { close(); freeze('col'); }} />
                  {sheet.freeze && <MenuItem label={t('class.freeze.none')} onClick={() => { close(); freeze('none'); }} />}
                </>}
              </Drop>
            </Group>
            <Group label="class.group.print">
              <Btn big icon="print" title="letter.print" onClick={() => void print()} />
            </Group>
          </>}
          {shownTab === 'chart' && chart && <>
            <Group label="class.group.chartType">
              <Drop big icon={chartIcon[chart.type]} title="class.chart.type">
                {close => CHART_TYPES.map(type => <MenuItem key={type} active={chart.type === type} label={<><Icon name={chartIcon[type]} /> {t(`class.chart.${type}` as MessageKey)}</>} onClick={() => { close(); changeChart({ type }); }} />)}
              </Drop>
              <Btn big icon="swap" title="class.chart.switch" onClick={() => changeChart({ byColumn: !(chart.byColumn ?? (chart.range.r2 - chart.range.r1 >= chart.range.c2 - chart.range.c1)) })} />
            </Group>
            <Group label="class.group.chartLayout">
              <label className="chart-title-box">
                <span>{t('class.chart.titleLabel')}</span>
                <input key={chart.id} defaultValue={chart.title ?? ''} placeholder={t('class.chart.titlePlaceholder')}
                  onBlur={e => { if ((chart.title ?? '') !== e.target.value) changeChart({ title: e.target.value || undefined }); }}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
              </label>
              <Btn big icon="legend" title="class.chart.legend" active={chart.legend ?? true} onClick={() => changeChart({ legend: !(chart.legend ?? true) })} />
              <Btn big icon="labels" title="class.chart.labels" active={!!chart.labels} onClick={() => changeChart({ labels: !chart.labels })} />
              <Drop big icon="palette" title="class.chart.colors">
                {close => PALETTES.map((p, i) => (
                  <button key={i} type="button" className={`menu-item palette-row${(chart.palette ?? 0) === i ? ' on' : ''}`} onClick={() => { close(); changeChart({ palette: i || undefined }); }}>
                    {p.slice(0, 6).map(c => <i key={c} style={{ background: c }} />)}
                  </button>
                ))}
              </Drop>
            </Group>
            <Group label="class.group.chartShare">
              <Drop big icon="send" title="class.chart.toLetter">{sendLetterMenu(id => void chartToLetter(id))}</Drop>
              <Btn big icon="stage" title="class.chart.toStage" onClick={() => void chartToStage()} />
              <Btn big icon="image" title="class.chart.savePng" onClick={() => void saveChartPng()} />
              <Btn big icon="trash" title="class.chart.delete" onClick={deleteChart} />
            </Group>
          </>}
          {shownTab === 'convert' && <ConvertPanel shell={shell} source={convertSource} />}
          {shownTab === 'oi1' && <>
            <Group label="class.group.toLetter" accent={appColor('letter')}>
              <Drop big icon="send" title="class.sendToLetter">
                {sendLetterMenu(id => void sendToLetter(id), <span className="kicker">{t('class.sendRangeHint', { range: single ? t('class.wholeTable') : nameBox })}</span>)}
              </Drop>
              <Btn big icon="sync" title="class.updateLetter" onClick={() => void updateLetter()} disabled={!linkedLetterOpen} />
            </Group>
            <Group label="class.group.toStage" accent={appColor('stage')}>
              <Btn big icon="stage" title="class.sendToStage" onClick={sendToStage} />
            </Group>
            <Group label="letter.group.apps">
              <AppKeys apps={shell.apps()} self="class" onOpen={id => shell.openModule(id)} />
            </Group>
            <Group label="class.group.share">
              <Btn big icon="share" title="class.share" onClick={() => void share()} />
              <Btn big icon="print" title="letter.print" onClick={() => void print()} />
            </Group>
          </>}
        </div>
      </div>

      {link && (
        <div className="link-banner">
          <Icon name="link" />
          <span className="grow">{t('class.linkedTo', { title: link.title })}</span>
          {liveState && <span className={`live-badge live-${liveState}`} role="status">{t(`live.${liveState}`)}</span>}
          {linkedLetterOpen && <button type="button" className="primary" onClick={() => void updateLetter()}>{t('class.updateLetter')}</button>}
          {linkedLetterOpen && <button type="button" onClick={() => shell.showTab(link.tabId)}>{t('class.showLetter')}</button>}
          <button type="button" onClick={() => setLink(null)}>{t('class.unlink')}</button>
        </div>
      )}

      <div className="formula-bar">
        <input className="name-box" aria-label={t('class.nameBox')} key={nameBox} defaultValue={nameBox}
          onKeyDown={e => {
            if (e.key !== 'Enter') return;
            const [a, b] = e.currentTarget.value.split(':').map(parseCell);
            if (a) { setSel({ a, f: b ?? a }); gridRef.current?.focus(); }
          }} />
        <span className="fx"><Icon name="fx" /></span>
        <input className="bar-input" aria-label={t('class.formulaBar')} value={barText.replace(/\n/g, ' ⏎ ')}
          ref={edit?.where === 'bar' ? x => { editorRef.current = x; } : undefined}
          onFocus={() => { if (!edit) startEdit(null, 'edit', 'bar'); }}
          onChange={e => { const text = e.target.value.replace(/ ⏎ /g, '\n'); setEdit(ed => ({ text, mode: 'edit', where: ed?.where ?? 'bar' })); }}
          onKeyDown={onEditorKey} />
      </div>

      <div className="class-body">
      <div className={`grid${headings ? '' : ' no-heads'}`} ref={gridRef} tabIndex={0} onKeyDown={onGridKey} style={cellVars}
        onCopy={e => onCopy(e)} onCut={e => onCopy(e, true)} onPaste={onPaste}>
        <div className="corner" onMouseDown={() => setSel({ a: { c: 0, r: 0 }, f: { c: Math.max(used.cols, 0), r: Math.max(used.rows, 0) } })} />
        <div className="col-heads">
          <div ref={colHeadsRef} style={{ width: lefts[cols] }}>{visibleCols.map(colHead)}</div>
          {fc > 0 && <div className="frozen-heads" style={{ width: FW }}>{Array.from({ length: fc }, (_, c) => colHead(c))}</div>}
        </div>
        <div className="row-heads">
          <div ref={rowHeadsRef} style={{ height: tops[rows] }}>{visibleRows.map(rowHead)}</div>
          {fr > 0 && <div className="frozen-heads" style={{ height: FH }}>{Array.from({ length: fr }, (_, r) => r).filter(r => height(r)).map(rowHead)}</div>}
        </div>
        <div className="cells-area">
          <div className="cells-scroll" ref={scrollRef} onMouseDown={onGridDown}
            onScroll={e => { const el = e.currentTarget; placeScrolled(el.scrollTop, el.scrollLeft); setView(v => ({ ...v, top: el.scrollTop, left: el.scrollLeft })); }}
            onDoubleClick={e => { const p = cellAt(e); const m = mergeAt(p.c, p.r); go(m?.c1 ?? p.c, m?.r1 ?? p.r); startEdit(null, 'edit'); }}>
            <div className="cells" style={{ width: lefts[cols] + 40, height: tops[rows] + 40 }}>
              {mainCells}
              {editorAt && !editorAt.top && !editorAt.left && editorAt.el}
            </div>
          </div>
          <FastScroll target={scrollRef} />
          {fr > 0 && (
            <div className="pane pane-top" style={{ height: FH, width: view.w }}>
              <div ref={topPaneRef} className="pane-inner">{topCells}{editorAt?.top && !editorAt.left && editorAt.el}</div>
            </div>
          )}
          {fc > 0 && (
            <div className="pane pane-left" style={{ width: FW, height: view.h }}>
              <div ref={leftPaneRef} className="pane-inner">{leftCells}{editorAt?.left && !editorAt.top && editorAt.el}</div>
            </div>
          )}
          {fr > 0 && fc > 0 && (
            <div className="pane pane-corner" style={{ width: FW, height: FH }}>
              <div className="pane-inner">{cornerCells}{editorAt?.top && editorAt.left && editorAt.el}</div>
            </div>
          )}
        </div>
        {find && (
          <FindPanel initialReplace={find.replace} status={findStatus} onFind={findNext} onReplace={replaceOne} onReplaceAll={replaceAll}
            onClose={() => { setFind(null); setFindStatus(''); gridRef.current?.focus(); }} />
        )}
      </div>
      {copilot && <Copilot host={classCopilot(bridge, decimalComma(lang))} ai={shell.ai} onClose={() => { setCopilot(false); gridRef.current?.focus(); }} />}
      </div>

      <div className="sheet-tabs">
        {book.sheets.map((s, i) => renaming?.i === i ? (
          <input key={i} className={`sheet-tab sheet-rename${renaming.error ? ' bad' : ''}`} defaultValue={s.name} maxLength={31} autoFocus
            aria-label={t('class.renameSheet')} title={renaming.error ? t('class.sheetNameTaken') : t('class.renameSheet')}
            size={Math.max(6, s.name.length + 2)} onFocus={e => e.currentTarget.select()}
            onKeyDown={e => {
              if (e.key === 'Escape') { setRenaming(null); gridRef.current?.focus(); }
              if (e.key === 'Enter') e.currentTarget.blur();
              e.stopPropagation();
            }}
            onBlur={e => {
              const typed = e.currentTarget.value, el = e.currentTarget;
              void applyName(i, typed).then(ok => { if (ok) setRenaming(null); else { setRenaming({ i, error: true }); el.focus(); } });
            }} />
        ) : (
          <button key={i} type="button" className={`sheet-tab${i === active ? ' on' : ''}`} style={s.tabColor ? { boxShadow: `inset 0 -3px 0 ${s.tabColor}` } : undefined}
            onClick={() => pickSheet(i)}
            onDoubleClick={() => renameSheet(i)} onContextMenu={e => { e.preventDefault(); openTabMenu(i, e.clientX, e.clientY); }}
            onPointerDown={e => { if (e.pointerType !== 'mouse') { const { clientX: x, clientY: y } = e; pressTimer.current = window.setTimeout(() => openTabMenu(i, x, y), 500); } }}
            onPointerUp={() => window.clearTimeout(pressTimer.current)} onPointerLeave={() => window.clearTimeout(pressTimer.current)}
            title={t('class.sheetTabHint')}>
            {s.name}
          </button>
        ))}
        <button type="button" className="sheet-add" title={t('class.addSheet')} aria-label={t('class.addSheet')} onClick={addSheet}>+</button>
      </div>
      {tabMenu && <SheetTabMenu at={tabMenu} count={book.sheets.length} color={book.sheets[tabMenu.i]?.tabColor}
        onClose={() => setTabMenu(null)}
        onRename={() => renameSheet(tabMenu.i)}
        onDuplicate={() => { setTabMenu(null); duplicateSheet(tabMenu.i); }}
        onMove={dir => { setTabMenu(null); moveSheet(tabMenu.i, dir); }}
        onColor={c => { setTabMenu(null); setSheetColor(tabMenu.i, c); }}
        onDelete={() => { if (!tabMenu.sure) setTabMenu({ ...tabMenu, sure: true }); else { setTabMenu(null); deleteSheet(tabMenu.i); } }} />}
      <footer className="status">
        <span className="status-file">{painter ? t('class.painterHint') : fileName || `${title}.xlsx`}</span>
        {hiddenRows.size > 0 && <span>{t('class.filter.status', { n: (sheet.filter!.range.r2 - sheet.filter!.range.r1) - hiddenRows.size, total: sheet.filter!.range.r2 - sheet.filter!.range.r1 })}</span>}
        {stats && stats.count > 1 && <>
          <span>{t('class.stat.average')}: <b className="gold">{fmt(stats.sum / stats.count)}</b></span>
          <span>{t('class.stat.count')}: <b className="gold">{stats.filled}</b></span>
          <span>{t('class.stat.sum')}: <b className="gold">{fmt(stats.sum)}</b></span>
        </>}
        <span className="status-zoom">
          <button type="button" aria-label={t('letter.zoomOut')} title={t('letter.zoomOut')} onClick={() => stepZoom(-1)} disabled={zoom <= ZOOMS[0]}>−</button>
          <input type="range" min={25} max={400} step={5} value={Math.round(zoom * 100)} aria-label={t('letter.zoom')}
            onChange={e => setZoom(Number(e.target.value) / 100)} onDoubleClick={() => setZoom(1)} />
          <button type="button" aria-label={t('letter.zoomIn')} title={t('letter.zoomIn')} onClick={() => stepZoom(1)} disabled={zoom >= ZOOMS[ZOOMS.length - 1]}>+</button>
          <span className="pct">{Math.round(zoom * 100)}%</span>
          <button type="button" className="fit" aria-label={t('ui.fitAll')} title={t('ui.fitAll')} onClick={fitSheet}><Icon name="onepage" size={13} /></button>
        </span>
      </footer>

      {filterMenu && sheet.filter && (
        <FilterMenu key={filterMenu.c} at={filterMenu} values={filterValues(filterMenu.c)} hidden={sheet.filter.hidden[filterMenu.c] ?? []}
          onSort={dir => { setFilterMenu(null); sortRows(sheet.filter!.range, filterMenu.c, dir, true); }}
          onApply={off => changeSheet(s => { if (!s.filter) return; const hidden = { ...s.filter.hidden }; if (off.length) hidden[filterMenu.c] = off; else delete hidden[filterMenu.c]; s.filter = { ...s.filter, hidden }; })}
          onClose={() => setFilterMenu(null)} />
      )}
      {proDialog === 'gallery' && <ProGallery lang={proLang} start={proCat} onPick={addProSheet} onClose={() => setProDialog(null)} />}
      {proDialog === 'converter' && <Converter lang={proLang} start={typeof values.get(key(sel.a.c, sel.a.r)) === 'number' ? values.get(key(sel.a.c, sel.a.r)) as number : undefined}
        hasSelection={[...Array(range.r2 - range.r1 + 1)].some((_, i) => typeof values.get(key(range.c2, range.r1 + i)) === 'number')}
        onFormula={putFormula} onConvertSelection={convertSelection} onClose={() => setProDialog(null)} />}
      {fnDialog && <InsertFunction start={fnDialog} onClose={() => setFnDialog(null)} onPick={fn => startEdit(`=${fn}(`, 'edit')} />}
      {whatIf === 'seek' && <GoalSeekDialog book={book} sheet={active} at={cellName(sel.a.c, sel.a.r)} onClose={() => setWhatIf(null)} onKeep={(k, v) => writeValues([[k, v]])} />}
      {whatIf === 'scen' && <ScenarioDialog book={book} sheet={active} selection={nameBox} onClose={() => setWhatIf(null)}
        onSave={list => changeSheet(s => { if (list.length) s.scenarios = list; else delete s.scenarios; })}
        onShow={sc => writeValues(sc.cells.map((k, i) => [k, sc.values[i]] as [string, string]))}
        onSummary={sum => { const b = bookRef.current; let nm = t('class.scen.summary'); for (let i = 2; b.sheets.some(x => x.name.toLowerCase() === nm.toLowerCase()); i++) nm = `${t('class.scen.summary')} ${i}`; commit({ ...b, sheets: [...b.sheets, { ...sum, name: nm }] }); pickSheet(b.sheets.length); }} />}
      {whatIf === 'solver' && <SolverDialog book={book} sheet={active} at={cellName(sel.a.c, sel.a.r)} onClose={() => setWhatIf(null)}
        onRemember={m => { const b = bookRef.current; setBook({ ...b, sheets: b.sheets.map((x, i) => (i === active ? { ...x, solver: m } : x)) }); }}
        onKeep={(entries, m) => writeValues(entries, s => { s.solver = m; })} />}
      {whatIf === 'val' && <ValidationDialog range={range} existing={validationAt(sheet.validations, sel.a.c, sel.a.r)} onClose={() => setWhatIf(null)}
        onSave={rule => { changeSheet(s => { const list = setRule(s.validations, range, rule); if (list.length) s.validations = list; else delete s.validations; }); setCircles(null); }} />}
      {vAlert && <ValidationAlert rule={vAlert.rule}
        onCancel={() => { setVAlert(null); gridRef.current?.focus(); }}
        onRetry={() => { const a = vAlert; setVAlert(null); go(a.c, a.r); setEdit({ text: a.text, mode: 'edit', where: 'cell' }); }}
        onKeep={() => { const a = vAlert; setVAlert(null); changeSheet(s => setEntry(s.cells, a.c, a.r, a.text)); if (a.move) go(a.move.c, a.move.r); gridRef.current?.focus(); }} />}
      {listMenu && (
        <div className="val-list" role="listbox" aria-label={t('class.val.choose')} style={{ left: listMenu.left, top: listMenu.top }}>
          {listMenu.choices.map(ch => (
            <button key={ch} type="button" role="option" aria-selected={display(values.get(key(listMenu.c, listMenu.r)) ?? '', undefined, lang, currency) === ch}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { const m = listMenu; setListMenu(null); changeSheet(s => setEntry(s.cells, m.c, m.r, ch)); gridRef.current?.focus(); }}>{ch}</button>
          ))}
        </div>
      )}
      {condDialog && <CondDialog kind={condDialog} range={single ? currentRegion(sel.a) : range} onClose={() => setCondDialog(null)} onOk={rule => addRule(rule)} />}

      {printing && (
        <PrintPanel input={printInput(printing.charts)} what={{ scope: printing.scope, sel: range, at: sel.a }}
          onSetup={p => changePrint(p)}
          onSave={async (name, blob) => { await shell.saveFile(name, blob, 'application/pdf', { saveAs: true }); }}
          onClose={() => { setPrinting(null); gridRef.current?.focus(); }} />
      )}
      {panel === 'file' && (
        <FileMenu fileName={fileName || `${title}.xlsx`} onClose={() => setPanel(null)}
          onNew={() => shell.openModule('class')} onOpen={() => void openFile()} onSave={() => void save()}
          onPrint={() => { setPanel(null); void print(); }}
          saveChoices={[
            { id: 'xlsx', icon: 'sheet', label: t('class.format.xlsx'), hint: '.xlsx' },
            { id: 'csv', icon: 'left', label: t('class.format.csv'), hint: '.csv' },
          ]}
          onSaveAs={f => (f === 'xlsx' ? void save(true) : saveCsv())}
          listRecent={shell.recent.list} onOpenRecent={r => void openRecent(r)} />
      )}
    </div>
  );

  function addRule(rule: Partial<CondRule> & { kind: CondRule['kind'] }) {
    const rg = single ? currentRegion(sel.a) : range;
    changeSheet(s => { s.rules = [...(s.rules ?? []), { range: rg, ...rule, id: newId('r') }]; });
  }
}

const TAB_SWATCHES = ['#C62828', '#EF6C00', '#F9A825', '#2E7D32', '#00838F', '#1565C0', '#6A1B9A', '#AD1457', '#5D4037', '#546E7A'];

/** The menu of a sheet tab (right-click, or a long press on a phone): rename, copy, move, color, delete. */
function SheetTabMenu({ at, count, color, onClose, onRename, onDuplicate, onMove, onColor, onDelete }: {
  at: { i: number; x: number; y: number; sure?: boolean }; count: number; color?: string;
  onClose: () => void; onRename: () => void; onDuplicate: () => void; onMove: (dir: -1 | 1) => void; onColor: (c: string | null) => void; onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: at.x, top: at.y });
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // Opens above the tab (tabs sit at the bottom) and never leaves the screen.
    setPos({ left: Math.max(8, Math.min(at.x, innerWidth - r.width - 8)), top: Math.max(8, Math.min(at.y - r.height, innerHeight - r.height - 8)) });
  }, [at.x, at.y]);
  useEffect(() => {
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const id = window.setTimeout(() => document.addEventListener('pointerdown', away, true));
    document.addEventListener('keydown', esc);
    return () => { window.clearTimeout(id); document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  return (
    <div ref={ref} className="sheet-menu" role="menu" style={pos}>
      <button type="button" role="menuitem" onClick={onRename}><Icon name="rename" size={16} />{t('class.renameSheet')}</button>
      <button type="button" role="menuitem" onClick={onDuplicate}><Icon name="copy" size={16} />{t('class.sheetMenu.duplicate')}</button>
      <button type="button" role="menuitem" onClick={() => onMove(-1)} disabled={at.i === 0}><Icon name="prev" size={16} />{t('class.sheetMenu.moveLeft')}</button>
      <button type="button" role="menuitem" onClick={() => onMove(1)} disabled={at.i >= count - 1}><Icon name="next" size={16} />{t('class.sheetMenu.moveRight')}</button>
      <div className="sheet-menu-colors" role="group" aria-label={t('class.tabColor')}>
        {TAB_SWATCHES.map(c => <button key={c} type="button" className={c === color ? 'on' : ''} style={{ background: c }} title={c} aria-label={c} onClick={() => onColor(c)} />)}
        <button type="button" className="none" title={t('letter.noColor')} aria-label={t('letter.noColor')} onClick={() => onColor(null)}>✕</button>
      </div>
      <button type="button" role="menuitem" className={`danger${at.sure ? ' sure' : ''}`} onClick={onDelete} disabled={count < 2}>
        <Icon name="trash" size={16} />{at.sure ? t('class.sheetMenu.deleteSure') : t('class.sheetMenu.delete')}
      </button>
    </div>
  );
}
