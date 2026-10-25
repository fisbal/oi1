// Charts drawn over the sheet from a range of cells, as plain SVG: column, bar, line, area, pie, doughnut,
// scatter and stacked columns. The same drawing becomes a PNG for Office Letter or for saving.

import type { Scalar } from '../../formats/formula';
import { chartLayout } from '../../formats/chartdata';
import { display, key, type Chart, type SheetData } from '../../formats/sheet';

export const CHART_TYPES: Chart['type'][] = ['column', 'stacked', 'bar', 'line', 'area', 'pie', 'doughnut', 'scatter'];

/** Color sets, the first like Office's default theme, then OI1's gold scene. */
export const PALETTES = [
  ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478', '#9E480E'],
  ['#D4A843', '#8C6A1F', '#E9C878', '#5C4A1E', '#B8E05F', '#6FA8DC', '#C27BA0', '#93C47D'],
  ['#1F77B4', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F', '#17BECF'],
  ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51', '#8AB17D', '#B56576', '#6D597A'],
];

export interface Series { name: string; values: (number | null)[] }
export interface ChartData { categories: string[]; series: Series[]; xs?: (number | null)[] }

/** Reads a chart's range: text in the first row names the series, text in the first column names the categories. */
export function chartData(sheet: SheetData, values: Map<string, Scalar>, chart: Chart, lang: string, currency: string, seriesName = (n: number) => `Series ${n}`): ChartData {
  const { c1, r1, c2, r2 } = chart.range;
  const v = (c: number, r: number) => values.get(key(c, r)) ?? '';
  const text = (c: number, r: number) => display(v(c, r), sheet.cells[key(c, r)]?.style, lang, currency);
  const { headRow, headCol, dc1, dr1, byColumn } = chartLayout(values, chart);
  const n = (x: Scalar) => (typeof x === 'number' ? x : null);

  if (chart.type === 'scatter') {
    // First data column holds x; the others are y series.
    const xc = dc1;
    const xs = Array.from({ length: r2 - dr1 + 1 }, (_, i) => n(v(xc, dr1 + i)));
    const series = [];
    for (let c = xc + 1; c <= c2; c++) series.push({ name: headRow ? text(c, r1) : seriesName(c - xc), values: xs.map((_, i) => n(v(c, dr1 + i))) });
    return { categories: xs.map(x => String(x ?? '')), series, xs };
  }
  if (byColumn) {
    const categories = Array.from({ length: r2 - dr1 + 1 }, (_, i) => (headCol ? text(c1, dr1 + i) : String(i + 1)));
    const series = [];
    for (let c = dc1; c <= c2; c++) series.push({ name: headRow ? text(c, r1) : seriesName(c - dc1 + 1), values: categories.map((_, i) => n(v(c, dr1 + i))) });
    return { categories, series };
  }
  const categories = Array.from({ length: c2 - dc1 + 1 }, (_, i) => (headRow ? text(dc1 + i, r1) : String(i + 1)));
  const series = [];
  for (let r = dr1; r <= r2; r++) series.push({ name: headCol ? text(c1, r) : seriesName(r - dr1 + 1), values: categories.map((_, i) => n(v(dc1 + i, r))) });
  return { categories, series };
}

/** Round axis steps: 1, 2, 2.5 or 5 times a power of ten. */
function ticks(lo: number, hi: number, count = 5): number[] {
  if (lo === hi) { hi = lo + 1; lo = Math.min(0, lo); }
  const raw = (hi - lo) / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw) ?? raw;
  const out: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= hi + step * 1e-9; t += step) out.push(Number(t.toPrecision(12)));
  if (out[out.length - 1] < hi) out.push(Number((out[out.length - 1] + step).toPrecision(12)));
  return out;
}

const short = (x: number, lang: string) => new Intl.NumberFormat(lang, { notation: Math.abs(x) >= 1e5 ? 'compact' : 'standard', maximumFractionDigits: 2 }).format(x);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export interface ChartLook { ink: string; muted: string; grid: string; bg: string }
export const LIGHT: ChartLook = { ink: '#262626', muted: '#595959', grid: '#D9D9D9', bg: '#FFFFFF' };
export const DARK: ChartLook = { ink: '#F2EDE2', muted: '#B9B2A4', grid: 'rgba(242,237,226,.14)', bg: '#3A3A42' };

