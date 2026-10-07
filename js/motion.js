/**
 * Motion layer — FLIP list reordering, score count-ups, feedback flashes.
 * Everything here is presentation only; it never touches House state.
 */
import { $, $$ } from './utils/dom.js';

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/* ── FLIP: animate rows that changed position between renders ──────────── */

/** Capture the vertical position of every [data-flip] element. */
export function capturePositions(root = document) {
  const map = new Map();
  $$('[data-flip]', root).forEach((node) => {
    const rect = node.getBoundingClientRect();
    map.set(node.dataset.flip, { top: rect.top, height: rect.height });
  });
  return map;
}

/** Animate from the captured positions to the current layout. */
export function playFlip(before, root = document) {
  if (!before?.size || prefersReducedMotion()) return;
  $$('[data-flip]', root).forEach((node) => {
    const previous = before.get(node.dataset.flip);
    if (!previous) {
      node.classList.add('is-spawning');
      return;
    }
    const rect = node.getBoundingClientRect();
    const delta = previous.top - rect.top;
    if (Math.abs(delta) < 1.5) return;
    node.style.transform = `translateY(${delta}px)`;
    node.style.transition = 'none';
    requestAnimationFrame(() => {
      node.style.transition = 'transform 460ms cubic-bezier(.22,.72,.3,1)';
      node.style.transform = 'translateY(0)';
      if (delta > 0) node.classList.add('flash-up');
      else node.classList.add('flash-down');
      setTimeout(() => {
        node.style.transition = '';
        node.classList.remove('flash-up', 'flash-down');
      }, 1600);
    });
  });
}

/* ── Score count-up / count-down ───────────────────────────────────────── */

/** Remembers the last value we rendered per key so numbers animate properly. */
const lastValues = new Map();

function animateNumber(node, from, to, duration = 620) {
  if (prefersReducedMotion() || from === to) {
    node.textContent = String(to);
    return;
  }
  // Safety net: if rAF is throttled (hidden tab, low-power mode) the number
  // still resolves to the real value instead of being stuck mid-count.
  const settle = setTimeout(() => {
    node.textContent = String(to);
  }, duration + 220);
  const start = performance.now();
  const diff = to - from;
  const sign = diff > 0 ? '+' : '';
  const decimals = Number.isInteger(to) && Number.isInteger(from) ? 0 : 1;

  function step(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = from + diff * eased;
    node.textContent = sign === '+' && progress < 1 ? `${value > from ? '+' : ''}${Math.round(value)}` : value.toFixed(decimals);
    if (progress < 1) requestAnimationFrame(step);
    else {
      clearTimeout(settle);
      node.textContent = String(to);
    }
  }
  requestAnimationFrame(step);
}

/**
 * Animate every [data-count-to] element in the tree.
 * Changes are flashed and (optionally) announced with a floating delta badge.
 */
export function runCounters(root = document) {
  $$('[data-count-to]', root).forEach((node) => {
    const key = node.dataset.countKey || node.dataset.countTo;
    const target = Number(node.dataset.countTo) || 0;
    const previous = lastValues.has(key) ? lastValues.get(key) : null;
    lastValues.set(key, target);

    if (previous === null) {
      animateNumber(node, Math.max(0, Math.round(target * 0.72)), target, 700);
      return;
    }
    if (previous === target) {
      node.textContent = String(target);
      return;
    }

    animateNumber(node, previous, target);
    node.classList.remove('score-pop', 'score-pop-down');
    void node.offsetWidth;
    node.classList.add(target > previous ? 'score-pop' : 'score-pop-down');

    if (node.dataset.countPop === 'true') {
      const host = node.closest('.lb-row, .contestant, .stat');
      if (host) {
        const badge = document.createElement('span');
        const delta = target - previous;
        badge.className = 'delta-pop';
        badge.dataset.sign = delta > 0 ? 'up' : 'down';
        badge.textContent = `${delta > 0 ? '+' : ''}${delta}`;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        host.appendChild(badge);
        setTimeout(() => badge.remove(), 1550);
      }
    }
  });
}

/** Reset the remembered values (used after a House reset / data import). */
export function resetCounters() {
  lastValues.clear();
}

/* ── Signature moments ─────────────────────────────────────────────────── */

/** Screen-wide CRT glitch flash — fired on eviction. */
export function glitchFlash() {
  if (prefersReducedMotion()) return;
  const node = document.createElement('div');
  node.className = 'glitch-flash';
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1000);
}

/** Apply the dramatic removal animation to a rendered element. */
export function playRemoval(node, done) {
  if (!node) {
    done?.();
    return;
  }
  node.classList.add('is-glitching');
  const delay = prefersReducedMotion() ? 0 : 1000;
  setTimeout(() => done?.(), delay);
}

/** Slide-in stagger for newly rendered grids. */
export function stagger(container, selector = ':scope > *') {
  if (prefersReducedMotion()) return;
  $$(selector, container).forEach((node, index) => {
    node.style.setProperty('--i', String(index));
    node.classList.add('is-spawning');
  });
}

/** Smoothly animate a number inside an element (used by the timer clock). */
export function setClockText(node, text) {
  if (!node || node.textContent === text) return;
  node.textContent = text;
}

/**
 * Ghost removal — clone an element, pin it to its current position and let it
 * glitch out while the real list re-renders underneath. Purely visual.
 */
export function ghostRemoval(node) {
  if (!node || prefersReducedMotion()) return;
  const rect = node.getBoundingClientRect();
  const ghost = node.cloneNode(true);
  ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;
    margin:0;z-index:190;pointer-events:none;`;
  ghost.querySelectorAll('.menu').forEach((menu) => menu.remove());
  document.body.appendChild(ghost);
  ghost.classList.add('is-glitching');
  setTimeout(() => ghost.remove(), 1050);
}
