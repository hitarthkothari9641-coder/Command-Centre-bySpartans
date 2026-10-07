import { esc, timeAgo } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { StatCard } from '../components/StatCard.js';
import { DangerZoneList } from '../components/DangerZone.js';
import { Avatar } from '../components/Avatar.js';
import { EmptyState } from '../components/EmptyState.js';
import { ActivityFeed } from '../components/ActivityFeed.js';
import * as selectors from '../store/selectors.js';

export function EvictionsView(state) {
  const stats = selectors.houseStats(state);
  const nominees = selectors.dangerZone(state);
  const evicted = selectors.evictedContestants(state);
  const evictionLog = state.log.filter((entry) => entry.type === 'eviction');

  return `
    <div class="view-head">
      <div class="view-head__meta">
        <h2>Evictions</h2>
        <p>${evicted.length} contestant${evicted.length === 1 ? '' : 's'} removed · ${stats.activeCount} still in the House</p>
      </div>
      <span class="spacer"></span>
      <div class="view-head__actions">
        <button class="btn btn--danger btn--sm" data-action="eviction:round" ${nominees.length ? '' : 'disabled'}>
          ${icon('door', 14)} Evict the Danger Zone
        </button>
      </div>
    </div>

    <div class="grid-stats stagger" style="margin-bottom:var(--s-4)">
      ${[
        { label: 'Evicted', value: stats.evictedCount, meta: 'Removed from the House', icon: 'door', tone: 'crimson', key: 'ev:count' },
        { label: 'Still Active', value: stats.activeCount, meta: 'Remaining contestants', icon: 'users', tone: 'emerald', key: 'ev:active' },
        { label: 'At Risk', value: stats.nomineeCount, meta: 'In the Danger Zone', icon: 'alert', tone: 'crimson', key: 'ev:risk' },
        { label: 'Nomination Round', value: stats.round, meta: 'Current cycle', icon: 'shield', tone: 'cyan', key: 'ev:round' },
      ]
        .map((card, index) => StatCard({ ...card, countKey: card.key, index }))
        .join('')}
    </div>

    <div class="grid-split">
      <div class="stack-16">
        <section class="card glass ${nominees.length ? 'card--alarm' : ''}" data-tone="crimson">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('door', 15)}</span><h3>Eviction Console</h3></div>
            <span class="card__meta">Danger Zone nominees</span>
          </header>
          <div class="card__body card__body--flush">
            ${
              nominees.length
                ? DangerZoneList(nominees)
                : EmptyState({
                    icon: 'shield',
                    title: 'Nobody is up for eviction',
                    text: 'Nominate contestants first — the Danger Zone is empty.',
                    action: `<button class="btn btn--sm btn--danger" data-action="nomination:open">${icon('alert', 13)} Nominate</button>`,
                    compact: true,
                  })
            }
          </div>
        </section>

        <section class="card glass">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('users', 15)}</span><h3>Evicted Contestants</h3></div>
            <span class="card__meta">${evicted.length} gone</span>
          </header>
          <div class="card__body card__body--flush">
            ${
              evicted.length
                ? `<ul class="danger-list">${evicted
                    .map(
                      (contestant) => `
                    <li class="danger-item" style="background:none" data-id="${esc(contestant.id)}">
                      ${Avatar(contestant, 'md')}
                      <div class="danger-item__id">
                        <div class="danger-item__name">
                          ${esc(contestant.name)} <span class="badge badge--evicted">Evicted</span>
                        </div>
                        <div class="danger-item__meta">
                          Team ${esc(contestant.team)} · final score ${contestant.points} pts ·
                          ${esc(contestant.evictionReason || 'Evicted')} · left ${esc(timeAgo(contestant.evictedAt))}
                        </div>
                      </div>
                      <button class="btn btn--sm btn--success" data-action="eviction:reinstate" data-id="${esc(contestant.id)}">
                        ${icon('log-in', 13)} Reinstate
                      </button>
                      <button class="btn btn--icon btn--sm btn--ghost" data-action="eviction:purge" data-id="${esc(contestant.id)}"
                        aria-label="Delete ${esc(contestant.name)} permanently">${icon('trash', 14)}</button>
                    </li>`,
                    )
                    .join('')}</ul>`
                : EmptyState({ icon: 'door', title: 'No evictions yet', text: 'The House is still at full strength.', compact: true })
            }
          </div>
        </section>
      </div>

      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('activity', 15)}</span><h3>Eviction Record</h3></div>
          <span class="card__meta">${evictionLog.length} event${evictionLog.length === 1 ? '' : 's'}</span>
        </header>
        <div class="card__body card__body--flush">
          ${ActivityFeed(evictionLog, { limit: 14, scroll: true, emptyText: 'Eviction events will be recorded here.' })}
        </div>
      </section>
    </div>
  `;
}

export const EvictionsMeta = { title: 'Evictions', subtitle: 'Contestants removed from the House' };
