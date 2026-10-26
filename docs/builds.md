# Builds, releases and updates

Every merge to `main` ships Office In 1 everywhere at once (`.github/workflows/build.yml`):

| Build | Where | Made with |
|---|---|---|
| Web | https://fisbal.github.io/oi1/ | Vite (gh-pages branch) |
| Android | `OfficeIn1.apk` on the newest GitHub Release | Tauri 2, signed with the release keystore |
| Windows | `OfficeIn1-Setup.exe` and `OfficeIn1.msi` on the newest GitHub Release | Tauri 2 (WebView2) |
| Mac | `OfficeIn1.dmg` (Apple silicon and Intel) on the newest GitHub Release | Tauri 2 (WebKit) |
| Source code | the zip and tar.gz on every GitHub Release | GitHub |

Every pull request runs the same builds as a check, without publishing anything.

## Every screen

Every app is made for phones, tablets, PCs and Macs. `npm run check:screens` (run by CI on every pull request,
after the build) opens each app on a phone, a phone turned sideways, a tablet both ways, a PC and a Mac screen, and
fails when the page scrolls sideways, a document or slide is wider than the screen, or the ribbon leaves less than
half the screen for the work. The screenshots are kept with each CI run (artifact `screens`).

What makes it work: on iPhones and iPads, text boxes no longer zoom the app in when tapped; on short screens
(a phone turned sideways) the ribbon shows only its tabs and opens a tab's buttons over the work when tapped;
letters zoom to the page width on phones.
Each build gets its own version, `0.1.<run number>`, so a new version always installs over the old one.

Links that always point at the newest version (for DownloadOS and for sharing):

- https://github.com/fisbal/oi1/releases/latest/download/OfficeIn1.apk
- https://github.com/fisbal/oi1/releases/latest/download/OfficeIn1-Setup.exe
- https://github.com/fisbal/oi1/releases/latest/download/OfficeIn1.dmg

## Updates

- **Windows and Mac** check `latest.json` on the newest release when it starts (and every 6 hours), shows
  "Office In 1 x.y.z is ready", and on "Update now" downloads the signed installer, installs it and restarts.
- **Android** asks GitHub for the newest release, shows the same message, and "Update now" downloads the new APK;
  opening it installs it over the old one (same signing key, higher version).
- **Web** updates itself through the service worker.

## Signing keys (GitHub secrets, never in the repository)

| Secret | What it is |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the release keystore (`.jks`), base64 |
| `ANDROID_KEYSTORE_PASSWORD` | its password |
| `ANDROID_KEY_ALIAS` | the key's alias inside it |
| `TAURI_SIGNING_PRIVATE_KEY` | the update signing key (content of the `.key` file) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | its password |
| `TAURI_SIGNING_PUBLIC_KEY` | its public half (content of the `.key.pub` file) |

Make them once, on any computer with Node.js and Java:

```sh
npx @tauri-apps/cli signer generate -w oi1-updater.key
keytool -genkeypair -keystore oi1-release.jks -alias oi1 -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=Office In 1"
base64 -w0 oi1-release.jks        # on Windows PowerShell: [Convert]::ToBase64String([IO.File]::ReadAllBytes("oi1-release.jks"))
```

The Mac app is not notarized by Apple (that needs a $99/year Apple Developer account): the first time, right-click
the app and choose Open.

Then add them at **Settings → Secrets and variables → Actions → New repository secret**. Keep a safe copy of both
files: a lost Android key means everybody reinstalls once, a lost update key means installed apps stop updating.

Without the secrets, builds still work: the APK is signed with a throwaway key (it installs, but cannot update an
earlier one) and Windows builds cannot update installed apps.

## Building on your own computer

```sh
npm run tauri dev                       # the desktop app, live
npm run tauri build                     # the Windows installer (on Windows)
npx tauri android init && npx tauri android build --apk   # needs Android Studio's SDK and NDK
```

Known limits of the apps for now: printing from the Android app is not available yet (save as PDF from ProDFos or
the web version instead).
