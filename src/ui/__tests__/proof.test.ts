// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadModule } from 'hunspell-asm';
import { baseLang, detectLang, words } from '../proof/proof';

describe('proofing', () => {
  it('finds the language of each paragraph', () => {
    expect(detectLang('Bonjour, je vous écris pour la réunion de demain.', 'en')).toBe('fr');
    expect(detectLang('Thank you for the meeting, it was very useful.', 'fr')).toBe('en');
    expect(detectLang('Hola, gracias por la reunión de ayer, fue muy útil.', 'en')).toBe('es');
    expect(detectLang('Olá, obrigado pela reunião, você foi muito útil.', 'en')).toBe('pt');
    expect(detectLang('Hallo, danke für das Treffen, es war sehr gut.', 'en')).toBe('de');
    // Too short to tell: the document's language.
    expect(detectLang('Paris', 'fr')).toBe('fr');
  });

  it('keeps only words worth checking', () => {
    const list = words("L'école de Martin ouvre à 8h, voir https://exemple.fr ou écrire à a@b.fr — NASA OK aujourd’hui").map(w => w.word);
    expect(list).toEqual(["L'école", 'de', 'Martin', 'ouvre', 'voir', 'ou', 'écrire', 'aujourd’hui']);
    const [w] = words('Une pome');
    expect(w).toMatchObject({ word: 'Une', from: 0, to: 3 });
  });

  it('maps document languages to dictionaries', () => {
    expect(baseLang('fr-CA')).toBe('fr');
    expect(baseLang('pt-BR')).toBe('pt');
    expect(baseLang('it-IT')).toBeNull();
    expect(baseLang('')).toBeNull();
  });

  it('spells and suggests with the five dictionaries', async () => {
    const f = await loadModule();
    const dict = (l: string) => {
      const dir = `node_modules/dictionary-${l}/index`;
      return f.create(f.mountBuffer(readFileSync(`${dir}.aff`), `${l}.aff`), f.mountBuffer(readFileSync(`${dir}.dic`), `${l}.dic`));
    };
    const fr = dict('fr');
    expect(fr.spell('pomme')).toBe(true);
    expect(fr.spell('pome')).toBe(false);
    expect(fr.spell('aujourd’hui')).toBe(true);
    expect(fr.suggest('pome')[0]).toBe('pomme');
    expect(dict('en').spell('sentense')).toBe(false);
    expect(dict('es').spell('gracias')).toBe(true);
    expect(dict('pt').spell('obrigado')).toBe(true);
    expect(dict('de').spell('Straße')).toBe(true);
  }, 30_000);
});
