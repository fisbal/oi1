// The "Analyse et correction" pane (Martin, 2026-11-03): every remark on the work, grouped like a marker's sheet
// (the norm's layout, method, structure, sources, language), each with its fix, "Voir" to go to the place and
// "Ignorer". Text fixes go in as tracked changes; block fixes are one undo step each. The list reads the document again
// after every change, so it only ever shows what is left.
import type { Editor, JSONContent } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AiApi } from '../../shell/contract';
import { getLanguage, t, type MessageKey } from '../../shell/i18n';
import { Icon } from '../../ui/kit';
import { addRefs, aiChunks, aiFindings, aiPrompt, analyze, applyEdits, fixBreaks, fixEmpties, fixPages, fixStructure, type Finding, type Group } from './analysis';
import type { DocStyles } from './model';
import type { PageSettings } from './page';
import { normCheck } from './normCheck';
import { citeFamily, OFFICIAL_EXAMPLES } from './templates/models';
import { WORK_LAYOUTS, knownTitle } from './templates/works';
import { workText } from './templates/worksI18n';

const GROUPS: Group[] = ['layout', 'method', 'structure', 'sources', 'language'];

export interface AnalysisHost {
  applyNorm(id: string): void;
  pageNumber(id: string): void;
  reorganize(id: string): void;
  toc(at: number): void;
  fill(): void;
  openModel(id: string): void;
}

