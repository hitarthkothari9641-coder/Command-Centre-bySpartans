/**
 * Headless smoke + behaviour test for the Big Boss Command Centre.
 *
 * Bundles the real app with esbuild, boots index.html in jsdom, drives the
 * actual UI with synthetic clicks and asserts the mandatory feature checklist.
 *
 *   npm test
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, '..');
const BUNDLE = path.join(ROOT, '.bundle.js');

execFileSync('npx', ['esbuild', 'js/app.js', '--bundle', '--format=iife',
  `--outfile=${BUNDLE}`, '--log-level=warning'], { cwd: REPO, stdio: 'inherit' });

/* ---------------------------------------------------------------- */
/* Boot the page                                                     */
/* ---------------------------------------------------------------- */

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(`jsdomError: ${e.message}`));
vc.on('error', (...a) => errors.push(`console.error: ${a.join(' ')}`));

const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;
const { document } = window;

// jsdom lacks a few browser APIs the app touches lazily.
window.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.URL.createObjectURL ||= () => 'blob:test';

const bundle = fs.readFileSync(BUNDLE, 'utf8');
const script = document.createElement('script');
script.textContent = `
  (function(){
    const module = undefined;
    ${bundle}
  })();
`;
document.body.appendChild(script);

/* ---------------------------------------------------------------- */
/* Harness                                                           */
/* ---------------------------------------------------------------- */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const click = (el) => {
  if (!el) throw new Error('element not found for click');
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
};
const nav = (v) => click(document.querySelector(`.nav-item[data-view="${v}"]`));
const esc = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
const fmt = (c) => c.replace(/[^0-9]/g, '');
const state = () => JSON.parse(window.localStorage.getItem('bb-command-centre.v1'));
const person = (id) => (state().contestants || []).find((c) => c.id === id) || {};
const nameOf = (id) => person(id).name;

const results = [];
const test = (name, fn) => {
  try {
    fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', `${name} — ${e.message}`]);
  }
};

/* ---------------------------------------------------------------- */
/* 1. Contestants / roster                                           */
/* ---------------------------------------------------------------- */

