// Audit tools on the person's own data (Martin, 2026-10-31: "le rendre un outil riche et utile en audits et analyse").
// Each one reads the selection (or the whole used area) and writes a report on a new sheet: Benford's law, duplicates,
// gaps in a numbered series, outliers, a formula health check and a summary table (pivot) kept live with SUMIF.

import type { Cell, CellStyle, SheetData } from '../../../formats/sheet';
import { key, unkey } from '../../../formats/sheet';
import { cellName, isError, sheetRef, type Scalar } from '../../../formats/formula';
import { HEAD, tx, type Lang, type Tx } from './build';

export type AuditId = 'benford' | 'duplicates' | 'gaps' | 'outliers' | 'formulas' | 'pivot';
export interface Box { c1: number; r1: number; c2: number; r2: number }

const L = (en: string, fr: string, es: string, pt: string, de: string): Tx => [en, fr, es, pt, de];
export const AUDITS: { id: AuditId; icon: string; name: Tx; desc: Tx }[] = [
  { id: 'benford', icon: 'barchart', name: L('Benford’s law', 'Loi de Benford', 'Ley de Benford', 'Lei de Benford', 'Benfordsches Gesetz'), desc: L('Do the first digits look natural? Made-up numbers often do not (method used by auditors and tax offices).', 'Les premiers chiffres sont-ils naturels ? Les chiffres inventés le sont rarement (méthode des auditeurs et du fisc).', '¿Los primeros dígitos parecen naturales? Método de auditores.', 'Os primeiros dígitos parecem naturais? Método dos auditores.', 'Wirken die Anfangsziffern natürlich? Methode der Prüfer.') },
  { id: 'duplicates', icon: 'dedupe', name: L('Find duplicates', 'Trouver les doublons', 'Buscar duplicados', 'Encontrar duplicados', 'Duplikate finden'), desc: L('Rows or values that appear more than once (double payments, double entries).', 'Lignes ou valeurs présentes plusieurs fois (doubles paiements, doubles saisies).', 'Filas o valores repetidos (pagos dobles).', 'Linhas ou valores repetidos (pagamentos duplos).', 'Mehrfach vorkommende Zeilen oder Werte.') },
  { id: 'gaps', icon: 'numbers', name: L('Gaps in a series', 'Trous dans une série', 'Huecos en una serie', 'Falhas numa série', 'Lücken in einer Folge'), desc: L('Missing numbers in invoice, cheque or voucher numbers.', 'Numéros manquants dans les factures, chèques ou pièces.', 'Números que faltan en facturas o cheques.', 'Números em falta em faturas ou cheques.', 'Fehlende Rechnungs- oder Belegnummern.') },
  { id: 'outliers', icon: 'scatter', name: L('Outliers', 'Valeurs aberrantes', 'Valores atípicos', 'Valores atípicos', 'Ausreißer'), desc: L('Values far from the others (box-plot rule and z-score).', 'Valeurs très éloignées des autres (règle de la boîte à moustaches et z-score).', 'Valores lejos de los demás (IQR y z).', 'Valores longe dos outros (IQR e z).', 'Werte weit weg von den anderen (IQR und z).') },
  { id: 'formulas', icon: 'fx', name: L('Formula health check', 'Contrôle des formules', 'Control de fórmulas', 'Controlo de fórmulas', 'Formelprüfung'), desc: L('Errors, typed numbers inside formulas, links to empty cells, and numbers typed where a formula is expected.', 'Erreurs, nombres tapés dans les formules, liens vers des cellules vides, et nombres tapés au milieu des formules.', 'Errores, números fijos en fórmulas, referencias vacías.', 'Erros, números fixos em fórmulas, referências vazias.', 'Fehler, feste Zahlen in Formeln, leere Bezüge.') },
  { id: 'pivot', icon: 'table', name: L('Summary table (pivot)', 'Tableau de synthèse (croisé)', 'Tabla resumen (dinámica)', 'Tabela resumo (dinâmica)', 'Übersichtstabelle (Pivot)'), desc: L('Totals, counts and averages by category, kept up to date with formulas.', 'Totaux, nombres et moyennes par catégorie, tenus à jour par des formules.', 'Totales y medias por categoría, con fórmulas.', 'Totais e médias por categoria, com fórmulas.', 'Summen und Mittel je Kategorie, mit Formeln.') },
];

