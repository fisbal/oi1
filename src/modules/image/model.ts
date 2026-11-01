// In 1 Image: the photo, kept as the original plus a list of settings (non-destructive). Everything here is pure
// (no DOM), so the same maths runs in the GPU shader, the CPU fallback and the unit tests.

export const ADJUST_KEYS = [
  'exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks',
  'temp', 'tint', 'saturation', 'vibrance', 'hue',
  'sharpen', 'clarity', 'vignette', 'grain', 'fade',
] as const;
export type AdjustKey = typeof ADJUST_KEYS[number];
/** Every setting goes from -100 to 100 (grain and fade from 0 to 100); 0 = unchanged. */
export type Adjust = Record<AdjustKey, number>;
export const NEUTRAL: Adjust = Object.fromEntries(ADJUST_KEYS.map(k => [k, 0])) as Adjust;
export const POSITIVE_ONLY: AdjustKey[] = ['sharpen', 'grain', 'fade'];
export const ADJUST_GROUPS: { id: 'light' | 'color' | 'detail' | 'effects'; keys: AdjustKey[] }[] = [
  { id: 'light', keys: ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks'] },
  { id: 'color', keys: ['temp', 'tint', 'saturation', 'vibrance', 'hue'] },
  { id: 'detail', keys: ['sharpen', 'clarity'] },
  { id: 'effects', keys: ['vignette', 'grain', 'fade'] },
];

export interface Tone { shadow: [number, number, number]; light: [number, number, number]; amount: number; mono?: boolean }
export interface Look { id: string; adjust: Partial<Adjust>; tone?: Tone; mono?: boolean }

/** 31 looks, each previewed on the person's own photo. */
export const LOOKS: Look[] = [
  { id: 'vivid', adjust: { contrast: 18, saturation: 22, vibrance: 25, clarity: 12 } },
  { id: 'warm', adjust: { temp: 35, vibrance: 10, exposure: 4 } },
  { id: 'cool', adjust: { temp: -35, tint: -4, contrast: 6 } },
  { id: 'bw', adjust: { contrast: 15 }, mono: true },
  { id: 'noir', adjust: { contrast: 45, blacks: -25, vignette: 35, clarity: 20 }, mono: true },
  { id: 'sepia', adjust: { contrast: 8, fade: 10 }, mono: true, tone: { shadow: [0.44, 0.31, 0.2], light: [1, 0.9, 0.72], amount: 0.85, mono: true } },
  { id: 'vintage', adjust: { fade: 30, saturation: -25, temp: 18, vignette: 25, contrast: -8 }, tone: { shadow: [0.25, 0.32, 0.4], light: [1, 0.92, 0.75], amount: 0.25 } },
  { id: 'film', adjust: { fade: 18, grain: 28, contrast: 10, saturation: -10 }, tone: { shadow: [0.1, 0.25, 0.3], light: [1, 0.95, 0.85], amount: 0.2 } },
  { id: 'fade', adjust: { fade: 45, contrast: -15, saturation: -15 } },
  { id: 'matte', adjust: { fade: 28, contrast: -10, blacks: 20, vibrance: 8 } },
  { id: 'tealOrange', adjust: { contrast: 15, vibrance: 15 }, tone: { shadow: [0, 0.45, 0.55], light: [1, 0.7, 0.4], amount: 0.35 } },
  { id: 'golden', adjust: { temp: 45, exposure: 6, highlights: -15, vibrance: 15 }, tone: { shadow: [0.35, 0.2, 0.1], light: [1, 0.82, 0.45], amount: 0.2 } },
  { id: 'moon', adjust: { temp: -40, exposure: -8, contrast: 12, saturation: -35 }, tone: { shadow: [0.05, 0.1, 0.3], light: [0.8, 0.9, 1], amount: 0.3 } },
  { id: 'pastel', adjust: { exposure: 10, contrast: -25, saturation: -10, fade: 20, highlights: -10 } },
  { id: 'dramatic', adjust: { contrast: 40, clarity: 35, shadows: -15, highlights: -25, vignette: 30, saturation: -10 } },
  { id: 'cinema', adjust: { contrast: 22, saturation: -12, fade: 8 }, tone: { shadow: [0.05, 0.3, 0.35], light: [1, 0.8, 0.6], amount: 0.3 } },
  { id: 'instant', adjust: { fade: 25, temp: 12, contrast: -5, vignette: 20, saturation: -8 }, tone: { shadow: [0.2, 0.35, 0.3], light: [1, 0.95, 0.8], amount: 0.2 } },
  { id: 'lomo', adjust: { contrast: 35, saturation: 30, vignette: 55 } },
  { id: 'cross', adjust: { contrast: 20, saturation: 15, tint: -12 }, tone: { shadow: [0.1, 0.2, 0.45], light: [1, 1, 0.6], amount: 0.35 } },
  { id: 'seventies', adjust: { temp: 30, fade: 22, saturation: 10, hue: -6 }, tone: { shadow: [0.35, 0.2, 0.15], light: [1, 0.85, 0.6], amount: 0.3 } },
  { id: 'summer', adjust: { exposure: 8, temp: 22, vibrance: 30, shadows: 15 } },
  { id: 'winter', adjust: { temp: -30, exposure: 8, saturation: -20, highlights: 10 } },
  { id: 'forest', adjust: { tint: -18, contrast: 12, vibrance: 12, shadows: 8 } },
  { id: 'desert', adjust: { temp: 38, tint: 8, saturation: -10, fade: 10, contrast: 8 } },
  { id: 'ocean', adjust: { temp: -18, tint: -8, vibrance: 25, clarity: 10 } },
  { id: 'rose', adjust: { tint: 22, temp: 8, fade: 12, exposure: 5 } },
  { id: 'neon', adjust: { contrast: 30, saturation: 45, hue: 10, clarity: 15 } },
  { id: 'duotone', adjust: { contrast: 25 }, mono: true, tone: { shadow: [0.2, 0.05, 0.4], light: [1, 0.55, 0.65], amount: 1, mono: true } },
  { id: 'highKey', adjust: { exposure: 25, contrast: -20, shadows: 30, highlights: 10, saturation: -10 } },
  { id: 'lowKey', adjust: { exposure: -20, contrast: 25, highlights: -20, vignette: 30 } },
  { id: 'crisp', adjust: { clarity: 40, sharpen: 40, contrast: 10, vibrance: 10 } },
];

export interface Crop { x: number; y: number; w: number; h: number }
export interface Geom { rot: 0 | 1 | 2 | 3; flipH: boolean; flipV: boolean; angle: number; crop: Crop }
export interface ImageDoc {
  v: 1;
  /** The original picture (data URL); never changed. */
  src: string;
  w: number;
  h: number;
  geom: Geom;
  adjust: Adjust;
  look: string | null;
  lookAmount: number;
}
export const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 };
export const newDoc = (src: string, w: number, h: number): ImageDoc => ({
  v: 1, src, w, h, geom: { rot: 0, flipH: false, flipV: false, angle: 0, crop: { ...FULL } }, adjust: { ...NEUTRAL }, look: null, lookAmount: 100,
});

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Reads a saved or opened document defensively (a .oi1img file can be anything). */
export function sanitize(o: unknown): ImageDoc | null {
  if (!o || typeof o !== 'object') return null;
  const d = o as Partial<ImageDoc>;
  if (typeof d.src !== 'string' || !/^data:image\/(png|jpeg|webp|gif|avif|bmp);base64,/.test(d.src)) return null;
  const g = (d.geom ?? {}) as Partial<Geom>;
  const c = (g.crop ?? FULL) as Partial<Crop>;
  const x = clamp(num(c.x), 0, 0.99), y = clamp(num(c.y), 0, 0.99);
  const adjust = { ...NEUTRAL };
  for (const k of ADJUST_KEYS) adjust[k] = clamp(num((d.adjust as Partial<Adjust> | undefined)?.[k]), POSITIVE_ONLY.includes(k) ? 0 : -100, 100);
  return {
    v: 1, src: d.src, w: Math.max(1, num(d.w, 1)), h: Math.max(1, num(d.h, 1)),
    geom: { rot: ([0, 1, 2, 3].includes(num(g.rot)) ? num(g.rot) : 0) as Geom['rot'], flipH: !!g.flipH, flipV: !!g.flipV, angle: clamp(num(g.angle), -45, 45),
      crop: { x, y, w: clamp(num(c.w, 1), 0.01, 1 - x), h: clamp(num(c.h, 1), 0.01, 1 - y) } },
    adjust, look: typeof d.look === 'string' && LOOKS.some(l => l.id === d.look) ? d.look : null, lookAmount: clamp(num(d.lookAmount, 100), 0, 100),
  };
}

