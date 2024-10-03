// app.js

import { DEFAULT_BUTTON_SIZES, PRESET_BUTTON_SELECTIONS, PRESET_SIZE_INPUTS } from './defaultSizes.js';
import { elements } from './domElements.js';

// Global state variables
const currentUnit = { value: 'imperial' };
let scoreOptions = {
    includeBifold: false,
    customOffsets: [],
};


// Utility functions
const MM_PER_INCH = 25.4;
const mmToInches = (mm) => mm / MM_PER_INCH;
const inchesToMm = (inches) => inches * MM_PER_INCH;

function parsePositiveNumber(value, fieldName) {
    const number = parseFloat(value);
    if (isNaN(number) || number <= 0) {
        throw new Error(`Invalid input for ${fieldName}`);
    }
    return number;
}

// DOM manipulation functions
function setDefaultValues() {
    const defaults = PRESET_SIZE_INPUTS[currentUnit.value];
    for (const [key, value] of Object.entries(defaults)) {
        elements[key].value = value;
    }
}

function createSizeButtons() {
    ['sheet', 'doc', 'gutter'].forEach((type) => {
        createSizeButtonsForType(type, elements[`${type}Buttons`]);
    });
}

function createSizeButtonsForType(type, container) {
    container.innerHTML = '';
    const unitLabel = currentUnit.value === 'imperial' ? ' in' : ' mm';
    const options = DEFAULT_BUTTON_SIZES[currentUnit.value][type];

    options.forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `${type}-size-button`;

        const textContent = `${option.width} x ${option.length}${unitLabel}`;
        button.dataset.width = option.width;
        button.dataset.length = option.length;

        button.textContent = textContent;
        container.appendChild(button);
    });

    const customButton = document.createElement('button');
    customButton.type = 'button';
    customButton.id = `custom${type.charAt(0).toUpperCase() + type.slice(1)}SizeButton`;
    customButton.className = `${type}-size-button`;
    customButton.textContent = 'Custom';
    container.appendChild(customButton);
}

function selectDefaultSizes() {
    const defaultSelections = PRESET_BUTTON_SELECTIONS[currentUnit.value];

    Object.entries(defaultSelections).forEach(([type, value]) => {
        const container = elements[`${type}Buttons`];
        const button = Array.from(container.children).find((btn) => btn.textContent.startsWith(value));
        if (button) {
            button.click();
        } else {
            const [width, length] = value.split(' x ');
            elements[`${type}Width`].value = width;
            elements[`${type}Length`].value = length;
        }
    });
}

function setupEventListeners() {
    elements.unitToggleButton.addEventListener('click', toggleUnit);
    ['sheetButtons', 'docButtons', 'gutterButtons'].forEach((container) => {
        elements[container].addEventListener('click', handleSizeButtonClick);
    });
    elements.rotateDocsButton.addEventListener('click', () => rotateSize('doc'));
    elements.rotateSheetButton.addEventListener('click', () => rotateSize('sheet'));
    elements.rotateDocsAndSheetButton.addEventListener('click', rotateDocsAndSheet);
    elements.addBifoldButton.addEventListener('click', () => {
        scoreOptions.includeBifold = true;
        updateScores();
    });
    elements.addCustomScoreButton.addEventListener('click', () => {
        elements.customScoreInput.classList.toggle('hidden');
    });
    elements.submitCustomScoreButton.addEventListener('click', () => {
        const offsetValue = parsePositiveNumber(elements.customScorePosition.value, 'Custom Score Offset');
        if (!isNaN(offsetValue)) {
            const offsetInInches = currentUnit.value === 'metric' ? mmToInches(offsetValue) : offsetValue;
            scoreOptions.customOffsets.push(offsetInInches);
            updateScores();
        }
    });
    elements.clearScoresButton.addEventListener('click', () => {
        scoreOptions = { includeBifold: false, customOffsets: [] };
        updateScores();
    });
}

function toggleUnit() {
    currentUnit.value = currentUnit.value === 'imperial' ? 'metric' : 'imperial';
    elements.unitToggleButton.textContent = `Switch to ${currentUnit.value === 'imperial' ? 'Metric' : 'Imperial'}`;
    setDefaultValues();
    createSizeButtons();
    selectDefaultSizes();
    calculateAndDisplayLayout();
}

