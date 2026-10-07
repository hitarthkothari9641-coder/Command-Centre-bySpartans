/**
 * Permission mirroring for the DOM.
 *
 * Access control is *enforced* in the store. This module only reflects the
 * decision onto the UI: any element whose `data-action` maps to a reducer
 * action the current role may not run is locked (disabled + lock badge +
 * explanation), so an operator never fills in a form they cannot submit.
 */
import { $$, esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { checkAccess, roleId, ROLES } from '../store/roles.js';

/**
 * UI action → the reducer action(s) it performs.
 * Read-only actions (nav, replay, export) are intentionally absent.
 */
export const ACTION_TYPES = {
  'points:quick': ['points/adjust'],
  'points:open': ['points/adjust'],

  'contestant:add': ['contestant/add'],
  'contestant:edit': ['contestant/update'],

  'captain:open': ['captain/set'],
  'captain:set': ['captain/set'],
  'captain:revoke': ['captain/revoke'],

  'immunity:open': ['immunity/grant'],
  'immunity:grant': ['immunity/grant'],
  'immunity:revoke': ['immunity/revoke'],

  'nomination:open': ['nomination/add'],
  'nomination:add': ['nomination/add'],
  'nomination:selected': ['nomination/add'],
  'nomination:withdraw': ['nomination/withdraw'],
  'nomination:clear': ['nomination/clear'],
  'nomination:nextRound': ['nomination/nextRound'],

  'eviction:open': ['eviction/evict'],
  'eviction:round': ['eviction/evictRound'],
  'eviction:reinstate': ['eviction/reinstate'],
  'eviction:purge': ['contestant/remove'],

  'task:open': ['task/create'],
  'task:start': ['task/status'],
  'task:pending': ['task/status'],
  'task:complete': ['task/status'],
  'task:reopen': ['task/status'],
  'task:fail': ['task/status'],
  'task:delete': ['task/delete'],

  'timer:start': ['timer/start'],
  'timer:pause': ['timer/pause'],
  'timer:toggle': ['timer/start', 'timer/pause'],
  'timer:reset': ['timer/reset'],
  'timer:preset': ['timer/setDuration'],
  'timer:custom': ['timer/setDuration'],
  'timer:label': ['timer/label'],

  'announcement:open': ['announcement/add'],
  'announcement:send': ['announcement/add'],
  'announcement:delete': ['announcement/delete'],

  'log:clear': ['log/clear'],
  'advance-day': ['house/advanceDay'],
  'house:save': ['house/update'],
  'house:reset': ['house/reset'],
  'house:clear': ['house/reset'],
  'house:import': ['house/hydrate'],

  'feed:simulate': ['ui/patch'],
};

/** Build the payload a reducer action would receive, straight from the element. */
export function payloadFrom(node) {
  const data = node.dataset;
  return {
    id: data.id,
    ids: data.ids ? data.ids.split(',').filter(Boolean) : undefined,
    assignees: data.assignees ? data.assignees.split(',').filter(Boolean) : undefined,
    taskId: data.taskId,
    delta: data.delta != null ? Number(data.delta) : undefined,
  };
}

/** Is this element's action allowed for the current role? */
export function allowed(state, node) {
  const types = ACTION_TYPES[node.dataset?.action];
  if (!types || !types.length) return { ok: true };
  const payload = payloadFrom(node);
  const problems = types.map((type) => checkAccess(state, { type, payload })).filter(Boolean);
  // Multi-action controls (e.g. timer toggle) are allowed when any branch is.
  if (problems.length < types.length) return { ok: true };
  return { ok: false, reason: problems[0], type: types[0] };
}

let lockedCount = 0;

/**
 * Lock every control the current role may not use.
 * @returns number of locked controls (used by the access bar copy)
 */
export function applyPermissions(state, root = document) {
  const role = roleId(state);
  let count = 0;

  $$('[data-action]', root).forEach((node) => {
    const verdict = allowed(state, node);
    const wasLocked = node.dataset.locked === 'true';

    if (verdict.ok) {
      if (wasLocked) {
        node.dataset.locked = 'false';
        node.classList.remove('is-locked');
        node.removeAttribute('aria-disabled');
        node.removeAttribute('data-locked-reason');
        if (node.disabled) node.disabled = false;
        node.querySelector(':scope > .lock-badge')?.remove();
      }
      return;
    }

    count += 1;
    node.dataset.locked = 'true';
    node.dataset.lockedReason = verdict.reason;
    node.classList.add('is-locked');
    node.setAttribute('aria-disabled', 'true');
    node.title = verdict.reason;
    // Buttons that would open a form are disabled outright; inputs inside
    // menus stay focusable so the reason is discoverable by keyboard.
    if (node.tagName === 'BUTTON' && !node.closest('.menu')) node.disabled = true;
    if (!node.querySelector(':scope > .lock-badge')) {
      const badge = document.createElement('span');
      badge.className = 'lock-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.innerHTML = icon('lock', 11);
      node.appendChild(badge);
    }
  });

  document.body.dataset.role = role;
  lockedCount = count;
  return count;
}

/** Publish the total across every pass of `applyPermissions` for this paint. */
export function setLockedCount(total) {
  document.body.dataset.lockedControls = String(total);
  lockedCount = total;
  return total;
}

export const lockedControls = () => lockedCount;

/** The signed-in operator as a chip (also the sign-in trigger). */
export function roleChip(state, { compact = false } = {}) {
  const role = ROLES[roleId(state)];
  return `
    <button class="chip chip--role" data-action="role:open" data-tone="${role.tone}" type="button"
      aria-haspopup="dialog" title="${esc(`Signed in as ${role.label} — ${role.tagline}. Click to switch role.`)}">
      ${icon(role.icon, 13)}
      <span class="chip__text">${compact ? esc(role.label) : esc(role.label)}</span>
      <span class="chip__caret">${icon('chevron-down', 12)}</span>
    </button>
  `;
}

/** Read-only ribbon shown under the top bar whenever the role is restricted. */
export function accessBar(state, { locked = 0 } = {}) {
  const role = ROLES[roleId(state)];
  if (role.id === 'bigboss') return '';

  const captain = state.contestants.find((c) => c.isCaptain && c.status === 'active');
  const scope =
    role.id === 'captain' && captain ? ` You are acting as ${captain.name} · Team ${captain.team}.` : '';
  const message =
    role.id === 'viewer'
      ? 'Read-only audience mode — every dashboard and the live log stay visible, but House changes are blocked.'
      : `Actions outside your mandate are locked${locked ? ` (${locked} on this screen)` : ''}.`;

  return `
    <div class="access-bar" data-role="${role.id}" role="status">
      <span class="access-bar__icon">${icon(role.id === 'viewer' ? 'eye' : role.icon, 14)}</span>
      <span class="access-bar__text">
        <strong>${esc(role.label)} access</strong> · ${esc(message)}${esc(scope)}
      </span>
      <span class="spacer"></span>
      <button class="btn btn--xs btn--ghost" data-action="role:open">${icon('key', 13)} Switch role</button>
    </div>
  `;
}
