// A document's HTML written as other formats, for the Convert tab of every app (Martin, 2026-11-01: "La conversion
// devrait être possible avec tous les Offices"): Markdown, plain text, RTF (opens in Word, WordPad, Pages), EPUB (an
// e-book for readers and phones), XML and JSON. Plain DOM walking, no library: headings, paragraphs, bold, italic,
// underline, links, lists, quotes, code and tables are kept; the rest becomes text.

import type { TableData } from '../shell/contract';

const BLOCK = /^(P|DIV|H[1-6]|UL|OL|LI|TABLE|TR|BLOCKQUOTE|PRE|SECTION|ARTICLE|HEADER|FOOTER|HR|FIGURE|FIGCAPTION)$/;
const parse = (html: string) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
const clean = (s: string) => s.replace(/ /g, ' ').replace(/[ \t]+/g, ' ');

// ---------- plain text ----------

/** The words of the HTML with a line break after each block, lists as "• " lines and tables as tab-separated rows. */
export function htmlToText(html: string): string {
  const out: string[] = [];
  let line = '';
  const flush = () => { if (line.trim()) out.push(line.trim()); line = ''; };
  const walk = (n: Node, prefix = '') => {
    if (n.nodeType === 3) { line += clean(n.nodeValue ?? ''); return; }
    if (n.nodeType !== 1) return;
    const el = n as Element, tag = el.tagName;
    if (tag === 'BR') { flush(); return; }
    if (tag === 'SCRIPT' || tag === 'STYLE') return;
    if (tag === 'TR') {
      flush();
      out.push(Array.from(el.children).map(c => clean(c.textContent ?? '').trim()).join('\t'));
      return;
    }
    if (tag === 'LI') {
      flush();
      const ol = el.parentElement?.tagName === 'OL';
      const n0 = ol ? Array.from(el.parentElement!.children).indexOf(el) + 1 : 0;
      line = `${prefix}${ol ? `${n0}. ` : '• '}`;
      for (const c of Array.from(el.childNodes)) {
        if (c.nodeType === 1 && /^(UL|OL)$/.test((c as Element).tagName)) { flush(); walk(c, `${prefix}  `); }
        // A list item's paragraph stays on the bullet's line.
        else if (c.nodeType === 1 && (c as Element).tagName === 'P') { if (line.trim().length > prefix.length + 2) line += ' '; for (const x of Array.from(c.childNodes)) walk(x, prefix); }
        else walk(c, prefix);
      }
      flush();
      return;
    }
    const block = BLOCK.test(tag);
    if (block) flush();
    for (const c of Array.from(el.childNodes)) walk(c, prefix);
    if (block) { flush(); if (/^H[1-6]$/.test(tag)) out.push(''); }
  };
  walk(parse(html));
  flush();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ---------- Markdown ----------

const mdEsc = (s: string) => s.replace(/([*_`\\[\]])/g, '\\$1');

/** Markdown for the HTML (CommonMark with GitHub tables). */
export function htmlToMarkdown(html: string): string {
  const inline = (n: Node): string => {
    if (n.nodeType === 3) return mdEsc(clean(n.nodeValue ?? ''));
    if (n.nodeType !== 1) return '';
    const el = n as Element, tag = el.tagName;
    const inner = () => Array.from(el.childNodes).map(inline).join('');
    const wrap = (m: string) => { const s = inner(); return s.trim() ? `${m}${s.trim()}${m}` : s; };
    switch (tag) {
      case 'STRONG': case 'B': return wrap('**');
      case 'EM': case 'I': return wrap('*');
      case 'S': case 'DEL': case 'STRIKE': return wrap('~~');
      case 'CODE': return `\`${el.textContent ?? ''}\``;
      case 'BR': return '  \n';
      case 'A': return `[${inner()}](${el.getAttribute('href') ?? ''})`;
      case 'IMG': return `![${el.getAttribute('alt') ?? ''}](${(el.getAttribute('src') ?? '').startsWith('data:') ? 'image' : el.getAttribute('src') ?? ''})`;
      default: return inner();
    }
  };
  const blocks: string[] = [];
  const list = (el: Element, depth: number) => {
    const ol = el.tagName === 'OL';
    Array.from(el.children).forEach((li, i) => {
      if (li.tagName !== 'LI') return;
      const text = Array.from(li.childNodes).filter(c => !(c.nodeType === 1 && /^(UL|OL)$/.test((c as Element).tagName))).map(inline).join('').trim();
      blocks.push(`${'  '.repeat(depth)}${ol ? `${i + 1}.` : '-'} ${text}`);
      li.querySelectorAll(':scope > ul, :scope > ol').forEach(sub => list(sub, depth + 1));
    });
  };
  const walk = (el: Element) => {
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 3) { const s = clean(n.nodeValue ?? '').trim(); if (s) blocks.push(mdEsc(s), ''); continue; }
      if (n.nodeType !== 1) continue;
      const c = n as Element, tag = c.tagName;
      if (/^H[1-6]$/.test(tag)) blocks.push(`${'#'.repeat(Number(tag[1]))} ${inline(c).trim()}`, '');
      else if (tag === 'P') { const s = inline(c).trim(); if (s) blocks.push(s, ''); }
      else if (tag === 'UL' || tag === 'OL') { list(c, 0); blocks.push(''); }
      else if (tag === 'BLOCKQUOTE') { blocks.push(...htmlToMarkdown(c.innerHTML).trim().split('\n').map(l => `> ${l}`), ''); }
      else if (tag === 'PRE') blocks.push('```', (c.textContent ?? '').replace(/\n$/, ''), '```', '');
      else if (tag === 'HR') blocks.push('---', '');
      else if (tag === 'TABLE') {
        const rows = Array.from(c.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(td => inline(td).trim().replace(/\|/g, '\\|').replace(/\n/g, ' ')));
        if (!rows.length) continue;
        const w = Math.max(...rows.map(r => r.length));
        const fill = (r: string[]) => [...r, ...Array(w - r.length).fill('')];
        blocks.push(`| ${fill(rows[0]).join(' | ')} |`, `|${' --- |'.repeat(w)}`, ...rows.slice(1).map(r => `| ${fill(r).join(' | ')} |`), '');
      } else if (tag === 'IMG') blocks.push(inline(c), '');
      else if (tag === 'STYLE' || tag === 'SCRIPT') continue;
      else if (BLOCK.test(tag) || c.querySelector('p, h1, h2, h3, ul, ol, table')) walk(c);
      else { const s = inline(c).trim(); if (s) blocks.push(s, ''); }
    }
  };
  walk(parse(html));
  return blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ---------- RTF ----------

