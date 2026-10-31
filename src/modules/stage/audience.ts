// Who is watching? (Martin, 2026-10-31): pick the audience (children, seniors, investors, a military briefing …)
// and Claude adapts the whole deck for them: the words, how much is on each slide, the tone, the examples, the
// size of the text, the theme, the animations and the speaker notes. The slides keep their places, pictures and
// tables; the deck before is kept so the person can compare, then keep it or go back.

import type { AiApi } from '../../shell/contract';
import { defaultSize, itemText, type Deck, type DeckTheme, type Item, type ShapeItem, type Slide } from '../../formats/slides';
import { autoAnimate } from './anim';

export type Mood = 'lively' | 'calm' | 'none';

export interface Audience {
  id: string;
  emoji: string;
  names: Record<'en' | 'fr' | 'es' | 'pt' | 'de', string>;
  /** How the deck should change, for Claude. */
  guide: string;
  /** Text size compared with the theme's: bigger for children, seniors and low vision. */
  scale: number;
  /** Animations after the change: lively, calm, or none at all (people who prefer no motion, formal briefings). */
  mood: Mood;
}

export const AUDIENCES: Audience[] = [
  { id: 'kids', emoji: '🧒', scale: 1.25, mood: 'lively', names: { en: 'Children (6–10)', fr: 'Enfants (6–10 ans)', es: 'Niños (6–10)', pt: 'Crianças (6–10)', de: 'Kinder (6–10)' },
    guide: 'Children aged 6 to 10. Very simple everyday words, short sentences, one idea per slide, at most 3 bullets of 6 words or fewer. Explain with comparisons from their life (school, games, animals, food). Start each title with one fitting emoji. Warm, playful, encouraging tone; ask them a question now and then. A bright, colorful, playful theme.' },
  { id: 'teens', emoji: '🎧', scale: 1.1, mood: 'lively', names: { en: 'Teenagers', fr: 'Adolescents', es: 'Adolescentes', pt: 'Adolescentes', de: 'Jugendliche' },
    guide: 'Teenagers (12 to 17). Direct, lively, never childish. Short punchy bullets, real examples from their world (phones, music, sport, social media), a surprising fact per part. Modern bold theme.' },
  { id: 'students', emoji: '🎓', scale: 1, mood: 'calm', names: { en: 'Students', fr: 'Étudiants', es: 'Estudiantes', pt: 'Estudantes', de: 'Studierende' },
    guide: 'University or college students. Clear structure, key terms defined once, examples and a short summary slide at the end so they can revise. Clean modern theme.' },
  { id: 'teachers', emoji: '🍎', scale: 1, mood: 'calm', names: { en: 'Teachers', fr: 'Enseignants', es: 'Docentes', pt: 'Professores', de: 'Lehrkräfte' },
    guide: 'Teachers. Practical: what to do in class, time needed, materials, how to check learning. Respectful, peer-to-peer tone. Clear calm theme.' },
  { id: 'parents', emoji: '👪', scale: 1.05, mood: 'calm', names: { en: 'Parents', fr: 'Parents', es: 'Padres', pt: 'Pais', de: 'Eltern' },
    guide: 'Parents. Plain words, what it means for their child, what they can do at home, dates and contacts. Warm reassuring tone. Friendly light theme.' },
  { id: 'seniors', emoji: '👵', scale: 1.3, mood: 'calm', names: { en: 'Seniors', fr: 'Aînés', es: 'Personas mayores', pt: 'Idosos', de: 'Senioren' },
    guide: 'Older people. No jargon or English buzzwords, no abbreviations, short sentences, at most 4 bullets, one idea per slide, concrete everyday examples. Polite, patient, warm tone. A light theme with strong contrast and easy-to-read fonts.' },
  { id: 'public', emoji: '🌍', scale: 1.05, mood: 'calm', names: { en: 'General public', fr: 'Grand public', es: 'Público general', pt: 'Público geral', de: 'Breite Öffentlichkeit' },
    guide: 'The general public, no special knowledge. Plain language, explain every technical word, relatable examples, why it matters to them. Friendly clear theme.' },
  { id: 'beginners', emoji: '🌱', scale: 1.1, mood: 'calm', names: { en: 'Beginners', fr: 'Débutants', es: 'Principiantes', pt: 'Iniciantes', de: 'Einsteiger' },
    guide: 'Complete beginners in the subject. Start from the basics, one new idea per slide, define terms, step-by-step, a recap at the end. Encouraging tone.' },
  { id: 'experts', emoji: '🧠', scale: 0.95, mood: 'none', names: { en: 'Experts', fr: 'Experts', es: 'Expertos', pt: 'Especialistas', de: 'Fachleute' },
    guide: 'Experts in the field. Skip the basics, use the precise technical terms, more detail and data per slide (up to 6 bullets), sources and limits. Sober, precise tone. Sober theme.' },
  { id: 'engineers', emoji: '⚙️', scale: 0.95, mood: 'calm', names: { en: 'Engineers & technicians', fr: 'Ingénieurs et techniciens', es: 'Ingenieros y técnicos', pt: 'Engenheiros e técnicos', de: 'Ingenieure & Techniker' },
    guide: 'Engineers and technicians. How it works, specifications, numbers with units, trade-offs, steps; diagrams over prose. Factual tone. Clean technical theme.' },
  { id: 'scientists', emoji: '🔬', scale: 0.95, mood: 'none', names: { en: 'Scientists & researchers', fr: 'Scientifiques et chercheurs', es: 'Científicos e investigadores', pt: 'Cientistas e pesquisadores', de: 'Wissenschaftler & Forschende' },
    guide: 'Scientists and researchers. Question, method, results, limits, next steps; precise wording, numbers and uncertainty, cite sources in notes. Neutral academic tone and theme.' },
  { id: 'health', emoji: '🩺', scale: 1, mood: 'none', names: { en: 'Doctors & health staff', fr: 'Médecins et soignants', es: 'Médicos y personal sanitario', pt: 'Médicos e profissionais de saúde', de: 'Ärzte & Pflegepersonal' },
    guide: 'Doctors, nurses and health staff. Clinical precision, evidence and numbers, risks and benefits, what to do in practice. Calm professional tone. Clean light theme.' },
  { id: 'investors', emoji: '💰', scale: 1, mood: 'calm', names: { en: 'Investors', fr: 'Investisseurs', es: 'Inversores', pt: 'Investidores', de: 'Investoren' },
    guide: 'Investors. Problem, solution, market size, traction with numbers, business model, team, what you ask for and what they get. Confident, concise tone; one strong number per slide. Elegant premium theme.' },
  { id: 'board', emoji: '🏛️', scale: 1.05, mood: 'none', names: { en: 'Executives & board', fr: 'Direction et conseil', es: 'Dirección y consejo', pt: 'Diretoria e conselho', de: 'Geschäftsleitung & Vorstand' },
    guide: 'Executives and a board. Bottom line first, at most 3 bullets per slide, key numbers, risks, the decision you need from them. Formal, brief tone. Sober corporate theme.' },
  { id: 'managers', emoji: '📋', scale: 1, mood: 'calm', names: { en: 'Managers', fr: 'Managers', es: 'Gerentes', pt: 'Gestores', de: 'Führungskräfte' },
    guide: 'Managers. Goals, results, who does what, deadlines, budget, next steps. Professional, action-oriented tone. Corporate theme.' },
  { id: 'team', emoji: '🤝', scale: 1, mood: 'lively', names: { en: 'My team', fr: 'Mon équipe', es: 'Mi equipo', pt: 'Minha equipe', de: 'Mein Team' },
    guide: 'Colleagues in my own team. Friendly and direct ("we"), what changes for us, thanks for the work done, clear next actions. Warm, energetic theme.' },
  { id: 'clients', emoji: '🛍️', scale: 1.05, mood: 'calm', names: { en: 'Clients', fr: 'Clients', es: 'Clientes', pt: 'Clientes', de: 'Kunden' },
    guide: 'Existing clients. Benefits for them before features, their words not internal jargon, proof and examples, how to get help. Respectful, service tone. Polished friendly theme.' },
  { id: 'prospects', emoji: '🎯', scale: 1.05, mood: 'lively', names: { en: 'Sales prospects', fr: 'Prospects', es: 'Clientes potenciales', pt: 'Clientes potenciais', de: 'Interessenten' },
    guide: 'Sales prospects. Their problem first, the benefit in one line per slide, a short customer story, numbers, a clear call to action at the end. Persuasive, positive tone. Bold attractive theme.' },
  { id: 'partners', emoji: '🔗', scale: 1, mood: 'calm', names: { en: 'Partners', fr: 'Partenaires', es: 'Socios', pt: 'Parceiros', de: 'Partner' },
    guide: 'Business partners. Shared goals, what each side brings and gets, timeline, next steps. Cooperative professional tone. Corporate theme.' },
  { id: 'government', emoji: '🏢', scale: 1, mood: 'none', names: { en: 'Government & officials', fr: 'Gouvernement et élus', es: 'Gobierno y autoridades', pt: 'Governo e autoridades', de: 'Behörden & Politik' },
    guide: 'Government officials and elected people. Public interest, rules and compliance, costs and impact on citizens, clear recommendations. Formal neutral tone. Sober official theme.' },
  { id: 'military', emoji: '🎖️', scale: 1, mood: 'none', names: { en: 'Military briefing', fr: 'Briefing militaire', es: 'Sesión militar', pt: 'Briefing militar', de: 'Militärisches Briefing' },
    guide: 'A military briefing. Bottom line up front, then situation, mission, execution, support and command; short bullets, exact times and places, no filler, no jokes. Formal and direct. A military or sober dark theme.' },
  { id: 'press', emoji: '📰', scale: 1.05, mood: 'calm', names: { en: 'Journalists & press', fr: 'Journalistes et presse', es: 'Periodistas y prensa', pt: 'Jornalistas e imprensa', de: 'Journalisten & Presse' },
    guide: 'Journalists. The news in one sentence first, key facts and numbers, a quotable line, contacts. Clear factual tone. Clean theme.' },
  { id: 'conference', emoji: '🎤', scale: 1.1, mood: 'lively', names: { en: 'Conference audience', fr: 'Public de conférence', es: 'Público de conferencia', pt: 'Público de conferência', de: 'Konferenzpublikum' },
    guide: 'A large conference audience. Few words, big ideas, a story arc, a memorable takeaway per part, readable from the back of the room. Inspiring tone. Striking theme.' },
  { id: 'jury', emoji: '⚖️', scale: 1, mood: 'calm', names: { en: 'Jury or interview panel', fr: 'Jury ou entretien', es: 'Jurado o entrevista', pt: 'Banca ou entrevista', de: 'Jury oder Prüfungskommission' },
    guide: 'A jury or interview panel. Goals, method, results and what I learned; show skills with proof; structured and confident. Polished sober theme.' },
  { id: 'learners', emoji: '🗣️', scale: 1.15, mood: 'calm', names: { en: 'Non-native speakers', fr: 'Non-francophones / langue seconde', es: 'Hablantes no nativos', pt: 'Falantes não nativos', de: 'Nicht-Muttersprachler' },
    guide: 'People for whom the language of the slides is a second language. Plain language: common words, short sentences, no idioms, slang or puns, one idea per bullet, key words repeated the same way. Calm clear theme.' },
  { id: 'lowvision', emoji: '👓', scale: 1.4, mood: 'none', names: { en: 'Low vision (accessible)', fr: 'Malvoyants (accessible)', es: 'Baja visión (accesible)', pt: 'Baixa visão (acessível)', de: 'Sehbehinderung (barrierefrei)' },
    guide: 'People with low vision. Very few words per slide (at most 3 bullets), large text, the strongest contrast, no information given only by color, describe pictures in the notes. A high-contrast theme with plain fonts.' },
  { id: 'community', emoji: '🏘️', scale: 1.05, mood: 'calm', names: { en: 'Community or association', fr: 'Association ou communauté', es: 'Asociación o comunidad', pt: 'Associação ou comunidade', de: 'Verein oder Gemeinde' },
    guide: 'Members of a community, club or association. Warm inclusive "we", what it means for members, how to take part, dates and places. Friendly theme.' },
];

