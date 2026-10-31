import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { LiveStore, fingerprint, readContent, writeContent, type LiveContent } from '../live';

const table = (rows: string[][], title = 'Sales'): LiveContent => ({ kind: 'table', title, table: { header: true, rows: rows.map(r => r.map(text => ({ text }))) } });
const wait = (ms = 30) => new Promise(r => setTimeout(r, ms));

describe('Live parts', () => {
  it('gives equal fingerprints to equal contents only', () => {
    expect(fingerprint(table([['a', 'b']]))).toBe(fingerprint(table([['a', 'b']])));
    expect(fingerprint(table([['a', 'b']]))).not.toBe(fingerprint(table([['a', 'c']])));
  });

  it('merges two changes made at the same time in two places, the same way in both', () => {
    const a = new Y.Doc(), b = new Y.Doc();
    writeContent(a, table([['Item', 'Price'], ['Pen', '2'], ['Book', '9']]));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    // Offline: Letter changes a price, Class changes another one.
    writeContent(a, table([['Item', 'Price'], ['Pen', '3'], ['Book', '9']]));
    writeContent(b, table([['Item', 'Price'], ['Pen', '2'], ['Book', '12']]));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(readContent(a)).toEqual(readContent(b));
    expect(readContent(a).table!.rows.map(r => r.map(c => c.text))).toEqual([['Item', 'Price'], ['Pen', '3'], ['Book', '12']]);
  });

  it('passes a change to another window at once, and reports each copy as synced or different', async () => {
    const one = new LiveStore({ persist: false }), two = new LiveStore({ persist: false });
    const id = await one.create(table([['A', '1']]), 'class', 'class');
    const seen: LiveContent[] = [];
    two.watch(id, c => seen.push(c));
    await wait();
    expect(fingerprint(await two.read(id))).toBe(fingerprint(table([['A', '1']])));
    await two.write(id, table([['A', '5']]));
    await wait();
    expect((await one.read(id)).table!.rows[0][1].text).toBe('5');
    expect(await one.check(id, fingerprint(table([['A', '5']])))).toBe('synced');
    expect(await one.check(id, fingerprint(table([['A', '1']])))).toBe('different');
    expect(seen.length).toBeGreaterThan(0);
  });

  it('keeps a text part', async () => {
    const s = new LiveStore({ persist: false, channel: false });
    const id = await s.create({ kind: 'text', title: 'Intro', text: 'Hello' }, 'letter');
    await s.write(id, { kind: 'text', title: 'Intro', text: 'Hello world' });
    expect((await s.read(id)).text).toBe('Hello world');
  });
});
