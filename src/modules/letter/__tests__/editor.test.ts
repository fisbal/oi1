import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import { Node as PMNode } from '@tiptap/pm/model';
import { computeSpacers } from '../pagination';
import { findMatches } from '../search';
import { letterExtensions, migrate } from '../setup';

const layout = { enabled: true, pageHeight: 1000, marginTop: 100, marginBottom: 100, gap: 20, headerHtml: '', footerHtml: '', version: 0 };
const block = (pos: number, top: number, height: number, isBreak = false) => ({ pos, top, height, marginTop: 0, marginBottom: 0, isBreak });

describe('pagination', () => {
  it('moves a block that would cross the bottom margin to the next page', () => {
    // 800 px of text fit on a page: the third block ends at 900 and goes to page 2.
    const { spacers, result } = computeSpacers([block(0, 0, 400), block(10, 400, 300), block(20, 700, 200)], layout);
    expect(spacers).toEqual([{ pos: 20, foot: 200, page: 1, notes: [] }]); // 100 left on the page + 100 bottom margin
    expect(result.pages).toBe(2);
    expect(result.tail).toBe(800 - 200 + 100);
  });

  it('starts a new page after a page break', () => {
    const { spacers, result } = computeSpacers([block(0, 0, 100), block(5, 100, 0, true), block(6, 100, 50)], layout);
    expect(spacers.map(s => s.pos)).toEqual([6]);
    expect(result.pages).toBe(2);
  });

  it('keeps room for footnotes at the bottom of their page', () => {
    const note = (n: number, h: number) => ({ n, text: `note ${n}`, h });
    // Without notes the second block fits (ends at 750); its 60 px note and the line above it do not.
    const { spacers, result } = computeSpacers([
      { ...block(0, 0, 400), notes: [note(1, 20)] },
      { ...block(10, 400, 350), notes: [note(2, 60)] },
      block(20, 750, 50),
    ], layout);
    expect(spacers).toEqual([{ pos: 10, foot: 500, page: 1, notes: [{ n: 1, text: 'note 1' }] }]);
    expect(result.notes).toEqual([{ n: 2, text: 'note 2' }]);
    expect(result.pages).toBe(2);
  });

  it('lets a block taller than a page run on without a spacer before it', () => {
    const { spacers, result } = computeSpacers([block(0, 0, 2000)], layout);
    expect(spacers).toEqual([]);
    expect(result.pages).toBe(3);
  });
});

describe('find', () => {
  const schema = getSchema(letterExtensions('body'));
  const doc = PMNode.fromJSON(schema, {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'wor', marks: [{ type: 'bold' }] }, { type: 'text', text: 'ld, hello!' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Say HELLO' }] },
    ],
  });

  it('finds text across formatting, ignoring case unless asked', () => {
    expect(findMatches(doc, 'hello', false)).toHaveLength(3);
    expect(findMatches(doc, 'Hello', true)).toHaveLength(1);
    const [world] = findMatches(doc, 'world', false);
    expect(doc.textBetween(world.from, world.to)).toBe('world');
  });
});

describe('older letters', () => {
  it('puts images that stood alone into a paragraph', () => {
    const out = migrate({ type: 'doc', content: [{ type: 'image', attrs: { src: 'x' } }, { type: 'paragraph' }] });
    expect(out?.content?.[0]).toEqual({ type: 'paragraph', content: [{ type: 'image', attrs: { src: 'x' } }] });
  });
});

describe('track changes', () => {
  it('turns edits into suggestions at the cursor, then accepts them', async () => {
    const { Editor } = await import('@tiptap/core');
    const { listChanges, resolveChange, setTracking } = await import('../review');
    const editor = new Editor({ extensions: letterExtensions('body'), content: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'The price is ' }, { type: 'text', text: 'fixed', marks: [{ type: 'comment', attrs: { id: 'c1' } }] }, { type: 'text', text: '. We accept the offer.' }] },
    ] } });
    setTracking(editor, true);
    const end = editor.state.doc.content.size - 1;
    editor.commands.setTextSelection(end);
    for (let i = 0; i < 6; i++) { const { from } = editor.state.selection; editor.view.dispatch(editor.state.tr.delete(from - 1, from)); }
    editor.commands.insertContent('proposal.');
    const changes = listChanges(editor.state.doc);
    expect(changes.map(c => [c.kind, c.text])).toEqual([['deletion', 'offer.'], ['insertion', 'proposal.']]);
    expect(editor.getText()).toContain('offer.proposal.'); // nothing is gone until it is accepted
    resolveChange(editor, true);
    expect(editor.getText()).toBe('The price is fixed. We accept the proposal.');
    expect(listChanges(editor.state.doc)).toEqual([]);
    editor.destroy();
  });
});
