// In 1 Plan: a plan is buckets (columns, like "To do", "Doing", "Done") holding tasks with dates, progress, priority,
// labels, a person, a checklist and the tasks they wait for. Everything read from storage, a file or an AI answer is
// checked here, field by field, before use.

export type Priority = 'urgent' | 'important' | 'medium' | 'low';
export const PRIORITIES: Priority[] = ['urgent', 'important', 'medium', 'low'];
export interface Check { id: string; text: string; done: boolean }
export interface Task {
  id: string; title: string; notes: string; bucket: string; start: string; due: string; progress: number;
  priority: Priority; labels: string[]; who: string; checklist: Check[]; deps: string[];
}
export interface Bucket { id: string; name: string; color: string }
export interface Plan { v: 1; name: string; buckets: Bucket[]; tasks: Task[] }

let counter = 0;
export const newId = (p = 't') => `${p}${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Labels: a colour and a word id (named in the interface language). */
export const LABELS: { id: string; color: string }[] = [
  { id: 'red', color: '#E53935' }, { id: 'orange', color: '#FB8C00' }, { id: 'yellow', color: '#FDD835' }, { id: 'green', color: '#43A047' },
  { id: 'teal', color: '#00897B' }, { id: 'blue', color: '#1E88E5' }, { id: 'indigo', color: '#3949AB' }, { id: 'purple', color: '#8E24AA' },
  { id: 'pink', color: '#D81B60' }, { id: 'brown', color: '#6D4C41' }, { id: 'grey', color: '#757575' }, { id: 'black', color: '#212121' },
  { id: 'design', color: '#AB47BC' }, { id: 'dev', color: '#26A69A' }, { id: 'test', color: '#7CB342' }, { id: 'money', color: '#F9A825' },
  { id: 'legal', color: '#5D4037' }, { id: 'marketing', color: '#EC407A' }, { id: 'sales', color: '#42A5F5' }, { id: 'client', color: '#FF7043' },
  { id: 'blocked', color: '#C62828' }, { id: 'idea', color: '#FFCA28' }, { id: 'meeting', color: '#5C6BC0' }, { id: 'travel', color: '#29B6F6' },
];

/** Bucket colours. */
export const BUCKET_COLORS = ['#8AB4F8', '#F6AE7A', '#81C995', '#C58AF9', '#F28B82', '#FDD663', '#78D9EC', '#E6C9A8', '#A7FFEB', '#FDCFE8',
  '#AECBFA', '#CCFF90', '#B0BEC5', '#FF8A80', '#80CBC4', '#9FA8DA', '#BCAAA4', '#F48FB1', '#A5D6A7', '#FFE082', '#90CAF9', '#CE93D8'];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => iso(new Date());
export const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s: string, n: number) => { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d); };
export const daysBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
const COLOR = /^#[0-9a-f]{6}$/i;

export function newTask(bucket: string, title = '', start = today(), days = 3): Task {
  return { id: newId(), title, notes: '', bucket, start, due: addDays(start, Math.max(0, days - 1)), progress: 0, priority: 'medium', labels: [], who: '', checklist: [], deps: [] };
}
export function newPlan(name: string, buckets: string[]): Plan {
  return { v: 1, name, buckets: buckets.map((n, i) => ({ id: newId('b'), name: n, color: BUCKET_COLORS[i % BUCKET_COLORS.length] })), tasks: [] };
}

/** A plan read back from storage or a file. */
export function cleanPlan(raw: unknown, name: string, buckets: string[]): Plan {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bs: Bucket[] = (Array.isArray(o.buckets) ? o.buckets : []).slice(0, 50).map(b => {
    const x = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
    return { id: str(x.id, 60) || newId('b'), name: str(x.name, 80) || '—', color: COLOR.test(str(x.color)) ? str(x.color) : BUCKET_COLORS[0] };
  });
  if (!bs.length) return newPlan(str(o.name, 120) || name, buckets);
  const ids = new Set(bs.map(b => b.id));
  const tasks = (Array.isArray(o.tasks) ? o.tasks : []).slice(0, 5000).map(t => cleanTask(t, bs[0].id)).map(t => (ids.has(t.bucket) ? t : { ...t, bucket: bs[0].id }));
  const tids = new Set(tasks.map(t => t.id));
  return { v: 1, name: str(o.name, 120) || name, buckets: bs, tasks: tasks.map(t => ({ ...t, deps: t.deps.filter(d => d !== t.id && tids.has(d)) })) };
}
export function cleanTask(raw: unknown, bucket: string): Task {
  const x = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const start = DATE.test(str(x.start)) ? str(x.start) : today();
  let due = DATE.test(str(x.due)) ? str(x.due) : start;
  if (due < start) due = start;
  const p = Number(x.progress);
  return {
    id: str(x.id, 60) || newId(), title: str(x.title, 300), notes: str(x.notes, 20_000), bucket: str(x.bucket, 60) || bucket, start, due,
    progress: Number.isFinite(p) ? Math.max(0, Math.min(100, Math.round(p))) : 0,
    priority: (PRIORITIES as string[]).includes(str(x.priority)) ? (str(x.priority) as Priority) : 'medium',
    labels: (Array.isArray(x.labels) ? x.labels : []).map(l => str(l, 30)).filter(l => LABELS.some(L => L.id === l)).slice(0, 12),
    who: str(x.who, 80),
    checklist: (Array.isArray(x.checklist) ? x.checklist : []).slice(0, 100).map(c => { const y = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>; return { id: str(y.id, 60) || newId('c'), text: str(y.text, 300), done: y.done === true }; }),
    deps: (Array.isArray(x.deps) ? x.deps : []).map(d => str(d, 60)).filter(Boolean).slice(0, 30),
  };
}

export const late = (t: Task, now = today()) => t.progress < 100 && t.due < now;
export const doneTask = (t: Task) => t.progress >= 100;

/** Numbers for the status bar and the report. */
export function stats(p: Plan, now = today()) {
  const n = p.tasks.length;
  const done = p.tasks.filter(doneTask).length;
  const lateN = p.tasks.filter(t => late(t, now)).length;
  const avg = n ? Math.round(p.tasks.reduce((s, t) => s + t.progress, 0) / n) : 0;
  const start = n ? p.tasks.reduce((m, t) => (t.start < m ? t.start : m), p.tasks[0].start) : now;
  const end = n ? p.tasks.reduce((m, t) => (t.due > m ? t.due : m), p.tasks[0].due) : now;
  return { n, done, late: lateN, avg, start, end };
}

/** Moves a task's dates by `days`, and the tasks that wait for it (and theirs) when they would start too early. */
export function shift(p: Plan, id: string, days: number): Plan {
  const tasks = new Map(p.tasks.map(t => [t.id, { ...t }]));
  const t = tasks.get(id);
  if (!t) return p;
  t.start = addDays(t.start, days); t.due = addDays(t.due, days);
  const queue = [id];
  const seen = new Set<string>();
  while (queue.length) {
    const cur = tasks.get(queue.shift()!)!;
    if (seen.has(cur.id)) continue;
    seen.add(cur.id);
    for (const next of tasks.values()) {
      if (!next.deps.includes(cur.id) || next.start > cur.due) continue;
      const by = daysBetween(next.start, cur.due) + 1;
      next.start = addDays(next.start, by); next.due = addDays(next.due, by);
      queue.push(next.id);
    }
  }
  return { ...p, tasks: p.tasks.map(x => tasks.get(x.id)!) };
}

/** True when adding "a waits for b" would make a loop. */
export function makesLoop(p: Plan, a: string, b: string): boolean {
  if (a === b) return true;
  const stack = [b];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === a) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(p.tasks.find(t => t.id === cur)?.deps ?? []));
  }
  return false;
}

/** The longest chain of waiting tasks, by days: the tasks that delay the end if they slip. */
export function criticalPath(p: Plan): Set<string> {
  const byId = new Map(p.tasks.map(t => [t.id, t]));
  const memo = new Map<string, { len: number; path: string[] }>();
  const best = (id: string, depth = 0): { len: number; path: string[] } => {
    if (memo.has(id)) return memo.get(id)!;
    const t = byId.get(id)!;
    let top = { len: 0, path: [] as string[] };
    if (depth < 200) for (const d of t.deps) { if (!byId.has(d)) continue; const r = best(d, depth + 1); if (r.len > top.len) top = r; }
    const out = { len: top.len + daysBetween(t.start, t.due) + 1, path: [...top.path, id] };
    memo.set(id, out);
    return out;
  };
  let top = { len: 0, path: [] as string[] };
  for (const t of p.tasks) { const r = best(t.id); if (r.len > top.len) top = r; }
  return new Set(top.path.length > 1 ? top.path : []);
}

/** CSV with a header row (Excel, Class, Project, Trello). */
export function toCsv(p: Plan, head: string[], bucketName: (id: string) => string, prio: (x: Priority) => string): string {
  const q = (s: string) => (/[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [head, ...p.tasks.map(t => [t.title, bucketName(t.bucket), t.start, t.due, String(t.progress), prio(t.priority), t.who, t.labels.join(' '), t.notes])]
    .map(r => r.map(q).join(',')).join('\r\n');
}

/** Tasks with dates as calendar events (.ics), for Google, Outlook or Apple calendars. */
export function toIcs(p: Plan): string {
  const esc = (s: string) => s.replace(/[\\;,]/g, m => `\\${m}`).replace(/\n/g, '\\n');
  const d = (s: string) => s.replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Office In 1//In 1 Plan//EN', ...p.tasks.flatMap(t => [
    'BEGIN:VEVENT', `UID:${t.id}@in1plan`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${d(t.start)}`, `DTEND;VALUE=DATE:${d(addDays(t.due, 1))}`,
    `SUMMARY:${esc(t.title)}`, ...(t.notes ? [`DESCRIPTION:${esc(t.notes.slice(0, 1000))}`] : []), 'END:VEVENT',
  ]), 'END:VCALENDAR'].join('\r\n');
}

/** A CSV file read back as tasks (first row = headers; title, start, due, progress columns found by name or place). */
export function fromCsv(text: string, bucket: string): Task[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const sep = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.toLowerCase().trim());
  const col = (names: string[], fallback: number) => { const i = head.findIndex(h => names.some(n => h.includes(n))); return i >= 0 ? i : fallback; };
  const ti = col(['title', 'task', 'name', 'tâche', 'titre', 'tarea', 'tarefa', 'aufgabe'], 0);
  const si = col(['start', 'début', 'inicio', 'início', 'beginn'], -1);
  const di = col(['due', 'end', 'fin', 'échéance', 'fecha', 'fim', 'ende', 'fällig'], -1);
  const pi = col(['progress', '%', 'avancement', 'progreso', 'progresso', 'fortschritt'], -1);
  return rows.slice(1).filter(r => r[ti]?.trim()).slice(0, 2000).map(r => cleanTask({ title: r[ti], start: si >= 0 ? r[si] : undefined, due: di >= 0 ? r[di] : undefined, progress: pi >= 0 ? parseFloat(r[pi]) : 0 }, bucket));
}
