// Economics models (Martin, 2026-10-31: "Finance, économie, comptabilité… des outils spécifiques"): inflation, GDP,
// elasticity, equilibrium, price index, Gini, debt ratio, cost-benefit, regression… Real formulas, yellow inputs.
// Row numbers in formulas: the title is row 1, model row i is row i + 3 (a note at row 3, headers at row 4…).

import { head, inp, note, out, type Model, type Row, type Tx } from './build';
import type { ProTool } from './tools';

const L = (en: string, fr: string, es: string, pt: string, de: string): Tx => [en, fr, es, pt, de];
const C = {
  year: L('Year', 'Année', 'Año', 'Ano', 'Jahr'),
  month: L('Month', 'Mois', 'Mes', 'Mês', 'Monat'),
  value: L('Value', 'Valeur', 'Valor', 'Valor', 'Wert'),
  growth: L('Growth', 'Croissance', 'Crecimiento', 'Crescimento', 'Wachstum'),
  price: L('Price', 'Prix', 'Precio', 'Preço', 'Preis'),
  quantity: L('Quantity', 'Quantité', 'Cantidad', 'Quantidade', 'Menge'),
  total: L('Total', 'Total', 'Total', 'Total', 'Summe'),
  change: L('Change the yellow cells: everything else is worked out by itself.', 'Changez les cellules jaunes : tout le reste se calcule tout seul.', 'Cambie las celdas amarillas: todo lo demás se calcula solo.', 'Altere as células amarelas: todo o resto é calculado sozinho.', 'Ändern Sie die gelben Zellen: alles andere rechnet sich selbst.'),
};
const rows = (n: number, f: (i: number) => Row): Row[] => Array.from({ length: n }, (_, i) => f(i));
const verdict = (cond: string, yes: Tx, no: Tx): Tx => yes.map((y, i) => `=IF(${cond},"${y}","${no[i]}")`) as unknown as Tx;

const inflation: Model = {
  rows: [
    note(C.change),
    [L('Amount today', 'Montant aujourd’hui', 'Importe hoy', 'Valor hoje', 'Betrag heute'), inp(1000, 'money', 'a')],
    [L('Yearly inflation', 'Inflation annuelle', 'Inflación anual', 'Inflação anual', 'Jährliche Inflation'), inp(0.03, 'pct', 'i')],
    head(C.year, L('What it buys (today’s money)', 'Pouvoir d’achat (valeur d’aujourd’hui)', 'Poder adquisitivo', 'Poder de compra', 'Kaufkraft (heutiger Wert)'), L('Same basket costs', 'Le même panier coûte', 'La misma cesta cuesta', 'O mesmo cabaz custa', 'Derselbe Warenkorb kostet'), L('Loss', 'Perte', 'Pérdida', 'Perda', 'Verlust')),
    ...rows(30, i => [i + 1, out('=$a/(1+$i)^A{r}'), out('=$a*(1+$i)^A{r}'), out('=1-B{r}/$a', 'pct')]),
  ],
};

const gdp: Model = {
  rows: [
    note(L('Type GDP for each year (any currency, billions).', 'Tapez le PIB de chaque année (toute devise, en milliards).', 'Escriba el PIB de cada año (miles de millones).', 'Escreva o PIB de cada ano (mil milhões).', 'BIP je Jahr eintragen (Milliarden).')),
    head(C.year, L('GDP', 'PIB', 'PIB', 'PIB', 'BIP'), C.growth, L('Index (first year = 100)', 'Indice (1re année = 100)', 'Índice (1.er año = 100)', 'Índice (1.º ano = 100)', 'Index (1. Jahr = 100)')),
    [2015, inp(2200, 'num'), null, out('=B5/$B$5*100', 'num')],
    ...rows(9, i => [2016 + i, inp([2240, 2290, 2340, 2380, 2200, 2350, 2410, 2430, 2460][i], 'num'), out('=B{r}/B{r-1}-1', 'pct'), out('=B{r}/$B$5*100', 'num')]),
    [L('Average yearly growth (CAGR)', 'Croissance annuelle moyenne (TCAM)', 'Crecimiento anual medio (TCAC)', 'Crescimento anual médio (CAGR)', 'Durchschnittliches Wachstum (CAGR)'), out('=(B14/B5)^(1/(A14-A5))-1', 'pct', true)],
    [L('Best year', 'Meilleure année', 'Mejor año', 'Melhor ano', 'Bestes Jahr'), out('=INDEX(A6:A14,MATCH(MAX(C6:C14),C6:C14,0))', 'int', true)],
    [L('Worst year', 'Pire année', 'Peor año', 'Pior ano', 'Schlechtestes Jahr'), out('=INDEX(A6:A14,MATCH(MIN(C6:C14),C6:C14,0))', 'int', true)],
  ],
};

const elasticity: Model = {
  rows: [
    note(L('Price elasticity of demand (midpoint method).', 'Élasticité-prix de la demande (méthode du point milieu).', 'Elasticidad precio de la demanda (punto medio).', 'Elasticidade-preço da procura (ponto médio).', 'Preiselastizität der Nachfrage (Mittelpunktmethode).')),
    head('', C.price, C.quantity),
    [L('Before', 'Avant', 'Antes', 'Antes', 'Vorher'), inp(10, 'money'), inp(1000, 'int')],
    [L('After', 'Après', 'Después', 'Depois', 'Nachher'), inp(12, 'money'), inp(850, 'int')],
    [L('Price change', 'Variation du prix', 'Variación del precio', 'Variação do preço', 'Preisänderung'), out('=(B6-B5)/((B6+B5)/2)', 'pct')],
    [L('Quantity change', 'Variation de la quantité', 'Variación de la cantidad', 'Variação da quantidade', 'Mengenänderung'), out('=(C6-C5)/((C6+C5)/2)', 'pct')],
    [L('Elasticity', 'Élasticité', 'Elasticidad', 'Elasticidade', 'Elastizität'), out('=B8/B7', 'num', true, 'e')],
    [L('Meaning', 'Interprétation', 'Interpretación', 'Interpretação', 'Bedeutung'), out(verdict('ABS($e)>1', L('Elastic: buyers react strongly', 'Élastique : les acheteurs réagissent fort', 'Elástica: los compradores reaccionan mucho', 'Elástica: os compradores reagem muito', 'Elastisch: Käufer reagieren stark'), L('Inelastic: buyers react little', 'Inélastique : les acheteurs réagissent peu', 'Inelástica: reaccionan poco', 'Inelástica: reagem pouco', 'Unelastisch: Käufer reagieren wenig')), 'text', true)],
    [L('Revenue before / after', 'Recette avant / après', 'Ingreso antes / después', 'Receita antes / depois', 'Umsatz vorher / nachher'), out('=B5*C5'), out('=B6*C6')],
  ],
};