/** RTF text: non-ASCII letters as \uN? so accents and every alphabet survive. */
function rtfText(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === '\\' || ch === '{' || ch === '}') out += `\\${ch}`;
    else if (ch === '\n') out += '\\line ';
    else if (code < 128) out += ch;
    else if (code < 0x10000) out += `\\u${code > 32767 ? code - 65536 : code}?`;
    else { const hi = Math.floor((code - 0x10000) / 0x400) + 0xd800, lo = ((code - 0x10000) % 0x400) + 0xdc00; out += `\\u${hi - 65536}?\\u${lo - 65536}?`; }
  }
  return out;
}

/** An RTF document for the HTML: headings, paragraphs, bold, italic, underline, strike, lists and tables. */
export function htmlToRtf(html: string, title = ''): string {
  const sizes: Record<string, number> = { H1: 40, H2: 32, H3: 28, H4: 24, H5: 22, H6: 22 };
  const inline = (n: Node): string => {
    if (n.nodeType === 3) return rtfText(clean(n.nodeValue ?? ''));
    if (n.nodeType !== 1) return '';
    const el = n as Element, tag = el.tagName;
    const inner = Array.from(el.childNodes).map(inline).join('');
    switch (tag) {
      case 'STRONG': case 'B': return `{\\b ${inner}}`;
      case 'EM': case 'I': return `{\\i ${inner}}`;
      case 'U': return `{\\ul ${inner}}`;
      case 'S': case 'DEL': case 'STRIKE': return `{\\strike ${inner}}`;
      case 'SUP': return `{\\super ${inner}}`;
      case 'SUB': return `{\\sub ${inner}}`;
      case 'BR': return '\\line ';
      case 'CODE': return `{\\f1 ${inner}}`;
      default: return inner;
    }
  };
  const out: string[] = [];
  const walk = (el: Element, depth = 0) => {
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 3) { const s = clean(n.nodeValue ?? '').trim(); if (s) out.push(`{\\pard\\sa160 ${rtfText(s)}\\par}`); continue; }
      if (n.nodeType !== 1) continue;
      const c = n as Element, tag = c.tagName;
      if (sizes[tag]) out.push(`{\\pard\\sb240\\sa120\\keepn\\b\\fs${sizes[tag]} ${inline(c)}\\par}`);
      else if (tag === 'P') out.push(`{\\pard\\sa160 ${inline(c)}\\par}`);
      else if (tag === 'UL' || tag === 'OL') {
        Array.from(c.children).forEach((li, i) => {
          if (li.tagName !== 'LI') return;
          const text = Array.from(li.childNodes).filter(x => !(x.nodeType === 1 && /^(UL|OL)$/.test((x as Element).tagName))).map(inline).join('');
          const mark = tag === 'OL' ? `${i + 1}.` : '\\bullet';
          out.push(`{\\pard\\fi-280\\li${360 + depth * 360}\\sa80 ${mark}\\tab ${text}\\par}`);
          li.querySelectorAll(':scope > ul, :scope > ol').forEach(sub => walk(Object.assign(document.createElement('div'), { innerHTML: sub.outerHTML }), depth + 1));
        });
      } else if (tag === 'TABLE') {
        for (const tr of Array.from(c.querySelectorAll('tr'))) {
          const cells = Array.from(tr.children);
          let row = '\\trowd\\trgaph108';
          cells.forEach((_, i) => { row += `\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs\\cellx${(i + 1) * 2000}`; });
          out.push(`${row}\n${cells.map(td => `\\pard\\intbl ${td.tagName === 'TH' ? `{\\b ${inline(td)}}` : inline(td)}\\cell`).join(' ')}\\row`);
        }
        out.push('\\pard\\par');
      } else if (tag === 'BLOCKQUOTE') out.push(`{\\pard\\li720\\i ${inline(c)}\\par}`);
      else if (tag === 'PRE') out.push(`{\\pard\\f1\\fs20 ${rtfText(c.textContent ?? '')}\\par}`);
      else if (tag === 'HR') out.push('{\\pard\\brdrb\\brdrs\\brdrw10\\par}');
      else if (tag === 'STYLE' || tag === 'SCRIPT') continue;
      else walk(c, depth);
    }
  };
  walk(parse(html));
  const info = title ? `{\\info{\\title ${rtfText(title)}}}` : '';
  return `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Calibri;}{\\f1 Consolas;}}${info}\\fs22\n${out.join('\n')}\n}`;
}

