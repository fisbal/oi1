import { describe, expect, it } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/core';
import { letterExtensions } from '../setup';
import { analyze } from '../analysis';
import { TOC_MARK, WORK_LAYOUTS, workMargins, workStyles } from '../templates/works';
import { parseStops } from '../tabStops';
import { applyNormContent, normCheck } from '../normCheck';
import { defaultStyles } from '../model';
import { defaultPage } from '../page';
import { citeFamily, modelDoc, OFFICIAL_EXAMPLES } from '../templates/models';

const textOf = (n: JSONContent): string => (n.text ?? '') + (n.content ?? []).map(textOf).join('');

// Martin (2026-11-03): each norm has an exemplary work "où tu n'auras rien à dire".
describe('the exemplary work of every norm', () => {
  for (const lang of ['fr', 'en'] as const) {
    it.each(WORK_LAYOUTS.map(w => [w.id, w]))(`%s (${lang}): Analyse et correction has nothing to say`, (_id, w) => {
      const content = modelDoc(w, lang, lang === 'fr' ? '3 novembre 2026' : 'November 3, 2026');
      const all = content.map(textOf).join('\n');
      expect(all).not.toMatch(/\[(?!\d+\])[^\]]*\]|Votre texte|Your text/);
      const ed = new Editor({ extensions: letterExtensions('body'), content: { type: 'doc', content } });
      const found = analyze(ed.state.doc, { lang, cite: citeFamily(w) });
      expect(found.map(f => `${f.key} ${JSON.stringify(f.vars ?? {})} ${f.excerpt ?? ''}`)).toEqual([]);
      // The page and the styles of the norm, the page number where it goes: the norm check finds nothing either.
      const page = { ...defaultPage(), size: w.size, margins: workMargins(w) };
      const styles = workStyles(defaultStyles(), w);
      const pn: JSONContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'pageNumber', attrs: { kind: 'page' } }] }] };
      const norm = normCheck({ w, page, styles, tops: content, header: pn, footer: null, lang });
      expect(norm.map(f => `${f.key} ${JSON.stringify(f.vars ?? {})}`)).toEqual([]);
      // "Appliquer la norme" changes no word.
      expect(applyNormContent(content, w).map(textOf).join('\n')).toBe(all);
      ed.destroy();
    });
  }
  it('links to the official examples with https', () => {
    for (const [id, url] of Object.entries(OFFICIAL_EXAMPLES)) {
      expect(WORK_LAYOUTS.some(w => w.id === id)).toBe(true);
      expect(url).toMatch(/^https:\/\//);
    }
  });
});

describe('the table of contents of the exemplary works', () => {
  it('comes right under its title, with no text in between', () => {
    for (const w of WORK_LAYOUTS) for (const lang of ['fr', 'en'] as const) {
      const doc = modelDoc(w, lang, '4 novembre 2026');
      const text = (n: JSONContent): string => n.text ?? (n.content ?? []).map(text).join('');
      const at = doc.findIndex(n => text(n) === TOC_MARK);
      if (at >= 0) expect(doc[at - 1].type, `${w.id} ${lang}`).toBe('heading');
    }
  });
});

describe('tab stops with dot leaders', () => {
  it('reads "r468*" as a right stop with dots, and keeps it through .docx', async () => {
    expect(parseStops('l36,r468*')).toEqual([{ kind: 'l', pos: 36 }, { kind: 'r', pos: 468, dots: true }]);
    const { letterToDocx } = await import('../docx/write');
    const { readDocx } = await import('../docx/read');
    const body = { type: 'doc', content: [{ type: 'paragraph', attrs: { tabStops: 'r468*' }, content: [{ type: 'text', text: 'Introduction\t3' }] }] };
    const back = await readDocx(await letterToDocx({ body, header: null, footer: null, page: defaultPage(), styles: defaultStyles() } as never, 'Toc'));
    expect(JSON.stringify(back.body)).toContain('r468*');
  });
});