// ---------------------------------------------------------------- geometry
/** Size of the picture after the quarter turns (before the crop). */
export const oriented = (d: Pick<ImageDoc, 'w' | 'h' | 'geom'>) => (d.geom.rot % 2 ? { w: d.h, h: d.w } : { w: d.w, h: d.h });
/** Size of the result in pixels. */
export function outputSize(d: Pick<ImageDoc, 'w' | 'h' | 'geom'>) {
  const o = oriented(d);
  return { w: Math.max(1, Math.round(o.w * d.geom.crop.w)), h: Math.max(1, Math.round(o.h * d.geom.crop.h)) };
}
/** Zoom that keeps a straightened picture covering its frame (no empty corners). */
export function coverScale(angleDeg: number, w: number, h: number) {
  const a = Math.abs((angleDeg * Math.PI) / 180);
  return Math.cos(a) + Math.sin(a) * Math.max(w / h, h / w);
}
/**
 * From a point of the result (u, v in 0..1) to the point of the original picture to read (0..1).
 * Same steps as the shader: crop -> straighten -> flip -> quarter turns.
 */
export function mapUv(u: number, v: number, d: Pick<ImageDoc, 'w' | 'h' | 'geom'>): [number, number] {
  const g = d.geom, o = oriented(d);
  let x = g.crop.x + u * g.crop.w, y = g.crop.y + v * g.crop.h;
  if (g.angle) {
    const s = coverScale(g.angle, o.w, o.h), a = (-g.angle * Math.PI) / 180;
    const px = (x - 0.5) * o.w / s, py = (y - 0.5) * o.h / s;
    x = 0.5 + (px * Math.cos(a) - py * Math.sin(a)) / o.w;
    y = 0.5 + (px * Math.sin(a) + py * Math.cos(a)) / o.h;
  }
  if (g.flipH) x = 1 - x;
  if (g.flipV) y = 1 - y;
  // undo the quarter turns (clockwise turns of the picture)
  switch (g.rot) {
    case 1: return [y, 1 - x];
    case 2: return [1 - x, 1 - y];
    case 3: return [1 - y, x];
    default: return [x, y];
  }
}

