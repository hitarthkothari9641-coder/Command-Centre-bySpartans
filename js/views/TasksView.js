import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { StatCard } from '../components/StatCard.js';
import { TaskCard } from '../components/TaskPanel.js';
import { TimerRing } from '../components/TimerRing.js';
import { EmptyState } from '../components/EmptyState.js';
import { Avatar } from '../components/Avatar.js';
import * as selectors from '../store/selectors.js';

const FILTERS = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['active', 'In Progress'],
  ['completed', 'Completed'],
  ['failed', 'Failed'],
];

export function TasksView(state, filters) {
  const stats = selectors.houseStats(state);
  const timer = selectors.timerView(state);
  const contestantsById = new Map(state.contestants.map((c) => [c.id, c]));
  const canAssign = stats.activeCount > 0;

  const tasks =
    filters.taskStatus === 'all' ? state.tasks : state.tasks.filter((task) => task.status === filters.taskStatus);

  return `
    <div class="view-head">
      <div class="view-head__meta">
        <h2>Task Management</h2>
        <p>${stats.tasksOpen} open · ${stats.tasksCompleted} completed · ${stats.completionRate}% completion rate</p>
      </div>
      <span class="spacer"></span>
      <div class="view-head__actions">
        <button class="btn btn--sm btn--ghost" data-action="timer:custom">${icon('clock', 14)} Set timer</button>
        <button class="btn btn--primary btn--sm" data-action="task:open" ${canAssign ? '' : 'disabled'}>
          ${icon('plus', 14)} Assign task
        </button>
      </div>
    </div>

    <div class="grid-stats stagger" style="margin-bottom:var(--s-4)">
      ${[
        { label: 'Total Tasks', value: stats.tasksTotal, meta: `${stats.tasksOpen} still open`, icon: 'clipboard', tone: 'cyan', key: 'task:total' },
        { label: 'Completed', value: stats.tasksCompleted, meta: `${stats.completionRate}% completion rate`, icon: 'check', tone: 'emerald', key: 'task:done' },
        { label: 'In Progress', value: stats.tasksActive, meta: 'Running right now', icon: 'zap', tone: 'violet', key: 'task:active' },
        { label: 'Failed', value: stats.tasksFailed, meta: 'Missed or disqualified', icon: 'x', tone: 'crimson', key: 'task:failed' },
        { label: 'Points Awarded', value: stats.tasksCompleted ? state.tasks.filter((t) => t.status === 'completed').reduce((sum, t) => sum + t.points * t.assignees.length, 0) : 0, meta: 'Across all completed tasks', icon: 'zap', tone: 'gold', key: 'task:points' },
        { label: 'Timer', value: timer.running ? 'RUNNING' : timer.remaining === 0 ? 'TIME UP' : 'PAUSED', raw: true, meta: `${String(Math.floor(timer.remaining / 60)).padStart(2, '0')}:${String(timer.remaining % 60).padStart(2, '0')} on the clock`, icon: 'clock', tone: timer.running ? 'emerald' : 'cyan' },
      ]
        .map((card, index) =>
          StatCard({ ...card, countKey: card.key, index }),
        )
        .join('')}
    </div>

    <div class="grid-split">
      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('clipboard', 15)}</span><h3>Task Board</h3></div>
          <span class="spacer"></span>
          <div class="seg" id="taskStatusFilter" role="group" aria-label="Filter tasks">
            ${FILTERS.map(
              ([value, label]) =>
                `<button type="button" data-status="${value}" class="${filters.taskStatus === value ? 'is-on' : ''}">${label}</button>`,
            ).join('')}
          </div>
        </header>
        <div class="card__body stack-16">
          ${
            tasks.length
              ? tasks.map((task, index) => TaskCard(task, contestantsById, index)).join('')
              : EmptyState({
                  icon: 'clipboard',
                  title: 'No tasks here',
                  text: canAssign
                    ? 'Assign a task and the House gets to work.'
                    : 'Add contestants before assigning tasks.',
                  action: canAssign
                    ? `<button class="btn btn--primary btn--sm" data-action="task:open">${icon('plus', 13)} Assign task</button>`
                    : '',
                })
          }
        </div>
      </section>

      <div class="stack-16">
        <section class="card glass">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('clock', 15)}</span><h3>Task Timer</h3></div>
            <span class="spacer"></span>
            <span class="chip ${timer.running ? (timer.state === 'critical' ? 'chip--danger' : 'chip--warning') : 'chip--plain'}">
              ${icon(timer.running ? 'zap' : 'pause', 12)} ${timer.state.toUpperCase()}
            </span>
          </header>
          <div class="card__body">
            ${TimerRing(timer, { label: state.timer.label, size: 210, showPresets: true })}
            <div class="divider"></div>
            <label class="field">
              <span class="field__label">Timer label</span>
              <div class="input-group">
                <input class="input" id="timerLabelInput" value="${esc(state.timer.label)}" placeholder="Immunity Challenge" />
                <button class="btn btn--sm" data-action="timer:label">Save</button>
              </div>
            </label>
          </div>
        </section>

        <section class="card glass">
          <header class="card__head">
            <div class="card__title"><span class="card__icon">${icon('trophy', 15)}</span><h3>Leaderboard Impact</h3></div>
          </header>
          <div class="card__body card__body--flush">
            ${
              selectors.leaderboard(state).length
                ? `<ul class="feed">${selectors
                    .leaderboard(state)
                    .slice(0, 6)
                    .map(
                      (contestant, index) => `
                    <li class="feed__item">
                      <span class="feed__icon">${index + 1}</span>
                      ${Avatar(contestant, 'xs')}
                      <div class="feed__body">
                        <div class="feed__text"><strong>${esc(contestant.name)}</strong> · ${contestant.tasksCompleted} tasks done</div>
                      </div>
                      <span class="fw-700 tnum">${contestant.points}</span>
                    </li>`,
                    )
                    .join('')}</ul>`
                : EmptyState({ icon: 'trophy', title: 'No contestants', text: 'Add contestants to track productivity.', compact: true })
            }
          </div>
        </section>
      </div>
    </div>
  `;
}

export const TasksMeta = { title: 'Tasks', subtitle: 'Assign, run and complete House tasks' };
