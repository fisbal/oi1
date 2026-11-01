import { describe, it, expect } from 'vitest';
import { LOOKS, RATIOS, analyze, cropForRatio, enhance, mapUv, newDoc, outputSize, params, rotateGeom, sanitize, shadePixel, suggest, NEUTRAL } from '../model';

const doc = (w = 400, h = 200) => newDoc('data:image/png;base64,AAAA', w, h);

describe('In 1 Image model', () => {
  it('has 20+ looks and 20+ crop formats, all different', () => {
    expect(LOOKS.length).toBeGreaterThanOrEqual(30);
    expect(RATIOS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(LOOKS.map(l => l.id)).size).toBe(LOOKS.length);
  });
  it('maps result points to the original through turns, flips and crops', () => {
    const d = doc();
    expect(mapUv(0, 0, d)).toEqual([0, 0]);
    d.geom = rotateGeom(d.geom, 1); // a quarter turn right: the top-left of the result is the bottom-left of the original
    expect(outputSize(d)).toEqual({ w: 200, h: 400 });
    const [x, y] = mapUv(0, 0, d);
    expect(x).toBeCloseTo(0); expect(y).toBeCloseTo(1);
    d.geom = rotateGeom(d.geom, -1);
    d.geom.flipH = true;
    expect(mapUv(0, 0.5, d)[0]).toBeCloseTo(1);
  });
  it('crops to a ratio, centred, inside the photo', () => {
    const d = doc(400, 200);
    const sq = cropForRatio(1, d);
    expect(sq.h).toBeCloseTo(1); expect(sq.w).toBeCloseTo(0.5); expect(sq.x).toBeCloseTo(0.25);
    d.geom.crop = sq;
    expect(outputSize(d)).toEqual({ w: 200, h: 200 });
  });
  it('turning keeps the crop on the same part of the photo', () => {
    const d = doc(400, 200);
    d.geom.crop = { x: 0, y: 0, w: 0.5, h: 0.5 }; // top-left quarter
    const g = rotateGeom(d.geom, 1);
    // after turning right, the old top-left is at the top-right
    expect(g.crop.x).toBeCloseTo(0.5); expect(g.crop.y).toBeCloseTo(0);
    const back = rotateGeom(g, -1);
    expect(back.crop).toEqual(d.geom.crop);
  });
  it('neutral settings leave a pixel unchanged; exposure brightens', () => {
    const p = params({ adjust: { ...NEUTRAL }, look: null, lookAmount: 100 });
    const [r, g, b] = shadePixel(0.4, 0.5, 0.6, p);
    expect(r).toBeCloseTo(0.4); expect(g).toBeCloseTo(0.5); expect(b).toBeCloseTo(0.6);
    const q = params({ adjust: { ...NEUTRAL, exposure: 50 }, look: null, lookAmount: 100 });
    expect(shadePixel(0.4, 0.4, 0.4, q)[0]).toBeGreaterThan(0.5);
  });
  it('black & white look removes colour', () => {
    const p = params({ adjust: { ...NEUTRAL }, look: 'bw', lookAmount: 100 });
    const [r, g, b] = shadePixel(0.9, 0.2, 0.1, p);
    expect(Math.abs(r - g)).toBeLessThan(1e-6); expect(Math.abs(g - b)).toBeLessThan(1e-6);
  });
  it('a dark photo is called dark and Enhance brightens it', () => {
    const px = new Uint8ClampedArray(4 * 100);
    for (let i = 0; i < 100; i++) px.set([30 + i % 20, 30, 35, 255], i * 4);
    const s = analyze(px);
    expect(suggest(s)).toBe('dark');
    expect(enhance(s).exposure).toBeGreaterThan(0);
  });
  it('reads only safe documents', () => {
    expect(sanitize({ src: 'javascript:alert(1)' })).toBeNull();
    const d = sanitize({ src: 'data:image/png;base64,AAAA', w: 10, h: 10, adjust: { exposure: 900 }, geom: { crop: { x: 2, w: 9 } } })!;
    expect(d.adjust.exposure).toBe(100);
    expect(d.geom.crop.x + d.geom.crop.w).toBeLessThanOrEqual(1);
  });
});