export function AnalysisPanel({ editor, workId, setWorkId, page, styles, header, footer, ai, host, onClose }: {
  editor: Editor;
  workId: string | null;
  setWorkId(id: string | null): void;
  page: PageSettings;
  styles: DocStyles;
  header: () => JSONContent | null;
  footer: () => JSONContent | null;
  ai: AiApi;
  host: AnalysisHost;
  onClose(): void;
}) {
  const lang = getLanguage();
  const w = WORK_LAYOUTS.find(x => x.id === workId) ?? null;
  const [version, setVersion] = useState(0);
  const [ignored, setIgnored] = useState<Set<string>>(() => new Set());
  const [aiLines, setAiLines] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState<Set<string>>(() => new Set());
  const stop = useRef<AbortController | null>(null);

  // Read again after each change, once the typing pauses.
  useEffect(() => {
    let timer = 0;
    const again = () => { clearTimeout(timer); timer = window.setTimeout(() => setVersion(v => v + 1), 450); };
    editor.on('update', again);
    return () => { clearTimeout(timer); editor.off('update', again); };
  }, [editor]);
  useEffect(() => () => stop.current?.abort(), []);

  const found = useMemo(() => {
    const doc = editor.state.doc;
    const tops = (editor.getJSON().content ?? []) as JSONContent[];
    const norm = w ? normCheck({ w, page, styles, tops, header: header(), footer: footer(), lang }) : [];
    const text = analyze(doc, { lang, known: knownTitle, work: !!w, cite: w ? citeFamily(w) : undefined });
    const all = aiChunks(doc, Number.MAX_SAFE_INTEGER)[0];
    const fromAi = all ? aiFindings(aiLines.join('\n'), all, 0).filter(f => !aiDone.has(String(f.vars?.wrong))) : [];
    return [...norm, ...text, ...fromAi].filter(f => !ignored.has(sig(f)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, w, page, styles, ignored, aiLines, aiDone, lang]);

  const example = w ? (OFFICIAL_EXAMPLES as Record<string, string>)[w.id] : undefined;
  const label = (f: Finding) => {
    const vars: Record<string, string | number> = { ...(f.vars ?? {}) };
    if (f.key === 'ana.n.head') vars.how = String(vars.how).split('|').map(x => t(`ana.how.${x}` as MessageKey)).join(', ');
    if (f.key === 'ana.n.pageNum') vars.where = t(`ana.where.${vars.where}` as MessageKey);
    return t(f.key as MessageKey, vars);
  };
  const canFix = (f: Finding) => !!f.edits?.length || (!!f.action && (f.action !== 'refs' || !!f.refs) && (!!w || !['norm', 'pagenum', 'reorganize'].includes(f.action)));

  const fix = (f: Finding) => {
    if (f.edits?.length) {
      applyEdits(editor, f.edits);
      if (f.key === 'ana.ai') setAiDone(s => new Set(s).add(String(f.vars?.wrong)));
    } else switch (f.action) {
      case 'structure': fixStructure(editor, lang, knownTitle); break;
      case 'refs': addRefs(editor, f.refs ?? [], lang); break;
      case 'empties': fixEmpties(editor); break;
      case 'pages': fixPages(editor); break;
      case 'breaks': fixBreaks(editor); break;
      case 'fill': host.fill(); break;
      case 'toc': host.toc(-1); break;
      case 'norm': if (w) host.applyNorm(w.id); break;
      case 'pagenum': if (w) host.pageNumber(w.id); break;
      case 'reorganize': if (w) host.reorganize(w.id); break;
    }
    setVersion(v => v + 1);
  };
  const fixGroup = (g: Group) => {
    const list = found.filter(f => f.group === g && canFix(f) && f.action !== 'fill');
    // Text fixes all at once (one tracked change each), then each kind of block fix once.
    const edits = list.flatMap(f => f.edits ?? []);
    const seen = new Set<string>();
    const unique = edits.filter(e => { const k = `${e.from}:${e.to}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .filter((e, i, arr) => !arr.some((o, j) => j !== i && o.from < e.to && e.from < o.to && j < i));
    if (unique.length) applyEdits(editor, unique);
    const ai = list.filter(f => f.key === 'ana.ai').map(f => String(f.vars?.wrong));
    if (ai.length) setAiDone(s => new Set([...s, ...ai]));
    const done = new Set<string>();
    for (const f of list) if (!f.edits?.length && f.action && !done.has(f.action)) {
      if (f.action !== 'refs') done.add(f.action);
      fix(f);
    }
    setVersion(v => v + 1);
  };
  const see = (f: Finding) => {
    if (f.at == null) return;
    const at = Math.min(Math.max(f.at, 1), editor.state.doc.content.size - 1);
    editor.chain().focus().setTextSelection(at).scrollIntoView().run();
  };

  // The AI pass, only with an AI that answers in text (not a website).
  const aiOk = ai.ready() && ai.provider?.().kind !== 'web';
  const runAi = async () => {
    const chunks = aiChunks(editor.state.doc);
    if (!chunks.length) return;
    stop.current?.abort();
    const ctl = new AbortController();
    stop.current = ctl;
    const lines: string[] = [];
    try {
      for (let i = 0; i < chunks.length; i++) {
        setAiBusy(t('ana.aiBusy', { n: i + 1, total: chunks.length }));
        const answer = await ai.ask({ system: aiPrompt(lang), messages: [{ role: 'user', content: chunks[i].text }], signal: ctl.signal, effort: 'low' });
        lines.push(...answer.split('\n').filter(x => /⟶|→|->|=>/.test(x)));
        setAiLines([...lines]);
      }
      setAiBusy(lines.length ? null : t('ana.aiNone'));
    } catch {
      setAiBusy(null);
    }
  };

  const counts = GROUPS.map(g => [g, found.filter(f => f.group === g)] as const).filter(([, l]) => l.length);
  return (
    <aside className="comments-pane ana-pane" aria-label={t('ana.open')} data-analysis>
      <header><span className="kicker">{t('ana.open')}</span><button type="button" onClick={onClose} aria-label={t('letter.close')}>×</button></header>
      <label className="ana-norm">
        <span>{t('ana.norm')}</span>
        <select value={workId ?? ''} onChange={e => setWorkId(e.target.value || null)}>
          <option value="">{t('ana.noNorm')}</option>
          {WORK_LAYOUTS.map(x => <option key={x.id} value={x.id}>{workText(x.name.fr, x.name.en, lang)}</option>)}
        </select>
      </label>
      {w && (
        <div className="ana-tools">
          <button type="button" className="primary" data-apply-norm onClick={() => { host.applyNorm(w.id); setVersion(v => v + 1); }}><Icon name="check" size={14} /> {t('ana.applyNorm')}</button>
          <button type="button" title={t('ana.modelHint')} data-model onClick={() => host.openModel(w.id)}>{t('ana.model')}</button>
          {example && <a href={example} target="_blank" rel="noreferrer noopener">{t('ana.example')}</a>}
        </div>
      )}
      <p className={`ana-sum${found.length ? '' : ' clean'}`} role="status">{found.length ? t('ana.summary', { n: found.length }) : t('ana.clean')}</p>
      {counts.map(([g, list]) => (
        <section key={g} className="ana-group" data-group={g}>
          <div className="ana-ghead">
            <h3>{t(`ana.g.${g}` as MessageKey)} <em>{list.length}</em></h3>
            {list.filter(canFix).length > 1 && <button type="button" onClick={() => fixGroup(g)}>{t('ana.fixAll')}</button>}
          </div>
          {list.map(f => (
            <div key={f.id + sig(f)} className="cmt-card ana-card" data-key={f.key}>
              <p className="ana-msg">{label(f)}</p>
              {f.excerpt && <pre className="ana-ex">{f.excerpt}</pre>}
              <div className="cmt-actions">
                {f.at != null && <button type="button" onClick={() => see(f)}>{t('ana.see')}</button>}
                <button type="button" onClick={() => setIgnored(s => new Set(s).add(sig(f)))}>{t('ana.ignore')}</button>
                {canFix(f) && <button type="button" className="primary" onClick={() => fix(f)}>{t('ana.fix')}</button>}
              </div>
            </div>
          ))}
        </section>
      ))}
      <div className="ana-foot">
        {aiOk && <button type="button" disabled={!!aiBusy && aiBusy !== t('ana.aiNone')} onClick={() => void runAi()}><Icon name="sparkle" size={14} /> {t('ana.aiCheck')}</button>}
        {aiBusy && <p className="muted" role="status">{aiBusy}</p>}
        <p className="muted">{t('ana.tracked')}</p>
      </div>
    </aside>
  );
}

const sig = (f: Finding) => `${f.key}|${f.excerpt ?? ''}|${JSON.stringify(f.vars ?? {})}`;
