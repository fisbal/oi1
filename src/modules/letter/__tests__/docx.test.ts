import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { readDocx } from '../docx/read';
import { headerSize, letterToDocx, toHex } from '../docx/write';
import { defaultStyles, type LetterDoc } from '../model';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAAJElEQVR4nGM4uUh9QBDDqMWjFo9aPGrxqMWjFo9aPGrxyLEYAB5P6H3GayASAAAAAElFTkSuQmCC';
const text = (t: string, marks?: JSONContent['marks']): JSONContent => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t });
const para = (content: JSONContent[], attrs?: Record<string, unknown>): JSONContent => ({ type: 'paragraph', attrs, content });

// A dark, rich letter like the specs people write in Word: dark page, gold and purple text, a spaced-out header.
function sample(): LetterDoc {
  const styles = defaultStyles();
  styles.normal = { font: 'Arial', size: 10.5, color: '#E8E6F0', before: 0, after: 6, lineHeight: 1.2 };
  styles.h1 = { font: 'Arial', size: 18, color: '#C9A227', bold: true, letterSpacing: 2, caps: true, before: 18, after: 6, lineHeight: 1 };
  return {
    page: {
      size: 'a4', orientation: 'portrait', margins: { top: 1, right: 0.8, bottom: 1, left: 0.8 },
      headerDistance: 0.4, footerDistance: 0.4, color: '#0B0B12', border: { w: 1.5, color: '#C9A227', space: 24 },
    },
    styles,
    lang: 'en-US',
    header: { type: 'doc', content: [para([text('CONFIDENTIAL', [{ type: 'textStyle', attrs: { color: '#9B6DFF', letterSpacing: 3 } }])], { textAlign: 'right' })] },
    footer: { type: 'doc', content: [para([text('Page '), { type: 'pageNumber', attrs: { kind: 'page' } }, text(' of '), { type: 'pageNumber', attrs: { kind: 'pages' } }], { textAlign: 'center' })] },
    body: {
      type: 'doc',
      content: [
        para([text('Aether Viewer')], { styleId: 'title' }),
        { type: 'heading', attrs: { level: 1 }, content: [text('Overview')] },
        para([
          text('Bold ', [{ type: 'bold' }]),
          text('purple', [{ type: 'textStyle', attrs: { color: '#9B6DFF', fontFamily: 'Georgia', fontSize: '14pt' } }]),
          text(' marked', [{ type: 'highlight', attrs: { color: '#3A2A00' } }]),
          text(' x'), text('2', [{ type: 'superscript' }]), text(' H'), text('2', [{ type: 'subscript' }]), text('O '),
          text('wide', [{ type: 'textStyle', attrs: { letterSpacing: 1.5, caps: true } }]),
          text(' and a '),
          text('link', [{ type: 'link', attrs: { href: 'https://example.com' } }]),
          text('\tafter a tab'),
        ], { lineHeight: '1.5', spaceBefore: 12, spaceAfter: 3, indentLeft: 18, indentFirst: 9, textAlign: 'justify' }),
        para([text('Callout')], { background: '#1E1B2E', borders: { left: { w: 3, color: '#C9A227', space: 6 } } }),
        { type: 'bulletList', content: [
          { type: 'listItem', content: [para([text('First point')]), { type: 'bulletList', content: [
            { type: 'listItem', content: [para([text('Nested point')])] },
          ] }] },
          { type: 'listItem', content: [para([text('Second point')])] },
        ] },
        { type: 'orderedList', content: [{ type: 'listItem', content: [para([text('Step one')])] }] },
        { type: 'table', content: [
          { type: 'tableRow', content: [
            { type: 'tableHeader', attrs: { background: '#2A2540' }, content: [para([text('Name')])] },
            { type: 'tableHeader', content: [para([text('Amount')])] },
          ] },
          { type: 'tableRow', content: [
            { type: 'tableCell', content: [para([text('Rent')])] },
            { type: 'tableCell', content: [para([text('1200')])] },
          ] },
        ] },
        { type: 'pageBreak' },
        para([{ type: 'image', attrs: { src: PNG, alt: 'logo', width: 40 } }, text(' after the image')]),
      ],
    },
  };
}

