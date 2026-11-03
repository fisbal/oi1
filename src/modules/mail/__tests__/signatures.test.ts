import { describe, expect, it } from 'vitest';
import { cleanSig, sigFor, sigHtml, SIG_LOOKS, type MailSig } from '../signatures';
import { cleanBox, newBox } from '../model';
import { initialsOf } from '../../../ui/signature/store';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const pro: MailSig = { id: 'p', label: 'Pro', name: 'Martin Ballas', title: 'Directeur', company: 'Office In 1', phone: '+33 6 12 34 56 78', email: 'martin@example.com', web: 'fisbal.github.io', address: '1 rue de Paris', hand: PNG, handW: 180, look: 0 };

describe('In 1 Mail signatures', () => {
  it('every one of the 20 looks shows the name, the contacts as links and the handwritten signature', () => {
    for (let look = 0; look < SIG_LOOKS; look++) {
      const h = sigHtml({ ...pro, look });
      expect(h).toMatch(/Martin Ballas|MARTIN BALLAS/);
      expect(h).toContain('href="tel:+33612345678"');
      expect(h).toContain('href="mailto:martin@example.com"');
      expect(h).toContain('href="https://fisbal.github.io"');
      expect(h).toContain(`src="${PNG}"`);
    }
  });
  it('escapes what the person typed', () => {
    expect(sigHtml({ ...pro, name: '<b onclick=x>Me</b>' })).not.toContain('<b onclick');
  });
  it('new mails get the chosen signature, replies only when asked; the older one-text signature still works', () => {
    const box = { ...newBox(), sigs: [pro, { ...pro, id: 'q', label: 'Perso', name: 'Martin', title: '', company: '' }], sigNew: 'q', sigReply: '' };
    expect(sigFor(box)).toContain('Martin');
    expect(sigFor(box)).not.toContain('Directeur · Office');
    expect(sigFor(box, true)).toBe('');
    expect(sigFor({ ...box, sigReply: 'p' }, true)).toContain('Martin Ballas');
    expect(sigFor({ ...newBox(), signature: '<p>Bien à vous</p>' })).toBe('<p>--</p><p>Bien à vous</p>');
    expect(sigFor({ ...newBox(), sigs: [pro] })).toContain('Martin Ballas'); // first signature by default
  });
  it('keeps signatures when the mailbox is saved and opened, and drops bad pictures', () => {
    const back = cleanBox(JSON.parse(JSON.stringify({ ...newBox(), sigs: [pro, { ...pro, id: 'x', logo: 'javascript:alert(1)' }], sigNew: 'p', sigReply: 'x' })));
    expect(back.sigs).toHaveLength(2);
    expect(back.sigs![0]).toMatchObject({ name: 'Martin Ballas', hand: PNG });
    expect(back.sigs![1].logo).toBeUndefined();
    expect(back).toMatchObject({ sigNew: 'p', sigReply: 'x' });
    expect(cleanSig({ look: 99 })!.look).toBe(SIG_LOOKS - 1);
  });
  it('initials', () => {
    expect(initialsOf('Martin Ballas')).toBe('MB');
    expect(initialsOf('jean-paul de la tour')).toBe('JPT');
    expect(initialsOf('')).toBe('');
  });
});
