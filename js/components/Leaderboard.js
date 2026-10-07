import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Avatar } from './Avatar.js';
import { Badge } from './Badge.js';
import { EmptyState } from './EmptyState.js';

const MEDALS = { 1: 'medal--1', 2: 'medal--2', 3: 'medal--3' };

/** One leaderboard row. `data-flip` lets the motion layer animate rank changes. */
export function LeaderboardRow(contestant, rank, maxPoints, index = 0) {
  const percent = maxPoints ? Math.max(4, Math.round((contestant.points / maxPoints) * 100)) : 4;
  const medal = MEDALS[rank];
  return `
    <div class="lb-row ${contestant.points < 0 ? 'lb-row--demoted' : ''}"
         data-flip="${esc(contestant.id)}" data-id="${esc(contestant.id)}" style="--i:${index}">
      <div class="lb-row__rank">
        <span class="medal ${medal || ''}" aria-label="Rank ${rank}">${rank}</span>
      </div>

      <div class="lb-row__person">
        ${Avatar(contestant, 'md')}
        <div class="lb-row__id">
          <div class="lb-row__name">
            <span class="nowrap">${esc(contestant.name)}</span>
            ${contestant.isCaptain ? Badge('Capt', 'captain', 'crown') : ''}
            ${contestant.immunity ? Badge('Imm', 'immune', 'shield') : ''}
            ${contestant.nomination ? Badge('DZ', 'nominated', 'alert') : ''}
          </div>
          <div class="lb-row__sub">
            <span class="team-dot" data-team="${esc(contestant.team)}"></span>
            Team ${esc(contestant.team)} · ${contestant.tasksCompleted} task${contestant.tasksCompleted === 1 ? '' : 's'} done
          </div>
          <div class="lb-row__meter"><i style="width:${percent}%"></i></div>
        </div>
      </div>

      <div class="lb-row__score">
        <span data-count-to="${contestant.points}" data-count-key="score:${esc(contestant.id)}" data-count-pop="true">${contestant.points}</span>
        <small>pts</small>
      </div>

      <div class="lb-row__actions">
        <button class="btn btn--xs" data-action="points:quick" data-id="${esc(contestant.id)}" data-delta="10"
          aria-label="Award 10 points to ${esc(contestant.name)}">+10</button>
        <button class="btn btn--xs" data-action="points:quick" data-id="${esc(contestant.id)}" data-delta="-10"
          aria-label="Deduct 10 points from ${esc(contestant.name)}">−10</button>
        <button class="btn btn--icon btn--sm btn--ghost" data-action="points:open" data-id="${esc(contestant.id)}"
          aria-label="Adjust points for ${esc(contestant.name)}">${icon('sliders', 14)}</button>
      </div>
    </div>
  `;
}

/**
 * Leaderboard list.
 * @param {Array} contestants active contestants, already sorted
 * @param {{ maxPoints: number, limit?: number, scroll?: boolean }} options
 */
export function LeaderboardList(contestants, { maxPoints = 1, limit = 0, scroll = false } = {}) {
  const list = limit ? contestants.slice(0, limit) : contestants;
  if (!list.length) {
    return EmptyState({
      icon: 'trophy',
      title: 'No contestants on the board',
      text: 'Evicted contestants leave the leaderboard. Add or reinstate contestants to fill the House.',
    });
  }
  return `<div class="board ${scroll ? 'scroll-area' : ''} stagger">
    ${list.map((contestant, index) => LeaderboardRow(contestant, index + 1, maxPoints, index)).join('')}
  </div>`;
}

/** Top-3 podium cards used at the top of the Leaderboard view. */
export function Podium(board) {
  const tones = ['gold', 'cyan', 'violet'];
  const icons = ['crown', 'medal', 'medal'];
  return board
    .slice(0, 3)
    .map(
      (contestant, index) => `
      <article class="stat glass" data-tone="${tones[index]}" style="--i:${index}">
        <div class="stat__top">
          <span class="stat__icon">${icon(icons[index], 14)}</span>
          <span class="stat__label">Rank #${index + 1}</span>
        </div>
        <div class="row-12" style="margin-top:10px">
          ${Avatar(contestant, 'lg')}
          <div style="min-width:0">
            <div class="fw-600" style="font-size:var(--fs-md)">${esc(contestant.name)}</div>
            <div class="fs-xs muted">Team ${esc(contestant.team)} · ${contestant.tasksCompleted} task${
              contestant.tasksCompleted === 1 ? '' : 's'
            }</div>
          </div>
        </div>
        <div class="stat__value" data-count-to="${contestant.points}" data-count-key="podium:${
          contestant.id
        }" style="margin-top:10px">${contestant.points}</div>
        <div class="stat__meta">House points</div>
      </article>`,
    )
    .join('');
}
