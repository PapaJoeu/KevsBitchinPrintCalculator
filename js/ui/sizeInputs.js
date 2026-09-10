// sizeInputs.js — one size section: preset chips plus a Custom chip that reveals width/length fields.
import { el } from './dom.js';
import { parseMeasurement } from '../core/measure.js';

const sameSize = (a, b) => a.width === b.width && a.length === b.length;
const chipText = (size) => (size.width === 0 && size.length === 0 ? 'None' : `${size.width} × ${size.length}`);

/**
 * @param container  element to render into
 * @param options    { label, allowZero, onChange }
 *   onChange({ width, length }) fires only with valid numbers. Invalid typing
 *   leaves the previous value in force and shows a hint under the fields.
 * @returns { setPresets(presets, value), setValue(value) }
 */
export function createSizeInputs(container, { label, allowZero = false, onChange }) {
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': `${label} presets` });
  const widthInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} width` });
  const lengthInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} length` });
  const custom = el('div', { class: 'custom', hidden: true },
    el('label', {}, 'Width', widthInput),
    el('span', { class: 'times' }, '×'),
    el('label', {}, 'Length', lengthInput));
  const hint = el('p', { class: 'hint', hidden: true });
  container.replaceChildren(el('fieldset', { class: 'group' }, el('legend', {}, label), chips, custom, hint));

  let presets = [];
  let value = { width: 1, length: 1 };
  let customChip = null;

  function press(button) {
    for (const b of chips.children) b.setAttribute('aria-pressed', String(b === button));
  }

  function showCustom(show) {
    custom.hidden = !show;
    if (show) {
      widthInput.value = String(value.width);
      lengthInput.value = String(value.length);
    }
  }

  function renderChips() {
    const buttons = presets.map((preset) => {
      const button = el('button', { type: 'button', 'aria-pressed': 'false' }, chipText(preset));
      button.addEventListener('click', () => {
        value = { ...preset };
        press(button);
        showCustom(false);
        hint.hidden = true;
        onChange(value);
      });
      return button;
    });
    customChip = el('button', { type: 'button', 'aria-pressed': 'false' }, 'Custom');
    customChip.addEventListener('click', () => {
      press(customChip);
      showCustom(true);
      widthInput.focus();
    });
    chips.replaceChildren(...buttons, customChip);
  }

  // Press the chip matching the value, or Custom with the fields filled in.
  function reflect() {
    const index = presets.findIndex((p) => sameSize(p, value));
    if (index >= 0) {
      press(chips.children[index]);
      showCustom(false);
    } else {
      press(customChip);
      showCustom(true);
    }
  }

  function readCustom() {
    const width = parseMeasurement(widthInput.value);
    const length = parseMeasurement(lengthInput.value);
    const valid = (n) => n !== null && (allowZero ? n >= 0 : n > 0);
    if (!valid(width) || !valid(length)) {
      hint.textContent = allowZero
        ? 'Enter a number like 0.125 or 1/8, or 0 for no gutter.'
        : 'Enter a number like 3.5 or 3 1/2.';
      hint.hidden = false;
      return;
    }
    hint.hidden = true;
    value = { width, length };
    onChange(value);
  }
  widthInput.addEventListener('input', readCustom);
  lengthInput.addEventListener('input', readCustom);

  return {
    setPresets(nextPresets, nextValue) {
      presets = nextPresets;
      value = nextValue;
      renderChips();
      reflect();
    },
    setValue(nextValue) {
      value = nextValue;
      reflect();
    },
  };
}
