# Kev's Bitchin' Print Calculator

Phone-first print production calculator: imposition, guillotine program
sequence, and fold/score positions. Static site, plain ES modules, no build
step, no dependencies. See README.md for run/test/deploy commands.

## Testing

`npm test`. Note `node --test tests/` does NOT work on Node 24 — use the glob
(`npm test`) or a single file (`node --test tests/sequence.test.js`).

## The cutting model — read before touching js/core/sequence.js

This project exists because the program sequence was wrong in every prior
attempt. `TWO_UP`, `BUSINESS_CARD`, and `FLUSH_TOP` in tests/sequence.test.js
are jobs a production worker verified by hand. They are the specification: if
they fail, the implementation is wrong — never adjust a fixture to make a test
pass.

Per axis with n documents: `n-1` strip cuts stepping down by (doc + gutter),
then gutter trims at the doc dimension for `k = 2..n`. The loop starts at 2, not
1, because **the final strip cut already lands on the doc dimension and is the
first gutter trim**. This looks like an off-by-one; it isn't. An axis with one
document gets no gutter trims, and a zero gutter needs none.

**A margin cut exists on an edge iff that edge's margin is greater than a small tolerance.**
A block flush to an edge (offset 0) keeps that edge as its reference and gets no
cut there. Step kinds name what each cut removes: `margin` (with `edge`),
`strip`, `gutter`.

**Margin is not the non-printable area.** Margin is the outside area the
squaring cuts remove; NPA is a per-edge placement constraint that changes how
many documents fit and where, and never appears in the cut list. Auto placement
centres within the printable region and can never violate NPA; only a manual
offset or count can, and the response is a warning with fixes, never a silent
correction.

Every cut is its own step. Never collapse repeats into counts — the operator
keys each one into the machine separately.

## Architecture

- `js/core/` — pure functions, **all math in inches**, no DOM, never imports
  from `js/ui/`. Unit conversion happens only in `js/app.js` (input edge) and
  `js/ui/format.js` (display edge).
- `js/ui/` — rendering and events, driven by `js/app.js`'s single render loop.
- `gutter` is `{ columns, rows }` — the gutter between columns and between rows.
- `js/app.js` keeps everything the worker entered under `state.job` in the current unit.

## Design decisions that look like bugs

- **Orientation as entered is authoritative.** Never auto-rotate to improve
  yield. A 3.5x2 card is 24-up on 12x18 but 25-up on 18x12; the worker has the
  physical sheet, so the tool offers a hint and they choose.
- **`[hidden] { display: none !important }`** (css/win98.css) is load-bearing:
  layout classes setting `display` otherwise beat the attribute.
- `applyRotation` deliberately leaves `state.fold.axis` alone — the axis is
  sheet-relative.
- **NPA, alignment, and offsets are sheet-relative and do not rotate with the sheet**, like the fold axis.

## Gotchas

- **Bump `VERSION` in `sw.js` whenever a cached file changes**, or installed
  phones keep serving the old build.
- Relative asset paths only (`./js/app.js`) — this is a GitHub *project* page
  served under a subpath, so absolute paths 404 in production but work locally.
- GitHub Pages must serve from `main` at `/` (the repo root). `/docs` holds
  only specs and plans; pointing Pages there fails every build.
