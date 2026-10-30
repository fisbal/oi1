// Animations on a slide, like PowerPoint's Animations tab: items come in, get attention or leave, one click after
// another, by word or by letter for text. Office Stage adds looping effects (a sticker that keeps bouncing) and
// stickers made of animated emojis and words. The order lives on the slide (slide.anims); the show plays it.

import { newId, type Anim, type AnimEffect, type AnimKind, type Deck, type Item, type ShapeItem, type Slide } from '../../formats/slides';

export interface AnimInfo { id: AnimEffect; kind: AnimKind; dirs?: boolean; dur: number }

export const ANIMS: AnimInfo[] = [
  { id: 'appear', kind: 'in', dur: 0.01 },
  { id: 'fade', kind: 'in', dur: 0.6 },
  { id: 'fly', kind: 'in', dirs: true, dur: 0.7 },
  { id: 'zoom', kind: 'in', dur: 0.6 },
  { id: 'pop', kind: 'in', dur: 0.55 },
  { id: 'bounce', kind: 'in', dur: 0.9 },
  { id: 'drop', kind: 'in', dur: 0.8 },
  { id: 'wipe', kind: 'in', dirs: true, dur: 0.7 },
  { id: 'blur', kind: 'in', dur: 0.8 },
  { id: 'spin', kind: 'in', dur: 0.8 },
  { id: 'float', kind: 'in', dur: 1 },
  { id: 'typewriter', kind: 'in', dur: 0.05 },
  { id: 'pulse', kind: 'em', dur: 0.6 },
  { id: 'shake', kind: 'em', dur: 0.6 },
  { id: 'wiggle', kind: 'em', dur: 0.8 },
  { id: 'glow', kind: 'em', dur: 1.2 },
  { id: 'grow', kind: 'em', dur: 0.6 },
  { id: 'flash', kind: 'em', dur: 0.8 },
  { id: 'fadeOut', kind: 'out', dur: 0.6 },
  { id: 'flyOut', kind: 'out', dirs: true, dur: 0.7 },
  { id: 'zoomOut', kind: 'out', dur: 0.6 },
  { id: 'shrink', kind: 'out', dur: 0.5 },
  { id: 'bob', kind: 'loop', dur: 2 },
  { id: 'beat', kind: 'loop', dur: 1.2 },
  { id: 'sway', kind: 'loop', dur: 2.4 },
  { id: 'twinkle', kind: 'loop', dur: 1.6 },
  { id: 'rotate', kind: 'loop', dur: 6 },
  { id: 'jelly', kind: 'loop', dur: 1.8 },
];

export const ANIM_KINDS: AnimKind[] = ['in', 'em', 'out', 'loop'];
export const animInfo = (e: AnimEffect): AnimInfo => ANIMS.find(a => a.id === e) ?? ANIMS[1];
export const kindOf = (e: AnimEffect): AnimKind => animInfo(e).kind;

/** Seconds between two words or two letters when text comes in bit by bit. */
const STAGGER = { word: 0.12, letter: 0.045 };

function unitsOf(it: Item | undefined, by: Anim['by']): number {
  if (!it || it.kind !== 'shape' || !by || by === 'all') return 1;
  const text = it.html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, 'x');
  return Math.max(1, by === 'word' ? text.split(/\s+/).filter(Boolean).length : text.replace(/\s+/g, '').length);
}

/** How the text of an animation is split: typewriter always goes letter by letter. */
export const byOf = (a: Anim): Anim['by'] => (a.effect === 'typewriter' ? 'letter' : a.by ?? 'all');
export const durOf = (a: Anim) => a.dur ?? animInfo(a.effect).dur;

/** How long an animation lasts, words and letters included, in seconds. */
export function lengthOf(a: Anim, it: Item | undefined): number {
  const by = byOf(a);
  const n = unitsOf(it, by);
  return durOf(a) + (by === 'word' || by === 'letter' ? (n - 1) * STAGGER[by] : 0);
}

export interface Timed { anim: Anim; at: number; len: number }

/**
 * The slide's animations as steps: step 0 plays by itself when the slide appears (animations set to "with" or
 * "after" before the first click), each later step starts on a click. Looping effects are left out: they run all
 * the time once their item is on screen.
 */
