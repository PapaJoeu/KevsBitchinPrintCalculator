// sizeInputs.js — one size section: preset chips plus a Custom chip that reveals fields.
import { el } from './dom.js';
import { parseMeasurement } from '../core/measure.js';

/**
 * @param container  element to render into
 * @param options    { label, allowZero, keys, labels, onChange }
 *   keys   — the two property names of the value, default ['width', 'length'];
 *            the gutter section uses ['columns', 'rows']
 *   labels — the two field labels, default ['Width', 'Length']
 *   onChange(value) fires only with valid numbers. Invalid typing leaves the
 *   previous value in force and shows a hint under the fields.
 * @returns { setPresets(presets, value), setValue(value) }
 */
export function createSizeInputs(container, {
  label, allowZero = false, keys = ['width', 'length'], labels = ['Width', 'Length'], onChange,
}) {
  const [first, second] = keys;
  const same = (a, b) => a[first] === b[first] && a[second] === b[second];
  const chipText = (v) => (v[first] === 0 && v[second] === 0 ? 'None' : `${v[first]} × ${v[second]}`);
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': `${label} presets` });
  const firstInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} ${labels[0].toLowerCase()}` });
  const secondInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} ${labels[1].toLowerCase()}` });
  const custom = el('div', { class: 'custom', hidden: true },
    el('label', {}, labels[0], firstInput),
    el('span', { class: 'times' }, '×'),
    el('label', {}, labels[1], secondInput));
  const hint = el('p', { class: 'hint', hidden: true });
  container.replaceChildren(el('fieldset', { class: 'group' }, el('legend', {}, label), chips, custom, hint));

  let presets = [];
  let value = { [first]: 1, [second]: 1 };
  let customChip = null;

  function press(button) {
    for (const b of chips.children) b.setAttribute('aria-pressed', String(b === button));
  }

  function showCustom(show) {
    custom.hidden = !show;
    if (show) {
      firstInput.value = String(value[first]);
      secondInput.value = String(value[second]);
    }
  }

  function renderChips() {
    const buttons = presets.map((preset) => {
      const button = el('button', { type: 'button', 'aria-pressed': 'false' }, chipText(preset));
      button.addEventListener('click', () => {
        value = { [first]: preset[first], [second]: preset[second] };
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
      firstInput.focus();
    });
    chips.replaceChildren(...buttons, customChip);
  }

  // Press the chip matching the value, or Custom with the fields filled in.
  function reflect() {
    const index = presets.findIndex((p) => same(p, value));
    if (index >= 0) {
      press(chips.children[index]);
      showCustom(false);
    } else {
      press(customChip);
      showCustom(true);
    }
  }

  function readCustom() {
    const a = parseMeasurement(firstInput.value);
    const b = parseMeasurement(secondInput.value);
    const valid = (n) => n !== null && (allowZero ? n >= 0 : n > 0);
    if (!valid(a) || !valid(b)) {
      hint.textContent = allowZero
        ? 'Enter a number like 0.125 or 1/8, or 0 for no gutter.'
        : 'Enter a number like 3.5 or 3 1/2.';
      hint.hidden = false;
      return;
    }
    hint.hidden = true;
    value = { [first]: a, [second]: b };
    onChange(value);
  }
  firstInput.addEventListener('input', readCustom);
  secondInput.addEventListener('input', readCustom);

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
