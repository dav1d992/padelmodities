/**
 * One-off script: creates the historical Super Mexicano tournament in Firebase
 * and applies the Elo / stats updates to every involved player.
 *
 * Run once:  node scripts/seed-smex-tournament.mjs
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, update, push } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyB7SZ13SfuXO6dbnHvNiiOCDIKDgViXCcg',
  authDomain: 'padelmodities.firebaseapp.com',
  databaseURL: 'https://padelmodities-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'padelmodities',
  storageBucket: 'padelmodities.firebasestorage.app',
  messagingSenderId: '413086928078',
  appId: '1:413086928078:web:fe2dbd98fda05c708fd49f',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ---------------------------------------------------------------------------
// Match data from the image (a1/a2 = left side, b1/b2 = right side)
// Player names exactly as they appear in the database.
// ---------------------------------------------------------------------------
const MATCHES_BY_ROUND = [
  // Round 0
  [
    { court: 0, a: ['David W. Lo', 'Pingan Cheng'],                    b: ['Mikkel Bendixen', 'Dann Vestergaard'],          s1: 4,  s2: 28 },
    { court: 1, a: ['Edouard Tolipova-Gourdin', 'Mikkel L. Uhrenholt'], b: ['Jakob B. Petersen', 'Louise K. Jensen'],        s1: 25, s2: 7  },
  ],
  // Round 1
  [
    { court: 0, a: ['Dann Vestergaard', 'Mikkel L. Uhrenholt'],         b: ['Mikkel Bendixen', 'Edouard Tolipova-Gourdin'],  s1: 15, s2: 17 },
    { court: 1, a: ['Jakob B. Petersen', 'Pingan Cheng'],               b: ['David W. Lo', 'Louise K. Jensen'],              s1: 21, s2: 11 },
  ],
  // Round 2
  [
    { court: 0, a: ['Dann Vestergaard', 'Mikkel L. Uhrenholt'],         b: ['Mikkel Bendixen', 'Edouard Tolipova-Gourdin'],  s1: 13, s2: 19 },
    { court: 1, a: ['David W. Lo', 'Pingan Cheng'],                    b: ['Jakob B. Petersen', 'Louise K. Jensen'],        s1: 22, s2: 10 },
  ],
  // Round 3
  [
    { court: 0, a: ['Edouard Tolipova-Gourdin', 'Mikkel L. Uhrenholt'], b: ['Mikkel Bendixen', 'Dann Vestergaard'],          s1: 10, s2: 22 },
    { court: 1, a: ['Jakob B. Petersen', 'Louise K. Jensen'],           b: ['David W. Lo', 'Pingan Cheng'],                  s1: 11, s2: 21 },
  ],
  // Round 4
  [
    { court: 0, a: ['Pingan Cheng', 'Dann Vestergaard'],                b: ['Mikkel Bendixen', 'Edouard Tolipova-Gourdin'],  s1: 15, s2: 17 },
    { court: 1, a: ['David W. Lo', 'Louise K. Jensen'],                 b: ['Jakob B. Petersen', 'Mikkel L. Uhrenholt'],     s1: 12, s2: 20 },
  ],
  // Round 5
  [
    { court: 0, a: ['Dann Vestergaard', 'Mikkel L. Uhrenholt'],         b: ['Mikkel Bendixen', 'Edouard Tolipova-Gourdin'],  s1: 17, s2: 15 },
    { court: 1, a: ['David W. Lo', 'Louise K. Jensen'],                 b: ['Jakob B. Petersen', 'Pingan Cheng'],            s1: 15, s2: 17 },
  ],
];

const PLAYER_NAMES = [
  'David W. Lo', 'Pingan Cheng', 'Dann Vestergaard', 'Mikkel Bendixen',
  'Mikkel L. Uhrenholt', 'Edouard Tolipova-Gourdin', 'Jakob B. Petersen', 'Louise K. Jensen',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function eloExpected(ra, rb) {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

function computeDeltas(match, ratings) {
  const r = (id) => ratings[id] ?? 1000;
  const teamA = (r(match.a1) + r(match.a2)) / 2;
  const teamB = (r(match.b1) + r(match.b2)) / 2;
  const expA = eloExpected(teamA, teamB);
  const expB = 1 - expA;
  const total = match.score1 + match.score2;
  const actA = total > 0 ? match.score1 / total : 0.5;
  const actB = 1 - actA;
  const K = 32;
  return {
    [match.a1]: K * (actA - expA),
    [match.a2]: K * (actA - expA),
    [match.b1]: K * (actB - expB),
    [match.b2]: K * (actB - expB),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const playersSnap = await get(ref(db, 'players'));
const playersRaw = playersSnap.val() ?? {};

// Build name → id map
const nameToId = {};
for (const [id, p] of Object.entries(playersRaw)) {
  nameToId[p.name] = id;
}

// Validate all players exist
for (const name of PLAYER_NAMES) {
  if (!nameToId[name]) {
    console.error(`Player not found in database: "${name}". Check the name matches exactly.`);
    process.exit(1);
  }
}

console.log('Players resolved:');
PLAYER_NAMES.forEach((n) => console.log(`  ${n} → ${nameToId[n]}`));

// Build tournament object
const now = Date.now();
const createdAt = new Date('2026-08-01').getTime(); // back-date to the approximate event date

const playerIdsRecord = {};
PLAYER_NAMES.forEach((name, i) => { playerIdsRecord[String(i)] = nameToId[name]; });

const rounds = {};
let allMatches = [];

for (let ri = 0; ri < MATCHES_BY_ROUND.length; ri++) {
  const matchesForRound = MATCHES_BY_ROUND[ri];
  const matchesRecord = {};

  for (const m of matchesForRound) {
    const matchId = `m${ri}_${m.court}`;
    const match = {
      id: matchId,
      courtIndex: m.court,
      a1: nameToId[m.a[0]],
      a2: nameToId[m.a[1]],
      b1: nameToId[m.b[0]],
      b2: nameToId[m.b[1]],
      score1: m.s1,
      score2: m.s2,
    };
    matchesRecord[matchId] = match;
    allMatches.push(match);
  }

  rounds[String(ri)] = {
    index: ri,
    completed: true,
    matches: matchesRecord,
  };
}

// Court names
const courtNames = { '0': 'Court 1', '1': 'Court 2' };

// Scoring config matching the 32-point fixed games
const scoring = {
  method: 'fixed-points',
  pointTarget: 32,
  winByTwo: false,
  goldenPoint: false,
  gamesPerSet: 6,
  setsToWin: 1,
  minutesPerRound: 15,
};

// Bonus config (super mexicano default — not applied retroactively here)
const bonus = {
  enabled: false,
  startRound: 1,
  winnersOnly: false,
  points: { '0': 3, '1': 2 },
};

// pointsTable: individual accumulated tournament points
const pointsTable = {};
for (const name of PLAYER_NAMES) {
  const id = nameToId[name];
  let pts = 0;
  for (const m of allMatches) {
    if (m.a1 === id || m.a2 === id) pts += m.score1;
    if (m.b1 === id || m.b2 === id) pts += m.score2;
  }
  pointsTable[id] = pts;
}

const tournament = {
  name: 'Super Mexicano – August 2026',
  format: 'super-mexicano',
  status: 'finished',
  playerIds: playerIdsRecord,
  courtNames,
  courtCount: 2,
  totalRounds: 6,
  currentRound: 5,
  scoring,
  bonus,
  seeded: false,
  pointsTable,
  rounds,
  createdAt,
  updatedAt: now,
};

// Push tournament
const tRef = push(ref(db, 'tournaments'));
const tournamentId = tRef.key;
tournament.id = tournamentId; // must be stored in the object so the app can read it back
await update(tRef, tournament);
console.log(`\nTournament created: ${tournamentId}`);

// ---------------------------------------------------------------------------
// Apply Elo + player stats updates
// ---------------------------------------------------------------------------
const ratings = {};
for (const name of PLAYER_NAMES) {
  const id = nameToId[name];
  const snap = await get(ref(db, `players/${id}/rating`));
  ratings[id] = (snap.val() ?? 1000);
}

const deltas = {};
for (const match of allMatches) {
  const d = computeDeltas(match, ratings);
  for (const [id, delta] of Object.entries(d)) {
    deltas[id] = (deltas[id] ?? 0) + delta;
  }
}

const updates = {};
const ts = Date.now();

for (const name of PLAYER_NAMES) {
  const id = nameToId[name];
  const base = playersRaw[id];
  const newRating = Math.max(0, Math.round((ratings[id] ?? 1000) + (deltas[id] ?? 0)));

  // Count wins/losses/played/pf/pa from all matches
  const myMatches = allMatches.filter((m) => [m.a1, m.a2, m.b1, m.b2].includes(id));
  const played = myMatches.length;
  const wins   = myMatches.filter((m) => (m.a1 === id || m.a2 === id) ? m.score1 > m.score2 : m.score2 > m.score1).length;
  const losses = myMatches.filter((m) => (m.a1 === id || m.a2 === id) ? m.score1 < m.score2 : m.score2 < m.score1).length;
  const pf = myMatches.reduce((s, m) => s + ((m.a1 === id || m.a2 === id) ? m.score1 : m.score2), 0);
  const pa = myMatches.reduce((s, m) => s + ((m.a1 === id || m.a2 === id) ? m.score2 : m.score1), 0);

  updates[`players/${id}/rating`] = newRating;
  updates[`players/${id}/ratingHistory/${ts}_${id}`] = newRating;
  updates[`players/${id}/matchesPlayed`] = (base.matchesPlayed ?? 0) + played;
  updates[`players/${id}/wins`]           = (base.wins ?? 0) + wins;
  updates[`players/${id}/losses`]         = (base.losses ?? 0) + losses;
  updates[`players/${id}/pointsFor`]      = (base.pointsFor ?? 0) + pf;
  updates[`players/${id}/pointsAgainst`]  = (base.pointsAgainst ?? 0) + pa;

  console.log(`  ${name.padEnd(18)} ${String(ratings[id]).padStart(4)} → ${String(newRating).padStart(4)}  (${deltas[id] >= 0 ? '+' : ''}${Math.round(deltas[id])})`);
}

await update(ref(db), updates);
console.log('\nDone — ratings and player stats updated.');
process.exit(0);