export const audienceName = (a: Audience, lang: string) => a.names[lang as keyof Audience['names']] ?? a.names.en;

/** A free audience the person describes in their own words ("farmers in Quebec", "my grandmother's choir"). */
export function customAudience(text: string): Audience {
  const label = text.trim().slice(0, 60);
  return { id: 'custom', emoji: '✨', scale: 1, mood: 'calm', names: { en: label, fr: label, es: label, pt: label, de: label }, guide: label };
}

type TextItem = ShapeItem;
/** The items whose words Claude may rewrite: text boxes and placeholders, not tables, pictures, stickers or footers. */
const rewritable = (it: Item): it is TextItem => it.kind === 'shape' && !!itemText(it).trim()
  && !it.name?.startsWith('Sticker') && it.name !== 'Slide number' && it.name !== 'Footer' && it.name !== 'Date';

const SCHEMA = (themes: DeckTheme[]) => ({
  type: 'object',
  properties: {
    theme: { type: 'string', enum: themes.map(th => th.id) },
    slides: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slide: { type: 'integer' },
          texts: {
            type: 'array',
            items: {
              type: 'object',
              properties: { item: { type: 'integer' }, lines: { type: 'array', items: { type: 'string' } } },
              required: ['item', 'lines'],
              additionalProperties: false,
            },
          },
          notes: { type: 'string' },
        },
        required: ['slide', 'texts', 'notes'],
        additionalProperties: false,
      },
    },
    summary: { type: 'string' },
  },
  required: ['theme', 'slides', 'summary'],
  additionalProperties: false,
});

