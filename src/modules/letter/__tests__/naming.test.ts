import { describe, expect, it } from 'vitest';
import { blankDoc, suggestedName } from '../model';

describe('naming like Word', () => {
  it('starts a new letter as an empty page, with no title written in it', () => {
    expect(blankDoc().body).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
  it('suggests the first words of the first line when saving the first time', () => {
    expect(suggestedName('\n  Also hello. Hello. Come on, watch you. How are you doing? Let\'s go to.\nLet\'s go home.', 'Untitled letter')).toBe('Also hello. Hello. Come on, watch you');
    expect(suggestedName('Demande de congé : juin', 'x')).toBe('Demande de congé juin');
    expect(suggestedName('   ', 'Lettre sans titre')).toBe('Lettre sans titre');
  });
});
