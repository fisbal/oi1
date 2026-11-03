import { describe, expect, it } from 'vitest';
import { SmartWriter, dropFillers, isQuestion } from '../smartPunct';

/** Runs phrases [text, pause] through a writer, flushing like a silence would after each long pause, and returns the text. */
function write(lang: string, phrases: [string, number][], before = '') {
  const w = new SmartWriter(lang);
  let out = '';
  for (const [text, pause] of phrases) {
    if (pause >= 1.5 && out) out += w.flush();
    const r = w.phrase({ text, pause }, before + out);
    out += (out && r.text && !/^[\s,.;:!?…)»”\n]/.test(r.text) && !/\s$/.test(out) ? ' ' : '') + r.text;
  }
  return out + w.flush();
}

describe('smart dictation', () => {
  it('joins pieces cut by a breath, even when Whisper put a full stop', () => {
    expect(write('fr', [['Je voudrais vous dire.', Infinity], ['Que le projet avance bien.', 0.5]])).toBe('Je voudrais vous dire que le projet avance bien.');
  });
  it('ends the sentence on a real pause and adds the capital (no punctuation from the engine)', () => {
    expect(write('fr', [['le rapport est prêt', Infinity], ['je vous l’envoie demain', 1.6]])).toBe('Le rapport est prêt. Je vous l’envoie demain.');
  });
  it('starts a new paragraph after a long pause', () => {
    expect(write('en', [['the meeting went well', Infinity], ['next week we start the tests', 4.2]])).toBe('The meeting went well.\n\nNext week we start the tests.');
  });
  it('finds questions from their first words (5 languages)', () => {
    expect(write('fr', [['est-ce que tu viens demain', Infinity]])).toBe('Est-ce que tu viens demain ?');
    expect(write('en', [['can you send the file', Infinity]])).toBe('Can you send the file?');
    expect(isQuestion('wie geht es dir', 'de')).toBe(true);
    expect(isQuestion('dónde está la oficina', 'es')).toBe(true);
    expect(isQuestion('onde fica o escritório', 'pt')).toBe(true);
    expect(isQuestion('le projet avance', 'fr')).toBe(false);
  });
  it('shapes a letter: greeting, body, closing', () => {
    expect(write('fr', [['bonjour madame', Infinity], ['je vous remercie pour votre réponse', 1.2], ['cordialement', 2], ['Martin', 1]]))
      .toBe('Bonjour madame,\n\nJe vous remercie pour votre réponse.\n\nCordialement,\nMartin.');
  });
  it('puts each step of a list on its own line', () => {
    expect(write('fr', [['voici le plan', Infinity], ['premièrement on prépare', 1.2], ['deuxièmement on teste', 1.2]]))
      .toBe('Voici le plan.\nPremièrement on prépare.\nDeuxièmement on teste.');
  });
  it('drops hesitations and keeps every other word', () => {
    expect(dropFillers('euh je pense euh que oui', 'fr')).toBe('je pense que oui');
    expect(dropFillers('um I think, uh, yes', 'en')).toBe('I think, yes');
    expect(dropFillers('heureux', 'fr')).toBe('heureux');
  });
  it('lets spoken marks win', () => {
    expect(write('fr', [['bonjour à tous virgule je commence point à la ligne', Infinity], ['voici', 2]])).toBe('Bonjour à tous, je commence.\nVoici.');
  });
  it('capitalizes the first word only at the start of a sentence', () => {
    expect(write('fr', [['et voilà', Infinity]], 'Nous avons fini ')).toBe('et voilà.');
    expect(write('fr', [['et voilà', Infinity]], 'Nous avons fini. ')).toBe('Et voilà.');
  });
  it('understands "efface ça" and "arrête la dictée"', () => {
    const w = new SmartWriter('fr');
    w.phrase({ text: 'bonjour', pause: Infinity });
    expect(w.phrase({ text: 'efface ça', pause: 1 }).command).toBe('undo');
    expect(w.phrase({ text: 'Arrête la dictée.', pause: 1 }).command).toBe('stop');
    expect(new SmartWriter('en').phrase({ text: 'delete that', pause: 1 }).command).toBe('undo');
  });
  it('keeps German nouns capitalized when joining', () => {
    expect(write('de', [['Ich habe den Bericht.', Infinity], ['Heute geschickt.', 0.4]])).toBe('Ich habe den Bericht Heute geschickt.');
  });
});

describe('smart dictation keeps spoken marks', () => {
  it('a spoken full stop after a greeting stays a full stop', () => {
    expect(write('en', [['hello comma world full stop', Infinity]])).toBe('Hello, world.');
    expect(write('fr', [['bonjour virgule le monde point', Infinity]])).toBe('Bonjour, le monde.');
  });
});