const RULES = [
  'You adapt an existing presentation to a new audience, like a great speaker who knows the people in the room.',
  'Rewrite the words of each text item for that audience: vocabulary, sentence length, how much is on the slide, tone, and examples that speak to them. Keep the meaning, the facts and numbers, the order of the slides and the language of the slides.',
  'Each text item is given by number with its lines; bullet lines start with "- " (two spaces before for a sub-point). Return the new lines for every item you were given, with the same numbers. A title stays one short line. Keep diagram pieces to 2 to 5 words.',
  'Rewrite the speaker notes for the audience too: what the speaker says, 2 to 5 natural sentences, with an example or question that fits them.',
  'Choose "theme": the id of the theme in the list that suits this audience and subject best (keep the current one if it already fits).',
  'Write "summary" in the language given for it: one sentence on what you changed for this audience.',
].join('\n');

const themeList = (themes: DeckTheme[]) => themes.map(th => `${th.id}: ${th.name} (${th.group ?? 'classic'}, ${th.dark ? 'dark' : 'light'}, fonts ${th.head} / ${th.body})`).join('\n');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The item's text as lines, bullets marked "- " so Claude sees the structure. */
export function itemLines(it: TextItem): string[] {
  const out: string[] = [];
  const re = /<(li|p|h\d)[^>]*>|<\/(ul|ol)>|<(ul|ol)[^>]*>/gi;
  let depth = 0, m: RegExpExecArray | null, last = 0;
  const html = it.html;
  const push = (chunk: string) => {
    const text = chunk.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
    if (text) out.push(depth > 0 ? `${'  '.repeat(depth - 1)}- ${text}` : text);
  };
  while ((m = re.exec(html))) {
    push(html.slice(last, m.index));
    last = re.lastIndex;
    if (m[3]) depth++;
    else if (m[2]) depth = Math.max(0, depth - 1);
  }
  push(html.slice(last));
  return out;
}

