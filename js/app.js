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
  gutter: createSizeInputs($('gutterInputs'), {
    label: 'Gutter', allowZero: true, keys: ['columns', 'rows'], labels: ['Between columns', 'Between rows'],
    onChange: (gutter) => update({ gutter }),
  }),
};
const foldInputs = createFoldInputs($('foldInputs'), { onChange: (fold) => update({ fold }) });
const sheetView = createSheetView($('canvas'));
const NO_SCORES = { offsets: [], positions: [], segments: [] };

const toInches = (value) => (state.unit === 'mm' ? mmToInches(value) : value);
const sizeToInches = (size) => ({ width: toInches(size.width), length: toInches(size.length) });

function compute(job) {
  const sheet = sizeToInches(job.sheet);
  const doc = sizeToInches(job.doc);
  const gutter = { columns: toInches(job.gutter.columns), rows: toInches(job.gutter.rows) };
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

for (const button of $('unitChips').children) {
  button.addEventListener('click', () => setUnit(button.dataset.unit));
}

setUnit('in');

// Offline shell. When a new version takes over an open page, reload once to run it.
if ('serviceWorker' in navigator) {
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.location.reload();
    hadController = true;
  });
  navigator.serviceWorker.register('./sw.js');
}
