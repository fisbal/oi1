// Finance models (Martin, 2026-10-31: an onglet with Finance, Économie, Comptabilité… "qui offre pour chaque des
// outils spécifiques"). Each one is a ready sheet with yellow inputs and real Excel formulas.

import { head, inp, note, out, type Model, type Row, type Tx } from './build';
import type { ProTool } from './tools';

const L = (en: string, fr: string, es: string, pt: string, de: string): Tx => [en, fr, es, pt, de];
const C = {
  amount: L('Amount', 'Montant', 'Importe', 'Valor', 'Betrag'),
  rate: L('Annual interest rate', 'Taux d’intérêt annuel', 'Tasa de interés anual', 'Taxa de juros anual', 'Jahreszins'),
  years: L('Years', 'Années', 'Años', 'Anos', 'Jahre'),
  year: L('Year', 'Année', 'Año', 'Ano', 'Jahr'),
  month: L('Month', 'Mois', 'Mes', 'Mês', 'Monat'),
  total: L('Total', 'Total', 'Total', 'Total', 'Summe'),
  payment: L('Payment', 'Mensualité', 'Cuota', 'Prestação', 'Rate'),
  interest: L('Interest', 'Intérêts', 'Intereses', 'Juros', 'Zinsen'),
  principal: L('Principal', 'Capital', 'Capital', 'Capital', 'Tilgung'),
  balance: L('Balance', 'Solde', 'Saldo', 'Saldo', 'Saldo'),
  income: L('Income', 'Revenus', 'Ingresos', 'Receitas', 'Einnahmen'),
  expenses: L('Expenses', 'Dépenses', 'Gastos', 'Despesas', 'Ausgaben'),
  change: L('Change the yellow cells: everything else is worked out by itself.', 'Changez les cellules jaunes : tout le reste se calcule tout seul.', 'Cambie las celdas amarillas: todo lo demás se calcula solo.', 'Altere as células amarelas: todo o resto é calculado sozinho.', 'Ändern Sie die gelben Zellen: alles andere rechnet sich selbst.'),
};
const months = (n: number, f: (i: number) => Row): Row[] => Array.from({ length: n }, (_, i) => f(i));

const loan: Model = {
  widths: [200, 140, 140, 140, 150, 40],
  freeze: 7,
  rows: [
    note(C.change),
    [L('Loan amount', 'Montant emprunté', 'Importe del préstamo', 'Valor do empréstimo', 'Darlehensbetrag'), inp(200000, 'money', 'p')],
    [C.rate, inp(0.04, 'pct', 'r')],
    [L('Years', 'Durée (années)', 'Años', 'Anos', 'Laufzeit (Jahre)'), inp(20, 'int', 'y')],
    [L('Monthly payment', 'Mensualité', 'Cuota mensual', 'Prestação mensal', 'Monatsrate'), out('=PMT($r/12,$y*12,-$p)', 'money', true, 'm')],
    [L('Total cost of credit', 'Coût total du crédit', 'Coste total del crédito', 'Custo total do crédito', 'Gesamtkosten des Kredits'), out('=$m*$y*12-$p', 'money', true)],
    head(L('No.', 'N°', 'N.º', 'N.º', 'Nr.'), C.payment, C.interest, C.principal, L('Remaining', 'Capital restant', 'Pendiente', 'Em dívida', 'Restschuld')),
    ...months(360, i => i === 0
      ? [1, out('=IF(A{r}>$y*12,"",$m)'), out('=IF(A{r}>$y*12,"",$p*$r/12)'), out('=IF(A{r}>$y*12,"",B{r}-C{r})'), out('=IF(A{r}>$y*12,"",$p-D{r})')]
      : [i + 1, out('=IF(A{r}>$y*12,"",$m)'), out('=IF(A{r}>$y*12,"",E{r-1}*$r/12)'), out('=IF(A{r}>$y*12,"",B{r}-C{r})'), out('=IF(A{r}>$y*12,"",E{r-1}-D{r})')]),
  ],
};

const compare: Model = {
  widths: [220, 140, 140, 140],
  rows: [
    note(C.change),
    head('', L('Offer A', 'Offre A', 'Oferta A', 'Oferta A', 'Angebot A'), L('Offer B', 'Offre B', 'Oferta B', 'Oferta B', 'Angebot B'), L('Offer C', 'Offre C', 'Oferta C', 'Oferta C', 'Angebot C')),
    [C.amount, inp(150000, 'money'), inp(150000, 'money'), inp(150000, 'money')],
    [C.rate, inp(0.035, 'pct'), inp(0.038, 'pct'), inp(0.032, 'pct')],
    [C.years, inp(20, 'int'), inp(25, 'int'), inp(20, 'int')],
    [L('Fees', 'Frais de dossier', 'Comisiones', 'Taxas', 'Gebühren'), inp(1000, 'money'), inp(0, 'money'), inp(2500, 'money')],
    [L('Monthly payment', 'Mensualité', 'Cuota mensual', 'Prestação mensal', 'Monatsrate'), out('=PMT(B6/12,B7*12,-B5)'), out('=PMT(C6/12,C7*12,-C5)'), out('=PMT(D6/12,D7*12,-D5)')],
    [L('Total cost', 'Coût total', 'Coste total', 'Custo total', 'Gesamtkosten'), out('=B9*B7*12-B5+B8', 'money', true), out('=C9*C7*12-C5+C8', 'money', true), out('=D9*D7*12-D5+D8', 'money', true)],
    [L('Cheapest', 'La moins chère', 'La más barata', 'A mais barata', 'Günstigstes'), out('=INDEX(B4:D4,MATCH(MIN(B10:D10),B10:D10,0))', 'text', true)],
  ],
};

