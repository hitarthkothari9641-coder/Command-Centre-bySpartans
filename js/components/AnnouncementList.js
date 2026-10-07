import { esc, timeAgo, fullDateTime } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { EmptyState } from './EmptyState.js';

const TONE_META = {
  accent: { label: 'Highlight', icon: 'star' },
  info: { label: 'Information', icon: 'info' },
  alert: { label: 'Warning', icon: 'alert' },
  success: { label: 'Good News', icon: 'check' },
};

/** "Now showing" hero for the most recent broadcast. */
export function AnnouncementHero(announcement) {
  if (!announcement) {
    return EmptyState({
      icon: 'megaphone',
      title: 'No announcements yet',
      text: 'Big Boss has been quiet. Broadcast the first message of the season.',
      action: `<button class="btn btn--primary btn--sm" data-action="announcement:open">${icon('megaphone', 13)} Make announcement</button>`,
    });
  }
  const tone = TONE_META[announcement.tone]?.label || 'Notice';
  return `
    <div class="ann-hero">
      <div class="row-12">
        <span class="ann-hero__eye">${icon('eye', 30)}</span>
        <div>
          <div class="eyebrow">Big Boss · ${esc(tone)}</div>
          <div class="fs-xs muted">${esc(timeAgo(announcement.createdAt))} · ${esc(fullDateTime(announcement.createdAt))}</div>
        </div>
      </div>
      <p class="ann-hero__msg">${esc(announcement.message)}</p>
      <div class="row-8" style="margin-top:var(--s-4)">
        <button class="btn btn--sm btn--primary" data-action="announcement:replay" data-id="${esc(announcement.id)}">
          ${icon('tv', 13)} Show on House screen
        </button>
        <button class="btn btn--sm btn--ghost" data-action="announcement:delete" data-id="${esc(announcement.id)}">
          ${icon('trash', 13)} Delete
        </button>
      </div>
    </div>
  `;
}

/** Archive of every broadcast. */
export function AnnouncementList(announcements, { limit = 0 } = {}) {
  const list = limit ? announcements.slice(0, limit) : announcements;
  if (!list.length) {
    return EmptyState({ icon: 'megaphone', title: 'Archive is empty', text: 'Broadcasts you make will be stored here.', compact: true });
  }
  return `
    <ul class="ann-list">
      ${list
        .map((announcement) => {
          const meta = TONE_META[announcement.tone] || TONE_META.info;
          return `
          <li class="ann-item" data-tone="${esc(announcement.tone)}">
            <span class="ann-item__icon">${icon(meta.icon, 15)}</span>
            <div class="ann-item__body">
              <div class="ann-item__msg">${esc(announcement.message)}</div>
              <div class="ann-item__meta">${esc(meta.label)} · ${esc(timeAgo(announcement.createdAt))}</div>
            </div>
            <button class="btn btn--icon btn--sm btn--ghost" data-action="announcement:replay"
              data-id="${esc(announcement.id)}" aria-label="Replay announcement">${icon('tv', 14)}</button>
            <button class="btn btn--icon btn--sm btn--ghost" data-action="announcement:delete"
              data-id="${esc(announcement.id)}" aria-label="Delete announcement">${icon('trash', 14)}</button>
          </li>`;
        })
        .join('')}
    </ul>
  `;
}

/** Ticker used at the top of the dashboard. */
export const AnnouncementTicker = (announcement) =>
  announcement
    ? `<div class="hint-banner">
         <span class="chip chip--live">${icon('eye', 12)} Big Boss</span>
         <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(
           announcement.message,
         )}</span>
         <span class="fs-xs muted nowrap">${esc(timeAgo(announcement.createdAt))}</span>
         <button class="btn btn--sm btn--ghost" data-action="announcement:replay" data-id="${esc(announcement.id)}">Replay</button>
       </div>`
    : '';