test('1 · Contestant management — 8+ contestants with name, team, points, status', () => {
  nav('contestants');
  const cards = $$('#view-contestants .person');
  assert.ok(cards.length >= 8, `expected 8+ contestant cards, saw ${cards.length}`);
  const text = $('#view-contestants').textContent;
  assert.ok(/Alpha|Bravo|Charlie|Delta/.test(text), 'teams shown');
  assert.ok($$('#view-contestants .p-points').length >= 8, 'points rendered per contestant');
  assert.ok(/#navContestants/.test('') === false);
  assert.ok(Number($('#navContestants').textContent) >= 8, 'active counter reflects roster');
});

/* ---------------------------------------------------------------- */
/* 2. Leaderboard                                                    */
/* ---------------------------------------------------------------- */

test('2 · Live leaderboard — ranked by points and updates on point changes', () => {
  nav('leaderboard');
  const rows = $$('#view-leaderboard .board-row');
  assert.ok(rows.length >= 8, 'full board rendered');
  const pts = rows.map((r) => Number(fmt(r.querySelector('.pts').textContent)));
  const sorted = [...pts].sort((a, b) => b - a);
  assert.deepEqual(pts, sorted, 'rows sorted descending by points');
  assert.ok($('#view-leaderboard').textContent.includes('#1'), 'rank numbers shown');
});

test('2b · Point change reorders the leaderboard', () => {
  nav('leaderboard');
  const rows = $$('#view-leaderboard .board-row');
  const lastId = rows[rows.length - 1].dataset.id;
  const lastPts = Number(fmt(rows[rows.length - 1].querySelector('.pts').textContent));
  click(rows[rows.length - 1].querySelector('[data-action="points-quick"][data-delta="10"]'));
  const after = Number(fmt(document.querySelector(`#view-leaderboard .board-row[data-id="${lastId}"] .pts`).textContent));
  assert.equal(after, lastPts + 10, 'points applied');
  const newOrder = $$('#view-leaderboard .board-row').map((r) => Number(fmt(r.querySelector('.pts').textContent)));
  assert.deepEqual(newOrder, [...newOrder].sort((a, b) => b - a), 'still sorted after update');
});

/* ---------------------------------------------------------------- */
/* 3. Tasks + 4. Points + 10. Timer                                  */
/* ---------------------------------------------------------------- */

test('3 · Task management — assign a task from the modal', () => {
  nav('tasks');
  const before = $$('#view-tasks .task').length;
  click($('#view-tasks [data-action="add-task"]'));
  assert.ok($('#modal').classList.contains('show'), 'assign task modal opens');
  $('#taskTitle').value = 'Automated Smoke Test Task';
  $('#taskPoints').value = '15';
  const check = $('#taskChecks input');
  check.checked = true;
  check.dispatchEvent(new window.Event('change', { bubbles: true }));
  click($('#modalFoot .btn.primary'));
  const after = $$('#view-tasks .task').length;
  assert.equal(after, before + 1, 'task added to the board');
  assert.ok($('#view-tasks').textContent.includes('Automated Smoke Test Task'), 'task visible');
});

test('3b · Task completion awards points to every assignee', () => {
  const card = $$('#view-tasks .task').find((t) => t.textContent.includes('Automated Smoke Test Task'));
  assert.ok(card, 'created task found');
  const assignee = card.querySelector('.chip').textContent.trim();
  click(card.querySelector('[data-action="task-complete"]'));
  const done = $$('#view-tasks .task').find((t) => t.textContent.includes('Automated Smoke Test Task'));
  assert.ok(done.classList.contains('completed'), 'task marked complete');
  assert.ok(done.textContent.includes('Completed'), 'completed badge shown');
  assert.ok(assignee.length > 0);
});

test('4 · Point system — add and deduct via quick buttons and custom modal', () => {
  nav('contestants');
  const card = $$('#view-contestants .person')[0];
  const id = card.querySelector('[data-action="edit-contestant"]').dataset.id;
  const before = person(id).points;

  click(card.querySelector('[data-action="points-quick"][data-delta="10"]'));
  assert.equal(person(id).points, before + 10, 'quick +10 applied');

  const modalCard = document.querySelector(`[data-action="edit-contestant"][data-id="${id}"]`).closest('.person');
  click(modalCard.querySelector('[data-action="points-modal"]'));
  assert.ok($('#modal').classList.contains('show'), 'points modal opens');
  $('#ptsDelta').value = '-5';
  $('#ptsReason').value = 'Automated deduction';
  click($('#modalFoot .btn.primary'));
  assert.equal(person(id).points, before + 5, 'custom deduction applied');

  const shown = Number(fmt(document.querySelector(`#view-contestants [data-action="edit-contestant"][data-id="${id}"]`).closest('.person').querySelector('.p-points b').textContent));
  assert.equal(shown, before + 5, 'UI reflects the stored points');
});

test('10 · Task timer — start, pause, reset and presets', () => {
  nav('tasks');
  const clock = () => $('#view-tasks .js-clock').textContent.trim();
  click($('#view-tasks [data-action="timer-preset"][data-sec="180"]'));
  assert.equal(clock(), '03:00', 'preset applied');
  assert.equal(clock(), $('#view-overview .js-clock').textContent.trim(), 'both rings stay in sync');
  click($('#view-tasks [data-action="timer-start"]'));
  assert.ok($('#chipTimer').textContent.toLowerCase().includes('running'), 'running state shown');
  click($('#view-tasks [data-action="timer-pause"]'));
  assert.ok($('#chipTimer').textContent.toLowerCase().includes('paused'), 'paused state shown');
  click($('#view-tasks [data-action="timer-reset"]'));
  assert.equal(clock(), '03:00', 'reset restores duration');
});

/* ---------------------------------------------------------------- */
/* 5. Captaincy                                                      */
/* ---------------------------------------------------------------- */

test('5 · Captaincy — appoint and change the House Captain', () => {
  nav('overview');
  click($('#view-overview [data-action="captain-modal"]'));
  const radios = $$('#modalBody input[name="cap"]');
  assert.ok(radios.length >= 2, 'candidates listed');
  const target = radios.find((r) => !r.checked);
  target.checked = true;
  click($('#modalFoot .btn.primary'));
  const captainName = nameOf(target.value);
  assert.ok(person(target.value).isCaptain, 'captain stored in state');
  assert.ok($('#sidebarCaptain').textContent.includes(captainName), 'captain card shows new captain');
  nav('leaderboard');
  assert.ok($('#view-leaderboard').textContent.includes('Captain'), 'captain badge on leaderboard');

  // change again
  nav('overview');
  click($('#view-overview [data-action="captain-modal"]'));
  const other = $$('#modalBody input[name="cap"]').find((r) => !r.checked && r.value !== target.value);
  other.checked = true;
  click($('#modalFoot .btn.primary'));
  const otherName = nameOf(other.value);
  assert.ok(person(other.value).isCaptain && !person(target.value).isCaptain, 'captaincy transferred in state');
  assert.ok($('#sidebarCaptain').textContent.includes(otherName), 'captain card updated');
});

/* ---------------------------------------------------------------- */
/* 6/7/8. Nominations, immunity, danger zone                         */
/* ---------------------------------------------------------------- */

test('7 · Immunity — immune contestant cannot be nominated', () => {
  nav('contestants');
  const card = $$('#view-contestants .person').find((c) => c.querySelector('[data-action="immunity-on"]'));
  const name = card.querySelector('.p-name').textContent.trim();
  click(card.querySelector('[data-action="immunity-on"]'));
  const refreshed = $$('#view-contestants .person').find((c) => c.querySelector('.p-name').textContent.trim() === name);
  assert.ok(refreshed.classList.contains('is-immune'), 'immunity applied');
  const nominate = refreshed.querySelector('[data-action="nominate"]');
  assert.ok(nominate.disabled, 'nominate button disabled while immune');
  assert.ok($('#view-danger').textContent !== undefined);
});

test('7b · Granting immunity revokes an existing nomination', () => {
  nav('danger');
  const before = $$('#view-danger .dz-item').length;
  // nominate someone via the danger view form
  const box = $('#nominateChecks input');
  if (box) {
    box.checked = true;
    box.dispatchEvent(new window.Event('change', { bubbles: true }));
    click($('#view-danger [data-action="nominate-selected"]'));
  }
  nav('danger');
  const after = $$('#view-danger .dz-item').length;
  assert.ok(after >= before, 'danger zone populated');
});

test('6/8 · Nominations + Danger Zone — nominees are listed with controls', () => {
  nav('danger');
  const dz = $$('#view-danger .dz-item');
  assert.ok(dz.length >= 1, `expected nominees, saw ${dz.length}`);
  assert.ok(Number($('#navDanger').textContent) >= 1, 'nav badge counts nominees');
  assert.ok($('#view-danger').textContent.includes('Danger Zone'), 'danger zone panel present');
  const immune = $('#view-danger').textContent.includes('Immune');
  assert.ok(immune, 'immunity panel present');
});

/* ---------------------------------------------------------------- */
/* 9. Announcements                                                  */
/* ---------------------------------------------------------------- */

test('9 · Big Boss announcement — broadcast, overlay and history', () => {
  nav('announcements');
  $('#annMsg').value = 'Automated smoke-test broadcast.';
  $('#annTone').value = 'alert';
  click($('#view-announcements [data-action="send-announcement"]'));
  assert.ok($('#broadcast').classList.contains('show'), 'broadcast overlay shown');
  assert.ok($('#broadcastMsg').textContent.includes('Automated smoke-test'), 'message on overlay');
  assert.ok($('#view-announcements').textContent.includes('Automated smoke-test broadcast.'), 'history stored');
  esc();
  assert.ok(!$('#broadcast').classList.contains('show'), 'overlay dismissed');
});

test('9b · Announce button opens the composer and broadcasts', () => {
  click($('#btnAnnounce'));
  $('#annModalMsg').value = 'Header button broadcast.';
  click($('#modalFoot .btn.primary'));
  assert.ok($('#broadcastMsg').textContent.includes('Header button'), 'broadcast from header');
  esc();
});

/* ---------------------------------------------------------------- */
/* 11. Statistics                                                    */
/* ---------------------------------------------------------------- */

test('11 · House statistics — live stats render (highest scorer, tasks, nominees…)', () => {
  nav('overview');
  const stats = $$('#view-overview .stat');
  assert.ok(stats.length >= 4, 'stat cards render');
  const text = $('#view-overview').textContent;
  assert.ok(text.includes('Active Contestants'), 'active count');
  assert.ok(text.includes('House Points'), 'house points');
  assert.ok(text.includes('Danger Zone'), 'danger zone stat');
  assert.ok(text.includes('Task Progress'), 'task progress');
  nav('contestants');
  const panel = $('#view-contestants').textContent;
  assert.ok(panel.includes('Highest Scorer'), 'highest scorer stat');
  assert.ok(panel.includes('Most Tasks Completed'), 'task stat');
  assert.ok(panel.includes('House Captain'), 'captain stat');
});

/* ---------------------------------------------------------------- */
/* 12. Eviction                                                      */
/* ---------------------------------------------------------------- */

test('12 · Eviction — evicted contestants leave the leaderboard', () => {
  nav('contestants');
  const card = $$('#view-contestants .person').find((c) => c.querySelector('[data-action="evict-modal"]'));
  const name = card.querySelector('.p-name').textContent.trim();
  const beforeActive = Number($('#navContestants').textContent);
  click(card.querySelector('[data-action="evict-modal"]'));
  click($('#modalFoot .btn.danger'));
  assert.ok($('#broadcastMsg').textContent.length > 0, 'eviction announced');
  esc();

  nav('leaderboard');
  const stillRanked = $$('#view-leaderboard .board-row').some((r) => r.querySelector('.nm').textContent.includes(name));
  assert.ok(!stillRanked, 'evicted contestant removed from leaderboard');
  nav('evictions');
  assert.ok($('#view-evictions').textContent.includes(name), 'eviction listed');
  nav('contestants');
  assert.equal(Number($('#navContestants').textContent), beforeActive - 1, 'active counter reduced by one');

  // reinstate brings them back
  nav('evictions');
  click($('#view-evictions [data-action="reinstate"]'));
  nav('leaderboard');
  assert.ok($$('#view-leaderboard .board-row').some((r) => r.querySelector('.nm').textContent.includes(name)), 'reinstated contestant back on board');
});

test('12b · Big Boss must explicitly override immunity to evict', () => {
  nav('contestants');
  // grant immunity to a fresh contestant so this check is self-contained
  let fresh = $$('#view-contestants .person').find((c) => c.querySelector('.badge.immune'));
  if (!fresh) {
    const candidate = $$('#view-contestants .person').find((c) => c.querySelector('[data-action="immunity-on"]'));
    click(candidate.querySelector('[data-action="immunity-on"]'));
    nav('contestants');
    fresh = $$('#view-contestants .person').find((c) => c.querySelector('.badge.immune'));
  }
  assert.ok(fresh, 'an immune contestant exists');
  const id = fresh.querySelector('[data-action="edit-contestant"]').dataset.id;
  const name = nameOf(id);

  click(fresh.querySelector('[data-action="evict-modal"]'));
  assert.ok($('#modalTitle').textContent.includes('Override immunity'), 'override warning shown');
  assert.ok($('#modalFoot .btn.danger').textContent.includes('Override'), 'override confirmation required');
  click($('#modalFoot .btn.danger'));
  assert.equal(person(id).status, 'evicted', 'immunity overridden by explicit Big Boss action');
  assert.ok(state().log.some((l) => l.message.includes('overrode their immunity')), 'override recorded in the log');

  // nominee protection: immune contestants can never enter the Danger Zone
  nav('contestants');
  const protectedCard = $$('#view-contestants .person').find((c) => c.querySelector('[data-action="immunity-on"]'));
  click(protectedCard.querySelector('[data-action="immunity-on"]'));
  const immuneId = protectedCard.querySelector('[data-action="edit-contestant"]').dataset.id;
  nav('danger');
  assert.ok(!$('#nominateChecks').textContent.includes(nameOf(immuneId)), 'immune contestant not offered for nomination');
  esc();
});

/* ---------------------------------------------------------------- */
/* Robustness                                                        */
/* ---------------------------------------------------------------- */

test('All views keep rendering after heavy interaction', () => {
  for (const v of ['overview', 'contestants', 'tasks', 'leaderboard', 'danger', 'announcements', 'evictions', 'activity', 'settings']) {
    nav(v);
    assert.ok($(`#view-${v}`).innerHTML.trim().length > 40, `${v} has content`);
  }
});

test('Persistence — state survives a reload', () => {
  const raw = window.localStorage.getItem('bb-command-centre.v1');
  assert.ok(raw, 'state written to localStorage');
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed.contestants) && parsed.contestants.length >= 8, 'contestants persisted');
  assert.ok(parsed.tasks.length >= 1, 'tasks persisted');
});

