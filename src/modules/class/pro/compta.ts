// Accounting models: charts of accounts (French PCG, OHADA), journal, ledger, trial balance, balance sheet, income
// statement, VAT in 20 countries, invoice, bank reconciliation, fixed assets, aging, ratios… All with real formulas.

import { head, inp, note, out, type Model, type Row, type Tx } from './build';
import type { ProTool } from './tools';

const L = (en: string, fr: string, es: string, pt: string, de: string): Tx => [en, fr, es, pt, de];
const C = {
  date: L('Date', 'Date', 'Fecha', 'Data', 'Datum'),
  account: L('Account', 'Compte', 'Cuenta', 'Conta', 'Konto'),
  label: L('Description', 'Libellé', 'Concepto', 'Descrição', 'Buchungstext'),
  debit: L('Debit', 'Débit', 'Debe', 'Débito', 'Soll'),
  credit: L('Credit', 'Crédit', 'Haber', 'Crédito', 'Haben'),
  balance: L('Balance', 'Solde', 'Saldo', 'Saldo', 'Saldo'),
  total: L('Total', 'Total', 'Total', 'Total', 'Summe'),
  amount: L('Amount', 'Montant', 'Importe', 'Valor', 'Betrag'),
  piece: L('Voucher', 'Pièce', 'Justificante', 'Documento', 'Beleg'),
  change: L('Change the yellow cells: everything else is worked out by itself.', 'Changez les cellules jaunes : tout le reste se calcule tout seul.', 'Cambie las celdas amarillas: todo lo demás se calcula solo.', 'Altere as células amarelas: todo o resto é calculado sozinho.', 'Ändern Sie die gelben Zellen: alles andere rechnet sich selbst.'),
  check: L('Check', 'Contrôle', 'Control', 'Controlo', 'Prüfung'),
};
const rows = (n: number, f: (i: number) => Row): Row[] => Array.from({ length: n }, (_, i) => f(i));
const ok = L('=IF(ROUND({x},2)=0,"✓ Balanced","✗ Difference")', '=IF(ROUND({x},2)=0,"✓ Équilibré","✗ Écart")', '=IF(ROUND({x},2)=0,"✓ Cuadrado","✗ Diferencia")', '=IF(ROUND({x},2)=0,"✓ Equilibrado","✗ Diferença")', '=IF(ROUND({x},2)=0,"✓ Ausgeglichen","✗ Differenz")');
const okOf = (x: string): Tx => ok.map(s => s.replace('{x}', x)) as unknown as Tx;

// ---------- charts of accounts ----------
const PCG: [string, string][] = [
  ['1', 'Comptes de capitaux'], ['101', 'Capital'], ['106', 'Réserves'], ['12', 'Résultat de l’exercice'], ['164', 'Emprunts auprès des établissements de crédit'],
  ['2', 'Comptes d’immobilisations'], ['205', 'Logiciels, brevets'], ['211', 'Terrains'], ['213', 'Constructions'], ['215', 'Installations techniques, matériel'], ['218', 'Autres immobilisations corporelles'], ['28', 'Amortissements des immobilisations'],
  ['3', 'Comptes de stocks'], ['31', 'Matières premières'], ['37', 'Stocks de marchandises'],
  ['4', 'Comptes de tiers'], ['401', 'Fournisseurs'], ['411', 'Clients'], ['421', 'Personnel – rémunérations dues'], ['431', 'Sécurité sociale'], ['44566', 'TVA déductible'], ['44571', 'TVA collectée'],
  ['5', 'Comptes financiers'], ['512', 'Banque'], ['53', 'Caisse'],
  ['6', 'Comptes de charges'], ['601', 'Achats de matières premières'], ['607', 'Achats de marchandises'], ['613', 'Locations'], ['616', 'Assurances'], ['622', 'Honoraires'], ['626', 'Frais postaux et télécommunications'], ['641', 'Rémunérations du personnel'], ['645', 'Charges de sécurité sociale'], ['661', 'Charges d’intérêts'], ['681', 'Dotations aux amortissements'],
  ['7', 'Comptes de produits'], ['701', 'Ventes de produits finis'], ['706', 'Prestations de services'], ['707', 'Ventes de marchandises'], ['76', 'Produits financiers'], ['77', 'Produits exceptionnels'],
];
const OHADA: [string, string][] = [
  ['1', 'Comptes de ressources durables'], ['101', 'Capital social'], ['11', 'Réserves'], ['13', 'Résultat net de l’exercice'], ['16', 'Emprunts et dettes assimilées'],
  ['2', 'Comptes d’actif immobilisé'], ['21', 'Immobilisations incorporelles'], ['22', 'Terrains'], ['23', 'Bâtiments, installations techniques'], ['24', 'Matériel, mobilier'], ['245', 'Matériel de transport'], ['28', 'Amortissements'],
  ['3', 'Comptes de stocks'], ['31', 'Marchandises'], ['32', 'Matières premières'],
  ['4', 'Comptes de tiers'], ['401', 'Fournisseurs'], ['411', 'Clients'], ['421', 'Personnel, avances et acomptes'], ['431', 'Sécurité sociale'], ['443', 'État, TVA facturée'], ['445', 'État, TVA récupérable'],
  ['5', 'Comptes de trésorerie'], ['521', 'Banques locales'], ['571', 'Caisse'], ['585', 'Virements de fonds'],
  ['6', 'Comptes de charges des activités ordinaires'], ['601', 'Achats de marchandises'], ['604', 'Achats stockés de matières'], ['605', 'Autres achats (eau, électricité…)'], ['622', 'Locations'], ['625', 'Primes d’assurance'], ['628', 'Frais de télécommunications'], ['661', 'Rémunérations directes versées au personnel'], ['664', 'Charges sociales'], ['671', 'Intérêts des emprunts'], ['681', 'Dotations aux amortissements'],
  ['7', 'Comptes de produits des activités ordinaires'], ['701', 'Ventes de marchandises'], ['702', 'Ventes de produits finis'], ['706', 'Services vendus'], ['77', 'Revenus financiers'],
  ['8', 'Comptes des autres charges et produits (HAO)'], ['81', 'Valeurs comptables des cessions d’immobilisations'], ['82', 'Produits des cessions d’immobilisations'],
  ['9', 'Comptabilité analytique de gestion'],
];
const chart = (list: [string, string][], source: Tx): Model => ({
  widths: [110, 380, 140],
  freeze: 2,
  rows: [
    note(source),
    head(C.account, L('Account name', 'Intitulé du compte', 'Nombre de la cuenta', 'Nome da conta', 'Kontobezeichnung'), L('Class', 'Classe', 'Clase', 'Classe', 'Klasse')),
    ...list.map(([n, name]) => [n.length === 1 ? { v: n, bold: true as const } : n, n.length === 1 ? { v: name, bold: true as const } : name, out('=LEFT(A{r},1)', 'text')] as Row),
  ],
});

