// Speech to text on the device with Whisper (transformers.js, ONNX on WASM).
// The model downloads once (progress sent as %), is kept in the browser cache,
// then dictation works offline. Audio never leaves the device.
// transformers.js comes from the CDN on first use (pinned version) instead of npm: the npm package pulls
// half a gigabyte of native Node binaries into every build, and the model needs the internet once anyway.
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const MODEL = 'onnx-community/whisper-base';
type Lib = { pipeline: (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>; env: { allowLocalModels: boolean; useBrowserCache: boolean } };
let lib: Promise<Lib> | null = null;
const getLib = () => (lib ??= (import(/* @vite-ignore */ LIB) as Promise<Lib>).then(m => { m.env.allowLocalModels = false; m.env.useBrowserCache = true; return m; }).catch(e => { lib = null; throw e; }));

type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;
let asr: Promise<Asr> | null = null;
const files = new Map<string, { loaded: number; total: number }>();

const post = (m: unknown) => (self as unknown as { postMessage(m: unknown): void }).postMessage(m);

function load(): Promise<Asr> {
  if (asr) return asr;
  asr = getLib().then(({ pipeline }) => pipeline('automatic-speech-recognition', MODEL, {
    device: 'wasm',
    dtype: 'q8',
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== 'progress' || !p.file || !p.total) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
      let a = 0, b = 0;
      for (const f of files.values()) { a += f.loaded; b += f.total; }
      post({ type: 'progress', pct: b ? Math.min(99, Math.round((a / b) * 100)) : 0 });
    },
  }) as unknown as Promise<Asr>);
  asr.catch(() => { asr = null; });
  return asr;
}

self.onmessage = async (ev: MessageEvent) => {
  const m = ev.data as { type: string; id?: number; audio?: Float32Array; language?: string };
  if (m.type === 'load') {
    try { await load(); post({ type: 'ready' }); }
    catch (e) { post({ type: 'load-error', error: String((e as Error)?.message ?? e) }); }
  } else if (m.type === 'asr' && m.audio) {
    try {
      const run = await load();
      const out = await run(m.audio, { language: m.language, task: 'transcribe', chunk_length_s: 30 });
      const text = Array.isArray(out) ? out.map(x => x.text).join(' ') : out.text;
      post({ type: 'text', id: m.id, text });
    } catch (e) {
      post({ type: 'asr-error', id: m.id, error: String((e as Error)?.message ?? e) });
    }
  }
};
