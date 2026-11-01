// In 1 Assistant (Martin, 2026-11-01): the AI of Office In 1, an app of its own. You say a task in plain words,
// like "a budget and a letter for the bank"; it plans it, shows the plan as cards you can change, then makes each
// document in the right Office (Letter, Class, Stage, Code+, a PDF for ProDFos) and links them (a Class table
// inside a letter stays the same on both sides). It does not replace the copilot each app has: that one helps
// inside a document, this one makes the documents. Without any AI it still makes 25 everyday tasks from recipes.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Handoff, ShellApi } from '../../shell/contract';
import { getLanguage, t, type MessageKey } from '../../shell/i18n';
import { useLanguage } from '../../shell/useLanguage';
import { modules } from '../../shell/modules';
import { safeHtml } from '../../shell/safeHtml';
import { chatPrompt, planFromAnswer, readySteps, SCHEMA, SYSTEM, taskMessage, type Plan, type Step, type StepApp } from './plan';
import { matchRecipe, recipePlan, RECIPES, type Recipe, type RecipeLang } from './recipes';
import { runPlan, savePdf, type Made, type StepState } from './run';

type Phase = 'home' | 'planning' | 'plan' | 'running' | 'done';
interface Attached { name: string; text: string }
interface Saved { id: string; task: string; title: string; time: number; plan: Plan | null }

const HISTORY = 'oi1.assistant.history';
const NO_AI = 'oi1.assistant.noAi';
const TEXT_EXT = ['.txt', '.md', '.csv', '.tsv', '.json', '.html', '.htm', '.xml'];

