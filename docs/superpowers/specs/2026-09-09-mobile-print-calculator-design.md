# Mobile Print Calculator — Design

**Date:** 2026-09-09
**Status:** Approved for planning

## Purpose

A phone-first calculator for print production workers. A worker standing at a
guillotine cutter enters sheet size, document size, and gutter, and gets back the
imposition and the exact program sequence to key into the machine — plus score
and fold positions measured on the full sheet.

The existing app is a desktop two-column page whose program sequence is wrong.
This is a rebuild of the calculation core and the interface. The Windows 98
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

**Axis order follows the sheet as entered.** Cutting starts along the length — the
second dimension the worker typed — and the width axis is fully cut before the
length axis. Rotating the sheet inputs therefore changes which side is cut first:
a 12x18 sheet starts from the 18" side, an 18x12 sheet from the 12" side. The
order is derived from the input, never fixed in the code.

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
  `{ across, down, imposed, margins, docs[] }`. Alignment is always centered.

  **Orientation as entered is authoritative.** The layout is computed for the sheet
  and document exactly as the worker typed them; it never silently rotates to
  improve yield. A 12x18 sheet is cut starting from the 18" side, and entering it
  as 18x12 starts from the 12" side instead.

  This matters because a better yield often exists in the other orientation — a
  3.5x2 card on 12x18 gives 24-up, while the same card on 18x12 gives 25-up. The
  worker has the physical sheet and the press setup in front of them; the tool
  reports what their sheet does, it does not overrule them.

  **A better orientation is surfaced, not applied.** When rotating the sheet or the
  document would yield more documents, the UI shows a dismissible hint naming the
  alternative and its n-up, with a control to apply it. The choice stays the
  worker's.
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
- **Trifold** — two scores. The inside-folding panel is shortened by a **1/16"
  (0.0625") wrap allowance** so it tucks without buckling; the allowance comes off
  the tucked panel and is added to the outer panel, keeping the overall length
  equal to the document. For a standard 8.5x11 letter trifold this gives panels of
  3.6042" / 3.6667" / 3.7292" rather than three flat 3.6667" thirds.

  1/16" is the safe general-purpose default: it covers text-weight and light card
  stock, which is the overwhelming majority of trifold work, and it errs toward
  tucking loosely rather than buckling. Heavy stock wants more. The allowance is an
  editable input carrying 1/16" as its default, so it can be raised for a thick job
  without a code change.
- **Z-fold** — two scores at equal thirds, no wrap allowance.
- **Custom** — one or more scores entered as **measurements**, not percentages.
  Multiple custom scores are supported and combine with a named style.

### UI — `js/ui/`

Rendering and event wiring, reading from the core. Split so no file grows into
another `app.js`: input controls, sequence display, visualizer, formatting.

Single scrolling column, thumb-reachable:

- Sheet, document, gutter — each a row of preset chips plus a "Custom" chip that
  reveals two number inputs.
- **12x18 and 13x19 lead the sheet row** as quick-select chips. They are the
  common digital and small-press sizes and must be reachable without scrolling the
  chip row; the remaining sheet presets follow them.
- Inputs use `inputmode="decimal"` and accept fractions (`3 1/2`, `.125`), which is
  how measurements are written and spoken on the floor.
- Results below: n-up summary, visualizer, then the program sequence with the most
  vertical room and the largest type — readable at arm's length on a bench.
- **Turns are the visual anchor.** Every axis change gets a full-width band reading
  `TURN STACK 90°`. Missing a turn ruins the job, so it is not a subtle icon.
- Live recalculation on every input change. No calculate button.
- A fold-style control — off, bifold, trifold, z-fold, plus custom offsets — sits
  between the inputs and the visualizer. Off is the default, and selecting a style
  updates both the score list and the visualizer live.

Jobs are entered fresh each time; the default state is the business card job.

#### Visualizer

**Goal: a confirmation glance, not a workspace.** The numbers are the deliverable;
the visualizer exists so a worker can tell in one look that the imposition matches
the job in their hands — right orientation, right count, folds where expected —
and catch a mistyped dimension before making an expensive cut. Everything below
follows from that.

**Placement and size.** Directly above the program sequence, so scrolling from
inputs to sequence passes through it. It is sized to fit fully on screen without
scrolling, capped at roughly 40% of viewport height, rather than sized by sheet
aspect ratio as it is now — a 12x18 sheet must not push the sequence below the
fold. The sheet is centered in the available box at whatever scale fits, with the
full sheet always visible. No panning, no zooming, no tapping parts.

**Rendering.** Canvas, sized for `devicePixelRatio` so it is sharp on phones — the
current implementation sizes from `clientWidth` alone and renders soft on every
device. Redrawn on input change and on resize or orientation change.

**What is drawn, in the 98 palette:**

- **Sheet** — white fill, one-pixel black border, with a subtle drop shadow to
  read as paper.
- **Documents** — filled panels with a blue border, clearly distinct from the
  sheet's white margin so the imposed block reads at a glance.
- **Gutters** — the space between documents, left as sheet-coloured. With a 1/8"
  gutter at phone scale this is roughly a pixel, so gutters are shown as gaps
  rather than labelled.
- **Document numbers** — retained, but drawn only when the scaled document is
  large enough to fit legible text. A 24-up business card sheet at phone size
  cannot carry 24 numbers, so labels are dropped rather than rendered as unreadable
  specks.
- **Orientation marker** — a small indicator of the sheet's grain or feed edge, so
  a rotated result is unmistakable.

**Scores and folds.** When a fold style is active, scores are drawn **on the
documents they belong to**, not as full-sheet rules — the current code spans every
score edge-to-edge across margins and gutters, which misrepresents where the score
actually falls. Each score is a dashed magenta line across its own document only.

- Scores run **perpendicular to the fold axis**, so both horizontal and vertical
  folds render correctly. The current implementation can only draw horizontal
  scores.
- Every score on every document is drawn, so a trifold on a 24-up sheet shows all
  48 score lines — this is what makes a wrong fold axis obvious immediately.
- Score lines sit above the document fill and are visually distinct from cut lines:
  **dashed magenta for scores, solid blue for document edges**, so a worker never
  confuses a fold with a trim.
- When no fold style is selected, no score lines are drawn and the visualizer is
  unchanged.

**Legend.** A compact legend beneath the canvas naming the two line treatments
(document edge, score line), shown only when scores are active. Colour alone must
not carry the distinction — the dash pattern does the work for anyone who cannot
separate blue from magenta under shop lighting.

### Styling

Windows 98, rebuilt rather than approximated. The 98 look suits a phone better
than later styles: flatter and more compact chrome costs less vertical space, and
hard-edged bevels stay legible at small sizes where gradients turn to mush.

- **The classic silver palette** — `#c0c0c0` face, `#000080` active title bar,
  `#008080` desktop ground.
- **Two-tone bevels, not rounded borders.** Raised controls take white and
  light-grey highlights on the top and left, dark-grey and black shadows on the
  bottom and right; sunken wells invert that. Square corners throughout, one-pixel
  borders, no border radius and no transitions.
- **Group boxes** with the etched inset frame and a label breaking the top border,
  replacing the current plain headings.
- **A title bar** in flat navy with white bold title text and the boxy control
  buttons. (98 used a solid fill; the gradient belongs to later styles.)
- **MS Sans Serif / Tahoma**, with a stack falling back to a system sans.

Adapted for touch:

- 44px minimum tap targets. The real thing's ~21px buttons are unusable with a
  thumb — the styling is 98, the geometry is modern.
- Pressed states use the authentic inverted bevel with the one-pixel content
  offset, replacing hover, which does not exist on touch.
- Focus rings are the dotted marquee outline rather than a modern glow.
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
