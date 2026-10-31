// Tuto explanations for Office Stage. [English, French]: what it does, then how to use it.
import type { HelpText } from './help';

export const HELP_STAGE: Record<string, HelpText> = {
  // Home
  'stage.duplicate': ['Makes a copy of the selected slide (or shape) right after it, to start the next one from it.', 'Fait une copie de la diapositive (ou de la forme) choisie juste après elle, pour partir d’elle pour la suivante.'],
  'stage.newSlide': ['Adds a slide after the current one. The arrow lets you choose its layout first (title, two columns, picture…).', 'Ajoute une diapositive après celle-ci. La flèche permet d’abord de choisir sa disposition (titre, deux colonnes, image…).'],
  'stage.layoutGallery': ['Shows every slide layout with a picture of each: click one to add a new slide with that layout.', 'Montre toutes les dispositions avec leur aperçu : cliquez-en une pour ajouter une diapositive ainsi disposée.'],
  'stage.layout': ['Changes the arrangement of the current slide (title only, title and content, comparison…) and keeps its text.', 'Change la disposition de la diapositive actuelle (titre seul, titre et contenu, comparaison…) en gardant son texte.'],
  'stage.reset': ['Puts the placeholders of the slide back in their place and size from the layout, without losing the text.', 'Remet les zones de la diapositive à leur place et taille d’origine, sans perdre le texte.'],
  'stage.deleteSlide': ['Removes the current slide. Undo (Ctrl+Z) brings it back.', 'Supprime la diapositive actuelle. Annuler (Ctrl+Z) la fait revenir.'],
  'stage.vTop': ['Puts the text at the top of its box.', 'Place le texte en haut de sa zone.'],
  'stage.vMiddle': ['Centres the text between the top and the bottom of its box.', 'Centre le texte entre le haut et le bas de sa zone.'],
  'stage.vBottom': ['Puts the text at the bottom of its box.', 'Place le texte en bas de sa zone.'],
  'stage.shapes': ['Opens the shapes (rectangles, arrows, stars, callouts…). Pick one, then click or drag on the slide to draw it.', 'Ouvre les formes (rectangles, flèches, étoiles, bulles…). Choisissez-en une puis cliquez ou glissez sur la diapositive.'],
  'stage.fill': ['Colours the inside of the selected shape. “No fill” leaves only its outline.', 'Colore l’intérieur de la forme choisie. « Aucun remplissage » ne garde que son contour.'],
  'stage.outline': ['Sets the colour, thickness and dashes of the selected shape’s outline.', 'Règle la couleur, l’épaisseur et les tirets du contour de la forme choisie.'],
  'stage.arrange': ['Puts the selected shape in front of or behind the others, aligns several shapes or spaces them evenly.', 'Place la forme devant ou derrière les autres, aligne plusieurs formes ou les espace également.'],
  // Insert
  'stage.fromClass': ['Puts a table from an open Office Class sheet on the slide. Choose the sheet in the list.', 'Met sur la diapositive un tableau d’une feuille Office Class ouverte. Choisissez la feuille dans la liste.'],
  'stage.textBox': ['Adds a free box of text. Click where it goes, then type.', 'Ajoute une zone de texte libre. Cliquez à l’endroit voulu puis tapez.'],
  'stage.wordart': ['Adds a decorative title (shadow, gradient, outline…). Pick a style, then type your words.', 'Ajoute un titre décoratif (ombre, dégradé, contour…). Choisissez un style puis tapez vos mots.'],
  'stage.diagrams': ['Adds a ready diagram: steps, cycle, pyramid, timeline, comparison… Then change its texts.', 'Ajoute un diagramme prêt : étapes, cycle, pyramide, frise, comparaison… Changez ensuite ses textes.'],
  'stage.qr': ['Adds a QR code for a web address: the audience scans it with their phone to open the link.', 'Ajoute un QR code pour une adresse web : le public le scanne avec son téléphone pour ouvrir le lien.'],
  'stage.slideNumbers': ['Shows the number of each slide in its corner, on every slide.', 'Affiche le numéro de chaque diapositive dans son coin, sur toutes les diapositives.'],
  'stage.footer': ['Writes the same small text (date, event, name) at the bottom of every slide.', 'Écrit le même petit texte (date, événement, nom) en bas de chaque diapositive.'],
  // Design
  'stage.theme.*': ['Dresses every slide with the “{name}” theme: background, colours and fonts. Your text does not move.', 'Habille toutes les diapositives avec le thème « {name} » : fond, couleurs et polices. Votre texte ne bouge pas.'],
  'stage.audience': ['Adapts the whole presentation to who will watch it (children, investors, students…): words, amount of text, tone, size of letters and notes. Then keep it or go back.', 'Adapte toute la présentation au public (enfants, investisseurs, étudiants…) : mots, quantité de texte, ton, taille des lettres et notes. Ensuite gardez ou revenez en arrière.'],
  'stage.slideSize': ['Chooses the shape of the slides: wide (16:9, screens) or standard (4:3, older projectors).', 'Choisit la forme des diapositives : large (16:9, écrans) ou standard (4:3, anciens projecteurs).'],
  'stage.background': ['Changes the background of the slide: a colour, a gradient or a picture, for this slide or all of them.', 'Change le fond de la diapositive : une couleur, un dégradé ou une image, pour celle-ci ou toutes.'],
  // Transitions and animations
  'stage.speed': ['How fast the change to this slide plays: slow, medium or fast.', 'La vitesse du passage à cette diapositive : lente, moyenne ou rapide.'],
  'stage.applyAll': ['Uses this slide’s transition for every slide of the presentation.', 'Utilise la transition de cette diapositive pour toutes les diapositives.'],
  'stage.preview': ['Plays the transition once, to see how it looks.', 'Joue la transition une fois, pour voir le rendu.'],
  'stage.anim.start': ['When the animation starts: on a click, with the one before, or right after it.', 'Quand l’animation démarre : au clic, avec la précédente, ou juste après.'],
  'stage.anim.by': ['Whether text appears all at once, one paragraph at a time, or word by word.', 'Si le texte apparaît d’un coup, paragraphe par paragraphe, ou mot par mot.'],
  'stage.anim.dir': ['The side the object comes from or leaves to (left, top, right, bottom).', 'Le côté par où l’objet arrive ou s’en va (gauche, haut, droite, bas).'],
  'stage.anim.dur': ['How long the animation lasts, in seconds. Type a value and press Enter.', 'La durée de l’animation, en secondes. Tapez une valeur puis Entrée.'],
  'stage.anim.delay': ['Waits this many seconds before the animation starts.', 'Attend ce nombre de secondes avant que l’animation démarre.'],
  'stage.anim.order': ['Lists the animations of the slide in the order they play; move one up or down to change the order.', 'Liste les animations de la diapositive dans leur ordre ; montez-en ou descendez-en une pour changer l’ordre.'],
  'stage.anim.removeSel': ['Takes the animation off the selected object.', 'Enlève l’animation de l’objet choisi.'],
  'stage.sticker.emoji': ['Adds an animated emoji (a waving hand, a heart, a rocket…) to liven up the slide.', 'Ajoute un émoji animé (main qui salue, cœur, fusée…) pour animer la diapositive.'],
  'stage.sticker.words': ['Adds an animated word like “Hello”, “Thank you” or “Bravo”, in many languages.', 'Ajoute un mot animé comme « Bonjour », « Merci » ou « Bravo », en plusieurs langues.'],
  'stage.sticker.ai': ['Describe a sticker in words and the copilot makes it, animated.', 'Décrivez un autocollant en mots et le copilote le crée, animé.'],
  'stage.anim.auto': ['Gives the slide tasteful animations by itself: titles first, then the points one by one.', 'Donne seul des animations soignées à la diapositive : le titre d’abord, puis les points un par un.'],
  'stage.anim.more': ['Opens all the entrance, emphasis, exit and motion effects.', 'Ouvre tous les effets d’entrée, d’accentuation, de sortie et de trajectoire.'],
  'stage.anim.preview': ['Plays the animations of this slide once.', 'Joue une fois les animations de cette diapositive.'],
  // Slide show
  'stage.fromStart': ['Starts the slide show from the first slide (F5). Arrows or a click go on; Esc stops.', 'Lance le diaporama depuis la première diapositive (F5). Flèches ou clic pour avancer ; Échap pour arrêter.'],
  'stage.fromCurrent': ['Starts the slide show from the slide you are on (Shift+F5).', 'Lance le diaporama depuis la diapositive actuelle (Maj+F5).'],
  'stage.presenter': ['Shows the slide to the audience and, for you, the next slide, your notes and a timer.', 'Montre la diapositive au public et, pour vous, la suivante, vos notes et un chronomètre.'],
  'stage.hideSlide': ['Skips this slide during the show; it stays in the file. Click again to show it.', 'Saute cette diapositive pendant le diaporama ; elle reste dans le fichier. Recliquez pour la montrer.'],
  // View
  'stage.notes': ['Shows or hides the notes under the slide: what you want to say, seen only by you.', 'Affiche ou cache les notes sous la diapositive : ce que vous voulez dire, vu par vous seul.'],
  'stage.fit': ['Zooms so the whole slide fits the window.', 'Zoome pour que toute la diapositive tienne dans la fenêtre.'],
  // Office In 1
  'stage.toLetter': ['Writes the outline of the presentation (titles, points and notes) into a Letter document.', 'Écrit le plan de la présentation (titres, points et notes) dans un document Letter.'],
  'stage.tableToClass': ['Opens the selected table in Office Class to work on its numbers, then bring it back.', 'Ouvre le tableau choisi dans Office Class pour travailler ses chiffres, puis le ramener.'],
};
