// In 1 Plan: plans for everyone, on a computer, a tablet or a phone. Tasks on a board (like Planner or Trello), in a
// grid, on a timeline (like Project's Gantt chart) and on a calendar; buckets, dates, progress, priorities, 24 labels,
// people, checklists and tasks that wait for others (moving one moves the ones after it). 22 ready plans. Beyond a
// usual planner: "Plan with AI" turns a goal into a dated plan, the critical path shows what delays the end, and the
// status report goes to In 1 Letter, the table to In 1 Class. Saves as .oi1plan, and as CSV, calendar (.ics) or PDF.

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
import {
  BUCKET_COLORS, LABELS, PRIORITIES, addDays, cleanPlan, criticalPath, daysBetween, doneTask, fromCsv, late, makesLoop, newId, newPlan, newTask,
  parseDay, shift, stats, toCsv, toIcs, today, type Plan, type Priority, type Task,
} from './model';
import { PLAN_TEMPLATES } from './templates';
import { planWithAi, tasksFromAnswer } from './ai';

export const EXTENSIONS = ['.oi1plan'];
type Tab = 'home' | 'insert' | 'view' | 'ai' | 'oi1' | 'convert';
type View = 'board' | 'grid' | 'timeline' | 'calendar';
type Scale = 'day' | 'week' | 'month';
const DAY_W: Record<Scale, number> = { day: 36, week: 16, month: 5 };
const PRIO_COLOR: Record<Priority, string> = { urgent: '#E53935', important: '#FB8C00', medium: '#1E88E5', low: '#9E9E9E' };
const ZOOMS = [0.4, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const defaultBuckets = () => [t('plan.bucket.todo'), t('plan.bucket.doing'), t('plan.bucket.done')];

export default function PlanApp({ shell, file, handoff }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff }) {
  const [initial, setInitial] = useState<{ plan: Plan; name: string } | null>(null);
  useEffect(() => {
    void (async () => {
      let saved: { plan: Plan; name: string } | null = null;
      if (!file && !handoff) try {
        const raw = await shell.storage.load('plan');
        if (raw) { const o = JSON.parse(raw) as { plan: unknown; name?: unknown }; saved = { plan: cleanPlan(o.plan, t('plan.untitled'), defaultBuckets()), name: typeof o.name === 'string' ? o.name : '' }; }
      } catch { /* unreadable autosave */ }
      setInitial(saved ?? { plan: newPlan(t('plan.untitled'), defaultBuckets()), name: '' });
    })();
  }, [shell, file, handoff]);
  if (!initial) return <div className="plan" />;
  return <PlanEditor shell={shell} file={file} handoff={handoff} initial={initial} />;
}

