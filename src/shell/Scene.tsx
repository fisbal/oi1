// The OI1 "scene" look, the same design language as ProDFos: a void-black stage with a breathing gold
// nebula and film grain, obsidian slabs that tilt toward the pointer, and tiny living isometric scenes
// for every app. Everything is drawn in code (SVG and CSS), so it stays sharp on phones and 4K screens.

import { useRef, type CSSProperties, type ReactNode } from 'react';

/** The nebula, film grain and vignette behind the whole suite. */
export function Backdrop() {
  return (
    <div className="scene-backdrop" aria-hidden="true">
      <div className="nebula" />
      <div className="grain" />
      <div className="vignette" />
      {/* Shared gradients for every scene, kept in a shown element so hidden scenes do not break them. */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
        <linearGradient id="oi1-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B8892E" /><stop offset=".55" stopColor="#F2D78B" /><stop offset="1" stopColor="#D4A843" />
        </linearGradient>
        <radialGradient id="oi1-orb" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#F2D78B" /><stop offset=".45" stopColor="#B48CF0" /><stop offset="1" stopColor="#2a1d47" />
        </radialGradient>
        <filter id="oi1-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      </svg>
    </div>
  );
}

/** Perspective tilt that follows the pointer and sinks on press, like ProDFos's Tilt3D. */
export function useTilt<T extends HTMLElement>(max = 1) {
  const ref = useRef<T>(null);
  const set = (x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--tx', (x * max).toFixed(3));
    el.style.setProperty('--ty', (y * max).toFixed(3));
  };
  return {
    ref,
    onPointerMove: (e: React.PointerEvent<T>) => {
      if (e.pointerType === 'touch') return;
      const r = e.currentTarget.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    },
    onPointerLeave: () => set(0, 0),
  };
}

/** The gold "1" mark of Office In 1. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return <span className="brand-mark" style={{ width: size, height: size, fontSize: size * 0.62 }} aria-hidden="true">1</span>;
}

/** "Office In 1" with the 1 in gold, like ProDFos's wordmark. */
export function Wordmark() {
  return <span className="wordmark">Office In <span className="gold-text">1</span></span>;
}

// ---------- isometric scenes ----------

type Pt = [number, number];
const S = 26; // units to SVG pixels
const O: Pt = [60, 30]; // origin of the iso grid in the 120 x 84 view box

function p(x: number, y: number, z: number): Pt {
  return [O[0] + (x - y) * 0.866 * S, O[1] + (x + y) * 0.5 * S - z * S];
}
const pts = (list: Pt[]) => list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');

interface Faces { top: string; left: string; right: string }
function boxFaces(x: number, y: number, z: number, w: number, d: number, h: number): Faces {
  return {
    left: pts([p(x, y + d, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x, y + d, z + h)]),
    right: pts([p(x + w, y, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x + w, y, z + h)]),
    top: pts([p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)]),
  };
}

/** A box with a lit top and darker sides. With `to`, its height breathes between two values. */
function Box({ x, y, z = 0, w, d, h, top, side, edge, to, dur = 4, begin = 0 }: {
  x: number; y: number; z?: number; w: number; d: number; h: number; top: string; side: string; edge: string;
  to?: { z?: number; h?: number }; dur?: number; begin?: number;
}) {
  const a = boxFaces(x, y, z, w, d, h);
  const b = to ? boxFaces(x, y, to.z ?? z, w, d, to.h ?? h) : null;
  const anim = (key: keyof Faces) => b && (
    <animate attributeName="points" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite"
      values={`${a[key]};${b[key]};${a[key]}`} keyTimes="0;0.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" />
  );
  return (
    <g>
      <polygon points={a.left} fill={side}>{anim('left')}</polygon>
      <polygon points={a.right} fill={edge}>{anim('right')}</polygon>
      <polygon points={a.top} fill={top} stroke="rgba(255,255,255,.35)" strokeWidth=".5">{anim('top')}</polygon>
    </g>
  );
}

