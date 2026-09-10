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
