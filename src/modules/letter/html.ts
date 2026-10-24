function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function textToHtml(text: string): string {
  return text.split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}

/** The body of an HTML file. The editor's schema drops scripts and unknown markup on load. */
export function htmlBody(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed').forEach(n => n.remove());
  return doc.body.innerHTML;
}

/** A standalone web page. `css` is the letter's styles, written for elements inside `.doc-text`. */
export function wrapHtml(title: string, body: string, css = '', background: string | null = null): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{margin:0;background:${background ?? '#fff'}}.doc-text{max-width:46rem;margin:3rem auto;padding:0 1rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:4px 8px;vertical-align:top}img{max-width:100%;height:auto}
${css}</style>
</head><body><div class="doc-text">
${body}
</div></body></html>`;
}
