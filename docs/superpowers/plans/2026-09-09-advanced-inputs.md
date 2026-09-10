# Advanced Inputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add non-printable area, manual count, and alignment-with-offset to the layout core and an Advanced UI section; simplify sheet presets; add Rotate buttons; make asymmetric gutters first-class — after a naming pass that makes the core read correctly.

**Architecture:** `computeLayout(sheet, doc, gutter, options)` keeps one public entry point but becomes `printableRegion → fitCount → placeBlock → findViolations`, each a small pure function with its own tests. The sequence gains one rule — a squaring cut exists on an edge iff its margin > 0 — and a third hand-verified fixture. The UI gains `advancedInputs.js`; everything else is edited in place.

**Tech Stack:** Vanilla ES modules, `node:test`, Canvas 2D. No dependencies, no build step. Node 24.

**Spec:** `docs/superpowers/specs/2026-09-09-advanced-inputs-design.md` — read it first. It extends `2026-09-09-mobile-print-calculator-design.md`.

## Global Constraints

- **Rename first, on working code.** Tasks 1–2 change no behaviour; all 53 tests pass with identical values before any feature lands.
- **All core math in inches.** `js/core/` never imports from `js/ui/`. Conversion only in `js/app.js` (input edge) and `js/ui/format.js` (display edge).
- **The two original fixtures are untouchable.** `TWO_UP` (6 steps) and `BUSINESS_CARD` (22 steps) in `tests/sequence.test.js` assert `[axis, position]` pairs and must pass byte-identical throughout. `FLUSH_TOP` (21 steps) joins them in Task 6.
- **Squaring rule:** a margin cut exists on an edge iff that edge's margin > 0 (with `EPSILON = 1e-9`). Order among survivors is unchanged: top, left, bottom, right.
- **Every cut is its own step.** Never collapse repeats.
- **Orientation as entered is authoritative.** Never auto-rotate. NPA, alignment, and offsets are sheet-relative and do not rotate with the sheet.
- **Auto placement never violates NPA.** Only a manual offset or count can; the response is a warning with two fixes, never a silent correction. A warning never blanks the sequence.
- Names: `gutter.columns` / `gutter.rows`; step `kind` ∈ `'margin' | 'strip' | 'gutter'` with `edge` on margin cuts; `formatMeasure`; `DEFAULTS[unit]`; files `sizeInputs.js`, `foldInputs.js`, `sheetView.js`, `advancedInputs.js`; `state.job`.
- **Core NPA default is zero**; the *job* default is 1/16" (`DEFAULTS[unit].npa`). This keeps `computeLayout(sheet, doc, gutter)` backward compatible for every existing test. (Ruling: the spec's "defaulting to 0.0625" is satisfied at the job level.)
- `sw.js`: every task that renames or adds a cached file updates `SHELL`; `VERSION` bumps in Task 1 (`v2`) and Task 12 (`v3`). `tests/sw.test.js` enforces `SHELL` ↔ disk.
- Test command: `npm test` (`node --test "tests/**/*.test.js"`); single file `node --test tests/<name>.test.js`. `node --test tests/` does NOT work on Node 24.
- Browser checks use the screenshot skill: `python .claude/skills/screenshot/shoot.py <url> <w> <h> <out.png> [--eval JS] [--print JS] [--clip SEL]`. Plain `--window-size` lies about mobile layout. Dev server: `npm start` → `http://localhost:8080`.
- Every commit message ends with: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- Stage only the files each task names. Never `git add -A`.

## Decisions made while planning

1. **Core `npa` defaults to zero; job default is 1/16".** See above.
2. **A block larger than the printable region (only reachable via a count override) is clamped onto the sheet** when centred, so an asymmetric NPA cannot push it off an edge. An explicit offset is never clamped — if it pushes the block off the sheet, that is the no-fit path, per spec.
3. **Count override values must be positive integers**; `0` is a `RangeError`, not "auto". The UI sends `undefined` for an empty field.
4. **`suggestOrientation` compares auto counts** regardless of any override (it reads `layout.auto`), and only `npa` affects it. The app additionally suppresses the hint while an override is active, per spec.
5. **Preset chips may carry a `label`** (`⅛"`, `3 mm`) that is shown instead of `a × b`; the label is stripped when a chip's value is copied into the job.
6. **A `formatFraction` helper** renders sixteenths as fractions (`1/16`, `1/8`, `3 1/2`) for the Advanced header summary and hint text in inches; millimetres print as numbers.
7. **No-fit from an offset** (block pushed off the sheet) gets its own explanation and an `Offset → 0` fix, alongside the spec'd count case.
8. **Container id `foldControls` → `foldInputs`** in `index.html`, matching the file rename; the screenshot skill's selector table updates with it.

## File structure

```text
js/core/layout.js         printableRegion, fitCount, placeBlock, findViolations, computeLayout, suggestOrientation
js/core/sequence.js       computeSequence — iff rule, kinds margin/strip/gutter + edge
js/core/scores.js         unchanged
js/core/measure.js        unchanged
js/ui/format.js           formatMeasure (was formatLength), formatShort, formatFraction (new), unitName, stepNote
js/ui/presets.js          PRESETS (two sheets, labelled gutters), DEFAULTS[unit] (job incl. npa/count/align/fold)
js/ui/dom.js              unchanged
js/ui/sizeInputs.js       (was inputs.js) keys/labels/alwaysShowFields options, Rotate button, rotate()
js/ui/foldInputs.js       (was foldControls.js) createFoldInputs
js/ui/advancedInputs.js   NEW — NPA ×4, count ×2, alignment rows + offsets, disclosure header
js/ui/summaryView.js      printable line, four margins, auto-would-be, violation panels with fixes, no-fit causes
js/ui/sequenceView.js     formatMeasure
js/ui/scoresView.js       formatMeasure
js/ui/sheetView.js        (was visualizer.js) createSheetView, dotted printable boundary
js/app.js                 state.job, options through compute(), fix handlers, hint suppression
index.html                #foldInputs, #advancedInputs
css/app.css               advanced section styles
sw.js                     SHELL, VERSION
tests/layout.test.js      gutter helper, four margins
tests/printable.test.js   NEW — printableRegion, fitCount, NPA count, asymmetric centring
tests/count.test.js       NEW — override
tests/placement.test.js   NEW — align, offsets, violations, FLUSH_TOP layout
tests/sequence.test.js    kinds, FLUSH_TOP, iff rule
tests/scores.test.js      gutter helper
tests/format.test.js      formatMeasure, stepNote, formatFraction
tests/presets.test.js     DEFAULTS, two sheets
tests/sheetView.test.js   (was visualizer.test.js)
.claude/skills/screenshot/SKILL.md   selectors
CLAUDE.md, README.md      Task 12
```

---

### Task 1: File and function renames (no behaviour change)

**Files:**
- Rename: `js/ui/inputs.js` → `js/ui/sizeInputs.js`; `js/ui/foldControls.js` → `js/ui/foldInputs.js`; `js/ui/visualizer.js` → `js/ui/sheetView.js`; `tests/visualizer.test.js` → `tests/sheetView.test.js`
- Modify: `js/ui/format.js`, `js/ui/presets.js`, `js/ui/summaryView.js`, `js/ui/sequenceView.js`, `js/ui/scoresView.js`, `js/app.js`, `index.html`, `sw.js`, `.claude/skills/screenshot/SKILL.md`, `tests/format.test.js`, `tests/presets.test.js`

**Interfaces:**
- Produces: `formatMeasure(inches, unit)` (replaces `formatLength`); `createFoldInputs(container, { onChange })`; `createSheetView(canvas)`; `DEFAULTS[unit] = { sheet, doc, gutter, fold }`; `state.job`; container id `foldInputs`.

- [ ] **Step 1: Move the files with git so history follows**

```bash
git mv js/ui/inputs.js js/ui/sizeInputs.js
git mv js/ui/foldControls.js js/ui/foldInputs.js
git mv js/ui/visualizer.js js/ui/sheetView.js
git mv tests/visualizer.test.js tests/sheetView.test.js
```

- [ ] **Step 2: Rename inside the moved files**

`js/ui/sizeInputs.js` line 1:
```js
// sizeInputs.js — one size section: preset chips plus a Custom chip that reveals width/length fields.
```

`js/ui/foldInputs.js` line 1 and the export:
```js
// foldInputs.js — fold style, fold direction, trifold wrap allowance, and custom score offsets.
```
```js
export function createFoldInputs(container, { onChange }) {
```

`js/ui/sheetView.js` line 1–2 and the export:
```js
// sheetView.js — the sheet preview: a confirmation glance, not a workspace (spec "Visualizer").
// fitSheet and canLabel are pure and tested; createSheetView owns the canvas.
```
```js
export function createSheetView(canvas) {
```

`tests/sheetView.test.js` line 3:
```js
import { fitSheet, canLabel } from '../js/ui/sheetView.js';
```

- [ ] **Step 3: formatLength → formatMeasure**

`js/ui/format.js` — replace the first two functions:
```js
/** A measurement in the given unit, without a unit label: 17.5625 -> "17.563", or "446.1" in mm. */
export function formatMeasure(inches, unit) {
  return unit === 'mm' ? inchesToMm(inches).toFixed(1) : inches.toFixed(3);
}

/** formatMeasure with trailing zeros trimmed, for labels: 12 -> "12", 10.75 -> "10.75". */
export function formatShort(inches, unit) {
  const text = formatMeasure(inches, unit);
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}
```

In `js/ui/summaryView.js`, `js/ui/sequenceView.js`, `js/ui/scoresView.js`: change every `formatLength` to `formatMeasure` (import line and all call sites — `grep -n formatLength js/ui` must return nothing afterwards).

`tests/format.test.js` — import and the first test:
```js
import { formatMeasure, formatShort, unitName, stepNote } from '../js/ui/format.js';

test('formats inches to three places and millimetres to one', () => {
  assert.equal(formatMeasure(17.5625, 'in'), '17.563');
  assert.equal(formatMeasure(2, 'in'), '2.000');
  assert.equal(formatMeasure(1, 'mm'), '25.4');
  assert.equal(formatMeasure(17.5625, 'mm'), '446.1');
});
```

- [ ] **Step 4: One DEFAULTS object**

`js/ui/presets.js` — replace `DEFAULT_JOB` and `FOLD_DEFAULTS` with:
```js
/** Everything a job starts with, per unit. The trifold allowance is 1/16" (1.5 mm is its metric round-off). */
export const DEFAULTS = {
  in: {
    sheet: size(12, 18), doc: size(3.5, 2), gutter: size(0.125, 0.125),
    fold: { style: 'none', axis: 'L', allowance: 0.0625, custom: [] },
  },
  mm: {
    sheet: size(320, 450), doc: size(90, 55), gutter: size(3, 3),
    fold: { style: 'none', axis: 'L', allowance: 1.5, custom: [] },
  },
};
```

`tests/presets.test.js` — replace the file:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, DEFAULTS } from '../js/ui/presets.js';

test('12x18 and 13x19 lead the sheet presets', () => {
  assert.deepEqual(PRESETS.in.sheet.slice(0, 2), [{ width: 12, length: 18 }, { width: 13, length: 19 }]);
});

test('the default job is the business card on 12x18 with 1/8" gutters', () => {
  assert.deepEqual(DEFAULTS.in.sheet, { width: 12, length: 18 });
  assert.deepEqual(DEFAULTS.in.doc, { width: 3.5, length: 2 });
  assert.deepEqual(DEFAULTS.in.gutter, { width: 0.125, length: 0.125 });
});

test('every default size is one of its unit presets, so a chip is pressed on open', () => {
  for (const unit of ['in', 'mm']) {
    for (const kind of ['sheet', 'doc', 'gutter']) {
      const value = DEFAULTS[unit][kind];
      assert.ok(
        PRESETS[unit][kind].some((p) => JSON.stringify(p) === JSON.stringify(value)),
        `${unit} ${kind} default ${JSON.stringify(value)} is not a preset`,
      );
    }
  }
});

test('folds default to off along the length, with a 1/16" trifold allowance', () => {
  assert.deepEqual(DEFAULTS.in.fold, { style: 'none', axis: 'L', allowance: 0.0625, custom: [] });
  assert.equal(DEFAULTS.mm.fold.style, 'none');
});
```

- [ ] **Step 5: app.js — imports, state.job, and the new names**

Replace `js/app.js` from the top through the end of `setUnit` (keep the unit-chip wiring, `setUnit('in')`, and the service-worker block that follow, unchanged):
```js
// app.js — state and the render loop. Modules are wired together here and nowhere else.
import { computeLayout, suggestOrientation } from './core/layout.js';
import { computeSequence } from './core/sequence.js';
import { computeScores } from './core/scores.js';
import { mmToInches } from './core/measure.js';
import { PRESETS, DEFAULTS } from './ui/presets.js';
import { createSizeInputs } from './ui/sizeInputs.js';
import { createFoldInputs } from './ui/foldInputs.js';
import { renderSummary } from './ui/summaryView.js';
import { renderSequence } from './ui/sequenceView.js';
import { renderScores } from './ui/scoresView.js';
import { createSheetView } from './ui/sheetView.js';
import { formatShort } from './ui/format.js';

