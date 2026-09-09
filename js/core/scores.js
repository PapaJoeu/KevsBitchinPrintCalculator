// scores.js — score (fold) positions for every document, in sheet coordinates. Pure; inches.

/** Wrap allowance taken off the tucked trifold panel: 1/16". See spec "Folds". */
export const DEFAULT_WRAP_ALLOWANCE = 0.0625;

const EPSILON = 1e-9;

/**
 * Offsets of the scores within one document, measured along `size` from its head.
 * For a trifold the tucked panel comes first and is shortened by `allowance`; the
 * cover panel is lengthened by the same amount, so the panels still sum to `size`.
 */
export function foldOffsets(style, size, allowance = DEFAULT_WRAP_ALLOWANCE) {
  switch (style) {
    case 'none': return [];
    case 'bifold': return [size / 2];
    case 'trifold': return [size / 3 - allowance, (2 * size) / 3 - allowance];
    case 'zfold': return [size / 3, (2 * size) / 3];
    default: throw new RangeError(`Unknown fold style: ${style}`);
  }
}

/**
 * @param layout  result of computeLayout with fits: true
 * @param fold    { style, axis: 'L'|'W', allowance, custom: number[] } — inches.
 *   axis is the document dimension the offsets run along: 'L' folds the length
 *   (score lines cross the width), 'W' folds the width.
 * @returns { offsets, positions, segments }
 *   offsets   — within-document offsets, sorted, deduplicated, out-of-range dropped
 *   positions — distinct sheet positions of the scores, sorted: from the head edge
 *               for 'L', from the left edge for 'W'
 *   segments  — one line per score per document, { docIndex, x1, y1, x2, y2 }
 */
export function computeScores(layout, fold) {
  if (!layout.fits) throw new RangeError('computeScores needs a layout that fits');
  const alongWidth = fold.axis === 'W';
  const size = alongWidth ? layout.doc.width : layout.doc.length;
  const offsets = unique(
    [...foldOffsets(fold.style, size, fold.allowance), ...fold.custom].filter((o) => o > 0 && o < size),
  );
  const positions = [];
  const segments = [];
  layout.docs.forEach((d, docIndex) => {
    for (const offset of offsets) {
      if (alongWidth) {
        const x = d.x + offset;
        positions.push(x);
        segments.push({ docIndex, x1: x, y1: d.y, x2: x, y2: d.y + d.length });
      } else {
        const y = d.y + offset;
        positions.push(y);
        segments.push({ docIndex, x1: d.x, y1: y, x2: d.x + d.width, y2: y });
      }
    }
  });
  return { offsets, positions: unique(positions), segments };
}

function unique(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.filter((v, i) => i === 0 || v - sorted[i - 1] > EPSILON);
}
