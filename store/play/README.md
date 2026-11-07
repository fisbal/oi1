# Office In 1 on Google Play

- `listing-fr.md` / `listing-en.md`: store texts, ready to paste.
- `data-safety.md`: answers for "Data safety" and "App content".
- Graphics (icon 512, feature graphic 1024x500, phone and tablet screenshots): made from the live app, in the project files folder `play-store/`.

How the build works (`.github/workflows/build.yml`, android job):
- Each release also makes `OfficeIn1-play.aab`, signed with the app's upload key (same secrets as the APK).
- Its web part is built with `VITE_STORE=play`, which turns off the in-app "new APK" offer (Play forbids self-updates; Play updates the app itself).
- Target API raised to at least 36 by `scripts/android-zoom.mjs`.
- Once the secret `PLAY_SERVICE_ACCOUNT_JSON` exists, each release is sent to the track in the repository variable `PLAY_TRACK` (default `internal`; set `production` once the app is approved).

Rule for new personal developer accounts: a closed test with at least 12 testers opted in for 14 days in a row before production access.
