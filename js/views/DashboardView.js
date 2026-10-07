import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { StatCard } from '../components/StatCard.js';
import { LeaderboardList } from '../components/Leaderboard.js';
import { TimerRing } from '../components/TimerRing.js';
import { ActiveTaskCard } from '../components/TaskPanel.js';
import { DangerZoneList } from '../components/DangerZone.js';
import { ActivityFeed, ActivityFooter } from '../components/ActivityFeed.js';
import { AnnouncementHero } from '../components/AnnouncementList.js';
import { MvpStrip, TeamStandings } from '../components/HouseStats.js';
import { BrandHero } from '../components/BrandHero.js';
import { EmptyState } from '../components/EmptyState.js';
import * as selectors from '../store/selectors.js';

const cardHead = (title, iconName, meta = '', actions = '', tone = '') => `
  <header class="card__head">
    <div class="card__title"><span class="card__icon">${icon(iconName, 15)}</span><h3>${esc(title)}</h3></div>
    ${meta ? `<span class="card__meta">${esc(meta)}</span>` : ''}
    <span class="spacer"></span>
    ${actions}
  </header>
`;

export function DashboardView(state) {
  const stats = selectors.houseStats(state);
  const board = selectors.leaderboard(state);
  const timer = selectors.timerView(state);
  const nominees = selectors.dangerZone(state);
  const maxPoints = selectors.maxPoints(state);
  const activeTask = state.tasks.find((t) => t.status === 'active') || state.tasks.find((t) => t.status === 'pending');
  const contestantsById = new Map(state.contestants.map((c) => [c.id, c]));
  const latest = state.announcements[0];

  const statsRow = [
    {
      label: 'Total Active',
      value: stats.activeCount,
      meta: `${stats.total} total · ${stats.evictedCount} evicted`,
      icon: 'users',
      tone: 'cyan',
      countKey: 'stat:active',
    },
    {
      label: 'Highest Scorer',
      value: stats.highestScorer ? stats.highestScorer.points : 0,
      meta: stats.highestScorer ? stats.highestScorer.name : 'No scores yet',
      icon: 'crown',
      tone: 'gold',
      countKey: `stat:mvp:${stats.highestScorer?.id || 'none'}`,
    },
    {
      label: 'Current Captain',
      value: stats.captain ? stats.captain.name : 'Vacant',
      raw: true,
      meta: stats.captain ? `Team ${stats.captain.team} · ${stats.captain.points} pts` : 'No Captain appointed',
      icon: 'star',
      tone: 'violet',
    },
    {
      label: 'Tasks Completed',
      value: stats.tasksCompleted,
      meta: `${stats.tasksCompleted} of ${stats.tasksTotal} · ${stats.completionRate}% done`,
      icon: 'check',
      tone: 'emerald',
      countKey: 'stat:tasks',
    },
    {
      label: 'Nominees',
      value: stats.nomineeCount,
      meta: stats.nomineeCount ? `Round ${stats.round} · Danger Zone` : 'Nobody at risk',
      icon: 'target',
      tone: 'crimson',
      countKey: 'stat:nominees',
    },
    {
      label: 'Evicted',
      value: stats.evictedCount,
      meta: `${stats.immuneCount} immune · ${stats.totalPoints} house pts`,
      icon: 'door',
      tone: 'violet',
      countKey: 'stat:evicted',
    },
  ];

  return `
    ${BrandHero({
      houseName: state.house.name,
      season: state.house.season,
      day: state.house.day,
      activeCount: stats.activeCount,
      nominees: stats.nomineeCount,
      running: timer.running,
    })}

    ${
      !state.ui.onboarded
        ? `<div class="hint-banner">
             <span class="chip chip--live">${icon('help-circle', 12)} First time here</span>
             <span style="flex:1">Big Boss is watching. Use <strong>Make Announcement</strong> to broadcast, grant immunity to protect a contestant, and the Danger Zone to nominate.</span>
             <button class="btn btn--sm btn--ghost" data-action="ui:onboarded">Got it</button>
           </div>`
        : ''
    }

    <div class="grid-stats stagger" style="margin-bottom:var(--s-4)">
      ${statsRow
        .map((card, index) =>
          StatCard({
            label: card.label,
            value: card.value,
            meta: card.meta,
            icon: card.icon,
            tone: card.tone,
            countKey: card.countKey,
            raw: card.raw,
            index,
          }),
        )
        .join('')}
    </div>

    <div class="bento">
      <!-- Left column: leaderboard + activity -->
      <div class="bento__col">
        <section class="card glass">
          ${cardHead(
            'Live Leaderboard',
            'trophy',
            `Top ${Math.min(6, board.length)} of ${stats.activeCount}`,
            `<button class="btn btn--sm btn--ghost" data-action="nav:go" data-view="leaderboard">
               Full board ${icon('arrow-right', 13)}
             </button>`,
          )}
          <div class="card__body card__body--flush">
            ${LeaderboardList(board, { maxPoints, limit: 6 })}
          </div>
        </section>

        <section class="card glass">
          ${cardHead(
            'House Activity',
            'activity',
            'Live event log',
            `<span class="chip chip--live"><i class="live-dot"></i> Live</span>
             <button class="btn btn--sm btn--ghost" data-action="nav:go" data-view="activity">Open log</button>`,
          )}
          <div class="card__body card__body--flush">
            ${ActivityFeed(state.log, { limit: 7, live: state.ui.feedFollow !== false && !state.ui.feedPaused })}
          </div>
          ${ActivityFooter(state.log.length)}
        </section>

        <section class="card glass">
          ${cardHead('Team Standings', 'layers', 'Points by team')}
          <div class="card__body">${TeamStandings(stats)}</div>
        </section>
      </div>

      <!-- Right column: timer, active task, danger zone, announcement -->
      <div class="bento__col">
        <section class="card glass">
          ${cardHead(
            timer.running ? 'Task Timer · Running' : 'Task Timer',
            'clock',
            state.timer.label,
            timer.running
              ? `<span class="chip chip--warning">${icon('zap', 12)} In progress</span>`
              : `<span class="chip chip--plain">${icon('pause', 12)} Idle</span>`,
          )}
          <div class="card__body">
            ${TimerRing(timer, { label: state.timer.label, size: 190 })}
          </div>
          <div class="card__foot">
            <button class="btn btn--sm btn--ghost" data-action="nav:go" data-view="tasks">
              ${icon('settings', 13)} Timer controls
            </button>
            <span class="spacer"></span>
            <span class="fs-xs muted">Duration ${Math.round(state.timer.duration / 60)} min</span>
          </div>
        </section>

        <section class="card glass">
          ${cardHead('Active Task', 'clipboard', activeTask ? `${stats.tasksOpen} open` : 'All clear', '', 'violet')}
          <div class="card__body">
            ${ActiveTaskCard(activeTask, contestantsById)}
          </div>
        </section>

        <section class="card glass ${nominees.length ? 'card--alarm' : ''}" data-tone="crimson">
          ${cardHead(
            'Danger Zone',
            'alert',
            `Round ${stats.round}`,
            `<button class="btn btn--sm btn--danger" data-action="nomination:open">${icon('plus', 12)} Nominate</button>`,
            'crimson',
          )}
          <div class="card__body card__body--flush">
            ${DangerZoneList(nominees, { limit: 4 })}
          </div>
          ${
            nominees.length
              ? `<div class="card__foot">
                   <button class="btn btn--sm btn--danger" data-action="eviction:round">${icon('door', 13)} Run eviction vote</button>
                   <span class="spacer"></span>
                   <button class="btn btn--sm btn--ghost" data-action="nav:go" data-view="nominations">Manage</button>
                 </div>`
              : ''
          }
        </section>

        <section class="card glass">
          ${cardHead(
            'Big Boss',
            'megaphone',
            'Latest broadcast',
            `<button class="btn btn--sm btn--ghost" data-action="nav:go" data-view="announcements">Archive</button>`,
          )}
          <div class="card__body">
            ${latest ? AnnouncementHero(latest) : EmptyState({ icon: 'megaphone', title: 'No announcements yet', text: 'Broadcast a message to the House.', compact: true })}
          </div>
        </section>
      </div>
    </div>

    <section class="card glass" style="margin-top:var(--s-4)">
      ${cardHead('House Statistics', 'gauge', 'Season ' + state.house.season + ' · Day ' + state.house.day)}
      <div class="card__body">
        <div class="grid-2">
          <div>
            ${MvpStrip(stats)}
            <div class="divider"></div>
            <div class="grid-2" style="gap:var(--s-3)">
              <div class="kv-row"><span class="kv-row__k">House points</span><span class="kv-row__v">${stats.totalPoints}</span></div>
              <div class="kv-row"><span class="kv-row__k">Average score</span><span class="kv-row__v">${stats.averagePoints}</span></div>
              <div class="kv-row"><span class="kv-row__k">Tasks open</span><span class="kv-row__v">${stats.tasksOpen}</span></div>
              <div class="kv-row"><span class="kv-row__k">Immunity held</span><span class="kv-row__v text-success">${stats.immuneCount}</span></div>
            </div>
          </div>
          <div>
            <div class="eyebrow" style="margin-bottom:var(--s-2)">Season snapshot</div>
            ${AnnouncementListSafe(state)}
          </div>
        </div>
      </div>
    </section>
  `;
}

/** Small helper: last three broadcasts, kept inline to avoid an extra import cycle. */
function AnnouncementListSafe(state) {
  const items = state.announcements.slice(0, 3);
  if (!items.length) return '<p class="fs-sm muted">No broadcasts recorded yet.</p>';
  return `<ul class="ann-list" style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden">
    ${items
      .map(
        (announcement) => `
      <li class="ann-item" data-tone="${esc(announcement.tone)}">
        <span class="ann-item__icon">${icon('megaphone', 14)}</span>
        <div class="ann-item__body">
          <div class="ann-item__msg">${esc(announcement.message)}</div>
          <div class="ann-item__meta">${esc(announcement.tone.toUpperCase())} · ${new Date(
            announcement.createdAt,
          ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
        </div>
      </li>`,
      )
      .join('')}
  </ul>`;
}

export const DashboardMeta = { title: 'Command Center', subtitle: 'Live House overview' };
