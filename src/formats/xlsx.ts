// Excel .xlsx files (Office Open XML SpreadsheetML), read and written by OI1 itself with JSZip.
// Keeps values, formulas, sheets, column widths and row heights, the formatting OI1 knows (see CellStyle),
// merged cells, frozen panes, the AutoFilter, conditional formatting and charts.

import { applyPrintName, printNames, printXml, readPrint } from './xlsxPrint';
import JSZip from 'jszip';
import { chartLayout } from './chartdata';
import { cellName, colName, isError, moveRefs, parseCell, type Scalar } from './formula';
import {
  computeBook, display, key, literal, unkey,
  type BorderLine, type Cell, type CellStyle, type Chart, type CondRule, type Merge, type NumberFormat, type SheetData, type Validation, type VKind, type VOp, type WorkbookData,
} from './sheet';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const C_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const XDR_NS = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const PX_PER_CHAR = 7;
const PT_PER_PX = 0.75;
const EMU_PER_PX = 9525;
const DEFAULT_ROW_PX = 26;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Characters XML 1.0 does not allow.
// eslint-disable-next-line no-control-regex
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const rgb = (hex: string) => `FF${hex.slice(1).toUpperCase()}`;
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// ---------- number format codes ----------

const CURRENCY_SYMBOL: Record<string, string> = { USD: '"$"', EUR: '"€"', GBP: '"£"', JPY: '"¥"', CHF: '"CHF"' };
const SYMBOL_AFTER = new Set(['EUR', 'CHF']);
const BUILTIN_CODES: Record<number, string> = {
  1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: '# ?/?', 13: '# ??/??',
  14: 'm/d/yyyy', 20: 'h:mm', 22: 'm/d/yyyy h:mm', 49: '@',
};

/** The Excel format code for a cell's number format, or '' for General. */
export function formatCode(st: CellStyle, currency: string): string {
  const f = st.format ?? 'general';
  const digits = (d: number) => (d > 0 ? `.${'0'.repeat(d)}` : '');
  const dflt = f === 'number' || f === 'currency' || f === 'accounting' || f === 'scientific' ? 2 : 0;
  const d = st.decimals ?? dflt;
  const sym = CURRENCY_SYMBOL[currency] ?? `"${currency}"`;
  const after = SYMBOL_AFTER.has(currency);
  switch (f) {
    case 'general': return st.decimals !== undefined ? `${st.thousands ? '#,##0' : '0'}${digits(d)}` : '';
    case 'integer': return st.thousands === false ? '0' : '#,##0';
    case 'number': return `${st.thousands === false ? '0' : '#,##0'}${digits(d)}`;
    case 'percent': return `0${digits(st.decimals ?? 0)}%`;
    case 'currency': return after ? `#,##0${digits(d)}\\ ${sym}` : `${sym}#,##0${digits(d)}`;
    case 'accounting': {
      const n = `#,##0${digits(d)}`;
      return after ? `_-* ${n}\\ ${sym}_-;\\-* ${n}\\ ${sym}_-;_-* "-"??\\ ${sym}_-;_-@_-` : `_(${sym}* ${n}_);_(${sym}* \\(${n}\\);_(${sym}* "-"??_);_(@_)`;
    }
    case 'scientific': return `0${digits(d)}E+00`;
    case 'fraction': return '# ??/??';
    case 'date': return 'm/d/yyyy';
    case 'longDate': return '[$-F800]dddd\\,\\ mmmm\\ dd\\,\\ yyyy';
    case 'time': return 'h:mm';
    case 'dateTime': return 'm/d/yyyy h:mm';
    case 'text': return '@';
  }
}

