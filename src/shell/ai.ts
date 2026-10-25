// Claude in every OI1 app: the copilot's connection to the Claude API.
// The user brings their own API key. It is kept on this device only (localStorage), sent only to
// api.anthropic.com, and never written into a file, the repo or an autosave. A small proxy can replace
// the key later (see docs/copilot.md) without changing any app: they all go through shell.ai.

import type { AiApi, AiRequest } from './contract';
import { store } from './storage';

export const AI_MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5' },
] as const;
export type AiModel = (typeof AI_MODELS)[number]['id'];

const KEY = 'ai:key';
const MODEL = 'ai:model';
const listeners = new Set<() => void>();

export const aiSettings = {
  key: () => store.get(KEY) ?? '',
  model: (): AiModel => {
    const m = store.get(MODEL);
    return AI_MODELS.some(x => x.id === m) ? (m as AiModel) : 'claude-opus-5-5';
  },
  set(key: string, model: AiModel) {
    store.set(KEY, key.trim());
    store.set(MODEL, model);
    listeners.forEach(fn => fn());
  },
  forget() {
    store.set(KEY, '');
    listeners.forEach(fn => fn());
  },
  onChange(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};

/** Why a request did not give an answer, in words the copilot shows. */
export class AiError extends Error {
  constructor(public kind: 'key' | 'limit' | 'network' | 'refusal' | 'other', message: string) { super(message); }
}

async function ask(req: AiRequest): Promise<string> {
  const apiKey = aiSettings.key();
  if (!apiKey) throw new AiError('key', 'No API key');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // The key is the user's own and stays in their browser, so calling the API from the page is what we want here.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const stream = client.beta.messages.stream({
      model: aiSettings.model(),
      max_tokens: 16000,
      system: req.system,
      messages: req.messages,
      output_config: { effort: req.effort ?? 'medium', ...(req.schema ? { format: { type: 'json_schema' as const, schema: req.schema } } : {}) },
      // If a safety check declines, the API retries on a fitting model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    }, { signal: req.signal });
    let text = '';
    stream.on('text', delta => { text += delta; req.onText?.(text); });
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new AiError('refusal', 'Declined');
    return final.content.map(b => (b.type === 'text' ? b.text : '')).join('');
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.APIUserAbortError) throw err;
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new AiError('key', String((err as Error).message));
    if (err instanceof Anthropic.RateLimitError) throw new AiError('limit', String((err as Error).message));
    if (err instanceof Anthropic.APIConnectionError) throw new AiError('network', String((err as Error).message));
    throw new AiError('other', String((err as Error)?.message ?? err));
  }
}

export const ai: AiApi = { ready: () => !!aiSettings.key(), ask };
