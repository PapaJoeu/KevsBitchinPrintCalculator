import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, DEFAULT_JOB, FOLD_DEFAULTS } from '../js/ui/presets.js';

test('12x18 and 13x19 lead the sheet presets', () => {
  assert.deepEqual(PRESETS.in.sheet.slice(0, 2), [{ width: 12, length: 18 }, { width: 13, length: 19 }]);
});

test('the default job is the business card on 12x18 with 1/8" gutters', () => {
  assert.deepEqual(DEFAULT_JOB.in, {
    sheet: { width: 12, length: 18 },
    doc: { width: 3.5, length: 2 },
    gutter: { width: 0.125, length: 0.125 },
  });
});

test('every default job value is one of its unit presets, so a chip is pressed on open', () => {
  for (const unit of ['in', 'mm']) {
    for (const kind of ['sheet', 'doc', 'gutter']) {
      const job = DEFAULT_JOB[unit][kind];
      assert.ok(
        PRESETS[unit][kind].some((p) => p.width === job.width && p.length === job.length),
        `${unit} ${kind} default ${JSON.stringify(job)} is not a preset`,
      );
    }
  }
});

test('folds default to off along the length, with a 1/16" trifold allowance', () => {
  assert.deepEqual(FOLD_DEFAULTS.in, { style: 'none', axis: 'L', allowance: 0.0625, custom: [] });
  assert.equal(FOLD_DEFAULTS.mm.style, 'none');
});
