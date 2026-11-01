// In 1 Assistant's plans: a task said in plain words becomes a short list of documents to make in the right
// Offices (Letter, Class, Stage, Code+, a PDF), with what links them. The AI writes the plan and the content in one
// answer that follows SCHEMA; the offline recipes (recipes.ts) make the same shape without any AI.

export type StepApp = 'letter' | 'class' | 'stage' | 'code' | 'pdf';
export const STEP_APPS: StepApp[] = ['letter', 'class', 'stage', 'code', 'pdf'];

export interface CodeFile { path: string; content: string }

export interface Step {
  id: string;
  app: StepApp;
  name: string;
  purpose: string;
  /** Made or not: the person can leave a step out before creating. */
  on: boolean;
  /** Letter, Stage and PDF: the content as simple HTML (Stage: each <h2> starts a slide). */
  html: string;
  /** Class: the table, first row as titles; a cell starting with "=" is a formula. */
  rows: string[][];
  /** Code+: the project's files. */
  files: CodeFile[];
  /** Letter or Stage: the id of a Class step whose table goes in, linked (Letter) or copied (Stage). */
  table: string | null;
  /** PDF: the id of the Letter step it is made from (or its own html when null). */
  from: string | null;
}

export interface Plan { title: string; summary: string; steps: Step[] }

/** Where the linked table goes in a letter written by the AI or a recipe. */
export const TABLE_MARK = '[[TABLE]]';

export const SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'steps'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['app', 'name', 'purpose', 'html', 'rows', 'files', 'table', 'from'],
        properties: {
          app: { type: 'string', enum: STEP_APPS },
          name: { type: 'string' },
          purpose: { type: 'string' },
          html: { type: 'string' },
          rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
          files: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' } } } },
          table: { type: 'integer' },
          from: { type: 'integer' },
        },
      },
    },
  },
};

export const SYSTEM = `You are In 1 Assistant, the AI of the Office In 1 suite. The person says a task in plain words; you plan it and write every document it needs, in the right apps, linked together.
Apps (field "app"):
- "letter" (In 1 Letter, like Word): letters, CVs, reports, minutes, invitations. Put the body in "html" using only <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <br>. No <h1>: the step's "name" becomes the title. A letter has the sender, the recipient, the date, the subject, the body and the signature, with [Brackets] where the person must fill something in.
- "class" (In 1 Class, like Excel): budgets, invoices, plans, lists. Put the table in "rows": the first row holds the column titles, every row has the same number of cells, at most 40 rows and 8 columns. Use real formulas starting with "=" (A1 style, like "=SUM(B2:B9)" or "=B2*C2") for totals and computed cells, and plain numbers without currency signs.
- "stage" (In 1 Stage, like PowerPoint): 4 to 10 slides in "html", each slide an <h2> followed by a <ul> of 3 to 5 short points.
- "code" (In 1 Code+): small websites or scripts in "files" (path + full content), at most 4 files, an index.html when it is a site.
- "pdf": a PDF made from a letter step, for sending or printing ("from" = that step's number).
Links: "table" = the number (0-based) of the "class" step whose table goes into this letter or stage step, else -1. In a letter that has a table, write a paragraph holding only ${'[[TABLE]]'} where the table goes. "from" = -1 unless app is "pdf".
Use as few steps as the task needs (1 to 5). Unused fields are "" or [] or -1. Write everything in the language the person writes in, with realistic, complete content they can use at once; no placeholders like "lorem ipsum". "title" names the whole task in a few words; "summary" says in one sentence what you made and how the documents are linked.`;

let counter = 0;
export const stepId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

const str = (v: unknown, max = 200000) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);

/** The JSON inside an answer (a fence or words around it are dropped). */
export function jsonOf(answer: string): unknown {
  const a = answer.indexOf('{'), b = answer.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON');
  return JSON.parse(answer.slice(a, b + 1));
}

/** A plan from the AI's answer, made safe: known apps only, sizes capped, rows squared, links checked. */
export function planFrom(raw: unknown): Plan {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(o.steps) ? o.steps.slice(0, 8) : [];
  const ids = list.map(() => stepId());
  const steps: Step[] = [];
  list.forEach((s, i) => {
    const x = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const app = STEP_APPS.includes(x.app as StepApp) ? (x.app as StepApp) : null;
    if (!app) return;
    const ref = (v: unknown, want: StepApp) => {
      const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : -1;
      const target = list[n] as Record<string, unknown> | undefined;
      return n >= 0 && n !== i && target?.app === want ? ids[n] : null;
    };
    const rows = Array.isArray(x.rows) ? (x.rows as unknown[]).slice(0, 60).map(r => (Array.isArray(r) ? r.slice(0, 12).map(c => str(c, 400)) : [])) : [];
    steps.push({
      id: ids[i], app,
      name: str(x.name, 120).trim() || app,
      purpose: str(x.purpose, 400).trim(),
      on: true,
      html: str(x.html),
      rows: square(rows),
      files: Array.isArray(x.files) ? (x.files as unknown[]).slice(0, 12).map(f => {
        const ff = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
        return { path: safePath(str(ff.path, 120)), content: str(ff.content) };
      }).filter(f => f.path) : [],
      table: app === 'letter' || app === 'stage' ? ref(x.table, 'class') : null,
      from: app === 'pdf' ? ref(x.from, 'letter') : null,
    });
  });
  return { title: str(o.title, 120).trim(), summary: str(o.summary, 400).trim(), steps };
}