// ---------------------------------------------------------------- crop formats
export interface Ratio { id: string; r: number | null } // width / height; null = free; 0 = the photo's own
export const RATIOS: Ratio[] = [
  { id: 'free', r: null }, { id: 'original', r: 0 }, { id: 'square', r: 1 }, { id: 'r4x5', r: 4 / 5 }, { id: 'r5x4', r: 5 / 4 },
  { id: 'r3x4', r: 3 / 4 }, { id: 'r4x3', r: 4 / 3 }, { id: 'r2x3', r: 2 / 3 }, { id: 'r3x2', r: 3 / 2 }, { id: 'r9x16', r: 9 / 16 },
  { id: 'r16x9', r: 16 / 9 }, { id: 'r16x10', r: 16 / 10 }, { id: 'r21x9', r: 21 / 9 }, { id: 'r191', r: 1.91 }, { id: 'r2x1', r: 2 },
  { id: 'r3x1', r: 3 }, { id: 'r4x1', r: 4 }, { id: 'a4p', r: 1 / Math.SQRT2 }, { id: 'a4l', r: Math.SQRT2 }, { id: 'letterP', r: 8.5 / 11 },
  { id: 'idPhoto', r: 35 / 45 }, { id: 'passportUs', r: 1 }, { id: 'fbCover', r: 820 / 312 }, { id: 'phoneWall', r: 9 / 19.5 },
];
/** The largest centred crop of a given ratio inside the oriented picture. */
export function cropForRatio(r: number | null, d: Pick<ImageDoc, 'w' | 'h' | 'geom'>): Crop {
  if (r === null) return { ...d.geom.crop };
  const o = oriented(d);
  const want = r === 0 ? (d.geom.rot % 2 ? d.h / d.w : d.w / d.h) : r;
  const have = o.w / o.h;
  if (want > have) { const h = have / want; return { x: 0, y: (1 - h) / 2, w: 1, h }; }
  const w = want / have;
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}
/** Moving or resizing the crop box keeps it inside the picture (and at its ratio when one is chosen). */
export function clampCrop(c: Crop, min = 0.04): Crop {
  const w = clamp(c.w, min, 1), h = clamp(c.h, min, 1);
  return { x: clamp(c.x, 0, 1 - w), y: clamp(c.y, 0, 1 - h), w, h };
}
/** Turning a quarter turn also turns the crop box with the picture. */
export function rotateGeom(g: Geom, dir: 1 | -1): Geom {
  const c = g.crop;
  const crop = dir === 1 ? { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w } : { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w };
  return { ...g, rot: (((g.rot + dir) % 4) + 4) % 4 as Geom['rot'], crop };
}

