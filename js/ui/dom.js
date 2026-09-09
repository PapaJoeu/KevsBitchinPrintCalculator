// dom.js — the one DOM helper everything shares.

/**
 * el('button', { type: 'button', class: 'chip', onclick: handler }, 'Label')
 * Attributes: `hidden: true` sets the attribute, `dataset: {}` merges data-*,
 * `onxxx` functions become event listeners, false/null/undefined are skipped.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children);
  return node;
}
