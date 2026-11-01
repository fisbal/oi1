// Ready drawings for Office Draw: diagrams, plans and cards made offline in one click, every part editable.
// Words are in English and French; the other languages are translated on the device when the template is placed.

import type { Geom } from '../../formats/slides';
import { newId, type Drawing, type GeomShape, type LineShape, type Shape, type TextShape } from './model';

type L = [en: string, fr: string];
export interface Template { id: string; icon: string; build: (d: Drawing, w: (l: L) => string) => Shape[] }

const box = (geom: Geom, x: number, y: number, w: number, h: number, fill: string, text = '', extra: Partial<GeomShape> = {}): GeomShape =>
  ({ id: newId(), kind: 'geom', geom, x, y, w, h, rot: 0, fill, stroke: '#2B2D42', width: 2, dash: 'solid', opacity: 1, text, textColor: '#1B1B1F', ...extra });
const line = (x1: number, y1: number, x2: number, y2: number, head: LineShape['head'] = 'end', color = '#2B2D42'): LineShape =>
  ({ id: newId(), kind: 'line', x1, y1, x2, y2, head, fill: null, stroke: color, width: 3, dash: 'solid', opacity: 1 });
const text = (t: string, x: number, y: number, w: number, size = 40, extra: Partial<TextShape> = {}): TextShape =>
  ({ id: newId(), kind: 'text', x, y, w, h: size * 1.3 * t.split('\n').length, rot: 0, text: t, font: 'Inter', size, bold: true, italic: false, align: 'center', fill: '#1B1B1F', stroke: null, width: 0, dash: 'solid', opacity: 1, ...extra });

/** Lays `n` boxes in a row across the page and links them with arrows. */
function chain(d: Drawing, labels: string[], geom: Geom, colors: string[], y?: number): Shape[] {
  const n = labels.length, gap = d.w * 0.04, bw = (d.w * 0.9 - gap * (n - 1)) / n, bh = Math.min(d.h * 0.22, bw * 0.7);
  const top = y ?? d.h / 2 - bh / 2, x0 = d.w * 0.05;
  const out: Shape[] = [];
  labels.forEach((l, i) => {
    out.push(box(geom, x0 + i * (bw + gap), top, bw, bh, colors[i % colors.length], l));
    if (i < n - 1) out.push(line(x0 + i * (bw + gap) + bw + 4, top + bh / 2, x0 + (i + 1) * (bw + gap) - 4, top + bh / 2));
  });
  return out;
}

const WARM = ['#FDE2B4', '#FCC6A4', '#F9A8A8', '#D7C4F2', '#B8E0D2', '#BFD7FF'];
const COOL = ['#CDE7F0', '#BFD7FF', '#D7C4F2', '#C8F0DC', '#FFF1B8'];