function handleSizeButtonClick(event) {
    if (event.target.tagName === 'BUTTON') {
        const type = event.currentTarget.id.includes('sheet')
            ? 'sheet'
            : event.currentTarget.id.includes('doc')
            ? 'doc'
            : 'gutter';
        const inputs = elements[`${type}Inputs`];
        const isCustom = event.target.id.includes('custom');

        Array.from(event.currentTarget.children).forEach((btn) => btn.classList.remove('active'));
        event.target.classList.add('active');

        inputs.classList.toggle('hidden', !isCustom);

        if (!isCustom) {
            elements[`${type}Width`].value = event.target.dataset.width;
            elements[`${type}Length`].value = event.target.dataset.length;
        }

        calculateAndDisplayLayout();
    }
}

function rotateSize(type) {
    const widthInput = elements[`${type}Width`];
    const lengthInput = elements[`${type}Length`];
    [widthInput.value, lengthInput.value] = [lengthInput.value, widthInput.value];
    calculateAndDisplayLayout();
}

function rotateDocsAndSheet() {
    rotateSize('doc');
    rotateSize('sheet');
}

// Calculation functions
function calculateAndDisplayLayout() {
    try {
        const layout = calculateLayoutDetails();
        const scores = calculateScores(layout, scoreOptions);
        visualizer(layout, scores);
        displayProgramSequence(layout);
        displayCutsAndSlits(layout);
        displayMiscDetails(layout);
        displayScorePositions(scores);
    } catch (error) {
        handleError(error);
    }
}

function calculateLayoutDetails() {
    const getValue = (input, name) => parsePositiveNumber(input.value, name);
    let sheetWidth = getValue(elements.sheetWidth, 'Sheet Width');
    let sheetLength = getValue(elements.sheetLength, 'Sheet Length');
    let docWidth = getValue(elements.docWidth, 'Document Width');
    let docLength = getValue(elements.docLength, 'Document Length');
    let gutterWidth = getValue(elements.gutterWidth, 'Gutter Width');
    let gutterLength = getValue(elements.gutterLength, 'Gutter Length');

    if (currentUnit.value === 'metric') {
        sheetWidth = mmToInches(sheetWidth);
        sheetLength = mmToInches(sheetLength);
        docWidth = mmToInches(docWidth);
        docLength = mmToInches(docLength);
        gutterWidth = mmToInches(gutterWidth);
        gutterLength = mmToInches(gutterLength);
    }

    const docsAcross = Math.floor((sheetWidth + gutterWidth) / (docWidth + gutterWidth));
    const docsDown = Math.floor((sheetLength + gutterLength) / (docLength + gutterLength));

    if (docsAcross < 1 || docsDown < 1) {
        throw new Error('Document size too large to fit on the sheet with the given gutters.');
    }

    const totalGutterWidth = (docsAcross - 1) * gutterWidth;
    const totalGutterLength = (docsDown - 1) * gutterLength;
    const imposedSpaceWidth = docWidth * docsAcross + totalGutterWidth;
    const imposedSpaceLength = docLength * docsDown + totalGutterLength;
    const leftMargin = (sheetWidth - imposedSpaceWidth) / 2;
    const topMargin = (sheetLength - imposedSpaceLength) / 2;

    if (leftMargin < 0 || topMargin < 0) {
        throw new Error('Documents with gutters are larger than the sheet size.');
    }

    const documents = [];
    for (let i = 0; i < docsAcross; i++) {
        for (let j = 0; j < docsDown; j++) {
            const x = leftMargin + i * (docWidth + gutterWidth);
            const y = topMargin + j * (docLength + gutterLength);
            documents.push({ x, y, width: docWidth, length: docLength });
        }
    }

    return {
        sheetWidth,
        sheetLength,
        docWidth,
        docLength,
        gutterWidth,
        gutterLength,
        docsAcross,
        docsDown,
        imposedSpaceWidth,
        imposedSpaceLength,
        topMargin,
        leftMargin,
        documents,
    };
}

function calculateScores(layout, options) {
    let scores = [];

    if (options.includeBifold) {
        layout.documents.forEach((doc) => {
            const scorePosition = doc.y + doc.length / 2;
            scores.push(scorePosition);
        });
    }

    options.customOffsets.forEach((offset) => {
        layout.documents.forEach((doc) => {
            const scorePosition = doc.y + offset;
            scores.push(scorePosition);
        });
    });

    scores = Array.from(new Set(scores)).sort((a, b) => a - b);
    return scores;
}

function updateScores() {
    try {
        const layout = calculateLayoutDetails();
        const scores = calculateScores(layout, scoreOptions);
        displayScorePositions(scores);
        visualizer(layout, scores);
    } catch (error) {
        handleError(error);
    }
}