const equilibrium: Model = {
  widths: [240, 130, 130, 130, 130],
  rows: [
    note(L('Demand Qd = a − b·P and supply Qs = c + d·P: where they meet.', 'Demande Qd = a − b·P et offre Qs = c + d·P : leur point de rencontre.', 'Demanda Qd = a − b·P y oferta Qs = c + d·P: el equilibrio.', 'Procura Qd = a − b·P e oferta Qs = c + d·P: o equilíbrio.', 'Nachfrage Qd = a − b·P, Angebot Qs = c + d·P: das Gleichgewicht.')),
    [L('Demand: a', 'Demande : a', 'Demanda: a', 'Procura: a', 'Nachfrage: a'), inp(1000, 'num', 'a')],
    [L('Demand: b', 'Demande : b', 'Demanda: b', 'Procura: b', 'Nachfrage: b'), inp(20, 'num', 'b')],
    [L('Supply: c', 'Offre : c', 'Oferta: c', 'Oferta: c', 'Angebot: c'), inp(100, 'num', 'c')],
    [L('Supply: d', 'Offre : d', 'Oferta: d', 'Oferta: d', 'Angebot: d'), inp(25, 'num', 'd')],
    [L('Equilibrium price', 'Prix d’équilibre', 'Precio de equilibrio', 'Preço de equilíbrio', 'Gleichgewichtspreis'), out('=($a-$c)/($b+$d)', 'money', true, 'p')],
    [L('Equilibrium quantity', 'Quantité d’équilibre', 'Cantidad de equilibrio', 'Quantidade de equilíbrio', 'Gleichgewichtsmenge'), out('=$a-$b*$p', 'num', true)],
    head(C.price, L('Demand', 'Demande', 'Demanda', 'Procura', 'Nachfrage'), L('Supply', 'Offre', 'Oferta', 'Oferta', 'Angebot'), L('Shortage (+) / surplus (−)', 'Pénurie (+) / excédent (−)', 'Escasez (+) / excedente (−)', 'Escassez (+) / excedente (−)', 'Mangel (+) / Überschuss (−)')),
    ...rows(16, i => [i * 4, out('=MAX(0,$a-$b*A{r})', 'num'), out('=MAX(0,$c+$d*A{r})', 'num'), out('=B{r}-C{r}', 'num')]),
  ],
};

const basket: [Tx, number, number, number][] = [
  [L('Bread', 'Pain', 'Pan', 'Pão', 'Brot'), 30, 1.1, 1.2], [L('Rice (kg)', 'Riz (kg)', 'Arroz (kg)', 'Arroz (kg)', 'Reis (kg)'), 8, 2, 2.3],
  [L('Milk (l)', 'Lait (l)', 'Leche (l)', 'Leite (l)', 'Milch (l)'), 20, 0.9, 1.05], [L('Fuel (l)', 'Carburant (l)', 'Combustible (l)', 'Combustível (l)', 'Treibstoff (l)'), 60, 1.7, 1.85],
  [L('Electricity (kWh)', 'Électricité (kWh)', 'Electricidad (kWh)', 'Eletricidade (kWh)', 'Strom (kWh)'), 250, 0.2, 0.25], [L('Rent', 'Loyer', 'Alquiler', 'Renda', 'Miete'), 1, 700, 730],
  [L('Phone plan', 'Forfait téléphone', 'Tarifa móvil', 'Tarifário', 'Handyvertrag'), 1, 20, 20], [L('Bus pass', 'Abonnement bus', 'Abono transporte', 'Passe transporte', 'Monatskarte'), 1, 50, 55],
];
const cpi: Model = {
  widths: [200, 100, 120, 120, 120, 120],
  rows: [
    note(L('A shopping basket priced in two years: the Laspeyres price index, like statistics offices.', 'Un panier de courses à deux dates : l’indice des prix de Laspeyres, comme l’INSEE.', 'Una cesta en dos años: índice de Laspeyres, como el INE.', 'Um cabaz em dois anos: índice de Laspeyres, como o INE.', 'Ein Warenkorb in zwei Jahren: Laspeyres-Preisindex wie Destatis.')),
    head(L('Item', 'Article', 'Artículo', 'Artigo', 'Artikel'), C.quantity, L('Price year 0', 'Prix année 0', 'Precio año 0', 'Preço ano 0', 'Preis Jahr 0'), L('Price year 1', 'Prix année 1', 'Precio año 1', 'Preço ano 1', 'Preis Jahr 1'), L('Cost year 0', 'Coût année 0', 'Coste año 0', 'Custo ano 0', 'Kosten Jahr 0'), L('Cost year 1', 'Coût année 1', 'Coste año 1', 'Custo ano 1', 'Kosten Jahr 1')),
    ...basket.map(([n, q, p0, p1]) => [inp(n), inp(q, 'num'), inp(p0, 'money'), inp(p1, 'money'), out('=B{r}*C{r}'), out('=B{r}*D{r}')] as Row),
    [{ v: C.total, total: true }, null, null, null, out('=SUM(E5:E12)', 'money', true), out('=SUM(F5:F12)', 'money', true)],
    [L('Price index (year 0 = 100)', 'Indice des prix (année 0 = 100)', 'Índice de precios (año 0 = 100)', 'Índice de preços (ano 0 = 100)', 'Preisindex (Jahr 0 = 100)'), out('=F13/E13*100', 'num', true)],
    [L('Inflation', 'Inflation', 'Inflación', 'Inflação', 'Inflation'), out('=F13/E13-1', 'pct', true)],
  ],
};

