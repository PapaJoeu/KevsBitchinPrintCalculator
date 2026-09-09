# Mobile Print Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the print calculator as a phone-first Windows 98 app whose guillotine program sequence is correct, verified by two hand-checked fixtures, with score/fold positions and an offline-capable shell.

**Architecture:** A pure calculation core (`js/core/`) does all math in inches and is covered by `node:test` fixtures. A thin UI layer (`js/ui/`) renders from a single state object in `js/app.js`; no framework, no build step. CSS is split into 98 theme primitives and page layout. A service worker caches the shell for offline use.

**Tech Stack:** Vanilla ES modules, CSS, Canvas 2D, `node:test` (Node 24 is installed), service worker + web manifest. No dependencies.

**Spec:** `docs/superpowers/specs/2026-09-09-mobile-print-calculator-design.md` — read it first; the plan argues from it.

## Global Constraints

- Static site, plain ES modules, **no build step, no dependencies**. `package.json` exists only for `"type": "module"` and scripts.
- **All core math in inches**; unit conversion happens only in `js/ui/format.js` and `js/app.js`.
- **Every cut is its own step.** Never collapse repeated measurements into counts.
- **Orientation as entered is authoritative.** Never rotate to improve yield; surface a hint instead.
- Cutting order: `[L]` square head, `[W]` square side, `[L]` imposed length, `[W]` imposed width, then the **width axis fully, then the length axis**. `L` is always the second dimension the worker typed.
- Per axis with `n` documents: `n-1` ladder rungs at `imp - i*(doc+gutter)`, then trims at `doc` for `k = 2..n`. **No trims when `n == 1`.**
- Trifold wrap allowance default **0.0625** (1/16"), editable. Z-fold is equal thirds.
- Default job: **3.5×2 on 12×18, 1/8" gutters** (24-up, 22 steps). **12×18 and 13×19 lead** the sheet presets.
- Palette: face `#c0c0c0`, title bar `#000080`, desktop `#008080`. **Square corners, no `border-radius`, no `transition`.** 44px minimum tap targets.
- Visualizer height capped at **`min(40vh, 360px)`**; canvas sized for `devicePixelRatio`.
- **Never `alert()`.** Unparseable input keeps the last valid result on screen; a valid job that does not fit shows an explanation.
- **Relative asset paths only** (`./js/app.js`, not `/js/app.js`). The site is a GitHub project page under `/KevsBitchinPrintCalculator/`, where absolute paths 404.
- Test command: `npm test` runs `node --test "tests/**/*.test.js"`. Single file: `node --test tests/<name>.test.js`.
- Every commit ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Decisions made while planning

These fill gaps the spec left open. Each is the physically sensible choice; the user can override any of them.

1. **Zero gutter → no trim cuts on that axis.** The trim stage removes the gutter; with none there is nothing to cut off. (The old code's `TODO: skip the repeated measurements if the gutter is 0` was reaching for this.)
2. **The in/mm unit toggle is kept** (existing feature). Toggling resets the job to that unit's defaults — jobs are entered fresh, and converting typed values would produce ugly numbers.
3. **A fold-direction control** ("Fold across: Length | Width", default Length) is needed for the spec's "both horizontal and vertical folds". Offsets run along the chosen document dimension.
4. **Trifold panel order:** tucked (short) panel first from the head; scores at `D/3 - a` and `2D/3 - a`.
5. **Custom score offsets** are measured from the head (or left edge, for width folds) of each document.
6. **Score positions** are measured from the sheet's head edge (length folds) or left edge (width folds).
7. **Orientation hint** offers the better of turning the document or the sheet; prefers the document on a tie.
8. **Document numbering** is row-major (reading order), matching the visualizer.
9. `inputmode="decimal"` shows a keypad without `/` on iOS; fractions still parse from desktop and Android keyboards, and the preset chips cover the common fractional sizes.

## File structure

```text
package.json                  "type": "module"; test + start scripts
index.html                    rewritten: single column, 98 chrome, group boxes
manifest.webmanifest          PWA manifest
sw.js                         service worker: cache-first app shell
css/win98.css                 theme primitives: palette, bevels, buttons, inputs, group box, focus
css/app.css                   page layout: window, chips, summary, visualizer, sequence, breakpoint
js/app.js                     state + render loop; the only place modules are wired together
js/core/measure.js            parseMeasurement, inchesToMm, mmToInches
js/core/layout.js             computeLayout, suggestOrientation
js/core/sequence.js           computeSequence
js/core/scores.js             foldOffsets, computeScores, DEFAULT_WRAP_ALLOWANCE
js/ui/dom.js                  el() helper
js/ui/format.js               formatLength, formatShort, unitName, stepNote
js/ui/presets.js              PRESETS, DEFAULT_JOB, FOLD_DEFAULTS
js/ui/inputs.js               createSizeInputs (one size section)
js/ui/foldControls.js         createFoldControls
js/ui/summaryView.js          renderSummary (n-up, no-fit explanation, orientation hint)
js/ui/sequenceView.js         renderSequence
js/ui/scoresView.js           renderScores
js/ui/visualizer.js           fitSheet, canLabel (pure); createVisualizer (canvas)
tools/serve.mjs               dependency-free static server for local dev
tools/make-icons.mjs          writes assets/icon-192.png and icon-512.png
tests/*.test.js               one file per core/ui module with logic
Deleted: css/style.css, js/defaultSizes.js, js/domElements.js
```

---

### Task 1: Test harness and measurement parsing

**Files:**
- Create: `package.json`
- Create: `js/core/measure.js`
- Test: `tests/measure.test.js`

**Interfaces:**
- Produces: `parseMeasurement(text: string): number | null`, `inchesToMm(n)`, `mmToInches(n)`, `MM_PER_INCH`.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "kevs-bitchin-print-calculator",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"tests/**/*.test.js\""
  }
}
```

- [ ] **Step 2: Write the failing test**

`tests/measure.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMeasurement, inchesToMm, mmToInches } from '../js/core/measure.js';

test('parses decimals as written on the floor', () => {
  assert.equal(parseMeasurement('3.5'), 3.5);
  assert.equal(parseMeasurement('.125'), 0.125);
  assert.equal(parseMeasurement('12'), 12);
  assert.equal(parseMeasurement('3.'), 3);
  assert.equal(parseMeasurement('  17.438 '), 17.438);
});

test('parses fractions and mixed numbers', () => {
  assert.equal(parseMeasurement('1/8'), 0.125);
  assert.equal(parseMeasurement('3 1/2'), 3.5);
  assert.equal(parseMeasurement('3-1/2'), 3.5);
  assert.equal(parseMeasurement('12 3/16'), 12.1875);
});

