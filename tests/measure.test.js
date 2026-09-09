import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMeasurement, inchesToMm, mmToInches } from '../js/core/measure.js';

test('parses decimals as written on the floor', () => {
  assert.equal(parseMeasurement('3.5'), 3.5);
  assert.equal(parseMeasurement('.125'), 0.125);
  assert.equal(parseMeasurement('12'), 12);
  assert.equal(parseMeasurement('3.'), 3);
  assert.equal(parseMeasurement('  17.438 '), 17.438);
});

test('parses fractions and mixed numbers', () => {
  assert.equal(parseMeasurement('1/8'), 0.125);
  assert.equal(parseMeasurement('3 1/2'), 3.5);
  assert.equal(parseMeasurement('3-1/2'), 3.5);
  assert.equal(parseMeasurement('12 3/16'), 12.1875);
});

test('rejects text that is not a measurement', () => {
  for (const bad of ['', '   ', 'abc', '-3', '1/0', '3 abc', '3.5 1/2', '1/2 3', '3//4']) {
    assert.equal(parseMeasurement(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
  assert.equal(parseMeasurement(undefined), null);
  assert.equal(parseMeasurement(3.5), null);
});

test('converts between inches and millimetres', () => {
  assert.equal(inchesToMm(1), 25.4);
  assert.equal(mmToInches(25.4), 1);
  assert.equal(inchesToMm(12), 304.8);
});
