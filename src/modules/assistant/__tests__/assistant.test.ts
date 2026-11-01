import { describe, expect, it } from 'vitest';
import { jsonOf, planFrom, readySteps, safePath, square, TABLE_MARK } from '../plan';
import { linesHtml, matchRecipe, recipePlan, RECIPES } from '../recipes';
import { computedTable, linkedTableHtml, placeTableInHtml } from '../run';

describe('plans from the AI', () => {
  it('keeps known apps, checks links and squares tables', () => {
    const p = planFrom({
      title: 'Bank', summary: 'Budget and letter',
      steps: [
        { app: 'class', name: 'Budget', purpose: '', html: '', rows: [['A', 'B'], ['1']], files: [], table: -1, from: -1 },
        { app: 'letter', name: 'Letter', purpose: '', html: '<p>Hi</p>', rows: [], files: [], table: 0, from: -1 },
        { app: 'pdf', name: 'PDF', purpose: '', html: '', rows: [], files: [], table: -1, from: 1 },
        { app: 'virus', name: 'x' },
        { app: 'stage', name: 'Deck', purpose: '', html: '<h2>a</h2>', rows: [], files: [], table: 1, from: -1 },
      ],
    });
    expect(p.steps.map(s => s.app)).toEqual(['class', 'letter', 'pdf', 'stage']);
    expect(p.steps[0].rows).toEqual([['A', 'B'], ['1', '']]);
    expect(p.steps[1].table).toBe(p.steps[0].id);
    expect(p.steps[2].from).toBe(p.steps[1].id);
    expect(p.steps[3].table).toBeNull(); // step 1 is a letter, not a Class table
    expect(readySteps(p)).toHaveLength(4);
  });
  it('reads JSON inside words or a fence', () => {
    expect(jsonOf('Here:\n```json\n{"title":"x","steps":[]}\n```')).toEqual({ title: 'x', steps: [] });
    expect(() => jsonOf('no json')).toThrow();
  });
  it('makes file paths safe', () => {
    expect(safePath('../../etc/passwd')).toBe('etc/passwd');
    expect(safePath('/src\\app.js')).toBe('src/app.js');
    expect(square([['a'], ['b', 'c'], ['', '']])).toEqual([['a', ''], ['b', 'c']]);
  });
});

describe('recipes', () => {
  it('has at least 24 tasks, each ready to make in English and French', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(24);
    for (const r of RECIPES) for (const lang of ['en', 'fr'] as const) {
      const p = recipePlan(r, lang, r.id);
      expect(readySteps(p).length, `${r.id} ${lang}`).toBe(p.steps.length);
      for (const s of p.steps) {
        if (s.app === 'class') expect(new Set(s.rows.map(x => x.length)).size, `${r.id} rows`).toBe(1);
        if (s.html.includes(TABLE_MARK)) expect(s.table, `${r.id} table`).not.toBeNull();
      }
    }
  });
  it('finds the task from plain words', () => {
    expect(matchRecipe('fais-moi un budget et un courrier pour la banque')?.id).toBe('bankBudget');
    expect(matchRecipe('I need an invoice for my client')?.id).toBe('invoice');
    expect(matchRecipe('Ich brauche einen Lebenslauf')?.id).toBe('cvLetter');
    expect(matchRecipe('zzz qqq')).toBeNull();
  });
  it('writes lines as HTML', () => {
    expect(linesHtml(['## T', 'p', '- a', '- b', 'q'])).toBe('<h2>T</h2><p>p</p><ul><li>a</li><li>b</li></ul><p>q</p>');
  });
});

describe('making the documents', () => {
  it('computes the formulas for the letter', async () => {
    const t = await computedTable([['Item', 'Amount'], ['A', '10'], ['B', '5'], ['Total', '=SUM(B2:B3)']]);
    expect(t.header).toBe(true);
    expect(t.rows[3][1].formula).toBe('=SUM(B2:B3)');
    expect(t.rows[3][1].text).toBe('15');
  });
  it('every recipe table computes without errors', async () => {
    for (const r of RECIPES) for (const lang of ['en', 'fr'] as const) for (const s of recipePlan(r, lang, r.id).steps) {
      if (s.app !== 'class') continue;
      const t = await computedTable(s.rows);
      for (const row of t.rows) for (const c of row) if (c.formula) expect(c.text, `${r.id} ${lang} ${c.formula}`).toMatch(/^[^#]*[\p{L}\d]/u);
    }
  });
  it('puts the linked table where the letter marks it', () => {
    const table = linkedTableHtml({ header: true, rows: [[{ text: 'A' }], [{ text: '<b>' }]] }, 'lp_1');
    expect(table).toBe('<table data-link="lp_1"><tr><th>A</th></tr><tr><td>&lt;b&gt;</td></tr></table>');
    expect(placeTableInHtml(`<p>Hi</p><p>${TABLE_MARK}</p><p>Bye</p>`, '<table></table>')).toBe('<p>Hi</p><table></table><p>Bye</p>');
    expect(placeTableInHtml('<p>Hi</p><p>Bye</p>', '<table></table>')).toBe('<p>Hi</p><table></table><p>Bye</p>');
  });
});