test('rejects text that is not a measurement', () => {
  for (const bad of ['', '   ', 'abc', '-3', '1/0', '3 abc', '3.5 1/2', '1/2 3', '3//4']) {
    assert.equal(parseMeasurement(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
  assert.equal(parseMeasurement(undefined), null);
  assert.equal(parseMeasurement(3.5), null);
});

test('converts between inches and millimetres', () => {
  assert.equal(inchesToMm(1), 25.4);
  assert.equal(mmToInches(25.4), 1);
  assert.equal(inchesToMm(12), 304.8);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node --test tests/measure.test.js`
Expected: FAIL — `Cannot find module '.../js/core/measure.js'`

- [ ] **Step 4: Implement measure.js**

`js/core/measure.js`:

```js
// measure.js — parse typed measurements and convert units. Pure; no DOM.

export const MM_PER_INCH = 25.4;

export const inchesToMm = (inches) => inches * MM_PER_INCH;
export const mmToInches = (mm) => mm / MM_PER_INCH;

const DECIMAL = /^(?:\d+\.?\d*|\.\d+)$/;
const FRACTION = /^(\d+)\/(\d+)$/;

function parseFraction(part) {
  const match = part.match(FRACTION);
  if (!match || Number(match[2]) === 0) return null;
  return Number(match[1]) / Number(match[2]);
}

/**
 * Parse a measurement as written on the floor: "3.5", ".125", "1/8", "3 1/2", "3-1/2".
 * Returns a non-negative number, or null when the text is not a measurement.
 */
export function parseMeasurement(text) {
  if (typeof text !== 'string') return null;
  const parts = text.trim().split(/[\s-]+/);
  if (parts.length === 1) {
    return DECIMAL.test(parts[0]) ? Number(parts[0]) : parseFraction(parts[0]);
  }
  if (parts.length === 2 && /^\d+$/.test(parts[0])) {
    const fraction = parseFraction(parts[1]);
    return fraction === null ? null : Number(parts[0]) + fraction;
  }
  return null;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: `ℹ pass 4`, `ℹ fail 0`

- [ ] **Step 6: Commit**

```bash
git add package.json js/core/measure.js tests/measure.test.js
git commit -F - <<'EOF'
Add measurement parsing and the node:test harness

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: Layout — centered imposition, orientation as entered

**Files:**
- Create: `js/core/layout.js`
- Test: `tests/layout.test.js`

**Interfaces:**
- Produces: `computeLayout(sheet, doc, gutter)` where each argument is `{ width, length }` in inches. Returns
  `{ fits: false, across, down, sheet, doc, gutter }` when nothing fits, otherwise
  `{ fits: true, across, down, imposed: { width, length }, margins: { left, top }, docs: [{ x, y, width, length }], sheet, doc, gutter }`.
  `docs` are row-major from the top-left. Throws `RangeError` for non-positive sheet/doc dimensions or negative gutters.

- [ ] **Step 1: Write the failing tests**

`tests/layout.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../js/core/layout.js';

const size = (width, length) => ({ width, length });
const EIGHTH = size(0.125, 0.125);

test('business card: 3.5x2 on 12x18 with 1/8" gutters is 3 across x 8 down', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH);
  assert.equal(layout.fits, true);
  assert.equal(layout.across, 3);
  assert.equal(layout.down, 8);
  assert.deepEqual(layout.imposed, { width: 10.75, length: 16.875 });
  assert.deepEqual(layout.margins, { left: 0.625, top: 0.5625 });
  assert.equal(layout.docs.length, 24);
});

test('documents are placed row by row from the top-left of the imposed block', () => {
  const { docs } = computeLayout(size(12, 18), size(3.5, 2), EIGHTH);
  assert.deepEqual(docs[0], { x: 0.625, y: 0.5625, width: 3.5, length: 2 });
  assert.deepEqual(docs[1], { x: 4.25, y: 0.5625, width: 3.5, length: 2 }); // next column
  assert.deepEqual(docs[3], { x: 0.625, y: 2.6875, width: 3.5, length: 2 }); // next row
});

test('2-up: 11x8.5 on 12x18 is 1 across x 2 down', () => {
  const layout = computeLayout(size(12, 18), size(11, 8.5), EIGHTH);
  assert.equal(layout.across, 1);
  assert.equal(layout.down, 2);
  assert.deepEqual(layout.imposed, { width: 11, length: 17.125 });
  assert.deepEqual(layout.margins, { left: 0.5, top: 0.4375 });
});

test('orientation is taken as entered: 8.5x11 on 12x18 is 1-up, never rotated to fit 2', () => {
  const layout = computeLayout(size(12, 18), size(8.5, 11), EIGHTH);
  assert.equal(layout.across * layout.down, 1);
});

test('zero gutter fills the sheet exactly with zero margins', () => {
  const layout = computeLayout(size(8.5, 11), size(4.25, 5.5), size(0, 0));
  assert.equal(layout.across, 2);
  assert.equal(layout.down, 2);
  assert.deepEqual(layout.margins, { left: 0, top: 0 });
});

test('an exact fit is not lost to floating point', () => {
  // 0.3 / 0.1 is 2.9999999999999996 in floating point; three still fit.
  const layout = computeLayout(size(0.3, 0.3), size(0.1, 0.1), size(0, 0));
  assert.equal(layout.across, 3);
});

test('reports what does not fit instead of throwing', () => {
  const tooWide = computeLayout(size(12, 18), size(13, 2), EIGHTH);
  assert.equal(tooWide.fits, false);
  assert.equal(tooWide.across, 0);
  assert.equal(tooWide.down, 8);
  const tooLong = computeLayout(size(8.5, 5.5), size(8.5, 11), size(0, 0));
  assert.deepEqual([tooLong.fits, tooLong.across, tooLong.down], [false, 1, 0]);
});

test('rejects impossible dimensions as programmer errors', () => {
  assert.throws(() => computeLayout(size(12, 18), size(0, 2), EIGHTH), RangeError);
  assert.throws(() => computeLayout(size(12, 18), size(3.5, 2), size(-1, 0)), RangeError);
  assert.throws(() => computeLayout(size(NaN, 18), size(3.5, 2), EIGHTH), RangeError);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/layout.test.js`
Expected: FAIL — `Cannot find module '.../js/core/layout.js'`

- [ ] **Step 3: Implement layout.js**

`js/core/layout.js`:

```js
// layout.js — centered imposition of documents on a sheet. Pure; all values in inches.
//
// Orientation is taken exactly as entered. A better yield often exists in the other
// orientation (3.5x2 is 24-up on 12x18 but 25-up on 18x12); reporting that is
// suggestOrientation's job, never computeLayout's.

const EPSILON = 1e-9;

function assertSize(name, size, { allowZero }) {
  for (const dim of ['width', 'length']) {
    const value = size[dim];
    const ok = Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
    if (!ok) {
      throw new RangeError(`${name}.${dim} must be ${allowZero ? 'zero or more' : 'greater than zero'}, got ${value}`);
    }
  }
}

function countAlong(sheetSize, docSize, gutterSize) {
  // n documents need n*doc + (n-1)*gutter <= sheet. The epsilon keeps an exact
  // fit (e.g. 0.3 / 0.1 = 2.9999999999999996) from losing a document.
  return Math.floor((sheetSize + gutterSize) / (docSize + gutterSize) + EPSILON);
}

/**
 * @param sheet   { width, length } inches, both > 0
 * @param doc     { width, length } inches, both > 0
 * @param gutter  { width, length } inches, both >= 0; width is between columns, length between rows
 */
export function computeLayout(sheet, doc, gutter) {
  assertSize('sheet', sheet, { allowZero: false });
  assertSize('doc', doc, { allowZero: false });
  assertSize('gutter', gutter, { allowZero: true });

  const across = countAlong(sheet.width, doc.width, gutter.width);
  const down = countAlong(sheet.length, doc.length, gutter.length);
  if (across < 1 || down < 1) {
    return { fits: false, across, down, sheet, doc, gutter };
  }

  const imposed = {
    width: doc.width * across + gutter.width * (across - 1),
    length: doc.length * down + gutter.length * (down - 1),
  };
  const margins = {
    left: (sheet.width - imposed.width) / 2,
    top: (sheet.length - imposed.length) / 2,
  };
  const docs = [];
  for (let row = 0; row < down; row++) {
    for (let col = 0; col < across; col++) {
      docs.push({
        x: margins.left + col * (doc.width + gutter.width),
        y: margins.top + row * (doc.length + gutter.length),
        width: doc.width,
        length: doc.length,
      });
    }
  }
  return { fits: true, across, down, imposed, margins, docs, sheet, doc, gutter };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/layout.test.js`
Expected: `ℹ pass 8`, `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add js/core/layout.js tests/layout.test.js
git commit -F - <<'EOF'
Add centered layout computation with orientation as entered

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: Layout — orientation suggestion

**Files:**
- Modify: `js/core/layout.js` (append)
- Test: `tests/layout.test.js` (append)

**Interfaces:**
- Consumes: `computeLayout` from Task 2.
- Produces: `suggestOrientation(sheet, doc, gutter): { rotate: 'doc' | 'sheet', count } | null`. Returns `null` when the entered orientation already fits the most.

- [ ] **Step 1: Append the failing tests**

Change the import line at the top of `tests/layout.test.js` to:

```js
import { computeLayout, suggestOrientation } from '../js/core/layout.js';
```

Append:

```js
test('suggests turning the document when that fits more', () => {
  // 3.5x2 on 12x18 is 24-up; 2x3.5 on 12x18 is 25-up.
  assert.deepEqual(suggestOrientation(size(12, 18), size(3.5, 2), EIGHTH), { rotate: 'doc', count: 25 });
});

test('suggests nothing when the entered orientation is already best', () => {
  assert.equal(suggestOrientation(size(12, 18), size(2, 3.5), EIGHTH), null);
});

test('prefers turning the document over the sheet on a tie', () => {
  // 8.5x11 on 12x18 is 1-up; either turn gives 2-up.
  assert.deepEqual(suggestOrientation(size(12, 18), size(8.5, 11), EIGHTH), { rotate: 'doc', count: 2 });
});

test('suggests turning the sheet when only that helps', () => {
  // Unequal gutters make the two turns differ: as entered 21-up, doc turned 20-up, sheet turned 25-up.
  assert.deepEqual(suggestOrientation(size(12, 18), size(3.5, 2), size(0.125, 0.5)), { rotate: 'sheet', count: 25 });
});

test('still suggests a turn when nothing fits as entered', () => {
  assert.deepEqual(suggestOrientation(size(8.5, 5.5), size(8.5, 5), size(0, 0)), null);
  assert.deepEqual(suggestOrientation(size(12, 6), size(5, 10), size(0, 0)), { rotate: 'doc', count: 1 });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/layout.test.js`
Expected: FAIL — `suggestOrientation is not a function` (or import error)

- [ ] **Step 3: Append the implementation**

Append to `js/core/layout.js`:

```js
const turned = ({ width, length }) => ({ width: length, length: width });

function countUp(sheet, doc, gutter) {
  const { across, down } = computeLayout(sheet, doc, gutter);
  return across * down;
}

/**
 * Whether turning the document or the sheet 90° would fit more documents.
 * Returns null when the entered orientation is already best, otherwise the better
 * turn as { rotate: 'doc' | 'sheet', count }. Ties prefer turning the document,
 * which leaves the sheet as it is fed.
 */
export function suggestOrientation(sheet, doc, gutter) {
  const current = countUp(sheet, doc, gutter);
  const candidates = [
    { rotate: 'doc', count: countUp(sheet, turned(doc), gutter) },
    { rotate: 'sheet', count: countUp(turned(sheet), doc, gutter) },
  ];
  const best = candidates.reduce((a, b) => (b.count > a.count ? b : a));
  return best.count > current ? best : null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/layout.test.js`
Expected: `ℹ pass 13`, `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add js/core/layout.js tests/layout.test.js
git commit -F - <<'EOF'
Suggest a better orientation without applying it

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 4: Program sequence

**Files:**
- Create: `js/core/sequence.js`
- Test: `tests/sequence.test.js`

**Interfaces:**
- Consumes: a `fits: true` layout from `computeLayout`.
- Produces: `computeSequence(layout): Step[]` where
  `Step = { n: number, axis: 'L' | 'W', position: number, kind: 'square' | 'block' | 'ladder' | 'trim', turnBefore: boolean }`.
  Throws `RangeError` if `layout.fits` is false.

- [ ] **Step 1: Write the failing tests**

`tests/sequence.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../js/core/layout.js';
import { computeSequence } from '../js/core/sequence.js';

const size = (width, length) => ({ width, length });
const EIGHTH = size(0.125, 0.125);
const cuts = (steps) => steps.map((s) => [s.axis, s.position]);

// User-verified by hand. See spec "Verified fixtures". Do not edit these numbers.
const TWO_UP = [
  ['L', 17.5625], ['W', 11.5], ['L', 17.125], ['W', 11], ['L', 8.5], ['L', 8.5],
];
const BUSINESS_CARD = [
  ['L', 17.4375], ['W', 11.375], ['L', 16.875], ['W', 10.75],
  ['W', 7.125], ['W', 3.5], ['W', 3.5], ['W', 3.5],
  ['L', 14.75], ['L', 12.625], ['L', 10.5], ['L', 8.375], ['L', 6.25], ['L', 4.125], ['L', 2],
  ['L', 2], ['L', 2], ['L', 2], ['L', 2], ['L', 2], ['L', 2], ['L', 2],
];

test('2-up fixture: 11x8.5 on 12x18 with 1/8" gutters', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(11, 8.5), EIGHTH));
  assert.deepEqual(cuts(steps), TWO_UP);
});

test('business card fixture: 3.5x2 on 12x18 with 1/8" gutters', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH));
  assert.deepEqual(cuts(steps), BUSINESS_CARD);
});

test('an axis with n documents ends with n cuts at the document dimension', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH));
  const at = (axis, position) => steps.filter((s) => s.axis === axis && s.position === position).length;
  assert.equal(at('L', 2), 8); // 8 rows
  assert.equal(at('W', 3.5), 3); // 3 columns
});

test('kinds run square, block, then ladder and trim per axis', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH));
  const kinds = steps.map((s) => s.kind);
  assert.deepEqual(kinds.slice(0, 4), ['square', 'square', 'block', 'block']);
  assert.deepEqual(kinds.slice(4, 8), ['ladder', 'ladder', 'trim', 'trim']);
  assert.deepEqual(kinds.slice(8, 15), Array(7).fill('ladder'));
  assert.deepEqual(kinds.slice(15), Array(7).fill('trim'));
});

test('steps are numbered from 1 and flag a turn whenever the axis changes', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(11, 8.5), EIGHTH));
  assert.deepEqual(steps.map((s) => s.n), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(steps.map((s) => s.turnBefore), [false, true, true, true, true, false]);
});

test('every cut is its own step; identical cuts are never collapsed', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH));
  assert.equal(steps.length, 22);
  assert.equal(new Set(steps.map((s) => s.n)).size, 22);
});

test('axis order follows the sheet as entered: an 18x12 sheet starts from the 12" side', () => {
  const steps = computeSequence(computeLayout(size(18, 12), size(3.5, 2), EIGHTH));
  assert.deepEqual([steps[0].axis, steps[0].position], ['L', 11.25]); // 12 - 0.75 top margin
  assert.deepEqual([steps[1].axis, steps[1].position], ['W', 18]); // 18 - 0 left margin
});

test('a single-document axis gets no gutter trim', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(11, 8.5), EIGHTH));
  assert.equal(steps.filter((s) => s.axis === 'W' && s.kind === 'trim').length, 0);
});

test('a zero gutter needs no trims: the ladder alone separates the pieces', () => {
  const steps = computeSequence(computeLayout(size(8.5, 11), size(4.25, 5.5), size(0, 0)));
  assert.deepEqual(cuts(steps), [['L', 11], ['W', 8.5], ['L', 11], ['W', 8.5], ['W', 4.25], ['L', 5.5]]);
});

