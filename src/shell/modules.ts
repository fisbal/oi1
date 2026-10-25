import type { OI1Module } from './contract';
import type { MessageKey } from './i18n';

// Every module the shell knows about. To add one: create src/modules/<id>/index.ts(x)
// that exports an OI1Module, then add one line here.
export interface ModuleEntry {
  id: string;
  name: string; // product names stay the same in every language
  kind: MessageKey;
  /** The app's accent in the scene look; gold stays the suite's own color. */
  color: string;
  extensions: string[];
  load: (() => Promise<{ default: OI1Module }>) | null;
}

export const modules: ModuleEntry[] = [
  { id: 'letter', name: 'Office Letter', kind: 'kind.letter', color: '#7FA7E8', extensions: ['.docx', '.html', '.htm', '.txt'], load: () => import('../modules/letter') },
  { id: 'class', name: 'Office Class', kind: 'kind.class', color: '#5FC79A', extensions: ['.xlsx', '.csv', '.tsv'], load: () => import('../modules/class') },
  { id: 'stage', name: 'Office Stage', kind: 'kind.stage', color: '#E8875F', extensions: ['.pptx'], load: null },
  { id: 'code', name: 'Office Code+', kind: 'kind.code', color: '#B8E05F', extensions: ['.zip', '.js', '.mjs', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md', '.py', '.sql', '.dart'], load: () => import('../modules/code') },
  { id: 'prodfos', name: 'Office ProDFos', kind: 'kind.prodfos', color: '#E25C5C', extensions: [], load: () => import('../modules/prodfos') },
  { id: 'assistant', name: 'Office Assistant', kind: 'kind.assistant', color: '#B48CF0', extensions: [], load: null },
  { id: 'notes', name: 'Office Notes', kind: 'kind.notes', color: '#E8C35F', extensions: [], load: null },
  { id: 'plan', name: 'Office Plan', kind: 'kind.plan', color: '#5FB8E8', extensions: [], load: null },
  { id: 'mail', name: 'Office Mail', kind: 'kind.mail', color: '#8C9CF0', extensions: [], load: null },
  { id: 'draw', name: 'Office Draw', kind: 'kind.draw', color: '#E26FC2', extensions: [], load: null },
  { id: 'form', name: 'Office Form', kind: 'kind.form', color: '#4FC4B5', extensions: [], load: null },
];

/** The ready module that opens files with this name, if any. */
export function moduleForFile(fileName: string): ModuleEntry | undefined {
  const lower = fileName.toLowerCase();
  return modules.find(m => m.load && m.extensions.some(ext => lower.endsWith(ext)));
}
