/**
 * Big Boss Command Centre — State Store
 * Single source of truth. Pure data + mutations, emits change events.
 */

const STORAGE_KEY = 'bb-command-centre.v1';
const EVT = 'store:change';

export const uid = (p = 'id') =>
  `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const TEAMS = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

/** Seed roster — 12 contestants across 4 teams. */
function seed() {
  const roster = [
    ['Aarav Mehta', 'Alpha'],
    ['Zara Khan', 'Alpha'],
    ['Rohan Iyer', 'Alpha'],
    ['Isha Verma', 'Bravo'],
    ['Kabir Shah', 'Bravo'],
    ['Naina Rao', 'Bravo'],
    ['Devansh Gupta', 'Charlie'],
    ['Meera Nair', 'Charlie'],
    ['Arjun Singh', 'Charlie'],
    ['Sanya Kapoor', 'Delta'],
    ['Vihaan Joshi', 'Delta'],
    ['Tara Bose', 'Delta'],
  ];

  const contestants = roster.map(([name, team], i) => ({
    id: `c${i + 1}`,
    name,
    team,
    points: [180, 165, 140, 155, 120, 95, 170, 145, 110, 130, 100, 85][i],
    status: 'active', // active | evicted
    immunity: false,
    nomination: null, // { round, reason }
    isCaptain: false,
    tasksCompleted: 0,
    joinedAt: Date.now(),
    evictedAt: null,
    evictionReason: '',
    notes: '',
  }));

  contestants[6].isCaptain = true; // Devansh Gupta — House Captain

  // Keep the seed internally consistent: t1 is already completed by c1 and c7.
  [contestants[0], contestants[6]].forEach((p) => (p.tasksCompleted = 1));

  return {
    version: 1,
    house: { name: 'Tech House', season: 1, day: 1 },
    nominationRound: 1,
    contestants,
    tasks: [
      {
        id: 't1',
        title: 'Build the Landing Page',
        description: 'Ship a responsive landing page with a working CTA.',
        assignees: ['c1', 'c7'],
        points: 50,
        status: 'completed',
        createdAt: Date.now() - 86400000,
        completedAt: Date.now() - 3600000,
        dueAt: null,
      },
      {
        id: 't2',
        title: 'Debug the Arena API',
        description: 'Find and fix the failing endpoint before the buzzer.',
        assignees: ['c4', 'c10'],
        points: 40,
        status: 'active',
        createdAt: Date.now() - 7200000,
        completedAt: null,
        dueAt: null,
      },
      {
        id: 't3',
        title: 'Design the House Banner',
        description: 'A minimalist banner representing the Tech House identity.',
        assignees: ['c8'],
        points: 30,
        status: 'pending',
        createdAt: Date.now() - 1800000,
        completedAt: null,
        dueAt: null,
      },
    ],
    timer: {
      duration: 600,
      remaining: 600,
      running: false,
      endsAt: null,
      label: 'Task Timer',
    },
    announcements: [
      {
        id: uid('a'),
        message: 'Welcome to the Tech House. Big Boss is watching every commit.',
        tone: 'info',
        createdAt: Date.now() - 5400000,
      },
    ],
    log: [],
  };
}

let state = null;

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.contestants) || !parsed.contestants.length) return null;
    // Forward-compatible defaults
    parsed.tasks ||= [];
    parsed.announcements ||= [];
    parsed.log ||= [];
    parsed.timer ||= { duration: 600, remaining: 600, running: false, endsAt: null, label: 'Task Timer' };
    parsed.house ||= { name: 'Tech House', season: 1, day: 1 };
    parsed.nominationRound ||= 1;
    return parsed;
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Persist failed', e);
  }
}

function emit() {
  save();
  document.dispatchEvent(new CustomEvent(EVT, { detail: state }));
}

export function subscribe(fn) {
  document.addEventListener(EVT, () => fn(state));
}

export function getState() {
  return state;
}

export function init() {
  state = load() || seed();
  if (!state.log.length) {
    state.log = [
      entry('session', 'Command Centre initialised. House systems online.'),
    ];
    save();
  }
  return state;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function entry(type, message, meta = {}) {
  return { id: uid('l'), type, message, createdAt: Date.now(), ...meta };
}

export function log(type, message, meta = {}) {
  state.log.unshift(entry(type, message, meta));
  state.log = state.log.slice(0, 250);
}

export function c(id) {
  return state.contestants.find((x) => x.id === id);
}

export const activeContestants = () => state.contestants.filter((x) => x.status === 'active');

export function ranked() {
  return activeContestants()
    .slice()
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

export const immuneActive = () => activeContestants().filter((x) => x.immunity);

export function dangerZone() {
  return activeContestants()
    .filter((x) => x.nomination)
    .sort((a, b) => a.nomination.round - b.nomination.round || b.points - a.points);
}

export const captain = () => state.contestants.find((x) => x.isCaptain && x.status === 'active') || null;

export function evicted() {
  return state.contestants
    .filter((x) => x.status === 'evicted')
    .sort((a, b) => (b.evictedAt || 0) - (a.evictedAt || 0));
}

/* ------------------------------------------------------------------ */
/* Contestants                                                         */
/* ------------------------------------------------------------------ */

const PALETTE = ['#E8B341', '#6E9BFF', '#3DD68C', '#E5689A', '#B58CFF', '#4ED0D8', '#F0854B'];

export function avatarTone(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return PALETTE[h % PALETTE.length];
}

export function addContestant({ name, team, points = 0 }) {
  name = String(name || '').trim();
  if (!name) throw new Error('Contestant name is required.');
  if (state.contestants.some((x) => x.name.toLowerCase() === name.toLowerCase()))
    throw new Error(`${name} is already in the House.`);

  const person = {
    id: uid('c'),
    name,
    team: TEAMS.includes(team) ? team : TEAMS[0],
    points: Number(points) || 0,
    status: 'active',
    immunity: false,
    nomination: null,
    isCaptain: false,
    tasksCompleted: 0,
    joinedAt: Date.now(),
    evictedAt: null,
    evictionReason: '',
    notes: '',
  };
  state.contestants.push(person);
  log('contestant', `${name} entered the House for Team ${person.team}.`);
  emit();
  return person;
}

export function removeContestant(id) {
  const p = c(id);
  if (!p || p.status === 'evicted') return;
  state.contestants = state.contestants.filter((x) => x.id !== id);
  state.tasks.forEach((t) => {
    t.assignees = t.assignees.filter((a) => a !== id);
  });
  log('eviction', `${p.name} was permanently removed by Big Boss.`);
  emit();
}

export function adjustPoints(id, delta, reason = '') {
  const p = c(id);
  if (!p) return;
  if (p.status === 'evicted') throw new Error(`${p.name} has been evicted from the House.`);
  delta = Math.round(Number(delta) || 0);
  if (!delta) throw new Error('Enter a non-zero point value.');
  p.points = Math.max(0, p.points + delta);
  const sign = delta > 0 ? '+' : '';
  log(
    'points',
    `${sign}${delta} to ${p.name} → ${p.points} pts${reason ? ` · ${reason}` : ''}`,
    { contestantId: id, delta },
  );
  emit();
}

export function setCaptain(id) {
  const p = c(id);
  if (!p) return;
  if (p.status === 'evicted') throw new Error(`${p.name} has been evicted and cannot be Captain.`);
  const prev = captain();
  if (prev && prev.id === id) throw new Error(`${p.name} is already the House Captain.`);
  state.contestants.forEach((x) => (x.isCaptain = false));
  p.isCaptain = true;
  log(
    'captain',
    prev
      ? `Captaincy transferred from ${prev.name} to ${p.name}.`
      : `${p.name} was appointed House Captain.`,
    { contestantId: id },
  );
  emit();
  return prev;
}

export function revokeCaptain() {
  const prev = captain();
  if (!prev) return;
  prev.isCaptain = false;
  log('captain', `${prev.name} stepped down as House Captain.`);
  emit();
}

export function grantImmunity(id, reason = '') {
  const p = c(id);
  if (!p) return;
  if (p.status === 'evicted') throw new Error(`${p.name} has been evicted — immunity is void.`);
  if (p.immunity) throw new Error(`${p.name} already holds immunity.`);
  p.immunity = true;
  const hadNomination = !!p.nomination;
  p.nomination = null;
  log(
    'immunity',
    `${p.name} won immunity${reason ? ` · ${reason}` : ''}${hadNomination ? ' · nomination revoked' : ''}.`,
    { contestantId: id },
  );
  emit();
}

export function revokeImmunity(id) {
  const p = c(id);
  if (!p || !p.immunity) return;
  p.immunity = false;
  log('immunity', `Immunity revoked for ${p.name}.`);
  emit();
}

export function nominate(id, reason = '') {
  const p = c(id);
  if (!p) return;
  if (p.status === 'evicted') throw new Error(`${p.name} has been evicted and is out of the House.`);
  if (p.immunity) throw new Error(`${p.name} is IMMUNE and cannot be nominated.`);
  if (p.nomination) throw new Error(`${p.name} is already in the Danger Zone.`);
  if (p.isCaptain) throw new Error(`${p.name} is the House Captain and cannot be nominated.`);
  p.nomination = { round: state.nominationRound, reason: reason || '', at: Date.now() };
  log('nomination', `${p.name} was nominated for eviction (Round ${state.nominationRound}).`, {
    contestantId: id,
  });
  emit();
}

export function withdrawNomination(id) {
  const p = c(id);
  if (!p || !p.nomination) return;
  p.nomination = null;
  log('nomination', `Nomination withdrawn for ${p.name}.`);
  emit();
}

export function clearNominations() {
  const n = dangerZone().length;
  state.contestants.forEach((x) => (x.nomination = null));
  log('nomination', `All ${n} nomination(s) cleared. Danger Zone is empty.`);
  emit();
}

export function nextNominationRound() {
  state.contestants.forEach((x) => (x.nomination = null));
  state.nominationRound += 1;
  log('nomination', `Round ${state.nominationRound} nominations opened. Danger Zone reset.`);
  emit();
}

export function evict(id, reason = '') {
  const p = c(id);
  if (!p) return;
  if (p.status === 'evicted') throw new Error(`${p.name} has already left the House.`);
  const hadImmunity = p.immunity;
  p.status = 'evicted';
  p.evictedAt = Date.now();
  p.evictionReason = reason || 'Evicted by Big Boss';
  p.nomination = null;
  p.immunity = false;
  const wasCaptain = p.isCaptain;
  p.isCaptain = false;
  state.tasks.forEach((t) => {
    t.assignees = t.assignees.filter((a) => a !== id);
  });
  log(
    'eviction',
    `${p.name} has been EVICTED from the Tech House${reason ? ` · ${reason}` : ''}.` +
      (hadImmunity ? ' Big Boss overrode their immunity.' : '') +
      (wasCaptain ? ' Captaincy is now vacant.' : ''),
    { contestantId: id },
  );
  emit();
}

export function reinstate(id) {
  const p = c(id);
  if (!p || p.status !== 'evicted') return;
  p.status = 'active';
  p.evictedAt = null;
  p.evictionReason = '';
  log('eviction', `${p.name} was reinstated into the House by Big Boss.`);
  emit();
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export function createTask({ title, description = '', assignees = [], points = 20 }) {
  title = String(title || '').trim();
  if (!title) throw new Error('Task title is required.');
  const list = assignees.filter((a) => c(a) && c(a).status === 'active');
  if (!list.length) throw new Error('Assign the task to at least one active contestant.');

  const task = {
    id: uid('t'),
    title,
    description: String(description || '').trim(),
    assignees: list,
    points: Math.round(Number(points) || 0),
    status: 'pending',
    createdAt: Date.now(),
    completedAt: null,
    dueAt: null,
  };
  state.tasks.unshift(task);
  log('task', `Task "${title}" assigned to ${list.map((a) => c(a).name).join(', ')}.`);
  emit();
  return task;
}

export function startTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || t.status === 'completed') return;
  t.status = 'active';
  log('task', `Task "${t.title}" is now IN PROGRESS.`);
  emit();
}

export function setTaskStatus(id, status) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  const allowed = ['pending', 'active', 'completed', 'failed'];
  if (!allowed.includes(status)) return;

  if (status === 'completed') {
    if (t.status === 'completed') throw new Error('This task is already completed.');
    t.status = 'completed';
    t.completedAt = Date.now();
    const label = `${t.title}`;
    t.assignees.forEach((aid) => {
      const p = c(aid);
      if (!p || p.status !== 'active') return;
      p.points = Math.max(0, p.points + t.points);
      p.tasksCompleted += 1;
    });
    log(
      'task',
      `Task "${label}" COMPLETED · +${t.points} pts each to ${t.assignees
        .map((a) => c(a)?.name)
        .filter(Boolean)
        .join(', ')}.`,
    );
  } else {
    t.status = status;
    if (status !== 'completed') t.completedAt = null;
    log('task', `Task "${t.title}" marked ${status.toUpperCase()}.`);
  }
  emit();
}

export function deleteTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  state.tasks = state.tasks.filter((x) => x.id !== id);
  log('task', `Task "${t.title}" deleted.`);
  emit();
}

/* ------------------------------------------------------------------ */
/* Timer                                                               */
/* ------------------------------------------------------------------ */

export function setTimerDuration(seconds) {
  seconds = Math.max(1, Math.round(Number(seconds) || 0));
  const t = state.timer;
  t.duration = seconds;
  t.remaining = seconds;
  t.running = false;
  t.endsAt = null;
  log('timer', `Timer set to ${fmtClock(seconds)}.`);
  emit();
}

export function startTimer(label) {
  const t = state.timer;
  if (label != null) t.label = label;
  if (t.remaining <= 0) t.remaining = t.duration;
  t.running = true;
  t.endsAt = Date.now() + t.remaining * 1000;
  log('timer', `Countdown STARTED · ${fmtClock(t.remaining)} remaining.`);
  emit();
}

export function pauseTimer() {
  const t = state.timer;
  if (!t.running) return;
  t.remaining = remainingSeconds();
  t.running = false;
  t.endsAt = null;
  log('timer', `Countdown PAUSED at ${fmtClock(t.remaining)}.`);
  emit();
}

export function resetTimer(label) {
  const t = state.timer;
  t.running = false;
  t.endsAt = null;
  t.remaining = t.duration;
  if (label != null) t.label = label;
  log('timer', `Countdown RESET to ${fmtClock(t.duration)}.`);
  emit();
}

export function tickTimer() {
  const t = state.timer;
  if (!t.running) return false;
  const left = remainingSeconds();
  if (left !== t.remaining) {
    t.remaining = left;
    if (left <= 0) {
      t.running = false;
      t.endsAt = null;
      announce('⏰ TIME UP in the Tech House — task window has closed.', 'alert');
      log('timer', 'Countdown reached zero. TIME UP.');
      emit();
      return true;
    }
    save();
    return true;
  }
  return false;
}

export function remainingSeconds() {
  const t = state.timer;
  if (!t.running || !t.endsAt) return Math.max(0, t.remaining);
  return Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
}

export function fmtClock(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (h ? `${String(h).padStart(2, '0')}:` : '') +
    `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