const labour: Model = {
  rows: [
    note(C.change),
    [L('Working-age population', 'Population en âge de travailler', 'Población en edad de trabajar', 'População em idade ativa', 'Bevölkerung im Erwerbsalter'), inp(42000000, 'int', 'pop')],
    [L('Employed', 'Actifs occupés', 'Ocupados', 'Empregados', 'Erwerbstätige'), inp(28500000, 'int', 'emp')],
    [L('Unemployed (looking for work)', 'Chômeurs (en recherche)', 'Parados', 'Desempregados', 'Arbeitslose'), inp(2300000, 'int', 'un')],
    [L('Labour force', 'Population active', 'Población activa', 'População ativa', 'Erwerbspersonen'), out('=$emp+$un', 'int', true, 'lf')],
    [L('Unemployment rate', 'Taux de chômage', 'Tasa de paro', 'Taxa de desemprego', 'Arbeitslosenquote'), out('=$un/$lf', 'pct', true)],
    [L('Activity rate', 'Taux d’activité', 'Tasa de actividad', 'Taxa de atividade', 'Erwerbsquote'), out('=$lf/$pop', 'pct', true)],
    [L('Employment rate', 'Taux d’emploi', 'Tasa de empleo', 'Taxa de emprego', 'Erwerbstätigenquote'), out('=$emp/$pop', 'pct', true)],
    [L('Inactive', 'Inactifs', 'Inactivos', 'Inativos', 'Nichterwerbspersonen'), out('=$pop-$lf', 'int')],
  ],
};

const ppp: Model = {
  widths: [260, 140, 140],
  rows: [
    note(L('The same product in two countries tells whether a currency is over- or under-valued (like the Big Mac index).', 'Le même produit dans deux pays dit si une monnaie est sur- ou sous-évaluée (comme l’indice Big Mac).', 'El mismo producto en dos países indica si una moneda está sobre o infravalorada (índice Big Mac).', 'O mesmo produto em dois países indica se a moeda está sobre ou subvalorizada (índice Big Mac).', 'Dasselbe Produkt in zwei Ländern zeigt Über- oder Unterbewertung (Big-Mac-Index).')),
    head('', L('Home country', 'Pays de référence', 'País de referencia', 'País de referência', 'Referenzland'), L('Other country', 'Autre pays', 'Otro país', 'Outro país', 'Anderes Land')),
    [L('Currency', 'Devise', 'Moneda', 'Moeda', 'Währung'), inp('USD', 'text', 'c1'), inp('XAF', 'text', 'c2')],
    [L('Price of the product', 'Prix du produit', 'Precio del producto', 'Preço do produto', 'Preis des Produkts'), inp(5.7, 'money', 'p1'), inp(2500, 'num', 'p2')],
    [L('Market exchange rate (1 home = …)', 'Taux de change du marché (1 référence = …)', 'Tipo de cambio de mercado', 'Taxa de câmbio de mercado', 'Marktkurs (1 Referenz = …)'), null, inp(600, 'num', 'fx')],
    [L('Implied rate (PPP)', 'Taux implicite (PPA)', 'Tipo implícito (PPA)', 'Taxa implícita (PPC)', 'Implizierter Kurs (KKP)'), null, out('=$p2/$p1', 'num', true, 'ip')],
    [L('Other currency valuation', 'Valorisation de l’autre devise', 'Valoración de la otra moneda', 'Valorização da outra moeda', 'Bewertung der anderen Währung'), null, out('=$ip/$fx-1', 'pct', true, 'val')],
    [L('Meaning', 'Interprétation', 'Interpretación', 'Interpretação', 'Bedeutung'), null, out(verdict('$val<0', L('Under-valued', 'Sous-évaluée', 'Infravalorada', 'Subvalorizada', 'Unterbewertet'), L('Over-valued', 'Surévaluée', 'Sobrevalorada', 'Sobrevalorizada', 'Überbewertet')), 'text', true)],
  ],
};

const fisher: Model = {
  rows: [
    note(L('Fisher equation: what a rate really earns after inflation.', 'Équation de Fisher : ce qu’un taux rapporte vraiment après inflation.', 'Ecuación de Fisher: lo que rinde un tipo tras la inflación.', 'Equação de Fisher: o que uma taxa rende após a inflação.', 'Fisher-Gleichung: realer Zins nach Inflation.')),
    head(L('Nominal rate', 'Taux nominal', 'Tipo nominal', 'Taxa nominal', 'Nominalzins'), L('Inflation', 'Inflation', 'Inflación', 'Inflação', 'Inflation'), L('Real rate (exact)', 'Taux réel (exact)', 'Tipo real (exacto)', 'Taxa real (exata)', 'Realzins (genau)'), L('Real rate (quick)', 'Taux réel (approché)', 'Tipo real (aprox.)', 'Taxa real (aprox.)', 'Realzins (Näherung)')),
    ...[[0.03, 0.02], [0.05, 0.03], [0.04, 0.06], [0.1, 0.08], [0.02, 0.01], [0.06, 0.02], [0.08, 0.1], [0.12, 0.05]].map(([n, i]) => [inp(n, 'pct'), inp(i, 'pct'), out('=(1+A{r})/(1+B{r})-1', 'pct'), out('=A{r}-B{r}', 'pct')] as Row),
  ],
};

const multiplier: Model = {
  rows: [
    note(L('Keynesian multiplier: how much one more unit of spending raises income.', 'Multiplicateur keynésien : de combien une dépense de plus augmente le revenu.', 'Multiplicador keynesiano.', 'Multiplicador keynesiano.', 'Keynes-Multiplikator.')),
    [L('Marginal propensity to consume', 'Propension marginale à consommer', 'Propensión marginal a consumir', 'Propensão marginal a consumir', 'Marginale Konsumquote'), inp(0.8, 'pct', 'c')],
    [L('Tax rate', 'Taux d’imposition', 'Tipo impositivo', 'Taxa de imposto', 'Steuersatz'), inp(0.2, 'pct', 't')],
    [L('Import share', 'Part des importations', 'Propensión a importar', 'Propensão a importar', 'Importquote'), inp(0.1, 'pct', 'm')],
    [L('New spending', 'Dépense nouvelle', 'Gasto nuevo', 'Despesa nova', 'Neue Ausgaben'), inp(1000000, 'money', 'g')],
    [L('Simple multiplier', 'Multiplicateur simple', 'Multiplicador simple', 'Multiplicador simples', 'Einfacher Multiplikator'), out('=1/(1-$c)', 'num', true)],
    [L('Open economy multiplier', 'Multiplicateur en économie ouverte', 'Multiplicador en economía abierta', 'Multiplicador em economia aberta', 'Multiplikator offene Volkswirtschaft'), out('=1/(1-$c*(1-$t)+$m)', 'num', true, 'k')],
    [L('Rise in income', 'Hausse du revenu', 'Aumento de la renta', 'Aumento do rendimento', 'Einkommensanstieg'), out('=$g*$k', 'money', true)],
  ],
};

