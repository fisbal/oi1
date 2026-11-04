import { describe, expect, it } from 'vitest';
import { keepLanguageNote } from '../proof';

describe('keepLanguageNote', () => {
  it('names the language of the text, not of the interface', () => {
    expect(keepLanguageNote('En este estudio de caso, los cambios fue impuestos y los empleados no ha sido informados.', 'fr')).toContain('Spanish');
    expect(keepLanguageNote('Neste estudo de caso, as mudanças foi impostas e os funcionários não foi informados.', 'en')).toContain('Portuguese');
    expect(keepLanguageNote('In dieser Fallstudie wurde die Änderungen schnell eingeführt und die Mitarbeiter wurde nicht informiert.', 'en')).toContain('German');
  });
  it('uses the interface language for a very short text', () => {
    expect(keepLanguageNote('Ok', 'fr-CA')).toContain('French');
  });
});
