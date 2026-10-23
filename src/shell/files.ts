import type { OpenedFile } from './contract';

export function wrapFile(file: File): OpenedFile {
  return {
    name: file.name,
    type: file.type,
    text: () => file.text(),
    arrayBuffer: () => file.arrayBuffer(),
  };
}

export function pickFile(extensions: string[]): Promise<OpenedFile | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = extensions.join(',');
    input.onchange = () => resolve(input.files?.[0] ? wrapFile(input.files[0]) : null);
    input.click();
  });
}

export function downloadFile(name: string, content: Blob | string, mimeType: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
