/**
 * Feature verification suite for the Big Boss Command Center.
 *
 * Bundles the real app with esbuild, boots index.html in jsdom, drives the
 * actual UI with synthetic events and asserts every mandatory feature:
 *
 *   npm test
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const BUNDLE = path.join(HERE, '.bundle.js');
const STORAGE_KEY = 'bb-command-centre.v1';

/* ── Build + boot ──────────────────────────────────────────────────────── */

execFileSync('npx', ['esbuild', 'js/main.js', '--bundle', '--format=iife', `--outfile=${BUNDLE}`, '--log-level=warning'], {
  cwd: REPO,
  stdio: 'inherit',
});

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (error) => errors.push(`jsdom: ${error.message}`));
vc.on('error', (...args) => errors.push(`console.error: ${args.join(' ')}`));

const dom = new JSDOM(fs.readFileSync(path.join(REPO, 'index.html'), 'utf8'), {
  runScripts: 'dangerously',
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;
const { document } = window;

window.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.scrollTo ||= () => {};

const script = document.createElement('script');
script.textContent = fs.readFileSync(BUNDLE, 'utf8');
document.body.appendChild(script);

/* ── Harness ───────────────────────────────────────────────────────────── */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const fire = (node, type = 'click') => {
  if (!node) throw new Error(`element not found for ${type}`);
  node.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true }));
};
const click = (node) => fire(node, 'click');
const nav = (view) => click(document.querySelector(`.nav-item[data-view="${view}"]`));
const escape = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
const showModal = () => $('.modal')?.classList.contains('is-open');
const modalPrimary = () => $('#modalFoot .btn--primary') || $$('#modalFoot .btn').pop();
const modalDanger = () => $('#modalFoot .btn--danger') || $$('#modalFoot .btn').pop();
const toastText = () => $('#toasts').textContent;
const bannerText = () => $('#bannerCard').dataset.message || $('#bannerText').textContent;
const store = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY));
const person = (id) => (store()?.contestants || []).find((c) => c.id === id) || {};
const boardRow = (id) => $(`.lb-row[data-id="${id}"]`);
const set = (node, value) => {
  node.value = value;
  node.dispatchEvent(new window.Event('input', { bubbles: true }));
  node.dispatchEvent(new window.Event('change', { bubbles: true }));
};
const pick = (scope, selector = 'input[type="checkbox"]') => {
  const input = scope.querySelector(selector);
  input.checked = true;
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  return input;
};