export function announce(message, tone = 'info') {
  message = String(message || '').trim();
  if (!message) throw new Error('Announcement cannot be empty.');
  const a = { id: uid('a'), message, tone, createdAt: Date.now() };
  state.announcements.unshift(a);
  state.announcements = state.announcements.slice(0, 100);
  emit();
  return a;
}

export function deleteAnnouncement(id) {
  state.announcements = state.announcements.filter((x) => x.id !== id);
  emit();
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export function stats() {
  const act = activeContestants();
  const board = ranked();
  const done = state.tasks.filter((t) => t.status === 'completed');
  const openTasks = state.tasks.filter((t) => t.status !== 'completed');
  const totalPoints = act.reduce((s, x) => s + x.points, 0);
  const teamMap = {};
  TEAMS.forEach((t) => (teamMap[t] = { team: t, points: 0, members: 0, tasks: 0 }));
  act.forEach((x) => {
    if (!teamMap[x.team]) teamMap[x.team] = { team: x.team, points: 0, members: 0, tasks: 0 };
    teamMap[x.team].points += x.points;
    teamMap[x.team].members += 1;
    teamMap[x.team].tasks += x.tasksCompleted;
  });

  const teams = Object.values(teamMap).sort((a, b) => b.points - a.points);
  const mvp = board[0] || null;
  const mostTasks = act.slice().sort((a, b) => b.tasksCompleted - a.tasksCompleted)[0] || null;
  const dz = dangerZone();

  return {
    total: state.contestants.length,
    active: act.length,
    evicted: state.contestants.length - act.length,
    immune: act.filter((x) => x.immunity).length,
    nominated: dz.length,
    tasksTotal: state.tasks.length,
    tasksDone: done.length,
    tasksOpen: openTasks.length,
    completionRate: state.tasks.length ? Math.round((done.length / state.tasks.length) * 100) : 0,
    totalPoints,
    avgPoints: act.length ? Math.round(totalPoints / act.length) : 0,
    mvp,
    mostTasks,
    dangerZone: dz,
    teams,
    leader: teams[0] || null,
    captain: captain(),
    round: state.nominationRound,
  };
}

/* ------------------------------------------------------------------ */
/* Danger Zone controls                                                */
/* ------------------------------------------------------------------ */

export function castEvictionVote(id, reason = '') {
  const p = c(id);
  if (!p) return;
  if (p.status === 'evicted') throw new Error(`${p.name} has already been evicted.`);
  if (p.immunity) throw new Error(`${p.name} holds immunity — they cannot be evicted this round.`);
  evict(id, reason || 'Evicted by House vote');
}

/* ------------------------------------------------------------------ */
/* Bulk / settings                                                     */
/* ------------------------------------------------------------------ */

export function resetAll() {
  state = seed();
  log('session', 'House reset. Fresh season seeded with 12 contestants.');
  emit();
}

export function clearHouse() {
  state = {
    ...seed(),
    contestants: [],
    tasks: [],
    announcements: [],
    log: [],
  };
  state.log = [entry('session', 'Empty House created. Add contestants to begin.')];
  emit();
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.contestants)) throw new Error('Invalid backup file.');
  state = parsed;
  state.tasks ||= [];
  state.announcements ||= [];
  state.log ||= [];
  state.timer ||= { duration: 600, remaining: 600, running: false, endsAt: null, label: 'Task Timer' };
  log('session', 'House data restored from backup.');
  emit();
}

export function advanceDay() {
  state.house.day += 1;
  log('session', `Day ${state.house.day} in the House has begun.`);
  emit();
}

export { EVT, STORAGE_KEY };