function PlanEditor({ shell, file, handoff, initial }: { shell: ShellApi; file?: OpenedFile; handoff?: Handoff; initial: { plan: Plan; name: string } }) {
  useLanguage();
  const lang = getLanguage();
  const [plan, setPlanState] = useState<Plan>(initial.plan);
  const planRef = useRef(plan);
  planRef.current = plan;
  const [tab, setTab] = useState<Tab>('home');
  const [view, setView] = useState<View>('board');
  const [scale, setScale] = useState<Scale>('day');
  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hideDone, setHideDone] = useState(false);
  const [showCritical, setShowCritical] = useState(false);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [zoom, setZoomState] = useState<number | 'fit'>(1);
  const [fileName, setFileName] = useState(initial.name);
  const [fileRef, setFileRef] = useState<FileRef | undefined>();
  const [panel, setPanel] = useState<'file' | null>(null);
  const [copilot, setCopilot] = useState(false);
  const [copilotStart, setCopilotStart] = useState<{ id: string; n: number } | undefined>();
  const [aiAsk, setAiAsk] = useState<{ text: string; busy: boolean; error: string } | null>(null);
  const [ask, setAsk] = useState<{ title: string; label: string; value: string; ok: (v: string) => void; danger?: boolean } | null>(null);
  const [note, setNote] = useState('');
  const undo = useRef<Plan[]>([]);
  const redo = useRef<Plan[]>([]);
  const [, bump] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => { if (ask || aiAsk || open) closeRibbonPeek(); }, [ask, aiAsk, open]);

  // ---------- changes and undo ----------
  const commit = useCallback((next: Plan) => {
    const before = planRef.current;
    if (next === before) return;
    undo.current.push(before);
    if (undo.current.length > 200) undo.current.shift();
    redo.current = [];
    planRef.current = next;
    setPlanState(next);
    bump(n => n + 1);
  }, []);
  const change = (fn: (p: Plan) => Plan) => commit(fn(planRef.current));
  const setTask = (id: string, patch: Partial<Task>) => change(p => ({ ...p, tasks: p.tasks.map(x => (x.id === id ? { ...x, ...patch } : x)) }));
  const undoOnce = () => { const p = undo.current.pop(); if (!p) return; redo.current.push(planRef.current); planRef.current = p; setPlanState(p); bump(n => n + 1); };
  const redoOnce = () => { const n = redo.current.pop(); if (!n) return; undo.current.push(planRef.current); planRef.current = n; setPlanState(n); bump(x => x + 1); };

  // ---------- saving ----------
  const title = fileName ? fileName.replace(/\.[^.]+$/, '') : plan.name;
  useEffect(() => { shell.setTitle(title.slice(0, 40)); }, [shell, title]);
  const saveTimer = useRef(0);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void shell.storage.save('plan', JSON.stringify({ plan, name: fileName })); }, 500);
  }, [plan, fileName, shell]);
  useEffect(() => {
    shell.onRename?.(name => { setFileName(`${name}.oi1plan`); change(p => ({ ...p, name })); });
    return () => shell.onRename?.(null);
  }, [shell]); // eslint-disable-line react-hooks/exhaustive-deps
  const baseName = () => title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'plan';
  const json = () => new Blob([JSON.stringify({ app: 'In 1 Plan', ...planRef.current }, null, 1)], { type: 'application/json' });
  const save = async (saveAs = false) => {
    const name = fileName.toLowerCase().endsWith('.oi1plan') ? fileName : `${baseName()}.oi1plan`;
    const ref = await shell.saveFile(name, async () => json(), 'application/json', { target: fileRef, saveAs });
    if (ref) { setFileRef(ref); setFileName(ref.name); }
  };
  const bucketName = (id: string) => plan.buckets.find(b => b.id === id)?.name ?? '';
  const prioName = (p: Priority) => t(`plan.prio.${p}` as MessageKey);
  const csv = () => toCsv(planRef.current, [t('plan.col.title'), t('plan.col.bucket'), t('plan.col.start'), t('plan.col.due'), t('plan.col.progress'), t('plan.col.priority'), t('plan.col.who'), t('plan.col.labels'), t('plan.col.notes')], bucketName, prioName);
  const exportAs = async (f: 'oi1plan' | 'csv' | 'ics' | 'pdf') => {
    if (f === 'oi1plan') return void save(true);
    if (f === 'csv') await shell.saveFile(`${baseName()}.csv`, `﻿${csv()}`, 'text/csv', { saveAs: true });
    if (f === 'ics') await shell.saveFile(`${baseName()}.ics`, toIcs(planRef.current), 'text/calendar', { saveAs: true });
    if (f === 'pdf') { const m = await runConvert(shell, convertSource, 'pdf', ''); if (m) setNote(m); }
  };
  const quietSave = useRef<() => Promise<FileRef | null>>(async () => null);
  quietSave.current = async () => {
    const own = !!fileRef?.handle && fileName.toLowerCase().endsWith('.oi1plan');
    if (!own && !shell.cloudOn?.()) return null;
    return shell.saveFile(own ? fileName : `${baseName()}.oi1plan`, async () => json(), 'application/json', { target: own ? fileRef : undefined, quiet: true });
  };
  useEffect(() => { shell.autoSave(() => quietSave.current()); return () => shell.autoSave(null); }, [shell]);
  const loadFile = async (f: OpenedFile) => {
    const text = await f.text();
    const name = f.name.toLowerCase();
    if (name.endsWith('.csv')) {
      const got = fromCsv(text, planRef.current.buckets[0].id);
      if (!got.length) { setNote(t('plan.badFile')); return; }
      change(p => ({ ...p, tasks: [...p.tasks, ...got] }));
      setNote(t('plan.imported', { n: got.length }));
      return;
    }
    try {
      const p = cleanPlan(JSON.parse(text), f.name.replace(/\.[^.]+$/, ''), defaultBuckets());
      commit(p); setFileName(f.name); setFileRef(f);
    } catch { setNote(t('plan.badFile')); }
  };
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (file) void loadFile(file);
    if (handoff?.kind === 'file') void loadFile(handoff.file);
    if (handoff?.kind === 'table') {
      const rows = handoff.table.rows.slice(handoff.table.header === false ? 0 : 1).map(r => r[0]?.text?.trim()).filter(Boolean) as string[];
      if (rows.length) addTasks(rows.map((x, i) => newTask(planRef.current.buckets[0].id, x, addDays(today(), i), 2)));
    }
    if (handoff?.kind === 'html') {
      const lines = (new DOMParser().parseFromString(handoff.html, 'text/html').body.innerText || '').split('\n').map(l => l.trim()).filter(l => l && l.length < 200);
      if (lines.length) addTasks(lines.slice(0, 60).map((x, i) => newTask(planRef.current.buckets[0].id, x, addDays(today(), i), 2)));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- tasks and buckets ----------
  const addTasks = (list: Task[]) => { if (!list.length) return; change(p => ({ ...p, tasks: [...p.tasks, ...list] })); setSel(list[list.length - 1].id); };
  const addTask = (bucket = plan.buckets[0].id) => {
    const tk = newTask(bucket, t('plan.newTaskTitle', { n: plan.tasks.length + 1 }));
    addTasks([tk]); setOpen(tk.id); closeRibbonPeek();
  };
  const selected = plan.tasks.find(x => x.id === sel) ?? null;
  const delTask = (id = sel) => { if (!id) return; change(p => ({ ...p, tasks: p.tasks.filter(x => x.id !== id).map(x => ({ ...x, deps: x.deps.filter(d => d !== id) })) })); setSel(null); setOpen(null); };
  const dupTask = () => { if (!selected) return; const c = { ...selected, id: newId(), title: `${selected.title} (2)`, checklist: selected.checklist.map(x => ({ ...x, id: newId('c') })), deps: [...selected.deps] }; addTasks([c]); };
  const doneBucket = () => plan.buckets.find(b => /done|fait|termin|hecho|feito|erledigt/i.test(b.name)) ?? plan.buckets[plan.buckets.length - 1];
  const markDone = () => { if (!selected) return; const done = selected.progress >= 100; setTask(selected.id, done ? { progress: 0, bucket: plan.buckets[0].id } : { progress: 100, bucket: doneBucket().id, checklist: selected.checklist.map(c => ({ ...c, done: true })) }); };
  const addBucket = () => setAsk({ title: t('plan.newBucket'), label: t('plan.name'), value: t('plan.bucketN', { n: plan.buckets.length + 1 }), ok: v => change(p => ({ ...p, buckets: [...p.buckets, { id: newId('b'), name: v.trim() || '—', color: BUCKET_COLORS[p.buckets.length % BUCKET_COLORS.length] }] })) });
  const selBucket = selected ? plan.buckets.find(b => b.id === selected.bucket) ?? plan.buckets[0] : plan.buckets[0];
  const renameBucket = (id = selBucket.id) => { const b = plan.buckets.find(x => x.id === id)!; setAsk({ title: t('plan.renameBucket'), label: t('plan.name'), value: b.name, ok: v => { if (v.trim()) change(p => ({ ...p, buckets: p.buckets.map(x => (x.id === id ? { ...x, name: v.trim() } : x)) })); } }); };
  const deleteBucket = (id = selBucket.id) => {
    if (plan.buckets.length < 2) { setNote(t('plan.lastBucket')); return; }
    const b = plan.buckets.find(x => x.id === id)!;
    setAsk({ title: t('plan.deleteBucket'), label: t('plan.deleteBucketSure', { name: b.name }), value: '', danger: true, ok: () => change(p => {
      const rest = p.buckets.filter(x => x.id !== id);
      return { ...p, buckets: rest, tasks: p.tasks.map(x => (x.bucket === id ? { ...x, bucket: rest[0].id } : x)) };
    }) });
  };
  const moveTo = (id: string, bucket: string, before?: string) => change(p => {
    const tk = p.tasks.find(x => x.id === id);
    if (!tk) return p;
    const rest = p.tasks.filter(x => x.id !== id);
    const moved = { ...tk, bucket, ...(bucket === doneBucket().id ? { progress: 100 } : tk.progress >= 100 ? { progress: 0 } : {}) };
    const at = before ? rest.findIndex(x => x.id === before) : -1;
    return { ...p, tasks: at < 0 ? [...rest, moved] : [...rest.slice(0, at), moved, ...rest.slice(at)] };
  });
  const toggleLabel = (id: string) => { if (selected) setTask(selected.id, { labels: selected.labels.includes(id) ? selected.labels.filter(x => x !== id) : [...selected.labels, id] }); };
  const addTemplate = async (id: string) => {
    const tpl = PLAN_TEMPLATES.find(x => x.id === id);
    if (!tpl) return;
    const fr = lang === 'fr' ? 1 : 0;
    let words = tpl.tasks.map(x => x.w[fr]);
    if (lang !== 'en' && lang !== 'fr') {
      try { const tr = await bestTranslator(lang, 'en', () => aiTranslator(shell.ai, lang)); if (tr) { const got = await tr(words); words = words.map((w, i) => got[i] || w); } } catch { /* stays in English */ }
    }
    const start = today();
    const list = tpl.tasks.map((x, i) => newTask(planRef.current.buckets[0].id, words[i], addDays(start, x.at), x.days));
    tpl.tasks.forEach((x, i) => { if (x.after !== undefined && list[x.after]) list[i].deps = [list[x.after].id]; });
    addTasks(list);
    if (!plan.tasks.length) change(p => ({ ...p, name: t(`plan.tpl.${id}` as MessageKey) }));
    setView('timeline');
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
      const list = await planWithAi(shell.ai, text, lang, today(), planRef.current.buckets[0].id, c.signal);
      if (!list.length) throw new Error(t('plan.aiEmpty'));
      addTasks(list);
      if (!planRef.current.tasks.length || planRef.current.name === t('plan.untitled')) change(p => ({ ...p, name: text.slice(0, 60) }));
      setAiAsk(null);
      setView('timeline');
      setNote(t('plan.aiDone', { n: list.length }));
    } catch (e) {
      if (c.signal.aborted) { setAiAsk(a => (a ? { ...a, busy: false } : a)); return; }
      setAiAsk({ text, busy: false, error: e instanceof Error ? e.message : String(e) });
    } finally { ctl.current = null; }
  };
  useCopilotShortcut(() => setCopilot(o => !o), rootRef);
  const startAi = (id: string) => { setCopilot(true); setCopilotStart(s => ({ id, n: (s?.n ?? 0) + 1 })); closeRibbonPeek(); };
  const planText = () => {
    const s = stats(planRef.current);
    return `${planRef.current.name}: ${s.n} tasks, ${s.done} done, ${s.late} late, ${s.avg}% overall, from ${s.start} to ${s.end}.\n` +
      planRef.current.tasks.map(x => `- ${x.title} [${bucketName(x.bucket)}] ${x.start} → ${x.due}, ${x.progress}%, ${x.priority}${x.who ? `, ${x.who}` : ''}${late(x) ? ', LATE' : ''}`).join('\n');
  };
  const copilotHost: CopilotHost = {
    app: 'In 1 Plan',
    role: 'In 1 Plan is a project planner: buckets (columns) of tasks with start and due dates, progress, priority, people and tasks they wait for. The context lists the plan, or the selected task. Help the person plan well: break tasks down, spot risks and late work, write status reports.',
    context: () => {
      const s = planRef.current.tasks.find(x => x.id === sel);
      if (s) return { label: t('plan.ctxTask', { name: s.title }), text: `Task: ${s.title}\nDates: ${s.start} → ${s.due}\nProgress: ${s.progress}%\nNotes: ${s.notes}\nChecklist: ${s.checklist.map(c => c.text).join('; ')}`, at: s.id };
      return planRef.current.tasks.length ? { label: t('plan.ctxPlan', { n: planRef.current.tasks.length }), text: planText() } : null;
    },
    actions: [
      { id: 'report', label: t('plan.ai.report'), icon: 'letter', needsContext: true, prompt: 'Write a short status report of this plan: where we are, what is late, what comes next, risks. Use headings and bullet points.' },
      { id: 'risks', label: t('plan.ai.risks'), icon: 'shield', needsContext: true, prompt: 'List the 5 main risks of this plan, each with a simple way to reduce it.' },
      { id: 'next', label: t('plan.ai.next'), icon: 'next', needsContext: true, prompt: 'Say in 3 to 5 bullet points what to do first this week, given dates, progress and priorities.' },
      { id: 'breakdown', label: t('plan.ai.breakdown'), icon: 'check', needsContext: true, prompt: 'Break this into 4 to 8 concrete steps. Reply with only the steps, one per line, each starting with "- ".' },
      { id: 'plan', label: t('plan.aiPlan'), icon: 'sparkle', fill: t('plan.ai.planFill'),
        ask: async (ai, request, _ctx, signal) => { const list = await planWithAi(ai, request.replace(t('plan.ai.planFill').trim(), '').trim() || request, lang, today(), planRef.current.buckets[0].id, signal); addTasks(list); return list.length ? t('plan.aiDone', { n: list.length }) : t('plan.aiEmpty'); } },
    ],
    applies: [
      { id: 'checklist', label: t('plan.apply.checklist'), icon: 'check', run: (_p, answer, at) => {
        const id = typeof at === 'string' ? at : sel;
        const tk = planRef.current.tasks.find(x => x.id === id);
        if (!tk) return t('plan.pickTask');
        const lines = answer.split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(l => l && l.length < 200 && !l.startsWith('#'));
        setTask(tk.id, { checklist: [...tk.checklist, ...lines.slice(0, 30).map(text => ({ id: newId('c'), text, done: false }))] });
        return t('plan.applied');
      } },
      { id: 'tasks', label: t('plan.apply.tasks'), icon: 'new', run: (_p, answer) => { const list = tasksFromAnswer(answer, today(), planRef.current.buckets[0].id); addTasks(list); return t('plan.aiDone', { n: list.length }); } },
      { id: 'letter', label: t('plan.apply.letter'), icon: 'letter', run: (_p, answer) => { shell.openModule('letter', undefined, { kind: 'html', title: `${plan.name} – ${t('plan.ai.report')}`, html: answer.split('\n').map(l => (l.startsWith('#') ? `<h2>${esc(l.replace(/^#+\s*/, ''))}</h2>` : `<p>${esc(l)}</p>`)).join('') }); return undefined; } },
    ],
  };

  // ---------- office in 1 ----------
  const table = (): TableData => ({ header: true, rows: [
    [t('plan.col.title'), t('plan.col.bucket'), t('plan.col.start'), t('plan.col.due'), t('plan.col.progress'), t('plan.col.priority'), t('plan.col.who')].map(text => ({ text, bold: true })),
    ...planRef.current.tasks.map(x => [x.title, bucketName(x.bucket), x.start, x.due, String(x.progress), prioName(x.priority), x.who].map(text => ({ text }))),
  ] });
  const reportHtml = () => {
    const s = stats(planRef.current);
    const rows = planRef.current.tasks.map(x => `<tr><td>${esc(x.title)}</td><td>${esc(bucketName(x.bucket))}</td><td>${x.start}</td><td>${x.due}</td><td>${x.progress} %</td><td>${esc(prioName(x.priority))}</td><td>${esc(x.who)}</td></tr>`).join('');
    return `<h1>${esc(planRef.current.name)}</h1><p>${esc(t('plan.summary', { n: s.n, done: s.done, late: s.late, avg: s.avg }))}</p><p>${s.start} → ${s.end}</p>` +
      `<table><thead><tr>${table().rows[0].map(c => `<th>${esc(c.text)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
  };
  const convertSource: ConvertSource = { appId: 'plan', title: () => title, html: reportHtml, tables: () => [{ name: title, table: table() }] };

  // ---------- zoom ----------
  const [natural, setNatural] = useState({ w: 800, area: 800 });
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
  }, [zoom, view, scale, plan.tasks.length, plan.buckets.length]);

  // ---------- keyboard ----------
  const onKey = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redoOnce(); else undoOnce(); }
    else if (mod && key === 'y') { e.preventDefault(); redoOnce(); }
    else if (mod && key === 's') { e.preventDefault(); void save(); }
    else if (mod && key === 'd') { e.preventDefault(); dupTask(); }
    else if (key === 'insert' || (mod && key === 'enter')) { e.preventDefault(); addTask(); }
    else if (key === 'delete' && sel) { e.preventDefault(); delTask(); }
    else if (key === 'enter' && sel) { e.preventDefault(); setOpen(sel); }
    else if (key === 'escape') { setSel(null); setOpen(null); }
  };

  // ---------- what is shown ----------
  const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const shown = plan.tasks.filter(x => (!hideDone || !doneTask(x)) && (!query.trim() || fold(`${x.title} ${x.notes} ${x.who}`).includes(fold(query.trim()))));
  const critical = useMemo(() => (showCritical ? criticalPath(plan) : new Set<string>()), [plan, showCritical]);
  const s = stats(plan);

  // ---------- ribbon ----------
  const tabs: { id: Tab; label: MessageKey }[] = [
    { id: 'home', label: 'letter.tab.home' }, { id: 'insert', label: 'letter.tab.insert' }, { id: 'view', label: 'letter.tab.view' }, { id: 'ai', label: 'draw.tab.ai' },
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
          <Btn icon="undo" title="letter.undo" onClick={undoOnce} disabled={!undo.current.length} />
          <Btn icon="redo" title="letter.redo" onClick={redoOnce} disabled={!redo.current.length} />
        </span>
      </div>
      <div className="ribbon-panel" role="tabpanel" onMouseDown={e => { if (!['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) e.preventDefault(); }}>
        {tab === 'home' && <>
          <Group label="plan.group.tasks">
            <Btn big icon="new" title="plan.newTask" onClick={() => addTask(selected?.bucket)} />
            <Btn text icon="pen" title="plan.details" onClick={() => setOpen(sel)} disabled={!selected} />
            <Btn text icon="copy" title="plan.duplicate" onClick={dupTask} disabled={!selected} />
            <Btn text icon="check" title="plan.markDone" active={!!selected && doneTask(selected)} onClick={markDone} disabled={!selected} />
            <Btn text icon="trash" title="plan.delete" onClick={() => delTask()} disabled={!selected} />
          </Group>
          <Group label="plan.group.priority">
            {PRIORITIES.map(p => <Btn key={p} text label={<span className="rb-label"><i className="pl-prio-dot" style={{ background: PRIO_COLOR[p] }} />{prioName(p)}</span>} title={`plan.prio.${p}`} active={selected?.priority === p} onClick={() => selected && setTask(selected.id, { priority: p })} disabled={!selected} />)}
          </Group>
          <Group label="plan.group.progress">
            {[0, 25, 50, 75, 100].map(v => <Btn key={v} text label={<span className="rb-label">{v} %</span>} title={`plan.progress${v}`} active={selected?.progress === v} onClick={() => selected && setTask(selected.id, { progress: v, ...(v === 100 ? { bucket: doneBucket().id } : {}) })} disabled={!selected} />)}
          </Group>
          <Group label="plan.group.labels">
            <Drop big icon="marks" title="plan.labels" wide disabled={!selected}>
              {close => <div className="pl-labels">{LABELS.map(l => <button key={l.id} type="button" className={`pl-label-pick${selected?.labels.includes(l.id) ? ' on' : ''}`} onClick={() => { toggleLabel(l.id); close(); }}><i style={{ background: l.color }} />{t(`plan.label.${l.id}` as MessageKey)}</button>)}</div>}
            </Drop>
          </Group>
          <Group label="plan.group.buckets">
            <Btn big icon="columns" title="plan.newBucket" onClick={addBucket} />
            <Btn text icon="rename" title="plan.renameBucket" onClick={() => renameBucket()} />
            <Drop icon="palette" title="plan.bucketColor" swatch={selBucket.color}>
              {close => <div className="pl-swatches">{BUCKET_COLORS.map(c => <button key={c} type="button" className={`color-cell${selBucket.color === c ? ' on' : ''}`} style={{ background: c }} aria-label={c} title={c} onClick={() => { close(); change(p => ({ ...p, buckets: p.buckets.map(b => (b.id === selBucket.id ? { ...b, color: c } : b)) })); }} />)}</div>}
            </Drop>
            <Btn text icon="trash" title="plan.deleteBucket" onClick={() => deleteBucket()} />
          </Group>
        </>}

        {tab === 'insert' && <>
          <Group label="plan.group.ready">
            <Drop big icon="diagram" title="plan.templates" wide>
              {close => <div className="pl-templates">{PLAN_TEMPLATES.map(x => <button key={x.id} type="button" className="pl-tpl" onClick={() => { close(); void addTemplate(x.id); }}><span aria-hidden="true">{x.icon}</span>{t(`plan.tpl.${x.id}` as MessageKey)}</button>)}</div>}
            </Drop>
            <Btn big icon="sparkle" title="plan.aiPlan" onClick={() => setAiAsk({ text: '', busy: false, error: '' })} />
          </Group>
          <Group label="plan.group.add">
            <Btn big icon="new" title="plan.newTask" onClick={() => addTask(selected?.bucket)} />
            <Btn text icon="target" title="plan.milestone" onClick={() => { const tk = { ...newTask(plan.buckets[0].id, t('plan.milestoneTitle'), today(), 1), labels: ['red'], priority: 'important' as Priority }; addTasks([tk]); setOpen(tk.id); }} />
            <Btn text icon="check" title="plan.checkItem" onClick={() => setOpen(sel)} disabled={!selected} />
          </Group>
          <Group label="plan.group.import">
            <Btn big icon="upload" title="plan.importCsv" onClick={() => importInput.current?.click()} />
          </Group>
        </>}

        {tab === 'view' && <>
          <Group label="plan.group.views">
            <Btn big icon="columns" title="plan.view.board" active={view === 'board'} onClick={() => { setView('board'); setZoom(1); }} />
            <Btn big icon="table" title="plan.view.grid" active={view === 'grid'} onClick={() => { setView('grid'); setZoom(1); }} />
            <Btn big icon="barchart" title="plan.view.timeline" active={view === 'timeline'} onClick={() => setView('timeline')} />
            <Btn big icon="date" title="plan.view.calendar" active={view === 'calendar'} onClick={() => { setView('calendar'); setZoom(1); }} />
          </Group>
          <Group label="plan.group.scale">
            {(['day', 'week', 'month'] as Scale[]).map(x => <Btn key={x} text icon="gridlines" title={`plan.scale.${x}`} active={scale === x} onClick={() => { setScale(x); setView('timeline'); }} />)}
            <Btn text icon="goto" title="plan.today" onClick={() => { setMonth(today().slice(0, 7)); document.querySelector('.module-host:not([hidden]) .pl-today')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }} />
          </Group>
          <Group label="plan.group.show">
            <Btn text icon="filter" title="plan.hideDone" active={hideDone} onClick={() => setHideDone(v => !v)} />
            <Btn text icon="target" title="plan.critical" active={showCritical} onClick={() => { setShowCritical(v => !v); if (view !== 'timeline') setView('timeline'); }} />
          </Group>
          <Group label="letter.group.zoom">
            <Btn big icon="zoomin" title="letter.zoomIn" onClick={() => setZoom(ZOOMS.find(z => z > k + 0.001) ?? 2.5)} />
            <Btn big icon="zoomout" title="letter.zoomOut" onClick={() => setZoom([...ZOOMS].reverse().find(z => z < k - 0.001) ?? 0.3)} />
            <Btn big icon="onepage" title="ui.fitAll" onClick={() => setZoom('fit')} />
          </Group>
        </>}

        {tab === 'ai' && <>
          <Group label="plan.group.ai" accent="#7B6CF6">
            <Btn big icon="sparkle" title="plan.aiPlan" onClick={() => setAiAsk({ text: '', busy: false, error: '' })} />
            <Btn big icon="letter" title="plan.ai.report" onClick={() => startAi('report')} />
            <Btn big icon="shield" title="plan.ai.risks" onClick={() => startAi('risks')} />
            <Btn text icon="next" title="plan.ai.next" onClick={() => startAi('next')} />
            <Btn text icon="check" title="plan.ai.breakdown" onClick={() => startAi('breakdown')} disabled={!selected} />
          </Group>
        </>}

        {tab === 'oi1' && <>
          <Group label="plan.group.withClass" accent={appColor('class')}>
            <Btn big icon="sheet" title="plan.toClass" onClick={() => shell.openModule('class', undefined, { kind: 'table', title, table: table() })} />
          </Group>
          <Group label="draw.group.withLetter" accent={appColor('letter')}>
            <Btn big icon="letter" title="plan.toLetter" onClick={() => shell.openModule('letter', undefined, { kind: 'html', title, html: reportHtml() })} />
          </Group>
          <Group label="letter.group.withProdfos" accent={appColor('prodfos')}>
            <Btn big icon="pdf" title="letter.savePdf" onClick={() => void exportAs('pdf')} />
          </Group>
          <Group label="letter.group.apps">
            <AppKeys apps={shell.apps()} self="plan" onOpen={id => shell.openModule(id)} />
          </Group>
          <Group label="letter.group.share">
            <Btn big icon="date" title="plan.toCalendar" onClick={() => void exportAs('ics')} />
            <Btn big icon="print" title="letter.print" onClick={() => printWindow(title, reportHtml(), 'body{font:11pt/1.4 Inter,Arial,sans-serif;margin:14mm}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:3px 6px;text-align:left}', lang)} />
          </Group>
        </>}
        {tab === 'convert' && <ConvertPanel shell={shell} source={convertSource} />}
      </div>
    </div>
  );

  // ---------- views ----------
  const labelDots = (x: Task) => x.labels.length ? <span className="pl-dots">{x.labels.map(l => <i key={l} title={t(`plan.label.${l}` as MessageKey)} style={{ background: LABELS.find(L => L.id === l)?.color }} />)}</span> : null;
  const dueText = (x: Task) => parseDay(x.due).toLocaleDateString(lang, { day: 'numeric', month: 'short' });

  // Board: drag a card by its handle to another column (fingers too), or tap to select, double tap to open.
  const [dragCard, setDragCard] = useState<{ id: string; x: number; y: number; over: string | null; before: string | null } | null>(null);
  const cardDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setSel(id);
    lastPt.current = { x: e.clientX, y: e.clientY };
    setDragCard({ id, x: e.clientX, y: e.clientY, over: null, before: null });
  };
  const cardMove = (e: React.PointerEvent) => {
    if (!dragCard) return;
    lastPt.current = { x: e.clientX, y: e.clientY };
    const under = document.elementsFromPoint(e.clientX, e.clientY);
    const col = under.find(el => (el as HTMLElement).dataset?.bucket) as HTMLElement | undefined;
    const card = under.find(el => (el as HTMLElement).dataset?.card && (el as HTMLElement).dataset.card !== dragCard.id) as HTMLElement | undefined;
    setDragCard({ ...dragCard, x: e.clientX, y: e.clientY, over: col?.dataset.bucket ?? null, before: card?.dataset.card ?? null });
  };
  // A card held near the edge of the screen scrolls the board, so it can reach a column that is off screen (phones).
  const lastPt = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!dragCard) return;
    const id = window.setInterval(() => {
      const el = scroller.current;
      if (!el) return;
      const r = el.getBoundingClientRect(), { x, y } = lastPt.current, edge = 44;
      const dx = x > r.right - edge ? 14 : x < r.left + edge ? -14 : 0;
      const dy = y > r.bottom - edge ? 14 : y < r.top + edge ? -14 : 0;
      if (dx) el.scrollLeft += dx;
      if (dy) el.scrollTop += dy;
    }, 30);
    return () => window.clearInterval(id);
  }, [!!dragCard]); // eslint-disable-line react-hooks/exhaustive-deps
  const cardUp = () => { if (dragCard?.over) moveTo(dragCard.id, dragCard.over, dragCard.before ?? undefined); setDragCard(null); };

  const board = (
    <div className="pl-board">
      {plan.buckets.map(b => {
        const list = shown.filter(x => x.bucket === b.id);
        return (
          <section key={b.id} className={`pl-col${dragCard?.over === b.id ? ' over' : ''}`} data-bucket={b.id} style={{ '--b': b.color } as CSSProperties} aria-label={b.name}>
            <header><b onDoubleClick={() => renameBucket(b.id)}>{b.name}</b><small>{list.length}</small>
              <button type="button" className="pl-add" title={t('plan.newTask')} aria-label={t('plan.newTask')} onClick={() => addTask(b.id)}><Icon name="new" size={14} /></button></header>
            <div className="pl-cards">
              {list.map(x => (
                <article key={x.id} data-card={x.id} className={`pl-card${sel === x.id ? ' on' : ''}${dragCard?.id === x.id ? ' dragging' : ''}${late(x) ? ' late' : ''}${doneTask(x) ? ' done' : ''}`}
                  onClick={() => setSel(x.id)} onDoubleClick={() => setOpen(x.id)}>
                  <span className="pl-grip" title={t('plan.drag')} aria-label={t('plan.drag')} role="button" onPointerDown={e => cardDown(e, x.id)} onPointerMove={cardMove} onPointerUp={cardUp} onPointerCancel={() => setDragCard(null)}>⠿</span>
                  {labelDots(x)}
                  <button type="button" className="pl-check" aria-label={t('plan.markDone')} aria-pressed={doneTask(x)} onClick={e => { e.stopPropagation(); setTask(x.id, doneTask(x) ? { progress: 0 } : { progress: 100, bucket: doneBucket().id }); }}>{doneTask(x) ? '✓' : ''}</button>
                  <b className="pl-card-title">{x.title || t('plan.untitledTask')}</b>
                  <div className="pl-meta">
                    <span className="pl-prio" style={{ color: PRIO_COLOR[x.priority] }}>● {prioName(x.priority)}</span>
                    <span className={late(x) ? 'pl-late' : ''}>📅 {dueText(x)}</span>
                    {x.checklist.length > 0 && <span>☑ {x.checklist.filter(c => c.done).length}/{x.checklist.length}</span>}
                    {x.who && <span className="pl-who">{x.who}</span>}
                  </div>
                  {x.progress > 0 && x.progress < 100 && <i className="pl-bar" style={{ width: `${x.progress}%` }} />}
                  <button type="button" className="pl-open" aria-label={t('plan.details')} title={t('plan.details')} onClick={e => { e.stopPropagation(); setOpen(x.id); }}><Icon name="pen" size={12} /></button>
                </article>
              ))}
            </div>
            <button type="button" className="pl-addrow" onClick={() => addTask(b.id)}><Icon name="new" size={13} />{t('plan.newTask')}</button>
          </section>
        );
      })}
      <button type="button" className="pl-newcol" onClick={addBucket}><Icon name="new" size={14} />{t('plan.newBucket')}</button>
    </div>
  );

  const grid = (
    <table className="pl-grid">
      <thead><tr>{['title', 'bucket', 'start', 'due', 'progress', 'priority', 'who'].map(c => <th key={c}>{t(`plan.col.${c}` as MessageKey)}</th>)}</tr></thead>
      <tbody>
        {shown.map(x => (
          <tr key={x.id} className={`${sel === x.id ? 'on' : ''}${late(x) ? ' late' : ''}`} onClick={() => setSel(x.id)}>
            <td><input value={x.title} aria-label={t('plan.col.title')} onChange={e => setTask(x.id, { title: e.target.value })} /></td>
            <td><select value={x.bucket} aria-label={t('plan.col.bucket')} onChange={e => moveTo(x.id, e.target.value)}>{plan.buckets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></td>
            <td><input type="date" value={x.start} aria-label={t('plan.col.start')} onChange={e => e.target.value && setTask(x.id, { start: e.target.value, due: x.due < e.target.value ? e.target.value : x.due })} /></td>
            <td><input type="date" value={x.due} aria-label={t('plan.col.due')} onChange={e => e.target.value && setTask(x.id, { due: e.target.value < x.start ? x.start : e.target.value })} /></td>
            <td><input type="number" min={0} max={100} step={5} value={x.progress} aria-label={t('plan.col.progress')} onChange={e => setTask(x.id, { progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /></td>
            <td><select value={x.priority} aria-label={t('plan.col.priority')} onChange={e => setTask(x.id, { priority: e.target.value as Priority })}>{PRIORITIES.map(p => <option key={p} value={p}>{prioName(p)}</option>)}</select></td>
            <td><input value={x.who} aria-label={t('plan.col.who')} onChange={e => setTask(x.id, { who: e.target.value })} /></td>
          </tr>
        ))}
        <tr><td colSpan={7}><button type="button" className="pl-addrow" onClick={() => addTask()}><Icon name="new" size={13} />{t('plan.newTask')}</button></td></tr>
      </tbody>
    </table>
  );

  // Timeline: bars from start to due; drag a bar to move it (and the tasks after it), its end to change the due date.
  const tStart = addDays(shown.length ? shown.reduce((m, x) => (x.start < m ? x.start : m), shown[0].start) : today(), -3);
  const tEnd = addDays(shown.length ? shown.reduce((m, x) => (x.due > m ? x.due : m), shown[0].due) : addDays(today(), 14), 7);
  const nDays = Math.max(14, daysBetween(tStart, tEnd) + 1);
  const dw = DAY_W[scale];
  const [barDrag, setBarDrag] = useState<{ id: string; x0: number; mode: 'move' | 'end'; days: number } | null>(null);
  const barDown = (e: React.PointerEvent, id: string, mode: 'move' | 'end') => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as Element).setPointerCapture(e.pointerId); setSel(id); setBarDrag({ id, x0: e.clientX, mode, days: 0 }); };
  const barMove = (e: React.PointerEvent) => { if (barDrag) setBarDrag({ ...barDrag, days: Math.round((e.clientX - barDrag.x0) / (dw * k)) }); };
  const barUp = () => {
    if (!barDrag) return;
    const d = barDrag;
    setBarDrag(null);
    if (!d.days) return;
    if (d.mode === 'move') commit(shift(planRef.current, d.id, d.days));
    else { const x = planRef.current.tasks.find(y => y.id === d.id)!; const due = addDays(x.due, d.days); commit(shift({ ...planRef.current, tasks: planRef.current.tasks.map(y => (y.id === d.id ? { ...y, due: due < y.start ? y.start : due } : y)) }, d.id, 0)); }
  };
  const ticks = Array.from({ length: nDays }, (_, i) => addDays(tStart, i));
  const tick = (d: string) => {
    const date = parseDay(d);
    if (scale === 'day') return { show: true, text: String(date.getDate()), strong: date.getDate() === 1 || d === tStart };
    if (scale === 'week') return { show: date.getDay() === 1, text: date.toLocaleDateString(lang, { day: 'numeric', month: 'short' }), strong: false };
    return { show: date.getDate() === 1, text: date.toLocaleDateString(lang, { month: 'short', year: '2-digit' }), strong: true };
  };
  const timeline = (
    <div className="pl-timeline" style={{ '--dw': `${dw}px` } as CSSProperties}>
      <div className="pl-tl-names">
        <div className="pl-tl-head">{parseDay(tStart).toLocaleDateString(lang, { month: 'long', year: 'numeric' })}</div>
        {shown.map(x => <button key={x.id} type="button" className={`pl-tl-name${sel === x.id ? ' on' : ''}`} onClick={() => setSel(x.id)} onDoubleClick={() => setOpen(x.id)}>{labelDots(x)}<span>{x.title || t('plan.untitledTask')}</span></button>)}
      </div>
      <div className="pl-tl-chart" style={{ width: nDays * dw }}>
        <div className="pl-tl-head">{ticks.map((d, i) => { const tk = tick(d); return tk.show ? <span key={d} className={tk.strong ? 'strong' : ''} style={{ left: i * dw }}>{tk.text}</span> : null; })}</div>
        <div className="pl-tl-rows" style={{ backgroundSize: `${dw * (scale === 'day' ? 7 : scale === 'week' ? 7 : 30)}px 100%` }}>
          {today() >= tStart && today() <= tEnd && <i className="pl-today" style={{ left: daysBetween(tStart, today()) * dw + dw / 2 }} />}
          {shown.map(x => {
            const off = barDrag?.id === x.id ? barDrag.days : 0;
            const left = (daysBetween(tStart, x.start) + (barDrag?.mode === 'move' ? off : 0)) * dw;
            const width = Math.max(dw, (daysBetween(x.start, x.due) + 1 + (barDrag?.id === x.id && barDrag.mode === 'end' ? off : 0)) * dw);
            const b = plan.buckets.find(y => y.id === x.bucket);
            return (
              <div key={x.id} className="pl-tl-row">
                <div className={`pl-tl-bar${sel === x.id ? ' on' : ''}${critical.has(x.id) ? ' critical' : ''}${late(x) ? ' late' : ''}`} style={{ left, width, '--b': b?.color ?? '#8AB4F8' } as CSSProperties}
                  role="button" tabIndex={0} aria-label={`${x.title}: ${x.start} → ${x.due}`} title={`${x.title}\n${x.start} → ${x.due} · ${x.progress} %`}
                  onPointerDown={e => barDown(e, x.id, 'move')} onPointerMove={barMove} onPointerUp={barUp} onPointerCancel={() => setBarDrag(null)} onDoubleClick={() => setOpen(x.id)}>
                  <i className="pl-tl-done" style={{ width: `${x.progress}%` }} />
                  <span>{width > 60 ? x.title : ''}</span>
                  <b className="pl-tl-end" aria-hidden="true" onPointerDown={e => barDown(e, x.id, 'end')} onPointerMove={barMove} onPointerUp={barUp} />
                </div>
                {x.deps.length > 0 && <span className="pl-tl-dep" style={{ left: left - 14 }} title={t('plan.waitsFor')}>⛓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Calendar: one month, the tasks on the days they run.
  const first = parseDay(`${month}-01`);
  const gridStart = addDays(`${month}-01`, -((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weekNames = Array.from({ length: 7 }, (_, i) => parseDay(addDays('2024-01-01', i)).toLocaleDateString(lang, { weekday: 'short' }));
  const calendar = (
    <div className="pl-cal">
      <div className="pl-cal-head">
        <button type="button" aria-label={t('plan.prevMonth')} title={t('plan.prevMonth')} onClick={() => { const d = parseDay(`${month}-01`); d.setMonth(d.getMonth() - 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }}>‹</button>
        <b>{first.toLocaleDateString(lang, { month: 'long', year: 'numeric' })}</b>
        <button type="button" aria-label={t('plan.nextMonth')} title={t('plan.nextMonth')} onClick={() => { const d = parseDay(`${month}-01`); d.setMonth(d.getMonth() + 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }}>›</button>
      </div>
      <div className="pl-cal-grid">
        {weekNames.map(w => <span key={w} className="pl-cal-wd">{w}</span>)}
        {days.map(d => {
          const here = shown.filter(x => x.start <= d && x.due >= d);
          return (
            <div key={d} className={`pl-cal-day${d.slice(0, 7) !== month ? ' out' : ''}${d === today() ? ' today' : ''}`} onDoubleClick={() => { const tk = newTask(plan.buckets[0].id, t('plan.newTaskTitle', { n: plan.tasks.length + 1 }), d, 1); addTasks([tk]); setOpen(tk.id); }}>
              <small>{parseDay(d).getDate()}</small>
              {here.slice(0, 3).map(x => <button key={x.id} type="button" className={`pl-cal-task${sel === x.id ? ' on' : ''}`} style={{ '--b': plan.buckets.find(b => b.id === x.bucket)?.color } as CSSProperties} onClick={() => setSel(x.id)} onDoubleClick={e => { e.stopPropagation(); setOpen(x.id); }}>{x.title}</button>)}
              {here.length > 3 && <span className="pl-cal-more">+{here.length - 3}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );

  const openTask = plan.tasks.find(x => x.id === open) ?? null;
  return (
    <div className="plan" ref={rootRef} tabIndex={-1} onKeyDown={onKey}>
      {ribbon}
      <div className="pl-body">
        <div className="pl-main">
        <div className="pl-scroll" ref={scroller}>
          <div className="pl-bar-top">
            <input className="pl-name" value={plan.name} aria-label={t('plan.planName')} onChange={e => change(p => ({ ...p, name: e.target.value }))} />
            <span className="pl-find"><Icon name="search" size={13} /><input type="search" value={query} placeholder={t('plan.filterPh')} aria-label={t('plan.filter')} onChange={e => setQuery(e.target.value)} /></span>
            <span className="pl-views" role="tablist">
              {(['board', 'grid', 'timeline', 'calendar'] as View[]).map(v => <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => { setView(v); if (v !== 'timeline') setZoom(1); }}>{t(`plan.view.${v}` as MessageKey)}</button>)}
            </span>
          </div>
          <div className="pl-content" ref={content} style={{ zoom: k } as CSSProperties}>
            {!plan.tasks.length && (
              <div className="pl-empty">
                <p>{t('plan.emptyLead')}</p>
                <div>
                  <button type="button" className="primary" onClick={() => addTask()}><Icon name="new" size={14} />{t('plan.newTask')}</button>
                  <button type="button" onClick={() => setAiAsk({ text: '', busy: false, error: '' })}>✦ {t('plan.aiPlan')}</button>
                  {PLAN_TEMPLATES.slice(0, 4).map(x => <button key={x.id} type="button" onClick={() => void addTemplate(x.id)}>{x.icon} {t(`plan.tpl.${x.id}` as MessageKey)}</button>)}
                </div>
              </div>
            )}
            {view === 'board' && board}
            {view === 'grid' && grid}
            {view === 'timeline' && timeline}
            {view === 'calendar' && calendar}
          </div>
        </div>
        <FastScroll target={scroller} />
        </div>
        {openTask && <TaskPanel task={openTask} plan={plan} prioName={prioName} onChange={patch => setTask(openTask.id, patch)} onMove={b => moveTo(openTask.id, b)}
          onDelete={() => delTask(openTask.id)} onClose={() => setOpen(null)}
          onDeps={deps => { const bad = deps.find(d => makesLoop(planRef.current, openTask.id, d)); if (bad) { setNote(t('plan.loop')); return; } commit(shift({ ...planRef.current, tasks: planRef.current.tasks.map(y => (y.id === openTask.id ? { ...y, deps } : y)) }, openTask.id, 0)); }} />}
        {copilot && <Copilot host={copilotHost} ai={shell.ai} start={copilotStart} onClose={() => { setCopilot(false); rootRef.current?.focus(); }} />}
      </div>
      <footer className="status">
        <span>{t('plan.summary', { n: s.n, done: s.done, late: s.late, avg: s.avg })}</span>
        {note && <span className="dr-note" role="status" onAnimationEnd={() => setNote('')}>{note}</span>}
        <span className="status-file">{fileName || `${title}.oi1plan`}</span>
        <span className="status-zoom">
          <button type="button" aria-label={t('letter.zoomOut')} title={t('letter.zoomOut')} onClick={() => setZoom([...ZOOMS].reverse().find(z => z < k - 0.001) ?? 0.3)}>−</button>
          <input type="range" min={30} max={250} step={5} value={Math.round(k * 100)} aria-label={t('letter.zoom')} onChange={e => setZoom(Number(e.target.value) / 100)} onDoubleClick={() => setZoom('fit')} />
          <button type="button" aria-label={t('letter.zoomIn')} title={t('letter.zoomIn')} onClick={() => setZoom(ZOOMS.find(z => z > k + 0.001) ?? 2.5)}>+</button>
          <span className="pct">{Math.round(k * 100)}%</span>
          <button type="button" className="fit" title={t('ui.fitAll')} aria-label={t('ui.fitAll')} onClick={() => setZoom('fit')}><Icon name="onepage" size={13} /></button>
        </span>
      </footer>
      {dragCard && <div className="pl-ghost" style={{ left: dragCard.x + 8, top: dragCard.y + 8 }}>{plan.tasks.find(x => x.id === dragCard.id)?.title}</div>}

      {aiAsk && (
        <Dialog title={t('plan.aiPlan')} onClose={() => { ctl.current?.abort(); setAiAsk(null); }} onOk={() => { void runAi(); return false; }}>
          <div className="dr-ai">
            <p>{t('plan.aiLead')}</p>
            <textarea autoFocus rows={3} value={aiAsk.text} placeholder={t('plan.aiPlaceholder')} aria-label={t('plan.aiPlan')} disabled={aiAsk.busy}
              onChange={e => setAiAsk({ ...aiAsk, text: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void runAi(); } }} />
            <div className="dr-ai-ideas">{(['party', 'move', 'website', 'exam', 'trip', 'launch'] as const).map(id => <button key={id} type="button" disabled={aiAsk.busy} onClick={() => setAiAsk({ ...aiAsk, text: t(`plan.aiIdea.${id}` as MessageKey) })}>{t(`plan.aiIdea.${id}` as MessageKey)}</button>)}</div>
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
      <input ref={importInput} type="file" accept=".csv,.oi1plan,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void loadFile({ name: f.name, type: f.type, text: () => f.text(), arrayBuffer: () => f.arrayBuffer() }); e.target.value = ''; }} />
      {panel === 'file' && (
        <FileMenu fileName={fileName || `${title}.oi1plan`} onClose={() => setPanel(null)}
          onNew={() => shell.openModule('plan')} onOpen={async () => { const f = await shell.openFile([...EXTENSIONS, '.csv', '.json']); if (f) void loadFile(f); }} onSave={() => void save()}
          saveChoices={[
            { id: 'oi1plan', icon: 'save', label: t('plan.format.oi1plan'), hint: '.oi1plan' },
            { id: 'csv', icon: 'sheet', label: t('plan.format.csv'), hint: '.csv' },
            { id: 'ics', icon: 'date', label: t('plan.format.ics'), hint: '.ics' },
            { id: 'pdf', icon: 'pdf', label: t('plan.format.pdf'), hint: '.pdf' },
          ]}
          onSaveAs={f => void exportAs(f)}
          listRecent={shell.recent.list} onOpenRecent={async (r: RecentFile) => { const f = await shell.recent.open(r.id); if (f) void loadFile(f); }} />
      )}
    </div>
  );
}

function TaskPanel({ task, plan, prioName, onChange, onMove, onDelete, onClose, onDeps }: {
  task: Task; plan: Plan; prioName: (p: Priority) => string; onChange: (p: Partial<Task>) => void; onMove: (bucket: string) => void;
  onDelete: () => void; onClose: () => void; onDeps: (deps: string[]) => void;
}) {
  const [item, setItem] = useState('');
  const addItem = () => { if (!item.trim()) return; onChange({ checklist: [...task.checklist, { id: newId('c'), text: item.trim(), done: false }] }); setItem(''); };
  const others = plan.tasks.filter(x => x.id !== task.id);
  return (
    <aside className="pl-panel" aria-label={t('plan.details')}>
      <header><b>{t('plan.details')}</b><button type="button" aria-label={t('letter.close')} title={t('letter.close')} onClick={onClose}><Icon name="close" size={12} /></button></header>
      <div className="pl-panel-body">
        <input className="pl-panel-title" value={task.title} aria-label={t('plan.col.title')} placeholder={t('plan.untitledTask')} onChange={e => onChange({ title: e.target.value })} autoFocus />
        <label>{t('plan.col.bucket')}<select value={task.bucket} onChange={e => onMove(e.target.value)}>{plan.buckets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <div className="pl-two">
          <label>{t('plan.col.start')}<input type="date" value={task.start} onChange={e => e.target.value && onChange({ start: e.target.value, due: task.due < e.target.value ? e.target.value : task.due })} /></label>
          <label>{t('plan.col.due')}<input type="date" value={task.due} onChange={e => e.target.value && onChange({ due: e.target.value < task.start ? task.start : e.target.value })} /></label>
        </div>
        <label>{t('plan.col.progress')} · {task.progress} %<input type="range" min={0} max={100} step={5} value={task.progress} onChange={e => onChange({ progress: Number(e.target.value) })} /></label>
        <div className="pl-two">
          <label>{t('plan.col.priority')}<select value={task.priority} onChange={e => onChange({ priority: e.target.value as Priority })}>{PRIORITIES.map(p => <option key={p} value={p}>{prioName(p)}</option>)}</select></label>
          <label>{t('plan.col.who')}<input value={task.who} onChange={e => onChange({ who: e.target.value })} /></label>
        </div>
        <div className="pl-panel-labels">{LABELS.map(l => <button key={l.id} type="button" className={task.labels.includes(l.id) ? 'on' : ''} style={{ '--l': l.color } as CSSProperties} onClick={() => onChange({ labels: task.labels.includes(l.id) ? task.labels.filter(x => x !== l.id) : [...task.labels, l.id] })}>{t(`plan.label.${l.id}` as MessageKey)}</button>)}</div>
        <label>{t('plan.col.notes')}<textarea rows={3} value={task.notes} onChange={e => onChange({ notes: e.target.value })} /></label>
        <div className="pl-checklist">
          <b>{t('plan.checklist')} {task.checklist.length ? `${task.checklist.filter(c => c.done).length}/${task.checklist.length}` : ''}</b>
          {task.checklist.map(c => (
            <div key={c.id} className="pl-item">
              <input type="checkbox" checked={c.done} aria-label={c.text} onChange={() => {
                const list = task.checklist.map(x => (x.id === c.id ? { ...x, done: !x.done } : x));
                onChange({ checklist: list, progress: Math.round((list.filter(x => x.done).length / list.length) * 100) });
              }} />
              <input value={c.text} aria-label={t('plan.checkItem')} onChange={e => onChange({ checklist: task.checklist.map(x => (x.id === c.id ? { ...x, text: e.target.value } : x)) })} />
              <button type="button" aria-label={t('plan.delete')} title={t('plan.delete')} onClick={() => onChange({ checklist: task.checklist.filter(x => x.id !== c.id) })}><Icon name="close" size={10} /></button>
            </div>
          ))}
          <div className="pl-item"><input value={item} placeholder={t('plan.addItem')} aria-label={t('plan.addItem')} onChange={e => setItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} /><button type="button" aria-label={t('plan.addItem')} title={t('plan.addItem')} onClick={addItem}><Icon name="new" size={12} /></button></div>
        </div>
        <label>{t('plan.waitsFor')}
          <select value="" onChange={e => { if (e.target.value) onDeps([...task.deps, e.target.value]); }}>
            <option value="">{t('plan.pickWait')}</option>
            {others.filter(x => !task.deps.includes(x.id)).map(x => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </label>
        {task.deps.length > 0 && <div className="pl-deps">{task.deps.map(d => <span key={d}>⛓ {plan.tasks.find(x => x.id === d)?.title}<button type="button" aria-label={t('plan.delete')} onClick={() => onDeps(task.deps.filter(x => x !== d))}>×</button></span>)}</div>}
        <button type="button" className="pl-del" onClick={onDelete}><Icon name="trash" size={13} />{t('plan.delete')}</button>
      </div>
    </aside>
  );
}