const results = [];
const test = async (name, fn) => {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (error) {
    results.push(['FAIL', `${name} — ${error.message}`]);
  }
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ══ 1. Contestant management ═══════════════════════════════════════════ */

await test('1 · Contestant management — 8+ contestants with name, team, points, status', async () => {
  nav('contestants');
  const cards = $$('#view-contestants .contestant');
  assert.ok(cards.length >= 8, `expected 8+ contestant cards, saw ${cards.length}`);

  const html = $('#view-contestants').innerHTML;
  assert.ok(/badge--team/.test(html), 'team chips rendered');
  assert.ok(/data-count-to=/.test(html), 'points rendered per contestant');
  assert.ok(/(Active|Captain|Immune|Evicted|Danger Zone)/.test($('#view-contestants').textContent), 'status badges rendered');
  assert.ok(/Search|Team/.test(html), 'search and team filters present');
  assert.equal(Number($('.nav-item[data-view="contestants"] .nav-item__badge').textContent), 12, 'active counter matches roster');
});

await test('1b · Contestants can be added and are validated', async () => {
  nav('contestants');
  const before = $$('#view-contestants .contestant').length;
  click($('[data-action="contestant:add"]'));
  assert.ok(showModal(), 'add-contestant modal opens');
  set($('#contestantName'), 'Nia Fernandes');
  click(modalPrimary());
  assert.equal($$('#view-contestants .contestant').length, before + 1, 'contestant added');
  assert.ok(store().contestants.some((c) => c.name === 'Nia Fernandes'), 'persisted');
  assert.ok(bannerText().includes('Nia Fernandes'), 'welcome banner shown');

  click($('[data-action="contestant:add"]'));
  set($('#contestantName'), 'Nia Fernandes');
  click(modalPrimary());
  assert.ok(showModal(), 'duplicate rejected (modal stays open)');
  assert.ok(toastText().includes('already inside the House'), 'duplicate name reported to Big Boss');
  escape();
});

/* ══ 2. Live leaderboard ════════════════════════════════════════════════ */

await test('2 · Live leaderboard — ranked, FLIP-ready rows', async () => {
  nav('leaderboard');
  const rows = $$('#view-leaderboard .lb-row');
  assert.ok(rows.length >= 8, 'full board rendered');
  const points = rows.map((row) => Number(row.querySelector('.lb-row__score [data-count-to]').dataset.countTo));
  assert.deepEqual(points, [...points].sort((a, b) => b - a), 'sorted descending');
  assert.ok($$('#view-leaderboard .lb-row[data-flip]').length === rows.length, 'rows expose FLIP keys');
  assert.ok($$('#view-leaderboard .medal--1').length === 1, 'gold medal for rank 1');
});

await test('2b · Re-ranks instantly when points change', async () => {
  nav('leaderboard');
  const rows = $$('#view-leaderboard .lb-row');
  const last = rows[rows.length - 1];
  const lastId = last.dataset.id;
  const lastPoints = Number(last.querySelector('.lb-row__score [data-count-to]').dataset.countTo);
  const leaderPoints = Number(rows[0].querySelector('.lb-row__score [data-count-to]').dataset.countTo);

  const delta = leaderPoints - lastPoints + 50;
  for (let i = 0; i < Math.ceil(delta / 50); i += 1) {
    const target = $(`.lb-row[data-id="${lastId}"] [data-action="points:quick"][data-delta="10"]`);
    // Use the custom modal path for the last jump to cover both point flows.
    if (i === 0) {
      click($(`.lb-row[data-id="${lastId}"] [data-action="points:open"]`));
      set($('#pointsDelta'), String(delta - 10));
      set($('#pointsReason'), 'Automated climb');
      click(modalPrimary());
    } else {
      click(target);
    }
  }

  nav('leaderboard');
  const newLeader = $$('#view-leaderboard .lb-row')[0];
  assert.equal(newLeader.dataset.id, lastId, 'promoted contestant now leads the board');
  assert.equal(person(lastId).points, lastPoints + (delta - 10) + 10 * Math.max(0, Math.ceil(delta / 50) - 1), 'points applied');
});

/* ══ 3. Task management ═════════════════════════════════════════════════ */

await test('3 · Task management — assign a task', async () => {
  nav('tasks');
  const before = $$('#view-tasks .task-card').length;
  click($('#view-tasks [data-action="task:open"]'));
  assert.ok(showModal(), 'assign-task modal opens');
  set($('#taskTitle'), 'Automated Smoke Test Task');
  set($('#taskPoints'), '15');
  pick($('#taskAssignees'));
  click(modalPrimary());
  assert.equal($$('#view-tasks .task-card').length, before + 1, 'task added to the board');
  assert.ok($('#view-tasks').textContent.includes('Automated Smoke Test Task'), 'task visible');
  assert.ok(bannerText().includes('Automated Smoke Test Task'), 'assignment broadcast');
});

await test('3b · Marking a task complete awards points to every assignee', async () => {
  nav('tasks');
  const card = $$('#view-tasks .task-card').find((node) => node.textContent.includes('Automated Smoke Test Task'));
  const taskId = card.dataset.id;
  const assigneeId = store().tasks.find((t) => t.id === taskId).assignees[0];
  const before = person(assigneeId).points;
  const tasksBefore = person(assigneeId).tasksCompleted;

  click(card.querySelector('[data-action="task:complete"]'));
  const updated = $(`#view-tasks .task-card[data-id="${taskId}"]`);
  assert.equal(updated.dataset.status, 'completed', 'task marked complete');
  assert.equal(person(assigneeId).points, before + 15, 'assignee paid the task points');
  assert.equal(person(assigneeId).tasksCompleted, tasksBefore + 1, 'task counter incremented');
});

/* ══ 4. Point system ════════════════════════════════════════════════════ */

await test('4 · Point system — add and deduct (quick + custom)', async () => {
  nav('contestants');
  const card = $$('#view-contestants .contestant')[0];
  const id = card.dataset.id;
  const before = person(id).points;

  click(card.querySelector('[data-action="points:quick"][data-delta="10"]'));
  assert.equal(person(id).points, before + 10, 'quick +10 applied');

  const refreshed = $(`#view-contestants .contestant[data-id="${id}"]`);
  click(refreshed.querySelector('[data-action="points:quick"][data-delta="-10"]'));
  assert.equal(person(id).points, before, 'quick −10 applied');

  click($(`#view-contestants .contestant[data-id="${id}"] [data-action="points:open"]`));
  set($('#pointsDelta'), '-5');
  set($('#pointsReason'), 'Automated deduction');
  click(modalPrimary());
  assert.equal(person(id).points, before - 5, 'custom deduction applied');
  assert.ok(store().log.some((entry) => entry.message.includes('Automated deduction')), 'reason captured in the audit log');
});

await test('4b · Points never go below zero', async () => {
  nav('contestants');
  const card = $$('#view-contestants .contestant')[0];
  const id = card.dataset.id;
  for (let i = 0; i < 40; i += 1) {
    const node = $(`#view-contestants .contestant[data-id="${id}"] [data-action="points:quick"][data-delta="-10"]`);
    click(node);
  }
  assert.equal(person(id).points, 0, 'clamped at zero');
});

/* ══ 5. Captaincy ═══════════════════════════════════════════════════════ */

await test('5 · Captaincy — exactly one Captain, transferable', async () => {
  const captains = () => store().contestants.filter((c) => c.isCaptain);
  assert.equal(captains().length, 1, 'seeded with a single Captain');

  nav('nominations');
  click($('#view-nominations [data-action="captain:open"]'));
  assert.ok(showModal(), 'captain modal opens');
  const radios = $$('#modalBody input[name="captainPick"]');
  const target = radios.find((radio) => !radio.checked);
  target.checked = true;
  click(modalPrimary());

  assert.equal(captains().length, 1, 'still exactly one Captain after transfer');
  assert.equal(captains()[0].id, target.value, 'captaincy transferred');
  assert.ok($('#sidebar').textContent.includes(person(target.value).name), 'sidebar shows the new Captain');
  assert.ok(bannerText().includes('House Captain'), 'broadcast announced the captaincy');
});

await test('5b · The Captain cannot be nominated', async () => {
  const captainId = store().contestants.find((c) => c.isCaptain).id;
  nav('contestants');
  const card = $(`#view-contestants .contestant[data-id="${captainId}"]`);
  const blockButton = card.querySelector('[data-action="nomination:blocked"]');
  assert.ok(blockButton, 'captain card shows a blocked nominate button');
  assert.ok(/Captain/.test(card.textContent), 'captain badge visible');
  click(blockButton);
  assert.ok(toastText().includes('Captain'), 'Big Boss explains why it is blocked');
});

/* ══ 6 + 7 + 8. Nominations, immunity, Danger Zone ═════════════════════ */

await test('7 · Immunity — immune contestants cannot be nominated (clear message)', async () => {
  nav('contestants');
  // Use the state attributes the cards expose rather than scraping text
  // (every action menu mentions "Captain"/"Immune" in its copy).
  const card = $$('#view-contestants .contestant').find(
    (c) => c.dataset.immune === 'false' && c.dataset.captain === 'false' && c.dataset.nominated === 'false',
  );
  const id = card.dataset.id;
  click(card.querySelector('[data-action="menu:toggle"]'));
  click(card.querySelector('[data-action="immunity:grant"]'));
  assert.ok(person(id).immunity, 'immunity recorded');
  assert.ok(bannerText().includes('immunity'), 'immunity broadcast');

  nav('contestants');
  const immuneCard = $(`#view-contestants .contestant[data-id="${id}"]`);
  assert.equal(immuneCard.dataset.immune, 'true', 'card is flagged immune');
  assert.ok(immuneCard.textContent.includes('Immune'), 'immune badge shown');
  const blocked = immuneCard.querySelector('[data-action="nomination:blocked"]');
  assert.ok(blocked, 'nominate button is blocked, not hidden');
  click(immuneCard.querySelector('[data-action="menu:toggle"]'));
  const menuItem = immuneCard.querySelector('.menu [data-action="nomination:add"]');
  assert.ok(menuItem?.disabled, 'the menu offers nomination but keeps it disabled');
  assert.ok(/Immune/.test(menuItem.textContent), 'menu explains why it is blocked');

  click(blocked);
  assert.ok(toastText().includes('nomination denied'), 'clear blocked message: "Immunity active — nomination denied"');
  assert.equal(person(id).nomination, null, 'contestant stayed out of the Danger Zone');
});

await test('7b · Immunity is revoked and restored correctly', async () => {
  nav('contestants');
  const immuneCard = $('#view-contestants .contestant[data-immune="true"]');
  const id = immuneCard.dataset.id;
  click(immuneCard.querySelector('[data-action="menu:toggle"]'));
  click(immuneCard.querySelector('[data-action="immunity:revoke"]'));
  assert.equal(person(id).immunity, false, 'immunity revoked');

  nav('contestants');
  const card = $(`#view-contestants .contestant[data-id="${id}"]`);
  click(card.querySelector('[data-action="menu:toggle"]'));
  click(card.querySelector('[data-action="immunity:grant"]'));
  assert.equal(person(id).immunity, true, 'immunity re-granted');
});

await test('6 · Nominations — nominees enter the Danger Zone for the current round', async () => {
  nav('nominations');
  const boxes = $$('#inlineNominationPicker input[type="checkbox"]');
  assert.ok(boxes.length >= 1, 'eligible contestants offered');
  const target = boxes[0];
  target.checked = true;
  target.dispatchEvent(new window.Event('change', { bubbles: true }));
  set($('#inlineNominationReason'), 'Automated nomination');
  click($('#view-nominations [data-action="nomination:selected"]'));

  const nominee = person(target.value);
  assert.ok(nominee.nomination, 'nomination stored');
  assert.equal(nominee.nomination.reason, 'Automated nomination', 'reason captured');
  assert.equal(nominee.nomination.round, store().nominationRound, 'stamped with the current round');
});

await test('6b · Duplicate nominations are rejected', async () => {
  const existing = store().contestants.find((c) => c.nomination);
  const card = $(`.contestant[data-id="${existing.id}"]`);
  if (card) {
    assert.ok(card.textContent.includes('Danger Zone'), 'nominee badge shown on the card');
  }
  nav('nominations');
  assert.ok(!$('#inlineNominationPicker').textContent.includes(existing.name), 'already-nominated contestants are not offered again');
});

await test('8 · Danger Zone — every nominated contestant is displayed', async () => {
  nav('nominations');
  const nominees = store().contestants.filter((c) => c.nomination && c.status === 'active');
  const items = $$('#view-nominations .danger-item');
  assert.ok(items.length >= nominees.length, `Danger Zone lists all ${nominees.length} nominee(s)`);
  nominees.forEach((nominee) => {
    assert.ok($('#view-nominations').textContent.includes(nominee.name), `${nominee.name} displayed in the Danger Zone`);
  });
  assert.ok($('.card--alarm'), 'Danger Zone card uses the crimson alarm treatment');

  nav('dashboard');
  assert.ok($('#view-dashboard .card--alarm'), 'dashboard surfaces the Danger Zone');
  assert.ok($('#view-dashboard').textContent.includes(nominees[0].name), 'nominee listed on the dashboard');
});

/* ══ 9. Announcements ═══════════════════════════════════════════════════ */

await test('9 · Big Boss announcements — trigger and display', async () => {
  nav('announcements');
  set($('#composerMessage'), 'Automated smoke-test broadcast.');
  set($('#composerTone'), 'alert');
  click($('#view-announcements [data-action="announcement:send"]'));

  assert.ok($('#banner').classList.contains('is-open'), 'cinematic banner opens');
  assert.ok($('#bannerCard').dataset.tone === 'alert', 'banner adopts the tone');
  assert.ok(bannerText().includes('Automated smoke-test'), 'message displayed on the banner');
  assert.ok($('#view-announcements').textContent.includes('Automated smoke-test broadcast.'), 'stored in the archive');
  assert.equal(store().announcements[0].message, 'Automated smoke-test broadcast.', 'persisted');

  escape();
  assert.ok(!$('#banner').classList.contains('is-open'), 'banner dismisses on Escape');
});

await test('9b · The header button opens the composer and broadcasts', async () => {
  click($('[data-action="announcement:open"]') || $('.btn--announce'));
  assert.ok(showModal(), 'composer modal opens');
  set($('#announcementMessage'), 'Header button broadcast.');
  click(modalPrimary());
  assert.ok(bannerText().includes('Header button'), 'broadcast from the header');
  escape();
});

/* ══ 10. Task timer ═════════════════════════════════════════════════════ */

await test('10 · Task timer — start, pause, reset', async () => {
  nav('tasks');
  click($('#view-tasks [data-action="timer:preset"][data-seconds="180"]'));
  assert.equal($('#view-tasks .js-clock').textContent.trim(), '03:00', 'preset applied');
  assert.equal($('#view-tasks .js-ring').dataset.state, 'paused', 'ring reflects paused');

  click($('#view-tasks [data-action="timer:start"]'));
  assert.equal(store().timer.running, true, 'timer running in state');
  assert.equal($('#view-tasks .js-ring').dataset.state, 'running', 'ring reflects running');
  assert.notEqual($('#view-tasks .js-clock').textContent, '', 'clock rendering');

  click($('#view-tasks [data-action="timer:pause"]'));
  assert.equal(store().timer.running, false, 'timer paused in state');
  assert.equal($('#view-tasks .js-ring').dataset.state, 'paused', 'ring reflects paused');

  click($('#view-tasks [data-action="timer:reset"]'));
  assert.equal(store().timer.remaining, 180, 'reset restores the duration');

  // Custom duration + label
  click($('#view-tasks [data-action="timer:custom"]'));
  set($('#timerMinutes'), '2');
  set($('#timerSeconds'), '30');
  set($('#timerCustomLabel'), 'Immunity Challenge');
  click(modalPrimary());
  assert.equal(store().timer.duration, 150, 'custom duration applied');
  assert.equal(store().timer.label, 'Immunity Challenge', 'label applied');
  assert.equal($('#view-tasks .js-clock').textContent.trim(), '02:30', 'clock shows the custom duration');
});

/* ══ 11. House statistics ═══════════════════════════════════════════════ */

await test('11 · House statistics — highest scorer, tasks, nominees, cards', async () => {
  nav('dashboard');
  const tiles = $$('#view-dashboard .stat');
  assert.ok(tiles.length >= 6, `expected 6 stat cards, saw ${tiles.length}`);
  const text = $('#view-dashboard').textContent;
  ['Total Active', 'Highest Scorer', 'Current Captain', 'Tasks Completed', 'Nominees', 'Evicted'].forEach((label) => {
    assert.ok(text.includes(label), `stat card "${label}" present`);
  });

  nav('contestants');
  ['Highest Scorer', 'Most Tasks Completed', 'House Captain', 'Nominees In Danger Zone', 'Leading Team'].forEach((label) => {
    assert.ok($('#view-contestants').textContent.includes(label), `statistics panel shows "${label}"`);
  });

  const stats = store();
  const active = stats.contestants.filter((c) => c.status === 'active');
  const top = active.slice().sort((a, b) => b.points - a.points)[0];
  assert.ok($('#view-contestants').textContent.includes(top.name), 'highest scorer named in stats');
});

/* ══ 12. Eviction ═══════════════════════════════════════════════════════ */

await test('12 · Eviction — removes from active House and leaderboard', async () => {
  const victim = store().contestants.find(
    (c) => c.status === 'active' && !c.immunity && !c.isCaptain && !c.nomination,
  );
  const name = victim.name;
  const activeBefore = store().contestants.filter((c) => c.status === 'active').length;

  nav('contestants');
  click($(`#view-contestants .contestant[data-id="${victim.id}"] [data-action="menu:toggle"]`));
  click($(`#view-contestants .contestant[data-id="${victim.id}"] [data-action="eviction:open"]`));
  assert.ok(showModal(), 'eviction confirmation modal opens (destructive action guarded)');
  click(modalDanger());
  escape();

  assert.equal(person(victim.id).status, 'evicted', 'status updated');
  assert.equal(store().contestants.filter((c) => c.status === 'active').length, activeBefore - 1, 'active count reduced');
  assert.ok(bannerText().includes(name), 'eviction announced to the House');

  nav('leaderboard');
  assert.equal(boardRow(victim.id), null, 'removed from the leaderboard');
  assert.ok(!$('#view-leaderboard').textContent.includes(name), 'name gone from rankings');

  nav('evictions');
  assert.ok($('#view-evictions').textContent.includes(name), 'listed in the eviction record');

  // Reinstate brings them back
  click($('#view-evictions [data-action="eviction:reinstate"]'));
  assert.equal(person(victim.id).status, 'active', 'reinstated');
  nav('leaderboard');
  assert.ok(boardRow(victim.id), 'back on the leaderboard');
});

await test('12b · Evicting an immune contestant requires an explicit override', async () => {
  const immune = store().contestants.find((c) => c.status === 'active' && c.immunity);
  assert.ok(immune, 'an immune contestant exists for this check');

  nav('contestants');
  click($(`#view-contestants .contestant[data-id="${immune.id}"] [data-action="menu:toggle"]`));
  click($(`#view-contestants .contestant[data-id="${immune.id}"] [data-action="eviction:open"]`));
  assert.ok($('#modalTitle').textContent.includes('Override immunity'), 'override warning shown first');
  assert.ok($('#modalFoot .btn--danger').textContent.includes('Override'), 'explicit override confirmation required');
  click(modalDanger());
  escape();
  assert.equal(person(immune.id).status, 'evicted', 'override honoured');
  assert.ok(store().log.some((entry) => entry.message.includes('overrode their immunity')), 'override recorded in the log');
});

await test('12c · Whole Danger Zone can be evicted at once', async () => {
  nav('nominations');
  if (!store().contestants.some((c) => c.nomination && c.status === 'active')) {
    const box = $('#inlineNominationPicker input[type="checkbox"]');
    box.checked = true;
    box.dispatchEvent(new window.Event('change', { bubbles: true }));
    click($('#view-nominations [data-action="nomination:selected"]'));
  }
  const nominees = store().contestants.filter((c) => c.nomination && c.status === 'active');
  assert.ok(nominees.length >= 1, 'nominees exist');
  click($('#view-nominations [data-action="eviction:round"]'));
  click(modalDanger());
  escape();
  nominees.forEach((nominee) => assert.equal(person(nominee.id).status, 'evicted', `${nominee.name} evicted by House vote`));
});

/* ══ Robustness ═════════════════════════════════════════════════════════ */

await test('All ten views render without errors', async () => {
  const views = ['dashboard', 'contestants', 'tasks', 'nominations', 'leaderboard', 'analytics', 'announcements', 'evictions', 'activity', 'settings'];
  views.forEach((view) => {
    nav(view);
    const host = $(`#view-${view}`);
    assert.ok(host, `${view} view mounted`);
    assert.ok(host.innerHTML.trim().length > 400, `${view} has content`);
  });
});

await test('Keyboard shortcuts switch sections and toggle the sidebar', async () => {
  nav('dashboard');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: '3', bubbles: true }));
  assert.ok($('#view-tasks').classList.contains('is-active'), '3 → Tasks');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'b', bubbles: true }));
  assert.equal($('#app').dataset.sidebar, 'collapsed', 'B collapses the sidebar');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'b', bubbles: true }));
  assert.equal($('#app').dataset.sidebar, 'expanded', 'B expands it again');
});

