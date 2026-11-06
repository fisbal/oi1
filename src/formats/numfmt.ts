// Excel number format codes: what Office In 1 writes for a cell's format, and what it reads back from Excel's codes
// (in .xlsx files and in cells pasted from Excel). Kept apart from xlsx.ts so pasting needs no zip library.

import { currencyOfCode, currencySymbol } from './currency';
import type { CellStyle } from './sheet';

// ---------- number format codes ----------

/** How the sign goes in a format code: the plain signs Excel knows, else [$sign] (shown as it is, read back the same). */
const PLAIN_SIGN: Record<string, string> = { USD: '"$"', EUR: '"€"', GBP: '"£"', JPY: '"¥"', CHF: '"CHF"' };
const signIn = (code: string) => PLAIN_SIGN[code] ?? `[$${currencySymbol(code)}]`;
/** Currencies written after the number, like 9,99 €. */
const SYMBOL_AFTER = new Set(['EUR', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'RUB', 'UAH', 'XOF', 'XAF', 'HTG', 'MAD', 'TND', 'DZD', 'VND']);
export const BUILTIN_CODES: Record<number, string> = {
  1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: '# ?/?', 13: '# ??/??',
  14: 'm/d/yyyy', 20: 'h:mm', 22: 'm/d/yyyy h:mm', 49: '@',
};

/** The Excel format code for a cell's number format, or '' for General. */
export function formatCode(st: CellStyle, currency: string): string {
  const f = st.format ?? 'general';
  const digits = (d: number) => (d > 0 ? `.${'0'.repeat(d)}` : '');
  const dflt = f === 'number' || f === 'currency' || f === 'accounting' || f === 'scientific' ? 2 : 0;
  const d = st.decimals ?? dflt;
  const money = st.currency ?? currency;
  const sym = signIn(money);
  const after = st.signFirst !== undefined ? !st.signFirst : SYMBOL_AFTER.has(money);
  switch (f) {
    case 'general': return st.decimals !== undefined ? `${st.thousands ? '#,##0' : '0'}${digits(d)}` : '';
    case 'integer': return st.thousands === false ? '0' : '#,##0';
    case 'number': return `${st.thousands === false ? '0' : '#,##0'}${digits(d)}`;
    case 'percent': return `0${digits(st.decimals ?? 0)}%`;
    case 'currency': return after ? `#,##0${digits(d)}\\ ${sym}` : `${sym}#,##0${digits(d)}`;
    case 'accounting': {
      const n = `#,##0${digits(d)}`;
      return after ? `_-* ${n}\\ ${sym}_-;\\-* ${n}\\ ${sym}_-;_-* "-"??\\ ${sym}_-;_-@_-` : `_(${sym}* ${n}_);_(${sym}* \\(${n}\\);_(${sym}* "-"??_);_(@_)`;
    }
    case 'scientific': return `0${digits(d)}E+00`;
    case 'fraction': return '# ??/??';
    case 'date': return 'm/d/yyyy';
    case 'longDate': return '[$-F800]dddd\\,\\ mmmm\\ dd\\,\\ yyyy';
    case 'time': return 'h:mm';
    case 'dateTime': return 'm/d/yyyy h:mm';
    case 'text': return '@';
  }
}

/** OI1's number format for an Excel format code. */
export function styleFromCode(id: number, code: string | undefined): Pick<CellStyle, 'format' | 'decimals' | 'thousands' | 'currency' | 'signFirst'> {
  const st: Pick<CellStyle, 'format' | 'decimals' | 'thousands' | 'currency' | 'signFirst'> = numberStyle(id, code);
  if ((st.format === 'currency' || st.format === 'accounting') && code) {
    const c = currencyOfCode(code);
    if (c) st.currency = c;
    // Where the sign sits in Excel's code: before the first digit or after it.
    const first = code.split(';')[0].replace(/_.|\*./g, '');
    const signAt = first.search(/"[^"]*"|\[\$[^\]]*\]|[$€£¥]/), digitAt = first.search(/[#0]/);
    if (st.format === 'currency' && signAt >= 0 && digitAt >= 0) st.signFirst = signAt < digitAt;
  }
  return st;
}

function numberStyle(id: number, code: string | undefined): Pick<CellStyle, 'format' | 'decimals' | 'thousands' | 'currency'> {
  if (id === 0) return {};
  if (id === 49) return { format: 'text' };
  if (id >= 5 && id <= 8) return { format: 'currency' };
  if ((id >= 14 && id <= 17) || id === 30) return { format: 'date' };
  if (id >= 18 && id <= 21 || (id >= 45 && id <= 47)) return { format: 'time' };
  if (id === 22) return { format: 'dateTime' };
  const src = code ?? BUILTIN_CODES[id];
  if (!src) return {};
  const first = src.split(';')[0];
  if (first === '@') return { format: 'text' };
  if (/F800|dddd|mmmm/i.test(first)) return { format: 'longDate' };
  const bare = first.replace(/"[^"]*"|\[[^\]]*\]|\\./g, m => (/[$€£¥]|CHF/.test(m) ? '$' : '')).replace(/_.|\*./g, '');
  const decimals = (bare.match(/\.(0+)/)?.[1].length) ?? 0;
  const thousands = bare.includes(',');
  if (/[dy]/i.test(bare) && /h/i.test(bare)) return { format: 'dateTime' };
  if (/h/i.test(bare) && /m/i.test(bare) && !/[dy]/i.test(bare)) return { format: 'time' };
  if (/[dmy]/i.test(bare) && !/0/.test(bare)) return { format: 'date' };
  if (bare.includes('%')) return decimals ? { format: 'percent', decimals } : { format: 'percent' };
  if (/E\+/i.test(bare)) return decimals === 2 ? { format: 'scientific' } : { format: 'scientific', decimals };
  if (/\?\/\?/.test(bare)) return { format: 'fraction' };
  if (/_\(|_-/.test(src) && /[$€£¥]|\[\$/.test(src)) return decimals === 2 ? { format: 'accounting' } : { format: 'accounting', decimals };
  if (/[$€£¥]/.test(bare) || /\[\$[^\]]*\]/.test(src) || /CHF/.test(src)) return decimals === 2 ? { format: 'currency' } : { format: 'currency', decimals };
  if (/[#0]/.test(bare)) {
    if (!decimals) return thousands ? { format: 'integer' } : { format: 'integer', thousands: false };
    const st: Pick<CellStyle, 'format' | 'decimals' | 'thousands'> = { format: 'number' };
    if (decimals !== 2) st.decimals = decimals;
    if (!thousands) st.thousands = false;
    return st;
  }
  return {};
}