function find(node: JSONContent | null | undefined, pred: (n: JSONContent) => boolean): JSONContent | undefined {
  if (!node) return undefined;
  if (pred(node)) return node;
  for (const c of node.content ?? []) { const f = find(c, pred); if (f) return f; }
  return undefined;
}
const withText = (doc: JSONContent, t: string) => find(doc, n => n.type === 'text' && n.text === t);
const blockWith = (doc: JSONContent, t: string) => find(doc, n => (n.type === 'paragraph' || n.type === 'heading') && !!find(n, c => c.text === t));
const mark = (n: JSONContent | undefined, type: string) => n?.marks?.find(m => m.type === type);

describe('docx', () => {
  it('normalizes colors for Word', () => {
    expect(toHex('#f00')).toBe('FF0000');
    expect(toHex('rgb(0, 128, 255)')).toBe('0080FF');
    expect(toHex('red')).toBeUndefined();
  });

  it('reads image sizes from the file', () => {
    const bin = atob(PNG.split(',')[1]);
    expect(headerSize(Uint8Array.from(bin, c => c.charCodeAt(0)))).toEqual({ width: 40, height: 20 });
  });

  it('keeps page setup, colors, fonts, headers and footers through save and open', async () => {
    const bytes = await letterToDocx(sample(), 'Aether Viewer');
    if (process.env.OI1_DOCX_OUT) (await import('node:fs')).writeFileSync(process.env.OI1_DOCX_OUT, new Uint8Array(bytes));
    const back = await readDocx(bytes);

    // Page
    expect(back.page.size).toBe('a4');
    expect(back.page.orientation).toBe('portrait');
    expect(back.page.margins.left).toBeCloseTo(0.8, 2);
    expect(back.page.headerDistance).toBeCloseTo(0.4, 2);
    expect(back.page.color).toBe('#0B0B12');
    expect(back.page.border).toMatchObject({ color: '#C9A227', w: 1.5, space: 24 });
    expect(back.lang).toBe('en-US');

    // Styles
    expect(back.styles.normal).toMatchObject({ font: 'Arial', size: 10.5, color: '#E8E6F0', after: 6, lineHeight: 1.2 });
    expect(back.styles.h1).toMatchObject({ font: 'Arial', size: 18, color: '#C9A227', bold: true, caps: true, letterSpacing: 2 });

    // Header and footer, with page number fields
    expect(back.header && withText(back.header, 'CONFIDENTIAL')).toBeTruthy();
    expect(mark(withText(back.header!, 'CONFIDENTIAL'), 'textStyle')?.attrs).toMatchObject({ color: '#9B6DFF', letterSpacing: 3 });
    expect(find(back.header, n => n.type === 'paragraph')?.attrs?.textAlign).toBe('right');
    const footer = find(back.footer, n => n.type === 'paragraph')!;
    expect(footer.content?.map(n => n.type === 'pageNumber' ? `[${n.attrs?.kind}]` : n.text).join('')).toBe('Page [page] of [pages]');

    // Body
    const body = back.body;
    expect(blockWith(body, 'Aether Viewer')?.attrs?.styleId).toBe('title');
    expect(blockWith(body, 'Overview')).toMatchObject({ type: 'heading', attrs: { level: 1 } });
    expect(mark(withText(body, 'Bold '), 'bold')).toBeTruthy();
    expect(mark(withText(body, 'purple'), 'textStyle')?.attrs).toMatchObject({ color: '#9B6DFF', fontFamily: 'Georgia', fontSize: '14pt' });
    expect(mark(withText(body, ' marked'), 'highlight')?.attrs?.color).toBe('#3A2A00');
    expect(find(body, n => n.text === '2' && !!mark(n, 'superscript'))).toBeTruthy();
    expect(find(body, n => n.text === '2' && !!mark(n, 'subscript'))).toBeTruthy();
    expect(mark(withText(body, 'wide'), 'textStyle')?.attrs).toMatchObject({ letterSpacing: 1.5, caps: true });
    expect(mark(withText(body, 'link'), 'link')?.attrs?.href).toBe('https://example.com');
    expect(withText(body, '\tafter a tab')).toBeTruthy();
    expect(blockWith(body, 'Bold ')?.attrs).toMatchObject({ lineHeight: '1.5', spaceBefore: 12, spaceAfter: 3, indentLeft: 18, indentFirst: 9, textAlign: 'justify' });
    expect(blockWith(body, 'Callout')?.attrs).toMatchObject({ background: '#1E1B2E', borders: { left: { w: 3, color: '#C9A227', space: 6 } } });

    // Lists, table, page break and image
    const bullets = find(body, n => n.type === 'bulletList')!;
    expect(bullets.content).toHaveLength(2);
    expect(find(bullets.content![0], n => n.type === 'bulletList' && !!withText(n, 'Nested point'))).toBeTruthy();
    expect(find(body, n => n.type === 'orderedList' && !!withText(n, 'Step one'))).toBeTruthy();
    const table = find(body, n => n.type === 'table')!;
    expect(table.content).toHaveLength(2);
    expect(table.content![0].content![0]).toMatchObject({ type: 'tableHeader', attrs: { background: '#2A2540' } });
    expect(table.content![1].content![0].type).toBe('tableCell');
    expect(table.attrs?.borders).toBeUndefined();
    expect(find(body, n => n.type === 'pageBreak')).toBeTruthy();
    const img = find(body, n => n.type === 'image')!;
    expect(img.attrs?.src).toMatch(/^data:image\/png;base64,/);
    expect(img.attrs?.width).toBe(40);
    expect(blockWith(body, ' after the image')?.content?.[0].type).toBe('image');
  });
});