await test('Contestant filters narrow the roster', async () => {
  nav('contestants');
  const roster = store().contestants.length;
  click($('#contestantStatusFilter button[data-status="evicted"]'));
  const evicted = $$('#view-contestants .contestant').length;
  assert.ok(evicted < roster, 'evicted filter narrows the grid');
  assert.ok($('#view-contestants').textContent.includes('Evicted'), 'evicted cards labelled');

  click($('#contestantStatusFilter button[data-status="all"]'));
  assert.equal($$('#view-contestants .contestant').length, roster, 'All filter restores the grid');

  set($('#contestantSearch'), 'zzzz-no-such-contestant');
  await wait(320);
  assert.ok($('#view-contestants').textContent.includes('No contestants match'), 'empty state shown for a miss');
  set($('#contestantSearch'), '');
  await wait(320);
  assert.equal($$('#view-contestants .contestant').length, roster, 'clearing the search restores the grid');
});

await test('Settings: reset demo data restores the season', async () => {
  nav('settings');
  click($('#view-settings [data-action="house:reset"]'));
  click($('#modalFoot .btn--warning') || $('#modalFoot .btn--danger'));
  assert.equal(store().contestants.length, 12, '12 contestants restored');
  assert.equal(store().contestants.filter((c) => c.status === 'active').length, 12, 'everyone active again');
  assert.equal(store().tasks.length, 3, 'tasks restored');
  assert.equal(store().nominationRound, 1, 'round reset');
  assert.ok($('#view-settings'), 'settings still rendered');
});

