// Excel .xlsx files (Office Open XML SpreadsheetML), read and written by OI1 itself with JSZip.
// Keeps values, formulas, column widths, sheet names and the formatting OI1 knows (see CellStyle).

import JSZip from 'jszip';
import { colName, isError, moveRefs, parseCell } from './formula';
import { computeSheet, key, literal, unkey, type Cell, type CellStyle, type NumberFormat, type SheetData, type WorkbookData } from './sheet';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const PX_PER_CHAR = 7;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Characters XML 1.0 does not allow.
// eslint-disable-next-line no-control-regex
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

// ---------- writing ----------

const CURRENCY_CODES: Record<string, string> = {
  USD: '"$"#,##0.00', EUR: '#,##0.00\\ "€"', GBP: '"£"#,##0.00', JPY: '"¥"#,##0', CHF: '#,##0.00\\ "CHF"',
};
const BUILTIN_FORMAT: Partial<Record<NumberFormat, number>> = { number: 4, integer: 3, percent: 10, date: 14, text: 49 };

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** A workbook as an .xlsx file. */
export async function writeXlsx(book: WorkbookData): Promise<Blob> {
  return new Blob([await xlsxBytes(book)], { type: XLSX_TYPE });
}

/** The bytes of an .xlsx file. */
export async function xlsxBytes(book: WorkbookData): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const fonts: string[] = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'];
  const fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const xfIndex = new Map<string, number>();
  const currencyCode = CURRENCY_CODES[book.currency ?? 'USD'] ?? CURRENCY_CODES.USD;

  const styleId = (st: CellStyle | undefined): number => {
    if (!st || !Object.values(st).some(v => v !== undefined && v !== false && v !== 'general')) return 0;
    const sig = JSON.stringify([st.bold, st.italic, st.underline, st.color, st.fill, st.align, st.format]);
    const known = xfIndex.get(sig);
    if (known !== undefined) return known;
    let fontId = 0;
    if (st.bold || st.italic || st.underline || st.color) {
      fonts.push(`<font>${st.bold ? '<b/>' : ''}${st.italic ? '<i/>' : ''}${st.underline ? '<u/>' : ''}<sz val="11"/>${st.color ? `<color rgb="FF${st.color.slice(1).toUpperCase()}"/>` : ''}<name val="Calibri"/><family val="2"/></font>`);
      fontId = fonts.length - 1;
    }
    let fillId = 0;
    if (st.fill) {
      fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="FF${st.fill.slice(1).toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill>`);
      fillId = fills.length - 1;
    }
    const numFmtId = st.format === 'currency' ? 164 : BUILTIN_FORMAT[st.format ?? 'general'] ?? 0;
    const align = st.align ? `<alignment horizontal="${st.align}"/>` : '';
    xfs.push(`<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0"${numFmtId ? ' applyNumberFormat="1"' : ''}${fontId ? ' applyFont="1"' : ''}${fillId ? ' applyFill="1"' : ''}${align ? ' applyAlignment="1">' + align + '</xf>' : '/>'}`);
    xfIndex.set(sig, xfs.length - 1);
    return xfs.length - 1;
  };

  const sheetXml = (sheet: SheetData): string => {
    const values = computeSheet(sheet);
    const byRow = new Map<number, [number, Cell][]>();
    for (const [k, cell] of Object.entries(sheet.cells)) {
      const { c, r } = unkey(k);
      if (!byRow.has(r)) byRow.set(r, []);
      byRow.get(r)!.push([c, cell]);
    }
    const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([r, cells]) => {
      const xml = cells.sort((a, b) => a[0] - b[0]).map(([c, cell]) => {
        const ref = `${colName(c)}${r + 1}`;
        const s = styleId(cell.style);
        const sAttr = s ? ` s="${s}"` : '';
        if (cell.input.startsWith('=') && cell.style?.format !== 'text') {
          const v = values.get(key(c, r)) ?? '';
          const f = `<f>${esc(clean(cell.input.slice(1)))}</f>`;
          if (isError(v)) return `<c r="${ref}"${sAttr} t="e">${f}<v>${esc(v.error)}</v></c>`;
          if (typeof v === 'number') return `<c r="${ref}"${sAttr}>${f}<v>${v}</v></c>`;
          if (typeof v === 'boolean') return `<c r="${ref}"${sAttr} t="b">${f}<v>${v ? 1 : 0}</v></c>`;
          return `<c r="${ref}"${sAttr} t="str">${f}<v>${esc(clean(v))}</v></c>`;
        }
        const v = cell.style?.format === 'text' ? cell.input : literal(cell.input);
        if (v === '') return `<c r="${ref}"${sAttr}/>`;
        if (typeof v === 'number') return `<c r="${ref}"${sAttr}><v>${v}</v></c>`;
        if (typeof v === 'boolean') return `<c r="${ref}"${sAttr} t="b"><v>${v ? 1 : 0}</v></c>`;
        return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(clean(String(v)))}</t></is></c>`;
      }).join('');
      return `<row r="${r + 1}">${xml}</row>`;
    }).join('');
    const widths = Object.entries(sheet.widths).sort((a, b) => Number(a[0]) - Number(b[0]));
    const cols = widths.length
      ? `<cols>${widths.map(([c, w]) => `<col min="${Number(c) + 1}" max="${Number(c) + 1}" width="${Math.max(1, (w - 5) / PX_PER_CHAR).toFixed(2)}" customWidth="1"/>`).join('')}</cols>`
      : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData></worksheet>`;
  };

  const sheets = book.sheets.length ? book.sheets : [{ name: 'Sheet1', cells: {}, widths: {} }];
  const usedNames = new Set<string>();
  const names = sheets.map((s, i) => {
    let n = s.name.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || `Sheet${i + 1}`;
    while (usedNames.has(n.toLowerCase())) n = `${n.slice(0, 28)}_${i + 1}`;
    usedNames.add(n.toLowerCase());
    return n;
  });
  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Office In 1 Class</Application></Properties>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="${esc(currencyCode)}"/></numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

// ---------- reading ----------

const kids = (el: Element | null | undefined, name: string) => (el ? Array.from(el.children).filter(c => c.localName === name) : []);
const kid = (el: Element | null | undefined, name: string) => kids(el, name)[0] ?? null;
const textOf = (el: Element | null) => (el ? Array.from(el.getElementsByTagNameNS(NS, 't')).map(t => t.textContent ?? '').join('') : '');

function formatFromCode(id: number, code: string | undefined): NumberFormat | undefined {
  if (id === 0) return undefined;
  if (id === 9 || id === 10) return 'percent';
  if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return 'date';
  if (id === 1 || id === 3) return 'integer';
  if (id === 2 || id === 4) return 'number';
  if (id >= 5 && id <= 8) return 'currency';
  if (id === 49) return 'text';
  if (!code) return undefined;
  const bare = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, m => (/[$€£¥]/.test(m) ? '$' : ''));
  if (bare.includes('%')) return 'percent';
  if (/[$€£¥]/.test(bare) || /\[\$[^\]]*\]/.test(code)) return 'currency';
  if (/[dmy]/i.test(bare) && !/0/.test(bare)) return 'date';
  if (/0\.0/.test(bare)) return 'number';
  if (/[#0]/.test(bare)) return 'integer';
  return undefined;
}

const argb = (el: Element | null): string | undefined => {
  const rgb = el?.getAttribute('rgb');
  return rgb && /^[0-9A-F]{8}$/i.test(rgb) ? `#${rgb.slice(2).toUpperCase()}` : rgb && /^[0-9A-F]{6}$/i.test(rgb) ? `#${rgb.toUpperCase()}` : undefined;
};

/** Reads an .xlsx file: every sheet, with values, formulas, widths and basic formatting. */
export async function readXlsx(data: ArrayBuffer): Promise<WorkbookData> {
  const zip = await JSZip.loadAsync(data);
  const xml = async (path: string) => {
    const f = zip.file(path.replace(/^\//, ''));
    return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null;
  };
  const resolve = (base: string, target: string) => (target.startsWith('/') ? target.slice(1) : `${base}${target}`).replace(/[^/]+\/\.\.\//g, '');

  const wb = await xml('xl/workbook.xml');
  if (!wb) throw new Error('Not an Excel workbook');
  const rels = await xml('xl/_rels/workbook.xml.rels');
  const relTarget = new Map(Array.from(rels?.getElementsByTagName('Relationship') ?? []).map(r => [r.getAttribute('Id'), r.getAttribute('Target') ?? '']));

  const shared = await xml('xl/sharedStrings.xml');
  const strings = kids(shared?.documentElement, 'si').map(si => textOf(si));

  const styles = await xml('xl/styles.xml');
  const sroot = styles?.documentElement;
  const codes = new Map(kids(kid(sroot, 'numFmts'), 'numFmt').map(n => [Number(n.getAttribute('numFmtId')), n.getAttribute('formatCode') ?? '']));
  const fonts = kids(kid(sroot, 'fonts'), 'font').map(f => ({
    bold: !!kid(f, 'b') && kid(f, 'b')!.getAttribute('val') !== '0',
    italic: !!kid(f, 'i') && kid(f, 'i')!.getAttribute('val') !== '0',
    underline: !!kid(f, 'u') && kid(f, 'u')!.getAttribute('val') !== 'none',
    color: argb(kid(f, 'color')),
  }));
  const fills = kids(kid(sroot, 'fills'), 'fill').map(f => {
    const p = kid(f, 'patternFill');
    return p?.getAttribute('patternType') === 'solid' ? argb(kid(p, 'fgColor')) : undefined;
  });
  const xfStyles: (CellStyle | undefined)[] = kids(kid(sroot, 'cellXfs'), 'xf').map(xf => {
    const font = fonts[Number(xf.getAttribute('fontId') ?? 0)];
    const st: CellStyle = {};
    if (font?.bold) st.bold = true;
    if (font?.italic) st.italic = true;
    if (font?.underline) st.underline = true;
    if (font?.color && font.color !== '#000000') st.color = font.color;
    const fill = fills[Number(xf.getAttribute('fillId') ?? 0)];
    if (fill) st.fill = fill;
    const id = Number(xf.getAttribute('numFmtId') ?? 0);
    const format = formatFromCode(id, codes.get(id));
    if (format) st.format = format;
    const h = kid(xf, 'alignment')?.getAttribute('horizontal');
    if (h === 'left' || h === 'center' || h === 'right') st.align = h;
    return Object.keys(st).length ? st : undefined;
  });
  let currency: string | undefined;
  for (const code of codes.values()) {
    if (code.includes('€')) currency = 'EUR';
    else if (code.includes('£')) currency = 'GBP';
    else if (/"\$"|\[\$\$/.test(code)) currency = 'USD';
  }

  const book: WorkbookData = { sheets: [], currency };
  for (const sh of Array.from(wb.getElementsByTagNameNS(NS, 'sheet'))) {
    const rid = sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? sh.getAttribute('r:id');
    const target = relTarget.get(rid);
    if (!target) continue;
    const doc = await xml(resolve('xl/', target));
    if (!doc) continue;
    const sheet: SheetData = { name: sh.getAttribute('name') ?? `Sheet${book.sheets.length + 1}`, cells: {}, widths: {} };
    for (const col of Array.from(doc.getElementsByTagNameNS(NS, 'col'))) {
      const w = Number(col.getAttribute('width'));
      if (!w || col.getAttribute('customWidth') !== '1') continue;
      const min = Number(col.getAttribute('min')), max = Math.min(Number(col.getAttribute('max')), min + 200);
      for (let c = min; c <= max; c++) sheet.widths[c - 1] = Math.round(w * PX_PER_CHAR + 5);
    }
    const sharedFormulas = new Map<string, { formula: string; c: number; r: number }>();
    for (const el of Array.from(doc.getElementsByTagNameNS(NS, 'c'))) {
      const at = parseCell(el.getAttribute('r') ?? '');
      if (!at) continue;
      const style = xfStyles[Number(el.getAttribute('s') ?? 0)];
      const type = el.getAttribute('t');
      const v = kid(el, 'v')?.textContent ?? '';
      const f = kid(el, 'f');
      let input = '';
      if (f) {
        const si = f.getAttribute('si');
        let formula = f.textContent ?? '';
        if (f.getAttribute('t') === 'shared' && si !== null) {
          if (formula) sharedFormulas.set(si, { formula, c: at.c, r: at.r });
          else {
            const master = sharedFormulas.get(si);
            if (master) formula = moveRefs(master.formula, (c, r, absC, absR) => ({ c: absC ? c : c + at.c - master.c, r: absR ? r : r + at.r - master.r }));
          }
        }
        input = formula ? `=${formula}` : v;
      } else if (type === 's') input = strings[Number(v)] ?? '';
      else if (type === 'inlineStr') input = textOf(kid(el, 'is'));
      else if (type === 'b') input = v === '1' ? 'TRUE' : 'FALSE';
      else if (type === 'str' || type === 'e') input = v;
      else input = v;
      if (!input && !style) continue;
      // Text that looks like a number or formula stays text.
      const keepText = (type === 's' || type === 'inlineStr' || type === 'str') && !f && (typeof literal(input) !== 'string' || input.startsWith('='));
      sheet.cells[key(at.c, at.r)] = { input, style: keepText ? { ...style, format: 'text' } : style };
    }
    book.sheets.push(sheet);
  }
  if (!book.sheets.length) book.sheets.push({ name: 'Sheet1', cells: {}, widths: {} });
  return book;
}