test('refuses a layout that does not fit', () => {
  assert.throws(() => computeSequence(computeLayout(size(12, 18), size(13, 2), EIGHTH)), RangeError);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/sequence.test.js`
Expected: FAIL — `Cannot find module '.../js/core/sequence.js'`

- [ ] **Step 3: Implement sequence.js**

`js/core/sequence.js`:

```js
// sequence.js — the guillotine program sequence for a layout. Pure; all values in inches.
//
// The cutting model (spec "The cutting model"): square the sheet, then work one axis
// at a time, turning the stack whenever the axis changes. Each axis is a ladder of
// (doc + gutter) steps that peels off one strip per cut, followed by gutter trims at
// the document dimension. The final ladder rung lands on the document dimension and
// is the first trim, so an axis with n documents ends with n cuts at that dimension.
// Every cut is its own step: the list is keyed into the cutter one step at a time.

/**
 * @param layout  result of computeLayout with fits: true
 * @returns {Array<{ n, axis: 'L'|'W', position, kind: 'square'|'block'|'ladder'|'trim', turnBefore }>}
 *   Backgauge positions in the order they are keyed in. 'L' cuts run along the sheet
 *   length (the second dimension entered), 'W' along the width. turnBefore is true
 *   when the stack is turned 90° before this cut.
 */
export function computeSequence(layout) {
  if (!layout.fits) throw new RangeError('computeSequence needs a layout that fits');
  const { sheet, doc, gutter, imposed, margins, across, down } = layout;
  const steps = [];
  const cut = (axis, position, kind) => {
    const previous = steps.at(-1);
    steps.push({
      n: steps.length + 1,
      axis,
      position,
      kind,
      turnBefore: previous !== undefined && previous.axis !== axis,
    });
  };

  cut('L', sheet.length - margins.top, 'square');
  cut('W', sheet.width - margins.left, 'square');
  cut('L', imposed.length, 'block');
  cut('W', imposed.width, 'block');
  cutAxis(cut, 'W', imposed.width, doc.width, gutter.width, across);
  cutAxis(cut, 'L', imposed.length, doc.length, gutter.length, down);
  return steps;
}

function cutAxis(cut, axis, imposedSize, docSize, gutterSize, count) {
  for (let i = 1; i < count; i++) cut(axis, imposedSize - i * (docSize + gutterSize), 'ladder');
  if (gutterSize === 0) return; // nothing between the pieces to trim off
  for (let k = 2; k <= count; k++) cut(axis, docSize, 'trim');
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/sequence.test.js`
Expected: `ℹ pass 10`, `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add js/core/sequence.js tests/sequence.test.js
git commit -F - <<'EOF'
Add the program sequence with user-verified fixtures

Ladder plus gutter trims per axis; the final rung is the first trim, so an
axis with n documents ends with n cuts at the document dimension. Both
hand-verified jobs (2-up and 24-up business card) are pinned as tests.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 5: Scores and folds

**Files:**
- Create: `js/core/scores.js`
- Test: `tests/scores.test.js`

**Interfaces:**
- Consumes: a `fits: true` layout.
- Produces:
  - `DEFAULT_WRAP_ALLOWANCE = 0.0625`
  - `foldOffsets(style, size, allowance?)`: `number[]` for `style` in `'none' | 'bifold' | 'trifold' | 'zfold'`; throws `RangeError` otherwise.
  - `computeScores(layout, fold)` with `fold = { style, axis: 'L' | 'W', allowance, custom: number[] }` (inches). Returns `{ offsets: number[], positions: number[], segments: [{ docIndex, x1, y1, x2, y2 }] }`. Throws `RangeError` if `layout.fits` is false.

- [ ] **Step 1: Write the failing tests**

`tests/scores.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../js/core/layout.js';
import { computeScores, foldOffsets, DEFAULT_WRAP_ALLOWANCE } from '../js/core/scores.js';

const size = (width, length) => ({ width, length });
const EIGHTH = size(0.125, 0.125);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const closeAll = (actual, expected) => {
  assert.equal(actual.length, expected.length, `length ${actual.length} != ${expected.length}`);
  actual.forEach((v, i) => close(v, expected[i]));
};
const fold = (overrides) => ({ style: 'none', axis: 'L', allowance: DEFAULT_WRAP_ALLOWANCE, custom: [], ...overrides });

test('bifold scores at the halfway point', () => {
  closeAll(foldOffsets('bifold', 11), [5.5]);
});

test('trifold shortens the tucked panel by the wrap allowance and lengthens the cover', () => {
  const [first, second] = foldOffsets('trifold', 11);
  const panels = [first, second - first, 11 - second];
  closeAll(panels, [3.6041666667, 3.6666666667, 3.7291666667]);
  close(panels.reduce((a, b) => a + b), 11); // the allowance moves length, never adds it
});

test('trifold allowance is adjustable', () => {
  closeAll(foldOffsets('trifold', 11, 0.125), [11 / 3 - 0.125, 22 / 3 - 0.125]);
});

test('z-fold scores at equal thirds', () => {
  closeAll(foldOffsets('zfold', 11), [11 / 3, 22 / 3]);
});

test('no fold, no offsets; unknown styles are rejected', () => {
  assert.deepEqual(foldOffsets('none', 11), []);
  assert.throws(() => foldOffsets('gatefold', 11), RangeError);
});

test('scores land on each document in sheet coordinates', () => {
  const layout = computeLayout(size(12, 18), size(11, 8.5), EIGHTH); // 1 across x 2 down
  const { offsets, positions, segments } = computeScores(layout, fold({ style: 'bifold' }));
  closeAll(offsets, [4.25]);
  closeAll(positions, [4.6875, 13.3125]); // 0.4375 top margin + 4.25, then + 8.625 pitch
  assert.equal(segments.length, 2);
  assert.deepEqual(segments[0], { docIndex: 0, x1: 0.5, y1: 4.6875, x2: 11.5, y2: 4.6875 });
});

test('folding across the width draws vertical scores measured from the left edge', () => {
  const layout = computeLayout(size(12, 18), size(11, 8.5), EIGHTH);
  const { positions, segments } = computeScores(layout, fold({ style: 'bifold', axis: 'W' }));
  closeAll(positions, [6]); // 0.5 left margin + 5.5
  assert.deepEqual(segments[0], { docIndex: 0, x1: 6, y1: 0.4375, x2: 6, y2: 8.9375 });
});

test('positions are deduplicated across a row; segments are not', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH); // 3 across x 8 down
  const bifold = computeScores(layout, fold({ style: 'bifold' }));
  assert.equal(bifold.positions.length, 8);
  assert.equal(bifold.segments.length, 24);
  const trifold = computeScores(layout, fold({ style: 'trifold' }));
  assert.equal(trifold.segments.length, 48);
});

test('custom offsets are measurements, combine with a style, and are deduplicated', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH);
  closeAll(computeScores(layout, fold({ custom: [1.5, 0.5] })).offsets, [0.5, 1.5]);
  closeAll(computeScores(layout, fold({ style: 'bifold', custom: [0.5, 1] })).offsets, [0.5, 1]);
});

test('offsets outside the document are ignored', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH);
  assert.deepEqual(computeScores(layout, fold({ custom: [0, 2, 2.5] })).offsets, []);
});

test('refuses a layout that does not fit', () => {
  const layout = computeLayout(size(12, 18), size(13, 2), EIGHTH);
  assert.throws(() => computeScores(layout, fold({ style: 'bifold' })), RangeError);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/scores.test.js`
Expected: FAIL — `Cannot find module '.../js/core/scores.js'`

- [ ] **Step 3: Implement scores.js**

`js/core/scores.js`:

```js
// scores.js — score (fold) positions for every document, in sheet coordinates. Pure; inches.

/** Wrap allowance taken off the tucked trifold panel: 1/16". See spec "Folds". */
export const DEFAULT_WRAP_ALLOWANCE = 0.0625;

const EPSILON = 1e-9;

/**
 * Offsets of the scores within one document, measured along `size` from its head.
 * For a trifold the tucked panel comes first and is shortened by `allowance`; the
 * cover panel is lengthened by the same amount, so the panels still sum to `size`.
 */
export function foldOffsets(style, size, allowance = DEFAULT_WRAP_ALLOWANCE) {
  switch (style) {
    case 'none': return [];
    case 'bifold': return [size / 2];
    case 'trifold': return [size / 3 - allowance, (2 * size) / 3 - allowance];
    case 'zfold': return [size / 3, (2 * size) / 3];
    default: throw new RangeError(`Unknown fold style: ${style}`);
  }
}

/**
 * @param layout  result of computeLayout with fits: true
 * @param fold    { style, axis: 'L'|'W', allowance, custom: number[] } — inches.
 *   axis is the document dimension the offsets run along: 'L' folds the length
 *   (score lines cross the width), 'W' folds the width.
 * @returns { offsets, positions, segments }
 *   offsets   — within-document offsets, sorted, deduplicated, out-of-range dropped
 *   positions — distinct sheet positions of the scores, sorted: from the head edge
 *               for 'L', from the left edge for 'W'
 *   segments  — one line per score per document, { docIndex, x1, y1, x2, y2 }
 */
export function computeScores(layout, fold) {
  if (!layout.fits) throw new RangeError('computeScores needs a layout that fits');
  const alongWidth = fold.axis === 'W';
  const size = alongWidth ? layout.doc.width : layout.doc.length;
  const offsets = unique(
    [...foldOffsets(fold.style, size, fold.allowance), ...fold.custom].filter((o) => o > 0 && o < size),
  );
  const positions = [];
  const segments = [];
  layout.docs.forEach((d, docIndex) => {
    for (const offset of offsets) {
      if (alongWidth) {
        const x = d.x + offset;
        positions.push(x);
        segments.push({ docIndex, x1: x, y1: d.y, x2: x, y2: d.y + d.length });
      } else {
        const y = d.y + offset;
        positions.push(y);
        segments.push({ docIndex, x1: d.x, y1: y, x2: d.x + d.width, y2: y });
      }
    }
  });
  return { offsets, positions: unique(positions), segments };
}

function unique(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.filter((v, i) => i === 0 || v - sorted[i - 1] > EPSILON);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/scores.test.js`
Expected: `ℹ pass 11`, `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add js/core/scores.js tests/scores.test.js
git commit -F - <<'EOF'
Add fold styles and per-document score positions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 6: Display formatting and presets

**Files:**
- Create: `js/ui/format.js`
- Create: `js/ui/presets.js`
- Test: `tests/format.test.js`, `tests/presets.test.js`

**Interfaces:**
- Consumes: `inchesToMm` from Task 1.
- Produces:
  - `formatLength(inches, unit)` → `'17.563'` for `'in'`, `'446.1'` for `'mm'` (no unit label).
  - `formatShort(inches, unit)` → same, trailing zeros trimmed (`'12'`, `'10.75'`).
  - `unitName(unit)` → `'inches' | 'millimetres'`.
  - `stepNote(step)` → short description per `kind`/`axis`.
  - `PRESETS[unit][kind]`: arrays of `{ width, length }` in that unit, `kind` in `sheet | doc | gutter`.
  - `DEFAULT_JOB[unit]`: `{ sheet, doc, gutter }`.
  - `FOLD_DEFAULTS[unit]`: `{ style: 'none', axis: 'L', allowance, custom: [] }` in that unit.

- [ ] **Step 1: Write the failing tests**

`tests/format.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLength, formatShort, unitName, stepNote } from '../js/ui/format.js';

test('formats inches to three places and millimetres to one', () => {
  assert.equal(formatLength(17.5625, 'in'), '17.563');
  assert.equal(formatLength(2, 'in'), '2.000');
  assert.equal(formatLength(1, 'mm'), '25.4');
  assert.equal(formatLength(17.5625, 'mm'), '446.1');
});

test('short format drops trailing zeros but never significant ones', () => {
  assert.equal(formatShort(12, 'in'), '12');
  assert.equal(formatShort(10.75, 'in'), '10.75');
  assert.equal(formatShort(0.125, 'in'), '0.125');
  assert.equal(formatShort(100, 'in'), '100');
  assert.equal(formatShort(304.8 / 25.4, 'mm'), '304.8');
});

test('names units', () => {
  assert.equal(unitName('in'), 'inches');
  assert.equal(unitName('mm'), 'millimetres');
});

test('describes each kind of step', () => {
  const step = (axis, kind) => ({ n: 1, axis, position: 0, kind, turnBefore: false });
  assert.equal(stepNote(step('L', 'square')), 'Square up: trim head');
  assert.equal(stepNote(step('W', 'square')), 'Square up: trim side');
  assert.equal(stepNote(step('L', 'block')), 'Trim to imposed length');
  assert.equal(stepNote(step('W', 'block')), 'Trim to imposed width');
  assert.equal(stepNote(step('W', 'ladder')), 'Cut off next strip');
  assert.equal(stepNote(step('L', 'trim')), 'Trim gutter');
});
```

`tests/presets.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, DEFAULT_JOB, FOLD_DEFAULTS } from '../js/ui/presets.js';

test('12x18 and 13x19 lead the sheet presets', () => {
  assert.deepEqual(PRESETS.in.sheet.slice(0, 2), [{ width: 12, length: 18 }, { width: 13, length: 19 }]);
});

test('the default job is the business card on 12x18 with 1/8" gutters', () => {
  assert.deepEqual(DEFAULT_JOB.in, {
    sheet: { width: 12, length: 18 },
    doc: { width: 3.5, length: 2 },
    gutter: { width: 0.125, length: 0.125 },
  });
});

test('every default job value is one of its unit presets, so a chip is pressed on open', () => {
  for (const unit of ['in', 'mm']) {
    for (const kind of ['sheet', 'doc', 'gutter']) {
      const job = DEFAULT_JOB[unit][kind];
      assert.ok(
        PRESETS[unit][kind].some((p) => p.width === job.width && p.length === job.length),
        `${unit} ${kind} default ${JSON.stringify(job)} is not a preset`,
      );
    }
  }
});

test('folds default to off along the length, with a 1/16" trifold allowance', () => {
  assert.deepEqual(FOLD_DEFAULTS.in, { style: 'none', axis: 'L', allowance: 0.0625, custom: [] });
  assert.equal(FOLD_DEFAULTS.mm.style, 'none');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: the two new files FAIL with `Cannot find module`; earlier suites still pass.

- [ ] **Step 3: Implement format.js**

`js/ui/format.js`:

```js
// format.js — the display boundary. Core math is in inches; this turns it into text.
import { inchesToMm } from '../core/measure.js';

/** A length in the given unit, without a unit label: 17.5625 -> "17.563", or "446.1" in mm. */
export function formatLength(inches, unit) {
  return unit === 'mm' ? inchesToMm(inches).toFixed(1) : inches.toFixed(3);
}

/** formatLength with trailing zeros trimmed, for labels: 12 -> "12", 10.75 -> "10.75". */
export function formatShort(inches, unit) {
  const text = formatLength(inches, unit);
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

export function unitName(unit) {
  return unit === 'mm' ? 'millimetres' : 'inches';
}

/** A short note describing what a sequence step does. */
export function stepNote(step) {
  switch (step.kind) {
    case 'square': return step.axis === 'L' ? 'Square up: trim head' : 'Square up: trim side';
    case 'block': return step.axis === 'L' ? 'Trim to imposed length' : 'Trim to imposed width';
    case 'ladder': return 'Cut off next strip';
    case 'trim': return 'Trim gutter';
    default: return '';
  }
}
```

- [ ] **Step 4: Implement presets.js**

`js/ui/presets.js`:

```js
// presets.js — quick-select sizes and the default job, per unit.
// Sizes are { width, length } in the unit they belong to, not inches.

const size = (width, length) => ({ width, length });

export const PRESETS = {
  in: {
    // 12x18 and 13x19 lead: the common digital and small-press sheets (spec "UI").
    sheet: [size(12, 18), size(13, 19), size(8.5, 11), size(11, 17), size(17, 22), size(18, 24), size(26, 40)],
    doc: [size(3.5, 2), size(4.25, 5.5), size(5.5, 8.5), size(8.5, 11), size(11, 17)],
    gutter: [size(0.125, 0.125), size(0.25, 0.25), size(0, 0)],
  },
  mm: {
    // SRA3 leads for the same reason 12x18 does.
    sheet: [size(320, 450), size(297, 420), size(210, 297), size(420, 594), size(594, 841)],
    doc: [size(90, 55), size(105, 148), size(148, 210), size(210, 297), size(297, 420)],
    gutter: [size(3, 3), size(5, 5), size(0, 0)],
  },
};

/** The job on screen when the app opens: the business card. */
export const DEFAULT_JOB = {
  in: { sheet: size(12, 18), doc: size(3.5, 2), gutter: size(0.125, 0.125) },
  mm: { sheet: size(320, 450), doc: size(90, 55), gutter: size(3, 3) },
};

/** Fold settings per unit. The allowance is 1/16" (spec "Folds"); 1.5 mm is its metric round-off. */
export const FOLD_DEFAULTS = {
  in: { style: 'none', axis: 'L', allowance: 0.0625, custom: [] },
  mm: { style: 'none', axis: 'L', allowance: 1.5, custom: [] },
};
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test`
Expected: all suites pass; `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add js/ui/format.js js/ui/presets.js tests/format.test.js tests/presets.test.js
git commit -F - <<'EOF'
Add display formatting and unit presets

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 7: Windows 98 theme, page shell, and dev server

**Files:**
- Create: `css/win98.css`, `css/app.css`
- Rewrite: `index.html`
- Create: `tools/serve.mjs`
- Modify: `package.json` (add `start` script)
- Delete: `css/style.css`

**Interfaces:**
- Produces: element ids the UI modules render into: `unitChips`, `sheetInputs`, `docInputs`, `gutterInputs`, `foldControls`, `summary`, `canvas`, `legend`, `sequence`, `scores`. CSS classes: `chips`, `custom`, `hint`, `row`, `summary`, `nup`, `detail`, `panel`, `warning`, `hint-box`, `actions`, `visualizer`, `legend`, `swatch`, `seq-header`, `steps`, `step`, `step-n`, `step-pos`, `step-axis`, `step-note`, `turn`, `scores`. Buttons use `aria-pressed="true"` for the pressed/selected state.

- [ ] **Step 1: Write the theme primitives**

`css/win98.css`:

```css
/* win98.css — the Windows 98 look, rebuilt for touch. Square corners, two-tone
   bevels, no transitions. Geometry is modern (44px targets); only the styling is 98. */

:root {
  --face: #c0c0c0;
  --highlight: #ffffff;
  --light: #dfdfdf;
  --shadow: #808080;
  --dark: #000000;
  --navy: #000080;
  --desktop: #008080;
  --text: #000000;
  --disabled: #808080;
  --font: "MS Sans Serif", Tahoma, "Segoe UI", system-ui, sans-serif;
  --tap: 44px;
}

* { box-sizing: border-box; }

html { background: var(--desktop); }

body {
  margin: 0;
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.3;
  color: var(--text);
  background: var(--desktop);
  -webkit-text-size-adjust: 100%;
}

/* Window ------------------------------------------------------------------ */

.window {
  background: var(--face);
  border: 2px solid;
  border-color: var(--light) var(--dark) var(--dark) var(--light);
  box-shadow: inset -1px -1px var(--shadow), inset 1px 1px var(--highlight);
  padding: 3px;
}

.title-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 3px 4px 3px 8px;
  background: var(--navy);
  color: var(--highlight);
  font-weight: bold;
  user-select: none;
}

.title-bar h1 {
  flex: 1;
  margin: 0;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-bar .controls { display: flex; gap: 2px; }

.title-bar .controls button {
  width: 22px;
  height: 20px;
  min-width: 0;
  min-height: 0;
  padding: 0;
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
}

/* Buttons ----------------------------------------------------------------- */

button {
  font: inherit;
  color: var(--text);
  min-height: var(--tap);
  min-width: var(--tap);
  padding: 6px 12px;
  background: var(--face);
  border: 2px solid;
  border-color: var(--highlight) var(--dark) var(--dark) var(--highlight);
  box-shadow: inset -1px -1px var(--shadow), inset 1px 1px var(--light);
  border-radius: 0;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

/* Pressed: the inverted bevel with the one-pixel content shift. */
button:active,
button[aria-pressed="true"] {
  border-color: var(--dark) var(--highlight) var(--highlight) var(--dark);
  box-shadow: inset 1px 1px var(--shadow), inset -1px -1px var(--light);
  padding: 7px 11px 5px 13px;
}

/* Selected: the dithered "checked" face. */
button[aria-pressed="true"] {
  background-image: repeating-conic-gradient(var(--highlight) 0 25%, var(--face) 0 50%);
  background-size: 2px 2px;
}

button:disabled {
  color: var(--disabled);
  text-shadow: 1px 1px var(--highlight);
  cursor: default;
}

/* Inputs ------------------------------------------------------------------ */

input[type="text"] {
  font: inherit;
  font-size: 16px; /* stops iOS zooming the page on focus */
  color: var(--text);
  min-height: var(--tap);
  width: 100%;
  padding: 4px 8px;
  background: var(--highlight);
  border: 2px solid;
  border-color: var(--shadow) var(--highlight) var(--highlight) var(--shadow);
  box-shadow: inset 1px 1px var(--dark), inset -1px -1px var(--light);
  border-radius: 0;
  -webkit-appearance: none;
  appearance: none;
}

/* Focus: the dotted marquee, not a glow. */
button:focus-visible,
input:focus-visible {
  outline: 1px dotted var(--dark);
  outline-offset: -4px;
}

/* Group box --------------------------------------------------------------- */

fieldset.group {
  margin: 0;
  padding: 10px 8px 8px;
  min-width: 0;
  border: 1px solid var(--shadow);
  box-shadow: inset 1px 1px var(--highlight), 1px 1px var(--highlight);
}

fieldset.group > legend {
  padding: 0 4px;
  background: var(--face);
}

/* Panels ------------------------------------------------------------------ */

.panel {
  padding: 6px 8px;
  border: 1px solid;
  border-color: var(--shadow) var(--highlight) var(--highlight) var(--shadow);
}
```

- [ ] **Step 2: Write the page layout**

`css/app.css`:

```css
/* app.css — page layout for the calculator. Phone first; one breakpoint to two columns. */

.window { margin: 4px; }

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 2px;
}

main {
  display: grid;
  gap: 8px;
  padding: 2px;
}

.column {
  display: grid;
  gap: 8px;
  align-content: start;
  min-width: 0;
}

/* Chips */
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chips button { flex: 1 0 auto; padding-left: 10px; padding-right: 10px; white-space: nowrap; }

/* Custom size fields */
.custom {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 6px;
  align-items: end;
  margin-top: 8px;
}
.custom label { display: grid; gap: 2px; font-size: 12px; }
.custom .times { padding-bottom: 12px; }

.hint { margin: 6px 0 0; font-size: 12px; color: var(--navy); }

.row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.row > label { flex: 1; display: grid; gap: 2px; font-size: 12px; }

/* Summary */
.summary { display: grid; gap: 6px; }
.summary .nup { font-size: 28px; font-weight: bold; line-height: 1.1; }
.summary .detail { font-size: 13px; margin: 0; }
.summary .warning { background: var(--highlight); }
.summary .warning p { margin: 0 0 4px; }
.summary .hint-box { display: grid; gap: 6px; background: var(--highlight); }
.summary .hint-box p { margin: 0; }
.summary .actions { display: flex; gap: 6px; }

/* Visualizer: capped so it never pushes the sequence off screen */
.visualizer canvas {
  display: block;
  width: 100%;
  height: min(40vh, 360px);
}
.legend { display: flex; gap: 16px; margin-top: 6px; font-size: 12px; }
.legend .swatch {
  display: inline-block;
  width: 28px;
  margin-right: 4px;
  vertical-align: middle;
  border-top: 2px solid var(--navy);
}
.legend .swatch.score { border-top: 2px dashed #ff00ff; }

/* Sequence */
.seq-header { margin: 0 0 6px; font-size: 13px; }
ol.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
li.step {
  display: grid;
  grid-template-columns: 2.6rem 1fr auto;
  grid-template-areas: "n pos axis" "n note axis";
  align-items: center;
  column-gap: 8px;
  min-height: 52px;
  padding: 4px 6px;
  background: var(--highlight);
  border: 1px solid var(--shadow);
}
li.step .step-n { grid-area: n; text-align: center; color: var(--shadow); }
li.step .step-pos {
  grid-area: pos;
  font-size: 26px;
  font-weight: bold;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
li.step .step-note { grid-area: note; font-size: 12px; color: var(--shadow); }
li.step .step-axis {
  grid-area: axis;
  font-size: 12px;
  font-weight: bold;
  padding: 2px 6px;
  border: 1px solid var(--shadow);
}
li.turn {
  padding: 10px;
  background: var(--navy);
  color: var(--highlight);
  font-weight: bold;
  text-align: center;
  letter-spacing: 0.12em;
}

/* Scores */
table.scores {
  width: 100%;
  border-collapse: collapse;
  background: var(--highlight);
  font-variant-numeric: tabular-nums;
}
table.scores th, table.scores td { padding: 6px; border: 1px solid var(--shadow); text-align: left; }
table.scores th { background: var(--face); font-weight: normal; }

/* Two columns on a bench screen; phones stay single column */
@media (min-width: 900px) {
  .window { max-width: 1400px; margin: 12px auto; }
  main { grid-template-columns: minmax(320px, 1fr) minmax(0, 1.4fr); }
  .visualizer canvas { height: 360px; }
}
```

- [ ] **Step 3: Rewrite index.html**

Replace the whole file with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Kev's Bitchin' Print Calculator</title>
  <meta name="description" content="Print production calculator: imposition, guillotine program sequence, and score positions. Windows 98 style, built for phones.">
  <meta name="theme-color" content="#000080">
  <link rel="icon" href="assets/favicon.ico">
  <link rel="stylesheet" href="css/win98.css">
  <link rel="stylesheet" href="css/app.css">
</head>
<body>
  <div class="window">
    <header class="title-bar">
      <h1>Kev's Bitchin' Print Calculator</h1>
      <div class="controls" aria-hidden="true">
        <button type="button" tabindex="-1">_</button>
        <button type="button" tabindex="-1">□</button>
        <button type="button" tabindex="-1">×</button>
      </div>
    </header>

    <div class="toolbar">
      <span>Units</span>
      <div class="chips" id="unitChips" role="group" aria-label="Units">
        <button type="button" data-unit="in" aria-pressed="true">in</button>
        <button type="button" data-unit="mm" aria-pressed="false">mm</button>
      </div>
    </div>

    <main>
      <div class="column">
        <div id="sheetInputs"></div>
        <div id="docInputs"></div>
        <div id="gutterInputs"></div>
        <div id="foldControls"></div>
      </div>

      <div class="column">
        <fieldset class="group">
          <legend>Layout</legend>
          <div id="summary" class="summary"></div>
        </fieldset>

        <fieldset class="group visualizer">
          <legend>Sheet</legend>
          <canvas id="canvas" aria-label="Sheet layout preview"></canvas>
          <div id="legend" class="legend" hidden>
            <span><i class="swatch"></i>Document edge</span>
            <span><i class="swatch score"></i>Score line</span>
          </div>
        </fieldset>

        <fieldset class="group">
          <legend>Program sequence</legend>
          <div id="sequence"></div>
        </fieldset>

        <fieldset class="group">
          <legend>Scores</legend>
          <div id="scores"></div>
        </fieldset>
      </div>
    </main>
  </div>
</body>
</html>
```

(No script tag yet — Task 8 adds it with the rewritten `app.js`.)

- [ ] **Step 4: Add the dev server and start script**

`tools/serve.mjs`:

```js
// serve.mjs — a dependency-free static server for local development.
// ES modules will not load from file://, so the app needs an HTTP origin.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = join(ROOT, normalize(path === '/' ? '/index.html' : path));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}`));
```

Add to `package.json` scripts: `"start": "node tools/serve.mjs"`.

- [ ] **Step 5: Delete the old stylesheet**

```bash
git rm css/style.css
```

- [ ] **Step 6: Verify in the browser**

Run: `npm start`, open `http://localhost:8080` with DevTools device toolbar at 390×844 (iPhone-ish).

Check:
- Teal desktop, silver window with a navy title bar, white bold title, three boxy buttons.
- Group boxes ("Layout", "Sheet", "Program sequence", "Scores") show the etched frame with the legend breaking the top border.
- The `in` chip looks pressed (inverted bevel, dithered face); `mm` looks raised. Tapping does nothing yet.
- No rounded corners anywhere; no hover animation.
- Widen to 1200px: two columns appear.

- [ ] **Step 7: Commit**

```bash
git add index.html css/win98.css css/app.css tools/serve.mjs package.json
git commit -F - <<'EOF'
Rebuild the page shell in Windows 98 style for phones

Theme primitives (palette, two-tone bevels, group boxes, dotted focus) in
win98.css; single-column layout with one desktop breakpoint in app.css.
Adds a dependency-free dev server.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 8: Size inputs, app state, and the layout summary

**Files:**
- Create: `js/ui/dom.js`, `js/ui/inputs.js`, `js/ui/summaryView.js`
- Rewrite: `js/app.js`
- Modify: `index.html` (add script tag)
- Delete: `js/defaultSizes.js`, `js/domElements.js`

**Interfaces:**
- Consumes: `computeLayout`, `suggestOrientation`, `computeSequence`, `mmToInches`, `PRESETS`, `DEFAULT_JOB`, `FOLD_DEFAULTS`, `formatLength`.
- Produces:
  - `el(tag, attrs, ...children)` — attrs: `class`, any attribute, `hidden: true`, `dataset: {}`, `onclick`-style handlers.
  - `createSizeInputs(container, { label, allowZero?, onChange })` → `{ setPresets(presets, value), setValue(value) }`. `onChange({ width, length })` fires only with valid numbers. **The app must not call `setValue` in response to the section's own `onChange`** — that would overwrite text while the worker is typing.
  - `renderSummary(container, result, { unit, hintDismissed, onApply, onDismiss })` where `result = { layout, steps, suggestion, scores }`. Hint rendering is added in Task 12; the signature is final now.
  - `js/app.js` state: `{ unit, sheet, doc, gutter, fold, hintDismissed }`, sizes in the **current unit**; `compute()` converts to inches.

- [ ] **Step 1: Write dom.js**

`js/ui/dom.js`:

```js
// dom.js — the one DOM helper everything shares.

/**
 * el('button', { type: 'button', class: 'chip', onclick: handler }, 'Label')
 * Attributes: `hidden: true` sets the attribute, `dataset: {}` merges data-*,
 * `onxxx` functions become event listeners, false/null/undefined are skipped.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children);
  return node;
}
```

- [ ] **Step 2: Write inputs.js**

`js/ui/inputs.js`:

```js
// inputs.js — one size section: preset chips plus a Custom chip that reveals width/length fields.
import { el } from './dom.js';
import { parseMeasurement } from '../core/measure.js';

const sameSize = (a, b) => a.width === b.width && a.length === b.length;
const chipText = (size) => (size.width === 0 && size.length === 0 ? 'None' : `${size.width} × ${size.length}`);

/**
 * @param container  element to render into
 * @param options    { label, allowZero, onChange }
 *   onChange({ width, length }) fires only with valid numbers. Invalid typing
 *   leaves the previous value in force and shows a hint under the fields.
 * @returns { setPresets(presets, value), setValue(value) }
 */
export function createSizeInputs(container, { label, allowZero = false, onChange }) {
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': `${label} presets` });
  const widthInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} width` });
  const lengthInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} length` });
  const custom = el('div', { class: 'custom', hidden: true },
    el('label', {}, 'Width', widthInput),
    el('span', { class: 'times' }, '×'),
    el('label', {}, 'Length', lengthInput));
  const hint = el('p', { class: 'hint', hidden: true });
  container.replaceChildren(el('fieldset', { class: 'group' }, el('legend', {}, label), chips, custom, hint));

  let presets = [];
  let value = { width: 1, length: 1 };
  let customChip = null;

  function press(button) {
    for (const b of chips.children) b.setAttribute('aria-pressed', String(b === button));
  }

  function showCustom(show) {
    custom.hidden = !show;
    if (show) {
      widthInput.value = String(value.width);
      lengthInput.value = String(value.length);
    }
  }

  function renderChips() {
    const buttons = presets.map((preset) => {
      const button = el('button', { type: 'button', 'aria-pressed': 'false' }, chipText(preset));
      button.addEventListener('click', () => {
        value = preset;
        press(button);
        showCustom(false);
        hint.hidden = true;
        onChange(value);
      });
      return button;
    });
    customChip = el('button', { type: 'button', 'aria-pressed': 'false' }, 'Custom');
    customChip.addEventListener('click', () => {
      press(customChip);
      showCustom(true);
      widthInput.focus();
    });
    chips.replaceChildren(...buttons, customChip);
  }

  // Press the chip matching the value, or Custom with the fields filled in.
  function reflect() {
    const index = presets.findIndex((p) => sameSize(p, value));
    if (index >= 0) {
      press(chips.children[index]);
      showCustom(false);
    } else {
      press(customChip);
      showCustom(true);
    }
  }

  function readCustom() {
    const width = parseMeasurement(widthInput.value);
    const length = parseMeasurement(lengthInput.value);
    const valid = (n) => n !== null && (allowZero ? n >= 0 : n > 0);
    if (!valid(width) || !valid(length)) {
      hint.textContent = allowZero
        ? 'Enter a number like 0.125 or 1/8, or 0 for no gutter.'
        : 'Enter a number like 3.5 or 3 1/2.';
      hint.hidden = false;
      return;
    }
    hint.hidden = true;
    value = { width, length };
    onChange(value);
  }
  widthInput.addEventListener('input', readCustom);
  lengthInput.addEventListener('input', readCustom);

  return {
    setPresets(nextPresets, nextValue) {
      presets = nextPresets;
      value = nextValue;
      renderChips();
      reflect();
    },
    setValue(nextValue) {
      value = nextValue;
      reflect();
    },
  };
}
```

- [ ] **Step 3: Write summaryView.js (without the hint yet)**

`js/ui/summaryView.js`:

```js
// summaryView.js — the n-up line, imposed-block details, the no-fit explanation,
// and (Task 12) the better-orientation hint.
import { el } from './dom.js';
import { formatLength } from './format.js';

