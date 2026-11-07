// "Analyse et correction" on a work shaped like Martin's (2026-11-07, his file stays private): a whole paragraph set as
// a "Titre 2" (so bold), an empty title, fields written over that kept their yellow, a numbered sub-part ending with a
// period ("3.5 … des employés."), bold citations in the running text. Each one is a remark with its fix; nothing changes
// before the person clicks Corriger, and no word ever changes.
import { describe, expect, it } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/core';
import { letterExtensions } from '../setup';
import { analyze, applyEdits, bodyBold, oldToc, filledFields, fixBodyBold, fixFieldColor, fixHeadings, fixStructure, headingsNotTitles } from '../analysis';
import { FIELD_COLOR } from '../templates/markup';
import { knownTitle } from '../templates/works';

// jsdom measures nothing: tab stops ask a Range for its size.
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) }) as DOMRect;

const yellow = { type: 'highlight', attrs: { color: FIELD_COLOR } };
const t = (text: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', ...(content.length ? { content } : {}) });
const h = (level: number, ...content: JSONContent[]): JSONContent => ({ type: 'heading', attrs: { level }, ...(content.length ? { content } : {}) });
const body = 'Le problème principal de cette entreprise est un conflit entre deux employées qui dure depuis des semaines. Il nuit au service et à toute l\'équipe, qui a dû intervenir. Ce conflit demande donc une action rapide de la gestionnaire.';
const text = 'Une gestionnaire voit une employée comme une future cadre sans lui demander ses objectifs. Ses jugements viennent de ses propres aspirations.';

const work: JSONContent[] = [
  p(t('Prénom Nom', [yellow])), p(t('Travail noté 2', [{ type: 'bold' }, yellow])), p(t('Université')),
  { type: 'pageBreak' },
  h(1, t('Étape 1 : Résumé des faits')), p(t(body)),
  h(1, t('Étape 2 : Identification du problème')),
  h(2, t(body, [{ type: 'bold' }])),
  h(1, t('Étape 3 : Analyse des causes du problème')), p(t(body)),
  h(2, t('3.1 Première cause : les biais perceptuels')),
  p(t(text), t(' (Auteur et al., 2010, p. 75)', [{ type: 'bold' }]), t(' Cela nuit à ses décisions.')),
  h(2),
  p(t('3.2 Mauvaise communication entre les deux employées', [yellow])),
  p(t('3.3 Les difficultés d\'intégration dans le groupe', [yellow])),
  p(t('3.4 Le manque d\'encadrement', [yellow])),
  p(t('3.5 ', [yellow]), t('L\'absence de normes claires concernant les comportements attendus des employés.')),
  h(1, t('Étape 4 : L\'inventaire des solutions')), p(t('[Votre texte]', [yellow])),
  h(1, t('Références')), p(t('AUTEUR, A. (2010). Comportement organisationnel. Montréal : Éditeur.')),
];
const editor = () => new Editor({ extensions: letterExtensions('body'), content: { type: 'doc', content: work } });
const txt = (n: JSONContent) => (n.content ?? []).map(c => c.text ?? '').join('');
const words = (e: Editor) => e.state.doc.textContent.replace(/\s+/g, ' ').trim();

describe('analysis of a work shaped like Martin\'s', () => {
  it('lists each problem as a remark and changes nothing by itself', () => {
    const e = editor(), before = JSON.stringify(e.getJSON());
    const keys = analyze(e.state.doc, { lang: 'fr', known: knownTitle, work: true }).map(f => f.key);
    expect(keys).toEqual(expect.arrayContaining(['ana.s.fieldColor', 'ana.s.longHeading', 'ana.s.bodyBold', 'ana.fields', 'ana.titles']));
    expect(JSON.stringify(e.getJSON())).toBe(before);
  });
  it('a paragraph set as a title goes back to normal text, not bold; the empty title goes; words unchanged', () => {
    const e = editor(), was = words(e);
    expect(headingsNotTitles(e.state.doc).length).toBe(2);
    fixHeadings(e);
    const para = (e.getJSON().content as JSONContent[]).find(n => txt(n).startsWith('Le problème principal'))!;
    expect(para.type).toBe('paragraph');
    expect(para.content!.some(c => c.marks?.some(m => m.type === 'bold'))).toBe(false);
    expect(headingsNotTitles(e.state.doc)).toEqual([]);
    expect(words(e)).toBe(was);
  });
  it('filled fields lose their yellow, the field still to fill keeps it', () => {
    const e = editor(), was = words(e);
    expect(filledFields(e.state.doc).map(f => f.text)).toContain('3.2 Mauvaise communication entre les deux employées');
    fixFieldColor(e);
    expect(filledFields(e.state.doc)).toEqual([]);
    expect(JSON.stringify(e.getJSON())).toContain('[Votre texte]');
    expect(analyze(e.state.doc, { lang: 'fr', known: knownTitle }).find(f => f.key === 'ana.fields')?.vars?.n).toBe(1);
    expect(words(e)).toBe(was);
  });
  it('3.2 to 3.5 all become level-2 titles, the one ending with a period too', () => {
    const e = editor();
    fixStructure(e, 'fr', knownTitle);
    const heads = (e.getJSON().content as JSONContent[]).filter(n => n.type === 'heading' && /^3\.\d/.test(txt(n)));
    expect(heads.map(n => n.attrs?.level)).toEqual([2, 2, 2, 2, 2]);
  });
  it('bold goes from the running text only (titles, cover and references keep theirs)', () => {
    const e = editor(), was = words(e);
    expect(bodyBold(e.state.doc, 'fr', knownTitle).map(b => b.text.trim())).toEqual(['(Auteur et al., 2010, p. 75)']);
    fixBodyBold(e, 'fr', knownTitle);
    expect(bodyBold(e.state.doc, 'fr', knownTitle)).toEqual([]);
    expect(JSON.stringify(e.getJSON().content![1])).toContain('bold');
    expect(words(e)).toBe(was);
  });
  it('words typed in a field do not take its yellow', () => {
    const e = editor();
    let at = 0;
    e.state.doc.descendants((n, pos) => { if (n.isText && n.text === '[Votre texte]') at = pos; });
    e.chain().setTextSelection(at + 1 + '[Votre texte]'.length - 1).run();
    e.commands.insertContent('x');
    e.view.dispatch(e.state.tr.insertText('Mon analyse', at + 1));
    const typed: { text: string; yellow: boolean }[] = [];
    e.state.doc.descendants(n => { if (n.isText && (n.text === 'Mon analyse' || n.text === 'x')) typed.push({ text: n.text, yellow: n.marks.some(m => m.attrs.color === FIELD_COLOR) }); });
    expect(typed).toEqual([{ text: 'Mon analyse', yellow: false }, { text: 'x', yellow: false }]);
  });
});

describe('the language fixes', () => {
  it('a double space is fixed once and never strikes out the next letter ("objectifs.  De plus")', () => {
    const e = new Editor({ extensions: letterExtensions('body'), content: { type: 'doc', content: [p(t('Elle a les mêmes objectifs.  De plus, elle part. Il dit que que oui.'))] } });
    for (const key of ['ana.double', 'ana.repeat']) {
      const f = analyze(e.state.doc, { lang: 'fr' }).find(x => x.key === key);
      if (f?.edits) { expect(new Set(f.edits.map(x => `${x.from}:${x.to}`)).size).toBe(f.edits.length); applyEdits(e, f.edits); }
    }
    const kept: string[] = [];
    e.state.doc.descendants(n => { if (n.isText && !n.marks.some(m => m.type.name === 'deletion')) kept.push(n.text!); });
    expect(kept.join('')).toContain('objectifs. De plus');
  });
});

describe('an old table of contents', () => {
  it('is found when its lines no longer match the titles', () => {
    const toc = (s: string): JSONContent => ({ type: 'paragraph', attrs: { tabStops: 'r468*' }, content: [{ type: 'text', text: s }] });
    const doc: JSONContent[] = [
      h(1, t('Table des matières')), toc('Étape 1 : Résumé des faits\t3-4'), toc('3.1 [Sous-partie]\t4'), p(t('3.2 ')), p(t('3.3')),
      { type: 'pageBreak' },
      h(1, t('Étape 1 : Résumé des faits')), p(t(body)), h(2, t('3.1 Première cause : les biais')), p(t(text)),
    ];
    const e = new Editor({ extensions: letterExtensions('body'), content: { type: 'doc', content: doc } });
    const old = oldToc(e.state.doc);
    expect(old?.lines.length).toBe(4);
    expect(old?.stale).toContain('3.1 [Sous-partie]');
    expect(analyze(e.state.doc, { lang: 'fr' }).some(f => f.key === 'ana.s.oldToc')).toBe(true);
  });
});
