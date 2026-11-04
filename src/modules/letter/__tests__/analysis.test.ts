import { describe, expect, it } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/core';
import { letterExtensions } from '../setup';
import { analyze, applyEdits, fixPages } from '../analysis';
import { applyTitles, findTitles, makeLists } from '../templates/structure';
import { applyNormContent, normCheck } from '../normCheck';
import { WORK_LAYOUTS, workMargins, workStyles } from '../templates/works';
import { defaultStyles } from '../model';
import { defaultPage } from '../page';
import { computeSpacers } from '../pagination';

const p = (text: string, attrs?: Record<string, unknown>, marks?: JSONContent['marks']): JSONContent =>
  ({ type: 'paragraph', ...(attrs ? { attrs } : {}), ...(text ? { content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] } : {}) });
const h = (level: number, text: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const long = 'Ce paragraphe explique le sujet du travail avec assez de mots pour ressembler à un vrai texte écrit par un étudiant.';

// A work typed like Martin's (2026-11-03): titles as plain lines, "Solution 2 :" with its name on the next line,
// a numbered sub-part never styled, "Introduction :" with a colon, a list typed line by line.
const messy: JSONContent[] = [
  p('Étape 1 Comprendre le problème'), p(long),
  p('Introduction :'), p(long),
  p('Étape 2'), p(long),
  p('Solution 1 : écouter'), p(long),
  p('Solution 2 :'), p('négocier'), p(long),
  p('2.1. Les causes'), p(long),
  p('Les facteurs sont les suivants :'), p('la langue'), p('la culture'), p('les habitudes'),
  p('Conclusion'), p(long),
];

describe('the titles a person typed as text', () => {
  it('finds every title with its level', () => {
    const titles = findTitles(messy, 'fr').map(t => [t.level, t.text]);
    expect(titles).toEqual([
      [1, 'Étape 1 : Comprendre le problème'], [2, 'Introduction'], [1, 'Étape 2'], [2, 'Solution 1 : écouter'],
      [2, 'Solution 2 : négocier'], [2, '2.1. Les causes'], [1, 'Conclusion'],
    ].map(([l, t]) => [l, expect.stringContaining(String(t).split(' ')[0])]));
  });
  it('sets them as headings and rebuilds the list without losing a word', () => {
    const { nodes } = applyTitles(makeLists(messy), 'fr');
    expect(nodes.filter(n => n.type === 'heading').length).toBe(7);
    const list = nodes.find(n => n.type === 'bulletList');
    expect(list?.content?.length).toBe(3);
    const textOf = (n: JSONContent): string => (n.text ?? '') + ' ' + (n.content ?? []).map(textOf).join(' ');
    const words = (ns: JSONContent[]) => ns.map(textOf).join(' ').match(/\p{L}+/gu)!.sort();
    expect(words(nodes)).toEqual(words(messy));
  });
});

describe('Analyse et correction', () => {
  it('finds the structure, the source and the language mistakes, and fixes text as tracked changes', () => {
    const ed = new Editor({ extensions: letterExtensions('body'), content: { type: 'doc', content: [
      ...messy, p('Selon Maslow, les besoins dune personne changent (1 page) au au travail.'), p('Les changements ont été imposé par la direction.'),
    ] } });
    const found = analyze(ed.state.doc, { lang: 'fr', cite: 'apa' });
    const keys = found.map(f => f.key);
    for (const k of ['ana.titlesLists', 'ana.noName', 'ana.noYear', 'ana.spell', 'ana.agree', 'ana.repeat']) expect(keys).toContain(k);
    const spell = found.find(f => f.key === 'ana.spell')!;
    applyEdits(ed, spell.edits!);
    // A tracked change: the old word stays, struck through, until the person accepts it in Révision.
    const html = ed.getHTML();
    expect(html).toMatch(/<del[^>]*>|data-deletion|class="[^"]*deletion/);
    expect(ed.state.doc.textContent).toContain('d’une');
    ed.destroy();
  });
  it('turns four empty lines or more into a page break', () => {
    const ed = new Editor({ extensions: letterExtensions('body'), content: { type: 'doc', content: [p(long), p(''), p(''), p(''), p(''), p(long)] } });
    fixPages(ed);
    expect(ed.getJSON().content!.map(n => n.type)).toEqual(['paragraph', 'pageBreak', 'paragraph']);
    ed.destroy();
  });
});

