// The Animations tab of In 1 Stage: effects for the selected items (in, attention, out and looping), their
// options and order, animated stickers (emojis and words like "Hello" or "Merci"), automatic animation by rules
// or by Claude, and a preview right on the slide.

import { type CSSProperties } from 'react';
import { getLanguage, t, type MessageKey } from '../../shell/i18n';
import type { Anim, AnimKind, Deck, Item, Slide } from '../../formats/slides';
import { itemText } from '../../formats/slides';
import { Btn, Drop, Group, Icon, MenuItem, NumberBox } from '../../ui/kit';
import {
  ANIMS, ANIM_KINDS, EMOJI_STICKERS, WORD_STICKERS, addAnim, animInfo, autoAnimate, durOf, emojiSticker, kindOf, moveAnim, removeAnims, wordSticker,
} from './anim';

export interface AnimTabProps {
  deck: Deck;
  slide: Slide;
  sel: string[];
  setSel: (ids: string[]) => void;
  kind: AnimKind;
  setKind: (k: AnimKind) => void;
  changeSlide: (fn: (s: Slide) => Slide) => void;
  changeDeck: (fn: (d: Deck) => Deck) => void;
  addAnimated: (item: Item, effects: Anim['effect'][]) => void;
  preview: () => void;
  previewing: boolean;
  show: () => void;
  copilot: () => void;
  notify: (text: string) => void;
}

const itemLabel = (it: Item | undefined) => {
  if (!it) return '?';
  const text = itemText(it).replace(/\s+/g, ' ').trim();
  if (text) return text.length > 28 ? `${text.slice(0, 27)}…` : text;
  return it.kind === 'image' ? t('stage.anim.picture') : it.kind === 'table' ? t('stage.anim.table') : t('stage.anim.shape');
};

