// Updates for the installed apps, so nobody has to reinstall by hand:
// Windows downloads the signed new version, installs it and restarts (Tauri's updater, checked against
// latest.json on the newest GitHub Release); Android finds the newer release and opens its APK, which
// installs over the old one. The web version updates itself through the service worker.

import { inApp } from './files';

const REPO = 'fisbal/oi1';
export const APK_URL = `https://github.com/${REPO}/releases/latest/download/OfficeIn1.apk`;

export interface AppUpdate {
  version: string;
  /** Windows installs it itself; Android hands the APK to the system installer. */
  kind: 'install' | 'apk';
  run(): Promise<void>;
}

const isAndroid = () => /Android/i.test(navigator.userAgent);

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
      const [{ getVersion }, res] = await Promise.all([
        import('@tauri-apps/api/app'),
        fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } }),
      ]);
      if (!res.ok) return null;
      const latest = String(((await res.json()) as { tag_name?: string }).tag_name ?? '');
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