const savings: Model = {
  rows: [
    note(C.change),
    [L('Starting amount', 'Capital de départ', 'Capital inicial', 'Capital inicial', 'Startkapital'), inp(5000, 'money', 's')],
    [L('Added each month', 'Versement mensuel', 'Aporte mensual', 'Depósito mensal', 'Monatliche Sparrate'), inp(200, 'money', 'a')],
    [L('Yearly return', 'Rendement annuel', 'Rentabilidad anual', 'Rendimento anual', 'Jährliche Rendite'), inp(0.05, 'pct', 'r')],
    head(C.year, L('Paid in', 'Versé', 'Aportado', 'Depositado', 'Eingezahlt'), L('Value', 'Valeur', 'Valor', 'Valor', 'Wert'), L('Gains', 'Gains', 'Ganancias', 'Ganhos', 'Erträge')),
    ...months(30, i => [i + 1, out(`=$s+$a*12*A{r}`), out(`=FV($r/12,A{r}*12,-$a,-$s)`), out('=C{r}-B{r}')]),
  ],
};

const npv: Model = {
  rows: [
    note(C.change),
    [L('Discount rate', 'Taux d’actualisation', 'Tasa de descuento', 'Taxa de desconto', 'Kalkulationszins'), inp(0.08, 'pct', 'r')],
    head(C.year, L('Cash flow', 'Flux de trésorerie', 'Flujo de caja', 'Fluxo de caixa', 'Zahlungsstrom'), L('Cumulative', 'Cumulé', 'Acumulado', 'Acumulado', 'Kumuliert')),
    [0, inp(-50000, 'money'), out('=B6')],
    ...months(10, i => [i + 1, inp([8000, 10000, 12000, 12000, 12000, 11000, 10000, 9000, 8000, 7000][i], 'money'), out('=C{r-1}+B{r}')]),
    [L('Net present value (NPV)', 'Valeur actuelle nette (VAN)', 'Valor actual neto (VAN)', 'Valor presente líquido (VPL)', 'Kapitalwert (NPV)'), out('=B6+NPV($r,B7:B16)', 'money', true)],
    [L('Internal rate of return (IRR)', 'Taux de rendement interne (TRI)', 'Tasa interna de retorno (TIR)', 'Taxa interna de retorno (TIR)', 'Interner Zinsfuß (IRR)'), out('=IRR(B6:B16)', 'pct', true)],
    [L('Payback (years)', 'Délai de récupération (années)', 'Plazo de recuperación (años)', 'Payback (anos)', 'Amortisationsdauer (Jahre)'), out('=IF(C16<0,"> 10",COUNTIF(C6:C16,"<0"))', 'int', true)],
  ],
};

const breakEven: Model = {
  rows: [
    note(C.change),
    [L('Fixed costs (per year)', 'Charges fixes (par an)', 'Costes fijos (al año)', 'Custos fixos (por ano)', 'Fixkosten (pro Jahr)'), inp(60000, 'money', 'fc')],
    [L('Selling price per unit', 'Prix de vente unitaire', 'Precio de venta unitario', 'Preço de venda unitário', 'Verkaufspreis je Stück'), inp(25, 'money', 'p')],
    [L('Variable cost per unit', 'Coût variable unitaire', 'Coste variable unitario', 'Custo variável unitário', 'Variable Kosten je Stück'), inp(15, 'money', 'v')],
    [L('Margin per unit', 'Marge unitaire', 'Margen unitario', 'Margem unitária', 'Deckungsbeitrag je Stück'), out('=$p-$v')],
    [L('Break-even (units)', 'Seuil de rentabilité (unités)', 'Punto muerto (unidades)', 'Ponto de equilíbrio (unidades)', 'Break-even (Stück)'), out('=$fc/($p-$v)', 'int', true, 'be')],
    [L('Break-even (sales)', 'Seuil de rentabilité (chiffre d’affaires)', 'Punto muerto (ventas)', 'Ponto de equilíbrio (vendas)', 'Break-even (Umsatz)'), out('=$be*$p', 'money', true)],
    head(L('Units sold', 'Unités vendues', 'Unidades vendidas', 'Unidades vendidas', 'Verkaufte Stück'), L('Sales', 'Chiffre d’affaires', 'Ventas', 'Vendas', 'Umsatz'), L('Costs', 'Coûts', 'Costes', 'Custos', 'Kosten'), L('Profit', 'Résultat', 'Beneficio', 'Lucro', 'Gewinn')),
    ...months(11, i => [i * 1000, out('=A{r}*$p'), out('=$fc+A{r}*$v'), out('=B{r}-C{r}')]),
  ],
};

const pricing: Model = {
  rows: [
    note(C.change),
    [L('Cost price', 'Prix de revient', 'Precio de coste', 'Preço de custo', 'Selbstkosten'), inp(40, 'money', 'c')],
    [L('Wanted margin (on price)', 'Marge souhaitée (sur le prix)', 'Margen deseado (sobre precio)', 'Margem desejada (sobre o preço)', 'Gewünschte Marge (vom Preis)'), inp(0.3, 'pct', 'm')],
    [L('VAT rate', 'Taux de TVA', 'Tipo de IVA', 'Taxa de IVA', 'MwSt.-Satz'), inp(0.2, 'pct', 'vat')],
    [L('Price before tax', 'Prix de vente HT', 'Precio sin IVA', 'Preço sem IVA', 'Nettopreis'), out('=$c/(1-$m)', 'money', true, 'ht')],
    [L('Price with tax', 'Prix de vente TTC', 'Precio con IVA', 'Preço com IVA', 'Bruttopreis'), out('=$ht*(1+$vat)', 'money', true)],
    [L('Markup (on cost)', 'Coefficient de marque (sur coût)', 'Recargo (sobre coste)', 'Markup (sobre o custo)', 'Aufschlag (auf Kosten)'), out('=$ht/$c-1', 'pct')],
    [L('Margin per unit', 'Marge par unité', 'Margen por unidad', 'Margem por unidade', 'Marge je Stück'), out('=$ht-$c')],
  ],
};

