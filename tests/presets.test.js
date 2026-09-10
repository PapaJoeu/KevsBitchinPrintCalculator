import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, DEFAULTS } from '../js/ui/presets.js';

test('12x18 and 13x19 lead the sheet presets', () => {
  assert.deepEqual(PRESETS.in.sheet.slice(0, 2), [{ width: 12, length: 18 }, { width: 13, length: 19 }]);
});

test('the default job is the business card on 12x18 with 1/8" gutters', () => {
  assert.deepEqual(DEFAULTS.in.sheet, { width: 12, length: 18 });
  assert.deepEqual(DEFAULTS.in.doc, { width: 3.5, length: 2 });
  assert.deepEqual(DEFAULTS.in.gutter, { width: 0.125, length: 0.125 });
});

test('every default size is one of its unit presets, so a chip is pressed on open', () => {
  for (const unit of ['in', 'mm']) {
    for (const kind of ['sheet', 'doc', 'gutter']) {
      const value = DEFAULTS[unit][kind];
      assert.ok(
        PRESETS[unit][kind].some((p) => JSON.stringify(p) === JSON.stringify(value)),
        `${unit} ${kind} default ${JSON.stringify(value)} is not a preset`,
      );
    }
  }
});

test('folds default to off along the length, with a 1/16" trifold allowance', () => {
  assert.deepEqual(DEFAULTS.in.fold, { style: 'none', axis: 'L', allowance: 0.0625, custom: [] });
  assert.equal(DEFAULTS.mm.fold.style, 'none');
});
