// The "Convert" ribbon tab, the same in In 1 Letter, Class, Stage and Code+ (Martin, 2026-11-01). Five rows of
// targets (the other Offices, documents, data, slides and pictures), sharing, "Convert a file…", and the language of
// the result: pick one of 38 languages and every conversion is translated, "Translate here" translates this document
// (the original is always kept and comes back with "Original text"), "Translated copy" opens a translated copy.

import { useState } from 'react';
import type { ShellApi } from '../../shell/contract';
import {
  BASE_CSS, CONVERT_LANGS, MIME, TARGETS, asFile, bookFromTables, deckFromPrepared, docxFromHtml, langLabel, prepare, safeName, webPage,
  type ConvertSource, type TargetId,
} from '../../shell/convert';
import { aiTranslator, bestTranslator, detectLanguage, originalOf, restoreOriginal, translateFromOriginal, translatorFor, type TranslateTexts } from '../../shell/translate';
import { getLanguage, t, type MessageKey } from '../../shell/i18n';
import { useLanguage } from '../../shell/useLanguage';
import { Btn, Dialog, Drop, Group, MenuItem } from '../kit';
import { appColor } from '../AppKeys';
import { htmlPages, pagesToImages, pagesToPdf, printPage, type Raster } from './render';
import { CONVERT_FILE_TYPES, fileSource } from './fileSource';
import './convert.css';

const LANG_KEY = 'oi1.convert.lang';
const savedLang = () => { try { return localStorage.getItem(LANG_KEY) ?? ''; } catch { return ''; } };

const label = (id: TargetId) => t(`convert.to.${id}` as MessageKey);

