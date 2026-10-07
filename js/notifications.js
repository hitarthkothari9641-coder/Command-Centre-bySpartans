/**
 * Event notifications.
 *
 * The notification centre is fed by a small rule engine that watches the House
 * audit log and a few transient values (timer severity, table-topper). Rules
 * are declarative, so the same events power:
 *
 *   • the bell + unread badge in the top bar,
 *   • toasts for high-priority moments,
 *   • optional OS-level notifications (only while the tab is hidden),
 *   • a (n) unread counter in the document title.
 *
 * The engine never mutates state itself — it returns items and the caller
 * dispatches `notify/add`, which keeps the reducer the only writer.
 */

export const NOTIFY_GROUPS = [
  { id: 'evictions', label: 'Evictions & exits', icon: 'door', tone: 'crimson', priority: 'high' },
  { id: 'nominations', label: 'Nominations & immunity', icon: 'shield', tone: 'crimson', priority: 'high' },
  { id: 'timer', label: 'Timer alerts', icon: 'clock', tone: 'amber', priority: 'high' },
  { id: 'tasks', label: 'Tasks', icon: 'clipboard', tone: 'amber', priority: 'normal' },
  { id: 'points', label: 'Points & milestones', icon: 'zap', tone: 'cyan', priority: 'normal' },
  { id: 'access', label: 'Access & roles', icon: 'key', tone: 'violet', priority: 'high' },
  { id: 'house', label: 'House & broadcasts', icon: 'megaphone', tone: 'violet', priority: 'normal' },
];

export const DEFAULT_PREFS = {
  browser: false, // OS notifications — opt-in, and only while the tab is hidden
  dnd: false, // do not disturb: silence the toast layer, keep the bell
  groups: Object.fromEntries(NOTIFY_GROUPS.map((group) => [group.id, true])),
};

export const groupOf = (id) => NOTIFY_GROUPS.find((group) => group.id === id) || NOTIFY_GROUPS[NOTIFY_GROUPS.length - 1];

export const notifyPrefs = (state) => ({ ...DEFAULT_PREFS, ...(state?.notify || {}), groups: { ...DEFAULT_PREFS.groups, ...(state?.notify?.groups || {}) } });

export const unreadCount = (state) => (state?.notifications || []).filter((item) => !item.read).length;

