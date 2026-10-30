// Training, on screen: the ribbon's buttons and the panel under the editor (the exercise, its checks, the
// step-by-step simulation and the tutor). The exercise is a real file of the project, so every tool of Code+
// (checker, snippets, corrector) works on it too.

import { useEffect, useRef, useState } from 'react';
import type { ShellApi } from '../../shell/contract';
import { getLanguage, t } from '../../shell/i18n';
import { Btn, Drop, Group, MenuItem } from '../../ui/kit';
import type { Files } from './build';
import { explainError, instrument, trace, type Trace } from './stepper';
import { runTests, type TestRun } from './tests';
import { COURSES, dueReviews, exercisePath, loadProgress, record, saveProgress, shuffledLines, testFileFor, words, type Course, type Exercise, type Progress } from './training';

export interface Lesson { c: Course; e: Exercise; path: string }
type Result = { ok: boolean; run?: TestRun; printed?: string; message?: string };
type Talk = { role: 'user' | 'assistant'; content: string }[];

const ALL = COURSES.flatMap(c => c.exercises.map(e => ({ c, e })));
const byId = (id: string) => ALL.find(x => x.e.id === id);

const TUTOR = `You are a patient programming tutor inside a code editor, for beginners and for experienced people learning a new topic.
Teach like a good teacher, not like an answer machine: never write the full solution, and never more than one line of code.
Look at the exercise, the learner's code and the failing tests. Name the one most important problem in plain words, then ask one
short question that leads the learner to find the fix. If they are close, say so. If they ask for the answer, give a stronger hint
instead and remind them the "Solution" button opens after two tries. Keep it under 90 words. Answer in the learner's language.`;