/** Runs one conversion. `lang` is '' for no translation. */
export async function runConvert(shell: ShellApi, src: ConvertSource, target: TargetId, lang: string): Promise<string | null> {
  let tr: TranslateTexts | null = null;
  if (lang) {
    const from = (await detectLanguage([src.title(), src.html().replace(/<[^>]+>/g, ' ')])) ?? getLanguage();
    tr = from === lang ? null : await bestTranslator(lang, from, () => aiTranslator(shell.ai, lang));
  }
  const p = await prepare(src, tr);
  const base = safeName(p.title) + (lang ? ` (${lang})` : '');
  const docLang = lang || getLanguage();
  const css = BASE_CSS + (src.css?.() ?? '');
  const save = async (blob: Blob | string, ext: string, mime: string, name = `${base}.${ext}`) => {
    await shell.saveFile(name, blob, mime, { saveAs: true });
    return name;
  };
  const native = src.native?.[target];
  if (native) {
    const got = await native(tr);
    if (got instanceof Blob) { const tg = TARGETS.find(x => x.id === target)!; return save(got, tg.ext ?? 'bin', MIME[target] ?? got.type); }
    if (got === true) return target;
  }
  const xlsxFile = async () => {
    const { xlsxBytes } = await import('../../formats/xlsx');
    const book = (await src.book?.(tr)) ?? await bookFromTables(p.tables, p.text ?? (await import('../../formats/textFormats')).htmlToText(p.html));
    return new Blob([await xlsxBytes(book, docLang)], { type: MIME.xlsx });
  };
  const pptxFile = async () => {
    const { writePptx } = await import('../../formats/pptx');
    return writePptx((await src.deck?.(tr)) ?? await deckFromPrepared(p), docLang, p.title);
  };
  const pages = async () => src.pages ? src.pages(tr) : htmlPages(p.html, css);
  const tf = () => import('../../formats/textFormats');

  switch (target) {
    case 'letter': {
      const docx = src.native?.docx && await src.native.docx(tr);
      if (docx instanceof Blob) shell.openModule('letter', asFile(`${base}.docx`, docx));
      else shell.openModule('letter', undefined, { kind: 'html', title: p.title, html: p.html });
      return target;
    }
    case 'class': shell.openModule('class', asFile(`${base}.xlsx`, await xlsxFile())); return target;
    case 'stage': shell.openModule('stage', asFile(`${base}.pptx`, await pptxFile())); return target;
    case 'code':
      if (p.tables.length && src.appId === 'class') shell.openModule('code', undefined, { kind: 'table', title: p.title, table: p.tables[0].table });
      else shell.openModule('code', undefined, { kind: 'html', title: p.title, html: p.html });
      return target;
    case 'docx': return save(await docxFromHtml(p.html, p.title), 'docx', MIME.docx!);
    case 'pdf': printPage(webPage(p.title, p.html, css, docLang)); return target;
    case 'pdfimg': { const pg = await pages(); try { return await save(await pagesToPdf(pg, p.title), 'pdf', MIME.pdf!); } finally { pg.done(); } }
    case 'html': return save(webPage(p.title, p.html, css, docLang), 'html', MIME.html!);
    case 'md': return save((await tf()).htmlToMarkdown(p.html), 'md', MIME.md!);
    case 'txt': return save(p.text ?? (await tf()).htmlToText(p.html), 'txt', MIME.txt!);
    case 'rtf': return save((await tf()).htmlToRtf(p.html, p.title), 'rtf', MIME.rtf!);
    case 'epub': return save(await (await tf()).htmlToEpub(p.html, p.title, docLang), 'epub', MIME.epub!);
    case 'xlsx': return save(await xlsxFile(), 'xlsx', MIME.xlsx!);
    case 'csv': case 'tsv': {
      const { toCsv } = await import('../../formats/csv');
      const tables = p.tables.length ? p.tables : (await tf()).tablesInHtml(p.html).map((table, i) => ({ name: `${i + 1}`, table }));
      const rows = tables.length ? tables.flatMap((x, i) => [...(i ? [[]] : []), ...x.table.rows.map(r => r.map(c => c.text))])
        : (p.text ?? (await tf()).htmlToText(p.html)).split('\n').filter(Boolean).map(l => [l]);
      const body = toCsv(rows, target === 'tsv' ? '\t' : ',');
      return save(target === 'csv' ? `﻿${body}` : body, target, MIME[target]!);
    }
    case 'json': return save((await tf()).toJson(p.title, p.html, p.tables), 'json', MIME.json!);
    case 'xml': return save((await tf()).toXml(p.title, p.html, p.tables), 'xml', MIME.xml!);
    case 'pptx': return save(await pptxFile(), 'pptx', MIME.pptx!);
    case 'png': case 'jpeg': case 'webp': case 'svg': {
      const pg = await pages();
      try {
        const { name, blob } = await pagesToImages(pg, target as Raster, base);
        return await save(blob, '', blob.type || 'application/zip', name);
      } finally { pg.done(); }
    }
    case 'copy': case 'email': {
      const text = p.text ?? (await tf()).htmlToText(p.html);
      const html = `<div>${p.html}</div>`;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      } catch { try { await navigator.clipboard.writeText(text); } catch { /* blocked: the e-mail still gets the text */ } }
      if (target === 'email') {
        const bodyText = text.length > 1800 ? `${text.slice(0, 1800)}…\n\n(${t('convert.emailCut')})` : text;
        window.location.href = `mailto:?subject=${encodeURIComponent(p.title)}&body=${encodeURIComponent(bodyText)}`;
      }
      return target;
    }
    case 'print': printPage(webPage(p.title, p.html, css, docLang)); return target;
  }
  return null;
}

