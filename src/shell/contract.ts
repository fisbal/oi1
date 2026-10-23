// The OI1 module contract: the only way the shell and a module talk to each other.
// A module can be written in anything (React, plain JS, or a whole app in an iframe like ProDFos),
// as long as it exports an object of this shape. See docs/module-contract.md.

export interface OpenedFile {
  name: string;
  type: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ShellApi {
  /** Ask the user to pick a file. Resolves to null if they cancel. */
  openFile(extensions: string[]): Promise<OpenedFile | null>;
  /** Save a file to the user's computer. */
  saveFile(name: string, content: Blob | string, mimeType: string): void;
  /** Small storage for autosave, kept separate for each tab. */
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
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