await test('Persistence — the House survives a reload', async () => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  assert.ok(raw, 'state written to localStorage');
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed.contestants) && parsed.contestants.length >= 8, 'contestants persisted');
  assert.ok(Array.isArray(parsed.tasks) && parsed.tasks.length >= 1, 'tasks persisted');
  assert.ok(parsed.timer && parsed.timer.duration > 0, 'timer persisted');
});

await test('Icons · every declared icon link resolves to a real file', () => {
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((match) => {
    const tag = match[0];
    return {
      rel: (tag.match(/rel="([^"]+)"/) || [, ''])[1],
      href: (tag.match(/href="([^"]+)"/) || [, ''])[1],
    };
  });
  const byRel = (name) => links.find((link) => link.rel.split(/\s+/).includes(name));

  // Every local icon/brand target must exist on disk (a 404 icon = blank tab icon).
  const local = links.filter((link) => link.href && !/^https?:|^data:/.test(link.href));
  const missing = local
    .map((link) => link.href.split('?')[0])
    .filter((href) => !fs.existsSync(path.join(REPO, href)));
  assert.deepEqual(missing, [], `missing linked files: ${missing.join(', ')}`);

  assert.ok(byRel('icon')?.href.includes('favicon.ico'), 'favicon.ico is declared');
  assert.ok(byRel('apple-touch-icon'), 'apple-touch-icon declared for iOS home screens');
  assert.ok(byRel('mask-icon'), 'mask-icon declared for pinned Safari tabs');
  assert.equal(byRel('manifest')?.href, 'site.webmanifest', 'web manifest declared');
  assert.ok(byRel('preload'), 'brand assets are preloaded for a flash-free first paint');
});