const journalLines: [string, string, string, number, number][] = [
  ['P001', '512', 'Apport en capital / Capital contribution', 10000, 0], ['P001', '101', 'Apport en capital / Capital contribution', 0, 10000],
  ['P002', '607', 'Achat de marchandises / Goods bought', 2000, 0], ['P002', '44566', 'TVA déductible / Input VAT', 400, 0], ['P002', '401', 'Fournisseur A / Supplier A', 0, 2400],
  ['P003', '411', 'Client B / Customer B', 3600, 0], ['P003', '707', 'Vente de marchandises / Sales', 0, 3000], ['P003', '44571', 'TVA collectée / Output VAT', 0, 600],
];
const journal: Model = {
  widths: [110, 90, 100, 300, 120, 120],
  freeze: 3,
  rows: [
    note(L('One line per account; each voucher has as much debit as credit. The check below says if the journal balances.', 'Une ligne par compte ; chaque pièce a autant au débit qu’au crédit. Le contrôle en bas dit si le journal est équilibré.', 'Una línea por cuenta; cada asiento cuadra debe y haber.', 'Uma linha por conta; cada lançamento equilibra débito e crédito.', 'Eine Zeile je Konto; jeder Beleg hat gleich viel Soll wie Haben.')),
    head(C.date, C.piece, C.account, C.label, C.debit, C.credit),
    ...journalLines.map(([p, a, l, d, c], i) => [inp(`2026-01-${String(2 + Math.floor(i / 3)).padStart(2, '0')}`, 'date'), inp(p, 'text'), inp(a, 'text'), inp(l), inp(d || '', 'money'), inp(c || '', 'money')] as Row),
    ...rows(12, () => [inp('', 'date'), inp('', 'text'), inp('', 'text'), inp(''), inp('', 'money'), inp('', 'money')]),
    [{ v: C.total, total: true }, null, null, null, out('=SUM(E5:E24)', 'money', true), out('=SUM(F5:F24)', 'money', true)],
    [C.check, null, null, out(okOf('E25-F25'), 'text', true)],
  ],
};

const ledger: Model = {
  widths: [110, 300, 120, 120, 130],
  rows: [
    note(L('The movements of one account, with its running balance.', 'Les mouvements d’un compte, avec son solde progressif.', 'Los movimientos de una cuenta y su saldo.', 'Os movimentos de uma conta e o seu saldo.', 'Die Bewegungen eines Kontos mit laufendem Saldo.')),
    [C.account, inp('512 Banque', 'text')],
    [L('Opening balance', 'Solde d’ouverture', 'Saldo inicial', 'Saldo inicial', 'Anfangssaldo'), inp(5000, 'money', 'o')],
    head(C.date, C.label, C.debit, C.credit, C.balance),
    ...rows(15, i => [inp(i < 4 ? `2026-01-${String(5 + i * 5).padStart(2, '0')}` : '', 'date'), inp(['Encaissement client', 'Loyer', 'Fournisseur A', 'Vente comptant', ''][Math.min(i, 4)]), inp([3600, '', '', 900, ''][Math.min(i, 4)], 'money'), inp(['', 800, 2400, '', ''][Math.min(i, 4)], 'money'), out(i === 0 ? '=$o+C{r}-D{r}' : '=E{r-1}+C{r}-D{r}')]),
    [{ v: C.total, total: true }, null, out('=SUM(C7:C21)', 'money', true), out('=SUM(D7:D21)', 'money', true), out('=E21', 'money', true)],
  ],
};

const tb: [string, string, number, number][] = [
  ['101', 'Capital', 0, 10000], ['164', 'Emprunts', 0, 15000], ['213', 'Constructions', 20000, 0], ['401', 'Fournisseurs', 0, 2400], ['411', 'Clients', 3600, 0],
  ['512', 'Banque', 8200, 0], ['607', 'Achats de marchandises', 2000, 0], ['613', 'Locations', 800, 0], ['641', 'Salaires', 4000, 0], ['707', 'Ventes de marchandises', 0, 11200],
];
const trial: Model = {
  widths: [100, 280, 120, 120, 130, 130],
  rows: [
    note(C.change),
    head(C.account, L('Name', 'Intitulé', 'Nombre', 'Nome', 'Bezeichnung'), L('Total debit', 'Total débit', 'Total debe', 'Total débito', 'Summe Soll'), L('Total credit', 'Total crédit', 'Total haber', 'Total crédito', 'Summe Haben'), L('Debit balance', 'Solde débiteur', 'Saldo deudor', 'Saldo devedor', 'Sollsaldo'), L('Credit balance', 'Solde créditeur', 'Saldo acreedor', 'Saldo credor', 'Habensaldo')),
    ...tb.map(([a, n, d, c]) => [inp(a, 'text'), inp(n), inp(d, 'money'), inp(c, 'money'), out('=MAX(0,C{r}-D{r})'), out('=MAX(0,D{r}-C{r})')] as Row),
    ...rows(6, () => [inp('', 'text'), inp(''), inp('', 'money'), inp('', 'money'), out('=MAX(0,C{r}-D{r})'), out('=MAX(0,D{r}-C{r})')]),
    [{ v: C.total, total: true }, null, out('=SUM(C5:C20)', 'money', true), out('=SUM(D5:D20)', 'money', true), out('=SUM(E5:E20)', 'money', true), out('=SUM(F5:F20)', 'money', true)],
    [C.check, out(okOf('C21-D21'), 'text', true)],
  ],
};

const bsA: Tx[] = [L('Intangible assets', 'Immobilisations incorporelles', 'Inmovilizado intangible', 'Ativos intangíveis', 'Immaterielle Vermögenswerte'), L('Property, plant, equipment', 'Immobilisations corporelles', 'Inmovilizado material', 'Ativos fixos tangíveis', 'Sachanlagen'), L('Financial assets', 'Immobilisations financières', 'Inversiones financieras', 'Ativos financeiros', 'Finanzanlagen'), L('Inventory', 'Stocks', 'Existencias', 'Inventários', 'Vorräte'), L('Receivables', 'Créances clients', 'Clientes', 'Clientes', 'Forderungen'), L('Cash', 'Trésorerie', 'Tesorería', 'Caixa', 'Liquide Mittel')];
const bsL: Tx[] = [L('Share capital', 'Capital', 'Capital', 'Capital', 'Gezeichnetes Kapital'), L('Reserves', 'Réserves', 'Reservas', 'Reservas', 'Rücklagen'), L('Profit of the year', 'Résultat de l’exercice', 'Resultado del ejercicio', 'Resultado do exercício', 'Jahresergebnis'), L('Long-term loans', 'Emprunts', 'Deudas a largo plazo', 'Empréstimos', 'Langfristige Darlehen'), L('Suppliers', 'Dettes fournisseurs', 'Proveedores', 'Fornecedores', 'Lieferanten'), L('Tax and social debts', 'Dettes fiscales et sociales', 'Deudas fiscales y sociales', 'Dívidas fiscais e sociais', 'Steuer- und Sozialschulden')];
const balance: Model = {
  widths: [260, 130, 30, 260, 130],
  rows: [
    note(C.change),
    head(L('Assets', 'Actif', 'Activo', 'Ativo', 'Aktiva'), C.amount, '', L('Equity and liabilities', 'Passif', 'Patrimonio neto y pasivo', 'Capital próprio e passivo', 'Passiva'), C.amount),
    ...bsA.map((a, i) => [a, inp([5000, 60000, 2000, 12000, 18000, 9000][i], 'money'), null, bsL[i], inp([30000, 8000, 7000, 40000, 15000, 6000][i], 'money')] as Row),
    [{ v: L('Total assets', 'Total actif', 'Total activo', 'Total ativo', 'Summe Aktiva'), total: true }, out('=SUM(B5:B10)', 'money', true), null, { v: L('Total equity and liabilities', 'Total passif', 'Total patrimonio y pasivo', 'Total capital e passivo', 'Summe Passiva'), total: true }, out('=SUM(E5:E10)', 'money', true)],
    [C.check, out(okOf('B11-E11'), 'text', true)],
  ],
};

