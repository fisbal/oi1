// Cleans HTML before it is put on the page with innerHTML / dangerouslySetInnerHTML.
// A slide, header or footer can come from a file someone sent, a cloud copy or an AI answer: without this,
// a line such as <img src=x onerror="…"> inside it would run as code in Office In 1 and could read the
// copilot and GitHub keys kept on this device. DOMPurify (Cure53, MPL-2.0 OR Apache-2.0) keeps the formatting
// (styles, classes, data-* attributes, lists, tables, images) and removes scripts, event handlers and
// javascript: links. OWASP XSS Prevention Cheat Sheet, rule "sanitize HTML with a proven library".
import DOMPurify from 'dompurify';

const OPTIONS = {
  USE_PROFILES: { html: true, svg: true },
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta', 'link'],
  FORBID_ATTR: ['srcdoc', 'formaction'],
  ADD_ATTR: ['target'],
};

let hooked = false;
function hook() {
  if (hooked) return;
  hooked = true;
  // Links that open a new window cannot reach back into Office In 1.
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node instanceof Element && node.tagName === 'A' && node.getAttribute('target') === '_blank') node.setAttribute('rel', 'noopener noreferrer');
  });
}

/** The same HTML without anything that could run code. */
export function safeHtml(html: string): string {
  if (!html) return html;
  hook();
  return DOMPurify.sanitize(html, OPTIONS) as unknown as string;
}
