// Drawing a document as pages out of sight, then as pictures: PNG, JPEG, WebP, SVG and a PDF made of page images
// (for the Convert tab). html-to-image (MIT) copies the page with its styles and fonts into a picture; pdf-lib (MIT)
// puts the pictures into a PDF.

import type { Pages } from '../../shell/convert';

export const A4 = { w: 794, h: 1123, pad: 72 };

/** A box out of sight, still laid out by the browser (display:none would give no size). */
export function offscreen(width: number): HTMLDivElement {
  const host = document.createElement('div');
  host.className = 'cv-offscreen';
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;pointer-events:none;z-index:-1;background:#fff`;
  document.body.appendChild(host);
  return host;
}

export async function settle(el: HTMLElement) {
  await Promise.all(Array.from(el.querySelectorAll('img')).map(i => (i.complete ? null : i.decode().catch(() => {}))));
  await (document.fonts?.ready ?? Promise.resolve());
  await new Promise(r => requestAnimationFrame(() => r(null)));
}

/** The HTML laid out on A4 pages. Pages break between blocks when they can, so lines are not cut in two. */
export async function htmlPages(html: string, css: string): Promise<Pages> {
  let { w, h } = A4;
  const { pad } = A4;
  const host = offscreen(w);
  const style = `<style>${css}</style>`;
  // Measure the whole text at the page's width once.
  host.innerHTML = `${style}<div class="cv-doc" style="width:${w - 2 * pad}px;padding:0;margin:0">${html}</div>`;
  let doc = host.querySelector('.cv-doc') as HTMLElement;
  await settle(host);
  // A wide sheet or table: wider pages (same A4 shape), so no column is cut off.
  const need = Math.max(...Array.from(doc.querySelectorAll('table, pre')).map(e => (e as HTMLElement).scrollWidth), doc.scrollWidth);
  if (need > w - 2 * pad + 1) {
    w = Math.min(4000, need + 2 * pad);
    h = Math.round((w * A4.h) / A4.w);
    host.style.width = `${w}px`;
    host.innerHTML = `${style}<div class="cv-doc" style="width:${w - 2 * pad}px;padding:0;margin:0">${html}</div>`;
    doc = host.querySelector('.cv-doc') as HTMLElement;
    await settle(host);
  }
  const inner = h - 2 * pad;
  const total = Math.max(1, doc.scrollHeight);
  // Break before a block that would cross the bottom of a page.
  const breaks: number[] = [0];
  const tops = Array.from(doc.children).map(c => { const e = c as HTMLElement; return { top: e.offsetTop, bottom: e.offsetTop + e.offsetHeight }; });
  let pageTop = 0;
  for (const b of tops) {
    if (b.bottom - pageTop > inner) {
      const at = b.top > pageTop && b.bottom - b.top <= inner ? b.top : pageTop + inner;
      breaks.push(at);
      pageTop = at;
      while (b.bottom - pageTop > inner) { pageTop += inner; breaks.push(pageTop); }
    }
  }
  if (!tops.length) while (pageTop + inner < total) { pageTop += inner; breaks.push(pageTop); }
  const content = doc.innerHTML;
  host.innerHTML = style;
  const nodes = breaks.map((top, i) => {
    const bottom = breaks[i + 1] ?? total;
    const page = document.createElement('div');
    page.className = 'cv-page';
    page.style.cssText = `position:relative;width:${w}px;height:${h}px;background:#fff;overflow:hidden;box-sizing:border-box`;
    page.innerHTML = `<div style="position:absolute;left:${pad}px;top:${pad}px;width:${w - 2 * pad}px;height:${Math.min(inner, bottom - top)}px;overflow:hidden"><div class="cv-doc" style="position:absolute;left:0;top:${-top}px;width:100%">${content}</div></div>`;
    host.appendChild(page);
    return page;
  });
  await settle(host);
  return { nodes, width: w, height: h, done: () => host.remove() };
}

export type Raster = 'png' | 'jpeg' | 'webp' | 'svg';

/** One page as a picture, twice as sharp as on screen. */
export async function pageImage(node: HTMLElement, kind: Raster, width: number, height: number): Promise<Blob> {
  const lib = await import('html-to-image');
  const opts = { width, height, pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: false, skipFonts: false };
  if (kind === 'svg') {
    const url = await lib.toSvg(node, opts);
    return new Blob([decodeURIComponent(url.slice(url.indexOf(',') + 1))], { type: 'image/svg+xml' });
  }
  const canvas = await lib.toCanvas(node, opts);
  const type = kind === 'png' ? 'image/png' : kind === 'jpeg' ? 'image/jpeg' : 'image/webp';
  return new Promise((ok, fail) => canvas.toBlob(b => (b ? ok(b) : fail(new Error('image'))), type, 0.92));
}

/** Every page as a picture: one file, or a .zip of numbered files when there are several. */
export async function pagesToImages(pages: Pages, kind: Raster, base: string): Promise<{ name: string; blob: Blob }> {
  const ext = kind === 'jpeg' ? 'jpg' : kind;
  const blobs: Blob[] = [];
  for (const n of pages.nodes) blobs.push(await pageImage(n, kind, pages.width, pages.height));
  if (blobs.length === 1) return { name: `${base}.${ext}`, blob: blobs[0] };
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  blobs.forEach((b, i) => zip.file(`${base} ${String(i + 1).padStart(2, '0')}.${ext}`, b));
  return { name: `${base} (${ext}).zip`, blob: await zip.generateAsync({ type: 'blob' }) };
}

/** A PDF made of page pictures: it looks exactly like the screen (text is not selectable). */
export async function pagesToPdf(pages: Pages, title: string): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator('Office In 1');
  // Points: 72 per inch; the screen has 96 pixels per inch.
  const pw = pages.width * 0.75, ph = pages.height * 0.75;
  for (const n of pages.nodes) {
    const jpg = await pageImage(n, 'jpeg', pages.width, pages.height);
    const img = await pdf.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
    pdf.addPage([pw, ph]).drawImage(img, { x: 0, y: 0, width: pw, height: ph });
  }
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/** Prints a web page through a hidden frame (the browser's "Save as PDF" gives a PDF with real, selectable text). */
export function printPage(html: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  const go = () => { frame.contentWindow!.focus(); frame.contentWindow!.print(); window.setTimeout(() => frame.remove(), 1000); };
  const imgs = Array.from(doc.images);
  if (!imgs.length) window.setTimeout(go, 60);
  else void Promise.all(imgs.map(i => i.decode().catch(() => {}))).then(go);
}
