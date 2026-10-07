/**
 * Big Boss announcement banner — full-width cinematic takeover with a pulsing
 * eye, typewriter text, scan sweep and auto-dismiss progress bar.
 */
import { $, esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

const TONE_LABEL = {
  accent: 'Big Boss · Highlight',
  info: 'Big Boss · Information',
  alert: 'Big Boss · Warning',
  success: 'Big Boss · Good News',
};

let typeTimer = 0;
let hideTimer = 0;
let onClose = null;

function nodes() {
  return {
    banner: $('#banner'),
    card: $('#bannerCard'),
    tag: $('#bannerTag'),
    text: $('#bannerText'),
    progress: $('#bannerProgress'),
    stamp: $('#bannerStamp'),
  };
}

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Show a Big Boss announcement.
 * @param {string} message
 * @param {string} tone  accent | info | alert | success
 * @param {{duration?: number, onDismiss?: Function, audio?: boolean}} options
 */
export function showBanner(message, tone = 'accent', options = {}) {
  const { duration = 9000, onDismiss } = options;
  const { banner, card, tag, text, progress, stamp } = nodes();
  if (!banner) {
    // eslint-disable-next-line no-console
    console.info('[Big Boss]', message);
    return;
  }

  clearInterval(typeTimer);
  clearTimeout(hideTimer);

  card.dataset.tone = tone;
  tag.innerHTML = `${icon('eye', 14)}<span>${esc(TONE_LABEL[tone] || TONE_LABEL.info)}</span>`;
  stamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  text.textContent = '';
  banner.classList.add('is-open');
  banner.setAttribute('aria-hidden', 'false');
  onClose = onDismiss;

  const full = String(message);
  // The full text is exposed immediately, even while the typewriter runs.
  card.dataset.message = full;
  text.setAttribute('aria-label', full);

  // Typewriter (skipped entirely for reduced-motion users).
  if (prefersReducedMotion()) {
    text.textContent = full;
  } else {
    let index = 0;
    const caret = '<span class="banner__caret"></span>';
    typeTimer = setInterval(() => {
      index += 1;
      text.innerHTML = `${esc(full.slice(0, index))}${index < full.length ? caret : ''}`;
      if (index >= full.length) clearInterval(typeTimer);
    }, 22);
  }

  // Progress bar + auto dismiss.
  progress.style.animation = 'none';
  void progress.offsetWidth; // restart the animation
  if (duration) {
    progress.style.animation = `banner-progress ${duration}ms linear forwards`;
    hideTimer = setTimeout(hideBanner, duration);
  } else {
    progress.style.animation = 'none';
  }
}

export function hideBanner() {
  const { banner } = nodes();
  if (!banner || !banner.classList.contains('is-open')) return;
  clearInterval(typeTimer);
  clearTimeout(hideTimer);
  banner.classList.remove('is-open');
  banner.setAttribute('aria-hidden', 'true');
  onClose?.();
  onClose = null;
}

export const isBannerOpen = () => $('#banner')?.classList.contains('is-open') ?? false;

export function initBanner() {
  const { banner } = nodes();
  if (!banner) return;
  banner.addEventListener('click', (event) => {
    if (event.target.closest('#bannerClose') || event.target === banner) hideBanner();
  });
  $('#bannerClose')?.addEventListener('click', (event) => {
    event.stopPropagation();
    hideBanner();
  });
}