const incomeLines: [Tx, number, boolean][] = [
  [L('Sales of goods', 'Ventes de marchandises', 'Ventas de mercaderías', 'Vendas de mercadorias', 'Warenverkäufe'), 120000, true],
  [L('Services sold', 'Prestations de services', 'Servicios prestados', 'Prestações de serviços', 'Dienstleistungen'), 30000, true],
  [L('Other income', 'Autres produits', 'Otros ingresos', 'Outros rendimentos', 'Sonstige Erträge'), 2000, true],
  [L('Purchases of goods', 'Achats de marchandises', 'Compras', 'Compras', 'Wareneinkauf'), 70000, false],
  [L('External charges (rent, insurance…)', 'Charges externes (loyer, assurances…)', 'Servicios exteriores', 'Fornecimentos e serviços externos', 'Fremdleistungen'), 15000, false],
  [L('Staff costs', 'Charges de personnel', 'Gastos de personal', 'Gastos com pessoal', 'Personalaufwand'), 40000, false],
  [L('Depreciation', 'Dotations aux amortissements', 'Amortizaciones', 'Depreciações', 'Abschreibungen'), 6000, false],
  [L('Interest paid', 'Charges financières', 'Gastos financieros', 'Gastos financeiros', 'Zinsaufwand'), 2000, false],
];
const income: Model = {
  widths: [320, 140, 120],
  rows: [
    note(C.change),
    [L('Income tax rate', 'Taux de l’impôt sur les sociétés', 'Tipo del impuesto de sociedades', 'Taxa de IRC', 'Körperschaftsteuersatz'), inp(0.25, 'pct', 'tax')],
    head('', C.amount, L('% of sales', '% du CA', '% de ventas', '% das vendas', '% vom Umsatz')),
    ...incomeLines.map(([n, v]) => [n, inp(v, 'money'), out('=B{r}/SUM($B$6:$B$7)', 'pct')] as Row),
    [{ v: L('Total income', 'Total des produits', 'Total ingresos', 'Total rendimentos', 'Summe Erträge'), bold: true }, out('=SUM(B6:B8)', 'money', true)],
    [{ v: L('Total charges', 'Total des charges', 'Total gastos', 'Total gastos', 'Summe Aufwendungen'), bold: true }, out('=SUM(B9:B13)', 'money', true)],
    [L('Profit before tax', 'Résultat avant impôt', 'Resultado antes de impuestos', 'Resultado antes de impostos', 'Ergebnis vor Steuern'), out('=B14-B15', 'money', true)],
    [L('Income tax', 'Impôt sur les bénéfices', 'Impuesto', 'Imposto', 'Steuern'), out('=MAX(0,B16*$tax)')],
    [{ v: L('Net profit', 'Résultat net', 'Resultado neto', 'Resultado líquido', 'Jahresüberschuss'), total: true }, out('=B16-B17', 'money', true), out('=B18/SUM(B6:B7)', 'pct', true)],
  ],
};

const VAT: [string, number][] = [
  ['France', 0.2], ['Belgique', 0.21], ['Suisse', 0.081], ['Luxembourg', 0.17], ['Canada (TPS)', 0.05], ['Québec (TPS+TVQ)', 0.14975], ['Cameroun', 0.1925], ['Sénégal', 0.18],
  ["Côte d'Ivoire", 0.18], ['RD Congo', 0.16], ['Gabon', 0.18], ['Congo', 0.18], ['Maroc', 0.2], ['Tunisie', 0.19], ['Algérie', 0.19], ['Bénin', 0.18],
  ['Burkina Faso', 0.18], ['Mali', 0.18], ['Togo', 0.18], ['Madagascar', 0.2], ['España', 0.21], ['Portugal', 0.23], ['Deutschland', 0.19], ['Italia', 0.22], ['United Kingdom', 0.2], ['Nigeria', 0.075],
];
const vat: Model = {
  widths: [220, 140, 30, 200, 110],
  rows: [
    note(L('Pick a country (or type a rate) and an amount before or with tax.', 'Choisissez un pays (ou tapez un taux) et un montant HT ou TTC.', 'Elija un país (o un tipo) y un importe sin o con IVA.', 'Escolha um país (ou uma taxa) e um valor sem ou com IVA.', 'Land (oder Satz) und Betrag netto oder brutto wählen.')),
    [L('Country', 'Pays', 'País', 'País', 'Land'), inp('France', 'text', 'ctry'), null, head(L('Country', 'Pays', 'País', 'País', 'Land'))[0], head(L('Rate', 'Taux', 'Tipo', 'Taxa', 'Satz'))[0]],
    [L('VAT rate', 'Taux de TVA', 'Tipo de IVA', 'Taxa de IVA', 'MwSt.-Satz'), out('=IFERROR(VLOOKUP($ctry,$D$5:$E$30,2,FALSE),0)', 'pct', false, 'r'), null, VAT[0][0], { v: VAT[0][1], f: 'pct' }],
    [L('Amount before tax', 'Montant HT', 'Importe sin IVA', 'Valor sem IVA', 'Nettobetrag'), inp(1000, 'money', 'ht'), null, VAT[1][0], { v: VAT[1][1], f: 'pct' }],
    [L('VAT', 'TVA', 'IVA', 'IVA', 'MwSt.'), out('=$ht*$r'), null, VAT[2][0], { v: VAT[2][1], f: 'pct' }],
    [L('Amount with tax', 'Montant TTC', 'Importe con IVA', 'Valor com IVA', 'Bruttobetrag'), out('=$ht*(1+$r)', 'money', true), null, VAT[3][0], { v: VAT[3][1], f: 'pct' }],
    [L('Or: amount with tax', 'Ou : montant TTC', 'O: importe con IVA', 'Ou: valor com IVA', 'Oder: Bruttobetrag'), inp(1200, 'money', 'ttc'), null, VAT[4][0], { v: VAT[4][1], f: 'pct' }],
    [L('Amount before tax', 'Montant HT', 'Importe sin IVA', 'Valor sem IVA', 'Nettobetrag'), out('=$ttc/(1+$r)', 'money', true), null, VAT[5][0], { v: VAT[5][1], f: 'pct' }],
    [L('VAT inside', 'TVA incluse', 'IVA incluido', 'IVA incluído', 'Enthaltene MwSt.'), out('=$ttc-$ttc/(1+$r)'), null, VAT[6][0], { v: VAT[6][1], f: 'pct' }],
    ...VAT.slice(7).map(([c, r]) => [null, null, null, c, { v: r, f: 'pct' as const }] as Row),
  ],
};

