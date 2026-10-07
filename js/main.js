/**
 * BIG BOSS · COMMAND CENTER — application bootstrap.
 *
 * Responsibilities:
 *  • render the shell (header + sidebar) and the active view from store state,
 *  • own the render cycle (single subscription, FLIP + count-up after paint),
 *  • keep the header clock and every timer widget in sync without re-rendering,
 *  • wire keyboard shortcuts and filter inputs,
 *  • boot the 3D background when the platform and user preferences allow it.
 */
import { $, $$, debounce, esc, clockWithSeconds, formatClock } from './utils/dom.js';
import { store, selectors } from './store/index.js';
import { Header, updateHeaderClock } from './components/Header.js';
import { Sidebar, NAV } from './components/Sidebar.js';
import { installActions, initActions } from './actions.js';
import { initModal, closeModal, isModalOpen } from './ui/modal.js';
import { initBanner, hideBanner, isBannerOpen, showBanner } from './ui/banner.js';
import { initMenus, onRender as onRenderMenus } from './ui/menu.js';
import { toastInfo } from './ui/toast.js';
import { runCounters, capturePositions, playFlip, ghostRemoval, glitchFlash } from './motion.js';

import { DashboardView, DashboardMeta } from './views/DashboardView.js';
import { ContestantsView, ContestantsMeta } from './views/ContestantsView.js';
import { TasksView, TasksMeta } from './views/TasksView.js';
import { NominationsView, NominationsMeta } from './views/NominationsView.js';
import { LeaderboardView, LeaderboardMeta } from './views/LeaderboardView.js';
import { AnnouncementsView, AnnouncementsMeta } from './views/AnnouncementsView.js';
import { EvictionsView, EvictionsMeta } from './views/EvictionsView.js';
import { ActivityView, ActivityMeta } from './views/ActivityView.js';
import { SettingsView, SettingsMeta } from './views/SettingsView.js';

/* ── View registry ─────────────────────────────────────────────────────── */
const VIEWS = {
  dashboard: { render: (state) => DashboardView(state), meta: DashboardMeta },
  contestants: {
    render: (state) => ContestantsView(state, { query: filters.query, team: filters.team, status: filters.status }),
    meta: ContestantsMeta,
  },
  tasks: { render: (state) => TasksView(state, { taskStatus: filters.taskStatus }), meta: TasksMeta },
  nominations: { render: (state) => NominationsView(state), meta: NominationsMeta },
  leaderboard: { render: (state) => LeaderboardView(state, { team: filters.boardTeam }), meta: LeaderboardMeta },
  announcements: { render: (state) => AnnouncementsView(state), meta: AnnouncementsMeta },
  evictions: { render: (state) => EvictionsView(state), meta: EvictionsMeta },
  activity: { render: (state) => ActivityView(state, { logType: filters.logType }), meta: ActivityMeta },
  settings: { render: (state) => SettingsView(state), meta: SettingsMeta },
};

/** Transient UI filters — intentionally not persisted House state. */
const filters = {
  query: '',
  team: 'all',
  status: 'active',
  taskStatus: 'all',
  boardTeam: 'all',
  logType: 'all',
};

const state = () => store.getState();

/* ── Render cycle ──────────────────────────────────────────────────────── */

function render({ animateLists = false } = {}) {
  const current = state();
  const view = VIEWS[current.ui.activeView] ? current.ui.activeView : 'dashboard';
  const entry = VIEWS[view];

  // Preserve focus + caret across re-renders (search input).
  const activeId = document.activeElement?.id;
  const caret = document.activeElement?.selectionStart ?? null;

  const before = animateLists ? capturePositions() : null;

  $('#sidebar').innerHTML = Sidebar({
    activeView: view,
    counts: {
      contestants: selectors.activeContestants(current).length,
      tasks: current.tasks.filter((t) => t.status !== 'completed').length,
      nominees: selectors.dangerZone(current).length,
      evicted: selectors.evictedContestants(current).length,
    },
    collapsed: current.ui.sidebar === 'collapsed',
    captain: selectors.houseCaptain(current),
  });

  $('#header').innerHTML = Header({
    houseName: current.house.name,
    season: current.house.season,
    day: current.house.day,
    activeCount: selectors.activeContestants(current).length,
    nominees: selectors.dangerZone(current).length,
    title: entry.meta.title,
    subtitle: entry.meta.subtitle,
    sidebar: current.ui.sidebar,
  });

  $('#viewHost').innerHTML = `<section class="view is-active" id="view-${view}" data-view="${view}">${entry.render(
    current,
  )}</section>`;

  document.body.dataset.view = view;
  const app = $('#app');
  if (app) app.dataset.sidebar = current.ui.sidebar;
  document.title = `${entry.meta.title} · Big Boss Command Center`;

  runCounters();
  if (before) playFlip(before);
  syncTimerWidgets();
  updateHeaderClock(clockWithSeconds());
  onRenderMenus();

  if (activeId) {
    const node = document.getElementById(activeId);
    if (node) {
      node.focus();
      if (caret != null && node.setSelectionRange) {
        try {
          node.setSelectionRange(caret, caret);
        } catch {
          /* not a text input */
        }
      }
    }
  }
}