let seq = 0;
const nid = () => `n_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/* ── Rule builders ─────────────────────────────────────────────────────── */

let lastTopId = null;
let lastTimerState = null;
const MILESTONE = 100;

/**
 * Turn one new audit entry into a notification (or null when it is noise).
 * @param {object} entry log entry
 * @param {object} state the state *after* the entry was written
 */
export function ruleFor(entry, state) {
  const base = {
    id: nid(),
    sourceId: entry.id,
    createdAt: entry.createdAt,
    read: false,
  };
  const person = entry.contestantId ? state.contestants.find((c) => c.id === entry.contestantId) : null;

  switch (entry.type) {
    case 'eviction':
      if (entry.kind === 'reinstate') {
        return { ...base, group: 'evictions', priority: 'normal', icon: 'log-in', tone: 'emerald', title: 'Contestant reinstated', body: entry.message, view: 'evictions' };
      }
      return {
        ...base,
        group: 'evictions',
        priority: 'high',
        icon: 'door',
        tone: 'crimson',
        title: entry.kind === 'evictRound' ? 'House vote complete' : 'Eviction executed',
        body: entry.message,
        view: 'evictions',
      };

    case 'nomination':
      return {
        ...base,
        group: 'nominations',
        priority: entry.kind === 'add' ? 'high' : 'normal',
        icon: entry.kind === 'add' ? 'alert' : 'shield',
        tone: entry.kind === 'add' ? 'crimson' : 'cyan',
        title: entry.kind === 'add' ? 'Danger Zone updated' : 'Nominations changed',
        body: entry.message,
        view: 'nominations',
      };

    case 'immunity':
      return {
        ...base,
        group: 'nominations',
        priority: 'normal',
        icon: 'shield',
        tone: 'emerald',
        title: entry.kind === 'revoke' ? 'Immunity revoked' : 'Immunity granted',
        body: entry.message,
        view: 'nominations',
      };

    case 'task': {
      const failed = entry.kind === 'failed';
      const complete = entry.kind === 'complete';
      return {
        ...base,
        group: 'tasks',
        priority: failed ? 'high' : 'normal',
        icon: failed ? 'alert' : complete ? 'check' : 'clipboard',
        tone: failed ? 'crimson' : complete ? 'emerald' : 'cyan',
        title: failed ? 'Task failed' : complete ? 'Task completed' : 'Task updated',
        body: entry.message,
        view: 'tasks',
      };
    }

    case 'timer':
      if (entry.kind !== 'timeup') return null; // start/pause/reset are cosmetic
      return {
        ...base,
        group: 'timer',
        priority: 'high',
        icon: 'clock',
        tone: 'crimson',
        title: 'Time is up',
        body: 'The countdown reached zero — the task window is closed.',
        view: 'tasks',
      };

    case 'points': {
      const delta = Number(entry.delta) || 0;
      const total = Number(entry.points) || 0;
      const prev = total - delta;
      const crossed = Math.floor(total / MILESTONE) > Math.floor(prev / MILESTONE) && delta > 0;
      const big = Math.abs(delta) >= 50;
      if (!crossed && !big) return null; // small chips are noise
      return {
        ...base,
        group: 'points',
        priority: 'normal',
        icon: delta > 0 ? 'trending-up' : 'trending-down',
        tone: delta > 0 ? 'cyan' : 'amber',
        title: crossed
          ? `${person?.name || 'A contestant'} crossed ${Math.floor(total / MILESTONE) * MILESTONE} points`
          : `${delta > 0 ? 'Large award' : 'Large deduction'} for ${person?.name || 'a contestant'}`,
        body: entry.message,
        view: 'leaderboard',
      };
    }

    case 'captain':
      return {
        ...base,
        group: 'house',
        priority: 'normal',
        icon: 'crown',
        tone: 'gold',
        title: 'Captaincy change',
        body: entry.message,
        view: 'contestants',
      };

    case 'announcement':
      return {
        ...base,
        group: 'house',
        priority: 'normal',
        icon: 'megaphone',
        tone: 'violet',
        title: entry.kind === 'delete' ? 'Announcement removed' : 'Broadcast transmitted',
        body: entry.message,
        view: 'announcements',
      };

    case 'access':
      return {
        ...base,
        group: 'access',
        priority: 'high',
        icon: 'key',
        tone: entry.kind === 'denied' ? 'crimson' : 'violet',
        title: entry.kind === 'denied' ? 'Access denied' : 'Role changed',
        body: entry.message,
        view: 'settings',
      };

    case 'contestant':
      return {
        ...base,
        group: 'house',
        priority: 'normal',
        icon: 'user-plus',
        tone: 'cyan',
        title: entry.kind === 'enter' ? 'Contestant entered the House' : 'Contestant record updated',
        body: entry.message,
        view: 'contestants',
      };

    case 'session':
      return {
        ...base,
        group: 'house',
        priority: 'normal',
        icon: 'calendar',
        tone: 'violet',
        title: entry.kind === 'day' ? 'A new day begins' : 'House updated',
        body: entry.message,
        view: 'settings',
      };

    default:
      return null;
  }
}

/** Timer severity changes are transient, so they are detected outside the log. */
function timerRule(state, timerState) {
  if (timerState !== 'warning' && timerState !== 'critical') return null;
  const minutes = timerState === 'critical' ? 'ten seconds' : 'thirty seconds';
  return {
    id: nid(),
    sourceId: `timer:${timerState}:${Math.floor(Date.now() / 1000)}`,
    createdAt: Date.now(),
    read: false,
    group: 'timer',
    priority: 'high',
    icon: timerState === 'critical' ? 'alert' : 'clock',
    tone: timerState === 'critical' ? 'crimson' : 'amber',
    title: timerState === 'critical' ? 'Final seconds' : 'Timer warning',
    body: `Under ${minutes} left on the ${state.timer.label || 'task'} countdown.`,
    view: 'tasks',
  };
}

function leaderRule(state) {
  const top = state.contestants.filter((c) => c.status === 'active').sort((a, b) => b.points - a.points)[0];
  if (!top) return null;
  if (lastTopId === null) {
    lastTopId = top.id;
    return null;
  }
  if (top.id === lastTopId) return null;
  lastTopId = top.id;
  return {
    id: nid(),
    sourceId: `leader:${top.id}:${Date.now()}`,
    createdAt: Date.now(),
    read: false,
    group: 'points',
    priority: 'normal',
    icon: 'trophy',
    tone: 'gold',
    title: 'New House leader',
    body: `${top.name} takes the top of the leaderboard with ${top.points} pts.`,
    view: 'leaderboard',
  };
}

/* ── Engine ────────────────────────────────────────────────────────────── */

/**
 * Create a notifier. Call `observe(state, timerState)` after every render cycle;
 * it returns the notifications that should be dispatched (`notify/add`).
 * History present at boot is marked as seen without notifying.
 */
export function createNotifier() {
  const seen = new Set();
  let primed = false;

  return {
    /** Seed the seen-set from the current log without emitting anything. */
    prime(state) {
      state.log.forEach((entry) => seen.add(entry.id));
      lastTopId = state.contestants.filter((c) => c.status === 'active').sort((a, b) => b.points - a.points)[0]?.id ?? null;
      primed = true;
    },

    observe(state, { timerState = null, now = Date.now() } = {}) {
      if (!primed) {
        this.prime(state);
        lastTimerState = timerState;
        return [];
      }

      const fresh = state.log.filter((entry) => !seen.has(entry.id));
      fresh.forEach((entry) => seen.add(entry.id));

      const items = [];
      // Oldest first so the centre reads in the order things happened.
      fresh
        .slice()
        .reverse()
        .forEach((entry) => {
          const item = ruleFor(entry, state);
          if (item) items.push(item);
        });

      const timer = timerRule(state, timerState);
      if (timer && lastTimerState !== timerState && (timerState === 'warning' || timerState === 'critical')) items.push(timer);

      const leader = leaderRule(state);
      if (leader) items.push(leader);

      lastTimerState = timerState;
      return items.filter((item) => notifyPrefs(state).groups[item.group] !== false);
    },
  };
}

/* ── OS notifications (opt-in) ─────────────────────────────────────────── */

export const browserPermission = () =>
  typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;

/**
 * Mirror a notification to the OS — only while the tab is hidden, so the app
 * never double-notifies the operator who is looking at it.
 * @returns {boolean} whether an OS notification was shown
 */
export function mirrorToOS(item, { onClick } = {}) {
  if (browserPermission() !== 'granted') return false;
  if (typeof document !== 'undefined' && !document.hidden) return false;
  try {
    const notification = new Notification(item.title, { body: item.body, tag: item.sourceId || item.id, silent: false });
    notification.onclick = () => {
      window.focus?.();
      onClick?.(item);
      notification.close();
    };
    return true;
  } catch {
    return false; // some browsers throw on constructor (e.g. Android Chrome)
  }
}

/** Human summary used by the settings card. */
export function describePermission() {
  const permission = browserPermission();
  if (permission === 'unsupported') return 'This browser does not expose the Notification API.';
  if (permission === 'granted') return 'Allowed — alerts appear only while this tab is in the background.';
  if (permission === 'denied') return 'Blocked in the browser settings for this site.';
  return 'Not requested yet — the browser will ask once you enable it.';
}
