// Run after `tauri android init`: the generated Android app must follow the device both ways and let
// people pinch to zoom (required in every app). Tauri's template has neither setting, so this adds them:
// no orientation lock in AndroidManifest.xml, and pinch zoom on in MainActivity's WebView.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'src-tauri/gen/android/app/src/main';
const find = (dir, name) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { const r = find(p, name); if (r) return r; } else if (f === name) return p;
  }
};

const manifest = join(root, 'AndroidManifest.xml');
writeFileSync(manifest, readFileSync(manifest, 'utf8').replace(/\s*android:screenOrientation="[^"]*"/g, ''));

const activity = find(join(root, 'java'), 'MainActivity.kt');
let code = readFileSync(activity, 'utf8');
if (!code.includes('builtInZoomControls')) {
  code = code.replace(/^(package [^\n]+\n)/, '$1\nimport android.webkit.WebView\n');
  code = code.replace(/\}\s*$/, `
  // Two-finger pinch zoom, without +/- buttons drawn over the page.
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.settings.setSupportZoom(true)
    webView.settings.builtInZoomControls = true
    webView.settings.displayZoomControls = false
  }
}
`);
  writeFileSync(activity, code);
}
console.log(`Pinch zoom on and no orientation lock:\n${readFileSync(activity, 'utf8')}`);
