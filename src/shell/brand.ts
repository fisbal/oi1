// Brand names (Martin, 2026-11-01, rule 15; apps renamed "Office X" -> "In 1 X" the same day for trademark reasons): "Office In 1" and every app's name never change, in any language and
// whatever translates the page. They are written as is, never through t(); src/shell/__tests__/brand.test.ts checks
// that every language keeps them and that the page tells browser translators to leave it alone.
export const SUITE = 'Office In 1';
export const BRANDS = [
  SUITE, 'OI1', 'In 1 Letter', 'In 1 Class', 'In 1 Stage', 'In 1 Code+', 'In 1 ProDFos', 'In 1 Assistant',
  'In 1 Notes', 'In 1 Plan', 'In 1 Mail', 'In 1 Draw', 'In 1 Form', 'In 1 Image', 'ProDFos',
] as const;
