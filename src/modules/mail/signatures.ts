// In 1 Mail signatures (Martin, 2026-11-03): several (Pro, Perso…), each with name, title, company, contacts, a logo
// and the handwritten signature made in Office In 1, in 20 looks, added by itself to new mails (and replies, if
// wanted). Made of paragraphs, links, colours and pictures only, so every mail program shows it the same way.

export interface MailSig {
  id: string;
  label: string;
  name: string; title: string; company: string;
  phone: string; email: string; web: string; address: string;
  /** Data URLs (PNG/JPEG), kept with the mailbox on this device. */
  logo?: string;
  hand?: string; handW?: number; handH?: number;
  /** 0..19: one of the 20 looks. */
  look: number;
}

export const SIG_LOOKS = 20;
const ACCENTS = ['#1f3fbf', '#2e7d32', '#a8740b', '#444444'];
/** The 5 arrangements × 4 accent colours, by name for the gallery. */
export const lookArrangement = (look: number) => Math.floor((look % SIG_LOOKS) / 4);
export const lookAccent = (look: number) => ACCENTS[look % 4];

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const span = (text: string, style: string) => `<span style="${style}">${esc(text)}</span>`;
const href = (s: MailSig, kind: 'phone' | 'email' | 'web') => {
  const v = s[kind].trim();
  if (!v) return '';
  const url = kind === 'phone' ? `tel:${v.replace(/[^\d+]/g, '')}` : kind === 'email' ? `mailto:${v}` : /^https?:\/\//i.test(v) ? v : `https://${v}`;
  return `<a href="${esc(url)}">${esc(v)}</a>`;
};

/** The signature as mail HTML. */
export function sigHtml(s: MailSig): string {
  const a = lookAccent(s.look);
  const arr = lookArrangement(s.look);
  const hand = s.hand ? `<p><img src="${esc(s.hand)}" alt="${esc(s.name)}" width="${Math.min(200, s.handW ?? 180)}"></p>` : '';
  const logo = s.logo ? `<p><img src="${esc(s.logo)}" alt="${esc(s.company || s.name)}" width="120"></p>` : '';
  const role = [s.title, s.company].filter(Boolean).join(' · ');
  const contacts = [href(s, 'phone'), href(s, 'email'), href(s, 'web')].filter(Boolean);
  const name = s.name ? `<p><strong>${span(s.name, `color: ${a}; font-size: 16px`)}</strong></p>` : '';
  const roleP = role ? `<p>${span(role, 'color: #555555')}</p>` : '';
  const addr = s.address ? `<p>${span(s.address, 'color: #777777; font-size: 12px')}</p>` : '';
  switch (arr) {
    case 1: // one line, compact
      return `<p>${s.name ? `<strong>${span(s.name, `color: ${a}`)}</strong>` : ''}${role ? ` · ${span(role, 'color: #555555')}` : ''}${contacts.length ? ` · ${contacts.join(' · ')}` : ''}</p>${hand}${logo}`;
    case 2: // logo first
      return `${logo}${name}${roleP}${contacts.length ? `<p>${contacts.join(' | ')}</p>` : ''}${addr}${hand}`;
    case 3: // handwritten signature first
      return `${hand}${name}${roleP}${contacts.map(c => `<p>${c}</p>`).join('')}${addr}${logo}`;
    case 4: // a coloured line, the name in capitals
      return `<p>${span('━━━━━━━━━━', `color: ${a}`)}</p>${hand}${s.name ? `<p><strong>${span(s.name.toUpperCase(), `color: ${a}; letter-spacing: 1px`)}</strong></p>` : ''}${roleP}${contacts.length ? `<p>${contacts.join(' · ')}</p>` : ''}${addr}${logo}`;
    default: // classic
      return `${hand}${name}${roleP}${contacts.length ? `<p>${contacts.join(' | ')}</p>` : ''}${addr}${logo}`;
  }
}

/** What goes at the end of a new mail (or a reply): the chosen signature, or the older one-text signature. */
export function sigFor(box: { signature: string; sigs?: MailSig[]; sigNew?: string; sigReply?: string }, reply = false): string {
  const id = reply ? box.sigReply : box.sigNew;
  const s = box.sigs?.find(x => x.id === id) ?? (!reply && box.sigs?.length && id === undefined ? box.sigs[0] : undefined);
  if (s) return sigHtml(s);
  if (reply || box.sigs?.length) return '';
  return box.signature ? `<p>--</p>${box.signature}` : '';
}

export function cleanSig(x: unknown): MailSig | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
  const img = (v: unknown) => (typeof v === 'string' && /^data:image\/(png|jpeg|gif|webp);base64,/.test(v) && v.length < 600_000 ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  return {
    id: str(o.id, 60) || `s-${Math.random().toString(36).slice(2, 9)}`, label: str(o.label, 60) || 'Signature',
    name: str(o.name), title: str(o.title), company: str(o.company), phone: str(o.phone, 60), email: str(o.email, 320), web: str(o.web), address: str(o.address),
    logo: img(o.logo), hand: img(o.hand), handW: num(o.handW), handH: num(o.handH),
    look: Math.max(0, Math.min(SIG_LOOKS - 1, Math.round(num(o.look) ?? 0))),
  };
}
