import { esc, timeAgo, clockTime, fullDateTime } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { EmptyState } from './EmptyState.js';

/** Points entries carry their delta, so the feed can show direction. */
const feedIcon = (entry) => {
  if (entry.type === 'points' && typeof entry.delta === 'number') return entry.delta > 0 ? 'arrow-up' : 'arrow-down';
  return TYPE_ICON[entry.type] || 'activity';
};

const TYPE_ICON = {
  points: 'zap',
  nomination: 'alert',
  immunity: 'shield',
  eviction: 'door',
  task: 'clipboard',
  captain: 'crown',
  timer: 'clock',
  contestant: 'user-plus',
  announcement: 'megaphone',
  session: 'power',
};

/**
 * Live event log — "Aarav +20 pts", "Meera nominated", "Rohan evicted"…
 * @param {Array} entries log entries, newest first
 * @param {{limit?: number, scroll?: boolean, emptyText?: string}} options
 */
export function ActivityFeed(entries, { limit = 8, scroll = false, emptyText = 'House events will appear here in real time.' } = {}) {
  const list = limit ? entries.slice(0, limit) : entries;
  if (!list.length) {
    return EmptyState({ icon: 'activity', title: 'No activity yet', text: emptyText, compact: true });
  }
  return `
    <ul class="feed ${scroll ? 'scroll-area' : ''}">
      ${list
        .map(
          (entry) => `
        <li class="feed__item" data-type="${esc(entry.type)}">
          <span class="feed__icon">${icon(feedIcon(entry), 13)}</span>
          <div class="feed__body">
            <div class="feed__text">${esc(entry.message)}</div>
          </div>
          <time class="feed__time" title="${esc(fullDateTime(entry.createdAt))}"
            datetime="${new Date(entry.createdAt).toISOString()}">${esc(clockTime(entry.createdAt))}</time>
        </li>`,
        )
        .join('')}
    </ul>
  `;
}

export const ActivityFooter = (count) => `
  <div class="card__foot">
    <span class="fs-xs muted">${count} event${count === 1 ? '' : 's'} recorded ${timeAgo(Date.now())}</span>
    <span class="spacer"></span>
    <button class="btn btn--sm btn--ghost" data-action="nav:go" data-view="activity">
      Full log ${icon('arrow-right', 13)}
    </button>
  </div>
`;
