// Office Stage's copilot: Claude sees the slide (or the selected boxes) and the outline of the deck. It can make
// a whole presentation from a subject (slides, diagrams and the theme that suits it), create a new theme or pick
// fonts on request, turn a slide into a diagram, rewrite a slide, write the speaker notes and correct the text.
// Its slides come back as real slides on the deck's layouts and theme.

import type { AiApi } from '../../shell/contract';
import { LANGUAGES, t } from '../../shell/i18n';
import type { CopilotContext, CopilotHost } from '../../ui/Copilot';
import { THEMES, htmlText, linesToHtml, newId, newSlide, slideTitle, itemText, type Deck, type DeckTheme, type Item, type LayoutId, type Slide } from '../../formats/slides';
import { DIAGRAMS, diagramItems, type DiagramKind } from './build';
import { DECO_SHAPES, THEME_FONTS, saveMyTheme, themeFromSpec, type ThemeSpec } from './mythemes';
import { formatHtml } from './text';
import { ANIMS, kindOf, wordSticker } from './anim';
import type { Anim, AnimEffect } from '../../formats/slides';

export interface StageBridge {
  deck(): Deck;
  active(): number;
  selection(): Item[];
  addSlides(slides: Slide[], replace: boolean): void;
  replaceSlide(slide: Slide): void;
  setNotes(notes: string): void;
  setItemHtml(id: string, html: string): void;
  /** Built-in themes and the user's own. */
  themes(): DeckTheme[];
  setTheme(theme: DeckTheme): void;
  setAllNotes(notes: string[]): void;
  /** Replaces the animations of a slide. */
  setAnims(index: number, anims: Anim[]): void;
  /** Puts a new item on the slide with these animations (an entrance and a loop, for a sticker). */
  addAnimated(item: Item, effects: AnimEffect[]): void;
}

const EFFECTS = ANIMS.map(a => a.id);
const ANIMATE_SCHEMA = {
  type: 'object',
  properties: {
    slides: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slide: { type: 'integer' },
          anims: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'integer' },
                effect: { type: 'string', enum: EFFECTS },
                start: { type: 'string', enum: ['click', 'with', 'after'] },
                by: { type: 'string', enum: ['all', 'word', 'letter'] },
                dir: { type: 'string', enum: ['left', 'right', 'up', 'down'] },
              },
              required: ['item', 'effect', 'start', 'by', 'dir'],
              additionalProperties: false,
            },
          },
        },
        required: ['slide', 'anims'],
        additionalProperties: false,
      },
    },
  },
  required: ['slides'],
  additionalProperties: false,
};

const ANIMATE_RULES = [
  'You animate presentation slides like a great motion designer, so they tell their story and keep the audience awake, without being tiring.',
  `Effects: entrances ${ANIMS.filter(a => a.kind === 'in').map(a => a.id).join(', ')}; emphasis ${ANIMS.filter(a => a.kind === 'em').map(a => a.id).join(', ')}; exits ${ANIMS.filter(a => a.kind === 'out').map(a => a.id).join(', ')}; loops that keep moving (for stickers, emojis, icons only) ${ANIMS.filter(a => a.kind === 'loop').map(a => a.id).join(', ')}.`,
  'Rules: the title comes first, usually "after" so it plays by itself; bullet text comes word by word ("by": "word") or as a whole on a click; diagram pieces follow each other ("after"); a number or key fact can pop or pulse; a warning can shake; a closing "thank you" can bounce and then loop.',
  'Use at most one entrance per item. Give each slide 2 to 6 animations, and leave decorative lines alone. "dir" matters only for fly, wipe and flyOut; otherwise use "left".',
  'Slides and their items are given by number; use the same numbers. Reply for every slide you were given.',
].join('\n');

const STICKER_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    emoji: { type: 'string' },
    color: { type: 'string' },
    font: { type: 'string', enum: THEME_FONTS },
    entrance: { type: 'string', enum: ANIMS.filter(a => a.kind === 'in').map(a => a.id) },
    loop: { type: 'string', enum: ANIMS.filter(a => a.kind === 'loop').map(a => a.id) },
  },
  required: ['text', 'emoji', 'color', 'font', 'entrance', 'loop'],
  additionalProperties: false,
};

