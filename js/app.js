// app.js — state and the render loop. Modules are wired together here and nowhere else.
import { computeLayout, suggestOrientation } from './core/layout.js';
import { computeSequence } from './core/sequence.js';
import { computeScores } from './core/scores.js';
import { mmToInches } from './core/measure.js';
import { PRESETS, DEFAULT_JOB, FOLD_DEFAULTS } from './ui/presets.js';
import { createSizeInputs } from './ui/inputs.js';
import { renderSummary } from './ui/summaryView.js';
import { renderSequence } from './ui/sequenceView.js';
import { createVisualizer } from './ui/visualizer.js';
import { createFoldControls } from './ui/foldControls.js';
import { renderScores } from './ui/scoresView.js';
import { formatShort } from './ui/format.js';

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

const visualizer = createVisualizer($('canvas'));
const NO_SCORES = { offsets: [], positions: [], segments: [] };
const foldControls = createFoldControls($('foldControls'), { onChange: (fold) => update({ fold }) });

const toInches = (value) => (state.unit === 'mm' ? mmToInches(value) : value);
const sizeToInches = (size) => ({ width: toInches(size.width), length: toInches(size.length) });

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

function render() {
  const result = compute();
  foldControls.setDocSize(state.doc);
  renderSummary($('summary'), result, { unit: state.unit, hintDismissed: state.hintDismissed });
  renderSequence($('sequence'), result, state.unit);
  renderScores($('scores'), result, state.fold, state.unit);
  visualizer.draw(result.layout, result.scores, (inches) => formatShort(inches, state.unit));
  $('legend').hidden = result.scores.segments.length === 0;
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
  foldControls.setValue(state.fold, unit);
  for (const button of $('unitChips').children) {
    button.setAttribute('aria-pressed', String(button.dataset.unit === unit));
  }
  render();
}

for (const button of $('unitChips').children) {
  button.addEventListener('click', () => setUnit(button.dataset.unit));
}

setUnit('in');
