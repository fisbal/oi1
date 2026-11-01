// Bouclier, part 2: is this link a trap? Instant, offline checks first (the tricks phishing kits use), then the
// world lists of dangerous sites, updated every day (feed.ts). Sources: APWG Phishing Activity Trends; Google Safe
// Browsing and Microsoft SmartScreen documentation; Unicode TR #39 (confusable characters, homographs);
// CISA / ANSSI / Centre canadien pour la cybersécurité advice on phishing links.
import type { Finding, Level } from './scan';
import { worst } from './scan';

export interface LinkVerdict { url: string; host: string; level: Level; findings: Finding[] }

// Brands copied most often by phishing pages (APWG, Check Point brand phishing reports), with their real domains.
export const BRANDS: Record<string, string[]> = {
  paypal: ['paypal.com', 'paypal.me'], microsoft: ['microsoft.com', 'live.com', 'office.com', 'outlook.com', 'microsoftonline.com', 'office365.com', 'azure.com', 'xbox.com', 'windows.com', 'bing.com', 'msn.com'],
  office: ['office.com', 'microsoft.com'], outlook: ['outlook.com', 'live.com', 'office.com'], apple: ['apple.com', 'icloud.com'], icloud: ['icloud.com', 'apple.com'],
  google: ['google.com', 'gmail.com', 'youtube.com', 'google.ca', 'google.fr', 'googleusercontent.com', 'goo.gl', 'g.co'], gmail: ['gmail.com', 'google.com'],
  amazon: ['amazon.com', 'amazon.ca', 'amazon.fr', 'amazon.de', 'amazon.es', 'amazon.co.uk', 'amazonaws.com', 'amzn.to'], netflix: ['netflix.com'], facebook: ['facebook.com', 'fb.com', 'fb.me', 'meta.com'],
  instagram: ['instagram.com'], whatsapp: ['whatsapp.com', 'wa.me'], linkedin: ['linkedin.com', 'lnkd.in'], dhl: ['dhl.com', 'dhl.de', 'dhl.fr', 'dhl.ca'], fedex: ['fedex.com'], ups: ['ups.com'],
  postescanada: ['canadapost-postescanada.ca', 'canadapost.ca', 'postescanada.ca'], canadapost: ['canadapost-postescanada.ca', 'canadapost.ca'], laposte: ['laposte.fr', 'laposte.net'], colissimo: ['colissimo.fr', 'laposte.fr'],
  chronopost: ['chronopost.fr'], usps: ['usps.com'], dropbox: ['dropbox.com'], docusign: ['docusign.com', 'docusign.net'], adobe: ['adobe.com'], github: ['github.com', 'github.io', 'githubusercontent.com'],
  binance: ['binance.com'], coinbase: ['coinbase.com'], metamask: ['metamask.io'], ledger: ['ledger.com'], steam: ['steampowered.com', 'steamcommunity.com'], roblox: ['roblox.com'],
  desjardins: ['desjardins.com'], rbc: ['rbc.com', 'rbcroyalbank.com'], bmo: ['bmo.com'], scotiabank: ['scotiabank.com'], tdbank: ['td.com', 'tdbank.com'], cibc: ['cibc.com'], interac: ['interac.ca'],
  canada: ['canada.ca', 'gc.ca'], arc: ['canada.ca'], cra: ['canada.ca'], ameli: ['ameli.fr'], impots: ['impots.gouv.fr', 'gouv.fr'], caf: ['caf.fr'], antai: ['antai.gouv.fr', 'gouv.fr'], franceconnect: ['franceconnect.gouv.fr', 'gouv.fr'],
  creditagricole: ['credit-agricole.fr', 'credit-agricole.com'], bnpparibas: ['bnpparibas', 'bnpparibas.com', 'mabanque.bnpparibas'], societegenerale: ['societegenerale.fr', 'societegenerale.com'], labanquepostale: ['labanquepostale.fr'],
  chase: ['chase.com'], wellsfargo: ['wellsfargo.com'], bankofamerica: ['bankofamerica.com'], santander: ['santander.com', 'santander.es', 'santander.co.uk'], ing: ['ing.com', 'ing.de', 'ing.es', 'ing.fr'],
  sparkasse: ['sparkasse.de'], postbank: ['postbank.de'], caixabank: ['caixabank.es'], bbva: ['bbva.es', 'bbva.com'], itau: ['itau.com.br'], bradesco: ['bradesco.com.br'], nubank: ['nubank.com.br'],
  mercadolibre: ['mercadolibre.com', 'mercadolivre.com.br'], correos: ['correos.es'], ctt: ['ctt.pt'], visa: ['visa.com'], mastercard: ['mastercard.com'], americanexpress: ['americanexpress.com', 'amex.com'],
  wetransfer: ['wetransfer.com'], onedrive: ['onedrive.live.com', 'live.com', 'microsoft.com'], sharepoint: ['sharepoint.com', 'microsoft.com'], yahoo: ['yahoo.com'], orange: ['orange.fr', 'orange.com'],
  free: ['free.fr'], sfr: ['sfr.fr'], bouygues: ['bouyguestelecom.fr'], bell: ['bell.ca'], rogers: ['rogers.com'], telus: ['telus.com'], vinted: ['vinted.fr', 'vinted.com'], leboncoin: ['leboncoin.fr'],
  claude: ['claude.ai', 'anthropic.com'], openai: ['openai.com', 'chatgpt.com'], chatgpt: ['chatgpt.com', 'openai.com'], officein1: ['fisbal.github.io'],
};

