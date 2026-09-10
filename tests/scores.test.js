import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../js/core/layout.js';
import { computeScores, foldOffsets, DEFAULT_WRAP_ALLOWANCE } from '../js/core/scores.js';

const size = (width, length) => ({ width, length });
const gutter = (columns, rows) => ({ columns, rows });
const EIGHTH = gutter(0.125, 0.125);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const closeAll = (actual, expected) => {
  assert.equal(actual.length, expected.length, `length ${actual.length} != ${expected.length}`);
  actual.forEach((v, i) => close(v, expected[i]));
};
const fold = (overrides) => ({ style: 'none', axis: 'L', allowance: DEFAULT_WRAP_ALLOWANCE, custom: [], ...overrides });

test('bifold scores at the halfway point', () => {
  closeAll(foldOffsets('bifold', 11), [5.5]);
});

test('trifold shortens the tucked panel by the wrap allowance and lengthens the cover', () => {
  const [first, second] = foldOffsets('trifold', 11);
  const panels = [first, second - first, 11 - second];
  closeAll(panels, [3.6041666667, 3.6666666667, 3.7291666667]);
  close(panels.reduce((a, b) => a + b), 11); // the allowance moves length, never adds it
});

test('trifold allowance is adjustable', () => {
  closeAll(foldOffsets('trifold', 11, 0.125), [11 / 3 - 0.125, 22 / 3 - 0.125]);
});

test('z-fold scores at equal thirds', () => {
  closeAll(foldOffsets('zfold', 11), [11 / 3, 22 / 3]);
});

test('no fold, no offsets; unknown styles are rejected', () => {
  assert.deepEqual(foldOffsets('none', 11), []);
  assert.throws(() => foldOffsets('gatefold', 11), RangeError);
});

test('scores land on each document in sheet coordinates', () => {
  const layout = computeLayout(size(12, 18), size(11, 8.5), EIGHTH); // 1 across x 2 down
  const { offsets, positions, segments } = computeScores(layout, fold({ style: 'bifold' }));
  closeAll(offsets, [4.25]);
  closeAll(positions, [4.6875, 13.3125]); // 0.4375 top margin + 4.25, then + 8.625 pitch
  assert.equal(segments.length, 2);
  assert.deepEqual(segments[0], { docIndex: 0, x1: 0.5, y1: 4.6875, x2: 11.5, y2: 4.6875 });
});

test('folding across the width draws vertical scores measured from the left edge', () => {
  const layout = computeLayout(size(12, 18), size(11, 8.5), EIGHTH);
  const { positions, segments } = computeScores(layout, fold({ style: 'bifold', axis: 'W' }));
  closeAll(positions, [6]); // 0.5 left margin + 5.5
  assert.deepEqual(segments[0], { docIndex: 0, x1: 6, y1: 0.4375, x2: 6, y2: 8.9375 });
});

test('positions are deduplicated across a row; segments are not', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH); // 3 across x 8 down
  const bifold = computeScores(layout, fold({ style: 'bifold' }));
  assert.equal(bifold.positions.length, 8);
  assert.equal(bifold.segments.length, 24);
  const trifold = computeScores(layout, fold({ style: 'trifold' }));
  assert.equal(trifold.segments.length, 48);
});

test('custom offsets are measurements, combine with a style, and are deduplicated', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH);
  closeAll(computeScores(layout, fold({ custom: [1.5, 0.5] })).offsets, [0.5, 1.5]);
  closeAll(computeScores(layout, fold({ style: 'bifold', custom: [0.5, 1] })).offsets, [0.5, 1]);
});

test('offsets outside the document are ignored', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH);
  assert.deepEqual(computeScores(layout, fold({ custom: [0, 2, 2.5] })).offsets, []);
});

test('refuses a layout that does not fit', () => {
  const layout = computeLayout(size(12, 18), size(13, 2), EIGHTH);
  assert.throws(() => computeScores(layout, fold({ style: 'bifold' })), RangeError);
});
