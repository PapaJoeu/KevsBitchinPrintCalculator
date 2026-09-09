import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../js/core/layout.js';
import { computeSequence } from '../js/core/sequence.js';

const size = (width, length) => ({ width, length });
const EIGHTH = size(0.125, 0.125);
const cuts = (steps) => steps.map((s) => [s.axis, s.position]);

// User-verified by hand. See spec "Verified fixtures". Do not edit these numbers.
const TWO_UP = [
  ['L', 17.5625], ['W', 11.5], ['L', 17.125], ['W', 11], ['L', 8.5], ['L', 8.5],
];
const BUSINESS_CARD = [
  ['L', 17.4375], ['W', 11.375], ['L', 16.875], ['W', 10.75],
  ['W', 7.125], ['W', 3.5], ['W', 3.5], ['W', 3.5],
  ['L', 14.75], ['L', 12.625], ['L', 10.5], ['L', 8.375], ['L', 6.25], ['L', 4.125], ['L', 2],
  ['L', 2], ['L', 2], ['L', 2], ['L', 2], ['L', 2], ['L', 2], ['L', 2],
];

test('2-up fixture: 11x8.5 on 12x18 with 1/8" gutters', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(11, 8.5), EIGHTH));
  assert.deepEqual(cuts(steps), TWO_UP);
});

test('business card fixture: 3.5x2 on 12x18 with 1/8" gutters', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH));
  assert.deepEqual(cuts(steps), BUSINESS_CARD);
});

test('an axis with n documents ends with n cuts at the document dimension', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH));
  const at = (axis, position) => steps.filter((s) => s.axis === axis && s.position === position).length;
  assert.equal(at('L', 2), 8); // 8 rows
  assert.equal(at('W', 3.5), 3); // 3 columns
});

test('kinds run square, block, then ladder and trim per axis', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH));
  const kinds = steps.map((s) => s.kind);
  assert.deepEqual(kinds.slice(0, 4), ['square', 'square', 'block', 'block']);
  assert.deepEqual(kinds.slice(4, 8), ['ladder', 'ladder', 'trim', 'trim']);
  assert.deepEqual(kinds.slice(8, 15), Array(7).fill('ladder'));
  assert.deepEqual(kinds.slice(15), Array(7).fill('trim'));
});

test('steps are numbered from 1 and flag a turn whenever the axis changes', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(11, 8.5), EIGHTH));
  assert.deepEqual(steps.map((s) => s.n), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(steps.map((s) => s.turnBefore), [false, true, true, true, true, false]);
});

test('every cut is its own step; identical cuts are never collapsed', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH));
  assert.equal(steps.length, 22);
  assert.equal(new Set(steps.map((s) => s.n)).size, 22);
});

test('axis order follows the sheet as entered: an 18x12 sheet starts from the 12" side', () => {
  const steps = computeSequence(computeLayout(size(18, 12), size(3.5, 2), EIGHTH));
  assert.deepEqual([steps[0].axis, steps[0].position], ['L', 11.25]); // 12 - 0.75 top margin
  assert.deepEqual([steps[1].axis, steps[1].position], ['W', 18]); // 18 - 0 left margin
});

test('a single-document axis gets no gutter trim', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(11, 8.5), EIGHTH));
  assert.equal(steps.filter((s) => s.axis === 'W' && s.kind === 'trim').length, 0);
});

test('a zero gutter needs no trims: the ladder alone separates the pieces', () => {
  const steps = computeSequence(computeLayout(size(8.5, 11), size(4.25, 5.5), size(0, 0)));
  assert.deepEqual(cuts(steps), [['L', 11], ['W', 8.5], ['L', 11], ['W', 8.5], ['W', 4.25], ['L', 5.5]]);
});

test('each axis uses its own gutter: a 1/4" side gutter with no gutter between rows', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), size(0.25, 0)));
  // 3 columns separated by a 1/4" gutter need trims; 9 rows with no gutter need none.
  assert.equal(steps.filter((s) => s.axis === 'W' && s.kind === 'trim').length, 2);
  assert.equal(steps.filter((s) => s.axis === 'L' && s.kind === 'trim').length, 0);
  assert.deepEqual(cuts(steps).slice(4, 8), [['W', 7.25], ['W', 3.5], ['W', 3.5], ['W', 3.5]]);
});

test('refuses a layout that does not fit', () => {
  assert.throws(() => computeSequence(computeLayout(size(12, 18), size(13, 2), EIGHTH)), RangeError);
});
