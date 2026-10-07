/**
 * Notification panel chrome — mounting, opening, closing.
 * The markup itself lives in `js/components/NotificationCentre.js`.
 */
import { $, el } from '../utils/dom.js';
import { NotificationPanel } from '../components/NotificationCentre.js';

let host = null;
let outsideHandler = null;

function ensureHost() {
  if (host?.isConnected) return host;
  host = $('#notifyPanel');
  if (host) return host;
  host = el('<aside class="notify glass" id="notifyPanel" role="dialog" aria-label="Notification centre" hidden></aside>');
  document.body.appendChild(host);
  return host;
}

export const isNotifyPanelOpen = () => Boolean(host && !host.hidden);

/** Repaint the panel from state (cheap — a few dozen nodes at most). */
export function renderNotifyPanel(state) {
  const node = ensureHost();
  if (!node || node.hidden) return; // nothing to repaint while the panel is closed
  node.innerHTML = NotificationPanel(state);
  const bell = $('.bell');
  if (bell) bell.setAttribute('aria-expanded', String(!node.hidden));
}

export function openNotifyPanel(state) {
  const node = ensureHost();
  if (!node) return;
  node.hidden = false;
  document.body.dataset.notify = 'open';
  renderNotifyPanel(state);
  $('.bell')?.setAttribute('aria-expanded', 'true');

  outsideHandler = (event) => {
    if (node.contains(event.target) || event.target.closest('.bell') || event.target.closest('[data-action^="notify:"]')) return;
    closeNotifyPanel();
  };
  setTimeout(() => document.addEventListener('pointerdown', outsideHandler), 0);
  node.querySelector('.notify__head button')?.focus?.();
}

export function closeNotifyPanel() {
  const node = ensureHost();
  if (!node) return;
  node.hidden = true;
  document.body.dataset.notify = 'closed';
  $('.bell')?.setAttribute('aria-expanded', 'false');
  if (outsideHandler) {
    document.removeEventListener('pointerdown', outsideHandler);
    outsideHandler = null;
  }
}

export function toggleNotifyPanel(state) {
  if (isNotifyPanelOpen()) closeNotifyPanel();
  else openNotifyPanel(state);
}
