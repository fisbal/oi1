/**
 * One dictation engine for every In 1 app (Letter, Notes, Assistant, Mail…).
 *
 * Why: the browser's Web Speech API is only a shell in many places. Inside the
 * Windows app (Tauri / WebView2), Android WebViews and some browsers it starts,
 * shows "listening", and never returns a word, because the cloud service
 * behind it is missing. So:
 *   1. In those apps we go straight to the device engine.
 *   2. Elsewhere we try Web Speech, with a watchdog: if it hears speech but
 *      gives no words, or reports a service error, we switch to the device.
 *   3. The device engine records the microphone and transcribes on the device
 *      with Whisper (transformers.js in a worker). The model downloads once
 *      (with a % shown), then works offline. Nothing leaves the device.
 * Spoken punctuation ("virgule", "comma", "new line"…) works with both engines
 * in the 5 languages.
 */

export type DictationEngine = 'web' | 'device';
export type DictationError = 'denied' | 'nomic' | 'unsupported' | 'failed';
export type DictationStatus =
  | { kind: 'starting' }
  | { kind: 'loading'; pct: number }
  | { kind: 'listening'; engine: DictationEngine; heard?: string }
  | { kind: 'working' }
  | { kind: 'error'; code: DictationError }
  | { kind: 'stopped' };

export interface DictationOptions {
  /** BCP-47 language, e.g. "fr-FR" or "fr". */
  lang: string;
  /** Text ready to insert: punctuation applied, "\n" = new line, "\n\n" = new paragraph. */
  onText(text: string): void;
  onStatus?(status: DictationStatus): void;
  /** Force an engine (tests, settings). */
  engine?: DictationEngine;
}

export interface Dictation { stop(): void; readonly engine: () => DictationEngine }

