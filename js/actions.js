/**
 * Action layer — one registry for every `data-action` in the UI.
 *
 * Views only emit markup with `data-action="namespace:verb"`; this module maps
 * those verbs onto store dispatches, modals, toasts and the Big Boss banner.
 * Every throw from the reducer is converted into a toast, so House rules are
 * enforced in one place and reported in one place.
 */
import { $, $$, esc, formatClock } from './utils/dom.js';
import { icon } from './utils/icons.js';
import { store, selectors, TEAMS } from './store/index.js';
import { openModal, confirmModal, closeModal } from './ui/modal.js';
import { toast, toastSuccess, toastInfo, toastError, toastBlocked, toastFromError } from './ui/toast.js';
import { showBanner } from './ui/banner.js';
import { toggleMenu } from './ui/menu.js';
import { glitchFlash, resetCounters } from './motion.js';
import { createSeed } from './store/seed.js';
import * as forms from './components/ModalForms.js';

let navigate = () => {};
let refresh = () => {};
let ghostRemoval = () => {};

export function installActions(context) {
  navigate = context.navigate;
  refresh = context.refresh;
  ghostRemoval = context.ghostRemoval;
}

const state = () => store.getState();
const contestant = (id) => state().contestants.find((c) => c.id === id);

/** Dispatch and translate any House-rule violation into a toast. */
function dispatch(action, { success, info } = {}) {
  try {
    store.dispatch(action);
    if (success) toastSuccess(success);
    if (info) toastInfo(info);
    return true;
  } catch (error) {
    toastFromError(error);
    return false;
  }
}

const checkedIds = (scope) => $$('input[type="checkbox"]:checked', scope).map((input) => input.value);

/* ══ Handlers ═══════════════════════════════════════════════════════════ */

