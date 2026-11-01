// The page a "#run=…" link opens, like the QR code from Code+ on a phone: the project alone, full screen.

import { buildPreview, resolvePath } from './build';
import { unpackRun } from './project';

export async function startRunner(packed: string) {
  document.title = 'In 1 Code+';
  document.body.style.margin = '0';
  document.body.style.background = '#fff';
  const root = document.getElementById('root')!;
  root.replaceChildren();
  const frame = Object.assign(document.createElement('iframe'), { title: 'In 1 Code+' });
  frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups allow-downloads');
  frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
  root.append(frame);
  try {
    const { files, page: first } = await unpackRun(packed);
    let page = first;
    let storage: Record<string, string> = {};
    const show = async () => { frame.srcdoc = (await buildPreview(files, page, storage)).html; };
    addEventListener('message', e => {
      const m = e.data as { __oi1?: number; type?: string; href?: string; data?: Record<string, string> };
      if (e.source !== frame.contentWindow || !m?.__oi1) return;
      if (m.type === 'storage' && m.data) storage = m.data;
      if (m.type === 'navigate' && m.href) {
        const next = resolvePath(page, m.href, files);
        if (next) { page = next; void show(); }
      }
    });
    await show();
  } catch {
    root.textContent = 'This link is damaged. Ask for a new one.';
    root.style.cssText = 'font: 16px system-ui; padding: 24px';
  }
}
