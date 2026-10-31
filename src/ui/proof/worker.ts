// The spelling engine, off the page's thread: Hunspell (the checker of LibreOffice, Firefox and macOS) built
// for the browser, with one dictionary per language, loaded the first time that language is checked.

// The CommonJS build: its ES build calls a namespace import as a function, which breaks once bundled.
import { loadModule } from 'hunspell-asm/dist/cjs/index.js';
import type { ProofRequest, ProofReply } from './proof';

type Speller = { spell(w: string): boolean; suggest(w: string): string[]; addWord(w: string): void };
let factory: ReturnType<typeof loadModule> | null = null;
const spellers = new Map<string, Promise<Speller>>();

async function speller(lang: string, aff: string, dic: string): Promise<Speller> {
  let s = spellers.get(lang);
  if (!s) {
    s = (async () => {
      factory ??= loadModule();
      const f = await factory;
      const [a, d] = await Promise.all([aff, dic].map(async u => new Uint8Array(await (await fetch(u)).arrayBuffer())));
      return f.create(f.mountBuffer(a, `${lang}.aff`), f.mountBuffer(d, `${lang}.dic`)) as Speller;
    })();
    spellers.set(lang, s);
    s.catch(() => spellers.delete(lang));
  }
  return s;
}

self.onmessage = async (e: MessageEvent<ProofRequest>) => {
  const m = e.data;
  const reply = (r: Omit<ProofReply, 'id'>) => (self as unknown as Worker).postMessage({ id: m.id, ...r });
  try {
    const s = await speller(m.lang, m.aff, m.dic);
    if (m.type === 'check') reply({ bad: m.words.filter(w => !s.spell(w)) });
    else if (m.type === 'suggest') reply({ words: s.suggest(m.word).slice(0, 8) });
    else { for (const w of m.words) s.addWord(w); reply({}); }
  } catch (err) {
    reply({ error: String((err as Error)?.message ?? err) });
  }
};