const handlers = {
  /* ── Shell ─────────────────────────────────────────────────────────── */
  'nav:go': ({ element }) => navigate(element.dataset.view),

  'menu:toggle': ({ element }) => toggleMenu(element),

  'ui:sidebar': () => {
    const collapsed = state().ui.sidebar === 'collapsed';
    store.dispatch({ type: 'ui/patch', payload: { sidebar: collapsed ? 'expanded' : 'collapsed' } });
  },

  'ui:onboarded': () => {
    store.dispatch({ type: 'ui/patch', payload: { onboarded: true } });
    toastInfo('Big Boss is watching. Welcome to the Command Center.', 'Control room online');
  },

  'help:open': () =>
    openModal({
      title: 'Keyboard shortcuts',
      desc: 'The Command Center is built to be driven without the mouse.',
      body: forms.ShortcutsBody(),
      actions: [{ label: 'Close' }],
    }),

  /* ── Point system ──────────────────────────────────────────────────── */
  'points:quick': ({ element }) => {
    const person = contestant(element.dataset.id);
    if (!person) return;
    const delta = Number(element.dataset.delta);
    dispatch(
      { type: 'points/adjust', payload: { id: person.id, delta, reason: 'Quick adjustment' } },
      { success: `${delta > 0 ? '+' : ''}${delta} points to ${person.name}` },
    );
  },

  'points:open': ({ element }) => {
    const person = contestant(element.dataset.id);
    if (!person) return;
    openModal({
      title: 'Adjust House points',
      desc: 'Add or deduct points with an audit trail.',
      body: forms.PointsForm(person),
      actions: [
        { label: 'Cancel', tone: 'ghost' },
        {
          label: 'Apply points',
          primary: true,
          icon: 'zap',
          onClick: (body) => {
            const delta = Number($('#pointsDelta', body).value);
            const reason = $('#pointsReason', body).value;
            return dispatch(
              { type: 'points/adjust', payload: { id: person.id, delta, reason } },
              { success: `${delta > 0 ? '+' : ''}${delta} points applied to ${person.name}` },
            )
              ? undefined
              : false;
          },
        },
      ],
      onOpen: (body) => {
        $$('[data-quick-delta]', body).forEach((button) =>
          button.addEventListener('click', () => {
            const input = $('#pointsDelta', body);
            input.value = String(Number(input.value || 0) + Number(button.dataset.quickDelta));
            input.focus();
          }),
        );
      },
    });
  },

  /* ── Contestants ───────────────────────────────────────────────────── */
  'contestant:add': () =>
    openModal({
      title: 'Open the door',
      desc: 'Every contestant needs a name and a team. Points start at zero.',
      body: forms.ContestantForm(null, TEAMS),
      actions: [
        { label: 'Cancel', tone: 'ghost' },
        {
          label: 'Add to House',
          primary: true,
          icon: 'user-plus',
          onClick: (body) => {
            const name = $('#contestantName', body).value;
            const team = $('#contestantTeam', body).value;
            const points = $('#contestantPoints', body).value;
            const ok = dispatch(
              { type: 'contestant/add', payload: { name, team, points } },
              { success: `${name.trim()} entered the ${state().house.name}.` },
            );
            if (ok) showBanner(`${name.trim()}, welcome to the ${state().house.name}. Team ${team} — good luck.`, 'info', { duration: 6000 });
            return ok ? undefined : false;
          },
        },
      ],
    }),

  'contestant:edit': ({ element }) => {
    const person = contestant(element.dataset.id);
    if (!person) return;
    openModal({
      title: `Edit ${person.name}`,
      desc: 'Update the House record. Points keep their own audit trail.',
      body: forms.ContestantForm(person, [...new Set([...TEAMS, person.team])]),
      actions: [
        { label: 'Cancel', tone: 'ghost' },
        {
          label: 'Save changes',
          primary: true,
          icon: 'check',
          onClick: (body) =>
            dispatch(
              {
                type: 'contestant/update',
                payload: {
                  id: person.id,
                  name: $('#contestantName', body).value,
                  team: $('#contestantTeam', body).value,
                  points: $('#contestantPoints', body).value,
                  notes: $('#contestantNotes', body).value,
                },
              },
              { success: 'Contestant record updated.' },
            )
              ? undefined
              : false,
        },
      ],
    });
  },

  /* ── Captaincy ─────────────────────────────────────────────────────── */
  'captain:open': () => {
    const board = selectors.leaderboard(state());
    if (!board.length) return toastError('No active contestants to appoint.');
    openModal({
      title: 'Appoint House Captain',
      desc: 'Only one Captain leads at a time. The Captain cannot be nominated while in office.',
      body: `<div class="checkbox-list">${board
        .map(
          (person) => `
        <label class="checkbox-chip ${person.isCaptain ? 'is-on' : ''}">
          <input type="radio" name="captainPick" value="${esc(person.id)}" ${person.isCaptain ? 'checked' : ''} />
          <span>${esc(person.name)}</span>
          <span class="fs-xs muted">${person.points} pts</span>
        </label>`,
        )
        .join('')}</div>`,
      actions: [
        { label: 'Cancel', tone: 'ghost' },
        {
          label: 'Appoint Captain',
          primary: true,
          icon: 'crown',
          onClick: (body) => {
            const picked = $('input[name="captainPick"]:checked', body);
            if (!picked) {
              toastError('Select a contestant first.');
              return false;
            }
            const ok = dispatch(
              { type: 'captain/set', payload: { id: picked.value } },
              { success: `${contestant(picked.value)?.name} is the new House Captain.` },
            );
            if (ok) {
              const person = contestant(picked.value);
              showBanner(`${person.name} is the new House Captain. The House answers to them now.`, 'accent', { duration: 7000 });
            }
            return ok ? undefined : false;
          },
        },
      ],
    });
  },

  'captain:set': ({ element }) => {
    const person = contestant(element.dataset.id);
    if (!person) return;
    const ok = dispatch({ type: 'captain/set', payload: { id: person.id } }, { success: `${person.name} is the new House Captain.` });
    if (ok) showBanner(`${person.name} is the new House Captain of the ${state().house.name}.`, 'accent', { duration: 7000 });
  },

  'captain:revoke': () => {
    const captain = selectors.houseCaptain(state());
    if (!captain) return;
    confirmModal({
      title: 'Close the Captaincy?',
      desc: `${captain.name} will lose Captain privileges and become eligible for nomination.`,
      confirmLabel: 'Revoke captaincy',
      onConfirm: () => dispatch({ type: 'captain/revoke' }, { success: 'Captaincy is now vacant.' }),
    });
  },

  /* ── Immunity ──────────────────────────────────────────────────────── */
  'immunity:open': ({ element }) => {
    const preset = element.dataset.id || '';
    const eligible = selectors.activeContestants(state()).filter((c) => !c.immunity);
    if (!eligible.length) return toastError('Every active contestant already holds immunity.');
    openModal({
      title: 'Grant immunity',
      desc: 'Immune contestants cannot be nominated. Any existing nomination is revoked.',
      body: forms.ImmunityForm(eligible, preset),
      actions: [
        { label: 'Cancel', tone: 'ghost' },
        {
          label: 'Grant immunity',
          tone: 'success',
          icon: 'shield',
          onClick: (body) => {
            const ids = checkedIds(body);
            if (!ids.length) {
              toastError('Select at least one contestant.');
              return false;
            }
            const reason = $('#immunityReason', body)?.value || '';
            const names = ids.map((id) => contestant(id)?.name).filter(Boolean).join(', ');
            const ok = dispatch(
              { type: 'immunity/grant', payload: { ids, reason } },
              { success: `Immunity granted to ${names}.` },
            );
            if (ok) showBanner(`${names} won immunity. The House cannot touch them.`, 'success', { duration: 7000 });
            return ok ? undefined : false;
          },
        },
      ],
    });
  },

  'immunity:grant': ({ element }) => {
    const person = contestant(element.dataset.id);
    if (!person) return;
    const ok = dispatch(
      { type: 'immunity/grant', payload: { id: person.id, reason: 'Granted by Big Boss' } },
      { success: `${person.name} is now immune.` },
    );
    if (ok) showBanner(`${person.name} holds immunity. Nomination denied.`, 'success', { duration: 6000 });
  },

  'immunity:revoke': ({ element }) => {
    const person = contestant(element.dataset.id);
    if (!person) return;
    dispatch({ type: 'immunity/revoke', payload: { id: person.id } }, { info: `Immunity revoked for ${person.name}.` });
  },

  /* ── Nominations ───────────────────────────────────────────────────── */
  'nomination:open': ({ element }) => {
    const preset = element.dataset.id || '';
    const eligible = selectors.eligibleForNomination(state());
    if (!eligible.length) return toastError('No eligible contestants — everyone is protected or already nominated.');
    openModal({
      title: 'Nominate for eviction',
      desc: 'Selected contestants enter the Danger Zone for this round.',
      body: forms.NominationForm(eligible, preset),
      actions: [
        { label: 'Cancel', tone: 'ghost' },
        {
          label: 'Send to Danger Zone',
          tone: 'danger',
          icon: 'alert',
          onClick: (body) => {
            const ids = checkedIds(body);
            if (!ids.length) {
              toastError('Select at least one contestant to nominate.');
              return false;
            }
            const reason = $('#nominationReason', body)?.value || '';
            const names = ids.map((id) => contestant(id)?.name).filter(Boolean).join(', ');
            const ok = dispatch(
              { type: 'nomination/add', payload: { ids, reason } },
              { info: `${names} moved to the Danger Zone.` },
            );
            if (ok) showBanner(`${names} — you are nominated for eviction. Face the House.`, 'alert', { duration: 8000 });
            return ok ? undefined : false;
          },
        },
      ],
    });
  },

  'nomination:add': ({ element }) => {
    const person = contestant(element.dataset.id);
    if (!person) return;
    const ok = dispatch(
      { type: 'nomination/add', payload: { id: person.id, reason: 'Nominated by Big Boss' } },
      { info: `${person.name} is in the Danger Zone.` },
    );
    if (ok) showBanner(`${person.name} — you have been nominated for eviction.`, 'alert', { duration: 7000 });
  },

  'nomination:selected': () => {
    const ids = checkedIds($('#inlineNominationPicker') || document);
    if (!ids.length) return toastError('Select at least one contestant to nominate.');
    const reason = $('#inlineNominationReason')?.value || '';
    const names = ids.map((id) => contestant(id)?.name).filter(Boolean).join(', ');
    const ok = dispatch({ type: 'nomination/add', payload: { ids, reason } }, { info: `${names} moved to the Danger Zone.` });
    if (ok) showBanner(`${names} — you are nominated for eviction this round.`, 'alert', { duration: 8000 });
  },

  'nomination:blocked': ({ element }) => {
    const person = contestant(element.dataset.id);
    if (!person) return;
    if (person.nomination) return toastBlocked(`${person.name} is already in the Danger Zone for round ${person.nomination.round}.`);
    if (person.immunity) return toastBlocked(`${person.name} holds immunity — nomination denied.`);
    if (person.isCaptain) return toastError(`${person.name} is the House Captain — protected from nomination while in office.`);
    navigate('nominations');
  },

  'nomination:withdraw': ({ element }) => {
    const person = contestant(element.dataset.id);
    if (!person) return;
    dispatch({ type: 'nomination/withdraw', payload: { id: person.id } }, { info: `Nomination withdrawn for ${person.name}.` });
  },

  'nomination:clear': () =>
    confirmModal({
      title: 'Clear the Danger Zone?',
      desc: 'All current nominations will be withdrawn. Contestants stay in the House.',
      confirmLabel: 'Clear nominations',
      onConfirm: () => dispatch({ type: 'nomination/clear' }, { success: 'Danger Zone cleared.' }),
    }),

  'nomination:nextRound': () =>
    confirmModal({
      title: 'Open a new nomination round?',
      desc: 'The Danger Zone empties and the round counter advances.',
      confirmLabel: 'Start next round',
      tone: 'primary',
      onConfirm: () =>
        dispatch({ type: 'nomination/nextRound' }, { success: `Round ${state().nominationRound} nominations opened.` }),
    }),

  /* ── Evictions ─────────────────────────────────────────────────────── */
  'eviction:open': ({ element }) => {
    const person = contestant(element.dataset.id);
    if (!person) return;
    const rank = selectors.rankOf(state(), person.id);
    openModal({
      title: person.immunity ? `Override immunity and evict ${person.name}?` : `Evict ${person.name}?`,
      desc: person.immunity
        ? 'This contestant holds immunity. Only Big Boss can overrule it — the override is recorded.'
        : 'Evicted contestants leave the leaderboard and their task assignments are released. They can be reinstated later.',
      body: forms.EvictionForm(person, rank),
      actions: [
        { label: 'Cancel', tone: 'ghost' },
        {
          label: person.immunity ? 'Override & evict' : 'Evict now',
          tone: 'danger',
          icon: 'door',
          onClick: (body) => {
            const reason = $('#evictionReason', body).value;
            ghostRemoval(element.closest('.contestant, .lb-row, .danger-item') || element);
            const ok = dispatch(
              { type: 'eviction/evict', payload: { id: person.id, reason } },
              { info: `${person.name} has been evicted.` },
            );
            if (ok) {
              glitchFlash();
              showBanner(
                `${person.name}, the House has spoken. Please pack your bags and leave the ${state().house.name}.`,
                'alert',
                { duration: 9000 },
              );
            }
            return ok ? undefined : false;
          },
        },
      ],
    });
  },

  'eviction:round': () => {
    const nominees = selectors.dangerZone(state());
    if (!nominees.length) return toastError('Nobody is in the Danger Zone. There is no vote to run.');
    const names = nominees.map((c) => c.name).join(', ');
    confirmModal({
      title: 'Run the eviction vote?',
      desc: `${nominees.length} nominee${nominees.length === 1 ? '' : 's'} will be evicted from the House.`,
      body: `<div class="checkbox-list">${nominees
        .map((person) => `<span class="chip chip--plain">${esc(person.name)} · ${person.points} pts</span>`)
        .join('')}</div>`,
      confirmLabel: `Evict ${nominees.length} contestant${nominees.length === 1 ? '' : 's'}`,
      onConfirm: () => {
        const ok = dispatch({ type: 'eviction/evictRound' }, { info: 'The House has voted.' });
        if (ok) {
          glitchFlash();
          showBanner(`${names} — the House has voted. You must leave the ${state().house.name} tonight.`, 'alert', {
            duration: 10000,
          });
        }
      },
    });
  },

  'eviction:reinstate': ({ element }) => {
    const person = contestant(element.dataset.id);
    if (!person) return;
    const ok = dispatch({ type: 'eviction/reinstate', payload: { id: person.id } }, { success: `${person.name} is back in the House.` });
    if (ok) showBanner(`${person.name} has been reinstated into the ${state().house.name} by Big Boss.`, 'info', { duration: 6000 });
  },

  'eviction:purge': ({ element }) => {
    const person = contestant(element.dataset.id);
    if (!person) return;
    confirmModal({
      title: `Delete ${person.name} permanently?`,
      desc: 'The House record is erased for good. This cannot be undone — reinstating will not be possible.',
      confirmLabel: 'Delete permanently',
      onConfirm: () => dispatch({ type: 'contestant/remove', payload: { id: person.id } }, { info: `${person.name} deleted from the record.` }),
    });
  },

  /* ── Tasks ─────────────────────────────────────────────────────────── */
  'task:open': () => {
    const active = selectors.activeContestants(state());
    if (!active.length) return toastError('No active contestants to assign tasks to.');
    openModal({
      title: 'Assign a House task',
      desc: 'Assignees earn the task points the moment Big Boss marks it complete.',
      body: forms.TaskForm(active),
      actions: [
        { label: 'Cancel', tone: 'ghost' },
        {
          label: 'Assign task',
          primary: true,
          icon: 'plus',
          onClick: (body) => {
            const title = $('#taskTitle', body).value;
            const ids = checkedIds(body);
            const ok = dispatch(
              {
                type: 'task/create',
                payload: {
                  title,
                  description: $('#taskDescription', body).value,
                  points: $('#taskPoints', body).value,
                  assignees: ids,
                },
              },
              { success: `Task "${title.trim()}" assigned to ${ids.length} contestant(s).` },
            );
            if (ok) showBanner(`New task: ${title.trim()}. Worth ${$('#taskPoints', body)?.value || 0} points each.`, 'accent', { duration: 7000 });
            return ok ? undefined : false;
          },
        },
      ],
      onOpen: (body) => {
        $$('[data-task-preset]', body).forEach((button) =>
          button.addEventListener('click', () => {
            $('#taskTitle', body).value = button.dataset.taskPreset;
            $('#taskPoints', body).value = button.dataset.taskPoints;
            $('#taskTitle', body).focus();
          }),
        );
        $$('[data-select]', body).forEach((button) =>
          button.addEventListener('click', () => {
            const on = button.dataset.select === 'all';
            $$('.checkbox-chip input', body).forEach((input) => {
              input.checked = on;
              input.closest('.checkbox-chip').classList.toggle('is-on', on);
            });
          }),
        );
      },
    });
  },

  'task:start': ({ element }) =>
    dispatch({ type: 'task/status', payload: { id: element.dataset.id, status: 'active' } }, { info: 'Task marked in progress.' }),

  'task:pending': ({ element }) =>
    dispatch({ type: 'task/status', payload: { id: element.dataset.id, status: 'pending' } }, { info: 'Task moved back to pending.' }),

  'task:complete': ({ element }) => {
    const task = state().tasks.find((t) => t.id === element.dataset.id);
    if (!task) return;
    const ok = dispatch({ type: 'task/status', payload: { id: task.id, status: 'completed' } }, { success: 'Task completed — points awarded.' });
    if (ok) showBanner(`Task "${task.title}" is complete. ${task.points} points awarded to each winner.`, 'success', { duration: 7000 });
  },

  'task:reopen': ({ element }) =>
    dispatch({ type: 'task/status', payload: { id: element.dataset.id, status: 'active' } }, { info: 'Task reopened — points are not refunded.' }),

  'task:fail': ({ element }) =>
    dispatch({ type: 'task/status', payload: { id: element.dataset.id, status: 'failed' } }, { info: 'Task marked as failed.' }),

  'task:delete': ({ element }) => {
    const task = state().tasks.find((t) => t.id === element.dataset.id);
    if (!task) return;
    confirmModal({
      title: `Delete "${task.title}"?`,
      desc: 'The task and its assignment history will be removed.',
      confirmLabel: 'Delete task',
      onConfirm: () => dispatch({ type: 'task/delete', payload: { id: task.id } }, { info: 'Task deleted.' }),
    });
  },

  /* ── Timer ─────────────────────────────────────────────────────────── */
  'timer:start': () => dispatch({ type: 'timer/start' }, { info: 'Countdown started.' }),
  'timer:pause': () => dispatch({ type: 'timer/pause' }, { info: `Countdown paused at ${formatClock(selectors.timerView(state()).remaining)}.` }),
  'timer:reset': () => dispatch({ type: 'timer/reset' }, { info: 'Countdown reset.' }),
  'timer:toggle': () => {
    const timer = selectors.timerView(state());
    return timer.running ? dispatch({ type: 'timer/pause' }) : dispatch({ type: 'timer/start' });
  },

  'timer:preset': ({ element }) => {
    const seconds = Number(element.dataset.seconds);
    dispatch({ type: 'timer/setDuration', payload: { seconds } }, { info: `Timer set to ${formatClock(seconds)}.` });
  },

  'timer:custom': () =>
    openModal({
      title: 'Set the task timer',
      desc: 'Choose a duration, then start the clock when the House is ready.',
      body: forms.TimerCustomForm(state().timer),
      actions: [
        { label: 'Cancel', tone: 'ghost' },
        {
          label: 'Set timer',
          primary: true,
          icon: 'clock',
          onClick: (body) => {
            const seconds =
              Number($('#timerMinutes', body).value || 0) * 60 + Number($('#timerSeconds', body).value || 0);
            const label = $('#timerCustomLabel', body).value;
            const ok = dispatch(
              { type: 'timer/setDuration', payload: { seconds } },
              { success: `Timer set to ${formatClock(seconds)}.` },
            );
            if (ok && label) store.dispatch({ type: 'timer/label', payload: { label } });
            return ok ? undefined : false;
          },
        },
      ],
      onOpen: (body) => {
        $$('[data-timer-quick]', body).forEach((button) =>
          button.addEventListener('click', () => {
            const seconds = Number(button.dataset.timerQuick);
            $('#timerMinutes', body).value = String(Math.floor(seconds / 60));
            $('#timerSeconds', body).value = String(seconds % 60);
          }),
        );
      },
    }),

  'timer:label': () => {
    const input = $('#timerLabelInput');
    if (!input) return;
    dispatch({ type: 'timer/label', payload: { label: input.value } }, { success: 'Timer label updated.' });
  },

  /* ── Announcements ─────────────────────────────────────────────────── */
  'announcement:open': () =>
    openModal({
      title: 'Big Boss announcement',
      desc: 'Your message takes over the House screen with a cinematic banner.',
      body: forms.AnnouncementForm('', 'accent'),
      actions: [
        { label: 'Cancel', tone: 'ghost' },
        {
          label: 'Broadcast',
          primary: true,
          icon: 'megaphone',
          onClick: (body) => {
            const message = $('#announcementMessage', body).value;
            const tone = $('#announcementTone', body).value;
            const ok = dispatch({ type: 'announcement/add', payload: { message, tone } }, { success: 'Broadcast sent to the House.' });
            if (ok) showBanner(message.trim(), tone, { duration: 9000 });
            return ok ? undefined : false;
          },
        },
      ],
      onOpen: (body) => {
        $$('[data-announce-preset]', body).forEach((button) =>
          button.addEventListener('click', () => {
            $('#announcementMessage', body).value = button.dataset.announcePreset;
            $('#announcementTone', body).value = button.dataset.announceTone;
          }),
        );
      },
    }),

  'announcement:send': () => {
    const message = $('#composerMessage')?.value || '';
    const tone = $('#composerTone')?.value || 'accent';
    const ok = dispatch({ type: 'announcement/add', payload: { message, tone } }, { success: 'Broadcast sent to the House.' });
    if (ok) showBanner(message.trim(), tone, { duration: 9000 });
  },

  'announcement:replay': ({ element }) => {
    const announcement = state().announcements.find((a) => a.id === element.dataset.id);
    if (!announcement) return;
    showBanner(announcement.message, announcement.tone, { duration: 9000 });
  },

  'announcement:delete': ({ element }) =>
    dispatch({ type: 'announcement/delete', payload: { id: element.dataset.id } }, { info: 'Announcement removed from the archive.' }),

  /* ── Log & house data ──────────────────────────────────────────────── */
  'log:clear': () =>
    confirmModal({
      title: 'Clear the activity log?',
      desc: 'The full House event history will be erased. Contestants and tasks are untouched.',
      confirmLabel: 'Clear log',
      onConfirm: () => dispatch({ type: 'log/clear' }, { success: 'Activity log cleared.' }),
    }),

  'advance-day': () => dispatch({ type: 'house/advanceDay' }, { success: `Day ${state().house.day} has begun.` }),

  'house:save': () =>
    dispatch(
      {
        type: 'house/update',
        payload: { name: $('#houseNameInput')?.value, season: $('#houseSeasonInput')?.value },
      },
      { success: 'House configuration saved.' },
    ),

  'house:export': () => {
    const blob = new Blob([JSON.stringify(state(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `command-center-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toastSuccess('House backup downloaded.');
  },

  'house:import': () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!parsed || !Array.isArray(parsed.contestants)) throw new Error('That file is not a Command Center backup.');
        store.dispatch({ type: 'house/hydrate', payload: { state: parsed } });
        resetCounters();
        toastSuccess('House data restored from backup.');
      } catch (error) {
        toastFromError(error);
      }
    });
    input.click();
  },

  'house:reset': () =>
    confirmModal({
      title: 'Reset demo data?',
      desc: 'The 12-contestant demo season is restored. Everything currently in the House is replaced.',
      confirmLabel: 'Reset demo data',
      onConfirm: () => {
        store.dispatch({ type: 'house/reset', payload: { state: createSeed() } });
        resetCounters();
        toastSuccess('Demo season restored.');
        showBanner('The House has been reset. A new season begins. Big Boss is watching.', 'accent', { duration: 7000 });
      },
    }),

  'house:clear': () =>
    confirmModal({
      title: 'Empty the House?',
      desc: 'Every contestant, task, announcement and log entry will be deleted.',
      confirmLabel: 'Empty the House',
      onConfirm: () => {
        const empty = createSeed();
        store.dispatch({
          type: 'house/reset',
          payload: { state: { ...empty, contestants: [], tasks: [], announcements: [], log: [], nominationRound: 1 } },
        });
        resetCounters();
        toastInfo('The House is empty. Add contestants to begin.', 'Empty House');
      },
    }),

  /* Modal buttons are handled by the modal module itself. */
  'modal:action': () => {},
};

/* ══ Delegation ════════════════════════════════════════════════════════ */

export function initActions() {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const name = target.dataset.action;
    const handler = handlers[name];
    if (!handler) return;

    // Let the modal module own its own buttons.
    if (target.closest('#modalFoot')) return;

    event.preventDefault();
    try {
      handler({ element: target, id: target.dataset.id, state: state(), navigate, refresh, closeModal });
    } catch (error) {
      toastFromError(error);
    }
  });
}

export { handlers };
