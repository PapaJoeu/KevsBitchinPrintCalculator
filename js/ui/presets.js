// presets.js — quick-select sizes and the default job, per unit.
// Sizes are { width, length } in the unit they belong to, not inches.

const size = (width, length) => ({ width, length });
const gutter = (columns, rows) => ({ columns, rows });

export const PRESETS = {
  in: {
    // 12x18 and 13x19 lead: the common digital and small-press sheets (spec "UI").
    sheet: [size(12, 18), size(13, 19), size(8.5, 11), size(11, 17), size(17, 22), size(18, 24), size(26, 40)],
    doc: [size(3.5, 2), size(4.25, 5.5), size(5.5, 8.5), size(8.5, 11), size(11, 17)],
    gutter: [gutter(0.125, 0.125), gutter(0.25, 0.25), gutter(0, 0)],
  },
  mm: {
    // SRA3 leads for the same reason 12x18 does.
    sheet: [size(320, 450), size(297, 420), size(210, 297), size(420, 594), size(594, 841)],
    doc: [size(90, 55), size(105, 148), size(148, 210), size(210, 297), size(297, 420)],
    gutter: [gutter(3, 3), gutter(5, 5), gutter(0, 0)],
  },
};

/** Everything a job starts with, per unit. The trifold allowance is 1/16" (1.5 mm is its metric round-off). */
export const DEFAULTS = {
  in: {
    sheet: size(12, 18), doc: size(3.5, 2), gutter: gutter(0.125, 0.125),
    fold: { style: 'none', axis: 'L', allowance: 0.0625, custom: [] },
  },
  mm: {
    sheet: size(320, 450), doc: size(90, 55), gutter: gutter(3, 3),
    fold: { style: 'none', axis: 'L', allowance: 1.5, custom: [] },
  },
};
