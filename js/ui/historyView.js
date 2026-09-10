// historyView.js — the recent-jobs list. Each row is one flat tap target (load) with
// Open, Copy link and Delete beneath it. Numbers are computed by the app from the
// stored inputs at render time (summarize), never stored, so they can never go stale.
import { el } from './dom.js';
import { relativeTime } from './format.js';

const CLEAR_ARM_MS = 4000;

/**
 * @param options  { summarize(entry) → { nup, line, extra }, copyLink(entry) → element,
 *                   onLoad(entry), onDelete(index), onClear(), onUndo() }
 * @returns { render(entries, { unit, available, now, pendingUndo }) }
 *   pendingUndo is { entry, index } or null — the app owns the timer, the view only
 *   draws the bar, so a re-render can never resurrect an expired offer.
 */
export function createHistoryView(container, { summarize, copyLink, onLoad, onDelete, onClear, onUndo }) {
  let armed = null;

  function row(entry, index, unit, now) {
    const { nup, line, extra } = summarize(entry);
    const open = el('button', { type: 'button', class: 'history-open' },
      el('span', { class: 'nup' }, nup, entry.unit === unit ? '' : el('span', { class: 'unit-badge' }, entry.unit)),
      el('span', { class: 'line' }, line),
      extra ? el('span', { class: 'extra' }, extra) : '',
      el('span', { class: 'when' }, relativeTime(entry.at, now)));
    open.addEventListener('click', () => onLoad(entry));

    const openButton = el('button', { type: 'button' }, 'Open');
    openButton.addEventListener('click', () => onLoad(entry));
    const remove = el('button', { type: 'button', class: 'delete', 'aria-label': `Delete this job (${summarize(entry).nup})` }, 'Delete');
    remove.addEventListener('click', () => onDelete(index));
    return el('div', { class: 'history-row' }, open,
      el('div', { class: 'history-actions' }, openButton, copyLink(entry), remove));
  }

  /** A deletion is offered back for a few seconds: a mis-tap on a phone costs nothing. */
  function undoBar(pending) {
    const undo = el('button', { type: 'button' }, 'Undo');
    undo.addEventListener('click', onUndo);
    return el('div', { class: 'panel undo-bar' },
      el('span', {}, `Deleted ${summarize(pending.entry).nup} job.`), undo);
  }

  // Clearing is two taps within a few seconds, not a dialog — it's a phone.
  function clearButton() {
    const button = el('button', { type: 'button', class: 'clear' }, 'Clear history');
    button.addEventListener('click', () => {
      if (armed) {
        clearTimeout(armed);
        armed = null;
        onClear();
        return;
      }
      button.textContent = 'Tap again to clear';
      armed = setTimeout(() => {
        armed = null;
        button.textContent = 'Clear history';
      }, CLEAR_ARM_MS);
    });
    return button;
  }

  return {
    render(entries, { unit, available, now, pendingUndo = null }) {
      clearTimeout(armed);
      armed = null;
      const children = [];
      if (pendingUndo) children.push(undoBar(pendingUndo));
      if (entries.length === 0) {
        children.push(el('p', { class: 'empty' }, 'Jobs you set up appear here after about 15 seconds.'));
      } else {
        children.push(
          el('div', { class: 'history' }, ...entries.map((entry, index) => row(entry, index, unit, now))),
          el('div', { class: 'actions' }, clearButton()),
        );
      }
      if (!available) children.push(el('p', { class: 'hint' }, "History can't be saved on this device."));
      container.replaceChildren(...children);
    },
  };
}
