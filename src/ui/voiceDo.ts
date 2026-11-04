// What "In 1" asks the app on screen to do with its selection (Martin, 2026-11-03: "écris quatre", "supprime la
// sélection", "mets-le en rouge", "enlève la ligne"…). The voice sends one event; the app on screen does it in its own
// way (a Letter or a note through its editor, a Class sheet on its cells) and says it was done.
import type { Editor } from '@tiptap/core';

export interface VoiceDo {
  what: 'type' | 'delete' | 'removeLine' | 'color' | 'bold' | 'italic' | 'underline' | 'selectAll';
  value?: string;
  /** Set by the app that did it. */
  done?: boolean;
}

export const VOICE_DO = 'oi1-voice-do';

/** Listens for the voice's requests; [handle] returns true when this app did it (only the app on screen should). */
export function onVoiceDo(handle: (d: VoiceDo) => boolean): () => void {
  const on = (e: Event) => {
    const d = (e as CustomEvent<VoiceDo>).detail;
    if (!d || d.done) return;
    if (handle(d)) d.done = true;
  };
  window.addEventListener(VOICE_DO, on);
  return () => window.removeEventListener(VOICE_DO, on);
}

/** Asks the app on screen; false when no app took it. */
export function voiceDo(d: VoiceDo): boolean {
  const detail: VoiceDo = { ...d };
  window.dispatchEvent(new CustomEvent(VOICE_DO, { detail }));
  return !!detail.done;
}

/** The same requests for any text editor (Letter, Notes…): on the selection, or on the paragraph when nothing is selected. */
export function editorVoiceDo(ed: Editor | null | undefined, d: VoiceDo): boolean {
  if (!ed || ed.isDestroyed || !ed.view.dom.offsetParent) return false;
  const { state } = ed;
  const { empty, $from } = state.selection;
  // An editor without colors or underline (a plain note) says no, and the voice falls back on the app's buttons.
  const can = (name: string) => typeof (ed.commands as unknown as Record<string, unknown>)[name] === 'function';
  if ((d.what === 'color' && !can('setColor')) || (d.what === 'underline' && !can('toggleUnderline'))) return false;
  // "Mets-le en rouge" with nothing selected: the paragraph the cursor is in.
  const target = () => (empty ? ed.chain().focus().setTextSelection({ from: $from.start(), to: $from.end() }) : ed.chain().focus());
  switch (d.what) {
    case 'type': {
      const at = state.selection.from;
      const before = state.doc.textBetween(Math.max(0, at - 1), at);
      const text = before && !/\s$/.test(before) ? ` ${d.value ?? ''}` : (d.value ?? '');
      return ed.chain().focus().insertContent(text).run();
    }
    case 'delete': return empty ? false : ed.chain().focus().deleteSelection().run();
    case 'removeLine': {
      // The paragraph (or the list item) the cursor is in.
      let depth = $from.depth;
      if (depth > 1 && $from.node(depth - 1).type.name === 'listItem') depth -= 1;
      return ed.chain().focus().command(({ tr }) => { tr.delete($from.before(depth), $from.after(depth)); return true; }).run();
    }
    case 'color': return d.value ? target().setColor(d.value).run() : target().unsetColor().run();
    case 'bold': return target().toggleBold().run();
    case 'italic': return target().toggleItalic().run();
    case 'underline': return target().toggleUnderline().run();
    case 'selectAll': return ed.chain().focus().selectAll().run();
  }
  return false;
}
