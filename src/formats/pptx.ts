// PowerPoint .pptx for Office Stage: writing a deck as a real presentation (theme, slide master and layouts,
// slides with placeholders, shapes, pictures, tables, speaker notes and transitions) and reading one back,
// including files made by PowerPoint, Keynote or Google Slides (placeholders that take their place and look
// from the layout and master, theme colors, groups, tables, pictures and notes).
// A file written here carries "OI1 <theme id>" as its theme name, so Stage gets its own theme back exactly.

import JSZip from 'jszip';
import {
  GEOMS, THEMES, cssBackground, defaultSize, htmlText, layoutBox, layoutRoles, newId, themeById,
  type Background, type Deck, type DeckTheme, type Geom, type Item, type LayoutId, type Role, type ShapeItem, type Slide, type Stroke, type Transition,
} from './slides';

export const PPTX_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const EMU = 9525;
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NSS = `xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"`;
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT = 'application/vnd.openxmlformats-officedocument.presentationml';

const e = (n: number) => Math.round(n * EMU);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex = (c: string) => {
  const m = c.trim().match(/^#?([0-9a-f]{6})$/i);
  if (m) return m[1].toUpperCase();
  const s = c.trim().match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (s) return `${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toUpperCase();
  const r = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (r) return [r[1], r[2], r[3]].map(v => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  return '000000';
};
const solid = (c: string, alpha?: number) => `<a:solidFill><a:srgbClr val="${hex(c)}">${alpha !== undefined && alpha < 1 ? `<a:alpha val="${Math.round(alpha * 100000)}"/>` : ''}</a:srgbClr></a:solidFill>`;
function shadeHex(c: string, k: number) {
  const n = parseInt(hex(c), 16);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)))).map(v => v.toString(16).padStart(2, '0')).join('');
}
const lum = (c: string) => { const n = parseInt(hex(c), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

// ======================================================================================
// Writing
// ======================================================================================

const LAYOUT_META: Record<LayoutId, { type: string; name: string }> = {
  title: { type: 'title', name: 'Title Slide' },
  content: { type: 'obj', name: 'Title and Content' },
  section: { type: 'secHead', name: 'Section Header' },
  two: { type: 'twoObj', name: 'Two Content' },
  titleOnly: { type: 'titleOnly', name: 'Title Only' },
  blank: { type: 'blank', name: 'Blank' },
};
const LAYOUT_ORDER: LayoutId[] = ['title', 'content', 'section', 'two', 'titleOnly', 'blank'];

function bgXml(b: Background) {
  if (b.to) {
    // CSS angles start at the top and turn clockwise; DrawingML starts at the left: 135deg (CSS) is 45deg there.
    const ang = (((b.angle ?? 135) - 90) % 360 + 360) % 360;
    return `<p:bg><p:bgPr><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="${hex(b.color)}"/></a:gs><a:gs pos="100000"><a:srgbClr val="${hex(b.to)}"/></a:gs></a:gsLst><a:lin ang="${ang * 60000}" scaled="0"/></a:gradFill><a:effectLst/></p:bgPr></p:bg>`;
  }
  return `<p:bg><p:bgPr>${solid(b.color)}<a:effectLst/></p:bgPr></p:bg>`;
}

const xfrm = (it: { x: number; y: number; w: number; h: number; rot?: number; flipH?: boolean; flipV?: boolean }, tag = 'a:xfrm') =>
  `<${tag}${it.rot ? ` rot="${Math.round(it.rot * 60000)}"` : ''}${it.flipH ? ' flipH="1"' : ''}${it.flipV ? ' flipV="1"' : ''}><a:off x="${e(it.x)}" y="${e(it.y)}"/><a:ext cx="${e(Math.max(0, it.w))}" cy="${e(Math.max(0, it.h))}"/></${tag}>`;

function lineXml(s: Stroke | null | undefined, arrow = false) {
  if (s === null) return '<a:ln><a:noFill/></a:ln>';
  if (!s) return '';
  const dash = s.dash === 'dash' ? '<a:prstDash val="dash"/>' : s.dash === 'dot' ? '<a:prstDash val="sysDot"/>' : '';
  return `<a:ln w="${Math.round(s.width * 12700)}">${solid(s.color)}${dash}${arrow ? '<a:tailEnd type="triangle" w="med" len="med"/>' : ''}</a:ln>`;
}

const groupProps = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

// ---------- text: editor HTML to DrawingML paragraphs ----------

interface RunStyle { b?: boolean; i?: boolean; u?: boolean; s?: boolean; sub?: boolean; sup?: boolean; color?: string; size?: number; font?: string; hl?: string }
interface Para { lvl: number; list: 'ul' | 'ol' | null; align?: string; runs: { text: string; st: RunStyle; br?: boolean }[] }

function styleOf(el: Element, st: RunStyle): RunStyle {
  const out = { ...st };
  const tag = el.tagName.toLowerCase();
  if (tag === 'strong' || tag === 'b') out.b = true;
  if (tag === 'em' || tag === 'i') out.i = true;
  if (tag === 'u') out.u = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') out.s = true;
  if (tag === 'sub') out.sub = true;
  if (tag === 'sup') out.sup = true;
  if (tag === 'mark') out.hl = el.getAttribute('data-color') ?? (el as HTMLElement).style?.backgroundColor ?? '#FFFF00';
  const css = el.getAttribute('style') ?? '';
  const color = css.match(/(?:^|;)\s*color:\s*([^;]+)/);
  if (color) out.color = color[1].trim();
  const size = css.match(/font-size:\s*([\d.]+)(pt|px)/);
  if (size) out.size = size[2] === 'px' ? parseFloat(size[1]) * 0.75 : parseFloat(size[1]);
  const font = css.match(/font-family:\s*([^;]+)/);
  if (font) out.font = font[1].split(',')[0].replace(/["']/g, '').trim();
  return out;
}

/** The paragraphs of editor HTML, with list levels and run styles. */
export function htmlParagraphs(html: string): Para[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out: Para[] = [];
  const inline = (node: Node, st: RunStyle, p: Para) => {
    if (node.nodeType === 3) { if (node.textContent) p.runs.push({ text: node.textContent, st }); return; }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.tagName === 'BR') { p.runs.push({ text: '', st, br: true }); return; }
    const next = styleOf(el, st);
    el.childNodes.forEach(c => inline(c, next, p));
  };
  const block = (node: Node, lvl: number, list: Para['list']) => {
    if (node.nodeType === 3) {
      if (node.textContent?.trim()) { const p: Para = { lvl, list, runs: [] }; inline(node, {}, p); out.push(p); }
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') { el.childNodes.forEach(c => block(c, list ? lvl + 1 : lvl, tag)); return; }
    if (tag === 'li') {
      let had = false;
      el.childNodes.forEach(c => {
        const t = c.nodeType === 1 ? (c as Element).tagName.toLowerCase() : '';
        if (t === 'ul' || t === 'ol') { (c as Element).childNodes.forEach(cc => block(cc, lvl + 1, t as 'ul' | 'ol')); return; }
        if (t === 'p' || /^h\d$/.test(t)) { if (!had) { block(c, lvl, list); had = true; } else block(c, lvl, null); return; }
        if (c.nodeType === 3 && !c.textContent?.trim()) return;
        const p: Para = { lvl, list, runs: [] }; inline(c, {}, p); out.push(p); had = true;
      });
      if (!had) out.push({ lvl, list, runs: [] });
      return;
    }
    if (tag === 'p' || /^h\d$/.test(tag) || tag === 'div') {
      const css = el.getAttribute('style') ?? '';
      const align = css.match(/text-align:\s*(left|center|right|justify)/)?.[1];
      const p: Para = { lvl, list, align, runs: [] };
      const base: RunStyle = /^h\d$/.test(tag) ? { b: true } : {};
      el.childNodes.forEach(c => inline(c, base, p));
      out.push(p);
      return;
    }
    const p: Para = { lvl, list, runs: [] };
    inline(el, {}, p);
    out.push(p);
  };
  doc.body.childNodes.forEach(n => block(n, 0, null));
  return out.length ? out : [{ lvl: 0, list: null, runs: [] }];
}

const ALGN: Record<string, string> = { left: 'l', center: 'ctr', right: 'r', justify: 'just' };

function rPr(st: RunStyle, lang: string, fallbackColor?: string) {
  const attrs = [`lang="${lang}"`];
  if (st.size) attrs.push(`sz="${Math.round(st.size * 100)}"`);
  if (st.b) attrs.push('b="1"');
  if (st.i) attrs.push('i="1"');
  if (st.u) attrs.push('u="sng"');
  if (st.s) attrs.push('strike="sngStrike"');
  if (st.sub) attrs.push('baseline="-25000"');
  if (st.sup) attrs.push('baseline="30000"');
  attrs.push('dirty="0"');
  const color = st.color ?? fallbackColor;
  const kids = `${color ? solid(color) : ''}${st.hl ? `<a:highlight><a:srgbClr val="${hex(st.hl)}"/></a:highlight>` : ''}${st.font ? `<a:latin typeface="${esc(st.font)}"/><a:cs typeface="${esc(st.font)}"/>` : ''}`;
  return `<a:rPr ${attrs.join(' ')}${kids ? `>${kids}</a:rPr>` : '/>'}`;
}

/** DrawingML paragraphs for a box. Placeholders take their bullets and sizes from the master; other boxes say it all. */
function parasXml(html: string, o: { role?: Role; lang: string; color?: string; align?: string; spacing?: number }) {
  const body = o.role === 'body' || o.role === 'body2';
  return htmlParagraphs(html).map(p => {
    const pp: string[] = [];
    const kids: string[] = [];
    if (p.lvl) pp.push(`lvl="${Math.min(8, p.lvl)}"`);
    const align = p.align ?? o.align;
    if (align && ALGN[align]) pp.push(`algn="${ALGN[align]}"`);
    if (o.spacing) kids.push(`<a:lnSpc><a:spcPct val="${Math.round(o.spacing * 100000)}"/></a:lnSpc>`);
    if (body) {
      if (!p.list) { pp.push('marL="0"', 'indent="0"'); kids.push('<a:buNone/>'); }
      else if (p.list === 'ol') kids.push('<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>');
    } else if (p.list) {
      const mar = 342900 + p.lvl * 285750;
      pp.push(`marL="${mar}"`, 'indent="-342900"');
      kids.push(p.list === 'ol' ? '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>' : '<a:buFont typeface="Arial"/><a:buChar char="•"/>');
    }
    const ppr = pp.length || kids.length ? `<a:pPr${pp.length ? ' ' + pp.join(' ') : ''}${kids.length ? `>${kids.join('')}</a:pPr>` : '/>'}` : '';
    const runs = p.runs.map(r => (r.br ? `<a:br>${rPr(r.st, o.lang, o.color)}</a:br>` : `<a:r>${rPr(r.st, o.lang, o.color)}<a:t>${esc(r.text)}</a:t></a:r>`)).join('');
    const end = `<a:endParaRPr lang="${o.lang}" dirty="0"${o.color ? `>${solid(o.color)}</a:endParaRPr>` : '/>'}`;
    return `<a:p>${ppr}${runs}${end}</a:p>`;
  }).join('');
}

// ---------- shapes ----------

interface WriteCtx { lang: string; theme: DeckTheme; media: Map<string, string>; rels: string[]; zip: JSZip; nextId: number; mediaCount: { n: number } }

const valignXml = (v?: ShapeItem['valign']) => (v === 'middle' ? 'ctr' : v === 'bottom' ? 'b' : 't');

function phXml(role: Role, layout: LayoutId) {
  if (role === 'title') return `<p:ph type="${layout === 'title' ? 'ctrTitle' : 'title'}"/>`;
  if (role === 'subtitle') return '<p:ph type="subTitle" idx="1"/>';
  if (layout === 'section') return '<p:ph type="body" idx="1"/>';
  return role === 'body2' ? '<p:ph sz="half" idx="2"/>' : `<p:ph${layout === 'two' ? ' sz="half"' : ''} idx="1"/>`;
}

function shapeXml(it: ShapeItem, layout: LayoutId, c: WriteCtx) {
  const id = c.nextId++;
  const name = esc(it.name ?? (it.role ? `${it.role} ${id}` : `${it.geom} ${id}`));
  if (it.geom === 'line' || it.geom === 'arrow') {
    const ln = it.line ?? { color: c.theme.accents[0], width: 2.25 };
    return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm(it)}<a:prstGeom prst="line"><a:avLst/></a:prstGeom>${lineXml(ln, it.geom === 'arrow')}</p:spPr></p:cxnSp>`;
  }
  const t = c.theme;
  let fill = '', line = '', color: string | undefined, align: string | undefined;
  if (it.role) {
    fill = it.fill ? solid(it.fill) : '<a:noFill/>';
    line = it.line ? lineXml(it.line) : '';
  } else {
    const f = it.fill !== undefined ? it.fill : t.accents[0];
    fill = f ? solid(f) : '<a:noFill/>';
    line = lineXml(it.line !== undefined ? it.line : { color: shadeHex(t.accents[0], -0.3), width: 1 });
    color = f ? (lum(f) > 0.6 ? '#1F1F1F' : '#FFFFFF') : t.text;
    align = 'center';
  }
  const txBox = !it.role && it.fill === null && it.line === null ? ' txBox="1"' : '';
  const anchor = valignXml(it.valign ?? (it.role ? 'top' : 'middle'));
  const fit = it.autofit ? '<a:normAutofit/>' : '';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr${txBox}/><p:nvPr>${it.role ? phXml(it.role, layout) : ''}</p:nvPr></p:nvSpPr>`
    + `<p:spPr>${xfrm(it)}<a:prstGeom prst="${it.geom}"><a:avLst/></a:prstGeom>${fill}${line}</p:spPr>`
    + `<p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="${anchor}">${fit}</a:bodyPr><a:lstStyle/>`
    + `${parasXml(it.html, { role: it.role, lang: c.lang, color, align, spacing: it.spacing })}</p:txBody></p:sp>`;
}

async function mediaRel(src: string, c: WriteCtx): Promise<string | null> {
  const hit = c.media.get(src);
  if (hit) return hit;
  let data: Uint8Array, ext: string;
  const m = src.match(/^data:image\/([a-z+]+);base64,(.*)$/i);
  if (m) {
    ext = m[1].toLowerCase().replace('jpeg', 'jpg').replace('svg+xml', 'svg');
    data = Uint8Array.from(atob(m[2]), ch => ch.charCodeAt(0));
  } else {
    try {
      const blob = await (await fetch(src)).blob();
      ext = (blob.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
      data = new Uint8Array(await blob.arrayBuffer());
    } catch { return null; }
  }
  const file = `image${++c.mediaCount.n}.${ext}`;
  c.zip.file(`ppt/media/${file}`, data);
  const rid = `rId${c.rels.length + 1}`;
  c.rels.push(`<Relationship Id="${rid}" Type="${REL}/image" Target="../media/${file}"/>`);
  c.media.set(src, rid);
  return rid;
}

async function imageXml(it: Extract<Item, { kind: 'image' }>, c: WriteCtx) {
  const rid = await mediaRel(it.src, c);
  if (!rid) return '';
  const id = c.nextId++;
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${esc(it.name ?? `Picture ${id}`)}" descr="${esc(it.alt ?? '')}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`
    + `<p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(it)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${it.line ? lineXml(it.line) : ''}</p:spPr></p:pic>`;
}

