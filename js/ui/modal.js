/** Modal — accessible dialog used for every form and destructive confirmation. */
import { $, $$, el, esc, trapFocus, clockTime } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

let releaseFocusTrap = null;
let onSubmitHandler = null;

function nodes() {
  return {
    modal: $('#modal'),
    title: $('#modalTitle'),
    desc: $('#modalDesc'),
    body: $('#modalBody'),
    foot: $('#modalFoot'),
  };
}

/**
 * Open the modal.
 * @param {{
 *   title: string,
 *   desc?: string,
 *   body?: string,            // HTML string
 *   actions?: Array<{label: string, tone?: string, icon?: string, primary?: boolean,
 *                    onClick?: (body: HTMLElement) => false|void, keepOpen?: boolean}>,
 *   onOpen?: (body: HTMLElement) => void,
 *   onSubmit?: (body: HTMLElement) => void,
 * }} config
 */
export function openModal({ title, desc = '', body = '', actions = [], onOpen, onSubmit }) {
  const { modal, title: titleEl, desc: descEl, body: bodyEl, foot } = nodes();
  if (!modal) return;

  titleEl.textContent = title;
  descEl.textContent = desc;
  descEl.hidden = !desc;
  bodyEl.innerHTML = body;
  foot.innerHTML = '';
  onSubmitHandler = onSubmit || null;

  const list = actions.length ? actions : [{ label: 'Close', primary: false }];
  list.forEach((action) => {
    const button = el(
      `<button class="btn ${action.primary ? 'btn--primary' : action.tone ? `btn--${action.tone}` : ''}" type="button">
        ${action.icon ? icon(action.icon, 14) : ''}<span class="btn__label">${esc(action.label)}</span>
      </button>`,
    );
    button.dataset.action = 'modal:action';
    button.addEventListener('click', () => {
      try {
        const result = action.onClick ? action.onClick(bodyEl) : undefined;
        if (result !== false && !action.keepOpen) closeModal();
      } catch (error) {
        // Errors are surfaced by the caller (action layer) as toasts.
        console.error(error);
      }
    });
    foot.appendChild(button);
  });

  modal.dataset.primaryIndex = String(Math.max(0, list.findIndex((a) => a.primary)));
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');

  releaseFocusTrap?.();
  releaseFocusTrap = trapFocus(modal);

  onOpen?.(bodyEl);
  const firstField = bodyEl.querySelector('input, select, textarea');
  if (firstField) setTimeout(() => firstField.focus(), 80);
  else setTimeout(() => foot.querySelector('.btn--primary')?.focus(), 80);
}

export function closeModal() {
  const { modal } = nodes();
  if (!modal || !modal.classList.contains('is-open')) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
  releaseFocusTrap?.();
  releaseFocusTrap = null;
  onSubmitHandler = null;
}

export const isModalOpen = () => $('#modal')?.classList.contains('is-open') ?? false;

/** Confirmation dialog for destructive actions. */
export function confirmModal({ title, desc, body = '', confirmLabel = 'Confirm', tone = 'danger', onConfirm }) {
  return openModal({
    title,
    desc,
    body,
    actions: [
      { label: 'Cancel', tone: 'ghost' },
      {
        label: confirmLabel,
        tone,
        icon: tone === 'danger' ? 'alert' : 'check',
        onClick: (bodyEl) => {
          const result = onConfirm?.(bodyEl);
          return result === false ? false : undefined;
        },
      },
    ],
  });
}

/** Wire Esc + Enter handling once. */
export function initModal() {
  const { modal, body, foot } = nodes();
  if (!modal) return;
  modal.addEventListener('mousedown', (event) => {
    if (event.target === modal) closeModal();
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeModal();
      return;
    }
    if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA' && !event.target.matches('button')) {
      event.preventDefault();
      onSubmitHandler?.(body);
      const index = Number(modal.dataset.primaryIndex || 0);
      foot.children[index]?.click();
    }
  });
}

/** Small helper used by modal footers that display a live clock. */
export const modalStamp = () => clockTime(Date.now());
