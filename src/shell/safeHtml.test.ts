import { describe, expect, it } from 'vitest';
import { safeHtml } from './safeHtml';

describe('safeHtml', () => {
  it('removes code that would run', () => {
    const out = safeHtml('<p>Hi<img src="x" onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a><iframe srcdoc="<script>1</script>"></iframe></p>');
    expect(out).not.toMatch(/onerror|<script|javascript:|<iframe|alert/);
  });
  it('removes SVG tricks', () => {
    expect(safeHtml('<svg><animate onbegin="alert(1)"/><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>')).not.toMatch(/alert/);
  });
  it('keeps the formatting of slides and headers', () => {
    const html = '<p style="text-align: center"><span class="w" data-i="2" style="color: rgb(255, 0, 0); font-size: 24pt">Bonjour</span> <b>monde</b></p><ul><li>un</li></ul><table><tbody><tr><td>1</td></tr></tbody></table>';
    expect(safeHtml(html)).toBe(html);
  });
  it('makes new-window links safe', () => {
    expect(safeHtml('<a href="https://example.com" target="_blank">x</a>')).toContain('rel="noopener noreferrer"');
  });
});
