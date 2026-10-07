/**
 * Demo season used on first load and by "Reset demo data".
 *
 * The seed ships an 8-hour **audit history** whose point deltas reconcile
 * exactly with the roster's scores, which is what makes the live activity log
 * and the performance analytics meaningful from the very first paint. The
 * invariant is asserted in the test suite (`pointsLedger` sum === score).
 */
import { DEFAULT_PREFS } from '../notifications.js';

export const TEAMS = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

const ROSTER = [
  ['Aarav Mehta', 'Alpha', 180],
  ['Zara Khan', 'Alpha', 165],
  ['Rohan Iyer', 'Alpha', 140],
  ['Isha Verma', 'Bravo', 155],
  ['Kabir Shah', 'Bravo', 120],
  ['Naina Rao', 'Bravo', 95],
  ['Devansh Gupta', 'Charlie', 170],
  ['Meera Nair', 'Charlie', 145],
  ['Arjun Singh', 'Charlie', 110],
  ['Sanya Kapoor', 'Delta', 130],
  ['Vihaan Joshi', 'Delta', 100],
  ['Tara Bose', 'Delta', 85],
];

const AWARD_REASONS = [
  'Challenge bonus',
  'Task win',
  'Audience vote',
  'Immunity prize',
  'Arena streak',
  'Captaincy bonus',
  'House contribution',
];

const PENALTIES = [
  { name: 'Kabir Shah', delta: -15, reason: 'Microphone breach in the Arena' },
  { name: 'Tara Bose', delta: -20, reason: 'Left the task desk before the buzzer' },
];

const HOUR = 3600e3;
const span = 8 * HOUR;

