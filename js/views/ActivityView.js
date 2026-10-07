import { icon } from '../utils/icons.js';
import { ActivityFeed } from '../components/ActivityFeed.js';
import { EmptyState } from '../components/EmptyState.js';
import * as selectors from '../store/selectors.js';

const TYPES = [
  ['all', 'All'],
  ['points', 'Points'],
  ['nomination', 'Nominations'],
  ['immunity', 'Immunity'],
  ['eviction', 'Evictions'],
  ['task', 'Tasks'],
  ['captain', 'Captaincy'],
  ['timer', 'Timer'],
  ['announcement', 'Announcements'],
];

export function ActivityView(state, filters) {
  const stats = selectors.houseStats(state);
  const entries =
    filters.logType === 'all' ? state.log : state.log.filter((entry) => entry.type === filters.logType);

  return `
    <div class="view-head">
      <div class="view-head__meta">
        <h2>Activity Log</h2>
        <p>Every House event, timestamped · ${state.log.length} recorded · Day ${state.house.day}</p>
      </div>
      <span class="spacer"></span>
      <div class="view-head__actions">
        <button class="btn btn--sm btn--ghost" data-action="log:clear">${icon('trash', 14)} Clear log</button>
      </div>
    </div>

    <div class="toolbar">
      <div class="seg" id="logTypeFilter" role="group" aria-label="Filter log by event type">
        ${TYPES.map(
          ([value, label]) =>
            `<button type="button" data-type="${value}" class="${filters.logType === value ? 'is-on' : ''}">${label}</button>`,
        ).join('')}
      </div>
      <span class="spacer"></span>
      <span class="fs-xs muted">${entries.length} event${entries.length === 1 ? '' : 's'} shown</span>
    </div>

    <div class="grid-split">
      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('activity', 15)}</span><h3>House Events</h3></div>
          <span class="card__meta">Newest first</span>
        </header>
        <div class="card__body card__body--flush">
          <div class="card__body--scroll">
            ${
              entries.length
                ? ActivityFeed(entries, { limit: 200 })
                : EmptyState({ icon: 'activity', title: 'Nothing logged yet', text: 'House actions will stream in here.' })
            }
          </div>
        </div>
      </section>

      <div class="stack-16">
        <section class="card glass">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('gauge', 15)}</span><h3>Event Summary</h3></div>
          </header>
          <div class="card__body stack-8">
            ${[
              ['Point changes', state.log.filter((e) => e.type === 'points').length],
              ['Nominations', state.log.filter((e) => e.type === 'nomination').length],
              ['Immunity actions', state.log.filter((e) => e.type === 'immunity').length],
              ['Evictions', state.log.filter((e) => e.type === 'eviction').length],
              ['Task events', state.log.filter((e) => e.type === 'task').length],
              ['Broadcasts', state.log.filter((e) => e.type === 'announcement').length],
            ]
              .map(
                ([label, count]) =>
                  `<div class="kv-row"><span class="kv-row__k">${label}</span><span class="kv-row__v">${count}</span></div>`,
              )
              .join('')}
          </div>
        </section>

        <section class="card glass">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('clock', 15)}</span><h3>House Pulse</h3></div>
          </header>
          <div class="card__body stack-8">
            <div class="kv-row"><span class="kv-row__k">Round</span><span class="kv-row__v">${stats.round}</span></div>
            <div class="kv-row"><span class="kv-row__k">Active contestants</span><span class="kv-row__v">${stats.activeCount}</span></div>
            <div class="kv-row"><span class="kv-row__k">Danger Zone</span><span class="kv-row__v ${stats.nomineeCount ? 'text-danger' : 'text-success'}">${stats.nomineeCount}</span></div>
            <div class="kv-row"><span class="kv-row__k">Tasks open</span><span class="kv-row__v">${stats.tasksOpen}</span></div>
          </div>
        </section>
      </div>
    </div>
  `;
}

export const ActivityMeta = { title: 'Activity Log', subtitle: 'Every House event, timestamped' };
