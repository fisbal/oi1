import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { readDocx } from '../docx/read';
import { letterToDocx } from '../docx/write';
import { defaultStyles, type LetterDoc } from '../model';
import { TOC_MARK, WORK_LAYOUTS, reorganizeDoc, workDoc, workMargins, workStyles } from '../templates/works';
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
});
