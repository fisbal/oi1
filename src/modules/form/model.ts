// In 1 Form: the form, its questions and the answers people gave. Plain data, saved as JSON (.oi1form).
// 23 kinds of questions (more than Microsoft Forms and Google Forms), quizzes with points, and answers that come back
// from a shared form file (no server: the person who fills it sends back an answer code).

let counter = 0;
export const newId = (p = 'q') => `${p}${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const QTYPES = [
  'short', 'long', 'choice', 'checks', 'dropdown', 'yesno', 'rating', 'scale', 'nps', 'likert', 'slider', 'ranking', 'matrix',
  'date', 'time', 'number', 'email', 'phone', 'url', 'name', 'address', 'consent', 'section',
] as const;
export type QType = typeof QTYPES[number];
/** Kinds whose answer is one or more of the options. */
export const WITH_OPTIONS: QType[] = ['choice', 'checks', 'dropdown', 'ranking', 'matrix'];
export const TYPE_ICON: Record<QType, string> = {
  short: '▭', long: '¶', choice: '◉', checks: '☑', dropdown: '▾', yesno: '⇆', rating: '★', scale: '⋯', nps: '⓪', likert: '≋', slider: '⟷',
  ranking: '⇅', matrix: '▦', date: '📅', time: '🕑', number: '#', email: '@', phone: '☎', url: '🔗', name: '👤', address: '🏠', consent: '✔', section: '§',
};

export interface Question {
  id: string; type: QType; title: string; help: string; required: boolean;
  options: string[]; rows: string[]; other: boolean;
  min: number; max: number; lowLabel: string; highLabel: string;
  /** Quiz: the right options (or the exact text for short answers) and the points. */
  correct: string[]; points: number;
}
export type Answer = string | string[] | number | Record<string, string>;
export interface Reply { id: string; at: string; answers: Record<string, Answer>; }
export interface Form {
  v: 1; title: string; description: string; theme: string; font: string;
  quiz: boolean; shuffle: boolean; progress: boolean; thanks: string; open: boolean;
  questions: Question[]; replies: Reply[];
}

export function newQuestion(type: QType, title = '', options: string[] = []): Question {
  const q: Question = { id: newId(), type, title, help: '', required: false, options: [], rows: [], other: false, min: 1, max: 5, lowLabel: '', highLabel: '', correct: [], points: 1 };
  if (WITH_OPTIONS.includes(type)) q.options = options.length ? options : ['Option 1', 'Option 2', 'Option 3'];
  if (type === 'matrix') q.rows = ['Row 1', 'Row 2', 'Row 3'];
  if (type === 'scale') { q.min = 1; q.max = 10; }
  if (type === 'nps') { q.min = 0; q.max = 10; }
  if (type === 'slider') { q.min = 0; q.max = 100; }
  if (type === 'rating') { q.min = 1; q.max = 5; }
  return q;
}

export function newForm(title: string): Form {
  return { v: 1, title, description: '', theme: 'ocean', font: 'Inter', quiz: false, shuffle: false, progress: true, thanks: '', open: true, questions: [], replies: [] };
}

const str = (x: unknown, d = '') => (typeof x === 'string' ? x : d);
const strs = (x: unknown) => (Array.isArray(x) ? x.filter(s => typeof s === 'string').map(s => String(s).slice(0, 500)) : []);
const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

export function cleanQuestion(x: unknown): Question | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const type = (QTYPES as readonly string[]).includes(o.type as string) ? (o.type as QType) : 'short';
  const base = newQuestion(type, str(o.title).slice(0, 500));
  return {
    ...base, id: str(o.id) || base.id, help: str(o.help).slice(0, 1000), required: !!o.required,
    options: WITH_OPTIONS.includes(type) ? (strs(o.options).length ? strs(o.options).slice(0, 100) : base.options) : [],
    rows: type === 'matrix' ? (strs(o.rows).length ? strs(o.rows).slice(0, 50) : base.rows) : [],
    other: !!o.other, min: num(o.min, base.min), max: num(o.max, base.max), lowLabel: str(o.lowLabel), highLabel: str(o.highLabel),
    correct: strs(o.correct), points: Math.max(0, Math.min(100, num(o.points, 1))),
  };
}

export function cleanAnswers(x: unknown): Record<string, Answer> {
  const out: Record<string, Answer> = {};
  if (!x || typeof x !== 'object') return out;
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v.slice(0, 5000);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (Array.isArray(v)) out[k] = strs(v);
    else if (v && typeof v === 'object') out[k] = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, y]) => typeof y === 'string').map(([a, y]) => [a, String(y).slice(0, 500)]));
  }
  return out;
}

export function cleanForm(x: unknown, title: string): Form {
  const base = newForm(title);
  if (!x || typeof x !== 'object') return base;
  const o = x as Record<string, unknown>;
  const questions = (Array.isArray(o.questions) ? o.questions : []).map(cleanQuestion).filter((q): q is Question => !!q).slice(0, 300);
  const replies = (Array.isArray(o.replies) ? o.replies : []).map(r => {
    const y = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    return { id: str(y.id) || newId('r'), at: str(y.at) || new Date().toISOString(), answers: cleanAnswers(y.answers) };
  }).slice(0, 20000);
  return {
    ...base, title: str(o.title, title).slice(0, 300) || title, description: str(o.description).slice(0, 3000), theme: str(o.theme, base.theme), font: str(o.font, base.font),
    quiz: !!o.quiz, shuffle: !!o.shuffle, progress: o.progress !== false, thanks: str(o.thanks).slice(0, 2000), open: o.open !== false, questions, replies,
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+()\d][\d\s().-]{5,}$/;
const URL_RE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;

export const isEmpty = (a: Answer | undefined) =>
  a === undefined || a === '' || (Array.isArray(a) && !a.length) || (typeof a === 'object' && !Array.isArray(a) && !Object.values(a).some(v => v && String(v).trim()));

/** Problems with an answer: 'required', 'email', 'phone', 'url', 'number', 'range', 'rows' or ''. */
export function problemOf(q: Question, a: Answer | undefined): string {
  if (q.type === 'section') return '';
  if (isEmpty(a)) return q.required ? 'required' : '';
  if (q.type === 'consent' && q.required && a !== 'yes') return 'required';
  const s = typeof a === 'string' ? a.trim() : '';
  if (q.type === 'email' && !EMAIL.test(s)) return 'email';
  if (q.type === 'phone' && !PHONE.test(s)) return 'phone';
  if (q.type === 'url' && !URL_RE.test(s)) return 'url';
  if (q.type === 'number') { const n = Number(String(a).replace(',', '.')); if (!Number.isFinite(n)) return 'number'; }
  if (q.type === 'matrix' && q.required && typeof a === 'object' && !Array.isArray(a) && q.rows.some(r => !(a as Record<string, string>)[r])) return 'rows';
  return '';
}

export function problems(form: Form, answers: Record<string, Answer>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of form.questions) { const p = problemOf(q, answers[q.id]); if (p) out[q.id] = p; }
  return out;
}

/** Quiz points: [got, out of]. Short answers count when they match one right answer, ignoring case and accents. */
export function score(form: Form, answers: Record<string, Answer>): [number, number] {
  const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
  let got = 0, total = 0;
  for (const q of form.questions) {
    if (!q.correct.length || q.type === 'section') continue;
    total += q.points;
    const a = answers[q.id];
    if (Array.isArray(a)) { if (a.length === q.correct.length && a.every(x => q.correct.includes(x))) got += q.points; }
    else if (a !== undefined && q.correct.map(fold).includes(fold(String(a)))) got += q.points;
  }
  return [got, total];
}

/** One line of text for an answer (tables, CSV, AI). */
export function answerText(q: Question, a: Answer | undefined): string {
  if (a === undefined) return '';
  if (Array.isArray(a)) return a.join(q.type === 'ranking' ? ' > ' : '; ');
  if (typeof a === 'object') return Object.entries(a).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('; ');
  return String(a);
}

export interface Summary { kind: 'counts' | 'average' | 'texts' | 'nps' | 'matrix'; n: number; counts: [string, number][]; average: number; texts: string[]; nps: number; matrix: Record<string, [string, number][]>; }

/** What the answers to one question say: counts per option, an average, an NPS score or the texts. */
export function summarize(form: Form, q: Question): Summary {
  const list = form.replies.map(r => r.answers[q.id]).filter(a => !isEmpty(a));
  const s: Summary = { kind: 'texts', n: list.length, counts: [], average: 0, texts: [], nps: 0, matrix: {} };
  const count = (keys: string[], values: string[]) => {
    const m = new Map(keys.map(k => [k, 0]));
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()];
  };
  if (['choice', 'checks', 'dropdown', 'yesno', 'consent', 'likert'].includes(q.type)) {
    const keys = q.type === 'yesno' || q.type === 'consent' ? ['yes', 'no'] : q.type === 'likert' ? ['1', '2', '3', '4', '5'] : q.options;
    s.kind = 'counts';
    s.counts = count(keys, list.flatMap(a => (Array.isArray(a) ? a : [String(a)])));
  } else if (q.type === 'ranking') {
    // Borda count: the first place gets the most points.
    s.kind = 'counts';
    const pts = new Map(q.options.map(o => [o, 0]));
    for (const a of list) if (Array.isArray(a)) a.forEach((o, i) => pts.set(o, (pts.get(o) ?? 0) + (a.length - i)));
    s.counts = [...pts.entries()].sort((x, y) => y[1] - x[1]);
  } else if (q.type === 'matrix') {
    s.kind = 'matrix';
    for (const r of q.rows) s.matrix[r] = count(q.options, list.map(a => (typeof a === 'object' && !Array.isArray(a) ? (a as Record<string, string>)[r] : '')).filter(Boolean));
  } else if (['rating', 'scale', 'slider', 'number', 'nps'].includes(q.type)) {
    const nums = list.map(a => Number(String(a).replace(',', '.'))).filter(Number.isFinite);
    s.kind = q.type === 'nps' ? 'nps' : 'average';
    s.average = nums.length ? Math.round((nums.reduce((x, y) => x + y, 0) / nums.length) * 10) / 10 : 0;
    if (q.type === 'nps' && nums.length) s.nps = Math.round(((nums.filter(n => n >= 9).length - nums.filter(n => n <= 6).length) / nums.length) * 100);
    if (q.type !== 'number' && q.type !== 'slider') { const keys: string[] = []; for (let i = q.min; i <= q.max; i++) keys.push(String(i)); s.counts = count(keys, nums.map(String)); }
  } else {
    s.texts = list.map(a => answerText(q, a)).slice(-200);
  }
  return s;
}

const csvCell = (s: string) => (/[",;\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` : s);
/** All replies as CSV, one row per person (a leading = + - @ is neutralised so a spreadsheet never runs it). */
export function repliesCsv(form: Form, when: string): string {
  const qs = form.questions.filter(q => q.type !== 'section');
  const head = [when, ...qs.map(q => q.title || q.type)];
  const rows = form.replies.map(r => [r.at.replace('T', ' ').slice(0, 16), ...qs.map(q => answerText(q, r.answers[q.id]))]);
  return [head, ...rows].map(r => r.map(c => csvCell(c)).join(',')).join('\r\n');
}

