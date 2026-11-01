// Updates for the installed apps, so nobody has to reinstall by hand:
// Windows downloads the signed new version, installs it and restarts (Tauri's updater, checked against
// latest.json on the hub's update channel, then the newest GitHub Release); Android finds the newer release and opens its APK, which
// installs over the old one (the Google Play build leaves updates to Play). The web version updates itself through the service worker.

import { inApp } from './files';

const REPO = 'fisbal/oi1';
// The public update channel on the hub (factory/mirror_updates.py in fisbal.github.io) copies every release,
// so installed apps keep updating even though the oi1 repo is private. GitHub's own address stays as a fallback.
const CHANNEL = 'https://fisbal.github.io/updates/oi1';
export const APK_URL = 'https://github.com/fisbal/fisbal.github.io/releases/download/oi1-updates/OfficeIn1.apk';
export const LATEST_URLS = [`${CHANNEL}/release.json`, `https://api.github.com/repos/${REPO}/releases/latest`];

/** Newest version tag ("v0.1.42") from the first address that answers, or ''. */
async function latestTag(): Promise<string> {
  for (const url of LATEST_URLS) {
    try {
      // No custom header on the hub address: a plain GET needs no CORS preflight on GitHub Pages.
      const api = url.startsWith('https://api.github.com/');
      const res = await fetch(url, api ? { headers: { Accept: 'application/vnd.github+json' } } : { cache: 'no-cache' });
      if (!res.ok) continue;
      const tag = String(((await res.json()) as { tag_name?: string }).tag_name ?? '');
      if (tag) return tag;
    } catch { /* try the next address */ }
  }
  return '';
}

export interface AppUpdate {
  version: string;
  /** Windows installs it itself; Android hands the APK to the system installer. */
  kind: 'install' | 'apk';
  run(): Promise<void>;
}

const isAndroid = () => /Android/i.test(navigator.userAgent);
/** The Google Play build (VITE_STORE=play): Play installs the updates by itself, and its rules forbid an app
 *  updating itself any other way, so that build never offers an APK. */
export const PLAY_BUILD = import.meta.env.VITE_STORE === 'play';

/** "0.1.42" is newer than "0.1.9". */
export function newer(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

/** A newer version of the installed app, or null (also in a browser, or when offline). */
export async function findUpdate(): Promise<AppUpdate | null> {
  if (!inApp()) return null;
  try {
    if (isAndroid()) {
      if (PLAY_BUILD) return null;
      const [{ getVersion }, latest] = await Promise.all([import('@tauri-apps/api/app'), latestTag()]);
      if (!latest || !newer(latest, await getVersion())) return null;
      return {
        version: latest.replace(/^v/, ''), kind: 'apk',
        run: async () => { const { openUrl } = await import('@tauri-apps/plugin-opener'); await openUrl(APK_URL); },
      };
    }
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) return null;
    return {
      version: update.version, kind: 'install',
      run: async () => {
        await update.downloadAndInstall();
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      },
    };
  } catch {
    return null;
  }
}