const $ = (id) => document.getElementById(id);

// The job is everything the worker entered, in the current unit exactly as typed;
// compute() converts to inches at the boundary.
const state = {
  unit: 'in',
  job: structuredClone(DEFAULTS.in),
  hintDismissed: false,
};

const sections = {
  sheet: createSizeInputs($('sheetInputs'), { label: 'Sheet', onChange: (sheet) => update({ sheet }) }),
  doc: createSizeInputs($('docInputs'), { label: 'Document', onChange: (doc) => update({ doc }) }),
  gutter: createSizeInputs($('gutterInputs'), { label: 'Gutter', allowZero: true, onChange: (gutter) => update({ gutter }) }),
};
const foldInputs = createFoldInputs($('foldInputs'), { onChange: (fold) => update({ fold }) });
const sheetView = createSheetView($('canvas'));
const NO_SCORES = { offsets: [], positions: [], segments: [] };

const toInches = (value) => (state.unit === 'mm' ? mmToInches(value) : value);
const sizeToInches = (size) => ({ width: toInches(size.width), length: toInches(size.length) });

function compute(job) {
  const sheet = sizeToInches(job.sheet);
  const doc = sizeToInches(job.doc);
  const gutter = sizeToInches(job.gutter);
  const layout = computeLayout(sheet, doc, gutter);
  const suggestion = suggestOrientation(sheet, doc, gutter);
  if (!layout.fits) return { layout, suggestion, steps: [], scores: NO_SCORES };
  const fold = {
    style: job.fold.style,
    axis: job.fold.axis,
    allowance: toInches(job.fold.allowance),
    custom: job.fold.custom.map(toInches),
  };
  return { layout, suggestion, steps: computeSequence(layout), scores: computeScores(layout, fold) };
}

function render() {
  const result = compute(state.job);
  foldInputs.setDocSize(state.job.doc);
  renderSummary($('summary'), result, {
    unit: state.unit,
    hintDismissed: state.hintDismissed,
    onApply: applyRotation,
    onDismiss: dismissHint,
  });
  renderSequence($('sequence'), result, state.unit);
  renderScores($('scores'), result, state.job.fold, state.unit);
  sheetView.draw(result.layout, result.scores, (inches) => formatShort(inches, state.unit));
  $('legend').hidden = result.scores.segments.length === 0;
}

/** Apply a validated change to the job. Any change re-arms the orientation hint. */
function update(patch) {
  Object.assign(state.job, patch);
  state.hintDismissed = false;
  render();
}

/** Turn the sheet or document 90°. An external change, so it is echoed into the section. */
function applyRotation(which) {
  // job.fold.axis is deliberately left alone: it names a sheet-relative direction
  // ('L' along the sheet length, 'W' along the width), not a direction relative to
  // this document, so rotating the document does not change what the axis means.
  const turned = { width: state.job[which].length, length: state.job[which].width };
  sections[which].setValue(turned);
  update({ [which]: turned });
}

function dismissHint() {
  state.hintDismissed = true;
  render();
}

/** A new unit is a new job: reset to that unit's defaults (jobs are entered fresh). */
function setUnit(unit) {
  state.unit = unit;
  state.job = structuredClone(DEFAULTS[unit]);
  state.hintDismissed = false;
  for (const kind of ['sheet', 'doc', 'gutter']) sections[kind].setPresets(PRESETS[unit][kind], state.job[kind]);
  foldInputs.setValue(state.job.fold, unit);
  for (const button of $('unitChips').children) {
    button.setAttribute('aria-pressed', String(button.dataset.unit === unit));
  }
  render();
}
```

- [ ] **Step 6: The container id, the cache list, the skill selectors**

`index.html`: `<div id="foldControls"></div>` → `<div id="foldInputs"></div>`.

`sw.js`: `const VERSION = 'v2';` and in `SHELL` replace the three moved entries:
```js
  './js/ui/foldInputs.js',
  './js/ui/sizeInputs.js',
  './js/ui/sheetView.js',
```
(remove `./js/ui/foldControls.js`, `./js/ui/inputs.js`, `./js/ui/visualizer.js`; keep the list alphabetical within `js/ui/`).

`.claude/skills/screenshot/SKILL.md`: every `#foldControls` → `#foldInputs` (the selector table and both usage examples).

- [ ] **Step 7: Verify nothing changed**

Run: `grep -rn "formatLength\|createFoldControls\|createVisualizer\|DEFAULT_JOB\|FOLD_DEFAULTS\|foldControls\|inputs\.js\|visualizer" js tests index.html sw.js .claude`
Expected: no output.

Run: `npm test`
Expected: `ℹ tests 53`, `ℹ pass 53`, `ℹ fail 0`.

Run: `npm start` (if not running), then
`python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t1.png --print "document.querySelector('#summary .nup').textContent" --print "document.querySelectorAll('li.step').length" --print "document.querySelectorAll('#foldInputs button').length"`
Expected: `24-up`, `22`, and a non-zero button count (the fold section rendered into its renamed container). Zero console errors — check with `--print "window.__errs||'none'"` after adding `window.addEventListener('error',e=>window.__errs=(window.__errs||'')+e.message)` via `--eval` first if desired.

- [ ] **Step 8: Commit**

```bash
git add js/ui/sizeInputs.js js/ui/foldInputs.js js/ui/sheetView.js tests/sheetView.test.js js/ui/format.js js/ui/presets.js js/ui/summaryView.js js/ui/sequenceView.js js/ui/scoresView.js js/app.js index.html sw.js .claude/skills/screenshot/SKILL.md tests/format.test.js tests/presets.test.js
git commit -F - <<'EOF'
Rename UI modules and helpers for consistency

Inputs end in Inputs, outputs in View; formatMeasure no longer collides
with the length dimension; one DEFAULTS object per unit; the job lives
under state.job. No behaviour change: 53/53 identical.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: Core renames — gutter.columns/rows and kinds that name what each cut removes

**Files:**
- Modify: `js/core/layout.js`, `js/core/sequence.js`, `js/ui/format.js`, `js/ui/presets.js`, `js/ui/sizeInputs.js`, `js/app.js`, `tests/layout.test.js`, `tests/sequence.test.js`, `tests/scores.test.js`, `tests/format.test.js`, `tests/presets.test.js`

**Interfaces:**
- Consumes: Task 1's names.
- Produces: `gutter = { columns, rows }` everywhere (core, presets, job); steps `{ n, axis, position, kind: 'margin'|'strip'|'gutter', edge?, turnBefore }` where `edge` exists only on margin cuts; `stepNote` → `Trim top margin` etc.; `createSizeInputs(container, { label, allowZero, keys, labels, onChange })` with `keys` defaulting to `['width','length']`.

- [ ] **Step 1: Update the core tests first (they define the new shape)**

`tests/layout.test.js` — add a helper after `size` and change every gutter argument:
```js
const size = (width, length) => ({ width, length });
const gutter = (columns, rows) => ({ columns, rows });
const EIGHTH = gutter(0.125, 0.125);
```
Then: `size(0, 0)` used as a gutter → `gutter(0, 0)` (three places: zero-gutter test, exact-fit test, both lines of the "still suggests a turn" test and the tooLong line of "reports what does not fit"); `size(-1, 0)` → `gutter(-1, 0)`; `size(0.125, 0.5)` in the sheet-turn test → `gutter(0.125, 0.5)`.

`tests/scores.test.js` — same helper, `EIGHTH = gutter(0.125, 0.125)`.

`tests/sequence.test.js` — same helper; `size(0, 0)` gutters → `gutter(0, 0)`; `size(0.25, 0)` → `gutter(0.25, 0)`; every `s.kind === 'trim'` → `s.kind === 'gutter'` (three tests); and replace the kinds test:
```js
test('kinds name what each cut removes: four margins, then strips and gutters per axis', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH));
  assert.deepEqual(steps.slice(0, 4).map((s) => [s.kind, s.edge]),
    [['margin', 'top'], ['margin', 'left'], ['margin', 'bottom'], ['margin', 'right']]);
  assert.deepEqual(steps.slice(4, 8).map((s) => s.kind), ['strip', 'strip', 'gutter', 'gutter']);
  assert.deepEqual(steps.slice(8, 15).map((s) => s.kind), Array(7).fill('strip'));
  assert.deepEqual(steps.slice(15).map((s) => s.kind), Array(7).fill('gutter'));
  assert.ok(steps.slice(4).every((s) => !('edge' in s)), 'only margin cuts carry an edge');
});
```

`tests/format.test.js` — replace the stepNote test:
```js
test('describes each kind of step by what it removes', () => {
  const step = (kind, extra = {}) => ({ n: 1, axis: 'L', position: 0, kind, turnBefore: false, ...extra });
  assert.equal(stepNote(step('margin', { edge: 'top' })), 'Trim top margin');
  assert.equal(stepNote(step('margin', { edge: 'left' })), 'Trim left margin');
  assert.equal(stepNote(step('margin', { edge: 'bottom' })), 'Trim bottom margin');
  assert.equal(stepNote(step('margin', { edge: 'right' })), 'Trim right margin');
  assert.equal(stepNote(step('strip')), 'Cut off next strip');
  assert.equal(stepNote(step('gutter')), 'Trim gutter');
});
```

`tests/presets.test.js` — the default-job test's gutter line: `assert.deepEqual(DEFAULTS.in.gutter, { columns: 0.125, rows: 0.125 });`

- [ ] **Step 2: Run to see them fail**

Run: `npm test`
Expected: layout/sequence/scores/format/presets suites fail — `gutter.width` reads `undefined` in the core, kinds are the old strings.

- [ ] **Step 3: layout.js — gutter.columns / gutter.rows**

Replace `assertSize` and the gutter reads:
```js
function assertPositive(name, obj, keys, { allowZero }) {
  for (const key of keys) {
    const value = obj[key];
    const ok = Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
    if (!ok) {
      throw new RangeError(`${name}.${key} must be ${allowZero ? 'zero or more' : 'greater than zero'}, got ${value}`);
    }
  }
}
```
```js
/**
 * @param sheet   { width, length } inches, both > 0
 * @param doc     { width, length } inches, both > 0
 * @param gutter  { columns, rows } inches, both >= 0: the gutter between columns, and between rows
 */
export function computeLayout(sheet, doc, gutter) {
  assertPositive('sheet', sheet, ['width', 'length'], { allowZero: false });
  assertPositive('doc', doc, ['width', 'length'], { allowZero: false });
  assertPositive('gutter', gutter, ['columns', 'rows'], { allowZero: true });

  const across = countAlong(sheet.width, doc.width, gutter.columns);
  const down = countAlong(sheet.length, doc.length, gutter.rows);
```
and in `imposed` and the `docs` loop: `gutter.width` → `gutter.columns`, `gutter.length` → `gutter.rows` (four places).

- [ ] **Step 4: sequence.js — kinds and edges**

Replace the body from the doc comment down:
```js
/**
 * @param layout  result of computeLayout with fits: true
 * @returns {Array<{ n, axis: 'L'|'W', position, kind: 'margin'|'strip'|'gutter', edge?, turnBefore }>}
 *   Backgauge positions in the order they are keyed in. 'L' cuts run along the sheet
 *   length (the second dimension entered), 'W' along the width. Each kind names what
 *   the cut removes; margin cuts also carry the edge ('top'|'left'|'bottom'|'right').
 *   turnBefore is true when the stack is turned 90° before this cut.
 */
export function computeSequence(layout) {
  if (!layout.fits) throw new RangeError('computeSequence needs a layout that fits');
  const { sheet, doc, gutter, imposed, margins, across, down } = layout;
  const steps = [];
  const cut = (axis, position, kind, edge) => {
    const previous = steps.at(-1);
    steps.push({
      n: steps.length + 1,
      axis,
      position,
      kind,
      ...(edge ? { edge } : {}),
      turnBefore: previous !== undefined && previous.axis !== axis,
    });
  };

  cut('L', sheet.length - margins.top, 'margin', 'top');
  cut('W', sheet.width - margins.left, 'margin', 'left');
  cut('L', imposed.length, 'margin', 'bottom');
  cut('W', imposed.width, 'margin', 'right');
  cutAxis(cut, 'W', imposed.width, doc.width, gutter.columns, across);
  cutAxis(cut, 'L', imposed.length, doc.length, gutter.rows, down);
  return steps;
}

// Per axis: n-1 strips, each (doc + gutter) narrower than the last, then gutter trims
// at the document dimension for k = 2..n. The last strip cut already lands on the
// document dimension and is the first gutter trim — hence k starts at 2, not 1.
function cutAxis(cut, axis, imposedSize, docSize, gutterSize, count) {
  for (let i = 1; i < count; i++) cut(axis, imposedSize - i * (docSize + gutterSize), 'strip');
  if (gutterSize === 0) return; // nothing between the pieces to trim off
  for (let k = 2; k <= count; k++) cut(axis, docSize, 'gutter');
}
```
Also update the file's header comment: replace "Each axis is a ladder of (doc + gutter) steps that peels off one strip per cut, followed by gutter trims" with "Each axis is a run of strip cuts (doc + gutter) apart, followed by gutter trims".

- [ ] **Step 5: format.js — stepNote**

```js
/** A short note describing what a sequence step removes. */
export function stepNote(step) {
  switch (step.kind) {
    case 'margin': return `Trim ${step.edge} margin`;
    case 'strip': return 'Cut off next strip';
    case 'gutter': return 'Trim gutter';
    default: return '';
  }
}
```

- [ ] **Step 6: presets.js — gutters are { columns, rows }**

Add a helper and change the gutter entries and defaults:
```js
const size = (width, length) => ({ width, length });
const gutter = (columns, rows) => ({ columns, rows });
```
```js
    gutter: [gutter(0.125, 0.125), gutter(0.25, 0.25), gutter(0, 0)],
```
```js
    gutter: [gutter(3, 3), gutter(5, 5), gutter(0, 0)],
```
```js
    sheet: size(12, 18), doc: size(3.5, 2), gutter: gutter(0.125, 0.125),
```
```js
    sheet: size(320, 450), doc: size(90, 55), gutter: gutter(3, 3),
```

- [ ] **Step 7: sizeInputs.js — the component learns its keys**

Replace the two module-level helpers and the function signature/first lines with:
```js
/**
 * @param container  element to render into
 * @param options    { label, allowZero, keys, labels, onChange }
 *   keys   — the two property names of the value, default ['width', 'length'];
 *            the gutter section uses ['columns', 'rows']
 *   labels — the two field labels, default ['Width', 'Length']
 *   onChange(value) fires only with valid numbers. Invalid typing leaves the
 *   previous value in force and shows a hint under the fields.
 * @returns { setPresets(presets, value), setValue(value) }
 */
export function createSizeInputs(container, {
  label, allowZero = false, keys = ['width', 'length'], labels = ['Width', 'Length'], onChange,
}) {
  const [first, second] = keys;
  const same = (a, b) => a[first] === b[first] && a[second] === b[second];
  const chipText = (v) => (v[first] === 0 && v[second] === 0 ? 'None' : `${v[first]} × ${v[second]}`);
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': `${label} presets` });
  const firstInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} ${labels[0].toLowerCase()}` });
  const secondInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} ${labels[1].toLowerCase()}` });
  const custom = el('div', { class: 'custom', hidden: true },
    el('label', {}, labels[0], firstInput),
    el('span', { class: 'times' }, '×'),
    el('label', {}, labels[1], secondInput));
  const hint = el('p', { class: 'hint', hidden: true });
  container.replaceChildren(el('fieldset', { class: 'group' }, el('legend', {}, label), chips, custom, hint));

  let presets = [];
  let value = { [first]: 1, [second]: 1 };
  let customChip = null;
