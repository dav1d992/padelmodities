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
  isDynamicFormat,
  isTeamFormat,
  type CourtBonusConfig,
  type Player,
  type ScoringConfig,
  type Skillset,
  type Tournament,
  type TournamentFormat,
  type TournamentMatch,
  type TournamentRound,
  type TournamentStatus,
  type TournamentTeam,
} from '../models/padel.model';
import {
  computeStandings,
  generateAmericanoRounds,
  generateKothInitialRound,
  generateKothNextRound,
  generateMexicanoRound,
  generateTeamAmericanoRounds,
  generateTeamMexicanoRound,
  standingsOrder,
  validateScore,
} from './tournament-engine';

/** Everything needed to create or update a tournament (draft or active). */
export interface CreateTournamentInput {
  name: string;
  format: TournamentFormat;
  /** Individual formats. */
  playerIds: string[];
  /** Team formats. */
  teams?: TournamentTeam[];
  courtNames: string[];
  totalRounds: number;
  scoring: ScoringConfig;
  bonus?: CourtBonusConfig;
  seeded: boolean;
  status: 'draft' | 'active';
}

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
    control: clampSkillValue(skillset?.control ?? DEFAULT_SKILLSET.control),
    strategy: clampSkillValue(skillset?.strategy ?? DEFAULT_SKILLSET.strategy),
  };
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
  const teamA = (r(match.a1) + r(match.a2)) / 2;
  const teamB = (r(match.b1) + r(match.b2)) / 2;
  const expA = eloExpected(teamA, teamB);
  const expB = 1 - expA;
  const total = (match.score1 ?? 0) + (match.score2 ?? 0);
  const actA = total > 0 ? (match.score1 ?? 0) / total : 0.5;
  const actB = 1 - actA;

  return {
    [match.a1]: ELO_K * (actA - expA),
    [match.a2]: ELO_K * (actA - expA),
    [match.b1]: ELO_K * (actB - expB),
    [match.b2]: ELO_K * (actB - expB),
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

  /** Update any editable fields of a player (admin edit). */
  async updatePlayer(
    playerId: string,
    changes: {
      name: string;
      shortname?: string;
      rating: number;
      skillset: Partial<Skillset>;
      matchesPlayed: number;
      wins: number;
      losses: number;
      pointsFor: number;
      pointsAgainst: number;
    },
  ): Promise<void> {
    const trimmedShort = changes.shortname?.trim().toLowerCase();
    const payload = {
      name: changes.name.trim(),
      shortname: trimmedShort ? trimmedShort : null,
      rating: Math.round(changes.rating),
      skillset: normaliseSkillset(changes.skillset),
      matchesPlayed: Math.max(0, Math.round(changes.matchesPlayed)),
      wins: Math.max(0, Math.round(changes.wins)),
      losses: Math.max(0, Math.round(changes.losses)),
      pointsFor: Math.max(0, Math.round(changes.pointsFor)),
      pointsAgainst: Math.max(0, Math.round(changes.pointsAgainst)),
    };
    await withTimeout(update(ref(this.db, `players/${playerId}`), payload));
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

  /**
   * Create a tournament (draft or active). When `status` is 'active' the
   * initial round(s) are generated immediately.
   */
  async createTournament(input: CreateTournamentInput): Promise<string> {
    const tournament = this.buildTournamentRecord(input);
    const tourRef = push(ref(this.db, 'tournaments'));
    tournament.id = tourRef.key!;
    await withTimeout(set(tourRef, tournament));
    if (input.status === 'active') {
      await this.generateInitialRounds(tournament);
    }
    return tournament.id;
  }

  /** Update an existing draft in place (never touches an active tournament's rounds). */
  async updateDraft(
    tournamentId: string,
    input: CreateTournamentInput,
  ): Promise<void> {
    const record = this.buildTournamentRecord(input);
    record.id = tournamentId;
    await withTimeout(
      set(ref(this.db, `tournaments/${tournamentId}`), record),
    );
  }

  /** Promote a draft to active and generate its opening round(s). */
  async startTournament(tournamentId: string): Promise<void> {
    const tournament = await this.getTournament(tournamentId);
    if (tournament.status !== 'draft') return;
    await withTimeout(
      update(ref(this.db, `tournaments/${tournamentId}`), {
        status: 'active' satisfies TournamentStatus,
        updatedAt: Date.now(),
      }),
    );
    await this.generateInitialRounds({ ...tournament, status: 'active' });
  }

  private buildTournamentRecord(input: CreateTournamentInput): Tournament {
    const team = isTeamFormat(input.format);
    if (team) {
      if (!input.teams || input.teams.length < 2) {
        throw new Error('err.minTeams');
      }
    } else if (input.playerIds.length < 4) {
      throw new Error('err.min4');
    }

    const courtNames: Record<string, string> = {};
    input.courtNames.forEach((name, i) => {
      courtNames[String(i)] = name.trim() || `Bane ${i + 1}`;
    });

    const record: Tournament = {
      id: '',
      name: input.name.trim(),
      format: input.format,
      status: input.status,
      courtCount: input.courtNames.length,
      courtNames,
      totalRounds: input.totalRounds,
      currentRound: 0,
      scoring: input.scoring,
      seeded: input.seeded,
      pointsTable: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (team) {
      const teamsRecord: Record<string, TournamentTeam> = {};
      input.teams!.forEach((t, i) => (teamsRecord[String(i)] = t));
      record.teams = teamsRecord;
    } else {
      const playerIdsRecord: Record<string, string> = {};
      input.playerIds.forEach((pid, i) => (playerIdsRecord[String(i)] = pid));
      record.playerIds = playerIdsRecord;
    }

    if (input.format === 'super-mexicano' && input.bonus) {
      record.bonus = input.bonus;
    }
    return record;
  }

  /** Generate and store the opening round(s) for a freshly-started tournament. */
  private async generateInitialRounds(tournament: Tournament): Promise<void> {
    const { format, courtCount } = tournament;
    const rounds: Record<string, TournamentRound> = {};

    if (format === 'americano') {
      const playerIds = Object.values(tournament.playerIds ?? {});
      const generated = generateAmericanoRounds(
        playerIds,
        courtCount,
        tournament.totalRounds,
      );
      generated.forEach((r) => (rounds[String(r.index)] = r));
    } else if (format === 'team-americano') {
      const teamIds = Object.values(tournament.teams ?? {}).map((t) => t.id);
      const generated = generateTeamAmericanoRounds(
        teamIds,
        this.teamMap(tournament),
        courtCount,
      );
      generated.forEach((r) => (rounds[String(r.index)] = r));
      // Round-robin length is fixed by the number of teams/courts.
      await withTimeout(
        update(ref(this.db, `tournaments/${tournament.id}`), {
          totalRounds: generated.length,
        }),
      );
    } else if (format === 'king-of-the-hill') {
      const playerIds = Object.values(tournament.playerIds ?? {});
      rounds['0'] = generateKothInitialRound(
        playerIds,
        courtCount,
        tournament.seeded,
      );
    } else {
      // mexicano / super-mexicano / team-mexicano: only round 0 up front.
      rounds['0'] = this.buildDynamicRound(tournament, 0, []);
    }

    await withTimeout(
      set(ref(this.db, `tournaments/${tournament.id}/rounds`), rounds),
    );
  }

  private teamMap(tournament: Tournament): Record<string, TournamentTeam> {
    const map: Record<string, TournamentTeam> = {};
    Object.values(tournament.teams ?? {}).forEach((t) => (map[t.id] = t));
    return map;
  }

  /** Build a single dynamic (standings-based) round for a tournament. */
  private buildDynamicRound(
    tournament: Tournament,
    roundIndex: number,
    priorRounds: TournamentRound[],
  ): TournamentRound {
    const order = standingsOrder(tournament, (id) => this.participantName(tournament, id));

    if (tournament.format === 'team-mexicano') {
      const teamIds = Object.values(tournament.teams ?? {}).map((t) => t.id);
      return generateTeamMexicanoRound(
        teamIds,
        this.teamMap(tournament),
        tournament.courtCount,
        roundIndex,
        priorRounds,
        order,
      );
    }
    // mexicano + super-mexicano
    const playerIds = Object.values(tournament.playerIds ?? {});
    return generateMexicanoRound(
      playerIds,
      tournament.courtCount,
      roundIndex,
      priorRounds,
      order,
    );
  }

  private participantName(tournament: Tournament, id: string): string {
    const team = Object.values(tournament.teams ?? {}).find((t) => t.id === id);
    return team?.name ?? id;
  }

  /** Persist a match score (works on any round; used for entry and editing). */
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
    await this.refreshPointsTable(tournamentId);
  }

  /** Clear a match score. */
  async resetMatchScore(
    tournamentId: string,
    roundIndex: number,
    matchId: string,
  ): Promise<void> {
    await withTimeout(
      update(
        ref(
          this.db,
          `tournaments/${tournamentId}/rounds/${roundIndex}/matches/${matchId}`,
        ),
        { score1: null, score2: null, setScores: null },
      ),
    );
    await this.refreshPointsTable(tournamentId);
  }

  /** Regenerate the current round of a dynamic format (only if unscored). */
  async regenerateCurrentRound(tournamentId: string): Promise<void> {
    const tournament = await this.getTournament(tournamentId);
    if (!isDynamicFormat(tournament.format)) {
      throw new Error('err.dynamicOnly');
    }
    const roundIndex = tournament.currentRound;
    const round = tournament.rounds?.[roundIndex];
    if (round?.completed) throw new Error('err.roundDone');
    const anyScore = Object.values(round?.matches ?? {}).some(
      (m) => m.score1 !== undefined || m.score2 !== undefined,
    );
    if (anyScore) {
      throw new Error('err.regenScores');
    }

    const prior = this.sortedRounds(tournament).filter(
      (r) => r.index < roundIndex,
    );

    let newRound: TournamentRound;
    if (tournament.format === 'king-of-the-hill') {
      if (roundIndex === 0) {
        newRound = generateKothInitialRound(
          Object.values(tournament.playerIds ?? {}),
          tournament.courtCount,
          tournament.seeded,
        );
      } else {
        const prev = prior[prior.length - 1];
        newRound = generateKothNextRound(
          prev,
          prior.slice(0, -1),
          roundIndex,
          Object.values(tournament.playerIds ?? {}),
        );
      }
    } else {
      newRound = this.buildDynamicRound(tournament, roundIndex, prior);
    }

    await withTimeout(
      set(
        ref(this.db, `tournaments/${tournamentId}/rounds/${roundIndex}`),
        newRound,
      ),
    );
  }

  /** Complete the current round: validate, advance or finish, generate next. */
  async completeRound(tournamentId: string): Promise<void> {
    const tournament = await this.getTournament(tournamentId);
    const roundIndex = tournament.currentRound;
    const round = tournament.rounds?.[roundIndex];
    if (!round) throw new Error('err.roundNotFound');

    const matches = round.matches ? Object.values(round.matches) : [];
    for (const m of matches) {
      if (m.score1 === undefined || m.score2 === undefined) {
        throw new Error('err.enterBeforeComplete');
      }
      const v = validateScore(m.score1, m.score2, tournament.scoring, tournament.format);
      if (!v.valid) throw new Error(v.reason ?? 'err.invalidScore');
    }

    // Mark completed first so recomputed standings include this round.
    await withTimeout(
      update(ref(this.db, `tournaments/${tournamentId}/rounds/${roundIndex}`), {
        completed: true,
      }),
    );
    const completedTournament: Tournament = {
      ...tournament,
      rounds: {
        ...(tournament.rounds ?? {}),
        [roundIndex]: { ...round, completed: true },
      },
    };

    const isStatic =
      tournament.format === 'americano' ||
      tournament.format === 'team-americano';
    const nextRound = roundIndex + 1;
    const precomputedNext = tournament.rounds?.[nextRound];
    const isLast = isStatic
      ? !precomputedNext
      : nextRound >= tournament.totalRounds;

    const updates: Record<string, unknown> = {
      [`tournaments/${tournamentId}/updatedAt`]: Date.now(),
    };
    if (isLast) {
      updates[`tournaments/${tournamentId}/status`] = 'finished';
      updates[`tournaments/${tournamentId}/currentRound`] = roundIndex;
    } else {
      updates[`tournaments/${tournamentId}/currentRound`] = nextRound;
    }
    await withTimeout(update(ref(this.db), updates));

    // Global ELO / player stats from the completed round.
    await this.applyEloUpdates(matches);

    // Generate the next dynamic round if needed.
    if (!isLast && !isStatic) {
      let newRound: TournamentRound;
      if (tournament.format === 'king-of-the-hill') {
        const prior = this.sortedRounds(completedTournament).filter(
          (r) => r.index < roundIndex,
        );
        newRound = generateKothNextRound(
          { ...round, completed: true },
          prior,
          nextRound,
          Object.values(tournament.playerIds ?? {}),
        );
      } else {
        const prior = this.sortedRounds(completedTournament);
        newRound = this.buildDynamicRound(completedTournament, nextRound, prior);
      }
      await withTimeout(
        set(
          ref(this.db, `tournaments/${tournamentId}/rounds/${nextRound}`),
          newRound,
        ),
      );
    }

    await this.refreshPointsTable(tournamentId);
  }

  private sortedRounds(t: Tournament): TournamentRound[] {
    return Object.values(t.rounds ?? {}).sort((a, b) => a.index - b.index);
  }

  private async getTournament(tournamentId: string): Promise<Tournament> {
    const snap = await withTimeout(
      get(ref(this.db, `tournaments/${tournamentId}`)),
    );
    const tournament = snap.val() as Tournament | null;
    if (!tournament) throw new Error('err.tournamentNotFound');
    return tournament;
  }

  /** Recompute and cache the participant → total-points table. */
  private async refreshPointsTable(tournamentId: string): Promise<void> {
    const tournament = await this.getTournament(tournamentId);
    const standings = computeStandings(tournament, (id) =>
      this.participantName(tournament, id),
    );
    const pointsTable: Record<string, number> = {};
    standings.forEach((row) => (pointsTable[row.participantId] = row.total));
    await withTimeout(
      update(ref(this.db, `tournaments/${tournamentId}`), { pointsTable }),
    );
  }

  /** Manually finish a tournament early. */
  async finishTournament(tournamentId: string): Promise<void> {
    const snap = await withTimeout(
      get(ref(this.db, `tournaments/${tournamentId}`)),
    );
    const tournament = snap.val() as Tournament | null;
    if (!tournament) throw new Error('err.tournamentNotFound');

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
      [m.a1, m.a2, m.b1, m.b2].forEach((id) => involved.add(id));
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
          (m.a1 === id || m.a2 === id) && (m.score1 ?? 0) > (m.score2 ?? 0),
      );
      const lost = matches.some(
        (m) =>
          (m.a1 === id || m.a2 === id) && (m.score1 ?? 0) < (m.score2 ?? 0),
      );
      const played = matches.filter(
        (m) => m.a1 === id || m.a2 === id || m.b1 === id || m.b2 === id,
      ).length;
      const pf = matches
        .filter((m) => m.a1 === id || m.a2 === id)
        .reduce((s, m) => s + (m.score1 ?? 0), 0)
        + matches
          .filter((m) => m.b1 === id || m.b2 === id)
          .reduce((s, m) => s + (m.score2 ?? 0), 0);
      const pa = matches
        .filter((m) => m.a1 === id || m.a2 === id)
        .reduce((s, m) => s + (m.score2 ?? 0), 0)
        + matches
          .filter((m) => m.b1 === id || m.b2 === id)
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
