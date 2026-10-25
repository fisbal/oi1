// Office Letter's ribbon: Word's tabs (File, Home, Insert, Layout, Review, View, Table) plus what Word lacks:
// Design themes, a Smart tab with one-click tools, an Office In 1 tab that links Letter to every other app,
// and a command search that finds any command by name.

import { useEditorState, type Editor } from '@tiptap/react';
import { useState } from 'react';
import { t, type MessageKey } from '../../shell/i18n';
import { BULLET_CHARS, BULLET_STYLES, NUMBER_STYLES, type Borders, type NumberStyle } from './extensions';
import { FONT_GROUPS, FONT_SIZES, STYLE_IDS, cssFont, previewStyle, type DocStyles, type StyleId } from './model';
import { MARGIN_PRESETS, PAGE_SIZES, PX_PER_IN, WATERMARKS, isDark, pageInches, type MarginPresetId, type PageSettings, type PageSizeId } from './page';
import type { AppInfo, TabInfo } from '../../shell/contract';
import { Btn, ColorGrid, Combo, Drop, Group, Icon, MenuItem, NumberBox, type ComboGroup } from '../../ui/kit';
import { TABLE_STYLES, applyTableStyle, type CalloutKind, type CleanUp, type TableStyleId } from './smart';
import { SPACING, THEMES, type SpacingId, type Theme } from './themes';

export type Zoom = number | 'width' | 'page';

const NUMBER_SAMPLES: Record<NumberStyle, string[]> = {
  decimal: ['1.', '2.'], 'decimal-paren': ['1)', '2)'], 'lower-alpha': ['a.', 'b.'], 'upper-alpha': ['A.', 'B.'], 'lower-roman': ['i.', 'ii.'], 'upper-roman': ['I.', 'II.'],
};

const RECENT_FONTS = 'oi1.recentFonts';
function recentFonts(): string[] {
  try { return (JSON.parse(localStorage.getItem(RECENT_FONTS) ?? '[]') as string[]).slice(0, 5); } catch { return []; }
}
function rememberFont(f: string) {
  try { localStorage.setItem(RECENT_FONTS, JSON.stringify([f, ...recentFonts().filter(x => x !== f)].slice(0, 5))); } catch { /* private window */ }
}

export interface ViewState {
  layout: 'print' | 'web';
  zoom: Zoom;
  marks: boolean;
  spell: boolean;
}

export interface RibbonActions {
  fileMenu: () => void;
  paste: () => void;
  pasteText: () => void;
  image: () => void;
  replaceImage: () => void;
  link: () => void;
  find: (replace: boolean) => void;
  header: () => void;
  footer: () => void;
  pageNumber: (where: 'top' | 'bottom' | 'here', withTotal: boolean) => void;
  wordCount: () => void;
  customMargins: () => void;
  painter: () => void;
  // Beyond Word
  commandSearch: () => void;
  dictate: () => void;
  readAloud: () => void;
  outline: () => void;
  focus: () => void;
  theme: (theme: Theme) => void;
  spacing: (id: SpacingId) => void;
  toc: () => void;
  callout: (kind: CalloutKind) => void;
  letterBlock: (kind: 'full' | 'closing') => void;
  qr: () => void;
  cleanUp: (what: CleanUp) => void;
  sort: (dir: 1 | -1) => void;
  textToTable: () => void;
  tableToText: () => void;
  // Links with the other apps
  editInClass: () => void;
  insertFromSheet: (tabId: string | null) => void;
  newSheet: () => void;
  openApp: (id: string) => void;
  share: () => void;
  pdf: () => void;
  // Review and References
  newComment: () => void;
  deleteComment: () => void;
  comment: (dir: 1 | -1) => void;
  toggleComments: () => void;
  track: () => void;
  markup: () => void;
  accept: (all: boolean) => void;
  reject: (all: boolean) => void;
  change: (dir: 1 | -1) => void;
  footnote: () => void;
  editFootnote: () => void;
  nextFootnote: () => void;
}

/** What the ribbon shows about the rest of the suite. */
export interface SuiteState {
  apps: AppInfo[];
  sheets: TabInfo[];
  dictating: boolean;
  speaking: boolean;
  outline: boolean;
  linkedTable: boolean;
  themeId: string | null;
  tracking: boolean;
  markup: boolean;
  commentsOpen: boolean;
  commentHere: boolean;
  changeHere: boolean;
  changes: number;
  footnoteHere: boolean;
  footnotes: number;
}

const TABS = ['home', 'insert', 'design', 'layout', 'references', 'review', 'view', 'smart'] as const;
type TabId = (typeof TABS)[number] | 'oi1' | 'table' | 'picture';

const STYLE_KEYS: Record<StyleId, MessageKey> = {
  normal: 'letter.style.normal', title: 'letter.style.title', subtitle: 'letter.style.subtitle', quote: 'letter.style.quote',
  h1: 'letter.heading1', h2: 'letter.heading2', h3: 'letter.heading3', h4: 'letter.style.h4', h5: 'letter.style.h5', h6: 'letter.style.h6',
};
const GALLERY: StyleId[] = ['normal', 'title', 'subtitle', 'h1', 'h2', 'h3', 'h4', 'quote'];

const SYMBOLS = '©®™€£¥¢§¶†‡•·–—…‰′″°±×÷≈≠≤≥∞√∑πΩµ←→↑↓↔✓✗★☆♥♦♣♠«»‹›„“”‘’¿¡'.split('');
const LANGS = ['en-US', 'en-GB', 'fr-FR', 'fr-CA', 'es-ES', 'es-MX', 'pt-PT', 'pt-BR', 'de-DE', 'it-IT', 'nl-NL'];

/** Inches for US paper sizes, centimeters everywhere else, like Word. */
export function unitFor(page: PageSettings): 'in' | 'cm' {
  return page.size === 'letter' || page.size === 'legal' || page.size === 'executive' ? 'in' : 'cm';
}
const fromPt = (pt: number, unit: 'in' | 'cm') => Math.round((unit === 'in' ? pt / 72 : (pt / 72) * 2.54) * 100) / 100;
const toPt = (v: number, unit: 'in' | 'cm') => (unit === 'in' ? v * 72 : (v / 2.54) * 72);