/** Labels short enough to sit under a ribbon icon. */
export const AUDIT_SHORT: Record<AuditId, Tx> = {
  benford: L('Benford', 'Benford', 'Benford', 'Benford', 'Benford'),
  duplicates: L('Duplicates', 'Doublons', 'Duplicados', 'Duplicados', 'Duplikate'),
  gaps: L('Gaps', 'Trous', 'Huecos', 'Falhas', 'Lücken'),
  outliers: L('Outliers', 'Aberrants', 'Atípicos', 'Atípicos', 'Ausreißer'),
  formulas: L('Formulas', 'Formules', 'Fórmulas', 'Fórmulas', 'Formeln'),
  pivot: L('Summary', 'Synthèse', 'Resumen', 'Resumo', 'Übersicht'),
};

const TITLE: CellStyle = { bold: true, size: 15 };
const NOTE: CellStyle = { italic: true, color: '#7F7F7F' };
const BAD: CellStyle = { fill: '#FFC7CE', color: '#9C0006' };
const GOOD: CellStyle = { fill: '#C6EFCE', color: '#006100' };
const PCT: CellStyle = { format: 'percent', decimals: 1 };

class Report {
  cells: Record<string, Cell> = {};
  r = 0;
  constructor(readonly lang: Lang) {}
  put(c: number, r: number, v: Scalar | Tx, style?: CellStyle) {
    const input = Array.isArray(v) ? tx(v as Tx, this.lang) : v === null || v === undefined ? '' : String(v);
    if (input !== '') this.cells[key(c, r)] = style ? { input, style } : { input };
  }
  line(values: (Scalar | Tx)[], style?: CellStyle | ((i: number) => CellStyle | undefined)) {
    values.forEach((v, i) => this.put(i, this.r, v, typeof style === 'function' ? style(i) : style));
    this.r++;
  }
  head(...t: Tx[]) { this.line(t, HEAD); }
  sheet(name: string, widths = [220, 130, 130, 130, 130]): SheetData {
    const w: Record<number, number> = {};
    widths.forEach((x, i) => { w[i] = x; });
    return { name, cells: this.cells, widths: w };
  }
}

/** The values to audit: the selection, or the whole used area when one cell is selected. */
function numbersIn(values: Map<string, Scalar>, box: Box): { ref: string; v: number }[] {
  const out: { ref: string; v: number }[] = [];
  for (let r = box.r1; r <= box.r2; r++) for (let c = box.c1; c <= box.c2; c++) {
    const v = values.get(key(c, r));
    if (typeof v === 'number' && Number.isFinite(v)) out.push({ ref: cellName(c, r), v });
  }
  return out;
}

