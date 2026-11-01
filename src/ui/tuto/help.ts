// What each ribbon button does and how to use it, for the Tuto (Martin, 2026-10-31: "people never learn the tools of
// MS Office"). Keyed by the button's message key, the same key that gives its name. Each entry is
// [English, French]: what it does, then how to use it, in one or two plain sentences. Spanish, Portuguese and German
// are translated on the device by the browser's own translator when it has one, otherwise the English is shown.
//
// Keys ending in ".*" explain a whole family (a chart type, a function category); "{name}" is the button's name.

import { HELP_CODE } from './helpCode';
import { HELP_LETTER } from './helpLetter';
import { HELP_STAGE } from './helpStage';
import { HELP_CONVERT } from './helpConvert';
import { HELP_PRINT } from './helpPrint';
import { HELP_DRAW } from './helpDraw';
import { HELP_NOTES } from './helpNotes';
import { HELP_PLAN } from './helpPlan';

export type HelpText = [en: string, fr: string];

export const HELP: Record<string, HelpText> = {
  // ---------- shared with Letter and Stage ----------
  'letter.refModels': ['Opens the reference models: one tab per style (APA 7 in English or French, MLA, Chicago, IEEE, ISO 690…) with its layout rules and, for each type of document, the pattern, a real example and “Use this model”.', 'Ouvre les modèles de références : un onglet par norme (APA 7 en anglais ou en français, MLA, Chicago, IEEE, ISO 690…) avec ses règles de mise en page et, pour chaque type de document, le format, un exemple réel et « Utiliser ce modèle ».'],
  'letter.refCheck': ['Checks every source cited in the document and lists what the chosen style still needs (year, publisher, DOI, pages…). “Complete” fills it in and updates every citation of that source.', 'Vérifie chaque source citée dans le document et liste ce que la norme choisie demande encore (année, éditeur, DOI, pages…). « Compléter » l’ajoute et met à jour toutes les citations de cette source.'],
  'letter.paste': ['Puts what you copied at the selected place. A table copied from Excel, Word or a web page keeps its rows and columns.', 'Colle ce que vous avez copié à l’endroit choisi. Un tableau copié depuis Excel, Word ou une page web garde ses lignes et ses colonnes.'],
  'letter.cut': ['Removes the selection and keeps it, ready to paste somewhere else (Ctrl+X).', 'Enlève la sélection et la garde, prête à être collée ailleurs (Ctrl+X).'],
  'letter.copy': ['Copies the selection without removing it (Ctrl+C). Then click where it should go and Paste.', 'Copie la sélection sans l’enlever (Ctrl+C). Cliquez ensuite à l’endroit voulu et collez.'],
  'letter.painter': ['Copies the look of the selection (font, colours, borders) to the next thing you click. Select the model first, click the brush, then click the target.', 'Copie l’apparence de la sélection (police, couleurs, bordures) sur ce que vous cliquez ensuite. Sélectionnez le modèle, cliquez le pinceau, puis la cible.'],
  'letter.bold': ['Makes the selected text bold (Ctrl+B). Click again to undo it.', 'Met le texte sélectionné en gras (Ctrl+B). Cliquez encore pour l’enlever.'],
  'letter.italic': ['Slants the selected text (Ctrl+I), for a title, a word in another language or an emphasis.', 'Met le texte sélectionné en italique (Ctrl+I), pour un titre, un mot étranger ou une insistance.'],
  'letter.underline': ['Underlines the selected text (Ctrl+U).', 'Souligne le texte sélectionné (Ctrl+U).'],
  'letter.strike': ['Draws a line through the selected text, to show it is cancelled or done.', 'Barre le texte sélectionné, pour montrer qu’il est annulé ou fait.'],
  'letter.grow': ['Makes the selected text one size bigger each click.', 'Agrandit le texte sélectionné d’une taille à chaque clic.'],
  'letter.shrink': ['Makes the selected text one size smaller each click.', 'Réduit le texte sélectionné d’une taille à chaque clic.'],
  'letter.font': ['Chooses the typeface of the selection. Type a few letters to find a font, Enter to take it.', 'Choisit la police de la sélection. Tapez quelques lettres pour trouver une police, Entrée pour la prendre.'],
  'letter.fontSize': ['Sets the size of the selected text. Pick a size or type one (like 13) and press Enter.', 'Règle la taille du texte sélectionné. Choisissez une taille ou tapez-en une (comme 13) puis Entrée.'],
  'letter.color': ['Colours the selected text. The arrow opens the palette; the button applies the last colour again.', 'Colore le texte sélectionné. La flèche ouvre la palette ; le bouton remet la dernière couleur.'],
  'letter.alignLeft': ['Lines the content up on the left edge.', 'Aligne le contenu sur le bord gauche.'],
  'letter.alignCenter': ['Centres the content, for titles and headings.', 'Centre le contenu, pour les titres.'],
  'letter.alignRight': ['Lines the content up on the right edge, the usual place for amounts and dates.', 'Aligne le contenu à droite, la place habituelle des montants et des dates.'],
  'letter.borders': ['Draws lines around or inside the selected cells: all borders, outside only, a thick bottom line for totals…', 'Trace des traits autour ou dans les cellules choisies : toutes les bordures, contour seul, trait épais pour un total…'],
  'letter.deleteRow': ['Deletes the whole rows of the selected cells; the rows below move up.', 'Supprime les lignes entières des cellules choisies ; les lignes du dessous remontent.'],
  'letter.deleteColumn': ['Deletes the whole columns of the selected cells; the columns on the right move left.', 'Supprime les colonnes entières des cellules choisies ; les colonnes de droite se décalent.'],
  'letter.print': ['Prints the document or saves it as a PDF (choose “Save as PDF” as the printer).', 'Imprime le document ou l’enregistre en PDF (choisissez « Enregistrer en PDF » comme imprimante).'],
  'letter.zoomIn': ['Shows the document bigger. Two fingers or Ctrl + mouse wheel do the same.', 'Affiche le document plus grand. Deux doigts ou Ctrl + molette font pareil.'],
  'letter.zoomOut': ['Shows the document smaller, to see more of it at once.', 'Affiche le document plus petit, pour en voir davantage.'],
  'letter.undo': ['Takes back the last change (Ctrl+Z). Click several times to go further back.', 'Annule la dernière modification (Ctrl+Z). Cliquez plusieurs fois pour remonter plus loin.'],
  'letter.redo': ['Puts back what Undo took away (Ctrl+Y).', 'Rétablit ce qu’Annuler a enlevé (Ctrl+Y).'],
  'ui.fitAll': ['Zooms so the whole sheet, page or slide fits on the screen, for a clear overview.', 'Zoome pour voir toute la feuille, la page ou la diapositive à l’écran, pour une vue d’ensemble.'],

  // ---------- In 1 Class: Home ----------
  'class.alignTop': ['Puts the content at the top of tall cells.', 'Place le contenu en haut des cellules hautes.'],
  'class.alignMiddle': ['Puts the content in the vertical middle of the cells.', 'Place le contenu au milieu, verticalement.'],
  'class.alignBottom': ['Puts the content at the bottom of the cells, like Excel does by default.', 'Place le contenu en bas des cellules, comme Excel par défaut.'],
  'class.wrap': ['Shows long text on several lines inside its cell instead of running over the next cells.', 'Affiche un texte long sur plusieurs lignes dans sa cellule au lieu de déborder.'],
  'class.mergeCenter': ['Joins the selected cells into one big cell and centres the text, for a title over a table.', 'Fusionne les cellules choisies en une seule et centre le texte, pour un titre au-dessus d’un tableau.'],
  'class.mergeOptions': ['Other ways to merge: merge across (row by row), merge without centring, or unmerge.', 'Autres façons de fusionner : par ligne, sans centrer, ou annuler la fusion.'],
  'class.indentMore': ['Moves the cell’s text a step to the right, to show sub-items under a heading.', 'Décale le texte d’un cran vers la droite, pour montrer des sous-éléments.'],
  'class.indentLess': ['Moves the cell’s text a step back to the left.', 'Ramène le texte d’un cran vers la gauche.'],
  'class.fill': ['Colours the background of the selected cells, to highlight headers or totals.', 'Colore le fond des cellules choisies, pour faire ressortir les titres ou les totaux.'],
  'class.numberFormat': ['Chooses how numbers look: general, number, currency, accounting, date, time, percentage, fraction, text…', 'Choisit l’affichage des nombres : standard, nombre, monétaire, comptabilité, date, heure, pourcentage, fraction, texte…'],
  'class.format.currency': ['Shows the numbers as money with your currency symbol and two decimals.', 'Affiche les nombres en argent avec le symbole de votre monnaie et deux décimales.'],
  'class.format.percent': ['Shows 0.25 as 25 %. Type the number as a fraction of 1.', 'Affiche 0,25 comme 25 %. Tapez le nombre comme une fraction de 1.'],
  'class.thousands': ['Adds a space or comma between thousands (1 234 567) so big numbers are easy to read.', 'Ajoute un séparateur de milliers (1 234 567) pour lire facilement les grands nombres.'],
  'class.decimalsMore': ['Shows one more decimal each click. The real number does not change, only how it is shown.', 'Affiche une décimale de plus à chaque clic. Le nombre réel ne change pas, seulement l’affichage.'],
  'class.decimalsLess': ['Shows one decimal less each click (the number is rounded on screen only).', 'Affiche une décimale de moins à chaque clic (arrondi à l’écran seulement).'],
  'class.cond.title': ['Colours cells by their value: above or below a number, top 10, duplicates, data bars, colour scales and icon sets.', 'Colore les cellules selon leur valeur : supérieur ou inférieur à, 10 premiers, doublons, barres de données, nuances et icônes.'],
  'class.insertRow': ['Adds an empty row above the selection. Formulas below adjust by themselves.', 'Ajoute une ligne vide au-dessus de la sélection. Les formules en dessous s’ajustent seules.'],
  'class.insertColumn': ['Adds an empty column to the left of the selection.', 'Ajoute une colonne vide à gauche de la sélection.'],
  'class.autoSum': ['Adds up the numbers above or to the left in one click: it writes =SUM(…) for you. Check the range, then Enter.', 'Additionne en un clic les nombres au-dessus ou à gauche : il écrit =SOMME(…) pour vous. Vérifiez la plage puis Entrée.'],
  'class.fillDown': ['Copies the top cell of the selection into the cells below it (Ctrl+D), formulas included.', 'Recopie la cellule du haut dans les cellules en dessous (Ctrl+D), formules comprises.'],
  'class.fillRight': ['Copies the left cell of the selection into the cells to its right (Ctrl+R).', 'Recopie la cellule de gauche dans les cellules à droite (Ctrl+R).'],
  'class.clear': ['Empties the selected cells: everything, only the contents, or only the formats.', 'Vide les cellules choisies : tout, seulement le contenu ou seulement la mise en forme.'],
  'class.sortAZ': ['Sorts the rows from smallest to largest (A to Z, 1 to 9), keeping each row together.', 'Trie les lignes du plus petit au plus grand (A à Z, 1 à 9), chaque ligne restant entière.'],
  'class.sortZA': ['Sorts the rows from largest to smallest (Z to A, 9 to 1).', 'Trie les lignes du plus grand au plus petit (Z à A, 9 à 1).'],
  'class.findReplace': ['Finds a word or number in the sheet and can replace it everywhere (Ctrl+F, Ctrl+H).', 'Cherche un mot ou un nombre dans la feuille et peut le remplacer partout (Ctrl+F, Ctrl+H).'],
  'class.filter': ['Adds little arrows on the header row to show only the rows you want (by value, text or colour).', 'Ajoute des flèches sur la ligne de titres pour n’afficher que les lignes voulues (par valeur, texte ou couleur).'],

  // ---------- In 1 Class: Insert, charts ----------
  'class.chart.*': ['Draws a “{name}” chart from the selected table. Select the numbers with their titles first.', 'Dessine un graphique « {name} » à partir du tableau choisi. Sélectionnez d’abord les nombres avec leurs titres.'],
  'class.chart.more': ['Opens every kind of chart: area, scatter, doughnut, radar, combo and more, with a preview.', 'Ouvre tous les types de graphiques : aires, nuage de points, anneau, radar, combiné…, avec un aperçu.'],
  'class.chart.type': ['Changes the kind of the selected chart without making it again.', 'Change le type du graphique choisi sans le refaire.'],
  'class.chart.switch': ['Swaps rows and columns: what was the legend becomes the axis.', 'Inverse lignes et colonnes : la légende devient l’axe.'],
  'class.chart.legend': ['Shows, moves or hides the chart’s legend.', 'Affiche, déplace ou cache la légende du graphique.'],
  'class.chart.labels': ['Writes each value on its bar, slice or point.', 'Écrit chaque valeur sur sa barre, sa part ou son point.'],
  'class.chart.colors': ['Gives the chart another set of colours.', 'Donne au graphique un autre jeu de couleurs.'],
  'class.chart.savePng': ['Saves the chart as a picture (PNG) to put in an e-mail or a website.', 'Enregistre le graphique en image (PNG) pour un courriel ou un site.'],
  'class.chart.toLetter': ['Sends the chart into an In 1 Letter document.', 'Envoie le graphique dans un document In 1 Letter.'],
  'class.chart.toStage': ['Sends the chart onto an In 1 Stage slide.', 'Envoie le graphique sur une diapositive In 1 Stage.'],
  'class.chart.delete': ['Removes the selected chart. The table stays.', 'Supprime le graphique choisi. Le tableau reste.'],

  // ---------- In 1 Class: Formulas ----------
  'class.fn.insert': ['Finds a function by what you want to do (“average”, “loan payment”…), explains it and helps fill it in.', 'Trouve une fonction selon ce que vous voulez faire (« moyenne », « mensualité »…), l’explique et aide à la remplir.'],
  'class.fn.more': ['Lists all 440+ functions by category, each with an explanation.', 'Liste les 440+ fonctions par catégorie, chacune avec son explication.'],
  'class.fn.cat.*': ['Opens the “{name}” functions. Pick one to insert it in the selected cell.', 'Ouvre les fonctions « {name} ». Choisissez-en une pour l’insérer dans la cellule.'],
  'tuto.fn.AVERAGE': ['Writes =AVERAGE(…) under the selected numbers: their mean.', 'Écrit =MOYENNE(…) sous les nombres choisis : leur moyenne.'],
  'tuto.fn.MIN': ['Writes =MIN(…): the smallest of the selected numbers.', 'Écrit =MIN(…) : le plus petit des nombres choisis.'],
  'tuto.fn.MAX': ['Writes =MAX(…): the largest of the selected numbers.', 'Écrit =MAX(…) : le plus grand des nombres choisis.'],
  'tuto.fn.COUNT': ['Writes =COUNT(…): how many cells hold a number.', 'Écrit =NB(…) : combien de cellules contiennent un nombre.'],

  // ---------- In 1 Class: Business ----------
  'tuto.proCat.*': ['Shows the ready sheets and tools for {name} in this tab.', 'Affiche dans cet onglet les feuilles prêtes et les outils pour : {name}.'],
  'class.pro.cat.all': ['Shows the most used tools of every category together.', 'Affiche ensemble les outils les plus utilisés de toutes les catégories.'],
  'class.pro.gallery': ['Opens every ready professional sheet (60+), with a search in five languages.', 'Ouvre toutes les feuilles professionnelles prêtes (60+), avec une recherche en cinq langues.'],
  'class.pro.converter': ['Converts between 300+ currencies with the rates of the day, and can write a live =DEVISE() formula.', 'Convertit entre 300+ monnaies au taux du jour, et peut écrire une formule =DEVISE() à jour.'],
  'class.pro.table': ['Adds a sheet of today’s exchange rates for the main currencies.', 'Ajoute une feuille des taux de change du jour pour les principales monnaies.'],

  // ---------- In 1 Class: Data, View, sheets ----------
  'class.removeDuplicates': ['Deletes the rows that repeat another row exactly, keeping the first one.', 'Supprime les lignes identiques à une autre, en gardant la première.'],
  'class.validation': ['Sets what the selected cells accept (whole number, decimal, list with an arrow, date, time, text length or your own formula), the message shown when the cell is picked, and what happens when a wrong value is typed (stop, warning or information).', 'Définit ce que les cellules sélectionnées acceptent (nombre entier, décimal, liste avec une flèche, date, heure, longueur du texte ou votre formule), le message affiché quand la cellule est choisie, et ce qui se passe si une mauvaise valeur est tapée (arrêt, avertissement ou information).'],
  'class.circleInvalid': ['Draws a red circle around every value on the sheet that breaks its validation rule, for example values typed before the rule existed.', 'Entoure en rouge chaque valeur de la feuille qui ne respecte pas sa règle de validation, par exemple des valeurs tapées avant la règle.'],
  'class.clearCircles': ['Removes the red circles drawn by "Circle invalid data".', 'Retire les cercles rouges tracés par « Entourer les données non valides ».'],
  'class.goalSeek': ['Works backwards: choose a formula cell and the result you want, and In 1 Class finds the value of one input cell that gives it. Example: the loan amount for a monthly payment of 300.', 'Calcule à l\u2019envers : choisissez une cellule formule et le résultat voulu, In 1 Class trouve la valeur d\u2019une cellule d\u2019entrée qui le donne. Exemple : le montant d\u2019un prêt pour une mensualité de 300.'],
  'class.scenarios': ['Keeps named sets of values for the same cells (best case, worst case, budget A or B), shows each one in the sheet with one click, and builds a summary sheet that compares their results.', 'Garde des jeux de valeurs nommés pour les mêmes cellules (meilleur cas, pire cas, budget A ou B), affiche chacun dans la feuille d\u2019un clic et crée une feuille de synthèse qui compare leurs résultats.'],
  'class.solver': ['Finds the best values for several cells at once: the largest profit, the smallest cost or an exact target, while keeping your limits (at most, at least, whole numbers, yes/no). Linear models are solved exactly.', 'Trouve les meilleures valeurs de plusieurs cellules à la fois : le plus grand bénéfice, le plus petit coût ou une cible exacte, en respectant vos limites (au plus, au moins, nombres entiers, oui/non). Les modèles linéaires sont résolus exactement.'],
  'class.addSheet': ['Adds a new empty sheet (tab at the bottom).', 'Ajoute une nouvelle feuille vide (onglet en bas).'],
  'class.renameSheet': ['Gives the current sheet a new name. Double-clicking its tab does the same.', 'Renomme la feuille actuelle. Un double-clic sur son onglet fait pareil.'],
  'class.tabColor': ['Colours the tab of the current sheet, to find it quickly.', 'Colore l’onglet de la feuille, pour la retrouver vite.'],
  'class.freeze': ['Keeps the top rows and left columns in view while you scroll, like the header of a long list.', 'Garde les premières lignes et colonnes visibles pendant le défilement, comme l’en-tête d’une longue liste.'],
  'class.gridlines': ['Shows or hides the grey lines between cells on screen. Whether they print is set in Page Layout › Print gridlines.', 'Affiche ou cache les lignes grises entre les cellules à l’écran. Leur impression se règle dans Mise en page › Imprimer le quadrillage.'],
  'class.headings': ['Shows or hides the column letters and row numbers.', 'Affiche ou cache les lettres de colonnes et les numéros de lignes.'],
  'class.zoom100': ['Goes back to the normal size (100 %).', 'Revient à la taille normale (100 %).'],
  'class.zoomSelection': ['Zooms so the selected cells fill the screen.', 'Zoome pour que les cellules choisies remplissent l’écran.'],

  // ---------- In 1 Class: Office In 1 ----------
  'class.sendToLetter': ['Puts the selected table into a Letter document, kept in step: change it here and the letter follows.', 'Met le tableau choisi dans une lettre, lié : modifiez-le ici et la lettre suit.'],
  'class.updateLetter': ['Sends the latest numbers to the letter that holds this table.', 'Envoie les derniers chiffres à la lettre qui contient ce tableau.'],
  'class.sendToStage': ['Makes a slide in In 1 Stage from the selected table.', 'Crée une diapositive In 1 Stage à partir du tableau choisi.'],
  'class.share': ['Shares the workbook by e-mail, messaging or any app on your device.', 'Partage le classeur par courriel, messagerie ou toute app de l’appareil.'],
  'tuto.app.*': ['Opens {name} in a new tab, next to this one.', 'Ouvre {name} dans un nouvel onglet, à côté de celui-ci.'],
  ...HELP_LETTER,
  ...HELP_STAGE,
  ...HELP_CODE,
  ...HELP_CONVERT,
  ...HELP_PRINT,
  ...HELP_DRAW,
  ...HELP_NOTES,
  ...HELP_PLAN,
};

/** The explanation of a control: its key's text, a family's text ("class.chart.*") with its name, or null. */
export function helpOf(key: string | undefined, name: string, lang: string): string | null {
  if (!key) return null;
  let entry = HELP[key];
  if (!entry) {
    const fam = Object.keys(HELP).find(k => k.endsWith('.*') && key.startsWith(k.slice(0, -1)));
    if (fam) entry = HELP[fam];
  }
  if (!entry) return null;
  return (lang === 'fr' ? entry[1] : entry[0]).replace('{name}', name);
}