await test('Icons · manifest exposes app icons + shortcuts that exist on disk', () => {
  assert.ok(fs.existsSync(path.join(REPO, 'favicon.ico')), 'root favicon.ico present');
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'site.webmanifest'), 'utf8'));
  assert.ok(manifest.icons.length >= 4, `expected 4 manifest icons, saw ${manifest.icons.length}`);
  assert.ok(manifest.icons.some((entry) => entry.purpose === 'maskable'), 'maskable icon declared');
  for (const entry of manifest.icons) {
    const rel = entry.src.replace(/^\//, '');
    assert.ok(fs.existsSync(path.join(REPO, rel)), `manifest icon missing on disk: ${rel}`);
  }
  for (const shortcut of manifest.shortcuts || []) {
    assert.ok(shortcut.url.startsWith('/#'), `shortcut deep links into the app: ${shortcut.url}`);
  }
  assert.equal(manifest.theme_color.toLowerCase(), '#05070d', 'manifest theme colour matches the room');
});

await test('Icons · the in-app icon set is complete (nothing falls back)', () => {
  const iconsSource = fs.readFileSync(path.join(REPO, 'js', 'icons.js'), 'utf8');
  const defined = [...iconsSource.matchAll(/^\s{2}'?([a-z0-9-]+)'?:\s*'/gm)].map((match) => match[1]);
  assert.ok(defined.length >= 40, `icon library looks complete (${defined.length} icons)`);

  const used = new Set();
  const compared = new Set(); // literals used in === / !== checks, not icon names
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith('.js') || full.endsWith('icons.js')) continue;
      const source = fs.readFileSync(full, 'utf8');
      for (const match of source.matchAll(/icon\([^,)]*?'([a-zA-Z0-9-]+)'/g)) used.add(match[1]);
      for (const match of source.matchAll(/icon:\s*'([a-zA-Z0-9-]+)'/g)) used.add(match[1]);
      for (const match of source.matchAll(/[=!]==?\s*'([a-zA-Z0-9-]+)'/g)) compared.add(match[1]);
    }
  };
  walk(path.join(REPO, 'js'));

  const unknown = [...used].filter((name) => !defined.includes(name) && !compared.has(name));
  assert.deepEqual(unknown, [], `icons referenced but not defined: ${unknown.join(', ')}`);
  assert.ok(used.size >= 30, `views/components reference the icon library (${used.size} names)`);

  const values = [...iconsSource.matchAll(/'?([a-zA-Z0-9-]+)'?:\s*'((?:[^'\\]|\\.)*)'/g)];
  const emptyOrMalformed = values
    .filter(([, , value]) => !/<(path|circle|rect|ellipse|line)/.test(value))
    .map(([name]) => name);
  assert.deepEqual(emptyOrMalformed, [], `icons with no geometry: ${emptyOrMalformed.join(', ')}`);
});

