// copyLink.js — a "Copy link" button. Copies via the clipboard API and says "Copied";
// where that API is missing (http on a bench PC, some webviews) it reveals the link
// in a read-only field, selected, so a long-press copy still works.
import { el } from './dom.js';

/** @param getUrl  () => string — read at click time so the link is always current. */
export function createCopyLink(getUrl) {
  const button = el('button', { type: 'button', class: 'copy-link' }, 'Copy link');
  const fallback = el('input', { type: 'text', readonly: true, hidden: true, 'aria-label': 'Link to this job' });
  let reset = null;
  button.addEventListener('click', async () => {
    const url = getUrl();
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (copied) {
      button.textContent = 'Copied';
      clearTimeout(reset);
      reset = setTimeout(() => { button.textContent = 'Copy link'; }, 1500);
    } else {
      fallback.value = url;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
    }
  });
  return el('span', { class: 'copy-link-wrap' }, button, fallback);
}
