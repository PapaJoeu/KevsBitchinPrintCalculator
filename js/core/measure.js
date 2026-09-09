// measure.js — parse typed measurements and convert units. Pure; no DOM.

export const MM_PER_INCH = 25.4;

export const inchesToMm = (inches) => inches * MM_PER_INCH;
export const mmToInches = (mm) => mm / MM_PER_INCH;

const DECIMAL = /^(?:\d+\.?\d*|\.\d+)$/;
const FRACTION = /^(\d+)\/(\d+)$/;

function parseFraction(part) {
  const match = part.match(FRACTION);
  if (!match || Number(match[2]) === 0) return null;
  return Number(match[1]) / Number(match[2]);
}

/**
 * Parse a measurement as written on the floor: "3.5", ".125", "1/8", "3 1/2", "3-1/2".
 * Returns a non-negative number, or null when the text is not a measurement.
 */
export function parseMeasurement(text) {
  if (typeof text !== 'string') return null;
  const parts = text.trim().split(/[\s-]+/);
  if (parts.length === 1) {
    return DECIMAL.test(parts[0]) ? Number(parts[0]) : parseFraction(parts[0]);
  }
  if (parts.length === 2 && /^\d+$/.test(parts[0])) {
    const fraction = parseFraction(parts[1]);
    return fraction === null ? null : Number(parts[0]) + fraction;
  }
  return null;
}