const population: Model = {
  rows: [
    note(C.change),
    [L('Population today', 'Population aujourd’hui', 'Población hoy', 'População hoje', 'Bevölkerung heute'), inp(28000000, 'int', 'p')],
    [L('Yearly growth', 'Croissance annuelle', 'Crecimiento anual', 'Crescimento anual', 'Jährliches Wachstum'), inp(0.025, 'pct', 'g')],
    [L('Doubles in (years)', 'Double en (années)', 'Se duplica en (años)', 'Duplica em (anos)', 'Verdopplung in (Jahren)'), out('=LN(2)/LN(1+$g)', 'num', true)],
    head(C.year, L('Population', 'Population', 'Población', 'População', 'Bevölkerung'), L('Added that year', 'Ajout de l’année', 'Aumento del año', 'Aumento do ano', 'Zuwachs im Jahr')),
    ...rows(30, i => [i + 1, out('=$p*(1+$g)^A{r}', 'int'), out('=B{r}-$p*(1+$g)^(A{r}-1)', 'int')]),
  ],
};

const perCapita: Model = {
  rows: [
    note(L('GDP per person, in your currency and in dollars (rates of the day).', 'PIB par habitant, dans votre devise et en dollars (taux du jour).', 'PIB per cápita, en su moneda y en dólares.', 'PIB per capita, na sua moeda e em dólares.', 'BIP pro Kopf, in Ihrer Währung und in Dollar.')),
    [L('GDP', 'PIB', 'PIB', 'PIB', 'BIP'), inp(30000000000000, 'int', 'y')],
    [L('Currency', 'Devise', 'Moneda', 'Moeda', 'Währung'), inp('XAF', 'text', 'cur')],
    [L('Population', 'Population', 'Población', 'População', 'Bevölkerung'), inp(28000000, 'int', 'pop')],
    [L('GDP per person', 'PIB par habitant', 'PIB per cápita', 'PIB per capita', 'BIP pro Kopf'), out('=$y/$pop', 'num', true, 'pc')],
    [L('In US dollars', 'En dollars US', 'En dólares', 'Em dólares', 'In US-Dollar'), out('=IFERROR(DEVISE($pc,$cur,"USD"),"…")', 'money', true)],
    [L('Per day', 'Par jour', 'Por día', 'Por dia', 'Pro Tag'), out('=$pc/365', 'num')],
  ],
};

const gini: Model = {
  widths: [200, 150, 150, 150],
  rows: [
    note(L('Share of national income earned by each fifth of people, poorest first: the Gini index (0 = equal, 100 = one person has all).', 'Part du revenu national de chaque cinquième de la population, des plus pauvres aux plus riches : l’indice de Gini (0 = égalité, 100 = une personne a tout).', 'Parte de la renta de cada quintil: índice de Gini.', 'Parte do rendimento de cada quintil: índice de Gini.', 'Einkommensanteil je Fünftel: Gini-Index.')),
    head(L('Fifth of people', 'Cinquième de la population', 'Quintil', 'Quintil', 'Fünftel'), L('Share of income', 'Part du revenu', 'Parte de la renta', 'Parte do rendimento', 'Einkommensanteil'), L('Cumulative', 'Cumulé', 'Acumulado', 'Acumulado', 'Kumuliert'), L('Area', 'Aire', 'Área', 'Área', 'Fläche')),
    [1, inp(0.06, 'pct'), out('=B5', 'pct'), out('=0.2*C5/2', 'num')],
    ...rows(4, i => [i + 2, inp([0.11, 0.16, 0.22, 0.45][i], 'pct'), out('=C{r-1}+B{r}', 'pct'), out('=0.2*(C{r-1}+C{r})/2', 'num')]),
    [{ v: C.total, total: true }, out('=SUM(B5:B9)', 'pct', true), null, out('=SUM(D5:D9)', 'num', true)],
    [L('Gini index', 'Indice de Gini', 'Índice de Gini', 'Índice de Gini', 'Gini-Index'), out('=(1-2*D10)*100', 'num', true)],
    [L('Richest fifth / poorest fifth', '20 % les plus riches / 20 % les plus pauvres', 'Quintil rico / pobre', 'Quintil rico / pobre', 'Reichstes / ärmstes Fünftel'), out('=B9/B5', 'num', true)],
  ],
};

const trade: Model = {
  rows: [
    note(C.change),
    head(C.year, L('Exports', 'Exportations', 'Exportaciones', 'Exportações', 'Exporte'), L('Imports', 'Importations', 'Importaciones', 'Importações', 'Importe'), L('Trade balance', 'Balance commerciale', 'Balanza comercial', 'Balança comercial', 'Handelsbilanz'), L('Coverage rate', 'Taux de couverture', 'Tasa de cobertura', 'Taxa de cobertura', 'Deckungsquote')),
    ...rows(10, i => [2016 + i, inp([450, 470, 480, 500, 420, 510, 560, 580, 590, 610][i], 'num'), inp([500, 510, 530, 540, 460, 540, 620, 610, 600, 620][i], 'num'), out('=B{r}-C{r}', 'num'), out('=B{r}/C{r}', 'pct')]),
    [{ v: C.total, total: true }, out('=SUM(B5:B14)', 'num', true), out('=SUM(C5:C14)', 'num', true), out('=B15-C15', 'num', true), out('=B15/C15', 'pct', true)],
  ],
};

