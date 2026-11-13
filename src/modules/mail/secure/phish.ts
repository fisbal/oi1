// In 1 Mail's phishing guard: every received mail is checked on the device, nothing is sent anywhere.
// The signs come from the best references on mail fraud: Anti-Phishing Working Group (APWG) trends reports, CISA /
// NCSC phishing guidance, Google's and Microsoft's own mail warnings, Unicode TR #39 (look-alike characters),
// RFC 8601 (Authentication-Results: SPF RFC 7208, DKIM RFC 6376, DMARC RFC 7489) and the attachment types blocked by
// Outlook and Gmail. A warning explains itself in plain words; the person always decides.

export type Level = 'danger' | 'warn' | 'info';
export interface Warn { level: Level; code: string; detail?: string }

const lower = (s: string) => s.toLowerCase();
export const domainOf = (addr: string) => lower((addr.match(/<([^>]+)>/)?.[1] ?? addr).trim().split('@')[1] ?? '').replace(/[>\s]/g, '');
/** The registrable part, good enough for comparisons: "mail.paypal.co.uk" -> "paypal.co.uk", "a.b.example.com" -> "example.com". */
export function baseDomain(host: string): string {
  const h = lower(host).replace(/\.$/, '').split('.');
  if (h.length <= 2) return h.join('.');
  const two = h.slice(-2).join('.');
  return /^(co|com|org|net|gov|gouv|ac|edu|qc)\.[a-z]{2}$/.test(two) ? h.slice(-3).join('.') : two;
}
const hostOf = (href: string) => { try { return new URL(href).hostname; } catch { return ''; } };