/** HTML for an item from Claude's lines: bullets become a list (sub-points nested), the rest paragraphs, at `pt`. */
export function linesHtml(lines: string[], pt: (level: number) => number | null): string {
  const span = (text: string, level: number) => { const size = pt(level); return size ? `<span style="font-size: ${size}pt">${esc(text)}</span>` : esc(text); };
  let html = '';
  let depth = 0;
  const close = (to: number) => { while (depth > to) { html += '</li></ul>'; depth--; } };
  for (const raw of lines) {
    const bullet = raw.match(/^(\s*)[-•*]\s+(.*)$/);
    if (!bullet) { close(0); if (raw.trim()) html += `<p>${span(raw.trim(), 0)}</p>`; continue; }
    const text = bullet[2].trim();
    if (!text) continue;
    // A sub-point goes one level deeper at most, inside the point above it.
    const level = Math.min(4, Math.floor(bullet[1].replace(/\t/g, '  ').length / 2) + 1, depth + 1);
    if (level > depth) { html += '<ul>'; depth++; }
    else { close(level); html += '</li>'; }
    html += `<li><p>${span(text, level - 1)}</p>`;
  }
  close(0);
  return html || '<p></p>';
}

export interface Adapted { deck: Deck; summary: string; theme?: DeckTheme }