const quantile = (sorted: number[], q: number) => {
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export interface AuditInput { sheet: SheetData; values: Map<string, Scalar>; box: Box; lang: Lang; name: string }

export function runAudit(id: AuditId, a: AuditInput): SheetData {
  const rep = new Report(a.lang);
  const meta = AUDITS.find(x => x.id === id)!;
  rep.put(0, 0, `${tx(meta.name, a.lang)} · ${a.sheet.name}!${cellName(a.box.c1, a.box.r1)}:${cellName(a.box.c2, a.box.r2)}`, TITLE);
  rep.r = 1;
  rep.line([meta.desc], NOTE);
  rep.r++;
  ({ benford, duplicates, gaps, outliers, formulas, pivot } as Record<AuditId, (rep: Report, a: AuditInput) => void>)[id](rep, a);
  return rep.sheet(a.name, id === 'formulas' ? [110, 360, 300] : undefined);
}

const NOT_ENOUGH = L('Not enough numbers in the selection: select a column of amounts first.', 'Pas assez de nombres dans la sélection : sélectionnez d’abord une colonne de montants.', 'No hay suficientes números: seleccione una columna de importes.', 'Números insuficientes: selecione uma coluna de valores.', 'Zu wenige Zahlen: zuerst eine Betragsspalte markieren.');

function benford(rep: Report, a: AuditInput) {
  const nums = numbersIn(a.values, a.box).map(x => Math.abs(x.v)).filter(v => v >= 10); // tiny values say little
  if (nums.length < 30) { rep.line([NOT_ENOUGH], BAD); rep.line([L('Benford needs at least 30 amounts of 10 or more.', 'Benford demande au moins 30 montants de 10 ou plus.', 'Benford necesita al menos 30 importes ≥ 10.', 'Benford precisa de pelo menos 30 valores ≥ 10.', 'Benford braucht mindestens 30 Beträge ≥ 10.')], NOTE); return; }
  const count = Array(10).fill(0) as number[];
  for (const v of nums) count[Number(String(v).replace(/^[0.]+/, '')[0])]++;
  rep.head(L('First digit', 'Premier chiffre', 'Primer dígito', 'Primeiro dígito', 'Erste Ziffer'), L('Count', 'Nombre', 'Cantidad', 'Quantidade', 'Anzahl'), L('Found', 'Constaté', 'Observado', 'Observado', 'Beobachtet'), L('Expected (Benford)', 'Attendu (Benford)', 'Esperado (Benford)', 'Esperado (Benford)', 'Erwartet (Benford)'), L('Gap', 'Écart', 'Diferencia', 'Diferença', 'Abweichung'));
  const first = rep.r;
  let mad = 0, chi = 0;
  for (let d = 1; d <= 9; d++) {
    const exp = Math.log10(1 + 1 / d), found = count[d] / nums.length;
    mad += Math.abs(found - exp) / 9;
    chi += (count[d] - exp * nums.length) ** 2 / (exp * nums.length);
    const r = rep.r + 1;
    rep.line([d, count[d], `=B${r}/SUM($B$${first + 1}:$B$${first + 9})`, `=LOG10(1+1/A${r})`, `=C${r}-D${r}`], i => (i >= 2 ? PCT : undefined));
  }
  rep.r++;
  // Nigrini's thresholds for the first digit (Benford's Law, Wiley 2012).
  // MAD is reliable from about 1 000 amounts; below that the chi-square test (8 degrees of freedom) decides.
  const level = nums.length >= 1000 ? (mad < 0.006 ? 0 : mad < 0.012 ? 1 : mad < 0.015 ? 2 : 3) : chi < 8 ? 0 : chi < 15.51 ? 1 : chi < 20.09 ? 2 : 3;
  const words = [L('Close conformity', 'Conformité forte', 'Conformidad alta', 'Conformidade alta', 'Hohe Übereinstimmung'), L('Acceptable conformity', 'Conformité acceptable', 'Conformidad aceptable', 'Conformidade aceitável', 'Akzeptable Übereinstimmung'), L('Marginal: look closer', 'Limite : à examiner', 'Marginal: revisar', 'Marginal: rever', 'Grenzwertig: prüfen'), L('Nonconformity: check these amounts', 'Non conforme : vérifiez ces montants', 'No conforme: revise estos importes', 'Não conforme: verifique estes valores', 'Keine Übereinstimmung: Beträge prüfen')];
  rep.line([L('Amounts read', 'Montants lus', 'Importes leídos', 'Valores lidos', 'Gelesene Beträge'), nums.length]);
  rep.line([L('Mean absolute deviation (MAD)', 'Écart absolu moyen (MAD)', 'Desviación absoluta media (MAD)', 'Desvio absoluto médio (MAD)', 'Mittlere absolute Abweichung (MAD)'), Number(mad.toFixed(5))]);
  rep.line([L('Chi-square (8 degrees of freedom; above 15.5 = unusual)', 'Khi-deux (8 degrés de liberté ; au-dessus de 15,5 = inhabituel)', 'Chi cuadrado (8 g.l.; > 15,5 = inusual)', 'Qui-quadrado (8 g.l.; > 15,5 = invulgar)', 'Chi-Quadrat (8 FG; > 15,5 = auffällig)'), Number(chi.toFixed(2))]);
  rep.line([L('Verdict', 'Verdict', 'Veredicto', 'Veredicto', 'Ergebnis'), words[level]], i => (i === 1 ? (level < 2 ? GOOD : BAD) : { bold: true }));
}

function duplicates(rep: Report, a: AuditInput) {
  const { c1, c2, r1, r2 } = a.box;
  const seen = new Map<string, number[]>();
  for (let r = r1; r <= r2; r++) {
    const vals: string[] = [];
    for (let c = c1; c <= c2; c++) { const v = a.values.get(key(c, r)); vals.push(v === undefined || v === null ? '' : String(v)); }
    if (vals.every(v => v === '')) continue;
    const k = vals.join('\u0001').toLowerCase().trim();
    seen.set(k, [...(seen.get(k) ?? []), r]);
  }
  const dups = [...seen.values()].filter(rs => rs.length > 1);
  rep.line([L('Rows read', 'Lignes lues', 'Filas leídas', 'Linhas lidas', 'Gelesene Zeilen'), [...seen.values()].reduce((n, x) => n + x.length, 0)]);
  rep.line([L('Groups of identical rows', 'Groupes de lignes identiques', 'Grupos de filas idénticas', 'Grupos de linhas idênticas', 'Gruppen gleicher Zeilen'), dups.length], i => (i === 1 ? (dups.length ? BAD : GOOD) : undefined));
  rep.r++;
  if (!dups.length) { rep.line([L('✓ No duplicate found.', '✓ Aucun doublon trouvé.', '✓ Ningún duplicado.', '✓ Nenhum duplicado.', '✓ Keine Duplikate.')], GOOD); return; }
  rep.head(L('Times', 'Fois', 'Veces', 'Vezes', 'Mal'), L('Rows', 'Lignes', 'Filas', 'Linhas', 'Zeilen'), L('Content', 'Contenu', 'Contenido', 'Conteúdo', 'Inhalt'));
  for (const rs of dups.slice(0, 500)) {
    const content = [];
    for (let c = c1; c <= c2; c++) content.push(String(a.values.get(key(c, rs[0])) ?? ''));
    rep.line([rs.length, rs.map(r => r + 1).join(', '), content.join(' · ')]);
  }
}

function gaps(rep: Report, a: AuditInput) {
  const nums = numbersIn(a.values, a.box).map(x => x.v).filter(Number.isInteger);
  if (nums.length < 2) { rep.line([NOT_ENOUGH], BAD); return; }
  const set = new Set(nums), min = Math.min(...nums), max = Math.max(...nums);
  const missing: number[] = [];
  for (let n = min; n <= max && missing.length < 1000 && max - min < 1_000_000; n++) if (!set.has(n)) missing.push(n);
  const repeated = nums.length - set.size;
  rep.line([L('From', 'De', 'De', 'De', 'Von'), min]);
  rep.line([L('To', 'À', 'A', 'Até', 'Bis'), max]);
  rep.line([L('Numbers found', 'Numéros trouvés', 'Números encontrados', 'Números encontrados', 'Gefundene Nummern'), set.size]);
  rep.line([L('Missing', 'Manquants', 'Faltan', 'Em falta', 'Fehlend'), missing.length], i => (i === 1 ? (missing.length ? BAD : GOOD) : undefined));
  rep.line([L('Used more than once', 'Utilisés plusieurs fois', 'Repetidos', 'Repetidos', 'Mehrfach'), repeated], i => (i === 1 ? (repeated ? BAD : GOOD) : undefined));
  rep.r++;
  if (!missing.length) { rep.line([L('✓ The series has no gap.', '✓ La série n’a aucun trou.', '✓ La serie no tiene huecos.', '✓ A série não tem falhas.', '✓ Die Folge ist lückenlos.')], GOOD); return; }
  rep.head(L('Missing numbers', 'Numéros manquants', 'Números que faltan', 'Números em falta', 'Fehlende Nummern'));
  // Runs are shown as "120 – 125" so a long hole stays one line.
  for (let i = 0; i < missing.length;) {
    let j = i;
    while (j + 1 < missing.length && missing[j + 1] === missing[j] + 1) j++;
    rep.line([i === j ? String(missing[i]) : `${missing[i]} – ${missing[j]}`]);
    i = j + 1;
  }
}

function outliers(rep: Report, a: AuditInput) {
  const nums = numbersIn(a.values, a.box);
  if (nums.length < 5) { rep.line([NOT_ENOUGH], BAD); return; }
  const sorted = nums.map(x => x.v).sort((x, y) => x - y);
  const q1 = quantile(sorted, 0.25), q3 = quantile(sorted, 0.75), iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const sd = Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (sorted.length - 1)) || 1;
  const found = nums.filter(x => x.v < lo || x.v > hi || Math.abs(x.v - mean) / sd > 3);
  const n2 = (v: number) => Number(v.toFixed(2));
  rep.line([L('Values read', 'Valeurs lues', 'Valores leídos', 'Valores lidos', 'Gelesene Werte'), nums.length]);
  rep.line([L('Mean', 'Moyenne', 'Media', 'Média', 'Mittelwert'), n2(mean)]);
  rep.line([L('Median', 'Médiane', 'Mediana', 'Mediana', 'Median'), n2(quantile(sorted, 0.5))]);
  rep.line([L('Normal range (box plot)', 'Plage normale (boîte à moustaches)', 'Rango normal (IQR)', 'Intervalo normal (IQR)', 'Normalbereich (IQR)'), n2(lo), n2(hi)]);
  rep.line([L('Outliers', 'Valeurs aberrantes', 'Valores atípicos', 'Valores atípicos', 'Ausreißer'), found.length], i => (i === 1 ? (found.length ? BAD : GOOD) : undefined));
  rep.r++;
  if (!found.length) { rep.line([L('✓ No value stands out.', '✓ Aucune valeur ne sort du lot.', '✓ Ningún valor destaca.', '✓ Nenhum valor se destaca.', '✓ Kein Wert fällt auf.')], GOOD); return; }
  rep.head(L('Cell', 'Cellule', 'Celda', 'Célula', 'Zelle'), C_VALUE, L('z-score', 'z-score', 'z', 'z', 'z-Wert'), L('Why', 'Pourquoi', 'Por qué', 'Porquê', 'Warum'));
  for (const x of found.sort((p, q) => Math.abs(q.v - mean) - Math.abs(p.v - mean)).slice(0, 500)) {
    const z = (x.v - mean) / sd;
    rep.line([x.ref, x.v, n2(z), x.v > hi || z > 3 ? L('Much higher than the others', 'Bien plus haut que les autres', 'Mucho más alto', 'Muito mais alto', 'Viel höher') : L('Much lower than the others', 'Bien plus bas que les autres', 'Mucho más bajo', 'Muito mais baixo', 'Viel niedriger')]);
  }
}
const C_VALUE = L('Value', 'Valeur', 'Valor', 'Valor', 'Wert');

