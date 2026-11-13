// End-to-end encrypted mail with the OpenPGP standard (RFC 9580 / RFC 4880 keys, PGP/MIME RFC 3156) and Autocrypt
// (autocrypt.org Level 1) to hand public keys over inside ordinary mails. Only the people the mail is for can read it:
// not Microsoft, not Google, not us. Works between In 1 Mail users and with Thunderbird, Proton Mail, K-9/FairEmail,
// Delta Chat and GnuPG. OpenPGP.js (Proton, LGPL-3.0, audited by Cure53) is loaded only when encryption is used.

import { getSecret, putSecret } from './vault';

type PGP = typeof import('openpgp');
let lib: Promise<PGP> | null = null;
const pgp = () => (lib ??= import('openpgp'));

export interface MyKey { pub: string; priv: string; email: string; fpr: string }

export async function myKey(): Promise<MyKey | null> { return getSecret<MyKey>('pgp.me'); }

/** Makes the person's key pair once (Curve25519, the default of GnuPG and Thunderbird). The private key never leaves
 *  the device: it is kept encrypted with the device key. */
export async function ensureKey(name: string, email: string): Promise<MyKey> {
  const have = await myKey();
  if (have && have.email.toLowerCase() === email.toLowerCase()) return have;
  const o = await pgp();
  const { privateKey, publicKey } = await o.generateKey({ userIDs: [{ name: name || email, email }], format: 'armored' });
  const fpr = (await o.readKey({ armoredKey: publicKey })).getFingerprint().toUpperCase();
  const k = { pub: publicKey, priv: privateKey, email, fpr };
  await putSecret('pgp.me', k);
  return k;
}
export async function forgetKey(): Promise<void> { await putSecret('pgp.me', null); }

/** "ABCD 1234 …" in groups of four, to compare by phone or in person. */
export const groupFpr = (f: string) => f.replace(/(.{4})/g, '$1 ').trim();

/** The fingerprint and e-mail inside an armored public key, or null when it is not one. */
export async function keyInfo(armored: string): Promise<{ fpr: string; emails: string[] } | null> {
  try {
    const o = await pgp();
    const k = await o.readKey({ armoredKey: armored });
    if (k.isPrivate()) return null;
    return { fpr: k.getFingerprint().toUpperCase(), emails: k.users.map(u => (u.userID?.email ?? '').toLowerCase()).filter(Boolean) };
  } catch { return null; }
}

// ---------- Autocrypt header ----------
const fold = (s: string) => s.replace(/.{1,74}/g, '$& ').trim().replace(/ /g, '\r\n ');
/** "Autocrypt: addr=…; keydata=…" for outgoing mails, so the other side can answer encrypted. */
export async function autocryptHeader(k: MyKey): Promise<string> {
  const o = await pgp();
  const key = await o.readKey({ armoredKey: k.pub });
  const bytes = key.toPacketList().write();
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `Autocrypt: addr=${k.email}; prefer-encrypt=mutual; keydata=\r\n ${fold(btoa(bin))}`;
}
/** The public key carried by a received mail's Autocrypt header, as armored text (only when addr is the sender). */
export async function keyFromAutocrypt(header: string, fromAddr: string): Promise<string | null> {
  const addr = header.match(/addr=([^;\s]+)/i)?.[1]?.toLowerCase();
  const data = header.match(/keydata=([A-Za-z0-9+/=\s]+)/i)?.[1]?.replace(/\s+/g, '');
  if (!addr || !data || addr !== fromAddr.toLowerCase()) return null;
  try {
    const o = await pgp();
    const key = await o.readKey({ binaryKey: Uint8Array.from(atob(data), c => c.charCodeAt(0)) });
    if (key.isPrivate()) return null;
    return key.armor();
  } catch { return null; }
}

// ---------- encrypt and decrypt ----------
/** Wraps a whole MIME body (headers of the inner part + content) into a PGP/MIME message (RFC 3156), encrypted for every
 *  recipient and for the sender (so the Sent copy stays readable) and signed with the sender's key. Returns the outer
 *  Content-Type header and body. */
export async function encryptMime(inner: string, recipientKeys: string[], me: MyKey): Promise<{ contentType: string; body: string }> {
  const o = await pgp();
  const encryptionKeys = await Promise.all([...recipientKeys, me.pub].map(a => o.readKey({ armoredKey: a })));
  const signingKeys = await o.readPrivateKey({ armoredKey: me.priv });
  const armored = await o.encrypt({ message: await o.createMessage({ text: inner }), encryptionKeys, signingKeys, format: 'armored' }) as string;
  const b = `=_pgp_${crypto.getRandomValues(new Uint32Array(2)).join('')}`;
  const body = [
    'This is an OpenPGP/MIME encrypted message (RFC 3156).', '',
    `--${b}`, 'Content-Type: application/pgp-encrypted', 'Content-Description: PGP/MIME version identification', '', 'Version: 1', '',
    `--${b}`, 'Content-Type: application/octet-stream; name="encrypted.asc"', 'Content-Description: OpenPGP encrypted message', 'Content-Disposition: inline; filename="encrypted.asc"', '',
    armored.replace(/\r?\n/g, '\r\n'), '', `--${b}--`, '',
  ].join('\r\n');
  return { contentType: `multipart/encrypted; protocol="application/pgp-encrypted"; boundary="${b}"`, body };
}

export interface Opened { text: string; signedBy: string | null; verified: boolean }
/** Opens an armored PGP message with the person's private key; tells who signed it when the signer's key is known. */
export async function decryptArmored(armored: string, me: MyKey, senderKeys: string[] = []): Promise<Opened> {
  const o = await pgp();
  const message = await o.readMessage({ armoredMessage: armored });
  const decryptionKeys = await o.readPrivateKey({ armoredKey: me.priv });
  const verificationKeys = await Promise.all(senderKeys.map(a => o.readKey({ armoredKey: a })));
  const { data, signatures } = await o.decrypt({ message, decryptionKeys, ...(verificationKeys.length ? { verificationKeys } : {}) });
  let verified = false, signedBy: string | null = null;
  if (signatures.length && verificationKeys.length) {
    try { await signatures[0].verified; verified = true; signedBy = signatures[0].keyID.toHex().toUpperCase(); } catch { verified = false; }
  }
  return { text: String(data), signedBy, verified };
}

export const PGP_BLOCK = /-----BEGIN PGP MESSAGE-----[\s\S]+?-----END PGP MESSAGE-----/;
export const isPgpMime = (raw: string) => /content-type:\s*multipart\/encrypted;[^\n]*application\/pgp-encrypted|protocol="?application\/pgp-encrypted/i.test(raw.slice(0, 20000));
