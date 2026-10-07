import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

/** Empty state with an optional call to action. */
export function EmptyState({ icon: iconName = 'info', title, text = '', action = '', compact = false }) {
  return `
    <div class="empty ${compact ? 'empty--inline' : ''}">
      <div class="empty__icon">${icon(iconName, 22)}</div>
      <div class="empty__title">${esc(title)}</div>
      ${text ? `<p class="empty__text">${esc(text)}</p>` : ''}
      ${action}
    </div>
  `;
}

export const SkeletonStat = () => '<div class="skeleton skeleton--stat"></div>';
export const SkeletonRow = () => '<div class="skeleton skeleton--row"></div>';
export const SkeletonCard = () => '<div class="skeleton skeleton--card"></div>';

/** Loading skeleton shown for the first paint, before the store hydrates views. */
export function DashboardSkeleton() {
  return `
    <div class="skeleton-grid">
      ${Array.from({ length: 6 }).map(() => SkeletonStat()).join('')}
    </div>
    <div class="skeleton-grid skeleton-grid--stack">
      ${Array.from({ length: 4 }).map(() => SkeletonRow()).join('')}
    </div>
  `;
}
