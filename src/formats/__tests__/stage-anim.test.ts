import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { readPptx, writePptx } from '../pptx';
import { THEMES, newDeck, newSlide, type Deck, type ShapeItem } from '../slides';
import { addAnim, autoAnimate, emojiSticker, playState, splitHtml, stepLength, stepsOf, wordSticker } from '../../modules/stage/anim';
import { animsFromSpec } from '../../modules/stage/copilot';

const bytes = (blob: Blob) => new Promise<ArrayBuffer>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as ArrayBuffer); fr.readAsArrayBuffer(blob); });

function sample(): Deck {
  const d = newDeck(THEMES[1]);
  const s = newSlide('content', d);
  s.items = s.items.map(it => (it.kind === 'shape' && it.role === 'title' ? { ...it, html: '<p>Our plan</p>' } : it.kind === 'shape' ? { ...it, html: '<ul><li><p>Listen well</p></li><li><p>Act fast</p></li></ul>' } : it));
  s.items.push(emojiSticker('🎉', d), wordSticker('Merci !', '🙏', '#C8102E', d));
  d.slides = [s];
  return d;
}

describe('slide animations', () => {
  it('plays the auto step first, then one step per click, with "after" waiting for the one before', () => {
    const d = sample();
    const [title, body, emoji] = d.slides[0].items;
    let s = addAnim(d.slides[0], title.id, 'fade', { start: 'after' });
    s = addAnim(s, body.id, 'fly', { by: 'word', dir: 'up' });
    s = addAnim(s, emoji.id, 'pop', { start: 'after' });
    s = addAnim(s, emoji.id, 'bob');
    const steps = stepsOf(s);
    expect(steps).toHaveLength(2);
    expect(steps[0].map(x => x.anim.item)).toEqual([title.id]);
    expect(steps[1].map(x => x.anim.item)).toEqual([body.id, emoji.id]);
    // Four words, by word: the sticker starts once the last word has come in.
    expect(steps[1][1].at).toBeCloseTo(steps[1][0].len, 5);
    expect(stepLength(steps[1])).toBeGreaterThan(1);

    const before = playState(s, 0);
    expect(before.get(body.id)?.hidden).toBe(true);
    expect(before.get(title.id)?.animation).toMatch(/^st-a-fade /);
    expect(before.get(emoji.id)?.loop).toMatch(/st-a-bob .* infinite/);
    const after = playState(s, 1);
    expect(after.get(body.id)).toMatchObject({ hidden: false, by: 'word' });
    expect(after.get(title.id)?.animation).toBeUndefined();
    const back = playState(s, 1, false);
    expect(back.get(body.id)?.animation).toBeUndefined();
    expect(back.get(body.id)?.hidden).toBe(false);
  });

  it('hides an item once it has left', () => {
    const d = sample();
    const title = d.slides[0].items[0];
    const s = addAnim(d.slides[0], title.id, 'fadeOut');
    expect(playState(s, 0).get(title.id)?.hidden).toBeFalsy();
    expect(playState(s, 1).get(title.id)).toMatchObject({ hidden: false });
    expect(playState(s, 1).get(title.id)?.animation).toMatch(/^st-a-fadeOut/);
    expect(playState(s, 1, false).get(title.id)?.hidden).toBe(true);
  });

  it('splits text into words or letters that start one after another', () => {
    const html = splitHtml('<p>Hello <strong>big</strong> world</p>', 'word', 'st-a-fade 0.6s ease 0.200s 1 both', 0.1);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const units = Array.from(doc.querySelectorAll('.st-unit'));
    expect(units.map(u => u.textContent)).toEqual(['Hello', 'big', 'world']);
    expect(units[2].getAttribute('style')).toContain('0.400s');
    expect(doc.querySelector('strong .st-unit')?.textContent).toBe('big');
    expect(splitHtml('<p>Hi you</p>', 'letter', 'st-a-typewriter 0.05s ease 0.000s 1 both', 0.05).match(/st-unit/g)).toHaveLength(5);
  });

  it('keeps one entrance per item and replaces it when another is picked', () => {
    const d = sample();
    const id = d.slides[0].items[0].id;
    const s = addAnim(addAnim(addAnim(d.slides[0], id, 'fade'), id, 'zoom'), id, 'pulse');
    expect(s.anims?.map(a => a.effect)).toEqual(['zoom', 'pulse']);
  });

  it('animates a slide by itself: title first, text by word, stickers bounce and keep moving', () => {
    const d = sample();
    const s = autoAnimate(d.slides[0]);
    const [title, body, emoji, words] = s.items;
    expect(s.anims?.[0]).toMatchObject({ item: title.id, start: 'after' });
    expect(s.anims?.find(a => a.item === body.id)).toMatchObject({ by: 'word', start: 'click' });
    expect(s.anims?.filter(a => a.item === emoji.id).map(a => a.effect)).toEqual(['bounce', 'bob']);
    expect(s.anims?.filter(a => a.item === words.id).map(a => a.effect)).toEqual(['bounce', 'beat']);
  });

  it('takes Claude\'s animations only for items and effects that exist', () => {
    const d = sample();
    const s = d.slides[0];
    const got = animsFromSpec(s, [
      { item: 0, effect: 'fade', start: 'after', by: 'all', dir: 'left' },
      { item: 0, effect: 'zoom', start: 'click', by: 'all', dir: 'left' },
      { item: 1, effect: 'fly', start: 'click', by: 'word', dir: 'up' },
      { item: 9, effect: 'fade', start: 'click', by: 'all', dir: 'left' },
      { item: 2, effect: 'explode', start: 'click', by: 'all', dir: 'left' },
      { item: 3, effect: 'beat', start: 'click', by: 'all', dir: 'left' },
    ]);
    expect(got.map(a => a.effect)).toEqual(['fade', 'fly', 'beat']);
    expect(got[1]).toMatchObject({ by: 'word', dir: 'up' });
    expect(got[2].start).toBe('with');
  });

  it('saves the animations in a .pptx and finds them again, PowerPoint\'s timing included', async () => {
    const d = sample();
    const [title, body, emoji, words] = d.slides[0].items;
    let s = addAnim(d.slides[0], title.id, 'typewriter', { start: 'after' });
    s = addAnim(s, body.id, 'fly', { by: 'word', dir: 'right', dur: 1.2 });
    s = addAnim(s, words.id, 'bounce', { start: 'after', delay: 0.5 });
    s = addAnim(s, words.id, 'beat');
    s = addAnim(s, emoji.id, 'fadeOut');
    d.slides = [s];
    const blob = await writePptx(d, 'fr-FR', 'Anim');
    const back = await readPptx(await bytes(blob));
    const items = back.slides[0].items;
    const name = (id: string) => items.findIndex(it => it.id === id);
    expect(back.slides[0].anims?.map(a => [name(a.item), a.effect, a.start])).toEqual([
      [0, 'typewriter', 'after'], [1, 'fly', 'click'], [3, 'bounce', 'after'], [3, 'beat', 'with'], [2, 'fadeOut', 'click'],
    ]);
    expect(back.slides[0].anims?.[1]).toMatchObject({ by: 'word', dir: 'right', dur: 1.2 });

    // The timing tree PowerPoint plays: one group per click, a fly with its direction, an exit.
    const zip = await JSZip.loadAsync(await bytes(blob));
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(xml).toContain('nodeType="mainSeq"');
    expect(xml).toMatch(/presetID="2" presetClass="entr" presetSubtype="2"/);
    expect(xml).toContain('presetClass="exit"');
    expect(new DOMParser().parseFromString(xml, 'application/xml').querySelector('parsererror')).toBeNull();

    // A file from PowerPoint has only the timing tree: the closest effects come back.
    zip.file('ppt/slides/slide1.xml', xml.replace(/<p:extLst><p:ext uri="\{6E1F3B2A[\s\S]*?<\/p:extLst>/, ''));
    const plain = await readPptx(await zip.generateAsync({ type: 'arraybuffer' }));
    expect(plain.slides[0].anims?.map(a => a.effect)).toEqual(['fade', 'fly', 'fade', 'fadeOut']);
    expect(plain.slides[0].anims?.[1]).toMatchObject({ dir: 'right', start: 'click' });
  });

  it('makes word stickers that fit their words and read well on their color', () => {
    const d = sample();
    const light = wordSticker('Félicitations à toute l\'équipe !', '🎉', '#F2D78B', d) as ShapeItem;
    expect(light.w).toBeLessThanOrEqual(d.w * 0.7);
    expect(light.html).toContain('#1F1F1F');
    expect(wordSticker('Merci', '', '#12355B', d).html).toContain('#FFFFFF');
  });
});
