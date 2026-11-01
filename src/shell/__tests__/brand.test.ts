import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRANDS } from '../brand';
import { LANGUAGES } from '../i18n';
import { modules } from '../modules';

const en = LANGUAGES[0].messages as Record<string, string>;

describe('brand names never change (rule 15)', () => {
  it('every app is named with a brand name, never through a translation', () => {
    for (const m of modules) expect(BRANDS, m.id).toContain(m.name);
  });
  it('every language keeps the brand names the English text has', () => {
    const bad: string[] = [];
    for (const [key, text] of Object.entries(en)) {
      // Longest first, so "Office Letter" is not also counted as "Office".
      const used = [...BRANDS].sort((a, b) => b.length - a.length).filter(b => text.includes(b));
      for (const l of LANGUAGES.slice(1)) {
        const other = (l.messages as Record<string, string>)[key] ?? '';
        for (const b of used) if (!other.includes(b)) bad.push(`${l.code} ${key}: "${b}" missing in "${other}"`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('the page tells browser translators (Chrome, Edge, Microsoft Store app) not to translate it', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toMatch(/<html[^>]*translate="no"/);
    expect(html).toMatch(/<html[^>]*class="[^"]*notranslate/);
    expect(html).toContain('<meta name="google" content="notranslate">');
  });
});
