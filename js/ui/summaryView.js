// summaryView.js — the n-up line, imposed-block details, the no-fit explanation,
// and (Task 12) the better-orientation hint.
import { el } from './dom.js';
import { formatLength } from './format.js';

/**
 * @param result    { layout, steps, suggestion }
 * @param options   { unit, hintDismissed, onApply(rotate), onDismiss() }
 */
export function renderSummary(container, { layout, steps }, { unit }) {
  const fmt = (inches) => `${formatLength(inches, unit)} ${unit}`;
  if (!layout.fits) {
    container.replaceChildren(
      el('div', { class: 'nup' }, 'Does not fit'),
      el('div', { class: 'panel warning' }, ...explainNoFit(layout, fmt)),
    );
    return;
  }
  container.replaceChildren(
    el('div', { class: 'nup' }, `${layout.across * layout.down}-up`),
    el('p', { class: 'detail' }, `${layout.across} across × ${layout.down} down · ${steps.length} cuts`),
    el('p', { class: 'detail' },
      `Imposed ${fmt(layout.imposed.width)} × ${fmt(layout.imposed.length)} · margins ${fmt(layout.margins.left)} side, ${fmt(layout.margins.top)} head`),
  );
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
