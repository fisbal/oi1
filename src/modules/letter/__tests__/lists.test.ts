import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { letterExtensions } from '../setup';
import { BULLET_STYLES, NUMBER_STYLES, listStylesCss, numberLabel } from '../extensions';
import { MARGIN_PRESETS, PAGE_SIZES } from '../page';
import { CALLOUT_KINDS, CLEAN_UPS } from '../smart';
import { LETTER_PARTS, letterPartMarkup } from '../templates/parts';
import { SPACING, THEMES } from '../themes';
import { CASE_MODES, PASTE_KINDS, PASTE_PROMPTS, changeCase, changeCaseText, pasteHtml, textToRows } from '../textTools';

// Martin's rule for all of Office In 1: every list offers at least 20 choices, like Word.
describe('Letter lists have 20 choices or more', () => {
  it.each([
    ['bullets', BULLET_STYLES], ['numbering', NUMBER_STYLES], ['case', CASE_MODES], ['paste', PASTE_KINDS],
    ['callouts', CALLOUT_KINDS], ['clean-ups', CLEAN_UPS], ['letter parts', LETTER_PARTS], ['themes', THEMES],
    ['spacing', Object.keys(SPACING)], ['margins', Object.keys(MARGIN_PRESETS)], ['paper sizes', Object.keys(PAGE_SIZES)],
  ])('%s', (_, list) => expect(list.length).toBeGreaterThanOrEqual(20));
});

describe('numbering', () => {
  it('labels items in every format', () => {
    expect(numberLabel('decimal', 3)).toBe('3.');
    expect(numberLabel('decimal-zero', 3)).toBe('03.');
    expect(numberLabel('lower-alpha-both', 2)).toBe('(b)');
    expect(numberLabel('upper-roman', 4)).toBe('IV.');
    expect(numberLabel('lower-roman-paren', 9)).toBe('ix)');
    expect(numberLabel('section', 2)).toBe('§ 2.');
  });
  it('draws every bullet and number format', () => {
    const css = listStylesCss();
    for (const st of [...BULLET_STYLES, ...NUMBER_STYLES]) expect(css).toContain(`data-list-style="${st}"`);
    expect(css).toContain('counter(list-item, decimal) " –  "');
  });
});

describe('change case', () => {
  it('converts text', () => {
    expect(changeCaseText('bonjour le MONDE. ça va', 'sentence')).toBe('Bonjour le monde. Ça va');
    expect(changeCaseText('hello big world', 'title')).toBe('Hello Big World');
    expect(changeCaseText('Hello big World', 'camel')).toBe('helloBigWorld');
    expect(changeCaseText('Hello big World', 'snake')).toBe('hello_big_world');
    expect(changeCaseText('Hello big World', 'kebab')).toBe('hello-big-world');
    expect(changeCaseText('Élève à côté', 'noAccents')).toBe('Eleve a cote');
    expect(changeCaseText('Quoi? Oui!', 'frenchSpaces')).toBe('Quoi\u202f? Oui\u202f!');
    expect(changeCaseText('a  b   c', 'trimSpaces')).toBe('a b c');
  });
  it('keeps bold when changing the case of a selection', () => {
    const e = new Editor({ extensions: letterExtensions('body'), content: '<p>hello <strong>big</strong> world</p>' });
    e.commands.selectAll();
    changeCase(e, 'upper');
    expect(e.getHTML()).toContain('HELLO <strong>BIG</strong> WORLD');
    e.destroy();
  });
});

describe('paste as', () => {
  it('reads rows from Excel, CSV and spaced text', () => {
    expect(textToRows('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(textToRows('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(textToRows('a  b\n1  2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('turns plain text into lists, tables and joined lines', () => {
    expect(pasteHtml('bullets', '- one\n- two')).toBe('<ul><li><p>one</p></li><li><p>two</p></li></ul>');
    expect(pasteHtml('numbers', '1. one\n2. two')).toBe('<ol><li><p>one</p></li><li><p>two</p></li></ol>');
    expect(pasteHtml('table', 'a\tb')).toBe('<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>');
    expect(pasteHtml('joinLines', 'a broken\nline from a PDF, with a hy-\nphen')).toBe('<p>a broken line from a PDF, with a hyphen</p>');
    expect(pasteHtml('link', 'www.example.com')).toBe('<p><a href="https://www.example.com">www.example.com</a></p>');
    expect(pasteHtml('text', '<b>x</b>')).toBe('<p>&lt;b&gt;x&lt;/b&gt;</p>');
  });
  it('asks Claude for every AI kind', () => {
    for (const k of PASTE_KINDS.filter(k => k.startsWith('ai'))) expect(PASTE_PROMPTS[k], k).toBeTruthy();
    for (const k of PASTE_KINDS.filter(k => k !== 'keep' && !k.startsWith('ai'))) expect(pasteHtml(k, 'x'), k).not.toBeNull();
  });
});

describe('letter parts', () => {
  it('has every part in French and English', () => {
    for (const p of LETTER_PARTS) {
      expect(letterPartMarkup(p, 'fr').trim(), p).not.toBe('');
      expect(letterPartMarkup(p, 'en').trim(), p).not.toBe('');
    }
  });
});
