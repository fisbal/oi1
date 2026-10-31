import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { letterExtensions } from '../setup';
import {
  CAPTION_LABELS, CITATION_STYLE_IDS, SAMPLE_SOURCES, SOURCE_KINDS, apaEdition, bibliographyJson, captionJson, captionsIn, citedSources, entry, inTextCitation, indexEntries,
  indexJson, missingFields, parseSource, patternSource, people, refTargets, refText, restyleCitations, updateSource, type Source,
} from '../references';

const book: Source = { id: 'a', kind: 'book', authors: 'Dupont, Marie; Martin, Paul', title: 'Le droit des lettres', year: '2020', publisher: 'Dalloz', place: 'Paris' };
const article: Source = { id: 'b', kind: 'article', authors: 'LeCun, Yann; Bengio, Yoshua; Hinton, Geoffrey', title: 'Deep learning', year: '2015', container: 'Nature', volume: '521', issue: '7553', pages: '436-444', doi: '10.1038/nature14539' };
const text = (segs: { text: string }[]) => segs.map(s => s.text).join('');
const editor = (html = '<p>Texte.</p>') => new Editor({ extensions: letterExtensions('body'), content: html });

describe('citations', () => {
  it('has more than 20 styles and 20 caption labels', () => {
    expect(CITATION_STYLE_IDS.length).toBeGreaterThanOrEqual(20);
    expect(CAPTION_LABELS.length).toBeGreaterThanOrEqual(20);
  });
  it('reads names written either way', () => {
    expect(people('Dupont, Marie; Paul Martin')).toEqual([{ last: 'Dupont', first: 'Marie' }, { last: 'Martin', first: 'Paul' }]);
  });
  it('cites in the text like each style', () => {
    expect(inTextCitation(book, 'apa', 1)).toBe('(Dupont & Martin, 2020)');
    expect(inTextCitation(article, 'apa', 1)).toBe('(LeCun et al., 2015)');
    expect(inTextCitation(book, 'chicagoAD', 1)).toBe('(Dupont and Martin 2020)');
    expect(inTextCitation(book, 'ieee', 3)).toBe('[3]');
    expect(inTextCitation(book, 'vancouver', 2)).toBe('(2)');
    expect(inTextCitation(book, 'nature', 12)).toBe('¹²');
  });
  it('writes full entries', () => {
    // APA 7 drops the place of publication.
    expect(text(entry(book, 'apa'))).toBe('Dupont, M., & Martin, P. (2020). Le droit des lettres. Dalloz.');
    const apa = entry(article, 'apa');
    expect(text(apa)).toBe('LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436–444. https://doi.org/10.1038/nature14539');
    expect(apa.find(s => s.text === 'Nature')?.italic).toBe(true);
    expect(apa.find(s => s.text === '521')?.italic).toBe(true);
    expect(text(entry(article, 'ieee'))).toContain('Y. LeCun, Y. Bengio, and G. Hinton. “Deep learning.” Nature');
    expect(text(entry(book, 'iso690'))).toContain('DUPONT, Marie and MARTIN, Paul. 2020.');
    for (const st of CITATION_STYLE_IDS) expect(text(entry(article, st)), st).toContain('Deep learning');
  });
  it('keeps sources in the letter, restyles them and builds the bibliography', () => {
    const e = editor();
    e.commands.setTextSelection(e.state.doc.content.size - 1);
    e.commands.insertCitation(book, 'apa');
    e.commands.insertCitation(article, 'apa');
    expect(e.getText()).toContain('(Dupont & Martin, 2020)');
    expect(citedSources(e.state.doc).map(s => s.id)).toEqual(['a', 'b']);
    // The source survives saving to HTML and opening again.
    const again = editor(e.getHTML());
    expect(citedSources(again.state.doc)[1].doi).toBe('10.1038/nature14539');
    expect(restyleCitations(e, 'ieee')).toBe(2);
    expect(e.getText()).toContain('[1]');
    expect(e.getText()).toContain('[2]');
    const bib = bibliographyJson(citedSources(e.state.doc), 'apa', 'Références');
    expect(bib[1].attrs).toMatchObject({ indentLeft: 36, indentFirst: -36, lineHeight: '2' });
    expect(bib[0].content?.[0].text).toBe('Références');
    expect(bib).toHaveLength(4);
    e.destroy(); again.destroy();
  });
  it('turns Claude’s answer into a source', () => {
    const s = parseSource('Here: {"kind":"article","authors":"Doe, Jane","title":"A study","year":"2021","container":"Science"}', 'x');
    expect(s).toMatchObject({ id: 'x', kind: 'article', title: 'A study', container: 'Science' });
    expect(parseSource('no json', 'x')).toBeNull();
    expect(parseSource('{"title":""}', 'x')).toBeNull();
  });
});