const budgetItems: Tx[] = [
  L('Rent / mortgage', 'Loyer / crédit immobilier', 'Alquiler / hipoteca', 'Renda / hipoteca', 'Miete / Kredit'),
  L('Food', 'Alimentation', 'Comida', 'Alimentação', 'Lebensmittel'),
  L('Transport', 'Transport', 'Transporte', 'Transporte', 'Transport'),
  L('Energy and water', 'Énergie et eau', 'Energía y agua', 'Energia e água', 'Energie und Wasser'),
  L('Phone and internet', 'Téléphone et internet', 'Teléfono e internet', 'Telefone e internet', 'Telefon und Internet'),
  L('Insurance', 'Assurances', 'Seguros', 'Seguros', 'Versicherungen'),
  L('Health', 'Santé', 'Salud', 'Saúde', 'Gesundheit'),
  L('Education', 'Éducation', 'Educación', 'Educação', 'Bildung'),
  L('Leisure', 'Loisirs', 'Ocio', 'Lazer', 'Freizeit'),
  L('Savings', 'Épargne', 'Ahorro', 'Poupança', 'Sparen'),
  L('Other', 'Divers', 'Otros', 'Outros', 'Sonstiges'),
];
const budget: Model = {
  rows: [
    note(C.change),
    head('', L('Planned', 'Prévu', 'Previsto', 'Previsto', 'Geplant'), L('Actual', 'Réel', 'Real', 'Real', 'Ist'), L('Difference', 'Écart', 'Diferencia', 'Diferença', 'Abweichung'), L('Share of income', 'Part du revenu', 'Parte del ingreso', 'Parte da receita', 'Anteil am Einkommen')),
    [{ v: C.income, bold: true }, inp(3000, 'money'), inp(3000, 'money'), out('=C5-B5')],
    ...budgetItems.map((n, i) => [n, inp([900, 450, 200, 120, 60, 90, 80, 100, 150, 300, 50][i], 'money'), inp(0, 'money'), out('=B{r}-C{r}'), out('=IF($C$5=0,"",C{r}/$C$5)', 'pct')] as Row),
    [{ v: C.expenses, total: true }, out('=SUM(B6:B16)', 'money', true), out('=SUM(C6:C16)', 'money', true), out('=B17-C17', 'money', true), out('=IF(C5=0,"",C17/C5)', 'pct', true)],
    [{ v: L('Left at month end', 'Reste à la fin du mois', 'Queda a fin de mes', 'Sobra no fim do mês', 'Rest am Monatsende'), total: true }, out('=B5-B17', 'money', true), out('=C5-C17', 'money', true)],
  ],
};

const MONTHS: Tx[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => L(m,
  ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'][i],
  ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i],
  ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i],
  ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][i]));
const cashflow: Model = {
  widths: [200, 120, 120, 120, 130],
  freeze: 3,
  rows: [
    note(C.change),
    [L('Cash at start', 'Trésorerie de départ', 'Caja inicial', 'Caixa inicial', 'Anfangsbestand'), inp(10000, 'money', 'start')],
    head(C.month, L('Cash in', 'Encaissements', 'Cobros', 'Recebimentos', 'Einzahlungen'), L('Cash out', 'Décaissements', 'Pagos', 'Pagamentos', 'Auszahlungen'), L('Net', 'Solde du mois', 'Neto', 'Líquido', 'Netto'), L('Cash at end', 'Trésorerie fin', 'Caja final', 'Caixa final', 'Endbestand')),
    ...MONTHS.map((m, i) => [m, inp(12000, 'money'), inp(11000, 'money'), out('=B{r}-C{r}'), out(i === 0 ? '=$start+D{r}' : '=E{r-1}+D{r}')] as Row),
    [{ v: C.total, total: true }, out('=SUM(B6:B17)', 'money', true), out('=SUM(C6:C17)', 'money', true), out('=SUM(D6:D17)', 'money', true), out('=E17', 'money', true)],
    [L('Lowest cash', 'Trésorerie la plus basse', 'Caja mínima', 'Caixa mínima', 'Tiefster Bestand'), null, null, null, out('=MIN(E6:E17)')],
  ],
};

const portfolio: Model = {
  rows: [
    note(C.change),
    head(L('Asset', 'Actif', 'Activo', 'Ativo', 'Anlage'), L('Amount', 'Montant', 'Importe', 'Valor', 'Betrag'), L('Weight', 'Poids', 'Peso', 'Peso', 'Gewicht'), L('Expected return', 'Rendement attendu', 'Rentabilidad esperada', 'Retorno esperado', 'Erwartete Rendite'), L('Risk (volatility)', 'Risque (volatilité)', 'Riesgo (volatilidad)', 'Risco (volatilidade)', 'Risiko (Volatilität)')),
    ...([[L('Stocks', 'Actions', 'Acciones', 'Ações', 'Aktien'), 20000, 0.07, 0.18], [L('Bonds', 'Obligations', 'Bonos', 'Obrigações', 'Anleihen'), 15000, 0.03, 0.06], [L('Real estate', 'Immobilier', 'Inmuebles', 'Imobiliário', 'Immobilien'), 10000, 0.05, 0.12], [L('Gold', 'Or', 'Oro', 'Ouro', 'Gold'), 3000, 0.02, 0.15], [L('Cash', 'Liquidités', 'Efectivo', 'Liquidez', 'Bargeld'), 2000, 0.01, 0.01]] as const)
      .map(([n, a, r, v]) => [inp(n as Tx), inp(a as number, 'money'), out('=B{r}/SUM($B$5:$B$9)', 'pct'), inp(r as number, 'pct'), inp(v as number, 'pct')] as Row),
    [{ v: C.total, total: true }, out('=SUM(B5:B9)', 'money', true), out('=SUM(C5:C9)', 'pct', true), out('=SUMPRODUCT(C5:C9,D5:D9)', 'pct', true), out('=SUMPRODUCT(C5:C9,E5:E9)', 'pct', true)],
    note(L('Risk shown is the weighted average (a careful upper bound: spreading lowers it further).', 'Le risque indiqué est la moyenne pondérée (une borne haute prudente : la diversification le réduit encore).', 'El riesgo es la media ponderada (un límite superior prudente: diversificar lo reduce más).', 'O risco é a média ponderada (um limite superior prudente: diversificar reduz ainda mais).', 'Das Risiko ist der gewichtete Mittelwert (eine vorsichtige Obergrenze: Streuung senkt es weiter).')),
  ],
};

