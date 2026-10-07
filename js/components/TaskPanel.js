import { esc, timeAgo } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Avatar } from './Avatar.js';
import { TaskStatusBadge } from './Badge.js';

/** One task with assignees, points and lifecycle controls. */
export function TaskCard(task, contestantsById, index = 0) {
  const assignees = task.assignees.map((id) => contestantsById.get(id)).filter(Boolean);
  const done = task.status === 'completed';

  const lifecycle = done
    ? `<button class="btn btn--sm" data-action="task:reopen" data-id="${esc(task.id)}">
         ${icon('refresh', 13)}<span class="btn__label">Reopen</span>
       </button>`
    : `<button class="btn btn--sm btn--success" data-action="task:complete" data-id="${esc(task.id)}">
         ${icon('check', 13)}<span class="btn__label">Mark complete (+${task.points})</span>
       </button>`;

  const startControl =
    task.status === 'pending'
      ? `<button class="btn btn--sm btn--warning" data-action="task:start" data-id="${esc(task.id)}">
           ${icon('play', 12)}<span class="btn__label">Start</span>
         </button>`
      : task.status === 'active'
        ? `<button class="btn btn--sm btn--ghost" data-action="task:pending" data-id="${esc(task.id)}">
             ${icon('pause', 12)}<span class="btn__label">Pause</span>
           </button>`
        : '';

  const failControl =
    task.status === 'pending' || task.status === 'active'
      ? `<button class="btn btn--sm btn--danger" data-action="task:fail" data-id="${esc(task.id)}">
           ${icon('x', 12)}<span class="btn__label">Failed</span>
         </button>`
      : '';

  return `
    <article class="task-card glass" data-status="${esc(task.status)}" data-id="${esc(task.id)}" style="--i:${index}">
      <div class="task-card__head">
        <div style="flex:1;min-width:0">
          <div class="task-card__title ${done ? 'is-done' : ''}">${esc(task.title)}</div>
          ${task.description ? `<p class="task-card__desc">${esc(task.description)}</p>` : ''}
        </div>
        ${TaskStatusBadge(task.status)}
        <span class="badge badge--points">${icon('zap', 11)} +${task.points} pts</span>
      </div>

      <div class="row-8" style="flex-wrap:wrap">
        ${
          assignees.length
            ? assignees
                .map(
                  (c) => `<span class="chip chip--plain" data-team="${esc(c.team)}">
                    <span class="team-dot"></span>${esc(c.name)}
                  </span>`,
                )
                .join('')
            : '<span class="fs-xs muted">No assignees</span>'
        }
      </div>

      <div class="task-card__meta">
        <span>${icon('clock', 12)} created ${timeAgo(task.createdAt)}</span>
        ${task.completedAt ? `<span>${icon('check', 12)} completed ${timeAgo(task.completedAt)}</span>` : ''}
        <span>${icon('users', 12)} ${assignees.length} assignee${assignees.length === 1 ? '' : 's'}</span>
      </div>

      <div class="task-card__actions">
        ${startControl}
        ${lifecycle}
        ${failControl}
        <span class="spacer"></span>
        <button class="btn btn--icon btn--sm btn--ghost" data-action="task:delete" data-id="${esc(task.id)}"
          aria-label="Delete task">${icon('trash', 14)}</button>
      </div>
    </article>
  `;
}

/** Compact "Active Task" panel for the dashboard. */
export function ActiveTaskCard(task, contestantsById) {
  if (!task) {
    return `<div class="empty empty--inline">
      <div class="empty__icon">${icon('clipboard', 22)}</div>
      <div class="empty__title">No task running</div>
      <p class="empty__text">Assign a task and the House goes to work.</p>
      <button class="btn btn--primary btn--sm" data-action="task:open">${icon('plus', 13)} Assign task</button>
    </div>`;
  }

  const assignees = task.assignees.map((id) => contestantsById.get(id)).filter(Boolean);
  return `
    <div class="stack-16">
      <div class="row-12">
        <span class="pill-icon">${icon('clipboard', 14)}</span>
        <div style="flex:1;min-width:0">
          <div class="fw-600">${esc(task.title)}</div>
          <div class="fs-xs muted">${assignees.map((c) => esc(c.name)).join(', ') || 'Unassigned'}</div>
        </div>
        ${TaskStatusBadge(task.status)}
      </div>
      ${task.description ? `<p class="fs-sm dim">${esc(task.description)}</p>` : ''}
      <div class="row-8">
        <span class="badge badge--points">${icon('zap', 11)} +${task.points} pts each</span>
        <span class="fs-xs muted">${icon('clock', 12)} started ${timeAgo(task.createdAt)}</span>
      </div>
      <div class="row-8">
        ${
          task.status === 'completed'
            ? `<button class="btn btn--sm" data-action="task:reopen" data-id="${esc(task.id)}">Reopen</button>`
            : `<button class="btn btn--primary btn--sm btn--block-mobile" data-action="task:complete" data-id="${esc(
                task.id,
              )}">${icon('check', 13)} Mark complete</button>`
        }
        <button class="btn btn--sm btn--ghost" data-action="nav:go" data-view="tasks">All tasks</button>
      </div>
    </div>
  `;
}
