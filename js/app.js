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
