import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

/**
 * Top bar — brand, live clock, House status indicator and the primary
 * "Make Announcement" action.
 * @param {{houseName: string, season: number, day: number, activeCount: number,
 *          nominees: number, title: string, subtitle: string, sidebar: string}} options
 */
export function Header({ houseName, season, day, activeCount, nominees, title, subtitle, sidebar }) {
  const collapsed = sidebar === 'collapsed';
  return `
    <header class="topbar">
      <button class="btn btn--icon btn--ghost" data-action="ui:sidebar"
        aria-label="${collapsed ? 'Expand navigation' : 'Collapse navigation'}"
        aria-expanded="${String(!collapsed)}" title="Toggle navigation (B)">
        ${icon('panel-left', 17)}
      </button>

      <div class="topbar__titles">
        <h1 class="topbar__title">${esc(title)}</h1>
        <p class="topbar__sub">${esc(subtitle)} · ${esc(houseName)} · Season ${season} · Day ${day}</p>
      </div>

      <span class="spacer"></span>

      <div class="topbar__actions">
        <span class="chip chip--live" title="House surveillance is live">
          <i class="live-dot"></i> Live
        </span>

        <span class="chip chip--plain ${nominees ? 'chip--danger' : 'chip--success'}" title="Danger Zone status">
          ${icon(nominees ? 'alert' : 'shield', 13)}
          ${nominees ? `${nominees} at risk` : 'Zone clear'}
        </span>

        <span class="chip chip--plain" title="Active contestants in the House">
          ${icon('users', 13)} ${activeCount} in House
        </span>

        <span class="chip chip--clock" id="houseClock" title="Control room time">
          ${icon('clock', 13)}<span id="headerClock">--:--:--</span>
        </span>

        <button class="btn btn--primary btn--announce" data-action="announcement:open">
          ${icon('megaphone', 15)}<span class="btn__label">Make Announcement</span>
        </button>
      </div>
    </header>
  `;
}

/** Live clock — updated by the app's second-tick. */
export function updateHeaderClock(text) {
  const node = document.getElementById('headerClock');
  if (node) node.textContent = text;
}
