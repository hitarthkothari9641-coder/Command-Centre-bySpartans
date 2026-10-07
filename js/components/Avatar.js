import { avatarTone, initials, esc } from '../utils/dom.js';

const SIZES = { xs: 'avatar--xs', sm: 'avatar--sm', md: '', lg: 'avatar--lg' };

/**
 * Contestant avatar — deterministic colour derived from the name, initials inside.
 * @param {{name: string}} contestant
 * @param {'xs'|'sm'|'md'|'lg'} size
 */
export function Avatar(contestant, size = 'md') {
  const name = contestant?.name || '?';
  return `<span class="avatar ${SIZES[size] ?? ''}" style="--av:${avatarTone(name)}"
    title="${esc(name)}" aria-hidden="true">${esc(initials(name))}</span>`;
}

/** Overlapping avatar row, e.g. task assignees or Danger Zone nominees. */
export function AvatarStack(contestants = [], size = 'sm', max = 5) {
  const shown = contestants.slice(0, max);
  const extra = contestants.length - shown.length;
  return `<span class="avatar-stack" aria-label="${esc(contestants.map((c) => c.name).join(', '))}">
    ${shown.map((c) => Avatar(c, size)).join('')}
    ${extra > 0 ? `<span class="avatar ${SIZES[size]}" style="--av:#3f4a63" aria-hidden="true">+${extra}</span>` : ''}
  </span>`;
}
