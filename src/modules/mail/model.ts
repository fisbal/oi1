// In 1 Mail: mails, folders, contacts and a signature, kept on the device. No server and no password: a mail leaves
// through the person's own mail app (mailto), Gmail or Outlook on the web, or as a ready-to-send .eml file (with its
// attachments, opened as a new mail by Outlook, Apple Mail and Thunderbird). Received mails come in as .eml files.

let counter = 0;
export const newId = (p = 'm') => `${p}${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const FOLDERS = ['inbox', 'drafts', 'sent', 'templates', 'starred', 'trash'] as const;
export type Folder = typeof FOLDERS[number];
export interface Attachment { name: string; type: string; size: number; data: string /* base64 */ }
export interface Mail {
  id: string; folder: Exclude<Folder, 'starred'>; from: string; to: string[]; cc: string[]; bcc: string[];
  subject: string; html: string; at: string; read: boolean; star: boolean; labels: string[]; attachments: Attachment[];
}
export interface Contact { id: string; name: string; email: string; group: string }
export interface MailBox { v: 1; me: { name: string; email: string }; signature: string; mails: Mail[]; contacts: Contact[] }

export const LABELS: { id: string; color: string }[] = [
  { id: 'work', color: '#1E88E5' }, { id: 'personal', color: '#43A047' }, { id: 'family', color: '#F4511E' }, { id: 'urgent', color: '#E53935' },
  { id: 'todo', color: '#FB8C00' }, { id: 'waiting', color: '#8E24AA' }, { id: 'invoice', color: '#00897B' }, { id: 'travel', color: '#039BE5' },
  { id: 'school', color: '#3949AB' }, { id: 'client', color: '#6D4C41' }, { id: 'project', color: '#5E35B1' }, { id: 'bank', color: '#546E7A' },
  { id: 'health', color: '#D81B60' }, { id: 'home', color: '#7CB342' }, { id: 'shopping', color: '#F9A825' }, { id: 'event', color: '#C0CA33' },
  { id: 'news', color: '#757575' }, { id: 'legal', color: '#37474F' }, { id: 'admin', color: '#0097A7' }, { id: 'friends', color: '#EC407A' },
  { id: 'later', color: '#9E9E9E' }, { id: 'important', color: '#B71C1C' },
];

export function newMail(folder: Mail['folder'] = 'drafts', patch: Partial<Mail> = {}): Mail {
  return { id: newId(), folder, from: '', to: [], cc: [], bcc: [], subject: '', html: '<p></p>', at: new Date().toISOString(), read: true, star: false, labels: [], attachments: [], ...patch };
}
export const newBox = (): MailBox => ({ v: 1, me: { name: '', email: '' }, signature: '', mails: [], contacts: [] });

const str = (x: unknown, d = '') => (typeof x === 'string' ? x : d);
const strs = (x: unknown) => (Array.isArray(x) ? x.filter(s => typeof s === 'string').map(s => String(s).slice(0, 320)) : []);
export function cleanMail(x: unknown): Mail | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const folder = (['inbox', 'drafts', 'sent', 'templates', 'trash'] as string[]).includes(o.folder as string) ? o.folder as Mail['folder'] : 'drafts';
  const att = (Array.isArray(o.attachments) ? o.attachments : []).map(a => {
    const y = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
    return { name: str(y.name, 'file').slice(0, 200), type: str(y.type, 'application/octet-stream'), size: typeof y.size === 'number' ? y.size : 0, data: str(y.data) };
  }).filter(a => a.data);
  return newMail(folder, {
    id: str(o.id) || newId(), from: str(o.from).slice(0, 320), to: strs(o.to), cc: strs(o.cc), bcc: strs(o.bcc), subject: str(o.subject).slice(0, 500),
    html: str(o.html, '<p></p>'), at: str(o.at) || new Date().toISOString(), read: o.read !== false, star: !!o.star, labels: strs(o.labels), attachments: att,
  });
}
export function cleanBox(x: unknown): MailBox {
  const base = newBox();
  if (!x || typeof x !== 'object') return base;
  const o = x as Record<string, unknown>;
  const me = (o.me && typeof o.me === 'object' ? o.me : {}) as Record<string, unknown>;
  return {
    v: 1, me: { name: str(me.name).slice(0, 200), email: str(me.email).slice(0, 320) }, signature: str(o.signature).slice(0, 20000),
    mails: (Array.isArray(o.mails) ? o.mails : []).map(cleanMail).filter((m): m is Mail => !!m).slice(0, 5000),
    contacts: (Array.isArray(o.contacts) ? o.contacts : []).map(c => {
      const y = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
      return { id: str(y.id) || newId('c'), name: str(y.name).slice(0, 200), email: str(y.email).slice(0, 320), group: str(y.group).slice(0, 100) };
    }).filter(c => c.email).slice(0, 10000),
  };
}

const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]{2,}$/;
/** The e-mail address inside "Name <a@b.c>" or "a@b.c". */
export const addressOf = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim();
export const validAddress = (s: string) => EMAIL.test(addressOf(s));
/** Several addresses typed in one box, split on commas, semicolons, new lines (or spaces between plain addresses).
 *  A wrong address is kept as typed, so the person sees it flagged instead of losing it. */
export function splitAddresses(s: string): string[] {
  const parts: string[] = [];
  let cur = '', quote = false, angle = false;
  for (const ch of s) {
    if (ch === '"') quote = !quote;
    else if (ch === '<' && !quote) angle = true;
    else if (ch === '>' && !quote) angle = false;
    if (!quote && !angle && (ch === ',' || ch === ';' || ch === '\n')) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts.map(p => p.trim()).filter(Boolean).flatMap(p => (!p.includes('<') && /\s/.test(p) && p.split(/\s+/).every(w => w.includes('@')) ? p.split(/\s+/) : [p]));
}

/** The text of an HTML mail, for mailto links, previews and the AI. */
export function textOf(html: string): string {
  const d = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h\d|li|tr)>/gi, '$&\n'), 'text/html');
  d.querySelectorAll('li').forEach(li => li.prepend('• '));
  return (d.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Opens the mail in the person's own mail app. Long mails are cut (mailto links have a size limit). */
export function mailtoUrl(m: Mail): string {
  const q: string[] = [];
  if (m.cc.length) q.push(`cc=${encodeURIComponent(m.cc.map(addressOf).join(','))}`);
  if (m.bcc.length) q.push(`bcc=${encodeURIComponent(m.bcc.map(addressOf).join(','))}`);
  if (m.subject) q.push(`subject=${encodeURIComponent(m.subject)}`);
  let body = textOf(m.html);
  if (body.length > 1800) body = `${body.slice(0, 1800)}…`;
  if (body) q.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${m.to.map(a => encodeURIComponent(addressOf(a)).replace(/%40/g, '@')).join(',')}${q.length ? `?${q.join('&')}` : ''}`;
}
export function gmailUrl(m: Mail): string {
  const p = new URLSearchParams({ view: 'cm', fs: '1', to: m.to.map(addressOf).join(','), su: m.subject, body: textOf(m.html).slice(0, 6000) });
  if (m.cc.length) p.set('cc', m.cc.map(addressOf).join(','));
  if (m.bcc.length) p.set('bcc', m.bcc.map(addressOf).join(','));
  return `https://mail.google.com/mail/?${p}`;
}
export function outlookUrl(m: Mail): string {
  const p = new URLSearchParams({ to: m.to.map(addressOf).join(','), subject: m.subject, body: textOf(m.html).slice(0, 6000) });
  if (m.cc.length) p.set('cc', m.cc.map(addressOf).join(','));
  return `https://outlook.office.com/mail/deeplink/compose?${p}`;
}

