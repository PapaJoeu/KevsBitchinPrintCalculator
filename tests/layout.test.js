import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, suggestOrientation } from '../js/core/layout.js';

const size = (width, length) => ({ width, length });
const EIGHTH = size(0.125, 0.125);

test('business card: 3.5x2 on 12x18 with 1/8" gutters is 3 across x 8 down', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH);
  assert.equal(layout.fits, true);
  assert.equal(layout.across, 3);
  assert.equal(layout.down, 8);
  assert.deepEqual(layout.imposed, { width: 10.75, length: 16.875 });
  assert.deepEqual(layout.margins, { left: 0.625, top: 0.5625 });
  assert.equal(layout.docs.length, 24);
});

test('documents are placed row by row from the top-left of the imposed block', () => {
  const { docs } = computeLayout(size(12, 18), size(3.5, 2), EIGHTH);
  assert.deepEqual(docs[0], { x: 0.625, y: 0.5625, width: 3.5, length: 2 });
  assert.deepEqual(docs[1], { x: 4.25, y: 0.5625, width: 3.5, length: 2 }); // next column
  assert.deepEqual(docs[3], { x: 0.625, y: 2.6875, width: 3.5, length: 2 }); // next row
});

test('2-up: 11x8.5 on 12x18 is 1 across x 2 down', () => {
  const layout = computeLayout(size(12, 18), size(11, 8.5), EIGHTH);
  assert.equal(layout.across, 1);
  assert.equal(layout.down, 2);
  assert.deepEqual(layout.imposed, { width: 11, length: 17.125 });
  assert.deepEqual(layout.margins, { left: 0.5, top: 0.4375 });
});

test('orientation is taken as entered: 8.5x11 on 12x18 is 1-up, never rotated to fit 2', () => {
  const layout = computeLayout(size(12, 18), size(8.5, 11), EIGHTH);
  assert.equal(layout.across * layout.down, 1);
});

test('zero gutter fills the sheet exactly with zero margins', () => {
  const layout = computeLayout(size(8.5, 11), size(4.25, 5.5), size(0, 0));
  assert.equal(layout.across, 2);
  assert.equal(layout.down, 2);
  assert.deepEqual(layout.margins, { left: 0, top: 0 });
});

test('an exact fit is not lost to floating point', () => {
  // 0.3 / 0.1 is 2.9999999999999996 in floating point; three still fit.
  const layout = computeLayout(size(0.3, 0.3), size(0.1, 0.1), size(0, 0));
  assert.equal(layout.across, 3);
});

test('reports what does not fit instead of throwing', () => {
  const tooWide = computeLayout(size(12, 18), size(13, 2), EIGHTH);
  assert.equal(tooWide.fits, false);
  assert.equal(tooWide.across, 0);
  assert.equal(tooWide.down, 8);
  const tooLong = computeLayout(size(8.5, 5.5), size(8.5, 11), size(0, 0));
  assert.deepEqual([tooLong.fits, tooLong.across, tooLong.down], [false, 1, 0]);
});

test('rejects impossible dimensions as programmer errors', () => {
  assert.throws(() => computeLayout(size(12, 18), size(0, 2), EIGHTH), RangeError);
  assert.throws(() => computeLayout(size(12, 18), size(3.5, 2), size(-1, 0)), RangeError);
  assert.throws(() => computeLayout(size(NaN, 18), size(3.5, 2), EIGHTH), RangeError);
});

test('suggests turning the document when that fits more', () => {
  // 3.5x2 on 12x18 is 24-up; 2x3.5 on 12x18 is 25-up.
  assert.deepEqual(suggestOrientation(size(12, 18), size(3.5, 2), EIGHTH), { rotate: 'doc', count: 25 });
});

test('suggests nothing when the entered orientation is already best', () => {
  assert.equal(suggestOrientation(size(12, 18), size(2, 3.5), EIGHTH), null);
});

test('prefers turning the document over the sheet on a tie', () => {
  // 8.5x11 on 12x18 is 1-up; either turn gives 2-up.
  assert.deepEqual(suggestOrientation(size(12, 18), size(8.5, 11), EIGHTH), { rotate: 'doc', count: 2 });
});

test('suggests turning the sheet when only that helps', () => {
  // Unequal gutters make the two turns differ: as entered 21-up, doc turned 20-up, sheet turned 25-up.
  assert.deepEqual(suggestOrientation(size(12, 18), size(3.5, 2), size(0.125, 0.5)), { rotate: 'sheet', count: 25 });
});

test('still suggests a turn when nothing fits as entered', () => {
  assert.deepEqual(suggestOrientation(size(8.5, 5.5), size(8.5, 5), size(0, 0)), null);
  assert.deepEqual(suggestOrientation(size(12, 6), size(5, 10), size(0, 0)), { rotate: 'doc', count: 1 });
});
