// Draws the photo with its settings: WebGL2 (every setting in one GPU pass, fast enough to follow a finger on a
// slider, even on a phone) with a Canvas 2D fallback that runs the same maths on the CPU.
import { mapUv, outputSize, params, shadePixel, type ImageDoc, type Params } from './model';

const VERT = `#version 300 es
in vec2 p; out vec2 uv;
void main() { uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }`;

// Kept in step with shadePixel() in model.ts.
const FRAG = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D img;
uniform vec2 srcPx;           // 1 / source size
uniform vec4 crop;            // x y w h in the turned picture
uniform vec3 geo;             // angle (rad), cover scale, turned aspect (w/h)
uniform ivec3 orient;         // quarter turns, flipH, flipV
uniform float A[16];          // exposure contrast highlights shadows whites blacks temp tint saturation vibrance hue sharpen clarity vignette grain fade
uniform vec3 toneS; uniform vec3 toneL; uniform vec2 toneK; // amount, mono-tone
uniform int mono;
uniform float seed;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec2 mapUv(vec2 q) {
  vec2 x = crop.xy + q * crop.zw;
  if (geo.x != 0.0) {
    vec2 d = (x - 0.5) * vec2(geo.z, 1.0) / geo.y;
    float c = cos(-geo.x), s = sin(-geo.x);
    d = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
    x = 0.5 + d / vec2(geo.z, 1.0);
  }
  if (orient.y == 1) x.x = 1.0 - x.x;
  if (orient.z == 1) x.y = 1.0 - x.y;
  if (orient.x == 1) return vec2(x.y, 1.0 - x.x);
  if (orient.x == 2) return vec2(1.0 - x.x, 1.0 - x.y);
  if (orient.x == 3) return vec2(1.0 - x.y, x.x);
  return x;
}
vec3 tex(vec2 s) { return texture(img, s).rgb; }
void main() {
  vec2 s = mapUv(uv);
  vec4 base = texture(img, s);
  vec3 c = base.rgb;
  // neighbours: sharpen (small radius) and clarity (wider, midtones)
  if (A[11] > 0.0 || A[12] != 0.0) {
    vec2 dx = vec2(srcPx.x, 0.0), dy = vec2(0.0, srcPx.y);
    if (A[11] > 0.0) {
      vec3 b = (tex(s + dx) + tex(s - dx) + tex(s + dy) + tex(s - dy)) * 0.25;
      c += (c - b) * A[11] / 100.0 * 1.6;
    }
    if (A[12] != 0.0) {
      vec3 b = vec3(0.0);
      for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; b += tex(s + vec2(cos(a), sin(a)) * srcPx * 6.0); }
      b /= 8.0;
      float L = luma(c), w = 1.0 - abs(L - 0.5) * 2.0;
      c += (c - b) * A[12] / 100.0 * 1.2 * w;
    }
  }
  c *= pow(2.0, A[0] / 100.0 * 1.6);
  c.r += A[6] / 100.0 * 0.12; c.b -= A[6] / 100.0 * 0.12; c.g += A[7] / 100.0 * 0.1; c.rb -= A[7] / 100.0 * 0.03;
  float bp = -A[5] / 100.0 * 0.15, wp = 1.0 - A[4] / 100.0 * 0.15;
  c = (c - bp) / (wp - bp);
  float L = luma(c);
  c += A[3] / 100.0 * 0.3 * (1.0 - smoothstep(0.0, 0.55, L)) + A[2] / 100.0 * 0.3 * smoothstep(0.45, 1.0, L);
  c = (c - 0.5) * (1.0 + A[1] / 100.0) + 0.5;
  L = luma(c);
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  float sat = 1.0 + A[8] / 100.0 + A[9] / 100.0 * (1.0 - clamp(mx - mn, 0.0, 1.0)) * 0.9;
  c = L + (c - L) * sat;
  if (A[10] != 0.0) {
    float h = A[10] / 100.0 * 3.14159265, ch = cos(h), sh = sin(h);
    float y = dot(c, vec3(0.299, 0.587, 0.114)), i = dot(c, vec3(0.596, -0.274, -0.322)), q = dot(c, vec3(0.211, -0.523, 0.312));
    float i2 = i * ch - q * sh, q2 = i * sh + q * ch;
    c = vec3(y + 0.956 * i2 + 0.621 * q2, y - 0.272 * i2 - 0.647 * q2, y - 1.106 * i2 + 1.703 * q2);
  }
  if (mono == 1) c = vec3(luma(c));
  if (toneK.x > 0.0) {
    float m = clamp(luma(c), 0.0, 1.0);
    if (toneK.y > 0.5) c = mix(c, mix(toneS, toneL, m), toneK.x);
    else c += ((toneS - 0.5) * (1.0 - m) + (toneL - 0.5) * m) * toneK.x * 0.5;
  }
  if (A[15] > 0.0) { float f = A[15] / 100.0; c = c * (1.0 - f * 0.22) + f * 0.12; }
  if (A[13] != 0.0) { float d = length(uv - 0.5) * 1.414; c *= 1.0 - A[13] / 100.0 * 0.75 * smoothstep(0.35, 1.0, d); }
  if (A[14] > 0.0) { float n = fract(sin(dot(uv * 1000.0 + seed, vec2(12.9898, 78.233))) * 43758.5453); c += (n - 0.5) * A[14] / 100.0 * 0.16; }
  bool out_ = s.x < 0.0 || s.y < 0.0 || s.x > 1.0 || s.y > 1.0;
  o = out_ ? vec4(0.0) : vec4(clamp(c, 0.0, 1.0), base.a);
}`;

const KEYS = ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'temp', 'tint', 'saturation', 'vibrance', 'hue', 'sharpen', 'clarity', 'vignette', 'grain', 'fade'] as const;

export interface Renderer {
  readonly gpu: boolean;
  /** Draws `doc` into the renderer's canvas at most `maxSide` pixels on the long side (0 = full size). */
  draw(doc: ImageDoc, maxSide: number, opts?: { neutral?: boolean }): { w: number; h: number };
  readonly canvas: HTMLCanvasElement;
  dispose(): void;
}

const images = new Map<string, Promise<HTMLImageElement>>();
/** The decoded original (decoded once per photo). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = images.get(src);
  if (!p) {
    p = new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('image')); i.src = src; });
    images.set(src, p);
    if (images.size > 6) images.delete(images.keys().next().value as string);
  }
  return p;
}

export function createRenderer(img: HTMLImageElement, canvas = document.createElement('canvas'), preferGpu = true): Renderer {
  const gl = preferGpu ? canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false }) : null;
  if (gl) {
    const r = gpuRenderer(gl, img, canvas);
    if (r) return r;
  }
  return cpuRenderer(img, canvas);
}

function gpuRenderer(gl: WebGL2RenderingContext, img: HTMLImageElement, canvas: HTMLCanvasElement): Renderer | null {
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  // The source, shrunk if the GPU cannot hold it whole.
  const max = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 8192);
  let source: TexImageSource = img;
  let sw = img.naturalWidth, shh = img.naturalHeight;
  if (Math.max(sw, shh) > max) {
    const k = max / Math.max(sw, shh);
    const c = document.createElement('canvas');
    c.width = Math.round(sw * k); c.height = Math.round(shh * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    source = c; sw = c.width; shh = c.height;
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const U = { img: u('img'), srcPx: u('srcPx'), crop: u('crop'), geo: u('geo'), orient: u('orient'), A: u('A'), toneS: u('toneS'), toneL: u('toneL'), toneK: u('toneK'), mono: u('mono'), seed: u('seed') };
  gl.uniform1i(U.img, 0);
  return {
    gpu: true,
    canvas,
    draw(doc, maxSide, opts) {
      const out = outputSize(doc);
      const k = maxSide && Math.max(out.w, out.h) > maxSide ? maxSide / Math.max(out.w, out.h) : 1;
      const w = Math.max(1, Math.round(out.w * k)), h = Math.max(1, Math.round(out.h * k));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      gl.viewport(0, 0, w, h);
      const p: Params = opts?.neutral ? { a: { ...doc.adjust, ...Object.fromEntries(KEYS.map(x => [x, 0])) }, tone: null, mono: false } : params(doc);
      const g = doc.geom;
      const turned = g.rot % 2 ? { w: doc.h, h: doc.w } : { w: doc.w, h: doc.h };
      const a = Math.abs(g.angle * Math.PI / 180);
      gl.uniform2f(U.srcPx, 1 / sw, 1 / shh);
      gl.uniform4f(U.crop, g.crop.x, g.crop.y, g.crop.w, g.crop.h);
      gl.uniform3f(U.geo, g.angle * Math.PI / 180, Math.cos(a) + Math.sin(a) * Math.max(turned.w / turned.h, turned.h / turned.w), turned.w / turned.h);
      gl.uniform3i(U.orient, g.rot, g.flipH ? 1 : 0, g.flipV ? 1 : 0);
      gl.uniform1fv(U.A, KEYS.map(x => p.a[x]));
      gl.uniform3fv(U.toneS, p.tone?.shadow ?? [0, 0, 0]);
      gl.uniform3fv(U.toneL, p.tone?.light ?? [1, 1, 1]);
      gl.uniform2f(U.toneK, p.tone?.amount ?? 0, p.tone?.mono ? 1 : 0);
      gl.uniform1i(U.mono, p.mono ? 1 : 0);
      gl.uniform1f(U.seed, 7.31);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return { w, h };
    },
    dispose() { gl.deleteTexture(tex); gl.deleteProgram(prog); gl.deleteBuffer(buf); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}

function cpuRenderer(img: HTMLImageElement, canvas: HTMLCanvasElement): Renderer {
  // The source pixels, read once (shrunk to 4096 at most: the CPU path is the slow one).
  const k0 = Math.min(1, 4096 / Math.max(img.naturalWidth, img.naturalHeight));
  const sw = Math.max(1, Math.round(img.naturalWidth * k0)), shh = Math.max(1, Math.round(img.naturalHeight * k0));
  const sc = document.createElement('canvas');
  sc.width = sw; sc.height = shh;
  const sg = sc.getContext('2d', { willReadFrequently: true })!;
  sg.drawImage(img, 0, 0, sw, shh);
  const src = sg.getImageData(0, 0, sw, shh).data;
  return {
    gpu: false,
    canvas,
    draw(doc, maxSide, opts) {
      const out = outputSize(doc);
      const k = maxSide && Math.max(out.w, out.h) > maxSide ? maxSide / Math.max(out.w, out.h) : 1;
      const w = Math.max(1, Math.round(out.w * k)), h = Math.max(1, Math.round(out.h * k));
      canvas.width = w; canvas.height = h;
      const g = canvas.getContext('2d')!;
      const data = g.createImageData(w, h);
      const d = data.data;
      const p: Params = opts?.neutral ? { a: Object.fromEntries(KEYS.map(x => [x, 0])) as Params['a'], tone: null, mono: false } : params(doc);
      const sharp = p.a.sharpen / 100 * 1.6;
      const at = (x: number, y: number, c: number) => src[((Math.min(shh - 1, Math.max(0, y)) * sw + Math.min(sw - 1, Math.max(0, x))) << 2) + c] / 255;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const [su, sv] = mapUv((x + 0.5) / w, (y + 0.5) / h, doc);
          const o = (y * w + x) << 2;
          if (su < 0 || sv < 0 || su > 1 || sv > 1) { d[o + 3] = 0; continue; }
          const ix = Math.floor(su * sw), iy = Math.floor(sv * shh);
          let r = at(ix, iy, 0), gg = at(ix, iy, 1), b = at(ix, iy, 2);
          if (sharp) {
            const n = (c: number) => (at(ix + 1, iy, c) + at(ix - 1, iy, c) + at(ix, iy + 1, c) + at(ix, iy - 1, c)) / 4;
            r += (r - n(0)) * sharp; gg += (gg - n(1)) * sharp; b += (b - n(2)) * sharp;
          }
          const noise = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1;
          const [R, G, B] = shadePixel(r, gg, b, p, (x + 0.5) / w, (y + 0.5) / h, noise);
          d[o] = R * 255; d[o + 1] = G * 255; d[o + 2] = B * 255; d[o + 3] = src[((iy * sw + ix) << 2) + 3];
        }
      }
      g.putImageData(data, 0, 0);
      return { w, h };
    },
    dispose() { /* nothing held */ },
  };
}

/** The finished picture as a file (full size, or `side` px on the long side). */
export async function exportBlob(doc: ImageDoc, type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif', side = 0, quality = 0.92): Promise<Blob> {
  const img = await loadImage(doc.src);
  const r = createRenderer(img);
  try {
    r.draw(doc, side);
    let canvas = r.canvas;
    if (type === 'image/jpeg') {
      // JPEG has no transparency: put it on white.
      const c = document.createElement('canvas');
      c.width = canvas.width; c.height = canvas.height;
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(canvas, 0, 0);
      canvas = c;
    }
    const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, type, quality));
    if (!blob || (type !== 'image/png' && blob.type !== type)) {
      // This browser cannot write that format: PNG instead (never a broken file).
      return await new Promise<Blob>((ok, no) => canvas.toBlob(b => (b ? ok(b) : no(new Error('png'))), 'image/png'));
    }
    return blob;
  } finally { r.dispose(); }
}

export async function pdfBlob(doc: ImageDoc): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const jpg = await pdf.embedJpg(await (await exportBlob(doc, 'image/jpeg', 0, 0.9)).arrayBuffer());
  const out = outputSize(doc);
  // Fit on an A4 page, turned the way the picture is.
  const [pw, ph] = out.w > out.h ? [841.89, 595.28] : [595.28, 841.89];
  const k = Math.min((pw - 40) / out.w, (ph - 40) / out.h);
  const page = pdf.addPage([pw, ph]);
  page.drawImage(jpg, { x: (pw - out.w * k) / 2, y: (ph - out.h * k) / 2, width: out.w * k, height: out.h * k });
  return new Blob([await pdf.save() as BlobPart], { type: 'application/pdf' });
}

/** Small RGBA copy of the original for statistics. */
export async function sampleOf(src: string, side = 160): Promise<Uint8ClampedArray> {
  const img = await loadImage(src);
  const k = side / Math.max(img.naturalWidth, img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, c.width, c.height);
  return g.getImageData(0, 0, c.width, c.height).data;
}
