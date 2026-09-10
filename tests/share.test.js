import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeJob, decodeJob } from '../js/core/share.js';
import { DEFAULTS } from '../js/ui/presets.js';

const size = (width, length) => ({ width, length });
const job = (unit, patch = {}) => ({ ...structuredClone(DEFAULTS[unit]), ...patch });

const roundTrip = (unit, j) => decodeJob(encodeJob(unit, j, DEFAULTS[unit]), DEFAULTS);

test('the default job encodes to the short form and decodes back', () => {
  assert.equal(encodeJob('in', job('in'), DEFAULTS.in), 'v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125');
  assert.deepEqual(roundTrip('in', job('in')), { unit: 'in', job: job('in') });
  assert.deepEqual(decodeJob('#v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125', DEFAULTS), { unit: 'in', job: job('in') });
});

test('round-trips the hand-verified fixtures', () => {
  const twoUp = job('in', { doc: size(11, 8.5) });
  assert.deepEqual(roundTrip('in', twoUp), { unit: 'in', job: twoUp });
  const flushTop = job('in', { npa: { top: 0, bottom: 0.0625, left: 0.0625, right: 0.0625 }, align: { top: 0 } });
  assert.equal(encodeJob('in', flushTop, DEFAULTS.in), 'v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125&n=0,0.0625,0.0625,0.0625&a=top=0');
  assert.deepEqual(roundTrip('in', flushTop), { unit: 'in', job: flushTop });
});

test('round-trips millimetres, counts, two-edge alignment, folds, and custom scores', () => {
  const mm = job('mm', { sheet: size(297, 420), gutter: { columns: 5, rows: 0 } });
  assert.deepEqual(roundTrip('mm', mm), { unit: 'mm', job: mm });

  const across = job('in', { count: { across: 2 } });
  assert.match(encodeJob('in', across, DEFAULTS.in), /&c=2x$/);
  assert.deepEqual(roundTrip('in', across), { unit: 'in', job: across });
  const down = job('in', { count: { down: 9 } });
  assert.match(encodeJob('in', down, DEFAULTS.in), /&c=x9$/);
  assert.deepEqual(roundTrip('in', down), { unit: 'in', job: down });
  const both = job('in', { count: { across: 2, down: 9 } });
  assert.deepEqual(roundTrip('in', both), { unit: 'in', job: both });

  const corner = job('in', { align: { top: 0.5, left: 0 } });
  assert.match(encodeJob('in', corner, DEFAULTS.in), /&a=top=0\.5,left=0$/);
  assert.deepEqual(roundTrip('in', corner), { unit: 'in', job: corner });

  const folded = job('in', { fold: { style: 'trifold', axis: 'W', allowance: 0.125, custom: [1, 2.5] } });
  assert.equal(encodeJob('in', folded, DEFAULTS.in), 'v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125&f=trifold|W|0.125&x=1,2.5');
  assert.deepEqual(roundTrip('in', folded), { unit: 'in', job: folded });
});

test('an axis choice survives the round trip even with fold style off', () => {
  const axisOnly = job('in', { fold: { style: 'none', axis: 'W', allowance: 0.0625, custom: [1.75] } });
  assert.deepEqual(roundTrip('in', axisOnly), { unit: 'in', job: axisOnly });
});

test('omitted keys fill in from the defaults of the named unit', () => {
  const decoded = decodeJob('v=1&u=mm&s=320x450&d=90x55&g=3x3', DEFAULTS);
  assert.deepEqual(decoded, { unit: 'mm', job: job('mm') });
});

test('accepts percent-encoded hashes', () => {
  const encoded = encodeURIComponent('v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125&f=bifold|L|0.0625');
  const expected = job('in', { fold: { style: 'bifold', axis: 'L', allowance: 0.0625, custom: [] } });
  assert.deepEqual(decodeJob(`#${encoded}`, DEFAULTS), { unit: 'in', job: expected });
});

test('rejects anything malformed with null, never a partial job', () => {
  const base = 'v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125';
  const bad = [
    '', '#', 'u=in&s=12x18&d=3.5x2&g=0.125x0.125',          // missing v
    base.replace('v=1', 'v=2'),                             // unknown version
    base.replace('u=in', 'u=cm'),                           // unknown unit
    base.replace('s=12x18', 's=12x'),                       // half a size
    base.replace('s=12x18', 's=12x18x2'),                   // too many parts
    base.replace('d=3.5x2', 'd=abcx2'),                     // not a number
    base.replace('d=3.5x2', 'd=0x2'),                       // zero document
    base.replace('d=3.5x2', 'd=-3.5x2'),                    // negative
    `${base}&n=1,2,3`,                                      // three edges
    `${base}&n=1,2,3,x`,                                    // non-numeric edge
    `${base}&a=top=0,bottom=0`,                             // both edges of an axis
    `${base}&a=middle=0`,                                   // unknown edge
    `${base}&a=top`,                                        // no value
    `${base}&c=2.5x`,                                       // fractional count
    `${base}&c=0x`,                                         // zero count
    `${base}&c=x`,                                          // empty count
    `${base}&f=accordion|L|0`,                              // unknown fold style
    `${base}&f=bifold|D|0`,                                 // unknown axis
    `${base}&f=bifold|L`,                                   // missing allowance
    `${base}&x=1,two`,                                      // non-numeric score
    `${base}&%E0%A4%A`,                                     // malformed percent-encoding
    'v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125&junk',          // a piece with no "="
  ];
  for (const hash of bad) assert.equal(decodeJob(hash, DEFAULTS), null, `should reject ${JSON.stringify(hash)}`);
});
