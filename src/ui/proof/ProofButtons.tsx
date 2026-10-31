// The proofing buttons every app puts in its ribbon, next to its Spelling button: Claude's style check,
// grammar online on or off, and the user's own dictionary.

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { AiApi } from '../../shell/contract';
import { LANGUAGES, getLanguage, t } from '../../shell/i18n';
import { Btn, Drop, MenuItem } from '../kit';
import { recheck } from './extension';
import { grammarSettings, proofing } from './proof';
import { checkStyle } from './style';

export function ProofButtons({ editor, ai, lang, notify }: { editor: Editor | null; ai: AiApi; lang: string; notify: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [, redraw] = useState(0);
  useEffect(() => proofing.onChange(() => redraw(n => n + 1)), []);
  const style = async () => {
    if (!editor || busy) return;
    if (!ai.ready()) { notify(t('proof.needKey')); return; }
    setBusy(true);
    notify(t('proof.styleWorking'));
    try {
      const n = await checkStyle(editor, ai, LANGUAGES.find(l => l.code === getLanguage())?.name ?? 'English', lang);
      notify(n ? t('proof.styleFound', { n }) : t('proof.styleNone'));
    } catch (err) {
      notify(String((err as Error)?.message ?? err));
    } finally { setBusy(false); }
  };
  const words = proofing.personal();
  return <>
    <Btn big icon="sparkle" title="proof.checkStyle" onClick={() => void style()} active={busy} disabled={!editor} />
    <div className="stack">
      <Btn icon="check" title="proof.grammarOnline" text active={grammarSettings.on()}
        onClick={() => { grammarSettings.set(!grammarSettings.on()); recheck(editor); }} />
      <Drop icon="book" title="proof.dictionary" text>
        {close => words.length
          ? words.map(w => <MenuItem key={w} label={w} hint="✕" onClick={() => { proofing.removeWord(w); close(); }} />)
          : <MenuItem label={t('proof.dictionaryEmpty')} onClick={close} />}
      </Drop>
    </div>
  </>;
}
