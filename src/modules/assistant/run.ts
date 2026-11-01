// Makes a plan's documents in the Offices and links them. A Class table used by a letter is a live part (see
// src/shell/live.ts): the letter's copy and the sheet stay the same, whichever side is changed. A deck gets a copy
// of the table on its own slide; a PDF is made from its letter when the person saves it.

import type { ShellApi, TableData } from '../../shell/contract';
import { liveStore, newLiveId } from '../../shell/live';
import { safeHtml } from '../../shell/safeHtml';
import { getLanguage } from '../../shell/i18n';
import { TABLE_MARK, readySteps, type Plan, type Step } from './plan';

export type StepState = 'wait' | 'busy' | 'done' | 'error';

export interface Made {
  stepId: string;
  app: Step['app'];
  name: string;
  /** The tab it opened in (none for a PDF). */
  tabId: string | null;
  /** The live part shared with a Class step, when linked. */
  live?: string;
  /** Names of the steps it is linked to. */
  linked: string[];
  error?: string;
}

/** Every character that means something in a regular expression, escaped (backslash included). */
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A paragraph that holds only the table mark. */
const markRe = (flags = '') => new RegExp(`<p[^>]*>\\s*${reEsc(TABLE_MARK)}\\s*</p>`, flags);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const fileBase = (s: string) => (s.trim() || 'Document').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);

/** A Class step's table with its formulas worked out, so a letter shows the totals at once. */
export async function computedTable(rows: string[][]): Promise<TableData> {
  const raw: TableData = {
    header: rows.length > 1,
    rows: rows.map((r, i) => r.map(c => (c.startsWith('=') ? { text: '', formula: c } : { text: c, ...(i === 0 && rows.length > 1 ? { bold: true } : {}) }))),
  };
  if (!rows.some(r => r.some(c => c.startsWith('=')))) return raw;
  try {
    const [{ tableToCells, sheetToTable }, { computeBook }] = await Promise.all([import('../../formats/table'), import('../../formats/sheet')]);
    const sheet = { name: 'Sheet1', cells: tableToCells(raw), widths: {} };
    const values = computeBook({ sheets: [sheet] })[0];
    const w = Math.max(1, ...rows.map(r => r.length));
    const done = sheetToTable(sheet as never, { c1: 0, r1: 0, c2: w - 1, r2: rows.length - 1 }, values, getLanguage(), 'EUR');
    return { ...done, header: raw.header };
  } catch {
    return raw;
  }
}

/** The table as Letter HTML, tied to its live part. */
export function linkedTableHtml(table: TableData, live: string | null): string {
  const body = table.rows.map((r, i) => `<tr>${r.map(c => {
    const tag = table.header && i === 0 ? 'th' : 'td';
    return `<${tag}>${c.bold && tag === 'td' ? `<strong>${esc(c.text)}</strong>` : esc(c.text)}</${tag}>`;
  }).join('')}</tr>`).join('');
  return `<table${live ? ` data-link="${esc(live)}"` : ''}>${body}</table>`;
}

/** Puts the table where the letter marks it, or before its last paragraph (the signature) when it does not. */
export function placeTableInHtml(html: string, tableHtml: string): string {
  const marked = markRe();
  if (marked.test(html)) return html.replace(marked, tableHtml);
  if (html.includes(TABLE_MARK)) return html.replace(TABLE_MARK, tableHtml);
  const last = html.lastIndexOf('<p');
  return last > 0 ? `${html.slice(0, last)}${tableHtml}${html.slice(last)}` : `${html}${tableHtml}`;
}

/**
 * Makes every step that is on. Class steps used by a letter come right after it, linked to it; the others in
 * the plan's order. `onState` reports each step's progress; the result lists what was made and where.
 */
