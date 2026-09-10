# Advanced Inputs — Design

**Date:** 2026-09-09
**Status:** Approved for planning
**Extends:** `2026-09-09-mobile-print-calculator-design.md` — this document revises
that spec's "alignment is always centered" decision and its "out of scope" list.

## Purpose

Production work rarely matches the idealised layout. The printer cannot put ink
on the outer 1/16" of a sheet, so a business card laid out edge to edge on
13×19 is wrong even though the maths fits. Some jobs want fewer documents than
fit, or want the block flush to one edge, or use a different gutter between
columns than between rows.

This adds an **Advanced** section for the non-printable area, a manual count,
and alignment with offsets; simplifies the sheet presets to the two sizes
actually used; adds a Rotate button to each size section; and makes asymmetric
gutters a first-class input. It also reworks naming and structure so the core
reads correctly to the next person.

## Two things that are not the same

**Margin** is the outside area between the physical sheet edge and the imposed
block. It is what the squaring cuts remove. Alignment and offset decide how big
each margin is.

**Non-printable area (NPA)** is a per-edge placement constraint — the printer
cannot print there, so no document may sit there. It changes how many documents
fit and where they can go. It never appears in the cut list.

Today a business card on 13×19 gives 9 rows: `9 × 2 + 8 × ⅛ = 19.000`, the
block spans the full sheet, and the outer rows sit on the physical edge. With
NPA 1/16" all round the placeable region is 12.875 × 18.875, so 8 rows fit:
24-up, centred, margins 1.0625". The count and placement changed; the sequence
is computed from those real margins exactly as before. The 1/16" is never cut —
it is inside the 1.0625" that comes off.

## Core model

### Inputs

All in inches at the core; the UI converts.