```
Then through the rest of the function: `widthInput` → `firstInput`, `lengthInput` → `secondInput`, `value.width` → `value[first]`, `value.length` → `value[second]`, `sameSize` → `same`, and in the chip click handler `value = { ...preset }` → `value = { [first]: preset[first], [second]: preset[second] }`, and in `readCustom` `value = { width, length }` → `value = { [first]: a, [second]: b }` where `a`/`b` are the two parsed numbers (rename the locals `width`/`length` to `a`/`b`). Delete the old module-level `sameSize` and `chipText`.

- [ ] **Step 8: app.js — the gutter section and its conversion**

```js
  gutter: createSizeInputs($('gutterInputs'), {
    label: 'Gutter', allowZero: true, keys: ['columns', 'rows'], labels: ['Between columns', 'Between rows'],
    onChange: (gutter) => update({ gutter }),
  }),
```
and in `compute`:
```js
  const gutter = { columns: toInches(job.gutter.columns), rows: toInches(job.gutter.rows) };
```

- [ ] **Step 9: Verify identical values**

Run: `npm test`
Expected: `ℹ tests 53`, `ℹ pass 53`, `ℹ fail 0`. The `TWO_UP` and `BUSINESS_CARD` fixtures are untouched and pass.

Run: `grep -rn "gutter\.width\|gutter\.length\|'square'\|'block'\|'ladder'\|'trim'" js tests`
Expected: no output.

Browser: `python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t2.png --print "document.querySelector('#summary .nup').textContent" --print "[...document.querySelectorAll('.step-note')].slice(0,4).map(n=>n.textContent).join(' | ')" --eval "document.querySelector('#gutterInputs .chips button:last-child').click()" --print "[...document.querySelectorAll('#gutterInputs .custom label')].map(l=>l.firstChild.textContent).join(' / ')"`
Expected: `24-up`; `Trim top margin | Trim left margin | Trim bottom margin | Trim right margin`; `Between columns / Between rows`.

- [ ] **Step 10: Commit**

```bash
git add js/core/layout.js js/core/sequence.js js/ui/format.js js/ui/presets.js js/ui/sizeInputs.js js/app.js tests/layout.test.js tests/sequence.test.js tests/scores.test.js tests/format.test.js tests/presets.test.js
git commit -F - <<'EOF'
Name gutters by what they sit between and cuts by what they remove

gutter.columns/rows replaces width/length (a gutter is not a rectangle).
Step kinds are margin/strip/gutter, with the edge on margin cuts, so the
sequence note can say exactly which margin comes off. Values unchanged:
both hand-verified fixtures pass byte-identical.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: Printable region, NPA-aware fit, centring within it, four margins

**Files:**
- Modify: `js/core/layout.js`, `tests/layout.test.js`
- Test: `tests/printable.test.js` (new)

**Interfaces:**
- Consumes: Task 2's `gutter = { columns, rows }`.
- Produces: `printableRegion(sheet, npa) → { width, length }`; `fitCount(region, doc, gutter) → { across, down }`; `placeBlock(sheet, printable, npa, imposed) → { top, bottom, left, right }`; `computeLayout(sheet, doc, gutter, { npa } = {})` whose result gains `printable`, `auto`, `npa`, and four `margins`. Core `npa` defaults to all zeros.

- [ ] **Step 1: Write the failing tests**

`tests/printable.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, printableRegion, fitCount } from '../js/core/layout.js';

const size = (width, length) => ({ width, length });
const gutter = (columns, rows) => ({ columns, rows });
const EIGHTH = gutter(0.125, 0.125);
const SIXTEENTH = { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 };

test('the printable region is the sheet inset by each edge', () => {
  assert.deepEqual(printableRegion(size(13, 19), SIXTEENTH), { width: 12.875, length: 18.875 });
  assert.deepEqual(printableRegion(size(13, 19), { top: 0.5, bottom: 0.0625, left: 0, right: 0 }), { width: 13, length: 18.4375 });
  assert.deepEqual(printableRegion(size(13, 19)), { width: 13, length: 19 });
});

test('fit count uses the region it is given', () => {
  assert.deepEqual(fitCount(size(13, 19), size(3.5, 2), EIGHTH), { across: 3, down: 9 });
  assert.deepEqual(fitCount(printableRegion(size(13, 19), SIXTEENTH), size(3.5, 2), EIGHTH), { across: 3, down: 8 });
});

test('the business card on 13x19 drops from 9 rows to 8 with a 1/16" non-printable area', () => {
  const bare = computeLayout(size(13, 19), size(3.5, 2), EIGHTH);
  assert.deepEqual([bare.across, bare.down], [3, 9]);
  assert.deepEqual(bare.margins, { top: 0, bottom: 0, left: 1.125, right: 1.125 }); // rows run edge to edge
  const withNpa = computeLayout(size(13, 19), size(3.5, 2), EIGHTH, { npa: SIXTEENTH });
  assert.deepEqual([withNpa.across, withNpa.down], [3, 8]);
  assert.deepEqual(withNpa.printable, { width: 12.875, length: 18.875 });
  assert.deepEqual(withNpa.margins, { top: 1.0625, bottom: 1.0625, left: 1.125, right: 1.125 });
  assert.deepEqual(withNpa.npa, SIXTEENTH);
});

test('with an asymmetric non-printable area the block centres within the printable region, not the sheet', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { npa: { top: 0.5, bottom: 0, left: 0, right: 0 } });
  // printable length 17.5 still holds 8 rows (16.875); the 0.625 of slack splits 0.3125 each side of the block
  assert.deepEqual([layout.across, layout.down], [3, 8]);
  assert.deepEqual(layout.margins, { top: 0.8125, bottom: 0.3125, left: 0.625, right: 0.625 });
  assert.equal(layout.docs[0].y, 0.8125);
});

test('defaults keep the verified layouts identical: no non-printable area, centred', () => {
  const plain = computeLayout(size(12, 18), size(3.5, 2), EIGHTH);
  assert.deepEqual(plain.printable, { width: 12, length: 18 });
  assert.deepEqual(plain.auto, { across: 3, down: 8 });
  assert.deepEqual(plain.margins, { top: 0.5625, bottom: 0.5625, left: 0.625, right: 0.625 });
});

test('a non-printable area larger than the sheet fits nothing rather than going negative', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { npa: { top: 10, bottom: 10, left: 0, right: 0 } });
  assert.equal(layout.fits, false);
  assert.equal(layout.down, 0);
});

test('a negative non-printable area is a programmer error', () => {
  assert.throws(() => computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { npa: { top: -1, bottom: 0, left: 0, right: 0 } }), RangeError);
});
```

`tests/layout.test.js` — margins now have four keys. Change the three margin assertions:
- business-card test: `assert.deepEqual(layout.margins, { top: 0.5625, bottom: 0.5625, left: 0.625, right: 0.625 });`
- 2-up test: `assert.deepEqual(layout.margins, { top: 0.4375, bottom: 0.4375, left: 0.5, right: 0.5 });`
- zero-gutter test: `assert.deepEqual(layout.margins, { top: 0, bottom: 0, left: 0, right: 0 });`

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/printable.test.js tests/layout.test.js`
Expected: FAIL — `printableRegion` is not exported; margins have two keys.

- [ ] **Step 3: Rewrite the top of layout.js**

Replace everything from `const EPSILON` through the end of `computeLayout` (leave `turned`, `countUp`, `suggestOrientation` below as they are):
```js
const EPSILON = 1e-9;
const EDGES = ['top', 'bottom', 'left', 'right'];
const NO_NPA = { top: 0, bottom: 0, left: 0, right: 0 };

function assertPositive(name, obj, keys, { allowZero }) {
  for (const key of keys) {
    const value = obj[key];
    const ok = Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
    if (!ok) {
      throw new RangeError(`${name}.${key} must be ${allowZero ? 'zero or more' : 'greater than zero'}, got ${value}`);
    }
  }
}

function countAlong(regionSize, docSize, gutterSize) {
  // n documents need n*doc + (n-1)*gutter <= region. The epsilon keeps an exact
  // fit (e.g. 0.3 / 0.1 = 2.9999999999999996) from losing a document; the floor
  // at zero keeps a region smaller than nothing from counting negative documents.
  return Math.max(0, Math.floor((regionSize + gutterSize) / (docSize + gutterSize) + EPSILON));
}

/** The sheet inset by each edge's non-printable area: where documents may be placed. */
export function printableRegion(sheet, npa = NO_NPA) {
  return {
    width: sheet.width - npa.left - npa.right,
    length: sheet.length - npa.top - npa.bottom,
  };
}

/** The most documents that fit a region, per axis. */
export function fitCount(region, doc, gutter) {
  return {
    across: countAlong(region.width, doc.width, gutter.columns),
    down: countAlong(region.length, doc.length, gutter.rows),
  };
}

/**
 * The four margins that put a block on the sheet: centred within the printable
 * region, then kept on the sheet. A block larger than the printable region (only a
 * count override can make one) is clamped rather than hung off an edge.
 */
export function placeBlock(sheet, printable, npa, imposed) {
  const axis = (total, printableSize, blockSize, nearNpa) => {
    const room = total - blockSize;
    const near = Math.min(Math.max(nearNpa + (printableSize - blockSize) / 2, 0), room);
    return [near, room - near];
  };
  const [top, bottom] = axis(sheet.length, printable.length, imposed.length, npa.top);
  const [left, right] = axis(sheet.width, printable.width, imposed.width, npa.left);
  return { top, bottom, left, right };
}

/**
 * @param sheet    { width, length } inches, both > 0
 * @param doc      { width, length } inches, both > 0
 * @param gutter   { columns, rows } inches, both >= 0: the gutter between columns, and between rows
 * @param options  { npa }  npa = { top, bottom, left, right } inches >= 0, default all zero.
 *   The non-printable area only constrains placement; it never appears in the cut list.
 */
