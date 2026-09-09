// layout.js — centered imposition of documents on a sheet. Pure; all values in inches.
//
// Orientation is taken exactly as entered. A better yield often exists in the other
// orientation (3.5x2 is 24-up on 12x18 but 25-up on 18x12); reporting that is
// suggestOrientation's job, never computeLayout's.

const EPSILON = 1e-9;

function assertSize(name, size, { allowZero }) {
  for (const dim of ['width', 'length']) {
    const value = size[dim];
    const ok = Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
    if (!ok) {
      throw new RangeError(`${name}.${dim} must be ${allowZero ? 'zero or more' : 'greater than zero'}, got ${value}`);
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
 * @param gutter  { width, length } inches, both >= 0; width is between columns, length between rows
 */
export function computeLayout(sheet, doc, gutter) {
  assertSize('sheet', sheet, { allowZero: false });
  assertSize('doc', doc, { allowZero: false });
  assertSize('gutter', gutter, { allowZero: true });

  const across = countAlong(sheet.width, doc.width, gutter.width);
  const down = countAlong(sheet.length, doc.length, gutter.length);
  if (across < 1 || down < 1) {
    return { fits: false, across, down, sheet, doc, gutter };
  }

  const imposed = {
    width: doc.width * across + gutter.width * (across - 1),
    length: doc.length * down + gutter.length * (down - 1),
  };
  const margins = {
    left: (sheet.width - imposed.width) / 2,
    top: (sheet.length - imposed.length) / 2,
  };
  const docs = [];
  for (let row = 0; row < down; row++) {
    for (let col = 0; col < across; col++) {
      docs.push({
        x: margins.left + col * (doc.width + gutter.width),
        y: margins.top + row * (doc.length + gutter.length),
        width: doc.width,
        length: doc.length,
      });
    }
  }
  return { fits: true, across, down, imposed, margins, docs, sheet, doc, gutter };
}
