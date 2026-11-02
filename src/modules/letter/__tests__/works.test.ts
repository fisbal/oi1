import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { readDocx } from '../docx/read';
import { letterToDocx } from '../docx/write';
import { defaultStyles, type LetterDoc } from '../model';
import { TOC_MARK, WORK_LAYOUTS, workDoc, workMargins, workStyles } from '../templates/works';

const textOf = (n: JSONContent): string => (n.text ?? '') + (n.content ?? []).map(textOf).join('');
const byId = (id: string) => WORK_LAYOUTS.find(w => w.id === id)!;

describe('work layouts (mises en page des travaux)', () => {
  it('has 30+ norms with unique ids and names in French and English', () => {
    expect(WORK_LAYOUTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(WORK_LAYOUTS.map(w => w.id)).size).toBe(WORK_LAYOUTS.length);
    for (const w of WORK_LAYOUTS) {
      expect(w.name.fr && w.name.en && w.hint.fr && w.hint.en).toBeTruthy();
      expect(w.m.every(x => x > 0.5 && x < 6)).toBe(true);
      expect(w.parts.length).toBeGreaterThan(0);
    }
  });

  it('APA-Provost: 2.5 cm margins, Times 12, double spacing, 5-space indent, centered level 1', () => {
    const w = byId('apaProvost');
    const m = workMargins(w);
    expect(m.top * 2.54).toBeCloseTo(2.5, 2);
    expect(m.left * 2.54).toBeCloseTo(2.5, 2);
    const st = workStyles(defaultStyles(), w);
    expect(st.normal.font).toMatch(/Times/);
    expect(st.normal.size).toBe(12);
    expect(st.normal.lineHeight).toBe(2);
    expect(st.normal.indent).toBe(36);
    expect(st.h1.align).toBe('center');
    expect(st.h1.color).toBe('#000000');
  });

  it('builds the parts in order with a title page, a TOC mark and yellow fields', () => {
    for (const lang of ['fr', 'en'] as const) {
      const doc = workDoc(byId('apaProvost'), lang, '2026-11-02');
      const heads = doc.filter(n => n.type === 'heading').map(textOf);
      const want = lang === 'fr' ? ['Introduction', 'Conclusion', 'Références'] : ['Introduction', 'Conclusion', 'References'];
      const at = want.map(h => heads.findIndex(x => x.includes(h)));
      expect(at.every((x, i) => x >= 0 && (i === 0 || x > at[i - 1]))).toBe(true);
      expect(doc.some(n => textOf(n) === TOC_MARK)).toBe(true);
      expect(doc.filter(n => n.type === 'pageBreak').length).toBeGreaterThanOrEqual(3);
      expect(JSON.stringify(doc)).toContain('"highlight"');
    }
  });

  it('every norm builds a document in both languages', () => {
    for (const w of WORK_LAYOUTS) for (const lang of ['fr', 'en'] as const) expect(workDoc(w, lang, '2026-11-02').length).toBeGreaterThan(2);
  });

  it('keeps the first-line indent through Word (.docx)', async () => {
    const styles = workStyles(defaultStyles(), byId('apa7'));
    const doc: LetterDoc = {
      page: { size: 'letter', orientation: 'portrait', margins: workMargins(byId('apa7')), headerDistance: 0.5, footerDistance: 0.5 },
      styles,
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bonjour.' }] }] },
    } as LetterDoc;
    const back = await readDocx(await letterToDocx(doc, 'Travail'));
    expect(back.styles.normal.indent).toBeCloseTo(36, 0);
  });
});