/** The chart as an SVG drawing of `w` × `h` pixels. */
export function ChartSvg({ chart, data, look, lang }: { chart: Chart; data: ChartData; look: ChartLook; lang: string }) {
  const { w, h } = chart;
  const colors = PALETTES[chart.palette ?? 0] ?? PALETTES[0];
  const font = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';
  const round = chart.type === 'pie' || chart.type === 'doughnut';
  const legendItems = round ? data.categories : data.series.map(s => s.name);
  const showLegend = (chart.legend ?? true) && legendItems.length > (round ? 0 : 1);
  const top = chart.title ? 40 : 14;
  const bottom = showLegend ? 34 : 8;
  const parts: JSX.Element[] = [];

  if (round) {
    const vals = (data.series[0]?.values ?? []).map(v => Math.max(0, v ?? 0));
    const total = vals.reduce((s, v) => s + v, 0) || 1;
    const cx = w / 2, cy = top + (h - top - bottom) / 2, r = Math.max(10, Math.min(w / 2 - 16, (h - top - bottom) / 2 - 6));
    const inner = chart.type === 'doughnut' ? r * 0.55 : 0;
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
      const d = v >= total - 1e-9
        ? `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0${inner ? `M${cx - inner},${cy}a${inner},${inner} 0 1,1 ${2 * inner},0a${inner},${inner} 0 1,1 ${-2 * inner},0` : ''}`
        : inner
          ? `M${p(r, a0)}A${r},${r} 0 ${big},1 ${p(r, a1)}L${p(inner, a1)}A${inner},${inner} 0 ${big},0 ${p(inner, a0)}Z`
          : `M${cx},${cy}L${p(r, a0)}A${r},${r} 0 ${big},1 ${p(r, a1)}Z`;
      parts.push(<path key={`s${i}`} d={d} fill={colors[i % colors.length]} stroke={look.bg} strokeWidth={1.5} fillRule="evenodd" />);
      if (chart.labels && v > 0) {
        const mid = (a0 + a1) / 2, lr = inner ? (r + inner) / 2 : r * 0.65;
        parts.push(<text key={`l${i}`} x={cx + lr * Math.cos(mid)} y={cy + lr * Math.sin(mid)} fill="#fff" fontSize={11} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{Math.round((v / total) * 100)}%</text>);
      }
      a0 = a1;
    });
  } else {
    const horizontal = chart.type === 'bar';
    const stacked = chart.type === 'stacked';
    const n = data.categories.length;
    const all: number[] = [];
    if (stacked) data.categories.forEach((_, i) => {
      let pos = 0, neg = 0;
      data.series.forEach(s => { const v = s.values[i] ?? 0; if (v >= 0) pos += v; else neg += v; });
      all.push(pos, neg);
    });
    else data.series.forEach(s => s.values.forEach(v => { if (v !== null) all.push(v); }));
    const lo0 = Math.min(0, ...all), hi0 = Math.max(0, ...all, lo0 === 0 ? 1 : 0);
    const yt = ticks(chart.type === 'scatter' || chart.type === 'line' ? Math.min(...all, hi0) : lo0, hi0);
    const lo = yt[0], hi = yt[yt.length - 1];
    const labelW = Math.max(...yt.map(t => short(t, lang).length)) * 6.5 + 10;
    const catW = horizontal ? Math.min(110, Math.max(...data.categories.map(c => c.length), 1) * 6.5 + 10) : 0;
    const L = horizontal ? catW + 8 : labelW + 8, R = w - 14, T = top, B = h - bottom - (horizontal ? 18 : 20);
    const vx = (v: number) => L + ((v - lo) / (hi - lo)) * (R - L);
    const vy = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T);
    // Grid and value axis.
    yt.forEach((t, i) => {
      if (horizontal) {
        parts.push(<line key={`g${i}`} x1={vx(t)} x2={vx(t)} y1={T} y2={B} stroke={look.grid} />);
        parts.push(<text key={`t${i}`} x={vx(t)} y={B + 14} fill={look.muted} fontSize={10.5} textAnchor="middle">{short(t, lang)}</text>);
      } else {
        parts.push(<line key={`g${i}`} x1={L} x2={R} y1={vy(t)} y2={vy(t)} stroke={look.grid} />);
        parts.push(<text key={`t${i}`} x={L - 6} y={vy(t)} fill={look.muted} fontSize={10.5} textAnchor="end" dominantBaseline="middle">{short(t, lang)}</text>);
      }
    });
    if (chart.type === 'scatter') {
      const xsAll = (data.xs ?? []).filter((x): x is number => x !== null);
      const xt = ticks(Math.min(...xsAll, 0), Math.max(...xsAll, 1));
      const xlo = xt[0], xhi = xt[xt.length - 1];
      const sx = (x: number) => L + ((x - xlo) / (xhi - xlo)) * (R - L);
      xt.forEach((t, i) => parts.push(<text key={`x${i}`} x={sx(t)} y={B + 14} fill={look.muted} fontSize={10.5} textAnchor="middle">{short(t, lang)}</text>));
      data.series.forEach((s, si) => s.values.forEach((v, i) => {
        const x = data.xs?.[i];
        if (v === null || x === null || x === undefined) return;
        parts.push(<circle key={`p${si}-${i}`} cx={sx(x)} cy={vy(v)} r={4} fill={colors[si % colors.length]} />);
      }));
    } else {
      const band = ((horizontal ? B - T : R - L) / Math.max(1, n));
      const groups = stacked ? 1 : data.series.length;
      const barW = (band * 0.7) / Math.max(1, groups);
      // Category labels, thinned out when crowded.
      const every = Math.max(1, Math.ceil((n * (horizontal ? 14 : 48)) / Math.max(1, horizontal ? B - T : R - L)));
      data.categories.forEach((c, i) => {
        if (i % every) return;
        if (horizontal) parts.push(<text key={`c${i}`} x={L - 6} y={T + band * (i + 0.5)} fill={look.muted} fontSize={10.5} textAnchor="end" dominantBaseline="middle">{clip(c, 16)}</text>);
        else parts.push(<text key={`c${i}`} x={L + band * (i + 0.5)} y={B + 14} fill={look.muted} fontSize={10.5} textAnchor="middle">{clip(c, Math.max(4, Math.floor(band * every / 6.5)))}</text>);
      });
      if (chart.type === 'line' || chart.type === 'area') {
        data.series.forEach((s, si) => {
          const pts = s.values.map((v, i) => (v === null ? null : [L + band * (i + 0.5), vy(v)] as const));
          const path = pts.reduce((d, p, i) => (p ? `${d}${d && pts[i - 1] ? 'L' : 'M'}${p[0]},${p[1]}` : d), '');
          const color = colors[si % colors.length];
          if (chart.type === 'area') {
            const ok = pts.filter((p): p is readonly [number, number] => !!p);
            if (ok.length) parts.push(<path key={`a${si}`} d={`M${ok[0][0]},${vy(Math.max(lo, 0))}${ok.map(p => `L${p[0]},${p[1]}`).join('')}L${ok[ok.length - 1][0]},${vy(Math.max(lo, 0))}Z`} fill={color} opacity={0.55} />);
          }
          parts.push(<path key={`l${si}`} d={path} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />);
          if (chart.type === 'line') pts.forEach((p, i) => { if (p) parts.push(<circle key={`m${si}-${i}`} cx={p[0]} cy={p[1]} r={3} fill={color} />); });
          if (chart.labels) pts.forEach((p, i) => { if (p) parts.push(<text key={`v${si}-${i}`} x={p[0]} y={p[1] - 8} fill={look.ink} fontSize={10} textAnchor="middle">{short(s.values[i]!, lang)}</text>); });
        });
      } else {
        const zero = horizontal ? vx(Math.max(lo, 0)) : vy(Math.max(lo, 0));
        data.categories.forEach((_, i) => {
          let pos = 0, neg = 0;
          data.series.forEach((s, si) => {
            const v = s.values[i];
            if (v === null) return;
            const color = colors[si % colors.length];
            let a: number, b: number;
            if (stacked) { const base = v >= 0 ? pos : neg; a = base; b = base + v; if (v >= 0) pos += v; else neg += v; } else { a = 0; b = v; }
            const off = band * 0.15 + (stacked ? 0 : si * barW);
            if (horizontal) {
              const x1 = vx(Math.max(Math.min(a, b), lo)), x2 = vx(Math.max(a, b));
              parts.push(<rect key={`b${si}-${i}`} x={x1} y={T + band * i + off} width={Math.max(0, x2 - x1)} height={barW} fill={color} />);
              if (chart.labels) parts.push(<text key={`v${si}-${i}`} x={x2 + 4} y={T + band * i + off + barW / 2} fill={look.ink} fontSize={10} dominantBaseline="middle">{short(v, lang)}</text>);
            } else {
              const y1 = vy(Math.max(a, b)), y2 = vy(Math.max(Math.min(a, b), lo));
              parts.push(<rect key={`b${si}-${i}`} x={L + band * i + off} y={y1} width={barW} height={Math.max(0, y2 - y1)} fill={color} />);
              if (chart.labels) parts.push(<text key={`v${si}-${i}`} x={L + band * i + off + barW / 2} y={stacked ? (y1 + y2) / 2 : y1 - 4} fill={stacked ? '#fff' : look.ink} fontSize={10} textAnchor="middle" dominantBaseline={stacked ? 'middle' : 'auto'}>{short(v, lang)}</text>);
            }
          });
        });
        parts.push(horizontal
          ? <line key="zero" x1={zero} x2={zero} y1={T} y2={B} stroke={look.muted} />
          : <line key="zero" x1={L} x2={R} y1={zero} y2={zero} stroke={look.muted} />);
      }
    }
  }

  // Legend, centered under the plot.
  if (showLegend) {
    const items = legendItems.map(s => clip(s, 18));
    const widths = items.map(s => s.length * 6.4 + 26);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = Math.max(8, (w - total) / 2);
    items.forEach((s, i) => {
      if (x + widths[i] > w) return;
      parts.push(<rect key={`k${i}`} x={x} y={h - 22} width={10} height={10} rx={2} fill={colors[i % colors.length]} />);
      parts.push(<text key={`n${i}`} x={x + 15} y={h - 17} fill={look.ink} fontSize={11} dominantBaseline="middle">{s}</text>);
      x += widths[i];
    });
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${w} ${h}`} width={w} height={h} fontFamily={font}>
      <rect width={w} height={h} rx={6} fill={look.bg} />
      {chart.title && <text x={w / 2} y={24} fill={look.ink} fontSize={15} fontWeight={600} textAnchor="middle">{clip(chart.title, 60)}</text>}
      {parts}
    </svg>
  );
}

/** Turns a drawn chart into a PNG data URL, twice the size for sharp printing. */
export async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<string> {
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = svg.width.baseVal.value * scale;
  canvas.height = svg.height.baseVal.value * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}