export async function runPlan(shell: ShellApi, plan: Plan, onState: (id: string, s: StepState) => void): Promise<Made[]> {
  const steps = readySteps(plan);
  const byId = new Map(steps.map(s => [s.id, s]));
  const made: Made[] = [];
  const tables = new Map<string, TableData>();
  const lives = new Map<string, string>();
  const letterOf = new Map<string, Made>(); // class step -> the letter that holds its table

  for (const s of steps) if (s.app === 'class') {
    tables.set(s.id, await computedTable(s.rows));
    // A live part only when a letter shows the table.
    if (steps.some(x => x.app === 'letter' && x.table === s.id)) {
      const id = newLiveId();
      await liveStore().ensure(id, { kind: 'table', title: s.name, table: tables.get(s.id)! }, 'assistant', 'assistant');
      lives.set(s.id, id);
    }
  }

  const order = [...steps.filter(s => s.app === 'letter'), ...steps.filter(s => s.app === 'class'), ...steps.filter(s => s.app !== 'letter' && s.app !== 'class')];
  for (const s of order) {
    onState(s.id, 'busy');
    const m: Made = { stepId: s.id, app: s.app, name: s.name, tabId: null, linked: [] };
    try {
      if (s.app === 'letter') {
        let html = safeHtml(s.html || '<p></p>');
        const t = s.table ? tables.get(s.table) : undefined;
        if (s.table && t) {
          html = placeTableInHtml(html, linkedTableHtml(t, lives.get(s.table) ?? null));
          m.live = lives.get(s.table);
          m.linked.push(byId.get(s.table)?.name ?? '');
        } else html = html.replace(markRe('g'), '');
        m.tabId = shell.openModule('letter', undefined, { kind: 'html', title: s.name, html });
        if (m.tabId && s.table && !letterOf.has(s.table)) { letterOf.set(s.table, m); }
      } else if (s.app === 'class') {
        const table = tables.get(s.id)!;
        // The formulas go in, not their results, so the sheet keeps computing.
        const sheetTable: TableData = { ...table, rows: table.rows.map(r => r.map(c => ({ ...c, text: c.formula ?? c.text }))) };
        const live = lives.get(s.id);
        const letter = letterOf.get(s.id);
        m.tabId = shell.openModule('class', undefined, live && letter?.tabId
          ? { kind: 'table', title: s.name, table: sheetTable, link: { tabId: letter.tabId, id: live, moduleId: 'letter', title: s.name } }
          : { kind: 'table', title: s.name, table: sheetTable });
        if (live) { m.live = live; m.linked.push(...steps.filter(x => x.app === 'letter' && x.table === s.id).map(x => x.name)); }
        steps.filter(x => x.app === 'stage' && x.table === s.id).forEach(x => m.linked.push(x.name));
      } else if (s.app === 'stage') {
        const [{ deckFromPrepared, asFile }, { writePptx }] = await Promise.all([import('../../shell/convert'), import('../../formats/pptx')]);
        const t = s.table ? tables.get(s.table) : undefined;
        const deck = await deckFromPrepared({ title: s.name, html: safeHtml(s.html), tables: t ? [{ name: byId.get(s.table!)?.name ?? s.name, table: t }] : [], text: null });
        const blob = await writePptx(deck, getLanguage(), s.name);
        m.tabId = shell.openModule('stage', asFile(`${fileBase(s.name)}.pptx`, blob));
        if (t) m.linked.push(byId.get(s.table!)?.name ?? '');
      } else if (s.app === 'code') {
        const [{ writeZip }, { asFile }] = await Promise.all([import('../code/project'), import('../../shell/convert')]);
        const files: Record<string, string> = {};
        for (const f of s.files) files[f.path] = f.content;
        const blob = await writeZip(files);
        m.tabId = shell.openModule('code', asFile(`${fileBase(s.name)}.zip`, blob));
      } else if (s.app === 'pdf') {
        // Made when saved (it takes a few seconds); linked to its letter.
        if (s.from) m.linked.push(byId.get(s.from)?.name ?? '');
      }
      made.push(m);
      onState(s.id, 'done');
      // Let the new tab start before the next one.
      await new Promise(r => setTimeout(r, 60));
    } catch (e) {
      m.error = e instanceof Error ? e.message : String(e);
      made.push(m);
      onState(s.id, 'error');
    }
  }
  shell.showTab(shell.tabId);
  return plan.steps.map(s => made.find(m => m.stepId === s.id)).filter((m): m is Made => !!m);
}

/** The HTML a PDF step prints: its letter (with the table) or its own content. */
export async function pdfHtml(plan: Plan, step: Step): Promise<string> {
  const src = step.from ? plan.steps.find(s => s.id === step.from) : null;
  const base = src ?? step;
  let html = safeHtml(base.html || '');
  const tableStep = base.table ? plan.steps.find(s => s.id === base.table) : null;
  if (tableStep) html = placeTableInHtml(html, linkedTableHtml(await computedTable(tableStep.rows), null));
  else html = html.replace(TABLE_MARK, '');
  return `<h1>${esc(base.name)}</h1>${html}`;
}

/** Saves a PDF step to the device. */
export async function savePdf(shell: ShellApi, plan: Plan, step: Step): Promise<boolean> {
  const [{ htmlPages, pagesToPdf }, { BASE_CSS }] = await Promise.all([import('../../ui/convert/render'), import('../../shell/convert')]);
  const pages = await htmlPages(await pdfHtml(plan, step), BASE_CSS);
  try {
    const blob = await pagesToPdf(pages, step.name);
    return !!(await shell.saveFile(`${fileBase(step.name)}.pdf`, blob, 'application/pdf', { saveAs: true }));
  } finally { pages.done(); }
}
