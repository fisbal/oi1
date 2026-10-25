// Office Class: the spreadsheet. A grid of cells with formulas, number formats and several sheets,
// saved as Excel .xlsx or .csv, and linked to the other OI1 apps (tables go to and from Office Letter).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { FileRef, Handoff, HandoffLink, OpenedFile, RecentFile, ShellApi, TableData } from '../../shell/contract';
import { t, type MessageKey } from '../../shell/i18n';
import { useLanguage } from '../../shell/useLanguage';
import { parseCsv, toCsv } from '../../formats/csv';
import { FUNCTION_NAMES, cellName, colName, isError, moveRefs, parseCell } from '../../formats/formula';
import {
  computeSheet, currencyFor, display, emptySheet, key, naturalAlign, readEntry, unkey, usedRange,
  type Cell, type CellStyle, type NumberFormat, type SheetData, type WorkbookData,
} from '../../formats/sheet';
import { sheetToTable, tableFromHtml, tableFromText, tableToCells, tableToHtml, tableToText, type Range } from '../../formats/table';
import { FileMenu } from '../../ui/FileMenu';
import { Btn, ColorGrid, Drop, Group, Icon, MenuItem } from '../../ui/kit';

export const EXTENSIONS = ['.xlsx', '.csv', '.tsv'];
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ROW_H = 26;
const COL_W = 104;

interface Pos { c: number; r: number }
interface Sel { a: Pos; f: Pos }
interface Saved { book: WorkbookData; active: number; link: HandoffLink | null; name: string }

const rangeOf = (s: Sel): Range => ({ c1: Math.min(s.a.c, s.f.c), r1: Math.min(s.a.r, s.f.r), c2: Math.max(s.a.c, s.f.c), r2: Math.max(s.a.r, s.f.r) });
const newLinkId = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const decimalComma = (lang: string) => new Intl.NumberFormat(lang).format(1.5).includes(',');

