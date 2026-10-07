/**
 * Role-based access control.
 *
 * Four roles operate the Command Center. Every state-changing action is checked
 * against `POLICY` inside the store (`store/index.js`), so access control is
 * enforced in exactly one place — the UI only mirrors the decision by locking
 * controls (`js/ui/permissions.js`), it never *is* the decision.
 *
 *   bigboss  — unrestricted control of the House
 *   producer — runs the show: tasks, points, broadcasts, immunity
 *   captain  — scoped to their own team (points, tasks, the timer)
 *   viewer   — read-only audience
 */

export const ROLES = {
  bigboss: {
    id: 'bigboss',
    label: 'Big Boss',
    tagline: 'Unrestricted control of the House',
    detail: 'Every House action, including evictions, resets and role changes.',
    tone: 'gold',
    icon: 'crown',
    rank: 3,
  },
  producer: {
    id: 'producer',
    label: 'Producer',
    tagline: 'Runs the show, protects the House rules',
    detail: 'Tasks, points, immunity, nominations and broadcasts — but no evictions or resets.',
    tone: 'violet',
    icon: 'megaphone',
    rank: 2,
  },
  captain: {
    id: 'captain',
    label: 'Captain',
    tagline: 'Scoped to their own team',
    detail: 'Awards points and completes tasks for their team, and drives the task timer.',
    tone: 'cyan',
    icon: 'shield',
    rank: 1,
  },
  viewer: {
    id: 'viewer',
    label: 'Viewer',
    tagline: 'Read-only audience',
    detail: 'Can watch every dashboard and read the log, but cannot change the House.',
    tone: 'neutral',
    icon: 'eye',
    rank: 0,
  },
};

export const ROLE_ORDER = ['bigboss', 'producer', 'captain', 'viewer'];

export const DEFAULT_ROLE = 'bigboss';

/** The role id currently signed in. */
export const roleId = (state) => (ROLES[state?.session?.role] ? state.session.role : DEFAULT_ROLE);

export const roleOf = (state) => ROLES[roleId(state)];

/** The House Captain the `captain` role is bound to, if any. */
export const boundCaptain = (state) =>
  state?.contestants?.find((c) => c.isCaptain && c.status === 'active') || null;

/* ── Action labels: what a blocked action was trying to do ─────────────── */

const ACTIONS = {
  'contestant/add': 'add a contestant',
  'contestant/update': 'edit a contestant',
  'contestant/remove': 'delete a contestant',
  'points/adjust': 'change House points',
  'captain/set': 'appoint a House Captain',
  'captain/revoke': 'remove the House Captain',
  'immunity/grant': 'grant immunity',
  'immunity/revoke': 'revoke immunity',
  'nomination/add': 'nominate a contestant',
  'nomination/withdraw': 'withdraw a nomination',
  'nomination/clear': 'clear the Danger Zone',
  'nomination/nextRound': 'open a nomination round',
  'eviction/evict': 'evict a contestant',
  'eviction/evictRound': 'run a House vote',
  'eviction/reinstate': 'reinstate a contestant',
  'task/create': 'create a task',
  'task/status': 'change a task',
  'task/delete': 'delete a task',
  'timer/setDuration': 'set the timer',
  'timer/start': 'start the timer',
  'timer/pause': 'pause the timer',
  'timer/reset': 'reset the timer',
  'timer/label': 'rename the timer',
  'announcement/add': 'broadcast an announcement',
  'announcement/delete': 'delete an announcement',
  'house/update': 'change House configuration',
  'house/advanceDay': 'advance the day',
  'house/reset': 'reset the House',
  'house/hydrate': 'import House data',
  'log/clear': 'clear the activity log',
};

export const describeAction = (type) => ACTIONS[type] || 'perform that action';

/* ── Team scoping helpers (the `captain` role) ─────────────────────────── */

const teamOf = (state, id) => state.contestants.find((c) => c.id === id)?.team || null;
const captainTeam = (state) => boundCaptain(state)?.team || null;

function scopeProblem(state, payload, type) {
  const team = captainTeam(state);
  if (!team) return 'No active House Captain is seated — the Captain role has no team to act on right now.';

  let ids = [].concat(payload.ids ?? payload.assignees ?? payload.id ?? []).filter(Boolean);
  // Task actions point at a task id; resolve it to the people involved.
  if (type === 'task/status') {
    const task = state.tasks.find((t) => t.id === payload.id);
    if (task) ids = task.assignees;
  }
  const stranger = ids.find((id) => teamOf(state, id) && teamOf(state, id) !== team);
  if (stranger) {
    const name = state.contestants.find((c) => c.id === stranger)?.name || 'that contestant';
    return `Captains only act inside their own team — ${name} is not in Team ${team}.`;
  }
  return null;
}

