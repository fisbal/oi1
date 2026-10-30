// The Problems panel: a fast checker that runs as you type, in every file of the project, with no server.
// Each rule says what is wrong and why in plain words, and most carry a fix the programmer can accept or not.
// The rules are the mistakes the trade has paid for again and again: syntax, loose equality, secrets in code,
// XSS through innerHTML, images without alt text, missing viewport... (ESLint, OWASP Top 10, WCAG, PEP 8).

import { transform } from 'sucrase';
import { getLanguage, type LanguageCode } from '../../shell/i18n';
import { extOf, type Files, isBinary } from './build';

export type Severity = 'error' | 'warning' | 'info';
export interface Fix { from: number; to: number; insert: string }
export interface Problem {
  path: string; line: number; col: number; from: number; to: number;
  rule: string; severity: Severity; message: string; fix?: Fix;
}

type Words = Record<LanguageCode, string>;
type Lang = 'js' | 'html' | 'css' | 'json' | 'py' | 'any';
interface Hit { from: number; to: number; fix?: Fix }
export interface Rule {
  id: string; lang: Lang; severity: Severity;
  name: Words; why: Words;
  check: (text: string, masked: string, path: string) => Hit[];
}

const LANG_OF: Record<string, Lang> = {
  js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js', mts: 'js', tsx: 'js',
  html: 'html', htm: 'html', vue: 'html', svelte: 'html',
  css: 'css', scss: 'css', less: 'css', json: 'json', py: 'py',
};
export const langOf = (path: string): Lang | null => LANG_OF[extOf(path)] ?? null;

/** Blanks strings and comments (keeping every offset) so the rules only look at real code. */
export function maskCode(text: string, lang: Lang): string {
  const out = text.split('');
  const blank = (a: number, b: number) => { for (let i = a; i < b; i++) if (out[i] !== '\n') out[i] = ' '; };
  let i = 0;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if ((lang === 'js' || lang === 'css') && c === '/' && n === '*') {
      const end = text.indexOf('*/', i + 2); const e = end < 0 ? text.length : end + 2; blank(i, e); i = e;
    } else if (lang === 'js' && c === '/' && n === '/') {
      const end = text.indexOf('\n', i); const e = end < 0 ? text.length : end; blank(i, e); i = e;
    } else if (lang === 'py' && c === '#') {
      const end = text.indexOf('\n', i); const e = end < 0 ? text.length : end; blank(i, e); i = e;
    } else if (lang === 'html' && text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i); const e = end < 0 ? text.length : end + 3; blank(i, e); i = e;
    } else if ((lang === 'js' || lang === 'py' || lang === 'css') && (c === '"' || c === "'" || c === '`')) {
      let j = i + 1;
      while (j < text.length && text[j] !== c) { if (text[j] === '\\') j++; if (c !== '`' && text[j] === '\n') break; j++; }
      blank(i + 1, Math.min(j, text.length)); i = j + 1;
    } else i++;
  }
  return out.join('');
}

const all = (re: RegExp, s: string, f?: (m: RegExpExecArray) => Hit | null): Hit[] => {
  const hits: Hit[] = [];
  for (const m of s.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
    const hit = f ? f(m) : { from: m.index, to: m.index + m[0].length };
    if (hit) hits.push(hit);
  }
  return hits;
};
const w = (en: string, fr: string, es: string, pt: string, de: string): Words => ({ en, fr, es, pt, de });
const SECRET = /(sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*["'][^"'\s]{6,}["'])/i;

