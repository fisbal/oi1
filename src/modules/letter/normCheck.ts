// "Vérification de la norme" (Martin, 2026-11-03: "et par rapport à la mise en page ?"): like a careful marker with
// the norm's guide open, it compares the page and the styles with the chosen norm (APA, MLA, Chicago…): paper size,
// margins, font, size, line spacing, first-line indent, alignment, the look of each heading level, the page number,
// the title page, the table of contents, the parts the norm asks for, and the hanging indent of the references. It also
// finds the look typed by hand (a font or a size set on words, a spacing set on one paragraph), which the norm's
// styles should give instead. "Appliquer la norme" fixes all of it at once, without changing a word.
import type { JSONContent } from '@tiptap/core';
import type { DocStyles, StyleDef } from './model';
import type { PageSettings } from './page';
import { REFS_TITLE, type Finding } from './analysis';
import { lookOnly, workMargins, workStyles, TOC_MARK, type WorkLayout } from './templates/works';
import { nodeText } from './templates/structure';

const TOC_TITLE = /^(table des mati[eè]res|sommaire|table of contents|contents|[ií]ndice|sum[aá]rio|inhaltsverzeichnis|inhalt)$/i;
/** Parts a work may leave out: the appendices, the thanks, the lists of tables and figures. */
const OPTIONAL = /^(annexes?|appendi(?:x|ces)|remerciements|acknowledg(?:e)?ments|liste des|list of|d[ée]dicace|avant-propos)/i;
const CM = 2.54;

