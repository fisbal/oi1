// Brand names (Martin, 2026-11-01, rule 15): "Office In 1" and every app's name never change, in any language and
// whatever translates the page. They are written as is, never through t(); src/shell/__tests__/brand.test.ts checks
// that every language keeps them and that the page tells browser translators to leave it alone.
export const SUITE = 'Office In 1';
export const BRANDS = [
  SUITE, 'OI1', 'Office Letter', 'Office Class', 'Office Stage', 'Office Code+', 'Office ProDFos', 'Office Assistant',
  'Office Notes', 'Office Plan', 'Office Mail', 'Office Draw', 'Office Form', 'Office Image', 'ProDFos',
] as const;
