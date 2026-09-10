# History, Preferences, and Share-by-URL — Design

Extends `2026-09-09-mobile-print-calculator-design.md` and
`2026-09-09-advanced-inputs-design.md`. Everything in those specs stands; this
one adds persistence and navigation and changes nothing about the cutting
model, layout, or the calculator's inputs.

## Goal

Let a worker get back to a job they set up earlier, open the app the way they
left it, and hand a setup to another phone — with no server, no account, and
no dependency. The app stays a static site on GitHub Pages that works offline.

## Non-goals

- Named or pinned jobs, export/import, custom presets, sync between devices,
  remembering which tab was open. None of these ship in this feature.
- Any backend. All state lives in `localStorage` on the device, or in the URL.

## Navigation: tabs

A Win98 tabbed-dialog strip sits directly under the title bar:
**Calculator | History | Preferences**. The selected tab is raised and joined
to its panel. `js/ui/tabs.js` renders the strip (buttons with `role="tab"`,
`aria-selected`); `index.html` holds three `<section role="tabpanel">` panels
shown and hidden with the `hidden` attribute. The Calculator panel wraps
today's `<main>` unchanged, so the desktop two-column layout is untouched;
History and Preferences are single-column with a comfortable max width. The
History tab shows a count badge (`History 7`) when it has entries.

The Units toggle stays in the Calculator tab: it is *this job's* unit.
Preferences sets only the default. The app always opens on Calculator.

## Data model

`state` in `js/app.js` grows from `{ unit, job, hintDismissed }` to also hold:

| Field | Type | Persisted |
|---|---|---|
| `tab` | `'calculator' \| 'history' \| 'preferences'` | no |
| `prefs` | `{ unit: 'in' \| 'mm', resume: boolean }` | `printcalc.prefs` |
| `history` | `Array<{ unit, job, at }>`, newest first, max 20 | `printcalc.history` |

A persisted `job` is `state.job` exactly as entered, in its own unit — the
same shape `DEFAULTS[unit]` seeds: `{ sheet, doc, gutter, npa, count, align,
fold }`. Nothing derived is stored: n-up and cut counts are computed at render
time from the inputs, so history can never show a stale number if the model
changes.

### Storage keys

| Key | Document |
|---|---|
| `printcalc.prefs` | `{ v: 1, unit, resume }` |
| `printcalc.last` | `{ v: 1, unit, job }` — written on every change while `resume` is on; deleted the moment it is turned off |
| `printcalc.history` | `{ v: 1, entries: [{ unit, job, at }] }` |

Every document carries `v: 1`. A document with a different `v`, or one that
fails to parse, is treated as absent — never migrated in place, never deleted
(a newer build may read it later).

### `js/storage.js`

The only file that touches `localStorage`. Exports `loadPrefs`, `savePrefs`,
`loadLast`, `saveLast`, `clearLast`, `loadHistory`, `saveHistory`. It takes
its `Storage` object as a parameter defaulting to `localStorage`, so tests
pass an in-memory fake. Every access is wrapped in try/catch: a read that
fails returns `null`; a write that fails does nothing. The app must behave
exactly as it does today when storage is unavailable, full, or throwing.

## Recording jobs

- **`last`** (resume): written on every `update()` while `prefs.resume` is
  on. Cheap, and it means closing the app seconds after an edit never loses
  the worker's place.
- **`history`**: a job is recorded once it *settles* — **15 seconds** with no
  edits — and only if the layout fits. Every `update()` resets the timer. A
  worker looking at a real job stays on it far longer than that; a passing
  tweak never lands.
- **Dedupe** is on the whole `{ unit, job }` by structural equality (key order
  ignored). A match moves to the top with a fresh `at`; otherwise the entry is
  inserted at the top and the list truncated to 20. The settle delay, not the
  key, is what keeps keystroke noise out — a different alignment or count is a
  genuinely different setup a worker may want back.
- The pure list logic is a core function, `recordJob(entries, unit, job, now)
  → entries`, in `js/core/history.js`, with no storage or DOM.

## Share URL

The hash always mirrors the current job. After every render,
`history.replaceState(null, '', '#' + encodeJob(unit, job))` — `replaceState`
so the Back button is untouched. A bookmark is therefore a saved job, and the
phone's own Share button shares the setup.

### Format

```
#v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125&n=0.0625,0.0625,0.0625,0.0625&f=bifold|L|0.0625
```

| Key | Meaning | Omitted when |
|---|---|---|
| `v` | format version, `1` | never |
| `u` | unit, `in` or `mm` | never |
| `s`, `d`, `g` | sheet, document, gutter as `WxL` (gutter is `columns x rows`) | never |
| `n` | NPA `top,bottom,left,right` | all four equal that unit's default |
| `c` | count override `across x down`; either side blank means auto (`2x`, `x9`) | no override |
| `a` | alignment, e.g. `top=0` or `top=0.5,left=0` | centred (no edges) |
| `f` | fold `style\|axis\|allowance`, style one of `bifold`, `trifold`, `zfold` | style is `none` |
| `x` | custom scores, comma-separated | none |

