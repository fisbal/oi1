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
  /** The app's color code where documents of several apps sit side by side (tabs, app bar), like Word blue, Excel green. */
  code: string;
  /** Its letter on tabs and the app bar, like the W of Word. */
  badge: string;
  extensions: string[];
  load: (() => Promise<{ default: OI1Module }>) | null;
}

/** The app's own word without the suite prefix: "In 1 Letter" -> "Letter" (old "Office Letter" too). */
export const shortName = (name: string) => name.replace(/^(?:In 1|Office) /, '');

export const modules: ModuleEntry[] = [
  { id: 'letter', name: 'In 1 Letter', kind: 'kind.letter', color: '#7FA7E8', code: '#2B6CD4', badge: 'L', extensions: ['.docx', '.html', '.htm', '.txt'], load: () => import('../modules/letter') },
  { id: 'class', name: 'In 1 Class', kind: 'kind.class', color: '#5FC79A', code: '#1E8E5A', badge: 'C', extensions: ['.xlsx', '.csv', '.tsv'], load: () => import('../modules/class') },
  { id: 'stage', name: 'In 1 Stage', kind: 'kind.stage', color: '#E8875F', code: '#D2601A', badge: 'S', extensions: ['.pptx'], load: () => import('../modules/stage') },
  { id: 'code', name: 'In 1 Code+', kind: 'kind.code', color: '#B8E05F', code: '#6E9A12', badge: 'C+', extensions: ['.zip', '.js', '.mjs', '.jsx', '.ts', '.tsx', '.css', '.scss', '.json', '.md', '.py', '.sql', '.dart'], load: () => import('../modules/code') },
  { id: 'prodfos', name: 'In 1 ProDFos', kind: 'kind.prodfos', color: '#E25C5C', code: '#C62828', badge: 'P', extensions: [], load: () => import('../modules/prodfos') },
  { id: 'assistant', name: 'In 1 Assistant', kind: 'kind.assistant', color: '#B48CF0', code: '#7B4FD0', badge: 'A', extensions: [], load: () => import('../modules/assistant') },
  { id: 'notes', name: 'In 1 Notes', kind: 'kind.notes', color: '#E8C35F', code: '#B98A00', badge: 'N', extensions: [], load: () => import('../modules/notes') },
  { id: 'plan', name: 'In 1 Plan', kind: 'kind.plan', color: '#5FB8E8', code: '#0E7FB8', badge: 'P', extensions: ['.oi1plan'], load: () => import('../modules/plan') },
  { id: 'mail', name: 'In 1 Mail', kind: 'kind.mail', color: '#8C9CF0', code: '#4F5FD0', badge: 'M', extensions: [], load: null },
  { id: 'draw', name: 'In 1 Draw', kind: 'kind.draw', color: '#E26FC2', code: '#B8379A', badge: 'D', extensions: ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'], load: () => import('../modules/draw') },
  { id: 'form', name: 'In 1 Form', kind: 'kind.form', color: '#4FC4B5', code: '#14857A', badge: 'F', extensions: [], load: null },
];

/** The ready module that opens files with this name, if any. */
export function moduleForFile(fileName: string): ModuleEntry | undefined {
  const lower = fileName.toLowerCase();
  return modules.find(m => m.load && m.extensions.some(ext => lower.endsWith(ext)));
}