export function stepsOf(slide: Slide): Timed[][] {
  const steps: Timed[][] = [[]];
  let end = 0, start = 0;
  for (const a of slide.anims ?? []) {
    if (!slide.items.some(i => i.id === a.item) || kindOf(a.effect) === 'loop') continue;
    const it = slide.items.find(i => i.id === a.item);
    const len = lengthOf(a, it);
    const delay = a.delay ?? 0;
    if (a.start === 'click') { steps.push([]); start = delay; end = 0; }
    else if (a.start === 'after') start = end + delay;
    else start = start + delay;
    const step = steps[steps.length - 1];
    step.push({ anim: a, at: start, len });
    end = Math.max(end, start + len);
  }
  return steps;
}

/** How long a step takes to play, in seconds. */
export const stepLength = (step: Timed[]) => step.reduce((m, x) => Math.max(m, x.at + x.len), 0);

export interface ItemPlay {
  hidden?: boolean;
  /** CSS animation for the whole item, or for each word or letter when `by` is set. */
  animation?: string;
  by?: 'word' | 'letter';
  stagger?: number;
  loop?: string;
}

const EASE: Record<AnimKind, string> = { in: 'cubic-bezier(.22,1,.36,1)', em: 'ease-in-out', out: 'cubic-bezier(.55,0,.75,.2)', loop: 'ease-in-out' };

export function cssAnimation(a: Anim, at: number): string {
  const info = animInfo(a.effect);
  const name = `st-a-${a.effect}${info.dirs ? `-${a.dir ?? (info.id === 'wipe' ? 'right' : 'left')}` : ''}`;
  const fill = info.kind === 'em' ? 'none' : 'both';
  return `${name} ${durOf(a)}s ${EASE[info.kind]} ${at.toFixed(3)}s 1 ${fill}`;
}

export function loopAnimation(a: Anim): string {
  return `st-a-${a.effect} ${durOf(a)}s ${EASE.loop} ${(a.delay ?? 0).toFixed(2)}s infinite both`;
}

/**
 * What each item looks like at a step of the show: hidden until it comes in, gone after it leaves, and the
 * animations of the current step when `animate` is on (off when going back, so things just appear in place).
 */
export function playState(slide: Slide, step: number, animate = true, offset = 0): Map<string, ItemPlay> {
  const out = new Map<string, ItemPlay>();
  const steps = stepsOf(slide);
  const anims = slide.anims ?? [];
  for (const it of slide.items) {
    const first = anims.find(a => a.item === it.id && kindOf(a.effect) !== 'loop');
    if (first && kindOf(first.effect) === 'in') out.set(it.id, { hidden: true });
  }
  steps.slice(0, Math.max(0, step) + 1).forEach((st, si) => {
    for (const x of st) {
      const kind = kindOf(x.anim.effect);
      const cur = si === step && animate;
      const p: ItemPlay = { ...out.get(x.anim.item) };
      if (kind === 'in') p.hidden = false;
      if (kind === 'out') p.hidden = !cur;
      if (cur) {
        const by = byOf(x.anim);
        p.animation = cssAnimation(x.anim, x.at + (si === 0 ? offset : 0));
        if ((by === 'word' || by === 'letter') && kind !== 'out') { p.by = by; p.stagger = STAGGER[by]; }
        else { p.by = undefined; p.stagger = undefined; }
      } else { p.animation = undefined; p.by = undefined; }
      out.set(x.anim.item, p);
    }
  });
  for (const a of anims) {
    if (kindOf(a.effect) !== 'loop' || !slide.items.some(i => i.id === a.item)) continue;
    out.set(a.item, { ...out.get(a.item), loop: loopAnimation(a) });
  }
  return out;
}

