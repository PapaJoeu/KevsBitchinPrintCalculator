import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitSheet, canLabel } from '../js/ui/visualizer.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('fits a portrait sheet by height and centres it', () => {
  // 12x18 in 300x400 with 18px pad: scale = min(264/12, 364/18) = 364/18
  const { scale, x, y } = fitSheet(300, 400, { width: 12, length: 18 }, 18);
  close(scale, 364 / 18);
  close(x, (300 - 12 * scale) / 2);
  close(y, 18);
});

test('fits a landscape sheet by width', () => {
  const { scale, y } = fitSheet(300, 400, { width: 18, length: 12 }, 18);
  close(scale, 264 / 18);
  close(y, (400 - 12 * scale) / 2);
});

test('labels only documents big enough to read', () => {
  assert.equal(canLabel(59, 34), true); // a business card on 12x18 at phone size
  assert.equal(canLabel(26, 15), false); // the same card on a 26x40 sheet
  assert.equal(canLabel(25, 20), false);
  assert.equal(canLabel(40, 15), false);
});
