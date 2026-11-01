// The shield's background work: checks files before they open, links before they are followed and pasted
// text, and turns every threat it catches into a vaccine. The windows it shows live in Shield.tsx.
import type { OpenedFile } from '../contract';
import { scanFile, worst, type Finding, type Level } from './scan';
import { checkLink, linksIn } from './links';
import { checkText } from './scam';
import { addAntibody, fileAntibody, hostKeys, hostListed, refreshFeed, sha256Hex } from './feed';
import { disinfect } from './vaccine';

const SETTINGS = 'oi1.shield.settings';
export interface ShieldSettings { files: boolean; links: boolean; paste: boolean }
export function shieldSettings(): ShieldSettings {
  try { return { files: true, links: true, paste: true, ...JSON.parse(localStorage.getItem(SETTINGS) ?? '{}') }; } catch { return { files: true, links: true, paste: true }; }
}
export function setShieldSettings(s: Partial<ShieldSettings>) {
  try { localStorage.setItem(SETTINGS, JSON.stringify({ ...shieldSettings(), ...s })); } catch { /* private window */ }
  emit();
}

// ---------- what the windows show (Shield.tsx listens) ----------
export type Ask =
  | { kind: 'file'; name: string; level: Level; findings: Finding[]; canClean: boolean; resolve: (c: 'cancel' | 'clean' | 'open') => void }
  | { kind: 'link'; url: string; host: string; level: Level; findings: Finding[]; resolve: (go: boolean) => void };
export interface Note { text: string; detail?: string; n: number }

let asking: Ask | null = null;
let note: Note | null = null;
let stats = { files: 0, links: 0, texts: 0, blocked: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());
export const onShield = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const currentAsk = () => asking;
export const currentNote = () => note;
export const shieldStats = () => stats;
export function closeNote() { note = null; emit(); }
let noteN = 0;
export function showNote(text: string, detail?: string) { note = { text, detail, n: ++noteN }; emit(); }
const ask = <T,>(a: Omit<Extract<Ask, { kind: 'file' }>, 'resolve'> | Omit<Extract<Ask, { kind: 'link' }>, 'resolve'>) => new Promise<T>(resolve => {
  asking = { ...a, resolve: (v: unknown) => { asking = null; emit(); resolve(v as T); } } as Ask;
  emit();
});

const bytesFile = (f: OpenedFile, buf: ArrayBuffer, name = f.name, type = f.type): OpenedFile => ({
  ...f, name, type, text: async () => new TextDecoder().decode(buf), arrayBuffer: async () => buf.slice(0),
});

/** Checks a file before it opens. Returns the file to open (maybe a clean copy), or null to stop. */
export async function guardFile(file: OpenedFile | null): Promise<OpenedFile | null> {
  if (!file || !shieldSettings().files) return file;
  let buf: ArrayBuffer;
  try { buf = await file.arrayBuffer(); } catch { return file; }
  stats = { ...stats, files: stats.files + 1 };
  const hash = await sha256Hex(buf).catch(() => '');
  const known = hash ? fileAntibody(hash) : null;
  const verdict = await scanFile(file.name, buf).catch(() => ({ level: 'ok' as Level, findings: [] as Finding[], kind: 'other' }));
  const findings = known ? [{ level: 'danger' as Level, code: known.shared ? 'shared' : 'vaccine' }, ...verdict.findings] : verdict.findings;
  const level = worst(findings);
  if (level === 'ok' || level === 'info') { const out = bytesFile(file, buf); return out; }
  const clean = await disinfect(file.name, buf).catch(() => null);
  const choice = await ask<'cancel' | 'clean' | 'open'>({ kind: 'file', name: file.name, level, findings, canClean: !!clean });
  if (level === 'danger' && hash && !known) {
    addAntibody({ kind: 'file', key: hash, label: file.name, codes: findings.map(f => f.code), at: Date.now() });
    showNote(st_vacc());
  }
  if (choice === 'cancel') { stats = { ...stats, blocked: stats.blocked + 1 }; emit(); return null; }
  if (choice === 'clean' && clean) {
    return bytesFile({ ...file, handle: undefined }, clean.data, clean.name);
  }
  return bytesFile(file, buf);
}
let st_vacc = () => '';
export function setVaccineText(f: () => string) { st_vacc = f; }

/** Full check of one link: instant rules, vaccines and the world list. */
export async function inspectLink(url: string, shown?: string) {
  const v = checkLink(url, shown);
  if (!v.host) return v;
  const listed = await Promise.race([hostListed(v.host), new Promise<null>(r => setTimeout(() => r(null), 1500))]).catch(() => null);
  if (listed) v.findings.unshift({ level: 'danger', code: listed === 'antibody' ? 'vaccine' : 'listed' });
  v.level = worst(v.findings);
  return v;
}

/** Clicks on links inside documents: checked before the browser goes there. */
function onClick(e: MouseEvent) {
  if (!shieldSettings().links || e.defaultPrevented || e.button > 1) return;
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || !a.closest('.module-host, .shield-zone')) return;
  const href = a.getAttribute('href') ?? '';
  if (!href || href.startsWith('#') || a.hasAttribute('download')) return;
  let u: URL | null = null;
  try { u = new URL(href, location.href); } catch { /* checked below as text */ }
  if (u && u.origin === location.origin) return;
  if (u && u.protocol === 'blob:') return;
  e.preventDefault();
  e.stopPropagation();
  void (async () => {
    stats = { ...stats, links: stats.links + 1 };
    const v = await inspectLink(href, a.textContent ?? undefined);
    let go = v.level === 'ok' || v.level === 'info';
    if (!go) {
      go = await ask<boolean>({ kind: 'link', url: v.url, host: v.host, level: v.level, findings: v.findings });
      if (v.level === 'danger') for (const k of hostKeys(v.host).slice(0, 1)) if (k) addAntibody({ kind: 'host', key: k, label: k, codes: v.findings.map(f => f.code), at: Date.now() });
      if (!go) { stats = { ...stats, blocked: stats.blocked + 1 }; emit(); }
    }
    if (go && /^https?:/i.test(v.url)) window.open(v.url, '_blank', 'noopener,noreferrer');
  })();
}

let lastPasted: { text: string; at: number } | null = null;
export const pastedText = () => lastPasted?.text ?? '';
let scamText = () => '';
export function setScamText(f: () => string) { scamText = f; }

/** Pasted text: a quiet warning when it looks like a scam (never blocks the paste). */
function onPaste(e: ClipboardEvent) {
  if (!shieldSettings().paste) return;
  const text = e.clipboardData?.getData('text/plain') ?? '';
  if (text.length < 25) return;
  stats = { ...stats, texts: stats.texts + 1 };
  const scam = checkText(text);
  const bad = linksIn(text).map(l => checkLink(l)).filter(v => v.level === 'danger');
  if (scam.level === 'warn' || scam.level === 'danger' || bad.length) {
    lastPasted = { text, at: Date.now() };
    showNote(scamText(), 'paste');
  }
}

let started = false;
/** Starts the shield (once): link and paste watchers, and the daily list update in the background. */
export function startShield() {
  if (started) return;
  started = true;
  document.addEventListener('click', onClick, true);
  document.addEventListener('paste', onPaste, true);
  window.setTimeout(() => void refreshFeed().then(emit), 8000);
  window.setInterval(() => void refreshFeed().then(emit), 6 * 3600 * 1000);
}
