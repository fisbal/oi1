import { describe, expect, it } from 'vitest';
import { cleanBox, contactsFrom, fieldsIn, fromEml, mailtoUrl, merge, newMail, splitAddresses, textOf, toEml, toVcf, validAddress } from '../model';
import { mailFromAnswer } from '../ai';
import { MAIL_TEMPLATES, TONES } from '../templates';

describe('In 1 Mail model', () => {
  it('reads and checks addresses', () => {
    expect(splitAddresses('Anna <anna@mail.com>; bob@x.org, , ')).toEqual(['Anna <anna@mail.com>', 'bob@x.org']);
    expect(validAddress('Anna <anna@mail.com>')).toBe(true);
    expect(validAddress('anna@')).toBe(false);
  });

  it('round trips a mail with accents and an attachment through .eml', () => {
    const m = newMail('drafts', { to: ['Zoé <zoe@exemple.fr>'], cc: ['c@x.org'], subject: 'Réunion à 10 h — ok ?', html: '<p>Bonjour Zoé,</p><p>À demain €</p>', attachments: [{ name: 'note.txt', type: 'text/plain', size: 5, data: btoa('hello') }] });
    const eml = toEml(m, 'Martin <martin@x.org>');
    expect(eml).toMatch(/^From: /m);
    expect(eml).toMatch(/X-Unsent: 1/);
    const back = fromEml(eml);
    expect(back.subject).toBe(m.subject);
    expect(back.to.join()).toContain('zoe@exemple.fr');
    expect(back.cc).toEqual(['c@x.org']);
    expect(textOf(back.html)).toContain('À demain €');
    expect(back.attachments).toHaveLength(1);
    expect(atob(back.attachments[0].data)).toBe('hello');
  });

  it('reads quoted-printable and encoded-word mails', () => {
    const eml = 'From: =?UTF-8?B?Q2zDqW1lbnQ=?= <c@x.org>\r\nTo: me@x.org\r\nSubject: =?UTF-8?Q?Caf=C3=A9_demain?=\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nOn prend un caf=C3=A9 =\r\nensemble ?\r\n';
    const m = fromEml(eml);
    expect(m.subject).toBe('Café demain');
    expect(m.from).toContain('Clément');
    expect(textOf(m.html)).toContain('On prend un café ensemble ?');
  });

  it('fills merge fields and lists them', () => {
    expect(fieldsIn('Hi {{Name}}, {{ Amount }} {{Name}}')).toEqual(['Name', 'Amount']);
    expect(merge('Hi {{Name}}, you owe {{Amount}}.', { Name: 'Anna', Amount: '12 €' })).toBe('Hi Anna, you owe 12 €.');
  });

  it('imports contacts from CSV and vCard and exports vCard', () => {
    const csv = contactsFrom('Name;Email;Group\nAnna;anna@mail.com;Team\nBad;nope;');
    expect(csv).toHaveLength(1);
    expect(csv[0]).toMatchObject({ name: 'Anna', email: 'anna@mail.com', group: 'Team' });
    const vcf = contactsFrom('BEGIN:VCARD\nVERSION:3.0\nFN:Bob Lee\nEMAIL;TYPE=work:bob@x.org\nEND:VCARD');
    expect(vcf[0]).toMatchObject({ name: 'Bob Lee', email: 'bob@x.org' });
    expect(contactsFrom(toVcf(csv))[0].email).toBe('anna@mail.com');
  });

  it('builds a mailto link with subject and body', () => {
    const url = mailtoUrl(newMail('drafts', { to: ['a@x.org'], subject: 'Hello & bye', html: '<p>Line 1</p><p>Line 2</p>' }));
    expect(url.startsWith('mailto:a@x.org?')).toBe(true);
    expect(decodeURIComponent(url)).toContain('Hello & bye');
  });

  it('cleans a broken mailbox file', () => {
    const b = cleanBox({ mails: [{ subject: 1 }, null, { subject: 'ok', to: 'x' }], contacts: 'no' });
    expect(Array.isArray(b.mails)).toBe(true);
    expect(b.contacts).toEqual([]);
  });

  it('reads AI answers as JSON or plain text', () => {
    expect(mailFromAnswer('```json\n{"subject":"Heating","body":"Hello,\\nPlease fix it."}\n```')).toEqual({ subject: 'Heating', body: 'Hello,\nPlease fix it.' });
    const p = mailFromAnswer('Subject: Late today\n\nHello Paul,\nI will be 20 minutes late.\nThanks');
    expect(p.subject).toBe('Late today');
    expect(p.body.startsWith('Hello Paul')).toBe(true);
    expect(mailFromAnswer('Hello Paul,\nI am late.\nThanks').subject).toBe('');
  });

  it('has 20+ ready mails and tones', () => {
    expect(MAIL_TEMPLATES.length).toBeGreaterThanOrEqual(20);
    expect(TONES.length).toBeGreaterThanOrEqual(20);
  });
});
