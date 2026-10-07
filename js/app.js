/**
 * Big Boss Command Centre — Application layer
 * Renders views from the store and wires all House controls.
 */
import * as S from './store.js';
import { ICONS } from './icons.js';

/* ============================================================
   Utilities
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const ico = (name, size = 15) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

const initials = (name) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const a = (c, cls = '') =>
  `<div class="avatar ${cls}" style="background:${S.avatarTone(c.name)}">${esc(initials(c.name))}</div>`;

function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 5) return 'just now';
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}
const timeOf = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function flags(c) {
  const out = [];
  if (c.isCaptain) out.push('<span class="badge captain">Captain</span>');
  if (c.immunity) out.push('<span class="badge immune">Immune</span>');
  if (c.nomination) out.push(`<span class="badge nominated">Danger Zone · R${c.nomination.round}</span>`);
  if (c.status === 'evicted') out.push('<span class="badge evicted">Evicted</span>');
  return out.join('');
}

function emptyState(iconName, title, body, actionHTML = '') {
  return `<div class="empty">
    <div class="e-ico">${ico(iconName, 26)}</div>
    <strong>${esc(title)}</strong>
    <p>${esc(body)}</p>
    ${actionHTML}
  </div>`;
}

/* ============================================================
   Toasts
   ============================================================ */

function toast(message, kind = 'default', ms = 2800) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<div>${esc(message)}</div>`;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 240);
  }, ms);
}

const fail = (e) => {
  if (e instanceof Error && e.message) return toast(e.message, 'error', 3600);
  console.error(e);
  toast('Something went wrong.', 'error');
};

/* ============================================================
   Modal
   ============================================================ */

let modalActions = null;

function openModal({ title, desc = '', body = '', actions = [], onSubmit }) {
  $('#modalTitle').textContent = title;
  $('#modalDesc').textContent = desc;
  $('#modalDesc').style.display = desc ? '' : 'none';
  $('#modalBody').innerHTML = body;

  modalActions = { onSubmit };
  const foot = $('#modalFoot');
  foot.innerHTML = '';

  const list = actions.length && actions[actions.length - 1].type !== 'cancel'
    ? actions
    : actions;

  list.forEach((act) => {
    const b = document.createElement('button');
    b.className = `btn ${act.cls || ''}`;
    b.innerHTML = act.icon ? `${ico(act.icon)} ${esc(act.label)}` : esc(act.label);
    b.addEventListener('click', () => {
      try {
        if (!act.onClick || act.onClick($('#modalBody')) !== false) closeModal();
      } catch (e) {
        fail(e);
      }
    });
    foot.appendChild(b);
  });

  // Enter key submits via the primary action by default
  $('#modal').dataset.primaryIndex = String(
    Math.max(0, list.findIndex((x) => (x.cls || '').includes('primary'))),
  );

  $('#modal').classList.add('show');
  $('#modal').setAttribute('aria-hidden', 'false');
  const first = $('#modalBody input, #modalBody select, #modalBody textarea');
  if (first) setTimeout(() => first.focus(), 60);
}

function closeModal() {
  $('#modal').classList.remove('show');
  $('#modal').setAttribute('aria-hidden', 'true');
  modalActions = null;
}

$('#modal').addEventListener('mousedown', (e) => {
  if (e.target.id === 'modal') closeModal();
});
$('#modal').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    const i = Number($('#modal').dataset.primaryIndex || 0);
    $('#modalFoot').children[i]?.click();
  }
});

const field = (label, inner, hint = '') =>
  `<div class="field"><label>${esc(label)}</label>${inner}${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>`;

/* ============================================================
   Broadcast (Big Boss announcement overlay)
   ============================================================ */

let broadcastTimer = null;

function broadcast(message, tone = 'info', autoHide = 6500) {
  const box = $('#broadcast');
  $('#broadcastMsg').textContent = message;
  $('#broadcastCard').className = `bc-card tone-${tone}`;
  box.classList.add('show');
  clearTimeout(broadcastTimer);
  if (autoHide) broadcastTimer = setTimeout(hideBroadcast, autoHide);
}
function hideBroadcast() {
  clearTimeout(broadcastTimer);
  $('#broadcast').classList.remove('show');
}
$('#broadcast').addEventListener('click', hideBroadcast);

/* ============================================================
   Navigation
   ============================================================ */

const VIEW_META = {
  overview: ['House Overview', 'Live control room'],
  contestants: ['Contestant Management', 'Roster, teams, points and status'],
  tasks: ['Task Management', 'Assign, run and complete House tasks'],
  leaderboard: ['Live Leaderboard', 'Rankings update with every point'],
  danger: ['Nominations & Danger Zone', 'Immunity, nominations and evictions'],
  announcements: ['Big Boss Announcements', 'Broadcast to the whole House'],
  evictions: ['Evictions', 'Contestants removed from the House'],
  activity: ['Activity Log', 'Every House event, timestamped'],
  settings: ['Settings & Data', 'House configuration and backups'],
};

let currentView = 'overview';

function setView(view) {
  if (!VIEW_META[view]) return;
  currentView = view;
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  const [title, sub] = VIEW_META[view];
  $('#viewTitle').textContent = title;
  $('#viewSub').textContent = sub;
  render();
  if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('.nav-item');
  if (nav) setView(nav.dataset.view);
});

/* ============================================================
   Renderers
   ============================================================ */

let lastRanks = new Map();

function render() {
  const st = S.getState();
  const s = S.stats();

  $('#houseLabel').textContent = `${st.house.name} · S${st.house.season}`;
  $('#chipDay').innerHTML = `${ico('calendar', 13)} Day ${st.house.day}`;
  $('#chipClock').innerHTML = `${ico('clock', 13)} <span id="clockText">${timeOf(Date.now())}</span>`;
  renderTimerChip();

  $('#navContestants').textContent = s.active;
  $('#navContestants').className = `pill ${s.active ? '' : 'zero'}`;
  $('#navTasks').textContent = s.tasksOpen;
  $('#navTasks').className = `pill ${s.tasksOpen ? '' : 'zero'}`;
  $('#navDanger').textContent = s.nominated;
  $('#navDanger').className = `pill ${s.nominated ? '' : 'zero'}`;

  const cap = s.captain;
  $('#sidebarCaptain').innerHTML = cap
    ? `${a(cap, 'sm')}<div style="min-width:0"><small>House Captain</small><strong>${esc(cap.name)}</strong></div>`
    : `<div style="min-width:0"><small>House Captain</small><strong style="color:var(--text-3)">Vacant</strong></div>`;

  const fns = {
    overview: renderOverview,
    contestants: renderContestants,
    tasks: renderTasks,
    leaderboard: renderLeaderboard,
    danger: renderDanger,
    announcements: renderAnnouncements,
    evictions: renderEvictions,
    activity: renderActivity,
    settings: renderSettings,
  };
  const host = $(`#view-${currentView}`);
  const before = host.querySelectorAll('.board-row').length ? capturePositions() : null;
  host.innerHTML = fns[currentView](st, s);
  if (before && currentView === 'leaderboard') playFlip(before);
  syncTimerWidgets();
}

/** FLIP: capture row positions before a re-render. */
function capturePositions() {
  const map = new Map();
  $$('#view-leaderboard .board-row').forEach((row) => {
    map.set(row.dataset.id, row.getBoundingClientRect().top);
  });
  return map;
}

function playFlip(before) {
  $$('#view-leaderboard .board-row').forEach((row) => {
    const prev = before.get(row.dataset.id);
    if (prev == null) return;
    const now = row.getBoundingClientRect().top;
    const dy = prev - now;
    if (Math.abs(dy) < 1) return;
    row.style.transform = `translateY(${dy}px)`;
    row.style.transition = 'none';
    requestAnimationFrame(() => {
      row.style.transition = 'transform .42s cubic-bezier(.2,.7,.3,1)';
      row.style.transform = 'translateY(0)';
      row.classList.add(dy > 0 ? 'flash-up' : 'flash-down');
      setTimeout(() => {
        row.style.transition = '';
        row.classList.remove('flash-up', 'flash-down');
      }, 1650);
    });
  });
}

/* ------------------------------------------------------------ */
/* Overview                                                      */
/* ------------------------------------------------------------ */

