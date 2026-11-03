import { describe, expect, it } from 'vitest';
import { heardName, parseVoice, stripWake } from '../voice/commands';

describe('In 1 voice commands', () => {
  it('hears its name the many ways engines write it', () => {
    for (const s of ['In 1 ouvre Class', 'in one, ouvre Class', 'In un ouvre Class', 'Inone ouvre class', 'Hein un, ouvre Class']) expect(stripWake(s).called).toBe(true);
    expect(stripWake('ouvre Class').called).toBe(false);
  });
  it('opens apps in 5 languages', () => {
    expect(parseVoice('In 1, ouvre Class')).toEqual({ kind: 'open', app: 'class' });
    expect(parseVoice('In one open the spreadsheet', 'en')).toEqual({ kind: 'open', app: 'class' });
    expect(parseVoice('in 1 nouvelle lettre')).toEqual({ kind: 'open', app: 'letter' });
    expect(parseVoice('In 1 abre la presentación', 'es')).toEqual({ kind: 'open', app: 'stage' });
    expect(parseVoice('In 1 abra as notas', 'pt')).toEqual({ kind: 'open', app: 'notes' });
    expect(parseVoice('In 1 öffne Mail', 'de')).toEqual({ kind: 'open', app: 'mail' });
    expect(parseVoice('Class')).toEqual({ kind: 'open', app: 'class' });
  });
  it('listens and takes notes in In 1 Notes (5 languages), dictation stays dictation', () => {
    expect(parseVoice('In 1, prends des notes')).toEqual({ kind: 'listen' });
    expect(parseVoice('in un écoute la réunion')).toEqual({ kind: 'listen' });
    expect(parseVoice('in one take notes', 'en')).toEqual({ kind: 'listen' });
    expect(parseVoice('In 1 toma notas', 'es')).toEqual({ kind: 'listen' });
    expect(parseVoice('In 1 tomar notas', 'pt')).toEqual({ kind: 'listen' });
    expect(parseVoice('In 1 mitschreiben', 'de')).toEqual({ kind: 'listen' });
    expect(parseVoice('In 1 prends en note')).toEqual({ kind: 'dictate' });
  });
  it('dictates, undoes, saves, prints, zooms, stops', () => {
    expect(parseVoice('In 1, dicte')).toEqual({ kind: 'dictate' });
    expect(parseVoice('in one dictate', 'en')).toEqual({ kind: 'dictate' });
    expect(parseVoice('In 1 annule')).toEqual({ kind: 'key', key: 'undo' });
    expect(parseVoice('In 1 enregistre')).toEqual({ kind: 'key', key: 'save' });
    expect(parseVoice('In 1 imprime')).toEqual({ kind: 'key', key: 'print' });
    expect(parseVoice('In 1 zoom avant')).toEqual({ kind: 'key', key: 'zoomIn' });
    expect(parseVoice('In 1 merci c’est tout')).toEqual({ kind: 'stop' });
  });
  it('sends anything else to In 1 Assistant', () => {
    expect(parseVoice('In 1, fais-moi un budget pour mars')).toEqual({ kind: 'ask', text: 'fais-moi un budget pour mars' });
  });
});

describe('the name "In 1" heard while listening for it (part 3)', () => {
  it('finds the name at the start, as speech engines write it, after a small word', () => {
    expect(heardName('In 1, ouvre Class.')).toBe('ouvre class');
    expect(heardName('In one open Letter')).toBe('open letter');
    expect(heardName('Euh, in un, dicte')).toBe('dicte');
    expect(heardName('Hey In 1 nouvelle lettre')).toBe('nouvelle lettre');
    expect(heardName('In eins öffne Class')).toBe('offne class');
  });
  it('gives an empty request when the name is said alone', () => {
    expect(heardName('In 1.')).toBe('');
    expect(heardName('in one')).toBe('');
  });
  it('never wakes on the same words in the middle of talk', () => {
    expect(heardName('We will finish in one hour')).toBeNull();
    expect(heardName('En un mot, c’est fini')).toBeNull();
    expect(heardName('Bonjour à tous')).toBeNull();
    expect(heardName('Interesting')).toBeNull();
    expect(heardName('Inside the box')).toBeNull();
  });
});
