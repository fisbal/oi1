import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { letterExtensions } from '../setup';
import {
  CAPTION_LABELS, CITATION_STYLE_IDS, bibliographyJson, captionJson, captionsIn, citedSources, entry, inTextCitation, indexEntries,
  indexJson, parseSource, people, refTargets, refText, restyleCitations, type Source,
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
    expect(text(entry(book, 'apa'))).toBe('Dupont, M., & Martin, P. (2020). Le droit des lettres. Paris: Dalloz.');
    const apa = entry(article, 'apa');
    expect(text(apa)).toContain('LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), pp. 436-444. https://doi.org/10.1038/nature14539');
    expect(apa.find(s => s.text === 'Nature')?.italic).toBe(true);
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
