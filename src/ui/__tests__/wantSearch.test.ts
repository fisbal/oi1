import { describe, expect, it } from 'vitest';
import { confident, pickSteps, searchControls, type Control } from '../want/search';

const c = (tab: string, tabIndex: number, group: string, name: string, extra: Partial<Control> = {}): Control => ({ tab, tabIndex, group, name, ...extra });
const RIBBON: Control[] = [
  c('Home', 0, 'Font', 'Bold'), c('Home', 0, 'Font', 'Italic'), c('Home', 0, 'Font', 'Underline'), c('Home', 0, 'Font', 'Font size'),
  c('Home', 0, 'Editing', 'AutoSum'), c('Home', 0, 'Editing', 'Sort A to Z'),
  c('Insert', 1, 'Tables', 'Insert table'), c('Insert', 1, 'Quick blocks', 'Table of contents'), c('Insert', 1, 'Illustrations', 'Insert image'),
  c('Transitions', 2, 'Transition to this slide', 'None', { active: true }), c('Transitions', 2, 'Transition to this slide', 'Fade'),
  c('Transitions', 2, 'Transition to this slide', 'Push'), c('Transitions', 2, 'Timing', 'Speed'),
];
const top = (q: string) => searchControls(RIBBON, q, 'fr')[0]?.c.name;

describe('"I want…" search', () => {
  it('finds a button from French words', () => {
    expect(top('mettre en gras')).toBe('Bold');
    expect(top('je veux un tableau')).toBe('Insert table');
    expect(top('faire la somme')).toBe('AutoSum');
    expect(top('table des matières')).toBe('Table of contents');
    expect(top('trier du plus petit au plus grand')).toBe('Sort A to Z');
  });
  it('accepts a spelling mistake', () => expect(top('itallique')).toBe('Italic'));
  it('makes one step per part of the request', () => {
    expect(pickSteps(searchControls(RIBBON, 'gras et italique', 'fr')).map(x => x.name)).toEqual(['Bold', 'Italic']);
  });
  it('shows a choice, not the one already on, and not every alternative', () => {
    expect(pickSteps(searchControls(RIBBON, 'ajouter une transition', 'fr')).map(x => x.name)).toEqual(['Fade']);
  });
  it('finds nothing for nonsense', () => {
    const hits = searchControls(RIBBON, 'zqxjvw', 'fr');
    expect(hits).toEqual([]);
    expect(confident(hits)).toBe(false);
  });
});