const PAPER = { top: '#F4F0E6', side: '#CFC7B4', edge: '#B3AA95' };
const OBSIDIAN = { top: '#2C2C37', side: '#1A1A22', edge: '#0E0E13' };

function Shadow({ x, y, w, d }: { x: number; y: number; w: number; d: number }) {
  const [cx, cy] = p(x + w / 2, y + d / 2, 0);
  return <ellipse cx={cx} cy={cy + 3} rx={(w + d) * 0.866 * S * 0.55} ry={(w + d) * 0.5 * S * 0.55} fill="#000" opacity=".5" filter="url(#oi1-soft)" />;
}

function Line({ a, b, color, width = 1.4, className, style }: { a: Pt; b: Pt; color: string; width?: number; className?: string; style?: CSSProperties }) {
  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={width} strokeLinecap="round" className={className} style={style} />;
}

/** Text lines on a page lying flat at height z. */
function PageLines({ x, y, z, w, d, rows, accent, last }: { x: number; y: number; z: number; w: number; d: number; rows: number; accent: string; last?: boolean }) {
  return <>
    <Line a={p(x + 0.14, y + 0.16, z)} b={p(x + w * 0.62, y + 0.16, z)} color={accent} width={2.2} />
    {Array.from({ length: rows }, (_, k) => {
      const yy = y + 0.36 + k * (d - 0.5) / rows;
      const len = k % 2 ? w * 0.72 : w * 0.86;
      const isLast = last && k === rows - 1;
      return <Line key={k} a={p(x + 0.14, yy, z)} b={p(x + len, yy, z)} color="rgba(0,0,0,.22)" width={1.1}
        className={isLast ? 'write-line' : undefined} />;
    })}
  </>;
}

