// @vitest-environment node
import { describe, expect, it, beforeAll } from 'vitest';
// @ts-expect-error jsdom ships no types here; only its DOMParser is used
import { JSDOM } from 'jsdom';
import { analyse, blockRemote, checkLink, lookalike, worst } from '../secure/phish';
import { autocryptHeader, decryptArmored, encryptMime, isPgpMime, keyFromAutocrypt, keyInfo, PGP_BLOCK, type MyKey } from '../secure/pgp';
import * as openpgp from 'openpgp';

beforeAll(() => {
  const w = new JSDOM('').window;
  (globalThis as unknown as { DOMParser: typeof DOMParser }).DOMParser = w.DOMParser as unknown as typeof DOMParser;
});

const mail = (o: Partial<Parameters<typeof analyse>[0]>) => ({ from: 'Anna <anna@example.org>', subject: 'Hello', html: '<p>Hi</p>', attachments: [], ...o });

describe('phishing guard', () => {
  it('lets an ordinary mail through', () => {
    expect(analyse(mail({}))).toEqual([]);
    expect(analyse(mail({ html: '<p>See <a href="https://www.example.org/x">www.example.org</a></p>' }))).toEqual([]);
  });
  it('spots look-alike domains but not the real ones', () => {
    expect(lookalike('paypa1.com')).toBe('paypal.com');
    expect(lookalike('xn--pypal-4ve.com')).toBe('punycode');
    expect(lookalike('paypal.com.secure-login.net')).toBeTruthy();
    expect(lookalike('microsoft-account-verify.com')).toBeTruthy();
    expect(lookalike('www.paypal.com')).toBeNull();
    expect(lookalike('apple.news')).toBeNull();
    expect(lookalike('email.com')).toBeNull();
    expect(lookalike('googleusercontent.com')).toBeNull();
  });
  it('checks links: shown text against the real target', () => {
    expect(checkLink('www.desjardins.com', 'https://desjardins-verif.xyz/login').level).toBe('danger');
    expect(checkLink('Click here', 'http://192.168.4.20/x').code).toBe('ipLink');
    expect(checkLink('bit.ly/abc', 'https://bit.ly/abc').code).toBe('shortLink');
    expect(checkLink('x', 'javascript:alert(1)').code).toBe('badScheme');
    expect(checkLink('Read more', 'https://news.example.org/a').level).toBeNull();
  });
  it('flags a classic bank scam with several reasons, worst first', () => {
    const w = analyse(mail({
      from: '"Desjardins Sécurité" <alerte@desjardins-secure.top>', replyTo: 'rembourse@mailbox.ru',
      subject: 'URGENT : compte suspendu', auth: 'mx.google.com; spf=fail smtp.mailfrom=desjardins-secure.top; dmarc=fail header.from=desjardins-secure.top',
      html: '<p>Vérifiez votre compte <a href="https://desjardins-secure.top/login">www.desjardins.com</a></p>',
      attachments: [{ name: 'facture.pdf.exe', type: 'application/octet-stream' }],
    }));
    const codes = w.map(x => x.code);
    expect(worst(w)).toBe('danger');
    for (const c of ['dmarcFail', 'brandSpoof', 'replyTo', 'linkMismatch', 'doubleExt', 'pressure']) expect(codes).toContain(c);
    expect(w[0].level).toBe('danger');
  });
  it('sees a name that shows another address', () => {
    expect(analyse(mail({ from: '"service@paypal.com" <x@evil.example>' })).map(w => w.code)).toContain('nameSpoof');
  });
  it('flags dangerous attachments and forms', () => {
    expect(analyse(mail({ attachments: [{ name: 'Invoice.docm', type: '' }] }))[0].code).toBe('dangerFile');
    expect(analyse(mail({ html: '<form><input type="password"></form>' }))[0].code).toBe('formInMail');
  });
  it('holds remote pictures back but keeps embedded ones', () => {
    const r = blockRemote('<p><img src="https://track.example/p.gif" width="1"><img src="data:image/png;base64,AAAA"><span style="background:url(https://x.example/a.png)">a</span></p>');
    expect(r.blocked).toBe(2);
    expect(r.html).not.toContain(' src="https://track');
    expect(r.html).toContain('data-oi1-src="https://track.example/p.gif"');
    expect(r.html).toContain('data:image/png');
  });
});

describe('OpenPGP end to end', () => {
  const make = async (name: string, email: string): Promise<MyKey> => {
    const k = await openpgp.generateKey({ userIDs: [{ name, email }], format: 'armored' });
    return { pub: k.publicKey, priv: k.privateKey, email, fpr: (await openpgp.readKey({ armoredKey: k.publicKey })).getFingerprint() };
  };
  it('encrypts PGP/MIME for the recipient and the sender, and checks the signature', async () => {
    const anna = await make('Anna', 'anna@example.org'), bob = await make('Bob', 'bob@example.org');
    const inner = 'Content-Type: text/plain; charset=UTF-8\r\nSubject: Secret plan\r\n\r\nRendez-vous à 9 h, café ☕';
    const enc = await encryptMime(inner, [bob.pub], anna);
    expect(enc.contentType).toContain('multipart/encrypted');
    const raw = `From: anna@example.org\r\nContent-Type: ${enc.contentType}\r\n\r\n${enc.body}`;
    expect(isPgpMime(raw)).toBe(true);
    expect(enc.body).not.toContain('Rendez-vous');
    const armored = raw.match(PGP_BLOCK)![0];
    const forBob = await decryptArmored(armored, bob, [anna.pub]);
    expect(forBob.text.replace(/\r\n/g, "\n")).toBe(inner.replace(/\r\n/g, "\n"));
    expect(forBob.verified).toBe(true);
    const forAnna = await decryptArmored(armored, anna);
    expect(forAnna.text.replace(/\r\n/g, "\n")).toBe(inner.replace(/\r\n/g, "\n"));
    const eve = await make('Eve', 'eve@example.org');
    await expect(decryptArmored(armored, eve)).rejects.toBeTruthy();
  }, 30000);
  it('hands public keys over in the Autocrypt header, only for the real sender', async () => {
    const anna = await make('Anna', 'anna@example.org');
    const h = await autocryptHeader(anna);
    expect(h).toMatch(/^Autocrypt: addr=anna@example.org; prefer-encrypt=mutual; keydata=/);
    const unfolded = h.replace(/\r\n /g, ' ').replace(/^Autocrypt:\s*/, '');
    const back = await keyFromAutocrypt(unfolded, 'anna@example.org');
    expect(back).toContain('BEGIN PGP PUBLIC KEY');
    expect((await keyInfo(back!))?.emails).toEqual(['anna@example.org']);
    expect(await keyFromAutocrypt(unfolded, 'mallory@example.org')).toBeNull();
    expect(await keyInfo(anna.priv)).toBeNull();
  }, 30000);
});
