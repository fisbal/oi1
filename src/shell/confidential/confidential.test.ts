import { beforeEach, describe, expect, it } from 'vitest';
import { confidentialLocked, confidentialOn, confidentialUnlocked } from './mode';
import { changePin, createVault, hideName, isSealed, lock, newRecoveryCode, open, pinOk, readKeys, removeVault, seal, unlock, waitLeft, writeKeys } from './vault';
import { allowed } from './netGuard';
import { weakPin } from './Confidential';
import { sealedKey, store } from '../storage';
import { CT_KEYS } from './strings';

beforeEach(() => { removeVault(); localStorage.clear(); });

describe('vault', () => {
  it('turns on, locks, unlocks with the PIN and with the recovery code', async () => {
    expect(confidentialOn()).toBe(false);
    const code = await createVault('482917');
    expect(code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){5}$/);
    expect(confidentialUnlocked()).toBe(true);
    lock();
    expect(confidentialLocked()).toBe(true);
    expect(readKeys()).toBeNull();
    expect(writeKeys()).not.toBeNull(); // two seconds for the last saves
    expect(await unlock('000000')).toBe(false);
    expect(await unlock('482917')).toBe(true);
    lock();
    expect(await unlock(code.toLowerCase().replace(/-/g, ' '), true)).toBe(true);
  }, 30_000);

  it('never keeps the PIN or the key in clear', async () => {
    await createVault('482917');
    const v = localStorage.getItem('oi1.confidential.vault')!;
    expect(v).not.toContain('482917');
    expect(JSON.parse(v).pin.rounds).toBeGreaterThanOrEqual(600_000);
  }, 30_000);

  it('seals text, objects and files, and only the right key opens them', async () => {
    await createVault('482917');
    const k = readKeys()!;
    const value = { html: '<p>Note évolutive : patient stable</p>', file: new Blob(['abc'], { type: 'text/plain' }) };
    const s = await seal(value, k);
    expect(isSealed(s)).toBe(true);
    expect(new TextDecoder().decode(s.ct)).not.toContain('patient');
    const back = await open(s, k) as { html: string; file: Blob };
    expect(back.html).toBe(value.html);
    expect(new TextDecoder().decode(await new Promise<ArrayBuffer>(r => { const f = new FileReader(); f.onload = () => r(f.result as ArrayBuffer); f.readAsArrayBuffer(back.file); }))).toBe('abc');
    expect(await hideName('letter:Dupont.docx', k)).toBe(await hideName('letter:Dupont.docx', k));
    expect(await hideName('letter:Dupont.docx', k)).not.toContain('Dupont');
    removeVault(); await createVault('739164');
    await expect(open(s, readKeys()!)).rejects.toBeTruthy();
  }, 30_000);

  it('changes the PIN and waits after too many wrong ones', async () => {
    await createVault('482917');
    expect(await changePin('482917', '5730981')).toBe(true);
    lock();
    expect(await unlock('482917')).toBe(false);
    expect(await unlock('5730981')).toBe(true);
    lock();
    for (let i = 0; i < 5; i++) await unlock('111111');
    expect(waitLeft()).toBeGreaterThan(0);
    expect(await unlock('5730981')).toBe(false); // must wait, even with the right PIN
  }, 60_000);

  it('asks for a real PIN', () => {
    expect(pinOk('12345')).toBe(false);
    expect(pinOk('482917')).toBe(true);
    expect(pinOk('abcdefg')).toBe(false);
    expect(pinOk('abcdefgh')).toBe(true);
    for (const p of ['123456', '000000', '987654', '7890123']) expect(weakPin(p)).toBe(true);
    expect(weakPin('482917')).toBe(false);
    expect(newRecoveryCode()).not.toBe(newRecoveryCode());
  });
});

describe('network guard', () => {
  it('lets everything go when the mode is off', () => {
    expect(allowed('https://api.languagetool.org/v2/check', 'POST', true)).toBe(true);
  });
  it('stops sends and keeps downloads of the app’s own parts', async () => {
    await createVault('482917');
    expect(allowed('https://api.languagetool.org/v2/check', 'POST', true)).toBe(false);
    expect(allowed('https://api.mymemory.translated.net/get?q=patient&langpair=fr|en')).toBe(false);
    expect(allowed('https://api.anthropic.com/v1/messages', 'POST', true)).toBe(false);
    expect(allowed('https://api.github.com/repos/x/y/contents/a', 'PUT', true)).toBe(false);
    expect(allowed('https://huggingface.co/onnx-community/whisper-base/resolve/main/config.json')).toBe(true);
    expect(allowed('https://huggingface.co/api/x', 'POST', true)).toBe(false);
    expect(allowed(`https://cdn.jsdelivr.net/npm/x?q=${'a'.repeat(700)}`)).toBe(false);
    expect(allowed('http://localhost:11434/v1/chat/completions', 'POST', true)).toBe(true);
    expect(allowed('/assets/app.js')).toBe(true);
  }, 30_000);
});

describe('store', () => {
  it('keeps tab names and tab settings out of localStorage in confidential mode', async () => {
    expect(sealedKey('tabs')).toBe(true);
    expect(sealedKey('tm4x8k2ab1c9:name')).toBe(true);
    expect(sealedKey('language')).toBe(false);
    await createVault('482917');
    store.set('tabs', '[{"title":"Dupont Jean"}]');
    store.set('tm4x8k2ab1c9:name', 'Dupont.docx');
    expect(store.get('tabs')).toContain('Dupont');
    expect(JSON.stringify(localStorage)).not.toContain('Dupont');
  }, 30_000);
});

describe('strings', () => {
  it('has the five languages for every journal action', () => {
    for (const a of ['on', 'off', 'unlock', 'recovery', 'badPin', 'lock', 'autoLock', 'pin', 'open', 'save', 'export', 'print', 'blocked']) expect(CT_KEYS).toContain(`a.${a}`);
  });
});
