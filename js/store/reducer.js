/**
 * Pure reducer for the Command Center.
 *
 * Contract:
 *  • never mutates the previous state (always returns a new object),
 *  • throws a human-readable Error when an action breaks a House rule
 *    (the UI catches it and surfaces the message as a toast),
 *  • every state-changing action appends an audit-log entry.
 */
import { TEAMS } from './seed.js';
import { ROLES, roleId, describeAction } from './roles.js';

const MAX_LOG = 250;
const MAX_ANNOUNCEMENTS = 100;
const MAX_NOTIFICATIONS = 80;

let idCounter = 0;
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ── Helpers ───────────────────────────────────────────────────────────── */

export const findContestant = (state, id) => state.contestants.find((c) => c.id === id);

function requireContestant(state, id) {
  const contestant = findContestant(state, id);
  if (!contestant) throw new Error('That contestant is no longer in the House.');
  return contestant;
}

function appendLog(state, type, message, meta = {}) {
  const entry = { id: uid('l'), type, message, createdAt: Date.now(), ...meta };
  return { ...state, log: [entry, ...state.log].slice(0, MAX_LOG) };
}

function patchContestant(state, id, patch) {
  return { ...state, contestants: state.contestants.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

/** Update many contestants in one pass. */
function patchMany(state, ids, patcher) {
  const set = new Set(ids);
  return { ...state, contestants: state.contestants.map((c) => (set.has(c.id) ? { ...c, ...patcher(c) } : c)) };
}

const clampPoints = (value) => Math.max(0, Math.round(Number(value) || 0));

export const remainingSeconds = (timer, now = Date.now()) =>
  timer.running && timer.endsAt ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : Math.max(0, timer.remaining);

/* ── Reducer ───────────────────────────────────────────────────────────── */

export function reducer(state, action) {
  const { type, payload = {} } = action;

  switch (type) {
    /* ── Contestants ─────────────────────────────────────────────────── */
    case 'contestant/add': {
      const name = String(payload.name || '').trim();
      if (!name) throw new Error('A name is required before Big Boss can open the door.');
      if (state.contestants.some((c) => c.name.toLowerCase() === name.toLowerCase()))
        throw new Error(`${name} is already inside the House.`);

      const contestant = {
        id: uid('c'),
        name,
        team: TEAMS.includes(payload.team) ? payload.team : TEAMS[0],
        points: clampPoints(payload.points),
        status: 'active',
        immunity: false,
        nomination: null,
        isCaptain: false,
        tasksCompleted: 0,
        joinedAt: Date.now(),
        evictedAt: null,
        evictionReason: '',
        notes: '',
      };
      return appendLog(
        { ...state, contestants: [...state.contestants, contestant] },
        'contestant',
        `${name} entered the House for Team ${contestant.team}.`,
        { contestantId: contestant.id, kind: 'enter' },
      );
    }

    case 'contestant/update': {
      const current = requireContestant(state, payload.id);
      const name = String(payload.name ?? current.name).trim();
      if (!name) throw new Error('Name cannot be empty.');
      if (state.contestants.some((c) => c.id !== current.id && c.name.toLowerCase() === name.toLowerCase()))
        throw new Error('Another contestant already uses that name.');

      const next = patchContestant(state, current.id, {
        name,
        team: TEAMS.includes(payload.team) ? payload.team : current.team,
        points: payload.points == null ? current.points : clampPoints(payload.points),
        notes: String(payload.notes ?? current.notes).trim(),
      });
      return appendLog(next, 'contestant', `${name}'s House record was updated by Big Boss.`, {
        contestantId: current.id,
        kind: 'update',
      });
    }

    case 'contestant/remove': {
      const contestant = requireContestant(state, payload.id);
      const tasks = state.tasks.map((task) => ({
        ...task,
        assignees: task.assignees.filter((id) => id !== contestant.id),
      }));
      const next = {
        ...state,
        contestants: state.contestants.filter((c) => c.id !== contestant.id),
        tasks,
      };
      return appendLog(next, 'eviction', `${contestant.name} was permanently removed from the House.`, {
        contestantId: contestant.id,
        kind: 'purge',
      });
    }

    /* ── Points ──────────────────────────────────────────────────────── */
    case 'points/adjust': {
      const contestant = requireContestant(state, payload.id);
      if (contestant.status === 'evicted') throw new Error(`${contestant.name} has left the House — points are final.`);
      const delta = Math.round(Number(payload.delta) || 0);
      if (!delta) throw new Error('Enter a non-zero point value.');
      const points = clampPoints(contestant.points + delta);
      const applied = points - contestant.points;

      const next = patchContestant(state, contestant.id, { points });
      return appendLog(
        next,
        'points',
        `${applied > 0 ? '+' : ''}${applied} pts to ${contestant.name} → ${points} pts${payload.reason ? ` · ${payload.reason}` : ''}`,
        { contestantId: contestant.id, delta: applied, points },
      );
    }

    /* ── Captaincy (exactly one Captain at a time) ───────────────────── */
    case 'captain/set': {
      const contestant = requireContestant(state, payload.id);
      if (contestant.status === 'evicted') throw new Error(`${contestant.name} has left the House and cannot lead it.`);
      const previous = state.contestants.find((c) => c.isCaptain && c.status === 'active');
      if (previous && previous.id === contestant.id) throw new Error(`${contestant.name} is already the House Captain.`);

      const next = {
        ...state,
        contestants: state.contestants.map((c) => ({ ...c, isCaptain: c.id === contestant.id })),
      };
      return appendLog(
        next,
        'captain',
        previous
          ? `Captaincy transferred from ${previous.name} to ${contestant.name}.`
          : `${contestant.name} was appointed House Captain.`,
        { contestantId: contestant.id, from: previous?.id ?? null },
      );
    }

    case 'captain/revoke': {
      const previous = state.contestants.find((c) => c.isCaptain);
      if (!previous) return state;
      const next = { ...state, contestants: state.contestants.map((c) => ({ ...c, isCaptain: false })) };
      return appendLog(next, 'captain', `${previous.name} stepped down as House Captain.`, {
        contestantId: previous.id,
      });
    }

    /* ── Immunity ────────────────────────────────────────────────────── */
    case 'immunity/grant': {
      const ids = [].concat(payload.ids ?? payload.id ?? []);
      const granted = [];
      ids.forEach((id) => {
        const contestant = findContestant(state, id);
        if (!contestant) return;
        if (contestant.status === 'evicted') throw new Error(`${contestant.name} has left the House — immunity is void.`);
        if (contestant.immunity) throw new Error(`${contestant.name} already holds immunity.`);
        granted.push(contestant);
      });
      if (!granted.length) return state;

      const grantedIds = granted.map((c) => c.id);
      const next = patchMany(state, grantedIds, () => ({ immunity: true, nomination: null }));
      const revoked = granted.filter((c) => c.nomination).length;
      const names = granted.map((c) => c.name).join(', ');
      return appendLog(
        next,
        'immunity',
        `${names} ${granted.length > 1 ? 'have' : 'has'} won immunity${payload.reason ? ` · ${payload.reason}` : ''}${
          revoked ? ' · nomination revoked' : ''
        }.`,
        { contestantIds: grantedIds, kind: 'grant' },
      );
    }

    case 'immunity/revoke': {
      const contestant = requireContestant(state, payload.id);
      if (!contestant.immunity) return state;
      const next = patchContestant(state, contestant.id, { immunity: false });
      return appendLog(next, 'immunity', `Immunity revoked for ${contestant.name}.`, {
        contestantId: contestant.id,
        kind: 'revoke',
      });
    }

    /* ── Nominations ─────────────────────────────────────────────────── */
    case 'nomination/add': {
      const ids = [].concat(payload.ids ?? payload.id ?? []);
      const nominated = [];
      ids.forEach((id) => {
        const contestant = findContestant(state, id);
        if (!contestant) return;
        // House rules — immune contestants are hard-blocked.
        if (contestant.status === 'evicted') throw new Error(`${contestant.name} has been evicted and is out of the House.`);
        if (contestant.immunity) throw new Error(`${contestant.name} holds immunity — nomination denied.`);
        if (contestant.nomination) throw new Error(`${contestant.name} is already in the Danger Zone.`);
        if (contestant.isCaptain) throw new Error(`${contestant.name} is the House Captain and is protected from nomination.`);
        nominated.push(contestant);
      });
      if (!nominated.length) return state;

      const nominatedIds = nominated.map((c) => c.id);
      const round = state.nominationRound;
      const next = patchMany(state, nominatedIds, () => ({
        nomination: { round, reason: payload.reason || '', at: Date.now() },
      }));
      const names = nominated.map((c) => c.name).join(', ');
      return appendLog(next, 'nomination', `${names} ${nominated.length > 1 ? 'were' : 'was'} nominated (Round ${round}).`, {
        contestantIds: nominatedIds,
        round,
        kind: 'add',
      });
    }

    case 'nomination/withdraw': {
      const contestant = requireContestant(state, payload.id);
      if (!contestant.nomination) return state;
      const next = patchContestant(state, contestant.id, { nomination: null });
      return appendLog(next, 'nomination', `Nomination withdrawn for ${contestant.name}.`, {
        contestantId: contestant.id,
        kind: 'withdraw',
      });
    }

    case 'nomination/clear': {
      const count = state.contestants.filter((c) => c.nomination).length;
      if (!count) return state;
      const next = { ...state, contestants: state.contestants.map((c) => ({ ...c, nomination: null })) };
      return appendLog(next, 'nomination', `All ${count} nomination(s) cleared. The Danger Zone is empty.`, { kind: 'clear' });
    }

    case 'nomination/nextRound': {
      const next = {
        ...state,
        nominationRound: state.nominationRound + 1,
        contestants: state.contestants.map((c) => ({ ...c, nomination: null })),
      };
      return appendLog(next, 'nomination', `Round ${next.nominationRound} opened. Danger Zone reset.`, {
        kind: 'round',
        round: next.nominationRound,
      });
    }

    /* ── Eviction ────────────────────────────────────────────────────── */
    case 'eviction/evict': {
      const contestant = requireContestant(state, payload.id);
      if (contestant.status === 'evicted') throw new Error(`${contestant.name} has already left the House.`);

      const overrodeImmunity = contestant.immunity;
      const wasCaptain = contestant.isCaptain;
      const reason = payload.reason?.trim() || 'Evicted by Big Boss';

      const next = {
        ...state,
        contestants: state.contestants.map((c) =>
          c.id === contestant.id
            ? {
                ...c,
                status: 'evicted',
                evictedAt: Date.now(),
                evictionReason: reason,
                nomination: null,
                immunity: false,
                isCaptain: false,
              }
            : c,
        ),
        tasks: state.tasks.map((task) => ({
          ...task,
          assignees: task.assignees.filter((id) => id !== contestant.id),
        })),
      };

      return appendLog(
        next,
        'eviction',
        `${contestant.name} has been EVICTED from the Tech House · ${reason}.` +
          (overrodeImmunity ? ' Big Boss overrode their immunity.' : '') +
          (wasCaptain ? ' Captaincy is now vacant.' : ''),
        { contestantId: contestant.id, kind: 'evict', overrodeImmunity, wasCaptain },
      );
    }

    case 'eviction/evictRound': {
      const upForVote = state.contestants.filter((c) => c.nomination && c.status === 'active');
      if (!upForVote.length) throw new Error('Nobody is in the Danger Zone. There is no vote to run.');
      const ids = upForVote.map((c) => c.id);
      const names = upForVote.map((c) => c.name).join(', ');

      const next = {
        ...state,
        contestants: state.contestants.map((c) =>
          ids.includes(c.id)
            ? { ...c, status: 'evicted', evictedAt: Date.now(), evictionReason: 'Evicted by House vote', nomination: null, immunity: false, isCaptain: false }
            : c,
        ),
        tasks: state.tasks.map((task) => ({ ...task, assignees: task.assignees.filter((id) => !ids.includes(id)) })),
      };
      return appendLog(next, 'eviction', `House vote complete — ${names} evicted from the Tech House.`, {
        contestantIds: ids,
        kind: 'evictRound',
      });
    }

    case 'eviction/reinstate': {
      const contestant = requireContestant(state, payload.id);
      if (contestant.status === 'active') return state;
      const next = patchContestant(state, contestant.id, {
        status: 'active',
        evictedAt: null,
        evictionReason: '',
      });
      return appendLog(next, 'eviction', `${contestant.name} was reinstated into the House by Big Boss.`, {
        contestantId: contestant.id,
        kind: 'reinstate',
      });
    }

    /* ── Tasks ───────────────────────────────────────────────────────── */
    case 'task/create': {
      const title = String(payload.title || '').trim();
      if (!title) throw new Error('A task needs a title.');
      const assignees = (payload.assignees || []).filter((id) => {
        const c = findContestant(state, id);
        return c && c.status === 'active';
      });
      if (!assignees.length) throw new Error('Assign the task to at least one active contestant.');

      const task = {
        id: uid('t'),
        title,
        description: String(payload.description || '').trim(),
        assignees,
        points: Math.max(0, Math.round(Number(payload.points) || 0)),
        status: 'pending',
        createdAt: Date.now(),
        completedAt: null,
      };
      const names = assignees.map((id) => findContestant(state, id).name).join(', ');
      return appendLog({ ...state, tasks: [task, ...state.tasks] }, 'task', `Task "${title}" assigned to ${names}.`, {
        taskId: task.id,
        kind: 'create',
      });
    }

    case 'task/status': {
      const task = state.tasks.find((t) => t.id === payload.id);
      if (!task) throw new Error('That task no longer exists.');
      const status = payload.status;
      if (!['pending', 'active', 'completed', 'failed'].includes(status)) return state;
      if (status === 'completed' && task.status === 'completed') throw new Error('This task is already completed.');

      const tasks = state.tasks.map((t) =>
        t.id === task.id
          ? { ...t, status, completedAt: status === 'completed' ? Date.now() : null }
          : t,
      );
      let next = { ...state, tasks };

      if (status === 'completed') {
        // Award points to every active assignee.
        const rewarded = task.assignees.filter((id) => {
          const c = findContestant(state, id);
          return c && c.status === 'active';
        });
        next = patchMany(next, rewarded, (c) => ({
          points: clampPoints(c.points + task.points),
          tasksCompleted: c.tasksCompleted + 1,
        }));
        const names = rewarded.map((id) => findContestant(state, id).name).join(', ') || 'nobody';
        return appendLog(next, 'task', `Task "${task.title}" COMPLETED · +${task.points} pts each to ${names}.`, {
          taskId: task.id,
          kind: 'complete',
          points: task.points,
          contestantIds: rewarded,
        });
      }

      const label = { pending: 'PENDING', active: 'IN PROGRESS', failed: 'FAILED' }[status];
      return appendLog(next, 'task', `Task "${task.title}" marked ${label}.`, { taskId: task.id, kind: status });
    }

    case 'task/delete': {
      const task = state.tasks.find((t) => t.id === payload.id);
      if (!task) return state;
      return appendLog(
        { ...state, tasks: state.tasks.filter((t) => t.id !== task.id) },
        'task',
        `Task "${task.title}" deleted.`,
        { taskId: task.id, kind: 'delete' },
      );
    }

    /* ── Timer ───────────────────────────────────────────────────────── */
    case 'timer/setDuration': {
      const seconds = Math.max(1, Math.round(Number(payload.seconds) || 0));
      const timer = { ...state.timer, duration: seconds, remaining: seconds, running: false, endsAt: null };
      return appendLog({ ...state, timer }, 'timer', `Timer set to ${formatSeconds(seconds)}.`, { kind: 'set' });
    }

    case 'timer/start': {
      const timer = { ...state.timer };
      if (payload.label != null) timer.label = String(payload.label);
      if (timer.remaining <= 0) timer.remaining = timer.duration;
      timer.running = true;
      timer.endsAt = Date.now() + timer.remaining * 1000;
      return appendLog({ ...state, timer }, 'timer', `Countdown STARTED · ${formatSeconds(timer.remaining)} on the clock.`, {
        kind: 'start',
      });
    }

    case 'timer/pause': {
      if (!state.timer.running) return state;
      const timer = { ...state.timer, remaining: remainingSeconds(state.timer), running: false, endsAt: null };
      return appendLog({ ...state, timer }, 'timer', `Countdown PAUSED at ${formatSeconds(timer.remaining)}.`, { kind: 'pause' });
    }

    case 'timer/reset': {
      const timer = {
        ...state.timer,
        running: false,
        endsAt: null,
        remaining: state.timer.duration,
        label: payload.label != null ? String(payload.label) : state.timer.label,
      };
      return appendLog({ ...state, timer }, 'timer', `Countdown RESET to ${formatSeconds(timer.duration)}.`, { kind: 'reset' });
    }

    case 'timer/label': {
      const label = String(payload.label || '').trim();
      if (label === state.timer.label) return state;
      return appendLog({ ...state, timer: { ...state.timer, label } }, 'timer', `Timer relabelled to "${label}".`, { kind: 'label' });
    }

    case 'timer/tick': {
      if (!state.timer.running) return state;
      const now = payload.now ?? Date.now();
      const left = remainingSeconds(state.timer, now);
      if (left === state.timer.remaining) return state;

      if (left <= 0) {
        const timer = { ...state.timer, remaining: 0, running: false, endsAt: null };
        const announcement = {
          id: uid('a'),
          message: '⏰ TIME IS UP. The task window in the Tech House is now closed.',
          tone: 'alert',
          createdAt: now,
        };
        const next = {
          ...state,
          timer,
          announcements: [announcement, ...state.announcements].slice(0, MAX_ANNOUNCEMENTS),
        };
        return appendLog(next, 'timer', 'Countdown reached zero. TIME UP.', { kind: 'timeup' });
      }

      return { ...state, timer: { ...state.timer, remaining: left } };
    }

    /* ── Announcements ───────────────────────────────────────────────── */
    case 'announcement/add': {
      const message = String(payload.message || '').trim();
      if (!message) throw new Error('Big Boss cannot broadcast an empty message.');
      const announcement = {
        id: uid('a'),
        message,
        tone: ['accent', 'info', 'alert', 'success'].includes(payload.tone) ? payload.tone : 'info',
        createdAt: Date.now(),
      };
      const next = { ...state, announcements: [announcement, ...state.announcements].slice(0, MAX_ANNOUNCEMENTS) };
      return appendLog(next, 'announcement', `Big Boss broadcast: "${message}"`, {
        announcementId: announcement.id,
        kind: 'add',
      });
    }

    case 'announcement/delete': {
      const announcement = state.announcements.find((a) => a.id === payload.id);
      if (!announcement) return state;
      return appendLog(
        { ...state, announcements: state.announcements.filter((a) => a.id !== payload.id) },
        'announcement',
        'An announcement was removed from the archive.',
        { announcementId: announcement.id, kind: 'delete' },
      );
    }

    /* ── House ───────────────────────────────────────────────────────── */
    case 'house/update': {
      const house = {
        name: String(payload.name || state.house.name).trim() || state.house.name,
        season: Math.max(1, Math.round(Number(payload.season) || state.house.season)),
        day: state.house.day,
      };
      return appendLog({ ...state, house }, 'session', 'House configuration updated.', { kind: 'config' });
    }

    case 'house/advanceDay': {
      const house = { ...state.house, day: state.house.day + 1 };
      return appendLog({ ...state, house }, 'session', `Day ${house.day} in the House has begun.`, { kind: 'day' });
    }

    case 'house/hydrate':
      // Keep the operator's current UI preferences when data is restored.
      return {
        ...payload.state,
        ui: { ...(payload.state.ui || state.ui), ...state.ui },
        session: state.session,
        notify: state.notify,
        log: payload.state.log?.length ? payload.state.log : state.log,
      };

    case 'house/reset':
      // A fresh House inherits the current UI session (view, sidebar, intro)
      // and the operator's role + notification preferences.
      return { ...payload.state, ui: { ...payload.state.ui, ...state.ui }, session: state.session, notify: state.notify };

    case 'log/clear':
      return { ...state, log: [{ id: uid('l'), type: 'session', message: 'Activity log cleared by Big Boss.', createdAt: Date.now() }] };

    /* ── Access control (roles) ──────────────────────────────────────── */
    case 'role/set': {
      const role = ROLES[payload.role] ? payload.role : null;
      if (!role) throw new Error('That role does not exist in the Command Center.');
      if (role === roleId(state)) return state;
      const actor = ROLES[roleId(state)].label;
      const next = { ...state, session: { ...(state.session || {}), role } };
      return appendLog(next, 'access', `Access switched from ${actor} to ${ROLES[role].label} — ${ROLES[role].tagline.toLowerCase()}.`, {
        kind: 'role',
        role,
        previousRole: roleId(state),
      });
    }

    case 'access/denied': {
      const role = ROLES[payload.role] ? payload.role : roleId(state);
      const attempt = payload.attemptType;
      // Collapse rapid repeats: holding a locked control should not flood the log.
      const duplicate = state.log.find(
        (entry) =>
          entry.type === 'access' &&
          entry.kind === 'denied' &&
          entry.attemptType === attempt &&
          Date.now() - entry.createdAt < 5000,
      );
      if (duplicate) return state;
      return appendLog(state, 'access', `Blocked: ${ROLES[role].label} access cannot ${describeAction(attempt)}.`, {
        kind: 'denied',
        role,
        attemptType: attempt,
      });
    }

    /* ── Event notifications ─────────────────────────────────────────── */
    case 'notify/add': {
      const items = [].concat(payload.items || payload.item || []).filter(Boolean);
      if (!items.length) return state;
      const known = new Set(state.notifications.map((item) => item.sourceId).filter(Boolean));
      const fresh = items.filter((item) => !item.sourceId || !known.has(item.sourceId));
      if (!fresh.length) return state;
      return { ...state, notifications: [...fresh, ...state.notifications].slice(0, MAX_NOTIFICATIONS) };
    }

    case 'notify/read': {
      const ids = new Set([].concat(payload.ids || payload.id || []).filter(Boolean));
      if (!ids.size) return state;
      let changed = false;
      const notifications = state.notifications.map((item) => {
        if (!ids.has(item.id) || item.read) return item;
        changed = true;
        return { ...item, read: true };
      });
      return changed ? { ...state, notifications } : state;
    }

    case 'notify/readAll': {
      if (!state.notifications.some((item) => !item.read)) return state;
      return { ...state, notifications: state.notifications.map((item) => (item.read ? item : { ...item, read: true })) };
    }

    case 'notify/clear': {
      const next = payload.all ? [] : state.notifications.filter((item) => !item.read);
      if (next.length === state.notifications.length) return state;
      return { ...state, notifications: next };
    }

    case 'notify/prefs': {
      const groups = { ...(state.notify?.groups || {}) };
      Object.entries(payload.groups || {}).forEach(([key, value]) => {
        groups[key] = Boolean(value);
      });
      const notify = {
        browser: payload.browser === undefined ? state.notify?.browser ?? false : Boolean(payload.browser),
        dnd: payload.dnd === undefined ? state.notify?.dnd ?? false : Boolean(payload.dnd),
        groups,
      };
      return { ...state, notify };
    }

    /* ── UI preferences (not part of the House record) ───────────────── */
    case 'ui/patch':
      return { ...state, ui: { ...state.ui, ...payload } };

    default:
      return state;
  }
}

/** Local formatter so the reducer stays dependency-free. */
function formatSeconds(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
