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

describe('bestTranslator', () => {
  it('uses the free online translator when the browser has none (phones), the AI only for what it cannot do', async () => {
    const real = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (async (u: string) => {
      urls.push(u);
      const q = new URL(u).searchParams.get('q')!;
      if (q === 'Échec') return new Response(JSON.stringify({ responseStatus: 429, responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS' } }));
      return new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: `ON ${q}` } }));
    }) as typeof fetch;
    try {
      const { bestTranslator } = await import('../translate');
      const asked: string[][] = [];
      const tr = await bestTranslator('en', 'fr', () => async t => { asked.push(t); return t.map(s => `AI ${s}`); });
      expect(await tr([' Bonjour ', '12', 'Échec', 'Merci'])).toEqual([' ON Bonjour ', '12', 'AI Échec', 'AI Merci']);
      expect(asked).toEqual([['Échec', 'Merci']]);
      expect(urls[0]).toContain('langpair=fr%7Cen');
    } finally { globalThis.fetch = real; }
  });
  it('cuts a long paragraph at sentence ends for the online translator', async () => {
    const real = globalThis.fetch;
    const sent: string[] = [];
    globalThis.fetch = (async (u: string) => { const q = new URL(u).searchParams.get('q')!; sent.push(q); return new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: q.toUpperCase() } })); }) as typeof fetch;
    try {
      const { onlineTranslator } = await import('../translate');
      const long = Array.from({ length: 30 }, (_, i) => `Phrase numéro ${i} du paragraphe.`).join(' ');
      const { out, failed } = await onlineTranslator('en', 'fr')([long]);
      expect(failed).toEqual([]);
      expect(sent.length).toBeGreaterThan(1);
      expect(sent.every(q => q.length <= 450)).toBe(true);
      expect(out[0]).toBe(long.toUpperCase());
    } finally { globalThis.fetch = real; }
  });
  it('uses the copilot AI when nothing else can translate (same language guess)', async () => {
    const { bestTranslator } = await import('../translate');
    const tr = await bestTranslator('en', '', () => async t => t.map(s => `AI ${s}`));
    expect(await tr(['Bonjour'])).toEqual(['AI Bonjour']);
  });
  it("uses Chrome's translator for the whole document's language, the AI only for what it fails on", async () => {
    const g = globalThis as Record<string, unknown>;
    g.Translator = {
      availability: async () => 'available',
      create: async () => ({ translate: async (s: string) => { if (s === 'Échec') throw new Error('no'); return `CH ${s}`; } }),
    };
    try {
      const { bestTranslator } = await import('../translate');
      const asked: string[][] = [];
      const tr = await bestTranslator('en', 'fr', () => async t => { asked.push(t); return t.map(s => `AI ${s}`); });
      expect(await tr([' Bonjour ', 'Échec', '12'])).toEqual([' CH Bonjour ', 'AI Échec', '12']);
      expect(asked).toEqual([['Échec']]);
    } finally { delete g.Translator; }
  });
});

describe('translateFromOriginal (rule 13: the original is always kept)', () => {
  // A tiny document: a list of texts. The "translator" changes words in a lossy way, like a real one can.
  function makeDoc(texts: string[]) {
    let cur = [...texts];
    const doc = {
      snapshot: () => [...cur],
      words: (b: unknown) => b as string[],
      apply: async (b: unknown, tr: ((t: string[]) => Promise<string[]>) | null) => { const base = b as string[]; cur = tr ? await tr(base) : [...base]; return base.length; },
      get: () => cur,
      edit: (i: number, v: string) => { cur[i] = v; },
    };
    return doc;
  }
  const lossy = (to: string) => async (from: string) => async (t: string[]) => t.map(s => `${to}<${from}>(${s})`);

  it('translates every time from the original and gives the exact original back', async () => {
    localStorage.clear();
    const { translateFromOriginal, originalOf } = await import('../translate');
    const doc = makeDoc(['Holy Father,', 'Your Name is holy.']);
    await translateFromOriginal('t1', doc, 'fr', 'en', lossy('fr'));
    expect(doc.get()).toEqual(['fr<en>(Holy Father,)', 'fr<en>(Your Name is holy.)']);
    await translateFromOriginal('t1', doc, 'de', 'fr', lossy('de'));
    // From the original English, never from the French.
    expect(doc.get()).toEqual(['de<en>(Holy Father,)', 'de<en>(Your Name is holy.)']);
    const back = await translateFromOriginal('t1', doc, 'en', 'de', lossy('en'));
    expect(back.restored).toBe(true);
    expect(doc.get()).toEqual(['Holy Father,', 'Your Name is holy.']);
    expect(originalOf('t1')?.lang).toBe('en');
  });

  it('keeps the first original for reference after the person edits a translation', async () => {
    localStorage.clear();
    const { translateFromOriginal, restoreOriginal } = await import('../translate');
    const doc = makeDoc(['Bonjour']);
    await translateFromOriginal('t2', doc, 'en', 'fr', lossy('en'));
    doc.edit(0, 'Hello friend');
    await translateFromOriginal('t2', doc, 'es', 'en', lossy('es'));
    expect(doc.get()).toEqual(['es<en>(Hello friend)']);
    expect(await restoreOriginal('t2', doc)).toBe(true);
    expect(doc.get()).toEqual(['Bonjour']);
    // Still known as French: asking for French changes nothing, English is made from it again.
    expect((await translateFromOriginal('t2', doc, 'fr', 'en', lossy('fr'))).restored).toBe(true);
    await translateFromOriginal('t2', doc, 'en', 'fr', lossy('en'));
    expect(doc.get()).toEqual(['en<fr>(Bonjour)']);
  });
});
