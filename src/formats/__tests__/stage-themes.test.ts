import { describe, expect, it } from 'vitest';
import { readPptx, writePptx } from '../pptx';
import { GEOMS, THEMES, newDeck, newSlide, placeholder, retheme, type Deck, type DeckTheme } from '../slides';
import { DIAGRAMS, diagramItems, wordArtItem } from '../../modules/stage/build';
import { THEME_FONTS, themeFromSpec } from '../../modules/stage/mythemes';
import { slidesFromSpecs } from '../../modules/stage/copilot';
import { BUNDLED_FONTS } from '../../ui/fonts';

const bytes = (blob: Blob) => new Promise<ArrayBuffer>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as ArrayBuffer); fr.readAsArrayBuffer(blob); });
const roundTrip = async (d: Deck) => readPptx(await bytes(await writePptx(d, 'en-US', 'Test')));

const hex = /^#[0-9A-F]{6}$/i;
const lum = (c: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('In 1 Stage themes', () => {
  it('has 20 everyday-life and 5 military themes next to the classic ones', () => {
    expect(THEMES.filter(t => t.group === 'life')).toHaveLength(20);
    expect(THEMES.filter(t => t.group === 'military')).toHaveLength(5);
    expect(new Set(THEMES.map(t => t.id)).size).toBe(THEMES.length);
  });

  it('gives every theme valid colors, bundled fonts and readable text', () => {
    const fonts = new Set(BUNDLED_FONTS.map(f => f.name));
    for (const t of THEMES.filter(x => x.group)) {
      for (const c of [t.bg.color, t.title, t.text, ...t.accents, ...(t.deco ?? []).map(d => d.color)]) expect(c, `${t.id} ${c}`).toMatch(hex);
      expect(t.accents, t.id).toHaveLength(6);
      expect(fonts.has(t.head) && fonts.has(t.body), `${t.id} fonts`).toBe(true);
      // Text against the background, at both ends of a gradient (WCAG AA for large and body text).
      for (const bg of [t.bg.color, t.bg.to ?? t.bg.color]) {
        expect(contrast(t.text, bg), `${t.id} text`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.title, bg), `${t.id} title`).toBeGreaterThanOrEqual(3);
      }
      expect(t.dark, `${t.id} dark`).toBe(lum(t.bg.color) < 0.2);
      for (const d of t.deco ?? []) if (d.geom) expect(GEOMS).toContain(d.geom);
    }
  });

  it('saves each new theme in a .pptx and finds it again', async () => {
    for (const t of THEMES.filter(x => x.group)) {
      const back = await roundTrip(newDeck(t));
      expect(back.theme.id, t.id).toBe(t.id);
    }
  });

  it('keeps a Copilot theme, its fonts and its decorations through save and reopen', async () => {
    const theme = themeFromSpec({
      name: 'Hockey night', dark: true, background: '#0b1d33', background2: '#13294b', title: '#ffffff', text: '#e6eef5',
      accents: ['#c8102e', '#ffffff', '#9fc5e8', 'not a color', '#f2c14e', '#5b8db8'], headingFont: 'Oswald', bodyFont: 'Comic Sans',
      decorations: [
        { shape: 'star5', x: 0.85, y: 0.05, w: 0.08, h: 0.14, color: '#C8102E', opacity: 0.8, rotate: 15 },
        { shape: 'rect', x: 0, y: 0.96, w: 1, h: 0.04, color: '#FFFFFF', opacity: 0.5, rotate: 0 },
        { shape: 'skull', x: 9, y: -9, w: 0, h: 99, color: 'red', opacity: 7, rotate: 999 },
      ],
    });
    expect(theme.group).toBe('mine');
    expect(theme.accents[3]).toMatch(hex);
    expect([theme.head, theme.body]).toEqual(['Oswald', 'Open Sans']);
    expect(theme.deco?.[2]).toMatchObject({ x: 1.2, y: -0.3, opacity: 1, rot: 180 });
    expect(theme.deco?.[2].geom).toBeUndefined();

    const back = await roundTrip(newDeck(theme));
    expect(back.theme.name).toBe('Hockey night');
    expect([back.theme.head, back.theme.body]).toEqual(['Oswald', 'Open Sans']);
    const star = back.theme.deco?.[0];
    expect(star?.geom).toBe('star5');
    expect(star?.rot).toBe(15);
    expect(star?.opacity).toBeCloseTo(0.8, 2);
    expect(star?.x).toBeCloseTo(0.85, 2);
    expect(back.theme.decoItems ?? []).toHaveLength(0);
  });

  it('only offers fonts that are bundled with the app', () => {
    const names = new Set(BUNDLED_FONTS.map(f => f.name));
    expect(THEME_FONTS.length).toBeGreaterThan(20);
    for (const f of THEME_FONTS) expect(names.has(f)).toBe(true);
  });
});

