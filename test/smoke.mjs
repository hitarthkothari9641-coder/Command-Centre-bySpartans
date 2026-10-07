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

await test('All nine views render without errors', async () => {
  const views = ['dashboard', 'contestants', 'tasks', 'nominations', 'leaderboard', 'announcements', 'evictions', 'activity', 'settings'];
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
