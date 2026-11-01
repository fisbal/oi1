// Default names ("Untitled letter", "Sheet1") follow the interface language (Martin's screenshot, 2026-11-01: a
// French Office In 1 still showed "Untitled letter" and "Sheet1" for documents made while it was in English).
// A name counts as a default only when it is exactly the default of one of the languages; a name the person typed
// is never changed.

import { LANGUAGES, t, type MessageKey } from './i18n';

/** True when `text` is the default `key` text of any language (like "Untitled letter" or "Lettre sans titre"). */
export function isDefaultText(key: MessageKey, text: string): boolean {
  const s = text.trim();
  return !!s && LANGUAGES.some(l => (l.messages as Record<string, string>)[key] === s);
}

/** For a numbered default like "Sheet{n}": the number when `text` is that default in any language, else null. */
export function defaultNumber(key: MessageKey, text: string): number | null {
  for (const l of LANGUAGES) {
    const pattern = (l.messages as Record<string, string>)[key];
    if (!pattern?.includes('{n}')) continue;
    const [a, b] = pattern.split('{n}');
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`^${esc(a)}(\\d{1,4})${esc(b)}$`).exec(text.trim());
    if (m) return Number(m[1]);
  }
  return null;
}

/** The default text in the current language when `text` is a default in another one, else null. */
export function relabel(key: MessageKey, text: string): string | null {
  const n = defaultNumber(key, text);
  const now = n !== null ? t(key, { n }) : isDefaultText(key, text) ? t(key) : null;
  return now !== null && now !== text.trim() ? now : null;
}
