import { describe, expect, it } from 'vitest';
import { setLanguage, t } from '../i18n';

describe('t() with values', () => {
  it('puts a value everywhere its name appears (Martin, 2026-11-04: "la norme cite ({who}, 1943)")', () => {
    setLanguage('fr');
    const s = t('ana.noYear', { who: 'Maslow', year: 1943 });
    expect(s).toContain('Maslow');
    expect(s).toContain('(Maslow, 1943)');
    expect(s).not.toContain('{who}');
  });
});
