import { describe, expect, it } from 'vitest';
import { wordDiff } from '../../modules/letter/copilot';
import { gridOf } from '../../modules/class/copilot';
import { markdownToHtml, payloadOf, plainText } from '../markdown';

const apply = (a: string, edits: { from: number; to: number; text: string }[]) =>
  [...edits].reverse().reduce((s, e) => s.slice(0, e.from) + e.text + s.slice(e.to), a);

describe('word diff for tracked corrections', () => {
  it('changes only the wrong words', () => {
    const a = 'Je suis aller a la plage hier, il fesait beau.';
    const b = 'Je suis allé à la plage hier, il faisait beau.';
    const edits = wordDiff(a, b);
    expect(apply(a, edits)).toBe(b);
    expect(edits.map(e => a.slice(e.from, e.to))).toEqual(['aller', 'a', 'fesait']);
  });
  it('handles added and removed words and punctuation', () => {
    for (const [a, b] of [['hello world', 'hello, big world!'], ['one two three', 'one three'], ['', 'new'], ['same', 'same']]) {
      expect(apply(a, wordDiff(a, b))).toBe(b);
    }
    expect(wordDiff('same', 'same')).toEqual([]);
  });
});

describe('answers', () => {
  it('takes the code block when there is one', () => {
    expect(payloadOf('Here:\n```excel\n=SUM(A1:A3)\n```\nIt adds.')).toBe('=SUM(A1:A3)');
    expect(payloadOf('  Just text.  ')).toBe('Just text.');
  });
  it('turns Markdown into letter HTML and plain text', () => {
    expect(markdownToHtml('# Title\n\nSome **bold** text.\n\n- a\n- b')).toBe('<h1>Title</h1><p>Some <strong>bold</strong> text.</p><ul><li><p>a</p></li><li><p>b</p></li></ul>');
    expect(plainText('**A** and `b`\n\n1. one')).toBe('A and b\n\n1. one');
    expect(markdownToHtml('<b>x</b>')).toBe('<p>&lt;b&gt;x&lt;/b&gt;</p>');
  });
  it('reads a table from a Markdown answer for the sheet', () => {
    expect(gridOf('Cleaned:\n\n| Name | Age |\n|---|---:|\n| Ana | 31 |\n| Bo | 4.5 |')).toEqual([['Name', 'Age'], ['Ana', '31'], ['Bo', '4.5']]);
    expect(gridOf('a\tb\nc\td')).toEqual([['a', 'b'], ['c', 'd']]);
  });
});