const debt: Model = {
  widths: [120, 130, 130, 130, 130],
  rows: [
    note(L('Public debt over 10 years: deficit, growth and inflation decide where the debt ratio goes.', 'Dette publique sur 10 ans : déficit, croissance et inflation décident de l’évolution du ratio dette/PIB.', 'Deuda pública a 10 años.', 'Dívida pública a 10 anos.', 'Staatsschulden über 10 Jahre.')),
    [L('Debt today', 'Dette aujourd’hui', 'Deuda hoy', 'Dívida hoje', 'Schulden heute'), inp(3000, 'num', 'd')],
    [L('GDP today', 'PIB aujourd’hui', 'PIB hoy', 'PIB hoje', 'BIP heute'), inp(2800, 'num', 'y')],
    [L('Deficit (% of GDP)', 'Déficit (% du PIB)', 'Déficit (% del PIB)', 'Défice (% do PIB)', 'Defizit (% des BIP)'), inp(0.045, 'pct', 'def')],
    [L('Nominal GDP growth', 'Croissance nominale du PIB', 'Crecimiento nominal', 'Crescimento nominal', 'Nominales Wachstum'), inp(0.03, 'pct', 'g')],
    head(C.year, L('GDP', 'PIB', 'PIB', 'PIB', 'BIP'), L('Deficit', 'Déficit', 'Déficit', 'Défice', 'Defizit'), L('Debt', 'Dette', 'Deuda', 'Dívida', 'Schulden'), L('Debt / GDP', 'Dette / PIB', 'Deuda / PIB', 'Dívida / PIB', 'Schulden / BIP')),
    [0, out('=$y', 'num'), null, out('=$d', 'num'), out('=D9/B9', 'pct')],
    ...rows(10, i => [i + 1, out('=B{r-1}*(1+$g)', 'num'), out('=B{r}*$def', 'num'), out('=D{r-1}+C{r}', 'num'), out('=D{r}/B{r}', 'pct')]),
    [L('Deficit that keeps the ratio stable', 'Déficit qui stabilise le ratio', 'Déficit que estabiliza la ratio', 'Défice que estabiliza o rácio', 'Defizit für stabile Quote'), out('=$d/$y*$g/(1+$g)', 'pct', true)],
  ],
};

const costBenefit: Model = {
  widths: [120, 130, 130, 130, 130],
  rows: [
    note(L('Cost-benefit analysis of a public project, discounted.', 'Analyse coûts-bénéfices d’un projet public, actualisée.', 'Análisis coste-beneficio actualizado.', 'Análise custo-benefício atualizada.', 'Kosten-Nutzen-Analyse, abgezinst.')),
    [L('Discount rate', 'Taux d’actualisation', 'Tasa de descuento', 'Taxa de desconto', 'Diskontsatz'), inp(0.04, 'pct', 'r')],
    head(C.year, L('Benefits', 'Bénéfices', 'Beneficios', 'Benefícios', 'Nutzen'), L('Costs', 'Coûts', 'Costes', 'Custos', 'Kosten'), L('Net', 'Net', 'Neto', 'Líquido', 'Netto'), L('Discounted net', 'Net actualisé', 'Neto actualizado', 'Líquido atualizado', 'Abgezinst netto')),
    ...rows(11, i => [i, inp(i === 0 ? 0 : 180, 'money'), inp(i === 0 ? 1000 : 30, 'money'), out('=B{r}-C{r}'), out('=D{r}/(1+$r)^A{r}')]),
    [L('Net present value', 'Valeur actuelle nette', 'Valor actual neto', 'Valor presente líquido', 'Kapitalwert'), null, null, null, out('=SUM(E6:E16)', 'money', true)],
    [L('Benefit / cost ratio', 'Ratio bénéfices / coûts', 'Ratio beneficio / coste', 'Rácio benefício / custo', 'Nutzen-Kosten-Verhältnis'), null, null, null, out('=SUMPRODUCT(B6:B16/(1+$r)^A6:A16)/SUMPRODUCT(C6:C16/(1+$r)^A6:A16)', 'num', true)],
  ],
};

const index100: Model = {
  rows: [
    note(L('Turn any series into an index (first value = 100) to compare things of different size.', 'Transformez une série en indice (1re valeur = 100) pour comparer des grandeurs différentes.', 'Convierta una serie en índice (1.er valor = 100).', 'Converta uma série em índice (1.º valor = 100).', 'Reihe in Index umwandeln (erster Wert = 100).')),
    head(C.year, L('Series A', 'Série A', 'Serie A', 'Série A', 'Reihe A'), L('Series B', 'Série B', 'Serie B', 'Série B', 'Reihe B'), L('Index A', 'Indice A', 'Índice A', 'Índice A', 'Index A'), L('Index B', 'Indice B', 'Índice B', 'Índice B', 'Index B')),
    ...rows(12, i => [2014 + i, inp(1500 + i * 60 + (i % 3) * 20, 'num'), inp(80 + i * 2 + (i % 2) * 3, 'num'), out('=B{r}/B$5*100', 'num'), out('=C{r}/C$5*100', 'num')]),
  ],
};

const movingAverage: Model = {
  rows: [
    note(L('A moving average smooths the ups and downs; the trend line shows the direction.', 'La moyenne mobile lisse les hauts et les bas ; la tendance montre la direction.', 'La media móvil suaviza; la tendencia muestra la dirección.', 'A média móvel suaviza; a tendência mostra a direção.', 'Der gleitende Durchschnitt glättet; der Trend zeigt die Richtung.')),
    head(C.month, C.value, L('3-month average', 'Moyenne 3 mois', 'Media 3 meses', 'Média 3 meses', '3-Monats-Mittel'), L('12-month average', 'Moyenne 12 mois', 'Media 12 meses', 'Média 12 meses', '12-Monats-Mittel'), L('Trend', 'Tendance', 'Tendencia', 'Tendência', 'Trend')),
    ...rows(24, i => [i + 1, inp(Math.round(100 + i * 2.5 + 12 * Math.sin(i / 1.9)), 'num'), i >= 2 ? out('=AVERAGE(B{r-2}:B{r})', 'num') : null, i >= 11 ? out('=AVERAGE(B{r-11}:B{r})', 'num') : null, out('=TREND($B$5:$B$28,$A$5:$A$28,A{r})', 'num')]),
  ],
};

