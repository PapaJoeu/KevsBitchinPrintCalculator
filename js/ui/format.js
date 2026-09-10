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

/** A short note describing what a sequence step does. */
export function stepNote(step) {
  switch (step.kind) {
    case 'square': return step.axis === 'L' ? 'Square up: trim head' : 'Square up: trim side';
    case 'block': return step.axis === 'L' ? 'Trim to imposed length' : 'Trim to imposed width';
    case 'ladder': return 'Cut off next strip';
    case 'trim': return 'Trim gutter';
    default: return '';
  }
}
