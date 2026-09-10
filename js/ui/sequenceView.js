// sequenceView.js — the program sequence as the operator keys it in: one row per cut,
// a full-width band wherever the stack turns. Repeated cuts are never collapsed.
// Tapping a row marks that cut done; Large gauge trades the notes for bigger numbers,
// which is what a press operator reads from arm's length.
import { el } from './dom.js';
import { formatMeasure, formatShort, unitName, stepNote } from './format.js';

/**
 * @param options  { doneCuts: Set<number>, largeGauge: boolean,
 *                   onToggleDone(n), onToggleGauge(), onReset() }
 *   doneCuts holds step numbers. The app keeps it for as long as the cut list is
 *   the same list, so the marks survive a re-render and a fold change alike.
 */
export function renderSequence(container, { layout, steps }, unit, {
  doneCuts = new Set(), largeGauge = false, onToggleDone, onToggleGauge, onReset,
} = {}) {
  if (!layout.fits) {
    container.replaceChildren();
    return;
  }
  const list = el('ol', { class: largeGauge ? 'steps large' : 'steps' });
  let doneCount = 0;
  for (const step of steps) {
    if (step.turnBefore) list.append(el('li', { class: 'turn' }, 'TURN STACK 90°'));
    const done = doneCuts.has(step.n);
    if (done) doneCount += 1;
    // The row is the button: a full-width target, reachable from a bench keyboard too.
    const row = el('li', {
      class: `step step-${step.kind}${done ? ' done' : ''}`,
      role: 'button', tabindex: '0', 'aria-pressed': String(done),
      'aria-label': `Cut ${step.n}, ${formatMeasure(step.position, unit)} ${step.axis}${done ? ', done' : ''}`,
    },
    el('span', { class: 'step-n', 'aria-hidden': 'true' }, done ? '✓' : String(step.n)),
    el('span', { class: 'step-pos' }, formatMeasure(step.position, unit)),
    el('span', { class: 'step-axis', title: step.axis === 'L' ? 'Along the sheet length' : 'Along the sheet width' }, step.axis),
    largeGauge ? '' : el('span', { class: 'step-note' }, stepNote(step)));
    if (onToggleDone) {
      row.addEventListener('click', () => onToggleDone(step.n));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggleDone(step.n);
        }
      });
    }
    list.append(row);
  }

  const L = formatShort(layout.sheet.length, unit);
  const W = formatShort(layout.sheet.width, unit);
  const gauge = el('button', { type: 'button', 'aria-pressed': String(largeGauge) }, 'Large gauge');
  if (onToggleGauge) gauge.addEventListener('click', onToggleGauge);
  const reset = el('button', { type: 'button' }, 'Start over');
  if (onReset) reset.addEventListener('click', onReset);

  const progress = `Tap a cut when it's done.${doneCount > 0 ? ` ${doneCount} of ${steps.length} done.` : ''}`;

  container.replaceChildren(
    el('p', { class: 'seq-header' }, `${steps.length} cuts · gauge positions in ${unitName(unit)} · L = ${L} side, W = ${W} side`),
    el('div', { class: 'seq-controls' }, gauge, reset),
    el('p', { class: 'seq-progress' }, progress),
    list,
  );
}
