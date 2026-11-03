import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { readDocx } from '../docx/read';
import { letterToDocx } from '../docx/write';
import { defaultStyles, type LetterDoc } from '../model';
import { TOC_MARK, WORK_LAYOUTS, lookOnly, reorganizeDoc, workDoc, workMargins, workStyles } from '../templates/works';
import { WORKS_MISSING, workText } from '../templates/worksI18n';

const textOf = (n: JSONContent): string => (n.text ?? '') + (n.content ?? []).map(textOf).join('');
const byId = (id: string) => WORK_LAYOUTS.find(w => w.id === id)!;

describe('work layouts (mises en page des travaux)', () => {
  it('has 30+ norms with unique ids and names in French and English', () => {
    expect(WORK_LAYOUTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(WORK_LAYOUTS.map(w => w.id)).size).toBe(WORK_LAYOUTS.length);
    for (const w of WORK_LAYOUTS) {
      expect(w.name.fr && w.name.en && w.hint.fr && w.hint.en).toBeTruthy();
      expect(w.m.every(x => x > 0.5 && x < 6)).toBe(true);
      expect(w.parts.length).toBeGreaterThan(0);
    }
  });

  it('APA-Provost: 2.5 cm margins, Times 12, double spacing, 5-space indent, centered level 1', () => {
    const w = byId('apaProvost');
    const m = workMargins(w);
    expect(m.top * 2.54).toBeCloseTo(2.5, 2);
    expect(m.left * 2.54).toBeCloseTo(2.5, 2);
    const st = workStyles(defaultStyles(), w);
    expect(st.normal.font).toMatch(/Times/);
    expect(st.normal.size).toBe(12);
    expect(st.normal.lineHeight).toBe(2);
    expect(st.normal.indent).toBe(36);
    expect(st.h1.align).toBe('center');
    expect(st.h1.color).toBe('#000000');
  });

  it('builds the parts in order with a title page, a TOC mark and yellow fields', () => {
    for (const lang of ['fr', 'en'] as const) {
      const doc = workDoc(byId('apaProvost'), lang, '2026-11-02');
      const heads = doc.filter(n => n.type === 'heading').map(textOf);
      const want = lang === 'fr' ? ['Introduction', 'Conclusion', 'Références'] : ['Introduction', 'Conclusion', 'References'];
      const at = want.map(h => heads.findIndex(x => x.includes(h)));
      expect(at.every((x, i) => x >= 0 && (i === 0 || x > at[i - 1]))).toBe(true);
      expect(doc.some(n => textOf(n) === TOC_MARK)).toBe(true);
      expect(doc.filter(n => n.type === 'pageBreak').length).toBeGreaterThanOrEqual(3);
      expect(JSON.stringify(doc)).toContain('"highlight"');
    }
  });

  it('every norm builds a document in all 5 languages, with every text translated', () => {
    WORKS_MISSING.clear();
    for (const w of WORK_LAYOUTS) {
      for (const lang of ['fr', 'en', 'es', 'pt', 'de'] as const) {
        expect(workDoc(w, lang, '2026-11-02').length).toBeGreaterThan(2);
        workText(w.name.fr, w.name.en, lang);
        workText(w.hint.fr, w.hint.en, lang);
      }
    }
    workText('[Nom] ', '[Last name] ', 'de');
    expect([...WORKS_MISSING]).toEqual([]);
  });

  it('a French app gets French text, a German app German text (Martin, 2026-11-02)', () => {
    const fr = JSON.stringify(workDoc(byId('school'), 'fr', 'x'));
    expect(fr).toContain('Travail présenté à');
    expect(fr).not.toContain('Presented to');
    const de = JSON.stringify(workDoc(byId('school'), 'de', 'x'));
    expect(de).toContain('Vorgelegt bei');
    expect(de).toContain('Einleitung');
    expect(de).not.toContain('Introduction');
    expect(JSON.stringify(workDoc(byId('apaProvost'), 'es', 'x'))).toContain('Índice');
    expect(JSON.stringify(workDoc(byId('apaProvost'), 'pt', 'x'))).toContain('Referências');
  });

  it('keeps the first-line indent through Word (.docx)', async () => {
    const styles = workStyles(defaultStyles(), byId('apa7'));
    const doc: LetterDoc = {
      page: { size: 'letter', orientation: 'portrait', margins: workMargins(byId('apa7')), headerDistance: 0.5, footerDistance: 0.5 },
      styles,
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bonjour.' }] }] },
    } as LetterDoc;
    const back = await readDocx(await letterToDocx(doc, 'Travail'));
    expect(back.styles.normal.indent).toBeCloseTo(36, 0);
  });
});