const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'rb.gy', 'ow.ly', 'shorturl.at', 'tiny.cc', 'buff.ly', 'rebrand.ly', 'bl.ink', 't.ly', 's.id', 'v.gd', 'qrco.de', 'shorturl.gg', 'urlz.fr', 'lnkd.in', 'amzn.to'];
// Top-level domains with the highest share of abuse (Spamhaus "most abused TLDs", Interisle Phishing Landscape).
const RISKY_TLDS = ['zip', 'mov', 'top', 'xyz', 'click', 'country', 'gq', 'tk', 'ml', 'cf', 'ga', 'work', 'support', 'rest', 'cam', 'icu', 'buzz', 'monster', 'cyou', 'sbs', 'cfd', 'lol', 'quest', 'bond', 'beauty', 'hair', 'skin', 'makeup', 'boats', 'autos', 'loan', 'win', 'bid', 'kim', 'men', 'date', 'review', 'party', 'science', 'trade', 'webcam', 'stream', 'gdn', 'ru.com'];
const LURE_WORDS = /(log-?in|sign-?in|verif|secure|account|update|confirm|unlock|suspend|wallet|password|passwd|banking|billing|invoice|refund|rembours|remboll|colis|livraison|parcel|delivery|paiement|payment|factura|fatura|konto|anmeld)/i;
const SECOND_LEVEL = new Set(['co', 'com', 'net', 'org', 'gov', 'gouv', 'ac', 'edu', 'qc', 'on', 'bc']);

/** "login.secure.paypal.com" -> "paypal.com"; "a.b.co.uk" -> "b.co.uk" (enough for warnings, no full Public Suffix List). */
export function siteOf(host: string): string {
  const p = host.split('.');
  if (p.length <= 2) return host;
  const n = SECOND_LEVEL.has(p[p.length - 2]) && p[p.length - 1].length === 2 ? 3 : 2;
  return p.slice(-n).join('.');
}

const unconfuse = (s: string) => s.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/8/g, 'b').replace(/\$/g, 's').replace(/[-_.]/g, '');

function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

const ownedBy = (host: string, domains: string[]) => domains.some(d => host === d || host.endsWith(`.${d}`));
export const isKnownSite = (host: string) => Object.values(BRANDS).some(ds => ownedBy(host, ds));

/** Instant checks, no network. */
export function checkLink(raw: string, shownText?: string): LinkVerdict {
  const out: Finding[] = [];
  const trimmed = raw.trim();
  const scheme = trimmed.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase() ?? '';
  if (['javascript', 'vbscript', 'data', 'file', 'ms-msdt', 'search-ms', 'ms-officecmd'].includes(scheme)) {
    return { url: trimmed, host: '', level: 'danger', findings: [{ level: 'danger', code: 'scheme', detail: scheme }] };
  }
  let u: URL;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`); } catch { return { url: trimmed, host: '', level: 'ok', findings: [] }; }
  if (!/^https?:$/.test(u.protocol)) return { url: trimmed, host: '', level: 'ok', findings: [] };
  const host = u.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  const site = siteOf(host);
  const known = isKnownSite(host);
  if (u.protocol === 'http:' && !/^(localhost|127\.|192\.168\.|10\.)/.test(host)) out.push({ level: 'info', code: 'http' });
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) out.push({ level: 'warn', code: 'ip' });
  if (u.username || u.password || /^https?:\/\/[^/]*@/i.test(trimmed)) out.push({ level: 'danger', code: 'userinfo' });
  if (host.split('.').some(l => l.startsWith('xn--'))) out.push({ level: 'warn', code: 'punycode' });
  if (SHORTENERS.includes(host)) out.push({ level: 'info', code: 'shortener' });
  const tld = host.split('.').pop() ?? '';
  if (RISKY_TLDS.includes(tld)) out.push({ level: 'info', code: 'tld', detail: `.${tld}` });
  if (host.split('.').length > 5 || host.length > 60) out.push({ level: 'info', code: 'longHost' });
  if (!known) {
    // A brand in the name but not the brand's own site: paypal.com.secure-login.xyz, amazon-refund.top…
    const flat = unconfuse(host);
    for (const [brand, domains] of Object.entries(BRANDS)) {
      if (brand.length < 4) continue;
      const label = unconfuse(site.split('.')[0]);
      if (flat.includes(brand) && !ownedBy(host, domains)) { out.push({ level: 'danger', code: 'brand', detail: domains[0] }); break; }
      if (label !== brand && label.length >= 5 && editDistance(label, brand) <= (brand.length > 7 ? 2 : 1)) { out.push({ level: 'danger', code: 'lookalike', detail: domains[0] }); break; }
    }
    if (LURE_WORDS.test(host) || (LURE_WORDS.test(u.pathname) && out.length)) out.push({ level: 'info', code: 'lure' });
  }
  if (shownText) {
    const m = shownText.trim().match(/^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]|$)/i);
    if (m) {
      const shown = m[1].toLowerCase().replace(/^www\./, '');
      if (siteOf(shown) !== site) out.push({ level: 'danger', code: 'textMismatch', detail: shown });
    }
  }
  // Several small signs together are worth a warning.
  const infos = out.filter(f => f.level === 'info').length;
  if (infos >= 3 && worst(out) === 'info') out.push({ level: 'warn', code: 'many' });
  return { url: u.href, host, level: worst(out), findings: out };
}

/** Every link written in a text (http…, www.…, and bare domains with a path). */
export function linksIn(text: string): string[] {
  const found = text.match(/\b(?:https?:\/\/|www\.)[^\s<>"')\]]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|info|xyz|top|click|ru|cn|tk|ml|ga|cf|gq|io|co|me|ly|fr|ca|de|es|pt|br|online|site|shop|live|app)\/[^\s<>"')\]]*/gi) ?? [];
  return [...new Set(found.map(s => s.replace(/[.,;:!?]+$/, '')))].slice(0, 200);
}
