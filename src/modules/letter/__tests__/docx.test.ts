// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { docxToHtml, jsonToDocx, toHex } from '../docx';

const sample = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'Lettre de test' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'Bold ', marks: [{ type: 'bold' }] },
      { type: 'text', text: 'red', marks: [{ type: 'textStyle', attrs: { color: '#ff0000' } }] },
      { type: 'text', text: ' and a ' },
      { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
    ] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First point' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second point' }] }] },
    ] },
    { type: 'orderedList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step one' }] }] },
    ] },
    { type: 'table', content: [
      { type: 'tableRow', content: [
        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }] },
        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Amount' }] }] },
      ] },
      { type: 'tableRow', content: [
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rent' }] }] },
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1200' }] }] },
      ] },
    ] },
  ],
};

describe('docx', () => {
  it('normalizes colors for Word', () => {
    expect(toHex('#f00')).toBe('FF0000');
    expect(toHex('rgb(0, 128, 255)')).toBe('0080FF');
    expect(toHex('red')).toBeUndefined();
  });

  it('round-trips headings, marks, lists and tables', async () => {
    const blob = await jsonToDocx(sample, 'Lettre de test');
    const bytes = await blob.arrayBuffer();
    if (process.env.OI1_DOCX_OUT) (await import('node:fs')).writeFileSync(process.env.OI1_DOCX_OUT, Buffer.from(bytes));
    const html = await docxToHtml(bytes);
    expect(html).toContain('<h1>Lettre de test</h1>');
    expect(html).toContain('<strong>Bold </strong>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toMatch(/<ul><li>First point<\/li><li>Second point<\/li><\/ul>/);
    expect(html).toMatch(/<ol><li>Step one<\/li><\/ol>/);
    expect(html).toContain('<table>');
    expect(html).toContain('Rent');
  });
});
