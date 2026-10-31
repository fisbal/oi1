// The copilot's AI, chosen by each person (Martin, 2026-10-31: "que chacun puisse choisir son copilot"): Claude by
// default, or ChatGPT, Gemini, Microsoft (Azure OpenAI or GitHub Models), Mistral, DeepSeek, a model on this computer
// (Ollama, LM Studio) and more. Each one uses the person's own key, kept on this device only and sent only to that
// provider. One AI for every app, or a different one for an app. Office Code+'s Master corrector uses the same keys.

import type { AiRequest } from './contract';
import { browserAiHere } from './webAi';

export type ProviderKind = 'anthropic' | 'openai' | 'gemini' | 'azure' | 'web' | 'browser' | 'puter';
export interface Provider {
  id: string;
  name: string;
  kind: ProviderKind;
  /** Where its API is (the endpoint the user gives for Azure). */
  base: string;
  /** Its default model; the user can type another. */
  model: string;
  /** Where to get a key (or the app to install, for local models). */
  keyUrl: string;
  /** Runs on this computer: no key needed. */
  local?: boolean;
  /** Shown first in the picker. */
  top?: boolean;
  /** What the key looks like, for the key field. */
  keyHint?: string;
  /** web: the public chat's address, with {q} where the request goes when the site takes it. */
  web?: string;
}

/** Free, with the person's own account on the AI's public site: no key (see webAi.ts). */
const WEB: [id: string, name: string, url: string, top?: boolean][] = [
  ['claude', 'Claude.ai', 'https://claude.ai/new?q={q}', true],
  ['chatgpt', 'ChatGPT', 'https://chatgpt.com/?q={q}', true],
  ['gemini', 'Google Gemini', 'https://gemini.google.com/app', true],
  ['copilot', 'Microsoft Copilot', 'https://copilot.microsoft.com/?q={q}', true],
  ['lechat', 'Le Chat (Mistral)', 'https://chat.mistral.ai/chat?q={q}', true],
  ['deepseek', 'DeepSeek', 'https://chat.deepseek.com/', true],
  ['perplexity', 'Perplexity', 'https://www.perplexity.ai/search?q={q}', true],
  ['googleai', 'Google AI Mode', 'https://www.google.com/search?udm=50&q={q}'],
  ['bing', 'Copilot in Bing', 'https://www.bing.com/search?showconv=1&q={q}'],
  ['grok', 'Grok (xAI)', 'https://grok.com/?q={q}'],
  ['meta', 'Meta AI', 'https://www.meta.ai/'],
  ['duck', 'Duck.ai (DuckDuckGo, private)', 'https://duckduckgo.com/?q={q}&ia=chat'],
  ['brave', 'Brave Leo', 'https://search.brave.com/search?q={q}&summary=1'],
  ['you', 'You.com', 'https://you.com/search?q={q}&tbm=youchat'],
  ['huggingchat', 'HuggingChat', 'https://huggingface.co/chat/'],
  ['qwen', 'Qwen Chat', 'https://chat.qwen.ai/'],
  ['kimi', 'Kimi (Moonshot)', 'https://www.kimi.com/'],
  ['poe', 'Poe', 'https://poe.com/'],
  ['pi', 'Pi', 'https://pi.ai/talk'],
  ['lumo', 'Lumo (Proton, private)', 'https://lumo.proton.me/'],
  ['glm', 'Z.ai (GLM)', 'https://chat.z.ai/'],
];

