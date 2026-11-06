// Cells pasted from Excel, Google Sheets, LibreOffice and web pages keep their look (Martin, 2026-11-06).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cellsFromHtml, cellsFromText, cssColor } from '../pasteHtml';
import { parseCsv } from '../csv';

const excel = readFileSync('src/formats/__tests__/fixtures/excel-clip.html', 'utf8');

describe('pasting cells from other programs', () => {
  it('reads Excel’s clipboard: colours, bold, italic, borders, money, merges and widths', () => {
    const b = cellsFromHtml(excel, true)!;
    expect(b.cols).toBe(3);
    expect(b.rows).toBe(3);
    expect(b.cells['0,0']).toEqual({ input: 'Nom du produit', style: { bold: true, color: '#ffffff', fill: '#4472c4' } });
    expect(b.cells['1,1']).toEqual({ input: '1234.5', style: { format: 'currency', currency: 'EUR', signFirst: false, borders: { top: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' } } } });
    expect(b.cells['2,1']).toMatchObject({ input: '9.99', style: { format: 'currency', currency: 'USD', italic: true, color: '#c00000', fill: '#ffff00' } });
    expect(b.cells['0,2']).toMatchObject({ input: 'Total', style: { align: 'center', valign: 'middle' } });
    expect(b.merges).toEqual([{ c1: 0, r1: 2, c2: 1, r2: 2 }]);
    expect(b.widths[0]).toBe(136);
    expect(b.cells['2,2']).toMatchObject({ input: '0.25', style: { format: 'percent' } });
  });

  it('reads the browser’s own copy of Excel cells (styles inlined, no number format)', () => {
    const html = '<table><tbody><tr><td x:num="9.99" style="color: rgb(192, 0, 0); font-style: italic; background: rgb(255, 255, 0); border: 0.5pt solid windowtext;">$9,99</td>'
      + '<td style="font-weight: 700; font-size: 14pt; font-family: Georgia, serif; white-space: normal;">Titre</td></tr></tbody></table>';
    const b = cellsFromHtml(html, true)!;
    expect(b.cells['0,0']).toMatchObject({ input: '9.99', style: { format: 'currency', currency: 'USD', italic: true, color: '#c00000', fill: '#ffff00' } });
    expect(b.cells['0,0'].style?.borders?.top).toEqual({ style: 'thin' });
    expect(b.cells['1,0']).toEqual({ input: 'Titre', style: { bold: true, font: 'Georgia', size: 14, wrap: true } });
  });

  it('reads Google Sheets and LibreOffice tables', () => {
    const g = cellsFromHtml('<google-sheets-html-origin><table><tr><td style="background-color:#ff0000;color:#ffffff;font-weight:bold;" data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:42}">42</td></tr></table>', false)!;
    expect(g.cells['0,0']).toEqual({ input: '42', style: { bold: true, color: '#ffffff', fill: '#ff0000' } });
    const lo = cellsFromHtml('<table><tr><td bgcolor="#FFFF00" sdval="3.5"><font color="#FF0000"><b>3,5</b></font></td><td rowspan="2">x</td></tr><tr><td>y</td></tr></table>', true)!;
    expect(lo.cells['0,0']).toEqual({ input: '3.5', style: { bold: true, color: '#ff0000', fill: '#ffff00' } });
    expect(lo.merges).toEqual([{ c1: 1, r1: 0, c2: 1, r2: 1 }]);
    expect(lo.cells['0,1']).toEqual({ input: 'y' });
  });

  it('reads plain text from any app like typed entries', () => {
    const b = cellsFromText('Article\tPrix\r\nPomme\t1 234,50 €\r\nPoire\t12,5\r\n', true, t => parseCsv(t, '\t'));
    expect(b.cols).toBe(2);
    expect(b.rows).toBe(3);
    expect(b.cells['1,1']).toEqual({ input: '1234.50', style: { format: 'currency', currency: 'EUR', signFirst: false } });
    expect(b.cells['1,2']).toEqual({ input: '12,5' }); // read as 12.5 like a typed entry
  });

  it('shows the money sign where Excel put it, in any language', async () => {
    const { display } = await import('../sheet');
    const b = cellsFromHtml(excel, true)!;
    expect(display(9.99, b.cells['2,1'].style, 'fr', 'EUR')).toBe('$9,99');
    expect(display(1234.5, b.cells['1,1'].style, 'en', 'USD')).toBe('1,234.50\u00a0€');
    expect(display(-5, { format: 'currency', currency: 'CHF', signFirst: true }, 'en', 'USD')).toBe('-CHF\u00a05.00');
  });

  it('understands CSS colours', () => {
    expect(cssColor('windowtext')).toBe('#000000');
    expect(cssColor('#ABC')).toBe('#aabbcc');
    expect(cssColor('rgba(0, 0, 0, 0)')).toBeUndefined();
    expect(cssColor('rgb(68, 114, 196)')).toBe('#4472c4');
  });
});