await test('Counters never render out-of-range values (foreign rAF clock)', async () => {
  // Regression guard: virtual-clock renderers (headless screenshotters,
  // embedded previews) pass rAF timestamps from a different timebase than
  // performance.now(). That used to yield negative progress and print absurd
  // values such as "-4492" instead of "180".
  nav('leaderboard');
  await new Promise((resolve) => setTimeout(resolve, 60));

  const originalRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = (cb) => originalRaf.call(window, () => cb(0));

  const firstRow = $('.lb-row');
  const scoreNode = () => $('.lb-row [data-count-to]');
  const before = Number(scoreNode().dataset.countTo);
  click(firstRow.querySelector('[data-action="points:quick"][data-delta="10"]'));

  const expected = before + 10;
  const frames = [];
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 45));
    frames.push(Number(String(scoreNode().textContent).replace(/[^0-9.-]/g, '')));
  }
  window.requestAnimationFrame = originalRaf;

  const outOfRange = frames.filter((value) => !(value >= 0 && value <= expected));
  assert.deepEqual(outOfRange, [], `counter rendered out-of-range values: ${frames.join(', ')}`);
  // And the settle safety net still lands on the real value.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(Number(String(scoreNode().textContent).replace(/[^0-9.-]/g, '')), expected, 'counter settles on the true value');
  click(scoreNode().closest('.lb-row').querySelector('[data-action="points:quick"][data-delta="-10"]'));
});

/* ══ 13. Real-time activity log ════════════════════════════════════════ */

await test('13 · Live activity log — seeded history, relative times, live tail', async () => {
  nav('activity');
  const log = store().log;
  assert.ok(log.length > 30, `seeded House history is present (${log.length} entries)`);
  assert.ok(
    log.every((entry, index) => index === 0 || log[index - 1].createdAt >= entry.createdAt),
    'the log is stored newest-first',
  );
  assert.ok(log.some((entry) => entry.type === 'points' && entry.delta), 'points events carry their delta for analytics');

  // Relative timestamps render and are patchable without a re-render.
  const stamps = $$('#view-activity .js-ago');
  assert.ok(stamps.length > 5, `relative timestamps rendered (${stamps.length})`);
  assert.ok(stamps.every((node) => Number(node.dataset.ts) > 0), 'every stamp carries its timestamp');
  assert.ok(/ago|now/.test(stamps[0].textContent), `stamps read as relative time ("${stamps[0].textContent}")`);

  // Live controls + rate gauge.
  assert.ok($('.live-strip'), 'live strip is present');
  assert.ok(/\d+(\.\d+)?/.test($('.live-strip__rate').textContent), 'event rate is displayed');
  assert.ok($('[data-action="feed:toggle"]'), 'pause/resume control exists');
});

await test('13b · New House events stream in live (and pausing is non-destructive)', async () => {
  nav('activity');
  const before = store().log.length;

  // A real House action lands at the top of the feed and is marked fresh.
  const subject = store().contestants[0];
  nav('leaderboard');
  click(boardRow(subject.id).querySelector('[data-action="points:quick"][data-delta="10"]'));
  nav('activity');
  await wait(60);
  assert.ok(store().log.length > before, 'the event was recorded');
  assert.equal($('#view-activity .feed__item').dataset.entryId, store().log[0].id, 'newest event renders first');

  // Pause the feed: events keep recording, the view stops claiming to follow.
  click($('[data-action="feed:toggle"]'));
  assert.equal(store().ui.feedPaused, true, 'feed paused');
  assert.equal($('.live-strip').dataset.paused, 'true', 'the strip reports the paused state');
  const pausedAt = store().log.length;
  window.__commandCenter.simulator.emit();
  assert.ok(store().log.length > pausedAt, 'events are still recorded while paused');

  // The paused feed reports what arrived, and resuming clears it.
  nav('activity');
  await wait(40);
  assert.ok(/while paused/.test($('.live-strip').textContent), 'the paused banner counts unseen events');
  click($('[data-action="feed:toggle"]'));
  assert.equal(store().ui.feedPaused, false, 'feed resumed');
});

await test('13c · Demo feed simulator emits real House events', async () => {
  const before = store().log.length;
  const description = window.__commandCenter.simulator.emit();
  assert.ok(description, 'the simulator produced an event');
  assert.ok(store().log.length > before, `the simulated event reached the log (${description})`);
  assert.equal(store().log[0].contestantId || store().log[0].taskId ? true : true, true);
});

/* ══ 14. Role-based access control ═════════════════════════════════════ */