describe('the norm check (Scribbr-like)', () => {
  const w = WORK_LAYOUTS.find(x => x.id === 'apaProvost')!;
  const body: JSONContent[] = [
    p(long.repeat(3)), h(1, 'Introduction'), p(long.repeat(3), { lineHeight: '1.5' }), p(long, undefined, [{ type: 'textStyle', attrs: { fontFamily: 'Arial', fontSize: '14pt' } }]),
    p(long, undefined, [{ type: 'textStyle', attrs: { fontFamily: 'Arial' } }]), h(1, 'Références'),
    p('Maslow, A. H. (1943). A theory of human motivation. Psychological Review, 50(4), 370-396.'),
    p('Herzberg, F. (1959). The motivation to work. Wiley.'),
  ];
  it('lists the page, the styles, the missing parts and the hand-set look', () => {
    const keys = normCheck({ w, page: { ...defaultPage(), margins: { top: 1, right: 1.25, bottom: 1, left: 1.25 } }, styles: defaultStyles(), tops: body, lang: 'fr' }).map(f => f.key);
    for (const k of ['ana.n.margins', 'ana.n.font', 'ana.n.pt', 'ana.n.line', 'ana.n.indent', 'ana.n.head', 'ana.n.pageNum', 'ana.n.titlePage', 'ana.n.part', 'ana.n.hanging', 'ana.m.direct']) expect(keys).toContain(k);
  });
  it('"Appliquer la norme" leaves only the parts to write', () => {
    const fixed = applyNormContent(body, w);
    const pn: JSONContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'pageNumber', attrs: { kind: 'page' } }] }] };
    const left = normCheck({ w, page: { ...defaultPage(), margins: workMargins(w) }, styles: workStyles(defaultStyles(), w), tops: fixed, header: pn, lang: 'fr' }).map(f => f.key);
    expect(left.filter(k => k !== 'ana.n.part' && k !== 'ana.n.titlePage')).toEqual([]);
    expect(fixed.at(-1)!.attrs).toMatchObject({ indentLeft: 36, indentFirst: -36 });
  });
});

describe('clean pages (LaTeX-like)', () => {
  const layout = { enabled: true, pageHeight: 1000, marginTop: 100, marginBottom: 100, gap: 20, headerHtml: '', footerHtml: '', version: 0 };
  const block = (pos: number, top: number, height: number, keepNext = false) => ({ pos, top, height, marginTop: 0, marginBottom: 0, isBreak: false, keepNext });
  it('never leaves a title alone at the bottom of a page', () => {
    // The title fits (ends at 770) but the paragraph after it goes to page 2: the title goes with it.
    const { spacers } = computeSpacers([block(0, 0, 740), block(10, 740, 30, true), block(20, 770, 100)], layout);
    expect(spacers.map(s => s.pos)).toEqual([10]);
  });
  it('cuts a long paragraph between two lines, two lines at least on each side, like Word', () => {
    // 30 lines of 25px from 650: lines up to 800 fit (6 lines), the rest goes to page 2.
    const lines = Array.from({ length: 30 }, (_, i) => ({ top: 650 + i * 25 + 5, bottom: 650 + i * 25 + 20 }));
    const { spacers } = computeSpacers([block(0, 0, 650), { ...block(10, 650, 750), lines, linePos: i => 100 + i }], layout);
    expect(spacers.map(s => [s.pos, !!s.inline])).toEqual([[106, true]]);
    // A paragraph whose last line alone would go over: two lines go to the next page (no widow).
    const short = Array.from({ length: 7 }, (_, i) => ({ top: 640 + i * 25 + 5, bottom: 640 + i * 25 + 20 }));
    const r = computeSpacers([block(0, 0, 640), { ...block(10, 640, 175), lines: short, linePos: i => 200 + i }], layout);
    expect(r.spacers.map(s => s.pos)).toEqual([205]);
  });
  it('keeps the old layout when what follows fits', () => {
    const { spacers } = computeSpacers([block(0, 0, 400), block(10, 400, 30, true), block(20, 430, 100)], layout);
    expect(spacers).toEqual([]);
  });
});
