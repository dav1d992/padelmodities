/**
 * One-off maintenance script: rebuilds every player's cumulative match
 * counters (matchesPlayed / wins / losses / pointsFor / pointsAgainst) from
 * the source of truth — the completed rounds of every tournament.
 *
 * Why: an earlier bug in applyMatchStats only counted wins/losses for players
 * seated on side A, so side-B results were dropped. Ratings are NOT touched.
 *
 * Dry-run (prints a diff, writes nothing):
 *   node scripts/recompute-player-stats.mjs
 * Apply the changes:
 *   node scripts/recompute-player-stats.mjs --apply
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyB7SZ13SfuXO6dbnHvNiiOCDIKDgViXCcg',
  authDomain: 'padelmodities.firebaseapp.com',
  databaseURL: 'https://padelmodities-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'padelmodities',
  storageBucket: 'padelmodities.firebasestorage.app',
  messagingSenderId: '413086928078',
  appId: '1:413086928078:web:fe2dbd98fda05c708fd49f',
};

const APPLY = process.argv.includes('--apply');

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const playersSnap = await get(ref(db, 'players'));
const players = playersSnap.val() ?? {};

const tournamentsSnap = await get(ref(db, 'tournaments'));
const tournaments = tournamentsSnap.val() ?? {};

// Fresh totals per player id.
const totals = {};
const ensure = (id) => {
  if (!totals[id]) {
    totals[id] = { matchesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
  }
  return totals[id];
};

for (const tournament of Object.values(tournaments)) {
  const rounds = Object.values(tournament.rounds ?? {});
  for (const round of rounds) {
    if (!round.completed) continue;
    const matches = Object.values(round.matches ?? {});
    for (const m of matches) {
      const s1 = m.score1 ?? 0;
      const s2 = m.score2 ?? 0;
      const sideA = [m.a1, m.a2].filter(Boolean);
      const sideB = [m.b1, m.b2].filter(Boolean);

      for (const id of sideA) {
        const t = ensure(id);
        t.matchesPlayed++;
        t.pointsFor += s1;
        t.pointsAgainst += s2;
        if (s1 > s2) t.wins++;
        else if (s1 < s2) t.losses++;
      }
      for (const id of sideB) {
        const t = ensure(id);
        t.matchesPlayed++;
        t.pointsFor += s2;
        t.pointsAgainst += s1;
        if (s2 > s1) t.wins++;
        else if (s2 < s1) t.losses++;
      }
    }
  }
}

const updates = {};
let changed = 0;

for (const [id, player] of Object.entries(players)) {
  const t = totals[id] ?? { matchesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
  const before = {
    matchesPlayed: player.matchesPlayed ?? 0,
    wins: player.wins ?? 0,
    losses: player.losses ?? 0,
    pointsFor: player.pointsFor ?? 0,
    pointsAgainst: player.pointsAgainst ?? 0,
  };

  const diff =
    before.matchesPlayed !== t.matchesPlayed ||
    before.wins !== t.wins ||
    before.losses !== t.losses ||
    before.pointsFor !== t.pointsFor ||
    before.pointsAgainst !== t.pointsAgainst;

  if (diff) {
    changed++;
    console.log(
      `${(player.name ?? id).padEnd(24)} ` +
        `MP ${before.matchesPlayed}->${t.matchesPlayed}  ` +
        `W ${before.wins}->${t.wins}  ` +
        `L ${before.losses}->${t.losses}  ` +
        `PF ${before.pointsFor}->${t.pointsFor}  ` +
        `PA ${before.pointsAgainst}->${t.pointsAgainst}`,
    );
  }

  updates[`players/${id}/matchesPlayed`] = t.matchesPlayed;
  updates[`players/${id}/wins`] = t.wins;
  updates[`players/${id}/losses`] = t.losses;
  updates[`players/${id}/pointsFor`] = t.pointsFor;
  updates[`players/${id}/pointsAgainst`] = t.pointsAgainst;
}

console.log(`\n${changed} player(s) would change.`);

if (!APPLY) {
  console.log('Dry-run only. Re-run with --apply to write changes.');
  process.exit(0);
}

await update(ref(db), updates);
console.log('Done — player stats recomputed and written.');
process.exit(0);