export function useTraining({ shell, files, write, openPath, goTo }: {
  shell: ShellApi; files: Files; write: (path: string, text: string, open?: boolean) => void;
  openPath: (path: string) => void; goTo: (path: string, line: number) => void;
}) {
  const lang = getLanguage();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [result, setResult] = useState<Result | null>(null);
  const [checking, setChecking] = useState(false);
  const [hint, setHint] = useState(0);
  const [tries, setTries] = useState(0);
  const [solution, setSolution] = useState(false);
  const [answer, setAnswer] = useState('');
  const [sim, setSim] = useState<{ trace: Trace; at: number; lines: number } | null>(null);
  const [talk, setTalk] = useState<Talk>([]);
  const [thinking, setThinking] = useState(false);
  const stop = useRef<AbortController | null>(null);
  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => () => stop.current?.abort(), []);

  const start = (c: Course, e: Exercise) => {
    const path = exercisePath(c, e);
    if (files[path] === undefined) write(path, e.kind === 'parsons' ? `${shuffledLines(e).join('\n')}\n` : e.starter, true);
    else openPath(path);
    setLesson({ c, e, path });
    setResult(null); setHint(0); setTries(0); setSolution(false); setAnswer(''); setSim(null); setTalk([]);
    stop.current?.abort();
  };
  const index = lesson ? ALL.findIndex(x => x.e.id === lesson.e.id) : -1;
  const move = (step: number) => { const x = ALL[index + step]; if (x) start(x.c, x.e); };
  const due = dueReviews(progress);
  const review = () => { const x = byId(due[0]); if (x) start(x.c, x.e); };
  const reset = () => { if (lesson) { write(lesson.path, lesson.e.kind === 'parsons' ? `${shuffledLines(lesson.e).join('\n')}\n` : lesson.e.starter); setResult(null); setSim(null); } };

  const check = async () => {
    if (!lesson || checking) return;
    const { e, path } = lesson;
    let r: Result;
    setChecking(true);
    try {
      if (e.kind === 'predict') {
        const norm = (s: string) => s.trim().replace(/\r/g, '').split('\n').map(l => l.trim()).join('\n');
        r = { ok: norm(answer) === norm(e.solution), printed: e.solution };
      } else {
        const test = testFileFor(path, e);
        const run = await runTests({ ...files, [test.path]: test.content }, [test.path]);
        r = { ok: run.results.length > 0 && run.results.every(x => x.ok) && run.errors.length === 0, run };
      }
    } catch (err) { r = { ok: false, message: err instanceof Error ? err.message : String(err) }; }
    finally { setChecking(false); }
    setResult(r);
    if (!r.ok) setTries(n => n + 1);
    setProgress(p => record(p, e.id, r.ok));
  };

  const simulate = async () => {
    if (!lesson) return;
    const { e, path } = lesson;
    const source = e.kind === 'predict' ? e.starter : files[path] ?? '';
    let code: string;
    try { code = instrument(path.replace(/\.html?$|\.css$/, '.js'), source, e.kind === 'predict' ? '' : e.example ?? ''); }
    catch (err) { setSim({ trace: { steps: [], error: err instanceof Error ? err.message : String(err) }, at: 0, lines: 0 }); return; }
    const tr = await trace(code);
    setSim({ trace: tr, at: 0, lines: source.split('\n').length });
    if (tr.steps[0] && e.kind !== 'predict') goTo(path, tr.steps[0].line);
  };
  const stepTo = (at: number) => {
    if (!sim || !lesson) return;
    const i = Math.max(0, Math.min(sim.trace.steps.length - 1, at));
    setSim({ ...sim, at: i });
    const line = sim.trace.steps[i]?.line;
    if (line && line <= sim.lines && lesson.e.kind !== 'predict') goTo(lesson.path, line);
  };

  const ask = async (question?: string) => {
    if (!lesson || thinking) return;
    if (!shell.ai.ready()) { shell.notify(t('code.tr.noAi')); return; }
    const { e, path } = lesson;
    const failing = result?.run ? [...result.run.errors, ...result.run.results.filter(x => !x.ok).map(x => `${x.name}: ${x.error}`)].join('\n') : '';
    const first = `Exercise: ${words(e.title, 'en')}\n${words(e.brief, 'en')}\n\nMy code (${path}):\n\`\`\`\n${e.kind === 'predict' ? e.starter : files[path] ?? ''}\n\`\`\`\n`
      + (e.kind === 'predict' ? `My answer for what it prints: ${answer || '(none yet)'}\n` : '')
      + (failing ? `\nFailing checks:\n${failing}\n` : result?.ok ? '\nAll checks pass.\n' : '')
      + `\nMy language: ${lang}.\n${question || 'Help me find what is wrong, without giving me the answer.'}`;
    const messages: Talk = talk.length ? [...talk, { role: 'user', content: `${question || 'Another hint, please.'}\n\nMy code now:\n\`\`\`\n${files[path] ?? ''}\n\`\`\`` }] : [{ role: 'user', content: first }];
    setTalk([...messages, { role: 'assistant', content: '' }]);
    setThinking(true);
    stop.current = new AbortController();
    try {
      const said = await shell.ai.ask({ system: TUTOR, messages, effort: 'low', signal: stop.current.signal, onText: soFar => setTalk([...messages, { role: 'assistant', content: soFar }]) });
      setTalk([...messages, { role: 'assistant', content: said }]);
    } catch (err) {
      if (!stop.current.signal.aborted) setTalk([...messages, { role: 'assistant', content: `⚠ ${err instanceof Error ? err.message : String(err)}` }]);
    } finally { setThinking(false); }
  };

  const showSolution = () => {
    if (!lesson || tries < 2) return;
    setSolution(true);
    if (lesson.e.kind !== 'predict') write(lesson.path, lesson.e.solution);
  };
  const moveLine = (from: number, to: number) => {
    if (!lesson) return;
    const lines = (files[lesson.path] ?? '').replace(/\n$/, '').split('\n');
    if (to < 0 || to >= lines.length) return;
    [lines[from], lines[to]] = [lines[to], lines[from]];
    write(lesson.path, `${lines.join('\n')}\n`);
  };
  const leave = () => { setLesson(null); setSim(null); stop.current?.abort(); };

  return { lang, lesson, progress, result, checking, hint, setHint, tries, solution, answer, setAnswer, sim, talk, thinking, index,
    start, move, due, review, reset, check, simulate, stepTo, ask, showSolution, moveLine, leave };
}
export type Training = ReturnType<typeof useTraining>;

