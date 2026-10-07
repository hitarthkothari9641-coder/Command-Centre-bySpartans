/** Demo season used on first load and by "Reset demo data". */
export const TEAMS = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

const ROSTER = [
  ['Aarav Mehta', 'Alpha', 180],
  ['Zara Khan', 'Alpha', 165],
  ['Rohan Iyer', 'Alpha', 140],
  ['Isha Verma', 'Bravo', 155],
  ['Kabir Shah', 'Bravo', 120],
  ['Naina Rao', 'Bravo', 95],
  ['Devansh Gupta', 'Charlie', 170],
  ['Meera Nair', 'Charlie', 145],
  ['Arjun Singh', 'Charlie', 110],
  ['Sanya Kapoor', 'Delta', 130],
  ['Vihaan Joshi', 'Delta', 100],
  ['Tara Bose', 'Delta', 85],
];

export function createSeed() {
  const now = Date.now();

  const contestants = ROSTER.map(([name, team, points], index) => ({
    id: `c${index + 1}`,
    name,
    team,
    points,
    status: 'active', // active | evicted
    immunity: false,
    nomination: null, // { round, reason, at }
    isCaptain: false,
    tasksCompleted: 0,
    joinedAt: now,
    evictedAt: null,
    evictionReason: '',
    notes: '',
  }));

  // Devansh Gupta leads the House as Captain.
  contestants[6].isCaptain = true;
  // Task t1 is already complete, so its assignees carry a completed-task count.
  contestants[0].tasksCompleted = 1;
  contestants[6].tasksCompleted = 1;

  return {
    version: 2,
    house: { name: 'Tech House', season: 1, day: 1 },
    nominationRound: 1,
    contestants,
    tasks: [
      {
        id: 't1',
        title: 'Build the Landing Page',
        description: 'Ship a responsive landing page with a working call to action.',
        assignees: ['c1', 'c7'],
        points: 50,
        status: 'completed',
        createdAt: now - 86400000,
        completedAt: now - 3600000,
      },
      {
        id: 't2',
        title: 'Debug the Arena API',
        description: 'Find and fix the failing endpoint before the buzzer sounds.',
        assignees: ['c4', 'c10'],
        points: 40,
        status: 'active',
        createdAt: now - 7200000,
        completedAt: null,
      },
      {
        id: 't3',
        title: 'Design the House Banner',
        description: 'A minimalist banner that represents the Tech House identity.',
        assignees: ['c8'],
        points: 30,
        status: 'pending',
        createdAt: now - 1800000,
        completedAt: null,
      },
    ],
    timer: {
      duration: 600,
      remaining: 600,
      running: false,
      endsAt: null,
      label: 'Coding Sprint',
    },
    announcements: [
      {
        id: 'a1',
        message: 'Welcome to the Tech House. Big Boss is watching every commit.',
        tone: 'accent',
        createdAt: now - 5400000,
      },
    ],
    log: [],
    ui: {
      sidebar: 'expanded',
      background: true,
      onboarded: false,
      activeView: 'dashboard',
    },
  };
}
