import { describe, it, expect } from 'vitest';
import { applyVoiceCommands, cleanWhisper, collapseRepeats, joinDictation, whisperLanguage } from '../dictation';

describe('voice commands', () => {
  it('French punctuation', () => {
    expect(applyVoiceCommands('bonjour virgule comment ça va point d’interrogation', 'fr-FR')).toBe('bonjour, comment ça va ?');
    expect(applyVoiceCommands('merci point à la ligne à bientôt', 'fr')).toBe('merci.\nÀ bientôt');
    expect(applyVoiceCommands('fin nouveau paragraphe suite', 'fr')).toBe('fin\n\nSuite');
    expect(applyVoiceCommands('le point important', 'fr')).toBe('le point important');
    expect(applyVoiceCommands('Bonjour, virgule.', 'fr')).toBe('Bonjour,');
  });
  it('English, Spanish, Portuguese, German', () => {
    expect(applyVoiceCommands('hello comma world full stop', 'en-US')).toBe('hello, world.');
    expect(applyVoiceCommands('first new line second', 'en')).toBe('first\nSecond');
    expect(applyVoiceCommands('hola coma qué tal signo de interrogación', 'es')).toBe('hola, qué tal?');
    expect(applyVoiceCommands('olá vírgula tudo bem ponto final', 'pt')).toBe('olá, tudo bem.');
    expect(applyVoiceCommands('Hallo Komma wie geht es Fragezeichen', 'de')).toBe('Hallo, wie geht es?');
  });
  it('leaves plain text alone', () => {
    expect(applyVoiceCommands('  just words  ', 'en')).toBe('just words');
  });
  it('drops Whisper captions', () => {
    expect(cleanWhisper('[Musique]')).toBe('');
    expect(cleanWhisper('Sous-titres réalisés par la communauté d\'Amara.org')).toBe('');
    expect(cleanWhisper(' Bonjour à tous. ')).toBe('Bonjour à tous.');
  });
  it('joins text in plain fields', () => {
    expect(joinDictation('', ' hi')).toBe('hi');
    expect(joinDictation('hi', 'there')).toBe('hi there');
    expect(joinDictation('hi', ', there')).toBe('hi, there');
  });
  it('maps languages', () => {
    expect(whisperLanguage('fr-FR')).toBe('french');
    expect(whisperLanguage('pt')).toBe('portuguese');
  });
  it('keeps a Whisper loop only once', () => {
    expect(cleanWhisper('Je pas de mode pas de mode pas de mode pas de mode')).toBe('Je pas de mode');
    expect(collapseRepeats('Bonjour tout le monde. Bonjour tout le monde.')).toBe('Bonjour tout le monde. Bonjour tout le monde.');
    expect(collapseRepeats('oui oui oui oui, merci')).toBe('oui, merci');
    expect(collapseRepeats('le chat dort sur le tapis')).toBe('le chat dort sur le tapis');
  });
});