const SCENES: Record<string, (accent: string) => ReactNode> = {
  letter: accent => <>
    <Shadow x={0} y={0} w={1.1} d={1.4} />
    <Box x={0} y={0} w={1.1} d={1.4} h={0.05} {...PAPER} />
    <PageLines x={0} y={0} z={0.05} w={1.1} d={1.4} rows={5} accent={accent} last />
    <g className="pen">
      <Line a={p(0.94, 1.08, 0.07)} b={p(0.94, 1.08, 0.07).map((v, i) => v + (i ? -22 : 11)) as Pt} color="url(#oi1-gold)" width={4.5} />
      <Line a={p(0.94, 1.08, 0.07)} b={p(0.94, 1.08, 0.07).map((v, i) => v + (i ? -4 : 2)) as Pt} color="#2B2B33" width={2.6} />
    </g>
  </>,
  class: accent => <>
    <Shadow x={0} y={0} w={1.5} d={1.3} />
    <Box x={0} y={0} w={1.5} d={1.3} h={0.06} {...OBSIDIAN} />
    {[0.25, 0.5, 0.75, 1, 1.25].map(v => <Line key={`c${v}`} a={p(v, 0, 0.06)} b={p(v, 1.3, 0.06)} color="rgba(255,255,255,.12)" width={0.6} />)}
    {[0.32, 0.65, 0.98].map(v => <Line key={`r${v}`} a={p(0, v, 0.06)} b={p(1.5, v, 0.06)} color="rgba(255,255,255,.12)" width={0.6} />)}
    <Box x={0.2} y={0.85} z={0.06} w={0.24} d={0.24} h={0.35} top={accent} side="#2f7a56" edge="#1f5039" to={{ h: 0.75 }} dur={3.6} />
    <Box x={0.62} y={0.85} z={0.06} w={0.24} d={0.24} h={0.7} top="#F2D78B" side="#9A7424" edge="#6e5219" to={{ h: 0.4 }} dur={3.6} />
    <Box x={1.04} y={0.85} z={0.06} w={0.24} d={0.24} h={0.5} top={accent} side="#2f7a56" edge="#1f5039" to={{ h: 0.95 }} dur={3.6} begin={-1.2} />
  </>,
  stage: accent => <>
    <Shadow x={0.1} y={0.2} w={1.4} d={0.9} />
    <Box x={0.1} y={0.55} w={1.4} d={0.08} h={0.95} {...OBSIDIAN} to={{ z: 0.06 }} dur={4.2} />
    <g className="slide-front">
      <Box x={0.25} y={0.3} w={1.4} d={0.08} h={0.95} top="#3a3a46" side="#F4F0E6" edge="#CFC7B4" />
      <Line a={p(0.45, 0.38, 0.78)} b={p(1.15, 0.38, 0.78)} color={accent} width={3} />
      <Line a={p(0.45, 0.38, 0.55)} b={p(1.4, 0.38, 0.55)} color="rgba(0,0,0,.25)" width={1.2} />
      <Line a={p(0.45, 0.38, 0.4)} b={p(1.2, 0.38, 0.4)} color="rgba(0,0,0,.25)" width={1.2} />
    </g>
  </>,
  code: accent => <>
    <Shadow x={0} y={0} w={1.5} d={1.2} />
    <Box x={0} y={0} w={1.5} d={1.2} h={0.06} {...OBSIDIAN} />
    <Box x={0} y={0} z={0.06} w={1.5} d={0.2} h={0.02} top="#3a3a46" side="#22222b" edge="#16161c" />
    {[[0.15, 0.55, '#E8A0D8'], [0.3, 0.95, accent], [0.3, 0.75, '#F2D78B'], [0.15, 0.45, '#E8A0D8'], [0.15, 1.1, '#7FC8E8']].map(([x, len, c], k) => (
      <Line key={k} a={p(x as number, 0.36 + k * 0.17, 0.06)} b={p((x as number) + (len as number) * 0.9, 0.36 + k * 0.17, 0.06)} color={c as string} width={1.8} />
    ))}
    <g className="caret-blink"><Line a={p(1.25, 1.02, 0.06)} b={p(1.25, 1.02, 0.22)} color="#F2D78B" width={2.2} /></g>
  </>,
  prodfos: accent => <>
    <Shadow x={0} y={0} w={1.1} d={1.4} />
    <Box x={0} y={0} w={1.1} d={1.4} h={0.05} {...PAPER} />
    <PageLines x={0} y={0} z={0.05} w={1.1} d={1.4} rows={5} accent="#B83A3A" />
    <Box x={0.62} y={1.02} z={0.05} w={0.36} d={0.26} h={0.04} top={accent} side="#8a2a2a" edge="#5e1d1d" />
    <g className="scan-beam">
      <Line a={p(-0.08, 0.15, 0.12)} b={p(1.18, 0.15, 0.12)} color="#F2D78B" width={2} />
      <Line a={p(-0.08, 0.15, 0.12)} b={p(1.18, 0.15, 0.12)} color="#F2D78B" width={8} style={{ opacity: 0.25, filter: 'url(#oi1-soft)' }} />
    </g>
  </>,
  assistant: accent => <>
    <ellipse cx="60" cy="72" rx="26" ry="5" fill="#000" opacity=".5" filter="url(#oi1-soft)" />
    <circle cx="60" cy="42" r="22" fill="url(#oi1-orb)" />
    <circle cx="60" cy="42" r="22" fill="none" stroke={accent} strokeOpacity=".5" />
    <ellipse cx="52" cy="33" rx="8" ry="5" fill="#fff" opacity=".35" />
    <g className="orbit"><circle cx="94" cy="42" r="2.4" fill="#F2D78B" /><circle cx="26" cy="42" r="1.6" fill={accent} /></g>
    <g className="orbit slow"><circle cx="60" cy="10" r="1.8" fill="#F2D78B" /></g>
  </>,
  notes: accent => <>
    <Shadow x={0.15} y={0.15} w={1.1} d={1.1} />
    <Box x={0.15} y={0.15} w={1.1} d={1.1} h={0.05} top="#E9D9A6" side="#BBA770" edge="#9b8a58" />
    <Box x={0.25} y={0.05} z={0.05} w={1.1} d={1.1} h={0.05} top={accent} side="#B89A3A" edge="#8b7429" to={{ z: 0.32 }} dur={3.8} />
  </>,
  plan: accent => <>
    <Shadow x={0} y={0} w={1.5} d={1.3} />
    <Box x={0} y={0} w={1.5} d={1.3} h={0.06} {...OBSIDIAN} />
    <Box x={0} y={0} z={0.06} w={1.5} d={0.28} h={0.04} top={accent} side="#2b6f93" edge="#1f5068" />
    {[0, 1, 2].flatMap(r => [0, 1, 2, 3].map(c => (
      <Box key={`${r}${c}`} x={0.1 + c * 0.35} y={0.4 + r * 0.29} z={0.06} w={0.26} d={0.2} h={0.03}
        top={r === 1 && c === 2 ? '#F2D78B' : '#3a3a46'} side="#22222b" edge="#16161c" />
    )))}
  </>,
  mail: accent => <>
    <Shadow x={0.05} y={0.1} w={1.4} d={1} />
    <Box x={0.05} y={0.1} w={1.4} d={1} h={0.22} top="#E8E2D2" side="#CFC7B4" edge="#B3AA95" />
    <Box x={0.25} y={0.25} z={0.22} w={1} d={0.7} h={0.03} {...PAPER} to={{ z: 0.62 }} dur={3.6} />
    <Line a={p(0.05, 0.1, 0.22)} b={p(0.75, 0.6, 0.22)} color={accent} width={1.6} />
    <Line a={p(1.45, 0.1, 0.22)} b={p(0.75, 0.6, 0.22)} color={accent} width={1.6} />
  </>,
  draw: accent => <>
    <Shadow x={0} y={0} w={1.5} d={1.2} />
    <Box x={0} y={0} w={1.5} d={1.2} h={0.05} {...PAPER} />
    <polyline className="draw-stroke" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      points={pts([p(0.2, 0.3, 0.05), p(0.5, 0.2, 0.05), p(0.7, 0.55, 0.05), p(1.0, 0.45, 0.05), p(1.2, 0.85, 0.05), p(0.8, 1.0, 0.05)])} />
    <circle cx={p(1.25, 0.35, 0.4)[0]} cy={p(1.25, 0.35, 0.4)[1]} r="4" fill="url(#oi1-gold)" />
  </>,
  form: accent => <>
    <Shadow x={0} y={0} w={1.1} d={1.4} />
    <Box x={0} y={0} w={1.1} d={1.4} h={0.05} {...PAPER} />
    {[0, 1, 2].map(k => {
      const y = 0.3 + k * 0.36;
      return <g key={k}>
        <Box x={0.14} y={y} z={0.05} w={0.18} d={0.18} h={0.02} top="#fff" side="#bbb" edge="#999" />
        <Line a={p(0.4, y + 0.09, 0.05)} b={p(0.95, y + 0.09, 0.05)} color="rgba(0,0,0,.22)" width={1.1} />
        <polyline className={`tick t${k}`} fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          points={pts([p(0.16, y + 0.08, 0.1), p(0.22, y + 0.15, 0.1), p(0.33, y - 0.02, 0.1)])} />
      </g>;
    })}
  </>,
};

/** A tiny living scene for an app, like ProDFos's SceneView. */
export function SceneArt({ app, accent, className }: { app: string; accent: string; className?: string }) {
  const draw = SCENES[app] ?? SCENES.letter;
  return (
    <svg className={`scene-art ${className ?? ''}`} viewBox="0 0 120 84" aria-hidden="true">
      {draw(accent)}
    </svg>
  );
}
