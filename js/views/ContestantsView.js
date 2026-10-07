import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Avatar } from '../components/Avatar.js';
import { ContestantCard } from '../components/ContestantCard.js';
import { ContestantStatus, TeamBadge } from '../components/Badge.js';
import { EmptyState } from '../components/EmptyState.js';
import { HouseStatsPanel } from '../components/HouseStats.js';
import * as selectors from '../store/selectors.js';


const STATUS_FILTERS = [
  ['active', 'Active'],
  ['nominated', 'Nominated'],
  ['immune', 'Immune'],
  ['evicted', 'Evicted'],
  ['all', 'All'],
];

/**
 * Contestants view — searchable, filterable roster with per-card controls.
 * @param {object} state
 * @param {{query: string, team: string, status: string}} filters
 */
export function ContestantsView(state, filters) {
  const stats = selectors.houseStats(state);
  const teams = [...new Set(state.contestants.map((c) => c.team))];

  let list = state.contestants.slice();
  if (filters.status === 'active') list = list.filter((c) => c.status === 'active');
  if (filters.status === 'nominated') list = list.filter((c) => c.nomination && c.status === 'active');
  if (filters.status === 'immune') list = list.filter((c) => c.immunity && c.status === 'active');
  if (filters.status === 'evicted') list = list.filter((c) => c.status === 'evicted');
  if (filters.team !== 'all') list = list.filter((c) => c.team === filters.team);
  if (filters.query) {
    const query = filters.query.toLowerCase();
    list = list.filter((c) => c.name.toLowerCase().includes(query) || c.team.toLowerCase().includes(query));
  }
  list.sort((a, b) => b.points - a.points);

  return `
    <div class="view-head">
      <div class="view-head__meta">
        <h2>Contestant Management</h2>
        <p>${stats.activeCount} active · ${stats.immuneCount} immune · ${stats.nomineeCount} nominated · ${stats.evictedCount} evicted</p>
      </div>
      <span class="spacer"></span>
      <div class="view-head__actions">
        <button class="btn btn--sm btn--ghost" data-action="immunity:open">${icon('shield', 14)} Grant immunity</button>
        <button class="btn btn--sm btn--danger" data-action="nomination:open">${icon('alert', 14)} Nominate</button>
        <button class="btn btn--primary btn--sm" data-action="contestant:add">${icon('user-plus', 14)} Add contestant</button>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar__grow">
        <input class="input input--search" id="contestantSearch" type="search" placeholder="Search contestants…"
          value="${esc(filters.query)}" aria-label="Search contestants" />
      </div>
      <div class="seg" id="contestantStatusFilter" role="group" aria-label="Filter by status">
        ${STATUS_FILTERS.map(
          ([value, label]) =>
            `<button type="button" data-status="${value}" class="${filters.status === value ? 'is-on' : ''}">${label}</button>`,
        ).join('')}
      </div>
      <select class="select" id="contestantTeamFilter" style="width:auto" aria-label="Filter by team">
        <option value="all">All teams</option>
        ${teams
          .map((team) => `<option value="${esc(team)}" ${filters.team === team ? 'selected' : ''}>Team ${esc(team)}</option>`)
          .join('')}
      </select>
    </div>

    ${
      list.length
        ? `<div class="grid-cards stagger">${list.map((c, i) => ContestantCard(c, i)).join('')}</div>`
        : EmptyState({
            icon: 'users',
            title: 'No contestants match',
            text: 'Adjust the search or filters, or open the door for a new contestant.',
            action: `<button class="btn btn--primary btn--sm" data-action="contestant:add">${icon('user-plus', 13)} Add contestant</button>`,
          })
    }

    <div class="grid-split" style="margin-top:var(--s-4)">
      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('clipboard', 15)}</span><h3>Roster Table</h3></div>
          <span class="card__meta">${list.length} shown · ${state.contestants.length} in the House</span>
        </header>
        <div class="card__body card__body--flush">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Contestant</th><th>Team</th><th>Status</th>
                  <th class="num">Tasks</th><th class="num">Points</th><th></th>
                </tr>
              </thead>
              <tbody>
                ${list
                  .map(
                    (c) => `
                  <tr data-team="${esc(c.team)}">
                    <td><div class="row-8">${Avatar(c, 'sm')}<span class="fw-600">${esc(c.name)}</span></div></td>
                    <td>${TeamBadge(c.team)}</td>
                    <td>${ContestantStatus(c)}</td>
                    <td class="num">${c.tasksCompleted}</td>
                    <td class="num fw-700">${c.points}</td>
                    <td class="num">
                      <button class="btn btn--xs" data-action="points:open" data-id="${esc(c.id)}">Points</button>
                    </td>
                  </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('gauge', 15)}</span><h3>House Statistics</h3></div>
        </header>
        <div class="card__body">${HouseStatsPanel(stats)}</div>
      </section>
    </div>
  `;
}

export const ContestantsMeta = { title: 'Contestants', subtitle: 'Roster, teams, points and status' };
