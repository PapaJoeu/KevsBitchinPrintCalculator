// summaryView.js — the n-up line, printable/imposed/margin details, the no-fit
// explanation, NPA-violation warnings with their fixes, and the orientation hint.
// A warning never blanks the sequence: the worker may be right and the tool wrong.
import { el } from './dom.js';
import { formatMeasure, formatShort } from './format.js';

const VERTICAL = ['top', 'bottom'];
const HORIZONTAL = ['left', 'right'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const hasNpa = (npa) => Object.values(npa).some((v) => v > 0);

function button(text, onClick) {
  const b = el('button', { type: 'button' }, text);
  b.addEventListener('click', onClick);
  return b;
}

/**
 * @param result   { layout, steps, suggestion }
 * @param options  { unit, job, hintDismissed, onApply(rotate), onDismiss(), onFix(action) }
 *   job is the entered job (current unit): it tells an offset cause from a count cause.
 *   onFix actions carry inches: { fix: 'offset', edge, inches } · { fix: 'npa', values }
 *   · { fix: 'count', axis }.
 */
export function renderSummary(container, { layout, steps, suggestion }, { unit, job, hintDismissed, onApply, onDismiss, onFix }) {
  const fmt = (inches) => `${formatMeasure(inches, unit)} ${unit}`;
  const short = (inches) => `${formatShort(inches, unit)} ${unit}`;
  const children = [];
  if (!layout.fits) {
    children.push(el('div', { class: 'nup' }, 'Does not fit'), el('div', { class: 'panel warning' }, ...explainNoFit(layout, job, fmt, onFix)));
  } else {
    const count = layout.across * layout.down;
    const autoCount = layout.auto.across * layout.auto.down;
    children.push(
      el('div', { class: 'nup' }, `${count}-up${count !== autoCount ? ` (auto would be ${autoCount})` : ''}`),
      el('p', { class: 'detail lead' }, `${layout.across} across × ${layout.down} down · ${steps.length} cuts`),
    );
    if (hasNpa(layout.npa)) children.push(el('p', { class: 'detail' }, `Printable ${fmt(layout.printable.width)} × ${fmt(layout.printable.length)}`));
    const m = layout.margins;
    children.push(el('p', { class: 'detail' },
      `Imposed ${fmt(layout.imposed.width)} × ${fmt(layout.imposed.length)} · margins ${short(m.top)} head · ${short(m.bottom)} foot · ${short(m.left)} left · ${short(m.right)} right`));
    for (const pair of [VERTICAL, HORIZONTAL]) {
      const panel = violationPanel(layout, job, pair, { short, onFix });
      if (panel) children.push(panel);
    }
  }
  if (suggestion && !hintDismissed) children.push(hintBox(suggestion, layout, { onApply, onDismiss }));
  container.replaceChildren(...children);
}

// One panel per axis with a violation. The first fix trusts the NPA and moves the
// block (or restores the auto count); the second trusts the placement and shrinks
// the NPA to what is actually there.
function violationPanel(layout, job, pair, { short, onFix }) {
  const hits = layout.violations.filter((v) => pair.includes(v.edge));
  if (hits.length === 0) return null;
  const edges = hits.map((v) => v.edge);
  const axis = pair === VERTICAL ? 'down' : 'across';
  const unitName = pair === VERTICAL ? 'row' : 'column';
  const where = edges.length === 1 ? `${cap(edges[0])} ${unitName} sits` : `${cap(edges[0])} and ${edges[1]} ${unitName}s sit`;
  const amount = Math.max(...hits.map((v) => v.amount));
  const message = `${where} ${short(amount)} inside the non-printable area.`;

  const offsetEdge = pair.find((edge) => edge in job.align);
  const first = offsetEdge !== undefined
    ? button(`Offset → ${short(layout.npa[offsetEdge])}`, () => onFix({ fix: 'offset', edge: offsetEdge, inches: layout.npa[offsetEdge] }))
    : button(`Back to auto (${layout.auto[axis]} ${axis})`, () => onFix({ fix: 'count', axis }));
  const values = Object.fromEntries(edges.map((edge) => [edge, layout.margins[edge]]));
  // Name every value the fix actually applies: two violating edges can have different
  // margins, and a label promising one number while setting another is a silent correction.
  const label = edges.length === 1 || values[edges[0]] === values[edges[1]]
    ? `NPA ${edges.join(' & ')} → ${short(values[edges[0]])}`
    : `NPA ${edges.map((edge) => `${edge} → ${short(values[edge])}`).join(' & ')}`;
  const second = button(label, () => onFix({ fix: 'npa', values }));
  return el('div', { class: 'panel warning' }, el('p', {}, message), el('div', { class: 'actions' }, first, second));
}

function explainNoFit(layout, job, fmt, onFix) {
  const { sheet, doc, gutter, across, down, auto, imposed, margins } = layout;
  const parts = [];
  // A count the physical sheet cannot hold — but only where auto could hold at least one.
  // When auto is 0 the document itself is too big for the printable region and the count
  // is merely masking that, so "back to auto" would fix nothing: fall through and say so.
  const wideOverflow = imposed && imposed.width > sheet.width && auto.across >= 1;
  const longOverflow = imposed && imposed.length > sheet.length && auto.down >= 1;
  if (wideOverflow || longOverflow) {
    if (wideOverflow) {
      parts.push(el('p', {}, `${across} across won't fit: ${across} × ${fmt(doc.width)} + ${across - 1} × ${fmt(gutter.columns)} = ${fmt(imposed.width)}, sheet is ${fmt(sheet.width)}.`),
        el('div', { class: 'actions' }, button(`Back to auto (${auto.across} across)`, () => onFix({ fix: 'count', axis: 'across' }))));
    }
    if (longOverflow) {
      parts.push(el('p', {}, `${down} down won't fit: ${down} × ${fmt(doc.length)} + ${down - 1} × ${fmt(gutter.rows)} = ${fmt(imposed.length)}, sheet is ${fmt(sheet.length)}.`),
        el('div', { class: 'actions' }, button(`Back to auto (${auto.down} down)`, () => onFix({ fix: 'count', axis: 'down' }))));
    }
  } else if (margins) {
    // An offset pushed the block off the far edge.
    for (const pair of [VERTICAL, HORIZONTAL]) {
      const chosen = pair.find((edge) => edge in job.align);
      const far = pair.find((edge) => edge !== chosen);
      if (chosen !== undefined && margins[far] < 0) {
        // The chosen edge's margin is the offset itself, already in inches.
        parts.push(el('p', {}, `An offset of ${fmt(margins[chosen])} from the ${chosen} pushes the block ${fmt(-margins[far])} past the ${far} edge.`),
          el('div', { class: 'actions' }, button('Offset → 0', () => onFix({ fix: 'offset', edge: chosen, inches: 0 }))));
      }
    }
  } else {
    // The document itself is bigger than the printable region. The gutter only sits
    // between documents, so it never keeps the first one from fitting.
    if (across < 1) parts.push(el('p', {}, `The document width (${fmt(doc.width)}) is wider than the printable width (${fmt(layout.printable.width)}).`));
    if (down < 1) parts.push(el('p', {}, `The document length (${fmt(doc.length)}) is longer than the printable length (${fmt(layout.printable.length)}).`));
    parts.push(el('p', {}, 'Turn the document, use a larger sheet, or reduce the non-printable area.'));
  }
  return parts;
}

// The tool reports what the sheet as entered does; a better turn is offered, never applied.
function hintBox(suggestion, layout, { onApply, onDismiss }) {
  const what = suggestion.rotate === 'doc' ? 'document' : 'sheet';
  const current = layout.fits ? layout.across * layout.down : 0;
  return el('div', { class: 'panel hint-box' },
    el('p', {}, `Turning the ${what} fits ${suggestion.count}-up${current > 0 ? ` instead of ${current}-up` : ''}.`),
    el('div', { class: 'actions' },
      button(`Turn ${what}`, () => onApply(suggestion.rotate)),
      button('Keep as entered', onDismiss)));
}
