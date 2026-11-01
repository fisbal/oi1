// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { cleanLibrary, flashcards, newLibrary, newPage, search, tagSummary, titleOf, updatePage, where, PAPERS, TAGS, COLORS, ICONS, PAGE_COLORS } from '../model';
import { NOTE_TEMPLATES } from '../templates';
import { answerHtml } from '../Notes';

describe('In 1 Notes model', () => {
  it('has 20+ choices in every list', () => {
    for (const list of [PAPERS, TAGS, COLORS, ICONS, PAGE_COLORS, NOTE_TEMPLATES]) expect(list.length).toBeGreaterThanOrEqual(20);
  });
  it('starts with one notebook, one section and one page', () => {
    const lib = newLibrary('Mine', 'Quick');
    const { nb, sec, page } = where(lib);
    expect(nb.name).toBe('Mine');
    expect(sec.name).toBe('Quick');
    expect(page.html).toBe('<p></p>');
  });
  it('cleans what it reads back: scripts go, bad fields are fixed, the open page exists', () => {
    const raw = { notebooks: [{ id: 'b1', name: 'School', color: 'red', icon: '💀', sections: [{ id: 's1', name: 'Maths', pages: [
      { id: 'p1', title: 'Fractions', html: '<p>one half</p><script>alert(1)</script><img src=x onerror="alert(1)">', paper: 'nope' },
    ] }] }], at: { nb: 'b1', sec: 's1', page: 'gone' } };
    const lib = cleanLibrary(raw, 'x', 'y');
    const { nb, page } = where(lib);
    expect(nb.color).toMatch(/^#/);
    expect(nb.icon).toBe(ICONS[0]);
    expect(page.id).toBe('p1');
    expect(page.paper).toBe('plain');
    expect(page.html).not.toMatch(/script|onerror/);
    expect(cleanLibrary('garbage', 'A', 'B').notebooks[0].name).toBe('A');
  });
  it('finds pages by words, accents and capitals ignored, title first', () => {
    let lib = newLibrary('N', 'S');
    const id = where(lib).page.id;
    lib = updatePage(lib, id, { title: 'Réunion budget', html: '<p>Parler du café</p>' });
    expect(search(lib, 'reunion CAFE').length).toBe(1);
    expect(search(lib, 'budget')[0].score).toBeGreaterThanOrEqual(5);
    expect(search(lib, 'absent').length).toBe(0);
    expect(titleOf({ ...newPage('', '<p>First line</p><p>Second</p>') }, 'Untitled')).toBe('First line');
  });
  it('lists tagged lines and open to-dos', () => {
    let lib = newLibrary('N', 'S');
    lib = updatePage(lib, where(lib).page.id, { html: '<p>⭐ Big exam</p><p>plain</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Buy milk</p></li><li data-type="taskItem" data-checked="true"><p>Done one</p></li></ul>' });
    const tags = tagSummary(lib);
    expect(tags.map(x => [x.tag, x.text])).toEqual([['todo', 'Buy milk'], ['important', 'Big exam']]);
  });
  it('makes flashcards from "q :: a" lines and question lines', () => {
    expect(flashcards('Capital of Italy :: Rome\nWhat is 2+2?\nFour\nnothing here')).toEqual([{ q: 'Capital of Italy', a: 'Rome' }, { q: 'What is 2+2?', a: 'Four' }]);
  });
  it('turns an AI to-do answer into real to-do boxes', () => {
    expect(answerHtml('- [ ] Call Ana\n- [x] Send <b>report</b>')).toBe('<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Call Ana</p></li><li data-type="taskItem" data-checked="true"><p>Send &lt;b&gt;report&lt;/b&gt;</p></li></ul>');
    expect(answerHtml('**Hi**')).toContain('<strong>Hi</strong>');
  });
  it('builds every template in English and French', () => {
    for (const tpl of NOTE_TEMPLATES) for (const i of [0, 1]) {
      const { title, html } = tpl.build(w => w[i], '1/11/2026');
      expect(title.length).toBeGreaterThan(1);
      expect(html.length).toBeGreaterThan(10);
    }
  });
});
