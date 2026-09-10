import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMeasure, formatShort, unitName, stepNote, formatFraction, relativeTime, describeAdvanced, describeFold } from '../js/ui/format.js';

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

test('relative time reads like a phone', () => {
  const now = new Date(2026, 8, 10, 12, 0, 0).getTime(); // Thu 10 Sep 2026, noon, local time
  const ago = (ms) => now - ms;
  assert.equal(relativeTime(ago(0), now), 'just now');
  assert.equal(relativeTime(ago(59 * 1000), now), 'just now');
  assert.equal(relativeTime(ago(40 * 60 * 1000), now), '40 min ago');
  assert.equal(relativeTime(ago(3 * 3600 * 1000), now), '3 h ago');
  assert.equal(relativeTime(new Date(2026, 8, 8, 12).getTime(), now), 'Tue');
  assert.equal(relativeTime(new Date(2026, 8, 2, 12).getTime(), now), 'Sep 2');
  assert.equal(relativeTime(now + 5000, now), 'just now'); // a clock that went backwards is still "now"
});

test('describes the advanced values the way the Advanced header does', () => {
  const base = { npa: { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 }, count: {}, align: {} };
  assert.equal(describeAdvanced(base, 'in', 0.0625), 'NPA 1/16 all round · Auto · Centered');
  assert.equal(describeAdvanced({ ...base, count: { across: 2 } }, 'in', 0.0625), 'NPA 1/16 all round · 2 across · Centered');
  assert.equal(describeAdvanced({ ...base, count: { across: 2, down: 9 } }, 'in', 0.0625), 'NPA 1/16 all round · 2 across × 9 down · Centered');
  assert.equal(describeAdvanced({ ...base, npa: { ...base.npa, top: 0 }, align: { top: 0 } }, 'in', 0.0625), 'NPA top 0 · Auto · Top +0');
  assert.equal(describeAdvanced({ ...base, align: { top: 0.5, left: 0 } }, 'in', 0.0625), 'NPA 1/16 all round · Auto · Top +1/2 · Left +0');
  const mm = { npa: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 }, count: {}, align: {} };
  assert.equal(describeAdvanced(mm, 'mm', 1.5), 'NPA 1.5 all round · Auto · Centered');
});

test('describes a fold, or says nothing', () => {
  assert.equal(describeFold({ style: 'none', axis: 'L', allowance: 0.0625, custom: [] }), '');
  assert.equal(describeFold({ style: 'bifold', axis: 'L', allowance: 0.0625, custom: [] }), 'Bifold across length');
  assert.equal(describeFold({ style: 'trifold', axis: 'W', allowance: 0.0625, custom: [] }), 'Trifold across width');
  assert.equal(describeFold({ style: 'zfold', axis: 'W', allowance: 0.0625, custom: [1] }), 'Z-fold across width · 1 custom score');
  assert.equal(describeFold({ style: 'none', axis: 'L', allowance: 0.0625, custom: [1, 2.5] }), '2 custom scores');
});