/** An answer code: what a person who filled the shared form sends back. */
export function encodeReply(formId: string, answers: Record<string, Answer>): string {
  const json = JSON.stringify({ f: formId, a: answers, t: new Date().toISOString() });
  return `OI1F:${btoa(unescape(encodeURIComponent(json)))}`;
}

/** Every answer code found in a text (a pasted e-mail, a file): the replies, and how many codes were for another form. */
export function decodeReplies(text: string, formId: string): { replies: Reply[]; other: number } {
  const replies: Reply[] = [];
  let other = 0;
  for (const m of text.matchAll(/OI1F:([A-Za-z0-9+/=]+)/g)) {
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(m[1])))) as { f?: unknown; a?: unknown; t?: unknown };
      if (o.f !== formId) { other++; continue; }
      replies.push({ id: newId('r'), at: typeof o.t === 'string' ? o.t : new Date().toISOString(), answers: cleanAnswers(o.a) });
    } catch { /* not a code */ }
  }
  return { replies, other };
}

/** A stable id for the shared copies of a form, so their answers come back to the right form. */
export function formKey(form: Form): string {
  let h = 2166136261;
  for (const c of `${form.title}|${form.questions.map(q => q.id).join(',')}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** Questions in the order a person sees them (shuffled per person when asked, sections keep their place). */
export function order(form: Form, seed: number): Question[] {
  if (!form.shuffle) return form.questions;
  const out: Question[] = [];
  let chunk: Question[] = [];
  let s = seed || 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const flush = () => { for (let i = chunk.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [chunk[i], chunk[j]] = [chunk[j], chunk[i]]; } out.push(...chunk); chunk = []; };
  for (const q of form.questions) { if (q.type === 'section') { flush(); out.push(q); } else chunk.push(q); }
  flush();
  return out;
}
