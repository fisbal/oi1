import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { readXlsx, xlsxBytes } from '../xlsx';
import { emptySheet, type WorkbookData } from '../sheet';

// A 1×1 transparent PNG (a signature's picture is a transparent PNG too).
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('xlsx pictures (signatures, logos)', () => {
  it('saves a picture where it sits and opens it again, next to a chart', async () => {
    const s = emptySheet('Sheet1');
    s.cells['0,0'] = { input: 'Total' }; s.cells['1,0'] = { input: '3' };
    s.charts = [{ id: 'c1', type: 'column', range: { c1: 0, r1: 0, c2: 1, r2: 0 }, x: 300, y: 20, w: 320, h: 200 } as never];
    s.pics = [{ id: 'p1', src: PNG, x: 40, y: 120, w: 190, h: 64, alt: 'Signature de Martin' }];
    const book: WorkbookData = { sheets: [s] };
    const bytes = await xlsxBytes(book);
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file('xl/media/image1.png')).toBeTruthy();
    expect(await zip.file('[Content_Types].xml')!.async('string')).toContain('Extension="png"');
    const back = (await readXlsx(bytes)).sheets[0];
    expect(back.pics).toHaveLength(1);
    expect(back.pics![0]).toMatchObject({ src: PNG, x: 40, y: 120, w: 190, h: 64, alt: 'Signature de Martin' });
    expect(back.charts).toHaveLength(1);
  });
  it('a sheet with only a picture still gets its drawing', async () => {
    const s = emptySheet('Feuille');
    s.pics = [{ id: 'p1', src: PNG, x: 0, y: 0, w: 50, h: 20 }];
    const back = (await readXlsx(await xlsxBytes({ sheets: [s] }))).sheets[0];
    expect(back.pics?.[0]).toMatchObject({ w: 50, h: 20 });
  });
});
