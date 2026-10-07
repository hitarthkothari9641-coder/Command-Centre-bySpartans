import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

/** Navigation model — six primary sections, then the House tools. */
export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', group: 'Control room', shortcut: '1' },
  { id: 'contestants', label: 'Contestants', icon: 'users', group: 'Control room', badge: 'contestants', shortcut: '2' },
  { id: 'tasks', label: 'Tasks', icon: 'clipboard', group: 'Control room', badge: 'tasks', shortcut: '3' },
  { id: 'nominations', label: 'Nominations', icon: 'shield', group: 'Control room', badge: 'nominees', shortcut: '4' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy', group: 'Control room', shortcut: '5' },
  { id: 'announcements', label: 'Announcements', icon: 'megaphone', group: 'Control room', shortcut: '6' },
  { id: 'evictions', label: 'Evictions', icon: 'door', group: 'House record', badge: 'evicted', shortcut: '7' },
  { id: 'activity', label: 'Activity Log', icon: 'activity', group: 'House record', shortcut: '8' },
  { id: 'settings', label: 'Settings', icon: 'settings', group: 'House record', shortcut: '9' },
];

const BADGE_TONE = { contestants: '', tasks: 'accent', nominees: 'danger', evicted: '' };

/**
 * Sidebar navigation (bottom tab bar on mobile).
 * @param {{activeView: string, counts: object, collapsed: boolean, captain: object|null}} options
 */
export function Sidebar({ activeView, counts, collapsed, captain }) {
  const groups = [...new Set(NAV.map((item) => item.group))];

  return `
    <div class="brand">
      <span class="brand__mark">${icon('eye', 20)}</span>
      <div class="brand__text">
        <span class="brand__title">BIG BOSS</span>
        <span class="brand__sub">Command Center</span>
      </div>
    </div>

    ${groups
      .map(
        (group) => `
      <nav class="nav-group" aria-label="${esc(group)}">
        <span class="nav-group__label">${esc(group)}</span>
        ${NAV.filter((item) => item.group === group)
          .map((item) => {
            const count = item.badge ? counts[item.badge] : null;
            const showBadge = count !== null && count !== undefined;
            return `
            <button class="nav-item ${activeView === item.id ? 'is-active' : ''}"
              data-action="nav:go" data-view="${item.id}"
              aria-current="${activeView === item.id ? 'page' : 'false'}"
              title="${esc(item.label)} (${item.shortcut})">
              <span class="nav-item__icon">${icon(item.icon, 18)}</span>
              <span class="nav-item__label">${esc(item.label)}</span>
              ${
                showBadge
                  ? `<span class="nav-item__badge" data-tone="${BADGE_TONE[item.badge] || ''}">${count}</span>`
                  : ''
              }
            </button>
          `;
          })
          .join('')}
      </nav>
    `,
      )
      .join('')}

    <div class="sidebar__foot">
      <div class="captain-chip" data-team="${esc(captain?.team || '')}">
        <span class="pill-icon" style="background:var(--gold-soft);border-color:rgba(250,204,21,.3);color:var(--gold)">
          ${icon('crown', 14)}
        </span>
        <div class="captain-chip__meta">
          <span>House Captain</span>
          <strong>${captain ? esc(captain.name) : 'Vacant'}</strong>
        </div>
      </div>

      <button class="btn btn--sm btn--ghost btn--block" data-action="ui:sidebar"
        title="Toggle navigation width (B)">
        ${icon(collapsed ? 'chevron-right' : 'menu', 14)}
        <span class="btn__label">${collapsed ? 'Expand' : 'Collapse'}</span>
      </button>
      <button class="btn btn--sm btn--ghost btn--block" data-action="help:open" title="Keyboard shortcuts (?)">
        ${icon('keyboard', 14)}<span class="btn__label">Shortcuts</span>
      </button>
    </div>
  `;
}
