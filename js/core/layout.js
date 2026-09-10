// layout.js — centered imposition of documents on a sheet. Pure; all values in inches.
//
// Orientation is taken exactly as entered. A better yield often exists in the other
// orientation (3.5x2 is 24-up on 12x18 but 25-up on 18x12); reporting that is
// suggestOrientation's job, never computeLayout's.

const EPSILON = 1e-9;
const EDGES = ['top', 'bottom', 'left', 'right'];
const NO_NPA = { top: 0, bottom: 0, left: 0, right: 0 };

function assertPositive(name, obj, keys, { allowZero }) {
  for (const key of keys) {
    const value = obj[key];
    const ok = Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
    if (!ok) {
      throw new RangeError(`${name}.${key} must be ${allowZero ? 'zero or more' : 'greater than zero'}, got ${value}`);
    }
  }
}

function assertCount(count) {
  for (const key of ['across', 'down']) {
    const value = count[key];
    if (value !== undefined && !(Number.isInteger(value) && value >= 1)) {
      throw new RangeError(`count.${key} must be a positive integer or absent, got ${value}`);
    }
  }
}

function countAlong(regionSize, docSize, gutterSize) {
  // n documents need n*doc + (n-1)*gutter <= region. The epsilon keeps an exact
  // fit (e.g. 0.3 / 0.1 = 2.9999999999999996) from losing a document; the floor
  // at zero keeps a region smaller than nothing from counting negative documents.
  return Math.max(0, Math.floor((regionSize + gutterSize) / (docSize + gutterSize) + EPSILON));
}

/** The sheet inset by each edge's non-printable area: where documents may be placed. */
export function printableRegion(sheet, npa = NO_NPA) {
  return {
    width: sheet.width - npa.left - npa.right,
    length: sheet.length - npa.top - npa.bottom,
  };
}

/** The most documents that fit a region, per axis. */
export function fitCount(region, doc, gutter) {
  return {
    across: countAlong(region.width, doc.width, gutter.columns),
    down: countAlong(region.length, doc.length, gutter.rows),
  };
}

/**
 * The four margins that put a block on the sheet: centred within the printable
 * region, then kept on the sheet. A block larger than the printable region (only a
 * count override can make one) is clamped rather than hung off an edge.
 *
 * Precondition: `imposed` must fit the sheet itself (imposed.width <= sheet.width and
 * imposed.length <= sheet.length). computeLayout enforces this before calling
 * placeBlock; a block that does not fit the sheet is not this function's job to detect.
 */
export function placeBlock(sheet, printable, npa, imposed) {
  const axis = (total, printableSize, blockSize, nearNpa) => {
    const room = total - blockSize;
    const near = Math.min(Math.max(nearNpa + (printableSize - blockSize) / 2, 0), room);
    return [near, room - near];
  };
  const [top, bottom] = axis(sheet.length, printable.length, imposed.length, npa.top);
  const [left, right] = axis(sheet.width, printable.width, imposed.width, npa.left);
  return { top, bottom, left, right };
}

/**
 * @param sheet    { width, length } inches, both > 0
 * @param doc      { width, length } inches, both > 0
 * @param gutter   { columns, rows } inches, both >= 0: the gutter between columns, and between rows
 * @param options  { npa, count }
 *   npa   = { top, bottom, left, right } inches >= 0, default all zero. Constrains placement only.
 *   count = { across?, down? } positive integers; an absent value means auto.
 */
export function computeLayout(sheet, doc, gutter, { npa = NO_NPA, count = {} } = {}) {
  assertPositive('sheet', sheet, ['width', 'length'], { allowZero: false });
  assertPositive('doc', doc, ['width', 'length'], { allowZero: false });
  assertPositive('gutter', gutter, ['columns', 'rows'], { allowZero: true });
  assertPositive('npa', npa, EDGES, { allowZero: true });
  assertCount(count);

  const printable = printableRegion(sheet, npa);
  const auto = fitCount(printable, doc, gutter);
  const across = count.across ?? auto.across;
  const down = count.down ?? auto.down;
  if (across < 1 || down < 1) {
    return { fits: false, across, down, auto, printable, npa, sheet, doc, gutter };
  }

  const imposed = {
    width: doc.width * across + gutter.columns * (across - 1),
    length: doc.length * down + gutter.rows * (down - 1),
  };
  // Only an override can ask for a block the physical sheet cannot hold.
  if (imposed.width > sheet.width + EPSILON || imposed.length > sheet.length + EPSILON) {
    return { fits: false, across, down, auto, printable, npa, imposed, sheet, doc, gutter };
  }

  const margins = placeBlock(sheet, printable, npa, imposed);
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
  return { fits: true, across, down, auto, printable, npa, imposed, margins, docs, sheet, doc, gutter };
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
