import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, DEFAULTS } from '../js/ui/presets.js';

test('the only sheet presets are the two sizes actually run', () => {
  assert.deepEqual(PRESETS.in.sheet, [{ width: 12, length: 18 }, { width: 13, length: 19 }]);
  assert.deepEqual(PRESETS.mm.sheet, [{ width: 320, length: 450 }, { width: 297, length: 420 }]);
});

test('gutter presets carry the label the chip shows', () => {
  assert.deepEqual(PRESETS.in.gutter.map((g) => g.label), ['⅛"', '¼"', 'None']);
  assert.deepEqual(PRESETS.mm.gutter.map((g) => g.label), ['3 mm', '5 mm', 'None']);
});

test('the default job is the business card on 12x18 with 1/8" gutters', () => {
  assert.deepEqual(DEFAULTS.in.sheet, { width: 12, length: 18 });
  assert.deepEqual(DEFAULTS.in.doc, { width: 3.5, length: 2 });
  assert.deepEqual(DEFAULTS.in.gutter, { columns: 0.125, rows: 0.125 });
});

test('every default size is one of its unit presets, so a chip is pressed on open', () => {
  const valueOf = ({ label, ...rest }) => rest;
  for (const unit of ['in', 'mm']) {
    for (const kind of ['sheet', 'doc', 'gutter']) {
      const value = DEFAULTS[unit][kind];
      assert.ok(
        PRESETS[unit][kind].some((p) => JSON.stringify(valueOf(p)) === JSON.stringify(value)),
        `${unit} ${kind} default ${JSON.stringify(value)} is not a preset`,
      );
    }
  }
});

test('folds default to off along the length, with a 1/16" trifold allowance', () => {
  assert.deepEqual(DEFAULTS.in.fold, { style: 'none', axis: 'L', allowance: 0.0625, custom: [] });
  assert.equal(DEFAULTS.mm.fold.style, 'none');
});

test('the job starts with a 1/16" non-printable area, auto count, and centred alignment', () => {
  assert.deepEqual(DEFAULTS.in.npa, { top: 0.0625, bottom: 0.0625, left: 0.0625, right: 0.0625 });
  assert.deepEqual(DEFAULTS.mm.npa, { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 });
  assert.deepEqual(DEFAULTS.in.count, {});
  assert.deepEqual(DEFAULTS.in.align, {});
});