/** The slide's items, numbered, for Claude to animate. */
function itemsList(s: Slide): string {
  return s.items.map((it, n) => {
    const what = it.kind === 'image' ? 'picture' : it.kind === 'table' ? 'table' : it.role ? `${it.role} placeholder` : it.name ? it.name.toLowerCase() : `${it.geom} shape`;
    const text = itemText(it).replace(/\s+/g, ' ').trim().slice(0, 90);
    return `${n}: ${what}${text ? ` "${text}"` : ''}`;
  }).join('\n');
}

/** Animations from Claude's answer for one slide, skipping unknown items and effects. */
export function animsFromSpec(s: Slide, specs: { item: number; effect: string; start: string; by: string; dir: string }[]): Anim[] {
  const out: Anim[] = [];
  for (const x of specs) {
    const it = s.items[x.item];
    if (!it || !EFFECTS.includes(x.effect as AnimEffect)) continue;
    const effect = x.effect as AnimEffect;
    if (kindOf(effect) === 'in' && out.some(a => a.item === it.id && kindOf(a.effect) === 'in')) continue;
    out.push({
      id: newId('a'), item: it.id, effect,
      start: kindOf(effect) === 'loop' ? 'with' : x.start === 'with' || x.start === 'after' ? x.start : 'click',
      ...(it.kind === 'shape' && (x.by === 'word' || x.by === 'letter') ? { by: x.by } : {}),
      ...(effect === 'fly' || effect === 'wipe' || effect === 'flyOut' ? { dir: (['left', 'right', 'up', 'down'].includes(x.dir) ? x.dir : 'left') as Anim['dir'] } : {}),
    });
  }
  return out;
}

const SLIDES_SCHEMA = {
  type: 'object',
  properties: {
    slides: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          layout: { type: 'string', enum: ['title', 'content', 'section', 'two'] },
          title: { type: 'string' },
          subtitle: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
          right: { type: 'array', items: { type: 'string' } },
          diagram: { type: 'string', enum: ['none', ...DIAGRAMS] },
          notes: { type: 'string' },
        },
        required: ['layout', 'title', 'subtitle', 'bullets', 'right', 'diagram', 'notes'],
        additionalProperties: false,
      },
    },
    theme: { type: 'string' },
  },
  required: ['slides', 'theme'],
  additionalProperties: false,
};

interface SlideSpec { layout: LayoutId; title: string; subtitle: string; bullets: string[]; right: string[]; notes: string; diagram?: 'none' | DiagramKind }

/** Real slides from Claude's description of them. Indented bullets ("  - ") become second-level points. */
export function slidesFromSpecs(specs: SlideSpec[], deck: Pick<Deck, 'w' | 'h' | 'theme'>): Slide[] {
  const list = (lines: string[]) => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = '<ul>';
    let open = false;
    for (const raw of lines) {
      const sub = /^\s{2,}|^\t/.test(raw);
      const text = esc(raw.trim().replace(/^[-•*]\s*/, ''));
      if (!text) continue;
      if (sub && html !== '<ul>') { html = html.replace(/<\/li>$/, ''); html += open ? `<li><p>${text}</p></li>` : `<ul><li><p>${text}</p></li>`; open = true; continue; }
      if (open) { html += '</ul></li>'; open = false; }
      html += `<li><p>${text}</p></li>`;
    }
    if (open) html += '</ul></li>';
    return html === '<ul>' ? '<ul><li><p></p></li></ul>' : `${html}</ul>`;
  };
  return specs.map(sp => {
    // A slide drawn as a diagram: its title, then its points as steps, a cycle, a timeline...
    const points = sp.bullets.map(b => b.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
    if (sp.diagram && sp.diagram !== 'none' && DIAGRAMS.includes(sp.diagram) && points.length >= 2) {
      const s = newSlide('titleOnly', deck);
      s.items = [...s.items.map(it => (it.kind === 'shape' && it.role === 'title' ? { ...it, html: linesToHtml([sp.title], false) } : it)), ...diagramItems(sp.diagram, points, deck)];
      s.notes = sp.notes;
      return s;
    }
    const layout: LayoutId = ['title', 'content', 'section', 'two'].includes(sp.layout) ? sp.layout : 'content';
    const s = newSlide(layout, deck);
    s.items = s.items.map(it => {
      if (it.kind !== 'shape') return it;
      if (it.role === 'title') return { ...it, html: linesToHtml([sp.title], false) };
      if (it.role === 'subtitle') return { ...it, html: linesToHtml(sp.subtitle ? [sp.subtitle] : [], false) };
      if (it.role === 'body') return { ...it, html: layout === 'section' ? linesToHtml(sp.subtitle ? [sp.subtitle] : sp.bullets.slice(0, 1), false) : list(sp.bullets) };
      if (it.role === 'body2') return { ...it, html: list(sp.right) };
      return it;
    });
    s.notes = sp.notes;
    return s;
  });
}