// ---------------------------------------------------------------- the colour maths
export interface Params { a: Adjust; tone: Tone | null; mono: boolean }
/** The person's settings plus the chosen look, at its strength. */
export function params(d: Pick<ImageDoc, 'adjust' | 'look' | 'lookAmount'>): Params {
  const look = d.look ? LOOKS.find(l => l.id === d.look) : undefined;
  const k = d.lookAmount / 100;
  const a = { ...d.adjust };
  if (look) for (const key of ADJUST_KEYS) a[key] = clamp(a[key] + (look.adjust[key] ?? 0) * k, POSITIVE_ONLY.includes(key) ? 0 : -100, 100);
  const tone = look?.tone ? { ...look.tone, amount: look.tone.amount * k } : null;
  return { a, tone, mono: !!look?.mono && k >= 0.5 };
}
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * One pixel (0..1 colours) through every setting except the ones that need neighbours (sharpen, clarity).
 * `vx, vy` = place in the result (0..1) for the vignette, `noise` 0..1 for the grain. Kept in step with the GLSL.
 */
export function shadePixel(r: number, g: number, b: number, p: Params, vx = 0.5, vy = 0.5, noise = 0.5): [number, number, number] {
  const a = p.a;
  const ex = Math.pow(2, (a.exposure / 100) * 1.6);
  r *= ex; g *= ex; b *= ex;
  r += (a.temp / 100) * 0.12; b -= (a.temp / 100) * 0.12; g += (a.tint / 100) * 0.1; r -= (a.tint / 100) * 0.03; b -= (a.tint / 100) * 0.03;
  const bp = (-a.blacks / 100) * 0.15, wp = 1 - (a.whites / 100) * 0.15;
  r = (r - bp) / (wp - bp); g = (g - bp) / (wp - bp); b = (b - bp) / (wp - bp);
  let L = luma(r, g, b);
  const delta = (a.shadows / 100) * 0.3 * (1 - smooth(0, 0.55, L)) + (a.highlights / 100) * 0.3 * smooth(0.45, 1, L);
  r += delta; g += delta; b += delta;
  const c = 1 + a.contrast / 100;
  r = (r - 0.5) * c + 0.5; g = (g - 0.5) * c + 0.5; b = (b - 0.5) * c + 0.5;
  L = luma(r, g, b);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const s = 1 + a.saturation / 100 + (a.vibrance / 100) * (1 - clamp(mx - mn, 0, 1)) * 0.9;
  r = L + (r - L) * s; g = L + (g - L) * s; b = L + (b - L) * s;
  if (a.hue) {
    const h = (a.hue / 100) * Math.PI, ch = Math.cos(h), sh = Math.sin(h);
    // rotate around the grey axis (YIQ)
    const y = 0.299 * r + 0.587 * g + 0.114 * b, i = 0.596 * r - 0.274 * g - 0.322 * b, q = 0.211 * r - 0.523 * g + 0.312 * b;
    const i2 = i * ch - q * sh, q2 = i * sh + q * ch;
    r = y + 0.956 * i2 + 0.621 * q2; g = y - 0.272 * i2 - 0.647 * q2; b = y - 1.106 * i2 + 1.703 * q2;
  }
  if (p.mono) { const m = luma(r, g, b); r = g = b = m; }
  if (p.tone && p.tone.amount > 0) {
    const m = clamp(luma(r, g, b), 0, 1), t = p.tone;
    if (t.mono) {
      const tr = t.shadow[0] + (t.light[0] - t.shadow[0]) * m, tg = t.shadow[1] + (t.light[1] - t.shadow[1]) * m, tb = t.shadow[2] + (t.light[2] - t.shadow[2]) * m; r = r + (tr - r) * t.amount; g = g + (tg - g) * t.amount; b = b + (tb - b) * t.amount;
    }
    else {
      // split toning: shadows lean to one colour, lights to the other
      const k = t.amount * 0.5, w = 1 - m;
      r += ((t.shadow[0] - 0.5) * w + (t.light[0] - 0.5) * m) * k;
      g += ((t.shadow[1] - 0.5) * w + (t.light[1] - 0.5) * m) * k;
      b += ((t.shadow[2] - 0.5) * w + (t.light[2] - 0.5) * m) * k;
    }
  }
  if (a.fade) { const f = a.fade / 100; r = r * (1 - f * 0.22) + f * 0.12; g = g * (1 - f * 0.22) + f * 0.12; b = b * (1 - f * 0.22) + f * 0.12; }
  if (a.vignette) {
    const dx = vx - 0.5, dy = vy - 0.5, dist = Math.sqrt(dx * dx + dy * dy) * 1.414;
    const v = 1 - (a.vignette / 100) * 0.75 * smooth(0.35, 1, dist);
    r *= v; g *= v; b *= v;
  }
  if (a.grain) { const n = (noise - 0.5) * (a.grain / 100) * 0.16; r += n; g += n; b += n; }
  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}

