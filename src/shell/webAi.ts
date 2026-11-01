// The copilot without a key (Martin, 2026-10-31: "trop professionnel … propose des versions publiques … qu'il
// ouvre juste son compte"). Two ways:
// - web: the public chat of the chosen AI (claude.ai, ChatGPT, Gemini, Microsoft Copilot …) opens beside the work
//   with the request already written (and copied); the person signs in to their own account, free or paid, then
//   brings the answer back with "Paste the answer". These sites do not let an app read their answers, so the
//   answer comes back through the clipboard.
// - browser: the AI built into the browser (Gemini Nano in Chrome, Phi in Edge) answers right inside the app,
//   free and private, nothing leaves the computer.

import type { AiRequest } from './contract';

// ---------- web: the public chat, then "Paste the answer" ----------

export interface WebWait {
  id: number;
  /** The site's name, like "ChatGPT". */
  site: string;
  /** Opens the site again with the request (a closed or blocked window). */
  reopen: () => void;
  /** Whether the request fitted in the address; if not, it is only on the clipboard. */
  inUrl: boolean;
  /** The request itself, so the clipboard still holding it is not taken for the answer. */
  sent: string;
  answer: (text: string) => void;
  cancel: () => void;
}

let waiting: WebWait | null = null;
const listeners = new Set<() => void>();
let nextId = 1;
export const webWait = () => waiting;
export function onWebWait(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
const changed = () => { for (const fn of listeners) fn(); };

type Schema = { type?: string; properties?: Record<string, Schema>; items?: Schema; enum?: unknown[] };
/** A small example that has the shape a schema asks for: {"items": ["…"]}. */
export function exampleOf(schema: Schema): unknown {
  if (schema.enum?.length) return schema.enum[0];
  switch (schema.type) {
    case 'object': return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([k, v]) => [k, exampleOf(v)]));
    case 'array': return [exampleOf(schema.items ?? {}), '…'].filter((x, i) => i === 0 || typeof x === 'string');
    case 'number': case 'integer': return 0;
    case 'boolean': return true;
    default: return '…';
  }
}

/** The whole request as one message a person can paste in any chat. */
export function webPrompt(req: AiRequest): string {
  if (req.chatPrompt) return req.chatPrompt;
  const turns = req.messages.map((m, i) => (req.messages.length === 1 ? m.content : `${m.role === 'user' ? 'Me' : 'You'}: ${m.content}${i === req.messages.length - 1 ? '' : '\n'}`));
  // A plain example of the answer's shape reads better than a JSON schema in a chat (Martin, 2026-10-31).
  const json = req.schema
    ? `\n\nPlease answer with only this, in one code block:\n${JSON.stringify(exampleOf(req.schema))}`
    : '';
  return `${req.system}\n\n---\n\n${turns.join('\n')}${json}`;
}

/** Longest address the sites take reliably; a longer request goes by the clipboard only. */
const MAX_URL = 7000;

/** Opens the chat beside the work: a narrow window on a computer, a new tab on a phone. */
function openSite(url: string) {
  const wide = window.innerWidth > 900;
  const w = Math.min(520, Math.round(window.screen.availWidth * 0.36));
  const features = wide ? `popup,width=${w},height=${window.screen.availHeight},left=${window.screen.availWidth - w},top=0` : '';
  return window.open(url, 'oi1-copilot', features);
}

