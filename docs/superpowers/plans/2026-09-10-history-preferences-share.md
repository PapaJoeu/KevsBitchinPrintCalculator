# History, Preferences, and Share-by-URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a worker get back to a job they set up earlier, reopen the app the way they left it, and hand a setup to another phone — with no server, no account, and no dependency.

**Architecture:** Three tabs (Calculator | History | Preferences) over the existing single-state render loop in `js/app.js`. A pure codec in `js/core/share.js` turns the job into a URL hash and back; a pure list function in `js/core/history.js` records settled jobs with dedupe and a cap; `js/storage.js` is the only file that touches `localStorage`, with every call in try/catch so the app still works with no storage at all. One function, `loadJob(unit, job)`, is the only path by which a job reaches the inputs — from a link, from history, from resume, or from the unit toggle.

**Tech Stack:** Vanilla ES modules, `node:test`, Node 24, no dependencies, no build step. Static site on GitHub Pages with a cache-first service worker.

**Spec:** `docs/superpowers/specs/2026-09-10-history-preferences-share-design.md` (extends `2026-09-09-mobile-print-calculator-design.md` and `2026-09-09-advanced-inputs-design.md`).

## Global Constraints

- No dependencies, no build step. Plain ES modules only.
- `js/core/` is pure: no DOM, no storage, never imports from `js/ui/` or `js/storage.js`. The share codec therefore takes defaults as a parameter rather than importing `DEFAULTS`.
- `js/storage.js` is the **only** file that touches `localStorage`. Every access is wrapped in try/catch; a failed read returns `null`, a failed write does nothing. With storage unavailable the calculator behaves exactly as it does today.
- A persisted or shared `job` is `state.job` exactly as entered, in its own unit, never converted. Nothing derived (n-up, cuts) is stored.
- Storage keys are `printcalc.prefs`, `printcalc.last`, `printcalc.history`; every document carries `v: 1`. A document with another `v` or that fails to parse is treated as absent — never migrated, never deleted.
- History records a job only when it **settles**: 15 000 ms with no edits, and only if the layout fits. Dedupe is on the whole `{ unit, job }` by structural equality; max 20 entries, newest first.
- `last` (resume) is written on **every** change while `prefs.resume` is on, and deleted the moment it is turned off.
- The URL hash mirrors the current job after every render via `window.history.replaceState` — never `pushState`, so the Back button is untouched.
- Load order on open: a hash that decodes → `last` if `prefs.resume` → `DEFAULTS[prefs.unit]`.
- Fold style identifiers are exactly `none | bifold | trifold | zfold`; axis is `L | W`.
- Every new file is added to `SHELL` in `sw.js` in the task that creates it; `VERSION` becomes `'v4'` in Task 1 and stays there. `tests/sw.test.js` enforces the list.
- Test command: `npm test`. `node --test tests/` does NOT work on Node 24.
- Every commit message ends with this exact line, verbatim: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- Stage only the files each task names. Never `git add -A` or `git add .` — `.superpowers/` is git-ignored scratch and must not be committed.
- Verify UI with `python .claude/skills/screenshot/shoot.py <url> <w> <h> <out.png> [--eval JS]... [--print JS]...`, never `chrome --headless --window-size`. All `--eval`s run before any `--print`; to observe state between two actions, use two invocations.
- The three hand-verified fixtures in `tests/sequence.test.js` are untouchable. Nothing in this plan changes `js/core/layout.js`, `js/core/sequence.js`, or `js/core/scores.js`.

---

## File structure

| File | Responsibility |
|---|---|
| `js/core/share.js` (new) | `encodeJob(unit, job, defaults) → string`, `decodeJob(hash, defaultsByUnit) → { unit, job } \| null`. Pure string work. |
| `js/core/history.js` (new) | `recordJob(entries, unit, job, now) → entries`, `sameJob(a, b)`, `MAX_HISTORY`. Pure list logic. |
| `js/storage.js` (new) | `createStorage(store)` → `{ available, loadPrefs, savePrefs, loadLast, saveLast, clearLast, loadHistory, saveHistory }`; `browserStorage()`. The only `localStorage` user. |
| `js/ui/format.js` (modify) | Gains `relativeTime`, `describeAdvanced` (moved out of `advancedInputs.js`), `describeFold`. |
| `js/ui/advancedInputs.js` (modify) | Uses `describeAdvanced` from `format.js` instead of its private `describe()`. |
| `js/ui/tabs.js` (new) | `createTabs(container, tabs, { onSelect })` → `{ select(id), setBadge(id, count) }`. |
| `js/ui/copyLink.js` (new) | `createCopyLink(getUrl)` → element: a Copy link button with a "Copied" state and a read-only-field fallback. |
| `js/ui/historyView.js` (new) | `createHistoryView(container, { summarize, onLoad, onDelete, onClear, copyLink })` → `{ render(entries, { unit, available, now }) }`. |
| `js/ui/preferencesView.js` (new) | `createPreferencesView(container, { onChange })` → `{ setValue(prefs) }`. |
| `js/app.js` (modify) | `state` gains `tab`, `prefs`, `history`; `loadJob`; settle timer; hash sync; tab switching; wiring. |
| `index.html` (modify) | Tab strip container and three `role="tabpanel"` sections; `#shareBar` in the Layout group. |
| `css/app.css` (modify) | Tab strip, views, history rows, preferences rows. |
| `sw.js` (modify) | `SHELL` gains the six new files; `VERSION` `'v4'`. |
| `tests/share.test.js`, `tests/history.test.js`, `tests/storage.test.js` (new); `tests/format.test.js` (modify) | Automated coverage for everything pure. |
| `CLAUDE.md`, `README.md`, `.claude/skills/screenshot/SKILL.md` (modify) | Docs and selectors. |

Expected test counts are expectations, not a binding check; the binding check is `fail 0` and the three sequence fixtures passing.

---

### Task 1: The share codec

**Files:**
- Create: `js/core/share.js`
- Create: `tests/share.test.js`
- Modify: `sw.js` (add `./js/core/share.js` to `SHELL`; `VERSION` → `'v4'`)

**Interfaces:**
- Consumes: `DEFAULTS` from `js/ui/presets.js` (in tests only — the codec receives defaults as an argument).
- Produces: `encodeJob(unit, job, defaults) → string` (the hash body, no leading `#`); `decodeJob(hash, defaultsByUnit) → { unit, job } | null` (accepts a leading `#`, percent-encoded text, or an empty string).

- [ ] **Step 1: Write the failing tests**

Create `tests/share.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeJob, decodeJob } from '../js/core/share.js';
import { DEFAULTS } from '../js/ui/presets.js';

const size = (width, length) => ({ width, length });
const job = (unit, patch = {}) => ({ ...structuredClone(DEFAULTS[unit]), ...patch });

const roundTrip = (unit, j) => decodeJob(encodeJob(unit, j, DEFAULTS[unit]), DEFAULTS);

test('the default job encodes to the short form and decodes back', () => {
  assert.equal(encodeJob('in', job('in'), DEFAULTS.in), 'v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125');
  assert.deepEqual(roundTrip('in', job('in')), { unit: 'in', job: job('in') });
  assert.deepEqual(decodeJob('#v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125', DEFAULTS), { unit: 'in', job: job('in') });
});

test('round-trips the hand-verified fixtures', () => {
  const twoUp = job('in', { doc: size(11, 8.5) });
  assert.deepEqual(roundTrip('in', twoUp), { unit: 'in', job: twoUp });
  const flushTop = job('in', { npa: { top: 0, bottom: 0.0625, left: 0.0625, right: 0.0625 }, align: { top: 0 } });
  assert.equal(encodeJob('in', flushTop, DEFAULTS.in), 'v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125&n=0,0.0625,0.0625,0.0625&a=top=0');
  assert.deepEqual(roundTrip('in', flushTop), { unit: 'in', job: flushTop });
});

test('round-trips millimetres, counts, two-edge alignment, folds, and custom scores', () => {
  const mm = job('mm', { sheet: size(297, 420), gutter: { columns: 5, rows: 0 } });
  assert.deepEqual(roundTrip('mm', mm), { unit: 'mm', job: mm });

  const across = job('in', { count: { across: 2 } });
  assert.match(encodeJob('in', across, DEFAULTS.in), /&c=2x$/);
  assert.deepEqual(roundTrip('in', across), { unit: 'in', job: across });
  const down = job('in', { count: { down: 9 } });
  assert.match(encodeJob('in', down, DEFAULTS.in), /&c=x9$/);
  assert.deepEqual(roundTrip('in', down), { unit: 'in', job: down });
  const both = job('in', { count: { across: 2, down: 9 } });
  assert.deepEqual(roundTrip('in', both), { unit: 'in', job: both });

  const corner = job('in', { align: { top: 0.5, left: 0 } });
  assert.match(encodeJob('in', corner, DEFAULTS.in), /&a=top=0\.5,left=0$/);
  assert.deepEqual(roundTrip('in', corner), { unit: 'in', job: corner });

  const folded = job('in', { fold: { style: 'trifold', axis: 'W', allowance: 0.125, custom: [1, 2.5] } });
  assert.equal(encodeJob('in', folded, DEFAULTS.in), 'v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125&f=trifold|W|0.125&x=1,2.5');
  assert.deepEqual(roundTrip('in', folded), { unit: 'in', job: folded });
});

test('omitted keys fill in from the defaults of the named unit', () => {
  const decoded = decodeJob('v=1&u=mm&s=320x450&d=90x55&g=3x3', DEFAULTS);
  assert.deepEqual(decoded, { unit: 'mm', job: job('mm') });
});

test('accepts percent-encoded hashes', () => {
  const encoded = encodeURIComponent('v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125&f=bifold|L|0.0625');
  const expected = job('in', { fold: { style: 'bifold', axis: 'L', allowance: 0.0625, custom: [] } });
  assert.deepEqual(decodeJob(`#${encoded}`, DEFAULTS), { unit: 'in', job: expected });
});

