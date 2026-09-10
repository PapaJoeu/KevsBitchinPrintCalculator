// sizeInputs.js — one size section: preset chips, two always-visible fields, and a
// Rotate button. The fields are the truth; a chip is a shortcut that fills them.
import { el } from './dom.js';
import { parseMeasurement } from '../core/measure.js';

/**
 * @param container  element to render into
 * @param options    { label, allowZero, keys, labels, cols, zeroDisables, onChange }
 *   keys   — the two property names of the value, default ['width', 'length'];
 *            the gutter section uses ['columns', 'rows']
 *   labels — the two field labels, default ['Width', 'Length']
 *   cols   — chips per row, for the equal-width chip grid
 *   zeroDisables — a {0,0} value greys the fields and Rotate (the gutter's None):
 *            there is nothing to type and nothing to turn, so the controls say so.
 *   onChange(value) fires only with valid numbers. Invalid typing leaves the
 *   previous value in force and shows a hint under the offending field.
 * @returns { setPresets(presets, value), setValue(value), rotate() }
 */
export function createSizeInputs(container, {
  label, allowZero = false, keys = ['width', 'length'], labels = ['Width', 'Length'],
  cols = 3, zeroDisables = false, onChange,
}) {
  const [first, second] = keys;
  const same = (a, b) => a[first] === b[first] && a[second] === b[second];
  const chipText = (v) => v.label ?? (v[first] === 0 && v[second] === 0 ? 'None' : `${v[first]} × ${v[second]}`);
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': `${label} presets`, style: `--cols: ${cols}` });

  const firstInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} ${labels[0].toLowerCase()}` });
  const secondInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `${label} ${labels[1].toLowerCase()}` });
  const firstLabel = el('label', { class: 'field' }, labels[0], firstInput);
  const secondLabel = el('label', { class: 'field' }, labels[1], secondInput);
  const fields = el('div', { class: 'custom' }, firstLabel, el('span', { class: 'times' }, '×'), secondLabel);

  // One hint per field, directly under the fields and named, so the worker never has
  // to guess which of the two boxes the message is about.
  const hints = [el('p', { class: 'hint', hidden: true }), el('p', { class: 'hint', hidden: true })];
  const rotate = el('button', { type: 'button', dataset: { action: 'rotate' }, 'aria-label': `Rotate ${label.toLowerCase()}` }, `↻ Rotate ${label.toLowerCase()}`);
  rotate.addEventListener('click', () => api.rotate());

  container.replaceChildren(el('fieldset', { class: 'group section' },
    el('legend', {}, label), chips, fields, ...hints, rotate));

  let presets = [];
  let value = { [first]: 1, [second]: 1 };

  function press(button) {
    for (const b of chips.children) b.setAttribute('aria-pressed', String(b === button));
  }

  function fill() {
    firstInput.value = String(value[first]);
    secondInput.value = String(value[second]);
  }

  /** A zero value has nothing to type and nothing to turn: grey the controls. */
  function applyDisabled() {
    if (!zeroDisables) return;
    const off = value[first] === 0 && value[second] === 0;
    for (const input of [firstInput, secondInput]) input.disabled = off;
    rotate.disabled = off;
    firstLabel.classList.toggle('disabled', off);
    secondLabel.classList.toggle('disabled', off);
  }

  function hideHints() {
    for (const hint of hints) hint.hidden = true;
  }

  function renderChips() {
    chips.replaceChildren(...presets.map((preset) => {
      const button = el('button', { type: 'button', 'aria-pressed': 'false' }, chipText(preset));
      button.addEventListener('click', () => {
        value = { [first]: preset[first], [second]: preset[second] };
        press(button);
        fill();
        applyDisabled();
        hideHints();
        onChange(value);
      });
      return button;
    }));
  }

  /** Press the chip matching the value; a value matching none presses nothing. */
  function reflect() {
    const index = presets.findIndex((p) => same(p, value));
    press(index >= 0 ? chips.children[index] : null);
    fill();
    applyDisabled();
  }

  function readFields() {
    const parsed = [parseMeasurement(firstInput.value), parseMeasurement(secondInput.value)];
    const valid = (n) => n !== null && (allowZero ? n >= 0 : n > 0);
    let bad = false;
    parsed.forEach((n, i) => {
      const ok = valid(n);
      hints[i].textContent = `${labels[i]}: ${allowZero
        ? 'enter a number like 0.125 or 1/8, or 0 for no gutter.'
        : 'enter a number like 3.5 or 3 1/2.'}`;
      hints[i].hidden = ok;
      if (!ok) bad = true;
    });
    if (bad) return;
    value = { [first]: parsed[0], [second]: parsed[1] };
    const index = presets.findIndex((p) => same(p, value));
    press(index >= 0 ? chips.children[index] : null);
    applyDisabled();
    onChange(value);
  }
  firstInput.addEventListener('input', readFields);
  secondInput.addEventListener('input', readFields);

  const api = {
    setPresets(nextPresets, nextValue) {
      presets = nextPresets;
      value = nextValue;
      renderChips();
      hideHints();
      reflect();
    },
    setValue(nextValue) {
      value = nextValue;
      hideHints();
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