function slideText(s: Slide, i: number): string {
  const parts = s.items.map(it => {
    const text = itemText(it).trim();
    if (!text) return '';
    const what = it.kind === 'shape' && it.role ? it.role : it.kind === 'table' ? 'table' : it.kind === 'image' ? 'picture' : 'text box';
    return `[${what}] ${text.replace(/\n/g, ' / ')}`;
  }).filter(Boolean);
  return `Slide ${i + 1} (${s.layout}${s.hidden ? ', hidden' : ''}):\n${parts.join('\n') || '(empty)'}${s.notes.trim() ? `\n[notes] ${s.notes.trim().replace(/\n/g, ' / ')}` : ''}`;
}

const outline = (d: Deck) => d.slides.map((s, i) => `${i + 1}. ${slideTitle(s) || '(no title)'}`).join('\n');

const themeList = (themes: DeckTheme[]) => themes.map(th => `${th.id}: ${th.name} (${th.group ?? 'classic'}, ${th.dark ? 'dark' : 'light'}, fonts ${th.head} / ${th.body})`).join('\n');

async function askSlides(ai: AiApi, request: string, d: Deck, signal: AbortSignal, themes: DeckTheme[] = THEMES): Promise<{ slides: SlideSpec[]; theme: string }> {
  const answer = await ai.ask({
    system: [
      'You write presentation slides for Office Stage, a presentation app like PowerPoint.',
      'Good slides: one idea each, a short title (under 8 words), 3 to 5 short bullets (under 12 words, no final period), concrete facts and numbers, no filler.',
      'Layouts: "title" for the first slide (title + subtitle), "section" to open a part (title + one line in subtitle), "content" (title + bullets), "two" (title + bullets on the left + right column, for comparisons).',
      'Set "diagram" on a content slide whose bullets are steps ("process"), a loop ("cycle"), dates or stages in time ("timeline"), levels ("pyramid") or equal parts ("grid"); the bullets then become the diagram, so keep them to 2 to 5 words. Use a diagram on about one slide in four; otherwise "none".',
      'Put the details the speaker should say in "notes" (2 to 4 sentences), not on the slide. Indent a bullet with two spaces to make it a sub-point.',
      'Write in the language of the request unless asked otherwise. Leave unused fields as empty strings or empty arrays.',
      `"theme": the id of the theme that suits the subject best, from this list:\n${themeList(themes)}`,
    ].join('\n'),
    messages: [{ role: 'user', content: `${request}\n\nThe current deck (for context; it may be empty):\n<context>\n${outline(d)}\n</context>` }],
    schema: SLIDES_SCHEMA,
    effort: 'medium',
    signal,
  });
  return JSON.parse(answer) as { slides: SlideSpec[]; theme: string };
}