const invoice: Model = {
  widths: [300, 90, 120, 130],
  rows: [
    [L('Invoice no.', 'Facture n°', 'Factura n.º', 'Fatura n.º', 'Rechnung Nr.'), inp('2026-001', 'text')],
    [C.date, inp('2026-10-31', 'date')],
    [L('Customer', 'Client', 'Cliente', 'Cliente', 'Kunde'), inp(L('Customer name and address', 'Nom et adresse du client', 'Nombre y dirección', 'Nome e morada', 'Name und Adresse'))],
    [L('VAT rate', 'Taux de TVA', 'Tipo de IVA', 'Taxa de IVA', 'MwSt.-Satz'), inp(0.2, 'pct', 'r')],
    head(L('Item', 'Désignation', 'Concepto', 'Descrição', 'Leistung'), L('Qty', 'Qté', 'Cant.', 'Qtd.', 'Menge'), L('Unit price', 'Prix unitaire', 'Precio unitario', 'Preço unitário', 'Einzelpreis'), L('Line total', 'Total ligne', 'Total línea', 'Total linha', 'Gesamt')),
    ...rows(10, i => [inp(i === 0 ? L('Consulting (day)', 'Conseil (jour)', 'Consultoría (día)', 'Consultoria (dia)', 'Beratung (Tag)') : i === 1 ? L('Travel costs', 'Frais de déplacement', 'Desplazamiento', 'Deslocação', 'Reisekosten') : ''), inp(i === 0 ? 3 : i === 1 ? 1 : '', 'num'), inp(i === 0 ? 600 : i === 1 ? 150 : '', 'money'), out('=IF(B{r}="","",B{r}*C{r})')]),
    [null, null, L('Total before tax', 'Total HT', 'Total sin IVA', 'Total sem IVA', 'Netto'), out('=SUM(D8:D17)', 'money', false, 'ht')],
    [null, null, L('VAT', 'TVA', 'IVA', 'IVA', 'MwSt.'), out('=$ht*$r')],
    [null, null, { v: L('Total to pay', 'Total TTC', 'Total a pagar', 'Total a pagar', 'Zu zahlen'), bold: true }, out('=$ht*(1+$r)', 'money', true)],
  ],
};

const bank: Model = {
  widths: [320, 140, 30, 320, 140],
  rows: [
    note(L('Find why your books and your bank statement differ.', 'Trouvez pourquoi vos comptes et votre relevé bancaire diffèrent.', 'Encuentre por qué sus libros y el banco difieren.', 'Descubra porque os livros e o banco diferem.', 'Finden Sie, warum Buchhaltung und Kontoauszug abweichen.')),
    head(L('Our books', 'Nos comptes', 'Nuestros libros', 'Os nossos livros', 'Unsere Bücher'), C.amount, '', L('Bank statement', 'Relevé bancaire', 'Extracto bancario', 'Extrato bancário', 'Kontoauszug'), C.amount),
    [L('Balance in our books', 'Solde comptable', 'Saldo contable', 'Saldo contabilístico', 'Buchsaldo'), inp(8200, 'money'), null, L('Balance on statement', 'Solde du relevé', 'Saldo del extracto', 'Saldo do extrato', 'Saldo laut Auszug'), inp(9050, 'money')],
    [L('+ Transfers received not booked', '+ Virements reçus non comptabilisés', '+ Transferencias no contabilizadas', '+ Transferências não registadas', '+ Nicht gebuchte Eingänge'), inp(300, 'money'), null, L('+ Deposits not yet on statement', '+ Remises non encore créditées', '+ Ingresos aún no abonados', '+ Depósitos ainda não creditados', '+ Noch nicht gutgeschriebene Einzahlungen'), inp(450, 'money')],
    [L('− Bank fees not booked', '− Frais bancaires non comptabilisés', '− Comisiones no contabilizadas', '− Comissões não registadas', '− Nicht gebuchte Bankgebühren'), inp(50, 'money'), null, L('− Cheques not yet cashed', '− Chèques non encore débités', '− Cheques no cobrados', '− Cheques não descontados', '− Nicht eingelöste Schecks'), inp(1000, 'money')],
    [{ v: L('Adjusted balance', 'Solde rectifié', 'Saldo ajustado', 'Saldo ajustado', 'Bereinigter Saldo'), total: true }, out('=B5+B6-B7', 'money', true), null, { v: L('Adjusted balance', 'Solde rectifié', 'Saldo ajustado', 'Saldo ajustado', 'Bereinigter Saldo'), total: true }, out('=E5+E6-E7', 'money', true)],
    [C.check, out(okOf('B8-E8'), 'text', true)],
  ],
};

const assets: Model = {
  widths: [220, 110, 120, 80, 120, 130, 130],
  rows: [
    note(L('Straight-line depreciation of each asset, to today.', 'Amortissement linéaire de chaque immobilisation, jusqu’à aujourd’hui.', 'Amortización lineal de cada activo hasta hoy.', 'Depreciação linear de cada ativo até hoje.', 'Lineare Abschreibung je Anlage bis heute.')),
    head(L('Asset', 'Immobilisation', 'Activo', 'Ativo', 'Anlage'), L('Bought on', 'Date d’achat', 'Fecha de compra', 'Data de compra', 'Gekauft am'), L('Cost', 'Coût', 'Coste', 'Custo', 'Kosten'), L('Years', 'Années', 'Años', 'Anos', 'Jahre'), L('Per year', 'Annuité', 'Por año', 'Por ano', 'Pro Jahr'), L('Depreciated so far', 'Amortissements cumulés', 'Amortización acumulada', 'Depreciação acumulada', 'Kumulierte AfA'), L('Net book value', 'Valeur nette comptable', 'Valor neto contable', 'Valor líquido contabilístico', 'Restbuchwert')),
    ...([[L('Computer', 'Ordinateur', 'Ordenador', 'Computador', 'Computer'), '2024-03-01', 1500, 3], [L('Car', 'Véhicule', 'Vehículo', 'Viatura', 'Fahrzeug'), '2023-06-15', 24000, 5], [L('Furniture', 'Mobilier', 'Mobiliario', 'Mobiliário', 'Möbel'), '2022-01-10', 6000, 10], [L('Machine', 'Machine', 'Máquina', 'Máquina', 'Maschine'), '2025-09-01', 40000, 8]] as const)
      .map(([n, d, c, y]) => [inp(n as Tx), inp(d, 'date'), inp(c, 'money'), inp(y, 'int'), out('=C{r}/D{r}'), out('=MIN(C{r},E{r}*YEARFRAC(B{r},TODAY()))'), out('=C{r}-F{r}', 'money', true)] as Row),
    ...rows(4, () => [inp(''), inp('', 'date'), inp('', 'money'), inp('', 'int'), out('=IF(C{r}="","",C{r}/D{r})'), out('=IF(C{r}="","",MIN(C{r},E{r}*YEARFRAC(B{r},TODAY())))'), out('=IF(C{r}="","",C{r}-F{r})')]),
    [{ v: C.total, total: true }, null, out('=SUM(C5:C12)', 'money', true), null, out('=SUM(E5:E12)', 'money', true), out('=SUM(F5:F12)', 'money', true), out('=SUM(G5:G12)', 'money', true)],
  ],
};

