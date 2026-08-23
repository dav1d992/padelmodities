import { inject, Injectable } from '@angular/core';
import {
  ref,
  set,
  update,
  push,
  get,
  remove,
  onValue,
} from 'firebase/database';
import { Observable } from 'rxjs';
import { FIREBASE_DB } from '../core/firebase';
import {
  DEFAULT_SKILLSET,
  ELO_K,
  type Player,
  type Skillset,
  type Tournament,
  type TournamentFormat,
  type TournamentMatch,
  type TournamentRound,
} from '../models/padel.model';

/** Reject if a Firebase call doesn't settle within the timeout. */
function withTimeout<T>(promise: Promise<T>, ms = 10_000): Promise<T> {
  const timeout = new Promise<T>((_, reject) => {
    setTimeout(
      () => reject(new Error("Couldn't reach the database. Check your connection or that the Realtime Database is active.")),
      ms,
    );
  });
  return Promise.race([promise, timeout]);
}

function clampSkillValue(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value)));
}

function normaliseSkillset(skillset?: Partial<Skillset>): Skillset {
  return {
    power: clampSkillValue(skillset?.power ?? DEFAULT_SKILLSET.power),
    agility: clampSkillValue(skillset?.agility ?? DEFAULT_SKILLSET.agility),
    stamina: clampSkillValue(skillset?.stamina ?? DEFAULT_SKILLSET.stamina),
    reflexes: clampSkillValue(skillset?.reflexes ?? DEFAULT_SKILLSET.reflexes),
    strategy: clampSkillValue(skillset?.strategy ?? DEFAULT_SKILLSET.strategy),
  };
}

// ---------------------------------------------------------------------------
// Round-generation helpers
// ---------------------------------------------------------------------------

/**
 * Generates all rounds for an Americano tournament using the circle/Berger
 * rotation method.  For N players (must be even, min 4) this produces N-1
 * rounds each with floor(N/4) courts.  When N is not divisible by 4 some
 * players naturally sit out each round.
 */
function generateAmericanoRounds(playerIds: string[]): TournamentMatch[][] {
  const n = playerIds.length;
  if (n < 4 || n % 2 !== 0) {
    throw new Error('Americano requires an even number of players (min 4).');
  }

  const fixed = playerIds[0];
  const rotating = playerIds.slice(1);
  const rounds: TournamentMatch[][] = [];
  const numRounds = n - 1;

  for (let r = 0; r < numRounds; r++) {
    const order = [fixed, ...rotating];

    // Pair symmetrically: order[i] with order[n-1-i]
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      pairs.push([order[i], order[n - 1 - i]]);
    }

    // Group consecutive pairs into courts (2 pairs → 1 match)
    const matches: TournamentMatch[] = [];
    for (let i = 0; i + 1 < pairs.length; i += 2) {
      matches.push({
        id: `r${r}_c${i / 2}`,
        team1p1: pairs[i][0],
        team1p2: pairs[i][1],
        team2p1: pairs[i + 1][0],
        team2p2: pairs[i + 1][1],
      });
    }
    rounds.push(matches);

    // Rotate: last element moves to front of rotating list
    rotating.unshift(rotating.pop()!);
  }

  return rounds;
}

/**
 * Generates a single Mexicano round by pairing players according to current
 * standings: within each group of 4 (sorted by points), pair 1st+4th vs
 * 2nd+3rd.
 */
function generateMexicanoRound(
  playerIds: string[],
  pointsTable: Record<string, number>,
  roundIndex: number,
): TournamentMatch[] {
  const sorted = [...playerIds].sort(
    (a, b) => (pointsTable[b] ?? 0) - (pointsTable[a] ?? 0),
  );

  const matches: TournamentMatch[] = [];
  for (let court = 0; court + 3 < sorted.length; court += 4) {
    const [p1, p2, p3, p4] = sorted.slice(court, court + 4);
    matches.push({
      id: `r${roundIndex}_c${court / 4}`,
      team1p1: p1,
      team1p2: p4,
      team2p1: p2,
      team2p2: p3,
    });
  }
  return matches;
}

// ---------------------------------------------------------------------------
// ELO helper
// ---------------------------------------------------------------------------

