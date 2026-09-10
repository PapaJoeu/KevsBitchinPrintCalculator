import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, printableRegion, fitCount } from '../js/core/layout.js';

const size = (width, length) => ({ width, length });
const gutter = (columns, rows) => ({ columns, rows });
const EIGHTH = gutter(0.125, 0.125);
const SIXTEENTH = { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 };

test('the printable region is the sheet inset by each edge', () => {
  assert.deepEqual(printableRegion(size(13, 19), SIXTEENTH), { width: 12.875, length: 18.875 });
  assert.deepEqual(printableRegion(size(13, 19), { top: 0.5, bottom: 0.0625, left: 0, right: 0 }), { width: 13, length: 18.4375 });
  assert.deepEqual(printableRegion(size(13, 19)), { width: 13, length: 19 });
});

test('fit count uses the region it is given', () => {
  assert.deepEqual(fitCount(size(13, 19), size(3.5, 2), EIGHTH), { across: 3, down: 9 });
  assert.deepEqual(fitCount(printableRegion(size(13, 19), SIXTEENTH), size(3.5, 2), EIGHTH), { across: 3, down: 8 });
});

test('the business card on 13x19 drops from 9 rows to 8 with a 1/16" non-printable area', () => {
  const bare = computeLayout(size(13, 19), size(3.5, 2), EIGHTH);
  assert.deepEqual([bare.across, bare.down], [3, 9]);
  assert.deepEqual(bare.margins, { top: 0, bottom: 0, left: 1.125, right: 1.125 }); // rows run edge to edge
  const withNpa = computeLayout(size(13, 19), size(3.5, 2), EIGHTH, { npa: SIXTEENTH });
  assert.deepEqual([withNpa.across, withNpa.down], [3, 8]);
  assert.deepEqual(withNpa.printable, { width: 12.875, length: 18.875 });
  assert.deepEqual(withNpa.margins, { top: 1.0625, bottom: 1.0625, left: 1.125, right: 1.125 });
  assert.deepEqual(withNpa.npa, SIXTEENTH);
});

test('with an asymmetric non-printable area the block centres within the printable region, not the sheet', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { npa: { top: 0.5, bottom: 0, left: 0, right: 0 } });
  // printable length 17.5 still holds 8 rows (16.875); the 0.625 of slack splits 0.3125 each side of the block
  assert.deepEqual([layout.across, layout.down], [3, 8]);
  assert.deepEqual(layout.margins, { top: 0.8125, bottom: 0.3125, left: 0.625, right: 0.625 });
  assert.equal(layout.docs[0].y, 0.8125);
});

test('defaults keep the verified layouts identical: no non-printable area, centred', () => {
  const plain = computeLayout(size(12, 18), size(3.5, 2), EIGHTH);
  assert.deepEqual(plain.printable, { width: 12, length: 18 });
  assert.deepEqual(plain.auto, { across: 3, down: 8 });
  assert.deepEqual(plain.margins, { top: 0.5625, bottom: 0.5625, left: 0.625, right: 0.625 });
});

test('a non-printable area larger than the sheet fits nothing rather than going negative', () => {
  const layout = computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { npa: { top: 10, bottom: 10, left: 0, right: 0 } });
  assert.equal(layout.fits, false);
  assert.equal(layout.down, 0);
});

test('a negative non-printable area is a programmer error', () => {
  assert.throws(() => computeLayout(size(12, 18), size(3.5, 2), EIGHTH, { npa: { top: -1, bottom: 0, left: 0, right: 0 } }), RangeError);
});
