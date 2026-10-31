// Office Letter's ribbon: Word's tabs (File, Home, Insert, Layout, Review, View, Table) plus what Word lacks:
// Design themes, a Smart tab with one-click tools, an Office In 1 tab that links Letter to every other app,
// and a command search that finds any command by name.

import { useEditorState, type Editor } from '@tiptap/react';
import { useState, type ReactNode } from 'react';
import { getLanguage, t, type MessageKey } from '../../shell/i18n';
import { BULLET_CHARS, BULLET_STYLES, NUMBER_STYLES, numberLabel, type BorderSide, type Borders } from './extensions';
import { FONT_GROUPS, FONT_SIZES, STYLE_IDS, cssFont, previewStyle, type DocStyles, type StyleId } from './model';
import { LINE_NUMBERS, MARGIN_PRESETS, PAGE_SIZES, PX_PER_IN, WATERMARKS, isDark, pageInches, type MarginPresetId, type PageSettings, type PageSizeId } from './page';
import type { AppInfo, TabInfo } from '../../shell/contract';
import { PROOF_TAGS } from '../../ui/proof/proof';
import { Btn, ColorGrid, Combo, Drop, Group, Icon, MenuItem, NumberBox, RibbonToggle, type ComboGroup } from '../../ui/kit';
import { CopilotButton } from '../../ui/Copilot';
import { CALLOUTS, CALLOUT_KINDS, CLEAN_UPS, TABLE_STYLES, applyTableStyle, type CalloutKind, type CleanUp, type TableStyleId } from './smart';
import { LETTER_PARTS, type LetterPart } from './templates/parts';
import { SPACING, THEMES, type SpacingId, type Theme } from './themes';
import { CASE_MODES, PASTE_KINDS, changeCase, type PasteKind } from './textTools';
import { LETTERS, type LetterCat } from './templates/letters';
import { CV_TEMPLATES } from './templates/cv';
import {
  BIBLIOGRAPHY_TITLES, CAPTION_LABELS, CITATION_STYLES, CITATION_STYLE_IDS, REF_FORMS,
  type CaptionLabel, type CitationStyle, type RefForm, type RefTarget, type Source,
} from './references';

export type Zoom = number | 'width' | 'page';

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
  pasteAs: (kind: PasteKind) => void;
  image: () => void;
  replaceImage: () => void;
  link: () => void;
  find: (replace: boolean) => void;
  header: () => void;
  footer: () => void;
  pageNumber: (where: 'top' | 'bottom' | 'here', format: string, align: 'left' | 'center' | 'right') => void;
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
  letterPart: (kind: LetterPart) => void;
  qr: () => void;
  cleanUp: (what: CleanUp) => void;
  sort: (dir: 1 | -1) => void;
  textToTable: () => void;
  tableToText: () => void;
  // Links with the other apps
  editInClass: () => void;
  makeSlides: () => void;
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
  citeStyle: CitationStyle;
  setCiteStyle: (st: CitationStyle) => void;
  newCitation: (ai: boolean) => void;
  refModels: () => void;
  refCheck: () => void;
  cite: (src: Source) => void;
  citedSources: () => Source[];
  bibliography: (title: string) => void;
  caption: (label: CaptionLabel) => void;
  tableOfFigures: () => void;
  refTargets: () => RefTarget[];
  crossRef: (target: RefTarget, form: RefForm) => void;
  markIndex: () => void;
  insertIndex: () => void;
  copilot: () => void;
  // Doc adm/Mil
  docTemplate: (id: string) => void;
  docLang: (lang: 'fr' | 'en') => void;
  fillFields: () => void;
  nextField: () => void;
  profile: () => void;
  docAi: (what: 'docWrite' | 'fillAi') => void;
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
  copilot: boolean;
  docLang: 'fr' | 'en';
  fields: number;
}

const TABS = ['home', 'insert', 'design', 'layout', 'references', 'review', 'view', 'smart', 'docs'] as const;
type TabId = (typeof TABS)[number] | 'oi1' | 'table' | 'picture';

const STYLE_KEYS: Record<StyleId, MessageKey> = {
  normal: 'letter.style.normal', title: 'letter.style.title', subtitle: 'letter.style.subtitle', quote: 'letter.style.quote',
  h1: 'letter.heading1', h2: 'letter.heading2', h3: 'letter.heading3', h4: 'letter.style.h4', h5: 'letter.style.h5', h6: 'letter.style.h6',
};
const GALLERY: StyleId[] = ['normal', 'title', 'subtitle', 'h1', 'h2', 'h3', 'h4', 'quote'];

