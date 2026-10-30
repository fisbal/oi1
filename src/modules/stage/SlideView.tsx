// Draws one slide: background, the theme's decorations, then every item (text, shapes, pictures, tables),
// at the slide's own size in pixels. The editor, the thumbnails, the slide show and printing all use it,
// so a slide looks the same everywhere.

import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cssBackground, defaultAlign, defaultSize, isEmptyHtml, type Deck, type DeckTheme, type Item, type LayoutId, type ShapeItem, type Slide, type TableItem } from '../../formats/slides';
import { cssFont } from '../letter/model';
import { geomPath, isLine, textInset } from './geom';
import { splitHtml, type ItemPlay } from './anim';

/** Light or dark text for a fill color. */
export function onColor(fill: string): 'light' | 'dark' {
  const m = fill.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return 'dark';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? 'dark' : 'light';
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k))));
  return `#${ch.map(c => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** The fill a shape is drawn with: its own, none, or the theme's first accent for shapes. */
export const shapeFill = (it: ShapeItem, theme: DeckTheme): string | null =>
  it.fill !== undefined ? it.fill : it.role || isLine(it.geom) ? null : theme.accents[0];
export const shapeLine = (it: ShapeItem, theme: DeckTheme) =>
  it.line !== undefined ? it.line : it.role ? null : isLine(it.geom) ? { color: theme.accents[0], width: 2.25 } : { color: shade(theme.accents[0], -0.3), width: 1 };

/** The text color a shape's text starts with. */
export function textColor(it: ShapeItem, theme: DeckTheme): string {
  if (it.role === 'title') return theme.title;
  const fill = shapeFill(it, theme);
  if (fill && !it.role) return onColor(fill) === 'light' ? '#FFFFFF' : '#1F1F1F';
  return theme.text;
}

export function themeVars(theme: DeckTheme): CSSProperties {
  return {
    '--st-title': theme.title, '--st-text': theme.text, '--st-head': cssFont(theme.head), '--st-body': cssFont(theme.body),
    '--st-accent': theme.accents[0], '--st-accent2': theme.accents[1] ?? theme.accents[0],
  } as CSSProperties;
}

/**
 * Text that shrinks to fit its box, like PowerPoint's AutoFit. The text is zoomed down as a whole (sizes set on
 * words shrink too) and laid out at the matching wider width, so lines break as they would at the smaller size.
 */
function FitText({ html, children, autofit, base, onFit, id }: { html: string; children?: ReactNode; autofit: boolean; base: number; onFit?: (id: string, k: number) => void; id: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = outer.current, body = inner.current;
    if (!el || !body) return;
    if (!autofit) { if (k !== 1) setK(1); return; }
    if (children) {
      // While typing, the text shrinks as it grows, like PowerPoint: the font size steps down (the editor keeps
      // its real coordinates, so the cursor and clicks stay right), and grows back when lines are removed.
      const refit = () => {
        let z = 1;
        body.style.fontSize = '';
        while (z > 0.4 && body.offsetHeight > el.clientHeight + 1) { z = Math.round((z - 0.05) * 1000) / 1000; body.style.fontSize = `${z}em`; }
        onFit?.(id, z);
      };
      refit();
      const watch = new MutationObserver(refit);
      watch.observe(body, { childList: true, subtree: true, characterData: true });
      return () => watch.disconnect();
    }
    const fits = (z: number) => {
      body.style.zoom = String(z);
      body.style.width = `${100 / z}%`;
      return body.offsetHeight * z <= el.clientHeight + 1;
    };
    let next = 1;
    // A few steps down until the text fits, never below 40 %.
    while (next > 0.4 && !fits(next)) next = Math.round((next - 0.05) * 1000) / 1000;
    body.style.zoom = '';
    body.style.width = '';
    if (next !== k) setK(next);
    onFit?.(id, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, base, autofit, children, id, onFit]);
  return (
    <div ref={outer} className="st-fit" style={{ fontSize: `${base}pt` }}>
      {children ? <div ref={inner} className="st-editwrap">{children}</div>
        : <div ref={inner} className="st-html" style={k !== 1 ? { zoom: k, width: `${100 / k}%` } : undefined} dangerouslySetInnerHTML={{ __html: html }} />}
    </div>
  );
}

function TableView({ it, theme }: { it: TableItem; theme: DeckTheme }) {
  const color = it.color ?? theme.accents[0];
  const light = shade(color, 0.82), lighter = shade(color, 0.9);
  const cols = it.cols ?? it.rows[0]?.map(() => 1 / (it.rows[0]?.length || 1)) ?? [];
  return (
    <table className="st-table" style={{ fontFamily: 'var(--st-body)' }}>
      <colgroup>{cols.map((c, i) => <col key={i} style={{ width: `${c * 100}%` }} />)}</colgroup>
      <tbody>
        {it.rows.map((row, r) => {
          const head = it.header && r === 0;
          const band = it.banded ? ((r - (it.header ? 1 : 0)) % 2 === 0 ? light : lighter) : lighter;
          return (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} data-cell={`${r}:${c}`} style={{ background: head ? color : band, color: head ? (onColor(color) === 'light' ? '#FFFFFF' : '#1F1F1F') : '#1F1F1F', fontWeight: head ? 700 : 400 }}>{cell}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export interface ItemExtras {
  /** The editor shown in place of a text item's HTML while it is being edited. */
  editor?: ReactNode;
  /** Show "Click to add title" in empty placeholders. */
  prompt?: string;
  onFit?: (id: string, k: number) => void;
  /** A table being edited: its cells are editable. */
  tableEditor?: ReactNode;
}

/** An item with its animation during the show: the animation moves an inner layer, so the item's rotation stays. */
export function ItemView({ it, theme, layout, extras, play }: { it: Item; theme: DeckTheme; layout: LayoutId; extras?: ItemExtras; play?: ItemPlay }) {
  const inner = <ItemBody it={it} theme={theme} layout={layout} extras={extras} play={play} />;
  if (!play || (!play.hidden && !play.animation && !play.loop)) return inner;
  const whole = play.animation && !play.by ? play.animation : undefined;
  return (
    <div className="st-anim" data-anim={it.id} style={{ visibility: play.hidden ? 'hidden' : undefined, animation: whole, transformOrigin: `${it.x + it.w / 2}px ${it.y + it.h / 2}px` }}>
      {play.loop ? <div className="st-anim st-loop" style={{ animation: play.loop, transformOrigin: `${it.x + it.w / 2}px ${it.y + it.h / 2}px` }}>{inner}</div> : inner}
    </div>
  );
}

function ItemBody({ it, theme, layout, extras, play }: { it: Item; theme: DeckTheme; layout: LayoutId; extras?: ItemExtras; play?: ItemPlay }) {
  const style: CSSProperties = {
    left: it.x, top: it.y, width: it.w, height: it.h,
    transform: it.rot ? `rotate(${it.rot}deg)` : undefined,
  };
  const flip = it.flipH || it.flipV ? `scale(${it.flipH ? -1 : 1}, ${it.flipV ? -1 : 1})` : undefined;
  if (it.kind === 'image') {
    const line = it.line;
    return (
      <div className="st-item st-image" data-id={it.id} style={style}>
        <img src={it.src} alt={it.alt ?? ''} draggable={false} style={{ transform: flip, outline: line ? `${line.width * 1.333}px solid ${line.color}` : undefined, outlineOffset: line ? -line.width * 1.333 / 2 : undefined }} />
      </div>
    );
  }
  if (it.kind === 'table') {
    return <div className="st-item st-tablebox" data-id={it.id} style={style}>{extras?.tableEditor ?? <TableView it={it} theme={theme} />}</div>;
  }
  const fill = shapeFill(it, theme);
  const line = shapeLine(it, theme);
  const lineW = line ? line.width * 1.333 : 0;
  const dash = line?.dash === 'dash' ? `${lineW * 4} ${lineW * 3}` : line?.dash === 'dot' ? `${lineW} ${lineW * 2}` : undefined;
  const lineItem = isLine(it.geom);
  const inset = textInset(it.geom);
  const editing = !!extras?.editor;
  const empty = !editing && isEmptyHtml(it.html);
  const base = defaultSize(it.role, layout);
  const pad = { t: 4.8 + inset.t * it.h, r: 9.6 + inset.r * it.w, b: 4.8 + inset.b * it.h, l: 9.6 + inset.l * it.w };
  return (
    <div className={`st-item st-shape${it.role ? ` st-role-${it.role}` : ''}${empty && extras?.prompt ? ' st-empty' : ''}`} data-id={it.id} style={style}
      data-prompt={empty ? extras?.prompt : undefined}>
      {(fill || line) && (
        <svg className="st-geom" width="100%" height="100%" viewBox={`0 0 ${Math.max(1, it.w)} ${Math.max(1, it.h)}`} preserveAspectRatio="none" style={{ transform: flip }} aria-hidden="true">
          {it.geom === 'arrow' && line && (
            <defs><marker id={`ah-${it.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth={4} markerHeight={4} orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={line.color} /></marker></defs>
          )}
          <path d={geomPath(it.geom, Math.max(1, it.w), Math.max(1, it.h))} fill={lineItem ? 'none' : fill ?? 'none'}
            stroke={line?.color ?? 'none'} strokeWidth={lineW} strokeDasharray={dash} vectorEffect="non-scaling-stroke"
            markerEnd={it.geom === 'arrow' ? `url(#ah-${it.id})` : undefined} strokeLinejoin="round" />
        </svg>
      )}
      {!lineItem && (
        <div className={`st-text st-v-${it.valign ?? (it.role ? 'top' : 'middle')}`}
          style={{
            padding: `${pad.t}px ${pad.r}px ${pad.b}px ${pad.l}px`, color: textColor(it, theme),
            fontFamily: it.role === 'title' ? 'var(--st-head)' : 'var(--st-body)',
            textAlign: it.role ? defaultAlign(it.role, layout) : 'center',
            // Titles a little tighter than text, but not below 1: script fonts' tall letters would touch the next line.
            lineHeight: it.spacing ?? (it.role === 'title' ? 1.04 : 1.12),
          }}>
          <FitText id={it.id} html={play?.by && play.animation ? splitHtml(it.html, play.by, play.animation, play.stagger ?? 0.1) : it.html} autofit={!!it.autofit} base={base} onFit={extras?.onFit}>{extras?.editor}</FitText>
        </div>
      )}
    </div>
  );
}

