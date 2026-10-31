// The editor pieces for the letter body and for its header and footer.

import type { Editor, Extensions, JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import FileHandler from '@tiptap/extension-file-handler';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { t } from '../../shell/i18n';
import { CellBackground, ListStyle, PageBreak, PageNumber, ParagraphFormat, TextStyleExtras } from './extensions';
import { Pagination } from './pagination';
import { Citation, IndexTerm } from './references';
import { Comment, Deletion, Footnote, Insertion, Modification, TrackChanges } from './review';
import { Search } from './search';
import { FieldTyping } from './templates/markup';
import { Proofing, type ProofOptions } from '../../ui/proof/extension';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function insertImages(editor: Editor, files: File[], pos?: number) {
  for (const file of files) {
    void readAsDataUrl(file).then(src => {
      const node = { type: 'image', attrs: { src, alt: file.name } };
      if (pos === undefined) editor.chain().focus().insertContent(node).run();
      else editor.chain().focus().insertContentAt(pos, node).run();
    });
  }
}

/** `proof` turns on the underlines of the spelling, grammar and style check (left out for files read or written). */
export function letterExtensions(part: 'body' | 'header' | 'footer', proof?: ProofOptions): Extensions {
  const body = part === 'body';
  return [
    StarterKit.configure({
      link: { openOnClick: false },
      trailingNode: body ? {} : false,
      // Headings in a header or footer are rare; keep the whole kit so pasted text keeps its shape.
    }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TableKit.configure({ table: { resizable: true } }),
    Image.configure({ inline: true, allowBase64: true, resize: { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 24, minHeight: 24 } }),
    TextStyleKit.configure({ lineHeight: false }),
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    ParagraphFormat,
    TextStyleExtras,
    CellBackground,
    ListStyle,
    PageNumber,
    ...(proof ? [Proofing.configure(proof)] : []),
    FileHandler.configure({
      allowedMimeTypes: IMAGE_TYPES,
      onDrop: (editor, files, pos) => insertImages(editor, files, pos),
      onPaste: (editor, files, html) => { if (!html) insertImages(editor, files); },
    }),
    ...(body
      ? [
        PageBreak,
        Placeholder.configure({ placeholder: () => t('letter.placeholder') }),
        CharacterCount,
        Search,
        FieldTyping,
        Pagination,
        Comment,
        Footnote,
        Citation,
        IndexTerm,
        Insertion,
        Deletion,
        Modification,
        TrackChanges,
      ]
      : [Placeholder.configure({ placeholder: () => t(part === 'header' ? 'letter.headerPlaceholder' : 'letter.footerPlaceholder') })]),
  ];
}

/** Older letters kept images outside paragraphs; images now sit inside text, like in Word. */
export function migrate(doc: JSONContent | null | undefined): JSONContent | null {
  if (!doc) return null;
  const fix = (nodes: JSONContent[] = []): JSONContent[] => nodes.map(n => {
    if (n.type === 'listItem' || n.type === 'blockquote' || n.type === 'tableCell' || n.type === 'tableHeader') {
      return { ...n, content: wrapImages(fix(n.content)) };
    }
    return n.content && n.type !== 'paragraph' && n.type !== 'heading' ? { ...n, content: fix(n.content) } : n;
  });
  const wrapImages = (nodes: JSONContent[]) => nodes.map(n => (n.type === 'image' ? { type: 'paragraph', content: [n] } : n));
  return { ...doc, content: wrapImages(fix(doc.content)) };
}