const aging: Model = {
  widths: [200, 110, 120, 80, 110, 110, 110, 110],
  rows: [
    note(L('Unpaid invoices by age, counted from today.', 'Factures impayées par ancienneté, à partir d’aujourd’hui.', 'Facturas impagadas por antigüedad.', 'Faturas por pagar por antiguidade.', 'Offene Rechnungen nach Alter.')),
    head(L('Customer', 'Client', 'Cliente', 'Cliente', 'Kunde'), L('Due date', 'Échéance', 'Vencimiento', 'Vencimento', 'Fällig am'), C.amount, L('Days late', 'Jours de retard', 'Días de retraso', 'Dias de atraso', 'Tage überfällig'), '0–30', '31–60', '61–90', '> 90'),
    ...rows(10, i => [inp(i < 5 ? `Client ${String.fromCharCode(65 + i)}` : ''), inp(i < 5 ? `2026-${String(5 + i).padStart(2, '0')}-15` : '', 'date'), inp(i < 5 ? [1200, 800, 2500, 400, 3000][i] : '', 'money'), out('=IF(B{r}="","",MAX(0,TODAY()-B{r}))', 'int'),
      out('=IF(D{r}="","",IF(D{r}<=30,C{r},0))'), out('=IF(D{r}="","",IF(AND(D{r}>30,D{r}<=60),C{r},0))'), out('=IF(D{r}="","",IF(AND(D{r}>60,D{r}<=90),C{r},0))'), out('=IF(D{r}="","",IF(D{r}>90,C{r},0))')]),
    [{ v: C.total, total: true }, null, out('=SUM(C5:C14)', 'money', true), null, out('=SUM(E5:E14)', 'money', true), out('=SUM(F5:F14)', 'money', true), out('=SUM(G5:G14)', 'money', true), out('=SUM(H5:H14)', 'money', true)],
    [L('Share', 'Part', 'Parte', 'Parte', 'Anteil'), null, null, null, out('=IF($C$15=0,"",E15/$C$15)', 'pct'), out('=IF($C$15=0,"",F15/$C$15)', 'pct'), out('=IF($C$15=0,"",G15/$C$15)', 'pct'), out('=IF($C$15=0,"",H15/$C$15)', 'pct')],
  ],
};

const ratios: Model = {
  widths: [300, 140, 30, 300, 120],
  rows: [
    note(C.change),
    head(L('From the accounts', 'Données des comptes', 'Datos', 'Dados', 'Aus dem Abschluss'), C.amount, '', L('Ratio', 'Ratio', 'Ratio', 'Rácio', 'Kennzahl'), L('Value', 'Valeur', 'Valor', 'Valor', 'Wert')),
    [L('Sales', 'Chiffre d’affaires', 'Ventas', 'Vendas', 'Umsatz'), inp(150000, 'money', 'ca'), null, L('Net margin', 'Marge nette', 'Margen neto', 'Margem líquida', 'Nettomarge'), out('=$np/$ca', 'pct')],
    [L('Net profit', 'Résultat net', 'Beneficio neto', 'Lucro líquido', 'Jahresüberschuss'), inp(13500, 'money', 'np'), null, L('Return on equity (ROE)', 'Rentabilité des capitaux propres (ROE)', 'Rentabilidad financiera (ROE)', 'Rendibilidade do capital (ROE)', 'Eigenkapitalrendite (ROE)'), out('=$np/$eq', 'pct')],
    [L('Total assets', 'Total actif', 'Activo total', 'Ativo total', 'Bilanzsumme'), inp(106000, 'money', 'ta'), null, L('Return on assets (ROA)', 'Rentabilité économique (ROA)', 'Rentabilidad económica (ROA)', 'Rendibilidade do ativo (ROA)', 'Gesamtkapitalrendite (ROA)'), out('=$np/$ta', 'pct')],
    [L('Equity', 'Capitaux propres', 'Patrimonio neto', 'Capital próprio', 'Eigenkapital'), inp(45000, 'money', 'eq'), null, L('Current ratio', 'Liquidité générale', 'Ratio de liquidez', 'Liquidez geral', 'Liquidität 3. Grades'), out('=$cas/$cl', 'num')],
    [L('Debts', 'Dettes', 'Deudas', 'Dívidas', 'Verbindlichkeiten'), inp(61000, 'money', 'debt'), null, L('Quick ratio', 'Liquidité réduite', 'Prueba ácida', 'Liquidez reduzida', 'Liquidität 2. Grades'), out('=($cas-$inv)/$cl', 'num')],
    [L('Current assets', 'Actif circulant', 'Activo corriente', 'Ativo corrente', 'Umlaufvermögen'), inp(39000, 'money', 'cas'), null, L('Debt to equity', 'Endettement (dettes / capitaux propres)', 'Endeudamiento', 'Endividamento', 'Verschuldungsgrad'), out('=$debt/$eq', 'num')],
    [L('of which inventory', 'dont stocks', 'de ello existencias', 'dos quais inventários', 'davon Vorräte'), inp(12000, 'money', 'inv'), null, L('Asset turnover', 'Rotation de l’actif', 'Rotación del activo', 'Rotação do ativo', 'Kapitalumschlag'), out('=$ca/$ta', 'num')],
    [L('Current liabilities', 'Dettes à court terme', 'Pasivo corriente', 'Passivo corrente', 'Kurzfristige Schulden'), inp(21000, 'money', 'cl'), null, L('Working capital', 'Fonds de roulement', 'Fondo de maniobra', 'Fundo de maneio', 'Working Capital'), out('=$cas-$cl')],
  ],
};

const petty: Model = {
  widths: [110, 300, 120, 120, 130],
  rows: [
    note(C.change),
    [L('Cash at start', 'Caisse au départ', 'Caja inicial', 'Caixa inicial', 'Anfangsbestand'), inp(500, 'money', 'o')],
    head(C.date, C.label, L('In', 'Entrée', 'Entrada', 'Entrada', 'Einnahme'), L('Out', 'Sortie', 'Salida', 'Saída', 'Ausgabe'), C.balance),
    ...rows(15, i => [inp(i < 3 ? `2026-10-${String(2 + i * 3).padStart(2, '0')}` : '', 'date'), inp(i === 0 ? L('Stamps', 'Timbres', 'Sellos', 'Selos', 'Briefmarken') : i === 1 ? L('Coffee', 'Café', 'Café', 'Café', 'Kaffee') : i === 2 ? L('Refill from bank', 'Approvisionnement banque', 'Reposición', 'Reposição', 'Auffüllung') : ''), inp(i === 2 ? 200 : '', 'money'), inp(i === 0 ? 18 : i === 1 ? 25 : '', 'money'), out(i === 0 ? '=$o+C{r}-D{r}' : '=E{r-1}+C{r}-D{r}')]),
    [{ v: C.total, total: true }, null, out('=SUM(C6:C20)', 'money', true), out('=SUM(D6:D20)', 'money', true), out('=E20', 'money', true)],
  ],
};

