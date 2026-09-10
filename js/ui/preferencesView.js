// preferencesView.js — two settings, each a chip row, saved the moment they change.
// The rows never read storage; the app hands them the current prefs with setValue.
import { el } from './dom.js';

const ROWS = [
  {
    key: 'unit',
    label: 'Default unit',
    options: [['in', 'in'], ['mm', 'mm']],
    note: 'The unit a fresh job opens in. The Units toggle on the Calculator tab changes only the current job.',
  },
  {
    key: 'resume',
    label: 'Resume last job on open',
    options: [[true, 'On'], [false, 'Off']],
    note: 'Off always opens with a fresh default job.',
  },
];

/** @param options  { onChange(patch) }  patch is { unit } or { resume } */
export function createPreferencesView(container, { onChange }) {
  const rows = new Map();
  const blocks = ROWS.map(({ key, label, options, note }) => {
    const row = el('div', { class: 'chips', style: '--cols: 2' });
    for (const [value, text] of options) {
      const button = el('button', { type: 'button', 'aria-pressed': 'false', dataset: { pref: key, value: String(value) } }, text);
      button.addEventListener('click', () => onChange({ [key]: value }));
      row.append(button);
    }
    rows.set(key, row);
    return el('fieldset', { class: 'group pref' }, el('legend', {}, label), row, el('p', { class: 'note' }, note));
  });
  container.replaceChildren(...blocks);
  return {
    setValue(prefs) {
      for (const [key, row] of rows) {
        for (const button of row.children) button.setAttribute('aria-pressed', String(button.dataset.value === String(prefs[key])));
      }
    },
  };
}
