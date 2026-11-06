// The network guard of confidential mode: while the mode is on, nothing the person writes can leave this device.
// Every way a page sends data (fetch, XMLHttpRequest, sendBeacon, WebSocket, EventSource, new windows with a
// question in their address) goes through here. Allowed: this app itself, this device (localhost: Ollama,
// LM Studio), and plain downloads with a short address from the places the app gets its own parts from
// (updates, dictionaries, the on-device AI and dictation models, fonts). Everything else is stopped and written
// in the journal. The apps' own checks (grammar off, on-device AI only…) come first; this is the safety net.
import { confidentialOn } from './mode';

/** Places the app downloads its own parts from (models, dictionaries, updates, fonts). Downloads only. */
const PARTS = [
  'fisbal.github.io', 'raw.githubusercontent.com', 'cdn.jsdelivr.net', 'esm.sh', 'unpkg.com',
  'huggingface.co', 'hf.co', 'fonts.googleapis.com', 'fonts.gstatic.com',
];
const MAX_URL = 600;

export interface Blocked { host: string; how: string; at: number }
const listeners = new Set<(b: Blocked) => void>();
export function onBlocked(fn: (b: Blocked) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
let lastBlocked: Blocked | null = null;
export const lastBlockedSend = () => lastBlocked;

const partsHost = (h: string) => PARTS.some(p => h === p || h.endsWith(`.${p}`));
const localHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost');

/** May this request go out? `body` is true when it carries data (POST, PUT…). */
export function allowed(url: string | URL, method = 'GET', body = false, base = location.href): boolean {
  if (!confidentialOn()) return true;
  let u: URL;
  try { u = new URL(String(url), base); } catch { return false; }
  if (u.protocol === 'data:' || u.protocol === 'blob:') return true;
  if (u.origin === location.origin || localHost(u.hostname)) return true;
  const read = /^(GET|HEAD|OPTIONS)$/i.test(method) && !body;
  return read && partsHost(u.hostname) && u.href.length <= MAX_URL;
}

function stop(url: string | URL, how: string): never {
  let host = '';
  try { host = new URL(String(url), location.href).hostname; } catch { host = String(url).slice(0, 60); }
  const b = { host, how, at: Date.now() };
  lastBlocked = b;
  for (const fn of listeners) { try { fn(b); } catch { /* listener failed */ } }
  throw new TypeError(`Confidential mode: sending to ${host} is blocked`);
}

let installed = false;
/** Puts the guard in front of every network door of the page. Called once, first thing at start-up. */
export function installNetGuard() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const w = window as unknown as Record<string, unknown> & typeof window;

  const realFetch = w.fetch.bind(w);
  w.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (confidentialOn()) {
      const req = input instanceof Request ? input : null;
      const url = req ? req.url : String(input);
      const method = init?.method ?? req?.method ?? 'GET';
      const body = init?.body != null || (!!req && req.body != null);
      try { if (!allowed(url, method, body)) stop(url, 'fetch'); } catch (e) { return Promise.reject(e); }
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;

  const X = w.XMLHttpRequest?.prototype;
  if (X) {
    const realOpen = X.open, realSend = X.send;
    const meta = new WeakMap<XMLHttpRequest, { url: string; method: string }>();
    X.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
      meta.set(this, { url: String(url), method });
      return (realOpen as (...a: unknown[]) => void).call(this, method, url, ...rest);
    } as typeof X.open;
    X.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      const m = meta.get(this);
      if (m && confidentialOn() && !allowed(m.url, m.method, body != null)) stop(m.url, 'xhr');
      return realSend.call(this, body);
    };
  }

  if (navigator.sendBeacon) {
    const real = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (confidentialOn() && !allowed(url, 'POST', true)) { try { stop(url, 'beacon'); } catch { return false; } }
      return real(url, data);
    };
  }

  for (const name of ['WebSocket', 'EventSource'] as const) {
    const Real = w[name] as (new (url: string | URL, p?: unknown) => object) | undefined;
    if (!Real) continue;
    const Guarded = function (url: string | URL, p?: unknown) {
      if (confidentialOn()) {
        let u: URL | null = null;
        try { u = new URL(String(url), location.href); } catch { /* bad address */ }
        if (!u || !(u.origin === location.origin || localHost(u.hostname))) stop(url, name);
      }
      return new Real(url, p);
    } as unknown as typeof Real;
    Object.assign(Guarded, Real);
    (Guarded as unknown as { prototype: object }).prototype = Real.prototype;
    w[name] = Guarded as never;
  }

  // A new window whose address carries a question (web AIs take the request in "?q=…").
  const realWindowOpen = w.open.bind(w);
  w.open = ((url?: string | URL, target?: string, features?: string) => {
    if (url && confidentialOn()) {
      try {
        const u = new URL(String(url), location.href);
        if (u.origin !== location.origin && (u.search.length > 1 || u.hash.length > 1)) stop(u, 'window');
      } catch (e) { if (e instanceof TypeError && String(e.message).startsWith('Confidential')) return null; }
    }
    return realWindowOpen(url, target, features);
  }) as typeof window.open;
}