/** Free, answers in the app: one free Puter account, no key (see webAi.ts). */
const FREE: [id: string, name: string, model: string][] = [
  ['claude', 'Claude', 'anthropic/claude-opus-4.1'],
  ['chatgpt', 'ChatGPT', 'openai/gpt-5.4-mini'],
  ['gemini', 'Google Gemini', 'gemini-2.5-flash'],
  ['mistral', 'Mistral', 'mistralai/mistral-medium-3.1'],
  ['deepseek', 'DeepSeek', 'deepseek/deepseek-v3.2'],
  ['grok', 'Grok (xAI)', 'x-ai/grok-4-1-fast-non-reasoning'],
  ['llama', 'Llama (Meta)', 'meta-llama/llama-4-maverick'],
  ['claude-haiku', 'Claude Haiku (fast)', 'anthropic/claude-3.5-haiku'],
  ['gpt-pro', 'ChatGPT Pro', 'openai/gpt-5-pro'],
  ['gpt-nano', 'ChatGPT Nano (fast)', 'openai/gpt-5.4-nano'],
  ['gpt-oss', 'GPT-OSS (open model)', 'openai/gpt-oss-120b'],
  ['gemini-pro', 'Gemini Pro', 'gemini-2.5-pro'],
  ['gemini-lite', 'Gemini Flash Lite (fast)', 'gemini-2.5-flash-lite'],
  ['deepseek-r1', 'DeepSeek R1 (reasoning)', 'deepseek/deepseek-r1-0528'],
  ['mistral-small', 'Mistral Small (fast)', 'mistralai/mistral-small-3.2-24b-instruct'],
  ['mixtral', 'Mixtral 8x22B', 'mistralai/mixtral-8x22b-instruct'],
  ['grok-420', 'Grok 4.20', 'x-ai/grok-4.20'],
  ['llama-scout', 'Llama 4 Scout', 'meta-llama/llama-4-scout'],
  ['llama-70b', 'Llama 3.3 70B', 'meta-llama/llama-3.3-70b-instruct'],
  ['glm', 'GLM (Z.ai)', 'z-ai/glm-5.3'],
];

