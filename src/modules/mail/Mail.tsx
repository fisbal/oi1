// In 1 Mail: write, read and organise mails on a computer, a tablet or a phone, with no account and no password.
// Folders, 22 labels, stars, search, contacts (CSV and vCard), a signature, 22 ready mails, rich text and attachments.
// A mail leaves through the person's own mail app, Gmail or Outlook on the web, or as a ready-to-send .eml file
// (with its attachments). Received mails come in as .eml files. Beyond the usual: mail merge (one personal mail per
// person, from contacts or an In 1 Class table), "Write with AI", "Reply with AI" and 22 tones, and documents from the
// other In 1 apps attached in one click. Everything stays on the device.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extensions';
import type { Handoff, OpenedFile, ShellApi, TableData } from '../../shell/contract';
import { getLanguage, t, type MessageKey } from '../../shell/i18n';
import { printWindow } from '../../shell/printWindow';
import { safeHtml } from '../../shell/safeHtml';
import { useLanguage } from '../../shell/useLanguage';
import { Btn, ColorGrid, Dialog, Drop, Group, Icon, RibbonToggle } from '../../ui/kit';
import { AppKeys, appColor } from '../../ui/AppKeys';
import { FileMenu } from '../../ui/FileMenu';
import { TutoTab } from '../../ui/tuto/Tuto';
import { Copilot, CopilotButton, useCopilotShortcut, type CopilotHost } from '../../ui/Copilot';
import { usePinchZoom } from '../../ui/pinch';
import { closeRibbonPeek } from '../../ui/ribbonMin';
import { FastScroll } from '../../ui/FastScroll';
import { ConvertPanel, runConvert } from '../../ui/convert/ConvertPanel';
import type { ConvertSource } from '../../shell/convert';
import { aiTranslator, bestTranslator } from '../../shell/translate';
import { FONTS, TEXT_SIZES } from '../draw/model';
import {
  FOLDERS, LABELS, addressOf, cleanBox, contactsFrom, fieldsIn, fromEml, gmailUrl, mailtoUrl, merge, newId, newMail, outlookUrl, preview, sizeText,
  splitAddresses, textOf, toEml, toVcf, validAddress, type Attachment, type Contact, type Folder, type Mail, type MailBox,
} from './model';
import { MAIL_TEMPLATES, TONES } from './templates';
import { mailWithAi } from './ai';

export const EXTENSIONS = ['.eml', '.oi1mail'];
type Tab = 'home' | 'insert' | 'format' | 'send' | 'mailing' | 'view' | 'ai' | 'oi1' | 'convert';
type Via = 'app' | 'gmail' | 'outlook' | 'eml';
const ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const textToHtml = (s: string) => s.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
function readBase64(f: Blob): Promise<string> {
  return new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = () => fail(r.error); r.readAsDataURL(f); });
}
const dayText = (iso: string, lang: string) => {
  const d = new Date(iso), now = new Date();
  return d.toDateString() === now.toDateString() ? d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
};

export default function MailApp({ shell, file, handoff }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff }) {
  const [initial, setInitial] = useState<MailBox | null>(null);
  useEffect(() => {
    void (async () => {
      let saved: MailBox | null = null;
      try { const raw = await shell.storage.load('mail'); if (raw) saved = cleanBox(JSON.parse(raw)); } catch { /* unreadable autosave */ }
      setInitial(saved ?? cleanBox(null));
    })();
  }, [shell]);
  if (!initial) return <div className="mailapp" />;
  return <MailEditor shell={shell} file={file} handoff={handoff} initial={initial} />;
}

