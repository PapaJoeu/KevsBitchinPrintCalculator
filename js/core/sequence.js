// sequence.js — the guillotine program sequence for a layout. Pure; all values in inches.
//
// The cutting model (spec "The cutting model"): square the sheet, then work one axis
// at a time, turning the stack whenever the axis changes. Each axis is a run of
// strip cuts (doc + gutter) apart, followed by gutter trims. The final strip cut
// lands on the document dimension and is the first gutter trim, so an axis with n documents
// ends with n cuts at that dimension. Every cut is its own step: the list is keyed
// into the cutter one step at a time.

/**
 * @param layout  result of computeLayout with fits: true
 * @returns {Array<{ n, axis: 'L'|'W', position, kind: 'margin'|'strip'|'gutter', edge?, turnBefore }>}
 *   Backgauge positions in the order they are keyed in. 'L' cuts run along the sheet
 *   length (the second dimension entered), 'W' along the width. Each kind names what
 *   the cut removes; margin cuts also carry the edge ('top'|'left'|'bottom'|'right').
 *   turnBefore is true when the stack is turned 90° before this cut.
 */
export function computeSequence(layout) {
  if (!layout.fits) throw new RangeError('computeSequence needs a layout that fits');
  const { sheet, doc, gutter, imposed, margins, across, down } = layout;
  const steps = [];
  const cut = (axis, position, kind, edge) => {
    const previous = steps.at(-1);
    steps.push({
      n: steps.length + 1,
      axis,
      position,
      kind,
      ...(edge ? { edge } : {}),
      turnBefore: previous !== undefined && previous.axis !== axis,
    });
  };

  cut('L', sheet.length - margins.top, 'margin', 'top');
  cut('W', sheet.width - margins.left, 'margin', 'left');
  cut('L', imposed.length, 'margin', 'bottom');
  cut('W', imposed.width, 'margin', 'right');
  cutAxis(cut, 'W', imposed.width, doc.width, gutter.columns, across);
  cutAxis(cut, 'L', imposed.length, doc.length, gutter.rows, down);
  return steps;
}

// Per axis: n-1 strips, each (doc + gutter) narrower than the last, then gutter trims
// at the document dimension for k = 2..n. The last strip cut already lands on the
// document dimension and is the first gutter trim — hence k starts at 2, not 1.
function cutAxis(cut, axis, imposedSize, docSize, gutterSize, count) {
  for (let i = 1; i < count; i++) cut(axis, imposedSize - i * (docSize + gutterSize), 'strip');
  if (gutterSize === 0) return; // nothing between the pieces to trim off
  for (let k = 2; k <= count; k++) cut(axis, docSize, 'gutter');
}