/**
 * @param result    { layout, steps, suggestion }
 * @param options   { unit, hintDismissed, onApply(rotate), onDismiss() }
 */
export function renderSummary(container, { layout, steps }, { unit }) {
  const fmt = (inches) => `${formatLength(inches, unit)} ${unit}`;
  if (!layout.fits) {
    container.replaceChildren(
      el('div', { class: 'nup' }, 'Does not fit'),
      el('div', { class: 'panel warning' }, ...explainNoFit(layout, fmt)),
    );
    return;
  }
  container.replaceChildren(
    el('div', { class: 'nup' }, `${layout.across * layout.down}-up`),
    el('p', { class: 'detail' }, `${layout.across} across × ${layout.down} down · ${steps.length} cuts`),
    el('p', { class: 'detail' },
      `Imposed ${fmt(layout.imposed.width)} × ${fmt(layout.imposed.length)} · margins ${fmt(layout.margins.left)} side, ${fmt(layout.margins.top)} head`),
  );
}

function explainNoFit({ sheet, doc, across, down }, fmt) {
  // across is 0 exactly when the document is wider than the sheet; the gutter only
  // applies between documents, so it never keeps the first one from fitting.
  const lines = [];
  if (across < 1) lines.push(`The document width (${fmt(doc.width)}) is wider than the sheet (${fmt(sheet.width)}).`);
  if (down < 1) lines.push(`The document length (${fmt(doc.length)}) is longer than the sheet (${fmt(sheet.length)}).`);
  lines.push('Turn the document, use a larger sheet, or use a smaller document.');
  return lines.map((text) => el('p', {}, text));
}
```

- [ ] **Step 4: Rewrite app.js**

`js/app.js`:

```js
// app.js — state and the render loop. Modules are wired together here and nowhere else.
import { computeLayout, suggestOrientation } from './core/layout.js';
import { computeSequence } from './core/sequence.js';
import { mmToInches } from './core/measure.js';
import { PRESETS, DEFAULT_JOB, FOLD_DEFAULTS } from './ui/presets.js';
import { createSizeInputs } from './ui/inputs.js';
import { renderSummary } from './ui/summaryView.js';