const payroll: Model = {
  widths: [220, 120, 110, 120, 110, 120, 130],
  rows: [
    note(L('Rates differ by country: change the yellow rates to yours.', 'Les taux changent selon le pays : mettez les vôtres dans les cellules jaunes.', 'Los tipos cambian por país: ponga los suyos.', 'As taxas mudam por país: ponha as suas.', 'Sätze je Land verschieden: tragen Sie Ihre ein.')),
    [L('Employee contributions', 'Cotisations salariales', 'Cotizaciones del trabajador', 'Contribuições do trabalhador', 'Arbeitnehmeranteil'), inp(0.22, 'pct', 'ee')],
    [L('Employer contributions', 'Cotisations patronales', 'Cotizaciones de la empresa', 'Contribuições da entidade', 'Arbeitgeberanteil'), inp(0.42, 'pct', 'er')],
    head(L('Employee', 'Salarié', 'Empleado', 'Trabalhador', 'Mitarbeiter'), L('Gross pay', 'Salaire brut', 'Salario bruto', 'Salário bruto', 'Brutto'), L('Bonus', 'Prime', 'Prima', 'Prémio', 'Prämie'), L('Employee part', 'Part salariale', 'Parte trabajador', 'Parte trabalhador', 'AN-Anteil'), L('Net pay', 'Net à payer', 'Neto', 'Líquido', 'Netto'), L('Employer part', 'Part patronale', 'Parte empresa', 'Parte entidade', 'AG-Anteil'), L('Total cost', 'Coût total', 'Coste total', 'Custo total', 'Gesamtkosten')),
    ...rows(8, i => [inp(i < 3 ? ['Awa', 'Jean', 'Maria'][i] : ''), inp(i < 3 ? [2500, 3200, 2800][i] : '', 'money'), inp(i === 1 ? 300 : '', 'money'), out('=IF(B{r}="","",(B{r}+C{r})*$ee)'), out('=IF(B{r}="","",B{r}+C{r}-D{r})'), out('=IF(B{r}="","",(B{r}+C{r})*$er)'), out('=IF(B{r}="","",B{r}+C{r}+F{r})')]),
    [{ v: C.total, total: true }, out('=SUM(B7:B14)', 'money', true), out('=SUM(C7:C14)', 'money', true), out('=SUM(D7:D14)', 'money', true), out('=SUM(E7:E14)', 'money', true), out('=SUM(F7:F14)', 'money', true), out('=SUM(G7:G14)', 'money', true)],
  ],
};

const expense: Model = {
  widths: [110, 180, 260, 120, 90, 120],
  rows: [
    note(C.change),
    head(C.date, L('Category', 'Catégorie', 'Categoría', 'Categoria', 'Kategorie'), C.label, L('Amount with tax', 'Montant TTC', 'Importe con IVA', 'Valor com IVA', 'Brutto'), L('VAT rate', 'Taux TVA', 'IVA', 'IVA', 'MwSt.'), L('VAT to reclaim', 'TVA récupérable', 'IVA deducible', 'IVA dedutível', 'Vorsteuer')),
    ...rows(14, i => [inp(i < 3 ? `2026-10-${String(5 + i * 4).padStart(2, '0')}` : '', 'date'), inp(i === 0 ? L('Travel', 'Déplacement', 'Viaje', 'Viagem', 'Reise') : i === 1 ? L('Meals', 'Repas', 'Comidas', 'Refeições', 'Bewirtung') : i === 2 ? L('Supplies', 'Fournitures', 'Material', 'Material', 'Material') : ''), inp(''), inp(i === 0 ? 120 : i === 1 ? 45 : i === 2 ? 60 : '', 'money'), inp(i < 3 ? 0.2 : '', 'pct'), out('=IF(D{r}="","",D{r}-D{r}/(1+E{r}))')]),
    [{ v: C.total, total: true }, null, null, out('=SUM(D5:D18)', 'money', true), null, out('=SUM(F5:F18)', 'money', true)],
  ],
};

const stock: Model = {
  widths: [220, 100, 120, 130, 110, 160],
  rows: [
    note(C.change),
    head(L('Item', 'Article', 'Artículo', 'Artigo', 'Artikel'), L('Qty', 'Quantité', 'Cantidad', 'Quantidade', 'Menge'), L('Unit cost', 'Coût unitaire', 'Coste unitario', 'Custo unitário', 'Stückkosten'), L('Value', 'Valeur', 'Valor', 'Valor', 'Wert'), L('Reorder at', 'Seuil de commande', 'Punto de pedido', 'Ponto de encomenda', 'Meldebestand'), L('To order?', 'À commander ?', '¿Pedir?', 'Encomendar?', 'Bestellen?')),
    ...rows(12, i => [inp(i < 4 ? ['Article A', 'Article B', 'Article C', 'Article D'][i] : ''), inp(i < 4 ? [120, 15, 60, 4][i] : '', 'int'), inp(i < 4 ? [2.5, 18, 7.2, 95][i] : '', 'money'), out('=IF(B{r}="","",B{r}*C{r})'), inp(i < 4 ? [50, 20, 40, 5][i] : '', 'int'),
      out(L('=IF(B{r}="","",IF(B{r}<=E{r},"⚠ Order","OK"))', '=IF(B{r}="","",IF(B{r}<=E{r},"⚠ Commander","OK"))', '=IF(B{r}="","",IF(B{r}<=E{r},"⚠ Pedir","OK"))', '=IF(B{r}="","",IF(B{r}<=E{r},"⚠ Encomendar","OK"))', '=IF(B{r}="","",IF(B{r}<=E{r},"⚠ Bestellen","OK"))'), 'text')]),
    [{ v: C.total, total: true }, out('=SUM(B5:B16)', 'int', true), null, out('=SUM(D5:D16)', 'money', true)],
  ],
};

const cost: Model = {
  rows: [
    note(C.change),
    [L('Units made', 'Unités produites', 'Unidades producidas', 'Unidades produzidas', 'Produzierte Stück'), inp(1000, 'int', 'u')],
    head(L('Cost', 'Coût', 'Coste', 'Custo', 'Kosten'), C.amount, L('Per unit', 'Par unité', 'Por unidad', 'Por unidade', 'Je Stück')),
    ...([[L('Raw materials', 'Matières premières', 'Materias primas', 'Matérias-primas', 'Material'), 8000], [L('Direct labour', 'Main-d’œuvre directe', 'Mano de obra directa', 'Mão de obra direta', 'Fertigungslöhne'), 6000], [L('Energy', 'Énergie', 'Energía', 'Energia', 'Energie'), 1200], [L('Machine depreciation', 'Amortissement machines', 'Amortización máquinas', 'Depreciação máquinas', 'Maschinen-AfA'), 1500], [L('Overheads', 'Frais généraux', 'Gastos generales', 'Gastos gerais', 'Gemeinkosten'), 2300], [L('Packaging and shipping', 'Emballage et expédition', 'Embalaje y envío', 'Embalagem e envio', 'Verpackung und Versand'), 900]] as const)
      .map(([n, v]) => [n as Tx, inp(v, 'money'), out('=B{r}/$u')] as Row),
    [{ v: L('Cost price', 'Coût de revient', 'Coste total', 'Custo total', 'Selbstkosten'), total: true }, out('=SUM(B6:B11)', 'money', true), out('=B12/$u', 'money', true)],
  ],
};

