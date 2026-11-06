// Formulas typed the way Excel speaks in each language (Martin, 2026-11-06: "il faudrait vérifier ce genre de
// difficulté"): =SOMME(A1:A3), =SI(A1>0;"oui";"non"), =MOYENNE(1,5;2) in French, =SUMA in Spanish, =SOMA in Portuguese,
// =SUMME in German. Office In 1 keeps formulas the way Excel stores them in its files (English names, "," between the
// parts, "." for decimals), so a person's own words are turned into that as they type.

/** Excel's names in French, Spanish, Portuguese and German, for the English name. */
const NAMES: Record<string, string[]> = {
  SUM: ['SOMME', 'SUMA', 'SOMA', 'SUMME'],
  AVERAGE: ['MOYENNE', 'PROMEDIO', 'MÉDIA', 'MITTELWERT'],
  IF: ['SI', 'SE', 'WENN'],
  COUNT: ['NB', 'CONTAR', 'CONT.NÚM', 'ANZAHL'],
  COUNTA: ['NBVAL', 'CONTARA', 'CONT.VALORES', 'ANZAHL2'],
  COUNTBLANK: ['NB.VIDE', 'CONTAR.BLANCO', 'CONTAR.VAZIO', 'ANZAHLLEEREZELLEN'],
  MAX: ['MÁX', 'MÁXIMO'],
  MIN: ['MÍN', 'MÍNIMO'],
  ROUND: ['ARRONDI', 'REDONDEAR', 'ARRED', 'RUNDEN'],
  ROUNDUP: ['ARRONDI.SUP', 'REDONDEAR.MAS', 'ARREDONDAR.PARA.CIMA', 'AUFRUNDEN'],
  ROUNDDOWN: ['ARRONDI.INF', 'REDONDEAR.MENOS', 'ARREDONDAR.PARA.BAIXO', 'ABRUNDEN'],
  SUMIF: ['SOMME.SI', 'SUMAR.SI', 'SOMASE', 'SUMMEWENN'],
  SUMIFS: ['SOMME.SI.ENS', 'SUMAR.SI.CONJUNTO', 'SOMASES', 'SUMMEWENNS'],
  COUNTIF: ['NB.SI', 'CONTAR.SI', 'CONT.SE', 'ZÄHLENWENN'],
  COUNTIFS: ['NB.SI.ENS', 'CONTAR.SI.CONJUNTO', 'CONT.SES', 'ZÄHLENWENNS'],
  AVERAGEIF: ['MOYENNE.SI', 'PROMEDIO.SI', 'MÉDIASE', 'MITTELWERTWENN'],
  AVERAGEIFS: ['MOYENNE.SI.ENS', 'PROMEDIO.SI.CONJUNTO', 'MÉDIASES', 'MITTELWERTWENNS'],
  VLOOKUP: ['RECHERCHEV', 'BUSCARV', 'PROCV', 'SVERWEIS'],
  HLOOKUP: ['RECHERCHEH', 'BUSCARH', 'PROCH', 'WVERWEIS'],
  XLOOKUP: ['RECHERCHEX', 'BUSCARX', 'PROCX', 'XVERWEIS'],
  INDEX: ['INDICE', 'ÍNDICE'],
  MATCH: ['EQUIV', 'COINCIDIR', 'CORRESP', 'VERGLEICH'],
  TODAY: ['AUJOURDHUI', "AUJOURD'HUI", 'HOY', 'HOJE', 'HEUTE'],
  NOW: ['MAINTENANT', 'AHORA', 'AGORA', 'JETZT'],
  AND: ['ET', 'Y', 'E', 'UND'],
  OR: ['OU', 'O', 'ODER'],
  NOT: ['NON', 'NO', 'NÃO', 'NICHT'],
  IFERROR: ['SIERREUR', 'SI.ERROR', 'SEERRO', 'WENNFEHLER'],
  CONCATENATE: ['CONCATENER', 'CONCATENAR', 'VERKETTEN'],
  CONCAT: ['CONCAT'],
  TEXTJOIN: ['JOINDRE.TEXTE', 'UNIRCADENAS', 'UNIRTEXTO', 'TEXTVERKETTEN'],
  LEFT: ['GAUCHE', 'IZQUIERDA', 'ESQUERDA', 'LINKS'],
  RIGHT: ['DROITE', 'DERECHA', 'DIREITA', 'RECHTS'],
  MID: ['STXT', 'EXTRAE', 'EXT.TEXTO', 'TEIL'],
  LEN: ['NBCAR', 'LARGO', 'NÚM.CARACT', 'LÄNGE'],
  UPPER: ['MAJUSCULE', 'MAYUSC', 'MAIÚSCULA', 'GROSS'],
  LOWER: ['MINUSCULE', 'MINUSC', 'MINÚSCULA', 'KLEIN'],
  PROPER: ['NOMPROPRE', 'NOMPROPIO', 'PRI.MAIÚSCULA', 'GROSS2'],
  TRIM: ['SUPPRESPACE', 'ESPACIOS', 'ARRUMAR', 'GLÄTTEN'],
  SUBSTITUTE: ['SUBSTITUE', 'SUSTITUIR', 'SUBSTITUIR', 'WECHSELN'],
  FIND: ['TROUVE', 'ENCONTRAR', 'PROCURAR', 'FINDEN'],
  SEARCH: ['CHERCHE', 'HALLAR', 'LOCALIZAR', 'SUCHEN'],
  TEXT: ['TEXTE', 'TEXTO'],
  VALUE: ['CNUM', 'VALOR', 'WERT'],
  INT: ['ENT', 'ENTERO', 'GANZZAHL'],
  MOD: ['RESIDUO', 'REST'],
  PRODUCT: ['PRODUIT', 'PRODUCTO', 'MULT', 'PRODUKT'],
  SQRT: ['RACINE', 'RAIZ', 'WURZEL'],
  POWER: ['PUISSANCE', 'POTENCIA', 'POTÊNCIA', 'POTENZ'],
  MEDIAN: ['MEDIANE', 'MÉDIANE', 'MEDIANA', 'MED'],
  RAND: ['ALEA', 'ALEATORIO', 'ALEATÓRIO', 'ZUFALLSZAHL'],
  RANDBETWEEN: ['ALEA.ENTRE.BORNES', 'ALEATORIO.ENTRE', 'ALEATÓRIOENTRE', 'ZUFALLSBEREICH'],
  LARGE: ['GRANDE.VALEUR', 'K.ESIMO.MAYOR', 'MAIOR', 'KGRÖSSTE'],
  SMALL: ['PETITE.VALEUR', 'K.ESIMO.MENOR', 'MENOR', 'KKLEINSTE'],
  RANK: ['RANG', 'JERARQUIA', 'ORDEM'],
  STDEV: ['ECARTYPE', 'DESVEST', 'DESVPAD', 'STABW'],
  YEAR: ['ANNEE', 'ANNÉE', 'AÑO', 'ANO', 'JAHR'],
  MONTH: ['MOIS', 'MES', 'MÊS', 'MONAT'],
  DAY: ['JOUR', 'DIA', 'TAG'],
  DATE: ['FECHA', 'DATA', 'DATUM'],
  WEEKDAY: ['JOURSEM', 'DIASEM', 'DIA.DA.SEMANA', 'WOCHENTAG'],
  EOMONTH: ['FIN.MOIS', 'FIN.MES', 'FIMMÊS', 'MONATSENDE'],
  EDATE: ['MOIS.DECALER', 'FECHA.MES', 'DATAM', 'EDATUM'],
  NETWORKDAYS: ['NB.JOURS.OUVRES', 'DIAS.LAB', 'DIATRABALHOTOTAL', 'NETTOARBEITSTAGE'],
  ISBLANK: ['ESTVIDE', 'ESBLANCO', 'ÉCÉL.VAZIA', 'ISTLEER'],
  ISNUMBER: ['ESTNUM', 'ESNUMERO', 'ÉNÚM', 'ISTZAHL'],
  ISTEXT: ['ESTTEXTE', 'ESTEXTO', 'ÉTEXTO', 'ISTTEXT'],
  ISERROR: ['ESTERREUR', 'ESERROR', 'ÉERRO', 'ISTFEHLER'],
  PMT: ['VPM', 'PAGO', 'PGTO', 'RMZ'],
  FV: ['VC', 'VF', 'ZW'],
  PV: ['VA', 'BW'],
  NPV: ['VAN', 'VPL', 'NBW'],
  IRR: ['TRI', 'TIR', 'IKV'],
  ABS: ['ABS'],
  CHOOSE: ['CHOISIR', 'ELEGIR', 'ESCOLHER', 'WAHL'],
  UNIQUE: ['UNIQUE', 'UNICOS', 'ÚNICO', 'EINDEUTIG'],
  SORT: ['TRIER', 'ORDENAR', 'CLASSIFICAR', 'SORTIEREN'],
  FILTER: ['FILTRE', 'FILTRAR', 'FILTERN'],
  SUMPRODUCT: ['SOMMEPROD', 'SUMAPRODUCTO', 'SOMARPRODUTO', 'SUMMENPRODUKT'],
  ROWS: ['LIGNES', 'FILAS', 'LINS', 'ZEILEN'],
  COLUMNS: ['COLONNES', 'COLUMNAS', 'COLS', 'SPALTEN'],
};
const WORDS: Record<string, string> = { VRAI: 'TRUE', FAUX: 'FALSE', VERDADERO: 'TRUE', FALSO: 'FALSE', VERDADEIRO: 'TRUE', WAHR: 'TRUE', FALSCH: 'FALSE' };