const THEME_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    dark: { type: 'boolean' },
    background: { type: 'string' },
    background2: { type: 'string' },
    title: { type: 'string' },
    text: { type: 'string' },
    accents: { type: 'array', items: { type: 'string' } },
    headingFont: { type: 'string', enum: THEME_FONTS },
    bodyFont: { type: 'string', enum: THEME_FONTS },
    decorations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          shape: { type: 'string', enum: DECO_SHAPES },
          x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' },
          color: { type: 'string' }, opacity: { type: 'number' }, rotate: { type: 'number' },
        },
        required: ['shape', 'x', 'y', 'w', 'h', 'color', 'opacity', 'rotate'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'dark', 'background', 'background2', 'title', 'text', 'accents', 'headingFont', 'bodyFont', 'decorations'],
  additionalProperties: false,
};

const THEME_RULES = [
  'You design presentation themes for Office Stage, a presentation app like PowerPoint (16:9 slides).',
  'Colors are "#RRGGBB". The title and text colors must be easy to read on the background (strong contrast); "dark" is true when the background is dark.',
  '"background2" is a second color for a soft gradient, or "" for a plain background. Give exactly 6 accent colors that go together and stand out on the background (they color shapes, charts and bullets).',
  'Pick a heading font and a body font that fit the mood; the body font must be easy to read.',
  'Decorations are drawn behind every slide: 2 to 8 shapes, with x, y, w, h in parts of the slide (0 to 1; slightly outside is fine for shapes cut by the edge).',
  'Keep them at the edges and corners, never over the middle where the text goes (x 0.07 to 0.93, y 0.2 to 0.9), unless their opacity is under 0.12. Thin bars (h about 0.005 to 0.03) make good lines.',
  'Name the theme in two or three words, in the language of the request.',
].join('\n');

async function askTheme(ai: AiApi, request: string, signal: AbortSignal): Promise<DeckTheme> {
  const answer = await ai.ask({ system: THEME_RULES, messages: [{ role: 'user', content: request }], schema: THEME_SCHEMA, effort: 'medium', signal });
  return themeFromSpec(JSON.parse(answer) as ThemeSpec);
}

const FONTS_SCHEMA = {
  type: 'object',
  properties: { headingFont: { type: 'string', enum: THEME_FONTS }, bodyFont: { type: 'string', enum: THEME_FONTS } },
  required: ['headingFont', 'bodyFont'],
  additionalProperties: false,
};

const DIAGRAM_SCHEMA = {
  type: 'object',
  properties: { kind: { type: 'string', enum: DIAGRAMS }, title: { type: 'string' }, points: { type: 'array', items: { type: 'string' } } },
  required: ['kind', 'title', 'points'],
  additionalProperties: false,
};

const CORRECT_SCHEMA = { type: 'object', properties: { texts: { type: 'array', items: { type: 'string' } } }, required: ['texts'], additionalProperties: false };

