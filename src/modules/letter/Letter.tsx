import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { useEffect, useRef, useState } from 'react';
import type { OpenedFile, ShellApi } from '../../shell/contract';
import { t, type MessageKey } from '../../shell/i18n';
import { useLanguage } from '../../shell/useLanguage';
import { htmlBody, textToHtml, wrapHtml } from './html';

export const EXTENSIONS = ['.docx', '.html', '.htm', '.txt'];
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function blankDoc(): string {
  return `<h1>${t('letter.untitled')}</h1><p></p>`;
}

export default function Letter({ shell, file }: { shell: ShellApi; file?: OpenedFile }) {
  useLanguage();
  const [fileName, setFileName] = useState(() => shell.storage.get('name') || '');
  const fileNameRef = useRef(fileName);
  fileNameRef.current = fileName;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableKit.configure({ table: { resizable: true } }),
      Image.configure({ allowBase64: true }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: () => t('letter.placeholder') }),
      CharacterCount,
    ],
    content: savedContent(shell) ?? blankDoc(),
    editorProps: { attributes: { class: 'page', spellcheck: 'true' } },
    onUpdate: ({ editor }) => autosave(editor),
  });

  function autosave(ed: Editor) {
    shell.storage.set('doc', JSON.stringify(ed.getJSON()));
    shell.storage.set('name', fileNameRef.current);
  }

  // A letter that has no file name yet is called after its first heading.
  const title = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (fileName) return fileName.replace(/\.(docx|html?|txt)$/i, '');
      let heading = '';
      editor?.state.doc.descendants(node => {
        if (heading) return false;
        if (node.type.name === 'heading') heading = node.textContent.trim();
        return !heading;
      });
      return (heading || t('letter.untitled')).slice(0, 60);
    },
  });
  const words = useEditorState({ editor, selector: ({ editor }) => editor?.storage.characterCount.words() ?? 0 });

  useEffect(() => { shell.setTitle(title); }, [title, shell]);

  // A tab opened with a file loads it once.
  useEffect(() => {
    if (editor && file) void load(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  async function load(f: OpenedFile) {
    if (!editor) return;
    try {
      const lower = f.name.toLowerCase();
      const html = lower.endsWith('.docx') ? await (await import('./docx')).docxToHtml(await f.arrayBuffer())
        : lower.endsWith('.txt') ? textToHtml(await f.text())
        : htmlBody(await f.text());
      editor.commands.setContent(html);
      setFileName(f.name.replace(/\.(txt|html?)$/i, '.docx'));
      fileNameRef.current = f.name.replace(/\.(txt|html?)$/i, '.docx');
      autosave(editor);
    } catch (err) {
      alert(`${t('letter.openFailed')} ${f.name}\n${String(err)}`);
    }
  }

  function baseName() {
    return (title || 'letter').replace(/[\\/:*?"<>|]+/g, '').trim() || 'letter';
  }

  const actions = {
    open: async () => { const f = await shell.openFile(EXTENSIONS); if (f) await load(f); },
    saveDocx: async () => {
      if (!editor) return;
      const name = `${baseName()}.docx`;
      const { jsonToDocx } = await import('./docx'); // loaded only when needed
      shell.saveFile(name, await jsonToDocx(editor.getJSON(), title), DOCX_TYPE);
      setFileName(name);
    },
    saveHtml: () => editor && shell.saveFile(`${baseName()}.html`, wrapHtml(title, editor.getHTML()), 'text/html'),
    // The browser's print engine makes a sharp, text-based PDF; the title names the file.
    pdf: () => {
      const before = document.title;
      document.title = baseName();
      window.print();
      document.title = before;
    },
    image: async () => {
      const f = await shell.openFile(['.png', '.jpg', '.jpeg', '.gif']);
      if (!f || !editor) return;
      const src = await fileToDataUrl(f);
      editor.chain().focus().setImage({ src, alt: f.name }).run();
    },
    link: () => {
      if (!editor) return;
      const url = prompt(t('letter.linkPrompt'), editor.getAttributes('link').href ?? 'https://');
      if (url === null) return;
      if (url.trim() === '') editor.chain().focus().unsetLink().run();
      else editor.chain().focus().setLink({ href: url.trim() }).run();
    },
  };

  if (!editor) return null;

  return (
    <div className="letter">
      <Toolbar editor={editor} actions={actions} onNew={() => shell.openModule('letter')} />
      <div className="canvas"><EditorContent editor={editor} /></div>
      <footer className="status">
        <span>{fileName || `${title}.docx`}</span>
        <span>{words === 1 ? t('letter.word') : t('letter.words', { n: words })}</span>
      </footer>
    </div>
  );
}

function savedContent(shell: ShellApi): JSONContent | null {
  try {
    const raw = shell.storage.get('doc');
    return raw ? (JSON.parse(raw) as JSONContent) : null;
  } catch {
    return null;
  }
}

async function fileToDataUrl(f: OpenedFile): Promise<string> {
  const bytes = new Uint8Array(await f.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const ext = f.name.split('.').pop()?.toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
  return `data:${mime};base64,${btoa(bin)}`;
}

type Actions = Record<'open' | 'saveDocx' | 'saveHtml' | 'pdf' | 'image' | 'link', () => unknown>;

function Toolbar({ editor, actions, onNew }: { editor: Editor; actions: Actions; onNew: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'),
      h1: e.isActive('heading', { level: 1 }), h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }),
      bullets: e.isActive('bulletList'), numbers: e.isActive('orderedList'), quote: e.isActive('blockquote'),
      left: e.isActive({ textAlign: 'left' }), center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }), justify: e.isActive({ textAlign: 'justify' }),
      link: e.isActive('link'), inTable: e.isActive('table'),
      canUndo: e.can().undo(), canRedo: e.can().redo(),
      color: (e.getAttributes('textStyle').color as string) || '#000000',
    }),
  });
  const run = () => editor.chain().focus();
  const B = ({ label, title, on, active, disabled, style }: { label: string; title: MessageKey; on: () => unknown; active?: boolean; disabled?: boolean; style?: React.CSSProperties }) => (
    <button type="button" title={t(title)} aria-label={t(title)} aria-pressed={active} className={active ? 'on' : ''}
      disabled={disabled} style={style} onMouseDown={e => e.preventDefault()} onClick={() => on()}>{label}</button>
  );
  const sep = <span className="sep" />;

  return (
    <div className="ribbon" role="toolbar">
      <div className="group file">
        <button type="button" onClick={onNew}>{t('letter.new')}</button>
        <button type="button" onClick={() => actions.open()}>{t('letter.open')}</button>
        <button type="button" onClick={() => actions.saveDocx()}>{t('letter.saveDocx')}</button>
        <button type="button" onClick={() => actions.saveHtml()}>{t('letter.saveHtml')}</button>
        <button type="button" title={t('letter.pdfTitle')} onClick={() => actions.pdf()}>{t('letter.pdf')}</button>
      </div>
      <div className="group format">
        <B label="↶" title="letter.undo" on={() => run().undo().run()} disabled={!s.canUndo} />
        <B label="↷" title="letter.redo" on={() => run().redo().run()} disabled={!s.canRedo} />
        {sep}
        <select aria-label={t('letter.normal')} value={s.h1 ? '1' : s.h2 ? '2' : s.h3 ? '3' : '0'}
          onChange={e => {
            const level = Number(e.target.value) as 0 | 1 | 2 | 3;
            if (level === 0) run().setParagraph().run();
            else run().setHeading({ level }).run();
          }}>
          <option value="0">{t('letter.normal')}</option>
          <option value="1">{t('letter.heading1')}</option>
          <option value="2">{t('letter.heading2')}</option>
          <option value="3">{t('letter.heading3')}</option>
        </select>
        {sep}
        <B label="B" title="letter.bold" on={() => run().toggleBold().run()} active={s.bold} style={{ fontWeight: 700 }} />
        <B label="I" title="letter.italic" on={() => run().toggleItalic().run()} active={s.italic} style={{ fontStyle: 'italic' }} />
        <B label="U" title="letter.underline" on={() => run().toggleUnderline().run()} active={s.underline} style={{ textDecoration: 'underline' }} />
        <B label="S" title="letter.strike" on={() => run().toggleStrike().run()} active={s.strike} style={{ textDecoration: 'line-through' }} />
        <label className="color" title={t('letter.color')}>
          <span style={{ borderBottomColor: s.color }}>A</span>
          <input type="color" aria-label={t('letter.color')} value={toInputColor(s.color)}
            onChange={e => run().setColor(e.target.value).run()} />
        </label>
        <B label="▮" title="letter.highlight" on={() => run().toggleHighlight({ color: '#fff59d' }).run()} style={{ color: '#e6c200' }} />
        {sep}
        <B label="•" title="letter.bullets" on={() => run().toggleBulletList().run()} active={s.bullets} />
        <B label="1." title="letter.numbers" on={() => run().toggleOrderedList().run()} active={s.numbers} />
        <B label="❝" title="letter.quote" on={() => run().toggleBlockquote().run()} active={s.quote} />
        {sep}
        <B label="⇤" title="letter.alignLeft" on={() => run().setTextAlign('left').run()} active={s.left} />
        <B label="↔" title="letter.alignCenter" on={() => run().setTextAlign('center').run()} active={s.center} />
        <B label="⇥" title="letter.alignRight" on={() => run().setTextAlign('right').run()} active={s.right} />
        <B label="☰" title="letter.justify" on={() => run().setTextAlign('justify').run()} active={s.justify} />
        {sep}
        <B label="🔗" title="letter.link" on={actions.link} active={s.link} />
        <B label="🖼" title="letter.image" on={actions.image} />
        <B label="▦" title="letter.table" on={() => run().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        {s.inTable && <>
          <B label="+▭" title="letter.addRow" on={() => run().addRowAfter().run()} />
          <B label="+▯" title="letter.addColumn" on={() => run().addColumnAfter().run()} />
          <B label="✕▦" title="letter.deleteTable" on={() => run().deleteTable().run()} />
        </>}
      </div>
    </div>
  );
}

function toInputColor(c: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return m ? `#${[m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')}` : '#000000';
}