function loadHistory(): Saved[] {
  try { const v = JSON.parse(localStorage.getItem(HISTORY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveHistory(list: Saved[]) {
  // Plans are kept while they fit; the oldest go first.
  let keep = list.slice(0, 20);
  for (;;) {
    try { localStorage.setItem(HISTORY, JSON.stringify(keep)); return; } catch {
      if (!keep.length) return;
      keep = keep.slice(0, -1);
    }
  }
}

export const appLook = (app: StepApp) => {
  const id = app === 'pdf' ? 'prodfos' : app;
  const m = modules.find(x => x.id === id)!;
  return { name: app === 'pdf' ? 'PDF · ProDFos' : m.name, badge: app === 'pdf' ? 'PDF' : m.badge, color: m.code };
};

const ideaKey = (id: string) => `assistant.idea.${id}` as MessageKey;

/** The plan's words in the person's language when the recipe has none (Spanish, Portuguese, German). */
async function translatePlan(plan: Plan, to: string): Promise<Plan> {
  const { bestTranslator, translateHtml } = await import('../../shell/translate');
  const tr = await bestTranslator(to, 'en', () => async texts => texts);
  const names = await tr(plan.steps.flatMap(s => [s.name, s.purpose]));
  const htmls = await translateHtml(plan.steps.map(s => s.html), tr);
  const cells: string[] = [];
  plan.steps.forEach(s => s.rows.forEach(r => r.forEach(c => { if (c && !c.startsWith('=') && /\p{L}{2,}/u.test(c)) cells.push(c); })));
  const got = cells.length ? await tr(cells) : [];
  let k = 0;
  return {
    ...plan,
    steps: plan.steps.map((s, i) => ({
      ...s, name: names[2 * i] || s.name, purpose: names[2 * i + 1] || s.purpose, html: htmls[i] ?? s.html,
      rows: s.rows.map(r => r.map(c => (c && !c.startsWith('=') && /\p{L}{2,}/u.test(c) ? got[k++] || c : c))),
    })),
  };
}

export default function Assistant({ shell, handoff }: { shell: ShellApi; handoff?: Handoff }) {
  useLanguage();
  const lang = getLanguage();
  const [task, setTask] = useState(handoff?.kind === 'html' ? textOf(handoff.html) : '');
  const [files, setFiles] = useState<Attached[]>([]);
  const [noAi, setNoAi] = useState(() => { try { return localStorage.getItem(NO_AI) === '1'; } catch { return false; } });
  const [phase, setPhase] = useState<Phase>('home');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [fromRecipe, setFromRecipe] = useState(false);
  const [written, setWritten] = useState(0);
  const [error, setError] = useState('');
  const [fallback, setFallback] = useState<Recipe | null>(null);
  const [states, setStates] = useState<Record<string, StepState>>({});
  const [made, setMade] = useState<Made[]>([]);
  const [history, setHistory] = useState<Saved[]>(loadHistory);
  const [listening, setListening] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const stop = useRef<AbortController | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const aiOn = !noAi && shell.ai.ready();
  // An AI's public chat (claude.ai, ChatGPT…) means leaving the app and pasting back, and the browser's small
  // built-in model writes less well than a template: worth it only when no built-in template does the task.
  const kind = shell.ai.provider?.().kind;
  const viaWebsite = kind === 'web' || kind === 'browser';
  const aiName = shell.ai.provider?.().name ?? 'Claude';

  useEffect(() => { shell.setTitle(t('assistant.tabTitle')); }, [shell, lang]);
  // "Je veux…" and other apps hand a task over.
  useEffect(() => shell.onReceive(h => {
    if (h.kind !== 'html') return false;
    setTask(textOf(h.html)); setPhase('home'); setPlan(null); setError('');
    setTimeout(() => box.current?.focus(), 0);
    return true;
  }), [shell]);

  // The plan and the results come into view (below the box on a phone).
  const planBox = useRef<HTMLElement>(null);
  useEffect(() => { if (phase === 'plan' || phase === 'done') planBox.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [phase]);

  const titles = useMemo(() => Object.fromEntries(RECIPES.map(r => [r.id, t(ideaKey(r.id))])), [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const remember = (p: Plan, words: string) => {
    const item: Saved = { id: `h${Date.now().toString(36)}`, task: words, title: p.title || words.slice(0, 80), time: Date.now(), plan: p };
    const next = [item, ...history.filter(h => h.task !== words || h.title !== item.title)].slice(0, 20);
    setHistory(next); saveHistory(next);
  };

  const showPlan = (p: Plan, recipe: boolean) => {
    setPlan(p); setFromRecipe(recipe); setStates({}); setMade([]); setOpen(null); setPhase('plan');
  };

  const fromRecipePlan = async (r: Recipe, words: string) => {
    const rl: RecipeLang = lang === 'fr' ? 'fr' : 'en';
    let p = recipePlan(r, rl, t(ideaKey(r.id)));
    if (lang !== 'fr' && lang !== 'en') {
      setPhase('planning'); setWritten(0);
      try { p = await translatePlan(p, lang); } catch { /* stays in English */ }
    }
    p.summary = t('assistant.recipeSummary');
    showPlan(p, true);
    remember(p, words);
  };

  /**
   * Does the task. An idea card, or words a built-in template knows when the AI is only a website away, is made at
   * once from the template, offline (Martin's phone, 2026-11-01: a thank-you card sent him to the Claude app with
   * a page of code). `withAi` asks the AI anyway ("Redo it with the AI").
   */
  const make = async (words = task, recipe?: Recipe, withAi = false) => {
    const what = words.trim();
    setError(''); setFallback(null);
    if (!what && !recipe) { box.current?.focus(); return; }
    if (recipe && !withAi) { await fromRecipePlan(recipe, what || t(ideaKey(recipe.id))); return; }
    if (aiOn && viaWebsite && !withAi) {
      const r = matchRecipe(what, titles);
      if (r) { await fromRecipePlan(r, what); return; }
    }
    if (!aiOn) {
      const r = recipe ?? matchRecipe(what, titles);
      if (r) { await fromRecipePlan(r, what || t(ideaKey(r.id))); return; }
      setError(t('assistant.noRecipe'));
      return;
    }
    const ask = what || t(ideaKey(recipe!.id));
    setPhase('planning'); setWritten(0);
    const ctl = new AbortController();
    stop.current = ctl;
    try {
      const answer = await shell.ai.ask({
        system: SYSTEM, schema: SCHEMA, effort: 'medium', signal: ctl.signal,
        messages: [{ role: 'user', content: taskMessage(ask, files) }],
        chatPrompt: chatPrompt(ask, files, lang),
        onText: so => setWritten(so.length),
      });
      const p = planFromAnswer(answer, ask);
      if (!readySteps(p).length) throw new Error(t('assistant.emptyPlan'));
      if (!p.title) p.title = ask.slice(0, 80);
      showPlan(p, false);
      remember(p, ask);
    } catch (e) {
      if (ctl.signal.aborted) { setPhase('home'); return; }
      setPhase('home');
      setError(`${t('assistant.aiFailed')} ${e instanceof Error ? e.message : String(e)}`);
      setFallback(recipe ?? matchRecipe(ask, titles));
    } finally { stop.current = null; }
  };

  const create = async () => {
    if (!plan) return;
    setPhase('running'); setMade([]);
    const ready = new Set(readySteps(plan).map(s => s.id));
    setStates(Object.fromEntries(plan.steps.filter(s => ready.has(s.id)).map(s => [s.id, 'wait' as StepState])));
    const out = await runPlan(shell, plan, (id, s) => setStates(st => ({ ...st, [id]: s })));
    setMade(out);
    setPhase('done');
  };

  const editStep = (id: string, patch: Partial<Step>) => setPlan(p => (p ? { ...p, steps: p.steps.map(s => (s.id === id ? { ...s, ...patch } : s)) } : p));

  const attach = async () => {
    const f = await shell.openFile(TEXT_EXT);
    if (!f) return;
    const text = await f.text();
    setFiles(list => [...list.filter(x => x.name !== f.name), { name: f.name, text: f.name.match(/\.html?$/i) ? textOf(text) : text }]);
  };

  const Speech = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
  const rec = useRef<SpeechRec | null>(null);
  const dictate = () => {
    if (!Speech) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new Speech();
    r.lang = ({ en: 'en-US', fr: 'fr-FR', es: 'es-ES', pt: 'pt-BR', de: 'de-DE' } as Record<string, string>)[lang] ?? 'en-US';
    r.interimResults = false;
    r.onresult = e => { const said = Array.from(e.results).map(x => x[0].transcript).join(' '); setTask(v => (v ? `${v} ${said}` : said)); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  const reset = () => { setPhase('home'); setPlan(null); setMade([]); setError(''); setFallback(null); setTask(''); setFiles([]); setTimeout(() => box.current?.focus(), 0); };
  const openTab = (tabId: string | null) => { if (tabId && shell.tabs().some(x => x.tabId === tabId)) shell.showTab(tabId); else shell.notify(t('assistant.tabClosed')); };

  const busy = phase === 'planning' || phase === 'running';
  return (
    <div className="as" data-phase={phase}>
      <div className="as-scroll">
        <header className="as-head">
          <span className="as-orb" aria-hidden="true">✦</span>
          <div>
            <h1>In 1 Assistant</h1>
            <p>{t('assistant.lead')}</p>
          </div>
        </header>

        <section className="as-ask" aria-label={t('assistant.askLabel')}>
          <textarea ref={box} className="as-input" value={task} disabled={busy} rows={3} placeholder={t('assistant.placeholder')} aria-label={t('assistant.askLabel')}
            onChange={e => setTask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void make(); } }} />
          {files.length > 0 && (
            <div className="as-files">
              {files.map(f => (
                <span key={f.name} className="as-chip">📎 {f.name}
                  <button type="button" aria-label={t('assistant.removeFile', { name: f.name })} onClick={() => setFiles(l => l.filter(x => x.name !== f.name))}>×</button>
                </span>
              ))}
            </div>
          )}
          <div className="as-bar">
            {Speech && (
              <button type="button" className={`as-tool${listening ? ' on' : ''}`} disabled={busy} onClick={dictate} title={t('assistant.dictateHelp')} data-help-text={t('assistant.dictateHelp')}>
                <span aria-hidden="true">🎤</span>{listening ? t('assistant.listening') : t('assistant.dictate')}
              </button>
            )}
            <button type="button" className="as-tool" disabled={busy} onClick={() => void attach()} title={t('assistant.attachHelp')} data-help-text={t('assistant.attachHelp')}>
              <span aria-hidden="true">📎</span>{t('assistant.attach')}
            </button>
            <label className="as-switch" title={t('assistant.noAiHelp')} data-help-text={t('assistant.noAiHelp')}>
              <input type="checkbox" checked={noAi} disabled={busy} onChange={e => { setNoAi(e.target.checked); try { localStorage.setItem(NO_AI, e.target.checked ? '1' : '0'); } catch { /* private mode */ } }} />
              <span className="as-track" aria-hidden="true" />{t('assistant.noAi')}
            </label>
            <span className="as-who">{aiOn ? t('assistant.withAi', { name: aiName }) : t('assistant.withRecipes')}</span>
            {phase === 'planning'
              ? <button type="button" className="as-go stop" onClick={() => stop.current?.abort()}>{t('assistant.stop')}</button>
              : <button type="button" className="as-go" disabled={busy} onClick={() => void make()} data-help-text={t('assistant.goHelp')}>{t('assistant.go')} ✦</button>}
          </div>
          {phase === 'planning' && <p className="as-note as-thinking" role="status">{written ? t('assistant.writing', { n: written.toLocaleString(lang) }) : t('assistant.planning')}</p>}
          {error && (
            <div className="as-error" role="alert">
              <p>{error}</p>
              {fallback && <button type="button" className="as-tool" onClick={() => void fromRecipePlan(fallback, task || t(ideaKey(fallback.id)))}>{t('assistant.useRecipe', { name: t(ideaKey(fallback.id)) })}</button>}
            </div>
          )}
        </section>

        {plan && phase !== 'home' && phase !== 'planning' && (
          <section ref={planBox} className="as-plan" aria-label={t('assistant.planLabel')}>
            <div className="as-plan-head">
              <h2>{plan.title}</h2>
              {plan.summary && <p>{plan.summary}</p>}
              {fromRecipe && <p className="as-note">{t('assistant.recipeNote')}</p>}
              {fromRecipe && phase === 'plan' && aiOn && (
                <button type="button" className="as-tool small as-redo" title={t('assistant.redoAiHelp')} data-help-text={t('assistant.redoAiHelp')} onClick={() => void make(task || plan.title, undefined, true)}>✦ {t('assistant.redoAi', { name: aiName })}</button>
              )}
            </div>
            <ol className="as-steps">
              {plan.steps.map((s, i) => {
                const look = appLook(s.app);
                const st = states[s.id];
                const m = made.find(x => x.stepId === s.id);
                const linkName = s.table ? plan.steps.find(x => x.id === s.table)?.name : s.from ? plan.steps.find(x => x.id === s.from)?.name : null;
                return (
                  <li key={s.id} className={`as-step${s.on ? '' : ' off'}${st ? ` st-${st}` : ''}`} style={{ '--app': look.color } as React.CSSProperties}>
                    <span className="as-badge" aria-hidden="true">{look.badge}</span>
                    <div className="as-step-main">
                      <div className="as-step-top">
                        <span className="as-app">{i + 1}. {look.name}</span>
                        {st && <span className="as-state" role="status">{t(`assistant.state.${st}` as MessageKey)}</span>}
                      </div>
                      {phase === 'plan'
                        ? <input className="as-name" value={s.name} aria-label={t('assistant.stepName')} onChange={e => editStep(s.id, { name: e.target.value })} />
                        : <strong className="as-name-done">{s.name}</strong>}
                      {s.purpose && <p className="as-purpose">{s.purpose}</p>}
                      {linkName && <p className="as-link">🔗 {s.app === 'pdf' ? t('assistant.madeFrom', { name: linkName }) : s.app === 'stage' ? t('assistant.copyOf', { name: linkName }) : t('assistant.linkedTo', { name: linkName })}</p>}
                      {m?.linked.length && s.app === 'class' ? <p className="as-link">🔗 {t('assistant.linkedTo', { name: m.linked.join(', ') })}</p> : null}
                      {m?.error && <p className="as-note as-bad">{m.error}</p>}
                      <div className="as-step-tools">
                        {phase === 'plan' && (
                          <label className="as-check"><input type="checkbox" checked={s.on} onChange={e => editStep(s.id, { on: e.target.checked })} />{t('assistant.include')}</label>
                        )}
                        <button type="button" className="as-tool small" aria-expanded={open === s.id} onClick={() => setOpen(o => (o === s.id ? null : s.id))}>{open === s.id ? t('assistant.hide') : t('assistant.preview')}</button>
                        {phase === 'done' && m && !m.error && s.app !== 'pdf' && <button type="button" className="as-tool small gold" onClick={() => openTab(m.tabId)}>{t('assistant.open')}</button>}
                        {phase === 'done' && s.app === 'pdf' && (
                          <button type="button" className="as-tool small gold" disabled={pdfBusy === s.id} onClick={async () => { setPdfBusy(s.id); try { await savePdf(shell, plan, s); } finally { setPdfBusy(null); } }}>
                            {pdfBusy === s.id ? t('assistant.pdfMaking') : t('assistant.savePdf')}
                          </button>
                        )}
                        {phase === 'done' && s.app === 'pdf' && <button type="button" className="as-tool small" onClick={() => shell.openModule('prodfos')}>{t('assistant.openProdfos')}</button>}
                      </div>
                      {open === s.id && <Preview step={s} />}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="as-plan-bar">
              {phase === 'plan' && <>
                <button type="button" className="as-go" disabled={!readySteps(plan).length} onClick={() => void create()}>{t('assistant.create', { n: readySteps(plan).length })}</button>
                <button type="button" className="as-tool" onClick={() => { setPhase('home'); setPlan(null); setTimeout(() => box.current?.focus(), 0); }}>{t('assistant.changeTask')}</button>
              </>}
              {phase === 'running' && <p className="as-note" role="status">{t('assistant.creating')}</p>}
              {phase === 'done' && <>
                <p className="as-done" role="status">✓ {t('assistant.doneNote', { n: made.filter(m => !m.error).length })}</p>
                <button type="button" className="as-go" onClick={reset}>{t('assistant.newTask')}</button>
              </>}
            </div>
          </section>
        )}

        {phase === 'home' && (
          <section className="as-ideas" aria-label={t('assistant.ideas')}>
            <h2>{t('assistant.ideas')}</h2>
            <div className="as-grid">
              {RECIPES.map(r => (
                <button key={r.id} type="button" className="as-idea" data-recipe={r.id} onClick={() => { const words = t(ideaKey(r.id)); setTask(words); void make(words, r); }}>
                  <span className="as-idea-icon" aria-hidden="true">{r.icon}</span>
                  <span className="as-idea-text">{t(ideaKey(r.id))}</span>
                  <span className="as-idea-apps" aria-hidden="true">
                    {[...new Set(r.parts.map(p => p.app))].map(a => { const l = appLook(a); return <i key={a} style={{ background: l.color }}>{l.badge}</i>; })}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {phase === 'home' && history.length > 0 && (
          <section className="as-history" aria-label={t('assistant.history')}>
            <h2>{t('assistant.history')}</h2>
            <ul>
              {history.map(h => (
                <li key={h.id}>
                  <div className="as-h-main"><strong>{h.title}</strong><small>{new Date(h.time).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })}{h.plan ? ` · ${h.plan.steps.map(s => appLook(s.app).badge).join(' + ')}` : ''}</small></div>
                  {h.plan && <button type="button" className="as-tool small gold" onClick={() => showPlan(JSON.parse(JSON.stringify(h.plan)) as Plan, false)}>{t('assistant.reopen')}</button>}
                  <button type="button" className="as-tool small" onClick={() => { setTask(h.task); setTimeout(() => box.current?.focus(), 0); }}>{t('assistant.again')}</button>
                  <button type="button" className="as-tool small" aria-label={t('assistant.forget', { name: h.title })} onClick={() => { const next = history.filter(x => x.id !== h.id); setHistory(next); saveHistory(next); }}>×</button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="as-foot">{t('assistant.notCopilot')}</p>
      </div>
    </div>
  );
}

/** A look at a step's content before it is made. */
function Preview({ step }: { step: Step }) {
  if (step.app === 'class') {
    return (
      <div className="as-preview as-table-wrap">
        <table>
          <tbody>{step.rows.slice(0, 14).map((r, i) => <tr key={i}>{r.map((c, k) => (i === 0 ? <th key={k}>{c}</th> : <td key={k}>{c}</td>))}</tr>)}</tbody>
        </table>
        {step.rows.length > 14 && <p className="as-note">{t('assistant.moreRows', { n: step.rows.length - 14 })}</p>}
      </div>
    );
  }
  if (step.app === 'code') return <ul className="as-preview as-files-list">{step.files.map(f => <li key={f.path}><code>{f.path}</code> · {t('assistant.lines', { n: f.content.split('\n').length })}</li>)}</ul>;
  if (step.app === 'pdf' && !step.html) return <p className="as-preview as-note">{t('assistant.pdfPreview')}</p>;
  return <div className="as-preview as-doc" dangerouslySetInnerHTML={{ __html: safeHtml(step.html) }} />;
}

/** Plain text of HTML (a task handed over, or an attached web page). */
function textOf(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = safeHtml(html);
  return (d.textContent ?? '').trim();
}

interface SpeechRec {
  lang: string; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start(): void; stop(): void;
}