type Win = Window & {
  SpeechRecognition?: new () => WebRec;
  webkitSpeechRecognition?: new () => WebRec;
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
  chrome?: { webview?: unknown };
  /** CI hook: replaces Whisper so tests never download the model. */
  __oi1FakeAsr?: (audio: Float32Array, lang: string) => string | Promise<string>;
};
interface WebRec {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const w = () => window as Win;
const hasMic = () => typeof navigator.mediaDevices?.getUserMedia === 'function';
const ENGINE_KEY = 'oi1.dictation.engine';
let webBroken = false; // learned this session: Web Speech gives no words here

/** Web Speech exists but cannot work (no cloud service behind it). */
export function webSpeechIsShell(): boolean {
  const x = w();
  const ua = navigator.userAgent;
  return !!(x.__TAURI__ || x.__TAURI_INTERNALS__ || x.chrome?.webview || /; wv\)|\bwv\b/.test(ua) || /Electron\//.test(ua));
}

export function pickEngine(forced?: DictationEngine): DictationEngine | null {
  if (forced) return forced;
  let pref = '';
  try { pref = localStorage.getItem(ENGINE_KEY) ?? ''; } catch { /* private mode */ }
  if (pref === 'device' || pref === 'web') return pref;
  const hasWeb = !!(w().SpeechRecognition ?? w().webkitSpeechRecognition);
    if (hasWeb && !webBroken && !webSpeechIsShell()) return 'web';
  if (hasMic()) return 'device';
  return hasWeb ? 'web' : null;
}

/** Is any dictation possible here? (Buttons stay visible; this only guides messages.) */
export const dictationAvailable = () => pickEngine() !== null;

export function startDictation(o: DictationOptions): Dictation {
  const status = (s: DictationStatus) => { try { o.onStatus?.(s); } catch { /* UI gone */ } };
  let current: { stop(): void } | null = null;
  let engine: DictationEngine = 'web';
  let stopped = false;
  const emit = (raw: string) => {
    const text = applyVoiceCommands(raw, o.lang);
    if (text.trim() || text.includes('\n')) o.onText(text);
  };
  const runDevice = () => {
    engine = 'device';
    current = deviceEngine(o.lang, emit, status, () => stopped);
  };
  const first = pickEngine(o.engine);
  status({ kind: 'starting' });
  if (!first) { queueMicrotask(() => { status({ kind: 'error', code: 'unsupported' }); status({ kind: 'stopped' }); }); }
  else if (first === 'device') runDevice();
  else {
    current = webEngine(o.lang, emit, status, () => stopped, () => {
      // Web Speech gave nothing: switch for the rest of the session.
      webBroken = true;
      if (!stopped && hasMic()) runDevice();
      else { status({ kind: 'error', code: 'unsupported' }); status({ kind: 'stopped' }); }
    });
  }
  return {
    stop() { if (stopped) return; stopped = true; current?.stop(); },
    engine: () => engine,
  };
}

// ---------------------------------------------------------------- Web Speech
function webEngine(lang: string, emit: (t: string) => void, status: (s: DictationStatus) => void, isStopped: () => boolean, fallback: () => void) {
  const SR = (w().SpeechRecognition ?? w().webkitSpeechRecognition)!;
  let r: WebRec | null = null;
  let gotWords = false;
  let quickEnds = 0;
  let audioTimer = 0;
  let wordsTimer = 0;
  let gaveUp = false;
  const clear = () => { clearTimeout(audioTimer); clearTimeout(wordsTimer); };
  const giveUp = () => {
    if (gaveUp || isStopped()) return;
    gaveUp = true; clear();
    try { r?.abort(); } catch { /* already ended */ }
    r = null;
    fallback();
  };
  const begin = () => {
    const rec = new SR();
    r = rec;
    const startedAt = Date.now();
    let audio = false;
    rec.lang = speechTag(lang);
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => {
      status({ kind: 'listening', engine: 'web' });
      // A working recogniser opens the mic within a moment.
      audioTimer = window.setTimeout(() => { if (!audio && !gotWords) giveUp(); }, 4000);
    };
    rec.onaudiostart = () => { audio = true; clearTimeout(audioTimer); };
    rec.onspeechstart = () => {
      // Speech heard: words must follow. A shell recogniser never sends any.
      if (!gotWords) { clearTimeout(wordsTimer); wordsTimer = window.setTimeout(() => { if (!gotWords) giveUp(); }, 6000); }
    };
    rec.onresult = e => {
      gotWords = true; clearTimeout(wordsTimer);
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const said = res[0].transcript;
        if (res.isFinal) { if (said.trim()) emit(said); }
        else interim += said;
      }
      status({ kind: 'listening', engine: 'web', heard: interim.trim() || undefined });
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed') {
        // In a page the user said no; in a WebView it is the service that refuses.
        if (gotWords || !hasMic()) { status({ kind: 'error', code: 'denied' }); stopAll(); }
        else giveUp();
      } else if (e.error === 'audio-capture') { status({ kind: 'error', code: 'nomic' }); stopAll(); }
      else if (e.error === 'network' || e.error === 'service-not-allowed' || e.error === 'language-not-supported' || e.error === 'bad-grammar') giveUp();
      // 'no-speech' and 'aborted' are normal: onend restarts.
    };
    rec.onend = () => {
      clear();
      if (r !== rec || gaveUp) return;
      r = null;
      if (isStopped()) { status({ kind: 'stopped' }); return; }
      // Chrome ends after a silence: keep listening. Instant ends = broken.
      if (Date.now() - startedAt < 1000 && !gotWords) { if (++quickEnds >= 3) return giveUp(); } else quickEnds = 0;
      try { begin(); } catch { giveUp(); }
    };
    rec.start();
  };
  const stopAll = () => { clear(); const rec = r; r = null; try { rec?.stop(); } catch { /* ended */ } status({ kind: 'stopped' }); };
  try { begin(); } catch { queueMicrotask(giveUp); }
  return { stop: () => { if (!gaveUp) stopAll(); } };
}

