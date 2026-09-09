// foldControls.js — fold style, fold direction, trifold wrap allowance, and custom score offsets.
import { el } from './dom.js';
import { parseMeasurement } from '../core/measure.js';

const STYLES = [['none', 'Off'], ['bifold', 'Bifold'], ['trifold', 'Trifold'], ['zfold', 'Z-fold']];
const AXES = [['L', 'Length'], ['W', 'Width']];

/**
 * @param options  { onChange(fold) }  fold = { style, axis, allowance, custom } in the current unit
 * @returns { setValue(fold, unit), setDocSize({ width, length }) }
 */
export function createFoldControls(container, { onChange }) {
  let value = { style: 'none', axis: 'L', allowance: 0, custom: [] };
  let unit = 'in';
  let docSize = { width: 1, length: 1 };

  const chipRow = (pairs, attr, pick) => {
    const row = el('div', { class: 'chips' });
    for (const [key, label] of pairs) {
      const button = el('button', { type: 'button', 'aria-pressed': 'false', dataset: { [attr]: key } }, label);
      button.addEventListener('click', () => pick(key));
      row.append(button);
    }
    return row;
  };
  const styleChips = chipRow(STYLES, 'style', (style) => emit({ style }));
  const axisChips = chipRow(AXES, 'axis', (axis) => emit({ axis }));

  const allowanceInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Wrap allowance' });
  const allowanceRow = el('div', { class: 'row', hidden: true }, el('label', {}, 'Wrap allowance off the tucked panel', allowanceInput));
  const customInput = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Custom score offset' });
  const addButton = el('button', { type: 'button' }, 'Add');
  const customRow = el('div', { class: 'row' }, el('label', {}, 'Custom score, from the head of each document', customInput), addButton);
  const customList = el('div', { class: 'chips' });
  const hint = el('p', { class: 'hint', hidden: true });

  container.replaceChildren(el('fieldset', { class: 'group' },
    el('legend', {}, 'Scoring'),
    styleChips,
    el('div', { class: 'row' }, el('span', {}, 'Fold across'), axisChips),
    allowanceRow,
    customRow,
    customList,
    hint));

  function press(row, attr, key) {
    for (const b of row.children) b.setAttribute('aria-pressed', String(b.dataset[attr] === key));
  }

  function reflect() {
    press(styleChips, 'style', value.style);
    press(axisChips, 'axis', value.axis);
    allowanceRow.hidden = value.style !== 'trifold';
    const size = value.axis === 'W' ? docSize.width : docSize.length;
    customList.replaceChildren(...value.custom.map((offset) => {
      const inRange = offset > 0 && offset < size;
      const chip = el('button', {
        type: 'button',
        class: inRange ? undefined : 'inactive',
        title: inRange ? undefined : `Outside the document (0–${size} ${unit}); not scored`,
        'aria-label': `Remove score at ${offset} ${unit}`,
      }, inRange ? `${offset} ${unit} ×` : `${offset} ${unit} (out of range) ×`);
      chip.addEventListener('click', () => emit({ custom: value.custom.filter((o) => o !== offset) }));
      return chip;
    }));
  }

  function emit(patch) {
    value = { ...value, ...patch };
    reflect();
    onChange(value);
  }

  allowanceInput.addEventListener('input', () => {
    const allowance = parseMeasurement(allowanceInput.value);
    if (allowance === null) return; // keep the last valid allowance
    value = { ...value, allowance };
    onChange(value);
  });

  function addCustom() {
    const offset = parseMeasurement(customInput.value);
    const size = value.axis === 'W' ? docSize.width : docSize.length;
    if (offset === null || offset <= 0 || offset >= size) {
      hint.textContent = `Enter a measurement between 0 and ${size} ${unit}.`;
      hint.hidden = false;
      return;
    }
    hint.hidden = true;
    customInput.value = '';
    if (!value.custom.includes(offset)) emit({ custom: [...value.custom, offset].sort((a, b) => a - b) });
  }
  addButton.addEventListener('click', addCustom);
  customInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCustom();
    }
  });

  return {
    setValue(fold, nextUnit) {
      value = fold;
      unit = nextUnit;
      allowanceInput.value = String(fold.allowance);
      hint.hidden = true;
      reflect();
    },
    setDocSize(nextDocSize) {
      const changed = docSize.width !== nextDocSize.width || docSize.length !== nextDocSize.length;
      docSize = nextDocSize;
      if (changed) reflect();
    },
  };
}
