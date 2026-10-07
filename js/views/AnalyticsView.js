/**
 * Performance analytics — the House, measured.
 *
 * Everything on this screen is derived from the audit log (see
 * `js/store/analytics.js`), so the numbers move as the House moves and can be
 * exported for a post-season review.
 */
import { esc, clockTime } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Avatar } from '../components/Avatar.js';
import { EmptyState } from '../components/EmptyState.js';
import { AreaChart, BarChart, Donut, KpiCard, Sparkline } from '../components/charts.js';
import * as analytics from '../store/analytics.js';

const cardHead = (title, iconName, meta = '', actions = '') => `
  <header class="card__head">
    <div class="card__title"><span class="card__icon">${icon(iconName, 15)}</span><h3>${esc(title)}</h3></div>
    ${meta ? `<span class="card__meta">${esc(meta)}</span>` : ''}
    <span class="spacer"></span>
    ${actions}
  </header>
`;

const signed = (value) => `${value > 0 ? '+' : ''}${value}`;

export function AnalyticsView(state) {
  const rangeId = state.ui.analyticsRange || analytics.DEFAULT_RANGE;
  const range = analytics.rangeOf(rangeId);
  const kpi = analytics.kpis(state, rangeId);
  const coverage = analytics.coverage(state, rangeId);
  const buckets = analytics.buckets(state, rangeId);
  const curve = analytics.cumulative(state, rangeId);
  const teams = analytics.teamBreakdown(state, rangeId);
  const form = analytics.contestantForm(state, rangeId);
  const rate = analytics.eventRate(state, 10);
  const notes = analytics.insights(state, rangeId);

  const empty = state.log.length === 0;
  const bucketLabel = (at) => clockTime(at);

  const tickSpark = buckets.rows.map((row) => row.events);

  return `
    <div class="view-head">
      <div class="view-head__meta">
        <h2>Performance Analytics</h2>
        <p>
          Derived from the House audit log · window ${esc(range.label)} ·
          ${kpi.events} event${kpi.events === 1 ? '' : 's'} · updated ${esc(clockTime(Date.now()))}
        </p>
      </div>
      <span class="spacer"></span>
      <div class="view-head__actions">
        <div class="filter-bar">
          <span class="filter-bar__tag">${icon('calendar', 12)}<span>Window</span></span>
          <div class="seg" id="analyticsRange" role="group" aria-label="Analytics window">
            ${analytics.RANGES.map(
              (option) => `
              <button type="button" data-action="analytics:range" data-range="${option.id}"
                class="${option.id === rangeId ? 'is-on' : ''}">${esc(option.label)}</button>`,
            ).join('')}
          </div>
        </div>
        <button class="btn btn--sm btn--ghost" data-action="analytics:export">
          ${icon('download', 14)} Export CSV
        </button>
      </div>
    </div>

    ${
      empty
        ? `<section class="card glass">${EmptyState({
            icon: 'bar-chart',
            title: 'No history to analyse yet',
            text: 'Award points, complete a task or reset the demo data to rebuild the House ledger.',
          })}</section>`
        : ''
    }

    <div class="kpi-row">
      ${[
        KpiCard({
          label: 'House Points',
          value: kpi.totalPoints,
          meta: `${kpi.average} avg · spread ${kpi.spread}`,
          icon: 'trophy',
          tone: 'gold',
          spark: curve.values,
          index: 0,
        }),
        KpiCard({
          label: `Points in ${range.label}`,
          value: kpi.awarded,
          meta: `${kpi.positive} awarded · ${kpi.deductions} deducted`,
          icon: 'zap',
          tone: 'cyan',
          index: 1,
        }),
        KpiCard({
          label: 'Momentum',
          value: `${signed(kpi.momentum)}%`,
          meta: 'second half vs first half',
          icon: kpi.momentum >= 0 ? 'trending-up' : 'trending-down',
          tone: kpi.momentum >= 0 ? 'emerald' : 'amber',
          index: 2,
        }),
        KpiCard({
          label: 'Event Rate',
          value: `${kpi.eventsPerHour}/h`,
          meta: `${kpi.events} events in window · ${rate.perMinute}/min live`,
          icon: 'activity',
          tone: 'violet',
          spark: tickSpark,
          index: 3,
        }),
        KpiCard({
          label: 'Task Throughput',
          value: `${kpi.completionRate}%`,
          meta: `${kpi.tasksCompleted} completed in range · ${kpi.tasksOpen} open`,
          icon: 'clipboard',
          tone: kpi.completionRate >= 50 ? 'emerald' : 'amber',
          index: 4,
        }),
        KpiCard({
          label: 'Danger & Immunity',
          value: kpi.nomineeCount,
          meta: `${kpi.immuneCount} immune · ${kpi.activeCount} active`,
          icon: kpi.nomineeCount ? 'alert' : 'shield',
          tone: kpi.nomineeCount ? 'crimson' : 'emerald',
          index: 5,
        }),
      ].join('')}
    </div>

    <div class="analytics-grid">
      <section class="card glass analytics-grid__wide">
        ${cardHead('Points Velocity', 'trending-up', `cumulative House points · ${range.label}`, `
          <span class="card__meta">${signed(kpi.awarded)} pts in window</span>
        `)}
        <div class="card__body">
          ${AreaChart(curve.values, {
            tone: 'cyan',
            height: 88,
            label: 'Cumulative House points',
            summary: `House points grew from ${curve.start} to ${curve.values[curve.values.length - 1] || curve.start} over the selected window.`,
            note: `${clockTime(curve.from)} → ${clockTime(curve.to)}`,
          })}
        </div>
      </section>

      <section class="card glass">
        ${cardHead('Awards per Interval', 'bar-chart', 'points awarded per bucket')}
        <div class="card__body">
          ${BarChart(
            buckets.rows.map((row) => ({ label: bucketLabel(row.at), value: row.points, tone: 'cyan' })),
            {
              label: 'Points awarded per interval',
              summary: `Largest award bucket: ${Math.max(...buckets.rows.map((row) => row.points), 0)} pts.`,
              empty: 'No points awarded in this window',
            },
          )}
        </div>
      </section>

      <section class="card glass">
        ${cardHead('Event Rate', 'activity', `last 10 minutes · ${rate.total} events`)}
        <div class="card__body">
          ${BarChart(
            buckets.rows.map((row) => ({ label: bucketLabel(row.at), value: row.events, tone: 'violet' })),
            {
              label: 'Events per interval',
              summary: `${kpi.events} events in the window, ${rate.perMinute} per minute over the last ten minutes.`,
              empty: 'No events in this window',
            },
          )}
        </div>
      </section>

      <section class="card glass">
        ${cardHead('Team Share', 'pie-chart', `${teams.length} teams`)}
        <div class="card__body">
          ${Donut(
            teams.map((team, index) => ({
              label: `Team ${team.team}`,
              value: team.points,
              tone: ['cyan', 'violet', 'amber', 'emerald'][index % 4],
            })),
            {
              label: 'Share of House points',
              summary: teams.length
                ? `Team ${teams[0].team} holds ${teams[0].share}% of the House points.`
                : 'No teams yet',
            },
          )}
        </div>
      </section>

      <section class="card glass analytics-grid__wide">
        ${cardHead('Form Guide', 'sparkles', `points earned · ${range.label}`, `
          <span class="card__meta">${form.filter((row) => row.gained > 0).length} contestants scored</span>
        `)}
        <div class="card__body card__body--flush">
          <div class="table-wrap">
            <table class="table" id="formTable">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Contestant</th>
                  <th scope="col">Team</th>
                  <th scope="col">Points</th>
                  <th scope="col">Earned in window</th>
                  <th scope="col">Trend</th>
                  <th scope="col">Move</th>
                  <th scope="col">Tasks</th>
                </tr>
              </thead>
              <tbody>
                ${form
                  .map(
                    (row, index) => `
                  <tr data-id="${esc(row.id)}" data-flip="${esc(row.id)}">
                    <td class="table__rank">${index + 1}</td>
                    <td>
                      <span class="table__person">
                        ${Avatar({ id: row.id, name: row.name }, 'sm')}
                        <span>${esc(row.name)}</span>
                      </span>
                    </td>
                    <td><span class="team-dot" data-team="${esc(row.team)}"></span> ${esc(row.team)}</td>
                    <td class="table__num">${row.points}</td>
                    <td class="table__num ${row.gained > 0 ? 'text-success' : row.gained < 0 ? 'text-danger' : 'muted'}">
                      ${esc(signed(row.gained))}
                    </td>
                    <td>${Sparkline(
                      buckets.rows.map((bucket) =>
                        state.log.filter(
                          (entry) =>
                            entry.createdAt >= bucket.at && entry.createdAt < bucket.to && entry.contestantId === row.id,
                        ).length,
                      ),
                      { tone: row.gained >= 0 ? 'emerald' : 'amber', width: 78, height: 22 },
                    )}</td>
                    <td>
                      ${
                        row.movement
                          ? `<span class="movement" data-sign="${row.movement > 0 ? 'up' : 'down'}">
                              ${icon(row.movement > 0 ? 'arrow-up' : 'arrow-down', 11)}${Math.abs(row.movement)}
                            </span>`
                          : '<span class="muted">—</span>'
                      }
                    </td>
                    <td class="table__num">${row.tasksCompleted}</td>
                  </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card__foot">
          <span class="fs-xs muted">
            ${icon('info', 12)} "Move" compares today's rank with the rank each contestant held at the start of the window.
          </span>
          <span class="spacer"></span>
          <span class="fs-xs ${coverage.unaccounted ? 'text-warning' : 'muted'}">
            ${
              coverage.unaccounted
                ? `${coverage.unaccounted} pts of history are outside the log (cleared or trimmed).`
                : `Ledger fully reconciled — ${coverage.booked} pts explained for ${coverage.explained}/${coverage.total} contestants.`
            }
          </span>
        </div>
      </section>

      <section class="card glass">
        ${cardHead('Control-room Insights', 'radio', 'auto-generated')}
        <div class="card__body">
          <ul class="insights" id="insights">
            ${notes
              .map(
                (note) => `
              <li class="insight" data-tone="${esc(note.tone)}">
                <span class="insight__icon">${icon(note.icon, 13)}</span>
                <span class="insight__text">${esc(note.text)}</span>
              </li>`,
              )
              .join('')}
          </ul>
        </div>
      </section>
    </div>
  `;
}

export const AnalyticsMeta = { title: 'Analytics', subtitle: 'Performance analytics for the House' };
