// The Master corrector's panels: the proposals (each a before/after to accept, edit or refuse) and the versions
// (go back to any of them, or to the best one, for the whole project, one file or a few lines).

import { useState } from 'react';
import { t } from '../../shell/i18n';
import { Dialog } from '../../ui/kit';
import { HELPERS, helperKeys, setHelperKey, type Finding } from './corrector';
import { changedFiles, diffLines, points, restoreHunk, type Version } from './versions';
import type { Files } from './build';

export type Decision = 'accepted' | 'rejected' | 'outdated';
export type Proposal = Finding & { agree: string[] };

function Diff({ before, after, context = 2 }: { before: string; after: string; context?: number }) {
  const A = before.split('\n');
  const hunks = diffLines(before, after);
  return (
    <div className="mc-diff">
      {hunks.map((h, i) => {
        const top = Math.max(0, h.aStart - context);
        const end = Math.min(A.length, h.aStart + h.aLines.length + context);
        return (
          <pre key={i}>
            {A.slice(top, h.aStart).map((l, k) => <span key={`a${k}`} className="ctx">{`  ${l}\n`}</span>)}
            {h.aLines.map((l, k) => <span key={`d${k}`} className="del">{`- ${l}\n`}</span>)}
            {h.bLines.map((l, k) => <span key={`i${k}`} className="ins">{`+ ${l}\n`}</span>)}
            {A.slice(h.aStart + h.aLines.length, end).map((l, k) => <span key={`c${k}`} className="ctx">{`  ${l}\n`}</span>)}
          </pre>
        );
      })}
    </div>
  );
}

export function Proposals({ list, decided, busy, warning, onAccept, onEdit, onReject, onUndoWarning, goTo }: {
  list: Proposal[]; decided: Record<string, Decision>; busy: string | null; warning: string | null;
  onAccept: (f: Proposal) => void; onEdit: (f: Proposal) => void; onReject: (f: Proposal) => void;
  onUndoWarning: () => void; goTo: (path: string, line: number) => void;
}) {
  const open = list.filter(f => !decided[f.id]);
  const done = list.length - open.length;
  return (
    <div className="dock-list mc-list">
      {busy && <p className="mc-busy"><span className="mc-spin" />{busy}</p>}
      {warning && (
        <p className="mc-warning">{warning} <button type="button" className="fix" onClick={onUndoWarning}>{t('code.mc.undo')}</button></p>
      )}
      {!busy && list.length === 0 && <p className="muted mc-empty">{t('code.mc.empty')}</p>}
      {list.length > 0 && <p className="muted mc-count">{t('code.mc.count', { open: open.length, done })}</p>}
      {list.map(f => {
        const d = decided[f.id];
        return (
          <article key={f.id} className={`mc-card sev-${f.severity}${d ? ` mc-${d}` : ''}`}>
            <header>
              <span className="sev-dot" />
              <b>{f.title}</b>
              <span className="mc-source">{f.source === 'local' ? t('code.mc.local') : f.source}{f.agree.length > 0 && ` + ${f.agree.join(' + ')}`}</span>
              <button type="button" className="where" onClick={() => goTo(f.path, f.line)}>{f.path}:{f.line}</button>
            </header>
            <p className="mc-why">{f.why}</p>
            {f.agree.length > 0 && <p className="mc-agree">{t('code.mc.agree', { n: f.agree.length + 1 })}</p>}
            {!d && <Diff before={f.before} after={f.after} />}
            <footer>
              {d ? <span className={`mc-state mc-${d}`}>{t(`code.mc.${d}`)}</span> : <>
                <button type="button" className="mc-accept" onClick={() => onAccept(f)}>{t('code.mc.accept')}</button>
                <button type="button" onClick={() => onEdit(f)}>{t('code.mc.edit')}</button>
                <button type="button" onClick={() => onReject(f)}>{t('code.mc.reject')}</button>
              </>}
            </footer>
          </article>
        );
      })}
    </div>
  );
}

export function Versions({ list, current, onRestore, onWrite, onSave }: {
  list: Version[]; current: Files; onRestore: (v: Version) => void; onWrite: (path: string, text: string | null) => void; onSave: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const best = list.reduce<Version | null>((b, v) => (v.score && (!b || points(v.score) >= points(b.score)) ? v : b), null);
  const fmt = (at: number) => new Date(at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  return (
    <div className="dock-list mc-list">
      {list.length === 0 && <p className="muted mc-empty">{t('code.v.empty')} <button type="button" className="fix" onClick={onSave}>{t('code.v.save')}</button></p>}
      {[...list].reverse().map(v => {
        const changed = changedFiles(v.files, current);
        return (
          <article key={v.id} className={`mc-card${v === best ? ' mc-best' : ''}`}>
            <header>
              <b>{v.label}</b>
              {v === best && <span className="mc-badge">{t('code.v.best')}</span>}
              <span className="muted">{fmt(v.at)}</span>
              {v.score && <span className="mc-score" title={t('code.v.scoreHint')}>✓ {v.score.passed} · ✗ {v.score.failed} · ● {v.score.errors} · ▲ {v.score.warnings}</span>}
            </header>
            <footer>
              <button type="button" onClick={() => setOpen(o => (o === v.id ? null : v.id))} disabled={!changed.length}>
                {changed.length ? t('code.v.compare', { n: changed.length }) : t('code.v.same')}
              </button>
              <button type="button" className="mc-accept" onClick={() => onRestore(v)} disabled={!changed.length}>{t('code.v.restore')}</button>
            </footer>
            {open === v.id && changed.map(path => {
              const old = v.files[path], now = current[path];
              return (
                <section key={path} className="mc-file">
                  <header>
                    <code>{path}</code>
                    <span className="muted">{old === undefined ? t('code.v.added') : now === undefined ? t('code.v.deleted') : ''}</span>
                    <button type="button" className="fix" onClick={() => onWrite(path, old ?? null)}>{t('code.v.restoreFile')}</button>
                  </header>
                  {old !== undefined && now !== undefined && diffLines(old, now).map((h, i) => (
                    <div key={i} className="mc-hunk">
                      <Diff before={now} after={restoreHunk(now, h)} context={1} />
                      <button type="button" className="fix" onClick={() => onWrite(path, restoreHunk(now, h))}>{t('code.v.restoreLines')}</button>
                    </div>
                  ))}
                </section>
              );
            })}
          </article>
        );
      })}
    </div>
  );
}

export function KeysDialog({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState(helperKeys);
  return (
    <Dialog title={t('code.mc.keys')} onClose={onClose} onOk={() => { for (const h of HELPERS) setHelperKey(h.id, keys[h.id] ?? ''); onClose(); }}>
      <p className="muted">{t('code.mc.keysHint')}</p>
      <div className="mc-keys">
        {HELPERS.map(h => (
          <label key={h.id}>
            <span>{h.name} <a href={h.keyUrl} target="_blank" rel="noopener">{h.local ? t('code.mc.install') : t('code.mc.getKey')}</a></span>
            <input type="password" autoComplete="off" value={keys[h.id] ?? ''} placeholder={h.local ? t('code.mc.noKeyNeeded') : 'sk-…'}
              onChange={e => setKeys(k => ({ ...k, [h.id]: e.target.value }))} aria-label={h.name} />
          </label>
        ))}
      </div>
    </Dialog>
  );
}