const bond: Model = {
  rows: [
    note(C.change),
    [L('Face value', 'Valeur nominale', 'Valor nominal', 'Valor nominal', 'Nennwert'), inp(1000, 'money', 'fv')],
    [L('Coupon rate (yearly)', 'Taux du coupon (annuel)', 'Cupón (anual)', 'Taxa do cupão (anual)', 'Kupon (jährlich)'), inp(0.05, 'pct', 'c')],
    [L('Market yield', 'Rendement du marché', 'Rentabilidad de mercado', 'Rendimento de mercado', 'Marktrendite'), inp(0.04, 'pct', 'y')],
    [L('Years to maturity', 'Années jusqu’à l’échéance', 'Años al vencimiento', 'Anos até ao vencimento', 'Restlaufzeit (Jahre)'), inp(8, 'int', 'n')],
    [L('Price', 'Prix', 'Precio', 'Preço', 'Kurs'), out('=PV($y,$n,-$fv*$c,-$fv)', 'money', true, 'pr')],
    [L('Price (% of face)', 'Prix (% du nominal)', 'Precio (% del nominal)', 'Preço (% do nominal)', 'Kurs (% vom Nennwert)'), out('=$pr/$fv', 'pct')],
    [L('Current yield', 'Rendement courant', 'Rentabilidad corriente', 'Rendimento corrente', 'Laufende Rendite'), out('=$fv*$c/$pr', 'pct')],
  ],
};

const card: Model = {
  rows: [
    note(C.change),
    [L('Card balance', 'Solde de la carte', 'Saldo de la tarjeta', 'Saldo do cartão', 'Kartensaldo'), inp(5000, 'money', 'b')],
    [L('Yearly rate (APR)', 'Taux annuel (TAEG)', 'Tasa anual (TAE)', 'Taxa anual (TAEG)', 'Effektiver Jahreszins'), inp(0.19, 'pct', 'r')],
    [L('Monthly payment', 'Remboursement mensuel', 'Pago mensual', 'Pagamento mensal', 'Monatliche Zahlung'), inp(250, 'money', 'p')],
    [L('Months to pay off', 'Mois pour tout rembourser', 'Meses para liquidar', 'Meses para liquidar', 'Monate bis getilgt'), out('=IFERROR(ROUNDUP(NPER($r/12,-$p,$b),0),"∞")', 'int', true, 'n')],
    [L('Total interest paid', 'Total des intérêts payés', 'Intereses totales', 'Juros totais', 'Zinsen gesamt'), out('=IFERROR($p*NPER($r/12,-$p,$b)-$b,"")', 'money', true)],
    [L('Payment to clear in 24 months', 'Paiement pour solder en 24 mois', 'Pago para liquidar en 24 meses', 'Pagamento para liquidar em 24 meses', 'Rate für 24 Monate'), out('=PMT($r/12,24,-$b)')],
  ],
};

const retirement: Model = {
  rows: [
    note(C.change),
    [L('Age today', 'Âge actuel', 'Edad actual', 'Idade atual', 'Alter heute'), inp(35, 'int', 'a')],
    [L('Retirement age', 'Âge de la retraite', 'Edad de jubilación', 'Idade da reforma', 'Rentenalter'), inp(65, 'int', 'ra')],
    [L('Savings today', 'Épargne actuelle', 'Ahorro actual', 'Poupança atual', 'Ersparnisse heute'), inp(20000, 'money', 's')],
    [L('Saved each month', 'Épargne mensuelle', 'Ahorro mensual', 'Poupança mensal', 'Monatliche Sparrate'), inp(400, 'money', 'm')],
    [L('Yearly return', 'Rendement annuel', 'Rentabilidad anual', 'Rendimento anual', 'Jährliche Rendite'), inp(0.05, 'pct', 'r')],
    [L('Inflation', 'Inflation', 'Inflación', 'Inflação', 'Inflation'), inp(0.02, 'pct', 'i')],
    [L('Capital at retirement', 'Capital à la retraite', 'Capital al jubilarse', 'Capital na reforma', 'Kapital bei Rentenbeginn'), out('=FV($r/12,($ra-$a)*12,-$m,-$s)', 'money', true, 'k')],
    [L('In today’s money', 'En euros d’aujourd’hui', 'En dinero de hoy', 'Em dinheiro de hoje', 'In heutiger Kaufkraft'), out('=$k/(1+$i)^($ra-$a)', 'money', true)],
    [L('Monthly income for 25 years', 'Revenu mensuel sur 25 ans', 'Ingreso mensual 25 años', 'Rendimento mensal 25 anos', 'Monatliche Rente für 25 Jahre'), out('=PMT($r/12,25*12,-$k)', 'money', true)],
  ],
};

const depreciation: Model = {
  rows: [
    note(C.change),
    [L('Cost', 'Coût d’acquisition', 'Coste', 'Custo', 'Anschaffungskosten'), inp(30000, 'money', 'c')],
    [L('Salvage value', 'Valeur résiduelle', 'Valor residual', 'Valor residual', 'Restwert'), inp(3000, 'money', 's')],
    [L('Useful life (years)', 'Durée d’utilisation (années)', 'Vida útil (años)', 'Vida útil (anos)', 'Nutzungsdauer (Jahre)'), inp(5, 'int', 'n')],
    head(C.year, L('Straight line', 'Linéaire', 'Lineal', 'Linear', 'Linear'), L('Declining (double)', 'Dégressif (double)', 'Decreciente (doble)', 'Degressivo (duplo)', 'Degressiv (doppelt)'), L('Sum of years', 'Somme des années', 'Suma de dígitos', 'Soma dos dígitos', 'Digital')),
    ...months(10, i => [i + 1, out('=IF(A{r}>$n,"",SLN($c,$s,$n))'), out('=IF(A{r}>$n,"",DDB($c,$s,$n,A{r}))'), out('=IF(A{r}>$n,"",SYD($c,$s,$n,A{r}))')]),
    [{ v: C.total, total: true }, out('=SUM(B8:B17)', 'money', true), out('=SUM(C8:C17)', 'money', true), out('=SUM(D8:D17)', 'money', true)],
  ],
};