function tableXml(it: Extract<Item, { kind: 'table' }>, c: WriteCtx) {
  const id = c.nextId++;
  const color = it.color ?? c.theme.accents[0];
  const light = shadeHex(color, 0.82), lighter = shadeHex(color, 0.9);
  const ncols = Math.max(1, ...it.rows.map(r => r.length));
  const cols = it.cols && it.cols.length === ncols ? it.cols : Array.from({ length: ncols }, () => 1 / ncols);
  const rowH = e(it.h / Math.max(1, it.rows.length));
  const border = (tag: string) => `<a:${tag} w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:prstDash val="solid"/></a:${tag}>`;
  const rows = it.rows.map((row, r) => {
    const head = it.header && r === 0;
    const band = it.banded ? ((r - (it.header ? 1 : 0)) % 2 === 0 ? light : lighter) : lighter;
    const bg = head ? color : band;
    const fg = head ? (lum(color) > 0.6 ? '#1F1F1F' : '#FFFFFF') : '#1F1F1F';
    const cells = Array.from({ length: ncols }, (_, ci) => {
      const text = row[ci] ?? '';
      const ps = text.split('\n').map(line => `<a:p><a:r>${rPr({ size: 16, b: head }, c.lang, fg)}<a:t>${esc(line)}</a:t></a:r></a:p>`).join('');
      return `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${ps}</a:txBody><a:tcPr marL="91440" marR="91440" marT="45720" marB="45720" anchor="ctr">${border('lnL')}${border('lnR')}${border('lnT')}${border('lnB')}${solid(bg)}</a:tcPr></a:tc>`;
    }).join('');
    return `<a:tr h="${rowH}">${cells}</a:tr>`;
  }).join('');
  const grid = cols.map(w => `<a:gridCol w="${e(it.w * w)}"/>`).join('');
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${esc(it.name ?? `Table ${id}`)}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>`
    + `${xfrm(it, 'p:xfrm')}<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr${it.header ? ' firstRow="1"' : ''}${it.banded ? ' bandRow="1"' : ''}/><a:tblGrid>${grid}</a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

async function itemsXml(items: Item[], layout: LayoutId, c: WriteCtx) {
  const out: string[] = [];
  for (const it of items) {
    if (it.kind === 'shape') out.push(shapeXml(it, layout, c));
    else if (it.kind === 'image') out.push(await imageXml(it, c));
    else out.push(tableXml(it, c));
  }
  return out.join('');
}

// ---------- theme, master and layouts ----------

function themeXml(t: DeckTheme, name: string) {
  const dk1 = t.dark ? t.bg.color : t.text, lt1 = t.dark ? t.text : t.bg.color;
  const dk2 = t.dark ? (t.bg.to ?? t.bg.color) : t.title, lt2 = t.dark ? t.title : (t.bg.to ?? t.bg.color);
  const acc = [...t.accents, ...THEMES[0].accents].slice(0, 6);
  const clr = (tag: string, c: string) => `<a:${tag}><a:srgbClr val="${hex(c)}"/></a:${tag}>`;
  const fill3 = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="50000"/></a:schemeClr></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:shade val="80000"/></a:schemeClr></a:solidFill>';
  const ln = (w: number) => `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`;
  return `${XML}<a:theme xmlns:a="${NS_A}" name="${esc(name)}"><a:themeElements><a:clrScheme name="${esc(name)}">${clr('dk1', dk1)}${clr('lt1', lt1)}${clr('dk2', dk2)}${clr('lt2', lt2)}`
    + `${acc.map((c, i) => clr(`accent${i + 1}`, c)).join('')}${clr('hlink', acc[0])}${clr('folHlink', acc[4] ?? acc[1])}</a:clrScheme>`
    + `<a:fontScheme name="${esc(name)}"><a:majorFont><a:latin typeface="${esc(t.head)}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${esc(t.body)}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>`
    + `<a:fmtScheme name="Office"><a:fillStyleLst>${fill3}</a:fillStyleLst><a:lnStyleLst>${ln(6350)}${ln(12700)}${ln(19050)}</a:lnStyleLst>`
    + '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
    + `<a:bgFillStyleLst>${fill3}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

function phSp(id: number, name: string, ph: string, box: { x: number; y: number; w: number; h: number }, anchor: string, lst = '', text = '') {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr>${xfrm(box)}</p:spPr>`
    + `<p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="${anchor}"><a:normAutofit/></a:bodyPr><a:lstStyle>${lst}</a:lstStyle><a:p>${text ? `<a:r><a:rPr lang="en-US"/><a:t>${esc(text)}</a:t></a:r>` : '<a:endParaRPr lang="en-US"/>'}</a:p></p:txBody></p:sp>`;
}

const box = (layout: LayoutId, role: Role, d: Deck) => layoutBox(layout, role, d.w, d.h);

function masterXml(d: Deck, layoutRids: string[]) {
  const t = d.theme;
  const decos = (t.deco ?? []).map((dc, i) => {
    const b = { x: dc.x * d.w, y: dc.y * d.h, w: dc.w * d.w, h: dc.h * d.h };
    const fill = dc.to
      ? `<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="${hex(dc.color)}">${dc.opacity !== undefined && dc.opacity < 1 ? `<a:alpha val="${Math.round(dc.opacity * 100000)}"/>` : ''}</a:srgbClr></a:gs><a:gs pos="100000"><a:srgbClr val="${hex(dc.to)}">${dc.opacity !== undefined && dc.opacity < 1 ? `<a:alpha val="${Math.round(dc.opacity * 100000)}"/>` : ''}</a:srgbClr></a:gs></a:gsLst><a:lin ang="0" scaled="0"/></a:gradFill>`
      : solid(dc.color, dc.opacity);
    return `<p:sp><p:nvSpPr><p:cNvPr id="${20 + i}" name="Decoration ${i + 1}"/><p:cNvSpPr/><p:nvPr userDrawn="1"/></p:nvSpPr><p:spPr>${xfrm(b)}<a:prstGeom prst="${dc.round ? 'ellipse' : 'rect'}"><a:avLst/></a:prstGeom>${fill}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
  }).join('');
  const tb = box('content', 'title', d), bb = box('content', 'body', d);
  const lvl = (n: number, sz: number) => {
    const mar = 228600 + n * 457200;
    return `<a:lvl${n + 1}pPr marL="${mar}" indent="-228600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc><a:spcBef><a:spcPts val="${n ? 500 : 1000}"/></a:spcBef><a:buClr><a:srgbClr val="${hex(t.accents[0])}"/></a:buClr><a:buFont typeface="Arial" panose="020B0604020202020204"/><a:buChar char="•"/><a:defRPr sz="${sz * 100}" kern="1200">${solid(t.text)}<a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl${n + 1}pPr>`;
  };
  const sizes = [28, 24, 20, 18, 18, 18, 18, 18, 18];
  const other = (n: number) => `<a:lvl${n + 1}pPr marL="${n * 457200}" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl${n + 1}pPr>`;
  const map = t.dark
    ? 'bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2"'
    : 'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2"';
  return `${XML}<p:sldMaster ${NSS}><p:cSld>${bgXml(t.bg)}<p:spTree>${groupProps}${decos}`
    + phSp(2, 'Title Placeholder 1', '<p:ph type="title"/>', tb, 'ctr', '', 'Title')
    + phSp(3, 'Text Placeholder 2', '<p:ph type="body" idx="1"/>', bb, 't', '', 'Text')
    + `</p:spTree></p:cSld><p:clrMap ${map} accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>`
    + `<p:sldLayoutIdLst>${layoutRids.map((rid, i) => `<p:sldLayoutId id="${2147483649 + i}" r:id="${rid}"/>`).join('')}</p:sldLayoutIdLst>`
    + `<p:txStyles><p:titleStyle><a:lvl1pPr algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:lnSpc><a:spcPct val="90000"/></a:lnSpc><a:spcBef><a:spcPct val="0"/></a:spcBef><a:buNone/><a:defRPr sz="4000" kern="1200">${solid(t.title)}<a:latin typeface="+mj-lt"/><a:ea typeface="+mj-ea"/><a:cs typeface="+mj-cs"/></a:defRPr></a:lvl1pPr></p:titleStyle>`
    + `<p:bodyStyle>${sizes.map((s, i) => lvl(i, s)).join('')}</p:bodyStyle><p:otherStyle>${Array.from({ length: 9 }, (_, i) => other(i)).join('')}</p:otherStyle></p:txStyles></p:sldMaster>`;
}

function layoutXml(layout: LayoutId, d: Deck) {
  const meta = LAYOUT_META[layout];
  let id = 2;
  const sps = layoutRoles(layout).map(role => {
    const b = box(layout, role, d);
    const anchor = valignXml(b.valign);
    const name = role === 'title' ? 'Title' : role === 'subtitle' ? 'Subtitle' : 'Content Placeholder';
    let lst = '';
    if (role === 'title' && layout !== 'content' && layout !== 'two' && layout !== 'titleOnly') {
      lst = `<a:lvl1pPr${layout === 'title' ? ' algn="ctr"' : ''}><a:defRPr sz="${defaultSize('title', layout) * 100}"/></a:lvl1pPr>`;
    }
    if (role === 'subtitle') lst = '<a:lvl1pPr marL="0" indent="0" algn="ctr"><a:buNone/><a:defRPr sz="2400"/></a:lvl1pPr>';
    if (layout === 'section' && role === 'body') lst = '<a:lvl1pPr marL="0" indent="0"><a:buNone/><a:defRPr sz="2000"/></a:lvl1pPr>';
    return phSp(id++, `${name} ${id - 1}`, phXml(role, layout), b, anchor, lst);
  }).join('');
  return `${XML}<p:sldLayout ${NSS} type="${meta.type}" preserve="1"><p:cSld name="${meta.name}"><p:spTree>${groupProps}${sps}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

const notesMasterXml = () => `${XML}<p:notesMaster ${NSS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${groupProps}`
  + phSp(2, 'Slide Image Placeholder 1', '<p:ph type="sldImg" idx="2"/>', { x: 72, y: 72, w: 576, h: 324 }, 't')
  + phSp(3, 'Notes Placeholder 2', '<p:ph type="body" sz="quarter" idx="3"/>', { x: 72, y: 432, w: 576, h: 432 }, 't')
  + '</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
  + '<p:notesStyle><a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr></p:notesStyle></p:notesMaster>';

function notesSlideXml(notes: string, lang: string) {
  const ps = notes.split('\n').map(l => (l ? `<a:p><a:r><a:rPr lang="${lang}" dirty="0"/><a:t>${esc(l)}</a:t></a:r></a:p>` : `<a:p><a:endParaRPr lang="${lang}"/></a:p>`)).join('');
  return `${XML}<p:notes ${NSS}><p:cSld><p:spTree>${groupProps}`
    + '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>'
    + `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${ps}</p:txBody></p:sp>`
    + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>';
}

function transitionXml(s: Slide) {
  if (!s.transition || s.transition === 'none') return '';
  const spd = s.speed ?? 'med';
  const kid = s.transition === 'fade' ? '<p:fade/>' : s.transition === 'push' ? '<p:push dir="l"/>' : s.transition === 'wipe' ? '<p:wipe dir="r"/>' : s.transition === 'cover' ? '<p:cover dir="l"/>' : '<p:zoom/>';
  return `<p:transition spd="${spd}">${kid}</p:transition>`;
}

/** Writes a deck as a .pptx file. `lang` is the language tag put on the text, like "fr-FR". */
export async function writePptx(deck: Deck, lang = 'en-US', title = ''): Promise<Blob> {
  const zip = new JSZip();
  const used = LAYOUT_ORDER;
  const n = deck.slides.length;
  const media = new Map<string, string>();
  const mediaCount = { n: 0 };
  const hasNotes = deck.slides.some(s => s.notes.trim());

  // Content types.
  const over = [
    `<Override PartName="/ppt/presentation.xml" ContentType="${CT}.presentation.main+xml"/>`,
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${CT}.slideMaster+xml"/>`,
    ...used.map((_, i) => `<Override PartName="/ppt/slideLayouts/slideLayout${i + 1}.xml" ContentType="${CT}.slideLayout+xml"/>`),
    ...deck.slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${CT}.slide+xml"/>`),
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
    `<Override PartName="/ppt/presProps.xml" ContentType="${CT}.presProps+xml"/>`,
    `<Override PartName="/ppt/viewProps.xml" ContentType="${CT}.viewProps+xml"/>`,
    `<Override PartName="/ppt/tableStyles.xml" ContentType="${CT}.tableStyles+xml"/>`,
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
  ];
  if (hasNotes) {
    over.push(`<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="${CT}.notesMaster+xml"/>`,
      '<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>');
    deck.slides.forEach((s, i) => { if (s.notes.trim()) over.push(`<Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="${CT}.notesSlide+xml"/>`); });
  }
  zip.file('[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="webp" ContentType="image/webp"/><Default Extension="svg" ContentType="image/svg+xml"/><Default Extension="bmp" ContentType="image/bmp"/>${over.join('')}</Types>`);
  zip.file('_rels/.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  zip.file('docProps/core.xml', `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>Office In 1</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
  zip.file('docProps/app.xml', `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Office In 1 Stage</Application><Slides>${n}</Slides><PresentationFormat>${deck.w / deck.h > 1.5 ? 'Widescreen' : 'On-screen Show (4:3)'}</PresentationFormat></Properties>`);

  // Presentation.
  const pRels: string[] = [`<Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>`];
  const sldIds: string[] = [];
  deck.slides.forEach((_, i) => { const rid = `rId${pRels.length + 1}`; pRels.push(`<Relationship Id="${rid}" Type="${REL}/slide" Target="slides/slide${i + 1}.xml"/>`); sldIds.push(`<p:sldId id="${256 + i}" r:id="${rid}"/>`); });
  let notesMasterRid = '';
  if (hasNotes) { notesMasterRid = `rId${pRels.length + 1}`; pRels.push(`<Relationship Id="${notesMasterRid}" Type="${REL}/notesMaster" Target="notesMasters/notesMaster1.xml"/>`); }
  pRels.push(`<Relationship Id="rId${pRels.length + 1}" Type="${REL}/theme" Target="theme/theme1.xml"/>`);
  pRels.push(`<Relationship Id="rId${pRels.length + 1}" Type="${REL}/presProps" Target="presProps.xml"/>`);
  pRels.push(`<Relationship Id="rId${pRels.length + 1}" Type="${REL}/viewProps" Target="viewProps.xml"/>`);
  pRels.push(`<Relationship Id="rId${pRels.length + 1}" Type="${REL}/tableStyles" Target="tableStyles.xml"/>`);
  zip.file('ppt/_rels/presentation.xml.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${pRels.join('')}</Relationships>`);
  zip.file('ppt/presentation.xml', `${XML}<p:presentation ${NSS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>`
    + `${hasNotes ? `<p:notesMasterIdLst><p:notesMasterId r:id="${notesMasterRid}"/></p:notesMasterIdLst>` : ''}<p:sldIdLst>${sldIds.join('')}</p:sldIdLst>`
    + `<p:sldSz cx="${e(deck.w)}" cy="${e(deck.h)}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  zip.file('ppt/presProps.xml', `${XML}<p:presentationPr ${NSS}/>`);
  zip.file('ppt/viewProps.xml', `${XML}<p:viewPr ${NSS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`);
  zip.file('ppt/tableStyles.xml', `${XML}<a:tblStyleLst xmlns:a="${NS_A}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
  zip.file('ppt/theme/theme1.xml', themeXml(deck.theme, `OI1 ${deck.theme.id}${deck.theme.id === 'file' ? ` ${deck.theme.name}` : ''}`));

  // Master and layouts.
  const mRels = used.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout${i + 1}.xml"/>`);
  mRels.push(`<Relationship Id="rId${used.length + 1}" Type="${REL}/theme" Target="../theme/theme1.xml"/>`);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${mRels.join('')}</Relationships>`);
  zip.file('ppt/slideMasters/slideMaster1.xml', masterXml(deck, used.map((_, i) => `rId${i + 1}`)));
  used.forEach((l, i) => {
    zip.file(`ppt/slideLayouts/slideLayout${i + 1}.xml`, layoutXml(l, deck));
    zip.file(`ppt/slideLayouts/_rels/slideLayout${i + 1}.xml.rels`, `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
  });
  if (hasNotes) {
    zip.file('ppt/notesMasters/notesMaster1.xml', notesMasterXml());
    zip.file('ppt/notesMasters/_rels/notesMaster1.xml.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/theme" Target="../theme/theme2.xml"/></Relationships>`);
    zip.file('ppt/theme/theme2.xml', themeXml(THEMES[0], 'Office Theme'));
  }

  // Slides.
  for (let i = 0; i < n; i++) {
    const s = deck.slides[i];
    const rels = [`<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout${used.indexOf(s.layout) + 1}.xml"/>`];
    const c: WriteCtx = { lang, theme: deck.theme, media, rels, zip, nextId: 2, mediaCount };
    // Pictures are shared between slides, but each slide needs its own relationship to them.
    c.media = new Map();
    const shapes = await itemsXml(s.items, s.layout, c);
    if (s.notes.trim()) {
      rels.push(`<Relationship Id="rId${rels.length + 1}" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide${i + 1}.xml"/>`);
      zip.file(`ppt/notesSlides/notesSlide${i + 1}.xml`, notesSlideXml(s.notes, lang));
      zip.file(`ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`, `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/notesMaster" Target="../notesMasters/notesMaster1.xml"/><Relationship Id="rId2" Type="${REL}/slide" Target="../slides/slide${i + 1}.xml"/></Relationships>`);
    }
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
    zip.file(`ppt/slides/slide${i + 1}.xml`, `${XML}<p:sld ${NSS}${s.hidden ? ' show="0"' : ''}><p:cSld>${s.bg ? bgXml(s.bg) : ''}<p:spTree>${groupProps}${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${transitionXml(s)}</p:sld>`);
  }
  return zip.generateAsync({ type: 'blob', mimeType: PPTX_TYPE, compression: 'DEFLATE' });
}

// ======================================================================================
// Reading
// ======================================================================================

type El = Element;
const kids = (el: El | null | undefined, name: string): El[] => (el ? Array.from(el.children).filter(c => c.localName === name) : []);
const kid = (el: El | null | undefined, name: string): El | null => (el ? Array.from(el.children).find(c => c.localName === name) ?? null : null);
const path = (el: El | null | undefined, ...names: string[]): El | null => names.reduce<El | null>((cur, n) => kid(cur, n), el ?? null);
const all = (el: El | null | undefined, name: string): El[] => (el ? Array.from(el.getElementsByTagNameNS('*', name)) : []);
const num = (v: string | null | undefined, d = 0) => (v == null || v === '' ? d : Number(v));
const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml').documentElement;

function resolvePath(base: string, target: string) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
  return parts.join('/');
}

interface Part { path: string; root: El; rels: Map<string, { type: string; target: string }> }

async function readPart(zip: JSZip, p: string): Promise<Part | null> {
  const f = zip.file(p);
  if (!f) return null;
  const root = parse(await f.async('text'));
  const relPath = p.replace(/([^/]+)$/, '_rels/$1.rels');
  const rels = new Map<string, { type: string; target: string }>();
  const rf = zip.file(relPath);
  if (rf) {
    for (const r of all(parse(await rf.async('text')), 'Relationship')) {
      const target = r.getAttribute('Target') ?? '';
      rels.set(r.getAttribute('Id') ?? '', { type: (r.getAttribute('Type') ?? '').split('/').pop() ?? '', target: r.getAttribute('TargetMode') === 'External' ? target : resolvePath(p, target) });
    }
  }
  return { path: p, root, rels };
}
const relOf = (part: Part, type: string) => [...part.rels.values()].find(r => r.type === type)?.target;

interface Colors { scheme: Record<string, string>; map: Record<string, string> }

function colorOf(el: El | null, c: Colors): string | null {
  if (!el) return null;
  const node = el.localName === 'solidFill' ? el.firstElementChild : el;
  if (!node) return null;
  let base: string | null = null;
  if (node.localName === 'srgbClr') base = node.getAttribute('val');
  else if (node.localName === 'sysClr') base = node.getAttribute('lastClr') ?? (node.getAttribute('val') === 'window' ? 'FFFFFF' : '000000');
  else if (node.localName === 'schemeClr') {
    const v = node.getAttribute('val') ?? '';
    const name = c.map[v] ?? v;
    base = c.scheme[name] ?? c.scheme[v] ?? null;
  } else if (node.localName === 'prstClr') base = ({ black: '000000', white: 'FFFFFF', red: 'FF0000', green: '00FF00', blue: '0000FF', yellow: 'FFFF00' } as Record<string, string>)[node.getAttribute('val') ?? ''] ?? '000000';
  if (!base) return null;
  let [r, g, b] = [0, 2, 4].map(i => parseInt(base!.slice(i, i + 2), 16) / 255);
  for (const m of Array.from(node.children)) {
    const v = num(m.getAttribute('val')) / 100000;
    if (m.localName === 'lumMod' || m.localName === 'lumOff') {
      // Lightness changes work in HSL, like Office.
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h /= 6;
      }
      l = m.localName === 'lumMod' ? l * v : Math.min(1, l + v);
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
      [r, g, b] = s === 0 ? [l, l, l] : [f(h + 1 / 3), f(h), f(h - 1 / 3)];
    } else if (m.localName === 'tint') [r, g, b] = [r, g, b].map(x => x + (1 - x) * (1 - v));
    else if (m.localName === 'shade') [r, g, b] = [r, g, b].map(x => x * v);
  }
  return '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function fillOf(spPr: El | null, c: Colors): string | null | undefined {
  if (!spPr) return undefined;
  if (kid(spPr, 'noFill')) return null;
  const s = kid(spPr, 'solidFill');
  if (s) return colorOf(s, c);
  const g = kid(spPr, 'gradFill');
  if (g) return colorOf(path(g, 'gsLst', 'gs'), c);
  return undefined;
}

function bgOf(cSld: El | null, c: Colors): Background | null {
  const bg = kid(cSld, 'bg');
  if (!bg) return null;
  const pr = kid(bg, 'bgPr');
  if (pr) {
    const g = kid(pr, 'gradFill');
    if (g) {
      const stops = kids(kid(g, 'gsLst'), 'gs');
      const a = colorOf(stops[0], c), b = colorOf(stops[stops.length - 1], c);
      const ang = num(kid(g, 'lin')?.getAttribute('ang')) / 60000;
      if (a && b) return { color: a, to: b, angle: Math.round(ang + 90) % 360 };
    }
    const col = fillOf(pr, c);
    if (col) return { color: col };
    return null;
  }
  const ref = kid(bg, 'bgRef');
  const col = colorOf(ref, c);
  return col ? { color: col } : null;
}

interface Ph { type: string; idx: string }
function phOf(sp: El): Ph | null {
  const ph = all(kid(sp, 'nvSpPr') ?? kid(sp, 'nvPicPr') ?? kid(sp, 'nvGraphicFramePr'), 'ph')[0];
  return ph ? { type: ph.getAttribute('type') ?? 'body', idx: ph.getAttribute('idx') ?? '' } : null;
}
function findPh(tree: El | null, ph: Ph): El | null {
  if (!tree) return null;
  const sps = kids(tree, 'sp');
  const same = (a: string, b: string) => a === b || (['title', 'ctrTitle'].includes(a) && ['title', 'ctrTitle'].includes(b));
  return sps.find(s => { const p = phOf(s); return p && ph.idx && p.idx === ph.idx; })
    ?? sps.find(s => { const p = phOf(s); return p && same(p.type, ph.type); })
    ?? (ph.type === 'body' || ph.type === 'obj' || ph.type === 'subTitle' ? sps.find(s => phOf(s)?.type === 'body') : null) ?? null;
}

interface Box { x: number; y: number; w: number; h: number; rot?: number; flipH?: boolean; flipV?: boolean }
function boxOf(x: El | null): Box | null {
  if (!x) return null;
  const off = kid(x, 'off'), ext = kid(x, 'ext');
  if (!off || !ext) return null;
  const rot = num(x.getAttribute('rot')) / 60000;
  return {
    x: num(off.getAttribute('x')) / EMU, y: num(off.getAttribute('y')) / EMU, w: num(ext.getAttribute('cx')) / EMU, h: num(ext.getAttribute('cy')) / EMU,
    ...(rot ? { rot } : {}), ...(x.getAttribute('flipH') === '1' ? { flipH: true } : {}), ...(x.getAttribute('flipV') === '1' ? { flipV: true } : {}),
  };
}

interface ReadCtx {
  zip: JSZip; colors: Colors; slidePart: Part; layoutTree: El | null; masterTree: El | null;
  sizes: { title: number; body: number[]; other: number }; fonts: { head: string; body: string }; layout: LayoutId; bodyCount: number;
  group: ((b: Box) => Box) | null;
}

const fontName = (tf: string | null, f: ReadCtx['fonts']) => (!tf ? null : tf.startsWith('+mj') ? f.head : tf.startsWith('+mn') ? f.body : tf);

/** DrawingML paragraphs to editor HTML. */
function textHtml(txBody: El | null, ctx: ReadCtx, role: Role | undefined, defSize: (lvl: number) => number): string {
  if (!txBody) return '<p></p>';
  const body = role === 'body' || role === 'body2';
  const scale = num(path(txBody, 'bodyPr', 'normAutofit')?.getAttribute('fontScale'), 100000) / 100000;
  const out: string[] = [];
  const stack: string[] = [];
  const closeTo = (depth: number) => { while (stack.length > depth) out.push(`</li></${stack.pop()}>`); };
  for (const p of kids(txBody, 'p')) {
    const pPr = kid(p, 'pPr');
    const lvl = num(pPr?.getAttribute('lvl'));
    const algn = pPr?.getAttribute('algn');
    const align = algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : algn === 'just' ? 'justify' : algn === 'l' ? 'left' : null;
    const none = !!kid(pPr, 'buNone');
    const auto = !!kid(pPr, 'buAutoNum');
    const bullet = body ? !none : !!(kid(pPr, 'buChar') || auto);
    let html = '';
    for (const r of Array.from(p.children)) {
      if (r.localName === 'br') { html += '<br>'; continue; }
      if (r.localName !== 'r' && r.localName !== 'fld') continue;
      const t = kid(r, 't')?.textContent ?? '';
      if (!t) continue;
      const pr = kid(r, 'rPr');
      let s = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const css: string[] = [];
      const sz = pr?.getAttribute('sz');
      const size = sz ? Math.round((num(sz) / 100) * scale * 2) / 2 : null;
      if (size && Math.abs(size - defSize(lvl)) > 0.5) css.push(`font-size: ${size}pt`);
      const col = colorOf(kid(pr, 'solidFill'), ctx.colors);
      if (col) css.push(`color: ${col}`);
      const font = fontName(kid(pr, 'latin')?.getAttribute('typeface') ?? null, ctx.fonts);
      if (font && font !== (role === 'title' ? ctx.fonts.head : ctx.fonts.body)) css.push(`font-family: ${font}`);
      if (css.length) s = `<span style="${css.join('; ')}">${s}</span>`;
      const hl = colorOf(kid(kid(pr, 'highlight'), 'srgbClr') ?? kid(pr, 'highlight')?.firstElementChild ?? null, ctx.colors);
      if (hl) s = `<mark data-color="${hl}" style="background-color: ${hl}; color: inherit">${s}</mark>`;
      const base = num(pr?.getAttribute('baseline'));
      if (base > 0) s = `<sup>${s}</sup>`; else if (base < 0) s = `<sub>${s}</sub>`;
      if (pr?.getAttribute('strike') && pr.getAttribute('strike') !== 'noStrike') s = `<s>${s}</s>`;
      if (pr?.getAttribute('u') && pr.getAttribute('u') !== 'none') s = `<u>${s}</u>`;
      if (pr?.getAttribute('i') === '1') s = `<em>${s}</em>`;
      if (pr?.getAttribute('b') === '1') s = `<strong>${s}</strong>`;
      html += s;
    }
    const pTag = `<p${align ? ` style="text-align: ${align}"` : ''}>${html}</p>`;
    if (bullet) {
      const tag = auto ? 'ol' : 'ul';
      const depth = lvl + 1;
      if (stack.length > depth) closeTo(depth);
      if (stack.length === depth) out.push('</li><li>');
      while (stack.length < depth) { stack.push(tag); out.push(`<${tag}><li>`); }
      out.push(pTag);
    } else {
      closeTo(0);
      out.push(pTag);
    }
  }
  closeTo(0);
  const html = out.join('').replace(/<li><\/li>/g, '');
  return html || '<p></p>';
}

async function readItems(tree: El, ctx: ReadCtx, out: Item[]) {
  for (const el of Array.from(tree.children)) {
    const name = el.localName;
    if (name === 'grpSp') {
      const x = path(el, 'grpSpPr', 'xfrm');
      const b = boxOf(x);
      const chOff = kid(x, 'chOff'), chExt = kid(x, 'chExt');
      const parent = ctx.group;
      let map = parent;
      if (b && chOff && chExt) {
        const cx = num(chOff.getAttribute('x')) / EMU, cy = num(chOff.getAttribute('y')) / EMU;
        const sx = num(chExt.getAttribute('cx')) ? b.w / (num(chExt.getAttribute('cx')) / EMU) : 1;
        const sy = num(chExt.getAttribute('cy')) ? b.h / (num(chExt.getAttribute('cy')) / EMU) : 1;
        const own = (c: Box): Box => ({ ...c, x: b.x + (c.x - cx) * sx, y: b.y + (c.y - cy) * sy, w: c.w * sx, h: c.h * sy });
        map = parent ? (c: Box) => parent(own(c)) : own;
      }
      await readItems(el, { ...ctx, group: map }, out);
      continue;
    }
    if (name === 'AlternateContent') {
      const choice = kid(el, 'Fallback') ?? kid(el, 'Choice');
      if (choice) await readItems(choice, ctx, out);
      continue;
    }
    const place = (b: Box) => (ctx.group ? ctx.group(b) : b);
    if (name === 'sp') {
      const ph = phOf(el);
      if (ph && ['dt', 'ftr', 'sldNum', 'hdr'].includes(ph.type)) continue;
      const spPr = kid(el, 'spPr');
      const layoutSp = ph ? findPh(ctx.layoutTree, ph) : null;
      const masterSp = ph ? findPh(ctx.masterTree, ph) : null;
      const b = boxOf(kid(spPr, 'xfrm')) ?? boxOf(path(layoutSp, 'spPr', 'xfrm')) ?? boxOf(path(masterSp, 'spPr', 'xfrm'));
      if (!b) continue;
      let role: Role | undefined;
      if (ph) {
        if (ph.type === 'title' || ph.type === 'ctrTitle') role = 'title';
        else if (ph.type === 'subTitle') role = 'subtitle';
        else if (['body', 'obj', 'tx'].includes(ph.type) || (!el.querySelector('ph')?.getAttribute('type'))) {
          role = ctx.layout === 'two' && ctx.bodyCount >= 1 ? 'body2' : 'body';
          ctx.bodyCount++;
        }
      }
      const prst = path(spPr, 'prstGeom')?.getAttribute('prst') ?? 'rect';
      const geom: Geom = (GEOMS as string[]).includes(prst) ? prst as Geom : prst === 'flowChartAlternateProcess' ? 'roundRect' : prst === 'homePlate' ? 'chevron' : 'rect';
      const style = kid(el, 'style');
      let fill = fillOf(spPr, ctx.colors);
      if (fill === undefined && !role && style) fill = colorOf(kid(style, 'fillRef'), ctx.colors);
      const lnEl = kid(spPr, 'ln');
      let line: Stroke | null | undefined;
      if (lnEl) line = kid(lnEl, 'noFill') ? null : (() => { const c = colorOf(kid(lnEl, 'solidFill'), ctx.colors); return c ? { color: c, width: num(lnEl.getAttribute('w'), 12700) / 12700 } : undefined; })();
      if (line === undefined && !role && style && !lnEl) { const c = colorOf(kid(style, 'lnRef'), ctx.colors); line = c ? { color: c, width: 1 } : null; }
      const bodyPr = path(el, 'txBody', 'bodyPr');
      const anchor = bodyPr?.getAttribute('anchor') ?? path(layoutSp, 'txBody', 'bodyPr')?.getAttribute('anchor') ?? path(masterSp, 'txBody', 'bodyPr')?.getAttribute('anchor');
      const valign = anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : anchor === 't' ? 'top' : role ? (role === 'title' ? 'middle' : 'top') : 'middle';
      const defSize = (lvl: number) => (role === 'title' ? ctx.sizes.title : role ? (ctx.sizes.body[lvl] ?? 18) : ctx.sizes.other);
      const html = textHtml(kid(el, 'txBody'), ctx, role, (lvl: number) => (role ? defaultSize(role, ctx.layout, lvl) : 18) || defSize(lvl));
      const isTextBox = !role && fill == null && line == null;
      if (!role && isTextBox && !htmlText(html).trim()) continue;
      out.push({
        id: newId(), kind: 'shape', geom, ...(role ? { role } : {}), ...place(b),
        fill: role ? (fill ?? null) : fill === undefined ? null : fill, line: role ? (line ?? null) : line === undefined ? null : line,
        html, valign, autofit: role ? true : !!path(bodyPr, 'normAutofit'), name: kid(kid(el, 'nvSpPr'), 'cNvPr')?.getAttribute('name') ?? undefined,
      });
      continue;
    }
    if (name === 'cxnSp') {
      const spPr = kid(el, 'spPr');
      const b = boxOf(kid(spPr, 'xfrm'));
      if (!b) continue;
      const lnEl = kid(spPr, 'ln');
      const color = colorOf(kid(lnEl, 'solidFill'), ctx.colors) ?? colorOf(kid(kid(el, 'style'), 'lnRef'), ctx.colors) ?? '#7F7F7F';
      const arrow = [kid(lnEl, 'tailEnd'), kid(lnEl, 'headEnd')].some(x => x && x.getAttribute('type') && x.getAttribute('type') !== 'none');
      out.push({ id: newId(), kind: 'shape', geom: arrow ? 'arrow' : 'line', ...place(b), html: '', line: { color, width: num(lnEl?.getAttribute('w'), 12700) / 12700 } });
      continue;
    }
    if (name === 'pic') {
      const rid = path(el, 'blipFill', 'blip')?.getAttributeNS(NS_R, 'embed') ?? path(el, 'blipFill', 'blip')?.getAttribute('r:embed');
      const ph = phOf(el);
      const b = boxOf(path(el, 'spPr', 'xfrm')) ?? (ph ? boxOf(path(findPh(ctx.layoutTree, ph), 'spPr', 'xfrm')) : null);
      const target = rid ? ctx.slidePart.rels.get(rid)?.target : undefined;
      if (!b || !target) continue;
      const src = await dataUrl(ctx.zip, target);
      if (!src) continue;
      out.push({ id: newId(), kind: 'image', ...place(b), src, alt: kid(kid(el, 'nvPicPr'), 'cNvPr')?.getAttribute('descr') ?? undefined });
      continue;
    }
    if (name === 'graphicFrame') {
      const tbl = all(el, 'tbl')[0];
      const b = boxOf(kid(el, 'xfrm'));
      if (!tbl || !b) continue;
      const rows = kids(tbl, 'tr').map(tr => kids(tr, 'tc').filter(tc => !tc.getAttribute('hMerge') && !tc.getAttribute('vMerge')).map(tc => kids(kid(tc, 'txBody'), 'p').map(p => all(p, 't').map(t => t.textContent).join('')).join('\n')));
      const widths = kids(kid(tbl, 'tblGrid'), 'gridCol').map(g => num(g.getAttribute('w')));
      const total = widths.reduce((a, x) => a + x, 0) || 1;
      const tblPr = kid(tbl, 'tblPr');
      const firstFill = colorOf(path(tbl, 'tr', 'tc', 'tcPr', 'solidFill'), ctx.colors);
      out.push({
        id: newId(), kind: 'table', ...place(b), rows, header: tblPr?.getAttribute('firstRow') === '1', banded: tblPr?.getAttribute('bandRow') === '1',
        ...(firstFill ? { color: firstFill } : {}), ...(widths.length === (rows[0]?.length ?? 0) ? { cols: widths.map(w => w / total) } : {}),
      });
    }
  }
}

async function dataUrl(zip: JSZip, p: string): Promise<string | null> {
  const f = zip.file(p);
  if (!f) return null;
  const ext = p.split('.').pop()?.toLowerCase() ?? 'png';
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : ext === 'emf' || ext === 'wmf' ? null : `image/${ext}`;
  if (!mime) return null;
  return `data:${mime};base64,${await f.async('base64')}`;
}

const LAYOUT_FROM: Record<string, LayoutId> = {
  title: 'title', obj: 'content', tx: 'content', secHead: 'section', twoObj: 'two', twoTxTwoObj: 'two', twoColTx: 'two',
  titleOnly: 'titleOnly', blank: 'blank', objTx: 'two', picTx: 'two',
};

/** Reads a .pptx file into a deck. */
export async function readPptx(data: ArrayBuffer): Promise<Deck> {
  const zip = await JSZip.loadAsync(data);
  const relsRoot = parse(await zip.file('_rels/.rels')!.async('text'));
  const presPath = (all(relsRoot, 'Relationship').find(r => r.getAttribute('Type')?.endsWith('/officeDocument'))?.getAttribute('Target') ?? 'ppt/presentation.xml').replace(/^\//, '');
  const pres = await readPart(zip, presPath);
  if (!pres) throw new Error('No presentation in this file');
  const sz = all(pres.root, 'sldSz')[0];
  const w = Math.round(num(sz?.getAttribute('cx'), 12192000) / EMU), h = Math.round(num(sz?.getAttribute('cy'), 6858000) / EMU);
  const slidePaths = all(pres.root, 'sldId').map(s => pres.rels.get(s.getAttributeNS(NS_R, 'id') ?? s.getAttribute('r:id') ?? '')?.target).filter((x): x is string => !!x);

  const masterPath = relOf(pres, 'slideMaster') ?? 'ppt/slideMasters/slideMaster1.xml';
  const master = await readPart(zip, masterPath);
  const themePart = master ? await readPart(zip, relOf(master, 'theme') ?? 'ppt/theme/theme1.xml') : null;
  const scheme: Record<string, string> = {};
  for (const c of Array.from(all(themePart?.root, 'clrScheme')[0]?.children ?? [])) {
    const v = c.firstElementChild;
    if (v) scheme[c.localName] = v.localName === 'sysClr' ? v.getAttribute('lastClr') ?? '000000' : v.getAttribute('val') ?? '000000';
  }
  const clrMap = all(master?.root, 'clrMap')[0];
  const map: Record<string, string> = {};
  for (const a of Array.from(clrMap?.attributes ?? [])) map[a.name] = a.value;
  const colors: Colors = { scheme, map };
  const themeName = themePart?.root.getAttribute('name') ?? '';
  const head = all(all(themePart?.root, 'majorFont')[0], 'latin')[0]?.getAttribute('typeface') || 'Calibri Light';
  const bodyFont = all(all(themePart?.root, 'minorFont')[0], 'latin')[0]?.getAttribute('typeface') || 'Calibri';
  const fonts = { head, body: bodyFont };

  const txStyles = kid(master?.root, 'txStyles');
  const szOf = (style: El | null, lvl: number, d: number) => num(path(style, `lvl${lvl + 1}pPr`, 'defRPr')?.getAttribute('sz'), d * 100) / 100;
  const titleStyle = kid(txStyles, 'titleStyle'), bodyStyle = kid(txStyles, 'bodyStyle');
  const sizes = { title: szOf(titleStyle, 0, 44), body: [0, 1, 2, 3, 4].map(l => szOf(bodyStyle, l, 18)), other: 18 };
  const masterTree = path(master?.root, 'cSld', 'spTree');
  const masterBg = bgOf(kid(master?.root, 'cSld'), colors);

  let theme: DeckTheme;
  const own = themeName.match(/^OI1 (\S+)/);
  if (own && own[1] !== 'file' && THEMES.some(t => t.id === own[1])) theme = themeById(own[1]);
  else {
    const bg = masterBg ?? { color: `#${scheme[map.bg1 ?? 'lt1'] ?? 'FFFFFF'}` };
    const titleColor = colorOf(kid(path(titleStyle, 'lvl1pPr', 'defRPr'), 'solidFill'), colors) ?? `#${scheme[map.tx1 ?? 'dk1'] ?? '000000'}`;
    const textColor = colorOf(kid(path(bodyStyle, 'lvl1pPr', 'defRPr'), 'solidFill'), colors) ?? `#${scheme[map.tx1 ?? 'dk1'] ?? '000000'}`;
    const accents = [1, 2, 3, 4, 5, 6].map(i => `#${scheme[`accent${i}`] ?? '4472C4'}`);
    theme = {
      id: 'file', name: own ? themeName.replace(/^OI1 file ?/, '') || 'Thème' : themeName || 'Thème', bg, title: titleColor, text: textColor, accents, head, body: bodyFont,
      dark: lum(bg.color) < 0.45,
    };
    // Pictures and shapes on the master are drawn behind every slide.
    if (masterTree && !own) {
      const deco: Item[] = [];
      const ctx: ReadCtx = { zip, colors, slidePart: master!, layoutTree: null, masterTree: null, sizes, fonts, layout: 'blank', bodyCount: 0, group: null };
      const tree = masterTree.cloneNode(true) as El;
      for (const sp of Array.from(tree.children)) if ((sp.localName === 'sp' || sp.localName === 'pic') && phOf(sp)) sp.remove();
      await readItems(tree, ctx, deco);
      if (deco.length) theme.decoItems = deco;
    }
  }

  const slides: Slide[] = [];
  for (const sp of slidePaths) {
    const part = await readPart(zip, sp);
    if (!part) continue;
    const layoutPart = relOf(part, 'slideLayout') ? await readPart(zip, relOf(part, 'slideLayout')!) : null;
    const lType = layoutPart?.root.getAttribute('type') ?? 'obj';
    const layout = LAYOUT_FROM[lType] ?? 'content';
    const layoutTree = path(layoutPart?.root, 'cSld', 'spTree');
    const items: Item[] = [];
    const ctx: ReadCtx = { zip, colors, slidePart: part, layoutTree, masterTree, sizes, fonts, layout, bodyCount: 0, group: null };
    const tree = path(part.root, 'cSld', 'spTree');
    if (tree) await readItems(tree, ctx, items);
    const bg = bgOf(kid(part.root, 'cSld'), colors) ?? bgOf(kid(layoutPart?.root, 'cSld'), colors);
    let notes = '';
    const notesPath = relOf(part, 'notesSlide');
    if (notesPath) {
      const np = await readPart(zip, notesPath);
      const bodySp = kids(path(np?.root, 'cSld', 'spTree'), 'sp').find(s => phOf(s)?.type === 'body');
      notes = kids(kid(bodySp, 'txBody'), 'p').map(p => all(p, 't').map(t => t.textContent).join('')).join('\n').trim();
    }
    const trans = all(part.root, 'transition');
    const tr = trans[trans.length - 1];
    let transition: Transition | undefined;
    if (tr) {
      const k = tr.firstElementChild?.localName;
      transition = k === 'fade' || k === 'push' || k === 'wipe' || k === 'cover' || k === 'zoom' ? k : k ? 'fade' : undefined;
    }
    const spd = tr?.getAttribute('spd') as Slide['speed'] | null;
    slides.push({
      id: newId('s'), layout, items, notes, ...(bg && (!masterBg || cssBackground(bg) !== cssBackground(masterBg)) && theme.id === 'file' ? { bg } : {}),
      ...(bg && own && cssBackground(bg) !== cssBackground(theme.bg) ? { bg } : {}),
      ...(transition ? { transition } : {}), ...(spd ? { speed: spd } : {}), ...(part.root.getAttribute('show') === '0' ? { hidden: true } : {}),
    });
  }
  if (!slides.length) slides.push({ id: newId('s'), layout: 'title', items: [], notes: '' });
  return { w, h, theme, slides };
}