function displayScorePositions(scores) {
    const unit = currentUnit.value === 'imperial' ? 'in' : 'mm';
    let html = `
        <table>
            <tr>
                <th>Score #</th>
                <th>Position (${unit.toUpperCase()})</th>
                <th>${unit === 'in' ? 'MM' : 'IN'}</th>
            </tr>
    `;

    scores.forEach((score, index) => {
        const measurement = currentUnit.value === 'imperial' ? score : inchesToMm(score);
        const altMeasurement = currentUnit.value === 'imperial' ? inchesToMm(score) : score;
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${measurement.toFixed(currentUnit.value === 'imperial' ? 3 : 1)} ${unit}</td>
                <td>${altMeasurement.toFixed(currentUnit.value === 'imperial' ? 1 : 3)} ${unit === 'in' ? 'mm' : 'in'}</td>
            </tr>
        `;
    });

    html += '</table>';
    elements.scorePositions.innerHTML = html;
}

function displayCutsAndSlits(layout) {
    const { cuts } = calculateCutsAndSlits(layout);
    const unit = currentUnit.value === 'imperial' ? 'in' : 'mm';

    // Display Cuts
    let cutsHtml = `
        <table>
            <tr>
                <th>Cut #</th>
                <th>Direction</th>
                <th>Position (${unit.toUpperCase()})</th>
                <th>${unit === 'in' ? 'MM' : 'IN'}</th>
            </tr>
    `;
    cuts.forEach((item, index) => {
        const measurement = currentUnit.value === 'imperial' ? item.position : inchesToMm(item.position);
        const altMeasurement = currentUnit.value === 'imperial' ? inchesToMm(item.position) : item.position;
        cutsHtml += `
            <tr>
                <td>${index + 1}</td>
                <td>${item.direction}</td>
                <td>${measurement.toFixed(currentUnit.value === 'imperial' ? 3 : 1)} ${unit}</td>
                <td>${altMeasurement.toFixed(currentUnit.value === 'imperial' ? 1 : 3)} ${unit === 'in' ? 'mm' : 'in'}</td>
            </tr>
        `;
    });
    cutsHtml += '</table>';
    elements.cutsList.innerHTML = cutsHtml;

}

function calculateCutsAndSlits(layout) {
    const cuts = [];
    const slits = [];
    const {
        leftMargin,
        topMargin,
        docWidth,
        docLength,
        gutterWidth,
        gutterLength,
        docsAcross,
        docsDown,
    } = layout;

    const horizontalCuts = new Set();
    const verticalCuts = new Set();

    for (let i = 0; i <= docsAcross; i++) {
        const x = leftMargin + i * (docWidth + gutterWidth) - (i === docsAcross ? gutterWidth : 0);
        verticalCuts.add(x);
    }

    for (let j = 0; j <= docsDown; j++) {
        const y = topMargin + j * (docLength + gutterLength) - (j === docsDown ? gutterLength : 0);
        horizontalCuts.add(y);
    }

    verticalCuts.forEach((position) => {
        cuts.push({ direction: 'Vertical', position });
    });

    horizontalCuts.forEach((position) => {
        cuts.push({ direction: 'Horizontal', position });
    });

    return { cuts, slits };
}

function displayProgramSequence(layout) {
    const sequence = calculateProgramSequence(layout);
    const unit = currentUnit.value === 'imperial' ? 'in' : 'mm';

    let html = `
        <table>
            <tr>
                <th>Step</th>
                <th>Measurement (${unit.toUpperCase()})</th>
                <th>${unit === 'in' ? 'MM' : 'IN'}</th>
            </tr>
    `;
    sequence.forEach((step, index) => {
        const measurement = currentUnit.value === 'imperial' ? step.measurement : inchesToMm(step.measurement);
        const altMeasurement = currentUnit.value === 'imperial' ? inchesToMm(step.measurement) : step.measurement;
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${measurement.toFixed(currentUnit.value === 'imperial' ? 3 : 1)} ${unit}</td>
                <td>${altMeasurement.toFixed(currentUnit.value === 'imperial' ? 1 : 3)} ${unit === 'in' ? 'mm' : 'in'}</td>
            </tr>
        `;
    });

    html += '</table>';
    elements.programSequence.innerHTML = html;
}

