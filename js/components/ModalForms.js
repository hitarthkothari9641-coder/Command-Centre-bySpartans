/** Modal bodies — pure markup builders used by the action layer. */
import { esc, formatClock } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Avatar } from './Avatar.js';
import { TeamBadge } from './Badge.js';

export const field = (label, control, hint = '') => `
  <label class="field">
    <span class="field__label">${esc(label)}</span>
    ${control}
    ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ''}
  </label>
`;

export const input = (id, { value = '', type = 'text', placeholder = '', min, max, step } = {}) =>
  `<input class="input" id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"
    ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''} ${step != null ? `step="${step}"` : ''} />`;

export const textarea = (id, { value = '', placeholder = '', rows = 3 } = {}) =>
  `<textarea class="textarea" id="${id}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;

export const select = (id, options, selected) => `
  <select class="select" id="${id}">
    ${options
      .map(
        (option) =>
          `<option value="${esc(option.value)}" ${String(option.value) === String(selected) ? 'selected' : ''}>${esc(
            option.label,
          )}</option>`,
      )
      .join('')}
  </select>
`;

/** Contestant picker with avatars; supports single or multi select. */
export function contestantPicker(contestants, { id = 'picker', type = 'checkbox', preselect = [], name = 'pick' } = {}) {
  if (!contestants.length) return '<p class="fs-sm muted">No eligible contestants.</p>';
  return `<div class="checkbox-list" id="${id}">
    ${contestants
      .map(
        (contestant) => `
      <label class="checkbox-chip ${preselect.includes(contestant.id) ? 'is-on' : ''}">
        <input type="${type}" name="${name}" value="${esc(contestant.id)}"
          ${preselect.includes(contestant.id) ? 'checked' : ''} />
        ${Avatar(contestant, 'xs')}
        <span>${esc(contestant.name)}</span>
        <span class="fs-xs muted">${contestant.points}</span>
      </label>`,
      )
      .join('')}
  </div>`;
}

export const PointsForm = (contestant) => `
  <div class="row-12">
    ${Avatar(contestant, 'md')}
    <div>
      <div class="fw-600">${esc(contestant.name)}</div>
      <div class="fs-xs muted">${esc(contestant.team)} · currently ${contestant.points} pts</div>
    </div>
  </div>
  <div class="row-8" style="flex-wrap:wrap">
    ${[-50, -25, -10, 10, 25, 50]
      .map((delta) => `<button class="btn btn--sm" data-quick-delta="${delta}">${delta > 0 ? '+' : ''}${delta}</button>`)
      .join('')}
  </div>
  ${field('Points to apply', input('pointsDelta', { type: 'number', value: '10', step: 5 }), 'Use a negative number to deduct points.')}
  ${field('Reason (optional)', input('pointsReason', { placeholder: 'Won the coding sprint' }))}
`;

export const ContestantForm = (contestant, teams) => `
  ${field('Full name', input('contestantName', { value: contestant?.name || '', placeholder: 'Riya Sharma' }))}
  ${field(
    'Team',
    select(
      'contestantTeam',
      teams.map((team) => ({ value: team, label: `Team ${team}` })),
      contestant?.team || teams[0],
    ),
  )}
  ${field('House points', input('contestantPoints', { type: 'number', value: String(contestant?.points ?? 0), min: 0, step: 5 }))}
  ${field('Big Boss notes', textarea('contestantNotes', { value: contestant?.notes || '', placeholder: 'Alliances, warnings, habits…' }))}
`;

export const TaskForm = (contestants) => `
  <div class="row-8" style="flex-wrap:wrap">
    ${[
      ['Coding Sprint', 50, 'Ship a working feature before the timer ends.'],
      ['Debug Hunt', 40, 'Find and explain three bugs in the codebase.'],
      ['Design Duel', 30, 'Produce a minimalist UI for the brief.'],
      ['Pitch Battle', 35, 'Present a product idea in three minutes.'],
    ]
      .map(
        ([title, points]) =>
          `<button class="btn btn--sm" data-task-preset="${esc(title)}" data-task-points="${points}">${esc(title)}</button>`,
      )
      .join('')}
  </div>
  ${field('Task title', input('taskTitle', { placeholder: 'Build the leaderboard UI' }))}
  ${field('Description', textarea('taskDescription', { placeholder: 'What must the contestants deliver?' }))}
  ${field('Points on completion', input('taskPoints', { type: 'number', value: '25', min: 0, step: 5 }), 'Every assignee earns these points.')}
  ${field('Assign to', contestantPicker(contestants, { id: 'taskAssignees' }))}
  <div class="row-8">
    <button class="btn btn--xs btn--ghost" data-select="all">Select all</button>
    <button class="btn btn--xs btn--ghost" data-select="none">Clear selection</button>
  </div>
