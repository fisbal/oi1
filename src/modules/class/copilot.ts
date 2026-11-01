// In 1 Class's copilot: Claude sees the selected cells (or the table around the active cell) with their
// formulas, and its answers go back as a formula in the active cell or as a whole block of cells.

import { FUNCTION_NAMES } from '../../formats/formula';
import type { TableData } from '../../shell/contract';
import { t } from '../../shell/i18n';
import type { CopilotContext, CopilotHost } from '../../ui/Copilot';
import { plainText } from '../../ui/markdown';

/** What the sheet gives the copilot. */
export interface ClassBridge {
  sheetName: string;
  /** The range Claude works on and its cells: the selection, or the table around a single active cell. */
  focus(): { ref: string; table: TableData; active: string; activeInput: string; single: boolean } | null;
  /** Put a value or formula in the active cell. */
  setActive(text: string): void;
  /** Write rows of entries from the top-left of the range Claude worked on. */
  writeRows(rows: string[][], at: unknown): void;
}

/** A grid from an answer: a Markdown table, tab-separated lines, or one value per line. */
export function gridOf(answer: string): string[][] {
  const lines = answer.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim());
  const piped = lines.filter(l => l.trim().startsWith('|'));
  if (piped.length) {
    return piped
      .filter(l => !/^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(l))
      .map(l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
  }
  if (lines.some(l => l.includes('\t'))) return lines.map(l => l.split('\t'));
  return lines.map(l => [l]);
}

/** A table as tab-separated lines with the sheet's row numbers and column letters, formulas shown as typed. */
function tsv(table: TableData, ref: string): string {
  return `${ref}\n${table.rows.map(r => r.map(c => (c.formula ? `${c.formula}  → ${c.text}` : c.text)).join('\t')).join('\n')}`;
}

export function classCopilot(b: ClassBridge, decimalComma: boolean): CopilotHost {
  const context = (): CopilotContext | null => {
    const f = b.focus();
    if (!f) return null;
    const label = f.single
      ? t('ai.class.cell', { cell: f.active, range: f.ref })
      : t('ai.class.range', { range: f.ref });
    const text = `Sheet "${b.sheetName}". ${f.single ? `Active cell ${f.active}${f.activeInput ? ` contains: ${f.activeInput}` : ' is empty'}. The table around it` : 'Selected range'} (top-left cell first, cells separated by tabs; a formula is shown as "=FORMULA  → value"):\n${tsv(f.table, f.ref)}`;
    return { label, text, at: f.ref };
  };
  const table = 'Reply with only the table, as a Markdown table with the same columns, the first row being the header row if the context has one, numbers written plainly with a dot as decimal separator and no thousands separator.';
  return {
    app: 'In 1 Class',
    role: [
      'In 1 Class is a spreadsheet like Excel. Its formulas use Excel syntax with English function names, commas between arguments and A1 references (Sheet2!A1 for other sheets).',
      `It knows these functions: ${FUNCTION_NAMES.join(', ')}. Use only these.`,
      'When you give a formula, put it alone in a ```excel code block, starting with =, so it can be put into a cell.',
      `The user types numbers with ${decimalComma ? 'a comma' : 'a dot'} as decimal separator, but inside formulas always write a dot.`,
    ].join('\n'),
    context,
    actions: [
      { id: 'formula', icon: 'fx', label: t('ai.class.formula'), fill: t('ai.class.formulaFill') },
      { id: 'explain', icon: 'search', label: t('ai.class.explain'), needsContext: true, prompt: 'Explain simply what the formula in the active cell does (or, if there is none, what the formulas in the range do), step by step.' },
      { id: 'fix', icon: 'check', label: t('ai.class.fix'), needsContext: true, prompt: 'Find what is wrong with the formula in the active cell (errors like #REF!, #VALUE!, #DIV/0!, wrong ranges or logic) and give the corrected formula, then one sentence on what you changed.' },
      { id: 'clean', icon: 'clean', label: t('ai.class.clean'), needsContext: true, prompt: `Clean this table: fix spelling, make capitals, dates, units and number formats consistent, trim stray spaces, merge obvious duplicates of the same value written differently. Keep every row unless it is a pure duplicate. Values only, no formulas. ${table}` },
      { id: 'analyze', icon: 'chart', label: t('ai.class.analyze'), needsContext: true, prompt: 'Analyze this data: the main figures, trends, outliers and anything surprising, in a few short bullet points. Then suggest one useful chart and one useful formula.' },
      { id: 'fill', icon: 'fill', label: t('ai.class.complete'), needsContext: true, prompt: `Complete this table: fill the empty cells where the value can be worked out or reasonably inferred from the rest, and leave the rest as it is. ${table}` },
    ],
    applies: [
      {
        id: 'cell', icon: 'fx', label: t('ai.apply.cell'), run: payload => {
          const one = plainText(payload).split('\n').find(l => l.trim())?.trim() ?? '';
          if (!one) return;
          b.setActive(one);
          return t('ai.class.putIn');
        },
      },
      {
        id: 'cells', icon: 'sheet', label: t('ai.apply.cells'), run: (payload, _answer, at) => {
          const rows = gridOf(payload);
          if (!rows.length) return;
          b.writeRows(rows, at);
          return t('ai.class.written', { n: rows.length });
        },
      },
    ],
  };
}
