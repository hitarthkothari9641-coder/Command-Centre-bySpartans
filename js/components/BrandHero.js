import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

/**
 * BrandHero — the cinematic lockup at the top of the dashboard.
 *
 * Carries the official "SPARTANS X TECH BOSS" key art (gold + crimson brand
 * layer) while the data layer below keeps its cyan/violet status semantics.
 * The artwork doubles as the season's identity card: live status, day counter
 * and the three fastest Big Boss actions.
 *
 * @param {{houseName: string, season: number, day: number, activeCount: number,
 *          nominees: number, running: boolean, onboarded: boolean}} options
 */
export function BrandHero({ houseName, season, day, activeCount, nominees, running }) {
  const zoneTone = nominees ? 'chip--danger' : 'chip--success';
  return `
    <section class="brand-hero glass" aria-label="Spartans X Tech Boss">
      <div class="brand-hero__art" aria-hidden="true">
        <img
          src="assets/brand/logo-wide.jpg"
          srcset="assets/brand/logo-wide.jpg 720w, assets/brand/logo-hero.jpg 1280w"
          sizes="(max-width: 900px) 100vw, 520px"
          width="720" height="480" loading="eager" decoding="async"
          alt="" />
      </div>

      <div class="brand-hero__body">
        <div class="brand-hero__lockup">
          <img class="brand-hero__mark" src="assets/brand/logo-mark.png"
            width="128" height="128" loading="eager" decoding="async"
            alt="Spartans X Tech Boss crest" />
          <div>
            <p class="brand-hero__eyebrow">Season ${season} · Day ${day} · ${esc(houseName)}</p>
            <h2 class="brand-hero__title">Command Center</h2>
            <p class="brand-hero__tagline">Big Boss is watching every move.</p>
          </div>
        </div>

        <div class="brand-hero__status">
          <span class="chip chip--live"><i class="live-dot"></i> Live</span>
          <span class="chip chip--plain">${icon('users', 13)} ${activeCount} in House</span>
          <span class="chip chip--plain ${zoneTone}">
            ${icon(nominees ? 'alert' : 'shield', 13)} ${nominees ? `${nominees} at risk` : 'Zone clear'}
          </span>
          <span class="chip chip--plain">${icon('clock', 13)} ${running ? 'Timer running' : 'Timer idle'}</span>
        </div>

        <div class="brand-hero__actions">
          <button class="btn btn--primary" data-action="announcement:open">
            ${icon('megaphone', 15)}<span class="btn__label">Make Announcement</span>
          </button>
          <button class="btn" data-action="task:open">
            ${icon('clipboard', 15)}<span class="btn__label">Assign task</span>
          </button>
          <button class="btn btn--danger" data-action="nomination:open">
            ${icon('alert', 15)}<span class="btn__label">Nominate</span>
          </button>
        </div>
      </div>
    </section>
  `;
}
