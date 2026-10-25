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
    expect(spacers).toEqual([{ pos: 20, foot: 200, page: 1 }]); // 100 left on the page + 100 bottom margin
    expect(result.pages).toBe(2);
    expect(result.tail).toBe(800 - 200 + 100);
  });

  it('starts a new page after a page break', () => {
    const { spacers, result } = computeSpacers([block(0, 0, 100), block(5, 100, 0, true), block(6, 100, 50)], layout);
    expect(spacers.map(s => s.pos)).toEqual([6]);
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
