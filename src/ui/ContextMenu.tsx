// The right-click menu of every Office In 1 app (rule: more than copy and paste everywhere). First made for In 1 Class (Martin, 2026-11-06: "en faisant un clic droit dans Class j'ai un menu quasiment nul par
// rapport à Excel alors qu'Office In 1 devrait avoir mieux"). Everything Excel's cell menu has (cut, copy, paste and its
// options, insert, delete, clear, sort, filter, format, merge, link…) plus a search box, quick analysis of the selection and
// the copilot on the selection. It opens on a right click, on a long press on phones, and with Shift+F10 or the menu key.
// Sub-lists open in place (no flyout leaving the screen on a phone).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './kit';
import { getLanguage } from '../shell/i18n';

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  keys?: string;
  run?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** A list that opens in place under the item. */
  sub?: MenuItem[];
}
/** A section; `row` shows its items as a row of icons (the paste options). */
export interface MenuSection { items: MenuItem[]; row?: boolean; title?: string }

export function ContextMenu({ at, sections, onClose, label }: { at: { x: number; y: number }; sections: MenuSection[]; onClose: () => void; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [pos, setPos] = useState({ left: at.x, top: at.y, maxHeight: 0 });
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const vw = Math.min(document.documentElement.clientWidth, window.visualViewport?.width ?? Infinity);
    const vh = Math.min(window.innerHeight, document.documentElement.clientHeight || Infinity, window.visualViewport?.height ?? Infinity);
    const maxHeight = vh - 16;
    const h = Math.min(r.height, maxHeight);
    // Beside the pointer, flipped when it would leave the screen; never off the edges.
    const left = Math.max(8, Math.min(at.x + r.width + 8 > vw ? at.x - r.width : at.x, vw - r.width - 8));
    const top = Math.max(8, Math.min(at.y + h + 8 > vh ? at.y - h : at.y, vh - h - 8));
    setPos({ left, top, maxHeight });
  }, [at.x, at.y]);
  useEffect(() => {
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const id = window.setTimeout(() => { document.addEventListener('pointerdown', away, true); window.addEventListener('blur', onClose); });
    window.addEventListener('resize', onClose);
    return () => { window.clearTimeout(id); document.removeEventListener('pointerdown', away, true); window.removeEventListener('blur', onClose); window.removeEventListener('resize', onClose); };
  }, [onClose]);
  useEffect(() => {
    // The first item gets the focus, so the arrow keys work at once (the search box takes typing).
    // On a touch screen the search box waits for a tap, so the on-screen keyboard does not jump up over the menu.
    const fine = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
    (fine ? ref.current?.querySelector<HTMLElement>('.cm-search input') : ref.current)?.focus({ preventScroll: true });
  }, []);

  const found = useMemo(() => {
    const words = q.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    if (!words) return null;
    const out: MenuItem[] = [];
    const walk = (items: MenuItem[], path: string) => {
      for (const it of items) {
        const name = `${path}${it.label}`;
        if (it.run && name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes(words)) out.push({ ...it, label: name });
        if (it.sub) walk(it.sub, `${it.label} › `);
      }
    };
    for (const s of sections) walk(s.items, s.title ? `${s.title} › ` : '');
    return out;
  }, [q, sections]);

  const pick = (it: MenuItem) => {
    if (it.disabled) return;
    if (it.sub) { setOpen(o => (o === it.id ? null : it.id)); return; }
    onClose();
    it.run?.();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    // Typing anywhere in the menu goes to the search box.
    const input = ref.current?.querySelector<HTMLInputElement>('.cm-search input');
    if (input && e.target !== input && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setQ(v => v + e.key); input.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const all = [...(ref.current?.querySelectorAll<HTMLElement>('.cm-item:not(:disabled), .cm-search input') ?? [])];
    const i = all.indexOf(document.activeElement as HTMLElement);
    all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus();
  };
  const item = (it: MenuItem, depth = 0) => (
    <div key={it.id} role="none">
      <button type="button" role="menuitem" className={`cm-item${it.danger ? ' danger' : ''}${open === it.id ? ' open' : ''}`} disabled={it.disabled}
        aria-expanded={it.sub ? open === it.id : undefined} data-id={it.id} style={depth ? { paddingLeft: 12 + depth * 22 } : undefined} onClick={() => pick(it)}>
        <span className="cm-icon" aria-hidden="true">{it.icon && <Icon name={it.icon} size={16} />}</span>
        <span className="cm-label">{it.label}</span>
        {it.keys && <kbd>{it.keys}</kbd>}
        {it.sub && <span className="cm-caret" aria-hidden="true">{open === it.id ? '▾' : '▸'}</span>}
      </button>
      {it.sub && open === it.id && <div className="cm-sub" role="group">{it.sub.map(s => item(s, depth + 1))}</div>}
    </div>
  );
  return createPortal(
    <div ref={ref} tabIndex={-1} className="cell-menu" role="menu" aria-label={label ?? cm('title')} style={{ left: pos.left, top: pos.top, maxHeight: pos.maxHeight || undefined }}
      onKeyDown={onKey} onContextMenu={e => e.preventDefault()} translate="no">
      <label className="cm-search"><Icon name="search" size={14} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={cm('search')} aria-label={cm('search')} spellCheck={false}
          onKeyDown={e => { if (e.key === 'Enter' && found?.[0]) { e.preventDefault(); pick(found[0]); } }} />
      </label>
      {found ? (
        found.length ? <div className="cm-section">{found.slice(0, 30).map(it => item(it))}</div> : <p className="cm-none">{cm('none')}</p>
      ) : sections.map((s, i) => (
        <div key={i} className={`cm-section${s.row ? ' cm-row' : ''}`} role={s.row ? 'group' : undefined} aria-label={s.title}>
          {s.title && <span className="cm-title">{s.title}</span>}
          {s.row
            ? <div className="cm-row-items">{s.items.map(it => (
                <button key={it.id} type="button" role="menuitem" className="cm-item cm-tile" disabled={it.disabled} data-id={it.id}
                  title={it.label} aria-label={it.label} onClick={() => pick(it)}>
                  {it.icon && <Icon name={it.icon} size={18} />}<small>{it.label.split(' : ').pop()}</small>
                </button>))}</div>
            : s.items.map(it => item(it))}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ---------- words (5 languages; kept here so the big i18n file stays untouched) ----------
type L = 'en' | 'fr' | 'es' | 'pt' | 'de';
const S: Record<string, [string, string, string, string, string]> = {
  title: ['Cell menu', 'Menu des cellules', 'Menú de celdas', 'Menu de células', 'Zellmenü'],
  search: ['Search the menu…', 'Rechercher dans le menu…', 'Buscar en el menú…', 'Pesquisar no menu…', 'Menü durchsuchen…'],
  none: ['Nothing found.', 'Rien trouvé.', 'Nada encontrado.', 'Nada encontrado.', 'Nichts gefunden.'],
  cut: ['Cut', 'Couper', 'Cortar', 'Recortar', 'Ausschneiden'],
  copy: ['Copy', 'Copier', 'Copiar', 'Copiar', 'Kopieren'],
  paste: ['Paste', 'Coller', 'Pegar', 'Colar', 'Einfügen'],
  pasteOptions: ['Paste options', 'Options de collage', 'Opciones de pegado', 'Opções de colagem', 'Einfügeoptionen'],
  pAll: ['Paste: everything', 'Coller : tout', 'Pegar: todo', 'Colar: tudo', 'Einfügen: alles'],
  pValues: ['Paste: values', 'Coller : valeurs', 'Pegar: valores', 'Colar: valores', 'Einfügen: Werte'],
  pFormulas: ['Paste: formulas', 'Coller : formules', 'Pegar: fórmulas', 'Colar: fórmulas', 'Einfügen: Formeln'],
  pFormats: ['Paste: formatting', 'Coller : mise en forme', 'Pegar: formato', 'Colar: formatação', 'Einfügen: Format'],
  pTranspose: ['Paste: transposed', 'Coller : transposé', 'Pegar: transponer', 'Colar: transpor', 'Einfügen: transponiert'],
  pText: ['Paste: plain text', 'Coller : texte brut', 'Pegar: texto sin formato', 'Colar: texto simples', 'Einfügen: nur Text'],
  insert: ['Insert', 'Insérer', 'Insertar', 'Inserir', 'Einfügen'],
  rowAbove: ['Row above', 'Ligne au-dessus', 'Fila arriba', 'Linha acima', 'Zeile oberhalb'],
  rowBelow: ['Row below', 'Ligne en dessous', 'Fila abajo', 'Linha abaixo', 'Zeile unterhalb'],
  colLeft: ['Column to the left', 'Colonne à gauche', 'Columna a la izquierda', 'Coluna à esquerda', 'Spalte links'],
  colRight: ['Column to the right', 'Colonne à droite', 'Columna a la derecha', 'Coluna à direita', 'Spalte rechts'],
  delete: ['Delete', 'Supprimer', 'Eliminar', 'Excluir', 'Löschen'],
  delRows: ['Whole rows', 'Lignes entières', 'Filas enteras', 'Linhas inteiras', 'Ganze Zeilen'],
  delCols: ['Whole columns', 'Colonnes entières', 'Columnas enteras', 'Colunas inteiras', 'Ganze Spalten'],
  clear: ['Clear contents', 'Effacer le contenu', 'Borrar contenido', 'Limpar conteúdo', 'Inhalte löschen'],
  clearFormats: ['Clear formatting', 'Effacer la mise en forme', 'Borrar formato', 'Limpar formatação', 'Formate löschen'],
  clearAll: ['Clear everything', 'Tout effacer', 'Borrar todo', 'Limpar tudo', 'Alles löschen'],
  sort: ['Sort', 'Trier', 'Ordenar', 'Classificar', 'Sortieren'],
  sortAz: ['Smallest to largest (A → Z)', 'Du plus petit au plus grand (A → Z)', 'De menor a mayor (A → Z)', 'Do menor para o maior (A → Z)', 'Aufsteigend (A → Z)'],
  sortZa: ['Largest to smallest (Z → A)', 'Du plus grand au plus petit (Z → A)', 'De mayor a menor (Z → A)', 'Do maior para o menor (Z → A)', 'Absteigend (Z → A)'],
  filter: ['Filter', 'Filtrer', 'Filtrar', 'Filtrar', 'Filtern'],
  filterOn: ['Turn the filter on or off', 'Activer ou retirer le filtre', 'Activar o quitar el filtro', 'Ligar ou tirar o filtro', 'Filter ein/aus'],
  dedupe: ['Remove duplicates', 'Supprimer les doublons', 'Quitar duplicados', 'Remover duplicados', 'Duplikate entfernen'],
  fillDown: ['Fill down', 'Recopier vers le bas', 'Rellenar hacia abajo', 'Preencher para baixo', 'Nach unten ausfüllen'],
  fillRight: ['Fill right', 'Recopier à droite', 'Rellenar a la derecha', 'Preencher para a direita', 'Nach rechts ausfüllen'],
  format: ['Number format', 'Format des nombres', 'Formato de número', 'Formato de número', 'Zahlenformat'],
  bold: ['Bold', 'Gras', 'Negrita', 'Negrito', 'Fett'],
  italic: ['Italic', 'Italique', 'Cursiva', 'Itálico', 'Kursiv'],
  wrap: ['Wrap text', 'Renvoyer à la ligne', 'Ajustar texto', 'Quebrar texto', 'Textumbruch'],
  merge: ['Merge and center', 'Fusionner et centrer', 'Combinar y centrar', 'Mesclar e centralizar', 'Verbinden und zentrieren'],
  unmerge: ['Unmerge', 'Annuler la fusion', 'Separar celdas', 'Desfazer mesclagem', 'Verbund aufheben'],
  fitCol: ['Fit column width', 'Ajuster la largeur de colonne', 'Autoajustar ancho', 'Ajustar largura da coluna', 'Spaltenbreite anpassen'],
  painter: ['Copy formatting (painter)', 'Reproduire la mise en forme', 'Copiar formato', 'Pincel de formatação', 'Format übertragen'],
  sum: ['AutoSum', 'Somme automatique', 'Autosuma', 'AutoSoma', 'AutoSumme'],
  chart: ['Make a chart', 'Créer un graphique', 'Crear un gráfico', 'Criar um gráfico', 'Diagramm erstellen'],
  send: ['Send to', 'Envoyer vers', 'Enviar a', 'Enviar para', 'Senden an'],
  toLetter: ['In 1 Letter (table)', 'In 1 Letter (tableau)', 'In 1 Letter (tabla)', 'In 1 Letter (tabela)', 'In 1 Letter (Tabelle)'],
  toStage: ['In 1 Stage (slide)', 'In 1 Stage (diapositive)', 'In 1 Stage (diapositiva)', 'In 1 Stage (slide)', 'In 1 Stage (Folie)'],
  ai: ['Copilot on the selection', 'Copilote sur la sélection', 'Copiloto sobre la selección', 'Copiloto na seleção', 'Copilot für die Auswahl'],
  aiExplain: ['Explain the formula', 'Expliquer la formule', 'Explicar la fórmula', 'Explicar a fórmula', 'Formel erklären'],
  aiFix: ['Fix the formula', 'Corriger la formule', 'Corregir la fórmula', 'Corrigir a fórmula', 'Formel korrigieren'],
  aiAnalyze: ['Analyze the data', 'Analyser les données', 'Analizar los datos', 'Analisar os dados', 'Daten analysieren'],
  aiClean: ['Clean the table', 'Nettoyer le tableau', 'Limpiar la tabla', 'Limpar a tabela', 'Tabelle bereinigen'],
  aiFill: ['Complete the empty cells', 'Compléter les cellules vides', 'Completar las celdas vacías', 'Completar as células vazias', 'Leere Zellen ergänzen'],
  textFmt: ['Text', 'Texte', 'Texto', 'Texto', 'Text'],
  para: ['Paragraph', 'Paragraphe', 'Párrafo', 'Parágrafo', 'Absatz'],
  tbl: ['Table', 'Tableau', 'Tabla', 'Tabela', 'Tabelle'],
  linkOpen: ['Open the link', 'Ouvrir le lien', 'Abrir el vínculo', 'Abrir o link', 'Link öffnen'],
  linkEdit: ['Edit the link', 'Modifier le lien', 'Editar el vínculo', 'Editar o link', 'Link bearbeiten'],
  linkRemove: ['Remove the link', 'Supprimer le lien', 'Quitar el vínculo', 'Remover o link', 'Link entfernen'],
  web: ['Search the web for “{v}”', 'Rechercher « {v} » sur le web', 'Buscar «{v}» en la web', 'Pesquisar “{v}” na web', '„{v}“ im Web suchen'],
  words: ['{w} words · {c} characters', '{w} mots · {c} caractères', '{w} palabras · {c} caracteres', '{w} palavras · {c} caracteres', '{w} Wörter · {c} Zeichen'],
  review: ['Review', 'Révision', 'Revisar', 'Revisão', 'Überprüfen'],
  aiCorrect: ['Correct the text', 'Corriger le texte', 'Corregir el texto', 'Corrigir o texto', 'Text korrigieren'],
  aiRewrite: ['Rewrite…', 'Reformuler…', 'Reescribir…', 'Reescrever…', 'Umschreiben…'],
  aiSummary: ['Summarize', 'Résumer', 'Resumir', 'Resumir', 'Zusammenfassen'],
  aiTranslate: ['Translate…', 'Traduire…', 'Traducir…', 'Traduzir…', 'Übersetzen…'],
  aiContinue: ['Continue writing', 'Continuer l’écriture', 'Seguir escribiendo', 'Continuar a escrever', 'Weiterschreiben'],
  quick: ['Quick analysis', 'Analyse rapide', 'Análisis rápido', 'Análise rápida', 'Schnellanalyse'],
  qSum: ['Sum: {v}', 'Somme : {v}', 'Suma: {v}', 'Soma: {v}', 'Summe: {v}'],
  qAvg: ['Average: {v}', 'Moyenne : {v}', 'Promedio: {v}', 'Média: {v}', 'Mittelwert: {v}'],
  qCount: ['Count: {v}', 'Nombre : {v}', 'Recuento: {v}', 'Contagem: {v}', 'Anzahl: {v}'],
  qMin: ['Min: {v}', 'Min : {v}', 'Mín: {v}', 'Mín: {v}', 'Min: {v}'],
  qMax: ['Max: {v}', 'Max : {v}', 'Máx: {v}', 'Máx: {v}', 'Max: {v}'],
  qCopy: ['(click to copy the value)', '(clic pour copier la valeur)', '(clic para copiar el valor)', '(clique para copiar o valor)', '(Klick kopiert den Wert)'],
  pasteBlocked: ['The browser did not let Office In 1 read the clipboard. Use Ctrl+V (⌘V on a Mac) to paste.', 'Le navigateur n’a pas laissé Office In 1 lire le presse-papiers. Utilisez Ctrl+V (⌘V sur Mac) pour coller.', 'El navegador no dejó a Office In 1 leer el portapapeles. Use Ctrl+V (⌘V en Mac) para pegar.', 'O navegador não deixou o Office In 1 ler a área de transferência. Use Ctrl+V (⌘V no Mac) para colar.', 'Der Browser hat Office In 1 die Zwischenablage nicht lesen lassen. Mit Strg+V (⌘V am Mac) einfügen.'],
};
export function cm(k: string, vars: Record<string, string | number> = {}): string {
  const row = S[k];
  if (!row) return k;
  const i = (['en', 'fr', 'es', 'pt', 'de'] as L[]).indexOf(getLanguage().slice(0, 2) as L);
  let s = row[i < 0 ? 0 : i];
  for (const [n, v] of Object.entries(vars)) s = s.split(`{${n}}`).join(String(v));
  return s;
}
export const CM_KEYS = Object.keys(S);