function calculateProgramSequence(layout) {
    let sequence = [];

    // Add initial measurements for the sheet length and width
    sequence.push({ measurement: layout.sheetLength - layout.topMargin });
    sequence.push({ measurement: layout.sheetWidth - layout.leftMargin });

    // Add measurements for the imposed space length and width
    sequence.push({ measurement: layout.imposedSpaceLength });
    sequence.push({ measurement: layout.imposedSpaceWidth });

    // Helper function to add measurements to the sequence
    // TODO: make it skip the repeated measurements if the gutter is 0
    const addMeasurements = (count, measurement, decrement) => {
        for (let i = 1; i < count; i++) {
            sequence.push({ measurement: measurement - i * decrement });
        }
    };

    // Add measurements for the documents across and down
    addMeasurements(layout.docsAcross, layout.imposedSpaceWidth, layout.docWidth + layout.gutterWidth);
    addMeasurements(layout.docsAcross, layout.docWidth, 0);
    addMeasurements(layout.docsDown, layout.imposedSpaceLength, layout.docLength + layout.gutterLength);
    addMeasurements(layout.docsDown, layout.docLength, 0);

    return sequence;
}

function displayMiscDetails(layout) {
    const totalDocuments = layout.docsAcross * layout.docsDown;
    const totalCuts = (layout.docsAcross - 1) + (layout.docsDown - 1);
    const efficiency =
        ((layout.imposedSpaceWidth * layout.imposedSpaceLength) / (layout.sheetWidth * layout.sheetLength)) * 100;

    let html = `
        <table>
            <tr><th>(N-Up)</th><td>${totalDocuments}</td></tr>
            <tr><th>Documents Across</th><td>${layout.docsAcross}</td></tr>
            <tr><th>Documents Down</th><td>${layout.docsDown}</td></tr>
            <tr><th>Total Cuts</th><td>${totalCuts}</td></tr>
            <tr><th>Coverage Area Percentage</th><td>${efficiency.toFixed(2)}%</td></tr>
        </table>
    `;
    elements.layoutDetails.innerHTML = html;
}

function handleError(error) {
    console.error(error);
    alert(error.message);
}

// Drawing functions
function visualizer(layout, scorePositions = []) {
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');

    const containerWidth = canvas.parentElement.clientWidth;
    const aspectRatio = layout.sheetLength / layout.sheetWidth;
    canvas.width = containerWidth;
    canvas.height = containerWidth * aspectRatio;

    const scale = Math.min(canvas.width / layout.sheetWidth, canvas.height / layout.sheetLength);

    const offsetX = (canvas.width - layout.sheetWidth * scale) / 2;
    const offsetY = (canvas.height - layout.sheetLength * scale) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw sheet
    drawRect(ctx, offsetX, offsetY, layout.sheetWidth * scale, layout.sheetLength * scale, 'black');

    // Draw documents
    ctx.strokeStyle = 'blue';
    layout.documents.forEach((doc) => {
        const x = offsetX + doc.x * scale;
        const y = offsetY + doc.y * scale;
        drawRect(ctx, x, y, doc.width * scale, doc.length * scale, 'blue');
    });

    // Draw score lines
    if (scorePositions.length > 0) {
        ctx.strokeStyle = 'magenta';
        ctx.lineWidth = 1;
        scorePositions.forEach((score) => {
            const y = offsetY + score * scale;
            drawLine(ctx, offsetX, y, offsetX + layout.sheetWidth * scale, y, 'magenta', [5, 5]);
        });
    }

    drawDocumentLabels(ctx, layout, scale, offsetX, offsetY);
}

function drawRect(ctx, x, y, width, height, style) {
    ctx.strokeStyle = style;
    ctx.strokeRect(x, y, width, height);
}

function drawLine(ctx, x1, y1, x2, y2, style, dash = []) {
    ctx.strokeStyle = style;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawDocumentLabels(ctx, layout, scale, offsetX, offsetY) {
    ctx.font = 'Arial';
    ctx.fillStyle = 'blue';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // make font size auto scale with the document
    ctx.font = `${Math.min(layout.docWidth, layout.docLength) * scale / 3}px Arial`;

    layout.documents.forEach((doc, index) => {
        const x = offsetX + (doc.x + doc.width / 2) * scale;
        const y = offsetY + (doc.y + doc.length / 2) * scale;
        ctx.fillText((index + 1).toString(), x, y);
    });
}

// Initialization
function init() {
    setDefaultValues();
    createSizeButtons();
    selectDefaultSizes();
    setupEventListeners();
    calculateAndDisplayLayout();
}

document.addEventListener('DOMContentLoaded', init);