/** The slide's background and the theme's decorations. */
export function Backdrop({ deck, slide }: { deck: Deck; slide: Slide }) {
  const theme = deck.theme;
  return <>
    <div className="st-bg" style={{ background: cssBackground(slide.bg ?? theme.bg) }} />
    {!slide.bg && (theme.deco ?? []).map((d, i) => {
      const box = {
        left: `${d.x * 100}%`, top: `${d.y * 100}%`, width: `${d.w * 100}%`, height: `${d.h * 100}%`,
        opacity: d.opacity ?? 1, transform: d.rot ? `rotate(${d.rot}deg)` : undefined,
      };
      if (d.geom && d.geom !== 'rect' && d.geom !== 'ellipse') {
        const w = d.w * deck.w, h = d.h * deck.h;
        return (
          <svg key={i} className="st-deco" style={box} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
            <path d={geomPath(d.geom, w, h)} fill={d.color} />
          </svg>
        );
      }
      return <div key={i} className="st-deco" style={{ ...box, background: d.to ? `linear-gradient(90deg, ${d.color}, ${d.to})` : d.color, borderRadius: d.round || d.geom === 'ellipse' ? '50%' : undefined }} />;
    })}
    {!slide.bg && (theme.decoItems ?? []).map(it => <ItemView key={it.id} it={it} theme={theme} layout={slide.layout} />)}
  </>;
}

