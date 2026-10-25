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
  /** Open a module in a new tab, optionally with a file. */
  openModule(id: string, file?: OpenedFile): void;
  /** Go back to the home screen. */
  goHome(): void;
}

export interface MountedModule {
  unmount?(): void;
}

export interface OI1Module {
  id: string;
  /** File extensions this module opens, like ['.docx']. */
  extensions: string[];
  /** Draw the module inside `el`. `file` is set when the tab was opened with a file. */
  mount(el: HTMLElement, shell: ShellApi, file?: OpenedFile): MountedModule;
}