const TO_ENGLISH = new Map<string, string>();
for (const [en, others] of Object.entries(NAMES)) for (const o of others) if (o !== en) TO_ENGLISH.set(o, en);

/** Parts of a formula outside "strings" and 'sheet names', which are left alone. */
function mapOutside(f: string, fn: (part: string) => string): string {
  let out = '', i = 0;
  while (i < f.length) {
    const q = f[i] === '"' || f[i] === "'" ? f[i] : '';
    if (q) {
      let j = i + 1;
      while (j < f.length && !(f[j] === q && f[j + 1] !== q)) j += f[j] === q ? 2 : 1;
      out += f.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < f.length && f[j] !== '"' && f[j] !== "'") j++;
    out += fn(f.slice(i, j));
    i = j;
  }
  return out;
}

/** A formula as typed in any of Office In 1's languages, the way Excel stores it: =SOMME(1,5;A1) → =SUM(1.5,A1). */
export function canonicalFormula(input: string): string {
  if (!input.startsWith('=')) return input;
  let f = mapOutside(input, part => part
    .replace(/(^|[^\p{L}\p{N}_.$])([\p{L}][\p{L}\p{N}_.]*)\s*\(/gu, (m, pre: string, name: string) => {
      const en = TO_ENGLISH.get(name.toUpperCase());
      return en ? `${pre}${en}(` : m;
    })
    .replace(/(^|[^\p{L}\p{N}_.$!:])([\p{L}]+)(?![\p{L}\p{N}_.(!:])/gu, (m, pre: string, w: string) => (WORDS[w.toUpperCase()] ? `${pre}${WORDS[w.toUpperCase()]}` : m)));
  // ";" between the parts (French, Spanish, Portuguese, German Excel): then "," is the decimal comma.
  if (mapOutside(f, p => p.replace(/[^;]/g, '')).includes(';')) {
    f = mapOutside(f, part => part.replace(/(\d),(\d)/g, '$1.$2').replace(/;/g, ','));
  }
  return f;
}
