// The 🎙️ "In 1" button in the top bar (Martin, 2026-11-03): one tap, say what you want ("ouvre Class", "dicte",
// "annule", "enregistre", or any request), and In 1 does it. Nothing listens before the tap; the light shows when it does.
// Part 3, the name: after the person turns on 👂 once, saying "In 1, ouvre Class" works without a tap. That listening
// runs only on the device (Whisper in the browser, nothing is sent anywhere), shows a green light on the button, pauses
// while a document dictates or the app is hidden, and stays on until the person turns it off.
import { useEffect, useRef, useState } from 'react';
import { getLanguage, t } from '../i18n';
import { modules } from '../modules';
import { dictationRunning, startDictation, type Dictation } from '../../ui/dictation';
import { heardName, parseVoice, type VoiceAction } from './commands';
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

const NAME_KEY = 'oi1.voice.name';
const nameWanted = () => { try { return localStorage.getItem(NAME_KEY) === 'on'; } catch { return false; } };

export function In1Voice({ open }: { open: (id: string) => void }) {
  const [on, setOn] = useState(false);
  const [note, setNote] = useState('');
  // The name "In 1": wanted (the person's choice, kept) and really listening now (the green light).
  const [name, setName] = useState(nameWanted);
  const [nameLive, setNameLive] = useState(false);
  const run = useRef<Dictation | null>(null);
  const heard = useRef('');
  const timer = useRef(0);
  const noteTimer = useRef(0);
  const nameRun = useRef<Dictation | null>(null);
  const waiting = useRef(0); // the name was said alone: the next phrase is the request (until this time)
  const wanted = useRef(name);
  const loadingNote = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  const say = (s: string, ms = 3500) => { setNote(s); clearTimeout(noteTimer.current); if (ms) noteTimer.current = window.setTimeout(() => setNote(''), ms); };
  const act = (words: string) => {
    const a = parseVoice(words, getLanguage());
    if (a.kind === 'none') { say(t('voice.listening'), 0); waiting.current = Date.now() + 6000; return; }
    say(`« ${words} » — ${runVoice(a, id => openRef.current(id))}`, 5000);
  };

  // ---- the name "In 1"
  const stopName = () => { const d = nameRun.current; nameRun.current = null; d?.stop(); setNameLive(false); };
  const startName = () => {
    if (!wanted.current || nameRun.current || run.current || dictationRunning() || document.hidden) return;
    const d = startDictation({
      lang: SPEECH[getLanguage()] ?? getLanguage(),
      engine: 'device', // on the device only: nothing heard leaves it
      auto: false,
      quiet: true,
      onText: text => {
        if (nameRun.current !== d) return;
        const words = text.trim();
        if (!words) return;
        if (waiting.current > Date.now()) { waiting.current = 0; act(words); return; }
        const rest = heardName(words);
        if (rest === null) return;
        if (!rest) { waiting.current = Date.now() + 6000; say(t('voice.listening'), 6000); return; }
        act(words);
      },
      onStatus: s => {
        if (nameRun.current !== d) return;
        if (s.kind === 'loading') { loadingNote.current = true; say(t('voice.nameLoading', { pct: s.pct }), 0); }
        if (s.kind === 'listening') { setNameLive(true); if (loadingNote.current) { loadingNote.current = false; say(t('voice.nameReady'), 6000); } }
        if (s.kind === 'error') {
          nameRun.current = null; setNameLive(false);
          if (s.code === 'denied' || s.code === 'nomic' || s.code === 'unsupported') { wanted.current = false; setName(false); try { localStorage.removeItem(NAME_KEY); } catch { /* */ } }
          say(t(`dictation.${s.code}`), 6000);
          // A passing problem (download cut, offline the first time): try again later, still wanted.
          if (s.code === 'failed') window.setTimeout(startName, 30000);
        }
        if (s.kind === 'stopped' && nameRun.current === d) { nameRun.current = null; setNameLive(false); window.setTimeout(startName, 800); }
      },
    });
    nameRun.current = d;
  };
  const toggleName = () => {
    const next = !wanted.current;
    wanted.current = next; setName(next);
    try { if (next) localStorage.setItem(NAME_KEY, 'on'); else localStorage.removeItem(NAME_KEY); } catch { /* private mode */ }
    if (next) { say(t('voice.nameOn'), 9000); startName(); } else { stopName(); say(t('voice.nameOff')); }
  };

  const finish = () => {
    clearTimeout(timer.current);
    const d = run.current; run.current = null;
    d?.stop();
    setOn(false);
    const words = heard.current.trim();
    heard.current = '';
    window.setTimeout(startName, 900);
    if (!words) { say(t('voice.nothing')); return; }
    say(`« ${words} » — ${runVoice(parseVoice(words, getLanguage()), open)}`, 5000);
  };

  const start = () => {
    if (run.current) { finish(); return; }
    stopName(); // one microphone user at a time: the tap wins
    heard.current = '';
    setOn(true);
    say(t('voice.listening'), 0);
    // One request: it ends 1.4 s after the person stops talking (or after 10 s).
    timer.current = window.setTimeout(finish, 10000);
    run.current = startDictation({
      lang: SPEECH[getLanguage()] ?? getLanguage(),
      auto: false,
      quiet: true,
      onText: text => {
        heard.current = `${heard.current} ${text}`.trim();
        say(`« ${heard.current} »`, 0);
        clearTimeout(timer.current);
        timer.current = window.setTimeout(finish, 1400);
      },
      onStatus: s => {
        if (s.kind === 'listening' && s.heard) say(`« ${s.heard} »`, 0);
        if (s.kind === 'loading') say(t('dictation.loading', { pct: s.pct }), 0);
        if (s.kind === 'error') { say(t(`dictation.${s.code}`), 6000); clearTimeout(timer.current); run.current = null; setOn(false); window.setTimeout(startName, 900); }
      },
    });
  };

  useEffect(() => {
    // Pauses while a document dictates and while the app is hidden (battery, privacy); comes back after.
    const onDictation = (e: Event) => { if ((e as CustomEvent<boolean>).detail) stopName(); else window.setTimeout(startName, 900); };
    const onVisible = () => { if (document.hidden) stopName(); else startName(); };
    window.addEventListener('oi1-dictation', onDictation);
    document.addEventListener('visibilitychange', onVisible);
    startName(); // turned on before: it comes back (the browser already allowed the microphone)
    return () => {
      window.removeEventListener('oi1-dictation', onDictation);
      document.removeEventListener('visibilitychange', onVisible);
      run.current?.stop(); stopName(); clearTimeout(timer.current); clearTimeout(noteTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="in1-voice">
      <button type="button" className={`in1-voice-btn${on ? ' on' : ''}${nameLive && !on ? ' name' : ''}`} aria-pressed={on} aria-label={t('voice.button')} title={nameLive ? `${t('voice.help')} ${t('voice.nameLive')}` : t('voice.help')} onClick={start}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" /><path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" /></svg>
        <span className="in1-voice-name" translate="no">In 1</span>
        {nameLive && !on && <i className="in1-voice-light" aria-hidden="true" />}
      </button>
      <button type="button" className={`in1-name-btn${name ? ' on' : ''}`} aria-pressed={name} aria-label={t('voice.nameButton')} title={name ? t('voice.nameStop') : t('voice.nameHelp')} onClick={toggleName}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 6a3.5 3.5 0 0 1 7 0c0 2-2 2.6-2.4 4.4C8.8 12 8 13.5 6.6 13.5 5.6 13.5 5 12.8 5 12" /><path d="M7 6.2a1.2 1.2 0 0 1 2.3.4c0 .8-.9 1-.9 1.8" /></svg>
      </button>
      {note && <div className="in1-voice-note" role="status">{(on || nameLive) && <i className="in1-voice-dot" />}{note}</div>}
    </div>
  );
}
