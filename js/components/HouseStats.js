import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Avatar } from './Avatar.js';

const row = (label, value, tone = '') => `
  <div class="kv-row">
    <span class="kv-row__k">${esc(label)}</span>
    <span class="kv-row__v ${tone}">${esc(value)}</span>
  </div>
`;

/**
 * House statistics panel — highest scorer, completed tasks, nominee count….
 * @param {object} stats result of selectors.houseStats(state)
 */
export function HouseStatsPanel(stats) {
  const mvp = stats.highestScorer;
  const mostTasks = stats.mostTasks;
  return `
    <div class="stack-16">
      ${row('Total Active Contestants', `${stats.activeCount} of ${stats.total}`)}
      ${row('Highest Scorer', mvp ? `${mvp.name} · ${mvp.points} pts` : '—', 'text-gold')}
      ${row('Lowest Scorer', stats.lowestScorer ? `${stats.lowestScorer.name} · ${stats.lowestScorer.points} pts` : '—')}
      ${row('House Captain', stats.captain ? stats.captain.name : 'Vacant', 'text-gold')}
      ${row('Most Tasks Completed', mostTasks ? `${mostTasks.name} · ${mostTasks.tasksCompleted}` : '—')}
      ${row('Tasks Completed', `${stats.tasksCompleted} of ${stats.tasksTotal} (${stats.completionRate}%)`)}
      ${row('Tasks In Progress', String(stats.tasksActive))}
      ${row('Nominees In Danger Zone', String(stats.nomineeCount), stats.nomineeCount ? 'text-danger' : 'text-success')}
      ${row('Immunity Held', String(stats.immuneCount), 'text-success')}
      ${row('Evicted', String(stats.evictedCount), stats.evictedCount ? 'text-danger' : '')}
      ${row('House Points', `${stats.totalPoints} pts · avg ${stats.averagePoints}`)}
      ${row('Leading Team', stats.leadingTeam ? `Team ${stats.leadingTeam.team} · ${stats.leadingTeam.points} pts` : '—')}
      ${row('Nomination Round', String(stats.round))}
    </div>
  `;
}

/** Per-team standings bars. */
export function TeamStandings(stats) {
  const max = Math.max(1, ...stats.teamTable.map((team) => team.points));
  if (!stats.teamTable.length) {
    return '<p class="fs-sm muted">No teams in the House yet.</p>';
  }
  return `<div class="stack-16">
    ${stats.teamTable
      .map(
        (team, index) => `
      <div data-team="${esc(team.team)}">
        <div class="row-8" style="justify-content:space-between">
          <span class="row-8">
            <span class="team-dot"></span>
            <span class="fw-600">Team ${esc(team.team)}</span>
            ${index === 0 ? `<span class="badge badge--captain">${icon('crown', 10)} Leading</span>` : ''}
          </span>
          <span class="fs-sm tnum">${team.points} pts</span>
        </div>
        <div class="meter ${index === 0 ? 'meter--gold' : ''}" style="margin-top:6px">
          <i style="width:${Math.round((team.points / max) * 100)}%"></i>
        </div>
        <div class="fs-xs muted" style="margin-top:4px">
          ${team.members} member${team.members === 1 ? '' : 's'} · ${team.tasks} task${team.tasks === 1 ? '' : 's'} completed
        </div>
      </div>`,
      )
      .join('')}
  </div>`;
}

/** MVP strip — highest scorer and most productive contestant. */
export function MvpStrip(stats) {
  const items = [
    { label: 'Highest Scorer', contestant: stats.highestScorer, tone: 'gold', icon: 'crown', detail: (c) => `${c.points} pts` },
    {
      label: 'Most Tasks Completed',
      contestant: stats.mostTasks,
      tone: 'emerald',
      icon: 'check',
      detail: (c) => `${c.tasksCompleted} task${c.tasksCompleted === 1 ? '' : 's'}`,
    },
    {
      label: 'House Captain',
      contestant: stats.captain,
      tone: 'violet',
      icon: 'star',
      detail: (c) => `Team ${c.team}`,
    },
  ].filter((item) => item.contestant);

  if (!items.length) return '';
  return `
    <div class="stack-16">
      ${items
        .map(
          (item) => `
        <div class="row-12">
          ${Avatar(item.contestant, 'md')}
          <div style="flex:1;min-width:0">
            <div class="eyebrow">${esc(item.label)}</div>
            <div class="fw-600">${esc(item.contestant.name)}</div>
          </div>
          <span class="badge badge--${item.tone === 'gold' ? 'captain' : item.tone === 'emerald' ? 'completed' : 'in-progress'}">
            ${icon(item.icon, 11)} ${esc(item.detail(item.contestant))}
          </span>
        </div>`,
        )
        .join('')}
    </div>
  `;
}
