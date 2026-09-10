#!/usr/bin/env bash
# deploy.sh — test, guard the cache version, push, wait for GitHub Pages, prove the live site.
# Every step stops the script on failure; nothing is pushed until the local checks pass.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

step() { printf '\n== %s\n' "$*"; }
fail() { printf 'DEPLOY STOPPED: %s\n' "$*" >&2; exit 1; }

step "Tests"
summary=$(npm test 2>&1 | grep -E '^ℹ (tests|pass|fail)')
echo "$summary"
grep -q '^ℹ fail 0$' <<<"$summary" || fail "tests are not green"

step "Working tree"
[ -z "$(git status --porcelain)" ] || fail "uncommitted changes — commit or stash first"
[ "$(git branch --show-current)" = "main" ] || fail "not on main"

step "What would ship"
git fetch -q origin main
base=$(git merge-base HEAD origin/main)
if [ "$base" = "$(git rev-parse HEAD)" ]; then echo "origin/main already has HEAD — nothing to push."; exit 0; fi
git log --oneline "$base"..HEAD

step "Cache version guard"
# Any cached file changed since origin/main without a VERSION bump would leave
# installed phones serving the old build. Same rule CLAUDE.md states.
shell=$(sed -n "s/^ *'\.\/\(.*\)',$/\1/p" sw.js)
changed=$(git diff --name-only "$base" HEAD -- $shell || true)
v_base=$(git show "$base":sw.js | grep -o "VERSION = '[^']*'")
v_head=$(grep -o "VERSION = '[^']*'" sw.js)
version=${v_head#VERSION = \'}; version=${version%\'}
if [ -n "$changed" ] && [ "$v_base" = "$v_head" ]; then
  printf 'cached files changed:\n%s\n' "$changed"
  fail "sw.js $v_head is unchanged since origin/main — bump VERSION and commit"
fi
echo "sw.js $v_head (base had $v_base)"

step "Push"
git push origin main
head=$(git rev-parse HEAD)

step "GitHub Pages build"
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
for i in $(seq 1 30); do
  status=$(gh api "repos/$repo/pages/builds/latest" --jq '"\(.status) \(.commit)"')
  echo "  [$i] $status"
  case "$status" in
    "built $head"*) break ;;
    "errored $head"*) fail "Pages build errored: $(gh api "repos/$repo/pages/builds/latest" --jq .error.message)" ;;
  esac
  [ "$i" -lt 30 ] || fail "Pages build did not finish in time"
  sleep 10
done

step "Live assets"
url=$(gh api "repos/$repo/pages" --jq .html_url)
bad=0
for entry in $shell; do
  path=${entry#./}; [ "$path" = "/" ] && path=""
  code=$(curl -s -o /dev/null -w '%{http_code}' "${url%/}/$path")
  [ "$code" = "200" ] || { echo "  $code  $path"; bad=1; }
done
[ "$bad" = 0 ] || fail "some cached assets are not served — see above"
echo "every SHELL entry serves 200 from $url"

step "Live page"
python .claude/skills/screenshot/shoot.py "$url" 390 844 deploy-live.png \
  --print "document.querySelector('#summary .nup').textContent" \
  --print "[...document.querySelectorAll('.tabs button')].map(b => b.textContent.trim()).join(' | ')" \
  --print "caches.keys().then(k => k.join(','))" | tee deploy-live.txt
grep -q "printcalc-$version" deploy-live.txt || fail "live page is not serving printcalc-$version yet (cache is from an older build?)"
rm -f deploy-live.txt deploy-live.png

printf '\nDEPLOYED %s to %s (cache printcalc-%s)\n' "${head:0:7}" "$url" "$version"