// ---------- EPUB ----------

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Well-formed XHTML for a piece of HTML, as an e-book needs. */
function xhtml(html: string): string {
  const body = parse(html);
  body.querySelectorAll('script, style').forEach(e => e.remove());
  return Array.from(body.childNodes).map(n => new XMLSerializer().serializeToString(n)).join('\n')
    .replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
}

/** An EPUB 3 e-book: one chapter per first-level heading (or one chapter), with its table of contents. */
export async function htmlToEpub(html: string, title: string, lang = 'en'): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const body = parse(html);
  const chapters: { title: string; html: string }[] = [];
  const top = body.querySelector('h1') ? 'H1' : body.querySelector('h2') ? 'H2' : null;
  for (const n of Array.from(body.childNodes)) {
    const el = n.nodeType === 1 ? n as Element : null;
    if (top && el?.tagName === top) chapters.push({ title: (el.textContent ?? '').trim(), html: '' });
    if (!chapters.length) chapters.push({ title: title || 'Text', html: '' });
    chapters[chapters.length - 1].html += el ? el.outerHTML : xmlEsc(n.textContent ?? '');
  }
  if (!chapters.length) chapters.push({ title: title || 'Text', html: '<p></p>' });
  const id = `urn:uuid:${crypto.randomUUID?.() ?? `${Date.now()}`}`;
  const page = (t: string, inner: string) => `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">\n<head><meta charset="utf-8"/><title>${xmlEsc(t)}</title><link rel="stylesheet" href="style.css"/></head>\n<body>\n${inner}\n</body>\n</html>\n`;
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>\n');
  zip.file('OEBPS/style.css', 'body{font-family:serif;line-height:1.5;margin:0 5%}h1,h2,h3{font-family:sans-serif;line-height:1.2}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}img{max-width:100%}');
  chapters.forEach((c, i) => zip.file(`OEBPS/c${i + 1}.xhtml`, page(c.title, xhtml(c.html))));
  zip.file('OEBPS/nav.xhtml', page(title, `<nav epub:type="toc" id="toc"><h1>${xmlEsc(title)}</h1><ol>${chapters.map((c, i) => `<li><a href="c${i + 1}.xhtml">${xmlEsc(c.title || `${i + 1}`)}</a></li>`).join('')}</ol></nav>`));
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">${id}</dc:identifier><dc:title>${xmlEsc(title || 'Document')}</dc:title><dc:language>${lang}</dc:language><dc:creator>Office In 1</dc:creator><meta property="dcterms:modified">${now}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${chapters.map((_, i) => `<item id="c${i + 1}" href="c${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('')}</spine></package>\n`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

// ---------- data ----------

/** Rows as objects named by the first row's titles (or "A", "B"… when the table has no titles). */
export function tableToObjects(table: TableData): Record<string, string | number>[] {
  const rows = table.rows.map(r => r.map(c => c.text));
  if (!rows.length) return [];
  const w = Math.max(...rows.map(r => r.length));
  // Titles when the table says so, or when the first row is all words over rows that hold numbers.
  const words = rows[0].every(x => x.trim() && Number.isNaN(Number(x)));
  const useHead = rows.length > 1 && words && (table.header === true || rows.slice(1).some(r => r.some(x => x.trim() !== '' && !Number.isNaN(Number(x)))));
  const head = useHead ? rows[0].map((h, i) => h.trim() || colName(i)) : Array.from({ length: w }, (_, i) => colName(i));
  return rows.slice(useHead ? 1 : 0).filter(r => r.some(x => x.trim())).map(r => {
    const o: Record<string, string | number> = {};
    head.forEach((h, i) => { const v = (r[i] ?? '').trim(); o[h] = v !== '' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v; });
    return o;
  });
}
const colName = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : colName(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

/** The document as JSON: tables as lists of rows, text as a list of blocks. */
export function toJson(title: string, html: string, tables: { name: string; table: TableData }[]): string {
  if (tables.length === 1) return JSON.stringify(tableToObjects(tables[0].table), null, 2) + '\n';
  if (tables.length > 1) return JSON.stringify(Object.fromEntries(tables.map(t => [t.name, tableToObjects(t.table)])), null, 2) + '\n';
  const blocks: { type: string; text: string; level?: number }[] = [];
  for (const el of Array.from(parse(html).querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, pre, blockquote'))) {
    if (el.tagName === 'P' && el.closest('li, blockquote')) continue;
    const text = clean(el.textContent ?? '').trim();
    if (!text) continue;
    const h = /^H([1-6])$/.exec(el.tagName);
    blocks.push(h ? { type: 'heading', level: Number(h[1]), text } : { type: el.tagName === 'LI' ? 'item' : el.tagName === 'PRE' ? 'code' : el.tagName === 'BLOCKQUOTE' ? 'quote' : 'paragraph', text });
  }
  return JSON.stringify({ title, blocks }, null, 2) + '\n';
}

/** The document as XML: tables as <row>/<cell>, text as headings and paragraphs. */
export function toXml(title: string, html: string, tables: { name: string; table: TableData }[]): string {
  const head = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  if (tables.length) {
    return `${head}<workbook title="${xmlEsc(title)}">\n${tables.map(t => `  <table name="${xmlEsc(t.name)}">\n${t.table.rows.map(r => `    <row>${r.map(c => `<cell${c.formula ? ` formula="${xmlEsc(c.formula)}"` : ''}>${xmlEsc(c.text)}</cell>`).join('')}</row>`).join('\n')}\n  </table>`).join('\n')}\n</workbook>\n`;
  }
  const items: string[] = [];
  for (const el of Array.from(parse(html).querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, pre'))) {
    if (el.tagName === 'P' && el.closest('li')) continue;
    const text = clean(el.textContent ?? '').trim();
    if (!text) continue;
    const h = /^H([1-6])$/.exec(el.tagName);
    items.push(h ? `  <heading level="${h[1]}">${xmlEsc(text)}</heading>` : `  <${el.tagName === 'LI' ? 'item' : el.tagName === 'PRE' ? 'code' : 'paragraph'}>${xmlEsc(text)}</${el.tagName === 'LI' ? 'item' : el.tagName === 'PRE' ? 'code' : 'paragraph'}>`);
  }
  return `${head}<document title="${xmlEsc(title)}">\n${items.join('\n')}\n</document>\n`;
}

/** Tables found in a piece of HTML. */
export function tablesInHtml(html: string): TableData[] {
  return Array.from(parse(html).querySelectorAll('table')).map(tb => ({
    rows: Array.from(tb.querySelectorAll('tr')).map(tr => Array.from(tr.children).filter(c => /^T[DH]$/.test(c.tagName)).map(td => ({
      text: clean((td as HTMLElement).textContent ?? '').trim(), ...(td.tagName === 'TH' ? { bold: true } : {}),
    }))),
    header: !!tb.querySelector('tr:first-child th'),
  })).filter(t => t.rows.length);
}