/* ── Policy table ──────────────────────────────────────────────────────── */

/**
 * @type {Record<string, {allow: string[], scope?: Record<string, (state, payload, type) => string|null>}>}
 * Actions missing from this table (ui/*, notify/*, timer/tick, role/set,
 * access/denied) are session/system actions and always allowed.
 */
export const POLICY = {
  'contestant/add': { allow: ['bigboss', 'producer'] },
  'contestant/update': { allow: ['bigboss', 'producer'] },
  'contestant/remove': { allow: ['bigboss'] },

  'points/adjust': { allow: ['bigboss', 'producer', 'captain'], scope: { captain: scopeProblem } },

  'captain/set': { allow: ['bigboss'] },
  'captain/revoke': { allow: ['bigboss'] },

  'immunity/grant': { allow: ['bigboss', 'producer'] },
  'immunity/revoke': { allow: ['bigboss', 'producer'] },

  'nomination/add': { allow: ['bigboss', 'producer'] },
  'nomination/withdraw': { allow: ['bigboss', 'producer'] },
  'nomination/clear': { allow: ['bigboss', 'producer'] },
  'nomination/nextRound': { allow: ['bigboss'] },

  'eviction/evict': { allow: ['bigboss'] },
  'eviction/evictRound': { allow: ['bigboss'] },
  'eviction/reinstate': { allow: ['bigboss'] },

  'task/create': { allow: ['bigboss', 'producer', 'captain'], scope: { captain: scopeProblem } },
  'task/status': { allow: ['bigboss', 'producer', 'captain'], scope: { captain: scopeProblem } },
  'task/delete': { allow: ['bigboss', 'producer'] },

  'timer/setDuration': { allow: ['bigboss', 'producer'] },
  'timer/start': { allow: ['bigboss', 'producer', 'captain'] },
  'timer/pause': { allow: ['bigboss', 'producer', 'captain'] },
  'timer/reset': { allow: ['bigboss', 'producer'] },
  'timer/label': { allow: ['bigboss', 'producer'] },

  'announcement/add': { allow: ['bigboss', 'producer'] },
  'announcement/delete': { allow: ['bigboss'] },

  'house/update': { allow: ['bigboss'] },
  'house/advanceDay': { allow: ['bigboss', 'producer'] },
  'house/reset': { allow: ['bigboss'] },
  'house/hydrate': { allow: ['bigboss'] },

  'log/clear': { allow: ['bigboss'] },
};

/** Can the current role run this action? Returns a message when blocked. */
export function checkAccess(state, action) {
  // `meta.system` marks internal House events (the demo feed simulator). It is
  // never set by a UI control, so this is not a bypass an operator can reach.
  if (action?.meta?.system) return null;

  const type = action?.type;
  const rule = POLICY[type];
  if (!rule) return null;

  const role = roleId(state);
  if (!rule.allow.includes(role)) {
    return `${ROLES[role].label} access cannot ${describeAction(type)}. Sign in as Big Boss for full control.`;
  }
  // Role-scoped rules (a Captain may only touch their own team) are keyed by
  // role, so the scope never leaks onto roles with unrestricted reach.
  const scoped = rule.scope?.[role];
  if (scoped) return scoped(state, action.payload || {}, type);
  return null;
}

export const can = (state, action) => checkAccess(state, action) === null;

/** Thrown by the store when an action is refused — the UI turns it into a toast. */
export class AccessError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AccessError';
    this.access = true;
    this.details = details;
  }
}

/* ── Capability matrix for the UI ──────────────────────────────────────── */

/**
 * Human-readable capability grid used by the settings card and the sign-in
 * dialog. Derived from POLICY so the matrix can never drift from the rules.
 */
export const CAPABILITIES = [
  { label: 'Watch every dashboard & live log', allow: ['bigboss', 'producer', 'captain', 'viewer'] },
  { label: 'Award / deduct points', allow: ['bigboss', 'producer', 'captain'] },
  { label: 'Create & complete tasks', allow: ['bigboss', 'producer', 'captain'] },
  { label: 'Start / pause the task timer', allow: ['bigboss', 'producer', 'captain'] },
  { label: 'Broadcast announcements', allow: ['bigboss', 'producer'] },
  { label: 'Grant immunity, run nominations', allow: ['bigboss', 'producer'] },
  { label: 'Add & edit contestants', allow: ['bigboss', 'producer'] },
  { label: 'Evict, reinstate, appoint Captain', allow: ['bigboss'] },
  { label: 'Reset the House & clear the log', allow: ['bigboss'] },
];

export const matrixFor = (role) => CAPABILITIES.map((row) => ({ ...row, granted: row.allow.includes(role) }));