export function AnimTab(p: AnimTabProps) {
  const { slide, sel, kind } = p;
  const anims = slide.anims ?? [];
  const picked = slide.items.filter(i => sel.includes(i.id));
  // The animation the options change: the selected item's one of the shown kind, or its last one.
  const mine = anims.filter(a => sel.includes(a.item));
  const cur = mine.find(a => kindOf(a.effect) === kind) ?? mine[mine.length - 1];
  const textPicked = picked.some(i => i.kind === 'shape');
  const lang = getLanguage().slice(0, 2);

  const apply = (effect: Anim['effect']) => {
    if (!picked.length) { p.notify(t('stage.anim.pickFirst')); return; }
    p.changeSlide(s => picked.reduce((acc, it, i) => addAnim(acc, it.id, effect, i && kindOf(effect) !== 'loop' ? { start: 'with' } : {}), s));
  };
  const setOpt = (patch: Partial<Anim>) => {
    if (!cur) return;
    p.changeSlide(s => ({ ...s, anims: (s.anims ?? []).map(a => (a.id === cur.id ? { ...a, ...patch } : a)) }));
  };
  const steps = (() => {
    let n = 0;
    return anims.map(a => (a.start === 'click' && kindOf(a.effect) !== 'loop' ? ++n : n));
  })();

  return <>
    <Group label="stage.group.effects">
      <div className="st-gallery-wrap">
        <div className="st-gallery-groups" role="tablist">
          {ANIM_KINDS.map(k => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => p.setKind(k)}>
              {t(`stage.anim.kind.${k}` as MessageKey)}
            </button>
          ))}
        </div>
        <div className="st-fx-grid">
          {ANIMS.filter(a => a.kind === kind).map(a => {
            const on = mine.some(x => x.effect === a.id);
            const name = `st-a-${a.id}${a.dirs ? `-${a.id === 'wipe' ? 'right' : 'left'}` : ''}`;
            return (
              <button key={a.id} type="button" className={`st-fx${on ? ' on' : ''}`} onClick={() => apply(a.id)} title={t(`stage.anim.${a.id}` as MessageKey)}
                style={{ '--fx': name, '--fx-dur': `${Math.max(0.5, Math.min(a.dur, 1.6))}s`, '--fx-count': a.kind === 'loop' ? 'infinite' : '1' } as CSSProperties}>
                <span className={`st-fx-demo k-${a.kind}`}>{a.kind === 'loop' ? '😀' : a.id === 'typewriter' ? 'Ab|' : 'Aa'}</span>
                <span className="st-fx-name">{t(`stage.anim.${a.id}` as MessageKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Group>

    <Group label="stage.group.animOptions">
      <div className="stack">
        <Drop icon="play" title="stage.anim.start" text disabled={!cur || kindOf(cur.effect) === 'loop'}>
          {close => (['click', 'with', 'after'] as const).map(v => <MenuItem key={v} label={t(`stage.anim.start.${v}` as MessageKey)} active={cur?.start === v} onClick={() => { close(); setOpt({ start: v }); }} />)}
        </Drop>
        <Drop icon="case" title="stage.anim.by" text disabled={!cur || !textPicked || cur.effect === 'typewriter' || kindOf(cur.effect) === 'loop'}>
          {close => (['all', 'word', 'letter'] as const).map(v => <MenuItem key={v} label={t(`stage.anim.by.${v}` as MessageKey)} active={(cur?.by ?? 'all') === v} onClick={() => { close(); setOpt({ by: v === 'all' ? undefined : v }); }} />)}
        </Drop>
        <Drop icon="next" title="stage.anim.dir" text disabled={!cur || !animInfo(cur.effect).dirs}>
          {close => (['left', 'right', 'up', 'down'] as const).map(v => <MenuItem key={v} label={t(`stage.anim.dir.${v}` as MessageKey)} active={cur?.dir === v} onClick={() => { close(); setOpt({ dir: v }); }} />)}
        </Drop>
      </div>
      <div className="stack">
        <NumberBox label={t('stage.anim.dur')} unit="s" step={0.1} min={0.05} max={20} value={cur ? Math.round(durOf(cur) * 100) / 100 : 0.6} onChange={v => setOpt({ dur: v })} help="stage.anim.dur" />
        <NumberBox label={t('stage.anim.delay')} unit="s" step={0.1} min={0} max={60} value={cur?.delay ?? 0} onChange={v => setOpt({ delay: v || undefined })} help="stage.anim.delay" />
      </div>
    </Group>

    <Group label="stage.group.animOrder">
      <Drop big icon="numbers" title={t('stage.anim.order', { n: anims.length })} help="stage.anim.order" wide>
        {() => anims.length ? (
          <div className="st-anim-list">
            {anims.map((a, i) => {
              const it = slide.items.find(x => x.id === a.item);
              return (
                <div key={a.id} className={`st-anim-row${sel.includes(a.item) ? ' on' : ''}`}>
                  <span className={`st-anim-step k-${kindOf(a.effect)}`}>{kindOf(a.effect) === 'loop' ? '∞' : a.start === 'click' ? steps[i] : a.start === 'with' ? '+' : '→'}</span>
                  <button type="button" className="grow" onClick={() => p.setSel([a.item])}>
                    <b>{t(`stage.anim.${a.effect}` as MessageKey)}</b> <span>{itemLabel(it)}</span>
                  </button>
                  <button type="button" aria-label={t('stage.anim.earlier')} title={t('stage.anim.earlier')} disabled={!i} onClick={() => p.changeSlide(s => moveAnim(s, a.id, -1))}><Icon name="prev" size={13} /></button>
                  <button type="button" aria-label={t('stage.anim.later')} title={t('stage.anim.later')} disabled={i === anims.length - 1} onClick={() => p.changeSlide(s => moveAnim(s, a.id, 1))}><Icon name="next" size={13} /></button>
                  <button type="button" aria-label={t('stage.anim.remove')} title={t('stage.anim.remove')} onClick={() => p.changeSlide(s => removeAnims(s, [a.id]))}><Icon name="trash" size={13} /></button>
                </div>
              );
            })}
          </div>
        ) : <p className="st-hint">{t('stage.anim.none')}</p>}
      </Drop>
      <Btn big icon="trash" title="stage.anim.removeSel" disabled={!mine.length} onClick={() => p.changeSlide(s => removeAnims(s, mine.map(a => a.id)))} />
    </Group>

    <Group label="stage.group.stickers">
      <Drop big icon="sparkle" title="stage.sticker.emoji">
        {close => (
          <div className="st-emoji-grid">
            {EMOJI_STICKERS.map(e => (
              <button key={e} type="button" onClick={() => { close(); p.addAnimated(emojiSticker(e, p.deck), ['pop', 'bob']); }}>{e}</button>
            ))}
          </div>
        )}
      </Drop>
      <Drop big icon="wordart" title="stage.sticker.words" wide>
        {close => (
          <div className="st-word-stickers">
            {WORD_STICKERS.map(w => {
              const text = w.words[lang] ?? w.words.en;
              const color = p.deck.theme.accents[w.accent % p.deck.theme.accents.length];
              return (
                <button key={w.id} type="button" style={{ background: color }} className={lumLight(color) ? 'dark' : ''}
                  onClick={() => { close(); p.addAnimated(wordSticker(text, w.emoji, color, p.deck), ['bounce', 'beat']); }}>
                  {text} {w.emoji}
                </button>
              );
            })}
          </div>
        )}
      </Drop>
      <Btn big icon="sparkle" title="stage.sticker.ai" onClick={p.copilot} />
    </Group>

    <Group label="stage.group.magic">
      <Btn big icon="sparkle" title="stage.anim.auto" onClick={() => { p.changeSlide(s => autoAnimate(s)); p.notify(t('stage.anim.autoDone')); }} />
      <Drop big icon="play" title="stage.anim.more">
        {close => <>
          <MenuItem label={t('stage.anim.autoLively')} onClick={() => { close(); p.changeSlide(s => autoAnimate(s, 'lively')); }} />
          <MenuItem label={t('stage.anim.autoAll')} onClick={() => { close(); p.changeDeck(d => ({ ...d, slides: d.slides.map(s => autoAnimate(s)) })); p.notify(t('stage.anim.autoDone')); }} />
          <MenuItem label={t('stage.anim.autoAllLively')} onClick={() => { close(); p.changeDeck(d => ({ ...d, slides: d.slides.map(s => autoAnimate(s, 'lively')) })); p.notify(t('stage.anim.autoDone')); }} />
          <MenuItem label={t('stage.anim.ai')} onClick={() => { close(); p.copilot(); }} />
          <hr />
          <MenuItem label={t('stage.anim.clearSlide')} onClick={() => { close(); p.changeSlide(s => ({ ...s, anims: undefined })); }} />
          <MenuItem label={t('stage.anim.clearAll')} onClick={() => { close(); p.changeDeck(d => ({ ...d, slides: d.slides.map(s => ({ ...s, anims: undefined })) })); }} />
        </>}
      </Drop>
    </Group>

    <Group label="stage.group.animPreview">
      <Btn big icon="play" title="stage.anim.preview" active={p.previewing} onClick={p.preview} />
      <Btn big icon="desktop" title="stage.fromCurrent" onClick={p.show} />
    </Group>
  </>;
}

function lumLight(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6;
}
