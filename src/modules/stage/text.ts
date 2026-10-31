// The text inside slide boxes: the editor pieces (TipTap, like Office Letter's, without pages and review),
// and formatting applied to whole boxes when they are selected but not being edited, like PowerPoint does
// when you select a box and press Bold.

import { Editor, type ChainedCommands, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { ReadableHighlight } from '../../ui/highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Placeholder } from '@tiptap/extensions';

export function slideExtensions(placeholder?: () => string): Extensions {
  return [
    StarterKit.configure({ link: { openOnClick: false }, trailingNode: false, horizontalRule: false, codeBlock: false, blockquote: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyleKit.configure({ lineHeight: false }),
    ReadableHighlight,
    Subscript,
    Superscript,
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}

/** Applies a formatting command to all the text of a box and returns the new HTML. */
export function formatHtml(html: string, run: (c: ChainedCommands) => ChainedCommands): string {
  const ed = new Editor({ extensions: slideExtensions(), content: html, injectCSS: false });
  try {
    run(ed.chain().selectAll()).run();
    return ed.getHTML();
  } finally {
    ed.destroy();
  }
}

/** What the ribbon shows for the text: from the editor while editing, else from the box's first words. */
export interface TextState {
  bold: boolean; italic: boolean; underline: boolean; strike: boolean; sub: boolean; sup: boolean;
  bullets: boolean; numbers: boolean; align: string | null;
  font: string | null; size: number | null; color: string | null; highlight: string | null;
}

export const NO_TEXT: TextState = {
  bold: false, italic: false, underline: false, strike: false, sub: false, sup: false,
  bullets: false, numbers: false, align: null, font: null, size: null, color: null, highlight: null,
};

export function editorState(ed: Editor): TextState {
  const ts = ed.getAttributes('textStyle') as { fontFamily?: string; fontSize?: string; color?: string };
  const hl = ed.getAttributes('highlight') as { color?: string };
  const align = (['left', 'center', 'right', 'justify'] as const).find(a => ed.isActive({ textAlign: a })) ?? null;
  return {
    bold: ed.isActive('bold'), italic: ed.isActive('italic'), underline: ed.isActive('underline'), strike: ed.isActive('strike'),
    sub: ed.isActive('subscript'), sup: ed.isActive('superscript'), bullets: ed.isActive('bulletList'), numbers: ed.isActive('orderedList'),
    align, font: ts.fontFamily?.split(',')[0].replace(/["']/g, '').trim() || null,
    size: ts.fontSize ? parseFloat(ts.fontSize) : null, color: ts.color ?? null, highlight: ed.isActive('highlight') ? hl.color ?? '#FFFF00' : null,
  };
}

/** A rough reading of the first words of a box, without an editor. */
export function htmlState(html: string): TextState {
  const first = html.slice(0, 600);
  const size = first.match(/font-size:\s*([\d.]+)pt/);
  const font = first.match(/font-family:\s*([^;"]+)/);
  const color = first.match(/[^-]color:\s*(#[0-9a-fA-F]{6}|rgb\([^)]+\))/);
  const align = first.match(/text-align:\s*(left|center|right|justify)/);
  return {
    ...NO_TEXT,
    bold: /<(strong|b)>/.test(first), italic: /<(em|i)>/.test(first), underline: /<u>/.test(first), strike: /<s>/.test(first),
    bullets: /^<ul/.test(html), numbers: /^<ol/.test(html), align: align?.[1] ?? null,
    font: font ? font[1].split(',')[0].replace(/["'&quot;]/g, '').trim() : null, size: size ? parseFloat(size[1]) : null, color: color?.[1] ?? null,
  };
}