function MailEditor({ shell, file, handoff, initial }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff; initial: MailBox }) {
  useLanguage();
  const lang = getLanguage();
  const [box, setBoxState] = useState<MailBox>(initial);
  const boxRef = useRef(box);
  boxRef.current = box;
  const [tab, setTab] = useState<Tab>('home');
  const [folder, setFolder] = useState<Folder>('drafts');
  const [label, setLabel] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [pane, setPane] = useState<'list' | 'mail'>('list');
  const [query, setQuery] = useState('');
  const [zoom, setZoomState] = useState<number | 'fit'>(1);
  const [via, setVia] = useState<Via>(() => { try { return (localStorage.getItem('oi1.mail.via') as Via) || 'app'; } catch { return 'app'; } });
  const [panel, setPanel] = useState<'file' | null>(null);
  const [copilot, setCopilot] = useState(false);
  const [copilotStart, setCopilotStart] = useState<{ id: string; n: number } | undefined>();
  const [aiAsk, setAiAsk] = useState<{ text: string; busy: boolean; error: string } | null>(null);
  const [ask, setAsk] = useState<{ title: string; label: string; value: string; ok: (v: string) => void; danger?: boolean } | null>(null);
  const [dlg, setDlg] = useState<'contacts' | 'me' | 'merge' | null>(null);
  const [mergeRows, setMergeRows] = useState<Record<string, string>[] | null>(null);
  const [note, setNote] = useState('');
  const [narrow, setNarrow] = useState(false);
  const undo = useRef<MailBox[]>([]);
  const redo = useRef<MailBox[]>([]);
  const [, bump] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const emlInput = useRef<HTMLInputElement>(null);
  const attachInput = useRef<HTMLInputElement>(null);
  const contactsInput = useRef<HTMLInputElement>(null);
  const ctl = useRef<AbortController | null>(null);
  const edRef = useRef<Editor | null>(null);
  useEffect(() => { if (ask || aiAsk || dlg) closeRibbonPeek(); }, [ask, aiAsk, dlg]);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < 760));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { try { localStorage.setItem('oi1.mail.via', via); } catch { /* private window */ } }, [via]);

  // ---------- changes and undo ----------
  const commit = useCallback((next: MailBox, record = true) => {
    const before = boxRef.current;
    if (next === before) return;
    if (record) { undo.current.push(before); if (undo.current.length > 100) undo.current.shift(); redo.current = []; }
    boxRef.current = next;
    setBoxState(next);
    bump(n => n + 1);
  }, []);
  const change = (fn: (b: MailBox) => MailBox, record = true) => commit(fn(boxRef.current), record);
  // A change that changes nothing (a field left without typing) is not kept, so undo never steps over empty moves.
  const setMail = (id: string, patch: Partial<Mail>, record = true) => {
    const m = boxRef.current.mails.find(x => x.id === id);
    if (!m || Object.entries(patch).every(([k, v]) => JSON.stringify(m[k as keyof Mail]) === JSON.stringify(v))) return;
    change(b => ({ ...b, mails: b.mails.map(x => (x.id === id ? { ...x, ...patch } : x)) }), record);
  };
  // Typing in To / Subject is one undo step: the mailbox before the field got focus, dropped again if nothing changed.
  const editMark = useRef<MailBox | null>(null);
  const editStart = () => { undo.current.push(boxRef.current); redo.current = []; editMark.current = boxRef.current; };
  const editEnd = () => { if (editMark.current && boxRef.current === editMark.current && undo.current[undo.current.length - 1] === editMark.current) undo.current.pop(); editMark.current = null; bump(n => n + 1); };
  const undoOnce = () => { const p = undo.current.pop(); if (!p) return; redo.current.push(boxRef.current); boxRef.current = p; setBoxState(p); bump(n => n + 1); };
  const redoOnce = () => { const n = redo.current.pop(); if (!n) return; undo.current.push(boxRef.current); boxRef.current = n; setBoxState(n); bump(x => x + 1); };

  // ---------- saving ----------
  const saveTimer = useRef(0);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void shell.storage.save('mail', JSON.stringify(box)); }, 500);
  }, [box, shell]);
  const current = box.mails.find(m => m.id === sel) ?? null;
  const editing = !!current && (current.folder === 'drafts' || current.folder === 'templates');
  const title = current?.subject || t('mail.untitled');
  useEffect(() => { shell.setTitle(title.slice(0, 40)); }, [shell, title]);
  useEffect(() => {
    shell.onRename?.(name => { if (current) setMail(current.id, { subject: name }); });
    return () => shell.onRename?.(null);
  }, [shell, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const baseName = () => title.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'mail';
  const from = () => (box.me.email ? (box.me.name ? `${box.me.name} <${box.me.email}>` : box.me.email) : '');
  useEffect(() => { shell.autoSave(null); }, [shell]);

  // ---------- opening ----------
  const openMail = (id: string) => { setSel(id); setPane('mail'); const m = boxRef.current.mails.find(x => x.id === id); if (m && !m.read) setMail(id, { read: true }, false); closeRibbonPeek(); };
  const addMails = (list: Mail[], open = true) => {
    if (!list.length) return;
    change(b => ({ ...b, mails: [...list, ...b.mails] }));
    if (open) { setFolder(list[0].folder); setLabel(null); openMail(list[0].id); }
  };
  const compose = (patch: Partial<Mail> = {}) => {
    const sig = boxRef.current.signature ? `<p></p><p>--</p>${safeHtml(boxRef.current.signature)}` : '';
    const m = newMail('drafts', { from: from(), html: `<p></p>${sig}`, ...patch });
    addMails([m]);
    requestAnimationFrame(() => (document.querySelector(`.module-host:not([hidden]) .mailapp .ml-field input`) as HTMLInputElement | null)?.focus());
    return m;
  };
  const loadFile = async (f: OpenedFile) => {
    const name = f.name.toLowerCase();
    const text = await f.text();
    if (name.endsWith('.oi1mail') || name.endsWith('.json')) {
      try { const b = cleanBox(JSON.parse(text)); change(x => ({ ...x, mails: [...b.mails, ...x.mails], contacts: [...x.contacts, ...b.contacts.filter(c => !x.contacts.some(y => y.email === c.email))] })); setNote(t('mail.imported', { n: b.mails.length })); } catch { setNote(t('mail.badFile')); }
      return;
    }
    if (name.endsWith('.vcf') || name.endsWith('.csv')) { importContacts(text); return; }
    if (/^(from|to|subject|received|mime-version|date|return-path|message-id):/im.test(text.slice(0, 4000))) { addMails([fromEml(text)]); return; }
    setNote(t('mail.badFile'));
  };
  const attachBlob = async (name: string, blob: Blob) => {
    if (!current || !editing) return;
    if (blob.size > 25 * 1024 * 1024) { setNote(t('mail.tooBig')); return; }
    const data = await readBase64(blob);
    const a: Attachment = { name, type: blob.type || 'application/octet-stream', size: blob.size, data };
    setMail(current.id, { attachments: [...(boxRef.current.mails.find(m => m.id === current.id)?.attachments ?? []), a] });
  };
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (file) void loadFile(file);
    else if (handoff?.kind === 'file') {
      const f = handoff.file;
      if (/\.(eml|oi1mail|vcf)$/i.test(f.name)) void loadFile(f);
      else void f.arrayBuffer().then(buf => { const m = compose({ subject: f.name.replace(/\.[^.]+$/, '') }); const data = btoa(Array.from(new Uint8Array(buf), c => String.fromCharCode(c)).join('')); setMail(m.id, { attachments: [{ name: f.name, type: f.type || 'application/octet-stream', size: buf.byteLength, data }] }, false); });
    } else if (handoff?.kind === 'html') compose({ subject: handoff.title ?? '', html: safeHtml(handoff.html) });
    else if (handoff?.kind === 'table') {
      const rows = tableRows(handoff.table);
      if (rows.length) { setMergeRows(rows); setDlg('merge'); compose({ subject: handoff.title ?? '' }); }
    } else if (!boxRef.current.mails.length) compose();
    else { const d = boxRef.current.mails.find(m => m.folder === 'drafts'); if (d) { setFolder('drafts'); setSel(d.id); } else setFolder('inbox'); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- actions on mails ----------
  const quoteOf = (m: Mail) => `<p></p><p>${esc(t('mail.wrote', { who: m.from || '—', when: new Date(m.at).toLocaleString(lang) }))}</p><blockquote>${safeHtml(m.html)}</blockquote>`;
  const reply = (all = false) => {
    if (!current) return;
    const me = addressOf(from()).toLowerCase();
    const others = all ? [...current.to, ...current.cc].filter(a => addressOf(a).toLowerCase() !== me) : [];
    compose({ to: current.from ? [current.from] : [], cc: others, subject: /^(re|ré|aw|res)\s*:/i.test(current.subject) ? current.subject : `${t('mail.re')} ${current.subject}`, html: `<p></p>${quoteOf(current)}` });
  };
  const forward = () => {
    if (!current) return;
    compose({ subject: `${t('mail.fwd')} ${current.subject}`, html: `<p></p>${quoteOf(current)}`, attachments: current.attachments });
  };
  const delMail = (id = sel) => {
    const m = boxRef.current.mails.find(x => x.id === id);
    if (!m) return;
    if (m.folder === 'trash') change(b => ({ ...b, mails: b.mails.filter(x => x.id !== id) }));
    else setMail(m.id, { folder: 'trash' });
    setSel(null); setPane('list');
    setNote(t('mail.deleted'));
  };
  const moveTo = (f: Mail['folder']) => { if (current) { setMail(current.id, { folder: f }); setNote(t('mail.moved', { folder: t(`mail.folder.${f}` as MessageKey) })); } };
  const toggleLabel = (id: string) => { if (current) setMail(current.id, { labels: current.labels.includes(id) ? current.labels.filter(x => x !== id) : [...current.labels, id] }); };
  const dupMail = () => { if (current) addMails([{ ...current, id: newId(), folder: 'drafts', at: new Date().toISOString() }]); };

  // ---------- sending ----------
  const problemsOf = (m: Mail) => {
    const bad = [...m.to, ...m.cc, ...m.bcc].filter(a => !validAddress(a));
    if (!m.to.length) return t('mail.noTo');
    if (bad.length) return t('mail.badAddress', { a: bad[0] });
    return '';
  };
  const send = async (how: Via = via, m = current) => {
    if (!m) return;
    edRef.current && m.id === current?.id && setMail(m.id, { html: edRef.current.getHTML() }, false);
    const fresh = { ...(boxRef.current.mails.find(x => x.id === m.id) ?? m), html: m.id === current?.id && edRef.current ? edRef.current.getHTML() : m.html };
    const p = problemsOf(fresh);
    if (p) { setNote(p); return; }
    if (!fresh.subject.trim() && !window.confirm?.(t('mail.noSubject'))) return;
    setVia(how);
    if (how === 'eml') await shell.saveFile(`${baseName()}.eml`, toEml(fresh, from()), 'message/rfc822', { saveAs: true });
    else {
      const url = how === 'gmail' ? gmailUrl(fresh) : how === 'outlook' ? outlookUrl(fresh) : mailtoUrl(fresh);
      if (how === 'app') { const a = document.createElement('a'); a.href = url; a.rel = 'noopener'; a.click(); } else window.open(url, '_blank', 'noopener');
      if (fresh.attachments.length && how !== 'app') setNote(t('mail.attachHint'));
    }
    setMail(fresh.id, { folder: 'sent', at: new Date().toISOString(), html: fresh.html });
    if (how === 'app' && fresh.attachments.length) setNote(t('mail.attachHint'));
    else setNote(t(`mail.sentVia.${how}` as MessageKey));
    setFolder('sent');
  };

  // ---------- contacts and mail merge ----------
  const importContacts = (text: string) => {
    const got = contactsFrom(text).filter(c => !boxRef.current.contacts.some(x => x.email.toLowerCase() === c.email.toLowerCase()));
    if (got.length) change(b => ({ ...b, contacts: [...b.contacts, ...got] }));
    setNote(t('mail.contactsAdded', { n: got.length }));
  };
  const tableRows = (tb: TableData) => {
    const head = tb.rows[0]?.map(c => c.text.trim()) ?? [];
    return tb.rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h || `C${i + 1}`, r[i]?.text ?? '']))).filter(r => Object.values(r).some(v => validAddress(v)));
  };
  const runMerge = (rows: Record<string, string>[]) => {
    if (!current || !rows.length) return;
    const html = edRef.current?.getHTML() ?? current.html;
    const list = rows.map(r => {
      const to = Object.values(r).find(v => validAddress(v)) ?? '';
      return newMail('drafts', { from: from(), to: [to], subject: merge(current.subject, r), html: merge(html, r), attachments: current.attachments });
    });
    change(b => ({ ...b, mails: [...list, ...b.mails] }));
    setDlg(null); setMergeRows(null);
    setFolder('drafts');
    setNote(t('mail.mergeDone', { n: list.length }));
  };
  const sendAll = async (how: Via) => {
    const drafts = boxRef.current.mails.filter(m => m.folder === 'drafts' && !problemsOf(m));
    if (how !== 'eml') { setNote(t('mail.sendAllEml')); return; }
    for (const m of drafts) await shell.saveFile(`${(m.subject || 'mail').replace(/[\\/:*?"<>|]+/g, '').slice(0, 60)} - ${addressOf(m.to[0] ?? '')}.eml`, toEml(m, from()), 'message/rfc822', {});
    change(b => ({ ...b, mails: b.mails.map(m => (drafts.some(d => d.id === m.id) ? { ...m, folder: 'sent' as const, at: new Date().toISOString() } : m)) }));
    setNote(t('mail.sentAll', { n: drafts.length }));
  };

  // ---------- templates ----------
  const useTemplate = async (id: string) => {
    const tpl = MAIL_TEMPLATES.find(x => x.id === id);
    if (!tpl) return;
    const fr = lang === 'fr' ? 1 : 0;
    let [subject, body] = [tpl.subject[fr], tpl.body[fr]];
    if (lang !== 'en' && lang !== 'fr') {
      try {
        const tr = await bestTranslator(lang, 'en', () => aiTranslator(shell.ai, lang));
        // Field names in {{…}} stay as they are, so mail merge still finds them.
        if (tr) { const keep: string[] = []; const hide = (s: string) => s.replace(/\{\{[^}]+\}\}/g, m => `⟦${keep.push(m) - 1}⟧`); const show = (s: string) => s.replace(/⟦(\d+)⟧/g, (_m, i: string) => keep[Number(i)] ?? ''); const got = await tr([hide(subject), hide(body)]); subject = show(got[0] || subject); body = show(got[1] || body); }
      } catch { /* stays in English */ }
    }
    const html = textToHtml(body) + (box.signature ? `<p>--</p>${safeHtml(box.signature)}` : '');
    if (current && editing && !textOf(edRef.current?.getHTML() ?? current.html).trim()) { setMail(current.id, { subject, html }); edRef.current?.commands.setContent(html); }
    else compose({ subject, html });
    closeRibbonPeek();
  };

  // ---------- AI ----------
  const runAi = async () => {
    if (!aiAsk?.text.trim()) return;
    const text = aiAsk.text.trim();
    const c = new AbortController();
    ctl.current = c;
    const viaWeb = shell.ai.provider?.().kind === 'web';
    if (viaWeb) setAiAsk(null); else setAiAsk({ ...aiAsk, busy: true, error: '' });
    try {
      const got = await mailWithAi(shell.ai, text, lang, box.me.name, c.signal);
      if (!got.body.trim()) throw new Error(t('mail.aiEmpty'));
      const html = textToHtml(got.body) + (box.signature ? `<p>--</p>${safeHtml(box.signature)}` : '');
      const cur = boxRef.current.mails.find(m => m.id === sel);
      if (cur && (cur.folder === 'drafts') && !textOf(edRef.current?.getHTML() ?? cur.html).trim()) { setMail(cur.id, { subject: cur.subject || got.subject, html }); edRef.current?.commands.setContent(html); }
      else compose({ subject: got.subject, html });
      setAiAsk(null);
      setNote(t('mail.aiDone'));
    } catch (e) {
      if (c.signal.aborted) { setAiAsk(a => (a ? { ...a, busy: false } : a)); return; }
      setAiAsk({ text, busy: false, error: e instanceof Error ? e.message : String(e) });
    } finally { ctl.current = null; }
  };
  useCopilotShortcut(() => setCopilot(o => !o), rootRef);
  const startAi = (id: string) => { setCopilot(true); setCopilotStart(s => ({ id, n: (s?.n ?? 0) + 1 })); closeRibbonPeek(); };
  const mailText = (m: Mail) => `From: ${m.from}\nTo: ${m.to.join(', ')}\nSubject: ${m.subject}\n\n${textOf(m.id === current?.id && edRef.current ? edRef.current.getHTML() : m.html)}`;
  const setBody = (answer: string) => {
    const cur = boxRef.current.mails.find(m => m.id === sel);
    const clean = answer.replace(/^\s*(subject|objet|asunto|assunto|betreff)\s*:.*\n+/i, '');
    if (cur && cur.folder === 'drafts') { const html = textToHtml(clean); edRef.current?.commands.setContent(html); setMail(cur.id, { html }); return t('mail.applied'); }
    compose({ html: textToHtml(clean), subject: cur ? `${t('mail.re')} ${cur.subject}` : '', to: cur?.from ? [cur.from] : [] });
    return t('mail.applied');
  };
  const copilotHost: CopilotHost = {
    app: 'In 1 Mail',
    role: 'In 1 Mail writes and reads e-mails. The context is the open mail (headers and text). Help the person write clear, polite, effective mails, answer mails, and understand long ones. When you write a mail, reply with only its text (no subject line, no comments).',
    context: () => (current ? { label: t('mail.ctxMail', { subject: current.subject || t('mail.untitled') }), text: mailText(current), at: current.id } : null),
    actions: [
      { id: 'reply', label: t('mail.ai.reply'), icon: 'send', needsContext: true, prompt: 'Write a reply to this mail: answer every question, polite and clear, short. Reply with only the text of the mail.' },
      { id: 'improve', label: t('mail.ai.improve'), icon: 'pen', needsContext: true, prompt: 'Improve this mail: clearer, shorter, correct spelling and grammar, same language and meaning. Reply with only the new text.' },
      { id: 'summary', label: t('mail.ai.summary'), icon: 'lines', needsContext: true, prompt: 'Summarise this mail in 3 bullet points, then list what I am asked to do and by when.' },
      { id: 'subject', label: t('mail.ai.subject'), icon: 'rename', needsContext: true, prompt: 'Suggest 5 short, clear subject lines for this mail, one per line.' },
      ...TONES.map(tone => ({ id: `tone-${tone}`, label: t(`mail.tone.${tone}` as MessageKey), icon: 'sparkle', needsContext: true, prompt: `Rewrite this mail in a ${tone} tone. Same language, same facts. Reply with only the new text.` })),
      { id: 'write', label: t('mail.aiWrite'), icon: 'sparkle', fill: t('mail.ai.writeFill'), ask: async (ai, request, _ctx, signal) => { const got = await mailWithAi(ai, request.replace(t('mail.ai.writeFill').trim(), '').trim() || request, lang, box.me.name, signal); compose({ subject: got.subject, html: textToHtml(got.body) }); return t('mail.aiDone'); } },
    ],
    applies: [
      { id: 'body', label: t('mail.apply.body'), icon: 'pen', run: (_p, answer) => setBody(answer) },
      { id: 'letter', label: t('mail.apply.letter'), icon: 'letter', run: (_p, answer) => { shell.openModule('letter', undefined, { kind: 'html', title: current?.subject ?? '', html: textToHtml(answer) }); return undefined; } },
    ],
  };

  // ---------- office in 1 ----------
  const mailHtml = () => {
    const m = current;
    if (!m) return '<p></p>';
    const html = m.id === current?.id && edRef.current ? edRef.current.getHTML() : m.html;
    return `<h1>${esc(m.subject || t('mail.untitled'))}</h1><p><b>${esc(t('mail.from'))}</b> ${esc(m.from)}<br><b>${esc(t('mail.to'))}</b> ${esc(m.to.join(', '))}<br>${esc(new Date(m.at).toLocaleString(lang))}</p><hr>${safeHtml(html)}`;
  };
  const listTable = (): TableData => ({ header: true, rows: [
    [t('mail.from'), t('mail.to'), t('mail.subject'), t('mail.date'), t('mail.folderCol')].map(text => ({ text, bold: true })),
    ...shown.map(m => [m.from, m.to.join(', '), m.subject, m.at.replace('T', ' ').slice(0, 16), t(`mail.folder.${m.folder}` as MessageKey)].map(text => ({ text }))),
  ] });
  const convertSource: ConvertSource = { appId: 'mail', title: () => title, html: mailHtml, tables: () => [{ name: t(`mail.folder.${folder}` as MessageKey), table: listTable() }] };

  // ---------- zoom ----------
  const [natural, setNatural] = useState({ w: 720, area: 720 });
  const k = zoom === 'fit' ? Math.max(0.3, Math.min(1, natural.area / Math.max(1, natural.w))) : zoom;
  const kRef = useRef(k);
  kRef.current = k;
  const setZoom = (z: number | 'fit') => setZoomState(z === 'fit' ? 'fit' : Math.max(0.3, Math.min(2.5, Math.round(z * 100) / 100)));
  usePinchZoom(scroller, () => kRef.current, z => setZoom(z), { min: 0.3, max: 2.5 });
  useLayoutEffect(() => {
    const el = scroller.current, c = content.current;
    if (!el || !c) return;
    const measure = () => setNatural({ w: c.scrollWidth / (kRef.current || 1), area: el.clientWidth - 8 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(c);
    return () => ro.disconnect();
  }, [zoom, sel, pane, narrow]);

  // ---------- keyboard ----------
  const onKey = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const inText = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'enter' && editing) { e.preventDefault(); void send(); return; }
    if (mod && key === 'n' && e.shiftKey) { e.preventDefault(); compose(); return; }
    if (inText) return;
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redoOnce(); else undoOnce(); }
    else if (mod && key === 'y') { e.preventDefault(); redoOnce(); }
    else if (key === 'delete' && sel) { e.preventDefault(); delMail(); }
    else if (key === 'r' && current && !editing) { e.preventDefault(); reply(e.shiftKey); }
    else if (key === 'f' && current && !editing) { e.preventDefault(); forward(); }
    else if (key === 'escape') { setPane('list'); }
  };

  // ---------- what is shown ----------
  const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const inFolder = (m: Mail, f: Folder) => (f === 'starred' ? m.star && m.folder !== 'trash' : m.folder === f);
  const shown = useMemo(() => box.mails
    .filter(m => (label ? m.labels.includes(label) && m.folder !== 'trash' : inFolder(m, folder)))
    .filter(m => !query.trim() || fold(`${m.from} ${m.to.join(' ')} ${m.subject} ${preview(m)}`).includes(fold(query.trim())))
    .sort((a, b) => b.at.localeCompare(a.at)), [box.mails, folder, label, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = (f: Folder) => box.mails.filter(m => inFolder(m, f) && (f === 'drafts' || !m.read)).length;
  const ed = edRef.current;
  const edState = useEditorState({ editor: ed, selector: c => (c.editor ? { b: c.editor.isActive('bold'), i: c.editor.isActive('italic'), u: c.editor.isActive('underline'), s: c.editor.isActive('strike'), ul: c.editor.isActive('bulletList'), ol: c.editor.isActive('orderedList'), l: c.editor.isActive({ textAlign: 'left' }), c: c.editor.isActive({ textAlign: 'center' }), r: c.editor.isActive({ textAlign: 'right' }) } : null) });
  const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => { if (ed) fn(ed.chain().focus()).run(); };
  const noEd = !ed || !editing;

  // ---------- ribbon ----------
  const tabs: { id: Tab; label: MessageKey }[] = [
    { id: 'home', label: 'letter.tab.home' }, { id: 'insert', label: 'letter.tab.insert' }, { id: 'format', label: 'mail.tab.format' }, { id: 'send', label: 'mail.tab.send' },
    { id: 'mailing', label: 'mail.tab.mailing' }, { id: 'view', label: 'letter.tab.view' }, { id: 'ai', label: 'draw.tab.ai' },
  ];
  const ribbon = (
    <div className="ribbon">
      <div className="ribbon-tabs" role="tablist">
        <button type="button" className="ribbon-file" onClick={() => setPanel('file')}>{t('letter.tab.file')}</button>
        {tabs.map(x => <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>{t(x.label)}</button>)}
        <button type="button" role="tab" aria-selected={tab === 'oi1'} className={`ribbon-special${tab === 'oi1' ? ' on' : ''}`} onClick={() => setTab('oi1')}><span className="dot" />Office In 1</button>
        <button type="button" role="tab" aria-selected={tab === 'convert'} className={`ribbon-special ribbon-convert${tab === 'convert' ? ' on' : ''}`} onClick={() => setTab('convert')}>{t('convert.tab')}</button>
        <TutoTab />
        <RibbonToggle />
        <span className="ribbon-quick">
          <CopilotButton open={copilot} onClick={() => setCopilot(o => !o)} />
          <Btn icon="undo" title="letter.undo" onClick={() => (ed && editing && document.activeElement?.closest('.ml-text') ? ed.commands.undo() : undoOnce())} disabled={!undo.current.length && !ed?.can().undo()} />
          <Btn icon="redo" title="letter.redo" onClick={() => (ed && editing && document.activeElement?.closest('.ml-text') ? ed.commands.redo() : redoOnce())} disabled={!redo.current.length && !ed?.can().redo()} />
        </span>
      </div>
      <div className="ribbon-panel" role="tabpanel" onMouseDown={e => { if (!['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) e.preventDefault(); }}>
        {tab === 'home' && <>
          <Group label="mail.group.new">
            <Btn big icon="new" title="mail.new" onClick={() => compose()} />
            <Btn big icon="send" title="mail.send" onClick={() => void send()} disabled={!editing} />
          </Group>
          <Group label="mail.group.respond">
            <Btn text icon="prev" title="mail.reply" onClick={() => reply()} disabled={!current || editing} />
            <Btn text icon="comment" title="mail.replyAll" onClick={() => reply(true)} disabled={!current || editing} />
            <Btn text icon="next" title="mail.forward" onClick={forward} disabled={!current} />
          </Group>
          <Group label="mail.group.organise">
            <Btn text icon="trash" title="mail.delete" onClick={() => delMail()} disabled={!current} />
            <Btn text icon="heart" title="mail.star" active={!!current?.star} onClick={() => current && setMail(current.id, { star: !current.star })} disabled={!current} />
            <Btn text icon="envelope" title="mail.unread" active={!!current && !current.read} onClick={() => current && setMail(current.id, { read: !current.read })} disabled={!current} />
            <Btn text icon="copy" title="mail.duplicate" onClick={dupMail} disabled={!current} />
            <Drop text icon="folder" title="mail.moveTo" label={<span className="rb-label">{t('mail.moveTo')}</span>} disabled={!current}>
              {close => <div className="menu ml-move">{(['inbox', 'drafts', 'sent', 'templates', 'trash'] as const).map(f => <button key={f} type="button" className="menu-item" onClick={() => { close(); moveTo(f); }}>{t(`mail.folder.${f}` as MessageKey)}</button>)}
                <div className="menu-sep" role="separator" />
                {LABELS.map(l => <button key={l.id} type="button" className={`menu-item${current?.labels.includes(l.id) ? ' on' : ''}`} onClick={() => { close(); toggleLabel(l.id); }}><i className="ml-dot" style={{ background: l.color }} /> {t(`mail.label.${l.id}` as MessageKey)}</button>)}</div>}
            </Drop>
            <Drop big icon="marks" title="mail.labels" wide disabled={!current}>
              {close => <div className="ml-labels">{LABELS.map(l => <button key={l.id} type="button" className={`ml-label-pick${current?.labels.includes(l.id) ? ' on' : ''}`} onClick={() => { toggleLabel(l.id); close(); }}><i style={{ background: l.color }} />{t(`mail.label.${l.id}` as MessageKey)}</button>)}</div>}
            </Drop>
          </Group>
          <Group label="mail.group.receive">
            <Btn big icon="download" title="mail.importEml" onClick={() => emlInput.current?.click()} />
          </Group>
        </>}

        {tab === 'insert' && <>
          <Group label="mail.group.ready">
            <Drop big icon="envelope" title="mail.templates" wide>
              {close => <div className="ml-templates">{MAIL_TEMPLATES.map(x => <button key={x.id} type="button" className="ml-tpl" onClick={() => { close(); void useTemplate(x.id); }}><span aria-hidden="true">{x.icon}</span>{t(`mail.tpl.${x.id}` as MessageKey)}</button>)}</div>}
            </Drop>
            <Btn big icon="sparkle" title="mail.aiWrite" onClick={() => setAiAsk({ text: '', busy: false, error: '' })} />
          </Group>
          <Group label="mail.group.attach">
            <Btn big icon="upload" title="mail.attach" onClick={() => attachInput.current?.click()} disabled={!editing} />
            <Btn text icon="signature" title="mail.signature" onClick={() => (box.signature && ed && editing ? run(c => c.insertContent(`<p>--</p>${safeHtml(box.signature)}`)) : setDlg('me'))} />
          </Group>
          <Group label="letter.group.insert">
            <Btn text icon="link" title="letter.link" onClick={() => setAsk({ title: t('letter.link'), label: t('letter.linkPrompt'), value: ed?.getAttributes('link').href ?? 'https://', ok: v => run(c => (v.trim() && v.trim() !== 'https://' ? c.extendMarkRange('link').setLink({ href: v.trim() }) : c.unsetLink())) })} disabled={noEd} />
            <Btn text icon="image" title="letter.image" onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = IMAGE_TYPES.join(','); i.onchange = () => { const f = i.files?.[0]; if (f) void readBase64(f).then(d => run(c => c.setImage({ src: `data:${f.type};base64,${d}`, alt: f.name }))); }; i.click(); }} disabled={noEd} />
            <Btn text icon="table" title="letter.table" onClick={() => run(c => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))} disabled={noEd} />
            <Btn text icon="date" title="letter.date" onClick={() => run(c => c.insertContent(new Date().toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })))} disabled={noEd} />
            <Btn text icon="fx" title="mail.field" onClick={() => setAsk({ title: t('mail.field'), label: t('mail.fieldLead'), value: t('mail.fieldName'), ok: v => v.trim() && run(c => c.insertContent(`{{${v.trim().replace(/[{}]/g, '')}}}`)) })} disabled={noEd} />
          </Group>
        </>}

        {tab === 'format' && <>
          <Group label="letter.group.font">
            <Drop text icon="case" title="letter.font" label={<span className="rb-label">{t('letter.font')}</span>} disabled={noEd}>
              {close => <div className="ml-fonts">{FONTS.map(f => <button key={f} type="button" style={{ fontFamily: f }} onClick={() => { close(); run(c => c.setFontFamily(f)); }}>{f}</button>)}</div>}
            </Drop>
            <Drop text icon="size" title="letter.fontSize" label={<span className="rb-label">{t('letter.fontSize')}</span>} disabled={noEd}>
              {close => <div className="ml-sizes">{TEXT_SIZES.map(s => <button key={s} type="button" onClick={() => { close(); run(c => c.setFontSize(`${s}px`)); }}>{s}</button>)}</div>}
            </Drop>
            <Btn icon="bold" title="letter.bold" active={!!edState?.b} onClick={() => run(c => c.toggleBold())} disabled={noEd} />
            <Btn icon="caret" title="letter.italic" active={!!edState?.i} onClick={() => run(c => c.toggleItalic())} disabled={noEd} />
            <Btn icon="lines" title="letter.underline" active={!!edState?.u} onClick={() => run(c => c.toggleUnderline())} disabled={noEd} />
            <Btn icon="clear" title="letter.strike" active={!!edState?.s} onClick={() => run(c => c.toggleStrike())} disabled={noEd} />
            <Drop icon="palette" title="letter.color" disabled={noEd}>{close => <ColorGrid none="letter.clearFormatting" onPick={col => { close(); run(c => (col ? c.setColor(col) : c.unsetColor())); }} />}</Drop>
            <Btn icon="clean" title="letter.clearFormatting" onClick={() => run(c => c.unsetAllMarks().clearNodes())} disabled={noEd} />
          </Group>
          <Group label="letter.group.paragraph">
            <Btn icon="bullets" title="letter.bullets" active={!!edState?.ul} onClick={() => run(c => c.toggleBulletList())} disabled={noEd} />
            <Btn icon="numbers" title="letter.numbers" active={!!edState?.ol} onClick={() => run(c => c.toggleOrderedList())} disabled={noEd} />
            <Btn icon="left" title="letter.alignLeft" active={!!edState?.l} onClick={() => run(c => c.setTextAlign('left'))} disabled={noEd} />
            <Btn icon="center" title="letter.alignCenter" active={!!edState?.c} onClick={() => run(c => c.setTextAlign('center'))} disabled={noEd} />
            <Btn icon="right" title="letter.alignRight" active={!!edState?.r} onClick={() => run(c => c.setTextAlign('right'))} disabled={noEd} />
            <Btn icon="callout" title="mail.quote" onClick={() => run(c => c.toggleBlockquote())} disabled={noEd} />
          </Group>
        </>}

        {tab === 'send' && <>
          <Group label="mail.group.sendVia">
            <Btn big icon="envelope" title="mail.via.app" active={via === 'app'} onClick={() => void send('app')} disabled={!editing} />
            <Btn big icon="send" title="mail.via.gmail" active={via === 'gmail'} onClick={() => void send('gmail')} disabled={!editing} />
            <Btn big icon="window" title="mail.via.outlook" active={via === 'outlook'} onClick={() => void send('outlook')} disabled={!editing} />
            <Btn big icon="save" title="mail.via.eml" active={via === 'eml'} onClick={() => void send('eml')} disabled={!current} />
          </Group>
          <Group label="mail.group.before">
            <Btn text icon="check" title="mail.check" onClick={() => { if (current) { const p = problemsOf(current); setNote(p || t('mail.checkOk')); } }} disabled={!current} />
            <Btn text icon="copy" title="mail.copyText" onClick={() => current && void navigator.clipboard?.writeText(textOf(edRef.current?.getHTML() ?? current.html)).then(() => setNote(t('mail.copied')))} disabled={!current} />
            <Btn text icon="user" title="mail.me" onClick={() => setDlg('me')} />
          </Group>
        </>}

        {tab === 'mailing' && <>
          <Group label="mail.group.merge">
            <Btn big icon="sheet" title="mail.merge" onClick={() => { if (!editing) compose(); setDlg('merge'); }} />
            <Btn text icon="fx" title="mail.field" onClick={() => setAsk({ title: t('mail.field'), label: t('mail.fieldLead'), value: t('mail.fieldName'), ok: v => v.trim() && run(c => c.insertContent(`{{${v.trim().replace(/[{}]/g, '')}}}`)) })} disabled={noEd} />
            <Btn text icon="save" title="mail.sendAll" onClick={() => void sendAll('eml')} />
          </Group>
          <Group label="mail.group.contacts">
            <Btn big icon="user" title="mail.contacts" onClick={() => setDlg('contacts')} />
            <Btn text icon="upload" title="mail.importContacts" onClick={() => contactsInput.current?.click()} />
            <Btn text icon="download" title="mail.exportContacts" onClick={() => void shell.saveFile('contacts.vcf', toVcf(box.contacts), 'text/vcard', { saveAs: true })} disabled={!box.contacts.length} />
          </Group>
        </>}

        {tab === 'view' && <>
          <Group label="mail.group.folders">
            {(['inbox', 'drafts', 'sent', 'starred'] as Folder[]).map(f => <Btn key={f} text icon={f === 'inbox' ? 'download' : f === 'drafts' ? 'pen' : f === 'sent' ? 'send' : 'heart'} title={`mail.folder.${f}`} active={folder === f && !label} onClick={() => { setFolder(f); setLabel(null); setPane('list'); }} />)}
          </Group>
          <Group label="letter.group.zoom">
            <Btn big icon="zoomin" title="letter.zoomIn" onClick={() => setZoom(ZOOMS.find(z => z > k + 0.001) ?? 2.5)} />
            <Btn big icon="zoomout" title="letter.zoomOut" onClick={() => setZoom([...ZOOMS].reverse().find(z => z < k - 0.001) ?? 0.3)} />
            <Btn big icon="onepage" title="ui.fitAll" onClick={() => setZoom('fit')} />
          </Group>
        </>}

        {tab === 'ai' && <>
          <Group label="mail.group.ai" accent="#7B6CF6">
            <Btn big icon="sparkle" title="mail.aiWrite" onClick={() => setAiAsk({ text: '', busy: false, error: '' })} />
            <Btn big icon="send" title="mail.ai.reply" onClick={() => startAi('reply')} disabled={!current} />
            <Btn text icon="pen" title="mail.ai.improve" onClick={() => startAi('improve')} disabled={!current} />
            <Btn text icon="lines" title="mail.ai.summary" onClick={() => startAi('summary')} disabled={!current} />
            <Btn text icon="rename" title="mail.ai.subject" onClick={() => startAi('subject')} disabled={!current} />
          </Group>
          <Group label="mail.group.tone" accent="#7B6CF6">
            <Drop big icon="theme" title="mail.tone" wide disabled={!current}>
              {close => <div className="ml-tones">{TONES.map(x => <button key={x} type="button" onClick={() => { close(); startAi(`tone-${x}`); }}>{t(`mail.tone.${x}` as MessageKey)}</button>)}</div>}
            </Drop>
          </Group>
        </>}

        {tab === 'oi1' && <>
          <Group label="draw.group.withLetter" accent={appColor('letter')}>
            <Btn big icon="letter" title="mail.toLetter" onClick={() => shell.openModule('letter', undefined, { kind: 'html', title, html: mailHtml() })} disabled={!current} />
          </Group>
          <Group label="letter.group.withProdfos" accent={appColor('prodfos')}>
            <Btn big icon="pdf" title="letter.savePdf" onClick={() => void runConvert(shell, convertSource, 'pdf', '').then(m => m && setNote(m))} disabled={!current} />
          </Group>
          <Group label="mail.group.attachDoc" accent={appColor('class')}>
            <Btn text icon="file" title="mail.attachRecent" onClick={async () => { const f = await shell.openFile(['.docx', '.xlsx', '.pptx', '.pdf', '.png', '.jpg', '.zip', '.oi1plan', '.oi1form', '.oi1notes', '.oi1draw', '.txt', '.csv']); if (f) { if (!editing) compose({ subject: f.name.replace(/\.[^.]+$/, '') }); const buf = await f.arrayBuffer(); await attachBlobLater(f.name, new Blob([buf], { type: f.type })); } }} />
            <Btn text icon="sheet" title="mail.toClass" onClick={() => shell.openModule('class', undefined, { kind: 'table', title: t(`mail.folder.${folder}` as MessageKey), table: listTable() })} />
          </Group>
          <Group label="letter.group.apps">
            <AppKeys apps={shell.apps()} self="mail" onOpen={id => shell.openModule(id)} />
          </Group>
          <Group label="letter.group.share">
            <Btn big icon="print" title="letter.print" onClick={() => printWindow(title, mailHtml(), 'body{font:11pt/1.5 Inter,Arial,sans-serif;margin:16mm}blockquote{border-left:3px solid #ccc;margin:8px 0;padding-left:10px;color:#555}img{max-width:100%}', lang)} disabled={!current} />
          </Group>
        </>}
        {tab === 'convert' && <ConvertPanel shell={shell} source={convertSource} />}
      </div>
    </div>
  );
  // An attachment picked before the new draft existed: wait for it, then attach.
  const pendingAttach = useRef<{ name: string; blob: Blob } | null>(null);
  const attachBlobLater = async (name: string, blob: Blob) => { if (current && editing) await attachBlob(name, blob); else pendingAttach.current = { name, blob }; };
  useEffect(() => { const p = pendingAttach.current; if (p && current && editing) { pendingAttach.current = null; void attachBlob(p.name, p.blob); } }, [current?.id, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- panes ----------
  const folderList = (
    <nav className="ml-folders" aria-label={t('mail.folders')}>
      <button type="button" className="ml-new" onClick={() => compose()}><Icon name="new" size={14} />{t('mail.new')}</button>
      {FOLDERS.map(f => (
        <button key={f} type="button" className={`ml-folder${folder === f && !label ? ' on' : ''}`} onClick={() => { setFolder(f); setLabel(null); setPane('list'); closeRibbonPeek(); }}>
          <span>{t(`mail.folder.${f}` as MessageKey)}</span>{counts(f) > 0 && <b>{counts(f)}</b>}
        </button>
      ))}
      {!narrow && LABELS.filter(l => box.mails.some(m => m.labels.includes(l.id))).map(l => (
        <button key={l.id} type="button" className={`ml-folder${label === l.id ? ' on' : ''}`} onClick={() => { setLabel(l.id); setPane('list'); }}><span><i className="ml-dot" style={{ background: l.color }} />{t(`mail.label.${l.id}` as MessageKey)}</span></button>
      ))}
    </nav>
  );
  const list = (
    <section className="ml-list" aria-label={t('mail.list')}>
      <div className="ml-search"><Icon name="search" size={13} /><input type="search" value={query} placeholder={t('mail.searchPh')} aria-label={t('mail.search')} onChange={e => setQuery(e.target.value)} /></div>
      {!shown.length && <p className="ml-none">{t(folder === 'inbox' && !label ? 'mail.emptyInbox' : 'mail.emptyFolder')}</p>}
      {folder === 'inbox' && !label && !shown.length && <button type="button" className="ml-import" onClick={() => emlInput.current?.click()}><Icon name="download" size={14} />{t('mail.importEml')}</button>}
      {shown.map(m => (
        <button key={m.id} type="button" className={`ml-item${sel === m.id ? ' on' : ''}${m.read ? '' : ' unread'}`} onClick={() => openMail(m.id)}>
          <span className="ml-item-top"><b>{m.folder === 'drafts' || m.folder === 'sent' ? (m.to.join(', ') || t('mail.noRecipient')) : (m.from || '—')}</b><small>{dayText(m.at, lang)}</small></span>
          <span className="ml-item-subject">{m.star && <i className="ml-star">★</i>}{m.attachments.length > 0 && '📎 '}{m.subject || t('mail.untitled')}</span>
          <span className="ml-item-preview">{preview(m) || '…'}</span>
          {m.labels.length > 0 && <span className="ml-dots">{m.labels.map(l => <i key={l} style={{ background: LABELS.find(x => x.id === l)?.color }} title={t(`mail.label.${l}` as MessageKey)} />)}</span>}
        </button>
      ))}
    </section>
  );
  const reader = current && !editing ? (
    <article className="ml-paper ml-reader">
      <h1>{current.subject || t('mail.untitled')}</h1>
      <div className="ml-heads">
        <div><b>{t('mail.from')}</b> {current.from || '—'}</div>
        <div><b>{t('mail.to')}</b> {current.to.join(', ') || '—'}</div>
        {current.cc.length > 0 && <div><b>{t('mail.cc')}</b> {current.cc.join(', ')}</div>}
        <div className="ml-date">{new Date(current.at).toLocaleString(lang)}</div>
      </div>
      <div className="ml-actions">
        <button type="button" onClick={() => reply()}><Icon name="prev" size={14} />{t('mail.reply')}</button>
        <button type="button" onClick={() => reply(true)}><Icon name="comment" size={14} />{t('mail.replyAll')}</button>
        <button type="button" onClick={forward}><Icon name="next" size={14} />{t('mail.forward')}</button>
        <button type="button" onClick={() => startAi('reply')}>✦ {t('mail.ai.reply')}</button>
        {current.folder === 'sent' && <button type="button" onClick={() => setMail(current.id, { folder: 'drafts' })}><Icon name="pen" size={14} />{t('mail.editAgain')}</button>}
      </div>
      <div className="ml-body" dangerouslySetInnerHTML={{ __html: safeHtml(current.html) }} />
      {current.attachments.length > 0 && <Attachments list={current.attachments} />}
    </article>
  ) : null;
  const composer = current && editing ? (
    <Composer key={current.id} mail={current} contacts={box.contacts} edRef={edRef} onChange={(patch, record) => setMail(current.id, patch, record)} onEdit={on => (on ? editStart() : editEnd())}
      onSend={() => void send()} onDiscard={() => delMail(current.id)} onAttach={() => attachInput.current?.click()} via={via} />
  ) : null;
  const empty = !current && <div className="ml-paper ml-hello"><p>{t('mail.helloLead')}</p><div><button type="button" className="primary" onClick={() => compose()}><Icon name="new" size={14} />{t('mail.new')}</button><button type="button" onClick={() => setAiAsk({ text: '', busy: false, error: '' })}>✦ {t('mail.aiWrite')}</button><button type="button" onClick={() => emlInput.current?.click()}><Icon name="download" size={14} />{t('mail.importEml')}</button></div></div>;

  const showList = !narrow || pane === 'list';
  const showMail = !narrow || pane === 'mail';
  return (
    <div className={`mailapp${narrow ? ' narrow' : ''}`} ref={rootRef} tabIndex={-1} onKeyDown={onKey}>
      {ribbon}
      <div className="ml-body-wrap">
        {showList && folderList}
        {showList && list}
        {showMail && (
          <div className="ml-scroll" ref={scroller}>
            {narrow && <button type="button" className="ml-back" onClick={() => setPane('list')}><Icon name="prev" size={14} />{t(`mail.folder.${folder}` as MessageKey)}</button>}
            <div className="ml-content" ref={content} style={{ zoom: k } as CSSProperties}>
              {reader}{composer}{empty}
            </div>
          </div>
        )}
        {showMail && <FastScroll target={scroller} />}
        {copilot && <Copilot host={copilotHost} ai={shell.ai} start={copilotStart} onClose={() => { setCopilot(false); rootRef.current?.focus(); }} />}
      </div>
      <footer className="status">
        <span>{t('mail.status', { n: shown.length, folder: label ? t(`mail.label.${label}` as MessageKey) : t(`mail.folder.${folder}` as MessageKey) })}</span>
        {note && <span className="dr-note" role="status" onAnimationEnd={() => setNote('')}>{note}</span>}
        <span className="status-file">{box.me.email || t('mail.noMe')}</span>
        <span className="status-zoom">
          <button type="button" aria-label={t('letter.zoomOut')} title={t('letter.zoomOut')} onClick={() => setZoom([...ZOOMS].reverse().find(z => z < k - 0.001) ?? 0.3)}>−</button>
          <input type="range" min={30} max={250} step={5} value={Math.round(k * 100)} aria-label={t('letter.zoom')} onChange={e => setZoom(Number(e.target.value) / 100)} onDoubleClick={() => setZoom('fit')} />
          <button type="button" aria-label={t('letter.zoomIn')} title={t('letter.zoomIn')} onClick={() => setZoom(ZOOMS.find(z => z > k + 0.001) ?? 2.5)}>+</button>
          <span className="pct">{Math.round(k * 100)}%</span>
          <button type="button" className="fit" title={t('ui.fitAll')} aria-label={t('ui.fitAll')} onClick={() => setZoom('fit')}><Icon name="onepage" size={13} /></button>
        </span>
      </footer>

      {aiAsk && (
        <Dialog title={t('mail.aiWrite')} onClose={() => { ctl.current?.abort(); setAiAsk(null); }} onOk={() => { void runAi(); return false; }}>
          <div className="dr-ai">
            <p>{t('mail.aiLead')}</p>
            <textarea autoFocus rows={3} value={aiAsk.text} placeholder={t('mail.aiPlaceholder')} aria-label={t('mail.aiWrite')} disabled={aiAsk.busy}
              onChange={e => setAiAsk({ ...aiAsk, text: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void runAi(); } }} />
            <div className="dr-ai-ideas">{(['late', 'thanks', 'rent', 'teacher', 'refund', 'meeting'] as const).map(id => <button key={id} type="button" disabled={aiAsk.busy} onClick={() => setAiAsk({ ...aiAsk, text: t(`mail.aiIdea.${id}` as MessageKey) })}>{t(`mail.aiIdea.${id}` as MessageKey)}</button>)}</div>
            {aiAsk.busy && <p className="dr-ai-busy" role="status">✦ {t('draw.aiThinking')}</p>}
            {aiAsk.error && <p className="dr-ai-error" role="alert">{t('draw.aiFailed')} {aiAsk.error}</p>}
            <p className="dr-ai-who">{t('assistant.withAi', { name: shell.ai.provider?.().name ?? 'Claude' })}</p>
          </div>
        </Dialog>
      )}
      {ask && (
        <Dialog title={ask.title} onClose={() => setAsk(null)} onOk={() => { ask.ok(ask.value); }}>
          <label className="nt-ask"><span>{ask.label}</span>{!ask.danger && <input autoFocus value={ask.value} onChange={e => setAsk({ ...ask, value: e.target.value })} />}</label>
        </Dialog>
      )}
      {dlg === 'me' && <MeDialog box={box} onClose={() => setDlg(null)} onSave={(me, signature) => { change(b => ({ ...b, me, signature })); setDlg(null); }} />}
      {dlg === 'contacts' && <ContactsDialog contacts={box.contacts} onClose={() => setDlg(null)} onChange={contacts => change(b => ({ ...b, contacts }))}
        onWrite={c => { setDlg(null); compose({ to: [c.name ? `${c.name} <${c.email}>` : c.email] }); }} onImport={() => contactsInput.current?.click()} />}
      {dlg === 'merge' && <MergeDialog rows={mergeRows} contacts={box.contacts} fields={fieldsIn(`${current?.subject ?? ''} ${edRef.current?.getHTML() ?? current?.html ?? ''}`)}
        onClose={() => { setDlg(null); setMergeRows(null); }} onRun={runMerge} />}
      <input ref={emlInput} type="file" multiple accept=".eml,.oi1mail,.json,message/rfc822" hidden onChange={e => { for (const f of Array.from(e.target.files ?? [])) void loadFile({ name: f.name, type: f.type, text: () => f.text(), arrayBuffer: () => f.arrayBuffer() }); e.target.value = ''; }} />
      <input ref={attachInput} type="file" multiple hidden onChange={e => { for (const f of Array.from(e.target.files ?? [])) void attachBlob(f.name, f); e.target.value = ''; }} />
      <input ref={contactsInput} type="file" accept=".csv,.vcf,.txt" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void f.text().then(importContacts); e.target.value = ''; }} />
      {panel === 'file' && (
        <FileMenu fileName={`${baseName()}.eml`} onClose={() => setPanel(null)}
          onNew={() => compose()} onOpen={async () => { const f = await shell.openFile(['.eml', '.oi1mail', '.vcf', '.csv']); if (f) void loadFile(f); }}
          onSave={() => void shell.saveFile('mailbox.oi1mail', JSON.stringify({ app: 'In 1 Mail', ...boxRef.current }), 'application/json', { saveAs: true })}
          saveChoices={[
            { id: 'eml', icon: 'envelope', label: t('mail.format.eml'), hint: '.eml' },
            { id: 'oi1mail', icon: 'save', label: t('mail.format.oi1mail'), hint: '.oi1mail' },
            { id: 'vcf', icon: 'user', label: t('mail.format.vcf'), hint: '.vcf' },
            { id: 'pdf', icon: 'pdf', label: t('mail.format.pdf'), hint: '.pdf' },
          ]}
          onSaveAs={async (f: string) => {
            if (f === 'eml' && current) await shell.saveFile(`${baseName()}.eml`, toEml({ ...current, html: edRef.current?.getHTML() ?? current.html }, from()), 'message/rfc822', { saveAs: true });
            if (f === 'oi1mail') await shell.saveFile('mailbox.oi1mail', JSON.stringify({ app: 'In 1 Mail', ...boxRef.current }), 'application/json', { saveAs: true });
            if (f === 'vcf') await shell.saveFile('contacts.vcf', toVcf(boxRef.current.contacts), 'text/vcard', { saveAs: true });
            if (f === 'pdf' && current) { const m = await runConvert(shell, convertSource, 'pdf', ''); if (m) setNote(m); }
          }}
          listRecent={shell.recent.list} onOpenRecent={async r => { const f = await shell.recent.open(r.id); if (f) void loadFile(f); }} />
      )}
    </div>
  );
}