describe('captions, index and cross-references', () => {
  it('numbers captions by label', () => {
    const e = editor();
    e.commands.insertContentAt(e.state.doc.content.size, captionJson(e.state.doc, 'figure', 'Carte', true));
    e.commands.insertContentAt(e.state.doc.content.size, captionJson(e.state.doc, 'figure', 'Plan', true));
    e.commands.insertContentAt(e.state.doc.content.size, captionJson(e.state.doc, 'table', '', true));
    const caps = captionsIn(e.state.doc);
    expect(caps.map(c => `${c.label} ${c.n}`)).toEqual(['Figure 1', 'Figure 2', 'Table 1']);
    expect(refTargets(e.state.doc).filter(r => r.kind === 'caption').map(r => r.text)).toEqual(['Figure 1', 'Figure 2', 'Table 1']);
    e.destroy();
  });
  it('builds an alphabetical index from marked words', () => {
    const e = editor('<p>Zèbre et abeille et Éléphant.</p>');
    for (const w of ['Zèbre', 'abeille', 'Éléphant']) {
      const from = e.getText().indexOf(w) + 1;
      e.commands.setTextSelection({ from, to: from + w.length });
      e.commands.markIndexTerm();
    }
    const entries = indexEntries(e.state.doc, () => 2);
    expect(entries.map(x => x.term)).toEqual(['abeille', 'Éléphant', 'Zèbre']);
    expect(entries[0].pages).toEqual([2]);
    expect(indexJson(entries, 'Index').map(n => n.content?.[0]?.text).filter(Boolean)).toEqual(['Index', 'A', 'abeille, 2', 'E', 'Éléphant, 2', 'Z', 'Zèbre, 2']);
    e.destroy();
  });
  it('words cross-references', () => {
    const target = { kind: 'caption' as const, text: 'Figure 2', pos: 10 };
    expect(refText(target, 'text', 4, 50)).toBe('Figure 2');
    expect(refText(target, 'textPage', 4, 50)).toBe('Figure 2, page 4');
    expect(refText(target, 'above', 4, 50)).toBe('Figure 2 above');
    expect(refText(target, 'see', 4, 50)).toBe('see Figure 2, page 4');
  });
});

describe('entries without every detail', () => {
  it('leaves no stray commas', () => {
    const bare: Source = { id: 'c', kind: 'book', authors: 'Dupont, Marie', title: 'Le droit', year: '2020' };
    for (const st of CITATION_STYLE_IDS) expect(text(entry(bare, st)), st).not.toMatch(/\.\s*,|,\s*,|,\s*\./);
  });
});