export function ConvertPanel({ shell, source }: { shell: ShellApi; source: ConvertSource }) {
  useLanguage();
  const [lang, setLangState] = useState(savedLang);
  const [busy, setBusy] = useState<string | null>(null);
  const [fileSrc, setFileSrc] = useState<ConvertSource | null>(null);
  const ui = getLanguage();
  const setLang = (l: string) => { setLangState(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* blocked */ } };
  const langName = lang ? langLabel(lang, ui) : t('convert.sameLang');

  const go = async (target: TargetId, src: ConvertSource = source) => {
    if (busy) return;
    setBusy(target);
    shell.notify(lang ? t('convert.translating', { lang: langLabel(lang, ui) }) : t('convert.working'));
    try {
      const done = await runConvert(shell, src, target, lang);
      if (done) shell.notify(t('convert.done', { what: label(target) }));
    } catch (e) {
      shell.notify(t('convert.failed', { error: e instanceof Error ? e.message : String(e) }));
    } finally { setBusy(null); }
  };

  const doc = translatorFor(shell.tabId);
  const translateHere = async () => {
    if (!doc || !lang || busy) return;
    setBusy('here');
    shell.notify(t('convert.translating', { lang: langLabel(lang, ui) }));
    try {
      const { n, restored } = await translateFromOriginal(shell.tabId, doc, lang, ui, from => bestTranslator(lang, from, () => aiTranslator(shell.ai, lang)));
      shell.notify(restored ? t('lang.restored') : n ? t('lang.translated', { n }) : t('lang.nothing'));
    } catch (e) { shell.notify(t('lang.failed', { error: e instanceof Error ? e.message : String(e) })); }
    finally { setBusy(null); }
  };
  const restore = async () => {
    if (doc && await restoreOriginal(shell.tabId, doc)) shell.notify(t('lang.restored'));
    else shell.notify(t('convert.noOriginal'));
  };
  const copyTarget: TargetId = source.appId === 'file' || source.appId === 'notes' || source.appId === 'form' ? 'letter' : source.appId === 'plan' ? 'class' : source.appId === 'draw' || source.appId === 'image' ? 'png' : source.appId;
  const pickFile = async () => {
    const f = await shell.openFile(CONVERT_FILE_TYPES);
    if (!f) return;
    try { setFileSrc(await fileSource(f, ui)); } catch (e) { shell.notify(t('convert.failed', { error: e instanceof Error ? e.message : String(e) })); }
  };

  const btn = (id: TargetId, src: ConvertSource, big = false) => {
    const tg = TARGETS.find(x => x.id === id)!;
    return <Btn key={id} big={big} text={!big} icon={tg.icon} title={`convert.to.${id}`} onClick={() => go(id, src)} disabled={!!busy} />;
  };
  const stacks = (ids: TargetId[], src: ConvertSource) => {
    const out = [];
    for (let i = 0; i < ids.length; i += 3) out.push(<div key={i} className="stack">{ids.slice(i, i + 3).map(id => btn(id, src))}</div>);
    return out;
  };
  const groups = (src: ConvertSource, inDialog = false) => {
    const apps = (['letter', 'class', 'stage', 'code'] as const).filter(a => inDialog || a !== src.appId);
    return <>
      <Group label="convert.group.apps" accent={appColor(apps[0])}>{apps.map(a => btn(a, src, true))}</Group>
      <Group label="convert.group.docs">{stacks(['docx', 'pdf', 'pdfimg', 'html', 'md', 'txt', 'rtf', 'epub'], src)}</Group>
      <Group label="convert.group.data">{stacks(['xlsx', 'csv', 'tsv', 'json', 'xml'], src)}</Group>
      <Group label="convert.group.slides">{btn('pptx', src, true)}</Group>
      <Group label="convert.group.images">{stacks(['png', 'jpeg', 'webp', 'svg'], src)}</Group>
    </>;
  };

  return <>
    <Group label="convert.group.lang" accent="#7C6CF2">
      <Drop big icon="language" title="convert.lang" label={<span className="rb-label cv-lang-label">{langName}</span>} wide>
        {close => <div className="cv-langs">
          <MenuItem label={t('convert.sameLang')} active={!lang} onClick={() => { setLang(''); close(); }} />
          {CONVERT_LANGS.map(l => <MenuItem key={l} label={langLabel(l, ui)} active={lang === l} hint={l} onClick={() => { setLang(l); close(); }} />)}
        </div>}
      </Drop>
      <div className="stack">
        <Btn text icon="language" title="convert.translateHere" onClick={() => void translateHere()} disabled={!doc || !lang || !!busy} />
        <Btn text icon="new" title="convert.translateCopy" onClick={() => void go(copyTarget)} disabled={!lang || !!busy} />
        <Btn text icon="undo" title="convert.original" onClick={() => void restore()} disabled={!doc || !originalOf(shell.tabId)} />
      </div>
    </Group>
    {groups(source)}
    <Group label="convert.group.share">
      <Btn big icon="upload" title="convert.file" onClick={() => void pickFile()} disabled={!!busy} />
      {stacks(['email', 'copy', 'print'], source)}
    </Group>
    {fileSrc && (
      <Dialog title={t('convert.fileTitle', { name: fileSrc.title() })} onClose={() => setFileSrc(null)}>
        <p className="cv-note">{lang ? t('convert.fileLang', { lang: langName }) : t('convert.fileHint')}</p>
        <div className="cv-file-grid ribbon-panel">{groups(fileSrc, true)}</div>
      </Dialog>
    )}
  </>;
}
