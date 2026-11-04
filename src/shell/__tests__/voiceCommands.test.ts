import { describe, expect, it } from 'vitest';
import { heardName, parseSteps, parseVoice, stripWake, wordsToNumber } from '../voice/commands';

describe('In 1 voice commands', () => {
  it('hears its name the many ways engines write it', () => {
    for (const s of ['In 1 ouvre Class', 'in one, ouvre Class', 'In un ouvre Class', 'Inone ouvre class', 'Hein un, ouvre Class']) expect(stripWake(s).called).toBe(true);
    expect(stripWake('ouvre Class').called).toBe(false);
  });
  it('opens apps in 5 languages', () => {
    expect(parseVoice('In 1, ouvre Class')).toEqual({ kind: 'open', app: 'class' });
    expect(parseVoice('In one open the spreadsheet', 'en')).toEqual({ kind: 'open', app: 'class' });
    expect(parseVoice('in 1 nouvelle lettre')).toEqual({ kind: 'open', app: 'letter', fresh: true });
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

// Martin (2026-11-03): "when you say close it opens again"; "go to Class and write four"; "print… delete the selection…
// make it red… remove the line"; "every button linked to In 1's listening".
describe('In 1 smart commands', () => {
  it('closes apps instead of opening them again', () => {
    expect(parseVoice('In 1 ferme Letter')).toEqual({ kind: 'close', app: 'letter' });
    expect(parseVoice('in one close class', 'en')).toEqual({ kind: 'close', app: 'class' });
    expect(parseVoice('In 1 ferme tout')).toEqual({ kind: 'close', all: true });
    expect(parseVoice('In 1 ferme toutes les lettres')).toEqual({ kind: 'close', app: 'letter', all: true });
    expect(parseVoice('In 1 cierra la hoja', 'es')).toEqual({ kind: 'close', app: 'class' });
    expect(parseVoice('In 1 schliesse Mail', 'de')).toEqual({ kind: 'close', app: 'mail' });
    expect(parseVoice('In 1 ferme')).toEqual({ kind: 'close' });
  });
  it('goes to an app and does several things in one sentence', () => {
    expect(parseSteps('In 1 va dans Class et écris quatre')).toEqual([{ kind: 'open', app: 'class' }, { kind: 'type', text: 'quatre' }]);
    expect(parseSteps('in one go to class and write four', 'en')).toEqual([{ kind: 'open', app: 'class' }, { kind: 'type', text: 'four' }]);
    expect(parseSteps('In 1 ouvre Letter puis dicte')).toEqual([{ kind: 'open', app: 'letter' }, { kind: 'dictate' }]);
    // "et" inside a text stays in the text.
    expect(parseSteps('In 1 écris noir et blanc')).toEqual([{ kind: 'type', text: 'noir et blanc' }]);
  });
  it('acts on the selection: delete, remove the line, colors, bold', () => {
    expect(parseVoice('In 1 supprime la sélection')).toEqual({ kind: 'do', what: 'delete' });
    expect(parseVoice('in one delete the selection', 'en')).toEqual({ kind: 'do', what: 'delete' });
    expect(parseVoice('In 1 enlève la ligne')).toEqual({ kind: 'do', what: 'removeLine' });
    expect(parseVoice('in one remove the line', 'en')).toEqual({ kind: 'do', what: 'removeLine' });
    expect(parseVoice('In 1 mets-le en rouge')).toEqual({ kind: 'do', what: 'color', value: '#E03131' });
    expect(parseVoice('in one make it red', 'en')).toEqual({ kind: 'do', what: 'color', value: '#E03131' });
    expect(parseVoice('In 1 en bleu')).toEqual({ kind: 'do', what: 'color', value: '#1C7ED6' });
    expect(parseVoice('In 1 mets en gras')).toEqual({ kind: 'do', what: 'bold' });
    expect(parseVoice('In 1 efface ça')).toEqual({ kind: 'key', key: 'undo' });
    expect(parseVoice('In 1 imprime la sélection')).toEqual({ kind: 'key', key: 'print' });
  });
  it('presses a button by its name', () => {
    expect(parseVoice('In 1 clique sur Insertion')).toEqual({ kind: 'button', words: 'insertion' });
    expect(parseVoice('in one click Bold', 'en')).toEqual({ kind: 'button', words: 'bold' });
  });
  it('reads numbers said in words', () => {
    expect(wordsToNumber('quatre')).toBe(4);
    expect(wordsToNumber('vingt-deux')).toBe(22);
    expect(wordsToNumber('quatre-vingt-dix')).toBe(90);
    expect(wordsToNumber('soixante et onze')).toBe(71);
    expect(wordsToNumber('forty two')).toBe(42);
    expect(wordsToNumber('two hundred')).toBe(200);
    expect(wordsToNumber('4')).toBe(4);
    expect(wordsToNumber('bonjour')).toBeNull();
  });
});
