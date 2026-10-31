// Highlighted text stays readable on any page: on a light highlight (like the yellow of a field to fill)
// the text is dark, on a dark highlight it is white, even when the page around is dark and its text light.

import Highlight from '@tiptap/extension-highlight';
import { mergeAttributes } from '@tiptap/core';

/** The text color that reads best on `color` (a hex color), or null when the color is not hex. */
export function inkOn(color: string | null | undefined): string | null {
  const m = (color ?? '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // The ink with the higher contrast ratio (WCAG) against the highlight.
  return (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05) ? '#1D1A15' : '#FFFFFF';
}

export const ReadableHighlight = Highlight.extend({
  renderHTML({ HTMLAttributes, mark }) {
    const ink = inkOn(mark.attrs.color as string | null) ?? (mark.attrs.color ? null : '#1D1A15');
    return ['mark', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, ink ? { style: `color: ${ink}` } : {}), 0];
  },
}).configure({ multicolor: true });