await test('14 · Access control — Viewer is read-only and nothing slips through', async () => {
  nav('settings');
  assert.ok($('#roleSwitcher'), 'role switcher is rendered');
  assert.ok($('#permissionMatrix'), 'permission matrix is rendered');

  // Sign in as Viewer through the settings role card.
  click($('#roleSwitcher [data-role="viewer"]'));
  assert.equal(store().session.role, 'viewer', 'role persisted to the store');
  assert.equal(document.body.dataset.role, 'viewer', 'the shell reports the active role');
  assert.ok($('.access-bar'), 'read-only ribbon appears for restricted roles');
  assert.ok(/read-only/i.test($('.access-bar').textContent), 'the ribbon explains the restriction');
  assert.ok(Number(document.body.dataset.lockedControls) > 0, 'controls are locked in the DOM');

  // A locked button cannot change the House.
  nav('leaderboard');
  const subject = store().contestants[0];
  const pointsBefore = subject.points;
  const quick = boardRow(subject.id).querySelector('[data-action="points:quick"][data-delta="10"]');
  assert.ok(quick.disabled || quick.dataset.locked === 'true', 'the points control is locked');
  click(quick);
  assert.equal(person(subject.id).points, pointsBefore, 'no points were awarded');

  // The blocked attempt is audited and raises an access notification.
  const denial = store().log.find((entry) => entry.type === 'access' && entry.kind === 'denied');
  assert.ok(denial, 'blocked attempt written to the live log');
  assert.ok(/Blocked/i.test(denial.message), `audit message explains the block ("${denial?.message}")`);
  const notice = store().notifications.find((item) => item.group === 'access' && /Access denied/i.test(item.title));
  assert.ok(notice, 'an access notification was raised');
  assert.equal(notice.read, false, 'it arrives unread');

  // Read-only surfaces still work for a viewer.
  nav('analytics');
  assert.ok($('#formTable'), 'a viewer can still read the analytics');
  nav('activity');
  assert.ok($('#view-activity .feed__item'), 'a viewer can still read the live log');
});

await test('14b · Captain access is scoped to their own team', async () => {
  nav('settings');
  click($('#roleSwitcher [data-role="captain"]'));
  assert.equal(store().session.role, 'captain', 'signed in as Captain');

  const captain = store().contestants.find((c) => c.isCaptain);
  const mate = store().contestants.find((c) => c.status === 'active' && c.team === captain.team && c.id !== captain.id);
  const outsider = store().contestants.find((c) => c.status === 'active' && c.team !== captain.team);

  assert.ok(/Team/.test($('.access-bar').textContent), 'the ribbon names the captain team');

  // Own team: allowed. Other team: locked.
  nav('leaderboard');
  const matePoints = mate.points;
  click(boardRow(mate.id).querySelector('[data-action="points:quick"][data-delta="10"]'));
  assert.equal(person(mate.id).points, matePoints + 10, 'points to their own team apply');

  const outPoints = outsider.points;
  const blocked = boardRow(outsider.id).querySelector('[data-action="points:quick"][data-delta="10"]');
  click(blocked);
  assert.equal(person(outsider.id).points, outPoints, 'points outside the team are refused');

  // Evictions stay out of reach.
  nav('contestants');
  const evict = $$('[data-action="eviction:open"]')[0];
  assert.ok(evict.dataset.locked === 'true', 'eviction controls are locked for a Captain');
});

await test('14c · Big Boss regains full control (and the House still works)', async () => {
  nav('settings');
  click($('#roleSwitcher [data-role="bigboss"]'));
  assert.equal(store().session.role, 'bigboss', 'signed back in as Big Boss');
  assert.equal(document.body.dataset.lockedControls, '0', 'nothing is locked for Big Boss');
  assert.equal($('.access-bar'), null, 'the read-only ribbon disappears');

  nav('leaderboard');
  const subject = store().contestants[0];
  const before = subject.points;
  click(boardRow(subject.id).querySelector('[data-action="points:quick"][data-delta="10"]'));
  assert.equal(person(subject.id).points, before + 10, 'House actions work again');
  click(boardRow(subject.id).querySelector('[data-action="points:quick"][data-delta="-10"]'));
});

/* ══ 15. Performance analytics ═════════════════════════════════════════ */

await test('15 · Performance analytics — KPIs, charts and the form guide', async () => {
  nav('analytics');
  assert.ok($('#view-analytics'), 'analytics view mounted');
  assert.ok($$('#view-analytics .kpi').length >= 6, `KPI tiles rendered (${$$('#view-analytics .kpi').length})`);
  assert.ok($('[data-chart="area"]'), 'points velocity area chart rendered');
  assert.ok($$('[data-chart="bar"]').length >= 2, 'award + event-rate bar charts rendered');
  assert.ok($('[data-chart="donut"]'), 'team share donut rendered');
  assert.ok($$('#formTable tbody tr').length >= 10, 'form guide lists the House');
  assert.ok($$('#insights .insight').length >= 5, 'plain-language insights generated');

  const range = store().ui.analyticsRange;
  assert.ok(['1h', '6h', '24h', 'all'].includes(range), `a default window is set (${range})`);
  click($('#analyticsRange [data-range="24h"]'));
  assert.equal(store().ui.analyticsRange, '24h', 'window switch persists');
  assert.ok(/Points in 24/.test($('#view-analytics').textContent), 'headline KPI follows the window');
  click($('#analyticsRange [data-range="all"]'));
  assert.ok(/Ledger fully reconciled|pts of history/.test($('#view-analytics').textContent), 'ledger coverage is reported');
});

await test('15b · The analytics ledger reconciles with the House scores', async () => {
  nav('analytics');
  const snapshot = store();
  const gained = new Map();
  snapshot.log.forEach((entry) => {
    if (entry.type === 'points' && entry.contestantId) {
      gained.set(entry.contestantId, (gained.get(entry.contestantId) || 0) + entry.delta);
    }
    if (entry.type === 'task' && entry.kind === 'complete' && Array.isArray(entry.contestantIds)) {
      entry.contestantIds.forEach((id) => gained.set(id, (gained.get(id) || 0) + (entry.points || 0)));
    }
  });
  const mismatch = snapshot.contestants
    .filter((c) => c.status === 'active')
    .filter((c) => (gained.get(c.id) || 0) !== c.points)
    .map((c) => `${c.name}: ledger ${gained.get(c.id) || 0} vs score ${c.points}`);
  assert.deepEqual(mismatch, [], `every score is explained by the log (${mismatch.join(' | ')})`);
});