export function computeLayout(sheet, doc, gutter, { npa = NO_NPA } = {}) {
  assertPositive('sheet', sheet, ['width', 'length'], { allowZero: false });
  assertPositive('doc', doc, ['width', 'length'], { allowZero: false });
  assertPositive('gutter', gutter, ['columns', 'rows'], { allowZero: true });
  assertPositive('npa', npa, EDGES, { allowZero: true });

  const printable = printableRegion(sheet, npa);
  const auto = fitCount(printable, doc, gutter);
  const { across, down } = auto;
  if (across < 1 || down < 1) {
    return { fits: false, across, down, auto, printable, npa, sheet, doc, gutter };
  }

  const imposed = {
    width: doc.width * across + gutter.columns * (across - 1),
    length: doc.length * down + gutter.rows * (down - 1),
  };
  const margins = placeBlock(sheet, printable, npa, imposed);
  const docs = [];
  for (let row = 0; row < down; row++) {
    for (let col = 0; col < across; col++) {
      docs.push({
        x: margins.left + col * (doc.width + gutter.columns),
        y: margins.top + row * (doc.length + gutter.rows),
        width: doc.width,
        length: doc.length,
      });
    }
  }
  return { fits: true, across, down, auto, printable, npa, imposed, margins, docs, sheet, doc, gutter };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: `ℹ tests 60`, `ℹ pass 60`, `ℹ fail 0` (53 + 7). `TWO_UP` and `BUSINESS_CARD` unchanged.

- [ ] **Step 5: Commit**

```bash
git add js/core/layout.js tests/layout.test.js tests/printable.test.js
git commit -F - <<'EOF'
Fit documents within the printable region and centre within it

The non-printable area shrinks where documents may go and never appears in
the cut list. Margins are now all four edges. With no NPA every existing
layout is identical.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 4: Manual count override

**Files:**
- Modify: `js/core/layout.js`
- Test: `tests/count.test.js` (new)

**Interfaces:**
- Consumes: Task 3.
- Produces: `computeLayout(sheet, doc, gutter, { npa, count } = {})` where `count = { across?, down? }`; an absent value means auto. `fits: false` results caused by an oversize override include `imposed` so the UI can explain the arithmetic.

- [ ] **Step 1: Write the failing tests**

`tests/count.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../js/core/layout.js';

const size = (width, length) => ({ width, length });
const gutter = (columns, rows) => ({ columns, rows });
const EIGHTH = gutter(0.125, 0.125);
const SIXTEENTH = { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 };

test('a smaller count shrinks the block and re-centres it', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { count: { across: 2 } });
  assert.deepEqual([layout.across, layout.down], [2, 8]);
  assert.deepEqual(layout.auto, { across: 3, down: 8 });
  assert.equal(layout.imposed.width, 7.125); // 2 x 3.5 + 1/8
  assert.equal(layout.margins.left, 2.4375); // (12 - 7.125) / 2
  assert.equal(layout.docs.length, 16);
});

test('a larger count that still fits the physical sheet is allowed', () => {
  // With a 1/16" NPA, 13x19 fits 8 rows; 9 rows fill the physical sheet exactly.
  const layout = computeLayout(size(13, 19), size(3.5, 2), EIGHTH, { npa: SIXTEENTH, count: { down: 9 } });
  assert.equal(layout.fits, true);
  assert.equal(layout.down, 9);
  assert.equal(layout.imposed.length, 19);
  assert.deepEqual([layout.margins.top, layout.margins.bottom], [0, 0]);
});

test('a count the physical sheet cannot hold does not fit, and says how big it would be', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { count: { across: 4 } });
  assert.equal(layout.fits, false);
  assert.equal(layout.across, 4);
  assert.equal(layout.imposed.width, 14.375); // 4 x 3.5 + 3 x 1/8, wider than 12
  assert.deepEqual(layout.auto, { across: 3, down: 8 });
});

test('a block larger than the printable region is kept on the sheet, not hung off an edge', () => {
  // printable length 17.5 (bottom NPA 0.5) holds 7 rows at a 1/4" row gutter; 8 rows are 17.75, still within 18.
  const layout = computeLayout(size(12, 18), size(3.5, 2), gutter(0.125, 0.25), {
    npa: { top: 0, bottom: 0.5, left: 0, right: 0 }, count: { down: 8 },
  });
  assert.equal(layout.fits, true);
  assert.equal(layout.imposed.length, 17.75);
  assert.deepEqual([layout.margins.top, layout.margins.bottom], [0, 0.25]); // centring wanted -0.125 at the top
});

test('count overrides must be positive integers; absent means auto', () => {
  assert.throws(() => computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { count: { across: 0 } }), RangeError);
  assert.throws(() => computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { count: { across: 2.5 } }), RangeError);
  assert.equal(computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { count: {} }).across, 3);
  assert.equal(computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { count: { across: undefined } }).across, 3);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/count.test.js`
Expected: FAIL — `count` is ignored, so `layout.across` is 3 where 2 or 4 is expected.

- [ ] **Step 3: Add the override**

In `js/core/layout.js`, add after `assertPositive`:
```js
function assertCount(count) {
  for (const key of ['across', 'down']) {
    const value = count[key];
    if (value !== undefined && !(Number.isInteger(value) && value >= 1)) {
      throw new RangeError(`count.${key} must be a positive integer or absent, got ${value}`);
    }
  }
}
```
Change the signature, the validation, the count selection, and add the physical-sheet check:
```js
 * @param options  { npa, count }
 *   npa   = { top, bottom, left, right } inches >= 0, default all zero. Constrains placement only.
 *   count = { across?, down? } positive integers; an absent value means auto.
 */
export function computeLayout(sheet, doc, gutter, { npa = NO_NPA, count = {} } = {}) {
  assertPositive('sheet', sheet, ['width', 'length'], { allowZero: false });
  assertPositive('doc', doc, ['width', 'length'], { allowZero: false });
  assertPositive('gutter', gutter, ['columns', 'rows'], { allowZero: true });
  assertPositive('npa', npa, EDGES, { allowZero: true });
  assertCount(count);

  const printable = printableRegion(sheet, npa);
  const auto = fitCount(printable, doc, gutter);
  const across = count.across ?? auto.across;
  const down = count.down ?? auto.down;
  if (across < 1 || down < 1) {
    return { fits: false, across, down, auto, printable, npa, sheet, doc, gutter };
  }

  const imposed = {
    width: doc.width * across + gutter.columns * (across - 1),
    length: doc.length * down + gutter.rows * (down - 1),
  };
  // Only an override can ask for a block the physical sheet cannot hold.
  if (imposed.width > sheet.width + EPSILON || imposed.length > sheet.length + EPSILON) {
    return { fits: false, across, down, auto, printable, npa, imposed, sheet, doc, gutter };
  }
```
(the rest of the function is unchanged).

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: `ℹ tests 65`, `ℹ pass 65`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add js/core/layout.js tests/count.test.js
git commit -F - <<'EOF'
Allow a manual document count

An override may be smaller or larger than what fits the printable region;
it must fit the physical sheet. Auto is always reported alongside.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 5: Alignment with offsets, and NPA violations

**Files:**
- Modify: `js/core/layout.js`
- Test: `tests/placement.test.js` (new)

**Interfaces:**
- Consumes: Tasks 3–4.
- Produces: `computeLayout(sheet, doc, gutter, { npa, count, align } = {})` where `align = { top?, bottom?, left?, right? }` with offsets (inches from the physical edge) as values; `placeBlock(sheet, printable, npa, imposed, align)`; `findViolations(margins, npa) → [{ edge, amount }]`; results gain `violations`. Both edges of one axis → `RangeError`. An offset that pushes the block off the sheet → `fits: false` with `margins` included.

- [ ] **Step 1: Write the failing tests**

`tests/placement.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, placeBlock, findViolations } from '../js/core/layout.js';

const size = (width, length) => ({ width, length });
const gutter = (columns, rows) => ({ columns, rows });
const EIGHTH = gutter(0.125, 0.125);
const SIXTEENTH = { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 };
const card = (options) => computeLayout(size(12, 18), size(3.5, 2), EIGHTH, options);

test('an edge with an offset takes that margin; the far edge takes the slack', () => {
  const layout = card({ align: { top: 0.5 } });
  assert.deepEqual(layout.margins, { top: 0.5, bottom: 0.625, left: 0.625, right: 0.625 }); // 18 - 0.5 - 16.875
  assert.equal(layout.docs[0].y, 0.5);
});

test('a flush corner has zero margins on both chosen edges', () => {
  assert.deepEqual(card({ align: { top: 0, left: 0 } }).margins, { top: 0, bottom: 1.125, left: 0, right: 1.25 });
});

test('bottom and right offsets measure from those edges', () => {
  assert.deepEqual(card({ align: { bottom: 0.25, right: 0.5 } }).margins, { top: 0.875, bottom: 0.25, left: 0.75, right: 0.5 });
});

test('an offset that pushes the block off the sheet does not fit', () => {
  assert.equal(card({ align: { top: 2 } }).fits, false); // 2 + 16.875 > 18
  assert.equal(card({ align: { bottom: 2 } }).fits, false);
  assert.equal(card({ align: { top: 1.125 } }).fits, true); // exactly fills: bottom margin 0
});

test('choosing both edges of one axis, or a negative offset, is a programmer error', () => {
  assert.throws(() => card({ align: { top: 0, bottom: 0 } }), RangeError);
  assert.throws(() => card({ align: { left: 0, right: 0 } }), RangeError);
  assert.throws(() => card({ align: { left: -1 } }), RangeError);
});

test('auto placement never violates the non-printable area', () => {
  const layout = computeLayout(size(13, 19), size(3.5, 2), EIGHTH, { npa: SIXTEENTH });
  assert.deepEqual(layout.violations, []);
});

test('an offset inside the non-printable area is reported, not corrected', () => {
  const layout = card({ npa: SIXTEENTH, align: { top: 0 } });
  assert.equal(layout.fits, true);
  assert.equal(layout.margins.top, 0); // honoured exactly as entered
  assert.deepEqual(layout.violations, [{ edge: 'top', amount: 0.0625 }]);
});

test('a count override past the printable region reports both edges', () => {
  const layout = computeLayout(size(13, 19), size(3.5, 2), EIGHTH, { npa: SIXTEENTH, count: { down: 9 } });
  assert.deepEqual(layout.violations, [{ edge: 'top', amount: 0.0625 }, { edge: 'bottom', amount: 0.0625 }]);
});

test('placeBlock and findViolations are usable on their own', () => {
  const margins = placeBlock(size(12, 18), size(12, 18), { top: 0, bottom: 0, left: 0, right: 0 }, size(10.75, 16.875), { left: 0.25 });
  assert.deepEqual(margins, { top: 0.5625, bottom: 0.5625, left: 0.25, right: 1 });
  assert.deepEqual(findViolations({ top: 0, bottom: 1, left: 0.03, right: 1 }, SIXTEENTH),
    [{ edge: 'top', amount: 0.0625 }, { edge: 'left', amount: 0.0325 }]);
});