- `sheet`, `doc` — `{ width, length }` as today
- `gutter` — `{ columns, rows }`: the gutter between columns, and between rows
- `npa` — `{ top, bottom, left, right }`, each defaulting to 0.0625 (1/16")
- `count` — `{ across?, down? }`; an absent value means auto
- `align` — `{ top?, bottom?, left?, right? }` with the **offset as the value**.
  `{ top: 0, left: 0 }` is a flush corner; `{ bottom: 0.5 }` is half an inch
  off the foot, centred horizontally; `{}` is centred. At most one of
  top/bottom and one of left/right — the UI's two-row chips make both
  impossible to select, so `computeLayout` treats both-on-one-axis as a
  programmer error and throws `RangeError`. Offsets are measured from the
  **physical** sheet edge, not the printable boundary. An offset that pushes
  the block past the opposite edge is the existing no-fit path.

### Pipeline

`computeLayout(sheet, doc, gutter, options)` keeps one public entry point but is
built from four small pure functions, each tested on its own:

1. **`printableRegion(sheet, npa)`** — the sheet inset by each edge's NPA.
2. **`fitCount(printable, doc, gutter)`** — the most documents that fit the
   printable region; today's formula with the printable dimensions.
3. **`placeBlock(sheet, printable, block, align)`** — the four margins. Per
   axis: an edge chosen → that margin equals the offset and the far margin
   takes all the slack; no edge → equal slack either side *within the printable
   region*.
4. **`findViolations(margins, npa)`** — for each edge, if `npa − margin > 0`,
   record `{ edge, amount }`.

Between 2 and 3: **count** is the override if given, else auto. An override
must fit the *physical* sheet (`n × doc + (n − 1) × gutter ≤ sheet`); if it
cannot, that is the existing no-fit path. An override larger than auto but
still fitting the sheet is allowed and triggers the NPA warning.

Auto placement centres within the printable region, so it can never violate
NPA. Only a manual offset or manual count can — which is exactly where a
"did you mean this?" belongs.

### Output

Today's shape plus:

- `printable: { width, length }`
- `margins: { top, bottom, left, right }` — four, not two
- `auto: { across, down }` — so the UI can show "Auto (3)"
- `violations: [{ edge, amount }]`

### Sheet-relative, deliberately

NPA, alignment, and offset name sheet edges and do not rotate when the sheet is
rotated — the same rule the fold axis already follows. With a uniform NPA it
never matters; with an asymmetric one the worker adjusts after rotating.

### Orientation hint

`suggestOrientation` runs with the same options, since NPA can change which
orientation wins. It is **suppressed while a count override is active** — a
forced count is deliberate, and "turning fits 25-up" is noise against it.

## Sequence

### The squaring rule

**A squaring cut exists on an edge if and only if that edge's margin is greater
than zero.** Step 1 needs `margins.top`, step 2 `margins.left`, step 3
`margins.bottom`, step 4 `margins.right`. Absent cuts drop out; the relative
order of the rest is unchanged; turn bands derive from whatever actually
changes axis.

This also removes a latent quirk: the 27-up on 13×19 today emits two no-op
`19.000` cuts for its zero margins. Under this rule they vanish.

### Step shape

```text
{ n, axis: 'L'|'W', position, kind: 'margin', edge: 'top'|'left'|'bottom'|'right', turnBefore }
{ n, axis, position, kind: 'strip', turnBefore }
{ n, axis, position, kind: 'gutter', turnBefore }
```

Each kind names what the cut removes. Notes become exact: "Trim top margin",
"Cut off next strip", "Trim gutter".

### Verified fixtures

The two original fixtures (`TWO_UP`, `BUSINESS_CARD`) are unchanged: with
defaults — NPA 1/16" all round, centred, auto — symmetric NPA plus centring
yields the same margins as centring on the sheet, and 12×18 fits the same
24-up. They assert `[axis, position]` pairs, so the kind relabel does not
touch them.

**Third fixture — `FLUSH_TOP`, user-verified by hand:**

Business card 3.5×2 on 12×18, ⅛" gutters, NPA 1/16" except top = 0, aligned
`{ top: 0 }`, horizontally centred. 24-up, block 10.75 × 16.875. Margins:
top 0 · bottom 1.125 · left 0.625 · right 0.625.

| Step | Axis | Position | Kind |
| --- | --- | --- | --- |
| 1 | W | 11.375 | margin (left) |
| 2 | L | 16.875 | margin (bottom) |
| 3 | W | 10.750 | margin (right) |
| 4 | W | 7.125 | strip |
| 5 | W | 3.500 | strip |
| 6–7 | W | 3.500 | gutter ×2 |
| 8–14 | L | 14.750, 12.625, 10.500, 8.375, 6.250, 4.125, 2.000 | strip ×7 |
| 15–21 | L | 2.000 | gutter ×7 |

21 steps — the business card with its first cut removed — and three turns
(before steps 2, 3, and 8) instead of four.

## Naming and structure

### Renamed

| Current | New | Why |
| --- | --- | --- |
| `gutter.width` / `gutter.length` | `gutter.columns` / `gutter.rows` | A gutter is not a rectangle; "gutter length" means nothing. |
| `formatLength` | `formatMeasure` | `length` is the second dimension's name, so `formatLength(sheet.width)` reads as a contradiction. `formatShort` stays. |
| `kind: 'square' \| 'block' \| 'ladder' \| 'trim'` | `'margin' \| 'strip' \| 'gutter'` + `edge` | Each kind names what comes off. "block" was opaque; "ladder" was never the user's word. |
| `DEFAULT_JOB` + `FOLD_DEFAULTS` | one `DEFAULTS[unit]` | Two objects, opposite word order, same idea. |
| `inputs.js` / `foldControls.js` / `visualizer.js` | `sizeInputs.js` / `foldInputs.js` / `sheetView.js` | Inputs end in `Inputs`, outputs in `View`. New: `advancedInputs.js`. |
| `createFoldControls` / `createVisualizer` | `createFoldInputs` / `createSheetView` | Follow their files. |
| `state.{sheet,doc,gutter,fold,…}` | `state.job.{…}` | Everything the worker entered under one object. Unit toggle becomes "replace `job` with `DEFAULTS[unit]`"; `compute(job)` takes one argument. |

### Kept deliberately

`sheet`, `doc`, `across`, `down`, `imposed`, `length` (the user's vocabulary);
`L`/`W` (the operator's habit); `position` (not wrong; churning fixtures for a
synonym is not improvement); `npa` (the user's term; the UI spells it out);
`computeLayout`/`computeSequence`/`computeScores`, `parseMeasurement`,
`suggestOrientation`, `el()`, `turnBefore`, `fits`, `n`.

### Order of work

The rename pass runs **first, on the working code**, with the 53 green tests as
the net and identical values required. Features land on clean names.

## UI

### Main inputs

**Sheet:** `12 × 18` · `13 × 19` · `Custom` · **Rotate**. Metric: SRA3
`320 × 450` and A3 `297 × 420`. Rotate is an action button, not a selection
chip: it swaps the current value's width and length. If the result matches no
preset, Custom lights up showing `18 × 12`; rotate again and the `12 × 18`
chip is back.

**Document:** chips unchanged, plus **Rotate**. The orientation hint's "Turn
document" and this button call the same function.

**Gutter:** the two fields are **always visible**, labelled `Between columns`
and `Between rows`; the chips `⅛"` · `¼"` · `None` (metric: `3 mm` · `5 mm` ·
`None`) quick-fill both. Asymmetric
gutters are common, so the common case is one tap, not two. **Rotate** swaps
the fields. This is an option on the shared size-input component, not a
separate component.

### Advanced section

A group box after Gutter, before Scoring, **collapsed by default**. Its header
is a disclosure button that doubles as a live one-line summary —
`Advanced ▸ NPA 1/16 all round · Auto · Centered` by default, or for example
`Advanced ▸ NPA top 0 · 2 across · Top +0` once anything is changed — so an
override can never hide behind a closed panel.

Expanded:

1. **Non-printable area** — `Top` `Bottom` `Left` `Right`, each defaulting to
   1/16" (1.5 mm in metric).
2. **Count** — `Across` and `Down` fields whose placeholder reads the live auto
   value, e.g. `Auto (3)`. Empty means auto; a number overrides; clearing
   returns to auto.
3. **Alignment** — two chip rows, `Top` `Center` `Bottom` and
   `Left` `Center` `Right`, Center pressed by default. Choosing an edge reveals
   an offset field beside that row (`Offset from top`), defaulting to 0 — the
   trifold-allowance reveal pattern. Two rows of three is "select up to two"
   with the can't-pick-both rule built into the geometry.

Expansion is not remembered across loads but stays open while working.

### Warnings and fixes

All live in the Layout box alongside the no-fit explanation and the
orientation hint. **A warning never blanks the sequence** — layout, cuts, and
picture all still render, because the worker may be right.

**NPA violation** — one panel per affected axis, naming edge and amount, then
two fixes worded to the cause. The first trusts the NPA and moves the block;
the second trusts the placement and shrinks the NPA.

- From an offset: *"Top row sits 1/16" inside the non-printable area."* →
  `Offset → 1/16"` · `NPA top → 0`
- From a count override: *"Top and bottom rows sit 1/16" inside the
  non-printable area."* → `Back to auto (8 down)` · `NPA top & bottom → 0`

**No-fit** — unchanged, plus a new cause: an override the physical sheet
cannot hold. *"4 across won't fit: 4 × 3.5 + 3 × ⅛ = 14.375", sheet is 12"."*
→ `Back to auto (3)`.

### Summary and sheet view

The Layout summary gains `Printable 12.875 × 18.875` when any NPA is set, shows
all four margins (`1.063 head · 1.063 foot · 1.125 left · 1.125 right`), and
reads `24-up (auto would be 27)` while an override is active.

The sheet view draws the printable boundary as a thin dotted rectangle inset
from the sheet edge whenever any NPA is non-zero. In the normal case the block
sits inside it; in a violation the block visibly crosses it. Alignment needs
nothing new. Scores are untouched — they follow document positions.

## Testing

- Rename pass: all 53 existing tests pass with identical values; the one
  kind-ordering test updates its strings.
- New core tests, one per pipeline stage: printable region from per-edge NPA;
  fit count with NPA (13×19 card: 9 rows → 8); centring within an asymmetric
  printable region; offset placement; count override (smaller,
  larger-with-violation, larger-than-sheet); violation detection.
- Sequence iff rule: flush top drops one squaring cut; an exact fit drops both
  on that axis; a flush corner leaves two.
- `FLUSH_TOP` joins `TWO_UP` and `BUSINESS_CARD` as a hand-verified fixture.

## Out of scope

- Per-gap gutters (a different gutter between columns 1–2 than 2–3). The
  uniform ladder depends on a constant pitch.
- Remembering the Advanced section's expansion state across loads.
- Bleed, imposition marks, and gripper allowance — unchanged from the original
  spec.