// ---------- writing a mail ----------
function Composer({ mail, contacts, edRef, onChange, onEdit, onSend, onDiscard, onAttach, via }: {
  mail: Mail; contacts: Contact[]; edRef: React.MutableRefObject<Editor | null>; onChange: (p: Partial<Mail>, record?: boolean) => void; onEdit: (on: boolean) => void;
  onSend: () => void; onDiscard: () => void; onAttach: () => void; via: Via;
}) {
  const [showCc, setShowCc] = useState(mail.cc.length > 0 || mail.bcc.length > 0);
  const timer = useRef(0);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableKit.configure({ table: { resizable: false } }),
      Image.configure({ inline: true, allowBase64: true }),
      TextStyleKit.configure({ lineHeight: false }),
      Placeholder.configure({ placeholder: () => t('mail.bodyPh') }),
    ],
    content: safeHtml(mail.html),
    editorProps: { attributes: { class: 'ml-text', spellcheck: 'true', 'aria-label': t('mail.body') } },
    onUpdate: ({ editor: ed }) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => onChange({ html: ed.getHTML() }, false), 400); },
  }, [mail.id]);
  useEffect(() => { edRef.current = editor; return () => { if (edRef.current === editor) edRef.current = null; }; }, [editor, edRef]);
  useEffect(() => () => { window.clearTimeout(timer.current); if (editor && !editor.isDestroyed) onChange({ html: editor.getHTML() }, false); }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps
  const field = (key: 'to' | 'cc' | 'bcc', label: string) => (
    <label className="ml-field"><span>{label}</span>
      <input list="ml-contacts" value={mail[key].join(', ')} aria-label={label} inputMode="email" autoComplete="email"
        onChange={e => onChange({ [key]: e.target.value.trim() ? e.target.value.split(/\s*[,;]\s*/) : [] }, false)}
        onFocus={() => onEdit(true)} onBlur={e => { onChange({ [key]: splitAddresses(e.target.value) }, false); onEdit(false); }} />
    </label>
  );
  const bad = [...mail.to, ...mail.cc, ...mail.bcc].filter(a => a.trim() && !validAddress(a));
  return (
    <article className="ml-paper ml-compose">
      <div className="ml-fields">
        {field('to', t('mail.to'))}
        {!showCc && <button type="button" className="ml-cc-toggle" onClick={() => setShowCc(true)}>{t('mail.cc')} / {t('mail.bcc')}</button>}
        {showCc && field('cc', t('mail.cc'))}
        {showCc && field('bcc', t('mail.bcc'))}
        <label className="ml-field"><span>{t('mail.subject')}</span><input value={mail.subject} aria-label={t('mail.subject')} onChange={e => onChange({ subject: e.target.value }, false)} onFocus={() => onEdit(true)} onBlur={e => { onChange({ subject: e.target.value }, false); onEdit(false); }} /></label>
        <datalist id="ml-contacts">{contacts.map(c => <option key={c.id} value={c.name ? `${c.name} <${c.email}>` : c.email} />)}</datalist>
        {bad.length > 0 && <p className="ml-bad" role="alert">{t('mail.badAddress', { a: bad[0] })}</p>}
      </div>
      <EditorContent editor={editor} className="ml-editor" />
      {mail.attachments.length > 0 && <Attachments list={mail.attachments} onRemove={i => onChange({ attachments: mail.attachments.filter((_, j) => j !== i) })} />}
      <div className="ml-compose-bar">
        <button type="button" className="ml-send primary" onClick={onSend}><Icon name="send" size={14} />{t('mail.send')} · {t(`mail.via.${via}` as MessageKey)}</button>
        <button type="button" onClick={onAttach}><Icon name="upload" size={14} />{t('mail.attach')}</button>
        <span className="ml-grow" />
        <button type="button" className="ml-discard" title={t('mail.discard')} aria-label={t('mail.discard')} onClick={onDiscard}><Icon name="trash" size={14} /></button>
      </div>
    </article>
  );
}

