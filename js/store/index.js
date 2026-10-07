/**
 * Store — the single source of truth for the Command Center.
 * Minimal observable store: subscribe + dispatch, persisted to localStorage.
 */
import { reducer } from './reducer.js';
import { createSeed } from './seed.js';
import * as selectors from './selectors.js';
import { checkAccess, roleId, AccessError, ROLES, DEFAULT_ROLE } from './roles.js';

const STORAGE_KEY = 'bb-command-centre.v1';
const PERSIST_THROTTLE_MS = 1500;

/* ── Persistence ───────────────────────────────────────────────────────── */

function loadState() {
  const seed = createSeed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.contestants) || !parsed.contestants.length) return seed;

    // Forward/backward compatible defaults for anything missing.
    const role = ROLES[parsed.session?.role] ? parsed.session.role : DEFAULT_ROLE;
    return {
      ...seed,
      ...parsed,
      version: 3,
      house: { ...seed.house, ...(parsed.house || {}) },
      timer: { ...seed.timer, ...(parsed.timer || {}) },
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
      log: Array.isArray(parsed.log) ? parsed.log : [],
      session: { role },
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      notify: { ...seed.notify, ...(parsed.notify || {}), groups: { ...seed.notify.groups, ...(parsed.notify?.groups || {}) } },
      ui: { ...seed.ui, ...(parsed.ui || {}) },
    };
  } catch (error) {
    console.warn('[command-center] Could not read saved House — starting a fresh season.', error);
    return seed;
  }
}

function createStore(initialState) {
  let state = initialState;
  let lastPersist = 0;
  const listeners = new Set();

  /**
   * Dispatch an action.
   * @param {{type: string, payload?: object, meta?: object}} action
   * @returns {object} the next state
   * @throws {Error} when the action violates a House rule (reducer validates)
   */
  function dispatch(action) {
    // ── Role-based access control ────────────────────────────────────────
    // Every mutation funnels through here, so the policy is enforced once.
    const denial = checkAccess(state, action);
    if (denial) {
      const role = roleId(state);
      const next = reducer(state, { type: 'access/denied', payload: { role, attemptType: action.type } });
      if (next !== state) {
        state = next;
        persist();
        listeners.forEach((listener) => listener(state, action));
      }
      throw new AccessError(denial, { action, role });
    }

    const next = reducer(state, action);
    if (next === state) return state; // no-op action, skip notification
    state = next;

    const now = Date.now();
    const throttled = action.meta?.throttlePersist;
    if (!throttled || now - lastPersist > PERSIST_THROTTLE_MS) {
      lastPersist = now;
      persist();
    }
    listeners.forEach((listener) => listener(state, action));
    return state;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('[command-center] Could not persist state.', error);
    }
  }

  return {
    getState: () => state,
    dispatch,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    flush: persist,
  };
}

export const store = createStore(loadState());
export { selectors, STORAGE_KEY };
export const getState = store.getState;
export const dispatch = store.dispatch;
export const subscribe = store.subscribe;

/* Re-export the most used selectors for ergonomic imports. */
export const {
  activeContestants,
  evictedContestants,
  leaderboard,
  dangerZone,
  immuneContestants,
  houseCaptain,
  eligibleForNomination,
  rankOf,
  maxPoints,
  timerView,
  houseStats,
} = selectors;

export { TEAMS } from './seed.js';
export { ROLES, ROLE_ORDER, roleId, roleOf, checkAccess, can, AccessError, matrixFor } from './roles.js';
