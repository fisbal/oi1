import { describe, expect, it } from 'vitest';
import { cleanForm, decodeReplies, encodeReply, formKey, newForm, newQuestion, order, problems, repliesCsv, score, summarize } from '../model';
import { formFromAnswer } from '../ai';
import { shareHtml } from '../share';
import { THEMES } from '../templates';

const sample = () => {
  const f = newForm('Test');
  const a = newQuestion('choice', 'Colour?', ['Red', 'Blue']); a.required = true; a.correct = ['Blue'];
  const b = newQuestion('email', 'Mail');
  const c = newQuestion('nps', 'Recommend?');
  const d = newQuestion('checks', 'Pets', ['Cat', 'Dog', 'Fish']); d.correct = ['Cat', 'Dog'];
  f.questions = [a, b, c, d];
  return f;
};

describe('In 1 Form model', () => {
  it('checks required answers and formats', () => {
    const f = sample();
    const [a, b] = f.questions;
    expect(problems(f, {})).toEqual({ [a.id]: 'required' });
    expect(problems(f, { [a.id]: 'Red', [b.id]: 'not-mail' })).toEqual({ [b.id]: 'email' });
    expect(problems(f, { [a.id]: 'Red', [b.id]: 'a@b.fr' })).toEqual({});
  });
  it('scores a quiz', () => {
    const f = sample();
    const [a, , , d] = f.questions;
    expect(score(f, { [a.id]: 'Blue', [d.id]: ['Dog', 'Cat'] })).toEqual([2, 2]);
    expect(score(f, { [a.id]: 'Red', [d.id]: ['Cat'] })).toEqual([0, 2]);
  });
  it('summarises choices and NPS', () => {
    const f = sample();
    const [a, , c] = f.questions;
    f.replies = [10, 9, 3, 7].map((n, i) => ({ id: `r${i}`, at: '2026-11-01T10:00:00Z', answers: { [a.id]: i % 2 ? 'Red' : 'Blue', [c.id]: n } }));
    expect(summarize(f, a).counts).toEqual([['Red', 2], ['Blue', 2]]);
    const s = summarize(f, c);
    expect(s.nps).toBe(25);
    expect(s.average).toBe(7.3);
  });
  it('round-trips answer codes and ignores other forms', () => {
    const f = sample();
    const key = formKey(f);
    const code = encodeReply(key, { x: 'Élan', y: ['1', '2'] });
    const got = decodeReplies(`Hello\n${code}\nbye ${encodeReply('other', { x: '1' })}`, key);
    expect(got.replies).toHaveLength(1);
    expect(got.replies[0].answers).toEqual({ x: 'Élan', y: ['1', '2'] });
    expect(got.other).toBe(1);
  });
  it('neutralises formulas in CSV', () => {
    const f = sample();
    f.replies = [{ id: 'r', at: '2026-11-01T10:00:00Z', answers: { [f.questions[1].id]: '=HYPERLINK("x")' } }];
    expect(repliesCsv(f, 'Date')).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it('keeps sections in place when shuffling', () => {
    const f = sample();
    const s = newQuestion('section', 'Part 2');
    f.questions.splice(2, 0, s);
    f.shuffle = true;
    expect(order(f, 7)[2].id).toBe(s.id);
  });
  it('cleans unknown input', () => {
    const f = cleanForm({ questions: [{ type: 'bogus', title: 'Q' }, null, { type: 'matrix', title: 'M' }], replies: 'x' }, 'T');
    expect(f.questions.map(q => q.type)).toEqual(['short', 'matrix']);
    expect(f.questions[1].rows.length).toBeGreaterThan(0);
    expect(f.replies).toEqual([]);
  });
  it('reads an AI answer as JSON or plain lines', () => {
    const j = formFromAnswer('```json\n{"title":"T","description":"","questions":[{"type":"choice","title":"A?","required":true,"options":["x","y"],"rows":[],"correct":["y"]}]}\n```');
    expect(j.questions[0].correct).toEqual(['y']);
    const l = formFromAnswer('1. Your age?\n2. Favourite fruit? (apple / pear / plum)');
    expect(l.questions.map(q => q.type)).toEqual(['short', 'choice']);
    expect(l.questions[1].options).toEqual(['apple', 'pear', 'plum']);
  });
  it('makes a shared file with no raw text from the form in the HTML', () => {
    const f = sample();
    f.title = '</script><img src=x onerror=alert(1)>';
    const html = shareHtml(f, THEMES[0], { send: 'Send', required: 'r', email: 'e', phone: 'p', url: 'u', number: 'n', rows: 'w', thanks: 't', code: 'c', copy: 'c', copied: 'c', mail: 'm', yes: 'y', no: 'n', other: 'o', agree: ['a', '1', '2', '3', '4', '5'], pick: 'p', score: 's', first: 'f', last: 'l', street: 's', city: 'c', zip: 'z', country: 'c', made: 'm' }, 'en');
    expect(html).not.toContain('</script><img');
    expect(html).toContain('&lt;/script&gt;');
  });
});