const regression: Model = {
  rows: [
    note(L('Does one thing move with another? Slope, correlation and R² (like Excel’s Analysis ToolPak).', 'Une grandeur suit-elle une autre ? Pente, corrélation et R² (comme l’utilitaire d’analyse d’Excel).', '¿Una variable sigue a otra? Pendiente, correlación y R².', 'Uma variável segue outra? Declive, correlação e R².', 'Hängt eine Größe von einer anderen ab? Steigung, Korrelation, R².')),
    head(L('X (e.g. advertising)', 'X (ex. publicité)', 'X (p. ej. publicidad)', 'X (ex. publicidade)', 'X (z. B. Werbung)'), L('Y (e.g. sales)', 'Y (ex. ventes)', 'Y (p. ej. ventas)', 'Y (ex. vendas)', 'Y (z. B. Umsatz)'), L('Fitted Y', 'Y ajusté', 'Y ajustada', 'Y ajustado', 'Geschätztes Y'), L('Residual', 'Résidu', 'Residuo', 'Resíduo', 'Residuum')),
    ...rows(12, i => [inp([10, 12, 15, 17, 20, 22, 25, 27, 30, 33, 35, 38][i], 'num'), inp([110, 118, 135, 140, 160, 165, 180, 190, 205, 220, 226, 245][i], 'num'), out('=$B$18+$B$17*A{r}', 'num'), out('=B{r}-C{r}', 'num')]),
    [L('Slope', 'Pente', 'Pendiente', 'Declive', 'Steigung'), out('=SLOPE(B5:B16,A5:A16)', 'num', true)],
    [L('Intercept', 'Ordonnée à l’origine', 'Ordenada', 'Ordenada', 'Achsenabschnitt'), out('=INTERCEPT(B5:B16,A5:A16)', 'num', true)],
    [L('Correlation', 'Corrélation', 'Correlación', 'Correlação', 'Korrelation'), out('=CORREL(A5:A16,B5:B16)', 'num', true)],
    [L('R² (share explained)', 'R² (part expliquée)', 'R² (parte explicada)', 'R² (parte explicada)', 'R² (erklärter Anteil)'), out('=RSQ(B5:B16,A5:A16)', 'pct', true)],
  ],
};

const hhi: Model = {
  rows: [
    note(L('Market shares and concentration (Herfindahl-Hirschman index, used by competition authorities).', 'Parts de marché et concentration (indice de Herfindahl-Hirschman, utilisé par les autorités de concurrence).', 'Cuotas de mercado y concentración (índice HHI).', 'Quotas de mercado e concentração (índice HHI).', 'Marktanteile und Konzentration (HHI).')),
    head(L('Company', 'Entreprise', 'Empresa', 'Empresa', 'Unternehmen'), L('Sales', 'Ventes', 'Ventas', 'Vendas', 'Umsatz'), L('Share', 'Part', 'Cuota', 'Quota', 'Anteil'), L('Share² × 10 000', 'Part² × 10 000', 'Cuota² × 10 000', 'Quota² × 10 000', 'Anteil² × 10 000')),
    ...rows(8, i => [inp(`${['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'][i]}`), inp([420, 310, 150, 60, 30, 15, 10, 5][i], 'num'), out('=B{r}/SUM($B$5:$B$12)', 'pct'), out('=C{r}^2*10000', 'int')]),
    [{ v: C.total, total: true }, out('=SUM(B5:B12)', 'num', true), out('=SUM(C5:C12)', 'pct', true), out('=SUM(D5:D12)', 'int', true, 'h')],
    [L('Concentration', 'Concentration', 'Concentración', 'Concentração', 'Konzentration'), out(['=IF($h<1500,"Low",IF($h<2500,"Moderate","High"))', '=IF($h<1500,"Faible",IF($h<2500,"Modérée","Forte"))', '=IF($h<1500,"Baja",IF($h<2500,"Moderada","Alta"))', '=IF($h<1500,"Baixa",IF($h<2500,"Moderada","Alta"))', '=IF($h<1500,"Gering",IF($h<2500,"Mäßig","Hoch"))'], 'text', true)],
    [L('Top 4 share (CR4)', 'Part des 4 premiers (CR4)', 'Cuota de los 4 primeros (CR4)', 'Quota dos 4 primeiros (CR4)', 'Anteil Top 4 (CR4)'), out('=SUM(LARGE(C5:C12,{1,2,3,4}))', 'pct', true)],
  ],
};

const realWage: Model = {
  rows: [
    note(L('Has the wage really gone up? Nominal wage against prices.', 'Le salaire a-t-il vraiment augmenté ? Salaire nominal face aux prix.', '¿Ha subido de verdad el salario?', 'O salário subiu mesmo?', 'Ist der Lohn wirklich gestiegen?')),
    head(C.year, L('Monthly wage', 'Salaire mensuel', 'Salario mensual', 'Salário mensal', 'Monatslohn'), L('Price index', 'Indice des prix', 'Índice de precios', 'Índice de preços', 'Preisindex'), L('Real wage (first year’s money)', 'Salaire réel (valeur 1re année)', 'Salario real', 'Salário real', 'Reallohn'), L('Real change', 'Variation réelle', 'Variación real', 'Variação real', 'Reale Änderung')),
    [2016, inp(1800, 'money'), inp(100, 'num'), out('=B5*$C$5/C5'), null],
    ...rows(9, i => [2017 + i, inp([1830, 1860, 1900, 1910, 1950, 2020, 2100, 2160, 2200][i], 'money'), inp([101, 103, 104, 105, 107, 113, 118, 121, 123][i], 'num'), out('=B{r}*$C$5/C{r}'), out('=D{r}/D{r-1}-1', 'pct')]),
  ],
};