function formulas(rep: Report, a: AuditInput) {
  const { sheet, values } = a;
  const issues: [string, Tx, string][] = [];
  let count = 0;
  const formulaCells = Object.entries(sheet.cells).filter(([, c]) => c.input.startsWith('='));
  for (const [k, c] of formulaCells) {
    count++;
    const { c: col, r } = unkey(k);
    const ref = cellName(col, r), v = values.get(k);
    if (isError(v)) issues.push([ref, L('Error', 'Erreur', 'Error', 'Erro', 'Fehler'), `${c.input} → ${(v as { error: string }).error}`]);
    // Typed numbers inside a formula (other than 0, 1, 2, 12, 100…) hide assumptions that should sit in a cell.
    const body = c.input.replace(/"[^"]*"/g, '').replace(/\$?[A-Z]{1,3}\$?\d+/g, '');
    const nums = (body.match(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g) ?? []).filter(n => !['0', '1', '2', '12', '100', '1000', '365', '360', '10'].includes(n));
    if (nums.length) issues.push([ref, L('Number typed inside the formula', 'Nombre tapé dans la formule', 'Número fijo en la fórmula', 'Número fixo na fórmula', 'Feste Zahl in der Formel'), `${c.input}  (${nums.join(', ')})`]);
    // A reference to an empty cell is often a slip.
    for (const m of c.input.replace(/"[^"]*"/g, '').matchAll(/(?<![!:\w$])\$?([A-Z]{1,3})\$?(\d+)(?![\w:(!])/g)) {
      const cc = m[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1, rr = Number(m[2]) - 1;
      if (!sheet.cells[key(cc, rr)]) { issues.push([ref, L('Points to an empty cell', 'Pointe vers une cellule vide', 'Apunta a una celda vacía', 'Aponta para célula vazia', 'Verweist auf leere Zelle'), `${c.input} → ${m[0]}`]); break; }
    }
  }
  // A typed number in the middle of a column of formulas: someone overwrote a result by hand.
  for (const [k] of formulaCells) {
    const { c: col, r } = unkey(k);
    const below = sheet.cells[key(col, r + 1)], below2 = sheet.cells[key(col, r + 2)];
    if (below && !below.input.startsWith('=') && /^-?\d/.test(below.input) && below2?.input.startsWith('='))
      issues.push([cellName(col, r + 1), L('Number typed among formulas', 'Nombre tapé au milieu des formules', 'Número entre fórmulas', 'Número entre fórmulas', 'Zahl zwischen Formeln'), below.input]);
  }
  rep.line([L('Formulas read', 'Formules lues', 'Fórmulas leídas', 'Fórmulas lidas', 'Gelesene Formeln'), count]);
  rep.line([L('Points to check', 'Points à vérifier', 'Puntos a revisar', 'Pontos a verificar', 'Prüfpunkte'), issues.length], i => (i === 1 ? (issues.length ? BAD : GOOD) : undefined));
  rep.r++;
  if (!issues.length) { rep.line([L('✓ Every formula looks healthy.', '✓ Toutes les formules semblent saines.', '✓ Todas las fórmulas parecen correctas.', '✓ Todas as fórmulas parecem corretas.', '✓ Alle Formeln wirken in Ordnung.')], GOOD); return; }
  rep.head(L('Cell', 'Cellule', 'Celda', 'Célula', 'Zelle'), L('Point', 'Point', 'Punto', 'Ponto', 'Punkt'), L('Detail', 'Détail', 'Detalle', 'Detalhe', 'Detail'));
  for (const [ref, what, detail] of issues.slice(0, 500)) rep.line([ref, what, detail]);
}

function pivot(rep: Report, a: AuditInput) {
  const { c1, c2, r1, r2 } = a.box;
  if (c2 <= c1 || r2 <= r1) { rep.line([L('Select a table with a category column first and a number column last, headers included.', 'Sélectionnez un tableau avec une colonne de catégories en premier et une colonne de nombres en dernier, en-têtes compris.', 'Seleccione una tabla: categorías primero, números al final.', 'Selecione uma tabela: categorias primeiro, números no fim.', 'Tabelle markieren: Kategorien zuerst, Zahlen zuletzt.')], BAD); return; }
  const header = (c: number) => String(a.values.get(key(c, r1)) ?? '');
  const hasHeader = typeof a.values.get(key(c2, r1)) !== 'number';
  const from = hasHeader ? r1 + 1 : r1;
  const cats: string[] = [];
  for (let r = from; r <= r2; r++) { const v = a.values.get(key(c1, r)); const s = v === undefined || v === null ? '' : String(v); if (s && !cats.includes(s)) cats.push(s); }
  const sr = sheetRef(a.sheet.name);
  const catRange = `${sr}!$${cellName(c1, from).replace(/\d+/, '')}$${from + 1}:$${cellName(c1, r2).replace(/\d+/, '')}$${r2 + 1}`;
  const numRange = `${sr}!$${cellName(c2, from).replace(/\d+/, '')}$${from + 1}:$${cellName(c2, r2).replace(/\d+/, '')}$${r2 + 1}`;
  rep.head(hasHeader && header(c1) ? (Array(5).fill(header(c1)) as unknown as Tx) : L('Category', 'Catégorie', 'Categoría', 'Categoria', 'Kategorie'),
    L('Total', 'Total', 'Total', 'Total', 'Summe'), L('Count', 'Nombre', 'Cantidad', 'Quantidade', 'Anzahl'), L('Average', 'Moyenne', 'Media', 'Média', 'Mittelwert'), L('Share', 'Part', 'Parte', 'Parte', 'Anteil'));
  const first = rep.r + 1, last = rep.r + cats.length;
  for (const cat of cats.slice(0, 1000)) {
    const r = rep.r + 1;
    rep.line([cat, `=SUMIF(${catRange},A${r},${numRange})`, `=COUNTIF(${catRange},A${r})`, `=IF(C${r}=0,"",B${r}/C${r})`, `=IF(B$${last + 1}=0,"",B${r}/B$${last + 1})`], i => (i === 4 ? PCT : i === 1 || i === 3 ? { format: 'number', decimals: 2, thousands: true } : undefined));
  }
  rep.line([L('Total', 'Total', 'Total', 'Total', 'Summe'), `=SUM(B${first}:B${last})`, `=SUM(C${first}:C${last})`, `=IF(C${last + 1}=0,"",B${last + 1}/C${last + 1})`, `=IF(B${last + 1}=0,"",1)`], i => (i === 4 ? { ...PCT, bold: true } : { bold: true, format: i ? 'number' : undefined, decimals: i ? 2 : undefined, thousands: i ? true : undefined }));
  rep.r++;
  rep.line([L('The table follows the data: change a number on the source sheet and it updates.', 'Le tableau suit les données : changez un nombre sur la feuille source et il se met à jour.', 'La tabla sigue los datos.', 'A tabela acompanha os dados.', 'Die Tabelle folgt den Daten.')], NOTE);
}