test('rejects anything malformed with null, never a partial job', () => {
  const base = 'v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125';
  const bad = [
    '', '#', 'u=in&s=12x18&d=3.5x2&g=0.125x0.125',          // missing v
    base.replace('v=1', 'v=2'),                             // unknown version
    base.replace('u=in', 'u=cm'),                           // unknown unit
    base.replace('s=12x18', 's=12x'),                       // half a size
    base.replace('s=12x18', 's=12x18x2'),                   // too many parts
    base.replace('d=3.5x2', 'd=abcx2'),                     // not a number
    base.replace('d=3.5x2', 'd=0x2'),                       // zero document
    base.replace('d=3.5x2', 'd=-3.5x2'),                    // negative
    `${base}&n=1,2,3`,                                      // three edges
    `${base}&n=1,2,3,x`,                                    // non-numeric edge
    `${base}&a=top=0,bottom=0`,                             // both edges of an axis
    `${base}&a=middle=0`,                                   // unknown edge
    `${base}&a=top`,                                        // no value
    `${base}&c=2.5x`,                                       // fractional count
    `${base}&c=0x`,                                         // zero count
    `${base}&c=x`,                                          // empty count
    `${base}&f=accordion|L|0`,                              // unknown fold style
    `${base}&f=bifold|D|0`,                                 // unknown axis
    `${base}&f=bifold|L`,                                   // missing allowance
    `${base}&x=1,two`,                                      // non-numeric score
    `${base}&%E0%A4%A`,                                     // malformed percent-encoding
    'v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125&junk',          // a piece with no "="
  ];
  for (const hash of bad) assert.equal(decodeJob(hash, DEFAULTS), null, `should reject ${JSON.stringify(hash)}`);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/share.test.js`
Expected: FAIL — `Cannot find module '.../js/core/share.js'`.

- [ ] **Step 3: Write the codec**

Create `js/core/share.js`:

```js
// share.js — the job as a URL hash and back. Pure: no DOM, no storage, no unit
// conversion. The hash mirrors the job as entered, in its own unit; keys at their
// default are omitted so the common link stays short. Anything malformed decodes
// to null — never a partial job. Defaults arrive as a parameter: core never
// imports from js/ui/.
//
//   v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125[&n=t,b,l,r][&c=AxD][&a=edge=n,...][&f=style|axis|allowance][&x=n,...]

const UNITS = ['in', 'mm'];
const EDGES = ['top', 'bottom', 'left', 'right'];
const FOLD_STYLES = ['bifold', 'trifold', 'zfold'];
const AXES = ['L', 'W'];

// A plain non-negative decimal as typed: "3.5", ".125", "0". No sign, no exponent, no hex.
const NUMBER = /^(?:\d+\.?\d*|\.\d+)$/;
const nonNegative = (text) => (typeof text === 'string' && NUMBER.test(text) ? Number(text) : null);
const positive = (text) => {
  const n = nonNegative(text);
  return n !== null && n > 0 ? n : null;
};

/** "AxB" → { [keys[0]]: A, [keys[1]]: B }, each part checked by `each`; null if malformed. */
function pairOf(text, each, keys) {
  if (typeof text !== 'string') return null;
  const parts = text.split('x');
  if (parts.length !== 2) return null;
  const a = each(parts[0]);
  const b = each(parts[1]);
  return a === null || b === null ? null : { [keys[0]]: a, [keys[1]]: b };
}

/** The hash body for a job, without the leading '#'. `defaults` is DEFAULTS[unit]. */
export function encodeJob(unit, job, defaults) {
  const parts = [
    'v=1',
    `u=${unit}`,
    `s=${job.sheet.width}x${job.sheet.length}`,
    `d=${job.doc.width}x${job.doc.length}`,
    `g=${job.gutter.columns}x${job.gutter.rows}`,
  ];
  if (EDGES.some((edge) => job.npa[edge] !== defaults.npa[edge])) parts.push(`n=${EDGES.map((edge) => job.npa[edge]).join(',')}`);
  if (job.count.across !== undefined || job.count.down !== undefined) parts.push(`c=${job.count.across ?? ''}x${job.count.down ?? ''}`);
  const aligned = EDGES.filter((edge) => edge in job.align);
  if (aligned.length) parts.push(`a=${aligned.map((edge) => `${edge}=${job.align[edge]}`).join(',')}`);
  if (job.fold.style !== 'none') parts.push(`f=${job.fold.style}|${job.fold.axis}|${job.fold.allowance}`);
  if (job.fold.custom.length) parts.push(`x=${job.fold.custom.join(',')}`);
  return parts.join('&');
}

/** A job from a hash (with or without '#', percent-encoded or not), or null. `defaultsByUnit` is DEFAULTS. */
export function decodeJob(hash, defaultsByUnit) {
  let text;
  try {
    text = decodeURIComponent(String(hash ?? '').replace(/^#/, ''));
  } catch {
    return null;
  }
  if (!text) return null;

  const fields = new Map();
  for (const piece of text.split('&')) {
    const at = piece.indexOf('=');
    if (at <= 0) return null;
    fields.set(piece.slice(0, at), piece.slice(at + 1));
  }
  if (fields.get('v') !== '1') return null;
  const unit = fields.get('u');
  if (!UNITS.includes(unit)) return null;
  const defaults = defaultsByUnit[unit];

  const sheet = pairOf(fields.get('s'), positive, ['width', 'length']);
  const doc = pairOf(fields.get('d'), positive, ['width', 'length']);
  const gutter = pairOf(fields.get('g'), nonNegative, ['columns', 'rows']);
  if (!sheet || !doc || !gutter) return null;
  const job = { sheet, doc, gutter, npa: { ...defaults.npa }, count: {}, align: {}, fold: structuredClone(defaults.fold) };

  if (fields.has('n')) {
    const values = fields.get('n').split(',').map(nonNegative);
    if (values.length !== 4 || values.includes(null)) return null;
    job.npa = Object.fromEntries(EDGES.map((edge, i) => [edge, values[i]]));
  }

  if (fields.has('c')) {
    const parts = fields.get('c').split('x');
    if (parts.length !== 2 || (parts[0] === '' && parts[1] === '')) return null;
    for (const [key, part] of [['across', parts[0]], ['down', parts[1]]]) {
      if (part === '') continue;
      const n = nonNegative(part);
      if (n === null || !Number.isInteger(n) || n < 1) return null;
      job.count[key] = n;
    }
  }

  if (fields.has('a')) {
    for (const item of fields.get('a').split(',')) {
      const [edge, value] = item.split('=');
      const n = nonNegative(value);
      if (!EDGES.includes(edge) || n === null || edge in job.align) return null;
      job.align[edge] = n;
    }
    if (('top' in job.align && 'bottom' in job.align) || ('left' in job.align && 'right' in job.align)) return null;
  }

  if (fields.has('f')) {
    const [style, axis, allowance, ...rest] = fields.get('f').split('|');
    const n = nonNegative(allowance);
    if (rest.length || !FOLD_STYLES.includes(style) || !AXES.includes(axis) || n === null) return null;
    job.fold = { style, axis, allowance: n, custom: [] };
  }

  if (fields.has('x')) {
    const values = fields.get('x').split(',').map(nonNegative);
    if (values.includes(null)) return null;
    job.fold.custom = values;
  }

  return { unit, job };
}
```

- [ ] **Step 4: Add the file to the service-worker shell and bump the version**

In `sw.js`, change `const VERSION = 'v3';` to `const VERSION = 'v4';` and insert `'./js/core/share.js',` into `SHELL` after `'./js/core/sequence.js',`.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: `ℹ fail 0`; 90 tests (84 + 6). `tests/sw.test.js` passes because the new file is listed.

- [ ] **Step 6: Commit**

```bash
git add js/core/share.js tests/share.test.js sw.js
git commit -m "Encode the job as a URL hash and decode it back

Pure codec; defaults are a parameter so core stays free of js/ui.
Malformed hashes decode to null, never a partial job.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Recording jobs — dedupe and cap

**Files:**
- Create: `js/core/history.js`
- Create: `tests/history.test.js`
- Modify: `sw.js` (add `./js/core/history.js` to `SHELL`)

**Interfaces:**
- Produces: `MAX_HISTORY = 20`; `sameJob(a, b) → boolean` (structural equality, key order ignored, `undefined`-valued keys ignored); `recordJob(entries, unit, job, now) → entries` (returns a new array; never mutates its input).

- [ ] **Step 1: Write the failing tests**

Create `tests/history.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordJob, sameJob, MAX_HISTORY } from '../js/core/history.js';
import { DEFAULTS } from '../js/ui/presets.js';

const job = (patch = {}) => ({ ...structuredClone(DEFAULTS.in), ...patch });

test('structural equality ignores key order and undefined-valued keys', () => {
  assert.ok(sameJob({ sheet: { width: 12, length: 18 } }, { sheet: { length: 18, width: 12 } }));
  assert.ok(sameJob({ count: {} }, { count: { across: undefined } }));
  assert.ok(!sameJob(job(), job({ doc: { width: 2, length: 3.5 } })));
  assert.ok(!sameJob(job({ align: { top: 0 } }), job({ align: { bottom: 0 } })));
});

test('an unknown job goes on top with its timestamp', () => {
  const entries = recordJob([], 'in', job(), 1000);
  assert.deepEqual(entries, [{ unit: 'in', job: job(), at: 1000 }]);
  const next = recordJob(entries, 'in', job({ doc: { width: 11, length: 8.5 } }), 2000);
  assert.equal(next.length, 2);
  assert.equal(next[0].at, 2000);
  assert.deepEqual(next[1], entries[0]);
});

test('re-recording the same job bumps it to the top with a new timestamp instead of duplicating', () => {
  const a = job();
  const b = job({ doc: { width: 11, length: 8.5 } });
  let entries = recordJob([], 'in', a, 1000);
  entries = recordJob(entries, 'in', b, 2000);
  entries = recordJob(entries, 'in', structuredClone(a), 3000);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((e) => e.at), [3000, 2000]);
  assert.deepEqual(entries[0].job, a);
});

test('the same numbers in a different unit are a different job', () => {
  let entries = recordJob([], 'in', job(), 1000);
  entries = recordJob(entries, 'mm', job(), 2000);
  assert.equal(entries.length, 2);
});

test('never holds more than MAX_HISTORY entries, dropping the oldest', () => {
  let entries = [];
  for (let i = 0; i < MAX_HISTORY + 5; i += 1) {
    entries = recordJob(entries, 'in', job({ doc: { width: 1 + i, length: 1 } }), i);
  }
  assert.equal(MAX_HISTORY, 20);
  assert.equal(entries.length, MAX_HISTORY);
  assert.equal(entries[0].at, MAX_HISTORY + 4);
  assert.equal(entries[MAX_HISTORY - 1].at, 5);
});

test('does not mutate its input or share the job object', () => {
  const original = [];
  const j = job();
  const entries = recordJob(original, 'in', j, 1);
  assert.equal(original.length, 0);
  j.doc.width = 99;
  assert.equal(entries[0].job.doc.width, 3.5);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/history.test.js`
Expected: FAIL — `Cannot find module '.../js/core/history.js'`.

- [ ] **Step 3: Write the list logic**

Create `js/core/history.js`:

```js
// history.js — the recent-jobs list as pure data. Recording is dedupe-on-top with a
// cap; when and whether to record (the settle timer, "only if it fits") is the app's
// call. No storage, no DOM.

export const MAX_HISTORY = 20;

/** A canonical string for structural comparison: keys sorted, undefined-valued keys dropped. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    return `{${keys.map((key) => `${key}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sameJob(a, b) {
  return canonical(a) === canonical(b);
}

/**
 * A new entries array with { unit, job, at } on top. A matching entry (same unit,
 * structurally equal job) is removed from wherever it was, so re-running a setup
 * bumps it rather than repeating it. Never more than MAX_HISTORY; never mutates.
 */
export function recordJob(entries, unit, job, now) {
  const rest = entries.filter((entry) => !(entry.unit === unit && sameJob(entry.job, job)));
  return [{ unit, job: structuredClone(job), at: now }, ...rest].slice(0, MAX_HISTORY);
}
```

- [ ] **Step 4: Add the file to the service-worker shell**

In `sw.js`, insert `'./js/core/history.js',` into `SHELL` after `'./js/core/layout.js',` (keep the `js/core/` entries alphabetical: history, layout, measure, scores, sequence, share).

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: `ℹ fail 0`; 96 tests.

- [ ] **Step 6: Commit**

```bash
git add js/core/history.js tests/history.test.js sw.js
git commit -m "Record settled jobs: dedupe on top, cap at twenty

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Storage — the only localStorage user

**Files:**
- Create: `js/storage.js`
- Create: `tests/storage.test.js`
- Modify: `sw.js` (add `./js/storage.js` to `SHELL`)

**Interfaces:**
- Produces: `createStorage(store)` → `{ available, loadPrefs(), savePrefs(prefs), loadLast(), saveLast(unit, job), clearLast(), loadHistory(), saveHistory(entries) }`; `browserStorage()` → the real `localStorage` or `null` if merely touching it throws. `store` is anything with `getItem/setItem/removeItem`; `null` is allowed and behaves as "unavailable".
- Loaders return `null` (or `[]` for history) when nothing usable is stored. Loaders validate shape only as far as the document envelope and top-level types; the job itself is validated by the app through the share codec (Task 6).

- [ ] **Step 1: Write the failing tests**

Create `tests/storage.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../js/storage.js';

/** An in-memory Storage. `failing` makes every method throw, like a private-mode quota. */
function fakeStore({ failing = false, seed = {} } = {}) {
  const map = new Map(Object.entries(seed));
  const guard = () => { if (failing) throw new Error('QuotaExceededError'); };
  return {
    map,
    getItem: (key) => { guard(); return map.has(key) ? map.get(key) : null; },
    setItem: (key, value) => { guard(); map.set(key, String(value)); },
    removeItem: (key) => { guard(); map.delete(key); },
  };
}

test('round-trips prefs, last, and history with a v:1 envelope', () => {
  const store = fakeStore();
  const s = createStorage(store);
  assert.equal(s.available, true);
  assert.equal(s.loadPrefs(), null);
  s.savePrefs({ unit: 'mm', resume: true });
  assert.deepEqual(s.loadPrefs(), { unit: 'mm', resume: true });
  assert.deepEqual(JSON.parse(store.map.get('printcalc.prefs')), { v: 1, unit: 'mm', resume: true });

  const job = { sheet: { width: 12, length: 18 } };
  assert.equal(s.loadLast(), null);
  s.saveLast('in', job);
  assert.deepEqual(s.loadLast(), { unit: 'in', job });
  s.clearLast();
  assert.equal(s.loadLast(), null);
  assert.equal(store.map.has('printcalc.last'), false);

  assert.deepEqual(s.loadHistory(), []);
  s.saveHistory([{ unit: 'in', job, at: 5 }]);
  assert.deepEqual(s.loadHistory(), [{ unit: 'in', job, at: 5 }]);
});

test('a document with another version, or one that does not parse, is absent', () => {
  const s = createStorage(fakeStore({ seed: {
    'printcalc.prefs': JSON.stringify({ v: 2, unit: 'in', resume: true }),
    'printcalc.last': '{not json',
    'printcalc.history': JSON.stringify({ v: 1, entries: 'nope' }),
  } }));
  assert.equal(s.loadPrefs(), null);
  assert.equal(s.loadLast(), null);
  assert.deepEqual(s.loadHistory(), []);
});

test('prefs with the wrong shape are absent', () => {
  const s = createStorage(fakeStore({ seed: { 'printcalc.prefs': JSON.stringify({ v: 1, unit: 'cm', resume: 'yes' }) } }));
  assert.equal(s.loadPrefs(), null);
});

test('a throwing store is unavailable and every call degrades silently', () => {
  const s = createStorage(fakeStore({ failing: true }));
  assert.equal(s.available, false);
  assert.equal(s.loadPrefs(), null);
  assert.equal(s.loadLast(), null);
  assert.deepEqual(s.loadHistory(), []);
  assert.doesNotThrow(() => s.savePrefs({ unit: 'in', resume: false }));
  assert.doesNotThrow(() => s.saveLast('in', {}));
  assert.doesNotThrow(() => s.clearLast());
  assert.doesNotThrow(() => s.saveHistory([]));
});

test('a null store behaves as unavailable', () => {
  const s = createStorage(null);
  assert.equal(s.available, false);
  assert.equal(s.loadPrefs(), null);
  assert.doesNotThrow(() => s.savePrefs({ unit: 'in', resume: false }));
});

test('never leaves its probe key behind', () => {
  const store = fakeStore();
  createStorage(store);
  assert.equal(store.map.size, 0);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/storage.test.js`
Expected: FAIL — `Cannot find module '.../js/storage.js'`.

- [ ] **Step 3: Write the storage module**

Create `js/storage.js`:

```js
// storage.js — the only file that touches localStorage. Every access is wrapped so
// private browsing, a full quota, or a corrupted value degrade to "nothing stored"
// and the calculator behaves exactly as it does with no storage at all.
//
// Documents carry v: 1. Another version, or unparseable text, reads as absent —
// never migrated, never deleted (a newer build may read it later).

const VERSION = 1;
const KEYS = { prefs: 'printcalc.prefs', last: 'printcalc.last', history: 'printcalc.history' };
const UNITS = ['in', 'mm'];

/** The real localStorage, or null when merely touching it throws (some private modes). */
export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function probe(store) {
  try {
    store.setItem('printcalc.probe', '1');
    store.removeItem('printcalc.probe');
    return true;
  } catch {
    return false;
  }
}

/** @param store  anything with getItem/setItem/removeItem, or null. */
export function createStorage(store) {
  const read = (key) => {
    try {
      const raw = store.getItem(key);
      if (raw === null || raw === undefined) return null;
      const doc = JSON.parse(raw);
      return doc && typeof doc === 'object' && doc.v === VERSION ? doc : null;
    } catch {
      return null;
    }
  };
  const write = (key, doc) => {
    try {
      store.setItem(key, JSON.stringify({ v: VERSION, ...doc }));
    } catch {
      // Nowhere to write, or no room: the in-memory state is still correct.
    }
  };
  const remove = (key) => {
    try {
      store.removeItem(key);
    } catch {
      // Nothing to remove, or nowhere to remove it from.
    }
  };

  return {
    available: probe(store),
    loadPrefs() {
      const doc = read(KEYS.prefs);
      return doc && UNITS.includes(doc.unit) && typeof doc.resume === 'boolean' ? { unit: doc.unit, resume: doc.resume } : null;
    },
    savePrefs: (prefs) => write(KEYS.prefs, { unit: prefs.unit, resume: prefs.resume }),
    loadLast() {
      const doc = read(KEYS.last);
      return doc && UNITS.includes(doc.unit) && doc.job && typeof doc.job === 'object' ? { unit: doc.unit, job: doc.job } : null;
    },
    saveLast: (unit, job) => write(KEYS.last, { unit, job }),
    clearLast: () => remove(KEYS.last),
    loadHistory() {
      const doc = read(KEYS.history);
      return doc && Array.isArray(doc.entries) ? doc.entries : [];
    },
    saveHistory: (entries) => write(KEYS.history, { entries }),
  };
}
```

Note `probe(null)` throws inside its own try (`null.setItem`) and returns `false`; `read` with a null store throws inside its try and returns `null`. That is the intended path, not an accident — the tests for a null store pin it.

- [ ] **Step 4: Add the file to the service-worker shell**

In `sw.js`, insert `'./js/storage.js',` into `SHELL` after `'./js/app.js',`.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: `ℹ fail 0`; 102 tests.

- [ ] **Step 6: Commit**

```bash
git add js/storage.js tests/storage.test.js sw.js
git commit -m "Add the one storage module, safe when there is no storage

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 4: Display helpers — relative time, the advanced summary, the fold summary

**Files:**
- Modify: `js/ui/format.js` (append three exports)
- Modify: `js/ui/advancedInputs.js` (use `describeAdvanced`; delete its private `describe()` and `fmt`)
- Modify: `tests/format.test.js` (append tests)

**Interfaces:**
- Produces: `relativeTime(at, now) → string`; `describeAdvanced({ npa, count, align }, unit, defaultNpa) → string` (exactly the text the Advanced header shows today); `describeFold(fold) → string` (`''` when there is nothing to say).

- [ ] **Step 1: Write the failing tests**

Append to `tests/format.test.js` (and extend its import line to `import { formatMeasure, formatShort, unitName, stepNote, formatFraction, relativeTime, describeAdvanced, describeFold } from '../js/ui/format.js';`):

```js
test('relative time reads like a phone', () => {
  const now = new Date(2026, 8, 10, 12, 0, 0).getTime(); // Thu 10 Sep 2026, noon, local time
  const ago = (ms) => now - ms;
  assert.equal(relativeTime(ago(0), now), 'just now');
  assert.equal(relativeTime(ago(59 * 1000), now), 'just now');
  assert.equal(relativeTime(ago(40 * 60 * 1000), now), '40 min ago');
  assert.equal(relativeTime(ago(3 * 3600 * 1000), now), '3 h ago');
  assert.equal(relativeTime(new Date(2026, 8, 8, 12).getTime(), now), 'Tue');
  assert.equal(relativeTime(new Date(2026, 8, 2, 12).getTime(), now), 'Sep 2');
  assert.equal(relativeTime(now + 5000, now), 'just now'); // a clock that went backwards is still "now"
});

test('describes the advanced values the way the Advanced header does', () => {
  const base = { npa: { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 }, count: {}, align: {} };
  assert.equal(describeAdvanced(base, 'in', 0.0625), 'NPA 1/16 all round · Auto · Centered');
  assert.equal(describeAdvanced({ ...base, count: { across: 2 } }, 'in', 0.0625), 'NPA 1/16 all round · 2 across · Centered');
  assert.equal(describeAdvanced({ ...base, count: { across: 2, down: 9 } }, 'in', 0.0625), 'NPA 1/16 all round · 2 across × 9 down · Centered');
  assert.equal(describeAdvanced({ ...base, npa: { ...base.npa, top: 0 }, align: { top: 0 } }, 'in', 0.0625), 'NPA top 0 · Auto · Top +0');
  assert.equal(describeAdvanced({ ...base, align: { top: 0.5, left: 0 } }, 'in', 0.0625), 'NPA 1/16 all round · Auto · Top +1/2 · Left +0');
  const mm = { npa: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 }, count: {}, align: {} };
  assert.equal(describeAdvanced(mm, 'mm', 1.5), 'NPA 1.5 all round · Auto · Centered');
});

test('describes a fold, or says nothing', () => {
  assert.equal(describeFold({ style: 'none', axis: 'L', allowance: 0.0625, custom: [] }), '');
  assert.equal(describeFold({ style: 'bifold', axis: 'L', allowance: 0.0625, custom: [] }), 'Bifold across length');
  assert.equal(describeFold({ style: 'trifold', axis: 'W', allowance: 0.0625, custom: [] }), 'Trifold across width');
  assert.equal(describeFold({ style: 'zfold', axis: 'W', allowance: 0.0625, custom: [1] }), 'Z-fold across width · 1 custom score');
  assert.equal(describeFold({ style: 'none', axis: 'L', allowance: 0.0625, custom: [1, 2.5] }), '2 custom scores');
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/format.test.js`
Expected: FAIL — `relativeTime`, `describeAdvanced`, `describeFold` are not exported.

- [ ] **Step 3: Add the helpers**

Append to `js/ui/format.js`:

```js
const EDGES = ['top', 'bottom', 'left', 'right'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** "just now", "40 min ago", "3 h ago", then a weekday within a week, then "Sep 2". */
export function relativeTime(at, now) {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const date = new Date(at);
  if (seconds < 7 * 24 * 3600) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * One line for the advanced values, as the Advanced header shows it:
 * "NPA 1/16 all round · Auto · Centered". Values are in `unit` as entered;
 * `defaultNpa` is that unit's default so only departing edges are named.
 */
export function describeAdvanced({ npa, count, align }, unit, defaultNpa) {
  const fmt = (n) => (unit === 'in' ? formatFraction(n) : String(n));
  const npaValues = EDGES.map((e) => npa[e]);
  const npaText = npaValues.every((v) => v === npaValues[0])
    ? `NPA ${fmt(npaValues[0])} all round`
    : `NPA ${EDGES.filter((e) => npa[e] !== defaultNpa).map((e) => `${e} ${fmt(npa[e])}`).join(', ')}`;
  const countParts = [];
  if (count.across !== undefined) countParts.push(`${count.across} across`);
  if (count.down !== undefined) countParts.push(`${count.down} down`);
  const alignParts = EDGES.filter((e) => e in align).map((e) => `${cap(e)} +${fmt(align[e])}`);
  return `${npaText} · ${countParts.length ? countParts.join(' × ') : 'Auto'} · ${alignParts.length ? alignParts.join(' · ') : 'Centered'}`;
}

const FOLD_NAMES = { bifold: 'Bifold', trifold: 'Trifold', zfold: 'Z-fold' };

/** "Bifold across length", plus "· 2 custom scores" when there are any; '' when there is nothing to say. */
export function describeFold(fold) {
  const parts = [];
  if (fold.style !== 'none') parts.push(`${FOLD_NAMES[fold.style]} across ${fold.axis === 'L' ? 'length' : 'width'}`);
  if (fold.custom.length) parts.push(`${fold.custom.length} custom score${fold.custom.length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
```

- [ ] **Step 4: Make the Advanced section use the shared helper**

In `js/ui/advancedInputs.js`:

1. Change the import `import { formatFraction } from './format.js';` to `import { describeAdvanced } from './format.js';`.
2. Delete these lines (the private `fmt` and `describe`):

```js
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
```

3. In `reflect()`, change `summary.textContent = describe();` to `summary.textContent = describeAdvanced(value, unit, defaultNpa);`.

`cap` and `EDGES` stay in `advancedInputs.js` — they are still used for labels and hints there.

- [ ] **Step 5: Run the tests and check the header is unchanged**

Run: `npm test`
Expected: `ℹ fail 0`; 105 tests.

Start the dev server if needed (`npm start`), then:

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t4.png \
  --print "document.querySelector('#advancedInputs .disclosure').textContent.trim()"
```
Expected: `▸ Advanced NPA 1/16 all round · Auto · Centered` — exactly as before this task.

- [ ] **Step 6: Commit**

```bash
git add js/ui/format.js js/ui/advancedInputs.js tests/format.test.js
git commit -m "Share the advanced summary text; add relative time and fold summaries

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Tabs, the Copy-link control, and the page skeleton

**Files:**
- Create: `js/ui/tabs.js`
- Create: `js/ui/copyLink.js`
- Modify: `index.html`
- Modify: `css/app.css` (append)
- Modify: `js/app.js` (tab wiring and the Copy link button — small, anchored edits; Task 6 rewrites this file in full and keeps them)
- Modify: `sw.js` (add both new files to `SHELL`)

**Interfaces:**
- Produces: `createTabs(container, tabs, { onSelect })` → `{ select(id), setBadge(id, count) }` where `tabs` is `[{ id, label }]`; buttons carry `role="tab"`, `id="tab-<id>"`, `aria-controls="panel-<id>"`, `data-tab`. `createCopyLink(getUrl)` → a `<span class="copy-link-wrap">` holding the button and its fallback field.
- Panels in `index.html`: `#panel-calculator`, `#panel-history`, `#panel-preferences` (`role="tabpanel"`); view containers `#history`, `#preferences`; `#shareBar` inside the Layout group.

- [ ] **Step 1: The tab strip component**

Create `js/ui/tabs.js`:

```js
// tabs.js — a Win98 tab strip. Renders the buttons and their selected state; the
// app shows and hides the matching panels (hidden attribute) so this stays dumb.
import { el } from './dom.js';

/**
 * @param tabs  [{ id, label }] — panel ids are `panel-<id>`, button ids `tab-<id>`
 * @returns { select(id), setBadge(id, count) }
 */
export function createTabs(container, tabs, { onSelect }) {
  const items = new Map();
  const list = el('div', { class: 'tabs', role: 'tablist' });
  for (const { id, label } of tabs) {
    const badge = el('span', { class: 'badge', hidden: true });
    const button = el('button', {
      type: 'button', role: 'tab', id: `tab-${id}`, 'aria-selected': 'false', 'aria-controls': `panel-${id}`, dataset: { tab: id },
    }, label, badge);
    button.addEventListener('click', () => onSelect(id));
    items.set(id, { button, badge });
    list.append(button);
  }
  container.replaceChildren(list);
  return {
    select(id) {
      for (const [key, { button }] of items) button.setAttribute('aria-selected', String(key === id));
    },
    setBadge(id, count) {
      const { badge } = items.get(id);
      badge.textContent = String(count);
      badge.hidden = count === 0;
    },
  };
}
```

- [ ] **Step 2: The Copy-link control**

Create `js/ui/copyLink.js`:

```js
// copyLink.js — a "Copy link" button. Copies via the clipboard API and says "Copied";
// where that API is missing (http on a bench PC, some webviews) it reveals the link
// in a read-only field, selected, so a long-press copy still works.
import { el } from './dom.js';

/** @param getUrl  () => string — read at click time so the link is always current. */
export function createCopyLink(getUrl) {
  const button = el('button', { type: 'button', class: 'copy-link' }, 'Copy link');
  const fallback = el('input', { type: 'text', readonly: true, hidden: true, 'aria-label': 'Link to this job' });
  let reset = null;
  button.addEventListener('click', async () => {
    const url = getUrl();
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (copied) {
      button.textContent = 'Copied';
      clearTimeout(reset);
      reset = setTimeout(() => { button.textContent = 'Copy link'; }, 1500);
    } else {
      fallback.value = url;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
    }
  });
  return el('span', { class: 'copy-link-wrap' }, button, fallback);
}
```

- [ ] **Step 3: The page skeleton**

In `index.html`, replace everything from `<div class="toolbar">` through `</main>` (the toolbar and the whole `<main>`) with the block below. The only changes inside `<main>` are the new `#shareBar` line in the Layout group; everything else is wrapped, not altered.

```html
    <div id="tabs"></div>

    <section id="panel-calculator" role="tabpanel" aria-labelledby="tab-calculator">
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
          <div id="advancedInputs"></div>
          <div id="foldInputs"></div>
        </div>

        <div class="column">
          <fieldset class="group">
            <legend>Layout</legend>
            <div id="summary" class="summary"></div>
            <div id="shareBar" class="actions share"></div>
          </fieldset>

          <fieldset class="group sheetView">
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
    </section>

    <section id="panel-history" class="view" role="tabpanel" aria-labelledby="tab-history" hidden>
      <fieldset class="group">
        <legend>Recent jobs</legend>
        <div id="history"></div>
      </fieldset>
    </section>

    <section id="panel-preferences" class="view" role="tabpanel" aria-labelledby="tab-preferences" hidden>
      <fieldset class="group">
        <legend>Preferences</legend>
        <div id="preferences"></div>
      </fieldset>
    </section>
```

- [ ] **Step 4: Styles**

Append to `css/app.css`:

```css
/* Tabs: the Win98 tabbed dialog. The selected tab stands taller and joins its panel. */
.tabs { display: flex; align-items: flex-end; gap: 2px; padding: 6px 4px 0; }
.tabs button[role="tab"] {
  flex: 1 0 auto;
  min-height: 36px;
  margin-bottom: 2px;
  padding: 4px 10px 6px;
  background: var(--light);
  border-bottom: 0;
  box-shadow: inset -1px 0 var(--shadow), inset 1px 1px var(--highlight);
}
.tabs button[role="tab"]:active { padding: 4px 10px 6px; }
.tabs button[aria-selected="true"] {
  min-height: 40px;
  margin-bottom: 0;
  padding-bottom: 8px;
  background: var(--face);
  position: relative;
  z-index: 1;
}
section[role="tabpanel"] { border-top: 2px solid var(--highlight); }
.tabs .badge {
  display: inline-block;
  min-width: 1.4em;
  margin-left: 6px;
  padding: 0 4px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--highlight);
  background: var(--navy);
}
.view { padding: 8px 2px 2px; }

/* Share */
.share { margin-top: 2px; }
.copy-link-wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.copy-link-wrap input { flex: 1 1 12em; min-width: 0; }

/* History rows: the body is one flat tap target; actions sit to the right */
.history { display: grid; gap: 6px; }
.history-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  padding: 6px;
  background: var(--highlight);
  border: 1px solid var(--shadow);
}
.history-open, .history-open:active {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 4px 6px;
  text-align: left;
  background: var(--highlight);
  border: 0;
  box-shadow: none;
}
.history-open .nup { font-size: 22px; font-weight: bold; line-height: 1.1; }
.history-open .line { font-size: 13px; }
.history-open .extra { font-size: 12px; color: var(--navy); }
.history-open .when { font-size: 12px; color: var(--shadow); }
.history-open .unit-badge {
  margin-left: 6px;
  padding: 0 4px;
  font-size: 11px;
  font-weight: normal;
  vertical-align: middle;
  border: 1px solid var(--shadow);
}
.history-actions { display: grid; gap: 4px; align-content: start; }
.empty { margin: 4px 0; font-size: 13px; }

/* Preferences */
.pref { display: grid; gap: 4px; margin-bottom: 12px; }
.pref-label { font-size: 13px; font-weight: bold; }
.pref .note { margin: 0; font-size: 12px; color: var(--shadow); }

@media (min-width: 900px) {
  .view { max-width: 640px; }
}
```

- [ ] **Step 5: Wire the strip and the button (Task 6 keeps this)**

In `js/app.js`:

1. After the line `import { formatShort } from './ui/format.js';` add:

```js
import { createTabs } from './ui/tabs.js';
import { createCopyLink } from './ui/copyLink.js';
import { encodeJob } from './core/share.js';
```

2. After the line `const NO_SCORES = { offsets: [], positions: [], segments: [] };` add:

```js
const TABS = [{ id: 'calculator', label: 'Calculator' }, { id: 'history', label: 'History' }, { id: 'preferences', label: 'Preferences' }];
const tabs = createTabs($('tabs'), TABS, { onSelect: showTab });
$('shareBar').append(createCopyLink(() => `${window.location.origin}${window.location.pathname}#${encodeJob(state.unit, state.job, DEFAULTS[state.unit])}`));

function showTab(id) {
  for (const tab of TABS) $(`panel-${tab.id}`).hidden = tab.id !== id;
  tabs.select(id);
}
```

3. Immediately before the line `setUnit('in');` add `showTab('calculator');`.

- [ ] **Step 6: Add the files to the service-worker shell**

In `sw.js`, insert `'./js/ui/copyLink.js',` after `'./js/ui/advancedInputs.js',` and `'./js/ui/tabs.js',` after `'./js/ui/summaryView.js',` (alphabetical among the `js/ui/` entries).

- [ ] **Step 7: Run the tests and check the page**

Run: `npm test`
Expected: `ℹ fail 0`; 105 tests (`sw.test.js` passes because both files are listed).

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t5a.png \
  --print "[...document.querySelectorAll('.tabs button')].map(b => b.textContent.trim() + ':' + b.getAttribute('aria-selected')).join(' | ')" \
  --print "['calculator','history','preferences'].map(id => id + '=' + document.getElementById('panel-' + id).hidden).join(' ')" \
  --print "document.querySelector('#shareBar button').textContent" \
  --print "document.querySelector('#summary .nup').textContent"
```
Expected: `Calculator:true | History:false | Preferences:false`; `calculator=false history=true preferences=true`; `Copy link`; `24-up` (the calculator is unchanged inside its panel).

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t5b.png \
  --eval "document.getElementById('tab-history').click()" \
  --print "['calculator','history','preferences'].map(id => id + '=' + document.getElementById('panel-' + id).hidden).join(' ')" \
  --print "document.getElementById('tab-history').getAttribute('aria-selected')" \
  --print "document.documentElement.scrollWidth + ' vs ' + document.documentElement.clientWidth"
```
Expected: `calculator=true history=false preferences=true`; `true`; `390 vs 390`. Read `t5a.png` and `t5b.png`: three tabs under the title bar with Calculator raised, then History raised with an empty "Recent jobs" group box.

- [ ] **Step 8: Commit**

```bash
git add js/ui/tabs.js js/ui/copyLink.js index.html css/app.css js/app.js sw.js
git commit -m "Add the tab strip, the three panels, and a Copy link control

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: One way in — loadJob, the load order, resume, the live hash, and settling

**Files:**
- Modify: `js/app.js` (replace the whole file with the version below)

**Interfaces:**
- Consumes: `encodeJob`/`decodeJob` (Task 1), `recordJob` (Task 2), `createStorage`/`browserStorage` (Task 3), `createTabs`/`createCopyLink` (Task 5).
- Produces (for Tasks 7 and 8, which add small blocks to this file): `state.prefs`, `state.history`, `state.tab`; `storage`; `loadJob(unit, job)`; `showTab(id)`; `urlFor(unit, job)`; `compute(job, unit)`; `renderHistoryPanel()` (a stub here; Task 8 replaces it); `tabs`.

- [ ] **Step 1: Replace `js/app.js` in full**

```js
// app.js — state and the render loop. Modules are wired together here and nowhere else.
import { computeLayout, suggestOrientation } from './core/layout.js';
import { computeSequence } from './core/sequence.js';
import { computeScores } from './core/scores.js';
import { mmToInches, inchesToMm } from './core/measure.js';
import { encodeJob, decodeJob } from './core/share.js';
import { recordJob } from './core/history.js';
import { createStorage, browserStorage } from './storage.js';
import { PRESETS, DEFAULTS } from './ui/presets.js';
import { createSizeInputs } from './ui/sizeInputs.js';
import { createFoldInputs } from './ui/foldInputs.js';
import { createAdvancedInputs } from './ui/advancedInputs.js';
import { renderSummary } from './ui/summaryView.js';
import { renderSequence } from './ui/sequenceView.js';
import { renderScores } from './ui/scoresView.js';
import { createSheetView } from './ui/sheetView.js';
import { createTabs } from './ui/tabs.js';
import { createCopyLink } from './ui/copyLink.js';
import { formatShort } from './ui/format.js';

const $ = (id) => document.getElementById(id);
const TABS = [{ id: 'calculator', label: 'Calculator' }, { id: 'history', label: 'History' }, { id: 'preferences', label: 'Preferences' }];
const DEFAULT_PREFS = { unit: 'in', resume: false };
// A job goes into history once it has sat unchanged this long (and fits).
const SETTLE_MS = 15000;

const storage = createStorage(browserStorage());

/** A stored job is trusted only if it survives the codec — the same validation a shared link gets. */
function sanitize(unit, job) {
  try {
    return decodeJob(encodeJob(unit, job, DEFAULTS[unit]), DEFAULTS);
  } catch {
    return null;
  }
}

// The job is everything the worker entered, in the current unit exactly as typed;
// compute() converts to inches at the boundary. prefs and history are the in-memory
// mirror of storage: views render from state, storage is written after a change.
const state = {
  unit: 'in',
  job: structuredClone(DEFAULTS.in),
  hintDismissed: false,
  tab: 'calculator',
  prefs: storage.loadPrefs() ?? { ...DEFAULT_PREFS },
  history: storage.loadHistory().filter((entry) => Number.isFinite(entry?.at) && sanitize(entry.unit, entry.job) !== null),
};
let settleTimer = null;

const sections = {
  sheet: createSizeInputs($('sheetInputs'), { label: 'Sheet', onChange: (sheet) => update({ sheet }) }),
  doc: createSizeInputs($('docInputs'), { label: 'Document', onChange: (doc) => update({ doc }) }),
  gutter: createSizeInputs($('gutterInputs'), {
    label: 'Gutter', allowZero: true, keys: ['columns', 'rows'], labels: ['Between columns', 'Between rows'],
    alwaysShowFields: true, onChange: (gutter) => update({ gutter }),
  }),
};
const foldInputs = createFoldInputs($('foldInputs'), { onChange: (fold) => update({ fold }) });
const advancedInputs = createAdvancedInputs($('advancedInputs'), { onChange: (patch) => update(patch) });
const sheetView = createSheetView($('canvas'));
const NO_SCORES = { offsets: [], positions: [], segments: [] };
const tabs = createTabs($('tabs'), TABS, { onSelect: showTab });
$('shareBar').append(createCopyLink(() => urlFor(state.unit, state.job)));

const toInchesIn = (unit) => (value) => (unit === 'mm' ? mmToInches(value) : value);

/** Everything the views need for a job, converted to inches at this one boundary. */
function compute(job, unit) {
  const toInches = toInchesIn(unit);
  const sizeToInches = (size) => ({ width: toInches(size.width), length: toInches(size.length) });
  const edgesToInches = (edges) => Object.fromEntries(Object.entries(edges).map(([edge, v]) => [edge, toInches(v)]));
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

/** The shareable link for a job: this page, with the job in the hash. */
function urlFor(unit, job) {
  return `${window.location.origin}${window.location.pathname}#${encodeJob(unit, job, DEFAULTS[unit])}`;
}

function render() {
  const result = compute(state.job, state.unit);
  foldInputs.setDocSize(state.job.doc);
  advancedInputs.setAuto(result.layout.auto);
  renderSummary($('summary'), result, {
    unit: state.unit,
    job: state.job,
    hintDismissed: state.hintDismissed,
    onApply: applyRotation,
    onDismiss: dismissHint,
    onFix: applyFix,
  });
  renderSequence($('sequence'), result, state.unit);
  renderScores($('scores'), result, state.job.fold, state.unit);
  sheetView.draw(result.layout, result.scores, (inches) => formatShort(inches, state.unit));
  $('legend').hidden = result.scores.segments.length === 0;
  // The address bar mirrors the job: a bookmark is a saved job and Share shares the
  // setup. replaceState, never pushState — the Back button is left alone.
  window.history.replaceState(null, '', `#${encodeJob(state.unit, state.job, DEFAULTS[state.unit])}`);
}

/** Apply a validated change to the job. Any change re-arms the orientation hint. */
function update(patch) {
  Object.assign(state.job, patch);
  state.hintDismissed = false;
  render();
  afterChange();
}

/** After any change: keep the resume job current, and restart the settle timer. */
function afterChange() {
  if (state.prefs.resume) storage.saveLast(state.unit, state.job);
  clearTimeout(settleTimer);
  settleTimer = setTimeout(recordSettled, SETTLE_MS);
}

/** The job has sat unchanged for SETTLE_MS: record it if it fits. */
function recordSettled() {
  if (!compute(state.job, state.unit).layout.fits) return;
  state.history = recordJob(state.history, state.unit, state.job, Date.now());
  storage.saveHistory(state.history);
  tabs.setBadge('history', state.history.length);
  if (state.tab === 'history') renderHistoryPanel();
}

/** Turn the sheet or document 90°. The section swaps its own value and reports it through onChange. */
function applyRotation(which) {
  // job.fold.axis is deliberately left alone: it names a sheet-relative direction
  // ('L' along the sheet length, 'W' along the width), not a direction relative to
  // this document, so rotating the document does not change what the axis means.
  sections[which].rotate();
}

function dismissHint() {
  state.hintDismissed = true;
  render();
}

/** Apply a fix the summary offered. Values arrive in inches; the job holds the current unit. */
function applyFix(action) {
  const fromInches = (v) => (state.unit === 'mm' ? inchesToMm(v) : v);
  // Round at the boundary where a converted fix value is about to be merged into
  // the job: computeLayout's margin subtraction can leave floating-point noise
  // (e.g. 0.6500000000000018), and without rounding here that noise lands straight
  // in the editable NPA/offset fields. One extra digit of headroom over display
  // precision (formatMeasure: 3 decimals in, 1 decimal mm).
  const round = (v) => Number(v.toFixed(state.unit === 'mm' ? 2 : 4));
  const job = state.job;
  if (action.fix === 'offset') {
    update({ align: { ...job.align, [action.edge]: round(fromInches(action.inches)) } });
  } else if (action.fix === 'npa') {
    const values = Object.fromEntries(Object.entries(action.values).map(([edge, v]) => [edge, round(fromInches(v))]));
    update({ npa: { ...job.npa, ...values } });
  } else if (action.fix === 'count') {
    const count = { ...job.count };
    delete count[action.axis];
    update({ count });
  }
  // An external change to the advanced values: echo it into the section.
  advancedInputs.setValue({ npa: state.job.npa, count: state.job.count, align: state.job.align }, state.unit, DEFAULTS[state.unit].npa.top);
}

/**
 * The one path by which a job reaches the inputs — a shared link, a history entry,
 * the resumed job, or the unit toggle. Sets the unit, replaces the job, re-arms the
 * hint, and pushes the values into every section.
 */
function loadJob(unit, job) {
  state.unit = unit;
  state.job = structuredClone(job);
  state.hintDismissed = false;
  for (const kind of ['sheet', 'doc', 'gutter']) sections[kind].setPresets(PRESETS[unit][kind], state.job[kind]);
  foldInputs.setValue(state.job.fold, unit);
  advancedInputs.setValue({ npa: state.job.npa, count: state.job.count, align: state.job.align }, unit, DEFAULTS[unit].npa.top);
  for (const button of $('unitChips').children) {
    button.setAttribute('aria-pressed', String(button.dataset.unit === unit));
  }
  render();
  afterChange();
}

/** A new unit is a new job: reset to that unit's defaults (jobs are entered fresh). */
function setUnit(unit) {
  loadJob(unit, DEFAULTS[unit]);
}

function showTab(id) {
  state.tab = id;
  for (const tab of TABS) $(`panel-${tab.id}`).hidden = tab.id !== id;
  tabs.select(id);
  if (id === 'history') renderHistoryPanel();
}

/** The History view arrives with its own task; until then the panel stays empty. */
function renderHistoryPanel() {}

for (const button of $('unitChips').children) {
  button.addEventListener('click', () => setUnit(button.dataset.unit));
}

// Open on: the job in the link, else the resumed job, else a fresh job in the preferred unit.
const shared = decodeJob(window.location.hash, DEFAULTS);
const last = state.prefs.resume ? storage.loadLast() : null;
const resumed = last ? sanitize(last.unit, last.job) : null;
if (shared) loadJob(shared.unit, shared.job);
else if (resumed) loadJob(resumed.unit, resumed.job);
else loadJob(state.prefs.unit, DEFAULTS[state.prefs.unit]);
showTab('calculator');
tabs.setBadge('history', state.history.length);

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

- [ ] **Step 2: Run the tests**

Run: `npm test`
Expected: `ℹ fail 0`; 105 tests (no core change; nothing new is unit-tested here — the checks below are the test).

- [ ] **Step 3: The live hash and opening a link**

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t6a.png \
  --print "location.hash" \
  --eval "document.querySelector('#sheetInputs .chips button:nth-child(2)').click()" \
  --print "location.hash" \
  --print "document.querySelector('#summary .nup').textContent"
```
Expected: `#v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125` then `#v=1&u=in&s=13x19&d=3.5x2&g=0.125x0.125` and `24-up`. (Both prints run after the eval, so both show the 13×19 hash — the point is that it changed and is the short form.)

```bash
python .claude/skills/screenshot/shoot.py "http://localhost:8080/#v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125&n=0,0.0625,0.0625,0.0625&a=top=0" 390 844 t6b.png \
  --print "document.querySelector('#summary .nup').textContent" \
  --print "document.querySelectorAll('li.step').length" \
  --print "document.querySelector('#advancedInputs .disclosure').textContent.trim()" \
  --print "document.querySelector('#sheetInputs .chips button[aria-pressed=true]').textContent"
```
Expected: `24-up`, `21` (the FLUSH_TOP sequence, loaded from a link), `▸ Advanced NPA top 0 · Auto · Top +0`, `12 × 18`.

```bash
python .claude/skills/screenshot/shoot.py "http://localhost:8080/#v=1&u=mm&s=320x450&d=90x55&g=3x3" 390 844 t6c.png \
  --print "document.querySelector('#unitChips button[aria-pressed=true]').textContent" \
  --print "document.querySelector('#advancedInputs input[aria-label=\"Non-printable top\"]').value"
```
Expected: `mm`, `1.5` — a link switches the app to its unit.

```bash
python .claude/skills/screenshot/shoot.py "http://localhost:8080/#v=1&u=in&s=12x&junk" 390 844 t6d.png \
  --print "document.querySelector('#summary .nup').textContent" \
  --print "location.hash"
```
Expected: `24-up` and the canonical default hash — a bad link just opens the app.

- [ ] **Step 4: Resume on open**

One profile, one invocation: seed prefs and a last job, reload, wait, read.

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t6e.png \
  --eval "localStorage.setItem('printcalc.prefs', JSON.stringify({ v: 1, unit: 'in', resume: true })); localStorage.setItem('printcalc.last', JSON.stringify({ v: 1, unit: 'in', job: { sheet: { width: 13, length: 19 }, doc: { width: 4.25, length: 5.5 }, gutter: { columns: 0.125, rows: 0.125 }, npa: { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 }, count: {}, align: {}, fold: { style: 'none', axis: 'L', allowance: 0.0625, custom: [] } } }))" \
  --eval "location.replace(location.pathname)" \
  --eval "new Promise((r) => setTimeout(r, 2000))" \
  --print "document.querySelector('#summary .nup').textContent" \
  --print "document.querySelector('#docInputs .chips button[aria-pressed=true]').textContent" \
  --eval "document.querySelector('#docInputs .chips button:first-child').click()" \
  --print "JSON.parse(localStorage.getItem('printcalc.last')).job.doc.width"
```
Expected: `6-up` and `4.25 × 5.5` (the resumed job, not the default), then `3.5` — `last` follows every change while resume is on. `location.replace(location.pathname)` drops the hash so the load order falls through to `last`.

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t6f.png \
  --eval "localStorage.setItem('printcalc.last', JSON.stringify({ v: 1, unit: 'in', job: { sheet: 'garbage' } })); localStorage.setItem('printcalc.prefs', JSON.stringify({ v: 1, unit: 'in', resume: true }))" \
  --eval "location.replace(location.pathname)" \
  --eval "new Promise((r) => setTimeout(r, 2000))" \
  --print "document.querySelector('#summary .nup').textContent"
```
Expected: `24-up` — a malformed stored job is ignored, not crashed on.

- [ ] **Step 5: Settling**

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t6g.png \
  --eval "new Promise((r) => setTimeout(r, 10000))" \
  --print "localStorage.getItem('printcalc.history')" \
  --print "document.querySelector('#tab-history .badge').hidden"
```
Expected: `null` and `true` — nothing recorded at 10 s.

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t6h.png \
  --eval "new Promise((r) => setTimeout(r, 16000))" \
  --print "JSON.parse(localStorage.getItem('printcalc.history')).entries.length" \
  --print "document.querySelector('#tab-history .badge').textContent" \
  --print "document.querySelector('#tab-history .badge').hidden"
```
Expected: `1`, `1`, `false` — recorded at 15 s, badge showing. (The load itself starts the timer, so the default job counts as a settled job.)

- [ ] **Step 6: No storage at all**

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t6i.png \
  --eval "Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); location.reload()" \
  --eval "new Promise((r) => setTimeout(r, 2000))" \
  --print "document.querySelector('#summary .nup').textContent" \
  --print "document.querySelectorAll('li.step').length"
```
Expected: `24-up`, `22` — the calculator is untouched by a throwing `localStorage`. (If the override does not survive the reload in your Chrome, note it in the report; the storage tests in Task 3 cover the same path.)

- [ ] **Step 7: Commit**

```bash
git add js/app.js
git commit -m "Load jobs one way: from a link, the resumed job, or the defaults

The address bar mirrors the job; last is kept on every change while
resume is on; a job that sits for fifteen seconds and fits is recorded.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 7: The Preferences view

**Files:**
- Create: `js/ui/preferencesView.js`
- Modify: `js/app.js` (import, create the view, `setPrefs`, initial `setValue`)
- Modify: `sw.js` (add `./js/ui/preferencesView.js` to `SHELL`)
- Modify: `docs/superpowers/specs/2026-09-10-history-preferences-share-design.md` (one sentence — see Step 3)

**Interfaces:**
- Consumes: `state.prefs`, `storage`, `$('preferences')` (Tasks 5–6).
- Produces: `createPreferencesView(container, { onChange })` → `{ setValue(prefs) }`; `onChange` receives a patch, `{ unit }` or `{ resume }`. Buttons carry `data-pref` (`unit` | `resume`) and `data-value` (`in` | `mm` | `true` | `false`).

- [ ] **Step 1: The view**

Create `js/ui/preferencesView.js`:

```js
// preferencesView.js — two settings, each a chip row, saved the moment they change.
// The rows never read storage; the app hands them the current prefs with setValue.
import { el } from './dom.js';

const ROWS = [
  {
    key: 'unit',
    label: 'Default unit',
    options: [['in', 'in'], ['mm', 'mm']],
    note: 'The unit a fresh job opens in. The Units toggle on the Calculator tab changes only the current job.',
  },
  {
    key: 'resume',
    label: 'Resume last job on open',
    options: [[true, 'On'], [false, 'Off']],
    note: 'Off always opens with a fresh default job.',
  },
];

/** @param options  { onChange(patch) }  patch is { unit } or { resume } */
export function createPreferencesView(container, { onChange }) {
  const rows = new Map();
  const blocks = ROWS.map(({ key, label, options, note }) => {
    const row = el('div', { class: 'chips' });
    for (const [value, text] of options) {
      const button = el('button', { type: 'button', 'aria-pressed': 'false', dataset: { pref: key, value: String(value) } }, text);
      button.addEventListener('click', () => onChange({ [key]: value }));
      row.append(button);
    }
    rows.set(key, row);
    return el('div', { class: 'pref' }, el('span', { class: 'pref-label' }, label), row, el('p', { class: 'note' }, note));
  });
  container.replaceChildren(...blocks);
  return {
    setValue(prefs) {
      for (const [key, row] of rows) {
        for (const button of row.children) button.setAttribute('aria-pressed', String(button.dataset.value === String(prefs[key])));
      }
    },
  };
}
```

- [ ] **Step 2: Wire it**

In `js/app.js`:

1. After `import { createCopyLink } from './ui/copyLink.js';` add `import { createPreferencesView } from './ui/preferencesView.js';`.
2. After the line `$('shareBar').append(createCopyLink(() => urlFor(state.unit, state.job)));` add:

```js
const preferencesView = createPreferencesView($('preferences'), { onChange: setPrefs });
```

3. After the `showTab` function add:

```js
/**
 * Update a preference. Saved at once. Turning resume on saves the current job so
 * closing the app right away still resumes here; turning it off forgets it at once.
 */
function setPrefs(patch) {
  state.prefs = { ...state.prefs, ...patch };
  storage.savePrefs(state.prefs);
  if (state.prefs.resume) storage.saveLast(state.unit, state.job);
  else storage.clearLast();
  preferencesView.setValue(state.prefs);
}
```

4. After the line `tabs.setBadge('history', state.history.length);` at the bottom add `preferencesView.setValue(state.prefs);`.

- [ ] **Step 3: Keep the spec honest**

In `docs/superpowers/specs/2026-09-10-history-preferences-share-design.md`, in the Preferences view section, replace

`Turning it off deletes `last` immediately; turning it on saves from the next change (nothing retroactive).`

with

`Turning it off deletes `last` immediately; turning it on saves the current job immediately, so closing the app right away still resumes here.`

(A toggle is a change; making the worker edit something before resume takes hold would be a surprise.)

- [ ] **Step 4: Add the file to the service-worker shell**

In `sw.js`, insert `'./js/ui/preferencesView.js',` after `'./js/ui/presets.js',`.

- [ ] **Step 5: Run the tests and check the view**

Run: `npm test`
Expected: `ℹ fail 0`; 105 tests.

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t7a.png \
  --eval "document.getElementById('tab-preferences').click()" \
  --print "[...document.querySelectorAll('#preferences .pref-label')].map(e => e.textContent).join(' | ')" \
  --print "[...document.querySelectorAll('#preferences button')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')).join(' ')" \
  --eval "document.querySelector('#preferences button[data-pref=unit][data-value=mm]').click(); document.querySelector('#preferences button[data-pref=resume][data-value=true]').click()" \
  --print "localStorage.getItem('printcalc.prefs')" \
  --print "JSON.parse(localStorage.getItem('printcalc.last')).unit" \
  --eval "document.querySelector('#preferences button[data-pref=resume][data-value=false]').click()" \
  --print "localStorage.getItem('printcalc.last')"
```
Expected, in order: `Default unit | Resume last job on open`; `in:true mm:false On:false Off:true`; `{"v":1,"unit":"mm","resume":true}`; `in` (the current job was saved the moment resume went on, in its own unit); `null` (off forgets it). Read `t7a.png`: two labelled chip rows with notes, single column.

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t7b.png \
  --eval "localStorage.setItem('printcalc.prefs', JSON.stringify({ v: 1, unit: 'mm', resume: false }))" \
  --eval "location.replace(location.pathname)" \
  --eval "new Promise((r) => setTimeout(r, 2000))" \
  --print "document.querySelector('#unitChips button[aria-pressed=true]').textContent" \
  --print "document.querySelector('#summary .nup').textContent" \
  --print "document.querySelector('#preferences button[data-pref=unit][aria-pressed=true]').textContent"
```
Expected: `mm`, `21-up`, `mm` — a fresh open honours the default unit, and the view reflects the stored prefs.

- [ ] **Step 6: Commit**

```bash
git add js/ui/preferencesView.js js/app.js sw.js docs/superpowers/specs/2026-09-10-history-preferences-share-design.md
git commit -m "Add the Preferences tab: default unit and resume-on-open

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The History view

**Files:**
- Create: `js/ui/historyView.js`
- Modify: `js/app.js` (imports, `summarize`, the view, `setHistory`, replace `renderHistoryPanel` and the body of `recordSettled`)
- Modify: `sw.js` (add `./js/ui/historyView.js` to `SHELL`)

**Interfaces:**
- Consumes: `compute(job, unit)`, `loadJob`, `showTab`, `urlFor`, `tabs`, `storage`, `state.history` (Task 6); `createCopyLink` (Task 5); `describeAdvanced`, `describeFold`, `relativeTime`, `formatFraction` (Task 4).
- Produces: `createHistoryView(container, { summarize, copyLink, onLoad, onDelete, onClear })` → `{ render(entries, { unit, available, now }) }`. `summarize(entry)` → `{ nup, line, extra }`; `copyLink(entry)` → element; `onLoad(entry)`; `onDelete(index)`; `onClear()`. Rows are `.history-row` with a `.history-open` button (the tap target), `.delete`, and the copy-link control; the clear button is `.clear`.

- [ ] **Step 1: The view**

Create `js/ui/historyView.js`:

```js
// historyView.js — the recent-jobs list. Each row is one flat tap target (load) with
// Copy link and delete beside it. Numbers are computed by the app from the stored
// inputs at render time (summarize), never stored, so they can never go stale.
import { el } from './dom.js';
import { relativeTime } from './format.js';

const CLEAR_ARM_MS = 4000;

/**
 * @param options  { summarize(entry) → { nup, line, extra }, copyLink(entry) → element,
 *                   onLoad(entry), onDelete(index), onClear() }
 * @returns { render(entries, { unit, available, now }) }
 */
export function createHistoryView(container, { summarize, copyLink, onLoad, onDelete, onClear }) {
  let armed = null;

  function row(entry, index, unit, now) {
    const { nup, line, extra } = summarize(entry);
    const open = el('button', { type: 'button', class: 'history-open' },
      el('span', { class: 'nup' }, nup, entry.unit === unit ? '' : el('span', { class: 'unit-badge' }, entry.unit)),
      el('span', { class: 'line' }, line),
      extra ? el('span', { class: 'extra' }, extra) : '',
      el('span', { class: 'when' }, relativeTime(entry.at, now)));
    open.addEventListener('click', () => onLoad(entry));
    const remove = el('button', { type: 'button', class: 'delete', 'aria-label': 'Delete this job' }, '×');
    remove.addEventListener('click', () => onDelete(index));
    return el('div', { class: 'history-row' }, open, el('div', { class: 'history-actions' }, copyLink(entry), remove));
  }

  // Clearing is two taps within a few seconds, not a dialog — it's a phone.
  function clearButton() {
    const button = el('button', { type: 'button', class: 'clear' }, 'Clear history');
    button.addEventListener('click', () => {
      if (armed) {
        clearTimeout(armed);
        armed = null;
        onClear();
        return;
      }
      button.textContent = 'Tap again to clear';
      armed = setTimeout(() => {
        armed = null;
        button.textContent = 'Clear history';
      }, CLEAR_ARM_MS);
    });
    return button;
  }

  return {
    render(entries, { unit, available, now }) {
      clearTimeout(armed);
      armed = null;
      const children = [];
      if (entries.length === 0) {
        children.push(el('p', { class: 'empty' }, 'Jobs you set up appear here after about 15 seconds.'));
      } else {
        children.push(
          el('div', { class: 'history' }, ...entries.map((entry, index) => row(entry, index, unit, now))),
          el('div', { class: 'actions' }, clearButton()),
        );
      }
      if (!available) children.push(el('p', { class: 'hint' }, "History can't be saved on this device."));
      container.replaceChildren(...children);
    },
  };
}
```

- [ ] **Step 2: Wire it**

In `js/app.js`:

1. Change `import { formatShort } from './ui/format.js';` to `import { formatShort, formatFraction, describeAdvanced, describeFold } from './ui/format.js';` and after the `createPreferencesView` import add `import { createHistoryView } from './ui/historyView.js';`.

2. After the `const preferencesView = ...` line add:

```js
const historyView = createHistoryView($('history'), {
  summarize,
  copyLink: (entry) => createCopyLink(() => urlFor(entry.unit, entry.job)),
  onLoad: (entry) => {
    loadJob(entry.unit, entry.job);
    showTab('calculator');
  },
  onDelete: (index) => setHistory(state.history.filter((_, i) => i !== index)),
  onClear: () => setHistory([]),
});
// The advanced summary of a default job, per unit: a row shows it only when it differs.
const DEFAULT_ADVANCED = Object.fromEntries(['in', 'mm'].map((unit) => [unit, describeAdvanced(DEFAULTS[unit], unit, DEFAULTS[unit].npa.top)]));
```

3. After the `urlFor` function add:

```js
/** What a history row shows, computed fresh from the stored inputs in their own unit. */
function summarize({ unit, job }) {
  const { layout, steps } = compute(job, unit);
  const fmt = (v) => (unit === 'in' ? formatFraction(v) : String(v));
  const { sheet, doc, gutter } = job;
  const gutterText = gutter.columns === gutter.rows ? fmt(gutter.columns) : `${fmt(gutter.columns)} × ${fmt(gutter.rows)}`;
  const line = `${doc.width} × ${doc.length} on ${sheet.width} × ${sheet.length} · ${gutterText}${unit === 'in' ? '"' : ' mm'} gutter${layout.fits ? ` · ${steps.length} cuts` : ''}`;
  const advanced = describeAdvanced(job, unit, DEFAULTS[unit].npa.top);
  const extra = [advanced === DEFAULT_ADVANCED[unit] ? '' : advanced, describeFold(job.fold)].filter(Boolean).join(' · ');
  return { nup: layout.fits ? `${layout.across * layout.down}-up` : 'Does not fit', line, extra };
}
```

4. Replace the body of `recordSettled` so it reads:

```js
/** The job has sat unchanged for SETTLE_MS: record it if it fits. */
function recordSettled() {
  if (!compute(state.job, state.unit).layout.fits) return;
  setHistory(recordJob(state.history, state.unit, state.job, Date.now()));
}

/** Replace the history: in memory, in storage, on the badge, and on screen if it is showing. */
function setHistory(entries) {
  state.history = entries;
  storage.saveHistory(entries);
  tabs.setBadge('history', entries.length);
  if (state.tab === 'history') renderHistoryPanel();
}
```

5. Replace the stub

```js
/** The History view arrives with its own task; until then the panel stays empty. */
function renderHistoryPanel() {}
```

with

```js
function renderHistoryPanel() {
  historyView.render(state.history, { unit: state.unit, available: storage.available, now: Date.now() });
}
```

- [ ] **Step 3: Add the file to the service-worker shell**

In `sw.js`, insert `'./js/ui/historyView.js',` after `'./js/ui/format.js',` (alphabetical: foldInputs, format, historyView, preferencesView, presets).

- [ ] **Step 4: Run the tests and check the view**

Run: `npm test`
Expected: `ℹ fail 0`; 105 tests.

Seed two entries, open the tab, read the rows:

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t8a.png \
  --eval "const base = { gutter: { columns: 0.125, rows: 0.125 }, npa: { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 }, count: {}, align: {}, fold: { style: 'none', axis: 'L', allowance: 0.0625, custom: [] } }; localStorage.setItem('printcalc.history', JSON.stringify({ v: 1, entries: [ { unit: 'in', job: { ...base, sheet: { width: 13, length: 19 }, doc: { width: 3.5, length: 2 }, count: { across: 2 }, fold: { ...base.fold, style: 'bifold' } }, at: Date.now() - 40 * 60000 }, { unit: 'mm', job: { sheet: { width: 320, length: 450 }, doc: { width: 90, length: 55 }, gutter: { columns: 3, rows: 3 }, npa: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 }, count: {}, align: {}, fold: { style: 'none', axis: 'L', allowance: 1.5, custom: [] } }, at: Date.now() - 3 * 3600000 } ] }))" \
  --eval "location.replace(location.pathname)" \
  --eval "new Promise((r) => setTimeout(r, 2000))" \
  --eval "document.getElementById('tab-history').click()" \
  --print "document.querySelector('#tab-history .badge').textContent" \
  --print "[...document.querySelectorAll('.history-row')].map(r => [...r.querySelectorAll('.nup, .line, .extra, .when')].map(e => e.textContent).join(' / ')).join(' || ')" \
  --print "document.querySelectorAll('.history-row .unit-badge').length + ' unit badge(s): ' + [...document.querySelectorAll('.unit-badge')].map(b => b.textContent).join()"
```
Expected: `2`; `16-up / 3.5 × 2 on 13 × 19 · 1/8" gutter · 20 cuts / NPA 1/16 all round · 2 across · Centered · Bifold across length / 40 min ago || 21-up / 90 × 55 on 320 × 450 · 3 mm gutter · 20 cuts / 3 h ago` (the mm row has no `.extra` because it is all defaults; both cut counts are 4 margin cuts + per axis (n−1) strips and (n−1) gutter trims: 2×8 → 4+2+14, 3×7 → 4+4+12); `1 unit badge(s): mm` (the app is in inches, so only the mm row is badged). Read `t8a.png`: two rows, each with a large n-up, a line, a time, and Copy link / × beside it, then Clear history below.

Tap to load, then delete and clear:

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t8b.png \
  --eval "localStorage.setItem('printcalc.history', JSON.stringify({ v: 1, entries: [ { unit: 'in', job: { sheet: { width: 13, length: 19 }, doc: { width: 3.5, length: 2 }, gutter: { columns: 0.125, rows: 0.125 }, npa: { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 }, count: { across: 2 }, align: {}, fold: { style: 'none', axis: 'L', allowance: 0.0625, custom: [] } }, at: Date.now() } ] }))" \
  --eval "location.replace(location.pathname)" \
  --eval "new Promise((r) => setTimeout(r, 2000))" \
  --eval "document.getElementById('tab-history').click(); document.querySelector('.history-open').click()" \
  --print "document.getElementById('panel-calculator').hidden + ' ' + document.querySelector('#summary .nup').textContent" \
  --print "document.querySelector('#sheetInputs .chips button[aria-pressed=true]').textContent" \
  --print "document.querySelector('#advancedInputs input[aria-label=\"Documents across\"]').value"
```
Expected: `false 16-up (auto would be 24)`, `13 × 19`, `2` — tapping a row loads every field, including Advanced, and lands on the calculator.

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t8c.png \
  --eval "localStorage.setItem('printcalc.history', JSON.stringify({ v: 1, entries: [1, 2, 3].map(w => ({ unit: 'in', job: { sheet: { width: 12, length: 18 }, doc: { width: w, length: 1 }, gutter: { columns: 0.125, rows: 0.125 }, npa: { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 }, count: {}, align: {}, fold: { style: 'none', axis: 'L', allowance: 0.0625, custom: [] } }, at: Date.now() })) }))" \
  --eval "location.replace(location.pathname)" \
  --eval "new Promise((r) => setTimeout(r, 2000))" \
  --eval "document.getElementById('tab-history').click(); document.querySelectorAll('.history-row .delete')[1].click()" \
  --print "document.querySelectorAll('.history-row').length + ' rows, badge ' + document.querySelector('#tab-history .badge').textContent" \
  --eval "document.querySelector('#history .clear').click()" \
  --print "document.querySelector('.clear').textContent + ' / rows ' + document.querySelectorAll('.history-row').length" \
  --eval "document.querySelector('.clear').click()" \
  --print "document.querySelectorAll('.history-row').length + ' rows / ' + document.querySelector('#history .empty').textContent + ' / badge hidden ' + document.querySelector('#tab-history .badge').hidden + ' / stored ' + JSON.parse(localStorage.getItem('printcalc.history')).entries.length"
```
Expected: `2 rows, badge 2`; `Tap again to clear / rows 2` (first tap arms, nothing deleted); `0 rows / Jobs you set up appear here after about 15 seconds. / badge hidden true / stored 0`.

Unavailable storage shows its line:

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t8d.png \
  --eval "Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); location.reload()" \
  --eval "new Promise((r) => setTimeout(r, 2000))" \
  --eval "document.getElementById('tab-history').click()" \
  --print "[...document.querySelectorAll('#history p')].map(p => p.textContent).join(' | ')"
```
Expected: `Jobs you set up appear here after about 15 seconds. | History can't be saved on this device.` (If the override does not survive the reload in your Chrome, note it; `storage.available` is pinned by Task 3's tests.)

Dedupe end to end — the same job settling twice is one row:

```bash
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 t8e.png \
  --eval "new Promise((r) => setTimeout(r, 16000))" \
  --eval "document.querySelector('#docInputs .chips button:nth-child(2)').click(); document.querySelector('#docInputs .chips button:first-child').click()" \
  --eval "new Promise((r) => setTimeout(r, 16000))" \
  --print "JSON.parse(localStorage.getItem('printcalc.history')).entries.length" \
  --print "document.querySelector('#tab-history .badge').textContent"
```
Expected: `1` and `1` — the default job settled, was changed and changed back, settled again, and was bumped rather than repeated.

- [ ] **Step 5: Commit**

```bash
git add js/ui/historyView.js js/app.js sw.js
git commit -m "Add the History tab: settled jobs, tap to load, delete, and clear

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Docs, selectors, and the full pass

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `.claude/skills/screenshot/SKILL.md`

- [ ] **Step 1: CLAUDE.md**

In the **Architecture** section, after the line beginning `- \`js/app.js\` keeps everything the worker entered under \`state.job\`` add:

```markdown
- `js/storage.js` is the **only** file that touches `localStorage`; every call is
  wrapped, so the app must work with no storage at all. `js/core/share.js` is the
  job ⇄ URL-hash codec and takes `DEFAULTS` as a parameter (core never imports ui).
- `loadJob(unit, job)` in `js/app.js` is the one path by which a job reaches the
  inputs — a link, a history row, the resumed job, or the unit toggle.
```

In the **Design decisions that look like bugs** section add:

```markdown
- The address bar mirrors the job on every render (`replaceState`, never
  `pushState`): a bookmark is a saved job. History records a job only after it
  sits unchanged for 15 s and fits; `last` (resume) is written on every change.
```

- [ ] **Step 2: README.md**

In the opening paragraph (the one that mentions the Advanced section), append the sentence: `A History tab keeps the last twenty jobs you set up, a Preferences tab sets the default unit and whether the app resumes where you left off, and the address bar always holds a shareable link to the current job — all on the device, no account.`

In the **Design** section add:

```markdown
- Spec: `docs/superpowers/specs/2026-09-10-history-preferences-share-design.md`
- Plan: `docs/superpowers/plans/2026-09-10-history-preferences-share.md`
```

- [ ] **Step 3: Screenshot skill selectors**

In `.claude/skills/screenshot/SKILL.md`, add these rows to the **Selectors worth knowing** table:

```markdown
| Tab buttons | `#tab-calculator`, `#tab-history`, `#tab-preferences` |
| History badge | `#tab-history .badge` |
| History rows | `.history-row` (tap target `.history-open`, delete `.delete`) |
| Clear history | `#history .clear` |
| Preference chips | `#preferences button[data-pref="unit"][data-value="mm"]` |
| Copy link (calculator) | `#shareBar button` |
```

And under **Expected baseline** append: `The address bar reads \`#v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125\` on load. Each invocation is a fresh profile, so \`localStorage\` starts empty — seed it with \`--eval\`, then \`location.replace(location.pathname)\` and a \`new Promise((r) => setTimeout(r, 2000))\` eval before reading.`

- [ ] **Step 4: The full pass**

Run: `npm test` → `ℹ fail 0`, 105 tests, and `git status` clean apart from the three files above.

At 390×844, each in its own invocation unless noted, and **read every PNG**:

1. Default load: `24-up`, 22 steps, three tabs with Calculator selected, `#shareBar button` reads `Copy link`, `location.hash` is the short default form.
2. Sheet `13 × 19` → hash changes to `s=13x19`; `24-up`.
3. Open `http://localhost:8080/#v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125&n=0,0.0625,0.0625,0.0625&a=top=0` → `24-up`, **21 steps**, Advanced header `NPA top 0 · Auto · Top +0`.
4. Open the mm link from Task 6 → unit chip `mm`, NPA field `1.5`.
5. Open a malformed link → `24-up`, canonical default hash.
6. Preferences: set default `mm` and resume `On`; reload without hash → opens in mm; set resume `Off` → `printcalc.last` is `null`.
7. Resume: seed prefs+last (Task 6 Step 4), reload → the seeded job; change the document → `last` follows.
8. History: seed two entries (Task 8), open the tab → two rows, badge `2`, the mm row badged; tap a row → calculator shows it with Advanced restored; delete one; Clear arms then clears; empty state shows.
9. Settle: nothing at 10 s, one entry at 16 s; the same job settling twice is still one entry.
10. Copy link: click `#shareBar button` → its text becomes `Copied` within 1.5 s (headless Chrome grants clipboard on localhost; if it does not, the fallback field must appear with the URL selected — either is a pass, say which you saw).
11. `document.documentElement.scrollWidth === document.documentElement.clientWidth` on every tab.
12. Desktop 1200×900: the calculator keeps its two columns; History and Preferences are one column no wider than 640 px.
13. Offline (a CDP script as in the screenshot skill's offline note, or a fresh profile with `Network.emulateNetworkConditions`): first load online, go offline, reload → the app renders and recalculates when a preset is tapped; `caches.keys()` includes `printcalc-v4` and no `printcalc-v3`.

Record what you actually observed for each, not what you expected.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md .claude/skills/screenshot/SKILL.md
git commit -m "Document history, preferences, and share links

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
