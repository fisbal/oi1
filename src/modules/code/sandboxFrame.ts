// Where In 1 Code+ runs people's own code (preview, new window, phone link, tests, step by step).
//
// Office In 1 only runs its own scripts (Content-Security-Policy script-src 'self', see vite.config.ts): a script
// slipped into a document, a pasted page or an AI answer cannot run and cannot read the keys kept on the device.
// A frame made with srcdoc, data: or blob: inherits that rule, so people's code would not run there either.
// Code+ loads instead public/preview.html, a page with its own address (so it does not inherit the rule, and the
// service worker keeps it for offline use), which runs the code in a frame sandboxed WITHOUT allow-same-origin
// (an opaque origin: no access to Office In 1's storage, keys or files) and relays its messages. This is how
// CodePen and StackBlitz keep user code apart (OWASP CSP Cheat Sheet; HTML Standard, "sandboxing").

export const SANDBOX_PAGE = 'preview.html';
export const sandboxUrl = () => new URL(SANDBOX_PAGE, document.baseURI).href;
/** What people's code may do in the preview (never allow-same-origin or top navigation: preview.html refuses them). */
export const PREVIEW_SANDBOX = 'allow-scripts allow-forms allow-modals allow-popups allow-downloads';

const pending = new WeakMap<HTMLIFrameElement, () => void>();

/** Shows `html` in `frame` (attached or about to be), sandboxed with `sandbox`. Calling it again replaces the page. */
export function loadSandboxed(frame: HTMLIFrameElement, html: string, sandbox = 'allow-scripts'): void {
  pending.get(frame)?.();
  const win = frame.ownerDocument.defaultView ?? window;
  const onReady = (e: MessageEvent) => {
    if (e.source !== frame.contentWindow || (e.data as { oi1sandbox?: string } | null)?.oi1sandbox !== 'ready') return;
    stop();
    frame.contentWindow?.postMessage({ oi1sandbox: 'run', html, sandbox }, '*');
  };
  const timer = win.setTimeout(() => stop(), 60000);
  const stop = () => { win.removeEventListener('message', onReady); win.clearTimeout(timer); pending.delete(frame); };
  pending.set(frame, stop);
  win.addEventListener('message', onReady);
  frame.removeAttribute('sandbox'); // the sandbox is inside preview.html; this frame only holds Office In 1's page
  frame.src = sandboxUrl();
}