const SYMBOLS = '©®™€£¥¢§¶†‡•·–—…‰′″°±×÷≈≠≤≥∞√∑πΩµ←→↑↓↔✓✗★☆♥♦♣♠«»‹›„“”‘’¿¡'.split('');

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

type PageFormat = 'num' | 'page' | 'total' | 'slash' | 'dash' | 'bracket';
const pageFormat = (f: PageFormat) => ({
  num: '{page}', page: t('letter.pnPage'), total: t('letter.pageXofY'), slash: '{page} / {pages}', dash: '— {page} —', bracket: '[{page}]',
})[f];
/** Where page numbers go and how they read, like Word's Page Number galleries. */
const PAGE_NUMBERS: ['top' | 'bottom' | 'here', 'left' | 'center' | 'right', PageFormat][] = [
  ['bottom', 'center', 'num'], ['bottom', 'right', 'num'], ['bottom', 'left', 'num'], ['bottom', 'center', 'page'], ['bottom', 'right', 'page'],
  ['bottom', 'center', 'total'], ['bottom', 'right', 'total'], ['bottom', 'left', 'total'], ['bottom', 'center', 'slash'], ['bottom', 'center', 'dash'],
  ['bottom', 'right', 'bracket'], ['top', 'right', 'num'], ['top', 'center', 'num'], ['top', 'left', 'num'], ['top', 'right', 'page'],
  ['top', 'right', 'total'], ['top', 'center', 'slash'], ['top', 'right', 'slash'], ['here', 'left', 'num'], ['here', 'left', 'total'],
];

const GOLD = '#D4A843';
/** Word's border menu and more: single, double, thick, dashed and dotted lines, and gold accents. */
const BORDER_PRESETS: [string, (color: string) => Borders | null][] = (() => {
  const l = (color: string, more: Partial<BorderSide> = {}): BorderSide => ({ w: 0.75, color, space: 1, ...more });
  const b = (color: string, more: Partial<BorderSide> = {}): BorderSide => ({ w: 0.75, color, space: 4, ...more });
  const all = (side: BorderSide) => ({ top: side, right: side, bottom: side, left: side });
  return [
    ['bottom', c => ({ bottom: l(c) })],
    ['top', c => ({ top: l(c) })],
    ['left', c => ({ left: l(c, { w: 3, space: 6 }) })],
    ['right', c => ({ right: l(c, { w: 3, space: 6 }) })],
    ['box', c => all(b(c))],
    ['topBottom', c => ({ top: l(c), bottom: l(c) })],
    ['leftRight', c => ({ left: l(c, { space: 6 }), right: l(c, { space: 6 }) })],
    ['doubleBottom', c => ({ bottom: l(c, { style: 'double', w: 2.25 }) })],
    ['doubleTopBottom', c => ({ top: l(c, { style: 'double', w: 2.25 }), bottom: l(c, { style: 'double', w: 2.25 }) })],
    ['doubleBox', c => all(b(c, { style: 'double', w: 2.25 }))],
    ['thickBottom', c => ({ bottom: l(c, { w: 2.25 }) })],
    ['thickBox', c => all(b(c, { w: 2.25 }))],
    ['dashedBottom', c => ({ bottom: l(c, { style: 'dashed' }) })],
    ['dashedBox', c => all(b(c, { style: 'dashed' }))],
    ['dottedBottom', c => ({ bottom: l(c, { style: 'dotted', w: 1.5 }) })],
    ['dottedBox', c => all(b(c, { style: 'dotted', w: 1.5 }))],
    ['goldBar', () => ({ left: l(GOLD, { w: 4.5, space: 8 }) })],
    ['goldBottom', () => ({ bottom: l(GOLD, { w: 1.5 }) })],
    ['goldBox', () => all(b(GOLD, { w: 1.5, space: 6 }))],
    ['none', () => null],
  ];
})();