export const RULES: Rule[] = [
  { id: 'syntax', lang: 'js', severity: 'error',
    name: w('Syntax error', 'Erreur de syntaxe', 'Error de sintaxis', 'Erro de sintaxe', 'Syntaxfehler'),
    why: w('The code cannot run until this is fixed.', 'Le code ne peut pas tourner tant que ce n’est pas corrigé.', 'El código no puede ejecutarse hasta corregirlo.', 'O código não roda até corrigir isto.', 'Der Code läuft erst, wenn das behoben ist.'),
    check: (text, _m, path) => {
      const ext = extOf(path);
      const transforms: ('typescript' | 'jsx')[] = [];
      if (/^(ts|mts|tsx)$/.test(ext)) transforms.push('typescript');
      if (/^(jsx|tsx|js)$/.test(ext)) transforms.push('jsx');
      try { transform(text, { transforms, filePath: path, disableESTransforms: true }); return []; }
      catch (e) {
        const m = /\((\d+):(\d+)\)/.exec(String((e as Error).message));
        if (!m) return [{ from: 0, to: 0 }];
        const lines = text.split('\n');
        let from = 0; for (let i = 0; i < Number(m[1]) - 1 && i < lines.length; i++) from += lines[i].length + 1;
        from += Number(m[2]);
        return [{ from: Math.min(from, text.length), to: Math.min(from + 1, text.length) }];
      }
    } },
  { id: 'json-syntax', lang: 'json', severity: 'error',
    name: w('Invalid JSON', 'JSON invalide', 'JSON no válido', 'JSON inválido', 'Ungültiges JSON'),
    why: w('A missing comma or quote breaks the whole file.', 'Une virgule ou un guillemet manquant casse tout le fichier.', 'Una coma o comilla que falta rompe todo el archivo.', 'Uma vírgula ou aspa em falta quebra o arquivo.', 'Ein fehlendes Komma oder Anführungszeichen bricht die Datei.'),
    check: text => {
      if (!text.trim()) return [];
      try { JSON.parse(text); return []; } catch (e) {
        const pos = Number(/position (\d+)/.exec(String((e as Error).message))?.[1] ?? 0);
        return [{ from: Math.min(pos, text.length), to: Math.min(pos + 1, text.length) }];
      }
    } },
  { id: 'eqeqeq', lang: 'js', severity: 'warning',
    name: w('Use === instead of ==', 'Utiliser === au lieu de ==', 'Usa === en lugar de ==', 'Use === em vez de ==', '=== statt == verwenden'),
    why: w('== converts types first: 0 == "" is true. === compares exactly.', '== convertit les types : 0 == "" est vrai. === compare exactement.', '== convierte tipos: 0 == "" es true. === compara exacto.', '== converte tipos: 0 == "" é true. === compara exato.', '== wandelt Typen um: 0 == "" ist wahr. === vergleicht genau.'),
    check: (_t, m) => all(/[^=!<>]([!=])=(?!=)/, m, x => {
      const from = x.index + 1; return { from, to: from + 2, fix: { from, to: from + 2, insert: x[1] + '==' } };
    }) },
  { id: 'no-var', lang: 'js', severity: 'warning',
    name: w('Use let or const, not var', 'Utiliser let ou const, pas var', 'Usa let o const, no var', 'Use let ou const, não var', 'let oder const statt var'),
    why: w('var leaks out of blocks and loops, a classic source of bugs.', 'var déborde des blocs et des boucles, une source classique de bugs.', 'var se escapa de bloques y bucles, fuente clásica de errores.', 'var vaza de blocos e laços, fonte clássica de bugs.', 'var entweicht aus Blöcken und Schleifen, klassische Fehlerquelle.'),
    check: (_t, m) => all(/\bvar\s/, m, x => ({ from: x.index, to: x.index + 3, fix: { from: x.index, to: x.index + 3, insert: 'let' } })) },
  { id: 'no-debugger', lang: 'js', severity: 'warning',
    name: w('debugger left in the code', 'debugger oublié dans le code', 'debugger olvidado en el código', 'debugger esquecido no código', 'debugger im Code vergessen'),
    why: w('It stops the program for every visitor who has the dev tools open.', 'Il arrête le programme chez tout visiteur qui ouvre les outils.', 'Detiene el programa a quien abra las herramientas.', 'Para o programa para quem abrir as ferramentas.', 'Es hält das Programm bei offenen Entwicklertools an.'),
    check: (_t, m) => all(/\bdebugger\s*;?/, m, x => ({ from: x.index, to: x.index + x[0].length, fix: { from: x.index, to: x.index + x[0].length, insert: '' } })) },
  { id: 'no-console', lang: 'js', severity: 'info',
    name: w('console.log left in the code', 'console.log oublié dans le code', 'console.log olvidado', 'console.log esquecido', 'console.log vergessen'),
    why: w('Fine while testing; remove it before you publish.', 'Utile pour tester ; à retirer avant de publier.', 'Útil para probar; quítalo antes de publicar.', 'Útil para testar; remova antes de publicar.', 'Gut zum Testen; vor dem Veröffentlichen entfernen.'),
    check: (_t, m) => all(/\bconsole\.(log|debug)\b/, m) },
  { id: 'no-eval', lang: 'js', severity: 'error',
    name: w('eval() runs any text as code', 'eval() exécute n’importe quel texte', 'eval() ejecuta cualquier texto', 'eval() executa qualquer texto', 'eval() führt beliebigen Text aus'),
    why: w('An attacker who controls the text controls your page (OWASP A03, injection).', 'Qui contrôle le texte contrôle ta page (OWASP A03, injection).', 'Quien controla el texto controla tu página (OWASP A03).', 'Quem controla o texto controla sua página (OWASP A03).', 'Wer den Text steuert, steuert deine Seite (OWASP A03).'),
    check: (_t, m) => all(/\b(eval|new\s+Function)\s*\(/, m) },
  { id: 'no-implied-eval', lang: 'js', severity: 'warning',
    name: w('setTimeout with a string', 'setTimeout avec du texte', 'setTimeout con texto', 'setTimeout com texto', 'setTimeout mit Text'),
    why: w('A string here is run like eval. Pass a function instead.', 'Un texte ici est exécuté comme eval. Passe une fonction.', 'Un texto aquí se ejecuta como eval. Pasa una función.', 'Um texto aqui roda como eval. Passe uma função.', 'Text wird hier wie eval ausgeführt. Übergib eine Funktion.'),
    check: (t, m) => all(/\bset(Timeout|Interval)\s*\(\s*/, m, x => {
      const at = x.index + x[0].length; return /["'`]/.test(t[at] ?? '') ? { from: x.index, to: at } : null;
    }) },
  { id: 'no-inner-html', lang: 'js', severity: 'warning',
    name: w('innerHTML with outside text', 'innerHTML avec du texte extérieur', 'innerHTML con texto externo', 'innerHTML com texto externo', 'innerHTML mit fremdem Text'),
    why: w('If the text comes from a user, it can run scripts (XSS). Use textContent.', 'Si le texte vient d’un utilisateur, il peut lancer des scripts (XSS). Utilise textContent.', 'Si viene de un usuario puede ejecutar scripts (XSS). Usa textContent.', 'Se vier de um usuário pode rodar scripts (XSS). Use textContent.', 'Kommt der Text vom Nutzer, kann er Skripte ausführen (XSS). textContent nutzen.'),
    check: (_t, m) => all(/\.(innerHTML|outerHTML)\s*\+?=/, m) },
  { id: 'no-document-write', lang: 'js', severity: 'warning',
    name: w('document.write', 'document.write', 'document.write', 'document.write', 'document.write'),
    why: w('It can wipe the page and blocks loading. Build elements instead.', 'Il peut effacer la page et bloque le chargement. Crée des éléments.', 'Puede borrar la página y bloquea la carga.', 'Pode apagar a página e bloqueia o carregamento.', 'Kann die Seite löschen und blockiert das Laden.'),
    check: (_t, m) => all(/\bdocument\.write(ln)?\s*\(/, m) },
  { id: 'no-alert', lang: 'js', severity: 'info',
    name: w('alert() blocks the page', 'alert() bloque la page', 'alert() bloquea la página', 'alert() bloqueia a página', 'alert() blockiert die Seite'),
    why: w('A message on the page is kinder than a popup.', 'Un message dans la page est plus agréable qu’une fenêtre.', 'Un mensaje en la página es más amable.', 'Uma mensagem na página é mais gentil.', 'Eine Meldung auf der Seite ist freundlicher.'),
    check: (_t, m) => all(/(?<![.\w])alert\s*\(/, m) },
  { id: 'empty-catch', lang: 'js', severity: 'warning',
    name: w('Empty catch hides errors', 'Un catch vide cache les erreurs', 'Un catch vacío oculta errores', 'Um catch vazio esconde erros', 'Leeres catch versteckt Fehler'),
    why: w('The error vanishes and nobody knows why it fails. At least log it.', 'L’erreur disparaît et personne ne sait pourquoi ça échoue. Au moins, affiche-la.', 'El error desaparece. Al menos regístralo.', 'O erro some. Pelo menos registre-o.', 'Der Fehler verschwindet. Wenigstens protokollieren.'),
    check: (_t, m) => all(/catch\s*(\([^)]*\))?\s*\{\s*\}/, m) },
  { id: 'no-secrets', lang: 'any', severity: 'error',
    name: w('A secret is written in the code', 'Un secret est écrit dans le code', 'Hay un secreto en el código', 'Há um segredo no código', 'Ein Geheimnis steht im Code'),
    why: w('Anyone who sees the file or the site can use this key. Keep keys out of code (OWASP A07).', 'Quiconque voit le fichier ou le site peut utiliser cette clé. Garde les clés hors du code (OWASP A07).', 'Quien vea el archivo puede usar esta clave (OWASP A07).', 'Quem vir o arquivo pode usar esta chave (OWASP A07).', 'Wer die Datei sieht, kann den Schlüssel nutzen (OWASP A07).'),
    check: text => all(SECRET, text) },
  { id: 'no-http', lang: 'any', severity: 'warning',
    name: w('http:// link (not secure)', 'Lien http:// (non sécurisé)', 'Enlace http:// (no seguro)', 'Link http:// (inseguro)', 'http://-Link (unsicher)'),
    why: w('Browsers block or warn on http on an https site. Use https://.', 'Les navigateurs bloquent http sur un site https. Utilise https://.', 'Los navegadores bloquean http en un sitio https.', 'Navegadores bloqueiam http em site https.', 'Browser blockieren http auf https-Seiten.'),
    check: text => all(/http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|www\.w3\.org|schemas\.)[\w.-]+/, text, x => ({ from: x.index, to: x.index + 7, fix: { from: x.index, to: x.index + 7, insert: 'https://' } })) },
  { id: 'todo', lang: 'any', severity: 'info',
    name: w('TODO left to do', 'TODO à faire', 'TODO pendiente', 'TODO pendente', 'TODO offen'),
    why: w('A note you left yourself. Listed so it is not forgotten.', 'Une note laissée pour toi. Listée pour ne pas l’oublier.', 'Una nota para ti, listada para no olvidarla.', 'Uma nota sua, listada para não esquecer.', 'Eine Notiz an dich, damit sie nicht vergessen wird.'),
    check: text => all(/\b(TODO|FIXME|HACK|XXX)\b/, text) },
  { id: 'trailing-spaces', lang: 'any', severity: 'info',
    name: w('Spaces at the end of the line', 'Espaces en fin de ligne', 'Espacios al final de la línea', 'Espaços no fim da linha', 'Leerzeichen am Zeilenende'),
    why: w('Invisible, but they clutter every diff and review.', 'Invisibles, mais ils encombrent chaque comparaison.', 'Invisibles, pero ensucian cada diff.', 'Invisíveis, mas poluem cada diff.', 'Unsichtbar, aber sie stören jeden Diff.'),
    check: text => all(/[ \t]+$/m, text, x => ({ from: x.index, to: x.index + x[0].length, fix: { from: x.index, to: x.index + x[0].length, insert: '' } })) },
  { id: 'long-line', lang: 'any', severity: 'info',
    name: w('Line longer than 140 characters', 'Ligne de plus de 140 caractères', 'Línea de más de 140 caracteres', 'Linha com mais de 140 caracteres', 'Zeile über 140 Zeichen'),
    why: w('Long lines are hard to read on a phone or side by side.', 'Les lignes longues sont dures à lire sur téléphone ou côte à côte.', 'Difíciles de leer en el móvil.', 'Difíceis de ler no celular.', 'Schwer lesbar auf dem Handy.'),
    check: (text, _m, path) => (/\.(json|svg|min\.js)$/.test(path) ? [] : all(/^.{141,}$/m, text, x => ({ from: x.index + 140, to: x.index + x[0].length }))) },
  { id: 'html-lang', lang: 'html', severity: 'warning',
    name: w('<html> without lang', '<html> sans lang', '<html> sin lang', '<html> sem lang', '<html> ohne lang'),
    why: w('Screen readers and translators need the page language (WCAG 3.1.1).', 'Les lecteurs d’écran et traducteurs ont besoin de la langue (WCAG 3.1.1).', 'Los lectores de pantalla necesitan el idioma (WCAG 3.1.1).', 'Leitores de tela precisam do idioma (WCAG 3.1.1).', 'Screenreader brauchen die Sprache (WCAG 3.1.1).'),
    check: (_t, m) => all(/<html(?![^>]*\blang=)/i, m, x => ({ from: x.index, to: x.index + 5, fix: { from: x.index + 5, to: x.index + 5, insert: ' lang="en"' } })) },
  { id: 'img-alt', lang: 'html', severity: 'warning',
    name: w('Image without alt text', 'Image sans texte alt', 'Imagen sin texto alt', 'Imagem sem texto alt', 'Bild ohne alt-Text'),
    why: w('Blind visitors hear nothing, and search engines see nothing (WCAG 1.1.1).', 'Les visiteurs aveugles n’entendent rien, les moteurs ne voient rien (WCAG 1.1.1).', 'Las personas ciegas no oyen nada (WCAG 1.1.1).', 'Pessoas cegas não ouvem nada (WCAG 1.1.1).', 'Blinde hören nichts (WCAG 1.1.1).'),
    check: (_t, m) => all(/<img\b(?![^>]*\balt=)[^>]*>/i, m, x => ({ from: x.index, to: x.index + 4, fix: { from: x.index + 4, to: x.index + 4, insert: ' alt=""' } })) },
  { id: 'html-viewport', lang: 'html', severity: 'warning',
    name: w('No viewport for phones', 'Pas de viewport pour téléphone', 'Sin viewport para móviles', 'Sem viewport para celular', 'Kein Viewport für Handys'),
    why: w('Without it, phones show the page tiny and zoomed out.', 'Sans lui, les téléphones affichent la page minuscule.', 'Sin él, los móviles muestran la página diminuta.', 'Sem ele, o celular mostra a página minúscula.', 'Ohne ihn zeigen Handys die Seite winzig.'),
    check: (_t, m) => {
      const head = /<head[^>]*>/i.exec(m);
      return head && !/name=["']?viewport/i.test(m) ? [{ from: head.index, to: head.index + head[0].length, fix: { from: head.index + head[0].length, to: head.index + head[0].length, insert: '\n  <meta name="viewport" content="width=device-width, initial-scale=1">' } }] : [];
    } },
  { id: 'html-title', lang: 'html', severity: 'warning',
    name: w('Page without a title', 'Page sans titre', 'Página sin título', 'Página sem título', 'Seite ohne Titel'),
    why: w('The title shows in tabs, bookmarks and search results.', 'Le titre s’affiche dans les onglets, favoris et recherches.', 'El título aparece en pestañas y búsquedas.', 'O título aparece em abas e buscas.', 'Der Titel erscheint in Tabs und Suchergebnissen.'),
    check: (_t, m) => {
      const head = /<head[^>]*>/i.exec(m);
      return head && !/<title[\s>]/i.test(m) ? [{ from: head.index, to: head.index + head[0].length, fix: { from: head.index + head[0].length, to: head.index + head[0].length, insert: '\n  <title>Page</title>' } }] : [];
    } },
  { id: 'blank-noopener', lang: 'html', severity: 'warning',
    name: w('target="_blank" without rel="noopener"', 'target="_blank" sans rel="noopener"', 'target="_blank" sin rel="noopener"', 'target="_blank" sem rel="noopener"', 'target="_blank" ohne rel="noopener"'),
    why: w('The opened page could take control of yours (tabnabbing).', 'La page ouverte pourrait prendre le contrôle de la tienne (tabnabbing).', 'La página abierta podría controlar la tuya.', 'A página aberta poderia controlar a sua.', 'Die geöffnete Seite könnte deine steuern.'),
    check: (_t, m) => all(/<a\b(?![^>]*\brel=)[^>]*target=["']?_blank[^>]*>/i, m, x => ({ from: x.index, to: x.index + 2, fix: { from: x.index + 2, to: x.index + 2, insert: ' rel="noopener"' } })) },
  { id: 'button-type', lang: 'html', severity: 'info',
    name: w('<button> without type', '<button> sans type', '<button> sin type', '<button> sem type', '<button> ohne type'),
    why: w('Inside a form a button submits it by default, often by surprise.', 'Dans un formulaire, un bouton l’envoie par défaut, souvent par surprise.', 'En un formulario lo envía por defecto.', 'Num formulário ele envia por padrão.', 'In Formularen sendet er standardmäßig ab.'),
    check: (_t, m) => all(/<button\b(?![^>]*\btype=)/i, m, x => ({ from: x.index, to: x.index + 7, fix: { from: x.index + 7, to: x.index + 7, insert: ' type="button"' } })) },
  { id: 'css-important', lang: 'css', severity: 'info',
    name: w('!important', '!important', '!important', '!important', '!important'),
    why: w('It wins over everything, so the next change needs another !important.', 'Il écrase tout, et la modification suivante en demande un autre.', 'Gana a todo y la siguiente regla necesitará otro.', 'Vence tudo e a próxima regra precisará de outro.', 'Es gewinnt immer, die nächste Regel braucht wieder eins.'),
    check: (_t, m) => all(/!important/, m) },
  { id: 'css-empty', lang: 'css', severity: 'info',
    name: w('Empty CSS rule', 'Règle CSS vide', 'Regla CSS vacía', 'Regra CSS vazia', 'Leere CSS-Regel'),
    why: w('It does nothing; remove it.', 'Elle ne fait rien ; retire-la.', 'No hace nada; quítala.', 'Não faz nada; remova.', 'Sie tut nichts; entfernen.'),
    check: (_t, m) => all(/[^{}]+\{\s*\}/, m, x => ({ from: x.index, to: x.index + x[0].length, fix: { from: x.index, to: x.index + x[0].length, insert: '' } })) },
  { id: 'css-px-font', lang: 'css', severity: 'info',
    name: w('Font size in px', 'Taille de police en px', 'Tamaño de fuente en px', 'Tamanho de fonte em px', 'Schriftgröße in px'),
    why: w('rem follows the reader’s own text size setting (WCAG 1.4.4).', 'rem suit la taille de texte choisie par le lecteur (WCAG 1.4.4).', 'rem respeta el tamaño elegido por el lector.', 'rem respeita o tamanho escolhido pelo leitor.', 'rem folgt der Textgröße des Lesers.'),
    check: (_t, m) => all(/font-size\s*:\s*(\d+(?:\.\d+)?)px/, m, x => {
      const at = x.index + x[0].length - x[1].length - 2; const rem = +(Number(x[1]) / 16).toFixed(3);
      return { from: at, to: at + x[1].length + 2, fix: { from: at, to: at + x[1].length + 2, insert: `${rem}rem` } };
    }) },
  { id: 'py-bare-except', lang: 'py', severity: 'warning',
    name: w('Bare except:', 'except: sans type', 'except: sin tipo', 'except: sem tipo', 'except: ohne Typ'),
    why: w('It also catches Ctrl+C and typos. Name the error, at least Exception (PEP 8).', 'Il attrape aussi Ctrl+C et les fautes de frappe. Nomme l’erreur, au moins Exception (PEP 8).', 'Atrapa también Ctrl+C. Nombra la excepción (PEP 8).', 'Pega até Ctrl+C. Nomeie a exceção (PEP 8).', 'Fängt auch Strg+C. Benenne die Ausnahme (PEP 8).'),
    check: (_t, m) => all(/\bexcept\s*:/, m, x => ({ from: x.index, to: x.index + x[0].length, fix: { from: x.index, to: x.index + x[0].length, insert: 'except Exception:' } })) },
  { id: 'py-none', lang: 'py', severity: 'warning',
    name: w('Use "is None", not "== None"', 'Utiliser « is None », pas « == None »', 'Usa "is None", no "== None"', 'Use "is None", não "== None"', '"is None" statt "== None"'),
    why: w('== can be changed by a class; is always checks for None itself (PEP 8).', '== peut être modifié par une classe ; is vérifie vraiment None (PEP 8).', '== puede cambiarlo una clase; is no (PEP 8).', '== pode ser alterado por uma classe; is não (PEP 8).', '== kann eine Klasse ändern; is nicht (PEP 8).'),
    check: (_t, m) => all(/(==|!=)\s*None\b/, m, x => ({ from: x.index, to: x.index + x[0].length, fix: { from: x.index, to: x.index + x[0].length, insert: x[1] === '==' ? 'is None' : 'is not None' } })) },
  { id: 'py-mixed-indent', lang: 'py', severity: 'warning',
    name: w('Tabs and spaces mixed', 'Tabulations et espaces mélangés', 'Tabulaciones y espacios mezclados', 'Tabs e espaços misturados', 'Tabs und Leerzeichen gemischt'),
    why: w('Python reads indentation as code; mixing them breaks blocks. Use 4 spaces.', 'Python lit l’indentation comme du code ; les mélanger casse les blocs. Utilise 4 espaces.', 'Python lee la sangría como código. Usa 4 espacios.', 'Python lê a indentação como código. Use 4 espaços.', 'Python liest Einrückung als Code. 4 Leerzeichen nutzen.'),
    check: text => all(/^( +\t|\t+ )[ \t]*/m, text, x => ({ from: x.index, to: x.index + x[0].length, fix: { from: x.index, to: x.index + x[0].length, insert: x[0].replace(/\t/g, '    ') } })) },
  { id: 'final-newline', lang: 'any', severity: 'info',
    name: w('No new line at the end of the file', 'Pas de retour à la ligne final', 'Sin salto de línea final', 'Sem quebra de linha final', 'Kein Zeilenumbruch am Ende'),
    why: w('Git and many tools expect one; without it diffs show a warning.', 'Git et beaucoup d’outils l’attendent ; sinon les comparaisons avertissent.', 'Git lo espera; sin él los diffs avisan.', 'Git espera um; sem ele os diffs avisam.', 'Git erwartet einen; sonst warnen Diffs.'),
    check: text => (text.length && !text.endsWith('\n') ? [{ from: text.length, to: text.length, fix: { from: text.length, to: text.length, insert: '\n' } }] : []) },
];

const words = (x: Words) => x[getLanguage()] ?? x.en;
export const ruleName = (r: Rule) => words(r.name);
export const ruleWhy = (r: Rule) => words(r.why);
export const ruleById = (id: string) => RULES.find(r => r.id === id);

/** Rules turned off by the programmer, kept on this device. */
const OFF_KEY = 'oi1.code.rulesOff';
export function rulesOff(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(OFF_KEY) ?? '[]') as string[]); } catch { return new Set(); }
}
export function setRuleOff(id: string, off: boolean) {
  const s = rulesOff(); if (off) s.add(id); else s.delete(id);
  try { localStorage.setItem(OFF_KEY, JSON.stringify([...s])); } catch { /* private window */ }
}

const ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
const MAX_SIZE = 400_000;

export function lintFile(path: string, text: string, off: Set<string> = new Set()): Problem[] {
  const lang = langOf(path);
  if (isBinary(text) || text.length > MAX_SIZE || /(^|\/)(node_modules|dist|vendor)\/|\.min\./.test(path)) return [];
  const known = lang ?? 'any';
  const masked = lang ? maskCode(text, lang) : text;
  const starts = [0]; for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const lineOf = (pos: number) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; };
  const out: Problem[] = [];
  for (const r of RULES) {
    if (off.has(r.id) || (r.lang !== 'any' && r.lang !== known)) continue;
    if (r.lang === 'any' && !lang && !/\.(md|txt|ya?ml|toml|env|sh|ini|xml|svg)$/i.test(path)) continue;
    for (const h of r.check(text, masked, path)) {
      const line = lineOf(h.from);
      out.push({ path, line: line + 1, col: h.from - starts[line] + 1, from: h.from, to: Math.max(h.to, h.from), rule: r.id, severity: r.severity, message: ruleName(r), fix: h.fix });
    }
  }
  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.from - b.from);
}

export function lintProject(files: Files, off: Set<string> = rulesOff()): Problem[] {
  return Object.keys(files).sort().flatMap(p => lintFile(p, files[p], off));
}

/** Applies fixes (from the end, so offsets stay right); overlapping ones are left for the next pass. */
export function applyFixes(text: string, fixes: Fix[]): string {
  let out = text, last = Infinity;
  for (const f of [...fixes].sort((a, b) => b.from - a.from)) {
    if (f.to > last) continue;
    out = out.slice(0, f.from) + f.insert + out.slice(f.to); last = f.from;
  }
  return out;
}
