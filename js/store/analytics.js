/**
 * Performance analytics — pure derivations over the House audit log.
 *
 * The log is the ledger: every points change (`points/adjust`) and every task
 * completion (`task` · kind `complete`) records both its delta and timestamp,
 * so points velocity, form, team share and rank movement can all be rebuilt
 * from history instead of being tracked separately.
 *
 * A seeded House reconciles exactly: the sum of a contestant's logged deltas
 * equals their current score. `coverage()` proves that invariant in the UI and
 * in the test suite.
 */

export const RANGES = [
  { id: '1h', label: '1 h', ms: 3600e3, buckets: 12 },
  { id: '6h', label: '6 h', ms: 6 * 3600e3, buckets: 12 },
  { id: '24h', label: '24 h', ms: 24 * 3600e3, buckets: 12 },
  { id: 'all', label: 'All', ms: Infinity, buckets: 12 },
];

export const DEFAULT_RANGE = '6h';

export const rangeOf = (id) => RANGES.find((range) => range.id === id) || RANGES.find((range) => range.id === DEFAULT_RANGE);

/** Window covered by a range: { from, to, ms, buckets }. */
export function windowOf(state, rangeId, now = Date.now()) {
  const range = rangeOf(rangeId);
  const oldest = state.log.length ? Math.min(...state.log.map((entry) => entry.createdAt)) : now;
  const from = range.ms === Infinity ? oldest : now - range.ms;
  return { from: Math.min(from, now), to: now, ms: range.ms === Infinity ? Math.max(1, now - oldest) : range.ms, buckets: range.buckets, range };
}

/* ── Ledger ────────────────────────────────────────────────────────────── */

/**
 * Every points movement in the log, oldest first.
 * @returns {Array<{at: number, id: string, delta: number, kind: 'points'|'task'}>}
 */
export function pointsLedger(state) {
  const rows = [];
  for (const entry of state.log) {
    if (entry.type === 'points' && entry.contestantId && typeof entry.delta === 'number') {
      rows.push({ at: entry.createdAt, id: entry.contestantId, delta: entry.delta, kind: 'points' });
      continue;
    }
    if (entry.type === 'task' && entry.kind === 'complete' && Array.isArray(entry.contestantIds)) {
      const reward = Number(entry.points) || 0;
      entry.contestantIds.forEach((id) => rows.push({ at: entry.createdAt, id, delta: reward, kind: 'task' }));
    }
  }
  return rows.sort((a, b) => a.at - b.at);
}

/** Points gained per contestant inside a window. */
export function gainedIn(state, from, to = Infinity) {
  const gains = new Map();
  for (const row of pointsLedger(state)) {
    if (row.at < from || row.at > to) continue;
    gains.set(row.id, (gains.get(row.id) || 0) + row.delta);
  }
  return gains;
}

/**
 * Does the log explain the current scores? Returns the unaccounted points —
 * 0 for a clean House, > 0 after the log was cleared or history was trimmed.
 */
export function coverage(state, rangeId = 'all', now = Date.now()) {
  const { from, to } = windowOf(state, rangeId, now);
  const gains = gainedIn(state, from, to);
  const active = state.contestants.filter((c) => c.status === 'active');
  const booked = active.reduce((sum, c) => sum + c.points, 0);
  const logged = [...gains.values()].reduce((sum, value) => sum + value, 0);
  return { booked, logged, unaccounted: booked - logged, explained: active.filter((c) => gains.has(c.id)).length, total: active.length };
}

/* ── Buckets & curves ──────────────────────────────────────────────────── */

/** Split a window into fixed buckets with event counts and points awarded. */
export function buckets(state, rangeId, now = Date.now()) {
  const { from, to, buckets: count, ms } = windowOf(state, rangeId, now);
  const span = Math.max(1, to - from);
  const width = span / count;
  const rows = Array.from({ length: count }, (_, index) => ({
    at: from + index * width,
    to: from + (index + 1) * width,
    events: 0,
    points: 0,
    awards: 0,
    milestone: 0,
  }));

  const put = (at, mutate) => {
    const index = Math.max(0, Math.min(count - 1, Math.floor((at - from) / width)));
    mutate(rows[index]);
  };

  state.log.forEach((entry) => {
    if (entry.createdAt < from || entry.createdAt > to) return;
    put(entry.createdAt, (row) => (row.events += 1));
  });
  pointsLedger(state).forEach((row) => {
    if (row.at < from || row.at > to) return;
    put(row.at, (bucket) => {
      bucket.points += Math.max(0, row.delta);
      bucket.awards += 1;
    });
  });

  return { from, to, width, rows, ms };
}

