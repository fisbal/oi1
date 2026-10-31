import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStaleBuild, reloadToNewVersion } from '../staleBuild';

describe('isStaleBuild', () => {
  it('knows the message of every browser for a part that is no longer published', () => {
    // Chrome / Edge (what Martin saw on 31 Oct 2026), Safari, Firefox, and Vite's CSS preload.
    expect(isStaleBuild(new TypeError('Failed to fetch dynamically imported module: https://fisbal.github.io/oi1/assets/read-B6UolWEr.js'))).toBe(true);
    expect(isStaleBuild(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleBuild(new TypeError('error loading dynamically imported module: https://x/assets/a.js'))).toBe(true);
    expect(isStaleBuild(new Error('Unable to preload CSS for /oi1/assets/model-DKkUpSKi.css'))).toBe(true);
  });

  it('leaves real file problems alone, so they are still shown', () => {
    expect(isStaleBuild(new Error('Corrupted zip: missing end of central directory'))).toBe(false);
    expect(isStaleBuild(new Error('word/document.xml not found'))).toBe(false);
    expect(isStaleBuild(undefined)).toBe(false);
  });
});

describe('reloadToNewVersion', () => {
  afterEach(() => { sessionStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('reloads once, then not again within a minute (no reload loop)', async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    const first = reloadToNewVersion();
    await vi.runAllTimersAsync();
    expect(await first).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(await reloadToNewVersion()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
