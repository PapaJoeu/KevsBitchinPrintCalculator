// tabs.js — a Win98 tab strip. Renders the buttons and their selected state; the
// app shows and hides the matching panels (hidden attribute) so this stays dumb.
import { el } from './dom.js';

/**
 * @param tabs  [{ id, label }] — panel ids are `panel-<id>`, button ids `tab-<id>`
 * @returns { select(id), setBadge(id, count) }
 */
export function createTabs(container, tabs, { onSelect }) {
  const items = new Map();
  const list = el('div', { class: 'tabs', role: 'tablist' });
  for (const { id, label } of tabs) {
    const badge = el('span', { class: 'badge', hidden: true });
    const button = el('button', {
      type: 'button', role: 'tab', id: `tab-${id}`, 'aria-selected': 'false', 'aria-controls': `panel-${id}`, dataset: { tab: id },
    }, label, badge);
    button.addEventListener('click', () => onSelect(id));
    items.set(id, { button, badge });
    list.append(button);
  }
  container.replaceChildren(list);
  return {
    select(id) {
      for (const [key, { button }] of items) button.setAttribute('aria-selected', String(key === id));
    },
    setBadge(id, count) {
      const { badge } = items.get(id);
      badge.textContent = String(count);
      badge.hidden = count === 0;
    },
  };
}
