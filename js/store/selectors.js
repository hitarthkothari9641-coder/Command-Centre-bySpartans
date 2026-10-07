/**
 * Selectors — all derived data. Pure functions of state, memo-free by design
 * (the dataset is a single House, so recomputation is cheaper than caching).
 */
import { remainingSeconds } from './reducer.js';

export const activeContestants = (state) => state.contestants.filter((c) => c.status === 'active');

export const evictedContestants = (state) =>
  state.contestants.filter((c) => c.status === 'evicted').sort((a, b) => (b.evictedAt || 0) - (a.evictedAt || 0));

/** Live leaderboard: active contestants ordered by points. */
export const leaderboard = (state) =>
  activeContestants(state)
    .slice()
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

export const dangerZone = (state) =>
  activeContestants(state)
    .filter((c) => c.nomination)
    .sort((a, b) => a.nomination.round - b.nomination.round || b.points - a.points);

export const immuneContestants = (state) => activeContestants(state).filter((c) => c.immunity);

export const houseCaptain = (state) =>
  state.contestants.find((c) => c.isCaptain && c.status === 'active') || null;

export const eligibleForNomination = (state) =>
  activeContestants(state).filter((c) => !c.immunity && !c.isCaptain && !c.nomination);

export const rankOf = (state, id) => leaderboard(state).findIndex((c) => c.id === id) + 1;

export const maxPoints = (state) => Math.max(1, ...activeContestants(state).map((c) => c.points), 1);

export const timerView = (state, now = Date.now()) => {
  const remaining = remainingSeconds(state.timer, now);
  const ratio = state.timer.duration ? Math.max(0, Math.min(1, remaining / state.timer.duration)) : 0;
  const state_ = !state.timer.running
    ? remaining === 0
      ? 'done'
      : 'paused'
    : remaining <= 10
      ? 'critical'
      : remaining <= 30
        ? 'warning'
        : 'running';
  return { remaining, ratio, state: state_, running: state.timer.running };
};

/** Headline numbers for the stats row and the statistics panel. */
export function houseStats(state) {
  const active = activeContestants(state);
  const board = leaderboard(state);
  const tasks = state.tasks;
  const completed = tasks.filter((t) => t.status === 'completed');
  const totalPoints = active.reduce((sum, c) => sum + c.points, 0);
  const nominees = dangerZone(state);

  const teams = new Map();
  active.forEach((c) => {
    const entry = teams.get(c.team) || { team: c.team, points: 0, members: 0, tasks: 0 };
    entry.points += c.points;
    entry.members += 1;
    entry.tasks += c.tasksCompleted;
    teams.set(c.team, entry);
  });
  const teamTable = [...teams.values()].sort((a, b) => b.points - a.points);

  const mostTasks = active.slice().sort((a, b) => b.tasksCompleted - a.tasksCompleted)[0] || null;

  return {
    total: state.contestants.length,
    activeCount: active.length,
    evictedCount: state.contestants.length - active.length,
    immuneCount: active.filter((c) => c.immunity).length,
    nomineeCount: nominees.length,
    totalPoints,
    averagePoints: active.length ? Math.round(totalPoints / active.length) : 0,
    highestScorer: board[0] || null,
    lowestScorer: board[board.length - 1] || null,
    mostTasks,
    captain: houseCaptain(state),
    tasksTotal: tasks.length,
    tasksCompleted: completed.length,
    tasksOpen: tasks.length - completed.length,
    tasksActive: tasks.filter((t) => t.status === 'active').length,
    tasksFailed: tasks.filter((t) => t.status === 'failed').length,
    completionRate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
    teamTable,
    leadingTeam: teamTable[0] || null,
    round: state.nominationRound,
    nominees,
    lastPointsEvent: state.log.find((l) => l.type === 'points') || null,
  };
}
