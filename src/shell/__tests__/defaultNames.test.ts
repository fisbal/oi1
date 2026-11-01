import { describe, expect, it } from 'vitest';
import { defaultNumber, isDefaultText, relabel } from '../defaultNames';
import { setLanguage } from '../i18n';

describe('default names follow the language', () => {
  it('knows the defaults of every language, and only them', () => {
    expect(isDefaultText('letter.untitled', 'Untitled letter')).toBe(true);
    expect(isDefaultText('letter.untitled', 'Unbenannter Brief')).toBe(true);
    expect(isDefaultText('letter.untitled', 'Letter to the bank')).toBe(false);
    expect(defaultNumber('class.sheet', 'Sheet1')).toBe(1);
    expect(defaultNumber('class.sheet', 'Feuille12')).toBe(12);
    expect(defaultNumber('class.sheet', 'Budget')).toBeNull();
    expect(defaultNumber('class.sheet', 'Sheet1 copy')).toBeNull();
  });
  it('gives the current language’s default, or null when nothing changes', () => {
    setLanguage('fr');
    expect(relabel('letter.untitled', 'Untitled letter')).toBe('Lettre sans titre');
    expect(relabel('class.sheet', 'Sheet3')).toBe('Feuille3');
    expect(relabel('class.sheet', 'Feuille3')).toBeNull();
    expect(relabel('class.sheet', 'Ventes')).toBeNull();
    setLanguage('en');
  });
});
