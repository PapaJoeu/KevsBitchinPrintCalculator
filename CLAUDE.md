# Kev's Bitchin' Print Calculator

Phone-first print production calculator: imposition, guillotine program
sequence, and fold/score positions. Static site, plain ES modules, no build
step, no dependencies. See README.md for run/test/deploy commands.

## Testing

`npm test`. Note `node --test tests/` does NOT work on Node 24 — use the glob
(`npm test`) or a single file (`node --test tests/sequence.test.js`).

## The cutting model — read before touching js/core/sequence.js

This project exists because the program sequence was wrong in every prior
attempt. `TWO_UP` and `BUSINESS_CARD` in tests/sequence.test.js are jobs a
production worker verified by hand. They are the specification: if they fail,
the implementation is wrong — never adjust a fixture to make a test pass.

Per axis with n documents: `n-1` ladder rungs stepping down by (doc + gutter),
then trims at the doc dimension for `k = 2..n`. The trim loop starts at 2, not
1, because **the final ladder rung already lands on the doc dimension and is
the first trim**. This looks like an off-by-one; it isn't. Also: an axis with
one document gets no trims, and a zero gutter needs none.

Every cut is its own step. Never collapse repeats into counts — the operator
keys each one into the machine separately.

## Architecture

- `js/core/` — pure functions, **all math in inches**, no DOM, never imports
  from `js/ui/`. Unit conversion happens only in `js/app.js` (input edge) and
  `js/ui/format.js` (display edge).
- `js/ui/` — rendering and events, driven by `js/app.js`'s single render loop.

## Design decisions that look like bugs

- **Orientation as entered is authoritative.** Never auto-rotate to improve
  yield. A 3.5x2 card is 24-up on 12x18 but 25-up on 18x12; the worker has the
  physical sheet, so the tool offers a hint and they choose.
- **`[hidden] { display: none !important }`** (css/win98.css) is load-bearing:
  layout classes setting `display` otherwise beat the attribute.
- `applyRotation` deliberately leaves `state.fold.axis` alone — the axis is
  sheet-relative.

## Gotchas

- **Bump `VERSION` in `sw.js` whenever a cached file changes**, or installed
  phones keep serving the old build.
- Relative asset paths only (`./js/app.js`) — this is a GitHub *project* page
  served under a subpath, so absolute paths 404 in production but work locally.
- The GitHub repo is currently **archived and read-only**; `git push` fails
  with 403 until it is unarchived.
