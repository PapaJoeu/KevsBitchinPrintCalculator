// sequenceView.js — the program sequence as the operator keys it in: one row per cut,
// a full-width band wherever the stack turns. Repeated cuts are never collapsed.
import { el } from './dom.js';
import { formatMeasure, formatShort, unitName, stepNote } from './format.js';

export function renderSequence(container, { layout, steps }, unit) {
  if (!layout.fits) {
    container.replaceChildren();
    return;
  }
  const list = el('ol', { class: 'steps' });
  for (const step of steps) {
    if (step.turnBefore) list.append(el('li', { class: 'turn' }, 'TURN STACK 90°'));
    list.append(el('li', { class: `step step-${step.kind}` },
      el('span', { class: 'step-n' }, String(step.n)),
      el('span', { class: 'step-pos' }, formatMeasure(step.position, unit)),
      el('span', { class: 'step-axis', title: step.axis === 'L' ? 'Along the sheet length' : 'Along the sheet width' }, step.axis),
      el('span', { class: 'step-note' }, stepNote(step))));
  }
  const L = formatShort(layout.sheet.length, unit);
  const W = formatShort(layout.sheet.width, unit);
  container.replaceChildren(
    el('p', { class: 'seq-header' }, `${steps.length} cuts · gauge positions in ${unitName(unit)} · L = ${L} side, W = ${W} side`),
    list,
  );
}