const CUR = ['USD', 'XAF', 'XOF', 'GBP', 'JPY', 'CNY', 'CAD', 'CHF', 'NGN', 'MAD', 'ZAR', 'CDF', 'INR', 'BRL', 'BTC'];
const currencies: Model = {
  widths: [200, 150, 150],
  rows: [
    note(L('Rates of the day for 300+ currencies, free (exchange-api). Change the amount, the currency, or a code.', 'Taux du jour pour plus de 300 devises, gratuits (exchange-api). Changez le montant, la devise ou un code.', 'Tipos del día para más de 300 monedas, gratis (exchange-api). Cambie el importe, la moneda o un código.', 'Taxas do dia para mais de 300 moedas, grátis (exchange-api). Altere o valor, a moeda ou um código.', 'Tageskurse für über 300 Währungen, kostenlos (exchange-api). Ändern Sie Betrag, Währung oder einen Code.')),
    [C.amount, inp(100, 'num', 'a')],
    [L('Currency', 'Devise', 'Moneda', 'Moeda', 'Währung'), inp('EUR', 'text', 'f')],
    head(L('Code', 'Code', 'Código', 'Código', 'Code'), L('Converted', 'Converti', 'Convertido', 'Convertido', 'Umgerechnet'), L('Rate', 'Taux', 'Tipo', 'Taxa', 'Kurs')),
    ...CUR.map(c => [inp(c, 'text'), out('=DEVISE($a,$f,A{r})', 'num'), out('=DEVISE(1,$f,A{r})', 'num')] as Row),
  ],
};

const travel: Model = {
  widths: [200, 120, 90, 150],
  rows: [
    note(L('Each expense in its own currency; the total in yours, with the rates of the day.', 'Chaque dépense dans sa devise ; le total dans la vôtre, aux taux du jour.', 'Cada gasto en su moneda; el total en la suya, al tipo del día.', 'Cada despesa na sua moeda; o total na sua, às taxas do dia.', 'Jede Ausgabe in ihrer Währung; die Summe in Ihrer, zum Tageskurs.')),
    [L('My currency', 'Ma devise', 'Mi moneda', 'A minha moeda', 'Meine Währung'), inp('EUR', 'text', 'my')],
    head(L('Expense', 'Dépense', 'Gasto', 'Despesa', 'Ausgabe'), C.amount, L('Currency', 'Devise', 'Moneda', 'Moeda', 'Währung'), L('In my currency', 'Dans ma devise', 'En mi moneda', 'Na minha moeda', 'In meiner Währung')),
    ...([[L('Flight', 'Vol', 'Vuelo', 'Voo', 'Flug'), 450, 'EUR'], [L('Hotel', 'Hôtel', 'Hotel', 'Hotel', 'Hotel'), 60000, 'XAF'], ['Taxi', 15000, 'XAF'], [L('Meals', 'Repas', 'Comidas', 'Refeições', 'Essen'), 40000, 'XAF'], ['Visa', 100, 'USD'], [L('Gifts', 'Cadeaux', 'Regalos', 'Presentes', 'Geschenke'), 80, 'GBP'], ['', '', 'EUR'], ['', '', 'EUR']] as const)
      .map(([n, a, c]) => [inp(n as Tx | string), inp(a as number | string, 'num'), inp(c as string, 'text'), out('=IF(B{r}="","",DEVISE(B{r},C{r},$my))', 'num')] as Row),
    [{ v: C.total, total: true }, null, null, out('=SUM(D6:D13)', 'num', true)],
  ],
};

const roi: Model = {
  rows: [
    note(C.change),
    [L('Amount invested', 'Montant investi', 'Importe invertido', 'Valor investido', 'Investierter Betrag'), inp(10000, 'money', 'i')],
    [L('Value today', 'Valeur aujourd’hui', 'Valor hoy', 'Valor hoje', 'Heutiger Wert'), inp(14500, 'money', 'v')],
    [L('Years held', 'Années de détention', 'Años', 'Anos', 'Haltedauer (Jahre)'), inp(4, 'num', 'y')],
    [L('Gain', 'Gain', 'Ganancia', 'Ganho', 'Gewinn'), out('=$v-$i')],
    [L('Return on investment (ROI)', 'Retour sur investissement (ROI)', 'Retorno de la inversión (ROI)', 'Retorno do investimento (ROI)', 'Kapitalrendite (ROI)'), out('=($v-$i)/$i', 'pct', true)],
    [L('Yearly return (CAGR)', 'Rendement annuel (TCAM)', 'Rentabilidad anual (TCAC)', 'Retorno anual (CAGR)', 'Jährliche Rendite (CAGR)'), out('=($v/$i)^(1/$y)-1', 'pct', true)],
    [L('Years to double at this pace', 'Années pour doubler à ce rythme', 'Años para duplicar', 'Anos para duplicar', 'Jahre bis zur Verdopplung'), out('=LN(2)/LN(1+($v/$i)^(1/$y)-1)', 'num')],
  ],
};

const forecast: Model = {
  rows: [
    note(L('Type your past monthly sales; the next 6 months follow the trend (TREND and FORECAST, like Excel).', 'Tapez vos ventes mensuelles passées ; les 6 mois suivants suivent la tendance (TENDANCE et PREVISION, comme Excel).', 'Escriba sus ventas mensuales; los 6 meses siguientes siguen la tendencia (TENDENCIA y PRONOSTICO).', 'Escreva as vendas mensais; os 6 meses seguintes seguem a tendência (TENDÊNCIA e PREVISÃO).', 'Tragen Sie Ihre Monatsumsätze ein; die nächsten 6 Monate folgen dem Trend (TREND und PROGNOSE).')),
    head(C.month, L('Sales', 'Ventes', 'Ventas', 'Vendas', 'Umsatz'), L('Forecast', 'Prévision', 'Previsión', 'Previsão', 'Prognose')),
    ...months(12, i => [i + 1, inp([120, 132, 128, 140, 151, 149, 160, 171, 168, 180, 190, 195][i], 'num'), null]),
    ...months(6, i => [i + 13, null, out('=FORECAST(A{r},$B$5:$B$16,$A$5:$A$16)', 'num')]),
    [L('Growth per month', 'Croissance par mois', 'Crecimiento por mes', 'Crescimento por mês', 'Wachstum pro Monat'), out('=SLOPE(B5:B16,A5:A16)', 'num', true)],
  ],
};