// ---------- .eml (RFC 5322 / MIME) ----------
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const wrap76 = (s: string) => s.replace(/.{1,76}/g, '$&\r\n').trimEnd();
const hdr = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const hdrAddr = (a: string) => { const m = a.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/); return m && m[1] ? `${hdr(m[1])} <${m[2]}>` : addressOf(a); };

/** A ready-to-send .eml: Outlook opens it as a new mail (X-Unsent), with the HTML, a text copy and the attachments. */
export function toEml(m: Mail, from: string): string {
  const mixed = `=_mix_${m.id}`, alt = `=_alt_${m.id}`;
  const lines = [
    `From: ${from ? hdrAddr(from) : ''}`, `To: ${m.to.map(hdrAddr).join(', ')}`,
    ...(m.cc.length ? [`Cc: ${m.cc.map(hdrAddr).join(', ')}`] : []), ...(m.bcc.length ? [`Bcc: ${m.bcc.map(hdrAddr).join(', ')}`] : []),
    `Subject: ${hdr(m.subject)}`, `Date: ${new Date(m.at).toUTCString()}`, 'MIME-Version: 1.0', 'X-Unsent: 1', 'X-Mailer: In 1 Mail (Office In 1)',
    `Content-Type: multipart/mixed; boundary="${mixed}"`, '',
    `--${mixed}`, `Content-Type: multipart/alternative; boundary="${alt}"`, '',
    `--${alt}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(b64(textOf(m.html))), '',
    `--${alt}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(b64(`<!doctype html><html><body>${m.html}</body></html>`)), '',
    `--${alt}--`, '',
  ];
  for (const a of m.attachments) {
    lines.push(`--${mixed}`, `Content-Type: ${a.type || 'application/octet-stream'}; name="${hdr(a.name)}"`, 'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${hdr(a.name)}"`, '', wrap76(a.data), '');
  }
  lines.push(`--${mixed}--`, '');
  return lines.join('\r\n');
}

const decoder = (charset: string) => { try { return new TextDecoder(charset || 'utf-8'); } catch { return new TextDecoder('utf-8'); } };
const bytesOf = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0) & 255);
function decodeWords(s: string): string {
  return s.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=(\s+(?==\?))?/g, (_, cs: string, enc: string, txt: string) => {
    try {
      const raw = enc.toUpperCase() === 'B' ? atob(txt) : txt.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
      return decoder(cs).decode(bytesOf(raw));
    } catch { return txt; }
  });
}
function headersOf(block: string): Record<string, string> {
  const h: Record<string, string> = {};
  for (const line of block.replace(/\r\n/g, '\n').replace(/\n[ \t]+/g, ' ').split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) h[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return h;
}
const param = (v: string, name: string) => v.match(new RegExp(`${name}\\*?=(?:"([^"]*)"|([^;\\s]+))`, 'i'))?.slice(1).find(Boolean) ?? '';
function bodyText(body: string, h: Record<string, string>): string {
  const enc = (h['content-transfer-encoding'] ?? '').toLowerCase();
  const cs = param(h['content-type'] ?? '', 'charset');
  let raw = body;
  if (enc === 'base64') { try { raw = atob(body.replace(/\s+/g, '')); } catch { raw = body; } }
  else if (enc === 'quoted-printable') raw = body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_m, x: string) => String.fromCharCode(parseInt(x, 16)));
  else return body;
  return decoder(cs).decode(bytesOf(raw));
}
interface Part { h: Record<string, string>; body: string }
function parts(block: string): Part[] {
  const sep = block.search(/\r?\n\r?\n/);
  const h = headersOf(sep < 0 ? block : block.slice(0, sep));
  const body = sep < 0 ? '' : block.slice(sep).replace(/^\r?\n\r?\n/, '');
  const ct = h['content-type'] ?? 'text/plain';
  if (/^multipart\//i.test(ct)) {
    const b = param(ct, 'boundary');
    if (!b) return [{ h, body }];
    return body.split(`--${b}`).slice(1).filter(p => !p.startsWith('--')).flatMap(p => parts(p.replace(/^\r?\n/, '')));
  }
  return [{ h, body }];
}
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A received mail from an .eml file. The HTML is NOT cleaned here: show it only through safeHtml. */
export function fromEml(text: string): Mail {
  const all = parts(text);
  const top = headersOf(text.slice(0, Math.max(0, text.search(/\r?\n\r?\n/))));
  let html = '', plain = '';
  const attachments: Attachment[] = [];
  for (const p of all) {
    const ct = (p.h['content-type'] ?? 'text/plain').toLowerCase();
    const disp = (p.h['content-disposition'] ?? '').toLowerCase();
    const name = decodeWords(param(p.h['content-disposition'] ?? '', 'filename') || param(p.h['content-type'] ?? '', 'name'));
    if (disp.startsWith('attachment') || (name && !ct.startsWith('text/'))) {
      const enc = (p.h['content-transfer-encoding'] ?? '').toLowerCase();
      const data = enc === 'base64' ? p.body.replace(/\s+/g, '') : btoa(p.body);
      attachments.push({ name: name || 'file', type: ct.split(';')[0], size: Math.round((data.length * 3) / 4), data });
    } else if (ct.startsWith('text/html') && !html) html = bodyText(p.body, p.h);
    else if (ct.startsWith('text/plain') && !plain) plain = bodyText(p.body, p.h);
  }
  if (!html) html = plain.split(/\r?\n\r?\n/).map(par => `<p>${escapeHtml(par).replace(/\r?\n/g, '<br>')}</p>`).join('') || '<p></p>';
  else html = html.replace(/^[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '');
  const list = (v?: string) => (v ? splitAddresses(decodeWords(v)) : []);
  const date = top.date ? new Date(top.date) : new Date();
  return newMail('inbox', {
    from: decodeWords(top.from ?? ''), to: list(top.to), cc: list(top.cc), subject: decodeWords(top.subject ?? ''), html,
    at: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(), read: false, attachments,
  });
}

/** Mail merge: {{Field}} replaced by the person's value (case and spaces ignored in the name). */
export function merge(text: string, row: Record<string, string>): string {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, '').toLowerCase();
  const map = new Map(Object.entries(row).map(([k, v]) => [norm(k), v]));
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (all, k: string) => map.get(norm(k)) ?? all);
}
export const fieldsIn = (text: string) => [...new Set([...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map(m => m[1]))];

/** Contacts from a CSV (name, e-mail, group columns in any order) or a vCard file. */
export function contactsFrom(text: string): Contact[] {
  const out: Contact[] = [];
  if (/BEGIN:VCARD/i.test(text)) {
    for (const card of text.split(/END:VCARD/i)) {
      const fn = card.match(/^FN[^:]*:(.+)$/im)?.[1]?.trim() ?? '';
      for (const m of card.matchAll(/^EMAIL[^:]*:(.+)$/gim)) out.push({ id: newId('c'), name: fn, email: m[1].trim(), group: '' });
    }
    return out.filter(c => validAddress(c.email));
  }
  const rows = text.split(/\r?\n/).filter(Boolean).map(l => l.split(/[;,\t]/).map(c => c.replace(/^"|"$/g, '').trim()));
  if (!rows.length) return out;
  const head = rows[0].map(h => h.toLowerCase());
  const has = head.some(h => /mail|courriel|correo/.test(h));
  const ie = has ? head.findIndex(h => /mail|courriel|correo/.test(h)) : rows[0].findIndex(c => validAddress(c));
  const iname = head.findIndex(h => /name|nom|nombre|nome/.test(h));
  const igroup = head.findIndex(h => /group|groupe|grupo|gruppe/.test(h));
  for (const r of has ? rows.slice(1) : rows) {
    const email = r[ie >= 0 ? ie : r.findIndex(c => validAddress(c))] ?? '';
    if (validAddress(email)) out.push({ id: newId('c'), name: iname >= 0 ? r[iname] ?? '' : r.find(c => c && !validAddress(c)) ?? '', email, group: igroup >= 0 ? r[igroup] ?? '' : '' });
  }
  return out;
}

export function toVcf(list: Contact[]): string {
  return list.map(c => ['BEGIN:VCARD', 'VERSION:3.0', `FN:${c.name || c.email}`, `EMAIL;TYPE=INTERNET:${c.email}`, ...(c.group ? [`CATEGORIES:${c.group}`] : []), 'END:VCARD'].join('\r\n')).join('\r\n');
}

/** A short line for the list: the start of the text. */
export const preview = (m: Mail) => textOf(m.html).replace(/\s+/g, ' ').slice(0, 140);
export const sizeText = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