function eloExpected(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Returns per-player rating deltas for a single doubles match.
 * Actual score is normalised to [0,1] using the point ratio.
 */
function computeEloDeltas(
  match: TournamentMatch,
  ratings: Record<string, number>,
): Record<string, number> {
  const r = (id: string) => ratings[id] ?? 1000;
  const teamA = (r(match.team1p1) + r(match.team1p2)) / 2;
  const teamB = (r(match.team2p1) + r(match.team2p2)) / 2;
  const expA = eloExpected(teamA, teamB);
  const expB = 1 - expA;
  const total = (match.score1 ?? 0) + (match.score2 ?? 0);
  const actA = total > 0 ? (match.score1 ?? 0) / total : 0.5;
  const actB = 1 - actA;

  return {
    [match.team1p1]: ELO_K * (actA - expA),
    [match.team1p2]: ELO_K * (actA - expA),
    [match.team2p1]: ELO_K * (actB - expB),
    [match.team2p2]: ELO_K * (actB - expB),
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class PadelService {
  private db = inject(FIREBASE_DB);

  // ── Players ──────────────────────────────────────────────────────────────

  watchPlayers(): Observable<Player[]> {
    return new Observable<Player[]>((subscriber) => {
      const playersRef = ref(this.db, 'players');
      const unsubscribe = onValue(
        playersRef,
        (snapshot) => {
          const val = snapshot.val() as Record<string, Player> | null;
          const list = val ? Object.values(val) : [];
          list.sort((a, b) => b.rating - a.rating);
          subscriber.next(list);
        },
        (err) => subscriber.error(err),
      );
      return () => unsubscribe();
    });
  }

  watchPlayer(playerId: string): Observable<Player | null> {
    return new Observable<Player | null>((subscriber) => {
      const playerRef = ref(this.db, `players/${playerId}`);
      const unsubscribe = onValue(
        playerRef,
        (snapshot) => subscriber.next(snapshot.val() as Player | null),
        (err) => subscriber.error(err),
      );
      return () => unsubscribe();
    });
  }

  async createPlayer(
    name: string,
    shortname?: string,
    startingRating = 1000,
    skillset?: Partial<Skillset>,
  ): Promise<string> {
    const playerRef = push(ref(this.db, 'players'));
    const id = playerRef.key!;
    const player: Player = {
      id,
      name: name.trim(),
      ...(shortname ? { shortname: shortname.trim().toLowerCase() } : {}),
      rating: startingRating,
      skillset: normaliseSkillset(skillset),
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      createdAt: Date.now(),
    };
    await withTimeout(set(playerRef, player));
    return id;
  }

  async updatePlayerImage(playerId: string, shortname: string): Promise<void> {
    await withTimeout(
      update(ref(this.db, `players/${playerId}`), { shortname: shortname.trim().toLowerCase() }),
    );
  }

  async deletePlayer(playerId: string): Promise<void> {
    await withTimeout(remove(ref(this.db, `players/${playerId}`)));
  }

  // ── Tournaments ──────────────────────────────────────────────────────────

  watchTournaments(): Observable<Tournament[]> {
    return new Observable<Tournament[]>((subscriber) => {
      const tourRef = ref(this.db, 'tournaments');
      const unsubscribe = onValue(
        tourRef,
        (snapshot) => {
          const val = snapshot.val() as Record<string, Tournament> | null;
          const list = val ? Object.values(val) : [];
          list.sort((a, b) => b.createdAt - a.createdAt);
          subscriber.next(list);
        },
        (err) => subscriber.error(err),
      );
      return () => unsubscribe();
    });
  }

  watchTournament(tournamentId: string): Observable<Tournament | null> {
    return new Observable<Tournament | null>((subscriber) => {
      const tourRef = ref(this.db, `tournaments/${tournamentId}`);
      const unsubscribe = onValue(
        tourRef,
        (snapshot) => subscriber.next(snapshot.val() as Tournament | null),
        (err) => subscriber.error(err),
      );
      return () => unsubscribe();
    });
  }

  async createTournament(
    name: string,
    format: TournamentFormat,
    playerIds: string[],
  ): Promise<string> {
    if (playerIds.length < 4) {
      throw new Error('A tournament requires at least 4 players.');
    }
    if (playerIds.length % 2 !== 0) {
      throw new Error('Player count must be even (2v2 courts).');
    }

    const tourRef = push(ref(this.db, 'tournaments'));
    const id = tourRef.key!;

    // Initialise points table to 0 for all players
    const pointsTable: Record<string, number> = {};
    playerIds.forEach((pid) => (pointsTable[pid] = 0));

    // Store playerIds as an object (RTDB-safe)
    const playerIdsRecord: Record<string, string> = {};
    playerIds.forEach((pid, i) => (playerIdsRecord[String(i)] = pid));

    const tournament: Tournament = {
      id,
      name: name.trim(),
      format,
      status: 'active',
      playerIds: playerIdsRecord,
      currentRound: 0,
      pointsTable,
      createdAt: Date.now(),
    };

    await withTimeout(set(tourRef, tournament));

    // Generate and store round 0
    await this.generateAndStoreRound(id, format, playerIds, pointsTable, 0);

    return id;
  }

  private async generateAndStoreRound(
    tournamentId: string,
    format: TournamentFormat,
    playerIds: string[],
    pointsTable: Record<string, number>,
    roundIndex: number,
  ): Promise<void> {
    let matches: TournamentMatch[];

    if (format === 'americano') {
      const allRounds = generateAmericanoRounds(playerIds);
      if (roundIndex >= allRounds.length) return; // exhausted
      matches = allRounds[roundIndex];
    } else {
      matches = generateMexicanoRound(playerIds, pointsTable, roundIndex);
    }

    const matchesRecord: Record<string, TournamentMatch> = {};
    matches.forEach((m) => (matchesRecord[m.id] = m));

    const round: TournamentRound = {
      index: roundIndex,
      completed: false,
      matches: matchesRecord,
    };

    await withTimeout(
      set(ref(this.db, `tournaments/${tournamentId}/rounds/${roundIndex}`), round),
    );
  }

  async saveMatchScore(
    tournamentId: string,
    roundIndex: number,
    matchId: string,
    score1: number,
    score2: number,
  ): Promise<void> {
    await withTimeout(
      update(
        ref(
          this.db,
          `tournaments/${tournamentId}/rounds/${roundIndex}/matches/${matchId}`,
        ),
        { score1, score2 },
      ),
    );
  }

  /** Complete a round: update points table, optionally advance to next round. */
  async completeRound(tournamentId: string): Promise<void> {
    const snap = await withTimeout(
      get(ref(this.db, `tournaments/${tournamentId}`)),
    );
    const tournament = snap.val() as Tournament | null;
    if (!tournament) throw new Error('Tournament not found.');

    const roundIndex = tournament.currentRound;
    const round = tournament.rounds?.[roundIndex];
    if (!round) throw new Error('Current round not found.');

    const matches = round.matches ? Object.values(round.matches) : [];
    const hasAllScores = matches.every(
      (m) => m.score1 !== undefined && m.score2 !== undefined,
    );
    if (!hasAllScores) {
      throw new Error('Enter scores for all matches before completing the round.');
    }

    const playerIds = Object.values(tournament.playerIds ?? {});
    const pointsTable = { ...(tournament.pointsTable ?? {}) };

    // Accumulate tournament points (each player gets points equal to their team's score)
    for (const match of matches) {
      pointsTable[match.team1p1] = (pointsTable[match.team1p1] ?? 0) + (match.score1 ?? 0);
      pointsTable[match.team1p2] = (pointsTable[match.team1p2] ?? 0) + (match.score1 ?? 0);
      pointsTable[match.team2p1] = (pointsTable[match.team2p1] ?? 0) + (match.score2 ?? 0);
      pointsTable[match.team2p2] = (pointsTable[match.team2p2] ?? 0) + (match.score2 ?? 0);
    }

    const maxRounds =
      tournament.format === 'americano' ? playerIds.length - 1 : 999;
    const nextRound = roundIndex + 1;
    const isLast = nextRound >= maxRounds;

    const updates: Record<string, unknown> = {
      [`tournaments/${tournamentId}/rounds/${roundIndex}/completed`]: true,
      [`tournaments/${tournamentId}/pointsTable`]: pointsTable,
    };

    if (isLast) {
      updates[`tournaments/${tournamentId}/status`] = 'finished';
      updates[`tournaments/${tournamentId}/currentRound`] = roundIndex;
    } else {
      updates[`tournaments/${tournamentId}/currentRound`] = nextRound;
    }

    await withTimeout(update(ref(this.db), updates));

    // Apply ELO updates to global player ratings
    await this.applyEloUpdates(matches);

    // Generate next round if not the last
    if (!isLast) {
      await this.generateAndStoreRound(
        tournamentId,
        tournament.format,
        playerIds,
        pointsTable,
        nextRound,
      );
    }
  }

  /** Manually finish a tournament early. */
  async finishTournament(tournamentId: string): Promise<void> {
    const snap = await withTimeout(
      get(ref(this.db, `tournaments/${tournamentId}`)),
    );
    const tournament = snap.val() as Tournament | null;
    if (!tournament) throw new Error('Tournament not found.');

    await withTimeout(
      update(ref(this.db, `tournaments/${tournamentId}`), { status: 'finished' }),
    );
  }

  async deleteTournament(tournamentId: string): Promise<void> {
    await withTimeout(remove(ref(this.db, `tournaments/${tournamentId}`)));
  }

  // ── Private: ELO ─────────────────────────────────────────────────────────

  private async applyEloUpdates(matches: TournamentMatch[]): Promise<void> {
    // Fetch current ratings for all involved players
    const involved = new Set<string>();
    for (const m of matches) {
      [m.team1p1, m.team1p2, m.team2p1, m.team2p2].forEach((id) =>
        involved.add(id),
      );
    }

    const ratings: Record<string, number> = {};
    const fetchPromises = [...involved].map(async (id) => {
      const snap = await get(ref(this.db, `players/${id}/rating`));
      ratings[id] = (snap.val() as number | null) ?? 1000;
    });
    await Promise.all(fetchPromises);

    // Aggregate deltas across all matches
    const deltas: Record<string, number> = {};
    for (const match of matches) {
      if (match.score1 === undefined || match.score2 === undefined) continue;
      const d = computeEloDeltas(match, ratings);
      for (const [id, delta] of Object.entries(d)) {
        deltas[id] = (deltas[id] ?? 0) + delta;
      }
    }

    // Build batch update
    const updates: Record<string, unknown> = {};
    const now = Date.now();
    for (const [id, delta] of Object.entries(deltas)) {
      const newRating = Math.max(0, Math.round((ratings[id] ?? 1000) + delta));
      const won = matches.some(
        (m) =>
          (m.team1p1 === id || m.team1p2 === id) &&
          (m.score1 ?? 0) > (m.score2 ?? 0),
      );
      const lost = matches.some(
        (m) =>
          (m.team1p1 === id || m.team1p2 === id) &&
          (m.score1 ?? 0) < (m.score2 ?? 0),
      );
      const played = matches.filter(
        (m) =>
          m.team1p1 === id ||
          m.team1p2 === id ||
          m.team2p1 === id ||
          m.team2p2 === id,
      ).length;
      const pf = matches
        .filter((m) => m.team1p1 === id || m.team1p2 === id)
        .reduce((s, m) => s + (m.score1 ?? 0), 0)
        + matches
          .filter((m) => m.team2p1 === id || m.team2p2 === id)
          .reduce((s, m) => s + (m.score2 ?? 0), 0);
      const pa = matches
        .filter((m) => m.team1p1 === id || m.team1p2 === id)
        .reduce((s, m) => s + (m.score2 ?? 0), 0)
        + matches
          .filter((m) => m.team2p1 === id || m.team2p2 === id)
          .reduce((s, m) => s + (m.score1 ?? 0), 0);

      updates[`players/${id}/rating`] = newRating;
      updates[`players/${id}/ratingHistory/${now}_${id}`] = newRating;
      // Increment counters (read current value first would need transactions;
      // instead we accept minor race conditions for small clubs)
      const baseSnap = await get(ref(this.db, `players/${id}`));
      const base = (baseSnap.val() as Player | null) ?? ({} as Player);
      updates[`players/${id}/matchesPlayed`] = (base.matchesPlayed ?? 0) + played;
      updates[`players/${id}/wins`] = (base.wins ?? 0) + (won ? 1 : 0);
      updates[`players/${id}/losses`] = (base.losses ?? 0) + (lost ? 1 : 0);
      updates[`players/${id}/pointsFor`] = (base.pointsFor ?? 0) + pf;
      updates[`players/${id}/pointsAgainst`] = (base.pointsAgainst ?? 0) + pa;
    }

    await withTimeout(update(ref(this.db), updates));
  }
}