const discount: Model = {
  rows: [
    note(C.change),
    [L('Discount for early payment', 'Escompte pour paiement anticipé', 'Descuento por pronto pago', 'Desconto por pronto pagamento', 'Skonto'), inp(0.02, 'pct', 'd')],
    [L('Days to get the discount', 'Jours pour avoir l’escompte', 'Días para el descuento', 'Dias para o desconto', 'Skontofrist (Tage)'), inp(10, 'int', 'e')],
    [L('Days to pay without it', 'Jours pour payer sans', 'Días para pagar sin él', 'Dias para pagar sem', 'Zahlungsziel (Tage)'), inp(30, 'int', 'n')],
    [L('Yearly rate of not taking it', 'Taux annuel si on ne le prend pas', 'Tasa anual si no se toma', 'Taxa anual se não o usar', 'Jahreszins bei Verzicht'), out('=$d/(1-$d)*365/($n-$e)', 'pct', true, 'cost')],
    [L('Advice', 'Conseil', 'Consejo', 'Conselho', 'Empfehlung'), out(L('=IF($cost>0.1,"Take the discount","Pay at the due date")', '=IF($cost>0.1,"Prenez l’escompte","Payez à l’échéance")', '=IF($cost>0.1,"Tome el descuento","Pague al vencimiento")', '=IF($cost>0.1,"Aproveite o desconto","Pague no vencimento")', '=IF($cost>0.1,"Skonto nutzen","Zum Ziel zahlen")'), 'text', true)],
  ],
};

const capacity: Model = {
  rows: [
    note(C.change),
    [L('Net monthly income', 'Revenu net mensuel', 'Ingreso neto mensual', 'Rendimento líquido mensal', 'Monatliches Nettoeinkommen'), inp(3500, 'money', 'inc')],
    [L('Other monthly loans', 'Autres crédits mensuels', 'Otros préstamos mensuales', 'Outros créditos mensais', 'Andere Kreditraten'), inp(200, 'money', 'o')],
    [L('Maximum debt ratio', 'Taux d’endettement maximum', 'Tasa de endeudamiento máx.', 'Taxa de esforço máxima', 'Maximale Schuldenquote'), inp(0.35, 'pct', 'dr')],
    [C.rate, inp(0.037, 'pct', 'r')],
    [C.years, inp(25, 'int', 'y')],
    [L('Monthly payment you can afford', 'Mensualité possible', 'Cuota posible', 'Prestação possível', 'Mögliche Monatsrate'), out('=MAX(0,$inc*$dr-$o)', 'money', true, 'm')],
    [L('Amount you can borrow', 'Montant empruntable', 'Importe que puede pedir', 'Valor que pode pedir', 'Möglicher Kreditbetrag'), out('=PV($r/12,$y*12,-$m)', 'money', true)],
  ],
};

const dividend: Model = {
  rows: [
    note(C.change),
    [L('Share price', 'Cours de l’action', 'Precio de la acción', 'Preço da ação', 'Aktienkurs'), inp(50, 'money', 'p')],
    [L('Dividend per share (yearly)', 'Dividende par action (annuel)', 'Dividendo por acción (anual)', 'Dividendo por ação (anual)', 'Dividende je Aktie (jährlich)'), inp(2, 'money', 'd')],
    [L('Dividend growth per year', 'Croissance du dividende par an', 'Crecimiento del dividendo', 'Crescimento do dividendo', 'Dividendenwachstum p. a.'), inp(0.04, 'pct', 'g')],
    [L('Return you require', 'Rendement exigé', 'Rentabilidad exigida', 'Retorno exigido', 'Geforderte Rendite'), inp(0.08, 'pct', 'k')],
    [L('Dividend yield', 'Rendement du dividende', 'Rentabilidad por dividendo', 'Dividend yield', 'Dividendenrendite'), out('=$d/$p', 'pct')],
    [L('Fair value (Gordon model)', 'Valeur juste (modèle de Gordon)', 'Valor razonable (modelo de Gordon)', 'Valor justo (modelo de Gordon)', 'Fairer Wert (Gordon-Modell)'), out('=IF($k>$g,$d*(1+$g)/($k-$g),"")', 'money', true, 'fv')],
    [L('Upside', 'Potentiel', 'Potencial', 'Potencial', 'Potenzial'), out('=IFERROR($fv/$p-1,"")', 'pct', true)],
  ],
};

const lease: Model = {
  rows: [
    note(C.change),
    head('', L('Buy with a loan', 'Acheter à crédit', 'Comprar con préstamo', 'Comprar com crédito', 'Kauf mit Kredit'), L('Lease', 'Location (leasing)', 'Leasing', 'Leasing', 'Leasing')),
    [L('Price', 'Prix', 'Precio', 'Preço', 'Preis'), inp(25000, 'money'), null],
    [C.rate, inp(0.05, 'pct'), null],
    [L('Months', 'Mois', 'Meses', 'Meses', 'Monate'), inp(48, 'int'), inp(48, 'int')],
    [L('Monthly payment', 'Mensualité', 'Cuota', 'Prestação', 'Monatsrate'), out('=PMT(B6/12,B7,-B5)'), inp(390, 'money')],
    [L('Value at the end', 'Valeur à la fin', 'Valor al final', 'Valor no fim', 'Restwert am Ende'), inp(10000, 'money'), 0],
    [L('Real cost', 'Coût réel', 'Coste real', 'Custo real', 'Tatsächliche Kosten'), out('=B8*B7-B9', 'money', true), out('=C8*C7-C9', 'money', true)],
    [L('Cheaper', 'Le moins cher', 'Más barato', 'Mais barato', 'Günstiger'), out('=IF(B10<C10,B4,C4)', 'text', true)],
  ],
};

const doubling: Model = {
  rows: [
    note(C.change),
    head(L('Yearly rate', 'Taux annuel', 'Tasa anual', 'Taxa anual', 'Jahreszins'), L('Rule of 72', 'Règle de 72', 'Regla del 72', 'Regra dos 72', '72er-Regel'), L('Exact years', 'Années exactes', 'Años exactos', 'Anos exatos', 'Genaue Jahre')),
    ...[0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.1, 0.12, 0.15, 0.2].map(r => [inp(r, 'pct'), out('=72/(A{r}*100)', 'num'), out('=LN(2)/LN(1+A{r})', 'num')] as Row),
  ],
};

