// The page setup of a sheet in an .xlsx file, so Excel prints it like In 1 Class does and the other way round:
// paper, orientation, margins, scaling, gridlines, headings, centering, page order, header and footer, print area
// and print titles (ECMA-376 part 1, §18.3.1.62 pageSetup, §18.3.1.70 printOptions, §18.3.1.46 headerFooter,
// §18.2.5 definedName _xlnm.Print_Area / _xlnm.Print_Titles).

import { colIndex, colName } from './formula';
import type { PrintSetup } from './sheet';

/** Excel's paperSize codes. */
const XL_PAPER: Record<string, number> = {
  letter: 1, tabloid: 3, ledger: 4, legal: 5, statement: 6, executive: 7, a3: 8, a4: 9, a5: 11, b4: 12, b5: 13, folio: 14,
  quarto: 15, env10: 20, envdl: 27, envc5: 28, envc4: 30, a2: 66, a6: 70,
};
/** Margins in inches: left, right, top, bottom. */
const XL_MARGINS: Record<string, [number, number, number, number]> = {
  normal: [0.7, 0.7, 0.75, 0.75], wide: [1, 1, 1, 1], narrow: [0.25, 0.25, 0.75, 0.75], none: [0.17, 0.17, 0.17, 0.17], binding: [1.2, 0.7, 0.75, 0.75],
  top: [0.7, 0.7, 2, 0.75], bottom: [0.7, 0.7, 0.75, 2],
};
for (const v of ['1cm', '1.5cm', '2cm', '2.5cm', '3cm', '4cm', '0.25in', '0.5in', '0.75in', '1in', '1.25in', '1.5in', '2in']) {
  const n = parseFloat(v) / (v.endsWith('cm') ? 2.54 : 1);
  XL_MARGINS[v] = [n, n, n, n];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TOKENS: [string, string][] = [['{page}', '&P'], ['{pages}', '&N'], ['{sheet}', '&A'], ['{file}', '&F'], ['{date}', '&D'], ['{time}', '&T']];
const toXl = (text: string) => {
  let s = text.replace(/&/g, '&&');
  for (const [a, b] of TOKENS) s = s.split(a).join(b);
  return `&C${s}`;
};
const fromXl = (code: string) => {
  // Keeps the centre part (or the whole text when there are no sections), with Excel's codes back as placeholders.
  const centre = /&C(.*?)(?=&[LR]|$)/.exec(code)?.[1] ?? code.replace(/&[LR]/g, ' ');
  let s = centre.replace(/&"[^"]*"/g, '').replace(/&\d+/g, '').replace(/&[BIUSXYEKOH]/g, '');
  for (const [a, b] of TOKENS) s = s.split(b).join(a);
  return s.replace(/&&/g, '&').trim();
};

/** The parts of a worksheet's XML for its page setup. */
export function printXml(p: PrintSetup | undefined) {
  if (!p) return { fitToPage: false, printOptions: '', pageMargins: '', pageSetup: '', headerFooter: '' };
  const fit = p.fit ?? 'none';
  const pages = fit === 'page' ? [1, 1] : fit === 'width' ? [1, 0] : fit === 'height' ? [0, 1] : /^\dx\d$/.test(fit) ? [Number(fit[0]), Number(fit[2])] : null;
  const scale = /^\d+$/.test(fit) ? Math.max(10, Math.min(400, Number(fit))) : null;
  const m = XL_MARGINS[p.margins ?? 'normal'] ?? XL_MARGINS.normal;
  const opts = [p.grid ? ' gridLines="1"' : '', p.headings ? ' headings="1"' : '', p.center ? ' horizontalCentered="1"' : ''].join('');
  const paper = XL_PAPER[p.paper ?? 'a4'];
  const setup = [paper ? ` paperSize="${paper}"` : '', scale ? ` scale="${scale}"` : '',
    pages ? ` fitToWidth="${pages[0]}" fitToHeight="${pages[1]}"` : '', p.order === 'over' ? ' pageOrder="overThenDown"' : '',
    ` orientation="${p.orientation === 'landscape' ? 'landscape' : 'portrait'}"`].join('');
  const hf = p.header || p.footer
    ? `<headerFooter>${p.header ? `<oddHeader>${esc(toXl(p.header))}</oddHeader>` : ''}${p.footer ? `<oddFooter>${esc(toXl(p.footer))}</oddFooter>` : ''}</headerFooter>`
    : '';
  return {
    fitToPage: !!pages,
    printOptions: opts ? `<printOptions${opts}/>` : '',
    pageMargins: `<pageMargins left="${m[0]}" right="${m[1]}" top="${m[2]}" bottom="${m[3]}" header="0.3" footer="0.3"/>`,
    pageSetup: `<pageSetup${setup}/>`,
    headerFooter: hf,
  };
}

/** The defined names for a sheet's print area and print titles. `ref` quotes the sheet name. */
export function printNames(p: PrintSetup | undefined, si: number, sheetRef: string): string[] {
  const out: string[] = [];
  if (!p) return out;
  if (p.area) out.push(`<definedName name="_xlnm.Print_Area" localSheetId="${si}">${esc(`${sheetRef}!$${colName(p.area.c1)}$${p.area.r1 + 1}:$${colName(p.area.c2)}$${p.area.r2 + 1}`)}</definedName>`);
  const titles = [p.titleCols ? `${sheetRef}!$A:$${colName(p.titleCols - 1)}` : '', p.titleRows ? `${sheetRef}!$1:$${p.titleRows}` : ''].filter(Boolean);
  if (titles.length) out.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${si}">${esc(titles.join(','))}</definedName>`);
  return out;
}

const child = (el: Element | null | undefined, name: string) => (el ? Array.from(el.children).find(c => c.localName === name) ?? null : null);

/** Reads a worksheet's page setup back. */
export function readPrint(root: Element): PrintSetup | undefined {
  const p: PrintSetup = {};
  const opts = child(root, 'printOptions');
  const yes = (el: Element | null, a: string) => ['1', 'true'].includes(el?.getAttribute(a) ?? '');
  if (yes(opts, 'gridLines')) p.grid = true;
  if (yes(opts, 'headings')) p.headings = true;
  if (yes(opts, 'horizontalCentered')) p.center = true;
  const ps = child(root, 'pageSetup');
  if (ps) {
    const code = Number(ps.getAttribute('paperSize'));
    const paper = Object.entries(XL_PAPER).find(([, v]) => v === code)?.[0];
    if (paper) p.paper = paper;
    if (ps.getAttribute('orientation') === 'landscape') p.orientation = 'landscape';
    if (ps.getAttribute('pageOrder') === 'overThenDown') p.order = 'over';
    const fitOn = yes(child(child(root, 'sheetPr'), 'pageSetUpPr'), 'fitToPage');
    const fw = Number(ps.getAttribute('fitToWidth') ?? 1), fh = Number(ps.getAttribute('fitToHeight') ?? 1);
    const scale = Number(ps.getAttribute('scale'));
    if (fitOn) p.fit = fw === 1 && fh === 1 ? 'page' : fw === 1 && fh === 0 ? 'width' : fw === 0 && fh === 1 ? 'height' : fw >= 1 && fw <= 9 && fh >= 1 && fh <= 9 ? `${fw}x${fh}` : 'page';
    else if (scale && scale !== 100) p.fit = String(scale);
  }
  const m = child(root, 'pageMargins');
  if (m) {
    const got = ['left', 'right', 'top', 'bottom'].map(a => Number(m.getAttribute(a)));
    const off = (x: number[]) => x.reduce((acc, v, i) => acc + Math.abs(v - got[i]), 0);
    const best = Object.entries(XL_MARGINS).sort((a, b) => off(a[1]) - off(b[1]))[0][0];
    if (best !== 'normal') p.margins = best;
  }
  const hf = child(root, 'headerFooter');
  const head = child(hf, 'oddHeader')?.textContent, foot = child(hf, 'oddFooter')?.textContent;
  if (head) p.header = fromXl(head);
  if (foot) p.footer = fromXl(foot);
  return Object.keys(p).length ? p : undefined;
}

/** Applies a _xlnm.Print_Area or _xlnm.Print_Titles defined name to a setup. */
export function applyPrintName(p: PrintSetup, name: string, ref: string): PrintSetup {
  const parts = ref.split(',').map(x => x.replace(/^.*!/, '').replace(/\$/g, ''));
  if (name === '_xlnm.Print_Area') {
    const mm = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(parts[0] ?? '');
    if (mm) return { ...p, area: { c1: colIndex(mm[1]), r1: Number(mm[2]) - 1, c2: colIndex(mm[3]), r2: Number(mm[4]) - 1 } };
  } else if (name === '_xlnm.Print_Titles') {
    const out = { ...p };
    for (const x of parts) {
      const rows = /^(\d+):(\d+)$/.exec(x), cols = /^([A-Z]+):([A-Z]+)$/.exec(x);
      if (rows && rows[1] === '1') out.titleRows = Number(rows[2]);
      if (cols && cols[1] === 'A') out.titleCols = colIndex(cols[2]) + 1;
    }
    return out;
  }
  return p;
}