Values are in the job's own unit, exactly as entered, never converted. All
numbers are plain decimals (`0.125`, not `1/8`).

### `js/core/share.js`

`encodeJob(unit, job) → string` and `decodeJob(hash) → { unit, job } | null`.
Pure string work, no DOM. `decodeJob` returns `null` — never throws, never a
partial job — for anything malformed: missing or unknown `v`, an unknown unit,
a non-numeric or non-positive size, an `n` with other than four values, an
alignment naming both edges of an axis, an unknown fold style. Omitted keys
fill in from `DEFAULTS[unit]`. Decoding does not validate that the job fits;
the calculator does that and shows its usual result.

### Copy link

A **Copy link** button in the Calculator panel (in the Layout summary group),
and one on each History row. It uses `navigator.clipboard.writeText` and
shows a brief "Copied" state on the button. If the clipboard API is
unavailable, the link appears in a read-only field, selected, for manual copy.

## Loading a job

One function, `loadJob(unit, job)` in `js/app.js`, is the only path by which
state reaches the inputs: it sets `state.unit`, replaces `state.job`, re-arms
the orientation hint, syncs every input section (the path `setUnit` already
uses — `setPresets` for sizes, `foldInputs.setValue`,
`advancedInputs.setValue`), and renders. `setUnit` becomes a caller of it.

### Load order on open

1. A hash that decodes → that job, in its unit.
2. Else, if `prefs.resume` is on and `last` loads → that job, in its unit.
3. Else `DEFAULTS[prefs.unit]`.

A job loaded from a URL is recorded into history when it settles, like any
other.

## History view

A list, newest first. Each row:

- the n-up figure, large (or `Does not fit`, in the unlikely case the stored
  job no longer fits — still listed, still loadable so the worker can see why);
- one line in the entry's own unit: `3.5 × 2 on 12 × 18 · ⅛" gutter · 22 cuts`,
  with a unit badge when the entry's unit differs from the current one;
- a second muted line for anything non-default, reusing the summary text the
  Advanced header already produces (`NPA 1/16 all round · 2 across · Top +0`,
  plus the fold style when set);
- a relative time: `just now`, `40 min ago`, `3 h ago`, `Tue`, `Sep 2`.

Tapping the row calls `loadJob` and switches to Calculator. Each row has
**Copy link** and **×** (delete, immediate). At the bottom, **Clear history**
becomes *Tap again to clear* for four seconds rather than opening a dialog.
Empty state: "Jobs you set up appear here after about 15 seconds." If storage
is unavailable, one extra line: "History can't be saved on this device."

## Preferences view

Two settings, each a labelled chip row in the app's existing style, saved
immediately with no button:

- **Default unit** — `in | mm`. Affects only which unit a fresh job opens in.
- **Resume last job on open** — `On | Off`. Note beneath: "Off always opens
  with a fresh default job." Turning it off deletes `last` immediately;
  turning it on saves the current job immediately, so closing the app right
  away still resumes here.

## Failure modes

| Situation | Behaviour |
|---|---|
| Storage unavailable, full, or throwing | Calculator works exactly as today. Preferences apply for the session only. History shows its empty state plus the "can't be saved" line. |
| Stored document malformed or a future `v` | Ignored; not migrated, not deleted. |
| Malformed URL hash | Ignored silently; falls through the load order. A bad link just opens the app. |
| Two tabs open at once | Last writer wins. No locking. |

## Service worker

`sw.js` `SHELL` gains `./js/storage.js`, `./js/core/share.js`,
`./js/core/history.js`, `./js/ui/tabs.js`, `./js/ui/historyView.js`,
`./js/ui/preferencesView.js`; `VERSION` becomes `v4`. `tests/sw.test.js`
enforces the list in both directions.

## Testing

Automated, `node:test`, no DOM:

- `tests/share.test.js` — round-trips for the three sequence fixtures, an mm
  job, a count override, a two-edge alignment, and a folded job with custom
  scores; default omission checked both ways; every rejection case above
  returns `null`.
- `tests/storage.test.js` — against an in-memory fake `Storage`: version
  mismatch → absent; corrupted JSON → absent; a `setItem` that throws leaves
  state unaffected.
- `tests/history.test.js` — `recordJob`: dedupe moves a match to the top with
  the new timestamp; unknown jobs insert at the top; never more than 20;
  equality ignores key order.
- `tests/sw.test.js` — existing; fails until `SHELL` is complete.

Live, via `.claude/skills/screenshot/shoot.py`: tab switching shows exactly
one panel; a job appears in History 15 s after settling and not at 10 s;
re-entering the same job bumps rather than duplicates; tap-to-load restores
every field including Advanced; the address bar updates on edit; a copied link
opened in a fresh profile reproduces the job; resume on/off across reloads; a
throwing `localStorage` still yields a working calculator.

## Naming

New files follow the existing convention: core logic in `js/core/` as pure
functions; views in `js/ui/` as `create<Name>(container, { onX })` factories
returning setters. Storage keys are prefixed `printcalc.`; URL keys are
single letters, documented above; the fold style values are the existing
`none | bifold | trifold | zfold`.
