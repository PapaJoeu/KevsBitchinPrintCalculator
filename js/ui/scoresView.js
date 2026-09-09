// scoresView.js — score positions on the full sheet, plus the offsets within each document.
import { el } from './dom.js';
import { formatLength } from './format.js';

export function renderScores(container, { layout, scores }, fold, unit) {
  if (!layout.fits || scores.positions.length === 0) {
    container.replaceChildren(el('p', { class: 'detail' }, 'No scores. Pick a fold style or add a custom score.'));
    return;
  }
  const edge = fold.axis === 'W' ? 'left edge' : 'head';
  const count = scores.positions.length;
  const within = scores.offsets.map((o) => formatLength(o, unit)).join(', ');
  container.replaceChildren(
    el('p', { class: 'detail' }, `${count} score${count === 1 ? '' : 's'} across the sheet · within each document: ${within} ${unit} from the ${edge}`),
    el('table', { class: 'scores' },
      el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, `From sheet ${edge} (${unit})`))),
      el('tbody', {}, ...scores.positions.map((p, i) => el('tr', {}, el('td', {}, String(i + 1)), el('td', {}, formatLength(p, unit)))))),
  );
}