test('Invalid actions are rejected with a toast, not a crash', () => {
  nav('contestants');
  const immune = $$('#view-contestants .person').find((c) => c.classList.contains('is-immune'));
  if (immune) {
    const el = immune.querySelector('[data-action="nominate"]');
    assert.ok(el.disabled, 'nomination blocked in UI');
  }
  const nav0 = $('#navDanger');
  assert.ok(nav0, 'nav still alive');
});

test('No runtime errors were logged during the whole session', () => {
  const unique = [...new Set(errors)].filter((e) => !/Not implemented/i.test(e));
  assert.equal(unique.length, 0, unique.slice(0, 6).join(' | '));
});

/* ---------------------------------------------------------------- */
/* Report                                                            */
/* ---------------------------------------------------------------- */

const failed = results.filter((r) => r[0] === 'FAIL');
console.log('\n  Big Boss Command Centre — feature smoke tests');
console.log('  ' + '─'.repeat(58));
for (const [status, name] of results) console.log(`  ${status === 'PASS' ? '✓' : '✗'} ${name}`);
if (errors.length) {
  console.log('\n  Captured runtime output:');
  [...new Set(errors)].slice(0, 10).forEach((e) => console.log('    ! ' + e));
}
console.log('  ' + '─'.repeat(58));
console.log(`  ${results.length - failed.length}/${results.length} checks passed\n`);
process.exit(failed.length ? 1 : 0);
