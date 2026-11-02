// "In 1 AI": a small AI that runs on the device itself (Martin, 2026-11-02: "not everyone uses Claude and Claude is
// not free"). Free, no account, no key, and what you ask never leaves the device. The model (Qwen2.5 0.5B Instruct,
// Apache 2.0, writes French, English, Spanish, Portuguese and German) downloads once (about 500 MB), stays in the
// browser cache, then works offline. WebGPU when the device has it (fast), WebAssembly otherwise (every phone).
// transformers.js comes from the CDN on first use (pinned version), like dictation: see dictation.worker.ts.
export {}; // a module: its names stay its own (dictation.worker.ts has the same ones)
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';

interface Msg { role: 'system' | 'user' | 'assistant'; content: string }
type Generator = ((messages: Msg[], opts: Record<string, unknown>) => Promise<{ generated_text: Msg[] | string }[]>) & { tokenizer: unknown };
interface Lib {
  pipeline: (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>;
  env: { allowLocalModels: boolean; useBrowserCache: boolean };
  TextStreamer: new (tokenizer: unknown, opts: { skip_prompt: boolean; skip_special_tokens?: boolean; callback_function: (text: string) => void }) => unknown;
  InterruptableStoppingCriteria: new () => { interrupt(): void; reset(): void };
}
let lib: Promise<Lib> | null = null;
const getLib = () => (lib ??= (import(/* @vite-ignore */ LIB) as Promise<Lib>).then(m => { m.env.allowLocalModels = false; m.env.useBrowserCache = true; return m; }).catch(e => { lib = null; throw e; }));

const post = (m: unknown) => (self as unknown as { postMessage(m: unknown): void }).postMessage(m);
const files = new Map<string, { loaded: number; total: number }>();

async function hasWebGpu(): Promise<boolean> {
  try {
    const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return !!gpu && !!(await gpu.requestAdapter());
  } catch { return false; }
}

let gen: Promise<Generator> | null = null;
function load(): Promise<Generator> {
  if (gen) return gen;
  gen = (async () => {
    const { pipeline } = await getLib();
    const gpu = await hasWebGpu();
    return pipeline('text-generation', MODEL, {
      device: gpu ? 'webgpu' : 'wasm',
      dtype: gpu ? 'q4f16' : 'q8',
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== 'progress' || !p.file || !p.total) return;
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
        let a = 0, b = 0;
        for (const f of files.values()) { a += f.loaded; b += f.total; }
        post({ type: 'progress', pct: b ? Math.min(99, Math.round((a / b) * 100)) : 0 });
      },
    }) as Promise<Generator>;
  })();
  gen.catch(() => { gen = null; });
  return gen;
}

let stop: { interrupt(): void; reset(): void } | null = null;

self.onmessage = async (ev: MessageEvent) => {
  // A dedicated worker only hears the page that created it (origin is empty); refuse anything else.
  if (ev.origin && ev.origin !== self.location.origin) return;
  const m = ev.data as { type: string; id?: number; messages?: Msg[]; max?: number };
  if (m.type === 'load') {
    try { await load(); post({ type: 'ready' }); }
    catch (e) { post({ type: 'load-error', error: String((e as Error)?.message ?? e) }); }
  } else if (m.type === 'stop') {
    stop?.interrupt();
  } else if (m.type === 'ask' && m.messages) {
    try {
      const run = await load();
      const L = await getLib();
      stop ??= new L.InterruptableStoppingCriteria();
      stop.reset();
      let text = '';
      const streamer = new L.TextStreamer(run.tokenizer, {
        skip_prompt: true, skip_special_tokens: true,
        callback_function: (part: string) => { text += part; post({ type: 'part', id: m.id, text }); },
      });
      const out = await run(m.messages, { max_new_tokens: m.max ?? 512, do_sample: false, repetition_penalty: 1.1, streamer, stopping_criteria: stop });
      const g = out[0]?.generated_text;
      const last = Array.isArray(g) ? g[g.length - 1]?.content ?? text : text;
      post({ type: 'text', id: m.id, text: last });
    } catch (e) {
      post({ type: 'ask-error', id: m.id, error: String((e as Error)?.message ?? e) });
    }
  }
};