/**
 * Asks the AI to adapt the deck to the audience. Gives a new deck (the old one is untouched): rewritten texts at
 * the audience's text size, new notes, the theme it picked and calm, lively or no animations.
 */
export async function adaptDeck(ai: AiApi, deck: Deck, audience: Audience, themes: DeckTheme[], uiLanguage: string, retheme: (d: Deck, th: DeckTheme) => Deck, signal?: AbortSignal): Promise<Adapted> {
  const slides = deck.slides.slice(0, 60);
  const listed = slides.map((s, i) => {
    const items = s.items.map((it, n) => (rewritable(it) ? `  item ${n} (${it.role ?? (it.name?.startsWith('Diagram') ? 'diagram piece' : 'text box')}):\n${itemLines(it).map(l => `    ${l}`).join('\n')}` : '')).filter(Boolean);
    return `Slide ${i + 1}:\n${items.join('\n') || '  (no text)'}${s.notes.trim() ? `\n  notes: ${s.notes.trim().replace(/\n/g, ' ')}` : ''}`;
  }).join('\n\n');
  const answer = await ai.ask({
    system: `${RULES}\n\nThe audience: ${audience.guide}\n\nThemes:\n${themeList(themes)}`,
    messages: [{ role: 'user', content: `Current theme: ${deck.theme.id}. Write the summary in ${uiLanguage}.\n\n<presentation>\n${listed}\n</presentation>` }],
    schema: SCHEMA(themes) as unknown as Record<string, unknown>,
    effort: 'medium',
    signal,
  });
  const got = JSON.parse(answer) as { theme: string; slides: { slide: number; texts: { item: number; lines: string[] }[]; notes: string }[]; summary: string };
  const bySlide = new Map(got.slides.map(g => [g.slide - 1, g]));
  const next: Slide[] = deck.slides.map((s, i) => {
    const g = bySlide.get(i);
    let out: Slide = s;
    if (g) {
      const texts = new Map(g.texts.map(x => [x.item, x.lines.filter(l => l.trim())]));
      out = {
        ...s,
        notes: g.notes.trim() || s.notes,
        items: s.items.map((it, n) => {
          const lines = texts.get(n);
          if (!rewritable(it) || !lines?.length) return it;
          const size = (level: number) => (audience.scale === 1 ? null : Math.round(defaultSize(it.role, s.layout, level) * audience.scale));
          const list = /<(ul|ol)\b/i.test(it.html) || lines.some(l => /^\s*[-•*]\s/.test(l));
          const fixed = list ? lines.map(l => (/^\s*[-•*]\s/.test(l) ? l : `- ${l}`)) : lines.map(l => l.replace(/^\s*[-•*]\s+/, ''));
          return { ...it, html: linesHtml(it.role === 'title' ? fixed.slice(0, 1) : fixed, size), autofit: it.autofit ?? !!it.role };
        }),
      };
    }
    if (audience.mood === 'none') return out.anims?.length ? { ...out, anims: undefined } : out;
    return autoAnimate(out, audience.mood);
  });
  let adapted: Deck = { ...deck, slides: next };
  const theme = themes.find(th => th.id === got.theme);
  if (theme && theme.id !== deck.theme.id) adapted = retheme(adapted, theme);
  return { deck: adapted, summary: got.summary.trim(), theme: theme && theme.id !== deck.theme.id ? theme : undefined };
}