const doneIn = (c: Course, p: Progress) => c.exercises.filter(e => p.done[e.id]).length;

/** The Training tab of the ribbon. */
export function TrainingRibbon({ tr, open }: { tr: Training; open: () => void }) {
  const { lesson, lang, progress } = tr;
  const total = ALL.filter(x => progress.done[x.e.id]).length;
  const go = (f: () => unknown) => () => { open(); void f(); };
  return <>
    <Group label="code.group.courses">
      <Drop big icon="book" title="code.tr.courses" wide>
        {close => <>
          <span className="kicker">{t('code.tr.coursesHint', { done: total, n: ALL.length })}</span>
          {COURSES.map(c => <MenuItem key={c.id} label={words(c.title, lang)} hint={`${doneIn(c, progress)}/${c.exercises.length}`} active={lesson?.c.id === c.id}
            onClick={() => { close(); open(); tr.start(c, c.exercises.find(e => !progress.done[e.id]) ?? c.exercises[0]); }} />)}
        </>}
      </Drop>
      <div className="stack">
        <Btn icon="prev" title="code.tr.prev" text onClick={go(() => tr.move(-1))} disabled={tr.index <= 0} />
        <Btn icon="next" title="code.tr.next" text onClick={go(() => (lesson ? tr.move(1) : tr.start(ALL[0].c, ALL[0].e)))} disabled={tr.index >= ALL.length - 1} />
        <Btn icon="sync" title={tr.due.length ? t('code.tr.reviewN', { n: tr.due.length }) : 'code.tr.review'} text onClick={go(tr.review)} disabled={!tr.due.length} />
      </div>
    </Group>
    <Group label="code.group.practice">
      <Btn big icon="check" title="code.tr.check" onClick={go(tr.check)} disabled={tr.checking} />
      <div className="stack">
        <Btn icon="sparkle" title="code.tr.hint" text onClick={go(() => tr.setHint(h => Math.min(h + 1, lesson?.e.hints.length ?? 0)))} disabled={!!lesson && tr.hint >= lesson.e.hints.length} />
        <Btn icon="book" title="code.tr.solution" text onClick={go(tr.showSolution)} disabled={!lesson || tr.tries < 2 || tr.solution} />
        <Btn icon="undo" title="code.tr.reset" text onClick={go(tr.reset)} />
      </div>
    </Group>
    <Group label="code.group.simulate">
      <Btn big icon="play" title="code.tr.simulate" onClick={go(tr.simulate)} disabled={!!lesson && /\.(html|css)$/.test(lesson.path)} />
      <div className="stack">
        <Btn icon="prev" title="code.tr.stepBack" text onClick={() => tr.sim && tr.stepTo(tr.sim.at - 1)} disabled={!tr.sim || tr.sim.at <= 0} />
        <Btn icon="next" title="code.tr.stepOn" text onClick={() => tr.sim && tr.stepTo(tr.sim.at + 1)} disabled={!tr.sim || tr.sim.at >= tr.sim.trace.steps.length - 1} />
      </div>
    </Group>
    <Group label="code.group.tutor">
      <Btn big icon="speak" title="code.tr.tutor" onClick={go(() => tr.ask())} disabled={tr.thinking} />
    </Group>
  </>;
}

