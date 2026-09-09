import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLength, formatShort, unitName, stepNote } from '../js/ui/format.js';

test('formats inches to three places and millimetres to one', () => {
  assert.equal(formatLength(17.5625, 'in'), '17.563');
  assert.equal(formatLength(2, 'in'), '2.000');
  assert.equal(formatLength(1, 'mm'), '25.4');
  assert.equal(formatLength(17.5625, 'mm'), '446.1');
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

test('describes each kind of step', () => {
  const step = (axis, kind) => ({ n: 1, axis, position: 0, kind, turnBefore: false });
  assert.equal(stepNote(step('L', 'square')), 'Square up: trim head');
  assert.equal(stepNote(step('W', 'square')), 'Square up: trim side');
  assert.equal(stepNote(step('L', 'block')), 'Trim to imposed length');
  assert.equal(stepNote(step('W', 'block')), 'Trim to imposed width');
  assert.equal(stepNote(step('W', 'ladder')), 'Cut off next strip');
  assert.equal(stepNote(step('L', 'trim')), 'Trim gutter');
});
