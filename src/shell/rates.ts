// Money of the whole world (Martin, 2026-10-31: "convertion de différente money du monde"): 300+ currencies,
// crypto and metals included, free, no key, no limit. Rates from exchange-api (CC0, updated daily,
// https://github.com/fawazahmed0/exchange-api), on jsDelivr with a Cloudflare fallback. The last rates stay on the
// device with their date, so conversions also work offline.

const PRIMARY = (date: string) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/eur.min.json`;
const FALLBACK = (date: string) => `https://${date}.currency-api.pages.dev/v1/currencies/eur.min.json`;
const KEY = 'oi1:rates';

export interface Rates { date: string; eur: Record<string, number> }

const tables = new Map<string, Rates>(); // 'latest' and past dates
const loading = new Map<string, Promise<Rates | null>>();
const listeners = new Set<() => void>();
export function onRatesChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

try {
  const kept = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Rates | null;
  if (kept?.eur) tables.set('latest', kept);
} catch { /* blocked storage */ }

async function fetchTable(date: string): Promise<Rates | null> {
  for (const url of [PRIMARY(date), FALLBACK(date)]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = (await res.json()) as Rates;
      if (json?.eur && typeof json.eur.usd === 'number') return json;
    } catch { /* try the next one */ }
  }
  return null;
}

/** Loads the rates for today ('latest') or a past day (YYYY-MM-DD); already loaded ones come back at once.
 *  Today's rates are asked again at most every 6 hours (the source updates once a day). */
const asked = new Map<string, number>();
const AGAIN_MS = 6 * 3600_000;
export function loadRates(date = 'latest', force = false): Promise<Rates | null> {
  const have = tables.get(date);
  const recent = Date.now() - (asked.get(date) ?? 0) < AGAIN_MS;
  if (have && !force && (date !== 'latest' || recent)) return Promise.resolve(have);
  if (!force && recent && !have) return Promise.resolve(null); // asked a moment ago and it failed: not again yet
  let p = loading.get(date);
  if (!p) {
    asked.set(date, Date.now());
    p = fetchTable(date).then(t => {
      loading.delete(date);
      const changed = !!t && (have?.date !== t.date || !have);
      if (t) {
        tables.set(date, t);
        if (date === 'latest') { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* full */ } }
      }
      if (changed) for (const fn of listeners) fn();
      return t ?? have ?? null;
    });
    loading.set(date, p);
  }
  return p;
}

/** The rates loaded so far for that day, or null (then loadRates starts and listeners hear when they arrive). */
export function ratesNow(date = 'latest'): Rates | null {
  void loadRates(date);
  return tables.get(date) ?? null;
}

/** `amount` in `from` as `to` (ISO codes like EUR, USD, XAF, or BTC). Null when a code is unknown. */
export function convert(amount: number, from: string, to: string, table: Rates): number | null {
  const a = table.eur[from.toLowerCase()], b = table.eur[to.toLowerCase()];
  if (!a || !b) return null;
  return (amount / a) * b;
}

export function currencyCodes(table: Rates | null): string[] {
  return table ? Object.keys(table.eur).map(c => c.toUpperCase()).sort() : [];
}

/** The currency's name in the interface language (Intl knows them all), or its code. */
export function currencyName(code: string, lang: string): string {
  try {
    const n = new Intl.DisplayNames([lang], { type: 'currency' }).of(code.toUpperCase());
    return n && n.toUpperCase() !== code.toUpperCase() ? n : code.toUpperCase();
  } catch { return code.toUpperCase(); }
}

/** A flag for national currencies (the first two letters are the country), a symbol for the others. */
export function currencyFlag(code: string): string {
  const c = code.toUpperCase();
  const special: Record<string, string> = { EUR: '🇪🇺', XAF: '🌍', XOF: '🌍', XCD: '🌴', XPF: '🌊', BTC: '₿', ETH: 'Ξ', XAU: '🥇', XAG: '🥈' };
  if (special[c]) return special[c];
  if (c.length !== 3 || c.startsWith('X')) return '💱';
  return String.fromCodePoint(...[...c.slice(0, 2)].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** For tests: put a table in place without the network. */
export function setRatesForTest(t: Rates, date = 'latest') { tables.set(date, t); for (const fn of listeners) fn(); }
