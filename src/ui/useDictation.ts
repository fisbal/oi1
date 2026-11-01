import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../shell/i18n';
import { startDictation, type Dictation, type DictationStatus } from './dictation';

/** The words to show for a dictation status (5 languages). */
export function dictationText(s: DictationStatus | null): string {
  if (!s) return '';
  switch (s.kind) {
    case 'starting': return t('dictation.starting');
    case 'loading': return t('dictation.loading', { pct: s.pct });
    case 'listening': return s.heard ? `${t(s.engine === 'device' ? 'dictation.listeningDevice' : 'dictation.listening')} ${s.heard}` : t(s.engine === 'device' ? 'dictation.listeningDevice' : 'dictation.listening');
    case 'working': return t('dictation.working');
    case 'error': return t(`dictation.${s.code}`);
    default: return '';
  }
}

/**
 * Dictation for a component: toggle() starts/stops, onText receives ready text.
 * `message` is the live status (or the last error) to show near the button.
 */
export function useDictation(lang: string, onText: (text: string) => void) {
  const [status, setStatus] = useState<DictationStatus | null>(null);
  const [active, setActive] = useState(false);
  const run = useRef<Dictation | null>(null);
  const cb = useRef(onText);
  cb.current = onText;
  const stop = useCallback(() => { run.current?.stop(); }, []);
  const toggle = useCallback(() => {
    if (run.current) { run.current.stop(); return; }
    setActive(true);
    const d = startDictation({
      lang,
      onText: text => cb.current(text),
      onStatus: s => {
        if (s.kind === 'stopped') {
          if (run.current === d) run.current = null;
          setActive(false);
          setStatus(prev => (prev?.kind === 'error' ? prev : null));
        } else setStatus(s);
      },
    });
    run.current = d;
  }, [lang]);
  useEffect(() => () => run.current?.stop(), []);
  return { active, status, message: dictationText(status), error: status?.kind === 'error', toggle, stop };
}
