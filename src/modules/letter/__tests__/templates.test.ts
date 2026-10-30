import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { letterExtensions } from '../setup';
import { CV_TEMPLATES } from '../templates/cv';
import { LETTERS, LETTER_CATS } from '../templates/letters';
import { FIELD_COLOR, fieldList, fieldsIn, fillFields, isEmptyDoc, markupToDoc, selectNextField } from '../templates/markup';
import { loadProfile, profileKeyOf, profileValues, rememberValues } from '../templates/profile';
import { THEMES } from '../themes';

const editorWith = (src: string) => new Editor({ extensions: letterExtensions('body'), content: { type: 'doc', content: markupToDoc(src, '30 octobre 2026') } });

afterEach(() => localStorage.clear());

describe('letter templates', () => {
  it('has more than 20 professional letters in every category, each in French and English', () => {
    expect(LETTERS.filter(l => l.cat !== 'perso').length).toBeGreaterThanOrEqual(20);
    for (const cat of LETTER_CATS) expect(LETTERS.some(l => l.cat === cat)).toBe(true);
    expect(new Set(LETTERS.map(l => l.id)).size).toBe(LETTERS.length);
    for (const l of LETTERS) {
      expect(l.fr.trim(), l.id).not.toBe('');
      expect(l.en.trim(), l.id).not.toBe('');
      expect(Object.keys(l.title).sort()).toEqual(['de', 'en', 'es', 'fr', 'pt']);
    }
  });

  it('has 20 CVs, each on a theme that exists', () => {
    expect(CV_TEMPLATES).toHaveLength(20);
    for (const c of CV_TEMPLATES) {
      expect(THEMES.some(th => th.id === c.theme), c.id).toBe(true);
      expect(c.fr).toMatch(/^# \[Prénom Nom\]/);
      expect(c.en).toMatch(/^# \[First and last name\]/);
    }
    // The bilingual CV titles each section in both languages.
    expect(CV_TEMPLATES.find(c => c.id === 'cvBilingual')!.fr).toContain('## Profil · Profile');
  });

  it('turns every template into a document the editor accepts', () => {
    for (const tpl of [...LETTERS, ...CV_TEMPLATES]) {
      for (const lang of ['fr', 'en'] as const) {
        const ed = editorWith(tpl[lang]);
        expect(ed.getText().length, `${tpl.id} ${lang}`).toBeGreaterThan(40);
        expect(ed.getText(), `${tpl.id} ${lang}`).not.toContain('{date}');
        ed.destroy();
      }
    }
  });
});

describe('template markup', () => {
  it('reads headings, bold, right-aligned, bullets and the signature line', () => {
    const doc = markupToDoc('# MEMO\n## 1. Situation\n! Subject: [subject]\n> {date}\n- one\n- two\n\n---\n[Name]', '30 October 2026');
    expect(doc.map(n => n.type)).toEqual(['heading', 'heading', 'paragraph', 'paragraph', 'bulletList', 'paragraph', 'paragraph']);
    expect(doc[0].attrs).toEqual({ level: 1 });
    expect(doc[2].content![0].marks).toEqual([{ type: 'bold' }]);
    expect(doc[2].content![1].marks).toEqual([{ type: 'bold' }, { type: 'highlight', attrs: { color: FIELD_COLOR } }]);
    expect(doc[3].attrs!.textAlign).toBe('right');
    expect(doc[3].content![0].text).toBe('30 October 2026');
    expect(doc[4].content).toHaveLength(2);
    expect(doc[6].attrs!.borders.top.w).toBe(0.75);
  });

  it('lists the fields once each and fills every copy of one', () => {
    const ed = editorWith('Dear [Name],\n\nThanks, [Name], for [reason].');
    expect(fieldList(ed.state.doc)).toEqual([{ label: 'Name', count: 2 }, { label: 'reason', count: 1 }]);
    expect(fillFields(ed, { Name: 'Ana', reason: '  ' })).toBe(2);
    expect(ed.getText({ blockSeparator: '\n' })).toBe('Dear Ana,\n\nThanks, Ana, for [reason].');
    // Filled words lose the yellow; the field left keeps it.
    let yellow = '';
    ed.state.doc.descendants(n => { if (n.isText && n.marks.some(m => m.type.name === 'highlight')) yellow += n.text; });
    expect(yellow).toBe('[reason]');
    ed.destroy();
  });

  it('selects the next field after the cursor, then wraps around', () => {
    const ed = editorWith('[a] and [b]');
    const [a, b] = fieldsIn(ed.state.doc);
    expect(selectNextField(ed)).toBe(true);
    expect(ed.state.selection.from).toBe(a.from);
    selectNextField(ed);
    expect([ed.state.selection.from, ed.state.selection.to]).toEqual([b.from, b.to]);
    selectNextField(ed);
    expect(ed.state.selection.from).toBe(a.from);
    // What gets typed over a field is not yellow.
    const { from, to } = ed.state.selection;
    expect(ed.view.someProp('handleTextInput', f => f(ed.view, from, to, 'x', () => ed.state.tr))).toBe(true);
    expect(ed.state.doc.firstChild!.firstChild!.marks).toEqual([]);
    ed.destroy();
  });
});

describe('a new letter', () => {
  it('counts as empty with only its "Untitled letter" heading, so a template replaces it', () => {
    const ed = new Editor({ extensions: letterExtensions('body'), content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Lettre sans titre' }] }, { type: 'paragraph' }] } });
    expect(isEmptyDoc(ed)).toBe(true);
    ed.commands.insertContent(' and more');
    expect(isEmptyDoc(ed)).toBe(false);
    ed.destroy();
  });
});

describe('My info', () => {
  it('knows the same detail under its French and English names', () => {
    expect(profileKeyOf('Prénom Nom')).toBe('name');
    expect(profileKeyOf('first and last name')).toBe('name');
    expect(profileKeyOf('Grade')).toBe('rank');
    expect(profileKeyOf('reason')).toBeNull();
  });

  it('remembers filled details and fills them in the next letter, combined fields too', () => {
    rememberValues({ 'Prénom Nom': 'Martin B.', Grade: 'Sgt', reason: 'x' });
    expect(loadProfile()).toEqual({ name: 'Martin B.', rank: 'Sgt' });
    expect(profileValues(['First and last name', 'Rank Name', 'Phone'])).toEqual({ 'First and last name': 'Martin B.', 'Rank Name': 'Sgt Martin B.' });
  });
});