/** Wraps every word or letter of the text in a span, each starting a little after the one before. */
export function splitHtml(html: string, by: 'word' | 'letter', animation: string, stagger: number): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const m = animation.match(/^(\S+) (\S+)s (\S+(?:\([^)]*\))?) (-?[\d.]+)s (.*)$/);
  const [name, dur, ease, delay, rest] = m ? [m[1], m[2], m[3], Number(m[4]), m[5]] : ['st-a-fade', '0.6', 'ease', 0, '1 both'];
  let n = 0;
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const text = child.textContent ?? '';
        const parts = by === 'word' ? text.split(/(\s+)/) : Array.from(text);
        const frag = doc.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); continue; }
          const span = doc.createElement('span');
          span.className = 'st-unit';
          span.textContent = part;
          span.setAttribute('style', `animation: ${name} ${dur}s ${ease} ${(delay + n * stagger).toFixed(3)}s ${rest}`);
          n++;
          frag.appendChild(span);
        }
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) walk(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

// ---------- quick setups ----------

/** A new animation for an item, added at the end of the slide's order. */
export function addAnim(slide: Slide, item: string, effect: AnimEffect, opts: Partial<Anim> = {}): Slide {
  const info = animInfo(effect);
  const anims = [...(slide.anims ?? [])];
  // An item has one entrance, one exit and one loop at most; a new one replaces the old.
  const same = anims.findIndex(a => a.item === item && kindOf(a.effect) === info.kind && info.kind !== 'em');
  const a: Anim = { id: newId('a'), item, effect, start: info.kind === 'loop' ? 'with' : 'click', ...(info.dirs ? { dir: info.id === 'wipe' ? 'right' : 'left' } : {}), ...opts };
  if (same >= 0) anims[same] = { ...anims[same], ...a, id: anims[same].id };
  else anims.push(a);
  return { ...slide, anims };
}

export const removeAnims = (slide: Slide, ids: string[]): Slide => ({ ...slide, anims: (slide.anims ?? []).filter(a => !ids.includes(a.id)) });

/** Moves an animation one place earlier (-1) or later (1) in the order. */
export function moveAnim(slide: Slide, id: string, by: -1 | 1): Slide {
  const anims = [...(slide.anims ?? [])];
  const i = anims.findIndex(a => a.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= anims.length) return slide;
  [anims[i], anims[j]] = [anims[j], anims[i]];
  return { ...slide, anims };
}

const isTitle = (it: Item) => it.kind === 'shape' && (it.role === 'title' || it.name === 'WordArt');
const textOf = (it: Item) => (it.kind === 'shape' ? it.html.replace(/<[^>]+>/g, ' ').trim() : '');

/**
 * Animations picked for a slide without asking anyone, like a designer would: the title first, then the other
 * text by word, diagrams piece by piece, pictures zooming in, stickers bouncing.
 */
export function autoAnimate(slide: Slide, mood: 'calm' | 'lively' = 'calm'): Slide {
  let s: Slide = { ...slide, anims: [] };
  const items = slide.items.filter(it => !(it.kind === 'shape' && !textOf(it) && it.role));
  const titles = items.filter(isTitle);
  const rest = items.filter(it => !isTitle(it));
  titles.forEach((it, i) => { s = addAnim(s, it.id, mood === 'lively' ? 'pop' : 'fade', { start: i ? 'with' : 'after' }); });
  let chain = false;
  for (const it of rest) {
    if (it.name?.startsWith('Sticker')) { s = addAnim(s, it.id, 'bounce', { start: 'after' }); s = addAnim(s, it.id, it.name === 'Sticker emoji' ? 'bob' : 'beat'); continue; }
    if (it.name === 'Slide number' || it.name === 'Footer') continue;
    if (it.name?.startsWith('Diagram')) { s = addAnim(s, it.id, mood === 'lively' ? 'pop' : 'zoom', { start: chain ? 'after' : 'click' }); chain = true; continue; }
    chain = false;
    if (it.kind === 'image') s = addAnim(s, it.id, 'zoom', { start: 'click' });
    else if (it.kind === 'table') s = addAnim(s, it.id, 'wipe', { start: 'click', dir: 'down' });
    else if (it.kind === 'shape' && (it.role === 'body' || it.role === 'body2' || it.role === 'subtitle')) s = addAnim(s, it.id, mood === 'lively' ? 'fly' : 'fade', { start: 'click', by: 'word', dir: 'up' });
    else s = addAnim(s, it.id, mood === 'lively' ? 'pop' : 'fade', { start: 'click' });
  }
  return s;
}

// ---------- stickers ----------

export const EMOJI_STICKERS = ['🎉', '👍', '❤️', '🔥', '⭐', '😀', '👏', '🚀', '🎂', '✅', '🙏', '💡', '🎯', '🏆', '😍', '🤝', '🎁', '☀️', '🌹', '😂', '🥳', '💪', '🇨🇦', '🎖️'];

export interface WordSticker { id: string; words: Record<string, string>; emoji: string; accent: number }
export const WORD_STICKERS: WordSticker[] = [
  { id: 'hello', words: { en: 'Hello!', fr: 'Bonjour !', es: '¡Hola!', pt: 'Olá!', de: 'Hallo!' }, emoji: '👋', accent: 0 },
  { id: 'thanks', words: { en: 'Thank you!', fr: 'Merci !', es: '¡Gracias!', pt: 'Obrigado!', de: 'Danke!' }, emoji: '🙏', accent: 1 },
  { id: 'welcome', words: { en: 'Welcome', fr: 'Bienvenue', es: 'Bienvenidos', pt: 'Bem-vindos', de: 'Willkommen' }, emoji: '🤗', accent: 2 },
  { id: 'bravo', words: { en: 'Well done!', fr: 'Bravo !', es: '¡Bravo!', pt: 'Parabéns!', de: 'Bravo!' }, emoji: '👏', accent: 3 },
  { id: 'congrats', words: { en: 'Congratulations!', fr: 'Félicitations !', es: '¡Felicidades!', pt: 'Felicitações!', de: 'Glückwunsch!' }, emoji: '🎉', accent: 4 },
  { id: 'birthday', words: { en: 'Happy birthday!', fr: 'Joyeux anniversaire !', es: '¡Feliz cumpleaños!', pt: 'Feliz aniversário!', de: 'Alles Gute!' }, emoji: '🎂', accent: 5 },
  { id: 'wow', words: { en: 'Wow!', fr: 'Waouh !', es: '¡Guau!', pt: 'Uau!', de: 'Wow!' }, emoji: '🤩', accent: 0 },
  { id: 'questions', words: { en: 'Questions?', fr: 'Des questions ?', es: '¿Preguntas?', pt: 'Perguntas?', de: 'Fragen?' }, emoji: '💬', accent: 1 },
  { id: 'new', words: { en: 'New!', fr: 'Nouveau !', es: '¡Nuevo!', pt: 'Novo!', de: 'Neu!' }, emoji: '✨', accent: 3 },
  { id: 'top', words: { en: 'Awesome!', fr: 'Super !', es: '¡Genial!', pt: 'Incrível!', de: 'Super!' }, emoji: '🔥', accent: 2 },
  { id: 'bye', words: { en: 'See you soon!', fr: 'À bientôt !', es: '¡Hasta pronto!', pt: 'Até breve!', de: 'Bis bald!' }, emoji: '👋', accent: 4 },
  { id: 'mission', words: { en: 'Mission accomplished', fr: 'Mission accomplie', es: 'Misión cumplida', pt: 'Missão cumprida', de: 'Mission erfüllt' }, emoji: '🎖️', accent: 5 },
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lumOf = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

/** A big emoji in a text box, named so the show and the copilot know it is a sticker. */
export function emojiSticker(emoji: string, deck: Pick<Deck, 'w' | 'h'>): ShapeItem {
  const s = 180;
  return {
    id: newId(), kind: 'shape', geom: 'rect', x: Math.round(deck.w * 0.86 - s / 2), y: Math.round(deck.h * 0.2 - s / 2), w: s, h: s,
    fill: null, line: null, valign: 'middle', name: 'Sticker emoji',
    html: `<p style="text-align: center"><span style="font-size: 80pt">${esc(emoji)}</span></p>`,
  };
}

/** A word badge: a colored pill with bold words and an emoji, in the theme's colors and title font. */
export function wordSticker(text: string, emoji: string, color: string, deck: Pick<Deck, 'w' | 'h' | 'theme'>, font?: string): ShapeItem {
  const chars = Array.from(text).length + (emoji ? 2 : 0);
  const pt = chars > 18 ? 30 : 38;
  const w = Math.min(deck.w * 0.7, Math.max(240, chars * pt * 0.62 + 90)), h = pt * 2.4;
  const ink = lumOf(color) > 0.6 ? '#1F1F1F' : '#FFFFFF';
  const family = font ?? deck.theme.head;
  return {
    id: newId(), kind: 'shape', geom: 'roundRect', x: Math.round((deck.w - w) / 2), y: Math.round(deck.h * 0.84 - h / 2), w: Math.round(w), h: Math.round(h),
    fill: color, line: null, valign: 'middle', name: 'Sticker words', rot: -4,
    html: `<p style="text-align: center"><span style="font-family: ${family}; font-size: ${pt}pt; color: ${ink}"><strong>${esc(text)}</strong></span>${emoji ? `<span style="font-size: ${pt}pt"> ${esc(emoji)}</span>` : ''}</p>`,
  };
}
