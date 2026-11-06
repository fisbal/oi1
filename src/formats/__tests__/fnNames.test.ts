// Formulas typed in French, Spanish, Portuguese or German work like in Excel (Martin, 2026-11-06).
import { describe, expect, it } from 'vitest';
import { canonicalFormula } from '../fnNames';
import { evaluate } from '../formula';

const calc = (f: string) => evaluate(canonicalFormula(f).slice(1), () => 0, { c: 0, r: 0 });

describe('formulas in the person’s language', () => {
  it('turns Excel’s local names and separators into the stored form', () => {
    expect(canonicalFormula('=SOMME(A1:A3)')).toBe('=SUM(A1:A3)');
    expect(canonicalFormula('=si(A1>0;"oui, bien";"non")')).toBe('=IF(A1>0,"oui, bien","non")');
    expect(canonicalFormula('=MOYENNE(1,5;2)')).toBe('=AVERAGE(1.5,2)');
    expect(canonicalFormula("='Feuil 1'!A1+SOMME(B1;2)")).toBe("='Feuil 1'!A1+SUM(B1,2)");
    expect(canonicalFormula('=SUMA(A1:A2)')).toBe('=SUM(A1:A2)');
    expect(canonicalFormula('=SOMA(A1;A2)')).toBe('=SUM(A1,A2)');
    expect(canonicalFormula('=SUMME(A1;A2)')).toBe('=SUM(A1,A2)');
    expect(canonicalFormula('=RECHERCHEV(A1;B1:C9;2;FAUX)')).toBe('=VLOOKUP(A1,B1:C9,2,FALSE)');
    expect(canonicalFormula('=SUM(A1,A2)')).toBe('=SUM(A1,A2)');
    expect(canonicalFormula('=ET(VRAI;A1)')).toBe('=AND(TRUE,A1)');
  });
  it('computes them', () => {
    expect(calc('=SOMME(1,5;2)')).toBe(3.5);
    expect(calc('=SI(1>0;"oui";"non")')).toBe('oui');
    expect(calc('=ARRONDI(2,345;1)')).toBe(2.3);
    expect(calc('=MAJUSCULE("abc")')).toBe('ABC');
  });
});
