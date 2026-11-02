// "In 1 AI" on the device: free, no account, nothing leaves the device (see deviceAi.worker.ts).
// The model downloads once (about 500 MB); `deviceAi.onProgress` lets the copilot show how far it is.

import type { AiRequest } from './contract';
import { cleanAnswer } from './webAi';

/** About how much the model weighs, for the person to decide (Wi-Fi). */
export const DEVICE_AI_MB = 500;
const READY = 'oi1.ai.device.ready';

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

function mark(ready: boolean) { try { if (ready) localStorage.setItem(READY, '1'); else localStorage.removeItem(READY); } catch { /* private window */ } }

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./deviceAi.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (ev: MessageEvent) => {
    const m = ev.data as { type: string; id?: number; text?: string; error?: string; pct?: number };
    if (m.type === 'progress') { pct = m.pct ?? 0; changed(); return; }
    if (m.type === 'ready') { pct = null; mark(true); loadDone?.resolve(); loadDone = null; changed(); return; }
    if (m.type === 'load-error') { pct = null; loading = null; loadDone?.reject(new Error(m.error)); loadDone = null; changed(); return; }
    const p = m.id != null ? pending.get(m.id) : undefined;
    if (!p) return;
    if (m.type === 'part') p.onText?.(m.text ?? '');
    else if (m.type === 'text') { pending.delete(m.id!); p.resolve(m.text ?? ''); }
    else if (m.type === 'ask-error') { pending.delete(m.id!); p.reject(new Error(m.error)); }
  };
  worker.onerror = e => { const err = new Error(e.message || 'In 1 AI stopped'); loadDone?.reject(err); loadDone = null; loading = null; for (const p of pending.values()) p.reject(err); pending.clear(); worker = null; pct = null; changed(); };
  return worker;
}

export const deviceAi = {
  /** 'ready' once downloaded on this device, 'download' before. */
  state: (): 'download' | 'loading' | 'ready' => {
    if (pct != null) return 'loading';
    try { return localStorage.getItem(READY) ? 'ready' : 'download'; } catch { return 'download'; }
  },
  /** How far the download is (0-99), or null when it is not downloading. */
  progress: () => pct,
  onProgress(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  /** Downloads the model (once) and gets it ready. */
  prepare(): Promise<void> {
    if (fake()) { mark(true); changed(); return Promise.resolve(); }
    if (loading) return loading;
    pct = 0; changed();
    loading = new Promise<void>((resolve, reject) => { loadDone = { resolve, reject }; });
    loading.catch(() => { mark(false); });
    getWorker().postMessage({ type: 'load' });
    return loading;
  },
};

/** The messages for the small model: an app's short plain request when it has one (it has a short memory). */
export function deviceMessages(req: AiRequest): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const json = req.schema && !req.chatPrompt ? `\n\nAnswer ONLY with JSON (no code fence) that follows this JSON schema:\n${JSON.stringify(req.schema)}` : '';
  if (req.chatPrompt) return [{ role: 'system', content: 'You help with office documents. Answer exactly in the asked format, in the language of the request.' }, { role: 'user', content: req.chatPrompt }];
  const history = req.messages.slice(-6);
  return [{ role: 'system', content: req.system + json }, ...history.map(m => ({ role: m.role, content: m.content }))];
}

export async function askDevice(req: AiRequest): Promise<string> {
  const messages = deviceMessages(req);
  const json = !!req.schema && !req.chatPrompt;
  const f = fake();
  if (f) { const text = await f(messages); req.onText?.(text); return json ? cleanAnswer(text, true) : text; }
  await deviceAi.prepare();
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
