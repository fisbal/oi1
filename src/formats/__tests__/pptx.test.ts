import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { readPptx, writePptx, htmlParagraphs } from '../pptx';
import { newDeck, newSlide, placeholder, THEMES, type Deck } from '../slides';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function sample(): Deck {
  const d = newDeck(THEMES[1]);
  d.slides[0].items[0] = { ...d.slides[0].items[0], html: '<p>Bonjour <strong>Martin</strong></p>' } as typeof d.slides[0]['items'][0];
  const s = newSlide('content', d);
  s.items = [
    placeholder('content', 'title', d.w, d.h, '<p>Plan</p>'),
    placeholder('content', 'body', d.w, d.h, '<ul><li><p>Un</p><ul><li><p>Un et demi</p></li></ul></li><li><p><span style="color: #FF0000; font-size: 32pt">Deux</span></p></li></ul>'),
    { id: 'r', kind: 'shape', geom: 'roundRect', x: 100, y: 500, w: 200, h: 100, html: '<p>Forme</p>' },
    { id: 'l', kind: 'shape', geom: 'arrow', x: 400, y: 500, w: 200, h: 0, html: '' },
    { id: 'p', kind: 'image', x: 700, y: 450, w: 100, h: 100, src: PNG, alt: 'point' },
    { id: 't', kind: 'table', x: 820, y: 420, w: 360, h: 120, rows: [['A', 'B'], ['1', '2']], header: true, banded: true },
  ];
  s.notes = 'Dire bonjour\nPuis le plan';
  s.transition = 'fade';
  s.speed = 'slow';
  d.slides.push(s, { ...newSlide('section', d), hidden: true });
  return d;
}

describe('pptx', () => {
  it('reads list levels and run styles from editor HTML', () => {
    const ps = htmlParagraphs('<ul><li><p>a</p><ul><li><p><strong>b</strong></p></li></ul></li></ul><p style="text-align: center">c</p>');
    expect(ps.map(p => [p.lvl, p.list, p.align ?? null])).toEqual([[0, 'ul', null], [1, 'ul', null], [0, null, 'center']]);
    expect(ps[1].runs[0].st.b).toBe(true);
  });

  it('writes a deck and reads it back the same', async () => {
    const d = sample();
    const blob = await writePptx(d, 'fr-FR', 'Test');
    const buf = await new Promise<ArrayBuffer>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as ArrayBuffer); fr.readAsArrayBuffer(blob); });
    if (process.env.PPTX_OUT) writeFileSync(process.env.PPTX_OUT, Buffer.from(buf));
    const back = await readPptx(buf);
    expect([back.w, back.h]).toEqual([1280, 720]);
    expect(back.theme.id).toBe('scene');
    expect(back.slides.map(s => s.layout)).toEqual(['title', 'content', 'section']);
    expect(back.slides[2].hidden).toBe(true);
    const s = back.slides[1];
    expect(s.notes).toBe('Dire bonjour\nPuis le plan');
    expect([s.transition, s.speed]).toEqual(['fade', 'slow']);
    const title = s.items.find(i => i.kind === 'shape' && i.role === 'title');
    expect(title && title.kind === 'shape' && title.html).toBe('<p>Plan</p>');
    const body = s.items.find(i => i.kind === 'shape' && i.role === 'body');
    expect(body && body.kind === 'shape' && body.html).toContain('<ul><li><p>Un</p><ul><li><p>Un et demi</p></li></ul></li><li><p><span style="font-size: 32pt; color: #FF0000">Deux</span></p></li></ul>');
    const shape = s.items.find(i => i.kind === 'shape' && i.geom === 'roundRect');
    expect(shape && [shape.x, shape.y, shape.w, shape.h]).toEqual([100, 500, 200, 100]);
    expect(s.items.some(i => i.kind === 'shape' && i.geom === 'arrow')).toBe(true);
    const img = s.items.find(i => i.kind === 'image');
    expect(img && img.kind === 'image' && img.src.startsWith('data:image/png;base64,')).toBe(true);
    const table = s.items.find(i => i.kind === 'table');
    expect(table && table.kind === 'table' && table.rows).toEqual([['A', 'B'], ['1', '2']]);
    expect(table && table.kind === 'table' && table.header).toBe(true);
    const first = back.slides[0].items.find(i => i.kind === 'shape' && i.role === 'title');
    expect(first && first.kind === 'shape' && first.html).toBe('<p>Bonjour <strong>Martin</strong></p>');
  });
});