// ---------------------------------------------------------------- analysis (Enhance, suggestions)
export interface Stats { mean: number; p1: number; p99: number; sat: number; cast: number; tintCast: number; hist: number[] }
/** Statistics of RGBA pixels (any size; the caller passes a small copy). */
export function analyze(px: Uint8ClampedArray): Stats {
  const hist = new Array(64).fill(0);
  let sum = 0, sat = 0, rb = 0, gm = 0, n = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 8) continue;
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    const L = luma(r, g, b);
    hist[Math.min(63, Math.floor(L * 64))]++;
    sum += L; sat += Math.max(r, g, b) - Math.min(r, g, b); rb += r - b; gm += g - (r + b) / 2; n++;
  }
  n = Math.max(1, n);
  const pct = (q: number) => { let acc = 0; for (let i = 0; i < 64; i++) { acc += hist[i]; if (acc >= q * n) return (i + 0.5) / 64; } return 1; };
  return { mean: sum / n, p1: pct(0.01), p99: pct(0.99), sat: sat / n, cast: rb / n, tintCast: gm / n, hist: hist.map(v => v / n) };
}
/** One-tap "Enhance": settings that stretch the light, balance the colour and add a little life. */
export function enhance(s: Stats): Partial<Adjust> {
  const r = (v: number) => Math.round(clamp(v, -100, 100));
  return {
    blacks: r(-(s.p1 - 0.02) / 0.15 * 100 * 0.8),
    whites: r((0.98 - s.p99) / 0.15 * 100 * 0.8),
    exposure: r(((0.47 - s.mean) / 0.47) * 45),
    shadows: r(s.mean < 0.4 ? 25 : 8),
    highlights: r(s.p99 > 0.97 ? -20 : -5),
    contrast: r(s.p99 - s.p1 < 0.7 ? 18 : 8),
    vibrance: r(s.sat < 0.18 ? 30 : 15),
    temp: r(-s.cast * 160),
    tint: r(-s.tintCast * 160),
    clarity: 10,
    sharpen: 15,
  };
}
export type Suggestion = 'dark' | 'bright' | 'flat' | 'warm' | 'cool' | 'dull';
/** The one thing most worth fixing, if any (shown as a small bubble the person can apply or close). */
export function suggest(s: Stats): Suggestion | null {
  if (s.mean < 0.3) return 'dark';
  if (s.mean > 0.75) return 'bright';
  if (s.p99 - s.p1 < 0.55) return 'flat';
  if (s.cast > 0.09) return 'warm';
  if (s.cast < -0.09) return 'cool';
  if (s.sat < 0.1) return 'dull';
  return null;
}
export const SUGGESTION_FIX: Record<Suggestion, Partial<Adjust>> = {
  dark: { exposure: 35, shadows: 30 },
  bright: { exposure: -25, highlights: -30 },
  flat: { contrast: 25, blacks: -15, whites: 15 },
  warm: { temp: -25 },
  cool: { temp: 25 },
  dull: { vibrance: 35, saturation: 10 },
};
/** "Surprise me": a random look with a few random touches, never extreme. */
export function surprise(rand: () => number = Math.random): { look: string; adjust: Partial<Adjust> } {
  const look = LOOKS[Math.floor(rand() * LOOKS.length)].id;
  const pick = (k: AdjustKey, m: number) => [k, Math.round((rand() * 2 - 1) * m)] as const;
  return { look, adjust: Object.fromEntries([pick('exposure', 12), pick('contrast', 20), pick('vibrance', 25), pick('vignette', 30), pick('temp', 20)]) };
}

/** Long sides for "Resize" on export (0 = keep). */
export const SIZES = [0, 7680, 5120, 3840, 3000, 2560, 2048, 1920, 1600, 1440, 1280, 1200, 1080, 1024, 960, 800, 720, 640, 512, 480, 400, 320, 256, 128];
export const EXPORTS = ['png', 'jpg', 'webp', 'avif', 'pdf', 'oi1img'] as const;
export type ExportFormat = typeof EXPORTS[number];