export function stageCopilot(b: StageBridge): CopilotHost {
  const context = (): CopilotContext | null => {
    const d = b.deck();
    const i = b.active();
    const s = d.slides[i];
    if (!s) return null;
    const sel = b.selection().filter(it => itemText(it).trim());
    if (sel.length) {
      return {
        label: t('ai.stage.selection', { n: sel.length }),
        text: `Selected on slide ${i + 1}:\n${sel.map(it => itemText(it)).join('\n---\n')}\n\nDeck outline:\n${outline(d)}`,
        at: { slide: s.id, items: sel.map(it => it.id) },
      };
    }
    return { label: t('ai.stage.slide', { n: i + 1 }), text: `${slideText(s, i)}\n\nDeck outline:\n${outline(d)}`, at: { slide: s.id } };
  };

  /** Claude animates these slides; their old animations are replaced. */
  const animate = async (ai: AiApi, which: number[], signal: AbortSignal) => {
    const d = b.deck();
    const list = which.filter(i => d.slides[i]?.items.length).slice(0, 30);
    if (!list.length) return t('ai.stage.none');
    const answer = await ai.ask({
      system: ANIMATE_RULES,
      messages: [{ role: 'user', content: `<context>\nDeck outline:\n${outline(d)}\n\n${list.map(i => `Slide ${i + 1}:\n${itemsList(d.slides[i])}`).join('\n\n')}\n</context>` }],
      schema: ANIMATE_SCHEMA,
      effort: 'medium',
      signal,
    });
    const got = (JSON.parse(answer) as { slides: { slide: number; anims: { item: number; effect: string; start: string; by: string; dir: string }[] }[] }).slides;
    let n = 0, count = 0;
    for (const g of got) {
      const i = g.slide - 1;
      const s = b.deck().slides[i];
      if (!s || !list.includes(i)) continue;
      const anims = animsFromSpec(s, g.anims);
      b.setAnims(i, anims);
      n++; count += anims.length;
    }
    return n ? t('ai.stage.animated', { n: count, slides: n }) : t('ai.stage.none');
  };

  return {
    app: 'Office Stage',
    role: [
      'Office Stage is a presentation app like PowerPoint. Slides have a title, bullet points, text boxes, shapes, pictures and tables, and speaker notes.',
      'When you rewrite slide text for the user to put back, give only the new text: one line per paragraph, bullets starting with "- ", and nothing else.',
      'When asked to make slides or a presentation, write each slide as a line "# Slide title" followed by 3 to 5 lines "- short bullet" (two spaces before "-" for a sub-point), and nothing else, so they can be added as real slides.',
    ].join('\n'),
    context,
    actions: [
      {
        id: 'deck', icon: 'sparkle', label: t('ai.stage.deck'), fill: t('ai.stage.deckFill'),
        ask: async (ai, request, _ctx, signal) => {
          const themes = b.themes();
          const made = await askSlides(ai, `${request}\nMake a complete presentation of 6 to 10 slides: a title slide, the parts, and a short conclusion.`, b.deck(), signal, themes);
          if (!made.slides.length) return t('ai.stage.none');
          const theme = themes.find(th => th.id === made.theme);
          // The theme first, so the diagrams take its colors.
          if (theme) b.setTheme(theme);
          b.addSlides(slidesFromSpecs(made.slides, b.deck()), false);
          return t('ai.stage.deckMade', { n: made.slides.length, theme: theme?.name ?? b.deck().theme.name });
        },
      },
      {
        id: 'theme', icon: 'theme', label: t('ai.stage.theme'), fill: t('ai.stage.themeFill'),
        ask: async (ai, request, _ctx, signal) => {
          const theme = await askTheme(ai, `${request}\n\nThe presentation (for context; it may be empty):\n${outline(b.deck())}`, signal);
          saveMyTheme(theme);
          b.setTheme(theme);
          return t('ai.stage.themeMade', { name: theme.name, head: theme.head, body: theme.body });
        },
      },
      {
        id: 'fonts', icon: 'case', label: t('ai.stage.fonts'), fill: t('ai.stage.fontsFill'),
        ask: async (ai, request, _ctx, signal) => {
          const cur = b.deck().theme;
          const answer = await ai.ask({
            system: `You choose fonts for a presentation. Pick a heading font and a body font from the list that fit the request and go well together; the body font must be easy to read at 18 pt. The current theme is "${cur.name}" (${cur.dark ? 'dark' : 'light'}), with ${cur.head} / ${cur.body}.`,
            messages: [{ role: 'user', content: request }],
            schema: FONTS_SCHEMA,
            effort: 'low',
            signal,
          });
          const f = JSON.parse(answer) as { headingFont: string; bodyFont: string };
          const head = THEME_FONTS.includes(f.headingFont) ? f.headingFont : cur.head;
          const body = THEME_FONTS.includes(f.bodyFont) ? f.bodyFont : cur.body;
          const theme: DeckTheme = { ...cur, id: newId('ai'), name: `${cur.name.replace(/ · .*$/, '')} · ${head}`, head, body, group: 'mine' };
          saveMyTheme(theme);
          b.setTheme(theme);
          return t('ai.stage.fontsDone', { head, body });
        },
      },
      {
        id: 'animate', icon: 'play', label: t('ai.stage.animate'), needsContext: true,
        run: (ai, _ctx, signal) => animate(ai, [b.active()], signal),
      },
      {
        id: 'animateAll', icon: 'play', label: t('ai.stage.animateAll'), needsContext: true,
        run: (ai, _ctx, signal) => animate(ai, b.deck().slides.map((_, i) => i), signal),
      },
      {
        id: 'sticker', icon: 'sparkle', label: t('ai.stage.sticker'), fill: t('ai.stage.stickerFill'),
        ask: async (ai, request, _ctx, signal) => {
          const d = b.deck();
          const answer = await ai.ask({
            system: `You design one animated sticker for a presentation slide: a few words (1 to 4, in the language of the request) with one fitting emoji, a background color as #RRGGBB that stands out on this theme (background ${d.theme.bg.color}, accents ${d.theme.accents.join(', ')}), a font that matches the mood, an entrance and a loop that keeps it alive.`,
            messages: [{ role: 'user', content: request }],
            schema: STICKER_SCHEMA,
            effort: 'low',
            signal,
          });
          const sp = JSON.parse(answer) as { text: string; emoji: string; color: string; font: string; entrance: AnimEffect; loop: AnimEffect };
          const color = /^#[0-9a-f]{6}$/i.test(sp.color) ? sp.color.toUpperCase() : d.theme.accents[0];
          const font = THEME_FONTS.includes(sp.font) ? sp.font : undefined;
          const item = wordSticker(sp.text.slice(0, 40), Array.from(sp.emoji ?? '').slice(0, 4).join(''), color, d, font);
          b.addAnimated(item, [EFFECTS.includes(sp.entrance) ? sp.entrance : 'pop', EFFECTS.includes(sp.loop) ? sp.loop : 'beat']);
          return t('ai.stage.stickerDone', { text: sp.text });
        },
      },
      {
        id: 'design', icon: 'theme', label: t('ai.stage.design'), needsContext: true,
        run: async (ai, _ctx, signal) => {
          const themes = b.themes();
          const answer = await ai.ask({
            system: `You choose the theme that suits a presentation best, from this list:\n${themeList(themes)}\nReply with the theme's id only.`,
            messages: [{ role: 'user', content: `<context>\n${outline(b.deck())}\n${slideText(b.deck().slides[b.active()], b.active())}\n</context>` }],
            schema: { type: 'object', properties: { theme: { type: 'string', enum: themes.map(th => th.id) } }, required: ['theme'], additionalProperties: false },
            effort: 'low',
            signal,
          });
          const theme = themes.find(th => th.id === (JSON.parse(answer) as { theme: string }).theme);
          if (!theme) return t('ai.stage.none');
          b.setTheme(theme);
          return t('ai.stage.designDone', { theme: theme.name });
        },
      },
      {
        id: 'diagram', icon: 'diagram', label: t('ai.stage.diagram'), needsContext: true,
        run: async (ai, _ctx, signal) => {
          const d = b.deck();
          const i = b.active();
          const s = d.slides[i];
          const answer = await ai.ask({
            system: 'You turn one presentation slide into a diagram. Choose "process" for steps in order, "cycle" for a loop, "timeline" for dates or stages in time, "pyramid" for levels from top to bottom, "grid" for equal parts. Give 3 to 6 short points (2 to 5 words each) in the language of the slide, and a short title.',
            messages: [{ role: 'user', content: `<context>\n${slideText(s, i)}\n</context>` }],
            schema: DIAGRAM_SCHEMA,
            effort: 'low',
            signal,
          });
          const g = JSON.parse(answer) as { kind: DiagramKind; title: string; points: string[] };
          if (!DIAGRAMS.includes(g.kind) || !g.points.length) return t('ai.stage.none');
          const base = newSlide('titleOnly', d);
          const title = s.items.find(it => it.kind === 'shape' && it.role === 'title') ?? base.items[0];
          // Keep the slide's pictures, tables and own boxes; its bullet placeholders become the diagram.
          const keep = s.items.filter(it => !(it.kind === 'shape' && it.role));
          b.replaceSlide({
            ...s, layout: 'titleOnly',
            items: [{ ...base.items[0], ...(title.kind === 'shape' ? { html: htmlText(title.html).trim() ? title.html : linesToHtml([g.title], false) } : {}), x: base.items[0].x, y: base.items[0].y, w: base.items[0].w, h: base.items[0].h }, ...keep, ...diagramItems(g.kind, g.points, d)],
          });
          return t('ai.stage.diagramDone', { kind: t(`stage.diagram.${g.kind}`) });
        },
      },
      {
        id: 'improve', icon: 'pen', label: t('ai.stage.improve'), needsContext: true,
        run: async (ai, ctx, signal) => {
          const d = b.deck();
          const i = b.active();
          const s = d.slides[i];
          const { slides: specs } = await askSlides(ai, `Rewrite this slide to make it clearer and stronger, same subject and same language, as one slide:\n${slideText(s, i)}`, d, signal);
          if (!specs[0]) return t('ai.stage.none');
          const [made] = slidesFromSpecs([specs[0]], d);
          // Keep the slide's pictures, tables and own boxes; only its placeholders are rewritten.
          b.replaceSlide({ ...made, id: s.id, items: [...made.items, ...s.items.filter(it => !(it.kind === 'shape' && it.role))], bg: s.bg, transition: s.transition, speed: s.speed, notes: specs[0].notes || s.notes });
          void ctx;
          return t('ai.stage.improved');
        },
      },
      {
        id: 'notes', icon: 'comment', label: t('ai.stage.notes'), needsContext: true,
        run: async (ai, _ctx, signal) => {
          const d = b.deck();
          const i = b.active();
          const notes = await ai.ask({
            system: 'You write speaker notes for one presentation slide: what the speaker says, in 3 to 6 natural spoken sentences, in the language of the slide. Reply with only the notes.',
            messages: [{ role: 'user', content: `<context>\n${slideText(d.slides[i], i)}\n\nDeck outline:\n${outline(d)}\n</context>` }],
            effort: 'low',
            signal,
          });
          b.setNotes(notes.trim());
          return t('ai.stage.notesDone');
        },
      },
      {
        id: 'notesAll', icon: 'comment', label: t('ai.stage.notesAll'), needsContext: true,
        run: async (ai, _ctx, signal) => {
          const d = b.deck();
          const slides = d.slides.slice(0, 60);
          const answer = await ai.ask({
            system: 'You write speaker notes for every slide of a presentation: what the speaker says, 3 to 5 natural spoken sentences per slide, in the language of the slides, flowing from one slide to the next. Return exactly one note per slide, in order.',
            messages: [{ role: 'user', content: `<context>\n${slides.map((x, k) => slideText(x, k)).join('\n\n')}\n</context>` }],
            schema: { type: 'object', properties: { notes: { type: 'array', items: { type: 'string' } } }, required: ['notes'], additionalProperties: false },
            effort: 'medium',
            signal,
          });
          const notes = (JSON.parse(answer) as { notes: string[] }).notes.map(n => n.trim());
          b.setAllNotes(notes);
          return t('ai.stage.notesAllDone', { n: Math.min(notes.length, d.slides.length) });
        },
      },
      {
        id: 'correct', icon: 'check', label: t('ai.stage.correct'), needsContext: true,
        run: async (ai, _ctx, signal) => {
          const s = b.deck().slides[b.active()];
          const boxes = s.items.filter(it => it.kind === 'shape' && htmlText(it.html).trim()) as Extract<Item, { kind: 'shape' }>[];
          if (!boxes.length) return t('ai.letter.nothing');
          const texts = boxes.map(it => htmlText(it.html));
          const answer = await ai.ask({
            system: 'You are a meticulous proofreader. Fix spelling, grammar, agreement and punctuation in each text, in its own language, keeping the meaning, wording, line breaks and length. Return the same number of texts in the same order.',
            messages: [{ role: 'user', content: JSON.stringify({ texts }) }],
            schema: CORRECT_SCHEMA,
            effort: 'low',
            signal,
          });
          const fixed = (JSON.parse(answer) as { texts: string[] }).texts;
          let changed = 0;
          boxes.forEach((it, k) => {
            const f = fixed[k];
            if (!f || f === texts[k]) return;
            // Replace word by word inside the existing HTML so the formatting stays.
            const a = texts[k].split('\n'), c = f.split('\n');
            if (a.length !== c.length) return;
            let html = it.html;
            a.forEach((line, j) => { if (line !== c[j]) html = html.replace(escHtml(line), escHtml(c[j])); });
            if (html !== it.html) { b.setItemHtml(it.id, html); changed++; }
          });
          return changed ? t('ai.stage.corrected', { n: changed }) : t('ai.stage.noMistakes');
        },
      },
      {
        id: 'translate', icon: 'language', label: t('ai.letter.translate'), needsContext: true,
        choices: LANGUAGES.map(l => ({ label: l.name, prompt: `Translate the whole slide into ${l.name}: the title and every bullet, one line per paragraph, bullets starting with "- ".` })),
      },
    ],
    applies: [
      {
        id: 'slides', icon: 'new', label: t('ai.stage.applySlides'), run: (payload, answer) => {
          let lines = (payload || answer).split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
          // Words before the first "# Title" ("Here are your slides:") are not a slide.
          const first = lines.findIndex(l => /^#{1,3}\s/.test(l));
          if (first > 0) lines = lines.slice(first);
          if (!lines.length) return;
          // "# Title" lines start slides; the lines under them are the bullets.
          const specs: SlideSpec[] = [];
          for (const l of lines) {
            const h = l.match(/^#{1,3}\s+(.*)/) ?? l.match(/^\*\*(.+)\*\*$/);
            if (h || !specs.length) specs.push({ layout: 'content', title: h ? h[1].trim() : l.replace(/^[-•*]\s*/, ''), subtitle: '', bullets: [], right: [], notes: '' });
            else specs[specs.length - 1].bullets.push(l);
          }
          b.addSlides(slidesFromSpecs(specs, b.deck()), false);
          return t('ai.stage.made', { n: specs.length });
        },
      },
      {
        id: 'replace', icon: 'replace', label: t('ai.apply.replace'), run: (payload, _answer, at) => {
          const where = at as { slide: string; items?: string[] } | undefined;
          const d = b.deck();
          const s = d.slides[b.active()];
          if (!s || (where && where.slide !== s.id)) return t('ai.stage.slideChanged');
          const lines = payload.split('\n').filter(l => l.trim());
          if (!lines.length) return;
          const ids = where?.items ?? [];
          const target = ids.length === 1 ? s.items.find(it => it.id === ids[0]) : s.items.find(it => it.kind === 'shape' && (it.role === 'body' || it.role === 'body2'));
          const title = s.items.find(it => it.kind === 'shape' && it.role === 'title');
          if (!ids.length && title && lines.length > 1 && !/^[-•*]\s/.test(lines[0])) {
            b.setItemHtml(title.id, linesToHtml([lines[0].replace(/^#+\s*/, '')], false));
            lines.shift();
          }
          if (!target || target.kind !== 'shape') return;
          const bullets = lines.some(l => /^\s*[-•*]\s/.test(l)) || target.role === 'body' || target.role === 'body2';
          b.setItemHtml(target.id, linesToHtml(lines.map(l => l.trim().replace(/^[-•*]\s*/, '')), bullets && target.role !== 'title'));
        },
      },
      { id: 'notes', icon: 'comment', label: t('ai.stage.toNotes'), run: payload => { b.setNotes(payload.trim()); return t('ai.stage.notesDone'); } },
    ],
  };
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export { formatHtml };