/** Pulls the answer out of what was pasted: the JSON inside a code block, when the app asked for JSON. */
export function cleanAnswer(text: string, json: boolean): string {
  const t = text.trim();
  if (!json) return t;
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const start = t.search(/[{[]/), end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}

/**
 * Asks through the public site: copies the request, opens the site with it, and resolves with what the person
 * pastes back. `template` has {q} where the request goes, or none when the site cannot take it in the address.
 */
export function askWeb(site: string, template: string, req: AiRequest): Promise<string> {
  const prompt = webPrompt(req);
  void navigator.clipboard?.writeText(prompt).catch(() => {});
  const filled = template.includes('{q}') ? template.replace('{q}', encodeURIComponent(prompt)) : template;
  const inUrl = template.includes('{q}') && filled.length <= MAX_URL;
  const url = inUrl ? filled : template.replace(/[?&][^?&]*\{q\}.*$/, '');
  openSite(url);
  waiting?.cancel();
  return new Promise<string>((resolve, reject) => {
    const id = nextId++;
    const done = () => { if (waiting?.id === id) { waiting = null; changed(); } };
    waiting = {
      id, site, inUrl, sent: prompt,
      reopen: () => { void navigator.clipboard?.writeText(prompt).catch(() => {}); openSite(url); },
      answer: text => { done(); resolve(cleanAnswer(text, !!req.schema)); },
      cancel: () => { done(); reject(new DOMException('Cancelled', 'AbortError')); },
    };
    req.signal?.addEventListener('abort', () => waiting?.id === id && waiting.cancel());
    changed();
  });
}

// ---------- browser: the AI built into Chrome and Edge ----------

interface LanguageModelSession {
  promptStreaming(input: string, options?: { signal?: AbortSignal; responseConstraint?: unknown }): AsyncIterable<string>;
  destroy(): void;
}
interface LanguageModelApi {
  availability(): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(options?: { initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[]; signal?: AbortSignal }): Promise<LanguageModelSession>;
}
const api = (): LanguageModelApi | undefined => (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;

/** Whether this browser has a built-in AI at all (it may still need a one-time download). */
export const browserAiHere = () => !!api();
export async function browserAiState(): Promise<'none' | 'download' | 'ready'> {
  const a = api();
  if (!a) return 'none';
  try {
    const s = await a.availability();
    return s === 'available' ? 'ready' : s === 'unavailable' ? 'none' : 'download';
  } catch { return 'none'; }
}

export async function askBrowser(req: AiRequest): Promise<string> {
  const a = api();
  if (!a) throw new Error('This browser has no built-in AI');
  // The small model in the browser has a short memory: an app's short plain request, when it has one, fits it.
  const history = req.chatPrompt ? [] : req.messages.slice(0, -1);
  const session = await a.create({
    initialPrompts: [{ role: 'system', content: req.chatPrompt ? 'You help with office documents. Answer exactly in the asked format.' : req.system }, ...history.map(m => ({ role: m.role, content: m.content }))],
    signal: req.signal,
  });
  try {
    // Older versions give the whole text so far at each step, newer ones only the new part.
    let text = '';
    for await (const chunk of session.promptStreaming(req.chatPrompt ?? req.messages[req.messages.length - 1].content, { signal: req.signal, ...(req.schema ? { responseConstraint: req.schema } : {}) })) {
      text = chunk.startsWith(text) && text ? chunk : text + chunk;
      req.onText?.(text);
    }
    return req.schema ? cleanAnswer(text, true) : text;
  } finally {
    session.destroy();
  }
}

// ---------- free: Puter, one free account, answers right in the app ----------
// Puter (puter.com) lets a web app use Claude, ChatGPT, Gemini and others without any key: the person signs in
// once to a free Puter account and their own account covers what they use ("user pays"), so the app owner pays
// nothing and nobody hands out a key. Someone who wants more upgrades their own Puter account, or uses a key.

interface PuterPart { text?: string }
interface Puter {
  ai: { chat(prompt: string | { role: string; content: string }[], options?: { model?: string; stream?: boolean }): Promise<AsyncIterable<PuterPart> | { message?: { content?: string | { text?: string }[] }; toString(): string }> };
  auth: { isSignedIn(): boolean; signIn(): Promise<unknown>; signOut(): void; getUser(): Promise<{ username: string }> };
}
const puterNow = () => (globalThis as { puter?: Puter }).puter;
let loading: Promise<Puter> | null = null;

/** Loads Puter's script once (call it early, so a later click can open its sign-in window right away). */
export function loadPuter(): Promise<Puter> {
  const p = puterNow();
  if (p) return Promise.resolve(p);
  return (loading ??= new Promise<Puter>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.puter.com/v2/';
    s.async = true;
    s.onload = () => (puterNow() ? resolve(puterNow()!) : reject(new Error('Puter did not load')));
    s.onerror = () => { loading = null; reject(new Error('Puter could not load (offline?)')); };
    document.head.appendChild(s);
  }));
}

export async function puterUser(): Promise<string | null> {
  const p = await loadPuter();
  if (!p.auth.isSignedIn()) return null;
  try { return (await p.auth.getUser()).username; } catch { return null; }
}
export async function puterSignIn(): Promise<string | null> { const p = await loadPuter(); await p.auth.signIn(); return puterUser(); }
export async function puterSignOut() { (await loadPuter()).auth.signOut(); }

/** Asks through Puter with the person's free account; Puter opens its own sign-in the first time. */
export async function askPuter(model: string, req: AiRequest): Promise<string> {
  const p = await loadPuter();
  const prompt = webPrompt(req);
  const run = async (m?: string) => {
    const res = await p.ai.chat(prompt, { ...(m ? { model: m } : {}), stream: true });
    let text = '';
    if (Symbol.asyncIterator in (res as object)) {
      for await (const part of res as AsyncIterable<PuterPart>) {
        if (req.signal?.aborted) throw new DOMException('Stopped', 'AbortError');
        if (part?.text) { text += part.text; req.onText?.(text); }
      }
    } else {
      const c = (res as { message?: { content?: string | { text?: string }[] } }).message?.content;
      text = typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.text ?? '').join('') : String(res);
      req.onText?.(text);
    }
    return text;
  };
  let text: string;
  try { text = await run(model); } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    // Model names on Puter change often: fall back to its default model rather than fail.
    text = await run();
  }
  return req.schema ? cleanAnswer(text, true) : text;
}