// ------------------------------------------------------------ device (Whisper)
let worker: Worker | null = null;
let workerReady: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, { ok(text: string): void; ko(e: Error): void }>();
let onProgress: ((pct: number) => void) | null = null;

function getWorker(): Promise<void> {
  if (workerReady) return workerReady;
  workerReady = new Promise<void>((resolve, reject) => {
    try {
      worker = new Worker(new URL('./dictation.worker.ts', import.meta.url), { type: 'module' });
    } catch (e) { reject(e as Error); return; }
    worker.onmessage = (ev: MessageEvent) => {
      const m = ev.data as { type: string; id?: number; text?: string; pct?: number; error?: string };
      if (m.type === 'progress') onProgress?.(m.pct ?? 0);
      else if (m.type === 'ready') resolve();
      else if (m.type === 'load-error') { workerReady = null; worker?.terminate(); worker = null; reject(new Error(m.error)); }
      else if (m.type === 'text' && m.id) { pending.get(m.id)?.ok(m.text ?? ''); pending.delete(m.id); }
      else if (m.type === 'asr-error' && m.id) { pending.get(m.id)?.ko(new Error(m.error)); pending.delete(m.id); }
    };
    worker.onerror = e => { workerReady = null; reject(new Error(e.message || 'worker')); };
    worker.postMessage({ type: 'load' });
  });
  return workerReady;
}

function transcribe(audio: Float32Array, lang: string): Promise<string> {
  const fake = w().__oi1FakeAsr;
  if (fake) return Promise.resolve(fake(audio, lang));
  return getWorker().then(() => new Promise<string>((ok, ko) => {
    const id = nextId++;
    pending.set(id, { ok, ko });
    worker!.postMessage({ type: 'asr', id, audio, language: whisperLanguage(lang) }, [audio.buffer]);
  }));
}

const RATE = 16000;

