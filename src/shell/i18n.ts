// Interface languages. To add one: copy the `en` block, translate it, add it to LANGUAGES.
// Every language must have every key; TypeScript reports any that are missing.

const en = {
  'home.welcome': 'Welcome to Office In 1',
  'home.subtitle': 'One office for letters, sheets, slides, PDFs, notes, mail and more.',
  'home.openFile': 'Open a file',
  'home.soon': 'Coming soon',
  'tab.close': 'Close tab',
  'tab.new': 'New tab',
  'tab.confirmClose': 'Close this tab? Save the file first if you want to keep it.',
  'shell.home': 'Home',
  'shell.language': 'Language',
  'shell.cannotOpen': 'OI1 cannot open this kind of file yet:',

  'kind.letter': 'Documents',
  'kind.class': 'Spreadsheets',
  'kind.stage': 'Presentations',
  'kind.prodfos': 'PDF reader and tools',
  'kind.assistant': 'AI help in every app',
  'kind.notes': 'Quick notes',
  'kind.plan': 'Calendar and tasks',
  'kind.mail': 'Email',
  'kind.draw': 'Diagrams and sketches',
  'kind.form': 'Forms and surveys',

  'letter.untitled': 'Untitled letter',
  'letter.placeholder': 'Start writing…',
  'letter.new': 'New',
  'letter.open': 'Open',
  'letter.saveDocx': 'Save .docx',
  'letter.saveHtml': 'Save .html',
  'letter.pdf': 'PDF',
  'letter.pdfTitle': 'Save as PDF (choose “Save as PDF” in the print window)',
  'letter.bold': 'Bold',
  'letter.italic': 'Italic',
  'letter.underline': 'Underline',
  'letter.strike': 'Strikethrough',
  'letter.color': 'Text color',
  'letter.highlight': 'Highlight',
  'letter.normal': 'Normal text',
  'letter.heading1': 'Heading 1',
  'letter.heading2': 'Heading 2',
  'letter.heading3': 'Heading 3',
  'letter.bullets': 'Bullet list',
  'letter.numbers': 'Numbered list',
  'letter.quote': 'Quote',
  'letter.alignLeft': 'Align left',
  'letter.alignCenter': 'Center',
  'letter.alignRight': 'Align right',
  'letter.justify': 'Justify',
  'letter.table': 'Insert table',
  'letter.addRow': 'Add row',
  'letter.addColumn': 'Add column',
  'letter.deleteTable': 'Delete table',
  'letter.image': 'Insert image',
  'letter.link': 'Link',
  'letter.linkPrompt': 'Link address (leave empty to remove):',
  'letter.undo': 'Undo',
  'letter.redo': 'Redo',
  'letter.words': '{n} words',
  'letter.word': '1 word',
  'letter.openFailed': 'This file could not be opened:',

  'prodfos.note': 'ProDFos runs inside OI1 from its web version.',
  'prodfos.openWindow': 'Open in its own window',
};

export type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;