const importCost: Model = {
  widths: [240, 140, 110, 150],
  rows: [
    note(L('What imported goods cost in your money, with today’s rates, freight and duties.', 'Ce que coûtent des marchandises importées dans votre monnaie : taux du jour, fret et droits de douane.', 'Coste de una importación en su moneda.', 'Custo de uma importação na sua moeda.', 'Was Importware in Ihrer Währung kostet.')),
    [L('Your currency', 'Votre devise', 'Su moneda', 'A sua moeda', 'Ihre Währung'), inp('EUR', 'text', 'home')],
    head(L('Item', 'Article', 'Artículo', 'Artigo', 'Artikel'), C.price, L('Currency', 'Devise', 'Moneda', 'Moeda', 'Währung'), L('In your currency', 'Dans votre devise', 'En su moneda', 'Na sua moeda', 'In Ihrer Währung')),
    ...rows(6, i => [inp([L('Machine', 'Machine', 'Máquina', 'Máquina', 'Maschine'), L('Spare parts', 'Pièces détachées', 'Recambios', 'Peças', 'Ersatzteile'), L('Fabric', 'Tissu', 'Tela', 'Tecido', 'Stoff'), L('Phones', 'Téléphones', 'Teléfonos', 'Telefones', 'Telefone'), L('Software', 'Logiciel', 'Software', 'Software', 'Software'), L('Packaging', 'Emballage', 'Embalaje', 'Embalagem', 'Verpackung')][i]), inp([12000, 3000, 45000, 8000, 1500, 90000][i], 'num'), inp(['USD', 'GBP', 'CNY', 'USD', 'USD', 'JPY'][i], 'text'), out('=IFERROR(DEVISE(B{r},C{r},$home),0)')]),
    [L('Goods', 'Marchandises', 'Mercancías', 'Mercadorias', 'Waren'), null, null, out('=SUM(D6:D11)', 'money', true, 'goods')],
    [L('Freight and insurance', 'Fret et assurance', 'Flete y seguro', 'Frete e seguro', 'Fracht und Versicherung'), inp(0.06, 'pct', 'fr'), null, out('=$goods*$fr')],
    [L('Customs duty', 'Droits de douane', 'Aranceles', 'Direitos aduaneiros', 'Zoll'), inp(0.1, 'pct', 'du'), null, out('=($goods+D13)*$du')],
    [L('Landed cost', 'Coût rendu', 'Coste puesto en destino', 'Custo final', 'Einstandspreis'), null, null, out('=$goods+D13+D14', 'money', true)],
  ],
};