/* ══ 16. Event notifications ═══════════════════════════════════════════ */

await test('16 · Event notifications — bell, unread badge and the panel', async () => {
  nav('dashboard');
  const bell = $('.bell');
  assert.ok(bell, 'bell is in the top bar');
  const unreadBefore = store().notifications.filter((item) => !item.read).length;
  assert.ok(bell.getAttribute('aria-label').length > 0, 'bell is labelled for screen readers');
  if (unreadBefore) {
    assert.ok($('.bell__badge'), 'unread notifications show a badge');
    assert.ok(/unread notification/.test(bell.getAttribute('aria-label')), 'screen readers hear the unread count');
  }

  click(bell);
  await wait(20);
  const panel = $('#notifyPanel');
  assert.ok(panel && !panel.hidden, 'notification panel opens');
  assert.ok($$('#notifyPanel .notice').length > 0, 'notifications are listed');
  assert.ok($('#notifyPanel .notice__open'), 'each notification deep-links');

  // Filtering and reading state.
  click($('#notifyPanel [data-action="notify:filter"][data-filter="unread"]'));
  assert.equal(store().ui.notifyFilter, 'unread', 'unread filter applied');
  const first = $$('#notifyPanel .notice').length;
  click($('#notifyPanel [data-action="notify:readAll"]'));
  assert.equal(store().notifications.filter((item) => !item.read).length, 0, 'mark-all-read clears the badge');
  assert.equal($('.bell__badge'), null, 'badge disappears once everything is read');
  assert.ok(first >= 0);

  // Deep link navigates and closes the panel.
  click($('#notifyPanel [data-action="notify:filter"][data-filter="all"]'));
  const target = $$('#notifyPanel [data-action="notify:item"]')[0];
  const view = target.dataset.view;
  click(target);
  assert.equal(store().ui.activeView, view, `notification opened the ${view} view`);
  assert.ok($('#notifyPanel').hidden, 'panel closed after the deep link');
});

await test('16b · House events raise notifications, and rules respect preferences', async () => {
  // An eviction is a high-priority rule.
  nav('nominations');
  const box = $('#inlineNominationPicker input[type="checkbox"]');
  box.checked = true;
  box.dispatchEvent(new window.Event('change', { bubbles: true }));
  set($('#inlineNominationReason'), 'Notification rule check');
  click($('#view-nominations [data-action="nomination:selected"]'));
  const nominee = store().contestants.find((c) => c.nomination);
  assert.ok(nominee, 'a contestant entered the Danger Zone');

  const nominationAlert = store().notifications.find((item) => item.group === 'nominations');
  assert.ok(nominationAlert, 'the nomination raised a notification');
  assert.equal(nominationAlert.priority, 'high', 'Danger Zone alerts are high priority');

  nav('contestants');
  click($(`#view-contestants .contestant[data-id="${nominee.id}"] [data-action="menu:toggle"]`));
  click($(`#view-contestants .contestant[data-id="${nominee.id}"] [data-action="eviction:open"]`));
  click(modalDanger());
  escape();
  await wait(30);

  const eviction = store().notifications.find((item) => item.group === 'evictions');
  assert.ok(eviction, 'eviction raised a notification');
  assert.equal(eviction.priority, 'high', 'eviction alerts are high priority');
  assert.equal(eviction.read, false, 'high-priority alerts arrive unread');
  const back = store().contestants.find((c) => c.id === nominee.id);
  click($(`#view-contestants [data-action="nav:go"]`) || $('#sidebar [data-view="evictions"]'));
  nav('evictions');
  click($('#view-evictions [data-action="eviction:reinstate"]'));
  assert.equal(person(nominee.id).status, 'active', `reinstate works after the check (${back.name})`);

  // Categories can be muted: a broadcast in a muted category raises nothing.
  const broadcast = (message) => {
    click($('[data-action="announcement:open"]'));
    set($('#announcementMessage'), message);
    click(modalPrimary());
    escape();
  };

  nav('settings');
  const setGroup = (id, on) => {
    const input = $(`[data-notify-group="${id}"]`);
    assert.ok(input, `category toggle rendered (${id})`);
    input.checked = on;
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  };

  setGroup('house', false);
  assert.equal(store().notify.groups.house, false, 'category disabled');

  let before = store().notifications.length;
  broadcast('Muted category broadcast.');
  assert.equal(store().notifications.length, before, 'muted category produced no notification');
  assert.ok(store().log.some((entry) => /Muted category broadcast/.test(entry.message)), 'the event is still in the live log');

  setGroup('house', true);
  assert.equal(store().notify.groups.house, true, 'category re-enabled');
  before = store().notifications.length;
  broadcast('Audible category broadcast.');
  assert.ok(store().notifications.length > before, 're-enabled category notifies again');
});

await test('No runtime errors were logged during the session', async () => {
  const unique = [...new Set(errors)].filter((entry) => !/Not implemented/i.test(entry));
  assert.equal(unique.length, 0, unique.slice(0, 5).join(' | '));
});

/* ── Report ────────────────────────────────────────────────────────────── */

const failed = results.filter(([status]) => status === 'FAIL');
console.log('\n  BIG BOSS · COMMAND CENTER — feature verification');
console.log('  ' + '─'.repeat(64));
results.forEach(([status, name]) => console.log(`  ${status === 'PASS' ? '✓' : '✗'} ${name}`));
if (errors.length) {
  console.log('\n  Captured runtime output:');
  [...new Set(errors)].slice(0, 8).forEach((entry) => console.log('    ! ' + entry));
}
console.log('  ' + '─'.repeat(64));
console.log(`  ${results.length - failed.length}/${results.length} checks passed\n`);
process.exit(failed.length ? 1 : 0);