export const TEMPLATES: Template[] = [
  { id: 'flow', icon: '🔀', build: (d, w) => [
    box('roundRect', d.w * 0.4, d.h * 0.06, d.w * 0.2, d.h * 0.12, '#C8F0DC', w(['Start', 'Début'])),
    line(d.w / 2, d.h * 0.18, d.w / 2, d.h * 0.27),
    box('rect', d.w * 0.38, d.h * 0.28, d.w * 0.24, d.h * 0.13, '#BFD7FF', w(['Do the step', 'Faire l’étape'])),
    line(d.w / 2, d.h * 0.41, d.w / 2, d.h * 0.48),
    box('diamond', d.w * 0.38, d.h * 0.48, d.w * 0.24, d.h * 0.2, '#FFF1B8', w(['Done?', 'Fini ?'])),
    line(d.w * 0.62, d.h * 0.58, d.w * 0.75, d.h * 0.58), text(w(['No', 'Non']), d.w * 0.62, d.h * 0.52, d.w * 0.12, 24),
    box('rect', d.w * 0.75, d.h * 0.52, d.w * 0.2, d.h * 0.12, '#F9A8A8', w(['Fix it', 'Corriger'])),
    line(d.w / 2, d.h * 0.68, d.w / 2, d.h * 0.78), text(w(['Yes', 'Oui']), d.w * 0.5, d.h * 0.69, d.w * 0.1, 24, { align: 'left' }),
    box('roundRect', d.w * 0.4, d.h * 0.79, d.w * 0.2, d.h * 0.12, '#C8F0DC', w(['End', 'Fin'])),
  ] },
  { id: 'mind', icon: '🧠', build: (d, w) => {
    const cx = d.w / 2, cy = d.h / 2, out: Shape[] = [box('ellipse', cx - d.w * 0.13, cy - d.h * 0.1, d.w * 0.26, d.h * 0.2, '#FFE08A', w(['Main idea', 'Idée centrale']))];
    const words = [w(['Why', 'Pourquoi']), w(['Who', 'Qui']), w(['How', 'Comment']), w(['When', 'Quand']), w(['Where', 'Où']), w(['What', 'Quoi'])];
    words.forEach((t, i) => {
      const a = (i / words.length) * Math.PI * 2 - Math.PI / 2, rx = d.w * 0.34, ry = d.h * 0.36;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      out.push(line(cx + Math.cos(a) * d.w * 0.12, cy + Math.sin(a) * d.h * 0.09, x - Math.cos(a) * d.w * 0.08, y - Math.sin(a) * d.h * 0.06, 'none', '#7B6CF6'));
      out.push(box('roundRect', x - d.w * 0.08, y - d.h * 0.06, d.w * 0.16, d.h * 0.12, WARM[i % WARM.length], t));
    });
    return out;
  } },
  { id: 'org', icon: '👥', build: (d, w) => {
    const bw = d.w * 0.18, bh = d.h * 0.13, out: Shape[] = [box('roundRect', d.w / 2 - bw / 2, d.h * 0.08, bw, bh, '#FFE08A', w(['Director', 'Direction']))];
    const xs = [0.2, 0.5, 0.8].map(f => d.w * f);
    out.push(line(d.w / 2, d.h * 0.08 + bh, d.w / 2, d.h * 0.32, 'none'), line(xs[0], d.h * 0.32, xs[2], d.h * 0.32, 'none'));
    xs.forEach((x, i) => {
      out.push(line(x, d.h * 0.32, x, d.h * 0.4, 'none'), box('roundRect', x - bw / 2, d.h * 0.4, bw, bh, COOL[i], [w(['Sales', 'Ventes']), w(['Product', 'Produit']), w(['Finance', 'Finances'])][i]));
      out.push(line(x, d.h * 0.4 + bh, x, d.h * 0.66, 'none'), box('rect', x - bw * 0.45, d.h * 0.66, bw * 0.9, bh * 0.85, '#FFFFFF', w(['Team', 'Équipe'])));
    });
    return out;
  } },
  { id: 'timeline', icon: '📅', build: (d, w) => {
    const out: Shape[] = [line(d.w * 0.05, d.h / 2, d.w * 0.95, d.h / 2, 'end')];
    for (let i = 0; i < 5; i++) {
      const x = d.w * (0.12 + i * 0.19), up = i % 2 === 0;
      out.push(box('ellipse', x - 14, d.h / 2 - 14, 28, 28, WARM[i]), line(x, d.h / 2 + (up ? -16 : 16), x, d.h / 2 + (up ? -d.h * 0.14 : d.h * 0.14), 'none'));
      out.push(box('roundRect', x - d.w * 0.08, up ? d.h * 0.18 : d.h * 0.66, d.w * 0.16, d.h * 0.16, WARM[i], `${2022 + i}\n${w(['Step', 'Étape'])} ${i + 1}`));
    }
    return out;
  } },
  { id: 'kanban', icon: '🗂️', build: (d, w) => {
    const cols = [w(['To do', 'À faire']), w(['Doing', 'En cours']), w(['Done', 'Fait'])], cw = d.w * 0.29;
    return cols.flatMap((c, i) => {
      const x = d.w * 0.03 + i * (cw + d.w * 0.035);
      return [box('roundRect', x, d.h * 0.05, cw, d.h * 0.9, ['#F4F1EA', '#EEF4FB', '#EEF8F0'][i], '', { stroke: '#C9C3B6' }), text(c, x, d.h * 0.08, cw, 34),
        ...[0, 1, 2].map(k => box('roundRect', x + cw * 0.08, d.h * (0.2 + k * 0.22), cw * 0.84, d.h * 0.17, ['#FFF1B8', '#BFD7FF', '#C8F0DC'][i], `${w(['Task', 'Tâche'])} ${i * 3 + k + 1}`))];
    });
  } },
  { id: 'venn', icon: '⭕', build: (d, w) => {
    const r = Math.min(d.w, d.h) * 0.3, cx = d.w / 2, cy = d.h / 2;
    return [
      box('ellipse', cx - r * 1.45, cy - r * 0.95, r * 2, r * 2, '#F9A8A8', '', { opacity: 0.6 }),
      box('ellipse', cx - r * 0.55, cy - r * 0.95, r * 2, r * 2, '#BFD7FF', '', { opacity: 0.6 }),
      box('ellipse', cx - r, cy - r * 0.2, r * 2, r * 2, '#C8F0DC', '', { opacity: 0.6 }),
      text('A', cx - r * 1.1, cy - r * 0.3, r * 0.5, 48), text('B', cx + r * 0.6, cy - r * 0.3, r * 0.5, 48), text('C', cx - r * 0.25, cy + r * 0.9, r * 0.5, 48),
      text(w(['All', 'Tous']), cx - r * 0.3, cy + r * 0.1, r * 0.6, 26),
    ];
  } },
  { id: 'swot', icon: '🧭', build: (d, w) => {
    const L2 = [w(['Strengths', 'Forces']), w(['Weaknesses', 'Faiblesses']), w(['Opportunities', 'Opportunités']), w(['Threats', 'Menaces'])];
    const C = ['#C8F0DC', '#F9A8A8', '#BFD7FF', '#FFF1B8'];
    return L2.map((l, i) => box('rect', d.w * (0.05 + (i % 2) * 0.45), d.h * (0.05 + Math.floor(i / 2) * 0.45), d.w * 0.45, d.h * 0.45, C[i], l));
  } },
  { id: 'pyramid', icon: '🔺', build: (d, w) => {
    const L5 = [w(['Vision', 'Vision']), w(['Goals', 'Objectifs']), w(['Plans', 'Plans']), w(['Tasks', 'Tâches']), w(['Base', 'Base'])];
    return L5.map((l, i) => { const ww = d.w * (0.18 + i * 0.16), hh = d.h * 0.16; return box('rect', d.w / 2 - ww / 2, d.h * 0.07 + i * hh * 1.05, ww, hh, WARM[i], l); });
  } },
  { id: 'cycle', icon: '🔄', build: (d, w) => {
    const L4 = [w(['Plan', 'Planifier']), w(['Do', 'Faire']), w(['Check', 'Vérifier']), w(['Act', 'Agir'])];
    const cx = d.w / 2, cy = d.h / 2, rx = d.w * 0.28, ry = d.h * 0.3, out: Shape[] = [];
    L4.forEach((l, i) => {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      out.push(box('ellipse', x - d.w * 0.09, y - d.h * 0.09, d.w * 0.18, d.h * 0.18, COOL[i], l));
      const b = a + Math.PI / 4, x1 = cx + Math.cos(b - 0.35) * rx * 0.95, y1 = cy + Math.sin(b - 0.35) * ry * 0.95, x2 = cx + Math.cos(b + 0.35) * rx * 0.95, y2 = cy + Math.sin(b + 0.35) * ry * 0.95;
      out.push(line(x1, y1, x2, y2, 'end', '#7B6CF6'));
    });
    return out;
  } },
  { id: 'funnel', icon: '🔻', build: (d, w) => {
    const L4 = [w(['Visitors', 'Visiteurs']), w(['Interested', 'Intéressés']), w(['Buyers', 'Acheteurs']), w(['Fans', 'Fans'])];
    return L4.map((l, i) => { const ww = d.w * (0.8 - i * 0.17), hh = d.h * 0.2; return box('roundRect', d.w / 2 - ww / 2, d.h * 0.06 + i * hh * 1.1, ww, hh, ['#7B6CF6', '#9B8CFF', '#BDB2FF', '#DED8FF'][i], l, { textColor: i < 2 ? '#FFFFFF' : '#1B1B1F' }); });
  } },
  { id: 'process', icon: '➡️', build: (d, w) => chain(d, [w(['Idea', 'Idée']), w(['Plan', 'Plan']), w(['Build', 'Faire']), w(['Test', 'Tester']), w(['Launch', 'Lancer'])], 'chevron', WARM) },
  { id: 'steps', icon: '🪜', build: (d, w) => chain(d, ['1', '2', '3', '4'].map(n => `${w(['Step', 'Étape'])} ${n}`), 'roundRect', COOL) },
  { id: 'eisenhower', icon: '⏱️', build: (d, w) => {
    const L4 = [w(['Urgent + important: do it', 'Urgent + important : faire']), w(['Important: plan it', 'Important : planifier']), w(['Urgent: delegate', 'Urgent : déléguer']), w(['Neither: drop it', 'Ni l’un ni l’autre : abandonner'])];
    return L4.map((l, i) => box('roundRect', d.w * (0.05 + (i % 2) * 0.46), d.h * (0.05 + Math.floor(i / 2) * 0.46), d.w * 0.44, d.h * 0.44, ['#F9A8A8', '#C8F0DC', '#FFF1B8', '#E5E5E5'][i], l));
  } },
  { id: 'floor', icon: '🏠', build: (d, w) => {
    const o = { fill: '#FFFFFF', width: 6 } as Partial<GeomShape>;
    return [
      box('rect', d.w * 0.05, d.h * 0.06, d.w * 0.5, d.h * 0.5, '#FFFFFF', w(['Living room', 'Salon']), o),
      box('rect', d.w * 0.55, d.h * 0.06, d.w * 0.4, d.h * 0.35, '#FFFFFF', w(['Kitchen', 'Cuisine']), o),
      box('rect', d.w * 0.55, d.h * 0.41, d.w * 0.4, d.h * 0.53, '#FFFFFF', w(['Bedroom', 'Chambre']), o),
      box('rect', d.w * 0.05, d.h * 0.56, d.w * 0.25, d.h * 0.38, '#FFFFFF', w(['Bathroom', 'Salle de bain']), o),
      box('rect', d.w * 0.3, d.h * 0.56, d.w * 0.25, d.h * 0.38, '#FFFFFF', w(['Entrance', 'Entrée']), o),
    ];
  } },
  { id: 'web', icon: '🖥️', build: (d, w) => [
    box('rect', d.w * 0.04, d.h * 0.05, d.w * 0.92, d.h * 0.1, '#E5E5E5', w(['Logo     Menu     Contact', 'Logo     Menu     Contact'])),
    box('rect', d.w * 0.04, d.h * 0.18, d.w * 0.92, d.h * 0.36, '#BFD7FF', w(['Big title and photo', 'Grand titre et photo'])),
    ...[0, 1, 2].map(i => box('rect', d.w * (0.04 + i * 0.31), d.h * 0.58, d.w * 0.28, d.h * 0.26, '#FFFFFF', `${w(['Card', 'Carte'])} ${i + 1}`)),
    box('rect', d.w * 0.04, d.h * 0.87, d.w * 0.92, d.h * 0.08, '#2B2D42', w(['Footer', 'Pied de page']), { textColor: '#FFFFFF' }),
  ] },
  { id: 'phoneApp', icon: '📱', build: (d, w) => {
    const pw = Math.min(d.w * 0.3, d.h * 0.48), x = d.w / 2 - pw / 2;
    return [
      box('roundRect', x, d.h * 0.04, pw, d.h * 0.92, '#FFFFFF', '', { width: 6 }),
      box('rect', x + pw * 0.06, d.h * 0.09, pw * 0.88, d.h * 0.08, '#7B6CF6', w(['App name', 'Nom de l’app']), { textColor: '#FFFFFF' }),
      ...[0, 1, 2, 3].map(i => box('roundRect', x + pw * 0.06, d.h * (0.2 + i * 0.15), pw * 0.88, d.h * 0.12, '#F4F1EA', `${w(['Item', 'Élément'])} ${i + 1}`)),
      box('roundRect', x + pw * 0.25, d.h * 0.82, pw * 0.5, d.h * 0.08, '#D4A843', w(['Button', 'Bouton'])),
    ];
  } },
  { id: 'family', icon: '🌳', build: (d, w) => {
    const bw = d.w * 0.16, bh = d.h * 0.12;
    const p = (x: number, y: number, l: string, c: string) => box('roundRect', x - bw / 2, y, bw, bh, c, l);
    return [
      p(d.w * 0.3, d.h * 0.06, w(['Grandpa', 'Grand-père']), '#BFD7FF'), p(d.w * 0.7, d.h * 0.06, w(['Grandma', 'Grand-mère']), '#F9A8A8'),
      line(d.w * 0.3 + bw / 2, d.h * 0.12, d.w * 0.7 - bw / 2, d.h * 0.12, 'none'), line(d.w / 2, d.h * 0.12, d.w / 2, d.h * 0.4, 'none'),
      p(d.w * 0.5, d.h * 0.4, w(['Dad', 'Papa']), '#BFD7FF'), p(d.w * 0.78, d.h * 0.4, w(['Mom', 'Maman']), '#F9A8A8'),
      line(d.w * 0.5 + bw / 2, d.h * 0.46, d.w * 0.78 - bw / 2, d.h * 0.46, 'none'), line(d.w * 0.64, d.h * 0.46, d.w * 0.64, d.h * 0.62, 'none'),
      line(d.w * 0.44, d.h * 0.62, d.w * 0.84, d.h * 0.62, 'none'), line(d.w * 0.44, d.h * 0.62, d.w * 0.44, d.h * 0.72, 'none'), line(d.w * 0.84, d.h * 0.62, d.w * 0.84, d.h * 0.72, 'none'),
      p(d.w * 0.44, d.h * 0.72, w(['Me', 'Moi']), '#FFE08A'), p(d.w * 0.84, d.h * 0.72, w(['Sister', 'Sœur']), '#C8F0DC'),
    ];
  } },
  { id: 'decision', icon: '🌿', build: (d, w) => [
    box('diamond', d.w * 0.4, d.h * 0.05, d.w * 0.2, d.h * 0.2, '#FFF1B8', w(['Choice?', 'Choix ?'])),
    line(d.w * 0.45, d.h * 0.2, d.w * 0.25, d.h * 0.4), line(d.w * 0.55, d.h * 0.2, d.w * 0.75, d.h * 0.4),
    box('roundRect', d.w * 0.15, d.h * 0.4, d.w * 0.2, d.h * 0.13, '#C8F0DC', w(['Option A', 'Option A'])), box('roundRect', d.w * 0.65, d.h * 0.4, d.w * 0.2, d.h * 0.13, '#BFD7FF', w(['Option B', 'Option B'])),
    line(d.w * 0.2, d.h * 0.53, d.w * 0.12, d.h * 0.7), line(d.w * 0.3, d.h * 0.53, d.w * 0.38, d.h * 0.7), line(d.w * 0.7, d.h * 0.53, d.w * 0.62, d.h * 0.7), line(d.w * 0.8, d.h * 0.53, d.w * 0.88, d.h * 0.7),
    ...[0.04, 0.3, 0.54, 0.8].map((x, i) => box('rect', d.w * x, d.h * 0.7, d.w * 0.16, d.h * 0.12, '#FFFFFF', `${w(['Result', 'Résultat'])} ${i + 1}`)),
  ] },
  { id: 'compare', icon: '⚖️', build: (d, w) => [
    box('roundRect', d.w * 0.05, d.h * 0.06, d.w * 0.42, d.h * 0.14, '#BFD7FF', w(['Option 1', 'Option 1'])), box('roundRect', d.w * 0.53, d.h * 0.06, d.w * 0.42, d.h * 0.14, '#F9A8A8', w(['Option 2', 'Option 2'])),
    ...[0, 1, 2, 3].flatMap(i => [box('rect', d.w * 0.05, d.h * (0.24 + i * 0.18), d.w * 0.42, d.h * 0.15, '#FFFFFF', w(['+ advantage', '+ avantage'])), box('rect', d.w * 0.53, d.h * (0.24 + i * 0.18), d.w * 0.42, d.h * 0.15, '#FFFFFF', w(['+ advantage', '+ avantage']))]),
  ] },
  { id: 'roadmap', icon: '🛣️', build: (d, w) => {
    const q = ['Q1', 'Q2', 'Q3', 'Q4'];
    return [...q.map((l, i) => text(l, d.w * (0.08 + i * 0.22), d.h * 0.05, d.w * 0.2, 36)), ...q.map((_, i) => line(d.w * (0.07 + i * 0.22), d.h * 0.13, d.w * (0.07 + i * 0.22), d.h * 0.95, 'none', '#C9C3B6')),
      box('roundRect', d.w * 0.08, d.h * 0.18, d.w * 0.38, d.h * 0.12, '#BFD7FF', w(['Research', 'Recherche'])), box('roundRect', d.w * 0.3, d.h * 0.36, d.w * 0.4, d.h * 0.12, '#C8F0DC', w(['Build', 'Construction'])),
      box('roundRect', d.w * 0.52, d.h * 0.54, d.w * 0.36, d.h * 0.12, '#FFF1B8', w(['Tests', 'Tests'])), box('roundRect', d.w * 0.74, d.h * 0.72, d.w * 0.2, d.h * 0.12, '#F9A8A8', w(['Launch', 'Lancement']))];
  } },
  { id: 'card', icon: '💌', build: (d, w) => [
    box('roundRect', d.w * 0.04, d.h * 0.05, d.w * 0.92, d.h * 0.9, '#FFF8E1', '', { stroke: '#D4A843', width: 6 }),
    box('heart', d.w * 0.42, d.h * 0.12, d.w * 0.16, d.h * 0.24, '#F76B8A', '', { stroke: null }),
    text(w(['Thank you!', 'Merci !']), d.w * 0.1, d.h * 0.42, d.w * 0.8, Math.round(d.h * 0.12), { font: 'Georgia', fill: '#9B2226' }),
    text(w(['With all my heart', 'De tout mon cœur']), d.w * 0.1, d.h * 0.66, d.w * 0.8, Math.round(d.h * 0.05), { bold: false, italic: true }),
  ] },
  { id: 'certificate', icon: '🏅', build: (d, w) => [
    box('rect', d.w * 0.03, d.h * 0.04, d.w * 0.94, d.h * 0.92, '#FFFFFF', '', { stroke: '#D4A843', width: 10 }),
    box('rect', d.w * 0.06, d.h * 0.09, d.w * 0.88, d.h * 0.82, '#FFFDF5', '', { stroke: '#D4A843', width: 2 }),
    text(w(['Certificate', 'Certificat']), d.w * 0.1, d.h * 0.16, d.w * 0.8, Math.round(d.h * 0.1), { font: 'Georgia', fill: '#3B2F1A' }),
    text(w(['awarded to', 'décerné à']), d.w * 0.1, d.h * 0.34, d.w * 0.8, Math.round(d.h * 0.04), { bold: false, italic: true }),
    text(w(['[Name]', '[Nom]']), d.w * 0.1, d.h * 0.44, d.w * 0.8, Math.round(d.h * 0.08), { font: 'Georgia' }),
    box('star5', d.w * 0.45, d.h * 0.64, d.w * 0.1, d.h * 0.18, '#D4A843', '', { stroke: '#8A6A1F' }),
  ] },
  { id: 'landscape', icon: '🏞️', build: d => [
    box('rect', 0, 0, d.w, d.h * 0.62, '#BDE0FE', '', { stroke: null }),
    box('ellipse', d.w * 0.75, d.h * 0.08, d.h * 0.18, d.h * 0.18, '#FFD60A', '', { stroke: null }),
    box('triangle', d.w * 0.05, d.h * 0.22, d.w * 0.45, d.h * 0.42, '#6C757D', '', { stroke: null }), box('triangle', d.w * 0.35, d.h * 0.3, d.w * 0.4, d.h * 0.34, '#8D99AE', '', { stroke: null }),
    box('rect', 0, d.h * 0.62, d.w, d.h * 0.38, '#80B918', '', { stroke: null }),
    box('rect', d.w * 0.12, d.h * 0.66, d.w * 0.03, d.h * 0.14, '#7F5539', '', { stroke: null }), box('ellipse', d.w * 0.075, d.h * 0.5, d.w * 0.12, d.h * 0.2, '#2D6A4F', '', { stroke: null }),
  ] },
  { id: 'storyboard', icon: '🎬', build: (d, w) => {
    const out: Shape[] = [], gw = d.w / 3, gh = d.h / 2;
    for (let i = 0; i < 6; i++) {
      const x = (i % 3) * gw + 20, y = Math.floor(i / 3) * gh + 20;
      out.push(box('roundRect', x, y, gw - 40, gh * 0.68, '#FFFFFF', `${w(['Scene', 'Scène'])} ${i + 1}`), text(w(['What happens…', 'Ce qui se passe…']), x, y + gh * 0.7, gw - 40, 22, { bold: false }));
    }
    return out;
  } },
  { id: 'journey', icon: '🧳', build: (d, w) => {
    const L5 = [w(['Discover', 'Découvrir']), w(['Try', 'Essayer']), w(['Buy', 'Acheter']), w(['Use', 'Utiliser']), w(['Recommend', 'Recommander'])];
    const faces = ['🙂', '🤔', '😀', '😐', '😍'];
    return [...chain(d, L5, 'roundRect', WARM, d.h * 0.2), ...faces.map((f, i) => text(f, d.w * (0.05 + i * 0.188), d.h * 0.62, d.w * 0.15, 64, { bold: false }))];
  } },
  { id: 'gantt', icon: '📊', build: (d, w) => {
    const rows = [w(['Plan', 'Plan']), w(['Design', 'Design']), w(['Build', 'Construction']), w(['Test', 'Test']), w(['Launch', 'Lancement'])];
    return rows.flatMap((r, i) => [text(r, d.w * 0.02, d.h * (0.1 + i * 0.17), d.w * 0.18, 28, { align: 'left' }),
      box('roundRect', d.w * (0.22 + i * 0.13), d.h * (0.08 + i * 0.17), d.w * (0.2 + (i % 2) * 0.08), d.h * 0.1, WARM[i])]);
  } },
];
