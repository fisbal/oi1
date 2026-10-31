// The OI1 module contract: the only way the shell and a module talk to each other.
// A module can be written in anything (React, plain JS, or a whole app in an iframe like ProDFos),
// as long as it exports an object of this shape. See docs/module-contract.md.

/** A file on the user's device. `handle` is set where the browser lets OI1 save back to the same file. */
export interface FileRef {
  name: string;
  handle?: FileSystemFileHandle;
}

export interface OpenedFile extends FileRef {
  type: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface RecentFile {
  id: string;
  name: string;
  moduleId: string;
  /** When it was last opened or saved, in milliseconds since 1970. */
  time: number;
}

export interface SaveOptions {
  /** Save over this file when the browser allows it (Chrome and Edge); otherwise ask where to save. */
  target?: FileRef | null;
  /** Always ask where to save, like Word's "Save as". */
  saveAs?: boolean;
}

export interface ShellApi {
  /** Ask the user to pick a file. Resolves to null if they cancel. */
  openFile(extensions: string[]): Promise<OpenedFile | null>;
  /**
   * Save a file to the user's device. `content` can be a function so that a slow file is made after the
   * user has chosen where to save it. Resolves to the saved file, or null if the user cancelled.
   */
  saveFile(name: string, content: Blob | string | (() => Promise<Blob | string>), mimeType: string, options?: SaveOptions): Promise<FileRef | null>;
  /** Storage for autosave, kept separate for each tab: small values with get/set, big ones with load/save. */
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    load(key: string): Promise<string | null>;
    save(key: string, value: string): Promise<void>;
  };
  /** Files this module opened or saved lately, newest first. */
  recent: {
    list(): Promise<RecentFile[]>;
    open(id: string): Promise<OpenedFile | null>;
  };
  /** Change the label on this module's tab. */
  setTitle(title: string): void;
  /**
   * Open a module in a new tab, optionally with a file or with something handed over from another app.
   * Resolves to the new tab's id, or null when that app is not ready yet.
   */
  openModule(id: string, file?: OpenedFile, handoff?: Handoff): string | null;
  /** Go back to the home screen. */
  goHome(): void;

  // ---- Linking the apps. Every module offers "Send to" for what it makes and accepts what others send. ----

  /** This tab's id, so another tab can send changes back to it. */
  readonly tabId: string;
  /** Every app in OI1, ready or coming soon, for app switchers and "Send to" menus. */
  apps(): AppInfo[];
  /** The open tabs, optionally only those of one app, like every open letter. */
  tabs(moduleId?: string): TabInfo[];
  /** Show an open tab. */
  showTab(tabId: string): void;
  /** Hand something to an open tab. Resolves to false when that tab is closed or does not take it. */
  send(tabId: string, handoff: Handoff): Promise<boolean>;
  /**
   * Ask an open tab for what it holds, like a sheet's selected table; `from` is set to this tab on the other side.
   * Resolves to null when that tab is closed or has nothing to give.
   */
  ask(tabId: string, want: 'table'): Promise<Handoff | null>;
  /** Answer what other tabs ask for. Returns a function that stops answering. */
  onAsk(fn: (want: 'table', from: string) => Handoff | null | Promise<Handoff | null>): () => void;
  /** Show a short message at the bottom of the screen, like "Table sent to Office Class". */
  notify(message: string): void;
  /**
   * Receive what other apps hand to this tab; `from` is the sending tab. Return true when it was used.
   * Returns a function that stops listening.
   */
  onReceive(fn: (handoff: Handoff, from: string) => boolean | Promise<boolean>): () => void;

  /** Claude, the copilot every app has (see src/ui/Copilot.tsx for the shared panel). */
  readonly ai: AiApi;
}

export interface AiApi {
  /** True when the user has set Claude up on this device. */
  ready(): boolean;
  /** Ask Claude. The answer streams through `onText` (the whole text so far) and the promise gives all of it. */
  ask(req: AiRequest): Promise<string>;
}

export interface AiRequest {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  onText?: (soFar: string) => void;
  signal?: AbortSignal;
  /** A JSON schema the answer must follow, for results an app applies itself (like corrected paragraphs). */
  schema?: Record<string, unknown>;
  effort?: 'low' | 'medium' | 'high';
}

export interface AppInfo {
  id: string;
  name: string;
  ready: boolean;
  color: string;
}

export interface TabInfo {
  tabId: string;
  moduleId: string;
  title: string;
}

/** A table of cells handed between apps: values as text, plus the formula when a sheet cell has one. */
export interface TableData {
  rows: { text: string; formula?: string; bold?: boolean }[][];
  /** The first row holds column titles. */
  header?: boolean;
}

/**
 * Something one app hands to another, in plain shared shapes so that no module depends on another.
 * `link` ties both sides together, like a Word table edited in Excel: the receiver sends changes back
 * with `shell.send(link.tabId, { kind: 'table', table, link })` and the sender updates its copy.
 */
export type Handoff =
  | { kind: 'table'; title?: string; table: TableData; link?: HandoffLink }
  | { kind: 'html'; title?: string; html: string }
  | { kind: 'file'; file: OpenedFile };

export interface HandoffLink {
  /** The tab that holds the original. */
  tabId: string;
  /** Which object inside it, chosen by the sender. */
  id: string;
  /** The sender's app and title, to show "Linked to …". */
  moduleId: string;
  title: string;
  /** Office Class: the sheet that holds the linked table. */
  sheet?: string;
}

export interface MountedModule {
  unmount?(): void;
}

export interface OI1Module {
  id: string;
  /** File extensions this module opens, like ['.docx']. */
  extensions: string[];
  /**
   * Draw the module inside `el`. `file` is set when the tab was opened with a file,
   * `handoff` when another app opened it with something to work on.
   */
  mount(el: HTMLElement, shell: ShellApi, file?: OpenedFile, handoff?: Handoff): MountedModule;
}