const wc: Model = {
  rows: [
    note(C.change),
    [L('Inventory', 'Stocks', 'Existencias', 'Inventários', 'Vorräte'), inp(12000, 'money', 'i')],
    [L('Customer receivables', 'Créances clients', 'Clientes', 'Clientes', 'Forderungen'), inp(18000, 'money', 'c')],
    [L('Supplier debts', 'Dettes fournisseurs', 'Proveedores', 'Fornecedores', 'Lieferantenschulden'), inp(15000, 'money', 's')],
    [L('Working capital need', 'Besoin en fonds de roulement (BFR)', 'Necesidades operativas de fondos', 'Necessidades de fundo de maneio', 'Working-Capital-Bedarf'), out('=$i+$c-$s', 'money', true, 'w')],
    [L('Yearly sales', 'Chiffre d’affaires annuel', 'Ventas anuales', 'Vendas anuais', 'Jahresumsatz'), inp(150000, 'money', 'ca')],
    [L('In days of sales', 'En jours de chiffre d’affaires', 'En días de ventas', 'Em dias de vendas', 'In Umsatztagen'), out('=$w/$ca*365', 'int')],
    [L('Days customers take to pay', 'Délai clients (jours)', 'Plazo de cobro (días)', 'Prazo de recebimento (dias)', 'Kundenziel (Tage)'), out('=$c/($ca*1.2)*365', 'int')],
  ],
};

const payables: Model = {
  widths: [200, 110, 120, 80, 110, 110, 110],
  rows: [
    note(L('What you owe your suppliers, by due date.', 'Ce que vous devez à vos fournisseurs, par échéance.', 'Lo que debe a proveedores, por vencimiento.', 'O que deve a fornecedores, por vencimento.', 'Was Sie Lieferanten schulden, nach Fälligkeit.')),
    head(L('Supplier', 'Fournisseur', 'Proveedor', 'Fornecedor', 'Lieferant'), L('Due date', 'Échéance', 'Vencimiento', 'Vencimento', 'Fällig am'), C.amount, L('Days left', 'Jours restants', 'Días restantes', 'Dias restantes', 'Resttage'), L('Late', 'En retard', 'Vencido', 'Em atraso', 'Überfällig'), L('This week', 'Cette semaine', 'Esta semana', 'Esta semana', 'Diese Woche'), L('Later', 'Plus tard', 'Más tarde', 'Mais tarde', 'Später')),
    ...rows(10, i => [inp(i < 4 ? `Fournisseur ${i + 1}` : ''), inp(i < 4 ? `2026-11-${String(1 + i * 7).padStart(2, '0')}` : '', 'date'), inp(i < 4 ? [2400, 900, 1500, 600][i] : '', 'money'), out('=IF(B{r}="","",B{r}-TODAY())', 'int'),
      out('=IF(D{r}="","",IF(D{r}<0,C{r},0))'), out('=IF(D{r}="","",IF(AND(D{r}>=0,D{r}<=7),C{r},0))'), out('=IF(D{r}="","",IF(D{r}>7,C{r},0))')]),
    [{ v: C.total, total: true }, null, out('=SUM(C5:C14)', 'money', true), null, out('=SUM(E5:E14)', 'money', true), out('=SUM(F5:F14)', 'money', true), out('=SUM(G5:G14)', 'money', true)],
  ],
};

const SRC_PCG = L('French general chart of accounts (PCG), main accounts. Add your sub-accounts below.', 'Plan comptable général français (PCG), comptes principaux. Ajoutez vos sous-comptes en dessous.', 'Plan contable general francés (PCG), cuentas principales.', 'Plano de contas geral francês (PCG), contas principais.', 'Französischer Kontenrahmen (PCG), Hauptkonten.');
const SRC_OHADA = L('SYSCOHADA chart of accounts (17 African countries), main accounts.', 'Plan comptable SYSCOHADA (17 pays d’Afrique), comptes principaux.', 'Plan contable SYSCOHADA (17 países africanos).', 'Plano de contas SYSCOHADA (17 países africanos).', 'SYSCOHADA-Kontenrahmen (17 afrikanische Länder).');