function deviceEngine(lang: string, emit: (t: string) => void, status: (s: DictationStatus) => void, isStopped: () => boolean) {
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let node: ScriptProcessorNode | null = null;
  let src: MediaStreamAudioSourceNode | null = null;
  let ended = false;
  let queue = Promise.resolve();
  let inFlight = 0;
  const finish = (err?: DictationError) => {
    if (ended) return;
    ended = true;
    flushSegment();
    try { node?.disconnect(); src?.disconnect(); } catch { /* gone */ }
    stream?.getTracks().forEach(tr => tr.stop());
    void ctx?.close().catch(() => undefined);
    if (err) status({ kind: 'error', code: err });
    // Let queued segments finish before saying "stopped".
    void queue.then(() => status({ kind: 'stopped' }));
  };

  // ---- voice activity detection on 16 kHz frames
  let seg: Float32Array[] = [];
  let segLen = 0;
  let silent = 0;
  let speaking = false;
  let loud = 0;
  let floor = 0.004;
  const pre: Float32Array[] = [];
  const preMax = Math.round(RATE * 0.3);
  const flushSegment = () => {
    if (!speaking) return;
    speaking = false;
    const total = segLen;
    const parts = seg;
    seg = []; segLen = 0; silent = 0;
    if (loud < RATE * 0.25 || total < RATE * 0.4) { loud = 0; return; } // a click, not words
    loud = 0;
    const audio = new Float32Array(total);
    let o = 0;
    for (const p of parts) { audio.set(p, o); o += p.length; }
    inFlight++;
    status({ kind: 'working' });
    queue = queue.then(async () => {
      try {
        const text = cleanWhisper(await transcribe(audio, lang));
        if (text) emit(text);
      } catch {
        status({ kind: 'error', code: 'failed' });
      } finally {
        inFlight--;
        if (!ended && inFlight === 0) status({ kind: 'listening', engine: 'device' });
      }
    });
  };
  const onFrame = (f: Float32Array) => {
    let sum = 0;
    for (let i = 0; i < f.length; i++) sum += f[i] * f[i];
    const rms = Math.sqrt(sum / f.length);
    if (!speaking) floor = floor * 0.95 + Math.min(rms, 0.05) * 0.05;
    const voice = rms > Math.max(0.012, floor * 3);
    if (!speaking) {
      pre.push(f);
      let n = pre.reduce((a, b) => a + b.length, 0);
      while (n > preMax && pre.length > 1) n -= pre.shift()!.length;
      if (voice) { speaking = true; seg = pre.splice(0); segLen = n; loud = f.length; silent = 0; }
      return;
    }
    seg.push(f); segLen += f.length;
    if (voice) { loud += f.length; silent = 0; } else silent += f.length;
    if (silent > RATE * 0.7 || segLen > RATE * 12) flushSegment();
  };

  (async () => {
    if (!hasMic()) return finish('unsupported');
    try {
      // Raw sound for Whisper: noise suppression and echo cancelling smear speech and make it invent words.
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 } });
    } catch (e) {
      const n = (e as DOMException).name;
      return finish(n === 'NotAllowedError' || n === 'SecurityError' ? 'denied' : n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'NotReadableError' ? 'nomic' : 'failed');
    }
    if (isStopped()) return finish();
    // Get the model ready while the user starts talking (first time: download %).
    if (!w().__oi1FakeAsr) {
      onProgress = pct => { if (!ended) status({ kind: 'loading', pct }); };
      getWorker().then(() => { if (!ended && inFlight === 0) status({ kind: 'listening', engine: 'device' }); })
        .catch(() => finish('failed'));
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    // Let the browser resample to 16 kHz itself (clean, no aliasing); Firefox cannot mix rates, so it keeps its own.
    try { ctx = new AC({ sampleRate: RATE }); src = ctx.createMediaStreamSource(stream); }
    catch { void ctx?.close().catch(() => undefined); ctx = new AC(); src = ctx.createMediaStreamSource(stream); }
    await ctx.resume().catch(() => undefined);
    node = ctx.createScriptProcessor(4096, 1, 1);
    const ratio = ctx.sampleRate / RATE;
    node.onaudioprocess = ev => {
      if (ended) return;
      const input = ev.inputBuffer.getChannelData(0);
      const out = new Float32Array(Math.floor(input.length / ratio));
      for (let i = 0; i < out.length; i++) {
        // average the samples that fall in this output slot (simple low-pass)
        const a = Math.floor(i * ratio), b = Math.min(input.length, Math.floor((i + 1) * ratio));
        let s = 0;
        for (let j = a; j < b; j++) s += input[j];
        out[i] = b > a ? s / (b - a) : input[a];
      }
      onFrame(out);
    };
    src.connect(node);
    node.connect(ctx.destination);
    if (w().__oi1FakeAsr || workerReady && await Promise.race([workerReady.then(() => true), Promise.resolve(false)])) status({ kind: 'listening', engine: 'device' });
  })().catch(() => finish('failed'));

  return { stop: () => finish() };
}

/** Whisper invents captions on noise; drop those. */
export function cleanWhisper(text: string): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (/^[[(♪*].*[\])♪*]$/.test(s)) return '';
  if (/amara\.org|sous-titr|subtitles? by|thanks? for watching|merci d'avoir regardé|untertitel|subtítulos|legendas pela/i.test(s)) return '';
  if (/^(you|\.+|…)$/i.test(s)) return '';
  return collapseRepeats(s);
}

