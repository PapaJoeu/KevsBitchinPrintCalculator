// sizeInputs.js — one size section: preset chips, a Rotate button, and two fields
// (revealed by a Custom chip, or always visible for the gutter).
import { el } from './dom.js';
import { parseMeasurement } from '../core/measure.js';

/**
 * @param container  element to render into
 * @param options    { label, allowZero, keys, labels, alwaysShowFields, onChange }
 *   keys   — the two property names of the value, default ['width', 'length'];
 *            the gutter section uses ['columns', 'rows']
 *   labels — the two field labels, default ['Width', 'Length']
 *   alwaysShowFields — no Custom chip: the fields stay visible and chips fill them
 *   onChange(value) fires only with valid numbers. Invalid typing leaves the
 *   previous value in force and shows a hint under the fields.
 * @returns { setPresets(presets, value), setValue(value), rotate() }
 */
export function createSizeInputs(container, {
  label, allowZero = false, keys = ['width', 'length'], labels = ['Width', 'Length'],
  alwaysShowFields = false, onChange,
}) {
  const [first, second] = keys;
  const same = (a, b) => a[first] === b[first] && a[second] === b[second];
  const chipText = (v) => v.label ?? (v[first] === 0 && v[second] === 0 ? 'None' : `${v[first]} × ${v[second]}`);
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': `${label} presets` });
  const firstInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} ${labels[0].toLowerCase()}` });
  const secondInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} ${labels[1].toLowerCase()}` });
  const fields = el('div', { class: 'custom', hidden: !alwaysShowFields },
    el('label', {}, labels[0], firstInput),
    el('span', { class: 'times' }, '×'),
    el('label', {}, labels[1], secondInput));
  const hint = el('p', { class: 'hint', hidden: true });
  container.replaceChildren(el('fieldset', { class: 'group' }, el('legend', {}, label), chips, fields, hint));

  let presets = [];
  let value = { [first]: 1, [second]: 1 };
  let customChip = null;

  // Selection chips only — Rotate is an action, never "pressed".
  const selectable = () => [...chips.children].filter((b) => !b.dataset.action);

  function press(button) {
    for (const b of selectable()) b.setAttribute('aria-pressed', String(b === button));
  }

  function fill() {
    firstInput.value = String(value[first]);
    secondInput.value = String(value[second]);
  }

  function showFields(show) {
    const visible = show || alwaysShowFields;
    fields.hidden = !visible;
    if (visible) fill();
  }

  function renderChips() {
    const buttons = presets.map((preset) => {
      const button = el('button', { type: 'button', 'aria-pressed': 'false' }, chipText(preset));
      button.addEventListener('click', () => {
        value = { [first]: preset[first], [second]: preset[second] };
        press(button);
        showFields(false);
        hint.hidden = true;
        onChange(value);
      });
      return button;
    });
    const rotate = el('button', { type: 'button', dataset: { action: 'rotate' }, 'aria-label': `Rotate ${label.toLowerCase()}` }, '↻ Rotate');
    rotate.addEventListener('click', () => api.rotate());
    if (alwaysShowFields) {
      customChip = null;
      chips.replaceChildren(...buttons, rotate);
    } else {
      customChip = el('button', { type: 'button', 'aria-pressed': 'false' }, 'Custom');
      customChip.addEventListener('click', () => {
        press(customChip);
        showFields(true);
        firstInput.focus();
      });
      chips.replaceChildren(...buttons, customChip, rotate);
    }
  }

  // Press the chip matching the value; otherwise Custom (or, with always-visible fields, none).
  function reflect() {
    const index = presets.findIndex((p) => same(p, value));
    if (index >= 0) {
      press(chips.children[index]);
      showFields(false);
    } else if (customChip) {
      press(customChip);
      showFields(true);
    } else {
      press(null);
      fill();
    }
  }

  function readFields() {
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
    if (alwaysShowFields) press(selectable()[presets.findIndex((p) => same(p, value))] ?? null);
    onChange(value);
  }
  firstInput.addEventListener('input', readFields);
  secondInput.addEventListener('input', readFields);

  const api = {
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
    /** Swap the two dimensions. The one change the section makes to its own value. */
    rotate() {
      value = { [first]: value[second], [second]: value[first] };
      reflect();
      onChange(value);
    },
  };
  return api;
}
