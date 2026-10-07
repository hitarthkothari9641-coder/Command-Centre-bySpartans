import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Avatar } from './Avatar.js';
import { ContestantFlags, TeamBadge } from './Badge.js';

/**
 * ContestantCard — the primary unit of the Contestants view.
 * One clear primary action (points) with everything else behind the ⋯ menu.
 */
export function ContestantCard(contestant, index = 0) {
  const evicted = contestant.status === 'evicted';
  const blocked = contestant.immunity || contestant.isCaptain;

  const primaryAction = evicted
    ? `<button class="btn btn--success btn--sm" data-action="eviction:reinstate" data-id="${esc(contestant.id)}">
         ${icon('log-in', 14)}<span class="btn__label">Reinstate</span>
       </button>`
    : `<div class="points-stepper" role="group" aria-label="Adjust points for ${esc(contestant.name)}">
         <button class="btn btn--sm" data-action="points:quick" data-id="${esc(contestant.id)}" data-delta="-10"
           aria-label="Deduct 10 points">−10</button>
         <button class="btn btn--sm" data-action="points:quick" data-id="${esc(contestant.id)}" data-delta="10"
           aria-label="Award 10 points">+10</button>
         <button class="btn btn--sm" data-action="points:open" data-id="${esc(contestant.id)}"
           aria-label="Custom point adjustment">${icon('plus', 13)}</button>
       </div>`;

  const secondaryAction = evicted
    ? `<button class="btn btn--sm btn--danger" data-action="eviction:purge" data-id="${esc(contestant.id)}">
         ${icon('trash', 13)}<span class="btn__label">Delete</span>
       </button>`
    : blocked
      ? `<button class="btn btn--sm ${contestant.immunity ? 'is-blocked' : ''}" data-action="nomination:blocked"
           data-id="${esc(contestant.id)}" title="${esc(
             contestant.immunity ? 'Immunity active — nomination denied' : 'The House Captain cannot be nominated',
           )}">
           ${icon(contestant.immunity ? 'shield' : 'crown', 13)}<span class="btn__label">Nominate</span>
         </button>`
      : `<button class="btn btn--sm btn--danger" data-action="nomination:add" data-id="${esc(contestant.id)}">
           ${icon('alert', 13)}<span class="btn__label">Nominate</span>
         </button>`;

  return `
    <article class="contestant glass${evicted ? '' : ''}"
      data-id="${esc(contestant.id)}" data-team="${esc(contestant.team)}" style="--i:${index}"
      data-nominated="${Boolean(contestant.nomination)}" data-immune="${Boolean(contestant.immunity)}"
      data-captain="${Boolean(contestant.isCaptain)}" data-evicted="${evicted}">

      <header class="contestant__head">
        ${Avatar(contestant, 'lg')}
        <div class="contestant__id">
          <div class="contestant__name">${esc(contestant.name)}</div>
          <div class="contestant__team">${TeamBadge(contestant.team)}</div>
        </div>
        ${MenuButton(contestant)}
      </header>

      <div class="contestant__flags">${ContestantFlags(contestant)}</div>

      <div class="contestant__score">
        <b data-count-to="${contestant.points}" data-count-key="card:${esc(contestant.id)}" data-count-pop="true">${contestant.points}</b>
        <span>house points</span>
      </div>

      <div class="contestant__meta">
        <span>${icon('check', 12)} ${contestant.tasksCompleted} task${contestant.tasksCompleted === 1 ? '' : 's'}</span>
        <span>${icon('clock', 12)} joined ${new Date(contestant.joinedAt || Date.now()).toLocaleDateString()}</span>
      </div>

      <div class="contestant__actions">
        ${primaryAction}
        ${secondaryAction}
      </div>

      ${ActionMenu(contestant, evicted)}
    </article>
  `;
}

export const MenuButton = (contestant) => `
  <div class="has-menu">
    <button class="btn btn--icon btn--ghost btn--sm" data-action="menu:toggle"
      aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${esc(contestant.name)}">
      ${icon('dots', 15)}
    </button>
  </div>
`;

/** Secondary actions live here — keeps every card to one primary button. */
function ActionMenu(contestant, evicted) {
  const id = esc(contestant.id);
  if (evicted) {
    return `
      <div class="menu" role="menu" aria-label="Actions for ${esc(contestant.name)}">
        <div class="menu__label">House record</div>
        <button class="menu__item" role="menuitem" data-action="eviction:reinstate" data-id="${id}">
          ${icon('log-in', 14)} Reinstate into the House
        </button>
        <button class="menu__item" role="menuitem" data-action="contestant:edit" data-id="${id}">
          ${icon('edit', 14)} Edit record
        </button>
        <div class="menu__sep"></div>
        <button class="menu__item" role="menuitem" data-tone="danger" data-action="eviction:purge" data-id="${id}">
          ${icon('trash', 14)} Delete permanently
        </button>
      </div>
    `;
  }

  return `
    <div class="menu" role="menu" aria-label="Actions for ${esc(contestant.name)}">
      <div class="menu__label">House control</div>
      <button class="menu__item" role="menuitem" data-action="points:open" data-id="${id}">
        ${icon('sliders', 14)} Adjust points
      </button>
      <button class="menu__item" role="menuitem" data-tone="gold" data-action="captain:set" data-id="${id}"
        ${contestant.isCaptain ? 'disabled' : ''}>
        ${icon('crown', 14)} ${contestant.isCaptain ? 'Already House Captain' : 'Make House Captain'}
      </button>
      <button class="menu__item" role="menuitem" data-tone="emerald" data-action="${
        contestant.immunity ? 'immunity:revoke' : 'immunity:grant'
      }" data-id="${id}">
        ${icon('shield', 14)} ${contestant.immunity ? 'Revoke immunity' : 'Grant immunity'}
      </button>
      <button class="menu__item" role="menuitem" data-action="nomination:add" data-id="${id}"
        ${contestant.immunity || contestant.isCaptain || contestant.nomination ? 'disabled' : ''}>
        ${icon('alert', 14)} ${
          contestant.nomination
            ? 'Already in the Danger Zone'
            : contestant.immunity
              ? 'Immune — cannot be nominated'
              : 'Nominate for eviction'
        }
      </button>
      <div class="menu__sep"></div>
      <button class="menu__item" role="menuitem" data-action="contestant:edit" data-id="${id}">
        ${icon('edit', 14)} Edit record
      </button>
      <button class="menu__item" role="menuitem" data-tone="danger" data-action="eviction:open" data-id="${id}">
        ${icon('door', 14)} Evict from the House
      </button>
    </div>
  `;
}