describe('In 1 Stage diagrams', () => {
  const deck = newDeck(THEMES.find(t => t.id === 'navy') as DeckTheme);

  it('draws every kind of diagram inside the slide', () => {
    for (const kind of DIAGRAMS) {
      for (const n of [2, 4, 8]) {
        const items = diagramItems(kind, Array.from({ length: n }, (_, i) => `Point ${i + 1}`), deck);
        expect(items.length, kind).toBeGreaterThanOrEqual(3);
        for (const it of items) {
          expect(it.x, `${kind} ${n}`).toBeGreaterThanOrEqual(0);
          expect(it.y).toBeGreaterThanOrEqual(0);
          expect(it.x + it.w).toBeLessThanOrEqual(deck.w);
          expect(it.y + it.h).toBeLessThanOrEqual(deck.h);
        }
        const texts = items.filter(it => it.kind === 'shape' && /Point/.test(it.html));
        expect(texts.length, kind).toBe(kind === 'pyramid' ? Math.min(n, 6) : n);
      }
    }
  });

  it('saves a diagram and a WordArt title in a .pptx', async () => {
    const d = newDeck(deck.theme);
    const s = newSlide('titleOnly', d);
    s.items = [placeholder('titleOnly', 'title', d.w, d.h, '<p>Plan</p>'), ...diagramItems('process', ['Plan', 'Build', 'Test'], d), wordArtItem('stencil', 'Bravo', d)];
    d.slides = [s];
    const back = await roundTrip(d);
    const shapes = back.slides[0].items.filter(it => it.kind === 'shape');
    expect(shapes.filter(it => it.kind === 'shape' && it.geom === 'chevron')).toHaveLength(3);
    expect(shapes.some(it => it.kind === 'shape' && /BRAVO/.test(it.html) && /Bebas Neue/.test(it.html))).toBe(true);
  });

  it('turns Copilot slides marked as diagrams into diagram slides', () => {
    const slides = slidesFromSpecs([
      { layout: 'content', title: 'How we work', subtitle: '', bullets: ['Listen', 'Plan', 'Deliver'], right: [], notes: 'n', diagram: 'process' },
      { layout: 'content', title: 'Plain', subtitle: '', bullets: ['One', 'Two'], right: [], notes: '', diagram: 'none' },
    ], deck);
    expect(slides[0].layout).toBe('titleOnly');
    expect(slides[0].items.filter(it => it.kind === 'shape' && it.geom === 'chevron')).toHaveLength(3);
    expect(slides[1].layout).toBe('content');
  });
});

describe('changing theme', () => {
  it('moves accent colors to the new theme and leaves other colors alone', () => {
    const from = THEMES.find(t => t.id === 'scene')!, to = THEMES.find(t => t.id === 'christmas')!;
    const d = newDeck(from);
    const s = newSlide('blank', d);
    s.items = [
      ...diagramItems('grid', ['a', 'b', 'c'], d),
      { ...wordArtItem('bold', 'Hi', d) },
      { id: 'own', kind: 'shape', geom: 'rect', x: 0, y: 0, w: 10, h: 10, fill: '#123456', html: '<p></p>' },
    ];
    d.slides = [s];
    const back = retheme(d, to);
    const fills = back.slides[0].items.map(it => (it.kind === 'shape' ? it.fill : null));
    expect(fills.slice(0, 3)).toEqual(to.accents.slice(0, 3));
    expect(fills[4]).toBe('#123456');
    const art = back.slides[0].items[3];
    expect(art.kind === 'shape' && art.html).toContain(`color: ${to.accents[0]}`);
    expect(back.theme.id).toBe('christmas');
  });
});
