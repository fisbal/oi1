// The 🎙️ "In 1" button in the top bar (Martin, 2026-11-03): one tap, say what you want ("ouvre Class", "dicte",
// "annule", "enregistre", or any request), and In 1 does it. Nothing listens before the tap; the light shows when it does.
import { useEffect, useRef, useState } from 'react';
import { getLanguage, t } from '../i18n';
import { modules } from '../modules';
import { startDictation, type Dictation } from '../../ui/dictation';
import { parseVoice, type VoiceAction } from './commands';
import './voice.css';

const SPEECH: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', pt: 'pt-PT', de: 'de-DE' };
const shown = () => document.querySelector<HTMLElement>('.app-frame:not([hidden])');

/** Presses a button of the app on screen by its help key (works in every language). */
function press(keys: string[]): boolean {
  const frame = shown();
  for (const k of keys) {
    const b = frame?.querySelector<HTMLButtonElement>(`[data-help="${k}"]:not(:disabled)`);
    if (b) { b.click(); return true; }
  }
  return false;
}
function shortcut(key: string) {
  const target = (shown()?.querySelector<HTMLElement>('.ProseMirror, .cells-area, .module-host') ?? document.body);
  for (const type of ['keydown', 'keyup']) target.dispatchEvent(new KeyboardEvent(type, { key, ctrlKey: true, bubbles: true, cancelable: true }));
}

export function runVoice(a: VoiceAction, open: (id: string) => void): string {
  switch (a.kind) {
    case 'open': {
      const m = modules.find(x => x.id === a.app);
      if (!m) return t('voice.unknown');
      open(m.id);
      return t('voice.opened', { app: m.name });
    }
    case 'dictate':
      // The voice button's own listening ends first, then the document's dictation starts.
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('oi1-voice-dictate')), 450);
      return shown() ? t('voice.dictating') : t('voice.openFirst');
    case 'listen':
      // In 1 Notes opens its consent card (never listens before everyone agrees). Notes on screen takes it
      // at once; otherwise In 1 Notes opens and takes it when it starts.
      try { sessionStorage.setItem('oi1.voice.listen', '1'); } catch { /* private mode */ }
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('oi1-voice-listen'));
        window.setTimeout(() => { let left = false; try { left = sessionStorage.getItem('oi1.voice.listen') === '1'; } catch { /* */ } if (left) open('notes'); }, 120);
      }, 450);
      return t('voice.notesListen');
    case 'key': {
      const done = a.key === 'undo' ? press(['letter.undo'])
        : a.key === 'redo' ? press(['letter.redo'])
        : a.key === 'zoomIn' ? press(['letter.zoomIn', 'class.zoomIn', 'zoomIn'])
        : a.key === 'zoomOut' ? press(['letter.zoomOut', 'class.zoomOut', 'zoomOut'])
        : false;
      if (!done && (a.key === 'save' || a.key === 'print')) shortcut(a.key === 'save' ? 's' : 'p');
      return t(`voice.did.${a.key}`);
    }
    case 'ask':
      window.dispatchEvent(new CustomEvent('oi1-assistant', { detail: a.text }));
      return t('voice.asked');
    case 'stop': return t('voice.bye');
    default: return t('voice.unknown');
  }
}

export function In1Voice({ open }: { open: (id: string) => void }) {
  const [on, setOn] = useState(false);
  const [note, setNote] = useState('');
  const run = useRef<Dictation | null>(null);
  const heard = useRef('');
  const timer = useRef(0);
  const noteTimer = useRef(0);
  const say = (s: string, ms = 3500) => { setNote(s); clearTimeout(noteTimer.current); if (ms) noteTimer.current = window.setTimeout(() => setNote(''), ms); };

  const finish = () => {
    clearTimeout(timer.current);
    const d = run.current; run.current = null;
    d?.stop();
    setOn(false);
    const words = heard.current.trim();
    heard.current = '';
    if (!words) { say(t('voice.nothing')); return; }
    say(`« ${words} » — ${runVoice(parseVoice(words, getLanguage()), open)}`, 5000);
  };

  const start = () => {
    if (run.current) { finish(); return; }
    heard.current = '';
    setOn(true);
    say(t('voice.listening'), 0);
    // One request: it ends 1.4 s after the person stops talking (or after 10 s).
    timer.current = window.setTimeout(finish, 10000);
    run.current = startDictation({
      lang: SPEECH[getLanguage()] ?? getLanguage(),
      auto: false,
      onText: text => {
        heard.current = `${heard.current} ${text}`.trim();
        say(`« ${heard.current} »`, 0);
        clearTimeout(timer.current);
        timer.current = window.setTimeout(finish, 1400);
      },
      onStatus: s => {
        if (s.kind === 'listening' && s.heard) say(`« ${s.heard} »`, 0);
        if (s.kind === 'loading') say(t('dictation.loading', { pct: s.pct }), 0);
        if (s.kind === 'error') { say(t(`dictation.${s.code}`), 6000); clearTimeout(timer.current); run.current = null; setOn(false); }
      },
    });
  };
  useEffect(() => () => { run.current?.stop(); clearTimeout(timer.current); clearTimeout(noteTimer.current); }, []);

  return (
    <div className="in1-voice">
      <button type="button" className={`in1-voice-btn${on ? ' on' : ''}`} aria-pressed={on} aria-label={t('voice.button')} title={t('voice.help')} onClick={start}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" /><path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" /></svg>
        <span className="in1-voice-name" translate="no">In 1</span>
      </button>
      {note && <div className="in1-voice-note" role="status">{on && <i className="in1-voice-dot" />}{note}</div>}
    </div>
  );
}
