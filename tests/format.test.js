import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMeasure, formatShort, unitName, stepNote, formatFraction } from '../js/ui/format.js';

test('formats inches to three places and millimetres to one', () => {
  assert.equal(formatMeasure(17.5625, 'in'), '17.563');
  assert.equal(formatMeasure(2, 'in'), '2.000');
  assert.equal(formatMeasure(1, 'mm'), '25.4');
  assert.equal(formatMeasure(17.5625, 'mm'), '446.1');
});

test('short format drops trailing zeros but never significant ones', () => {
  assert.equal(formatShort(12, 'in'), '12');
  assert.equal(formatShort(10.75, 'in'), '10.75');
  assert.equal(formatShort(0.125, 'in'), '0.125');
  assert.equal(formatShort(100, 'in'), '100');
  assert.equal(formatShort(304.8 / 25.4, 'mm'), '304.8');
});

test('names units', () => {
  assert.equal(unitName('in'), 'inches');
  assert.equal(unitName('mm'), 'millimetres');
});

test('describes each kind of step by what it removes', () => {
  const step = (kind, extra = {}) => ({ n: 1, axis: 'L', position: 0, kind, turnBefore: false, ...extra });
  assert.equal(stepNote(step('margin', { edge: 'top' })), 'Trim top margin');
  assert.equal(stepNote(step('margin', { edge: 'left' })), 'Trim left margin');
  assert.equal(stepNote(step('margin', { edge: 'bottom' })), 'Trim bottom margin');
  assert.equal(stepNote(step('margin', { edge: 'right' })), 'Trim right margin');
  assert.equal(stepNote(step('strip')), 'Cut off next strip');
  assert.equal(stepNote(step('gutter')), 'Trim gutter');
});

test('renders sixteenths as fractions for inch labels', () => {
  assert.equal(formatFraction(0.0625), '1/16');
  assert.equal(formatFraction(0.125), '1/8');
  assert.equal(formatFraction(0.75), '3/4');
  assert.equal(formatFraction(1.5), '1 1/2');
  assert.equal(formatFraction(2), '2');
  assert.equal(formatFraction(0), '0');
  assert.equal(formatFraction(0.1), '0.1'); // not a sixteenth: as typed
});