describe('APA 7 in French', () => {
  const fr = (src: Source) => text(entry(src, 'apaFr'));
  it('uses et, Dans, dir., p., s. d. and éd.', () => {
    expect(fr(SAMPLE_SOURCES.book)).toBe('Ferris, M. C., Mangasarian, O. L., et Wright, S. J. (2008). Linear programming with MATLAB (2e éd.). Society for Industrial and Applied Mathematics.');
    expect(fr(SAMPLE_SOURCES.article)).toBe('Baron, R. A., et Tang, J. (2011). The role of entrepreneurs in firm-level innovation: Joint effects of positive affect, creativity, and environmental dynamism. Journal of Business Venturing, 26(1), 49-60. https://doi.org/10.1016/j.jbusvent.2009.06.002');
    expect(fr(SAMPLE_SOURCES.chapter)).toBe('Harel-Giasson, F. (1990). Femmes gestionnaires : ont-elles réussi? Dans J.-F. Chanlat (dir.), L’individu dans l’organisation : les dimensions oubliées (p. 407-416). Presses de l’Université Laval.');
    expect(fr(SAMPLE_SOURCES.thesis)).toContain('[Mémoire de maîtrise, Université de Montréal]. Papyrus.');
    expect(fr(SAMPLE_SOURCES.web)).toBe('Organisation mondiale de la Santé. (2023, 12 octobre). Changement climatique et santé. OMS. https://www.who.int/fr/news-room/fact-sheets/detail/climate-change-and-health');
    expect(fr({ id: 'n', kind: 'web', authors: '{Ville de Québec}', title: 'Collecte', year: '', container: 'Québec.ca', url: 'https://quebec.ca', accessed: '3 mai 2025' }))
      .toBe('Ville de Québec. (s. d.). Collecte. Québec.ca. Consulté le 3 mai 2025, à https://quebec.ca');
    expect(text(entry(SAMPLE_SOURCES.chapter, 'apa'))).toContain('In J.-F. Chanlat (Ed.), ');
    expect(text(entry(SAMPLE_SOURCES.chapter, 'apa'))).toContain('(pp. 407–416)');
    expect(inTextCitation(SAMPLE_SOURCES.article, 'apaFr', 1)).toBe('(Baron et Tang, 2011)');
    expect(apaEdition('3', false)).toBe('3rd ed.');
    expect(apaEdition('1', true)).toBe('1re éd.');
  });
  it('shows a pattern and an example for every type in every style', () => {
    for (const st of CITATION_STYLE_IDS) for (const k of SOURCE_KINDS) {
      expect(text(entry(patternSource(k, true), st)).length, `${st} ${k}`).toBeGreaterThan(10);
      expect(text(entry(SAMPLE_SOURCES[k], st)), `${st} ${k}`).not.toMatch(/ {2}|\.\.|undefined/);
    }
    expect(CITATION_STYLE_IDS.length * SOURCE_KINDS.length).toBeGreaterThanOrEqual(20);
    expect(text(entry(patternSource('book', true), 'apaFr'))).toBe('Auteur, A. A. (Année). Titre du livre : Sous-titre (X e éd.). Éditeur.');
  });
  it('sorts by family name and finds what is missing', () => {
    const bib = bibliographyJson([SAMPLE_SOURCES.web, SAMPLE_SOURCES.article, SAMPLE_SOURCES.chapter], 'apaFr', 'Références');
    expect(bib.slice(1, 4).map(p => p.content?.map(c => c.text).join('').slice(0, 5))).toEqual(['Baron', 'Harel', 'Organ']);
    expect(missingFields({ id: 'm', kind: 'article', authors: 'Doe, J.', title: 'X', year: '2020' }, 'apaFr')).toEqual(['container', 'volume', 'pages', 'doi']);
    expect(missingFields(SAMPLE_SOURCES.chapter, 'apaFr')).toEqual([]);
  });
  it('completes a source in every citation', () => {
    const e = editor();
    e.commands.setTextSelection(e.state.doc.content.size - 1);
    const thin: Source = { id: 'z', kind: 'book', authors: 'Roy, Ana', title: 'Livre', year: '' };
    e.commands.insertCitation(thin, 'apaFr');
    e.commands.insertCitation(thin, 'apaFr');
    expect(e.getText()).toContain('(Roy, s. d.)');
    expect(updateSource(e, { ...thin, year: '2022', publisher: 'Boréal' }, 'apaFr')).toBe(2);
    expect(e.getText()).toContain('(Roy, 2022)');
    expect(citedSources(e.state.doc)[0].publisher).toBe('Boréal');
    e.destroy();
  });
});
