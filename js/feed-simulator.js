/**
 * Demo feed simulator.
 *
 * The Command Center is a static, client-side app: without this, nothing in the
 * House changes until an operator clicks something. With it enabled, the room
 * generates plausible House events every ~10 seconds — points awards, task
 * progress and the occasional task completion — so the live log, the
 * performance analytics and the notification rules all keep moving.
 *
 * It is opt-in (Settings → Notifications), clearly labelled as a demo, and it
 * dispatches *real* actions through the store, marked `meta.system` so the
 * House keeps breathing regardless of which role is signed in.
 */

const REASONS = [
  'Arena challenge',
  'Audience vote',
  'Kitchen duty bonus',
  'Diary room honesty',
  'House contribution',
  'Coding sprint',
  'Microphone moment',
];

const AWARDS = [5, 10, 10, 15, 20, 25];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * @param {{dispatch: Function, getState: Function, navigate?: Function}} deps
 */
export function createFeedSimulator({ dispatch, getState }) {
  /** Emit exactly one House event. Returns a description (or null). */
  function emit() {
    const state = getState();
    const active = state.contestants.filter((contestant) => contestant.status === 'active');
    if (!active.length) return null;

    const roll = Math.random();

    /* 70 % — a points award somewhere in the House. */
    if (roll < 0.7) {
      const person = pick(active);
      const delta = pick(AWARDS);
      dispatch({
        type: 'points/adjust',
        payload: { id: person.id, delta, reason: pick(REASONS) },
        meta: { system: true, simulated: true },
      });
      return `+${delta} pts → ${person.name}`;
    }

    /* 20 % — a pending task kicks off. */
    const pending = state.tasks.filter((task) => task.status === 'pending');
    if (roll < 0.9 && pending.length) {
      const task = pick(pending);
      dispatch({ type: 'task/status', payload: { id: task.id, status: 'active' }, meta: { system: true, simulated: true } });
      return `task "${task.title}" → in progress`;
    }

    /* 10 % — an active task is completed and pays out. */
    const activeTasks = state.tasks.filter((task) => task.status === 'active' && task.assignees.length);
    if (activeTasks.length) {
      const task = pick(activeTasks);
      dispatch({ type: 'task/status', payload: { id: task.id, status: 'completed' }, meta: { system: true, simulated: true } });
      return `task "${task.title}" completed`;
    }

    const person = pick(active);
    dispatch({
      type: 'points/adjust',
      payload: { id: person.id, delta: pick(AWARDS), reason: pick(REASONS) },
      meta: { system: true, simulated: true },
    });
    return `+pts → ${person.name}`;
  }

  let timer = null;

  return {
    emit,
    get running() {
      return timer !== null;
    },
    start(intervalMs = 10000) {
      if (timer) return;
      timer = setInterval(() => {
        // Never fight a House rule violation: swallow and let the next tick try.
        try {
          emit();
        } catch (error) {
          console.warn('[Big Boss] simulated event rejected:', error.message);
        }
      }, intervalMs);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
    toggle(enabled, intervalMs) {
      if (enabled) this.start(intervalMs);
      else this.stop();
    },
  };
}
