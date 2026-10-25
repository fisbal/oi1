// Where a chart's labels and numbers sit in its range, shared by the drawing (modules/class/chart.tsx)
// and the Excel writer (formats/xlsx.ts) so both read the cells the same way.

import type { Scalar } from './formula';
import { key, type Chart } from './sheet';

export interface ChartLayout {
  /** The first row names the series, the first column names the categories. */
  headRow: boolean;
  headCol: boolean;
  /** First data column and row. */
  dc1: number;
  dr1: number;
  /** Series run down columns (true) or across rows. */
  byColumn: boolean;
}

export function chartLayout(values: Map<string, Scalar>, chart: Chart): ChartLayout {
  const { c1, r1, c2, r2 } = chart.range;
  const v = (c: number, r: number) => values.get(key(c, r)) ?? '';
  const isLabel = (x: Scalar) => typeof x === 'string' && x !== '';
  let headRow = false, headCol = false;
  for (let c = c1 + 1; c <= c2; c++) if (isLabel(v(c, r1))) headRow = true;
  for (let r = r1 + 1; r <= r2; r++) if (isLabel(v(c1, r))) headCol = true;
  if (isLabel(v(c1, r1)) && c1 === c2) headRow = true;
  if (isLabel(v(c1, r1)) && r1 === r2) headCol = true;
  const dc1 = headCol ? c1 + 1 : c1, dr1 = headRow ? r1 + 1 : r1;
  return { headRow, headCol, dc1, dr1, byColumn: chart.type === 'scatter' || (chart.byColumn ?? (r2 - dr1 >= c2 - dc1)) };
}
