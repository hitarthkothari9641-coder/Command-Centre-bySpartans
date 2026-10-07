import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { ShortcutsBody } from '../components/ModalForms.js';
import * as selectors from '../store/selectors.js';
import { ROLES, ROLE_ORDER, roleId, matrixFor, boundCaptain } from '../store/roles.js';
import { NOTIFY_GROUPS, notifyPrefs, unreadCount, describePermission, browserPermission } from '../notifications.js';

export function SettingsView(state) {
  const stats = selectors.houseStats(state);
  const storage = (() => {
    try {
      return `${(JSON.stringify(state).length / 1024).toFixed(1)} KB`;
    } catch {
      return '—';
    }
  })();

  return `
    <div class="view-head">
      <div class="view-head__meta">
        <h2>Settings &amp; Data</h2>
        <p>House configuration, appearance, backups and demo data</p>
      </div>
      <span class="spacer"></span>
      <div class="view-head__actions">
        <button class="btn btn--sm btn--ghost" data-action="advance-day">${icon('calendar', 14)} Advance to Day ${state.house.day + 1}</button>
      </div>
    </div>

    <div class="grid-2">
      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('settings', 15)}</span><h3>House Configuration</h3></div>
        </header>
        <div class="card__body stack-16">
          <label class="field">
            <span class="field__label">House name</span>
            <input class="input" id="houseNameInput" value="${esc(state.house.name)}" />
          </label>
          <div class="grid-2" style="gap:var(--s-3)">
            <label class="field">
              <span class="field__label">Season</span>
              <input class="input" id="houseSeasonInput" type="number" min="1" value="${state.house.season}" />
            </label>
            <label class="field">
              <span class="field__label">Day</span>
              <input class="input" value="${state.house.day}" readonly />
            </label>
          </div>
          <button class="btn btn--primary btn--sm" data-action="house:save">${icon('check', 14)} Save configuration</button>
        </div>
      </section>

      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('sliders', 15)}</span><h3>Appearance</h3></div>
        </header>
        <div class="card__body stack-16">
          <label class="switch">
            <input type="checkbox" id="backgroundToggle" ${state.ui.background ? 'checked' : ''} />
            <span class="switch__track"></span>
            <span>${icon('eye', 13)} Animated 3D control-room background</span>
          </label>
          <label class="switch">
            <input type="checkbox" id="sidebarToggle" ${state.ui.sidebar === 'collapsed' ? 'checked' : ''} />
            <span class="switch__track"></span>
            <span>${icon('panel-left', 13)} Collapse the sidebar by default</span>
          </label>
          <p class="fs-xs muted">
            ${icon('info', 12)} The background respects <span class="kbd">prefers-reduced-motion</span> and pauses when the tab is hidden.
          </p>
        </div>
      </section>
    </div>

    <div class="grid-2" style="margin-top:var(--s-4)">
      ${accessCard(state)}
      ${notificationsCard(state)}
    </div>

    <div class="grid-2" style="margin-top:var(--s-4)">
      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('database', 15)}</span><h3>Data &amp; Backup</h3></div>
        </header>
        <div class="card__body stack-16">
          <p class="fs-sm muted">
            The House persists to <code>localStorage</code> on every change — a refresh never wipes the season.
          </p>
          <div class="row-8">
            <button class="btn btn--sm" data-action="house:export">${icon('download', 14)} Export JSON</button>
            <button class="btn btn--sm" data-action="house:import">${icon('upload', 14)} Import JSON</button>
          </div>
          <div class="divider"></div>
          <div class="row-8">
            <button class="btn btn--sm btn--warning" data-action="house:reset">${icon('reset', 14)} Reset demo data</button>
            <button class="btn btn--sm btn--danger" data-action="house:clear">${icon('trash', 14)} Empty the House</button>
          </div>
          <p class="fs-xs muted">Reset demo data restores the 12-contestant season. Emptying removes every record.</p>
        </div>
      </section>

      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('keyboard', 15)}</span><h3>Shortcuts &amp; System</h3></div>
        </header>
        <div class="card__body stack-16">
          ${ShortcutsBody()}
          <div class="divider"></div>
          <div class="stack-8">
            <div class="kv-row"><span class="kv-row__k">Contestants</span><span class="kv-row__v">${stats.total} (${stats.activeCount} active)</span></div>
            <div class="kv-row"><span class="kv-row__k">Tasks</span><span class="kv-row__v">${stats.tasksTotal} (${stats.tasksCompleted} completed)</span></div>
            <div class="kv-row"><span class="kv-row__k">Announcements</span><span class="kv-row__v">${state.announcements.length}</span></div>
            <div class="kv-row"><span class="kv-row__k">Log entries</span><span class="kv-row__v">${state.log.length}</span></div>
            <div class="kv-row"><span class="kv-row__k">Stored size</span><span class="kv-row__v">${storage}</span></div>
            <div class="kv-row"><span class="kv-row__k">Build</span><span class="kv-row__v">Command Center v2.0</span></div>
          </div>
        </div>
      </section>
    </div>
  `;
}

/* ── Access control ────────────────────────────────────────────────────── */

