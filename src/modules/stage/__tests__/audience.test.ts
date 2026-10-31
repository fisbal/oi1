import { describe, expect, it } from 'vitest';
import { AUDIENCES, adaptDeck, itemLines, linesHtml } from '../audience';
import { THEMES, newDeck, newSlide, retheme, type ShapeItem } from '../../../formats/slides';
import type { AiApi } from '../../../shell/contract';

describe('audience', () => {
  it('offers 20+ audiences, each with a name in every language', () => {
    expect(AUDIENCES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(AUDIENCES.map(a => a.id)).size).toBe(AUDIENCES.length);
    for (const a of AUDIENCES) for (const l of ['en', 'fr', 'es', 'pt', 'de'] as const) expect(a.names[l]).toBeTruthy();
  });

  it('reads bullets with their levels and writes them back as nested lists', () => {
    const html = '<ul><li><p>One</p><ul><li><p>One a</p></li></ul></li><li><p>Two</p></li></ul>';
    const it0 = { kind: 'shape', html } as ShapeItem;
    expect(itemLines(it0)).toEqual(['- One', '  - One a', '- Two']);
    expect(linesHtml(['- One', '  - One a', '- Two'], () => null)).toBe(html);
    expect(linesHtml(['Hello & bye'], l => (l === 0 ? 30 : null))).toBe('<p><span style="font-size: 30pt">Hello &amp; bye</span></p>');
  });

  it('adapts the words, notes, size, theme and animations, and leaves the old deck untouched', async () => {
    const deck = newDeck();
    const s = newSlide('content', deck);
    s.items = s.items.map(it => (it.kind === 'shape' && it.role === 'title' ? { ...it, html: '<p>The solar system</p>' } : it.kind === 'shape' && it.role === 'body' ? { ...it, html: '<ul><li><p>Eight planets orbit the Sun</p></li></ul>' } : it));
    deck.slides = [s];
    const kids = AUDIENCES.find(a => a.id === 'kids')!;
    const other = THEMES.find(th => th.id !== deck.theme.id)!;
    let asked = '';
    const ai = {
      ready: () => true,
      ask: async (req: { system: string; messages: { content: string }[] }) => {
        asked = req.system + req.messages[0].content;
        const title = s.items.findIndex(it => it.kind === 'shape' && it.role === 'title');
        const body = s.items.findIndex(it => it.kind === 'shape' && it.role === 'body');
        return JSON.stringify({ theme: other.id, summary: 'Simpler words.', slides: [{ slide: 1, notes: 'Who knows a planet?', texts: [{ item: title, lines: ['🪐 Our planets'] }, { item: body, lines: ['- 8 planets turn around the Sun'] }] }] });
      },
    } as unknown as AiApi;
    const got = await adaptDeck(ai, deck, kids, THEMES, 'English', retheme);
    expect(asked).toContain('Children aged 6 to 10');
    expect(asked).toContain('The solar system');
    const out = got.deck.slides[0];
    const title = out.items.find(it => it.kind === 'shape' && it.role === 'title') as ShapeItem;
    expect(title.html).toBe('<p><span style="font-size: 50pt">🪐 Our planets</span></p>');
    expect(out.notes).toBe('Who knows a planet?');
    expect(out.anims?.length).toBeGreaterThan(0);
    expect(got.deck.theme.id).toBe(other.id);
    expect(got.summary).toBe('Simpler words.');
    expect((deck.slides[0].items.find(it => it.kind === 'shape' && it.role === 'title') as ShapeItem).html).toBe('<p>The solar system</p>');
  });
});
