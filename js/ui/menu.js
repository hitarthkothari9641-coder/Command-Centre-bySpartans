/**
 * Action menus — the "secondary actions" disclosure used on cards.
 * One menu open at a time; closes on outside click, Escape or selection.
 */
import { $$ } from '../utils/dom.js';

let openMenu = null;

export function toggleMenu(button) {
  const host = button.closest('.has-menu');
  const menu = host?.querySelector('.menu');
  if (!menu) return;

  const isSame = openMenu === menu;
  closeMenus();
  if (isSame) return;

  menu.classList.add('is-open');
  button.setAttribute('aria-expanded', 'true');
  openMenu = menu;

  // Flip the menu upward when it would overflow the viewport.
  const rect = menu.getBoundingClientRect();
  const overflowBottom = rect.bottom > window.innerHeight - 12;
  menu.style.top = overflowBottom ? 'auto' : 'calc(100% + 6px)';
  menu.style.bottom = overflowBottom ? 'calc(100% + 6px)' : 'auto';
}

export function closeMenus() {
  if (!openMenu) return;
  openMenu.classList.remove('is-open');
  openMenu.parentElement?.querySelector('[data-action="menu:toggle"]')?.setAttribute('aria-expanded', 'false');
  openMenu = null;
}

export const isMenuOpen = () => Boolean(openMenu);

export function initMenus() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('.menu')) return;
    if (event.target.closest('[data-action="menu:toggle"]')) return;
    closeMenus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenus();
  });
  window.addEventListener('resize', closeMenus, { passive: true });
  window.addEventListener('scroll', closeMenus, { passive: true, capture: true });
}

/** Re-run after each render so menus never survive a view swap. */
export function onRender() {
  closeMenus();
}