/** Every row as long as the longest; empty rows at the end dropped. */
export function square(rows: string[][]): string[][] {
  const out = rows.map(r => [...r]);
  while (out.length && out[out.length - 1].every(c => !c.trim())) out.pop();
  const w = Math.max(0, ...out.map(r => r.length));
  return out.map(r => [...r, ...Array(w - r.length).fill('')]);
}

/** A file path inside the project: no "..", no leading slash, plain characters. */
export function safePath(p: string): string {
  return p.replace(/\\/g, '/').split('/').filter(s => s && s !== '.' && s !== '..').map(s => s.replace(/[^\w.\- ]+/g, '-')).join('/').slice(0, 120);
}

/** What a plan still needs before it can be made: steps that are on and have something in them. */
export function readySteps(plan: Plan): Step[] {
  return plan.steps.filter(s => s.on && (
    s.app === 'class' ? s.rows.length > 0 :
    s.app === 'code' ? s.files.length > 0 :
    s.app === 'pdf' ? !!s.from || !!s.html.trim() :
    !!s.html.trim() || !!s.table
  ));
}

/** The user message for the AI: the task, plus the text of any files the person attached. */
export function taskMessage(task: string, files: { name: string; text: string }[]): string {
  const parts = [`Task: ${task.trim()}`];
  for (const f of files) parts.push(`Attached file "${f.name}":\n${f.text.slice(0, 20000)}`);
  return parts.join('\n\n');
}

const LANG_NAMES: Record<string, string> = { en: 'English', fr: 'French', es: 'Spanish', pt: 'Portuguese', de: 'German' };

/**
 * The task as one short, plain message for an AI's public chat (claude.ai, ChatGPT…), used there instead of
 * SYSTEM + SCHEMA: those are long (the request no longer fits the address, and a phone app gets only part of it)
 * and read like code to the person who sees them (Martin, 2026-11-01, on his phone). The task comes first, the
 * answer's shape after, small enough to stay in the address.
 */
export function chatPrompt(task: string, files: { name: string; text: string }[], lang: string): string {
  const example = { title: '…', summary: '…', steps: [{ app: 'letter', name: '…', purpose: '…', html: '<p>…</p>' }] };
  const extra = files.map(f => `\n\nMy file "${f.name}":\n${f.text.slice(0, 1500)}`).join('').slice(0, 3000);
  return [
    `Hello! I use Office In 1 (an office suite). Please make the documents for this task: "${task.trim()}"${extra}`,
    `Write them in ${LANG_NAMES[lang] ?? 'English'}, complete and ready to use, 1 to 5 documents.`,
    `So I can paste your answer back into the app, answer with only one JSON code block like this: ${JSON.stringify(example)}`,
    'For each document, "app" is one of: "letter" (text in "html" with <h2>, <p>, <ul>, <li>, <strong>), '
      + '"class" (a table in "rows": a list of rows, the first row holds the titles, formulas like "=SUM(B2:B5)"), '
      + '"stage" (slides in "html": each <h2> starts a slide), "code" (website files in "files": [{"path","content"}]). '
      + 'To put a "class" table in a letter, give the letter "table": the number of that step (from 0) and write [[TABLE]] where it goes.',
  ].join('\n\n');
}

/** Straight quotes and no trailing commas: what a chat app or a phone keyboard sometimes changes in JSON. */
function repairJson(s: string): string {
  return s.replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, '$1');
}

/** Plain text as letter HTML: blank lines make paragraphs, "# " and "- " lines headings and lists. */
export function proseHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.map(l => `<li>${l}</li>`).join('')}</ul>`); list = []; } };
  for (const block of text.replace(/```[a-z]*\n?|```/gi, '').split(/\n\s*\n/)) {
    for (const line of block.split('\n').map(l => l.trim()).filter(Boolean)) {
      const h = line.match(/^#{1,6}\s+(.*)/), li = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)/);
      if (li) { list.push(inline(li[1])); continue; }
      flush();
      out.push(h ? `<h2>${inline(h[1])}</h2>` : `<p>${inline(line)}</p>`);
    }
    flush();
  }
  return out.join('');
}

/**
 * A plan from whatever the AI answered: its JSON (repaired when a chat app bent the quotes), or, when the answer is
 * plain text, one letter holding that text, so a pasted answer is never lost.
 */
export function planFromAnswer(answer: string, task: string): Plan {
  for (const tryIt of [(s: string) => jsonOf(s), (s: string) => jsonOf(repairJson(s))]) {
    try {
      const p = planFrom(tryIt(answer));
      if (readySteps(p).length) return p;
    } catch { /* next way */ }
  }
  const html = proseHtml(answer);
  if (!html) return { title: '', summary: '', steps: [] };
  const name = task.trim().slice(0, 80) || 'Document';
  return { title: name, summary: '', steps: [{ id: stepId(), app: 'letter', name, purpose: '', on: true, html, rows: [], files: [], table: null, from: null }] };
}
