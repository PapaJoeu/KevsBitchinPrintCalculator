// advancedInputs.js — the collapsed Advanced section: non-printable area per edge,
// manual count, and alignment with offsets. Values are in the current unit as typed.
// The header is a disclosure button carrying a live summary, so an override can
// never hide behind a closed panel.
import { el } from './dom.js';
import { parseMeasurement } from '../core/measure.js';
import { formatFraction } from './format.js';

const EDGES = ['top', 'bottom', 'left', 'right'];
const VERTICAL = [['top', 'Top'], ['center', 'Center'], ['bottom', 'Bottom']];
const HORIZONTAL = [['left', 'Left'], ['center', 'Center'], ['right', 'Right']];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/**
 * @param options  { onChange(patch) }  patch is one of { npa }, { count }, { align }
 * @returns { setValue({ npa, count, align }, unit, defaultNpa), setAuto({ across, down }) }
 *   setValue is for external changes only (unit toggle, a fix button); setAuto every render.
 */
export function createAdvancedInputs(container, { onChange }) {
  let value = { npa: { top: 0, bottom: 0, left: 0, right: 0 }, count: {}, align: {} };
  let unit = 'in';
  let auto = { across: 0, down: 0 };
  let defaultNpa = 0;

  const field = (ariaLabel) => el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': ariaLabel });

  const npaInputs = Object.fromEntries(EDGES.map((edge) => [edge, field(`Non-printable ${edge}`)]));
  const npaGrid = el('div', { class: 'npa-grid' }, ...EDGES.map((edge) => el('label', {}, cap(edge), npaInputs[edge])));

  const acrossInput = field('Documents across');
  const downInput = field('Documents down');
  const countRow = el('div', { class: 'custom' },
    el('label', {}, 'Across', acrossInput), el('span', { class: 'times' }, '×'), el('label', {}, 'Down', downInput));

  const chipRow = (pairs, pick) => {
    const row = el('div', { class: 'chips' });
    for (const [key, text] of pairs) {
      const button = el('button', { type: 'button', 'aria-pressed': 'false', dataset: { edge: key } }, text);
      button.addEventListener('click', () => pick(key));
      row.append(button);
    }
    return row;
  };
  const axes = {
    vertical: { pair: ['top', 'bottom'], chips: chipRow(VERTICAL, (key) => pickEdge(['top', 'bottom'], key)), input: field('Offset from the chosen edge'), label: el('span') },
    horizontal: { pair: ['left', 'right'], chips: chipRow(HORIZONTAL, (key) => pickEdge(['left', 'right'], key)), input: field('Offset from the chosen edge'), label: el('span') },
  };
  for (const axis of Object.values(axes)) axis.row = el('div', { class: 'row', hidden: true }, el('label', {}, axis.label, axis.input));

  const hint = el('p', { class: 'hint', hidden: true });
  const summary = el('span', { class: 'advanced-summary' });
  const caret = el('span', { class: 'caret' }, '▸');
  const disclosure = el('button', { type: 'button', class: 'disclosure', 'aria-expanded': 'false' }, caret, ' Advanced ', summary);
  const body = el('div', { class: 'advanced-body', hidden: true },
    el('p', { class: 'section-label' }, 'Non-printable area'), npaGrid,
    el('p', { class: 'section-label' }, 'Count'), countRow,
    el('p', { class: 'section-label' }, 'Alignment'),
    el('div', { class: 'row' }, el('span', { class: 'row-label' }, 'Vertical'), axes.vertical.chips), axes.vertical.row,
    el('div', { class: 'row' }, el('span', { class: 'row-label' }, 'Horizontal'), axes.horizontal.chips), axes.horizontal.row,
    hint);
  disclosure.addEventListener('click', () => {
    const open = body.hidden;
    body.hidden = !open;
    disclosure.setAttribute('aria-expanded', String(open));
    caret.textContent = open ? '▾' : '▸';
  });
  container.replaceChildren(el('fieldset', { class: 'group advanced' }, el('legend', {}, disclosure), body));

  const chosenEdge = (pair) => pair.find((edge) => edge in value.align) ?? 'center';

  function pickEdge(pair, key) {
    const align = { ...value.align };
    for (const edge of pair) delete align[edge];
    if (key !== 'center') align[key] = 0;
    emit({ align });
  }

  function emit(patch) {
    value = { ...value, ...patch };
    reflect();
    onChange(patch);
  }

  const fmt = (n) => (unit === 'in' ? formatFraction(n) : String(n));

  function describe() {
    const npaValues = EDGES.map((e) => value.npa[e]);
    const npaText = npaValues.every((v) => v === npaValues[0])
      ? `NPA ${fmt(npaValues[0])} all round`
      : `NPA ${EDGES.filter((e) => value.npa[e] !== defaultNpa).map((e) => `${e} ${fmt(value.npa[e])}`).join(', ')}`;
    const countParts = [];
    if (value.count.across !== undefined) countParts.push(`${value.count.across} across`);
    if (value.count.down !== undefined) countParts.push(`${value.count.down} down`);
    const alignParts = EDGES.filter((e) => e in value.align).map((e) => `${cap(e)} +${fmt(value.align[e])}`);
    return `${npaText} · ${countParts.length ? countParts.join(' × ') : 'Auto'} · ${alignParts.length ? alignParts.join(' · ') : 'Centered'}`;
  }

  function reflect() {
    for (const axis of Object.values(axes)) {
      const chosen = chosenEdge(axis.pair);
      for (const b of axis.chips.children) b.setAttribute('aria-pressed', String(b.dataset.edge === chosen));
      axis.row.hidden = chosen === 'center';
      if (chosen !== 'center') {
        axis.label.textContent = `Offset from ${chosen}`;
        // Never rewrite a field the worker is typing in.
        if (document.activeElement !== axis.input) axis.input.value = String(value.align[chosen]);
      }
    }
    acrossInput.placeholder = `Auto (${auto.across})`;
    downInput.placeholder = `Auto (${auto.down})`;
    summary.textContent = describe();
  }

  for (const edge of EDGES) {
    npaInputs[edge].addEventListener('input', () => {
      const n = parseMeasurement(npaInputs[edge].value);
      if (n === null) {
        hint.textContent = `Non-printable ${edge}: enter a number like 1/16, or 0.`;
        hint.hidden = false;
        return;
      }
      hint.hidden = true;
      emit({ npa: { ...value.npa, [edge]: n } });
    });
  }

  for (const [input, key] of [[acrossInput, 'across'], [downInput, 'down']]) {
    input.addEventListener('input', () => {
      const text = input.value.trim();
      const count = { ...value.count };
      if (text === '') {
        delete count[key];
      } else {
        const n = Number(text);
        if (!(Number.isInteger(n) && n >= 1)) {
          hint.textContent = `${cap(key)}: enter a whole number, or clear it for auto.`;
          hint.hidden = false;
          return;
        }
        count[key] = n;
      }
      hint.hidden = true;
      emit({ count });
    });
  }

  for (const axis of Object.values(axes)) {
    axis.input.addEventListener('input', () => {
      const edge = chosenEdge(axis.pair);
      if (edge === 'center') return;
      const n = parseMeasurement(axis.input.value);
      if (n === null) {
        hint.textContent = `Offset from ${edge}: enter a number like 0 or 1/4.`;
        hint.hidden = false;
        return;
      }
      hint.hidden = true;
      emit({ align: { ...value.align, [edge]: n } });
    });
  }

  return {
    setValue(next, nextUnit, nextDefaultNpa) {
      value = { npa: { ...next.npa }, count: { ...next.count }, align: { ...next.align } };
      unit = nextUnit;
      defaultNpa = nextDefaultNpa;
      // Never rewrite a field the worker is typing in.
      for (const edge of EDGES) {
        if (document.activeElement !== npaInputs[edge]) npaInputs[edge].value = String(value.npa[edge]);
      }
      if (document.activeElement !== acrossInput) acrossInput.value = value.count.across ?? '';
      if (document.activeElement !== downInput) downInput.value = value.count.down ?? '';
      hint.hidden = true;
      reflect();
    },
    setAuto(nextAuto) {
      const changed = auto.across !== nextAuto.across || auto.down !== nextAuto.down;
      auto = nextAuto;
      if (changed) reflect();
    },
  };
}
