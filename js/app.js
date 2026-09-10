// app.js — state and the render loop. Modules are wired together here and nowhere else.
import { computeLayout, suggestOrientation } from './core/layout.js';
import { computeSequence } from './core/sequence.js';
import { computeScores } from './core/scores.js';
import { mmToInches, inchesToMm } from './core/measure.js';
import { encodeJob, decodeJob } from './core/share.js';
import { recordJob, MAX_HISTORY } from './core/history.js';
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
import { createPreferencesView } from './ui/preferencesView.js';
import { createHistoryView } from './ui/historyView.js';
import { formatShort, formatFraction, describeAdvanced, describeFold } from './ui/format.js';

const $ = (id) => document.getElementById(id);
const TABS = [{ id: 'calculator', label: 'Calculator' }, { id: 'history', label: 'History' }, { id: 'preferences', label: 'Preferences' }];
const DEFAULT_PREFS = { unit: 'in', resume: false, largeGauge: false };
// A job goes into history once it has sat unchanged this long (and fits).
const SETTLE_MS = 15000;
// How long a deleted history row can be brought back.
const UNDO_MS = 6000;

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
  // Cuts the operator has keyed in, by step number, valid for one cut list. render()
  // keys the set to a signature of the steps: a change that leaves the program the
  // same (a fold, a unit-preference tap) keeps the marks, any other change drops them.
  done: { key: '', cuts: new Set() },
  // A just-deleted history row, offered back for UNDO_MS.
  pendingUndo: null,
  prefs: { ...DEFAULT_PREFS, ...(storage.loadPrefs() ?? {}) },
  // Adopt what sanitize returns, not the raw stored job: an entry that is merely
  // close enough to survive the codec would otherwise keep its stale shape, dodging
  // recordJob's dedupe and breaking anything that later re-encodes it.
  history: storage.loadHistory().flatMap((entry) => {
    const clean = Number.isFinite(entry?.at) ? sanitize(entry.unit, entry.job) : null;
    return clean ? [{ unit: clean.unit, job: clean.job, at: entry.at }] : [];
  }),
};
let settleTimer = null;
let undoTimer = null;
// The last computed result, so a tap on a cut can redraw the sequence alone.
let lastResult = null;

const sections = {
  sheet: createSizeInputs($('sheetInputs'), { label: 'Sheet', cols: 2, onChange: (sheet) => update({ sheet }) }),
  doc: createSizeInputs($('docInputs'), { label: 'Document', cols: 3, onChange: (doc) => update({ doc }) }),
  gutter: createSizeInputs($('gutterInputs'), {
    label: 'Gutter', allowZero: true, keys: ['columns', 'rows'], labels: ['Between columns', 'Between rows'],
    cols: 3, zeroDisables: true, onChange: (gutter) => update({ gutter }),
  }),
};
const foldInputs = createFoldInputs($('foldInputs'), { onChange: (fold) => update({ fold }) });
const advancedInputs = createAdvancedInputs($('advancedInputs'), { onChange: (patch) => update(patch) });
const sheetView = createSheetView($('canvas'));
const NO_SCORES = { offsets: [], positions: [], segments: [] };
const tabs = createTabs($('tabs'), TABS, { onSelect: showTab });
$('shareBar').append(createCopyLink(() => urlFor(state.unit, state.job), 'Copy link to this job'));
const preferencesView = createPreferencesView($('preferences'), { onChange: setPrefs });
const historyView = createHistoryView($('history'), {
  summarize,
  copyLink: (entry) => createCopyLink(() => urlFor(entry.unit, entry.job)),
  onLoad: (entry) => {
    loadJob(entry.unit, entry.job);
    showTab('calculator');
  },
  onDelete: deleteEntry,
  onClear: () => {
    clearPendingUndo();
    setHistory([]);
  },
  onUndo: undoDelete,
});
// The advanced summary of a default job, per unit: a row shows it only when it differs.
const DEFAULT_ADVANCED = Object.fromEntries(['in', 'mm'].map((unit) => [unit, describeAdvanced(DEFAULTS[unit], unit, DEFAULTS[unit].npa.top)]));

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

/** What makes one cut list the same list as the last: every position, axis and kind. */
const stepsKey = (steps) => steps.map((s) => `${s.position}${s.axis}${s.kind}`).join('|');

function render() {
  const result = compute(state.job, state.unit);
  lastResult = result;
  const key = stepsKey(result.steps);
  if (key !== state.done.key) state.done = { key, cuts: new Set() };
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
  renderSequencePanel();
  renderScores($('scores'), result, state.job.fold, state.unit);
  sheetView.draw(result.layout, result.scores, (inches) => formatShort(inches, state.unit));
  $('legend').hidden = result.scores.segments.length === 0;
  // The address bar mirrors the job: a bookmark is a saved job and Share shares the
  // setup. replaceState, never pushState — the Back button is left alone.
  window.history.replaceState(null, '', `#${encodeJob(state.unit, state.job, DEFAULTS[state.unit])}`);
}