describe('list styles, alt text and hyphenation', () => {
  it('keep their look through save and open', async () => {
    const doc = sample();
    doc.page.hyphenate = true;
    const item = (t: string): JSONContent => ({ type: 'listItem', content: [para([text(t)])] });
    doc.body = { type: 'doc', content: [
      { type: 'bulletList', attrs: { listStyle: 'check' }, content: [item('Done'), item('Also done')] },
      { type: 'orderedList', attrs: { listStyle: 'upper-roman' }, content: [item('First part')] },
      { type: 'orderedList', attrs: { listStyle: 'decimal-paren' }, content: [item('Choice')] },
      { type: 'bulletList', content: [item('Plain bullet')] },
      para([{ type: 'image', attrs: { src: PNG, alt: 'A gold bar', width: 40 } }]),
    ] };
    const back = await readDocx(await letterToDocx(doc, 'Lists'));
    const listWith = (t: string) => find(back.body, n => (n.type === 'bulletList' || n.type === 'orderedList') && !!withText(n, t));
    expect(listWith('Done')?.attrs?.listStyle).toBe('check');
    expect(listWith('First part')?.attrs?.listStyle).toBe('upper-roman');
    expect(listWith('Choice')?.attrs?.listStyle).toBe('decimal-paren');
    expect(listWith('Plain bullet')?.attrs?.listStyle ?? null).toBeNull();
    expect(find(back.body, n => n.type === 'image')?.attrs?.alt).toBe('A gold bar');
    expect(back.page.hyphenate).toBe(true);
  });
});

describe('Word files written by other programs', () => {
  it('reads a letter saved by LibreOffice', async () => {
    const { readFileSync } = await import('node:fs');
    const buf = readFileSync(`${process.cwd()}/src/modules/letter/__tests__/fixtures/libreoffice.docx`);
    const doc = await readDocx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    expect(doc.page).toMatchObject({ size: 'a4', color: '#0B0B12' });
    expect(doc.styles.h1).toMatchObject({ font: 'Arial', color: '#C9A227', caps: true });
    expect(doc.header && withText(doc.header, 'CONFIDENTIAL')).toBeTruthy();
    expect(find(doc.footer, n => n.type === 'pageNumber' && n.attrs?.kind === 'pages')).toBeTruthy();
    expect(mark(withText(doc.body, 'purple'), 'textStyle')?.attrs).toMatchObject({ color: '#9B6DFF', fontFamily: 'Georgia' });
    expect(find(doc.body, n => n.type === 'bulletList')?.content).toHaveLength(2);
    expect(find(doc.body, n => n.type === 'image')).toBeTruthy();
  });
});
