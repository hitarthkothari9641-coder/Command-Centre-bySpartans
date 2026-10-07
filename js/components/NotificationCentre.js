/**
 * Notification centre — the bell, the unread badge and the slide-over panel.
 *
 * Rendered from `state.notifications`; the rules that create those items live in
 * `js/notifications.js`. Every item deep-links into the view it came from.
 */
import { esc, timeAgo, fullDateTime } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { EmptyState } from './EmptyState.js';
import { unreadCount, groupOf, notifyPrefs, browserPermission } from '../notifications.js';

/** Bell button for the top bar. */
export function BellButton(state) {
  const unread = unreadCount(state);
  const prefs = notifyPrefs(state);
  return `
    <button class="btn btn--icon btn--ghost bell" data-action="notify:toggle" type="button"
      aria-label="${unread ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'Notifications'}"
      aria-expanded="false" aria-controls="notifyPanel" title="Notifications (I)">
      ${icon(prefs.dnd ? 'bell-off' : 'bell', 17)}
      ${unread ? `<span class="bell__badge" data-count="${unread}">${unread > 9 ? '9+' : unread}</span>` : ''}
    </button>
  `;
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
];

/**
 * The panel itself. `state.ui.notifyFilter` drives the All / Unread / group
 * filters.
 */
export function NotificationPanel(state) {
  const prefs = notifyPrefs(state);
  const filter = state.ui.notifyFilter || 'all';
  const items = (state.notifications || []).filter((item) => {
    if (filter === 'unread') return !item.read;
    if (filter === 'all') return true;
    return item.group === filter;
  });
  const unread = unreadCount(state);
  const groups = [...new Set((state.notifications || []).map((item) => item.group))];

  return `
    <header class="notify__head">
      <div class="notify__title">
        <span class="notify__icon">${icon('bell', 15)}</span>
        <h2>Notifications</h2>
        ${unread ? `<span class="badge badge--alert">${unread} new</span>` : '<span class="badge">All read</span>'}
      </div>
      <div class="notify__tools">
        <button class="btn btn--xs btn--ghost" data-action="notify:readAll" ${unread ? '' : 'disabled'}>
          ${icon('check', 13)} Mark all read
        </button>
        <button class="btn btn--xs btn--ghost" data-action="notify:clear"
          title="Remove notifications you have already read">${icon('trash', 13)} Clear read</button>
        <button class="btn btn--xs btn--ghost" data-action="notify:settings"
          title="Notification preferences">${icon('sliders', 13)} Alerts</button>
        <button class="btn btn--icon btn--ghost" data-action="notify:close" aria-label="Close notifications">
          ${icon('x', 15)}
        </button>
      </div>
    </header>

    <div class="notify__filters" role="group" aria-label="Filter notifications">
      ${FILTERS.map(
        (item) => `
        <button class="notify__filter ${filter === item.id ? 'is-on' : ''}" data-action="notify:filter" data-filter="${item.id}">
          ${esc(item.label)}${item.id === 'unread' && unread ? ` <b>${unread}</b>` : ''}
        </button>`,
      ).join('')}
      ${groups
        .map((id) => {
          const group = groupOf(id);
          return `<button class="notify__filter" data-action="notify:filter" data-filter="${esc(id)}"
            ${filter === id ? 'data-on="true"' : ''} title="Only ${esc(group.label)}">${icon(group.icon, 12)}</button>`;
        })
        .join('')}
    </div>

    <div class="notify__list" role="log" aria-live="polite" aria-relevant="additions">
      ${
        items.length
          ? `<ul class="notices">
              ${items
                .map((item) => {
                  const group = groupOf(item.group);
                  return `
                <li class="notice" data-read="${item.read ? 'true' : 'false'}" data-group="${esc(item.group)}" data-tone="${esc(item.tone || group.tone)}">
                  <span class="notice__icon">${icon(item.icon || group.icon, 14)}</span>
                  <div class="notice__body">
                    <div class="notice__head">
                      <span class="notice__title">${esc(item.title)}</span>
                      <time class="notice__time" datetime="${new Date(item.createdAt).toISOString()}"
                        title="${esc(fullDateTime(item.createdAt))}">${esc(timeAgo(item.createdAt))}</time>
                    </div>
                    <p class="notice__text">${esc(item.body)}</p>
                    <div class="notice__foot">
                      <button class="notice__open" data-action="notify:item" data-id="${esc(item.id)}" data-view="${esc(item.view || 'dashboard')}">
                        ${icon('arrow-right', 12)} Open ${esc(item.view || 'dashboard')}
                      </button>
                      ${
                        item.read
                          ? ''
                          : `<button class="notice__mark" data-action="notify:read" data-id="${esc(item.id)}">Mark read</button>`
                      }
                    </div>
                  </div>
                </li>`;
                })
                .join('')}
            </ul>`
          : EmptyState({
              icon: 'bell',
              title: filter === 'unread' ? 'Nothing unread' : 'No notifications yet',
              text:
                filter === 'unread'
                  ? 'Every alert has been acknowledged. New House events will appear here.'
                  : 'Evictions, nominations, task wins, timer alerts and role changes land here.',
              compact: true,
            })
      }
    </div>

    <footer class="notify__foot">
      <span class="fs-xs muted">
        ${icon('info', 12)}
        ${prefs.browser && browserPermission() === 'granted'
          ? 'OS alerts on — only while this tab is in the background.'
          : 'Enable browser alerts in Settings → Notifications.'}
      </span>
      <span class="spacer"></span>
      <button class="btn btn--xs btn--ghost" data-action="nav:go" data-view="activity">
        ${icon('activity', 12)} Live activity log
      </button>
    </footer>
  `;
}