function Attachments({ list, onRemove }: { list: Attachment[]; onRemove?: (i: number) => void }) {
  const open = (a: Attachment) => {
    const bin = atob(a.data);
    const blob = new Blob([Uint8Array.from(bin, c => c.charCodeAt(0))], { type: a.type });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: a.name });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <div className="ml-atts" aria-label={t('mail.attachments')}>
      {list.map((a, i) => (
        <span key={`${a.name}${i}`} className="ml-att">
          <button type="button" onClick={() => open(a)} title={t('mail.download')}>📎 {a.name} <small>{sizeText(a.size)}</small></button>
          {onRemove && <button type="button" className="ml-x" aria-label={t('mail.remove')} title={t('mail.remove')} onClick={() => onRemove(i)}>×</button>}
        </span>
      ))}
    </div>
  );
}

function MeDialog({ box, onClose, onSave }: { box: MailBox; onClose: () => void; onSave: (me: MailBox['me'], signature: string) => void }) {
  const [name, setName] = useState(box.me.name);
  const [email, setEmail] = useState(box.me.email);
  const [sig, setSig] = useState(textOf(box.signature));
  return (
    <Dialog title={t('mail.me')} onClose={onClose} onOk={() => { onSave({ name: name.trim(), email: email.trim() }, sig.trim() ? sig.trim().split('\n').map(l => `<p>${esc(l)}</p>`).join('') : ''); return false; }}>
      <div className="ml-form">
        <label>{t('mail.myName')}<input value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
        <label>{t('mail.myEmail')}<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>{t('mail.signature')}<textarea rows={4} value={sig} placeholder={t('mail.signaturePh')} onChange={e => setSig(e.target.value)} /></label>
        <p className="ml-hint">{t('mail.meHint')}</p>
      </div>
    </Dialog>
  );
}