const $ = (id) => document.getElementById(id);

// Sizes live in the current unit exactly as entered; compute() converts to inches.
const state = {
  unit: 'in',
  ...structuredClone(DEFAULT_JOB.in),
  fold: structuredClone(FOLD_DEFAULTS.in),
  hintDismissed: false,
};

const sections = {
  sheet: createSizeInputs($('sheetInputs'), { label: 'Sheet', onChange: (sheet) => update({ sheet }) }),
  doc: createSizeInputs($('docInputs'), { label: 'Document', onChange: (doc) => update({ doc }) }),
  gutter: createSizeInputs($('gutterInputs'), { label: 'Gutter', allowZero: true, onChange: (gutter) => update({ gutter }) }),
};

const toInches = (value) => (state.unit === 'mm' ? mmToInches(value) : value);
const sizeToInches = (size) => ({ width: toInches(size.width), length: toInches(size.length) });

function compute() {
  const sheet = sizeToInches(state.sheet);
  const doc = sizeToInches(state.doc);
  const gutter = sizeToInches(state.gutter);
  const layout = computeLayout(sheet, doc, gutter);
  return {
    layout,
    suggestion: suggestOrientation(sheet, doc, gutter),
    steps: layout.fits ? computeSequence(layout) : [],
  };
}

function render() {
  const result = compute();
  renderSummary($('summary'), result, { unit: state.unit, hintDismissed: state.hintDismissed });
}

