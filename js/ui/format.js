// format.js — the display boundary. Core math is in inches; this turns it into text.
import { inchesToMm } from '../core/measure.js';

/** A measurement in the given unit, without a unit label: 17.5625 -> "17.563", or "446.1" in mm. */
export function formatMeasure(inches, unit) {
  return unit === 'mm' ? inchesToMm(inches).toFixed(1) : inches.toFixed(3);
}

/** formatMeasure with trailing zeros trimmed, for labels: 12 -> "12", 10.75 -> "10.75". */
export function formatShort(inches, unit) {
  const text = formatMeasure(inches, unit);
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

export function unitName(unit) {
  return unit === 'mm' ? 'millimetres' : 'inches';
}

/** A short note describing what a sequence step removes. */
export function stepNote(step) {
  switch (step.kind) {
    case 'margin': return `Trim ${step.edge} margin`;
    case 'strip': return 'Cut off next strip';
    case 'gutter': return 'Trim gutter';
    default: return '';
  }
}

/** Sixteenths as a fraction for inch labels: 0.0625 -> "1/16", 1.5 -> "1 1/2", 2 -> "2"; anything else as typed. */
export function formatFraction(value) {
  const sixteenths = value * 16;
  if (!Number.isInteger(sixteenths)) return String(value);
  const whole = Math.floor(sixteenths / 16);
  let n = sixteenths - whole * 16;
  if (n === 0) return String(whole);
  let d = 16;
  while (n % 2 === 0) { n /= 2; d /= 2; }
  return whole ? `${whole} ${n}/${d}` : `${n}/${d}`;
}

const EDGES = ['top', 'bottom', 'left', 'right'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** "just now", "40 min ago", "3 h ago", then a weekday within a week, then "Sep 2". */
export function relativeTime(at, now) {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const date = new Date(at);
  if (seconds < 7 * 24 * 3600) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * One line for the advanced values, as the Advanced header shows it:
 * "NPA 1/16 all round · Auto · Centered". Values are in `unit` as entered;
 * `defaultNpa` is that unit's default so only departing edges are named.
 */
export function describeAdvanced({ npa, count, align }, unit, defaultNpa) {
  const fmt = (n) => (unit === 'in' ? formatFraction(n) : String(n));
  const npaValues = EDGES.map((e) => npa[e]);
  const npaText = npaValues.every((v) => v === npaValues[0])
    ? `NPA ${fmt(npaValues[0])} all round`
    : `NPA ${EDGES.filter((e) => npa[e] !== defaultNpa).map((e) => `${e} ${fmt(npa[e])}`).join(', ')}`;
  const countParts = [];
  if (count.across !== undefined) countParts.push(`${count.across} across`);
  if (count.down !== undefined) countParts.push(`${count.down} down`);
  const alignParts = EDGES.filter((e) => e in align).map((e) => `${cap(e)} +${fmt(align[e])}`);
  return `${npaText} · ${countParts.length ? countParts.join(' × ') : 'Auto'} · ${alignParts.length ? alignParts.join(' · ') : 'Centered'}`;
}

const FOLD_NAMES = { bifold: 'Bifold', trifold: 'Trifold', zfold: 'Z-fold' };

/** "Bifold across length", plus "· 2 custom scores" when there are any; '' when there is nothing to say. */
export function describeFold(fold) {
  const parts = [];
  if (fold.style !== 'none') parts.push(`${FOLD_NAMES[fold.style]} across ${fold.axis === 'L' ? 'length' : 'width'}`);
  if (fold.custom.length) parts.push(`${fold.custom.length} custom score${fold.custom.length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