const fr: Messages = {
  'home.welcome': 'Bienvenue dans Office In 1',
  'home.subtitle': 'Un seul bureau pour les lettres, tableurs, présentations, PDF, notes, courriels et plus.',
  'home.openFile': 'Ouvrir un fichier',
  'home.soon': 'Bientôt',
  'tab.close': 'Fermer l’onglet',
  'tab.new': 'Nouvel onglet',
  'tab.confirmClose': 'Fermer cet onglet ? Enregistrez d’abord le fichier si vous voulez le garder.',
  'shell.home': 'Accueil',
  'shell.language': 'Langue',
  'shell.cannotOpen': 'OI1 ne peut pas encore ouvrir ce type de fichier :',

  'kind.letter': 'Documents',
  'kind.class': 'Tableurs',
  'kind.stage': 'Présentations',
  'kind.prodfos': 'Lecteur et outils PDF',
  'kind.assistant': 'Aide IA dans chaque appli',
  'kind.notes': 'Notes rapides',
  'kind.plan': 'Agenda et tâches',
  'kind.mail': 'Courriel',
  'kind.draw': 'Diagrammes et croquis',
  'kind.form': 'Formulaires et sondages',

  'letter.untitled': 'Lettre sans titre',
  'letter.placeholder': 'Commencez à écrire…',
  'letter.new': 'Nouveau',
  'letter.open': 'Ouvrir',
  'letter.saveDocx': 'Enregistrer .docx',
  'letter.saveHtml': 'Enregistrer .html',
  'letter.pdf': 'PDF',
  'letter.pdfTitle': 'Enregistrer en PDF (choisissez « Enregistrer au format PDF » dans la fenêtre d’impression)',
  'letter.bold': 'Gras',
  'letter.italic': 'Italique',
  'letter.underline': 'Souligné',
  'letter.strike': 'Barré',
  'letter.color': 'Couleur du texte',
  'letter.highlight': 'Surligner',
  'letter.normal': 'Texte normal',
  'letter.heading1': 'Titre 1',
  'letter.heading2': 'Titre 2',
  'letter.heading3': 'Titre 3',
  'letter.bullets': 'Liste à puces',
  'letter.numbers': 'Liste numérotée',
  'letter.quote': 'Citation',
  'letter.alignLeft': 'Aligner à gauche',
  'letter.alignCenter': 'Centrer',
  'letter.alignRight': 'Aligner à droite',
  'letter.justify': 'Justifier',
  'letter.table': 'Insérer un tableau',
  'letter.addRow': 'Ajouter une ligne',
  'letter.addColumn': 'Ajouter une colonne',
  'letter.deleteTable': 'Supprimer le tableau',
  'letter.image': 'Insérer une image',
  'letter.link': 'Lien',
  'letter.linkPrompt': 'Adresse du lien (laisser vide pour le retirer) :',
  'letter.undo': 'Annuler',
  'letter.redo': 'Rétablir',
  'letter.words': '{n} mots',
  'letter.word': '1 mot',
  'letter.openFailed': 'Ce fichier n’a pas pu être ouvert :',

  'prodfos.note': 'ProDFos fonctionne dans OI1 à partir de sa version web.',
  'prodfos.openWindow': 'Ouvrir dans sa propre fenêtre',
};

const es: Messages = {
  'home.welcome': 'Bienvenido a Office In 1',
  'home.subtitle': 'Una sola oficina para cartas, hojas de cálculo, presentaciones, PDF, notas, correo y más.',
  'home.openFile': 'Abrir un archivo',
  'home.soon': 'Próximamente',
  'tab.close': 'Cerrar pestaña',
  'tab.new': 'Nueva pestaña',
  'tab.confirmClose': '¿Cerrar esta pestaña? Guarda el archivo antes si quieres conservarlo.',
  'shell.home': 'Inicio',
  'shell.language': 'Idioma',
  'shell.cannotOpen': 'OI1 todavía no puede abrir este tipo de archivo:',

  'kind.letter': 'Documentos',
  'kind.class': 'Hojas de cálculo',
  'kind.stage': 'Presentaciones',
  'kind.prodfos': 'Lector y herramientas PDF',
  'kind.assistant': 'Ayuda de IA en cada app',
  'kind.notes': 'Notas rápidas',
  'kind.plan': 'Calendario y tareas',
  'kind.mail': 'Correo',
  'kind.draw': 'Diagramas y bocetos',
  'kind.form': 'Formularios y encuestas',

  'letter.untitled': 'Carta sin título',
  'letter.placeholder': 'Empieza a escribir…',
  'letter.new': 'Nuevo',
  'letter.open': 'Abrir',
  'letter.saveDocx': 'Guardar .docx',
  'letter.saveHtml': 'Guardar .html',
  'letter.pdf': 'PDF',
  'letter.pdfTitle': 'Guardar como PDF (elige «Guardar como PDF» en la ventana de impresión)',
  'letter.bold': 'Negrita',
  'letter.italic': 'Cursiva',
  'letter.underline': 'Subrayado',
  'letter.strike': 'Tachado',
  'letter.color': 'Color del texto',
  'letter.highlight': 'Resaltar',
  'letter.normal': 'Texto normal',
  'letter.heading1': 'Título 1',
  'letter.heading2': 'Título 2',
  'letter.heading3': 'Título 3',
  'letter.bullets': 'Lista con viñetas',
  'letter.numbers': 'Lista numerada',
  'letter.quote': 'Cita',
  'letter.alignLeft': 'Alinear a la izquierda',
  'letter.alignCenter': 'Centrar',
  'letter.alignRight': 'Alinear a la derecha',
  'letter.justify': 'Justificar',
  'letter.table': 'Insertar tabla',
  'letter.addRow': 'Añadir fila',
  'letter.addColumn': 'Añadir columna',
  'letter.deleteTable': 'Eliminar tabla',
  'letter.image': 'Insertar imagen',
  'letter.link': 'Enlace',
  'letter.linkPrompt': 'Dirección del enlace (déjala vacía para quitarlo):',
  'letter.undo': 'Deshacer',
  'letter.redo': 'Rehacer',
  'letter.words': '{n} palabras',
  'letter.word': '1 palabra',
  'letter.openFailed': 'No se pudo abrir este archivo:',

  'prodfos.note': 'ProDFos funciona dentro de OI1 desde su versión web.',
  'prodfos.openWindow': 'Abrir en su propia ventana',
};

