/**
 * Live activity log.
 *
 * The House streams events into this screen: relative timestamps tick every
 * second, new entries pulse in at the top while the live tail is on, and an
 * event-rate gauge shows how busy the room is right now. Pausing the feed is
 * non-destructive — events keep being recorded, the view simply stops moving
 * (a "while you were paused" counter flushes them back).
 */
import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { ActivityFeed } from '../components/ActivityFeed.js';
import { EmptyState } from '../components/EmptyState.js';
import { Sparkline } from '../components/charts.js';
import * as selectors from '../store/selectors.js';
import { eventRate } from '../store/analytics.js';

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
  ['access', 'Access'],
];

const TYPE_TONE = {
  points: 'cyan',
  nomination: 'crimson',
  immunity: 'emerald',
  eviction: 'crimson',
  task: 'amber',
  captain: 'gold',
  timer: 'violet',
  contestant: 'cyan',
  announcement: 'violet',
  access: 'violet',
  session: 'neutral',
};

export function ActivityView(state, filters) {
  const stats = selectors.houseStats(state);
  const rate = eventRate(state, 10);
  const follow = state.ui.feedFollow !== false;
  const paused = Boolean(state.ui.feedPaused);
  const pending = paused ? state.log.filter((entry) => !seenIds.has(entry.id)).length : 0;

  const entries = filters.logType === 'all' ? state.log : state.log.filter((entry) => entry.type === filters.logType);
  const counts = TYPES.filter(([value]) => value !== 'all').map(([value, label]) => ({
    value,
    label,
    count: state.log.filter((entry) => entry.type === value).length,
  }));

  return `
    <div class="view-head">
      <div class="view-head__meta">
        <h2>Live Activity Log</h2>
        <p>
          Every House event, timestamped · ${state.log.length} recorded · Day ${state.house.day}
          ${follow && !paused ? '· following the feed live' : ''}
        </p>
      </div>
      <span class="spacer"></span>
      <div class="view-head__actions">
        <button class="btn btn--sm ${follow && !paused ? 'btn--primary' : 'btn--ghost'}"
          data-action="feed:toggle" aria-pressed="${String(follow && !paused)}"
          title="${follow && !paused ? 'Pause the live tail' : 'Follow new events live'}">
          ${icon(follow && !paused ? 'pause' : 'play', 14)}
          ${follow && !paused ? 'Pause feed' : 'Go live'}
        </button>
        <button class="btn btn--sm btn--ghost" data-action="log:clear">${icon('trash', 14)} Clear log</button>
      </div>
    </div>

    <div class="live-strip" data-paused="${String(paused)}">
      <span class="live-strip__pulse" aria-hidden="true"></span>
      <span class="live-strip__label">
        ${paused ? 'Feed paused — events are still being recorded' : 'Live feed active'}
      </span>
      <span class="live-strip__rate" title="Events per minute over the last 10 minutes">
        ${icon('activity', 13)} <b>${rate.perMinute}</b>/min · ${rate.total} in 10 min
      </span>
      ${Sparkline(rate.series, { tone: paused ? 'amber' : 'cyan', width: 84, height: 22 })}
      <span class="spacer"></span>
      ${
        pending
          ? `<button class="btn btn--xs btn--primary" data-action="feed:toggle">${icon('bell', 12)} ${pending} new while paused</button>`
          : `<span class="fs-xs muted">${icon('radio', 12)} Auto-refresh is on — timestamps update every second.</span>`
      }
    </div>

    <div class="toolbar">
      <div class="filter-bar">
        <span class="filter-bar__tag">${icon('filter', 12)}<span>Event</span></span>
        <div class="seg" id="logTypeFilter" role="group" aria-label="Filter log by event type">
          ${TYPES.map(
            ([value, label]) =>
              `<button type="button" data-type="${value}" class="${filters.logType === value ? 'is-on' : ''}">${label}</button>`,
          ).join('')}
        </div>
      </div>
      <span class="spacer"></span>
      <span class="fs-xs muted">${entries.length} event${entries.length === 1 ? '' : 's'} shown</span>
    </div>

    <div class="grid-split">
      <section class="card glass">
        <header class="card__head">
          <div class="card__title">
            <span class="card__icon">${icon('activity', 15)}</span><h3>House Events</h3>
          </div>
          ${follow && !paused ? '<span class="chip chip--live"><i class="live-dot"></i> Live</span>' : '<span class="card__meta">Paused</span>'}
          <span class="spacer"></span>
          <span class="card__meta">Newest first</span>
        </header>
        <div class="card__body card__body--flush">
          <div class="card__body--scroll" id="feedScroll">
            ${
              entries.length
                ? ActivityFeed(entries, { limit: 200, live: follow && !paused })
                : EmptyState({
                    icon: 'activity',
                    title: 'Nothing logged yet',
                    text:
                      filters.logType === 'all'
                        ? 'House actions will stream in here the moment they happen.'
                        : `No ${filters.logType} events yet — try another filter.`,
                  })
            }
          </div>
        </div>
      </section>

      <div class="stack-16">
        <section class="card glass">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('bar-chart', 15)}</span><h3>Event Mix</h3></div>
            <span class="card__meta">all time</span>
          </header>
          <div class="card__body stack-8">
            ${counts
              .map(
                ({ value, label, count }) => `
              <div class="mix-row" data-tone="${esc(TYPE_TONE[value] || 'cyan')}">
                <span class="mix-row__label">${esc(label)}</span>
                <span class="mix-row__track"><i style="width:${state.log.length ? Math.max(3, Math.round((count / state.log.length) * 100)) : 0}%"></i></span>
                <span class="mix-row__value">${count}</span>
              </div>`,
              )
              .join('')}
          </div>
        </section>

        <section class="card glass">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('gauge', 15)}</span><h3>Event Summary</h3></div>
          </header>
          <div class="card__body stack-8">
            ${[
              ['Events per hour', `${rate.perMinute * 60}/h`.replace(/\.0\/h/, '/h')],
              ['Busiest filter', busyLabel(counts)],
              ['Newest event', state.log[0] ? new Date(state.log[0].createdAt).toLocaleTimeString() : '—'],
              ['Oldest event', state.log.length ? new Date(state.log[state.log.length - 1].createdAt).toLocaleTimeString() : '—'],
            ]
              .map(
                ([label, value]) =>
                  `<div class="kv-row"><span class="kv-row__k">${esc(label)}</span><span class="kv-row__v">${esc(String(value))}</span></div>`,
              )
              .join('')}
          </div>
        </section>

        <section class="card glass">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('route', 15)}</span><h3>House Pulse</h3></div>
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

/** Ids already on screen when the feed was paused (module-level UI memory). */
export const seenIds = new Set();

/** Track what the operator has already been shown. */
export function markSeen(entries) {
  entries.forEach((entry) => seenIds.add(entry.id));
}

function busyLabel(counts) {
  const top = counts.slice().sort((a, b) => b.count - a.count)[0];
  return top ? `${top.label} (${top.count})` : '—';
}

export const ActivityMeta = { title: 'Activity Log', subtitle: 'Every House event, streamed live' };
