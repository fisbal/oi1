// The Doc adm/Mil tab's dialogs: fill in every [field] of a letter at once, and edit "My info".

import type { Editor } from '@tiptap/core';
import { useState } from 'react';
import { t, type MessageKey } from '../../../shell/i18n';
import { Dialog } from '../../../ui/kit';
import { fieldList, fillFields } from './markup';
import { PROFILE_KEYS, loadProfile, profileValues, rememberValues, saveProfile, type Profile } from './profile';

export function FillDialog({ editor, onClose, onDone }: { editor: Editor; onClose: () => void; onDone: (filled: number) => void }) {
  const [fields] = useState(() => fieldList(editor.state.doc));
  const [values, setValues] = useState<Record<string, string>>(() => profileValues(fields.map(f => f.label)));
  const [remember, setRemember] = useState(true);
  return (
    <Dialog title={t('letter.docs.fillTitle')} onClose={onClose}
      onOk={() => {
        const n = fillFields(editor, values);
        if (remember) rememberValues(values);
        onDone(n);
      }}>
      <p className="muted">{t('letter.docs.fillHint')}</p>
      <div className="fill-list">
        {fields.map(({ label, count }) => {
          const long = label.length > 40 || /[.:]$/.test(label);
          const set = (v: string) => setValues(x => ({ ...x, [label]: v }));
          return (
            <label key={label} className={long ? 'wide' : ''}>
              <span>{label}{count > 1 && <em> ×{count}</em>}</span>
              {long
                ? <textarea rows={2} value={values[label] ?? ''} onChange={e => set(e.target.value)} />
                : <input value={values[label] ?? ''} onChange={e => set(e.target.value)} />}
            </label>
          );
        })}
      </div>
      <label className="check">
        <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> {t('letter.docs.remember')}
      </label>
    </Dialog>
  );
}

export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState<Profile>(loadProfile);
  return (
    <Dialog title={t('letter.docs.profile')} onClose={onClose} onOk={() => saveProfile(p)}>
      <p className="muted">{t('letter.docs.profileHint')}</p>
      <div className="fill-list">
        {PROFILE_KEYS.map(k => (
          <label key={k}>
            <span>{t(`letter.profile.${k}` as MessageKey)}</span>
            <input value={p[k] ?? ''} onChange={e => setP(x => ({ ...x, [k]: e.target.value }))} />
          </label>
        ))}
      </div>
    </Dialog>
  );
}