export interface NormInput {
  w: WorkLayout;
  page: PageSettings;
  styles: DocStyles;
  /** The body's top-level blocks. */
  tops: JSONContent[];
  header?: JSONContent | null;
  footer?: JSONContent | null;
  lang?: string;
}

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const words = (tops: JSONContent[]) => tops.reduce((n, x) => n + (nodeText(x).match(/\p{L}+/gu)?.length ?? 0), 0);
const has = (n: JSONContent | null | undefined, type: string): boolean => !!n && (n.type === type || (n.content ?? []).some(c => has(c, type)));
const cm = (inches: number) => (Math.round(inches * CM * 100) / 100).toLocaleString('fr-CA');
const fontName = (f?: string) => (f ?? '').split(',')[0].replace(/["']/g, '').trim().toLowerCase();
const line = (v: StyleDef['lineHeight']) => (typeof v === 'number' ? v : Number.parseFloat(String(v ?? '1.15')));

/** The blocks before the first page break near the start: a title page, laid out its own way. */
export function coverEnd(tops: JSONContent[], w: WorkLayout): number {
  if (w.title === 'none') return 0;
  const i = tops.slice(0, 40).findIndex(x => x.type === 'pageBreak');
  return i < 0 ? 0 : i + 1;
}

/** Where the references part is: its title, and the blocks up to the next big part. */
function refsSection(tops: JSONContent[]): [number, number] | null {
  const at = tops.findIndex(x => x.type === 'heading' && REFS_TITLE.test(nodeText(x).trim()));
  if (at < 0) return null;
  let end = at + 1;
  while (end < tops.length && !(tops[end].type === 'heading' && Number(tops[end].attrs?.level ?? 1) <= 1) && tops[end].type !== 'pageBreak') end++;
  return [at, end];
}
const isEntry = (x: JSONContent) => x.type === 'paragraph' && !!nodeText(x).trim() && nodeText(x) !== TOC_MARK;
/** Numbered lists of references (IEEE, Vancouver, AMA, ACS) are not laid out with a hanging indent. */
const numbered = (x: JSONContent) => /^\s*(?:\[\d+\]|\d+[.)])\s/.test(nodeText(x));

/** Words and paragraphs whose look was set by hand instead of by the norm's styles (a value equal to the style's is fine). */
function directLook(tops: JSONContent[], from: number, refs: [number, number] | null, styles: DocStyles): number {
  let n = 0;
  const inRefs = (i: number) => !!refs && i > refs[0] && i < refs[1];
  const differs = (v: unknown, want: number) => v != null && Math.abs(Number.parseFloat(String(v)) - want) > 0.5;
  const walk = (x: JSONContent, top: boolean, i: number) => {
    if (x.type === 'text' && x.marks?.some(m => m.type === 'textStyle' && (m.attrs?.fontFamily || m.attrs?.fontSize))) n++;
    if (top && (x.type === 'paragraph' || x.type === 'heading') && x.attrs) {
      const a = x.attrs;
      const st: StyleDef = x.type === 'heading' ? styles[`h${Math.min(Math.max(Number(a.level ?? 1), 1), 6)}` as 'h1'] : styles.normal;
      const center = a.textAlign === 'center';
      if (a.lineHeight && Math.abs(line(a.lineHeight) - line(st.lineHeight)) > 0.05) n++;
      else if (differs(a.spaceBefore, st.before ?? 0) || differs(a.spaceAfter, st.after ?? 0)) n++;
      else if (a.indentFirst && differs(a.indentFirst, st.indent ?? 0) && !center && !(inRefs(i) && a.indentFirst < 0)) n++;
      else if (a.textAlign && !center && x.type === 'heading' && a.textAlign !== (st.align ?? 'left')) n++;
    }
    // Inside tables and lists only the words count: a cell keeps its own alignment.
    for (const c of x.content ?? []) walk(c, false, i);
  };
  tops.forEach((x, i) => { if (i >= from) walk(x, true, i); });
  return n;
}

export function normCheck({ w, page, styles, tops, header, footer, lang }: NormInput): Finding[] {
  const out: Finding[] = [];
  let id = 0;
  const add = (f: Omit<Finding, 'id' | 'group'> & { group?: Finding['group'] }) => out.push({ id: `n${id++}`, group: 'layout', ...f });
  const name = lang === 'en' ? w.name.en : w.name.fr;
  const want = workStyles(styles, w);

  // ---- the page
  if (page.size !== w.size || page.orientation !== 'portrait') add({ key: 'ana.n.size', vars: { norm: name, size: w.size === 'a4' ? 'A4' : 'Lettre / Letter' }, action: 'norm' });
  const m = workMargins(w);
  const off = (['top', 'right', 'bottom', 'left'] as const).filter(k => Math.abs(page.margins[k] - m[k]) > 0.04);
  if (off.length) add({ key: 'ana.n.margins', vars: { norm: name, want: cm(m.top), now: off.map(k => cm(page.margins[k])).join(' / ') }, action: 'norm' });

  // ---- the body text's style
  const nm = styles.normal;
  if (fontName(nm.font) !== fontName(w.font)) add({ key: 'ana.n.font', vars: { norm: name, want: w.font, now: nm.font ?? '—' }, action: 'norm' });
  if ((nm.size ?? 11) !== w.pt) add({ key: 'ana.n.pt', vars: { norm: name, want: w.pt, now: nm.size ?? 11 }, action: 'norm' });
  if (Math.abs(line(nm.lineHeight) - w.line) > 0.05) add({ key: 'ana.n.line', vars: { norm: name, want: w.line, now: line(nm.lineHeight) }, action: 'norm' });
  if ((nm.align ?? 'left') !== w.align) add({ key: w.align === 'justify' ? 'ana.n.justify' : 'ana.n.left', vars: { norm: name }, action: 'norm' });
  if (Math.abs((nm.indent ?? 0) - w.indent) > 2) add({ key: w.indent ? 'ana.n.indent' : 'ana.n.noIndent', vars: { norm: name, want: cm(w.indent / 72) }, action: 'norm' });

  // ---- the headings' look, level by level
  const look = (s: StyleDef) => [s.align ?? 'left', !!s.bold, !!s.italic, !!s.caps, s.size ?? 0, fontName(s.font)].join('|');
  const levels = new Set<number>();
  for (const x of tops) if (x.type === 'heading') levels.add(Number(x.attrs?.level ?? 1));
  for (const lv of [1, 2, 3] as const) {
    const k = `h${lv}` as const;
    if (levels.has(lv) && look(styles[k]) !== look(want[k])) {
      const s = want[k];
      const how = [s.align === 'center' ? 'center' : 'left', s.bold ? 'bold' : '', s.italic ? 'italic' : '', s.caps ? 'caps' : ''].filter(Boolean).join('|');
      add({ key: 'ana.n.head', vars: { norm: name, level: lv, how }, action: 'norm' });
    }
  }

  // ---- the parts of the work (only for a real work, not a few lines)
  const cover = coverEnd(tops, w);
  const refs = refsSection(tops);
  const big = words(tops) >= 150;
  if (big) {
    if (w.num && !has(header, 'pageNumber') && !has(footer, 'pageNumber')) add({ key: 'ana.n.pageNum', vars: { norm: name, where: w.num === 'bc' ? 'bc' : w.num === 'br' ? 'br' : 'tr' }, action: 'pagenum' });
    if (w.title !== 'none' && !cover) add({ key: 'ana.n.titlePage', vars: { norm: name }, action: 'reorganize' });
    const headings = tops.filter(x => x.type === 'heading');
    const toc = tops.some(x => nodeText(x).trim() === TOC_MARK || (x.type !== 'table' && TOC_TITLE.test(nodeText(x).trim())));
    if (w.parts.some(p => p[0] === -1) && headings.length >= 3 && !toc) add({ key: 'ana.n.toc', vars: { norm: name }, action: 'toc' });
    if (headings.length >= 2) {
      const bare = (t: string) => plain(t).replace(/\s*\([^)]*\)\s*$/, '').replace(/^(?:(?:chapitre|chapter|partie|part)\s+)?(?:[ivxlc]+|\d+(?:\.\d+)*|[a-z])[.)]?\s+[-–—:]?\s*/, '');
      const have = headings.map(x => bare(nodeText(x)));
      const en = lang === 'en';
      for (const p of w.parts) {
        const part = en ? p[2] : p[1];
        if (p[0] !== 1 || !part || part.includes('[') || OPTIONAL.test(part)) continue;
        const found = REFS_TITLE.test(part) ? (!!refs || headings.some(x => REFS_TITLE.test(nodeText(x).trim())))
          : have.some(h => h.startsWith(bare(part)));
        if (!found) add({ key: 'ana.n.part', vars: { norm: name, part }, action: REFS_TITLE.test(part) ? 'refs' : undefined, refs: REFS_TITLE.test(part) ? [] : undefined });
      }
    }
  }
  // ---- the references: each one with the hanging indent the norms ask for
  if (refs) {
    const flat = tops.slice(refs[0] + 1, refs[1]).filter(isEntry).filter(x => !numbered(x) && !((x.attrs?.indentFirst ?? 0) < 0));
    if (flat.length) add({ key: 'ana.n.hanging', vars: { n: flat.length }, excerpt: nodeText(flat[0]).slice(0, 90), action: 'norm' });
  }
  // ---- the look typed by hand: a method tip, the styles do it for the whole work
  const direct = directLook(tops, cover, refs, styles);
  if (direct >= 3) add({ group: 'method', key: 'ana.m.direct', vars: { n: direct }, action: 'norm' });
  return out;
}

/**
 * The text's part of "Appliquer la norme": the look typed by hand goes (the norm's styles show everywhere, a title
 * page keeps its centered lines), and each reference gets its hanging indent. Not a word changes.
 */
export function applyNormContent(tops: JSONContent[], w: WorkLayout): JSONContent[] {
  const cover = coverEnd(tops, w);
  const out = [...tops.slice(0, cover), ...lookOnly(tops.slice(cover))];
  const refs = refsSection(out);
  if (refs) for (let i = refs[0] + 1; i < refs[1]; i++) {
    if (isEntry(out[i]) && !numbered(out[i])) out[i] = { ...out[i], attrs: { ...out[i].attrs, textAlign: null, indentLeft: 36, indentFirst: -36 } };
  }
  return out;
}