export const FINANCE: ProTool[] = [
  { id: 'loan', icon: 'currency', model: loan, name: L('Loan and repayment table', 'Prêt et tableau d’amortissement', 'Préstamo y cuadro de amortización', 'Empréstimo e plano de amortização', 'Kredit und Tilgungsplan'), desc: L('Monthly payment, total cost and every payment, month by month.', 'Mensualité, coût total et chaque échéance, mois par mois.', 'Cuota, coste total y cada pago, mes a mes.', 'Prestação, custo total e cada pagamento, mês a mês.', 'Monatsrate, Gesamtkosten und jede Rate, Monat für Monat.') },
  { id: 'compare', icon: 'swap', model: compare, name: L('Compare 3 loan offers', 'Comparer 3 offres de crédit', 'Comparar 3 ofertas de préstamo', 'Comparar 3 ofertas de crédito', '3 Kreditangebote vergleichen'), desc: L('Payments and total cost side by side; the cheapest is named.', 'Mensualités et coût total côte à côte ; la moins chère est indiquée.', 'Cuotas y coste total lado a lado; se indica la más barata.', 'Prestações e custo total lado a lado; a mais barata é indicada.', 'Raten und Gesamtkosten nebeneinander; das günstigste wird genannt.') },
  { id: 'capacity', icon: 'user', model: capacity, name: L('How much can I borrow?', 'Combien puis-je emprunter ?', '¿Cuánto puedo pedir?', 'Quanto posso pedir?', 'Wie viel kann ich leihen?'), desc: L('From your income and debt ratio to the loan you can get.', 'De vos revenus et taux d’endettement au montant empruntable.', 'De sus ingresos al préstamo posible.', 'Do seu rendimento ao crédito possível.', 'Vom Einkommen zum möglichen Kredit.') },
  { id: 'savings', icon: 'linechart', model: savings, name: L('Savings and compound interest', 'Épargne et intérêts composés', 'Ahorro e interés compuesto', 'Poupança e juros compostos', 'Sparen und Zinseszins'), desc: L('What your savings become over 30 years.', 'Ce que devient votre épargne sur 30 ans.', 'En qué se convierte su ahorro en 30 años.', 'No que se torna a sua poupança em 30 anos.', 'Was aus Ihrem Ersparten in 30 Jahren wird.') },
  { id: 'retirement', icon: 'heart', model: retirement, name: L('Retirement planner', 'Préparer sa retraite', 'Planificar la jubilación', 'Planear a reforma', 'Altersvorsorge planen'), desc: L('Capital at retirement, in today’s money, and the income it gives.', 'Capital à la retraite, en euros d’aujourd’hui, et le revenu qu’il donne.', 'Capital al jubilarse y el ingreso que da.', 'Capital na reforma e o rendimento que dá.', 'Kapital bei Rentenbeginn und die Rente daraus.') },
  { id: 'npv', icon: 'barchart', model: npv, name: L('Investment: NPV, IRR, payback', 'Investissement : VAN, TRI, délai de récupération', 'Inversión: VAN, TIR, recuperación', 'Investimento: VPL, TIR, payback', 'Investition: Kapitalwert, IRR, Amortisation'), desc: L('Is the project worth it? Net present value, internal rate of return, payback year.', 'Le projet vaut-il le coup ? VAN, TRI, année de récupération.', '¿Vale la pena? VAN, TIR y año de recuperación.', 'Vale a pena? VPL, TIR e ano de payback.', 'Lohnt es sich? Kapitalwert, IRR, Amortisationsjahr.') },
  { id: 'roi', icon: 'rocket', model: roi, name: L('Return on investment (ROI, CAGR)', 'Retour sur investissement (ROI, TCAM)', 'Retorno de la inversión (ROI, TCAC)', 'Retorno do investimento (ROI, CAGR)', 'Kapitalrendite (ROI, CAGR)'), desc: L('Gain, ROI and yearly return of an investment.', 'Gain, ROI et rendement annuel d’un placement.', 'Ganancia, ROI y rentabilidad anual.', 'Ganho, ROI e retorno anual.', 'Gewinn, ROI und Jahresrendite.') },
  { id: 'breakeven', icon: 'chart', model: breakEven, name: L('Break-even point', 'Seuil de rentabilité', 'Punto muerto', 'Ponto de equilíbrio', 'Break-even-Punkt'), desc: L('How much to sell to cover your costs, with a profit table.', 'Combien vendre pour couvrir vos charges, avec un tableau des résultats.', 'Cuánto vender para cubrir costes, con tabla de beneficios.', 'Quanto vender para cobrir custos, com tabela de lucros.', 'Wie viel verkaufen, um die Kosten zu decken, mit Gewinntabelle.') },
  { id: 'pricing', icon: 'percent', model: pricing, name: L('Selling price and margin', 'Prix de vente et marge', 'Precio de venta y margen', 'Preço de venda e margem', 'Verkaufspreis und Marge'), desc: L('From cost and wanted margin to price before and with tax.', 'Du coût et de la marge voulue au prix HT et TTC.', 'Del coste y margen al precio sin y con IVA.', 'Do custo e margem ao preço sem e com IVA.', 'Von Kosten und Marge zum Netto- und Bruttopreis.') },
  { id: 'budget', icon: 'sheet', model: budget, name: L('Monthly budget', 'Budget mensuel', 'Presupuesto mensual', 'Orçamento mensal', 'Monatsbudget'), desc: L('Planned against actual, by category, with what is left.', 'Prévu contre réel, par catégorie, avec ce qui reste.', 'Previsto frente a real, por categoría.', 'Previsto vs real, por categoria.', 'Geplant gegen Ist, je Kategorie.') },
  { id: 'cashflow', icon: 'areachart', model: cashflow, name: L('Cash flow over 12 months', 'Trésorerie sur 12 mois', 'Tesorería a 12 meses', 'Tesouraria a 12 meses', 'Liquiditätsplan 12 Monate'), desc: L('Cash in, cash out and cash at the end of each month.', 'Encaissements, décaissements et trésorerie de chaque fin de mois.', 'Cobros, pagos y caja de cada mes.', 'Recebimentos, pagamentos e caixa de cada mês.', 'Ein- und Auszahlungen und Bestand je Monat.') },
  { id: 'forecast', icon: 'linechart', model: forecast, name: L('Sales forecast', 'Prévision des ventes', 'Previsión de ventas', 'Previsão de vendas', 'Umsatzprognose'), desc: L('The next 6 months from the trend of the last 12.', 'Les 6 prochains mois à partir de la tendance des 12 derniers.', 'Los próximos 6 meses según la tendencia.', 'Os próximos 6 meses pela tendência.', 'Die nächsten 6 Monate aus dem Trend.') },
  { id: 'portfolio', icon: 'piechart', model: portfolio, name: L('Portfolio return and risk', 'Rendement et risque d’un portefeuille', 'Rentabilidad y riesgo de una cartera', 'Retorno e risco de uma carteira', 'Rendite und Risiko eines Depots'), desc: L('Weights, expected return and risk of what you own.', 'Poids, rendement attendu et risque de vos placements.', 'Pesos, rentabilidad y riesgo.', 'Pesos, retorno e risco.', 'Gewichte, Rendite und Risiko.') },
  { id: 'bond', icon: 'book', model: bond, name: L('Bond price and yield', 'Prix et rendement d’une obligation', 'Precio y rentabilidad de un bono', 'Preço e rendimento de uma obrigação', 'Anleihekurs und Rendite'), desc: L('What a bond is worth at today’s market yield.', 'Ce que vaut une obligation au rendement du marché.', 'Lo que vale un bono hoy.', 'Quanto vale uma obrigação hoje.', 'Was eine Anleihe heute wert ist.') },
  { id: 'dividend', icon: 'stacked', model: dividend, name: L('Share value from dividends', 'Valeur d’une action par les dividendes', 'Valor de una acción por dividendos', 'Valor de uma ação pelos dividendos', 'Aktienwert aus Dividenden'), desc: L('Dividend yield and fair value (Gordon growth model).', 'Rendement et valeur juste (modèle de Gordon).', 'Rentabilidad y valor razonable (Gordon).', 'Yield e valor justo (Gordon).', 'Rendite und fairer Wert (Gordon).') },
  { id: 'card', icon: 'shield', model: card, name: L('Pay off a credit card', 'Rembourser une carte de crédit', 'Liquidar una tarjeta', 'Liquidar um cartão de crédito', 'Kreditkarte abbezahlen'), desc: L('Months to clear it and the interest it costs.', 'Mois pour la solder et intérêts payés.', 'Meses para liquidarla e intereses.', 'Meses para liquidar e juros.', 'Monate bis getilgt und Zinskosten.') },
  { id: 'depreciation', icon: 'decless', model: depreciation, name: L('Depreciation: 3 methods', 'Amortissement : 3 méthodes', 'Amortización: 3 métodos', 'Amortização: 3 métodos', 'Abschreibung: 3 Methoden'), desc: L('Straight line, double declining and sum of years, year by year.', 'Linéaire, dégressif double et somme des années, année par année.', 'Lineal, decreciente doble y suma de dígitos.', 'Linear, degressivo duplo e soma dos dígitos.', 'Linear, doppelt degressiv und digital.') },
  { id: 'lease', icon: 'gov', model: lease, name: L('Buy or lease?', 'Acheter ou louer (leasing) ?', '¿Comprar o leasing?', 'Comprar ou leasing?', 'Kaufen oder leasen?'), desc: L('The real cost of each, and which is cheaper.', 'Le coût réel de chacun, et lequel est moins cher.', 'El coste real de cada uno.', 'O custo real de cada um.', 'Die echten Kosten von beiden.') },
  { id: 'discount', icon: 'decimal', model: discount, name: L('Early payment discount', 'Escompte pour paiement anticipé', 'Descuento por pronto pago', 'Desconto de pronto pagamento', 'Skonto lohnt sich?'), desc: L('The yearly rate behind "2% in 10 days, net 30".', 'Le taux annuel derrière « 2 % à 10 jours, net 30 ».', 'La tasa anual de "2 % a 10 días".', 'A taxa anual de "2% a 10 dias".', 'Der Jahreszins hinter „2 % Skonto“.') },
  { id: 'doubling', icon: 'grow', model: doubling, name: L('When does my money double?', 'Quand mon argent double-t-il ?', '¿Cuándo se duplica mi dinero?', 'Quando duplica o meu dinheiro?', 'Wann verdoppelt sich mein Geld?'), desc: L('Rule of 72 against the exact answer, for 12 rates.', 'Règle de 72 contre la réponse exacte, pour 12 taux.', 'Regla del 72 frente a la respuesta exacta.', 'Regra dos 72 vs resposta exata.', '72er-Regel gegen die genaue Antwort.') },
  { id: 'currencies', icon: 'currency', model: currencies, name: L('Currency table (rates of the day)', 'Tableau de devises (taux du jour)', 'Tabla de monedas (tipos del día)', 'Tabela de moedas (taxas do dia)', 'Währungstabelle (Tageskurse)'), desc: L('One amount in 15 currencies, with =DEVISE() formulas.', 'Un montant en 15 devises, avec des formules =DEVISE().', 'Un importe en 15 monedas, con =DEVISE().', 'Um valor em 15 moedas, com =DEVISE().', 'Ein Betrag in 15 Währungen, mit =DEVISE().') },
  { id: 'travel', icon: 'envelope', model: travel, name: L('Travel budget in many currencies', 'Budget de voyage multi-devises', 'Presupuesto de viaje multimoneda', 'Orçamento de viagem multimoeda', 'Reisebudget in mehreren Währungen'), desc: L('Each expense in its currency, the total in yours.', 'Chaque dépense dans sa devise, le total dans la vôtre.', 'Cada gasto en su moneda, el total en la suya.', 'Cada despesa na sua moeda, o total na sua.', 'Jede Ausgabe in ihrer Währung, die Summe in Ihrer.') },
];