export const COMPTA: ProTool[] = [
  { id: 'journal', icon: 'book', model: journal, name: L('General journal', 'Journal général', 'Libro diario', 'Diário', 'Grundbuch (Journal)'), desc: L('Entries by voucher, with the debit = credit check.', 'Écritures par pièce, avec le contrôle débit = crédit.', 'Asientos con control debe = haber.', 'Lançamentos com controlo débito = crédito.', 'Buchungen mit Soll-Haben-Prüfung.') },
  { id: 'ledger', icon: 'lines', model: ledger, name: L('Account ledger', 'Grand livre d’un compte', 'Libro mayor de una cuenta', 'Razão de uma conta', 'Kontenblatt'), desc: L('Movements of one account and its running balance.', 'Mouvements d’un compte et son solde progressif.', 'Movimientos y saldo de una cuenta.', 'Movimentos e saldo de uma conta.', 'Bewegungen und laufender Saldo.') },
  { id: 'trial', icon: 'table', model: trial, name: L('Trial balance', 'Balance générale', 'Balance de comprobación', 'Balancete', 'Summen- und Saldenliste'), desc: L('Totals and balances of every account, checked.', 'Totaux et soldes de chaque compte, contrôlés.', 'Totales y saldos de cada cuenta.', 'Totais e saldos de cada conta.', 'Summen und Salden aller Konten.') },
  { id: 'balance', icon: 'columns', model: balance, name: L('Balance sheet', 'Bilan', 'Balance de situación', 'Balanço', 'Bilanz'), desc: L('Assets against equity and liabilities, with the check.', 'Actif contre passif, avec le contrôle d’équilibre.', 'Activo frente a pasivo, con control.', 'Ativo vs passivo, com controlo.', 'Aktiva gegen Passiva, geprüft.') },
  { id: 'income', icon: 'barchart', model: income, name: L('Income statement', 'Compte de résultat', 'Cuenta de resultados', 'Demonstração de resultados', 'Gewinn- und Verlustrechnung'), desc: L('Income, charges, tax and net profit, with % of sales.', 'Produits, charges, impôt et résultat net, en % du CA.', 'Ingresos, gastos y resultado neto.', 'Rendimentos, gastos e resultado líquido.', 'Erträge, Aufwand und Jahresergebnis.') },
  { id: 'vat', icon: 'percent', model: vat, name: L('VAT in 26 countries', 'TVA dans 26 pays', 'IVA en 26 países', 'IVA em 26 países', 'MwSt. in 26 Ländern'), desc: L('Before tax ⇄ with tax, with the rate of the country you pick.', 'HT ⇄ TTC, avec le taux du pays choisi.', 'Sin ⇄ con IVA, según el país.', 'Sem ⇄ com IVA, conforme o país.', 'Netto ⇄ brutto, nach Land.') },
  { id: 'invoice', icon: 'file', model: invoice, name: L('Invoice', 'Facture', 'Factura', 'Fatura', 'Rechnung'), desc: L('Lines, VAT and total to pay, ready to print.', 'Lignes, TVA et total à payer, prête à imprimer.', 'Líneas, IVA y total, lista para imprimir.', 'Linhas, IVA e total, pronta a imprimir.', 'Positionen, MwSt. und Summe, druckfertig.') },
  { id: 'bank', icon: 'sync', model: bank, name: L('Bank reconciliation', 'Rapprochement bancaire', 'Conciliación bancaria', 'Reconciliação bancária', 'Bankabstimmung'), desc: L('Books and statement side by side until they match.', 'Comptes et relevé côte à côte jusqu’à l’accord.', 'Libros y extracto hasta que cuadren.', 'Livros e extrato até coincidirem.', 'Bücher und Auszug bis sie übereinstimmen.') },
  { id: 'assets', icon: 'gov', model: assets, name: L('Fixed assets and depreciation', 'Immobilisations et amortissements', 'Inmovilizado y amortizaciones', 'Ativos fixos e depreciações', 'Anlagenspiegel'), desc: L('Each asset’s depreciation to today and net book value.', 'Amortissement de chaque bien jusqu’à aujourd’hui et VNC.', 'Amortización y valor neto contable.', 'Depreciação e valor líquido.', 'AfA bis heute und Restbuchwert.') },
  { id: 'aging', icon: 'date', model: aging, name: L('Customer aging', 'Balance âgée clients', 'Antigüedad de clientes', 'Antiguidade de clientes', 'Offene Posten Kunden'), desc: L('Unpaid invoices by 0–30, 31–60, 61–90 and 90+ days.', 'Impayés à 0–30, 31–60, 61–90 et plus de 90 jours.', 'Impagos a 0–30, 31–60, 61–90 y 90+ días.', 'Por pagar a 0–30, 31–60, 61–90 e 90+ dias.', 'Offen nach 0–30, 31–60, 61–90, 90+ Tagen.') },
  { id: 'payables', icon: 'envelope', model: payables, name: L('Supplier payments due', 'Échéancier fournisseurs', 'Vencimientos de proveedores', 'Vencimentos de fornecedores', 'Fälligkeiten Lieferanten'), desc: L('What to pay, late, this week, later.', 'À payer : en retard, cette semaine, plus tard.', 'Qué pagar: vencido, esta semana, después.', 'O que pagar: atrasado, esta semana, depois.', 'Was zahlen: überfällig, diese Woche, später.') },
  { id: 'ratios', icon: 'chart', model: ratios, name: L('Financial ratios', 'Ratios financiers', 'Ratios financieros', 'Rácios financeiros', 'Finanzkennzahlen'), desc: L('Margin, ROE, ROA, liquidity, debt and working capital.', 'Marge, ROE, ROA, liquidité, endettement et fonds de roulement.', 'Margen, ROE, ROA, liquidez y deuda.', 'Margem, ROE, ROA, liquidez e dívida.', 'Marge, ROE, ROA, Liquidität, Verschuldung.') },
  { id: 'wc', icon: 'pull', model: wc, name: L('Working capital need', 'Besoin en fonds de roulement', 'Necesidades operativas de fondos', 'Necessidades de fundo de maneio', 'Working-Capital-Bedarf'), desc: L('Inventory + receivables − supplier debts, in days of sales.', 'Stocks + créances − dettes fournisseurs, en jours de CA.', 'Existencias + clientes − proveedores.', 'Inventários + clientes − fornecedores.', 'Vorräte + Forderungen − Lieferanten.') },
  { id: 'petty', icon: 'folder', model: petty, name: L('Petty cash book', 'Livre de caisse', 'Libro de caja', 'Livro de caixa', 'Kassenbuch'), desc: L('Cash in and out with the running balance.', 'Entrées et sorties avec le solde progressif.', 'Entradas y salidas con saldo.', 'Entradas e saídas com saldo.', 'Ein- und Ausgaben mit Saldo.') },
  { id: 'payroll', icon: 'user', model: payroll, name: L('Payroll', 'Paie (salaires)', 'Nómina', 'Processamento salarial', 'Lohnabrechnung'), desc: L('Gross, contributions, net and total cost per employee.', 'Brut, cotisations, net et coût total par salarié.', 'Bruto, cotizaciones, neto y coste.', 'Bruto, contribuições, líquido e custo.', 'Brutto, Beiträge, Netto und Kosten.') },
  { id: 'expense', icon: 'pen', model: expense, name: L('Expense report', 'Note de frais', 'Nota de gastos', 'Relatório de despesas', 'Spesenabrechnung'), desc: L('Expenses with the VAT you can reclaim.', 'Dépenses avec la TVA récupérable.', 'Gastos con el IVA deducible.', 'Despesas com o IVA dedutível.', 'Ausgaben mit Vorsteuer.') },
  { id: 'stock', icon: 'sheet', model: stock, name: L('Inventory and reorder', 'Stock et réapprovisionnement', 'Inventario y pedidos', 'Inventário e encomendas', 'Lager und Nachbestellung'), desc: L('Stock value, with a flag when an item must be ordered.', 'Valeur du stock, avec alerte quand il faut commander.', 'Valor del stock y aviso de pedido.', 'Valor do stock e alerta de encomenda.', 'Lagerwert mit Bestellhinweis.') },
  { id: 'cost', icon: 'fx', model: cost, name: L('Cost price', 'Coût de revient', 'Coste de producción', 'Custo de produção', 'Selbstkostenrechnung'), desc: L('Every cost of a product, and its cost per unit.', 'Tous les coûts d’un produit, et son coût unitaire.', 'Todos los costes y el coste unitario.', 'Todos os custos e o custo unitário.', 'Alle Kosten und Stückkosten.') },
  { id: 'pcg', icon: 'index', model: chart(PCG, SRC_PCG), name: L('Chart of accounts (French PCG)', 'Plan comptable général (PCG)', 'Plan contable francés (PCG)', 'Plano de contas francês (PCG)', 'Kontenrahmen Frankreich (PCG)'), desc: L('The main accounts of the French general chart.', 'Les comptes principaux du plan comptable général.', 'Las cuentas principales del PCG.', 'As contas principais do PCG.', 'Die Hauptkonten des PCG.') },
  { id: 'ohada', icon: 'index', model: chart(OHADA, SRC_OHADA), name: L('Chart of accounts (SYSCOHADA)', 'Plan comptable SYSCOHADA', 'Plan contable SYSCOHADA', 'Plano de contas SYSCOHADA', 'Kontenrahmen SYSCOHADA'), desc: L('The OHADA chart used in 17 African countries.', 'Le plan OHADA utilisé dans 17 pays d’Afrique.', 'El plan OHADA de 17 países africanos.', 'O plano OHADA de 17 países africanos.', 'Der OHADA-Kontenrahmen.') },
];