/** A whole slide at its own size; scale it from outside with a CSS transform. */
export const SlideView = memo(function SlideView({ deck, slide, extras, className, style, play }: {
  deck: Deck; slide: Slide; extras?: (it: Item) => ItemExtras | undefined; className?: string; style?: CSSProperties;
  /** The show's state of each item: hidden, animating or looping (see anim.ts). */
  play?: Map<string, ItemPlay>;
}) {
  return (
    <div className={`st-slide ${className ?? ''}`} data-layout={slide.layout} style={{ width: deck.w, height: deck.h, ...themeVars(deck.theme), ...style }}>
      <Backdrop deck={deck} slide={slide} />
      {slide.items.map(it => <ItemView key={it.id} it={it} theme={deck.theme} layout={slide.layout} extras={extras?.(it)} play={play?.get(it.id)} />)}
    </div>
  );
});

/** A slide shrunk to a width, for thumbnails and galleries. */
export function SlideThumb({ deck, slide, width }: { deck: Deck; slide: Slide; width: number }) {
  const k = width / deck.w;
  return (
    <div className="st-thumb" style={{ width, height: deck.h * k }}>
      <SlideView deck={deck} slide={slide} style={{ transform: `scale(${k})`, transformOrigin: '0 0' }} />
    </div>
  );
}
