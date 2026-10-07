import { esc, formatClock } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

const RADIUS = 82;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Circular countdown ring.
 * Amber under 30s, pulsing crimson under 10s, dim when the count is done.
 * @param {{remaining: number, ratio: number, state: string, running: boolean}} timer
 * @param {{label?: string, size?: number, showControls?: boolean, showPresets?: boolean}} options
 */
export function TimerRing(timer, options = {}) {
  const { label = 'Task Timer', size = 190, showControls = true, showPresets = false } = options;
  const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, timer.ratio)));
  const state = timer.state;
  const stateLabel = { running: 'Running', paused: 'Paused', warning: 'Hurry up', critical: 'Final seconds', done: 'Time up' }[
    state
  ];

  return `
    <div class="timer">
      <div class="timer__ring js-ring" data-state="${state}" data-size="${size}" role="timer"
        aria-live="off" aria-label="Task timer">
        <svg viewBox="0 0 ${size} ${size}">
          <circle class="timer__track" cx="${size / 2}" cy="${size / 2}" r="${RADIUS}" fill="none" stroke-width="8" />
          <circle class="timer__progress js-ring-progress" cx="${size / 2}" cy="${size / 2}" r="${RADIUS}" fill="none"
            stroke-width="8" stroke-dasharray="${CIRCUMFERENCE.toFixed(1)}"
            stroke-dashoffset="${offset.toFixed(1)}" />
        </svg>
        <div class="timer__inner">
          <div>
            <div class="timer__clock js-clock">${formatClock(timer.remaining)}</div>
            <div class="timer__state">
              <i class="live-dot ${timer.running ? (state === 'critical' ? 'live-dot--danger' : '') : 'live-dot--idle'}"></i>
              <span class="js-clock-label">${stateLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div style="text-align:center">
        <div class="timer__label">${esc(label)}</div>
        <div class="timer__scale" aria-hidden="true">
          ${Array.from({ length: 24 })
            .map((_, i) => `<i style="height:${20 + Math.abs(Math.sin(i / 2.4)) * 60}%"></i>`)
            .join('')}
        </div>
      </div>

      ${
        showControls
          ? `<div class="timer__controls">
              ${
                timer.running
                  ? `<button class="btn btn--warning" data-action="timer:pause">${icon('pause', 14)}<span class="btn__label">Pause</span></button>`
                  : `<button class="btn btn--primary" data-action="timer:start">${icon('play', 14)}<span class="btn__label">Start</span></button>`
              }
              <button class="btn" data-action="timer:reset">${icon('reset', 14)}<span class="btn__label">Reset</span></button>
            </div>`
          : ''
      }

      ${
        showPresets
          ? `<div class="timer__presets">
              ${[60, 180, 300, 600, 900]
                .map(
                  (seconds) =>
                    `<button class="btn btn--sm ${timer.remaining === seconds ? 'btn--primary' : ''}"
                       data-action="timer:preset" data-seconds="${seconds}">${formatClock(seconds)}</button>`,
                )
                .join('')}
              <button class="btn btn--sm" data-action="timer:custom">Custom…</button>
            </div>`
          : ''
      }
    </div>
  `;
}

export const TIMER_CIRCUMFERENCE = CIRCUMFERENCE;
