---
name: deploy
description: Ship main to GitHub Pages safely — run the tests, refuse to push if a cached file changed without a service-worker VERSION bump, push, wait for the Pages build, then prove the live site serves every asset and runs the new cache version.
disable-model-invocation: true
---

# Deploy

One command does the whole ship sequence that used to be eight manual steps:

```bash
bash .claude/skills/deploy/deploy.sh
```

Run it from the repo root on `main` with a clean tree. Report the final
`DEPLOYED … (cache printcalc-vN)` line to the user, or the `DEPLOY STOPPED`
reason if it refused.

## What it checks, in order

1. `npm test` is green.
2. The working tree is clean and the branch is `main`.
3. There is something to push (otherwise it exits saying so).
4. **Cache version guard** — if any file listed in `sw.js`'s `SHELL` changed
   since `origin/main` and `VERSION` did not, it stops. Installed phones only
   fetch a new build when the version changes; shipping without the bump is
   the one deploy mistake that reaches the floor.
5. `git push origin main`.
6. Polls the GitHub Pages build (`gh api …/pages/builds/latest`) until it is
   `built` for the pushed commit; an `errored` build stops with its message.
7. Every `SHELL` entry returns HTTP 200 from the live Pages URL (catches the
   relative-path / subpath problem).
8. Drives the live page with the screenshot skill and confirms the n-up renders
   and `caches.keys()` contains `printcalc-<VERSION>`.

## Prerequisites

- `gh` authenticated to the repo owner's account (`gh auth status`).
- Chrome installed (the screenshot skill finds it).
- No dev server needed — the last step hits the live site.

## If it stops

- *tests are not green* — fix them; never deploy red.
- *uncommitted changes* — commit or stash; the script deploys exactly HEAD.
- *VERSION is unchanged* — bump `VERSION` in `sw.js`, commit, rerun.
- *Pages build errored* — the message is GitHub's; the usual cause is the Pages
  source pointing somewhere other than `main` at `/` (see CLAUDE.md Gotchas).
- *not serving printcalc-vN yet* — the CDN can lag a build by a minute; rerun
  the last check by hand:
  `python .claude/skills/screenshot/shoot.py <live url> 390 844 x.png --print "caches.keys().then(k=>k.join(','))"`