/** OI1's number format for an Excel format code. */
export function styleFromCode(id: number, code: string | undefined): Pick<CellStyle, 'format' | 'decimals' | 'thousands'> {
  if (id === 0) return {};
  if (id === 49) return { format: 'text' };
  if (id >= 5 && id <= 8) return { format: 'currency' };
  if ((id >= 14 && id <= 17) || id === 30) return { format: 'date' };
  if (id >= 18 && id <= 21 || (id >= 45 && id <= 47)) return { format: 'time' };
  if (id === 22) return { format: 'dateTime' };
  const src = code ?? BUILTIN_CODES[id];
  if (!src) return {};
  const first = src.split(';')[0];
  if (first === '@') return { format: 'text' };
  if (/F800|dddd|mmmm/i.test(first)) return { format: 'longDate' };
  const bare = first.replace(/"[^"]*"|\[[^\]]*\]|\\./g, m => (/[$€£¥]|CHF/.test(m) ? '$' : '')).replace(/_.|\*./g, '');
  const decimals = (bare.match(/\.(0+)/)?.[1].length) ?? 0;
  const thousands = bare.includes(',');
  if (/[dy]/i.test(bare) && /h/i.test(bare)) return { format: 'dateTime' };
  if (/h/i.test(bare) && /m/i.test(bare) && !/[dy]/i.test(bare)) return { format: 'time' };
  if (/[dmy]/i.test(bare) && !/0/.test(bare)) return { format: 'date' };
  if (bare.includes('%')) return decimals ? { format: 'percent', decimals } : { format: 'percent' };
  if (/E\+/i.test(bare)) return decimals === 2 ? { format: 'scientific' } : { format: 'scientific', decimals };
  if (/\?\/\?/.test(bare)) return { format: 'fraction' };
  if (/_\(|_-/.test(src) && /[$€£¥]|\[\$/.test(src)) return decimals === 2 ? { format: 'accounting' } : { format: 'accounting', decimals };
  if (/[$€£¥]/.test(bare) || /\[\$[^\]]*\]/.test(src) || /CHF/.test(src)) return decimals === 2 ? { format: 'currency' } : { format: 'currency', decimals };
  if (/[#0]/.test(bare)) {
    if (!decimals) return thousands ? { format: 'integer' } : { format: 'integer', thousands: false };
    const st: Pick<CellStyle, 'format' | 'decimals' | 'thousands'> = { format: 'number' };
    if (decimals !== 2) st.decimals = decimals;
    if (!thousands) st.thousands = false;
    return st;
  }
  return {};
}

// ---------- writing ----------

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** A workbook as an .xlsx file. `lang` is the language the filter's values are shown in. */
export async function writeXlsx(book: WorkbookData, lang = 'en'): Promise<Blob> {
  return new Blob([await xlsxBytes(book, lang)], { type: XLSX_TYPE });
}

const BORDER_STYLE: Record<BorderLine['style'], string> = { thin: 'thin', medium: 'medium', thick: 'thick', double: 'double', dashed: 'dashed' };
const borderXml = (side: string, b?: BorderLine) =>
  b ? `<${side} style="${BORDER_STYLE[b.style]}"><color ${b.color ? `rgb="${rgb(b.color)}"` : 'auto="1"'}/></${side}>` : `<${side}/>`;

/** The bytes of an .xlsx file. */
export async function xlsxBytes(book: WorkbookData, lang = 'en'): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const currency = book.currency ?? 'USD';
  const fonts: string[] = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'];
  const fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders: string[] = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const numFmts: string[] = [];
  const numFmtIds = new Map<string, number>();
  const xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const xfIndex = new Map<string, number>();
  const dxfs: string[] = [];
  const pooled = (list: string[], xml: string) => { const i = list.indexOf(xml); if (i >= 0) return i; list.push(xml); return list.length - 1; };

  const numFmtId = (st: CellStyle): number => {
    const code = formatCode(st, currency);
    if (!code) return 0;
    const builtin = Object.entries(BUILTIN_CODES).find(([, c]) => c === code);
    if (builtin) return Number(builtin[0]);
    let id = numFmtIds.get(code);
    if (id === undefined) {
      id = 164 + numFmtIds.size;
      numFmtIds.set(code, id);
      numFmts.push(`<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`);
    }
    return id;
  };

  const styleId = (st: CellStyle | undefined): number => {
    if (!st || !Object.values(st).some(v => v !== undefined && v !== false && v !== 'general')) return 0;
    const sig = JSON.stringify(Object.keys(st).sort().map(k => [k, st[k as keyof CellStyle]]));
    const known = xfIndex.get(sig);
    if (known !== undefined) return known;
    const font = `<font>${st.bold ? '<b/>' : ''}${st.italic ? '<i/>' : ''}${st.strike ? '<strike/>' : ''}${st.underline ? '<u/>' : ''}<sz val="${st.size ?? 11}"/>${st.color ? `<color rgb="${rgb(st.color)}"/>` : ''}<name val="${esc(st.font ?? 'Calibri')}"/>${st.font ? '' : '<family val="2"/>'}</font>`;
    const fontId = pooled(fonts, font);
    const fillId = st.fill ? pooled(fills, `<fill><patternFill patternType="solid"><fgColor rgb="${rgb(st.fill)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const b = st.borders;
    const borderId = b && Object.values(b).some(Boolean)
      ? pooled(borders, `<border>${borderXml('left', b.left)}${borderXml('right', b.right)}${borderXml('top', b.top)}${borderXml('bottom', b.bottom)}<diagonal/></border>`)
      : 0;
    const nf = numFmtId(st);
    const al = [
      st.align ? `horizontal="${st.align}"` : '', st.valign ? `vertical="${st.valign === 'middle' ? 'center' : st.valign}"` : '',
      st.wrap ? 'wrapText="1"' : '', st.indent ? `indent="${st.indent}"` : '',
    ].filter(Boolean).join(' ');
    xfs.push(`<xf numFmtId="${nf}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"${nf ? ' applyNumberFormat="1"' : ''}${fontId ? ' applyFont="1"' : ''}${fillId ? ' applyFill="1"' : ''}${borderId ? ' applyBorder="1"' : ''}${al ? ` applyAlignment="1"><alignment ${al}/></xf>` : '/>'}`);
    xfIndex.set(sig, xfs.length - 1);
    return xfs.length - 1;
  };

  const sheets = book.sheets.length ? book.sheets : [{ name: 'Sheet1', cells: {}, widths: {} } as SheetData];
  const allValues = computeBook({ ...book, sheets });
  const usedNames = new Set<string>();
  const names = sheets.map((s, i) => {
    let n = s.name.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || `Sheet${i + 1}`;
    while (usedNames.has(n.toLowerCase())) n = `${n.slice(0, 28)}_${i + 1}`;
    usedNames.add(n.toLowerCase());
    return n;
  });
  const quoted = (n: string) => (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(n) && !parseCell(n) ? n : `'${n.replace(/'/g, "''")}'`);
  const absRange = (sheet: string, b: Merge) => `${quoted(sheet)}!$${colName(b.c1)}$${b.r1 + 1}:$${colName(b.c2)}$${b.r2 + 1}`;
  const definedNames: string[] = [];
  let chartCount = 0, drawingCount = 0;
  const contentOverrides: string[] = [];

  const sheetXml = (sheet: SheetData, si: number): string => {
    const values = allValues[si];
    const show = (c: number, r: number) => display(values.get(key(c, r)) ?? '', sheet.cells[key(c, r)]?.style, lang, currency);
    // Rows the filter hides are saved hidden, like Excel does.
    const hidden = new Set<number>();
    const f = sheet.filter;
    if (f) for (let r = f.range.r1 + 1; r <= f.range.r2; r++) {
      for (const [c, off] of Object.entries(f.hidden)) if (off.includes(show(Number(c), r))) { hidden.add(r); break; }
    }
    const byRow = new Map<number, [number, Cell][]>();
    for (const [k, cell] of Object.entries(sheet.cells)) {
      const { c, r } = unkey(k);
      if (!byRow.has(r)) byRow.set(r, []);
      byRow.get(r)!.push([c, cell]);
    }
    for (const r of [...Object.keys(sheet.heights ?? {}).map(Number), ...hidden]) if (!byRow.has(r)) byRow.set(r, []);
    const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([r, cells]) => {
      const xml = cells.sort((a, b) => a[0] - b[0]).map(([c, cell]) => {
        const ref = `${colName(c)}${r + 1}`;
        const s = styleId(cell.style);
        const sAttr = s ? ` s="${s}"` : '';
        if (cell.input.startsWith('=') && cell.style?.format !== 'text') {
          const v = values.get(key(c, r)) ?? '';
          const fx = `<f>${esc(clean(cell.input.slice(1)))}</f>`;
          if (isError(v)) return `<c r="${ref}"${sAttr} t="e">${fx}<v>${esc(v.error)}</v></c>`;
          if (typeof v === 'number') return `<c r="${ref}"${sAttr}>${fx}<v>${v}</v></c>`;
          if (typeof v === 'boolean') return `<c r="${ref}"${sAttr} t="b">${fx}<v>${v ? 1 : 0}</v></c>`;
          return `<c r="${ref}"${sAttr} t="str">${fx}<v>${esc(clean(v))}</v></c>`;
        }
        const v = cell.style?.format === 'text' ? cell.input : literal(cell.input);
        if (v === '') return `<c r="${ref}"${sAttr}/>`;
        if (typeof v === 'number') return `<c r="${ref}"${sAttr}><v>${v}</v></c>`;
        if (typeof v === 'boolean') return `<c r="${ref}"${sAttr} t="b"><v>${v ? 1 : 0}</v></c>`;
        return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(clean(String(v)))}</t></is></c>`;
      }).join('');
      const h = sheet.heights?.[r];
      return `<row r="${r + 1}"${h ? ` ht="${(h * PT_PER_PX).toFixed(2)}" customHeight="1"` : ''}${hidden.has(r) ? ' hidden="1"' : ''}>${xml}</row>`;
    }).join('');
    const widths = Object.entries(sheet.widths).sort((a, b) => Number(a[0]) - Number(b[0]));
    const cols = widths.length
      ? `<cols>${widths.map(([c, w]) => `<col min="${Number(c) + 1}" max="${Number(c) + 1}" width="${Math.max(1, (w - 5) / PX_PER_CHAR).toFixed(2)}" customWidth="1"/>`).join('')}</cols>`
      : '';
    const fz = sheet.freeze;
    const pane = fz && (fz.c || fz.r)
      ? `<pane${fz.c ? ` xSplit="${fz.c}"` : ''}${fz.r ? ` ySplit="${fz.r}"` : ''} topLeftCell="${cellName(fz.c, fz.r)}" activePane="${fz.c && fz.r ? 'bottomRight' : fz.r ? 'bottomLeft' : 'topRight'}" state="frozen"/>`
      : '';
    const views = `<sheetViews><sheetView workbookViewId="0"${si === 0 ? ' tabSelected="1"' : ''}${sheet.noGrid ? ' showGridLines="0"' : ''}${pane ? `>${pane}</sheetView>` : '/>'}</sheetViews>`;
    const px = printXml(sheet.print);
    definedNames.push(...printNames(sheet.print, si, quoted(names[si])));
    const prInner = `${sheet.tabColor ? `<tabColor rgb="${rgb(sheet.tabColor)}"/>` : ''}${px.fitToPage ? '<pageSetUpPr fitToPage="1"/>' : ''}`;
    const pr = prInner ? `<sheetPr>${prInner}</sheetPr>` : '';
    let autoFilter = '';
    if (f) {
      definedNames.push(`<definedName name="_xlnm._FilterDatabase" localSheetId="${si}" hidden="1">${esc(absRange(names[si], f.range))}</definedName>`);
      const columns = Object.entries(f.hidden).filter(([, off]) => off.length).map(([cs, off]) => {
        const c = Number(cs);
        const shown = new Set<string>();
        for (let r = f.range.r1 + 1; r <= f.range.r2; r++) { const t = show(c, r); if (!off.includes(t)) shown.add(t); }
        const blank = shown.delete('');
        return `<filterColumn colId="${c - f.range.c1}"><filters${blank ? ' blank="1"' : ''}>${[...shown].map(t => `<filter val="${esc(clean(t))}"/>`).join('')}</filters></filterColumn>`;
      }).join('');
      const ref = `${cellName(f.range.c1, f.range.r1)}:${cellName(f.range.c2, f.range.r2)}`;
      autoFilter = columns ? `<autoFilter ref="${ref}">${columns}</autoFilter>` : `<autoFilter ref="${ref}"/>`;
    }
    const merges = sheet.merges?.length
      ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(m => `<mergeCell ref="${cellName(m.c1, m.r1)}:${cellName(m.c2, m.r2)}"/>`).join('')}</mergeCells>`
      : '';
    const cond = (sheet.rules ?? []).map((rule, i) => condXml(rule, i + 1)).join('');
    let drawing = '';
    if (sheet.charts?.length) {
      const d = ++drawingCount;
      drawing = '<drawing r:id="rId1"/>';
      zip.file(`xl/worksheets/_rels/sheet${si + 1}.xml.rels`, `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R_NS}/drawing" Target="../drawings/drawing${d}.xml"/></Relationships>`);
      const anchors: string[] = [], rels: string[] = [];
      sheet.charts.forEach((ch, i) => {
        const n = ++chartCount;
        anchors.push(`<xdr:absoluteAnchor><xdr:pos x="${ch.x * EMU_PER_PX}" y="${ch.y * EMU_PER_PX}"/><xdr:ext cx="${ch.w * EMU_PER_PX}" cy="${ch.h * EMU_PER_PX}"/><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${C_NS}"><c:chart xmlns:c="${C_NS}" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:absoluteAnchor>`);
        rels.push(`<Relationship Id="rId${i + 1}" Type="${R_NS}/chart" Target="../charts/chart${n}.xml"/>`);
        zip.file(`xl/charts/chart${n}.xml`, chartXml(ch, sheet, values, names[si]));
        contentOverrides.push(`<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
      });
      zip.file(`xl/drawings/drawing${d}.xml`, `${XML_HEAD}<xdr:wsDr xmlns:xdr="${XDR_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}">${anchors.join('')}</xdr:wsDr>`);
      zip.file(`xl/drawings/_rels/drawing${d}.xml.rels`, `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
      contentOverrides.push(`<Override PartName="/xl/drawings/drawing${d}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
    }
    return `${XML_HEAD}<worksheet xmlns="${NS}" xmlns:r="${R_NS}">${pr}${views}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData>${autoFilter}${merges}${cond}${validationsXml(sheet)}${px.printOptions}${px.pageMargins || '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>'}${px.pageSetup}${px.headerFooter}${drawing}</worksheet>`;
  };

  const condXml = (rule: CondRule, priority: number): string => {
    const sqref = `${cellName(rule.range.c1, rule.range.r1)}:${cellName(rule.range.c2, rule.range.r2)}`;
    const dxf = () => pooled(dxfs, `<dxf>${rule.color ? `<font><color rgb="${rgb(rule.color)}"/></font>` : ''}${rule.fill ? `<fill><patternFill><bgColor rgb="${rgb(rule.fill)}"/></patternFill></fill>` : ''}</dxf>`);
    const val = (s?: string) => { const v = literal(s ?? ''); return typeof v === 'number' ? String(v) : `"${esc(String(s ?? '').replace(/"/g, '""'))}"`; };
    const first = cellName(rule.range.c1, rule.range.r1);
    let body: string;
    switch (rule.kind) {
      case 'greater': case 'less': case 'equal':
        body = `<cfRule type="cellIs" dxfId="${dxf()}" priority="${priority}" operator="${{ greater: 'greaterThan', less: 'lessThan', equal: 'equal' }[rule.kind]}"><formula>${val(rule.a)}</formula></cfRule>`; break;
      case 'between':
        body = `<cfRule type="cellIs" dxfId="${dxf()}" priority="${priority}" operator="between"><formula>${val(rule.a)}</formula><formula>${val(rule.b)}</formula></cfRule>`; break;
      case 'contains':
        body = `<cfRule type="containsText" dxfId="${dxf()}" priority="${priority}" operator="containsText" text="${esc(rule.a ?? '')}"><formula>NOT(ISERROR(SEARCH(${val(rule.a)},${first})))</formula></cfRule>`; break;
      case 'duplicate': body = `<cfRule type="duplicateValues" dxfId="${dxf()}" priority="${priority}"/>`; break;
      case 'top': case 'bottom':
        body = `<cfRule type="top10" dxfId="${dxf()}" priority="${priority}" rank="${Math.max(1, Number(rule.a) || 10)}"${rule.kind === 'bottom' ? ' bottom="1"' : ''}/>`; break;
      case 'aboveAverage': case 'belowAverage':
        body = `<cfRule type="aboveAverage" dxfId="${dxf()}" priority="${priority}"${rule.kind === 'belowAverage' ? ' aboveAverage="0"' : ''}/>`; break;
      case 'scale': {
        const [a, b, mid] = rule.colors ?? ['#F8696B', '#63BE7B', '#FFEB84'];
        body = `<cfRule type="colorScale" priority="${priority}"><colorScale><cfvo type="min"/>${mid ? '<cfvo type="percentile" val="50"/>' : ''}<cfvo type="max"/><color rgb="${rgb(a)}"/>${mid ? `<color rgb="${rgb(mid)}"/>` : ''}<color rgb="${rgb(b)}"/></colorScale></cfRule>`; break;
      }
      case 'bars':
        body = `<cfRule type="dataBar" priority="${priority}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${rgb(rule.colors?.[0] ?? rule.fill ?? '#638EC6')}"/></dataBar></cfRule>`; break;
    }
    return `<conditionalFormatting sqref="${sqref}">${body}</conditionalFormatting>`;
  };

  const chartXml = (ch: Chart, sheet: SheetData, values: Map<string, Scalar>, sheetName: string): string => {
    const lay = chartLayout(values, ch);
    const { c1, r1, c2, r2 } = ch.range;
    const ref = (b: Merge) => esc(absRange(sheetName, b));
    const palette = [['4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '264478', '9E480E'], ['D4A843', '8C6A1F', 'E9C878', '5C4A1E', 'B8E05F', '6FA8DC', 'C27BA0', '93C47D'],
      ['1F77B4', '2CA02C', 'D62728', '9467BD', '8C564B', 'E377C2', '7F7F7F', '17BECF'], ['264653', '2A9D8F', 'E9C46A', 'F4A261', 'E76F51', '8AB17D', 'B56576', '6D597A']][ch.palette ?? 0] ?? [];
    const v = (c: number, r: number) => values.get(key(c, r)) ?? '';
    const strCache = (cells: [number, number][]) => `<c:strCache><c:ptCount val="${cells.length}"/>${cells.map(([c, r], i) => `<c:pt idx="${i}"><c:v>${esc(clean(display(v(c, r), sheet.cells[key(c, r)]?.style, lang, currency)))}</c:v></c:pt>`).join('')}</c:strCache>`;
    const numCache = (cells: [number, number][]) => `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${cells.length}"/>${cells.map(([c, r], i) => { const x = v(c, r); return typeof x === 'number' ? `<c:pt idx="${i}"><c:v>${x}</c:v></c:pt>` : ''; }).join('')}</c:numCache>`;
    const line = (b: Merge) => { const out: [number, number][] = []; for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) out.push([c, r]); return out; };
    // Each series: its name cell, its category cells and its value cells.
    const series: { name?: Merge; cat?: Merge; val: Merge }[] = [];
    if (lay.byColumn) {
      const cat = lay.headCol ? { c1, r1: lay.dr1, c2: c1, r2 } : undefined;
      const start = ch.type === 'scatter' ? lay.dc1 + 1 : lay.dc1;
      const xs = { c1: lay.dc1, r1: lay.dr1, c2: lay.dc1, r2 };
      for (let c = start; c <= c2; c++) series.push({ name: lay.headRow ? { c1: c, r1, c2: c, r2: r1 } : undefined, cat: ch.type === 'scatter' ? xs : cat, val: { c1: c, r1: lay.dr1, c2: c, r2 } });
    } else {
      const cat = lay.headRow ? { c1: lay.dc1, r1, c2, r2: r1 } : undefined;
      for (let r = lay.dr1; r <= r2; r++) series.push({ name: lay.headCol ? { c1, r1: r, c2: c1, r2: r } : undefined, cat, val: { c1: lay.dc1, r1: r, c2, r2: r } });
    }
    const round = ch.type === 'pie' || ch.type === 'doughnut';
    const fill = (i: number) => `<a:solidFill><a:srgbClr val="${palette[i % palette.length] ?? '4472C4'}"/></a:solidFill>`;
    const sers = series.map((s, i) => {
      const tx = s.name ? `<c:tx><c:strRef><c:f>${ref(s.name)}</c:f>${strCache(line(s.name))}</c:strRef></c:tx>` : '';
      const sp = round ? '' : ch.type === 'line' || ch.type === 'scatter' ? `<c:spPr><a:ln w="28575" cap="rnd">${fill(i)}<a:round/></a:ln></c:spPr>` : `<c:spPr>${fill(i)}</c:spPr>`;
      const pts = round ? line(s.val).map((_, j) => `<c:dPt><c:idx val="${j}"/><c:bubble3D val="0"/><c:spPr>${fill(j)}<a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`).join('') : '';
      const marker = ch.type === 'scatter' ? `<c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr>${fill(i)}</c:spPr></c:marker>` : ch.type === 'line' ? '<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>' : '';
      const cat = s.cat ? (ch.type === 'scatter'
        ? `<c:xVal><c:numRef><c:f>${ref(s.cat)}</c:f>${numCache(line(s.cat))}</c:numRef></c:xVal>`
        : `<c:cat><c:strRef><c:f>${ref(s.cat)}</c:f>${strCache(line(s.cat))}</c:strRef></c:cat>`) : '';
      const val = ch.type === 'scatter'
        ? `<c:yVal><c:numRef><c:f>${ref(s.val)}</c:f>${numCache(line(s.val))}</c:numRef></c:yVal><c:smooth val="0"/>`
        : `<c:val><c:numRef><c:f>${ref(s.val)}</c:f>${numCache(line(s.val))}</c:numRef></c:val>${ch.type === 'line' ? '<c:smooth val="0"/>' : ''}`;
      return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}${sp}${marker}${pts}${cat}${val}</c:ser>`;
    }).join('');
    const labels = ch.labels ? `<c:dLbls><c:showLegendKey val="0"/><c:showVal val="${round ? 0 : 1}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${round ? 1 : 0}"/><c:showBubbleSize val="0"/></c:dLbls>` : '';
    const axes = '<c:axId val="111111111"/><c:axId val="222222222"/>';
    const catAx = ch.type === 'scatter'
      ? '<c:valAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="222222222"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>'
      : `<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="${ch.type === 'bar' ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${ch.type === 'bar' ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="222222222"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
    const valAx = `<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${ch.type === 'bar' ? 'b' : 'l'}"/><c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="111111111"/><c:crosses val="${ch.type === 'bar' ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>`;
    let plot: string;
    switch (ch.type) {
      case 'column': case 'bar': case 'stacked':
        plot = `<c:barChart><c:barDir val="${ch.type === 'bar' ? 'bar' : 'col'}"/><c:grouping val="${ch.type === 'stacked' ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${sers}${labels}<c:gapWidth val="150"/>${ch.type === 'stacked' ? '<c:overlap val="100"/>' : ''}${axes}</c:barChart>${catAx}${valAx}`; break;
      case 'line': plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}${labels}<c:marker val="1"/>${axes}</c:lineChart>${catAx}${valAx}`; break;
      case 'area': plot = `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}${labels}${axes}</c:areaChart>${catAx}${valAx}`; break;
      case 'pie': plot = `<c:pieChart><c:varyColors val="1"/>${sers}${labels}<c:firstSliceAng val="0"/></c:pieChart>`; break;
      case 'doughnut': plot = `<c:doughnutChart><c:varyColors val="1"/>${sers}${labels}<c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`; break;
      case 'scatter': plot = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${sers.replace(/<c:spPr><a:ln w="28575" cap="rnd">.*?<\/a:ln><\/c:spPr>/g, '<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr>')}${labels}${axes}</c:scatterChart>${catAx}${valAx}`; break;
    }
    const title = ch.title
      ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="0"/></a:pPr><a:r><a:rPr lang="en-US" sz="1400" b="0"/><a:t>${esc(clean(ch.title))}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
      : '<c:autoTitleDeleted val="1"/>';
    const legend = ch.legend ?? true ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : '';
    return `${XML_HEAD}<c:chartSpace xmlns:c="${C_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}"><c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/>${plot}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
  };

  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s, i)));

  zip.file('[Content_Types].xml', `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}${contentOverrides.join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.file('_rels/.rels', `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="${R_NS}/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.file('docProps/app.xml', `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Office In 1 Class</Application></Properties>`);
  zip.file('xl/workbook.xml', `${XML_HEAD}<workbook xmlns="${NS}" xmlns:r="${R_NS}"><bookViews><workbookView/></bookViews><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${definedNames.length ? `<definedNames>${definedNames.join('')}</definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${R_NS}/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', `${XML_HEAD}<styleSheet xmlns="${NS}">${numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.join('')}</numFmts>` : ''}<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>${dxfs.length ? `<dxfs count="${dxfs.length}">${dxfs.join('')}</dxfs>` : '<dxfs count="0"/>'}</styleSheet>`);
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

// ---------- reading ----------


// ---------- data validation ----------

const V_TYPE: Record<string, string> = { whole: 'whole', decimal: 'decimal', list: 'list', date: 'date', time: 'time', length: 'textLength', custom: 'custom' };
const V_OP: Record<string, string> = { between: 'between', notBetween: 'notBetween', eq: 'equal', ne: 'notEqual', gt: 'greaterThan', lt: 'lessThan', ge: 'greaterThanOrEqual', le: 'lessThanOrEqual' };
/** A rule's bound as Excel writes it: a number (dates as serials, times as fractions of a day) or a reference. */
function boundXml(text: string | undefined, kind: string): string {
  const s = (text ?? '').trim().replace(/^=/, '');
  if (!s) return '';
  const tm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (tm) return String((Number(tm[1]) * 3600 + Number(tm[2]) * 60 + Number(tm[3] ?? 0)) / 86400);
  const d = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return String(Math.round((Date.UTC(+d[1], +d[2] - 1, +d[3]) - Date.UTC(1899, 11, 30)) / 86400000));
  if (kind === 'custom') return s;
  return s.replace(',', '.');
}
function validationsXml(sheet: SheetData): string {
  const list = (sheet.validations ?? []).filter(v => v.kind !== 'any' || v.prompt?.text);
  if (!list.length) return '';
  const body = list.map(v => {
    const sq = v.range.c1 === v.range.c2 && v.range.r1 === v.range.r2 ? cellName(v.range.c1, v.range.r1) : `${cellName(v.range.c1, v.range.r1)}:${cellName(v.range.c2, v.range.r2)}`;
    const attrs = [
      v.kind !== 'any' ? ` type="${V_TYPE[v.kind]}"` : '',
      v.error && v.error.style !== 'stop' ? ` errorStyle="${v.error.style === 'info' ? 'information' : 'warning'}"` : '',
      v.kind !== 'any' && v.kind !== 'list' && v.kind !== 'custom' && v.op !== 'between' ? ` operator="${V_OP[v.op]}"` : '',
      v.ignoreBlank ? ' allowBlank="1"' : '',
      v.kind === 'list' && v.dropdown === false ? ' showDropDown="1"' : '', // Excel's attribute means "hide the arrow"
      v.prompt?.text ? ` showInputMessage="1" promptTitle="${esc(v.prompt.title)}" prompt="${esc(v.prompt.text)}"` : '',
      ` showErrorMessage="1"${v.error?.title ? ` errorTitle="${esc(v.error.title)}"` : ''}${v.error?.text ? ` error="${esc(v.error.text)}"` : ''}`,
    ].join('');
    let f = '';
    if (v.kind === 'list') {
      const src = (v.list ?? '').trim();
      f = `<formula1>${esc(src.startsWith('=') ? src.slice(1) : `"${src.split(/[;,]/).map(x => x.trim()).filter(Boolean).join(',').replace(/"/g, '""')}"`)}</formula1>`;
    } else if (v.kind !== 'any') {
      f = `<formula1>${esc(boundXml(v.a, v.kind))}</formula1>`;
      if (v.kind !== 'custom' && (v.op === 'between' || v.op === 'notBetween')) f += `<formula2>${esc(boundXml(v.b, v.kind))}</formula2>`;
    }
    return `<dataValidation${attrs} sqref="${sq}">${f}</dataValidation>`;
  });
  return `<dataValidations count="${body.length}">${body.join('')}</dataValidations>`;
}

const kids = (el: Element | null | undefined, name: string) => (el ? Array.from(el.children).filter(c => c.localName === name) : []);
const kid = (el: Element | null | undefined, name: string) => kids(el, name)[0] ?? null;
const deep = (el: Element | Document | null | undefined, name: string) => (el ? Array.from(el.getElementsByTagName('*')).filter(c => c.localName === name) : []);
const textOf = (el: Element | null) => (el ? Array.from(el.getElementsByTagNameNS(NS, 't')).map(t => t.textContent ?? '').join('') : '');
const on = (el: Element | null) => !!el && el.getAttribute('val') !== '0' && el.getAttribute('val') !== 'false';

const argb = (el: Element | null): string | undefined => {
  const v = el?.getAttribute('rgb');
  return v && /^[0-9A-F]{8}$/i.test(v) ? `#${v.slice(2).toUpperCase()}` : v && /^[0-9A-F]{6}$/i.test(v) ? `#${v.toUpperCase()}` : undefined;
};
const rangeOf = (ref: string): Merge | null => {
  const [a, b] = ref.replace(/\$/g, '').split(':').map(parseCell);
  if (!a) return null;
  const e = b ?? a;
  return { c1: Math.min(a.c, e.c), r1: Math.min(a.r, e.r), c2: Math.max(a.c, e.c), r2: Math.max(a.r, e.r) };
};

/** Reads an .xlsx file: every sheet, with values, formulas, sizes, formatting, merges, filters, rules and charts. */
export async function readXlsx(data: ArrayBuffer): Promise<WorkbookData> {
  const zip = await JSZip.loadAsync(data);
  const xml = async (path: string) => {
    const f = zip.file(path.replace(/^\//, ''));
    return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null;
  };
  const resolve = (base: string, target: string) => (target.startsWith('/') ? target.slice(1) : `${base}${target}`).replace(/[^/]+\/\.\.\//g, '');
  const relsOf = async (part: string) => {
    const dir = part.slice(0, part.lastIndexOf('/') + 1);
    const doc = await xml(`${dir}_rels/${part.slice(dir.length)}.rels`);
    return new Map(Array.from(doc?.getElementsByTagName('Relationship') ?? []).map(r => [r.getAttribute('Id'), resolve(dir, r.getAttribute('Target') ?? '')]));
  };

  const wb = await xml('xl/workbook.xml');
  if (!wb) throw new Error('Not an Excel workbook');
  const relTarget = await relsOf('xl/workbook.xml');

  const shared = await xml('xl/sharedStrings.xml');
  const strings = kids(shared?.documentElement, 'si').map(si => textOf(si));

  const styles = await xml('xl/styles.xml');
  const sroot = styles?.documentElement;
  const codes = new Map(kids(kid(sroot, 'numFmts'), 'numFmt').map(n => [Number(n.getAttribute('numFmtId')), n.getAttribute('formatCode') ?? '']));
  const fonts = kids(kid(sroot, 'fonts'), 'font').map(f => ({
    bold: on(kid(f, 'b')), italic: on(kid(f, 'i')), strike: on(kid(f, 'strike')),
    underline: !!kid(f, 'u') && kid(f, 'u')!.getAttribute('val') !== 'none',
    color: argb(kid(f, 'color')),
    name: kid(f, 'name')?.getAttribute('val') ?? undefined,
    size: Number(kid(f, 'sz')?.getAttribute('val')) || undefined,
  }));
  const defaultFont = fonts[0];
  const fills = kids(kid(sroot, 'fills'), 'fill').map(f => {
    const p = kid(f, 'patternFill');
    return p?.getAttribute('patternType') === 'solid' ? argb(kid(p, 'fgColor')) : undefined;
  });
  const lineOf = (el: Element | null): BorderLine | undefined => {
    const s = el?.getAttribute('style');
    if (!s || s === 'none') return undefined;
    const style: BorderLine['style'] = s === 'medium' || s === 'mediumDashed' ? 'medium' : s === 'thick' ? 'thick' : s === 'double' ? 'double' : /dash|dot/i.test(s) ? 'dashed' : 'thin';
    const color = argb(kid(el, 'color'));
    return color && color !== '#000000' ? { style, color } : { style };
  };
  const borderList = kids(kid(sroot, 'borders'), 'border').map(b => {
    const out: NonNullable<CellStyle['borders']> = {};
    for (const side of ['top', 'right', 'bottom', 'left'] as const) { const l = lineOf(kid(b, side)); if (l) out[side] = l; }
    return Object.keys(out).length ? out : undefined;
  });
  const xfStyles: (CellStyle | undefined)[] = kids(kid(sroot, 'cellXfs'), 'xf').map(xf => {
    const font = fonts[Number(xf.getAttribute('fontId') ?? 0)];
    const st: CellStyle = {};
    if (font?.bold) st.bold = true;
    if (font?.italic) st.italic = true;
    if (font?.underline) st.underline = true;
    if (font?.strike) st.strike = true;
    if (font?.color && font.color !== '#000000') st.color = font.color;
    if (font?.name && font.name !== (defaultFont?.name ?? 'Calibri') && font.name !== 'Calibri') st.font = font.name;
    if (font?.size && font.size !== (defaultFont?.size ?? 11)) st.size = font.size;
    const fill = fills[Number(xf.getAttribute('fillId') ?? 0)];
    if (fill) st.fill = fill;
    const borders = borderList[Number(xf.getAttribute('borderId') ?? 0)];
    if (borders) st.borders = borders;
    const id = Number(xf.getAttribute('numFmtId') ?? 0);
    Object.assign(st, styleFromCode(id, codes.get(id)));
    const al = kid(xf, 'alignment');
    const h = al?.getAttribute('horizontal');
    if (h === 'left' || h === 'center' || h === 'right') st.align = h;
    const v = al?.getAttribute('vertical');
    if (v === 'top' || v === 'bottom') st.valign = v;
    else if (v === 'center') st.valign = 'middle';
    if (al?.getAttribute('wrapText') === '1' || al?.getAttribute('wrapText') === 'true') st.wrap = true;
    const indent = Number(al?.getAttribute('indent'));
    if (indent > 0) st.indent = indent;
    return Object.keys(st).length ? st : undefined;
  });
  const dxfs = kids(kid(sroot, 'dxfs'), 'dxf').map(d => ({
    color: argb(kid(kid(d, 'font'), 'color')),
    fill: argb(kid(kid(kid(d, 'fill'), 'patternFill'), 'bgColor')) ?? argb(kid(kid(kid(d, 'fill'), 'patternFill'), 'fgColor')),
  }));
  let currency: string | undefined;
  for (const code of codes.values()) {
    if (code.includes('€')) currency = 'EUR';
    else if (code.includes('£')) currency = 'GBP';
    else if (/"\$"|\[\$\$/.test(code)) currency = 'USD';
  }

  const book: WorkbookData = { sheets: [], currency };
  const chartsToRead: { sheet: SheetData; doc: Document; anchor: Element; path: string }[] = [];
  for (const sh of Array.from(wb.getElementsByTagNameNS(NS, 'sheet'))) {
    const rid = sh.getAttributeNS(R_NS, 'id') ?? sh.getAttribute('r:id');
    const target = relTarget.get(rid);
    if (!target) continue;
    const doc = await xml(target);
    if (!doc) continue;
    const root = doc.documentElement;
    const sheet: SheetData = { name: sh.getAttribute('name') ?? `Sheet${book.sheets.length + 1}`, cells: {}, widths: {} };
    for (const col of Array.from(doc.getElementsByTagNameNS(NS, 'col'))) {
      const w = Number(col.getAttribute('width'));
      if (!w || col.getAttribute('customWidth') !== '1') continue;
      const min = Number(col.getAttribute('min')), max = Math.min(Number(col.getAttribute('max')), min + 200);
      for (let c = min; c <= max; c++) sheet.widths[c - 1] = Math.round(w * PX_PER_CHAR + 5);
    }
    const hiddenRows = new Set<number>();
    for (const row of Array.from(doc.getElementsByTagNameNS(NS, 'row'))) {
      const r = Number(row.getAttribute('r')) - 1;
      if (r < 0) continue;
      const ht = Number(row.getAttribute('ht'));
      if (ht && row.getAttribute('customHeight') === '1' && Math.abs(ht / PT_PER_PX - DEFAULT_ROW_PX) > 1) (sheet.heights ??= {})[r] = Math.round(ht / PT_PER_PX);
      if (row.getAttribute('hidden') === '1') hiddenRows.add(r);
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
      else input = v;
      if (!input && !style) continue;
      // Text that looks like a number or formula stays text.
      const keepText = (type === 's' || type === 'inlineStr' || type === 'str') && !f && (typeof literal(input) !== 'string' || input.startsWith('='));
      sheet.cells[key(at.c, at.r)] = { input, ...(style || keepText ? { style: keepText ? { ...style, format: 'text' as NumberFormat } : style } : {}) };
    }
    // Merged cells, frozen panes, grid lines and tab color.
    const merges = kids(kid(root, 'mergeCells'), 'mergeCell').map(m => rangeOf(m.getAttribute('ref') ?? '')).filter((m): m is Merge => !!m && (m.c1 !== m.c2 || m.r1 !== m.r2));
    if (merges.length) sheet.merges = merges;
    const view = kid(kid(root, 'sheetViews'), 'sheetView');
    if (view?.getAttribute('showGridLines') === '0' || view?.getAttribute('showGridLines') === 'false') sheet.noGrid = true;
    const pane = kid(view, 'pane');
    if (pane && (pane.getAttribute('state') === 'frozen' || pane.getAttribute('state') === 'frozenSplit')) {
      const fc = Math.round(Number(pane.getAttribute('xSplit') ?? 0)), fr = Math.round(Number(pane.getAttribute('ySplit') ?? 0));
      if (fc || fr) sheet.freeze = { c: fc, r: fr };
    }
    const tab = argb(kid(kid(root, 'sheetPr'), 'tabColor'));
    if (tab) sheet.tabColor = tab;
    const print = readPrint(root);
    if (print) sheet.print = print;
    // The AutoFilter: values hidden in each column are those of hidden rows that the filter does not list.
    const af = kid(root, 'autoFilter');
    const afRange = af ? rangeOf(af.getAttribute('ref') ?? '') : null;
    if (af && afRange) {
      const hidden: Record<number, string[]> = {};
      for (const fcol of kids(af, 'filterColumn')) {
        const c = afRange.c1 + Number(fcol.getAttribute('colId') ?? 0);
        const filters = kid(fcol, 'filters');
        if (!filters) continue;
        const shown = new Set(kids(filters, 'filter').map(x => x.getAttribute('val') ?? ''));
        if (filters.getAttribute('blank') === '1') shown.add('');
        const off = new Set<string>();
        for (let r = afRange.r1 + 1; r <= afRange.r2; r++) {
          const text = sheet.cells[key(c, r)]?.input ?? '';
          if (!shown.has(text) && hiddenRows.has(r)) off.add(text);
        }
        if (off.size) hidden[c] = [...off];
      }
      sheet.filter = { range: afRange, hidden };
    }
    // Data validation rules.
    const vals: Validation[] = [];
    const KIND: Record<string, VKind> = { whole: 'whole', decimal: 'decimal', list: 'list', date: 'date', time: 'time', textLength: 'length', custom: 'custom' };
    const OP: Record<string, VOp> = { between: 'between', notBetween: 'notBetween', equal: 'eq', notEqual: 'ne', greaterThan: 'gt', lessThan: 'lt', greaterThanOrEqual: 'ge', lessThanOrEqual: 'le' };
    for (const dv of kids(kid(root, 'dataValidations'), 'dataValidation')) {
      const kind = KIND[dv.getAttribute('type') ?? ''] ?? 'any';
      const f1 = (kid(dv, 'formula1')?.textContent ?? '').trim(), f2 = (kid(dv, 'formula2')?.textContent ?? '').trim();
      const asText = (f: string) => {
        if (kind === 'date' && /^\d+(\.\d+)?$/.test(f)) return new Date(Date.UTC(1899, 11, 30) + Math.round(Number(f)) * 86400000).toISOString().slice(0, 10);
        if (kind === 'time' && /^0?\.\d+$/.test(f)) { const m = Math.round(Number(f) * 1440); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
        return /^\$?[A-Z]{1,3}\$?\d+$/i.test(f) ? `=${f}` : f;
      };
      const style = dv.getAttribute('errorStyle');
      const prompt = dv.getAttribute('prompt');
      const errText = dv.getAttribute('error'), errTitle = dv.getAttribute('errorTitle');
      for (const ref of (dv.getAttribute('sqref') ?? '').split(/\s+/)) {
        const range = rangeOf(ref);
        if (!range) continue;
        vals.push({
          id: `xv${vals.length}`, range, kind, op: OP[dv.getAttribute('operator') ?? 'between'] ?? 'between',
          a: kind === 'custom' ? `=${f1}` : asText(f1), ...(f2 ? { b: asText(f2) } : {}),
          ...(kind === 'list' ? { list: f1.startsWith('"') ? f1.slice(1, -1).replace(/""/g, '"').split(',').map(x => x.trim()).join(', ') : `=${f1}`, dropdown: dv.getAttribute('showDropDown') !== '1' } : {}),
          ignoreBlank: dv.getAttribute('allowBlank') === '1',
          ...(prompt ? { prompt: { title: dv.getAttribute('promptTitle') ?? '', text: prompt } } : {}),
          ...(style || errText || errTitle ? { error: { style: style === 'information' ? 'info' : style === 'warning' ? 'warning' : 'stop', title: errTitle ?? '', text: errText ?? '' } } : {}),
        });
      }
    }
    if (vals.length) sheet.validations = vals;
    // Conditional formatting that OI1 can show.
    const rules: CondRule[] = [];
    for (const cf of kids(root, 'conditionalFormatting')) {
      const range = rangeOf((cf.getAttribute('sqref') ?? '').split(' ')[0]);
      if (!range) continue;
      for (const rule of kids(cf, 'cfRule')) {
        const look = dxfs[Number(rule.getAttribute('dxfId') ?? -1)] ?? {};
        const formulas = kids(rule, 'formula').map(x => (x.textContent ?? '').replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));
        const base = { id: `x${rules.length}`, range, ...(look.fill ? { fill: look.fill } : {}), ...(look.color ? { color: look.color } : {}) };
        const type = rule.getAttribute('type');
        const op = rule.getAttribute('operator');
        if (type === 'cellIs' && (op === 'greaterThan' || op === 'lessThan' || op === 'equal' || op === 'between')) {
          rules.push({ ...base, kind: op === 'greaterThan' ? 'greater' : op === 'lessThan' ? 'less' : op === 'equal' ? 'equal' : 'between', a: formulas[0], ...(op === 'between' ? { b: formulas[1] } : {}) });
        } else if (type === 'containsText') rules.push({ ...base, kind: 'contains', a: rule.getAttribute('text') ?? '' });
        else if (type === 'duplicateValues') rules.push({ ...base, kind: 'duplicate' });
        else if (type === 'top10') rules.push({ ...base, kind: rule.getAttribute('bottom') === '1' ? 'bottom' : 'top', a: rule.getAttribute('rank') ?? '10' });
        else if (type === 'aboveAverage') rules.push({ ...base, kind: rule.getAttribute('aboveAverage') === '0' ? 'belowAverage' : 'aboveAverage' });
        else if (type === 'colorScale') {
          const cols = kids(kid(rule, 'colorScale'), 'color').map(argb).filter((x): x is string => !!x);
          if (cols.length >= 2) rules.push({ id: base.id, range, kind: 'scale', colors: cols.length === 3 ? [cols[0], cols[2], cols[1]] : [cols[0], cols[1]] });
        } else if (type === 'dataBar') {
          const col = argb(kid(kid(rule, 'dataBar'), 'color')) ?? '#638EC6';
          rules.push({ id: base.id, range, kind: 'bars', fill: col });
        }
      }
    }
    if (rules.length) sheet.rules = rules;
    // Charts sit in the sheet's drawing.
    const drawingRid = kid(root, 'drawing')?.getAttributeNS(R_NS, 'id') ?? kid(root, 'drawing')?.getAttribute('r:id');
    if (drawingRid) {
      const path = (await relsOf(target)).get(drawingRid);
      const ddoc = path ? await xml(path) : null;
      if (path && ddoc) for (const anchor of Array.from(ddoc.documentElement.children)) chartsToRead.push({ sheet, doc: ddoc, anchor, path });
    }
    book.sheets.push(sheet);
  }
  // Print areas and print titles are workbook names tied to a sheet.
  const wbSheets = Array.from(wb.getElementsByTagNameNS(NS, 'sheet')).map(sh => book.sheets.find(s => s.name === sh.getAttribute('name')));
  for (const dn of Array.from(wb.getElementsByTagNameNS(NS, 'definedName'))) {
    const name = dn.getAttribute('name') ?? '';
    const target = wbSheets[Number(dn.getAttribute('localSheetId') ?? -1)];
    if (target && (name === '_xlnm.Print_Area' || name === '_xlnm.Print_Titles')) target.print = applyPrintName(target.print ?? {}, name, dn.textContent ?? '');
  }
  if (!book.sheets.length) book.sheets.push({ name: 'Sheet1', cells: {}, widths: {} });

  // Charts last, so their ranges can point at any sheet and their places can use row and column sizes.
  for (const { sheet, anchor, path } of chartsToRead) {
    const ch = await readChart(anchor, path, sheet, relsOf, xml);
    if (ch) sheet.charts = [...(sheet.charts ?? []), ch];
  }
  return book;
}

async function readChart(anchor: Element, drawingPath: string, sheet: SheetData,
  relsOf: (p: string) => Promise<Map<string | null, string>>, xml: (p: string) => Promise<Document | null>): Promise<Chart | null> {
  const chartRef = deep(anchor, 'chart')[0];
  const rid = chartRef?.getAttributeNS(R_NS, 'id') ?? chartRef?.getAttribute('r:id');
  if (!rid) return null;
  const path = (await relsOf(drawingPath)).get(rid);
  const doc = path ? await xml(path) : null;
  if (!doc) return null;
  // Place and size: absolute, or from the cells the chart is anchored to.
  const colX = (c: number) => { let x = 0; for (let i = 0; i < c; i++) x += sheet.widths[i] ?? 104; return x; };
  const rowY = (r: number) => { let y = 0; for (let i = 0; i < r; i++) y += sheet.heights?.[i] ?? DEFAULT_ROW_PX; return y; };
  const point = (el: Element | null) => {
    if (!el) return null;
    const n = (name: string) => Number(kid(el, name)?.textContent ?? 0);
    return { x: colX(n('col')) + n('colOff') / EMU_PER_PX, y: rowY(n('row')) + n('rowOff') / EMU_PER_PX };
  };
  let x = 0, y = 0, w = 480, h = 290;
  const pos = kid(anchor, 'pos'), ext = kid(anchor, 'ext');
  const from = point(kid(anchor, 'from')), to = point(kid(anchor, 'to'));
  if (pos) { x = Number(pos.getAttribute('x')) / EMU_PER_PX; y = Number(pos.getAttribute('y')) / EMU_PER_PX; }
  else if (from) { x = from.x; y = from.y; }
  if (ext) { w = Number(ext.getAttribute('cx')) / EMU_PER_PX || w; h = Number(ext.getAttribute('cy')) / EMU_PER_PX || h; }
  else if (from && to) { w = Math.max(120, to.x - from.x); h = Math.max(80, to.y - from.y); }

  const plot = deep(doc, 'plotArea')[0];
  if (!plot) return null;
  const kinds: Record<string, Chart['type']> = { barChart: 'column', bar3DChart: 'column', lineChart: 'line', line3DChart: 'line', areaChart: 'area', area3DChart: 'area', pieChart: 'pie', pie3DChart: 'pie', doughnutChart: 'doughnut', scatterChart: 'scatter' };
  const group = Array.from(plot.children).find(c => kinds[c.localName]);
  if (!group) return null;
  let type = kinds[group.localName];
  if (type === 'column') {
    if (kid(group, 'barDir')?.getAttribute('val') === 'bar') type = 'bar';
    if (/stacked/i.test(kid(group, 'grouping')?.getAttribute('val') ?? '')) type = 'stacked';
  }
  // The range is the box around every reference the series use.
  const refs = deep(group, 'f').map(f => (f.textContent ?? '').replace(/^.*!/, '')).map(rangeOf).filter((b): b is Merge => !!b);
  if (!refs.length) return null;
  const range = refs.reduce((a, b) => ({ c1: Math.min(a.c1, b.c1), r1: Math.min(a.r1, b.r1), c2: Math.max(a.c2, b.c2), r2: Math.max(a.r2, b.r2) }));
  const firstVal = deep(kids(group, 'ser')[0], 'val')[0] ?? deep(kids(group, 'ser')[0], 'yVal')[0];
  const vref = firstVal ? rangeOf((deep(firstVal, 'f')[0]?.textContent ?? '').replace(/^.*!/, '')) : null;
  const titleEl = kid(deep(doc, 'chart')[0], 'title');
  const title = titleEl ? deep(titleEl, 't').map(t => t.textContent ?? '').join('') || deep(titleEl, 'v').map(t => t.textContent ?? '').join('') : '';
  const chart: Chart = { id: `x${Math.random().toString(36).slice(2, 8)}`, type, range, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  if (title) chart.title = title;
  if (vref && type !== 'scatter') chart.byColumn = vref.c1 === vref.c2 && vref.r2 > vref.r1 ? true : vref.r1 === vref.r2 && vref.c2 > vref.c1 ? false : undefined;
  if (chart.byColumn === undefined) delete chart.byColumn;
  if (!kid(deep(doc, 'chart')[0], 'legend')) chart.legend = false;
  if (deep(group, 'dLbls').some(d => on(kid(d, 'showVal')) || on(kid(d, 'showPercent')))) chart.labels = true;
  return chart;
}
