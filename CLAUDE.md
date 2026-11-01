# Office In 1: notes for Claude sessions

## CI and merging (the repo is private: Actions minutes are counted)
- Pro includes 3,000 Actions minutes a month; Martin's overage budget is $5. Keep under 3,000.
- Pull requests run NOTHING by default. When a PR is ready to merge, add the label `verifier`
  (issue labels API). That runs every check of the `web` job (phone, tablet, PC, Mac, both
  orientations: project rule 16). Later pushes re-run it while the label is on.
- Merge only when that run is green on the PR's current head. Do not add `verifier` while still iterating:
  run the checks you need locally (`npm test`, `npm run build`, `npm run check:<name>`).
- Push to main only builds and publishes the web app (Pages / MS Store). Windows, Mac, Android and the
  GitHub Release are built on Mondays when main changed, or with "Run workflow" (costs ~95 minutes: Mac x10).
- Never run the full workflow by hand without a reason, never add Mac/Windows jobs to pull requests.

## Updates and public files
- Installed apps update from the hub's public channel: https://fisbal.github.io/updates/oi1/ (copied every
  30 minutes from this repo's newest release by fisbal/fisbal.github.io `factory/mirror_updates.py`).
  Release assets of this private repo are NOT downloadable by users.
- The shield list is published on the site at https://fisbal.github.io/oi1/shield/ (gh-pages /shield/).
- Never change the site URL, manifest id, start_url/scope, app name or icons (MS Store package, rule 14).