/** Tiny deterministic PRNG — the demo season must look identical every boot. */
function lcg(seed) {
  let state = seed % 2147483647;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

/**
 * Build the House history: session open, captaincy, the completed task, the
 * two live tasks, one penalty each for two contestants, then every
 * contestant's points spread over several awards.
 */
function buildHistory(now, contestants, tasks) {
  const rand = lcg(20261007);
  const entries = [];
  const push = (at, type, message, meta = {}) =>
    entries.push({ id: `l_seed${String(entries.length).padStart(3, '0')}`, type, message, createdAt: Math.round(at), ...meta });

  const byName = new Map(contestants.map((c) => [c.name, c]));
  const captain = contestants.find((c) => c.isCaptain);
  const landing = tasks.find((t) => t.status === 'completed');
  const active = tasks.find((t) => t.status === 'active');
  const pending = tasks.find((t) => t.status === 'pending');

  /* ── House narrative ─────────────────────────────────────────────────── */
  push(now - span, 'session', 'Control room opened for Season 1 by Big Boss.', { kind: 'session' });
  push(now - span + 24 * 60e3, 'captain', `${captain.name} was appointed House Captain.`, { contestantId: captain.id });
  push(now - span + 40 * 60e3, 'contestant', `${contestants[0].name} entered the House for Team ${contestants[0].team}.`, {
    contestantId: contestants[0].id,
    kind: 'enter',
  });
  push(now - 5.4 * HOUR, 'announcement', 'Big Boss broadcast: "Welcome to the Tech House. Big Boss is watching every commit."', {
    announcementId: 'a1',
    kind: 'add',
  });

  if (active) {
    push(active.createdAt + 8 * 60e3, 'task', `Task "${active.title}" marked IN PROGRESS.`, { taskId: active.id, kind: 'active' });
  }
  if (landing) {
    const who = landing.assignees.map((id) => byName.get(contestants.find((c) => c.id === id)?.name)?.name).filter(Boolean);
    push(
      landing.completedAt || now - 3 * HOUR,
      'task',
      `Task "${landing.title}" COMPLETED · +${landing.points} pts each to ${who.join(', ')}.`,
      { taskId: landing.id, kind: 'complete', points: landing.points, contestantIds: landing.assignees },
    );
  }
  if (pending) {
    const who = pending.assignees.map((id) => contestants.find((c) => c.id === id)?.name).filter(Boolean);
    push(pending.createdAt, 'task', `Task "${pending.title}" assigned to ${who.join(', ')}.`, { taskId: pending.id, kind: 'create' });
  }

  /* ── Per-contestant ledgers that sum to their current score ──────────── */
  contestants.forEach((contestant) => {
    const penalty = PENALTIES.find((p) => p.name === contestant.name);
    const chunks = [];
    let target = contestant.points;

    if (penalty) {
      chunks.push({ delta: penalty.delta, reason: penalty.reason, at: now - (2 + rand() * 2) * HOUR });
      target -= penalty.delta; // awards must out-earn the penalty
    }
    // The completed task already paid a fixed bonus in the narrative above.
    const taskBonus = landing && landing.assignees.includes(contestant.id) ? landing.points : 0;
    target -= taskBonus;

    const parts = 2 + Math.floor(rand() * 2 + rand()); // 2–3 chunks
    const weights = Array.from({ length: parts }, () => 0.6 + rand());
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    let left = target;

    weights.forEach((weight, index) => {
      const last = index === parts - 1;
      // Rounded down, so the final chunk always absorbs a positive remainder.
      const delta = last ? left : Math.max(5, Math.floor((target * weight) / weightSum / 5) * 5);
      if (last && delta <= 0) return;
      left -= delta;
      chunks.push({
        delta,
        reason: AWARD_REASONS[Math.floor(rand() * AWARD_REASONS.length)],
        // The first chunk stays inside the last ~9 minutes so the live log and
        // the 10-minute event-rate gauge have something to show on first load.
        at: now - 90e3 - (index * (span - 3.2 * HOUR)) / parts - rand() * (index === 0 ? 8 : 25) * 60e3,
      });
    });

    // Oldest first so the running total in each message stays truthful.
    chunks
      .slice()
      .sort((a, b) => a.at - b.at)
      .reduce((running, chunk) => {
        const next = running + chunk.delta;
        const sign = chunk.delta > 0 ? '+' : '';
        push(
          chunk.at,
          'points',
          `${sign}${chunk.delta} pts to ${contestant.name} → ${next} pts · ${chunk.reason}`,
          { contestantId: contestant.id, delta: chunk.delta, points: next },
        );
        return next;
      }, 0);
  });

  return entries.sort((a, b) => b.createdAt - a.createdAt);
}

export function createSeed() {
  const now = Date.now();

  const contestants = ROSTER.map(([name, team, points], index) => ({
    id: `c${index + 1}`,
    name,
    team,
    points,
    status: 'active', // active | evicted
    immunity: false,
    nomination: null, // { round, reason, at }
    isCaptain: false,
    tasksCompleted: 0,
    joinedAt: now - span,
    evictedAt: null,
    evictionReason: '',
    notes: '',
  }));

  // Devansh Gupta leads the House as Captain.
  contestants[6].isCaptain = true;
  // Task t1 is already complete, so its assignees carry a completed-task count.
  contestants[0].tasksCompleted = 1;
  contestants[6].tasksCompleted = 1;

  const tasks = [
    {
      id: 't1',
      title: 'Build the Landing Page',
      description: 'Ship a responsive landing page with a working call to action.',
      assignees: ['c1', 'c7'],
      points: 50,
      status: 'completed',
      createdAt: now - 86400000,
      completedAt: now - 3600000,
    },
    {
      id: 't2',
      title: 'Debug the Arena API',
      description: 'Find and fix the failing endpoint before the buzzer sounds.',
      assignees: ['c4', 'c10'],
      points: 40,
      status: 'active',
      createdAt: now - 7200000,
      completedAt: null,
    },
    {
      id: 't3',
      title: 'Design the House Banner',
      description: 'A minimalist banner that represents the Tech House identity.',
      assignees: ['c8'],
      points: 30,
      status: 'pending',
      createdAt: now - 1800000,
      completedAt: null,
    },
  ];

  return {
    version: 3,
    house: { name: 'Tech House', season: 1, day: 1 },
    nominationRound: 1,
    contestants,
    tasks,
    timer: {
      duration: 600,
      remaining: 600,
      running: false,
      endsAt: null,
      label: 'Coding Sprint',
    },
    announcements: [
      {
        id: 'a1',
        message: 'Welcome to the Tech House. Big Boss is watching every commit.',
        tone: 'accent',
        createdAt: now - 5400000,
      },
    ],
    log: buildHistory(now, contestants, tasks),
    /** Signed-in operator (role-based access control). */
    session: { role: 'bigboss' },
    /** Event notifications — one unread welcome so the bell is discoverable. */
    notifications: [
      {
        id: 'n_seed_welcome',
        sourceId: 'seed:welcome',
        group: 'house',
        priority: 'normal',
        icon: 'bell',
        tone: 'violet',
        title: 'Control room online',
        body: 'Live log, performance analytics and notification rules are armed.',
        view: 'dashboard',
        createdAt: now - 2000,
        read: false,
      },
    ],
    notify: { ...DEFAULT_PREFS },
    ui: {
      sidebar: 'expanded',
      background: true,
      onboarded: false,
      activeView: 'dashboard',
      feedFollow: true, // live tail: new events slide in at the top
      feedPaused: false,
      analyticsRange: '6h',
      simulateFeed: false, // demo feed simulator (opt-in, clearly labelled)
    },
  };
}