function renderOverview(st, s) {
  const board = S.ranked().slice(0, 5);
  const newest = st.announcements[0];
  const openTasks = st.tasks.filter((t) => t.status !== 'completed').slice(0, 3);
  const maxPts = Math.max(1, board[0]?.points || 1);
  const day = st.house.day;

  return `
  <div class="stack">
    ${
      newest
        ? `<div class="ann-ticker"><span class="tag">Big Boss</span>
             <div class="msg">${esc(newest.message)}</div>
             <span class="hint">${timeAgo(newest.createdAt)}</span>
             <button class="btn ghost sm" data-action="replay-announcement" data-id="${newest.id}">Replay</button>
           </div>`
        : ''
    }

    <div class="grid cols-4">
      ${statCard('Active Contestants', s.active, `${s.total} total · ${s.evicted} evicted`, '', 'users')}
      ${statCard('House Points', s.totalPoints, `avg ${s.avgPoints} pts / contestant`, 'accent', 'star')}
      ${statCard('Danger Zone', s.nominated, s.nominated ? `Round ${s.round} nominations open` : 'Nobody nominated', s.nominated ? 'danger' : '', 'shield')}
      ${statCard('Task Progress', `${s.completionRate}%`, `${s.tasksDone}/${s.tasksTotal} tasks completed`, 'success', 'check')}
    </div>

    <div class="grid cols-3">
      <div class="panel span-2">
        <div class="panel-head">
          <h2>Live Leaderboard</h2>
          <span class="sub">Top 5 of ${s.active}</span>
          <div class="spacer"></div>
          <button class="btn ghost sm" data-view="leaderboard">View full board →</button>
        </div>
        <div class="panel-body flush">
          <div class="board">
            ${board.map((c, i) => boardRow(c, i + 1, maxPts, day)).join('')}
          </div>
        </div>
      </div>

      <div class="stack">
        <div class="panel">
          <div class="panel-head">
            <h2>Task Timer</h2>
            <div class="spacer"></div>
            ${timerStateChip()}
          </div>
          <div class="panel-body">
            ${timerRing()}
            <div class="row" style="margin-top:14px">
              ${
                st.timer.running
                  ? `<button class="btn" data-action="timer-pause">${ico('pause')} Pause</button>`
                  : `<button class="btn primary" data-action="timer-start">${ico('play')} Start</button>`
              }
              <button class="btn" data-action="timer-reset">${ico('rotate')} Reset</button>
              <button class="btn ghost sm" data-view="tasks">Manage →</button>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>House Captain</h2></div>
          <div class="panel-body">
            ${
              s.captain
                ? `<div class="row" style="gap:11px">
                     ${a(s.captain, 'lg')}
                     <div style="flex:1;min-width:0">
                       <div class="p-name" style="font-weight:600">${esc(s.captain.name)}</div>
                       <div class="hint">${esc(s.captain.team)} · ${s.captain.points} pts</div>
                     </div>
                   </div>
                   <div class="row" style="margin-top:12px">
                     <button class="btn sm" data-action="captain-modal">Change</button>
                     <button class="btn ghost sm" data-action="revoke-captain">Revoke</button>
                   </div>`
                : `<div class="hint">No Captain appointed.</div>
                   <button class="btn primary sm" style="margin-top:10px" data-action="captain-modal">Appoint Captain</button>`
            }
          </div>
        </div>
      </div>
    </div>

    <div class="grid cols-3">
      <div class="panel span-2">
        <div class="panel-head">
          <h2>Open Tasks</h2>
          <div class="spacer"></div>
          <button class="btn ghost sm" data-view="tasks">All tasks →</button>
        </div>
        <div class="panel-body stack">
          ${
            openTasks.length
              ? openTasks.map(taskCard).join('')
              : emptyState('check', 'No open tasks', 'Every task in the House has been completed.')
          }
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Danger Zone</h2><div class="spacer"></div><span class="badge ${s.nominated ? 'nominated' : 'neutral'}">${s.nominated} nominated</span></div>
        <div class="panel-body flush">
          ${
            s.dangerZone.length
              ? s.dangerZone.map((c, i) => dzRow(c, i + 1)).join('')
              : emptyState('shield', 'Danger Zone is empty', 'Nominate contestants to place them at risk of eviction.')
          }
        </div>
        <div class="panel-foot">
          <button class="btn danger sm" data-action="nominate-modal">${ico('shield')} Nominate</button>
          <button class="btn ghost sm" data-view="danger">Open Danger Zone →</button>
        </div>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="panel">
        <div class="panel-head"><h2>Team Standings</h2></div>
        <div class="panel-body stack">
          ${s.teams.map(teamRow).join('')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Recent Activity</h2><div class="spacer"></div><button class="btn ghost sm" data-view="activity">All →</button></div>
        <div class="panel-body flush">
          ${
            st.log.length
              ? st.log.slice(0, 6).map(logItem).join('')
              : emptyState('activity', 'No activity yet', 'Actions you take will appear here.')
          }
        </div>
      </div>
    </div>
  </div>`;
}

const statCard = (k, v, m, tone = '', icon = '') => `
  <div class="stat ${tone ? `tone-${tone}` : ''}">
    <div class="k">${esc(k)}</div>
    <div class="v ${tone === 'accent' || tone === 'success' || tone === 'danger' ? tone : ''}">${esc(String(v))}</div>
    <div class="m">${esc(m)}</div>
  </div>`;

function teamRow(t) {
  const s = S.stats();
  const max = Math.max(1, ...s.teams.map((x) => x.points));
  return `<div class="team-chip">
    <div style="flex:1;min-width:0">
      <div class="row between" style="gap:8px">
        <div>
          <div class="t-name">Team ${esc(t.team)}</div>
          <div class="t-meta">${t.members} member${t.members === 1 ? '' : 's'} · ${t.tasks} task${t.tasks === 1 ? '' : 's'} done</div>
        </div>
        <div class="num" style="font-weight:650;font-variant-numeric:tabular-nums">${t.points}</div>
      </div>
      <div class="meter ${t.team === s.leader?.team ? '' : 'info'}" style="margin-top:8px"><i style="width:${(t.points / max) * 100}%"></i></div>
    </div>
  </div>`;
}

function boardRow(c, rank, maxPts, day) {
  const pct = maxPts ? (c.points / maxPts) * 100 : 0;
  return `<div class="board-row ${rank <= 3 ? `rank-${rank} top-3` : ''}" data-id="${c.id}">
    <div class="rank-num">#${rank}</div>
    <div class="who">
      ${a(c)}
      <div style="min-width:0;flex:1">
        <div class="nm">${esc(c.name)} ${c.isCaptain ? '<span class="badge captain">Captain</span>' : ''} ${c.immunity ? '<span class="badge immune">Immune</span>' : ''}</div>
        <div class="meta">Team ${esc(c.team)} · ${c.tasksCompleted} task${c.tasksCompleted === 1 ? '' : 's'} completed${c.nomination ? ' · <span style="color:#ff9194">In Danger Zone</span>' : ''}</div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      </div>
    </div>
    <div class="pts">${c.points}<small>pts</small></div>
    <div class="row" style="gap:5px;flex-wrap:nowrap">
      <button class="btn sm" data-action="points-quick" data-id="${c.id}" data-delta="10" title="Award 10 points">+10</button>
      <button class="btn sm" data-action="points-quick" data-id="${c.id}" data-delta="-10" title="Deduct 10 points">−10</button>
      <button class="btn ghost sm" data-action="points-modal" data-id="${c.id}" title="Custom points">···</button>
    </div>
  </div>`;
}

function dzRow(c, i) {
  return `<div class="dz-item">
    <div class="dz-index">${i}</div>
    ${a(c, 'sm')}
    <div class="dz-info">
      <div class="dz-name">${esc(c.name)}</div>
      <div class="dz-meta">Team ${esc(c.team)} · ${c.points} pts${c.nomination?.reason ? ` · ${esc(c.nomination.reason)}` : ''}</div>
    </div>
    <button class="btn sm" data-action="withdraw-nomination" data-id="${c.id}" title="Withdraw nomination">Withdraw</button>
    <button class="btn danger sm" data-action="evict-modal" data-id="${c.id}">Evict</button>
  </div>`;
}

/* ------------------------------------------------------------ */
/* Contestants                                                   */
/* ------------------------------------------------------------ */

let contestantFilter = { q: '', team: 'all', status: 'active' };

