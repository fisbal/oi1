// The bubble that opens on an underlined word: what is wrong, the fixes to pick from, and Ignore /
// Add to dictionary. It sits under the word, or above it when there is no room, and never leaves the screen.

import './proof.css';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import { t } from '../../shell/i18n';
import { applyFix, onPick, type Picked } from './extension';
import { proofing } from './proof';

export function ProofBubble({ editor }: { editor: Editor | null }) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [options, setOptions] = useState<string[] | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => (editor ? onPick(editor, setPicked) : undefined), [editor]);
  useEffect(() => {
    setOptions(null);
    if (!picked) return;
    if (picked.issue.kind !== 'spell') { setOptions(picked.issue.replacements ?? []); return; }
    let live = true;
    void proofing.suggest(picked.lang, picked.issue.word).then(s => { if (live) setOptions(s); }, () => { if (live) setOptions([]); });
    return () => { live = false; };
  }, [picked]);
  useEffect(() => {
    if (!picked) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node) && !(e.target as HTMLElement)?.closest?.('.pf')) setPicked(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicked(null); };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', () => setPicked(null), { once: true });
    return () => { document.removeEventListener('pointerdown', close, true); document.removeEventListener('keydown', esc); };
  }, [picked]);
  useLayoutEffect(() => {
    if (!picked || !ref.current) { setPlace(null); return; }
    const r = picked.rect, box = ref.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - box.width - 8));
    const below = r.bottom + 6, above = r.top - box.height - 6;
    setPlace({ left, top: below + box.height <= window.innerHeight - 8 || above < 8 ? Math.max(8, Math.min(below, window.innerHeight - box.height - 8)) : above });
  }, [picked, options]);

  if (!picked || !editor) return null;
  const { issue } = picked;
  const fix = (text: string) => { applyFix(editor, picked.from, picked.to, text); setPicked(null); };
  return createPortal(
    <div ref={ref} className={`pf-bubble pf-bubble-${issue.kind}`} role="dialog" aria-label={t(`proof.${issue.kind}`)}
      style={place ? { left: place.left, top: place.top } : { visibility: 'hidden', left: 0, top: 0 }}>
      <div className="pf-head"><span className="pf-dot" />{t(`proof.${issue.kind}`)}</div>
      {issue.message && <p className="pf-msg">{issue.message}</p>}
      <div className="pf-options">
        {options === null ? <span className="pf-wait">{t('proof.looking')}</span>
          : options.length === 0 ? <span className="pf-wait">{t('proof.noSuggestion')}</span>
          : options.map(o => <button key={o} type="button" className="pf-fix" onClick={() => fix(o)}>{o || t('proof.remove')}</button>)}
      </div>
      <div className="pf-actions">
        <button type="button" onClick={() => { if (issue.kind === 'spell') proofing.ignore(issue.word); else proofing.ignoreIssue(issue); setPicked(null); }}>{t('proof.ignore')}</button>
        {issue.kind === 'spell' && <button type="button" onClick={() => { proofing.addWord(issue.word); setPicked(null); }}>{t('proof.add')}</button>}
      </div>
    </div>,
    document.body,
  );
}