export const ECONOMIE: ProTool[] = [
  { id: 'inflation', icon: 'decless', model: inflation, name: L('Inflation and purchasing power', 'Inflation et pouvoir d’achat', 'Inflación y poder adquisitivo', 'Inflação e poder de compra', 'Inflation und Kaufkraft'), desc: L('What money loses each year over 30 years.', 'Ce que l’argent perd chaque année sur 30 ans.', 'Lo que pierde el dinero cada año.', 'O que o dinheiro perde por ano.', 'Was Geld jedes Jahr verliert.') },
  { id: 'gdp', icon: 'linechart', model: gdp, name: L('GDP growth', 'Croissance du PIB', 'Crecimiento del PIB', 'Crescimento do PIB', 'BIP-Wachstum'), desc: L('Yearly growth, index and average growth (CAGR).', 'Croissance annuelle, indice et croissance moyenne (TCAM).', 'Crecimiento anual, índice y medio.', 'Crescimento anual, índice e médio.', 'Jahreswachstum, Index und Durchschnitt.') },
  { id: 'elasticity', icon: 'percent', model: elasticity, name: L('Price elasticity of demand', 'Élasticité-prix de la demande', 'Elasticidad precio', 'Elasticidade-preço', 'Preiselastizität'), desc: L('How buyers react to a price change, and the revenue effect.', 'Comment les acheteurs réagissent à un prix, et l’effet sur la recette.', 'Cómo reaccionan los compradores al precio.', 'Como reagem os compradores ao preço.', 'Wie Käufer auf Preise reagieren.') },
  { id: 'equilibrium', icon: 'swap', model: equilibrium, name: L('Supply and demand equilibrium', 'Équilibre offre-demande', 'Equilibrio oferta-demanda', 'Equilíbrio oferta-procura', 'Angebot-Nachfrage-Gleichgewicht'), desc: L('Equilibrium price and quantity, with shortage or surplus by price.', 'Prix et quantité d’équilibre, pénurie ou excédent selon le prix.', 'Precio y cantidad de equilibrio.', 'Preço e quantidade de equilíbrio.', 'Gleichgewichtspreis und -menge.') },
  { id: 'cpi', icon: 'sheet', model: cpi, name: L('Price index (basket)', 'Indice des prix (panier)', 'Índice de precios (cesta)', 'Índice de preços (cabaz)', 'Preisindex (Warenkorb)'), desc: L('Laspeyres index and inflation from your own basket.', 'Indice de Laspeyres et inflation de votre propre panier.', 'Índice de Laspeyres de su cesta.', 'Índice de Laspeyres do seu cabaz.', 'Laspeyres-Index Ihres Warenkorbs.') },
  { id: 'labour', icon: 'user', model: labour, name: L('Unemployment and activity rates', 'Taux de chômage et d’activité', 'Tasas de paro y actividad', 'Taxas de desemprego e atividade', 'Arbeitslosen- und Erwerbsquote'), desc: L('Labour force, unemployment, activity and employment rates.', 'Population active, chômage, taux d’activité et d’emploi.', 'Población activa, paro y empleo.', 'População ativa, desemprego e emprego.', 'Erwerbspersonen, Arbeitslosigkeit, Beschäftigung.') },
  { id: 'ppp', icon: 'currency', model: ppp, name: L('Purchasing power parity', 'Parité de pouvoir d’achat', 'Paridad de poder adquisitivo', 'Paridade do poder de compra', 'Kaufkraftparität'), desc: L('Is a currency over- or under-valued? (Big Mac method)', 'Une monnaie est-elle sur- ou sous-évaluée ? (méthode Big Mac)', '¿Moneda sobre o infravalorada?', 'Moeda sobre ou subvalorizada?', 'Währung über- oder unterbewertet?') },
  { id: 'fisher', icon: 'decimal', model: fisher, name: L('Real interest rate (Fisher)', 'Taux d’intérêt réel (Fisher)', 'Tipo de interés real (Fisher)', 'Taxa de juro real (Fisher)', 'Realzins (Fisher)'), desc: L('What a rate earns after inflation, exact and quick.', 'Ce qu’un taux rapporte après inflation, exact et approché.', 'Lo que rinde tras inflación.', 'O que rende após inflação.', 'Was ein Zins nach Inflation bringt.') },
  { id: 'multiplier', icon: 'grow', model: multiplier, name: L('Keynesian multiplier', 'Multiplicateur keynésien', 'Multiplicador keynesiano', 'Multiplicador keynesiano', 'Keynes-Multiplikator'), desc: L('How much new spending raises national income.', 'De combien une dépense nouvelle augmente le revenu national.', 'Cuánto eleva la renta un gasto nuevo.', 'Quanto eleva o rendimento uma despesa nova.', 'Wie stark neue Ausgaben das Einkommen erhöhen.') },
  { id: 'population', icon: 'heart', model: population, name: L('Population projection', 'Projection de population', 'Proyección de población', 'Projeção da população', 'Bevölkerungsprognose'), desc: L('Population over 30 years and doubling time.', 'Population sur 30 ans et temps de doublement.', 'Población a 30 años.', 'População a 30 anos.', 'Bevölkerung über 30 Jahre.') },
  { id: 'percapita', icon: 'piechart', model: perCapita, name: L('GDP per person', 'PIB par habitant', 'PIB per cápita', 'PIB per capita', 'BIP pro Kopf'), desc: L('Per person, per day and in dollars with today’s rate.', 'Par habitant, par jour et en dollars au taux du jour.', 'Por persona, por día y en dólares.', 'Por pessoa, por dia e em dólares.', 'Pro Kopf, pro Tag und in Dollar.') },
  { id: 'gini', icon: 'stacked', model: gini, name: L('Inequality (Gini index)', 'Inégalités (indice de Gini)', 'Desigualdad (índice de Gini)', 'Desigualdade (índice de Gini)', 'Ungleichheit (Gini-Index)'), desc: L('From income shares by fifth to the Gini index.', 'Des parts de revenu par quintile à l’indice de Gini.', 'De los quintiles al Gini.', 'Dos quintis ao Gini.', 'Von Fünfteln zum Gini-Index.') },
  { id: 'trade', icon: 'barchart', model: trade, name: L('Trade balance', 'Balance commerciale', 'Balanza comercial', 'Balança comercial', 'Handelsbilanz'), desc: L('Exports, imports, balance and coverage rate over 10 years.', 'Exportations, importations, solde et taux de couverture sur 10 ans.', 'Exportaciones, importaciones y saldo.', 'Exportações, importações e saldo.', 'Exporte, Importe, Saldo.') },
  { id: 'debt', icon: 'gov', model: debt, name: L('Public debt ratio', 'Ratio de dette publique', 'Ratio de deuda pública', 'Rácio da dívida pública', 'Staatsschuldenquote'), desc: L('Debt to GDP over 10 years and the deficit that keeps it stable.', 'Dette/PIB sur 10 ans et le déficit qui la stabilise.', 'Deuda/PIB a 10 años.', 'Dívida/PIB a 10 anos.', 'Schulden/BIP über 10 Jahre.') },
  { id: 'costbenefit', icon: 'check', model: costBenefit, name: L('Cost-benefit analysis', 'Analyse coûts-bénéfices', 'Análisis coste-beneficio', 'Análise custo-benefício', 'Kosten-Nutzen-Analyse'), desc: L('Discounted benefits against costs: NPV and B/C ratio.', 'Bénéfices actualisés face aux coûts : VAN et ratio B/C.', 'VAN y ratio B/C.', 'VPL e rácio B/C.', 'Kapitalwert und N/K-Verhältnis.') },
  { id: 'index100', icon: 'index', model: index100, name: L('Index base 100', 'Indice base 100', 'Índice base 100', 'Índice base 100', 'Index Basis 100'), desc: L('Compare two series of different size.', 'Comparer deux séries de tailles différentes.', 'Comparar dos series.', 'Comparar duas séries.', 'Zwei Reihen vergleichen.') },
  { id: 'moving', icon: 'areachart', model: movingAverage, name: L('Moving averages and trend', 'Moyennes mobiles et tendance', 'Medias móviles y tendencia', 'Médias móveis e tendência', 'Gleitende Mittel und Trend'), desc: L('3- and 12-month averages and the trend line.', 'Moyennes 3 et 12 mois et droite de tendance.', 'Medias de 3 y 12 meses.', 'Médias de 3 e 12 meses.', '3- und 12-Monats-Mittel.') },
  { id: 'regression', icon: 'chart', model: regression, name: L('Correlation and regression', 'Corrélation et régression', 'Correlación y regresión', 'Correlação e regressão', 'Korrelation und Regression'), desc: L('Slope, intercept, correlation and R², with residuals.', 'Pente, ordonnée, corrélation et R², avec résidus.', 'Pendiente, correlación y R².', 'Declive, correlação e R².', 'Steigung, Korrelation und R².') },
  { id: 'hhi', icon: 'columns', model: hhi, name: L('Market shares and concentration', 'Parts de marché et concentration', 'Cuotas de mercado y concentración', 'Quotas de mercado e concentração', 'Marktanteile und Konzentration'), desc: L('Shares, HHI and CR4, as competition authorities do.', 'Parts, HHI et CR4, comme les autorités de concurrence.', 'Cuotas, HHI y CR4.', 'Quotas, HHI e CR4.', 'Anteile, HHI und CR4.') },
  { id: 'realwage', icon: 'rocket', model: realWage, name: L('Real wage', 'Salaire réel', 'Salario real', 'Salário real', 'Reallohn'), desc: L('Wage against prices, year by year.', 'Salaire face aux prix, année par année.', 'Salario frente a precios.', 'Salário face aos preços.', 'Lohn gegen Preise.') },
  { id: 'import', icon: 'envelope', model: importCost, name: L('Import cost in your currency', 'Coût d’importation dans votre devise', 'Coste de importación', 'Custo de importação', 'Importkosten'), desc: L('Goods in many currencies, freight, duty: the landed cost.', 'Marchandises en plusieurs devises, fret, douane : le coût rendu.', 'Mercancías, flete y aranceles.', 'Mercadorias, frete e direitos.', 'Waren, Fracht und Zoll.') },
];
