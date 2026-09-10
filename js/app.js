// app.js — state and the render loop. Modules are wired together here and nowhere else.
import { computeLayout, suggestOrientation } from './core/layout.js';
import { computeSequence } from './core/sequence.js';
import { computeScores } from './core/scores.js';
import { mmToInches, inchesToMm } from './core/measure.js';
import { PRESETS, DEFAULTS } from './ui/presets.js';
import { createSizeInputs } from './ui/sizeInputs.js';
import { createFoldInputs } from './ui/foldInputs.js';
import { createAdvancedInputs } from './ui/advancedInputs.js';
import { renderSummary } from './ui/summaryView.js';
import { renderSequence } from './ui/sequenceView.js';
import { renderScores } from './ui/scoresView.js';
import { createSheetView } from './ui/sheetView.js';
import { formatShort } from './ui/format.js';
import { createTabs } from './ui/tabs.js';
import { createCopyLink } from './ui/copyLink.js';
import { encodeJob } from './core/share.js';

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
    alwaysShowFields: true, onChange: (gutter) => update({ gutter }),
  }),
};
const foldInputs = createFoldInputs($('foldInputs'), { onChange: (fold) => update({ fold }) });
const advancedInputs = createAdvancedInputs($('advancedInputs'), { onChange: (patch) => update(patch) });
const sheetView = createSheetView($('canvas'));
const NO_SCORES = { offsets: [], positions: [], segments: [] };

const TABS = [{ id: 'calculator', label: 'Calculator' }, { id: 'history', label: 'History' }, { id: 'preferences', label: 'Preferences' }];
const tabs = createTabs($('tabs'), TABS, { onSelect: showTab });
$('shareBar').append(createCopyLink(() => `${window.location.origin}${window.location.pathname}#${encodeJob(state.unit, state.job, DEFAULTS[state.unit])}`));

function showTab(id) {
  for (const tab of TABS) $(`panel-${tab.id}`).hidden = tab.id !== id;
  tabs.select(id);
}

const toInches = (value) => (state.unit === 'mm' ? mmToInches(value) : value);
const sizeToInches = (size) => ({ width: toInches(size.width), length: toInches(size.length) });

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

function render() {
  const result = compute(state.job);
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
}

/** Apply a validated change to the job. Any change re-arms the orientation hint. */
function update(patch) {
  Object.assign(state.job, patch);
  state.hintDismissed = false;
  render();
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

/** A new unit is a new job: reset to that unit's defaults (jobs are entered fresh). */
function setUnit(unit) {
  state.unit = unit;
  state.job = structuredClone(DEFAULTS[unit]);
  state.hintDismissed = false;
  for (const kind of ['sheet', 'doc', 'gutter']) sections[kind].setPresets(PRESETS[unit][kind], state.job[kind]);
  foldInputs.setValue(state.job.fold, unit);
  advancedInputs.setValue({ npa: state.job.npa, count: state.job.count, align: state.job.align }, unit, DEFAULTS[unit].npa.top);
  for (const button of $('unitChips').children) {
    button.setAttribute('aria-pressed', String(button.dataset.unit === unit));
  }
  render();
}

for (const button of $('unitChips').children) {
  button.addEventListener('click', () => setUnit(button.dataset.unit));
}

showTab('calculator');
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
