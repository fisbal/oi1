import { describe, expect, it } from 'vitest';
import { findDoi, findIsbn, fromCrossref, lookupSource } from '../lookup';
import { entry } from '../references';

// Shapes as Crossref, Open Library and Google Books answer them (trimmed).
const CROSSREF = { status: 'ok', message: {
  DOI: '10.1016/j.jbusvent.2009.06.002', type: 'journal-article',
  title: ['The role of entrepreneurs in firm-level innovation: Joint effects of positive affect, creativity, and environmental dynamism'],
  author: [{ given: 'Robert A.', family: 'Baron' }, { given: 'Jintong', family: 'Tang' }],
  'container-title': ['Journal of Business Venturing'], volume: '26', issue: '1', page: '49-60',
  issued: { 'date-parts': [[2011, 1]] }, publisher: 'Elsevier BV',
} };
const OL = { 'ISBN:9780262033848': { title: 'Introduction to Algorithms', authors: [{ name: 'Thomas H. Cormen' }, { name: 'Charles E. Leiserson' }], publishers: [{ name: 'MIT Press' }], publish_places: [{ name: 'Cambridge, Mass' }], publish_date: '2009' } };
const GB = { items: [{ volumeInfo: { title: 'L’étranger', authors: ['Albert Camus'], publisher: 'Gallimard', publishedDate: '1971-01-01' } }] };
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('a source from its DOI or ISBN (no AI)', () => {
  it('finds a DOI in a link and checks ISBN digits', () => {
    expect(findDoi('https://doi.org/10.1016/j.jbusvent.2009.06.002.')).toBe('10.1016/j.jbusvent.2009.06.002');
    expect(findIsbn('ISBN 978-0-262-03384-8')).toBe('9780262033848');
    expect(findIsbn('ISBN 2-07-036002-4')).toBe('2070360024');
    expect(findIsbn('978-0-262-03384-9')).toBeNull(); // wrong check digit
  });
  it('fills an article from Crossref, ready for APA', async () => {
    const r = await lookupSource('10.1016/j.jbusvent.2009.06.002', 's1', (url => { expect(String(url)).toContain('api.crossref.org/works/'); return reply(CROSSREF); }) as typeof fetch);
    expect('source' in r && r.source).toMatchObject({ kind: 'article', authors: 'Baron, Robert A.; Tang, Jintong', year: '2011', container: 'Journal of Business Venturing', volume: '26', issue: '1', pages: '49-60' });
    if ('source' in r) expect(entry(r.source, 'apa').map(x => x.text).join('')).toContain('Baron, R. A., & Tang, J. (2011).');
  });
  it('fills a book from Open Library, then Google Books when Open Library does not know it', async () => {
    const ol = await lookupSource('ISBN 978-0-262-03384-8', 's2', (() => reply(OL)) as typeof fetch);
    expect('source' in ol && ol.source).toMatchObject({ kind: 'book', authors: 'Cormen, Thomas H.; Leiserson, Charles E.', year: '2009', publisher: 'MIT Press' });
    const gb = await lookupSource('2-07-036002-4', 's3', (url => (String(url).includes('openlibrary') ? reply({}) : reply(GB))) as typeof fetch);
    expect('source' in gb && gb.source).toMatchObject({ authors: 'Camus, Albert', year: '1971', publisher: 'Gallimard' });
  });
  it('says when nothing is found, when there is no Internet, and lets AI read anything else', async () => {
    expect(await lookupSource('10.9999/none', 's', (() => reply({}, 404)) as typeof fetch)).toEqual({ error: 'notFound' });
    expect(await lookupSource('10.9999/none', 's', (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch)).toEqual({ error: 'offline' });
    expect(await lookupSource('Le Petit Prince, Saint-Exupéry', 's')).toEqual({ error: 'none' });
    expect(fromCrossref({ type: 'journal-article' }, 'x')).toBeNull();
  });
});
