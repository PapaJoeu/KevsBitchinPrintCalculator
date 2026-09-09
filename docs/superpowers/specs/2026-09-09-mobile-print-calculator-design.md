# Mobile Print Calculator — Design

**Date:** 2026-09-09
**Status:** Approved for planning

## Purpose

A phone-first calculator for print production workers. A worker standing at a
guillotine cutter enters sheet size, document size, and gutter, and gets back the
imposition and the exact program sequence to key into the machine — plus score
and fold positions measured on the full sheet.

The existing app is a desktop two-column page whose program sequence is wrong.
This is a rebuild of the calculation core and the interface. The Windows XP
visual style is kept and rebuilt properly for touch.

## Why the current sequence is wrong

Verified by running `calculateProgramSequence` from `js/app.js` against known-good
jobs:

- **No auto-orientation.** 8.5x11 on 12x18 returns 1-up. The 2-up answer requires
  the operator to notice the document must be rotated to 11x8.5 and tap "Rotate
  Docs" by hand.
- **Trim cuts use a zero decrement.** `addMeasurements(count, docWidth, 0)` emits
  the document dimension repeatedly, producing the right idea with the wrong
  count — `count - 1` trims where `count` are needed.
- **Off by one in every direction.** A business card job with 8 rows produces 7
  cuts at 2.000"; the operator makes 8.
- **`Total Cuts` is `sequence.length`**, so the reported count inherits the error.

## The cutting model

Confirmed against two jobs the user knows by hand.

The operator squares the sheet, then works one axis at a time, **physically
turning the stack 90 degrees** whenever the axis changes. Each axis is cut in two
stages:

1. **Ladder.** The backgauge steps down by `(doc + gutter)`, peeling off one
   column or row per press. `n - 1` rungs for `n` documents.
2. **Gutter trim.** The gauge is set to the document dimension and each remaining
   piece has its gutter trimmed off.

**The final ladder rung is the first gutter trim.** The last rung already lands on
the document dimension, because the last piece has no gutter beyond it. So an axis
with `n` documents yields `n` total cuts at the document dimension, not `n + 1`.

**An axis with a single document gets no gutter trim** — with one document there is
no gutter in that direction.

**Every cut is its own step.** The list is keyed into the machine one step at a
time. Identical consecutive measurements are never collapsed into repeat counts;
eight cuts at 2.000" are eight numbered steps.

### Step generation

Given `across` and `down` documents, imposed block `impW x impL`, and margins:

```
1. [L] sheetLength - topMargin      square: trim head
2. [W] sheetWidth  - leftMargin     square: trim side
3. [L] impL                         trim to imposed length
4. [W] impW                         trim to imposed width

per axis (width first, then length):
   for i in 1..n-1:  position = imp - i * (doc + gutter)     ladder
   for k in 2..n:    position = doc                          gutter trim
   (skip trims entirely when n == 1)
```

Each step carries `{ n, axis, position, kind, turnBefore }`. `turnBefore` is true
when the axis differs from the previous step, so the UI marks turns without
re-deriving them.

### Verified fixtures

These are the regression tests. Both are user-verified by hand.

**2-up — 11x8.5 documents on 12x18, 1/8" gutters (1 across x 2 down):**

| Step | Axis | Position |
|---|---|---|
| 1 | L | 17.563" |
| 2 | W | 11.500" |
| 3 | L | 17.125" |
| 4 | W | 11.000" |
| 5 | L | 8.500" |
| 6 | L | 8.500" |

Six steps. The width axis has one document, so it gets no gutter trim.

**Business card — 3.5x2 on 12x18, 1/8" gutters (3 across x 8 down):**

22 steps. Squaring at 17.438 / 11.375 / 16.875 / 10.750, then the width axis
(ladder 7.125, then 3.500 three times total), then the length axis (ladder 14.750
down to 2.000, then 2.000 to eight total).

Cut counts at the document dimension: **8 at 2.000"**, **3 at 3.500"**.

## Architecture

### Calculation core — `js/core/`

Pure functions. No DOM, no formatting. All math in inches; unit conversion happens
at the display boundary.

- **`layout.js`** — `computeLayout(sheet, doc, gutter)` returns
  `{ across, down, imposed, margins, docs[] }`. Tries document and sheet rotations
  and returns the orientation yielding the highest n-up. Alignment is always
  centered.
- **`sequence.js`** — `computeSequence(layout)` returns the ordered step list per
  the rules above.
- **`scores.js`** — `computeScores(layout, foldSpec)` returns score positions in
  sheet coordinates, so they share a datum with the cuts.

Purity is the point: the two fixtures above become tests, and any change that
breaks them fails loudly. Given the sequence has been wrong in every prior
attempt, this regression net is the main protection for the rebuild.

### Folds

Named fold styles generating panel measurements, plus custom offsets:

- **Bifold** — one score at the halfway point.
- **Trifold** — two scores; the inside-folding panel is shortened by a wrap
  allowance so the panel tucks without buckling.
- **Z-fold** — two scores at equal thirds, no wrap allowance.
- **Custom** — one or more scores entered as **measurements**, not percentages.
  Multiple custom scores are supported and combine with a named style.

### UI — `js/ui/`

Rendering and event wiring, reading from the core. Split so no file grows into
another `app.js`: input controls, sequence display, visualizer, formatting.

Single scrolling column, thumb-reachable:

- Sheet, document, gutter — each a row of preset chips plus a "Custom" chip that
  reveals two number inputs.
- Inputs use `inputmode="decimal"` and accept fractions (`3 1/2`, `.125`), which is
  how measurements are written and spoken on the floor.
- Results below: n-up summary, visualizer, then the program sequence with the most
  vertical room and the largest type — readable at arm's length on a bench.
- **Turns are the visual anchor.** Every axis change gets a full-width band reading
  `TURN STACK 90°`. Missing a turn ruins the job, so it is not a subtle icon.
- Live recalculation on every input change. No calculate button.

Jobs are entered fresh each time; the default state is the business card job.

### Styling

Windows XP Luna, rebuilt rather than approximated: blue gradient title bars,
beveled 3D button borders, inset sunken field wells, Tahoma. Adapted for touch:

- 44px minimum tap targets. XP's real 21px buttons are unusable with a thumb — the
  styling is XP, the geometry is modern.
- Pressed and focus states replace hover, which does not exist on touch.
- One breakpoint up to a two-column desktop layout for bench computers. Phone is
  the design target and is built first.

### Delivery

Static site, plain ES modules, no build step, no dependencies. Deploys to GitHub
Pages as it does now.

- `node:test` for the core fixtures.
- Service worker and manifest, so it installs to a home screen and **works with no
  signal** — production floors have dead spots and this must work standing at the
  cutter.

## Error handling

Invalid or oversized input never throws into an `alert()`. When the document plus
gutter cannot fit the sheet in any orientation, the results area explains what
does not fit and what would need to change. Inputs are validated as typed;
partially entered values leave the last valid result on screen rather than
blanking it.

## Out of scope

- Alignment modes other than centered.
- Saved or recalled jobs.
- Bleed handling, imposition marks, and gripper allowance.