export function currentStyleId(e: Editor): StyleId {
  for (let level = 1; level <= 6; level++) if (e.isActive('heading', { level })) return `h${level}` as StyleId;
  const id = e.getAttributes('paragraph').styleId as StyleId | null;
  return id && STYLE_IDS.includes(id) ? id : 'normal';
}

function applyStyle(e: Editor, id: StyleId) {
  const c = e.chain().focus();
  if (id.startsWith('h')) c.setHeading({ level: Number(id.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  else if (id === 'normal') c.setParagraph().updateAttributes('paragraph', { styleId: null }).run();
  else c.setParagraphStyle(id).run();
}

function changeCase(e: Editor, mode: 'sentence' | 'lower' | 'upper' | 'title' | 'toggle') {
  const { from, to } = e.state.selection;
  if (from === to) return;
  const tr = e.state.tr;
  let first = true;
  e.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.text.length);
    const text = node.text.slice(start - pos, end - pos);
    let out = text;
    if (mode === 'lower') out = text.toLowerCase();
    else if (mode === 'upper') out = text.toUpperCase();
    else if (mode === 'toggle') out = [...text].map(ch => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())).join('');
    else if (mode === 'title') out = text.toLowerCase().replace(/(^|[\s(“"'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
    else {
      out = text.toLowerCase().replace(/(^|[.!?]\s+)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
      if (first) out = out.replace(/\p{L}/u, ch => ch.toUpperCase());
    }
    first = false;
    if (out !== text) tr.replaceWith(start, end, e.state.schema.text(out, node.marks));
  });
  e.view.dispatch(tr);
}

export function Ribbon({ editor, body, styles, page, setPage, lang, setLang, view, setView, actions, suite }: {
  editor: Editor; body: Editor; styles: DocStyles; page: PageSettings; setPage: (p: PageSettings) => void;
  lang: string; setLang: (l: string) => void; view: ViewState; setView: (v: Partial<ViewState>) => void; actions: RibbonActions;
  suite: SuiteState;
}) {
  const [tab, setTab] = useState<TabId>('home');
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes('textStyle');
      const para = { ...e.getAttributes('paragraph'), ...(e.isActive('heading') ? e.getAttributes('heading') : {}) };
      return {
        bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'),
        sub: e.isActive('subscript'), sup: e.isActive('superscript'),
        bullets: e.isActive('bulletList'), numbers: e.isActive('orderedList'),
        bulletStyle: (e.getAttributes('bulletList').listStyle as string | null) ?? null,
        numberStyle: (e.getAttributes('orderedList').listStyle as string | null) ?? null,
        align: (['left', 'center', 'right', 'justify'] as const).find(a => e.isActive({ textAlign: a })) ?? null,
        link: e.isActive('link'), inTable: e.isActive('table'), inImage: e.isActive('image'),
        imageAlt: (e.getAttributes('image').alt as string) || '',
        canUndo: e.can().undo(), canRedo: e.can().redo(),
        font: (ts.fontFamily as string) || '', size: (ts.fontSize as string) || '', color: (ts.color as string) || null,
        highlight: (e.getAttributes('highlight').color as string) || null,
        style: currentStyleId(e),
        lineHeight: (para.lineHeight as string) || null,
        spaceBefore: para.spaceBefore as number | null, spaceAfter: para.spaceAfter as number | null,
        indentLeft: (para.indentLeft as number) ?? 0, indentRight: (para.indentRight as number) ?? 0,
        background: (para.background as string) || null,
      };
    },
  });
  const run = () => editor.chain().focus();
  /** Makes the paragraph a list of that kind if needed, then gives the list its bullet shape or number format. */
  const setListStyle = (type: 'bulletList' | 'orderedList', style: string) => {
    if (!editor.isActive(type)) run()[type === 'bulletList' ? 'toggleBulletList' : 'toggleOrderedList']().run();
    const def = type === 'bulletList' ? 'disc' : 'decimal';
    run().updateAttributes(type, { listStyle: style === def ? null : style }).run();
  };
  const isBody = editor === body;
  const shownTab: TabId = (tab === 'table' && !s.inTable) || (tab === 'picture' && !s.inImage) ? 'home' : tab;
  const def = { ...styles.normal, ...styles[s.style] };
  const fontShown = (s.font || def.font || styles.normal.font || 'Calibri').split(',')[0].replace(/"/g, '');
  const sizeShown = s.size ? parseFloat(s.size) : (def.size ?? styles.normal.size ?? 11);
  const unit = unitFor(page);
  const docFonts = [...new Set([...Object.values(styles).map(d => d.font).filter((f): f is string => !!f), fontShown])].sort((a, b) => a.localeCompare(b));
  const fontGroups: ComboGroup[] = [
    { label: t('letter.fonts.document'), items: docFonts },
    ...(recentFonts().length ? [{ label: t('letter.fonts.recent'), items: recentFonts() }] : []),
    ...FONT_GROUPS.map(g => ({ label: t(`letter.fonts.${g.kind}` as MessageKey), items: g.fonts })),
  ];

  const setSize = (pt: number) => { if (pt > 0 && pt < 1638) run().setFontSize(`${pt}pt`).run(); };
  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? FONT_SIZES.find(n => n > sizeShown) ?? sizeShown + 10 : [...FONT_SIZES].reverse().find(n => n < sizeShown) ?? Math.max(1, sizeShown - 1);
    setSize(next);
  };
  const clearFormatting = () => run().unsetAllMarks().clearNodes().setParagraph()
    .setParagraphFormat({ lineHeight: null, spaceBefore: null, spaceAfter: null, indentLeft: null, indentRight: null, indentFirst: null, background: null, borders: null })
    .updateAttributes('paragraph', { styleId: null, textAlign: null }).run();
  const indent = (dir: 1 | -1) => {
    if (s.bullets || s.numbers) { if (dir > 0) run().sinkListItem('listItem').run(); else run().liftListItem('listItem').run(); return; }
    run().setParagraphFormat({ indentLeft: Math.max(0, (s.indentLeft || 0) + 36 * dir) || null }).run();
  };
  const borderColor = styles.normal.color ?? (isDark(page.color) ? '#FFFFFF' : '#000000');
  const setBorders = (b: Borders | null) => run().setParagraphFormat({ borders: b }).run();
  const line = { w: 0.75, color: borderColor, space: 1 };
  const box = { w: 0.75, color: borderColor, space: 4 };

  const tabLabel: Record<Exclude<TabId, 'oi1'>, MessageKey> = {
    home: 'letter.tab.home', insert: 'letter.tab.insert', design: 'letter.tab.design', layout: 'letter.tab.layout', review: 'letter.tab.review',
    references: 'letter.tab.references', view: 'letter.tab.view', smart: 'letter.tab.smart', table: 'letter.tab.table', picture: 'letter.tab.picture',
  };
  const contentWidthPx = (pageInches(page).width - page.margins.left - page.margins.right) * PX_PER_IN;
  const setImageWidth = (fraction: number) => run().updateAttributes('image', { width: Math.round(contentWidthPx * fraction), height: null }).run();

  return (
    <div className="ribbon">
      <div className="ribbon-tabs" role="tablist">
        <button type="button" className="ribbon-file" onClick={actions.fileMenu}>{t('letter.tab.file')}</button>
        {TABS.map(id => (
          <button key={id} type="button" role="tab" aria-selected={shownTab === id} className={shownTab === id ? 'on' : ''}
            onMouseDown={e => e.preventDefault()} onClick={() => setTab(id)}>{t(tabLabel[id])}</button>
        ))}
        <button type="button" role="tab" aria-selected={shownTab === 'oi1'} className={`ribbon-special${shownTab === 'oi1' ? ' on' : ''}`}
          onMouseDown={e => e.preventDefault()} onClick={() => setTab('oi1')}><span className="dot" />Office In 1</button>
        {s.inTable && (
          <button type="button" role="tab" aria-selected={shownTab === 'table'} className={shownTab === 'table' ? 'on' : ''}
            onMouseDown={e => e.preventDefault()} onClick={() => setTab('table')}>{t(tabLabel.table)}</button>
        )}
        {s.inImage && (
          <button type="button" role="tab" aria-selected={shownTab === 'picture'} className={shownTab === 'picture' ? 'on' : ''}
            onMouseDown={e => e.preventDefault()} onClick={() => setTab('picture')}>{t(tabLabel.picture)}</button>
        )}
        <span className="ribbon-quick">
          <button type="button" className="cmd-search" onMouseDown={e => e.preventDefault()} onClick={actions.commandSearch} title={`${t('letter.commandSearch')} (Alt+Q)`}>
            <Icon name="search" /><span>{t('letter.commandSearch')}</span><kbd>Alt+Q</kbd>
          </button>
          <Btn icon="undo" title="letter.undo" onClick={() => run().undo().run()} disabled={!s.canUndo} />
          <Btn icon="redo" title="letter.redo" onClick={() => run().redo().run()} disabled={!s.canRedo} />
        </span>
      </div>

      <div className="ribbon-panel" role="tabpanel">
        {shownTab === 'home' && <>
          <Group label="letter.group.clipboard">
            <div className="split">
              <Btn big icon="paste" title="letter.paste" onClick={actions.paste} />
              <Drop title="letter.pasteOptions">
                {close => <>
                  <MenuItem label={t('letter.paste')} onClick={() => { close(); actions.paste(); }} />
                  <MenuItem label={t('letter.pasteText')} onClick={() => { close(); actions.pasteText(); }} />
                </>}
              </Drop>
            </div>
            <div className="stack">
              <Btn icon="cut" title="letter.cut" onClick={() => { editor.commands.focus(); document.execCommand('cut'); }} />
              <Btn icon="copy" title="letter.copy" onClick={() => { editor.commands.focus(); document.execCommand('copy'); }} />
              <Btn icon="painter" title="letter.painter" onClick={actions.painter} />
            </div>
          </Group>
          <Group label="letter.group.font">
            <div className="rows">
              <div className="row">
                <Combo className="font-box" label={t('letter.font')} value={fontShown} groups={fontGroups}
                  itemStyle={f => ({ fontFamily: cssFont(f) })} onPick={f => { rememberFont(f); run().setFontFamily(f).run(); }} />
                <Combo className="size-box" label={t('letter.fontSize')} value={String(sizeShown)} numeric inputMode="decimal"
                  groups={[{ items: FONT_SIZES.map(String) }]} onPick={v => setSize(parseFloat(v.replace(',', '.')))} />
                <Btn icon="grow" title="letter.grow" onClick={() => step(1)} />
                <Btn icon="shrink" title="letter.shrink" onClick={() => step(-1)} />
                <Drop icon="case" title="letter.changeCase">
                  {close => (['sentence', 'lower', 'upper', 'title', 'toggle'] as const).map(m => (
                    <MenuItem key={m} label={t(`letter.case.${m}` as MessageKey)} onClick={() => { changeCase(editor, m); close(); }} />
                  ))}
                </Drop>
                <Btn icon="clear" title="letter.clearFormatting" onClick={clearFormatting} />
              </div>
              <div className="row">
                <Btn label="B" title="letter.bold" onClick={() => run().toggleBold().run()} active={s.bold} style={{ fontWeight: 700 }} />
                <Btn label="I" title="letter.italic" onClick={() => run().toggleItalic().run()} active={s.italic} style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }} />
                <Btn label="U" title="letter.underline" onClick={() => run().toggleUnderline().run()} active={s.underline} style={{ textDecoration: 'underline' }} />
                <Btn label="ab" title="letter.strike" onClick={() => run().toggleStrike().run()} active={s.strike} style={{ textDecoration: 'line-through' }} />
                <Btn label={<>x<sub>2</sub></>} title="letter.subscript" onClick={() => run().toggleSubscript().run()} active={s.sub} />
                <Btn label={<>x<sup>2</sup></>} title="letter.superscript" onClick={() => run().toggleSuperscript().run()} active={s.sup} />
                <Drop label={<span className="color-a">A<i style={{ background: s.color ?? 'currentColor' }} /></span>} title="letter.color">
                  {close => <ColorGrid none="letter.automatic" value={s.color} onPick={c => { if (c) run().setColor(c).run(); else run().unsetColor().run(); close(); }} />}
                </Drop>
                <Drop label={<span className="color-a hl">ab<i style={{ background: s.highlight ?? '#FFFF00' }} /></span>} title="letter.highlight">
                  {close => <ColorGrid none="letter.noColor" value={s.highlight} onPick={c => { if (c) run().setHighlight({ color: c }).run(); else run().unsetHighlight().run(); close(); }} />}
                </Drop>
              </div>
            </div>
          </Group>
          <Group label="letter.group.paragraph">
            <div className="rows">
              <div className="row">
                <span className="split">
                  <Btn icon="bullets" title="letter.bullets" onClick={() => run().toggleBulletList().run()} active={s.bullets} />
                  <Drop title="letter.bulletLibrary">
                    {close => <div className="list-gallery">{BULLET_STYLES.map(st => (
                      <button key={st} type="button" title={t(`letter.bullet.${st}` as MessageKey)} className={s.bullets && (s.bulletStyle ?? 'disc') === st ? 'on' : ''}
                        onClick={() => { setListStyle('bulletList', st); close(); }}>{`${BULLET_CHARS[st]} ——\n${BULLET_CHARS[st]} ——`}</button>
                    ))}</div>}
                  </Drop>
                </span>
                <span className="split">
                  <Btn icon="numbers" title="letter.numbers" onClick={() => run().toggleOrderedList().run()} active={s.numbers} />
                  <Drop title="letter.numberLibrary">
                    {close => <div className="list-gallery">{NUMBER_STYLES.map(st => (
                      <button key={st} type="button" className={s.numbers && (s.numberStyle ?? 'decimal') === st ? 'on' : ''}
                        onClick={() => { setListStyle('orderedList', st); close(); }}>{NUMBER_SAMPLES[st].map(x => `${x} ——`).join('\n')}</button>
                    ))}</div>}
                  </Drop>
                </span>
                <Btn icon="outdent" title="letter.outdent" onClick={() => indent(-1)} />
                <Btn icon="indent" title="letter.indent" onClick={() => indent(1)} />
                <Btn icon="marks" title="letter.showMarks" onClick={() => setView({ marks: !view.marks })} active={view.marks} />
              </div>
              <div className="row">
                <Btn icon="left" title="letter.alignLeft" onClick={() => run().setTextAlign('left').run()} active={s.align === 'left'} />
                <Btn icon="center" title="letter.alignCenter" onClick={() => run().setTextAlign('center').run()} active={s.align === 'center'} />
                <Btn icon="right" title="letter.alignRight" onClick={() => run().setTextAlign('right').run()} active={s.align === 'right'} />
                <Btn icon="justify" title="letter.justify" onClick={() => run().setTextAlign('justify').run()} active={s.align === 'justify'} />
                <Drop icon="spacing" title="letter.lineSpacing">
                  {close => <>
                    {['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'].map(v => (
                      <MenuItem key={v} label={v} active={s.lineHeight !== null && parseFloat(s.lineHeight) === parseFloat(v)}
                        onClick={() => { run().setParagraphFormat({ lineHeight: String(parseFloat(v)) }).run(); close(); }} />
                    ))}
                    <hr />
                    <MenuItem label={t(s.spaceBefore ? 'letter.removeSpaceBefore' : 'letter.addSpaceBefore')}
                      onClick={() => { run().setParagraphFormat({ spaceBefore: s.spaceBefore ? 0 : 12 }).run(); close(); }} />
                    <MenuItem label={t(s.spaceAfter === 0 ? 'letter.addSpaceAfter' : 'letter.removeSpaceAfter')}
                      onClick={() => { run().setParagraphFormat({ spaceAfter: s.spaceAfter === 0 ? 8 : 0 }).run(); close(); }} />
                  </>}
                </Drop>
                <Drop icon="shading" title="letter.shading" swatch={s.background}>
                  {close => <ColorGrid none="letter.noColor" value={s.background} onPick={c => { run().setParagraphFormat({ background: c }).run(); close(); }} />}
                </Drop>
                <Drop icon="borders" title="letter.borders">
                  {close => <>
                    <MenuItem label={t('letter.border.bottom')} onClick={() => { setBorders({ bottom: line }); close(); }} />
                    <MenuItem label={t('letter.border.top')} onClick={() => { setBorders({ top: line }); close(); }} />
                    <MenuItem label={t('letter.border.left')} onClick={() => { setBorders({ left: { ...line, w: 3, space: 6 } }); close(); }} />
                    <MenuItem label={t('letter.border.box')} onClick={() => { setBorders({ top: box, right: box, bottom: box, left: box }); close(); }} />
                    <MenuItem label={t('letter.border.none')} onClick={() => { setBorders(null); close(); }} />
                  </>}
                </Drop>
              </div>
            </div>
          </Group>
          <Group label="letter.group.styles">
            <div className="gallery" role="listbox" aria-label={t('letter.group.styles')}
              style={{ '--tile-bg': page.color ?? '#FFFFFF', '--tile-ink': styles.normal.color ?? (isDark(page.color) ? '#FFFFFF' : '#000000') } as React.CSSProperties}>
              {GALLERY.map(id => (
                <button key={id} type="button" role="option" aria-selected={s.style === id} className={`style-tile${s.style === id ? ' on' : ''}`}
                  onMouseDown={e => e.preventDefault()} onClick={() => applyStyle(editor, id)} title={t(STYLE_KEYS[id])}>
                  <span style={previewStyle({ ...styles.normal, ...styles[id] }, styles.normal)}>{t(STYLE_KEYS[id])}</span>
                </button>
              ))}
            </div>
          </Group>
          <Group label="letter.group.editing">
            <div className="stack">
              <Btn icon="find" title="letter.find" text onClick={() => actions.find(false)} />
              <Btn icon="replace" title="letter.replace" text onClick={() => actions.find(true)} />
              <Btn icon="select" title="letter.selectAll" text onClick={() => run().selectAll().run()} />
            </div>
          </Group>
          <Group label="letter.group.voice">
            <Btn big icon="mic" title={suite.dictating ? 'letter.dictateStop' : 'letter.dictate'} onClick={actions.dictate} active={suite.dictating} />
          </Group>
        </>}

        {shownTab === 'insert' && <>
          <Group label="letter.group.pages">
            <Btn big icon="pagebreak" title="letter.pageBreak" onClick={() => body.chain().focus().setPageBreak().run()} disabled={!isBody} />
          </Group>
          <Group label="letter.group.tables">
            <Drop big icon="table" title="letter.table">
              {close => <>
                <TableGrid onPick={(rows, cols) => { run().insertTable({ rows, cols, withHeaderRow: false }).run(); close(); }} />
                <hr />
                <MenuItem label={t('letter.textToTable')} onClick={() => { actions.textToTable(); close(); }} />
              </>}
            </Drop>
            <SheetDrop suite={suite} actions={actions} />
          </Group>
          <Group label="letter.group.illustrations">
            <Btn big icon="image" title="letter.image" onClick={actions.image} />
          </Group>
          <Group label="letter.group.links">
            <Btn big icon="link" title="letter.link" onClick={actions.link} active={s.link} />
          </Group>
          <Group label="letter.group.blocks">
            <Drop big icon="callout" title="letter.callout">
              {close => (['note', 'tip', 'warning', 'success', 'gold'] as CalloutKind[]).map(k => (
                <MenuItem key={k} label={<><i className={`callout-dot ${k}`} />{t(`letter.callout.${k}` as MessageKey)}</>} onClick={() => { actions.callout(k); close(); }} />
              ))}
            </Drop>
            <Drop big icon="envelope" title="letter.letterBlock">
              {close => <>
                <MenuItem label={t('letter.letterBlock.full')} onClick={() => { actions.letterBlock('full'); close(); }} />
                <MenuItem label={t('letter.letterBlock.closing')} onClick={() => { actions.letterBlock('closing'); close(); }} />
              </>}
            </Drop>
            <Btn big icon="toc" title="letter.toc" onClick={actions.toc} disabled={!isBody} />
            <Btn big icon="qr" title="letter.qr" onClick={actions.qr} />
          </Group>
          <Group label="letter.group.headerFooter">
            <Btn big icon="header" title="letter.header" onClick={actions.header} />
            <Btn big icon="footer" title="letter.footer" onClick={actions.footer} />
            <Drop big icon="pagenum" title="letter.pageNumber">
              {close => <>
                <MenuItem label={t('letter.pageNumber.top')} onClick={() => { actions.pageNumber('top', false); close(); }} />
                <MenuItem label={t('letter.pageNumber.bottom')} onClick={() => { actions.pageNumber('bottom', false); close(); }} />
                <MenuItem label={t('letter.pageNumber.bottomTotal')} onClick={() => { actions.pageNumber('bottom', true); close(); }} />
                <MenuItem label={t('letter.pageNumber.here')} onClick={() => { actions.pageNumber('here', false); close(); }} />
              </>}
            </Drop>
          </Group>
          <Group label="letter.group.text">
            <Btn big icon="date" title="letter.date" onClick={() => run().insertContent(new Date().toLocaleDateString(lang || undefined, { dateStyle: 'long' })).run()} />
            <Btn big icon="hr" title="letter.horizontalLine" onClick={() => run().setHorizontalRule().run()} />
          </Group>
          <Group label="letter.group.symbols">
            <Drop big icon="symbol" title="letter.symbol" wide>
              {close => <div className="symbols">{SYMBOLS.map(ch => (
                <button key={ch} type="button" onClick={() => { run().insertContent(ch).run(); close(); }}>{ch}</button>
              ))}</div>}
            </Drop>
          </Group>
        </>}

        {shownTab === 'design' && <>
          <Group label="letter.group.themes">
            <div className="theme-gallery" role="listbox" aria-label={t('letter.group.themes')}>
              {THEMES.map(th => (
                <button key={th.id} type="button" role="option" aria-selected={suite.themeId === th.id}
                  className={`theme-tile${suite.themeId === th.id ? ' on' : ''}`} onClick={() => actions.theme(th)} title={t(th.name)}
                  style={{ background: th.page ?? '#FFFFFF', color: th.styles.normal.color ?? (isDark(th.page) ? '#FFFFFF' : '#000000') }}>
                  <span className="theme-title" style={previewStyle({ ...th.styles.normal, ...th.styles.title, size: 15 }, th.styles.normal)}>Aa</span>
                  <span className="theme-lines"><i style={{ background: th.styles.h1.color ?? '#2F5496' }} /><i /><i /></span>
                  <span className="theme-name">{t(th.name)}</span>
                </button>
              ))}
            </div>
          </Group>
          <Group label="letter.group.spacing">
            <Drop big icon="spacing" title="letter.paragraphSpacing">
              {close => (Object.keys(SPACING) as SpacingId[]).map(id => (
                <MenuItem key={id} label={t(`letter.spacing.${id}` as MessageKey)}
                  active={styles.normal.after === SPACING[id].after && styles.normal.lineHeight === SPACING[id].lineHeight}
                  onClick={() => { actions.spacing(id); close(); }} />
              ))}
            </Drop>
          </Group>
          <Group label="letter.group.pageBackground">
            <Drop big icon="pagecolor" title="letter.pageColor" swatch={page.color}>
              {close => <ColorGrid none="letter.noColor" value={page.color} onPick={c => { setPage({ ...page, color: c }); close(); }} />}
            </Drop>
            <Drop big icon="pageborder" title="letter.pageBorder" swatch={page.border?.color ?? null}>
              {close => <ColorGrid none="letter.border.none" value={page.border?.color}
                onPick={c => { setPage({ ...page, border: c ? { w: 1.5, color: c, space: 24 } : null }); close(); }} />}
            </Drop>
            <Drop big icon="watermark" title="letter.watermark">
              {close => {
                const color = page.watermark?.color ?? '#C0C0C0';
                const set = (text: string | null) => { setPage({ ...page, watermark: text ? { text, color } : null }); close(); };
                return <>
                  {WATERMARKS.map(w => <MenuItem key={w} label={w} active={page.watermark?.text === w} onClick={() => set(w)} />)}
                  <hr />
                  <MenuItem label={t('letter.watermarkCustom')} onClick={() => {
                    const text = prompt(t('letter.watermarkPrompt'), page.watermark?.text ?? '');
                    if (text !== null) set(text.trim().slice(0, 60) || null);
                  }} />
                  <span className="kicker">{t('letter.watermarkColor')}</span>
                  <ColorGrid value={color} onPick={c => { if (page.watermark && c) setPage({ ...page, watermark: { ...page.watermark, color: c } }); close(); }} />
                  <hr />
                  <MenuItem label={t('letter.watermarkRemove')} onClick={() => set(null)} />
                </>;
              }}
            </Drop>
          </Group>
        </>}

        {shownTab === 'layout' && <>
          <Group label="letter.group.pageSetup">
            <Drop big icon="margins" title="letter.margins">
              {close => <>
                {(Object.keys(MARGIN_PRESETS) as MarginPresetId[]).map(id => {
                  const m = MARGIN_PRESETS[id];
                  const on = (['top', 'right', 'bottom', 'left'] as const).every(k => Math.abs(page.margins[k] - m[k]) < 0.01);
                  return <MenuItem key={id} active={on} label={t(`letter.margins.${id}` as MessageKey)}
                    hint={`${fromPt(m.top * 72, unit)} / ${fromPt(m.left * 72, unit)} ${unit}`}
                    onClick={() => { setPage({ ...page, margins: { ...m } }); close(); }} />;
                })}
                <hr />
                <MenuItem label={t('letter.margins.custom')} onClick={() => { actions.customMargins(); close(); }} />
              </>}
            </Drop>
            <Drop big icon="orientation" title="letter.orientation">
              {close => (['portrait', 'landscape'] as const).map(o => (
                <MenuItem key={o} active={page.orientation === o} label={t(`letter.orientation.${o}` as MessageKey)}
                  onClick={() => { setPage({ ...page, orientation: o }); close(); }} />
              ))}
            </Drop>
            <Drop big icon="size" title="letter.size">
              {close => (Object.keys(PAGE_SIZES) as PageSizeId[]).map(id => {
                const p = PAGE_SIZES[id];
                const dims = unit === 'in' ? `${p.width} × ${p.height} in` : `${(p.width * 2.54).toFixed(1)} × ${(p.height * 2.54).toFixed(1)} cm`;
                return <MenuItem key={id} active={page.size === id} label={p.name} hint={dims} onClick={() => { setPage({ ...page, size: id }); close(); }} />;
              })}
            </Drop>
            <Btn big icon="hyphen" title="letter.hyphenation" active={!!page.hyphenate} onClick={() => setPage({ ...page, hyphenate: !page.hyphenate || undefined })} />
          </Group>
          <Group label="letter.group.indent">
            <div className="stack">
              <NumberBox label={t('letter.indentLeft')} unit={unit} step={unit === 'in' ? 0.1 : 0.25} min={0}
                value={fromPt(s.indentLeft || 0, unit)} onChange={v => run().setParagraphFormat({ indentLeft: toPt(v, unit) || null }).run()} />
              <NumberBox label={t('letter.indentRight')} unit={unit} step={unit === 'in' ? 0.1 : 0.25} min={0}
                value={fromPt(s.indentRight || 0, unit)} onChange={v => run().setParagraphFormat({ indentRight: toPt(v, unit) || null }).run()} />
            </div>
          </Group>
          <Group label="letter.group.spacing">
            <div className="stack">
              <NumberBox label={t('letter.spaceBefore')} unit="pt" step={6} min={0}
                value={s.spaceBefore ?? def.before ?? 0} onChange={v => run().setParagraphFormat({ spaceBefore: v }).run()} />
              <NumberBox label={t('letter.spaceAfter')} unit="pt" step={6} min={0}
                value={s.spaceAfter ?? def.after ?? 0} onChange={v => run().setParagraphFormat({ spaceAfter: v }).run()} />
            </div>
          </Group>
        </>}

        {shownTab === 'references' && <>
          <Group label="letter.group.toc">
            <Btn big icon="toc" title="letter.toc" onClick={actions.toc} disabled={!isBody} />
          </Group>
          <Group label="letter.group.footnotes">
            <Btn big icon="footnote" title="letter.footnoteInsert" onClick={actions.footnote} disabled={!isBody} />
            <div className="stack">
              <Btn icon="pen" title="letter.footnoteEdit" text onClick={actions.editFootnote} disabled={!suite.footnoteHere} />
              <Btn icon="next" title="letter.footnoteNext" text onClick={actions.nextFootnote} disabled={!suite.footnotes} />
            </div>
          </Group>
        </>}

        {shownTab === 'review' && <>
          <Group label="letter.group.comments">
            <Btn big icon="commentnew" title="letter.commentNew" onClick={actions.newComment} disabled={!isBody} />
            <div className="stack">
              <Btn icon="trash" title="letter.commentDelete" text onClick={actions.deleteComment} disabled={!suite.commentHere} />
              <Btn icon="prev" title="letter.previous" text onClick={() => actions.comment(-1)} />
              <Btn icon="next" title="letter.next" text onClick={() => actions.comment(1)} />
            </div>
            <Btn big icon="comment" title="letter.commentsShow" onClick={actions.toggleComments} active={suite.commentsOpen} />
          </Group>
          <Group label="letter.group.tracking">
            <Btn big icon="track" title="letter.track" onClick={actions.track} active={suite.tracking} />
            <Btn big icon="markup" title="letter.markupShow" onClick={actions.markup} active={suite.markup} />
          </Group>
          <Group label="letter.group.changes">
            <span className="split">
              <Btn big icon="accept" title="letter.accept" onClick={() => actions.accept(false)} disabled={!suite.changes} />
              <Drop title="letter.acceptOptions" disabled={!suite.changes}>
                {close => <>
                  <MenuItem label={t('letter.acceptNext')} onClick={() => { close(); actions.accept(false); }} />
                  <MenuItem label={t('letter.acceptAll')} onClick={() => { close(); actions.accept(true); }} />
                </>}
              </Drop>
            </span>
            <span className="split">
              <Btn big icon="reject" title="letter.reject" onClick={() => actions.reject(false)} disabled={!suite.changes} />
              <Drop title="letter.rejectOptions" disabled={!suite.changes}>
                {close => <>
                  <MenuItem label={t('letter.rejectNext')} onClick={() => { close(); actions.reject(false); }} />
                  <MenuItem label={t('letter.rejectAll')} onClick={() => { close(); actions.reject(true); }} />
                </>}
              </Drop>
            </span>
            <div className="stack">
              <Btn icon="prev" title="letter.changePrevious" text onClick={() => actions.change(-1)} disabled={!suite.changes} />
              <Btn icon="next" title="letter.changeNext" text onClick={() => actions.change(1)} disabled={!suite.changes} />
            </div>
          </Group>
          <Group label="letter.group.proofing">
            <Btn big icon="spell" title="letter.spelling" onClick={() => setView({ spell: !view.spell })} active={view.spell} />
            <Btn big icon="count" title="letter.wordCount" onClick={actions.wordCount} />
          </Group>
          <Group label="letter.group.speech">
            <Btn big icon="speak" title={suite.speaking ? 'letter.readAloudStop' : 'letter.readAloud'} onClick={actions.readAloud} active={suite.speaking} />
          </Group>
          <Group label="letter.group.language">
            <Drop big icon="language" title="letter.language">
              {close => LANGS.map(l => (
                <MenuItem key={l} active={lang === l} label={new Intl.DisplayNames([document.documentElement.lang || 'en'], { type: 'language' }).of(l) ?? l}
                  onClick={() => { setLang(l); close(); }} />
              ))}
            </Drop>
          </Group>
        </>}

        {shownTab === 'view' && <>
          <Group label="letter.group.views">
            <Btn big icon="print" title="letter.printLayout" onClick={() => setView({ layout: 'print' })} active={view.layout === 'print'} />
            <Btn big icon="web" title="letter.webLayout" onClick={() => setView({ layout: 'web' })} active={view.layout === 'web'} />
          </Group>
          <Group label="letter.group.show">
            <Btn big icon="outline" title="letter.outline" onClick={actions.outline} active={suite.outline} />
            <Btn big icon="marks" title="letter.showMarks" onClick={() => setView({ marks: !view.marks })} active={view.marks} />
          </Group>
          <Group label="letter.group.immersive">
            <Btn big icon="focus" title="letter.focus" onClick={actions.focus} />
            <Btn big icon="speak" title={suite.speaking ? 'letter.readAloudStop' : 'letter.readAloud'} onClick={actions.readAloud} active={suite.speaking} />
          </Group>
          <Group label="letter.group.zoom">
            <Btn big icon="zoomin" title="letter.zoom100" onClick={() => setView({ zoom: 1 })} active={view.zoom === 1} />
            <Btn big icon="onepage" title="letter.onePage" onClick={() => setView({ zoom: 'page' })} active={view.zoom === 'page'} disabled={view.layout === 'web'} />
            <Btn big icon="width" title="letter.pageWidth" onClick={() => setView({ zoom: 'width' })} active={view.zoom === 'width'} />
          </Group>
        </>}

        {shownTab === 'table' && <>
          <Group label="letter.group.tableStyles">
            <div className="table-styles">
              {(Object.keys(TABLE_STYLES) as TableStyleId[]).map(id => {
                const look = TABLE_STYLES[id];
                return (
                  <button key={id} type="button" title={t(`letter.tableStyle.${id}` as MessageKey)} onClick={() => applyTableStyle(editor, id)}
                    className={look.borders === 'none' ? 'no-lines' : ''}>
                    {[0, 1, 2, 3].map(r => <i key={r} style={{ background: r === 0 ? look.head ?? '#FFFFFF' : r % 2 === 0 ? look.band ?? '#FFFFFF' : '#FFFFFF' }} />)}
                  </button>
                );
              })}
            </div>
          </Group>
          <Group label="letter.group.rowsColumns">
            <Btn big icon="rowabove" title="letter.rowAbove" onClick={() => run().addRowBefore().run()} />
            <Btn big icon="rowbelow" title="letter.rowBelow" onClick={() => run().addRowAfter().run()} />
            <Btn big icon="colleft" title="letter.columnLeft" onClick={() => run().addColumnBefore().run()} />
            <Btn big icon="colright" title="letter.columnRight" onClick={() => run().addColumnAfter().run()} />
          </Group>
          <Group label="letter.group.delete">
            <div className="stack">
              <Btn icon="delrow" title="letter.deleteRow" text onClick={() => run().deleteRow().run()} />
              <Btn icon="delcol" title="letter.deleteColumn" text onClick={() => run().deleteColumn().run()} />
              <Btn icon="deltable" title="letter.deleteTable" text onClick={() => run().deleteTable().run()} />
            </div>
          </Group>
          <Group label="letter.group.merge">
            <Btn big icon="merge" title="letter.mergeCells" onClick={() => run().mergeCells().run()} />
            <Btn big icon="split" title="letter.splitCell" onClick={() => run().splitCell().run()} />
            <Btn big icon="headerrow" title="letter.headerRow" onClick={() => run().toggleHeaderRow().run()} />
          </Group>
          <Group label="letter.group.cell">
            <Drop big icon="shading" title="letter.cellShading">
              {close => <ColorGrid none="letter.noColor" onPick={c => { run().setCellAttribute('background', c).run(); close(); }} />}
            </Drop>
          </Group>
          <Group label="letter.group.withClass">
            <Btn big icon="sheet" title={suite.linkedTable ? 'letter.openLinkedSheet' : 'letter.editInClass'} onClick={actions.editInClass} />
            <Btn big icon="texttable" title="letter.tableToText" onClick={actions.tableToText} />
          </Group>
        </>}

        {shownTab === 'picture' && <>
          <Group label="letter.group.arrange">
            <Btn icon="left" title="letter.alignLeft" onClick={() => run().setTextAlign('left').run()} active={s.align === 'left' || !s.align} />
            <Btn icon="center" title="letter.alignCenter" onClick={() => run().setTextAlign('center').run()} active={s.align === 'center'} />
            <Btn icon="right" title="letter.alignRight" onClick={() => run().setTextAlign('right').run()} active={s.align === 'right'} />
          </Group>
          <Group label="letter.group.size">
            {[0.25, 0.5, 0.75, 1].map(f => <Btn key={f} text label={`${f * 100}%`} title={t('letter.imageWidth', { n: f * 100 })} onClick={() => setImageWidth(f)} />)}
          </Group>
          <Group label="letter.group.picture">
            <Btn big icon="image" title="letter.replaceImage" onClick={actions.replaceImage} />
            <Btn big icon="alt" title="letter.altText" onClick={() => {
              const alt = prompt(t('letter.altTextPrompt'), s.imageAlt);
              if (alt !== null) run().updateAttributes('image', { alt: alt.trim() || null }).run();
            }} />
            <Btn big icon="trash" title="letter.deleteImage" onClick={() => run().deleteSelection().run()} />
          </Group>
        </>}

        {shownTab === 'smart' && <>
          <Group label="letter.group.find">
            <Btn big icon="search" title="letter.commandSearch" onClick={actions.commandSearch} />
            <Btn big icon="outline" title="letter.outline" onClick={actions.outline} active={suite.outline} />
          </Group>
          <Group label="letter.group.cleanUp">
            <Drop big icon="clean" title="letter.cleanUp">
              {close => (['all', 'quotes', 'spaces', 'empty'] as CleanUp[]).map(w => (
                <MenuItem key={w} label={t(`letter.cleanUp.${w}` as MessageKey)} onClick={() => { actions.cleanUp(w); close(); }} />
              ))}
            </Drop>
            <div className="stack">
              <Btn icon="sort" title="letter.sortAZ" text onClick={() => actions.sort(1)} />
              <Btn icon="sort" title="letter.sortZA" text onClick={() => actions.sort(-1)} />
              <Drop icon="case" title="letter.changeCase" text>
                {close => (['sentence', 'lower', 'upper', 'title', 'toggle'] as const).map(m => (
                  <MenuItem key={m} label={t(`letter.case.${m}` as MessageKey)} onClick={() => { changeCase(editor, m); close(); }} />
                ))}
              </Drop>
            </div>
          </Group>
          <Group label="letter.group.convert">
            <Btn big icon="texttable" title="letter.textToTable" onClick={actions.textToTable} />
            <Btn big icon="toc" title="letter.toc" onClick={actions.toc} disabled={!isBody} />
            <Btn big icon="qr" title="letter.qr" onClick={actions.qr} />
          </Group>
          <Group label="letter.group.voice">
            <Btn big icon="mic" title={suite.dictating ? 'letter.dictateStop' : 'letter.dictate'} onClick={actions.dictate} active={suite.dictating} />
            <Btn big icon="speak" title={suite.speaking ? 'letter.readAloudStop' : 'letter.readAloud'} onClick={actions.readAloud} active={suite.speaking} />
            <Btn big icon="focus" title="letter.focus" onClick={actions.focus} />
          </Group>
        </>}

        {shownTab === 'oi1' && <>
          <Group label="letter.group.withClass">
            <Btn big icon="sheet" title={suite.linkedTable ? 'letter.openLinkedSheet' : 'letter.editInClass'} onClick={actions.editInClass} disabled={!s.inTable} />
            <SheetDrop suite={suite} actions={actions} />
            <Btn big icon="new" title="letter.newSheet" onClick={actions.newSheet} />
          </Group>
          <Group label="letter.group.withProdfos">
            <Btn big icon="pdf" title="letter.savePdf" onClick={actions.pdf} />
            <Btn big icon="prodfos" title="letter.openProdfos" onClick={() => actions.openApp('prodfos')} />
          </Group>
          <Group label="letter.group.apps">
            <div className="app-keys">
              {suite.apps.filter(a => a.id !== 'letter').map(a => (
                <button key={a.id} type="button" className="app-key" disabled={!a.ready} onClick={() => actions.openApp(a.id)}
                  style={{ '--accent': a.color } as React.CSSProperties} title={a.ready ? a.name : `${a.name} (${t('home.soon')})`}>
                  <i />{a.name.replace('Office ', '')}
                </button>
              ))}
            </div>
          </Group>
          <Group label="letter.group.share">
            <Btn big icon="share" title="letter.share" onClick={actions.share} />
          </Group>
        </>}
      </div>
    </div>
  );
}