/* ── Timer widgets (updated without a full re-render) ──────────────────── */

function syncTimerWidgets() {
  const current = state();
  const timer = selectors.timerView(current);
  const circumference = 2 * Math.PI * 82;
  const offset = circumference * (1 - Math.max(0, Math.min(1, timer.ratio)));
  const label = { running: 'Running', paused: 'Paused', warning: 'Hurry up', critical: 'Final seconds', done: 'Time up' }[
    timer.state
  ];

  $$('.js-clock').forEach((node) => (node.textContent = formatClock(timer.remaining)));
  $$('.js-ring-progress').forEach((node) => node.setAttribute('stroke-dashoffset', offset.toFixed(1)));
  $$('.js-ring').forEach((node) => (node.dataset.state = timer.state));
  $$('.js-clock-label').forEach((node) => (node.textContent = label));
}

/* ── Navigation ────────────────────────────────────────────────────────── */

function navigate(view) {
  if (!VIEWS[view] || state().ui.activeView === view) return;
  store.dispatch({ type: 'ui/patch', payload: { activeView: view } });
  if (location.hash.slice(1) !== view) history.replaceState(null, '', `#${view}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Filter inputs ─────────────────────────────────────────────────────── */

function initFilters() {
  const search = () => {
    const input = $('#contestantSearch');
    if (!input) return;
    filters.query = input.value;
    const caret = input.selectionStart;
    render();
    const next = $('#contestantSearch');
    if (next) {
      next.focus();
      next.setSelectionRange(caret, caret);
    }
  };
  document.addEventListener('input', debounce(search, 180));

  document.addEventListener('change', (event) => {
    const target = event.target;

    if (target.id === 'contestantTeamFilter') {
      filters.team = target.value;
      render();
      return;
    }

    if (target.id === 'backgroundToggle') {
      store.dispatch({ type: 'ui/patch', payload: { background: target.checked } });
      applyBackgroundPreference();
      toastInfo(target.checked ? 'Background scene enabled.' : 'Background scene disabled.', 'Appearance');
      return;
    }

    if (target.id === 'sidebarToggle') {
      store.dispatch({ type: 'ui/patch', payload: { sidebar: target.checked ? 'collapsed' : 'expanded' } });
    }
  });

  document.addEventListener('click', (event) => {
    const statusButton = event.target.closest('#contestantStatusFilter button');
    if (statusButton) {
      filters.status = statusButton.dataset.status;
      render();
      return;
    }
    const taskButton = event.target.closest('#taskStatusFilter button');
    if (taskButton) {
      filters.taskStatus = taskButton.dataset.status;
      render();
      return;
    }
    const teamButton = event.target.closest('#boardTeamFilter button');
    if (teamButton) {
      filters.boardTeam = teamButton.dataset.team;
      render();
      return;
    }
    const logButton = event.target.closest('#logTypeFilter button');
    if (logButton) {
      filters.logType = logButton.dataset.type;
      render();
    }
  });

  // Keep chip checkboxes in sync with their visual state.
  document.addEventListener('change', (event) => {
    if (event.target.matches('.checkbox-chip input')) {
      event.target.closest('.checkbox-chip').classList.toggle('is-on', event.target.checked);
    }
  });
}

/* ── Keyboard shortcuts ────────────────────────────────────────────────── */

function initShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (isBannerOpen()) return hideBanner();
      if (isModalOpen()) return closeModal();
      return;
    }

    const typing = /input|textarea|select/i.test(event.target.tagName) || event.target.isContentEditable;
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

    const digit = Number(event.key);
    if (digit >= 1 && digit <= NAV.length) {
      event.preventDefault();
      navigate(NAV[digit - 1].id);
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'b':
        event.preventDefault();
        store.dispatch({
          type: 'ui/patch',
          payload: { sidebar: state().ui.sidebar === 'collapsed' ? 'expanded' : 'collapsed' },
        });
        break;
      case 'n':
        event.preventDefault();
        document.querySelector('[data-action="announcement:open"]')?.click();
        break;
      case 't': {
        event.preventDefault();
        const timer = selectors.timerView(state());
        store.dispatch({ type: timer.running ? 'timer/pause' : 'timer/start' });
        break;
      }
      case '?':
        event.preventDefault();
        document.querySelector('[data-action="help:open"]')?.click();
        break;
      default:
        break;
    }
  });
}

/* ── Timer tick loop ───────────────────────────────────────────────────── */

function initTimerLoop() {
  let previous = selectors.timerView(state()).remaining;

  setInterval(() => {
    const current = state();
    if (current.timer.running) {
      store.dispatch({ type: 'timer/tick', payload: { now: Date.now() }, meta: { silent: true, throttlePersist: true } });
    }
    const timer = selectors.timerView(current);
    syncTimerWidgets();

    if (timer.remaining !== previous) {
      previous = timer.remaining;
      // A full re-render is only needed when the count hits zero (log + banner).
      if (timer.remaining === 0 && current.timer.running === false) {
        render();
        glitchFlash();
        const message = state().announcements[0]?.message || '⏰ TIME IS UP. The task window is closed.';
        showBanner(message, 'alert', { duration: 9000 });
        toastInfo('The countdown hit zero. Timer closed.', 'Time up');
      }
    }

    updateHeaderClock(clockWithSeconds());
  }, 250);
}

/* ── 3D background ─────────────────────────────────────────────────────── */

let backgroundScene = null;

function applyBackgroundPreference() {
  const enabled = state().ui.background;
  document.body.dataset.bg = enabled ? 'on' : 'off';
  if (!enabled) {
    backgroundScene?.stop?.();
    return;
  }
  initBackground();
}

async function initBackground() {
  const canvas = $('#bgCanvas');
  if (!canvas || backgroundScene) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    document.body.dataset.bg = 'off';
    return;
  }
  // WebGL support check — fall back to the static gradient otherwise.
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2') || probe.getContext('webgl');
  if (!gl) {
    document.body.dataset.bg = 'off';
    return;
  }
  try {
    const module = await import('../vendor/background.bundle.js');
    backgroundScene = module.createBackground(canvas);
  } catch (error) {
    console.warn('[command-center] 3D background unavailable, using static gradient.', error);
    document.body.dataset.bg = 'off';
  }
}

/* ── Boot ──────────────────────────────────────────────────────────────── */

function boot() {
  const initial = state();

  // Restore the view from the URL hash when present.
  const hash = location.hash.slice(1);
  if (VIEWS[hash] && hash !== initial.ui.activeView) {
    store.dispatch({ type: 'ui/patch', payload: { activeView: hash } });
  }

  initModal();
  initBanner();
  initMenus();
  initActions();
  initFilters();
  initShortcuts();
  initTimerLoop();

  installActions({
    navigate,
    refresh: render,
    ghostRemoval: (node) => {
      ghostRemoval(node);
      glitchFlash();
    },
  });

  // Leaderboard-style views animate reordering; others simply repaint.
  store.subscribe((_, action) => {
    if (action?.meta?.silent) return;
    render({ animateLists: state().ui.activeView === 'leaderboard' });
  });

  render();
  applyBackgroundPreference();

  if (!state().ui.onboarded) {
    setTimeout(() => showBanner('Welcome to the Command Center. Big Boss is watching every move.', 'accent', { duration: 6500 }), 600);
  }

  // Persist the last known timer position on unload.
  window.addEventListener('beforeunload', () => store.flush());
}

boot();