test('the FLUSH_TOP layout: top flush with a zero top NPA, centred horizontally', () => {
  const npa = { top: 0, bottom: 0.0625, left: 0.0625, right: 0.0625 };
  const layout = card({ npa, align: { top: 0 } });
  assert.deepEqual([layout.across, layout.down], [3, 8]);
  assert.deepEqual(layout.margins, { top: 0, bottom: 1.125, left: 0.625, right: 0.625 });
  assert.deepEqual(layout.violations, []);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/placement.test.js`
Expected: FAIL — `findViolations` is not exported; `align` is ignored.

- [ ] **Step 3: Implement alignment and violations**

In `js/core/layout.js`, add after `assertCount`:
```js
function assertAlign(align) {
  if ('top' in align && 'bottom' in align) throw new RangeError('align: choose top or bottom, not both');
  if ('left' in align && 'right' in align) throw new RangeError('align: choose left or right, not both');
  for (const edge of EDGES) {
    if (edge in align && !(Number.isFinite(align[edge]) && align[edge] >= 0)) {
      throw new RangeError(`align.${edge} must be zero or more, got ${align[edge]}`);
    }
  }
}
```
Replace `placeBlock`:
```js
/**
 * The four margins that put a block on the sheet. Per axis: a chosen edge takes its
 * offset as the margin and the far edge gets all the slack; with no edge chosen the
 * block is centred within the printable region and kept on the sheet (a block larger
 * than the printable region — only a count override makes one — is clamped rather
 * than hung off an edge). Offsets are measured from the physical sheet edge and are
 * never clamped: one that runs the block off the far edge shows up as a negative far
 * margin, which computeLayout reports as not fitting.
 */
export function placeBlock(sheet, printable, npa, imposed, align = {}) {
  const axis = (total, printableSize, blockSize, nearNpa, nearOffset, farOffset) => {
    const room = total - blockSize;
    let near;
    if (nearOffset !== undefined) near = nearOffset;
    else if (farOffset !== undefined) near = room - farOffset;
    else near = Math.min(Math.max(nearNpa + (printableSize - blockSize) / 2, 0), room);
    return [near, room - near];
  };
  const [top, bottom] = axis(sheet.length, printable.length, imposed.length, npa.top, align.top, align.bottom);
  const [left, right] = axis(sheet.width, printable.width, imposed.width, npa.left, align.left, align.right);
  return { top, bottom, left, right };
}

/** Edges where the block sits inside the non-printable area, as { edge, amount } with amount > 0. */
export function findViolations(margins, npa) {
  return EDGES
    .filter((edge) => npa[edge] - margins[edge] > EPSILON)
    .map((edge) => ({ edge, amount: npa[edge] - margins[edge] }));
}
```
In `computeLayout`: extend the doc comment, options, validation, and placement:
```js
 *   align = { top?, bottom?, left?, right? } with the offset (inches from the physical
 *           edge) as the value; at most one of top/bottom and one of left/right.
 */
export function computeLayout(sheet, doc, gutter, { npa = NO_NPA, count = {}, align = {} } = {}) {
```
```js
  assertCount(count);
  assertAlign(align);
```
```js
  const margins = placeBlock(sheet, printable, npa, imposed, align);
  // An explicit offset is honoured exactly; if it runs the block off the sheet, nothing fits.
  if (EDGES.some((edge) => margins[edge] < -EPSILON)) {
    return { fits: false, across, down, auto, printable, npa, imposed, margins, sheet, doc, gutter };
  }
  const violations = findViolations(margins, npa);
```
and include `violations` in the final return:
```js
  return { fits: true, across, down, auto, printable, npa, imposed, margins, violations, docs, sheet, doc, gutter };
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: `ℹ tests 75`, `ℹ pass 75`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add js/core/layout.js tests/placement.test.js
git commit -F - <<'EOF'
Place the block by alignment and offset; report NPA violations

Offsets are honoured exactly and measured from the physical edge. Only a
manual offset or count can put documents in the non-printable area; the
layout reports which edges and by how much instead of correcting it.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 6: The squaring rule and the FLUSH_TOP fixture

**Files:**
- Modify: `js/core/sequence.js`, `tests/sequence.test.js`

**Interfaces:**
- Consumes: four `margins` from Task 3; flush margins from Task 5.
- Produces: `computeSequence` emits a margin cut for an edge iff that margin > `EPSILON`. `TWO_UP` and `BUSINESS_CARD` unchanged; `FLUSH_TOP` added.

- [ ] **Step 1: Write the failing tests**

In `tests/sequence.test.js`, add the fixture after `BUSINESS_CARD`:
```js
// Business card 3.5x2 on 12x18, 1/8" gutters, NPA 1/16" except top = 0, aligned top
// with offset 0, centred horizontally. The business card with its first cut removed.
const FLUSH_TOP = [
  ['W', 11.375], ['L', 16.875], ['W', 10.75],
  ['W', 7.125], ['W', 3.5], ['W', 3.5], ['W', 3.5],
  ['L', 14.75], ['L', 12.625], ['L', 10.5], ['L', 8.375], ['L', 6.25], ['L', 4.125], ['L', 2],
  ['L', 2], ['L', 2], ['L', 2], ['L', 2], ['L', 2], ['L', 2], ['L', 2],
];
const flushTop = () => computeLayout(size(12, 18), size(3.5, 2), EIGHTH, {
  npa: { top: 0, bottom: 0.0625, left: 0.0625, right: 0.0625 },
  align: { top: 0 },
});
```
Add these tests:
```js
test('FLUSH_TOP fixture: a block flush to the head gets no head cut', () => {
  const steps = computeSequence(flushTop());
  assert.deepEqual(cuts(steps), FLUSH_TOP);
  assert.equal(steps.length, 21);
  assert.deepEqual(steps.filter((s) => s.turnBefore).map((s) => s.n), [2, 3, 8]);
  assert.deepEqual(steps.slice(0, 3).map((s) => s.edge), ['left', 'bottom', 'right']);
});

test('the 8 cuts at the document length survive the missing head cut', () => {
  const steps = computeSequence(flushTop());
  assert.equal(steps.filter((s) => s.axis === 'L' && s.position === 2).length, 8);
});

test('an exact fit on one axis gets no margin cuts on that axis', () => {
  // 13x19 with no NPA: 9 rows run edge to edge, so only the side margins are cut.
  const steps = computeSequence(computeLayout(size(13, 19), size(3.5, 2), EIGHTH));
  const margins = steps.filter((s) => s.kind === 'margin');
  assert.deepEqual(margins.map((s) => [s.axis, s.edge, s.position]), [['W', 'left', 11.875], ['W', 'right', 10.75]]);
  assert.equal(steps.length, 22); // 2 margins + (2 strips + 2 gutters) + (8 strips + 8 gutters)
  assert.equal(steps[1].turnBefore, false); // two W cuts in a row: no turn between them
});

test('a flush corner leaves two margin cuts', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { align: { top: 0, left: 0 } }));
  assert.deepEqual(steps.filter((s) => s.kind === 'margin').map((s) => [s.axis, s.edge]), [['L', 'bottom'], ['W', 'right']]);
});
```
Update two existing tests whose layouts have zero margins:

`a zero gutter needs no trims` → replace with:
```js
test('an exact fit with no gutter needs only the strip cuts', () => {
  // 4.25x5.5 fills 8.5x11 exactly: every margin is zero, so no margin cut exists.
  const steps = computeSequence(computeLayout(size(8.5, 11), size(4.25, 5.5), gutter(0, 0)));
  assert.deepEqual(cuts(steps), [['W', 4.25], ['L', 5.5]]);
});
```
`axis order follows the sheet as entered` — the second assertion becomes:
```js
  // 5 columns fill the 18" width exactly, so the side margins are zero and get no cut;
  // the next cut is the bottom margin.
  assert.deepEqual([steps[1].axis, steps[1].position], ['L', 10.5]);
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/sequence.test.js`
Expected: FAIL — FLUSH_TOP gets 22 steps with a leading `['L', 18]`; the exact-fit cases emit no-op margin cuts.

- [ ] **Step 3: Apply the rule**

In `js/core/sequence.js`, add `const EPSILON = 1e-9;` above `computeSequence`, and replace the four margin cuts:
```js
  // A margin cut exists on an edge iff there is a margin to remove. A block flush
  // to an edge (offset 0) keeps the sheet's own edge as its reference and gets no cut
  // there; an exact fit gets none on that axis. Survivors keep this order.
  if (margins.top > EPSILON) cut('L', sheet.length - margins.top, 'margin', 'top');
  if (margins.left > EPSILON) cut('W', sheet.width - margins.left, 'margin', 'left');
  if (margins.bottom > EPSILON) cut('L', imposed.length, 'margin', 'bottom');
  if (margins.right > EPSILON) cut('W', imposed.width, 'margin', 'right');
```
Add to the header comment: "A margin cut exists on an edge iff that edge's margin is greater than zero."

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: `ℹ tests 79`, `ℹ pass 79`, `ℹ fail 0`. `TWO_UP` and `BUSINESS_CARD` byte-identical.

- [ ] **Step 5: Commit**

```bash
git add js/core/sequence.js tests/sequence.test.js
git commit -F - <<'EOF'
Cut a margin only where there is one

A block flush to an edge keeps that edge as its reference; an exact fit
needs no margin cuts on that axis. Adds FLUSH_TOP, a third hand-verified
fixture: the business card with its head cut removed, 21 steps.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 7: The orientation hint sees the same non-printable area

**Files:**
- Modify: `js/core/layout.js`, `tests/layout.test.js`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces: `suggestOrientation(sheet, doc, gutter, options = {})` — same options as `computeLayout`; compares `auto` counts so a manual count never distorts the answer.

- [ ] **Step 1: Write the failing tests**

In `tests/layout.test.js`, add `const SIXTEENTH = { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 };` after `EIGHTH`, and append:
```js
test('the non-printable area can change which orientation wins', () => {
  assert.deepEqual(suggestOrientation(size(12, 18), size(3.5, 2), EIGHTH), { rotate: 'doc', count: 25 });
  // With 1/16" all round, either turn fits only 20; the 24-up as entered is best.
  assert.equal(suggestOrientation(size(12, 18), size(3.5, 2), EIGHTH, { npa: SIXTEENTH }), null);
});

test('a manual count does not distort the comparison: auto counts are compared', () => {
  assert.deepEqual(suggestOrientation(size(12, 18), size(3.5, 2), EIGHTH, { count: { across: 1 } }), { rotate: 'doc', count: 25 });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/layout.test.js`
Expected: FAIL — the NPA case still returns `{ rotate: 'doc', count: 25 }`.

- [ ] **Step 3: Pass the options through and compare auto**

Replace `countUp` and `suggestOrientation` at the bottom of `js/core/layout.js`:
```js
function countUp(sheet, doc, gutter, options) {
  const { auto } = computeLayout(sheet, doc, gutter, options);
  return auto.across * auto.down;
}

/**
 * Whether turning the document or the sheet 90° would fit more documents, under the
 * same options. The NPA is sheet-relative and stays on its named edges when the sheet
 * turns. Auto counts are compared, so a manual count never distorts the answer.
 * Returns null when the entered orientation is already best, otherwise the better
 * turn as { rotate: 'doc' | 'sheet', count }. Ties prefer turning the document,
 * which leaves the sheet as it is fed.
 */
export function suggestOrientation(sheet, doc, gutter, options = {}) {
  const current = countUp(sheet, doc, gutter, options);
  const candidates = [
    { rotate: 'doc', count: countUp(sheet, turned(doc), gutter, options) },
    { rotate: 'sheet', count: countUp(turned(sheet), doc, gutter, options) },
  ];
  const best = candidates.reduce((a, b) => (b.count > a.count ? b : a));
  return best.count > current ? best : null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: `ℹ tests 81`, `ℹ pass 81`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add js/core/layout.js tests/layout.test.js
git commit -F - <<'EOF'
Let the orientation hint see the non-printable area

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 8: Main inputs — two sheets, Rotate everywhere, gutter fields always visible

**Files:**
- Modify: `js/ui/presets.js`, `js/ui/sizeInputs.js`, `js/app.js`, `tests/presets.test.js`

**Interfaces:**
- Consumes: Task 2's `keys`/`labels` options.
- Produces: `createSizeInputs(container, { label, allowZero, keys, labels, alwaysShowFields, onChange })` → `{ setPresets, setValue, rotate() }`. Preset entries may carry a `label` shown on the chip. `PRESETS[unit].sheet` has exactly two entries.

- [ ] **Step 1: Write the failing tests**

In `tests/presets.test.js`, replace the first test and the "every default" test:
```js
test('the only sheet presets are the two sizes actually run', () => {
  assert.deepEqual(PRESETS.in.sheet, [{ width: 12, length: 18 }, { width: 13, length: 19 }]);
  assert.deepEqual(PRESETS.mm.sheet, [{ width: 320, length: 450 }, { width: 297, length: 420 }]);
});

test('gutter presets carry the label the chip shows', () => {
  assert.deepEqual(PRESETS.in.gutter.map((g) => g.label), ['⅛"', '¼"', 'None']);
  assert.deepEqual(PRESETS.mm.gutter.map((g) => g.label), ['3 mm', '5 mm', 'None']);
});

test('every default size is one of its unit presets, so a chip is pressed on open', () => {
  const valueOf = ({ label, ...rest }) => rest;
  for (const unit of ['in', 'mm']) {
    for (const kind of ['sheet', 'doc', 'gutter']) {
      const value = DEFAULTS[unit][kind];
      assert.ok(
        PRESETS[unit][kind].some((p) => JSON.stringify(valueOf(p)) === JSON.stringify(value)),
        `${unit} ${kind} default ${JSON.stringify(value)} is not a preset`,
      );
    }
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/presets.test.js`
Expected: FAIL — seven sheet presets; gutters have no `label`.

- [ ] **Step 3: presets.js**

```js
const size = (width, length) => ({ width, length });
const gutter = (columns, rows, label) => (label ? { columns, rows, label } : { columns, rows });

export const PRESETS = {
  in: {
    // Only the two sheets actually run (spec "Main inputs"); everything else is Custom.
    sheet: [size(12, 18), size(13, 19)],
    doc: [size(3.5, 2), size(4.25, 5.5), size(5.5, 8.5), size(8.5, 11), size(11, 17)],
    gutter: [gutter(0.125, 0.125, '⅛"'), gutter(0.25, 0.25, '¼"'), gutter(0, 0, 'None')],
  },
  mm: {
    sheet: [size(320, 450), size(297, 420)],
    doc: [size(90, 55), size(105, 148), size(148, 210), size(210, 297), size(297, 420)],
    gutter: [gutter(3, 3, '3 mm'), gutter(5, 5, '5 mm'), gutter(0, 0, 'None')],
  },
};
```
(`DEFAULTS` keeps `gutter: gutter(0.125, 0.125)` / `gutter(3, 3)` — no label.)

- [ ] **Step 4: sizeInputs.js — replace the whole file**

```js
// sizeInputs.js — one size section: preset chips, a Rotate button, and two fields
// (revealed by a Custom chip, or always visible for the gutter).
import { el } from './dom.js';
import { parseMeasurement } from '../core/measure.js';

/**
 * @param container  element to render into
 * @param options    { label, allowZero, keys, labels, alwaysShowFields, onChange }
 *   keys   — the two property names of the value, default ['width', 'length'];
 *            the gutter section uses ['columns', 'rows']
 *   labels — the two field labels, default ['Width', 'Length']
 *   alwaysShowFields — no Custom chip: the fields stay visible and chips fill them
 *   onChange(value) fires only with valid numbers. Invalid typing leaves the
 *   previous value in force and shows a hint under the fields.
 * @returns { setPresets(presets, value), setValue(value), rotate() }
 */
export function createSizeInputs(container, {
  label, allowZero = false, keys = ['width', 'length'], labels = ['Width', 'Length'],
  alwaysShowFields = false, onChange,
}) {
  const [first, second] = keys;
  const same = (a, b) => a[first] === b[first] && a[second] === b[second];
  const chipText = (v) => v.label ?? (v[first] === 0 && v[second] === 0 ? 'None' : `${v[first]} × ${v[second]}`);
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': `${label} presets` });
  const firstInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} ${labels[0].toLowerCase()}` });
  const secondInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} ${labels[1].toLowerCase()}` });
  const fields = el('div', { class: 'custom', hidden: !alwaysShowFields },
    el('label', {}, labels[0], firstInput),
    el('span', { class: 'times' }, '×'),
    el('label', {}, labels[1], secondInput));
  const hint = el('p', { class: 'hint', hidden: true });
  container.replaceChildren(el('fieldset', { class: 'group' }, el('legend', {}, label), chips, fields, hint));

  let presets = [];
  let value = { [first]: 1, [second]: 1 };
  let customChip = null;

  // Selection chips only — Rotate is an action, never "pressed".
  const selectable = () => [...chips.children].filter((b) => !b.dataset.action);

  function press(button) {
    for (const b of selectable()) b.setAttribute('aria-pressed', String(b === button));
  }

  function fill() {
    firstInput.value = String(value[first]);
    secondInput.value = String(value[second]);
  }

  function showFields(show) {
    const visible = show || alwaysShowFields;
    fields.hidden = !visible;
    if (visible) fill();
  }

  function renderChips() {
    const buttons = presets.map((preset) => {
      const button = el('button', { type: 'button', 'aria-pressed': 'false' }, chipText(preset));
      button.addEventListener('click', () => {
        value = { [first]: preset[first], [second]: preset[second] };
        press(button);
        showFields(false);
        hint.hidden = true;
        onChange(value);
      });
      return button;
    });
    const rotate = el('button', { type: 'button', dataset: { action: 'rotate' }, 'aria-label': `Rotate ${label.toLowerCase()}` }, '↻ Rotate');
    rotate.addEventListener('click', () => api.rotate());
    if (alwaysShowFields) {
      customChip = null;
      chips.replaceChildren(...buttons, rotate);
    } else {
      customChip = el('button', { type: 'button', 'aria-pressed': 'false' }, 'Custom');
      customChip.addEventListener('click', () => {
        press(customChip);
        showFields(true);
        firstInput.focus();
      });
      chips.replaceChildren(...buttons, customChip, rotate);
    }
  }

  // Press the chip matching the value; otherwise Custom (or, with always-visible fields, none).
  function reflect() {
    const index = presets.findIndex((p) => same(p, value));
    if (index >= 0) {
      press(chips.children[index]);
      showFields(false);
    } else if (customChip) {
      press(customChip);
      showFields(true);
    } else {
      press(null);
      fill();
    }
  }

  function readFields() {
    const a = parseMeasurement(firstInput.value);
    const b = parseMeasurement(secondInput.value);
    const valid = (n) => n !== null && (allowZero ? n >= 0 : n > 0);
    if (!valid(a) || !valid(b)) {
      hint.textContent = allowZero
        ? 'Enter a number like 0.125 or 1/8, or 0 for no gutter.'
        : 'Enter a number like 3.5 or 3 1/2.';
      hint.hidden = false;
      return;
    }
    hint.hidden = true;
    value = { [first]: a, [second]: b };
    if (alwaysShowFields) press(selectable()[presets.findIndex((p) => same(p, value))] ?? null);
    onChange(value);
  }
  firstInput.addEventListener('input', readFields);
  secondInput.addEventListener('input', readFields);

  const api = {
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
    /** Swap the two dimensions. The one change the section makes to its own value. */
    rotate() {
      value = { [first]: value[second], [second]: value[first] };
      reflect();
      onChange(value);
    },
  };
  return api;
}
```

- [ ] **Step 5: app.js — the gutter option and one rotation path**

Gutter section:
```js
  gutter: createSizeInputs($('gutterInputs'), {
    label: 'Gutter', allowZero: true, keys: ['columns', 'rows'], labels: ['Between columns', 'Between rows'],
    alwaysShowFields: true, onChange: (gutter) => update({ gutter }),
  }),
```
Replace `applyRotation`:
```js
/** Turn the sheet or document 90°. The section swaps its own value and reports it through onChange. */
function applyRotation(which) {
  // job.fold.axis is deliberately left alone: it names a sheet-relative direction
  // ('L' along the sheet length, 'W' along the width), not a direction relative to
  // this document, so rotating the document does not change what the axis means.
  sections[which].rotate();
}
```

- [ ] **Step 6: Verify**

Run: `npm test` → `ℹ pass 82` (81 + the new label test; the reworded tests replace existing ones), `ℹ fail 0`.

Browser, using the screenshot skill:
```
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t8.png \
  --print "[...document.querySelectorAll('#sheetInputs .chips button')].map(b=>b.textContent).join(' | ')" \
  --print "[...document.querySelectorAll('#gutterInputs .chips button')].map(b=>b.textContent).join(' | ')" \
  --print "getComputedStyle(document.querySelector('#gutterInputs .custom')).display" \
  --eval "document.querySelector('#sheetInputs button[data-action=rotate]').click()" \
  --print "[...document.querySelectorAll('#sheetInputs .chips button[aria-pressed=true]')].map(b=>b.textContent).join()" \
  --print "[...document.querySelectorAll('#sheetInputs .custom input')].map(i=>i.value).join(' x ')" \
  --print "document.querySelector('.seq-header').textContent"
```
Expected: `12 × 18 | 13 × 19 | Custom | ↻ Rotate`; `⅛" | ¼" | None | ↻ Rotate`; `grid` (gutter fields visible on load); after Rotate: `Custom` pressed, fields `18 x 12`, header says `L = 12 side, W = 18 side`. Then a second `--eval` of the same click must return the `12 × 18` chip to pressed. Also click the hint's `Turn document` and confirm the Document section shows Custom `2 x 3.5` — same path as the button.

- [ ] **Step 7: Commit**

```bash
git add js/ui/presets.js js/ui/sizeInputs.js js/app.js tests/presets.test.js
git commit -F - <<'EOF'
Two sheet presets, Rotate on every size, gutter fields always visible

Asymmetric gutters are common, so the columns/rows fields no longer hide
behind Custom. Rotate is one function shared with the orientation hint.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 9: The Advanced section

**Files:**
- Create: `js/ui/advancedInputs.js`
- Modify: `js/ui/format.js`, `js/ui/presets.js`, `js/app.js`, `index.html`, `css/app.css`, `sw.js`, `.claude/skills/screenshot/SKILL.md`, `tests/format.test.js`, `tests/presets.test.js`

**Interfaces:**
- Consumes: `computeLayout` options (Tasks 3–5), `suggestOrientation` options (Task 7), `formatFraction` (new here).
- Produces: `createAdvancedInputs(container, { onChange })` → `{ setValue({ npa, count, align }, unit, defaultNpa), setAuto({ across, down }) }`; `onChange` receives a patch — one of `{ npa }`, `{ count }`, `{ align }` — in the current unit. `DEFAULTS[unit]` gains `npa`, `count: {}`, `align: {}`. `formatFraction(value)`. Container id `advancedInputs`.

- [ ] **Step 1: Failing tests for the pure parts**

`tests/format.test.js`, add to the import `formatFraction` and append:
```js
test('renders sixteenths as fractions for inch labels', () => {
  assert.equal(formatFraction(0.0625), '1/16');
  assert.equal(formatFraction(0.125), '1/8');
  assert.equal(formatFraction(0.75), '3/4');
  assert.equal(formatFraction(1.5), '1 1/2');
  assert.equal(formatFraction(2), '2');
  assert.equal(formatFraction(0), '0');
  assert.equal(formatFraction(0.1), '0.1'); // not a sixteenth: as typed
});
```
`tests/presets.test.js`, append:
```js
test('the job starts with a 1/16" non-printable area, auto count, and centred alignment', () => {
  assert.deepEqual(DEFAULTS.in.npa, { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 });
  assert.deepEqual(DEFAULTS.mm.npa, { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 });
  assert.deepEqual(DEFAULTS.in.count, {});
  assert.deepEqual(DEFAULTS.in.align, {});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/format.test.js tests/presets.test.js`
Expected: FAIL — `formatFraction` is not exported; `DEFAULTS.in.npa` is undefined.

- [ ] **Step 3: format.js and presets.js**

Append to `js/ui/format.js`:
```js
/** Sixteenths as a fraction for inch labels: 0.0625 -> "1/16", 1.5 -> "1 1/2", 2 -> "2"; anything else as typed. */
export function formatFraction(value) {
  const sixteenths = value * 16;
  if (!Number.isInteger(sixteenths)) return String(value);
  const whole = Math.floor(sixteenths / 16);
  let n = sixteenths - whole * 16;
  if (n === 0) return String(whole);
  let d = 16;
  while (n % 2 === 0) { n /= 2; d /= 2; }
  return whole ? `${whole} ${n}/${d}` : `${n}/${d}`;
}
```
In `js/ui/presets.js`, extend both `DEFAULTS` entries:
```js
const npa = (all) => ({ top: all, bottom: all, left: all, right: all });
```
```js
  in: {
    sheet: size(12, 18), doc: size(3.5, 2), gutter: gutter(0.125, 0.125),
    npa: npa(0.0625), count: {}, align: {},
    fold: { style: 'none', axis: 'L', allowance: 0.0625, custom: [] },
  },
  mm: {
    sheet: size(320, 450), doc: size(90, 55), gutter: gutter(3, 3),
    npa: npa(1.5), count: {}, align: {},
    fold: { style: 'none', axis: 'L', allowance: 1.5, custom: [] },
  },
```

- [ ] **Step 4: advancedInputs.js**

```js
// advancedInputs.js — the collapsed Advanced section: non-printable area per edge,
// manual count, and alignment with offsets. Values are in the current unit as typed.
// The header is a disclosure button carrying a live summary, so an override can
// never hide behind a closed panel.
import { el } from './dom.js';
import { parseMeasurement } from '../core/measure.js';
import { formatFraction } from './format.js';

const EDGES = ['top', 'bottom', 'left', 'right'];
const VERTICAL = [['top', 'Top'], ['center', 'Center'], ['bottom', 'Bottom']];
const HORIZONTAL = [['left', 'Left'], ['center', 'Center'], ['right', 'Right']];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/**
 * @param options  { onChange(patch) }  patch is one of { npa }, { count }, { align }
 * @returns { setValue({ npa, count, align }, unit, defaultNpa), setAuto({ across, down }) }
 *   setValue is for external changes only (unit toggle, a fix button); setAuto every render.
 */
export function createAdvancedInputs(container, { onChange }) {
  let value = { npa: { top: 0, bottom: 0, left: 0, right: 0 }, count: {}, align: {} };
  let unit = 'in';
  let auto = { across: 0, down: 0 };
  let defaultNpa = 0;

  const field = (ariaLabel) => el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': ariaLabel });

  const npaInputs = Object.fromEntries(EDGES.map((edge) => [edge, field(`Non-printable ${edge}`)]));
  const npaGrid = el('div', { class: 'npa-grid' }, ...EDGES.map((edge) => el('label', {}, cap(edge), npaInputs[edge])));

  const acrossInput = field('Documents across');
  const downInput = field('Documents down');
  const countRow = el('div', { class: 'custom' },
    el('label', {}, 'Across', acrossInput), el('span', { class: 'times' }, '×'), el('label', {}, 'Down', downInput));

  const chipRow = (pairs, pick) => {
    const row = el('div', { class: 'chips' });
    for (const [key, text] of pairs) {
      const button = el('button', { type: 'button', 'aria-pressed': 'false', dataset: { edge: key } }, text);
      button.addEventListener('click', () => pick(key));
      row.append(button);
    }
    return row;
  };
  const axes = {
    vertical: { pair: ['top', 'bottom'], chips: chipRow(VERTICAL, (key) => pickEdge(['top', 'bottom'], key)), input: field('Offset from the chosen edge'), label: el('span') },
    horizontal: { pair: ['left', 'right'], chips: chipRow(HORIZONTAL, (key) => pickEdge(['left', 'right'], key)), input: field('Offset from the chosen edge'), label: el('span') },
  };
  for (const axis of Object.values(axes)) axis.row = el('div', { class: 'row', hidden: true }, el('label', {}, axis.label, axis.input));

  const hint = el('p', { class: 'hint', hidden: true });
  const summary = el('span', { class: 'advanced-summary' });
  const caret = el('span', { class: 'caret' }, '▸');
  const disclosure = el('button', { type: 'button', class: 'disclosure', 'aria-expanded': 'false' }, caret, ' Advanced ', summary);
  const body = el('div', { class: 'advanced-body', hidden: true },
    el('p', { class: 'section-label' }, 'Non-printable area'), npaGrid,
    el('p', { class: 'section-label' }, 'Count'), countRow,
    el('p', { class: 'section-label' }, 'Alignment'),
    el('div', { class: 'row' }, el('span', { class: 'row-label' }, 'Vertical'), axes.vertical.chips), axes.vertical.row,
    el('div', { class: 'row' }, el('span', { class: 'row-label' }, 'Horizontal'), axes.horizontal.chips), axes.horizontal.row,
    hint);
  disclosure.addEventListener('click', () => {
    const open = body.hidden;
    body.hidden = !open;
    disclosure.setAttribute('aria-expanded', String(open));
    caret.textContent = open ? '▾' : '▸';
  });
  container.replaceChildren(el('fieldset', { class: 'group advanced' }, el('legend', {}, disclosure), body));

  const chosenEdge = (pair) => pair.find((edge) => edge in value.align) ?? 'center';

  function pickEdge(pair, key) {
    const align = { ...value.align };
    for (const edge of pair) delete align[edge];
    if (key !== 'center') align[key] = 0;
    emit({ align });
  }

  function emit(patch) {
    value = { ...value, ...patch };
    reflect();
    onChange(patch);
  }

  const fmt = (n) => (unit === 'in' ? formatFraction(n) : String(n));

  function describe() {
    const npaValues = EDGES.map((e) => value.npa[e]);
    const npaText = npaValues.every((v) => v === npaValues[0])
      ? `NPA ${fmt(npaValues[0])} all round`
      : `NPA ${EDGES.filter((e) => value.npa[e] !== defaultNpa).map((e) => `${e} ${fmt(value.npa[e])}`).join(', ')}`;
    const countParts = [];
    if (value.count.across !== undefined) countParts.push(`${value.count.across} across`);
    if (value.count.down !== undefined) countParts.push(`${value.count.down} down`);
    const alignParts = EDGES.filter((e) => e in value.align).map((e) => `${cap(e)} +${fmt(value.align[e])}`);
    return `${npaText} · ${countParts.length ? countParts.join(' × ') : 'Auto'} · ${alignParts.length ? alignParts.join(' · ') : 'Centered'}`;
  }

  function reflect() {
    for (const axis of Object.values(axes)) {
      const chosen = chosenEdge(axis.pair);
      for (const b of axis.chips.children) b.setAttribute('aria-pressed', String(b.dataset.edge === chosen));
      axis.row.hidden = chosen === 'center';
      if (chosen !== 'center') {
        axis.label.textContent = `Offset from ${chosen}`;
        // Never rewrite a field the worker is typing in.
        if (document.activeElement !== axis.input) axis.input.value = String(value.align[chosen]);
      }
    }
    acrossInput.placeholder = `Auto (${auto.across})`;
    downInput.placeholder = `Auto (${auto.down})`;
    summary.textContent = describe();
  }

  for (const edge of EDGES) {
    npaInputs[edge].addEventListener('input', () => {
      const n = parseMeasurement(npaInputs[edge].value);
      if (n === null) {
        hint.textContent = `Non-printable ${edge}: enter a number like 1/16, or 0.`;
        hint.hidden = false;
        return;
      }
      hint.hidden = true;
      emit({ npa: { ...value.npa, [edge]: n } });
    });
  }

  for (const [input, key] of [[acrossInput, 'across'], [downInput, 'down']]) {
    input.addEventListener('input', () => {
      const text = input.value.trim();
      const count = { ...value.count };
      if (text === '') {
        delete count[key];
      } else {
        const n = Number(text);
        if (!(Number.isInteger(n) && n >= 1)) {
          hint.textContent = `${cap(key)}: enter a whole number, or clear it for auto.`;
          hint.hidden = false;
          return;
        }
        count[key] = n;
      }
      hint.hidden = true;
      emit({ count });
    });
  }

  for (const axis of Object.values(axes)) {
    axis.input.addEventListener('input', () => {
      const edge = chosenEdge(axis.pair);
      if (edge === 'center') return;
      const n = parseMeasurement(axis.input.value);
      if (n === null) {
        hint.textContent = `Offset from ${edge}: enter a number like 0 or 1/4.`;
        hint.hidden = false;
        return;
      }
      hint.hidden = true;
      emit({ align: { ...value.align, [edge]: n } });
    });
  }

  return {
    setValue(next, nextUnit, nextDefaultNpa) {
      value = { npa: { ...next.npa }, count: { ...next.count }, align: { ...next.align } };
      unit = nextUnit;
      defaultNpa = nextDefaultNpa;
      for (const edge of EDGES) npaInputs[edge].value = String(value.npa[edge]);
      acrossInput.value = value.count.across ?? '';
      downInput.value = value.count.down ?? '';
      hint.hidden = true;
      reflect();
    },
    setAuto(nextAuto) {
      const changed = auto.across !== nextAuto.across || auto.down !== nextAuto.down;
      auto = nextAuto;
      if (changed) reflect();
    },
  };
}
```

- [ ] **Step 5: Wire it — app.js, index.html, css, sw.js, skill**

`index.html`: after `<div id="gutterInputs"></div>` add `<div id="advancedInputs"></div>`.

`js/app.js`: import and construct:
```js
import { createAdvancedInputs } from './ui/advancedInputs.js';
```
```js
const advancedInputs = createAdvancedInputs($('advancedInputs'), { onChange: (patch) => update(patch) });
```
Replace `compute`:
```js
const edgesToInches = (edges) => Object.fromEntries(Object.entries(edges).map(([edge, v]) => [edge, toInches(v)]));

function compute(job) {
  const sheet = sizeToInches(job.sheet);
  const doc = sizeToInches(job.doc);
  const gutter = { columns: toInches(job.gutter.columns), rows: toInches(job.gutter.rows) };
  const options = { npa: edgesToInches(job.npa), count: job.count, align: edgesToInches(job.align) };
  const layout = computeLayout(sheet, doc, gutter, options);
  // A forced count is deliberate; "turning fits more" is noise against it.
  const overridden = job.count.across !== undefined || job.count.down !== undefined;
  const suggestion = overridden ? null : suggestOrientation(sheet, doc, gutter, { npa: options.npa });
  if (!layout.fits) return { layout, suggestion, steps: [], scores: NO_SCORES };
  const fold = {
    style: job.fold.style,
    axis: job.fold.axis,
    allowance: toInches(job.fold.allowance),
    custom: job.fold.custom.map(toInches),
  };
  return { layout, suggestion, steps: computeSequence(layout), scores: computeScores(layout, fold) };
}
```
In `render()`, after `foldInputs.setDocSize(state.job.doc);`:
```js
  advancedInputs.setAuto(result.layout.auto);
```
In `setUnit()`, after `foldInputs.setValue(...)`:
```js
  advancedInputs.setValue({ npa: state.job.npa, count: state.job.count, align: state.job.align }, unit, DEFAULTS[unit].npa.top);
```

`css/app.css`, append:
```css
/* Advanced section: a disclosure header that doubles as a live summary */
.advanced > legend { padding: 0; }
.advanced .disclosure {
  min-width: 0;
  padding: 6px 8px;
  font-size: 13px;
  text-align: left;
  background: var(--face);
  border: 0;
  box-shadow: none;
}
.advanced .disclosure:active { padding: 6px 8px; }
.advanced .caret { display: inline-block; width: 1em; }
.advanced-summary { color: var(--navy); }
.advanced-body { display: grid; gap: 4px; padding-top: 4px; }
.section-label { margin: 8px 0 2px; font-size: 12px; font-weight: bold; }
.npa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.npa-grid label { display: grid; gap: 2px; font-size: 12px; }
.row-label { min-width: 5.5em; font-size: 12px; }
```

`sw.js`: add `'./js/ui/advancedInputs.js',` to `SHELL` (alphabetically first among `js/ui/`).

`.claude/skills/screenshot/SKILL.md`, add rows to the selector table:
```
| Advanced disclosure | `#advancedInputs .disclosure` |
| NPA field | `#advancedInputs input[aria-label="Non-printable top"]` |
| Count field | `#advancedInputs input[aria-label="Documents across"]` |
| Alignment chip | `#advancedInputs button[data-edge="top"]` |
```

- [ ] **Step 6: Verify**

Run: `npm test` → all pass (`sw.test.js` confirms `SHELL` now lists `advancedInputs.js`).

Browser:
```
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t9a.png \
  --print "document.querySelector('#advancedInputs .disclosure').textContent.trim()" \
  --print "getComputedStyle(document.querySelector('#advancedInputs .advanced-body')).display" \
  --print "document.querySelector('#summary .nup').textContent"
```
Expected: `▸ Advanced NPA 1/16 all round · Auto · Centered`; `none` (collapsed); `24-up` — the default NPA does not change the default job.
```
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t9b.png \
  --eval "document.querySelector('#advancedInputs .disclosure').click()" \
  --eval "const i=document.querySelector('#advancedInputs input[aria-label=\"Documents across\"]'); i.value='2'; i.dispatchEvent(new Event('input',{bubbles:true}))" \
  --print "document.querySelector('#summary .nup').textContent" \
  --print "document.querySelector('.advanced-summary').textContent" \
  --print "document.querySelector('#advancedInputs input[aria-label=\"Documents down\"]').placeholder" \
  --eval "document.querySelector('#advancedInputs button[data-edge=top]').click()" \
  --print "document.querySelector('.advanced-summary').textContent" \
  --print "getComputedStyle(document.querySelector('#advancedInputs .row[hidden]')||document.body).display"
```
Expected: `16-up`; `NPA 1/16 all round · 2 across · Centered`; placeholder `Auto (8)`; after Top: `NPA 1/16 all round · 2 across · Top +0` and the vertical offset row is visible (the `[hidden]` query finds only the horizontal row). Read the PNG: the panel is open, three labelled groups, offset field beside "Vertical".

Then the whole point: `--eval` a click on sheet `13 × 19` and `--print` the n-up — expected **24-up**, not 27, because the 1/16" NPA keeps the cards off the edge.

- [ ] **Step 7: Commit**

```bash
git add js/ui/advancedInputs.js js/ui/format.js js/ui/presets.js js/app.js index.html css/app.css sw.js .claude/skills/screenshot/SKILL.md tests/format.test.js tests/presets.test.js
git commit -F - <<'EOF'
Add the Advanced section: non-printable area, count, alignment

Collapsed by default behind a header that summarises its state live, so
an override is never hidden. NPA defaults to 1/16" per edge; a business
card on 13x19 now gives 24-up instead of running cards to the edge.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 10: Warnings with fixes, and the fuller summary

**Files:**
- Modify: `js/ui/summaryView.js`, `js/app.js`

**Interfaces:**
- Consumes: `layout.violations`, `layout.auto`, `layout.printable`, four `margins`, `fits: false` results carrying `imposed` or `margins`; `advancedInputs.setValue` (Task 9).
- Produces: `renderSummary(container, result, { unit, job, hintDismissed, onApply, onDismiss, onFix })`. `onFix` receives one of `{ fix: 'offset', edge, inches }`, `{ fix: 'npa', values: { [edge]: inches } }`, `{ fix: 'count', axis }`.

- [ ] **Step 1: Rewrite summaryView.js**

```js
// summaryView.js — the n-up line, printable/imposed/margin details, the no-fit
// explanation, NPA-violation warnings with their fixes, and the orientation hint.
// A warning never blanks the sequence: the worker may be right and the tool wrong.
import { el } from './dom.js';
import { formatMeasure, formatShort } from './format.js';

const VERTICAL = ['top', 'bottom'];
const HORIZONTAL = ['left', 'right'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const hasNpa = (npa) => Object.values(npa).some((v) => v > 0);

function button(text, onClick) {
  const b = el('button', { type: 'button' }, text);
  b.addEventListener('click', onClick);
  return b;
}

/**
 * @param result   { layout, steps, suggestion }
 * @param options  { unit, job, hintDismissed, onApply(rotate), onDismiss(), onFix(action) }
 *   job is the entered job (current unit): it tells an offset cause from a count cause.
 *   onFix actions carry inches: { fix: 'offset', edge, inches } · { fix: 'npa', values }
 *   · { fix: 'count', axis }.
 */
export function renderSummary(container, { layout, steps, suggestion }, { unit, job, hintDismissed, onApply, onDismiss, onFix }) {
  const fmt = (inches) => `${formatMeasure(inches, unit)} ${unit}`;
  const short = (inches) => `${formatShort(inches, unit)} ${unit}`;
  const children = [];
  if (!layout.fits) {
    children.push(el('div', { class: 'nup' }, 'Does not fit'), el('div', { class: 'panel warning' }, ...explainNoFit(layout, job, fmt, onFix)));
  } else {
    const count = layout.across * layout.down;
    const autoCount = layout.auto.across * layout.auto.down;
    children.push(
      el('div', { class: 'nup' }, `${count}-up${count !== autoCount ? ` (auto would be ${autoCount})` : ''}`),
      el('p', { class: 'detail' }, `${layout.across} across × ${layout.down} down · ${steps.length} cuts`),
    );
    if (hasNpa(layout.npa)) children.push(el('p', { class: 'detail' }, `Printable ${fmt(layout.printable.width)} × ${fmt(layout.printable.length)}`));
    const m = layout.margins;
    children.push(el('p', { class: 'detail' },
      `Imposed ${fmt(layout.imposed.width)} × ${fmt(layout.imposed.length)} · margins ${short(m.top)} head · ${short(m.bottom)} foot · ${short(m.left)} left · ${short(m.right)} right`));
    for (const pair of [VERTICAL, HORIZONTAL]) {
      const panel = violationPanel(layout, job, pair, { short, onFix });
      if (panel) children.push(panel);
    }
  }
  if (suggestion && !hintDismissed) children.push(hintBox(suggestion, layout, { onApply, onDismiss }));
  container.replaceChildren(...children);
}

// One panel per axis with a violation. The first fix trusts the NPA and moves the
// block (or restores the auto count); the second trusts the placement and shrinks
// the NPA to what is actually there.
function violationPanel(layout, job, pair, { short, onFix }) {
  const hits = layout.violations.filter((v) => pair.includes(v.edge));
  if (hits.length === 0) return null;
  const edges = hits.map((v) => v.edge);
  const axis = pair === VERTICAL ? 'down' : 'across';
  const unitName = pair === VERTICAL ? 'row' : 'column';
  const where = edges.length === 1 ? `${cap(edges[0])} ${unitName} sits` : `${cap(edges[0])} and ${edges[1]} ${unitName}s sit`;
  const amount = Math.max(...hits.map((v) => v.amount));
  const message = `${where} ${short(amount)} inside the non-printable area.`;

  const offsetEdge = pair.find((edge) => edge in job.align);
  const first = offsetEdge !== undefined
    ? button(`Offset → ${short(layout.npa[offsetEdge])}`, () => onFix({ fix: 'offset', edge: offsetEdge, inches: layout.npa[offsetEdge] }))
    : button(`Back to auto (${layout.auto[axis]} ${axis})`, () => onFix({ fix: 'count', axis }));
  const values = Object.fromEntries(edges.map((edge) => [edge, layout.margins[edge]]));
  const second = button(`NPA ${edges.join(' & ')} → ${short(values[edges[0]])}`, () => onFix({ fix: 'npa', values }));
  return el('div', { class: 'panel warning' }, el('p', {}, message), el('div', { class: 'actions' }, first, second));
}

function explainNoFit(layout, job, fmt, onFix) {
  const { sheet, doc, gutter, across, down, auto, imposed, margins } = layout;
  const parts = [];
  if (imposed && (imposed.width > sheet.width || imposed.length > sheet.length)) {
    // A count the physical sheet cannot hold.
    if (imposed.width > sheet.width) {
      parts.push(el('p', {}, `${across} across won't fit: ${across} × ${fmt(doc.width)} + ${across - 1} × ${fmt(gutter.columns)} = ${fmt(imposed.width)}, sheet is ${fmt(sheet.width)}.`),
        el('div', { class: 'actions' }, button(`Back to auto (${auto.across} across)`, () => onFix({ fix: 'count', axis: 'across' }))));
    }
    if (imposed.length > sheet.length) {
      parts.push(el('p', {}, `${down} down won't fit: ${down} × ${fmt(doc.length)} + ${down - 1} × ${fmt(gutter.rows)} = ${fmt(imposed.length)}, sheet is ${fmt(sheet.length)}.`),
        el('div', { class: 'actions' }, button(`Back to auto (${auto.down} down)`, () => onFix({ fix: 'count', axis: 'down' }))));
    }
  } else if (margins) {
    // An offset pushed the block off the far edge.
    for (const pair of [VERTICAL, HORIZONTAL]) {
      const chosen = pair.find((edge) => edge in job.align);
      const far = pair.find((edge) => edge !== chosen);
      if (chosen !== undefined && margins[far] < 0) {
        // The chosen edge's margin is the offset itself, already in inches.
        parts.push(el('p', {}, `An offset of ${fmt(margins[chosen])} from the ${chosen} pushes the block ${fmt(-margins[far])} past the ${far} edge.`),
          el('div', { class: 'actions' }, button('Offset → 0', () => onFix({ fix: 'offset', edge: chosen, inches: 0 }))));
      }
    }
  } else {
    // The document itself is bigger than the printable region. The gutter only sits
    // between documents, so it never keeps the first one from fitting.
    if (across < 1) parts.push(el('p', {}, `The document width (${fmt(doc.width)}) is wider than the printable width (${fmt(layout.printable.width)}).`));
    if (down < 1) parts.push(el('p', {}, `The document length (${fmt(doc.length)}) is longer than the printable length (${fmt(layout.printable.length)}).`));
    parts.push(el('p', {}, 'Turn the document, use a larger sheet, or reduce the non-printable area.'));
  }
  return parts;
}

// The tool reports what the sheet as entered does; a better turn is offered, never applied.
function hintBox(suggestion, layout, { onApply, onDismiss }) {
  const what = suggestion.rotate === 'doc' ? 'document' : 'sheet';
  const current = layout.fits ? layout.across * layout.down : 0;
  return el('div', { class: 'panel hint-box' },
    el('p', {}, `Turning the ${what} fits ${suggestion.count}-up${current > 0 ? ` instead of ${current}-up` : ''}.`),
    el('div', { class: 'actions' },
      button(`Turn ${what}`, () => onApply(suggestion.rotate)),
      button('Keep as entered', onDismiss)));
}
```

- [ ] **Step 2: app.js — the fix handler and the new options**

Add `inchesToMm` to the measure import:
```js
import { mmToInches, inchesToMm } from './core/measure.js';
```
Add after `dismissHint`:
```js
/** Apply a fix the summary offered. Values arrive in inches; the job holds the current unit. */
function applyFix(action) {
  const fromInches = (v) => (state.unit === 'mm' ? inchesToMm(v) : v);
  const job = state.job;
  if (action.fix === 'offset') {
    update({ align: { ...job.align, [action.edge]: fromInches(action.inches) } });
  } else if (action.fix === 'npa') {
    const values = Object.fromEntries(Object.entries(action.values).map(([edge, v]) => [edge, fromInches(v)]));
    update({ npa: { ...job.npa, ...values } });
  } else if (action.fix === 'count') {
    const count = { ...job.count };
    delete count[action.axis];
    update({ count });
  }
  // An external change to the advanced values: echo it into the section.
  advancedInputs.setValue({ npa: state.job.npa, count: state.job.count, align: state.job.align }, state.unit, DEFAULTS[state.unit].npa.top);
}
```
Update the `renderSummary` call in `render()`:
```js
  renderSummary($('summary'), result, {
    unit: state.unit,
    job: state.job,
    hintDismissed: state.hintDismissed,
    onApply: applyRotation,
    onDismiss: dismissHint,
    onFix: applyFix,
  });
```

- [ ] **Step 3: Verify**

Run: `npm test` → all pass (no core change).

Browser — the offset cause:
```
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t10a.png \
  --eval "document.querySelector('#advancedInputs .disclosure').click()" \
  --eval "document.querySelector('#advancedInputs button[data-edge=top]').click()" \
  --print "document.querySelector('#summary .warning p').textContent" \
  --print "[...document.querySelectorAll('#summary .warning button')].map(b=>b.textContent).join(' | ')" \
  --print "document.querySelectorAll('li.step').length" \
  --clip "#summary"
```
Expected: `Top row sits 0.063 in inside the non-printable area.`; buttons `Offset → 0.063 in | NPA top → 0 in`; the sequence still renders (21 steps — flush top, no head cut). Read the PNG. Then `--eval` a click on the first fix button and `--print` that the warning is gone and the Advanced summary reads `… · Top +1/16`. Repeat from fresh, click the second fix: warning gone, summary reads `NPA top 0 · Auto · Top +0`, sequence still 21 steps.

The count cause:
```
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t10b.png \
  --eval "document.querySelector('#sheetInputs .chips button:nth-child(2)').click()" \
  --eval "document.querySelector('#advancedInputs .disclosure').click()" \
  --eval "const i=document.querySelector('#advancedInputs input[aria-label=\"Documents down\"]'); i.value='9'; i.dispatchEvent(new Event('input',{bubbles:true}))" \
  --print "document.querySelector('#summary .nup').textContent" \
  --print "document.querySelector('#summary .warning p').textContent" \
  --print "[...document.querySelectorAll('#summary .warning button')].map(b=>b.textContent).join(' | ')" \
  --print "!!document.querySelector('#summary .hint-box')"
```
Expected: `27-up (auto would be 24)`; `Top and bottom rows sit 0.063 in inside the non-printable area.`; `Back to auto (8 down) | NPA top & bottom → 0 in`; `false` (hint suppressed while overriding).

The no-fit count: on 12×18 set Across to `4` → `Does not fit`, message `4 across won't fit: 4 × 3.500 in + 3 × 0.125 in = 14.375 in, sheet is 12.000 in.`, button `Back to auto (3 across)`; clicking it restores 24-up.

- [ ] **Step 4: Commit**

```bash
git add js/ui/summaryView.js js/app.js
git commit -F - <<'EOF'
Warn about placements inside the non-printable area, with fixes

One panel per axis, worded to its cause. The first fix trusts the NPA and
moves the block or restores the auto count; the second trusts the placement
and shrinks the NPA. A warning never blanks the sequence.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 11: The printable boundary on the sheet view

**Files:**
- Modify: `js/ui/sheetView.js`

**Interfaces:**
- Consumes: `layout.npa`, `layout.printable` (present on every `computeLayout` result, fitting or not).

- [ ] **Step 1: Draw it**

In `paint()`, immediately after the sheet's black border is stroked and before the head marker:
```js
    // The printable boundary, when there is a non-printable area: a dotted inset the
    // block should sit inside. In a violation the block visibly crosses it.
    if (Object.values(layout.npa).some((v) => v > 0)) {
      ctx.save();
      ctx.strokeStyle = PALETTE.shadow;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.strokeRect(X(layout.npa.left) + 0.5, Y(layout.npa.top) + 0.5,
                     layout.printable.width * scale - 1, layout.printable.length * scale - 1);
      ctx.restore();
    }
```

- [ ] **Step 2: Verify**

`python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t11a.png --clip "#canvas"` — read it: a faint dotted rectangle just inside the sheet edge, the 24 cards inside it.

Then with a violation: `--eval` open Advanced, click `Top`, `--clip "#canvas"` — the top row of cards now touches the sheet edge and crosses the dotted line.

`npm test` → unchanged.

- [ ] **Step 3: Commit**

```bash
git add js/ui/sheetView.js
git commit -F - <<'EOF'
Draw the printable boundary on the sheet view

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 12: Docs, cache version, final pass

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `sw.js`, `.claude/settings.json`

- [ ] **Step 1: CLAUDE.md — the cutting model section and names**

Replace the "The cutting model" section with:
```markdown
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

**A margin cut exists on an edge iff that edge's margin is greater than zero.**
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
```
In "Architecture", add: `gutter` is `{ columns, rows }` — the gutter between columns and between rows; and `js/app.js` keeps everything the worker entered under `state.job` in the current unit. In "Design decisions that look like bugs", add: NPA, alignment, and offsets are sheet-relative and do not rotate with the sheet, like the fold axis.

- [ ] **Step 2: README.md**

In the opening paragraph, after "score positions for folds.", add: "An Advanced section sets the printer's non-printable area, a manual count, and alignment with offsets." In "Tests", change "two hand-verified program sequences" to "three hand-verified program sequences".

- [ ] **Step 3: sw.js**

`const VERSION = 'v3';`

- [ ] **Step 4: The core-test hook covers the new suites**

In `.claude/settings.json`, the second `PostToolUse` hook runs the hand-verified fixtures whenever `js/core/` changes. Its `node --test` list gains the three suites this plan added:
```
node --test tests/sequence.test.js tests/layout.test.js tests/scores.test.js tests/measure.test.js tests/printable.test.js tests/count.test.js tests/placement.test.js
```
Confirm with `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"` that the file still parses.

- [ ] **Step 5: The full pass**

Run: `npm test` → all pass. Run: `git status` → only the three files above modified.

Browser at 390×844, using the screenshot skill:
1. Default: `24-up`, 22 steps, 4 turn bands, hint present, Advanced collapsed reading `▸ Advanced NPA 1/16 all round · Auto · Centered`.
2. Sheet `13 × 19` → **24-up** (not 27).
3. Advanced → NPA top `0`, Vertical `Top` → 21 steps, no warning, first step `11.375`, bands before 2/3/8 — **FLUSH_TOP, live.**
4. Back to default, `Top` with NPA still 1/16 → warning with two fixes; each fix clears it.
5. Down `9` on 13×19 → `27-up (auto would be 24)`, two-edge warning, hint suppressed.
6. Across `4` → `Does not fit` with `Back to auto (3 across)`.
7. Rotate on Sheet, Document, Gutter each swap; the hint's `Turn document` matches the Document Rotate.
8. Gutter fields visible on load, labelled `Between columns` / `Between rows`; typing `1/4` in one only changes that gutter.
9. `mm`: everything re-renders, NPA fields read `1.5`, header `NPA 1.5 all round`.
10. Nothing scrolls horizontally: `document.documentElement.scrollWidth === clientWidth`.

Desktop 1200×900: two columns still. Offline (fresh profile, `Network.emulateNetworkConditions offline`): loads and recalculates.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md sw.js .claude/settings.json
git commit -F - <<'EOF'
Document the advanced inputs and bump the cache version

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```
