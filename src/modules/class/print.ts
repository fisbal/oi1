// Printing a sheet (and saving it as PDF from the print window): the used area as an HTML table with its
// formatting, merged cells and conditional colors, then the charts as pictures.

import type { Scalar } from '../../formats/formula';
import { display, key, naturalAlign, usedRange, type BorderLine, type SheetData } from '../../formats/sheet';
import { cssFont } from '../letter/model';
import type { CondLook } from './cond';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const borderCss = (b?: BorderLine) =>
  !b ? '' : `${b.style === 'medium' ? 2 : b.style === 'thick' || b.style === 'double' ? 3 : 1}px ${b.style === 'double' ? 'double' : b.style === 'dashed' ? 'dashed' : 'solid'} ${b.color ?? '#000'}`;

export function sheetHtml(sheet: SheetData, values: Map<string, Scalar>, looks: Map<string, CondLook>, lang: string, currency: string,
  charts: string[], hidden: Set<number>): string {
  const u = usedRange(sheet);
  const covered = new Set<string>();
  const spans = new Map<string, { cs: number; rs: number }>();
  for (const m of sheet.merges ?? []) {
    spans.set(key(m.c1, m.r1), { cs: m.c2 - m.c1 + 1, rs: m.r2 - m.r1 + 1 });
    for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) if (c !== m.c1 || r !== m.r1) covered.add(key(c, r));
  }
  const cols = Array.from({ length: u.cols + 1 }, (_, c) => `<col style="width:${sheet.widths[c] ?? 104}px">`).join('');
  const grid = !sheet.noGrid;
  let rows = '';
  for (let r = 0; r <= u.rows; r++) {
    if (hidden.has(r)) continue;
    let tds = '';
    for (let c = 0; c <= u.cols; c++) {
      const k = key(c, r);
      if (covered.has(k)) continue;
      const cell = sheet.cells[k];
      const st = cell?.style;
      const v = values.get(k) ?? '';
      const look = looks.get(k);
      const css: string[] = [`text-align:${st?.align ?? naturalAlign(v)}`];
      if (st?.valign) css.push(`vertical-align:${st.valign === 'middle' ? 'middle' : st.valign}`);
      if (st?.bold) css.push('font-weight:700');
      if (st?.italic) css.push('font-style:italic');
      const deco = [st?.underline && 'underline', st?.strike && 'line-through'].filter(Boolean).join(' ');
      if (deco) css.push(`text-decoration:${deco}`);
      if (look?.color ?? st?.color) css.push(`color:${look?.color ?? st?.color}`);
      if (look?.fill ?? st?.fill) css.push(`background:${look?.fill ?? st?.fill}`);
      if (st?.font) css.push(`font-family:${cssFont(st.font).replace(/"/g, "'")}`);
      if (st?.size) css.push(`font-size:${st.size}pt`);
      if (st?.wrap) css.push('white-space:pre-wrap');
      if (st?.indent) css.push(`padding-left:${4 + st.indent * 9}px`);
      for (const side of ['top', 'right', 'bottom', 'left'] as const) { const b = borderCss(st?.borders?.[side]); if (b) css.push(`border-${side}:${b}`); }
      const span = spans.get(k);
      const attrs = span ? `${span.cs > 1 ? ` colspan="${span.cs}"` : ''}${span.rs > 1 ? ` rowspan="${span.rs}"` : ''}` : '';
      const text = cell ? display(v, st, lang, currency) : '';
      const bar = look?.bar ? `<i style="position:absolute;left:1px;top:3px;bottom:3px;width:${Math.round(look.bar.pct * 100)}%;background:${look.bar.color};opacity:.55"></i>` : '';
      tds += `<td${attrs} style="${css.join(';')}">${bar}<span>${esc(text)}</span></td>`;
    }
    const h = sheet.heights?.[r];
    rows += `<tr${h ? ` style="height:${h}px"` : ''}>${tds}</tr>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sheet.name)}</title><style>
@page { margin: 14mm; }
body { margin: 0; font: 11pt Calibri, Carlito, Arial, sans-serif; color: #000; }
table { border-collapse: collapse; table-layout: fixed; }
td { position: relative; padding: 2px 5px; white-space: nowrap; overflow: hidden; vertical-align: bottom; ${grid ? 'border: 1px solid #d4d4d4;' : ''} }
td span { position: relative; }
img { display: block; margin: 14px 0; max-width: 100%; page-break-inside: avoid; }
</style></head><body><table>${cols}${rows}</table>${charts.map(src => `<img src="${src}">`).join('')}</body></html>`;
}

/** Prints an HTML page through a hidden frame, so the app itself is not printed. */
export function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  const go = () => {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    window.setTimeout(() => frame.remove(), 1000);
  };
  const imgs = Array.from(doc.images);
  if (!imgs.length) window.setTimeout(go, 50);
  else void Promise.all(imgs.map(i => i.decode().catch(() => {}))).then(go);
}
