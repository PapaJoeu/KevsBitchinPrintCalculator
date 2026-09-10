import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../js/core/layout.js';

const size = (width, length) => ({ width, length });
const gutter = (columns, rows) => ({ columns, rows });
const EIGHTH = gutter(0.125, 0.125);
const SIXTEENTH = { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 };

test('a smaller count shrinks the block and re-centres it', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { count: { across: 2 } });
  assert.deepEqual([layout.across, layout.down], [2, 8]);
  assert.deepEqual(layout.auto, { across: 3, down: 8 });
  assert.equal(layout.imposed.width, 7.125); // 2 x 3.5 + 1/8
  assert.equal(layout.margins.left, 2.4375); // (12 - 7.125) / 2
  assert.equal(layout.docs.length, 16);
});

test('a larger count that still fits the physical sheet is allowed', () => {
  // With a 1/16" NPA, 13x19 fits 8 rows; 9 rows fill the physical sheet exactly.
  const layout = computeLayout(size(13, 19), size(3.5, 2), EIGHTH, { npa: SIXTEENTH, count: { down: 9 } });
  assert.equal(layout.fits, true);
  assert.equal(layout.down, 9);
  assert.equal(layout.imposed.length, 19);
  assert.deepEqual([layout.margins.top, layout.margins.bottom], [0, 0]);
});

test('a count the physical sheet cannot hold does not fit, and says how big it would be', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { count: { across: 4 } });
  assert.equal(layout.fits, false);
  assert.equal(layout.across, 4);
  assert.equal(layout.imposed.width, 14.375); // 4 x 3.5 + 3 x 1/8, wider than 12
  assert.deepEqual(layout.auto, { across: 3, down: 8 });
});

test('a block larger than the printable region is kept on the sheet, not hung off an edge', () => {
  // printable length 17.5 (bottom NPA 0.5) holds 7 rows at a 1/4" row gutter; 8 rows are 17.75, still within 18.
  const layout = computeLayout(size(12, 18), size(3.5, 2), gutter(0.125, 0.25), {
    npa: { top: 0, bottom: 0.5, left: 0, right: 0 }, count: { down: 8 },
  });
  assert.equal(layout.fits, true);
  assert.equal(layout.imposed.length, 17.75);
  assert.deepEqual([layout.margins.top, layout.margins.bottom], [0, 0.25]); // centring wanted -0.125 at the top
});

test('count overrides must be positive integers; absent means auto', () => {
  assert.throws(() => computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { count: { across: 0 } }), RangeError);
  assert.throws(() => computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { count: { across: 2.5 } }), RangeError);
  assert.equal(computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { count: {} }).across, 3);
  assert.equal(computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { count: { across: undefined } }).across, 3);
});
