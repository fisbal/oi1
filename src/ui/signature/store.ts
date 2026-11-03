/**
 * Signatures (Martin, 2026-11-03): drawn by hand, typed in one of 21 handwriting styles or imported from a photo,
 * with initials, kept ON THIS DEVICE only (never sent anywhere), and placed in In 1 Letter, In 1 Class and In 1 Mail.
 * Each signature is a transparent PNG, trimmed to the ink, made at twice the size so it prints sharp.
 */

export type SignatureKind = 'draw' | 'type' | 'image';
export interface Ink { png: string; w: number; h: number }
export interface Signature extends Ink {
  id: string;
  kind: SignatureKind;
  /** The person's name and title, for the signature line ("Martin B." / "Directeur"). */
  name: string;
  title: string;
  initials?: Ink;
  /** Typed signatures: the style used (also used for the initials of drawn or imported ones). */
  font?: string;
  color: string;
  created: number;
}

/** 21 handwriting styles (all free, SIL Open Font License, shipped with OI1 through Fontsource). */
export const SIGNATURE_FONTS: string[] = [
  'Homemade Apple', 'Mrs Saint Delafield', 'Herr Von Muellerhoff', 'Mr Dafoe', 'Great Vibes', 'Allura', 'Alex Brush',
  'Sacramento', 'Parisienne', 'Pinyon Script', 'Dancing Script Variable', 'Satisfy', 'Yellowtail', 'Kaushan Script',
  'Cedarville Cursive', 'La Belle Aurore', 'Kristi', 'Marck Script', 'Caveat Variable', 'Pacifico', 'Permanent Marker',
];
/** The name shown for a style (without "Variable"). */
export const fontLabel = (css: string) => css.replace(/ Variable$/, '');

/** Ink colours: black, the blue of a ballpoint pen, dark blue, and dark red. */
export const INK_COLORS = ['#111111', '#1f3fbf', '#0d1f5c', '#8b1a1a'];

const KEY = 'oi1.signatures';
const DEFAULT_KEY = 'oi1.signatures.default';

export function listSignatures(): Signature[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Signature[];
    return Array.isArray(v) ? v.filter(s => s && typeof s.png === 'string' && s.png.startsWith('data:image/png')) : [];
  } catch { return []; }
}
function write(all: Signature[]) {
  localStorage.setItem(KEY, JSON.stringify(all));
  try { window.dispatchEvent(new CustomEvent('oi1-signatures')); } catch { /* no window */ }
}
/** Saves (or replaces, same id) a signature; the first one becomes the default. Throws if the device is full. */
export function saveSignature(s: Signature) {
  const all = listSignatures().filter(x => x.id !== s.id);
  all.unshift(s);
  write(all);
  if (!defaultSignature()) setDefaultSignature(s.id);
}
export function deleteSignature(id: string) {
  write(listSignatures().filter(x => x.id !== id));
  try { if (localStorage.getItem(DEFAULT_KEY) === id) localStorage.removeItem(DEFAULT_KEY); } catch { /* private mode */ }
}
export function defaultSignature(): Signature | null {
  const all = listSignatures();
  let id = '';
  try { id = localStorage.getItem(DEFAULT_KEY) ?? ''; } catch { /* private mode */ }
  return all.find(s => s.id === id) ?? all[0] ?? null;
}
export function setDefaultSignature(id: string) {
  try { localStorage.setItem(DEFAULT_KEY, id); window.dispatchEvent(new CustomEvent('oi1-signatures')); } catch { /* private mode */ }
}
export const newId = () => `sig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** "Martin Ballas" → "MB", "jean-paul de la tour" → "JPT". */
export function initialsOf(name: string): string {
  return name.trim().split(/[\s-]+/).filter(w => w && !/^(de|du|des|la|le|van|von|da|di|del|dos|der)$/i.test(w))
    .map(w => w[0].toUpperCase()).join('').slice(0, 4);
}

// ---------------------------------------------------------------- pictures

/** Cuts a canvas down to its ink (+ a small margin). Null when there is no ink. */
export function trimCanvas(c: HTMLCanvasElement, pad = 6): Ink | null {
  const g = c.getContext('2d');
  if (!g) return null;
  const { width: W, height: H } = c;
  const d = g.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { png: out.toDataURL('image/png'), w: out.width, h: out.height };
}

/** Writes text in a handwriting style as a trimmed transparent PNG (size 2× for print). */
export async function typedInk(text: string, font: string, color: string, px = 96): Promise<Ink | null> {
  if (!text.trim()) return null;
  try { await document.fonts.load(`${px}px "${font}"`, text); } catch { /* the fallback still draws */ }
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  if (!g) return null;
  g.font = `${px}px "${font}", cursive`;
  const w = Math.ceil(g.measureText(text).width + px * 1.2);
  c.width = Math.min(4000, w); c.height = Math.ceil(px * 2.2);
  g.font = `${px}px "${font}", cursive`; // reset after resize
  g.fillStyle = color; g.textBaseline = 'middle';
  g.fillText(text, px * 0.5, c.height / 2);
  return trimCanvas(c);
}

/**
 * A photo or scan of a signature: made smaller (at most 1000 px wide), the paper made transparent (light pixels
 * fade out smoothly so the edges stay clean), the ink kept in its colour, then trimmed.
 */
export async function importedInk(src: string): Promise<Ink | null> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, 1000 / img.naturalWidth, 600 / img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(img, 0, 0, c.width, c.height);
  const data = g.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  // The paper's brightness: the light end of the picture (photos of white paper are often grey).
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++;
  let acc = 0, paper = 255;
  const n = d.length / 4;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.5) { paper = v; break; } }
  const hi = Math.max(60, paper - 25), lo = Math.max(20, hi - 90);
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const a = l >= hi ? 0 : l <= lo ? 255 : Math.round(255 * (hi - l) / (hi - lo));
    d[i + 3] = Math.min(d[i + 3], a);
  }
  g.putImageData(data, 0, 0);
  return trimCanvas(c);
}

/** Today's date as people write it under a signature. */
export const todayText = (lang: string) => new Date().toLocaleDateString(lang || undefined, { dateStyle: 'long' });
