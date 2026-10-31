import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiFor } from '../ai';
import { webWait } from '../webAi';
import { PROVIDERS, aiChoice, setProviderKey } from '../providers';

/** A server-sent event stream made of `events`. */
const stream = (events: string[]) => new Response(new ReadableStream({
  start(c) { for (const e of events) c.enqueue(new TextEncoder().encode(`data: ${e}\n\n`)); c.close(); },
}), { status: 200 });

describe('copilot providers', () => {
  beforeEach(() => { localStorage.clear(); aiChoice.set({ main: 'claude', byApp: {}, models: {}, azure: { endpoint: '', deployment: '' } }); });
  afterEach(() => vi.restoreAllMocks());

  it('offers at least 20 AIs, Claude first', () => {
    expect(PROVIDERS.length).toBeGreaterThanOrEqual(20);
    expect(PROVIDERS[0].id).toBe('free-claude'); // still listed, no longer the default
    expect(PROVIDERS.filter(p => p.kind === 'puter').length).toBeGreaterThanOrEqual(20);
    expect(PROVIDERS.filter(p => p.kind === 'web').length).toBeGreaterThanOrEqual(20);
    for (const id of ['openai', 'gemini', 'azure', 'github', 'mistral', 'deepseek', 'ollama']) expect(PROVIDERS.some(p => p.id === id)).toBe(true);
  });

  it('uses the AI chosen for every app, or the one chosen for an app', () => {
    aiChoice.set({ main: 'openai', byApp: { stage: 'gemini' } });
    expect(aiFor('letter').provider?.().id).toBe('openai');
    expect(aiFor('stage').provider?.().id).toBe('gemini');
    expect(aiFor('letter').ready()).toBe(false);
    setProviderKey('openai', 'sk-test');
    expect(aiFor('letter').ready()).toBe(true);
    aiChoice.set({ main: 'ollama' });
    expect(aiFor('class').ready()).toBe(true); // runs on this computer: no key
  });

  it('streams a ChatGPT answer with the key and the chosen model', async () => {
    aiChoice.set({ main: 'openai', models: { openai: 'gpt-test' } });
    setProviderKey('openai', 'sk-test');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(stream([
      JSON.stringify({ choices: [{ delta: { content: 'Bon' } }] }), JSON.stringify({ choices: [{ delta: { content: 'jour' } }] }), '[DONE]',
    ]));
    const seen: string[] = [];
    const text = await aiFor('letter').ask({ system: 'Be brief', messages: [{ role: 'user', content: 'Hi' }], onText: s => seen.push(s) });
    expect(text).toBe('Bonjour');
    expect(seen).toEqual(['Bon', 'Bonjour']);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('gpt-test');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'Be brief' });
  });

  it('asks Gemini in its own format and gets JSON back for apps', async () => {
    aiChoice.set({ main: 'gemini' });
    setProviderKey('gemini', 'AIza-test');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(stream([
      JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":' }] } }] }), JSON.stringify({ candidates: [{ content: { parts: [{ text: 'true}' }] } }] }),
    ]));
    const text = await aiFor().ask({ system: 'S', messages: [{ role: 'user', content: 'Q' }, { role: 'assistant', content: 'A' }, { role: 'user', content: 'Q2' }], schema: { type: 'object' } });
    expect(JSON.parse(text)).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=AIza-test');
    const body = JSON.parse(String(init.body));
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('calls Microsoft Azure OpenAI at the resource and deployment given', async () => {
    aiChoice.set({ main: 'azure', azure: { endpoint: 'https://res.openai.azure.com/', deployment: 'gpt4o' } });
    setProviderKey('azure', 'az-key');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(stream([JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })]));
    expect(await aiFor().ask({ system: 'S', messages: [{ role: 'user', content: 'Q' }] })).toBe('ok');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://res.openai.azure.com/openai/deployments/gpt4o/chat/completions?api-version=2024-10-21');
    expect((init.headers as Record<string, string>)['api-key']).toBe('az-key');
  });

  it('says when the key is wrong or the limit is reached', async () => {
    aiChoice.set({ main: 'mistral' });
    setProviderKey('mistral', 'bad');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 401 }));
    await expect(aiFor().ask({ system: 'S', messages: [{ role: 'user', content: 'Q' }] })).rejects.toMatchObject({ kind: 'key' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('slow down', { status: 429 }));
    await expect(aiFor().ask({ system: 'S', messages: [{ role: 'user', content: 'Q' }] })).rejects.toMatchObject({ kind: 'limit' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(aiFor().ask({ system: 'S', messages: [{ role: 'user', content: 'Q' }] })).rejects.toMatchObject({ kind: 'network' });
  });

  it('works without a key: the public site opens with the request, and the pasted answer comes back', async () => {
    aiChoice.set({ main: 'web-chatgpt' });
    expect(aiFor('letter').ready()).toBe(true);
    const opened: string[] = [];
    vi.spyOn(window, 'open').mockImplementation(((url: string) => { opened.push(url); return null; }) as typeof window.open);
    const answer = aiFor('letter').ask({ system: 'Be brief', messages: [{ role: 'user', content: 'Hi' }], schema: { type: 'object' } });
    expect(opened[0]).toMatch(/^https:\/\/chatgpt\.com\/\?q=Be%20brief/);
    expect(webWait()?.site).toBe('ChatGPT');
    webWait()!.answer('Here it is:\n```json\n{"ok": true}\n```');
    expect(JSON.parse(await answer)).toEqual({ ok: true });
    expect(webWait()).toBeNull();
  });

  it('starts with no key and no account (Claude.ai), unless a Claude key was given before', async () => {
    localStorage.clear();
    vi.resetModules();
    expect((await import('../providers')).aiChoice.get().main).toBe('web-claude');
    localStorage.setItem('oi1:ai:key', 'sk-ant-x');
    vi.resetModules();
    expect((await import('../providers')).aiChoice.get().main).toBe('claude');
  });

  it('moves old settings with Puter as the default to the no-account default, once', async () => {
    localStorage.clear();
    localStorage.setItem('oi1.ai.providers', JSON.stringify({ main: 'free-claude', byApp: { stage: 'free-claude', class: 'gemini' } }));
    vi.resetModules();
    const { aiChoice } = await import('../providers');
    expect(aiChoice.get().main).toBe('web-claude');
    expect(aiChoice.get().byApp).toEqual({ class: 'gemini' });
    aiChoice.set({ main: 'free-claude' }); // chosen on purpose afterwards: kept
    vi.resetModules();
    expect((await import('../providers')).aiChoice.get().main).toBe('free-claude');
  });

  it('answers for free through Puter, with no key, streaming into the app', async () => {
    aiChoice.set({ main: 'free-gemini' });
    expect(aiFor('stage').ready()).toBe(true);
    const asked: { prompt: unknown; model?: string }[] = [];
    (globalThis as { puter?: unknown }).puter = {
      auth: { isSignedIn: () => true, signIn: async () => {}, signOut: () => {}, getUser: async () => ({ username: 'martin' }) },
      ai: { chat: async (prompt: unknown, o: { model?: string }) => { asked.push({ prompt, model: o.model }); return (async function* () { yield { text: 'Bon' }; yield { text: 'jour' }; })(); } },
    };
    const seen: string[] = [];
    expect(await aiFor('stage').ask({ system: 'S', messages: [{ role: 'user', content: 'Q' }], onText: s => seen.push(s) })).toBe('Bonjour');
    expect(seen).toEqual(['Bon', 'Bonjour']);
    expect(asked[0].model).toBe('gemini-2.5-flash');
    expect(String(asked[0].prompt)).toContain('Q');
    delete (globalThis as { puter?: unknown }).puter;
  });
});
