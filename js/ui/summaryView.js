// summaryView.js — the n-up line, imposed-block details, the no-fit explanation,
// and (Task 12) the better-orientation hint.
import { el } from './dom.js';
import { formatMeasure } from './format.js';

/**
 * @param result    { layout, steps, suggestion }
 * @param options   { unit, hintDismissed, onApply(rotate), onDismiss() }
 */
export function renderSummary(container, { layout, steps, suggestion }, { unit, hintDismissed, onApply, onDismiss }) {
  const fmt = (inches) => `${formatMeasure(inches, unit)} ${unit}`;
  if (!layout.fits) {
    container.replaceChildren(
      el('div', { class: 'nup' }, 'Does not fit'),
      el('div', { class: 'panel warning' }, ...explainNoFit(layout, fmt)),
    );
  } else {
    container.replaceChildren(
      el('div', { class: 'nup' }, `${layout.across * layout.down}-up`),
      el('p', { class: 'detail' }, `${layout.across} across × ${layout.down} down · ${steps.length} cuts`),
      el('p', { class: 'detail' },
        `Imposed ${fmt(layout.imposed.width)} × ${fmt(layout.imposed.length)} · margins ${fmt(layout.margins.left)} side, ${fmt(layout.margins.top)} head`),
    );
  }
  if (suggestion && !hintDismissed) container.append(hintBox(suggestion, layout, { onApply, onDismiss }));
}

// The tool reports what the sheet as entered does; a better turn is offered, never applied.
function hintBox(suggestion, layout, { onApply, onDismiss }) {
  const what = suggestion.rotate === 'doc' ? 'document' : 'sheet';
  const current = layout.across * layout.down;
  const apply = el('button', { type: 'button' }, `Turn ${what}`);
  apply.addEventListener('click', () => onApply(suggestion.rotate));
  const dismiss = el('button', { type: 'button' }, 'Keep as entered');
  dismiss.addEventListener('click', onDismiss);
  return el('div', { class: 'panel hint-box' },
    el('p', {}, `Turning the ${what} fits ${suggestion.count}-up${current > 0 ? ` instead of ${current}-up` : ''}.`),
    el('div', { class: 'actions' }, apply, dismiss));
}

function explainNoFit({ sheet, doc, across, down }, fmt) {
  // across is 0 exactly when the document is wider than the sheet; the gutter only
  // applies between documents, so it never keeps the first one from fitting.
  const lines = [];
  if (across < 1) lines.push(`The document width (${fmt(doc.width)}) is wider than the sheet (${fmt(sheet.width)}).`);
  if (down < 1) lines.push(`The document length (${fmt(doc.length)}) is longer than the sheet (${fmt(sheet.length)}).`);
  lines.push('Turn the document, use a larger sheet, or use a smaller document.');
  return lines.map((text) => el('p', {}, text));
}
