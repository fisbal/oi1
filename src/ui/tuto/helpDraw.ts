// Tuto explanations for Office Draw. [English, French]: what it does, then how to use it.
import type { HelpText } from './help';

export const HELP_DRAW: Record<string, HelpText> = {
  // Home: tools
  'draw.tool.select': ['Picks shapes to move, resize or change. Click one, Shift+click to add more, or drag a box around several (V).', 'Choisit des formes pour les déplacer, les agrandir ou les changer. Cliquez-en une, Maj+clic pour en ajouter, ou tracez un cadre autour de plusieurs (V).'],
  'draw.tool.hand': ['Moves the page under the screen without changing anything (H). On a phone, two fingers also pinch to zoom.', 'Fait glisser la page sous l’écran sans rien changer (H). Sur un téléphone, deux doigts pincent aussi pour zoomer.'],
  'draw.tool.pen': ['Draws free hand lines with the line colour and width (P). Draw a circle, a box or a line, then “Tidy” makes it clean.', 'Dessine à main levée avec la couleur et l’épaisseur du trait (P). Dessinez un cercle, un carré ou un trait, puis « Nettoyer » le rend net.'],
  'draw.tool.marker': ['Draws thick lines, like a felt pen, for big drawings and children (M).', 'Dessine des traits épais, comme un feutre, pour les grands dessins et les enfants (M).'],
  'draw.tool.highlighter': ['Draws see-through yellow (or the chosen colour) over things to make them stand out (I).', 'Passe une couleur transparente (jaune ou la couleur choisie) par-dessus pour faire ressortir (I).'],
  'draw.tool.eraser': ['Removes what you touch: drag over the lines and shapes to erase them (E). Undo brings them back.', 'Efface ce que vous touchez : glissez sur les traits et formes à enlever (E). Annuler les fait revenir.'],
  'draw.tool.line': ['Draws a straight line: drag from start to end (L). Hold Shift for a straight or 45° line.', 'Trace un trait droit : glissez du début à la fin (L). Maintenez Maj pour un trait droit ou à 45°.'],
  'draw.tool.arrow': ['Draws an arrow from where you press to where you let go (A), to link boxes or point at something.', 'Trace une flèche de l’endroit où vous appuyez jusqu’où vous relâchez (A), pour relier des cases ou montrer quelque chose.'],
  'draw.tool.shape': ['Draws the chosen shape (rectangle by default) by dragging (R). A simple click puts one of a usual size. Hold Shift for a perfect square or circle.', 'Dessine la forme choisie (rectangle par défaut) en glissant (R). Un simple clic en pose une de taille normale. Maj donne un carré ou un cercle parfait.'],
  'draw.tool.text': ['Puts a box of text in the middle of the page, ready to type. Double-click any text or shape later to change its words (T).', 'Pose une zone de texte au milieu de la page, prête à taper. Double-cliquez plus tard sur un texte ou une forme pour changer ses mots (T).'],
  'draw.duplicate': ['Makes a copy of the selection, a little to the side (Ctrl+D).', 'Fait une copie de la sélection, un peu décalée (Ctrl+D).'],
  'draw.delete': ['Removes the selected shapes (Delete key). Undo brings them back.', 'Supprime les formes choisies (touche Suppr). Annuler les fait revenir.'],
  // Home: colours, line
  'draw.fill': ['Colours the inside of the selected shapes, or of the next ones you draw. “No fill” keeps only the outline.', 'Colore l’intérieur des formes choisies, ou des prochaines. « Sans remplissage » garde seulement le contour.'],
  'draw.stroke': ['Sets the colour of lines, outlines and pens, and the colour of the text.', 'Règle la couleur des traits, des contours et des stylos, et la couleur du texte.'],
  'draw.width': ['Makes lines and outlines thinner or thicker, from 1 to 64 pixels.', 'Rend les traits et contours plus fins ou plus épais, de 1 à 64 pixels.'],
  'draw.dash.solid': ['Makes the line or outline one continuous stroke.', 'Rend le trait ou le contour continu.'],
  'draw.dash.dash': ['Makes the line or outline dashed, for a border to cut or a possible path.', 'Met le trait ou le contour en tirets, pour un pointillé à découper ou un chemin possible.'],
  'draw.dash.dot': ['Makes the line or outline dotted.', 'Met le trait ou le contour en pointillés.'],
  'draw.opacity': ['Makes the selection more or less see-through, from 5 % to 100 %.', 'Rend la sélection plus ou moins transparente, de 5 % à 100 %.'],
  // Insert
  'draw.shapes': ['Opens 20+ shapes and lines: rectangles, circles, stars, hearts, arrows, callouts… Pick one, then drag on the page.', 'Ouvre plus de 20 formes et traits : rectangles, cercles, étoiles, cœurs, flèches, bulles… Choisissez-en une puis glissez sur la page.'],
  'draw.picture': ['Adds a picture from your device. You can also paste one (Ctrl+V) or drop it on the page.', 'Ajoute une image de votre appareil. Vous pouvez aussi en coller une (Ctrl+V) ou la déposer sur la page.'],
  'draw.stickers': ['Adds a big emoji sticker (smileys, stars, hearts, animals, objects). Resize it with the corners like any shape.', 'Ajoute un grand autocollant emoji (visages, étoiles, cœurs, animaux, objets). Agrandissez-le par ses coins comme une forme.'],
  'draw.templates': ['Adds a ready drawing made of real shapes: flowchart, mind map, org chart, timeline, floor plan, card, Gantt… Then change its words and colours.', 'Ajoute un dessin prêt fait de vraies formes : organigramme, carte mentale, frise, plan de maison, carte, Gantt… Changez ensuite ses mots et couleurs.'],
  // Arrange
  'draw.front': ['Puts the selection in front of everything else.', 'Place la sélection devant tout le reste.'],
  'draw.forward': ['Moves the selection one step to the front.', 'Avance la sélection d’un cran.'],
  'draw.backward': ['Moves the selection one step to the back.', 'Recule la sélection d’un cran.'],
  'draw.back': ['Puts the selection behind everything else, like a background.', 'Place la sélection derrière tout le reste, comme un fond.'],
  'draw.align.left': ['Lines up the selected shapes on their left edges (one shape: on the page’s left edge).', 'Aligne les formes choisies sur leur bord gauche (une seule forme : sur le bord gauche de la page).'],
  'draw.align.center': ['Lines up the selected shapes on the same vertical middle (one shape: centres it on the page).', 'Aligne les formes choisies sur le même milieu vertical (une seule forme : la centre sur la page).'],
  'draw.align.right': ['Lines up the selected shapes on their right edges.', 'Aligne les formes choisies sur leur bord droit.'],
  'draw.align.top': ['Lines up the selected shapes on their top edges.', 'Aligne les formes choisies sur leur bord du haut.'],
  'draw.align.middle': ['Lines up the selected shapes on the same horizontal middle.', 'Aligne les formes choisies sur le même milieu horizontal.'],
  'draw.align.bottom': ['Lines up the selected shapes on their bottom edges.', 'Aligne les formes choisies sur leur bord du bas.'],
  'draw.distributeH': ['Puts the same space between three or more selected shapes, from left to right.', 'Met le même espace entre trois formes choisies ou plus, de gauche à droite.'],
  'draw.distributeV': ['Puts the same space between three or more selected shapes, from top to bottom.', 'Met le même espace entre trois formes choisies ou plus, de haut en bas.'],
  'draw.rotateRight': ['Turns the selection a quarter turn to the right. The round handle above a shape turns it freely.', 'Tourne la sélection d’un quart de tour à droite. La poignée ronde au-dessus d’une forme la tourne librement.'],
  'draw.rotateLeft': ['Turns the selection a quarter turn to the left.', 'Tourne la sélection d’un quart de tour à gauche.'],
  'draw.flipH': ['Turns the selection over from left to right, like in a mirror.', 'Retourne la sélection de gauche à droite, comme dans un miroir.'],
  'draw.flipV': ['Turns the selection upside down.', 'Retourne la sélection la tête en bas.'],
  'draw.layers': ['Shows the list of every shape, the front one first: click to select, the eye hides or shows, the lock stops it from moving.', 'Affiche la liste de toutes les formes, celle de devant en premier : cliquez pour choisir, l’œil cache ou montre, le cadenas l’empêche de bouger.'],
  'draw.lock': ['Locks the selected shapes so a click or a drag cannot move them, for a background or a frame.', 'Verrouille les formes choisies pour qu’un clic ou un glissement ne les bouge pas, pour un fond ou un cadre.'],
  'draw.unlock': ['Unlocks the selected shapes so they can be moved and changed again.', 'Déverrouille les formes choisies pour pouvoir de nouveau les bouger et les changer.'],
  'draw.selectAll': ['Selects every visible shape (Ctrl+A), to move or recolour everything at once.', 'Sélectionne toutes les formes visibles (Ctrl+A), pour tout déplacer ou recolorer d’un coup.'],
  // Design
  'draw.pageSize': ['Chooses the page: 16:9 screen, A4, Letter, poster, business card, Instagram, YouTube thumbnail… The drawing is fitted into it.', 'Choisit la page : écran 16:9, A4, Lettre, affiche, carte de visite, Instagram, miniature YouTube… Le dessin s’y adapte.'],
  'draw.turnPage': ['Turns the page between portrait and landscape.', 'Tourne la page entre portrait et paysage.'],
  'draw.paper': ['Puts lines under the drawing: squares, dots, lined, isometric, music staff, blueprint, chalkboard… It is not erased by the eraser.', 'Met un fond de papier sous le dessin : carreaux, points, lignes, isométrique, portées, plan bleu, tableau noir… La gomme ne l’efface pas.'],
  'draw.background': ['Colours the whole page.', 'Colore toute la page.'],
  'draw.palettes': ['Recolours the whole drawing with a matching set of colours (sunset, ocean, forest, office…) in one click.', 'Recolore tout le dessin avec un jeu de couleurs assorties (coucher de soleil, océan, forêt, bureau…) en un clic.'],
  // AI
  'draw.aiDraw': ['Say what to draw (“a house with a garden”, “how to make tea as a flowchart”): the AI draws real shapes you can move and change.', 'Dites quoi dessiner (« une maison avec un jardin », « faire du thé en organigramme ») : l’IA dessine de vraies formes que vous pouvez bouger et changer.'],
  'draw.tidy': ['Turns sketched circles, boxes, triangles and lines into clean shapes, without internet. Select the sketches first (or none: it tidies all).', 'Transforme les cercles, carrés, triangles et traits dessinés à la main en formes nettes, sans internet. Choisissez d’abord les croquis (ou rien : tout est nettoyé).'],
  'draw.aiIdeas': ['Opens the copilot to ask for ideas to improve the drawing or to explain it.', 'Ouvre le copilote pour demander des idées pour améliorer le dessin ou pour l’expliquer.'],
  // View
  'draw.actualSize': ['Shows the drawing at its real size (100 %).', 'Affiche le dessin à sa taille réelle (100 %).'],
  'draw.snap': ['Makes shapes jump to a grid of 20 when moved and turns jump by 15°, for neat drawings.', 'Fait sauter les formes sur une grille de 20 quand on les bouge et les rotations de 15°, pour des dessins nets.'],
  // Office In 1
  'draw.toLetter': ['Opens a new Office Letter with the drawing inside as a picture.', 'Ouvre une nouvelle Office Letter avec le dessin dedans, en image.'],
};
