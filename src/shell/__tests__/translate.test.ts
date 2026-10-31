import { describe, expect, it } from 'vitest';
import type { AiApi } from '../contract';
import { aiTranslator, translateHtml } from '../translate';

function fakeAi(calls: string[][], bad = false): AiApi {
  return {
    ask: async ({ messages }: { messages: { content: string }[] }) => {
      const items = (JSON.parse(messages[0].content) as { items: string[] }).items;
      calls.push(items);
      return JSON.stringify({ items: bad ? items.slice(1) : items.map(s => `EN ${s}`) });
    },
  } as unknown as AiApi;
}

describe('aiTranslator', () => {
  it('keeps spaces, skips numbers and asks once per unique text', async () => {
    const calls: string[][] = [];
    const out = await aiTranslator(fakeAi(calls), 'en')([' Bonjour ', '12,50', 'Bonjour', 'Merci']);
    expect(out).toEqual([' EN Bonjour ', '12,50', 'EN Bonjour', 'EN Merci']);
    expect(calls).toEqual([['Bonjour', 'Merci']]);
  });
  it('splits long lists into batches of 40', async () => {
    const calls: string[][] = [];
    await aiTranslator(fakeAi(calls), 'en')(Array.from({ length: 90 }, (_, i) => `mot${i}`));
    expect(calls.map(c => c.length)).toEqual([40, 40, 10]);
  });
  it('leaves a batch alone when the answer does not fit', async () => {
    const out = await aiTranslator(fakeAi([], true), 'en')(['Bonjour', 'Merci']);
    expect(out).toEqual(['Bonjour', 'Merci']);
  });
});

describe('translateHtml', () => {
  it('changes words only and keeps the markup', async () => {
    const [html] = await translateHtml(['<p><b>Bonjour</b> <a href="x">le monde</a> 42</p>'], async t => t.map(s => s.toUpperCase()));
    expect(html).toBe('<p><b>BONJOUR</b> <a href="x">LE MONDE</a> 42</p>');
  });
});
