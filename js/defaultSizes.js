// Data constants
export const DEFAULT_BUTTON_SIZES = {
    imperial: {
        sheet: [
            { width: 8.5, length: 11 },
            { width: 11, length: 17 },
            { width: 12, length: 18 },
            { width: 13, length: 19 },
            { width: 17, length: 22 },
            { width: 18, length: 24 },
            { width: 26, length: 40 },
        ],
        doc: [
            { width: 3.5, length: 2.0 },
            { width: 4.25, length: 5.5 },
            { width: 5.5, length: 8.5 },
            { width: 8.5, length: 11 },
            { width: 11, length: 17 },
        ],
        gutter: [
            { width: 0.125, length: 0.125 },
            { width: 0.25, length: 0.25 },
        ],
    },
    metric: {
        sheet: [
            { width: 148, length: 210 },
            { width: 210, length: 297 },
            { width: 297, length: 420 },
            { width: 420, length: 594 },
            { width: 594, length: 841 },
            { width: 841, length: 1189 },
        ],
        doc: [
            { width: 90, length: 55 },
            { width: 105, length: 148 },
            { width: 148, length: 210 },
            { width: 210, length: 297 },
            { width: 297, length: 420 },
        ],
        gutter: [
            { width: 3, length: 3 },
            { width: 5, length: 5 },
        ],
    },
};export const PRESET_SIZE_INPUTS = {
    imperial: {
        sheetWidth: '12.0',
        sheetLength: '18.0',
        docWidth: '3.5',
        docLength: '2.0',
        gutterWidth: '0.125',
        gutterLength: '0.125',
    },
    metric: {
        sheetWidth: '297',
        sheetLength: '420',
        docWidth: '90',
        docLength: '55',
        gutterWidth: '3',
        gutterLength: '3',
    },
};
export const PRESET_BUTTON_SELECTIONS = {
    imperial: {
        sheet: '12 x 18',
        doc: '3.5 x 2',
        gutter: '0.125 x 0.125',
    },
    metric: {
        sheet: '297 x 420',
        doc: '90 x 55',
        gutter: '3 x 3',
    },
};

