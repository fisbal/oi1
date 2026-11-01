// In 1 Code+'s copilot: Claude sees the selected code (or the open file), the project's files and the
// console's errors, and its code goes back into the editor in place of the selection or at the cursor.

import type { EditorView } from '@codemirror/view';
import { t } from '../../shell/i18n';
import type { CopilotContext, CopilotHost } from '../../ui/Copilot';
import { languageName } from './languages';

export interface CodeBridge {
  project: string;
  files: string[];
  path: string | null;
  view: () => EditorView | null;
  errors: () => string[];
}

interface Where { path: string; from: number; to: number; whole: boolean }

export function codeCopilot(b: CodeBridge): CopilotHost {
  const context = (): CopilotContext | null => {
    const view = b.view();
    if (!view || !b.path) return null;
    const { from, to } = view.state.selection.main;
    const lang = languageName(b.path);
    const errors = b.errors();
    const errText = errors.length ? `\n\nErrors in the console:\n${errors.slice(0, 20).join('\n')}` : '';
    if (from !== to) {
      const line = view.state.doc.lineAt(from).number;
      const code = view.state.sliceDoc(from, to);
      return {
        label: t('ai.code.selection', { n: code.split('\n').length, file: b.path.split('/').pop()! }),
        text: `File ${b.path} (${lang}), lines from ${line}:\n\`\`\`\n${code}\n\`\`\`${errText}`,
        at: { path: b.path, from, to, whole: false } satisfies Where,
      };
    }
    const code = view.state.doc.toString();
    return {
      label: t('ai.code.file', { file: b.path.split('/').pop()! }),
      text: `File ${b.path} (${lang}), the cursor is on line ${view.state.doc.lineAt(from).number}:\n\`\`\`\n${code}\n\`\`\`${errText}`,
      at: { path: b.path, from: 0, to: code.length, whole: true } satisfies Where,
    };
  };
  const put = (code: string, at: unknown, insert: boolean) => {
    const view = b.view();
    const w = at as Where | undefined;
    if (!view) return;
    const len = view.state.doc.length;
    const range = insert || !w || w.path !== b.path
      ? view.state.selection.main
      : { from: Math.min(w.from, len), to: w.whole ? len : Math.min(w.to, len) };
    view.dispatch({ changes: { from: range.from, to: range.to, insert: code }, selection: { anchor: range.from, head: range.from + code.length }, scrollIntoView: true });
    view.focus();
  };
  return {
    app: 'In 1 Code+',
    role: [
      `In 1 Code+ is a code editor that runs websites, Python and SQL in the browser. The project "${b.project}" has these files: ${b.files.slice(0, 200).join(', ')}.`,
      'When you give code to put into the editor, give one fenced code block with the complete replacement for what was selected (or the whole file when no code was selected), and keep the file\'s style. Explain in a sentence or two, outside the block.',
    ].join('\n'),
    context,
    actions: [
      { id: 'explain', icon: 'search', label: t('ai.code.explain'), needsContext: true, prompt: 'Explain what this code does, simply, then point out anything risky or wrong.' },
      { id: 'fix', icon: 'check', label: t('ai.code.fix'), needsContext: true, prompt: 'Find and fix the bugs in this code (use the console errors if there are any). Give the corrected code, then list what you changed.' },
      { id: 'improve', icon: 'sparkle', label: t('ai.code.improve'), needsContext: true, prompt: 'Improve this code: clearer, simpler, safer, faster where it matters, without changing what it does. Give the improved code, then list the changes.' },
      { id: 'comment', icon: 'comment', label: t('ai.code.comment'), needsContext: true, prompt: 'Add short, useful comments to this code (why, not what). Do not change the code itself. Give the commented code.' },
      { id: 'write', icon: 'code', label: t('ai.code.write'), fill: t('ai.code.writeFill') },
    ],
    applies: [
      { id: 'replace', icon: 'replace', label: t('ai.apply.replace'), run: (code, _a, at) => put(code, at, false) },
      { id: 'insert', icon: 'paste', label: t('ai.apply.insertCode'), run: (code, _a, at) => put(code, at, true) },
    ],
  };
}