/** Brands most imitated in phishing (APWG, Canadian Anti-Fraud Centre), with their real domains. */
const BRANDS: Record<string, string[]> = {
  paypal: ['paypal.com', 'paypal.ca', 'paypal.fr'], apple: ['apple.com', 'icloud.com'], microsoft: ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'microsoftonline.com', 'hotmail.com'],
  google: ['google.com', 'gmail.com', 'youtube.com'], amazon: ['amazon.com', 'amazon.ca', 'amazon.fr', 'amazon.de'], netflix: ['netflix.com'], facebook: ['facebook.com', 'facebookmail.com', 'meta.com'],
  instagram: ['instagram.com', 'facebookmail.com'], desjardins: ['desjardins.com'], interac: ['interac.ca'], 'canada post': ['canadapost.ca', 'canadapost-postescanada.ca'], 'postes canada': ['canadapost.ca', 'canadapost-postescanada.ca'],
  'revenu québec': ['revenuquebec.ca'], 'revenu quebec': ['revenuquebec.ca'], 'agence du revenu': ['canada.ca', 'cra-arc.gc.ca'], 'canada revenue': ['canada.ca', 'cra-arc.gc.ca'],
  dhl: ['dhl.com', 'dhl.ca'], fedex: ['fedex.com'], ups: ['ups.com'], rbc: ['rbc.com', 'rbcroyalbank.com'], td: ['td.com', 'tdbank.com'], bnc: ['bnc.ca'], 'banque nationale': ['bnc.ca'],
  scotiabank: ['scotiabank.com'], bmo: ['bmo.com'], hydro: ['hydroquebec.com'], 'hydro-québec': ['hydroquebec.com'], 'la poste': ['laposte.fr', 'laposte.net'], ameli: ['ameli.fr'],
  dropbox: ['dropbox.com', 'dropboxmail.com'], docusign: ['docusign.com', 'docusign.net'], linkedin: ['linkedin.com'], ebay: ['ebay.com', 'ebay.ca'], visa: ['visa.com', 'visa.ca'], mastercard: ['mastercard.com'],
};
const KNOWN = [...new Set(Object.values(BRANDS).flat())];
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'cutt.ly', 'rebrand.ly', 'buff.ly', 'shorturl.at', 'rb.gy', 't.ly', 'tiny.cc', 'lnkd.in', 's.id'];
/** Run code or hide what they are: Outlook's and Gmail's blocked list, plus macro documents and disk images. */
const DANGER_EXT = ['exe', 'scr', 'com', 'pif', 'bat', 'cmd', 'msi', 'msix', 'appx', 'js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'hta', 'ps1', 'psm1', 'jar', 'lnk', 'reg', 'cpl', 'dll', 'iso', 'img', 'vhd', 'vhdx', 'apk', 'docm', 'xlsm', 'pptm', 'dotm', 'xlam', 'one', 'chm', 'scf', 'url', 'library-ms', 'svg'];
const PRESSURE = [
  /\b(urgent|immediately|within 24 hours|final notice|account (?:is )?(?:suspended|locked|disabled)|verify your (?:account|identity)|unusual (?:sign-in|activity)|password (?:expires|expired)|confirm your (?:payment|details)|gift ?cards?|wire transfer|bitcoin|crypto|you have won|refund (?:is )?pending|payment failed|update your billing)\b/i,
  /\b(urgent|immédiatement|dans les 24 ?h|dernier avis|compte (?:suspendu|bloqué|désactivé)|vérifie[rz] votre (?:compte|identité)|activité inhabituelle|mot de passe (?:expire|expiré)|confirme[rz] votre (?:paiement|identité)|cartes?[- ]cadeaux?|virement|bitcoin|crypto|vous avez gagné|remboursement en attente|paiement (?:refusé|échoué)|mettre à jour vos informations)\b/i,
];

/** Damerau-free Levenshtein, small strings only. */
function dist(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** "paypa1.com", "rnicrosoft.com", "xn--pypal-4ve.com" pretend to be a known domain (Unicode TR #39 skeletons, simplified). */
export function lookalike(host: string): string | null {
  const base = baseDomain(host);
  if (!base || KNOWN.includes(base)) return null;
  if (/(^|\.)xn--/.test(lower(host))) return 'punycode';
  const skel = base.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/0/g, 'o').replace(/1|l|!/g, 'l').replace(/5/g, 's').replace(/3/g, 'e').replace(/\$/g, 's');
  for (const k of KNOWN) {
    const ks = k.replace(/1|l/g, 'l');
    if (skel === ks || (k.split('.')[0].length >= 6 && dist(base.split('.')[0], k.split('.')[0]) === 1 && base.split('.').slice(1).join('.') === k.split('.').slice(1).join('.'))) return k;
    // "paypal.com.secure-login.net", "paypal-secure.com": the brand inside someone else's domain
    const name = k.split('.')[0];
    if (lower(host).includes(`${k}.`) || (name.length >= 5 && new RegExp(`(^|-)${name}-|-${name}(\\.|$)`).test(base))) return k;
  }
  return null;
}

export interface LinkCheck { href: string; host: string; level: Level | null; code: string }
/** One link: what it shows against where it really goes. */
export function checkLink(text: string, href: string): LinkCheck {
  const host = hostOf(href);
  const out = (level: Level | null, code: string): LinkCheck => ({ href, host, level, code });
  if (!host) return /^(javascript|data|vbscript|file):/i.test(href.trim()) ? out('danger', 'badScheme') : out(null, '');
  const shown = text.trim().match(/(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]\S*)?/i)?.[1];
  if (shown && /\./.test(shown) && !/\s/.test(text.trim()) && baseDomain(shown) !== baseDomain(host)) return out('danger', 'linkMismatch');
  const look = lookalike(host);
  if (look) return out('danger', 'lookalike');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return out('warn', 'ipLink');
  if (SHORTENERS.includes(lower(host))) return out('info', 'shortLink');
  if (/^http:/i.test(href) && /log ?in|sign ?in|connexion|password|mot de passe|account|compte|verify|vérif/i.test(href + text)) return out('warn', 'plainHttp');
  return out(null, '');
}

export interface Analysable {
  from: string; replyTo?: string; subject: string; html: string; auth?: string;
  attachments: { name: string; type: string }[];
}
const rank: Record<Level, number> = { danger: 3, warn: 2, info: 1 };
export const worst = (w: Warn[]): Level | null => w.reduce<Level | null>((a, x) => (!a || rank[x.level] > rank[a] ? x.level : a), null);

/** Everything suspicious about a received mail, worst first. `knownSenders` = contacts and people written to. */
export function analyse(m: Analysable, knownSenders: Set<string> = new Set()): Warn[] {
  const w: Warn[] = [];
  const addr = lower((m.from.match(/<([^>]+)>/)?.[1] ?? m.from).trim());
  const fromDomain = domainOf(m.from);
  // The name part only ("Name" <a@b.c>): compared, never shown as HTML.
  const lt = m.from.lastIndexOf('<');
  const display = lower((lt >= 0 ? m.from.slice(0, lt) : m.from).replace(/"/g, '').trim());

  // 1. The sender's own server said the mail is forged (RFC 8601).
  const auth = lower(m.auth ?? '');
  if (/\bdmarc=fail\b/.test(auth)) w.push({ level: 'danger', code: 'dmarcFail' });
  else if (/\b(spf=fail|dkim=fail)\b/.test(auth)) w.push({ level: 'warn', code: 'authFail' });

  // 2. The name shown pretends to be someone else.
  const shownAddr = display.match(/[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}/)?.[0];
  if (shownAddr && shownAddr !== addr) w.push({ level: 'danger', code: 'nameSpoof', detail: addr });
  else if (fromDomain) {
    for (const [brand, domains] of Object.entries(BRANDS)) {
      if (brand.length < 3) continue;
      const re = new RegExp(`(^|[^a-zà-ÿ])${brand.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}([^a-zà-ÿ]|$)`, 'i');
      if (re.test(display) && !domains.includes(baseDomain(fromDomain))) { w.push({ level: 'danger', code: 'brandSpoof', detail: `${brand} · ${fromDomain}` }); break; }
    }
  }
  const look = fromDomain && lookalike(fromDomain);
  if (look) w.push({ level: 'danger', code: 'lookalikeSender', detail: fromDomain });

  // 3. Answers would go somewhere else.
  const rt = m.replyTo ? domainOf(m.replyTo) : '';
  if (rt && fromDomain && baseDomain(rt) !== baseDomain(fromDomain)) w.push({ level: 'warn', code: 'replyTo', detail: rt });

  // 4. Links.
  let links = 0;
  if (typeof DOMParser !== 'undefined') {
    const d = new DOMParser().parseFromString(m.html, 'text/html');
    const seen = new Set<string>();
    for (const a of Array.from(d.querySelectorAll('a[href]'))) {
      const c = checkLink(a.textContent ?? '', a.getAttribute('href') ?? '');
      if (c.host) links++;
      if (c.level && !seen.has(c.code + c.host)) { seen.add(c.code + c.host); w.push({ level: c.level, code: c.code, detail: c.host || c.href.slice(0, 60) }); }
    }
    if (d.querySelector('form, input[type=password]')) w.push({ level: 'danger', code: 'formInMail' });
  }

  // 5. Attachments.
  for (const a of m.attachments) {
    const parts = lower(a.name).split('.');
    const ext = parts.length > 1 ? parts[parts.length - 1] : '';
    if (parts.length > 2 && DANGER_EXT.includes(ext) && /^(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|txt|zip)$/.test(parts[parts.length - 2])) w.push({ level: 'danger', code: 'doubleExt', detail: a.name });
    else if (DANGER_EXT.includes(ext)) w.push({ level: 'danger', code: 'dangerFile', detail: a.name });
    else if (/^(html?|shtml|xhtml)$/.test(ext)) w.push({ level: 'warn', code: 'htmlFile', detail: a.name });
    else if (/^(zip|rar|7z|gz|tar|cab)$/.test(ext) && /password|mot de passe|code/i.test(m.subject + m.html)) w.push({ level: 'warn', code: 'lockedZip', detail: a.name });
  }

  // 6. Pressure words, which matter most with links or a stranger.
  const bodyText = typeof DOMParser !== 'undefined' ? new DOMParser().parseFromString(m.html, 'text/html').body.textContent ?? '' : m.html;
  const text = `${m.subject}\n${bodyText}`;
  if (PRESSURE.some(re => re.test(text))) w.push({ level: links || w.length ? 'warn' : 'info', code: 'pressure' });

  // 7. First mail from this sender.
  if (addr && knownSenders.size && !knownSenders.has(addr)) w.push({ level: 'info', code: 'firstTime' });

  return w.sort((a, b) => rank[b.level] - rank[a.level]);
}

/** Remote pictures (tracking pixels tell the sender when and where the mail was opened) are held back until the person
 *  says so. The HTML must already be cleaned by safeHtml. */
export function blockRemote(html: string): { html: string; blocked: number } {
  if (typeof DOMParser === 'undefined') return { html, blocked: 0 };
  const d = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  let blocked = 0;
  d.querySelectorAll('img[src], image[href], source[srcset], img[srcset]').forEach(el => {
    for (const at of ['src', 'href', 'srcset']) {
      const v = el.getAttribute(at);
      if (v && !/^(data:|cid:|blob:)/i.test(v.trim())) { el.setAttribute(`data-oi1-${at}`, v); el.removeAttribute(at); blocked++; }
    }
  });
  d.querySelectorAll('[style]').forEach(el => {
    const s = el.getAttribute('style') ?? '';
    if (/url\(\s*['"]?(?!data:)/i.test(s)) { el.setAttribute('style', s.replace(/url\([^)]*\)/gi, 'none')); blocked++; }
  });
  d.querySelectorAll('[background]').forEach(el => { el.removeAttribute('background'); blocked++; });
  return { html: d.body.innerHTML, blocked };
}
