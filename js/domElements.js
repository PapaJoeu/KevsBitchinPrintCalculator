
// domElements.js

// DOM elements
export const elements = {
    // Toggle buttons
    unitToggleButton: document.getElementById('unitToggleButton'),
    rotateDocsButton: document.getElementById('rotateDocsButton'),
    rotateSheetButton: document.getElementById('rotateSheetButton'),
    rotateDocsAndSheetButton: document.getElementById('rotateDocsAndSheetButton'),
    addBifoldButton: document.getElementById('addBifoldButton'),
    addCustomScoreButton: document.getElementById('addCustomScoreButton'),
    clearScoresButton: document.getElementById('clearScoresButton'),
    submitCustomScoreButton: document.getElementById('submitCustomScoreButton'),

    // Sheet elements
    sheetButtons: document.getElementById('sheetButtonsContainer'),
    sheetInputs: document.getElementById('sheetDimensionsInputs'),
    sheetWidth: document.getElementById('sheetWidth'),
    sheetLength: document.getElementById('sheetLength'),

    // Document elements
    docButtons: document.getElementById('docButtonsContainer'),
    docInputs: document.getElementById('docDimensionsInputs'),
    docWidth: document.getElementById('docWidth'),
    docLength: document.getElementById('docLength'),

    // Gutter elements
    gutterButtons: document.getElementById('gutterButtonsContainer'),
    gutterInputs: document.getElementById('gutterDimensionsInputs'),
    gutterWidth: document.getElementById('gutterWidth'),
    gutterLength: document.getElementById('gutterLength'),

    // Margin elements
    topMarginInput: document.getElementById('topMarginInput'),
    bottomMarginInput: document.getElementById('bottomMarginInput'),
    leftMarginInput: document.getElementById('leftMarginInput'),
    rightMarginInput: document.getElementById('rightMarginInput'),

    // Printable area elements
    printableLeftInput: document.getElementById('printableLeftInput'),
    printableRightInput: document.getElementById('printableRightInput'),
    printableTopInput: document.getElementById('printableTopInput'),
    printableBottomInput: document.getElementById('printableBottomInput'),

    // Custom score input
    customScoreInput: document.getElementById('customScoreInput'),
    customScorePosition: document.getElementById('customScorePosition'),

    // Display elements
    scorePositions: document.getElementById('scorePositions'),
    programSequence: document.getElementById('programSequence'),
    layoutDetails: document.getElementById('layoutDetails'),
    cutsList: document.getElementById('cutsList'),
    slitsList: document.getElementById('slitsList'),
    canvas: document.getElementById('layoutCanvas'),
};