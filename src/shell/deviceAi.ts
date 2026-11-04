// "In 1 AI" on the device: free, no account, nothing leaves the device (see deviceAi.worker.ts).
// The model downloads once (about 500 MB); `deviceAi.onProgress` lets the copilot show how far it is.

import type { AiRequest } from './contract';
import { cleanAnswer } from './webAi';

/** The two models: In 1 AI (small, quick) and In 1 AI+ (Martin, 2026-11-04: "oui AI+ si c'est celui qui marche dans
 *  les 5 langues"), with about how much each weighs, for the person to decide (Wi-Fi). Both write the 5 languages. */
export const DEVICE_MODELS = {
  device: { repo: 'onnx-community/Qwen2.5-0.5B-Instruct', mb: 500, ready: 'oi1.ai.device.ready' },
  'device-plus': { repo: 'onnx-community/Qwen2.5-1.5B-Instruct', mb: 1200, ready: 'oi1.ai.devicePlus.ready' },
} as const;
export type DeviceModel = keyof typeof DEVICE_MODELS;
const modelOf = (id?: string): DeviceModel => (id === 'device-plus' ? 'device-plus' : 'device');
/** Which model the worker has in memory now (only one at a time: a phone has little memory). */
let loaded: DeviceModel | null = null;
let loadingId: DeviceModel | null = null;

interface Pending { onText?: (t: string) => void; resolve: (t: string) => void; reject: (e: Error) => void }
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
let loading: Promise<void> | null = null;
let loadDone: { resolve: () => void; reject: (e: Error) => void } | null = null;
let pct: number | null = null;
const listeners = new Set<() => void>();
const changed = () => { for (const fn of listeners) fn(); };

/** Tests (and the CI checks) answer with this instead of the real model. */
type Fake = (messages: { role: string; content: string }[]) => string | Promise<string>;
const fake = () => (globalThis as { __oi1FakeLlm?: Fake }).__oi1FakeLlm;

function mark(id: DeviceModel, ready: boolean) { try { if (ready) localStorage.setItem(DEVICE_MODELS[id].ready, '1'); else localStorage.removeItem(DEVICE_MODELS[id].ready); } catch { /* private window */ } }

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./deviceAi.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (ev: MessageEvent) => {
    const m = ev.data as { type: string; id?: number; text?: string; error?: string; pct?: number };
    if (m.type === 'progress') { pct = m.pct ?? 0; changed(); return; }
    if (m.type === 'ready') { pct = null; if (loadingId) { mark(loadingId, true); loaded = loadingId; } loadDone?.resolve(); loadDone = null; changed(); return; }
    if (m.type === 'load-error') { pct = null; loading = null; loadingId = null; loadDone?.reject(new Error(m.error)); loadDone = null; changed(); return; }
    const p = m.id != null ? pending.get(m.id) : undefined;
    if (!p) return;
    if (m.type === 'part') p.onText?.(m.text ?? '');
    else if (m.type === 'text') { pending.delete(m.id!); p.resolve(m.text ?? ''); }
    else if (m.type === 'ask-error') { pending.delete(m.id!); p.reject(new Error(m.error)); }
  };
  worker.onerror = e => { const err = new Error(e.message || 'In 1 AI stopped'); loadDone?.reject(err); loadDone = null; loading = null; for (const p of pending.values()) p.reject(err); pending.clear(); worker = null; pct = null; loaded = null; loadingId = null; changed(); };
  return worker;
}

export const deviceAi = {
  /** 'ready' once downloaded on this device, 'download' before. */
  state: (id?: string): 'download' | 'loading' | 'ready' => {
    const m = modelOf(id);
    if (pct != null && loadingId === m) return 'loading';
    try { return localStorage.getItem(DEVICE_MODELS[m].ready) ? 'ready' : 'download'; } catch { return 'download'; }
  },
  /** How far the download is (0-99), or null when it is not downloading. */
  progress: () => pct,
  onProgress(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  /** Downloads the model (once) and gets it ready. */
  prepare(id?: string): Promise<void> {
    const m = modelOf(id);
    if (fake()) { mark(m, true); loaded = m; changed(); return Promise.resolve(); }
    if (loading && loadingId === m) return loading;
    if (loaded === m && !loading) return Promise.resolve();
    pct = 0; loadingId = m; changed();
    loading = new Promise<void>((resolve, reject) => { loadDone = { resolve, reject }; });
    loading.catch(() => { mark(m, false); });
    getWorker().postMessage({ type: 'load', model: DEVICE_MODELS[m].repo });
    const done = loading;
    void done.then(() => { if (loading === done) loading = null; }, () => {});
    return done;
  },
};

/** The messages for the small model: an app's short plain request when it has one (it has a short memory). */
export function deviceMessages(req: AiRequest): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const json = req.schema && !req.chatPrompt ? `\n\nAnswer ONLY with JSON (no code fence) that follows this JSON schema:\n${JSON.stringify(req.schema)}` : '';
  if (req.chatPrompt) return [{ role: 'system', content: 'You help with office documents. Answer exactly in the asked format, in the language of the request.' }, { role: 'user', content: req.chatPrompt }];
  const history = req.messages.slice(-6);
  return [{ role: 'system', content: req.system + json }, ...history.map(m => ({ role: m.role, content: m.content }))];
}

export async function askDevice(req: AiRequest, model?: string): Promise<string> {
  const messages = deviceMessages(req);
  const json = !!req.schema && !req.chatPrompt;
  const f = fake();
  if (f) { const text = await f(messages); req.onText?.(text); return json ? cleanAnswer(text, true) : text; }
  await deviceAi.prepare(model);
  const w = getWorker();
  const id = ++seq;
  const text = await new Promise<string>((resolve, reject) => {
    pending.set(id, { onText: req.onText, resolve, reject });
    req.signal?.addEventListener('abort', () => { w.postMessage({ type: 'stop' }); }, { once: true });
    w.postMessage({ type: 'ask', id, messages, max: json ? 1024 : 700 });
  });
  if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return json ? cleanAnswer(text, true) : text.trim();
}
