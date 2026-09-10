// layout.js — centered imposition of documents on a sheet. Pure; all values in inches.
//
// Orientation is taken exactly as entered. A better yield often exists in the other
// orientation (3.5x2 is 24-up on 12x18 but 25-up on 18x12); reporting that is
// suggestOrientation's job, never computeLayout's.

const EPSILON = 1e-9;

function assertPositive(name, obj, keys, { allowZero }) {
  for (const key of keys) {
    const value = obj[key];
    const ok = Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
    if (!ok) {
      throw new RangeError(`${name}.${key} must be ${allowZero ? 'zero or more' : 'greater than zero'}, got ${value}`);
    }
  }
}

function countAlong(sheetSize, docSize, gutterSize) {
  // n documents need n*doc + (n-1)*gutter <= sheet. The epsilon keeps an exact
  // fit (e.g. 0.3 / 0.1 = 2.9999999999999996) from losing a document.
  return Math.floor((sheetSize + gutterSize) / (docSize + gutterSize) + EPSILON);
}

/**
 * @param sheet   { width, length } inches, both > 0
 * @param doc     { width, length } inches, both > 0
 * @param gutter  { columns, rows } inches, both >= 0: the gutter between columns, and between rows
 */
export function computeLayout(sheet, doc, gutter) {
  assertPositive('sheet', sheet, ['width', 'length'], { allowZero: false });
  assertPositive('doc', doc, ['width', 'length'], { allowZero: false });
  assertPositive('gutter', gutter, ['columns', 'rows'], { allowZero: true });

  const across = countAlong(sheet.width, doc.width, gutter.columns);
  const down = countAlong(sheet.length, doc.length, gutter.rows);
  if (across < 1 || down < 1) {
    return { fits: false, across, down, sheet, doc, gutter };
  }

  const imposed = {
    width: doc.width * across + gutter.columns * (across - 1),
    length: doc.length * down + gutter.rows * (down - 1),
  };
  const margins = {
    left: (sheet.width - imposed.width) / 2,
    top: (sheet.length - imposed.length) / 2,
  };
  const docs = [];
  for (let row = 0; row < down; row++) {
    for (let col = 0; col < across; col++) {
      docs.push({
        x: margins.left + col * (doc.width + gutter.columns),
        y: margins.top + row * (doc.length + gutter.rows),
        width: doc.width,
        length: doc.length,
      });
    }
  }
  return { fits: true, across, down, imposed, margins, docs, sheet, doc, gutter };
}

const turned = ({ width, length }) => ({ width: length, length: width });

function countUp(sheet, doc, gutter) {
  const { across, down } = computeLayout(sheet, doc, gutter);
  return across * down;
}

/**
 * Whether turning the document or the sheet 90° would fit more documents.
 * Returns null when the entered orientation is already best, otherwise the better
 * turn as { rotate: 'doc' | 'sheet', count }. Ties prefer turning the document,
 * which leaves the sheet as it is fed.
 */
export function suggestOrientation(sheet, doc, gutter) {
  const current = countUp(sheet, doc, gutter);
  const candidates = [
    { rotate: 'doc', count: countUp(sheet, turned(doc), gutter) },
    { rotate: 'sheet', count: countUp(turned(sheet), doc, gutter) },
  ];
  const best = candidates.reduce((a, b) => (b.count > a.count ? b : a));
  return best.count > current ? best : null;
}
