import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { ShortcutsBody } from '../components/ModalForms.js';
import * as selectors from '../store/selectors.js';

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

export const SettingsMeta = { title: 'Settings', subtitle: 'House configuration and data' };
