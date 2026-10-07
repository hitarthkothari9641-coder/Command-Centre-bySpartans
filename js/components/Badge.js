import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

/** Small labelled chip. Colour is always paired with an icon and/or text. */
export function Badge(label, tone = 'neutral', iconName = '') {
  return `<span class="badge badge--${tone}">${iconName ? icon(iconName, 11) : ''}${esc(label)}</span>`;
}

export const TeamBadge = (team) => `<span class="badge badge--team" data-team="${esc(team)}">${esc(team)}</span>`;

const TASK_TONE = { pending: 'pending', active: 'in-progress', completed: 'completed', failed: 'failed' };
const TASK_LABEL = { pending: 'Pending', active: 'In Progress', completed: 'Completed', failed: 'Failed' };
const TASK_ICON = { pending: 'clock', active: 'zap', completed: 'check', failed: 'alert' };

export const TaskStatusBadge = (status) =>
  Badge(TASK_LABEL[status] || status, TASK_TONE[status] || 'pending', TASK_ICON[status] || 'clock');

/** All applicable status badges for a contestant, in priority order. */
export function ContestantFlags(contestant) {
  const flags = [];
  if (contestant.status === 'evicted') flags.push(Badge('Evicted', 'evicted', 'door'));
  if (contestant.isCaptain) flags.push(Badge('Captain', 'captain', 'crown'));
  if (contestant.immunity) flags.push(Badge('Immune', 'immune', 'shield'));
  if (contestant.nomination) flags.push(Badge(`Danger Zone · R${contestant.nomination.round}`, 'nominated', 'alert'));
  if (!flags.length) flags.push(Badge('Active', 'active', 'check'));
  return flags.join('');
}

/** Compact status used in the roster table. */
export function ContestantStatus(contestant) {
  if (contestant.status === 'evicted') return Badge('Evicted', 'evicted', 'door');
  if (contestant.isCaptain) return Badge('Captain', 'captain', 'crown');
  if (contestant.immunity) return Badge('Immune', 'immune', 'shield');
  if (contestant.nomination) return Badge('Nominated', 'nominated', 'alert');
  return Badge('Active', 'active', 'check');
}

export const LiveChip = (label = 'Live') => `<span class="chip chip--live"><i class="live-dot"></i>${esc(label)}</span>`;
