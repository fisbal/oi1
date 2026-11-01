import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { htmlToEpub, htmlToMarkdown, htmlToRtf, htmlToText, tableToObjects, tablesInHtml, toJson, toXml } from '../textFormats';

const doc = '<h1>Report</h1><p>The <strong>roses</strong> grew <em>well</em>.</p><ul><li><p>One</p></li><li><p>Two</p></li></ul><table><tr><th>Fruit</th><th>Price</th></tr><tr><td>Apple</td><td>2</td></tr></table>';

describe('text formats', () => {
  it('writes Markdown with titles, bold, lists and tables', () => {
    const md = htmlToMarkdown(doc);
    expect(md).toContain('# Report');
    expect(md).toContain('The **roses** grew *well*.');
    expect(md).toContain('- One');
    expect(md).toContain('| Fruit | Price |');
    expect(md).toContain('| Apple | 2 |');
  });
  it('writes plain text with bullets and tab-separated rows', () => {
    const txt = htmlToText(doc);
    expect(txt).toContain('Report');
    expect(txt).toContain('• One');
    expect(txt).toContain('Apple\t2');
  });
  it('writes RTF with accents and every alphabet kept', () => {
    const rtf = htmlToRtf('<p>Été 日本 <b>gras</b></p>', 'Titre');
    expect(rtf.startsWith('{\\rtf1')).toBe(true);
    expect(rtf).toContain('\\u201?t\\u233?');
    expect(rtf).toContain('{\\b gras}');
    expect(rtf).toContain('\\u26085?');
  });
  it('makes an EPUB with the mimetype first and a chapter per title', async () => {
    const blob = await htmlToEpub('<h1>One</h1><p>a</p><h1>Two</h1><p>b</p>', 'Book', 'fr');
    const zip = await JSZip.loadAsync(blob);
    expect(Object.keys(zip.files)[0]).toBe('mimetype');
    expect(zip.file('OEBPS/c2.xhtml')).toBeTruthy();
    expect(await zip.file('OEBPS/content.opf')!.async('string')).toContain('<dc:language>fr</dc:language>');
  });
  it('turns a table into rows named by its titles, numbers as numbers', () => {
    const [t] = tablesInHtml(doc);
    expect(tableToObjects(t)).toEqual([{ Fruit: 'Apple', Price: 2 }]);
    expect(JSON.parse(toJson('x', doc, [{ name: 'S', table: t }]))).toEqual([{ Fruit: 'Apple', Price: 2 }]);
    expect(toXml('x', doc, [{ name: 'S', table: t }])).toContain('<cell>Apple</cell>');
  });
  it('gives a text as headings and paragraphs in JSON', () => {
    const j = JSON.parse(toJson('Doc', '<h2>Hi</h2><p>Text</p>', []));
    expect(j.blocks).toEqual([{ type: 'heading', level: 2, text: 'Hi' }, { type: 'paragraph', text: 'Text' }]);
  });
});
