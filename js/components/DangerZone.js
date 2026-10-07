import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Avatar, AvatarStack } from './Avatar.js';
import { EmptyState } from './EmptyState.js';

/** One nominee row inside the Danger Zone. */
export function DangerZoneItem(contestant, index, { compact = false } = {}) {
  return `
    <li class="danger-item" data-id="${esc(contestant.id)}" style="--i:${index}">
      <span class="danger-item__index">${index}</span>
      ${Avatar(contestant, 'sm')}
      <div class="danger-item__id">
        <div class="danger-item__name">${esc(contestant.name)}</div>
        <div class="danger-item__meta">
          Team ${esc(contestant.team)} · ${contestant.points} pts · Round ${contestant.nomination.round}
          ${contestant.nomination.reason ? ` · ${esc(contestant.nomination.reason)}` : ''}
        </div>
      </div>
      <button class="btn btn--sm" data-action="nomination:withdraw" data-id="${esc(contestant.id)}">
        ${icon('refresh', 13)}<span class="btn__label">Withdraw</span>
      </button>
      ${
        compact
          ? ''
          : `<button class="btn btn--sm btn--danger" data-action="eviction:open" data-id="${esc(contestant.id)}">
               ${icon('door', 13)}<span class="btn__label">Evict</span>
             </button>`
      }
    </li>
  `;
}

/**
 * Danger Zone list — red-tinted, pulsing card when somebody is at risk.
 * @param {Array} nominees contestants with a nomination, in round order
 * @param {{limit?: number, compact?: boolean, footer?: string}} options
 */
export function DangerZoneList(nominees, { limit = 0, compact = false, footer = '' } = {}) {
  if (!nominees.length) {
    return `
      <div class="empty empty--inline">
        <div class="empty__icon">${icon('shield', 22)}</div>
        <div class="empty__title">Danger Zone is empty</div>
        <p class="empty__text">Big Boss has not nominated anyone. Immunity is holding the House together.</p>
        <button class="btn btn--sm btn--danger" data-action="nomination:open">${icon('alert', 13)} Nominate</button>
      </div>
    `;
  }

  const list = limit ? nominees.slice(0, limit) : nominees;
  const hidden = nominees.length - list.length;

  return `
    <ul class="danger-list stagger">
      ${list.map((contestant, index) => DangerZoneItem(contestant, index + 1, { compact })).join('')}
    </ul>
    ${
      hidden > 0
        ? `<div class="card__foot"><span class="fs-xs muted">+${hidden} more at risk</span>
             <span class="spacer"></span>
             <button class="btn btn--sm btn--ghost" data-action="nav:go" data-view="nominations">Open Danger Zone</button>
           </div>`
        : ''
    }
    ${footer}
  `;
}

/** Condensed header strip: avatars of everyone at risk. */
export const DangerZoneStrip = (nominees) =>
  nominees.length
    ? `<div class="row-8">
         ${AvatarStack(nominees, 'sm', 6)}
         <span class="fs-xs text-danger">${nominees.length} nominee${nominees.length === 1 ? '' : 's'} at risk</span>
       </div>`
    : EmptyState({ icon: 'shield', title: 'Nobody at risk', text: 'No nominations this round.', compact: true });
