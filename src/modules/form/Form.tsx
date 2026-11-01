// In 1 Form: forms, surveys and quizzes for everyone, on a computer, a tablet or a phone. 23 kinds of questions (text,
// choices, stars, scales, NPS, agree/disagree, ranking, grids, dates, e-mail, phone, address…), 22 ready forms, 22
// looks, quizzes with points. Beyond the usual: no account and no server needed. "Send the form" makes one file that
// opens anywhere; people send back an answer code that "Import answers" reads. "Fill here" turns the screen into a
// kiosk (a tablet at an event). "Create with AI" writes a whole form from a sentence; results go to In 1 Class and
// a report to In 1 Letter. Saves as .oi1form, answers as CSV.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { FileRef, Handoff, OpenedFile, RecentFile, ShellApi, TableData } from '../../shell/contract';
import { getLanguage, t, type MessageKey } from '../../shell/i18n';
import { printWindow } from '../../shell/printWindow';
import { useLanguage } from '../../shell/useLanguage';
import { Btn, Dialog, Drop, Group, Icon, RibbonToggle } from '../../ui/kit';
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
import { FONTS } from '../draw/model';
import {
  QTYPES, TYPE_ICON, WITH_OPTIONS, answerText, cleanForm, decodeReplies, encodeReply, formKey, newForm, newId, newQuestion, order, problems,
  repliesCsv, score, summarize, type Answer, type Form, type QType, type Question,
} from './model';
import { FORM_TEMPLATES, THEMES } from './templates';
import { formFromAnswer, formWithAi } from './ai';
import { shareHtml, type ShareWords } from './share';

export const EXTENSIONS = ['.oi1form'];
type Tab = 'home' | 'insert' | 'design' | 'answers' | 'view' | 'ai' | 'oi1' | 'convert';
type View = 'edit' | 'fill' | 'results';
const ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const typeName = (q: QType) => t(`form.type.${q}` as MessageKey);
const AGREE = () => [t('form.agree5'), t('form.agree4'), t('form.agree3'), t('form.agree2'), t('form.agree1')];

export default function FormApp({ shell, file, handoff }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff }) {
  const [initial, setInitial] = useState<{ form: Form; name: string } | null>(null);
  useEffect(() => {
    void (async () => {
      let saved: { form: Form; name: string } | null = null;
      if (!file && !handoff) try {
        const raw = await shell.storage.load('form');
        if (raw) { const o = JSON.parse(raw) as { form: unknown; name?: unknown }; saved = { form: cleanForm(o.form, t('form.untitled')), name: typeof o.name === 'string' ? o.name : '' }; }
      } catch { /* unreadable autosave */ }
      setInitial(saved ?? { form: newForm(t('form.untitled')), name: '' });
    })();
  }, [shell, file, handoff]);
  if (!initial) return <div className="formapp" />;
  return <FormEditor shell={shell} file={file} handoff={handoff} initial={initial} />;
}