const pt: Messages = {
  'home.welcome': 'Bem-vindo ao Office In 1',
  'home.subtitle': 'Um só escritório para cartas, planilhas, apresentações, PDF, notas, e-mail e mais.',
  'home.openFile': 'Abrir um arquivo',
  'home.soon': 'Em breve',
  'tab.close': 'Fechar aba',
  'tab.new': 'Nova aba',
  'tab.confirmClose': 'Fechar esta aba? Salve o arquivo antes se quiser mantê-lo.',
  'shell.home': 'Início',
  'shell.language': 'Idioma',
  'shell.cannotOpen': 'O OI1 ainda não abre este tipo de arquivo:',

  'kind.letter': 'Documentos',
  'kind.class': 'Planilhas',
  'kind.stage': 'Apresentações',
  'kind.prodfos': 'Leitor e ferramentas PDF',
  'kind.assistant': 'Ajuda de IA em cada app',
  'kind.notes': 'Notas rápidas',
  'kind.plan': 'Agenda e tarefas',
  'kind.mail': 'E-mail',
  'kind.draw': 'Diagramas e esboços',
  'kind.form': 'Formulários e pesquisas',

  'letter.untitled': 'Carta sem título',
  'letter.placeholder': 'Comece a escrever…',
  'letter.new': 'Novo',
  'letter.open': 'Abrir',
  'letter.saveDocx': 'Salvar .docx',
  'letter.saveHtml': 'Salvar .html',
  'letter.pdf': 'PDF',
  'letter.pdfTitle': 'Salvar como PDF (escolha “Salvar como PDF” na janela de impressão)',
  'letter.bold': 'Negrito',
  'letter.italic': 'Itálico',
  'letter.underline': 'Sublinhado',
  'letter.strike': 'Tachado',
  'letter.color': 'Cor do texto',
  'letter.highlight': 'Realçar',
  'letter.normal': 'Texto normal',
  'letter.heading1': 'Título 1',
  'letter.heading2': 'Título 2',
  'letter.heading3': 'Título 3',
  'letter.bullets': 'Lista com marcadores',
  'letter.numbers': 'Lista numerada',
  'letter.quote': 'Citação',
  'letter.alignLeft': 'Alinhar à esquerda',
  'letter.alignCenter': 'Centralizar',
  'letter.alignRight': 'Alinhar à direita',
  'letter.justify': 'Justificar',
  'letter.table': 'Inserir tabela',
  'letter.addRow': 'Adicionar linha',
  'letter.addColumn': 'Adicionar coluna',
  'letter.deleteTable': 'Excluir tabela',
  'letter.image': 'Inserir imagem',
  'letter.link': 'Link',
  'letter.linkPrompt': 'Endereço do link (deixe vazio para remover):',
  'letter.undo': 'Desfazer',
  'letter.redo': 'Refazer',
  'letter.words': '{n} palavras',
  'letter.word': '1 palavra',
  'letter.openFailed': 'Não foi possível abrir este arquivo:',

  'prodfos.note': 'O ProDFos funciona dentro do OI1 a partir da versão web.',
  'prodfos.openWindow': 'Abrir em uma janela própria',
};

