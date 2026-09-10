import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../js/core/layout.js';
import { computeSequence } from '../js/core/sequence.js';

const size = (width, length) => ({ width, length });
const gutter = (columns, rows) => ({ columns, rows });
const EIGHTH = gutter(0.125, 0.125);
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
// Business card 3.5x2 on 12x18, 1/8" gutters, NPA 1/16" except top = 0, aligned top
// with offset 0, centred horizontally. The business card with its first cut removed.
const FLUSH_TOP = [
  ['W', 11.375], ['L', 16.875], ['W', 10.75],
  ['W', 7.125], ['W', 3.5], ['W', 3.5], ['W', 3.5],
  ['L', 14.75], ['L', 12.625], ['L', 10.5], ['L', 8.375], ['L', 6.25], ['L', 4.125], ['L', 2],
  ['L', 2], ['L', 2], ['L', 2], ['L', 2], ['L', 2], ['L', 2], ['L', 2],
];
const flushTop = () => computeLayout(size(12, 18), size(3.5, 2), EIGHTH, {
  npa: { top: 0, bottom: 0.0625, left: 0.0625, right: 0.0625 },
  align: { top: 0 },
});

test('2-up fixture: 11x8.5 on 12x18 with 1/8" gutters', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(11, 8.5), EIGHTH));
  assert.deepEqual(cuts(steps), TWO_UP);
});

test('business card fixture: 3.5x2 on 12x18 with 1/8" gutters', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH));
  assert.deepEqual(cuts(steps), BUSINESS_CARD);
});

test('FLUSH_TOP fixture: a block flush to the head gets no head cut', () => {
  const steps = computeSequence(flushTop());
  assert.deepEqual(cuts(steps), FLUSH_TOP);
  assert.equal(steps.length, 21);
  assert.deepEqual(steps.filter((s) => s.turnBefore).map((s) => s.n), [2, 3, 8]);
  assert.deepEqual(steps.slice(0, 3).map((s) => s.edge), ['left', 'bottom', 'right']);
});

test('the 8 cuts at the document length survive the missing head cut', () => {
  const steps = computeSequence(flushTop());
  assert.equal(steps.filter((s) => s.axis === 'L' && s.position === 2).length, 8);
});

test('an exact fit on one axis gets no margin cuts on that axis', () => {
  // 13x19 with no NPA: 9 rows run edge to edge, so only the side margins are cut.
  const steps = computeSequence(computeLayout(size(13, 19), size(3.5, 2), EIGHTH));
  const margins = steps.filter((s) => s.kind === 'margin');
  assert.deepEqual(margins.map((s) => [s.axis, s.edge, s.position]), [['W', 'left', 11.875], ['W', 'right', 10.75]]);
  assert.equal(steps.length, 22); // 2 margins + (2 strips + 2 gutters) + (8 strips + 8 gutters)
  assert.equal(steps[1].turnBefore, false); // two W cuts in a row: no turn between them
});

test('a flush corner leaves two margin cuts', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { align: { top: 0, left: 0 } }));
  assert.deepEqual(steps.filter((s) => s.kind === 'margin').map((s) => [s.axis, s.edge]), [['L', 'bottom'], ['W', 'right']]);
});

test('an axis with n documents ends with n cuts at the document dimension', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH));
  const at = (axis, position) => steps.filter((s) => s.axis === axis && s.position === position).length;
  assert.equal(at('L', 2), 8); // 8 rows
  assert.equal(at('W', 3.5), 3); // 3 columns
});

test('kinds name what each cut removes: four margins, then strips and gutters per axis', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), EIGHTH));
  assert.deepEqual(steps.slice(0, 4).map((s) => [s.kind, s.edge]),
    [['margin', 'top'], ['margin', 'left'], ['margin', 'bottom'], ['margin', 'right']]);
  assert.deepEqual(steps.slice(4, 8).map((s) => s.kind), ['strip', 'strip', 'gutter', 'gutter']);
  assert.deepEqual(steps.slice(8, 15).map((s) => s.kind), Array(7).fill('strip'));
  assert.deepEqual(steps.slice(15).map((s) => s.kind), Array(7).fill('gutter'));
  assert.ok(steps.slice(4).every((s) => !('edge' in s)), 'only margin cuts carry an edge');
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
  // 5 columns fill the 18" width exactly, so the side margins are zero and get no cut;
  // the next cut is the bottom margin.
  assert.deepEqual([steps[1].axis, steps[1].position], ['L', 10.5]);
});

test('a single-document axis gets no gutter trim', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(11, 8.5), EIGHTH));
  assert.equal(steps.filter((s) => s.axis === 'W' && s.kind === 'gutter').length, 0);
});

test('an exact fit with no gutter needs only the strip cuts', () => {
  // 4.25x5.5 fills 8.5x11 exactly: every margin is zero, so no margin cut exists.
  const steps = computeSequence(computeLayout(size(8.5, 11), size(4.25, 5.5), gutter(0, 0)));
  assert.deepEqual(cuts(steps), [['W', 4.25], ['L', 5.5]]);
});

test('each axis uses its own gutter: a 1/4" side gutter with no gutter between rows', () => {
  const steps = computeSequence(computeLayout(size(12, 18), size(3.5, 2), gutter(0.25, 0)));
  // 9 rows fill the 18" length exactly, so the top and bottom margins are zero and get no cut.
  // 3 columns separated by a 1/4" gutter need trims; 9 rows with no gutter need none.
  assert.equal(steps.filter((s) => s.axis === 'W' && s.kind === 'gutter').length, 2);
  assert.equal(steps.filter((s) => s.axis === 'L' && s.kind === 'gutter').length, 0);
  assert.deepEqual(cuts(steps).slice(2, 6), [['W', 7.25], ['W', 3.5], ['W', 3.5], ['W', 3.5]]);
});

test('refuses a layout that does not fit', () => {
  assert.throws(() => computeSequence(computeLayout(size(12, 18), size(13, 2), EIGHTH)), RangeError);
});
