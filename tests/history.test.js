import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordJob, sameJob, MAX_HISTORY } from '../js/core/history.js';
import { DEFAULTS } from '../js/ui/presets.js';

const job = (patch = {}) => ({ ...structuredClone(DEFAULTS.in), ...patch });

test('structural equality ignores key order and undefined-valued keys', () => {
  assert.ok(sameJob({ sheet: { width: 12, length: 18 } }, { sheet: { length: 18, width: 12 } }));
  assert.ok(sameJob({ count: {} }, { count: { across: undefined } }));
  assert.ok(!sameJob(job(), job({ doc: { width: 2, length: 3.5 } })));
  assert.ok(!sameJob(job({ align: { top: 0 } }), job({ align: { bottom: 0 } })));
});

test('an unknown job goes on top with its timestamp', () => {
  const entries = recordJob([], 'in', job(), 1000);
  assert.deepEqual(entries, [{ unit: 'in', job: job(), at: 1000 }]);
  const next = recordJob(entries, 'in', job({ doc: { width: 11, length: 8.5 } }), 2000);
  assert.equal(next.length, 2);
  assert.equal(next[0].at, 2000);
  assert.deepEqual(next[1], entries[0]);
});

test('re-recording the same job bumps it to the top with a new timestamp instead of duplicating', () => {
  const a = job();
  const b = job({ doc: { width: 11, length: 8.5 } });
  let entries = recordJob([], 'in', a, 1000);
  entries = recordJob(entries, 'in', b, 2000);
  entries = recordJob(entries, 'in', structuredClone(a), 3000);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((e) => e.at), [3000, 2000]);
  assert.deepEqual(entries[0].job, a);
});

test('the same numbers in a different unit are a different job', () => {
  let entries = recordJob([], 'in', job(), 1000);
  entries = recordJob(entries, 'mm', job(), 2000);
  assert.equal(entries.length, 2);
});

test('never holds more than MAX_HISTORY entries, dropping the oldest', () => {
  let entries = [];
  for (let i = 0; i < MAX_HISTORY + 5; i += 1) {
    entries = recordJob(entries, 'in', job({ doc: { width: 1 + i, length: 1 } }), i);
  }
  assert.equal(MAX_HISTORY, 20);
  assert.equal(entries.length, MAX_HISTORY);
  assert.equal(entries[0].at, MAX_HISTORY + 4);
  assert.equal(entries[MAX_HISTORY - 1].at, 5);
});

test('does not mutate its input or share the job object', () => {
  const original = [];
  const j = job();
  const entries = recordJob(original, 'in', j, 1);
  assert.equal(original.length, 0);
  j.doc.width = 99;
  assert.equal(entries[0].job.doc.width, 3.5);
});
