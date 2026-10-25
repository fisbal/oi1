// The small part of Markdown Claude's answers use: paragraphs, headings, lists, **bold**, *italic*,
// `code` and fenced code blocks. Read once into blocks, then shown in the copilot or turned into HTML for a letter.

export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean };
export type Block =
  | { kind: 'p'; inline: Inline[] }
  | { kind: 'h'; level: number; inline: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'code'; lang: string; text: string };

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    if (m[2] ?? m[3]) out.push({ text: (m[2] ?? m[3])!, bold: true });
    else if (m[4]) out.push({ text: m[4], code: true });
    else out.push({ text: (m[5] ?? m[6])!, italic: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ kind: 'p', inline: parseInline(para.join('\n')) }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```\s*([\w+#.-]*)\s*$/);
    if (fence) {
      flush();
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```\s*$/.test(lines[i]); i++) body.push(lines[i]);
      blocks.push({ kind: 'code', lang: fence[1], text: body.join('\n') });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); blocks.push({ kind: 'h', level: h[1].length, inline: parseInline(h[2]) }); continue; }
    const li = line.match(/^\s*([-*•]|\d+[.)])\s+(.*)$/);
    if (li) {
      flush();
      const ordered = /\d/.test(li[1]);
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === 'list' && prev.ordered === ordered) prev.items.push(parseInline(li[2]));
      else blocks.push({ kind: 'list', ordered, items: [parseInline(li[2])] });
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    para.push(line);
  }
  flush();
  return blocks;
}

/** What an answer gives to apply: the first code block when there is one, otherwise the whole answer. */
export function payloadOf(answer: string): string {
  const code = parseMarkdown(answer).find(b => b.kind === 'code');
  return code && code.kind === 'code' ? code.text : answer.trim();
}

/** The answer as plain text, without Markdown signs, for a sheet cell or a slide. */
export function plainText(md: string): string {
  return parseMarkdown(md).map(b => {
    const txt = (xs: Inline[]) => xs.map(x => x.text).join('');
    if (b.kind === 'code') return b.text;
    if (b.kind === 'list') return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '•'} ${txt(it)}`).join('\n');
    return txt(b.inline);
  }).join('\n\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inlineHtml = (xs: Inline[]) => xs.map(x => {
  let h = esc(x.text).replace(/\n/g, '<br>');
  if (x.code) h = `<code>${h}</code>`;
  if (x.bold) h = `<strong>${h}</strong>`;
  if (x.italic) h = `<em>${h}</em>`;
  return h;
}).join('');

/** The answer as HTML paragraphs, headings and lists, for a letter. */
export function markdownToHtml(md: string): string {
  return parseMarkdown(md).map(b => {
    if (b.kind === 'p') return `<p>${inlineHtml(b.inline)}</p>`;
    if (b.kind === 'h') return `<h${Math.min(3, b.level)}>${inlineHtml(b.inline)}</h${Math.min(3, b.level)}>`;
    if (b.kind === 'list') {
      const tag = b.ordered ? 'ol' : 'ul';
      return `<${tag}>${b.items.map(it => `<li><p>${inlineHtml(it)}</p></li>`).join('')}</${tag}>`;
    }
    return `<pre><code>${esc(b.text)}</code></pre>`;
  }).join('');
}
