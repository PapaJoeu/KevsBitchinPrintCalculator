// presets.js — quick-select sizes and the default job, per unit.
// Sizes are { width, length } in the unit they belong to, not inches.

const size = (width, length) => ({ width, length });
const gutter = (columns, rows, label) => (label ? { columns, rows, label } : { columns, rows });
const npa = (all) => ({ top: all, bottom: all, left: all, right: all });

export const PRESETS = {
  in: {
    // Only the two sheets actually run (spec "Main inputs"); everything else is Custom.
    sheet: [size(12, 18), size(13, 19)],
    doc: [size(3.5, 2), size(4.25, 5.5), size(5.5, 8.5), size(8.5, 11), size(11, 17)],
    gutter: [gutter(0.125, 0.125, '⅛"'), gutter(0.25, 0.25, '¼"'), gutter(0, 0, 'None')],
  },
  mm: {
    sheet: [size(320, 450), size(297, 420)],
    doc: [size(90, 55), size(105, 148), size(148, 210), size(210, 297), size(297, 420)],
    gutter: [gutter(3, 3, '3 mm'), gutter(5, 5, '5 mm'), gutter(0, 0, 'None')],
  },
};

/** Everything a job starts with, per unit. The trifold allowance is 1/16" (1.5 mm is its metric round-off). */
export const DEFAULTS = {
  in: {
    sheet: size(12, 18), doc: size(3.5, 2), gutter: gutter(0.125, 0.125),
    npa: npa(0.0625), count: {}, align: {},
    fold: { style: 'none', axis: 'L', allowance: 0.0625, custom: [] },
  },
  mm: {
    sheet: size(320, 450), doc: size(90, 55), gutter: gutter(3, 3),
    npa: npa(1.5), count: {}, align: {},
    fold: { style: 'none', axis: 'L', allowance: 1.5, custom: [] },
  },
};
