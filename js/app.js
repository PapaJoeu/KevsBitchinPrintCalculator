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
  // Adopt what sanitize returns, not the raw stored job: an entry that is merely
  // close enough to survive the codec would otherwise keep its stale shape, dodging
  // recordJob's dedupe and breaking anything that later re-encodes it.
  history: storage.loadHistory().flatMap((entry) => {
    const clean = Number.isFinite(entry?.at) ? sanitize(entry.unit, entry.job) : null;
    return clean ? [{ unit: clean.unit, job: clean.job, at: entry.at }] : [];
  }),
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

/** The History view arrives with its own task; until then the panel stays empty. */
function renderHistoryPanel() {}

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

// Offline shell. When a new version takes over an open page, reload once to run it.
if ('serviceWorker' in navigator) {
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
    hadController = true;
  });
  navigator.serviceWorker.register('./sw.js');
}