function ContactsDialog({ contacts, onClose, onChange, onWrite, onImport }: { contacts: Contact[]; onClose: () => void; onChange: (c: Contact[]) => void; onWrite: (c: Contact) => void; onImport: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [group, setGroup] = useState('');
  const [q, setQ] = useState('');
  const add = () => { if (!validAddress(email)) return; onChange([...contacts, { id: newId('c'), name: name.trim(), email: email.trim(), group: group.trim() }]); setName(''); setEmail(''); };
  const shown = contacts.filter(c => !q.trim() || `${c.name} ${c.email} ${c.group}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Dialog title={t('mail.contacts')} onClose={onClose}>
      <div className="ml-contacts">
        <div className="ml-add-contact">
          <input value={name} placeholder={t('mail.contactName')} aria-label={t('mail.contactName')} onChange={e => setName(e.target.value)} />
          <input type="email" value={email} placeholder={t('mail.contactEmail')} aria-label={t('mail.contactEmail')} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <input value={group} placeholder={t('mail.contactGroup')} aria-label={t('mail.contactGroup')} onChange={e => setGroup(e.target.value)} />
          <button type="button" className="primary" onClick={add} disabled={!validAddress(email)}>{t('mail.addContact')}</button>
        </div>
        <div className="ml-contacts-tools">
          <input type="search" value={q} placeholder={t('mail.search')} aria-label={t('mail.search')} onChange={e => setQ(e.target.value)} />
          <button type="button" onClick={onImport}><Icon name="upload" size={13} />{t('mail.importContacts')}</button>
        </div>
        {!contacts.length && <p className="ml-hint">{t('mail.noContacts')}</p>}
        <ul>{shown.map(c => (
          <li key={c.id}>
            <span><b>{c.name || c.email}</b><small>{c.name ? c.email : ''}{c.group ? ` · ${c.group}` : ''}</small></span>
            <button type="button" title={t('mail.writeTo')} aria-label={t('mail.writeTo')} onClick={() => onWrite(c)}><Icon name="envelope" size={14} /></button>
            <button type="button" title={t('mail.remove')} aria-label={t('mail.remove')} onClick={() => onChange(contacts.filter(x => x.id !== c.id))}><Icon name="trash" size={14} /></button>
          </li>
        ))}</ul>
      </div>
    </Dialog>
  );
}

function MergeDialog({ rows, contacts, fields, onClose, onRun }: { rows: Record<string, string>[] | null; contacts: Contact[]; fields: string[]; onClose: () => void; onRun: (rows: Record<string, string>[]) => void }) {
  const groups = [...new Set(contacts.map(c => c.group).filter(Boolean))];
  const [source, setSource] = useState<string>(rows ? 'table' : contacts.length ? 'all' : 'paste');
  const [pasted, setPasted] = useState('');
  const fromContacts = (g: string) => contacts.filter(c => g === 'all' || c.group === g).map(c => ({ Name: c.name, Nom: c.name, Email: c.email, Group: c.group }));
  const fromPaste = () => {
    const lines = pasted.split(/\r?\n/).filter(Boolean).map(l => l.split(/[;,\t]/).map(c => c.trim()));
    if (lines.length < 2) return [];
    const head = lines[0];
    return lines.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))).filter(r => Object.values(r).some(v => validAddress(v)));
  };
  const list = source === 'table' ? rows ?? [] : source === 'paste' ? fromPaste() : fromContacts(source);
  return (
    <Dialog title={t('mail.merge')} onClose={onClose} onOk={() => { if (list.length) onRun(list); return false; }}>
      <div className="ml-form">
        <p className="ml-hint">{t('mail.mergeLead')}</p>
        <label>{t('mail.mergeWho')}
          <select value={source} onChange={e => setSource(e.target.value)}>
            {rows && <option value="table">{t('mail.mergeTable', { n: rows.length })}</option>}
            {contacts.length > 0 && <option value="all">{t('mail.mergeAll', { n: contacts.length })}</option>}
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
            <option value="paste">{t('mail.mergePaste')}</option>
          </select>
        </label>
        {source === 'paste' && <textarea rows={5} value={pasted} placeholder={'Name;Email;Amount\nAnna;anna@mail.com;120 €'} aria-label={t('mail.mergePaste')} onChange={e => setPasted(e.target.value)} />}
        <p>{t('mail.mergeFields')} {fields.length ? fields.map(f => `{{${f}}}`).join(' ') : t('mail.mergeNoFields')}</p>
        <p><b>{t('mail.mergeCount', { n: list.length })}</b></p>
      </div>
    </Dialog>
  );
}
