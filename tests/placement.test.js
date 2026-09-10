import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, placeBlock, findViolations } from '../js/core/layout.js';

const size = (width, length) => ({ width, length });
const gutter = (columns, rows) => ({ columns, rows });
const EIGHTH = gutter(0.125, 0.125);
const SIXTEENTH = { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 };
const card = (options) => computeLayout(size(12, 18), size(3.5, 2), EIGHTH, options);

test('an edge with an offset takes that margin; the far edge takes the slack', () => {
  const layout = card({ align: { top: 0.5 } });
  assert.deepEqual(layout.margins, { top: 0.5, bottom: 0.625, left: 0.625, right: 0.625 }); // 18 - 0.5 - 16.875
  assert.equal(layout.docs[0].y, 0.5);
});

test('a flush corner has zero margins on both chosen edges', () => {
  assert.deepEqual(card({ align: { top: 0, left: 0 } }).margins, { top: 0, bottom: 1.125, left: 0, right: 1.25 });
});

test('bottom and right offsets measure from those edges', () => {
  assert.deepEqual(card({ align: { bottom: 0.25, right: 0.5 } }).margins, { top: 0.875, bottom: 0.25, left: 0.75, right: 0.5 });
});

test('an offset that pushes the block off the sheet does not fit', () => {
  assert.equal(card({ align: { top: 2 } }).fits, false); // 2 + 16.875 > 18
  assert.equal(card({ align: { bottom: 2 } }).fits, false);
  assert.equal(card({ align: { top: 1.125 } }).fits, true); // exactly fills: bottom margin 0
});

test('choosing both edges of one axis, or a negative offset, is a programmer error', () => {
  assert.throws(() => card({ align: { top: 0, bottom: 0 } }), RangeError);
  assert.throws(() => card({ align: { left: 0, right: 0 } }), RangeError);
  assert.throws(() => card({ align: { left: -1 } }), RangeError);
});

test('auto placement never violates the non-printable area', () => {
  const layout = computeLayout(size(13, 19), size(3.5, 2), EIGHTH, { npa: SIXTEENTH });
  assert.deepEqual(layout.violations, []);
});

test('an offset inside the non-printable area is reported, not corrected', () => {
  const layout = card({ npa: SIXTEENTH, align: { top: 0 } });
  assert.equal(layout.fits, true);
  assert.equal(layout.margins.top, 0); // honoured exactly as entered
  assert.deepEqual(layout.violations, [{ edge: 'top', amount: 0.0625 }]);
});

test('a count override past the printable region reports both edges', () => {
  const layout = computeLayout(size(13, 19), size(3.5, 2), EIGHTH, { npa: SIXTEENTH, count: { down: 9 } });
  assert.deepEqual(layout.violations, [{ edge: 'top', amount: 0.0625 }, { edge: 'bottom', amount: 0.0625 }]);
});

test('placeBlock and findViolations are usable on their own', () => {
  const margins = placeBlock(size(12, 18), size(12, 18), { top: 0, bottom: 0, left: 0, right: 0 }, size(10.75, 16.875), { left: 0.25 });
  assert.deepEqual(margins, { top: 0.5625, bottom: 0.5625, left: 0.25, right: 1 });
  assert.deepEqual(findViolations({ top: 0, bottom: 1, left: 0.03, right: 1 }, SIXTEENTH),
    [{ edge: 'top', amount: 0.0625 }, { edge: 'left', amount: 0.0325 }]);
});

test('the FLUSH_TOP layout: top flush with a zero top NPA, centred horizontally', () => {
  const npa = { top: 0, bottom: 0.0625, left: 0.0625, right: 0.0625 };
  const layout = card({ npa, align: { top: 0 } });
  assert.deepEqual([layout.across, layout.down], [3, 8]);
  assert.deepEqual(layout.margins, { top: 0, bottom: 1.125, left: 0.625, right: 0.625 });
  assert.deepEqual(layout.violations, []);
});