function bookFromTable(table: TableData, name: string): WorkbookData {
  return { sheets: [{ name, cells: tableToCells(table), widths: {} }] };
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
  const [book, setBookState] = useState<WorkbookData>(initial.book);
  const bookRef = useRef(book);
  const [active, setActive] = useState(Math.min(initial.active, initial.book.sheets.length - 1));
  const [link, setLink] = useState<HandoffLink | null>(initial.link);
  const [fileName, setFileName] = useState(initial.name);
  const [fileRef, setFileRef] = useState<FileRef | null>(null);
  const [sel, setSel] = useState<Sel>({ a: { c: 0, r: 0 }, f: { c: 0, r: 0 } });
  const [edit, setEdit] = useState<{ text: string; mode: 'enter' | 'edit'; where: 'cell' | 'bar' } | null>(null);
  const [panel, setPanel] = useState<null | 'file'>(null);
  const [tab, setTab] = useState<'home' | 'formulas' | 'data' | 'oi1'>('home');
  const undo = useRef<WorkbookData[]>([]);
  const redo = useRef<WorkbookData[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement>(null);

  const sheet = book.sheets[active] ?? book.sheets[0];
  const values = useMemo(() => computeSheet(sheet), [sheet]);
  const currency = currencyFor(lang, book);
  const used = useMemo(() => usedRange(sheet), [sheet]);
  const range = rangeOf(sel);

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
    const s: SheetData = { ...b.sheets[active], cells: { ...b.sheets[active].cells }, widths: { ...b.sheets[active].widths } };
    mutate(s);
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
  const commitEdit = (move?: Pos) => {
    if (!edit) return;
    const { c, r } = sel.a;
    if ((sheet.cells[key(c, r)]?.input ?? '') !== edit.text) changeSheet(s => setEntry(s.cells, c, r, edit.text));
    setEdit(null);
    if (move) go(move.c, move.r);
    gridRef.current?.focus();
  };
  const startEdit = (text: string | null, mode: 'enter' | 'edit', where: 'cell' | 'bar' = 'cell') => {
    const cell = sheet.cells[key(sel.a.c, sel.a.r)];
    setSel(s => ({ a: s.a, f: s.a }));
    setEdit({ text: text ?? cell?.input ?? '', mode, where });
  };
  // Like Excel: after typing across a row with Tab, Enter goes back to the column the row started in.
  const tabStart = useRef<number | null>(null);
  const go = (c: number, r: number, extend = false) => {
    tabStart.current = null;
    const p = { c: Math.max(0, c), r: Math.max(0, r) };
    setSel(s => (extend ? { a: s.a, f: p } : { a: p, f: p }));
  };
  const forRange = (fn: (c: number, r: number) => void) => {
    for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) fn(c, r);
  };
  const styleRange = (patch: (st: CellStyle) => CellStyle) => changeSheet(s => forRange((c, r) => {
    const k = key(c, r);
    const cell = s.cells[k] ?? { input: '' };
    const style = Object.fromEntries(Object.entries(patch({ ...cell.style })).filter(([, v]) => v !== undefined && v !== false)) as CellStyle;
    if (!cell.input && !Object.keys(style).length) delete s.cells[k];
    else s.cells[k] = { input: cell.input, ...(Object.keys(style).length ? { style } : {}) };
  }));
  const activeStyle = sheet.cells[key(sel.a.c, sel.a.r)]?.style ?? {};
  const toggle = (prop: 'bold' | 'italic' | 'underline') => styleRange(st => ({ ...st, [prop]: !activeStyle[prop] }));
  const setFormat = (format: NumberFormat) => styleRange(st => ({ ...st, format: format === 'general' ? undefined : format }));
  const clearRange = () => changeSheet(s => forRange((c, r) => {
    const k = key(c, r);
    if (s.cells[k]?.style) s.cells[k] = { input: '', style: s.cells[k].style };
    else delete s.cells[k];
  }));

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
      if (cell.input.startsWith('=')) moved[k] = { ...cell, input: moveRefs(cell.input, (c, r) => (axis === 'r' ? { c, r: ref(r) } : { c: ref(c), r })) };
    }
    s.cells = moved;
    if (axis === 'c') {
      const w: Record<number, number> = {};
      for (const [c, px] of Object.entries(s.widths)) { const n = place(Number(c)); if (n !== null) w[n] = px; }
      s.widths = w;
    }
  });

  // ---------- smart tools ----------
  const autoSum = (fn = 'SUM') => {
    const num = (c: number, r: number) => typeof values.get(key(c, r)) === 'number';
    if (range.r1 !== range.r2 || range.c1 !== range.c2) {
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
  const sort = (dir: 1 | -1) => {
    // One cell selected: sort the whole table around it, keeping a bold title row in place.
    let rg = range;
    if (rg.r1 === rg.r2 && rg.c1 === rg.c2 && used.rows >= 0) rg = { c1: 0, r1: 0, c2: used.cols, r2: used.rows };
    const headerRow = Array.from({ length: rg.c2 - rg.c1 + 1 }, (_, i) => sheet.cells[key(rg.c1 + i, rg.r1)]).some(cell => cell?.style?.bold);
    const r1 = headerRow && rg.r2 > rg.r1 ? rg.r1 + 1 : rg.r1;
    const byCol = Math.min(Math.max(sel.a.c, rg.c1), rg.c2);
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
          if (cell) s.cells[key(c, r1 + i)] = cell; else delete s.cells[key(c, r1 + i)];
        }
      });
    });
  };

  // ---------- clipboard ----------
  const clip = useRef<{ text: string; cells: Record<string, Cell>; origin: Pos } | null>(null);
  const tableOf = (rg: Range) => sheetToTable(sheet, rg, values, lang, currency);
  const onCopy = (e: React.ClipboardEvent, cut = false) => {
    if (edit) return;
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
    if (edit) return;
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
    const ref = await shell.saveFile(name, () => writeXlsx({ ...bookRef.current, currency }), XLSX_TYPE, { target: fileRef, saveAs });
    if (!ref) return;
    setFileRef(ref);
    setFileName(ref.name);
  };
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

  // ---------- links with the other apps ----------
  const sendRange = (): { table: TableData; rg: Range } => {
    let rg = range;
    if (rg.c1 === rg.c2 && rg.r1 === rg.r2 && used.rows >= 0) rg = { c1: 0, r1: 0, c2: used.cols, r2: used.rows };
    return { table: tableOf(rg), rg };
  };
  const sendToLetter = async (letterTab: string | null) => {
    const { table } = sendRange();
    const id = link?.moduleId === 'letter' && letterTab === link.tabId ? link.id : newLinkId();
    const mine: HandoffLink = { tabId: shell.tabId, id, moduleId: 'class', title };
    if (letterTab) {
      const ok = await shell.send(letterTab, { kind: 'table', title, table, link: mine });
      if (!ok) { shell.notify(t('class.letterGone')); return; }
      const target = shell.tabs('letter').find(x => x.tabId === letterTab);
      setLink({ tabId: letterTab, id, moduleId: 'letter', title: target?.title ?? 'Office Letter' });
      shell.notify(t('class.sentToLetter', { title: target?.title ?? 'Office Letter' }));
      shell.showTab(letterTab);
    } else {
      const tabId = shell.openModule('letter', undefined, { kind: 'table', title, table, link: mine });
      if (tabId) setLink({ tabId, id, moduleId: 'letter', title: 'Office Letter' });
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
    const blob = await writeXlsx({ ...bookRef.current, currency });
    const f = new File([blob], `${baseName()}.xlsx`, { type: XLSX_TYPE });
    if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title }).catch(() => {});
    else void save(true);
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
    if (h.link) setLink(h.link);
    return true;
  }));
  // A letter asks for a table: give the selection (or the whole table) and link it to that letter.
  useEffect(() => shell.onAsk((_want, from) => {
    const { table } = sendRange();
    const id = newLinkId();
    const target = shell.tabs('letter').find(x => x.tabId === from);
    setLink({ tabId: from, id, moduleId: 'letter', title: target?.title ?? 'Office Letter' });
    return { kind: 'table', title, table, link: { tabId: shell.tabId, id, moduleId: 'class', title } };
  }));
  useEffect(() => { if (handoff?.kind === 'file') void loadBook(handoff.file); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ---------- grid geometry ----------
  const rows = Math.max(used.rows + 60, 200, sel.f.r + 30);
  const cols = Math.max(used.cols + 8, 26, sel.f.c + 6);
  const width = (c: number) => sheet.widths[c] ?? COL_W;
  const lefts = useMemo(() => {
    const out = [0];
    for (let c = 0; c < cols; c++) out.push(out[c] + (sheet.widths[c] ?? COL_W));
    return out;
  }, [cols, sheet.widths]);
  const colAt = (x: number) => { let lo = 0, hi = cols - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lefts[mid] <= x) lo = mid; else hi = mid - 1; } return lo; };
  const [view, setView] = useState({ top: 0, left: 0, w: 1200, h: 700 });
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setView(v => ({ ...v, w: el.clientWidth, h: el.clientHeight })));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const r0 = Math.max(0, Math.floor(view.top / ROW_H) - 2);
  const r9 = Math.min(rows - 1, Math.ceil((view.top + view.h) / ROW_H) + 2);
  const c0 = Math.max(0, colAt(view.left) - 1);
  const c9 = Math.min(cols - 1, colAt(view.left + view.w) + 1);

  // Keep the active cell in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { c, r } = sel.f;
    const y = r * ROW_H, x = lefts[c] ?? 0;
    if (y < el.scrollTop) el.scrollTop = y;
    else if (y + ROW_H > el.scrollTop + el.clientHeight) el.scrollTop = y + ROW_H - el.clientHeight;
    if (x < el.scrollLeft) el.scrollLeft = x;
    else if (x + width(c) > el.scrollLeft + el.clientWidth) el.scrollLeft = x + width(c) - el.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.f.c, sel.f.r]);

  // ---------- pointer ----------
  const pointing = useRef<{ start: number; anchor: Pos } | null>(null);
  const cellAt = (e: { clientX: number; clientY: number }): Pos => {
    const box = scrollRef.current!.getBoundingClientRect();
    const x = e.clientX - box.left + scrollRef.current!.scrollLeft;
    const y = e.clientY - box.top + scrollRef.current!.scrollTop;
    return { c: colAt(Math.max(0, x)), r: Math.max(0, Math.floor(y / ROW_H)) };
  };
  const canPoint = (text: string) => text.startsWith('=') && /[=+\-*/^(,;:&<>]\s*$/.test(text);
  const onGridDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const p = cellAt(e);
    if (edit && (canPoint(edit.text) || pointing.current)) {
      // Building a formula: a click adds that cell, a drag adds a range.
      e.preventDefault();
      const start = pointing.current?.start ?? edit.text.length;
      pointing.current = { start, anchor: p };
      setEdit(ed => ed && { ...ed, text: ed.text.slice(0, start) + cellName(p.c, p.r) });
      const move = (ev: MouseEvent) => {
        const q = cellAt(ev);
        const a = pointing.current!.anchor;
        const ref = a.c === q.c && a.r === q.r ? cellName(a.c, a.r) : `${cellName(Math.min(a.c, q.c), Math.min(a.r, q.r))}:${cellName(Math.max(a.c, q.c), Math.max(a.r, q.r))}`;
        setEdit(ed => ed && { ...ed, text: ed.text.slice(0, start) + ref });
      };
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); editorRef.current?.focus(); };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      return;
    }
    if (edit) commitEdit();
    pointing.current = null;
    go(p.c, p.r, e.shiftKey);
    gridRef.current?.focus();
    const move = (ev: MouseEvent) => { const q = cellAt(ev); setSel(s => (s.f.c === q.c && s.f.r === q.r ? s : { a: s.a, f: q })); };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const selectWhole = (axis: 'c' | 'r', i: number, extend: boolean) => {
    if (edit) commitEdit();
    const end = axis === 'c' ? { c: i, r: Math.max(used.rows, 0) } : { c: Math.max(used.cols, 0), r: i };
    const start = axis === 'c' ? { c: i, r: 0 } : { c: 0, r: i };
    setSel(s => (extend ? { a: s.a, f: end } : { a: start, f: end }));
    gridRef.current?.focus();
  };
  const resizeCol = (c: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = width(c);
    let last = w0;
    const move = (ev: MouseEvent) => {
      last = Math.max(28, Math.round(w0 + ev.clientX - x0));
      const b = bookRef.current;
      setBook({ ...b, sheets: b.sheets.map((s, i) => (i === active ? { ...s, widths: { ...s.widths, [c]: last } } : s)) });
    };
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      if (last !== w0) { undo.current.push({ ...bookRef.current, sheets: bookRef.current.sheets.map((s, i) => (i === active ? { ...s, widths: { ...s.widths, [c]: w0 } } : s)) }); }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // ---------- keyboard ----------
  const onGridKey = (e: React.KeyboardEvent) => {
    if (edit) return;
    const mod = e.ctrlKey || e.metaKey;
    const { c, r } = sel.f;
    const k = e.key;
    const jump = (dc: number, dr: number) => {
      if (!mod) return { c: c + dc, r: r + dr };
      // Ctrl+arrow: to the edge of the data, like Excel.
      let nc = c, nr = r;
      const filled = (x: number, y: number) => !!sheet.cells[key(x, y)]?.input;
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
    if (arrows[k]) { e.preventDefault(); const p = jump(...arrows[k]); go(p.c, p.r, e.shiftKey); return; }
    if (k === 'Enter' || k === 'Tab') {
      e.preventDefault();
      const back = e.shiftKey ? -1 : 1;
      const a = sel.a;
      const start = tabStart.current ?? a.c;
      go(k === 'Tab' ? a.c + back : start, k === 'Enter' ? a.r + back : a.r);
      if (k === 'Tab') tabStart.current = start;
      return;
    }
    if (k === 'Home') { e.preventDefault(); go(0, mod ? 0 : r, e.shiftKey); return; }
    if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); go(c, r + (k === 'PageDown' ? 1 : -1) * Math.floor(view.h / ROW_H), e.shiftKey); return; }
    if (k === 'F2') { e.preventDefault(); startEdit(null, 'edit'); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); clearRange(); return; }
    if (k === 'Escape') { setSel(s => ({ a: s.a, f: s.a })); return; }
    if (mod) {
      const lk = k.toLowerCase();
      const run = (fn: () => void) => { e.preventDefault(); fn(); };
      if (lk === 'z') run(e.shiftKey ? redoOnce : undoOnce);
      else if (lk === 'y') run(redoOnce);
      else if (lk === 'b') run(() => toggle('bold'));
      else if (lk === 'i') run(() => toggle('italic'));
      else if (lk === 'u') run(() => toggle('underline'));
      else if (lk === 'a') run(() => setSel({ a: { c: 0, r: 0 }, f: { c: Math.max(used.cols, 0), r: Math.max(used.rows, 0) } }));
      else if (lk === 's') run(() => void save(e.shiftKey));
      else if (lk === 'o') run(() => void openFile());
      return;
    }
    if (k.length === 1 && !e.altKey) { e.preventDefault(); startEdit(k, 'enter'); }
  };
  const onEditorKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!edit) return;
    const { c, r } = sel.a;
    const start = tabStart.current ?? c;
    if (e.key === 'Enter') { e.preventDefault(); commitEdit({ c: start, r: r + (e.shiftKey ? -1 : 1) }); }
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit({ c: c + (e.shiftKey ? -1 : 1), r }); tabStart.current = start; }
    else if (e.key === 'Escape') { e.preventDefault(); setEdit(null); pointing.current = null; gridRef.current?.focus(); }
    else if (edit.mode === 'enter' && e.key.startsWith('Arrow') && !(edit.text.startsWith('=') && canPoint(edit.text))) {
      e.preventDefault();
      const d: Record<string, Pos> = { ArrowUp: { c, r: r - 1 }, ArrowDown: { c, r: r + 1 }, ArrowLeft: { c: c - 1, r }, ArrowRight: { c: c + 1, r } };
      commitEdit(d[e.key]);
    } else if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) pointing.current = null;
  };
  useEffect(() => { if (edit) { const el = editorRef.current; el?.focus(); if (el && edit.mode === 'enter') el.setSelectionRange(el.value.length, el.value.length); } }, [edit?.where, edit?.mode, !!edit]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- sheets ----------
  const addSheet = () => {
    const b = bookRef.current;
    let n = b.sheets.length + 1;
    while (b.sheets.some(s => s.name === t('class.sheet', { n }))) n++;
    commit({ ...b, sheets: [...b.sheets, emptySheet(t('class.sheet', { n }))] });
    setActive(b.sheets.length);
    setSel({ a: { c: 0, r: 0 }, f: { c: 0, r: 0 } });
  };
  const renameSheet = (i: number) => {
    const name = prompt(t('class.renameSheet'), book.sheets[i].name)?.trim().slice(0, 31);
    if (!name) return;
    const b = bookRef.current;
    commit({ ...b, sheets: b.sheets.map((s, j) => (j === i ? { ...s, name } : s)) });
  };
  const deleteSheet = (i: number) => {
    if (book.sheets.length < 2 || !confirm(t('class.deleteSheetConfirm', { name: book.sheets[i].name }))) return;
    const b = bookRef.current;
    commit({ ...b, sheets: b.sheets.filter((_, j) => j !== i) });
    setActive(a => Math.max(0, a >= i ? a - 1 : a));
  };

  // ---------- status: sum, average and count of the selection, like Excel ----------
  const stats = useMemo(() => {
    let sum = 0, count = 0, filled = 0;
    if ((range.c2 - range.c1 + 1) * (range.r2 - range.r1 + 1) > 200000) return null;
    for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) {
      const v = values.get(key(c, r));
      if (v === undefined || v === '') continue;
      filled++;
      if (typeof v === 'number') { sum += v; count++; }
    }
    return { sum, count, filled };
  }, [values, range.c1, range.r1, range.c2, range.r2]);
  const fmt = (n: number) => display(n, activeStyle.format === 'currency' || activeStyle.format === 'percent' ? activeStyle : { format: 'general' }, lang, currency);

  const activeCell = sheet.cells[key(sel.a.c, sel.a.r)];
  const barText = edit ? edit.text : activeCell?.input ?? '';
  const nameBox = range.c1 === range.c2 && range.r1 === range.r2 ? cellName(sel.a.c, sel.a.r) : `${cellName(range.c1, range.r1)}:${cellName(range.c2, range.r2)}`;
  const letters = shell.tabs('letter');
  const linkedLetterOpen = !!link && link.moduleId === 'letter' && letters.some(x => x.tabId === link.tabId);

  // ---------- drawing ----------
  const cellsOut: JSX.Element[] = [];
  for (let r = r0; r <= r9; r++) {
    for (let c = c0; c <= c9; c++) {
      const k = key(c, r);
      const cell = sheet.cells[k];
      if (!cell) continue;
      const v = values.get(k) ?? '';
      const st = cell.style;
      const text = display(v, st, lang, currency);
      if (!text && !st?.fill) continue;
      const style: CSSProperties = {
        top: r * ROW_H, left: lefts[c], width: width(c), height: ROW_H,
        textAlign: st?.align ?? naturalAlign(v),
        fontWeight: st?.bold ? 700 : undefined, fontStyle: st?.italic ? 'italic' : undefined,
        textDecoration: st?.underline ? 'underline' : undefined, color: st?.color, background: st?.fill,
      };
      cellsOut.push(<div key={k} className={`cell${isError(v) ? ' err' : ''}`} style={style} title={isError(v) ? cell.input : undefined}>{text}</div>);
    }
  }
  const selBox: CSSProperties = {
    top: range.r1 * ROW_H, left: lefts[range.c1], width: lefts[range.c2 + 1] - lefts[range.c1], height: (range.r2 - range.r1 + 1) * ROW_H,
  };
  const activeBox: CSSProperties = { top: sel.a.r * ROW_H, left: lefts[sel.a.c], width: width(sel.a.c), height: ROW_H };
  const editing = edit?.where === 'cell';

  const tabs: { id: typeof tab; label: MessageKey }[] = [
    { id: 'home', label: 'letter.tab.home' }, { id: 'formulas', label: 'class.tab.formulas' }, { id: 'data', label: 'class.tab.data' },
  ];

  return (
    <div className="class">
      <div className="ribbon">
        <div className="ribbon-tabs" role="tablist">
          <button type="button" className="ribbon-file" onClick={() => setPanel('file')}>{t('letter.tab.file')}</button>
          {tabs.map(x => <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>{t(x.label)}</button>)}
          <button type="button" role="tab" aria-selected={tab === 'oi1'} className={`ribbon-special${tab === 'oi1' ? ' on' : ''}`} onClick={() => setTab('oi1')}><span className="dot" />Office In 1</button>
          <span className="ribbon-quick">
            <Btn icon="undo" title="letter.undo" onClick={undoOnce} disabled={!undo.current.length} />
            <Btn icon="redo" title="letter.redo" onClick={redoOnce} disabled={!redo.current.length} />
          </span>
        </div>
        <div className="ribbon-panel" role="tabpanel" onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}>
          {tab === 'home' && <>
            <Group label="letter.group.clipboard">
              <div className="stack">
                <Btn icon="cut" title="letter.cut" text onClick={() => { gridRef.current?.focus(); document.execCommand('cut'); }} />
                <Btn icon="copy" title="letter.copy" text onClick={() => { gridRef.current?.focus(); document.execCommand('copy'); }} />
                <Btn icon="paste" title="letter.paste" text onClick={async () => {
                  try {
                    const items = await navigator.clipboard.read?.();
                    const html = items?.find(i => i.types.includes('text/html'));
                    const table = html ? tableFromHtml(await (await html.getType('text/html')).text()) : tableFromText(await navigator.clipboard.readText());
                    if (table) pasteTable(table);
                  } catch { alert(t('letter.pasteBlocked')); }
                }} />
              </div>
            </Group>
            <Group label="letter.group.font">
              <div className="rows">
                <div className="row">
                  <Btn label="B" title="letter.bold" onClick={() => toggle('bold')} active={!!activeStyle.bold} style={{ fontWeight: 700 }} />
                  <Btn label="I" title="letter.italic" onClick={() => toggle('italic')} active={!!activeStyle.italic} style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }} />
                  <Btn label="U" title="letter.underline" onClick={() => toggle('underline')} active={!!activeStyle.underline} style={{ textDecoration: 'underline' }} />
                </div>
                <div className="row">
                  <Drop label={<span className="color-a">A<i style={{ background: activeStyle.color ?? 'currentColor' }} /></span>} title="letter.color">
                    {close => <ColorGrid none="letter.automatic" value={activeStyle.color} onPick={c => { styleRange(st => ({ ...st, color: c ?? undefined })); close(); }} />}
                  </Drop>
                  <Drop icon="fill" title="class.fill" swatch={activeStyle.fill ?? null}>
                    {close => <ColorGrid none="letter.noColor" value={activeStyle.fill} onPick={c => { styleRange(st => ({ ...st, fill: c ?? undefined })); close(); }} />}
                  </Drop>
                </div>
              </div>
            </Group>
            <Group label="class.group.alignment">
              <Btn icon="left" title="letter.alignLeft" onClick={() => styleRange(st => ({ ...st, align: st.align === 'left' ? undefined : 'left' }))} active={activeStyle.align === 'left'} />
              <Btn icon="center" title="letter.alignCenter" onClick={() => styleRange(st => ({ ...st, align: st.align === 'center' ? undefined : 'center' }))} active={activeStyle.align === 'center'} />
              <Btn icon="right" title="letter.alignRight" onClick={() => styleRange(st => ({ ...st, align: st.align === 'right' ? undefined : 'right' }))} active={activeStyle.align === 'right'} />
            </Group>
            <Group label="class.group.number">
              <div className="rows">
                <div className="row">
                  <Drop text label={<span className="fmt-label">{t(`class.format.${activeStyle.format ?? 'general'}` as MessageKey)}</span>} title="class.numberFormat">
                    {close => (['general', 'number', 'integer', 'currency', 'percent', 'date', 'text'] as NumberFormat[]).map(f => (
                      <MenuItem key={f} active={(activeStyle.format ?? 'general') === f} label={t(`class.format.${f}` as MessageKey)}
                        hint={f === 'general' || f === 'text' ? undefined : display(f === 'date' ? 46320 : f === 'percent' ? 0.125 : 1234.5, { format: f }, lang, currency)}
                        onClick={() => { setFormat(f); close(); }} />
                    ))}
                  </Drop>
                </div>
                <div className="row">
                  <Btn icon="currency" title="class.format.currency" onClick={() => setFormat('currency')} active={activeStyle.format === 'currency'} />
                  <Btn icon="percent" title="class.format.percent" onClick={() => setFormat('percent')} active={activeStyle.format === 'percent'} />
                  <Btn icon="decimal" title="class.format.number" onClick={() => setFormat('number')} active={activeStyle.format === 'number'} />
                </div>
              </div>
            </Group>
            <Group label="class.group.cells">
              <Btn big icon="insrow" title="class.insertRow" onClick={() => shift('r', range.r1, 1)} />
              <Btn big icon="inscol" title="class.insertColumn" onClick={() => shift('c', range.c1, 1)} />
              <div className="stack">
                <Btn icon="delrow" title="letter.deleteRow" text onClick={() => shift('r', range.r1, -(range.r2 - range.r1 + 1))} />
                <Btn icon="delcol" title="letter.deleteColumn" text onClick={() => shift('c', range.c1, -(range.c2 - range.c1 + 1))} />
                <Btn icon="clear" title="class.clear" text onClick={clearRange} />
              </div>
            </Group>
            <Group label="letter.group.editing">
              <Btn big icon="sum" title="class.autoSum" onClick={() => autoSum()} />
              <div className="stack">
                <Btn icon="sort" title="class.sortAZ" text onClick={() => sort(1)} />
                <Btn icon="sort" title="class.sortZA" text onClick={() => sort(-1)} />
              </div>
            </Group>
          </>}
          {tab === 'formulas' && <>
            <Group label="class.group.functions">
              <Btn big icon="sum" title="class.autoSum" onClick={() => autoSum()} />
              {(['AVERAGE', 'MIN', 'MAX', 'COUNT'] as const).map(fn => <Btn key={fn} big icon="fx" title={fn} onClick={() => autoSum(fn)} />)}
              <Drop big icon="fx" title="class.allFunctions">
                {close => <div className="fn-list">{FUNCTION_NAMES.map(fn => (
                  <MenuItem key={fn} label={fn} onClick={() => { close(); startEdit(`=${fn}(`, 'edit'); }} />
                ))}</div>}
              </Drop>
            </Group>
          </>}
          {tab === 'data' && <>
            <Group label="class.group.sort">
              <Btn big icon="sort" title="class.sortAZ" onClick={() => sort(1)} />
              <Btn big icon="sort" title="class.sortZA" onClick={() => sort(-1)} />
            </Group>
            <Group label="class.group.sheets">
              <Btn big icon="new" title="class.addSheet" onClick={addSheet} />
              <Btn big icon="saveas" title="class.renameSheet" onClick={() => renameSheet(active)} />
            </Group>
          </>}
          {tab === 'oi1' && <>
            <Group label="class.group.toLetter">
              <Drop big icon="send" title="class.sendToLetter">
                {close => <>
                  <span className="kicker">{t('class.sendRangeHint', { range: range.c1 === range.c2 && range.r1 === range.r2 ? t('class.wholeTable') : nameBox })}</span>
                  {letters.map(x => <MenuItem key={x.tabId} label={x.title} hint={link?.tabId === x.tabId ? t('class.linked') : undefined} onClick={() => { close(); void sendToLetter(x.tabId); }} />)}
                  {letters.length > 0 && <hr />}
                  <MenuItem label={t('class.newLetter')} onClick={() => { close(); void sendToLetter(null); }} />
                </>}
              </Drop>
              <Btn big icon="sync" title="class.updateLetter" onClick={() => void updateLetter()} disabled={!linkedLetterOpen} />
            </Group>
            <Group label="class.group.apps">
              {shell.apps().filter(a => a.id !== 'class').map(a => (
                <Btn key={a.id} big icon={a.id === 'letter' ? 'letter' : a.id === 'prodfos' ? 'prodfos' : 'apps'} title={a.name.replace('Office ', '')}
                  onClick={() => shell.openModule(a.id)} disabled={!a.ready} />
              ))}
            </Group>
            <Group label="class.group.share">
              <Btn big icon="share" title="class.share" onClick={() => void share()} />
            </Group>
          </>}
        </div>
      </div>

      {link && (
        <div className="link-banner">
          <Icon name="link" />
          <span className="grow">{t('class.linkedTo', { title: link.title })}</span>
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
        <input className="bar-input" aria-label={t('class.formulaBar')} value={barText}
          ref={edit?.where === 'bar' ? editorRef : undefined}
          onFocus={() => { if (!edit) startEdit(null, 'edit', 'bar'); }}
          onChange={e => setEdit(ed => ({ text: e.target.value, mode: 'edit', where: ed?.where ?? 'bar' }))}
          onKeyDown={onEditorKey} />
      </div>

      <div className="grid" ref={gridRef} tabIndex={0} onKeyDown={onGridKey}
        onCopy={e => onCopy(e)} onCut={e => onCopy(e, true)} onPaste={onPaste}>
        <div className="corner" onMouseDown={() => setSel({ a: { c: 0, r: 0 }, f: { c: Math.max(used.cols, 0), r: Math.max(used.rows, 0) } })} />
        <div className="col-heads">
          <div style={{ transform: `translateX(${-view.left}px)`, width: lefts[cols] }}>
            {Array.from({ length: c9 - c0 + 1 }, (_, i) => c0 + i).map(c => (
              <div key={c} className={`col-head${c >= range.c1 && c <= range.c2 ? ' on' : ''}`} style={{ left: lefts[c], width: width(c) }}
                onMouseDown={e => selectWhole('c', c, e.shiftKey)}>
                {colName(c)}
                <span className="col-resize" onMouseDown={e => resizeCol(c, e)} onDoubleClick={() => changeSheet(s => { delete s.widths[c]; })} />
              </div>
            ))}
          </div>
        </div>
        <div className="row-heads">
          <div style={{ transform: `translateY(${-view.top}px)`, height: rows * ROW_H }}>
            {Array.from({ length: r9 - r0 + 1 }, (_, i) => r0 + i).map(r => (
              <div key={r} className={`row-head${r >= range.r1 && r <= range.r2 ? ' on' : ''}`} style={{ top: r * ROW_H }}
                onMouseDown={e => selectWhole('r', r, e.shiftKey)}>{r + 1}</div>
            ))}
          </div>
        </div>
        <div className="cells-scroll" ref={scrollRef} onMouseDown={onGridDown}
          onScroll={e => { const el = e.currentTarget; setView(v => ({ ...v, top: el.scrollTop, left: el.scrollLeft })); }}
          onDoubleClick={e => { const p = cellAt(e); go(p.c, p.r); startEdit(null, 'edit'); }}>
          <div className="cells" style={{ width: lefts[cols], height: rows * ROW_H, '--row-h': `${ROW_H}px` } as CSSProperties}>
            <div className="gridlines" style={{ backgroundPosition: `0 0`, left: lefts[c0], width: lefts[c9 + 1] - lefts[c0] }}>
              {Array.from({ length: c9 - c0 + 1 }, (_, i) => c0 + i).map(c => <i key={c} style={{ left: lefts[c] - lefts[c0] + width(c) - 1 }} />)}
            </div>
            {cellsOut}
            <div className="sel-box" style={selBox} />
            <div className="active-box" style={activeBox} />
            {editing && (
              <input ref={editorRef} className="cell-editor" value={edit.text} spellCheck={false}
                style={{ top: sel.a.r * ROW_H, left: lefts[sel.a.c], minWidth: width(sel.a.c), width: `${Math.max(width(sel.a.c), edit.text.length * 8 + 16)}px`, fontWeight: activeStyle.bold ? 700 : undefined }}
                onChange={e => setEdit(ed => ed && { ...ed, text: e.target.value })} onKeyDown={onEditorKey}
                onMouseDown={e => e.stopPropagation()} />
            )}
          </div>
        </div>
      </div>

      <div className="sheet-tabs">
        {book.sheets.map((s, i) => (
          <button key={i} type="button" className={`sheet-tab${i === active ? ' on' : ''}`}
            onClick={() => { if (edit) commitEdit(); setActive(i); setSel({ a: { c: 0, r: 0 }, f: { c: 0, r: 0 } }); }}
            onDoubleClick={() => renameSheet(i)} onContextMenu={e => { e.preventDefault(); deleteSheet(i); }} title={t('class.sheetTabHint')}>
            {s.name}
          </button>
        ))}
        <button type="button" className="sheet-add" title={t('class.addSheet')} aria-label={t('class.addSheet')} onClick={addSheet}>+</button>
      </div>
      <footer className="status">
        <span className="status-file">{fileName || `${title}.xlsx`}</span>
        {stats && stats.count > 1 && <>
          <span>{t('class.stat.average')}: <b className="gold">{fmt(stats.sum / stats.count)}</b></span>
          <span>{t('class.stat.count')}: <b className="gold">{stats.filled}</b></span>
          <span>{t('class.stat.sum')}: <b className="gold">{fmt(stats.sum)}</b></span>
        </>}
      </footer>

      {panel === 'file' && (
        <FileMenu fileName={fileName || `${title}.xlsx`} onClose={() => setPanel(null)}
          onNew={() => shell.openModule('class')} onOpen={() => void openFile()} onSave={() => void save()}
          saveChoices={[
            { id: 'xlsx', icon: 'sheet', label: t('class.format.xlsx'), hint: '.xlsx' },
            { id: 'csv', icon: 'left', label: t('class.format.csv'), hint: '.csv' },
          ]}
          onSaveAs={f => (f === 'xlsx' ? void save(true) : saveCsv())}
          listRecent={shell.recent.list} onOpenRecent={r => void openRecent(r)} />
      )}
    </div>
  );
}
