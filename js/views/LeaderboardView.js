import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { LeaderboardList, Podium } from '../components/Leaderboard.js';
import { EmptyState } from '../components/EmptyState.js';
import { ActivityFeed } from '../components/ActivityFeed.js';
import { TeamStandings } from '../components/HouseStats.js';
import * as selectors from '../store/selectors.js';

export function LeaderboardView(state, filters) {
  const stats = selectors.houseStats(state);
  const board = selectors.leaderboard(state);
  const maxPoints = selectors.maxPoints(state);
  const teams = [...new Set(state.contestants.map((c) => c.team))];
  const scoped = filters.team === 'all' ? board : board.filter((c) => c.team === filters.team);
  const pointsEvents = state.log.filter((entry) => entry.type === 'points');

  return `
    <div class="view-head">
      <div class="view-head__meta">
        <h2>Live Leaderboard</h2>
        <p>Rankings recompute instantly on every point change · ${stats.totalPoints} house points across ${stats.activeCount} contestants</p>
      </div>
      <span class="spacer"></span>
      <div class="view-head__actions">
        <div class="filter-bar">
          <span class="filter-bar__tag">${icon('filter', 12)}<span>Team</span></span>
          <div class="seg" id="boardTeamFilter" role="group" aria-label="Filter by team">
            <button type="button" data-team="all" class="${filters.team === 'all' ? 'is-on' : ''}">All teams</button>
            ${teams
              .map(
                (team) =>
                  `<button type="button" data-team="${esc(team)}" class="${filters.team === team ? 'is-on' : ''}">${esc(team)}</button>`,
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="grid-stats stagger" style="margin-bottom:var(--s-4)">
      ${Podium(board)}
      <article class="stat glass" data-tone="emerald" style="--i:3">
        <div class="stat__top"><span class="stat__icon">${icon('gauge', 14)}</span><span class="stat__label">Average Score</span></div>
        <div class="stat__value" data-count-to="${stats.averagePoints}" data-count-key="board:avg">0</div>
        <div class="stat__meta">House average</div>
      </article>
      <article class="stat glass" data-tone="cyan" style="--i:4">
        <div class="stat__top"><span class="stat__icon">${icon('zap', 14)}</span><span class="stat__label">Total Points</span></div>
        <div class="stat__value" data-count-to="${stats.totalPoints}" data-count-key="board:total">0</div>
        <div class="stat__meta">Earned this season</div>
      </article>
      <article class="stat glass" data-tone="crimson" style="--i:5">
        <div class="stat__top"><span class="stat__icon">${icon('alert', 14)}</span><span class="stat__label">In Danger</span></div>
        <div class="stat__value" data-count-to="${stats.nomineeCount}" data-count-key="board:danger">0</div>
        <div class="stat__meta">Facing eviction</div>
      </article>
    </div>

    <section class="card glass">
      <header class="card__head">
        <div class="card__title"><span class="card__icon">${icon('trophy', 15)}</span><h3>Full Rankings</h3></div>
        <span class="card__meta">${scoped.length} active contestant${scoped.length === 1 ? '' : 's'}</span>
        <span class="spacer"></span>
        <span class="chip chip--plain">${icon('zap', 12)} +10 / −10 quick adjust</span>
      </header>
      <div class="card__body card__body--flush">
        ${LeaderboardList(scoped, { maxPoints, scroll: scoped.length > 8 })}
      </div>
    </section>

    <div class="grid-2" style="margin-top:var(--s-4)">
      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('layers', 15)}</span><h3>Team Standings</h3></div>
          <span class="spacer"></span>
          ${
            stats.leadingTeam
              ? `<span class="badge badge--captain">${icon('crown', 11)} Team ${esc(stats.leadingTeam.team)} leads</span>`
              : ''
          }
        </header>
        <div class="card__body">${TeamStandings(stats)}</div>
      </section>

      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('activity', 15)}</span><h3>Point Movements</h3></div>
          <span class="spacer"></span>
          <button class="btn btn--sm btn--ghost" data-action="nav:go" data-view="activity">Full log</button>
        </header>
        <div class="card__body card__body--flush">
          ${
            pointsEvents.length
              ? ActivityFeed(pointsEvents, { limit: 8, scroll: true })
              : EmptyState({ icon: 'zap', title: 'No point changes yet', text: 'Award or deduct points to move the board.', compact: true })
          }
        </div>
      </section>
    </div>
  `;
}

export const LeaderboardMeta = { title: 'Leaderboard', subtitle: 'Rankings update with every point' };
