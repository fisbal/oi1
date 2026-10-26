// Office Stage's copilot: Claude sees the slide (or the selected boxes) and the outline of the deck. It can make
// whole slides from a subject, rewrite a slide, write the speaker notes and correct the text, and its slides
// come back as real slides on the deck's layouts and theme.

import type { AiApi } from '../../shell/contract';
import { LANGUAGES, t } from '../../shell/i18n';
import type { CopilotContext, CopilotHost } from '../../ui/Copilot';
import { htmlText, linesToHtml, newSlide, slideTitle, itemText, type Deck, type Item, type LayoutId, type Slide } from '../../formats/slides';
import { formatHtml } from './text';

export interface StageBridge {
  deck(): Deck;
  active(): number;
  selection(): Item[];
  addSlides(slides: Slide[], replace: boolean): void;
  replaceSlide(slide: Slide): void;
  setNotes(notes: string): void;
  setItemHtml(id: string, html: string): void;
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
          notes: { type: 'string' },
        },
        required: ['layout', 'title', 'subtitle', 'bullets', 'right', 'notes'],
        additionalProperties: false,
      },
    },
  },
  required: ['slides'],
  additionalProperties: false,
};

interface SlideSpec { layout: LayoutId; title: string; subtitle: string; bullets: string[]; right: string[]; notes: string }

/** Real slides from Claude's description of them. Indented bullets ("  - ") become second-level points. */
export function slidesFromSpecs(specs: SlideSpec[], deck: Pick<Deck, 'w' | 'h'>): Slide[] {
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

async function askSlides(ai: AiApi, request: string, d: Deck, signal: AbortSignal): Promise<SlideSpec[]> {
  const answer = await ai.ask({
    system: [
      'You write presentation slides for Office Stage, a presentation app like PowerPoint.',
      'Good slides: one idea each, a short title (under 8 words), 3 to 5 short bullets (under 12 words, no final period), concrete facts and numbers, no filler.',
      'Layouts: "title" for the first slide (title + subtitle), "section" to open a part (title + one line in subtitle), "content" (title + bullets), "two" (title + bullets on the left + right column, for comparisons).',
      'Put the details the speaker should say in "notes" (2 to 4 sentences), not on the slide. Indent a bullet with two spaces to make it a sub-point.',
      'Write in the language of the request unless asked otherwise. Leave unused fields as empty strings or empty arrays.',
    ].join('\n'),
    messages: [{ role: 'user', content: `${request}\n\nThe current deck (for context; it may be empty):\n<context>\n${outline(d)}\n</context>` }],
    schema: SLIDES_SCHEMA,
    effort: 'medium',
    signal,
  });
  return (JSON.parse(answer) as { slides: SlideSpec[] }).slides;
}

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
      },
      {
        id: 'improve', icon: 'pen', label: t('ai.stage.improve'), needsContext: true,
        run: async (ai, ctx, signal) => {
          const d = b.deck();
          const i = b.active();
          const s = d.slides[i];
          const specs = await askSlides(ai, `Rewrite this slide to make it clearer and stronger, same subject and same language, as one slide:\n${slideText(s, i)}`, d, signal);
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
          const lines = (payload || answer).split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
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