function FormEditor({ shell, file, handoff, initial }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff; initial: { form: Form; name: string } }) {
  useLanguage();
  const lang = getLanguage();
  const [form, setFormState] = useState<Form>(initial.form);
  const formRef = useRef(form);
  formRef.current = form;
  const [tab, setTab] = useState<Tab>('home');
  const [view, setView] = useState<View>('edit');
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoomState] = useState<number | 'fit'>(1);
  const [narrow, setNarrow] = useState(false);
  const [fileName, setFileName] = useState(initial.name);
  const [fileRef, setFileRef] = useState<FileRef | undefined>();
  const [panel, setPanel] = useState<'file' | null>(null);
  const [copilot, setCopilot] = useState(false);
  const [copilotStart, setCopilotStart] = useState<{ id: string; n: number } | undefined>();
  const [aiAsk, setAiAsk] = useState<{ text: string; quiz: boolean; busy: boolean; error: string } | null>(null);
  const [ask, setAsk] = useState<{ title: string; label: string; value: string; ok: (v: string) => void; danger?: boolean; long?: boolean } | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const undo = useRef<Form[]>([]);
  const redo = useRef<Form[]>([]);
  const [, bump] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => { if (ask || aiAsk || importing !== null) closeRibbonPeek(); }, [ask, aiAsk, importing]);

  // ---------- changes and undo ----------
  const commit = useCallback((next: Form) => {
    const before = formRef.current;
    if (next === before) return;
    undo.current.push(before);
    if (undo.current.length > 200) undo.current.shift();
    redo.current = [];
    formRef.current = next;
    setFormState(next);
    bump(n => n + 1);
  }, []);
  const change = (fn: (f: Form) => Form) => commit(fn(formRef.current));
  const setQ = (id: string, patch: Partial<Question>) => change(f => ({ ...f, questions: f.questions.map(q => (q.id === id ? { ...q, ...patch } : q)) }));
  const undoOnce = () => { const p = undo.current.pop(); if (!p) return; redo.current.push(formRef.current); formRef.current = p; setFormState(p); bump(n => n + 1); };
  const redoOnce = () => { const n = redo.current.pop(); if (!n) return; undo.current.push(formRef.current); formRef.current = n; setFormState(n); bump(x => x + 1); };

  // ---------- saving ----------
  const title = fileName ? fileName.replace(/\.[^.]+$/, '') : form.title;
  useEffect(() => { shell.setTitle(title.slice(0, 40)); }, [shell, title]);
  const saveTimer = useRef(0);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void shell.storage.save('form', JSON.stringify({ form, name: fileName })); }, 500);
  }, [form, fileName, shell]);
  useEffect(() => {
    shell.onRename?.(name => { setFileName(`${name}.oi1form`); change(f => ({ ...f, title: name })); });
    return () => shell.onRename?.(null);
  }, [shell]); // eslint-disable-line react-hooks/exhaustive-deps
  const baseName = () => title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'form';
  const json = () => new Blob([JSON.stringify({ app: 'In 1 Form', ...formRef.current }, null, 1)], { type: 'application/json' });
  const save = async (saveAs = false) => {
    const name = fileName.toLowerCase().endsWith('.oi1form') ? fileName : `${baseName()}.oi1form`;
    const ref = await shell.saveFile(name, async () => json(), 'application/json', { target: fileRef, saveAs });
    if (ref) { setFileRef(ref); setFileName(ref.name); }
  };
  const theme = THEMES.find(x => x.id === form.theme) ?? THEMES[0];
  const words = (): ShareWords => ({
    send: t('form.submit'), required: t('form.err.required'), email: t('form.err.email'), phone: t('form.err.phone'), url: t('form.err.url'), number: t('form.err.number'), rows: t('form.err.rows'),
    thanks: t('form.thanksDefault'), code: t('form.codeLead'), copy: t('form.copyCode'), copied: t('form.copied'), mail: t('form.mailCode'), yes: t('form.yes'), no: t('form.no'), other: t('form.other'),
    agree: [t('form.iAgree'), ...AGREE()], pick: t('form.pick'), score: t('form.score'), first: t('form.first'), last: t('form.last'), street: t('form.street'), city: t('form.city'), zip: t('form.zip'), country: t('form.country'), made: t('form.madeWith'),
  });
  const shareFile = async () => {
    if (!formRef.current.questions.length) { setNote(t('form.noQuestions')); return; }
    await shell.saveFile(`${baseName()}.html`, shareHtml(formRef.current, theme, words(), lang), 'text/html', { saveAs: true });
    setNote(t('form.shared'));
  };
  const csv = () => repliesCsv(formRef.current, t('form.when'));
  const exportAs = async (f: 'oi1form' | 'html' | 'csv' | 'pdf') => {
    if (f === 'oi1form') return void save(true);
    if (f === 'html') return void shareFile();
    if (f === 'csv') await shell.saveFile(`${baseName()}.csv`, `﻿${csv()}`, 'text/csv', { saveAs: true });
    if (f === 'pdf') { const m = await runConvert(shell, convertSource, 'pdf', ''); if (m) setNote(m); }
  };
  const quietSave = useRef<() => Promise<FileRef | null>>(async () => null);
  quietSave.current = async () => {
    const own = !!fileRef?.handle && fileName.toLowerCase().endsWith('.oi1form');
    if (!own && !shell.cloudOn?.()) return null;
    return shell.saveFile(own ? fileName : `${baseName()}.oi1form`, async () => json(), 'application/json', { target: own ? fileRef : undefined, quiet: true });
  };
  useEffect(() => { shell.autoSave(() => quietSave.current()); return () => shell.autoSave(null); }, [shell]);
  const importAnswers = (text: string) => {
    const got = decodeReplies(text, formKey(formRef.current));
    if (got.replies.length) change(f => ({ ...f, replies: [...f.replies, ...got.replies] }));
    setNote(got.replies.length ? t('form.importedN', { n: got.replies.length }) : got.other ? t('form.otherForm') : t('form.noCodes'));
    if (got.replies.length) setView('results');
    return got.replies.length;
  };
  const loadFile = async (f: OpenedFile) => {
    const text = await f.text();
    if (/OI1F:/.test(text) && !/"questions"/.test(text)) { importAnswers(text); return; }
    try {
      const p = cleanForm(JSON.parse(text), f.name.replace(/\.[^.]+$/, ''));
      commit(p); setFileName(f.name); setFileRef(f);
    } catch { setNote(t('form.badFile')); }
  };
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (file) void loadFile(file);
    if (handoff?.kind === 'file') void loadFile(handoff.file);
    if (handoff?.kind === 'table') {
      const head = handoff.table.rows[0]?.map(c => c.text.trim()).filter(Boolean) ?? [];
      if (head.length) addQuestions(head.map(h => newQuestion('short', h)));
    }
    if (handoff?.kind === 'html') {
      const lines = (new DOMParser().parseFromString(handoff.html, 'text/html').body.innerText || '').split('\n').map(l => l.trim()).filter(l => l && l.length < 300);
      if (lines.length) addQuestions(formFromAnswer(lines.join('\n')).questions);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- questions ----------
  const selected = form.questions.find(q => q.id === sel) ?? null;
  const addQuestions = (list: Question[], after = sel) => {
    if (!list.length) return;
    change(f => {
      const at = after ? f.questions.findIndex(q => q.id === after) : -1;
      const qs = at < 0 ? [...f.questions, ...list] : [...f.questions.slice(0, at + 1), ...list, ...f.questions.slice(at + 1)];
      return { ...f, questions: qs };
    });
    setSel(list[list.length - 1].id);
    setView('edit');
    closeRibbonPeek();
    requestAnimationFrame(() => document.querySelector(`.module-host:not([hidden]) [data-q="${list[list.length - 1].id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  const optionWords = (type: QType) => (WITH_OPTIONS.includes(type) ? (type === 'matrix' ? [t('form.col1'), t('form.col2'), t('form.col3')] : [t('form.opt', { n: 1 }), t('form.opt', { n: 2 }), t('form.opt', { n: 3 })]) : []);
  const addType = (type: QType) => {
    const q = newQuestion(type, type === 'section' ? t('form.sectionTitle') : '', optionWords(type));
    if (type === 'matrix') q.rows = [t('form.row', { n: 1 }), t('form.row', { n: 2 }), t('form.row', { n: 3 })];
    if (type === 'likert') q.title = '';
    addQuestions([q]);
  };
  const addQuestion = () => addType(selected && selected.type !== 'section' ? selected.type : 'choice');
  const delQ = (id = sel) => { if (!id) return; const i = form.questions.findIndex(q => q.id === id); change(f => ({ ...f, questions: f.questions.filter(q => q.id !== id) })); setSel(form.questions[i + 1]?.id ?? form.questions[i - 1]?.id ?? null); };
  const dupQ = () => { if (!selected) return; addQuestions([{ ...selected, id: newId(), title: selected.title ? `${selected.title} (2)` : '' }]); };
  const moveQ = (d: -1 | 1, id = sel) => change(f => {
    const i = f.questions.findIndex(q => q.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= f.questions.length) return f;
    const qs = [...f.questions];
    [qs[i], qs[j]] = [qs[j], qs[i]];
    return { ...f, questions: qs };
  });
  const changeType = (type: QType) => {
    if (!selected) return;
    const fresh = newQuestion(type, selected.title, selected.options.length ? selected.options : optionWords(type));
    setQ(selected.id, { type, options: WITH_OPTIONS.includes(type) ? fresh.options : [], rows: type === 'matrix' ? (selected.rows.length ? selected.rows : [t('form.row', { n: 1 }), t('form.row', { n: 2 })]) : [], min: fresh.min, max: fresh.max, correct: [] });
  };
  const addTemplate = async (id: string) => {
    const tpl = FORM_TEMPLATES.find(x => x.id === id);
    if (!tpl) return;
    const fr = lang === 'fr' ? 1 : 0;
    // Every word of the template in one list, translated in one go when the language is neither English nor French.
    const all: string[] = [tpl.desc[fr]];
    tpl.qs.forEach(q => { all.push(q.w[fr]); (q.opts ?? []).forEach(o => all.push(o[fr])); (q.rows ?? []).forEach(r => all.push(r[fr])); });
    let out = all;
    if (lang !== 'en' && lang !== 'fr') {
      try { const tr = await bestTranslator(lang, 'en', () => aiTranslator(shell.ai, lang)); if (tr) { const got = await tr(all); out = all.map((w, i) => got[i] || w); } } catch { /* stays in English */ }
    }
    let k = 1;
    const qs = tpl.qs.map(x => {
      const q = newQuestion(x.type, out[k++]);
      if (x.opts) q.options = x.opts.map(() => out[k++]);
      if (x.rows) q.rows = x.rows.map(() => out[k++]);
      q.required = !!x.req;
      if (x.correct) q.correct = x.type === 'short' ? x.correct.map(String) : x.type === 'yesno' ? x.correct.map(i => (i ? 'no' : 'yes')) : x.correct.map(i => q.options[i]).filter(Boolean);
      return q;
    });
    const empty = !formRef.current.questions.length;
    change(f => ({ ...f, questions: [...f.questions, ...qs], ...(empty ? { title: t(`form.tpl.${id}` as MessageKey), description: out[0], quiz: !!tpl.quiz || f.quiz } : {}) }));
    setSel(qs[0]?.id ?? null);
    setView('edit');
    closeRibbonPeek();
  };
  const fromText = (text: string) => addQuestions(formFromAnswer(text).questions);

  // ---------- AI ----------
  const runAi = async () => {
    if (!aiAsk?.text.trim()) return;
    const { text, quiz } = aiAsk;
    const c = new AbortController();
    ctl.current = c;
    const viaWeb = shell.ai.provider?.().kind === 'web';
    if (viaWeb) setAiAsk(null); else setAiAsk({ ...aiAsk, busy: true, error: '' });
    try {
      const got = await formWithAi(shell.ai, text.trim(), lang, quiz, c.signal);
      if (!got.questions.length) throw new Error(t('form.aiEmpty'));
      const empty = !formRef.current.questions.length;
      change(f => ({ ...f, questions: [...f.questions, ...got.questions], quiz: quiz || f.quiz, ...(empty ? { title: got.title || text.trim().slice(0, 80), description: got.description } : {}) }));
      setSel(got.questions[0].id);
      setAiAsk(null);
      setView('edit');
      setNote(t('form.aiDone', { n: got.questions.length }));
    } catch (e) {
      if (c.signal.aborted) { setAiAsk(a => (a ? { ...a, busy: false } : a)); return; }
      setAiAsk({ text, quiz, busy: false, error: e instanceof Error ? e.message : String(e) });
    } finally { ctl.current = null; }
  };
  useCopilotShortcut(() => setCopilot(o => !o), rootRef);
  const startAi = (id: string) => { setCopilot(true); setCopilotStart(s => ({ id, n: (s?.n ?? 0) + 1 })); closeRibbonPeek(); };
  const formText = () => `${formRef.current.title}\n${formRef.current.description}\n` + formRef.current.questions.map((q, i) => `${i + 1}. [${q.type}] ${q.title}${q.required ? ' *' : ''}${q.options.length ? ` (${q.options.join(' / ')})` : ''}`).join('\n');
  const resultsText = () => {
    const f = formRef.current;
    return `${f.title}: ${f.replies.length} answers.\n` + f.questions.filter(q => q.type !== 'section').map(q => {
      const s = summarize(f, q);
      const what = s.kind === 'counts' ? s.counts.map(([k, n]) => `${k}: ${n}`).join(', ') : s.kind === 'average' ? `average ${s.average}` : s.kind === 'nps' ? `NPS ${s.nps}, average ${s.average}` : s.kind === 'matrix' ? Object.entries(s.matrix).map(([r, c]) => `${r} → ${c.map(([k, n]) => `${k} ${n}`).join(', ')}`).join('; ') : s.texts.slice(-30).map(x => `"${x}"`).join(' | ');
      return `- ${q.title} (${s.n} answers): ${what}`;
    }).join('\n');
  };
  const copilotHost: CopilotHost = {
    app: 'In 1 Form',
    role: 'In 1 Form makes forms, surveys and quizzes. The context lists the questions (kind, title, * when required, options) or the results. Help the person write clear, neutral, short questions, and understand the answers.',
    context: () => {
      if (view === 'results' && formRef.current.replies.length) return { label: t('form.ctxResults', { n: formRef.current.replies.length }), text: resultsText() };
      return formRef.current.questions.length ? { label: t('form.ctxForm', { n: formRef.current.questions.length }), text: formText() } : null;
    },
    actions: [
      { id: 'improve', label: t('form.ai.improve'), icon: 'pen', needsContext: true, prompt: 'Rewrite these questions so they are clear, short, neutral (not leading) and easy to answer. Keep the same kinds. Reply with the improved list, one question per line, options in brackets.' },
      { id: 'more', label: t('form.ai.more'), icon: 'new', needsContext: true, prompt: 'Suggest 5 more useful questions for this form. One per line; for choices put the options after the question mark in brackets separated by " / ".' },
      { id: 'analyze', label: t('form.ai.analyze'), icon: 'barchart', needsContext: true, prompt: 'Summarise these results for a busy reader: the 3 to 5 main findings with numbers, what people liked and disliked, and 3 actions to take. Use headings and bullet points.' },
      { id: 'quiz', label: t('form.ai.quiz'), icon: 'check', needsContext: true, prompt: 'For each question that has a right answer, give it. Then suggest 3 more quiz questions with 3 options each and say which is right.' },
      { id: 'create', label: t('form.aiCreate'), icon: 'sparkle', fill: t('form.ai.createFill'),
        ask: async (ai, request, _ctx, signal) => { const got = await formWithAi(ai, request.replace(t('form.ai.createFill').trim(), '').trim() || request, lang, false, signal); addQuestions(got.questions); return got.questions.length ? t('form.aiDone', { n: got.questions.length }) : t('form.aiEmpty'); } },
    ],
    applies: [
      { id: 'questions', label: t('form.apply.questions'), icon: 'new', run: (_p, answer) => { const got = formFromAnswer(answer).questions; addQuestions(got); return t('form.aiDone', { n: got.length }); } },
      { id: 'letter', label: t('form.apply.letter'), icon: 'letter', run: (_p, answer) => { shell.openModule('letter', undefined, { kind: 'html', title: `${form.title} – ${t('form.ai.analyze')}`, html: answer.split('\n').map(l => (l.startsWith('#') ? `<h2>${esc(l.replace(/^#+\s*/, ''))}</h2>` : `<p>${esc(l)}</p>`)).join('') }); return undefined; } },
    ],
  };

  // ---------- office in 1 ----------
  const table = (): TableData => {
    const qs = formRef.current.questions.filter(q => q.type !== 'section');
    return { header: true, rows: [
      [t('form.when'), ...qs.map(q => q.title || typeName(q.type))].map(text => ({ text, bold: true })),
      ...formRef.current.replies.map(r => [r.at.replace('T', ' ').slice(0, 16), ...qs.map(q => answerText(q, r.answers[q.id]))].map(text => ({ text }))),
    ] };
  };
  const formHtml = () => {
    const f = formRef.current;
    const box = '<span style="display:inline-block;width:12px;height:12px;border:1px solid #555;margin-right:6px"></span>';
    const qs = f.questions.map((q, i) => {
      if (q.type === 'section') return `<h2>${esc(q.title)}</h2>`;
      const opts = q.type === 'yesno' ? [t('form.yes'), t('form.no')] : q.type === 'likert' ? AGREE() : q.options;
      const body = q.type === 'matrix' ? `<table><tr><th></th>${q.options.map(o => `<th>${esc(o)}</th>`).join('')}</tr>${q.rows.map(r => `<tr><td>${esc(r)}</td>${q.options.map(() => `<td>${box}</td>`).join('')}</tr>`).join('')}</table>`
        : opts.length ? opts.map(o => `<div>${box}${esc(o)}</div>`).join('')
          : q.type === 'rating' ? '<div style="font-size:20px">☆ ☆ ☆ ☆ ☆</div>'
            : ['scale', 'nps'].includes(q.type) ? `<div>${Array.from({ length: q.max - q.min + 1 }, (_, k) => `${box}${q.min + k}`).join(' ')}</div>`
              : `<div style="border-bottom:1px solid #999;height:${q.type === 'long' || q.type === 'address' ? 72 : 26}px"></div>`;
      return `<p><b>${i + 1}. ${esc(q.title || typeName(q.type))}${q.required ? ' *' : ''}</b>${q.help ? `<br><small>${esc(q.help)}</small>` : ''}</p>${body}`;
    }).join('');
    return `<h1>${esc(f.title)}</h1>${f.description ? `<p>${esc(f.description)}</p>` : ''}${qs}`;
  };
  const reportHtml = () => {
    const f = formRef.current;
    const parts = f.questions.filter(q => q.type !== 'section').map(q => {
      const s = summarize(f, q);
      const rows = s.kind === 'counts' || (s.kind === 'nps' || s.kind === 'average') && s.counts.length ? s.counts.map(([k, n]) => `<tr><td>${esc(optLabel(q, k))}</td><td>${n}</td><td>${s.n ? Math.round((n / s.n) * 100) : 0} %</td></tr>`).join('') : '';
      const extra = s.kind === 'nps' ? `<p>NPS : ${s.nps}</p>` : s.kind === 'average' ? `<p>${esc(t('form.average'))} : ${s.average}</p>` : s.kind === 'texts' ? `<ul>${s.texts.slice(-20).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
      return `<h2>${esc(q.title || typeName(q.type))}</h2><p>${esc(t('form.nAnswers', { n: s.n }))}</p>${rows ? `<table>${rows}</table>` : ''}${extra}`;
    }).join('');
    return `<h1>${esc(f.title)}</h1><p>${esc(t('form.nAnswers', { n: f.replies.length }))}</p>${parts}`;
  };
  const optLabel = (q: Question, k: string) => (q.type === 'yesno' || q.type === 'consent' ? (k === 'yes' ? t('form.yes') : t('form.no')) : q.type === 'likert' ? AGREE()[5 - Number(k)] ?? k : k);
  const convertSource: ConvertSource = { appId: 'form', title: () => title, html: () => (view === 'results' && formRef.current.replies.length ? reportHtml() : formHtml()), tables: () => [{ name: title, table: table() }] };

  // ---------- zoom ----------
  const [natural, setNatural] = useState({ w: 760, area: 760 });
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
  }, [zoom, view, form.questions.length]);

  // ---------- keyboard ----------
  const onKey = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 's') { e.preventDefault(); void save(); return; }
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redoOnce(); else undoOnce(); }
    else if (mod && key === 'y') { e.preventDefault(); redoOnce(); }
    else if (mod && key === 'd') { e.preventDefault(); dupQ(); }
    else if (mod && key === 'enter') { e.preventDefault(); addQuestion(); }
    else if (key === 'delete' && sel) { e.preventDefault(); delQ(); }
    else if (e.altKey && key === 'arrowup') { e.preventDefault(); moveQ(-1); }
    else if (e.altKey && key === 'arrowdown') { e.preventDefault(); moveQ(1); }
    else if (key === 'escape') setSel(null);
  };

  // ---------- ribbon ----------
  const tabs: { id: Tab; label: MessageKey }[] = [
    { id: 'home', label: 'letter.tab.home' }, { id: 'insert', label: 'letter.tab.insert' }, { id: 'design', label: 'form.tab.design' },
    { id: 'answers', label: 'form.tab.answers' }, { id: 'view', label: 'letter.tab.view' }, { id: 'ai', label: 'draw.tab.ai' },
  ];
  const typeGrid = (pick: (q: QType) => void, close: () => void) => (
    <div className="fm-types">{QTYPES.map(q => <button key={q} type="button" className={`fm-type${selected?.type === q ? ' on' : ''}`} onClick={() => { close(); pick(q); }}><span aria-hidden="true">{TYPE_ICON[q]}</span>{typeName(q)}</button>)}</div>
  );
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
          <Btn icon="undo" title="letter.undo" onClick={undoOnce} disabled={!undo.current.length} />
          <Btn icon="redo" title="letter.redo" onClick={redoOnce} disabled={!redo.current.length} />
        </span>
      </div>
      <div className="ribbon-panel" role="tabpanel" onMouseDown={e => { if (!['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) e.preventDefault(); }}>
        {tab === 'home' && <>
          <Group label="form.group.questions">
            <Btn big icon="new" title="form.newQuestion" onClick={addQuestion} />
            <Drop big icon="select" title="form.addType" wide>{close => typeGrid(addType, close)}</Drop>
            <Btn text icon="copy" title="form.duplicate" onClick={dupQ} disabled={!selected} />
            <Btn text icon="trash" title="form.delete" onClick={() => delQ()} disabled={!selected} />
          </Group>
          <Group label="form.group.order">
            <Btn text icon="up" title="form.moveUp" onClick={() => moveQ(-1)} disabled={!selected || form.questions[0]?.id === sel} />
            <Btn text icon="down" title="form.moveDown" onClick={() => moveQ(1)} disabled={!selected || form.questions[form.questions.length - 1]?.id === sel} />
            <Btn text icon="pagebreak" title="form.section" onClick={() => addType('section')} />
          </Group>
          <Group label="form.group.question">
            <Drop icon="swap" title="form.changeType" text label={<span className="rb-label">{selected ? typeName(selected.type) : t('form.changeType')}</span>} disabled={!selected} wide>{close => typeGrid(changeType, close)}</Drop>
            <Btn text icon="marks" title="form.required" active={!!selected?.required} onClick={() => selected && setQ(selected.id, { required: !selected.required })} disabled={!selected || selected.type === 'section'} />
            <Btn text icon="comment" title="form.helpText" active={!!selected?.help} onClick={() => selected && setAsk({ title: t('form.helpText'), label: t('form.helpLead'), value: selected.help, ok: v => setQ(selected.id, { help: v }) })} disabled={!selected} />
          </Group>
          <Group label="form.group.options">
            <Btn text icon="new" title="form.addOption" onClick={() => selected && setQ(selected.id, { options: [...selected.options, t('form.opt', { n: selected.options.length + 1 })] })} disabled={!selected || !WITH_OPTIONS.includes(selected.type)} />
            <Btn text icon="alt" title="form.otherOption" active={!!selected?.other} onClick={() => selected && setQ(selected.id, { other: !selected.other })} disabled={!selected || !['choice', 'checks'].includes(selected.type)} />
            <Btn text icon="sort" title="form.sortOptions" onClick={() => selected && setQ(selected.id, { options: [...selected.options].sort((a, b) => a.localeCompare(b, lang)) })} disabled={!selected || selected.options.length < 2} />
          </Group>
        </>}

        {tab === 'insert' && <>
          <Group label="form.group.ready">
            <Drop big icon="diagram" title="form.templates" wide>
              {close => <div className="fm-templates">{FORM_TEMPLATES.map(x => <button key={x.id} type="button" className="fm-tpl" onClick={() => { close(); void addTemplate(x.id); }}><span aria-hidden="true">{x.icon}</span>{t(`form.tpl.${x.id}` as MessageKey)}</button>)}</div>}
            </Drop>
            <Btn big icon="sparkle" title="form.aiCreate" onClick={() => setAiAsk({ text: '', quiz: false, busy: false, error: '' })} />
          </Group>
          <Group label="form.group.add">
            <Drop big icon="select" title="form.addType" wide>{close => typeGrid(addType, close)}</Drop>
            <Btn text icon="pagebreak" title="form.section" onClick={() => addType('section')} />
            <Btn text icon="lines" title="form.fromText" onClick={() => setAsk({ title: t('form.fromText'), label: t('form.fromTextLead'), value: '', long: true, ok: fromText })} />
          </Group>
          <Group label="form.group.quick">
            <Btn text icon="user" title="form.quickContact" onClick={() => addQuestions([newQuestion('name', t('form.type.name')), newQuestion('email', t('form.type.email')), newQuestion('phone', t('form.type.phone'))])} />
            <Btn text icon="heart" title="form.quickNps" onClick={() => addQuestions([newQuestion('nps', t('form.npsTitle'))])} />
            <Btn text icon="check" title="form.quickConsent" onClick={() => { const q = newQuestion('consent', t('form.consentTitle')); q.required = true; addQuestions([q]); }} />
          </Group>
        </>}

        {tab === 'design' && <>
          <Group label="form.group.look">
            <Drop big icon="theme" title="form.theme" wide>
              {close => <div className="fm-themes">{THEMES.map(x => <button key={x.id} type="button" className={`fm-theme-pick${form.theme === x.id ? ' on' : ''}`} onClick={() => { close(); change(f => ({ ...f, theme: x.id })); }}><i style={{ background: x.head }} />{t(`form.theme.${x.id}` as MessageKey)}</button>)}</div>}
            </Drop>
            <Drop big icon="case" title="form.font" wide>
              {close => <div className="fm-fonts">{FONTS.map(f => <button key={f} type="button" className={form.font === f ? 'on' : ''} style={{ fontFamily: f }} onClick={() => { close(); change(x => ({ ...x, font: f })); }}>{f}</button>)}</div>}
            </Drop>
          </Group>
          <Group label="form.group.settings">
            <Btn text icon="check" title="form.quiz" active={form.quiz} onClick={() => change(f => ({ ...f, quiz: !f.quiz }))} />
            <Btn text icon="swap" title="form.shuffle" active={form.shuffle} onClick={() => change(f => ({ ...f, shuffle: !f.shuffle }))} />
            <Btn text icon="linechart" title="form.progress" active={form.progress} onClick={() => change(f => ({ ...f, progress: !f.progress }))} />
          </Group>
          <Group label="form.group.texts">
            <Btn text icon="heart" title="form.thanks" onClick={() => setAsk({ title: t('form.thanks'), label: t('form.thanksLead'), value: form.thanks || t('form.thanksDefault'), ok: v => change(f => ({ ...f, thanks: v })) })} />
            <Btn text icon="pen" title="form.description" onClick={() => setAsk({ title: t('form.description'), label: t('form.descriptionLead'), value: form.description, long: true, ok: v => change(f => ({ ...f, description: v })) })} />
          </Group>
        </>}

        {tab === 'answers' && <>
          <Group label="form.group.collect">
            <Btn big icon="send" title="form.share" onClick={() => void shareFile()} />
            <Btn big icon="tablet" title="form.fillHere" active={view === 'fill'} onClick={() => { setView('fill'); closeRibbonPeek(); }} />
            <Btn text icon="download" title="form.import" onClick={() => setImporting('')} />
            <Btn text icon="shield" title="form.open" active={form.open} onClick={() => change(f => ({ ...f, open: !f.open }))} />
          </Group>
          <Group label="form.group.results">
            <Btn big icon="barchart" title="form.results" active={view === 'results'} onClick={() => { setView('results'); closeRibbonPeek(); }} />
            <Btn text icon="sheet" title="form.toCsv" onClick={() => void exportAs('csv')} disabled={!form.replies.length} />
            <Btn text icon="trash" title="form.clearAnswers" onClick={() => setAsk({ title: t('form.clearAnswers'), label: t('form.clearSure', { n: form.replies.length }), value: '', danger: true, ok: () => change(f => ({ ...f, replies: [] })) })} disabled={!form.replies.length} />
          </Group>
        </>}

        {tab === 'view' && <>
          <Group label="form.group.views">
            <Btn big icon="pen" title="form.view.edit" active={view === 'edit'} onClick={() => setView('edit')} />
            <Btn big icon="tablet" title="form.view.fill" active={view === 'fill'} onClick={() => setView('fill')} />
            <Btn big icon="barchart" title="form.view.results" active={view === 'results'} onClick={() => setView('results')} />
          </Group>
          <Group label="form.group.preview">
            <Btn text icon="phone" title="form.previewPhone" active={narrow} onClick={() => { setView('fill'); setZoom(1); setNarrow(true); }} />
            <Btn text icon="desktop" title="form.previewPc" active={view === 'fill' && !narrow} onClick={() => { setView('fill'); setNarrow(false); }} />
          </Group>
          <Group label="letter.group.zoom">
            <Btn big icon="zoomin" title="letter.zoomIn" onClick={() => setZoom(ZOOMS.find(z => z > k + 0.001) ?? 2.5)} />
            <Btn big icon="zoomout" title="letter.zoomOut" onClick={() => setZoom([...ZOOMS].reverse().find(z => z < k - 0.001) ?? 0.3)} />
            <Btn big icon="onepage" title="ui.fitAll" onClick={() => setZoom('fit')} />
          </Group>
        </>}

        {tab === 'ai' && <>
          <Group label="form.group.ai" accent="#7B6CF6">
            <Btn big icon="sparkle" title="form.aiCreate" onClick={() => setAiAsk({ text: '', quiz: false, busy: false, error: '' })} />
            <Btn big icon="pen" title="form.ai.improve" onClick={() => startAi('improve')} />
            <Btn big icon="barchart" title="form.ai.analyze" onClick={() => { setView('results'); startAi('analyze'); }} />
            <Btn text icon="new" title="form.ai.more" onClick={() => startAi('more')} />
            <Btn text icon="check" title="form.ai.quiz" onClick={() => startAi('quiz')} />
          </Group>
        </>}

        {tab === 'oi1' && <>
          <Group label="form.group.withClass" accent={appColor('class')}>
            <Btn big icon="sheet" title="form.toClass" onClick={() => shell.openModule('class', undefined, { kind: 'table', title, table: table() })} />
          </Group>
          <Group label="draw.group.withLetter" accent={appColor('letter')}>
            <Btn big icon="letter" title="form.toLetter" onClick={() => shell.openModule('letter', undefined, { kind: 'html', title, html: reportHtml() })} />
            <Btn text icon="file" title="form.paperToLetter" onClick={() => shell.openModule('letter', undefined, { kind: 'html', title, html: formHtml() })} />
          </Group>
          <Group label="letter.group.withProdfos" accent={appColor('prodfos')}>
            <Btn big icon="pdf" title="letter.savePdf" onClick={() => void exportAs('pdf')} />
          </Group>
          <Group label="letter.group.apps">
            <AppKeys apps={shell.apps()} self="form" onOpen={id => shell.openModule(id)} />
          </Group>
          <Group label="letter.group.share">
            <Btn big icon="print" title="form.printPaper" onClick={() => printWindow(title, formHtml(), 'body{font:11pt/1.5 Inter,Arial,sans-serif;margin:16mm}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px;text-align:center}td:first-child{text-align:left}', lang)} />
          </Group>
        </>}
        {tab === 'convert' && <ConvertPanel shell={shell} source={convertSource} />}
      </div>
    </div>
  );

  // ---------- the editor ----------
  const editor = (
    <div className="fm-edit">
      <div className="fm-head" style={{ background: theme.head, color: theme.ink ?? '#fff' }}>
        <input className="fm-title" value={form.title} aria-label={t('form.formTitle')} placeholder={t('form.untitled')} onChange={e => change(f => ({ ...f, title: e.target.value }))} />
        <textarea className="fm-desc" rows={2} value={form.description} aria-label={t('form.description')} placeholder={t('form.descriptionPh')} onChange={e => change(f => ({ ...f, description: e.target.value }))} />
      </div>
      {!form.questions.length && (
        <div className="fm-empty">
          <p>{t('form.emptyLead')}</p>
          <div>
            <button type="button" className="primary" onClick={() => addType('choice')}><Icon name="new" size={14} />{t('form.newQuestion')}</button>
            <button type="button" onClick={() => setAiAsk({ text: '', quiz: false, busy: false, error: '' })}>✦ {t('form.aiCreate')}</button>
            {FORM_TEMPLATES.slice(0, 4).map(x => <button key={x.id} type="button" onClick={() => void addTemplate(x.id)}>{x.icon} {t(`form.tpl.${x.id}` as MessageKey)}</button>)}
          </div>
        </div>
      )}
      {form.questions.map((q, i) => (
        <QuestionCard key={q.id} q={q} n={form.questions.slice(0, i + 1).filter(x => x.type !== 'section').length} on={sel === q.id} quiz={form.quiz} accent={theme.accent}
          onSelect={() => setSel(q.id)} onChange={patch => setQ(q.id, patch)} onType={changeType} onDelete={() => delQ(q.id)} onDup={() => { setSel(q.id); dupQ(); }}
          onMove={d => moveQ(d, q.id)} first={i === 0} last={i === form.questions.length - 1} />
      ))}
      {form.questions.length > 0 && (
        <div className="fm-add">
          <button type="button" className="primary" onClick={addQuestion}><Icon name="new" size={14} />{t('form.newQuestion')}</button>
          {(['choice', 'short', 'rating', 'checks', 'long', 'date'] as QType[]).map(x => <button key={x} type="button" onClick={() => addType(x)}><span aria-hidden="true">{TYPE_ICON[x]}</span> {typeName(x)}</button>)}
        </div>
      )}
    </div>
  );

  const [fillKey, setFillKey] = useState(0);
  const fill = form.questions.length ? (
    <FillView key={fillKey} form={form} theme={theme} closed={!form.open} onSubmit={answers => { change(f => ({ ...f, replies: [...f.replies, { id: newId('r'), at: new Date().toISOString(), answers }] })); }}
      onAgain={() => setFillKey(n => n + 1)} />
  ) : <div className="fm-empty"><p>{t('form.noQuestions')}</p></div>;

  const results = <Results form={form} optLabel={optLabel} onDelete={id => change(f => ({ ...f, replies: f.replies.filter(r => r.id !== id) }))} onImport={() => setImporting('')} onShare={() => void shareFile()} onFill={() => setView('fill')} />;

  return (
    <div className="formapp" ref={rootRef} tabIndex={-1} onKeyDown={onKey} style={{ '--fm-accent': theme.accent, '--fm-page': theme.page } as CSSProperties}>
      {ribbon}
      <div className="fm-body">
        <div className="fm-scroll" ref={scroller}>
          <div className="fm-bar-top">
            <span className="fm-views" role="tablist">
              {(['edit', 'fill', 'results'] as View[]).map(v => <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{t(`form.view.${v}` as MessageKey)}{v === 'results' && form.replies.length ? ` (${form.replies.length})` : ''}</button>)}
            </span>
            {view === 'edit' && <button type="button" className="fm-send" onClick={() => void shareFile()}><Icon name="send" size={14} />{t('form.share')}</button>}
          </div>
          <div className={`fm-content${narrow && view === 'fill' ? ' narrow' : ''}`} ref={content} style={{ zoom: k, fontFamily: `${form.font}, Inter, sans-serif` } as CSSProperties}>
            {view === 'edit' && editor}
            {view === 'fill' && fill}
            {view === 'results' && results}
          </div>
        </div>
        <FastScroll target={scroller} />
        {copilot && <Copilot host={copilotHost} ai={shell.ai} start={copilotStart} onClose={() => { setCopilot(false); rootRef.current?.focus(); }} />}
      </div>
      <footer className="status">
        <span>{t('form.status', { q: form.questions.filter(q => q.type !== 'section').length, n: form.replies.length })}</span>
        {note && <span className="dr-note" role="status" onAnimationEnd={() => setNote('')}>{note}</span>}
        <span className="status-file">{fileName || `${title}.oi1form`}</span>
        <span className="status-zoom">
          <button type="button" aria-label={t('letter.zoomOut')} title={t('letter.zoomOut')} onClick={() => setZoom([...ZOOMS].reverse().find(z => z < k - 0.001) ?? 0.3)}>−</button>
          <input type="range" min={30} max={250} step={5} value={Math.round(k * 100)} aria-label={t('letter.zoom')} onChange={e => setZoom(Number(e.target.value) / 100)} onDoubleClick={() => setZoom('fit')} />
          <button type="button" aria-label={t('letter.zoomIn')} title={t('letter.zoomIn')} onClick={() => setZoom(ZOOMS.find(z => z > k + 0.001) ?? 2.5)}>+</button>
          <span className="pct">{Math.round(k * 100)}%</span>
          <button type="button" className="fit" title={t('ui.fitAll')} aria-label={t('ui.fitAll')} onClick={() => setZoom('fit')}><Icon name="onepage" size={13} /></button>
        </span>
      </footer>

      {aiAsk && (
        <Dialog title={t('form.aiCreate')} onClose={() => { ctl.current?.abort(); setAiAsk(null); }} onOk={() => { void runAi(); return false; }}>
          <div className="dr-ai">
            <p>{t('form.aiLead')}</p>
            <textarea autoFocus rows={3} value={aiAsk.text} placeholder={t('form.aiPlaceholder')} aria-label={t('form.aiCreate')} disabled={aiAsk.busy}
              onChange={e => setAiAsk({ ...aiAsk, text: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void runAi(); } }} />
            <label className="fm-check"><input type="checkbox" checked={aiAsk.quiz} onChange={e => setAiAsk({ ...aiAsk, quiz: e.target.checked })} />{t('form.aiQuiz')}</label>
            <div className="dr-ai-ideas">{(['party', 'shop', 'class', 'team', 'trip', 'quiz'] as const).map(id => <button key={id} type="button" disabled={aiAsk.busy} onClick={() => setAiAsk({ ...aiAsk, text: t(`form.aiIdea.${id}` as MessageKey), quiz: id === 'quiz' || aiAsk.quiz })}>{t(`form.aiIdea.${id}` as MessageKey)}</button>)}</div>
            {aiAsk.busy && <p className="dr-ai-busy" role="status">✦ {t('draw.aiThinking')}</p>}
            {aiAsk.error && <p className="dr-ai-error" role="alert">{t('draw.aiFailed')} {aiAsk.error}</p>}
            <p className="dr-ai-who">{t('assistant.withAi', { name: shell.ai.provider?.().name ?? 'Claude' })}</p>
          </div>
        </Dialog>
      )}
      {importing !== null && (
        <Dialog title={t('form.import')} onClose={() => setImporting(null)} onOk={() => { if (importAnswers(importing)) setImporting(null); return false; }}>
          <div className="fm-import">
            <p>{t('form.importLead')}</p>
            <textarea autoFocus rows={5} value={importing} aria-label={t('form.import')} placeholder="OI1F:…" onChange={e => setImporting(e.target.value)} />
            <button type="button" onClick={() => importInput.current?.click()}><Icon name="upload" size={14} />{t('form.importFile')}</button>
          </div>
        </Dialog>
      )}
      {ask && (
        <Dialog title={ask.title} onClose={() => setAsk(null)} onOk={() => { ask.ok(ask.value); }}>
          <label className="nt-ask"><span>{ask.label}</span>
            {!ask.danger && (ask.long ? <textarea autoFocus rows={6} value={ask.value} onChange={e => setAsk({ ...ask, value: e.target.value })} /> : <input autoFocus value={ask.value} onChange={e => setAsk({ ...ask, value: e.target.value })} />)}
          </label>
        </Dialog>
      )}
      <input ref={importInput} type="file" accept=".oi1form,.json,.txt,.eml,.html" hidden onChange={e => { const f = e.target.files?.[0]; if (f) { setImporting(null); void loadFile({ name: f.name, type: f.type, text: () => f.text(), arrayBuffer: () => f.arrayBuffer() }); } e.target.value = ''; }} />
      {panel === 'file' && (
        <FileMenu fileName={fileName || `${title}.oi1form`} onClose={() => setPanel(null)}
          onNew={() => shell.openModule('form')} onOpen={async () => { const f = await shell.openFile([...EXTENSIONS, '.json', '.txt']); if (f) void loadFile(f); }} onSave={() => void save()}
          saveChoices={[
            { id: 'oi1form', icon: 'save', label: t('form.format.oi1form'), hint: '.oi1form' },
            { id: 'html', icon: 'send', label: t('form.format.html'), hint: '.html' },
            { id: 'csv', icon: 'sheet', label: t('form.format.csv'), hint: '.csv' },
            { id: 'pdf', icon: 'pdf', label: t('form.format.pdf'), hint: '.pdf' },
          ]}
          onSaveAs={f => void exportAs(f)}
          listRecent={shell.recent.list} onOpenRecent={async (r: RecentFile) => { const f = await shell.recent.open(r.id); if (f) void loadFile(f); }} />
      )}
    </div>
  );
}

// ---------- one question in the editor ----------
function QuestionCard({ q, n, on, quiz, accent, onSelect, onChange, onType, onDelete, onDup, onMove, first, last }: {
  q: Question; n: number; on: boolean; quiz: boolean; accent: string; onSelect: () => void; onChange: (p: Partial<Question>) => void; onType: (t: QType) => void;
  onDelete: () => void; onDup: () => void; onMove: (d: -1 | 1) => void; first: boolean; last: boolean;
}) {
  const isSection = q.type === 'section';
  // Enter in an option adds the next one: focus it as soon as it exists, so fast typing goes there.
  const focusOpt = useRef(-1);
  const cardRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (focusOpt.current < 0) return;
    (cardRef.current?.querySelectorAll('.fm-opts .fm-opt input')[focusOpt.current] as HTMLInputElement | undefined)?.focus();
    focusOpt.current = -1;
  }, [q.options.length]);
  const setOpt = (i: number, v: string) => onChange({ options: q.options.map((o, j) => (j === i ? v : o)), correct: q.correct.map(c => (c === q.options[i] ? v : c)) });
  const toggleCorrect = (o: string) => onChange({ correct: q.type === 'checks' ? (q.correct.includes(o) ? q.correct.filter(c => c !== o) : [...q.correct, o]) : [o] });
  return (
    <section ref={cardRef} data-q={q.id} className={`fm-card${on ? ' on' : ''}${isSection ? ' section' : ''}`} style={{ '--a': accent } as CSSProperties} onClick={onSelect} onFocus={onSelect}>
      <div className="fm-card-top">
        {!isSection && <span className="fm-n">{n}.</span>}
        <input className="fm-q-title" value={q.title} placeholder={isSection ? t('form.sectionTitle') : t('form.questionPh')} aria-label={t('form.questionTitle')} onChange={e => onChange({ title: e.target.value })} />
        {on && <select className="fm-q-type" value={q.type} aria-label={t('form.changeType')} onChange={e => onType(e.target.value as QType)}>{QTYPES.map(x => <option key={x} value={x}>{TYPE_ICON[x]} {typeName(x)}</option>)}</select>}
        {!on && q.required && <span className="fm-req" title={t('form.required')}>*</span>}
      </div>
      {(on || q.help) && <input className="fm-q-help" value={q.help} placeholder={t('form.helpPh')} aria-label={t('form.helpText')} onChange={e => onChange({ help: e.target.value })} />}
      {WITH_OPTIONS.includes(q.type) && (
        <div className="fm-opts">
          {q.type === 'matrix' && <b className="fm-sub">{t('form.columns')}</b>}
          {q.options.map((o, i) => (
            <div key={i} className="fm-opt">
              <span className="fm-mark" aria-hidden="true">{q.type === 'checks' ? '☐' : q.type === 'dropdown' || q.type === 'ranking' ? `${i + 1}.` : q.type === 'matrix' ? '▦' : '○'}</span>
              <input value={o} aria-label={t('form.opt', { n: i + 1 })} onChange={e => setOpt(i, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusOpt.current = i + 1; onChange({ options: [...q.options.slice(0, i + 1), '', ...q.options.slice(i + 1)] }); } }} />
              {quiz && on && q.type !== 'matrix' && q.type !== 'ranking' && <button type="button" className={`fm-right${q.correct.includes(o) ? ' on' : ''}`} aria-pressed={q.correct.includes(o)} title={t('form.rightAnswer')} aria-label={t('form.rightAnswer')} onClick={() => toggleCorrect(o)}>✓</button>}
              {on && q.options.length > 1 && <button type="button" className="fm-x" title={t('form.delOption')} aria-label={t('form.delOption')} onClick={() => onChange({ options: q.options.filter((_, j) => j !== i), correct: q.correct.filter(c => c !== o) })}>×</button>}
            </div>
          ))}
          {q.other && <div className="fm-opt"><span className="fm-mark">○</span><i>{t('form.other')}</i></div>}
          {on && <button type="button" className="fm-add-opt" onClick={() => onChange({ options: [...q.options, t('form.opt', { n: q.options.length + 1 })] })}>+ {t('form.addOption')}</button>}
          {q.type === 'matrix' && <>
            <b className="fm-sub">{t('form.rows')}</b>
            {q.rows.map((r, i) => (
              <div key={i} className="fm-opt">
                <span className="fm-mark">–</span>
                <input value={r} aria-label={t('form.row', { n: i + 1 })} onChange={e => onChange({ rows: q.rows.map((x, j) => (j === i ? e.target.value : x)) })} />
                {on && q.rows.length > 1 && <button type="button" className="fm-x" title={t('form.delOption')} aria-label={t('form.delOption')} onClick={() => onChange({ rows: q.rows.filter((_, j) => j !== i) })}>×</button>}
              </div>
            ))}
            {on && <button type="button" className="fm-add-opt" onClick={() => onChange({ rows: [...q.rows, t('form.row', { n: q.rows.length + 1 })] })}>+ {t('form.addRow')}</button>}
          </>}
        </div>
      )}
      {!WITH_OPTIONS.includes(q.type) && !isSection && <div className="fm-sample" aria-hidden="true"><Sample q={q} /></div>}
      {on && ['scale', 'slider', 'rating'].includes(q.type) && (
        <div className="fm-range">
          <label>{t('form.from')}<input type="number" value={q.min} onChange={e => onChange({ min: Number(e.target.value) })} /></label>
          <label>{t('form.to')}<input type="number" value={q.max} onChange={e => onChange({ max: Number(e.target.value) })} /></label>
          {q.type === 'scale' && <><input value={q.lowLabel} placeholder={t('form.lowLabel')} aria-label={t('form.lowLabel')} onChange={e => onChange({ lowLabel: e.target.value })} /><input value={q.highLabel} placeholder={t('form.highLabel')} aria-label={t('form.highLabel')} onChange={e => onChange({ highLabel: e.target.value })} /></>}
        </div>
      )}
      {on && quiz && (q.type === 'short' || q.type === 'number') && <label className="fm-quizline">{t('form.rightAnswer')}<input value={q.correct[0] ?? ''} onChange={e => onChange({ correct: e.target.value ? [e.target.value] : [] })} /></label>}
      {on && quiz && q.type === 'yesno' && <label className="fm-quizline">{t('form.rightAnswer')}<select value={q.correct[0] ?? ''} onChange={e => onChange({ correct: e.target.value ? [e.target.value] : [] })}><option value="">—</option><option value="yes">{t('form.yes')}</option><option value="no">{t('form.no')}</option></select></label>}
      {on && (
        <div className="fm-card-tools">
          {!isSection && <label className="fm-check"><input type="checkbox" checked={q.required} onChange={e => onChange({ required: e.target.checked })} />{t('form.required')}</label>}
          {quiz && !isSection && <label className="fm-points">{t('form.points')}<input type="number" min={0} max={100} value={q.points} onChange={e => onChange({ points: Math.max(0, Number(e.target.value)) })} /></label>}
          <span className="fm-grow" />
          <button type="button" title={t('form.moveUp')} aria-label={t('form.moveUp')} disabled={first} onClick={e => { e.stopPropagation(); onMove(-1); }}><Icon name="up" size={14} /></button>
          <button type="button" title={t('form.moveDown')} aria-label={t('form.moveDown')} disabled={last} onClick={e => { e.stopPropagation(); onMove(1); }}><Icon name="down" size={14} /></button>
          <button type="button" title={t('form.duplicate')} aria-label={t('form.duplicate')} onClick={e => { e.stopPropagation(); onDup(); }}><Icon name="copy" size={14} /></button>
          <button type="button" title={t('form.delete')} aria-label={t('form.delete')} onClick={e => { e.stopPropagation(); onDelete(); }}><Icon name="trash" size={14} /></button>
        </div>
      )}
    </section>
  );
}

/** What the answer looks like, in the editor. */
function Sample({ q }: { q: Question }) {
  switch (q.type) {
    case 'long': return <div className="fm-line tall" />;
    case 'yesno': return <span>○ {t('form.yes')}   ○ {t('form.no')}</span>;
    case 'rating': return <span className="fm-stars">{'★'.repeat(Math.max(3, Math.min(10, q.max)))}</span>;
    case 'scale': case 'nps': return <span className="fm-scale">{Array.from({ length: Math.max(0, Math.min(11, q.max - q.min + 1)) }, (_, i) => <i key={i}>{q.min + i}</i>)}</span>;
    case 'likert': return <span>{AGREE().join(' · ')}</span>;
    case 'slider': return <span>{q.min} ━━━●━━━ {q.max}</span>;
    case 'consent': return <span>☐ {t('form.iAgree')}</span>;
    case 'name': return <span>{t('form.first')} · {t('form.last')}</span>;
    case 'address': return <span>{t('form.street')} · {t('form.city')} · {t('form.zip')} · {t('form.country')}</span>;
    default: return <div className="fm-line"><small>{typeName(q.type)}</small></div>;
  }
}

// ---------- filling in (here, or as a preview) ----------
function FillView({ form, theme, closed, onSubmit, onAgain }: { form: Form; theme: { head: string; ink?: string; accent: string }; closed: boolean; onSubmit: (a: Record<string, Answer>) => void; onAgain: () => void }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [bad, setBad] = useState<Record<string, string>>({});
  const [done, setDone] = useState<[number, number] | null>(null);
  const seed = useMemo(() => Math.floor(Math.random() * 1e9), []);
  const qs = useMemo(() => order(form, seed), [form, seed]);
  const set = (id: string, v: Answer) => { setAnswers(a => ({ ...a, [id]: v })); if (bad[id]) setBad(b => { const c = { ...b }; delete c[id]; return c; }); };
  const real = form.questions.filter(q => q.type !== 'section');
  const filled = real.filter(q => { const a = answers[q.id]; return a !== undefined && a !== '' && !(Array.isArray(a) && !a.length); }).length;
  const submit = () => {
    const p = problems(form, answers);
    setBad(p);
    const firstBad = qs.find(q => p[q.id]);
    if (firstBad) { document.querySelector(`.module-host:not([hidden]) [data-fill="${firstBad.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    onSubmit(answers);
    setDone(form.quiz ? score(form, answers) : [0, 0]);
  };
  const errText = (k: string) => t(`form.err.${k}` as MessageKey);
  if (done) return (
    <div className="fm-fill">
      <div className="fm-head" style={{ background: theme.head, color: theme.ink ?? '#fff' }}><h1>{form.title}</h1></div>
      <div className="fm-done">
        <h2>{form.thanks || t('form.thanksDefault')}</h2>
        {form.quiz && <p className="fm-score">{t('form.score', { got: done[0], total: done[1] })}</p>}
        <button type="button" className="primary" onClick={onAgain}>{t('form.again')}</button>
      </div>
    </div>
  );
  return (
    <div className="fm-fill">
      <div className="fm-head" style={{ background: theme.head, color: theme.ink ?? '#fff' }}><h1>{form.title}</h1>{form.description && <p>{form.description}</p>}</div>
      {closed && <p className="fm-closed" role="status">{t('form.closedNote')}</p>}
      {form.progress && <div className="fm-progress" role="progressbar" aria-valuenow={filled} aria-valuemax={real.length} aria-label={t('form.progress')}><i style={{ width: `${real.length ? (filled / real.length) * 100 : 0}%` }} /></div>}
      {qs.map(q => (
        <div key={q.id} data-fill={q.id} className={`fm-fq${q.type === 'section' ? ' section' : ''}${bad[q.id] ? ' bad' : ''}`}>
          <h3>{q.title || typeName(q.type)}{q.required && <span className="fm-req"> *</span>}</h3>
          {q.help && <small>{q.help}</small>}
          {q.type !== 'section' && <Field q={q} value={answers[q.id]} set={v => set(q.id, v)} />}
          {bad[q.id] && <p className="fm-err" role="alert">{errText(bad[q.id])}</p>}
        </div>
      ))}
      <button type="button" className="fm-submit primary" disabled={closed} onClick={submit}>{t('form.submit')}</button>
    </div>
  );
}

function Field({ q, value, set }: { q: Question; value: Answer | undefined; set: (v: Answer) => void }) {
  const s = typeof value === 'string' ? value : '';
  const arr = Array.isArray(value) ? value : [];
  const obj = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, string>;
  const input = (type: string) => <input type={type} value={s} aria-label={q.title || typeName(q.type)} onChange={e => set(e.target.value)} />;
  switch (q.type) {
    case 'short': return input('text');
    case 'email': return input('email');
    case 'phone': return input('tel');
    case 'url': return input('url');
    case 'number': return input('number');
    case 'date': return input('date');
    case 'time': return input('time');
    case 'long': return <textarea rows={4} value={s} aria-label={q.title} onChange={e => set(e.target.value)} />;
    case 'choice': case 'checks': {
      const multi = q.type === 'checks';
      const other = arr.find(x => !q.options.includes(x)) ?? (s && !q.options.includes(s) ? s : '');
      return <div className="fm-choices">
        {q.options.map(o => <label key={o} className="fm-choice"><input type={multi ? 'checkbox' : 'radio'} name={q.id} checked={multi ? arr.includes(o) : s === o} onChange={() => set(multi ? (arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o]) : o)} /><span>{o}</span></label>)}
        {q.other && <label className="fm-choice"><input type={multi ? 'checkbox' : 'radio'} name={q.id} checked={!!other} readOnly /><input className="fm-other" value={other} placeholder={t('form.other')} aria-label={t('form.other')} onChange={e => set(multi ? [...arr.filter(x => q.options.includes(x)), ...(e.target.value ? [e.target.value] : [])] : e.target.value)} /></label>}
      </div>;
    }
    case 'dropdown': return <select value={s} aria-label={q.title} onChange={e => set(e.target.value)}><option value="">{t('form.pick')}</option>{q.options.map(o => <option key={o} value={o}>{o}</option>)}</select>;
    case 'yesno': return <div className="fm-choices row">{(['yes', 'no'] as const).map(v => <label key={v} className="fm-choice"><input type="radio" name={q.id} checked={s === v} onChange={() => set(v)} /><span>{t(`form.${v}`)}</span></label>)}</div>;
    case 'consent': return <label className="fm-choice"><input type="checkbox" checked={s === 'yes'} onChange={e => set(e.target.checked ? 'yes' : '')} /><span>{t('form.iAgree')}</span></label>;
    case 'rating': return <div className="fm-stars-pick">{Array.from({ length: Math.max(3, Math.min(10, q.max)) }, (_, i) => <button key={i} type="button" className={Number(value) > i ? 'on' : ''} aria-label={`${i + 1}`} aria-pressed={Number(value) === i + 1} onClick={() => set(i + 1)}>★</button>)}</div>;
    case 'scale': case 'nps': return <div><div className="fm-nums">{Array.from({ length: Math.max(0, Math.min(21, q.max - q.min + 1)) }, (_, i) => q.min + i).map(v => <button key={v} type="button" className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => set(v)}>{v}</button>)}</div>{(q.lowLabel || q.highLabel) && <div className="fm-ends"><span>{q.lowLabel}</span><span>{q.highLabel}</span></div>}</div>;
    case 'likert': return <div className="fm-choices">{AGREE().map((l, i) => <label key={l} className="fm-choice"><input type="radio" name={q.id} checked={s === String(5 - i)} onChange={() => set(String(5 - i))} /><span>{l}</span></label>)}</div>;
    case 'slider': return <div className="fm-slider"><input type="range" min={q.min} max={q.max} value={typeof value === 'number' ? value : q.min} aria-label={q.title} onChange={e => set(Number(e.target.value))} /><b>{typeof value === 'number' ? value : '–'}</b></div>;
    case 'ranking': {
      const cur = arr.length === q.options.length ? arr : q.options;
      const swap = (i: number, j: number) => { if (j < 0 || j >= cur.length) return; const c = [...cur]; [c[i], c[j]] = [c[j], c[i]]; set(c); };
      return <ol className="fm-rank">{cur.map((o, i) => <li key={o}><span>{o}</span><button type="button" aria-label={`${o} ↑`} onClick={() => swap(i, i - 1)} disabled={i === 0}>↑</button><button type="button" aria-label={`${o} ↓`} onClick={() => swap(i, i + 1)} disabled={i === cur.length - 1}>↓</button></li>)}</ol>;
    }
    case 'matrix': return <div className="fm-matrix"><table><thead><tr><th />{q.options.map(o => <th key={o}>{o}</th>)}</tr></thead><tbody>{q.rows.map(r => <tr key={r}><td>{r}</td>{q.options.map(o => <td key={o}><input type="radio" name={`${q.id}|${r}`} aria-label={`${r}: ${o}`} checked={obj[r] === o} onChange={() => set({ ...obj, [r]: o })} /></td>)}</tr>)}</tbody></table></div>;
    case 'name': return <div className="fm-two">{(['first', 'last'] as const).map(p => <input key={p} value={obj[p] ?? ''} placeholder={t(`form.${p}`)} aria-label={t(`form.${p}`)} onChange={e => set({ ...obj, [p]: e.target.value })} />)}</div>;
    case 'address': return <div className="fm-two">{(['street', 'city', 'zip', 'country'] as const).map(p => <input key={p} value={obj[p] ?? ''} placeholder={t(`form.${p}`)} aria-label={t(`form.${p}`)} onChange={e => set({ ...obj, [p]: e.target.value })} />)}</div>;
    default: return null;
  }
}

// ---------- results ----------
function Results({ form, optLabel, onDelete, onImport, onShare, onFill }: { form: Form; optLabel: (q: Question, k: string) => string; onDelete: (id: string) => void; onImport: () => void; onShare: () => void; onFill: () => void }) {
  const [one, setOne] = useState(0);
  if (!form.replies.length) return (
    <div className="fm-results">
      <div className="fm-empty">
        <p>{t('form.noAnswers')}</p>
        <div>
          <button type="button" className="primary" onClick={onShare}><Icon name="send" size={14} />{t('form.share')}</button>
          <button type="button" onClick={onFill}><Icon name="tablet" size={14} />{t('form.fillHere')}</button>
          <button type="button" onClick={onImport}><Icon name="download" size={14} />{t('form.import')}</button>
        </div>
      </div>
    </div>
  );
  const scores = form.quiz ? form.replies.map(r => score(form, r.answers)) : [];
  const avgScore = scores.length ? Math.round((scores.reduce((x, [g]) => x + g, 0) / scores.length) * 10) / 10 : 0;
  const r = form.replies[Math.min(one, form.replies.length - 1)];
  return (
    <div className="fm-results">
      <div className="fm-kpis">
        <div><b>{form.replies.length}</b><span>{t('form.answersKpi')}</span></div>
        {form.quiz && <div><b>{avgScore} / {scores[0]?.[1] ?? 0}</b><span>{t('form.avgScore')}</span></div>}
        <div><b>{new Date(form.replies[form.replies.length - 1].at).toLocaleDateString()}</b><span>{t('form.lastAnswer')}</span></div>
      </div>
      {form.questions.filter(q => q.type !== 'section').map(q => {
        const s = summarize(form, q);
        const max = Math.max(1, ...s.counts.map(([, n]) => n));
        return (
          <section key={q.id} className="fm-res">
            <h3>{q.title || typeName(q.type)}</h3>
            <small>{t('form.nAnswers', { n: s.n })}{s.kind === 'average' ? ` · ${t('form.average')} ${s.average}` : ''}</small>
            {s.kind === 'nps' && <p className={`fm-nps${s.nps >= 30 ? ' good' : s.nps < 0 ? ' bad' : ''}`}>NPS {s.nps > 0 ? '+' : ''}{s.nps}</p>}
            {s.counts.length > 0 && <div className="fm-bars">{s.counts.map(([key, n]) => (
              <div key={key} className={`fm-barrow${q.correct.includes(key) ? ' right' : ''}`}><span className="fm-bar-label">{optLabel(q, key)}</span><span className="fm-bar"><i style={{ width: `${(n / max) * 100}%` }} /></span><b>{n}</b></div>
            ))}</div>}
            {s.kind === 'matrix' && <table className="fm-mtable"><thead><tr><th />{q.options.map(o => <th key={o}>{o}</th>)}</tr></thead><tbody>{Object.entries(s.matrix).map(([row, c]) => <tr key={row}><td>{row}</td>{c.map(([o, n]) => <td key={o}>{n}</td>)}</tr>)}</tbody></table>}
            {s.kind === 'texts' && <ul className="fm-texts">{s.texts.slice(-12).reverse().map((x, i) => <li key={i}>{x}</li>)}</ul>}
          </section>
        );
      })}
      <section className="fm-res fm-one">
        <h3>{t('form.oneByOne')}</h3>
        <div className="fm-one-nav">
          <button type="button" aria-label={t('form.prevAnswer')} title={t('form.prevAnswer')} disabled={one <= 0} onClick={() => setOne(i => i - 1)}><Icon name="prev" size={14} /></button>
          <span>{t('form.answerN', { i: Math.min(one, form.replies.length - 1) + 1, n: form.replies.length })} · {new Date(r.at).toLocaleString()}</span>
          <button type="button" aria-label={t('form.nextAnswer')} title={t('form.nextAnswer')} disabled={one >= form.replies.length - 1} onClick={() => setOne(i => i + 1)}><Icon name="next" size={14} /></button>
          <button type="button" className="fm-del" aria-label={t('form.deleteAnswer')} title={t('form.deleteAnswer')} onClick={() => { onDelete(r.id); setOne(i => Math.max(0, i - 1)); }}><Icon name="trash" size={14} /></button>
        </div>
        <dl>{form.questions.filter(q => q.type !== 'section').map(q => <div key={q.id}><dt>{q.title || typeName(q.type)}</dt><dd>{(q.type === 'yesno' || q.type === 'likert' || q.type === 'consent') && typeof r.answers[q.id] === 'string' ? optLabel(q, r.answers[q.id] as string) : answerText(q, r.answers[q.id]) || '—'}</dd></div>)}</dl>
      </section>
    </div>
  );
}

// Re-exported for tests.
export { encodeReply };