/** The sequence alone, from the last result: a tap on a cut recomputes nothing. */
function renderSequencePanel() {
  renderSequence($('sequence'), lastResult, state.unit, {
    doneCuts: state.done.cuts,
    largeGauge: state.prefs.largeGauge,
    onToggleDone: toggleDone,
    onToggleGauge: () => setPrefs({ largeGauge: !state.prefs.largeGauge }),
    onReset: () => {
      state.done.cuts.clear();
      renderSequencePanel();
    },
  });
}

/** Apply a validated change to the job. Any change re-arms the orientation hint. */
function update(patch) {
  Object.assign(state.job, patch);
  state.hintDismissed = false;
  render();
  afterChange();
}

/** Mark a cut done, or undo that. Progress is per session — it is never stored. */
function toggleDone(n) {
  if (state.done.cuts.has(n)) state.done.cuts.delete(n);
  else state.done.cuts.add(n);
  renderSequencePanel();
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
  setHistory(recordJob(state.history, state.unit, state.job, Date.now()));
}

/**
 * Delete a row, keeping it recoverable for a few seconds. A second deletion while a
 * bar is up makes the first one permanent — one pending entry, never a stack. When
 * the offer lapses only the bar goes: the rows, and an armed Clear, are left alone.
 */
function deleteEntry(index) {
  const entry = state.history[index];
  if (!entry) return;
  clearPendingUndo();
  state.pendingUndo = { entry, label: summarize(entry).nup };
  undoTimer = setTimeout(() => {
    state.pendingUndo = null;
    historyView.dismissUndo();
  }, UNDO_MS);
  setHistory(state.history.filter((_, i) => i !== index));
}

/**
 * Put a deleted row back. History is newest first, so the entry's own timestamp
 * says where it belongs — even if a job settled into the list in the meantime —
 * and the cap holds as it would had the row never left.
 */
function undoDelete() {
  const pending = state.pendingUndo;
  if (!pending) return;
  clearPendingUndo();
  setHistory([...state.history, pending.entry].sort((a, b) => b.at - a.at).slice(0, MAX_HISTORY));
}

function clearPendingUndo() {
  clearTimeout(undoTimer);
  state.pendingUndo = null;
}

/** Replace the history: in memory, in storage, on the badge, and on screen if it is showing. */
function setHistory(entries) {
  state.history = entries;
  storage.saveHistory(entries);
  tabs.setBadge('history', entries.length);
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
 *
 * `remember: false` loads the job without adopting it as "where I was": a colleague's
 * shared link must not overwrite the worker's own unfinished job in `last`. The settle
 * timer still runs either way — a shared job left sitting is still worth recording.
 */
function loadJob(unit, job, { remember = true } = {}) {
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
  if (remember) afterChange();
  else {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(recordSettled, SETTLE_MS);
  }
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

/**
 * Update a preference. Saved at once. Turning resume on saves the current job so
 * closing the app right away still resumes here; turning it off forgets it at once.
 * No other preference touches the stored job: with a colleague's link open, the
 * worker's own unfinished job must stay in `last`.
 */
function setPrefs(patch) {
  state.prefs = { ...state.prefs, ...patch };
  storage.savePrefs(state.prefs);
  if ('resume' in patch) {
    if (state.prefs.resume) storage.saveLast(state.unit, state.job);
    else storage.clearLast();
  }
  preferencesView.setValue(state.prefs);
  // Large gauge shows in the sequence; redrawing it from the last result is cheap.
  if (lastResult) renderSequencePanel();
}

function renderHistoryPanel() {
  historyView.render(state.history, {
    unit: state.unit,
    available: storage.available,
    now: Date.now(),
    pendingUndo: state.pendingUndo,
  });
}

for (const button of $('unitChips').children) {
  button.addEventListener('click', () => setUnit(button.dataset.unit));
}

// Open on: the job in the link, else the resumed job, else a fresh job in the preferred unit.
const shared = decodeJob(window.location.hash, DEFAULTS);
const last = state.prefs.resume ? storage.loadLast() : null;
const resumed = last ? sanitize(last.unit, last.job) : null;
if (shared) loadJob(shared.unit, shared.job, { remember: false });
else if (resumed) loadJob(resumed.unit, resumed.job);
else loadJob(state.prefs.unit, DEFAULTS[state.prefs.unit]);
showTab('calculator');
tabs.setBadge('history', state.history.length);
preferencesView.setValue(state.prefs);

// Offline shell. When a new version takes over an open page, reload once to run it.
if ('serviceWorker' in navigator) {
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
    hadController = true;
  });
  navigator.serviceWorker.register('./sw.js');
}