/** Cumulative House points across the window (the house "velocity" curve). */
export function cumulative(state, rangeId, now = Date.now()) {
  const { from, to, rows } = buckets(state, rangeId, now);
  const before = pointsLedger(state)
    .filter((row) => row.at < from)
    .reduce((sum, row) => sum + row.delta, 0);

  let running = before;
  const values = rows.map((row) => {
    running += row.points;
    return running;
  });
  return { from, to, values, start: before };
}

/* ── Aggregates ────────────────────────────────────────────────────────── */

/** Points + activity per contestant inside the window. */
export function contestantForm(state, rangeId, now = Date.now()) {
  const { from, to } = windowOf(state, rangeId, now);
  const gains = gainedIn(state, from, to);
  const events = new Map();
  state.log.forEach((entry) => {
    if (entry.createdAt < from || entry.createdAt > to) return;
    [].concat(entry.contestantId || entry.contestantIds || []).forEach((id) => {
      if (id) events.set(id, (events.get(id) || 0) + 1);
    });
  });

  const board = state.contestants
    .filter((c) => c.status === 'active')
    .map((c) => ({
      id: c.id,
      name: c.name,
      team: c.team,
      points: c.points,
      gained: gains.get(c.id) || 0,
      events: events.get(c.id) || 0,
      tasksCompleted: c.tasksCompleted,
      atStart: c.points - (gains.get(c.id) || 0),
    }));

  // Rank at the start of the window vs. rank today → movement.
  const startOrder = board.slice().sort((a, b) => b.atStart - a.atStart || a.name.localeCompare(b.name));
  const startRank = new Map(startOrder.map((row, index) => [row.id, index + 1]));
  const nowOrder = board.slice().sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  return nowOrder.map((row, index) => ({
    ...row,
    rank: index + 1,
    startRank: startRank.get(row.id),
    movement: (startRank.get(row.id) || index + 1) - (index + 1),
  }));
}

/** Team totals, gains and share of the House inside the window. */
export function teamBreakdown(state, rangeId, now = Date.now()) {
  const { from, to } = windowOf(state, rangeId, now);
  const gains = gainedIn(state, from, to);
  const table = new Map();

  state.contestants
    .filter((c) => c.status === 'active')
    .forEach((c) => {
      const row = table.get(c.team) || { team: c.team, points: 0, gained: 0, members: 0, tasks: 0 };
      row.points += c.points;
      row.gained += gains.get(c.id) || 0;
      row.members += 1;
      row.tasks += c.tasksCompleted;
      table.set(c.team, row);
    });

  const rows = [...table.values()].sort((a, b) => b.points - a.points);
  const total = rows.reduce((sum, row) => sum + row.points, 0) || 1;
  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    average: row.members ? Math.round(row.points / row.members) : 0,
    share: Math.round((row.points / total) * 100),
  }));
}

/** Headline KPIs for the analytics header. */
export function kpis(state, rangeId, now = Date.now(), previousRangeId = null) {
  const { from, to, ms } = windowOf(state, rangeId, now);
  const windowEvents = state.log.filter((entry) => entry.createdAt >= from && entry.createdAt <= to);
  const windowPoints = pointsLedger(state).filter((row) => row.at >= from && row.at <= to);

  const awarded = windowPoints.reduce((sum, row) => sum + row.delta, 0);
  const positive = windowPoints.filter((row) => row.delta > 0).reduce((sum, row) => sum + row.delta, 0);
  const deductions = windowPoints.filter((row) => row.delta < 0).reduce((sum, row) => sum + row.delta, 0);

  const half = (from + to) / 2;
  const recent = windowPoints.filter((row) => row.at >= half).reduce((sum, row) => sum + row.delta, 0);
  const earlier = windowPoints.filter((row) => row.at < half).reduce((sum, row) => sum + row.delta, 0);
  const momentum = earlier === 0 ? (recent > 0 ? 100 : 0) : Math.round(((recent - earlier) / Math.abs(earlier)) * 100);

  const completed = state.tasks.filter((task) => task.completedAt && task.completedAt >= from && task.completedAt <= to).length;
  const active = state.contestants.filter((c) => c.status === 'active');
  const totalPoints = active.reduce((sum, c) => sum + c.points, 0);
  const board = active.slice().sort((a, b) => b.points - a.points);

  const hours = Math.max(ms / 3600e3, 1 / 60);
  const previous = previousRangeId
    ? state.log.filter((entry) => entry.createdAt >= from - ms && entry.createdAt < from).length
    : null;

  return {
    from,
    to,
    events: windowEvents.length,
    eventsPerHour: Math.round((windowEvents.length / hours) * 10) / 10,
    awarded,
    positive,
    deductions,
    momentum,
    recent,
    earlier,
    tasksCompleted: completed,
    tasksTotal: state.tasks.length,
    tasksOpen: state.tasks.filter((t) => t.status !== 'completed').length,
    completionRate: state.tasks.length ? Math.round((state.tasks.filter((t) => t.status === 'completed').length / state.tasks.length) * 100) : 0,
    totalPoints,
    average: active.length ? Math.round(totalPoints / active.length) : 0,
    spread: board.length ? board[0].points - board[board.length - 1].points : 0,
    leader: board[0] || null,
    laggard: board[board.length - 1] || null,
    nomineeCount: active.filter((c) => c.nomination).length,
    immuneCount: active.filter((c) => c.immunity).length,
    activeCount: active.length,
    previousEvents: previous,
    eventDelta: previous === null ? null : windowEvents.length - previous,
  };
}