/** Apply a validated change to the job. Any change re-arms the orientation hint. */
function update(patch) {
  Object.assign(state, patch, { hintDismissed: false });
  render();
}

/** A new unit is a new job: reset to that unit's defaults (jobs are entered fresh). */
function setUnit(unit) {
  Object.assign(state, {
    unit,
    ...structuredClone(DEFAULT_JOB[unit]),
    fold: structuredClone(FOLD_DEFAULTS[unit]),
    hintDismissed: false,
  });
  for (const kind of ['sheet', 'doc', 'gutter']) sections[kind].setPresets(PRESETS[unit][kind], state[kind]);
  for (const button of $('unitChips').children) {
    button.setAttribute('aria-pressed', String(button.dataset.unit === unit));
  }
  render();
}

for (const button of $('unitChips').children) {
  button.addEventListener('click', () => setUnit(button.dataset.unit));
}

setUnit('in');
```

- [ ] **Step 5: Add the script tag and delete the old modules**

In `index.html`, before `</body>`:

```html
  <script type="module" src="./js/app.js"></script>
```

```bash
git rm js/defaultSizes.js js/domElements.js
```

- [ ] **Step 6: Verify in the browser**

`npm start`, open at 390px wide. Check:
- Sheet section shows chips `12 × 18`, `13 × 19`, ... with `12 × 18` pressed; Document has `3.5 × 2` pressed; Gutter has `0.125 × 0.125` pressed. Layout box reads **24-up**, `3 across × 8 down · 22 cuts`, `Imposed 10.750 in × 16.875 in`.
- Tap `13 × 19` → **27-up** (3 across × 9 down — nine rows at 2.125" pitch is exactly 19.125"). Tap document `8.5 × 11` → **1-up**.
- Tap Custom on Sheet: fields appear prefilled `13` / `19`. Type `abc` into width → hint appears, summary unchanged. Type `18` → summary updates live. Type `3 1/2` in document width → parsed.
- Set document to `13` × `2` → "Does not fit" with the width explanation.
- Tap `mm` → presets become metric, `320 × 450` pressed, summary in mm. Tap `in` → back to the business card.
- Console has no errors.

- [ ] **Step 7: Commit**

```bash
git add index.html js/app.js js/ui/dom.js js/ui/inputs.js js/ui/summaryView.js
git commit -F - <<'EOF'
Wire size inputs and the layout summary to the new core

Preset chips with a Custom reveal, fraction-aware validation that keeps
the last valid result on screen, unit toggle that resets to the unit's
defaults, and a no-fit explanation instead of alert().

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 9: Program sequence view

**Files:**
- Create: `js/ui/sequenceView.js`
- Modify: `js/app.js` (import + call in `render()`)

**Interfaces:**
- Consumes: `Step[]` from Task 4; `formatLength`, `formatShort`, `unitName`, `stepNote` from Task 6; `el`.
- Produces: `renderSequence(container, { layout, steps }, unit)`.

- [ ] **Step 1: Write sequenceView.js**

`js/ui/sequenceView.js`:

```js
// sequenceView.js — the program sequence as the operator keys it in: one row per cut,
// a full-width band wherever the stack turns. Repeated cuts are never collapsed.
import { el } from './dom.js';
import { formatLength, formatShort, unitName, stepNote } from './format.js';

export function renderSequence(container, { layout, steps }, unit) {
  if (!layout.fits) {
    container.replaceChildren();
    return;
  }
  const list = el('ol', { class: 'steps' });
  for (const step of steps) {
    if (step.turnBefore) list.append(el('li', { class: 'turn' }, 'TURN STACK 90°'));
    list.append(el('li', { class: `step step-${step.kind}` },
      el('span', { class: 'step-n' }, String(step.n)),
      el('span', { class: 'step-pos' }, formatLength(step.position, unit)),
      el('span', { class: 'step-axis', title: step.axis === 'L' ? 'Along the sheet length' : 'Along the sheet width' }, step.axis),
      el('span', { class: 'step-note' }, stepNote(step))));
  }
  const L = formatShort(layout.sheet.length, unit);
  const W = formatShort(layout.sheet.width, unit);
  container.replaceChildren(
    el('p', { class: 'seq-header' }, `${steps.length} cuts · gauge positions in ${unitName(unit)} · L = ${L} side, W = ${W} side`),
    list,
  );
}
```

- [ ] **Step 2: Wire it into app.js**

Add the import:

```js
import { renderSequence } from './ui/sequenceView.js';
```

In `render()`, after `renderSummary(...)`:

```js
  renderSequence($('sequence'), result, state.unit);
```

- [ ] **Step 3: Verify in the browser**

At 390px wide with the default job:
- Header: `22 cuts · gauge positions in inches · L = 18 side, W = 12 side`.
- 22 rows numbered 1–22; measurements in large bold type: `17.438`, `11.375`, `16.875`, `10.750`, `7.125`, `3.500` ×3, `14.750`, `12.625`, `10.500`, `8.375`, `6.250`, `4.125`, `2.000` ×8.
- Navy `TURN STACK 90°` bands before rows 2, 3, 4, and 9 — four bands, none before row 5.
- Tap document `8.5 × 11`, then Custom and swap to `11` × `8.5`: six rows `17.563, 11.500, 17.125, 11.000, 8.500, 8.500` with bands before 2, 3, 4, 5.
- Set gutter to `None`: no "Trim gutter" rows.

- [ ] **Step 4: Commit**

```bash
git add js/ui/sequenceView.js js/app.js
git commit -F - <<'EOF'
Render the program sequence with turn bands

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 10: Visualizer

**Files:**
- Create: `js/ui/visualizer.js`
- Test: `tests/visualizer.test.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: layout from Task 2; `{ segments }` from Task 5 (empty until Task 11); `formatShort`.
- Produces:
  - `fitSheet(cssWidth, cssHeight, sheet, pad = 18)` → `{ scale, x, y }` (pure).
  - `canLabel(docWidthPx, docLengthPx)` → boolean (pure).
  - `createVisualizer(canvas)` → `{ draw(layout, scores, format) }` where `format(inches)` returns label text.

- [ ] **Step 1: Write the failing tests for the pure helpers**

`tests/visualizer.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitSheet, canLabel } from '../js/ui/visualizer.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('fits a portrait sheet by height and centres it', () => {
  // 12x18 in 300x400 with 18px pad: scale = min(264/12, 364/18) = 364/18
  const { scale, x, y } = fitSheet(300, 400, { width: 12, length: 18 }, 18);
  close(scale, 364 / 18);
  close(x, (300 - 12 * scale) / 2);
  close(y, 18);
});

test('fits a landscape sheet by width', () => {
  const { scale, y } = fitSheet(300, 400, { width: 18, length: 12 }, 18);
  close(scale, 264 / 18);
  close(y, (400 - 12 * scale) / 2);
});

test('labels only documents big enough to read', () => {
  assert.equal(canLabel(59, 34), true); // a business card on 12x18 at phone size
  assert.equal(canLabel(26, 15), false); // the same card on a 26x40 sheet
  assert.equal(canLabel(25, 20), false);
  assert.equal(canLabel(40, 15), false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/visualizer.test.js`
Expected: FAIL — `Cannot find module '.../js/ui/visualizer.js'`

- [ ] **Step 3: Write visualizer.js**

`js/ui/visualizer.js`:

```js
// visualizer.js — the sheet preview: a confirmation glance, not a workspace (spec "Visualizer").
// fitSheet and canLabel are pure and tested; createVisualizer owns the canvas.

const PALETTE = {
  paper: '#ffffff',
  shadow: '#808080',
  ink: '#000000',
  doc: '#dfe3ee',
  docEdge: '#000080',
  score: '#ff00ff',
};
const PAD = 18;

/** Scale and offset that centre a sheet (inches) in a cssWidth x cssHeight box, leaving `pad` px clear. */
export function fitSheet(cssWidth, cssHeight, sheet, pad = PAD) {
  const scale = Math.min((cssWidth - 2 * pad) / sheet.width, (cssHeight - 2 * pad) / sheet.length);
  return {
    scale,
    x: (cssWidth - sheet.width * scale) / 2,
    y: (cssHeight - sheet.length * scale) / 2,
  };
}

/** Whether a document drawn at this pixel size can carry a legible number. */
export function canLabel(docWidthPx, docLengthPx) {
  return docWidthPx >= 26 && docLengthPx >= 16;
}

export function createVisualizer(canvas) {
  let current = null;

  function paint() {
    if (!current) return;
    const { layout, scores, format } = current;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (cssWidth === 0 || cssHeight === 0) return;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const { sheet } = layout;
    const { scale, x: ox, y: oy } = fitSheet(cssWidth, cssHeight, sheet);
    const X = (v) => ox + v * scale;
    const Y = (v) => oy + v * scale;
    const sw = sheet.width * scale;
    const sl = sheet.length * scale;

    // Paper with a hard 98 drop shadow.
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(ox + 3, oy + 3, sw, sl);
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(ox, oy, sw, sl);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, sw - 1, sl - 1);

    // Head marker: the edge the first cut squares.
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.moveTo(ox + sw / 2 - 5, oy - 9);
    ctx.lineTo(ox + sw / 2 + 5, oy - 9);
    ctx.lineTo(ox + sw / 2, oy - 3);
    ctx.closePath();
    ctx.fill();

    // Dimensions along the bottom and left edges, so a turned sheet is unmistakable.
    ctx.font = '11px Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(format(sheet.width), ox + sw / 2, oy + sl + 5);
    ctx.save();
    ctx.translate(ox - 5, oy + sl / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'bottom';
    ctx.fillText(format(sheet.length), 0, 0);
    ctx.restore();

    if (layout.fits) {
      const label = canLabel(layout.doc.width * scale, layout.doc.length * scale);
      ctx.font = `${Math.min(12, Math.max(9, (layout.doc.length * scale) / 3))}px Tahoma, sans-serif`;
      ctx.textBaseline = 'middle';
      layout.docs.forEach((d, i) => {
        const x = X(d.x);
        const y = Y(d.y);
        const w = d.width * scale;
        const l = d.length * scale;
        ctx.fillStyle = PALETTE.doc;
        ctx.fillRect(x, y, w, l);
        ctx.strokeStyle = PALETTE.docEdge;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, l - 1);
        if (label) {
          ctx.fillStyle = PALETTE.docEdge;
          ctx.fillText(String(i + 1), x + w / 2, y + l / 2);
        }
      });
    }

    // Scores: dashed magenta on each document, above the fill.
    if (scores.segments.length > 0) {
      ctx.save();
      ctx.strokeStyle = PALETTE.score;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (const s of scores.segments) {
        ctx.moveTo(X(s.x1), Y(s.y1));
        ctx.lineTo(X(s.x2), Y(s.y2));
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // Repaint on resize and orientation change; the CSS box decides the size.
  new ResizeObserver(paint).observe(canvas);

  return {
    /** Redraw for a new result. `format(inches)` gives the dimension label text. */
    draw(layout, scores, format) {
      current = { layout, scores, format };
      paint();
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/visualizer.test.js`
Expected: `ℹ pass 3`, `ℹ fail 0`