export function Ribbon({ editor, body, styles, page, setPage, lang, setLang, view, setView, actions, suite, proofTools }: {
  editor: Editor; body: Editor; styles: DocStyles; page: PageSettings; setPage: (p: PageSettings) => void;
  lang: string; setLang: (l: string) => void; view: ViewState; setView: (v: Partial<ViewState>) => void; actions: RibbonActions;
  suite: SuiteState;
  /** Style check, grammar online and the user's dictionary, shared by every app. */
  proofTools?: ReactNode;
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

  const tabLabel: Record<Exclude<TabId, 'oi1'>, MessageKey> = {
    home: 'letter.tab.home', insert: 'letter.tab.insert', design: 'letter.tab.design', layout: 'letter.tab.layout', review: 'letter.tab.review',
    references: 'letter.tab.references', view: 'letter.tab.view', smart: 'letter.tab.smart', docs: 'letter.tab.docs', table: 'letter.tab.table', picture: 'letter.tab.picture',
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
        <RibbonToggle />
        {s.inTable && (
          <button type="button" role="tab" aria-selected={shownTab === 'table'} className={shownTab === 'table' ? 'on' : ''}
            onMouseDown={e => e.preventDefault()} onClick={() => setTab('table')}>{t(tabLabel.table)}</button>
        )}
        {s.inImage && (
          <button type="button" role="tab" aria-selected={shownTab === 'picture'} className={shownTab === 'picture' ? 'on' : ''}
            onMouseDown={e => e.preventDefault()} onClick={() => setTab('picture')}>{t(tabLabel.picture)}</button>
        )}
        <span className="ribbon-quick">
          <CopilotButton open={suite.copilot} onClick={actions.copilot} />
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
                {close => PASTE_KINDS.map(k => (
                  <MenuItem key={k} label={t(`letter.pasteAs.${k}` as MessageKey)} onClick={() => { close(); actions.pasteAs(k); }} />
                ))}
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
                  {close => CASE_MODES.map(m => (
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
                      <button key={st} type="button" title={BULLET_CHARS[st]} aria-label={BULLET_CHARS[st]} className={s.bullets && (s.bulletStyle ?? 'disc') === st ? 'on' : ''}
                        onClick={() => { setListStyle('bulletList', st); close(); }}>{`${BULLET_CHARS[st]} ——\n${BULLET_CHARS[st]} ——`}</button>
                    ))}</div>}
                  </Drop>
                </span>
                <span className="split">
                  <Btn icon="numbers" title="letter.numbers" onClick={() => run().toggleOrderedList().run()} active={s.numbers} />
                  <Drop title="letter.numberLibrary">
                    {close => <div className="list-gallery">{NUMBER_STYLES.map(st => (
                      <button key={st} type="button" className={s.numbers && (s.numberStyle ?? 'decimal') === st ? 'on' : ''}
                        onClick={() => { setListStyle('orderedList', st); close(); }}>{[1, 2].map(n => `${numberLabel(st, n)} —`).join('\n')}</button>
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
                    {['1.0', '1.08', '1.15', '1.25', '1.5', '1.75', '2.0', '2.5', '3.0'].map(v => (
                      <MenuItem key={v} label={v} active={s.lineHeight !== null && parseFloat(s.lineHeight) === parseFloat(v)}
                        onClick={() => { run().setParagraphFormat({ lineHeight: String(parseFloat(v)) }).run(); close(); }} />
                    ))}
                    <hr />
                    {[0, 6, 12, 18, 24].map(n => (
                      <MenuItem key={`b${n}`} label={t('letter.spaceBeforePt', { n })} active={(s.spaceBefore ?? 0) === n}
                        onClick={() => { run().setParagraphFormat({ spaceBefore: n }).run(); close(); }} />
                    ))}
                    <hr />
                    {[0, 4, 8, 12, 18, 24].map(n => (
                      <MenuItem key={`a${n}`} label={t('letter.spaceAfterPt', { n })} active={s.spaceAfter === n}
                        onClick={() => { run().setParagraphFormat({ spaceAfter: n }).run(); close(); }} />
                    ))}
                  </>}
                </Drop>
                <Drop icon="shading" title="letter.shading" swatch={s.background}>
                  {close => <ColorGrid none="letter.noColor" value={s.background} onPick={c => { run().setParagraphFormat({ background: c }).run(); close(); }} />}
                </Drop>
                <Drop icon="borders" title="letter.borders">
                  {close => BORDER_PRESETS.map(([id, make]) => (
                    <MenuItem key={id} label={t(`letter.border.${id}` as MessageKey)} onClick={() => { setBorders(make(borderColor)); close(); }} />
                  ))}
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
              {close => CALLOUT_KINDS.map(k => (
                <MenuItem key={k} label={<><i className="callout-dot" style={{ background: CALLOUTS[k].line }} />{CALLOUTS[k].icon} {t(`letter.callout.${k}` as MessageKey)}</>} onClick={() => { actions.callout(k); close(); }} />
              ))}
            </Drop>
            <Drop big icon="envelope" title="letter.letterBlock">
              {close => LETTER_PARTS.map(k => (
                <MenuItem key={k} label={t(`letter.part.${k}` as MessageKey)} onClick={() => { actions.letterPart(k); close(); }} />
              ))}
            </Drop>
            <Btn big icon="toc" title="letter.toc" onClick={actions.toc} disabled={!isBody} />
            <Btn big icon="qr" title="letter.qr" onClick={actions.qr} />
          </Group>
          <Group label="letter.group.headerFooter">
            <Btn big icon="header" title="letter.header" onClick={actions.header} />
            <Btn big icon="footer" title="letter.footer" onClick={actions.footer} />
            <Drop big icon="pagenum" title="letter.pageNumber">
              {close => PAGE_NUMBERS.map(([where, align, fmt]) => (
                <MenuItem key={`${where}-${align}-${fmt}`} label={`${t(`letter.pn.${where}` as MessageKey)} · ${where === 'here' ? '' : `${t(`letter.pn.${align}` as MessageKey)} · `}${pageFormat(fmt).replace('{page}', '1').replace('{pages}', '3')}`}
                  onClick={() => { actions.pageNumber(where, pageFormat(fmt), align); close(); }} />
              ))}
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
            <div className="theme-gallery" role="listbox" aria-label={t('letter.group.themes')} data-gallery="Themes">
              {THEMES.map(th => <ThemeTile key={th.id} th={th} on={suite.themeId === th.id} onPick={actions.theme} />)}
            </div>
            <Drop icon="palette" title="letter.allThemes" wide>
              {close => <div className="theme-grid">{THEMES.map(th => (
                <ThemeTile key={th.id} th={th} on={suite.themeId === th.id} onPick={x => { actions.theme(x); close(); }} />
              ))}</div>}
            </Drop>
          </Group>
          <Group label="letter.group.spacing">
            <Drop big icon="spacing" title="letter.paragraphSpacing">
              {close => (Object.keys(SPACING) as SpacingId[]).map(id => (
                <MenuItem key={id} label={t(`letter.spacing.${id}` as MessageKey)} hint={`${SPACING[id].lineHeight} · ${SPACING[id].after} pt`}
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
          <Group label="letter.group.paragraphLayout">
            <Drop big icon="lines" title="letter.lineNumbers" active={!!page.lineNumbers}>
              {close => <>
                <MenuItem active={!page.lineNumbers} label={t('letter.lineNumbers.none')} onClick={() => { setPage({ ...page, lineNumbers: null }); close(); }} />
                {LINE_NUMBERS.map(id => (
                  <MenuItem key={id} active={page.lineNumbers === id} label={t(`letter.lineNumbers.${id}` as MessageKey)}
                    onClick={() => { setPage({ ...page, lineNumbers: id }); close(); }} />
                ))}
              </>}
            </Drop>
            <Drop big icon="rtl" title="letter.textDirection" active={!!page.rtl}>
              {close => (['ltr', 'rtl'] as const).map(d => (
                <MenuItem key={d} active={!!page.rtl === (d === 'rtl')} label={t(`letter.dir.${d}` as MessageKey)}
                  onClick={() => { setPage({ ...page, rtl: d === 'rtl' || undefined }); close(); }} />
              ))}
            </Drop>
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
          <Group label="letter.group.citations">
            <Btn big icon="cite" title="letter.citeInsert" onClick={() => actions.newCitation(false)} disabled={!isBody} />
            <div className="stack">
              <Drop icon="cite" title="letter.citeStyle" text label={<span className="rb-label">{CITATION_STYLES[actions.citeStyle].label}</span>}>
                {close => CITATION_STYLE_IDS.map(id => (
                  <MenuItem key={id} active={actions.citeStyle === id} label={CITATION_STYLES[id].label}
                    onClick={() => { actions.setCiteStyle(id); close(); }} />
                ))}
              </Drop>
              <Drop icon="next" title="letter.citeAgain" text>
                {close => {
                  const list = actions.citedSources();
                  return list.length ? list.map(src => (
                    <MenuItem key={src.id} label={src.title} hint={src.year} onClick={() => { actions.cite(src); close(); }} />
                  )) : <p className="muted menu-note">{t('letter.citeNone')}</p>;
                }}
              </Drop>
              <Btn icon="sparkle" title="letter.sourceAi" text onClick={() => actions.newCitation(true)} disabled={!isBody} />
            </div>
            <Btn big icon="apps" title="letter.refModels" onClick={actions.refModels} disabled={!isBody} />
            <Btn big icon="check" title="letter.refCheck" onClick={actions.refCheck} disabled={!isBody} />
            <Drop big icon="book" title="letter.bibliography">
              {close => BIBLIOGRAPHY_TITLES.map(id => (
                <MenuItem key={id} label={t(`letter.bib.${id}` as MessageKey)} onClick={() => { actions.bibliography(t(`letter.bib.${id}` as MessageKey)); close(); }} />
              ))}
            </Drop>
          </Group>
          <Group label="letter.group.captions">
            <Drop big icon="caption" title="letter.captionInsert">
              {close => <div className="menu-columns">{CAPTION_LABELS.map(id => (
                <MenuItem key={id} label={t(`letter.caption.${id}` as MessageKey)} onClick={() => { close(); actions.caption(id); }} />
              ))}</div>}
            </Drop>
            <div className="stack">
              <Btn icon="toc" title="letter.tof" text onClick={actions.tableOfFigures} disabled={!isBody} />
              <Drop icon="crossref" title="letter.crossRef" text>
                {close => {
                  const targets = actions.refTargets();
                  if (!targets.length) return <p className="muted menu-note">{t('letter.crossRefNone')}</p>;
                  return <CrossRefMenu targets={targets} onPick={(tg, f) => { actions.crossRef(tg, f); close(); }} />;
                }}
              </Drop>
            </div>
          </Group>
          <Group label="letter.group.index">
            <Btn big icon="index" title="letter.indexMark" onClick={actions.markIndex} disabled={!isBody} />
            <Btn big icon="book" title="letter.indexInsert" onClick={actions.insertIndex} disabled={!isBody} />
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
            {proofTools}
            <Btn big icon="count" title="letter.wordCount" onClick={actions.wordCount} />
          </Group>
          <Group label="letter.group.speech">
            <Btn big icon="speak" title={suite.speaking ? 'letter.readAloudStop' : 'letter.readAloud'} onClick={actions.readAloud} active={suite.speaking} />
          </Group>
          <Group label="letter.group.language">
            <Drop big icon="language" title="letter.language">
              {close => PROOF_TAGS.map(l => (
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
              {close => CLEAN_UPS.map(w => (
                <MenuItem key={w} label={t(`letter.cleanUp.${w}` as MessageKey)} onClick={() => { actions.cleanUp(w); close(); }} />
              ))}
            </Drop>
            <div className="stack">
              <Btn icon="sort" title="letter.sortAZ" text onClick={() => actions.sort(1)} />
              <Btn icon="sort" title="letter.sortZA" text onClick={() => actions.sort(-1)} />
              <Drop icon="case" title="letter.changeCase" text>
                {close => CASE_MODES.map(m => (
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

        {shownTab === 'docs' && <>
          <Group label="letter.group.proLetters">
            <TemplateDrop cat="admin" icon="envelope" suite={suite} actions={actions} />
            <TemplateDrop cat="gov" icon="gov" suite={suite} actions={actions} />
            <TemplateDrop cat="mil" icon="shield" suite={suite} actions={actions} />
          </Group>
          <Group label="letter.group.normalLetters">
            <TemplateDrop cat="perso" icon="heart" suite={suite} actions={actions} />
          </Group>
          <Group label="letter.group.cv">
            <Drop big icon="cv" title="letter.docs.cv">
              {close => CV_TEMPLATES.map(c => (
                <MenuItem key={c.id} label={c.title[getLanguage()]} onClick={() => { actions.docTemplate(c.id); close(); }} />
              ))}
            </Drop>
          </Group>
          <Group label="letter.group.fill">
            <Btn big icon="fill" title="letter.docs.fill" onClick={actions.fillFields} disabled={!suite.fields} />
            <div className="stack">
              <Btn icon="next" title="letter.docs.nextField" text onClick={actions.nextField} disabled={!suite.fields} />
              <Btn icon="user" title="letter.docs.profile" text onClick={actions.profile} />
              <span className="docs-count">{t('letter.docs.left', { n: suite.fields })}</span>
            </div>
          </Group>
          <Group label="letter.group.docAi">
            <Btn big icon="sparkle" title="letter.docs.aiWrite" onClick={() => actions.docAi('docWrite')} />
            <Btn big icon="pen" title="letter.docs.aiFill" onClick={() => actions.docAi('fillAi')} disabled={!suite.fields} />
          </Group>
          <Group label="letter.group.docLang">
            <div className="stack">
              <Btn icon="language" title="Français" label="Français" text active={suite.docLang === 'fr'} onClick={() => actions.docLang('fr')} />
              <Btn icon="language" title="English" label="English" text active={suite.docLang === 'en'} onClick={() => actions.docLang('en')} />
            </div>
          </Group>
        </>}

        {shownTab === 'oi1' && <>
          <Group label="letter.group.withClass">
            <Btn big icon="sheet" title={suite.linkedTable ? 'letter.openLinkedSheet' : 'letter.editInClass'} onClick={actions.editInClass} disabled={!s.inTable} />
            <SheetDrop suite={suite} actions={actions} />
            <Btn big icon="new" title="letter.newSheet" onClick={actions.newSheet} />
          </Group>
          <Group label="letter.group.withStage">
            <Btn big icon="stage" title="letter.makeSlides" onClick={actions.makeSlides} />
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

/** One category of ready-to-fill letters. */
function TemplateDrop({ cat, icon, actions }: { cat: LetterCat; icon: string; suite: SuiteState; actions: RibbonActions }) {
  return (
    <Drop big icon={icon} title={`letter.docs.${cat}` as MessageKey}>
      {close => LETTERS.filter(l => l.cat === cat).map(l => (
        <MenuItem key={l.id} label={l.title[getLanguage()]} onClick={() => { actions.docTemplate(l.id); close(); }} />
      ))}
    </Drop>
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

/** One theme in the Design gallery: its page, title and heading colors, like Word's theme tiles. */
function ThemeTile({ th, on, onPick }: { th: (typeof THEMES)[number]; on: boolean; onPick: (th: (typeof THEMES)[number]) => void }) {
  return (
    <button type="button" role="option" aria-selected={on}
      className={`theme-tile${on ? ' on' : ''}`} onClick={() => onPick(th)} title={t(th.name)}
      style={{ background: th.page ?? '#FFFFFF', color: th.styles.normal.color ?? (isDark(th.page) ? '#FFFFFF' : '#000000') }}>
      <span className="theme-title" style={previewStyle({ ...th.styles.normal, ...th.styles.title, size: 15 }, th.styles.normal)}>Aa</span>
      <span className="theme-lines"><i style={{ background: th.styles.h1.color ?? '#2F5496' }} /><i /><i /></span>
      <span className="theme-name">{t(th.name)}</span>
    </button>
  );
}

/** References > Cross-reference: pick what to point to, then how the text says it. */
function CrossRefMenu({ targets, onPick }: { targets: RefTarget[]; onPick: (target: RefTarget, form: RefForm) => void }) {
  const [form, setForm] = useState<RefForm>('see');
  return <>
    <div className="seg-row" role="radiogroup" aria-label={t('letter.crossRef')}>
      {REF_FORMS.map(f => (
        <button key={f} type="button" role="radio" aria-checked={form === f} className={form === f ? 'on' : ''} onClick={() => setForm(f)}>
          {t(`letter.refForm.${f}` as MessageKey)}
        </button>
      ))}
    </div>
    <hr />
    {targets.map(tg => <MenuItem key={`${tg.kind}${tg.pos}`} label={tg.text} hint={t(tg.kind === 'heading' ? 'letter.source.title' : tg.kind === 'caption' ? 'letter.group.captions' : 'letter.footnoteInsert')} onClick={() => onPick(tg, form)} />)}
  </>;
}