/* ── Plain-language insights ───────────────────────────────────────────── */

/** Auto-generated observations so the numbers read like a story. */
export function insights(state, rangeId, now = Date.now()) {
  const out = [];
  const kpi = kpis(state, rangeId, now);
  const teams = teamBreakdown(state, rangeId, now);
  const form = contestantForm(state, rangeId, now);
  const rangeLabel = rangeOf(rangeId).label.toLowerCase();

  if (kpi.events === 0) {
    out.push({ tone: 'neutral', icon: 'info', text: `No House events in the last ${rangeLabel} — the room is quiet.` });
  } else {
    out.push({
      tone: 'cyan',
      icon: 'activity',
      text: `${kpi.events} event${kpi.events === 1 ? '' : 's'} and ${kpi.awarded >= 0 ? '+' : ''}${kpi.awarded} pts logged in the last ${rangeLabel} (${kpi.eventsPerHour}/h).`,
    });
  }

  if (teams.length) {
    const [first, second] = teams;
    out.push({
      tone: 'violet',
      icon: 'shield',
      text: second
        ? `Team ${first.team} leads with ${first.points} pts — ${first.points - second.points} clear of Team ${second.team}.`
        : `Team ${first.team} is the only team in the House with ${first.points} pts.`,
    });
  }

  const climber = form.filter((row) => row.movement > 0).sort((a, b) => b.movement - a.movement)[0];
  const faller = form.filter((row) => row.movement < 0).sort((a, b) => a.movement - b.movement)[0];
  if (climber) out.push({ tone: 'emerald', icon: 'trending-up', text: `${climber.name} climbed ${climber.movement} place${climber.movement === 1 ? '' : 's'} in the last ${rangeLabel} (+${climber.gained} pts).` });
  if (faller) out.push({ tone: 'amber', icon: 'trending-down', text: `${faller.name} slipped ${Math.abs(faller.movement)} place${faller.movement === -1 ? '' : 's'} despite ${faller.gained >= 0 ? '+' : ''}${faller.gained} pts.` });

  const hot = form.slice().sort((a, b) => b.gained - a.gained)[0];
  if (hot && hot.gained > 0) out.push({ tone: 'cyan', icon: 'flame', text: `${hot.name} is the form player: +${hot.gained} pts in the last ${rangeLabel}.` });

  out.push({
    tone: kpi.completionRate >= 50 ? 'emerald' : 'amber',
    icon: 'clipboard',
    text: `Task throughput ${kpi.completionRate}% — ${kpi.tasksOpen} of ${kpi.tasksTotal} still open, ${kpi.tasksCompleted} completed in range.`,
  });

  out.push(
    kpi.nomineeCount
      ? { tone: 'crimson', icon: 'alert', text: `${kpi.nomineeCount} contestant${kpi.nomineeCount === 1 ? '' : 's'} in the Danger Zone · ${kpi.immuneCount} holding immunity.` }
      : { tone: 'emerald', icon: 'shield', text: `Danger Zone clear · ${kpi.immuneCount} contestant${kpi.immuneCount === 1 ? '' : 's'} holding immunity.` },
  );

  if (kpi.momentum !== 0 && kpi.earlier > 0) {
    out.push({
      tone: kpi.momentum > 0 ? 'emerald' : 'amber',
      icon: kpi.momentum > 0 ? 'trending-up' : 'trending-down',
      text: `Points velocity ${kpi.momentum > 0 ? 'up' : 'down'} ${Math.abs(kpi.momentum)}% in the second half of the window (${kpi.earlier} → ${kpi.recent} pts).`,
    });
  }

  return out;
}

/* ── Live feed metrics (activity view) ─────────────────────────────────── */

/** Events per minute over the trailing `minutes`, plus a sparkline series. */
export function eventRate(state, minutes = 10, now = Date.now()) {
  const width = (minutes * 60e3) / 12;
  const from = now - minutes * 60e3;
  const series = Array.from({ length: 12 }, (_, index) => {
    const start = from + index * width;
    return state.log.filter((entry) => entry.createdAt >= start && entry.createdAt < start + width).length;
  });
  const total = series.reduce((sum, value) => sum + value, 0);
  return { perMinute: Math.round((total / minutes) * 10) / 10, series, total, minutes };
}