describe('reorganize my text (Martin, 2026-11-02)', () => {
  const P = (t: string, bold = false): JSONContent => ({ type: 'paragraph', content: [{ type: 'text', text: t, ...(bold ? { marks: [{ type: 'bold' }] } : {}) }] });
  const words = (doc: JSONContent[]) => doc.map(textOf).join(' ');

  it('turns typed titles into headings, adds title page and TOC, sorts references, keeps every word', () => {
    const before = [
      P('Introduction', true), P('Le sujet de ce travail est la photosynthèse.'),
      P('1. Les plantes'), P('Les plantes captent la lumière.'),
      P('Conclusion'), P('La lumière nourrit la vie.'),
      P('Références'), P('Zola, É. (1885). Germinal.'), P('Alain. (1925). Propos.'), P('Martin, B. (2026). In 1.'),
    ];
    const r = reorganizeDoc(byId('apaProvost'), 'fr', 'x', before);
    const heads = r.content.filter(n => n.type === 'heading').map(textOf);
    expect(heads).toEqual(['Table des matières', 'Introduction', '1. Les plantes', 'Conclusion', 'Références']);
    expect(r.content.some(n => textOf(n) === TOC_MARK)).toBe(true);
    expect(words(r.content)).toContain('[Prénom Nom]');
    for (const n of before) expect(words(r.content)).toContain(textOf(n));
    const refs = r.content.slice(r.content.findIndex(n => textOf(n) === 'Références') + 1).map(textOf);
    expect(refs).toEqual(['Alain. (1925). Propos.', 'Martin, B. (2026). In 1.', 'Zola, É. (1885). Germinal.']);
    const ref = r.content.find(n => textOf(n).startsWith('Alain'))!;
    expect(ref.attrs).toMatchObject({ indentLeft: 36, indentFirst: -36 });
    const i = r.content.findIndex(n => textOf(n) === 'Références');
    expect(r.content[i - 1].type).toBe('pageBreak');
    expect(r.sortedRefs).toBe(3);
  });

  it('a text without titles gets Introduction and Conclusion around it', () => {
    const r = reorganizeDoc(byId('essay'), 'fr', 'x', [P('Premier paragraphe assez long pour être du texte.'), P('Milieu du texte.'), P('Dernier paragraphe qui conclut.')]);
    expect(r.madeTitles).toBe(true);
    const seq = r.content.filter(n => n.type === 'heading' || /paragraphe|Milieu/.test(textOf(n))).map(n => (n.type === 'heading' ? `#${textOf(n)}` : textOf(n).slice(0, 6)));
    expect(seq).toEqual(['#Introduction', 'Premie', '#[Développement]', 'Milieu', '#Conclusion', 'Dernie']);
  });

  it('keeps a title page the person already made and drops an old table of contents', () => {
    const r = reorganizeDoc(byId('apaProvost'), 'fr', 'x', [
      P('Marie Tremblay'), P('Mon beau travail'), P('Table des matières'), P('Introduction ........ 3'), { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Introduction' }] }, P('Texte.'),
    ]);
    expect(r.keptTitlePage).toBe(true);
    expect(words(r.content)).not.toContain('[Prénom Nom]');
    expect(words(r.content)).not.toContain('........');
    expect(textOf(r.content[0])).toBe('Marie Tremblay');
  });

  it('a long sentence ending with a period is never taken for a title', () => {
    const r = reorganizeDoc(byId('apa7'), 'en', 'x', [P('Introduction'), P('This is a normal sentence.', true), P('Short bold line', true)]);
    const heads = r.content.filter(n => n.type === 'heading').map(textOf);
    expect(heads).toEqual(['Introduction', 'Short bold line']);
  });

  // Martin (2026-11-03): "quand on vient déjà avec son texte, il fait un peu désordre". A text pasted from Word:
  // its own title page, an old table of contents, fonts and colors, empty lines, lines cut like in a PDF.
  const S = (t: string, style: Record<string, unknown>, attrs: Record<string, unknown> = {}): JSONContent => ({ type: 'paragraph', attrs, content: [{ type: 'text', text: t, marks: [{ type: 'textStyle', attrs: style }] }] });
  const E: JSONContent = { type: 'paragraph' };
  const pasted: JSONContent[] = [
    { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Les énergies renouvelables', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { fontFamily: 'Arial', fontSize: '20pt', color: '#1F4E79' } }] }] },
    { ...P('Marie Tremblay'), attrs: { textAlign: 'center' } }, { ...P('Cours ENV-1001'), attrs: { textAlign: 'center' } }, E, E,
    P('TABLE DES MATIÈRES', true), P('Introduction ......... 3'), P('1. Contexte historique ...... 4'), P('Conclusion\t8'), E,
    { type: 'heading', attrs: { level: 1, textAlign: 'left' }, content: [{ type: 'text', text: 'INTRODUCTION', marks: [{ type: 'textStyle', attrs: { fontSize: '16pt', color: '#2E74B5' } }] }] },
    S("L'hydroélectricité occupe une place centrale.", { fontFamily: 'Calibri', fontSize: '11pt', color: '#333333' }, { lineHeight: '1.15', textAlign: 'right', spaceAfter: 8 }),
    E, E, E,
    P('1. Contexte historique', true),
    P('La nationalisation de 1963 a permis de regrouper les producteurs'), P('et a transfor-'), P('mé la province.'),
    P('Chapitre 2', true), P('Texte du chapitre.'),
    P('CONCLUSION'), P('Le Québec a des atouts.'),
    { type: 'pageBreak' }, { type: 'pageBreak' },
    P('BIBLIOGRAPHIE', true), P('Whitmore, J. (2024). État.'), E, P('Bélanger, M. (2019). Hydro.'),
    P('Annexe A – Carte des barrages', true), P('Voir la carte.'),
  ];
  const r = reorganizeDoc(byId('apaProvost'), 'fr', 'x', pasted);
  const heads = r.content.filter(n => n.type === 'heading').map(textOf);

  it('pasted from Word: keeps the person\'s title page once, centered, and adds no second one', () => {
    expect(r.keptTitlePage).toBe(true);
    expect(textOf(r.content[0])).toBe('Les énergies renouvelables');
    expect(r.content[0].type).toBe('paragraph');
    expect(r.content[0].attrs?.textAlign).toBe('center');
    expect(words(r.content)).not.toContain('[Prénom Nom]');
    expect(heads).not.toContain('Les énergies renouvelables');
  });
  it('pasted from Word: the old table of contents goes, its lines never become titles', () => {
    expect(heads).toEqual(['Table des matières', 'INTRODUCTION', '1. Contexte historique', 'Chapitre 2', 'CONCLUSION', 'BIBLIOGRAPHIE', 'Annexe A – Carte des barrages']);
    expect(words(r.content)).not.toMatch(/\.{3}|\t8/);
  });
  it('pasted from Word: fonts, sizes, colors, spacing and alignment make way for the norm', () => {
    const json = JSON.stringify(r.content);
    expect(json).not.toMatch(/textStyle|Calibri|#333333|1\.15|"textAlign":"right"|"spaceAfter"/);
    expect(json).toContain('"bold"');
  });
  it('pasted from Word: no empty lines, no double page breaks, lines cut like in a PDF join again', () => {
    const body = r.content.slice(r.content.findIndex(n => textOf(n) === 'INTRODUCTION'));
    expect(body.some(n => n.type === 'paragraph' && !textOf(n).trim())).toBe(false);
    expect(r.content.some((n, i) => n.type === 'pageBreak' && r.content[i + 1]?.type === 'pageBreak')).toBe(false);
    expect(words(r.content)).toContain('La nationalisation de 1963 a permis de regrouper les producteurs et a transformé la province.');
  });
  it('pasted from Word: references sorted, appendices on a new page', () => {
    const i = r.content.findIndex(n => textOf(n) === 'BIBLIOGRAPHIE');
    expect(r.content.slice(i + 1, i + 3).map(textOf)).toEqual(['Bélanger, M. (2019). Hydro.', 'Whitmore, J. (2024). État.']);
    const a = r.content.findIndex(n => textOf(n).startsWith('Annexe A'));
    expect(r.content[a - 1].type).toBe('pageBreak');
  });
  it('"Seulement l\'apparence" takes away the pasted look and piles of empty lines, keeps every part', () => {
    const l = lookOnly(pasted);
    const json = JSON.stringify(l);
    expect(json).not.toMatch(/textStyle|Calibri|1\.15/);
    expect(l.filter(n => n.type === 'heading').map(textOf)).toEqual(['INTRODUCTION']);
    expect(l.some((n, i) => n.type === 'paragraph' && !textOf(n) && l[i + 1]?.type === 'paragraph' && !textOf(l[i + 1]))).toBe(false);
    expect(words(l)).toContain('Introduction ......... 3');
  });
});

