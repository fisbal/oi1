import { describe, expect, it } from 'vitest';
import { cleanShape, fitShape, fromSvg, newDrawing, PALETTES, PAPERS, recognize, sanitize, simplify, SIZES, STICKERS, toSvg, type PathShape } from '../model';
import { TEMPLATES } from '../templates';
import { shapesFromAnswer } from '../ai';

const pen = (points: number[]): PathShape => ({ id: 'p', kind: 'path', points, fill: null, stroke: '#000', width: 3, dash: 'solid', opacity: 1 });
const ring = (cx: number, cy: number, rx: number, ry: number, n = 25, wobble = 0) =>
  Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / (n - 1)) * Math.PI * 2) * (1 + (i % 3) * wobble), cy + ry * Math.sin((i / (n - 1)) * Math.PI * 2)]).flat();

describe('In 1 Draw model', () => {
  it('has 20+ choices in every list', () => {
    for (const list of [SIZES, PAPERS, PALETTES, STICKERS, TEMPLATES]) expect(list.length).toBeGreaterThanOrEqual(20);
  });

  it('tidies a sketched circle, box, triangle and line', () => {
    expect(recognize(pen(ring(200, 200, 80, 80, 25, 0.03)))).toMatchObject({ kind: 'geom', geom: 'ellipse' });
    expect(recognize(pen(simplify(ring(200, 200, 80, 50, 60, 0.02), 0.6)))).toMatchObject({ kind: 'geom', geom: 'ellipse' });
    // A circle that ends exactly where it began stays a circle (it once became a dot).
    const closed = simplify(ring(300, 300, 100, 100, 25), 0.6);
    expect(closed.length).toBeGreaterThan(10);
    expect(recognize(pen(closed))).toMatchObject({ kind: 'geom', geom: 'ellipse' });
    const box = [0, 0, 50, 1, 100, 0, 101, 40, 100, 80, 50, 81, 0, 80, 1, 40, 0, 2];
    expect(recognize(pen(box))).toMatchObject({ kind: 'geom', geom: 'rect' });
    expect(recognize(pen([0, 100, 25, 50, 50, 0, 75, 50, 100, 100, 50, 101, 2, 100]))).toMatchObject({ geom: 'triangle' });
    expect(recognize(pen([0, 0, 50, 51, 100, 100]))).toMatchObject({ kind: 'line' });
    expect(recognize(pen([0, 0, 100, 10, 0, 50, 100, 90]))).toBeNull();
  });

  it('saves to SVG and opens it again with every shape', () => {
    const d = newDrawing();
    d.shapes = [
      { id: 'a', kind: 'geom', geom: 'star5', x: 10, y: 20, w: 100, h: 80, rot: 15, fill: '#FF0000', stroke: '#000000', width: 2, dash: 'dash', opacity: 0.8, text: 'Star & <b>' },
      { id: 'b', kind: 'text', x: 0, y: 0, w: 200, h: 40, rot: 0, text: 'Bonjour "Martin"', font: 'Georgia', size: 32, bold: true, italic: false, align: 'left', fill: '#112233', stroke: null, width: 0, dash: 'solid', opacity: 1 },
      { id: 'c', kind: 'line', x1: 0, y1: 0, x2: 100, y2: 50, head: 'end', fill: null, stroke: '#00FF00', width: 4, dash: 'solid', opacity: 1 },
    ];
    const svg = toSvg(d);
    expect(svg).not.toContain('<b>');
    const back = fromSvg(svg)!;
    expect(back.shapes).toHaveLength(3);
    expect(back.shapes[0]).toMatchObject({ geom: 'star5', text: 'Star & <b>', rot: 15 });
    expect(back.shapes[1]).toMatchObject({ text: 'Bonjour "Martin"', font: 'Georgia' });
  });

  it('keeps unsafe things out of a drawing', () => {
    expect(cleanShape({ kind: 'image', x: 0, y: 0, w: 10, h: 10, src: 'javascript:alert(1)' })).toBeNull();
    expect(cleanShape({ kind: 'geom', geom: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'red" onload="alert(1)' })).toMatchObject({ fill: null });
    const d = sanitize({ w: 1e9, h: -5, shapes: [{ kind: 'script' }, { kind: 'text', text: '<script>x</script>', x: 0, y: 0, w: 10, h: 10 }] });
    expect(d.shapes).toHaveLength(1);
    expect(toSvg(d)).not.toContain('<script>');
    expect(d.w).toBeLessThanOrEqual(20000);
  });

  it('resizes a shape with the box around it', () => {
    const s = { id: 'g', kind: 'geom' as const, geom: 'rect' as const, x: 10, y: 10, w: 20, h: 20, rot: 0, fill: null, stroke: '#000', width: 1, dash: 'solid' as const, opacity: 1 };
    expect(fitShape(s, { x: 10, y: 10, w: 20, h: 20 }, { x: 0, y: 0, w: 40, h: 80 })).toMatchObject({ x: 0, y: 0, w: 40, h: 80 });
  });

  it('makes AI answers into shapes, ignoring unknown kinds', () => {
    const got = shapesFromAnswer('Here:\n```json\n{"shapes":[{"type":"rect","x":1,"y":2,"w":3,"h":4,"fill":"#FFFFFF","color":"#000000","text":"A"},{"type":"virus","x":0,"y":0,"w":1,"h":1,"fill":"","color":"","text":""},{"type":"arrow","x":0,"y":0,"w":10,"h":0,"fill":"none","color":"#123456","text":""}]}\n```');
    expect(got.map(s => s.kind)).toEqual(['geom', 'line']);
  });

  it('builds every ready drawing inside its page', () => {
    const d = newDrawing();
    for (const tpl of TEMPLATES) {
      const shapes = tpl.build(d, l => l[0]);
      expect(shapes.length, tpl.id).toBeGreaterThan(2);
    }
  });
});
