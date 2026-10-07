import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { AnnouncementHero, AnnouncementList } from '../components/AnnouncementList.js';
import { AnnouncementForm } from '../components/ModalForms.js';

export function AnnouncementsView(state) {
  const [latest] = state.announcements;

  return `
    <div class="view-head">
      <div class="view-head__meta">
        <h2>Big Boss Announcements</h2>
        <p>${state.announcements.length} broadcast${state.announcements.length === 1 ? '' : 's'} this season · the House screen updates instantly</p>
      </div>
      <span class="spacer"></span>
      <div class="view-head__actions">
        <button class="btn btn--primary btn--sm" data-action="announcement:open">
          ${icon('megaphone', 14)} Make announcement
        </button>
      </div>
    </div>

    <div class="grid-split">
      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('megaphone', 15)}</span><h3>Compose Broadcast</h3></div>
          <span class="card__meta">Full-width House takeover</span>
        </header>
        <div class="card__body">
          ${AnnouncementForm('', 'accent').replaceAll('announcementMessage', 'composerMessage').replaceAll('announcementTone', 'composerTone')}
          <div class="card__foot" style="border:0;padding:0;margin-top:var(--s-4)">
            <button class="btn btn--primary" data-action="announcement:send">
              ${icon('eye', 15)} Broadcast to the House
            </button>
            <button class="btn btn--ghost" data-action="announcement:open">Open cinematic view</button>
          </div>
        </div>
      </section>

      <section class="card glass">
        <header class="card__head">
          <div class="card__title"><span class="card__icon">${icon('tv', 15)}</span><h3>Now Showing</h3></div>
          <span class="spacer"></span>
          ${
            latest
              ? `<button class="btn btn--sm btn--primary" data-action="announcement:replay" data-id="${esc(latest.id)}">
                   ${icon('eye', 13)} Replay overlay
                 </button>`
              : ''
          }
        </header>
        <div class="card__body">${AnnouncementHero(latest)}</div>
      </section>
    </div>

    <section class="card glass" style="margin-top:var(--s-4)">
      <header class="card__head">
        <div class="card__title"><span class="card__icon">${icon('layers', 15)}</span><h3>Announcement Archive</h3></div>
        <span class="card__meta">${state.announcements.length} total</span>
      </header>
      <div class="card__body card__body--flush">
        ${AnnouncementList(state.announcements, { limit: 30 })}
      </div>
    </section>
  `;
}

export const AnnouncementsMeta = { title: 'Announcements', subtitle: 'Broadcast to the whole House' };