`;

export const TimerCustomForm = (timer) => `
  ${field('Timer label', input('timerCustomLabel', { value: timer.label, placeholder: 'Immunity Challenge' }))}
  <div class="grid-2" style="gap:var(--s-3)">
    ${field('Minutes', input('timerMinutes', { type: 'number', value: '10', min: 0, max: 180 }))}
    ${field('Seconds', input('timerSeconds', { type: 'number', value: '0', min: 0, max: 59 }))}
  </div>
  <div class="row-8" style="flex-wrap:wrap">
    ${[60, 300, 600]
      .map((seconds) => `<button class="btn btn--xs" data-timer-quick="${seconds}">${formatClock(seconds)}</button>`)
      .join('')}
  </div>
`;

export const NominationForm = (eligible, presetId = '') => `
  ${
    eligible.length
      ? contestantPicker(eligible, { id: 'nominationPicker', preselect: presetId ? [presetId] : [] })
      : '<p class="fs-sm muted">Every active contestant is either immune, the Captain, or already nominated.</p>'
  }
  ${field('Reason (optional)', input('nominationReason', { placeholder: 'Failed the task' }))}
  <div class="modal__warn">
    ${icon('shield', 15)}
    <span>Immune contestants and the House Captain are protected and never appear in this list.</span>
  </div>
`;

export const ImmunityForm = (eligible, presetId = '') => `
  ${contestantPicker(eligible, { id: 'immunityPicker', preselect: presetId ? [presetId] : [] })}
  ${field('Reason (optional)', input('immunityReason', { placeholder: 'Won the immunity challenge' }))}
`;

export const EvictionForm = (contestant, rank) => `
  <div class="row-12">
    ${Avatar(contestant, 'lg')}
    <div>
      <div class="fw-600">${esc(contestant.name)}</div>
      <div class="fs-xs muted">
        Team ${esc(contestant.team)} · ${contestant.points} pts · ${rank ? `rank #${rank}` : 'unranked'} · ${
          contestant.tasksCompleted
        } tasks
      </div>
    </div>
    ${TeamBadge(contestant.team)}
  </div>
  ${
    contestant.immunity
      ? `<div class="modal__warn" data-tone="danger">
           ${icon('shield', 15)}
           <span><strong>Immunity override.</strong> ${esc(
             contestant.name,
           )} holds immunity. Only Big Boss can overrule the House — the override is recorded in the log.</span>
         </div>`
      : ''
  }
  ${field('Eviction line', input('evictionReason', { value: contestant.nomination ? 'Evicted by House vote' : 'Evicted by Big Boss' }))}
`;

export const AnnouncementForm = (draft = '', tone = 'accent') => `
  ${field('Message', textarea('announcementMessage', { value: draft, rows: 4, placeholder: 'Contestants, assemble in the living area immediately.' }))}
  ${field(
    'Tone',
    select(
      'announcementTone',
      [
        { value: 'accent', label: 'Highlight (gold)' },
        { value: 'info', label: 'Information (cyan)' },
        { value: 'alert', label: 'Warning (crimson)' },
        { value: 'success', label: 'Good news (emerald)' },
      ],
      tone,
    ),
  )}
  <div class="row-8" style="flex-wrap:wrap">
    ${[
      ['Task window open', 'The task window is now open. The clock is ticking.', 'accent'],
      ['Big Boss is watching', 'Big Boss is watching. Keep the House clean.', 'info'],
      ['Eviction warning', 'Danger Zone nominations are final. Prepare for eviction.', 'alert'],
      ['Immunity granted', 'Congratulations — immunity has been granted. The House cannot touch you.', 'success'],
    ]
      .map(
        ([label, preset, presetTone]) =>
          `<button class="btn btn--xs" data-announce-preset="${esc(preset)}" data-announce-tone="${presetTone}"
             title="${esc(preset)}">${esc(label)}</button>`,
      )
      .join('')}
  </div>
`;

export const DangerWarning = (text, tone = 'warning') => `
  <div class="modal__warn" ${tone === 'danger' ? 'data-tone="danger"' : ''}>
    ${icon(tone === 'danger' ? 'alert' : 'info', 15)}<span>${esc(text)}</span>
  </div>
`;

export const ShortcutsBody = () => `
  <div class="stack-8">
    ${[
      ['1 – 9', 'Jump between the nine sections'],
      ['B', 'Collapse or expand the sidebar'],
      ['N', 'Compose a Big Boss announcement'],
      ['T', 'Start or pause the task timer'],
      ['Esc', 'Close overlays and menus'],
      ['Enter', 'Confirm the focused modal'],
    ]
      .map(
        ([keys, description]) => `
        <div class="row-12">
          <span class="kbd">${esc(keys)}</span>
          <span class="fs-sm dim">${esc(description)}</span>
        </div>`,
      )
      .join('')}
  </div>
`;
