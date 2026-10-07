import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { StatCard } from '../components/StatCard.js';
import { DangerZoneList } from '../components/DangerZone.js';
import { Avatar } from '../components/Avatar.js';
import { EmptyState } from '../components/EmptyState.js';
import { contestantPicker } from '../components/ModalForms.js';
import * as selectors from '../store/selectors.js';

export function NominationsView(state) {
  const stats = selectors.houseStats(state);
  const nominees = selectors.dangerZone(state);
  const immune = selectors.immuneContestants(state);
  const eligible = selectors.eligibleForNomination(state);

  return `
    <div class="view-head">
      <div class="view-head__meta">
        <h2>Nominations &amp; Danger Zone</h2>
        <p>Round ${stats.round} · ${nominees.length} nominated · ${immune.length} immune · ${eligible.length} eligible</p>
      </div>
      <span class="spacer"></span>
      <div class="view-head__actions">
        <button class="btn btn--sm btn--ghost" data-action="nomination:nextRound">${icon('refresh', 14)} Next round</button>
        <button class="btn btn--sm btn--ghost" data-action="nomination:clear" ${nominees.length ? '' : 'disabled'}>
          ${icon('x', 14)} Clear nominations
        </button>
        <button class="btn btn--danger btn--sm" data-action="nomination:open" ${eligible.length ? '' : 'disabled'}>
          ${icon('alert', 14)} Nominate
        </button>
      </div>
    </div>

    <div class="grid-stats stagger" style="margin-bottom:var(--s-4)">
      ${[
        { label: 'Nomination Round', value: stats.round, meta: 'Current cycle', icon: 'shield', tone: 'cyan', key: 'nom:round' },
        { label: 'Nominated', value: stats.nomineeCount, meta: nominees.length ? 'Facing eviction' : 'Danger Zone empty', icon: 'alert', tone: 'crimson', key: 'nom:count' },
        { label: 'Immune', value: stats.immuneCount, meta: 'Protected this round', icon: 'shield', tone: 'emerald', key: 'nom:immune' },
        { label: 'Eligible', value: eligible.length, meta: 'Can be nominated', icon: 'users', tone: 'violet', key: 'nom:eligible' },
      ]
        .map((card, index) => StatCard({ ...card, countKey: card.key, index }))
        .join('')}
    </div>

    ${
      nominees.length
        ? `<div class="hint-banner" style="border-style:solid;border-color:rgba(239,68,68,.42);background:linear-gradient(90deg,rgba(239,68,68,.14),transparent 70%)">
             <span class="chip chip--live chip--danger">${icon('alert', 12)} Danger Zone</span>
             <span style="flex:1">${nominees.map((c) => esc(c.name)).join(' · ')} — the House will vote for eviction.</span>
             <button class="btn btn--sm btn--danger" data-action="eviction:round">${icon('door', 13)} Run eviction vote</button>
           </div>`
        : ''
    }

    <div class="grid-split">
      <div class="stack-16">
        <section class="card glass ${nominees.length ? 'card--alarm' : ''}" data-tone="crimson">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('alert', 15)}</span><h3>Danger Zone</h3></div>
            <span class="card__meta">Round ${stats.round}</span>
            <span class="spacer"></span>
            ${
              nominees.length
                ? `<button class="btn btn--sm btn--danger" data-action="eviction:round">${icon('door', 13)} Evict the round</button>`
                : ''
            }
          </header>
          <div class="card__body card__body--flush">
            ${DangerZoneList(nominees)}
          </div>
        </section>

        <section class="card glass">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('shield', 15)}</span><h3>Immune Contestants</h3></div>
            <span class="spacer"></span>
            <span class="badge badge--immune">${immune.length} protected</span>
          </header>
          <div class="card__body card__body--flush">
            ${
              immune.length
                ? `<ul class="danger-list">${immune
                    .map(
                      (contestant) => `
                    <li class="danger-item" style="background:linear-gradient(90deg,rgba(16,185,129,.08),transparent 55%)">
                      <span class="danger-item__index" style="background:var(--emerald-soft);border-color:rgba(16,185,129,.4);color:#6ee7b7">
                        ${icon('shield', 12)}
                      </span>
                      ${Avatar(contestant, 'sm')}
                      <div class="danger-item__id">
                        <div class="danger-item__name">${esc(contestant.name)}</div>
                        <div class="danger-item__meta">Team ${esc(contestant.team)} · nomination blocked by Big Boss</div>
                      </div>
                      <button class="btn btn--sm" data-action="immunity:revoke" data-id="${esc(contestant.id)}">Revoke</button>
                      <button class="btn btn--sm btn--ghost" data-action="nomination:blocked" data-id="${esc(contestant.id)}"
                        title="Try to nominate — the House will refuse">${icon('lock', 13)} Nominate</button>
                    </li>`,
                    )
                    .join('')}</ul>`
                : EmptyState({
                    icon: 'shield',
                    title: 'No immunity held',
                    text: 'Grant immunity to protect a contestant from nomination.',
                    action: `<button class="btn btn--sm btn--success" data-action="immunity:open">${icon('shield', 13)} Grant immunity</button>`,
                    compact: true,
                  })
            }
          </div>
        </section>
      </div>

      <div class="stack-16">
        <section class="card glass">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('target', 15)}</span><h3>Nominate Contestants</h3></div>
            <span class="card__meta">${eligible.length} eligible</span>
          </header>
          <div class="card__body stack-16">
            <p class="fs-sm muted">
              Immune contestants, the House Captain and anyone already in the Danger Zone are excluded — Big Boss
              protects them automatically.
            </p>
            ${contestantPicker(eligible, { id: 'inlineNominationPicker' })}
            <label class="field">
              <span class="field__label">Reason (optional)</span>
              <input class="input" id="inlineNominationReason" placeholder="Failed the task" />
            </label>
            <button class="btn btn--danger btn--block" data-action="nomination:selected" ${eligible.length ? '' : 'disabled'}>
              ${icon('alert', 15)} Nominate selected
            </button>
          </div>
        </section>

        <section class="card glass">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('crown', 15)}</span><h3>Captaincy</h3></div>
          </header>
          <div class="card__body">
            ${
              stats.captain
                ? `<div class="row-12">
                     ${Avatar(stats.captain, 'md')}
                     <div style="flex:1;min-width:0">
                       <div class="eyebrow">House Captain</div>
                       <div class="fw-600">${esc(stats.captain.name)}</div>
                     </div>
                     <button class="btn btn--sm" data-action="captain:open">Change</button>
                     <button class="btn btn--sm btn--ghost" data-action="captain:revoke">Revoke</button>
                   </div>
                   <p class="fs-xs muted" style="margin-top:var(--s-3)">
                     ${icon('info', 12)} The Captain is protected from nomination while in office.
                   </p>`
                : EmptyState({
                    icon: 'crown',
                    title: 'No Captain appointed',
                    text: 'The House needs a leader. Appoint a Captain to protect them from nomination.',
                    action: `<button class="btn btn--primary btn--sm" data-action="captain:open">${icon('crown', 13)} Appoint Captain</button>`,
                    compact: true,
                  })
            }
          </div>
        </section>
      </div>
    </div>
  `;
}

export const NominationsMeta = { title: 'Nominations', subtitle: 'Immunity, nominations and evictions' };
