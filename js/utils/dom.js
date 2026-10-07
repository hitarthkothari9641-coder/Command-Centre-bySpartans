/**
 * DOM + formatting utilities.
 * Small, dependency-free helpers shared by every component and view.
 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Escape untrusted text before it reaches innerHTML. */
export const esc = (value = '') =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** Build an element from an HTML string (first root node). */
export function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || '')
    .join('')
    .toUpperCase();

/* ── Time & numbers ────────────────────────────────────────────────────── */

export function timeAgo(ts) {
  if (!ts) return '—';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const clockTime = (ts = Date.now()) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export const clockWithSeconds = (ts = Date.now()) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export const fullDateTime = (ts) => new Date(ts).toLocaleString();

/** mm:ss (or hh:mm:ss) for a duration in seconds. */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${h ? `${pad(h)}:` : ''}${pad(m)}:${pad(sec)}`;
}

export const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** Deterministic colour per name so avatars stay stable between renders. */
const AVATAR_TONES = ['#22d3ee', '#8b5cf6', '#f59e0b', '#10b981', '#38bdf8', '#f472b6', '#a3e635', '#fb7185'];
export function avatarTone(name = '') {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** Debounce a callback (used for search inputs). */
export function debounce(fn, wait = 160) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Trap focus inside a container (modals). Returns a cleanup function. */
export function trapFocus(container) {
  const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const onKeydown = (event) => {
    if (event.key !== 'Tab') return;
    const nodes = $$(selector, container).filter((node) => !node.disabled && node.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}
