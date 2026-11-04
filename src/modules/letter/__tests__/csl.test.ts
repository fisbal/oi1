import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { htmlSegs, loadStyle, makeEngine, searchStyles, styleName, toCslItem } from '../csl';
import type { Source } from '../references';

const fx = (f: string) => readFileSync(`${process.cwd()}/src/modules/letter/__tests__/fixtures/${f}`, 'utf8');
const SOURCES: Source[] = [
  { id: 'a', kind: 'article', authors: 'Baron, Robert A.; Tang, Jintong', title: 'The role of entrepreneurs in firm-level innovation', year: '2011', container: 'Journal of Business Venturing', volume: '26', issue: '1', pages: '49-60' },
  { id: 'b', kind: 'book', authors: 'Maslow, Abraham H.', title: 'Motivation and personality', year: '1954', publisher: 'Harper' },
  { id: 'c', kind: 'web', authors: '{Statistique Canada}', title: 'Le télétravail au Canada', year: '' },
];

describe('CSL styles (Citation Style Language, run by citeproc-js)', () => {
  it('turns our sources into CSL items', () => {
    expect(toCslItem(SOURCES[0])).toMatchObject({ type: 'article-journal', author: [{ family: 'Baron', given: 'Robert A.' }, { family: 'Tang', given: 'Jintong' }], issued: { 'date-parts': [[2011]] }, 'container-title': 'Journal of Business Venturing', page: '49-60' });
    expect(toCslItem(SOURCES[2])).toMatchObject({ type: 'webpage', author: [{ literal: 'Statistique Canada' }] });
    expect(toCslItem(SOURCES[2]).issued).toBeUndefined();
  });
  it('cites and lists in an author-date style, with the French words of the locale', async () => {
    const run = await makeEngine(fx('csl-author-date.csl'), fx('csl-locale-fr.xml'), SOURCES);
    expect(run.cite('a')).toBe('(Baron & Tang, 2011)');
    expect(run.cite('c')).toBe('(Statistique Canada, s. d.)');
    const bib = run.bibliography();
    expect(bib.hanging).toBe(true);
    const lines = bib.entries.map(e => e.map(s => s.text).join(''));
    expect(lines[0]).toMatch(/^Baron, R\. A\., & Tang, J\. \(2011\)\. The role/);
    expect(lines[1]).toMatch(/^Maslow, A\. H\. \(1954\)/);
    expect(lines[2]).toMatch(/^Statistique Canada.*s\. d\./);
    expect(bib.entries[0].some(s => s.italic && s.text.includes('Journal of Business Venturing'))).toBe(true);
  });
  it('numbers in the order of first citation in a numeric style', async () => {
    const run = await makeEngine(fx('csl-numeric.csl'), fx('csl-locale-fr.xml'), [SOURCES[1], SOURCES[0]]);
    expect(run.cite('b')).toBe('[1]');
    expect(run.cite('a')).toBe('[2]');
    expect(run.bibliography().entries[0].map(s => s.text).join('')).toContain('[1]');
  });
  it('finds styles by name, main styles first, and follows a journal to its parent style', async () => {
    const list = ['apa', 'apa-6th-edition', 'dependent/journal-of-business-venturing', 'ieee', 'chicago-author-date', 'universite-laval-departement-des-sciences-historiques'].map(id => ({ id, name: styleName(id) }));
    expect(searchStyles(list, 'apa')[0].id).toBe('apa');
    expect(searchStyles(list, 'laval')[0].name).toBe('Universite Laval Departement Des Sciences Historiques');
    const get = ((url: string) => Promise.resolve(new Response(url.includes('dependent/')
      ? '<style><info><link href="http://www.zotero.org/styles/apa" rel="independent-parent"/></info></style>'
      : fx('csl-author-date.csl')))) as unknown as typeof fetch;
    expect(await loadStyle('dependent/journal-of-business-venturing', get)).toContain('Test author-date');
  });
  it('reads citeproc HTML as pieces of text', () => {
    expect(htmlSegs('<div class="csl-entry">Smith, J. (2020). <i>A book &#38; more</i>. Press.</div>')).toEqual([
      { text: 'Smith, J. (2020). ' }, { text: 'A book & more', italic: true }, { text: '. Press.' }]);
  });
});
