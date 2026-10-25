// The comments pane beside the page, like Word's: one card per comment, in reading order, with replies,
// resolve and delete. Clicking a card selects the text it is about.

import { useEditorState, type Editor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { getLanguage, t } from '../../shell/i18n';
import { Icon } from '../../ui/kit';
import { authorColor, commentRanges, commentsAt, initials, newCommentId, removeCommentMark, type LetterComment } from './review';

function when(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(getLanguage(), { numeric: 'auto' });
  if (mins < 1) return rtf.format(0, 'minute');
  if (mins < 60) return rtf.format(-mins, 'minute');
  if (mins < 60 * 24) return rtf.format(-Math.round(mins / 60), 'hour');
  return d.toLocaleDateString(getLanguage(), { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

function Avatar({ name }: { name: string }) {
  return <i className="cmt-avatar" style={{ background: authorColor(name) }} aria-hidden="true">{initials(name)}</i>;
}

/** Selects the text a comment is about and brings it into view. */
export function showComment(editor: Editor, id: string) {
  const r = commentRanges(editor.state.doc).get(id);
  if (!r) return;
  editor.chain().setTextSelection(r).scrollIntoView().run();
}

export function CommentsPane({ editor, comments, onChange, author, editing, setEditing, showResolved, onClose }: {
  editor: Editor; comments: LetterComment[]; onChange: (next: LetterComment[]) => void; author: () => string;
  editing: string | null; setEditing: (id: string | null) => void; showResolved: boolean; onClose: () => void;
}) {
  const order = useEditorState({
    editor,
    selector: ({ editor: e }) => [...commentRanges(e.state.doc).keys()],
    equalityFn: (a, b) => a.join() === b?.join(),
  }) ?? [];
  const here = useEditorState({ editor, selector: ({ editor: e }) => commentsAt(e.state), equalityFn: (a, b) => a.join() === b?.join() }) ?? [];
  const byId = new Map(comments.map(c => [c.id, c]));
  const shown = order.map(id => byId.get(id)).filter((c): c is LetterComment => !!c && (showResolved || !c.resolved || here.includes(c.id)));

  const update = (id: string, change: (c: LetterComment) => LetterComment | null) => {
    const next: LetterComment[] = [];
    for (const c of comments) {
      if (c.id !== id) { next.push(c); continue; }
      const u = change(c);
      if (u) next.push(u);
    }
    onChange(next);
  };
  const remove = (id: string) => {
    removeCommentMark(editor, id);
    update(id, () => null);
    if (editing === id) setEditing(null);
  };

  return (
    <aside className="comments-pane" aria-label={t('letter.comments')}>
      <header><span className="kicker">{t('letter.comments')}</span><button type="button" onClick={onClose} aria-label={t('letter.close')}>×</button></header>
      {shown.length === 0 && <p className="muted">{t('letter.commentsEmpty')}</p>}
      {shown.map(c => (
        <CommentCard key={c.id} c={c} active={here.includes(c.id)} editing={editing === c.id} author={author}
          onShow={() => showComment(editor, c.id)}
          onSave={text => {
            if (!text.trim()) { if (!c.text) remove(c.id); else setEditing(null); return; }
            update(c.id, x => ({ ...x, text: text.trim() }));
            setEditing(null);
            editor.commands.focus();
          }}
          onCancel={() => { if (!c.text) remove(c.id); else setEditing(null); editor.commands.focus(); }}
          onEdit={() => setEditing(c.id)}
          onReply={text => update(c.id, x => ({ ...x, replies: [...(x.replies ?? []), { id: newCommentId(), author: author(), date: new Date().toISOString(), text }] }))}
          onResolve={() => update(c.id, x => ({ ...x, resolved: !x.resolved || undefined }))}
          onDelete={() => remove(c.id)} />
      ))}
    </aside>
  );
}

function CommentCard({ c, active, editing, author, onShow, onSave, onCancel, onEdit, onReply, onResolve, onDelete }: {
  c: LetterComment; active: boolean; editing: boolean; author: () => string;
  onShow: () => void; onSave: (text: string) => void; onCancel: () => void; onEdit: () => void;
  onReply: (text: string) => void; onResolve: () => void; onDelete: () => void;
}) {
  const [draft, setDraft] = useState(c.text);
  const [reply, setReply] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const card = useRef<HTMLElement>(null);
  useEffect(() => { if (editing) { setDraft(c.text); box.current?.focus(); } }, [editing, c.text]);
  useEffect(() => { if (active) card.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [active]);
  const keys = (e: React.KeyboardEvent, send: () => void, cancel: () => void) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };
  return (
    <article ref={card} className={`cmt-card${active ? ' on' : ''}${c.resolved ? ' resolved' : ''}`} onClick={() => { if (!editing) onShow(); }}>
      <div className="cmt-head">
        <Avatar name={c.author} />
        <span className="cmt-who"><b>{c.author}</b><small>{when(c.date)}{c.resolved ? ` · ${t('letter.commentResolved')}` : ''}</small></span>
        <span className="cmt-tools" onClick={e => e.stopPropagation()}>
          <button type="button" title={t(c.resolved ? 'letter.commentReopen' : 'letter.commentResolve')} aria-label={t(c.resolved ? 'letter.commentReopen' : 'letter.commentResolve')} onClick={onResolve}><Icon name={c.resolved ? 'undo' : 'check'} /></button>
          <button type="button" title={t('letter.commentEdit')} aria-label={t('letter.commentEdit')} onClick={onEdit}><Icon name="pen" /></button>
          <button type="button" title={t('letter.commentDelete')} aria-label={t('letter.commentDelete')} onClick={onDelete}><Icon name="trash" /></button>
        </span>
      </div>
      {editing ? (
        <div className="cmt-edit" onClick={e => e.stopPropagation()}>
          <textarea ref={box} value={draft} rows={3} placeholder={t('letter.commentPlaceholder')} aria-label={t('letter.comment')}
            onChange={e => setDraft(e.target.value)} onKeyDown={e => keys(e, () => onSave(draft), onCancel)} />
          <div className="cmt-actions">
            <button type="button" className="ghost" onClick={onCancel}>{t('letter.cancel')}</button>
            <button type="button" className="primary" onClick={() => onSave(draft)} disabled={!draft.trim()}>{t('letter.commentPost')}</button>
          </div>
        </div>
      ) : <p className="cmt-text">{c.text}</p>}
      {(c.replies ?? []).map(r => (
        <div key={r.id} className="cmt-reply">
          <div className="cmt-head"><Avatar name={r.author} /><span className="cmt-who"><b>{r.author}</b><small>{when(r.date)}</small></span></div>
          <p className="cmt-text">{r.text}</p>
        </div>
      ))}
      {active && !editing && !c.resolved && (
        <div className="cmt-reply-box" onClick={e => e.stopPropagation()}>
          <Avatar name={author()} />
          <input value={reply} placeholder={t('letter.commentReply')} aria-label={t('letter.commentReply')}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && reply.trim()) { e.preventDefault(); onReply(reply.trim()); setReply(''); }
              if (e.key === 'Escape') setReply('');
            }} />
        </div>
      )}
    </article>
  );
}
