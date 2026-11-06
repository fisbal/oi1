// The currencies a cell can show, whatever language Office In 1 speaks (Martin, 2026-11-06: "je devrais pouvoir changer
// la monnaie quelque soit la langue… je voudrais utiliser $"). Each one has a symbol that tells it apart from the others,
// so a sheet saved as .xlsx and opened again (in Office In 1 or Excel) keeps the same money.

/** ISO codes, most used first. */
export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'CHF', 'JPY', 'CNY', 'AUD', 'NZD', 'INR', 'BRL', 'MXN', 'KRW', 'HKD', 'SGD', 'SEK', 'NOK',
  'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'RUB', 'UAH', 'ILS', 'AED', 'SAR', 'ZAR', 'EGP', 'MAD', 'TND', 'DZD', 'NGN',
  'XOF', 'XAF', 'HTG', 'DOP', 'COP', 'ARS', 'CLP', 'PEN', 'THB', 'PHP', 'IDR', 'VND',
] as const;

/** Symbols that stand for one currency, as typed or as Excel writes them. "$" alone is the US dollar. */
const BY_SYMBOL: Record<string, string> = {
  $: 'USD', US$: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '￥': 'JPY', CA$: 'CAD', C$: 'CAD', A$: 'AUD', AU$: 'AUD', NZ$: 'NZD',
  'CN¥': 'CNY', RMB: 'CNY', '元': 'CNY', '₹': 'INR', R$: 'BRL', MX$: 'MXN', '₩': 'KRW', HK$: 'HKD', S$: 'SGD', '₪': 'ILS',
  '₽': 'RUB', '₺': 'TRY', '₴': 'UAH', 'zł': 'PLN', 'Kč': 'CZK', Ft: 'HUF', lei: 'RON', '฿': 'THB', '₱': 'PHP', '₫': 'VND',
  '₦': 'NGN', Rp: 'IDR', R: 'ZAR', Fr: 'CHF', 'Fr.': 'CHF', CFA: 'XOF', FCFA: 'XAF', G: 'HTG', Gdes: 'HTG', 'RD$': 'DOP',
  'COL$': 'COP', 'S/': 'PEN', 'د.إ': 'AED', 'ر.س': 'SAR', 'د.م.': 'MAD', 'د.ت': 'TND', 'د.ج': 'DZD', 'E£': 'EGP',
};

/** Excel's locale numbers that turn "$" into another dollar ([$$-1009] is the Canadian dollar). */
const DOLLAR_LCID: Record<string, string> = {
  409: 'USD', 1009: 'CAD', c0c: 'CAD', c09: 'AUD', 1409: 'NZD', '80a': 'MXN', 416: 'BRL', 'c04': 'HKD', 1004: 'SGD', '240a': 'COP', '1c0a': 'DOP', '2c0a': 'ARS', '340a': 'CLP',
};

const codes = new Set<string>(CURRENCIES);
let ownSymbols: Map<string, string> | undefined;

/** The symbol Office In 1 writes in an Excel format code: one per currency, so reading it back finds the same one. */
export function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat('en', { style: 'currency', currency: code }).formatToParts(1).find(p => p.type === 'currency')?.value;
    if (part) return part.replace(/ /g, ' ');
  } catch { /* unknown code */ }
  return code;
}

/** The short sign a cell shows ("$", "€", "CHF"). */
export function currencySign(code: string, lang: string): string {
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(1).find(p => p.type === 'currency')?.value ?? code;
  } catch { return code; }
}

/** The currency's name in the person's language ("dollar des États-Unis"). */
export function currencyName(code: string, lang: string): string {
  try { return new Intl.DisplayNames([lang], { type: 'currency' }).of(code) ?? code; } catch { return code; }
}

/** The currency a typed or pasted sign stands for, or undefined. */
export function currencyOfSymbol(sym: string): string | undefined {
  const s = sym.trim();
  if (BY_SYMBOL[s]) return BY_SYMBOL[s];
  const up = s.toUpperCase();
  if (codes.has(up)) return up;
  if (BY_SYMBOL[s.replace(/\.$/, '')]) return BY_SYMBOL[s.replace(/\.$/, '')];
  // The symbols Office In 1 writes itself ("F CFA", "MAD"…).
  ownSymbols ??= new Map(CURRENCIES.map(c => [currencySymbol(c), c]));
  return ownSymbols.get(s);
}

/** The currency an Excel number format code names ([$€-40C], "$", [$CA$], [$USD]…), or undefined. */
export function currencyOfCode(code: string): string | undefined {
  const first = code.split(';')[0];
  const br = first.match(/\[\$([^\]-]*)(?:-([0-9a-fA-F]+))?\]/);
  if (br) {
    const sym = br[1];
    if (sym === '$' && br[2]) return DOLLAR_LCID[br[2].toLowerCase()] ?? 'USD';
    if (sym) { const c = currencyOfSymbol(sym); if (c) return c; }
  }
  const quoted = first.match(/"([^"]+)"/g)?.map(q => q.slice(1, -1).trim()).find(q => currencyOfSymbol(q));
  if (quoted) return currencyOfSymbol(quoted);
  const bare = first.replace(/"[^"]*"|\[[^\]]*\]/g, '').match(/[$€£¥₹₩₽₺₴₪฿₱₫₦]/);
  return bare ? currencyOfSymbol(bare[0]) : undefined;
}

/** Signs a person can type before or after a number to make it money. */
export const MONEY_SIGN = /^(US\$|CA\$|C\$|A\$|AU\$|NZ\$|HK\$|S\$|MX\$|R\$|RD\$|CN¥|[$€£¥₹₩₽₺₴₪฿₱₫₦]|CHF|Fr\.?|zł|Kč|Ft|FCFA|CFA|HTG|Gdes|[A-Z]{3})$/;
