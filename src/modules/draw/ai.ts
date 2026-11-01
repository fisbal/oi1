// Office Draw with an AI: a drawing described in words becomes real, editable shapes (not a flat picture), placed
// on the page. The answer is checked shape by shape (cleanShape) before anything is drawn.

import type { AiApi } from '../../shell/contract';
import { jsonOf } from '../assistant/plan';
import { cleanShape, newId, SHAPE_GEOMS, type Drawing, type Shape } from './model';

const KINDS = ['rect', 'roundRect', 'ellipse', 'triangle', 'diamond', 'star5', 'heart', 'hexagon', 'pentagon', 'rightArrow', 'line', 'arrow', 'text'] as const;

const SCHEMA: Record<string, unknown> = {
  type: 'object', additionalProperties: false, required: ['shapes'],
  properties: {
    shapes: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['type', 'x', 'y', 'w', 'h', 'fill', 'color', 'text'],
        properties: {
          type: { type: 'string', enum: KINDS }, x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' },
          fill: { type: 'string' }, color: { type: 'string' }, text: { type: 'string' },
        },
      },
    },
  },
};

const LANG: Record<string, string> = { en: 'English', fr: 'French', es: 'Spanish', pt: 'Portuguese', de: 'German' };

function system(d: Drawing) {
  return `You draw for Office Draw. The page is ${d.w} wide and ${d.h} high, (0,0) at the top left. Answer with shapes only.
Each shape: "type" (${KINDS.join(', ')}), its box x, y, w, h in page units, "fill" (a #hex colour or "none"), "color" (the outline or line colour, #hex) and "text" (a short label inside it, or "").
For "line" and "arrow", the line goes from (x, y) to (x + w, y + h); w or h can be negative. For "text", the words go in "text" and h is the letter height.
Draw what is asked clearly with 3 to 40 shapes, well spaced inside the page, in pleasant colours. Shapes listed later are drawn on top.`;
}

/** The request as one short readable message, for an AI's public chat site. */
function chat(d: Drawing, what: string, lang: string) {
  return `Hello! Please draw "${what}" for my drawing app Office Draw, as simple shapes on a page ${d.w} wide and ${d.h} high ((0,0) top left), labels in ${LANG[lang] ?? 'English'}.
Answer with only one JSON code block like: {"shapes":[{"type":"rect","x":100,"y":100,"w":300,"h":200,"fill":"#BFD7FF","color":"#2B2D42","text":"Label"}]}
"type" is one of: ${KINDS.join(', ')}. For line and arrow the line goes from (x,y) to (x+w,y+h).`;
}

/** The AI's shapes made into Office Draw shapes. */
export function shapesFromAnswer(answer: string): Shape[] {
  let raw: unknown;
  try { raw = jsonOf(answer); } catch { raw = jsonOf(answer.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1')); }
  const list = (raw as { shapes?: unknown[] })?.shapes;
  if (!Array.isArray(list)) return [];
  const out: Shape[] = [];
  for (const it of list.slice(0, 200)) {
    const s = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
    const x = num(s.x), y = num(s.y), w = num(s.w), h = num(s.h);
    const fill = typeof s.fill === 'string' && s.fill !== 'none' ? s.fill : null;
    const color = typeof s.color === 'string' && s.color !== 'none' ? s.color : '#2B2D42';
    const text = typeof s.text === 'string' ? s.text : '';
    let shape: Shape | null = null;
    if (s.type === 'line' || s.type === 'arrow') shape = cleanShape({ kind: 'line', x1: x, y1: y, x2: x + w, y2: y + h, head: s.type === 'arrow' ? 'end' : 'none', stroke: color, width: 4 });
    else if (s.type === 'text') shape = cleanShape({ kind: 'text', x, y, w: Math.max(w, 40), h: Math.max(h, 20), text, size: Math.max(12, Math.min(200, h * 0.8 || 32)), fill: color, stroke: null, width: 0, bold: true, align: 'center' });
    else if ((SHAPE_GEOMS as string[]).includes(String(s.type))) shape = cleanShape({ kind: 'geom', geom: s.type, x, y, w: Math.abs(w) || 60, h: Math.abs(h) || 60, fill, stroke: color, width: 3, text, textColor: '#1B1B1F' });
    if (shape) out.push({ ...shape, id: newId() });
  }
  return out;
}

export async function drawWithAi(ai: AiApi, d: Drawing, what: string, lang: string, signal?: AbortSignal, onText?: (n: number) => void): Promise<Shape[]> {
  const answer = await ai.ask({
    system: system(d), schema: SCHEMA, effort: 'medium', signal,
    messages: [{ role: 'user', content: `Draw: ${what}\nLabels in ${LANG[lang] ?? 'English'}.` }],
    chatPrompt: chat(d, what, lang),
    onText: so => onText?.(so.length),
  });
  return shapesFromAnswer(answer);
}