/** Whisper sometimes loops ("pas de mode pas de mode pas de mode…"): a run of 3 or more of the same words is kept once. */
export function collapseRepeats(text: string): string {
  const words = text.split(' ');
  for (let n = 1; n <= 8; n++) {
    for (let i = 0; i + n * 3 <= words.length; i++) {
      const key = (k: number) => words.slice(k, k + n).join(' ').toLowerCase().replace(/[.,!?;:…]+$/u, '');
      let reps = 1;
      while (i + (reps + 1) * n <= words.length && key(i + reps * n) === key(i)) reps++;
      if (reps >= 3) { words[i + n - 1] = words[i + reps * n - 1]; words.splice(i + n, (reps - 1) * n); } // keeps the last one's full stop
    }
  }
  return words.join(' ').trim();
}

// ------------------------------------------------------------ languages
const TAGS: Record<string, string> = { en: 'en-US', fr: 'fr-FR', es: 'es-ES', pt: 'pt-PT', de: 'de-DE' };
export const speechTag = (lang: string) => (lang.includes('-') ? lang : TAGS[lang] ?? lang) || navigator.language;
const WHISPER: Record<string, string> = { en: 'english', fr: 'french', es: 'spanish', pt: 'portuguese', de: 'german', it: 'italian', nl: 'dutch' };
export const whisperLanguage = (lang: string) => WHISPER[lang.slice(0, 2).toLowerCase()] ?? 'english';
const short = (lang: string) => lang.slice(0, 2).toLowerCase();

// ------------------------------------------------------------ voice commands
// Longest phrases first. "\n" = new line, "\n\n" = new paragraph.
const ART_FR = "(?<!\\b(?:le|un|ce|du|au|mon|ton|son|notre|votre|leur|quel|chaque|en|de|à)\\s)";
const COMMANDS: Record<string, [string, string][]> = {
  fr: [
    ["point d'interrogation", '?'], ["point d'exclamation", '!'], ['points de suspension', '…'],
    ['point à la ligne', '.\n'], ['nouveau paragraphe', '\n\n'], ['retour à la ligne', '\n'], ['nouvelle ligne', '\n'], ['à la ligne', '\n'],
    ['point-virgule', ';'], ['point virgule', ';'], ['deux-points', ':'], ['deux points', ':'],
    ['ouvrir les guillemets', '« '], ['fermer les guillemets', ' »'], ['ouvrir la parenthèse', '('], ['fermer la parenthèse', ')'],
    ['virgule', ','], ['point final', '.'], [`${ART_FR}point`, '.'],
  ],
  en: [
    ['question mark', '?'], ['exclamation mark', '!'], ['exclamation point', '!'], ['new paragraph', '\n\n'], ['new line', '\n'],
    ['full stop', '.'], ['semicolon', ';'], ['colon', ':'], ['comma', ','], ['period', '.'], ['dot', '.'], ['ellipsis', '…'],
    ['open quote', '“'], ['close quote', '”'], ['open bracket', '('], ['close bracket', ')'], ['open parenthesis', '('], ['close parenthesis', ')'],
  ],
  es: [
    ['signo de interrogación', '?'], ['signo de exclamación', '!'], ['punto y aparte', '.\n\n'], ['punto y seguido', '.'], ['punto y coma', ';'],
    ['nuevo párrafo', '\n\n'], ['nueva línea', '\n'], ['dos puntos', ':'], ['puntos suspensivos', '…'], ['abrir comillas', '«'], ['cerrar comillas', '»'],
    ['abrir paréntesis', '('], ['cerrar paréntesis', ')'], ['punto final', '.'], ['coma', ','], ['punto', '.'],
  ],
  pt: [
    ['ponto de interrogação', '?'], ['ponto de exclamação', '!'], ['ponto e vírgula', ';'], ['novo parágrafo', '\n\n'], ['nova linha', '\n'],
    ['dois pontos', ':'], ['reticências', '…'], ['abrir aspas', '«'], ['fechar aspas', '»'], ['abrir parênteses', '('], ['fechar parênteses', ')'],
    ['ponto final', '.'], ['vírgula', ','], ['ponto', '.'],
  ],
  de: [
    ['fragezeichen', '?'], ['ausrufezeichen', '!'], ['neuer absatz', '\n\n'], ['neue zeile', '\n'], ['semikolon', ';'], ['strichpunkt', ';'],
    ['doppelpunkt', ':'], ['auslassungspunkte', '…'], ['anführungszeichen auf', '„'], ['anführungszeichen zu', '“'], ['klammer auf', '('], ['klammer zu', ')'],
    ['komma', ','], ['punkt', '.'],
  ],
};
const compiled = new Map<string, [RegExp, string][]>();
const rulesFor = (lang: string) => {
  const k = short(lang);
  let r = compiled.get(k);
  if (!r) {
    r = (COMMANDS[k] ?? COMMANDS.en).map(([p, v]) => [new RegExp(`(?<![\\p{L}\\p{N}'’-])${p.replace(/'/g, "['’]").replace(/ /g, '[\\s-]+')}(?![\\p{L}\\p{N}])[.,;:!?]?`, 'giu'), `\u0000${v}\u0000`] as [RegExp, string]);
    compiled.set(k, r);
  }
  return r;
};

