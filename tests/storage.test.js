import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../js/storage.js';

/** An in-memory Storage. `failing` makes every method throw, like a private-mode quota. */
function fakeStore({ failing = false, seed = {} } = {}) {
  const map = new Map(Object.entries(seed));
  const guard = () => { if (failing) throw new Error('QuotaExceededError'); };
  return {
    map,
    getItem: (key) => { guard(); return map.has(key) ? map.get(key) : null; },
    setItem: (key, value) => { guard(); map.set(key, String(value)); },
    removeItem: (key) => { guard(); map.delete(key); },
  };
}

test('round-trips prefs, last, and history with a v:1 envelope', () => {
  const store = fakeStore();
  const s = createStorage(store);
  assert.equal(s.available, true);
  assert.equal(s.loadPrefs(), null);
  s.savePrefs({ unit: 'mm', resume: true, largeGauge: true });
  assert.deepEqual(s.loadPrefs(), { unit: 'mm', resume: true, largeGauge: true });
  assert.deepEqual(JSON.parse(store.map.get('printcalc.prefs')), { v: 1, unit: 'mm', resume: true, largeGauge: true });

  const job = { sheet: { width: 12, length: 18 } };
  assert.equal(s.loadLast(), null);
  s.saveLast('in', job);
  assert.deepEqual(s.loadLast(), { unit: 'in', job });
  s.clearLast();
  assert.equal(s.loadLast(), null);
  assert.equal(store.map.has('printcalc.last'), false);

  assert.deepEqual(s.loadHistory(), []);
  s.saveHistory([{ unit: 'in', job, at: 5 }]);
  assert.deepEqual(s.loadHistory(), [{ unit: 'in', job, at: 5 }]);
});

test('a document with another version, or one that does not parse, is absent', () => {
  const s = createStorage(fakeStore({ seed: {
    'printcalc.prefs': JSON.stringify({ v: 2, unit: 'in', resume: true }),
    'printcalc.last': '{not json',
    'printcalc.history': JSON.stringify({ v: 1, entries: 'nope' }),
  } }));
  assert.equal(s.loadPrefs(), null);
  assert.equal(s.loadLast(), null);
  assert.deepEqual(s.loadHistory(), []);
});

test('history entries that are not entry-shaped are filtered out, not passed through', () => {
  const job = { sheet: { width: 12, length: 18 } };
  const s = createStorage(fakeStore({ seed: { 'printcalc.history': JSON.stringify({
    v: 1,
    entries: ['nope', 42, null, { garbage: true }, { unit: 'in', job, at: 5 }],
  }) } }));
  assert.deepEqual(s.loadHistory(), [{ unit: 'in', job, at: 5 }]);
});

test('prefs written before largeGauge existed still load, with the gauge off', () => {
  const s = createStorage(fakeStore({ seed: { 'printcalc.prefs': JSON.stringify({ v: 1, unit: 'in', resume: true }) } }));
  assert.deepEqual(s.loadPrefs(), { unit: 'in', resume: true, largeGauge: false });
});

test('prefs with the wrong shape are absent', () => {
  const s = createStorage(fakeStore({ seed: { 'printcalc.prefs': JSON.stringify({ v: 1, unit: 'cm', resume: 'yes' }) } }));
  assert.equal(s.loadPrefs(), null);
});

test('a throwing store is unavailable and every call degrades silently', () => {
  const s = createStorage(fakeStore({ failing: true }));
  assert.equal(s.available, false);
  assert.equal(s.loadPrefs(), null);
  assert.equal(s.loadLast(), null);
  assert.deepEqual(s.loadHistory(), []);
  assert.doesNotThrow(() => s.savePrefs({ unit: 'in', resume: false }));
  assert.doesNotThrow(() => s.saveLast('in', {}));
  assert.doesNotThrow(() => s.clearLast());
  assert.doesNotThrow(() => s.saveHistory([]));
});

test('a null store behaves as unavailable', () => {
  const s = createStorage(null);
  assert.equal(s.available, false);
  assert.equal(s.loadPrefs(), null);
  assert.doesNotThrow(() => s.savePrefs({ unit: 'in', resume: false }));
});

test('never leaves its probe key behind', () => {
  const store = fakeStore();
  createStorage(store);
  assert.equal(store.map.size, 0);
});
