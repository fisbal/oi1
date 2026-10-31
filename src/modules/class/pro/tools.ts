// The "Métiers" tab's catalogue: ready professional sheets grouped by trade. Économie and Audit join in the next step.

import type { SheetData } from '../../../formats/sheet';
import { buildSheet, tx, type Lang, type Model, type Tx } from './build';
import { FINANCE } from './finance';
import { COMPTA } from './compta';

export interface ProTool { id: string; icon: string; model: Model; name: Tx; desc: Tx }
export interface ProCategory { id: 'finance' | 'compta'; icon: string; name: Tx; tools: ProTool[] }

export const PRO_CATEGORIES: ProCategory[] = [
  { id: 'finance', icon: 'currency', name: ['Finance', 'Finance', 'Finanzas', 'Finanças', 'Finanzen'], tools: FINANCE },
  { id: 'compta', icon: 'book', name: ['Accounting', 'Comptabilité', 'Contabilidad', 'Contabilidade', 'Buchhaltung'], tools: COMPTA },
];
export const ALL_TOOLS: ProTool[] = PRO_CATEGORIES.flatMap(c => c.tools);

/** Sheet names are short (Excel keeps 31 characters) and unique in the book. */
export function sheetNameFor(tool: ProTool, lang: Lang, taken: string[]): string {
  const base = tx(tool.name, lang).replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28).trim();
  let name = base, n = 2;
  while (taken.some(t => t.toLowerCase() === name.toLowerCase())) name = `${base.slice(0, 25)} ${n++}`;
  return name;
}

export function buildTool(tool: ProTool, lang: Lang, taken: string[] = []): SheetData {
  return buildSheet(sheetNameFor(tool, lang, taken), tx(tool.name, lang), tool.model, lang);
}
