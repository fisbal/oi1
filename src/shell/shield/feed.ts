// Bouclier, part 4: the world lists of dangerous sites (updated every day) and the "vaccine" memory.
//
// World lists: a GitHub workflow (.github/workflows/shield-feed.yml) downloads every day the public lists of
// phishing and malware sites (Phishing.Database, MIT; URLhaus by abuse.ch, CC0; Block List Project, Unlicense),
// keeps only a short fingerprint of each site (SHA-256), splits them in 256 small files and publishes them on the
// shield-data branch. To check a site, Office In 1 downloads only the small file for the first two letters of its
// fingerprint: the site you visit is never sent anywhere (the same idea as Google Safe Browsing's hash prefixes
// and Have I Been Pwned's k-anonymity).
//
// Vaccine (Martin's idea): every threat the shield catches becomes an "antibody" kept on the device: the file's
// fingerprint, the site's name. The next time it is recognised at once, even offline, and blocked. Antibodies that
// Martin approves (shared on purpose, see SharePanel) go into the daily list, so every installation gets the
// antidote (herd immunity), like antivirus signature updates. The idea comes from artificial immune systems
// (Forrest, Perelson, Allen, Cherukuri, "Self-nonself discrimination in a computer", IEEE S&P 1994; Kephart,
// "A biologically inspired immune system for computers", IBM 1994), which is also how antivirus signatures began.
import { siteOf } from './links';

export const FEED_BASE = 'https://raw.githubusercontent.com/fisbal/oi1/shield-data/';
const META_KEY = 'oi1.shield.meta';
const SHARD_KEY = (p: string) => `oi1.shield.h.${p}`;
const AB_KEY = 'oi1.shield.antibodies';
const DAY = 24 * 3600 * 1000;

export interface FeedMeta { updated: string; count: number; sources: string[]; antidotes?: { files: string[]; hosts: string[] }; checkedAt: number }
export interface Antibody { kind: 'file' | 'host'; key: string; label: string; codes: string[]; at: number; shared?: boolean }

const read = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : null; } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or private */ } };

export async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------- world lists ----------
let metaLoad: Promise<FeedMeta | null> | null = null;

export function feedMeta(): FeedMeta | null { return read<FeedMeta>(META_KEY); }

/** Refreshes the list's summary once a day (in the background). */
export function refreshFeed(force = false): Promise<FeedMeta | null> {
  const cur = feedMeta();
  if (!force && cur && Date.now() - cur.checkedAt < DAY) return Promise.resolve(cur);
  metaLoad ??= fetch(`${FEED_BASE}meta.json`, { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() as Promise<Omit<FeedMeta, 'checkedAt'>> : null))
    .then(m => {
      if (!m) return cur;
      const next = { ...m, checkedAt: Date.now() };
      if (cur?.updated !== m.updated) clearShards();
      write(META_KEY, next);
      for (const h of m.antidotes?.files ?? []) addAntibody({ kind: 'file', key: h, label: 'Office In 1', codes: ['shared'], at: Date.now(), shared: true }, false);
      for (const h of m.antidotes?.hosts ?? []) addAntibody({ kind: 'host', key: h, label: h, codes: ['shared'], at: Date.now(), shared: true }, false);
      return next;
    })
    .catch(() => cur)
    .finally(() => { metaLoad = null; });
  return metaLoad;
}

function clearShards() {
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('oi1.shield.h.')) localStorage.removeItem(k); } catch { /* blocked */ }
}

const shardMem = new Map<string, Set<string>>();
async function shard(prefix: string): Promise<Set<string> | null> {
  const mem = shardMem.get(prefix);
  if (mem) return mem;
  const saved = read<{ at: number; list: string[] }>(SHARD_KEY(prefix));
  if (saved && Date.now() - saved.at < DAY) { const s = new Set(saved.list); shardMem.set(prefix, s); return s; }
  try {
    const r = await fetch(`${FEED_BASE}h/${prefix}.txt`);
    if (!r.ok) throw new Error(String(r.status));
    const list = (await r.text()).split('\n').filter(Boolean);
    write(SHARD_KEY(prefix), { at: Date.now(), list });
    const s = new Set(list);
    shardMem.set(prefix, s);
    return s;
  } catch {
    return saved ? new Set(saved.list) : null; // offline: yesterday's list is better than none
  }
}

/** The host and its parent site, the way the daily lists write them. */
export const hostKeys = (host: string) => [...new Set([host.replace(/^www\./, ''), siteOf(host.replace(/^www\./, ''))])];

/** True when a world list or an antibody names this site. */
export async function hostListed(host: string): Promise<'list' | 'antibody' | null> {
  const keys = hostKeys(host.toLowerCase());
  if (keys.some(k => antibodies().some(a => a.kind === 'host' && a.key === k))) return 'antibody';
  for (const k of keys) {
    const h = await sha256Hex(k);
    const s = await shard(h.slice(0, 2));
    if (s?.has(h.slice(2, 16))) return 'list';
  }
  return null;
}

// ---------- vaccine: antibodies ----------
export function antibodies(): Antibody[] { return read<Antibody[]>(AB_KEY) ?? []; }
const abListeners = new Set<() => void>();
export const onAntibodies = (f: () => void) => { abListeners.add(f); return () => { abListeners.delete(f); }; };

export function addAntibody(a: Antibody, notify = true) {
  const all = antibodies().filter(x => !(x.kind === a.kind && x.key === a.key));
  write(AB_KEY, [a, ...all].slice(0, 2000));
  if (notify) abListeners.forEach(f => f());
}
export function removeAntibody(kind: Antibody['kind'], key: string) {
  write(AB_KEY, antibodies().filter(x => !(x.kind === kind && x.key === key)));
  abListeners.forEach(f => f());
}
export const fileAntibody = (hash: string) => antibodies().find(a => a.kind === 'file' && a.key === hash) ?? null;
