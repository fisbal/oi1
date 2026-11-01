# Office In 1: notes for Claude sessions

## CI and merging
The workflow picks its mode from the repo's visibility (see the top of .github/workflows/build.yml).
- **Now: PUBLIC** (Martin, 2026-11-01: oi1 stays public until he says all work is finished; never ask him to
  make it private before that). Minutes are free: every PR and every push runs all checks and builds all apps,
  as before. Merge on green.
- **Once PRIVATE**: Pro includes 3,000 Actions minutes a month; Martin's overage budget is $5.
  - Pull requests run NOTHING by default. When a PR is ready to merge, add the label `verifier`
    (`gh api -X POST repos/fisbal/oi1/issues/N/labels -f "labels[]=verifier"`). That runs every web check
    (phone, tablet, PC, Mac, both orientations: rule 16), again on later pushes while the label is on.
    Merge only when that run is green on the PR's current head; iterate with local checks before labelling.
  - Push to main only builds and publishes the web app. Windows, Mac, Android and the Release are built on
    Mondays when main changed, or with "Run workflow" (~95 minutes: Mac x10). Never add native jobs to PRs.

## Updates and public files
- Installed apps update from the hub's public channel: https://fisbal.github.io/updates/oi1/ (copied every
  30 minutes from this repo's newest release by fisbal/fisbal.github.io `factory/mirror_updates.py`).
  Release assets of this private repo are NOT downloadable by users.
- The shield list is published on the site at https://fisbal.github.io/oi1/shield/ (gh-pages /shield/).
- Never change the site URL, manifest id, start_url/scope, app name or icons (MS Store package, rule 14).
