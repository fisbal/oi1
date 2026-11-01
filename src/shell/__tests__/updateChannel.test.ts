import { describe, expect, it } from 'vitest';
import tauri from '../../../src-tauri/tauri.conf.json';
import { APK_URL, LATEST_URLS } from '../update';
import { FEED_BASE } from '../shield/feed';

// The oi1 repo is private: everything an installed app or the shield downloads must come from public places.
describe('public update channel', () => {
  it('asks the hub first, GitHub second', () => {
    expect(LATEST_URLS[0]).toBe('https://fisbal.github.io/updates/oi1/release.json');
    expect(tauri.plugins.updater.endpoints[0]).toBe('https://fisbal.github.io/updates/oi1/latest.json');
  });
  it('downloads the APK and the shield list from public addresses', () => {
    expect(APK_URL).toMatch(/^https:\/\/github\.com\/fisbal\/fisbal\.github\.io\/releases\/download\/oi1-updates\//);
    expect(FEED_BASE).toBe('https://fisbal.github.io/oi1/shield/');
  });
});