/** Insert a table from an open Office Class sheet or from an .xlsx or .csv file. */
function SheetDrop({ suite, actions }: { suite: SuiteState; actions: RibbonActions }) {
  return (
    <Drop big icon="sheet" title="letter.fromClass">
      {close => <>
        {suite.sheets.length > 0 && <span className="kicker">{t('letter.openSheets')}</span>}
        {suite.sheets.map(x => <MenuItem key={x.tabId} label={x.title} onClick={() => { actions.insertFromSheet(x.tabId); close(); }} />)}
        {suite.sheets.length > 0 && <hr />}
        <MenuItem label={t('letter.fromSheetFile')} onClick={() => { actions.insertFromSheet(null); close(); }} />
      </>}
    </Drop>
  );
}

function TableGrid({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ r: 0, c: 0 });
  return (
    <div className="table-grid" onMouseLeave={() => setHover({ r: 0, c: 0 })}>
      <div className="table-grid-label">{hover.r ? `${hover.c} × ${hover.r}` : t('letter.table')}</div>
      {Array.from({ length: 8 }, (_, r) => (
        <div key={r} className="table-grid-row">
          {Array.from({ length: 10 }, (_, c) => (
            <button key={c} type="button" aria-label={`${c + 1} × ${r + 1}`}
              className={r < hover.r && c < hover.c ? 'on' : ''}
              onMouseEnter={() => setHover({ r: r + 1, c: c + 1 })} onFocus={() => setHover({ r: r + 1, c: c + 1 })}
              onClick={() => onPick(r + 1, c + 1)} />
          ))}
        </div>
      ))}
    </div>
  );
}