/** The panel under the editor: the exercise, then what happened when it was checked, simulated or discussed. */
export function TrainingPanel({ tr, files, onCourses }: { tr: Training; files: Files; onCourses: () => void }) {
  const { lesson, lang, result, sim, talk } = tr;
  const [question, setQuestion] = useState('');
  if (!lesson) {
    return (
      <div className="dock-list tr-panel">
        <p className="muted">{t('code.tr.pick')} <button type="button" className="fix" onClick={onCourses}>{t('code.tr.courses')}</button></p>
        <div className="tr-courses">
          {COURSES.map(c => (
            <button key={c.id} type="button" className="tr-course" onClick={() => tr.start(c, c.exercises.find(e => !tr.progress.done[e.id]) ?? c.exercises[0])}>
              <b>{words(c.title, lang)}</b><span className="muted">{words(c.intro, lang)}</span><span className="tr-done">{doneIn(c, tr.progress)}/{c.exercises.length}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  const { c, e } = lesson;
  const step = sim?.trace.steps[sim.at];
  const lines = (files[lesson.path] ?? '').replace(/\n$/, '').split('\n');
  const failures = result?.run ? [...result.run.errors, ...result.run.results.filter(x => !x.ok).map(x => x.error ?? '')] : result?.message ? [result.message] : [];
  return (
    <div className="dock-list tr-panel">
      <header className="tr-head">
        <span className="tr-kind">{t(`code.tr.kind.${e.kind}`)}</span>
        <b>{words(e.title, lang)}</b>
        <span className="muted">{words(c.title, lang)} · {c.exercises.indexOf(e) + 1}/{c.exercises.length}</span>
        {tr.progress.done[e.id] && <span className="mc-badge">{t('code.tr.passed')}</span>}
        <span className="grow" />
        <button type="button" className="fix" onClick={tr.leave}>{t('code.tr.allCourses')}</button>
      </header>
      <p className="tr-brief">{words(e.brief, lang)}</p>
      {e.kind === 'predict' && <>
        <pre className="tr-code">{e.starter}</pre>
        <label className="tr-answer">
          <span>{t('code.tr.yourAnswer')}</span>
          <textarea rows={2} value={tr.answer} onChange={ev => tr.setAnswer(ev.target.value)} aria-label={t('code.tr.yourAnswer')}
            onKeyDown={ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); void tr.check(); } }} />
        </label>
      </>}
      {e.kind === 'parsons' && (
        <ol className="tr-lines" aria-label={t('code.tr.order')}>
          {lines.map((l, i) => (
            <li key={`${i}-${l}`}>
              <code>{l || ' '}</code>
              <button type="button" aria-label={t('code.tr.up')} title={t('code.tr.up')} onClick={() => tr.moveLine(i, i - 1)} disabled={i === 0}>↑</button>
              <button type="button" aria-label={t('code.tr.down')} title={t('code.tr.down')} onClick={() => tr.moveLine(i, i + 1)} disabled={i === lines.length - 1}>↓</button>
            </li>
          ))}
        </ol>
      )}
      <div className="tr-actions">
        <button type="button" className="mc-accept" onClick={() => void tr.check()} disabled={tr.checking}>{tr.checking ? t('code.testing') : t('code.tr.check')}</button>
        <button type="button" onClick={() => tr.setHint(h => Math.min(h + 1, e.hints.length))} disabled={tr.hint >= e.hints.length}>{t('code.tr.hint')}</button>
        {!/\.(html|css)$/.test(lesson.path) && <button type="button" onClick={() => void tr.simulate()}>{t('code.tr.simulate')}</button>}
        <button type="button" onClick={() => void tr.ask()} disabled={tr.thinking}>{t('code.tr.tutor')}</button>
        <button type="button" onClick={tr.showSolution} disabled={tr.tries < 2 || tr.solution} title={tr.tries < 2 ? t('code.tr.solutionLater') : undefined}>{t('code.tr.solution')}</button>
      </div>
      {e.hints.slice(0, tr.hint).map((h, i) => <p key={i} className="tr-hint"><b>{t('code.tr.hintN', { n: i + 1 })}</b> {words(h, lang)}</p>)}
      {result && (
        <div className={`tr-result ${result.ok ? 'test-ok' : 'test-bad'}`}>
          <b>{result.ok ? t('code.tr.right') : t('code.tr.notYet')}</b>
          {result.ok && <button type="button" className="fix" onClick={() => tr.move(1)} disabled={tr.index >= ALL.length - 1}>{t('code.tr.next')}</button>}
          {result.run?.results.map((r, i) => <span key={i} className="tr-check">{r.ok ? '✓' : '✗'} {r.name}{r.error && <em> {r.error}</em>}</span>)}
          {failures.map(f => explainError(f, lang)).filter(Boolean).slice(0, 2).map((x, i) => <p key={i} className="tr-explain">💡 {x}</p>)}
          {e.kind === 'predict' && !result.ok && tr.solution && <pre className="tr-code">{result.printed}</pre>}
        </div>
      )}
      {e.kind === 'predict' && tr.solution && !result && <pre className="tr-code">{e.solution}</pre>}
      {sim && (
        <div className="tr-sim">
          <header>
            <b>{t('code.tr.simulation')}</b>
            {sim.trace.steps.length > 0 && <>
              <button type="button" onClick={() => tr.stepTo(0)} disabled={sim.at === 0} aria-label={t('code.tr.first')} title={t('code.tr.first')}>⏮</button>
              <button type="button" onClick={() => tr.stepTo(sim.at - 1)} disabled={sim.at === 0} aria-label={t('code.tr.stepBack')} title={t('code.tr.stepBack')}>◀</button>
              <input type="range" min={0} max={sim.trace.steps.length - 1} value={sim.at} onChange={ev => tr.stepTo(Number(ev.target.value))} aria-label={t('code.tr.simulation')} />
              <button type="button" onClick={() => tr.stepTo(sim.at + 1)} disabled={sim.at >= sim.trace.steps.length - 1} aria-label={t('code.tr.stepOn')} title={t('code.tr.stepOn')}>▶</button>
              <span className="muted">{t('code.tr.stepN', { n: sim.at + 1, of: sim.trace.steps.length })}</span>
            </>}
          </header>
          {step && <p className="muted">{step.line <= sim.lines ? t('code.tr.atLine', { n: step.line }) : t('code.tr.atExample')}</p>}
          {step && Object.keys(step.vars).length > 0 && (
            <table className="tr-vars">
              <tbody>{Object.entries(step.vars).map(([k, v]) => {
                const before = sim.trace.steps[sim.at - 1]?.vars[k];
                return <tr key={k} className={sim.at > 0 && before !== v ? 'changed' : ''}><th>{k}</th><td>{v}</td></tr>;
              })}</tbody>
            </table>
          )}
          {step && step.out.length > 0 && <pre className="tr-code">{step.out.join('\n')}</pre>}
          {sim.trace.truncated && <p className="muted">{t('code.tr.truncated')}</p>}
          {sim.trace.error && sim.at === sim.trace.steps.length - 1 && <p className="sev-error">{sim.trace.error}{explainError(sim.trace.error, lang) && <><br />💡 {explainError(sim.trace.error, lang)}</>}</p>}
          {sim.trace.error && !sim.trace.steps.length && <p className="sev-error">{sim.trace.error}</p>}
        </div>
      )}
      {talk.length > 0 && (
        <div className="tr-talk">
          {talk.slice(1).map((m, i) => <p key={i} className={`tr-say ${m.role}`}>{m.role === 'user' ? m.content.split('\n\nMy code now:')[0] : m.content || '…'}</p>)}
          <form onSubmit={ev => { ev.preventDefault(); void tr.ask(question.trim()); setQuestion(''); }}>
            <input value={question} onChange={ev => setQuestion(ev.target.value)} placeholder={t('code.tr.askMore')} aria-label={t('code.tr.askMore')} />
            <button type="submit" className="fix" disabled={tr.thinking}>{t('code.tr.send')}</button>
          </form>
        </div>
      )}
    </div>
  );
}