export const PROVIDERS: Provider[] = [
  ...FREE.map(([id, name, model], i): Provider => ({ id: `free-${id}`, name, kind: 'puter', base: '', model, keyUrl: 'https://puter.com', top: i < 7 })),
  ...WEB.map(([id, name, url, top]): Provider => ({ id: `web-${id}`, name, kind: 'web', base: '', model: '', keyUrl: url.replace(/[?&][^?&]*\{q\}.*$/, ''), web: url, top })),
  { id: 'browser', name: 'Browser AI (Chrome, Edge)', kind: 'browser', base: '', model: '', keyUrl: 'https://developer.chrome.com/docs/ai/built-in', local: true },
  { id: 'claude', name: 'Claude (Anthropic)', kind: 'anthropic', base: 'https://api.anthropic.com', model: 'claude-opus-5-5', keyUrl: 'https://console.anthropic.com/settings/keys', top: true, keyHint: 'sk-ant-…' },
  { id: 'openai', name: 'ChatGPT (OpenAI)', kind: 'openai', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys', top: true, keyHint: 'sk-…' },
  { id: 'gemini', name: 'Google Gemini', kind: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash', keyUrl: 'https://aistudio.google.com/apikey', top: true, keyHint: 'AIza…' },
  { id: 'azure', name: 'Microsoft Azure OpenAI', kind: 'azure', base: '', model: '', keyUrl: 'https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI', top: true },
  { id: 'github', name: 'Microsoft GitHub Models', kind: 'openai', base: 'https://models.github.ai/inference', model: 'openai/gpt-4.1-mini', keyUrl: 'https://github.com/settings/personal-access-tokens', top: true, keyHint: 'github_pat_…' },
  { id: 'mistral', name: 'Mistral (Le Chat)', kind: 'openai', base: 'https://api.mistral.ai/v1', model: 'mistral-large-latest', keyUrl: 'https://console.mistral.ai/api-keys', top: true },
  { id: 'deepseek', name: 'DeepSeek', kind: 'openai', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys', top: true, keyHint: 'sk-…' },
  { id: 'xai', name: 'xAI (Grok)', kind: 'openai', base: 'https://api.x.ai/v1', model: 'grok-2-latest', keyUrl: 'https://console.x.ai', keyHint: 'xai-…' },
  { id: 'perplexity', name: 'Perplexity', kind: 'openai', base: 'https://api.perplexity.ai', model: 'sonar', keyUrl: 'https://www.perplexity.ai/settings/api', keyHint: 'pplx-…' },
  { id: 'groq', name: 'Groq (Llama)', kind: 'openai', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys', keyHint: 'gsk_…' },
  { id: 'openrouter', name: 'OpenRouter (any model)', kind: 'openai', base: 'https://openrouter.ai/api/v1', model: 'openrouter/auto', keyUrl: 'https://openrouter.ai/keys', keyHint: 'sk-or-…' },
  { id: 'together', name: 'Together AI', kind: 'openai', base: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', keyUrl: 'https://api.together.xyz/settings/api-keys' },
  { id: 'fireworks', name: 'Fireworks AI', kind: 'openai', base: 'https://api.fireworks.ai/inference/v1', model: 'accounts/fireworks/models/llama-v3p3-70b-instruct', keyUrl: 'https://fireworks.ai/account/api-keys' },
  { id: 'cerebras', name: 'Cerebras', kind: 'openai', base: 'https://api.cerebras.ai/v1', model: 'llama-3.3-70b', keyUrl: 'https://cloud.cerebras.ai' },
  { id: 'huggingface', name: 'Hugging Face', kind: 'openai', base: 'https://router.huggingface.co/v1', model: 'meta-llama/Llama-3.3-70B-Instruct', keyUrl: 'https://huggingface.co/settings/tokens', keyHint: 'hf_…' },
  { id: 'nvidia', name: 'NVIDIA NIM', kind: 'openai', base: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct', keyUrl: 'https://build.nvidia.com', keyHint: 'nvapi-…' },
  { id: 'deepinfra', name: 'DeepInfra', kind: 'openai', base: 'https://api.deepinfra.com/v1/openai', model: 'meta-llama/Llama-3.3-70B-Instruct', keyUrl: 'https://deepinfra.com/dash/api_keys' },
  { id: 'sambanova', name: 'SambaNova', kind: 'openai', base: 'https://api.sambanova.ai/v1', model: 'Meta-Llama-3.3-70B-Instruct', keyUrl: 'https://cloud.sambanova.ai/apis' },
  { id: 'novita', name: 'Novita AI', kind: 'openai', base: 'https://api.novita.ai/v3/openai', model: 'meta-llama/llama-3.3-70b-instruct', keyUrl: 'https://novita.ai/settings/key-management' },
  { id: 'hyperbolic', name: 'Hyperbolic', kind: 'openai', base: 'https://api.hyperbolic.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct', keyUrl: 'https://app.hyperbolic.xyz/settings' },
  { id: 'moonshot', name: 'Moonshot (Kimi)', kind: 'openai', base: 'https://api.moonshot.ai/v1', model: 'kimi-latest', keyUrl: 'https://platform.moonshot.ai/console/api-keys' },
  { id: 'dashscope', name: 'Alibaba Qwen', kind: 'openai', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', keyUrl: 'https://bailian.console.alibabacloud.com' },
  { id: 'zhipu', name: 'Zhipu (GLM)', kind: 'openai', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus', keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
  { id: 'ollama', name: 'Ollama (on this computer)', kind: 'openai', base: 'http://localhost:11434/v1', model: 'llama3.2', keyUrl: 'https://ollama.com/download', local: true },
  { id: 'lmstudio', name: 'LM Studio (on this computer)', kind: 'openai', base: 'http://localhost:1234/v1', model: 'local-model', keyUrl: 'https://lmstudio.ai', local: true },
];
export const provider = (id: string) => PROVIDERS.find(p => p.id === id);

// ---------- what is kept on this device ----------

const KEYS = 'oi1.code.helperKeys'; // shared with the Master corrector, which used them first
const SETTINGS = 'oi1.ai.providers';
const read = <T,>(key: string, empty: T): T => { try { return { ...empty, ...JSON.parse(localStorage.getItem(key) ?? '{}') } as T; } catch { return empty; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window: kept until the tab closes */ } };

export interface AiChoice {
  /** The AI every app uses, unless an app has its own. */
  main: string;
  /** An app's own AI, by app id, like { stage: 'gemini' }. */
  byApp: Record<string, string>;
  /** A model other than the provider's default, by provider id. */
  models: Record<string, string>;
  /** Microsoft Azure OpenAI: the resource's address and the deployment's name. */
  azure: { endpoint: string; deployment: string };
}
// No key needed by default: Claude through a free Puter account. Someone who already gave a Claude key keeps it.
const hadClaudeKey = () => { try { return !!localStorage.getItem('oi1:ai:key'); } catch { return false; } };
const EMPTY: AiChoice = { main: 'free-claude', byApp: {}, models: {}, azure: { endpoint: '', deployment: '' } };
let cache: AiChoice | null = null;
const listeners = new Set<() => void>();

export const aiChoice = {
  get: (): AiChoice => (cache ??= read(SETTINGS, { ...EMPTY, main: hadClaudeKey() ? 'claude' : EMPTY.main })),
  set(patch: Partial<AiChoice>) { cache = { ...aiChoice.get(), ...patch }; write(SETTINGS, cache); for (const fn of listeners) fn(); },
  onChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  /** The provider an app uses. */
  forApp(app?: string): Provider {
    const c = aiChoice.get();
    return provider((app && c.byApp[app]) || c.main) ?? provider('free-claude')!;
  },
  model: (p: Provider) => aiChoice.get().models[p.id]?.trim() || (p.kind === 'azure' ? aiChoice.get().azure.deployment : p.model),
};

export function providerKeys(): Record<string, string> { return read<Record<string, string>>(KEYS, {}); }
export function providerKey(id: string): string { return providerKeys()[id] ?? ''; }
export function setProviderKey(id: string, value: string) {
  const k = providerKeys();
  if (value.trim()) k[id] = value.trim(); else delete k[id];
  write(KEYS, k);
  for (const fn of listeners) fn();
}

// ---------- asking a provider that is not Claude ----------

export class ProviderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Reads a server-sent event stream, calling `onData` with each `data:` line's text. */
async function readEvents(res: Response, onData: (data: string) => void) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith('data:')) onData(line.slice(5).trim());
    }
  }
  if (buf.trim().startsWith('data:')) onData(buf.trim().slice(5).trim());
}

const jsonNote = (schema: Record<string, unknown>) => `\n\nAnswer ONLY with JSON (no code fence) that follows this JSON schema:\n${JSON.stringify(schema)}`;

/** Asks `p` (any provider but Claude), streaming the answer like the Claude path does. */
export async function askProvider(p: Provider, req: AiRequest): Promise<string> {
  const key = providerKey(p.id);
  const model = aiChoice.model(p);
  let text = '';
  const add = (delta: string | undefined) => { if (delta) { text += delta; req.onText?.(text); } };

  if (p.kind === 'gemini') {
    const res = await fetch(`${p.base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`, {
      method: 'POST', signal: req.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system + (req.schema ? jsonNote(req.schema) : '') }] },
        contents: req.messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        ...(req.schema ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      }),
    });
    if (!res.ok) throw new ProviderError(res.status, await res.text().catch(() => ''));
    await readEvents(res, d => {
      try { add((JSON.parse(d) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts?.map(x => x.text ?? '').join('')); } catch { /* keep-alive */ }
    });
    return text;
  }

  // OpenAI's chat format: OpenAI, Microsoft (Azure, GitHub Models), Mistral, DeepSeek, Ollama and the others.
  const azure = aiChoice.get().azure;
  const url = p.kind === 'azure'
    ? `${azure.endpoint.replace(/\/+$/, '')}/openai/deployments/${encodeURIComponent(azure.deployment)}/chat/completions?api-version=2024-10-21`
    : `${p.base}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (p.kind === 'azure') headers['api-key'] = key; else if (key) headers.Authorization = `Bearer ${key}`;
  const strict = p.id === 'openai' || p.kind === 'azure';
  const body = (format: boolean) => JSON.stringify({
    model, stream: true,
    messages: [{ role: 'system', content: req.system + (req.schema && !(format && strict) ? jsonNote(req.schema) : '') }, ...req.messages],
    ...(req.schema && format ? { response_format: strict ? { type: 'json_schema', json_schema: { name: 'answer', schema: req.schema } } : { type: 'json_object' } } : {}),
  });
  let res = await fetch(url, { method: 'POST', signal: req.signal, headers, body: body(true) });
  // Some providers do not take response_format: ask again with the schema in the instructions only.
  if (res.status === 400 && req.schema) res = await fetch(url, { method: 'POST', signal: req.signal, headers, body: body(false) });
  if (!res.ok) throw new ProviderError(res.status, await res.text().catch(() => ''));
  await readEvents(res, d => {
    if (d === '[DONE]') return;
    try { add((JSON.parse(d) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content); } catch { /* keep-alive */ }
  });
  // A JSON answer sometimes comes inside a code fence: the apps want the JSON itself.
  return req.schema ? text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '') : text;
}

/** Whether `p` can answer: it has a key (or runs on this computer, or is Azure with its address). */
export function providerReady(p: Provider, claudeKey: string): boolean {
  if (p.kind === 'web' || p.kind === 'puter') return true;
  if (p.kind === 'browser') return browserAiHere();
  if (p.kind === 'anthropic') return !!claudeKey;
  if (p.local) return true;
  if (p.kind === 'azure') return !!providerKey(p.id) && !!aiChoice.get().azure.endpoint && !!aiChoice.get().azure.deployment;
  return !!providerKey(p.id);
}
