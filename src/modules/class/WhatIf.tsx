// The windows of Data › What-If Analysis (Goal Seek, Scenarios, Solver) and Data › Data Validation, in Office Class.
// They follow Excel's, so people find their way, with plainer words and a result they can keep or undo.

import { useState } from 'react';
import { t, type MessageKey } from '../../shell/i18n';
import { cellName } from '../../formats/formula';
import { key, unkey, type Merge, type Scenario, type SheetData, type SolverSaved, type Validation, type VKind, type VOp, type WorkbookData } from '../../formats/sheet';
import { Dialog } from '../../ui/kit';
import { goalSeek, numText, parseRange, parseRefs, rangeName, scenarioSummary, solve, type SeekResult, type SolverResult } from './whatif';

const name = (k: string) => { const { c, r } = unkey(k); return cellName(c, r); };
const cellKey = (text: string) => { const m = parseRange(text); return m && m.c1 === m.c2 && m.r1 === m.r2 ? key(m.c1, m.r1) : null; };
const toNum = (s: string) => Number(s.trim().replace(/\s/g, '').replace(',', '.'));
const newId = () => `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------- Goal Seek ----------

export function GoalSeekDialog({ book, sheet, at, onKeep, onClose }: {
  book: WorkbookData; sheet: number; at: string; onKeep: (k: string, value: string) => void; onClose: () => void;
}) {
  const [target, setTarget] = useState(at);
  const [goal, setGoal] = useState('');
  const [changing, setChanging] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ r: SeekResult; k: string; tk: string } | null>(null);
  if (result) {
    const { r, k, tk } = result;
    return (
      <Dialog title={t('class.seek.title')} onClose={onClose} onOk={r.ok ? () => onKeep(k, numText(r.x)) : undefined}>
        <p className={`wi-status ${r.ok ? 'ok' : 'no'}`} role="status">{t(r.ok ? 'class.seek.found' : 'class.seek.notFound', { cell: name(tk) })}</p>
        <dl className="wi-facts">
          <dt>{t('class.seek.targetValue')}</dt><dd>{goal}</dd>
          <dt>{t('class.seek.currentValue')}</dt><dd>{isFinite(r.value) ? numText(r.value) : '—'}</dd>
          <dt>{name(k)}</dt><dd>{numText(r.x)}</dd>
        </dl>
        {r.ok && <p className="wi-hint">{t('class.seek.keepHint')}</p>}
      </Dialog>
    );
  }
  const run = () => {
    const tk = cellKey(target), k = cellKey(changing), g = toNum(goal);
    if (!tk) { setError(t('class.wi.badCell', { what: t('class.seek.setCell') })); return false; }
    if (!(book.sheets[sheet].cells[tk]?.input ?? '').startsWith('=')) { setError(t('class.seek.needFormula')); return false; }
    if (isNaN(g)) { setError(t('class.seek.needNumber')); return false; }
    if (!k) { setError(t('class.wi.badCell', { what: t('class.seek.byChanging') })); return false; }
    if ((book.sheets[sheet].cells[k]?.input ?? '').startsWith('=')) { setError(t('class.seek.needValue')); return false; }
    setResult({ r: goalSeek(book, sheet, tk, g, k), k, tk });
    return false;
  };
  return (
    <Dialog title={t('class.seek.title')} onClose={onClose} onOk={run}>
      <p className="wi-intro">{t('class.seek.intro')}</p>
      <label className="wi-field">{t('class.seek.setCell')}<input value={target} onChange={e => setTarget(e.target.value)} aria-label={t('class.seek.setCell')} /></label>
      <label className="wi-field">{t('class.seek.toValue')}<input autoFocus value={goal} onChange={e => setGoal(e.target.value)} inputMode="decimal" aria-label={t('class.seek.toValue')} /></label>
      <label className="wi-field">{t('class.seek.byChanging')}<input value={changing} onChange={e => setChanging(e.target.value)} aria-label={t('class.seek.byChanging')} placeholder="B3" /></label>
      {error && <p className="wi-error" role="alert">{error}</p>}
    </Dialog>
  );
}

// ---------- Scenarios ----------

export function ScenarioDialog({ book, sheet, selection, onSave, onShow, onSummary, onClose }: {
  book: WorkbookData; sheet: number; selection: string;
  onSave: (list: Scenario[]) => void; onShow: (s: Scenario) => void; onSummary: (s: SheetData) => void; onClose: () => void;
}) {
  const list = book.sheets[sheet].scenarios ?? [];
  const [picked, setPicked] = useState<string | null>(list[0]?.id ?? null);
  const [form, setForm] = useState<null | { id?: string; name: string; cells: string; values: string[]; comment: string }>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState('');
  const current = (k: string) => book.sheets[sheet].cells[k]?.input ?? '';

  if (summary !== null) {
    return (
      <Dialog title={t('class.scen.summary')} onClose={() => setSummary(null)} onOk={() => {
        const res = parseRefs(summary);
        if (!res) { setError(t('class.wi.badCell', { what: t('class.scen.resultCells') })); return false; }
        onSummary(scenarioSummary(book, sheet, list, res, { title: t('class.scen.summary'), changing: t('class.scen.changing'), result: t('class.scen.resultCells'), current: t('class.scen.current') }));
        onClose();
        return false;
      }}>
        <label className="wi-field">{t('class.scen.resultCells')}<input autoFocus value={summary} onChange={e => setSummary(e.target.value)} aria-label={t('class.scen.resultCells')} /></label>
        <p className="wi-hint">{t('class.scen.summaryHint')}</p>
        {error && <p className="wi-error" role="alert">{error}</p>}
      </Dialog>
    );
  }

  if (form) {
    const keys = parseRefs(form.cells) ?? [];
    return (
      <Dialog title={t(form.id ? 'class.scen.edit' : 'class.scen.add')} onClose={() => setForm(null)} onOk={() => {
        if (!form.name.trim()) { setError(t('class.scen.needName')); return false; }
        if (!keys.length) { setError(t('class.wi.badCell', { what: t('class.scen.changing') })); return false; }
        if (keys.length > 32) { setError(t('class.scen.tooMany')); return false; }
        const sc: Scenario = { id: form.id ?? newId(), name: form.name.trim(), cells: keys, values: keys.map((k, i) => form.values[i] ?? current(k)), ...(form.comment.trim() ? { comment: form.comment.trim() } : {}) };
        onSave(form.id ? list.map(x => (x.id === form.id ? sc : x)) : [...list, sc]);
        setPicked(sc.id);
        setForm(null); setError('');
        return false;
      }}>
        <label className="wi-field">{t('class.scen.name')}<input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} aria-label={t('class.scen.name')} /></label>
        <label className="wi-field">{t('class.scen.changing')}<input value={form.cells} onChange={e => setForm({ ...form, cells: e.target.value })} aria-label={t('class.scen.changing')} /></label>
        {keys.length > 0 && keys.length <= 32 && (
          <div className="wi-values">
            <p className="wi-hint">{t('class.scen.valuesHint')}</p>
            {keys.map((k, i) => (
              <label key={k} className="wi-field small">{name(k)}
                <input value={form.values[i] ?? current(k)} aria-label={name(k)} onChange={e => { const v = [...form.values]; keys.forEach((kk, j) => { if (v[j] === undefined) v[j] = current(kk); }); v[i] = e.target.value; setForm({ ...form, values: v }); }} />
              </label>
            ))}
          </div>
        )}
        <label className="wi-field">{t('class.scen.comment')}<input value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} aria-label={t('class.scen.comment')} /></label>
        {error && <p className="wi-error" role="alert">{error}</p>}
      </Dialog>
    );
  }

  const sc = list.find(x => x.id === picked);
  return (
    <Dialog title={t('class.scen.title')} onClose={onClose}>
      <p className="wi-intro">{t('class.scen.intro')}</p>
      {list.length ? (
        <div className="wi-list" role="listbox" aria-label={t('class.scen.title')}>
          {list.map(x => (
            <button key={x.id} type="button" role="option" aria-selected={x.id === picked} className={x.id === picked ? 'on' : ''} onClick={() => setPicked(x.id)} onDoubleClick={() => onShow(x)}>
              <b>{x.name}</b><small>{x.cells.map(name).join(', ')}{x.comment ? ` · ${x.comment}` : ''}</small>
            </button>
          ))}
        </div>
      ) : <p className="wi-empty">{t('class.scen.none')}</p>}
      <div className="wi-actions">
        <button type="button" onClick={() => setForm({ name: '', cells: selection, values: [], comment: '' })}>{t('class.scen.add')}</button>
        <button type="button" disabled={!sc} onClick={() => sc && setForm({ id: sc.id, name: sc.name, cells: sc.cells.map(name).join(', '), values: sc.values, comment: sc.comment ?? '' })}>{t('class.scen.edit')}</button>
        <button type="button" disabled={!sc} onClick={() => { if (!sc) return; const next = list.filter(x => x.id !== sc.id); onSave(next); setPicked(next[0]?.id ?? null); }}>{t('class.scen.delete')}</button>
        <button type="button" className="primary" disabled={!sc} onClick={() => sc && onShow(sc)}>{t('class.scen.show')}</button>
        <button type="button" disabled={!list.length} onClick={() => setSummary(selection)}>{t('class.scen.summary')}</button>
      </div>
    </Dialog>
  );
}

// ---------- Solver ----------

const OPS: SolverSaved['constraints'][number]['op'][] = ['<=', '>=', '=', 'int', 'bin'];

export function SolverDialog({ book, sheet, at, onKeep, onRemember, onClose }: {
  book: WorkbookData; sheet: number; at: string;
  onKeep: (entries: [string, string][], m: SolverSaved) => void; onRemember: (m: SolverSaved) => void; onClose: () => void;
}) {
  const saved = book.sheets[sheet].solver;
  const [m, setM] = useState<SolverSaved>(saved ?? { objective: at, goal: 'max', vars: '', constraints: [], nonNegative: true });
  const [target, setTarget] = useState(saved?.target !== undefined ? String(saved.target) : '0');
  const [add, setAdd] = useState<{ left: string; op: SolverSaved['constraints'][number]['op']; right: string }>({ left: '', op: '<=', right: '' });
  const [error, setError] = useState('');
  const [result, setResult] = useState<SolverResult | null>(null);
  const [busy, setBusy] = useState(false);
  const model = (): SolverSaved => ({ ...m, ...(m.goal === 'value' ? { target: toNum(target) } : { target: undefined }) });

  if (result) {
    const good = result.status === 'optimal' || result.status === 'feasible';
    const entries = result.vars.map((k, i) => [k, numText(result.x[i])] as [string, string]);
    return (
      <Dialog title={t('class.solver.title')} onClose={() => setResult(null)} onOk={good ? () => { onKeep(entries, model()); onClose(); } : undefined}>
        <p className={`wi-status ${good ? 'ok' : 'no'}`} role="status">{t(`class.solver.status.${result.status}` as MessageKey)}</p>
        <p className="wi-hint">{t(result.method === 'simplex' ? 'class.solver.byLinear' : 'class.solver.bySearch')}</p>
        {good && (
          <dl className="wi-facts">
            <dt>{t('class.solver.objective')} ({m.objective.toUpperCase()})</dt><dd>{numText(result.objective)}</dd>
            {entries.flatMap(([k, v]) => [<dt key={`d${k}`}>{name(k)}</dt>, <dd key={`v${k}`}>{v}</dd>])}
          </dl>
        )}
        {good && <p className="wi-hint">{t('class.solver.keepHint')}</p>}
      </Dialog>
    );
  }

  const run = () => {
    if (!cellKey(m.objective)) { setError(t('class.wi.badCell', { what: t('class.solver.objective') })); return false; }
    if (!parseRefs(m.vars)) { setError(t('class.wi.badCell', { what: t('class.solver.vars') })); return false; }
    if (m.goal === 'value' && isNaN(toNum(target))) { setError(t('class.seek.needNumber')); return false; }
    setError(''); setBusy(true);
    const mm = model();
    onRemember(mm);
    // Let the window say "Solving…" before the work starts.
    window.setTimeout(() => {
      const r = solve(book, sheet, mm);
      setBusy(false);
      if (r.status === 'error') setError(t('class.wi.badCell', { what: r.message === 'vars' ? t('class.solver.vars') : r.message === 'objective' ? t('class.solver.objective') : r.message ?? '' }));
      else setResult(r);
    }, 30);
    return false;
  };
  return (
    <Dialog title={t('class.solver.title')} onClose={onClose} onOk={run}>
      <p className="wi-intro">{t('class.solver.intro')}</p>
      <label className="wi-field">{t('class.solver.objective')}<input value={m.objective} onChange={e => setM({ ...m, objective: e.target.value })} aria-label={t('class.solver.objective')} /></label>
      <div className="wi-goal" role="radiogroup" aria-label={t('class.solver.to')}>
        <span>{t('class.solver.to')}</span>
        {(['max', 'min', 'value'] as const).map(g => (
          <label key={g} className="wi-radio"><input type="radio" name="wi-goal" checked={m.goal === g} onChange={() => setM({ ...m, goal: g })} /> {t(`class.solver.${g}` as MessageKey)}</label>
        ))}
        {m.goal === 'value' && <input className="wi-target" value={target} onChange={e => setTarget(e.target.value)} inputMode="decimal" aria-label={t('class.solver.value')} />}
      </div>
      <label className="wi-field">{t('class.solver.vars')}<input value={m.vars} onChange={e => setM({ ...m, vars: e.target.value })} aria-label={t('class.solver.vars')} placeholder="B2:B5" /></label>
      <fieldset className="wi-cons">
        <legend>{t('class.solver.constraints')}</legend>
        {m.constraints.length ? m.constraints.map((c, i) => (
          <div key={i} className="wi-con">
            <span>{c.left.toUpperCase()} {t(`class.solver.op.${c.op === '<=' ? 'le' : c.op === '>=' ? 'ge' : c.op === '=' ? 'eq' : c.op}` as MessageKey)} {c.op === 'int' || c.op === 'bin' ? '' : c.right.toUpperCase()}</span>
            <button type="button" aria-label={t('class.solver.remove')} onClick={() => setM({ ...m, constraints: m.constraints.filter((_, j) => j !== i) })}>×</button>
          </div>
        )) : <p className="wi-empty">{t('class.solver.noConstraints')}</p>}
        <div className="wi-con-add">
          <input value={add.left} onChange={e => setAdd({ ...add, left: e.target.value })} aria-label={t('class.solver.cellRef')} placeholder="C2" />
          <select value={add.op} onChange={e => setAdd({ ...add, op: e.target.value as typeof add.op })} aria-label={t('class.solver.relation')}>
            {OPS.map(o => <option key={o} value={o}>{t(`class.solver.op.${o === '<=' ? 'le' : o === '>=' ? 'ge' : o === '=' ? 'eq' : o}` as MessageKey)}</option>)}
          </select>
          {add.op !== 'int' && add.op !== 'bin' && <input value={add.right} onChange={e => setAdd({ ...add, right: e.target.value })} aria-label={t('class.solver.limit')} placeholder="100" />}
          <button type="button" onClick={() => {
            if (!parseRefs(add.left) || (add.op !== 'int' && add.op !== 'bin' && !add.right.trim())) { setError(t('class.solver.badConstraint')); return; }
            setError('');
            setM({ ...m, constraints: [...m.constraints, add] });
            setAdd({ left: '', op: '<=', right: '' });
          }}>{t('class.solver.add')}</button>
        </div>
      </fieldset>
      <label className="wi-check"><input type="checkbox" checked={m.nonNegative} onChange={e => setM({ ...m, nonNegative: e.target.checked })} /> {t('class.solver.nonNeg')}</label>
      {busy && <p className="wi-hint" role="status">{t('class.solver.solving')}</p>}
      {error && <p className="wi-error" role="alert">{error}</p>}
    </Dialog>
  );
}

// ---------- Data validation ----------

const KINDS: VKind[] = ['any', 'whole', 'decimal', 'list', 'date', 'time', 'length', 'custom'];
const VOPS: VOp[] = ['between', 'notBetween', 'eq', 'ne', 'gt', 'lt', 'ge', 'le'];

/** The parts of `a` outside `b`, as up to four boxes. */
export function subtract(a: Merge, b: Merge): Merge[] {
  if (b.c1 > a.c2 || b.c2 < a.c1 || b.r1 > a.r2 || b.r2 < a.r1) return [a];
  const out: Merge[] = [];
  if (a.r1 < b.r1) out.push({ ...a, r2: b.r1 - 1 });
  if (a.r2 > b.r2) out.push({ ...a, r1: b.r2 + 1 });
  const r1 = Math.max(a.r1, b.r1), r2 = Math.min(a.r2, b.r2);
  if (a.c1 < b.c1) out.push({ c1: a.c1, c2: b.c1 - 1, r1, r2 });
  if (a.c2 > b.c2) out.push({ c1: b.c2 + 1, c2: a.c2, r1, r2 });
  return out;
}

/** The sheet's rules with `range` given the new rule (or none). */
export function setRule(list: Validation[] | undefined, range: Merge, rule: Validation | null): Validation[] {
  const out: Validation[] = [];
  for (const v of list ?? []) subtract(v.range, range).forEach((r, i) => out.push({ ...v, range: r, id: i ? `${v.id}-${i}` : v.id }));
  if (rule) out.push(rule);
  return out;
}

export function ValidationDialog({ range, existing, onSave, onClose }: {
  range: Merge; existing?: Validation; onSave: (rule: Validation | null) => void; onClose: () => void;
}) {
  const [page, setPage] = useState<'settings' | 'prompt' | 'error'>('settings');
  const [v, setV] = useState<Validation>(existing ? { ...existing, range } : { id: newId(), range, kind: 'whole', op: 'between', a: '', b: '', ignoreBlank: true, dropdown: true });
  const [error, setError] = useState('');
  const needsB = v.op === 'between' || v.op === 'notBetween';
  const numeric = v.kind === 'whole' || v.kind === 'decimal' || v.kind === 'date' || v.kind === 'time' || v.kind === 'length';
  const save = () => {
    if (numeric && (!v.a.trim() || (needsB && !(v.b ?? '').trim()))) { setError(t('class.val.needBounds')); setPage('settings'); return false; }
    if (v.kind === 'list' && !(v.list ?? '').trim()) { setError(t('class.val.needList')); setPage('settings'); return false; }
    if (v.kind === 'custom' && !v.a.trim()) { setError(t('class.val.needFormula')); setPage('settings'); return false; }
    onSave(v.kind === 'any' && !v.prompt?.text ? null : v);
    return true;
  };
  return (
    <Dialog title={t('class.val.title')} onClose={onClose} onOk={save}>
      <p className="wi-intro">{t('class.val.appliesTo', { range: rangeName(range) })}</p>
      <div className="wi-tabs" role="tablist">
        {(['settings', 'prompt', 'error'] as const).map(p => (
          <button key={p} type="button" role="tab" aria-selected={page === p} className={page === p ? 'on' : ''} onClick={() => setPage(p)}>{t(`class.val.page.${p}` as MessageKey)}</button>
        ))}
      </div>
      {page === 'settings' && <>
        <label className="wi-field">{t('class.val.allow')}
          <select value={v.kind} onChange={e => setV({ ...v, kind: e.target.value as VKind })} aria-label={t('class.val.allow')}>
            {KINDS.map(k => <option key={k} value={k}>{t(`class.val.kind.${k}` as MessageKey)}</option>)}
          </select>
        </label>
        {numeric && <>
          <label className="wi-field">{t('class.val.data')}
            <select value={v.op} onChange={e => setV({ ...v, op: e.target.value as VOp })} aria-label={t('class.val.data')}>
              {VOPS.map(o => <option key={o} value={o}>{t(`class.val.op.${o}` as MessageKey)}</option>)}
            </select>
          </label>
          <label className="wi-field">{t(needsB ? 'class.val.min' : 'class.val.value')}<input value={v.a} onChange={e => setV({ ...v, a: e.target.value })} aria-label={t(needsB ? 'class.val.min' : 'class.val.value')} placeholder={v.kind === 'date' ? '2026-01-01' : v.kind === 'time' ? '08:00' : '0'} /></label>
          {needsB && <label className="wi-field">{t('class.val.max')}<input value={v.b ?? ''} onChange={e => setV({ ...v, b: e.target.value })} aria-label={t('class.val.max')} placeholder={v.kind === 'date' ? '2026-12-31' : v.kind === 'time' ? '18:00' : '100'} /></label>}
        </>}
        {v.kind === 'list' && <>
          <label className="wi-field">{t('class.val.source')}<input value={v.list ?? ''} onChange={e => setV({ ...v, list: e.target.value })} aria-label={t('class.val.source')} placeholder={t('class.val.sourceHint')} /></label>
          <label className="wi-check"><input type="checkbox" checked={v.dropdown !== false} onChange={e => setV({ ...v, dropdown: e.target.checked })} /> {t('class.val.dropdown')}</label>
        </>}
        {v.kind === 'custom' && <label className="wi-field">{t('class.val.formula')}<input value={v.a} onChange={e => setV({ ...v, a: e.target.value })} aria-label={t('class.val.formula')} placeholder={`=MOD(${cellName(range.c1, range.r1)},2)=0`} /></label>}
        {v.kind !== 'any' && <label className="wi-check"><input type="checkbox" checked={v.ignoreBlank} onChange={e => setV({ ...v, ignoreBlank: e.target.checked })} /> {t('class.val.ignoreBlank')}</label>}
      </>}
      {page === 'prompt' && <>
        <p className="wi-hint">{t('class.val.promptHint')}</p>
        <label className="wi-field">{t('class.val.msgTitle')}<input value={v.prompt?.title ?? ''} onChange={e => setV({ ...v, prompt: { title: e.target.value, text: v.prompt?.text ?? '' } })} aria-label={t('class.val.msgTitle')} /></label>
        <label className="wi-field">{t('class.val.msgText')}<textarea value={v.prompt?.text ?? ''} onChange={e => setV({ ...v, prompt: { title: v.prompt?.title ?? '', text: e.target.value } })} aria-label={t('class.val.msgText')} rows={3} /></label>
      </>}
      {page === 'error' && <>
        <p className="wi-hint">{t('class.val.errorHint')}</p>
        <label className="wi-field">{t('class.val.style')}
          <select value={v.error?.style ?? 'stop'} onChange={e => setV({ ...v, error: { style: e.target.value as 'stop', title: v.error?.title ?? '', text: v.error?.text ?? '' } })} aria-label={t('class.val.style')}>
            {(['stop', 'warning', 'info'] as const).map(s => <option key={s} value={s}>{t(`class.val.style.${s}` as MessageKey)}</option>)}
          </select>
        </label>
        <label className="wi-field">{t('class.val.msgTitle')}<input value={v.error?.title ?? ''} onChange={e => setV({ ...v, error: { style: v.error?.style ?? 'stop', title: e.target.value, text: v.error?.text ?? '' } })} aria-label={t('class.val.errTitle')} /></label>
        <label className="wi-field">{t('class.val.msgText')}<textarea value={v.error?.text ?? ''} onChange={e => setV({ ...v, error: { style: v.error?.style ?? 'stop', title: v.error?.title ?? '', text: e.target.value } })} aria-label={t('class.val.errText')} rows={3} /></label>
      </>}
      <div className="wi-actions">
        <button type="button" onClick={() => { onSave(null); onClose(); }}>{t('class.val.clear')}</button>
      </div>
      {error && <p className="wi-error" role="alert">{error}</p>}
    </Dialog>
  );
}

/** The window when an entry breaks a rule: Stop (retry or cancel), Warning (keep it?), Information. */
export function ValidationAlert({ rule, onRetry, onCancel, onKeep }: { rule: Validation; onRetry: () => void; onCancel: () => void; onKeep: () => void }) {
  const style = rule.error?.style ?? 'stop';
  const title = rule.error?.title || t('class.val.alertTitle');
  const text = rule.error?.text || t('class.val.alertText');
  return (
    <Dialog title={title} onClose={onCancel}>
      <p className={`wi-status ${style === 'stop' ? 'no' : style}`} role="alert">{text}</p>
      {style !== 'stop' && <p className="wi-hint">{t(style === 'warning' ? 'class.val.keepQuestion' : 'class.val.infoNote')}</p>}
      <div className="wi-actions">
        {style === 'stop' ? <button type="button" className="primary" onClick={onRetry}>{t('class.val.retry')}</button>
          : <button type="button" className="primary" onClick={onKeep}>{t(style === 'warning' ? 'class.val.yesKeep' : 'letter.ok')}</button>}
        {style === 'warning' && <button type="button" onClick={onRetry}>{t('class.val.noRetry')}</button>}
      </div>
    </Dialog>
  );
}
