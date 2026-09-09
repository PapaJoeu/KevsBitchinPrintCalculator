// sequence.js — the guillotine program sequence for a layout. Pure; all values in inches.
//
// The cutting model (spec "The cutting model"): square the sheet, then work one axis
// at a time, turning the stack whenever the axis changes. Each axis is a ladder of
// (doc + gutter) steps that peels off one strip per cut, followed by gutter trims at
// the document dimension. The final ladder rung lands on the document dimension and
// is the first trim, so an axis with n documents ends with n cuts at that dimension.
// Every cut is its own step: the list is keyed into the cutter one step at a time.

/**
 * @param layout  result of computeLayout with fits: true
 * @returns {Array<{ n, axis: 'L'|'W', position, kind: 'square'|'block'|'ladder'|'trim', turnBefore }>}
 *   Backgauge positions in the order they are keyed in. 'L' cuts run along the sheet
 *   length (the second dimension entered), 'W' along the width. turnBefore is true
 *   when the stack is turned 90° before this cut.
 */
export function computeSequence(layout) {
  if (!layout.fits) throw new RangeError('computeSequence needs a layout that fits');
  const { sheet, doc, gutter, imposed, margins, across, down } = layout;
  const steps = [];
  const cut = (axis, position, kind) => {
    const previous = steps.at(-1);
    steps.push({
      n: steps.length + 1,
      axis,
      position,
      kind,
      turnBefore: previous !== undefined && previous.axis !== axis,
    });
  };

  cut('L', sheet.length - margins.top, 'square');
  cut('W', sheet.width - margins.left, 'square');
  cut('L', imposed.length, 'block');
  cut('W', imposed.width, 'block');
  cutAxis(cut, 'W', imposed.width, doc.width, gutter.width, across);
  cutAxis(cut, 'L', imposed.length, doc.length, gutter.length, down);
  return steps;
}

function cutAxis(cut, axis, imposedSize, docSize, gutterSize, count) {
  for (let i = 1; i < count; i++) cut(axis, imposedSize - i * (docSize + gutterSize), 'ladder');
  if (gutterSize === 0) return; // nothing between the pieces to trim off
  for (let k = 2; k <= count; k++) cut(axis, docSize, 'trim');
}
