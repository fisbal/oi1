// A deck as plain text and back: the outline sent to Letter or converted, and slides made from a document's HTML
// (each heading starts a slide). Shared by In 1 Stage and the Convert tab of every app.
import { t } from '../shell/i18n';
import { itemText, linesToHtml, newSlide, slideTitle, type Deck, type LayoutId, type Slide } from './slides';

/** Text for a whole deck, for searching, the copilot and the outline sent to Letter. */
export function deckOutline(deck: Deck): { title: string; lines: string[]; notes: string }[] {
  return deck.slides.map(s => {
    const title = slideTitle(s);
    const lines = s.items.filter(i => !(i.kind === 'shape' && i.role === 'title')).flatMap(i => itemText(i).split('\n')).map(l => l.trim()).filter(Boolean);
    return { title, lines, notes: s.notes };
  });
}

export function outlineHtml(deck: Deck, name: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return deckOutline(deck).map((s, i) => {
    const head = `<h2>${esc(s.title || t('stage.slideN', { n: i + 1 }))}</h2>`;
    const list = s.lines.length ? `<ul>${s.lines.map(l => `<li><p>${esc(l)}</p></li>`).join('')}</ul>` : '';
    const notes = s.notes.trim() ? s.notes.split('\n').filter(Boolean).map(l => `<p><em>${esc(l)}</em></p>`).join('') : '';
    return head + list + notes;
  }).join('') || `<p>${esc(name)}</p>`;
}

/** Slides from a letter's HTML: each heading starts a slide, the text under it becomes its bullets. */
export function slidesFromHtml(html: string, deck: Pick<Deck, 'w' | 'h'>): Slide[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out: { title: string; lines: string[]; level: number }[] = [];
  for (const el of Array.from(doc.body.children)) {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent ?? '').trim();
    if (/^h[1-3]$/.test(tag)) { out.push({ title: text, lines: [], level: Number(tag[1]) }); continue; }
    if (!out.length) out.push({ title: '', lines: [], level: 9 });
    const cur = out[out.length - 1];
    if (tag === 'ul' || tag === 'ol') el.querySelectorAll('li').forEach(li => { const x = (li.querySelector('p') ?? li).textContent?.trim(); if (x) cur.lines.push(x); });
    else if (text) cur.lines.push(text);
  }
  return out.filter(s => s.title || s.lines.length).map((s, i) => {
    const layout: LayoutId = i === 0 && s.level === 1 && !s.lines.length ? 'title' : s.level === 1 && !s.lines.length ? 'section' : 'content';
    const slide = newSlide(layout, deck);
    slide.items = slide.items.map(it => {
      if (it.kind !== 'shape') return it;
      if (it.role === 'title') return { ...it, html: linesToHtml([s.title], false) };
      if (it.role === 'body' && s.lines.length) return { ...it, html: linesToHtml(s.lines.slice(0, 12), true) };
      return it;
    });
    if (s.lines.length > 12) slide.notes = s.lines.slice(12).join('\n');
    return slide;
  });
}