- [ ] **Step 5: Wire it into app.js**

Imports:

```js
import { createVisualizer } from './ui/visualizer.js';
import { formatShort } from './ui/format.js';
```

After `sections`:

```js
const visualizer = createVisualizer($('canvas'));
const NO_SCORES = { offsets: [], positions: [], segments: [] };
```

In `render()`, after `renderSequence(...)`:

```js
  visualizer.draw(result.layout, NO_SCORES, (inches) => formatShort(inches, state.unit));
```

- [ ] **Step 6: Verify in the browser**

At 390×844:
- The Sheet box is no taller than ~40% of the viewport; the 12×18 sheet is portrait, white on silver with a grey drop shadow, a black triangle at the head, `12` under the bottom edge, `18` up the left.
- 24 pale-blue panels with navy edges in a 3×8 grid, numbered 1–24 (each is about 59×34 px at this size — enough for a number).
- Sheet `26 × 40`: 126 panels about 26×15 px, **no numbers**. Back to `12 × 18`.
- Document `8.5 × 11`: one panel with a `1` in it. Document `5.5 × 8.5`: four numbered panels.
- Sheet Custom `18` × `12`: the sheet turns landscape; labels move with it.
- Zoom the browser to 200% and back — the drawing stays sharp (DPR) and re-fits (ResizeObserver).
- Document `13 × 2`: the empty sheet still draws under "Does not fit".

- [ ] **Step 7: Commit**

```bash
git add js/ui/visualizer.js tests/visualizer.test.js js/app.js
git commit -F - <<'EOF'
Add the sheet visualizer

DPR-aware canvas capped at 40% of the viewport, documents drawn in the 98
palette, labels only when legible, head marker and edge dimensions so a
turned sheet is obvious.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 11: Fold controls, score list, and scores on the visualizer

**Files:**
- Create: `js/ui/foldControls.js`, `js/ui/scoresView.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `computeScores` (Task 5), `parseMeasurement`, `formatLength`, `el`, `visualizer.draw` (Task 10), `FOLD_DEFAULTS`.
- Produces:
  - `createFoldControls(container, { onChange })` → `{ setValue(fold, unit), setDocSize(docSize) }`. `fold` values are in the **current unit**. `setValue` is called only on unit change (it writes the allowance field); `setDocSize` is called every render (no DOM writes).
  - `renderScores(container, { layout, scores }, fold, unit)`.

- [ ] **Step 1: Write foldControls.js**

`js/ui/foldControls.js`:

```js
// foldControls.js — fold style, fold direction, trifold wrap allowance, and custom score offsets.
import { el } from './dom.js';
import { parseMeasurement } from '../core/measure.js';

const STYLES = [['none', 'Off'], ['bifold', 'Bifold'], ['trifold', 'Trifold'], ['zfold', 'Z-fold']];
const AXES = [['L', 'Length'], ['W', 'Width']];

/**
 * @param options  { onChange(fold) }  fold = { style, axis, allowance, custom } in the current unit
 * @returns { setValue(fold, unit), setDocSize({ width, length }) }
 */
export function createFoldControls(container, { onChange }) {
  let value = { style: 'none', axis: 'L', allowance: 0, custom: [] };
  let unit = 'in';
  let docSize = { width: 1, length: 1 };

  const chipRow = (pairs, attr, pick) => {
    const row = el('div', { class: 'chips' });
    for (const [key, label] of pairs) {
      const button = el('button', { type: 'button', 'aria-pressed': 'false', dataset: { [attr]: key } }, label);
      button.addEventListener('click', () => pick(key));
      row.append(button);
    }
    return row;
  };
  const styleChips = chipRow(STYLES, 'style', (style) => emit({ style }));
  const axisChips = chipRow(AXES, 'axis', (axis) => emit({ axis }));

  const allowanceInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Wrap allowance' });
  const allowanceRow = el('div', { class: 'row', hidden: true }, el('label', {}, 'Wrap allowance off the tucked panel', allowanceInput));
  const customInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Custom score offset' });
  const addButton = el('button', { type: 'button' }, 'Add');
  const customRow = el('div', { class: 'row' }, el('label', {}, 'Custom score, from the head of each document', customInput), addButton);
  const customList = el('div', { class: 'chips' });
  const hint = el('p', { class: 'hint', hidden: true });

  container.replaceChildren(el('fieldset', { class: 'group' },
    el('legend', {}, 'Scoring'),
    styleChips,
    el('div', { class: 'row' }, el('span', {}, 'Fold across'), axisChips),
    allowanceRow,
    customRow,
    customList,
    hint));

  function press(row, attr, key) {
    for (const b of row.children) b.setAttribute('aria-pressed', String(b.dataset[attr] === key));
  }

  function reflect() {
    press(styleChips, 'style', value.style);
    press(axisChips, 'axis', value.axis);
    allowanceRow.hidden = value.style !== 'trifold';
    customList.replaceChildren(...value.custom.map((offset) => {
      const chip = el('button', { type: 'button', 'aria-label': `Remove score at ${offset} ${unit}` }, `${offset} ${unit} ×`);
      chip.addEventListener('click', () => emit({ custom: value.custom.filter((o) => o !== offset) }));
      return chip;
    }));
  }

  function emit(patch) {
    value = { ...value, ...patch };
    reflect();
    onChange(value);
  }

  allowanceInput.addEventListener('input', () => {
    const allowance = parseMeasurement(allowanceInput.value);
    if (allowance === null) return; // keep the last valid allowance
    value = { ...value, allowance };
    onChange(value);
  });

  function addCustom() {
    const offset = parseMeasurement(customInput.value);
    const size = value.axis === 'W' ? docSize.width : docSize.length;
    if (offset === null || offset <= 0 || offset >= size) {
      hint.textContent = `Enter a measurement between 0 and ${size} ${unit}.`;
      hint.hidden = false;
      return;
    }
    hint.hidden = true;
    customInput.value = '';
    if (!value.custom.includes(offset)) emit({ custom: [...value.custom, offset].sort((a, b) => a - b) });
  }
  addButton.addEventListener('click', addCustom);
  customInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCustom();
    }
  });

  return {
    setValue(fold, nextUnit) {
      value = fold;
      unit = nextUnit;
      allowanceInput.value = String(fold.allowance);
      hint.hidden = true;
      reflect();
    },
    setDocSize(nextDocSize) {
      docSize = nextDocSize;
    },
  };
}
```

- [ ] **Step 2: Write scoresView.js**

`js/ui/scoresView.js`:

```js
// scoresView.js — score positions on the full sheet, plus the offsets within each document.
import { el } from './dom.js';
import { formatLength } from './format.js';

export function renderScores(container, { layout, scores }, fold, unit) {
  if (!layout.fits || scores.positions.length === 0) {
    container.replaceChildren(el('p', { class: 'detail' }, 'No scores. Pick a fold style or add a custom score.'));
    return;
  }
  const edge = fold.axis === 'W' ? 'left edge' : 'head';
  const count = scores.positions.length;
  const within = scores.offsets.map((o) => formatLength(o, unit)).join(', ');
  container.replaceChildren(
    el('p', { class: 'detail' }, `${count} score${count === 1 ? '' : 's'} across the sheet · within each document: ${within} ${unit} from the ${edge}`),
    el('table', { class: 'scores' },
      el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, `From sheet ${edge} (${unit})`))),
      el('tbody', {}, ...scores.positions.map((p, i) => el('tr', {}, el('td', {}, String(i + 1)), el('td', {}, formatLength(p, unit)))))),
  );
}
```

- [ ] **Step 3: Wire scores through app.js**

Imports:

```js
import { computeScores } from './core/scores.js';
import { createFoldControls } from './ui/foldControls.js';
import { renderScores } from './ui/scoresView.js';
```

After `visualizer`:

```js
const foldControls = createFoldControls($('foldControls'), { onChange: (fold) => update({ fold }) });
```

Replace `compute()` with:

```js
function compute() {
  const sheet = sizeToInches(state.sheet);
  const doc = sizeToInches(state.doc);
  const gutter = sizeToInches(state.gutter);
  const layout = computeLayout(sheet, doc, gutter);
  const suggestion = suggestOrientation(sheet, doc, gutter);
  if (!layout.fits) return { layout, suggestion, steps: [], scores: NO_SCORES };
  const fold = {
    style: state.fold.style,
    axis: state.fold.axis,
    allowance: toInches(state.fold.allowance),
    custom: state.fold.custom.map(toInches),
  };
  return { layout, suggestion, steps: computeSequence(layout), scores: computeScores(layout, fold) };
}
```

Replace `render()` with:

```js
function render() {
  const result = compute();
  foldControls.setDocSize(state.doc);
  renderSummary($('summary'), result, { unit: state.unit, hintDismissed: state.hintDismissed });
  renderSequence($('sequence'), result, state.unit);
  renderScores($('scores'), result, state.fold, state.unit);
  visualizer.draw(result.layout, result.scores, (inches) => formatShort(inches, state.unit));
  $('legend').hidden = result.scores.segments.length === 0;
}
```

In `setUnit()`, after the `sections` loop:

```js
  foldControls.setValue(state.fold, unit);
```

- [ ] **Step 4: Verify in the browser**

At 390px with the default job:
- Scoring box shows `Off` pressed, `Length` pressed, no allowance field; Scores box says "No scores…"; no legend under the canvas.
- Tap `Bifold`: 24 dashed magenta lines appear, one across each card; legend appears; Scores table lists 8 positions (`1.563, 3.688, …`), header "From sheet head (in)".
- Tap `Width`: lines turn vertical; 3 positions from the left edge.
- Tap `Length`, then `Trifold`: allowance field shows `0.0625`; 48 lines on the sheet. Change allowance to `1/8` → the score table shifts. Type `x` → nothing changes.
- Tap `Off`, add custom `1` → one line per card at 1"; a chip `1 in ×` appears; tap it → gone. Add `5` → hint "between 0 and 2 in" (the card's length, because the fold runs along Length).
- Document `8.5 × 11`, `Trifold`, `Length`: two lines at `3.604` and `7.271` from the head of the single document (plus the top margin in the table).
- Tap `mm` then `in`: fold controls reset to Off.

- [ ] **Step 5: Commit**

```bash
git add js/ui/foldControls.js js/ui/scoresView.js js/app.js
git commit -F - <<'EOF'
Add fold controls, the score list, and scores on the visualizer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 12: Better-orientation hint

**Files:**
- Modify: `js/ui/summaryView.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `suggestion` from `suggestOrientation` (Task 3), `sections[kind].setValue` (Task 8).
- Produces: `renderSummary` now renders the hint and calls `onApply('doc' | 'sheet')` / `onDismiss()`.

