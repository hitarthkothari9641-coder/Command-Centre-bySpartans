/** Toast notifications — every House action reports back here. */
import { $, el, esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

const TONE_ICON = {
  info: 'info',
  success: 'check',
  error: 'alert',
  warning: 'shield',
  points: 'zap',
  eviction: 'door',
};

function mount() {
  let host = $('#toasts');
  if (!host) {
    host = el('<div class="toasts" id="toasts" role="status" aria-live="polite" aria-atomic="false"></div>');
    document.body.appendChild(host);
  }
  return host;
}

/**
 * Show a toast.
 * @param {string} message
 * @param {{tone?: 'info'|'success'|'error'|'warning', title?: string, duration?: number, icon?: string}} options
 */
export function toast(message, options = {}) {
  const { tone = 'info', title = '', duration = 3600, icon: iconName } = options;
  const host = mount();

  const node = el(`
    <div class="toast" data-tone="${tone}" role="status">
      <span class="toast__icon">${icon(iconName || TONE_ICON[tone] || 'info', 14)}</span>
      <div class="toast__body">
        ${title ? `<div class="toast__title">${esc(title)}</div>` : ''}
        <div class="toast__msg">${esc(message)}</div>
      </div>
      <button class="toast__close" type="button" aria-label="Dismiss notification">${icon('x', 13)}</button>
    </div>
  `);

  const remove = () => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 180);
  };
  node.querySelector('.toast__close').addEventListener('click', remove);
  host.appendChild(node);

  // Keep the stack tidy.
  while (host.children.length > 4) host.firstElementChild.remove();

  const timer = setTimeout(remove, duration);
  node.addEventListener('mouseenter', () => clearTimeout(timer));
  return node;
}

export const toastSuccess = (message, title = 'Done') => toast(message, { tone: 'success', title });
export const toastInfo = (message, title = '') => toast(message, { tone: 'info', title });
export const toastError = (message, title = 'Blocked by Big Boss') => toast(message, { tone: 'error', title });

/** Specialised toast for House-rule violations (e.g. nominating an immune contestant). */
export const toastBlocked = (message) =>
  toast(message, {
    tone: 'warning',
    title: 'Immunity active — nomination denied',
    icon: 'shield',
    duration: 4600,
  });

/** Convert a thrown Error into a toast. */
export function toastFromError(error, fallback = 'Something went wrong in the control room.') {
  // House-rule violations are user-facing rejections, not bugs: log them as
  // warnings so the console stays clean for genuine runtime errors.
  if (error instanceof Error && error.message) console.warn('[Big Boss]', error.message);
  else console.error(error);
  return toastError(error instanceof Error && error.message ? error.message : fallback);
}