/** Turn spoken punctuation into marks and tidy the spaces around them. */
export function applyVoiceCommands(raw: string, lang: string): string {
  let s = ` ${raw.trim()} `;
  for (const [re, v] of rulesFor(lang)) s = s.replace(re, v);
  if (!s.includes('\u0000')) return raw.trim();
  // marks: drop spaces before closing marks and around line breaks
  s = s.replace(/\s*\u0000([,.;:!?…)”»“]?[^\u0000]*)\u0000\s*/g, (_m, v: string) => {
    if (v.startsWith('\n')) return v;
    if (/^[(«„“]/.test(v) && !/^[“]$/.test(v) || v === '“') return ` ${v.trim()}`;
    if (v.endsWith('\n') || v.endsWith('\n\n')) return v;
    if (/^ ?[»”)]$/.test(v)) return `${v.trim()} `;
    return `${v} `;
  });
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/([,.;:!?])\1+/g, '$1').replace(/[ \t]{2,}/g, ' ');
  // capital letter after a sentence end or a new line
  s = s.replace(/([.!?…]\s+|\n)(\p{Ll})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
  s = s.replace(/^\s+/, '').replace(/[ \t]+$/, '');
  if (short(lang) === 'fr') s = s.replace(/\s*([;:!?»])/g, ' $1').replace(/«\s*/g, '« ').replace(/^ /, '');
  return s;
}

/**
 * Insert dictated text into a Tiptap editor at the cursor: a space when needed,
 * "\n" as a line break, "\n\n" as a new paragraph.
 */
export function insertDictation(ed: { state: { selection: { from: number }; doc: { textBetween(a: number, b: number): string } }; chain(): EditorChain } | null | undefined, text: string) {
  if (!ed) return;
  const from = ed.state.selection.from;
  const before = ed.state.doc.textBetween(Math.max(0, from - 1), from);
  const lead = before && !/\s$/.test(before) && !/^[\s,.;:!?…)»” ]/.test(text) ? ' ' : '';
  const chain = ed.chain().focus();
  const paras = (lead + text).split('\n\n');
  paras.forEach((p, i) => {
    if (i > 0) chain.splitBlock();
    p.split('\n').forEach((line, j) => {
      if (j > 0) chain.setHardBreak();
      if (line) chain.insertContent(line);
    });
  });
  chain.run();
}
interface EditorChain { focus(): EditorChain; insertContent(c: string): EditorChain; splitBlock(): EditorChain; setHardBreak(): EditorChain; run(): boolean }

/** Plain text fields (Assistant box, Mail body…). */
export function joinDictation(current: string, text: string): string {
  if (!current) return text.replace(/^\s+/, '');
  if (/^[\s,.;:!?…)»” ]/.test(text) || /\s$/.test(current)) return current + text;
  return `${current} ${text}`;
}