- [ ] **Step 1: Add the hint to summaryView.js**

Replace the exported function with:

```js
export function renderSummary(container, { layout, steps, suggestion }, { unit, hintDismissed, onApply, onDismiss }) {
  const fmt = (inches) => `${formatLength(inches, unit)} ${unit}`;
  if (!layout.fits) {
    container.replaceChildren(
      el('div', { class: 'nup' }, 'Does not fit'),
      el('div', { class: 'panel warning' }, ...explainNoFit(layout, fmt)),
    );
  } else {
    container.replaceChildren(
      el('div', { class: 'nup' }, `${layout.across * layout.down}-up`),
      el('p', { class: 'detail' }, `${layout.across} across × ${layout.down} down · ${steps.length} cuts`),
      el('p', { class: 'detail' },
        `Imposed ${fmt(layout.imposed.width)} × ${fmt(layout.imposed.length)} · margins ${fmt(layout.margins.left)} side, ${fmt(layout.margins.top)} head`),
    );
  }
  if (suggestion && !hintDismissed) container.append(hintBox(suggestion, layout, { onApply, onDismiss }));
}

// The tool reports what the sheet as entered does; a better turn is offered, never applied.
function hintBox(suggestion, layout, { onApply, onDismiss }) {
  const what = suggestion.rotate === 'doc' ? 'document' : 'sheet';
  const current = layout.across * layout.down;
  const apply = el('button', { type: 'button' }, `Turn ${what}`);
  apply.addEventListener('click', () => onApply(suggestion.rotate));
  const dismiss = el('button', { type: 'button' }, 'Keep as entered');
  dismiss.addEventListener('click', onDismiss);
  return el('div', { class: 'panel hint-box' },
    el('p', {}, `Turning the ${what} fits ${suggestion.count}-up${current > 0 ? ` instead of ${current}-up` : ''}.`),
    el('div', { class: 'actions' }, apply, dismiss));
}
```

- [ ] **Step 2: Handle apply and dismiss in app.js**

Add after `update()`:

```js
/** Turn the sheet or document 90°. An external change, so it is echoed into the section. */
function applyRotation(which) {
  const turned = { width: state[which].length, length: state[which].width };
  sections[which].setValue(turned);
  update({ [which]: turned });
}

function dismissHint() {
  state.hintDismissed = true;
  render();
}
```

Change the `renderSummary` call in `render()` to:

```js
  renderSummary($('summary'), result, {
    unit: state.unit,
    hintDismissed: state.hintDismissed,
    onApply: applyRotation,
    onDismiss: dismissHint,
  });
```

- [ ] **Step 3: Verify in the browser**

- Default job: under the 24-up summary, a panel "Turning the document fits 25-up instead of 24-up." with `Turn document` and `Keep as entered`.
- `Keep as entered` → panel disappears; tap `13 × 19` → it returns, now reading "fits 30-up instead of 27-up" (re-armed by the change). Back to `12 × 18`.
- `Turn document` → Document section shows Custom pressed with `2` × `3.5`; summary **25-up** (5 × 5); the hint is gone. The sequence starts `18.000` then `11.250` — five rows of 3.5" fill the 18" length exactly, so the head margin is zero.
- Document `8.5 × 11`: "Turning the document fits 2-up instead of 1-up."
- Document Custom `13` × `2`: "Does not fit" plus "Turning the document fits 5-up." (no "instead of" when nothing fits). `Turn document` → **5-up** (5 across × 1 down). The hint's count must equal the summary after applying.

- [ ] **Step 4: Commit**

```bash
git add js/ui/summaryView.js js/app.js
git commit -F - <<'EOF'
Offer a better orientation without applying it

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 13: Offline shell — manifest, icons, service worker

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `tools/make-icons.mjs`, `assets/icon-192.png`, `assets/icon-512.png`
- Test: `tests/sw.test.js`, `tests/icons.test.js`
- Modify: `index.html`, `js/app.js`

**Interfaces:**
- Produces: `sw.js` with `const SHELL = [...]` listing every app file (the test enforces it) and a `VERSION` string to bump on every deploy.

- [ ] **Step 1: Write the failing tests**

`tests/icons.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('icons are PNGs of the declared size', () => {
  for (const size of [192, 512]) {
    const bytes = readFileSync(join(root, 'assets', `icon-${size}.png`));
    assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(bytes.readUInt32BE(16), size); // IHDR width
    assert.equal(bytes.readUInt32BE(20), size); // IHDR height
  }
});
```

`tests/sw.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function shellList() {
  const source = readFileSync(join(root, 'sw.js'), 'utf8');
  const match = source.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(match, 'sw.js must define const SHELL = [...]');
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function walk(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`./${dir}/${entry.name}`]));
}

test('the service worker caches every app file', () => {
  const shell = new Set(shellList());
  const expected = ['./index.html', './manifest.webmanifest', ...walk('css'), ...walk('js'), ...walk('assets')];
  for (const file of expected) assert.ok(shell.has(file), `${file} is missing from SHELL in sw.js`);
});

test('every cached path exists', () => {
  for (const entry of shellList()) {
    const path = entry === './' ? './index.html' : entry;
    assert.ok(existsSync(join(root, path)), `${entry} is listed in sw.js but does not exist`);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: `icons` fails with `ENOENT`, `sw` fails with `ENOENT` for `sw.js`.

- [ ] **Step 3: Write the icon generator and run it**

`tools/make-icons.mjs`:

```js
// make-icons.mjs — writes assets/icon-192.png and icon-512.png: a 98 window showing
// a sheet of imposed documents. Dependency-free PNG encoding via node:zlib.
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const TEAL = [0, 128, 128];
const FACE = [192, 192, 192];
const NAVY = [0, 0, 128];
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const DOC = [223, 227, 238];

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgb) {
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function paintIcon(size) {
  const px = Buffer.alloc(size * size * 3);
  const unit = size / 32; // draw on a 32-unit grid
  const rect = (x, y, w, h, [r, g, b]) => {
    const x0 = Math.round(x * unit);
    const y0 = Math.round(y * unit);
    const x1 = Math.round((x + w) * unit);
    const y1 = Math.round((y + h) * unit);
    for (let j = y0; j < y1; j++) {
      for (let i = x0; i < x1; i++) {
        const o = (j * size + i) * 3;
        px[o] = r;
        px[o + 1] = g;
        px[o + 2] = b;
      }
    }
  };
  rect(0, 0, 32, 32, TEAL);
  rect(2, 3, 28, 26, BLACK); // window outline
  rect(3, 4, 26, 24, FACE);
  rect(3, 4, 26, 4, NAVY); // title bar
  rect(6, 10, 20, 16, WHITE); // sheet
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      rect(7.5 + col * 9, 11.5 + row * 4.7, 7.5, 3.7, NAVY);
      rect(8 + col * 9, 12 + row * 4.7, 6.5, 2.7, DOC);
    }
  }
  return px;
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../assets/icon-${size}.png`, import.meta.url), encodePng(size, paintIcon(size)));
  console.log(`wrote assets/icon-${size}.png`);
}
```

Run: `node tools/make-icons.mjs`
Expected: two lines `wrote assets/icon-…`. Open `assets/icon-192.png` and confirm a teal square with a silver window, navy title bar, and a white sheet with six navy-edged panels.

- [ ] **Step 4: Write the manifest**

`manifest.webmanifest`:

```json
{
  "name": "Kev's Bitchin' Print Calculator",
  "short_name": "Print Calc",
  "description": "Imposition, guillotine program sequence, and score positions.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#008080",
  "theme_color": "#000080",
  "icons": [
    { "src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 5: Write the service worker**

`sw.js`:

```js
// sw.js — offline app shell. Cache-first so the app opens instantly with no signal.
// Bump VERSION on every deploy that changes a cached file; the old cache is dropped
// on activate and the open page reloads itself once (see app.js).
const VERSION = 'v1';
const CACHE = `printcalc-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/win98.css',
  './css/app.css',
  './js/app.js',
  './js/core/layout.js',
  './js/core/measure.js',
  './js/core/scores.js',
  './js/core/sequence.js',
  './js/ui/dom.js',
  './js/ui/foldControls.js',
  './js/ui/format.js',
  './js/ui/inputs.js',
  './js/ui/presets.js',
  './js/ui/scoresView.js',
  './js/ui/sequenceView.js',
  './js/ui/summaryView.js',
  './js/ui/visualizer.js',
  './assets/favicon.ico',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)),
  );
});
```

- [ ] **Step 6: Register it and add the manifest links**

In `index.html` `<head>`, after the `theme-color` meta:

```html
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="apple-touch-icon" href="assets/icon-192.png">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black">
```

At the end of `js/app.js`:

```js
// Offline shell. When a new version takes over an open page, reload once to run it.
if ('serviceWorker' in navigator) {
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
    hadController = true;
  });
  navigator.serviceWorker.register('./sw.js');
}
```

- [ ] **Step 7: Run the tests**

Run: `npm test`
Expected: all suites pass, `ℹ fail 0`. If `sw.test.js` reports a missing file, add it to `SHELL`.

- [ ] **Step 8: Verify offline in the browser**

`npm start`, open `http://localhost:8080`, DevTools → Application → Service Workers: `sw.js` activated. Application → Manifest: name, icons, `standalone`. Tick **Offline** in the Network panel, reload: the app loads and calculates. Untick Offline. In DevTools, tick "Update on reload" while developing so edits are not masked by the cache.

- [ ] **Step 9: Commit**

```bash
git add manifest.webmanifest sw.js tools/make-icons.mjs assets/icon-192.png assets/icon-512.png tests/sw.test.js tests/icons.test.js index.html js/app.js
git commit -F - <<'EOF'
Add the offline shell: manifest, icons, service worker

Cache-first shell with a version-keyed cache; a test keeps the cache list
in sync with the files on disk.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 14: README and final verification

**Files:**
- Rewrite: `README.md`

- [ ] **Step 1: Write the README**

`README.md`:

```markdown
# Kev's Bitchin' Print Calculator

A phone-first calculator for print production. Enter sheet, document, and gutter
sizes; get the imposition, the guillotine program sequence to key into the cutter,
and score positions for folds. Windows 98 style. Works offline once opened.

## Run locally

    npm start

Then open http://localhost:8080. ES modules need an HTTP origin, so `file://` will not work.

## Tests

    npm test

The core (`js/core/`) is pure and covered by `node:test`, including two
hand-verified program sequences (`tests/sequence.test.js`). Change the cutting
model only with those fixtures passing.

## Deploy

Push to `main`; GitHub Pages serves the repo root. **Bump `VERSION` in `sw.js`**
whenever a cached file changes, or phones keep the old build.

## Icons

    node tools/make-icons.mjs

## Design

- Spec: `docs/superpowers/specs/2026-09-09-mobile-print-calculator-design.md`
- Plan: `docs/superpowers/plans/2026-09-09-mobile-print-calculator.md`
```

- [ ] **Step 2: Run everything**

Run: `npm test`
Expected: every suite passes, `ℹ fail 0`.

Run: `git status`
Expected: only `README.md` modified; no stray files. Confirm `css/style.css`, `js/defaultSizes.js`, `js/domElements.js` are gone.

- [ ] **Step 3: Full browser pass**

`npm start`, at 390×844:
1. Opens on the business card: 24-up, 22 cuts, four turn bands, portrait sheet, the 25-up hint.
2. Every tap target is at least 44px tall (inspect a chip).
3. Nothing scrolls horizontally; the page body has no horizontal scrollbar.
4. Sequence rows are readable at arm's length (26px bold numbers).
5. Toggle `mm`: everything re-renders in millimetres with metric presets.

At 1200px wide: two columns, inputs left, results right, canvas 360px tall.

Offline (Network → Offline, reload): still works.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -F - <<'EOF'
Document how to run, test, and deploy the rebuilt calculator

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```
