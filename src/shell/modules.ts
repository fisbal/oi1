import type { OI1Module } from './contract';
import type { MessageKey } from './i18n';

// Every module the shell knows about. To add one: create src/modules/<id>/index.ts(x)
// that exports an OI1Module, then add one line here.
export interface ModuleEntry {
  id: string;
  name: string; // product names stay the same in every language
  kind: MessageKey;
  color: string;
  extensions: string[];
  load: (() => Promise<{ default: OI1Module }>) | null;
}

export const modules: ModuleEntry[] = [
  { id: 'letter', name: 'Office Letter', kind: 'kind.letter', color: '#2b579a', extensions: ['.docx', '.html', '.htm', '.txt'], load: () => import('../modules/letter') },
  { id: 'class', name: 'Office Class', kind: 'kind.class', color: '#217346', extensions: ['.xlsx', '.csv'], load: null },
  { id: 'stage', name: 'Office Stage', kind: 'kind.stage', color: '#b7472a', extensions: ['.pptx'], load: null },
  { id: 'prodfos', name: 'Office ProDFos', kind: 'kind.prodfos', color: '#a4262c', extensions: [], load: () => import('../modules/prodfos') },
  { id: 'assistant', name: 'Office Assistant', kind: 'kind.assistant', color: '#5c2d91', extensions: [], load: null },
  { id: 'notes', name: 'Office Notes', kind: 'kind.notes', color: '#7719aa', extensions: [], load: null },
  { id: 'plan', name: 'Office Plan', kind: 'kind.plan', color: '#0078d4', extensions: [], load: null },
  { id: 'mail', name: 'Office Mail', kind: 'kind.mail', color: '#005a9e', extensions: [], load: null },
  { id: 'draw', name: 'Office Draw', kind: 'kind.draw', color: '#c239b3', extensions: [], load: null },
  { id: 'form', name: 'Office Form', kind: 'kind.form', color: '#008272', extensions: [], load: null },
];

/** The ready module that opens files with this name, if any. */
export function moduleForFile(fileName: string): ModuleEntry | undefined {
  const lower = fileName.toLowerCase();
  return modules.find(m => m.load && m.extensions.some(ext => lower.endsWith(ext)));
}