function renderContestants(st, s) {
  let list = st.contestants.slice();
  if (contestantFilter.status === 'active') list = list.filter((c) => c.status === 'active');
  if (contestantFilter.status === 'evicted') list = list.filter((c) => c.status === 'evicted');
  if (contestantFilter.status === 'nominated') list = list.filter((c) => c.nomination);
  if (contestantFilter.status === 'immune') list = list.filter((c) => c.immunity);
  if (contestantFilter.team !== 'all') list = list.filter((c) => c.team === contestantFilter.team);
  if (contestantFilter.q)
    list = list.filter((c) => c.name.toLowerCase().includes(contestantFilter.q.toLowerCase()));
  list.sort((a, b) => b.points - a.points);

  const teams = [...new Set(st.contestants.map((c) => c.team))];

  return `<div class="stack">
    <div class="toolbar">
      <div class="grow">
        <input class="input" id="cSearch" placeholder="Search contestants…" value="${esc(contestantFilter.q)}" />
      </div>
      <div class="seg" id="statusSeg">
        ${[
          ['active', 'Active'],
          ['nominated', 'Nominated'],
          ['immune', 'Immune'],
          ['evicted', 'Evicted'],
          ['all', 'All'],
        ]
          .map(([k, l]) => `<button data-status="${k}" class="${contestantFilter.status === k ? 'on' : ''}">${l}</button>`)
          .join('')}
      </div>
      <select class="select" id="teamFilter" style="width:auto">
        <option value="all">All teams</option>
        ${teams.map((t) => `<option value="${esc(t)}" ${contestantFilter.team === t ? 'selected' : ''}>Team ${esc(t)}</option>`).join('')}
      </select>
      <button class="btn primary" data-action="add-contestant">${ico('plus')} Add Contestant</button>
    </div>

    ${
      list.length
        ? `<div class="grid auto">${list.map(personCard).join('')}</div>`
        : emptyState('users', 'No contestants match', 'Adjust the filters above or add a new contestant to the House.',
            `<button class="btn primary sm" style="margin-top:10px" data-action="add-contestant">Add Contestant</button>`)
    }

    <div class="grid cols-3">
      <div class="panel span-2">
        <div class="panel-head"><h2>Roster Table</h2><div class="spacer"></div><span class="sub">${list.length} shown · ${st.contestants.length} in House</span></div>
        <div class="panel-body flush">
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr><th>Contestant</th><th>Team</th><th>Status</th><th>Tasks</th><th class="num">Points</th><th></th></tr></thead>
              <tbody>
                ${list
                  .map(
                    (c) => `<tr>
                  <td><div class="row" style="gap:9px;flex-wrap:nowrap">${a(c, 'sm')}<span style="font-weight:550">${esc(c.name)}</span></div></td>
                  <td><span class="badge team">${esc(c.team)}</span></td>
                  <td>${flags(c) || '<span class="badge neutral">Active</span>'}</td>
                  <td class="num">${c.tasksCompleted}</td>
                  <td class="num" style="font-weight:650">${c.points}</td>
                  <td class="num"><button class="btn ghost sm" data-action="points-modal" data-id="${c.id}">Points</button></td>
                </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="stack">
        <div class="panel">
          <div class="panel-head"><h2>House Statistics</h2></div>
          <div class="panel-body stack">
            ${miniStat('Highest Scorer', s.mvp ? `${s.mvp.name} · ${s.mvp.points} pts` : '—')}
            ${miniStat('Most Tasks Completed', s.mostTasks ? `${s.mostTasks.name} · ${s.mostTasks.tasksCompleted}` : '—')}
            ${miniStat('House Captain', s.captain ? s.captain.name : 'Vacant')}
            ${miniStat('Leading Team', s.leader ? `Team ${s.leader.team} · ${s.leader.points} pts` : '—')}
            ${miniStat('Tasks Completed', `${s.tasksDone} of ${s.tasksTotal} (${s.completionRate}%)`)}
            ${miniStat('Average Score', `${s.avgPoints} pts`)}
            ${miniStat('Immune Contestants', String(s.immune))}
            ${miniStat('Evicted', String(s.evicted))}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

const miniStat = (k, v) => `
  <div class="row between" style="gap:10px;padding:2px 0">
    <span class="hint">${esc(k)}</span>
    <strong style="font-size:12.5px;text-align:right">${esc(v)}</strong>
  </div>`;

function personCard(c) {
  const cls = [
    'person',
    c.nomination ? 'is-nominated' : '',
    c.immunity ? 'is-immune' : '',
    c.status === 'evicted' ? 'is-evicted' : '',
    c.isCaptain ? 'is-captain' : '',
  ].join(' ');

  const evicted = c.status === 'evicted';
  return `<div class="${cls}">
    <div class="p-top">
      ${a(c, 'lg')}
      <div style="flex:1;min-width:0">
        <div class="p-name">${esc(c.name)}</div>
        <div class="p-sub">Team ${esc(c.team)} · ${c.tasksCompleted} task${c.tasksCompleted === 1 ? '' : 's'}</div>
      </div>
      <div class="row" style="gap:4px;flex-wrap:nowrap">
        <button class="btn ghost icon" data-action="edit-contestant" data-id="${c.id}" title="Edit">${ico('edit', 14)}</button>
      </div>
    </div>

    <div class="p-flags">${flags(c)}</div>

    <div class="p-points"><b>${c.points}</b><span>points</span></div>

    ${evicted ? `<div class="row" style="gap:5px">
        <button class="btn success sm" style="flex:1" data-action="reinstate" data-id="${c.id}">Reinstate</button>
        <button class="btn danger sm" data-action="remove-contestant" data-id="${c.id}" title="Delete permanently">${ico('trash', 14)}</button>
      </div>`
      : `
    <div class="points-quick">
      <button class="btn sm" data-action="points-quick" data-id="${c.id}" data-delta="-10">−10</button>
      <button class="btn sm" data-action="points-quick" data-id="${c.id}" data-delta="5">+5</button>
      <button class="btn sm" data-action="points-quick" data-id="${c.id}" data-delta="10">+10</button>
      <button class="btn sm" data-action="points-quick" data-id="${c.id}" data-delta="25">+25</button>
      <button class="btn ghost icon" data-action="points-modal" data-id="${c.id}" title="Custom points">${ico('plus-minus', 14)}</button>
    </div>

    <div class="p-actions">
      ${
        c.isCaptain
          ? `<button class="btn sm" data-action="revoke-captain">${ico('star', 13)} Stand down</button>`
          : `<button class="btn sm" data-action="set-captain" data-id="${c.id}">${ico('star', 13)} Make Captain</button>`
      }
      ${
        c.immunity
          ? `<button class="btn success sm" data-action="immunity-off" data-id="${c.id}">${ico('shield', 13)} Revoke immunity</button>`
          : `<button class="btn sm" data-action="immunity-on" data-id="${c.id}">${ico('shield', 13)} Grant immunity</button>`
      }
      ${
        c.nomination
          ? `<button class="btn sm" data-action="withdraw-nomination" data-id="${c.id}">Withdraw nomination</button>`
          : `<button class="btn danger sm" data-action="nominate" data-id="${c.id}" ${c.immunity || c.isCaptain ? 'disabled title="Immune contestants and the Captain cannot be nominated"' : ''}>Nominate</button>`
      }
      <button class="btn danger sm" data-action="evict-modal" data-id="${c.id}">Evict</button>
    </div>`}
  </div>`;
}

/* ------------------------------------------------------------ */
/* Tasks                                                         */
/* ------------------------------------------------------------ */

let taskFilter = 'all';

function renderTasks(st, s) {
  const list = st.tasks.filter((t) => (taskFilter === 'all' ? true : t.status === taskFilter));
  const canAssign = S.activeContestants().length > 0;

  return `<div class="stack">
    <div class="grid cols-4">
      ${statCard('Total Tasks', s.tasksTotal, `${s.tasksOpen} open`, '', 'check')}
      ${statCard('Completed', s.tasksDone, `${s.completionRate}% completion rate`, 'success', 'check')}
      ${statCard('In Progress', st.tasks.filter((t) => t.status === 'active').length, 'Currently running', 'info', 'play')}
      ${statCard('Failed', st.tasks.filter((t) => t.status === 'failed').length, 'Missed or disqualified', 'danger', 'x')}
    </div>

    <div class="grid cols-3">
      <div class="panel span-2">
        <div class="panel-head">
          <h2>Task Board</h2>
          <div class="spacer"></div>
          <div class="seg" id="taskSeg">
            ${[
              ['all', 'All'],
              ['pending', 'Pending'],
              ['active', 'In Progress'],
              ['completed', 'Completed'],
              ['failed', 'Failed'],
            ]
              .map(([k, l]) => `<button data-status="${k}" class="${taskFilter === k ? 'on' : ''}">${l}</button>`)
              .join('')}
          </div>
          <button class="btn primary sm" data-action="add-task" ${canAssign ? '' : 'disabled'}>${ico('plus')} Assign Task</button>
        </div>
        <div class="panel-body stack">
          ${
            list.length
              ? list.map(taskCard).join('')
              : emptyState('check', 'No tasks here', canAssign
                  ? 'Assign a task to get the House working.'
                  : 'Add contestants to the House before assigning tasks.',
                  canAssign ? `<button class="btn primary sm" style="margin-top:10px" data-action="add-task">Assign Task</button>` : '')
          }
        </div>
      </div>

      <div class="stack">
        <div class="panel">
          <div class="panel-head">
            <h2>Task Timer</h2>
            <div class="spacer"></div>
            ${timerStateChip()}
          </div>
          <div class="panel-body">
            ${timerRing()}
            <div class="row" style="margin-top:14px;gap:6px">
              ${
                st.timer.running
                  ? `<button class="btn" data-action="timer-pause">${ico('pause')} Pause</button>`
                  : `<button class="btn primary" data-action="timer-start">${ico('play')} Start</button>`
              }
              <button class="btn" data-action="timer-reset">${ico('rotate')} Reset</button>
            </div>
            <div class="divider" style="margin:14px 0"></div>
            <div class="hint" style="margin-bottom:7px">Quick set</div>
            <div class="preset-row">
              ${[60, 180, 300, 600, 900]
                .map((v) => `<button class="btn sm" data-action="timer-preset" data-sec="${v}">${S.fmtClock(v)}</button>`)
                .join('')}
              <button class="btn sm" data-action="timer-custom">Custom…</button>
            </div>
            <div class="divider" style="margin:14px 0"></div>
            ${field('Timer label', `<input class="input" id="timerLabel" value="${esc(st.timer.label)}" placeholder="e.g. Coding Sprint" />`)}
            <button class="btn sm" style="margin-top:9px" data-action="timer-label">Update label</button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>Leaderboard Impact</h2></div>
          <div class="panel-body flush">
            ${S.ranked().slice(0, 6).map((c, i) => `<div class="dz-item">
              <div class="dz-index" style="background:var(--panel-2);color:var(--text-2);border-color:var(--border-2)">${i + 1}</div>
              ${a(c, 'sm')}
              <div class="dz-info"><div class="dz-name">${esc(c.name)}</div><div class="dz-meta">${c.tasksCompleted} tasks completed</div></div>
              <strong style="font-variant-numeric:tabular-nums">${c.points}</strong>
            </div>`).join('') || emptyState('bar', 'No data', 'Add contestants to see rankings.')}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function taskCard(t) {
  const people = t.assignees.map((id) => S.c(id)).filter(Boolean);
  const status = t.status;
  const label = { pending: 'Pending', active: 'In Progress', completed: 'Completed', failed: 'Failed' }[status];
  return `<div class="task ${status === 'completed' ? 'completed' : ''}">
    <div class="t-head">
      <div style="flex:1;min-width:0">
        <div class="t-title ${status === 'completed' ? 'done' : ''}">${esc(t.title)}</div>
        ${t.description ? `<div class="t-desc">${esc(t.description)}</div>` : ''}
      </div>
      <span class="badge ${status}">${label}</span>
      <span class="chip tone-accent" style="font-weight:650">+${t.points} pts</span>
    </div>
    <div class="t-people">
      ${
        people.length
          ? people.map((c) => `<span class="chip" style="padding-left:4px">${a(c, 'sm')} ${esc(c.name)}</span>`).join('')
          : '<span class="hint">No assignees</span>'
      }
    </div>
    <div class="t-meta">
      <span>${ico('clock', 12)} created ${timeAgo(t.createdAt)}</span>
      ${t.completedAt ? `<span>· completed ${timeAgo(t.completedAt)}</span>` : ''}
    </div>
    <div class="row" style="gap:6px">
      ${
        status === 'pending'
          ? `<button class="btn info sm" data-action="task-start" data-id="${t.id}">${ico('play', 13)} Start</button>`
          : ''
      }
      ${
        status === 'active'
          ? `<button class="btn" data-action="task-pending" data-id="${t.id}">Move back</button>`
          : ''
      }
      ${
        status !== 'completed'
          ? `<button class="btn success sm" data-action="task-complete" data-id="${t.id}">${ico('check', 13)} Mark Complete (+${t.points})</button>`
          : `<button class="btn sm" data-action="task-reopen" data-id="${t.id}">Reopen</button>`
      }
      ${status === 'pending' || status === 'active' ? `<button class="btn danger sm" data-action="task-fail" data-id="${t.id}">Mark Failed</button>` : ''}
      <div style="flex:1"></div>
      <button class="btn ghost icon" data-action="task-delete" data-id="${t.id}" title="Delete task">${ico('trash', 14)}</button>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ */
/* Leaderboard                                                   */
/* ------------------------------------------------------------ */

let boardScope = 'all';

function renderLeaderboard(st, s) {
  const full = S.ranked();
  const list = boardScope === 'all' ? full : full.filter((c) => c.team === boardScope);
  const maxPts = Math.max(1, list[0]?.points || 1);
  const podium = full.slice(0, 3);
  const teams = [...new Set(st.contestants.map((c) => c.team))];

  return `<div class="stack">
    <div class="grid cols-3">
      ${podium
        .map(
          (c, i) => `<div class="stat ${i === 0 ? 'tone-accent' : i === 1 ? '' : 'tone-info'}">
          <div class="row" style="gap:11px">
            <div class="dz-index" style="background:var(--accent-soft);border-color:rgba(232,179,65,.3);color:var(--accent)">#${i + 1}</div>
            ${a(c, 'lg')}
            <div style="min-width:0">
              <div style="font-weight:600">${esc(c.name)}</div>
              <div class="hint">Team ${esc(c.team)}</div>
            </div>
          </div>
          <div class="v" style="margin-top:10px">${c.points}<span style="font-size:12px;color:var(--text-3);font-weight:500"> pts</span></div>
          <div class="m">${c.tasksCompleted} task${c.tasksCompleted === 1 ? '' : 's'} completed ${c.isCaptain ? '· Captain' : ''} ${c.immunity ? '· Immune' : ''}</div>
        </div>`,
        )
        .join('')}
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>Full Rankings</h2>
        <span class="sub">${list.length} active contestant${list.length === 1 ? '' : 's'}</span>
        <div class="spacer"></div>
        <div class="seg" id="boardSeg">
          <button data-team="all" class="${boardScope === 'all' ? 'on' : ''}">All teams</button>
          ${teams.map((t) => `<button data-team="${esc(t)}" class="${boardScope === t ? 'on' : ''}">${esc(t)}</button>`).join('')}
        </div>
      </div>
      <div class="panel-body flush">
        <div class="board">
          ${
            list.length
              ? list.map((c, i) => boardRow(c, i + 1, maxPts, st.house.day)).join('')
              : emptyState('bar', 'No contestants', 'Evicted contestants are removed from the leaderboard.')
          }
        </div>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="panel">
        <div class="panel-head"><h2>Team Standings</h2><div class="spacer"></div><span class="badge captain">${s.leader ? `Leading: Team ${esc(s.leader.team)}` : 'No teams'}</span></div>
        <div class="panel-body stack">${s.teams.map(teamRow).join('')}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Point Movements</h2><div class="spacer"></div><button class="btn ghost sm" data-view="activity">Log →</button></div>
        <div class="panel-body flush">
          ${
            st.log.filter((l) => l.type === 'points').length
              ? st.log.filter((l) => l.type === 'points').slice(0, 7).map(logItem).join('')
              : emptyState('star', 'No point changes yet', 'Use the point controls to move the leaderboard.')
          }
        </div>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ */
/* Nominations / Danger Zone                                     */
/* ------------------------------------------------------------ */

function renderDanger(st, s) {
  const dz = s.dangerZone;
  const act = S.activeContestants();
  const eligible = act.filter((c) => !c.immunity && !c.isCaptain && !c.nomination);
  const immune = S.immuneActive();

  return `<div class="stack">
    <div class="grid cols-4">
      ${statCard('Nomination Round', s.round, 'Danger Zone cycle', 'accent', 'shield')}
      ${statCard('Nominated', dz.length, dz.length ? 'Facing eviction' : 'Danger Zone empty', dz.length ? 'danger' : '', 'alert')}
      ${statCard('Immune', immune.length, 'Protected this round', 'success', 'shield')}
      ${statCard('Eligible', eligible.length, 'Can be nominated', 'info', 'users')}
    </div>

    ${
      dz.length
        ? `<div class="ann-ticker" style="border-color:rgba(229,72,77,.32);background:linear-gradient(90deg,var(--danger-soft),transparent 70%)">
             <span class="tag" style="background:var(--danger);color:#fff">Danger Zone</span>
             <div class="msg">${dz.map((c) => esc(c.name)).join(' · ')} — the House will vote for eviction.</div>
             <button class="btn danger sm" data-action="evict-all-modal">Evict round</button>
           </div>`
        : ''
    }

    <div class="grid cols-3">
      <div class="panel span-2">
        <div class="panel-head">
          <h2>Danger Zone</h2>
          <span class="sub">Round ${s.round}</span>
          <div class="spacer"></div>
          <button class="btn ghost sm" data-action="clear-nominations" ${dz.length ? '' : 'disabled'}>Clear all</button>
          <button class="btn sm" data-action="next-round">Next round →</button>
        </div>
        <div class="panel-body flush">
          ${
            dz.length
              ? dz.map((c, i) => dzRow(c, i + 1)).join('')
              : emptyState('shield', 'Danger Zone is empty', 'Nobody is nominated for eviction right now. Nominate a contestant to place them at risk.',
                  `<button class="btn danger sm" style="margin-top:10px" data-action="nominate-modal">Nominate Contestant</button>`)
          }
        </div>
      </div>

      <div class="stack">
        <div class="panel">
          <div class="panel-head"><h2>Nominate</h2><div class="spacer"></div><span class="sub">${eligible.length} eligible</span></div>
          <div class="panel-body stack">
            <div class="hint">Immune contestants, the House Captain and already-nominated contestants are not listed.</div>
            <div class="checks" id="nominateChecks">
              ${
                eligible.length
                  ? eligible
                      .map(
                        (c) => `<label class="check" data-id="${c.id}">
                    <input type="checkbox" value="${c.id}" />${a(c, 'sm')} ${esc(c.name)}
                  </label>`,
                      )
                      .join('')
                  : '<div class="hint">No eligible contestants.</div>'
              }
            </div>
            ${field('Reason (optional)', `<input class="input" id="nominateReason" placeholder="e.g. Failed the task" />`)}
            <button class="btn danger block" data-action="nominate-selected" ${eligible.length ? '' : 'disabled'}>${ico('shield')} Nominate selected</button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>Immune Contestants</h2><div class="spacer"></div><span class="badge immune">${immune.length}</span></div>
          <div class="panel-body flush">
            ${
              immune.length
                ? immune
                    .map(
                      (c) => `<div class="dz-item">
                  ${a(c, 'sm')}
                  <div class="dz-info"><div class="dz-name">${esc(c.name)}</div><div class="dz-meta">Team ${esc(c.team)} · cannot be nominated</div></div>
                  <button class="btn sm" data-action="immunity-off" data-id="${c.id}">Revoke</button>
                </div>`,
                    )
                    .join('')
                : emptyState('shield', 'No immunity held', 'Grant immunity to protect a contestant from nomination.')
            }
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ */
/* Announcements                                                 */
/* ------------------------------------------------------------ */

const TONES = {
  info: { label: 'Information', color: 'var(--info)', bg: 'var(--info-soft)' },
  accent: { label: 'Highlight', color: 'var(--accent)', bg: 'var(--accent-soft)' },
  alert: { label: 'Warning', color: 'var(--danger)', bg: 'var(--danger-soft)' },
  success: { label: 'Good News', color: 'var(--success)', bg: 'var(--success-soft)' },
};

function renderAnnouncements(st) {
  const latest = st.announcements[0];
  return `<div class="stack">
    <div class="grid cols-2">
      <div class="panel">
        <div class="panel-head"><h2>Broadcast an Announcement</h2></div>
        <div class="panel-body stack">
          ${field('Message', `<textarea class="textarea" id="annMsg" placeholder="Contestants, assemble in the living area immediately."></textarea>`)}
          ${field('Tone', `<select class="select" id="annTone">
            <option value="accent">Highlight (gold)</option>
            <option value="info">Information (blue)</option>
            <option value="alert">Warning (red)</option>
            <option value="success">Good news (green)</option>
          </select>`)}
          <div class="row">
            <button class="btn primary" data-action="send-announcement">${ico('megaphone')} Broadcast</button>
            <button class="btn" data-action="quick-announcement" data-msg="Contestants, Big Boss needs your attention in the living area.">Quick call-out</button>
            <button class="btn" data-action="quick-announcement" data-msg="Task window is now open. The clock is ticking.">Task window</button>
          </div>
          <div class="hint">Broadcasts appear instantly on the House display and are stored in the announcement history.</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Now Showing</h2><div class="spacer"></div><button class="btn ghost sm" data-action="replay-announcement" data-id="${latest?.id || ''}" ${latest ? '' : 'disabled'}>Replay overlay</button></div>
        <div class="panel-body">
          ${
            latest
              ? `<div style="padding:6px 0">
                   <div class="bc-tag" style="color:${TONES[latest.tone]?.color || 'var(--accent)'};font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">Big Boss · ${TONES[latest.tone]?.label || 'Notice'}</div>
                   <div style="font-size:18px;font-weight:600;line-height:1.45;margin-top:8px">${esc(latest.message)}</div>
                   <div class="hint" style="margin-top:10px">${timeAgo(latest.createdAt)}</div>
                   <div class="row" style="margin-top:14px">
                     <button class="btn sm" data-action="replay-announcement" data-id="${latest.id}">${ico('megaphone', 13)} Show on screen</button>
                     <button class="btn danger sm" data-action="delete-announcement" data-id="${latest.id}">Delete</button>
                   </div>
                 </div>`
              : emptyState('megaphone', 'No announcements yet', 'Broadcast your first Big Boss announcement.')
          }
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Announcement History</h2><div class="spacer"></div><span class="sub">${st.announcements.length} total</span></div>
      <div class="panel-body flush">
        ${
          st.announcements.length
            ? st.announcements
                .map(
                  (an) => `<div class="ann">
            <div class="a-ico" style="background:${TONES[an.tone]?.bg || 'var(--panel-2)'};color:${TONES[an.tone]?.color || 'var(--text-2)'}">${ico('megaphone', 14)}</div>
            <div class="a-body">
              <div class="a-msg">${esc(an.message)}</div>
              <div class="a-time">${TONES[an.tone]?.label || 'Notice'} · ${timeAgo(an.createdAt)} · ${new Date(an.createdAt).toLocaleString()}</div>
            </div>
            <button class="btn ghost sm" data-action="replay-announcement" data-id="${an.id}">Show</button>
            <button class="btn ghost sm" data-action="delete-announcement" data-id="${an.id}">${ico('trash', 13)}</button>
          </div>`,
                )
                .join('')
            : emptyState('megaphone', 'History is empty', 'Announcements you broadcast will be kept here.')
        }
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ */
/* Evictions                                                     */
/* ------------------------------------------------------------ */

function renderEvictions(st, s) {
  const out = S.evicted();
  const dz = s.dangerZone;

  return `<div class="stack">
    <div class="grid cols-4">
      ${statCard('Evicted', s.evicted, 'Removed from the House', 'danger', 'logout')}
      ${statCard('Still Active', s.active, 'Remaining contestants', 'success', 'users')}
      ${statCard('In Danger Zone', dz.length, 'Eviction candidates', dz.length ? 'danger' : '', 'alert')}
      ${statCard('Nomination Round', s.round, 'Current cycle', '', 'shield')}
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>Eviction Console</h2>
        <span class="sub">Contestants in the Danger Zone can be evicted by House vote</span>
        <div class="spacer"></div>
        <button class="btn danger sm" data-action="evict-all-modal" ${dz.length ? '' : 'disabled'}>Evict whole round</button>
      </div>
      <div class="panel-body flush">
        ${
          dz.length
            ? dz.map((c, i) => dzRow(c, i + 1)).join('')
            : emptyState('shield', 'Nobody is up for eviction', 'Nominate contestants first — the Danger Zone is empty.')
        }
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Evicted Contestants</h2><div class="spacer"></div><span class="sub">${out.length} removed</span></div>
      <div class="panel-body flush">
        ${
          out.length
            ? out
                .map(
                  (c) => `<div class="evict-row">
              ${a(c)}
              <div style="flex:1;min-width:0">
                <div class="p-name" style="font-weight:600">${esc(c.name)} <span class="badge evicted">Evicted</span></div>
                <div class="hint">Team ${esc(c.team)} · final score ${c.points} pts · ${esc(c.evictionReason || 'Evicted')}</div>
                <div class="hint">Left the House ${timeAgo(c.evictedAt || Date.now())}</div>
              </div>
              <button class="btn success sm" data-action="reinstate" data-id="${c.id}">Reinstate</button>
              <button class="btn ghost icon" data-action="remove-contestant" data-id="${c.id}" title="Delete permanently">${ico('trash', 14)}</button>
            </div>`,
                )
                .join('')
            : emptyState('logout', 'No evictions yet', 'The House is still at full strength.')
        }
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Eviction History</h2></div>
      <div class="panel-body flush">
        ${
          st.log.filter((l) => l.type === 'eviction').length
            ? st.log.filter((l) => l.type === 'eviction').map(logItem).join('')
            : emptyState('activity', 'No eviction records', 'Eviction events will be logged here.')
        }
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ */
/* Activity                                                      */
/* ------------------------------------------------------------ */

let logFilter = 'all';

function renderActivity(st) {
  const types = ['all', 'points', 'nomination', 'immunity', 'eviction', 'task', 'captain', 'timer', 'contestant', 'session'];
  const list = st.log.filter((l) => (logFilter === 'all' ? true : l.type === logFilter));
  return `<div class="stack">
    <div class="toolbar">
      <div class="seg" id="logSeg">
        ${types
          .map((t) => `<button data-type="${t}" class="${logFilter === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`)
          .join('')}
      </div>
      <div class="grow"></div>
      <span class="hint">${list.length} event${list.length === 1 ? '' : 's'}</span>
      <button class="btn sm" data-action="clear-log">Clear log</button>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>House Activity Log</h2><div class="spacer"></div><span class="sub">Newest first</span></div>
      <div class="panel-body flush" style="max-height:640px;overflow:auto">
        ${list.length ? list.map(logItem).join('') : emptyState('activity', 'Nothing logged', 'House events will appear here.')}
      </div>
    </div>
  </div>`;
}

function logItem(l) {
  return `<div class="log-item" data-type="${l.type}">
    <span class="l-dot"></span>
    <span class="l-time">${timeOf(l.createdAt)}</span>
    <span style="flex:1">${esc(l.message)}</span>
    <span class="hint">${timeAgo(l.createdAt)}</span>
  </div>`;
}

/* ------------------------------------------------------------ */
/* Settings                                                      */
/* ------------------------------------------------------------ */

function renderSettings(st, s) {
  return `<div class="stack">
    <div class="grid cols-2">
      <div class="panel">
        <div class="panel-head"><h2>House Configuration</h2></div>
        <div class="panel-body stack">
          ${field('House name', `<input class="input" id="setHouseName" value="${esc(st.house.name)}" />`)}
          ${field('Season', `<input class="input" id="setSeason" type="number" min="1" value="${st.house.season}" />`)}
          <div class="row">
            <button class="btn primary" data-action="save-house">Save configuration</button>
            <button class="btn" data-action="advance-day">${ico('calendar')} Advance to Day ${st.house.day + 1}</button>
          </div>
          <div class="divider"></div>
          <div class="hint">Current state: Day ${st.house.day} · Season ${st.house.season} · Round ${st.round}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Data &amp; Backup</h2></div>
        <div class="panel-body stack">
          <div class="hint">All data is stored locally in your browser (localStorage) and persists across reloads.</div>
          <div class="row">
            <button class="btn" data-action="export">${ico('download')} Export JSON</button>
            <button class="btn" data-action="import">${ico('upload')} Import JSON</button>
          </div>
          <div class="divider"></div>
          <div class="row">
            <button class="btn" data-action="reset-house">${ico('rotate')} Reset to demo season</button>
            <button class="btn danger" data-action="clear-house">${ico('trash')} Empty the House</button>
          </div>
          <div class="divider"></div>
          <div class="row">
            <label class="switch">
              <input type="checkbox" id="confirmToggle" checked disabled />
              <span class="track"></span>
              Confirm destructive actions
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="panel">
        <div class="panel-head"><h2>Keyboard Shortcuts</h2></div>
        <div class="panel-body stack">
          ${[
            ['1 – 9', 'Switch views'],
            ['N', 'New announcement'],
            ['T', 'Start / pause the task timer'],
            ['Esc', 'Close overlay or modal'],
          ]
            .map(([k, d]) => `<div class="row between"><span class="kbd">${k}</span><span class="hint">${d}</span></div>`)
            .join('')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>System</h2></div>
        <div class="panel-body stack">
          ${miniStat('Version', 'Command Centre v1.0')}
          ${miniStat('Contestants', `${s.total} (${s.active} active)`)}
          ${miniStat('Tasks', `${s.tasksTotal} (${s.tasksDone} completed)`)}
          ${miniStat('Announcements', String(st.announcements.length))}
          ${miniStat('Log entries', String(st.log.length))}
          ${miniStat('Storage', 'localStorage · browser-local')}
        </div>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   Timer rendering (lightweight, updated by the tick loop)
   ============================================================ */

function timerRing() {
  const st = S.getState();
  const R = 66;
  const C = 2 * Math.PI * R;
  const remaining = S.remainingSeconds();
  const pct = st.timer.duration ? remaining / st.timer.duration : 0;
  const offset = C * (1 - Math.max(0, Math.min(1, pct)));
  const crit = remaining <= 30 && st.timer.running;
  return `<div class="timer-wrap" style="justify-content:center">
    <div class="timer-ring js-ring ${crit ? 'crit' : ''}">
      <svg width="148" height="148" viewBox="0 0 148 148">
        <circle class="ring-track" cx="74" cy="74" r="${R}" fill="none" stroke-width="7" />
        <circle class="ring-prog js-ring-prog" cx="74" cy="74" r="${R}" fill="none" stroke-width="7"
          stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" />
      </svg>
      <div class="inner">
        <div>
          <div class="clock js-clock">${S.fmtClock(remaining)}</div>
          <div class="t-label js-clock-label">${st.timer.running ? 'Running' : remaining === 0 ? 'Time Up' : 'Paused'}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function timerStateChip() {
  const st = S.getState();
  const r = S.remainingSeconds();
  const state = st.timer.running ? 'Running' : r === 0 ? 'Time Up' : 'Paused';
  const cls = st.timer.running ? (r <= 30 ? 'tone-danger' : 'tone-accent') : '';
  return `<span class="chip ${cls}"><span class="dot ${st.timer.running ? 'live' : ''}" style="${st.timer.running ? '' : 'background:var(--text-3)'}"></span>${state}</span>`;
}

function renderTimerChip() {
  const st = S.getState();
  const el = $('#chipTimer');
  if (!el) return;
  const r = S.remainingSeconds();
  const cls = st.timer.running ? (r <= 30 ? 'tone-danger' : 'tone-accent') : '';
  el.className = `chip ${cls}`;
  el.innerHTML = `${ico('clock', 13)} <span id="chipTimerText">${S.fmtClock(r)}</span> · ${st.timer.running ? 'Running' : r === 0 ? 'Time Up' : 'Paused'}`;
}

/** Keep every rendered clock, ring and chip consistent with the store. */
function syncTimerWidgets() {
  const st = S.getState();
  const r = S.remainingSeconds();
  const C = 2 * Math.PI * 66;
  const ratio = st.timer.duration ? Math.max(0, Math.min(1, r / st.timer.duration)) : 0;

  $$('.js-clock').forEach((el) => (el.textContent = S.fmtClock(r)));
  $$('.js-ring-prog').forEach((el) => el.setAttribute('stroke-dashoffset', (C * (1 - ratio)).toFixed(1)));
  $$('.js-ring').forEach((el) => el.classList.toggle('crit', r <= 30 && st.timer.running));
  $$('.js-clock-label').forEach(
    (el) => (el.textContent = st.timer.running ? 'Running' : r === 0 ? 'Time Up' : 'Paused'),
  );

  const chipText = $('#chipTimerText');
  if (chipText) chipText.textContent = S.fmtClock(r);
  renderTimerChip();
}

/** Tick loop — updates only the clocks, rings and chips (never a full re-render). */
setInterval(() => {
  const changed = S.tickTimer();
  syncTimerWidgets();

  const clock = $('#clockText');
  if (clock) clock.textContent = timeOf(Date.now());

  if (changed) {
    renderTimerChip();
    if (currentView === 'tasks' || currentView === 'overview') render();
  }
}, 500);

/* ============================================================
   Action handlers
   ============================================================ */

function pointsModal(c) {
  openModal({
    title: `Adjust points · ${c.name}`,
    desc: `Currently on ${c.points} points. Add or deduct points with an optional reason.`,
    body: `
      <div class="row" style="gap:6px">
        ${[-50, -25, -10, 10, 25, 50].map((d) => `<button class="btn sm" data-quick="${d}">${d > 0 ? '+' : ''}${d}</button>`).join('')}
      </div>
      ${field('Points', `<input class="input" id="ptsDelta" type="number" value="10" step="5" />`, 'Use a negative number to deduct points.')}
      ${field('Reason', `<input class="input" id="ptsReason" placeholder="e.g. Won the coding sprint" />`)}`,
    actions: [
      { label: 'Cancel', cls: 'ghost' },
      {
        label: 'Apply',
        cls: 'primary',
        onClick: (body) => {
          try {
            const delta = Number($('#ptsDelta', body).value);
            const reason = $('#ptsReason', body).value;
            S.adjustPoints(c.id, delta, reason);
            toast(`${delta > 0 ? '+' : ''}${delta} points applied to ${c.name}.`, delta > 0 ? 'success' : 'default');
          } catch (e) {
            fail(e);
            return false;
          }
        },
      },
    ],
  });
  $$('[data-quick]').forEach((b) =>
    b.addEventListener('click', () => {
      const input = $('#ptsDelta');
      input.value = Number(input.value || 0) + Number(b.dataset.quick);
      input.focus();
    }),
  );
}

function addContestantModal() {
  openModal({
    title: 'Add contestant to the House',
    desc: 'Every contestant needs a name and a team. Points start at zero.',
    body: `
      ${field('Full name', `<input class="input" id="newName" placeholder="e.g. Riya Sharma" />`)}
      ${field('Team', `<select class="select" id="newTeam">${S.TEAMS.map((t) => `<option>${t}</option>`).join('')}</select>`)}
      ${field('Starting points', `<input class="input" id="newPoints" type="number" value="0" />`)}`,
    actions: [
      { label: 'Cancel', cls: 'ghost' },
      {
        label: 'Add to House',
        cls: 'primary',
        onClick: () => {
          try {
            const p = S.addContestant({
              name: $('#newName').value,
              team: $('#newTeam').value,
              points: $('#newPoints').value,
            });
            toast(`${p.name} entered the House.`, 'success');
            broadcast(`${p.name}, welcome to the Tech House. Team ${p.team} — good luck.`, 'info', 5000);
          } catch (e) {
            fail(e);
            return false;
          }
        },
      },
    ],
  });
}

function editContestantModal(c) {
  openModal({
    title: `Edit ${c.name}`,
    desc: 'Update the contestant record. Points are best managed through the point controls.',
    body: `
      ${field('Full name', `<input class="input" id="edName" value="${esc(c.name)}" />`)}
      ${field('Team', `<select class="select" id="edTeam">${S.TEAMS.concat([c.team]).filter((t, i, arr) => arr.indexOf(t) === i).map((t) => `<option ${t === c.team ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
      ${field('Points', `<input class="input" id="edPoints" type="number" value="${c.points}" />`)}
      ${field('Notes', `<textarea class="textarea" id="edNotes" placeholder="Alliances, warnings, habits…">${esc(c.notes || '')}</textarea>`)}`,
    actions: [
      { label: 'Cancel', cls: 'ghost' },
      {
        label: 'Save changes',
        cls: 'primary',
        onClick: () => {
          const name = $('#edName').value.trim();
          if (!name) {
            toast('Name cannot be empty.', 'error');
            return false;
          }
          if (S.getState().contestants.some((x) => x.id !== c.id && x.name.toLowerCase() === name.toLowerCase())) {
            toast('Another contestant already uses that name.', 'error');
            return false;
          }
          c.name = name;
          c.team = $('#edTeam').value;
          c.points = Math.max(0, Math.round(Number($('#edPoints').value) || 0));
          c.notes = $('#edNotes').value.trim();
          S.log('contestant', `${c.name}'s record was updated by Big Boss.`);
          S.getState();
          document.dispatchEvent(new CustomEvent(S.EVT, { detail: S.getState() }));
          toast('Contestant updated.', 'success');
        },
      },
    ],
  });
}

function nominateModal(presetId) {
  const eligible = S.activeContestants().filter((c) => !c.immunity && !c.isCaptain && !c.nomination);
  if (!eligible.length) {
    toast('No eligible contestants to nominate.', 'error');
    return;
  }
  openModal({
    title: 'Nominate for eviction',
    desc: 'Immune contestants and the Captain are protected and cannot be nominated.',
    body: `
      <div class="checks" id="nomChecks">
        ${eligible
          .map(
            (c) => `<label class="check ${c.id === presetId ? 'on' : ''}" data-id="${c.id}">
          <input type="checkbox" value="${c.id}" ${c.id === presetId ? 'checked' : ''} />${a(c, 'sm')} ${esc(c.name)}
        </label>`,
          )
          .join('')}
      </div>
      ${field('Reason (optional)', `<input class="input" id="nomReason" placeholder="e.g. Lowest task contribution" />`)}`,
    actions: [
      { label: 'Cancel', cls: 'ghost' },
      {
        label: 'Nominate',
        cls: 'danger',
        onClick: (body) => {
          const ids = $$('input:checked', body).map((i) => i.value);
          if (!ids.length) {
            toast('Select at least one contestant.', 'error');
            return false;
          }
          const reason = $('#nomReason', body).value;
          let ok = 0;
          ids.forEach((id) => {
            try {
              S.nominate(id, reason);
              ok += 1;
            } catch (e) {
              toast(e.message, 'error');
            }
          });
          if (ok) {
            toast(`${ok} contestant${ok === 1 ? '' : 's'} moved to the Danger Zone.`, 'error');
            const names = ids.map((id) => S.c(id)?.name).filter(Boolean).join(', ');
            broadcast(`${names} — you are nominated for eviction. Face the House.`, 'alert');
          }
        },
      },
    ],
  });
}

function captainModal() {
  const list = S.activeContestants().slice().sort((a, b) => b.points - a.points);
  openModal({
    title: 'Appoint House Captain',
    desc: 'The Captain leads tasks, gains +0 points but cannot be nominated while in office.',
    body: `
      <div class="checks" id="capChecks">
        ${list
          .map(
            (c) => `<label class="check" data-id="${c.id}">
          <input type="radio" name="cap" value="${c.id}" ${c.isCaptain ? 'checked' : ''} />${a(c, 'sm')} ${esc(c.name)} · ${c.points} pts
        </label>`,
          )
          .join('')}
      </div>`,
    actions: [
      { label: 'Cancel', cls: 'ghost' },
      {
        label: 'Appoint',
        cls: 'primary',
        onClick: (body) => {
          const sel = $('input[name="cap"]:checked', body);
          if (!sel) {
            toast('Choose a contestant.', 'error');
            return false;
          }
          try {
            S.setCaptain(sel.value);
            const p = S.c(sel.value);
            toast(`${p.name} is the new House Captain.`, 'success');
            broadcast(`${p.name} is the new House Captain of the Tech House. Obey the Captain.`, 'accent');
          } catch (e) {
            fail(e);
            return false;
          }
        },
      },
    ],
  });
}

function immunityModal() {
  const list = S.activeContestants().filter((c) => !c.immunity);
  if (!list.length) {
    toast('Every active contestant already holds immunity.', 'error');
    return;
  }
  openModal({
    title: 'Grant immunity',
    desc: 'Immune contestants cannot be nominated and are removed from the Danger Zone.',
    body: `
      <div class="checks" id="immChecks">
        ${list.map((c) => `<label class="check" data-id="${c.id}"><input type="checkbox" value="${c.id}" />${a(c, 'sm')} ${esc(c.name)}${c.nomination ? ' · at risk' : ''}</label>`).join('')}
      </div>
      ${field('Reason (optional)', `<input class="input" id="immReason" placeholder="e.g. Won the immunity challenge" />`)}`,
    actions: [
      { label: 'Cancel', cls: 'ghost' },
      {
        label: 'Grant immunity',
        cls: 'success',
        onClick: (body) => {
          const ids = $$('input:checked', body).map((i) => i.value);
          if (!ids.length) {
            toast('Select at least one contestant.', 'error');
            return false;
          }
          const reason = $('#immReason', body).value;
          ids.forEach((id) => {
            try {
              S.grantImmunity(id, reason);
            } catch (e) {
              toast(e.message, 'error');
            }
          });
          const names = ids.map((id) => S.c(id)?.name).filter(Boolean).join(', ');
          toast(`Immunity granted to ${names}.`, 'success');
          broadcast(`${names} ${ids.length > 1 ? 'have' : 'has'} won immunity. The House cannot touch them.`, 'success');
        },
      },
    ],
  });
}

function evictModal(c) {
  openModal({
    title: c.immunity ? `Override immunity and evict ${c.name}?` : `Evict ${c.name}?`,
    desc: c.immunity
      ? 'This contestant holds immunity. Big Boss may override it, but the House record will show the override.'
      : 'Evicted contestants are removed from the active House and from the leaderboard. You can reinstate them later.',
    body: `
      <div class="row" style="gap:11px">${a(c, 'lg')}<div><div style="font-weight:600">${esc(c.name)}</div><div class="hint">Team ${esc(c.team)} · ${c.points} pts · rank #${S.ranked().findIndex((x) => x.id === c.id) + 1}</div></div></div>
      ${c.immunity ? `<div class="chip tone-accent" style="border-radius:8px;padding:8px 10px">${ico('shield', 14)} Immunity will be revoked on eviction.</div>` : ''}
      ${field('Eviction line', `<input class="input" id="evReason" value="Evicted by Big Boss" />`)}`,
    actions: [
      { label: 'Cancel', cls: 'ghost' },
      {
        label: c.immunity ? 'Override & evict' : 'Evict now',
        cls: 'danger',
        onClick: () => {
          try {
            S.evict(c.id, $('#evReason').value.trim() || 'Evicted by Big Boss');
            toast(`${c.name} has been evicted.`, 'error');
            broadcast(`${c.name}, the House has spoken. Please pack your bags and leave the Tech House.`, 'alert', 8000);
          } catch (e) {
            fail(e);
            return false;
          }
        },
      },
    ],
  });
}

function evictAllModal() {
  const dz = S.dangerZone();
  if (!dz.length) {
    toast('Nobody is in the Danger Zone.', 'error');
    return;
  }
  openModal({
    title: `Evict the Danger Zone?`,
    desc: `${dz.length} contestant${dz.length === 1 ? '' : 's'} will be evicted from the House.`,
    body: `<div class="checks">${dz.map((c) => `<span class="check">${a(c, 'sm')} ${esc(c.name)}</span>`).join('')}</div>`,
    actions: [
      { label: 'Cancel', cls: 'ghost' },
      {
        label: 'Evict all',
        cls: 'danger',
        onClick: () => {
          const names = dz.map((c) => c.name).join(', ');
          dz.forEach((c) => S.evict(c.id, 'Evicted by House vote'));
          toast(`${dz.length} contestant(s) evicted.`, 'error');
          broadcast(`${names} — the House has voted. You must leave the Tech House tonight.`, 'alert', 9000);
        },
      },
    ],
  });
}

function addTaskModal() {
  const list = S.activeContestants().slice().sort((a, b) => b.points - a.points);
  if (!list.length) {
    toast('No active contestants to assign tasks to.', 'error');
    return;
  }
  const presets = [
    ['Coding Sprint', 'Ship a working feature before the timer ends.', 50],
    ['Debug Hunt', 'Find and explain three bugs in the codebase.', 40],
    ['Pitch Battle', 'Present a product idea to the House in 3 minutes.', 35],
    ['Design Duel', 'Produce a minimalist UI for the given brief.', 30],
    ['Speed Quiz', 'Answer the quick-fire tech quiz.', 25],
  ];
  openModal({
    title: 'Assign a House task',
    desc: 'Selected contestants earn the task points when Big Boss marks it complete.',
    body: `
      <div class="row" style="gap:6px">
        ${presets.map(([t, , p]) => `<button class="btn sm" data-preset="${esc(t)}" data-preset-points="${p}">${esc(t)}</button>`).join('')}
      </div>
      ${field('Task title', `<input class="input" id="taskTitle" placeholder="e.g. Build the leaderboard UI" />`)}
      ${field('Description', `<textarea class="textarea" id="taskDesc" placeholder="What must the contestants deliver?"></textarea>`)}
      ${field('Points on completion', `<input class="input" id="taskPoints" type="number" value="25" min="0" step="5" />`)}
      ${field('Assign to', `<div class="checks" id="taskChecks">
        ${list.map((c) => `<label class="check" data-id="${c.id}"><input type="checkbox" value="${c.id}" />${a(c, 'sm')} ${esc(c.name)}</label>`).join('')}
      </div>`)}
      <div class="row" style="gap:4px">
        <button class="btn ghost sm" data-select="all">Select all</button>
        <button class="btn ghost sm" data-select="none">Clear</button>
      </div>`,
    actions: [
      { label: 'Cancel', cls: 'ghost' },
      {
        label: 'Assign task',
        cls: 'primary',
        onClick: (body) => {
          const ids = $$('input:checked', body).map((i) => i.value);
          try {
            const t = S.createTask({
              title: $('#taskTitle', body).value,
              description: $('#taskDesc', body).value,
              assignees: ids,
              points: $('#taskPoints', body).value,
            });
            toast(`Task "${t.title}" assigned to ${ids.length} contestant(s).`, 'success');
            broadcast(`New task: ${t.title}. Worth ${t.points} points each. Timer starts now.`, 'accent');
          } catch (e) {
            fail(e);
            return false;
          }
        },
      },
    ],
  });

  $$('[data-preset]').forEach((b) =>
    b.addEventListener('click', () => {
      $('#taskTitle').value = b.dataset.preset;
      $('#taskPoints').value = b.dataset.presetPoints;
    }),
  );
  $$('[data-select]').forEach((b) =>
    b.addEventListener('click', () => {
      const on = b.dataset.select === 'all';
      $$('#taskChecks input').forEach((i) => {
        i.checked = on;
        i.closest('.check').classList.toggle('on', on);
      });
    }),
  );
}

function announceModal() {
  openModal({
    title: 'Big Boss announcement',
    desc: 'Broadcast a message to every contestant in the House.',
    body: `
      ${field('Message', `<textarea class="textarea" id="annModalMsg" placeholder="Big Boss is watching…" style="min-height:88px"></textarea>`)}
      ${field('Tone', `<select class="select" id="annModalTone">
        <option value="accent">Highlight (gold)</option>
        <option value="info">Information (blue)</option>
        <option value="alert">Warning (red)</option>
        <option value="success">Good news (green)</option>
      </select>`)}`,
    actions: [
      { label: 'Cancel', cls: 'ghost' },
      {
        label: 'Broadcast',
        cls: 'primary',
        icon: 'megaphone',
        onClick: () => {
          try {
            const msg = $('#annModalMsg').value;
            const tone = $('#annModalTone').value;
            S.announce(msg, tone);
            broadcast(msg, tone, 9000);
            toast('Announcement broadcast to the House.', 'success');
            if (currentView === 'announcements' || currentView === 'overview') render();
          } catch (e) {
            fail(e);
            return false;
          }
        },
      },
    ],
  });
}

/* ============================================================
   Event delegation
   ============================================================ */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action], [data-view]');
  if (!el) return;

  if (el.dataset.view) {
    setView(el.dataset.view);
    return;
  }

  const id = el.dataset.id;
  const act = el.dataset.action;
  const person = id ? S.c(id) : null;

  try {
    switch (act) {
      /* Points */
      case 'points-quick': {
        if (!person) return;
        const delta = Number(el.dataset.delta);
        S.adjustPoints(person.id, delta, 'Quick adjustment');
        toast(`${delta > 0 ? '+' : ''}${delta} to ${person.name} · now ${person.points} pts`, delta > 0 ? 'success' : 'default');
        break;
      }
      case 'points-modal':
        if (person) pointsModal(person);
        break;

      /* Contestants */
      case 'add-contestant':
        addContestantModal();
        break;
      case 'edit-contestant':
        if (person) editContestantModal(person);
        break;
      case 'remove-contestant':
        if (person)
          openModal({
            title: `Delete ${person.name}?`,
            desc: 'This permanently removes the record from the House. This cannot be undone.',
            body: '',
            actions: [
              { label: 'Cancel', cls: 'ghost' },
              {
                label: 'Delete permanently',
                cls: 'danger',
                onClick: () => {
                  S.removeContestant(person.id);
                  toast(`${person.name} deleted.`, 'error');
                },
              },
            ],
          });
        break;
      case 'reinstate':
        if (person) {
          S.reinstate(person.id);
          toast(`${person.name} is back in the House.`, 'success');
          broadcast(`${person.name} has been reinstated into the Tech House by Big Boss.`, 'info');
        }
        break;

      /* Captaincy */
      case 'set-captain':
        if (person) {
          S.setCaptain(person.id);
          toast(`${person.name} is the new House Captain.`, 'success');
          broadcast(`${person.name} is the new House Captain of the Tech House.`, 'accent');
        }
        break;
      case 'revoke-captain':
        S.revokeCaptain();
        toast('Captaincy is now vacant.', 'default');
        break;
      case 'captain-modal':
        captainModal();
        break;

      /* Immunity */
      case 'immunity-on':
        if (person) {
          S.grantImmunity(person.id, 'Granted by Big Boss');
          toast(`${person.name} is now immune.`, 'success');
        }
        break;
      case 'immunity-off':
        if (person) {
          S.revokeImmunity(person.id);
          toast(`Immunity revoked for ${person.name}.`, 'default');
        }
        break;
      case 'immunity-modal':
        immunityModal();
        break;

      /* Nominations */
      case 'nominate':
        if (person) {
          S.nominate(person.id, 'Nominated by Big Boss');
          toast(`${person.name} is in the Danger Zone.`, 'error');
          broadcast(`${person.name} — you have been nominated for eviction.`, 'alert');
        }
        break;
      case 'nominate-modal':
        nominateModal();
        break;
      case 'withdraw-nomination':
        if (person) {
          S.withdrawNomination(person.id);
          toast(`Nomination withdrawn for ${person.name}.`);
        }
        break;
      case 'clear-nominations':
        openModal({
          title: 'Clear the Danger Zone?',
          desc: 'All current nominations will be withdrawn.',
          body: '',
          actions: [
            { label: 'Cancel', cls: 'ghost' },
            { label: 'Clear nominations', cls: 'danger', onClick: () => { S.clearNominations(); toast('Danger Zone cleared.'); } },
          ],
        });
        break;
      case 'next-round':
        S.nextNominationRound();
        toast(`Round ${S.getState().nominationRound} nominations opened.`, 'success');
        break;
      case 'nominate-selected': {
        const ids = $$('#nominateChecks input:checked').map((i) => i.value);
        if (!ids.length) {
          toast('Select at least one contestant.', 'error');
          break;
        }
        const reason = $('#nominateReason')?.value || '';
        let n = 0;
        ids.forEach((cid) => {
          try {
            S.nominate(cid, reason);
            n += 1;
          } catch (err) {
            toast(err.message, 'error');
          }
        });
        if (n) {
          toast(`${n} contestant(s) nominated.`, 'error');
          const names = ids.map((cid) => S.c(cid)?.name).filter(Boolean).join(', ');
          broadcast(`${names} — you are nominated for eviction this round.`, 'alert');
        }
        break;
      }

      /* Evictions */
      case 'evict-modal':
        if (person) evictModal(person);
        break;
      case 'evict-all-modal':
        evictAllModal();
        break;

      /* Tasks */
      case 'add-task':
        addTaskModal();
        break;
      case 'task-start':
        S.startTask(id);
        toast('Task marked in progress.', 'info');
        break;
      case 'task-pending':
        S.setTaskStatus(id, 'pending');
        toast('Task moved back to pending.');
        break;
      case 'task-complete': {
        S.setTaskStatus(id, 'completed');
        toast('Task completed — points awarded.', 'success');
        const t = S.getState().tasks.find((x) => x.id === id);
        if (t) broadcast(`Task "${t.title}" is complete. ${t.points} points awarded to each winner.`, 'success');
        break;
      }
      case 'task-reopen':
        S.setTaskStatus(id, 'active');
        toast('Task reopened.', 'info');
        break;
      case 'task-fail':
        S.setTaskStatus(id, 'failed');
        toast('Task marked failed.', 'error');
        break;
      case 'task-delete':
        S.deleteTask(id);
        toast('Task deleted.');
        break;

      /* Timer */
      case 'timer-start':
        S.startTimer();
        toast('Countdown started.', 'info');
        break;
      case 'timer-pause':
        S.pauseTimer();
        toast(`Countdown paused at ${S.fmtClock(S.remainingSeconds())}.`);
        break;
      case 'timer-reset':
        S.resetTimer();
        toast('Countdown reset.', 'info');
        break;
      case 'timer-preset':
        S.setTimerDuration(Number(el.dataset.sec));
        toast(`Timer set to ${S.fmtClock(Number(el.dataset.sec))}.`, 'info');
        break;
      case 'timer-custom':
        openModal({
          title: 'Set custom timer',
          desc: 'Enter the countdown length in minutes and seconds.',
          body: `<div class="row">
            ${field('Minutes', `<input class="input" id="tMin" type="number" min="0" value="10" />`)}
            ${field('Seconds', `<input class="input" id="tSec" type="number" min="0" max="59" value="0" />`)}
          </div>`,
          actions: [
            { label: 'Cancel', cls: 'ghost' },
            {
              label: 'Set timer',
              cls: 'primary',
              onClick: () => {
                const total = Number($('#tMin').value || 0) * 60 + Number($('#tSec').value || 0);
                try {
                  S.setTimerDuration(total);
                  toast(`Timer set to ${S.fmtClock(total)}.`, 'success');
                } catch (e) {
                  fail(e);
                  return false;
                }
              },
            },
          ],
        });
        break;
      case 'timer-label': {
        const v = $('#timerLabel')?.value || '';
        S.getState().timer.label = v;
        S.log('timer', `Timer label set to "${v}".`);
        document.dispatchEvent(new CustomEvent(S.EVT));
        toast('Timer label updated.');
        break;
      }

      /* Announcements */
      case 'send-announcement': {
        try {
          const msg = $('#annMsg').value;
          const tone = $('#annTone').value;
          S.announce(msg, tone);
          broadcast(msg, tone, 9000);
          toast('Announcement broadcast.', 'success');
        } catch (err) {
          fail(err);
        }
        break;
      }
      case 'quick-announcement':
        S.announce(el.dataset.msg, 'info');
        broadcast(el.dataset.msg, 'info', 7000);
        toast('Quick announcement sent.', 'success');
        break;
      case 'replay-announcement': {
        const an = S.getState().announcements.find((x) => x.id === id);
        if (an) broadcast(an.message, an.tone, 9000);
        break;
      }
      case 'delete-announcement':
        S.deleteAnnouncement(id);
        toast('Announcement deleted.');
        break;
      case 'clear-log':
        openModal({
          title: 'Clear activity log?',
          desc: 'The full House event history will be erased.',
          body: '',
          actions: [
            { label: 'Cancel', cls: 'ghost' },
            {
              label: 'Clear log',
              cls: 'danger',
              onClick: () => {
                S.getState().log = [];
                document.dispatchEvent(new CustomEvent(S.EVT));
                toast('Activity log cleared.');
              },
            },
          ],
        });
        break;

      /* Settings */
      case 'save-house':
        S.getState().house.name = $('#setHouseName').value.trim() || 'Tech House';
        S.getState().house.season = Math.max(1, Number($('#setSeason').value) || 1);
        S.log('session', 'House configuration updated.');
        document.dispatchEvent(new CustomEvent(S.EVT));
        toast('Configuration saved.', 'success');
        break;
      case 'advance-day':
        S.advanceDay();
        toast(`Day ${S.getState().house.day} has begun.`, 'success');
        break;
      case 'export': {
        const blob = new Blob([S.exportJSON()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `command-centre-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast('Backup downloaded.', 'success');
        break;
      }
      case 'import': {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.addEventListener('change', async () => {
          const file = input.files[0];
          if (!file) return;
          try {
            S.importJSON(await file.text());
            toast('House data restored.', 'success');
          } catch (err) {
            fail(err);
          }
        });
        input.click();
        break;
      }
      case 'reset-house':
        openModal({
          title: 'Reset to demo season?',
          desc: 'All current contestants, tasks and history will be replaced by a fresh 12-contestant season.',
          body: '',
          actions: [
            { label: 'Cancel', cls: 'ghost' },
            { label: 'Reset House', cls: 'danger', onClick: () => { S.resetAll(); toast('House reset to demo season.', 'success'); } },
          ],
        });
        break;
      case 'clear-house':
        openModal({
          title: 'Empty the House?',
          desc: 'Every contestant, task and announcement will be deleted.',
          body: '',
          actions: [
            { label: 'Cancel', cls: 'ghost' },
            { label: 'Empty House', cls: 'danger', onClick: () => { S.clearHouse(); toast('The House is empty.', 'error'); } },
          ],
        });
        break;
      default:
        break;
    }
  } catch (err) {
    fail(err);
  }
});

/* Checkbox chips */
document.addEventListener('change', (e) => {
  if (e.target.matches('.check input')) e.target.closest('.check').classList.toggle('on', e.target.checked);
});

/* Contestant filters */
document.addEventListener('input', (e) => {
  if (e.target.id === 'cSearch') {
    contestantFilter.q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const el = $('#cSearch');
    if (el) {
      el.focus();
      el.setSelectionRange(pos, pos);
    }
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'teamFilter') {
    contestantFilter.team = e.target.value;
    render();
  }
});
document.addEventListener('click', (e) => {
  const seg = e.target.closest('#statusSeg button');
  if (seg) {
    contestantFilter.status = seg.dataset.status;
    render();
  }
  const ts = e.target.closest('#taskSeg button');
  if (ts) {
    taskFilter = ts.dataset.status;
    render();
  }
  const bs = e.target.closest('#boardSeg button');
  if (bs) {
    boardScope = bs.dataset.team;
    render();
  }
  const ls = e.target.closest('#logSeg button');
  if (ls) {
    logFilter = ls.dataset.type;
    render();
  }
});

/* ============================================================
   Keyboard shortcuts
   ============================================================ */

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideBroadcast();
    closeModal();
    return;
  }
  const typing = /input|textarea|select/i.test(e.target.tagName);
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

  const views = ['overview', 'contestants', 'tasks', 'leaderboard', 'danger', 'announcements', 'evictions', 'activity', 'settings'];
  const n = Number(e.key);
  if (n >= 1 && n <= 9) {
    setView(views[n - 1]);
    return;
  }
  if (e.key.toLowerCase() === 'n') announceModal();
  if (e.key.toLowerCase() === 't') {
    S.getState().timer.running ? S.pauseTimer() : S.startTimer();
  }
});

$('#btnAnnounce').addEventListener('click', announceModal);
$('#btnShortcuts').addEventListener('click', () => setView('settings'));

/* ============================================================
   Boot
   ============================================================ */

S.init();
S.subscribe(() => render());
setView(location.hash.slice(1) && VIEW_META[location.hash.slice(1)] ? location.hash.slice(1) : 'overview');

// Welcome broadcast on a fresh session
if (S.getState().log.length <= 1) {
  setTimeout(() => broadcast('Welcome to the Tech House. Big Boss is watching every move.', 'accent', 7000), 700);
}

window.addEventListener('beforeunload', () => S.tickTimer());
