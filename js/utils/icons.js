import { ICONS } from '../icons.js';

/** Render an inline SVG icon. `size` is in px. */
export function icon(name, size = 16, extraClass = '') {
  const paths = ICONS[name] || ICONS.info;
  return `<svg class="icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${paths}</svg>`;
}

export { ICONS };