const de: Messages = {
  'home.welcome': 'Willkommen bei Office In 1',
  'home.subtitle': 'Ein Büro für Briefe, Tabellen, Folien, PDFs, Notizen, E-Mail und mehr.',
  'home.openFile': 'Datei öffnen',
  'home.soon': 'Demnächst',
  'tab.close': 'Tab schließen',
  'tab.new': 'Neuer Tab',
  'tab.confirmClose': 'Diesen Tab schließen? Speichern Sie die Datei vorher, wenn Sie sie behalten möchten.',
  'shell.home': 'Start',
  'shell.language': 'Sprache',
  'shell.cannotOpen': 'OI1 kann diesen Dateityp noch nicht öffnen:',

  'kind.letter': 'Dokumente',
  'kind.class': 'Tabellen',
  'kind.stage': 'Präsentationen',
  'kind.prodfos': 'PDF-Reader und Werkzeuge',
  'kind.assistant': 'KI-Hilfe in jeder App',
  'kind.notes': 'Schnelle Notizen',
  'kind.plan': 'Kalender und Aufgaben',
  'kind.mail': 'E-Mail',
  'kind.draw': 'Diagramme und Skizzen',
  'kind.form': 'Formulare und Umfragen',

  'letter.untitled': 'Unbenannter Brief',
  'letter.placeholder': 'Schreiben Sie los…',
  'letter.new': 'Neu',
  'letter.open': 'Öffnen',
  'letter.saveDocx': '.docx speichern',
  'letter.saveHtml': '.html speichern',
  'letter.pdf': 'PDF',
  'letter.pdfTitle': 'Als PDF speichern (im Druckfenster „Als PDF speichern“ wählen)',
  'letter.bold': 'Fett',
  'letter.italic': 'Kursiv',
  'letter.underline': 'Unterstrichen',
  'letter.strike': 'Durchgestrichen',
  'letter.color': 'Textfarbe',
  'letter.highlight': 'Hervorheben',
  'letter.normal': 'Normaler Text',
  'letter.heading1': 'Überschrift 1',
  'letter.heading2': 'Überschrift 2',
  'letter.heading3': 'Überschrift 3',
  'letter.bullets': 'Aufzählung',
  'letter.numbers': 'Nummerierte Liste',
  'letter.quote': 'Zitat',
  'letter.alignLeft': 'Linksbündig',
  'letter.alignCenter': 'Zentriert',
  'letter.alignRight': 'Rechtsbündig',
  'letter.justify': 'Blocksatz',
  'letter.table': 'Tabelle einfügen',
  'letter.addRow': 'Zeile hinzufügen',
  'letter.addColumn': 'Spalte hinzufügen',
  'letter.deleteTable': 'Tabelle löschen',
  'letter.image': 'Bild einfügen',
  'letter.link': 'Link',
  'letter.linkPrompt': 'Linkadresse (leer lassen zum Entfernen):',
  'letter.undo': 'Rückgängig',
  'letter.redo': 'Wiederholen',
  'letter.words': '{n} Wörter',
  'letter.word': '1 Wort',
  'letter.openFailed': 'Diese Datei konnte nicht geöffnet werden:',

  'prodfos.note': 'ProDFos läuft in OI1 über seine Web-Version.',
  'prodfos.openWindow': 'In eigenem Fenster öffnen',
};

export const LANGUAGES = [
  { code: 'en', name: 'English', messages: en },
  { code: 'fr', name: 'Français', messages: fr },
  { code: 'es', name: 'Español', messages: es },
  { code: 'pt', name: 'Português', messages: pt },
  { code: 'de', name: 'Deutsch', messages: de },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'oi1:language';
const listeners = new Set<() => void>();

function detect(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGUAGES.some(l => l.code === saved)) return saved as LanguageCode;
  } catch { /* storage blocked */ }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.slice(0, 2).toLowerCase();
    if (LANGUAGES.some(l => l.code === base)) return base as LanguageCode;
  }
  return 'en';
}

let current: LanguageCode = detect();
document.documentElement.lang = current;

export function getLanguage(): LanguageCode {
  return current;
}

export function setLanguage(code: LanguageCode) {
  current = code;
  document.documentElement.lang = code;
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* storage blocked */ }
  listeners.forEach(fn => fn());
}

export function onLanguageChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const lang = LANGUAGES.find(l => l.code === current) ?? LANGUAGES[0];
  let text: string = lang.messages[key] ?? en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, String(v));
  return text;
}