function accessCard(state) {
  const current = ROLES[roleId(state)];
  const captain = boundCaptain(state);

  return `
    <section class="card glass" id="accessCard">
      <header class="card__head">
        <div class="card__title"><span class="card__icon">${icon('key', 15)}</span><h3>Access Control</h3></div>
        <span class="card__meta">signed in as ${esc(current.label)}</span>
      </header>
      <div class="card__body stack-16">
        <p class="fs-sm muted">
          Four roles operate the Command Center. The switcher below is the demo "sign in" surface —
          every House action is checked against the role policy in the store, and blocked attempts are
          written to the live log.
        </p>

        <div class="role-grid" id="roleSwitcher" role="radiogroup" aria-label="Signed-in role">
          ${ROLE_ORDER.map((id) => {
            const role = ROLES[id];
            const active = id === current.id;
            return `
              <button class="role-card" data-action="role:set" data-role="${id}" data-tone="${role.tone}"
                role="radio" aria-checked="${String(active)}" data-active="${String(active)}">
                <span class="role-card__icon">${icon(role.icon, 15)}</span>
                <span class="role-card__body">
                  <span class="role-card__name">${esc(role.label)}${active ? ' · active' : ''}</span>
                  <span class="role-card__tag">${esc(role.tagline)}</span>
                </span>
                ${active ? `<span class="role-card__check">${icon('check', 14)}</span>` : ''}
              </button>`;
          }).join('')}
        </div>

        ${
          current.id === 'captain'
            ? `<p class="fs-xs ${captain ? 'muted' : 'text-warning'}">
                ${icon('info', 12)}
                ${
                  captain
                    ? `Captain scope follows the House Captain: <strong>${esc(captain.name)}</strong> · Team ${esc(captain.team)}.`
                    : 'No House Captain is seated, so the Captain role has no team to act on.'
                }
              </p>`
            : ''
        }

        <div class="divider"></div>

        <table class="table table--matrix" id="permissionMatrix">
          <caption class="fs-xs muted">What each role may do — derived from the same policy the store enforces.</caption>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              ${ROLE_ORDER.map((id) => `<th scope="col">${esc(ROLES[id].label)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${matrixFor(current.id)
              .map(
                (row) => `
              <tr>
                <th scope="row">${esc(row.label)}</th>
                ${ROLE_ORDER.map(
                  (id) =>
                    `<td class="table__mark" data-allow="${String(row.allow.includes(id))}">${
                      row.allow.includes(id) ? icon('check', 13) : icon('x', 12)
                    }</td>`,
                ).join('')}
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

/* ── Event notifications ───────────────────────────────────────────────── */

function notificationsCard(state) {
  const prefs = notifyPrefs(state);
  const permission = browserPermission();
  const unread = unreadCount(state);

  return `
    <section class="card glass" id="notifyCard">
      <header class="card__head">
        <div class="card__title"><span class="card__icon">${icon('bell', 15)}</span><h3>Notifications</h3></div>
        <span class="card__meta">${unread} unread · ${state.notifications.length} kept</span>
      </header>
      <div class="card__body stack-16">
        <label class="switch">
          <input type="checkbox" id="browserNotifyToggle" ${prefs.browser ? 'checked' : ''} />
          <span class="switch__track"></span>
          <span>${icon('radio', 13)} Browser (OS) notifications</span>
        </label>
        <p class="fs-xs muted" style="margin-top:calc(var(--s-2) * -1)">
          ${icon('info', 12)} ${esc(describePermission())}
        </p>

        <label class="switch">
          <input type="checkbox" id="dndToggle" ${prefs.dnd ? 'checked' : ''} />
          <span class="switch__track"></span>
          <span>${icon('bell-off', 13)} Do not disturb — silence toasts and OS alerts</span>
        </label>

        <div class="divider"></div>

        <span class="field__label">Alert categories</span>
        <div class="chip-grid">
          ${NOTIFY_GROUPS.map(
            (group) => `
            <label class="checkbox-chip ${prefs.groups[group.id] !== false ? 'is-on' : ''}" data-tone="${group.tone}">
              <input type="checkbox" data-notify-group="${group.id}" ${prefs.groups[group.id] !== false ? 'checked' : ''} />
              ${icon(group.icon, 13)}<span>${esc(group.label)}</span>
            </label>`,
          ).join('')}
        </div>

        <div class="divider"></div>

        <label class="switch">
          <input type="checkbox" id="feedSimToggle" ${state.ui.simulateFeed ? 'checked' : ''} />
          <span class="switch__track"></span>
          <span>${icon('flask', 13)} Demo feed simulator — a House event every ~10 s</span>
        </label>
        <p class="fs-xs muted" style="margin-top:calc(var(--s-2) * -1)">
          ${icon('info', 12)} Off by default. When on, the control room generates plausible House events
          (points, task updates, log entries) so the live log, analytics and notifications keep moving while you watch.
        </p>

        ${
          permission === 'denied' || permission === 'unsupported'
            ? `<p class="fs-xs text-warning">${icon('alert', 12)} ${esc(describePermission())}</p>`
            : ''
        }
      </div>
      <div class="card__foot">
        <button class="btn btn--xs btn--ghost" data-action="notify:open">${icon('bell', 12)} Open notification centre</button>
        <span class="spacer"></span>
        <button class="btn btn--xs btn--ghost" data-action="notify:test">${icon('play', 12)} Send test alert</button>
      </div>
    </section>
  `;
}

export const SettingsMeta = { title: 'Settings', subtitle: 'House configuration, access and data' };
